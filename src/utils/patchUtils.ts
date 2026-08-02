import * as jsonpatch from 'fast-json-patch';
import { jsonrepair } from 'jsonrepair';

/**
 * Safely resolves applyPatch from fast-json-patch module in both ESM and CJS environments.
 */
function safeApplyPatch(doc: any, patch: any[]): { newDocument: any; [key: string]: any } {
  const patchFn =
    (jsonpatch as any).applyPatch ||
    (jsonpatch as any).default?.applyPatch;

  if (typeof patchFn === 'function') {
    return patchFn(doc, patch);
  }

  // Direct manual fallback if fast-json-patch function resolution fails
  return manualApplyPatch(doc, patch);
}

/**
 * Direct fallback manual JSON patch executor for basic RFC 6902 ops.
 */
function manualApplyPatch(doc: any, patch: any[]): { newDocument: any } {
  let current = JSON.parse(JSON.stringify(doc));

  for (const op of patch) {
    if (!op || typeof op !== 'object') continue;
    const action = (op.op || 'replace').toLowerCase();
    const path = String(op.path || '').trim();
    const val = op.value;

    if (action === 'add' || action === 'replace') {
      if (path === '' || path === '/') {
        current = val;
      } else if (Array.isArray(current)) {
        if (path === '/-') {
          current.push(val);
        } else {
          const segs = path.replace(/^\//, '').split('/');
          const idx = parseInt(segs[0], 10);
          if (!isNaN(idx)) {
            if (idx >= current.length) {
              current.push(val);
            } else if (segs.length > 1 && current[idx] && typeof current[idx] === 'object') {
              const subKey = segs.slice(1).join('/');
              current[idx][subKey] = val;
            } else {
              current[idx] = val;
            }
          } else {
            current.push(val);
          }
        }
      } else if (typeof current === 'object' && current !== null) {
        const segs = path.replace(/^\//, '').split('/');
        const key = segs[segs.length - 1] || 'value';
        current[key] = val;
      }
    }
  }

  return { newDocument: current };
}

/**
 * Repairs a string value if it contains stringified or malformed JSON.
 */
export function repairJSONValue(val: any): any {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return JSON.parse(trimmed);
      } catch {
        try {
          const repaired = jsonrepair(trimmed);
          return JSON.parse(repaired);
        } catch {
          return val;
        }
      }
    }
  }
  return val;
}

/**
 * Auto-corrects patch operation paths based on document structure (array vs object).
 */
export function autoCorrectPatchPaths(doc: any, patch: any[]): any[] {
  if (!Array.isArray(patch) || patch.length === 0 || !doc || typeof doc !== 'object') {
    return patch;
  }

  const isDocArray = Array.isArray(doc);

  return patch.map((op) => {
    if (!op || typeof op.path !== 'string') return op;

    let path = op.path.trim();

    const repairedValue = op.value !== undefined ? repairJSONValue(op.value) : undefined;
    const cleanOp = repairedValue !== undefined ? { ...op, value: repairedValue } : { ...op };

    if (path === '' || path === '/') return { ...cleanOp, path: '' };

    const segments = path.startsWith('/') ? path.slice(1).split('/') : path.split('/');
    const firstSegment = segments[0];

    if (isDocArray) {
      const isIntegerIndex = /^\d+$/.test(firstSegment) || firstSegment === '-';
      if (!isIntegerIndex) {
        let targetIndex = 0;
        for (let i = 0; i < doc.length; i++) {
          if (doc[i] && typeof doc[i] === 'object' && firstSegment in doc[i]) {
            targetIndex = i;
            break;
          }
        }
        const newSegments = [String(targetIndex), ...segments];
        const newPath = '/' + newSegments.join('/');
        return { ...cleanOp, path: newPath };
      }
    } else {
      const isIntegerIndex = /^\d+$/.test(firstSegment);
      if (isIntegerIndex && segments.length > 1) {
        const nextSegment = segments[1];
        if (nextSegment in doc) {
          const newPath = '/' + segments.slice(1).join('/');
          return { ...cleanOp, path: newPath };
        }
      }
    }

    const finalPath = path.startsWith('/') ? path : '/' + path;
    return { ...cleanOp, path: finalPath };
  });
}

