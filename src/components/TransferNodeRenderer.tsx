import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import mqtt from "mqtt";
import { HierarchyPointNode } from "d3";
import { TreeNode } from "../utils/transformer";
import { useStore } from "../store/useStore";
import { QRCodeSVG } from "qrcode.react";
import jsQR from "jsqr";
import LZString from "lz-string";
import {
  Copy,
  Plus,
  Video,
  Image as ImageIcon,
  Send,
  MessageSquare,
  X,
  RefreshCw,
  UploadCloud,
  Download,
  Check,
  File,
  Globe,
  Share2,
  Laptop,
  Smartphone,
  Terminal,
  History,
  ChevronRight,
  Activity,
  Maximize,
  Minimize,
  MoreVertical,
  Trash2,
  ExternalLink,
  Play,
  Volume2,
  FileText,
  Search,
  Clock,
  Eye,
  ClipboardPaste,
  QrCode,
  LogIn,
  Bluetooth,
  MonitorSmartphone,
  SmartphoneNfc,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { motion, AnimatePresence } from "motion/react";
import { db } from "../lib/db";

interface Message {
  id: string;
  sender: "me" | "remote";
  type: "text" | "file" | "node" | "workspace";
  content: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  thumbnail?: string;
  timestamp: number;
  status: "sending" | "sent" | "delivered" | "received" | "error";
  chunksSent?: number;
  chunksTotal?: number;
}

const getFileType = (fileName: string) => {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext || ""))
    return "image";
  if (["mp4", "webm", "ogg", "mov"].includes(ext || "")) return "video";
  if (["mp3", "wav", "m4a", "flac"].includes(ext || "")) return "audio";
  if (["pdf"].includes(ext || "")) return "pdf";
  return "file";
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

