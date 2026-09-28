/**
 * The one definition of a todo list and every change that can be made to it.
 *
 * The canvas node, the Todo workspace and the productivity layer (Alt+T) all edit
 * the same stored lists, so they all go through these functions. Every function is
 * pure and returns new arrays — never mutates what it's given — because the task
 * arrays passed in usually come straight out of the store.
 */

export type TodoStatus = "Todo" | "In Progress" | "Blocked" | "Review" | "Completed";
export type TodoPriority = "Critical" | "High" | "Medium" | "Low" | "Normal";

export interface TodoTask {
  id: string;
  text: string;
  completed: boolean;
  status?: TodoStatus;
  priority?: TodoPriority;
  dueDate?: string;
  tags?: string[];
  notes?: string;
  tasks?: TodoTask[];
  imageHashes?: string[];
}

export interface TodoNodeData {
  title: string;
  tasks: TodoTask[];
}

/** Longest task title, in characters. */
export const MAX_TASK_TEXT = 200;
/** Longest list title, in characters. */
export const MAX_LIST_TITLE = 50;
/** Priority given to new tasks, and assumed for tasks that have none. */
export const DEFAULT_PRIORITY: TodoPriority = "Normal";
export const PRIORITIES: TodoPriority[] = ["Critical", "High", "Medium", "Low", "Normal"];

export const emptyTodoList = (): TodoNodeData => ({ title: "Tasks", tasks: [] });

export const newTaskId = () => Math.random().toString(36).slice(2, 11);

export function createTask(text = "", overrides: Partial<TodoTask> = {}): TodoTask {
  return {
    id: newTaskId(),
    text: text.trim().slice(0, MAX_TASK_TEXT),
    completed: false,
    status: "Todo",
    priority: DEFAULT_PRIORITY,
    ...overrides,
  };
}

export const isTaskDone = (t: Pick<TodoTask, "completed" | "status">) =>
  !!t.completed || t.status === "Completed";

export const priorityOf = (t: Pick<TodoTask, "priority">): TodoPriority => t.priority || DEFAULT_PRIORITY;

/** Whether any subtask, at any depth, is still open. */
export function hasIncompleteChildren(tasks?: TodoTask[]): boolean {
  return !!tasks?.some((t) => !isTaskDone(t) || hasIncompleteChildren(t.tasks));
}

export function countTasks(tasks: TodoTask[] = []): { total: number; completed: number } {
  let total = 0;
  let completed = 0;
  const walk = (list: TodoTask[]) => {
    for (const t of list) {
      total++;
      if (isTaskDone(t)) completed++;
      if (t.tasks) walk(t.tasks);
    }
  };
  walk(tasks);
  return { total, completed };
}

export function findTask(tasks: TodoTask[] = [], id: string): TodoTask | null {
  for (const t of tasks) {
    if (t.id === id) return t;
    const inner = findTask(t.tasks, id);
    if (inner) return inner;
  }
  return null;
}

/** Whether `targetId` is `ancestorId` itself or somewhere beneath it. */
export function isDescendantOf(ancestorId: string, targetId: string, tasks: TodoTask[] = []): boolean {
  const ancestor = findTask(tasks, ancestorId);
  return !!ancestor && (ancestor.id === targetId || !!findTask(ancestor.tasks, targetId));
}

/** Tasks in display order, with depth. Children of `collapsed` ids are skipped. */
export function flattenTasks(
  tasks: TodoTask[] = [],
  collapsed: ReadonlySet<string> | readonly string[] = [],
): { task: TodoTask; depth: number; parentId?: string }[] {
  const isCollapsed = (id: string) =>
    Array.isArray(collapsed) ? collapsed.includes(id) : (collapsed as ReadonlySet<string>).has(id);
  const out: { task: TodoTask; depth: number; parentId?: string }[] = [];
  const walk = (list: TodoTask[], depth: number, parentId?: string) => {
    for (const t of list) {
      out.push({ task: t, depth, parentId });
      if (t.tasks?.length && !isCollapsed(t.id)) walk(t.tasks, depth + 1, t.id);
    }
  };
  walk(tasks, 0);
  return out;
}

// ─── Completion ────────────────────────────────────────────────────────────────

/**
 * A parent is done exactly when all its subtasks are. A parent that's reopened
 * this way goes back to "Todo" only if it was "Completed"; any other status the
 * user set (In Progress, Blocked, Review) is kept.
 */
