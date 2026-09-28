import React, { useState, useMemo, useEffect, useRef, forwardRef } from "react";
import { useStore } from "../store/useStore";
import { setValueAtPath, getValueAtPath } from "../utils/pathUtils";
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Calendar as CalendarIcon,
  MoreHorizontal,
  GripVertical,
  Clock,
  ArrowRight,
  ArrowLeft,
  Maximize2,
  Minimize2,
  ChevronDown,
  Check,
  AlignLeft,
  Eye,
  AlertCircle,
  Layers,
  X,
  Info,
  List,
  SearchX,
  CornerDownRight,
  Copy,
  Pencil,
  Hash,
  FileText,
  Sliders,
  Sun,
  Rocket,
  ArrowUp,
  ArrowDown,
  Minus,
  ListChecks,
} from "lucide-react";
import * as todo from "./todo/todoModel";
import type { TodoTask } from "./todo/todoModel";
import { useTodoList, writeTasks } from "./todo/todoStorage";
import {
  LengthHint,
  PREDEFINED_TAGS,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  TaskCheckbox,
  getTagColorClass,
} from "./todo/TodoUI";
import { format } from "date-fns";
import { parseISO } from "date-fns";
import { SmartDatePicker } from "./SmartDatePicker";
import { TodoSearchBar } from "./TodoSearchBar";
import { ConfirmModal } from "./ConfirmModal";

import { cn } from "@/lib/utils";
import Markdown from "react-markdown";
import katex from "katex";
import { TaskImagePreview } from "./TaskImagePreview";
import { TodoImageGallery } from "./TodoImageGallery";

// Suppress react-fit warnings
const originalWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === "string" && args[0].includes("<Fit />")) return;
  originalWarn(...args);
};
const originalError = console.error;
console.error = (...args) => {
  if (typeof args[0] === "string" && args[0].includes("<Fit />")) return;
  originalError(...args);
};

const CustomDateInput = forwardRef<HTMLDivElement, any>(({ value, onClick, className, children }, ref) => (
  <div onClick={onClick} ref={ref} className={className}>
    {children}
  </div>
));

export function LatexMarkdownRenderer({ content }: { content: string }) {
  if (!content) return null;

  const parts: { type: "text" | "inline-math" | "block-math"; text: string }[] =
    [];
  let currentIndex = 0;

  while (currentIndex < content.length) {
    const nextBlockStart = content.indexOf("$$", currentIndex);
    const nextInlineStart = content.indexOf("$", currentIndex);

    if (
      nextBlockStart !== -1 &&
      (nextInlineStart === -1 || nextBlockStart <= nextInlineStart)
    ) {
      const nextBlockEnd = content.indexOf("$$", nextBlockStart + 2);
      if (nextBlockEnd !== -1) {
        if (nextBlockStart > currentIndex) {
          parts.push({
            type: "text",
            text: content.slice(currentIndex, nextBlockStart),
          });
        }
        parts.push({
          type: "block-math",
          text: content.slice(nextBlockStart + 2, nextBlockEnd),
        });
        currentIndex = nextBlockEnd + 2;
        continue;
      }
    }

    if (nextInlineStart !== -1) {
      const nextInlineEnd = content.indexOf("$", nextInlineStart + 1);
      if (nextInlineEnd !== -1) {
        const lineBreak = content
          .slice(nextInlineStart, nextInlineEnd)
          .includes("\n");
        if (!lineBreak) {
          if (nextInlineStart > currentIndex) {
            parts.push({
              type: "text",
              text: content.slice(currentIndex, nextInlineStart),
            });
          }
          parts.push({
            type: "inline-math",
            text: content.slice(nextInlineStart + 1, nextInlineEnd),
          });
          currentIndex = nextInlineEnd + 1;
          continue;
        }
      }
    }

    parts.push({ type: "text", text: content.slice(currentIndex) });
    break;
  }

  return (
    <div className="text-[13px] leading-relaxed break-words text-[var(--vsc-fg)] space-y-1 focus:outline-none">
      {parts.map((part, index) => {
        if (part.type === "block-math") {
          try {
            const html = katex.renderToString(part.text, {
              displayMode: true,
              throwOnError: false,
            });
            return (
              <div
                key={index}
                className="my-2 py-1.5 px-2.5 overflow-x-auto text-center font-mono text-xs bg-[var(--vsc-hover)] rounded-lg border border-[var(--vsc-border)]"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          } catch (e) {
            return (
              <pre
                key={index}
                className="text-red-500 text-xs font-mono my-1 p-1.5 bg-red-500/10 rounded"
              >
                Syntax Error (Block Math): {part.text}
              </pre>
            );
          }
        } else if (part.type === "inline-math") {
          try {
            const html = katex.renderToString(part.text, {
              displayMode: false,
              throwOnError: false,
            });
            return (
              <span
                key={index}
                className="px-1 py-0.5 mx-0.5 font-mono text-[11.5px] bg-[var(--vsc-hover)] rounded"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          } catch (e) {
            return (
              <code
                key={index}
                className="text-red-500 text-xs font-mono px-1 bg-red-500/10 rounded"
              >
                ${part.text}$
              </code>
            );
          }
        } else {
          return (
            <div key={index} className="markdown-body inline select-text">
              <Markdown
                components={{
                  p: ({ children }) => (
                    <p className="text-[13px] leading-relaxed my-1.5 font-medium text-[var(--vsc-fg)]">
                      {children}
                    </p>
                  ),
                  h1: ({ children }) => (
                    <h1 className="text-lg font-bold text-[var(--vsc-fg)] mt-3 mb-1.5 tracking-tight block leading-tight">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-base font-bold text-[var(--vsc-fg)] mt-2 mb-1 block leading-tight">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-base font-semibold text-[var(--vsc-fg)] mt-2 mb-1 block">
                      {children}
                    </h3>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc pl-5 space-y-1.5 my-2 block text-[13px] text-[var(--vsc-fg)]">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-5 space-y-1.5 my-2 block text-[13px] text-[var(--vsc-fg)]">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-[13px] leading-relaxed text-[var(--vsc-fg)]">
                      {children}
                    </li>
                  ),
                  code: ({ children }) => (
                    <code className="text-[11px] bg-[var(--vsc-hover)] px-1 py-0.5 rounded font-mono border border-[var(--vsc-border)]">
                      {children}
                    </code>
                  ),
                }}
              >
                {part.text}
              </Markdown>
            </div>
          );
        }
      })}
    </div>
  );
}

function CustomDropdown({
  trigger,
  children,
  isOpen: controlledIsOpen,
  setIsOpen: controlledSetIsOpen,
  contentClassName,
}: any) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;
  const setIsOpen = isControlled ? controlledSetIsOpen : setInternalIsOpen;

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      const target = event.target as Element;
      // Don't close if clicking inside the calendar portal (which is appended to body outside this ref)
      if (
        ref.current &&
        !ref.current.contains(target) &&
        !target.closest(".react-calendar") &&
        !target.closest(".react-date-picker") &&
        !target.closest(".smart-datepicker-content")
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("pointerdown", handleClickOutside, true);
    }
    return () =>
      document.removeEventListener("pointerdown", handleClickOutside, true);
  }, [isOpen, setIsOpen]);

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <div
        className="cursor-pointer inline-block"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
      >
        {trigger}
      </div>
      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute top-full mt-1 z-50 min-w-[150px] bg-[var(--vsc-widget)] text-[var(--vsc-fg)] border border-[var(--vsc-border-strong)] rounded-md shadow-[0_8px_24px_var(--vsc-widget-shadow)]",
            contentClassName.includes("right-0") ||
              contentClassName.includes("right-aligned")
              ? "right-0"
              : "left-0",
            contentClassName,
          )}
        >
          {typeof children === "function"
            ? children({ close: () => setIsOpen(false) })
            : children}
        </div>
      )}
    </div>
  );
}

// One size and shape for every badge on a task row (status, priority, date).
const BADGE_CLASS =
  "inline-flex items-center gap-1 h-5 px-1.5 rounded-[4px] text-[11px] font-medium leading-none transition-colors";

// Shared with the canvas node and the productivity layer (see ./todo/TodoUI);
// re-exported so existing imports from this file keep working.
export { PREDEFINED_TAGS, getTagColorClass, STATUS_OPTIONS, PRIORITY_OPTIONS };

export function isTaskOverdue(
  dueDateStr?: string,
  isCompleted?: boolean,
): boolean {
  if (!dueDateStr) return false;
  if (isCompleted) return false;

  const [y, m, d] = dueDateStr.split("-").map(Number);
  if (!y || !m || !d) return false;

  const targetDate = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return targetDate.getTime() < today.getTime();
}

export function isDescendant(
  parentId: string | null,
  childId: string | null,
  tasks: TodoTask[]
): boolean {
  if (!parentId || !childId || !tasks) return false;

  const findParent = (list: TodoTask[]): TodoTask | null => {
    for (const t of list) {
      if (t.id === parentId) return t;
      if (t.tasks) {
        const found = findParent(t.tasks);
        if (found) return found;
      }
    }
    return null;
  };

  const parentTask = findParent(tasks);
  if (!parentTask || !parentTask.tasks) return false;

  const check = (list: TodoTask[]): boolean => {
    for (const t of list) {
      if (t.id === childId) return true;
      if (t.tasks && check(t.tasks)) return true;
    }
    return false;
  };

  return check(parentTask.tasks);
}

export function getDropPosition(
  e: React.DragEvent<HTMLElement>,
  rect: DOMRect
): "before" | "after" | "inside" {
  const relativeY = e.clientY - rect.top;
  const height = rect.height;
  if (relativeY < height * 0.25) {
    return "before";
  } else if (relativeY > height * 0.75) {
    return "after";
  } else {
    return "inside";
  }
}

export function parseTodoSearch(query: string) {
  if (!query)
    return {
      textPath: "",
      labelsMatch: [],
      prioritiesMatch: [],
      statusesMatch: [],
    };

  const labelsMatch: string[] = [];
  const prioritiesMatch: string[] = [];
  const statusesMatch: string[] = [];

  const labelRegex = /(?:label|tag):([^\s]+)/gi;
  const priorityRegex = /priority:([^\s]+)/gi;
  const statusRegex = /status:([^\s]+)/gi;

  let m;
  while ((m = labelRegex.exec(query)) !== null) {
    if (m[1]) labelsMatch.push(m[1].toLowerCase());
  }
  while ((m = priorityRegex.exec(query)) !== null) {
    if (m[1]) prioritiesMatch.push(m[1].toLowerCase());
  }
  while ((m = statusRegex.exec(query)) !== null) {
    if (m[1]) statusesMatch.push(m[1].toLowerCase());
  }

  const textPath = query
    .replace(/(?:label|tag|priority|status):[^\s]+/gi, "")
    .trim()
    .toLowerCase();

  return { textPath, labelsMatch, prioritiesMatch, statusesMatch };
}

