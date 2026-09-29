import { useCallback } from "react";
import { useStore } from "../store/useStore";
import { getValueAtPath, setValueAtPath } from "../utils/pathUtils";

/**
 * Turns arbitrary prose into something usable as a key in the JSON tree.
 *
 * Article titles and section headings arrive with spaces, punctuation and the occasional
 * parenthetical ("Mercury (planet)"), none of which belong in a dotted path, since the path
 * is split on dots to address the tree.
 */
export function toNodeKey(raw: string): string {
  const cleaned = raw
    .replace(/^File:/i, "")
    .replace(/\.(jpe?g|png|gif|svg|webp)$/i, "")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");

  // A key of digits alone reads as an array index further down, so it gets a prefix
  const safe = /^\d/.test(cleaned) ? `n_${cleaned}` : cleaned;
  return safe.slice(0, 60) || "untitled";
}

/** Appends _2, _3 … until the key is free, so an insert never silently overwrites. */
export function uniqueKey(parent: unknown, key: string): string {
  if (!parent || typeof parent !== "object") return key;
  const siblings = parent as Record<string, unknown>;
  if (!(key in siblings)) return key;

  let n = 2;
  while (`${key}_${n}` in siblings) n++;
  return `${key}_${n}`;
}

/**
 * - text:  the value is text.
 * - image: the value is an image URL; the key gets `_image_node` so it renders as one.
 * - asset: the value is a stored asset id (`img_….png`, see assetManager), which
 *          renders as its media by itself, so the key is left as it is.
 */
export type InsertKind = "text" | "image" | "asset";

export interface InsertRequest {
  /** Becomes the node key, after cleaning. */
  name: string;
  /** Article text for a text node, an image URL, or an asset id (or an object of them). */
  value: string | Record<string, unknown>;
  kind: InsertKind;
  /** Dotted path of the parent, "root" for the top level. */
  parentPath?: string;
}

/**
 * Adds nodes to the tree the same way the file explorer does: write each value at a path, then
 * hand the whole tree back as text, because the document of record here is the code, not the
 * parsed object. Note that updateNodeValue cannot be used for this — it refuses paths that do
 * not already exist, to stop deleted nodes coming back.
 *
 * Reads the store as it is now and writes once, so several nodes added together (or one added
 * while another is still being written) never overwrite each other. Returns the new paths.
 */
export async function insertNodes(requests: InsertRequest[]): Promise<string[]> {
  const { parsedData, setCode, codeFormat } = useStore.getState();
  // An empty document starts a fresh tree; anything that isn't an object is kept under a key.
  let updated: any =
    parsedData && typeof parsedData === "object" && !Array.isArray(parsedData)
      ? parsedData
      : parsedData == null
        ? {}
        : { _previousData: parsedData };

  const paths: string[] = [];
  for (const { name, value, kind, parentPath = "root" } of requests) {
    const base = toNodeKey(name);
    // The suffix is what makes the canvas render a URL as an image rather than a string
    const withKind = kind === "image" ? `${base}_image_node` : base;

    // (getValueAtPath gives nothing for the root itself, which let a new node replace a sibling.)
    const parentValue = parentPath === "root" ? updated : getValueAtPath(updated, parentPath);
    const key = uniqueKey(parentValue, withKind);
    const finalPath = parentPath === "root" ? `root.${key}` : `${parentPath}.${key}`;
    updated = setValueAtPath(updated, finalPath, value);
    paths.push(finalPath);
  }
  if (paths.length === 0) return paths;

  let nextCode: string;
  if (codeFormat === "yaml") {
    try {
      const yaml = (await import("js-yaml")).default;
      nextCode = yaml.dump(updated);
    } catch {
      nextCode = JSON.stringify(updated, null, 2);
    }
  } else {
    nextCode = JSON.stringify(updated, null, 2);
  }

  setCode(nextCode);
  return paths;
}

export function useInsertNode() {
  return useCallback(async (request: InsertRequest) => {
    const [path] = await insertNodes([request]);
    return path ?? null;
  }, []);
}
