/**
 * cURL Parser and Generator for Postman/Apidog-like API request handling.
 */

export interface KeyValueParam {
  id: string;
  enabled: boolean;
  key: string;
  value: string;
  description?: string;
}

export type AuthType = 'none' | 'bearer' | 'basic' | 'apiKey';

export interface AuthConfig {
  type: AuthType;
  bearerToken?: string;
  basicUsername?: string;
  basicPassword?: string;
  apiKeyName?: string;
  apiKeyValue?: string;
  apiKeyLocation?: 'header' | 'query';
}

export type BodyType = 'none' | 'json' | 'raw' | 'formData' | 'x-www-form-urlencoded';

export interface BodyConfig {
  type: BodyType;
  rawJson?: string;
  rawText?: string;
  formData?: KeyValueParam[];
  urlEncoded?: KeyValueParam[];
}

export interface ParsedCurlResult {
  url: string;
  method: string;
  params: KeyValueParam[];
  headers: KeyValueParam[];
  auth: AuthConfig;
  body: BodyConfig;
}

/**
 * Checks if a string looks like a cURL command
 */
export function isCurlCommand(input: string): boolean {
  if (!input) return false;
  const trimmed = input.trim();
  return /^curl(\.exe)?\s+/i.test(trimmed) || /^\s*curl\s+/i.test(trimmed);
}

/**
 * Tokenizes a command line string respecting single/double quotes and escapes
 */
function tokenizeArgs(command: string): string[] {
  const cleanCmd = command
    .replace(/\\\r?\n/g, ' ') // join backslash lines
    .replace(/^\s*curl(\.exe)?\s+/i, '') // strip leading curl
    .trim();

  const tokens: string[] = [];
  let current = '';
  let inDouble = false;
  let inSingle = false;
  let escape = false;

  for (let i = 0; i < cleanCmd.length; i++) {
    const char = cleanCmd[i];

    if (escape) {
      current += char;
      escape = false;
      continue;
    }

    if (char === '\\' && !inSingle) {
      escape = true;
      continue;
    }

    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }

    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }

    if (/\s/.test(char) && !inDouble && !inSingle) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Parses a cURL command string into an API configuration object
 */
