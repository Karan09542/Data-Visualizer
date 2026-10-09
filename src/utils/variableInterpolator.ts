import { getNestedValue, type KeyValueParam, type AuthConfig, type BodyConfig } from './curlParser';
import { useStore } from '../store/useStore';

export interface ApiVariable {
  id: string;
  enabled: boolean;
  key: string;
  value: string;
  group: string;
  description?: string;
  isSecret?: boolean;
}

export interface NodeChainingContext {
  apiNodeResponses?: Record<string, any>;
  jsNodeResponses?: Record<string, any>;
  parsedData?: any;
  currentNodePath?: string; // Path of the current node executing or open in editor (e.g. "root.demo_nodes.followers_api_node")
}

export interface AvailableNodeVariable {
  token: string;          // e.g. "ip_lookup.ip" or "github_profile.followers_url"
  nodeId: string;         // e.g. "root.ip_lookup_api_node"
  nodeName: string;       // e.g. "ip_lookup"
  nodeType: 'api' | 'js' | 'data';
  property: string;       // e.g. "ip"
  value: any;             // e.g. "203.0.113.195"
  preview: string;        // e.g. "\"203.0.113.195\""
  status?: string;        // e.g. "200 OK"
  isRelative?: boolean;   // true if token is relative to current node's scope
  scope?: string;         // parent scope name, e.g. "demo_nodes"
}

export interface AnalyzedVariable {
  key: string;
  isResolved: boolean;
  value?: string;
  group?: string;
  isChained?: boolean;
  nodeName?: string;
  nodeType?: 'api' | 'js' | 'data';
}

export const DEFAULT_VARIABLE_GROUPS = ['All', 'General', 'Auth', 'Servers', 'Environment'] as const;

function getSafeStoreState() {
  try {
    return useStore.getState();
  } catch {
    return null;
  }
}

/**
 * Normalizes an API response or node output to extract clean text/string or primitive if accessed directly
 */
function extractUsableValue(val: any): any {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return val;
  }
  if (typeof val === 'object') {
    if (typeof val._combinedMessage === 'string' && val._combinedMessage) {
      return val._combinedMessage;
    }
    if (typeof val._rawText === 'string') {
      return val._rawText;
    }
    if (typeof val._imageUrl === 'string') {
      return val._imageUrl;
    }
    if (typeof val._audioUrl === 'string') {
      return val._audioUrl;
    }
    if (typeof val._videoUrl === 'string') {
      return val._videoUrl;
    }
    if (typeof val._pdfUrl === 'string') {
      return val._pdfUrl;
    }
  }
  return val;
}

/**
 * Formats a value for text interpolation (numbers/booleans/strings, or serialized JSON)
 */
export function formatInterpolatedValue(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  try {
    return JSON.stringify(val);
  } catch {
    return String(val);
  }
}

/**
 * Extracts ancestor parent scopes from a node path from deepest to shallowest.
 * E.g. "root.demo_nodes.followers_api_node" -> ["demo_nodes"]
 * E.g. "demo_nodes.sub_group.follower_api_node" -> ["demo_nodes.sub_group", "demo_nodes"]
 */
export function getParentScopes(nodePath?: string): string[] {
  if (!nodePath || typeof nodePath !== 'string') return [];
  const clean = nodePath
    .trim()
    .replace(/^root\./, '')
    .replace(/_(api|js|ts|py|todo|math)_node$/i, '')
    .replace(/\.(api|js|ts|py|todo|math)$/i, '');

  const parts = clean.split('.').filter(Boolean);
  if (parts.length <= 1) return [];

  const parentParts = parts.slice(0, -1);
  const scopes: string[] = [];

  for (let i = parentParts.length; i > 0; i--) {
    scopes.push(parentParts.slice(0, i).join('.'));
  }

  return scopes;
}

