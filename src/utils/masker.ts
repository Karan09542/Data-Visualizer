const originalDataRegistry = new Map<string, any>();
let maskCounter = 0;

/** Threshold for truncating string values in the raw editor (in characters) */
const LARGE_VALUE_THRESHOLD = 500;
/** How many characters of the original value to show as preview */
const PREVIEW_LENGTH = 40;

/**
 * Unique marker used to identify truncated values in the editor.
 * Format: ‹SHOW_MORE:id:sizeLabel›
 * The marker is embedded at the end of the truncated string value so that
 * Monaco decorations can detect and render a "Show more" widget.
 */
const SHOW_MORE_PREFIX = '\u2039SHOW_MORE:';
const SHOW_MORE_SUFFIX = '\u203A';
const SHOW_LESS_PREFIX = '\u2039SHOW_LESS:';
const SHOW_LESS_SUFFIX = '\u203A';

/** Registry mapping mask id → original full string (without surrounding quotes) */
const largeValueRegistry = new Map<number, string>();

/**
 * Set of mask IDs that the user has expanded (clicked "Show more").
 * These values won't be re-masked on subsequent maskCodeString calls.
 */
const expandedIds = new Set<number>();

/**
 * Reverse lookup: original content hash → mask id, to find existing IDs
 * for the same content across re-masks.
 */
const contentToIdMap = new Map<string, number>();

/** Create a stable key from string content (first 100 chars + length) */
function contentKey(s: string): string {
  return `${s.length}:${s.slice(0, 100)}`;
}

export function isMassiveData(value: string): boolean {
  if (typeof value !== 'string') return false;
  return value.length > 500 && (
    value.startsWith('data:image/') || 
    value.startsWith('data:application/') || 
    value.startsWith('data:audio/') || 
    value.startsWith('data:video/') || 
    value.startsWith('data:model/')
  );
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

/**
 * Get or create a stable ID for a given content string.
 * If the same content was seen before, reuse its ID.
 */
function getOrCreateId(content: string): number {
  const key = contentKey(content);
  const existing = contentToIdMap.get(key);
  if (existing !== undefined) return existing;
  maskCounter++;
  const id = maskCounter;
  contentToIdMap.set(key, id);
  return id;
}

/**
 * Masks massive data strings (like base64 URLs) AND any large string values
 * in the raw JSON code string.
 * Large values are truncated to a short preview followed by a SHOW_MORE marker.
 * Values that the user has expanded (via expandedIds) are left as-is.
 * This ensures the Raw Editor doesn't freeze with massive data.
 */
export function maskCodeString(codeStr: string): string {
  if (!codeStr || typeof codeStr !== 'string') return codeStr;
  
  // First pass: mask data: URIs
  let result = codeStr.replace(/"data:([^;]+);([^"]{500,})"/g, (match) => {
    const innerContent = match.slice(1, -1);
    const id = getOrCreateId(innerContent);
    
    // If user expanded this value, keep full text but add SHOW_LESS marker
    if (expandedIds.has(id)) {
      largeValueRegistry.set(id, innerContent);
      const sizeLabel = formatSize(innerContent.length);
      return `"${innerContent}${SHOW_LESS_PREFIX}${id}:${sizeLabel}${SHOW_LESS_SUFFIX}"`;
    }
    
    const sizeLabel = formatSize(innerContent.length);
    // Store original without quotes
    largeValueRegistry.set(id, innerContent);
    // Also keep in old registry for backward compat
    const typeMatch = innerContent.match(/^data:([^;]+)/);
    const oldPlaceholder = `[Massive Data: ${typeMatch?.[1] ?? 'binary'} - ${(innerContent.length / 1024 / 1024).toFixed(2)}MB (DO NOT EDIT)] #${id}`;
    originalDataRegistry.set(oldPlaceholder, innerContent);
    
    // Preview: show first PREVIEW_LENGTH chars
    const preview = innerContent.slice(0, PREVIEW_LENGTH).replace(/"/g, '\\"');
    return `"${preview}${SHOW_MORE_PREFIX}${id}:${sizeLabel}${SHOW_MORE_SUFFIX}"`;
  });
  
  // Second pass: mask any remaining large string values (>LARGE_VALUE_THRESHOLD chars)
  result = result.replace(/"([^"\\]|\\.){500,}"/g, (match) => {
    // Skip if already has our marker (from first pass or previous expansion)
    if (match.includes(SHOW_MORE_PREFIX) || match.includes(SHOW_LESS_PREFIX)) return match;
    
    const innerLen = match.length - 2;
    if (innerLen < LARGE_VALUE_THRESHOLD) return match;
    
    const innerContent = match.slice(1, -1);
    const id = getOrCreateId(innerContent);
    
    // If user expanded this value, keep full text but add SHOW_LESS marker
    if (expandedIds.has(id)) {
      largeValueRegistry.set(id, innerContent);
      const sizeLabel = formatSize(innerLen);
      return `"${innerContent}${SHOW_LESS_PREFIX}${id}:${sizeLabel}${SHOW_LESS_SUFFIX}"`;
    }
    
    const sizeLabel = formatSize(innerLen);
    largeValueRegistry.set(id, innerContent);
    
    // Preview: first PREVIEW_LENGTH chars, keeping escapes intact
    let preview = '';
    let charCount = 0;
    for (let i = 0; i < innerContent.length && charCount < PREVIEW_LENGTH; i++) {
      if (innerContent[i] === '\\' && i + 1 < innerContent.length) {
        preview += innerContent[i] + innerContent[i + 1];
        i++;
      } else {
        preview += innerContent[i];
      }
      charCount++;
    }
    
    return `"${preview}${SHOW_MORE_PREFIX}${id}:${sizeLabel}${SHOW_MORE_SUFFIX}"`;
  });
  
  return result;
}

