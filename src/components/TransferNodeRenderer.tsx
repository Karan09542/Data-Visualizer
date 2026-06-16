import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { HierarchyPointNode } from "d3";
import { TreeNode } from "../utils/transformer";
import { useStore } from "../store/useStore";
import { PdfViewer } from "./PdfViewer";
import { QRCodeSVG } from "qrcode.react";
import jsQR from "jsqr";
import LZString from "lz-string";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
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
  ChevronLeft,
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
  Scan,
  CornerDownRight,
  LogOut,
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
  replyTo?: {
    id: string;
    sender: string;
    content: string;
    type: string;
    fileName?: string;
  };
  originalBlob?: Blob;
}

export const blobRegistry = new Map<string, Blob>();

const getFileType = (fileName: string) => {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext || ""))
    return "image";
  if (["mp4", "webm", "ogg", "mov"].includes(ext || "")) return "video";
  if (["mp3", "wav", "m4a", "flac"].includes(ext || "")) return "audio";
  if (["pdf"].includes(ext || "")) return "pdf";
  if (["txt", "md", "json", "yaml", "yml", "csv", "log"].includes(ext || ""))
    return "text_file";
  return "file";
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const dataURItoBlobURL = (dataURI: string) => {
  try {
    const splitIndex = dataURI.indexOf(",");
    if (splitIndex === -1) return dataURI; // might be already an object url or plain text string
    const byteString = atob(dataURI.slice(splitIndex + 1));
    const mimeString = dataURI.slice(0, splitIndex).split(":")[1].split(";")[0];
    const ab = new ArrayBuffer(byteString.length);
    const Math_min = Math.min;
    // Process in chunks to avoid max call stack size, or just simple loop
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeString });
    const url = URL.createObjectURL(blob);
    blobRegistry.set(url, blob);
    return url;
  } catch (err) {
    return dataURI; // fallback
  }
};

const TextFileViewer: React.FC<{ url: string }> = ({ url }) => {
  const [content, setContent] = useState<string>("Loading...");
  useEffect(() => {
    fetch(url)
      .then((res) => res.text())
      .then((text) => setContent(text))
      .catch((err) => setContent("Error loading file: " + err.message));
  }, [url]);
  return <>{content}</>;
};

const AudioPlayer = ({ media, isSelected }: { media: Message, isSelected: boolean }) => {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (isSelected) ref.current?.play().catch(() => {});
    else ref.current?.pause();
  }, [isSelected]);
  
  return (
    <div className="flex flex-col items-center gap-8 p-10 bg-white/5 rounded-[40px] border border-white/10 backdrop-blur-3xl">
      <div className="w-40 h-40 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-[0_0_50px_rgba(99,102,241,0.2)]">
        <motion.div
          animate={{ scale: isSelected ? [1, 1.1, 1] : 1 }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Volume2 className="w-16 h-16 text-indigo-400" />
        </motion.div>
      </div>
      <audio
        ref={ref}
        src={media.content}
        controls
        className="w-80 h-12 accent-indigo-500 rounded-full"
      />
    </div>
  );
};