export function parseCurl(command: string): ParsedCurlResult {
  const tokens = tokenizeArgs(command);

  let rawUrl = '';
  let method = 'GET';
  let methodExplicit = false;
  const headers: KeyValueParam[] = [];
  const params: KeyValueParam[] = [];
  let auth: AuthConfig = { type: 'none' };
  let body: BodyConfig = { type: 'none' };

  const dataParts: string[] = [];
  const urlEncodedParts: KeyValueParam[] = [];
  const formDataParts: KeyValueParam[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Method flag: -X, --request
    if (token === '-X' || token === '--request') {
      if (i + 1 < tokens.length) {
        method = tokens[++i].toUpperCase();
        methodExplicit = true;
      }
      continue;
    }
    if (/^-X[A-Z]+$/i.test(token)) {
      method = token.slice(2).toUpperCase();
      methodExplicit = true;
      continue;
    }

    // URL flag: --url
    if (token === '--url') {
      if (i + 1 < tokens.length) {
        rawUrl = tokens[++i];
      }
      continue;
    }

    // Header flag: -H, --header
    if (token === '-H' || token === '--header') {
      if (i + 1 < tokens.length) {
        const headerStr = tokens[++i];
        const colonIdx = headerStr.indexOf(':');
        if (colonIdx > -1) {
          const key = headerStr.slice(0, colonIdx).trim();
          const value = headerStr.slice(colonIdx + 1).trim();

          // Check if this is an Authorization header
          if (key.toLowerCase() === 'authorization') {
            if (/^bearer\s+/i.test(value)) {
              auth = {
                type: 'bearer',
                bearerToken: value.replace(/^bearer\s+/i, '').trim(),
              };
            } else if (/^basic\s+/i.test(value)) {
              const b64 = value.replace(/^basic\s+/i, '').trim();
              try {
                const decoded = atob(b64);
                const [u, p] = decoded.split(':');
                auth = {
                  type: 'basic',
                  basicUsername: u,
                  basicPassword: p || '',
                };
              } catch {
                // If decoding fails, retain as standard header
                headers.push({
                  id: Math.random().toString(36).substring(2, 9),
                  enabled: true,
                  key,
                  value,
                });
              }
            } else {
              headers.push({
                id: Math.random().toString(36).substring(2, 9),
                enabled: true,
                key,
                value,
              });
            }
          } else {
            headers.push({
              id: Math.random().toString(36).substring(2, 9),
              enabled: true,
              key,
              value,
            });
          }
        }
      }
      continue;
    }

    // User auth flag: -u, --user
    if (token === '-u' || token === '--user') {
      if (i + 1 < tokens.length) {
        const cred = tokens[++i];
        const [u, p] = cred.split(':');
        auth = {
          type: 'basic',
          basicUsername: u || '',
          basicPassword: p || '',
        };
      }
      continue;
    }

    // Data flags: -d, --data, --data-raw, --data-binary, --data-ascii
    if (
      token === '-d' ||
      token === '--data' ||
      token === '--data-raw' ||
      token === '--data-binary' ||
      token === '--data-ascii'
    ) {
      if (i + 1 < tokens.length) {
        dataParts.push(tokens[++i]);
      }
      continue;
    }

    // URL encoded data: --data-urlencode
    if (token === '--data-urlencode') {
      if (i + 1 < tokens.length) {
        const item = tokens[++i];
        const eqIdx = item.indexOf('=');
        if (eqIdx > -1) {
          urlEncodedParts.push({
            id: Math.random().toString(36).substring(2, 9),
            enabled: true,
            key: item.slice(0, eqIdx).trim(),
            value: item.slice(eqIdx + 1).trim(),
          });
        } else {
          urlEncodedParts.push({
            id: Math.random().toString(36).substring(2, 9),
            enabled: true,
            key: item.trim(),
            value: '',
          });
        }
      }
      continue;
    }

    // Form data: -F, --form
    if (token === '-F' || token === '--form') {
      if (i + 1 < tokens.length) {
        const item = tokens[++i];
        const eqIdx = item.indexOf('=');
        if (eqIdx > -1) {
          formDataParts.push({
            id: Math.random().toString(36).substring(2, 9),
            enabled: true,
            key: item.slice(0, eqIdx).trim(),
            value: item.slice(eqIdx + 1).trim(),
          });
        }
      }
      continue;
    }

    // Naked argument (could be the URL)
    if (!token.startsWith('-') && !rawUrl) {
      rawUrl = token;
    }
  }

  // If data was passed and method wasn't explicitly set, default to POST
  if (
    !methodExplicit &&
    (dataParts.length > 0 || urlEncodedParts.length > 0 || formDataParts.length > 0)
  ) {
    method = 'POST';
  }

  // Parse URL & Query params
  let cleanUrl = rawUrl;
  if (rawUrl) {
    try {
      // If no protocol, prefix http:// temporarily to parse query string
      const toParse = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
      const parsedUrl = new URL(toParse);

      parsedUrl.searchParams.forEach((val, key) => {
        params.push({
          id: Math.random().toString(36).substring(2, 9),
          enabled: true,
          key,
          value: val,
        });
      });

      // Retain the base URL (without query params)
      cleanUrl = rawUrl.split('?')[0];
    } catch {
      cleanUrl = rawUrl;
    }
  }

  // Detect body type and payload
  const hasContentType = headers.find(
    (h) => h.key.toLowerCase() === 'content-type'
  );
  const contentTypeVal = hasContentType ? hasContentType.value.toLowerCase() : '';

  if (formDataParts.length > 0) {
    body = {
      type: 'formData',
      formData: formDataParts,
    };
  } else if (urlEncodedParts.length > 0 || contentTypeVal.includes('x-www-form-urlencoded')) {
    if (urlEncodedParts.length > 0) {
      body = {
        type: 'x-www-form-urlencoded',
        urlEncoded: urlEncodedParts,
      };
    } else if (dataParts.length > 0) {
      const combined = dataParts.join('&');
      const pairs: KeyValueParam[] = [];
      const searchParams = new URLSearchParams(combined);
      searchParams.forEach((val, key) => {
        pairs.push({
          id: Math.random().toString(36).substring(2, 9),
          enabled: true,
          key,
          value: val,
        });
      });
      body = {
        type: 'x-www-form-urlencoded',
        urlEncoded: pairs.length > 0 ? pairs : undefined,
      };
    }
  } else if (dataParts.length > 0) {
    const rawData = dataParts.join('\n');
    let isJson = false;
    let formattedJson = rawData;

    try {
      const parsed = JSON.parse(rawData);
      formattedJson = JSON.stringify(parsed, null, 2);
      isJson = true;
    } catch {
      if (contentTypeVal.includes('application/json')) {
        isJson = true;
      }
    }

    if (isJson) {
      body = {
        type: 'json',
        rawJson: formattedJson,
      };
      // Ensure Content-Type is present
      if (!hasContentType) {
        headers.push({
          id: Math.random().toString(36).substring(2, 9),
          enabled: true,
          key: 'Content-Type',
          value: 'application/json',
        });
      }
    } else {
      body = {
        type: 'raw',
        rawText: rawData,
      };
    }
  }

  return {
    url: cleanUrl || rawUrl,
    method,
    params,
    headers,
    auth,
    body,
  };
}

