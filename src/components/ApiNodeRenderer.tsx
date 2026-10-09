import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore';
import { resolveApiResponseView } from '../utils/transformer';
import { buildCurl, detectCandidatePaths, dataURItoBlob, type BodyConfig } from '../utils/curlParser';
import {
  interpolateVariables,
  interpolateJsonString,
  substituteInParamList,
  substituteInAuth,
  substituteInBody,
  type ApiVariable,
} from '../utils/variableInterpolator';
import CustomSelect from './CustomSelect';
import { PrettierIcon } from './InlineApiEditor';
import { FreeApiModal } from './FreeApiModal';
import type { FreeApiPreset } from '../constants/freeApis';
import {
  Activity,
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileCode,
  FileJson,
  Globe,
  Key,
  KeyRound,
  ListTree,
  Loader2,
  Pencil,
  Play,
  RefreshCw,
  Sparkles,
  Square,
  Timer,
  TimerOff,
  Trash2,
  X,
  Zap,
  Box,
  Infinity,
  ArrowRight,
  Maximize2,
  WrapText,
} from 'lucide-react';

interface ApiNodeRendererProps {
  url: string;
  path: string;
  nodeId: string;
  nodeX: number;
  nodeY: number;
  nodeWidth: number;
}

type StatusMeta = {
  label: string;
  title: string;
  dotClass: string;
  textClass: string;
};

const methodClassMap: Record<string, string> = {
  GET: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  POST: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  PUT: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  PATCH: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  DELETE: 'bg-red-500/10 text-red-600 dark:text-red-400',
  HEAD: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  OPTIONS: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
};

const HTTP_METHOD_OPTIONS = [
  {
    value: 'GET',
    label: 'GET',
    icon: <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />,
  },
  {
    value: 'POST',
    label: 'POST',
    icon: <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />,
  },
  {
    value: 'PUT',
    label: 'PUT',
    icon: <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />,
  },
  {
    value: 'PATCH',
    label: 'PATCH',
    icon: <span className="inline-block h-2 w-2 rounded-full bg-violet-500" />,
  },
  {
    value: 'DELETE',
    label: 'DELETE',
    icon: <span className="inline-block h-2 w-2 rounded-full bg-red-500" />,
  },
  {
    value: 'HEAD',
    label: 'HEAD',
    icon: <span className="inline-block h-2 w-2 rounded-full bg-cyan-500" />,
  },
  {
    value: 'OPTIONS',
    label: 'OPTIONS',
    icon: <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />,
  },
];

const getMethodClass = (method: string) =>
  methodClassMap[method] || 'bg-slate-500/10 text-slate-600 dark:text-slate-300';

const formatResponseType = (responseType: string) =>
  responseType === 'auto' ? 'Auto' : responseType.toUpperCase();

