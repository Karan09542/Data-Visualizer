/**
 * Embeds phrases for the voice command matcher, off the main thread.
 *
 * Model: all-MiniLM-L6-v2 (int8), run with Transformers.js on ONNX Runtime's WebAssembly backend.
 * The model files come only from OPFS (see modelStore), so after the one-time download nothing is
 * fetched from Hugging Face again.
 *
 * Messages in:  download | cancel | embed {id, texts}
 * Messages out: progress | downloaded | download-error | embedded {id, vectors} | embed-error {id}
 */
import { MODEL_FILES, MODEL_ID, downloadModel, getStoredModel, readStoredFile } from "./modelStore";
import ortWasmUrl from "../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm?url";

export type MatcherRequest = { type: "download" } | { type: "cancel" } | { type: "embed"; id: number; texts: string[] };

const post = (message: any, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(message, transfer);

let downloading: AbortController | null = null;
let loading: Promise<(texts: string[]) => Promise<Float32Array[]>> | null = null;

function loadModel() {
  if (loading) return loading;
  loading = (async () => {
    if (!(await getStoredModel())) throw new Error("The voice matcher model isn't downloaded yet.");

    const { env, pipeline } = await import("@huggingface/transformers");

    // Files come only from OPFS: Transformers.js asks its cache first, and the cache has them.
    env.allowLocalModels = false;
    env.allowRemoteModels = true;
    env.useBrowserCache = false;
    env.useCustomCache = true;
    env.customCache = {
      async match(key: string | Request) {
        const url = typeof key === "string" ? key : key.url;
        const file = MODEL_FILES.find((f) => url.endsWith(`/${f.path}`));
        if (!file) return undefined;
        const stored = await readStoredFile(file.path);
        if (!stored) return undefined;
        return new Response(stored, { headers: { "content-length": String(stored.size) } });
      },
      async put() {
        // Everything is already stored.
      },
    };

    // The WebAssembly runtime comes from this app rather than a CDN, so its version matches the code.
    const onnx = env.backends.onnx as any;
    onnx.wasm.wasmPaths = undefined;
    onnx.wasm.wasmBinary = await (await fetch(ortWasmUrl)).arrayBuffer();
    onnx.wasm.proxy = false;

    const extractor = await pipeline("feature-extraction", MODEL_ID, { dtype: "q8", device: "wasm" });

    return async (texts: string[]) => {
      const output = await extractor(texts, { pooling: "mean", normalize: true });
      const [n, d] = output.dims as number[];
      const data = output.data as Float32Array;
      return Array.from({ length: n }, (_, i) => data.slice(i * d, (i + 1) * d));
    };
  })();
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

self.onmessage = async (event: MessageEvent<MatcherRequest>) => {
  const message = event.data;

  if (message.type === "download") {
    if (downloading) return;
    downloading = new AbortController();
    try {
      const stored = await downloadModel((p) => post({ type: "progress", ...p }), downloading.signal);
      post({ type: "downloaded", stored });
    } catch (e: any) {
      post({ type: "download-error", message: e?.name === "AbortError" ? "Download cancelled" : e?.message || String(e) });
    } finally {
      downloading = null;
    }
    return;
  }

  if (message.type === "cancel") {
    downloading?.abort();
    return;
  }

  if (message.type === "embed") {
    try {
      const embed = await loadModel();
      const vectors = await embed(message.texts);
      post({ type: "embedded", id: message.id, vectors }, vectors.map((v) => v.buffer));
    } catch (e: any) {
      post({ type: "embed-error", id: message.id, message: e?.message || String(e) });
    }
  }
};
