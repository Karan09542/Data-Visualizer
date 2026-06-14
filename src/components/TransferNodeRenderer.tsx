import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
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
  timestamp: number;
}

export const TransferNodeRenderer: React.FC<{
  node: HierarchyPointNode<TreeNode>;
  isSelected?: boolean;
}> = ({ node, isSelected }) => {
  const { data: treeData, setData, appTheme, setNotification } = useStore();
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

          scanIntervalRef.current = setInterval(() => {
            if (node.readyState === node.HAVE_ENOUGH_DATA && ctx) {
              // Downscale for faster QR detection
              const width = Math.min(node.videoWidth, 600);
              const height = (node.videoHeight / node.videoWidth) * width;

              canvas.width = width;
              canvas.height = height;
              ctx.drawImage(node, 0, 0, width, height);

              const imageData = ctx.getImageData(0, 0, width, height);
              const code = jsQR(
                imageData.data,
                imageData.width,
                imageData.height,
                {
                  inversionAttempts: "dontInvert",
                },
              );
              if (code && code.data) {
                handleScan(code.data);
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
  const [copyPasteOffer, setCopyPasteOffer] = useState("");
  const [copyPasteAnswer, setCopyPasteAnswer] = useState("");

  const CHUNK_SIZE = 16384;

  const sendLargeMessage = async (
    type: string,
    payloadStr: string,
    fileName?: string,
  ) => {
    if (!dcRef.current || dcRef.current.readyState !== "open") return;
    const msgId = uuidv4();
    const totalChunks = Math.ceil(payloadStr.length / CHUNK_SIZE);

    dcRef.current.send(
      JSON.stringify({
        type: "chunk_start",
        msgId,
        msgType: type,
        totalChunks,
        fileName,
      }),
    );

    for (let i = 0; i < totalChunks; i++) {
      const chunk = payloadStr.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);

      while (dcRef.current.bufferedAmount > 1024 * 1024) {
        await new Promise((r) => setTimeout(r, 10));
      }

      dcRef.current.send(
        JSON.stringify({
          type: "chunk_data",
          msgId,
          chunkIndex: i,
          chunk,
        }),
      );

      setTransferProgress(Math.floor(((i + 1) / totalChunks) * 100));
    }

    setTransferProgress(0);
  };

  const initPeer = () => {
    if (pcRef.current) pcRef.current.close();

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

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
        if (msg.type === "text") {
          setMessages((prev) => [
            ...prev,
            {
              id: uuidv4(),
              sender: "remote",
              type: "text",
              content: msg.content,
              timestamp: Date.now(),
            },
          ]);
        } else if (msg.type === "chunk_start") {
          chunksRef.current[msg.msgId] = {
            type: msg.msgType,
            fileName: msg.fileName,
            total: msg.totalChunks,
            received: new Array(msg.totalChunks),
            count: 0,
          };
          setConnectionState("transferring");
        } else if (msg.type === "chunk_data") {
          const chunkData = chunksRef.current[msg.msgId];
          if (chunkData) {
            chunkData.received[msg.chunkIndex] = msg.chunk;
            chunkData.count++;
            setTransferProgress(
              Math.floor((chunkData.count / chunkData.total) * 100),
            );

            if (chunkData.count === chunkData.total) {
              const fullPayload = chunkData.received.join("");
              delete chunksRef.current[msg.msgId];
              setTransferProgress(0);
              setConnectionState("connected");

              if (chunkData.type === "workspace") {
                try {
                  const parsed = JSON.parse(fullPayload);
                  setData(parsed);
                  setNotification({
                    message: "Received and loaded workspace!",
                    type: "success",
                  });
                } catch (err) {}
              } else if (chunkData.type === "file") {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: uuidv4(),
                    sender: "remote",
                    type: "file",
                    fileName: chunkData.fileName,
                    content: fullPayload,
                    timestamp: Date.now(),
                  },
                ]);
              }
            }
          }
        } else if (msg.type === "file") {
          setMessages((prev) => [
            ...prev,
            {
              id: uuidv4(),
              sender: "remote",
              type: "file",
              fileName: msg.fileName,
              content: msg.content,
              timestamp: Date.now(),
            },
          ]);
        } else if (msg.type === "workspace") {
          try {
            const parsed = JSON.parse(msg.content);
            setData(parsed);
            setNotification({
              message: "Received and loaded workspace!",
              type: "success",
            });
          } catch (err) {}
        }
      } catch (err) {}
    };
  };

  const generateOffer = async () => {
    setIsHosting(true);
    const pc = initPeer();
    const dc = pc.createDataChannel("transfer");
    handleDataChannel(dc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await new Promise<void>((resolve) => {
      if (pc.iceGatheringState === "complete") return resolve();
      const timeout = setTimeout(resolve, 2000);
      pc.onicecandidate = (e) => {
        if (!e.candidate) {
          clearTimeout(timeout);
          resolve();
        }
      };
    });

    const currentDesc = pc.localDescription;
    if (currentDesc) {
      const payload = JSON.stringify(currentDesc);
      const compressed = LZString.compressToBase64(payload);
      setOfferQR(compressed);
      setConnectionState("pairing");
    }
  };

  const handleScan = (code: string) => {
    if (!code) return;
    try {
      const uncompressed = LZString.decompressFromBase64(code);
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
    const pc = initPeer();
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await new Promise<void>((resolve) => {
      if (pc.iceGatheringState === "complete") return resolve();
      const timeout = setTimeout(resolve, 2000);
      pc.onicecandidate = (e) => {
        if (!e.candidate) {
          clearTimeout(timeout);
          resolve();
        }
      };
    });

    const currentDesc = pc.localDescription;
    if (currentDesc) {
      const payload = JSON.stringify(currentDesc);
      const compressed = LZString.compressToBase64(payload);
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
    const msg: Message = {
      id: uuidv4(),
      sender: "me",
      type: "text",
      content: chatInput,
      timestamp: Date.now(),
    };
    dcRef.current.send(JSON.stringify(msg));
    setMessages((prev) => [...prev, msg]);
    setChatInput("");
  };

  const sendWorkspace = () => {
    if (!dcRef.current || dcRef.current.readyState !== "open") return;
    const wsStr = JSON.stringify(treeData);
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
          </motion.div>
        )}

        {connectionState === "pairing" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-6 py-2"
          >
            <div className="p-4 bg-white rounded-3xl shadow-xl">
              <QRCodeSVG
                value={offerQR || answerQR}
                size={240}
                level="L"
                marginSize={1}
              />
            </div>

            <div className="text-center space-y-1">
              <p className="text-sm font-bold text-white">
                Device Pairing Required
              </p>
              <p className="text-xs text-slate-500">
                Scan this code on the other device to link
              </p>
            </div>

            <div className="w-full flex flex-col gap-2">
              <div
                className={`flex gap-2 p-1.5 rounded-xl border ${isDark ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100"}`}
              >
                <input
                  type="text"
                  placeholder={
                    offerQR ? "Paste answer code..." : "Paste offer code..."
                  }
                  className="flex-1 bg-transparent text-xs px-3 focus:outline-none"
                  value={offerQR ? copyPasteAnswer : copyPasteOffer}
                  onChange={(e) =>
                    offerQR
                      ? setCopyPasteAnswer(e.target.value)
                      : setCopyPasteOffer(e.target.value)
                  }
                />
                <button
                  onClick={() =>
                    handleScan(offerQR ? copyPasteAnswer : copyPasteOffer)
                  }
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                >
                  Verify
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    navigator.clipboard.writeText(offerQR || answerQR)
                  }
                  className={`flex-1 py-3 px-4 rounded-xl border flex items-center justify-center gap-2 text-[10px] font-bold uppercase transition-all ${
                    isDark
                      ? "border-white/5 bg-white/5 hover:bg-white/10"
                      : "border-slate-100 bg-slate-50 hover:bg-slate-100"
                  }`}
                >
                  <Copy className="w-3.5 h-3.5" /> Copy String
                </button>
                <button
                  onClick={resetState}
                  className={`flex-1 py-3 px-4 rounded-xl border flex items-center justify-center gap-2 text-[10px] font-bold uppercase transition-all ${
                    isDark
                      ? "border-red-500/20 text-red-400 hover:bg-red-500/10"
                      : "border-red-200 text-red-600 hover:bg-red-50"
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {(connectionState === "connected" ||
          connectionState === "transferring") &&
          (() => {
            const content = (
              <div
                className={`flex flex-col ${isFullscreen ? "w-full max-w-4xl mx-auto h-full p-6" : "h-[320px]"}`}
              >
                {isFullscreen && (
                  <div
                    className={`flex items-center justify-between mb-6 p-4 rounded-xl border ${isDark ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200"}`}
                  >
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
                          <Activity className="w-3 h-3 text-emerald-500" /> P2P
                          Secure Connection
                        </p>
                      </div>
                    </div>
                    <div
                      className={`px-2.5 py-1 mr-4 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        connectionState === "connected"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-blue-500/10 text-blue-500"
                      }`}
                    >
                      {connectionState}
                    </div>
                  </div>
                )}

                {/* Messages Area */}
                <div
                  className={`flex-1 overflow-y-auto mb-4 space-y-4 pr-1 scrollbar-thin ${isDark ? "scrollbar-dark" : "scrollbar-light"}`}
                >
                  <AnimatePresence initial={false}>
                    {messages.length === 0 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="h-full flex flex-col items-center justify-center text-center px-8 gap-4"
                      >
                        <div
                          className={`p-4 rounded-full ${isDark ? "bg-white/5 text-slate-600" : "bg-slate-50 text-slate-400"}`}
                        >
                          <MessageSquare className="w-10 h-10" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-400">
                            Direct Link Active
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Ready to transfer files, nodes, and workspace data
                          </p>
                        </div>
                      </motion.div>
                    )}
                    {messages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{
                          opacity: 0,
                          x: msg.sender === "me" ? 20 : -20,
                        }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`flex flex-col ${msg.sender === "me" ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`group relative max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm transition-all ${
                            msg.sender === "me"
                              ? "bg-indigo-600 text-white rounded-tr-none"
                              : isDark
                                ? "bg-[#161f30] text-slate-200 rounded-tl-none border border-white/5"
                                : "bg-slate-100 text-slate-800 rounded-tl-none"
                          }`}
                        >
                          {msg.type === "text" ? (
                            msg.content
                          ) : (
                            <div className="flex items-center gap-3 py-1">
                              <div
                                className={`p-2 rounded-lg ${msg.sender === "me" ? "bg-white/20" : isDark ? "bg-indigo-500/10 text-indigo-400" : "bg-indigo-50 text-indigo-600"}`}
                              >
                                <File className="w-5 h-5" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-[11px] font-bold truncate leading-none mb-1">
                                  {msg.fileName}
                                </span>
                                <span className="text-[9px] opacity-70 uppercase tracking-tighter">
                                  Received File
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                        <span className="text-[9px] text-slate-500 mt-1.5 px-1 font-medium">
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Progress Bar for transfers */}
                {transferProgress > 0 && (
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-1.5 px-1">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                        <RefreshCw className="w-3 h-3 animate-spin" />{" "}
                        {connectionState === "transferring"
                          ? "Syncing Workspace..."
                          : "Sending File..."}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500">
                        {transferProgress}%
                      </span>
                    </div>
                    <div
                      className={`h-1.5 w-full rounded-full overflow-hidden ${isDark ? "bg-white/5" : "bg-slate-100"}`}
                    >
                      <motion.div
                        className="h-full bg-indigo-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${transferProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      onClick={sendWorkspace}
                      disabled={connectionState === "transferring"}
                      className={`flex-1 flex gap-2 items-center justify-center py-3 rounded-xl text-[10px] font-bold uppercase transition-all border ${
                        isDark
                          ? "border-white/5 bg-white/5 hover:bg-white/10 hover:border-indigo-500/30"
                          : "border-slate-100 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200"
                      } disabled:opacity-50`}
                    >
                      <Globe className="w-3.5 h-3.5 text-indigo-500" /> Sync
                      Project
                    </button>
                    <label
                      className={`flex-1 flex gap-2 items-center justify-center py-3 rounded-xl text-[10px] font-bold uppercase transition-all border cursor-pointer ${
                        isDark
                          ? "border-white/5 bg-white/5 hover:bg-white/10 hover:border-emerald-500/30"
                          : "border-slate-100 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200"
                      }`}
                    >
                      <UploadCloud className="w-3.5 h-3.5 text-emerald-500" />{" "}
                      Send Assets
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file || !dcRef.current) return;
                          const reader = new FileReader();
                          reader.onload = (re) => {
                            const content = re.target?.result as string;
                            sendLargeMessage("file", content, file.name);
                            setMessages((prev) => [
                              ...prev,
                              {
                                id: uuidv4(),
                                sender: "me",
                                type: "file",
                                fileName: file.name,
                                content: "",
                                timestamp: Date.now(),
                              },
                            ]);
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <div
                      className={`flex-1 flex items-center rounded-xl p-1 border transition-all ${
                        isDark
                          ? "bg-[#161f30] border-white/5 focus-within:border-indigo-500/50"
                          : "bg-slate-50 border-slate-100 focus-within:border-indigo-500"
                      }`}
                    >
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                        placeholder="Type a secure message..."
                        className="flex-1 bg-transparent px-3 py-2 text-xs focus:outline-none placeholder:text-slate-500"
                      />
                      <button
                        onClick={sendMessage}
                        className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/20"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      className={`p-3 rounded-xl border transition-all ${isDark ? "border-white/5 bg-white/5 hover:bg-white/10 text-slate-500" : "border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-400"}`}
                      title={isFullscreen ? "Minimize" : "Maximize"}
                    >
                      {isFullscreen ? (
                        <Minimize className="w-4 h-4" />
                      ) : (
                        <Maximize className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={resetState}
                      className={`p-3 rounded-xl border transition-all ${isDark ? "border-red-500/10 text-red-400 hover:bg-red-500/20" : "border-red-100 bg-red-50 hover:bg-red-100 text-red-500"}`}
                      title="Disconnect"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );

            return isFullscreen
              ? createPortal(
                  <div
                    className={`fixed inset-0 z-[10000] backdrop-blur-sm p-4 sm:p-8 flex items-center justify-center ${isDark ? "bg-black/80" : "bg-slate-900/50"}`}
                  >
                    <div
                      className={`w-full h-full max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${isDark ? "bg-[#0d1017] border-white/10" : "bg-white border-slate-200"}`}
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
