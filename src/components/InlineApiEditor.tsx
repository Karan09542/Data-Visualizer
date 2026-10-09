import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import {
  interpolateVariables,
  interpolateJsonString,
  analyzeVariablesInText,
  substituteInParamList,
  substituteInAuth,
  substituteInBody,
  getAvailableNodeVariables,
  type ApiVariable,
  type AvailableNodeVariable,
} from '../utils/variableInterpolator';
import CustomSelect from './CustomSelect';
import MonacoEditor from '@monaco-editor/react';
import { Highlight, themes } from 'prism-react-renderer';
import { ModernCheckbox } from './image-workspace/components/shared/ModernCheckbox';
import JsonImageBase64Modal from './JsonImageBase64Modal';
import { FreeApiModal } from './FreeApiModal';
import { ExploreCompassIcon } from './icons';
import type { FreeApiPreset } from '../constants/freeApis';
import {
  Check,
  Link2,
  Globe,
  X,
  Copy,
  Terminal,
  FileJson,
  WrapText,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  Code,
  AlertCircle,
  AlertTriangle,
  Lightbulb,
  Infinity,
  Sparkles,
  Square,
  Timer,
  TimerOff,
  Layers,
  Send,
  Search,
  Zap,
  ClipboardPaste,
  ArrowRight,
  ChevronDown,
  Image as ImageIcon,
  Upload,
  Maximize2,
  Minimize2,
  Braces,
  Folder,
  Lock,
  Unlock,
} from 'lucide-react';

interface InlineApiEditorProps {
  initialUrl: string;
  path: string;
  nodeX: number;
  nodeY: number;
  nodeWidth: number;
  nodeHeight?: number;
  initialTab?: TabKey;
  onClose: () => void;
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

const METHOD_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  GET: { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/40', dot: 'bg-emerald-500' },
  POST: { bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/40', dot: 'bg-blue-500' },
  PUT: { bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/40', dot: 'bg-amber-500' },
  PATCH: { bg: 'bg-violet-500/10 dark:bg-violet-500/20', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-500/40', dot: 'bg-violet-500' },
  DELETE: { bg: 'bg-red-500/10 dark:bg-red-500/20', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/40', dot: 'bg-red-500' },
  HEAD: { bg: 'bg-slate-500/10 dark:bg-slate-500/20', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-500/40', dot: 'bg-slate-400' },
  OPTIONS: { bg: 'bg-purple-500/10 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/40', dot: 'bg-purple-500' },
};

const METHOD_SELECT_OPTIONS = METHODS.map((m) => ({
  value: m,
  label: m,
  icon: (
    <span
      className={`inline-block h-2 w-2 rounded-full ${METHOD_COLORS[m]?.dot || 'bg-slate-400'
        }`}
    />
  ),
}));

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

type TabKey = 'params' | 'headers' | 'auth' | 'body' | 'variables' | 'response' | 'settings';

const formatBytes = (bytes?: number) => {
  if (bytes === undefined || !Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const PrettierIcon = ({ size = 14, className = "" }: { size?: number; className?: string }) => (
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

export function InlineApiEditor({ initialUrl, path, initialTab, onClose }: InlineApiEditorProps) {
  const updateNodeValue = useStore((state) => state.updateNodeValue);
  const apiNodeConfig = useStore((state) => state.apiNodeConfig);
  const setApiNodeConfig = useStore((state) => state.setApiNodeConfig);
  const inlineApiEditor = useStore((state) => state.inlineApiEditor);
  const setInlineApiEditor = useStore((state) => state.setInlineApiEditor);
  const apiNodeLoading = useStore((state) => state.apiNodeLoading);
  const apiNodeResponses = useStore((state) => state.apiNodeResponses);
  const jsNodeResponses = useStore((state) => state.jsNodeResponses);
  const parsedData = useStore((state) => state.parsedData);
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
    } catch { }
    return [];
  });

  // Headers
  const [headers, setHeaders] = useState<KeyValueParam[]>(() => currentConfig.headers || []);

  // Auth
  const [auth, setAuth] = useState<AuthConfig>(() => currentConfig.auth || { type: 'none' });

  // Body
  const [body, setBody] = useState<BodyConfig>(() => currentConfig.body || { type: 'none' });

  // Variables & Environments
  const [variables, setVariables] = useState<ApiVariable[]>(() => currentConfig.variables || []);
  const [activeVariableGroup, setActiveVariableGroup] = useState<string>(() => currentConfig.activeVariableGroup || 'All');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('All');
  const [variableSearchQuery, setVariableSearchQuery] = useState('');
  const [newGroupNameInput, setNewGroupNameInput] = useState('');
  const [showAddGroupInput, setShowAddGroupInput] = useState(false);
  const [copiedVarKey, setCopiedVarKey] = useState<string | null>(null);
  const [showSecretMap, setShowSecretMap] = useState<Record<string, boolean>>({});

  // Dynamic variable groups derived from currently defined variables
  const availableGroups = useMemo(() => {
    const set = new Set<string>(['All', 'General']);
    for (const v of variables) {
      if (v.group && v.group.trim()) {
        set.add(v.group.trim());
      }
    }
    return Array.from(set);
  }, [variables]);

  // Filtered variables for search & group tabs
  const filteredVariables = useMemo(() => {
    return variables.filter((v) => {
      // Group filter
      if (selectedGroupFilter !== 'All') {
        const varGroup = (v.group || 'General').trim().toLowerCase();
        if (varGroup !== selectedGroupFilter.trim().toLowerCase()) {
          return false;
        }
      }
      // Search filter
      if (variableSearchQuery.trim()) {
        const query = variableSearchQuery.trim().toLowerCase();
        const matchesKey = v.key.toLowerCase().includes(query);
        const matchesVal = (v.value || '').toLowerCase().includes(query);
        const matchesDesc = (v.description || '').toLowerCase().includes(query);
        const matchesGroup = (v.group || '').toLowerCase().includes(query);
        if (!matchesKey && !matchesVal && !matchesDesc && !matchesGroup) {
          return false;
        }
      }
      return true;
    });
  }, [variables, selectedGroupFilter, variableSearchQuery]);

  // Node Chaining state
  const [nodeChainingSearchQuery, setNodeChainingSearchQuery] = useState('');
  const [showNodeChainingDropdown, setShowNodeChainingDropdown] = useState(false);
  const [copiedChainedToken, setCopiedChainedToken] = useState<string | null>(null);

  const currentNodePath = path || inlineApiEditor?.path;

  const chainingContext = useMemo(
    () => ({
      apiNodeResponses,
      jsNodeResponses,
      parsedData,
      currentNodePath,
    }),
    [apiNodeResponses, jsNodeResponses, parsedData, currentNodePath]
  );

  // Available node variables from canvas (including relative sibling variables)
  const availableNodeVars = useMemo(() => {
    return getAvailableNodeVariables(chainingContext);
  }, [chainingContext]);

  const filteredNodeVars = useMemo(() => {
    if (!nodeChainingSearchQuery.trim()) return availableNodeVars;
    const q = nodeChainingSearchQuery.trim().toLowerCase();
    return availableNodeVars.filter(
      (v) =>
        v.token.toLowerCase().includes(q) ||
        v.nodeName.toLowerCase().includes(q) ||
        v.property.toLowerCase().includes(q) ||
        String(v.value).toLowerCase().includes(q)
    );
  }, [availableNodeVars, nodeChainingSearchQuery]);

  const groupedNodeVars = useMemo(() => {
    const map = new Map<string, { nodeName: string; nodeId: string; nodeType: 'api' | 'js' | 'data'; status?: string; vars: AvailableNodeVariable[] }>();
    for (const v of filteredNodeVars) {
      if (!map.has(v.nodeName)) {
        map.set(v.nodeName, {
          nodeName: v.nodeName,
          nodeId: v.nodeId,
          nodeType: v.nodeType,
          status: v.status,
          vars: [],
        });
      }
      map.get(v.nodeName)!.vars.push(v);
    }
    return Array.from(map.values());
  }, [filteredNodeVars]);

  // Dynamic variable resolution & analysis for URL
  const resolvedUrl = useMemo(
    () => interpolateVariables(url.trim(), variables, activeVariableGroup, chainingContext),
    [url, variables, activeVariableGroup, chainingContext]
  );
  const urlVariableAnalysis = useMemo(
    () => analyzeVariablesInText(url, variables, activeVariableGroup, chainingContext),
    [url, variables, activeVariableGroup, chainingContext]
  );
  const hasUnresolvedUrlVariables = urlVariableAnalysis.some((v) => !v.isResolved);
  const chainedUrlVariables = useMemo(
    () => urlVariableAnalysis.filter((v) => v.isChained),
    [urlVariableAnalysis]
  );

  // UI state
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (initialTab) return initialTab;
    if (inlineApiEditor?.initialTab) return inlineApiEditor.initialTab;
    return 'params';
  });

  useEffect(() => {
    if (inlineApiEditor?.initialTab) {
      setActiveTab(inlineApiEditor.initialTab);
    }
  }, [inlineApiEditor?.initialTab]);
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
  const [showFreeApiModal, setShowFreeApiModal] = useState(false);
  const [showImageBase64Modal, setShowImageBase64Modal] = useState(false);
  const [droppedImageFiles, setDroppedImageFiles] = useState<File[]>([]);
  const [cursorPosition, setCursorPosition] = useState<{ lineNumber: number; column: number } | null>(null);
  const [isJsonFullscreen, setIsJsonFullscreen] = useState(false);
  const editorRef = useRef<any>(null);

  const handleInsertAtCursor = (textToInsert: string) => {
    if (editorRef.current) {
      const editor = editorRef.current;
      const selection = editor.getSelection();
      const position = editor.getPosition();
      const range = selection && !selection.isEmpty()
        ? selection
        : {
          startLineNumber: position?.lineNumber || 1,
          startColumn: position?.column || 1,
          endLineNumber: position?.lineNumber || 1,
          endColumn: position?.column || 1,
        };
      editor.executeEdits('insert-base64-image', [
        {
          range,
          text: textToInsert,
          forceMoveMarkers: true,
        },
      ]);
      editor.focus();
      handleJsonChange(editor.getValue());
    } else {
      handleJsonChange((body.rawJson || '') + textToInsert);
    }
  };

  const handleUpdateFullJson = (newJson: string) => {
    handleJsonChange(newJson);
    if (editorRef.current) {
      editorRef.current.setValue(newJson);
    }
  };

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
    } catch { }
  };

  const handleClearJson = () => {
    const emptyJson = '{\n  \n}';
    setBody({ ...body, rawJson: emptyJson });
    setJsonError(null);
    if (editorRef.current) {
      editorRef.current.setValue(emptyJson);
    }
  };

  const modalRef = useRef<HTMLDivElement>(null);
  const isLoading = !!apiNodeLoading[path];

  // URL Validation
  const trimmedUrl = url.trim();
  const isEmpty = trimmedUrl === '';
  const isValidUrl = (() => {
    if (isEmpty) return true;
    try {
      const toTest = resolvedUrl.startsWith('http://') || resolvedUrl.startsWith('https://')
        ? resolvedUrl
        : `https://${resolvedUrl}`;
      const parsed = new URL(toTest);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      // Allow dynamic template URL format like {{baseUrl}}/path
      if (/\{\{[a-zA-Z0-9_.-]+\}\}/.test(trimmedUrl)) {
        return true;
      }
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
      } catch { }
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
        setCurlBanner(`cURL parse error: ${e?.message || 'Invalid format'}`);
        setTimeout(() => setCurlBanner(null), 4000);
      }
    }
  };

  // Copy as cURL
  const handleCopyCurl = async () => {
    const substitutedParams = substituteInParamList(params, variables, activeVariableGroup, chainingContext);
    const substitutedHeaders = substituteInParamList(headers, variables, activeVariableGroup, chainingContext);
    const substitutedAuth = substituteInAuth(auth, variables, activeVariableGroup, chainingContext);
    const substitutedBody = substituteInBody(body, variables, activeVariableGroup, chainingContext);
    const targetUrl = interpolateVariables(url, variables, activeVariableGroup, chainingContext);

    const cmd = buildCurl(targetUrl, method, substitutedParams, substitutedHeaders, substitutedAuth, substitutedBody);
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    } catch { }
  };

