import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Check, Link2, Globe, X } from 'lucide-react';

interface InlineApiEditorProps {
  initialUrl: string;
  path: string;
  nodeX: number;
  nodeY: number;
  nodeWidth: number;
  /** Rendered height of the API node, so the popover can sit just below it */
  nodeHeight?: number;
  onClose: () => void;
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const RESPONSE_TYPES = [
  { value: 'auto', label: 'Auto' },
  { value: 'json', label: 'JSON' },
  { value: 'text', label: 'Text' },
  { value: 'blob', label: 'Blob' },
] as const;

const RESPONSE_VIEWS = [
  { value: 'auto', label: 'Auto', hint: 'Nodes for small JSON, a file for large JSON, text and media' },
  { value: 'nodes', label: 'Child nodes', hint: 'Expand the response into nodes on the canvas' },
  { value: 'file', label: 'File', hint: 'Attach one formatted file node (JSON, text, image, video, audio…)' },
] as const;

const METHOD_ACTIVE: Record<string, string> = {
  GET: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  POST: 'border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  PUT: 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  PATCH: 'border-violet-500/50 bg-violet-500/10 text-violet-600 dark:text-violet-400',
  DELETE: 'border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400',
};

const POPOVER_WIDTH = 360;
const FRAME_PADDING = 24; // room for the shadow inside the foreignObject
const MIN_TIMEOUT = 100;
const MAX_TIMEOUT = 120000;

export function InlineApiEditor({ initialUrl, path, nodeX, nodeY, nodeHeight = 140, onClose }: InlineApiEditorProps) {
  const [url, setUrl] = useState(initialUrl);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const originalUrlRef = useRef(initialUrl);
  const updateNodeValue = useStore((state) => state.updateNodeValue);
  const setInlineApiEditor = useStore((state) => state.setInlineApiEditor);
  const inlineApiEditor = useStore((state) => state.inlineApiEditor);
  const apiNodeConfig = useStore((state) => state.apiNodeConfig);
  const setApiNodeConfig = useStore((state) => state.setApiNodeConfig);

  const currentConfig = apiNodeConfig[path] || { method: 'GET', responseType: 'auto', timeout: 5000 };
  const [method, setMethod] = useState(currentConfig.method);
  const [responseType, setResponseType] = useState(currentConfig.responseType);
  const [timeout, setTimeoutVal] = useState(currentConfig.timeout.toString());
  const [view, setView] = useState<'auto' | 'nodes' | 'file'>(currentConfig.view ?? 'auto');

  const wrapperRef = useRef<HTMLDivElement>(null);

  const trimmedUrl = url.trim();
  const isEmpty = trimmedUrl === '';
  const isValidUrl = (() => {
    if (isEmpty) return true;
    try {
      const parsed = new URL(trimmedUrl);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  })();

  const parsedTimeout = Number(timeout);
  const isValidTimeout = timeout.trim() !== '' && Number.isFinite(parsedTimeout) && parsedTimeout >= MIN_TIMEOUT && parsedTimeout <= MAX_TIMEOUT;
  const canSave = isValidUrl && isValidTimeout;

  // Keep canvas pan/zoom/drag handlers from reacting to interaction inside the popover
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

    events.forEach((event) => el.addEventListener(event, stopPropagation));
    return () => events.forEach((event) => el.removeEventListener(event, stopPropagation));
  }, []);

  const handleSave = async () => {
    const validTimeout = isValidTimeout ? Math.round(parsedTimeout) : currentConfig.timeout;
    setApiNodeConfig(path, { method, responseType, timeout: validTimeout, view });

    if (isValidUrl && url !== originalUrlRef.current) {
      await updateNodeValue(path, trimmedUrl);
    }
    onClose();
  };

