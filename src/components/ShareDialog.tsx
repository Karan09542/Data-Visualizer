import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Copy, Check, AlertTriangle, Info, Share2, FileJson, Zap, Link as LinkIcon, Download, Trash2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useAnnotationStore } from '../store/useAnnotationStore';
import { estimateShareSize, getShareUrl, compressState, serializeState, simplifyAnnotations } from '../utils/shareUtils';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareDialog({ isOpen, onClose }: ShareDialogProps) {
  const { 
    code,
    codeFormat,
    layoutMode,
    nodeTheme,
    edgeStyle,
    nodeShape,
    appTheme,
    canvasBackgroundColor,
    canvasPatternColor
  } = useStore();

  const { annotations } = useAnnotationStore();
  
  const [useOptimized, setUseOptimized] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const currentSettings = {
    layoutMode,
    nodeTheme,
    edgeStyle,
    nodeShape,
    appTheme,
    canvasBackgroundColor,
    canvasPatternColor
  };

  const shareInfo = useMemo(() => {
    const targetAnnotations = useOptimized ? simplifyAnnotations(annotations) : annotations;
    return estimateShareSize(code, currentSettings, targetAnnotations);
  }, [code, currentSettings, annotations, useOptimized]);

  const shareUrl = useMemo(() => {
    const targetAnnotations = useOptimized ? simplifyAnnotations(annotations) : annotations;
    const json = serializeState(code, currentSettings, targetAnnotations);
    const compressed = compressState(json);
    return getShareUrl(compressed);
  }, [code, currentSettings, annotations, useOptimized]);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch (err) {
      console.error('Failed to copy share URL:', err);
    }
  };

  const getStatusConfig = () => {
    switch (shareInfo.status) {
      case 'safe':
        return {
          title: 'Ready to Share',
          color: 'text-green-500',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/20',
          icon: <Check size={20} className="text-green-500" />,
          description: 'This visualization is compact and safe for all platforms.'
        };
      case 'moderate':
        return {
          title: 'Moderate Size',
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/20',
          icon: <Info size={20} className="text-yellow-500" />,
          description: 'Link is slightly long. Most platforms support this, but some social sites might truncate it.'
        };
      case 'large':
        return {
          title: 'Large Visualization',
          color: 'text-orange-500',
          bgColor: 'bg-orange-500/10',
          borderColor: 'border-orange-500/20',
          icon: <AlertTriangle size={20} className="text-orange-500" />,
          description: 'This is a heavy project. Some browser environments or sharing services may not handle this link correctly.'
        };
      case 'unsafe':
        return {
          title: 'Too Large to Share',
          color: 'text-red-500',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/20',
          icon: <AlertTriangle size={20} className="text-red-500" />,
          description: 'This project exceeds safe URL limits. Sharing via URL is disabled to prevent broken features.'
        };
    }
  };

  const config = getStatusConfig();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
        />

        {/* Dialog Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl">
                <Share2 size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 italic">Share Visualization</h2>
                <p className="text-xs text-slate-500 font-medium">Create a persistent sharing link</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Status Card */}
            <div className={`p-4 rounded-2xl border ${config.borderColor} ${config.bgColor} space-y-2`}>
              <div className="flex items-center gap-2">
                {config.icon}
                <span className={`font-bold ${config.color} uppercase tracking-wider text-xs`}>{config.title}</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {config.description}
              </p>
            </div>

            {/* Analysis & Optimization */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-slate-400" />
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Efficiency</span>
                </div>
                <div className="flex items-center gap-4">
                   <label className="flex items-center gap-2 cursor-pointer group">
                     <span className="text-[10px] font-bold text-slate-400 group-hover:text-blue-500 transition-colors uppercase">Optimize Data</span>
                     <div 
                       className={`w-8 h-4 rounded-full relative transition-colors ${useOptimized ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                       onClick={() => setUseOptimized(!useOptimized)}
                     >
                       <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow-sm ${useOptimized ? 'left-4.5' : 'left-0.5'}`} />
                     </div>
                   </label>
                </div>
              </div>

              {/* Progress-like Size Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                  <span>URL Payload Capacity</span>
                  <span>{Math.round((shareInfo.urlLength / 32000) * 100)}% Used</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (shareInfo.urlLength / 32000) * 100)}%` }}
                    className={`h-full rounded-full ${
                      shareInfo.status === 'safe' ? 'bg-green-500' :
                      shareInfo.status === 'moderate' ? 'bg-yellow-500' :
                      shareInfo.status === 'large' ? 'bg-orange-500' : 'bg-red-500'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Action Area */}
            {shareInfo.status !== 'unsafe' ? (
              <div className="space-y-3">
                 <div className="relative group">
                    <input 
                      readOnly
                      value={shareUrl}
                      className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs font-mono text-slate-500 truncate pr-10 focus:ring-0 outline-none"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 group-hover:text-blue-500 transition-colors">
                      <LinkIcon size={14} />
                    </div>
                 </div>
                 
                 <button
                    onClick={handleCopy}
                    disabled={copied}
                    className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg ${
                      copied 
                        ? 'bg-green-500 text-white shadow-green-500/20' 
                        : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-slate-900/10'
                    }`}
                 >
                   {copied ? <Check size={18} /> : <Copy size={18} />}
                   {copied ? 'Copied to Clipboard!' : 'Copy Sharing Link'}
                 </button>
              </div>
            ) : (
              <div className="space-y-4">
                 <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/10 flex flex-col gap-3">
                   <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Recommended Actions</span>
                   <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-2 list-disc pl-4 italic">
                     <li>Reduce large JSON data size</li>
                     <li>Simplify complex annotation paths (use hand-drawn sparingly)</li>
                     <li>Export as project file instead</li>
                   </ul>
                 </div>
                 <button
                    onClick={() => {
                        // Trigger file download fallback if needed
                        try {
                          const formatStr = codeFormat || 'json';
                          const blob = new Blob([code], { type: formatStr === 'json' ? 'application/json' : formatStr === 'yaml' ? 'application/yaml' : 'text/csv' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `exported_data.${formatStr}`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                          useStore.getState().setNotification({ message: `Successfully exported and downloaded exported_data.${formatStr}`, type: 'success' });
                        } catch (err) {
                          useStore.getState().setNotification({ message: 'Failed to download data file.', type: 'error' });
                        }
                    }}
                    className="w-full py-3 border-2 border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-300 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                 >
                   <Download size={18} /> Export as {String(codeFormat || 'json').toUpperCase()} File Instead
                 </button>
              </div>
            )}

            {/* Diagnostics Toggle */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
               <button 
                 onClick={() => setShowDiagnostics(!showDiagnostics)}
                 className="flex items-center gap-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 uppercase tracking-widest transition-colors mb-3"
               >
                 <Info size={12} />
                 {showDiagnostics ? 'Hide System Diagnostics' : 'Show System Diagnostics'}
               </button>
               
               {showDiagnostics && (
                 <motion.div 
                   initial={{ height: 0, opacity: 0 }}
                   animate={{ height: 'auto', opacity: 1 }}
                   className="grid grid-cols-2 gap-3"
                 >
                   <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800 flex flex-col">
                      <span className="text-[9px] text-slate-400 uppercase font-black tracking-tighter">Raw Data</span>
                      <span className="text-sm font-mono text-slate-600 dark:text-slate-300">{(shareInfo.rawSize / 1024).toFixed(1)} KB</span>
                   </div>
                   <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800 flex flex-col">
                      <span className="text-[9px] text-slate-400 uppercase font-black tracking-tighter">Compressed</span>
                      <span className="text-sm font-mono text-slate-600 dark:text-slate-300">{(shareInfo.compressedSize / 1024).toFixed(1)} KB</span>
                   </div>
                   <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800 flex flex-col">
                      <span className="text-[9px] text-slate-400 uppercase font-black tracking-tighter">Compression Ratio</span>
                      <span className="text-sm font-mono text-blue-500">{shareInfo.ratio.toFixed(1)}%</span>
                   </div>
                   <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800 flex flex-col">
                      <span className="text-[9px] text-slate-400 uppercase font-black tracking-tighter">Final URL Length</span>
                      <span className="text-sm font-mono text-slate-600 dark:text-slate-300">{shareInfo.urlLength} chars</span>
                   </div>
                 </motion.div>
               )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
