import { formatFileSize as sharedFormatFileSize } from "../lib/formatFileSize";
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
import { InteractiveZoomImage } from "./InteractiveZoomImage";
import MediaCarousel from "./MediaCarousel";

const makeCRCTable = () => {
  let c;
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c;
  }
  return crcTable;
};

const crcTable = makeCRCTable();

const crc32 = (buffer: ArrayBuffer | Uint8Array, crc = 0) => {
  let c = crc ^ -1;
  const u8 = new Uint8Array(buffer);
  for (let i = 0; i < u8.length; i++) {
    c = (c >>> 8) ^ crcTable[(c ^ u8[i]) & 0xFF];
  }
  return (c ^ -1) >>> 0;
};

async function getFilesFromEntry(entry: any, path = ""): Promise<{ file: File, path: string }[]> {
  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file((file: File) => resolve([{ file, path: path + file.name }]));
    });
  } else if (entry.isDirectory) {
    const dirReader = entry.createReader();
    let entries: any[] = [];

    const readEntries = async (): Promise<any[]> => {
      return new Promise((resolve) => {
        dirReader.readEntries(async (results: any[]) => {
          if (results.length) {
            entries = entries.concat(results);
            resolve(entries.concat(await readEntries()));
          } else {
            resolve(entries);
          }
        });
      });
    };
    const allEntries = await readEntries();

    let files: { file: File, path: string }[] = [];
    for (const e of allEntries) {
      files = files.concat(await getFilesFromEntry(e, path + entry.name + "/"));
    }
    return files;
  }
  return [];
}

import {
  Copy,
  Plus,
  Image as ImageIcon,
  Send,
  MessageSquare,
  X,
  RefreshCw,
  Download,
  Check,
  File as FileIcon,
  Share2,
  Laptop,
  Smartphone,
  ChevronRight,
  Activity,
  Maximize,
  Minimize,
  Trash2,
  Edit2,
  Play,
  Pause,
  Volume2,
  FileText,
  Clock,
  Eye,
  ClipboardPaste,
  Clipboard,
  QrCode,
  LogIn,
  Scan,
  CornerDownRight,
  LogOut,
  RotateCw,
  Settings,
  Box,
  Server,
  Star,
  Radio,
  RotateCcw,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { motion, AnimatePresence } from "motion/react";
import { NodeOptionsMenu } from "./NodeOptionsMenu";
import { useAuthStore } from "../store/useAuthStore";
import { io, Socket } from "socket.io-client";
import { SafeModelViewer } from "./SafeModelViewer";

export interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  content: string; // Object URL locally, base64 when sent
  originalBlob?: Blob;
}

const FilePreviewCard = React.memo(({ file, onRemove, onCopy, copyStatusObj, readonly = false, layout = "composer" }: { file: File | Attachment, onRemove?: () => void, onCopy?: () => void, copyStatusObj?: { id: string, status: string } | null, readonly?: boolean, layout?: "composer" | "grid" | "list" | "single-grid" }) => {
  const isFileObj = file instanceof File;
  const fileName = isFileObj ? file.name : (file as Attachment).fileName;
  const fileSize = isFileObj ? file.size : (file as Attachment).fileSize;
  const fType = isFileObj ? getFileType(file.name) : (file as Attachment).fileType;

  const [localUrl, setLocalUrl] = useState<string | null>(null);

  useEffect(() => {
    if (file instanceof File) {
      const url = URL.createObjectURL(file);
      setLocalUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  const content = file instanceof File ? localUrl : (file as Attachment).content;
  const sizeClasses = layout === "grid"
    ? (fType === "image" || fType === "video" || fType === "3d_model" ? "w-full min-w-[120px] aspect-square" : "w-full p-2.5 flex items-center gap-3")
    : layout === "single-grid"
      ? (fType === "3d_model" ? "w-full min-w-[200px] sm:min-w-[280px] aspect-square max-h-[240px]" : fType === "image" || fType === "video" ? "w-full h-[350px]" : "w-full p-2.5 flex items-center gap-3")
      : layout === "list"
        ? "w-full p-2.5 flex items-center gap-3"
        : (fType === "image" || fType === "video" || fType === "3d_model" ? "w-32 h-32" : "w-48 p-2.5 flex items-center gap-3");

  return (
    <div className={`relative group ${layout === "composer" ? "shrink-0" : ""} rounded-lg overflow-hidden border border-slate-700/50 bg-slate-800/50 ${sizeClasses}`}>
      {fType === "image" && content && (
        <>
          <img src={content} alt={fileName} className="w-full h-full object-cover" />
          {layout === "composer" && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-4 flex items-end">
              <span className="text-[10px] font-bold text-white truncate w-full drop-shadow-md">
                {fileName}
              </span>
            </div>
          )}
        </>
      )}
      {fType === "video" && content && (
        <>
          <video src={content} preload="metadata" muted playsInline className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
            <Play className="w-8 h-8 text-white opacity-80" />
          </div>
        </>
      )}
      {fType === "3d_model" && content && (
        <>
          <div className="w-full h-full bg-[#1e293b]">
            <SafeModelViewer
              src={content}
              alt={fileName}
              autoRotate={true}
              cameraControls={false}
              showControls={false}
            />
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
            <Box className="w-8 h-8 text-white opacity-80" />
          </div>
        </>
      )}
      {fType === "audio" && (
        <>
          <div className="w-10 h-10 rounded bg-indigo-500/20 flex items-center justify-center shrink-0">
            <Volume2 className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-slate-200 truncate">{fileName}</div>
            <div className="text-xs text-slate-400">{formatFileSize(fileSize)}</div>
          </div>
        </>
      )}
      {fType === "pdf" && (
        <>
          <div className="w-10 h-10 rounded bg-red-500/20 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-slate-200 truncate">{fileName}</div>
            <div className="text-xs text-slate-400">{formatFileSize(fileSize)}</div>
          </div>
        </>
      )}
      {fType !== "image" && fType !== "video" && fType !== "3d_model" && fType !== "audio" && fType !== "pdf" && (
        <>
          <div className="w-10 h-10 rounded bg-slate-500/20 flex items-center justify-center shrink-0">
            <FileIcon className="w-5 h-5 text-slate-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-slate-200 truncate">{fileName}</div>
            <div className="text-xs text-slate-400">{formatFileSize(fileSize)}</div>
          </div>
        </>
      )}

      {/* Action Buttons Container */}
      <div className="absolute top-1 right-1 flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-20">
        {onCopy && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCopy();
            }}
            className="w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
          >
            {copyStatusObj?.id === (file as Attachment).id && copyStatusObj.status === "success" ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        )}
        {!readonly && onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="w-7 h-7 rounded-full bg-black/60 hover:bg-red-500 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Footer Info for Image/Video/3D */}
      {(fType === "image" || fType === "video" || fType === "3d_model") && (
        <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
          <div className="text-[10px] text-white/90 truncate">{fileName}</div>
        </div>
      )}
    </div>
  );
});

interface Message {
  id: string;
  sender: "me" | "remote";
  type: "text" | "file" | "composite" | "node" | "workspace" | "file_offer";
  content: string;
  attachments?: Attachment[];
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
    attachments?: Attachment[];
  };
  originalBlob?: Blob;
  isDeleted?: boolean;
  isEdited?: boolean;
  streamState?: "offered" | "transferring" | "paused" | "canceled" | "completed" | "error";
  streamProgress?: number;
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
  if (["glb", "gltf", "obj", "fbx", "stl"].includes(ext || ""))
    return "3d_model";
  return "file";
};

const formatFileSize = (bytes: number) => sharedFormatFileSize(bytes, 'B', 1);

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

const getMimeType = (fileName: string, parsedMime?: string) => {
  if (parsedMime && parsedMime !== "application/octet-stream" && parsedMime !== "") {
    return parsedMime;
  }
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "gif": return "image/gif";
    case "webp": return "image/webp";
    case "svg": return "image/svg+xml";
    case "mp4": return "video/mp4";
    case "webm": return "video/webm";
    case "ogg": return "video/ogg";
    case "mov": return "video/mp4"; // map .mov to video/mp4 as browsers decode video/mp4 with standard H.264 profiles much better
    case "mp3": return "audio/mp3";
    case "wav": return "audio/wav";
    case "m4a": return "audio/mp4";
    case "flac": return "audio/flac";
    case "pdf": return "application/pdf";
    case "txt": return "text/plain";
    case "md": return "text/markdown";
    case "json": return "application/json";
    case "csv": return "text/csv";
    default: return parsedMime || "application/octet-stream";
  }
};

