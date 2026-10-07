import type { KeyValueParam, AuthConfig, BodyConfig } from './curlParser';

export interface ApiVariable {
  id: string;
  enabled: boolean;
  key: string;
  value: string;
  group: string;
  description?: string;
  isSecret?: boolean;
}

export const DEFAULT_VARIABLE_GROUPS = ['All', 'General', 'Auth', 'Servers', 'Environment'] as const;

/**
 * Replaces `{{var}}` and `{{group.var}}` tokens in a given string with variable values.
 * Supports up to 3 passes for nested variable references (e.g. baseUrl = "http://localhost:{{port}}").
 */
export function interpolateVariables(
  text: string,
  variables?: ApiVariable[],
  activeGroup?: string,
): string {
  if (!text || typeof text !== 'string') return text || '';
  if (!variables || !Array.isArray(variables) || variables.length === 0) return text;

  const enabledVars = variables.filter((v) => v.enabled !== false && v.key && v.key.trim().length > 0);
  if (enabledVars.length === 0) return text;

  // Build key-value map
  const varMap = new Map<string, string>();

  // Pass 1: add general keys and group-prefixed keys (e.g., auth.token, ollama.port)
  for (const v of enabledVars) {
    const trimmedKey = v.key.trim();
    varMap.set(trimmedKey, v.value);
    if (v.group && v.group.trim()) {
      const trimmedGroup = v.group.trim();
      varMap.set(`${trimmedGroup}.${trimmedKey}`, v.value);
      varMap.set(`${trimmedGroup.toLowerCase()}.${trimmedKey}`, v.value);
    }
  }

  // Pass 2: if an active group is selected (and not 'All'), override matching keys with the active group's values
  if (activeGroup && activeGroup !== 'All') {
    const activeLower = activeGroup.trim().toLowerCase();
    for (const v of enabledVars) {
      if (v.group && v.group.trim().toLowerCase() === activeLower) {
        varMap.set(v.key.trim(), v.value);
      }
    }
  }

  // Multi-pass replacement (up to 3 passes to handle nested variable definitions without infinite loops)
  let result = text;
  for (let pass = 0; pass < 3; pass++) {
    const next = result.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, key) => {
      const trimmedKey = String(key).trim();
      if (varMap.has(trimmedKey)) {
        return varMap.get(trimmedKey)!;
      }
      return match;
    });
    if (next === result) break;
    result = next;
  }

  return result;
}

/**
 * Extracts all `{{var}}` variable names from a string
 */
export function extractVariableNames(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  const matches = text.matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g);
  const names = new Set<string>();
  for (const m of matches) {
    if (m[1]) names.add(m[1].trim());
  }
  return Array.from(names);
}

/**
 * Returns detailed analysis of all variable usages in a string,
 * showing whether each variable is resolved or missing.
 */
export function analyzeVariablesInText(
  text: string,
  variables?: ApiVariable[],
  activeGroup?: string,
): { key: string; isResolved: boolean; value?: string; group?: string }[] {
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
    const found = varMap.get(key);
    return {
      key,
      isResolved: Boolean(found),
      value: found?.value,
      group: found?.group,
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
): KeyValueParam[] {
  if (!list || !Array.isArray(list)) return [];
  return list.map((item) => ({
    ...item,
    key: interpolateVariables(item.key, variables, activeGroup),
    value: interpolateVariables(item.value, variables, activeGroup),
  }));
}

/**
 * Clones and interpolates an AuthConfig
 */
export function substituteInAuth(
  auth?: AuthConfig,
  variables?: ApiVariable[],
  activeGroup?: string,
): AuthConfig {
  if (!auth) return { type: 'none' };
  return {
    ...auth,
    bearerToken: auth.bearerToken ? interpolateVariables(auth.bearerToken, variables, activeGroup) : undefined,
    basicUsername: auth.basicUsername ? interpolateVariables(auth.basicUsername, variables, activeGroup) : undefined,
    basicPassword: auth.basicPassword ? interpolateVariables(auth.basicPassword, variables, activeGroup) : undefined,
    apiKeyName: auth.apiKeyName ? interpolateVariables(auth.apiKeyName, variables, activeGroup) : undefined,
    apiKeyValue: auth.apiKeyValue ? interpolateVariables(auth.apiKeyValue, variables, activeGroup) : undefined,
  };
}

/**
 * Smartly interpolates variables inside a JSON string.
 * - If {{var}} appears OUTSIDE quotes (e.g. `"model": {{model}}`), it formats the value
 *   as valid JSON (wrapping plain strings in quotes, or preserving numbers/booleans/null/objects/arrays).
 * - If {{var}} appears INSIDE quotes (e.g. `"model": "{{model}}"` or `"msg": "Hello {{name}}"`),
 *   it inserts the value with proper JSON string character escaping without adding extra quotes.
 */
export function interpolateJsonString(
  jsonText: string,
  variables?: ApiVariable[],
  activeGroup?: string,
): string {
  if (!jsonText || typeof jsonText !== 'string') return jsonText || '';
  if (!variables || !Array.isArray(variables) || variables.length === 0) return jsonText;

  const enabledVars = variables.filter((v) => v.enabled !== false && v.key && v.key.trim().length > 0);
  if (enabledVars.length === 0) return jsonText;

  // Build key-value map
  const varMap = new Map<string, string>();
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

  // Iterate character by character to track whether we are inside a string literal
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
        const match = jsonText.slice(i).match(/^\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/);
        if (match) {
          const varKey = match[1].trim();
          if (varMap.has(varKey)) {
            const rawVal = varMap.get(varKey)!;
            // JSON string escaping (escape quotes and backslashes so the enclosing string remains valid)
            const escaped = JSON.stringify(rawVal).slice(1, -1);
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
        // Variable OUTSIDE quotes: "model": {{model}}
        const match = jsonText.slice(i).match(/^\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/);
        if (match) {
          const varKey = match[1].trim();
          if (varMap.has(varKey)) {
            const rawVal = varMap.get(varKey)!;
            const trimmed = rawVal.trim();
            let formatted = trimmed;
            try {
              // Check if rawVal is already valid JSON (number, boolean, null, object, array, or quoted string)
              JSON.parse(trimmed);
              formatted = trimmed;
            } catch {
              // If not valid JSON (e.g. plain string llama3.2:latest), stringify it so it is valid JSON!
              formatted = JSON.stringify(rawVal);
            }
            result += formatted;
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
): BodyConfig {
  if (!body) return { type: 'none' };
  return {
    ...body,
    rawJson: body.rawJson ? interpolateJsonString(body.rawJson, variables, activeGroup) : undefined,
    rawText: body.rawText ? interpolateVariables(body.rawText, variables, activeGroup) : undefined,
    formData: body.formData ? substituteInParamList(body.formData, variables, activeGroup) : undefined,
    urlEncoded: body.urlEncoded ? substituteInParamList(body.urlEncoded, variables, activeGroup) : undefined,
  };
}