/**
 * Generates candidate scoped tokens for resolving variable tokens.
 * Supports:
 * 1. Scope-relative sibling resolution (e.g. current node in "demo_nodes", token "github_profile.followers_url" -> "demo_nodes.github_profile.followers_url")
 * 2. Explicit dot paths (e.g. "./github_profile.followers_url" or "../other.prop")
 * 3. Direct / absolute tokens (e.g. "demo_nodes.github_profile.followers_url" or "github_profile.followers_url")
 */
export function getCandidateTokens(cleanToken: string, currentNodePath?: string): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();

  const add = (tok: string) => {
    const t = tok.trim().replace(/^\$\.?/, '');
    if (t && !seen.has(t)) {
      seen.add(t);
      candidates.push(t);
    }
  };

  // 1. Explicit relative syntax: ./ or ../
  if (cleanToken.startsWith('./') || cleanToken.startsWith('../')) {
    const parentScopes = getParentScopes(currentNodePath);
    if (cleanToken.startsWith('./')) {
      const stripped = cleanToken.slice(2).replace(/^\/+/, '');
      if (parentScopes.length > 0) {
        add(`${parentScopes[0]}.${stripped}`);
        add(`root.${parentScopes[0]}.${stripped}`);
      }
      add(stripped);
    } else {
      let remaining = cleanToken;
      let upCount = 0;
      while (remaining.startsWith('../')) {
        upCount++;
        remaining = remaining.slice(3).replace(/^\/+/, '');
      }
      const targetScope = parentScopes[upCount - 1] ?? parentScopes[parentScopes.length - 1];
      if (targetScope) {
        add(`${targetScope}.${remaining}`);
        add(`root.${targetScope}.${remaining}`);
      }
      add(remaining);
    }
    return candidates;
  }

  // 2. Relative to parent scopes of current node (highest priority for sibling resolution)
  const scopes = getParentScopes(currentNodePath);
  for (const scope of scopes) {
    add(`${scope}.${cleanToken}`);
    add(`root.${scope}.${cleanToken}`);
  }

  // 3. Direct token as written
  add(cleanToken);
  add(`root.${cleanToken}`);

  return candidates;
}

/**
 * Generates all candidate matching identifiers for a node path/key.
 * E.g. "root.demo_nodes.github_profile_api_node" produces
 * ["root.demo_nodes.github_profile_api_node", "demo_nodes.github_profile_api_node", "demo_nodes.github_profile", "github_profile"]
 */
function getNodeAliases(rawKey: string): string[] {
  const aliases = new Set<string>();
  aliases.add(rawKey);

  const noRoot = rawKey.replace(/^root\./, '');
  aliases.add(noRoot);

  const clean = noRoot.replace(/_(api|js|ts|py|todo|math)_node$/i, '');
  aliases.add(clean);

  const dotClean = clean.replace(/\.(api|js|ts|py|todo|math)$/i, '');
  aliases.add(dotClean);

  // Also include the leaf node name (e.g. "demo_nodes.github_profile" -> "github_profile")
  const parts = clean.split('.').filter(Boolean);
  if (parts.length > 1) {
    const leaf = parts[parts.length - 1];
    if (leaf) aliases.add(leaf);
  }

  return Array.from(aliases).filter(Boolean).sort((a, b) => b.length - a.length);
}

/**
 * Resolves a dynamic chained node variable token (e.g. "ip_lookup.ip", "auth.token", "posts[0].title", "calc")
 * by looking up responses in apiNodeResponses, jsNodeResponses, and parsedData.
 * Supports relative imports between siblings under the same parent scope.
 */