const dataURItoBlobURL = (dataURI: string, fileName?: string) => {
  try {
    const splitIndex = dataURI.indexOf(",");
    if (splitIndex === -1) return dataURI; // might be already an object url or plain text string
    const byteString = atob(dataURI.slice(splitIndex + 1));
    const parsedMIME = dataURI.slice(0, splitIndex).split(":")[1].split(";")[0];
    const mimeString = fileName ? getMimeType(fileName, parsedMIME) : parsedMIME;
    const ab = new ArrayBuffer(byteString.length);
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
    if (isSelected) ref.current?.play().catch(() => { });
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

const VideoPlayer = ({ media, isSelected }: { media: Message; isSelected: boolean }) => {
  const ref = useRef<HTMLVideoElement>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  useEffect(() => {
    if (isSelected) {
      ref.current?.play().catch(() => { });
    } else {
      ref.current?.pause();
      if (ref.current) {
        ref.current.currentTime = 0;
      }
    }
  }, [isSelected]);

  const originalBlob = blobRegistry.get(media.content);
  const mimeType = originalBlob?.type || "video/mp4";

  return (
    <div className="w-full h-full relative flex flex-col items-center justify-center p-4">
      {errorDetails && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500/20 text-red-300 border border-red-500/30 px-3 py-1.5 text-xs font-bold rounded-full z-20 backdrop-blur-md">
          {errorDetails}
        </div>
      )}
      <video
        key={media.content}
        ref={ref}
        controls
        playsInline
        className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl pointer-events-auto"
        src={media.content}
        onError={() => {
          setErrorDetails("Codec unsupported in browser. Try Downloading.");
        }}
      >
        <source src={media.content} type={mimeType} />
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

export const TransferNodeRenderer: React.FC<{
  node: HierarchyPointNode<TreeNode>;
}> = ({ node }) => {
  const setCode = useStore((state) => state.setCode);
  const appTheme = useStore((state) => state.appTheme);
  const setNotification = useStore((state) => state.setNotification);
  const nodeKey = node.data.path.split(".").pop() || "transfer";
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
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  const [chatInputFocused, setChatInputFocused] = useState(false);

  // Auth & Signaling State
  const { user, token, getIsLoggedIn } = useAuthStore();
  const isLoggedIn = getIsLoggedIn();
  const [autoConnectAttempted, setAutoConnectAttempted] = useState(false);
  const [lastConnectedEmail, setLastConnectedEmail] = useState<string | null>(() => {
    return localStorage.getItem("transfer-last-connected") || null;
  });
  const [connectionHistory, setConnectionHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("transfer-history") || "[]");
    } catch { return []; }
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [onlinePresence, setOnlinePresence] = useState<Record<string, boolean>>({});
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const signalingSocketRef = useRef<Socket | null>(null);
  const [targetRemoteEmail, setTargetRemoteEmail] = useState<string | null>(null);

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
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [zippingTasks, setZippingTasks] = useState<{ id: string, folderName: string, progress?: number }[]>([]);
  const zipWorkerRef = useRef<Worker | null>(null);

  useEffect(() => {
    zipWorkerRef.current = new Worker(new URL('../workers/zipWorker', import.meta.url), { type: 'module' });
    zipWorkerRef.current.onmessage = (e) => {
      const { id, zipFile, error, progress } = e.data;
      if (progress !== undefined) {
        setZippingTasks(prev => prev.map(t => t.id === id ? { ...t, progress } : t));
        return;
      }
      setZippingTasks(prev => prev.filter(t => t.id !== id));
      if (zipFile) {
        setPendingFiles(prev => [...prev, zipFile]);
      } else if (error) {
        console.error("Zipping error:", error);
      }
    };
    return () => {
      zipWorkerRef.current?.terminate();
    };
  }, []);

  // Socket.io Signaling
  useEffect(() => {
    if (!isLoggedIn || !token) return;

    const serverUrl = import.meta.env.DEV ? window.location.origin : "https://datavisualizer-signalling-server.onrender.com";
    const socket = io(serverUrl, {
      auth: { token },
      transports: ["websocket"],
    });

    signalingSocketRef.current = socket;

    socket.on("connect", () => {
      console.log("Signaling connected as", user?.email);
      // Auto-connect to default target if available and enabled
      if (user?.defaultTargetEmail) {
        setTimeout(() => {
          handleAutoConnect(user.defaultTargetEmail!);
        }, 1000);
      }
    });

    socket.on("webrtc-offer", async (data: any) => {
      await handleServerOffer(data);
    });

    socket.on("webrtc-reject", () => {
      if (pcRef.current) pcRef.current.close();
      setConnectionState("waiting");
      setOfferQR("");
      setAnswerQR("");
      setScanMode(null);
      setIsHosting(false);
      setNotification({ message: "Connection request was declined", type: "error" });
    });

    socket.on("webrtc-answer", async (data: { from: string; answer: RTCSessionDescriptionInit }) => {
      await handleServerAnswer(data);
    });

    socket.on("webrtc-ice-candidate", async (data: { from: string; candidate: RTCIceCandidateInit }) => {
      await handleServerIceCandidate(data);
    });

    socket.on("user-profile-updated", (userData: any) => {
      const { updateUser } = useAuthStore.getState();
      updateUser(userData);
    });

    return () => {
      socket.disconnect();
    };
  }, [isLoggedIn, token, user]);
  const [copyPasteOffer, setCopyPasteOffer] = useState("");
  const [copyPasteAnswer, setCopyPasteAnswer] = useState("");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidatesRef = useRef<Record<string, RTCIceCandidateInit[]>>({});

  const flushPendingCandidates = async (pc: RTCPeerConnection, targetSocketId?: string) => {
    const key = targetSocketId || "default";
    const candidates = pendingCandidatesRef.current[key] || [];
    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn("[WebRTC] Error adding queued ice candidate:", e);
      }
    }
    pendingCandidatesRef.current[key] = [];
  };

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

  const outgoingStreamsRef = useRef<Record<string, {
    file: File;
    offset: number;
    paused: boolean;
    canceled: boolean;
    checksum: number; // simple CRC or similar
  }>>({});

  const incomingStreamsRef = useRef<Record<string, {
    handle: any;
    stream: any; // FileSystemWritableFileStream
    received: number;
    total: number;
    checksum: number;
  }>>({});

  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);

  const activeTransferIdRef = useRef<string | null>(null);
  const cancelTokensRef = useRef<Set<string>>(new Set());

  const [transferProgress, setTransferProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<"chat" | "media">("chat");
  const [autoClipboardSync, setAutoClipboardSync] = useState(false);
  const [largeFileMode, setLargeFileMode] = useState(false);
  const lastClipboardTextRef = useRef<string>("");
  const lastClipboardImageRef = useRef<string>("");
  const autoClipboardSyncRef = useRef(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatScrollPosRef = useRef<number>(0);

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
    autoClipboardSyncRef.current = autoClipboardSync;
  }, [autoClipboardSync]);

  useEffect(() => {
    if (!autoClipboardSync) return;

    const syncClipboard = async () => {
      try {
        if (!navigator.clipboard) return;

        let hasNewData = false;

        // Try reading items (images, etc)
        let newImageFiles: File[] = [];
        try {
          const items = await navigator.clipboard.read();
          for (const item of items) {
            let itemHandled = false;
            for (const type of item.types) {
              if (type === 'text/plain' || type === 'text/html') continue;

              try {
                const blob = await item.getType(type);
                const sizeKey = `${blob.size}-${type}`;
                if (lastClipboardImageRef.current !== sizeKey) {
                  lastClipboardImageRef.current = sizeKey;
                  let ext = type.split('/')[1] || 'bin';
                  if (ext === 'jpeg') ext = 'jpg';
                  if (ext === 'svg+xml') ext = 'svg';

                  const prefix = type.startsWith('image/') ? 'image' : 'file';
                  const file = new File([blob], `clipboard-${prefix}.${ext}`, { type });
                  newImageFiles.push(file);
                  hasNewData = true;
                  itemHandled = true;
                }
              } catch (e) { }

              if (itemHandled) break;
            }
          }
        } catch (e) {
          // Ignore read errors
        }

        // Try reading text
        let newText = "";
        try {
          const text = await navigator.clipboard.readText();
          if (text && text.trim() && text !== lastClipboardTextRef.current) {
            lastClipboardTextRef.current = text;
            newText = text;
            hasNewData = true;
          }
        } catch (e) {
          // Ignore read errors
        }

        if (hasNewData && dcRef.current && dcRef.current.readyState === "open") {
          if (newImageFiles.length > 0) {
            const msgId = uuidv4();
            const attachments: Attachment[] = [];
            const compositePayloadAttachments: any[] = [];

            for (const file of newImageFiles) {
              const fileContent = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.readAsDataURL(file);
              });

              const fType = getFileType(file.name);
              const objectUrl = URL.createObjectURL(file);
              blobRegistry.set(objectUrl, file);

              const attId = uuidv4();
              attachments.push({
                id: attId,
                fileName: file.name,
                fileSize: file.size,
                fileType: fType,
                content: objectUrl,
                originalBlob: file
              });

              compositePayloadAttachments.push({
                id: attId,
                fileName: file.name,
                fileSize: file.size,
                fileType: fType,
                content: fileContent
              });
            }

            const compositePayload = {
              content: newText,
              attachments: compositePayloadAttachments
            };

            const localMsgOverride: Message = {
              id: msgId,
              sender: "me",
              type: "composite",
              content: newText,
              attachments,
              timestamp: Date.now(),
              status: "sending",
              chunksSent: 0,
              chunksTotal: 0
            };

            await sendLargeMessage(
              "composite",
              JSON.stringify(compositePayload),
              undefined,
              undefined,
              undefined,
              localMsgOverride
            );
          } else if (newText.trim()) {
            await sendLargeMessage("text", newText);
          }
        }
      } catch (err) {
        // Ignore overall errors
      }
    };

    window.addEventListener("focus", syncClipboard);

    // We can also poll gently while active, or rely on focus.
    const interval = setInterval(() => {
      if (document.hasFocus()) syncClipboard();
    }, 1500);

    return () => {
      window.removeEventListener("focus", syncClipboard);
      clearInterval(interval);
    };
  }, [autoClipboardSync]);

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
    const isHidden = document.visibilityState === "hidden" || !document.hasFocus();

    if (isHidden) {
      playNotificationSound();
    }

    if (
      isHidden &&
      notificationPermission === "granted"
    ) {
      try {
        const notification = new Notification(title, { body, icon: "/app-icon.png" });
        notification.onclick = () => {
          window.focus();
        };
      } catch (e) {
        console.warn("Notification failed", e);
      }
    }
  };

  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(587.33, audioContext.currentTime); // D5
      oscillator.frequency.exponentialRampToValueAtTime(880.00, audioContext.currentTime + 0.1); // A5

      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      console.warn("Sound play failed", e);
    }
  };

  // Flash tab title on unread messages
  useEffect(() => {
    const APP_TITLE = "JSON YAML TREE viewer";
    if (unreadCount === 0) {
      document.title = APP_TITLE;
      return;
    }

    let isFlash = false;
    const interval = setInterval(() => {
      document.title = isFlash ? `(${unreadCount}) New Message!` : APP_TITLE;
      isFlash = !isFlash;
    }, 1000);

    return () => {
      clearInterval(interval);
      document.title = APP_TITLE;
    };
  }, [unreadCount]);

  useEffect(() => {
    const handleFocus = () => {
      if (viewMode === "chat" && isAtBottom) {
        setUnreadCount(0);
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [viewMode, isAtBottom]);

  const [selectedMedia, setSelectedMedia] = useState<Message | null>(null);
  const [showChrome, setShowChrome] = useState(true);
  const [copyStatus, setCopyStatus] = useState<{ id: string, status: "copying" | "success" } | null>(null);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (selectedMedia && showChrome) {
      timeout = setTimeout(() => setShowChrome(false), 3000);
    }
    return () => clearTimeout(timeout);
  }, [selectedMedia, showChrome]);

  const [imageRotation, setImageRotation] = useState(0);
  useEffect(() => {
    setImageRotation(0);
  }, [selectedMedia?.id]);

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

  useEffect(() => {
    if (selectedMedia) {
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setSelectedMedia(null);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          const mediaMsgs = messages.reduce<any[]>((acc, m) => {
            if (m.type === "file") {
              acc.push(m);
            }
            if (m.type === "composite" && m.attachments) {
              m.attachments.forEach(att => {
                acc.push({ ...att, sender: m.sender, timestamp: m.timestamp });
              });
            }
            if (m.type === "file_offer" && m.content) {
              acc.push(m);
            }
            return acc;
          }, []);
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
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedMedia, messages]);
  const [showContextMenu, setShowContextMenu] = useState<{
    id: string;
    x: number;
    y: number;
    attachment?: any;
  } | null>(null);

  const [pairingMode, setPairingMode] = useState<"local" | "universal">(
    "local",
  );
  const [pairingWorkflow, setPairingWorkflow] = useState<"qr" | "manual" | "signaling">("qr");
  const [clipboardDetectedSdp, setClipboardDetectedSdp] = useState<
    string | null
  >(null);
  const [qrDensity, setQrDensity] = useState<"L" | "M" | "Q" | "H">("L");
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [isFullscreenQR, setIsFullscreenQR] = useState(false);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [copiedSDP, setCopiedSDP] = useState(false);

  useEffect(() => {
    if (!signalingSocketRef.current || !isLoggedIn || !user || pairingWorkflow !== "signaling" || connectionState !== "waiting") return;
    const socket = signalingSocketRef.current;

    const checkPresence = () => {
      if (!socket.connected) return;
      const emailsToCheck = [user.email];
      if (user.defaultTargetEmail) emailsToCheck.push(user.defaultTargetEmail);
      if (lastConnectedEmail) emailsToCheck.push(lastConnectedEmail);
      socket.emit('check-presence', emailsToCheck);
    };

    socket.on('presence-result', (presence: Record<string, boolean>) => {
      setOnlinePresence(presence);
    });

    checkPresence();
    const interval = setInterval(checkPresence, 5000);

    return () => {
      socket.off('presence-result');
      clearInterval(interval);
    };
  }, [isLoggedIn, user, lastConnectedEmail, pairingWorkflow, connectionState]);

  useEffect(() => {
    // Auto-connect on load if enabled and target is online
    if (user?.autoConnectEnabled && user?.defaultTargetEmail && !autoConnectAttempted) {
      if (onlinePresence[user.defaultTargetEmail] !== undefined) {
        setAutoConnectAttempted(true);
        if (onlinePresence[user.defaultTargetEmail] === true) {
          initiateServerConnection(user.defaultTargetEmail);
        }
      }
    }
  }, [user?.autoConnectEnabled, user?.defaultTargetEmail, autoConnectAttempted, onlinePresence]);

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

  const processNextChunk = async (msgId: string) => {
    const stream = outgoingStreamsRef.current[msgId];
    if (!stream || stream.paused || stream.canceled || !dcRef.current || dcRef.current.readyState !== "open") return;

    if (stream.offset >= stream.file.size) {
      // Done
      dcRef.current.send(JSON.stringify({ type: "stream_end", msgId, checksum: stream.checksum }));
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: "sent", streamState: "completed" } : m));
      delete outgoingStreamsRef.current[msgId];
      return;
    }

    // Process chunk
    try {
      const CHUNK_SIZE = 65536; // 64KB
      const slice = stream.file.slice(stream.offset, stream.offset + CHUNK_SIZE);
      const arrayBuffer = await slice.arrayBuffer();

      const idBytes = new TextEncoder().encode(msgId);
      const chunkBuffer = new Uint8Array(arrayBuffer);
      const out = new Uint8Array(36 + chunkBuffer.length); // msgId is UUID, 36 bytes
      out.set(idBytes, 0);
      out.set(chunkBuffer, 36);

      dcRef.current.send(out);

      stream.checksum = crc32(chunkBuffer, stream.checksum);
      stream.offset += chunkBuffer.length;

      const progress = Math.floor((stream.offset / stream.file.size) * 100);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, streamProgress: progress } : m));

      // Wait if bufferedAmount is too high
      if (dcRef.current.bufferedAmount < dcRef.current.bufferedAmountLowThreshold) {
        // Can continue immediately
        setTimeout(() => processNextChunk(msgId), 0);
      }
    } catch (err) {
      console.error("Streaming error", err);
      dcRef.current.send(JSON.stringify({ type: "stream_cancel", msgId }));
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: "error", streamState: "canceled" } : m));
      delete outgoingStreamsRef.current[msgId];
    }
  };

  const startFileStream = (file: File, replyData?: any) => {
    if (!dcRef.current || dcRef.current.readyState !== "open") return;
    const msgId = uuidv4();
    const fType = getFileType(file.name);

    outgoingStreamsRef.current[msgId] = {
      file,
      offset: 0,
      paused: false,
      canceled: false,
      checksum: 0,
    };

    const objectUrl = URL.createObjectURL(file);
    blobRegistry.set(objectUrl, file);

    const initialMsg: Message = {
      id: msgId,
      sender: "me",
      type: "file_offer" as any,
      content: objectUrl,
      fileName: file.name,
      fileType: fType,
      fileSize: file.size,
      timestamp: Date.now(),
      status: "sending",
      streamState: "offered",
      streamProgress: 0,
      replyTo: replyData,
    };

    setMessages((prev) => [...prev, initialMsg]);

    dcRef.current.send(
      JSON.stringify({
        type: "stream_offer",
        msgId,
        fileName: file.name,
        fileSize: file.size,
        fileType: fType,
        replyTo: replyData,
      }),
    );
  };

  const sendLargeMessage = async (
    type: string,
    payloadStr: string,
    fileName?: string,
    replyTo?: Message["replyTo"],
    fileBlob?: Blob,
    localMsgOverride?: Message,
  ) => {
    if (!dcRef.current || dcRef.current.readyState !== "open") return;
    const msgId = localMsgOverride ? localMsgOverride.id : uuidv4();
    const totalChunks = Math.ceil(payloadStr.length / CHUNK_SIZE);
    const startTime = performance.now();

    const objectUrl = type === "file" ? dataURItoBlobURL(payloadStr, fileName) : payloadStr;
    const finalBlob = fileBlob || (type === "file" && objectUrl ? blobRegistry.get(objectUrl) : undefined);

    const initialMsg: Message = localMsgOverride
      ? { ...localMsgOverride, chunksTotal: totalChunks }
      : {
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

    if (type === "file" || type === "composite" || type === "text") {
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

    activeTransferIdRef.current = msgId;
    cancelTokensRef.current.add(msgId);

    for (let i = 0; i < totalChunks; i++) {
      if (!cancelTokensRef.current.has(msgId)) {
        dcRef.current.send(JSON.stringify({ type: "chunk_cancel", msgId }));
        setTransferProgress(0);
        setConnectionState("connected");
        if (type === "file" || type === "composite" || type === "text") {
          setMessages((prev) =>
            prev.map((m) => (m.id === msgId ? { ...m, status: "error", streamState: "canceled" } : m)),
          );
        }
        activeTransferIdRef.current = null;
        return;
      }

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

      if (type === "file" || type === "composite" || type === "text") {
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
    cancelTokensRef.current.delete(msgId);
    activeTransferIdRef.current = null;
    setTransferProgress(0);

    if (type === "file" || type === "composite" || type === "text") {
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

    const config: RTCConfiguration = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun.services.mozilla.com" }
      ]
    };

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
    dc.binaryType = "arraybuffer";
    dc.bufferedAmountLowThreshold = 65536; // 64KB

    dc.onbufferedamountlow = () => {
      Object.values(outgoingStreamsRef.current).forEach(stream => {
        if (!stream.paused && !stream.canceled) {
          // We just need the ID. Wait, I didn't save ID inside the object, let's find it
          // Actually, it's the key.
          const msgId = Object.keys(outgoingStreamsRef.current).find(k => outgoingStreamsRef.current[k] === stream);
          if (msgId) processNextChunk(msgId);
        }
      });
    };

    dc.onopen = () => {
      setConnectionState("connected");
      setNotification({
        message: "Direct device connection established!",
        type: "success",
      });
    };
    dc.onmessage = async (e) => {
      if (e.data instanceof ArrayBuffer) {
        const data = new Uint8Array(e.data);
        const msgIdBytes = data.slice(0, 36);
        const msgId = new TextDecoder().decode(msgIdBytes);
        const chunk = data.slice(36);

        const stream = incomingStreamsRef.current[msgId];
        if (stream && stream.stream) {
          try {
            await stream.stream.write(chunk);
            stream.received += chunk.length;
            stream.checksum = crc32(chunk, stream.checksum);

            const progress = Math.floor((stream.received / stream.total) * 100);
            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, streamProgress: progress } : m));
            setTransferProgress(progress);
          } catch (err) {
            console.error("Failed to write chunk", err);
          }
        }
        return;
      }
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

        if (msg.type === "msg_delete") {
          setMessages((prev) => prev.filter((m) => m.id !== msg.msgId));
          return;
        }

        if (msg.type === "chunk_cancel") {
          cancelTokensRef.current.delete(msg.msgId);
          delete chunksRef.current[msg.msgId];
          setTransferProgress(0);
          setConnectionState("connected");
          activeTransferIdRef.current = null;
          setMessages((prev) =>
            prev.map((m) => (m.id === msg.msgId ? { ...m, status: "error", streamState: "canceled" } : m)),
          );
          setNotification({
            message: "Transfer was canceled.",
            type: "warning",
          });
          return;
        }

        if (msg.type === "stream_offer") {
          const newMsg: Message = {
            id: msg.msgId,
            sender: "remote",
            type: "file_offer",
            content: "",
            fileName: msg.fileName,
            fileSize: msg.fileSize,
            fileType: msg.fileType,
            timestamp: Date.now(),
            status: "received",
            streamState: "offered",
            streamProgress: 0,
            replyTo: msg.replyTo,
          };
          setMessages((prev) => [...prev, newMsg]);
          if (!isAtBottom || document.visibilityState === "hidden" || !document.hasFocus()) {
            setUnreadCount((prev) => prev + 1);
            sendLocalNotification("Incoming Large File", msg.fileName || "File");
          }
          return;
        } else if (msg.type === "stream_accept") {
          const stream = outgoingStreamsRef.current[msg.msgId];
          if (stream) {
            setMessages(prev => prev.map(m => m.id === msg.msgId ? { ...m, streamState: "transferring" } : m));
            processNextChunk(msg.msgId);
          }
          return;
        } else if (msg.type === "stream_pause") {
          const stream = outgoingStreamsRef.current[msg.msgId];
          if (stream) stream.paused = true;
          setMessages(prev => prev.map(m => m.id === msg.msgId ? { ...m, streamState: "paused" } : m));
          return;
        } else if (msg.type === "stream_resume") {
          const stream = outgoingStreamsRef.current[msg.msgId];
          if (stream) {
            stream.paused = false;
            processNextChunk(msg.msgId);
          }
          setMessages(prev => prev.map(m => m.id === msg.msgId ? { ...m, streamState: "transferring" } : m));
          return;
        } else if (msg.type === "stream_cancel") {
          const outStream = outgoingStreamsRef.current[msg.msgId];
          if (outStream) {
            outStream.canceled = true;
            delete outgoingStreamsRef.current[msg.msgId];
          }
          const inStream = incomingStreamsRef.current[msg.msgId];
          if (inStream) {
            try { inStream.stream.close(); } catch (e) { }
            delete incomingStreamsRef.current[msg.msgId];
          }
          setMessages(prev => prev.map(m => m.id === msg.msgId ? { ...m, streamState: "canceled" } : m));
          return;
        } else if (msg.type === "stream_end") {
          const inStream = incomingStreamsRef.current[msg.msgId];
          if (inStream) {
            try {
              await inStream.stream.close();
            } catch (e) { }

            if (inStream.checksum !== msg.checksum) {
              setNotification({ message: "Checksum mismatch for streamed file.", type: "error" });
            } else {
              setNotification({ message: "File download complete.", type: "success" });
            }
            delete incomingStreamsRef.current[msg.msgId];
            setMessages(prev => prev.map(m => m.id === msg.msgId ? { ...m, streamState: "completed" } : m));
            setTransferProgress(0);
          }
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

          if (autoClipboardSyncRef.current) {
            try {
              navigator.clipboard.writeText(msg.content).then(() => {
                lastClipboardTextRef.current = msg.content;
              }).catch(() => {
                // writeText requires user gesture if not focused
              });
            } catch (err) { }
          }

          if (!isAtBottom || document.visibilityState === "hidden" || !document.hasFocus()) {
            setUnreadCount((prev) => prev + 1);
            sendLocalNotification("New Message", msg.content);
          }

          dc.send(JSON.stringify({ type: "msg_ack", msgId: msg.id }));
        } else if (msg.type === "chunk_start") {
          activeTransferIdRef.current = msg.msgId;
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
            activeTransferIdRef.current = null;
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
              } catch (err) { }
            } else if (chunkData.type === "msg_edit") {
              try {
                const editPayload = JSON.parse(fullPayload);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === editPayload.targetId ? { ...m, content: editPayload.content, isEdited: true } : m,
                  ),
                );
              } catch (err) { }
            } else if (chunkData.type === "composite") {
              try {
                const compositePayload = JSON.parse(fullPayload);
                const attachments: Attachment[] = (compositePayload.attachments || []).map((att: any) => {
                  const objectUrl = dataURItoBlobURL(att.content, att.fileName);
                  const originalBlob = blobRegistry.get(objectUrl);
                  return { ...att, content: objectUrl, originalBlob };
                });
                const newMsg: Message = {
                  id: msg.msgId,
                  sender: "remote",
                  type: "composite",
                  content: compositePayload.content,
                  attachments,
                  timestamp: Date.now(),
                  status: "received",
                  replyTo: chunkData.replyTo,
                };
                setMessages((prev) => [...prev, newMsg]);

                if (!isAtBottom || document.visibilityState === "hidden" || !document.hasFocus()) {
                  setUnreadCount((prev) => prev + 1);
                  sendLocalNotification(
                    "Message Received",
                    compositePayload.content || "New message with attachments",
                  );
                }
              } catch (e) {
                console.error("Failed to parse composite message", e);
              }
            } else if (chunkData.type === "file") {
              const fType = chunkData.fileName
                ? getFileType(chunkData.fileName)
                : "file";
              const objectUrl = dataURItoBlobURL(fullPayload, chunkData.fileName);
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

              if (!isAtBottom || document.visibilityState === "hidden" || !document.hasFocus()) {
                setUnreadCount((prev) => prev + 1);
                sendLocalNotification(
                  "File Received",
                  chunkData.fileName || "New file received",
                );
              }
            } else if (chunkData.type === "text") {
              const newMsg: Message = {
                id: msg.msgId,
                sender: "remote",
                type: "text",
                content: fullPayload,
                timestamp: Date.now(),
                status: "received",
                replyTo: chunkData.replyTo,
              };
              setMessages((prev) => [...prev, newMsg]);

              if (autoClipboardSyncRef.current) {
                try {
                  navigator.clipboard.writeText(fullPayload).then(() => {
                    lastClipboardTextRef.current = fullPayload;
                  }).catch(() => {
                    // writeText requires user gesture if not focused
                  });
                } catch (err) { }
              }

              if (!isAtBottom || document.visibilityState === "hidden" || !document.hasFocus()) {
                setUnreadCount((prev) => prev + 1);
                sendLocalNotification(
                  "New Message",
                  fullPayload.length > 30 ? fullPayload.substring(0, 30) + "..." : fullPayload,
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

  const initiateServerConnection = async (targetEmail: string) => {
    if (!signalingSocketRef.current || !signalingSocketRef.current.connected) {
      setNotification({ message: "Signaling server disconnected", type: "error" });
      return;
    }

    setPairingWorkflow("signaling");
    setConnectionState("pairing");
    setTargetRemoteEmail(targetEmail);
    setIsHosting(true);

    const pc = initPeer();
    const dc = pc.createDataChannel("transfer");
    handleDataChannel(dc);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        signalingSocketRef.current?.emit("webrtc-ice-candidate", { targetEmail, candidate: e.candidate });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    signalingSocketRef.current.emit("webrtc-offer", { 
      targetEmail, 
      offer,
      senderProfile: {
        username: user?.username,
        photoUrl: user?.photoUrl
      }
    });
  };

  const handleAutoConnect = (targetEmail: string) => {
    initiateServerConnection(targetEmail);
  };

  const reconnectLastUser = () => {
    if (lastConnectedEmail) {
      initiateServerConnection(lastConnectedEmail);
    }
  };

  const searchUsers = async () => {
    if (!searchQuery) return;
    setIsSearching(true);
    try {
      const baseUrl = import.meta.env.DEV ? '' : 'https://datavisualizer-signalling-server.onrender.com';
      const res = await fetch(`${baseUrl}/api/users/search?email=${encodeURIComponent(searchQuery)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setSearchResults(data);
    } catch (err: any) {
      setNotification({ message: err.message, type: 'error' });
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchQuery.trim()) {
        searchUsers();
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const updateDefaultTarget = async (newEmail?: string, toggleAutoConnect?: boolean) => {
    if (!token) return;
    try {
      const baseUrl = import.meta.env.DEV ? '' : 'https://datavisualizer-signalling-server.onrender.com';
      const body: any = {};
      if (newEmail !== undefined) body.defaultTargetEmail = newEmail.trim().toLowerCase();
      if (toggleAutoConnect !== undefined) body.autoConnectEnabled = toggleAutoConnect;

      const res = await fetch(`${baseUrl}/api/users/me/default-target`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');

      const { updateUser } = useAuthStore.getState();
      updateUser(data);

      if (signalingSocketRef.current?.connected) {
        signalingSocketRef.current.emit("user-profile-updated", data);
      }

      setNotification({ message: 'Settings saved', type: 'success' });
    } catch (err: any) {
      setNotification({ message: err.message, type: 'error' });
    }
  };

  const handleServerOffer = async (data: { senderEmail?: string; from?: string; senderSocketId?: string; offer: RTCSessionDescriptionInit; senderProfile?: any }) => {
    const remoteEmail = data.senderEmail || data.from || "Remote Peer";
    if (remoteEmail === user?.email) {
      // Auto-accept own devices
      processServerOffer(data);
    } else {
      // Queue requests from others
      setIncomingRequests(prev => {
        // Prevent duplicates from same sender/socket
        if (prev.find(req => req.senderSocketId === data.senderSocketId)) return prev;
        return [...prev, data];
      });
    }
  };

  const processServerOffer = async (data: { senderEmail?: string; from?: string; senderSocketId?: string; offer: RTCSessionDescriptionInit; senderProfile?: any }) => {
    const remoteEmail = data.senderEmail || data.from || "Remote Peer";

    try {
      if (pcRef.current && pcRef.current.iceConnectionState === "connected") {
        console.log("[WebRTC] Already connected, ignoring incoming offer");
        return;
      }

      setPairingWorkflow("signaling");
      setConnectionState("pairing");
      setTargetRemoteEmail(remoteEmail);
      setIsHosting(false);

      const pc = initPeer();

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          signalingSocketRef.current?.emit("webrtc-ice-candidate", {
            targetSocketId: data.senderSocketId,
            targetEmail: remoteEmail,
            candidate: e.candidate
          });
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      await flushPendingCandidates(pc, data.senderSocketId);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      signalingSocketRef.current?.emit("webrtc-answer", {
        targetSocketId: data.senderSocketId,
        targetEmail: remoteEmail,
        answer
      });
    } catch (err) {
      console.warn("[WebRTC] Error handling incoming offer:", err);
    }
  };

  const handleServerAnswer = async (data: { senderEmail?: string; from?: string; senderSocketId?: string; answer: RTCSessionDescriptionInit }) => {
    const remoteEmail = data.senderEmail || data.from || targetRemoteEmail || "Remote Peer";
    if (pcRef.current) {
      if (pcRef.current.signalingState !== "have-local-offer") {
        console.warn(`[WebRTC] Ignoring remote answer: connection is in '${pcRef.current.signalingState}' state, expected 'have-local-offer'`);
        return;
      }
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        await flushPendingCandidates(pcRef.current, data.senderSocketId);
        setLastConnectedEmail(remoteEmail);
        localStorage.setItem("transfer-last-connected", remoteEmail);
        setConnectionHistory(prev => {
          const next = [remoteEmail, ...prev.filter(e => e !== remoteEmail)].slice(0, 5);
          localStorage.setItem("transfer-history", JSON.stringify(next));
          return next;
        });
      } catch (err) {
        console.warn("[WebRTC] Failed to set remote answer:", err);
      }
    }
  };

  const handleServerIceCandidate = async (data: { senderEmail?: string; from?: string; senderSocketId?: string; candidate: RTCIceCandidateInit }) => {
    if (pcRef.current) {
      if (pcRef.current.remoteDescription) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.warn("[WebRTC] Error adding received ice candidate:", e);
        }
      } else {
        const key = data.senderSocketId || "default";
        if (!pendingCandidatesRef.current[key]) pendingCandidatesRef.current[key] = [];
        pendingCandidatesRef.current[key].push(data.candidate);
      }
    } else {
      const key = data.senderSocketId || "default";
      if (!pendingCandidatesRef.current[key]) pendingCandidatesRef.current[key] = [];
      pendingCandidatesRef.current[key].push(data.candidate);
    }
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
              const fullPayload = Array.from({ length: chunk.t }).map((_, idx) => newState.chunks[idx]).join("");
              setCompleteScannedPayload(fullPayload);
            }
            return newState;
          });
          return;
        }
      }
    } catch (e) { }

    // Legacy unchunked parsing fallback
    processCompleteScannedPayload(code);
  };

  const processOffer = async (offer: any) => {
    const start = performance.now();
    const pc = initPeer();
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    await flushPendingCandidates(pc);
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
      await flushPendingCandidates(pcRef.current);
      setScanMode(null);
      setConnectionState("connected");
    }
  };

  const sendMessage = async () => {
    if (
      (!chatInput.trim() && pendingFiles.length === 0) ||
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

    const textContent = chatInput;
    const filesToProcess = [...pendingFiles];

    const totalPendingSize = filesToProcess.reduce((acc, curr) => acc + curr.size, 0);
    if (totalPendingSize > MAX_FILE_SIZE) {
      setNotification({ message: "Total size of attached files exceeds 100MB limit. Please remove some files.", type: "error" });
      return;
    }

    setChatInput("");
    setPendingFiles([]);
    setReplyingTo(null);

    if (editingMessage) {
      setEditingMessage(null);
      // Optimistically update locally
      setMessages((prev) =>
        prev.map((m) =>
          m.id === editingMessage.id ? { ...m, content: textContent, isEdited: true } : m,
        ),
      );
      // Send edit command
      await sendLargeMessage("msg_edit", JSON.stringify({ targetId: editingMessage.id, content: textContent }));
      return;
    }

    if (filesToProcess.length > 0) {
      if (largeFileMode) {
        for (const file of filesToProcess) {
          startFileStream(file, replyData);
        }
        if (textContent.trim()) {
          await sendLargeMessage("text", textContent, undefined, replyData);
        }
        return;
      }

      const msgId = uuidv4();
      const attachments: Attachment[] = [];
      const compositePayloadAttachments: any[] = [];

      for (const file of filesToProcess) {
        const fileContent = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });

        const fType = getFileType(file.name);
        const objectUrl = URL.createObjectURL(file);
        blobRegistry.set(objectUrl, file);

        const attId = uuidv4();
        attachments.push({
          id: attId,
          fileName: file.name,
          fileSize: file.size,
          fileType: fType,
          content: objectUrl,
          originalBlob: file
        });

        compositePayloadAttachments.push({
          id: attId,
          fileName: file.name,
          fileSize: file.size,
          fileType: fType,
          content: fileContent
        });
      }

      const compositePayload = {
        content: textContent,
        attachments: compositePayloadAttachments
      };

      const localMsgOverride: Message = {
        id: msgId,
        sender: "me",
        type: "composite",
        content: textContent,
        attachments,
        timestamp: Date.now(),
        status: "sending",
        chunksSent: 0,
        chunksTotal: 0,
        replyTo: replyData
      };

      await sendLargeMessage(
        "composite",
        JSON.stringify(compositePayload),
        undefined,
        replyData,
        undefined,
        localMsgOverride
      );
    } else if (textContent.trim()) {
      await sendLargeMessage("text", textContent, undefined, replyData);
    }
  };

  const resetState = () => {
    if (pcRef.current) pcRef.current.close();
    setConnectionState("waiting");
    setOfferQR("");
    setAnswerQR("");
    setIsHosting(false);
    setScanMode(null);
    setIncomingRequests([]);
    pendingCandidatesRef.current = {};
  };

  const isDark = appTheme === "dark";

  const renderContentWithLinks = (text: string) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer nofollow"
            referrerPolicy="no-referrer"
            className={`${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-500'} underline underline-offset-2 break-all cursor-pointer pointer-events-auto select-text`}
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return <span key={i} className="select-text">{part}</span>;
    });
  };

  const mediaMsgs = messages.reduce<any[]>((acc, m) => {
    if (m.type === "file") {
      acc.push(m);
    }
    if (m.type === "composite" && m.attachments) {
      m.attachments.forEach(att => {
        acc.push({ ...att, sender: m.sender, timestamp: m.timestamp });
      });
    }
    if (m.type === "file_offer" && m.content) {
      acc.push(m);
    }
    return acc;
  }, []);
  const selectedMediaIdx = selectedMedia ? mediaMsgs.findIndex((m) => m.id === selectedMedia.id) : -1;


  return (
    <div
      className={`w-[340px] sm:w-[400px] min-h-[340px] rounded-2xl overflow-hidden border shadow-2xl flex flex-col nowheel shrink-0 ${isDark ? "bg-[#111829] border-white/10 text-slate-300" : "bg-white border-slate-200 text-slate-800"}`}
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
              className="fixed inset-0 z-[10000] bg-black flex flex-col items-center justify-center overflow-hidden nodrag nowheel"
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
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
      <div className="p-4 sm:p-5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 shrink">
          <div
            className={`p-2 sm:p-2.5 rounded-xl shrink-0 ${isDark ? "bg-indigo-500/10 text-indigo-400" : "bg-indigo-50 text-indigo-600"}`}
          >
            <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <h3
              className={`font-bold tracking-tight truncate ${isDark ? "text-white" : "text-slate-900"}`}
            >
              Direct Transfer
            </h3>
            <div className="flex flex-col gap-1.5 mt-2">
              <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium tracking-wide flex items-center gap-1.5 uppercase leading-none truncate">
                <div
                  className={`w-2 h-2 shrink-0 rounded-full border ${(connectionState === "connected" || connectionState === "transferring" || connectionState === "messaging")
                    ? "bg-emerald-500 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                    : "bg-transparent border-slate-400 dark:border-slate-600"
                    }`}
                /> <span className="truncate">P2P Secure Connection</span>
              </div>
              <div className="flex items-center">
                <span className={`px-2 py-0.5 rounded-md border text-[9px] sm:text-[9.5px] font-mono tracking-wide truncate leading-none ${isDark ? "bg-[#161b22]/50 border-white/5 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-600"}`}>
                  {nodeKey}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0 relative">
          {connectionState !== "connected" && connectionState !== "messaging" && (
            <div
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${connectionState === "transferring"
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
                  : (
                    <span className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${connectionState === "transferring"
                        ? "bg-blue-500 animate-pulse"
                        : connectionState === "failed"
                          ? "bg-red-500"
                          : "bg-slate-400"
                        }`} />
                      {connectionState}
                    </span>
                  )}
            </div>
          )}

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
              className={`p-1.5 rounded-lg transition-colors ${isDark
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
            className={`p-1.5 rounded-lg transition-colors ${showSettingsDropdown
              ? isDark
                ? "bg-white/10 text-white"
                : "bg-slate-200 text-slate-900"
              : isDark
                ? "hover:bg-white/5 text-slate-400 hover:text-white"
                : "hover:bg-slate-100 text-slate-500 hover:text-slate-900"
              }`}
          >
            <Settings className="w-4 h-4" />
          </button>

          <NodeOptionsMenu path={node.data.path} iconSize={16} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/5 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'}`} />

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
                  className={`absolute top-full right-0 mt-2 w-64 p-4 rounded-2xl border shadow-2xl z-50 origin-top-right backdrop-blur-xl ${isDark
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
                          className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${pairingMode === "local"
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
                          className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${pairingMode === "universal"
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
                            className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${qrDensity === d
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
                            className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${qrSpeed === s
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
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block mt-4">
                        Large File Transfer Mode
                      </span>
                      <div className={`p-1 rounded-lg flex gap-1 ${isDark ? "bg-white/5" : "bg-slate-100"}`}>
                        <button
                          onClick={() => setLargeFileMode(false)}
                          className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${!largeFileMode
                            ? isDark
                              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                              : "bg-white text-indigo-600 shadow-sm"
                            : "text-slate-400 hover:text-slate-200"
                            }`}
                        >
                          Memory (Default)
                        </button>
                        <button
                          onClick={() => {
                            if ('showSaveFilePicker' in window) {
                              setLargeFileMode(true);
                            } else {
                              setNotification({ message: "File System API not supported in this browser.", type: "error" });
                            }
                          }}
                          className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${largeFileMode
                            ? isDark
                              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                              : "bg-white text-indigo-600 shadow-sm"
                            : "text-slate-400 hover:text-slate-200"
                            }`}
                        >
                          Stream to Disk
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div
        className="flex-1 px-5 pb-5 flex flex-col nodrag nowheel"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        {connectionState === "waiting" && !scanMode && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div
              className={`h-[1px] w-full ${isDark ? "bg-white/5" : "bg-slate-100"}`}
            />

            {!isLoggedIn ? (
              <p className="text-sm leading-relaxed text-slate-400">
                Transfer nodes, documents, or your entire workspace instantly
                between devices using WebRTC. No accounts required.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5 w-full">
                {/* 0. Incoming Requests */}
                {incomingRequests.length > 0 && (
                  <div className="flex flex-col gap-2.5 w-full">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Incoming Requests
                    </span>
                    {incomingRequests.map((req, idx) => (
                      <div key={idx} className={`p-3 rounded-xl border flex flex-col gap-3 shadow-lg shadow-emerald-500/10 ${isDark ? "bg-emerald-500/10 border-emerald-500/30" : "bg-emerald-50 border-emerald-200"}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-500 font-bold text-xs flex items-center justify-center shrink-0">
                            {req.senderProfile?.photoUrl ? (
                              <img src={req.senderProfile.photoUrl} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                            ) : req.senderProfile?.username ? (
                              req.senderProfile.username[0].toUpperCase()
                            ) : (
                              "U"
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className={`text-sm font-bold truncate ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                              {req.senderProfile?.username || "Unknown User"}
                            </span>
                            <span className="text-[10px] text-slate-500 truncate">
                              {req.senderEmail || req.from}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setIncomingRequests(prev => prev.filter(r => r !== req));
                              processServerOffer(req);
                            }}
                            className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-lg text-xs transition-colors shadow-md cursor-pointer"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => {
                              setIncomingRequests(prev => prev.filter(r => r !== req));
                              if (req.senderSocketId) {
                                signalingSocketRef.current?.emit("webrtc-reject", { targetSocketId: req.senderSocketId });
                              }
                            }}
                            className={`flex-1 py-2 font-bold rounded-lg text-xs transition-colors cursor-pointer ${isDark ? "bg-white/10 hover:bg-white/20 text-slate-300" : "bg-slate-200 hover:bg-slate-300 text-slate-700"}`}
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className={`h-[1px] w-full my-2 ${isDark ? "bg-white/5" : "bg-slate-200"}`} />
                  </div>
                )}

                {/* 1. Connect to My Devices */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => initiateServerConnection(user?.email || "")}
                  className={`cursor-pointer p-3 rounded-xl border flex items-center justify-between transition-all group ${isDark ? "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20" : "bg-emerald-50 border-emerald-200 hover:bg-emerald-100"}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${onlinePresence[user?.email || ""] ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                    <div className="flex flex-col text-left truncate">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 leading-tight">
                        Connect to My Devices
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        Link other devices logged in as {user?.email}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (user?.defaultTargetEmail === user?.email) {
                          updateDefaultTarget("", false);
                        } else {
                          updateDefaultTarget(user?.email || "", true);
                        }
                      }}
                      className={`p-1.5 rounded-md text-[10px] font-semibold transition-colors cursor-pointer ${user?.defaultTargetEmail === user?.email ? "text-amber-400 bg-amber-400/10" : "text-emerald-500/50 hover:text-amber-400 hover:bg-emerald-500/10"}`}
                      title={user?.defaultTargetEmail === user?.email ? "Default Target Device" : "Set as Default Target Device"}
                    >
                      <Star size={14} className={user?.defaultTargetEmail === user?.email ? "fill-amber-400" : ""} />
                    </button>
                    <Laptop className="w-4 h-4 text-emerald-500 flex-shrink-0 group-hover:scale-110 transition-transform" />
                  </div>
                </div>

                {/* 2. Connect to Default Target (if configured) */}
                {user?.defaultTargetEmail && user.defaultTargetEmail !== user.email && (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => initiateServerConnection(user.defaultTargetEmail!)}
                    className={`cursor-pointer p-3 rounded-xl border flex items-center justify-between transition-all group ${isDark ? "bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20" : "bg-blue-50 border-blue-200 hover:bg-blue-100"}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${onlinePresence[user.defaultTargetEmail] ? "bg-blue-500 animate-pulse" : "bg-slate-400"}`} />
                      <div className="flex flex-col text-left truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 leading-tight">
                            Default Target Device
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateDefaultTarget("", false);
                            }}
                            className="hover:scale-110 transition-transform cursor-pointer focus:outline-none"
                            title="Remove Default Target"
                          >
                            <Star size={11} className="text-amber-400 fill-amber-400 drop-shadow-sm" />
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          Connect: {user.defaultTargetEmail}
                        </span>
                      </div>
                    </div>
                    <Radio className="w-4 h-4 text-blue-500 flex-shrink-0 group-hover:scale-110 transition-transform animate-pulse" />
                  </div>
                )}

                {/* 3. Reconnect Last Connected Device */}
                {lastConnectedEmail && lastConnectedEmail !== user?.email && lastConnectedEmail !== user?.defaultTargetEmail && (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={reconnectLastUser}
                    className={`cursor-pointer p-3 rounded-xl border flex items-center justify-between transition-all group ${isDark ? "bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/20" : "bg-indigo-50 border-indigo-200 hover:bg-indigo-100"}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${onlinePresence[lastConnectedEmail] ? "bg-indigo-500 animate-pulse" : "bg-slate-400"}`} />
                      <div className="flex flex-col text-left truncate">
                        <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
                          Recent Connection
                        </span>
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-300 truncate">
                          {lastConnectedEmail}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (user?.defaultTargetEmail === lastConnectedEmail) {
                            updateDefaultTarget("", false);
                          } else {
                            updateDefaultTarget(lastConnectedEmail, true);
                          }
                        }}
                        className={`p-1.5 rounded-md text-[10px] font-semibold transition-colors cursor-pointer ${user?.defaultTargetEmail === lastConnectedEmail ? "text-amber-400 bg-amber-400/10" : "text-indigo-500/50 hover:text-amber-400 hover:bg-indigo-500/10"}`}
                        title={user?.defaultTargetEmail === lastConnectedEmail ? "Default Target Device" : "Set as Default Target Device"}
                      >
                        <Star size={14} className={user?.defaultTargetEmail === lastConnectedEmail ? "fill-amber-400" : ""} />
                      </button>
                      <RotateCcw className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    </div>
                  </div>
                )}



                {/* 4. Auto-Connect Toggle */}
                <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-white/10 transition-colors">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Auto-Connect Default Target</span>
                  </div>
                  <button
                    onClick={() => updateDefaultTarget(user?.defaultTargetEmail || "", !(user?.autoConnectEnabled ?? false))}
                    className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer ${user?.autoConnectEnabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${user?.autoConnectEnabled ? "translate-x-4" : "translate-x-0"}`} />
                  </button>
                </div>

                {/* 5. Search by Email */}
                <div className="flex gap-2 mt-1">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search device by email..."
                      className={`w-full px-3 py-2.5 pr-10 text-xs rounded-xl border outline-none transition-colors ${isDark ? "bg-white/5 border-white/10 text-white focus:border-indigo-500/50" : "bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-500"}`}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') searchUsers();
                      }}
                    />
                    {isSearching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. Search Results with Connect & Set Default */}
                {searchResults.filter(u => u.isOnline).length > 0 && (
                  <div className={`flex flex-col gap-1.5 max-h-44 overflow-y-auto rounded-xl border p-1.5 ${isDark ? "border-white/10 bg-black/20" : "border-slate-200 bg-slate-50"}`}>
                    <div className="px-1.5 py-0.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <span>Found Online Devices</span>
                      <span>{searchResults.filter(u => u.isOnline).length}</span>
                    </div>
                    {searchResults.filter(u => u.isOnline).map((searchUser: any) => (
                      <div
                        key={searchUser._id || searchUser.id}
                        className={`p-2 rounded-lg flex items-center justify-between transition-colors ${isDark ? "bg-white/5 hover:bg-white/10 text-slate-200" : "bg-white hover:bg-slate-100 text-slate-800 border border-slate-200/60"}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-500 font-bold text-xs flex items-center justify-center flex-shrink-0 relative">
                            {searchUser.photoUrl ? (
                              <img src={searchUser.photoUrl} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                            ) : searchUser.username ? (
                              searchUser.username.charAt(0).toUpperCase()
                            ) : (
                              "U"
                            )}
                            {searchUser.isOnline && (
                              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-slate-50 dark:border-black"></span>
                            )}
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-bold truncate leading-tight">{searchUser.username}</p>
                            <p className="text-[10px] text-slate-400 truncate leading-tight">{searchUser.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => {
                              if (user?.defaultTargetEmail === searchUser.email) {
                                updateDefaultTarget("", false);
                              } else {
                                updateDefaultTarget(searchUser.email, true);
                              }
                            }}
                            className={`p-1.5 rounded-md text-[10px] font-semibold transition-colors cursor-pointer ${user?.defaultTargetEmail === searchUser.email ? "text-amber-400 bg-amber-400/10" : "text-slate-400 hover:text-amber-400 hover:bg-white/5"}`}
                            title={user?.defaultTargetEmail === searchUser.email ? "Default Target Device" : "Set as Default Target Device"}
                          >
                            <Star size={14} className={user?.defaultTargetEmail === searchUser.email ? "fill-amber-400" : ""} />
                          </button>
                          <button
                            onClick={() => initiateServerConnection(searchUser.email)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-lg text-[11px] font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                          >
                            <Radio size={11} className="animate-pulse" />
                            <span>Connect</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 mb-2">
              <div className="h-[1px] flex-1 bg-slate-200 dark:bg-white/10" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Or use manual pairing</span>
              <div className="h-[1px] flex-1 bg-slate-200 dark:bg-white/10" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={generateOffer}
                className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all group ${isDark
                  ? "border-white/5 hover:border-indigo-500/50 hover:bg-indigo-500/5 bg-white/5"
                  : "border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 bg-slate-50"
                  }`}
              >
                <div
                  className={`p-2.5 rounded-full transition-colors ${isDark ? "bg-white/5 group-hover:bg-indigo-500/20" : "bg-white group-hover:bg-indigo-100"}`}
                >
                  <Laptop className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold tracking-tight">
                  Host Transfer
                </span>
              </button>

              <button
                onClick={() => setScanMode("offer")}
                className={`p-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all group ${isDark
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
            className="flex flex-col items-center gap-4 py-2 w-full"
          >
            {pairingWorkflow === "signaling" ? (
              <div className="w-full flex flex-col items-center justify-center p-4 text-center">
                <div className="relative my-4 flex items-center justify-center">
                  <div className="absolute w-24 h-24 rounded-full bg-blue-500/15 animate-ping opacity-60 pointer-events-none" />
                  <div className="absolute w-20 h-20 rounded-full bg-indigo-500/20 animate-pulse pointer-events-none" />
                  <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xl shadow-blue-500/30 border border-white/20">
                    <Laptop className="w-7 h-7 animate-pulse" />
                  </div>
                </div>

                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">
                  Connecting via Signaling
                </h3>
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-4 font-mono bg-blue-50 dark:bg-blue-500/10 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-500/20 max-w-full truncate">
                  {targetRemoteEmail || "Awaiting Peer..."}
                </p>

                <div className="w-full bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-3.5 mb-5 flex flex-col gap-2.5 text-left">
                  <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                    <span>Signaling offer dispatched</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
                    <span>Negotiating WebRTC ICE candidates</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-slate-400 dark:text-slate-500">
                    <div className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" />
                    <span>Establishing direct P2P data stream</span>
                  </div>
                </div>

                <div className="flex gap-2 w-full">
                  <button
                    onClick={() => {
                      if (targetRemoteEmail) {
                        initiateServerConnection(targetRemoteEmail);
                      }
                    }}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </button>
                  <button
                    onClick={() => {
                      resetState();
                      setPairingWorkflow("qr");
                    }}
                    className="flex-1 py-2.5 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold rounded-xl text-xs transition-colors border border-rose-200 dark:border-rose-500/20 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div
                  className={`p-1.5 flex w-full rounded-2xl border ${isDark ? "bg-white/5 border-white/5" : "bg-slate-100 border-slate-200"}`}
                >
                  <button
                    onClick={() => setPairingWorkflow("qr")}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${pairingWorkflow === "qr"
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
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${pairingWorkflow === "manual"
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
                      <div className="p-4 bg-white rounded-3xl shadow-xl shrink-0 relative group flex items-center justify-center aspect-square w-full max-w-[240px]">
                        {broadcastFrames.length > 0 && (
                          <div className="absolute top-2 left-2 z-[10]">
                            <div className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-100/80 text-slate-500 backdrop-blur-sm shadow-sm ring-1 ring-slate-200">
                              {currentFrameIndex + 1} / {broadcastFrames.length}
                            </div>
                          </div>
                        )}
                        {(broadcastFrames.length > 0 || offerQR || answerQR) ? (
                          <>
                            <button
                              onClick={() => setShowDiagnostics(true)}
                              className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-100/80 opacity-0 group-hover:opacity-100 max-sm:opacity-100 transition-opacity hover:bg-slate-200/80 z-[10] backdrop-blur-sm shadow-sm ring-1 ring-slate-200"
                              title="Diagnostics"
                            >
                              <Activity className="w-3.5 h-3.5 text-slate-500" />
                            </button>
                            <button
                              onClick={() => setIsFullscreenQR(true)}
                              className="absolute top-10 right-2 p-1.5 rounded-lg bg-slate-100/80 opacity-0 group-hover:opacity-100 max-sm:opacity-100 transition-opacity hover:bg-slate-200/80 z-[10] backdrop-blur-sm shadow-sm ring-1 ring-slate-200"
                              title="Fullscreen QR"
                            >
                              <Maximize className="w-3.5 h-3.5 text-slate-500" />
                            </button>
                            <QRCodeSVG
                              value={broadcastFrames.length > 0 ? broadcastFrames[currentFrameIndex] : (offerQR || answerQR)}
                              size={200}
                              level={qrDensity}
                              marginSize={2}
                              className="w-full h-auto max-w-[200px]"
                            />
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center w-full h-full text-center">
                            {isHosting ? (
                              <button
                                onClick={generateOffer}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-indigo-500/20"
                              >
                                <Plus className="w-3.5 h-3.5" /> Generate Offer
                              </button>
                            ) : (
                              <p className="text-[10px] font-medium italic text-slate-400">
                                Waiting for remote offer...
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="text-center space-y-1">
                      <p className="text-sm font-bold text-white">
                        {(broadcastFrames.length > 0 || offerQR || answerQR)
                          ? isHosting ? "Offer Generated" : "Answer Generated"
                          : isHosting ? "Ready to Generate" : "Waiting for Offer"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {(broadcastFrames.length > 0 || offerQR || answerQR)
                          ? isHosting ? "Scan this code on the joining device" : "Scan this code back on the host device"
                          : isHosting ? "Click Generate Offer to begin" : "Scan the host's QR code"}
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
                        className={`flex-1 py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase transition-all whitespace-nowrap shadow-sm active:scale-95 ${isDark
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
                            message: `${isHosting ? "Offer" : "Answer"} Copied to Clipboard`,
                            type: "success",
                          });
                        }}
                        disabled={!(offerQR || answerQR)}
                        className={`flex-1 py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase transition-all whitespace-nowrap active:scale-95 ${isDark
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
                        {copiedSDP ? "Copied" : (isHosting ? "Copy Offer" : "Copy Answer")}
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
                        className={`flex-[1.5] py-2 text-[9px] font-black uppercase tracking-widest transition-all rounded-lg flex flex-col items-center justify-center gap-0.5 ${isHosting
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
                        className={`flex-[1.5] py-2 text-[9px] font-black uppercase tracking-widest transition-all rounded-lg flex flex-col items-center justify-center gap-0.5 ${!isHosting
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
                            className={`group relative p-4 rounded-[24px] border transition-all duration-300 ${isDark
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
                                  className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter ${isDark
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
                                    className={`h-full min-h-[52px] p-2.5 rounded-xl flex flex-col justify-between transition-colors overflow-hidden ${isDark
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
                                    className={`h-full min-h-[52px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-3 text-center ${isDark
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
                                className={`px-4 rounded-xl active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all flex flex-col items-center justify-center gap-1.5 shadow-lg ${copiedSDP
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
                            className={`p-4 rounded-[24px] border relative transition-all duration-300 ${isDark
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
                                  className={`w-full h-24 p-3 pr-10 text-[11px] font-mono rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none leading-relaxed ${isDark
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
                                    className={`absolute top-2 right-2 p-1.5 rounded-lg transition-colors ${isDark
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
                                  className={`flex-1 py-2.5 rounded-xl border flex items-center justify-center gap-2 transition-all ${isDark
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
              </>
            )}

            {pairingWorkflow !== "signaling" && (
              <div className="w-full flex gap-2">
                <button
                  onClick={resetState}
                  className={`flex-1 py-3 px-4 rounded-xl border flex items-center justify-center gap-2 text-[10px] font-bold uppercase transition-all ${isDark
                    ? "border-red-500/20 text-red-400 hover:bg-red-500/10"
                    : "border-red-200 text-red-600 hover:bg-red-50"
                    }`}
                >
                  Cancel Pairing
                </button>
              </div>
            )}
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
              className={`flex items-center gap-2 px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${isDark
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
            const mediaMessages = messages.reduce<any[]>((acc, m) => {
              if (m.type === "file") {
                acc.push(m);
              }
              if (m.type === "composite" && m.attachments) {
                m.attachments.forEach(att => {
                  acc.push({ ...att, sender: m.sender, timestamp: m.timestamp });
                });
              }
              return acc;
            }, []);

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

            const handleCopyMessage = (msg: Message) => {
              navigator.clipboard.writeText(msg.content);
              setCopyStatus({ id: msg.id, status: "success" });
              setTimeout(() => {
                setCopyStatus(prev => prev?.id === msg.id ? null : prev);
              }, 2000);
            };

            const content = (
              <div
                className={`flex flex-col relative nowheel ${isFullscreen ? "w-full max-w-4xl mx-auto h-full" : "h-[420px]"}`}
                onKeyDown={(e) => e.stopPropagation()}
                onKeyUp={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
              >
                {/* Modern Compact Toolbar */}
                <div
                  className={`flex items-center justify-between p-2 sm:p-3 border-b shrink-0 ${isDark ? "bg-[#0d1017]/80 backdrop-blur-md border-white/5" : "bg-white/80 backdrop-blur-md border-slate-100"}`}
                >
                  <div
                    className={`flex p-1 rounded-lg flex-1 max-w-[200px] ${isDark ? "bg-white/5" : "bg-slate-100"}`}
                  >
                    <button
                      onClick={() => setViewMode("chat")}
                      className={`flex-1 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-2 ${viewMode === "chat"
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
                      className={`flex-1 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${viewMode === "media"
                        ? isDark
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                          : "bg-white text-indigo-600 shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                        }`}
                    >
                      Media ({mediaMessages.length})
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setAutoClipboardSync(!autoClipboardSync)}
                      title={autoClipboardSync ? "Auto Clipboard Sync: ON" : "Auto Clipboard Sync: OFF"}
                      className={`p-2 rounded-lg border transition-all ${autoClipboardSync
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-500"
                        : isDark
                          ? "border-white/5 bg-white/5 hover:bg-white/10 text-slate-400"
                          : "border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-500"
                        }`}
                    >
                      <Clipboard className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      className={`p-2 rounded-lg border transition-all ${isDark ? "border-white/5 bg-white/5 hover:bg-white/10 text-slate-400" : "border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-500"}`}
                    >
                      {isFullscreen ? (
                        <Minimize className="w-4 h-4" />
                      ) : (
                        <Maximize className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div
                  className="flex-1 relative overflow-hidden bg-transparent flex flex-col nodrag nowheel"
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onWheel={(e) => e.stopPropagation()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const items = Array.from(e.dataTransfer.items);

                    const newFiles: File[] = [];
                    let hasLarge = false;
                    for (const item of items) {
                      if (item.kind === 'file') {
                        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
                        if (entry && entry.isDirectory) {
                          const filesInDir = await getFilesFromEntry(entry);
                          const totalSize = filesInDir.reduce((acc, curr) => acc + curr.file.size, 0);
                          if (totalSize > MAX_FILE_SIZE) {
                            hasLarge = true;
                          } else if (filesInDir.length > 0) {
                            const id = uuidv4();
                            setZippingTasks(prev => [...prev, { id, folderName: entry.name }]);
                            zipWorkerRef.current?.postMessage({ id, files: filesInDir, folderName: entry.name });
                          }
                        } else {
                          const f = item.getAsFile();
                          if (f) {
                            if (f.size > MAX_FILE_SIZE) hasLarge = true;
                            else newFiles.push(f);
                          }
                        }
                      }
                    }
                    if (hasLarge) {
                      setNotification({ message: "Files/folders exceeding 100MB limit were ignored", type: "error" });
                    }
                    if (newFiles.length > 0) {
                      setPendingFiles(prev => [...prev, ...newFiles]);
                    }
                  }}
                >
                  {!isAtBottom && (
                    <button
                      onClick={() => {
                        scrollRef.current?.scrollTo({
                          top: scrollRef.current.scrollHeight,
                          behavior: "smooth",
                        });
                      }}
                      className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-indigo-600 text-white text-[10px] font-bold uppercase rounded-full shadow-lg flex items-center gap-2 hover:bg-indigo-700 transition-all border border-indigo-400/30 shadow-indigo-900/20"
                    >
                      <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                      {unreadCount > 0
                        ? `${unreadCount} New Messages`
                        : "Jump to Latest"}
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
                                <p className={`text-xs mt-2 font-medium ${isDark ? "text-indigo-400/80" : "text-indigo-500/80"}`}>
                                  Max file/folder size: 100MB
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
                                className={`group relative max-w-[85%] rounded-3xl p-1 transition-all duration-300 ${msg.sender === "me"
                                  ? msg.type === "composite" || msg.type === "file"
                                    ? isDark ? "bg-slate-800 text-white rounded-tr-sm shadow-xl" : "bg-slate-200 text-slate-800 rounded-tr-sm shadow-sm"
                                    : "bg-indigo-600 text-white rounded-tr-sm shadow-xl shadow-indigo-500/20"
                                  : isDark
                                    ? "bg-[#161f30] text-slate-200 rounded-tl-sm border border-white/5"
                                    : "bg-slate-100 text-slate-800 rounded-tl-sm"
                                  }`}
                              >
                                {msg.status === "sending" && (msg.type === "composite" || msg.type === "file" || msg.type === "text") && (
                                  <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm rounded-[inherit] flex flex-col items-center justify-center p-4">
                                    <RefreshCw className="w-5 h-5 text-white animate-spin mb-2" />
                                    <div className="text-[10px] font-bold text-white uppercase tracking-wider whitespace-nowrap">Sending...</div>
                                    {(msg.chunksTotal ?? 0) > 0 && (
                                      <div className="w-full max-w-[120px] h-1.5 bg-white/20 rounded-full mt-3 overflow-hidden">
                                        <div
                                          className="h-full bg-indigo-400 rounded-full transition-all duration-300"
                                          style={{ width: `${((msg.chunksSent ?? 0) / (msg.chunksTotal ?? 1)) * 100}%` }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                )}
                                {/* Hover Actions Bar - Desktop only */}
                                <div
                                  className={`absolute top-0 opacity-0 group-hover:opacity-100 transition-all z-20 hidden lg:flex items-center gap-1 p-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 shadow-lg ${msg.sender === "me"
                                    ? "right-full mr-2"
                                    : "left-full ml-2"
                                    }`}
                                >
                                  <button
                                    onClick={() =>
                                      handleCopyMessage(msg)
                                    }
                                    title="Copy"
                                    className="p-1.5 hover:bg-white/20 rounded-full transition-colors text-white"
                                  >
                                    {copyStatus?.id === msg.id && copyStatus.status === "success" ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => setReplyingTo(msg)}
                                    title="Reply"
                                    className="p-1.5 hover:bg-white/20 rounded-full transition-colors text-white"
                                  >
                                    <CornerDownRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                {msg.isDeleted ? (
                                  <div className="px-4 py-2.5 text-xs font-medium italic opacity-50 flex items-center gap-2">
                                    <Trash2 className="w-3.5 h-3.5" />
                                    This message was deleted
                                  </div>
                                ) : (
                                  <>
                                    {msg.replyTo && (
                                      <button
                                        onClick={() =>
                                          scrollToMessage(msg.replyTo!.id)
                                        }
                                        className={`mx-1 mt-1 mb-0.5 p-2 rounded-2xl flex flex-col gap-0.5 text-left transition-all border-l-4 ${msg.sender === "me"
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
                                            : msg.replyTo.type === "composite" && !msg.replyTo.content
                                              ? `📎 ${msg.replyTo.attachments?.length || 0} attachments`
                                              : msg.replyTo.content}
                                        </span>
                                      </button>
                                    )}
                                    {msg.type === "text" && (
                                      <div className="px-4 py-2.5 text-xs font-medium select-text">
                                        {renderContentWithLinks(msg.content)}
                                      </div>
                                    )}
                                    {msg.type === "composite" && (
                                      <div className="flex flex-col gap-1 p-1">
                                        {(() => {
                                          const visuals = msg.attachments?.filter(att => att.fileType === "image" || att.fileType === "video" || att.fileType === "3d_model") || [];
                                          const others = msg.attachments?.filter(att => att.fileType !== "image" && att.fileType !== "video" && att.fileType !== "3d_model") || [];

                                          return (
                                            <>
                                              {visuals.length > 0 && (
                                                <div className={`grid gap-1 ${visuals.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                                  {visuals.map((att, i) => (
                                                    <div
                                                      key={i}
                                                      className={`cursor-pointer ${visuals.length === 1 ? 'w-full' : ''}`}
                                                      onClick={() => setSelectedMedia({ ...att, sender: msg.sender, timestamp: msg.timestamp } as any)}
                                                      onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setShowContextMenu({ id: msg.id, x: e.clientX, y: e.clientY, attachment: { ...att, sender: msg.sender, timestamp: msg.timestamp } });
                                                      }}
                                                    >
                                                      <FilePreviewCard
                                                        file={att}
                                                        readonly
                                                        layout={visuals.length === 1 ? "single-grid" : "grid"}
                                                        copyStatusObj={copyStatus}
                                                        onCopy={() => handleMediaCopy({ ...att, sender: msg.sender, timestamp: msg.timestamp } as any)}
                                                      />
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                              {others.length > 0 && (
                                                <div className="flex flex-col gap-1">
                                                  {others.map((att, i) => (
                                                    <div
                                                      key={i}
                                                      className="cursor-pointer"
                                                      onClick={() => setSelectedMedia({ ...att, sender: msg.sender, timestamp: msg.timestamp } as any)}
                                                      onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setShowContextMenu({ id: msg.id, x: e.clientX, y: e.clientY, attachment: { ...att, sender: msg.sender, timestamp: msg.timestamp } });
                                                      }}
                                                    >
                                                      <FilePreviewCard
                                                        file={att}
                                                        readonly
                                                        layout="list"
                                                        copyStatusObj={copyStatus}
                                                        onCopy={() => handleMediaCopy({ ...att, sender: msg.sender, timestamp: msg.timestamp } as any)}
                                                      />
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                            </>
                                          );
                                        })()}
                                        {msg.content && (
                                          <div className="px-3 py-1.5 text-xs font-medium mt-0.5 select-text">
                                            {renderContentWithLinks(msg.content)}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {msg.type === "file_offer" && (
                                      <div className="flex flex-col gap-2 p-1 w-[280px]">
                                        <div className={`p-3 rounded-2xl flex items-center gap-3 ${msg.sender === "me" ? "bg-white/10" : isDark ? "bg-white/5" : "bg-white border"}`}>
                                          <div className={`p-2 rounded-xl flex-shrink-0 ${msg.sender === "me" ? "bg-white/20" : "bg-indigo-500/10 text-indigo-500"}`}>
                                            <FileIcon className="w-6 h-6" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="text-xs font-bold truncate">{msg.fileName}</div>
                                            <div className="text-[10px] font-medium opacity-70">
                                              {formatFileSize(msg.fileSize || 0)}
                                            </div>
                                          </div>
                                        </div>

                                        {msg.streamState === "offered" && msg.sender === "remote" && (
                                          <button
                                            onClick={async () => {
                                              if (!('showSaveFilePicker' in window)) {
                                                // Fallback to memory
                                                setNotification({ message: "File System API not supported. Falling back to memory buffering. Large files may crash.", type: "warning" });

                                                // Create a mock stream-like object that accumulates chunks in memory
                                                const memoryBuffer: Uint8Array[] = [];
                                                const streamMock = {
                                                  write: async (chunk: Uint8Array) => {
                                                    memoryBuffer.push(new Uint8Array(chunk));
                                                  },
                                                  close: async () => {
                                                    const totalLength = memoryBuffer.reduce((acc, curr) => acc + curr.length, 0);
                                                    const combined = new Uint8Array(totalLength);
                                                    let offset = 0;
                                                    for (const chunk of memoryBuffer) {
                                                      combined.set(chunk, offset);
                                                      offset += chunk.length;
                                                    }
                                                    const blob = new Blob([combined]);
                                                    const url = URL.createObjectURL(blob);

                                                    // Convert this message to a normal file message so it renders the media
                                                    setMessages(prev => prev.map(m => m.id === msg.id ? {
                                                      ...m,
                                                      type: "file" as any,
                                                      content: url,
                                                      originalBlob: blob,
                                                      streamState: "completed"
                                                    } : m));
                                                  }
                                                };

                                                incomingStreamsRef.current[msg.id] = {
                                                  handle: null,
                                                  stream: streamMock,
                                                  received: 0,
                                                  total: msg.fileSize || 0,
                                                  checksum: 0
                                                };

                                                dcRef.current?.send(JSON.stringify({ type: "stream_accept", msgId: msg.id }));
                                                setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, streamState: "transferring" } : m));
                                                return;
                                              }
                                              try {
                                                const handle = await (window as any).showSaveFilePicker({ suggestedName: msg.fileName });
                                                const stream = await handle.createWritable();
                                                incomingStreamsRef.current[msg.id] = { handle, stream, received: 0, total: msg.fileSize || 0, checksum: 0 };
                                                dcRef.current?.send(JSON.stringify({ type: "stream_accept", msgId: msg.id }));
                                                setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, streamState: "transferring" } : m));
                                              } catch (e: any) {
                                                if (e.name !== "AbortError") {
                                                  setNotification({ message: "Could not open file: " + e.message, type: "error" });
                                                }
                                              }
                                            }}
                                            className="w-full py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-500 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2"
                                          >
                                            <Download className="w-4 h-4" />
                                            {'showSaveFilePicker' in window ? 'Accept File (Save to Disk)' : 'Accept File (Memory Fallback)'}
                                          </button>
                                        )}

                                        {msg.streamState === "offered" && msg.sender === "me" && (
                                          <div className="text-[10px] text-center font-bold opacity-60 italic">Waiting for receiver to accept...</div>
                                        )}

                                        {msg.streamState === "transferring" && (
                                          <div className="flex flex-col gap-1 w-full mt-1 px-1">
                                            <div className="flex justify-between items-center text-[10px] font-bold opacity-80">
                                              <span>Transferring...</span>
                                              <span>{msg.streamProgress || 0}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden">
                                              <motion.div
                                                className="h-full bg-emerald-400"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${msg.streamProgress || 0}%` }}
                                                transition={{ duration: 0.1 }}
                                              />
                                            </div>
                                          </div>
                                        )}

                                        {msg.streamState === "paused" && (
                                          <div className="flex flex-col gap-1 w-full mt-1 px-1">
                                            <div className="flex justify-between items-center text-[10px] font-bold opacity-80">
                                              <span>Paused</span>
                                              <span>{msg.streamProgress || 0}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden">
                                              <div className="h-full bg-amber-400" style={{ width: `${msg.streamProgress || 0}%` }} />
                                            </div>
                                          </div>
                                        )}

                                        {(msg.streamState === "completed" || msg.streamState === "canceled") && (
                                          <div className={`text-[10px] text-center font-bold uppercase tracking-widest ${msg.streamState === "completed" ? "text-emerald-500" : "text-red-500"}`}>
                                            {msg.streamState}
                                          </div>
                                        )}

                                        {(msg.streamState === "transferring" || msg.streamState === "paused") && (
                                          <div className="flex gap-2 w-full mt-1">
                                            <button
                                              onClick={() => {
                                                if (msg.streamState === "transferring") {
                                                  dcRef.current?.send(JSON.stringify({ type: "stream_pause", msgId: msg.id }));
                                                  setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, streamState: "paused" } : m));
                                                  if (msg.sender === "me") {
                                                    const outStream = outgoingStreamsRef.current[msg.id];
                                                    if (outStream) outStream.paused = true;
                                                  }
                                                } else {
                                                  dcRef.current?.send(JSON.stringify({ type: "stream_resume", msgId: msg.id }));
                                                  setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, streamState: "transferring" } : m));
                                                  if (msg.sender === "me") {
                                                    const outStream = outgoingStreamsRef.current[msg.id];
                                                    if (outStream) {
                                                      outStream.paused = false;
                                                      processNextChunk(msg.id);
                                                    }
                                                  }
                                                }
                                              }}
                                              className={`flex-1 py-1.5 font-bold text-[10px] uppercase rounded-xl transition-all flex items-center justify-center gap-1 ${msg.streamState === "transferring"
                                                ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-500"
                                                : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500"
                                                }`}
                                            >
                                              {msg.streamState === "transferring" ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                                              {msg.streamState === "transferring" ? "Pause" : "Resume"}
                                            </button>

                                            <button
                                              onClick={() => {
                                                dcRef.current?.send(JSON.stringify({ type: "stream_cancel", msgId: msg.id }));
                                                // Process cancellation locally
                                                if (msg.sender === "remote") {
                                                  const inStream = incomingStreamsRef.current[msg.id];
                                                  if (inStream) {
                                                    try { inStream.stream.close(); } catch (e) { }
                                                    delete incomingStreamsRef.current[msg.id];
                                                  }
                                                } else {
                                                  const outStream = outgoingStreamsRef.current[msg.id];
                                                  if (outStream) {
                                                    outStream.canceled = true;
                                                    delete outgoingStreamsRef.current[msg.id];
                                                  }
                                                }
                                                setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, streamState: "canceled" } : m));
                                              }}
                                              className="flex-1 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold text-[10px] uppercase rounded-xl transition-all flex items-center justify-center gap-1"
                                            >
                                              <X className="w-3 h-3" /> Cancel
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {msg.type === "file" && (
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
                                              key={msg.content}
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

                                        {msg.fileType === "3d_model" && (
                                          <div className="relative rounded-2xl overflow-hidden bg-[#1e293b] group/model w-full min-w-[200px] sm:min-w-[280px] aspect-square max-h-[240px]">
                                            <SafeModelViewer
                                              src={msg.content}
                                              alt={msg.fileName}
                                              autoRotate={true}
                                              cameraControls={true}
                                              showControls={false}
                                            />
                                            <button
                                              onClick={() => setSelectedMedia(msg)}
                                              className="absolute top-3 right-3 p-2 rounded-full bg-black/40 hover:bg-black/80 backdrop-blur-md text-white transition-opacity z-10"
                                              title="Expand 3D Model"
                                            >
                                              <Maximize className="w-4 h-4" />
                                            </button>
                                            <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
                                              <span className="text-xs font-bold text-white drop-shadow-md flex items-center gap-2">
                                                <Box className="w-4 h-4 text-indigo-400" />
                                                3D Model
                                              </span>
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
                                              className={`p-2 rounded-lg transition-all ${msg.sender === "me"
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
                                              className={`flex items-center gap-3 p-3 rounded-2xl transition-all cursor-pointer ${msg.sender === "me"
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
                                                className={`p-3 rounded-xl ${msg.sender === "me"
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
                                                  <FileIcon className="w-6 h-6" />
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
                                                className={`p-2.5 rounded-xl transition-all ${msg.sender === "me"
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
                                  </>
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
                                {msg.isEdited && !msg.isDeleted && (
                                  <span className="text-[10px] text-slate-500 font-bold tracking-tight italic">
                                    (edited)
                                  </span>
                                )}
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
                            {editingMessage && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className={`mb-3 px-3 py-2 rounded-2xl border flex gap-3 relative group overflow-hidden ${isDark ? "bg-amber-500/5 border-amber-500/20" : "bg-amber-50 border-amber-500/20"}`}
                              >
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-0.5">
                                    Editing message
                                  </p>
                                  <p className={`text-xs font-bold truncate ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                                    {editingMessage.content}
                                  </p>
                                </div>
                                <button
                                  onClick={() => {
                                    setEditingMessage(null);
                                    setChatInput("");
                                  }}
                                  className={`p-1 rounded-full transition-colors ${isDark ? "hover:bg-amber-500/10 text-slate-400" : "hover:bg-amber-500/10 text-slate-500"}`}
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </motion.div>
                            )}
                            {replyingTo && !editingMessage && (
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
                                      ? `📄 ${replyingTo.fileName}`
                                      : replyingTo.type === "composite" && !replyingTo.content
                                        ? `📎 ${replyingTo.attachments?.length || 0} attachments`
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
                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] font-black text-indigo-400">
                                    {transferProgress}%
                                  </span>
                                  <button
                                    onClick={() => {
                                      if (activeTransferIdRef.current) {
                                        dcRef.current?.send(JSON.stringify({ type: "chunk_cancel", msgId: activeTransferIdRef.current }));
                                        cancelTokensRef.current.delete(activeTransferIdRef.current);
                                        delete chunksRef.current[activeTransferIdRef.current];
                                        setTransferProgress(0);
                                        setConnectionState("connected");
                                        setMessages(prev => prev.map(m => m.id === activeTransferIdRef.current ? { ...m, status: "error", streamState: "canceled" } : m));
                                        activeTransferIdRef.current = null;
                                      }
                                    }}
                                    className="p-1 hover:bg-red-500/20 text-red-400 rounded-full transition-colors group"
                                    title="Cancel Transfer"
                                  >
                                    <X className="w-3 h-3 group-hover:scale-110 transition-transform" />
                                  </button>
                                </div>
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

                          <AnimatePresence>
                            {(pendingFiles.length > 0 || zippingTasks.length > 0) && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="mb-3 flex overflow-x-auto pb-2 gap-3"
                              >
                                {pendingFiles.map((file, idx) => (
                                  <FilePreviewCard
                                    key={`${file.name}-${idx}`}
                                    file={file}
                                    onRemove={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))}
                                  />
                                ))}
                                {zippingTasks.map((task, idx) => (
                                  <div key={task.id} className="relative group shrink-0 rounded-lg overflow-hidden border border-slate-700/50 bg-slate-800/50 w-48 p-2.5 flex items-center gap-3">
                                    <div className="p-3 rounded-xl bg-white/5 text-white/50 relative flex items-center justify-center">
                                      <RefreshCw className="w-6 h-6 animate-spin absolute text-indigo-400" />
                                      <FileIcon className="w-6 h-6 opacity-30" />
                                    </div>
                                    <div className="flex flex-col min-w-0 flex-1 relative z-10">
                                      <span className="text-xs font-black truncate leading-tight mb-1 text-slate-300 pr-2">
                                        {task.folderName}.zip
                                      </span>
                                      <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-indigo-400">
                                        <span>Zipping {task.progress !== undefined ? `${Math.round(task.progress)}%` : '...'}</span>
                                      </div>
                                    </div>
                                    <div
                                      className="absolute bottom-0 left-0 h-1 bg-indigo-500 transition-all duration-300 ease-linear"
                                      style={{ width: `${task.progress || 0}%` }}
                                    />
                                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() => setZippingTasks(prev => prev.filter(t => t.id !== task.id))}
                                        className="w-6 h-6 rounded-full bg-black/60 hover:bg-red-500 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                          <div className="flex items-center gap-2">
                            <label
                              className={`p-2.5 rounded-full border cursor-pointer transition-all flex shrink-0 items-center justify-center w-[44px] h-[44px] ${isDark
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
                                  const files = Array.from(e.target.files || []);
                                  const validFiles = [];
                                  let hasLarge = false;
                                  for (const f of files) {
                                    if (f.size > MAX_FILE_SIZE) hasLarge = true;
                                    else validFiles.push(f);
                                  }
                                  if (hasLarge) {
                                    setNotification({ message: "Files exceeding 100MB limit were ignored", type: "error" });
                                  }
                                  if (validFiles.length > 0) {
                                    setPendingFiles(prev => [...prev, ...validFiles]);
                                  }
                                  // clear the input so the same file can be selected again
                                  e.target.value = '';
                                }}
                              />
                            </label>

                            <div
                              className={`flex-1 flex items-center rounded-3xl p-1.5 border transition-all shadow-inner min-w-0 ${isDark
                                ? "bg-[#161f30] border-white/5 focus-within:border-indigo-500/50"
                                : "bg-slate-50 border-slate-100 focus-within:border-indigo-500"
                                }`}
                            >
                              <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onPaste={(e) => {
                                  const items = Array.from(e.clipboardData.items);
                                  const files = items
                                    .filter(item => item.kind === 'file')
                                    .map(item => item.getAsFile())
                                    .filter((f): f is File => f !== null);

                                  const validFiles = [];
                                  let hasLarge = false;
                                  for (const f of files) {
                                    if (f.size > MAX_FILE_SIZE) hasLarge = true;
                                    else validFiles.push(f);
                                  }
                                  if (hasLarge) {
                                    setNotification({ message: "Pasted files exceeding 100MB limit were ignored", type: "error" });
                                  }
                                  if (validFiles.length > 0) {
                                    setPendingFiles(prev => [...prev, ...validFiles]);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  e.stopPropagation();
                                  if (e.key === "Enter") sendMessage();
                                  if (e.key === "Escape") {
                                    setChatInput("");
                                    setEditingMessage(null);
                                    setReplyingTo(null);
                                  }
                                }}
                                onKeyUp={(e) => e.stopPropagation()}
                                onFocus={() => setChatInputFocused(true)}
                                onBlur={() => setChatInputFocused(false)}
                                placeholder="Type a message..."
                                className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none placeholder:text-slate-500 font-medium min-w-0"
                              />
                              {!chatInputFocused && chatInput.length > 0 && (
                                <button
                                  onClick={() => {
                                    setChatInput("");
                                    setEditingMessage(null);
                                    setReplyingTo(null);
                                  }}
                                  className="w-[32px] h-[32px] shrink-0 text-slate-400 hover:text-slate-600 sm:hidden flex items-center justify-center transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={sendMessage}
                                disabled={!chatInput.trim() && pendingFiles.length === 0}
                                className="w-[36px] h-[36px] shrink-0 bg-indigo-600 disabled:opacity-50 text-white rounded-full hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/30 flex items-center justify-center"
                              >
                                <Send className="w-4 h-4 ml-0.5" />
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
                              className={`p-2.5 rounded-full border transition-all flex shrink-0 items-center justify-center w-[44px] h-[44px] ${isDark ? "border-red-500/10 bg-red-500/5 hover:bg-red-500/10 text-red-400" : "border-red-50/10 bg-red-50 hover:bg-red-100 text-red-500"}`}
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
                                    <FileIcon className="w-6 h-6 text-indigo-500" />
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
                            const targetMsg = showContextMenu.attachment ? { ...showContextMenu.attachment, type: "file" as any } : msg;

                            return (
                              <div className="flex flex-col gap-1">
                                <button
                                  onClick={() => {
                                    if (targetMsg.type === "text") {
                                      navigator.clipboard.writeText(
                                        targetMsg.content,
                                      );
                                      setCopyStatus({ id: targetMsg.id, status: "success" });
                                      setTimeout(() => setCopyStatus(null), 2000);
                                      setNotification({
                                        message: "Copied to clipboard",
                                        type: "info",
                                      });
                                      setTimeout(() => {
                                        setShowContextMenu(null);
                                      }, 2000);
                                    } else {
                                      setSelectedMedia(targetMsg);
                                    }
                                  }}
                                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${isDark ? "hover:bg-white/5 text-slate-300" : "hover:bg-slate-50 text-slate-700"}`}
                                >
                                  {targetMsg.type === "text" && copyStatus?.id === targetMsg.id && copyStatus?.status === "success" ? (
                                    <Check className="w-4 h-4 text-emerald-500" />
                                  ) : targetMsg.type === "text" ? (
                                    <Copy className="w-4 h-4" />
                                  ) : (
                                    <Eye className="w-4 h-4" />
                                  )}
                                  {targetMsg.type === "text" && copyStatus?.id === targetMsg.id && copyStatus?.status === "success"
                                    ? "Copied"
                                    : targetMsg.type === "text"
                                      ? "Copy Text"
                                      : targetMsg.fileType === "video"
                                        ? "Play / Open"
                                        : "Open"}
                                </button>
                                <button
                                  onClick={() => {
                                    setReplyingTo(targetMsg);
                                    setShowContextMenu(null);
                                  }}
                                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${isDark ? "hover:bg-white/5 text-slate-300" : "hover:bg-slate-50 text-slate-700"}`}
                                >
                                  <CornerDownRight className="w-4 h-4" />
                                  Reply
                                </button>
                                {targetMsg.type === "file" && (
                                  <button
                                    onClick={() => {
                                      handleMediaCopy(targetMsg);
                                      setTimeout(() => {
                                        setShowContextMenu(null);
                                      }, 2000);
                                    }}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${isDark ? "hover:bg-white/5 text-slate-300" : "hover:bg-slate-50 text-slate-700"}`}
                                  >
                                    {copyStatus?.id === targetMsg.id && copyStatus.status === "success" ? (
                                      <Check className="w-4 h-4 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-4 h-4" />
                                    )}
                                    {copyStatus?.id === targetMsg.id && copyStatus.status === "success"
                                      ? "Copied"
                                      : targetMsg.fileType === "image" ? "Copy Image" : targetMsg.fileType === "text_file" ? "Copy Content" : "Copy Asset"}
                                  </button>
                                )}
                                {targetMsg.type === "file" && (
                                  <a
                                    href={targetMsg.content}
                                    download={targetMsg.fileName}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${isDark ? "hover:bg-white/5 text-slate-300" : "hover:bg-slate-50 text-slate-700"}`}
                                  >
                                    <Download className="w-4 h-4" />
                                    Download
                                  </a>
                                )}
                                {msg.sender === "me" && (msg.type === "text" || msg.type === "composite") && !msg.isDeleted && (
                                  <button
                                    onClick={() => {
                                      setEditingMessage(msg);
                                      setChatInput(msg.content);
                                      setShowContextMenu(null);
                                    }}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${isDark ? "hover:bg-white/5 text-slate-300" : "hover:bg-slate-50 text-slate-700"}`}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                    Edit
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setMessages((prev) =>
                                      prev.filter((m) => m.id !== msg.id),
                                    );
                                    setShowContextMenu(null);
                                  }}
                                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${isDark ? "hover:bg-red-500/10 text-red-400" : "hover:bg-red-50 text-red-600"}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete for me
                                </button>
                                {msg.sender === "me" && (
                                  <button
                                    onClick={() => {
                                      setMessages((prev) =>
                                        prev.map((m) =>
                                          m.id === msg.id ? { ...m, isDeleted: true, content: "", attachments: [] } : m,
                                        ),
                                      );
                                      if (dcRef.current && dcRef.current.readyState === "open") {
                                        dcRef.current.send(JSON.stringify({ type: "msg_delete", msgId: msg.id }));
                                      }
                                      setShowContextMenu(null);
                                    }}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${isDark ? "hover:bg-red-500/10 text-red-400" : "hover:bg-red-50 text-red-600"}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete for everyone
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>
                </div>

                <MediaCarousel
                  isOpen={!!selectedMedia}
                  onClose={() => setSelectedMedia(null)}
                  items={mediaMsgs}
                  selectedIndex={selectedMediaIdx}
                  onIndexChange={(idx) => setSelectedMedia(mediaMsgs[idx])}
                  keepMounted={true}
                  renderHeaderMiddle={(item, index, total) => (
                    <>
                      <p className="text-sm sm:text-base font-black mb-0.5 truncate w-full px-4">
                        {item.fileName}
                      </p>
                      <div className="flex items-center gap-2 opacity-80 text-[10px] sm:text-xs font-bold uppercase tracking-widest whitespace-nowrap overflow-hidden text-ellipsis">
                        <span className="hidden sm:inline">
                          {formatFileSize(item.fileSize || 0)}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-white/50 shrink-0 hidden sm:inline" />
                        <span className="truncate hidden sm:inline">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-white/50 shrink-0 hidden sm:inline" />
                        <span>
                          {index + 1} / {total}
                        </span>
                      </div>
                    </>
                  )}
                  renderHeaderRight={(item) => (
                    <>
                      {item.fileType === "image" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setImageRotation((r) => (r + 90) % 360);
                          }}
                          className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md flex items-center justify-center"
                          title="Rotate"
                        >
                          <RotateCw className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMediaCopy(item);
                        }}
                        className={`p-3 rounded-full transition-all backdrop-blur-md flex items-center justify-center ${copyStatus?.id === item.id && copyStatus.status === 'success' ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                        title="Copy"
                      >
                        {copyStatus?.id === item.id && copyStatus.status === "success" ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <a
                        onClick={(e) => e.stopPropagation()}
                        href={item.content}
                        download={item.fileName || "download"}
                        className="p-3 bg-indigo-600 rounded-full hover:bg-indigo-700 text-white transition-all backdrop-blur-md flex items-center justify-center shadow-lg"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </>
                  )}
                  renderItem={(item, isSelected) => {
                    const effectiveFileType = item.fileType === "file" && item.fileName ? getFileType(item.fileName) : item.fileType;

                    return (
                      <>
                        {effectiveFileType === "image" && (
                          <div className="w-full h-full relative flex items-center justify-center pointer-events-auto">
                            <InteractiveZoomImage
                              src={item.content}
                              alt={item.fileName || "Preview"}
                              rotation={imageRotation}
                              className="rounded-xl shadow-2xl"
                            />
                          </div>
                        )}
                        {effectiveFileType === "video" && (
                          <VideoPlayer media={item} isSelected={isSelected} />
                        )}
                        {effectiveFileType === "audio" && (
                          <AudioPlayer media={item} isSelected={isSelected} />
                        )}
                        {effectiveFileType === "pdf" && (
                          <div className="w-full h-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl flex flex-col relative select-none pointer-events-auto">
                            <PdfViewer url={item.content} />
                          </div>
                        )}
                        {effectiveFileType === "text_file" && (
                          <div className="w-[90%] h-[90%] max-w-5xl bg-[#1e1e1e] rounded-3xl overflow-hidden shadow-2xl flex flex-col relative z-[12005] pointer-events-auto">
                            <div className="flex-1 overflow-auto p-6 md:p-10 text-xs sm:text-sm font-mono text-slate-300 whitespace-pre-wrap select-text selection:bg-indigo-500/30 selection:text-white">
                              <TextFileViewer url={item.content} />
                            </div>
                          </div>
                        )}
                        {effectiveFileType === "3d_model" && (
                          <div className="w-full h-full relative flex items-center justify-center pointer-events-auto bg-[#0d1017]">
                            <SafeModelViewer
                              src={item.content}
                              alt={item.fileName}
                              autoRotate={true}
                              cameraControls={true}
                              showControls={true}
                            />
                          </div>
                        )}
                        {effectiveFileType === "file" && (
                          <div className="max-w-sm w-full bg-[#161f30] rounded-3xl overflow-hidden shadow-2xl flex flex-col items-center justify-center p-8 border border-white/5 text-center pointer-events-auto">
                            <FileIcon className="w-20 h-20 text-indigo-500 mb-6" />
                            <h3 className="text-lg font-bold text-white mb-2 break-all line-clamp-3">{item.fileName}</h3>
                            <p className="text-slate-400 text-[10px] mb-8 uppercase tracking-widest font-bold">{item.fileSize ? formatFileSize(item.fileSize) : "Unknown Size"}</p>
                            <a href={item.content} download={item.fileName} className="px-6 py-3 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 pointer-events-auto">
                              <Download className="w-4 h-4" />
                              Download File
                            </a>
                          </div>
                        )}
                      </>
                    );
                  }}
                />
              </div>
            );

            return isFullscreen
              ? createPortal(
                <div
                  className={`fixed inset-0 z-[10000] backdrop-blur-sm p-0 sm:p-2 flex items-center justify-center nodrag nowheel ${isDark ? "bg-black/90" : "bg-slate-900/50"}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseUp={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                  onWheel={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
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

      {isFullscreenQR && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/90 backdrop-blur-md"
          onWheel={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setIsFullscreenQR(false); }}
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all z-[100001]"
          >
            <X size={24} />
          </button>
          <div className="w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <TransformWrapper
              initialScale={1}
              minScale={0.5}
              maxScale={10}
              centerOnInit
              wheel={{
                step: 0.01,          // Much smaller than 0.1
                wheelDisabled: false,
                touchPadDisabled: false,
              }}
              pinch={{
                step: 5,
              }}
              doubleClick={{
                disabled: false,
                step: 1.5,
              }}
            >
              <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex items-center justify-center">
                <div className="p-8 bg-white rounded-3xl shadow-2xl">
                  <QRCodeSVG
                    value={broadcastFrames.length > 0 ? broadcastFrames[currentFrameIndex] : (offerQR || answerQR)}
                    size={400}
                    level={qrDensity}
                    marginSize={2}
                    className="w-[80vw] h-[80vw] max-w-[400px] max-h-[400px] sm:max-w-[500px] sm:max-h-[500px]"
                  />
                </div>
              </TransformComponent>
            </TransformWrapper>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