/** Raw marker strings for external use */
export const SHOW_MORE_MARKERS = {
  PREFIX: SHOW_MORE_PREFIX,
  SUFFIX: SHOW_MORE_SUFFIX,
  LESS_PREFIX: SHOW_LESS_PREFIX,
  LESS_SUFFIX: SHOW_LESS_SUFFIX,
};

/**
 * Get the original full value for a given mask id.
 */
export function getLargeValueOriginal(id: number): string | undefined {
  return largeValueRegistry.get(id);
}

/**
 * Mark a value as expanded so it won't be re-masked.
 */
export function markAsExpanded(id: number): void {
  expandedIds.add(id);
}

/**
 * Mark a value as collapsed so it will be masked again.
 */
export function markAsCollapsed(id: number): void {
  expandedIds.delete(id);
}

/**
 * Expand a single masked value in the code string by its id.
 * Returns the code string with that one value restored.
 */
export function expandSingleValue(codeStr: string, id: number): string {
  const original = largeValueRegistry.get(id);
  if (!original) return codeStr;
  
  // Build escaped regex pattern for the marker prefix/suffix
  const escapedPrefix = SHOW_MORE_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedSuffix = SHOW_MORE_SUFFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Find the marker for this specific id and replace the truncated string with the original
  const markerPattern = new RegExp(
    `"([^"]*?)${escapedPrefix}${id}:[^${escapedSuffix}]*${escapedSuffix}"`,
  );
  
  return codeStr.replace(markerPattern, `"${original}"`);
}

/**
 * Unmasks the raw JSON code string by restoring the original massive strings.
 */