export function resolveNodeChainingValue(
  token: string,
  context?: NodeChainingContext,
): any {
  if (!token || typeof token !== 'string') return undefined;
  const rawToken = token.trim();
  if (!rawToken) return undefined;

  const storeState = getSafeStoreState();
  const apiResponses = context?.apiNodeResponses ?? storeState?.apiNodeResponses ?? {};
  const jsResponses = context?.jsNodeResponses ?? storeState?.jsNodeResponses ?? {};
  const parsedData = context?.parsedData ?? storeState?.parsedData;
  const currentNodePath = context?.currentNodePath ?? storeState?.inlineApiEditor?.path;

  // Clean leading $ or $.
  const cleanToken = rawToken.replace(/^\$\.?/, '');

  // Generate candidate tokens (scoped relative siblings first, then direct)
  const candidateTokens = getCandidateTokens(cleanToken, currentNodePath);

  // 1. Check all API & JS node responses
  const allResponses: Record<string, { data: any; type: 'api' | 'js' }> = {};
  for (const [k, v] of Object.entries(apiResponses)) {
    if (v !== undefined) allResponses[k] = { data: v, type: 'api' };
  }
  for (const [k, v] of Object.entries(jsResponses)) {
    if (v !== undefined) allResponses[k] = { data: v, type: 'js' };
  }

  for (const candToken of candidateTokens) {
    for (const [nodePath, { data: nodeData }] of Object.entries(allResponses)) {
      const aliases = getNodeAliases(nodePath);

      for (const alias of aliases) {
        if (candToken === alias) {
          return extractUsableValue(nodeData);
        }
        if (candToken.startsWith(alias + '.') || candToken.startsWith(alias + '[')) {
          const remainingProp = candToken.slice(alias.length).replace(/^\./, '');
          const val = getNestedValue(nodeData, remainingProp);
          if (val !== undefined) {
            return val;
          }
          // Fallback for wrapped responses (e.g. Axios response object with .data)
          if (nodeData && typeof nodeData === 'object' && nodeData.data !== undefined) {
            const val2 = getNestedValue(nodeData.data, remainingProp);
            if (val2 !== undefined) return val2;
          }
          // Fallback for streaming responses with _combinedMessage
          if (nodeData && typeof nodeData === 'object' && nodeData._combinedMessage !== undefined) {
            const val3 = getNestedValue(nodeData._combinedMessage, remainingProp);
            if (val3 !== undefined) return val3;
          }
        }
      }
    }

    // 2. Check against parsedData (static canvas JSON objects / nodes)
    if (parsedData && typeof parsedData === 'object') {
      const val = getNestedValue(parsedData, candToken) ?? getNestedValue(parsedData, candToken.replace(/^root\./, ''));
      if (val !== undefined) {
        return extractUsableValue(val);
      }
    }
  }

  return undefined;
}

/**
 * Discovers and indexes all available chainable node properties from the canvas.
 * Used for autocompletion, hints, and the Node Chaining browser UI.
 * When currentNodePath is provided, sibling nodes under the same scope are also presented as relative tokens.
 */