export function syncCompletion(tasks: TodoTask[] = []): TodoTask[] {
  return tasks.map((t) => {
    if (!t.tasks || t.tasks.length === 0) return t;
    const children = syncCompletion(t.tasks);
    const allDone = children.every(isTaskDone);
    return {
      ...t,
      tasks: children,
      completed: allDone,
      status: allDone ? "Completed" : t.status === "Completed" ? "Todo" : t.status,
    };
  });
}

/** Rewrites one task in place in the tree. */
export function mapTask(tasks: TodoTask[] = [], id: string, fn: (t: TodoTask) => TodoTask): TodoTask[] {
  return tasks.map((t) => {
    if (t.id === id) return fn(t);
    if (t.tasks?.length) return { ...t, tasks: mapTask(t.tasks, id, fn) };
    return t;
  });
}

/**
 * Merges `patch` into a task, keeping `status` and `completed` consistent: setting
 * one updates the other.
 */
export function updateTask(tasks: TodoTask[], id: string, patch: Partial<TodoTask>): TodoTask[] {
  return mapTask(tasks, id, (t) => {
    const merged: TodoTask = { ...t, ...patch };
    if (typeof merged.text === "string" && merged.text.length > MAX_TASK_TEXT) {
      merged.text = merged.text.slice(0, MAX_TASK_TEXT);
    }
    if (patch.status !== undefined) merged.completed = patch.status === "Completed";
    if (patch.completed === true) merged.status = "Completed";
    else if (patch.completed === false && t.status === "Completed") merged.status = "Todo";
    return merged;
  });
}

const setDoneDeep = (t: TodoTask, done: boolean): TodoTask => ({
  ...t,
  completed: done,
  status: done ? "Completed" : "Todo",
  tasks: t.tasks?.map((c) => setDoneDeep(c, done)),
});

/**
 * Marks a task done or not done. With `withSubtasks`, its subtasks follow (tree
 * view); without, only the task itself changes (flat view).
 */
export function setTaskDone(tasks: TodoTask[], id: string, done: boolean, withSubtasks = true): TodoTask[] {
  return mapTask(tasks, id, (t) =>
    withSubtasks
      ? setDoneDeep(t, done)
      : { ...t, completed: done, status: done ? "Completed" : t.status === "Completed" ? "Todo" : t.status },
  );
}

/**
 * `updateTask` for edits made by the user. When the edit completes or reopens a
 * task that has subtasks, the subtasks follow (with `cascade`, i.e. tree view).
 * Without that, reopening a parent whose subtasks are all done would be undone
 * straight away by `syncCompletion`, which re-derives the parent from them.
 */
export function editTask(tasks: TodoTask[], id: string, patch: Partial<TodoTask>, cascade = true): TodoTask[] {
  const task = findTask(tasks, id);
  if (!task) return tasks;
  const wasDone = isTaskDone(task);
  const willBeDone =
    patch.status !== undefined ? patch.status === "Completed"
      : patch.completed !== undefined ? patch.completed
        : wasDone;
  const next = cascade && willBeDone !== wasDone && task.tasks?.length
    ? setTaskDone(tasks, id, willBeDone, true)
    : tasks;
  return updateTask(next, id, patch);
}

export function clearCompleted(tasks: TodoTask[] = []): TodoTask[] {
  return tasks
    .filter((t) => !isTaskDone(t))
    .map((t) => (t.tasks?.length ? { ...t, tasks: clearCompleted(t.tasks) } : t));
}

export function resetProgress(tasks: TodoTask[] = []): TodoTask[] {
  return tasks.map((t) => ({
    ...t,
    completed: false,
    status: "Todo" as TodoStatus,
    tasks: t.tasks ? resetProgress(t.tasks) : t.tasks,
  }));
}

// ─── Structure ─────────────────────────────────────────────────────────────────

export function removeTask(tasks: TodoTask[] = [], id: string): TodoTask[] {
  return tasks
    .filter((t) => t.id !== id)
    .map((t) => (t.tasks?.length ? { ...t, tasks: removeTask(t.tasks, id) } : t));
}

/** Adds a task at the end of the list, or at the end of `parentId`'s subtasks. */
export function addTask(tasks: TodoTask[] = [], task: TodoTask, parentId?: string): TodoTask[] {
  if (!parentId) return [...tasks, task];
  return mapTask(tasks, parentId, (p) => ({ ...p, tasks: [...(p.tasks || []), task] }));
}

