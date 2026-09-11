/**
 * Recognising the files that hold media.
 *
 * A media file's value is not its contents: it is an id in the asset store (`img_4f2a.webm`), or
 * a URL. Both the file tree and the workspace need to know what such a file really is - an image,
 * a video, a sound - to show the right icon, the right extension, and the right viewer instead of
 * the id as text.
 */

export type MediaKind = "image" | "video" | "audio" | "pdf";

const BY_EXTENSION: Record<string, MediaKind> = {
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", svg: "image",
  bmp: "image", ico: "image", avif: "image", jfif: "image",
  mp4: "video", webm: "video", mov: "video", mkv: "video", m4v: "video", avi: "video", ogv: "video",
  mp3: "audio", wav: "audio", m4a: "audio", aac: "audio", flac: "audio", opus: "audio", oga: "audio",
  // `.ogg` holds either; audio is the common case and a video file still plays in the video element.
  ogg: "audio",
  pdf: "pdf",
};

export interface MediaFile {
  kind: MediaKind;
  /** The asset id or URL the file lives at. */
  source: string;
  /** "webm", "png"; empty when there is none to go by. */
  extension: string;
  /** Whether `source` is an id in the asset store rather than a URL. */
  isAsset: boolean;
}

/** Ids the asset store hands out: `img_4f2a9c.png`, `thumb_4f2a9c.png`. */
export const isAssetId = (value: string) => /^(img|thumb)_[A-Za-z0-9]+(\.[A-Za-z0-9]{1,5})?$/.test(value.trim());

/** The extension of a file name, asset id or URL; empty when it has none. */
export function extensionOf(value: string): string {
  const path = value.split(/[?#]/)[0];
  const name = path.split("/").pop() || "";
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "";
  const extension = name.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{1,5}$/.test(extension) ? extension : "";
}

const kindFromMime = (mime: string): MediaKind | null => {
  const type = mime.toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  if (type.startsWith("application/pdf")) return "pdf";
  return null;
};

/** Where a node's media lives: its value, or the url/filename inside it. */
function sourceOf(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const candidate = record.url ?? record.filename ?? record.src ?? record.assetId;
    if (typeof candidate === "string") return candidate.trim();
  }
  return "";
}

/**
 * What media a file holds, or null when it holds something else. `name` is the file's name in the
 * tree, used when the value itself carries no extension; `mimeTypes` is what the app recorded
 * about uploaded assets.
 */
export function detectMediaFile(
  name: string,
  value: unknown,
  mimeTypes?: Record<string, { mimeType?: string } | undefined>,
): MediaFile | null {
  const source = sourceOf(value);
  if (!source || source.length > 2048) return null;

  if (source.startsWith("data:")) {
    const kind = kindFromMime(source.slice(5).split(/[;,]/)[0] || "");
    return kind ? { kind, source, extension: "", isAsset: false } : null;
  }

  const isAsset = isAssetId(source);
  const isUrl = /^(https?:|blob:|\/)/i.test(source);
  // A plain string is only media when it is an asset id or a URL; a text file full of prose is not.
  if (!isAsset && !isUrl) return null;

  const extension = extensionOf(source) || extensionOf(name);
  const recorded = mimeTypes?.[source]?.mimeType;
  const kind = BY_EXTENSION[extension] ?? (recorded ? kindFromMime(recorded) : null);
  if (!kind) return null;

  return { kind, source, extension, isAsset };
}

/** The name to show in the tree: media files keep their extension, which the node key drops. */
export function mediaFileName(name: string, media: MediaFile | null): string {
  if (!media || !media.extension) return name;
  if (extensionOf(name)) return name;
  return `${name}.${media.extension}`;
}

export const mediaKindLabel = (kind: MediaKind) =>
  kind === "image" ? "Image" : kind === "video" ? "Video" : kind === "audio" ? "Audio" : "PDF";
