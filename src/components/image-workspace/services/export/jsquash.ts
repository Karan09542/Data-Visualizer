// Cache to prevent multiple compilations
export let isPngInitialised = false;
export let isResizeInitialised = false;
export let isJpegInitialised = false;
export let isWebpInitialised = false;
export let isAvifInitialised = false;

// TODO(Refactor): Move to src/components/image-workspace/services/export/jsquash.ts
// jSquash WASM URL assets (served via high-availability unpkg CDN)
export const pngWasmUrl = "https://unpkg.com/@jsquash/png@3.1.1/codec/pkg/squoosh_png_bg.wasm";
export const jpegWasmUrl = "https://unpkg.com/@jsquash/jpeg@1.6.0/codec/enc/mozjpeg_enc.wasm";
export const webpWasmUrl = "https://unpkg.com/@jsquash/webp@1.5.0/codec/enc/webp_enc.wasm";
export const webpSimdWasmUrl = "https://unpkg.com/@jsquash/webp@1.5.0/codec/enc/webp_enc_simd.wasm";
export const avifWasmUrl = "https://unpkg.com/@jsquash/avif@2.1.1/codec/enc/avif_enc.wasm";
export const avifMtWasmUrl = "https://unpkg.com/@jsquash/avif@2.1.1/codec/enc/avif_enc_mt.wasm";
export const resizeWasmUrl = "https://unpkg.com/@jsquash/resize@2.1.1/lib/resize/pkg/squoosh_resize_bg.wasm";

// Helpers to load and compile WASM
// TODO(Refactor): Move to src/components/image-workspace/services/export/jsquash.ts
export const loadWasmModule = async (url: string): Promise<WebAssembly.Module> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch wasm from ${url}`);
  const buffer = await res.arrayBuffer();
  return WebAssembly.compile(buffer);
};

// TODO(Refactor): Move to src/components/image-workspace/services/export/jsquash.ts
export const hasSimd = async (): Promise<boolean> => {
  try {
    const { simd } = await import('wasm-feature-detect');
    return await simd();
  } catch {
    return false;
  }
};

// TODO(Refactor): Move to src/components/image-workspace/services/export/jsquash.ts
export const hasThreads = async (): Promise<boolean> => {
  try {
    const { threads } = await import('wasm-feature-detect');
    return await threads();
  } catch {
    return false;
  }
};
