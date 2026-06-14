import React, { useState, useEffect, useRef, useCallback } from "react";
import { HierarchyPointNode } from "d3";
import { TreeNode } from "../utils/transformer";
import { useStore } from "../store/useStore";
import { QRCodeSVG } from "qrcode.react";
import jsQR from "jsqr";
import LZString from "lz-string";
import { Copy, Plus, Video, Image as ImageIcon, Send, MessageSquare, X, RefreshCw, UploadCloud, Download, Check, File } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { motion } from "motion/react";
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
  const { data: treeData, setData, activeTheme, setNotification } = useStore();
  const [connectionState, setConnectionState] = useState<"waiting" | "pairing" | "connected" | "transferring" | "messaging" | "failed">("waiting");
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  
  const [offerQR, setOfferQR] = useState("");
  const [answerQR, setAnswerQR] = useState("");

  const [scanMode, setScanMode] = useState<"offer" | "answer" | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  
  const [transferProgress, setTransferProgress] = useState(0);
  const [copyPasteOffer, setCopyPasteOffer] = useState("");
  const [copyPasteAnswer, setCopyPasteAnswer] = useState("");
  
  const initPeer = () => {
    if (pcRef.current) pcRef.current.close();
    
    // Simplest STUN servers
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });
    
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "connected") {
        setConnectionState("connected");
      } else if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
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
      setNotification({ message: "Direct device connection established!", type: "success" });
    };
    dc.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "text") {
          setMessages(prev => [...prev, { id: uuidv4(), sender: "remote", type: "text", content: msg.content, timestamp: Date.now() }]);
        } else if (msg.type === "file_chunk") {
          // Simplistic assembly (requires full rewrite for large files, handled below simply)
        } else if (msg.type === "file") {
           setMessages(prev => [...prev, { id: uuidv4(), sender: "remote", type: "file", fileName: msg.fileName, content: msg.content, timestamp: Date.now() }]);
        } else if (msg.type === "workspace") {
          try {
             const parsed = JSON.parse(msg.content);
             setData(parsed);
             setNotification({ message: "Received and loaded workspace!", type: "success" });
          } catch(err) {}
        }
      } catch (err) { }
    };
  };

  const generateOffer = async () => {
    const pc = initPeer();
    const dc = pc.createDataChannel("transfer");
    handleDataChannel(dc);
    
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    // Wait a brief moment for ICE candidates to gather if possible
    setTimeout(() => {
      const currentDesc = pc.localDescription;
      if (currentDesc) {
        const payload = JSON.stringify(currentDesc);
        const compressed = LZString.compressToUTF16(payload);
        setOfferQR(compressed);
        setConnectionState("waiting");
      }
    }, 1000);
  };

  const handleScan = (code: string) => {
     try {
       const uncompressed = LZString.decompressFromUTF16(code);
       const desc = JSON.parse(uncompressed || code);
       if (desc.type === "offer") {
         processOffer(desc);
       } else if (desc.type === "answer") {
         processAnswer(desc);
       }
     } catch(e) {
       setNotification({ message: "Invalid pairing code scanned", type: "error" });
     }
  };

  const processOffer = async (offer: any) => {
    const pc = initPeer();
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    setTimeout(() => {
       const currentDesc = pc.localDescription;
       if (currentDesc) {
          const payload = JSON.stringify(currentDesc);
          const compressed = LZString.compressToUTF16(payload);
          setAnswerQR(compressed);
          setScanMode(null);
       }
    }, 1000);
  };

  const processAnswer = async (answer: any) => {
    if (pcRef.current) {
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      setScanMode(null);
    }
  };

  const sendMessage = () => {
    if (!chatInput.trim() || !dcRef.current || dcRef.current.readyState !== "open") return;
    const msg: Message = { id: uuidv4(), sender: "me", type: "text", content: chatInput, timestamp: Date.now() };
    dcRef.current.send(JSON.stringify(msg));
    setMessages(prev => [...prev, msg]);
    setChatInput("");
  };

  const sendWorkspace = () => {
    if (!dcRef.current || dcRef.current.readyState !== "open") return;
    const wsStr = JSON.stringify(treeData);
    const msg = { type: "workspace", content: wsStr };
    dcRef.current.send(JSON.stringify(msg));
    setNotification({ message: "Workspace synced to remote device", type: "info" });
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let scanInterval: any = null;

    if (scanMode && videoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then((str) => {
          stream = str;
          if (videoRef.current) {
            videoRef.current.srcObject = str;
            videoRef.current.setAttribute("playsinline", "true");
            videoRef.current.play();
            
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            
            scanInterval = setInterval(() => {
              if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && ctx) {
                canvas.width = videoRef.current.videoWidth;
                canvas.height = videoRef.current.videoHeight;
                ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                if (code && code.data) {
                  handleScan(code.data);
                }
              }
            }, 500);
          }
        })
        .catch(err => {
           setNotification({ message: "Camera access denied", type: "error" });
           setScanMode(null);
        });
    }

    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (scanInterval) clearInterval(scanInterval);
    };
  }, [scanMode]);

  return (
    <div className={`w-full max-w-sm rounded-lg overflow-hidden border shadow-sm ${activeTheme === "dark" ? "bg-slate-900 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-800"}`}>
      <div className={`px-4 py-2 text-sm font-medium border-b flex justify-between items-center ${activeTheme === "dark" ? "border-slate-800 bg-slate-800/50" : "border-slate-100 bg-slate-50"}`}>
        <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Transfer Node</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
          {connectionState}
        </span>
      </div>

      <div className="p-4">
        {connectionState !== "connected" ? (
          <div className="space-y-4 flex flex-col items-center">
             {!scanMode && !offerQR && !answerQR && (
               <>
                 <button onClick={generateOffer} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium transition-colors">
                   Generate QR Offer
                 </button>
                 <button onClick={() => setScanMode("offer")} className="w-full py-2 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded text-sm font-medium transition-colors">
                   Scan QR Offer (Receive)
                 </button>
               </>
             )}
             
             {scanMode === "offer" && (
                <div className="w-full flex justify-center flex-col items-center gap-2">
                   <p className="text-xs text-center text-slate-500">Point camera at sender's QR code</p>
                   <video ref={videoRef} className="w-full aspect-square rounded bg-black object-cover" />
                   <button onClick={() => setScanMode(null)} className="text-xs text-red-500">Cancel</button>
                </div>
             )}

             {scanMode === "answer" && (
                <div className="w-full flex justify-center flex-col items-center gap-2">
                   <p className="text-xs text-center text-slate-500">Scan receiver's answer QR</p>
                   <video ref={videoRef} className="w-full aspect-square rounded bg-black object-cover" />
                   <button onClick={() => setScanMode(null)} className="text-xs text-red-500">Cancel</button>
                </div>
             )}

             {offerQR && !scanMode && connectionState !== "connected" && (
               <div className="flex flex-col items-center gap-3">
                 <p className="text-xs text-center text-slate-500">Scan this code on the other device</p>
                 <div className="bg-white p-2 rounded shadow-sm">
                   <QRCodeSVG value={offerQR} size={150} level="L" />
                 </div>
                 
                 <div className="flex gap-2 w-full mt-2">
                   <input type="text" placeholder="Paste return answer code here..." className="flex-1 text-xs px-2 py-1 border rounded bg-transparent" value={copyPasteAnswer} onChange={e => setCopyPasteAnswer(e.target.value)} />
                   <button onClick={() => handleScan(copyPasteAnswer)} className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs">Verify</button>
                 </div>

                 <button onClick={() => setScanMode("answer")} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm font-medium transition-colors">
                   Scan Answer
                 </button>
                 <button onClick={() => navigator.clipboard.writeText(offerQR)} className="w-full py-1.5 border hover:bg-slate-50 dark:hover:bg-slate-800 rounded text-xs transition-colors">
                   Copy Offer string manually
                 </button>
               </div>
             )}

             {answerQR && !scanMode && connectionState !== "connected" && (
                <div className="flex flex-col items-center gap-3 w-full">
                  <p className="text-xs text-center text-slate-500">Show this answer QR to the sender</p>
                  <div className="bg-white p-2 rounded flex-shrink-0">
                    <QRCodeSVG value={answerQR} size={150} level="L" />
                  </div>
                  <button onClick={() => navigator.clipboard.writeText(answerQR)} className="w-full py-1.5 border hover:bg-slate-50 dark:hover:bg-slate-800 rounded text-xs transition-colors mt-2">
                   Copy Answer string manually
                 </button>
                </div>
             )}
             
             {!offerQR && !answerQR && !scanMode && connectionState !== "connected" && (
                <div className="flex gap-2 w-full border-t border-slate-200 dark:border-slate-800 pt-3 mt-1">
                   <input type="text" placeholder="Or paste offer code here..." className="flex-1 text-xs px-2 py-1 border rounded bg-transparent" value={copyPasteOffer} onChange={e => setCopyPasteOffer(e.target.value)} />
                   <button onClick={() => handleScan(copyPasteOffer)} className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs">Connect</button>
                </div>
             )}
          </div>
        ) : (
          <div className="flex flex-col h-64">
            <div className={`flex-1 overflow-y-auto mb-3 space-y-2 pr-1 ${activeTheme === "dark" ? "scrollbar-dark" : "scrollbar"}`}>
               {messages.length === 0 && (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500 text-center">
                    Connection established. Send files, messages, or your workspace.
                  </div>
               )}
               {messages.map(msg => (
                 <div key={msg.id} className={`flex flex-col ${msg.sender === "me" ? "items-end" : "items-start"}`}>
                   <div className={`max-w-[85%] rounded px-3 py-1.5 text-sm ${msg.sender === "me" ? "bg-indigo-600 text-white" : activeTheme === "dark" ? "bg-slate-800" : "bg-slate-100"}`}>
                      {msg.type === "text" ? msg.content : (
                         <div className="flex flex-col gap-1 items-center">
                            <File className="w-6 h-6" />
                            <span className="text-xs font-medium">{msg.fileName}</span>
                         </div>
                      )}
                   </div>
                   <span className="text-[10px] text-slate-500 mt-0.5">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                 </div>
               ))}
            </div>
            
            <div className="flex gap-2 mb-2">
               <button onClick={sendWorkspace} className={`flex-1 flex gap-1 items-center justify-center py-1.5 rounded text-xs border transition-colors ${activeTheme === "dark" ? "border-slate-700 hover:bg-slate-800" : "border-slate-200 hover:bg-slate-50"}`}>
                 <Globe className="w-3.5 h-3.5" /> Sync Workspace
               </button>
               <label className={`flex-1 flex gap-1 items-center justify-center py-1.5 rounded text-xs border transition-colors cursor-pointer ${activeTheme === "dark" ? "border-slate-700 hover:bg-slate-800" : "border-slate-200 hover:bg-slate-50"}`}>
                  <UploadCloud className="w-3.5 h-3.5" /> Send File
                  <input type="file" className="hidden" onChange={(e) => {
                     const file = e.target.files?.[0];
                     if (!file || !dcRef.current) return;
                     const reader = new FileReader();
                     reader.onload = (re) => {
                        const content = re.target?.result as string;
                        const msg = { type: "file", fileName: file.name, content };
                        dcRef.current?.send(JSON.stringify(msg));
                        setMessages(prev => [...prev, { id: uuidv4(), sender: "me", type: "file", fileName: file.name, content: "", timestamp: Date.now() }]);
                     };
                     reader.readAsDataURL(file);
                  }} />
               </label>
            </div>
            
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendMessage()}
                placeholder="Type a message..."
                className={`flex-1 bg-transparent border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 ${activeTheme === "dark" ? "border-slate-700" : "border-slate-300"}`}
              />
              <button onClick={sendMessage} className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