export function doesTaskMatchSearch(
  task: TodoTask,
  parsedSearch: {
    textPath: string;
    labelsMatch: string[];
    prioritiesMatch: string[];
    statusesMatch: string[];
  },
): boolean {
  let match = true;
  if (parsedSearch.textPath) {
    match = task.text.toLowerCase().includes(parsedSearch.textPath);
  }
  if (match && parsedSearch.labelsMatch.length > 0) {
    const taskTags = (task.tags || []).map((t) => t.toLowerCase());
    for (const label of parsedSearch.labelsMatch) {
      if (!taskTags.includes(label)) {
        match = false;
        break;
      }
    }
  }
  if (match && parsedSearch.prioritiesMatch.length > 0) {
    const taskPriority = (task.priority || "normal").toLowerCase();
    let hasMatchingPriority = false;
    for (const p of parsedSearch.prioritiesMatch) {
      if (taskPriority.includes(p)) {
        hasMatchingPriority = true;
        break;
      }
    }
    if (!hasMatchingPriority) match = false;
  }
  if (match && parsedSearch.statusesMatch.length > 0) {
    let taskStatusStr = (
      task.completed ? "completed" : task.status || "todo"
    ).toLowerCase();
    if (taskStatusStr === "in progress") taskStatusStr = "progress";

    let hasMatchingStatus = false;
    for (const s of parsedSearch.statusesMatch) {
      if (taskStatusStr.includes(s)) {
        hasMatchingStatus = true;
        break;
      }
    }
    if (!hasMatchingStatus) match = false;
  }
  return match;
}

