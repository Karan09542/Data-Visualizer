import React from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check, Type, Eye, Edit3, Save, FileText, Layout, Globe } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

const TextPreviewPopup: React.FC = () => {
  const { activePreviewText, activePreviewPath, setActivePreviewText, updateNodeValue } = useStore();
  const [copied, setCopied] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'raw' | 'markdown' | 'html' | 'edit'>('raw');
  const [editText, setEditText] = React.useState('');

  React.useEffect(() => {
    if (activePreviewText) {
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
  }, [activePreviewText]);

  if (!activePreviewText) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(editText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    if (activePreviewPath) {
      await updateNodeValue(activePreviewPath, editText);
      setActivePreviewText(editText, activePreviewPath);
      setViewMode('raw');
    }
  };

  return createPortal(
    <AnimatePresence>
      {activePreviewText && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-8 bg-slate-950/80 backdrop-blur-md">
          <motion.div
             initial={{ opacity: 0, scale: 0.9, y: 20 }}
             animate={{ opacity: 1, scale: 1, y: 0 }}
             exit={{ opacity: 0, scale: 0.9, y: 20 }}
             className="relative w-full max-w-4xl h-full max-h-[85vh] bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-slate-800/80 border-b border-slate-700 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg hidden sm:block">
                  <Type size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-white tracking-tight flex items-center gap-2">
                    {viewMode === 'edit' ? 'Editor' : (viewMode === 'markdown' ? 'Markdown View' : (viewMode === 'html' ? 'HTML HTML Preview' : 'Raw View'))}
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/30 font-mono uppercase">
                      {activePreviewPath?.split('.').pop()}
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5 max-w-[150px] sm:max-w-xs truncate" title={activePreviewPath || ''}>
                    {activePreviewPath}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Mode Toggles */}
                <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700 mr-2">
                  <button
                    onClick={() => setViewMode('raw')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'raw' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                    title="Code View"
                  >
                    <FileText size={16} />
                  </button>
                  <button
                    onClick={() => setViewMode('markdown')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'markdown' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                    title="Markdown Preview"
                  >
                    <Layout size={16} />
                  </button>
                  <button
                    onClick={() => setViewMode('html')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'html' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                    title="HTML Preview"
                  >
                    <Globe size={16} />
                  </button>
                  <button
                    onClick={() => setViewMode('edit')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'edit' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                    title="Edit Text"
                  >
                    <Edit3 size={16} />
                  </button>
                </div>

                <div className="h-6 w-[1px] bg-slate-700 mx-1 hidden sm:block" />

                <button
                  onClick={handleCopy}
                  className="p-2 sm:px-3 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors border border-slate-600 flex items-center gap-2"
                >
                  {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                  <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  onClick={() => setActivePreviewText(null)}
                  className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors border border-transparent hover:border-slate-700"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {viewMode === 'edit' ? (
                <div className="flex-1 p-4 bg-slate-950 flex flex-col gap-4">
                  <textarea
                    autoFocus
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="flex-1 bg-transparent text-slate-200 font-mono text-sm leading-relaxed outline-none resize-none p-4 border border-slate-800 rounded-xl focus:border-indigo-500/50 transition-colors custom-scrollbar"
                    placeholder="Enter content here..."
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setEditText(activePreviewText);
                        setViewMode('raw');
                      }}
                      className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors"
                    >
                      Discard
                    </button>
                    <button
                      onClick={handleSave}
                      className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-xl shadow-indigo-600/20 transition-all active:scale-95"
                    >
                      <Save size={16} />
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : viewMode === 'markdown' ? (
                <div className="flex-1 p-6 sm:p-10 overflow-auto bg-white dark:bg-slate-950 custom-scrollbar">
                  <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none prose-headings:tracking-tight prose-a:text-indigo-400 prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800 markdown-body">
                    <ReactMarkdown>{editText}</ReactMarkdown>
                  </div>
                </div>
              ) : viewMode === 'html' ? (
                <div className="flex-1 p-4 bg-slate-950 overflow-hidden flex flex-col">
                  <iframe
                    srcDoc={editText}
                    sandbox="allow-scripts allow-popups"
                    className="w-full flex-1 rounded-xl bg-white border border-slate-800 shadow-inner"
                    title="HTML Preview"
                  />
                </div>
              ) : (
                <div className="flex-1 p-4 sm:p-6 overflow-auto bg-slate-950 custom-scrollbar">
                  <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6 shadow-inner ring-1 ring-white/5 min-h-full">
                    <pre className="font-mono text-sm sm:text-base text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
                      {editText}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Bar */}
            <div className="px-6 py-3 bg-slate-800/50 border-t border-slate-700 text-[10px] text-slate-500 font-mono flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <span>{editText.length} CHARS</span>
                <span>{editText.split(/\s+/).filter(Boolean).length} WORDS</span>
              </div>
              <span className="flex items-center gap-1.5">
                {viewMode === 'edit' ? (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                    UNSAVED EDITS
                  </>
                ) : (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                    {viewMode === 'markdown' ? 'MARKDOWN PREVIEW' : (viewMode === 'html' ? 'HTML PREVIEW' : 'READ ONLY VIEW')}
                  </>
                )}
              </span>
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