  // Format JSON in Body (safely preserving dynamic {{var}} tokens)
  const handlePrettifyJson = () => {
    if (!body.rawJson) return;
    try {
      // If rawJson has unquoted {{var}}, temporarily quote them to format cleanly
      const tokenMap = new Map<string, string>();
      let tokenIdx = 0;
      const protectedJson = body.rawJson.replace(/(:\s*|\,\s*|\[\s*)(\{\{\s*[a-zA-Z0-9_.\[\]"-]+\s*\}\})/g, (_match, prefix, placeholder) => {
        const token = `__AGY_VAR_${tokenIdx++}__`;
        tokenMap.set(token, placeholder);
        return `${prefix}"${token}"`;
      });

      const parsed = JSON.parse(protectedJson);
      let formatted = JSON.stringify(parsed, null, 2);

      // Restore unquoted variables
      for (const [token, placeholder] of tokenMap.entries()) {
        formatted = formatted.replace(`"${token}"`, placeholder);
      }

      setBody({ ...body, rawJson: formatted });
      setJsonError(null);
      if (editorRef.current && editorRef.current.getValue() !== formatted) {
        editorRef.current.setValue(formatted);
      }
    } catch (e: any) {
      setJsonError(e.message || 'Invalid JSON syntax');
    }
  };

  // Validate JSON on edit (evaluating dynamic template variables)
  const handleJsonChange = (val: string) => {
    setBody({ ...body, rawJson: val });
    if (!val.trim()) {
      setJsonError(null);
      return;
    }
    try {
      // 1. Interpolate using active variables and upstream node chaining
      const interpolated = interpolateJsonString(val, variables, activeVariableGroup, chainingContext);
      // 2. Temporarily replace any remaining unresolved {{...}} with valid placeholders to test structure
      const testJson = interpolated
        .replace(/:\s*\{\{\s*([a-zA-Z0-9_.\[\]"-]+)\s*\}\}/g, ': "__placeholder__"')
        .replace(/\{\{\s*([a-zA-Z0-9_.\[\]"-]+)\s*\}\}/g, '__placeholder__');
      JSON.parse(testJson);
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
      } catch { }
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
      } catch { }
    }
  };

  // Handle Free API Preset Selection
  const handleSelectFreeApi = (preset: FreeApiPreset, autoRun: boolean) => {
    setShowFreeApiModal(false);
    setUrl(preset.url);
    setMethod(preset.method);
    const newHeaders = (preset.headers || []).map((h) => ({
      id: h.id || Math.random().toString(36).substring(2, 9),
      key: h.key,
      value: h.value,
      enabled: h.enabled,
    }));
    setHeaders(newHeaders);
    const newBody = preset.body
      ? { type: preset.body.type, rawJson: preset.body.rawJson || '' }
      : { type: 'none' as const };
    setBody(newBody);
    const newExtractPath = preset.extractPath || '';
    setExtractPath(newExtractPath);
    if (preset.responseFormat) {
      setResponseFormat(preset.responseFormat);
    }
    const newStream = preset.method === 'POST' && preset.id === 'ollama-chat' ? false : undefined;
    setStreamEnabled(newStream);

    let newParams: KeyValueParam[] = [];
    const qIdx = preset.url.indexOf('?');
    if (qIdx > -1) {
      try {
        const sp = new URLSearchParams(preset.url.slice(qIdx + 1));
        sp.forEach((val, key) => {
          newParams.push({ id: Math.random().toString(36).substring(2, 9), enabled: true, key, value: val });
        });
      } catch { }
    }
    setParams(newParams);

    if (inlineApiEditor) {
      setInlineApiEditor({ ...inlineApiEditor, url: preset.url });
    }

    setCurlBanner(`Loaded free API preset: ${preset.name} (${preset.method})`);
    setTimeout(() => setCurlBanner(null), 4000);

    if (autoRun) {
      const newConfig = {
        ...currentConfig,
        method: preset.method,
        responseType,
        params: newParams,
        headers: newHeaders,
        body: newBody,
        extractPath: newExtractPath.trim() || undefined,
        responseFormat: preset.responseFormat,
        streamEnabled: newStream,
      };
      setApiNodeConfig(path, newConfig);
      updateNodeValue(path, preset.url.trim()).then(() => {
        window.dispatchEvent(new CustomEvent('fetch-api-node', { detail: { path } }));
        onClose();
      });
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
      variables,
      activeVariableGroup,
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
      if (e.key === 'Escape') {
        if (showFreeApiModal) {
          setShowFreeApiModal(false);
          return;
        }
        if (showImageBase64Modal) {
          return;
        }
        if (showCurlModal) {
          setShowCurlModal(false);
          return;
        }
        if (isJsonFullscreen) {
          setIsJsonFullscreen(false);
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showCurlModal, showImageBase64Modal, showFreeApiModal, isJsonFullscreen]);

  // Reset fullscreen JSON mode if body type switches away from json
  useEffect(() => {
    if (body.type !== 'json' && isJsonFullscreen) {
      setIsJsonFullscreen(false);
    }
  }, [body.type, isJsonFullscreen]);

  // Count pills for tabs
  const activeParamsCount = params.filter((p) => p.enabled && p.key.trim()).length;
  const activeHeadersCount = headers.filter((h) => h.enabled && h.key.trim()).length;
  const activeVariablesCount = variables.filter((v) => v.enabled !== false && v.key.trim()).length;
  const isAuthActive = auth.type !== 'none';
  const isBodyActive = body.type !== 'none';

  const monacoOptions = useMemo(() => ({
    minimap: { enabled: false },
    lineNumbers: 'on' as const,
    scrollBeyondLastLine: false,
    fontSize: isJsonFullscreen ? 12.5 : 11.5,
    lineHeight: isJsonFullscreen ? 22 : 20,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    tabSize: 2,
    wordWrap: (wordWrap ? 'on' : 'off') as 'on' | 'off',
    automaticLayout: true,
    renderLineHighlight: 'line' as const,
    overviewRulerBorder: false,
    hideCursorInOverviewRuler: true,
    padding: { top: 8, bottom: 8 },
    scrollbar: {
      vertical: 'auto' as const,
      horizontal: 'auto' as const,
      verticalScrollbarSize: 8,
      horizontalScrollbarSize: 8,
    },
  }), [wordWrap, isJsonFullscreen]);

  const handleMonacoBeforeMount = useCallback((monaco: any) => {
    try {
      if (monaco?.languages?.json?.jsonDefaults) {
        monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
          validate: false,
          allowComments: true,
          trailingCommas: 'ignore',
        });
      }
    } catch { }

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
    } catch { }
  }, []);

  const monacoLoadingFallback = (
    <Highlight theme={isDark ? themes.vsDark : themes.github} code={body.rawJson || ''} language="json">
      {({ tokens, getLineProps, getTokenProps }) => (
        <pre className={`py-2 font-mono leading-[1.6] text-[11.5px] ${isJsonFullscreen ? 'h-full' : 'h-[220px]'} overflow-auto ${isDark ? 'bg-[#0f172a]' : 'bg-white'}`}>
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
  );

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

        {curlBanner && (
          <div className={`flex items-center justify-between px-4 py-2 text-xs font-medium border-b animate-in slide-in-from-top-1 ${curlBanner.toLowerCase().includes('error')
            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
            }`}>
            <span className="flex items-center gap-1.5">
              {curlBanner.toLowerCase().includes('error') ? (
                <AlertCircle size={14} className="shrink-0 text-amber-500" />
              ) : (
                <Sparkles size={14} className="shrink-0 text-emerald-500" />
              )}
              <span>{curlBanner}</span>
            </span>
            <button onClick={() => setCurlBanner(null)} className="hover:opacity-75 cursor-pointer">
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
              </div>
              <div className="truncate font-mono text-[11px] text-slate-400 dark:text-slate-500 max-w-[180px] sm:max-w-[450px]" title={path}>
                {path.replace(/^root\.?/, '') || 'root'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowFreeApiModal(true)}
              title="Explore famous free APIs for instant testing (IP, Weather, Mock data, etc.)"
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 px-2 sm:px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-800/60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/50 cursor-pointer"
            >
              <ExploreCompassIcon size={14} />
              <span className="hidden sm:inline">Free APIs</span>
              <span className="inline sm:hidden">APIs</span>
            </button>

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
                options={METHOD_SELECT_OPTIONS}
                renderTrigger={({ ref, isOpen, props }) => (
                  <button
                    ref={ref}
                    type="button"
                    {...props}
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onClick?.(e);
                    }}
                    className={`flex h-8 sm:h-9.5 w-full items-center justify-between gap-1 px-2 sm:px-3 rounded-lg sm:rounded-xl border border-slate-200 bg-white font-mono text-[11px] sm:text-xs font-bold transition-all outline-none dark:border-slate-800 dark:bg-slate-900 ${METHOD_COLORS[method]?.text || 'text-slate-700'
                      } ${isOpen
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
                className="h-8 sm:h-9.5 w-full rounded-lg sm:rounded-xl border border-slate-200 bg-white pl-7 sm:pl-9 pr-14 sm:pr-16 font-mono text-[11px] sm:text-xs text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-600"
              />
              <div className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {availableNodeVars.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowNodeChainingDropdown((prev) => !prev)}
                    className={`p-1 rounded transition-colors cursor-pointer ${showNodeChainingDropdown
                        ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400'
                        : 'text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    title={`Insert chained node variable (${availableNodeVars.length} available)`}
                    aria-label="Insert chained node variable"
                  >
                    <Link2 size={13} />
                  </button>
                )}
                {url && (
                  <button
                    type="button"
                    onClick={() => handleUrlChange('')}
                    className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    title="Clear URL"
                    aria-label="Clear URL"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Floating Dropdown for Chained Node Variables */}
              {showNodeChainingDropdown && (
                <div className="absolute left-0 top-full mt-1.5 z-50 w-full max-w-md rounded-xl border border-cyan-500/30 bg-white dark:bg-slate-900 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1">
                  <div className="flex items-center justify-between p-2.5 bg-cyan-500/5 dark:bg-cyan-950/20 border-b border-cyan-500/15">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-700 dark:text-cyan-300">
                      <Link2 size={13} />
                      <span>Insert Chained Node Variable</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowNodeChainingDropdown(false)}
                      className="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto p-1.5 flex flex-col gap-1">
                    {availableNodeVars.map((v) => {
                      const tokenStr = `{{${v.token}}}`;
                      return (
                        <button
                          key={v.token}
                          type="button"
                          onClick={() => {
                            setUrl((prev) => (prev ? `${prev.replace(/\/+$/, '')}/${tokenStr}` : tokenStr));
                            setShowNodeChainingDropdown(false);
                          }}
                          className="flex items-center justify-between gap-2 p-1.5 rounded-lg text-left hover:bg-cyan-500/10 transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="px-1 py-0.5 rounded bg-cyan-500/15 text-[9px] font-bold text-cyan-600 dark:text-cyan-400 uppercase">
                              {v.nodeType}
                            </span>
                            {v.isRelative && (
                              <span className="px-1 py-0.5 rounded bg-emerald-500/15 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase" title={`Relative import (in ${v.scope})`}>
                                sibling
                              </span>
                            )}
                            <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 truncate">
                              {tokenStr}
                            </span>
                          </div>
                          <span className="font-mono text-[10px] text-slate-400 truncate max-w-[120px]">
                            = {v.preview}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
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
              <span className="text-amber-500 font-medium inline-flex items-center gap-1">
                <AlertTriangle size={12} className="shrink-0 text-amber-500" />
                <span>Localhost uses http://, not https://.{' '}</span>
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
              <span className="text-amber-500 font-medium inline-flex items-center gap-1">
                <Lightbulb size={12} className="shrink-0 text-amber-500" />
                <span>Port 11343 detected.{' '}</span>
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

          {/* Dynamic Variable Interpolation Preview for URL */}
          {urlVariableAnalysis.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-lg border border-blue-500/25 bg-blue-500/5 dark:bg-blue-500/10 text-[11px] animate-in fade-in">
              <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold shrink-0">
                <Braces size={12} />
                <span>Resolved URL:</span>
              </div>
              <span
                className="font-mono text-slate-800 dark:text-slate-200 truncate max-w-[280px] sm:max-w-[460px] select-all cursor-text font-medium"
                title={resolvedUrl}
              >
                {resolvedUrl}
              </span>
              {chainedUrlVariables.length > 0 && (
                <span
                  className="flex items-center gap-1 rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-medium text-cyan-600 dark:text-cyan-400"
                  title={chainedUrlVariables.map((v) => `${v.key} → ${v.value}`).join('\n')}
                >
                  <Link2 size={11} />
                  <span>{chainedUrlVariables.length} Chained Node{chainedUrlVariables.length > 1 ? 's' : ''}</span>
                </span>
              )}
              {hasUnresolvedUrlVariables && (
                <span className="flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 ml-auto">
                  <AlertTriangle size={11} />
                  <span>Unresolved variables</span>
                </span>
              )}
            </div>
          )}
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
            { id: 'variables', label: 'Variables', count: activeVariablesCount, badge: activeVariableGroup !== 'All' ? activeVariableGroup : null },
            { id: 'response', label: 'Response & Extract', badge: extractPath.trim() ? 'EXTRACT' : (streamEnabled !== undefined ? (streamEnabled ? 'STREAM' : 'SINGLE') : null) },
            { id: 'settings', label: 'Settings' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as TabKey)}
                className={`relative flex items-center gap-1.5 px-4 py-3 text-xs font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap ${isActive
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
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0">Auth Type:</span>
                <div
                  className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-900 overflow-x-auto scrollbar-none max-w-full"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {(['none', 'bearer', 'basic', 'apiKey'] as AuthType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAuth({ ...auth, type: t })}
                      className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-all ${auth.type === t
                        ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-800 dark:text-blue-400 font-semibold'
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
              <div className="flex items-center justify-between max-w-full">
                <div
                  className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-900 overflow-x-auto scrollbar-none max-w-full"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
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
                      className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-all ${body.type === bt
                        ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-800 dark:text-blue-400 font-semibold'
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
                  {isJsonFullscreen ? (
                    <div className="relative rounded-xl overflow-hidden border border-dashed border-blue-500/40 bg-blue-500/5 dark:bg-blue-500/10 p-6 flex flex-col items-center justify-center gap-3 text-center min-h-[220px]">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-500">
                        <FileJson size={20} />
                      </div>
                      <div className="space-y-1">
                        <div className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {jsonFileName} is open in full screen
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs">
                          The JSON editor is currently expanded to fill the entire viewport.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsJsonFullscreen(false)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-all active:scale-95 cursor-pointer"
                      >
                        <Minimize2 size={13} />
                        <span>Exit Fullscreen</span>
                      </button>
                    </div>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-sm">
                      {/* Header bar matching API Response Viewer */}
                      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 px-3 py-2 bg-slate-50/80 dark:bg-slate-900/60">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                            <FileJson size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-mono text-[12px] font-semibold text-slate-900 dark:text-slate-100" title={jsonFileName}>
                              {jsonFileName}
                            </div>
                            <div className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                              {['JSON', formatBytes(jsonSize), `${jsonLineCount} ${jsonLineCount === 1 ? 'line' : 'lines'}`].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setDroppedImageFiles([]);
                              setShowImageBase64Modal(true);
                            }}
                            className="inline-flex h-7 items-center gap-1.5 px-2 rounded-lg text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 dark:bg-purple-500/15 dark:hover:bg-purple-500/25 transition-colors cursor-pointer mr-0.5"
                            title="Upload image and convert to Base64 (Ollama, Vision models)"
                            aria-label="Upload image and convert to Base64"
                          >
                            <ImageIcon size={13} className="shrink-0" />
                            <span className="hidden xs:inline">Image (Base64)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setWordWrap(!wordWrap)}
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200 ${wordWrap ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : ''
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
                          <button
                            type="button"
                            onClick={() => setIsJsonFullscreen(true)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
                            title="Full screen (Expand editor to full viewport)"
                            aria-label="Full screen editor"
                          >
                            <Maximize2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Code Area */}
                      <div
                        className="relative w-full h-[220px]"
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                            const imgFiles = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
                            if (imgFiles.length > 0) {
                              setDroppedImageFiles(imgFiles);
                              setShowImageBase64Modal(true);
                            }
                          }
                        }}
                      >
                        <MonacoEditor
                          height="220px"
                          defaultLanguage="json"
                          language="json"
                          theme={isDark ? "api-vs-dark" : "api-light"}
                          value={body.rawJson || ''}
                          onChange={(val) => handleJsonChange(val || '')}
                          onMount={(editor, monaco) => {
                            editorRef.current = editor;
                            try {
                              if (monaco?.languages?.json?.jsonDefaults) {
                                monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                                  validate: false,
                                  allowComments: true,
                                  trailingCommas: 'ignore',
                                });
                              }
                              const model = editor.getModel();
                              if (model && monaco?.editor) {
                                monaco.editor.setModelMarkers(model, 'json', []);
                              }
                            } catch { }
                            if (cursorPosition) {
                              try {
                                editor.setPosition(cursorPosition);
                                editor.revealPositionInCenter(cursorPosition);
                              } catch { }
                            }
                            editor.onDidChangeCursorPosition((e) => {
                              setCursorPosition(e.position);
                            });
                          }}
                          options={monacoOptions}
                          beforeMount={handleMonacoBeforeMount}
                          loading={monacoLoadingFallback}
                        />
                      </div>

                      {/* Status bar */}
                      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 px-3 py-1.5">
                        <span className="text-[10px] font-mono text-slate-500 truncate mr-2">
                          {jsonError ? (
                            <span className="text-red-500 flex items-center gap-1"><AlertCircle size={11} className="shrink-0" /> <span className="truncate">{jsonError}</span></span>
                          ) : (
                            <span className="text-emerald-500/90 flex items-center gap-1 font-medium">
                              <Check size={11} className="shrink-0" />
                              <span>{/\{\{[a-zA-Z0-9_.-]+\}\}/.test(body.rawJson || '') ? 'Valid JSON (Dynamic Variables Enabled)' : 'Valid JSON'}</span>
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                            application/json
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsJsonFullscreen(true)}
                            className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-blue-600 dark:text-slate-500 dark:hover:text-blue-400 transition-colors cursor-pointer"
                            title="Expand to full screen"
                            aria-label="Expand to full screen"
                          >
                            <Maximize2 size={10} />
                            <span className="hidden xs:inline">Fullscreen</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
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
                    <div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Multipart Form Data</span>
                      <p className="text-[11px] text-slate-400">Send text fields or upload binary files and images</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const list = body.formData || [];
                        setBody({
                          ...body,
                          formData: [...list, { id: Math.random().toString(36).substring(2, 9), enabled: true, key: '', value: '', type: 'text' }],
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
                            formData: [{ id: Math.random().toString(36).substring(2, 9), enabled: true, key: '', value: '', type: 'text' }],
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
                            <th className="w-20 px-2 py-2">Type</th>
                            <th className="px-3 py-2">Field Key</th>
                            <th className="px-3 py-2">Value / File</th>
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
                              <td className="px-2 py-1.5">
                                <div className="inline-flex rounded-md border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-900 text-[10px]">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = [...(body.formData || [])];
                                      next[idx].type = 'text';
                                      setBody({ ...body, formData: next });
                                    }}
                                    className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${item.type !== 'file'
                                      ? 'bg-white text-blue-600 shadow-xs dark:bg-slate-800 dark:text-blue-400 font-semibold'
                                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                                      }`}
                                  >
                                    Text
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = [...(body.formData || [])];
                                      next[idx].type = 'file';
                                      setBody({ ...body, formData: next });
                                    }}
                                    className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${item.type === 'file'
                                      ? 'bg-white text-purple-600 shadow-xs dark:bg-slate-800 dark:text-purple-400 font-semibold'
                                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                                      }`}
                                  >
                                    File
                                  </button>
                                </div>
                              </td>
                              <td className="px-3 py-1.5">
                                <input
                                  type="text"
                                  value={item.key}
                                  placeholder={item.type === 'file' ? "file / image" : "key"}
                                  onChange={(e) => {
                                    const next = [...(body.formData || [])];
                                    next[idx].key = e.target.value;
                                    setBody({ ...body, formData: next });
                                  }}
                                  className="w-full bg-transparent font-mono text-xs outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                                />
                              </td>
                              <td className="px-3 py-1.5">
                                {item.type === 'file' ? (
                                  <div className="flex items-center gap-2">
                                    {item.fileData ? (
                                      <div className="flex items-center gap-2 max-w-full min-w-0">
                                        {item.fileData.startsWith('data:image/') && (
                                          <img
                                            src={item.fileData}
                                            alt={item.fileName || 'file'}
                                            className="h-6 w-6 shrink-0 rounded object-cover border border-slate-200 dark:border-slate-700"
                                          />
                                        )}
                                        <div className="min-w-0 truncate font-mono text-[11px] text-slate-800 dark:text-slate-200 max-w-[160px] sm:max-w-[240px]" title={item.fileName}>
                                          {item.fileName}
                                        </div>
                                        {item.fileSize && (
                                          <span className="shrink-0 text-[10px] text-slate-400">
                                            ({formatBytes(item.fileSize)})
                                          </span>
                                        )}
                                        <label className="cursor-pointer text-blue-500 hover:underline text-[10px] shrink-0 ml-1">
                                          Change
                                          <input
                                            type="file"
                                            className="hidden"
                                            onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (file) {
                                                const reader = new FileReader();
                                                reader.onload = () => {
                                                  const next = [...(body.formData || [])];
                                                  next[idx].fileName = file.name;
                                                  next[idx].fileSize = file.size;
                                                  next[idx].fileData = reader.result as string;
                                                  next[idx].value = file.name;
                                                  setBody({ ...body, formData: next });
                                                };
                                                reader.readAsDataURL(file);
                                              }
                                            }}
                                          />
                                        </label>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const next = [...(body.formData || [])];
                                            next[idx].fileName = undefined;
                                            next[idx].fileSize = undefined;
                                            next[idx].fileData = undefined;
                                            next[idx].value = '';
                                            setBody({ ...body, formData: next });
                                          }}
                                          className="text-slate-400 hover:text-rose-500 p-0.5 cursor-pointer"
                                          title="Remove selected file"
                                        >
                                          <X size={12} />
                                        </button>
                                      </div>
                                    ) : (
                                      <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 hover:border-purple-400 bg-slate-50 dark:bg-slate-900/50 hover:bg-purple-50/20 text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer transition-colors text-[11px]">
                                        <Upload size={12} />
                                        <span>Select file / image</span>
                                        <input
                                          type="file"
                                          className="hidden"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              const reader = new FileReader();
                                              reader.onload = () => {
                                                const next = [...(body.formData || [])];
                                                next[idx].fileName = file.name;
                                                next[idx].fileSize = file.size;
                                                next[idx].fileData = reader.result as string;
                                                next[idx].value = file.name;
                                                if (!next[idx].key) {
                                                  next[idx].key = file.type.startsWith('image/') ? 'image' : 'file';
                                                }
                                                setBody({ ...body, formData: next });
                                              };
                                              reader.readAsDataURL(file);
                                            }
                                          }}
                                        />
                                      </label>
                                    )}
                                  </div>
                                ) : (
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
                                )}
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
                                  className="text-slate-400 hover:text-red-500 cursor-pointer"
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
                    className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${streamEnabled === false
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
                    className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${streamEnabled === true
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
                    className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${streamEnabled === undefined
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
                          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-mono transition-colors ${extractPath === cand.path
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
                      className={`flex flex-col items-start p-2 rounded-lg border text-left transition-all ${responseFormat === fmt.id
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

          {/* VARIABLES TAB */}
          {activeTab === 'variables' && (
            <div className="flex flex-col gap-4">
              {/* Header card with Overview, Active Scope & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 mt-0.5">
                    <Braces size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <span>Dynamic Variables & Environments</span>
                      <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-blue-600 dark:text-blue-400">
                        {`{{var}}`}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      Group and interpolate variables across URL, Headers, Params, Auth, or JSON Body.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                  {/* Active Scope Selector */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Scope:</span>
                    <div className="w-48 sm:w-56">
                      <CustomSelect
                        value={activeVariableGroup}
                        onChange={(val) => setActiveVariableGroup(val)}
                        options={availableGroups.map((grp) => ({
                          value: grp,
                          label: grp === 'All' ? 'All Groups (Default)' : `Group: ${grp}`,
                          icon: <Folder size={12} className={grp === 'All' ? 'text-blue-500' : 'text-slate-400'} />,
                          description: grp === 'All' ? 'Active in all groups' : `Filter to "${grp}" group`,
                        }))}
                        renderTrigger={({ ref, isOpen, props }) => (
                          <button
                            ref={ref}
                            type="button"
                            {...props}
                            onClick={(e) => {
                              e.stopPropagation();
                              props.onClick?.(e);
                            }}
                            className={`flex h-8 w-full items-center justify-between gap-1.5 px-2.5 rounded-lg border text-xs font-semibold transition-all outline-none cursor-pointer ${isOpen
                              ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/40 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
                              }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Folder size={12} className={activeVariableGroup === 'All' ? 'text-blue-500 shrink-0' : 'text-slate-400 shrink-0'} />
                              <span className="truncate">
                                {activeVariableGroup === 'All' ? 'All Groups (Default)' : `Group: ${activeVariableGroup}`}
                              </span>
                            </div>
                            <ChevronDown
                              size={12}
                              className={`text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                            />
                          </button>
                        )}
                      />
                    </div>
                  </div>

                  {/* Add Variable Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const newVar: ApiVariable = {
                        id: Math.random().toString(36).substring(2, 9),
                        enabled: true,
                        key: '',
                        value: '',
                        group: selectedGroupFilter === 'All' ? 'General' : selectedGroupFilter,
                        description: '',
                        isSecret: false,
                      };
                      setVariables([...variables, newVar]);
                    }}
                    className="inline-flex h-7.5 items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-500 px-2.5 text-xs font-semibold text-white transition-all shadow-xs cursor-pointer active:scale-95"
                  >
                    <Plus size={13} />
                    <span>Add Variable</span>
                  </button>
                </div>
              </div>

              {/* Group Filter Chips & Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                {/* Group Filter Tabs */}
                <div
                  className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none pb-0.5"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">
                    Filter:
                  </span>
                  {availableGroups.map((grp) => {
                    const count = grp === 'All'
                      ? variables.length
                      : variables.filter((v) => (v.group || 'General').toLowerCase() === grp.toLowerCase()).length;
                    const isSelected = selectedGroupFilter.toLowerCase() === grp.toLowerCase();
                    return (
                      <button
                        key={grp}
                        type="button"
                        onClick={() => setSelectedGroupFilter(grp)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${isSelected
                          ? 'bg-blue-600 text-white shadow-xs font-semibold'
                          : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/80'
                          }`}
                      >
                        <Folder size={11} className={isSelected ? 'text-white' : 'text-slate-400'} />
                        <span>{grp}</span>
                        <span className={`text-[10px] px-1 rounded-full ${isSelected ? 'bg-blue-700/50 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}

                  {/* Add Group Inline Trigger */}
                  {showAddGroupInput ? (
                    <div className="flex items-center gap-1 shrink-0 animate-in fade-in">
                      <input
                        type="text"
                        value={newGroupNameInput}
                        onChange={(e) => setNewGroupNameInput(e.target.value)}
                        placeholder="Group name..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newGroupNameInput.trim()) {
                            setSelectedGroupFilter(newGroupNameInput.trim());
                            setNewGroupNameInput('');
                            setShowAddGroupInput(false);
                          } else if (e.key === 'Escape') {
                            setShowAddGroupInput(false);
                          }
                        }}
                        autoFocus
                        className="h-7 w-28 rounded-md border border-blue-500 bg-white px-2 text-xs outline-none dark:bg-slate-900 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newGroupNameInput.trim()) {
                            setSelectedGroupFilter(newGroupNameInput.trim());
                            setNewGroupNameInput('');
                          }
                          setShowAddGroupInput(false);
                        }}
                        className="h-7 px-1.5 rounded bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 cursor-pointer"
                      >
                        OK
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddGroupInput(false)}
                        className="h-7 px-1 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowAddGroupInput(true)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-400 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer"
                    >
                      <Plus size={11} />
                      <span>Group</span>
                    </button>
                  )}
                </div>

                {/* Search Box */}
                <div className="relative min-w-[180px] sm:w-48 shrink-0">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={variableSearchQuery}
                    onChange={(e) => setVariableSearchQuery(e.target.value)}
                    placeholder="Search variables..."
                    className="h-7.5 w-full rounded-lg border border-slate-200 bg-white pl-7 pr-6 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                  />
                  {variableSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setVariableSearchQuery('')}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              </div>

              {/* Variables Table */}
              {filteredVariables.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 mb-2">
                    <Braces size={20} />
                  </div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {variables.length === 0
                      ? 'No variables created yet'
                      : 'No variables match the selected filter'}
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-sm mt-0.5 mb-3">
                    Variables allow you to parametrize endpoints, tokens, IDs, and payloads. Use them anywhere with{' '}
                    <code className="text-blue-500 font-mono font-semibold">{'{{var}}'}</code>.
                  </p>
                  {variables.length === 0 && (
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setVariables([
                            {
                              id: Math.random().toString(36).substring(2, 9),
                              enabled: true,
                              key: 'baseUrl',
                              value: 'http://localhost:11434',
                              group: 'Ollama',
                              description: 'Local Ollama API server',
                              isSecret: false,
                            },
                            {
                              id: Math.random().toString(36).substring(2, 9),
                              enabled: true,
                              key: 'model',
                              value: 'gemma4:e2b',
                              group: 'Ollama',
                              description: 'Active model name',
                              isSecret: false,
                            },
                          ]);
                          setSelectedGroupFilter('All');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-blue-500 hover:text-blue-500 shadow-xs cursor-pointer"
                      >
                        <Sparkles size={12} className="text-amber-500" />
                        <span>Load Ollama Preset</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setVariables([
                            {
                              id: Math.random().toString(36).substring(2, 9),
                              enabled: true,
                              key: 'baseUrl',
                              value: 'http://localhost:3000',
                              group: 'Dev',
                              description: 'Local development server',
                            },
                            {
                              id: Math.random().toString(36).substring(2, 9),
                              enabled: true,
                              key: 'baseUrl',
                              value: 'https://api.example.com',
                              group: 'Prod',
                              description: 'Production API endpoint',
                            },
                            {
                              id: Math.random().toString(36).substring(2, 9),
                              enabled: true,
                              key: 'token',
                              value: 'sk-my-secret-key-12345',
                              group: 'Auth',
                              description: 'Bearer authorization token',
                              isSecret: true,
                            },
                          ]);
                          setSelectedGroupFilter('All');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-blue-500 hover:text-blue-500 shadow-xs cursor-pointer"
                      >
                        <Layers size={12} className="text-blue-500" />
                        <span>Load Dev/Prod Environments</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const newVar: ApiVariable = {
                            id: Math.random().toString(36).substring(2, 9),
                            enabled: true,
                            key: '',
                            value: '',
                            group: 'General',
                            description: '',
                            isSecret: false,
                          };
                          setVariables([...variables, newVar]);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white shadow-xs cursor-pointer"
                      >
                        <Plus size={12} />
                        <span>Add Empty Variable</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[620px]">
                      <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 border-b border-slate-200 dark:border-slate-800 font-semibold">
                        <tr>
                          <th className="w-8 px-3 py-2 text-center">
                            <div className="flex items-center justify-center">
                              <ModernCheckbox
                                checked={variables.length > 0 && variables.every((v) => v.enabled !== false)}
                                onChange={(checked: boolean) => {
                                  const next = variables.map((v) => ({ ...v, enabled: checked }));
                                  setVariables(next);
                                }}
                              />
                            </div>
                          </th>
                          <th className="px-3 py-2 w-48">Variable Name</th>
                          <th className="px-3 py-2">Value</th>
                          <th className="px-3 py-2 w-32">Group</th>
                          <th className="px-3 py-2 w-40">Description</th>
                          <th className="w-20 px-2 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {filteredVariables.map((v) => {
                          const originalIdx = variables.findIndex((orig) => orig.id === v.id);
                          const isSecret = Boolean(v.isSecret);
                          const isShowingSecret = Boolean(showSecretMap[v.id]);

                          return (
                            <tr key={v.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                              {/* Enable Checkbox */}
                              <td className="px-3 py-1.5 text-center">
                                <div className="flex items-center justify-center">
                                  <ModernCheckbox
                                    checked={v.enabled !== false}
                                    onChange={(checked: boolean) => {
                                      const next = [...variables];
                                      next[originalIdx].enabled = checked;
                                      setVariables(next);
                                    }}
                                  />
                                </div>
                              </td>

                              {/* Key with {{ }} frame */}
                              <td className="px-3 py-1.5">
                                <div className="flex items-center rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 px-2 py-1 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/20">
                                  <span className="font-mono text-slate-400 select-none text-[11px] font-bold mr-0.5">
                                    {'{{'}
                                  </span>
                                  <input
                                    type="text"
                                    value={v.key}
                                    placeholder="var_name"
                                    onChange={(e) => {
                                      const sanitized = e.target.value.replace(/[^a-zA-Z0-9_.-]/g, '');
                                      const next = [...variables];
                                      next[originalIdx].key = sanitized;
                                      setVariables(next);
                                    }}
                                    className="w-full bg-transparent font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none"
                                  />
                                  <span className="font-mono text-slate-400 select-none text-[11px] font-bold ml-0.5">
                                    {'}}'}
                                  </span>
                                </div>
                              </td>

                              {/* Value with Secret Toggle */}
                              <td className="px-3 py-1.5">
                                <div className="relative flex items-center">
                                  <input
                                    type={isSecret && !isShowingSecret ? 'password' : 'text'}
                                    value={v.value}
                                    placeholder="value"
                                    onChange={(e) => {
                                      const next = [...variables];
                                      next[originalIdx].value = e.target.value;
                                      setVariables(next);
                                    }}
                                    className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-1 pr-7 font-mono text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                                  />
                                  {isSecret && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setShowSecretMap((prev) => ({ ...prev, [v.id]: !prev[v.id] }));
                                      }}
                                      className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                      title={isShowingSecret ? 'Hide secret' : 'Reveal secret'}
                                    >
                                      {isShowingSecret ? <EyeOff size={12} /> : <Eye size={12} />}
                                    </button>
                                  )}
                                </div>
                              </td>

                              {/* Group */}
                              <td className="px-3 py-1.5">
                                <input
                                  type="text"
                                  value={v.group}
                                  placeholder="General"
                                  onChange={(e) => {
                                    const next = [...variables];
                                    next[originalIdx].group = e.target.value;
                                    setVariables(next);
                                  }}
                                  className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 py-1 text-xs text-slate-700 dark:text-slate-300 placeholder:text-slate-400 outline-none focus:border-blue-500"
                                />
                              </td>

                              {/* Description */}
                              <td className="px-3 py-1.5">
                                <input
                                  type="text"
                                  value={v.description || ''}
                                  placeholder="Optional note"
                                  onChange={(e) => {
                                    const next = [...variables];
                                    next[originalIdx].description = e.target.value;
                                    setVariables(next);
                                  }}
                                  className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-xs text-slate-500 placeholder:text-slate-400 outline-none hover:border-slate-200 focus:border-slate-300 dark:hover:border-slate-800 dark:focus:border-slate-700"
                                />
                              </td>

                              {/* Actions */}
                              <td className="px-2 py-1.5 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1 justify-end">
                                  {/* Copy {{var}} chip */}
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!v.key) return;
                                      const text = `{{${v.key}}}`;
                                      await navigator.clipboard.writeText(text);
                                      setCopiedVarKey(v.key);
                                      setTimeout(() => setCopiedVarKey(null), 1500);
                                    }}
                                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${copiedVarKey === v.key
                                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                      : 'text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                      }`}
                                    title={`Copy {{${v.key || 'var'}}} to clipboard`}
                                  >
                                    {copiedVarKey === v.key ? <Check size={12} /> : <Copy size={12} />}
                                  </button>

                                  {/* Secret Masking Toggle */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = [...variables];
                                      next[originalIdx].isSecret = !v.isSecret;
                                      setVariables(next);
                                    }}
                                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isSecret
                                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                      }`}
                                    title={isSecret ? 'Marked as Secret (masked)' : 'Mark as Secret'}
                                  >
                                    {isSecret ? <Lock size={12} /> : <Unlock size={12} />}
                                  </button>

                                  {/* Delete Variable */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = variables.filter((_, i) => i !== originalIdx);
                                      setVariables(next);
                                    }}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                                    title="Delete variable"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Quick Preset Buttons Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Sparkles size={12} className="text-amber-500" />
                    <span>Presets:</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      const existingKeys = new Set(variables.map((v) => `${v.group}.${v.key}`));
                      const toAdd: ApiVariable[] = [];
                      if (!existingKeys.has('Ollama.baseUrl')) {
                        toAdd.push({
                          id: Math.random().toString(36).substring(2, 9),
                          enabled: true,
                          key: 'baseUrl',
                          value: 'http://localhost:11434',
                          group: 'Ollama',
                          description: 'Ollama server root',
                        });
                      }
                      if (!existingKeys.has('Ollama.model')) {
                        toAdd.push({
                          id: Math.random().toString(36).substring(2, 9),
                          enabled: true,
                          key: 'model',
                          value: 'gemma4:e2b',
                          group: 'Ollama',
                          description: 'Default LLM model',
                        });
                      }
                      setVariables([...variables, ...toAdd]);
                      setSelectedGroupFilter('Ollama');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:border-blue-500 hover:text-blue-500 shadow-xs cursor-pointer"
                  >
                    <span>+ Ollama (Local)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const toAdd: ApiVariable[] = [
                        {
                          id: Math.random().toString(36).substring(2, 9),
                          enabled: true,
                          key: 'baseUrl',
                          value: 'http://localhost:3000',
                          group: 'Dev',
                          description: 'Development server',
                        },
                        {
                          id: Math.random().toString(36).substring(2, 9),
                          enabled: true,
                          key: 'baseUrl',
                          value: 'https://api.myproduction.com',
                          group: 'Prod',
                          description: 'Production server',
                        },
                      ];
                      setVariables([...variables, ...toAdd]);
                      setSelectedGroupFilter('Dev');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:border-blue-500 hover:text-blue-500 shadow-xs cursor-pointer"
                  >
                    <span>+ Dev & Prod Envs</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const tokenVar: ApiVariable = {
                        id: Math.random().toString(36).substring(2, 9),
                        enabled: true,
                        key: 'token',
                        value: 'sk-my-secret-key-12345',
                        group: 'Auth',
                        description: 'Authorization token',
                        isSecret: true,
                      };
                      setVariables([...variables, tokenVar]);
                      setSelectedGroupFilter('Auth');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:border-blue-500 hover:text-blue-500 shadow-xs cursor-pointer"
                  >
                    <span>+ Auth Token</span>
                  </button>
                </div>

                {variables.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Are you sure you want to clear all variables?')) {
                        setVariables([]);
                        setSelectedGroupFilter('All');
                      }
                    }}
                    className="text-[11px] text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Live Click-to-Copy Chips & Syntax Cheatsheet */}
              {variables.filter((v) => v.enabled !== false && v.key.trim()).length > 0 && (
                <div className="flex flex-col gap-2 p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-500/10">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                      <Copy size={12} />
                      <span>Click any variable chip below to copy:</span>
                    </span>
                    {copiedVarKey && (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                        Copied {`{{${copiedVarKey}}}`}!
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {variables
                      .filter((v) => v.enabled !== false && v.key.trim())
                      .map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={async () => {
                            await navigator.clipboard.writeText(`{{${v.key}}}`);
                            setCopiedVarKey(v.key);
                            setTimeout(() => setCopiedVarKey(null), 1500);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-blue-500/30 bg-white dark:bg-slate-900 text-[11px] font-mono text-blue-600 dark:text-blue-400 hover:border-blue-500 hover:scale-105 transition-all shadow-xs cursor-pointer"
                          title={`Click to copy {{${v.key}}}\nValue: ${v.isSecret ? '●●●●●●' : v.value}\nGroup: ${v.group || 'General'}`}
                        >
                          <span className="font-semibold">{`{{${v.key}}}`}</span>
                          <span className="text-[9px] text-slate-400 max-w-[100px] truncate">
                            {v.isSecret ? '●●●' : `=${v.value}`}
                          </span>
                        </button>
                      ))}
                  </div>

                  <div className="text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-blue-500/15">
                    <strong>Syntax:</strong> Use <code className="font-mono text-blue-600 dark:text-blue-400 font-semibold">{'{{var}}'}</code> anywhere, or prefix with group name like <code className="font-mono text-blue-600 dark:text-blue-400 font-semibold">{'{{dev.baseUrl}}'}</code> to target a specific group regardless of active scope.
                  </div>
                </div>
              )}

              {/* CANVAS NODE VARIABLE CHAINING SECTION */}
              <div className="flex flex-col gap-3 p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5 dark:bg-cyan-950/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                      <Link2 size={15} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <span>Canvas Node Variable Chaining</span>
                        <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-cyan-600 dark:text-cyan-400">
                          {`{{node_id.property}}`}
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                        Pipe real-time responses from upstream API nodes or canvas objects directly into this request.
                      </p>
                    </div>
                  </div>

                  <span className="self-start sm:self-center px-2 py-0.5 rounded-full bg-cyan-500/10 text-[10px] font-semibold text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                    {availableNodeVars.length} Variables Available
                  </span>
                </div>

                {availableNodeVars.length > 0 ? (
                  <div className="flex flex-col gap-3 mt-1">
                    {/* Search bar for node variables */}
                    <div className="relative">
                      <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={nodeChainingSearchQuery}
                        onChange={(e) => setNodeChainingSearchQuery(e.target.value)}
                        placeholder="Search available node outputs (e.g. ip, token, id)..."
                        className="h-8 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-8 pr-3 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-cyan-500"
                      />
                    </div>

                    {/* Grouped by Node */}
                    <div className="flex flex-col gap-2.5 max-h-[340px] overflow-y-auto pr-1">
                      {groupedNodeVars.map((group) => (
                        <div
                          key={group.nodeName}
                          className="flex flex-col gap-1.5 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 shadow-xs"
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${group.nodeType === 'api'
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  : group.nodeType === 'js'
                                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                    : 'bg-violet-500/15 text-violet-600 dark:text-violet-400'
                                }`}>
                                {group.nodeType}
                              </span>
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 font-mono truncate">
                                {group.nodeName}
                              </span>
                            </div>
                            {group.status && (
                              <span className="text-[10px] text-slate-400 shrink-0">
                                {group.status}
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                            {group.vars.map((v) => {
                              const tokenText = `{{${v.token}}}`;
                              const isCopied = copiedChainedToken === v.token;
                              return (
                                <div
                                  key={v.token}
                                  className="flex items-center justify-between gap-1.5 p-1.5 rounded-md border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-[11px] group hover:border-cyan-500/40 transition-colors"
                                >
                                  <div className="flex flex-col min-w-0 flex-1">
                                    <div className="flex items-center gap-1 min-w-0">
                                      <span className="font-mono font-semibold text-cyan-600 dark:text-cyan-400 truncate text-[11px]" title={tokenText}>
                                        {tokenText}
                                      </span>
                                      {v.isRelative && (
                                        <span className="px-1 py-px rounded bg-emerald-500/15 text-[8px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider shrink-0" title={`Relative import (in ${v.scope})`}>
                                          Sibling
                                        </span>
                                      )}
                                    </div>
                                    <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 truncate" title={String(v.value)}>
                                      = {v.preview}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        await navigator.clipboard.writeText(tokenText);
                                        setCopiedChainedToken(v.token);
                                        setTimeout(() => setCopiedChainedToken(null), 1500);
                                      }}
                                      className={`p-1 rounded transition-colors cursor-pointer ${isCopied
                                          ? 'bg-emerald-500/15 text-emerald-600'
                                          : 'text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                      title={`Copy ${tokenText}`}
                                    >
                                      {isCopied ? <Check size={12} /> : <Copy size={12} />}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setUrl((prev) => (prev ? `${prev.replace(/\/+$/, '')}/${tokenText}` : tokenText));
                                      }}
                                      className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 transition-colors cursor-pointer"
                                      title="Append to URL"
                                    >
                                      + URL
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/20">
                    <Link2 size={24} className="text-slate-400 mb-2" />
                    <h5 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      No upstream node responses yet
                    </h5>
                    <p className="text-[11px] text-slate-400 max-w-sm mt-1">
                      Execute any API node on the canvas (such as an IP lookup or Auth login), and its response properties will automatically appear here to chain into this request!
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-[10px] font-mono text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-md">
                      <span>Example:</span>
                      <code>https://ipwhois.app/json/&#123;&#123;ip_node.ip&#125;&#125;</code>
                    </div>
                  </div>
                )}
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
                  <div
                    className="flex items-center h-9 rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-900 overflow-x-auto scrollbar-none max-w-full"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {RESPONSE_TYPES.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setResponseType(type.value)}
                        className={`flex-1 min-w-[62px] px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-all ${responseType === type.value
                          ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-800 dark:text-blue-400 font-semibold'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
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
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-400 inline-flex items-center gap-1">
                        <Infinity size={11} className="shrink-0 text-slate-400" />
                        <span>None</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Leave empty to disable timeout for long LLM streams or slow jobs.
                  </p>
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
                      className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${view === opt.value
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

      {/* Free APIs Modal */}
      <FreeApiModal
        isOpen={showFreeApiModal}
        onClose={() => setShowFreeApiModal(false)}
        onSelect={handleSelectFreeApi}
      />

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

      {/* Insert Image as Base64 Modal for JSON body */}
      <JsonImageBase64Modal
        isOpen={showImageBase64Modal}
        onClose={() => {
          setShowImageBase64Modal(false);
          setDroppedImageFiles([]);
        }}
        currentJson={body.rawJson || ''}
        initialFiles={droppedImageFiles}
        cursorPosition={cursorPosition}
        onInsertAtCursor={handleInsertAtCursor}
        onUpdateFullJson={handleUpdateFullJson}
      />
    </div>
  );

  return (
    <>
      {createPortal(modalContent, document.body)}

      {/* Fullscreen JSON Editor Portal */}
      {isJsonFullscreen && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-label="Fullscreen JSON Editor"
          className="fixed inset-0 z-[10005] flex flex-col w-screen h-[100dvh] bg-white text-slate-900 dark:bg-[#0b1120] dark:text-slate-100 overflow-hidden animate-in fade-in duration-150"
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-4 py-2.5 bg-slate-50/90 dark:bg-slate-900/80 backdrop-blur-md pt-[max(0.625rem,env(safe-area-inset-top))]">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                <FileJson size={16} />
              </div>
              <div className="min-w-0">
                <div className="truncate font-mono text-[12px] font-semibold text-slate-900 dark:text-slate-100" title={jsonFileName}>
                  {jsonFileName}
                </div>
                <div className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {['JSON', formatBytes(jsonSize), `${jsonLineCount} ${jsonLineCount === 1 ? 'line' : 'lines'}`].filter(Boolean).join(' · ')}
                </div>
              </div>
            </div>

            {/* Actions Toolbar */}
            <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setDroppedImageFiles([]);
                  setShowImageBase64Modal(true);
                }}
                className="inline-flex h-8 items-center gap-1.5 px-2 sm:px-2.5 rounded-lg text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 dark:bg-purple-500/15 dark:hover:bg-purple-500/25 transition-colors cursor-pointer mr-0.5"
                title="Upload image and convert to Base64 (Ollama, Vision models)"
                aria-label="Upload image and convert to Base64"
              >
                <ImageIcon size={14} className="shrink-0" />
                <span className="hidden xs:inline">Image (Base64)</span>
              </button>
              <button
                type="button"
                onClick={() => setWordWrap(!wordWrap)}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200 ${wordWrap ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : ''
                  }`}
                title={wordWrap ? 'Word wrap: on' : 'Word wrap: off'}
                aria-label="Toggle word wrap"
              >
                <WrapText size={15} />
              </button>
              <button
                type="button"
                onClick={handlePrettifyJson}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-blue-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                title="Prettify / Format JSON with Prettier"
                aria-label="Prettify JSON with Prettier"
              >
                <PrettierIcon size={15} />
              </button>
              <button
                type="button"
                onClick={handleCopyJson}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                title={copiedJson ? 'Copied' : 'Copy JSON'}
                aria-label="Copy JSON"
              >
                {copiedJson ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
              </button>
              <button
                type="button"
                onClick={handleClearJson}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-rose-500 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-rose-400"
                title="Reset JSON to empty object"
                aria-label="Reset JSON"
              >
                <Trash2 size={15} />
              </button>
              <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-0.5 hidden xs:block" />
              <button
                type="button"
                onClick={() => setIsJsonFullscreen(false)}
                className="inline-flex h-8 items-center gap-1.5 px-2.5 sm:px-3 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-all active:scale-95 cursor-pointer"
                title="Exit full screen (Esc)"
                aria-label="Exit full screen"
              >
                <Minimize2 size={14} />
                <span className="hidden sm:inline">Exit Fullscreen</span>
              </button>
            </div>
          </div>

          {/* Monaco Editor in Fullscreen */}
          <div
            className="relative flex-1 w-full min-h-0 bg-[#0f172a]"
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const imgFiles = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
                if (imgFiles.length > 0) {
                  setDroppedImageFiles(imgFiles);
                  setShowImageBase64Modal(true);
                }
              }
            }}
          >
            <MonacoEditor
              height="100%"
              defaultLanguage="json"
              language="json"
              theme={isDark ? "api-vs-dark" : "api-light"}
              value={body.rawJson || ''}
              onChange={(val) => handleJsonChange(val || '')}
              onMount={(editor, monaco) => {
                editorRef.current = editor;
                try {
                  if (monaco?.languages?.json?.jsonDefaults) {
                    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                      validate: false,
                      allowComments: true,
                      trailingCommas: 'ignore',
                    });
                  }
                  const model = editor.getModel();
                  if (model && monaco?.editor) {
                    monaco.editor.setModelMarkers(model, 'json', []);
                  }
                } catch { }
                if (cursorPosition) {
                  try {
                    editor.setPosition(cursorPosition);
                    editor.revealPositionInCenter(cursorPosition);
                  } catch { }
                }
                editor.onDidChangeCursorPosition((e) => {
                  setCursorPosition(e.position);
                });
              }}
              options={monacoOptions}
              beforeMount={handleMonacoBeforeMount}
              loading={monacoLoadingFallback}
            />
          </div>

          {/* Status bar */}
          <div className="flex shrink-0 items-center justify-between border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/80 px-3 sm:px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-mono text-slate-500 truncate">
                {jsonError ? (
                  <span className="text-red-500 flex items-center gap-1.5"><AlertCircle size={13} className="shrink-0" /> <span className="truncate">{jsonError}</span></span>
                ) : (
                  <span className="text-emerald-500 flex items-center gap-1.5 font-medium">
                    <Check size={13} className="shrink-0" />
                    <span>{/\{\{[a-zA-Z0-9_.-]+\}\}/.test(body.rawJson || '') ? 'Valid JSON (Dynamic Variables Enabled)' : 'Valid JSON'}</span>
                  </span>
                )}
              </span>
            </div>

            <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
              <span>Press</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700">Esc</kbd>
              <span>to exit full screen</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                application/json
              </span>
              <button
                type="button"
                onClick={() => setIsJsonFullscreen(false)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer sm:hidden"
              >
                <Minimize2 size={11} />
                <span>Exit</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
