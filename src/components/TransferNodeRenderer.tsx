
import React, { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Share2, Smartphone, Monitor, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { WebRTCPeer, ConnectionState } from "../lib/webrtc";
import { captureWorkspaceSnapshot } from "../utils/workspaceSerializer";
import { useStore } from "../store/useStore";
import { db } from "../lib/db";

interface TransferNodeRendererProps {
  node: any;
}

export const TransferNodeRenderer: React.FC<TransferNodeRendererProps> = ({ node }) => {
  const [peer, setPeer] = useState<WebRTCPeer | null>(null);
  const [state, setState] = useState<ConnectionState>("Waiting");
  const [offerCode, setOfferCode] = useState<string>("");
  const [answerCode, setAnswerCode] = useState<string>("");
  const [showScanner, setShowScanner] = useState(false);
  const [receivedData, setReceivedData] = useState<any>(null);
  
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const setCode = useStore(s => s.setCode);

  useEffect(() => {
    const newPeer = new WebRTCPeer();
    newPeer.on("stateChange", (s: ConnectionState) => setState(s));
    newPeer.on("message", (msg) => {
      setReceivedData(msg);
      // Automatically handle workspace snapshots
      if (msg.type === "workspace_snapshot") {
        handleReceivedSnapshot(msg.data);
      }
    });

    setPeer(newPeer);
    
    return () => {
      newPeer.destroy();
    };
  }, []);

  const handleReceivedSnapshot = async (snapshot: any) => {
    try {
      // Save to IndexedDB
      const docId = await db.documents.add({
        name: snapshot.name || `Received ${new Date().toLocaleTimeString()}`,
        code: snapshot.code,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      
      // Update store
      setCode(snapshot.code);
      useStore.getState().setActiveDocumentId(docId);
      useStore.getState().setActiveDocumentName(snapshot.name);
    } catch (err) {
      console.error("Failed to save received snapshot", err);
    }
  };

  const startOffer = async () => {
    if (!peer) return;
    const code = await peer.createOffer();
    setOfferCode(code);
    setState("Pairing");
  };

  const startAnswer = () => {
    setShowScanner(true);
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
      scanner.render(async (decodedText) => {
        scanner.clear();
        setShowScanner(false);
        if (!peer) return;
        const answer = await peer.acceptOffer(decodedText);
        setAnswerCode(answer);
        setState("Pairing");
      }, (err) => {});
      scannerRef.current = scanner;
    }, 100);
  };

  const submitAnswer = async () => {
    if (!peer || !answerCode) return;
    await peer.acceptAnswer(answerCode);
  };

  const sendWorkspace = () => {
    if (!peer) return;
    const snapshot = captureWorkspaceSnapshot();
    peer.send({ type: "workspace_snapshot", data: snapshot });
  };

  return (
    <div className="flex flex-col gap-4 p-5 bg-white dark:bg-[#0d1117] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden min-w-[320px]">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
            <Share2 size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Direct Transfer</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">P2P Secure Connection</p>
          </div>
        </div>
        <div className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
          state === "Connected" ? "bg-emerald-500/10 text-emerald-500" :
          state === "Failed" ? "bg-red-500/10 text-red-500" :
          "bg-slate-500/10 text-slate-500"
        }`}>
          {state}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {state === "Waiting" && (
          <motion.div 
            key="waiting"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-3"
          >
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Transfer nodes, documents, or your entire workspace instantly between devices using WebRTC. 
              No accounts required.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={startOffer}
                className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group"
              >
                <Monitor size={24} className="mb-2 text-slate-400 group-hover:text-blue-500" />
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">Host Transfer</span>
              </button>
              <button
                onClick={startAnswer}
                className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all group"
              >
                <Smartphone size={24} className="mb-2 text-slate-400 group-hover:text-emerald-500" />
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">Join / Scan</span>
              </button>
            </div>
          </motion.div>
        )}

        {state === "Pairing" && (
          <motion.div 
            key="pairing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4 py-2"
          >
            {offerCode && !answerCode && (
              <div className="flex flex-col items-center gap-3">
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <QRCodeSVG value={offerCode} size={180} level="L" />
                </div>
                <p className="text-[10px] text-center text-slate-500 max-w-[200px]">
                  Scan this QR code on the receiving device to link them.
                </p>
                <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 10, repeat: Infinity }}
                    className="h-full bg-blue-500"
                  />
                </div>
              </div>
            )}

            {answerCode && (
              <div className="flex flex-col items-center gap-3 w-full">
                <CheckCircle2 size={40} className="text-emerald-500" />
                <div className="text-center">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">Codes Generated</h4>
                  <p className="text-[10px] text-slate-500 mt-1">Establishing secure tunnel...</p>
                </div>
                <button
                  onClick={submitAnswer}
                  className="w-full py-2 bg-blue-600 text-white text-xs font-bold rounded-lg shadow-lg shadow-blue-500/20"
                >
                  Finalize Connection
                </button>
              </div>
            )}
          </motion.div>
        )}

        {state === "Connected" && (
          <motion.div 
            key="connected"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col gap-4"
          >
            <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-full">
                <Monitor size={16} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Device Connected</p>
                <p className="text-[9px] text-slate-500 uppercase tracking-tighter font-mono">P2P_TUNNEL_ACTIVE</p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={sendWorkspace}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Share2 size={14} />
                Send Current Workspace
              </button>
              <button
                className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 opacity-50 cursor-not-allowed"
                disabled
              >
                Send Selective Nodes (Coming Soon)
              </button>
            </div>

            {receivedData && (
              <div className="mt-2 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mb-1">Last Received:</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-600 dark:text-slate-300 truncate max-w-[150px]">
                    {receivedData.data?.name || "Shared Data"}
                  </span>
                  <CheckCircle2 size={12} className="text-emerald-500" />
                </div>
              </div>
            )}
          </motion.div>
        )}

        {state === "Failed" && (
          <motion.div 
            key="failed"
            className="flex flex-col items-center gap-3 py-4"
          >
            <AlertCircle size={40} className="text-red-500" />
            <div className="text-center">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">Connection Failed</h4>
              <p className="text-[10px] text-slate-500 mt-1">Network restrictions or Timeout.</p>
            </div>
            <button
              onClick={() => {
                setOfferCode("");
                setAnswerCode("");
                setState("Waiting");
              }}
              className="px-4 py-2 bg-slate-800 text-white text-[10px] font-bold rounded-lg"
            >
              Try Again
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {showScanner && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center p-5">
          <div className="bg-[#0d1117] rounded-2xl w-full max-w-sm overflow-hidden border border-slate-800">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <span className="text-sm font-bold text-white">Scan Device QR</span>
              <button onClick={() => setShowScanner(false)} className="text-slate-400">
                <AlertCircle size={20} className="rotate-45" />
              </button>
            </div>
            <div id="reader" className="w-full aspect-square"></div>
            <p className="p-4 text-[10px] text-slate-500 text-center uppercase tracking-widest bg-black/20">
              Point your camera at the host's QR code
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