/**
 * Smartly applies a JSON Patch array to a document, auto-correcting paths
 * and handling sequential fallbacks so patch application never fails.
 */
export function applyPatchSmart(doc: any, patch: any[]): { newDocument: any; success: boolean } {
  if (doc === null || doc === undefined) {
    if (Array.isArray(patch) && patch.length > 0 && patch[0].value !== undefined) {
      return { newDocument: patch[0].value, success: true };
    }
    return { newDocument: {}, success: false };
  }

  if (!Array.isArray(patch) || patch.length === 0) {
    return { newDocument: doc, success: true };
  }

  // Attempt 1: Full array application via safeApplyPatch
  try {
    const cloned = JSON.parse(JSON.stringify(doc));
    const res = safeApplyPatch(cloned, patch);
    if (res && res.newDocument !== undefined) {
      return { newDocument: res.newDocument, success: true };
    }
  } catch {
    // Continue to sequential step-by-step application
  }

  // Attempt 2: Sequential step-by-step application with fallbacks
  let currentDoc = JSON.parse(JSON.stringify(doc));
  let anySuccess = false;

  for (const singleOp of patch) {
    if (!singleOp) continue;
    try {
      const res = safeApplyPatch(currentDoc, [singleOp]);
      if (res && res.newDocument !== undefined) {
        currentDoc = res.newDocument;
        anySuccess = true;
        continue;
      }
    } catch {
      // Step failed, try auto-corrected singleOp
    }

    try {
      const corrected = autoCorrectPatchPaths(currentDoc, [singleOp]);
      const res2 = safeApplyPatch(currentDoc, corrected);
      if (res2 && res2.newDocument !== undefined) {
        currentDoc = res2.newDocument;
        anySuccess = true;
        continue;
      }
    } catch {
      // Fallback manual execution for this single operation
    }

    try {
      const manualRes = manualApplyPatch(currentDoc, [singleOp]);
      currentDoc = manualRes.newDocument;
      anySuccess = true;
    } catch {
      // Ignore single step failure
    }
  }

  return { newDocument: currentDoc, success: anySuccess };
}

/**
 * Deeply merges newDoc into baseDoc.
 * - Objects: Recursive key merge.
 * - Arrays: If elements are objects with matching 'id', 'key', 'name', 'path', merge them; otherwise append/union.
 * - Primitives: Overwrite.
 */
export function mergeJSON(baseDoc: any, newDoc: any): any {
  if (baseDoc === null || baseDoc === undefined) {
    return JSON.parse(JSON.stringify(newDoc));
  }
  if (newDoc === null || newDoc === undefined) {
    return JSON.parse(JSON.stringify(baseDoc));
  }

  // Both are Arrays
  if (Array.isArray(baseDoc) && Array.isArray(newDoc)) {
    const baseCloned = JSON.parse(JSON.stringify(baseDoc));
    const newCloned = JSON.parse(JSON.stringify(newDoc));

    const result = [...baseCloned];
    for (const newItem of newCloned) {
      if (newItem && typeof newItem === 'object' && !Array.isArray(newItem)) {
        const idKey = ['id', 'key', 'name', 'path', 'nodeId'].find(k => newItem[k] !== undefined);
        let matchedIndex = -1;
        if (idKey) {
          matchedIndex = result.findIndex(item => item && typeof item === 'object' && item[idKey] === newItem[idKey]);
        }
        if (matchedIndex !== -1) {
          result[matchedIndex] = mergeJSON(result[matchedIndex], newItem);
        } else {
          result.push(newItem);
        }
      } else {
        if (!result.some(existing => JSON.stringify(existing) === JSON.stringify(newItem))) {
          result.push(newItem);
        }
      }
    }
    return result;
  }

  // Both are Objects
  if (typeof baseDoc === 'object' && typeof newDoc === 'object' && !Array.isArray(baseDoc) && !Array.isArray(newDoc)) {
    const result: Record<string, any> = { ...baseDoc };
    for (const key of Object.keys(newDoc)) {
      if (key in result) {
        result[key] = mergeJSON(result[key], newDoc[key]);
      } else {
        result[key] = JSON.parse(JSON.stringify(newDoc[key]));
      }
    }
    return result;
  }

  // Primitives / different types
  return JSON.parse(JSON.stringify(newDoc));
}
