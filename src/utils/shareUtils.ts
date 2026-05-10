import LZString from 'lz-string';

export interface SharedState {
  code?: string;
  settings?: any;
  annotations?: any[];
  version: string;
}

const SHARED_STATE_VERSION = '1.0';

export function serializeState(code: string, settings: any, annotations: any[]): string {
  const state: SharedState = {
    code,
    settings,
    annotations,
    version: SHARED_STATE_VERSION
  };
  
  return JSON.stringify(state);
}

export function compressState(json: string): string {
  return LZString.compressToEncodedURIComponent(json);
}

export function decompressState(compressed: string): string | null {
  try {
    return LZString.decompressFromEncodedURIComponent(compressed);
  } catch (e) {
    console.error('Failed to decompress state:', e);
    return null;
  }
}

export function getShareUrl(compressed: string): string {
  const url = new URL(window.location.href);
  url.hash = `share=${compressed}`;
  return url.toString();
}

export function parseShareUrl(): SharedState | null {
  const hash = window.location.hash;
  if (!hash.startsWith('#share=')) return null;
  
  const compressed = hash.substring(7);
  const json = decompressState(compressed);
  
  if (!json) return null;
  
  try {
    return JSON.parse(json);
  } catch (e) {
    console.error('Failed to parse shared state:', e);
    return null;
  }
}

export interface ShareSizeInfo {
  rawSize: number;
  compressedSize: number;
  urlLength: number;
  ratio: number;
  status: 'safe' | 'moderate' | 'large' | 'unsafe';
}

export function estimateShareSize(code: string, settings: any, annotations: any[]): ShareSizeInfo {
  const rawJson = serializeState(code, settings, annotations);
  const rawSize = new Blob([rawJson]).size;
  
  const compressed = compressState(rawJson);
  const compressedSize = new Blob([compressed]).size;
  
  const dummyUrl = getShareUrl(compressed);
  const urlLength = dummyUrl.length;
  
  const ratio = rawSize > 0 ? (1 - compressedSize / rawSize) * 100 : 0;
  
  let status: ShareSizeInfo['status'] = 'safe';
  if (urlLength > 32000) status = 'unsafe';
  else if (urlLength > 8000) status = 'large';
  else if (urlLength > 2000) status = 'moderate';
  
  return {
    rawSize,
    compressedSize,
    urlLength,
    ratio,
    status
  };
}

export function simplifyAnnotations(annotations: any[]): any[] {
  // Basic optimization: reduce precision of coordinates
  return annotations.map(anno => ({
    ...anno,
    points: anno.points?.map((p: any) => ({
      x: Math.round(p.x * 10) / 10,
      y: Math.round(p.y * 10) / 10
    }))
  }));
}
