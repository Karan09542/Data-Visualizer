// Hashing worker: MD5, SHA-1/2, CRC-32 and HMAC off the main thread, so hashing a
// large file or a long text never stalls the UI. crypto.subtle is available here too.

export type AlgorithmId = "MD5" | "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512" | "CRC-32";

export interface HashRequest {
  id: number;
  algorithms: AlgorithmId[];
  /** Detached and transferred, so it costs nothing to hand over */
  message: ArrayBuffer;
  key: ArrayBuffer | null;
}

export interface HashSuccess {
  id: number;
  success: true;
  results: Record<string, ArrayBuffer>;
  elapsedMs: number;
}

export interface HashFailure {
  id: number;
  success: false;
  error: string;
}

export type HashResponse = HashSuccess | HashFailure;

/**
 * The worker's own global scope, typed for just what this file uses. The project's `lib` is
 * DOM, so the ambient `self` is a Window; this shadows it with the worker shape instead of
 * casting at every call.
 */
interface HashWorkerScope {
  onmessage: ((event: MessageEvent<HashRequest>) => void) | null;
  postMessage(message: HashResponse, transfer?: Transferable[]): void;
}
declare const self: HashWorkerScope;

/** HMAC block size in bytes; 0 means the algorithm isn't keyable */
const BLOCK_SIZE: Record<AlgorithmId, number> = {
  MD5: 64,
  "SHA-1": 64,
  "SHA-256": 64,
  "SHA-384": 128,
  "SHA-512": 128,
  "CRC-32": 0,
};

/**
 * Bytes backed by a plain (non-shared) ArrayBuffer. Web Crypto and postMessage transfers both
 * reject SharedArrayBuffer-backed views, and every array here is freshly allocated, so this is
 * the accurate type.
 */
type Bytes = Uint8Array<ArrayBuffer>;

const concatBytes = (a: Bytes, b: Bytes): Bytes => {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
};

/* ── MD5 (Web Crypto has none) ── */

const MD5_SHIFTS = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];
const MD5_K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);

const md5 = (bytes: Bytes): Bytes => {
  const length = bytes.length;
  const paddedLength = (((length + 8) >>> 6) + 1) << 6;
  const buffer = new Uint8Array(paddedLength);
  buffer.set(bytes);
  buffer[length] = 0x80;
  const view = new DataView(buffer.buffer);
  view.setUint32(paddedLength - 8, (length * 8) >>> 0, true);
  view.setUint32(paddedLength - 4, Math.floor(length / 0x20000000), true);

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const M = new Uint32Array(16);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let j = 0; j < 16; j++) M[j] = view.getUint32(offset + j * 4, true);
    let A = a0, B = b0, C = c0, D = d0;

    for (let i = 0; i < 64; i++) {
      let F: number, g: number;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }

      F = (F + A + MD5_K[i] + M[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + ((F << MD5_SHIFTS[i]) | (F >>> (32 - MD5_SHIFTS[i])))) >>> 0;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const out = new Uint8Array(16);
  const outView = new DataView(out.buffer);
  [a0, b0, c0, d0].forEach((word, i) => outView.setUint32(i * 4, word, true));
  return out;
};

/* ── CRC-32 ── */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Bytes): Bytes => {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, (crc ^ 0xffffffff) >>> 0);
  return out;
};

const digest = async (algorithm: AlgorithmId, bytes: Bytes): Promise<Bytes> => {
  if (algorithm === "MD5") return md5(bytes);
  if (algorithm === "CRC-32") return crc32(bytes);
  const result = await crypto.subtle.digest(algorithm, bytes);
  return new Uint8Array(result);
};

/** Standard HMAC, built on `digest` so MD5 gets it too */
const hmac = async (algorithm: AlgorithmId, key: Bytes, message: Bytes): Promise<Bytes> => {
  const blockSize = BLOCK_SIZE[algorithm];
  const shortKey = key.length > blockSize ? await digest(algorithm, key) : key;
  const block = new Uint8Array(blockSize);
  block.set(shortKey);
  const inner = await digest(algorithm, concatBytes(block.map((b) => b ^ 0x36), message));
  return digest(algorithm, concatBytes(block.map((b) => b ^ 0x5c), inner));
};

self.onmessage = async (event: MessageEvent<HashRequest>) => {
  const { id, algorithms, message, key } = event.data;
  try {
    const messageBytes = new Uint8Array(message);
    const keyBytes = key ? new Uint8Array(key) : null;
    const started = performance.now();

    const results: Record<string, ArrayBuffer> = {};
    const transfer: ArrayBuffer[] = [];
    for (const algorithm of algorithms) {
      if (keyBytes && BLOCK_SIZE[algorithm] === 0) continue;
      const bytes = keyBytes ? await hmac(algorithm, keyBytes, messageBytes) : await digest(algorithm, messageBytes);
      results[algorithm] = bytes.buffer;
      transfer.push(bytes.buffer);
    }

    const response: HashSuccess = { id, success: true, results, elapsedMs: performance.now() - started };
    self.postMessage(response, transfer);
  } catch (err) {
    const response: HashFailure = { id, success: false, error: err instanceof Error ? err.message : "Hashing failed" };
    self.postMessage(response);
  }
};
