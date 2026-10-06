import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNodeResize } from '../hooks/useNodeResize';
import { createPortal } from 'react-dom';
import { Highlight, themes } from 'prism-react-renderer';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
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
  Sparkles,
  WrapText,
  Info,
  AlertCircle,
  Palette,
  type LucideIcon,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { SafeModelViewer } from './SafeModelViewer';
import CustomSelect from './CustomSelect';
import { loadGoogleFont } from '../utils/fontRegistry';

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

const GITHUB_ALERTS: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  note: {
    label: 'Note',
    icon: Info,
    color: 'text-blue-500 dark:text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
  },
  tip: {
    label: 'Tip',
    icon: Sparkles,
    color: 'text-emerald-500 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
  },
  important: {
    label: 'Important',
    icon: AlertCircle,
    color: 'text-purple-500 dark:text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
  },
  warning: {
    label: 'Warning',
    icon: AlertCircle,
    color: 'text-amber-500 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
  caution: {
    label: 'Caution',
    icon: AlertCircle,
    color: 'text-rose-500 dark:text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
  },
};

// Strips `> [!NOTE]` style markers and tags blockquote nodes with alert classes
const rehypeGithubAlerts = () => (tree: any) => {
  const visit = (node: any) => {
    if (node.type === 'element' && node.tagName === 'blockquote') {
      const firstP = node.children?.find((c: any) => c.type === 'element');
      const firstText = firstP?.tagName === 'p' ? firstP.children?.[0] : null;
      const match = firstText?.type === 'text' ? /^\s*\[!(note|tip|important|warning|caution)\]\s*/i.exec(firstText.value) : null;
      if (match) {
        const type = match[1].toLowerCase();
        firstText.value = firstText.value.slice(match[0].length);
        if (!firstText.value) firstP.children.shift();
        if (firstP.children[0]?.tagName === 'br') firstP.children.shift();
        if (firstP.children.length === 0) node.children.splice(node.children.indexOf(firstP), 1);
        node.properties = { ...node.properties, className: ['markdown-alert', `markdown-alert-${type}`], dataAlert: type };
      }
    }
    node.children?.forEach(visit);
  };
  visit(tree);
};

function ResponseCodeBlock({ code, language, isDark }: { code: string; language: string; isDark: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`relative my-2.5 rounded-xl overflow-hidden border ${isDark ? 'border-slate-800 bg-slate-950 text-slate-100' : 'border-slate-200 bg-slate-50 text-slate-900'} shadow-xs not-prose`}>
      <div className={`flex items-center justify-between px-3 py-1.5 border-b ${isDark ? 'border-slate-800/80 bg-slate-900/90 text-slate-400' : 'border-slate-200 bg-slate-100/90 text-slate-500'} text-[11px] font-mono`}>
        <span className={`uppercase tracking-wider font-semibold text-[10px] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
          {language || 'text'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${isDark ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'}`}
          title="Copy code"
        >
          {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      <div className="p-3 overflow-x-auto text-xs font-mono leading-relaxed">
        <Highlight theme={isDark ? themes.vsDark : themes.github} code={code} language={language || 'text'}>
          {({ tokens, getLineProps, getTokenProps }) => (
            <pre className="m-0 bg-transparent">
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })}>
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      </div>
    </div>
  );
}

const MD_THEME_OPTIONS = [
  { value: 'default-dark', label: 'Default' },
  { value: 'github-dark', label: 'GitHub Dark' },
  { value: 'github-light', label: 'GitHub Light' },
  { value: 'notebook-dark', label: 'Notebook Dark' },
  { value: 'notebook', label: 'Notebook' },
  { value: 'borderlands', label: 'Borderlands' },
  { value: 'comic-minimal', label: 'Comic Minimal' },
  { value: 'anime-pastel', label: 'Anime Pastel' },
  { value: 'manga-scan', label: 'Manga Scan' },
  { value: 'cyberpunk', label: 'Cyberpunk' },
  { value: 'retro-arcade', label: 'Retro Arcade' },
  { value: 'synthwave', label: 'Synthwave' },
  { value: 'neubrutalism', label: 'Neubrutalism' },
  { value: 'kawaii', label: 'Kawaii' },
  { value: 'chalkboard', label: 'Chalkboard' },
];