/**
 * Builds a cURL command from the current API configuration
 */
export function buildCurl(
  baseUrl: string,
  method: string,
  params?: KeyValueParam[],
  headers?: KeyValueParam[],
  auth?: AuthConfig,
  body?: BodyConfig
): string {
  // 1. Construct final URL with query parameters
  let fullUrl = baseUrl.trim();
  if (params && params.length > 0) {
    const enabledParams = params.filter((p) => p.enabled && p.key.trim());
    if (enabledParams.length > 0) {
      const sp = new URLSearchParams();
      enabledParams.forEach((p) => sp.append(p.key.trim(), p.value));
      const queryString = sp.toString();
      if (queryString) {
        fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString;
      }
    }
  }

  const lines: string[] = [`curl -X ${method.toUpperCase()} "${fullUrl}"`];

  // 2. Auth headers
  if (auth && auth.type !== 'none') {
    if (auth.type === 'bearer' && auth.bearerToken) {
      lines.push(`  -H "Authorization: Bearer ${auth.bearerToken.trim()}"`);
    } else if (auth.type === 'basic') {
      const u = auth.basicUsername || '';
      const p = auth.basicPassword || '';
      lines.push(`  -u "${u}:${p}"`);
    } else if (auth.type === 'apiKey' && auth.apiKeyName && auth.apiKeyValue) {
      if (auth.apiKeyLocation === 'header') {
        lines.push(`  -H "${auth.apiKeyName.trim()}: ${auth.apiKeyValue.trim()}"`);
      }
    }
  }

  // 3. Custom headers
  if (headers && headers.length > 0) {
    headers
      .filter((h) => h.enabled && h.key.trim())
      .forEach((h) => {
        lines.push(`  -H "${h.key.trim()}: ${h.value.trim()}"`);
      });
  }

  // 4. Body
  if (body && body.type !== 'none') {
    if (body.type === 'json' && body.rawJson) {
      // Escape double quotes inside json
      const escaped = body.rawJson.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      lines.push(`  -d "${escaped}"`);
    } else if (body.type === 'raw' && body.rawText) {
      lines.push(`  -d "${body.rawText.replace(/"/g, '\\"')}"`);
    } else if (body.type === 'x-www-form-urlencoded' && body.urlEncoded) {
      body.urlEncoded
        .filter((item) => item.enabled && item.key.trim())
        .forEach((item) => {
          lines.push(
            `  --data-urlencode "${item.key.trim()}=${item.value.trim()}"`
          );
        });
    } else if (body.type === 'formData' && body.formData) {
      body.formData
        .filter((item) => item.enabled && item.key.trim())
        .forEach((item) => {
          lines.push(`  -F "${item.key.trim()}=${item.value.trim()}"`);
        });
    }
  }

  return lines.join(' \\\n');
}

