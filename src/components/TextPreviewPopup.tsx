import React from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check, Type, Edit3, Save, FileText, Layout, Globe } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

const TextPreviewPopup: React.FC = () => {
  const { activePreviewText, activePreviewPath, setActivePreviewText, updateNodeValue } = useStore();
  const [copied, setCopied] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'raw' | 'markdown' | 'html' | 'edit'>('raw');
  const [editText, setEditText] = React.useState('');

  const initializedPathRef = React.useRef<string | null>(null);
  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (!activePreviewPath) {
      initializedPathRef.current = null;
      return;
    }
    
    if (activePreviewText && activePreviewPath !== initializedPathRef.current) {
      initializedPathRef.current = activePreviewPath;
      setEditText(activePreviewText);
      const val = activePreviewText.toLowerCase().trim();
      if (
        val.startsWith('<html') || 
        val.startsWith('<!doc') || 
        val.includes('<head>') || 
        val.includes('<body>') || 
        val.includes('</div>') || 
        val.includes('</p>') ||
        val.includes('</a>')
      ) {
        setViewMode('html');
      } else if (activePreviewText.startsWith('#') || activePreviewText.includes('\n# ')) {
        setViewMode('markdown');
      } else {
        setViewMode('raw');
      }
    }
  }, [activePreviewText, activePreviewPath]);

  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  if (!activePreviewText) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(editText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };



  return createPortal(
    <AnimatePresence>
      {activePreviewText && (
        <div 
          className="fixed inset-0 z-[10000] flex items-center justify-center sm:p-4 bg-slate-950/90 backdrop-blur-sm"
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <motion.div
             initial={{ opacity: 0, scale: 0.98, y: 10 }}
             animate={{ opacity: 1, scale: 1, y: 0 }}
             exit={{ opacity: 0, scale: 0.98, y: 10 }}
             className="relative w-full max-w-5xl h-[100dvh] sm:h-full max-h-none sm:max-h-[90vh] bg-slate-900 border-0 sm:border border-slate-800 shadow-2xl rounded-none sm:rounded-xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex flex-row items-center justify-between gap-3 pl-4 pr-2 py-2 sm:py-2.5 bg-slate-900 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-md shrink-0">
                  <Type size={16} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white tracking-tight truncate">
                      {viewMode === 'edit' ? 'Editor' : (viewMode === 'markdown' ? 'Markdown' : (viewMode === 'html' ? 'HTML' : 'Raw View'))}
                    </h3>
                    <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700 font-mono uppercase shrink-0">
                      {activePreviewPath?.split('.').pop()}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono truncate max-w-[150px] sm:max-w-xs" title={activePreviewPath || ''}>
                    {activePreviewPath}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                {/* Mode Toggles */}
                <div className="flex bg-slate-950 rounded-lg p-0.5 border border-slate-800 shrink-0">
                  <button
                    onClick={() => setViewMode('raw')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'raw' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                    title="Code View"
                  >
                    <FileText size={14} />
                  </button>
                  <button
                    onClick={() => setViewMode('markdown')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'markdown' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                    title="Markdown Preview"
                  >
                    <Layout size={14} />
                  </button>
                  <button
                    onClick={() => setViewMode('html')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'html' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                    title="HTML Preview"
                  >
                    <Globe size={14} />
                  </button>
                  <button
                    onClick={() => setViewMode('edit')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'edit' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                    title="Edit Text"
                  >
                    <Edit3 size={14} />
                  </button>
                </div>

                <div className="h-4 w-[1px] bg-slate-800 mx-1 hidden sm:block" />

                <div className="flex items-center gap-1">
                  <button
                    onClick={handleCopy}
                    className="p-1.5 sm:px-2.5 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors border border-slate-700 flex items-center gap-2"
                  >
                    {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
                  </button>

                  <button
                    onClick={() => setActivePreviewText(null)}
                    className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col bg-slate-950">
              {viewMode === 'edit' ? (
                <div className="flex-1 p-3 sm:p-4 flex flex-col gap-3">
                  <textarea
                    autoFocus
                    value={editText}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setEditText(newValue);
                      
                      if (saveTimeoutRef.current) {
                        clearTimeout(saveTimeoutRef.current);
                      }
                      
                      saveTimeoutRef.current = setTimeout(async () => {
                        if (activePreviewPath) {
                          await updateNodeValue(activePreviewPath, newValue);
                          setActivePreviewText(newValue, activePreviewPath);
                        }
                      }, 500);
                    }}
                    className="flex-1 bg-slate-900/50 text-slate-200 font-mono text-sm leading-relaxed outline-none resize-none p-4 border border-slate-800 rounded-lg focus:border-indigo-500/30 transition-colors custom-scrollbar"
                    placeholder="Enter content here..."
                  />
                  <div className="flex justify-end items-center gap-3">
                    <span className="text-slate-500 text-xs italic flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/50 animate-pulse"></div>
                      Auto-saving on type...
                    </span>
                    <button
                      onClick={() => setViewMode('raw')}
                      className="flex items-center gap-2 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95"
                    >
                      <Check size={14} />
                      Done
                    </button>
                  </div>
                </div>
              ) : viewMode === 'markdown' ? (
                <div className="flex-1 p-4 sm:p-8 overflow-auto bg-white dark:bg-slate-950 custom-scrollbar">
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:tracking-tight prose-a:text-indigo-400 prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800 markdown-body">
                    <ReactMarkdown>{editText}</ReactMarkdown>
                  </div>
                </div>
              ) : viewMode === 'html' ? (
                <div className="flex-1 p-2 bg-slate-950 overflow-hidden flex flex-col">
                  <iframe
                    srcDoc={editText}
                    sandbox="allow-scripts allow-popups"
                    className="w-full flex-1 rounded-lg bg-white border-0 shadow-inner"
                    title="HTML Preview"
                  />
                </div>
              ) : (
                <div className="flex-1 overflow-auto bg-slate-950 custom-scrollbar">
                  <pre className="p-4 sm:p-6 font-mono text-sm text-slate-300 leading-relaxed whitespace-pre-wrap break-words min-h-full selection:bg-indigo-500/30">
                    {editText}
                  </pre>
                </div>
              )}
            </div>

            {/* Bottom Bar */}
            <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 text-[9px] text-slate-600 font-mono flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="text-slate-400 font-bold">{editText.length}</span>
                  <span>CHARS</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-slate-400 font-bold">{editText.split(/\s+/).filter(Boolean).length}</span>
                  <span>WORDS</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                {viewMode === 'edit' ? (
                  <div className="flex items-center gap-1.5 text-indigo-400">
                    <div className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse"></div>
                    EDITING
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-slate-500 uppercase tracking-widest">
                    <div className="w-1 h-1 rounded-full bg-emerald-500/50"></div>
                    {viewMode === 'markdown' ? 'Markdown' : (viewMode === 'html' ? 'HTML' : 'Read Only')}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
          
          {/* Backdrop Click */}
          <div 
            className="absolute inset-0 -z-10" 
            onClick={() => {
              if (viewMode !== 'edit' || editText === activePreviewText) {
                setActivePreviewText(null);
              }
            }}
          />
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default TextPreviewPopup;
