import { useStore } from "../store/useStore";
import { importFile } from "./assetManager";
import { toNodeKey, uniqueKey } from "../hooks/useInsertNode";

/** Global registry of in-memory blobs received or sent in chat */
export const blobRegistry = new Map<string, Blob>();

export const getFileType = (fileName: string): string => {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"].includes(ext || ""))
    return "image";
  if (["mp4", "webm", "ogg", "mov", "mkv", "avi", "m4v"].includes(ext || "")) return "video";
  if (["mp3", "wav", "m4a", "flac", "aac", "opus"].includes(ext || "")) return "audio";
  if (["pdf"].includes(ext || "")) return "pdf";
  if (["txt", "md", "json", "yaml", "yml", "csv", "log", "tsv", "xml"].includes(ext || ""))
    return "text_file";
  if (["sqlite", "db", "sqlite3", "sql"].includes(ext || ""))
    return "sqlite_workspace";
  if (["glb", "gltf", "obj", "fbx", "stl"].includes(ext || ""))
    return "3d_model";
  return "file";
};

export interface ChatMessageItem {
  id?: string;
  type?: string;
  content?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  attachments?: any[];
  originalBlob?: Blob;
  sender?: string;
  timestamp?: number;
}

/**
 * Directly converts a received (or sent) chat message / media attachment
 * into a live canvas node within the document.
 */
