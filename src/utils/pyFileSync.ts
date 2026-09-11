/**
 * Bringing back what Python wrote.
 *
 * A run is given the workspace as files inside the Python runtime. Anything the script writes -
 * `open(path, "w")`, `os.remove`, a new file - happens in the runtime's own file system and used
 * to be thrown away when the run ended, so a file looked unchanged in the explorer no matter what
 * the script did.
 *
 * The worker reports what the files look like afterwards; this turns that into changes to the
 * workspace tree: an existing file's new contents, a file that appeared, a file that went.
 */
import { getValueAtPath, setValueAtPath, deleteValueAtPath } from "./pathUtils";

import { buildVfsMap, fileNameToNodeKey } from "./vfs";

export interface WorkspaceFileChange {
  /** Where it lives in the Python file system: "/om.txt", "/src/notes.md". */
  path: string;
  /** Its contents, or null when it was removed. */
  content: string | null;
}

export interface AppliedFileChanges {
  data: any;
  created: string[];
  updated: string[];
  removed: string[];
  /** Files left alone, with the reason - a path the workspace cannot hold, say. */
  skipped: { path: string; reason: string }[];
}

/** A file's own name, and the directory holding it. */
const splitPath = (path: string) => {
  const clean = path.replace(/\/+$/, "");
  const cut = clean.lastIndexOf("/");
  return { dir: cut <= 0 ? "/" : clean.slice(0, cut), name: clean.slice(cut + 1) };
};

/** Where a directory sits in the tree: "/" is the root, "/src" is "root.src". */
const dotPathOfDirectory = (dir: string) => {
  if (dir === "/" || dir === "") return "root";
  return `root${dir.split("/").filter(Boolean).map((part) => `.${part}`).join("")}`;
};

/**
 * Applies what a Python run left behind to the workspace tree, returning the new tree and what
 * changed. Nothing outside the workspace - the standard library, temporary files - is touched:
 * the worker only ever reports files from the workspace's own folders.
 */
export function applyFileChanges(parsedData: any, changes: WorkspaceFileChange[]): AppliedFileChanges {
  const owners = buildVfsMap(parsedData); // "/om.txt" -> "root.om_txt"
  let data = parsedData;
  const created: string[] = [];
  const updated: string[] = [];
  const removed: string[] = [];
  const skipped: { path: string; reason: string }[] = [];

  for (const change of changes) {
    const existing = owners[change.path];

    if (change.content === null) {
      if (!existing) continue; // never ours to begin with
      data = deleteValueAtPath(data, existing);
      removed.push(change.path);
      continue;
    }

    if (existing) {
      if (getValueAtPath(data, existing) === change.content) continue;
      data = setValueAtPath(data, existing, change.content);
      updated.push(change.path);
      continue;
    }

    // A file the script made. Its folder may be new as well, in which case it is made too.
    const { dir, name } = splitPath(change.path);
    const key = fileNameToNodeKey(name);
    if (!key) {
      skipped.push({ path: change.path, reason: "its name cannot be a node" });
      continue;
    }
    const parent = dotPathOfDirectory(dir);
    const target = `${parent}.${key}`;
    const holder = getValueAtPath(data, parent);
    if (holder !== undefined && (typeof holder !== "object" || holder === null || Array.isArray(holder))) {
      skipped.push({ path: change.path, reason: `"${dir}" is not a folder here` });
      continue;
    }
    data = setValueAtPath(data, target, change.content);
    created.push(change.path);
  }

  return { data, created, updated, removed, skipped };
}

/** What to tell the reader in the console, or null when a run changed nothing. */
export function describeFileChanges(applied: AppliedFileChanges): string | null {
  const parts: string[] = [];
  const list = (paths: string[]) => paths.map((p) => p.replace(/^\//, "")).join(", ");
  if (applied.created.length) parts.push(`created ${list(applied.created)}`);
  if (applied.updated.length) parts.push(`updated ${list(applied.updated)}`);
  if (applied.removed.length) parts.push(`removed ${list(applied.removed)}`);
  for (const skip of applied.skipped) parts.push(`left ${skip.path.replace(/^\//, "")} alone (${skip.reason})`);
  return parts.length ? `[Files]: ${parts.join("; ")}.` : null;
}
