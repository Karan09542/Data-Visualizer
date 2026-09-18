/**
 * What an editor group needs to know about the file it shows: its text, its language, and whether
 * it is shown as something other than text - a todo list, a search, an image, a video.
 *
 * Each group asks about its own file. The main group and the side group use the same reading, so
 * a file looks the same in either.
 */
import { useMemo } from "react";
import { useStore } from "../../store/useStore";
import { getValueAtPath } from "../../utils/pathUtils";
import { detectMediaFile } from "../../utils/mediaFiles";
import { editorLanguageFor } from "../../utils/editorLanguage";
import { getMediaType } from "../NodeRenderer";

export function useEditorFile(path: string | null) {
  const parsedData = useStore((s) => s.parsedData);
  const overrides = useStore((s) => s.jsNodeCodeOverrides);
  const uploadedMediaMetadata = useStore((s) => s.uploadedMediaMetadata);
  const mediaViewOnly = useStore((s) => s.mediaViewOnly);

  const raw = path ? getValueAtPath(parsedData, path) : undefined;
  const key = path ? path.split(".").pop() || path : "";
  const ext = key.replace(/\[[0-9]+\]$/, "").toLowerCase();

  // A draft being typed wins over what is saved.
  const text = useMemo(() => {
    if (!path) return "";
    const val = overrides[path] ?? raw ?? "";
    if (typeof val === "string") return val;
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  }, [path, overrides, raw]);

  const media = useMemo(
    () => (path ? detectMediaFile(key, raw, uploadedMediaMetadata) : null),
    [path, key, raw, uploadedMediaMetadata],
  );

  // An image node, or a value that points at an image.
  const isImg = useMemo(() => {
    if (/_image_node$/.test(ext) || ["img", "image", "png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return true;
    const rawObj = typeof raw === "object" && raw !== null ? (raw as any) : null;
    const asset = rawObj?.url || rawObj?.filename || text;
    const mime = typeof asset === "string" ? uploadedMediaMetadata[asset]?.mimeType?.toLowerCase() ?? "" : "";
    return mime.startsWith("image/") || getMediaType(text) === "image";
  }, [ext, raw, text, uploadedMediaMetadata]);

  return {
    text,
    media,
    isImg,
    isTodo: ext.endsWith("_todo_node") || ext === "todo",
    // Images open in their editor unless asked for on their own; other media have no editor.
    showMediaOnly: !!media && !!path && (media.kind !== "image" || !!mediaViewOnly[path]),
    language: path ? editorLanguageFor(path) : "plaintext",
  };
}
