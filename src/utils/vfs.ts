export function buildVirtualFS(parsedData: any) {
  const vfs: Record<string, string> = {};
  
  function traverse(obj: any, parentFsPath: string) {
    if (typeof obj !== 'object' || obj === null) return;
    
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'string') {
        const isTs = key.endsWith('.ts') || key.endsWith('_ts_node');
        const isJs = key.endsWith('.js') || key.endsWith('_js_node');
        const isPy = key.endsWith('.py') || key.endsWith('_py_node');
        const isJson = key.endsWith('.json') || key.endsWith('_json_node');
        
        let ext = '';
        if (isTs) ext = '.ts';
        else if (isJs) ext = '.js';
        else if (isPy) ext = '.py';
        else if (isJson) ext = '.json';
        
        if (ext) {
           let baseName = key;
           if (baseName.endsWith('_ts_node')) baseName = baseName.replace(/_ts_node$/, '');
           else if (baseName.endsWith('_js_node')) baseName = baseName.replace(/_js_node$/, '');
           else if (baseName.endsWith('_py_node')) baseName = baseName.replace(/_py_node$/, '');
           
           if (!baseName.endsWith(ext)) baseName += ext;
           
           const fsPath = parentFsPath ? `${parentFsPath}/${baseName}` : `/${baseName}`;
           vfs[fsPath] = val;
        }
      } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        const nextPath = parentFsPath ? `${parentFsPath}/${key}` : `/${key}`;
        traverse(val, nextPath);
      }
    }
  }
  
  traverse(parsedData, '');
  return vfs;
}

export function getVirtualPath(objectPath: string, parsedData: any): string {
    const parts = objectPath.replace(/^root\.?/, '').split(/\.|(?=\[)/).filter(Boolean);
    let currentPath = '';
    
    let currentObj = parsedData;
    for (let i = 0; i < parts.length; i++) {
       let part = parts[i];
       if (part.startsWith('[')) {
           part = part.slice(1, -1);
       }
       
       const isLast = i === parts.length - 1;
       if (isLast) {
           let baseName = part;
           if (baseName.endsWith('_ts_node')) baseName = baseName.replace(/_ts_node$/, '.ts');
           else if (baseName.endsWith('_js_node')) baseName = baseName.replace(/_js_node$/, '.js');
           else if (baseName.endsWith('_py_node')) baseName = baseName.replace(/_py_node$/, '.py');
           currentPath += `/${baseName}`;
       } else {
           currentPath += `/${part}`;
       }
       if (currentObj) currentObj = currentObj[part];
    }
    return currentPath || '/__entry.ts';
}

export function resolveVirtualPath(request: string, currentPath: string): string {
    if (!request.startsWith('.')) return request; // non-relative package or absolute (will handle in python or just leave)
    
    const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/')) || '';
    const parts = currentDir.split('/').filter(Boolean);
    
    const requestParts = request.split('/');
    for (const part of requestParts) {
        if (part === '.') continue;
        if (part === '..') {
            if (parts.length > 0) parts.pop();
        } else {
            parts.push(part);
        }
    }
    
    return '/' + parts.join('/');
}
