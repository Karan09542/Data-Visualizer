import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Check, Link2, Settings2, X } from 'lucide-react';

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
  const originalUrlRef = useRef(initialUrl);
  const { updateNodeValue, setInlineApiEditor, inlineApiEditor, apiNodeConfig, setApiNodeConfig } = useStore();

  const currentConfig = apiNodeConfig[path] || { method: 'GET', responseType: 'auto', timeout: 5000 };
  const [method, setMethod] = useState(currentConfig.method);
  const [responseType, setResponseType] = useState(currentConfig.responseType);
  const [timeout, setTimeoutVal] = useState(currentConfig.timeout.toString());

  const wrapperRef = useRef<HTMLDivElement>(null);
  const isEmpty = url.trim() === '';

  const labelClass = 'px-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400';
  const controlClass = 'h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';
  const optionClass = 'bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100';

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const stopPropagation = (e: Event) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
    };

    const events = [
      'mousedown',
      'mousemove',
      'mouseup',
      'pointerdown',
      'pointermove',
      'pointerup',
      'touchstart',
      'touchmove',
      'touchend',
      'wheel',
    ];

    events.forEach((event) => {
      el.addEventListener(event, stopPropagation, { capture: false });
    });

    return () => {
      events.forEach((event) => {
        el.removeEventListener(event, stopPropagation, { capture: false });
      });
    };
  }, []);

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
      if (url !== originalUrlRef.current) {
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
      x={nodeX + (nodeWidth / 2) - 210}
      y={nodeY + 24}
      width={440}
      height={310}
      className="overflow-visible"
    >
      <div
        ref={wrapperRef}
        className="relative flex w-[420px] flex-col overflow-hidden rounded-lg border border-zinc-200/80 bg-white/95 text-zinc-900 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.55),0_1px_0_rgba(255,255,255,0.75)_inset] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 dark:border-zinc-700/80 dark:bg-zinc-950/95 dark:text-zinc-100 dark:shadow-[0_24px_70px_-28px_rgba(0,0,0,0.95),0_1px_0_rgba(255,255,255,0.06)_inset]"
        style={{ pointerEvents: 'auto' }}
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
        <div className="h-0.5 w-full bg-blue-500" />

        <div className="flex items-center justify-between border-b border-zinc-200/80 px-4 py-3 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-300">
              <Settings2 size={16} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[12px] font-bold uppercase tracking-[0.16em] text-zinc-800 dark:text-zinc-100">
                Edit API Node
              </div>
              <div className="mt-0.5 truncate text-[10px] font-medium text-zinc-500 dark:text-zinc-500" title={path}>
                {path.replace(/^root\.?/, '') || 'root'}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-200/80 bg-white/80 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-400 dark:hover:bg-white/[0.08] dark:hover:text-white"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-3 px-4 py-4">
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Endpoint URL</label>
            <div className="relative">
              <Link2 size={15} className="pointer-events-none absolute left-3 top-3.5 text-blue-500 dark:text-blue-300" />
              <textarea
                ref={textareaRef}
                value={url}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                className={`min-h-[76px] w-full resize-none rounded-md border bg-zinc-50 py-3 pl-9 pr-3 font-mono text-sm leading-5 text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:ring-2 dark:bg-black/35 dark:text-zinc-100 dark:placeholder:text-zinc-600 ${isValid || isEmpty ? 'border-zinc-300 focus:border-blue-500 focus:ring-blue-500/20 dark:border-zinc-700' : 'border-red-500/60 focus:border-red-500 focus:ring-red-500/20'}`}
                rows={3}
                placeholder="https://api.example.com/data"
              />
            </div>
            {!isValid && !isEmpty && (
              <span className="px-0.5 text-[11px] font-medium text-red-600 dark:text-red-300">Invalid URL format</span>
            )}
          </div>

          <div className="grid grid-cols-[1fr_1fr_1.2fr] gap-2.5">
            <div className="flex min-w-0 flex-col gap-1.5">
              <label className={labelClass}>Method</label>
              <select
                value={method}
                onChange={e => setMethod(e.target.value)}
                className={controlClass}
              >
                <option className={optionClass} value="GET">GET</option>
                <option className={optionClass} value="POST">POST</option>
                <option className={optionClass} value="PUT">PUT</option>
                <option className={optionClass} value="PATCH">PATCH</option>
                <option className={optionClass} value="DELETE">DELETE</option>
              </select>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label className={labelClass}>Response</label>
              <select
                value={responseType}
                onChange={e => setResponseType(e.target.value)}
                className={controlClass}
              >
                <option className={optionClass} value="auto">Auto</option>
                <option className={optionClass} value="json">JSON</option>
                <option className={optionClass} value="text">Text</option>
                <option className={optionClass} value="blob">Blob</option>
              </select>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label className={labelClass}>Timeout</label>
              <input
                type="text"
                value={timeout}
                onChange={e => setTimeoutVal(e.target.value)}
                className={controlClass}
                placeholder="5000"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-zinc-200/80 pt-3 dark:border-white/10">
            <button
              onClick={onClose}
              className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-white/[0.08] dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-bold text-white shadow-sm shadow-blue-500/20 transition-colors hover:bg-blue-500"
            >
              <Check size={15} />
              Done
            </button>
          </div>
        </div>
      </div>
    </foreignObject>
  );
}