/** Inserts a task directly after `siblingId`, at the same level. */
export function insertAfter(tasks: TodoTask[] = [], siblingId: string, task: TodoTask): TodoTask[] {
  const i = tasks.findIndex((t) => t.id === siblingId);
  if (i >= 0) return [...tasks.slice(0, i + 1), task, ...tasks.slice(i + 1)];
  return tasks.map((t) => (t.tasks?.length ? { ...t, tasks: insertAfter(t.tasks, siblingId, task) } : t));
}

/** Detaches a task from wherever it is. */
function extractTask(tasks: TodoTask[], id: string): { tasks: TodoTask[]; task: TodoTask | null; parentId: string | null } {
  let task: TodoTask | null = null;
  let parentId: string | null = null;
  const walk = (list: TodoTask[], parent: string | null): TodoTask[] =>
    list
      .filter((t) => {
        if (t.id === id) {
          task = t;
          parentId = parent;
          return false;
        }
        return true;
      })
      .map((t) => (t.tasks?.length ? { ...t, tasks: walk(t.tasks, t.id) } : t));
  const rest = walk(tasks, null);
  return { tasks: rest, task, parentId };
}

/**
 * Makes a task the last subtask of the sibling above it. Returns null when there
 * is no sibling above. `parentId` is the new parent, so the caller can expand it.
 */
export function indentTask(tasks: TodoTask[] = [], id: string): { tasks: TodoTask[]; parentId: string } | null {
  const i = tasks.findIndex((t) => t.id === id);
  if (i > 0) {
    const prev = tasks[i - 1];
    const next = tasks.filter((t) => t.id !== id);
    return {
      tasks: next.map((t) => (t.id === prev.id ? { ...t, tasks: [...(t.tasks || []), tasks[i]] } : t)),
      parentId: prev.id,
    };
  }
  if (i === 0) return null;
  for (let k = 0; k < tasks.length; k++) {
    const inner = tasks[k].tasks?.length ? indentTask(tasks[k].tasks, id) : null;
    if (inner) {
      const copy = [...tasks];
      copy[k] = { ...tasks[k], tasks: inner.tasks };
      return { tasks: copy, parentId: inner.parentId };
    }
  }
  return null;
}

/** Moves a subtask up one level, directly after its parent. Null at top level. */
export function outdentTask(tasks: TodoTask[] = [], id: string): TodoTask[] | null {
  const { tasks: rest, task, parentId } = extractTask(tasks, id);
  if (!task || !parentId) return null;
  return insertAfter(rest, parentId, task);
}

/** Swaps a task with its neighbour. Null when it's already at that end. */
export function moveTask(tasks: TodoTask[] = [], id: string, direction: "up" | "down"): TodoTask[] | null {
  const i = tasks.findIndex((t) => t.id === id);
  if (i >= 0) {
    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= tasks.length) return null;
    const copy = [...tasks];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  }
  for (let k = 0; k < tasks.length; k++) {
    const inner = tasks[k].tasks?.length ? moveTask(tasks[k].tasks, id, direction) : null;
    if (inner) {
      const copy = [...tasks];
      copy[k] = { ...tasks[k], tasks: inner };
      return copy;
    }
  }
  return null;
}

/** Drag and drop: puts a task before, after or inside another. */
export function moveTaskTo(
  tasks: TodoTask[] = [],
  draggedId: string,
  targetId: string,
  position: "before" | "after" | "inside",
): TodoTask[] | null {
  if (draggedId === targetId || isDescendantOf(draggedId, targetId, tasks)) return null;
  const { tasks: rest, task } = extractTask(tasks, draggedId);
  if (!task) return null;
  const place = (list: TodoTask[]): TodoTask[] =>
    list.flatMap((t) => {
      if (t.id === targetId) {
        if (position === "before") return [task, t];
        if (position === "after") return [t, task];
        return [{ ...t, tasks: [...(t.tasks || []), task] }];
      }
      return [t.tasks?.length ? { ...t, tasks: place(t.tasks) } : t];
    });
  return place(rest);
}

const cloneDeep = (t: TodoTask, isRoot: boolean): TodoTask => ({
  ...t,
  id: newTaskId(),
  text: isRoot ? (t.text ? `${t.text} (copy)`.slice(0, MAX_TASK_TEXT) : "Copy") : t.text,
  tasks: t.tasks?.map((c) => cloneDeep(c, false)),
});

/** Copies a task and its subtasks, placing the copy right after it. */
export function duplicateTask(tasks: TodoTask[] = [], id: string): { tasks: TodoTask[]; copyId: string } | null {
  const original = findTask(tasks, id);
  if (!original) return null;
  const copy = cloneDeep(original, true);
  return { tasks: insertAfter(tasks, id, copy), copyId: copy.id };
}