export const TransferNodeRenderer: React.FC<{
  node: HierarchyPointNode<TreeNode>;
  isSelected?: boolean;
}> = ({ node, isSelected }) => {
  const { parsedData, setCode, appTheme, setNotification, codeFormat } =
    useStore();
  const [connectionState, setConnectionState] = useState<
    | "waiting"
    | "pairing"
    | "connected"
    | "transferring"
    | "messaging"
    | "failed"
  >("waiting");
  const [isHosting, setIsHosting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");

  const [offerQR, setOfferQR] = useState("");
  const [answerQR, setAnswerQR] = useState("");

  const [scanMode, setScanMode] = useState<"offer" | "answer" | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [copyPasteOffer, setCopyPasteOffer] = useState("");
  const [copyPasteAnswer, setCopyPasteAnswer] = useState("");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const chunksRef = useRef<
    Record<
      string,
      {
        type: string;
        fileName?: string;
        total: number;
        received: string[];
        count: number;
      }
    >
  >({});
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);

  const [transferProgress, setTransferProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<"chat" | "media">("chat");
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");

  const [diagnostics, setDiagnostics] = useState({
    originalSdpSize: 0,
    filteredSdpSize: 0,
    candidateCount: 0,
    compressedSize: 0,
    compressionRatio: 0,
    qrPayloadLength: 0,
    genTime: 0,
    scanTime: 0,
    transferSpeed: 0,
    bufferedAmount: 0,
  });

  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = () => {
    if ("Notification" in window) {
      Notification.requestPermission().then(setNotificationPermission);
    }
  };

  const sendLocalNotification = (title: string, body: string) => {
    if (document.visibilityState === "hidden" && notificationPermission === "granted") {
      try {
        new Notification(title, { body, icon: "/icon.png" });
      } catch (e) {
        console.warn("Notification failed", e);
      }
    }
  };

  const [selectedMedia, setSelectedMedia] = useState<Message | null>(null);
  const [showContextMenu, setShowContextMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);

  const [pairingMode, setPairingMode] = useState<"local" | "universal">("local");
  const [pairingWorkflow, setPairingWorkflow] = useState<"bluetooth" | "qr" | "manual">("bluetooth");
  const [btSupported, setBtSupported] = useState(true);
  const [btState, setBtState] = useState<"idle" | "hosting" | "searching" | "found" | "exchanging">("idle");
  const [btDeviceName, setBtDeviceName] = useState(() => localStorage.getItem("transfer_device_name") || "My Device");
  const [isEditingDeviceName, setIsEditingDeviceName] = useState(false);
  const [btDiscoveredDevices, setBtDiscoveredDevices] = useState<{id: string, name: string}[]>([]);
  const btDeviceId = useMemo(() => uuidv4(), []);
  const mqttTopic = useMemo(() => "transfer-node-bt-" + window.location.hostname, []);
  
  const [mqttClient, setMqttClient] = useState<mqtt.MqttClient | null>(null);

  const offerRef = useRef(offerQR);
  offerRef.current = offerQR;
  const answerRef = useRef(answerQR);
  answerRef.current = answerQR;
  const handleScanRef = useRef<any>(null);

  useEffect(() => {
    const client = mqtt.connect("wss://test.mosquitto.org:8081/mqtt");
    
    client.on("connect", () => {
      client.subscribe(mqttTopic);
      setMqttClient(client);
    });

    return () => {
      client.end();
    };
  }, [mqttTopic]);

  useEffect(() => {
    if (!mqttClient) return;

    const handleBtMessage = (topic: string, message: any) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === "DISCOVER" && btState === "hosting") {
          mqttClient.publish(mqttTopic, JSON.stringify({ type: "DEVICE_HERE", id: btDeviceId, name: btDeviceName }));
        } else if (data.type === "DEVICE_HERE" && btState === "searching" && data.id !== btDeviceId) {
          setBtDiscoveredDevices(prev => {
            if (!prev.find(d => d.id === data.id)) return [...prev, { id: data.id, name: data.name }];
            return prev;
          });
        } else if (data.type === "REQUEST_OFFER" && data.targetId === btDeviceId && btState === "hosting") {
          if (offerRef.current) {
            mqttClient.publish(mqttTopic, JSON.stringify({ type: "OFFER_SDP", targetId: data.sourceId, sdp: offerRef.current, sourceId: btDeviceId }));
            setBtState("exchanging");
            setNotification({ message: "Sending Offer SDP...", type: "success" });
          }
        } else if (data.type === "OFFER_SDP" && data.targetId === btDeviceId) {
          handleScanRef.current(data.sdp);
          setBtState("exchanging");
          setNotification({ message: "Received Offer. Generating Answer...", type: "success" });
          
          let attempts = 0;
          const checkAnswer = setInterval(() => {
            attempts++;
            if (answerRef.current) {
              clearInterval(checkAnswer);
              mqttClient.publish(mqttTopic, JSON.stringify({ type: "ANSWER_SDP", targetId: data.sourceId, sdp: answerRef.current }));
              setNotification({ message: "Answer Generated & Sent!", type: "success" });
            } else if (attempts > 20) {
              clearInterval(checkAnswer);
            }
          }, 500);
        } else if (data.type === "ANSWER_SDP" && data.targetId === btDeviceId) {
           handleScanRef.current(data.sdp);
           setNotification({ message: "Received Answer. Establishing Connection!", type: "success" });
        }
      } catch (err) {
        console.error("MQTT parse err", err);
      }
    };
    
    mqttClient.on("message", handleBtMessage);
    return () => {
      mqttClient.off("message", handleBtMessage);
    }
  }, [btState, btDeviceId, btDeviceName, mqttClient, mqttTopic]);

  useEffect(() => {
    if (btState === "searching" && mqttClient) {
      setBtDiscoveredDevices([]);
      mqttClient.publish(mqttTopic, JSON.stringify({ type: "DISCOVER" }));
      const interval = setInterval(() => {
        mqttClient.publish(mqttTopic, JSON.stringify({ type: "DISCOVER" }));
      }, 1500); // Faster discovery

      const timeout = setTimeout(() => {
        clearInterval(interval);
        if (btDiscoveredDevices.length === 0) {
          setNotification({ message: "Discovery timeout. No devices found.", type: "error" });
          setBtState("idle");
        }
      }, 15000); // 15s timeout

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      }
    }
  }, [btState, mqttClient, mqttTopic, btDiscoveredDevices.length]);

  useEffect(() => {
    if (btState === "exchanging") {
      const timeout = setTimeout(() => {
        if (connectionState !== "connected" && connectionState !== "transferring") {
          setNotification({ message: "SDP Exchange timeout. Try again.", type: "error" });
          setBtState("idle");
        }
      }, 15000); // 15 seconds for SDP negotiation
      return () => clearTimeout(timeout);
    }
  }, [btState, connectionState]);

  // Reset pairing if connection state changes
  useEffect(() => {
    if (connectionState === "connected" && btState !== "idle") {
      setPairingWorkflow("qr"); // go back to normal view
      setBtState("idle");
    }
  }, [connectionState, btState]);

  const saveDeviceName = (name: string) => {
    const newName = name.trim() || "My Device";
    setBtDeviceName(newName);
    localStorage.setItem("transfer_device_name", newName);
    setIsEditingDeviceName(false);
  };
  const [clipboardDetectedSdp, setClipboardDetectedSdp] = useState<string | null>(null);
  const [qrDensity, setQrDensity] = useState<"L" | "M" | "Q" | "H">("L");
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  useEffect(() => {
    const checkClipboardForSdp = async () => {
      if (connectionState === "pairing") {
        try {
          const text = await navigator.clipboard.readText();
          if (text && text.length > 50 && (text.startsWith("b64:") || text.startsWith("uri:") || text.startsWith("u16:"))) {
            if (text !== offerQR && text !== answerQR && text !== copyPasteOffer && text !== copyPasteAnswer) {
              setClipboardDetectedSdp(text.trim());
            } else {
              setClipboardDetectedSdp(null);
            }
          } else {
            setClipboardDetectedSdp(null);
          }
        } catch (err) {
          setClipboardDetectedSdp(null);
        }
      }
    };

    window.addEventListener("focus", checkClipboardForSdp);
    // Also check once when entering pairing state if focused
    if (document.hasFocus()) {
      checkClipboardForSdp();
    }

    return () => window.removeEventListener("focus", checkClipboardForSdp);
  }, [connectionState, offerQR, answerQR, copyPasteOffer, copyPasteAnswer]);

  useEffect(() => {
    const handleScroll = () => {
      if (!scrollRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 100;
      setIsAtBottom(atBottom);
      if (atBottom) {
        setUnreadCount(0);
        setShowScrollDown(false);
      }
    };

    const container = scrollRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
    }
    return () => container?.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (isAtBottom && scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isAtBottom]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (dcRef.current) {
        setDiagnostics(prev => ({
          ...prev,
          bufferedAmount: dcRef.current?.bufferedAmount || 0,
        }));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const videoRefCallback = useCallback(
    (node: HTMLVideoElement | null) => {
      if (!node || !scanMode) {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current);
          scanIntervalRef.current = null;
        }
        return;
      }

      navigator.mediaDevices
        .getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 720 },
            height: { ideal: 720 },
          },
        })
        .then((str) => {
          streamRef.current = str;
          node.srcObject = str;
          node.setAttribute("playsinline", "true");
          node.play().catch((e) => console.warn("Video play interrupted", e));

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          
          let scanHistory: string[] = [];
          setDiagnostics(prev => ({ ...prev, scanTime: performance.now() }));

          scanIntervalRef.current = setInterval(() => {
            if (node.readyState === node.HAVE_ENOUGH_DATA && ctx) {
              const width = Math.min(node.videoWidth, 600);
              const height = (node.videoHeight / node.videoWidth) * width;

              canvas.width = width;
              canvas.height = height;
              ctx.drawImage(node, 0, 0, width, height);

              const roiSize = Math.min(width, height) * 0.7;
              const sx = (width - roiSize) / 2;
              const sy = (height - roiSize) / 2;

              let code = null;

              const roiData = ctx.getImageData(sx, sy, roiSize, roiSize);
              code = jsQR(roiData.data, roiData.width, roiData.height, {
                inversionAttempts: "dontInvert",
              });

              if (!code) {
                const fullData = ctx.getImageData(0, 0, width, height);
                code = jsQR(fullData.data, fullData.width, fullData.height, {
                  inversionAttempts: "dontInvert",
                });
              }

              if (code && code.data) {
                scanHistory.push(code.data);
                if (scanHistory.length > 3) scanHistory.shift();

                if (scanHistory.length === 3 && scanHistory.every((c) => c === code!.data)) {
                  setDiagnostics(prev => ({ ...prev, scanTime: performance.now() - prev.scanTime }));
                  handleScan(code.data);
                  scanHistory = [];
                }
              } else {
                scanHistory = [];
              }
            }
          }, 150);
        })
        .catch((err) => {
          setNotification({
            message: "Camera access denied or error: " + err.message,
            type: "error",
          });
          setScanMode(null);
        });
    },
    [scanMode],
  );

  const CHUNK_SIZE = 16384;

  const sendLargeMessage = async (
    type: string,
    payloadStr: string,
    fileName?: string,
  ) => {
    if (!dcRef.current || dcRef.current.readyState !== "open") return;
    const msgId = uuidv4();
    const totalChunks = Math.ceil(payloadStr.length / CHUNK_SIZE);
    const startTime = performance.now();

    const initialMsg: Message = {
      id: msgId,
      sender: "me",
      type: type as any,
      content: type === "file" ? "" : payloadStr,
      fileName,
      fileType: fileName ? getFileType(fileName) : undefined,
      fileSize: payloadStr.length,
      timestamp: Date.now(),
      status: "sending",
      chunksSent: 0,
      chunksTotal: totalChunks,
    };
    
    if (type === "file") {
      setMessages(prev => [...prev, initialMsg]);
    }

    dcRef.current.send(
      JSON.stringify({
        type: "chunk_start",
        msgId,
        msgType: type,
        totalChunks,
        fileName,
        fileSize: payloadStr.length,
      }),
    );

    for (let i = 0; i < totalChunks; i++) {
      const chunk = payloadStr.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);

      while (dcRef.current.bufferedAmount > 1024 * 1024) {
        await new Promise((r) => setTimeout(r, 50));
      }

      dcRef.current.send(
        JSON.stringify({
          type: "chunk_data",
          msgId,
          chunkIndex: i,
          chunk,
        }),
      );

      const progress = Math.floor(((i + 1) / totalChunks) * 100);
      setTransferProgress(progress);
      
      if (type === "file") {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, chunksSent: i + 1 } : m));
      }

      // Update diagnostics
      const elapsed = (performance.now() - startTime) / 1000;
      const speed = (i + 1) * CHUNK_SIZE / elapsed;
      setDiagnostics(prev => ({ ...prev, transferSpeed: speed }));
    }

    dcRef.current.send(JSON.stringify({ type: "chunk_end", msgId }));
    setTransferProgress(0);
    
    if (type === "file") {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: "sent" } : m));
    }
  };

  const minimizeSDP = (sdp: string, mode: "local" | "universal") => {
    let candidateCount = 0;
    const lines = sdp.split("\r\n");
    const filtered = lines.filter((line) => {
      if (line.startsWith("a=candidate:")) {
        candidateCount++;
        if (mode === "local") {
          if (!line.includes("typ host")) return false;
          if (line.includes("tcptype")) return false;
        }
      }
      if (line.startsWith("a=extmap:")) return false;
      if (line.startsWith("a=rtcp-fb:")) return false;
      if (line.startsWith("a=rtcp-mux")) return false;
      if (line.startsWith("a=rtpmap:")) return false;
      if (line.startsWith("a=fmtp:")) return false;
      return true;
    });
    return {
      minimized: filtered.join("\r\n"),
      candidateCount,
    };
  };

  const compressPayload = (payload: string) => {
    const b64 = LZString.compressToBase64(payload);
    const utf16 = LZString.compressToUTF16(payload);
    const uri = LZString.compressToEncodedURIComponent(payload);

    let best = b64;
    let prefix = "b64:";
    if (uri.length < best.length) {
      best = uri;
      prefix = "uri:";
    }
    if (utf16.length < best.length) {
      best = utf16;
      prefix = "u16:";
    }
    return prefix + best;
  };

  const decompressPayload = (code: string) => {
    if (code.startsWith("b64:"))
      return LZString.decompressFromBase64(code.slice(4));
    if (code.startsWith("uri:"))
      return LZString.decompressFromEncodedURIComponent(code.slice(4));
    if (code.startsWith("u16:"))
      return LZString.decompressFromUTF16(code.slice(4));
    return LZString.decompressFromBase64(code);
  };

  const initPeer = () => {
    if (pcRef.current) pcRef.current.close();

    const config: RTCConfiguration =
      pairingMode === "universal"
        ? { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }
        : { iceServers: [] };

    const pc = new RTCPeerConnection(config);

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "connected") {
        setConnectionState("connected");
      } else if (
        pc.iceConnectionState === "failed" ||
        pc.iceConnectionState === "disconnected"
      ) {
        setConnectionState("failed");
      }
    };

    pc.ondatachannel = (e) => {
      handleDataChannel(e.channel);
    };

    pcRef.current = pc;
    return pc;
  };

  const handleDataChannel = (dc: RTCDataChannel) => {
    dcRef.current = dc;
    dc.onopen = () => {
      setConnectionState("connected");
      setNotification({
        message: "Direct device connection established!",
        type: "success",
      });
    };
    dc.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "msg_ack") {
          setMessages(prev => prev.map(m => m.id === msg.msgId ? { ...m, status: "delivered" } : m));
          return;
        }

        if (msg.type === "text") {
          const newMsg: Message = {
            id: uuidv4(),
            sender: "remote",
            type: "text",
            content: msg.content,
            timestamp: Date.now(),
            status: "received",
          };
          setMessages((prev) => [...prev, newMsg]);
          
          if (!isAtBottom || document.visibilityState === "hidden") {
            setUnreadCount(prev => prev + 1);
            setShowScrollDown(true);
            sendLocalNotification("New Message", msg.content);
          }
          
          dc.send(JSON.stringify({ type: "msg_ack", msgId: msg.id }));
        } else if (msg.type === "chunk_start") {
          chunksRef.current[msg.msgId] = {
            type: msg.msgType,
            fileName: msg.fileName,
            total: msg.totalChunks,
            received: new Array(msg.totalChunks),
            count: 0,
          };
          setConnectionState("transferring");
          
          if (msg.msgType === "file") {
            sendLocalNotification("Incoming File", `Receiving ${msg.fileName || "unknown file"}...`);
          }
        } else if (msg.type === "chunk_data") {
          const chunkData = chunksRef.current[msg.msgId];
          if (chunkData) {
            chunkData.received[msg.chunkIndex] = msg.chunk;
            chunkData.count++;
            const progress = Math.floor((chunkData.count / chunkData.total) * 100);
            setTransferProgress(progress);
          }
        } else if (msg.type === "chunk_end") {
          const chunkData = chunksRef.current[msg.msgId];
          if (chunkData) {
            const fullPayload = chunkData.received.join("");
            const isCorrupted = chunkData.count !== chunkData.total || chunkData.received.includes(undefined as any);
            
            if (isCorrupted || (msg.fileSize && fullPayload.length !== msg.fileSize)) {
              console.error("Integrity check failed", { count: chunkData.count, total: chunkData.total, expectedSize: msg.fileSize, actualSize: fullPayload.length });
              setNotification({ message: "File transfer corrupted or incomplete. Please retry.", type: "error" });
              delete chunksRef.current[msg.msgId];
              setConnectionState("connected");
              return;
            }

            delete chunksRef.current[msg.msgId];
            setTransferProgress(0);
            setConnectionState("connected");

            if (chunkData.type === "workspace") {
              try {
                const parsed = JSON.parse(fullPayload);
                setCode(JSON.stringify(parsed, null, 2));
                setNotification({
                  message: "Received and loaded workspace!",
                  type: "success",
                });
              } catch (err) {}
            } else if (chunkData.type === "file") {
              const fType = chunkData.fileName ? getFileType(chunkData.fileName) : "file";
              const newMsg: Message = {
                id: msg.msgId,
                sender: "remote",
                type: "file",
                fileName: chunkData.fileName,
                fileType: fType,
                fileSize: fullPayload.length,
                content: fullPayload,
                timestamp: Date.now(),
                status: "received",
              };
              setMessages((prev) => [...prev, newMsg]);
              
              if (!isAtBottom || document.visibilityState === "hidden") {
                setUnreadCount(prev => prev + 1);
                setShowScrollDown(true);
                sendLocalNotification("File Received", chunkData.fileName || "New file received");
              }
            }
          }
        }
      } catch (err) {
        console.error("DataChannel error", err);
      }
    };
  };

  const generateOffer = async () => {
    setIsHosting(true);
    const start = performance.now();
    const pc = initPeer();
    const dc = pc.createDataChannel("transfer");
    handleDataChannel(dc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await new Promise<void>((resolve) => {
      if (pc.iceGatheringState === "complete") return resolve();
      const timeout = setTimeout(resolve, 1000);
      pc.onicecandidate = (e) => {
        if (!e.candidate) {
          clearTimeout(timeout);
          resolve();
        }
      };
    });

    const currentDesc = pc.localDescription;
    if (currentDesc) {
      const origSdp = currentDesc.sdp;
      const { minimized, candidateCount } = minimizeSDP(
        origSdp || "",
        pairingMode,
      );
      const payloadObj = { type: currentDesc.type, sdp: minimized };
      const payload = JSON.stringify(payloadObj);
      const compressed = compressPayload(payload);

      setDiagnostics((prev) => ({
        ...prev,
        originalSdpSize: origSdp ? origSdp.length : 0,
        filteredSdpSize: minimized.length,
        candidateCount,
        compressedSize: compressed.length - 4,
        compressionRatio: Math.round(
          ((compressed.length - 4) / minimized.length) * 100,
        ),
        qrPayloadLength: compressed.length,
        genTime: performance.now() - start,
      }));

      setOfferQR(compressed);
      setConnectionState("pairing");
    }
  };

  const handleScan = (code: string) => {
    if (!code) return;
    try {
      const uncompressed = decompressPayload(code);
      const desc = JSON.parse(uncompressed || code);
      if (desc.type === "offer") {
        processOffer(desc);
      } else if (desc.type === "answer") {
        processAnswer(desc);
      }
      setScanError(null);
    } catch (e) {
      setScanError(
        "Invalid pairing code scanned. Keep scanning or try another code.",
      );
      setTimeout(() => setScanError(null), 3000);
    }
  };

  const processOffer = async (offer: any) => {
    const start = performance.now();
    const pc = initPeer();
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await new Promise<void>((resolve) => {
      if (pc.iceGatheringState === "complete") return resolve();
      const timeout = setTimeout(resolve, 1000);
      pc.onicecandidate = (e) => {
        if (!e.candidate) {
          clearTimeout(timeout);
          resolve();
        }
      };
    });

    const currentDesc = pc.localDescription;
    if (currentDesc) {
      const origSdp = currentDesc.sdp;
      const { minimized, candidateCount } = minimizeSDP(
        origSdp || "",
        pairingMode,
      );
      const payloadObj = { type: currentDesc.type, sdp: minimized };
      const payload = JSON.stringify(payloadObj);
      const compressed = compressPayload(payload);

      setDiagnostics((prev) => ({
        ...prev,
        originalSdpSize: origSdp ? origSdp.length : 0,
        filteredSdpSize: minimized.length,
        candidateCount,
        compressedSize: compressed.length - 4,
        compressionRatio: Math.round(
          ((compressed.length - 4) / minimized.length) * 100,
        ),
        qrPayloadLength: compressed.length,
        genTime: performance.now() - start,
      }));

      setAnswerQR(compressed);
      setScanMode(null);
      setConnectionState("pairing");
    }
  };
  handleScanRef.current = handleScan;

  const processAnswer = async (answer: any) => {
    if (pcRef.current) {
      await pcRef.current.setRemoteDescription(
        new RTCSessionDescription(answer),
      );
      setScanMode(null);
      setConnectionState("connected");
    }
  };

  const sendMessage = () => {
    if (
      !chatInput.trim() ||
      !dcRef.current ||
      dcRef.current.readyState !== "open"
    )
      return;
    const msgId = uuidv4();
    const msg: Message = {
      id: msgId,
      sender: "me",
      type: "text",
      content: chatInput,
      timestamp: Date.now(),
      status: "sent",
    };
    dcRef.current.send(JSON.stringify({
      type: "text",
      id: msgId,
      content: chatInput
    }));
    setMessages((prev) => [...prev, msg]);
    setChatInput("");
  };

  const sendWorkspace = () => {
    if (!dcRef.current || dcRef.current.readyState !== "open") return;
    const wsStr = JSON.stringify(parsedData);
    setConnectionState("transferring");
    sendLargeMessage("workspace", wsStr).then(() =>
      setConnectionState("connected"),
    );
    setNotification({
      message: "Workspace synced to remote device",
      type: "info",
    });
  };

  const resetState = () => {
    if (pcRef.current) pcRef.current.close();
    setConnectionState("waiting");
    setOfferQR("");
    setAnswerQR("");
    setIsHosting(false);
    setScanMode(null);
  };

  const isDark = appTheme === "dark";

  return (
    <div
      className={`w-[400px] min-h-[340px] rounded-2xl overflow-hidden border shadow-2xl flex flex-col ${isDark ? "bg-[#111829] border-white/10 text-slate-300" : "bg-white border-slate-200 text-slate-800"}`}
    >
      {/* Immersive Camera Overlay - Rendered in Portal */}
      {createPortal(
        <AnimatePresence>
          {scanMode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[10000] bg-black flex flex-col items-center justify-center overflow-hidden"
            >
              <video
                ref={videoRefCallback}
                className="absolute inset-0 w-full h-full object-cover"
              />

              {/* Camera UI Elements */}
              <div className="relative z-[10001] w-full h-full flex flex-col items-center justify-between p-6 sm:p-10 pointer-events-none">
                {/* Top Controls */}
                <div className="w-full flex justify-between items-center pointer-events-auto">
                  <button
                    onClick={() => setScanMode(null)}
                    className="group p-4 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 text-white hover:bg-black/60 transition-all flex items-center gap-3"
                  >
                    <X className="w-6 h-6" />
                    <span className="text-xs font-bold uppercase tracking-widest sm:block hidden">
                      Exit Scanner
                    </span>
                  </button>
                  <div className="px-5 py-2.5 rounded-full bg-emerald-500/20 backdrop-blur-xl border border-emerald-500/40 text-emerald-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Active Pair
                  </div>
                </div>

                {/* Central Target Window */}
                <div className="relative">
                  <div className="w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] border-2 border-white/10 rounded-[40px] relative">
                    {/* Neon Corners */}
                    <div className="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-emerald-500 rounded-tl-3xl shadow-[0_0_15px_#10b981]" />
                    <div className="absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 border-emerald-500 rounded-tr-3xl shadow-[0_0_15px_#10b981]" />
                    <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 border-emerald-500 rounded-bl-3xl shadow-[0_0_15px_#10b981]" />
                    <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-emerald-500 rounded-br-3xl shadow-[0_0_15px_#10b981]" />

                    {/* Dynamic Scanning Laser */}
                    <motion.div
                      animate={{ top: ["5%", "95%", "5%"] }}
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="absolute inset-x-6 h-0.5 bg-emerald-400/80 shadow-[0_0_20px_#34d399,0_0_40px_#10b981] z-20 rounded-full"
                    />

                    {/* Faint Grid lines for high-tech feel */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.05)_1px,transparent_1px)] bg-[size:20px_20px] rounded-[40px]" />
                  </div>
                </div>

                {/* Bottom Instructions */}
                <div className="text-center bg-black/60 backdrop-blur-2xl p-6 rounded-[32px] border border-white/10 w-full max-w-sm pointer-events-auto shadow-2xl">
                  <h4 className="text-base font-black text-white mb-2 tracking-tight">
                    QR Code Pairing
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed font-medium">
                    Align the pairing code on the remote device within the neon
                    frame to establish a persistent P2P tunnel.
                  </p>
                  <div className="mt-5 pt-5 border-t border-white/5 flex items-center justify-center gap-6">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[8px] uppercase tracking-tighter text-slate-500">
                        Video Link
                      </span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[8px] uppercase tracking-tighter text-slate-500">
                        WebRTC Encrypted
                      </span>
                    </div>
                  </div>
                  {scanError && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-xs font-semibold"
                    >
                      {scanError}
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {/* Header */}
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className={`p-2.5 rounded-xl ${isDark ? "bg-indigo-500/10 text-indigo-400" : "bg-indigo-50 text-indigo-600"}`}
          >
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h3
              className={`font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}
            >
              Direct Transfer
            </h3>
            <p className="text-[11px] text-slate-500 font-medium tracking-wide flex items-center gap-1.5 uppercase">
              <Activity className="w-3 h-3 text-emerald-500" /> P2P Secure
              Connection
            </p>
          </div>
        </div>
        <div
          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            connectionState === "connected"
              ? "bg-emerald-500/10 text-emerald-500"
              : connectionState === "transferring"
                ? "bg-blue-500/10 text-blue-500"
                : connectionState === "failed"
                  ? "bg-red-500/10 text-red-500"
                  : isDark
                    ? "bg-white/5 text-slate-500"
                    : "bg-slate-100 text-slate-500"
          }`}
        >
          {connectionState}
        </div>
      </div>

      <div className="flex-1 px-5 pb-5 flex flex-col">
        {connectionState === "waiting" && !scanMode && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div
              className={`h-[1px] w-full ${isDark ? "bg-white/5" : "bg-slate-100"}`}
            />

            <p className="text-sm leading-relaxed text-slate-400">
              Transfer nodes, documents, or your entire workspace instantly
              between devices using WebRTC. No accounts required.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={generateOffer}
                className={`p-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all group ${
                  isDark
                    ? "border-white/5 hover:border-indigo-500/50 hover:bg-indigo-500/5"
                    : "border-slate-200 hover:border-indigo-500 hover:bg-indigo-50"
                }`}
              >
                <div
                  className={`p-3 rounded-full transition-colors ${isDark ? "bg-white/5 group-hover:bg-indigo-500/20" : "bg-slate-100 group-hover:bg-indigo-100"}`}
                >
                  <Laptop className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold tracking-tight">
                  Host Transfer
                </span>
              </button>

              <button
                onClick={() => setScanMode("offer")}
                className={`p-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all group ${
                  isDark
                    ? "border-white/5 hover:border-emerald-500/50 hover:bg-emerald-500/5"
                    : "border-slate-200 hover:border-emerald-500 hover:bg-emerald-50"
                }`}
              >
                <div
                  className={`p-3 rounded-full transition-colors ${isDark ? "bg-white/5 group-hover:bg-emerald-500/20" : "bg-slate-100 group-hover:bg-emerald-100"}`}
                >
                  <Smartphone className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold tracking-tight">
                  Join / Scan
                </span>
              </button>
            </div>

            <div className="flex flex-col gap-3 mt-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Pairing Mode</span>
                <div className={`p-1 rounded-lg flex gap-1 ${isDark ? "bg-white/5" : "bg-slate-100"}`}>
                  <button
                    onClick={() => setPairingMode("local")}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${
                      pairingMode === "local" 
                        ? isDark ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "bg-white text-indigo-600 shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Local Only
                  </button>
                  <button
                    onClick={() => setPairingMode("universal")}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${
                      pairingMode === "universal" 
                        ? isDark ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "bg-white text-indigo-600 shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Universal
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">QR Density</span>
                <div className={`p-1 rounded-lg flex gap-1 ${isDark ? "bg-white/5" : "bg-slate-100"}`}>
                  {(["L", "M", "Q", "H"] as const).map(d => (
                    <button
                      key={d}
                      onClick={() => setQrDensity(d)}
                      className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                        qrDensity === d 
                          ? isDark ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "bg-white text-indigo-600 shadow-sm"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {connectionState === "pairing" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-6 py-2 w-full"
          >
            <div className={`p-1.5 flex w-full rounded-2xl border ${isDark ? "bg-white/5 border-white/5" : "bg-slate-100 border-slate-200"}`}>
              {btSupported && (
                <button
                  onClick={() => setPairingWorkflow("bluetooth")}
                  className={`flex-1 py-1.5 px-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    pairingWorkflow === "bluetooth"
                      ? isDark ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <Bluetooth className="w-3.5 h-3.5" />
                  Bluetooth
                </button>
              )}
              <button
                onClick={() => setPairingWorkflow("qr")}
                className={`flex-1 py-1.5 px-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  pairingWorkflow === "qr"
                    ? isDark ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                QR Scan
              </button>
              <button
                onClick={() => setPairingWorkflow("manual")}
                className={`flex-1 py-1.5 px-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  pairingWorkflow === "manual"
                    ? isDark ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                Manual
              </button>
            </div>

            {pairingWorkflow === "bluetooth" ? (
              <div className="w-full flex justify-center items-center py-4">
                <div className={`w-full p-6 text-center rounded-[24px] border border-dashed ${isDark ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200"}`}>
                  <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isDark ? "bg-indigo-500/20 text-indigo-400" : "bg-indigo-100 text-indigo-600"}`}>
                    <Bluetooth className="w-8 h-8" />
                  </div>
                  
                  {isEditingDeviceName ? (
                    <div className="flex gap-2 max-w-[200px] mx-auto mb-6">
                      <input 
                        type="text" 
                        autoFocus
                        defaultValue={btDeviceName}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveDeviceName(e.currentTarget.value);
                          if (e.key === 'Escape') setIsEditingDeviceName(false);
                        }}
                        onBlur={(e) => saveDeviceName(e.target.value)}
                        className={`flex-1 w-full text-center text-sm font-bold bg-transparent border-b outline-none ${isDark ? "text-white border-white/20 focus:border-indigo-400" : "text-slate-900 border-slate-300 focus:border-indigo-500"}`}
                      />
                    </div>
                  ) : (
                    <div 
                      className="group flex items-center justify-center gap-2 mb-6 cursor-pointer"
                      onClick={() => setIsEditingDeviceName(true)}
                    >
                      <h3 className={`text-lg font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>{btDeviceName}</h3>
                      <div className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md ${isDark ? "bg-white/10" : "bg-slate-200"}`}>
                        <MonitorSmartphone className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    {btState === "idle" && (
                      <>
                        <button 
                          onClick={() => setBtState("hosting")}
                          className={`w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 border ${
                            isDark ? "bg-white/5 hover:bg-white/10 text-white border-white/5" : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                          }`}
                        >
                          <SmartphoneNfc className="w-4 h-4" /> Start Bluetooth Pairing (Host)
                        </button>
                        
                        <button 
                          onClick={() => setBtState("searching")}
                          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                        >
                          <Search className="w-4 h-4" /> Join Nearby Device
                        </button>
                      </>
                    )}

                    {btState === "hosting" && (
                      <div className={`p-4 rounded-xl border flex flex-col items-center gap-3 ${isDark ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200"}`}>
                        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                        <div className="text-center">
                          <p className={`text-xs font-bold ${isDark ? "text-white" : "text-slate-900"}`}>Discoverable over Bluetooth</p>
                          <p className="text-[10px] text-slate-500 mt-1">Waiting for nearby devices to initiate pairing...</p>
                        </div>
                        <div className="w-full mt-2 flex gap-2">
                          <button 
                            onClick={() => setBtState("idle")}
                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase ${isDark ? "bg-white/10 text-white hover:bg-white/20" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {btState === "searching" && (
                      <div className={`p-4 rounded-xl border flex flex-col items-center gap-3 ${isDark ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200"}`}>
                        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                        <div className="text-center">
                          <p className={`text-xs font-bold ${isDark ? "text-white" : "text-slate-900"}`}>Scanning for devices...</p>
                        </div>
                        
                        {btDiscoveredDevices.length > 0 ? (
                          <div className="w-full mt-2 space-y-2">
                            {btDiscoveredDevices.map(device => (
                              <button
                                key={device.id}
                                onClick={() => {
                                  mqttClient?.publish(mqttTopic, JSON.stringify({ type: "REQUEST_OFFER", targetId: device.id, sourceId: btDeviceId }));
                                  setBtState("exchanging");
                                }}
                                className={`w-full p-3 rounded-lg flex items-center justify-between border transition-all ${isDark ? "bg-black/40 border-white/10 hover:border-indigo-500/50" : "bg-white border-slate-200 hover:border-indigo-400"}`}
                              >
                                <div className="flex items-center gap-2">
                                  <MonitorSmartphone className={`w-4 h-4 ${isDark ? "text-slate-400" : "text-slate-500"}`} />
                                  <span className={`text-xs font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{device.name}</span>
                                </div>
                                <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded ${isDark ? "bg-indigo-500/20 text-indigo-300" : "bg-indigo-50 text-indigo-600"}`}>Connect</span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-500 my-2">Ensure the other device is online and hosting.</p>
                        )}
                        
                        <div className="w-full mt-2 gap-2 flex flex-col">
                          <button 
                            onClick={() => {
                               setPairingWorkflow("qr");
                               setBtState("idle");
                            }}
                            className={`w-full py-2 rounded-lg text-xs font-bold transition-all border ${isDark ? "bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 border-indigo-500/30" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200"}`}
                          >
                            Use QR Pairing Instead
                          </button>
                          <button 
                            onClick={() => setBtState("idle")}
                            className={`w-full py-1.5 rounded-lg text-[10px] font-bold uppercase ${isDark ? "bg-white/10 text-white hover:bg-white/20" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}
                          >
                            Cancel Search
                          </button>
                        </div>
                      </div>
                    )}

                    {btState === "exchanging" && (
                      <div className={`p-4 rounded-xl border flex flex-col items-center gap-3 ${isDark ? "bg-indigo-500/10 border-indigo-500/20" : "bg-indigo-50 border-indigo-200"}`}>
                        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                        <div className="text-center">
                          <p className={`text-xs font-bold ${isDark ? "text-indigo-400" : "text-indigo-700"}`}>Exchanging SDP Payload...</p>
                          <p className="text-[10px] font-medium text-slate-500 mt-1">Please wait while securing connection</p>
                        </div>
                        <button 
                          onClick={() => setBtState("idle")}
                          className={`mt-2 px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase ${isDark ? "bg-white/10 text-white hover:bg-white/20" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="mt-4 text-[10px] text-slate-500">
                    Bluetooth allows direct secure peer discovery without cameras.
                  </p>
                </div>
              </div>
            ) : pairingWorkflow === "qr" ? (
              <>
                {showDiagnostics ? (
                  <div className={`w-full p-4 rounded-3xl shrink-0 ${isDark ? "bg-[#0d1017] border border-white/10" : "bg-slate-50 border border-slate-200"} space-y-2`}>
                    <div className="flex items-center justify-between pb-2 border-b border-gray-500/20">
                      <span className="text-[10px] font-black uppercase text-indigo-400">Diagnostics</span>
                      <button onClick={() => setShowDiagnostics(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] font-mono mt-2">
                      <div className="text-slate-500">Original SDP:</div><div className={isDark ? "text-slate-300" : "text-slate-700"}>{diagnostics.originalSdpSize} B</div>
                      <div className="text-slate-500">Filtered SDP:</div><div className={isDark ? "text-slate-300" : "text-slate-700"}>{diagnostics.filteredSdpSize} B</div>
                      <div className="text-slate-500">ICE Candidates:</div><div className={isDark ? "text-white" : "text-slate-900"}>{diagnostics.candidateCount}</div>
                      <div className="text-slate-500">Compressed:</div><div className={isDark ? "text-emerald-400" : "text-emerald-600"}>{diagnostics.compressedSize} B ({diagnostics.compressionRatio}%)</div>
                      <div className="text-slate-500">Gen Time:</div><div className={isDark ? "text-slate-300" : "text-slate-700"}>{diagnostics.genTime.toFixed(1)} ms</div>
                      {diagnostics.scanTime > 0 && <><div className="text-slate-500">Scan Time:</div><div className={isDark ? "text-slate-300" : "text-slate-700"}>{diagnostics.scanTime.toFixed(1)} ms</div></>}
                      {diagnostics.transferSpeed > 0 && <><div className="text-slate-500">TX Speed:</div><div className="text-blue-400">{formatFileSize(diagnostics.transferSpeed)}/s</div></>}
                      <div className="text-slate-500">Buffer:</div><div className={diagnostics.bufferedAmount > 1024 * 512 ? "text-amber-400" : "text-slate-400"}>{formatFileSize(diagnostics.bufferedAmount)}</div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-white rounded-3xl shadow-xl shrink-0 relative group">
                    <button 
                      onClick={() => setShowDiagnostics(true)}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/10"
                    >
                      <Activity className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                    <QRCodeSVG
                      value={offerQR || answerQR}
                      size={200}
                      level={qrDensity}
                      marginSize={1}
                    />
                  </div>
                )}

                <div className="text-center space-y-1">
                  <p className="text-sm font-bold text-white">
                    Device Pairing Required
                  </p>
                  <p className="text-xs text-slate-500">
                    Scan this code on the other device to link
                  </p>
                  {notificationPermission === "default" && (
                    <button 
                      onClick={requestNotificationPermission}
                      className="mt-2 text-[9px] font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Enable Browser Notifications
                    </button>
                  )}
                </div>
                <div className="flex gap-2 w-full max-w-[200px]">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(offerQR || answerQR);
                      setNotification({ message: "SDP Copied to Clipboard", type: "success" });
                    }}
                    disabled={!(offerQR || answerQR)}
                    className={`flex-1 py-1.5 px-3 rounded-lg border flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase transition-all whitespace-nowrap ${
                      isDark
                        ? "border-white/5 bg-white/5 hover:bg-white/10 text-white"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Copy className="w-3 h-3" /> Copy SDP
                  </button>
                </div>
              </>
            ) : (
              <div className="w-full space-y-3">
                {/* Manual Section - Your SDP */}
                <div className={`group relative p-4 rounded-[24px] border transition-all duration-300 ${
                  isDark ? "bg-white/5 border-white/10 hover:border-indigo-500/30" : "bg-white border-slate-200 hover:border-indigo-200 shadow-sm"
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-1 rounded-lg ${isDark ? "bg-indigo-500/10" : "bg-indigo-50"}`}>
                        <Share2 className={`w-3.5 h-3.5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
                      </div>
                      <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        1. Your {isHosting ? "Offer" : "Answer"} SDP
                      </p>
                    </div>
                    {offerQR || answerQR ? (
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter ${
                        isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-600"
                      }`}>
                        Generated
                      </span>
                    ) : null}
                  </div>

                  <div className="flex gap-3 items-stretch">
                    <div className="flex-1 min-w-0">
                      {offerQR || answerQR ? (
                        <div className={`h-full min-h-[52px] p-2.5 rounded-xl flex flex-col justify-between transition-colors overflow-hidden ${
                          isDark ? "bg-black/40 border border-white/5" : "bg-slate-50 border border-slate-100"
                        }`}>
                          <div className={`text-[11px] font-mono truncate leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                            {offerQR || answerQR}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-white/5 shrink-0">
                            <Activity className="w-2.5 h-2.5 text-slate-500" />
                            <span className="text-[9px] font-medium text-slate-500">Payload: {(offerQR || answerQR).length} bytes</span>
                          </div>
                        </div>
                      ) : (
                        <div className={`h-full min-h-[52px] border-2 border-dashed rounded-xl flex items-center justify-center p-3 text-center ${
                          isDark ? "border-white/5 bg-black/20" : "border-slate-100 bg-slate-50/50"
                        }`}>
                          <p className={`text-[9px] font-medium italic ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                            Waiting for remote {isHosting ? "connection" : "offer"}...
                          </p>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(offerQR || answerQR);
                        setNotification({ message: "SDP Copied to Clipboard", type: "success" });
                      }}
                      disabled={!(offerQR || answerQR)}
                      className="px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-white transition-all flex flex-col items-center justify-center gap-1.5 shadow-lg shadow-indigo-500/20"
                    >
                      <Copy className="w-4 h-4" />
                      <span className="text-[9px] font-black uppercase tracking-widest">Copy</span>
                    </button>
                  </div>
                </div>

                {/* Manual Section - Remote SDP */}
                <div className={`p-4 rounded-[24px] border relative transition-all duration-300 ${
                  isDark ? "bg-white/5 border-white/10" : "bg-white border-slate-200 shadow-sm"
                }`}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`p-1 rounded-lg ${isDark ? "bg-emerald-500/10" : "bg-emerald-50"}`}>
                      <LogIn className={`w-3.5 h-3.5 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
                    </div>
                    <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      2. Remote {isHosting ? "Answer" : "Offer"} SDP
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="relative">
                      <textarea
                        placeholder={`Paste remote ${isHosting ? "answer" : "offer"} here...`}
                        className={`w-full h-24 p-3 pr-10 text-[11px] font-mono rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none leading-relaxed ${
                          isDark ? "bg-black/40 text-white placeholder-slate-600 border border-white/5" : "bg-slate-50 text-slate-900 placeholder-slate-400 border border-slate-100"
                        }`}
                        value={isHosting ? copyPasteAnswer : copyPasteOffer}
                        onChange={(e) => isHosting ? setCopyPasteAnswer(e.target.value) : setCopyPasteOffer(e.target.value)}
                      />
                      {(isHosting ? copyPasteAnswer : copyPasteOffer) && (
                        <button
                          onClick={() => isHosting ? setCopyPasteAnswer("") : setCopyPasteOffer("")}
                          className={`absolute top-2 right-2 p-1.5 rounded-lg transition-colors ${
                            isDark ? "text-slate-400 hover:text-white hover:bg-white/10" : "text-slate-400 hover:text-slate-900 hover:bg-slate-200"
                          }`}
                          title="Clear input"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          try {
                            const text = await navigator.clipboard.readText();
                            if (text && text.trim().length > 50) {
                              isHosting ? setCopyPasteAnswer(text.trim()) : setCopyPasteOffer(text.trim());
                              setNotification({ message: "SDP Pasted from Clipboard", type: "success" });
                              setClipboardDetectedSdp(null);
                            } else {
                              setNotification({ message: "No valid SDP payload in clipboard", type: "error" });
                            }
                          } catch (err) {
                            setNotification({ message: "Clipboard locked. Please use Ctrl+V / Cmd+V to paste.", type: "error" });
                          }
                        }}
                        className={`flex-1 py-2.5 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                          isDark ? "border-white/5 hover:border-indigo-500/30 bg-white/5 text-slate-500 hover:text-indigo-400" : "border-slate-200 hover:border-indigo-200 bg-white text-slate-400 hover:text-indigo-600"
                        }`}
                      >
                        <ClipboardPaste className="w-3.5 h-3.5" />
                        <span className="text-[9px] font-bold uppercase tracking-wider">Paste</span>
                      </button>

                      <button
                        onClick={() => handleScan(isHosting ? copyPasteAnswer : copyPasteOffer)}
                        disabled={isHosting ? !copyPasteAnswer.trim() : !copyPasteOffer.trim()}
                        className="flex-[2] py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-30 disabled:grayscale text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {isHosting ? "Establish" : "Verify & Generate"}
                      </button>
                    </div>

                    <AnimatePresence>
                      {clipboardDetectedSdp && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0, marginTop: 0 }} 
                          animate={{ opacity: 1, height: "auto", marginTop: 8 }} 
                          exit={{ opacity: 0, height: 0, marginTop: 0 }}
                          className={`overflow-hidden rounded-xl border ${isDark ? "bg-indigo-500/10 border-indigo-500/20" : "bg-indigo-50 border-indigo-100"}`}
                        >
                          <div className="p-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Activity className={`w-3 h-3 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
                              <span className={`text-[9px] font-black uppercase tracking-wider ${isDark ? "text-indigo-300" : "text-indigo-700"}`}>Detected</span>
                            </div>
                            <button
                              onClick={() => {
                                isHosting ? setCopyPasteAnswer(clipboardDetectedSdp) : setCopyPasteOffer(clipboardDetectedSdp);
                                setClipboardDetectedSdp(null);
                              }}
                              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[9px] font-black uppercase tracking-[0.1em] transition-all"
                            >
                              Import
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            )}

            <div className="w-full flex gap-2">
              <button
                onClick={resetState}
                className={`flex-1 py-3 px-4 rounded-xl border flex items-center justify-center gap-2 text-[10px] font-bold uppercase transition-all ${
                  isDark
                    ? "border-red-500/20 text-red-400 hover:bg-red-500/10"
                    : "border-red-200 text-red-600 hover:bg-red-50"
                }`}
              >
                Cancel Pairing
              </button>
            </div>
          </motion.div>
        )}

        {connectionState === "failed" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-[320px] gap-6 text-center"
          >
            <div
              className={`p-6 rounded-full ${isDark ? "bg-red-500/10 text-red-500" : "bg-red-50 text-red-600"}`}
            >
              <X className="w-12 h-12" />
            </div>
            <div>
              <p
                className={`text-lg font-bold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}
              >
                Connection Failed
              </p>
              <p className="text-sm text-slate-500 max-w-[250px] mx-auto">
                Unable to establish a secure P2P connection. This might be due
                to network firewalls or scanning timeout.
              </p>
            </div>
            <button
              onClick={resetState}
              className={`flex items-center gap-2 px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${
                isDark
                  ? "border-white/10 bg-white/5 hover:bg-white/10 text-white"
                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
              }`}
            >
              <RefreshCw className="w-4 h-4" /> Reset & Try Again
            </button>
          </motion.div>
        )}

        {(connectionState === "connected" ||
          connectionState === "transferring") &&
          (() => {
            const chatMessages = messages;
            const mediaMessages = messages.filter((m) => m.type === "file");

            const content = (
              <div
                className={`flex flex-col relative ${isFullscreen ? "w-full max-w-4xl mx-auto h-full" : "h-[420px]"}`}
              >
                {/* Modern Compact Header */}
                <div
                  className={`flex items-center justify-between p-4 border-b shrink-0 ${isDark ? "bg-[#0d1017]/80 backdrop-blur-md border-white/5" : "bg-white/80 backdrop-blur-md border-slate-100"}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-xl ${isDark ? "bg-indigo-500/10 text-indigo-400" : "bg-indigo-50 text-indigo-600"}`}
                    >
                      <Share2 className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                      <h3
                        className={`text-sm font-bold tracking-tight leading-none mb-1 ${isDark ? "text-white" : "text-slate-900"}`}
                      >
                        Direct Transfer
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          P2P Encrypted
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div
                      className={`flex p-1 rounded-lg ${isDark ? "bg-white/5" : "bg-slate-100"}`}
                    >
                      <button
                        onClick={() => setViewMode("chat")}
                        className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all flex items-center gap-2 ${
                          viewMode === "chat"
                            ? isDark
                              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                              : "bg-white text-indigo-600 shadow-sm"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Chat
                        {unreadCount > 0 && viewMode !== "chat" && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        )}
                      </button>
                      <button
                        onClick={() => setViewMode("media")}
                        className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${
                          viewMode === "media"
                            ? isDark
                              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                              : "bg-white text-indigo-600 shadow-sm"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Media ({mediaMessages.length})
                      </button>
                    </div>

                    <button
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      className={`p-2.5 rounded-xl border transition-all ${isDark ? "border-white/5 bg-white/5 hover:bg-white/10 text-slate-400" : "border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-500"}`}
                    >
                      {isFullscreen ? (
                        <Minimize className="w-4 h-4" />
                      ) : (
                        <Maximize className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex-1 relative overflow-hidden bg-transparent flex flex-col">
                  {showScrollDown && (
                    <button 
                      onClick={() => {
                        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
                        setShowScrollDown(false);
                      }}
                      className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-indigo-600 text-white text-[10px] font-bold uppercase rounded-full shadow-lg flex items-center gap-2 hover:bg-indigo-700 transition-all border border-indigo-400/30"
                    >
                      <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                      {unreadCount > 0 ? `${unreadCount} New Messages` : "Go to bottom"}
                    </button>
                  )}
                  <AnimatePresence mode="wait">
                    {viewMode === "chat" ? (
                      <motion.div
                        key="chat-view"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="flex flex-col h-full"
                      >
                        <div
                          ref={scrollRef}
                          className={`flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin ${isDark ? "scrollbar-dark" : "scrollbar-light"}`}
                          style={{
                            backgroundImage: isDark
                              ? "radial-gradient(circle at 50% 50%, rgba(79, 70, 229, 0.05) 0%, transparent 100%)"
                              : "none",
                          }}
                        >
                          {chatMessages.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-center px-12 gap-6">
                              <div
                                className={`w-20 h-20 rounded-3xl flex items-center justify-center ${isDark ? "bg-white/5 text-slate-600" : "bg-slate-50 text-slate-300"}`}
                              >
                                <MessageSquare className="w-10 h-10" />
                              </div>
                              <div className="space-y-2">
                                <p
                                  className={`text-sm font-bold ${isDark ? "text-slate-400" : "text-slate-500"}`}
                                >
                                  End-to-End Secure
                                </p>
                                <p className="text-xs text-slate-500 leading-relaxed max-w-[200px]">
                                  Messages are sent directly between devices.
                                  Nothing is stored on any server.
                                </p>
                              </div>
                            </div>
                          )}

                          {chatMessages.map((msg) => (
                            <motion.div
                              key={msg.id}
                              layout
                              initial={{ opacity: 0, scale: 0.95, y: 10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              className={`flex flex-col ${msg.sender === "me" ? "items-end" : "items-start"}`}
                            >
                              <div
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  setShowContextMenu({
                                    id: msg.id,
                                    x: e.clientX,
                                    y: e.clientY,
                                  });
                                }}
                                className={`group relative max-w-[85%] rounded-3xl p-1 transition-all duration-300 ${
                                  msg.sender === "me"
                                    ? "bg-indigo-600 text-white rounded-tr-sm shadow-xl shadow-indigo-500/20"
                                    : isDark
                                      ? "bg-[#161f30] text-slate-200 rounded-tl-sm border border-white/5"
                                      : "bg-slate-100 text-slate-800 rounded-tl-sm"
                                }`}
                              >
                                {msg.type === "text" ? (
                                  <div className="px-4 py-2.5 text-xs font-medium">
                                    {msg.content}
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-1">
                                    {msg.fileType === "image" && (
                                      <button
                                        onClick={() => setSelectedMedia(msg)}
                                        className="relative rounded-2xl overflow-hidden group/img transition-transform active:scale-[0.98]"
                                      >
                                        <img
                                          src={msg.content}
                                          alt={msg.fileName}
                                          className="w-full max-h-[300px] object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                          <Eye className="w-8 h-8 text-white" />
                                        </div>
                                      </button>
                                    )}

                                    {msg.fileType === "video" && (
                                      <div className="relative rounded-2xl overflow-hidden bg-black aspect-video group/vid">
                                        <video
                                          src={msg.content}
                                          className="w-full h-full object-cover opacity-80"
                                        />
                                        <button
                                          onClick={() => setSelectedMedia(msg)}
                                          className="absolute inset-0 flex items-center justify-center text-white transition-transform group-hover/vid:scale-110"
                                        >
                                          <div className="p-4 rounded-full bg-white/20 backdrop-blur-md">
                                            <Play className="w-8 h-8 fill-current" />
                                          </div>
                                        </button>
                                        <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-black/60 backdrop-blur-md text-[10px] font-bold text-white">
                                          VIDEO
                                        </div>
                                      </div>
                                    )}

                                    {msg.fileType === "audio" && (
                                      <div
                                        className={`p-3 rounded-2xl min-w-[240px] flex items-center gap-4 ${msg.sender === "me" ? "bg-white/10" : isDark ? "bg-white/5" : "bg-white"}`}
                                      >
                                        <button 
                                          onClick={() => setSelectedMedia(msg)}
                                          className="p-2.5 rounded-full bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 hover:scale-110 active:scale-95 transition-all"
                                        >
                                          <Play className="w-4 h-4 fill-current" />
                                        </button>
                                        <div className="flex-1 flex flex-col gap-1.5">
                                          <div className="flex items-center space-x-1">
                                            {[...Array(20)].map((_, i) => (
                                              <div
                                                key={i}
                                                className="w-0.5 bg-current opacity-30"
                                                style={{
                                                  height: `${10 + Math.random() * 80}%`,
                                                  minHeight: "4px",
                                                }}
                                              />
                                            ))}
                                          </div>
                                          <div className="flex justify-between items-center text-[9px] font-bold opacity-80 tracking-widest leading-none">
                                            <span>AUDIO PREVIEW</span>
                                            <span>
                                              {formatFileSize(
                                                msg.fileSize || 0,
                                              )}
                                            </span>
                                          </div>
                                        </div>
                                        <a
                                          href={msg.content}
                                          download={msg.fileName || "audio.mp3"}
                                          className={`p-2 rounded-lg transition-all ${
                                            msg.sender === "me"
                                              ? "hover:bg-white/20"
                                              : isDark
                                                ? "hover:bg-white/5"
                                                : "hover:bg-slate-200"
                                          }`}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Download className="w-3.5 h-3.5" />
                                        </a>
                                      </div>
                                    )}

                                    {(msg.fileType === "file" ||
                                      msg.fileType === "pdf") && (
                                      <div
                                        className={`flex items-center gap-3 p-3 rounded-2xl transition-all cursor-pointer ${
                                          msg.sender === "me"
                                            ? "hover:bg-white/5"
                                            : "hover:bg-black/5"
                                        }`}
                                        onClick={() => msg.fileType === "pdf" && setSelectedMedia(msg)}
                                      >
                                        <div
                                          className={`p-3 rounded-xl ${
                                            msg.sender === "me"
                                              ? "bg-white/20 text-white"
                                              : isDark
                                                ? "bg-indigo-500/10 text-indigo-400"
                                                : "bg-indigo-50 text-indigo-600"
                                          }`}
                                        >
                                          {msg.fileType === "pdf" ? (
                                            <FileText className="w-6 h-6" />
                                          ) : (
                                            <File className="w-6 h-6" />
                                          )}
                                        </div>
                                        <div className="flex flex-col min-w-0 flex-1">
                                          <span className="text-xs font-black truncate leading-tight mb-1">
                                            {msg.fileName}
                                          </span>
                                          <div className="flex items-center gap-2 text-[9px] font-bold opacity-70 uppercase tracking-widest">
                                            <span>
                                              {formatFileSize(
                                                msg.fileSize || 0,
                                              )}
                                            </span>
                                            <span className="w-1 h-1 rounded-full bg-current opacity-40" />
                                            <span>{msg.fileType}</span>
                                          </div>
                                        </div>
                                        <a
                                          href={msg.content}
                                          download={msg.fileName}
                                          className={`p-2.5 rounded-xl transition-all ${
                                            msg.sender === "me"
                                              ? "hover:bg-white/20"
                                              : isDark
                                                ? "hover:bg-white/5"
                                                : "hover:bg-slate-200"
                                          }`}
                                        >
                                          <Download className="w-4 h-4" />
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2 mt-1.5 px-2">
                                <span className="text-[10px] text-slate-500 font-bold tracking-tight">
                                  {new Date(msg.timestamp).toLocaleTimeString(
                                    [],
                                    {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )}
                                </span>
                                {msg.sender === "me" && (
                                  <div className="flex items-center">
                                    {msg.status === "sending" && (
                                      <Clock className="w-3 h-3 text-slate-400" />
                                    )}
                                    {msg.status === "sent" && (
                                      <Check className="w-3 h-3 text-slate-400" />
                                    )}
                                    {msg.status === "delivered" && (
                                      <div className="flex -space-x-1.5">
                                        <Check className="w-3 h-3 text-emerald-500" />
                                        <Check className="w-3 h-3 text-emerald-500" />
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          ))}
                        </div>

                        <div
                          className={`p-4 border-t ${isDark ? "bg-[#0d1017]/50 border-white/5" : "bg-white border-slate-100"}`}
                        >
                          {transferProgress > 0 && (
                            <div className="mb-4 bg-indigo-500/5 p-3 rounded-2xl border border-indigo-500/10">
                              <div className="flex justify-between items-center mb-2 px-1">
                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  {connectionState === "transferring"
                                    ? "Receiving Stream..."
                                    : "Transmitting..."}
                                </span>
                                <span className="text-[10px] font-black text-indigo-400">
                                  {transferProgress}%
                                </span>
                              </div>
                              <div
                                className={`h-1.5 w-full rounded-full overflow-hidden ${isDark ? "bg-white/5" : "bg-slate-100"}`}
                              >
                                <motion.div
                                  className="h-full bg-indigo-500 shadow-[0_0_10px_#6366f1]"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${transferProgress}%` }}
                                />
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-3">
                            <label
                              className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                                isDark
                                  ? "border-white/5 bg-white/5 hover:bg-white/10 hover:border-indigo-500/30 text-indigo-400"
                                  : "border-slate-100 bg-slate-50 hover:bg-slate-100 hover:border-indigo-200 text-indigo-600"
                              }`}
                            >
                              <Plus className="w-5 h-5" />
                              <input
                                type="file"
                                className="hidden"
                                multiple
                                onChange={(e) => {
                                  const files = Array.from(
                                    e.target.files || [],
                                  );
                                  if (files.length === 0 || !dcRef.current)
                                    return;

                                  files.forEach((file) => {
                                    const reader = new FileReader();
                                    reader.onload = (re) => {
                                      const content =
                                        re.target?.result as string;
                                      const fType = getFileType(file.name);
                                      sendLargeMessage(
                                        "file",
                                        content,
                                        file.name,
                                      );
                                      setMessages((prev) => [
                                        ...prev,
                                        {
                                          id: uuidv4(),
                                          sender: "me",
                                          type: "file",
                                          fileName: file.name,
                                          fileType: fType,
                                          fileSize: file.size,
                                          content: content,
                                          timestamp: Date.now(),
                                          status: "sent",
                                        },
                                      ]);
                                    };
                                    reader.readAsDataURL(file);
                                  });
                                }}
                              />
                            </label>

                            <div
                              className={`flex-1 flex items-center rounded-2xl p-1.5 border transition-all shadow-inner ${
                                isDark
                                  ? "bg-[#161f30] border-white/5 focus-within:border-indigo-500/50"
                                  : "bg-slate-50 border-slate-100 focus-within:border-indigo-500"
                              }`}
                            >
                              <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) =>
                                  e.key === "Enter" && sendMessage()
                                }
                                placeholder="Type a message..."
                                className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none placeholder:text-slate-500 font-medium"
                              />
                              <button
                                onClick={sendMessage}
                                disabled={!chatInput.trim()}
                                className="p-2.5 bg-indigo-600 disabled:opacity-50 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/30 flex items-center justify-center"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            </div>

                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    "Are you sure you want to disconnect?",
                                  )
                                ) {
                                  resetState();
                                }
                              }}
                              className={`p-3.5 rounded-2xl border transition-all ${isDark ? "border-red-500/10 bg-red-500/5 hover:bg-red-500/10 text-red-400" : "border-red-50/10 bg-red-50 hover:bg-red-100 text-red-500"}`}
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="media-view"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.02 }}
                        className="h-full overflow-y-auto p-4 flex flex-col"
                      >
                        <div className="flex items-center justify-between mb-4 px-2">
                          <h4
                            className={`text-sm font-black uppercase tracking-widest ${isDark ? "text-white" : "text-slate-900"}`}
                          >
                            Shared Media
                          </h4>
                        </div>

                        {mediaMessages.length === 0 ? (
                          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
                            <ImageIcon className="w-12 h-12 mb-4" />
                            <p className="text-sm font-bold uppercase tracking-tighter">
                              No Media Shared Yet
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {mediaMessages.map((m) => (
                              <button
                                key={m.id}
                                onClick={() => setSelectedMedia(m)}
                                className={`aspect-square rounded-xl overflow-hidden relative group border ${isDark ? "border-white/5 opacity-80 hover:opacity-100" : "border-slate-100"}`}
                              >
                                {m.fileType === "image" ? (
                                  <img
                                    src={m.content}
                                    className="w-full h-full object-cover"
                                  />
                                ) : m.fileType === "video" ? (
                                  <div className="w-full h-full bg-slate-900 flex items-center justify-center text-white">
                                    <Play className="w-6 h-6" />
                                  </div>
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <File className="w-6 h-6 text-indigo-500" />
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                                  <span className="text-[8px] font-black text-white uppercase tracking-tighter truncate max-w-full px-1">
                                    {m.fileName}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {showContextMenu && (
                      <div
                        className="fixed inset-0 z-[11000]"
                        onClick={() => setShowContextMenu(null)}
                      >
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          style={{
                            left: Math.min(
                              showContextMenu.x,
                              window.innerWidth - 200,
                            ),
                            top: Math.min(
                              showContextMenu.y,
                              window.innerHeight - 300,
                            ),
                          }}
                          className={`absolute w-52 rounded-2xl border shadow-2xl overflow-hidden p-2 backdrop-blur-xl ${isDark ? "bg-[#111827]/90 border-white/10" : "bg-white/95 border-slate-200"}`}
                        >
                          {(() => {
                            const msg = messages.find(
                              (m) => m.id === showContextMenu.id,
                            );
                            if (!msg) return null;
                            return (
                              <div className="flex flex-col gap-1">
                                <button
                                  onClick={() => {
                                    if (msg.type === "text") {
                                      navigator.clipboard.writeText(
                                        msg.content,
                                      );
                                      setNotification({
                                        message: "Copied to clipboard",
                                        type: "info",
                                      });
                                    } else {
                                      setSelectedMedia(msg);
                                    }
                                  }}
                                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${isDark ? "hover:bg-white/5 text-slate-300" : "hover:bg-slate-50 text-slate-700"}`}
                                >
                                  {msg.type === "text" ? (
                                    <Copy className="w-4 h-4" />
                                  ) : (
                                    <Eye className="w-4 h-4" />
                                  )}
                                  {msg.type === "text" ? "Copy Text" : "View"}
                                </button>
                                {msg.type === "file" && (
                                  <a
                                    href={msg.content}
                                    download={msg.fileName}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${isDark ? "hover:bg-white/5 text-slate-300" : "hover:bg-slate-50 text-slate-700"}`}
                                  >
                                    <Download className="w-4 h-4" />
                                    Download
                                  </a>
                                )}
                                <button
                                  onClick={() => {
                                    setMessages((prev) =>
                                      prev.filter((m) => m.id !== msg.id),
                                    );
                                  }}
                                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${isDark ? "hover:bg-red-500/10 text-red-400" : "hover:bg-red-50 text-red-600"}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete Local
                                </button>
                              </div>
                            );
                          })()}
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>
                </div>

                <AnimatePresence>
                  {selectedMedia && (
                    <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-4 sm:p-20">
                      <motion.button
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => setSelectedMedia(null)}
                        className="absolute top-6 right-6 p-4 rounded-full bg-white/10 hover:bg-white/20 text-white z-10 transition-all border border-white/10"
                      >
                        <X className="w-6 h-6" />
                      </motion.button>

                      <div className="absolute top-6 left-6 text-white max-w-[300px]">
                        <p className="text-sm font-black mb-1 truncate leading-none">
                          {selectedMedia.fileName}
                        </p>
                        <div className="flex items-center gap-3 opacity-60 text-[10px] font-bold uppercase tracking-widest">
                          <span>
                            {formatFileSize(selectedMedia.fileSize || 0)}
                          </span>
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                          <span>
                            {new Date(
                              selectedMedia.timestamp,
                            ).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="absolute bottom-6 inset-x-0 flex justify-center gap-4">
                        <a
                          href={selectedMedia.content}
                          download={selectedMedia.fileName}
                          className="px-8 py-4 rounded-full bg-indigo-600 text-white text-xs font-black uppercase tracking-widest shadow-2xl shadow-indigo-500/40 flex items-center gap-3 hover:bg-indigo-500 transition-all active:scale-95"
                        >
                          <Download className="w-5 h-5" /> Download Asset
                        </a>
                      </div>

                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.1 }}
                        className="w-full h-full flex items-center justify-center"
                      >
                        {selectedMedia.fileType === "image" && (
                          <img
                            src={selectedMedia.content}
                            className="max-w-full max-h-full object-contain shadow-[0_0_100px_rgba(0,0,0,0.5)] cursor-zoom-in"
                            onClick={(e) => {
                              const img = e.currentTarget;
                              if (img.style.maxHeight === "none") {
                                img.style.maxHeight = "100%";
                                img.style.maxWidth = "100%";
                              } else {
                                img.style.maxHeight = "none";
                                img.style.maxWidth = "none";
                              }
                            }}
                          />
                        )}
                        {selectedMedia.fileType === "video" && (
                          <video
                            src={selectedMedia.content}
                            controls
                            autoPlay
                            className="max-w-full max-h-full shadow-2xl"
                          />
                        )}
                        {selectedMedia.fileType === "audio" && (
                          <div className="flex flex-col items-center gap-8 p-10 bg-white/5 rounded-[40px] border border-white/10 backdrop-blur-3xl">
                            <div className="w-40 h-40 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-[0_0_50px_rgba(99,102,241,0.2)]">
                              <motion.div
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                              >
                                <Volume2 className="w-16 h-16 text-indigo-400" />
                              </motion.div>
                            </div>
                            <audio
                              src={selectedMedia.content}
                              controls
                              autoPlay
                              className="w-80 h-12 accent-indigo-500 rounded-full"
                            />
                          </div>
                        )}
                        {selectedMedia.fileType === "pdf" && (
                          <div className="w-full h-full max-w-5xl bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col">
                            <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-indigo-600" />
                                <span className="text-sm font-bold text-slate-800 truncate">{selectedMedia.fileName}</span>
                              </div>
                              <a 
                                href={selectedMedia.content} 
                                download={selectedMedia.fileName}
                                className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-bold uppercase rounded-lg hover:bg-indigo-700 transition-all flex items-center gap-2"
                              >
                                <Download className="w-3.5 h-3.5" /> Download PDF
                              </a>
                            </div>
                            <iframe
                              src={`${selectedMedia.content}#toolbar=0`}
                              className="w-full flex-1 border-none"
                              title="PDF Preview"
                            />
                          </div>
                        )}
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            );

            return isFullscreen
              ? createPortal(
                  <div
                    className={`fixed inset-0 z-[10000] backdrop-blur-sm p-0 sm:p-2 flex items-center justify-center ${isDark ? "bg-black/90" : "bg-slate-900/50"}`}
                  >
                    <div
                      className={`w-full h-full sm:rounded-3xl border shadow-2xl overflow-hidden flex flex-col ${isDark ? "bg-[#0a0c10] border-white/5" : "bg-white border-slate-200"}`}
                    >
                      {content}
                    </div>
                  </div>,
                  document.body,
                )
              : content;
          })()}
      </div>
    </div>
  );
};
