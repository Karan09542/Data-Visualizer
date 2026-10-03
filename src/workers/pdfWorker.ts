// ─── Minimal DOM shim for pdf.js in Web Worker context ───────────────────────
// pdf.js has deep internal references to `document` and `window` for canvas
// creation, font loading, and other subsystems. These don't exist in a Worker.
// We shim them BEFORE importing pdfjs-dist so all internal code paths work.

function createMockElement(tagName: string): any {
  if (tagName === "canvas") {
    return new OffscreenCanvas(1, 1);
  }
  // Minimal mock for any other element (style tags, divs, etc.)
  const children: any[] = [];
  return {
    tagName: tagName.toUpperCase(),
    style: {},
    parentNode: null,
    ownerDocument: (globalThis as any).document,
    children,
    childNodes: children,
    sheet: { cssRules: [], insertRule() {}, deleteRule() {} },
    setAttribute() {},
    getAttribute() { return null; },
    hasAttribute() { return false; },
    removeAttribute() {},
    appendChild(child: any) { children.push(child); return child; },
    removeChild(child: any) { const i = children.indexOf(child); if (i >= 0) children.splice(i, 1); return child; },
    insertBefore(newChild: any) { children.unshift(newChild); return newChild; },
    cloneNode() { return createMockElement(tagName); },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; },
    getBoundingClientRect() { return { x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 }; },
    getContext(type: string) {
      if (tagName === "canvas") return null;
      return null;
    },
    textContent: "",
    innerHTML: "",
  };
}

if (typeof (globalThis as any).document === "undefined") {
  const head = createMockElement("head");
  const body = createMockElement("body");
  (globalThis as any).document = {
    createElement: createMockElement,
    createElementNS(_ns: string, tagName: string) { return createMockElement(tagName); },
    createDocumentFragment() { return createMockElement("fragment"); },
    createTextNode(text: string) { return { textContent: text, nodeType: 3 }; },
    head,
    body,
    documentElement: { style: {}, getElementsByTagName() { return []; } },
    getElementById() { return null; },
    getElementsByTagName() { return []; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    removeEventListener() {},
    createRange() {
      return {
        setStart() {},
        setEnd() {},
        getBoundingClientRect() { return { x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 }; },
        getClientRects() { return []; },
        createContextualFragment(html: string) { return createMockElement("fragment"); },
      };
    },
  };
}

if (typeof (globalThis as any).window === "undefined") {
  (globalThis as any).window = globalThis;
}

// ─── Now safe to import pdfjs-dist ───────────────────────────────────────────
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Bundled with the app, and so precached, rather than fetched from unpkg: PDFs open offline.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/*
 * Protocol (see components/pdf-viewer/pdfWorkerClient.ts):
 *   LOAD { data, password }   - the document is sent once; later messages carry only page numbers
 *   THUMB { page }            - queue a thumbnail; the newest request is drawn first
 *   CANCEL_THUMB { page }     - drop a queued thumbnail that scrolled out of view
 *   SEARCH { id, query }      - streams SEARCH_RESULT, then SEARCH_DONE; a new id stops the old search
 */

/** Thumbnail width in pixels: sharp at two columns on a high-density screen */
const THUMB_WIDTH = 240;

let pdfDoc: any = null;
let loading: Promise<void> | null = null;
const queue: number[] = [];
let drawing = false;
let searchId = 0;

async function drawNextThumbnail() {
  if (drawing || !pdfDoc) return;
  drawing = true;
  try {
    while (queue.length) {
      // Newest first: what the person just scrolled to matters more than what they passed
      const pageNumber = queue.pop()!;
      if (pageNumber < 1 || pageNumber > pdfDoc.numPages) continue;
      try {
        const page = await pdfDoc.getPage(pageNumber);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: THUMB_WIDTH / base.width });
        const canvas = new OffscreenCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
        const context = canvas.getContext("2d")!;
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas: canvas as any, canvasContext: context as any, viewport }).promise;
        page.cleanup();
        const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.72 });
        const buffer = await blob.arrayBuffer();
        (self as any).postMessage({ action: "THUMB", payload: { page: pageNumber, buffer } }, [buffer]);
      } catch (error: any) {
        self.postMessage({ action: "THUMB_FAILED", payload: { page: pageNumber, message: String(error?.message || error) } });
      }
    }
  } finally {
    drawing = false;
  }
}