export function TodoWorkspace({ path }: { path: string }) {
  const parsedData = useStore((state) => state.parsedData);
  const setCode = useStore((state) => state.setCode);
  const codeFormat = useStore((state) => state.codeFormat);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<
    "all" | "active" | "completed" | "high" | "outdated"
  >("all");
  const [isFlatList, setIsFlatList] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Resizer width & global toast feedback
  const [detailsWidth, setDetailsWidth] = useState(380);
  const [toast, setToast] = useState<string | null>(null);
  const [isClearAllConfirmOpen, setIsClearAllConfirmOpen] = useState(false);
  const [collapsedTaskIds, setCollapsedTaskIds] = useState<string[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const isResizing = useRef(false);
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    setIsDraggingSplitter(true);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", stopResize);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = document.body.clientWidth - e.clientX;
    if (newWidth > 260 && newWidth < 800) {
      setDetailsWidth(newWidth);
    }
  };

  const stopResize = () => {
    isResizing.current = false;
    setIsDraggingSplitter(false);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", stopResize);
  };

  // The list lives in the document. The canvas node and the productivity layer
  // (Alt+T) read and write the same data through the shared todo store, so a
  // change made in any of them shows up here immediately.
  const todoData = useTodoList(path);

  const stats = todo.countTasks(todoData.tasks);
  const progress =
    stats.total === 0 ? 0 : Math.round((stats.completed / stats.total) * 100);

  /**
   * Saves a change to the tasks. Each change is applied to the latest saved list,
   * so quick successive edits never overwrite each other. In flat list view,
   * parents don't follow their subtasks' completion.
   */
  const saveTasks = (
    update: (tasks: TodoTask[]) => TodoTask[] | null,
    forceSync = false,
  ) => writeTasks(path, update, { sync: forceSync || !isFlatList });

  const focusTaskInput = (id: string, delay = 80) =>
    setTimeout(() => {
      const el = document.getElementById(`input-${id}`);
      if (el) {
        (el as HTMLInputElement).focus();
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }, delay);

  const selectOnDesktop = (id: string) => {
    if (window.innerWidth >= 768) setSelectedTaskId(id);
  };

  const expandTask = (id: string) =>
    setCollapsedTaskIds((prev) => prev.filter((x) => x !== id));

  const updateTask = (id: string, updates: Partial<TodoTask>) =>
    saveTasks((tasks) => todo.editTask(tasks, id, updates, !isFlatList));

  const removeTask = (id: string) => {
    saveTasks((tasks) => todo.removeTask(tasks, id));
    if (selectedTaskId === id) setSelectedTaskId(null);
    showToast("Task deleted");
  };

  const addTask = () => {
    const task = todo.createTask("");
    saveTasks((tasks) => todo.addTask(tasks, task));
    selectOnDesktop(task.id);
    focusTaskInput(task.id);
  };

  const addTaskBelow = (id: string) => {
    const task = todo.createTask("");
    saveTasks((tasks) => todo.insertAfter(tasks, id, task));
    selectOnDesktop(task.id);
    focusTaskInput(task.id);
  };

  const addNestedSubtask = (parentId: string) => {
    const task = todo.createTask("");
    // Expand the parent so the new subtask is visible.
    expandTask(parentId);
    saveTasks((tasks) => todo.addTask(tasks, task, parentId));
    selectOnDesktop(task.id);
    focusTaskInput(task.id);
  };

  const indentTask = (id: string) => {
    const preview = todo.indentTask(todoData.tasks, id);
    if (!preview) {
      showToast("There's no task above to nest it under");
      return;
    }
    expandTask(preview.parentId);
    saveTasks((tasks) => todo.indentTask(tasks, id)?.tasks ?? null);
    showToast("Nested under the task above");
    focusTaskInput(id, 50);
  };

  const outdentTask = (id: string) => {
    if (!todo.outdentTask(todoData.tasks, id)) {
      showToast("Already at the top level");
      return;
    }
    saveTasks((tasks) => todo.outdentTask(tasks, id));
    showToast("Moved out one level");
    focusTaskInput(id, 50);
  };

  const moveTaskInTree = (id: string, direction: "up" | "down") => {
    if (!todo.moveTask(todoData.tasks, id, direction)) return;
    saveTasks((tasks) => todo.moveTask(tasks, id, direction));
    showToast(`Moved ${direction}`);
    focusTaskInput(id, 50);
  };

  const handleMoveTask = (
    draggedId: string,
    targetId: string,
    position: "before" | "after" | "inside" | null,
  ) => {
    if (!draggedId || !targetId || !position || draggedId === targetId) return;
    if (todo.isDescendantOf(draggedId, targetId, todoData.tasks)) {
      showToast("A task can't be moved into its own subtasks");
      return;
    }
    if (position === "inside") expandTask(targetId);
    saveTasks((tasks) => todo.moveTaskTo(tasks, draggedId, targetId, position));
    showToast("Task moved");
  };

  const duplicateTask = (id: string) => {
    let copyId: string | null = null;
    saveTasks((tasks) => {
      const result = todo.duplicateTask(tasks, id);
      copyId = result?.copyId ?? null;
      return result?.tasks ?? null;
    }).then(() => {
      if (!copyId) return;
      setSelectedTaskId(copyId);
      showToast("Task duplicated");
      focusTaskInput(copyId, 85);
    });
  };

  const toggleCollapseTask = (id: string) => {
    setCollapsedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const collapseAllSubtasks = () => {
    const ids: string[] = [];
    const walk = (tList: TodoTask[]) => {
      for (const t of tList) {
        if (t.tasks && t.tasks.length > 0) {
          ids.push(t.id);
          walk(t.tasks);
        }
      }
    };
    walk(todoData.tasks || []);
    setCollapsedTaskIds(ids);
    showToast("Collapsed all subtask trees");
  };

  const expandAllSubtasks = () => {
    setCollapsedTaskIds([]);
    showToast("Expanded all subtask trees");
  };

  // Keyboard navigation & lists mapping
  const getFlatVisibleTasks = (
    tasks: TodoTask[],
    collapsedIds: string[],
  ): TodoTask[] => {
    let list: TodoTask[] = [];
    const parsedSearch = parseTodoSearch(searchTerm);

    const matchesFilterAndSearch = (task: TodoTask): boolean => {
      let match = doesTaskMatchSearch(task, parsedSearch);
      if (match && filter !== "all") {
        const isCompleted = task.completed || task.status === "Completed";
        if (filter === "active" && isCompleted) match = false;
        if (filter === "completed" && !isCompleted) match = false;
        if (filter === "outdated") {
          if (!isTaskOverdue(task.dueDate, isCompleted)) match = false;
        }
        if (
          filter === "high" &&
          task.priority !== "High" &&
          task.priority !== "Critical"
        )
          match = false;
      }
      let childMatch = false;
      if (task.tasks) {
        childMatch = task.tasks.some(matchesFilterAndSearch);
      }
      return match || childMatch;
    };

    const walk = (tList: TodoTask[]) => {
      for (const t of tList) {
        if (matchesFilterAndSearch(t)) {
          list.push(t);
          if (t.tasks && t.tasks.length > 0 && !collapsedIds.includes(t.id)) {
            walk(t.tasks);
          }
        }
      }
    };

    walk(tasks);
    return list;
  };

  const visibleTasks = useMemo(() => {
    return getFlatVisibleTasks(todoData.tasks || [], collapsedTaskIds);
  }, [todoData.tasks, collapsedTaskIds, searchTerm, filter]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === "f" || e.key.toLowerCase() === "k")
      ) {
        const searchInput = document.getElementById("search-tasks-input");
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
          (searchInput as HTMLInputElement).select();
        }
        return;
      }

      const activeEl = document.activeElement;
      const isEditingText =
        activeEl &&
        (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA");

      if (activeEl && activeEl.id === "search-tasks-input") {
        if (e.key === "Escape") {
          (activeEl as HTMLElement).blur();
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          if (visibleTasks.length > 0) {
            setSelectedTaskId(visibleTasks[0].id);
            const firstInput = document.getElementById(
              `input-${visibleTasks[0].id}`,
            );
            if (firstInput) (firstInput as HTMLInputElement).focus();
          }
        }
        return;
      }

      if (selectedTaskId) {
        const currentIndex = visibleTasks.findIndex(
          (t) => t.id === selectedTaskId,
        );

        if (e.key === "ArrowUp" && !e.altKey && !e.ctrlKey && !e.shiftKey) {
          if (currentIndex > 0) {
            e.preventDefault();
            const prevTask = visibleTasks[currentIndex - 1];
            setSelectedTaskId(prevTask.id);
            setTimeout(() => {
              const el = document.getElementById(`input-${prevTask.id}`);
              if (el) {
                (el as HTMLInputElement).focus();
                el.scrollIntoView({ block: "nearest", behavior: "smooth" });
              }
            }, 0);
          }
        }

        if (e.key === "ArrowDown" && !e.altKey && !e.ctrlKey && !e.shiftKey) {
          if (currentIndex < visibleTasks.length - 1) {
            e.preventDefault();
            const nextTask = visibleTasks[currentIndex + 1];
            setSelectedTaskId(nextTask.id);
            setTimeout(() => {
              const el = document.getElementById(`input-${nextTask.id}`);
              if (el) {
                (el as HTMLInputElement).focus();
                el.scrollIntoView({ block: "nearest", behavior: "smooth" });
              }
            }, 0);
          }
        }

        if (
          e.key === "Enter" &&
          activeEl &&
          activeEl.id === `input-${selectedTaskId}`
        ) {
          e.preventDefault();
          addTaskBelow(selectedTaskId);
          return;
        }

        if (
          e.key === "Tab" &&
          !e.shiftKey &&
          activeEl &&
          activeEl.id === `input-${selectedTaskId}`
        ) {
          e.preventDefault();
          indentTask(selectedTaskId);
          return;
        }

        if (
          e.key === "Tab" &&
          e.shiftKey &&
          activeEl &&
          activeEl.id === `input-${selectedTaskId}`
        ) {
          e.preventDefault();
          outdentTask(selectedTaskId);
          return;
        }

        if (
          e.key === "ArrowUp" &&
          e.altKey &&
          activeEl &&
          activeEl.id === `input-${selectedTaskId}`
        ) {
          e.preventDefault();
          moveTaskInTree(selectedTaskId, "up");
          return;
        }

        if (
          e.key === "ArrowDown" &&
          e.altKey &&
          activeEl &&
          activeEl.id === `input-${selectedTaskId}`
        ) {
          e.preventDefault();
          moveTaskInTree(selectedTaskId, "down");
          return;
        }

        if (e.key === "Delete" && !isEditingText) {
          e.preventDefault();
          removeTask(selectedTaskId);
          return;
        }

        if ((e.key === " " && !isEditingText) || (e.key === " " && e.ctrlKey)) {
          e.preventDefault();
          const activeTask = visibleTasks.find((t) => t.id === selectedTaskId);
          if (activeTask) {
            const isCompleted =
              activeTask.completed || activeTask.status === "Completed";
            updateTask(selectedTaskId, {
              completed: !isCompleted,
              status: !isCompleted ? "Completed" : "Todo",
            });
          }
          return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          const activeTask = visibleTasks.find((t) => t.id === selectedTaskId);
          if (activeTask) {
            const isCompleted =
              activeTask.completed || activeTask.status === "Completed";
            updateTask(selectedTaskId, {
              completed: !isCompleted,
              status: !isCompleted ? "Completed" : "Todo",
            });
          }
          return;
        }
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      document.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [selectedTaskId, visibleTasks, todoData.tasks]);

  return (
    <div
      className={cn(
        "flex w-full h-full bg-[var(--vsc-editor)] text-[var(--vsc-fg)] overflow-hidden relative font-sans",
        isDraggingSplitter && "select-none cursor-col-resize",
      )}
    >
      <ConfirmModal
        isOpen={isClearAllConfirmOpen}
        title="Clear all tasks?"
        message={
          <>
            This permanently deletes all {stats.total} task{stats.total === 1 ? "" : "s"},
            including subtasks, notes and attachments. This can't be undone.
          </>
        }
        confirmText="Clear all"
        variant="danger"
        onConfirm={() => {
          saveTasks(() => []);
          setSelectedTaskId(null);
          showToast("Cleared all tasks");
        }}
        onClose={() => setIsClearAllConfirmOpen(false)}
      />

      {/* Toast Feedback Banners */}
      {toast && (
        <div
          role="status"
          className="absolute bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-md bg-[var(--vsc-widget)] text-[var(--vsc-fg)] border border-[var(--vsc-border-strong)] shadow-[0_8px_24px_var(--vsc-widget-shadow)] animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <Info size={14} className="shrink-0 text-[var(--vsc-accent)]" />
          <span className="text-[12px]">{toast}</span>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 md:px-4 py-2 border-b border-[var(--vsc-border)] bg-[var(--vsc-editor)] shrink-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <ListChecks size={16} className="shrink-0 text-[var(--vsc-accent)]" />
              <h2 className="text-[13px] font-semibold text-[var(--vsc-fg)] truncate select-none">
                {todoData.title || "Tasks"}
              </h2>
            </div>
            <div className="flex items-center gap-2.5 text-[11px] text-[var(--vsc-fg-muted)] tabular-nums whitespace-nowrap">
              <span title="All tasks">
                <span className="font-semibold text-[var(--vsc-fg)]">{stats.total}</span> tasks
              </span>
              <span className="text-[var(--vsc-border-strong)]">·</span>
              <span title="Completed">
                <span className="font-semibold text-emerald-500">{stats.completed}</span> done
              </span>
              <span className="hidden xs:inline text-[var(--vsc-border-strong)]">·</span>
              <span className="hidden xs:inline" title="Still open">
                <span className="font-semibold text-[var(--vsc-fg)]">{stats.total - stats.completed}</span> open
              </span>
              <div className="hidden sm:flex items-center gap-1.5 pl-1" title={`${progress}% complete`}>
                <div className="w-16 h-1 rounded-full bg-[var(--vsc-active)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--vsc-accent)] transition-[width] duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="font-semibold text-[var(--vsc-fg)]">{progress}%</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => {
                if (collapsedTaskIds.length > 0) {
                  expandAllSubtasks();
                } else {
                  collapseAllSubtasks();
                }
              }}
              title={collapsedTaskIds.length > 0 ? "Expand all" : "Collapse all"}
              className="flex items-center gap-1.5 h-7 px-2 rounded-[4px] text-[12px] text-[var(--vsc-fg-muted)] hover:text-[var(--vsc-fg)] hover:bg-[var(--vsc-hover)] transition-colors cursor-pointer"
            >
              {collapsedTaskIds.length > 0 ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
              <span className="hidden md:inline">
                {collapsedTaskIds.length > 0 ? "Expand all" : "Collapse all"}
              </span>
            </button>
            <button
              onClick={() => setIsClearAllConfirmOpen(true)}
              disabled={stats.total === 0}
              title={stats.total === 0 ? "No tasks to clear" : "Clear all tasks"}
              className="flex items-center gap-1.5 h-7 px-2 rounded-[4px] text-[12px] text-[var(--vsc-fg-muted)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
            >
              <Trash2 size={13} />
              <span className="hidden md:inline">Clear all</span>
            </button>
            <div className="w-px h-4 mx-1 bg-[var(--vsc-border)]" />
            <button
              onClick={addTask}
              className="flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-[4px] text-[12px] font-medium bg-[var(--vsc-accent)] text-[var(--vsc-accent-fg)] hover:brightness-110 active:brightness-95 transition-[filter] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--vsc-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--vsc-editor)]"
            >
              <Plus size={14} />
              <span>New task</span>
            </button>
          </div>
        </div>

        {/* Search, filters, view mode */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 md:px-4 py-2 border-b border-[var(--vsc-border)] bg-[var(--vsc-editor)] shrink-0 relative z-30">
          <div className="flex-1 min-w-0 sm:max-w-md">
            <TodoSearchBar
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              allTasks={todoData.tasks || []}
            />
          </div>
          <div className="flex items-center gap-1 sm:ml-auto min-w-0">
            <div
              role="tablist"
              aria-label="Filter tasks"
              className="flex items-center gap-0.5 p-0.5 rounded-[5px] bg-[var(--vsc-hover)] overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none] min-w-0"
            >
              {(
                [
                  ["all", "All"],
                  ["active", "Active"],
                  ["completed", "Done"],
                  ["high", "High"],
                  ["outdated", "Overdue"],
                ] as const
              ).map(([f, label]) => (
                <button
                  key={f}
                  role="tab"
                  aria-selected={filter === f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "h-6 px-2.5 rounded-[4px] text-[12px] whitespace-nowrap transition-colors cursor-pointer",
                    filter === f
                      ? "bg-[var(--vsc-editor)] text-[var(--vsc-fg)] font-medium shadow-[0_0_0_1px_var(--vsc-border-strong)]"
                      : "text-[var(--vsc-fg-muted)] hover:text-[var(--vsc-fg)]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                const nextFlat = !isFlatList;
                setIsFlatList(nextFlat);
                if (!nextFlat) {
                  // Back in tree view, re-derive parents from their subtasks.
                  saveTasks((tasks) => tasks, true);
                }
              }}
              title={isFlatList ? "Show as tree" : "Show as flat list"}
              aria-pressed={isFlatList}
              className={cn(
                "h-7 w-7 flex items-center justify-center rounded-[4px] transition-colors shrink-0 cursor-pointer",
                isFlatList
                  ? "bg-[var(--vsc-active)] text-[var(--vsc-fg)]"
                  : "text-[var(--vsc-fg-muted)] hover:text-[var(--vsc-fg)] hover:bg-[var(--vsc-hover)]",
              )}
            >
              {isFlatList ? <List size={14} /> : <Layers size={14} />}
            </button>
          </div>
        </div>

        {/* Scrollable list viewport wrapper */}
        <div className="flex-1 overflow-y-auto w-full custom-scrollbar bg-[var(--vsc-editor)]" onClick={(e) => {
          if (e.target === e.currentTarget || (e.target as Element).closest && !(e.target as Element).closest('.task-list-item')) {
            setSelectedTaskId(null);
          }
        }}>
          <div className="px-2 py-2 md:px-4 md:py-3 max-w-6xl mx-auto min-h-full flex flex-col pointer-events-none">
            <div className="pointer-events-auto flex flex-col flex-1">
              <TodoWorkspaceList
              tasks={todoData.tasks || []}
              onUpdate={updateTask}
              onRemove={removeTask}
              onIndent={indentTask}
              onOutdent={outdentTask}
              onDuplicate={duplicateTask}
              onAddNested={addNestedSubtask}
              onMoveUp={(id: string) => moveTaskInTree(id, "up")}
              onMoveDown={(id: string) => moveTaskInTree(id, "down")}
              searchTerm={searchTerm}
              filter={filter}
              isFlatList={isFlatList}
              selectedTaskId={selectedTaskId}
              onSelectTask={setSelectedTaskId}
              collapsedTaskIds={collapsedTaskIds}
              onToggleCollapse={toggleCollapseTask}
              showToast={showToast}
              onMoveTask={handleMoveTask}
              draggedId={draggedId}
              setDraggedId={setDraggedId}
              todoTasks={todoData.tasks || []}
            />
            </div>
          </div>
        </div>
      </div>

      {selectedTaskId && (
        <>
          {/* Desktop Resizer */}
          <div
            className={cn(
              // A hairline that lights up in the accent colour, like VS Code's sash;
              // the pseudo-element widens the grab area without widening the line.
              "hidden md:block relative w-px shrink-0 z-20 cursor-col-resize transition-colors before:absolute before:inset-y-0 before:-left-1 before:-right-1 before:content-['']",
              isDraggingSplitter
                ? "bg-[var(--vsc-accent)]"
                : "bg-[var(--vsc-border)] hover:bg-[var(--vsc-accent)]",
            )}
            onMouseDown={startResize}
          />

          {/* Mobile Overlay */}
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/40 transition-opacity"
            onClick={() => setSelectedTaskId(null)}
          />

          <div
            style={
              typeof window !== "undefined" && window.innerWidth >= 768
                ? { width: `${detailsWidth}px` }
                : {}
            }
            className="fixed inset-0 sm:inset-y-0 sm:left-auto sm:right-0 z-50 md:relative md:z-10 flex flex-col bg-[var(--vsc-sidebar)] text-[var(--vsc-fg)] min-w-0 shadow-2xl md:shadow-none shrink-0 h-full w-full sm:w-[420px] md:w-auto animate-in slide-in-from-right-8 md:animate-none"
          >
            <TodoTaskDetails
              taskId={selectedTaskId}
              todoData={todoData}
              onUpdate={updateTask}
              onRemove={removeTask}
              onIndent={indentTask}
              onOutdent={outdentTask}
              onDuplicate={duplicateTask}
              onAddNested={addNestedSubtask}
              onClose={() => setSelectedTaskId(null)}
              showToast={showToast}
              isFlatList={isFlatList}
            />
          </div>
        </>
      )}
    </div>
  );
}

// Subcomponent flat mapping list and filters
function TodoWorkspaceList({
  tasks,
  onUpdate,
  onRemove,
  onIndent,
  onOutdent,
  onDuplicate,
  onAddNested,
  onMoveUp,
  onMoveDown,
  searchTerm,
  filter,
  isFlatList,
  selectedTaskId,
  onSelectTask,
  collapsedTaskIds,
  onToggleCollapse,
  showToast,
  onMoveTask,
  draggedId,
  setDraggedId,
  todoTasks,
}: any) {
  const parsedSearch = React.useMemo(
    () => parseTodoSearch(searchTerm),
    [searchTerm],
  );

  const filterTask = (task: TodoTask): boolean => {
    let match = doesTaskMatchSearch(task, parsedSearch);
    if (match && filter !== "all") {
      const isCompleted = task.completed || task.status === "Completed";
      if (filter === "active" && isCompleted) match = false;
      if (filter === "completed" && !isCompleted) match = false;
      if (filter === "outdated") {
        if (!isTaskOverdue(task.dueDate, isCompleted)) match = false;
      }
      if (
        filter === "high" &&
        task.priority !== "High" &&
        task.priority !== "Critical"
      )
        match = false;
    }

    let childMatch = false;
    if (task.tasks) {
      childMatch = task.tasks.some(filterTask);
    }
    return match || childMatch;
  };

  const filteredTasks = React.useMemo(() => {
    if (isFlatList) {
      const flattenAndFilter = (tList: TodoTask[]): TodoTask[] => {
        let flat: TodoTask[] = [];
        for (const t of tList) {
          let exactMatch = doesTaskMatchSearch(t, parsedSearch);
          if (exactMatch && filter !== "all") {
            const isCompleted = t.completed || t.status === "Completed";
            if (filter === "active" && isCompleted) exactMatch = false;
            if (filter === "completed" && !isCompleted) exactMatch = false;
            if (filter === "outdated") {
              if (!isTaskOverdue(t.dueDate, isCompleted)) exactMatch = false;
            }
            if (
              filter === "high" &&
              t.priority !== "High" &&
              t.priority !== "Critical"
            )
              exactMatch = false;
          }

          if (exactMatch) {
            flat.push({ ...t, tasks: undefined });
          }
          if (t.tasks) {
            flat = flat.concat(flattenAndFilter(t.tasks));
          }
        }
        return flat;
      };
      return flattenAndFilter(tasks);
    }
    return tasks.filter(filterTask);
  }, [tasks, filter, isFlatList, parsedSearch]);

  return (
    <div className="flex flex-col gap-1 flex-1">
      {filteredTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-[var(--vsc-fg-muted)] flex-grow">
          <SearchX
            size={44}
            className="text-[var(--vsc-fg-muted)] mb-3"
          />
          <p className="text-sm font-semibold text-[var(--vsc-fg-muted)]">
            No matching tasks found
          </p>
          <p className="text-xs text-[var(--vsc-fg-muted)] mt-1">
            Refine your search tags, status filters, or create a new task.
          </p>
        </div>
      ) : (
        <div className="flex flex-col pb-24 gap-1">
          {filteredTasks.map((task: TodoTask, i) => (
            <TodoWorkspaceItem
              key={`${task.id}-${i}`}
              task={task}
              level={0}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onIndent={onIndent}
              onOutdent={onOutdent}
              onDuplicate={onDuplicate}
              onAddNested={onAddNested}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              selectedTaskId={selectedTaskId}
              onSelectTask={onSelectTask}
              collapsedTaskIds={collapsedTaskIds}
              onToggleCollapse={onToggleCollapse}
              showToast={showToast}
              isFlatList={isFlatList}
              onMoveTask={onMoveTask}
              draggedId={draggedId}
              setDraggedId={setDraggedId}
              todoTasks={todoTasks}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const checkHasIncompleteChildren = (tasks?: any[]): boolean => {
  if (!tasks || tasks.length === 0) return false;
  return tasks.some((t: any) => {
    const isComp = t.completed || t.status === "Completed";
    if (!isComp) return true;
    return checkHasIncompleteChildren(t.tasks);
  });
};

// Tree view task metadata row rendering
function TodoWorkspaceItem({
  task,
  level,
  onUpdate,
  onRemove,
  onIndent,
  onOutdent,
  onDuplicate,
  onAddNested,
  onMoveUp,
  onMoveDown,
  selectedTaskId,
  onSelectTask,
  collapsedTaskIds,
  onToggleCollapse,
  showToast,
  isFlatList,
  onMoveTask,
  draggedId,
  setDraggedId,
  todoTasks,
}: any) {
  const isSelected = selectedTaskId === task.id;
  const isCompleted = task.completed || task.status === "Completed";
  const isCollapsed = collapsedTaskIds.includes(task.id);
  const hasSubtasks = task.tasks && task.tasks.length > 0;
  const hasIncompleteChildren = !isFlatList && checkHasIncompleteChildren(task.tasks);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);
  const [isEditingNotesInline, setIsEditingNotesInline] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isDescCopied, setIsDescCopied] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const isClickingTitleRef = useRef(false);

  // Drag and Drop support
  const [isDraggable, setIsDraggable] = useState(false);
  const [dropIndicator, setDropIndicator] = useState<"before" | "after" | "inside" | null>(null);

  const handleDragStart = (e: React.DragEvent) => {
    if (setDraggedId) {
      setDraggedId(task.id);
    }
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id);
  };

  const handleDragEnd = () => {
    if (setDraggedId) {
      setDraggedId(null);
    }
    setIsDraggable(false);
    setDropIndicator(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (draggedId === task.id || isDescendant(draggedId, task.id, todoTasks || [])) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = getDropPosition(e, rect);
    setDropIndicator(pos);
  };

  const handleDragLeave = () => {
    setDropIndicator(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedId && draggedId !== task.id) {
      if (!isDescendant(draggedId, task.id, todoTasks || [])) {
        if (onMoveTask) {
          onMoveTask(draggedId, task.id, dropIndicator);
        }
      }
    }
    setDropIndicator(null);
  };

  const priorityInfo =
    PRIORITY_OPTIONS.find((p) => p.value === task.priority) ||
    PRIORITY_OPTIONS[0];
  const statusInfo =
    STATUS_OPTIONS.find((s) => s.value === task.status) || STATUS_OPTIONS[0];

  const formatDueDateFriendly = (dateStr?: string) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return "";

    const target = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";
    if (diffDays < 0 && !isCompleted) {
      return `Overdue (${format(target, "MMM d")})`;
    }
    return format(target, "MMM d");
  };

  const isOverdue = isTaskOverdue(task.dueDate, isCompleted);

  return (
    <div className="task-list-item flex flex-col select-none relative">
      {/* Drop Indicator Lines */}
      {dropIndicator === "before" && (
        <div 
          className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--vsc-accent)] rounded-full z-45"
          style={{ marginLeft: `${level * 1.5}rem` }}
        />
      )}
      {dropIndicator === "after" && (
        <div 
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--vsc-accent)] rounded-full z-45"
          style={{ marginLeft: `${level * 1.5}rem` }}
        />
      )}

      <div
        draggable={isDraggable}
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-[5px] cursor-pointer transition-colors border border-transparent relative",
          isSelected
            ? "bg-[var(--vsc-selection)] before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-[var(--vsc-accent)]"
            : "hover:bg-[var(--vsc-hover)]",
          dropIndicator === "inside" && "bg-[var(--vsc-selection)] border-[var(--vsc-accent)]"
        )}
        style={{ marginLeft: `${level * 1.5}rem` }}
        onClick={() => onSelectTask(task.id)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setIsDraggable(false);
        }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Grab Grip handle like Notion (visible only on hover of the row) */}
        {!isFlatList && (
          <div
            className={cn(
              "w-5 h-5 flex items-center justify-center shrink-0 cursor-grab active:cursor-grabbing text-[var(--vsc-fg-muted)] hover:text-[var(--vsc-accent)] hover:bg-[var(--vsc-hover)] rounded transition-all",
              isHovered ? "opacity-100 pointer-events-auto" : "opacity-100 md:opacity-0 md:pointer-events-none"
            )}
            onMouseDown={() => {
              setIsDraggable(true);
            }}
            onMouseUp={() => {
              setIsDraggable(false);
            }}
            onTouchStart={() => {
              setIsDraggable(true);
            }}
            onTouchEnd={() => {
              setIsDraggable(false);
            }}
          >
            <GripVertical size={14} />
          </div>
        )}

        {/* Collapse chevron */}
        {hasSubtasks ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse(task.id);
            }}
            className="p-1 -ml-1 rounded hover:bg-[var(--vsc-active)] text-[var(--vsc-fg-muted)] transition-colors shrink-0 outline-none"
          >
            <ChevronDown
              size={14}
              className={cn(
                "transition-transform duration-200",
                isCollapsed && "-rotate-90",
              )}
            />
          </button>
        ) : (
          <div className="w-5 shrink-0" />
        )}

        {/* Done toggle (shared with the canvas node and Alt+T) */}
        <TaskCheckbox
          done={isCompleted}
          blocked={hasIncompleteChildren}
          onToggle={() => onUpdate(task.id, { completed: !isCompleted })}
          onBlocked={() => showToast("Complete its subtasks first")}
          className="mt-0.5"
        />

        {/* Core title editor */}
        <div className="flex-1 flex flex-col min-w-0 gap-1">
          {isEditingTitle ? (
            <div className="relative w-full flex flex-col">
              <textarea
                id={`input-${task.id}`}
                maxLength={todo.MAX_TASK_TEXT}
                className={cn(
                  "w-full bg-[var(--vsc-input)] border border-[var(--vsc-accent)] rounded-[4px] outline-none text-[13px] font-medium pl-2 pr-14 py-1 focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500/60 min-h-[38px] resize-none overflow-hidden transition-all",
                  isCompleted
                    ? "line-through text-[var(--vsc-fg-muted)]"
                    : "text-[var(--vsc-fg)]",
                )}
                value={task.text}
                placeholder="New Task... (Press Enter)"
                onChange={(e) => onUpdate(task.id, { text: e.target.value })}
                onBlur={() => {
                  setIsEditingTitle(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    setIsEditingTitle(false);
                  }
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                autoFocus
                onFocus={(e) => {
                  const len = e.target.value.length;
                  e.target.setSelectionRange(len, len);
                }}
              />
              <span className="absolute right-1.5 bottom-1 text-[10px] font-mono text-[var(--vsc-fg-muted)] bg-[var(--vsc-hover)] px-1 rounded-[3px] pointer-events-none select-none z-10">
                {task.text.length}/{todo.MAX_TASK_TEXT}
              </span>
            </div>
          ) : (
            <input
              id={`input-${task.id}`}
              type="text"
              className={cn(
                "w-full bg-transparent border-none outline-none text-[13px] font-semibold truncate transition-all focus:ring-0 p-0 focus:border-none cursor-text",
                isCompleted
                  ? "line-through text-[var(--vsc-fg-muted)]"
                  : "text-[var(--vsc-fg)]",
              )}
              value={task.text}
              placeholder="New Task... (Press Enter)"
              onChange={(e) => onUpdate(task.id, { text: e.target.value })}
              onMouseDown={(e) => {
                isClickingTitleRef.current = true;
                e.stopPropagation();
              }}
              onFocus={(e) => {
                if (isClickingTitleRef.current) {
                  isClickingTitleRef.current = false;
                  setIsEditingTitle(true);
                } else if (!task.text) {
                  setIsEditingTitle(true);
                } else {
                  onSelectTask(task.id);
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingTitle(true);
              }}
            />
          )}

          {task.imageHashes && task.imageHashes.length > 0 && (
             <TaskImagePreview imageHashes={task.imageHashes} compact={true} />
          )}

          {/* Row metadata visual list (clickable badge popovers!) */}
          {(task.priority ||
            task.dueDate ||
            (task.tags && task.tags.length > 0) ||
            task.status) && (
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              {/* Status Badge */}
              {task.status && (
                <CustomDropdown
                  trigger={
                    <button className="p-0 border-none outline-none bg-transparent block cursor-pointer">
                      <span
                        className={cn(
                          BADGE_CLASS, "bg-[var(--vsc-hover)] hover:bg-[var(--vsc-active)]",
                          statusInfo.color,
                        )}
                      >
                        <statusInfo.icon size={10} />
                        <span>{statusInfo.label}</span>
                      </span>
                    </button>
                  }
                  contentClassName="w-[180px] p-1"
                >
                  {({ close }: any) => (
                    <>
                      {STATUS_OPTIONS.map((opt) => {
                        const OptIcon = opt.icon;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => {
                              onUpdate(task.id, { status: opt.value as any });
                              close();
                            }}
                            className="w-full flex items-center gap-2 px-2 h-7 text-[12px] rounded-[4px] hover:bg-[var(--vsc-hover)] transition-colors text-left font-medium text-[var(--vsc-fg)] cursor-pointer"
                          >
                            <OptIcon size={12} className={opt.color} />
                            {opt.label}
                            {opt.value === task.status && (
                              <Check
                                size={12}
                                className="ml-auto text-[var(--vsc-accent)]"
                              />
                            )}
                          </button>
                        );
                      })}
                    </>
                  )}
                </CustomDropdown>
              )}

              {/* Priority Badge */}
              {task.priority && (
                <CustomDropdown
                  trigger={
                    <button className="p-0 border-none outline-none bg-transparent block cursor-pointer">
                      <span
                        className={cn(
                          BADGE_CLASS, "hover:brightness-110",
                          priorityInfo.bgColor,
                        )}
                      >
                        {priorityInfo.label}
                      </span>
                    </button>
                  }
                  contentClassName="w-[160px] p-1"
                >
                  {({ close }: any) => (
                    <>
                      {PRIORITY_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            onUpdate(task.id, { priority: opt.value as any });
                            close();
                          }}
                          className="w-full flex items-center gap-2 px-2 h-7 text-[12px] rounded-[4px] hover:bg-[var(--vsc-hover)] transition-colors text-left cursor-pointer"
                        >
                          <span
                            className={cn(
                              "text-[12px] font-medium",
                              opt.color,
                            )}
                          >
                            {opt.label}
                          </span>
                          {opt.value === task.priority && (
                            <Check
                              size={12}
                              className="ml-auto text-[var(--vsc-accent)]"
                            />
                          )}
                        </button>
                      ))}
                    </>
                  )}
                </CustomDropdown>
              )}

              {/* Due Date Indicator */}
              {task.dueDate && (
                <CustomDropdown
                  trigger={
                    <button className="p-0 border-none outline-none bg-transparent block cursor-pointer">
                      <span
                        className={cn(
                          BADGE_CLASS,
                          isOverdue
                            ? "text-red-500 bg-red-500/10 hover:bg-red-500/20"
                            : "text-[var(--vsc-fg-muted)] bg-[var(--vsc-hover)] hover:bg-[var(--vsc-active)]",
                        )}
                      >
                        <CalendarIcon size={10} />
                        <span>{formatDueDateFriendly(task.dueDate)}</span>
                      </span>
                    </button>
                  }
                  contentClassName="p-1.5"
                >
                  {({ close }: any) => (
                    <>
                      <div className="flex flex-col gap-0.5 pb-2 border-b border-[var(--vsc-border)] mb-2">
                        <button
                          onClick={(e) => {
                            const utcDate = new Date();
                            onUpdate(task.id, {
                              dueDate: utcDate.toISOString().split("T")[0],
                            });
                            close();
                          }}
                          className="w-full flex items-center gap-2 text-left px-2 h-7 text-[12px] text-[var(--vsc-fg)] hover:bg-[var(--vsc-hover)] rounded-[4px] transition-colors cursor-pointer"
                        >
                          <CalendarIcon size={12} className="text-[var(--vsc-accent)]" />
                          <span>Schedule Today</span>
                        </button>
                        <button
                          onClick={(e) => {
                            const tomorrow = new Date();
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            onUpdate(task.id, {
                              dueDate: tomorrow.toISOString().split("T")[0],
                            });
                            close();
                          }}
                          className="w-full flex items-center gap-2 text-left px-2 h-7 text-[12px] text-[var(--vsc-fg)] hover:bg-[var(--vsc-hover)] rounded-[4px] transition-colors cursor-pointer"
                        >
                          <Sun size={12} className="text-amber-500" />
                          <span>Schedule Tomorrow</span>
                        </button>
                        <button
                          onClick={(e) => {
                            const nextWeek = new Date();
                            nextWeek.setDate(nextWeek.getDate() + 7);
                            onUpdate(task.id, {
                              dueDate: nextWeek.toISOString().split("T")[0],
                            });
                            close();
                          }}
                          className="w-full flex items-center gap-2 text-left px-2 h-7 text-[12px] text-[var(--vsc-fg)] hover:bg-[var(--vsc-hover)] rounded-[4px] transition-colors cursor-pointer"
                        >
                          <Rocket size={12} className="text-purple-500" />
                          <span>Schedule Next Week</span>
                        </button>
                        {task.dueDate && (
                          <button
                            onClick={(e) => {
                              onUpdate(task.id, { dueDate: undefined });
                              close();
                            }}
                            className="w-full flex items-center gap-2 text-left px-2 h-7 text-[12px] text-red-500 hover:bg-red-500/10 rounded-[4px] transition-colors cursor-pointer mt-1 border-t border-[var(--vsc-border)] pt-2"
                          >
                            <X size={12} />
                            <span>Clear Target Date</span>
                          </button>
                        )}
                      </div>
                      <div className="px-2 py-1 flex items-center gap-3 justify-between mt-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--vsc-fg-muted)] pl-1">
                          Custom
                        </span>
                        <div className="relative group w-[110px]">
                          <SmartDatePicker
                            selected={task.dueDate ? parseISO(task.dueDate) : null}
                            onChange={(date: Date | null) => {
                              const dateString = date ? format(date, "yyyy-MM-dd") : undefined;
                              onUpdate(task.id, { dueDate: dateString });
                              close();
                            }}
                          >
                            <CustomDateInput className="bg-[var(--vsc-input)] border border-[var(--vsc-border-strong)] rounded-[4px] px-2 h-7 text-[12px] text-[var(--vsc-fg)] w-[110px] flex items-center group-hover:bg-[var(--vsc-hover)] transition-colors cursor-pointer relative z-0">
                                <span className={cn(!task.dueDate && "text-[var(--vsc-fg-muted)] group-hover:text-[var(--vsc-fg-muted)]")}>
                                  {task.dueDate ? format(parseISO(task.dueDate), "MM/dd/yyyy") : "mm/dd/yyyy"}
                                </span>
                            </CustomDateInput>
                          </SmartDatePicker>
                        </div>
                      </div>
                    </>
                  )}
                </CustomDropdown>
              )}

              {/* Tags / Labels Indicator */}
              {task.tags && task.tags.length > 0 && (
                <div className="flex items-center gap-1 ml-1">
                  {task.tags.map((tag, i) => (
                    <span
                      key={`${tag}-${i}`}
                      className={cn(
                        "inline-flex items-center h-5 px-1.5 rounded-[4px] text-[11px] font-medium border",
                        getTagColorClass(tag),
                      )}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Hover quick actions and dropdown popover */}
        <div
          className={cn(
            "transition-all flex items-center shrink-0",
            isMenuOpen || isHovered
              ? "opacity-100 md:opacity-100 pointer-events-auto"
              : "opacity-100 md:opacity-0 md:pointer-events-none",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Desktop/Wide View Actions */}
          <div className="hidden md:flex items-center gap-1 pr-1">
            {/* Copy Task Icon */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                navigator.clipboard.writeText(task.text);
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
              }}
              title={isCopied ? "Copied!" : "Copy Task text"}
              className={`p-1 rounded transition-colors outline-none cursor-pointer ${
                isCopied 
                  ? "text-emerald-500 bg-emerald-500/10" 
                  : "hover:bg-[var(--vsc-hover)] text-[var(--vsc-fg-muted)] hover:text-[var(--vsc-accent)]"
              }`}
            >
              {isCopied ? <Check size={13} /> : <Copy size={13} />}
            </button>

            {/* Notes inline toggle */}
            <button
              onClick={() => setIsNotesExpanded(!isNotesExpanded)}
              title={isNotesExpanded ? "Hide Description" : "Show Description"}
              className={cn(
                "p-1 hover:bg-[var(--vsc-hover)] rounded transition-colors outline-none cursor-pointer",
                isNotesExpanded
                  ? "text-[var(--vsc-accent)] bg-[var(--vsc-active)]"
                  : task.notes
                    ? "text-amber-500"
                    : "text-[var(--vsc-fg-muted)] hover:text-[var(--vsc-fg)]",
              )}
            >
              <AlignLeft size={13} />
            </button>

            {/* Quick Subtask Plus */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onAddNested(task.id);
              }}
              title="Create nested subtask"
              className="p-1 hover:bg-[var(--vsc-hover)] rounded transition-colors text-[var(--vsc-fg-muted)] hover:text-[var(--vsc-accent)] outline-none cursor-pointer"
            >
              <Plus size={13} />
            </button>

            {/* Direct Line Deletion fast CRUD */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onRemove(task.id);
              }}
              title="Delete task line"
              className="p-1 hover:bg-red-500/10 rounded transition-colors text-[var(--vsc-fg-muted)] hover:text-red-500 outline-none cursor-pointer"
            >
              <Trash2 size={13} />
            </button>
          </div>

          {/* Mobile/Narrow View Dropdown */}
          <div className="flex md:hidden items-center pr-1">
            <CustomDropdown
              trigger={
                <button
                  className={cn(
                    "p-1 hover:bg-[var(--vsc-hover)] rounded transition-colors outline-none cursor-pointer text-[var(--vsc-fg-muted)]",
                    isMenuOpen
                      ? "bg-[var(--vsc-hover)] text-[var(--vsc-fg)]"
                      : "",
                  )}
                >
                  <MoreHorizontal size={14} />
                </button>
              }
              contentClassName="w-48 p-1.5 border border-[var(--vsc-border)] shadow-2xl z-50 flex flex-col right-0 origin-top-right overflow-hidden"
              isOpen={isMenuOpen}
              setIsOpen={setIsMenuOpen}
            >
              {({ close }: any) => (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      navigator.clipboard.writeText(task.text);
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 2000);
                      // Don't close so the user can see the feedback? Or keep it closing.
                      // Actually, if we show inline feedback, keeping the popup briefly might be nice, but closing immediately is also OK.
                      // I'll close it here because the user's focus is on the main list item's copy button mostly
                      close();
                    }}
                    className="w-full flex items-center gap-2 text-left px-2 h-8 text-[12px] text-[var(--vsc-fg)] hover:bg-[var(--vsc-hover)] rounded-[4px] transition-colors cursor-pointer"
                  >
                    <Copy size={13} />
                    <span>{isCopied ? "Copied!" : "Copy Task"}</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsNotesExpanded(!isNotesExpanded);
                      close();
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 text-left px-2 h-8 text-[12px] rounded-[4px] transition-colors cursor-pointer",
                      isNotesExpanded
                        ? "text-[var(--vsc-accent)] bg-[var(--vsc-active)]"
                        : "text-[var(--vsc-fg)] hover:bg-[var(--vsc-hover)]",
                    )}
                  >
                    <AlignLeft size={13} />
                    <span>
                      {isNotesExpanded
                        ? "Hide Description"
                        : "Show Description"}
                    </span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onAddNested(task.id);
                      close();
                    }}
                    className="w-full flex items-center gap-2 text-left px-2 h-8 text-[12px] text-[var(--vsc-fg)] hover:bg-[var(--vsc-hover)] rounded-[4px] transition-colors cursor-pointer mt-0.5"
                  >
                    <Plus size={13} />
                    <span>Add Subtask</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onRemove(task.id);
                      close();
                    }}
                    className="w-full flex items-center gap-2 text-left px-2 h-8 text-[12px] text-red-500 hover:bg-red-500/10 rounded-[4px] transition-colors cursor-pointer mt-0.5"
                  >
                    <Trash2 size={13} />
                    <span>Delete Task</span>
                  </button>
                </>
              )}
            </CustomDropdown>
          </div>
        </div>
      </div>

      {/* Expanded Notes/Description Area nested elegantly underneath */}
      {isNotesExpanded && (
        <div
          className="border border-[var(--vsc-border)] bg-[var(--vsc-hover)] rounded-md p-3 my-1 outline-none"
          style={{ marginLeft: `${level * 1.5 + 1.25}rem` }}
          onClick={(e) => {
            // Prevent task selection on clicking notes container
            e.stopPropagation();
          }}
        >
          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-[var(--vsc-border)]">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--vsc-fg-muted)] leading-none">
              <AlignLeft size={11} />
              <span>Notes</span>
            </div>
            <div className="flex items-center gap-1.5">
              {task.notes && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(task.notes || "");
                    setIsDescCopied(true);
                    setTimeout(() => setIsDescCopied(false), 2000);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 h-6 px-2 rounded-[4px] text-[11px] transition-colors border",
                    isDescCopied 
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                      : "bg-[var(--vsc-hover)] hover:bg-[var(--vsc-active)] text-[var(--vsc-fg-muted)] hover:text-[var(--vsc-fg)] border-[var(--vsc-border)]"
                  )}
                >
                  {isDescCopied ? (
                    <>
                      <Check size={11} /> Copied
                    </>
                  ) : (
                    <>
                      <Copy size={11} /> Copy
                    </>
                  )}
                </button>
              )}
              <button
                onClick={() => setIsEditingNotesInline(!isEditingNotesInline)}
                className="flex items-center gap-1.5 h-6 px-2 rounded-[4px] text-[11px] bg-[var(--vsc-hover)] hover:bg-[var(--vsc-active)] text-[var(--vsc-fg-muted)] hover:text-[var(--vsc-fg)] transition-all border border-[var(--vsc-border)]"
              >
                {isEditingNotesInline ? (
                  <>
                    <Eye size={11} /> Preview
                  </>
                ) : (
                  <>
                    <Pencil size={11} /> Edit
                  </>
                )}
              </button>
            </div>
          </div>

          {isEditingNotesInline ? (
            <textarea
              value={task.notes || ""}
              onChange={(e) => onUpdate(task.id, { notes: e.target.value })}
              placeholder="Add formulas ($$x^2 + y^2 = z^2$$) or markdown text..."
              className="w-full min-h-[125px] bg-transparent border-none outline-none text-xs text-[var(--vsc-fg)] resize-y leading-relaxed font-sans placeholder:text-[var(--vsc-fg-muted)] focus:ring-0 p-0"
              autoFocus
            />
          ) : (
            <div className="pt-0.5">
              {task.notes ? (
                <LatexMarkdownRenderer content={task.notes} />
              ) : (
                <button
                  onClick={() => setIsEditingNotesInline(true)}
                  className="text-xs text-[var(--vsc-fg-muted)] hover:text-[var(--vsc-fg-muted)] italic text-left w-full block transition-colors py-1 pl-1"
                >
                  Click to write detailed notes (LaTeX equations and Markdown
                  formatted specs supported)...
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Subtasks levels tree loops */}
      {task.tasks && task.tasks.length > 0 && !isCollapsed && (
        <div className="flex flex-col gap-px border-l border-[var(--vsc-border)] ml-[1.65rem] pl-1 relative">
          {task.tasks.map((subtask: TodoTask, i) => (
            <TodoWorkspaceItem
              key={`${subtask.id}-${i}`}
              task={subtask}
              level={level + 1}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onIndent={onIndent}
              onOutdent={onOutdent}
              onDuplicate={onDuplicate}
              onAddNested={onAddNested}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              selectedTaskId={selectedTaskId}
              onSelectTask={onSelectTask}
              collapsedTaskIds={collapsedTaskIds}
              onToggleCollapse={onToggleCollapse}
              showToast={showToast}
              isFlatList={isFlatList}
              onMoveTask={onMoveTask}
              draggedId={draggedId}
              setDraggedId={setDraggedId}
              todoTasks={todoTasks}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Side detail analysis panel implementation
function TodoTaskDetails({
  taskId,
  todoData,
  onUpdate,
  onRemove,
  onIndent,
  onOutdent,
  onDuplicate,
  onAddNested,
  onClose,
  showToast,
  isFlatList,
}: any) {
  let foundTask: TodoTask | null = null;
  const findTask = (tList: TodoTask[]) => {
    for (const t of tList) {
      if (t.id === taskId) {
        foundTask = t;
        return;
      }
      if (t.tasks) findTask(t.tasks);
    }
  };
  findTask(todoData.tasks || []);

  if (!foundTask) return null;

  const hasIncompleteChildren = !isFlatList && checkHasIncompleteChildren(foundTask.tasks);

  const [isEditingNotesInDetails, setIsEditingNotesInDetails] = useState(false);
  const [isDetailTitleFocused, setIsDetailTitleFocused] = useState(false);

  // Controlled dropdown open states for reliable popup toggles
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [isTagFocused, setIsTagFocused] = useState(false);

  const isCompleted = foundTask.completed || foundTask.status === "Completed";
  const currentStatus =
    STATUS_OPTIONS.find((s) => s.value === (foundTask?.status || "Todo")) ||
    STATUS_OPTIONS[0];
  const StatusIcon = currentStatus.icon;
  const priorityInfo =
    PRIORITY_OPTIONS.find((p) => p.value === foundTask?.priority) ||
    PRIORITY_OPTIONS[0];

  const getSafeDate = (dateString?: string) => {
    if (!dateString) return undefined;
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? undefined : d;
  };

  const getFormatDate = (dateString?: string) => {
    if (!dateString) return "No date assigned";
    const [y, m, d] = dateString.split("-").map(Number);
    if (!y || !m || !d) return "Invalid date";

    const target = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";
    return format(target, "MMM d, yyyy");
  };

  const isOverdue = isTaskOverdue(foundTask.dueDate, isCompleted);

  const allTags = useMemo(() => {
    const list = new Set<string>();
    PREDEFINED_TAGS.forEach((t) => list.add(t));
    const walk = (tList: TodoTask[]) => {
      for (const t of tList) {
        if (t.tags) t.tags.forEach((tag) => list.add(tag));
        if (t.tasks) walk(t.tasks);
      }
    };
    walk(todoData.tasks || []);
    return Array.from(list);
  }, [todoData]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--vsc-sidebar)] relative">
      {/* Header Actions Panel */}
      <div className="flex items-center justify-between h-[35px] pl-2 pr-1.5 md:pl-4 shrink-0 border-b border-[var(--vsc-border)] bg-[var(--vsc-sidebar)] sticky top-0 z-10">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--vsc-fg-muted)]">
          <button
            onClick={onClose}
            className="md:hidden p-1 rounded-[4px] text-[var(--vsc-fg-muted)] hover:text-[var(--vsc-fg)] hover:bg-[var(--vsc-hover)] transition-colors"
            title="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-1.5 pl-0.5">
            <Sliders
              size={12}
              className="hidden sm:block"
            />
            <span className="hidden sm:inline">Task</span>
            <span className="md:hidden">Details</span>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => {
              if (
                !isCompleted &&
                hasIncompleteChildren
              ) {
                showToast("Unfinished subtasks remaining");
                return;
              }
              onUpdate(foundTask!.id, {
                completed: !isCompleted,
                status: !isCompleted ? "Completed" : "Todo",
              });
            }}
            className={cn(
              "flex items-center gap-1.5 h-6 px-2 rounded-[4px] text-[12px] transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-[var(--vsc-accent)]",
              (!hasIncompleteChildren || isCompleted) &&
                "active:scale-95",
              isCompleted
                ? "text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20"
                : "text-[var(--vsc-fg)] hover:bg-[var(--vsc-hover)]",
              hasIncompleteChildren &&
                !isCompleted &&
                "opacity-40 cursor-not-allowed",
            )}
            title={
              hasIncompleteChildren && !isCompleted
                ? "Complete subtasks first"
                : "Toggle Complete Active Task"
            }
          >
            {isCompleted ? (
              <CheckCircle2 size={13} className="text-emerald-500" />
            ) : (
              <Circle
                size={11.5}
                className="text-[var(--vsc-fg-muted)]"
              />
            )}
            <span>{isCompleted ? "Completed" : "Mark complete"}</span>
          </button>
          <button
            onClick={() => {
              onRemove(foundTask!.id);
              onClose();
            }}
            className="flex items-center gap-1.5 h-6 px-2 rounded-[4px] text-[12px] transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-[var(--vsc-accent)] text-[var(--vsc-fg-muted)] hover:text-rose-500 hover:bg-rose-500/10"
            title="Delete active task"
          >
            <Trash2 size={11.5} />
            <span>Delete</span>
          </button>
          <div className="w-px h-4 bg-[var(--vsc-border)] mx-1"></div>
          <button
            onClick={onClose}
            className="hidden md:flex h-6 w-6 items-center justify-center rounded-[4px] hover:bg-[var(--vsc-hover)] text-[var(--vsc-fg-muted)] hover:text-[var(--vsc-fg)] transition-colors outline-none cursor-pointer"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-10 pt-4 custom-scrollbar flex flex-col gap-5">
        {/* Title input field auto growers */}
        <div className="flex flex-col -ml-1 relative">
          <textarea
            maxLength={todo.MAX_TASK_TEXT}
            value={foundTask.text || ""}
            onChange={(e) => onUpdate(foundTask!.id, { text: e.target.value })}
            onFocus={() => setIsDetailTitleFocused(true)}
            onBlur={() => setIsDetailTitleFocused(false)}
            className="w-full bg-transparent border-transparent text-[18px] font-semibold text-[var(--vsc-fg)] outline-none placeholder:text-[var(--vsc-fg-muted)] focus:ring-0 resize-none overflow-hidden leading-tight p-1 focus:border-transparent pr-16"
            placeholder="Untitled Task"
            rows={1}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = `${target.scrollHeight}px`;
            }}
            ref={(el) => {
              if (el) {
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }
            }}
          />
          {isDetailTitleFocused && (
            <span className="absolute right-1 top-1.5 text-[10px] font-mono text-[var(--vsc-fg-muted)] bg-[var(--vsc-hover)] px-1.5 py-0.5 rounded-[3px] pointer-events-none select-none z-10 animate-in fade-in duration-100">
              {(foundTask.text || "").length}/{todo.MAX_TASK_TEXT}
            </span>
          )}
        </div>

        {/* Metadatas select list */}
        <div
          className="flex flex-col rounded-md border border-[var(--vsc-border)] bg-[var(--vsc-editor)] divide-y divide-[var(--vsc-border)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Status Workflow select popovers */}
          <div className="flex items-center justify-between gap-3 pl-3 pr-1 h-10">
            <div className="shrink-0 text-[12px] text-[var(--vsc-fg-muted)] flex items-center gap-2">
              <Layers size={12} /> Status
            </div>
            <CustomDropdown
              isOpen={isStatusOpen}
              setIsOpen={setIsStatusOpen}
              trigger={
                <button className="h-7 px-2 flex items-center gap-1.5 rounded-[4px] text-[12px] text-[var(--vsc-fg)] hover:bg-[var(--vsc-hover)] outline-none focus-visible:ring-1 focus-visible:ring-[var(--vsc-accent)] transition-colors cursor-pointer">
                  <StatusIcon size={13} className={cn(currentStatus.color)} />
                  <span>{currentStatus.label}</span>
                  <ChevronDown size={12} className="opacity-50" />
                </button>
              }
              contentClassName="w-[200px] p-1 shadow-xl z-20 right-0"
            >
              {({ close }: any) => (
                <>
                  {STATUS_OPTIONS.map((opt) => {
                    const OptIcon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        onClick={(e) => {
                          onUpdate(foundTask!.id, { status: opt.value as any });
                          close();
                        }}
                        className="w-full flex items-center gap-2.5 px-2 h-7 text-[12px] rounded-[4px] hover:bg-[var(--vsc-hover)] transition-colors text-left font-medium text-[var(--vsc-fg)] cursor-pointer"
                      >
                        <OptIcon size={12} className={opt.color} />
                        {opt.label}
                        {opt.value === foundTask!.status && (
                          <Check
                            size={12}
                            className="ml-auto text-[var(--vsc-accent)]"
                          />
                        )}
                      </button>
                    );
                  })}
                </>
              )}
            </CustomDropdown>
          </div>

          {/* Priority workflow selectors popover */}
          <div className="flex items-center justify-between gap-3 pl-3 pr-1 h-10">
            <div className="shrink-0 text-[12px] text-[var(--vsc-fg-muted)] flex items-center gap-2">
              <AlertCircle size={12} /> Priority
            </div>
            <CustomDropdown
              isOpen={isPriorityOpen}
              setIsOpen={setIsPriorityOpen}
              trigger={
                <button className="h-7 px-2 flex items-center gap-1.5 rounded-[4px] text-[12px] text-[var(--vsc-fg)] hover:bg-[var(--vsc-hover)] outline-none focus-visible:ring-1 focus-visible:ring-[var(--vsc-accent)] transition-colors cursor-pointer">
                  <span
                    className={cn(
                      BADGE_CLASS,
                      priorityInfo.bgColor,
                    )}
                  >
                    {priorityInfo.label}
                  </span>
                  <ChevronDown size={12} className="opacity-50" />
                </button>
              }
              contentClassName="w-[180px] p-1 shadow-xl z-20 right-0"
            >
              {({ close }: any) => (
                <>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={(e) => {
                        onUpdate(foundTask!.id, { priority: opt.value as any });
                        close();
                      }}
                      className="w-full flex items-center gap-2 px-2 h-7 text-[12px] rounded-[4px] hover:bg-[var(--vsc-hover)] transition-colors text-left font-medium cursor-pointer text-[var(--vsc-fg)]"
                    >
                      <span
                        className={cn(
                          "text-[12px] font-medium",
                          opt.color,
                        )}
                      >
                        {opt.label}
                      </span>
                      {opt.value === (foundTask!.priority || "Normal") && (
                        <Check
                          size={12}
                          className="ml-auto text-[var(--vsc-accent)]"
                        />
                      )}
                    </button>
                  ))}
                </>
              )}
            </CustomDropdown>
          </div>

          {/* Date Picker customized options (Today/Tomorrow/NextWeek/Clear) */}
          <div className="flex items-center justify-between gap-3 pl-3 pr-1 h-10">
            <div className="shrink-0 text-[12px] text-[var(--vsc-fg-muted)] flex items-center gap-2">
              <CalendarIcon size={12} /> Target Date
            </div>
            <CustomDropdown
              isOpen={isDatePickerOpen}
              setIsOpen={setIsDatePickerOpen}
              trigger={
                <button
                  className={cn(
                    "h-7 px-2 flex items-center gap-1.5 rounded-[4px] text-[12px] text-[var(--vsc-fg)] hover:bg-[var(--vsc-hover)] outline-none focus-visible:ring-1 focus-visible:ring-[var(--vsc-accent)] transition-colors cursor-pointer",
                    !foundTask.dueDate &&
                      "text-[var(--vsc-fg-muted)] font-normal normal-case",
                  )}
                >
                  <span className={cn(isOverdue && "text-red-500 font-medium")}>
                    {foundTask.dueDate
                      ? getFormatDate(foundTask.dueDate)
                      : "Add target date..."}
                  </span>
                  {isOverdue && (
                    <span className="ml-1 inline-flex items-center h-4 px-1 rounded-[3px] text-[10px] font-medium bg-red-500/10 text-red-500">
                      Overdue
                    </span>
                  )}
                  <ChevronDown size={12} className="opacity-50" />
                </button>
              }
              contentClassName="w-auto p-2 border border-[var(--vsc-border)] shadow-2xl z-30 flex flex-col right-0"
            >
              {({ close }: any) => (
                <>
                  <div className="flex flex-col gap-0.5 pb-2 border-b border-[var(--vsc-border)] mb-2">
                    <button
                      onClick={(e) => {
                        const utcDate = new Date();
                        onUpdate(foundTask!.id, {
                          dueDate: utcDate.toISOString().split("T")[0],
                        });
                        close();
                      }}
                      className="w-full flex items-center gap-2 text-left px-2 h-7 text-[12px] text-[var(--vsc-fg)] hover:bg-[var(--vsc-hover)] rounded-[4px] transition-colors cursor-pointer"
                    >
                      <CalendarIcon size={12} className="text-[var(--vsc-accent)]" />
                      <span>Schedule Today</span>
                    </button>
                    <button
                      onClick={(e) => {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        onUpdate(foundTask!.id, {
                          dueDate: tomorrow.toISOString().split("T")[0],
                        });
                        close();
                      }}
                      className="w-full flex items-center gap-2 text-left px-2 h-7 text-[12px] text-[var(--vsc-fg)] hover:bg-[var(--vsc-hover)] rounded-[4px] transition-colors cursor-pointer"
                    >
                      <Sun size={12} className="text-amber-500" />
                      <span>Schedule Tomorrow</span>
                    </button>
                    <button
                      onClick={(e) => {
                        const nextWeek = new Date();
                        nextWeek.setDate(nextWeek.getDate() + 7);
                        onUpdate(foundTask!.id, {
                          dueDate: nextWeek.toISOString().split("T")[0],
                        });
                        close();
                      }}
                      className="w-full flex items-center gap-2 text-left px-2 h-7 text-[12px] text-[var(--vsc-fg)] hover:bg-[var(--vsc-hover)] rounded-[4px] transition-colors cursor-pointer"
                    >
                      <Rocket size={12} className="text-purple-500" />
                      <span>Schedule Next Week</span>
                    </button>
                    {foundTask.dueDate && (
                      <button
                        onClick={(e) => {
                          onUpdate(foundTask!.id, { dueDate: undefined });
                          close();
                        }}
                        className="w-full flex items-center gap-2 text-left px-2 h-7 text-[12px] text-red-500 hover:bg-red-500/10 rounded-[4px] transition-colors cursor-pointer mt-1 border-t border-[var(--vsc-border)] pt-2"
                      >
                        <X size={12} />
                        <span>Clear Target Date</span>
                      </button>
                    )}
                  </div>
                  <div className="px-2 py-1 flex items-center gap-3 justify-between mt-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--vsc-fg-muted)] pl-1">
                      Custom
                    </span>
                    <div className="relative group w-[110px]">
                      <SmartDatePicker
                        selected={foundTask.dueDate ? parseISO(foundTask.dueDate) : null}
                        onChange={(date: Date | null) => {
                          const dateString = date ? format(date, "yyyy-MM-dd") : undefined;
                          onUpdate(foundTask!.id, { dueDate: dateString });
                          close();
                        }}
                      >
                        <CustomDateInput className="bg-[var(--vsc-input)] border border-[var(--vsc-border-strong)] rounded-[4px] px-2 h-7 text-[12px] text-[var(--vsc-fg)] w-[110px] flex items-center group-hover:bg-[var(--vsc-hover)] transition-colors cursor-pointer relative z-0">
                            <span className={cn(!foundTask.dueDate && "text-[var(--vsc-fg-muted)] group-hover:text-[var(--vsc-fg-muted)]")}>
                              {foundTask.dueDate ? format(parseISO(foundTask.dueDate), "MM/dd/yyyy") : "mm/dd/yyyy"}
                            </span>
                        </CustomDateInput>
                      </SmartDatePicker>
                    </div>
                  </div>
                </>
              )}
            </CustomDropdown>
          </div>
        </div>

        {/* Labels / Tags workflow */}
        <div className="flex flex-col gap-2 relative z-10">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--vsc-fg-muted)]">
            <Hash size={12} /> Labels
          </div>
          <div className="flex flex-wrap gap-1.5 w-full">
            {(foundTask.tags || []).map((tag, i) => (
              <div
                key={`${tag}-${i}`}
                className={cn(
                  "inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-[4px] border text-[12px] font-medium group",
                  getTagColorClass(tag),
                )}
              >
                {tag}
                <button
                  onClick={() => {
                    const newTags = (foundTask!.tags || []).filter(
                      (_, index) => index !== i,
                    );
                    onUpdate(foundTask!.id, { tags: newTags });
                  }}
                  className="opacity-50 hover:opacity-100 transition-opacity focus:outline-none"
                  title="Remove label"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
            {/* Tag search container */}
            <div className="relative">
              <div className="flex items-stretch h-6">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onFocus={() => setIsTagFocused(true)}
                  onBlur={() => setTimeout(() => setIsTagFocused(false), 200)}
                  placeholder="Add label..."
                  className="bg-[var(--vsc-input)] h-full border border-[var(--vsc-border-strong)] focus:border-[var(--vsc-accent)] px-2 rounded-l-[4px] text-[12px] text-[var(--vsc-fg)] placeholder:text-[var(--vsc-fg-muted)] outline-none w-[120px] focus:w-[150px] transition-[width]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      const val = tagInput.trim().toLowerCase();
                      if (val) {
                        const newTag = val.replace(/^#/, "");
                        const newTags = [...(foundTask!.tags || [])];
                        if (!newTags.includes(newTag)) {
                          newTags.push(newTag);
                          onUpdate(foundTask!.id, { tags: newTags });
                        }
                        setTagInput("");
                      }
                    }
                  }}
                />
                <button
                  className="bg-[var(--vsc-input)] h-full border border-l-0 border-[var(--vsc-border-strong)] px-1.5 rounded-r-[4px] text-[var(--vsc-fg-muted)] hover:text-[var(--vsc-accent)] hover:bg-[var(--vsc-hover)] transition-colors outline-none flex items-center justify-center shrink-0"
                  onClick={() => {
                    const val = tagInput.trim().toLowerCase();
                    if (val) {
                      const newTag = val.replace(/^#/, "");
                      const newTags = [...(foundTask!.tags || [])];
                      if (!newTags.includes(newTag)) {
                        newTags.push(newTag);
                        onUpdate(foundTask!.id, { tags: newTags });
                      }
                      setTagInput("");
                    }
                  }}
                  title="Add Tag (Enter)"
                >
                  <CornerDownRight size={12} />
                </button>
              </div>

              {/* Tag suggestions dropdown */}
              {isTagFocused && (
                <div className="absolute top-full left-0 mt-1 max-h-48 overflow-y-auto w-[180px] bg-[var(--vsc-widget)] border border-[var(--vsc-border-strong)] rounded-md shadow-[0_8px_24px_var(--vsc-widget-shadow)] z-50 flex flex-col py-1">
                  {allTags
                    .filter(
                      (t) =>
                        t.includes(tagInput.toLowerCase()) &&
                        !(foundTask.tags || []).includes(t),
                    )
                    .map((t) => (
                      <button
                        key={t}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const newTags = [...(foundTask!.tags || [])];
                          if (!newTags.includes(t)) {
                            newTags.push(t);
                            onUpdate(foundTask!.id, { tags: newTags });
                          }
                          setTagInput("");
                          setIsTagFocused(false);
                        }}
                        className="text-left flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--vsc-hover)] transition-colors group"
                      >
                        <Hash size={10} className="opacity-40" />
                        <span
                          className={cn(
                            "inline-flex items-center h-5 px-1.5 rounded-[4px] text-[11px] font-medium border",
                            getTagColorClass(t),
                          )}
                        >
                          {t}
                        </span>
                      </button>
                    ))}
                  {tagInput.trim() &&
                    !allTags.includes(tagInput.trim().toLowerCase()) && (
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const val = tagInput
                            .trim()
                            .toLowerCase()
                            .replace(/^#/, "");
                          const newTags = [...(foundTask!.tags || [])];
                          if (!newTags.includes(val)) {
                            newTags.push(val);
                            onUpdate(foundTask!.id, { tags: newTags });
                          }
                          setTagInput("");
                          setIsTagFocused(false);
                        }}
                        className="text-left px-3 py-1.5 hover:bg-[var(--vsc-hover)] text-[12px] text-[var(--vsc-accent)] transition-colors"
                      >
                        + Create "{tagInput.trim()}"
                      </button>
                    )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Attachments Section */}
        <TodoImageGallery 
          imageHashes={foundTask.imageHashes} 
          onChange={(newHashes) => onUpdate(foundTask!.id, { imageHashes: newHashes })} 
        />

        <div className="h-px w-full bg-[var(--vsc-hover)] my-2 font-sans"></div>

        {/* Elevated separate Description/Notes workflow Card */}
        <div className="flex flex-col gap-2 relative">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--vsc-fg-muted)]">
              <FileText size={12} /> Notes
            </span>
            <button
              onClick={() =>
                setIsEditingNotesInDetails(!isEditingNotesInDetails)
              }
              className="flex items-center gap-1.5 h-6 px-2 rounded-[4px] text-[12px] transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-[var(--vsc-accent)] text-[var(--vsc-fg-muted)] hover:text-[var(--vsc-fg)] hover:bg-[var(--vsc-hover)]"
            >
              {isEditingNotesInDetails ? (
                <>
                  <Eye size={13} /> Preview
                </>
              ) : (
                <>
                  <Pencil size={13} /> Edit
                </>
              )}
            </button>
          </div>
          <div className="bg-[var(--vsc-editor)] border border-[var(--vsc-border)] rounded-md p-3 transition-colors focus-within:border-[var(--vsc-accent)] flex flex-col min-h-[250px] relative">
            {isEditingNotesInDetails ? (
              <textarea
                value={foundTask.notes || ""}
                onChange={(e) =>
                  onUpdate(foundTask!.id, { notes: e.target.value })
                }
                placeholder="Add math equations inside $$...$$ or $...$, lists, code fragments or links..."
                className="w-full min-h-[250px] bg-transparent border-none outline-none text-xs sm:text-[13px] text-[var(--vsc-fg)] resize-none overflow-hidden placeholder:text-[var(--vsc-fg-muted)] leading-relaxed custom-scrollbar p-0 focus:ring-0 focus:border-none focus:outline-none"
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = `${Math.max(250, target.scrollHeight)}px`;
                }}
                ref={(el) => {
                  if (el) {
                    el.style.height = "auto";
                    el.style.height = `${Math.max(250, el.scrollHeight)}px`;
                  }
                }}
                autoFocus
              />
            ) : (
              <div className="flex-1 custom-scrollbar overflow-y-auto">
                {foundTask.notes ? (
                  <LatexMarkdownRenderer content={foundTask.notes} />
                ) : (
                  <button
                    onClick={() => setIsEditingNotesInDetails(true)}
                    className="text-xs text-[var(--vsc-fg-muted)] hover:text-[var(--vsc-fg-muted)] italic text-left w-full h-full min-h-[200px]"
                  >
                    Write custom description / specs. Full Markdown and LaTeX
                    rendering supported.
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
