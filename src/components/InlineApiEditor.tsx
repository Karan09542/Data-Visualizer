import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore';
import {
  parseCurl,
  buildCurl,
  isCurlCommand,
  getNestedValue,
  detectCandidatePaths,
  type KeyValueParam,
  type AuthConfig,
  type BodyConfig,
  type AuthType,
  type BodyType,
} from '../utils/curlParser';
import CustomSelect from './CustomSelect';
import MonacoEditor from '@monaco-editor/react';
import { Highlight, themes } from 'prism-react-renderer';
import { ModernCheckbox } from './image-workspace/components/shared/ModernCheckbox';
import {
  Check,
  CircleStop,
  Link2,
  Globe,
  X,
  Play,
  Copy,
  Terminal,
  Key,
  FileText,
  FileJson,
  WrapText,
  Sliders,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  Code,
  AlertCircle,
  Sparkles,
  Square,
  Timer,
  TimerOff,
  Layers,
  Send,
  HelpCircle,
  Search,
  Zap,
  ClipboardPaste,
  ArrowRight,
  ChevronDown,
} from 'lucide-react';

interface InlineApiEditorProps {
  initialUrl: string;
  path: string;
  nodeX: number;
  nodeY: number;
  nodeWidth: number;
  nodeHeight?: number;
  onClose: () => void;
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

const METHOD_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  GET: { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/40' },
  POST: { bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/40' },
  PUT: { bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/40' },
  PATCH: { bg: 'bg-violet-500/10 dark:bg-violet-500/20', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-500/40' },
  DELETE: { bg: 'bg-red-500/10 dark:bg-red-500/20', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/40' },
};

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

const COMMON_HEADERS = [
  'Accept',
  'Content-Type',
  'Authorization',
  'User-Agent',
  'Cache-Control',
  'X-API-Key',
  'Origin',
  'Referer',
];

type TabKey = 'params' | 'headers' | 'auth' | 'body' | 'response' | 'settings';

const formatBytes = (bytes?: number) => {
  if (bytes === undefined || !Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const PrettierIcon = ({ size = 14, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M8.571 23.429A.571.571 0 0 1 8 24H2.286a.571.571 0 0 1 0-1.143H8c.316 0 .571.256.571.572zM8 20.57H6.857a.571.571 0 0 0 0 1.143H8a.571.571 0 0 0 0-1.143zm-5.714 1.143H4.57a.571.571 0 0 0 0-1.143H2.286a.571.571 0 0 0 0 1.143zM8 18.286H2.286a.571.571 0 0 0 0 1.143H8a.571.571 0 0 0 0-1.143zM16 16H5.714a.571.571 0 0 0 0 1.143H16A.571.571 0 0 0 16 16zM2.286 17.143h1.143a.571.571 0 0 0 0-1.143H2.286a.571.571 0 0 0 0 1.143zm17.143-3.429H16a.571.571 0 0 0 0 1.143h3.429a.571.571 0 0 0 0-1.143zM9.143 14.857h4.571a.571.571 0 0 0 0-1.143H9.143a.571.571 0 0 0 0 1.143zm-6.857 0h4.571a.571.571 0 0 0 0-1.143H2.286a.571.571 0 0 0 0 1.143zM20.57 11.43H11.43a.571.571 0 0 0 0 1.142h9.142a.571.571 0 0 0 0-1.142zM9.714 12a.571.571 0 0 0-.571-.571H5.714a.571.571 0 0 0 0 1.142h3.429A.571.571 0 0 0 9.714 12zm-7.428.571h1.143a.571.571 0 0 0 0-1.142H2.286a.571.571 0 0 0 0 1.142zm19.428-3.428H16a.571.571 0 0 0 0 1.143h5.714a.571.571 0 0 0 0-1.143zM2.286 10.286H8a.571.571 0 0 0 0-1.143H2.286a.571.571 0 0 0 0 1.143zm13.143-2.857c0 .315.255.571.571.571h5.714a.571.571 0 0 0 0-1.143H16a.571.571 0 0 0-.571.572zm-8.572-.572a.571.571 0 0 0 0 1.143H8a.571.571 0 0 0 0-1.143H6.857zM2.286 8H4.57a.571.571 0 0 0 0-1.143H2.286a.571.571 0 0 0 0 1.143zm16.571-2.857c0 .315.256.571.572.571h1.142a.571.571 0 0 0 0-1.143H19.43a.571.571 0 0 0-.572.572zm-1.143 0a.571.571 0 0 0-.571-.572H12.57a.571.571 0 0 0 0 1.143h4.572a.571.571 0 0 0 .571-.571zm-15.428.571h8a.571.571 0 0 0 0-1.143h-8a.571.571 0 0 0 0 1.143zm5.143-2.857c0 .316.255.572.571.572h11.429a.571.571 0 0 0 0-1.143H8a.571.571 0 0 0-.571.571zm-5.143.572h3.428a.571.571 0 0 0 0-1.143H2.286a.571.571 0 0 0 0 1.143zm0-2.286H16A.571.571 0 0 0 16 0H2.286a.571.571 0 0 0 0 1.143z" />
  </svg>
);

export function InlineApiEditor({ initialUrl, path, onClose }: InlineApiEditorProps) {
  const updateNodeValue = useStore((state) => state.updateNodeValue);
  const apiNodeConfig = useStore((state) => state.apiNodeConfig);
  const setApiNodeConfig = useStore((state) => state.setApiNodeConfig);
  const inlineApiEditor = useStore((state) => state.inlineApiEditor);
  const setInlineApiEditor = useStore((state) => state.setInlineApiEditor);
  const apiNodeLoading = useStore((state) => state.apiNodeLoading);
  const apiNodeResponses = useStore((state) => state.apiNodeResponses);
  const appTheme = useStore((state) => state.appTheme);
  const isDark = appTheme !== 'light';

  const currentConfig = apiNodeConfig[path] || {
    method: 'GET',
    responseType: 'auto',
    timeout: 5000,
  };

  const [url, setUrl] = useState(initialUrl);
  const originalUrlRef = useRef(initialUrl);

  const [method, setMethod] = useState(currentConfig.method || 'GET');
  const [responseType, setResponseType] = useState(currentConfig.responseType || 'auto');
  const [timeout, setTimeoutVal] = useState(() => {
    if (currentConfig.timeout === undefined || currentConfig.timeout === null || currentConfig.timeout <= 0) {
      return '';
    }
    return currentConfig.timeout.toString();
  });
  const [view, setView] = useState<'auto' | 'nodes' | 'file'>(currentConfig.view ?? 'auto');

  // Key Extraction & Response Formatting
  const [extractPath, setExtractPath] = useState(currentConfig.extractPath || '');
  const [responseFormat, setResponseFormat] = useState<'auto' | 'json' | 'markdown' | 'text'>(currentConfig.responseFormat || 'auto');
  const [streamEnabled, setStreamEnabled] = useState<boolean | undefined>(currentConfig.streamEnabled);

  const currentResponseData = apiNodeResponses[path];
  const candidatePaths = useMemo(() => detectCandidatePaths(currentResponseData), [currentResponseData]);
  const liveExtractedValue = useMemo(() => {
    if (!extractPath.trim() || currentResponseData === undefined) return null;
    return getNestedValue(currentResponseData, extractPath.trim());
  }, [currentResponseData, extractPath]);

  // Params
  const [params, setParams] = useState<KeyValueParam[]>(() => {
    if (currentConfig.params && currentConfig.params.length > 0) {
      return currentConfig.params;
    }
    // Parse from initial URL if none saved
    try {
      const qIdx = initialUrl.indexOf('?');
      if (qIdx > -1) {
        const sp = new URLSearchParams(initialUrl.slice(qIdx + 1));
        const list: KeyValueParam[] = [];
        sp.forEach((val, key) => {
          list.push({ id: Math.random().toString(36).substring(2, 9), enabled: true, key, value: val });
        });
        return list;
      }
    } catch {}
    return [];
  });

  // Headers
  const [headers, setHeaders] = useState<KeyValueParam[]>(() => currentConfig.headers || []);

  // Auth
  const [auth, setAuth] = useState<AuthConfig>(() => currentConfig.auth || { type: 'none' });

  // Body
  const [body, setBody] = useState<BodyConfig>(() => currentConfig.body || { type: 'none' });

  // UI state
  const [activeTab, setActiveTab] = useState<TabKey>('params');
  const [showCurlModal, setShowCurlModal] = useState(false);
  const [curlInputText, setCurlInputText] = useState('');
  const [curlError, setCurlError] = useState<string | null>(null);
  const [copiedClipboardHint, setCopiedClipboardHint] = useState<string | null>(null);
  const [curlBanner, setCurlBanner] = useState<string | null>(null);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Live cURL detection & inspection
  const liveCurlPreview = useMemo(() => {
    const trimmed = curlInputText.trim();
    if (!trimmed) return null;
    try {
      const parsed = parseCurl(trimmed);
      return {
        valid: true,
        method: parsed.method,
        url: parsed.url,
        headersCount: parsed.headers.length,
        hasAuth: parsed.auth.type !== 'none',
        authType: parsed.auth.type,
        bodyType: parsed.body.type,
        paramsCount: parsed.params.length,
      };
    } catch (err: any) {
      return {
        valid: false,
        error: err?.message || 'Invalid cURL format',
      };
    }
  }, [curlInputText]);

  const handleInsertSampleCurl = () => {
    const sample = `curl -X POST 'https://api.example.com/v1/chat/completions' \\
  -H 'Authorization: Bearer sk-demo-key-12345' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "model": "gpt-4o",
    "messages": [
      {
        "role": "user",
        "content": "Hello! How does this work?"
      }
    ],
    "stream": false
  }'`;
    setCurlInputText(sample);
    setCurlError(null);
  };

  const handlePasteCurlFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setCurlInputText(text);
        setCurlError(null);
        setCopiedClipboardHint('Pasted!');
        setTimeout(() => setCopiedClipboardHint(null), 2000);
      }
    } catch (err) {
      console.warn('Clipboard read failed:', err);
    }
  };
  const [wordWrap, setWordWrap] = useState(true);
  const [copiedJson, setCopiedJson] = useState(false);

  const baseName = path.split(/[.[\]"]/).filter(Boolean).pop() || 'request';
  const jsonFileName = `${baseName}_payload.json`;
  const jsonSize = new Blob([body.rawJson || '']).size;
  const jsonLineCount = (body.rawJson || '').split('\n').length;

  const handleCopyJson = async () => {
    if (!body.rawJson) return;
    try {
      await navigator.clipboard.writeText(body.rawJson);
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 1500);
    } catch {}
  };

  const handleClearJson = () => {
    setBody({ ...body, rawJson: '{\n  \n}' });
    setJsonError(null);
  };

  const modalRef = useRef<HTMLDivElement>(null);
  const isLoading = !!apiNodeLoading[path];

  // URL Validation
  const trimmedUrl = url.trim();
  const isEmpty = trimmedUrl === '';
  const isValidUrl = (() => {
    if (isEmpty) return true;
    try {
      const parsed = new URL(trimmedUrl.startsWith('http') ? trimmedUrl : `https://${trimmedUrl}`);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  })();

  const isTimeoutEmpty = timeout.trim() === '';
  const parsedTimeout = isTimeoutEmpty ? 0 : Number(timeout);
  const isValidTimeout = isTimeoutEmpty || (Number.isFinite(parsedTimeout) && parsedTimeout >= 100 && parsedTimeout <= 120000);
  const canSave = isValidUrl && isValidTimeout;

  // Sync params table with URL query string
  const updateUrlWithParams = (newParams: KeyValueParam[]) => {
    const base = url.split('?')[0];
    const enabled = newParams.filter((p) => p.enabled && p.key.trim());
    if (enabled.length === 0) {
      setUrl(base);
      if (inlineApiEditor) setInlineApiEditor({ ...inlineApiEditor, url: base });
      return;
    }
    const sp = new URLSearchParams();
    enabled.forEach((p) => sp.append(p.key.trim(), p.value));
    const nextUrl = `${base}?${sp.toString()}`;
    setUrl(nextUrl);
    if (inlineApiEditor) setInlineApiEditor({ ...inlineApiEditor, url: nextUrl });
  };

  // Handle URL change
  const handleUrlChange = (newVal: string) => {
    // Check if user pasted a cURL command into the URL input
    if (isCurlCommand(newVal)) {
      handleImportCurlText(newVal);
      return;
    }

    setUrl(newVal);
    if (inlineApiEditor) {
      setInlineApiEditor({ ...inlineApiEditor, url: newVal });
    }

    // Auto extract params if query string changed
    const qIdx = newVal.indexOf('?');
    if (qIdx > -1) {
      try {
        const sp = new URLSearchParams(newVal.slice(qIdx + 1));
        const list: KeyValueParam[] = [];
        sp.forEach((val, key) => {
          list.push({ id: Math.random().toString(36).substring(2, 9), enabled: true, key, value: val });
        });
        setParams(list);
      } catch {}
    }
  };

  // cURL Import Handler
  const handleImportCurlText = (rawCmd: string) => {
    try {
      const parsed = parseCurl(rawCmd);
      setUrl(parsed.url);
      setMethod(parsed.method);
      if (parsed.params.length > 0) setParams(parsed.params);
      if (parsed.headers.length > 0) setHeaders(parsed.headers);
      if (parsed.auth.type !== 'none') setAuth(parsed.auth);
      if (parsed.body.type !== 'none') setBody(parsed.body);

      if (inlineApiEditor) {
        setInlineApiEditor({ ...inlineApiEditor, url: parsed.url });
      }

      setCurlBanner(`Imported ${parsed.method} request with ${parsed.headers.length} headers, ${parsed.params.length} params`);
      setTimeout(() => setCurlBanner(null), 4000);
      setShowCurlModal(false);
      setCurlInputText('');
      setCurlError(null);
    } catch (e: any) {
      setCurlError(e?.message || 'Could not parse cURL command');
      if (!showCurlModal) {
        setCurlBanner(`⚠️ cURL parse error: ${e?.message || 'Invalid format'}`);
        setTimeout(() => setCurlBanner(null), 4000);
      }
    }
  };

  // Copy as cURL
  const handleCopyCurl = async () => {
    const cmd = buildCurl(url, method, params, headers, auth, body);
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    } catch {}
  };

  // Format JSON in Body
  const handlePrettifyJson = () => {
    if (!body.rawJson) return;
    try {
      const parsed = JSON.parse(body.rawJson);
      setBody({ ...body, rawJson: JSON.stringify(parsed, null, 2) });
      setJsonError(null);
    } catch (e: any) {
      setJsonError(e.message || 'Invalid JSON syntax');
    }
  };

  // Validate JSON on edit
  const handleJsonChange = (val: string) => {
    setBody({ ...body, rawJson: val });
    if (!val.trim()) {
      setJsonError(null);
      return;
    }
    try {
      JSON.parse(val);
      setJsonError(null);
    } catch (e: any) {
      setJsonError(e.message);
    }
  };

  // Preset for Ollama / LLM
  const handleOllamaPreset = () => {
    let nextUrl = url.trim();
    if (nextUrl.includes(':11343')) {
      nextUrl = nextUrl.replace(':11343', ':11434');
    }
    if (nextUrl.startsWith('https://localhost') || nextUrl.startsWith('https://127.0.0.1')) {
      nextUrl = nextUrl.replace(/^https:\/\//i, 'http://');
    }
    if (!nextUrl || nextUrl === 'https://' || nextUrl === 'http://') {
      nextUrl = 'http://localhost:11434/api/chat';
    }
    setUrl(nextUrl);

    setMethod('POST');
    setExtractPath('message.content');
    setResponseFormat('markdown');
    setStreamEnabled(false);
    if (body.type === 'none' || !body.rawJson || body.rawJson.trim() === '' || body.rawJson.trim() === '{}') {
      setBody({
        type: 'json',
        rawJson: JSON.stringify(
          {
            model: 'gemma4:e2b',
            messages: [{ role: 'user', content: 'Why is the sky blue?' }],
            stream: false,
          },
          null,
          2
        ),
      });
    } else {
      try {
        const parsed = JSON.parse(body.rawJson);
        parsed.stream = false;
        setBody({ ...body, type: 'json', rawJson: JSON.stringify(parsed, null, 2) });
      } catch {}
    }
  };

  // Toggle stream and sync with body JSON
  const handleStreamToggle = (enabled: boolean | undefined) => {
    setStreamEnabled(enabled);
    if (enabled !== undefined && body.type === 'json' && body.rawJson) {
      try {
        const parsed = JSON.parse(body.rawJson);
        parsed.stream = enabled;
        setBody({ ...body, rawJson: JSON.stringify(parsed, null, 2) });
      } catch {}
    }
  };

  // Save current config
  const handleSave = async (triggerFetch = false) => {
    const validTimeout = isTimeoutEmpty ? undefined : (isValidTimeout ? Math.round(parsedTimeout) : currentConfig.timeout);

    const newConfig = {
      method,
      responseType,
      timeout: validTimeout,
      view,
      params,
      headers,
      auth,
      body,
      extractPath: extractPath.trim() || undefined,
      responseFormat,
      streamEnabled,
    };

    setApiNodeConfig(path, newConfig);

    if (isValidUrl && url !== originalUrlRef.current) {
      await updateNodeValue(path, trimmedUrl);
    }

    if (triggerFetch) {
      window.dispatchEvent(new CustomEvent('fetch-api-node', { detail: { path } }));
    }

    onClose();
  };

  // Keyboard shortcut: Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showCurlModal) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showCurlModal]);

  // Count pills for tabs
  const activeParamsCount = params.filter((p) => p.enabled && p.key.trim()).length;
  const activeHeadersCount = headers.filter((h) => h.enabled && h.key.trim()).length;
  const isAuthActive = auth.type !== 'none';
  const isBodyActive = body.type !== 'none';

  const modalContent = (
    <div
      className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-xs sm:backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-label="API Request Editor"
        className="relative flex flex-col w-full max-w-full sm:max-w-[840px] h-[92vh] sm:h-auto sm:max-h-[92vh] overflow-hidden rounded-t-3xl sm:rounded-2xl border-t border-x border-b-0 sm:border-b border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-[#0b1120] dark:text-slate-100 animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300"
      >
        {/* Mobile Bottom Sheet Drag / Pull Handle */}
        <div
          className="flex sm:hidden w-full items-center justify-center pt-2.5 pb-1 shrink-0 cursor-grab active:cursor-grabbing touch-pan-y"
          onClick={onClose}
          title="Swipe down or tap to close"
        >
          <div className="h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700/80 transition-transform active:scale-95" />
        </div>

        {/* Banner notification when cURL was imported */}
        {curlBanner && (
          <div className="flex items-center justify-between px-4 py-2 text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-b border-emerald-500/20 animate-in slide-in-from-top-1">
            <span className="flex items-center gap-1.5">
              <Sparkles size={14} />
              {curlBanner}
            </span>
            <button onClick={() => setCurlBanner(null)} className="hover:opacity-75">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Header Bar: Title, cURL Actions & Close */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 sm:px-5 py-2.5 sm:py-3 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <Globe size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">API Request</span>
                <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                  Postman Mode
                </span>
              </div>
              <div className="truncate font-mono text-[11px] text-slate-400 dark:text-slate-500 max-w-[180px] sm:max-w-[450px]" title={path}>
                {path.replace(/^root\.?/, '') || 'root'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowCurlModal(true)}
              title="Import from cURL command"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 sm:px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Terminal size={13} className="text-blue-500" />
              <span className="hidden sm:inline">Import cURL</span>
              <span className="inline sm:hidden">cURL</span>
            </button>

            <button
              type="button"
              onClick={handleCopyCurl}
              title="Copy request as cURL command"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 sm:px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {copiedCurl ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              <span className="hidden sm:inline">{copiedCurl ? 'Copied!' : 'Copy cURL'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Primary URL & Method Bar (Compact on mobile) */}
        <div className="flex flex-col gap-1.5 sm:gap-2 p-2.5 sm:p-4 md:p-5 border-b border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/30 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Compact Method Select */}
            <div className="relative shrink-0 w-[74px] xs:w-[84px] sm:w-[105px]">
              <CustomSelect
                value={method}
                onChange={(val) => setMethod(val)}
                options={METHODS.map((m) => ({ label: m, value: m }))}
                renderTrigger={({ ref, isOpen, props }) => (
                  <button
                    ref={ref}
                    type="button"
                    {...props}
                    className={`flex h-8 sm:h-9.5 w-full items-center justify-between gap-1 px-2 sm:px-3 rounded-lg sm:rounded-xl border border-slate-200 bg-white font-mono text-[11px] sm:text-xs font-bold transition-all outline-none dark:border-slate-800 dark:bg-slate-900 ${
                      METHOD_COLORS[method]?.text || 'text-slate-700'
                    } ${
                      isOpen
                        ? 'ring-2 ring-blue-500/20 border-blue-500 bg-blue-50/40 dark:bg-blue-950/20'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/80'
                    } cursor-pointer`}
                    aria-label={`HTTP Method: ${method}`}
                  >
                    <span className="truncate">{method}</span>
                    <ChevronDown
                      size={11}
                      className={`text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                )}
              />
            </div>

            {/* Compact URL Input */}
            <div className="relative flex-1 min-w-0">
              <Link2
                size={13}
                className="pointer-events-none absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-slate-400 shrink-0"
              />
              <input
                type="text"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="Enter URL or paste cURL..."
                spellCheck={false}
                className="h-8 sm:h-9.5 w-full rounded-lg sm:rounded-xl border border-slate-200 bg-white pl-7 sm:pl-9 pr-6 sm:pr-8 font-mono text-[11px] sm:text-xs text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-600"
              />
              {url && (
                <button
                  type="button"
                  onClick={() => handleUrlChange('')}
                  className="absolute right-1.5 sm:right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  title="Clear URL"
                  aria-label="Clear URL"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Compact Send or Stop Request Button */}
            {isLoading ? (
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('abort-api-node', { detail: { path } }));
                }}
                className="inline-flex h-8 sm:h-9.5 items-center justify-center gap-1 sm:gap-1.5 rounded-lg sm:rounded-xl bg-rose-600 px-2.5 sm:px-4 text-[11px] sm:text-xs font-semibold text-white shadow-sm transition-all hover:bg-rose-500 active:scale-95 shrink-0 cursor-pointer animate-in fade-in"
                title="Cancel in-flight request signal"
              >
                <Square size={10} className="fill-current text-white" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={!trimmedUrl || !canSave}
                onClick={() => handleSave(true)}
                className="inline-flex h-8 sm:h-9.5 items-center justify-center gap-1 sm:gap-1.5 rounded-lg sm:rounded-xl bg-blue-600 px-2.5 sm:px-4 text-[11px] sm:text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
                title="Send request"
              >
                <Send size={12} />
                <span>Send</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] sm:text-[11px] text-slate-500">
            <span className="truncate max-w-full">
              <span className="hidden xs:inline">Tip: </span>Paste cURL into URL to auto-populate
            </span>
            {url.toLowerCase().startsWith('https://localhost') && (
              <span className="text-amber-500 font-medium">
                ⚠️ Localhost uses http://, not https://.{' '}
                <button
                  type="button"
                  onClick={() => setUrl(url.replace(/^https:\/\//i, 'http://'))}
                  className="underline font-bold hover:text-amber-600 cursor-pointer"
                >
                  Change to http://
                </button>
              </span>
            )}
            {url.includes(':11343') && (
              <span className="text-amber-500 font-medium">
                💡 Port 11343 detected.{' '}
                <button
                  type="button"
                  onClick={() => setUrl(url.replace(':11343', ':11434'))}
                  className="underline font-bold hover:text-amber-600 cursor-pointer"
                >
                  Fix to 11434 (Ollama)
                </button>
              </span>
            )}
            {!isValidUrl && <span className="text-red-500 font-medium">Please enter a valid HTTP/HTTPS URL</span>}
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          className="flex border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-[#0b1120] overflow-x-auto no-scrollbar scrollbar-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {[
            { id: 'params', label: 'Params', count: activeParamsCount },
            { id: 'headers', label: 'Headers', count: activeHeadersCount },
            { id: 'auth', label: 'Auth', badge: isAuthActive ? auth.type.toUpperCase() : null },
            { id: 'body', label: 'Body', badge: isBodyActive ? body.type.toUpperCase() : null },
            { id: 'response', label: 'Response & Extract', badge: extractPath.trim() ? 'EXTRACT' : (streamEnabled !== undefined ? (streamEnabled ? 'STREAM' : 'SINGLE') : null) },
            { id: 'settings', label: 'Settings' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as TabKey)}
                className={`relative flex items-center gap-1.5 px-4 py-3 text-xs font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap ${
                  isActive
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && tab.count > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500/15 px-1 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                    {tab.count}
                  </span>
                )}
                {tab.badge && (
                  <span className="flex items-center rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div
          className="flex-1 overflow-y-auto p-3.5 sm:p-5 bg-white dark:bg-[#0b1120] no-scrollbar scrollbar-none"
          style={{ minHeight: 260, scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* PARAMS TAB */}
          {activeTab === 'params' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Query Parameters</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = [...params, { id: Math.random().toString(36).substring(2, 9), enabled: true, key: '', value: '' }];
                    setParams(next);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                >
                  <Plus size={13} /> Add Parameter
                </button>
              </div>

              {params.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
                  <p className="text-xs">No query parameters defined.</p>
                  <button
                    type="button"
                    onClick={() => {
                      const next = [{ id: Math.random().toString(36).substring(2, 9), enabled: true, key: '', value: '' }];
                      setParams(next);
                    }}
                    className="mt-2 text-xs font-semibold text-blue-500 hover:underline"
                  >
                    + Add first parameter
                  </button>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 border-b border-slate-200 dark:border-slate-800 font-semibold">
                      <tr>
                        <th className="w-8 px-3 py-2 text-center">
                          <div className="flex items-center justify-center">
                            <ModernCheckbox
                              checked={params.length > 0 && params.every((p) => p.enabled)}
                              onChange={(checked: boolean) => {
                                const next = params.map((p) => ({ ...p, enabled: checked }));
                                setParams(next);
                                updateUrlWithParams(next);
                              }}
                            />
                          </div>
                        </th>
                        <th className="px-3 py-2">Key</th>
                        <th className="px-3 py-2">Value</th>
                        <th className="px-3 py-2">Description</th>
                        <th className="w-8 px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {params.map((p, idx) => (
                        <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                          <td className="px-3 py-1.5 text-center">
                            <div className="flex items-center justify-center">
                              <ModernCheckbox
                                checked={p.enabled}
                                onChange={(checked: boolean) => {
                                  const next = [...params];
                                  next[idx].enabled = checked;
                                  setParams(next);
                                  updateUrlWithParams(next);
                                }}
                              />
                            </div>
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              value={p.key}
                              placeholder="key"
                              onChange={(e) => {
                                const next = [...params];
                                next[idx].key = e.target.value;
                                setParams(next);
                                updateUrlWithParams(next);
                              }}
                              className="w-full bg-transparent font-mono text-xs outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              value={p.value}
                              placeholder="value"
                              onChange={(e) => {
                                const next = [...params];
                                next[idx].value = e.target.value;
                                setParams(next);
                                updateUrlWithParams(next);
                              }}
                              className="w-full bg-transparent font-mono text-xs outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              value={p.description || ''}
                              placeholder="optional description"
                              onChange={(e) => {
                                const next = [...params];
                                next[idx].description = e.target.value;
                                setParams(next);
                              }}
                              className="w-full bg-transparent text-xs outline-none text-slate-500 placeholder:text-slate-400"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                const next = params.filter((_, i) => i !== idx);
                                setParams(next);
                                updateUrlWithParams(next);
                              }}
                              className="text-slate-400 hover:text-red-500"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* HEADERS TAB */}
          {activeTab === 'headers' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Request Headers</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const hasJson = headers.some((h) => h.key.toLowerCase() === 'content-type');
                      if (!hasJson) {
                        setHeaders([
                          ...headers,
                          { id: Math.random().toString(36).substring(2, 9), enabled: true, key: 'Content-Type', value: 'application/json' },
                        ]);
                      }
                    }}
                    className="text-[11px] font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    + Add JSON header
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      setHeaders([...headers, { id: Math.random().toString(36).substring(2, 9), enabled: true, key: '', value: '' }]);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                  >
                    <Plus size={13} /> Add Header
                  </button>
                </div>
              </div>

              {headers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
                  <p className="text-xs">No custom headers configured.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setHeaders([{ id: Math.random().toString(36).substring(2, 9), enabled: true, key: '', value: '' }]);
                    }}
                    className="mt-2 text-xs font-semibold text-blue-500 hover:underline"
                  >
                    + Add first header
                  </button>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 border-b border-slate-200 dark:border-slate-800 font-semibold">
                      <tr>
                        <th className="w-8 px-3 py-2 text-center">
                          <div className="flex items-center justify-center">
                            <ModernCheckbox
                              checked={headers.length > 0 && headers.every((h) => h.enabled)}
                              onChange={(checked: boolean) => {
                                const next = headers.map((h) => ({ ...h, enabled: checked }));
                                setHeaders(next);
                              }}
                            />
                          </div>
                        </th>
                        <th className="px-3 py-2">Header</th>
                        <th className="px-3 py-2">Value</th>
                        <th className="px-3 py-2">Description</th>
                        <th className="w-8 px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {headers.map((h, idx) => (
                        <tr key={h.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                          <td className="px-3 py-1.5 text-center">
                            <div className="flex items-center justify-center">
                              <ModernCheckbox
                                checked={h.enabled}
                                onChange={(checked: boolean) => {
                                  const next = [...headers];
                                  next[idx].enabled = checked;
                                  setHeaders(next);
                                }}
                              />
                            </div>
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              value={h.key}
                              list="common-headers-list"
                              placeholder="Header-Name"
                              onChange={(e) => {
                                const next = [...headers];
                                next[idx].key = e.target.value;
                                setHeaders(next);
                              }}
                              className="w-full bg-transparent font-mono text-xs outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              value={h.value}
                              placeholder="value"
                              onChange={(e) => {
                                const next = [...headers];
                                next[idx].value = e.target.value;
                                setHeaders(next);
                              }}
                              className="w-full bg-transparent font-mono text-xs outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              value={h.description || ''}
                              placeholder="optional description"
                              onChange={(e) => {
                                const next = [...headers];
                                next[idx].description = e.target.value;
                                setHeaders(next);
                              }}
                              className="w-full bg-transparent text-xs outline-none text-slate-500 placeholder:text-slate-400"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setHeaders(headers.filter((_, i) => i !== idx));
                              }}
                              className="text-slate-400 hover:text-red-500"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <datalist id="common-headers-list">
                    {COMMON_HEADERS.map((ch) => (
                      <option key={ch} value={ch} />
                    ))}
                  </datalist>
                </div>
              )}
            </div>
          )}

          {/* AUTH TAB */}
          {activeTab === 'auth' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Auth Type:</span>
                <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-900">
                  {(['none', 'bearer', 'basic', 'apiKey'] as AuthType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAuth({ ...auth, type: t })}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                        auth.type === t
                          ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-800 dark:text-blue-400'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      {t === 'none' ? 'No Auth' : t === 'bearer' ? 'Bearer Token' : t === 'basic' ? 'Basic Auth' : 'API Key'}
                    </button>
                  ))}
                </div>
              </div>

              {/* No Auth */}
              {auth.type === 'none' && (
                <div className="py-8 text-center text-xs text-slate-400">
                  This request does not use authorization credentials.
                </div>
              )}

              {/* Bearer Token */}
              {auth.type === 'bearer' && (
                <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Token</label>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={auth.bearerToken || ''}
                      onChange={(e) => setAuth({ ...auth, bearerToken: e.target.value })}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 pr-10 font-mono text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    The token will be automatically added to the request as{' '}
                    <code className="text-blue-600 dark:text-blue-400">Authorization: Bearer &lt;token&gt;</code>.
                  </p>
                </div>
              )}

              {/* Basic Auth */}
              {auth.type === 'basic' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Username</label>
                    <input
                      type="text"
                      value={auth.basicUsername || ''}
                      onChange={(e) => setAuth({ ...auth, basicUsername: e.target.value })}
                      placeholder="admin"
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={auth.basicPassword || ''}
                        onChange={(e) => setAuth({ ...auth, basicPassword: e.target.value })}
                        placeholder="••••••••"
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 pr-10 font-mono text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div className="sm:col-span-2 text-[11px] text-slate-500">
                    Credentials will be sent as <code className="text-blue-600 dark:text-blue-400">Authorization: Basic base64(user:pass)</code>.
                  </div>
                </div>
              )}

              {/* API Key */}
              {auth.type === 'apiKey' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Key Name</label>
                    <input
                      type="text"
                      value={auth.apiKeyName || ''}
                      onChange={(e) => setAuth({ ...auth, apiKeyName: e.target.value })}
                      placeholder="X-API-Key"
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Key Value</label>
                    <input
                      type="text"
                      value={auth.apiKeyValue || ''}
                      onChange={(e) => setAuth({ ...auth, apiKeyValue: e.target.value })}
                      placeholder="secret_key_123"
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Add To</label>
                    <CustomSelect
                      value={auth.apiKeyLocation || 'header'}
                      onChange={(val) => setAuth({ ...auth, apiKeyLocation: val as 'header' | 'query' })}
                      options={[
                        { label: 'Header', value: 'header' },
                        { label: 'Query Params', value: 'query' },
                      ]}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BODY TAB */}
          {activeTab === 'body' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-900">
                  {(['none', 'json', 'x-www-form-urlencoded', 'formData', 'raw'] as BodyType[]).map((bt) => (
                    <button
                      key={bt}
                      type="button"
                      onClick={() => {
                        setBody({ ...body, type: bt });
                        if (bt !== 'none' && method === 'GET') {
                          setMethod('POST');
                        }
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                        body.type === bt
                          ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-800 dark:text-blue-400'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      {bt === 'none' ? 'None' : bt === 'json' ? 'JSON' : bt === 'x-www-form-urlencoded' ? 'x-www-form-urlencoded' : bt === 'formData' ? 'form-data' : 'Raw Text'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Warning if method is GET but request has a body payload */}
              {method === 'GET' && body.type !== 'none' && (
                <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-300">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0 text-amber-500" />
                    <span>
                      GET requests do not send a body payload. Servers like Ollama will return <strong>405 Method Not Allowed</strong>.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMethod('POST')}
                    className="ml-2 shrink-0 rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm hover:bg-amber-500 active:scale-95"
                  >
                    Switch to POST
                  </button>
                </div>
              )}

              {body.type === 'none' && (
                <div className="py-8 text-center text-xs text-slate-400">
                  This request does not have a body payload.
                </div>
              )}

              {/* JSON Body - Presentation styled like API JSON response */}
              {body.type === 'json' && (
                <div className="flex flex-col gap-1.5">
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-sm">
                    {/* Header bar matching API Response Viewer */}
                    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 px-3 py-2 bg-slate-50/80 dark:bg-slate-900/60">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                          <FileJson size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-mono text-[12px] font-semibold text-slate-900 dark:text-slate-100">
                            {jsonFileName}
                          </div>
                          <div className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {['JSON', formatBytes(jsonSize), `${jsonLineCount} ${jsonLineCount === 1 ? 'line' : 'lines'}`].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => setWordWrap(!wordWrap)}
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200 ${
                            wordWrap ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : ''
                          }`}
                          title={wordWrap ? 'Word wrap: on' : 'Word wrap: off'}
                          aria-label="Toggle word wrap"
                        >
                          <WrapText size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={handlePrettifyJson}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-blue-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                          title="Prettify / Format JSON with Prettier"
                          aria-label="Prettify JSON with Prettier"
                        >
                          <PrettierIcon size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyJson}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          title={copiedJson ? 'Copied' : 'Copy JSON'}
                          aria-label="Copy JSON"
                        >
                          {copiedJson ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={handleClearJson}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-rose-500 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-rose-400"
                          title="Reset JSON to empty object"
                          aria-label="Reset JSON"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Code Area */}
                    <div className="relative w-full h-[220px]">
                      <MonacoEditor
                        height="220px"
                        defaultLanguage="json"
                        language="json"
                        theme={isDark ? "api-vs-dark" : "api-light"}
                        value={body.rawJson || ''}
                        onChange={(val) => handleJsonChange(val || '')}
                        options={{
                          minimap: { enabled: false },
                          lineNumbers: 'on',
                          scrollBeyondLastLine: false,
                          fontSize: 11.5,
                          lineHeight: 20,
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                          tabSize: 2,
                          wordWrap: wordWrap ? 'on' : 'off',
                          automaticLayout: true,
                          renderLineHighlight: 'line',
                          overviewRulerBorder: false,
                          hideCursorInOverviewRuler: true,
                          padding: { top: 8, bottom: 8 },
                          scrollbar: {
                            vertical: 'auto',
                            horizontal: 'auto',
                            verticalScrollbarSize: 8,
                            horizontalScrollbarSize: 8,
                          },
                        }}
                        beforeMount={(monaco) => {
                          try {
                            monaco.editor.defineTheme('api-vs-dark', {
                              base: 'vs-dark',
                              inherit: true,
                              rules: [
                                { token: 'string.key.json', foreground: '9cdcfe' },
                                { token: 'string.value.json', foreground: 'ce9178' },
                                { token: 'number.json', foreground: 'b5cea8' },
                                { token: 'keyword.json', foreground: '569cd6' },
                              ],
                              colors: {
                                'editor.background': '#0f172a',
                                'editorGutter.background': '#0f172a',
                                'editorLineNumber.foreground': '#475569',
                                'editorLineNumber.activeForeground': '#94a3b8',
                                'editor.lineHighlightBackground': '#1e293b33',
                                'editorCursor.foreground': '#38bdf8',
                                'editor.selectionBackground': '#3b82f640',
                              },
                            });
                            monaco.editor.defineTheme('api-light', {
                              base: 'vs',
                              inherit: true,
                              rules: [],
                              colors: {
                                'editor.background': '#ffffff',
                                'editorGutter.background': '#ffffff',
                                'editorLineNumber.foreground': '#94a3b8',
                                'editorLineNumber.activeForeground': '#475569',
                                'editor.lineHighlightBackground': '#f1f5f9',
                              },
                            });
                          } catch {}
                        }}
                        loading={
                          <Highlight theme={isDark ? themes.vsDark : themes.github} code={body.rawJson || ''} language="json">
                            {({ tokens, getLineProps, getTokenProps }) => (
                              <pre className={`py-2 font-mono leading-[1.6] text-[11.5px] h-[220px] overflow-auto ${isDark ? 'bg-[#0f172a]' : 'bg-white'}`}>
                                {tokens.map((line, i) => (
                                  <div key={i} {...getLineProps({ line })} className="flex px-3">
                                    <span className="mr-3 inline-block w-9 shrink-0 select-none text-right text-slate-400/70 dark:text-slate-600">
                                      {i + 1}
                                    </span>
                                    <span>
                                      {line.map((token, key) => (
                                        <span key={key} {...getTokenProps({ token })} />
                                      ))}
                                    </span>
                                  </div>
                                ))}
                              </pre>
                            )}
                          </Highlight>
                        }
                      />
                    </div>

                    {/* Status bar */}
                    <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 px-3 py-1.5">
                      <span className="text-[10px] font-mono text-slate-500">
                        {jsonError ? (
                          <span className="text-red-500 flex items-center gap-1"><AlertCircle size={11} /> {jsonError}</span>
                        ) : (
                          <span className="text-emerald-500/90 flex items-center gap-1 font-medium"><Check size={11} /> Valid JSON</span>
                        )}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                        application/json
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Raw Text Body */}
              {body.type === 'raw' && (
                <div className="flex flex-col gap-1.5">
                  <textarea
                    value={body.rawText || ''}
                    onChange={(e) => setBody({ ...body, rawText: e.target.value })}
                    rows={8}
                    spellCheck={false}
                    placeholder="Raw text payload..."
                    className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-5 text-slate-900 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              )}

              {/* URL Encoded Body */}
              {body.type === 'x-www-form-urlencoded' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">URL-encoded Parameters</span>
                    <button
                      type="button"
                      onClick={() => {
                        const list = body.urlEncoded || [];
                        setBody({
                          ...body,
                          urlEncoded: [...list, { id: Math.random().toString(36).substring(2, 9), enabled: true, key: '', value: '' }],
                        });
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                    >
                      <Plus size={13} /> Add Form Field
                    </button>
                  </div>

                  {(body.urlEncoded || []).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
                      <p className="text-xs">No form fields configured.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setBody({
                            ...body,
                            urlEncoded: [{ id: Math.random().toString(36).substring(2, 9), enabled: true, key: '', value: '' }],
                          });
                        }}
                        className="mt-2 text-xs font-semibold text-blue-500 hover:underline"
                      >
                        + Add first field
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 border-b border-slate-200 dark:border-slate-800 font-semibold">
                          <tr>
                            <th className="w-8 px-3 py-2 text-center">
                              <div className="flex items-center justify-center">
                                <ModernCheckbox
                                  checked={(body.urlEncoded || []).length > 0 && (body.urlEncoded || []).every((item) => item.enabled)}
                                  onChange={(checked: boolean) => {
                                    const next = (body.urlEncoded || []).map((item) => ({ ...item, enabled: checked }));
                                    setBody({ ...body, urlEncoded: next });
                                  }}
                                />
                              </div>
                            </th>
                            <th className="px-3 py-2">Field Key</th>
                            <th className="px-3 py-2">Value</th>
                            <th className="w-8 px-2 py-2"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {(body.urlEncoded || []).map((item, idx) => (
                            <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                              <td className="px-3 py-1.5 text-center">
                                <div className="flex items-center justify-center">
                                  <ModernCheckbox
                                    checked={item.enabled}
                                    onChange={(checked: boolean) => {
                                      const next = [...(body.urlEncoded || [])];
                                      next[idx].enabled = checked;
                                      setBody({ ...body, urlEncoded: next });
                                    }}
                                  />
                                </div>
                              </td>
                              <td className="px-3 py-1.5">
                                <input
                                  type="text"
                                  value={item.key}
                                  placeholder="field_key"
                                  onChange={(e) => {
                                    const next = [...(body.urlEncoded || [])];
                                    next[idx].key = e.target.value;
                                    setBody({ ...body, urlEncoded: next });
                                  }}
                                  className="w-full bg-transparent font-mono text-xs outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                                />
                              </td>
                              <td className="px-3 py-1.5">
                                <input
                                  type="text"
                                  value={item.value}
                                  placeholder="field_value"
                                  onChange={(e) => {
                                    const next = [...(body.urlEncoded || [])];
                                    next[idx].value = e.target.value;
                                    setBody({ ...body, urlEncoded: next });
                                  }}
                                  className="w-full bg-transparent font-mono text-xs outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                                />
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBody({
                                      ...body,
                                      urlEncoded: (body.urlEncoded || []).filter((_, i) => i !== idx),
                                    });
                                  }}
                                  className="text-slate-400 hover:text-red-500"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Form Data Body */}
              {body.type === 'formData' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Multipart Form Data</span>
                    <button
                      type="button"
                      onClick={() => {
                        const list = body.formData || [];
                        setBody({
                          ...body,
                          formData: [...list, { id: Math.random().toString(36).substring(2, 9), enabled: true, key: '', value: '' }],
                        });
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                    >
                      <Plus size={13} /> Add Form Data Field
                    </button>
                  </div>

                  {(body.formData || []).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
                      <p className="text-xs">No multipart form fields configured.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setBody({
                            ...body,
                            formData: [{ id: Math.random().toString(36).substring(2, 9), enabled: true, key: '', value: '' }],
                          });
                        }}
                        className="mt-2 text-xs font-semibold text-blue-500 hover:underline"
                      >
                        + Add first field
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 border-b border-slate-200 dark:border-slate-800 font-semibold">
                          <tr>
                            <th className="w-8 px-3 py-2 text-center">
                              <div className="flex items-center justify-center">
                                <ModernCheckbox
                                  checked={(body.formData || []).length > 0 && (body.formData || []).every((item) => item.enabled)}
                                  onChange={(checked: boolean) => {
                                    const next = (body.formData || []).map((item) => ({ ...item, enabled: checked }));
                                    setBody({ ...body, formData: next });
                                  }}
                                />
                              </div>
                            </th>
                            <th className="px-3 py-2">Field Key</th>
                            <th className="px-3 py-2">Value</th>
                            <th className="w-8 px-2 py-2"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {(body.formData || []).map((item, idx) => (
                            <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                              <td className="px-3 py-1.5 text-center">
                                <div className="flex items-center justify-center">
                                  <ModernCheckbox
                                    checked={item.enabled}
                                    onChange={(checked: boolean) => {
                                      const next = [...(body.formData || [])];
                                      next[idx].enabled = checked;
                                      setBody({ ...body, formData: next });
                                    }}
                                  />
                                </div>
                              </td>
                              <td className="px-3 py-1.5">
                                <input
                                  type="text"
                                  value={item.key}
                                  placeholder="key"
                                  onChange={(e) => {
                                    const next = [...(body.formData || [])];
                                    next[idx].key = e.target.value;
                                    setBody({ ...body, formData: next });
                                  }}
                                  className="w-full bg-transparent font-mono text-xs outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                                />
                              </td>
                              <td className="px-3 py-1.5">
                                <input
                                  type="text"
                                  value={item.value}
                                  placeholder="value"
                                  onChange={(e) => {
                                    const next = [...(body.formData || [])];
                                    next[idx].value = e.target.value;
                                    setBody({ ...body, formData: next });
                                  }}
                                  className="w-full bg-transparent font-mono text-xs outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                                />
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBody({
                                      ...body,
                                      formData: (body.formData || []).filter((_, i) => i !== idx),
                                    });
                                  }}
                                  className="text-slate-400 hover:text-red-500"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* RESPONSE & EXTRACT TAB */}
          {activeTab === 'response' && (
            <div className="flex flex-col gap-4">
              {/* Presets & Info bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 dark:border-indigo-500/30 dark:bg-indigo-500/10">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-indigo-500 shrink-0" />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Response Extraction & LLM Optimizer</span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Extract any nested key from JSON (e.g. LLM answers) and format for display.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleOllamaPreset}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-indigo-500 active:scale-95 shrink-0"
                >
                  <Zap size={13} />
                  <span>Configure for Ollama / LLM</span>
                </button>
              </div>

              {/* 1. Stream Enable / Disable */}
              <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-900/30">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Streaming Control (Ollama / OpenAI / LLMs)</label>
                    <p className="text-[11px] text-slate-500">Controls whether the server sends a single complete response or live chunks.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => handleStreamToggle(false)}
                    className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                      streamEnabled === false
                        ? 'border-emerald-500/60 bg-emerald-500/10 ring-1 ring-emerald-500/30'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-600 dark:text-emerald-400">
                      <span>Single Response</span>
                      <span className="text-[10px] rounded bg-emerald-500/20 px-1 py-px font-semibold">Recommended</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 leading-snug">Forces "stream": false so Ollama/OpenAI returns one clean JSON object without split chunks.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStreamToggle(true)}
                    className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                      streamEnabled === true
                        ? 'border-blue-500/60 bg-blue-500/10 ring-1 ring-blue-500/30'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-bold text-xs text-blue-600 dark:text-blue-400">Stream Chunks</span>
                    <span className="text-[10px] text-slate-500 mt-1 leading-snug">Forces "stream": true to stream live tokens and aggregate NDJSON/SSE.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStreamToggle(undefined)}
                    className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                      streamEnabled === undefined
                        ? 'border-slate-400 bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-400'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-bold text-xs text-slate-700 dark:text-slate-300">Auto / Default</span>
                    <span className="text-[10px] text-slate-500 mt-1 leading-snug">Respects whatever is currently configured in the JSON request body.</span>
                  </button>
                </div>
              </div>

              {/* 2. Key / Path Extraction */}
              <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-900/30">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Extract Key / JSONPath</label>
                    <p className="text-[11px] text-slate-500">Pick any key or dot-path to extract directly onto the canvas (e.g. message.content, response, data.items).</p>
                  </div>
                  {extractPath && (
                    <button
                      type="button"
                      onClick={() => setExtractPath('')}
                      className="text-[11px] font-medium text-slate-500 hover:text-red-500"
                    >
                      Clear extraction
                    </button>
                  )}
                </div>

                <div className="relative mt-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={extractPath}
                    onChange={(e) => setExtractPath(e.target.value)}
                    placeholder="e.g. message.content or data.items or choices[0].message.content"
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 font-mono text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  {extractPath && (
                    <button
                      type="button"
                      onClick={() => setExtractPath('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Candidate path chips */}
                {candidatePaths.length > 0 && (
                  <div className="flex flex-col gap-1.5 mt-1">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Detected keys in last response:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {candidatePaths.map((cand) => (
                        <button
                          key={cand.path}
                          type="button"
                          onClick={() => setExtractPath(cand.path)}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-mono transition-colors ${
                            extractPath === cand.path
                              ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                          }`}
                          title={`${cand.label} (${cand.preview})`}
                        >
                          <span>{cand.path}</span>
                          <span className="text-[9px] text-slate-400 opacity-75 truncate max-w-[120px]">{cand.preview}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Live Preview Box */}
                {extractPath.trim() && (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2.5 font-mono text-[11px] dark:border-slate-800 dark:bg-slate-950">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Live Preview for "{extractPath.trim()}"
                    </div>
                    {liveExtractedValue !== undefined ? (
                      <div className="custom-scrollbar max-h-24 overflow-y-auto whitespace-pre-wrap break-all text-slate-800 dark:text-slate-200">
                        {typeof liveExtractedValue === 'string'
                          ? liveExtractedValue
                          : JSON.stringify(liveExtractedValue, null, 2)}
                      </div>
                    ) : (
                      <span className="text-amber-500 italic">Key not found in current response.</span>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Response Formatting */}
              <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-900/30">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Response Formatting Mode</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'auto', label: 'Auto', hint: 'Default behavior' },
                    { id: 'markdown', label: 'Markdown', hint: 'Headers, bold, code fences' },
                    { id: 'json', label: 'Formatted JSON', hint: 'Indented syntax' },
                    { id: 'text', label: 'Plain Text', hint: 'Raw readable text' },
                  ].map((fmt) => (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setResponseFormat(fmt.id as any)}
                      className={`flex flex-col items-start p-2 rounded-lg border text-left transition-all ${
                        responseFormat === fmt.id
                          ? 'border-blue-500 bg-blue-500/10 font-bold text-blue-600 dark:text-blue-400'
                          : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-xs">{fmt.label}</span>
                      <span className="text-[9px] text-slate-400 leading-tight">{fmt.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Response Parsing Type */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Parse Response As</label>
                  <div className="flex h-9 rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-900">
                    {RESPONSE_TYPES.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setResponseType(type.value)}
                        className={`flex-1 rounded-md text-xs font-medium transition-all ${
                          responseType === type.value
                            ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-800 dark:text-blue-400'
                            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                  <span className="text-[11px] text-slate-400">Controls whether response is auto-detected, parsed as JSON, plain text, or binary blob.</span>
                </div>

                {/* Timeout */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Request Timeout</label>
                    {isTimeoutEmpty ? (
                      <span className="inline-flex items-center gap-1 rounded bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                        <TimerOff size={11} />
                        <span>No timeout (infinite)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                        <Timer size={11} />
                        <span>{parsedTimeout < 1000 ? `${parsedTimeout}ms` : `${(parsedTimeout / 1000).toFixed(1)}s`}</span>
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min={100}
                      max={120000}
                      step={500}
                      value={timeout}
                      onChange={(e) => setTimeoutVal(e.target.value)}
                      placeholder="Leave empty for no timeout"
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 pr-14 font-mono text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                    />
                    {timeout ? (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <span className="text-xs text-slate-400">ms</span>
                        <button
                          type="button"
                          onClick={() => setTimeoutVal('')}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded cursor-pointer"
                          title="Clear timeout (no timeout)"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-400">
                        ∞ None
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Leave empty to disable timeout for long LLM streams or slow jobs.</span>
                    {!isTimeoutEmpty && (
                      <button
                        type="button"
                        onClick={() => setTimeoutVal('')}
                        className="text-blue-500 hover:underline font-medium cursor-pointer"
                      >
                        Remove timeout
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Show Response As (Canvas view) */}
              <div className="flex flex-col gap-1.5 border-t border-slate-200 dark:border-slate-800 pt-3">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Canvas Visualization View</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {RESPONSE_VIEWS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setView(opt.value)}
                      className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                        view === opt.value
                          ? 'border-blue-500/60 bg-blue-500/5 ring-1 ring-blue-500/30'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{opt.label}</span>
                      <span className="text-[10px] text-slate-500 mt-0.5 leading-snug">{opt.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-3.5 sm:px-5 py-3 pb-6 sm:pb-3 dark:border-slate-800 dark:bg-slate-950/50 shrink-0">
          <span className="hidden text-xs text-slate-400 sm:inline">
            Press <kbd className="rounded border px-1 text-[10px] font-mono">Esc</kbd> to exit
          </span>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end sm:ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-xl px-3 sm:px-4 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={() => handleSave(false)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 sm:px-4 text-xs font-semibold text-slate-800 shadow-sm transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              <Check size={14} />
              <span>Save Config</span>
            </button>
            {isLoading ? (
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('abort-api-node', { detail: { path } }));
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 sm:px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-rose-500 active:scale-95 cursor-pointer"
                title="Cancel in-flight request signal"
              >
                <Square size={11} className="fill-current text-white" />
                <span>Stop Request</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={!canSave || !trimmedUrl}
                onClick={() => handleSave(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 sm:px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-500 active:scale-95 disabled:opacity-50"
              >
                <Send size={14} />
                <span>Save & Send</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Import cURL Sub-Modal / Bottom Sheet on Mobile */}
      {showCurlModal && (
        <div
          className="fixed inset-0 z-[10002] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCurlModal(false);
              setCurlError(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-label="Import cURL Command"
            className="flex flex-col w-full max-w-full sm:max-w-xl max-h-[92vh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-2xl border-t border-x border-b-0 sm:border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-[#0b1120] dark:text-slate-100 dark:shadow-black/70 animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 overflow-hidden"
          >
            {/* Mobile Drag Handle */}
            <div
              className="flex sm:hidden w-full items-center justify-center pt-2.5 pb-1 shrink-0 cursor-grab active:cursor-grabbing"
              onClick={() => {
                setShowCurlModal(false);
                setCurlError(null);
              }}
              title="Close modal"
            >
              <div className="h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700/80" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 border border-slate-200 text-slate-700 dark:bg-slate-800/90 dark:border-slate-700/70 dark:text-blue-400">
                  <Terminal size={15} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      Import cURL Command
                    </span>
                    <span className="rounded border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400 hidden xs:inline">
                      Auto-detect
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                    Paste raw cURL from browser DevTools, Postman, or Swagger
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCurlModal(false);
                  setCurlError(null);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Area */}
            <div
              className="flex flex-col gap-3 p-4 sm:p-5 overflow-y-auto no-scrollbar scrollbar-none"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {/* Professional Flat Terminal Code Box */}
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900 dark:bg-[#070b14]">
                {/* Flat Terminal Header Bar */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800/80 bg-slate-100/70 dark:bg-slate-900/80">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 font-mono text-[11px] font-medium">
                      <Terminal size={12} className="text-blue-500 dark:text-blue-400" />
                      <span>cURL</span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 hidden xs:inline">bash · sh</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handlePasteCurlFromClipboard}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700/70 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium transition-colors cursor-pointer"
                      title="Paste from clipboard"
                    >
                      <ClipboardPaste size={12} className="text-blue-500 dark:text-blue-400" />
                      <span>{copiedClipboardHint || 'Paste'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleInsertSampleCurl}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700/70 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium transition-colors cursor-pointer"
                      title="Insert sample cURL command"
                    >
                      <Code size={12} className="text-amber-500 dark:text-amber-400" />
                      <span>Sample</span>
                    </button>
                    {curlInputText && (
                      <button
                        type="button"
                        onClick={() => {
                          setCurlInputText('');
                          setCurlError(null);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700/70 bg-white dark:bg-slate-800/80 hover:bg-rose-50 dark:hover:bg-rose-500/20 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 text-[11px] font-medium transition-colors cursor-pointer"
                        title="Clear input"
                      >
                        <Trash2 size={12} />
                        <span>Clear</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Textarea */}
                <textarea
                  value={curlInputText}
                  onChange={(e) => {
                    setCurlInputText(e.target.value);
                    if (curlError) setCurlError(null);
                  }}
                  rows={6}
                  placeholder={`curl -X POST 'https://api.example.com/v1/users' \\\n  -H 'Authorization: Bearer token' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"name":"John"}'`}
                  className="w-full resize-none p-3.5 font-mono text-xs leading-relaxed text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 bg-transparent outline-none no-scrollbar scrollbar-none selection:bg-blue-500/30"
                  style={{ scrollbarWidth: 'none' }}
                  autoFocus
                  spellCheck={false}
                />
              </div>

              {/* Flat Live Preview / Error / Helper Status */}
              {curlError ? (
                <div className="flex items-center gap-2 p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-mono animate-in fade-in">
                  <AlertCircle size={14} className="shrink-0 text-rose-500 dark:text-rose-400" />
                  <span className="truncate">{curlError}</span>
                </div>
              ) : liveCurlPreview?.valid ? (
                <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl border border-slate-200 dark:border-slate-700/70 bg-slate-50/80 dark:bg-slate-900/60 text-xs animate-in fade-in">
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 text-[11px] pr-1">
                    <Check size={13} />
                    Parsed:
                  </span>
                  <span className="rounded border border-blue-500/40 bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold font-mono text-blue-600 dark:text-blue-400 uppercase">
                    {liveCurlPreview.method}
                  </span>
                  <span
                    className="font-mono text-[11px] text-slate-800 dark:text-slate-200 truncate max-w-[200px] sm:max-w-[280px]"
                    title={liveCurlPreview.url}
                  >
                    {liveCurlPreview.url}
                  </span>
                  {liveCurlPreview.headersCount > 0 && (
                    <span className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 dark:text-slate-300">
                      {liveCurlPreview.headersCount} {liveCurlPreview.headersCount === 1 ? 'header' : 'headers'}
                    </span>
                  )}
                  {liveCurlPreview.hasAuth && (
                    <span className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 dark:text-slate-300 capitalize">
                      {liveCurlPreview.authType}
                    </span>
                  )}
                  {liveCurlPreview.bodyType !== 'none' && (
                    <span className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 dark:text-slate-300 uppercase">
                      {liveCurlPreview.bodyType}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 px-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <Terminal size={13} className="shrink-0 text-slate-400" />
                  <span>
                    Copy cURL from browser DevTools (Network &rarr; Copy as cURL) or Postman and paste here.
                  </span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 pb-6 sm:pb-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 shrink-0">
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 hidden sm:inline">
                {curlInputText ? `${curlInputText.length} chars · ${curlInputText.split('\n').length} lines` : 'Ready to import'}
              </span>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    setShowCurlModal(false);
                    setCurlError(null);
                  }}
                  className="h-9 rounded-xl px-3.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!curlInputText.trim()}
                  onClick={() => handleImportCurlText(curlInputText)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 text-xs font-semibold text-white shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ArrowRight size={14} />
                  <span>Parse & Fill</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
}
