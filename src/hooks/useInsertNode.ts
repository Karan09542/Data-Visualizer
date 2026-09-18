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

export type InsertKind = "text" | "image";

export interface InsertRequest {
  /** Becomes the node key, after cleaning. */
  name: string;
  /** Article text for a text node, or an image URL for an image node. */
  value: string;
  kind: InsertKind;
  /** Dotted path of the parent, "root" for the top level. */
  parentPath?: string;
}

/**
 * Adds a node to the tree the same way the file explorer does: write the value at a path, then
 * hand the whole tree back as text, because the document of record here is the code, not the
 * parsed object. Note that updateNodeValue cannot be used for this — it refuses paths that do
 * not already exist, to stop deleted nodes coming back.
 */
export function useInsertNode() {
  const parsedData = useStore((s) => s.parsedData);
  const setCode = useStore((s) => s.setCode);
  const codeFormat = useStore((s) => s.codeFormat);

  return useCallback(
    async ({ name, value, kind, parentPath = "root" }: InsertRequest) => {
      if (!parsedData) return null;

      const base = toNodeKey(name);
      // The suffix is what makes the canvas render it as an image rather than a string
      const withKind = kind === "image" ? `${base}_image_node` : base;

      const parentValue = getValueAtPath(
        parsedData,
        parentPath === "root" ? "" : parentPath,
      );
      const key = uniqueKey(parentValue, withKind);
      const finalPath = parentPath === "root" ? `root.${key}` : `${parentPath}.${key}`;

      const updated = setValueAtPath(parsedData, finalPath, value);

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
      return finalPath;
    },
    [parsedData, setCode, codeFormat],
  );
}
