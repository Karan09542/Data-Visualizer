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
} from "lucide-react";
import { TodoNodeData, TodoTask } from "./TodoNodeRenderer";
import { format } from "date-fns";
import { parseISO } from "date-fns";
import { SmartDatePicker } from "./SmartDatePicker";
import { TodoSearchBar } from "./TodoSearchBar";

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
    <div className="text-[13px] leading-relaxed break-words text-slate-700 dark:text-slate-300 space-y-1 focus:outline-none">
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
                className="my-2 py-1.5 px-2.5 overflow-x-auto text-center font-mono text-xs bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200 dark:border-slate-800"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          } catch (e) {
            return (
              <pre
                key={index}
                className="text-red-500 text-xs font-mono my-1 p-1.5 bg-red-50 dark:bg-red-950/20 rounded"
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
                className="px-1 py-0.5 mx-0.5 font-mono text-[11.5px] bg-slate-100 dark:bg-slate-800 rounded"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          } catch (e) {
            return (
              <code
                key={index}
                className="text-red-500 text-xs font-mono px-1 bg-red-50 dark:bg-red-950/20 rounded"
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
                    <p className="text-[13px] leading-relaxed my-1.5 font-medium text-slate-800 dark:text-slate-200">
                      {children}
                    </p>
                  ),
                  h1: ({ children }) => (
                    <h1 className="text-lg font-bold text-slate-900 dark:text-white mt-3 mb-1.5 tracking-tight block leading-tight">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mt-2 mb-1 block leading-tight">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-2 mb-1 block">
                      {children}
                    </h3>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc pl-5 space-y-1.5 my-2 block text-[13px] text-slate-700 dark:text-slate-300">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-5 space-y-1.5 my-2 block text-[13px] text-slate-700 dark:text-slate-300">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
                      {children}
                    </li>
                  ),
                  code: ({ children }) => (
                    <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono border border-slate-200/50 dark:border-slate-700/50">
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
            "absolute top-full mt-1 z-50 min-w-[150px] bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl",
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

export const PREDEFINED_TAGS = ["bug", "urgent", "api", "backend", "security"];

export const getTagColorClass = (tag: string) => {
  const t = tag.toLowerCase();
  if (t === "bug")
    return "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60";
  if (t === "urgent")
    return "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-900/60";
  if (t === "api")
    return "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/60";
  if (t === "backend")
    return "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900/60";
  if (t === "security")
    return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60";
  return "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700";
};

export const STATUS_OPTIONS = [
  { value: "Todo", label: "Todo", icon: Circle, color: "text-slate-400" },
  {
    value: "In Progress",
    label: "In Progress",
    icon: Clock,
    color: "text-amber-500",
  },
  { value: "Review", label: "Review", icon: Eye, color: "text-blue-500" },
  {
    value: "Blocked",
    label: "Blocked",
    icon: AlertCircle,
    color: "text-red-500 font-semibold",
  },
  {
    value: "Completed",
    label: "Completed",
    icon: CheckCircle2,
    color: "text-emerald-500",
  },
];

export const PRIORITY_OPTIONS = [
  {
    value: "Normal",
    label: "Normal",
    icon: Minus,
    color: "text-slate-500",
    bgColor: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  {
    value: "Low",
    label: "Low",
    icon: ArrowDown,
    color: "text-blue-500",
    bgColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  {
    value: "Medium",
    label: "Medium",
    icon: ArrowRight,
    color: "text-amber-500",
    bgColor: "bg-amber-100 text-amber-700 dark:bg-amber-905/30 dark:text-amber-400",
  },
  {
    value: "High",
    label: "High",
    icon: ArrowUp,
    color: "text-orange-500",
    bgColor: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  {
    value: "Critical",
    label: "Critical",
    icon: AlertCircle,
    color: "text-red-500",
    bgColor: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-bold",
  },
];

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
  const { parsedData, setCode, codeFormat } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<
    "all" | "active" | "completed" | "high" | "outdated"
  >("all");
  const [isFlatList, setIsFlatList] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Resizer width & global toast feedback
  const [detailsWidth, setDetailsWidth] = useState(380);
  const [toast, setToast] = useState<string | null>(null);
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

  // Safely extract todoData from generic parsed object
  const getTodoData = (): TodoNodeData => {
    let current = getValueAtPath(parsedData, path);
    try {
      if (typeof current === "string") return JSON.parse(current);
      if (typeof current === "object" && current !== null)
        return current as TodoNodeData;
    } catch {}
    return { title: "Tasks", tasks: [] };
  };

  const todoData = getTodoData();

  const getStats = (tasks: TodoTask[]) => {
    let total = 0;
    let completed = 0;
    const walk = (tList: TodoTask[]) => {
      for (const t of tList) {
        total++;
        if (t.completed || t.status === "Completed") completed++;
        if (t.tasks) walk(t.tasks);
      }
    };
    walk(tasks);
    return { total, completed };
  };

  const stats = getStats(todoData.tasks || []);
  const progress =
    stats.total === 0 ? 0 : Math.round((stats.completed / stats.total) * 100);

  const syncTaskCompletionState = (tList: TodoTask[]): TodoTask[] => {
    return tList.map((t) => {
      let updatedTasks = t.tasks;
      if (t.tasks && t.tasks.length > 0) {
        updatedTasks = syncTaskCompletionState(t.tasks);
      }

      const hasChildren = updatedTasks && updatedTasks.length > 0;
      const hasIncomplete =
        hasChildren &&
        updatedTasks.some(
          (sub) => !sub.completed && sub.status !== "Completed",
        );

      let completed = t.completed;
      let status = t.status;
      if (hasChildren) {
        if (hasIncomplete) {
          completed = false;
          if (status === "Completed") {
            status = "Todo";
          }
        } else {
          // All children are checked complete, automatically check the parent
          completed = true;
          status = "Completed";
        }
      }

      return {
        ...t,
        tasks: updatedTasks,
        completed,
        status,
      };
    });
  };

  const saveTodoData = async (newData: TodoNodeData, forceSync = false) => {
    if (newData.tasks && (!isFlatList || forceSync)) {
      newData.tasks = syncTaskCompletionState(newData.tasks);
    }
    const updated = setValueAtPath(parsedData, path, newData);
    let newCode = "";
    if (codeFormat === "yaml") {
      try {
        const yaml = (await import("js-yaml")).default;
        newCode = yaml.dump(updated);
      } catch (e) {
        newCode = JSON.stringify(updated, null, 2);
      }
    } else {
      newCode = JSON.stringify(updated, null, 2);
    }
    setCode(newCode);
  };

  // High quality CRUD Operations for Tasks Tree
  const updateTask = (id: string, updates: Partial<TodoTask>) => {
    const walk = (tList: TodoTask[]): TodoTask[] => {
      return tList.map((t) => {
        if (t.id === id) {
          const merged = { ...t, ...updates };
          if ((updates.status as any) === "Completed") {
            merged.completed = true;
          } else if (
            updates.status &&
            (updates.status as any) !== "Completed"
          ) {
            merged.completed = false;
          }
          if (updates.completed === true) {
            merged.status = "Completed";
          } else if (updates.completed === false) {
            if (t.status === "Completed") merged.status = "Todo";
          }
          return merged;
        }
        if (t.tasks) return { ...t, tasks: walk(t.tasks) };
        return t;
      });
    };
    saveTodoData({ ...todoData, tasks: walk(todoData.tasks || []) });
  };

  const removeTask = (id: string) => {
    const findTask = (tList: TodoTask[]): TodoTask | null => {
      for (const t of tList) {
        if (t.id === id) return t;
        if (t.tasks) {
          const found = findTask(t.tasks);
          if (found) return found;
        }
      }
      return null;
    };

    const target = findTask(todoData.tasks || []);
    // Ensure we don't block via window.confirm in iframe. Just delete or use toast.
    // If it has children, we'll still just delete it directly to unblock users.
    const walk = (tList: TodoTask[]): TodoTask[] => {
      return tList
        .filter((t) => t.id !== id)
        .map((t) => {
          if (t.tasks) return { ...t, tasks: walk(t.tasks) };
          return t;
        });
    };
    saveTodoData({ ...todoData, tasks: walk(todoData.tasks || []) });
    if (selectedTaskId === id) setSelectedTaskId(null);
    showToast("Task deleted successfully");
  };

  const addTask = () => {
    const newTask: TodoTask = {
      id: Math.random().toString(36).substring(2, 9),
      text: "",
      completed: false,
      status: "Todo",
      priority: "Normal",
    };
    saveTodoData({
      ...todoData,
      tasks: [...(todoData.tasks || []), newTask],
    });
    if (window.innerWidth >= 768) {
      setSelectedTaskId(newTask.id);
    }
    setTimeout(() => {
      const el = document.getElementById(`input-${newTask.id}`);
      if (el) (el as HTMLInputElement).focus();
    }, 80);
  };

  const addTaskBelow = (id: string) => {
    const newId = Math.random().toString(36).substring(2, 9);
    const newTask: TodoTask = {
      id: newId,
      text: "",
      completed: false,
      status: "Todo",
      priority: "Normal",
    };

    const walk = (
      tList: TodoTask[],
    ): { list: TodoTask[]; inserted: boolean } => {
      const newList: TodoTask[] = [];
      let inserted = false;
      for (const t of tList) {
        newList.push(t);
        if (t.id === id) {
          newList.push(newTask);
          inserted = true;
        } else if (t.tasks && t.tasks.length > 0) {
          const subResult = walk(t.tasks);
          t.tasks = subResult.list;
          if (subResult.inserted) inserted = true;
        }
      }
      return { list: newList, inserted };
    };

    const { list } = walk(todoData.tasks || []);
    saveTodoData({ ...todoData, tasks: list });
    if (window.innerWidth >= 768) {
      setSelectedTaskId(newId);
    }
    setTimeout(() => {
      const el = document.getElementById(`input-${newId}`);
      if (el) {
        (el as HTMLInputElement).focus();
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }, 80);
  };

  const addNestedSubtask = (parentId: string) => {
    const newId = Math.random().toString(36).substring(2, 9);
    const newTask: TodoTask = {
      id: newId,
      text: "",
      completed: false,
      status: "Todo",
      priority: "Normal",
    };

    const walk = (tList: TodoTask[]): TodoTask[] => {
      return tList.map((t) => {
        if (t.id === parentId) {
          return {
            ...t,
            tasks: [...(t.tasks || []), newTask],
          };
        }
        if (t.tasks) return { ...t, tasks: walk(t.tasks) };
        return t;
      });
    };

    // Auto expand the parent item so they see the added nested subtask
    setCollapsedTaskIds((prev) => prev.filter((x) => x !== parentId));
    saveTodoData({ ...todoData, tasks: walk(todoData.tasks || []) });
    if (window.innerWidth >= 768) {
      setSelectedTaskId(newId);
    }
    setTimeout(() => {
      const el = document.getElementById(`input-${newId}`);
      if (el) {
        (el as HTMLInputElement).focus();
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }, 80);
  };

  const indentTask = (id: string) => {
    let success = false;
    const walk = (tList: TodoTask[]): TodoTask[] => {
      if (success) return tList;
      const index = tList.findIndex((t) => t.id === id);
      if (index > 0) {
        const targetTask = tList[index];
        const prevSibling = tList[index - 1];
        const updatedList = tList.filter((t) => t.id !== id);
        prevSibling.tasks = [...(prevSibling.tasks || []), targetTask];
        success = true;

        // Auto expand new parent as well
        setCollapsedTaskIds((prev) => prev.filter((x) => x !== prevSibling.id));
        return updatedList;
      }
      return tList.map((t) => {
        if (t.tasks && t.tasks.length > 0) {
          return { ...t, tasks: walk(t.tasks) };
        }
        return t;
      });
    };

    const updatedTasks = walk(todoData.tasks || []);
    if (success) {
      saveTodoData({ ...todoData, tasks: updatedTasks });
      showToast("Nested task inward");
      setTimeout(() => {
        const el = document.getElementById(`input-${id}`);
        if (el) (el as HTMLInputElement).focus();
      }, 50);
    } else {
      showToast("No preceding sibling task to nest under");
    }
  };

  const outdentTask = (id: string) => {
    let taskToMove: TodoTask | null = null;

    const removeAndExtract = (
      tList: TodoTask[],
      parentId: string | null = null,
    ): { list: TodoTask[]; parentOfTarget: string | null } => {
      let foundParentId: string | null = null;
      const filtered = tList.filter((t) => {
        if (t.id === id) {
          taskToMove = t;
          foundParentId = parentId;
          return false;
        }
        return true;
      });

      const mapped = filtered.map((t) => {
        if (t.tasks && t.tasks.length > 0) {
          const res = removeAndExtract(t.tasks, t.id);
          if (res.parentOfTarget) foundParentId = res.parentOfTarget;
          return { ...t, tasks: res.list };
        }
        return t;
      });

      return { list: mapped, parentOfTarget: foundParentId };
    };

    const { list: cleanList, parentOfTarget } = removeAndExtract(
      todoData.tasks || [],
    );
    if (!taskToMove || !parentOfTarget) {
      showToast("Task is already at top level");
      return;
    }

    const insertAfterParent = (tList: TodoTask[]): TodoTask[] => {
      const newList: TodoTask[] = [];
      for (const t of tList) {
        newList.push(t);
        if (t.id === parentOfTarget && taskToMove) {
          newList.push(taskToMove);
        } else if (t.tasks && t.tasks.length > 0) {
          t.tasks = insertAfterParent(t.tasks);
        }
      }
      return newList;
    };

    const updatedTasks = insertAfterParent(cleanList);
    saveTodoData({ ...todoData, tasks: updatedTasks });
    showToast("Shifted task outward");
    setTimeout(() => {
      const el = document.getElementById(`input-${id}`);
      if (el) (el as HTMLInputElement).focus();
    }, 50);
  };

  const moveTaskInTree = (id: string, direction: "up" | "down") => {
    let success = false;
    const walk = (tList: TodoTask[]): TodoTask[] => {
      if (success) return tList;
      const index = tList.findIndex((t) => t.id === id);
      if (index !== -1) {
        const newList = [...tList];
        if (direction === "up" && index > 0) {
          const temp = newList[index];
          newList[index] = newList[index - 1];
          newList[index - 1] = temp;
          success = true;
          return newList;
        } else if (direction === "down" && index < newList.length - 1) {
          const temp = newList[index];
          newList[index] = newList[index + 1];
          newList[index + 1] = temp;
          success = true;
          return newList;
        }
      }
      return tList.map((t) => {
        if (t.tasks && t.tasks.length > 0) {
          return { ...t, tasks: walk(t.tasks) };
        }
        return t;
      });
    };

    const updated = walk(todoData.tasks || []);
    if (success) {
      saveTodoData({ ...todoData, tasks: updated });
      showToast(`Shuffled task ${direction}`);
      setTimeout(() => {
        const el = document.getElementById(`input-${id}`);
        if (el) (el as HTMLInputElement).focus();
      }, 50);
    }
  };

  const handleMoveTask = (draggedId: string, targetId: string, position: "before" | "after" | "inside" | null) => {
    if (!draggedId || !targetId || !position || draggedId === targetId) return;

    if (isDescendant(draggedId, targetId, todoData.tasks || [])) {
      showToast("Cannot move a task into its own subtasks");
      return;
    }

    let draggedItem: TodoTask | null = null;

    // Remove first
    const removeAndExtract = (tList: TodoTask[]): TodoTask[] => {
      const result: TodoTask[] = [];
      for (const t of tList) {
        if (t.id === draggedId) {
          draggedItem = t;
          continue;
        }
        if (t.tasks && t.tasks.length > 0) {
          result.push({
            ...t,
            tasks: removeAndExtract(t.tasks)
          });
        } else {
          result.push(t);
        }
      }
      return result;
    };

    const cleanTree = removeAndExtract(todoData.tasks || []);

    if (!draggedItem) return;

    // Insert next
    const insertAfterBeforeInside = (tList: TodoTask[]): TodoTask[] => {
      const result: TodoTask[] = [];
      for (const t of tList) {
        if (t.id === targetId) {
          if (position === "before") {
            result.push(draggedItem!);
            result.push(t);
          } else if (position === "after") {
            result.push(t);
            result.push(draggedItem!);
          } else if (position === "inside") {
            result.push({
              ...t,
              tasks: [...(t.tasks || []), draggedItem!]
            });
            // Auto-expand target parent
            setCollapsedTaskIds((prev) => prev.filter((x) => x !== t.id));
          }
        } else {
          if (t.tasks && t.tasks.length > 0) {
            result.push({
              ...t,
              tasks: insertAfterBeforeInside(t.tasks)
            });
          } else {
            result.push(t);
          }
        }
      }
      return result;
    };

    const finalTree = insertAfterBeforeInside(cleanTree);
    saveTodoData({ ...todoData, tasks: finalTree });
    showToast("Task reordered");
  };

  const duplicateTaskDeep = (task: TodoTask): TodoTask => {
    const newId = Math.random().toString(36).substring(2, 9);
    return {
      ...task,
      id: newId,
      text: task.text ? `${task.text} (Copy)` : "Copy Task",
      tasks: task.tasks ? task.tasks.map((t) => duplicateTaskDeep(t)) : [],
    };
  };

  const duplicateTask = (id: string) => {
    let taskToDuplicate: TodoTask | null = null;

    const find = (tList: TodoTask[]) => {
      for (const t of tList) {
        if (t.id === id) {
          taskToDuplicate = t;
          return;
        }
        if (t.tasks) find(t.tasks);
      }
    };
    find(todoData.tasks || []);

    if (!taskToDuplicate) return;
    const copy = duplicateTaskDeep(taskToDuplicate);

    const insert = (tList: TodoTask[]): TodoTask[] => {
      const newList: TodoTask[] = [];
      for (const t of tList) {
        newList.push(t);
        if (t.id === id) {
          newList.push(copy);
        } else if (t.tasks && t.tasks.length > 0) {
          t.tasks = insert(t.tasks);
        }
      }
      return newList;
    };

    const updated = insert(todoData.tasks || []);
    saveTodoData({ ...todoData, tasks: updated });
    setSelectedTaskId(copy.id);
    showToast("Task duplicated");
    setTimeout(() => {
      const el = document.getElementById(`input-${copy.id}`);
      if (el) {
        (el as HTMLInputElement).focus();
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }, 85);
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
        "flex w-full h-full bg-white dark:bg-[#0d1117] text-slate-800 dark:text-slate-200 overflow-hidden relative font-sans",
        isDraggingSplitter && "select-none cursor-col-resize",
      )}
    >
      {/* Toast Feedback Banners */}
      {toast && (
        <div className="absolute bottom-5 right-5 z-50 bg-slate-900 dark:bg-[#161b22] text-white py-2 px-4 rounded-xl border border-slate-800 shadow-2xl flex items-center gap-2 transform transition-all animate-bounce">
          <Info size={16} className="text-blue-400" />
          <span className="text-xs font-semibold tracking-wide">{toast}</span>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Header */}
        <div className="px-3 py-2 md:px-5 md:py-3 border-b border-slate-200 dark:border-[#1e2329] bg-white dark:bg-[#0d1117] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 md:gap-3 shrink-0 z-10 shadow-sm relative">
          <div className="flex flex-col xs:flex-row xs:items-center gap-2 sm:gap-4 md:gap-6 min-w-0">
            <h2 className="font-extrabold text-base md:text-lg tracking-tight text-slate-900 dark:text-white uppercase font-sans whitespace-nowrap select-none">
              {todoData.title || "Project Tasks"}
            </h2>
            <div className="flex items-center gap-1.5 sm:gap-3 text-[10px] md:text-[11px] text-slate-500 dark:text-slate-400 font-semibold bg-slate-100/50 dark:bg-slate-800/30 px-2 py-1 md:px-3 md:py-1.5 rounded-lg border border-slate-200/50 dark:border-slate-800/50 w-full xs:w-auto overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <span className="flex items-center gap-1 md:gap-1.5 whitespace-nowrap shrink-0">
                <span className="text-slate-700 dark:text-slate-300">
                  {stats.total}
                </span>{" "}
                Tasks
              </span>
              <div className="w-px h-3 bg-slate-300 dark:bg-slate-700 shrink-0"></div>
              <span className="flex items-center gap-1 md:gap-1.5 whitespace-nowrap shrink-0">
                <span className="text-emerald-600 dark:text-emerald-400">
                  {stats.completed}
                </span>{" "}
                <span className="hidden sm:inline">Completed</span>
              </span>
              <div className="w-px h-3 bg-slate-300 dark:bg-slate-700 shrink-0"></div>
              <span className="flex items-center gap-1 md:gap-1.5 whitespace-nowrap shrink-0">
                <span className="text-blue-600 dark:text-blue-400">
                  {stats.total - stats.completed}
                </span>{" "}
                <span className="hidden sm:inline">Remaining</span>
              </span>
              <div className="flex items-center gap-1.5 md:gap-2 sm:ml-1 shrink-0">
                <div className="w-12 md:w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner hidden sm:block">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <span className="font-bold text-slate-700 dark:text-slate-300 tracking-tight">
                  {progress}%
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between sm:justify-start gap-2 shrink-0">
            <button
              onClick={() => {
                if (collapsedTaskIds.length > 0) {
                  expandAllSubtasks();
                } else {
                  collapseAllSubtasks();
                }
              }}
              title={
                collapsedTaskIds.length > 0
                  ? "Expand All Trees"
                  : "Collapse All Trees"
              }
              className="flex items-center justify-center gap-1.5 flex-1 sm:flex-none px-2 md:px-2.5 h-7 md:h-7 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md text-[10px] md:text-[11px] font-semibold border border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-sm shrink-0 whitespace-nowrap cursor-pointer active:scale-95"
            >
              {collapsedTaskIds.length > 0 ? (
                <>
                  <Maximize2 size={11.5} />
                  <span className="hidden sm:inline">Expand All</span>
                </>
              ) : (
                <>
                  <Minimize2 size={11.5} />
                  <span className="hidden sm:inline">Collapse All</span>
                </>
              )}
            </button>
            <button
              onClick={() => {
                saveTodoData({ ...todoData, tasks: [] });
                showToast("Cleared all tasks");
              }}
              className="flex items-center justify-center gap-1.5 flex-1 sm:flex-none px-2 md:px-2.5 h-7 md:h-7 bg-slate-50 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/30 text-slate-600 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-400 rounded-md text-[10px] md:text-[11px] font-semibold border border-slate-200 dark:border-slate-700/80 hover:border-rose-200 dark:hover:border-rose-900/50 transition-all shadow-sm shrink-0 whitespace-nowrap cursor-pointer active:scale-95"
              title="Clear All Tasks"
            >
              <Trash2 size={11.5} />
              <span className="hidden sm:inline">Clear All</span>
            </button>
            <button
              onClick={addTask}
              className="flex items-center justify-center gap-1.5 flex-1 sm:flex-none px-2 md:px-2.5 h-7 md:h-7 bg-blue-600 hover:bg-blue-700 text-white text-[10px] md:text-[11px] font-bold uppercase tracking-wider rounded-md shadow-sm active:scale-95 transition-all outline-none shrink-0 whitespace-nowrap cursor-pointer"
            >
              <Plus size={12.5} />{" "}
              <span className="hidden sm:inline">New Task</span>
            </button>
          </div>
        </div>

        {/* Search, filters, tools overview */}
        <div className="px-3 py-2 md:px-5 md:py-3 border-b border-slate-200 dark:border-[#1e2329] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 md:gap-4 shrink-0 bg-slate-50/50 dark:bg-[#161b22]/50 relative z-30">
          <div className="flex w-full sm:w-auto shrink-0 flex-1 min-w-[200px]">
            <TodoSearchBar
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              allTasks={todoData.tasks || []}
            />
          </div>
          <div className="flex items-center gap-1 bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-slate-800 p-0.5 rounded-lg shadow-sm w-full sm:w-auto justify-between sm:justify-start overflow-hidden">
            <div className="flex items-center gap-0.5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {(
                ["all", "active", "completed", "high", "outdated"] as const
              ).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2 py-1.5 md:px-3 md:py-1.5 text-[10px] md:text-[11px] uppercase tracking-wider font-extrabold rounded-md transition-all whitespace-nowrap ${filter === f ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-inner font-black" : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="flex items-center shrink-0 border-l border-slate-100 dark:border-slate-800 pl-1 ml-1">
              <button
                onClick={() => {
                  const nextFlat = !isFlatList;
                  setIsFlatList(nextFlat);
                  if (!nextFlat) {
                    // Force complete states synchronization when returning to Tree View
                    saveTodoData({ ...todoData }, true);
                  }
                }}
                title={isFlatList ? "Show Tree View" : "Show Flat List"}
                className={`p-1.5 rounded-md transition-all shrink-0 ${isFlatList ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
              >
                {isFlatList ? <List size={14} /> : <Layers size={14} />}
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable list viewport wrapper */}
        <div className="flex-1 overflow-y-auto w-full custom-scrollbar bg-slate-50/30 dark:bg-[#090d12]/20" onClick={(e) => {
          if (e.target === e.currentTarget || (e.target as Element).closest && !(e.target as Element).closest('.task-list-item')) {
            setSelectedTaskId(null);
          }
        }}>
          <div className="p-5 max-w-6xl mx-auto min-h-full flex flex-col pointer-events-none">
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
              "hidden md:block transition-all cursor-col-resize z-20 shrink-0 border-l border-slate-200 dark:border-slate-800/50",
              isDraggingSplitter
                ? "w-1.5 bg-blue-500"
                : "w-1 bg-slate-200 dark:bg-[#1e2329] hover:bg-blue-400 hover:w-1.5",
            )}
            onMouseDown={startResize}
          />

          {/* Mobile Overlay */}
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/10 dark:bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedTaskId(null)}
          />

          <div
            style={
              typeof window !== "undefined" && window.innerWidth >= 768
                ? { width: `${detailsWidth}px` }
                : {}
            }
            className="fixed inset-0 sm:inset-y-0 sm:left-auto sm:right-0 z-50 md:relative md:z-10 flex flex-col bg-white dark:bg-[#0d1117] min-w-0 shadow-2xl md:shadow-[-10px_0_25px_-10px_rgba(0,0,0,0.06)] shrink-0 h-full md:border-l border-slate-200 dark:border-slate-800/80 w-full sm:w-[420px] md:w-auto animate-in slide-in-from-right-8 md:animate-none"
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
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 flex-grow">
          <SearchX
            size={44}
            className="text-slate-300 dark:text-slate-700 mb-3"
          />
          <p className="text-sm font-semibold text-slate-500">
            No matching tasks found
          </p>
          <p className="text-xs text-slate-400 mt-1">
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
          className="absolute top-0 left-0 right-0 h-[3px] bg-blue-500 dark:bg-blue-400 rounded-full z-45 animate-pulse"
          style={{ marginLeft: `${level * 1.5}rem` }}
        />
      )}
      {dropIndicator === "after" && (
        <div 
          className="absolute bottom-0 left-0 right-0 h-[3px] bg-blue-500 dark:bg-blue-400 rounded-full z-45 animate-pulse"
          style={{ marginLeft: `${level * 1.5}rem` }}
        />
      )}

      <div
        draggable={isDraggable}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all border border-transparent relative",
          isSelected
            ? "bg-blue-50/70 dark:bg-blue-950/20 border-blue-200/50 dark:border-blue-900/40 ring-1 ring-blue-500/10 dark:ring-blue-500/20 shadow-xs"
            : "hover:bg-slate-100/50 dark:hover:bg-slate-800/40",
          dropIndicator === "inside" && "bg-blue-50/40 dark:bg-blue-950/20 border-blue-400 dark:border-blue-800 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500/15"
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
              "w-5 h-5 flex items-center justify-center shrink-0 cursor-grab active:cursor-grabbing text-slate-350 dark:text-slate-600 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-all",
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
            className="p-1 -ml-1 rounded hover:bg-slate-250 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition-colors shrink-0 outline-none"
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

        {/* Task Complete Check Circle button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isCompleted && hasIncompleteChildren) {
              showToast("Unfinished subtasks remaining");
              return;
            }
            onUpdate(task.id, {
              completed: !isCompleted,
              status: !isCompleted ? "Completed" : "Todo",
            });
          }}
          className={cn(
            "shrink-0 flex items-center justify-center mt-0.5 transition-colors duration-150 outline-none relative",
            isCompleted
              ? "text-emerald-500"
              : "text-slate-300 dark:text-slate-600 hover:text-slate-505",
            hasIncompleteChildren &&
              !isCompleted &&
              "opacity-40 cursor-not-allowed hover:text-slate-300 dark:hover:text-slate-600",
          )}
          title={
            hasIncompleteChildren && !isCompleted
              ? "Complete subtasks first"
              : "Toggle completed"
          }
        >
          {isCompleted ? <CheckCircle2 size={16} /> : <Circle size={16} />}
        </button>

        {/* Core title editor */}
        <div className="flex-1 flex flex-col min-w-0 gap-1">
          {isEditingTitle ? (
            <textarea
              id={`input-${task.id}`}
              className={cn(
                "w-full bg-slate-150/40 dark:bg-[#161b22]/50 border border-slate-200/50 dark:border-[#21262d] rounded-md outline-none text-[13px] font-semibold px-2 py-1 focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500/60 min-h-[38px] resize-none overflow-hidden transition-all",
                isCompleted
                  ? "line-through text-slate-400 dark:text-slate-600"
                  : "text-slate-800 dark:text-slate-100",
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
              ref={(el) => {
                if (el) {
                  el.focus();
                  const len = el.value.length;
                  el.setSelectionRange(len, len);
                }
              }}
            />
          ) : (
            <input
              id={`input-${task.id}`}
              type="text"
              className={cn(
                "w-full bg-transparent border-none outline-none text-[13px] font-semibold truncate transition-all focus:ring-0 p-0 focus:border-none cursor-text",
                isCompleted
                  ? "line-through text-slate-400 dark:text-slate-600"
                  : "text-slate-800 dark:text-slate-100",
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
                          "flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold tracking-tight hover:brightness-95 hover:scale-95 transition-all bg-slate-50 dark:bg-[#12161a]",
                          statusInfo.color,
                        )}
                      >
                        <statusInfo.icon size={10} />
                        <span className="uppercase">{statusInfo.label}</span>
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
                            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                          >
                            <OptIcon size={12} className={opt.color} />
                            {opt.label}
                            {opt.value === task.status && (
                              <Check
                                size={12}
                                className="ml-auto opacity-50 text-blue-500"
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
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider hover:scale-95 transition-all block",
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
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
                        >
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
                              opt.color,
                            )}
                          >
                            {opt.label}
                          </span>
                          {opt.value === task.priority && (
                            <Check
                              size={12}
                              className="ml-auto opacity-50 text-blue-500"
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
                          "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 transition-colors",
                          isOverdue
                            ? "text-red-500 bg-red-50 dark:bg-red-950/20 font-bold"
                            : "text-slate-500 dark:text-slate-400",
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
                      <div className="flex flex-col gap-0.5 pb-2 border-b border-slate-100 dark:border-slate-800/80 mb-2">
                        <button
                          onClick={(e) => {
                            const utcDate = new Date();
                            onUpdate(task.id, {
                              dueDate: utcDate.toISOString().split("T")[0],
                            });
                            close();
                          }}
                          className="w-full flex items-center gap-2 text-left px-2.5 py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-all cursor-pointer"
                        >
                          <CalendarIcon size={12} className="text-blue-500" />
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
                          className="w-full flex items-center gap-2 text-left px-2.5 py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-all cursor-pointer"
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
                          className="w-full flex items-center gap-2 text-left px-2.5 py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-all cursor-pointer"
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
                            className="w-full flex items-center gap-2 text-left px-2.5 py-1.5 text-[11px] font-extrabold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-all cursor-pointer mt-1 border-t border-slate-100 dark:border-slate-800/80 pt-2"
                          >
                            <X size={12} />
                            <span>Clear Target Date</span>
                          </button>
                        )}
                      </div>
                      <div className="px-2 py-1 flex items-center gap-3 justify-between mt-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
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
                            <CustomDateInput className="bg-white dark:bg-[#151a23] border border-slate-200 dark:border-slate-800 rounded-md px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 w-[110px] flex items-center group-hover:bg-slate-50 dark:group-hover:bg-[#1a212d] transition-colors cursor-pointer relative z-0">
                                <span className={cn(!task.dueDate && "text-slate-400 group-hover:text-slate-500")}>
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
                        "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border",
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
                  ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" 
                  : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-blue-500"
              }`}
            >
              {isCopied ? <Check size={13} /> : <Copy size={13} />}
            </button>

            {/* Notes inline toggle */}
            <button
              onClick={() => setIsNotesExpanded(!isNotesExpanded)}
              title={isNotesExpanded ? "Hide Description" : "Show Description"}
              className={cn(
                "p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors outline-none cursor-pointer",
                isNotesExpanded
                  ? "text-blue-500 bg-blue-100/45 dark:bg-blue-950/30"
                  : task.notes
                    ? "text-amber-500 bg-amber-50/50 dark:bg-amber-950/10"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300",
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
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-blue-550 outline-none cursor-pointer"
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
              className="p-1 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-colors text-slate-400 hover:text-red-500 outline-none cursor-pointer"
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
                    "p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors outline-none cursor-pointer text-slate-400",
                    isMenuOpen
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"
                      : "",
                  )}
                >
                  <MoreHorizontal size={14} />
                </button>
              }
              contentClassName="w-48 p-1.5 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 flex flex-col right-0 origin-top-right overflow-hidden"
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
                    className="w-full flex items-center gap-2 text-left px-2 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
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
                      "w-full flex items-center gap-2 text-left px-2 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer",
                      isNotesExpanded
                        ? "text-blue-600 bg-blue-50 dark:bg-blue-900/20"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800",
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
                    className="w-full flex items-center gap-2 text-left px-2 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer mt-0.5"
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
                    className="w-full flex items-center gap-2 text-left px-2 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-colors cursor-pointer mt-0.5"
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
          className="border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-[#11141a]/30 rounded-xl p-4 my-1.5 transition-all outline-none"
          style={{ marginLeft: `${level * 1.5 + 1.25}rem` }}
          onClick={(e) => {
            // Prevent task selection on clicking notes container
            e.stopPropagation();
          }}
        >
          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-200/50 dark:border-slate-800/50">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
              <AlignLeft size={11} className="text-blue-500" />
              <span>Inline Description & Specs</span>
            </div>
            <div>
              <button
                onClick={() => setIsEditingNotesInline(!isEditingNotesInline)}
                className="flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded bg-slate-100/50 hover:bg-slate-200/50 dark:bg-slate-800/40 dark:hover:bg-slate-700/50 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-all border border-slate-200/50 dark:border-slate-700/50"
              >
                {isEditingNotesInline ? (
                  <>
                    <Eye size={11} /> PREVIEW SPECS
                  </>
                ) : (
                  <>
                    <Pencil size={11} /> EDIT SPECS
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
              className="w-full min-h-[125px] bg-transparent border-none outline-none text-xs text-slate-800 dark:text-slate-200 resize-y leading-relaxed font-sans placeholder:text-slate-400 dark:placeholder:text-slate-700 focus:ring-0 p-0"
              autoFocus
            />
          ) : (
            <div className="pt-0.5">
              {task.notes ? (
                <LatexMarkdownRenderer content={task.notes} />
              ) : (
                <button
                  onClick={() => setIsEditingNotesInline(true)}
                  className="text-xs text-slate-400 hover:text-slate-500 dark:text-slate-500 dark:hover:text-slate-400 italic text-left w-full block transition-colors py-1 pl-1"
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
        <div className="flex flex-col gap-0.5 border-l-2 border-slate-100 dark:border-slate-800/60 ml-[1.65rem] pl-1 relative">
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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-[#0d1117] relative">
      {/* Header Actions Panel */}
      <div className="flex items-center justify-between px-3 md:px-4 py-2 md:py-3 shrink-0 border-b border-slate-100 dark:border-slate-800/60 sticky top-0 bg-white/95 dark:bg-[#0d1117]/95 backdrop-blur-sm z-10 shadow-sm relative">
        <div className="flex items-center gap-1.5 md:gap-1 text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
          <button
            onClick={onClose}
            className="md:hidden p-1.5 -ml-1 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-1.5 pl-0.5">
            <Sliders
              size={12}
              className="text-blue-500 opacity-90 hidden sm:block"
            />
            <span className="hidden sm:inline">Task Properties</span>
            <span className="md:hidden">Details</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
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
              "px-2 h-7 rounded-md text-[10px] font-bold tracking-wider uppercase transition-all flex items-center gap-1 border cursor-pointer",
              (!hasIncompleteChildren || isCompleted) &&
                "active:scale-95",
              isCompleted
                ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20 dark:text-emerald-400 dark:bg-emerald-400/10 dark:border-emerald-400/20 dark:hover:bg-emerald-400/20"
                : "text-slate-700 bg-slate-100/60 border-slate-200 hover:bg-slate-200/60 dark:text-slate-300 dark:bg-slate-800/50 dark:border-slate-700 hover:dark:bg-slate-800 dark:hover:border-slate-600",
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
              <CheckCircle2 size={11.5} className="text-emerald-500" />
            ) : (
              <Circle
                size={11.5}
                className="text-slate-450 dark:text-slate-400"
              />
            )}
            <span>{isCompleted ? "Completed" : "Mark Complete"}</span>
          </button>
          <button
            onClick={() => {
              onRemove(foundTask!.id);
              onClose();
            }}
            className="px-2 h-7 rounded-md text-[10px] font-bold tracking-wider uppercase transition-all flex items-center gap-1 border cursor-pointer border-rose-200 hover:bg-rose-500/10 hover:border-rose-500 hover:text-rose-600 dark:border-rose-900/40 dark:hover:text-rose-455 hover:scale-95 text-slate-500 dark:text-slate-400"
            title="Delete active task"
          >
            <Trash2 size={11.5} />
            <span>Delete</span>
          </button>
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1"></div>
          <button
            onClick={onClose}
            className="hidden md:flex p-1 min-w-8 h-8 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors outline-none cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-12 pt-5 custom-scrollbar flex flex-col gap-6">
        {/* Title input field auto growers */}
        <div className="flex flex-col -ml-1">
          <textarea
            value={foundTask.text || ""}
            onChange={(e) => onUpdate(foundTask!.id, { text: e.target.value })}
            className="w-full bg-transparent border-transparent text-2xl font-bold tracking-tight text-slate-900 dark:text-white outline-none placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:ring-0 resize-none overflow-hidden leading-tight p-1 focus:border-transparent"
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
        </div>

        {/* Metadatas select list */}
        <div
          className="flex flex-col gap-3 py-2 bg-slate-50/40 dark:bg-[#11141a]/40 rounded-xl p-3 border border-slate-100 dark:border-slate-800"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Status Workflow select popovers */}
          <div className="flex items-center justify-between">
            <div className="shrink-0 text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Layers size={12} /> Status
            </div>
            <CustomDropdown
              isOpen={isStatusOpen}
              setIsOpen={setIsStatusOpen}
              trigger={
                <button className="h-8 px-2 py-1 text-xs flex items-center justify-start rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none hover:scale-95 transition-all font-semibold uppercase gap-1.5 cursor-pointer">
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
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        <OptIcon size={12} className={opt.color} />
                        {opt.label}
                        {opt.value === foundTask!.status && (
                          <Check
                            size={12}
                            className="ml-auto opacity-50 text-blue-500"
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
          <div className="flex items-center justify-between">
            <div className="shrink-0 text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <AlertCircle size={12} /> Priority
            </div>
            <CustomDropdown
              isOpen={isPriorityOpen}
              setIsOpen={setIsPriorityOpen}
              trigger={
                <button className="h-8 px-2 py-1 text-xs flex items-center justify-start rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none hover:scale-95 transition-all font-semibold uppercase gap-1.5 cursor-pointer">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm",
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
                      className="w-full flex items-center gap-2 px-2.5 py-2 text-xs rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left font-semibold cursor-pointer text-slate-700 dark:text-slate-200"
                    >
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
                          opt.color,
                        )}
                      >
                        {opt.label}
                      </span>
                      {opt.value === (foundTask!.priority || "Normal") && (
                        <Check
                          size={12}
                          className="ml-auto opacity-50 text-blue-500"
                        />
                      )}
                    </button>
                  ))}
                </>
              )}
            </CustomDropdown>
          </div>

          {/* Date Picker customized options (Today/Tomorrow/NextWeek/Clear) */}
          <div className="flex items-center justify-between">
            <div className="shrink-0 text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <CalendarIcon size={12} /> Target Date
            </div>
            <CustomDropdown
              isOpen={isDatePickerOpen}
              setIsOpen={setIsDatePickerOpen}
              trigger={
                <button
                  className={cn(
                    "h-8 px-2 py-1 text-xs flex items-center gap-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 outline-none hover:scale-95 transition-all font-semibold text-slate-700 dark:text-slate-300 cursor-pointer",
                    !foundTask.dueDate &&
                      "text-slate-400 font-normal normal-case",
                  )}
                >
                  <span className={cn(isOverdue && "text-red-500 font-black")}>
                    {foundTask.dueDate
                      ? getFormatDate(foundTask.dueDate)
                      : "Add target date..."}
                  </span>
                  {isOverdue && (
                    <span className="ml-1 px-1 py-0.2 text-[8px] bg-red-400/10 text-red-500 uppercase tracking-widest rounded">
                      Overdue
                    </span>
                  )}
                  <ChevronDown size={12} className="opacity-50" />
                </button>
              }
              contentClassName="w-auto p-2 border border-slate-200 dark:border-slate-800 shadow-2xl z-30 flex flex-col right-0"
            >
              {({ close }: any) => (
                <>
                  <div className="flex flex-col gap-0.5 pb-2 border-b border-slate-100 dark:border-slate-800/80 mb-2">
                    <button
                      onClick={(e) => {
                        const utcDate = new Date();
                        onUpdate(foundTask!.id, {
                          dueDate: utcDate.toISOString().split("T")[0],
                        });
                        close();
                      }}
                      className="w-full flex items-center gap-2 text-left px-2.5 py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-all cursor-pointer"
                    >
                      <CalendarIcon size={12} className="text-blue-500" />
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
                      className="w-full flex items-center gap-2 text-left px-2.5 py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-all cursor-pointer"
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
                      className="w-full flex items-center gap-2 text-left px-2.5 py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-all cursor-pointer"
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
                        className="w-full flex items-center gap-2 text-left px-2.5 py-1.5 text-[11px] font-extrabold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-all cursor-pointer mt-1 border-t border-slate-100 dark:border-slate-800/80 pt-2"
                      >
                        <X size={12} />
                        <span>Clear Target Date</span>
                      </button>
                    )}
                  </div>
                  <div className="px-2 py-1 flex items-center gap-3 justify-between mt-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
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
                        <CustomDateInput className="bg-white dark:bg-[#151a23] border border-slate-200 dark:border-slate-800 rounded-md px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 w-[110px] flex items-center group-hover:bg-slate-50 dark:group-hover:bg-[#1a212d] transition-colors cursor-pointer relative z-0">
                            <span className={cn(!foundTask.dueDate && "text-slate-400 group-hover:text-slate-500")}>
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
        <div className="flex items-start justify-between flex-col gap-2 relative z-10 pt-2 border-t border-slate-100 dark:border-slate-800/60 mt-3">
          <div className="shrink-0 text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 pt-1">
            <Hash size={12} /> Labels
          </div>
          <div className="flex flex-wrap gap-1.5 w-full">
            {(foundTask.tags || []).map((tag, i) => (
              <div
                key={`${tag}-${i}`}
                className={cn(
                  "flex items-center gap-1 border px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider group",
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
              <div className="flex items-stretch h-[26px]">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onFocus={() => setIsTagFocused(true)}
                  onBlur={() => setTimeout(() => setIsTagFocused(false), 200)}
                  placeholder="Add label..."
                  className="bg-transparent h-full border border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 px-2.5 rounded-l-md text-[10px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300 outline-none w-[110px] focus:w-[130px] transition-all focus:border-blue-500 focus:bg-slate-50 dark:focus:bg-slate-800/50"
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
                  className="bg-transparent h-full border border-l-0 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 px-2 rounded-r-md text-[10px] text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all outline-none flex items-center justify-center shrink-0"
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
                <div className="absolute top-full left-0 mt-1 max-h-48 overflow-y-auto w-[180px] bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 flex flex-col py-1">
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
                        className="text-left flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
                      >
                        <Hash size={10} className="opacity-40" />
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border",
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
                        className="text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 transition-colors"
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

        <div className="h-px w-full bg-slate-100 dark:bg-slate-800/60 my-2 font-sans"></div>

        {/* Elevated separate Description/Notes workflow Card */}
        <div className="flex flex-col gap-2 relative mt-4">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">
            <span className="flex items-center gap-1.5">
              <FileText size={12} className="opacity-70" /> Notes & Specs
            </span>
            <button
              onClick={() =>
                setIsEditingNotesInDetails(!isEditingNotesInDetails)
              }
              className="flex items-center gap-2 text-[10px] font-bold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all border border-slate-200 dark:border-slate-700 outline-none shadow-sm active:scale-95"
            >
              {isEditingNotesInDetails ? (
                <>
                  <Eye size={12} className="text-blue-500" /> PREVIEW
                </>
              ) : (
                <>
                  <Pencil size={12} className="opacity-70" /> WRITE / EDIT
                </>
              )}
            </button>
          </div>
          <div className="bg-slate-50/40 dark:bg-[#11141a]/40 border border-slate-200/85 dark:border-slate-800 rounded-xl p-4 shadow-inner ring-offset-background transition-all hover:bg-slate-50/60 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 flex flex-col min-h-[250px] relative">
            {isEditingNotesInDetails ? (
              <textarea
                value={foundTask.notes || ""}
                onChange={(e) =>
                  onUpdate(foundTask!.id, { notes: e.target.value })
                }
                placeholder="Add math equations inside $$...$$ or $...$, lists, code fragments or links..."
                className="w-full min-h-[250px] bg-transparent border-none outline-none text-xs sm:text-[13px] text-slate-800 dark:text-slate-200 resize-none overflow-hidden placeholder:text-slate-400 dark:placeholder:text-slate-700 leading-relaxed custom-scrollbar p-0 focus:ring-0 focus:border-none focus:outline-none"
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
                    className="text-xs text-slate-400 hover:text-slate-500 dark:text-slate-500 dark:hover:text-slate-400 italic text-left w-full h-full min-h-[200px]"
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
