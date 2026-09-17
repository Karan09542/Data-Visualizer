import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNodeResize } from '../hooks/useNodeResize';
import { createPortal } from 'react-dom';
import { Highlight, themes } from 'prism-react-renderer';
import {
  Box,
  Check,
  Copy,
  Download,
  File as FileIcon,
  FileJson,
  FileText,
  Film,
  Image as ImageIcon,
  ListTree,
  Maximize2,
  Minimize2,
  Music,
  WrapText,
  type LucideIcon,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { SafeModelViewer } from './SafeModelViewer';

type ModelFormat = 'checking' | 'glb' | 'gltf' | 'unsupported';

/**
 * Servers often send 3D files as text/plain or octet-stream, so look at the bytes:
 * binary glTF starts with "glTF", JSON glTF starts with "{". model-viewer only loads these two.
 */
const sniffModelFormat = async (src: string): Promise<ModelFormat> => {
  const buffer = await (await fetch(src)).arrayBuffer();
  const head = new Uint8Array(buffer.slice(0, 64));
  if (String.fromCharCode(...head.slice(0, 4)) === 'glTF') return 'glb';
  const text = new TextDecoder().decode(head).trimStart();
  return text.startsWith('{') ? 'gltf' : 'unsupported';
};

interface ApiResponseNodeRendererProps {
  /** Path (and node id) of the `__response` node, i.e. `<api node path>.__response` */
  path: string;
  data: any;
  /** Current node size; the user can resize the node from its corner */
  width: number;
  height: number;
}

type ResponseKind = 'json' | 'text' | 'image' | 'video' | 'audio' | 'pdf' | 'model' | 'binary';

type ResponseInfo = {
  kind: ResponseKind;
  label: string;
  extension: string;
  icon: LucideIcon;
  iconClass: string;
  /** Object URL for media/binary responses */
  src?: string;
  mimeType?: string;
  size?: number;
  /** Text shown in the viewer for JSON/text responses */
  text?: string;
};

/** Lines rendered per "page" so very large responses stay responsive */
const LINES_PER_PAGE = 600;
const MIN_WIDTH = 280;
const MIN_HEIGHT = 180;
const MAX_WIDTH = 1600;
const MAX_HEIGHT = 1400;

const formatBytes = (bytes?: number) => {
  if (bytes === undefined || !Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Object URLs are stored with a "#image"-style hint; strip it for use as a real src */
const cleanObjectUrl = (url: string) => url.replace(/#(image|video|audio|pdf|model)$/, '');

const extensionFromMime = (mime: string | undefined, fallback: string) => {
  const subtype = mime?.split(';')[0].split('/')[1];
  if (!subtype) return fallback;
  if (subtype === 'jpeg') return 'jpg';
  if (subtype === 'svg+xml') return 'svg';
  if (subtype.includes('+')) return subtype.split('+')[0];
  return subtype.replace(/[^a-z0-9]/gi, '') || fallback;
};

const describeResponse = (data: any): ResponseInfo => {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const mimeType: string | undefined = typeof data.type === 'string' ? data.type : undefined;
    const size: number | undefined = typeof data.size === 'number' ? data.size : undefined;

    if (typeof data._imageUrl === 'string') {
      return { kind: 'image', label: 'Image', extension: extensionFromMime(mimeType, 'png'), icon: ImageIcon, iconClass: 'bg-pink-500/10 text-pink-500', src: cleanObjectUrl(data._imageUrl), mimeType, size };
    }
    if (typeof data._videoUrl === 'string') {
      return { kind: 'video', label: 'Video', extension: extensionFromMime(mimeType, 'mp4'), icon: Film, iconClass: 'bg-violet-500/10 text-violet-500', src: cleanObjectUrl(data._videoUrl), mimeType, size };
    }
    if (typeof data._audioUrl === 'string') {
      return { kind: 'audio', label: 'Audio', extension: extensionFromMime(mimeType, 'mp3'), icon: Music, iconClass: 'bg-amber-500/10 text-amber-500', src: cleanObjectUrl(data._audioUrl), mimeType, size };
    }
    if (typeof data._pdfUrl === 'string') {
      return { kind: 'pdf', label: 'PDF', extension: 'pdf', icon: FileText, iconClass: 'bg-red-500/10 text-red-500', src: cleanObjectUrl(data._pdfUrl), mimeType, size };
    }
    if (typeof data._modelUrl === 'string') {
      return { kind: 'model', label: '3D model', extension: extensionFromMime(mimeType, 'glb'), icon: Box, iconClass: 'bg-teal-500/10 text-teal-500', src: cleanObjectUrl(data._modelUrl), mimeType, size };
    }
    if (typeof data._blobSize === 'number') {
      return { kind: 'binary', label: 'Binary data', extension: extensionFromMime(mimeType, 'bin'), icon: FileIcon, iconClass: 'bg-slate-500/10 text-slate-500', mimeType, size: data._blobSize };
    }
    if (typeof data._rawText === 'string') {
      const text: string = data._rawText;
      return { kind: 'text', label: 'Text', extension: 'txt', icon: FileText, iconClass: 'bg-sky-500/10 text-sky-500', text, size: new Blob([text]).size };
    }
  }

  let text: string;
  try {
    text = JSON.stringify(data, null, 2) ?? String(data);
  } catch {
    text = String(data);
  }
  return { kind: 'json', label: 'JSON', extension: 'json', icon: FileJson, iconClass: 'bg-emerald-500/10 text-emerald-500', text, size: new Blob([text]).size };
};

export function ApiResponseNodeRenderer({ path, data, width, height }: ApiResponseNodeRendererProps) {
  const appTheme = useStore((state) => state.appTheme);
  const apiNodeConfig = useStore((state) => state.apiNodeConfig);
  const setApiNodeConfig = useStore((state) => state.setApiNodeConfig);
  const setCustomNodeSize = useStore((state) => state.setCustomNodeSize);

  const apiNodePath = path.replace(/\.__response$/, '');
  const baseName = apiNodePath.split(/[.[\]"]/).filter(Boolean).pop() || 'response';

  const info = useMemo(() => describeResponse(data), [data]);
  const lines = useMemo(() => (info.text !== undefined ? info.text.split('\n') : []), [info.text]);
  const [visibleLines, setVisibleLines] = useState(LINES_PER_PAGE);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Long lines wrap by default for plain text; JSON keeps its structure unwrapped until asked
  const [wordWrap, setWordWrap] = useState(info.kind === 'text');
  const [modelFormat, setModelFormat] = useState<ModelFormat>('checking');

  useEffect(() => {
    if (info.kind !== 'model' || !info.src) return;
    let cancelled = false;
    setModelFormat('checking');
    sniffModelFormat(info.src)
      .then((format) => { if (!cancelled) setModelFormat(format); })
      .catch(() => { if (!cancelled) setModelFormat('unsupported'); });
    return () => { cancelled = true; };
  }, [info.kind, info.src]);

  const canPreviewModel = info.kind === 'model' && (modelFormat === 'glb' || modelFormat === 'gltf');

  // Orbiting the model must not reach the canvas: d3 pan/zoom, node dragging and the drawing
  // system all listen on ancestors in the bubble phase, so stopping the native events here keeps
  // them out while model-viewer (inside this wrapper) still gets them first.
  const modelWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = modelWrapRef.current;
    if (!el || !canPreviewModel) return;

    const stop = (e: Event) => e.stopPropagation();
    const startInteraction = (e: Event) => {
      e.stopPropagation();
      // No text selection / native drag ghost while dragging to orbit
      if (e.type === 'mousedown') e.preventDefault();
      window.getSelection()?.removeAllRanges();
    };
    const blockDrag = (e: Event) => e.preventDefault();

    el.addEventListener('pointerdown', startInteraction);
    el.addEventListener('mousedown', startInteraction);
    el.addEventListener('touchstart', stop, { passive: true });
    el.addEventListener('wheel', stop, { passive: true });
    el.addEventListener('dragstart', blockDrag);
    el.addEventListener('selectstart', blockDrag);
    return () => {
      el.removeEventListener('pointerdown', startInteraction);
      el.removeEventListener('mousedown', startInteraction);
      el.removeEventListener('touchstart', stop);
      el.removeEventListener('wheel', stop);
      el.removeEventListener('dragstart', blockDrag);
      el.removeEventListener('selectstart', blockDrag);
    };
  }, [canPreviewModel, isFullscreen]);
  const containerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => setVisibleLines(LINES_PER_PAGE), [data]);

  // Stored once the corner is released, rather than on every frame of the drag
  useNodeResize(
    containerRef,
    useCallback((w: number, h: number) => setCustomNodeSize(path, w, h), [path, setCustomNodeSize]),
  );

  // Scroll the file instead of zooming the canvas while the pointer is over it
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener('wheel', stop, { passive: true });
    el.addEventListener('touchmove', stop, { passive: true });
    return () => {
      el.removeEventListener('wheel', stop);
      el.removeEventListener('touchmove', stop);
    };
  }, [info.kind, isFullscreen]);

  // Fullscreen: Esc closes it, and the page behind doesn't scroll
  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsFullscreen(false);
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [isFullscreen]);

  const extension = info.kind === 'model'
    ? (canPreviewModel ? modelFormat : 'model')
    : info.extension;
  const fileName = `${baseName}.${extension}`;
  const shownText = lines.slice(0, visibleLines).join('\n');
  const hiddenLineCount = Math.max(0, lines.length - visibleLines);

  const stats = [
    canPreviewModel ? `${info.label} (${modelFormat.toUpperCase()})` : info.label,
    formatBytes(info.size),
    info.text !== undefined ? `${lines.length.toLocaleString()} ${lines.length === 1 ? 'line' : 'lines'}` : info.mimeType,
  ].filter(Boolean).join(' · ');

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (info.text === undefined) return;
    try {
      await navigator.clipboard.writeText(info.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable (insecure context / permissions); nothing else to do
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    let href = info.src;
    let revoke = false;
    if (!href && info.text !== undefined) {
      href = URL.createObjectURL(new Blob([info.text], { type: info.kind === 'json' ? 'application/json' : 'text/plain' }));
      revoke = true;
    }
    if (!href) return;
    const link = document.createElement('a');
    link.href = href;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    if (revoke) setTimeout(() => URL.revokeObjectURL(href!), 1000);
  };

  const showAsNodes = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFullscreen(false);
    const current = apiNodeConfig[apiNodePath] || { method: 'GET', responseType: 'auto', timeout: 5000 };
    setApiNodeConfig(apiNodePath, { ...current, view: 'nodes' });
  };

  const toggleFullscreen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFullscreen((open) => !open);
  }, []);

  const actionClass = 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200';
  const Icon = info.icon;
  const isDark = appTheme !== 'light';
  const codeTextClass = isFullscreen ? 'text-[13px]' : 'text-[11.5px]';

  const header = (
    <div
      // In the canvas the header is the drag handle (the body scrolls and selects text instead)
      className={`flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 ${isFullscreen ? 'px-4 py-3 sm:px-6' : 'drag-handle cursor-move px-3 py-2.5'}`}
      title={isFullscreen ? undefined : 'Drag to move'}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <div className={`flex shrink-0 items-center justify-center rounded-lg ${info.iconClass} ${isFullscreen ? 'h-9 w-9' : 'h-8 w-8'}`}>
          <Icon size={isFullscreen ? 18 : 16} />
        </div>
        <div className="min-w-0">
          <div className={`truncate font-mono font-semibold text-slate-900 dark:text-slate-100 ${isFullscreen ? 'text-sm' : 'text-[12px]'}`} title={fileName}>
            {fileName}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">{stats}</div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {info.kind === 'json' && (
          <button onClick={showAsNodes} className={actionClass} title="Show as child nodes" aria-label="Show as child nodes">
            <ListTree size={14} />
          </button>
        )}
        {info.text !== undefined && (
          <button
            onClick={(e) => { e.stopPropagation(); setWordWrap((wrap) => !wrap); }}
            className={`${actionClass} ${wordWrap ? 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/15 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300' : ''}`}
            title={wordWrap ? 'Word wrap: on' : 'Word wrap: off'}
            aria-label="Toggle word wrap"
            aria-pressed={wordWrap}
          >
            <WrapText size={14} />
          </button>
        )}
        {info.text !== undefined && (
          <button onClick={handleCopy} className={actionClass} title={copied ? 'Copied' : 'Copy'} aria-label="Copy response">
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </button>
        )}
        {(info.src || info.text !== undefined) && (
          <button onClick={handleDownload} className={actionClass} title={`Download ${fileName}`} aria-label="Download response">
            <Download size={14} />
          </button>
        )}
        <button
          onClick={toggleFullscreen}
          className={actionClass}
          title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
    </div>
  );

  const body = (
    <div
      ref={bodyRef}
      className="nodrag custom-scrollbar min-h-0 flex-1 cursor-auto select-text overflow-auto"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {info.kind === 'json' && (
        <Highlight theme={isDark ? themes.vsDark : themes.github} code={shownText} language="json">
          {({ tokens, getLineProps, getTokenProps }) => (
            <pre className={`py-2 font-mono leading-[1.6] ${wordWrap ? 'w-full' : 'min-w-max'} ${codeTextClass}`}>
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })} className={`flex hover:bg-slate-500/5 ${isFullscreen ? 'px-4 sm:px-6' : 'px-3'}`}>
                  <span className="mr-3 inline-block w-9 shrink-0 select-none text-right text-slate-400/70 dark:text-slate-600">
                    {i + 1}
                  </span>
                  <span className={wordWrap ? 'min-w-0 flex-1 whitespace-pre-wrap break-all' : ''}>
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token })} />
                    ))}
                  </span>
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      )}

      {info.kind === 'text' && (
        <pre className={`py-2 font-mono leading-[1.6] text-slate-700 dark:text-slate-300 ${wordWrap ? 'whitespace-pre-wrap break-words' : 'min-w-max whitespace-pre'} ${codeTextClass} ${isFullscreen ? 'px-4 sm:px-6' : 'px-3'}`}>
          {shownText || <span className="italic text-slate-400">Empty response</span>}
        </pre>
      )}

      {(info.kind === 'json' || info.kind === 'text') && hiddenLineCount > 0 && (
        <div className="sticky left-0 flex items-center justify-center gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
          {hiddenLineCount.toLocaleString()} more lines
          <button
            onClick={(e) => { e.stopPropagation(); setVisibleLines((n) => n + LINES_PER_PAGE); }}
            className="rounded-md px-2 py-0.5 font-medium text-blue-600 transition-colors hover:bg-blue-500/10 dark:text-blue-400"
          >
            Show more
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setVisibleLines(lines.length); }}
            className="rounded-md px-2 py-0.5 font-medium text-slate-600 transition-colors hover:bg-slate-500/10 dark:text-slate-300"
          >
            Show all
          </button>
        </div>
      )}

      {info.kind === 'image' && info.src && (
        <div className="flex h-full items-center justify-center bg-[repeating-conic-gradient(rgba(148,163,184,0.12)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] p-2">
          <img src={info.src} alt={fileName} className="max-h-full max-w-full rounded-md object-contain" draggable={false} />
        </div>
      )}

      {info.kind === 'video' && info.src && (
        <div className="flex h-full items-center justify-center bg-black">
          <video src={info.src} controls className="max-h-full max-w-full" />
        </div>
      )}

      {info.kind === 'audio' && info.src && (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-full ${info.iconClass}`}>
            <Music size={22} />
          </div>
          <audio src={info.src} controls className="w-full max-w-xl" />
        </div>
      )}

      {info.kind === 'pdf' && info.src && (
        <iframe src={info.src} title={fileName} className="h-full w-full border-0 bg-white" />
      )}

      {canPreviewModel && info.src && (
        <div
          ref={modelWrapRef}
          className="nodrag relative h-full w-full cursor-grab select-none active:cursor-grabbing bg-[radial-gradient(circle_at_center,rgba(148,163,184,0.14),transparent_70%)]"
          style={{ touchAction: 'none' }}
        >
          <SafeModelViewer
            key={`${info.src}-${isFullscreen ? 'full' : 'node'}`}
            src={info.src}
            alt={fileName}
            autoRotate
            cameraControls
            // The full toolbar (and its R/G/W/Space shortcuts) only in fullscreen
            showControls={isFullscreen}
            style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }}
          />
          {!isFullscreen && (
            <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-md bg-slate-900/60 px-2 py-0.5 text-[10px] text-slate-200">
              Drag to orbit · scroll to zoom
            </span>
          )}
        </div>
      )}

      {info.kind === 'model' && modelFormat === 'checking' && (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
          Reading 3D model…
        </div>
      )}

      {(info.kind === 'binary' || (info.kind === 'model' && modelFormat === 'unsupported')) && (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${info.iconClass}`}>
            <Icon size={22} />
          </div>
          <div className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
            {info.kind === 'model' ? "This 3D format can't be previewed" : 'Binary response'}
          </div>
          {info.kind === 'model' && (
            <div className="max-w-[240px] text-[11px] leading-snug text-slate-500 dark:text-slate-400">
              Only GLB and glTF models can be shown here. Download the file to open it in another app.
            </div>
          )}
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {[info.mimeType || 'Unknown type', formatBytes(info.size)].filter(Boolean).join(' · ')}
          </div>
          {info.src && (
            <button
              onClick={handleDownload}
              className="mt-1 inline-flex h-7 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Download size={12} /> Download
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div
        ref={containerRef}
        className="nodrag resize relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm pointer-events-auto dark:border-slate-800 dark:bg-[#0f172a] dark:text-slate-100"
        style={{ width, height, minWidth: MIN_WIDTH, minHeight: MIN_HEIGHT, maxWidth: MAX_WIDTH, maxHeight: MAX_HEIGHT }}
      >
        {isFullscreen ? (
          // The file is open fullscreen; keep the node as a small placeholder
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${info.iconClass}`}>
              <Icon size={18} />
            </div>
            <div className="truncate font-mono text-[12px] font-semibold">{fileName}</div>
            <button
              onClick={toggleFullscreen}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Minimize2 size={12} /> Exit fullscreen
            </button>
          </div>
        ) : (
          <>
            {header}
            {body}
          </>
        )}
        {/* Resize grip (the native resize handle sits underneath it) */}
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0.5 right-0.5 h-2.5 w-2.5 border-b-2 border-r-2 border-slate-300 dark:border-slate-600"
        />
      </div>

      {isFullscreen && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-label={`${fileName} fullscreen`}
          className="fixed inset-0 z-[10000] flex flex-col bg-white text-slate-900 dark:bg-[#0b1120] dark:text-slate-100"
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {header}
          {body}
        </div>,
        document.body
      )}
    </>
  );
}
