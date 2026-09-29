const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
  "image/avif": "avif",
  "image/tiff": "tiff",
};

/** A file name whose extension matches what the file really is. */
export function withImageExtension(filename: string, mimeType?: string): string {
  const ext = mimeType ? EXTENSIONS[mimeType.toLowerCase()] : undefined;
  if (!ext) return filename;
  const base = filename.replace(/(\.(png|jpe?g|webp|gif|svg|bmp|avif|tiff?))+$/i, "");
  return `${base || "image"}.${ext}`;
}

/**
 * The full-size original behind a resized web image, when the host's URL says
 * how: Wikimedia thumbnails (/thumb/…/1024px-Name.jpg), Google-hosted images
 * (=s400, =w800-h600) and Pinterest (/236x/). Anything else is returned as is.
 */
export function originalImageUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === "upload.wikimedia.org" && u.pathname.includes("/thumb/")) {
      // /wikipedia/commons/thumb/a/ab/Name.jpg/1024px-Name.jpg → /wikipedia/commons/a/ab/Name.jpg
      const path = u.pathname.replace("/thumb/", "/").replace(/\/[^/]+$/, "");
      return `${u.origin}${path}`;
    }
    if (/(^|\.)googleusercontent\.com$/.test(u.hostname) && /=[swh]\d+[^/]*$/.test(u.pathname)) {
      return `${u.origin}${u.pathname.replace(/=[^=/]+$/, "=s0")}`;
    }
    if (u.hostname === "i.pinimg.com" && /^\/\d+x\//.test(u.pathname)) {
      return `${u.origin}${u.pathname.replace(/^\/\d+x\//, "/originals/")}`;
    }
  } catch {
    // Not a URL (an asset id, a data URL…): nothing to undo.
  }
  return url;
}

/** Saves a blob to the device under `filename`. */
export function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function fetchBlob(url: string): Promise<Blob> {
  const response = await fetch(url, { method: "GET", mode: "cors", credentials: "omit" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.blob();
}

/**
 * Downloads an image from a URL and saves it to the user's device, byte for
 * byte, never re-encoded. For a resized web image the full-size original is
 * tried first. If the host doesn't allow the page to read the file, the
 * browser is asked to download the link itself.
 */
export async function downloadImage(url: string, filename?: string): Promise<boolean> {
  if (!filename) {
    const urlParts = url.split("#")[0].split("?")[0].split("/");
    filename = decodeURIComponent(urlParts[urlParts.length - 1] || "");
    if (!filename || filename.length < 3) filename = "image.jpg";
  }

  const original = originalImageUrl(url);
  for (const candidate of original === url ? [url] : [original, url]) {
    try {
      const blob = await fetchBlob(candidate);
      if (!blob.size) continue;
      // The original isn't "1024px-…" any more.
      const name = candidate === url ? filename : filename.replace(/^\d+px-/, "");
      downloadBlob(blob, withImageExtension(name, blob.type));
      return true;
    } catch {
      // Try the next one.
    }
  }

  // Cross-origin without CORS: the page can't read it, but the browser can still save it.
  try {
    const link = document.createElement("a");
    link.href = original;
    link.download = filename;
    link.target = "_blank";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (error) {
    console.error("Failed to download image:", error);
    return false;
  }
}
