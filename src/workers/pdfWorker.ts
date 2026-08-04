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

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

let pdfDoc: any = null;

async function ensureDoc(payload: any): Promise<void> {
  if (pdfDoc) return;
  if (!payload?.data) throw new Error("No PDF data provided");
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(payload.data),
    useSystemFonts: true,
    password: payload.password,
  });
  pdfDoc = await loadingTask.promise;
}

self.onmessage = async (e: MessageEvent) => {
  const { action, payload, msgId } = e.data;

  try {
    if (action === "GENERATE_THUMBNAILS") {
      await ensureDoc(payload);

      const numPages = pdfDoc.numPages;
      self.postMessage({ action: "THUMBNAILS_TOTAL", payload: { total: numPages } });

      for (let i = 1; i <= numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const baseViewport = page.getViewport({ scale: 1.0 });

        // Target width ~150px for thumbnails
        const scale = 150 / baseViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = new OffscreenCanvas(
          Math.floor(viewport.width),
          Math.floor(viewport.height)
        );
        const context = canvas.getContext("2d")!;

        await page.render({ canvasContext: context, viewport }).promise;

        const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.6 });
        const buffer = await blob.arrayBuffer();

        // Transfer the buffer (zero-copy) instead of cloning
        (self as any).postMessage(
          { action: "THUMBNAIL_GENERATED", payload: { pageNumber: i, buffer } },
          [buffer]
        );
      }
      self.postMessage({ action: "THUMBNAILS_COMPLETE", msgId });

    } else if (action === "SEARCH_TEXT") {
      await ensureDoc(payload);

      const { query } = payload;
      if (!query || query.trim() === "") {
        self.postMessage({ action: "SEARCH_COMPLETE", msgId, payload: { matchCount: 0 } });
        return;
      }

      const normalizedQuery = query.normalize("NFC");
      const lowerQuery = normalizedQuery.toLocaleLowerCase();
      const numPages = pdfDoc.numPages;
      let matchCount = 0;

      for (let i = 1; i <= numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();

        let charIndex = 0;
        const itemMappings: any[] = [];
        const normalizedTextItems = textContent.items.map((item: any) => {
          const str = (item.str || "").normalize("NFC");
          const start = charIndex;
          const end = charIndex + str.length;
          charIndex = end + 1; // +1 for the space we add in join
          itemMappings.push({ item, start, end, normalizedStr: str });
          return str;
        });
        
        const normalizedPageText = normalizedTextItems.join(" ");
        const lowerPageText = normalizedPageText.toLocaleLowerCase();

        let startIndex = 0;
        while ((startIndex = lowerPageText.indexOf(lowerQuery, startIndex)) > -1) {
          matchCount++;
          const matchEndIndex = startIndex + normalizedQuery.length;
          
          const start = Math.max(0, startIndex - 30);
          const end = Math.min(normalizedPageText.length, matchEndIndex + 30);
          let snippet = normalizedPageText.substring(start, end);
          if (start > 0) snippet = "..." + snippet;
          if (end < normalizedPageText.length) snippet = snippet + "...";

          const rects: any[] = [];
          for (const map of itemMappings) {
            // Check for overlap and ignore purely whitespace items
            if (map.start < matchEndIndex && map.end > startIndex && map.normalizedStr.trim().length > 0) {
               const overlapStart = Math.max(0, startIndex - map.start);
               const overlapEnd = Math.min(map.normalizedStr.length, matchEndIndex - map.start);
               rects.push({
                 transform: map.item.transform,
                 width: map.item.width,
                 height: map.item.height,
                 overlapStart,
                 overlapEnd,
                 totalLen: Math.max(1, map.normalizedStr.length)
               });
            }
          }

          self.postMessage({
            action: "SEARCH_RESULT_FOUND",
            payload: { pageNumber: i, snippet, matchId: matchCount, rects },
          });

          startIndex += normalizedQuery.length;
        }
      }
      self.postMessage({ action: "SEARCH_COMPLETE", msgId, payload: { matchCount } });
    }
  } catch (error: any) {
    self.postMessage({ action: "ERROR", msgId, payload: error.message || String(error) });
  }
};