export function getAvailableNodeVariables(context?: NodeChainingContext): AvailableNodeVariable[] {
  const store = getSafeStoreState();
  const apiResponses = context?.apiNodeResponses ?? store?.apiNodeResponses ?? {};
  const jsResponses = context?.jsNodeResponses ?? store?.jsNodeResponses ?? {};
  const parsedData = context?.parsedData ?? store?.parsedData;
  const currentNodePath = context?.currentNodePath ?? store?.inlineApiEditor?.path;
  const apiMeta = store?.apiNodeMeta ?? {};

  const currentScopes = getParentScopes(currentNodePath);
  const immediateScope = currentScopes[0]; // e.g. "demo_nodes"

  const result: AvailableNodeVariable[] = [];
  const visitedTokens = new Set<string>();

  const addVariable = (item: AvailableNodeVariable) => {
    if (!visitedTokens.has(item.token)) {
      visitedTokens.add(item.token);
      result.push(item);
    }
  };

  const extractProperties = (
    baseObj: any,
    nodeId: string,
    nodeName: string,
    nodeType: 'api' | 'js' | 'data',
    prefix: string = '',
    depth: number = 0,
    status?: string,
    isRelative?: boolean,
    scope?: string,
  ) => {
    if (depth > 3 || baseObj === null || baseObj === undefined) return;

    if (typeof baseObj === 'string' || typeof baseObj === 'number' || typeof baseObj === 'boolean') {
      const propName = prefix || 'value';
      const token = prefix ? `${nodeName}.${prefix}` : nodeName;
      addVariable({
        token,
        nodeId,
        nodeName,
        nodeType,
        property: propName,
        value: baseObj,
        preview: typeof baseObj === 'string' ? `"${baseObj.slice(0, 40)}${baseObj.length > 40 ? '...' : ''}"` : String(baseObj),
        status,
        isRelative,
        scope,
      });
      return;
    }

    if (Array.isArray(baseObj)) {
      addVariable({
        token: prefix ? `${nodeName}.${prefix}.length` : `${nodeName}.length`,
        nodeId,
        nodeName,
        nodeType,
        property: prefix ? `${prefix}.length` : 'length',
        value: baseObj.length,
        preview: `${baseObj.length} items`,
        status,
        isRelative,
        scope,
      });

      for (let i = 0; i < Math.min(baseObj.length, 2); i++) {
        const item = baseObj[i];
        const nextPrefix = prefix ? `${prefix}[${i}]` : `[${i}]`;
        if (typeof item === 'object' && item !== null) {
          extractProperties(item, nodeId, nodeName, nodeType, nextPrefix, depth + 1, status, isRelative, scope);
        } else {
          addVariable({
            token: `${nodeName}${nextPrefix}`,
            nodeId,
            nodeName,
            nodeType,
            property: nextPrefix,
            value: item,
            preview: typeof item === 'string' ? `"${item}"` : String(item),
            status,
            isRelative,
            scope,
          });
        }
      }
      return;
    }

    if (typeof baseObj === 'object') {
      const entries = Object.entries(baseObj);
      for (const [key, val] of entries) {
        if (key.startsWith('_') && key !== '_combinedMessage' && key !== '_rawText') continue;
        const nextPrefix = prefix ? `${prefix}.${key}` : key;
        if (val !== null && typeof val === 'object' && !Array.isArray(val) && depth < 2) {
          extractProperties(val, nodeId, nodeName, nodeType, nextPrefix, depth + 1, status, isRelative, scope);
        } else if (Array.isArray(val)) {
          extractProperties(val, nodeId, nodeName, nodeType, nextPrefix, depth + 1, status, isRelative, scope);
        } else {
          const token = `${nodeName}.${nextPrefix}`;
          const isStr = typeof val === 'string';
          const preview = isStr ? `"${val.slice(0, 40)}${val.length > 40 ? '...' : ''}"` : JSON.stringify(val);
          addVariable({
            token,
            nodeId,
            nodeName,
            nodeType,
            property: nextPrefix,
            value: val,
            preview: preview?.slice(0, 50) || '',
            status,
            isRelative,
            scope,
          });
        }
      }
    }
  };

  // Helper to extract node properties with optional relative sibling token
  const processNode = (data: any, path: string, nodeType: 'api' | 'js', status: string) => {
    if (data === undefined) return;
    const cleanName = path.replace(/^root\./, '').replace(/_(api|js|ts|py|todo|math)_node$/i, '');

    // 1. If this node is a sibling in the same scope as currentNodePath, also add relative tokens!
    if (immediateScope && cleanName.startsWith(`${immediateScope}.`)) {
      const relName = cleanName.slice(immediateScope.length + 1);
      if (relName) {
        extractProperties(data, path, relName, nodeType, '', 0, `${status} · Sibling`, true, immediateScope);
      }
    }

    // 2. Standard full path token (e.g. demo_nodes.github_profile.followers_url)
    extractProperties(data, path, cleanName, nodeType, '', 0, status, false);
  };

  // 1. Process API responses
  for (const [path, data] of Object.entries(apiResponses)) {
    const meta = apiMeta[path];
    const status = meta?.status ? `${meta.status} ${meta.statusText || 'OK'}` : 'Responded';
    processNode(data, path, 'api', status);
  }

  // 2. Process JS responses
  for (const [path, data] of Object.entries(jsResponses)) {
    processNode(data, path, 'js', 'Executed');
  }

  // 3. Process top-level parsedData objects (regular canvas JSON objects)
  if (parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData)) {
    for (const [key, val] of Object.entries(parsedData)) {
      if (key.endsWith('_api_node') || key.endsWith('_js_node')) continue;
      if (val !== null && typeof val === 'object') {
        const cleanName = key.replace(/^root\./, '');
        if (immediateScope && cleanName === immediateScope && typeof val === 'object') {
          for (const [subKey, subVal] of Object.entries(val)) {
            if (subVal !== null && typeof subVal === 'object') {
              extractProperties(subVal, `root.${immediateScope}.${subKey}`, subKey, 'data', '', 0, `Canvas Data · ${immediateScope}`, true, immediateScope);
            }
          }
        }
        extractProperties(val, `root.${key}`, cleanName, 'data', '', 0, 'Canvas Data', false);
      }
    }
  }

  return result;
}

