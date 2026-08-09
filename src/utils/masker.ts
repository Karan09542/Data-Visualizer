const originalDataRegistry = new Map<string, any>();
let maskCounter = 0;

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

/**
 * Masks massive data strings (like base64 URLs) in the raw JSON code string.
 * This ensures the Raw Editor doesn't freeze with massive data.
 */
export function maskCodeString(codeStr: string): string {
  if (!codeStr || typeof codeStr !== 'string') return codeStr;
  
  // Regex to find "data:MIME;base64,DATA"
  return codeStr.replace(/"data:([^;]+);([^"]{500,})"/g, (match, type, rest) => {
    const sizeMb = (match.length / 1024 / 1024).toFixed(2);
    maskCounter++;
    const placeholder = `"[Massive Data: ${type} - ${sizeMb}MB (DO NOT EDIT)] #${maskCounter}"`;
    
    // Store original match without quotes
    originalDataRegistry.set(placeholder.slice(1, -1), match.slice(1, -1));
    return placeholder;
  });
}

/**
 * Unmasks the raw JSON code string by restoring the original massive strings.
 */
export function unmaskCodeString(codeStr: string): string {
  if (!codeStr || typeof codeStr !== 'string') return codeStr;
  
  let result = codeStr;
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