export function unmaskCodeString(codeStr: string): string {
  if (!codeStr || typeof codeStr !== 'string') return codeStr;
  
  let result = codeStr;
  
  // Build escaped regex pattern for the marker prefix/suffix
  const escapedPrefix = SHOW_MORE_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedSuffix = SHOW_MORE_SUFFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedLessPrefix = SHOW_LESS_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedLessSuffix = SHOW_LESS_SUFFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // First: expand all SHOW_MORE markers (truncated → original)
  const markerRegex = new RegExp(
    `"([^"]*?)${escapedPrefix}(\\d+):[^${escapedSuffix}]*${escapedSuffix}"`,
    'g'
  );
  result = result.replace(markerRegex, (_match, _preview, idStr) => {
    const id = parseInt(idStr, 10);
    const original = largeValueRegistry.get(id);
    if (original) return `"${original}"`;
    return _match;
  });
  
  // Second: strip all SHOW_LESS markers (expanded values have the marker appended)
  const lessMarkerRegex = new RegExp(
    `${escapedLessPrefix}\\d+:[^${escapedLessSuffix}]*${escapedLessSuffix}`,
    'g'
  );
  result = result.replace(lessMarkerRegex, '');
  
  // Then: legacy unmask for any old-format placeholders
  for (const [placeholder, original] of originalDataRegistry.entries()) {
    const searchStr = `"${placeholder}"`;
    if (result.includes(searchStr)) {
      result = result.split(searchStr).join(`"${original}"`);
    }
  }
  return result;
}

/**
 * Recursively masks massive arrays, objects, or strings in a parsed JSON object.
 * This ensures GUI Editor and File Explorer stay extremely fast.
 */
export function maskParsedData(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    if (isMassiveData(obj)) {
      const typeMatch = obj.match(/^data:([^;]+);/);
      const type = typeMatch ? typeMatch[1] : 'binary';
      const sizeMb = (obj.length / 1024 / 1024).toFixed(2);
      maskCounter++;
      const placeholder = `[Massive Data: ${type} - ${sizeMb}MB (DO NOT EDIT)] #${maskCounter}`;
      originalDataRegistry.set(placeholder, obj);
      return placeholder;
    }
    
    if (obj.length > 10000) {
      const sizeKb = (obj.length / 1024).toFixed(1);
      maskCounter++;
      const placeholder = `[Massive Text Data - ${sizeKb}KB (DO NOT EDIT)] #${maskCounter}`;
      originalDataRegistry.set(placeholder, obj);
      return placeholder;
    }
    return obj;
  }
  
  if (Array.isArray(obj)) {
    if (obj.length > 200) {
      maskCounter++;
      const placeholder = `[Massive Array - ${obj.length} items (DO NOT EDIT)] #${maskCounter}`;
      originalDataRegistry.set(placeholder, obj);
      return placeholder;
    }
    
    let changed = false;
    const newArr = obj.map(item => {
      const masked = maskParsedData(item);
      if (masked !== item) changed = true;
      return masked;
    });
    return changed ? newArr : obj;
  }
  
  if (typeof obj === 'object') {
    const keys = Object.keys(obj);
    if (keys.length > 500) {
      maskCounter++;
      const placeholder = `[Massive Object - ${keys.length} keys (DO NOT EDIT)] #${maskCounter}`;
      originalDataRegistry.set(placeholder, obj);
      return placeholder;
    }
    
    let changed = false;
    const newObj: any = {};
    for (const key of keys) {
      const masked = maskParsedData(obj[key]);
      newObj[key] = masked;
      if (masked !== obj[key]) changed = true;
    }
    return changed ? newObj : obj;
  }
  
  return obj;
}

/**
 * Unmasks a parsed JSON object by restoring placeholders to their original values.
 */
export function unmaskParsedData(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    if (originalDataRegistry.has(obj)) {
      return originalDataRegistry.get(obj);
    }
    return obj;
  }
  
  if (Array.isArray(obj)) {
    let changed = false;
    const newArr = obj.map(item => {
      const unmasked = unmaskParsedData(item);
      if (unmasked !== item) changed = true;
      return unmasked;
    });
    return changed ? newArr : obj;
  }
  
  if (typeof obj === 'object') {
    let changed = false;
    const newObj: any = {};
    for (const key in obj) {
      const unmasked = unmaskParsedData(obj[key]);
      newObj[key] = unmasked;
      if (unmasked !== obj[key]) changed = true;
    }
    return changed ? newObj : obj;
  }
  
  return obj;
}
