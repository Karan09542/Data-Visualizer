/**
 * Talks to workers/pdfWorker.ts, which draws page thumbnails and searches text off the main
 * thread. The document is sent once; after that only page numbers cross over.
 *
 * Thumbnails go into a tiny store that each grid slot subscribes to, so a new thumbnail
 * re-renders that one slot rather than the whole grid.
 */

export interface SearchRect {
  /** The whole text run the match sits in, and its font, for measuring where the match falls */
  str?: string;
  fontFamily?: string;
  transform: number[];
  width: number;
  height: number;
  overlapStart: number;
  overlapEnd: number;
  totalLen: number;
}

export interface SearchResult {
  pageNumber: number;
  matchId: number;
  before: string;
  match: string;
  after: string;
  rects: SearchRect[];
}

export class ThumbnailStore {
  private urls = new Map<number, string>();
  private listeners = new Map<number, Set<() => void>>();

  get = (page: number) => this.urls.get(page);

  set(page: number, url: string) {
    const old = this.urls.get(page);
    if (old) URL.revokeObjectURL(old);
    this.urls.set(page, url);
    this.listeners.get(page)?.forEach((fn) => fn());
  }

  subscribe(page: number, fn: () => void) {
    let set = this.listeners.get(page);
    if (!set) this.listeners.set(page, (set = new Set()));
    set.add(fn);
    return () => {
      set!.delete(fn);
    };
  }

  clear() {
    this.urls.forEach((url) => URL.revokeObjectURL(url));
    this.urls.clear();
    this.listeners.forEach((set) => set.forEach((fn) => fn()));
  }
}

export interface PdfWorkerClient {
  load(data: ArrayBuffer, password?: string): void;
  requestThumbnail(page: number): void;
  cancelThumbnail(page: number): void;
  /** Starts a search, stopping any search still running */
  search(query: string, onResult: (r: SearchResult) => void, onDone: (count: number) => void): void;
  thumbnails: ThumbnailStore;
  destroy(): void;
}

export function createPdfWorkerClient(): PdfWorkerClient {
  const worker = new Worker(new URL("../../workers/pdfWorker.ts", import.meta.url), { type: "module" });
  const thumbnails = new ThumbnailStore();
  const requested = new Set<number>();
  let searchId = 0;
  let onResult: ((r: SearchResult) => void) | null = null;
  let onDone: ((count: number) => void) | null = null;

  worker.onmessage = (e: MessageEvent) => {
    const { action, payload } = e.data;
    if (action === "THUMB") {
      thumbnails.set(payload.page, URL.createObjectURL(new Blob([payload.buffer], { type: "image/jpeg" })));
    } else if (action === "THUMB_FAILED") {
      requested.delete(payload.page); // allow a retry when it scrolls back into view
    } else if (action === "SEARCH_RESULT" && payload.id === searchId) {
      onResult?.(payload);
    } else if (action === "SEARCH_DONE" && payload.id === searchId) {
      onDone?.(payload.matchCount);
    } else if (action === "ERROR") {
      console.error("PDF worker:", payload);
      if (payload.action === "SEARCH") onDone?.(0);
    }
  };
  worker.onerror = (err) => console.error("PDF worker failed:", err);

  return {
    thumbnails,
    load(data, password) {
      requested.clear();
      thumbnails.clear();
      // A copy is transferred, so the caller keeps its own buffer for exports
      const copy = data.slice(0);
      worker.postMessage({ action: "LOAD", payload: { data: copy, password } }, [copy]);
    },
    requestThumbnail(page) {
      if (thumbnails.get(page) || requested.has(page)) return;
      requested.add(page);
      worker.postMessage({ action: "THUMB", payload: { page } });
    },
    cancelThumbnail(page) {
      if (thumbnails.get(page) || !requested.has(page)) return;
      requested.delete(page);
      worker.postMessage({ action: "CANCEL_THUMB", payload: { page } });
    },
    search(query, resultCb, doneCb) {
      searchId++;
      onResult = resultCb;
      onDone = doneCb;
      worker.postMessage({ action: "SEARCH", payload: { id: searchId, query } });
    },
    destroy() {
      worker.terminate();
      thumbnails.clear();
    },
  };
}