/**
 * Replaces `{{var}}`, `{{group.var}}`, and chained `{{node_id.property}}` tokens in a given string.
 * Supports up to 3 passes for nested variable references.
 */
export function interpolateVariables(
  text: string,
  variables?: ApiVariable[],
  activeGroup?: string,
  context?: NodeChainingContext,
): string {
  if (!text || typeof text !== 'string') return text || '';

  // Build key-value map from explicitly defined variables
  const varMap = new Map<string, string>();
  if (variables && Array.isArray(variables) && variables.length > 0) {
    const enabledVars = variables.filter((v) => v.enabled !== false && v.key && v.key.trim().length > 0);
    for (const v of enabledVars) {
      const trimmedKey = v.key.trim();
      varMap.set(trimmedKey, v.value);
      if (v.group && v.group.trim()) {
        const trimmedGroup = v.group.trim();
        varMap.set(`${trimmedGroup}.${trimmedKey}`, v.value);
        varMap.set(`${trimmedGroup.toLowerCase()}.${trimmedKey}`, v.value);
      }
    }

    if (activeGroup && activeGroup !== 'All') {
      const activeLower = activeGroup.trim().toLowerCase();
      for (const v of enabledVars) {
        if (v.group && v.group.trim().toLowerCase() === activeLower) {
          varMap.set(v.key.trim(), v.value);
        }
      }
    }
  }

  // Multi-pass replacement (up to 3 passes to handle nested variable definitions without infinite loops)
  let result = text;
  for (let pass = 0; pass < 3; pass++) {
    const next = result.replace(/\{\{\s*([a-zA-Z0-9_.\[\]"-]+)\s*\}\}/g, (match, key) => {
      const trimmedKey = String(key).trim();
      // 1. Direct variable in varMap
      if (varMap.has(trimmedKey)) {
        return varMap.get(trimmedKey)!;
      }
      // 2. Chained node property resolution ({{node_id.property}})
      const chainedVal = resolveNodeChainingValue(trimmedKey, context);
      if (chainedVal !== undefined) {
        return formatInterpolatedValue(chainedVal);
      }
      return match;
    });
    if (next === result) break;
    result = next;
  }

  return result;
}

/**
 * Extracts all `{{var}}` and `{{node.property}}` token names from a string
 */
export function extractVariableNames(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  const matches = text.matchAll(/\{\{\s*([a-zA-Z0-9_.\[\]"-]+)\s*\}\}/g);
  const names = new Set<string>();
  for (const m of matches) {
    if (m[1]) names.add(m[1].trim());
  }
  return Array.from(names);
}

/**
 * Returns detailed analysis of all variable usages in a string,
 * showing whether each variable is resolved via explicit environment variables
 * or through dynamic node variable chaining.
 */
export function analyzeVariablesInText(
  text: string,
  variables?: ApiVariable[],
  activeGroup?: string,
  context?: NodeChainingContext,
): AnalyzedVariable[] {
  const names = extractVariableNames(text);
  if (names.length === 0) return [];

  const enabledVars = (variables || []).filter((v) => v.enabled !== false && v.key.trim());
  const varMap = new Map<string, { value: string; group: string }>();

  for (const v of enabledVars) {
    const trimmedKey = v.key.trim();
    varMap.set(trimmedKey, { value: v.value, group: v.group });
    if (v.group && v.group.trim()) {
      varMap.set(`${v.group.trim()}.${trimmedKey}`, { value: v.value, group: v.group });
    }
  }

  if (activeGroup && activeGroup !== 'All') {
    const activeLower = activeGroup.trim().toLowerCase();
    for (const v of enabledVars) {
      if (v.group && v.group.trim().toLowerCase() === activeLower) {
        varMap.set(v.key.trim(), { value: v.value, group: v.group });
      }
    }
  }

  return names.map((key) => {
    // 1. Check user variables
    const found = varMap.get(key);
    if (found) {
      return {
        key,
        isResolved: true,
        value: found.value,
        group: found.group,
        isChained: false,
      };
    }

    // 2. Check dynamic node chaining
    const chainedVal = resolveNodeChainingValue(key, context);
    if (chainedVal !== undefined) {
      const parts = key.split(/[\.\[]/);
      const nodeName = parts[0] || key;
      return {
        key,
        isResolved: true,
        value: formatInterpolatedValue(chainedVal),
        group: 'Node Chaining',
        isChained: true,
        nodeName,
      };
    }

    // 3. Unresolved variable: identify if it follows node chaining dot/bracket syntax
    const isChainPattern = key.includes('.') || key.includes('[');
    const nodeName = isChainPattern ? key.split(/[\.\[]/)[0] : undefined;

    return {
      key,
      isResolved: false,
      value: undefined,
      group: undefined,
      isChained: isChainPattern,
      nodeName,
    };
  });
}

/**
 * Clones and interpolates a KeyValueParam list (Params or Headers)
 */
export function substituteInParamList(
  list?: KeyValueParam[],
  variables?: ApiVariable[],
  activeGroup?: string,
  context?: NodeChainingContext,
): KeyValueParam[] {
  if (!list || !Array.isArray(list)) return [];
  return list.map((item) => ({
    ...item,
    key: interpolateVariables(item.key, variables, activeGroup, context),
    value: interpolateVariables(item.value, variables, activeGroup, context),
  }));
}

/**
 * Clones and interpolates an AuthConfig
 */
export function substituteInAuth(
  auth?: AuthConfig,
  variables?: ApiVariable[],
  activeGroup?: string,
  context?: NodeChainingContext,
): AuthConfig {
  if (!auth) return { type: 'none' };
  return {
    ...auth,
    bearerToken: auth.bearerToken ? interpolateVariables(auth.bearerToken, variables, activeGroup, context) : undefined,
    basicUsername: auth.basicUsername ? interpolateVariables(auth.basicUsername, variables, activeGroup, context) : undefined,
    basicPassword: auth.basicPassword ? interpolateVariables(auth.basicPassword, variables, activeGroup, context) : undefined,
    apiKeyName: auth.apiKeyName ? interpolateVariables(auth.apiKeyName, variables, activeGroup, context) : undefined,
    apiKeyValue: auth.apiKeyValue ? interpolateVariables(auth.apiKeyValue, variables, activeGroup, context) : undefined,
  };
}

/**
 * Smartly interpolates variables and chained node values inside a JSON string.
 * - If {{var}} appears OUTSIDE quotes (e.g. `"model": {{model}}`), it formats the value
 *   as valid JSON (wrapping plain strings in quotes, or preserving numbers/booleans/null/objects/arrays).
 * - If {{var}} appears INSIDE quotes (e.g. `"model": "{{model}}"` or `"msg": "Hello {{name}}"`),
 *   it inserts the value with proper JSON string character escaping without adding extra quotes.
 */
export function interpolateJsonString(
  jsonText: string,
  variables?: ApiVariable[],
  activeGroup?: string,
  context?: NodeChainingContext,
): string {
  if (!jsonText || typeof jsonText !== 'string') return jsonText || '';

  const varMap = new Map<string, string>();
  if (variables && Array.isArray(variables) && variables.length > 0) {
    const enabledVars = variables.filter((v) => v.enabled !== false && v.key && v.key.trim().length > 0);
    for (const v of enabledVars) {
      const trimmedKey = v.key.trim();
      varMap.set(trimmedKey, v.value);
      if (v.group && v.group.trim()) {
        const trimmedGroup = v.group.trim();
        varMap.set(`${trimmedGroup}.${trimmedKey}`, v.value);
        varMap.set(`${trimmedGroup.toLowerCase()}.${trimmedKey}`, v.value);
      }
    }

    if (activeGroup && activeGroup !== 'All') {
      const activeLower = activeGroup.trim().toLowerCase();
      for (const v of enabledVars) {
        if (v.group && v.group.trim().toLowerCase() === activeLower) {
          varMap.set(v.key.trim(), v.value);
        }
      }
    }
  }

  const resolveVal = (key: string): { found: boolean; val: any } => {
    if (varMap.has(key)) {
      return { found: true, val: varMap.get(key) };
    }
    const chained = resolveNodeChainingValue(key, context);
    if (chained !== undefined) {
      return { found: true, val: chained };
    }
    return { found: false, val: undefined };
  };

  let result = '';
  let i = 0;
  let inString = false;
  let isEscaped = false;

  while (i < jsonText.length) {
    const char = jsonText[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        result += char;
        i++;
      } else if (char === '\\') {
        isEscaped = true;
        result += char;
        i++;
      } else if (char === '"') {
        inString = false;
        result += char;
        i++;
      } else if (char === '{' && jsonText.startsWith('{{', i)) {
        // Variable inside quotes: "model": "{{model}}"
        const match = jsonText.slice(i).match(/^\{\{\s*([a-zA-Z0-9_.\[\]"-]+)\s*\}\}/);
        if (match) {
          const varKey = match[1].trim();
          const { found, val: rawVal } = resolveVal(varKey);
          if (found) {
            let strVal = typeof rawVal === 'string'
              ? rawVal
              : (rawVal === null ? 'null' : (typeof rawVal === 'object' ? JSON.stringify(rawVal) : String(rawVal)));
            const escaped = JSON.stringify(strVal).slice(1, -1);
            result += escaped;
          } else {
            result += match[0];
          }
          i += match[0].length;
        } else {
          result += char;
          i++;
        }
      } else {
        result += char;
        i++;
      }
    } else {
      // Outside a string literal
      if (char === '"') {
        inString = true;
        result += char;
        i++;
      } else if (char === '{' && jsonText.startsWith('{{', i)) {
        // Variable OUTSIDE quotes: "count": {{ip_lookup.count}}
        const match = jsonText.slice(i).match(/^\{\{\s*([a-zA-Z0-9_.\[\]"-]+)\s*\}\}/);
        if (match) {
          const varKey = match[1].trim();
          const { found, val: rawVal } = resolveVal(varKey);
          if (found) {
            if (rawVal !== null && typeof rawVal === 'object') {
              result += JSON.stringify(rawVal);
            } else if (typeof rawVal === 'number' || typeof rawVal === 'boolean') {
              result += String(rawVal);
            } else if (rawVal === null) {
              result += 'null';
            } else {
              const str = String(rawVal).trim();
              try {
                JSON.parse(str);
                result += str;
              } catch {
                result += JSON.stringify(str);
              }
            }
          } else {
            result += match[0];
          }
          i += match[0].length;
        } else {
          result += char;
          i++;
        }
      } else {
        result += char;
        i++;
      }
    }
  }

  return result;
}

/**
 * Clones and interpolates a BodyConfig
 */
export function substituteInBody(
  body?: BodyConfig,
  variables?: ApiVariable[],
  activeGroup?: string,
  context?: NodeChainingContext,
): BodyConfig {
  if (!body) return { type: 'none' };
  return {
    ...body,
    rawJson: body.rawJson ? interpolateJsonString(body.rawJson, variables, activeGroup, context) : undefined,
    rawText: body.rawText ? interpolateVariables(body.rawText, variables, activeGroup, context) : undefined,
    formData: body.formData ? substituteInParamList(body.formData, variables, activeGroup, context) : undefined,
    urlEncoded: body.urlEncoded ? substituteInParamList(body.urlEncoded, variables, activeGroup, context) : undefined,
  };
}
