import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Check, X } from 'lucide-react';

interface InlineApiEditorProps {
  initialUrl: string;
  path: string;
  nodeX: number;
  nodeY: number;
  nodeWidth: number;
  onClose: () => void;
}

export function InlineApiEditor({ initialUrl, path, nodeX, nodeY, nodeWidth, onClose }: InlineApiEditorProps) {
  const [url, setUrl] = useState(initialUrl);
  const [isValid, setIsValid] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { updateNodeValue, setInlineApiEditor, inlineApiEditor, apiNodeConfig, setApiNodeConfig } = useStore();

  const currentConfig = apiNodeConfig[path] || { method: 'GET', responseType: 'auto', timeout: 5000 };
  const [method, setMethod] = useState(currentConfig.method);
  const [responseType, setResponseType] = useState(currentConfig.responseType);
  const [timeout, setTimeoutVal] = useState(currentConfig.timeout.toString());

  const wrapperRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        handleSave();
      }
    };
    document.addEventListener('mousedown', handleClickOutside, { capture: true });
    return () => document.removeEventListener('mousedown', handleClickOutside, { capture: true });
  }, [onClose, url, method, responseType, timeout]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(url.length, url.length);
    }
  }, []);

  const validateUrl = (testUrl: string) => {
    try {
      new URL(testUrl);
      setIsValid(true);
      return true;
    } catch {
      setIsValid(false);
      return false;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setUrl(val);
    validateUrl(val);
    
    // Update global preview state for reactive node visual updates
    if (inlineApiEditor) {
      setInlineApiEditor({
        ...inlineApiEditor,
        url: val
      });
    }
  };

  const handleSave = async () => {
    const parsedTimeout = parseInt(timeout, 10);
    const validTimeout = isNaN(parsedTimeout) ? 5000 : parsedTimeout;

    setApiNodeConfig(path, { method, responseType, timeout: validTimeout });

    if (validateUrl(url) || url.trim() === '') {
      if (url !== initialUrl) {
        await updateNodeValue(path, url);
      }
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <foreignObject
      x={nodeX + (nodeWidth / 2) - 180}
      y={nodeY + 30}
      width={400}
      height={350}
      className="overflow-visible"
    >
      <div 
        ref={wrapperRef}
        className="flex flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-600/70 rounded-xl p-3 shadow-2xl text-slate-800 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-100 relative"
        style={{ pointerEvents: 'auto', width: '360px' }}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onMouseMove={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200 dark:border-white/10">
          <span className="text-xs font-semibold tracking-wider uppercase text-blue-600 dark:text-blue-400">Edit API Node</span>
          <div className="flex gap-1">
             <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded-md transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200">
               <X size={14} />
             </button>
          </div>
        </div>
        
        <textarea
          ref={textareaRef}
          value={url}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className={`w-full bg-slate-100 dark:bg-black/40 border ${isValid ? 'border-slate-300 dark:border-slate-600 focus:border-blue-500' : 'border-red-500/50 focus:border-red-500'} rounded-lg p-2 text-xs font-mono text-slate-900 dark:text-slate-300 outline-none resize-none mb-2`}
          rows={3}
          placeholder="https://api.example.com/..."
        />
        
        {!isValid && url.trim() !== '' && (
          <span className="text-[10px] text-red-500 dark:text-red-400 mt-0 mb-2 pl-1 block">Invalid URL format</span>
        )}

        <div className="flex items-center gap-2 mb-2 text-xs">
          <div className="flex flex-col flex-1 gap-1">
            <label className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold px-1">Method</label>
            <select 
              value={method} 
              onChange={e => setMethod(e.target.value)}
              className="bg-slate-100 dark:bg-black/40 border border-slate-300 dark:border-slate-600 rounded p-1.5 outline-none focus:border-blue-500 text-slate-900 dark:text-slate-300"
            >
              <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200" value="GET">GET</option>
              <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200" value="POST">POST</option>
              <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200" value="PUT">PUT</option>
              <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200" value="PATCH">PATCH</option>
              <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200" value="DELETE">DELETE</option>
            </select>
          </div>
          <div className="flex flex-col flex-1 gap-1">
            <label className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold px-1">Response</label>
            <select 
              value={responseType} 
              onChange={e => setResponseType(e.target.value)}
              className="bg-slate-100 dark:bg-black/40 border border-slate-300 dark:border-slate-600 rounded p-1.5 outline-none focus:border-blue-500 text-slate-900 dark:text-slate-300"
            >
              <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200" value="auto">Auto</option>
              <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200" value="json">JSON</option>
              <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200" value="text">Text</option>
              <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200" value="blob">Blob</option>
            </select>
          </div>
          <div className="flex flex-col flex-1 gap-1">
            <label className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold px-1">Timeout (ms)</label>
            <input 
              type="text" 
              value={timeout} 
              onChange={e => setTimeoutVal(e.target.value)}
              className="bg-slate-100 dark:bg-black/40 border border-slate-300 dark:border-slate-600 rounded p-1.5 outline-none focus:border-blue-500 text-slate-900 dark:text-slate-300"
              placeholder="5000"
            />
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200 dark:border-white/10">
          <span className="text-[9px] text-slate-500 dark:text-slate-400">
            <kbd className="bg-slate-200 dark:bg-black/30 px-1 py-0.5 rounded border border-slate-300 dark:border-white/5">Enter</kbd> to close • <kbd className="bg-slate-200 dark:bg-black/30 px-1 py-0.5 rounded border border-slate-300 dark:border-white/5">Shift+Enter</kbd> newline
          </span>
          <button 
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900/50 disabled:text-blue-500/50 text-white text-[11px] font-bold rounded-lg transition-colors"
          >
            <Check size={12} /> Done
          </button>
        </div>
      </div>
    </foreignObject>
  );
}