export async function addChatMessageToCanvas(item: ChatMessageItem): Promise<string | null> {
  if (!item) return null;
  const store = useStore.getState();
  const { parsedData, codeFormat, setCode, setSelectedNodeId, setNotification, registerMediaMetadata } = store;

  try {
    const isComposite = item.type === "composite" && Array.isArray(item.attachments) && item.attachments.length > 0;

    // Helper to retrieve an active blob for media content
    const getBlobForItem = async (mediaItem: any): Promise<Blob | null> => {
      let b: Blob | null = mediaItem.originalBlob || null;
      if (!b && typeof mediaItem.content === "string") {
        b = blobRegistry.get(mediaItem.content) || null;
      }
      if (!b && typeof mediaItem.content === "string" && (mediaItem.content.startsWith("blob:") || mediaItem.content.startsWith("data:"))) {
        try {
          const res = await fetch(mediaItem.content);
          b = await res.blob();
          if (b) {
            blobRegistry.set(mediaItem.content, b);
          }
        } catch (fetchErr) {
          console.warn("Could not fetch blob from content URL:", fetchErr);
        }
      }
      return b;
    };

    // Helper to process a single attachment / media item into a canvas node key & value
    const processSingleMedia = async (mediaItem: any): Promise<{ key: string; value: any }> => {
      const rawFileName = mediaItem.fileName || mediaItem.name || "";
      const fType = mediaItem.fileType || (rawFileName ? getFileType(rawFileName) : "file");
      const base = toNodeKey(rawFileName || fType || "media");
      const content = mediaItem.content || "";

      let mimeType = "";
      if (fType === "image") mimeType = "image/png";
      else if (fType === "video") mimeType = "video/mp4";
      else if (fType === "audio") mimeType = "audio/mp3";
      else if (fType === "3d_model") mimeType = "model/gltf-binary";
      else if (fType === "pdf") mimeType = "application/pdf";
      else mimeType = "application/octet-stream";

      const blob = await getBlobForItem(mediaItem);

      // Special check for text / code files: if text content is available, read it
      if (fType === "text_file" && blob) {
        try {
          const text = await blob.text();
          const trimmed = text.trim();
          // If valid JSON, parse as structure
          if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
            try {
              const parsed = JSON.parse(trimmed);
              return { key: base, value: parsed };
            } catch {
              // Not valid JSON, keep as text
            }
          }
          const ext = rawFileName.split(".").pop()?.toLowerCase();
          if (ext === "py") return { key: `${base}_py_node`, value: text };
          if (ext === "js") return { key: `${base}_js_node`, value: text };
          if (ext === "ts") return { key: `${base}_ts_node`, value: text };
          if (ext === "todo") return { key: `${base}_todo_node`, value: text };
          return { key: base, value: text };
        } catch (err) {
          console.warn("Could not read text_file blob:", err);
        }
      }

      if (fType === "sqlite_workspace" && blob) {
        try {
          const { parseSqliteWorkspace, parseSqlScriptWorkspace, restoreSqliteAssets } = await import("./sqliteWorkspace");
          let parsed;
          if (rawFileName.toLowerCase().endsWith(".sql")) {
            parsed = await parseSqlScriptWorkspace(await blob.text());
          } else {
            parsed = await parseSqliteWorkspace(await blob.arrayBuffer());
          }
          if (parsed && parsed.assets && parsed.assets.length > 0) {
            await restoreSqliteAssets(parsed.assets);
          }
          if (parsed && parsed.documents.length > 0) {
            return {
              key: `${base}_sqlite_workspace`,
              value: {
                meta: parsed.meta,
                documents: parsed.documents.map((d) => ({
                  name: d.name,
                  lineCount: d.code ? d.code.split("\n").length : 0,
                  content: d.code,
                })),
              },
            };
          }
        } catch (err) {
          console.warn("Could not parse sqlite_workspace for canvas:", err);
        }
      }

      // Try saving media to local asset store for persistence
      let assetId: string | null = null;
      let thumbnailId: string | undefined = undefined;

      if (blob) {
        try {
          const ext = rawFileName.includes(".") ? rawFileName.split(".").pop() : "";
          const fileObj = new File([blob], rawFileName || `file.${ext || "bin"}`, { type: blob.type || mimeType });
          const imported = await importFile(fileObj);
          assetId = imported.assetId;
          thumbnailId = imported.thumbnailId;
        } catch (err) {
          console.warn("importFile failed for media item, falling back to URL", err);
        }
      }

      let finalValue: any;
      if (assetId) {
        finalValue = assetId;
        registerMediaMetadata(assetId, {
          filename: rawFileName || assetId,
          mimeType: blob?.type || mimeType,
          size: mediaItem.fileSize || blob?.size || 0,
        });
      } else {
        // Fallback to URL with type hash if it's a blob url
        let urlWithHash = content;
        if (typeof content === "string" && content.startsWith("blob:") && !content.includes("#")) {
          if (fType === "image") urlWithHash = `${content}#image`;
          else if (fType === "video") urlWithHash = `${content}#video`;
          else if (fType === "audio") urlWithHash = `${content}#audio`;
          else if (fType === "3d_model") urlWithHash = `${content}#model`;
          else if (fType === "pdf") urlWithHash = `${content}#pdf`;
        }
        finalValue = urlWithHash;
        registerMediaMetadata(urlWithHash, {
          filename: rawFileName || "media",
          mimeType,
          size: mediaItem.fileSize || 0,
        });
      }

      // Generate key based on type
      let finalKey = base;
      if (fType === "image") {
        finalKey = `${base}_image_node`;
      } else if (fType === "video") {
        finalKey = `${base}_video`;
      } else if (fType === "audio") {
        finalKey = `${base}_audio`;
      } else if (fType === "3d_model") {
        finalKey = `${base}_model`;
      } else if (fType === "pdf") {
        finalKey = `${base}_pdf`;
      }

      return { key: finalKey, value: finalValue };
    };

    let targetKey = "chat_node";
    let targetValue: any = null;

    if (isComposite) {
      if (item.attachments.length === 1 && (!item.content || !item.content.trim())) {
        const { key, value } = await processSingleMedia(item.attachments[0]);
        targetKey = key;
        targetValue = value;
      } else {
        const titleSnippet = item.content?.trim().slice(0, 24) || item.attachments[0]?.fileName || "chat_item";
        const groupKey = toNodeKey(titleSnippet) || `message_${Date.now()}`;
        targetKey = groupKey;

        const groupObj: Record<string, any> = {};
        if (item.content && item.content.trim()) {
          groupObj["message"] = item.content.trim();
        }
        for (const att of item.attachments) {
          const { key, value } = await processSingleMedia(att);
          const uKey = uniqueKey(groupObj, key);
          groupObj[uKey] = value;
        }
        targetValue = groupObj;
      }
    } else if (item.type === "file" || item.fileType) {
      const { key, value } = await processSingleMedia(item);
      targetKey = key;
      targetValue = value;
    } else {
      // Text or JSON message
      const textContent = typeof item.content === "string" ? item.content : String(item.content ?? "");
      const trimmed = textContent.trim();
      let isJson = false;
      let parsedJson: any = null;

      if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
        try {
          parsedJson = JSON.parse(trimmed);
          isJson = true;
        } catch {
          // not json
        }
      }

      if (isJson) {
        targetKey = `data_${Date.now()}`;
        targetValue = parsedJson;
      } else {
        const snippet = trimmed.slice(0, 28);
        const cleaned = toNodeKey(snippet);
        targetKey = cleaned && cleaned !== "untitled" ? cleaned : `msg_${Date.now()}`;
        targetValue = textContent;
      }
    }

    // Insert into visualizer parsedData & update code
    let currentData: any =
      parsedData && typeof parsedData === "object" && !Array.isArray(parsedData)
        ? JSON.parse(JSON.stringify(parsedData))
        : parsedData == null
          ? {}
          : { _previousData: parsedData };

    const finalKey = uniqueKey(currentData, targetKey);
    currentData[finalKey] = targetValue;

    let nextCode: string;
    if (codeFormat === "yaml") {
      try {
        const yaml = (await import("js-yaml")).default;
        nextCode = yaml.dump(currentData);
      } catch {
        nextCode = JSON.stringify(currentData, null, 2);
      }
    } else {
      nextCode = JSON.stringify(currentData, null, 2);
    }

    setCode(nextCode, false);
    const finalPath = `root.${finalKey}`;
    setSelectedNodeId(finalPath);

    setNotification({
      type: "success",
      message: `Added "${finalKey}" to canvas as node`,
    });

    return finalPath;
  } catch (err: any) {
    console.error("Error adding message to canvas:", err);
    setNotification({
      type: "error",
      message: `Failed to add message to canvas: ${err?.message || "Unknown error"}`,
    });
    return null;
  }
}