const formatTimeout = (timeout?: number) => {
  if (timeout === undefined || timeout === null || !Number.isFinite(timeout) || timeout <= 0) {
    return 'No timeout';
  }
  if (timeout < 1000) return `${timeout}ms`;

  const seconds = timeout / 1000;
  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)}s`;
};

const getEndpointHost = (value: string, variables?: ApiVariable[], activeGroup?: string) => {
  const interpolated = interpolateVariables(value, variables, activeGroup).trim();
  if (!interpolated) return 'No endpoint yet';

  try {
    return new URL(interpolated).host || 'Endpoint';
  } catch {
    return interpolated.split('/')[0] || 'Custom endpoint';
  }
};

const formatSize = (bytes?: number) => {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getStatusBadgeClass = (status?: number) => {
  if (!status) return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
  if (status >= 200 && status < 300) return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
  if (status >= 300 && status < 400) return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30';
  if (status >= 400 && status < 500) return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
  return 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30';
};

export const isLocalOrLoopbackUrl = (urlStr: string): boolean => {
  try {
    const u = new URL(urlStr, window.location.origin);
    const host = u.hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      (host.startsWith('172.') && parseInt(host.split('.')[1], 10) >= 16 && parseInt(host.split('.')[1], 10) <= 31)
    );
  } catch {
    return urlStr.includes('localhost') || urlStr.includes('127.0.0.1');
  }
};

export function ApiNodeRenderer({ url, path, nodeId, nodeX, nodeY, nodeWidth }: ApiNodeRendererProps) {
  const updateNodeValue = useStore((state) => state.updateNodeValue);
  const apiNodeResponses = useStore((state) => state.apiNodeResponses);
  const apiNodeMeta = useStore((state) => state.apiNodeMeta);
  const setApiNodeMeta = useStore((state) => state.setApiNodeMeta);
  const apiNodeLoading = useStore((state) => state.apiNodeLoading);
  const apiNodeErrors = useStore((state) => state.apiNodeErrors);
  const setApiNodeResponse = useStore((state) => state.setApiNodeResponse);
  const setApiNodeLoading = useStore((state) => state.setApiNodeLoading);
  const setApiNodeError = useStore((state) => state.setApiNodeError);
  const removeApiNode = useStore((state) => state.removeApiNode);
  const inlineApiEditor = useStore((state) => state.inlineApiEditor);
  const setInlineApiEditor = useStore((state) => state.setInlineApiEditor);
  const apiNodeConfig = useStore((state) => state.apiNodeConfig);
  const setApiNodeConfig = useStore((state) => state.setApiNodeConfig);
  const proxyServers = useStore((state) => state.proxyServers);
  const useDefaultProxy = useStore((state) => state.useDefaultProxy);

  const [useProxy, setUseProxy] = useState(false);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [showFreeApiModal, setShowFreeApiModal] = useState(false);
  const [copiedHint, setCopiedHint] = useState<string | null>(null);
  const [showAdvancedDiagnostics, setShowAdvancedDiagnostics] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isUserAbortedRef = useRef<boolean>(false);

  // Manual abort handler for signal aborting
  const handleAbort = useCallback(() => {
    if (abortControllerRef.current) {
      isUserAbortedRef.current = true;
      try {
        abortControllerRef.current.abort();
      } catch (err) {
        console.warn('Failed to abort request:', err);
      }
    }
  }, []);

  // Cancel any active request on component unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        isUserAbortedRef.current = true;
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Listen for specific abort trigger from InlineApiEditor or canvas actions
  useEffect(() => {
    const handleSpecificAbort = (e: Event) => {
      const detail = (e as CustomEvent<{ path: string }>).detail;
      if (detail && detail.path === path) {
        handleAbort();
      }
    };
    window.addEventListener('abort-api-node', handleSpecificAbort);
    return () => window.removeEventListener('abort-api-node', handleSpecificAbort);
  }, [handleAbort, path]);

  // Use the reactive global URL if we're currently editing this node.
  const isEditing = inlineApiEditor?.path === path;
  const currentUrl = isEditing ? inlineApiEditor.url : url;
  const normalizedUrl = currentUrl.trim();

  const [localUrl, setLocalUrl] = useState(currentUrl);
  const [isUrlFocused, setIsUrlFocused] = useState(false);

  useEffect(() => {
    if (!isUrlFocused) {
      setLocalUrl(currentUrl);
    }
  }, [currentUrl, isUrlFocused]);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setLocalUrl(newVal);
    if (isEditing && inlineApiEditor) {
      setInlineApiEditor({ ...inlineApiEditor, url: newVal });
    }
  };

  const handleCommitUrl = async () => {
    setIsUrlFocused(false);
    const trimmed = localUrl.trim();
    if (trimmed !== url) {
      await updateNodeValue(path, trimmed);
    }
    if (inlineApiEditor && inlineApiEditor.path === path) {
      setInlineApiEditor({ ...inlineApiEditor, url: trimmed });
    }
  };

  const handleUrlKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setLocalUrl(currentUrl);
      e.currentTarget.blur();
    }
  };

  const config = apiNodeConfig[path] || { method: 'GET', responseType: 'auto', timeout: 5000 };

  // Inline Body editing state
  const [showInlineBody, setShowInlineBody] = useState(false);
  const [localBodyText, setLocalBodyText] = useState(config.body?.rawJson ?? '');
  const [isBodyFocused, setIsBodyFocused] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [isBodyWordWrap, setIsBodyWordWrap] = useState(false);
  const [lineHeights, setLineHeights] = useState<number[]>([]);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const bodyLineNumbersRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isBodyWordWrap) {
      setLineHeights([]);
      return;
    }
    const updateHeights = () => {
      if (!mirrorRef.current || !bodyTextareaRef.current) return;
      const textarea = bodyTextareaRef.current;
      const width = Math.max(50, textarea.clientWidth - 16);
      mirrorRef.current.style.width = `${width}px`;

      const children = Array.from(mirrorRef.current.children) as HTMLElement[];
      const heights = children.map((c) => Math.max(18, c.offsetHeight));
      setLineHeights(heights);
    };

    updateHeights();
    const textarea = bodyTextareaRef.current;
    if (!textarea) return;
    const observer = new ResizeObserver(() => {
      updateHeights();
    });
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [isBodyWordWrap, localBodyText]);

  useEffect(() => {
    if (!isBodyFocused) {
      setLocalBodyText(config.body?.rawJson ?? '');
    }
  }, [config.body?.rawJson, isBodyFocused]);

  const commitBodyChange = useCallback((newText: string) => {
    const updatedBody: BodyConfig = {
      ...(config.body || { type: 'json' as const }),
      type: 'json' as const,
      rawJson: newText,
    };
    setApiNodeConfig(path, {
      ...config,
      body: updatedBody,
    });
  }, [config, path, setApiNodeConfig]);

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalBodyText(val);
    commitBodyChange(val);
  };

  const handleBodyScroll = () => {
    if (bodyTextareaRef.current && bodyLineNumbersRef.current) {
      bodyLineNumbersRef.current.scrollTop = bodyTextareaRef.current.scrollTop;
    }
  };

  const handleBodyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;
      if (e.shiftKey) {
        if (val.substring(start - 2, start) === '  ') {
          const next = val.substring(0, start - 2) + val.substring(start);
          setLocalBodyText(next);
          commitBodyChange(next);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = Math.max(0, start - 2);
          }, 0);
        }
      } else {
        const next = val.substring(0, start) + '  ' + val.substring(end);
        setLocalBodyText(next);
        commitBodyChange(next);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }, 0);
      }
    }
  };

  const handlePrettifyInlineBody = () => {
    if (!localBodyText.trim()) return;
    try {
      const tokens: string[] = [];
      const masked = localBodyText.replace(/\{\{[a-zA-Z0-9_.-]+\}\}/g, (match) => {
        const idx = tokens.length;
        tokens.push(match);
        return `"__VAR_PLACEHOLDER_${idx}__"`;
      });
      const parsed = JSON.parse(masked);
      let formatted = JSON.stringify(parsed, null, 2);
      tokens.forEach((token, idx) => {
        formatted = formatted.replace(`"__VAR_PLACEHOLDER_${idx}__"`, token);
      });
      setLocalBodyText(formatted);
      commitBodyChange(formatted);
    } catch { }
  };

  const insertVariableAtCursor = (token: string) => {
    if (!bodyTextareaRef.current) return;
    const textarea = bodyTextareaRef.current;
    const start = textarea.selectionStart ?? localBodyText.length;
    const end = textarea.selectionEnd ?? localBodyText.length;
    const next = localBodyText.substring(0, start) + token + localBodyText.substring(end);
    setLocalBodyText(next);
    commitBodyChange(next);
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + token.length;
    }, 0);
  };

  const bodyValidation = useMemo(() => {
    const text = localBodyText.trim();
    if (!text) return { isValid: true, hasVariables: false, error: null };
    const hasVars = /\{\{[a-zA-Z0-9_.-]+\}\}/.test(text);
    try {
      const substituted = interpolateJsonString(text, config.variables, config.activeVariableGroup);
      JSON.parse(substituted);
      return { isValid: true, hasVariables: hasVars, error: null };
    } catch (err: any) {
      return { isValid: false, hasVariables: hasVars, error: err.message };
    }
  }, [localBodyText, config.variables, config.activeVariableGroup]);

  const isLoading = apiNodeLoading[path];
  const error = apiNodeErrors[path];
  const meta = apiNodeMeta[path];
  const hasData = apiNodeResponses[path] !== undefined;
  const canFetch = normalizedUrl.length > 0;
  const errorRequestUrl = error?.requestInfo.url;

  const detectedCandidates = useMemo(() => {
    if (!hasData || config.extractPath) return [];
    return detectCandidatePaths(apiNodeResponses[path]);
  }, [hasData, config.extractPath, apiNodeResponses, path]);

  const topCandidate = detectedCandidates.length > 0 ? detectedCandidates[0] : null;

  const isLocalEndpoint = isLocalOrLoopbackUrl(currentUrl);
  const isHttpsOnLocal = isLocalEndpoint && currentUrl.toLowerCase().startsWith('https://');
  const hasOllamaPortTypo = isLocalEndpoint && currentUrl.includes(':11343');
  const suggestedFixedUrl = currentUrl
    .replace(/^https:\/\//i, 'http://')
    .replace(':11343', ':11434');

  useEffect(() => {
    if (!errorRequestUrl || errorRequestUrl === currentUrl) return;

    setApiNodeError(path, null);
    setShowErrorPopup(false);
    setShowAdvancedDiagnostics(false);
  }, [currentUrl, errorRequestUrl, path, setApiNodeError]);

  const handleFetch = useCallback(async (forceProxy = false) => {
    // If a request is already running for this node, cancel it first
    if (abortControllerRef.current) {
      try {
        isUserAbortedRef.current = true;
        abortControllerRef.current.abort();
      } catch { }
    }

    isUserAbortedRef.current = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setApiNodeLoading(path, true);
    setApiNodeError(path, null);

    // Ensure the response node is positioned directly to the right of the API node
    const store = useStore.getState();
    const parentPos = store.dragOverrides[path] || (nodeX !== undefined && nodeY !== undefined ? { x: nodeX, y: nodeY } : null);
    const responsePath = `${path}.__response`;
    if (parentPos) {
      const currentResp = store.dragOverrides[responsePath];
      if (!currentResp || currentResp.x <= parentPos.x || Math.abs(currentResp.y - parentPos.y) > 500 || Math.abs(currentResp.x - (parentPos.x + 460)) > 600) {
        store.setMultipleDragOverrides({
          [responsePath]: { x: parentPos.x + 460, y: parentPos.y },
        });
      }
    }

    const startTime = performance.now();
    const activeVariables = config.variables;
    const activeGroup = config.activeVariableGroup;
    const targetBaseUrl = (localUrl.trim() || currentUrl).trim();
    if (localUrl.trim() && localUrl.trim() !== url) {
      updateNodeValue(path, localUrl.trim());
    }
    let resolvedUrl = interpolateVariables(targetBaseUrl, activeVariables, activeGroup);
    let isLocalTarget = isLocalOrLoopbackUrl(resolvedUrl);
    let timeoutId: any = null;
    let shouldProxy = false;

    try {
      // 1. Build Target URL (include query params and auth query param if configured)
      try {
        const parsed = new URL(resolvedUrl, window.location.origin);
        if (config.params && Array.isArray(config.params)) {
          for (const p of config.params) {
            if (p.enabled !== false && p.key.trim()) {
              const pKey = interpolateVariables(p.key.trim(), activeVariables, activeGroup);
              const pVal = interpolateVariables(p.value, activeVariables, activeGroup);
              if (!parsed.searchParams.has(pKey)) {
                parsed.searchParams.append(pKey, pVal);
              }
            }
          }
        }
        if (config.auth?.type === 'apiKey' && config.auth.apiKeyName && config.auth.apiKeyLocation === 'query') {
          const authKeyName = interpolateVariables(config.auth.apiKeyName, activeVariables, activeGroup);
          const authKeyVal = interpolateVariables(config.auth.apiKeyValue || '', activeVariables, activeGroup);
          parsed.searchParams.set(authKeyName, authKeyVal);
        }
        resolvedUrl = parsed.toString();
      } catch {
        // keep resolvedUrl as is
      }

      isLocalTarget = isLocalOrLoopbackUrl(resolvedUrl);

      // Check if user has an enabled custom proxy in settings
      const customProxy = proxyServers?.find((p) => p.isEnabled && p.url.trim());
      const proxyBase = customProxy?.url?.trim() || (useDefaultProxy !== false ? 'https://go.data-visualizer.workers.dev/?url=' : '');

      // A remote cloud proxy cannot reach local machine loopback addresses!
      // But a user's custom local/LAN proxy CAN.
      shouldProxy = Boolean(forceProxy && (customProxy ? true : !isLocalTarget) && proxyBase);

      const targetUrl = shouldProxy
        ? `${proxyBase}${encodeURIComponent(resolvedUrl)}`
        : resolvedUrl;

      // 2. Assemble Request Headers
      const reqHeaders: Record<string, string> = {};
      if (config.responseType === 'json') {
        reqHeaders['Accept'] = 'application/json';
      }

      if (config.headers && Array.isArray(config.headers)) {
        for (const h of config.headers) {
          if (h.enabled !== false && h.key.trim()) {
            const hKey = interpolateVariables(h.key.trim(), activeVariables, activeGroup);
            const hVal = interpolateVariables(h.value, activeVariables, activeGroup);
            reqHeaders[hKey] = hVal;
          }
        }
      }

      if (config.auth) {
        if (config.auth.type === 'bearer' && config.auth.bearerToken) {
          const token = interpolateVariables(config.auth.bearerToken, activeVariables, activeGroup);
          reqHeaders['Authorization'] = `Bearer ${token}`;
        } else if (config.auth.type === 'basic' && (config.auth.basicUsername || config.auth.basicPassword)) {
          try {
            const u = interpolateVariables(config.auth.basicUsername || '', activeVariables, activeGroup);
            const p = interpolateVariables(config.auth.basicPassword || '', activeVariables, activeGroup);
            const creds = btoa(`${u}:${p}`);
            reqHeaders['Authorization'] = `Basic ${creds}`;
          } catch { }
        } else if (config.auth.type === 'apiKey' && config.auth.apiKeyName && config.auth.apiKeyLocation !== 'query') {
          const aKeyName = interpolateVariables(config.auth.apiKeyName, activeVariables, activeGroup);
          const aKeyVal = interpolateVariables(config.auth.apiKeyValue || '', activeVariables, activeGroup);
          reqHeaders[aKeyName] = aKeyVal;
        }
      }

      // 3. Assemble Request Body
      let reqBody: any = undefined;
      const methodUpper = (config.method || 'GET').toUpperCase();
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(methodUpper) && config.body) {
        if (config.body.type === 'json') {
          if (!reqHeaders['Content-Type'] && !reqHeaders['content-type']) {
            reqHeaders['Content-Type'] = 'application/json';
          }
          const rawSource = (showInlineBody && localBodyText !== undefined) ? localBodyText : (config.body.rawJson || '');
          let jsonContent = interpolateJsonString(rawSource, activeVariables, activeGroup);
          if (typeof config.streamEnabled === 'boolean') {
            try {
              const parsed = JSON.parse(jsonContent);
              if (parsed && typeof parsed === 'object') {
                parsed.stream = config.streamEnabled;
                jsonContent = JSON.stringify(parsed, null, 2);
              }
            } catch { }
          }
          reqBody = jsonContent;
        } else if (config.body.type === 'x-www-form-urlencoded' && config.body.urlEncoded) {
          if (!reqHeaders['Content-Type'] && !reqHeaders['content-type']) {
            reqHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
          }
          const usp = new URLSearchParams();
          for (const item of config.body.urlEncoded) {
            if (item.enabled !== false && item.key.trim()) {
              const k = interpolateVariables(item.key.trim(), activeVariables, activeGroup);
              const v = interpolateVariables(item.value, activeVariables, activeGroup);
              usp.append(k, v);
            }
          }
          reqBody = usp.toString();
        } else if (config.body.type === 'formData' && config.body.formData) {
          const fd = new FormData();
          for (const item of config.body.formData) {
            if (item.enabled !== false && item.key.trim()) {
              const k = interpolateVariables(item.key.trim(), activeVariables, activeGroup);
              if (item.type === 'file' && item.fileData) {
                try {
                  const blob = dataURItoBlob(item.fileData);
                  fd.append(k, blob, item.fileName || 'file');
                } catch {
                  fd.append(k, interpolateVariables(item.value, activeVariables, activeGroup));
                }
              } else {
                fd.append(k, interpolateVariables(item.value, activeVariables, activeGroup));
              }
            }
          }
          reqBody = fd;
          delete reqHeaders['Content-Type'];
          delete reqHeaders['content-type'];
        } else if (config.body.type === 'raw' && config.body.rawText) {
          if (!reqHeaders['Content-Type'] && !reqHeaders['content-type']) {
            reqHeaders['Content-Type'] = 'text/plain';
          }
          reqBody = interpolateVariables(config.body.rawText, activeVariables, activeGroup);
        }
      }

      // Only schedule timeout if explicitly configured and greater than 0
      // If empty or <= 0, do NOT apply any timeout (allows indefinite streaming or long tasks)
      if (typeof config.timeout === 'number' && config.timeout > 0) {
        timeoutId = setTimeout(() => {
          isUserAbortedRef.current = false;
          controller.abort();
        }, config.timeout);
      }

      const res = await fetch(targetUrl, {
        method: config.method,
        headers: Object.keys(reqHeaders).length > 0 ? reqHeaders : undefined,
        body: reqBody,
        signal: controller.signal
      });

      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      const duration = Math.round(performance.now() - startTime);
      const responseHeadersRecord: Record<string, string> = {};
      res.headers.forEach((val, key) => {
        responseHeadersRecord[key] = val;
      });

      if (!res.ok) {
        let errorBody = '';
        try {
          errorBody = await res.text();
        } catch (e) { }

        setApiNodeMeta(path, {
          status: res.status,
          statusText: res.statusText || 'Error',
          duration,
          size: errorBody.length,
          headers: responseHeadersRecord,
        });

        let type = 'Server Error';
        let userMessage = 'The server encountered an unexpected condition.';
        if (res.status === 401) {
          type = 'Authentication Error';
          userMessage = 'Authentication credentials required.';
        } else if (res.status === 403) {
          type = 'Permission Error';
          userMessage = 'Access denied by server.';
        } else if (res.status === 404) {
          type = 'Not Found';
          userMessage = 'Requested endpoint does not exist.';
        } else if (res.status === 405) {
          type = 'Method Not Allowed';
          const allowHdr = res.headers.get('allow') || 'POST';
          userMessage = `The server rejected ${config.method} with 405 Method Not Allowed.\nThis endpoint requires ${allowHdr}.\n\nClick "Switch to ${allowHdr} & Retry" to update the method automatically.`;
        } else if (res.status >= 500) {
          type = 'Server Error';
          userMessage = 'The server encountered an unexpected condition.';
        } else {
          type = 'HTTP Error';
          userMessage = `Server returned ${res.status} ${res.statusText}.`;
        }

        throw {
          isDiagnostic: true,
          type,
          code: `${res.status}`,
          message: res.statusText || 'HTTP Error',
          userMessage: `${res.status} ${type}\n${userMessage}`,
          details: errorBody ? `Response body:\n${errorBody}` : undefined,
        };
      }

      let data;
      let dataSize = 0;
      const cl = res.headers.get('content-length');
      if (cl) {
        dataSize = parseInt(cl, 10) || 0;
      }

      const contentType = res.headers.get('content-type') || '';
      const isPdf = contentType.includes('application/pdf') || (config.responseType === 'auto' && currentUrl.match(/\.pdf(\?.*)?$/i));
      const isImage = contentType.includes('image/');
      const isAudio = contentType.includes('audio/');
      const isVideo = contentType.includes('video/');
      const isModel = contentType.includes('model/') || (config.responseType === 'auto' && currentUrl.match(/\.(glb|gltf|obj)(\?.*)?$/i));
      const hasMedia = isPdf || isImage || isAudio || isVideo || isModel;

      if (config.responseType === 'blob' || (config.responseType === 'auto' && hasMedia)) {
        const blob = await res.blob();
        dataSize = blob.size;
        if (isPdf) {
          const objectUrl = URL.createObjectURL(blob) + '#pdf';
          data = { _pdfUrl: objectUrl, type: contentType, size: blob.size };
        } else if (isImage) {
          const objectUrl = URL.createObjectURL(blob) + '#image';
          data = { _imageUrl: objectUrl, type: contentType, size: blob.size };
        } else if (isAudio) {
          const objectUrl = URL.createObjectURL(blob) + '#audio';
          data = { _audioUrl: objectUrl, type: contentType, size: blob.size };
        } else if (isVideo) {
          const objectUrl = URL.createObjectURL(blob) + '#video';
          data = { _videoUrl: objectUrl, type: contentType, size: blob.size };
        } else if (isModel) {
          const objectUrl = URL.createObjectURL(blob) + '#model';
          data = { _modelUrl: objectUrl, type: contentType || 'model/gltf', size: blob.size };
        } else {
          data = { _blobSize: blob.size, type: contentType };
        }
      } else if (config.streamEnabled === true && res.body) {
        // Active stream consumer for real-time streaming chunks
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let streamAccumulated = '';
        const chunks: any[] = [];
        let combinedMessage = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunkStr = decoder.decode(value, { stream: true });
            streamAccumulated += chunkStr;

            const lines = streamAccumulated.split('\n');
            for (let i = 0; i < lines.length - 1; i++) {
              const rawLine = lines[i].trim();
              if (!rawLine) continue;
              const lineContent = rawLine.startsWith('data:') ? rawLine.slice(5).trim() : rawLine;
              if (lineContent === '[DONE]') continue;
              try {
                const parsed = JSON.parse(lineContent);
                chunks.push(parsed);
                const chunkText = parsed?.message?.content ?? parsed?.response ?? parsed?.choices?.[0]?.delta?.content ?? parsed?.choices?.[0]?.text ?? '';
                if (chunkText) combinedMessage += chunkText;
              } catch { }
            }
            streamAccumulated = lines[lines.length - 1];

            if (combinedMessage || chunks.length > 0) {
              setApiNodeResponse(path, {
                _combinedMessage: combinedMessage || undefined,
                _chunksCount: chunks.length,
                chunks,
                _isStreaming: true,
              });
            }
          }
        } catch (streamErr: any) {
          // If aborted by user during streaming, preserve all received chunks and messages
          if (isUserAbortedRef.current && (combinedMessage || chunks.length > 0)) {
            setApiNodeResponse(path, {
              _combinedMessage: combinedMessage || undefined,
              _chunksCount: chunks.length,
              chunks,
              _isStreaming: false,
              _abortedEarly: true,
            });
            setApiNodeMeta(path, {
              status: 200,
              statusText: 'CANCELLED (PARTIAL)',
              duration: Math.round(performance.now() - startTime),
              size: new Blob([combinedMessage || streamAccumulated]).size,
              headers: responseHeadersRecord,
            });
            return;
          }
          throw streamErr;
        }

        if (streamAccumulated.trim()) {
          const rawLine = streamAccumulated.trim();
          const lineContent = rawLine.startsWith('data:') ? rawLine.slice(5).trim() : rawLine;
          if (lineContent !== '[DONE]') {
            try {
              const parsed = JSON.parse(lineContent);
              chunks.push(parsed);
              const chunkText = parsed?.message?.content ?? parsed?.response ?? parsed?.choices?.[0]?.delta?.content ?? parsed?.choices?.[0]?.text ?? '';
              if (chunkText) combinedMessage += chunkText;
            } catch { }
          }
        }

        dataSize = new Blob([combinedMessage || streamAccumulated]).size;
        data = combinedMessage ? {
          _combinedMessage: combinedMessage,
          _chunksCount: chunks.length,
          chunks,
        } : (chunks.length > 0 ? {
          _chunksCount: chunks.length,
          chunks,
        } : {
          _rawText: streamAccumulated,
        });
      } else if (config.responseType === 'json' || (config.responseType === 'auto' && contentType.includes('application/json'))) {
        const text = await res.text();
        if (!dataSize) dataSize = new Blob([text]).size;
        try {
          data = JSON.parse(text);
        } catch (e: any) {
          // Check for newline-delimited JSON (NDJSON, e.g. streaming Ollama responses or SSE)
          const lines = text.trim().split('\n').filter((l) => l.trim().length > 0);
          if (lines.length > 1) {
            try {
              const parsedChunks = lines.map((line) => {
                const cleaned = line.trim().startsWith('data:') ? line.trim().slice(5).trim() : line.trim();
                return JSON.parse(cleaned);
              });
              const combinedText = parsedChunks
                .map((c) => c?.message?.content ?? c?.response ?? c?.choices?.[0]?.delta?.content ?? c?.choices?.[0]?.text ?? '')
                .join('');
              data = {
                _combinedMessage: combinedText || undefined,
                _chunksCount: parsedChunks.length,
                chunks: parsedChunks,
              };
            } catch {
              if (config.responseType === 'json') {
                throw {
                  isDiagnostic: true,
                  type: 'JSON Parse Error',
                  code: 'PARSE_ERR',
                  message: e.message,
                  userMessage: 'Response was received but could not be parsed as valid JSON.',
                  details: text.slice(0, 500) + (text.length > 500 ? '...' : '')
                };
              } else {
                data = { _rawText: text };
              }
            }
          } else if (config.responseType === 'json') {
            throw {
              isDiagnostic: true,
              type: 'JSON Parse Error',
              code: 'PARSE_ERR',
              message: e.message,
              userMessage: 'Response was received but could not be parsed as valid JSON.',
              details: text.slice(0, 500) + (text.length > 500 ? '...' : '')
            };
          } else {
            data = { _rawText: text };
          }
        }
      } else {
        const text = await res.text();
        if (!dataSize) dataSize = new Blob([text]).size;
        if (config.responseType === 'auto') {
          try {
            data = JSON.parse(text);
          } catch {
            data = { _rawText: text };
          }
        } else {
          data = { _rawText: text };
        }
      }

      setApiNodeMeta(path, {
        status: res.status,
        statusText: res.statusText || 'OK',
        duration,
        size: dataSize,
        headers: responseHeadersRecord,
      });

      setApiNodeResponse(path, data);
      if (shouldProxy) setUseProxy(true);
      else setUseProxy(false);
    } catch (e: any) {
      const duration = Math.round(performance.now() - startTime);
      const baseRequestInfo = {
        url: currentUrl,
        method: config.method,
        proxyUsed: shouldProxy
      };

      if (e.isDiagnostic) {
        setApiNodeError(path, {
          ...e,
          timestamp: new Date().toISOString(),
          requestInfo: baseRequestInfo
        });
        return;
      }

      if (e.name === 'AbortError') {
        if (isUserAbortedRef.current) {
          setApiNodeMeta(path, {
            status: 499,
            statusText: 'CANCELLED',
            duration,
          });
          setApiNodeError(path, {
            type: 'Request Cancelled',
            code: 'CANCELLED',
            message: 'Request was cancelled by user.',
            userMessage: 'The API request was stopped before completing.',
            timestamp: new Date().toISOString(),
            requestInfo: baseRequestInfo
          });
        } else {
          setApiNodeMeta(path, {
            status: 408,
            statusText: 'TIMEOUT',
            duration,
          });
          setApiNodeError(path, {
            type: 'Timeout',
            code: 'TIMEOUT',
            message: 'Request exceeded timeout limit.',
            userMessage: `Request exceeded timeout limit${config.timeout ? ` (${formatTimeout(config.timeout)})` : ''}.`,
            timestamp: new Date().toISOString(),
            requestInfo: baseRequestInfo
          });
        }
        return;
      } else if (!forceProxy && !isLocalTarget && (e.message?.includes('Failed to fetch') || e.message?.includes('NetworkError'))) {
        // Likely CORS error on public endpoint, retry with proxy.
        handleFetch(true);
        return;
      } else {
        setApiNodeMeta(path, {
          status: 0,
          statusText: 'ERR',
          duration,
        });

        let type = 'Network Error';
        let code = 'FETCH_ERR';
        let userMessage = 'Unable to connect to the endpoint.\n\nPossible causes:\n- Server unavailable\n- Network issue\n- CORS restriction';

        const isHttpsOrigin = typeof window !== 'undefined' && window.location.protocol === 'https:';
        const isMobileDevice = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        const isHttpLocal = resolvedUrl.toLowerCase().startsWith('http://');

        if (isLocalTarget) {
          const isHttpsLocal = resolvedUrl.toLowerCase().startsWith('https://');
          const hasPortTypo = resolvedUrl.includes(':11343');

          if (isMobileDevice) {
            type = 'Device Mismatch (Mobile -> Localhost)';
            code = 'MOBILE_LOCALHOST_ERR';
            userMessage = `You are accessing this app from a mobile device, but the request URL is set to "localhost" (${resolvedUrl}).\n\n` +
              `Why this fails:\n"localhost" refers to this mobile device itself, where Ollama is not running.\n\n` +
              `How to connect from mobile:\n` +
              `1. Free HTTPS Tunnel (Recommended for mobile):\n` +
              `   Run on your computer where Ollama is running:\n` +
              `   cloudflared tunnel --url http://localhost:11434 --http-host-header="localhost:11434"\n` +
              `   (or: npx localtunnel --port 11434)\n` +
              `   Copy the generated https://... URL into this node.\n\n` +
              `2. Same Wi-Fi Network:\n` +
              `   Replace "localhost" with your computer's Wi-Fi IP address (e.g. http://192.168.1.X:11434) and start Ollama with OLLAMA_HOST=0.0.0.0.`;
          } else if (isHttpsOrigin && isHttpLocal) {
            type = 'HTTPS to Localhost Blocked by Browser';
            code = 'HTTPS_MIXED_CONTENT_ERR';
            userMessage = `🔒 Local Data Privacy Guarantee:\n` +
              `Your data stays 100% on your computer! The visualizer never sends your local requests to the cloud.\n\n` +
              `Why this error happened:\n` +
              `The web app is running on secure HTTPS (${window.location.origin}), but requested local HTTP (${resolvedUrl}). Web browsers (Chrome, Edge, Safari) automatically block HTTPS pages from connecting to local HTTP servers by default (Mixed Content & Private Network security).\n\n` +
              `How to allow localhost in your browser (100% Local, zero data leaves your PC):\n\n` +
              `Step 1: Allow Insecure Content in Browser\n` +
              `• Click the padlock / settings icon (🔒 or 🎛️) on the left of your browser address bar.\n` +
              `• Click "Site settings".\n` +
              `• Find "Insecure content" and change it from "Block" to "Allow".\n` +
              `• Reload the visualizer page.\n\n` +
              `Step 2: Allow CORS on Ollama (so Ollama accepts browser requests)\n` +
              `• Windows PowerShell: $env:OLLAMA_ORIGINS="*"; ollama serve\n` +
              `• Mac / Linux: OLLAMA_ORIGINS="*" ollama serve\n\n` +
              `Alternative: Run the Visualizer Locally\n` +
              `Run the app locally (e.g. http://localhost:3000) where HTTP-to-HTTP has zero browser restrictions.`;
          } else {
            type = 'Local Server Connection Error';
            code = 'LOCAL_ERR';
            userMessage = `Unable to connect to local server at ${resolvedUrl}.\n\n`;

            if (isHttpsLocal) {
              userMessage += `Protocol Issue: You are requesting "https://" on localhost. Local servers (like Ollama) run on plain HTTP, not HTTPS.\n\n`;
            }
            if (hasPortTypo) {
              userMessage += `Port Typo: Port 11343 was requested. The default port for Ollama is 11434.\n\n`;
            }
            userMessage += `Troubleshooting Checklist:\n1. Ensure Ollama is running (check terminal or system tray)\n2. Change URL to: http://localhost:11434/api/chat\n3. If CORS is blocked, set OLLAMA_ORIGINS=* before starting Ollama`;
          }
        } else if (shouldProxy) {
          type = 'Proxy Error';
          userMessage = 'Proxy fetch failed.\nWorker endpoint returned an error.';
        }

        setApiNodeError(path, {
          type,
          code,
          message: e.message || 'Fetch failed',
          userMessage,
          timestamp: new Date().toISOString(),
          requestInfo: baseRequestInfo,
          details: e.stack
        });
      }
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      abortControllerRef.current = null;
      setApiNodeLoading(path, false);
    }
  }, [path, currentUrl, config, setApiNodeLoading, setApiNodeError, setApiNodeResponse, setApiNodeMeta]);

  useEffect(() => {
    const handleGlobalRefetch = () => {
      handleFetch(useProxy);
    };
    window.addEventListener('refetch-all-api-nodes', handleGlobalRefetch);
    return () => window.removeEventListener('refetch-all-api-nodes', handleGlobalRefetch);
  }, [handleFetch, useProxy]);

  // Listen for specific trigger from InlineApiEditor "Send" button
  useEffect(() => {
    const handleSpecificFetch = (e: Event) => {
      const detail = (e as CustomEvent<{ path: string }>).detail;
      if (detail && detail.path === path) {
        handleFetch(useProxy);
      }
    };
    window.addEventListener('fetch-api-node', handleSpecificFetch);
    return () => window.removeEventListener('fetch-api-node', handleSpecificFetch);
  }, [handleFetch, path, useProxy]);

  const handleSelectFreeApi = useCallback(
    async (preset: FreeApiPreset, autoRun: boolean) => {
      setShowFreeApiModal(false);
      setLocalUrl(preset.url);
      await updateNodeValue(path, preset.url);

      if (isEditing && inlineApiEditor) {
        setInlineApiEditor({ ...inlineApiEditor, url: preset.url });
      }

      const nextConfig = {
        ...config,
        method: preset.method,
        headers: (preset.headers || []).map((h) => ({
          id: h.id || Math.random().toString(36).substring(2, 9),
          key: h.key,
          value: h.value,
          enabled: h.enabled,
        })),
        body: preset.body ? { type: preset.body.type, rawJson: preset.body.rawJson || '' } : { type: 'none' as const },
        extractPath: preset.extractPath || undefined,
        responseFormat: preset.responseFormat || undefined,
        streamEnabled: preset.method === 'POST' && preset.id === 'ollama-chat' ? false : undefined,
      };

      setApiNodeConfig(path, nextConfig);
      setApiNodeError(path, null);

      if (autoRun) {
        setTimeout(() => {
          handleFetch(false);
        }, 80);
      }
    },
    [config, handleFetch, inlineApiEditor, isEditing, path, setApiNodeConfig, setApiNodeError, setInlineApiEditor, updateNodeValue]
  );

  const clearData = () => {
    removeApiNode(path);
    setUseProxy(false);
  };

  // Which way the response is currently attached (child nodes or a single file node)
  const currentView = hasData ? resolveApiResponseView(apiNodeResponses[path], config.view) : null;
  const toggleResponseView = (e: React.MouseEvent) => {
    e.stopPropagation();
    setApiNodeConfig(path, { ...config, view: currentView === 'file' ? 'nodes' : 'file' });
  };

  const openEditor = (
    e?: React.MouseEvent,
    tab: 'params' | 'headers' | 'auth' | 'body' | 'variables' | 'response' | 'settings' = 'params'
  ) => {
    e?.stopPropagation();
    setInlineApiEditor({
      url: currentUrl,
      path,
      nodeId,
      x: nodeX,
      y: nodeY,
      width: nodeWidth,
      // The node wrapper adds 6px padding above and below the card
      height: (cardRef.current?.offsetHeight ?? 128) + 12,
      initialTab: tab,
    });
  };

  const handleCopyCurl = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const substitutedParams = substituteInParamList(config.params, config.variables, config.activeVariableGroup);
      const substitutedHeaders = substituteInParamList(config.headers, config.variables, config.activeVariableGroup);
      const substitutedAuth = substituteInAuth(config.auth, config.variables, config.activeVariableGroup);
      const effectiveBody: BodyConfig | undefined = (showInlineBody && localBodyText !== undefined)
        ? { ...(config.body || { type: 'json' as const }), type: 'json' as const, rawJson: localBodyText }
        : config.body;
      const substitutedBody = substituteInBody(effectiveBody, config.variables, config.activeVariableGroup);
      const resolvedUrl = interpolateVariables(localUrl.trim() || currentUrl, config.variables, config.activeVariableGroup);

      const curl = buildCurl(
        resolvedUrl,
        config.method || 'GET',
        substitutedParams,
        substitutedHeaders,
        substitutedAuth,
        substitutedBody
      );
      navigator.clipboard.writeText(curl);
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    } catch (err) {
      console.error('Failed to copy cURL', err);
    }
  };

  const endpointHost = getEndpointHost(localUrl || currentUrl, config.variables, config.activeVariableGroup);
  const responseLabel = formatResponseType(config.responseType);
  const timeoutLabel = formatTimeout(config.timeout);

  const allowHeader = meta?.headers
    ? (meta.headers['allow'] || meta.headers['Allow'])
    : undefined;
  const suggestedMethod = allowHeader ? allowHeader.split(',')[0].trim().toUpperCase() : 'POST';

  const statusMeta: StatusMeta = isLoading
    ? {
      label: config.streamEnabled ? 'Streaming…' : 'Fetching…',
      title: 'Request in progress (click Cancel to abort)',
      dotClass: 'bg-amber-500 animate-pulse',
      textClass: 'text-amber-600 dark:text-amber-400',
    }
    : error
      ? {
        label: error.code === 'CANCELLED' ? 'Cancelled' : 'Failed',
        title: error.userMessage || 'Show error details',
        dotClass: error.code === 'CANCELLED' ? 'bg-slate-400' : 'bg-red-500',
        textClass: error.code === 'CANCELLED' ? 'text-slate-500 dark:text-slate-400' : 'text-red-600 dark:text-red-400',
      }
      : hasData
        ? { label: 'Connected', title: 'API data loaded', dotClass: 'bg-emerald-500', textClass: 'text-emerald-600 dark:text-emerald-400' }
        : canFetch
          ? { label: 'Ready', title: 'Ready to fetch data', dotClass: 'bg-blue-500', textClass: 'text-blue-600 dark:text-blue-400' }
          : { label: 'No URL', title: 'Add an endpoint URL', dotClass: 'bg-slate-400 dark:bg-slate-600', textClass: 'text-slate-500 dark:text-slate-400' };

  const iconButtonClass = 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200';

  const openErrorPopup = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setShowErrorPopup(!showErrorPopup);
    setShowAdvancedDiagnostics(false);
  };

  const statusContent = (
    <>
      <span className={`h-2 w-2 shrink-0 rounded-full ${statusMeta.dotClass}`} />
      <span className={`font-medium ${statusMeta.textClass}`}>{statusMeta.label}</span>
      {error && !isLoading && <ChevronRight size={12} className={statusMeta.textClass} />}
    </>
  );

  return (
    <div className="flex h-full w-full min-w-0 pointer-events-auto">
      <div
        ref={cardRef}
        className={`relative flex h-full min-h-[128px] w-full max-w-[340px] flex-col overflow-hidden rounded-xl border bg-white text-slate-900 shadow-sm transition-colors dark:bg-[#0f172a] dark:text-slate-100 ${isEditing
          ? 'border-blue-500/60 ring-2 ring-blue-500/20'
          : 'border-slate-200 dark:border-slate-800'
          }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 px-3 pt-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 relative group">
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin text-blue-500 group-hover:opacity-0 transition-opacity" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAbort();
                    }}
                    className="absolute inset-0 flex items-center justify-center bg-rose-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-sm cursor-pointer"
                    title="Click to cancel active request"
                    aria-label="Cancel active request"
                  >
                    <Square size={10} className="fill-current" />
                  </button>
                </>
              ) : (
                <Globe size={16} />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold leading-tight text-slate-900 dark:text-slate-100">API request</div>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                <CustomSelect
                  value={config.method || 'GET'}
                  onChange={(newMethod) => {
                    setApiNodeConfig(path, { ...config, method: newMethod });
                  }}
                  options={HTTP_METHOD_OPTIONS}
                  renderTrigger={({ ref, isOpen, props }) => (
                    <button
                      ref={ref}
                      type="button"
                      {...props}
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onClick?.(e);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      className={`nodrag shrink-0 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold cursor-pointer border-0 outline-none uppercase tracking-wide transition-all ${getMethodClass(config.method || 'GET')} ${isOpen ? 'ring-2 ring-blue-500/30 brightness-110' : 'hover:opacity-85'
                        }`}
                      title="Click to switch HTTP method"
                      aria-label={`HTTP Method: ${config.method || 'GET'}`}
                    >
                      <span>{config.method || 'GET'}</span>
                      <ChevronDown
                        size={10}
                        className={`opacity-70 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                  )}
                />
                <button
                  type="button"
                  onClick={(e) => openEditor(e, 'params')}
                  className="truncate text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer hover:underline text-left max-w-[200px]"
                  title={`Edit endpoint: ${endpointHost}`}
                >
                  {endpointHost}
                </button>
                {/* Auth Chip */}
                {config.auth && config.auth.type !== 'none' && (
                  <span
                    className="inline-flex items-center gap-0.5 rounded bg-violet-500/10 pl-1 pr-0.5 py-px text-[9px] font-medium text-violet-600 dark:text-violet-400 group transition-all"
                    title={`Auth: ${config.auth.type} (click to edit, × to disable)`}
                  >
                    <button
                      type="button"
                      onClick={(e) => openEditor(e, 'auth')}
                      className="cursor-pointer hover:underline flex items-center gap-0.5"
                      title={`Edit auth settings (${config.auth.type})`}
                    >
                      <Key size={9} className="shrink-0" />
                      <span>{config.auth.type}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setApiNodeConfig(path, { ...config, auth: { type: 'none' } });
                      }}
                      className="ml-0.5 rounded p-0.5 hover:bg-violet-500/20 hover:text-violet-800 dark:hover:text-violet-200 transition-colors cursor-pointer"
                      title="Disable authentication"
                    >
                      <X size={8} />
                    </button>
                  </span>
                )}

                {/* Body Chip */}
                {config.body && config.body.type !== 'none' && (
                  <span
                    className={`inline-flex items-center gap-0.5 rounded pl-1 pr-0.5 py-px text-[9px] font-medium transition-all ${showInlineBody
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30 font-semibold'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 group'
                      }`}
                    title={`Body: ${config.body.type} (click to toggle inline body editor, × to remove body)`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowInlineBody((prev) => !prev);
                      }}
                      className="cursor-pointer hover:underline flex items-center gap-0.5"
                      title={showInlineBody ? "Click to hide inline body editor" : "Click to view & edit body directly"}
                    >
                      <FileCode size={9} className="shrink-0" />
                      <span>{config.body.type}</span>
                      <ChevronDown size={8} className={`transition-transform duration-200 ${showInlineBody ? 'rotate-180' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowInlineBody(false);
                        setApiNodeConfig(path, { ...config, body: { type: 'none' } });
                      }}
                      className="ml-0.5 rounded p-0.5 hover:bg-amber-500/20 hover:text-amber-800 dark:hover:text-amber-200 transition-colors cursor-pointer"
                      title="Disable / remove request body"
                    >
                      <X size={8} />
                    </button>
                  </span>
                )}

                {/* Streaming Chip (stream: true / stream: false) */}
                {config.streamEnabled !== undefined && (
                  <span
                    className={`inline-flex items-center gap-0.5 rounded pl-1 pr-0.5 py-px text-[9px] font-medium transition-all ${config.streamEnabled
                      ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      }`}
                    title={`Streaming: ${config.streamEnabled ? 'stream: true' : 'stream: false'} (click text to toggle, × to disable)`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setApiNodeConfig(path, { ...config, streamEnabled: !config.streamEnabled });
                      }}
                      className="cursor-pointer hover:underline flex items-center gap-0.5"
                      title="Click to toggle between Single and Stream"
                    >
                      {config.streamEnabled ? <Activity size={9} /> : <Zap size={9} />}
                      <span>{config.streamEnabled ? 'stream' : 'single'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setApiNodeConfig(path, { ...config, streamEnabled: undefined });
                      }}
                      className="ml-0.5 rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
                      title="Disable stream mode (revert to Auto)"
                    >
                      <X size={8} />
                    </button>
                  </span>
                )}

                {/* Key Extraction Chip */}
                {config.extractPath && (
                  <span
                    className="inline-flex items-center gap-0.5 rounded bg-indigo-500/10 pl-1 pr-0.5 py-px text-[9px] font-medium text-indigo-600 dark:text-indigo-400 transition-all max-w-[150px]"
                    title={`Extracting key: ${config.extractPath} (click text to edit, × to clear)`}
                  >
                    <button
                      type="button"
                      onClick={(e) => openEditor(e, 'response')}
                      className="cursor-pointer hover:underline flex items-center gap-0.5 min-w-0 truncate"
                      title={`Edit extraction path: ${config.extractPath}`}
                    >
                      <KeyRound size={9} className="shrink-0" />
                      <span className="truncate">{config.extractPath}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setApiNodeConfig(path, { ...config, extractPath: undefined });
                      }}
                      className="ml-0.5 shrink-0 rounded p-0.5 hover:bg-indigo-500/20 hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors cursor-pointer"
                      title="Disable extraction (show full response)"
                    >
                      <X size={8} />
                    </button>
                  </span>
                )}

                {/* Response Format Chip (AUTO / MARKDOWN / JSON / TEXT) */}
                {config.responseFormat && (
                  <span
                    className={`inline-flex items-center gap-0.5 rounded pl-1.5 pr-0.5 py-px text-[9px] font-semibold uppercase transition-all ${config.responseFormat === 'auto'
                      ? 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border border-fuchsia-500/25'
                      : 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400'
                      }`}
                    title={`Format: ${config.responseFormat} (click text to cycle, × to remove override)`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const nextFormatMap: Record<string, 'auto' | 'json' | 'markdown' | 'text'> = {
                          auto: 'markdown',
                          markdown: 'json',
                          json: 'text',
                          text: 'auto',
                        };
                        const next = nextFormatMap[config.responseFormat || 'auto'] || 'markdown';
                        setApiNodeConfig(path, { ...config, responseFormat: next });
                      }}
                      className="cursor-pointer hover:underline"
                      title="Click to cycle format (Auto → Markdown → JSON → Text → Auto)"
                    >
                      {config.responseFormat}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setApiNodeConfig(path, { ...config, responseFormat: undefined });
                      }}
                      className="ml-0.5 rounded p-0.5 hover:bg-fuchsia-500/20 hover:text-fuchsia-800 dark:hover:text-fuchsia-200 transition-colors cursor-pointer"
                      title="Remove format override"
                    >
                      <X size={8} />
                    </button>
                  </span>
                )}

                {/* Variables Chip */}
                {config.variables && config.variables.filter((v) => v.enabled !== false && v.key.trim()).length > 0 && (
                  <span
                    className="inline-flex items-center gap-0.5 rounded bg-blue-500/10 px-1.5 py-px text-[9px] font-mono font-medium text-blue-600 dark:text-blue-400 group transition-all cursor-pointer hover:bg-blue-500/20 hover:underline"
                    onClick={(e) => {
                      openEditor(e, 'variables');
                    }}
                    title={`${config.variables.filter((v) => v.enabled !== false && v.key.trim()).length} variable(s) active${config.activeVariableGroup && config.activeVariableGroup !== 'All' ? ` (Scope: ${config.activeVariableGroup})` : ''} - Click to edit variables`}
                  >
                    <span>{`{{${config.variables.filter((v) => v.enabled !== false && v.key.trim()).length}}}`}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowFreeApiModal(true);
              }}
              className={`${iconButtonClass} text-amber-500 hover:text-amber-600 dark:hover:text-amber-400`}
              title="Quick test with famous free APIs (IP, Weather, Mock data, etc.)"
              aria-label="Famous Free APIs"
            >
              <Sparkles size={13} className="text-amber-500" />
            </button>
            <button
              onClick={handleCopyCurl}
              className={iconButtonClass}
              title={copiedCurl ? "Copied cURL command!" : "Copy as cURL command"}
              aria-label="Copy cURL"
            >
              {copiedCurl ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            </button>
            <button
              onClick={openEditor}
              className={`${iconButtonClass} ${isEditing ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : ''}`}
              title="Edit request"
              aria-label="Edit request"
            >
              <Pencil size={14} />
            </button>
          </div>
        </div>

        {/* URL */}
        {canFetch ? (
          <div className="mx-3 mt-2.5 relative">
            <input
              type="text"
              value={localUrl}
              onChange={handleUrlChange}
              onFocus={() => setIsUrlFocused(true)}
              onBlur={handleCommitUrl}
              onKeyDown={handleUrlKeyDown}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              spellCheck={false}
              autoComplete="off"
              className="nodrag nowheel w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 pr-8 font-mono text-[11px] text-slate-700 transition-all outline-none hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:text-slate-900 focus:ring-1 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:border-slate-700 dark:focus:border-blue-500 dark:focus:bg-slate-950 dark:focus:text-slate-100 cursor-text"
              title="Click to edit endpoint URL directly (Enter to save, Esc to cancel)"
              placeholder="https://api.example.com/endpoint"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowFreeApiModal(true);
              }}
              className="nodrag absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-amber-500 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Pick from famous free APIs for instant testing"
              aria-label="Free API presets"
            >
              <Sparkles size={12} className="text-amber-500" />
            </button>
          </div>
        ) : (
          <div className="mx-3 mt-2.5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => openEditor(e, 'params')}
              className="flex-1 rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-left text-[11px] text-slate-500 transition-colors hover:border-blue-500/60 hover:text-blue-600 dark:border-slate-700 dark:text-slate-400 dark:hover:text-blue-400 cursor-pointer"
            >
              + Add an endpoint URL
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowFreeApiModal(true);
              }}
              className="nodrag inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-xs hover:from-blue-500 hover:to-indigo-500 active:scale-95 transition-all cursor-pointer shrink-0"
              title="Pick from famous free APIs for instant testing"
            >
              <Sparkles size={12} className="text-amber-300" />
              <span>Free APIs</span>
            </button>
          </div>
        )}

        {/* Inline Body Toggle & Editor */}
        {((config.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method.toUpperCase())) || (config.body && config.body.type !== 'none')) && (
          <div className="mx-3 mt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!config.body || config.body.type === 'none') {
                  const initialJson = '{\n  \n}';
                  setLocalBodyText(initialJson);
                  commitBodyChange(initialJson);
                  setShowInlineBody(true);
                } else {
                  setShowInlineBody((prev) => !prev);
                }
              }}
              className={`nodrag inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold transition-all cursor-pointer ${showInlineBody
                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/15'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              title={showInlineBody ? 'Hide request body editor' : 'Directly view and edit request JSON body'}
            >
              <FileCode size={12} className={showInlineBody ? 'text-amber-500' : 'text-slate-400'} />
              <span>{showInlineBody ? 'Hide Body' : 'Show Body'}</span>
              <ChevronDown
                size={11}
                className={`transition-transform duration-200 ${showInlineBody ? 'rotate-180 text-amber-500' : 'text-slate-400'}`}
              />
              {config.body?.rawJson && !showInlineBody && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-normal">
                  ({config.body.rawJson.split('\n').length} {config.body.rawJson.split('\n').length === 1 ? 'line' : 'lines'})
                </span>
              )}
            </button>

            {showInlineBody && (
              <div className="nodrag flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditor(e, 'body');
                  }}
                  className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-blue-500 transition-colors p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  title="Open full editor modal"
                >
                  <Maximize2 size={11} />
                  <span>Full Editor</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Inline Body Editor Area */}
        {showInlineBody && config.body && config.body.type !== 'none' && (
          <div className="mx-3 mt-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1218] overflow-hidden shadow-xs animate-in fade-in duration-150">
            {/* Header Strip */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-2.5 py-1.5 bg-slate-50/80 dark:bg-slate-900/60">
              <div className="flex items-center gap-1.5">
                <FileJson size={13} className="text-amber-500 shrink-0" />
                <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">JSON Body</span>
                {bodyValidation.isValid ? (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold ${bodyValidation.hasVariables
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    }`}>
                    {bodyValidation.hasVariables ? 'Dynamic Vars' : 'Valid'}
                  </span>
                ) : (
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 truncate max-w-[120px]"
                    title={bodyValidation.error || 'Invalid JSON syntax'}
                  >
                    Syntax Warning
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {/* Word Wrap */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsBodyWordWrap((prev) => !prev);
                  }}
                  className={`p-1 rounded transition-colors cursor-pointer ${isBodyWordWrap
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-500/15'
                    : 'text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                    }`}
                  title={isBodyWordWrap ? 'Word wrap: On' : 'Word wrap: Off'}
                  aria-label="Toggle word wrap"
                  aria-pressed={isBodyWordWrap}
                >
                  <WrapText size={12} />
                </button>
                {/* Prettify */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrettifyInlineBody();
                  }}
                  className="p-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Format JSON (Preserves variables)"
                  aria-label="Format JSON"
                >
                  <PrettierIcon size={12} />
                </button>
                {/* Copy */}
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!localBodyText) return;
                    await navigator.clipboard.writeText(localBodyText);
                    setCopiedBody(true);
                    setTimeout(() => setCopiedBody(false), 1500);
                  }}
                  className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title={copiedBody ? 'Copied!' : 'Copy JSON'}
                  aria-label="Copy JSON"
                >
                  {copiedBody ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                </button>
                {/* Clear */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const resetJson = '{\n  \n}';
                    setLocalBodyText(resetJson);
                    commitBodyChange(resetJson);
                  }}
                  className="p-1 rounded text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Reset to empty JSON"
                  aria-label="Reset JSON"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {/* Code Textarea with Line Numbers */}
            <div className="relative flex min-h-[120px] max-h-[240px] overflow-hidden bg-slate-50/30 dark:bg-[#090d14]">
              {/* Hidden mirror for calculating wrapped line heights */}
              {isBodyWordWrap && (
                <div
                  ref={mirrorRef}
                  className="invisible pointer-events-none absolute -top-[9999px] -left-[9999px] font-mono text-[11px] leading-[18px] whitespace-pre-wrap break-words"
                  aria-hidden="true"
                >
                  {(localBodyText || '').split('\n').map((line, idx) => (
                    <div key={idx} style={{ lineHeight: '18px' }}>
                      {line || '\u00A0'}
                    </div>
                  ))}
                </div>
              )}

              {/* Line Numbers Gutter */}
              <div
                ref={bodyLineNumbersRef}
                className="select-none overflow-hidden py-2 pl-2 pr-1.5 font-mono text-[10px] leading-[18px] text-slate-400/60 text-right min-w-[28px] border-r border-slate-200/60 dark:border-slate-800/60 bg-slate-100/40 dark:bg-slate-900/40"
                aria-hidden="true"
              >
                {(localBodyText || '').split('\n').map((_, idx) => (
                  <div
                    key={idx}
                    style={{
                      height: isBodyWordWrap && lineHeights[idx] ? `${lineHeights[idx]}px` : '18px',
                      lineHeight: '18px',
                    }}
                  >
                    {idx + 1}
                  </div>
                ))}
              </div>

              {/* Textarea */}
              <textarea
                ref={bodyTextareaRef}
                value={localBodyText}
                onChange={handleBodyChange}
                onFocus={() => setIsBodyFocused(true)}
                onBlur={() => setIsBodyFocused(false)}
                onKeyDown={handleBodyKeyDown}
                onScroll={handleBodyScroll}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
                spellCheck={false}
                autoComplete="off"
                placeholder='{\n  "key": "value"\n}'
                className={`nodrag nowheel flex-1 resize-y bg-transparent p-2 font-mono text-[11px] leading-[18px] text-slate-800 dark:text-slate-200 outline-none custom-scrollbar min-h-[120px] max-h-[240px] ${isBodyWordWrap
                  ? 'whitespace-pre-wrap break-words overflow-y-auto overflow-x-hidden'
                  : 'whitespace-pre overflow-auto'
                  }`}
              />
            </div>

            {/* Variable Insertion Pills Footer */}
            {config.variables && config.variables.filter((v) => v.enabled !== false && v.key.trim()).length > 0 && (
              <div
                className="nodrag flex items-center gap-1 overflow-x-auto no-scrollbar scrollbar-none px-2.5 py-1 bg-slate-50/70 dark:bg-slate-900/60 border-t border-slate-200/80 dark:border-slate-800/80"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-0.5">
                  Insert:
                </span>
                {config.variables
                  .filter((v) => v.enabled !== false && v.key.trim())
                  .map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        insertVariableAtCursor(`{{${v.key.trim()}}}`);
                      }}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors whitespace-nowrap cursor-pointer shrink-0"
                      title={`Insert {{${v.key.trim()}}} into JSON body`}
                    >
                      <span>+ {`{{${v.key.trim()}}}`}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Response Metrics Strip (Status, Latency, Size) */}
        {meta?.status !== undefined && (
          <div className="mx-3 mt-2 flex items-center justify-between rounded-lg border border-slate-200/80 bg-slate-50/70 px-2 py-1 text-[10px] font-mono dark:border-slate-800/80 dark:bg-slate-900/60">
            <div className="flex items-center gap-1.5">
              <span className={`rounded px-1.5 py-0.5 font-semibold border ${getStatusBadgeClass(meta.status)}`}>
                {meta.status} {meta.statusText || ''}
              </span>
              {meta.duration !== undefined && (
                <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400" title="Response latency">
                  <Zap size={10} className="shrink-0 text-amber-500" />
                  <span>{meta.duration}ms</span>
                </span>
              )}
            </div>
            {meta.size !== undefined && meta.size > 0 && (
              <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400" title="Response size">
                <Box size={10} className="shrink-0 text-blue-500 dark:text-blue-400" />
                <span>{formatSize(meta.size)}</span>
              </span>
            )}
          </div>
        )}

        {/* Quick Suggestion: One-Click Extract for LLM / Structured Responses */}
        {topCandidate && hasData && !isLoading && !config.extractPath && (
          <div className="mx-3 mt-2 flex items-center justify-between rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1.5 text-xs dark:bg-indigo-500/15">
            <div className="flex items-center gap-1.5 min-w-0 text-[11px] text-indigo-700 dark:text-indigo-300 font-medium truncate">
              <Sparkles size={13} className="shrink-0 text-indigo-500" />
              <span className="truncate">Extract <strong>{topCandidate.path}</strong></span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setApiNodeConfig(path, {
                  ...config,
                  extractPath: topCandidate.path,
                  responseFormat: 'markdown',
                  view: 'file'
                });
              }}
              className="shrink-0 ml-2 rounded-md bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs transition-colors hover:bg-indigo-500 active:scale-95"
              title={`Extract ${topCandidate.path} and format response`}
            >
              Extract & Format
            </button>
          </div>
        )}

        {/* Local Server Protocol or Port Auto-Fix */}
        {error && isLocalEndpoint && (isHttpsOnLocal || hasOllamaPortTypo) && (
          <div className="mx-3 mt-2 flex flex-col gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs dark:bg-amber-500/15">
            <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 font-medium">
              <AlertCircle size={14} className="shrink-0 text-amber-500" />
              <span>
                {isHttpsOnLocal && hasOllamaPortTypo
                  ? 'Localhost requires http:// and port 11434'
                  : isHttpsOnLocal
                    ? 'Localhost requires http://, not https://'
                    : 'Ollama uses port 11434 (not 11343)'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="truncate font-mono text-[10px] text-amber-600 dark:text-amber-400 inline-flex items-center gap-1" title={suggestedFixedUrl}>
                <ArrowRight size={10} className="shrink-0" />
                <span className="truncate">{suggestedFixedUrl}</span>
              </span>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (isEditing && inlineApiEditor) {
                    setInlineApiEditor({ ...inlineApiEditor, url: suggestedFixedUrl });
                  }
                  await updateNodeValue(path, suggestedFixedUrl);
                  setApiNodeError(path, null);
                  setTimeout(() => handleFetch(false), 50);
                }}
                className="shrink-0 rounded-md bg-amber-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-xs transition-colors hover:bg-amber-500 active:scale-95"
                title={`Fix URL to ${suggestedFixedUrl} and retry`}
              >
                Fix URL & Retry
              </button>
            </div>
          </div>
        )}

        {/* Mobile / HTTPS Localhost Error Banner */}
        {error && isLocalEndpoint && (error.code === 'MOBILE_LOCALHOST_ERR' || error.code === 'HTTPS_MIXED_CONTENT_ERR') && !(isHttpsOnLocal || hasOllamaPortTypo) && (
          <div className="mx-3 mt-2 flex items-center justify-between rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 py-1.5 text-xs dark:bg-purple-500/15">
            <div className="flex items-center gap-1.5 min-w-0 text-[11px] text-purple-700 dark:text-purple-300 font-medium truncate">
              <Sparkles size={13} className="shrink-0 text-purple-500" />
              <span>
                {error.code === 'MOBILE_LOCALHOST_ERR'
                  ? 'Mobile device: localhost points to phone'
                  : 'Allow Localhost in Browser (100% Local)'}
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openErrorPopup();
              }}
              className="shrink-0 rounded-md bg-purple-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs transition-colors hover:bg-purple-500 active:scale-95 cursor-pointer"
              title="View how to allow localhost in your browser"
            >
              How to Allow
            </button>
          </div>
        )}

        {/* 405 Method Not Allowed Quick Resolution */}
        {(meta?.status === 405 || error?.code === '405') && (
          <div className="mx-3 mt-2 flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs dark:bg-amber-500/15">
            <div className="flex items-center gap-1.5 min-w-0 text-[11px] text-amber-700 dark:text-amber-300 font-medium truncate">
              <AlertCircle size={13} className="shrink-0 text-amber-500" />
              <span>Requires <strong>{suggestedMethod}</strong></span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setApiNodeConfig(path, { ...config, method: suggestedMethod });
                setTimeout(() => handleFetch(useProxy), 50);
              }}
              className="shrink-0 ml-2 rounded-md bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm transition-colors hover:bg-amber-500 active:scale-95"
              title={`Switch method to ${suggestedMethod} and retry request`}
            >
              Switch to {suggestedMethod} & Retry
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between gap-2 px-3 pb-2.5 pt-2.5">
          <div className="flex min-w-0 items-center gap-2 text-[11px]">
            {error && !isLoading ? (
              <button
                onClick={openErrorPopup}
                className="-ml-1.5 flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors hover:bg-red-500/10"
                title={statusMeta.title}
              >
                {statusContent}
              </button>
            ) : (
              <span className="flex items-center gap-1.5" title={statusMeta.title}>
                {statusContent}
              </span>
            )}
            <span className="truncate text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <span>{responseLabel}</span>
              <span>·</span>
              {!config.timeout || config.timeout <= 0 ? (
                <span className="inline-flex items-center gap-0.5 text-slate-400" title="No timeout applied (runs until complete or cancelled)">
                  <TimerOff size={10} className="shrink-0" />
                  <Infinity size={10} className="shrink-0" />
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5" title={`Timeout: ${timeoutLabel}`}>
                  <Timer size={10} className="shrink-0" />
                  <span>{timeoutLabel}</span>
                </span>
              )}
            </span>
            {useProxy && (
              <span className="shrink-0 rounded bg-orange-500/10 px-1.5 py-px text-[10px] font-medium text-orange-600 dark:text-orange-400" title="Fetched through the proxy">
                Proxy
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {isLoading && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAbort();
                }}
                className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 px-2 text-[11px] font-semibold transition-all active:scale-95 shadow-xs cursor-pointer"
                title="Cancel in-flight request signal"
                aria-label="Cancel request"
              >
                <Square size={10} className="fill-current text-rose-500" />
                <span>Cancel</span>
              </button>
            )}

            {!hasData && !isLoading && !error && (
              <button
                onClick={(e) => { e.stopPropagation(); handleFetch(false); }}
                disabled={!canFetch}
                className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                title={canFetch ? 'Fetch data' : 'Add an API URL first'}
              >
                <Play size={12} className="fill-current" />
                Fetch
              </button>
            )}

            {error && !isLoading && (
              <button
                onClick={(e) => { e.stopPropagation(); handleFetch(isLocalEndpoint ? false : error.requestInfo.proxyUsed); }}
                className={iconButtonClass}
                title="Retry"
                aria-label="Retry"
              >
                <RefreshCw size={14} />
              </button>
            )}

            {hasData && !isLoading && !error && (
              <>
                <button
                  onClick={toggleResponseView}
                  className={iconButtonClass}
                  title={currentView === 'file' ? 'Show response as child nodes' : 'Show response as a file'}
                  aria-label={currentView === 'file' ? 'Show response as child nodes' : 'Show response as a file'}
                >
                  {currentView === 'file' ? <ListTree size={14} /> : <FileJson size={14} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleFetch(useProxy); }}
                  className={iconButtonClass}
                  title="Refresh"
                  aria-label="Refresh"
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); clearData(); }}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400"
                  title="Clear fetched data"
                  aria-label="Clear fetched data"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        {error && !isLoading && showErrorPopup && createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm pointer-events-auto"
            onClick={(e) => { e.stopPropagation(); setShowErrorPopup(false); }}
          >
            <div
              role="dialog"
              aria-label="API fetch error"
              className="flex w-[420px] max-w-[92vw] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white font-sans text-slate-900 shadow-2xl pointer-events-auto dark:border-slate-800 dark:bg-[#0f172a] dark:text-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
                    <AlertCircle size={16} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold leading-tight">Request failed</h3>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-medium text-red-600 dark:text-red-400">{error.type}</span>
                      {error.code && (
                        <span className="rounded bg-slate-100 px-1.5 py-px font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {error.code}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowErrorPopup(false); }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  title="Close"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex flex-col gap-3 px-4 py-4">
                <div className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
                  {error.userMessage}
                </div>

                {isLocalEndpoint && (
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        const guide = `1. In browser address bar, click the padlock/tune icon (🔒 or 🎛️)\n2. Select "Site settings"\n3. Change "Insecure content" to "Allow"\n4. Reload page`;
                        navigator.clipboard.writeText(guide);
                        setCopiedHint('Browser allow steps copied!');
                        setTimeout(() => setCopiedHint(null), 3000);
                      }}
                      className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2.5 text-[11px] font-semibold transition-all cursor-pointer"
                      title="Copy steps to allow Insecure Content in browser"
                    >
                      <Copy size={12} />
                      <span>Copy Browser Allow Steps</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const isWin = typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent);
                        const cmd = isWin
                          ? `$env:OLLAMA_ORIGINS="*"; ollama serve`
                          : `OLLAMA_ORIGINS="*" ollama serve`;
                        navigator.clipboard.writeText(cmd);
                        setCopiedHint('CORS command copied!');
                        setTimeout(() => setCopiedHint(null), 3000);
                      }}
                      className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 px-2.5 text-[11px] font-semibold transition-all cursor-pointer"
                      title="Copy command to start Ollama with CORS enabled"
                    >
                      <Copy size={12} />
                      <span>Copy Ollama CORS Fix</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const cmd = `cloudflared tunnel --url http://localhost:11434 --http-host-header="localhost:11434"`;
                        navigator.clipboard.writeText(cmd);
                        setCopiedHint('Tunnel command copied!');
                        setTimeout(() => setCopiedHint(null), 3000);
                      }}
                      className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 px-2.5 text-[11px] font-semibold transition-all cursor-pointer"
                      title="Copy command to create a free HTTPS tunnel for Ollama"
                    >
                      <Copy size={12} />
                      <span>Copy Tunnel Command</span>
                    </button>
                    {copiedHint && (
                      <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                        ✓ {copiedHint}
                      </span>
                    )}
                  </div>
                )}

                <div>
                  <button
                    onClick={() => setShowAdvancedDiagnostics(!showAdvancedDiagnostics)}
                    className="flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    {showAdvancedDiagnostics ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    Technical details
                  </button>

                  {showAdvancedDiagnostics && (
                    <div className="custom-scrollbar mt-2 max-h-[250px] overflow-y-auto break-all rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-200">
                      <div className="mb-1 font-semibold text-blue-300">Request URL</div>
                      <div className="mb-3 border-l-2 border-slate-700 pl-2">{error.requestInfo.url}</div>

                      <div className="mb-1 font-semibold text-blue-300">Method</div>
                      <div className="mb-3 border-l-2 border-slate-700 pl-2">{error.requestInfo.method}</div>

                      <div className="mb-1 font-semibold text-blue-300">Proxy used</div>
                      <div className="mb-3 border-l-2 border-slate-700 pl-2">{error.requestInfo.proxyUsed ? 'Yes' : 'No'}</div>

                      <div className="mb-1 font-semibold text-blue-300">Raw message</div>
                      <div className="mb-3 border-l-2 border-slate-700 pl-2">{error.message}</div>

                      {error.details && (
                        <>
                          <div className="mb-1 font-semibold text-violet-300">Diagnostics / stack</div>
                          <div className="whitespace-pre-wrap border-l-2 border-slate-700 pl-2 text-[10px] opacity-85">{error.details}</div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950/40">
                {(error.code === '405' || meta?.status === 405) && (
                  <button
                    onClick={() => {
                      setApiNodeConfig(path, { ...config, method: suggestedMethod });
                      setShowErrorPopup(false);
                      setTimeout(() => handleFetch(error.requestInfo.proxyUsed), 50);
                    }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-amber-500"
                  >
                    Switch to {suggestedMethod} & Retry
                  </button>
                )}
                {!isLocalEndpoint && !error.requestInfo.proxyUsed && (
                  <button
                    onClick={() => { handleFetch(true); setShowErrorPopup(false); }}
                    className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
                  >
                    Retry with proxy
                  </button>
                )}
                <button
                  onClick={() => { handleFetch(isLocalEndpoint ? false : error.requestInfo.proxyUsed); setShowErrorPopup(false); }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 cursor-pointer"
                >
                  <RefreshCw size={13} />
                  Retry
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        <FreeApiModal
          isOpen={showFreeApiModal}
          onClose={() => setShowFreeApiModal(false)}
          onSelect={handleSelectFreeApi}
        />
      </div>
    </div>
  );
}