async function search(id: number, query: string) {
  const normalizedQuery = query.normalize("NFC");
  const lowerQuery = normalizedQuery.toLocaleLowerCase();
  let matchCount = 0;

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    if (id !== searchId) return; // a newer search started
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();

    let charIndex = 0;
    const itemMappings: { item: any; start: number; end: number; normalizedStr: string }[] = [];
    const parts = textContent.items.map((item: any) => {
      const str = (item.str || "").normalize("NFC");
      const start = charIndex;
      const end = charIndex + str.length;
      charIndex = end + 1; // +1 for the space added by join
      itemMappings.push({ item, start, end, normalizedStr: str });
      return str;
    });
    const pageText = parts.join(" ");
    const lowerPageText = pageText.toLocaleLowerCase();

    let startIndex = 0;
    while ((startIndex = lowerPageText.indexOf(lowerQuery, startIndex)) > -1) {
      matchCount++;
      const matchEnd = startIndex + normalizedQuery.length;
      const from = Math.max(0, startIndex - 40);
      const to = Math.min(pageText.length, matchEnd + 40);

      const rects: any[] = [];
      for (const map of itemMappings) {
        if (map.start < matchEnd && map.end > startIndex && map.normalizedStr.trim().length > 0) {
          rects.push({
            str: map.normalizedStr,
            fontFamily: textContent.styles?.[map.item.fontName]?.fontFamily,
            transform: map.item.transform,
            width: map.item.width,
            height: map.item.height,
            overlapStart: Math.max(0, startIndex - map.start),
            overlapEnd: Math.min(map.normalizedStr.length, matchEnd - map.start),
            totalLen: Math.max(1, map.normalizedStr.length),
          });
        }
      }

      self.postMessage({
        action: "SEARCH_RESULT",
        payload: {
          id,
          pageNumber: i,
          matchId: matchCount,
          before: (from > 0 ? "…" : "") + pageText.slice(from, startIndex),
          match: pageText.slice(startIndex, matchEnd),
          after: pageText.slice(matchEnd, to) + (to < pageText.length ? "…" : ""),
          rects,
        },
      });
      startIndex = matchEnd;
    }
    page.cleanup();
  }
  if (id === searchId) self.postMessage({ action: "SEARCH_DONE", payload: { id, matchCount } });
}

self.onmessage = async (e: MessageEvent) => {
  const { action, payload } = e.data;
  try {
    if (action === "LOAD") {
      queue.length = 0;
      searchId++;
      if (pdfDoc) await pdfDoc.destroy().catch(() => {});
      pdfDoc = null;
      loading = (async () => {
        pdfDoc = await pdfjsLib.getDocument({
          data: new Uint8Array(payload.data),
          useSystemFonts: true,
          password: payload.password,
        }).promise;
        self.postMessage({ action: "LOADED", payload: { numPages: pdfDoc.numPages } });
      })();
      await loading;
      void drawNextThumbnail();
    } else if (action === "THUMB") {
      const i = queue.indexOf(payload.page);
      if (i >= 0) queue.splice(i, 1);
      queue.push(payload.page);
      if (loading) await loading;
      void drawNextThumbnail();
    } else if (action === "CANCEL_THUMB") {
      const i = queue.indexOf(payload.page);
      if (i >= 0) queue.splice(i, 1);
    } else if (action === "SEARCH") {
      searchId = payload.id;
      if (loading) await loading;
      if (!payload.query?.trim()) {
        self.postMessage({ action: "SEARCH_DONE", payload: { id: payload.id, matchCount: 0 } });
        return;
      }
      await search(payload.id, payload.query);
    }
  } catch (error: any) {
    self.postMessage({ action: "ERROR", payload: { action, message: String(error?.message || error) } });
  }
};