const VideoPlayer = ({ media, isSelected }: { media: Message, isSelected: boolean }) => {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (isSelected) ref.current?.play().catch(() => {});
    else ref.current?.pause();
  }, [isSelected]);

  return (
    <div className="w-full h-full relative flex items-center justify-center">
      <video
        ref={ref}
        src={media.content}
        controls
        playsInline
        className="w-full h-full object-contain"
      />
    </div>
  );
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
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const [offerQR, setOfferQR] = useState("");
  const [answerQR, setAnswerQR] = useState("");

  const [broadcastFrames, setBroadcastFrames] = useState<string[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [qrSpeed, setQrSpeed] = useState<"fast" | "balanced" | "reliable">("reliable");

  const [receivedChunks, setReceivedChunks] = useState<{
    sessionId: string;
    total: number;
    chunks: Record<number, string>;
  } | null>(null);

  const [completeScannedPayload, setCompleteScannedPayload] = useState<string | null>(null);

  const [scannerGuidance, setScannerGuidance] = useState<string>("Position QR in frame");

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
        replyTo?: Message["replyTo"];
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
  const chatScrollPosRef = useRef<number>(0);
  const lastMessageRef = useRef<HTMLDivElement>(null);

  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>("default");

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
    if (
      document.visibilityState === "hidden" &&
      notificationPermission === "granted"
    ) {
      try {
        new Notification(title, { body, icon: "/icon.png" });
      } catch (e) {
        console.warn("Notification failed", e);
      }
    }
  };

  const [selectedMedia, setSelectedMedia] = useState<Message | null>(null);
  const [viewedMediaIds, setViewedMediaIds] = useState<Set<string>>(new Set());
  const [showChrome, setShowChrome] = useState(true);
  const [copyStatus, setCopyStatus] = useState<{ id: string, status: "copying" | "success" } | null>(null);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (selectedMedia && showChrome) {
      timeout = setTimeout(() => setShowChrome(false), 3000);
    }
    return () => clearTimeout(timeout);
  }, [selectedMedia, showChrome]);

  const handleMediaCopy = async (media: Message) => {
    setCopyStatus({ id: media.id, status: "copying" });
    const successDelay = () => {
      setCopyStatus({ id: media.id, status: "success" });
      setTimeout(() => setCopyStatus(null), 2000);
    };
    try {
      console.log("[Transfer Node Copy] Copy Requested:", { id: media.id, fileName: media.fileName, fileType: media.fileType });
      
      let blob = media.originalBlob || blobRegistry.get(media.content);
      
      if (!blob && media.type === "file" && media.content.startsWith("blob:")) {
        console.log("[Transfer Node Copy] Fallback Triggered: Fetching object URL");
        try {
          const res = await fetch(media.content);
          blob = await res.blob();
          if (blob) {
            blobRegistry.set(media.content, blob);
          }
        } catch (fetchErr) {
          console.error("[Transfer Node Copy] Fallback Fetch Failed:", fetchErr);
        }
      }

      if (!blob) {
        console.error("[Transfer Node Copy] Clipboard Write Failed: No source blob available");
        setCopyStatus(null);
        setNotification({ message: "No source file data available to copy.", type: "error" });
        return;
      }

      console.log("[Transfer Node Copy] Blob Type:", blob.type);
      console.log("[Transfer Node Copy] Blob Size:", blob.size);

      if (media.fileType === "text_file") {
        const text = await blob.text();
        await navigator.clipboard.writeText(text);
        console.log("[Transfer Node Copy] Clipboard Write Success: Text copied");
        setNotification({ message: "Text copied to clipboard", type: "success" });
        successDelay();
        return;
      }

      const writeToClipboard = async (dataBlob: Blob) => {
        await navigator.clipboard.write([
          new ClipboardItem({
            [dataBlob.type]: dataBlob,
          })
        ]);
      };

      if (media.fileType === "image") {
         let supportsNative = false;
         try {
           if (typeof ClipboardItem !== "undefined" && ClipboardItem.supports) {
             supportsNative = ClipboardItem.supports(blob.type);
           }
         } catch (e) {
           supportsNative = false;
         }

         if (!supportsNative && (blob.type === "image/webp" || blob.type === "image/avif" || blob.type === "image/png" || blob.type === "image/jpeg")) {
           console.log("[Transfer Node Copy] Fallback Triggered: Converting image format via JSquash...");
           const convertToPng = async () => {
              let imageData: ImageData | null = null;
              const buffer = await blob.arrayBuffer();
              try {
                if (blob.type === "image/webp") {
                    const decodeWebp = (await import("@jsquash/webp/decode")).default;
                    imageData = await decodeWebp(buffer);
                } else if (blob.type === "image/avif") {
                    const decodeAvif = (await import("@jsquash/avif/decode")).default;
                    imageData = await decodeAvif(buffer);
                } else if (blob.type === "image/jpeg") {
                    const decodeJpeg = (await import("@jsquash/jpeg/decode")).default;
                    imageData = await decodeJpeg(buffer);
                }
              } catch (e) {
                console.warn("[Transfer Node Copy] JSquash direct decode failed, falling back to canvas", e);
              }
              
              if (!imageData) {
                  return await new Promise<Blob>((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                      const canvas = document.createElement("canvas");
                      canvas.width = img.width;
                      canvas.height = img.height;
                      const ctx = canvas.getContext("2d");
                      if (!ctx) return reject(new Error("No 2d context"));
                      ctx.drawImage(img, 0, 0);
                      canvas.toBlob((b) => {
                        if (b) resolve(b);
                        else reject(new Error("Canvas toBlob failed"));
                      }, "image/png");
                    };
                    img.onerror = () => reject(new Error("Image load failed"));
                    img.src = URL.createObjectURL(blob!);
                  });
              } else {
                  const encodePng = (await import("@jsquash/png/encode")).default;
                  const pngBuffer = await encodePng(imageData);
                  return new Blob([pngBuffer], { type: "image/png" });
              }
           };

           try {
             const pngBlob = await convertToPng();
             await writeToClipboard(pngBlob);
             console.log("[Transfer Node Copy] Clipboard Write Success: PNG converted copy");
             setNotification({ message: "Image copied to clipboard", type: "success" });
             successDelay();
             return;
           } catch (convErr) {
             console.error("[Transfer Node Copy] JSquash conversion failed:", convErr);
             // Downstream catch handles the rest
           }
         }

         try {
           await writeToClipboard(blob);
           console.log("[Transfer Node Copy] Clipboard Write Success: Direct image copied");
           setNotification({ message: "Image copied to clipboard", type: "success" });
           successDelay();
         } catch (directErr) {
           console.log("[Transfer Node Copy] Fallback Triggered: Canvas fallback due to direct write error:", directErr);
           try {
             const canvasBlob = await new Promise<Blob>((resolve, reject) => {
                 const img = new Image();
                 img.onload = () => {
                   const canvas = document.createElement("canvas");
                   canvas.width = img.width;
                   canvas.height = img.height;
                   const ctx = canvas.getContext("2d");
                   if (!ctx) return reject(new Error("No 2d context"));
                   ctx.drawImage(img, 0, 0);
                   canvas.toBlob((b) => {
                     if (b) resolve(b);
                     else reject(new Error("Canvas toBlob failed"));
                   }, "image/png");
                 };
                 img.onerror = () => reject(new Error("Image load failed"));
                 img.src = URL.createObjectURL(blob!);
             });
             await writeToClipboard(canvasBlob);
             console.log("[Transfer Node Copy] Clipboard Write Success: Canvas fallback PNG copied");
             setNotification({ message: "Image copied to clipboard", type: "success" });
             successDelay();
           } catch (fallbackErr) {
             console.error("[Transfer Node Copy] Clipboard Write Failed: Direct copy and canvas both failed", fallbackErr);
             setCopyStatus(null);
             setNotification({ message: "Clipboard format not supported by your browser.", type: "error" });
           }
         }
      } else {
         try {
           await writeToClipboard(blob);
           console.log("[Transfer Node Copy] Clipboard Write Success: Direct Blob copied");
           let typeStr = media.fileType?.toUpperCase() || "Asset";
           if (media.fileType === "pdf") typeStr = "PDF";
           else if (media.fileType === "audio") typeStr = "Audio";
           else if (media.fileType === "video") typeStr = "Video";
           setNotification({ message: `${typeStr} copied to clipboard`, type: "success" });
           successDelay();
         } catch (writeErr) {
           console.error("[Transfer Node Copy] Clipboard Write Failed:", writeErr);
           setCopyStatus(null);
           if (media.fileType === "pdf") {
              setNotification({ message: "PDF clipboard not supported by this browser. Use Download instead.", type: "error" });
           } else {
              setNotification({ message: "Cannot copy this file type in your browser. Use Download instead.", type: "error" });
           }
         }
      }
    } catch (e) {
      console.error("[Transfer Node Copy] Clipboard Write Failed with fatal error:", e);
      setCopyStatus(null);
      setNotification({ message: "Failed to copy asset", type: "error" });
    }
  };

  const handlePointerMoveChrome = () => {
    setShowChrome(true);
  };

  useEffect(() => {
    if (selectedMedia) {
      document.body.style.overflow = "hidden";
      setViewedMediaIds((prev) => new Set(prev).add(selectedMedia.id));
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setSelectedMedia(null);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          const mediaMsgs = messages.filter(m => m.type === "file");
          const idx = mediaMsgs.findIndex(m => m.id === selectedMedia.id);
          if (idx !== -1) {
            if (e.key === "ArrowLeft" && idx > 0) {
              setSelectedMedia(mediaMsgs[idx - 1]);
            } else if (e.key === "ArrowRight" && idx < mediaMsgs.length - 1) {
              setSelectedMedia(mediaMsgs[idx + 1]);
            }
          }
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = "";
        window.removeEventListener("keydown", handleKeyDown);
      };
    } else {
      document.body.style.overflow = "";
      setViewedMediaIds(new Set());
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedMedia, messages]);
  const [showContextMenu, setShowContextMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);

  const [pairingMode, setPairingMode] = useState<"local" | "universal">(
    "local",
  );
  const [pairingWorkflow, setPairingWorkflow] = useState<"qr" | "manual">("qr");
  const [clipboardDetectedSdp, setClipboardDetectedSdp] = useState<
    string | null
  >(null);
  const [qrDensity, setQrDensity] = useState<"L" | "M" | "Q" | "H">("L");
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [copiedSDP, setCopiedSDP] = useState(false);

  useEffect(() => {
    const payload = offerQR || answerQR;
    if (payload) {
      let chunkLen = 250;
      if (qrDensity === "L") chunkLen = 100;
      if (qrDensity === "M") chunkLen = 180;
      if (qrDensity === "Q") chunkLen = 250;
      if (qrDensity === "H") chunkLen = 350;

      const totalChunks = Math.ceil(payload.length / chunkLen);
      const sid = Math.random().toString(36).substring(2, 8);
      const frames = [];
      for (let i = 0; i < totalChunks; i++) {
        const p = payload.slice(i * chunkLen, (i + 1) * chunkLen);
        frames.push(JSON.stringify({ s: sid, t: totalChunks, i, p }));
      }
      setBroadcastFrames(frames);
      setCurrentFrameIndex(0);
    } else {
      setBroadcastFrames([]);
      setReceivedChunks(null);
    }
  }, [offerQR, answerQR, qrDensity]);

  useEffect(() => {
    if (completeScannedPayload) {
      processCompleteScannedPayload(completeScannedPayload);
      setCompleteScannedPayload(null);
    }
  }, [completeScannedPayload]);

  useEffect(() => {
    if (broadcastFrames.length > 1) {
      const ms = qrSpeed === "fast" ? 300 : qrSpeed === "balanced" ? 600 : 1000;
      const interval = setInterval(() => {
        setCurrentFrameIndex(prev => (prev + 1) % broadcastFrames.length);
      }, ms);
      return () => clearInterval(interval);
    } else {
      setCurrentFrameIndex(0);
    }
  }, [broadcastFrames, qrSpeed]);

  useEffect(() => {
    const checkClipboardForSdp = async () => {
      if (connectionState === "pairing") {
        try {
          const text = await navigator.clipboard.readText();
          if (
            text &&
            text.length > 50 &&
            (text.startsWith("b64:") ||
              text.startsWith("uri:") ||
              text.startsWith("u16:"))
          ) {
            if (
              text !== offerQR &&
              text !== answerQR &&
              text !== copyPasteOffer &&
              text !== copyPasteAnswer
            ) {
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

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    chatScrollPosRef.current = scrollTop;
    const atBottom = scrollHeight - scrollTop - clientHeight < 100;
    setIsAtBottom(atBottom);
    if (atBottom) {
      setUnreadCount(0);
      setShowScrollDown(false);
    }
  };

  useEffect(() => {
    if (viewMode === "chat" && scrollRef.current) {
      if (isAtBottom) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "auto",
        });
      } else {
        scrollRef.current.scrollTo({
          top: chatScrollPosRef.current,
          behavior: "auto",
        });
      }
    }
  }, [viewMode]);

  useEffect(() => {
    if (isAtBottom && scrollRef.current && viewMode === "chat") {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    } else if (!isAtBottom) {
      // Just received new message, not at bottom
      setShowScrollDown(true);
    }
  }, [messages]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (dcRef.current) {
        setDiagnostics((prev) => ({
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
            advanced: [{ focusMode: "continuous" } as any],
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
          setDiagnostics((prev) => ({ ...prev, scanTime: performance.now() }));

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
              let usedRoi = true;

              const roiData = ctx.getImageData(sx, sy, roiSize, roiSize);
              code = jsQR(roiData.data, roiData.width, roiData.height, {
                inversionAttempts: "dontInvert",
              });

              if (!code) {
                const fullData = ctx.getImageData(0, 0, width, height);
                code = jsQR(fullData.data, fullData.width, fullData.height, {
                  inversionAttempts: "dontInvert",
                });
                usedRoi = false;
              }

              if (code && code.data) {
                const refW = usedRoi ? roiData.width : width;
                const qrW = Math.abs(code.location.bottomRightCorner.x - code.location.bottomLeftCorner.x);
                if (qrW < refW * 0.3) {
                  setScannerGuidance("Move closer");
                } else if (qrW > refW * 0.9) {
                  setScannerGuidance("Move farther");
                } else {
                  setScannerGuidance("Hold steady");
                }

                scanHistory.push(code.data);
                if (scanHistory.length > 3) scanHistory.shift();

                const isChunk = code.data.startsWith("{") && code.data.includes('"s":') && code.data.includes('"t":');
                if (
                  isChunk ||
                  (scanHistory.length === 3 &&
                  scanHistory.every((c) => c === code!.data))
                ) {
                  setDiagnostics((prev) => ({
                    ...prev,
                    scanTime: performance.now() - prev.scanTime,
                  }));
                  handleScan(code.data);
                  scanHistory = [];
                }
              } else {
                setScannerGuidance("Scanning...");
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
    replyTo?: Message["replyTo"],
    fileBlob?: Blob,
  ) => {
    if (!dcRef.current || dcRef.current.readyState !== "open") return;
    const msgId = uuidv4();
    const totalChunks = Math.ceil(payloadStr.length / CHUNK_SIZE);
    const startTime = performance.now();

    const objectUrl = type === "file" ? dataURItoBlobURL(payloadStr) : payloadStr;
    const finalBlob = fileBlob || (type === "file" && objectUrl ? blobRegistry.get(objectUrl) : undefined);

    const initialMsg: Message = {
      id: msgId,
      sender: "me",
      type: type as any,
      content: objectUrl,
      fileName,
      fileType: fileName ? getFileType(fileName) : undefined,
      fileSize: payloadStr.length,
      originalBlob: finalBlob,
      timestamp: Date.now(),
      status: "sending",
      chunksSent: 0,
      chunksTotal: totalChunks,
      replyTo,
    };
    if (objectUrl && finalBlob) {
      blobRegistry.set(objectUrl, finalBlob);
    }

    if (type === "file") {
      setMessages((prev) => [...prev, initialMsg]);
    }

    dcRef.current.send(
      JSON.stringify({
        type: "chunk_start",
        msgId,
        msgType: type,
        totalChunks,
        fileName,
        fileSize: payloadStr.length,
        replyTo,
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
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, chunksSent: i + 1 } : m)),
        );
      }

      // Update diagnostics
      const elapsed = (performance.now() - startTime) / 1000;
      const speed = ((i + 1) * CHUNK_SIZE) / elapsed;
      setDiagnostics((prev) => ({ ...prev, transferSpeed: speed }));
    }

    dcRef.current.send(JSON.stringify({ type: "chunk_end", msgId }));
    setTransferProgress(0);

    if (type === "file") {
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, status: "sent" } : m)),
      );
    }
  };

  const minimizeSDP = (sdp: string, mode: "local" | "universal") => {
    let candidateCount = 0;
    const lines = sdp.split("\r\n");
    const filtered = lines.filter((line) => {
      if (line.startsWith("a=candidate:")) {
        candidateCount++;
        // We no longer aggressively filter candidates because SDP size is manageable via animated QR chunks.
        // We want maximum reliability.
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
      console.log("ICE State:", pc.iceConnectionState);
      if (
        pc.iceConnectionState === "connected" ||
        pc.iceConnectionState === "completed"
      ) {
        setConnectionState("connected");
      } else if (pc.iceConnectionState === "failed") {
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
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msg.msgId ? { ...m, status: "delivered" } : m,
            ),
          );
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
            replyTo: msg.replyTo,
          };
          setMessages((prev) => [...prev, newMsg]);

          if (!isAtBottom || document.visibilityState === "hidden") {
            setUnreadCount((prev) => prev + 1);
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
            replyTo: msg.replyTo,
          };
          setConnectionState("transferring");

          if (msg.msgType === "file") {
            sendLocalNotification(
              "Incoming File",
              `Receiving ${msg.fileName || "unknown file"}...`,
            );
          }
        } else if (msg.type === "chunk_data") {
          const chunkData = chunksRef.current[msg.msgId];
          if (chunkData) {
            chunkData.received[msg.chunkIndex] = msg.chunk;
            chunkData.count++;
            const progress = Math.floor(
              (chunkData.count / chunkData.total) * 100,
            );
            setTransferProgress(progress);
          }
        } else if (msg.type === "chunk_end") {
          const chunkData = chunksRef.current[msg.msgId];
          if (chunkData) {
            const fullPayload = chunkData.received.join("");
            const isCorrupted =
              chunkData.count !== chunkData.total ||
              chunkData.received.includes(undefined as any);

            if (
              isCorrupted ||
              (msg.fileSize && fullPayload.length !== msg.fileSize)
            ) {
              console.error("Integrity check failed", {
                count: chunkData.count,
                total: chunkData.total,
                expectedSize: msg.fileSize,
                actualSize: fullPayload.length,
              });
              setNotification({
                message: "File transfer corrupted or incomplete. Please retry.",
                type: "error",
              });
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
              const fType = chunkData.fileName
                ? getFileType(chunkData.fileName)
                : "file";
              const objectUrl = dataURItoBlobURL(fullPayload);
              const originalBlob = blobRegistry.get(objectUrl);
              const newMsg: Message = {
                id: msg.msgId,
                sender: "remote",
                type: "file",
                fileName: chunkData.fileName,
                fileType: fType,
                fileSize: fullPayload.length,
                content: objectUrl,
                originalBlob,
                timestamp: Date.now(),
                status: "received",
                replyTo: chunkData.replyTo,
              };
              setMessages((prev) => [...prev, newMsg]);

              if (!isAtBottom || document.visibilityState === "hidden") {
                setUnreadCount((prev) => prev + 1);
                setShowScrollDown(true);
                sendLocalNotification(
                  "File Received",
                  chunkData.fileName || "New file received",
                );
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
      const timeout = setTimeout(resolve, 3000);
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

  const processCompleteScannedPayload = (code: string) => {
    try {
      const uncompressed = decompressPayload(code);
      const desc = JSON.parse(uncompressed || code);
      if (desc.type === "offer") {
        setIsHosting(false);
        setOfferQR("");
        processOffer(desc);
      } else if (desc.type === "answer") {
        if (!isHosting && !offerQR) {
          setScanError("Scanned Answer but no Offer was generated. Invalid state.");
          setTimeout(() => setScanError(null), 3000);
          return;
        }
        processAnswer(desc);
      } else {
        setScanError(`Invalid SDP Type: ${desc.type || "unknown"}`);
        setTimeout(() => setScanError(null), 3000);
        return;
      }
      setScanError(null);
      setReceivedChunks(null);
    } catch (e) {
      setScanError(
        "Invalid pairing code scanned. Keep scanning or try another code.",
      );
      setTimeout(() => setScanError(null), 3000);
    }
  };

  const handleScan = (code: string) => {
    if (!code) return;

    try {
      if (code.startsWith("{") && code.includes('"s":') && code.includes('"t":')) {
        const chunk = JSON.parse(code);
        if (chunk.s && typeof chunk.t === "number" && typeof chunk.i === "number" && chunk.p) {
          setReceivedChunks((prev) => {
            if (prev && prev.sessionId === chunk.s && Object.keys(prev.chunks).length === prev.total) {
                return prev; 
            }
            const isNewSession = !prev || prev.sessionId !== chunk.s;
            const newState = isNewSession ? {
              sessionId: chunk.s,
              total: chunk.t,
              chunks: {} as Record<number, string>
            } : { ...prev, chunks: { ...prev.chunks } };
            
            if (!newState.chunks[chunk.i]) {
              newState.chunks[chunk.i] = chunk.p;
            }
            
            if (Object.keys(newState.chunks).length === chunk.t) {
              const fullPayload = Array.from({length: chunk.t}).map((_, idx) => newState.chunks[idx]).join("");
              setCompleteScannedPayload(fullPayload);
            }
            return newState;
          });
          return;
        }
      }
    } catch(e) {}

    // Legacy unchunked parsing fallback
    processCompleteScannedPayload(code);
  };

  const processOffer = async (offer: any) => {
    const start = performance.now();
    const pc = initPeer();
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await new Promise<void>((resolve) => {
      if (pc.iceGatheringState === "complete") return resolve();
      const timeout = setTimeout(resolve, 3000);
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

    const replyData = replyingTo
      ? {
          id: replyingTo.id,
          sender: replyingTo.sender,
          content: replyingTo.content,
          type: replyingTo.type,
          fileName: replyingTo.fileName,
        }
      : undefined;

    const msgId = uuidv4();
    const msg: Message = {
      id: msgId,
      sender: "me",
      type: "text",
      content: chatInput,
      timestamp: Date.now(),
      status: "sent",
      replyTo: replyData,
    };
    dcRef.current.send(
      JSON.stringify({
        type: "text",
        id: msgId,
        content: chatInput,
        replyTo: replyData,
      }),
    );
    setMessages((prev) => [...prev, msg]);
    setChatInput("");
    setReplyingTo(null);
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

  const mediaMsgs = messages.filter((m) => m.type === "file");
  const selectedMediaIdx = selectedMedia ? mediaMsgs.findIndex((m) => m.id === selectedMedia.id) : -1;
  const hasPrevMedia = selectedMediaIdx > 0;
  const hasNextMedia = selectedMediaIdx !== -1 && selectedMediaIdx < mediaMsgs.length - 1;

  const touchStartXRef = useRef<number>(0);
  const touchEndXRef = useRef<number>(0);

  const handleMediaTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.changedTouches[0].screenX;
  };

  const handleMediaTouchEnd = (e: React.TouchEvent) => {
    touchEndXRef.current = e.changedTouches[0].screenX;
    if (touchEndXRef.current < touchStartXRef.current - 50 && hasNextMedia) {
      setSelectedMedia(mediaMsgs[selectedMediaIdx + 1]);
    } else if (touchEndXRef.current > touchStartXRef.current + 50 && hasPrevMedia) {
      setSelectedMedia(mediaMsgs[selectedMediaIdx - 1]);
    }
  };

  return (
    <div
      className={`w-[400px] min-h-[340px] rounded-2xl overflow-hidden border shadow-2xl flex flex-col nowheel ${isDark ? "bg-[#111829] border-white/10 text-slate-300" : "bg-white border-slate-200 text-slate-800"}`}
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
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
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
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
                    {scannerGuidance}
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
                  {receivedChunks && receivedChunks.total > 1 && (
                    <div className="mt-4 w-full">
                      <div className="flex justify-between text-[10px] text-emerald-400 font-bold mb-1">
                        <span>Receiving Chunks...</span>
                        <span>{Object.keys(receivedChunks.chunks).length} / {receivedChunks.total}</span>
                      </div>
                      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-200" style={{ width: `${(Object.keys(receivedChunks.chunks).length / receivedChunks.total) * 100}%` }} />
                      </div>
                    </div>
                  )}
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
        <div className="flex items-center gap-2 relative">
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
            {connectionState === "pairing"
              ? isHosting
                ? offerQR
                  ? "Waiting For Answer"
                  : "Generating Offer"
                : answerQR
                  ? "Waiting For Connection"
                  : "Generating Answer"
              : connectionState === "waiting"
                ? "Ready To Pair"
                : connectionState}
          </div>

          {connectionState !== "waiting" && (
            <button
              onClick={() => {
                if (pcRef.current) pcRef.current.close();
                setConnectionState("waiting");
                setMessages([]);
                setOfferQR("");
                setAnswerQR("");
                setScanMode(null);
                setReceivedChunks(null);
                setCompleteScannedPayload(null);
                setIsHosting(false);
                setTransferProgress(0);
              }}
              className={`p-1.5 rounded-lg transition-colors ${
                isDark
                  ? "hover:bg-red-500/10 text-slate-400 hover:text-red-400"
                  : "hover:bg-red-50 text-slate-500 hover:text-red-500"
              }`}
              title="Disconnect & Exit"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
            className={`p-1.5 rounded-lg transition-colors ${
              showSettingsDropdown
                ? isDark
                  ? "bg-white/10 text-white"
                  : "bg-slate-200 text-slate-900"
                : isDark
                  ? "hover:bg-white/5 text-slate-400 hover:text-white"
                  : "hover:bg-slate-100 text-slate-500 hover:text-slate-900"
            }`}
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          <AnimatePresence>
            {showSettingsDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowSettingsDropdown(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  onClick={(e) => e.stopPropagation()}
                  className={`absolute top-full right-0 mt-2 w-64 p-4 rounded-2xl border shadow-2xl z-50 origin-top-right backdrop-blur-xl ${
                    isDark
                      ? "bg-[#111827]/95 border-white/10"
                      : "bg-white/95 border-slate-200"
                  }`}
                >
                  <div className="flex flex-col gap-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">
                        Pairing Mode
                      </span>
                      <div
                        className={`p-1 rounded-lg flex gap-1 ${isDark ? "bg-white/5" : "bg-slate-100"}`}
                      >
                        <button
                          onClick={() => {
                            setPairingMode("local");
                          }}
                          className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${
                            pairingMode === "local"
                              ? isDark
                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                                : "bg-white text-indigo-600 shadow-sm"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          Local
                        </button>
                        <button
                          onClick={() => {
                            setPairingMode("universal");
                          }}
                          className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${
                            pairingMode === "universal"
                              ? isDark
                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                                : "bg-white text-indigo-600 shadow-sm"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          Universal
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">
                        QR Density
                      </span>
                      <div
                        className={`p-1 rounded-lg flex gap-1 ${isDark ? "bg-white/5" : "bg-slate-100"}`}
                      >
                        {(["L", "M", "Q", "H"] as const).map((d) => (
                          <button
                            key={d}
                            onClick={() => {
                              setQrDensity(d);
                            }}
                            className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                              qrDensity === d
                                ? isDark
                                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                                  : "bg-white text-indigo-600 shadow-sm"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block mt-4">
                        Animation Speed
                      </span>
                      <div
                        className={`p-1 rounded-lg flex gap-1 ${isDark ? "bg-white/5" : "bg-slate-100"}`}
                      >
                        {(["fast", "balanced", "reliable"] as const).map((s) => (
                          <button
                            key={s}
                            onClick={() => setQrSpeed(s)}
                            className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${
                              qrSpeed === s
                                ? isDark
                                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                                  : "bg-white text-indigo-600 shadow-sm"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
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

            <div className="flex justify-center -mt-2">
              <button
                onClick={() => {
                  setConnectionState("pairing");
                  setPairingWorkflow("manual");
                  setIsHosting(true);
                }}
                className={`text-[9px] font-bold uppercase tracking-widest transition-colors ${isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"}`}
              >
                Use Manual SDP Exchange
              </button>
            </div>
          </motion.div>
        )}

        {connectionState === "pairing" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-6 py-2 w-full"
          >
            <div
              className={`p-1.5 flex w-full rounded-2xl border ${isDark ? "bg-white/5 border-white/5" : "bg-slate-100 border-slate-200"}`}
            >
              <button
                onClick={() => setPairingWorkflow("qr")}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${
                  pairingWorkflow === "qr"
                    ? isDark
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                      : "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                QR Scan
              </button>
              <button
                onClick={() => setPairingWorkflow("manual")}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${
                  pairingWorkflow === "manual"
                    ? isDark
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                      : "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                Manual SDP
              </button>
            </div>

            {pairingWorkflow === "qr" ? (
              <>
                {showDiagnostics ? (
                  <div
                    className={`w-full p-4 rounded-3xl shrink-0 ${isDark ? "bg-[#0d1017] border border-white/10" : "bg-slate-50 border border-slate-200"} space-y-2`}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-gray-500/20">
                      <span className="text-[10px] font-black uppercase text-indigo-400">
                        Diagnostics
                      </span>
                      <button
                        onClick={() => setShowDiagnostics(false)}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] font-mono mt-2">
                      <div className="text-slate-500">Original SDP:</div>
                      <div
                        className={isDark ? "text-slate-300" : "text-slate-700"}
                      >
                        {diagnostics.originalSdpSize} B
                      </div>
                      <div className="text-slate-500">Filtered SDP:</div>
                      <div
                        className={isDark ? "text-slate-300" : "text-slate-700"}
                      >
                        {diagnostics.filteredSdpSize} B
                      </div>
                      <div className="text-slate-500">ICE Candidates:</div>
                      <div className={isDark ? "text-white" : "text-slate-900"}>
                        {diagnostics.candidateCount}
                      </div>
                      <div className="text-slate-500">Compressed:</div>
                      <div
                        className={
                          isDark ? "text-emerald-400" : "text-emerald-600"
                        }
                      >
                        {diagnostics.compressedSize} B (
                        {diagnostics.compressionRatio}%)
                      </div>
                      <div className="text-slate-500">Gen Time:</div>
                      <div
                        className={isDark ? "text-slate-300" : "text-slate-700"}
                      >
                        {diagnostics.genTime.toFixed(1)} ms
                      </div>
                      {broadcastFrames.length > 0 && (
                        <>
                          <div className="text-slate-500">QR Speed Pres:</div>
                          <div className={isDark ? "text-slate-300" : "text-slate-700"}>
                            {qrSpeed}
                          </div>
                          <div className="text-slate-500">Total Frames:</div>
                          <div className={isDark ? "text-slate-300" : "text-slate-700"}>
                            {broadcastFrames.length}
                          </div>
                          <div className="text-slate-500">Current Frame:</div>
                          <div className={isDark ? "text-emerald-400" : "text-emerald-600"}>
                            {currentFrameIndex + 1}
                          </div>
                        </>
                      )}
                      {diagnostics.scanTime > 0 && (
                        <>
                          <div className="text-slate-500">Scan Time:</div>
                          <div
                            className={
                              isDark ? "text-slate-300" : "text-slate-700"
                            }
                          >
                            {diagnostics.scanTime.toFixed(1)} ms
                          </div>
                        </>
                      )}
                      {diagnostics.transferSpeed > 0 && (
                        <>
                          <div className="text-slate-500">TX Speed:</div>
                          <div className="text-blue-400">
                            {formatFileSize(diagnostics.transferSpeed)}/s
                          </div>
                        </>
                      )}
                      <div className="text-slate-500">Buffer:</div>
                      <div
                        className={
                          diagnostics.bufferedAmount > 1024 * 512
                            ? "text-amber-400"
                            : "text-slate-400"
                        }
                      >
                        {formatFileSize(diagnostics.bufferedAmount)}
                      </div>
                    </div>
                  </div>
                ) : (
                    <div className="p-4 bg-white rounded-3xl shadow-xl shrink-0 relative group flex items-center justify-center min-h-[300px] min-w-[300px] w-full max-w-[340px]">
                      {broadcastFrames.length > 0 && (
                        <div className="absolute top-2 left-2 z-[10]">
                          <div className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-100/80 text-slate-500 backdrop-blur-sm shadow-sm ring-1 ring-slate-200">
                            {currentFrameIndex + 1} / {broadcastFrames.length}
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => setShowDiagnostics(true)}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-100/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-200/80 z-[10] backdrop-blur-sm shadow-sm ring-1 ring-slate-200"
                      >
                        <Activity className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                      {(broadcastFrames.length > 0 || offerQR || answerQR) && (
                        <QRCodeSVG
                          value={broadcastFrames.length > 0 ? broadcastFrames[currentFrameIndex] : (offerQR || answerQR)}
                          size={260}
                          level={qrDensity}
                          marginSize={2}
                          className="w-full h-auto max-w-[280px]"
                        />
                      )}
                    </div>
                )}

                <div className="text-center space-y-1">
                  <p className="text-sm font-bold text-white">
                    {isHosting ? "Offer Generated" : "Answer Generated"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {isHosting ? "Scan this code on the joining device" : "Scan this code back on the host device"}
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
                <div className="flex gap-2 w-full max-w-[250px]">
                  <button
                    onClick={() => setScanMode(isHosting ? "answer" : "offer")}
                    className={`flex-1 py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase transition-all whitespace-nowrap shadow-sm active:scale-95 ${
                      isDark
                        ? "border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 shadow-indigo-500/10"
                        : "border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 shadow-indigo-500/5"
                    }`}
                  >
                    <Scan className="w-3.5 h-3.5" /> Open Scanner
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(offerQR || answerQR);
                      setCopiedSDP(true);
                      setTimeout(() => setCopiedSDP(false), 2000);
                      setNotification({
                        message: "SDP Copied to Clipboard",
                        type: "success",
                      });
                    }}
                    disabled={!(offerQR || answerQR)}
                    className={`flex-1 py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase transition-all whitespace-nowrap active:scale-95 ${
                      isDark
                        ? copiedSDP
                          ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
                          : "border-white/5 bg-white/5 hover:bg-white/10 text-white"
                        : copiedSDP
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:border-slate-300"
                    } disabled:opacity-50 disabled:pointer-events-none`}
                  >
                    {copiedSDP ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}{" "}
                    {copiedSDP ? "Copied" : "Copy SDP"}
                  </button>
                </div>
              </>
            ) : (
              <div className="w-full space-y-3">
                <div
                  className={`p-1 flex rounded-xl ${isDark ? "bg-white/5" : "bg-slate-100"}`}
                >
                  <button
                    onClick={() => {
                      if (!isHosting) {
                        setOfferQR("");
                        setAnswerQR("");
                        setCopyPasteAnswer("");
                        setIsHosting(true);
                      }
                    }}
                    className={`flex-[1.5] py-2 text-[9px] font-black uppercase tracking-widest transition-all rounded-lg flex flex-col items-center justify-center gap-0.5 ${
                      isHosting
                        ? isDark
                          ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                          : "bg-indigo-50 text-indigo-600 border border-indigo-200"
                        : "text-slate-400 border border-transparent hover:text-slate-600 dark:hover:text-slate-300"
                    }`}
                  >
                    <span>Initiator</span>
                    <span className="text-[7px] tracking-tight opacity-70">
                      Create Offer
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      if (isHosting) {
                        setOfferQR("");
                        setAnswerQR("");
                        setCopyPasteOffer("");
                        setIsHosting(false);
                      }
                    }}
                    className={`flex-[1.5] py-2 text-[9px] font-black uppercase tracking-widest transition-all rounded-lg flex flex-col items-center justify-center gap-0.5 ${
                      !isHosting
                        ? isDark
                          ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                        : "text-slate-400 border border-transparent hover:text-slate-600 dark:hover:text-slate-300"
                    }`}
                  >
                    <span>Responder</span>
                    <span className="text-[7px] tracking-tight opacity-70">
                      Reply to Offer
                    </span>
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  {(() => {
                    const yourSdpSection = (
                      <div
                        className={`group relative p-4 rounded-[24px] border transition-all duration-300 ${
                          isDark
                            ? "bg-white/5 border-white/10 hover:border-indigo-500/30"
                            : "bg-white border-slate-200 hover:border-indigo-200 shadow-sm"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div
                              className={`p-1 rounded-lg ${isDark ? "bg-indigo-500/10" : "bg-indigo-50"}`}
                            >
                              <Share2
                                className={`w-3.5 h-3.5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`}
                              />
                            </div>
                            <p
                              className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDark ? "text-slate-400" : "text-slate-500"}`}
                            >
                              {isHosting ? "1" : "2"}. Your{" "}
                              {isHosting ? "Offer" : "Answer"} SDP
                            </p>
                          </div>
                          {offerQR || answerQR ? (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter ${
                                isDark
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : "bg-emerald-50 text-emerald-600"
                              }`}
                            >
                              Generated
                            </span>
                          ) : null}
                        </div>

                        <div className="flex gap-3 items-stretch">
                          <div className="flex-1 min-w-0">
                            {offerQR || answerQR ? (
                              <div
                                className={`h-full min-h-[52px] p-2.5 rounded-xl flex flex-col justify-between transition-colors overflow-hidden ${
                                  isDark
                                    ? "bg-black/40 border border-white/5"
                                    : "bg-slate-50 border border-slate-100"
                                }`}
                              >
                                <div
                                  className={`text-[11px] font-mono truncate leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}
                                >
                                  {offerQR || answerQR}
                                </div>
                                <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-white/5 shrink-0">
                                  <Activity className="w-2.5 h-2.5 text-slate-500" />
                                  <span className="text-[9px] font-medium text-slate-500">
                                    Payload: {(offerQR || answerQR).length}{" "}
                                    bytes
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div
                                className={`h-full min-h-[52px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-3 text-center ${
                                  isDark
                                    ? "border-white/5 bg-black/20"
                                    : "border-slate-100 bg-slate-50/50"
                                }`}
                              >
                                {isHosting ? (
                                  <button
                                    onClick={generateOffer}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg flex items-center gap-2 transition-colors"
                                  >
                                    <Plus className="w-3 h-3" /> Generate Offer
                                  </button>
                                ) : (
                                  <p
                                    className={`text-[9px] font-medium italic ${isDark ? "text-slate-600" : "text-slate-400"}`}
                                  >
                                    Waiting for remote{" "}
                                    {isHosting ? "connection" : "offer"}...
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(
                                offerQR || answerQR,
                              );
                              setCopiedSDP(true);
                              setTimeout(() => setCopiedSDP(false), 2000);
                              setNotification({
                                message: "SDP Copied to Clipboard",
                                type: "success",
                              });
                            }}
                            disabled={!(offerQR || answerQR)}
                            className={`px-4 rounded-xl active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all flex flex-col items-center justify-center gap-1.5 shadow-lg ${
                              copiedSDP
                                ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20 text-white"
                                : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20 text-white"
                            }`}
                          >
                            {copiedSDP ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                            <span className="text-[9px] font-black uppercase tracking-widest">
                              {copiedSDP ? "Copied" : "Copy"}
                            </span>
                          </button>
                        </div>
                      </div>
                    );

                    const remoteSdpSection = (
                      <div
                        className={`p-4 rounded-[24px] border relative transition-all duration-300 ${
                          isDark
                            ? "bg-white/5 border-white/10"
                            : "bg-white border-slate-200 shadow-sm"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <div
                            className={`p-1 rounded-lg ${isDark ? "bg-emerald-500/10" : "bg-emerald-50"}`}
                          >
                            <LogIn
                              className={`w-3.5 h-3.5 ${isDark ? "text-emerald-400" : "text-emerald-600"}`}
                            />
                          </div>
                          <p
                            className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDark ? "text-slate-400" : "text-slate-500"}`}
                          >
                            {isHosting ? "2" : "1"}. Remote{" "}
                            {isHosting ? "Answer" : "Offer"} SDP
                          </p>
                        </div>

                        <div className="space-y-3">
                          <div className="relative">
                            <textarea
                              placeholder={`Paste remote ${isHosting ? "answer" : "offer"} here...`}
                              className={`w-full h-24 p-3 pr-10 text-[11px] font-mono rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none leading-relaxed ${
                                isDark
                                  ? "bg-black/40 text-white placeholder-slate-600 border border-white/5"
                                  : "bg-slate-50 text-slate-900 placeholder-slate-400 border border-slate-100"
                              }`}
                              value={
                                isHosting ? copyPasteAnswer : copyPasteOffer
                              }
                              onChange={(e) =>
                                isHosting
                                  ? setCopyPasteAnswer(e.target.value)
                                  : setCopyPasteOffer(e.target.value)
                              }
                              onWheelCapture={(e) => e.stopPropagation()}
                            />
                            {(isHosting ? copyPasteAnswer : copyPasteOffer) && (
                              <button
                                onClick={() =>
                                  isHosting
                                    ? setCopyPasteAnswer("")
                                    : setCopyPasteOffer("")
                                }
                                className={`absolute top-2 right-2 p-1.5 rounded-lg transition-colors ${
                                  isDark
                                    ? "text-slate-400 hover:text-white hover:bg-white/10"
                                    : "text-slate-400 hover:text-slate-900 hover:bg-slate-200"
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
                                  const text =
                                    await navigator.clipboard.readText();
                                  if (text && text.trim().length > 50) {
                                    isHosting
                                      ? setCopyPasteAnswer(text.trim())
                                      : setCopyPasteOffer(text.trim());
                                    setNotification({
                                      message: "SDP Pasted from Clipboard",
                                      type: "success",
                                    });
                                    setClipboardDetectedSdp(null);
                                  } else {
                                    setNotification({
                                      message:
                                        "No valid SDP payload in clipboard",
                                      type: "error",
                                    });
                                  }
                                } catch (err) {
                                  setNotification({
                                    message:
                                      "Clipboard locked. Please use Ctrl+V / Cmd+V to paste.",
                                    type: "error",
                                  });
                                }
                              }}
                              className={`flex-1 py-2.5 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                                isDark
                                  ? "border-white/5 hover:border-indigo-500/30 bg-white/5 text-slate-500 hover:text-indigo-400"
                                  : "border-slate-200 hover:border-indigo-200 bg-white text-slate-400 hover:text-indigo-600"
                              }`}
                            >
                              <ClipboardPaste className="w-3.5 h-3.5" />
                              <span className="text-[9px] font-bold uppercase tracking-wider">
                                Paste
                              </span>
                            </button>

                            <button
                              onClick={() =>
                                handleScan(
                                  isHosting ? copyPasteAnswer : copyPasteOffer,
                                )
                              }
                              disabled={
                                isHosting
                                  ? !copyPasteAnswer.trim()
                                  : !copyPasteOffer.trim()
                              }
                              className="flex-[2] py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-30 disabled:grayscale text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                            >
                              <Check className="w-3.5 h-3.5" />
                              {isHosting ? "Establish" : "Verify & Generate"}
                            </button>
                          </div>

                          <AnimatePresence>
                            {clipboardDetectedSdp && (
                              <motion.div
                                initial={{
                                  opacity: 0,
                                  height: 0,
                                  marginTop: 0,
                                }}
                                animate={{
                                  opacity: 1,
                                  height: "auto",
                                  marginTop: 8,
                                }}
                                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                className={`overflow-hidden rounded-xl border ${isDark ? "bg-indigo-500/10 border-indigo-500/20" : "bg-indigo-50 border-indigo-100"}`}
                              >
                                <div className="p-2 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Activity
                                      className={`w-3 h-3 ${isDark ? "text-indigo-400" : "text-indigo-600"}`}
                                    />
                                    <span
                                      className={`text-[9px] font-black uppercase tracking-wider ${isDark ? "text-indigo-300" : "text-indigo-700"}`}
                                    >
                                      Detected
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => {
                                      isHosting
                                        ? setCopyPasteAnswer(
                                            clipboardDetectedSdp,
                                          )
                                        : setCopyPasteOffer(
                                            clipboardDetectedSdp,
                                          );
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
                    );

                    return isHosting ? (
                      <>
                        {yourSdpSection}
                        {remoteSdpSection}
                      </>
                    ) : (
                      <>
                        {remoteSdpSection}
                        {yourSdpSection}
                      </>
                    );
                  })()}
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

            const scrollToMessage = (id: string) => {
              const el = document.getElementById(`msg-${id}`);
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                const pulseClasses = [
                  "ring-2",
                  "ring-indigo-500",
                  "ring-offset-2",
                ];
                el.classList.add(...pulseClasses);
                setTimeout(() => {
                  el.classList.remove(...pulseClasses);
                }, 2000);
              } else {
                setNotification({
                  message: "Message not found in history",
                  type: "info",
                });
              }
            };

            const handleCopyMessage = (content: string) => {
              navigator.clipboard.writeText(content);
              setNotification({
                message: "Message copied",
                type: "success",
              });
            };

            const content = (
              <div
                className={`flex flex-col relative nowheel ${isFullscreen ? "w-full max-w-4xl mx-auto h-full" : "h-[420px]"}`}
                onKeyDown={(e) => e.stopPropagation()}
                onKeyUp={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
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
                        scrollRef.current?.scrollTo({
                          top: scrollRef.current.scrollHeight,
                          behavior: "smooth",
                        });
                        setShowScrollDown(false);
                      }}
                      className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-indigo-600 text-white text-[10px] font-bold uppercase rounded-full shadow-lg flex items-center gap-2 hover:bg-indigo-700 transition-all border border-indigo-400/30"
                    >
                      <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                      {unreadCount > 0
                        ? `${unreadCount} New Messages`
                        : "Go to bottom"}
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
                          onScroll={handleScroll}
                          onWheelCapture={(e) => e.stopPropagation()}
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
                              id={`msg-${msg.id}`}
                              layout
                              initial={{ opacity: 0, scale: 0.95, y: 10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              className={`flex flex-col mb-4 ${msg.sender === "me" ? "items-end" : "items-start"}`}
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
                                {/* Hover Actions Bar - Desktop only */}
                                <div
                                  className={`absolute top-0 opacity-0 group-hover:opacity-100 transition-all z-20 hidden lg:flex items-center gap-1 p-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 shadow-lg ${
                                    msg.sender === "me"
                                      ? "right-full mr-2"
                                      : "left-full ml-2"
                                  }`}
                                >
                                  <button
                                    onClick={() =>
                                      handleCopyMessage(msg.content)
                                    }
                                    title="Copy"
                                    className="p-1.5 hover:bg-white/20 rounded-full transition-colors text-white"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setReplyingTo(msg)}
                                    title="Reply"
                                    className="p-1.5 hover:bg-white/20 rounded-full transition-colors text-white"
                                  >
                                    <CornerDownRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                {msg.replyTo && (
                                  <button
                                    onClick={() =>
                                      scrollToMessage(msg.replyTo!.id)
                                    }
                                    className={`mx-1 mt-1 mb-0.5 p-2 rounded-2xl flex flex-col gap-0.5 text-left transition-all border-l-4 ${
                                      msg.sender === "me"
                                        ? "bg-black/20 border-white/40 text-white/80 hover:bg-black/30"
                                        : isDark
                                          ? "bg-white/5 border-indigo-500/50 text-slate-400 hover:bg-white/10"
                                          : "bg-black/5 border-indigo-400 text-slate-500 hover:bg-black/10"
                                    }`}
                                  >
                                    <span className="text-[9px] font-black uppercase tracking-widest opacity-60">
                                      {msg.replyTo.sender === "me"
                                        ? "You"
                                        : "Remote"}
                                    </span>
                                    <span className="text-[10px] font-bold line-clamp-1">
                                      {msg.replyTo.type === "file"
                                        ? `📄 ${msg.replyTo.fileName}`
                                        : msg.replyTo.content}
                                    </span>
                                  </button>
                                )}
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
                                      <div className="relative rounded-2xl overflow-hidden bg-black group/vid w-full min-w-[200px] sm:min-w-[280px]">
                                        <video
                                          src={msg.content}
                                          controls
                                          preload="metadata"
                                          playsInline
                                          className="w-full h-auto max-h-[400px] block object-contain mx-auto"
                                          onLoadedMetadata={(e) => {
                                            const video = e.target as HTMLVideoElement;
                                            if (
                                              video.videoHeight >
                                              video.videoWidth * 1.5
                                            ) {
                                              video.style.maxHeight = "500px";
                                            }
                                          }}
                                        />
                                        <button
                                          onClick={() => setSelectedMedia(msg)}
                                          className="absolute top-3 right-3 p-2 rounded-full bg-black/40 hover:bg-black/80 backdrop-blur-md text-white transition-opacity z-10"
                                          title="Expand Video"
                                        >
                                          <Maximize className="w-4 h-4" />
                                        </button>
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
                                      msg.fileType === "pdf" ||
                                      msg.fileType === "text_file") && (
                                      <div
                                        className={`flex items-center gap-3 p-3 rounded-2xl transition-all cursor-pointer ${
                                          msg.sender === "me"
                                            ? "hover:bg-white/5"
                                            : "hover:bg-black/5"
                                        }`}
                                        onClick={() =>
                                          (msg.fileType === "pdf" ||
                                            msg.fileType === "text_file") &&
                                          setSelectedMedia(msg)
                                        }
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
                                          {msg.fileType === "pdf" ||
                                          msg.fileType === "text_file" ? (
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
                                          onClick={(e) => e.stopPropagation()}
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
                          <AnimatePresence>
                            {replyingTo && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="mb-3 px-3 py-2 bg-indigo-500/5 rounded-2xl border border-indigo-500/20 flex gap-3 relative group overflow-hidden"
                              >
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">
                                    Replying to{" "}
                                    {replyingTo.sender === "me"
                                      ? "yourself"
                                      : "remote device"}
                                  </p>
                                  <p className="text-xs text-slate-500 font-bold truncate">
                                    {replyingTo.type === "file"
                                      ? replyingTo.fileName
                                      : replyingTo.content}
                                  </p>
                                </div>
                                <button
                                  onClick={() => setReplyingTo(null)}
                                  className="p-1 rounded-full hover:bg-indigo-500/10 text-slate-400 transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
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
                                      const content = re.target
                                        ?.result as string;
                                      const fType = getFileType(file.name);
                                      sendLargeMessage(
                                        "file",
                                        content,
                                        file.name,
                                        undefined,
                                        file,
                                      );
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
                                onKeyDown={(e) => {
                                  e.stopPropagation();
                                  if (e.key === "Enter") sendMessage();
                                }}
                                onKeyUp={(e) => e.stopPropagation()}
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
                        onWheelCapture={(e) => e.stopPropagation()}
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
                                      setCopyStatus({ id: msg.id, status: "success" });
                                      setTimeout(() => setCopyStatus(null), 2000);
                                      setNotification({
                                        message: "Copied to clipboard",
                                        type: "info",
                                      });
                                      setTimeout(() => {
                                        setShowContextMenu(null);
                                      }, 2000);
                                    } else {
                                      setSelectedMedia(msg);
                                    }
                                  }}
                                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${isDark ? "hover:bg-white/5 text-slate-300" : "hover:bg-slate-50 text-slate-700"}`}
                                >
                                  {msg.type === "text" && copyStatus?.id === msg.id && copyStatus?.status === "success" ? (
                                    <Check className="w-4 h-4 text-emerald-500" />
                                  ) : msg.type === "text" ? (
                                    <Copy className="w-4 h-4" />
                                  ) : (
                                    <Eye className="w-4 h-4" />
                                  )}
                                  {msg.type === "text" && copyStatus?.id === msg.id && copyStatus?.status === "success"
                                    ? "Copied"
                                    : msg.type === "text"
                                    ? "Copy Text"
                                    : msg.fileType === "video"
                                      ? "Play / Open"
                                      : "Open"}
                                </button>
                                {msg.type === "text" && (
                                  <button
                                    onClick={() => {
                                      setChatInput(
                                        "> " + msg.content.trim() + "\n\n",
                                      );
                                      setShowContextMenu(null);
                                    }}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${isDark ? "hover:bg-white/5 text-slate-300" : "hover:bg-slate-50 text-slate-700"}`}
                                  >
                                    <CornerDownRight className="w-4 h-4" />
                                    Reply
                                  </button>
                                )}
                                {msg.type === "file" && (
                                  <button
                                    onClick={() => {
                                      handleMediaCopy(msg);
                                      setTimeout(() => {
                                        setShowContextMenu(null);
                                      }, 2000);
                                    }}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${isDark ? "hover:bg-white/5 text-slate-300" : "hover:bg-slate-50 text-slate-700"}`}
                                  >
                                    {copyStatus?.id === msg.id && copyStatus.status === "success" ? (
                                      <Check className="w-4 h-4 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-4 h-4" />
                                    )}
                                    {copyStatus?.id === msg.id && copyStatus.status === "success"
                                      ? "Copied" 
                                      : msg.fileType === "image" ? "Copy Image" : msg.fileType === "text_file" ? "Copy Content" : "Copy Asset"}
                                  </button>
                                )}
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
                                  Delete
                                </button>
                              </div>
                            );
                          })()}
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>
                </div>

                {createPortal(
                  <AnimatePresence>
                    {selectedMedia && (
                      <div
                        className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/98 backdrop-blur-3xl"
                        onKeyDown={(e) => e.stopPropagation()}
                        onKeyUp={(e) => e.stopPropagation()}
                        onWheel={(e) => e.stopPropagation()}
                        onTouchStart={(e) => {
                          handlePointerMoveChrome();
                          handleMediaTouchStart(e);
                        }}
                        onTouchEnd={handleMediaTouchEnd}
                        onPointerMove={handlePointerMoveChrome}
                        onClick={handlePointerMoveChrome}
                      >
                      <AnimatePresence>
                        {showChrome && (
                          <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.2 }}
                            className="absolute top-0 inset-x-0 z-[12010] flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-auto"
                          >
                            <div className="flex items-center gap-3 w-1/3">
                              <button
                                onClick={() => setSelectedMedia(null)}
                                className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md"
                              >
                                <ChevronLeft className="w-5 h-5 sm:hidden" />
                                <X className="w-5 h-5 hidden sm:block" />
                              </button>
                            </div>
                            
                            <div className="flex flex-col items-center justify-center text-white max-w-[calc(100%-100px)] w-1/3 text-center">
                              <p className="text-sm sm:text-base font-black mb-0.5 truncate w-full px-4">
                                {selectedMedia.fileName}
                              </p>
                              <div className="flex items-center gap-2 opacity-80 text-[10px] sm:text-xs font-bold uppercase tracking-widest whitespace-nowrap overflow-hidden text-ellipsis">
                                <span className="hidden sm:inline">
                                  {formatFileSize(selectedMedia.fileSize || 0)}
                                </span>
                                <span className="w-1 h-1 rounded-full bg-white/50 shrink-0 hidden sm:inline" />
                                <span className="truncate hidden sm:inline">
                                  {new Date(selectedMedia.timestamp).toLocaleString()}
                                </span>
                                <span className="w-1 h-1 rounded-full bg-white/50 shrink-0 hidden sm:inline" />
                                <span>
                                  {selectedMediaIdx + 1} / {mediaMsgs.length}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 w-1/3">
                              <button
                                onClick={() => handleMediaCopy(selectedMedia)}
                                className={`p-3 rounded-full transition-all backdrop-blur-md flex items-center justify-center ${copyStatus?.id === selectedMedia.id && copyStatus.status === 'success' ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                                title="Copy"
                              >
                                {copyStatus?.id === selectedMedia.id && copyStatus.status === "success" ? (
                                  <Check className="w-4 h-4" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                              <a
                                href={selectedMedia.content}
                                download={selectedMedia.fileName || "download"}
                                className="p-3 bg-indigo-600 rounded-full hover:bg-indigo-700 text-white transition-all backdrop-blur-md flex items-center justify-center shadow-lg"
                                title="Download"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <AnimatePresence>
                        {showChrome && hasPrevMedia && (
                          <motion.button
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMedia(mediaMsgs[selectedMediaIdx - 1]);
                            }}
                            className="absolute left-6 top-1/2 -translate-y-1/2 p-4 rounded-full bg-black/40 hover:bg-black/80 text-white z-[12010] transition-all border border-white/10 shadow-xl backdrop-blur-md hidden sm:block pointer-events-auto"
                          >
                            <ChevronLeft className="w-8 h-8" />
                          </motion.button>
                        )}
                      </AnimatePresence>

                      <AnimatePresence>
                        {showChrome && hasNextMedia && (
                          <motion.button
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMedia(mediaMsgs[selectedMediaIdx + 1]);
                            }}
                            className="absolute right-6 top-1/2 -translate-y-1/2 p-4 rounded-full bg-black/40 hover:bg-black/80 text-white z-[12010] transition-all border border-white/10 shadow-xl backdrop-blur-md hidden sm:block pointer-events-auto"
                          >
                            <ChevronRight className="w-8 h-8" />
                          </motion.button>
                        )}
                      </AnimatePresence>

                      <div className="w-full h-full flex items-center justify-center p-0 sm:p-0 z-[12005]">
                        {mediaMsgs.map((media) => {
                          if (!viewedMediaIds.has(media.id)) return null;
                          const isSelected = media.id === selectedMedia.id;

                          return (
                            <motion.div
                              key={media.id}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: isSelected ? 1 : 0, scale: isSelected ? 1 : 0.95, pointerEvents: isSelected ? "auto" : "none" }}
                              exit={{ opacity: 0, scale: 1.05 }}
                              transition={{ duration: 0.2, ease: "easeOut" }}
                              className="w-full h-full absolute inset-0 flex items-center justify-center p-0 sm:p-0"
                              style={{ display: isSelected ? "flex" : "none" }}
                            >
                              {media.fileType === "image" && (
                                <div className="w-full h-full relative cursor-move touch-none flex items-center justify-center">
                                  <TransformWrapper
                                    initialScale={1}
                                    minScale={0.5}
                                    maxScale={10}
                                    centerOnInit={true}
                                    wheel={{ step: 0.1 }}
                                    doubleClick={{ disabled: false, step: 2 }}
                                    pinch={{ step: 5 }}
                                  >
                                    <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex items-center justify-center">
                                      <img
                                        src={media.content}
                                        className="max-w-full max-h-full object-contain pointer-events-auto rounded-xl shadow-2xl"
                                        draggable={false}
                                      />
                                    </TransformComponent>
                                  </TransformWrapper>
                                </div>
                              )}
                              {media.fileType === "video" && (
                                <VideoPlayer media={media} isSelected={isSelected} />
                              )}
                              {media.fileType === "audio" && (
                                <AudioPlayer media={media} isSelected={isSelected} />
                              )}
                              {media.fileType === "pdf" && (
                                <div className="w-full h-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl flex flex-col relative select-none">
                                  <PdfViewer url={media.content} />
                                </div>
                              )}
                              {media.fileType === "text_file" && (
                                <div className="w-[90%] h-[90%] max-w-5xl bg-[#1e1e1e] rounded-3xl overflow-hidden shadow-2xl flex flex-col relative z-[12005]">
                                  <div className="flex-1 overflow-auto p-6 md:p-10 text-xs sm:text-sm font-mono text-slate-300 whitespace-pre-wrap select-text selection:bg-indigo-500/30 selection:text-white">
                                    <TextFileViewer url={media.content} />
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  </AnimatePresence>,
                  document.body
                )}
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