/**
 * Resolves a nested key or dot-bracket path on any object/array.
 * Examples: "message.content", "choices[0].message.content", "data.items.0.title", "$.response"
 */
export function getNestedValue(data: any, path: string): any {
  if (data === null || data === undefined) return undefined;
  if (!path || typeof path !== 'string') return data;

  const cleanPath = path
    .trim()
    .replace(/^\$\.?/, '') // Remove leading $ or $.
    .replace(/\[(\d+)\]/g, '.$1') // Convert [0] to .0
    .replace(/\["([^"]+)"\]/g, '.$1') // Convert ["key"] to .key
    .replace(/\['([^']+)'\]/g, '.$1'); // Convert ['key'] to .key

  if (!cleanPath) return data;

  const parts = cleanPath.split('.').filter(Boolean);
  let current: any = data;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = current[part];
  }

  return current;
}

/**
 * Discovers candidate extraction paths from a response data object.
 * Identifies common LLM and API output keys with preview values.
 */
export function detectCandidatePaths(data: any): { path: string; label: string; preview: string }[] {
  if (!data || typeof data !== 'object') return [];

  const candidates: { path: string; label: string; preview: string }[] = [];
  const seen = new Set<string>();

  const addCandidate = (path: string, label: string) => {
    if (seen.has(path)) return;
    const val = getNestedValue(data, path);
    if (val !== undefined) {
      seen.add(path);
      let preview = '';
      if (typeof val === 'string') {
        preview = val.length > 50 ? val.slice(0, 50) + '…' : val;
      } else if (Array.isArray(val)) {
        preview = `Array(${val.length})`;
      } else if (typeof val === 'object' && val !== null) {
        preview = `{${Object.keys(val).slice(0, 3).join(', ')}${Object.keys(val).length > 3 ? '…' : ''}}`;
      } else {
        preview = String(val);
      }
      candidates.push({ path, label, preview });
    }
  };

  // 1. LLM common paths
  if (data._combinedMessage) {
    addCandidate('_combinedMessage', 'Combined Stream Output');
  }
  addCandidate('message.content', 'Ollama / Chat message');
  addCandidate('response', 'Ollama generate response');
  addCandidate('choices[0].message.content', 'OpenAI message content');
  addCandidate('choices[0].delta.content', 'OpenAI stream chunk');
  addCandidate('candidates[0].content.parts[0].text', 'Gemini text');
  addCandidate('output.text', 'Claude / Bedrock text');

  if (Array.isArray(data.chunks) && data.chunks.length > 0) {
    if (data.chunks[0]?.message?.content !== undefined) {
      addCandidate('chunks[0].message.content', 'First chunk message');
    }
    if (data.chunks[0]?.response !== undefined) {
      addCandidate('chunks[0].response', 'First chunk response');
    }
  }

  // 2. Generic top-level and 2nd-level keys
  if (!Array.isArray(data)) {
    const keys = Object.keys(data);
    for (const k of keys.slice(0, 10)) {
      if (k.startsWith('_')) continue;
      addCandidate(k, `.${k}`);
      if (data[k] && typeof data[k] === 'object' && !Array.isArray(data[k])) {
        for (const subKey of Object.keys(data[k]).slice(0, 5)) {
          if (subKey.startsWith('_')) continue;
          addCandidate(`${k}.${subKey}`, `.${k}.${subKey}`);
        }
      }
    }
  }

  return candidates;
}