const THEME_FONTS: Record<string, string[]> = {
  notebook: ['Comic Neue'],
  'notebook-dark': ['Comic Neue'],
  'comic-minimal': ['Comic Neue'],
  borderlands: ['Bangers'],
  'anime-pastel': ['M PLUS Rounded 1c'],
  'manga-scan': ['Dela Gothic One', 'Zen Kaku Gothic New'],
  cyberpunk: ['Chakra Petch', 'Rajdhani'],
  'retro-arcade': ['Press Start 2P', 'VT323'],
  synthwave: ['Audiowide', 'Exo 2'],
  neubrutalism: ['Archivo Black', 'Space Grotesk'],
  kawaii: ['Fredoka', 'Nunito'],
  chalkboard: ['Cabin Sketch', 'Patrick Hand'],
};

const getThemeClasses = (theme: string) => {
  switch (theme) {
    case 'github-light':
      return {
        container: "p-4 sm:p-6 bg-white text-slate-900",
        prose: "gh-markdown gh-light markdown-body"
      };
    case 'github-dark':
      return {
        container: "p-4 sm:p-6 bg-[#0d1117] text-[#c9d1d9]",
        prose: "gh-markdown gh-dark markdown-body"
      };
    case 'default-dark':
      return {
        container: "dd-surface p-4 sm:p-6",
        prose: "dd-markdown markdown-body"
      };
    case 'notebook-dark':
      return {
        container: "p-4 pt-6 pb-6 sm:p-6 bg-[#1e1e2e] text-slate-300 bg-local bg-[linear-gradient(transparent_31px,#3b82f61a_32px)] bg-[length:100%_32px]",
        prose: "ruled-notebook [--heading-rule:rgba(129,140,248,0.35)] prose prose-sm sm:prose-base dark:prose-invert max-w-3xl font-['Comic_Neue','Comic_Sans_MS','Chalkboard_SE','Marker_Felt',sans-serif] markdown-body"
      };
    case 'borderlands':
      return {
        container: "bl-surface p-4 sm:p-6",
        prose: "bl-markdown markdown-body"
      };
    case 'comic-minimal':
      return {
        container: "cm-surface p-4 sm:p-6",
        prose: "cm-markdown markdown-body"
      };
    case 'anime-pastel':
      return {
        container: "ap-surface p-4 sm:p-6",
        prose: "ap-markdown markdown-body"
      };
    case 'manga-scan':
      return {
        container: "ms-surface p-4 sm:p-6",
        prose: "ms-markdown markdown-body"
      };
    case 'cyberpunk':
      return {
        container: "cp-surface p-4 sm:p-6",
        prose: "cp-markdown markdown-body"
      };
    case 'retro-arcade':
      return {
        container: "rc-surface p-4 sm:p-6",
        prose: "rc-markdown markdown-body"
      };
    case 'synthwave':
      return {
        container: "sw-surface p-4 pt-10 pb-8 sm:p-6",
        prose: "sw-markdown markdown-body"
      };
    case 'neubrutalism':
      return {
        container: "nb-surface p-4 sm:p-6",
        prose: "nb-markdown markdown-body"
      };
    case 'kawaii':
      return {
        container: "kw-surface p-4 pt-8 pb-8 sm:p-6",
        prose: "kw-markdown markdown-body"
      };
    case 'chalkboard':
      return {
        container: "cb-surface p-4 pt-8 pb-10 sm:p-6",
        prose: "cb-markdown markdown-body"
      };
    case 'notebook':
    default:
      return {
        container: "p-4 pt-6 pb-6 sm:p-6 bg-[#fdfaf6] text-slate-800 bg-local bg-[linear-gradient(transparent_31px,#3b82f633_32px)] bg-[length:100%_32px]",
        prose: "ruled-notebook [--heading-rule:rgba(59,130,246,0.4)] prose prose-sm sm:prose-base max-w-3xl font-['Comic_Neue','Comic_Sans_MS','Chalkboard_SE','Marker_Felt',sans-serif] markdown-body"
      };
  }
};