  // Clicking away saves (when valid). A ref keeps the listener on the latest values.
  const outsideClickRef = useRef<() => void>(() => {});
  outsideClickRef.current = () => {
    if (canSave) handleSave();
    else onClose();
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        outsideClickRef.current();
      }
    };
    document.addEventListener('mousedown', handleClickOutside, { capture: true });
    return () => document.removeEventListener('mousedown', handleClickOutside, { capture: true });
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setUrl(val);

    // Mirror the draft onto the node so it previews the URL while typing
    if (inlineApiEditor) {
      setInlineApiEditor({ ...inlineApiEditor, url: val });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === 'Enter' && !e.shiftKey && (e.target as HTMLElement).tagName !== 'BUTTON') {
      e.preventDefault();
      if (canSave) handleSave();
    }
  };

  const frameWidth = POPOVER_WIDTH + FRAME_PADDING * 2;

  /**
   * The popover lives inside the canvas, so its x and y are graph units, not pixels. Whether it
   * fits is a question about the screen though, and the canvas can be zoomed and panned. Its
   * rendered rect answers both: it is already in screen pixels, and comparing its width with the
   * width it was asked to be gives the zoom, which converts an overflow back into graph units.
   */
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [placeAbove, setPlaceAbove] = useState(false);

  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const place = () => {
      const margin = 12;
      const rect = el.getBoundingClientRect();
      const zoom = rect.width / POPOVER_WIDTH || 1;

      // Where it would sit with no correction, which is just below the node
      const baseTop = rect.top - offset.y * zoom;
      const baseLeft = rect.left - offset.x * zoom;

      // The node sits directly above that, with the 4 unit gap the frame already allows
      const nodeTop = baseTop - (nodeHeight + 4) * zoom;
      const roomBelow = window.innerHeight - baseTop - margin;
      const roomAbove = nodeTop - margin;

      const above = rect.height > roomBelow && roomAbove > roomBelow;
      let nextY = above ? (nodeTop - 8 * zoom - rect.height - baseTop) / zoom : 0;

      // Neither side has room: sit as high as the screen allows rather than run off it
      const top = baseTop + nextY * zoom;
      if (top < margin) {
        nextY += (margin - top) / zoom;
      } else if (top + rect.height > window.innerHeight - margin) {
        const overflow = top + rect.height - (window.innerHeight - margin);
        nextY -= Math.min(overflow, top - margin) / zoom;
      }

      let nextX = 0;
      if (baseLeft < margin) {
        nextX = (margin - baseLeft) / zoom;
      } else if (baseLeft + rect.width > window.innerWidth - margin) {
        nextX = (window.innerWidth - margin - rect.width - baseLeft) / zoom;
      }

      setPlaceAbove(above);
      setOffset((previous) =>
        Math.abs(previous.x - nextX) < 0.5 && Math.abs(previous.y - nextY) < 0.5
          ? previous
          : { x: nextX, y: nextY },
      );
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
    // Re-measured when the node moves, or the form changes height with the response view
  }, [nodeX, nodeY, nodeHeight, view, offset.x, offset.y]);
  const chipBase = 'h-8 rounded-lg border text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40';
  const chipIdle = 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200';
  const labelClass = 'text-xs font-medium text-slate-600 dark:text-slate-300';

  return (
    <foreignObject
      // Centered under the node, just below its bottom edge
      x={nodeX - frameWidth / 2 + offset.x}
      y={nodeY + nodeHeight / 2 + 4 + offset.y}
      width={frameWidth}
      height={540}
      className="overflow-visible"
    >
      <div
        ref={wrapperRef}
        role="dialog"
        aria-label="Edit API request"
        className="relative mx-auto mt-3 flex flex-col rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl shadow-slate-900/15 animate-in fade-in slide-in-from-top-1 duration-150 dark:border-slate-800 dark:bg-[#0f172a] dark:text-slate-100 dark:shadow-black/50"
        style={{ width: POPOVER_WIDTH, pointerEvents: 'auto' }}
        onKeyDown={handleKeyDown}
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
        {/* Arrow pointing up at the node */}
        <span
          aria-hidden
          className={`absolute left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-slate-200 bg-white dark:border-slate-800 dark:bg-[#0f172a] ${placeAbove
            ? '-bottom-[7px] rounded-br-[3px] border-b border-r'
            : '-top-[7px] rounded-tl-[3px] border-l border-t'
            }`}
        />

        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <Globe size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-tight text-slate-900 dark:text-slate-100">Edit API request</div>
              <div className="mt-0.5 truncate font-mono text-[11px] text-slate-500 dark:text-slate-400" title={path}>
                {path.replace(/^root\.?/, '') || 'root'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 px-4 py-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`api-url-${path}`} className={labelClass}>Endpoint URL</label>
            <div className="relative">
              <Link2 size={14} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
              <textarea
                id={`api-url-${path}`}
                ref={textareaRef}
                value={url}
                onChange={handleChange}
                rows={2}
                spellCheck={false}
                placeholder="https://api.example.com/data"
                aria-invalid={!isValidUrl}
                className={`w-full resize-none rounded-lg border bg-slate-50 py-2.5 pl-9 pr-3 font-mono text-xs leading-5 text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:ring-2 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder:text-slate-600 ${isValidUrl
                  ? 'border-slate-200 focus:border-blue-500/60 focus:ring-blue-500/20 dark:border-slate-700'
                  : 'border-red-500/60 focus:border-red-500 focus:ring-red-500/20'
                  }`}
              />
            </div>
            {!isValidUrl && (
              <span className="text-[11px] text-red-600 dark:text-red-400">Enter a full http:// or https:// URL</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Method</span>
            <div role="radiogroup" aria-label="Method" className="grid grid-cols-5 gap-1.5">
              {METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={method === m}
                  onClick={() => setMethod(m)}
                  className={`${chipBase} ${method === m ? METHOD_ACTIVE[m] : chipIdle}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-[1fr_112px] gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className={labelClass}>Response</span>
              <div role="radiogroup" aria-label="Response type" className="flex h-8 rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-950/60">
                {RESPONSE_TYPES.map((type) => {
                  const active = responseType === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setResponseType(type.value)}
                      className={`flex-1 rounded-md text-xs font-medium transition-all ${active
                        ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-800 dark:text-blue-400'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                    >
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor={`api-timeout-${path}`} className={labelClass}>Timeout</label>
              <div className="relative">
                <input
                  id={`api-timeout-${path}`}
                  type="number"
                  inputMode="numeric"
                  min={MIN_TIMEOUT}
                  max={MAX_TIMEOUT}
                  step={500}
                  value={timeout}
                  onChange={(e) => setTimeoutVal(e.target.value)}
                  aria-invalid={!isValidTimeout}
                  className={`h-8 w-full rounded-lg border bg-white pl-2.5 pr-8 text-xs font-medium tabular-nums text-slate-900 outline-none transition-colors [appearance:textfield] focus:ring-2 dark:bg-slate-900 dark:text-slate-100 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${isValidTimeout
                    ? 'border-slate-200 focus:border-blue-500/60 focus:ring-blue-500/20 dark:border-slate-700'
                    : 'border-red-500/60 focus:border-red-500 focus:ring-red-500/20'
                    }`}
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">ms</span>
              </div>
            </div>
          </div>
          {!isValidTimeout && (
            <span className="-mt-2 text-[11px] text-red-600 dark:text-red-400">
              Timeout must be between {MIN_TIMEOUT} and {MAX_TIMEOUT.toLocaleString()} ms
            </span>
          )}

          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Show response as</span>
            <div role="radiogroup" aria-label="Show response as" className="flex h-8 rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-950/60">
              {RESPONSE_VIEWS.map((option) => {
                const active = view === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    title={option.hint}
                    onClick={() => setView(option.value)}
                    className={`flex-1 rounded-md text-xs font-medium transition-all ${active
                      ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-800 dark:text-blue-400'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <span className="text-[11px] leading-snug text-slate-400 dark:text-slate-500">
              {RESPONSE_VIEWS.find((option) => option.value === view)?.hint}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 rounded-b-xl border-t border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950/40">
          <span className="hidden text-[11px] text-slate-400 sm:inline">
            <kbd className="font-sans font-semibold text-slate-500 dark:text-slate-400">Enter</kbd> save · <kbd className="font-sans font-semibold text-slate-500 dark:text-slate-400">Esc</kbd> cancel
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
            >
              <Check size={14} />
              Save
            </button>
          </div>
        </div>
      </div>
    </foreignObject>
  );
}
