import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { TreeNode } from "../utils/transformer";
import { useStore } from "../store/useStore";
import {
  Plus,
  Maximize2,
  ListTodo,
  MoreVertical,
  Layers,
  FolderTree,
  Trash2,
  Pencil,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  CornerDownRight,
  CornerLeftUp,
  PlusCircle,
  ExternalLink
} from "lucide-react";
import { TaskImagePreview } from "./TaskImagePreview";
import { ConfirmModal } from "./ConfirmModal";
import * as todo from "./todo/todoModel";
import { useTodoList, writeTasks, writeTodoList } from "./todo/todoStorage";
import {
  LengthHint,
  MENU_CLASS,
  MenuDivider,
  MenuItem,
  PriorityBadge,
  PriorityPicker,
  TaskCheckbox,
} from "./todo/TodoUI";

// The shared model owns these types; re-exported for existing imports.
export type { TodoTask, TodoNodeData } from "./todo/todoModel";
type TodoTask = todo.TodoTask;

// Fixed section heights, so the node's size can be computed exactly.
const HEADER_H = 84;
const FOOTER_H = 44;
const ROW_H = 38;
const EMPTY_H = 150;
const MAX_ROWS = 8;

const ICON_BUTTON =
  "h-7 w-7 flex items-center justify-center rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer";

const SAMPLE_TASKS = (): TodoTask[] => [
  todo.createTask("Database layer setup", {
    priority: "High",
    tasks: [
      todo.createTask("Set up the Redis server", { completed: true, status: "Completed" }),
      todo.createTask("Add a Redis caching layer", { completed: true, status: "Completed" }),
      todo.createTask("Optimize slow database queries", { priority: "High" }),
    ],
  }),
  todo.createTask("Backend security", {
    priority: "Medium",
    tasks: [
      todo.createTask("Add rate limiting", { priority: "Medium" }),
      todo.createTask("Write integration tests", { priority: "Low" }),
    ],
  }),
];

interface TodoNodeProps {
  nodeId: string;
  data: TreeNode;
  isExpanded: boolean;
  onResize?: (width: number, height: number) => void;
}