interface ApiResponseNodeRendererProps {
  /** Path (and node id) of the `__response` node, i.e. `<api node path>.__response` */
  path: string;
  data: any;
  /** Current node size; the user can resize the node from its corner */
  width: number;
  height: number;
}

type ResponseKind = 'json' | 'text' | 'markdown' | 'image' | 'video' | 'audio' | 'pdf' | 'model' | 'binary';

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

const looksLikeMarkdown = (text: string): boolean => {
  if (!text || text.length < 5) return false;
  return /(^#{1,6}\s|\*\*[\s\S]+?\*\*|```|^\s*[-*+]\s|^\s*\d+\.\s|^\s*>\s|\|[\s\S]+?\|)/m.test(text);
};

const describeResponse = (data: any, preferredFormat?: string): ResponseInfo => {
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
    // 1. Explicit format overrides
    if (preferredFormat === 'json') {
      let text: string;
      try {
        text = JSON.stringify(data, null, 2) ?? String(data);
      } catch {
        text = String(data);
      }
      return { kind: 'json', label: 'JSON', extension: 'json', icon: FileJson, iconClass: 'bg-emerald-500/10 text-emerald-500', text, size: new Blob([text]).size };
    }

    if (preferredFormat === 'text') {
      const text = typeof data._rawText === 'string'
        ? data._rawText
        : (typeof data._combinedMessage === 'string'
            ? data._combinedMessage
            : (JSON.stringify(data, null, 2) ?? String(data)));
      return { kind: 'text', label: 'Text', extension: 'txt', icon: FileText, iconClass: 'bg-sky-500/10 text-sky-500', text, size: new Blob([text]).size };
    }

    if (preferredFormat === 'markdown') {
      const text = typeof data._rawText === 'string'
        ? data._rawText
        : (typeof data._combinedMessage === 'string'
            ? data._combinedMessage
            : (JSON.stringify(data, null, 2) ?? String(data)));
      return {
        kind: 'markdown',
        label: data._isStreaming ? 'Streaming…' : 'Markdown',
        extension: 'md',
        icon: Sparkles,
        iconClass: 'bg-purple-500/10 text-purple-500',
        text,
        size: new Blob([text]).size,
      };
    }

    // 2. Default / Auto mode
    if (typeof data._rawText === 'string') {
      const text: string = data._rawText;
      const isMd = Boolean(data._isMarkdown) && looksLikeMarkdown(text);
      return {
        kind: isMd ? 'markdown' : 'text',
        label: isMd ? 'Markdown' : 'Text',
        extension: isMd ? 'md' : 'txt',
        icon: isMd ? Sparkles : FileText,
        iconClass: isMd ? 'bg-purple-500/10 text-purple-500' : 'bg-sky-500/10 text-sky-500',
        text,
        size: new Blob([text]).size
      };
    }

    // Stream response with chunks or any structured data defaults to JSON
    let text: string;
    try {
      text = JSON.stringify(data, null, 2) ?? String(data);
    } catch {
      text = String(data);
    }
    return { kind: 'json', label: 'JSON', extension: 'json', icon: FileJson, iconClass: 'bg-emerald-500/10 text-emerald-500', text, size: new Blob([text]).size };
  }

  // Primitive string
  if (typeof data === 'string') {
    if (preferredFormat === 'json') {
      return { kind: 'json', label: 'JSON', extension: 'json', icon: FileJson, iconClass: 'bg-emerald-500/10 text-emerald-500', text: data, size: new Blob([data]).size };
    }
    if (preferredFormat === 'text') {
      return { kind: 'text', label: 'Text', extension: 'txt', icon: FileText, iconClass: 'bg-sky-500/10 text-sky-500', text: data, size: new Blob([data]).size };
    }
    const isMd = preferredFormat === 'markdown' || looksLikeMarkdown(data);
    return {
      kind: isMd ? 'markdown' : 'text',
      label: isMd ? 'Markdown' : 'Text',
      extension: isMd ? 'md' : 'txt',
      icon: isMd ? Sparkles : FileText,
      iconClass: isMd ? 'bg-purple-500/10 text-purple-500' : 'bg-sky-500/10 text-sky-500',
      text: data,
      size: new Blob([data]).size,
    };
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

  const config = apiNodeConfig[apiNodePath];
  const preferredFormat = config?.responseFormat;
  const info = useMemo(() => describeResponse(data, preferredFormat), [data, preferredFormat]);
  const lines = useMemo(() => (info.text !== undefined ? info.text.split('\n') : []), [info.text]);
  const [visibleLines, setVisibleLines] = useState(LINES_PER_PAGE);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Long lines wrap by default for plain text and markdown; JSON keeps its structure unwrapped until asked
  const [wordWrap, setWordWrap] = useState(info.kind === 'text' || info.kind === 'markdown');
  const [modelFormat, setModelFormat] = useState<ModelFormat>('checking');
  const [viewMode, setViewMode] = useState<'rendered' | 'json' | 'code'>(() => {
    if (info.kind === 'markdown') return 'rendered';
    if (info.kind === 'json') return 'json';
    return 'code';
  });
  const [mdTheme, setMdTheme] = useState<string>(() => {
    return localStorage.getItem('apiMdTheme') || localStorage.getItem('mdTheme') || 'default-dark';
  });

  useEffect(() => {
    localStorage.setItem('apiMdTheme', mdTheme);
    THEME_FONTS[mdTheme]?.forEach((font) => loadGoogleFont(font));
  }, [mdTheme]);

  useEffect(() => {
    if (info.kind === 'markdown') {
      setViewMode('rendered');
    } else if (info.kind === 'json') {
      setViewMode('json');
    } else {
      setViewMode('code');
    }
  }, [info.kind]);

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

  const hasStreamMarkdown = Boolean(data && typeof data === 'object' && typeof data._combinedMessage === 'string');
  const hasMarkdownText = info.kind === 'markdown' || (info.text !== undefined && looksLikeMarkdown(info.text));
  const canShowMarkdown = hasStreamMarkdown || hasMarkdownText;

  const canShowJson = info.kind === 'json' || (() => {
    if (!info.text) return false;
    try {
      const parsed = JSON.parse(info.text);
      return typeof parsed === 'object' && parsed !== null;
    } catch {
      return false;
    }
  })();

  const availableViewModes = useMemo(() => {
    if (info.text === undefined && !hasStreamMarkdown) return [];
    const modes: { id: 'rendered' | 'json' | 'code'; label: string; title: string }[] = [];

    if (info.kind === 'json') {
      modes.push({ id: 'json', label: 'JSON', title: 'Formatted JSON with syntax highlighting' });
      modes.push({ id: 'code', label: 'Raw', title: 'Raw plain text view' });
      if (hasStreamMarkdown) {
        modes.push({ id: 'rendered', label: 'Markdown', title: 'Markdown rendered preview' });
      }
    } else if (info.kind === 'markdown') {
      modes.push({ id: 'rendered', label: 'Preview', title: 'Rendered markdown preview' });
      modes.push({ id: 'code', label: 'Raw', title: 'Raw markdown text' });
      if (canShowJson) {
        modes.push({ id: 'json', label: 'JSON', title: 'Formatted JSON' });
      }
    } else {
      // Text
      modes.push({ id: 'code', label: 'Text', title: 'Plain text view' });
      if (canShowJson) {
        modes.push({ id: 'json', label: 'JSON', title: 'Formatted JSON' });
      }
      if (canShowMarkdown) {
        modes.push({ id: 'rendered', label: 'Markdown', title: 'Rendered markdown preview' });
      }
    }
    return modes;
  }, [info.kind, info.text, hasStreamMarkdown, canShowJson, canShowMarkdown]);

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
        {availableViewModes.length > 1 && (
          <div className="mr-1 flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5 text-[10px] font-medium dark:border-slate-800 dark:bg-slate-900">
            {availableViewModes.map((mode) => (
              <button
                key={mode.id}
                onClick={(e) => { e.stopPropagation(); setViewMode(mode.id); }}
                className={`rounded px-1.5 py-0.5 transition-colors ${
                  viewMode === mode.id
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100 font-semibold'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
                title={mode.title}
              >
                {mode.label}
              </button>
            ))}
          </div>
        )}
        {viewMode === 'rendered' && canShowMarkdown && (
          <div className="mr-1 w-[85px] sm:w-[110px]" onClick={(e) => e.stopPropagation()}>
            <CustomSelect
              value={mdTheme}
              onChange={(val) => setMdTheme(val)}
              options={MD_THEME_OPTIONS}
              icon={<Palette size={11} />}
              variant="toolbar"
              className="text-[10px]"
            />
          </div>
        )}
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

  const isMdDark = ['default-dark', 'github-dark', 'notebook-dark', 'retro-arcade', 'synthwave', 'chalkboard'].includes(mdTheme);

  const markdownComponents = useMemo(() => ({
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      const code = String(children).replace(/\n$/, '');
      const isBlock = !inline && (Boolean(match) || code.includes('\n'));

      if (!isBlock) {
        return (
          <code
            className="rounded bg-slate-200/60 dark:bg-slate-800/80 px-1.5 py-0.5 font-mono text-[11px] text-pink-600 dark:text-pink-400 border border-slate-300/40 dark:border-slate-700/50"
            {...props}
          >
            {children}
          </code>
        );
      }

      return <ResponseCodeBlock code={code} language={language} isDark={isMdDark} />;
    },
    blockquote({ node, children, ...props }: any) {
      const alertType = props['data-alert'];
      const alert = alertType ? GITHUB_ALERTS[alertType] : null;
      if (alert) {
        const AlertIcon = alert.icon;
        return (
          <blockquote {...props}>
            <p className="markdown-alert-title"><AlertIcon size={16} strokeWidth={2.25} />{alert.label}</p>
            {children}
          </blockquote>
        );
      }
      return <blockquote {...props}>{children}</blockquote>;
    },
    table({ children, ...props }: any) {
      return (
        <div className="my-3 overflow-x-auto rounded-lg">
          <table className="w-full text-left border-collapse m-0" {...props}>
            {children}
          </table>
        </div>
      );
    },
    input({ node, ...props }: any) {
      if (props.type === 'checkbox') {
        return <input type="checkbox" className="mr-2 rounded text-indigo-500 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700" {...props} disabled={false} readOnly />;
      }
      return <input {...props} />;
    },
    a({ href, children, ...props }: any) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-medium hover:opacity-80 transition-opacity"
          {...props}
        >
          {children}
        </a>
      );
    },
  }), [isMdDark]);

  const body = (
    <div
      ref={bodyRef}
      className="nodrag custom-scrollbar min-h-0 flex-1 cursor-auto select-text overflow-auto"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {viewMode === 'rendered' && canShowMarkdown && (
        <div
          className={`${getThemeClasses(mdTheme).container} ${
            isFullscreen ? 'text-[14px]' : 'text-[12.5px]'
          } selection:bg-blue-500/30 overflow-x-hidden [&_.katex-display]:overflow-x-auto [&_.katex-display]:py-1.5 [&_.katex-display]:my-2.5 [&_.katex]:text-inherit min-h-full`}
        >
          <div className={getThemeClasses(mdTheme).prose}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeRaw, rehypeKatex, rehypeGithubAlerts]}
              components={markdownComponents}
            >
              {(hasStreamMarkdown ? data._combinedMessage : shownText) || '*Empty response*'}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {viewMode === 'json' && (
        <Highlight
          theme={isDark ? themes.vsDark : themes.github}
          code={
            info.kind === 'json'
              ? shownText
              : (() => {
                  try {
                    return JSON.stringify(typeof data === 'string' ? JSON.parse(data) : data, null, 2);
                  } catch {
                    return shownText;
                  }
                })()
          }
          language="json"
        >
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

      {viewMode === 'code' && (
        <pre className={`py-2 font-mono leading-[1.6] text-slate-700 dark:text-slate-300 ${wordWrap ? 'whitespace-pre-wrap break-words' : 'min-w-max whitespace-pre'} ${codeTextClass} ${isFullscreen ? 'px-4 sm:px-6' : 'px-3'}`}>
          {shownText || <span className="italic text-slate-400">Empty response</span>}
        </pre>
      )}

      {(info.kind === 'json' || info.kind === 'text' || info.kind === 'markdown') && hiddenLineCount > 0 && (
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
