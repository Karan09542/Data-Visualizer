/**
 * Reading and writing todo lists in the workspace document. The canvas node, the
 * Todo workspace and the productivity layer all save through `writeTodoList`, so
 * an edit in any of them shows up in the others and none overwrites another's.
 */
import { useEffect, useMemo } from "react";
import { useStore } from "../../store/useStore";
import { getValueAtPath, setValueAtPath } from "../../utils/pathUtils";
import { emptyTodoList, syncCompletion, type TodoNodeData, type TodoTask } from "./todoModel";

/** A list as stored: either an object or a JSON string holding one. */
export function parseTodoValue(value: unknown): { data: TodoNodeData; wasString: boolean } {
  let parsed: any = value;
  const wasString = typeof value === "string";
  if (wasString) {
    try {
      parsed = JSON.parse(value as string);
    } catch {
      return { data: emptyTodoList(), wasString };
    }
  }
  if (!parsed || typeof parsed !== "object") return { data: emptyTodoList(), wasString };
  return {
    data: {
      ...parsed,
      title: typeof parsed.title === "string" ? parsed.title : "Tasks",
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    },
    wasString,
  };
}

export const readTodoList = (parsedData: any, path: string): TodoNodeData =>
  parseTodoValue(getValueAtPath(parsedData, path)).data;

/** The list at `path`, kept up to date with every change from any view. */
export function useTodoList(path: string): TodoNodeData {
  const raw = useStore((s) => getValueAtPath(s.parsedData, path));
  // Load the YAML serializer up front so the first edit can save immediately.
  useEffect(() => {
    void prepareTodoSerializer();
  }, []);
  return useMemo(() => parseTodoValue(raw).data, [raw]);
}

let yamlModule: { dump: (v: unknown) => string } | null = null;
let yamlLoadFailed = false;

const serializeDocument = (doc: unknown) =>
  useStore.getState().codeFormat === "yaml" && yamlModule
    ? yamlModule.dump(doc)
    : JSON.stringify(doc, null, 2);

/** Whether a save can happen right now, without waiting for the YAML serializer. */
const serializerReady = () =>
  useStore.getState().codeFormat !== "yaml" || !!yamlModule || yamlLoadFailed;

/** Loads the YAML serializer if the document is YAML. Safe to call repeatedly. */
export async function prepareTodoSerializer(): Promise<void> {
  if (serializerReady()) return;
  try {
    yamlModule = (await import("js-yaml")).default;
  } catch {
    yamlLoadFailed = true; // falls back to JSON
  }
}

/**
 * Runs `fn` now if the serializer is ready, otherwise once it is. Saving
 * synchronously matters for text fields: a save that lands a tick later makes
 * React briefly restore the old value and the caret jumps to the end.
 */
function whenSerializerReady<T>(fn: () => T): Promise<T> {
  return serializerReady() ? Promise.resolve(fn()) : prepareTodoSerializer().then(fn);
}

export interface WriteOptions {
  /**
   * Recompute parent completion from subtasks (default). Off in flat views,
   * where tasks are edited independently of their parents.
   */
  sync?: boolean;
}

/**
 * Applies `update` to the list at `path` and saves the document. Returns the
 * saved list, or null if `update` returned null (nothing to change).
 *
 * Everything asynchronous (loading the YAML serializer) happens before the list
 * is read; the read, the update and the save then run in one synchronous step.
 * So two quick edits — from the same view or different ones — always build on
 * each other instead of the later one overwriting the earlier.
 */
export function writeTodoList(
  path: string,
  update: (list: TodoNodeData) => TodoNodeData | null,
  { sync = true }: WriteOptions = {},
): Promise<TodoNodeData | null> {
  // Read, update and save in one synchronous step, against the latest state.
  return whenSerializerReady(() => {
    const { parsedData, setCode } = useStore.getState();
    const { data, wasString } = parseTodoValue(getValueAtPath(parsedData, path));
    let next = update(data);
    if (!next) return null;
    if (sync) next = { ...next, tasks: syncCompletion(next.tasks || []) };

    // Keep the stored shape: a list saved as a JSON string stays a string.
    const stored = wasString ? JSON.stringify(next, null, 2) : next;
    setCode(serializeDocument(setValueAtPath(parsedData, path, stored)));
    return next;
  });
}

/** Shorthand for changing only the tasks. */
export const writeTasks = (
  path: string,
  update: (tasks: TodoTask[]) => TodoTask[] | null,
  options?: WriteOptions,
) =>
  writeTodoList(
    path,
    (list) => {
      const tasks = update(list.tasks || []);
      return tasks ? { ...list, tasks } : null;
    },
    options,
  );

/** Creates a new list at the top of the workspace and returns its path. */
export function createTodoList(name: string): Promise<string | null> {
  const clean = name.trim();
  if (!clean) return Promise.resolve(null);
  return whenSerializerReady(() => {
    const { parsedData, setCode } = useStore.getState();
    const base = clean.replace(/\s+/g, "_");
    let key = `${base}_todo_node`;
    // Never overwrite an existing list with the same name.
    for (let n = 2; parsedData && typeof parsedData === "object" && key in parsedData; n++) {
      key = `${base}_${n}_todo_node`;
    }
    const path = `root.${key}`;
    // Stored as a JSON string, as lists created from the productivity layer always were.
    const value = JSON.stringify({ title: clean, tasks: [] }, null, 2);
    setCode(serializeDocument(setValueAtPath(parsedData, path, value)));
    return path;
  });
}

// ─── Discovery ─────────────────────────────────────────────────────────────────

export const isTodoListKey = (key: string) => {
  const k = key.toLowerCase();
  return k.endsWith("_todo_node") || k.endsWith(".todo");
};

export const todoListName = (key: string) =>
  key.toLowerCase().endsWith(".todo") ? key : key.replace(/_todo_node$/i, ".todo");

/** Every todo list in the document, with its path and file name. */
export function findTodoLists(data: any, path = "root"): { path: string; name: string; list: TodoNodeData }[] {
  if (!data || typeof data !== "object") return [];
  const out: { path: string; name: string; list: TodoNodeData }[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "function") continue;
    const childPath = path === "root" ? `root.${key}` : `${path}.${key}`;
    if (isTodoListKey(key)) {
      out.push({ path: childPath, name: todoListName(key), list: parseTodoValue(value).data });
    } else if (value && typeof value === "object") {
      out.push(...findTodoLists(value, childPath));
    }
  }
  return out;
}