export function TodoNodeRenderer({ nodeId, data, isExpanded, onResize }: TodoNodeProps) {
  const setExpandedJsNodeId = useStore((state) => state.setExpandedJsNodeId);
  const setCustomNodeSize = useStore((state) => state.setCustomNodeSize);
  const nodeSizes = useStore((state) => state.nodeSizes);
  const setSelectedNodeId = useStore((state) => state.setSelectedNodeId);
  const setNotification = useStore((state) => state.setNotification);
  const customSize = nodeSizes[nodeId];

  // Read live from the document: edits made in the workspace or with Alt+T show
  // up here straight away, and every change below saves through the shared store.
  const path = data.path;
  const todoData = useTodoList(path);

  // Compact state internally toggles Tree vs Flat view in this node
  const [nodeIsFlat, setNodeIsFlat] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [collapsedTaskIds, setCollapsedTaskIds] = useState<string[]>([]);
  const [activeMenuTaskId, setActiveMenuTaskId] = useState<string | null>(null);
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [isFooterInputFocused, setIsFooterInputFocused] = useState(false);
  // Bulk actions that can't be undone wait here for confirmation.
  const [pendingBulkAction, setPendingBulkAction] = useState<
    "clearAll" | "clearCompleted" | "reset" | "samples" | null
  >(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  useLayoutEffect(() => {
    if (isMenuOpen && menuButtonRef.current && dropdownRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect();
      const menuRect = dropdownRef.current.getBoundingClientRect();

      let top = rect.bottom + 4;
      let left = rect.right - menuRect.width;

      if (top + menuRect.height > window.innerHeight) {
        top = rect.top - menuRect.height - 4;
      }

      setMenuStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        zIndex: 999999,
      });
    }
  }, [isMenuOpen]);

  // Handle click outside to close options menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("touchstart", handleClickOutside, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("touchstart", handleClickOutside, true);
    };
  }, []);

  /**
   * Saves a change to the tasks. In tree view parents follow their subtasks'
   * completion; in flat view each task is edited on its own.
   */
  const saveTasks = (update: (tasks: TodoTask[]) => TodoTask[] | null, resync = false) =>
    writeTasks(path, update, { sync: resync || !nodeIsFlat });

  const saveTitle = (title: string) =>
    writeTodoList(path, (list) => ({ ...list, title: title.slice(0, todo.MAX_LIST_TITLE) }), { sync: false });

  const { total, completed } = todo.countTasks(todoData.tasks);
  const remaining = total - completed;
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

  const toggleTaskComplete = (taskId: string) =>
    saveTasks((tasks) => {
      const task = todo.findTask(tasks, taskId);
      return task ? todo.setTaskDone(tasks, taskId, !todo.isTaskDone(task), !nodeIsFlat) : null;
    });

  const startEditingTask = (taskId: string, currentText: string) => {
    setEditingTaskId(taskId);
    setEditingText(currentText);
  };

  const saveEditedTaskName = (taskId: string, newText: string) => {
    setEditingTaskId(null);
    if (!newText.trim()) return;
    saveTasks((tasks) => todo.updateTask(tasks, taskId, { text: newText.trim() }));
  };

  const setTaskPriority = (taskId: string, priority: todo.TodoPriority) =>
    saveTasks((tasks) => todo.updateTask(tasks, taskId, { priority }));

  const handleAddNewTask = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTaskText.trim()) return;
    const task = todo.createTask(newTaskText);
    saveTasks((tasks) => todo.addTask(tasks, task));
    setNewTaskText("");
  };

  const deleteTask = (taskId: string) => saveTasks((tasks) => todo.removeTask(tasks, taskId));

  const openWorkspace = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedJsNodeId(data.path);
  };

  const clearCompletedTasks = () => {
    saveTasks(todo.clearCompleted);
    setIsMenuOpen(false);
  };

  const resetAllTasks = () => {
    saveTasks(todo.resetProgress);
    setIsMenuOpen(false);
  };

  const clearAllTasks = () => {
    saveTasks(() => []);
    setIsMenuOpen(false);
  };

  const addSampleTasks = () => {
    saveTasks(() => SAMPLE_TASKS(), true);
    setIsMenuOpen(false);
  };

  const expandParent = (parentId: string) =>
    setCollapsedTaskIds((prev) => prev.filter((x) => x !== parentId));

  // Tab / Shift+Tab while renaming: keep editing the same task at its new level.
  const indentTask = (id: string) => {
    saveTasks((tasks) => {
      const result = todo.indentTask(tasks, id);
      if (!result) return null;
      expandParent(result.parentId);
      return result.tasks;
    });
    setTimeout(() => startEditingTask(id, editingText), 50);
  };

  const outdentTask = (id: string) => {
    saveTasks((tasks) => todo.outdentTask(tasks, id));
    setTimeout(() => startEditingTask(id, editingText), 50);
  };

  const moveTaskInTree = (id: string, direction: "up" | "down") =>
    saveTasks((tasks) => todo.moveTask(tasks, id, direction));

  const addNestedSubtask = (parentId: string) => {
    const task = todo.createTask("");
    expandParent(parentId);
    saveTasks((tasks) => todo.addTask(tasks, task, parentId));
    setEditingTaskId(task.id);
    setEditingText("");
    setNodeIsFlat(false);
  };

  const toggleCollapseTask = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCollapsedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const collapseAllSubtasks = () => {
    setCollapsedTaskIds(
      todo.flattenTasks(todoData.tasks).filter((x) => x.task.tasks?.length).map((x) => x.task.id),
    );
    setIsMenuOpen(false);
  };

  const expandAllSubtasks = () => {
    setCollapsedTaskIds([]);
    setIsMenuOpen(false);
  };

  // Rows in display order: every task in flat view, collapsed subtrees skipped in tree view.
  const flatTasks = todo.flattenTasks(todoData.tasks, nodeIsFlat ? [] : collapsedTaskIds);

  // The list shows up to MAX_ROWS rows before scrolling (at least 3, so a task that
  // wraps onto two lines doesn't immediately need a scrollbar).
  const listHeight =
    flatTasks.length === 0
      ? EMPTY_H
      : Math.max(3, Math.min(flatTasks.length, MAX_ROWS)) * ROW_H;

  // Auto handle resizing: the node is exactly header + list + footer tall.
  useEffect(() => {
    const targetWidth = 385;
    const calculatedHeight = isExpanded ? HEADER_H + listHeight + FOOTER_H + 2 : 130;

    if (!customSize || customSize.width !== targetWidth || customSize.height !== calculatedHeight) {
      setCustomNodeSize(nodeId, targetWidth, calculatedHeight);
    }

    if (onResize) {
      onResize(targetWidth, calculatedHeight);
    }
  }, [isExpanded, total, nodeId, nodeIsFlat, customSize, setCustomNodeSize, onResize, listHeight]);

  const tasksToRender = nodeIsFlat
    ? flatTasks.map((item) => ({ ...item, depth: 0 }))
    : flatTasks;

  const nodeName =
    typeof data.name === "string" ? data.name.replace("_todo_node", "").replace(".todo", "") : "tasks";

  // Bulk actions ask first; loading samples only when it would replace tasks.
  const runOrConfirm = (action: NonNullable<typeof pendingBulkAction>) => {
    setIsMenuOpen(false);
    if (action === "samples" && total === 0) {
      addSampleTasks();
      return;
    }
    setPendingBulkAction(action);
  };

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const bulkConfirm = pendingBulkAction
    ? {
      clearAll: {
        title: "Clear all tasks?",
        message: `This permanently deletes ${plural(total, "task")}, including subtasks, notes and attachments. This can't be undone.`,
        confirmText: "Clear all",
        variant: "danger" as const,
        run: clearAllTasks,
      },
      clearCompleted: {
        title: "Clear completed tasks?",
        message: `This permanently deletes ${plural(completed, "completed task")}. This can't be undone.`,
        confirmText: "Clear completed",
        variant: "danger" as const,
        run: clearCompletedTasks,
      },
      reset: {
        title: "Reset progress?",
        message: `All ${plural(total, "task")} will be marked as not done. Titles, notes and attachments are kept.`,
        confirmText: "Reset",
        variant: "warning" as const,
        run: resetAllTasks,
      },
      samples: {
        title: "Replace with sample tasks?",
        message: `Your ${plural(total, "task")} will be replaced by sample tasks. This can't be undone.`,
        confirmText: "Replace",
        variant: "warning" as const,
        run: addSampleTasks,
      },
    }[pendingBulkAction]
    : null;

  return (
    <div
      className="w-[360px] sm:w-[380px] select-none pointer-events-auto cursor-default overflow-hidden bg-white dark:bg-[#0b1020] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl shadow-slate-900/5 dark:shadow-black/40 nodrag"
      onClick={(e) => {
        e.stopPropagation();
      }}
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest(".drag-handle")) {
          e.stopPropagation();
        }
      }}
    >
      {bulkConfirm && (
        <ConfirmModal
          isOpen
          title={bulkConfirm.title}
          message={bulkConfirm.message}
          confirmText={bulkConfirm.confirmText}
          variant={bulkConfirm.variant}
          onConfirm={bulkConfirm.run}
          onClose={() => setPendingBulkAction(null)}
        />
      )}

      {/* Header: title, counts, view and menu; progress underneath. Drag to move. */}
      <div
        className="drag-handle cursor-move flex flex-col justify-center gap-2.5 px-3.5 border-b border-slate-200/80 dark:border-slate-800"
        style={{ height: HEADER_H }}
        onClick={(e) => {
          e.stopPropagation();
          const selectedId = useStore.getState().selectedNodeId;
          if (selectedId !== nodeId) {
            setSelectedNodeId(nodeId);
          }
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-inset ring-blue-500/20"
            title={`Node: ${nodeName}`}
          >
            <ListTodo size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="relative flex items-center">
              <input
                type="text"
                maxLength={todo.MAX_LIST_TITLE}
                aria-label="List title"
                className="w-full min-w-0 truncate bg-transparent text-[14px] font-semibold leading-5 text-slate-900 dark:text-slate-100 outline-none rounded px-1 -mx-1 hover:bg-slate-100 dark:hover:bg-white/5 focus:bg-slate-100 dark:focus:bg-white/5 focus:ring-1 focus:ring-blue-500/40 transition-colors cursor-text"
                value={todoData.title || "Tasks"}
                onChange={(e) => saveTitle(e.target.value)}
                onFocus={() => setIsTitleFocused(true)}
                onBlur={() => setIsTitleFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur();
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              />
              {isTitleFocused && (
                <LengthHint
                  length={todoData.title?.length || 0}
                  max={todo.MAX_LIST_TITLE}
                  className="absolute right-1"
                />
              )}
            </div>
            <div className="text-[11px] leading-4 tabular-nums text-slate-500 dark:text-slate-400">
              {total === 0 ? "No tasks yet" : `${completed} of ${total} done`}
            </div>
          </div>

          <div className="flex items-center gap-0.5 shrink-0" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center p-0.5 mr-0.5 rounded-md bg-slate-100 dark:bg-white/5" role="group" aria-label="View">
              {(
                [
                  { flat: false, Icon: FolderTree, label: "Tree view" },
                  { flat: true, Icon: Layers, label: "Flat list" },
                ] as const
              ).map(({ flat, Icon, label }) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={nodeIsFlat === flat}
                  title={label}
                  onClick={() => {
                    setNodeIsFlat(flat);
                    // Back in tree view, re-derive parents from their subtasks.
                    if (!flat) saveTasks((tasks) => tasks, true);
                  }}
                  className={`h-6 w-6 flex items-center justify-center rounded-[5px] transition-colors cursor-pointer ${
                    nodeIsFlat === flat
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <Icon size={13} />
                </button>
              ))}
            </div>
            <button type="button" onClick={openWorkspace} className={ICON_BUTTON} title="Open in workspace">
              <Maximize2 size={14} />
            </button>
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`${ICON_BUTTON} ${isMenuOpen ? "bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-slate-100" : ""}`}
              title="More actions"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
            >
              <MoreVertical size={14} />
            </button>
          </div>

          {isMenuOpen && createPortal(
            <div
              ref={dropdownRef}
              style={menuStyle}
              role="menu"
              className={MENU_CLASS}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <MenuItem
                icon={<ExternalLink size={14} />}
                label="Open in new tab"
                onClick={() => {
                  setIsMenuOpen(false);
                  const url = new URL(window.location.href);
                  url.searchParams.set("focusNode", nodeId);
                  window.open(url.toString(), "_blank");
                }}
              />
              <MenuItem icon={<Sparkles size={14} />} label="Load sample tasks" onClick={() => runOrConfirm("samples")} />
              <MenuDivider />
              <MenuItem icon={<FolderTree size={14} />} label="Expand all" onClick={expandAllSubtasks} disabled={nodeIsFlat} />
              <MenuItem icon={<Layers size={14} />} label="Collapse all" onClick={collapseAllSubtasks} disabled={nodeIsFlat} />
              <MenuDivider />
              <MenuItem
                icon={<Trash2 size={14} />}
                label="Clear completed"
                hint={completed || undefined}
                onClick={() => runOrConfirm("clearCompleted")}
                disabled={completed === 0}
              />
              <MenuItem
                icon={<RefreshCw size={14} />}
                label="Reset progress"
                onClick={() => runOrConfirm("reset")}
                disabled={completed === 0}
              />
              <MenuDivider />
              <MenuItem
                icon={<Trash2 size={14} />}
                label="Clear all tasks"
                hint={total || undefined}
                danger
                onClick={() => runOrConfirm("clearAll")}
                disabled={total === 0}
              />
            </div>,
            document.body
          )}
        </div>

        <div className="flex items-center gap-2.5" title={`${progress}% complete`}>
          <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ease-out ${progress === 100 ? "bg-emerald-500" : "bg-blue-500"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="w-8 text-right text-[11px] font-medium tabular-nums text-slate-600 dark:text-slate-300">
            {progress}%
          </span>
        </div>
      </div>

      {/* Tasks */}
      <div className="overflow-y-auto custom-scrollbar" style={{ height: listHeight }}>
        {tasksToRender.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 px-6 text-center">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 dark:bg-white/5 text-slate-400">
              <ListTodo size={18} />
            </div>
            <div>
              <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">No tasks yet</p>
              <p className="text-[12px] text-slate-500 dark:text-slate-400">Type below and press Enter to add one.</p>
            </div>
            <button
              type="button"
              onClick={addSampleTasks}
              className="text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Load sample tasks
            </button>
          </div>
        ) : (
          tasksToRender.map(({ task, depth }, idx) => {
            const isDone = todo.isTaskDone(task);
            const hasChildren = !nodeIsFlat && !!task.tasks && task.tasks.length > 0;
            const isCollapsed = collapsedTaskIds.includes(task.id);
            const isBlocked = !isDone && !nodeIsFlat && todo.hasIncompleteChildren(task.tasks);
            const priority = todo.priorityOf(task);
            const indent = nodeIsFlat ? 0 : depth * 18;
            const isEditing = editingTaskId === task.id;
            const menuOpen = activeMenuTaskId === task.id;

            return (
              <div
                key={`${task.id}-${idx}`}
                className={`group relative flex items-start gap-2 pr-2 py-[9px] border-b border-slate-100 dark:border-white/[0.04] transition-colors ${
                  menuOpen ? "bg-slate-50 dark:bg-white/[0.04]" : "hover:bg-slate-50 dark:hover:bg-white/[0.03]"
                }`}
                style={{ paddingLeft: 10 + indent }}
              >
                {/* Indent guide, like a file tree */}
                {depth > 0 && !nodeIsFlat && (
                  <span
                    className="absolute top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-800"
                    style={{ left: 10 + indent - 10 }}
                  />
                )}

                {!nodeIsFlat && (
                  <span className="w-4 h-5 shrink-0 flex items-center justify-center">
                    {hasChildren && (
                      <button
                        type="button"
                        onClick={(e) => toggleCollapseTask(task.id, e)}
                        className="w-4 h-4 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
                        aria-label={isCollapsed ? "Expand subtasks" : "Collapse subtasks"}
                        aria-expanded={!isCollapsed}
                      >
                        <ChevronRight size={13} className={`transition-transform ${isCollapsed ? "" : "rotate-90"}`} />
                      </button>
                    )}
                  </span>
                )}

                <TaskCheckbox
                  done={isDone}
                  blocked={isBlocked}
                  onToggle={() => toggleTaskComplete(task.id)}
                  onBlocked={() => setNotification({ message: "Complete its subtasks first", type: "info" })}
                  className="mt-0.5"
                />

                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="relative">
                      <textarea
                        maxLength={todo.MAX_TASK_TEXT}
                        value={editingText}
                        onChange={(e) => {
                          setEditingText(e.target.value);
                          e.target.style.height = "auto";
                          e.target.style.height = `${Math.max(24, e.target.scrollHeight)}px`;
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            saveEditedTaskName(task.id, editingText);
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            setEditingTaskId(null);
                          } else if (e.key === "Tab") {
                            e.preventDefault();
                            saveEditedTaskName(task.id, editingText);
                            if (e.shiftKey) outdentTask(task.id);
                            else indentTask(task.id);
                          }
                        }}
                        onBlur={() => saveEditedTaskName(task.id, editingText)}
                        autoFocus
                        rows={1}
                        placeholder="Task name"
                        className="w-full min-h-[24px] resize-none overflow-hidden rounded-md border border-blue-500 bg-white dark:bg-slate-950 px-1.5 py-0.5 text-[13px] leading-5 text-slate-900 dark:text-slate-100 outline-none ring-2 ring-blue-500/20"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onFocus={(e) => {
                          e.target.style.height = "auto";
                          e.target.style.height = `${Math.max(24, e.target.scrollHeight)}px`;
                          e.target.setSelectionRange(e.target.value.length, e.target.value.length);
                        }}
                      />
                      <LengthHint
                        length={editingText.length}
                        max={todo.MAX_TASK_TEXT}
                        className="absolute right-1.5 bottom-1"
                      />
                    </div>
                  ) : (
                    <span
                      className={`block text-[13px] leading-5 break-words line-clamp-2 cursor-text ${
                        isDone ? "text-slate-400 dark:text-slate-500 line-through" : "text-slate-800 dark:text-slate-100"
                      }`}
                      onClick={() => startEditingTask(task.id, task.text)}
                      title={task.text ? `${task.text}\n\nClick to edit` : "Click to edit"}
                    >
                      {task.text || <span className="italic text-slate-400">Untitled task</span>}
                    </span>
                  )}

                  {task.imageHashes && task.imageHashes.length > 0 && (
                    <TaskImagePreview imageHashes={task.imageHashes} compact strip />
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0 h-5 mt-px">
                  {/* Normal priority isn't worth a badge on every row; set it from the ⋯ menu. */}
                  {!isDone && priority !== todo.DEFAULT_PRIORITY && (
                    <PriorityBadge
                      priority={priority}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuTaskId(menuOpen ? null : task.id);
                      }}
                    />
                  )}
                  <div
                    className={`flex items-center transition-opacity ${
                      menuOpen || isEditing
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isEditing) saveEditedTaskName(task.id, editingText);
                        else startEditingTask(task.id, task.text);
                      }}
                      className={`h-6 w-6 flex items-center justify-center rounded-md transition-colors cursor-pointer ${
                        isEditing
                          ? "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                          : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
                      }`}
                      title={isEditing ? "Save" : "Rename"}
                    >
                      {isEditing ? <Check size={13} /> : <Pencil size={12} />}
                    </button>
                    <TaskMenuPortal
                      task={task}
                      activeMenuTaskId={activeMenuTaskId}
                      setActiveMenuTaskId={setActiveMenuTaskId}
                      addNestedSubtask={addNestedSubtask}
                      indentTask={indentTask}
                      outdentTask={outdentTask}
                      moveTaskInTree={moveTaskInTree}
                      deleteTask={deleteTask}
                      setTaskPriority={setTaskPriority}
                      isFlat={nodeIsFlat}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add a task */}
      <form
        onSubmit={handleAddNewTask}
        className="flex items-center gap-2 px-3 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-white/[0.02]"
        style={{ height: FOOTER_H }}
      >
        <Plus
          size={15}
          className={`shrink-0 transition-colors ${isFooterInputFocused ? "text-blue-500" : "text-slate-400"}`}
        />
        <input
          type="text"
          maxLength={todo.MAX_TASK_TEXT}
          placeholder="Add a task…"
          aria-label="New task"
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          onFocus={() => setIsFooterInputFocused(true)}
          onBlur={() => setIsFooterInputFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setNewTaskText("");
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
        />
        <LengthHint length={newTaskText.length} max={todo.MAX_TASK_TEXT} className="shrink-0" />
        {newTaskText.trim() ? (
          <button
            type="submit"
            className="h-6 px-2.5 shrink-0 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium transition-colors cursor-pointer"
          >
            Add
          </button>
        ) : (
          <kbd className="h-5 px-1.5 shrink-0 flex items-center rounded border border-slate-200 dark:border-slate-700 text-[10px] font-sans text-slate-400">
            Enter
          </kbd>
        )}
      </form>
    </div>
  );
}

const TaskMenuPortal = ({
  task,
  activeMenuTaskId,
  setActiveMenuTaskId,
  addNestedSubtask,
  indentTask,
  outdentTask,
  moveTaskInTree,
  deleteTask,
  setTaskPriority,
  isFlat,
}: any) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const isOpen = activeMenuTaskId === task.id;
  const current = todo.priorityOf(task);

  const handleCopy = (type: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => {
      setCopiedType(null);
      setActiveMenuTaskId(null);
    }, 1200);
  };

  const run = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
    setActiveMenuTaskId(null);
  };

  useLayoutEffect(() => {
    if (isOpen && buttonRef.current && menuRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuRect = menuRef.current.getBoundingClientRect();

      let top = rect.bottom + 4;
      let left = rect.right - menuRect.width;

      if (top + menuRect.height > window.innerHeight) {
        top = rect.top - menuRect.height - 4;
      }
      if (left < 0) {
        left = 0;
      }

      setStyle({
        position: "fixed",
        top: `${top}px`,
        left: `${left}px`,
        zIndex: 99999,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const handleClickOutside = (e: MouseEvent) => {
        if (
          menuRef.current && !menuRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)
        ) {
          setActiveMenuTaskId(null);
        }
      };
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setActiveMenuTaskId(null);
      };

      const timeoutId = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside, true);
        document.addEventListener("touchstart", handleClickOutside, true);
        document.addEventListener("keydown", handleKey);
      }, 0);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener("mousedown", handleClickOutside, true);
        document.removeEventListener("touchstart", handleClickOutside, true);
        document.removeEventListener("keydown", handleKey);
      };
    }
  }, [isOpen, setActiveMenuTaskId]);

  const copyIcon = (type: string) =>
    copiedType === type ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onMouseDown={(e) => {
          // Captured before the outside-click handler, so a second click closes it.
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
          setActiveMenuTaskId(isOpen ? null : task.id);
        }}
        className={`h-6 w-6 flex items-center justify-center rounded-md transition-colors cursor-pointer ${
          isOpen
            ? "bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-slate-100"
            : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
        }`}
        title="Task actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <MoreVertical size={13} />
      </button>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          style={style}
          role="menu"
          className={MENU_CLASS}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="px-3 pt-1.5 pb-2">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Priority
            </div>
            <PriorityPicker
              value={current}
              onChange={(p) => {
                setTaskPriority(task.id, p);
                setActiveMenuTaskId(null);
              }}
            />
          </div>
          <MenuDivider />
          <MenuItem icon={<PlusCircle size={14} />} label="Add subtask" onClick={run(() => addNestedSubtask(task.id))} />
          {!isFlat && (
            <>
              <MenuItem icon={<CornerDownRight size={14} />} label="Indent (make subtask)" hint="Tab" onClick={run(() => indentTask(task.id))} />
              <MenuItem icon={<CornerLeftUp size={14} />} label="Outdent" hint="⇧Tab" onClick={run(() => outdentTask(task.id))} />
            </>
          )}
          <MenuItem icon={<ArrowUp size={14} />} label="Move up" onClick={run(() => moveTaskInTree(task.id, "up"))} />
          <MenuItem icon={<ArrowDown size={14} />} label="Move down" onClick={run(() => moveTaskInTree(task.id, "down"))} />
          <MenuDivider />
          <MenuItem
            icon={copyIcon("title")}
            label={copiedType === "title" ? "Copied" : "Copy title"}
            onClick={(e) => { e.stopPropagation(); handleCopy("title", task.text || ""); }}
          />
          {task.notes && (
            <MenuItem
              icon={copyIcon("both")}
              label={copiedType === "both" ? "Copied" : "Copy title and notes"}
              onClick={(e) => { e.stopPropagation(); handleCopy("both", `${task.text}\n\n${task.notes}`); }}
            />
          )}
          <MenuDivider />
          <MenuItem icon={<Trash2 size={14} />} label="Delete task" danger onClick={run(() => deleteTask(task.id))} />
        </div>,
        document.body
      )}
    </>
  );
};
