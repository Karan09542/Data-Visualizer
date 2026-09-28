import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  X,
  Check,
  Hash,
  ChevronDown,
  Trash2,
  Calendar as CalendarIcon,
  Pin,
  ClipboardList,
  Globe,
  FolderOpen,
  Folder,
  FileText,
  Sparkles,
  ListTree,
  List,
  ExternalLink,
  Plus,
  Camera,
  Upload,
  Image as ImageIcon,
  Star,
  CornerDownLeft,
  CheckCircle2,
  Paperclip,
  AlignLeft,
  Eye,
  Pencil,
  Layers,
} from "lucide-react";
import Markdown from "react-markdown";
import { SmartDatePicker } from "./SmartDatePicker";
import { CameraCaptureModal } from "./CameraCaptureModal";
import { ConfirmModal } from "./ConfirmModal";
import { format, parseISO } from "date-fns";
import { useStore } from "../store/useStore";
import { JavaScriptIcon, TypeScriptIcon, PythonIcon, JsonIcon, MarkdownIcon, TextIcon } from "./FileIcons";
import { TaskImagePreview } from "./TaskImagePreview";
import { cn } from "@/lib/utils";
import { importFile } from "../utils/assetManager";
import * as todo from "./todo/todoModel";
import type { TodoTask } from "./todo/todoModel";
import { createTodoList, findTodoLists, prepareTodoSerializer, writeTasks } from "./todo/todoStorage";
import {
  LengthHint,
  MENU_CLASS,
  PREDEFINED_TAGS,
  PriorityBadge,
  PriorityPicker,
  STATUS_OPTIONS,
  TaskCheckbox,
  getTagColorClass,
} from "./todo/TodoUI";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface FlatFileItem {
  id: string; // "root.dataSources.transform_users_js_node"
  name: string; // "transform_users.js"
  type: string; // "js_node" | "ts_node" | "py_node" | "api_node" | "todo_node" | "transfer_node" | "primitive" | "folder"
  pathStr: string; // "dataSources.transform_users_js_node"
  realKey: string; // "transform_users_js_node"
}

/** A task together with the list it lives in, for views across all lists. */
export interface FlatTodoItem extends TodoTask {
  nodePath: string; // The .todo node path
  nodeName: string; // Friendly file name of the .todo node
  parentTaskId?: string;
  depth: number;
}

// ─── Workspace scanning ────────────────────────────────────────────────────────

export function getAllFiles(data: any, path: string = "root"): FlatFileItem[] {
  if (!data || typeof data !== "object") return [];
  const items: FlatFileItem[] = [];
  const isParentArray = Array.isArray(data);

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "function") continue;
    const currentPath = path === "root" ? `root.${key}` : `${path}.${key}`;
    const keyLower = key.toLowerCase();

    let displayName = key;
    if (isParentArray) {
      if (typeof value === "string") displayName = value;
      else if (value && typeof value === "object" && !Array.isArray(value) && typeof (value as any).name === "string") {
        displayName = (value as any).name;
      } else {
        displayName = `[${key}]`;
      }
    }

    const item = (name: string, type: string) =>
      items.push({ id: currentPath, name, type, pathStr: currentPath.replace(/^root\./, ""), realKey: key });

    if (keyLower.endsWith("_js_node")) item(key.replace(/_js_node$/i, ".js"), "js_node");
    else if (keyLower.endsWith("_py_node")) item(key.replace(/_py_node$/i, ".py"), "py_node");
    else if (keyLower.endsWith("_ts_node")) item(key.replace(/_ts_node$/i, ".ts"), "ts_node");
    else if (keyLower.endsWith("_api_node")) item(key.replace(/_api_node$/i, ".api"), "api_node");
    else if (keyLower.endsWith("_todo_node") || keyLower.endsWith(".todo"))
      item(keyLower.endsWith(".todo") ? key : key.replace(/_todo_node$/i, ".todo"), "todo_node");
    else if (keyLower.endsWith("_transfer_node") || keyLower.endsWith(".transfer"))
      item(keyLower.endsWith(".transfer") ? key : key.replace(/_transfer_node$/i, ".transfer"), "transfer_node");
    else if (keyLower.endsWith("_math_node") || keyLower.endsWith(".math"))
      item(keyLower.endsWith(".math") ? key : key.replace(/_math_node$/i, ".math"), "math_node");
    else if (/_(json|yaml|yml|csv|xml|md|txt)$/i.test(keyLower))
      item(key.replace(/_(json|yaml|yml|csv|xml|md|txt)$/i, ".$1"), "primitive");
    else if (typeof value === "object" && value !== null) {
      item(displayName, "folder");
      items.push(...getAllFiles(value, currentPath));
    } else item(displayName, "primitive");
  }
  return items;
}

/** Every task in every list, in tree order, with its list and depth. */
export function scanAllTodos(data: any): FlatTodoItem[] {
  return findTodoLists(data).flatMap(({ path, name, list }) =>
    todo.flattenTasks(list.tasks).map(({ task, depth, parentId }) => ({
      ...task,
      nodePath: path,
      nodeName: name,
      parentTaskId: parentId,
      depth,
    })),
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function scoreFuzzy(str: string, query: string): number {
  if (!query) return 1;
  const s = str.toLowerCase();
  const q = query.toLowerCase();
  if (s.includes(q)) {
    // exact substring match receives highest priority
    return 100 + (s.startsWith(q) ? 50 : 0) - s.length;
  }
  let queryIdx = 0;
  let matches = 0;
  for (let textIdx = 0; textIdx < s.length; textIdx++) {
    if (s[textIdx] === q[queryIdx]) {
      queryIdx++;
      matches++;
      if (queryIdx === q.length) {
        return matches - s.length - textIdx; // closer matches are better
      }
    }
  }
  return matches === q.length ? 1 : 0;
}

function renderOverlayFileIcon(type: string, name: string) {
  const cls = "w-4 h-4 shrink-0";
  if (type === "js_node" || name.endsWith(".js")) return <JavaScriptIcon />;
  if (type === "py_node" || name.endsWith(".py")) return <PythonIcon />;
  if (type === "ts_node" || name.endsWith(".ts")) return <TypeScriptIcon />;
  if (type === "api_node" || name.endsWith(".api")) return <Globe className={`${cls} text-sky-500`} />;
  if (type === "todo_node" || name.endsWith(".todo")) return <CheckCircle2 className={`${cls} text-blue-500`} />;
  if (type === "transfer_node" || name.endsWith(".transfer")) return <Globe className={`${cls} text-emerald-500`} />;
  if (type === "math_node" || name.endsWith(".math")) return <Sparkles className={`${cls} text-fuchsia-500`} />;
  if (type === "folder") return <Folder className={`${cls} text-amber-500`} />;
  if (name.endsWith(".json")) return <JsonIcon />;
  if (name.endsWith(".md")) return <MarkdownIcon />;
  if (name.endsWith(".txt")) return <TextIcon />;
  return <FileText className={`${cls} text-slate-400`} />;
}

const readLocal = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeLocal = (key: string, value: unknown) => {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: preferences just don't persist */
  }
};

// Stored as a plain string by earlier versions; read both shapes.
const readDefaultList = (): string | null => {
  try {
    const raw = localStorage.getItem("productivity_default_todo_node");
    if (!raw) return null;
    return raw.startsWith('"') ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
};

const formatDue = (date: string) => {
  try {
    return format(parseISO(date), "MMM d");
  } catch {
    return date;
  }
};

const isOverdue = (task: TodoTask) => {
  if (!task.dueDate || todo.isTaskDone(task)) return false;
  const [y, m, d] = task.dueDate.split("-").map(Number);
  if (!y || !m || !d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(y, m - 1, d) < today;
};

const MEDIA_ACCEPT = "image/*,video/*,audio/*";

// ─── Small UI pieces ───────────────────────────────────────────────────────────

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-white/5 font-sans text-[10px] font-medium text-slate-500 dark:text-slate-400">
      {children}
    </kbd>
  );
}

/** Backdrop plus a panel near the top of the screen, like a command palette. */
function PaletteShell({
  label,
  width,
  zIndex,
  onClose,
  children,
  onPaste,
  takeFocus = false,
}: {
  label: string;
  width: number;
  zIndex: number;
  onClose: () => void;
  children: React.ReactNode;
  onPaste?: (e: React.ClipboardEvent) => void;
  /** Move keyboard focus into the panel on open (for panels without an autofocused input). */
  takeFocus?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (takeFocus) panelRef.current?.focus();
  }, [takeFocus]);
  return (
    <motion.div
      className="fixed inset-0 flex items-start justify-center px-3 sm:px-4 pt-[8vh] sm:pt-[10vh] pb-6 bg-slate-950/40 dark:bg-black/60 backdrop-blur-[2px]"
      style={{ zIndex }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        initial={{ opacity: 0, y: -8, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.985 }}
        transition={{ duration: 0.14, ease: "easeOut" }}
        className="w-full flex flex-col max-h-[80vh] overflow-hidden outline-none rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f131b] text-slate-800 dark:text-slate-100 shadow-2xl shadow-slate-900/20 dark:shadow-black/60"
        style={{ maxWidth: width }}
        onPaste={onPaste}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function PaletteFooter({ hints, right }: { hints: [React.ReactNode, string][]; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 h-9 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-white/[0.02] text-[11px] text-slate-500 dark:text-slate-400 shrink-0 select-none">
      <div className="flex items-center gap-3 min-w-0 overflow-hidden">
        {hints.map(([keys, label]) => (
          <span key={label} className="flex items-center gap-1.5 whitespace-nowrap">
            {keys}
            <span>{label}</span>
          </span>
        ))}
      </div>
      {right && <span className="shrink-0 tabular-nums">{right}</span>}
    </div>
  );
}

function SectionLabel({ icon, children, right }: { icon?: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {icon}
        {children}
      </span>
      {right}
    </div>
  );
}

const GHOST_BUTTON =
  "inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[12px] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none";
const ICON_BUTTON =
  "h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer";
const INPUT =
  "h-8 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/60 px-2.5 text-[13px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors";

/** Status select for the detail popup. */
function StatusSelect({ value, onChange }: { value: string; onChange: (v: todo.TodoStatus) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const active = STATUS_OPTIONS.find((o) => o.value === value) || STATUS_OPTIONS[0];
  const ActiveIcon = active.icon;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[12px] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
      >
        <ActiveIcon size={13} className={active.color} />
        {active.label}
        <ChevronDown size={12} className="text-slate-400" />
      </button>
      {open && (
        <div role="listbox" className={cn(MENU_CLASS, "absolute right-0 top-full mt-1 z-10 w-44")}>
          {STATUS_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={opt.value === value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 h-8 text-[12px] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                <Icon size={13} className={opt.color} />
                <span className="flex-1 text-left">{opt.label}</span>
                {opt.value === value && <Check size={13} className="text-blue-500" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Label input with suggestions for the common labels. */
function LabelInput({ tags, onAdd }: { tags: string[]; onAdd: (tag: string) => void }) {
  const [val, setVal] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const add = (raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/^#/, "");
    if (tag && !tags.includes(tag)) onAdd(tag);
    setVal("");
  };

  const suggestions = PREDEFINED_TAGS.filter((t) => !tags.includes(t) && t.includes(val.toLowerCase().trim()));

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative flex items-center w-36">
        <Hash size={11} className="absolute left-2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Add label"
          value={val}
          onChange={(e) => {
            setVal(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(val);
            } else if (e.key === "Escape" && (val || open)) {
              e.stopPropagation();
              setVal("");
              setOpen(false);
            }
          }}
          className="h-7 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/60 pl-6 pr-2 text-[12px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
      </div>
      {open && suggestions.length > 0 && (
        <div className={cn(MENU_CLASS, "absolute left-0 bottom-full mb-1 z-10 w-40")}>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(s)}
              className="w-full flex items-center gap-2 px-3 h-8 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              <span className={cn("inline-flex items-center h-5 px-1.5 rounded-md border text-[11px] font-medium", getTagColorClass(s))}>
                {s}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

type TaskKey = { id: string; nodePath: string };

export default function ProductivityLayer() {
  const parsedData = useStore((s) => s.parsedData);
  const activeExplorerFile = useStore((s) => s.activeExplorerFile);
  const openWorkspaceTab = useStore((state) => state.openWorkspaceTab);
  const setExpandedJsNodeId = useStore((state) => state.setExpandedJsNodeId);

  const notify = (message: string, type: "success" | "info" | "error" = "success") =>
    useStore.getState().setNotification?.({ message, type });

  // Which overlay is open
  const [isTodoOpen, setIsTodoOpen] = useState(false);
  const [isFileOpen, setIsFileOpen] = useState(false);
  const wasTodoOpenRef = useRef(false);

  // Search and keyboard selection
  const [todoSearch, setTodoSearch] = useState("");
  const [fileSearch, setFileSearch] = useState("");
  const [selectedTodoIdx, setSelectedTodoIdx] = useState(0);
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);

  // Todo center
  const [selectedListPath, setSelectedListPath] = useState(""); // "" = all lists
  const [defaultListPath, setDefaultListPathState] = useState<string | null>(readDefaultList);
  const [todoViewMode, setTodoViewMode] = useState<"flat" | "tree">(() =>
    readLocal("productivity_todo_view", "tree"),
  );
  const [showDone, setShowDone] = useState(true);
  const [isListMenuOpen, setIsListMenuOpen] = useState(false);
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newTodoText, setNewTodoText] = useState("");
  const [inlineSubParentId, setInlineSubParentId] = useState<string | null>(null);
  const [inlineSubText, setInlineSubText] = useState("");
  const listMenuRef = useRef<HTMLDivElement>(null);

  // Task detail popup: only the task's identity is kept; its content is read live
  // from the document, so edits from the node or the workspace show up here too.
  const [activeTaskKey, setActiveTaskKey] = useState<TaskKey | null>(null);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [detailSubText, setDetailSubText] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<
    { kind: "deleteTask"; task: FlatTodoItem } | { kind: "clearMedia" } | null
  >(null);

  // Files: pinned and recently opened, kept in localStorage
  const [recentFiles, setRecentFiles] = useState<string[]>(() => readLocal("productivity_recent_files", []));
  const [pinnedFiles, setPinnedFiles] = useState<string[]>(() => readLocal("productivity_pinned_files", []));

  const setDefaultListPath = (path: string | null) => {
    setDefaultListPathState(path);
    writeLocal("productivity_default_todo_node", path);
  };

  useEffect(() => writeLocal("productivity_todo_view", todoViewMode), [todoViewMode]);

  // Get the YAML serializer ready so the first edit saves immediately.
  useEffect(() => {
    if (isTodoOpen) void prepareTodoSerializer();
  }, [isTodoOpen]);

  const allWorkspaceFiles = useMemo(() => getAllFiles(parsedData), [parsedData]);
  const todoLists = useMemo(() => findTodoLists(parsedData), [parsedData]);
  const allWorkspaceTodos = useMemo(() => scanAllTodos(parsedData), [parsedData]);

  const listStats = useMemo(() => {
    const stats = new Map<string, { total: number; completed: number }>();
    for (const l of todoLists) stats.set(l.path, todo.countTasks(l.list.tasks));
    return stats;
  }, [todoLists]);

  const listName = (path: string) => todoLists.find((l) => l.path === path)?.name || "Tasks";

  // Where "Add a task" puts new tasks.
  const addTargetPath =
    selectedListPath ||
    (defaultListPath && todoLists.some((l) => l.path === defaultListPath) ? defaultListPath : "") ||
    todoLists[0]?.path ||
    "";

  const activeTodo = useMemo(
    () =>
      activeTaskKey
        ? allWorkspaceTodos.find((t) => t.id === activeTaskKey.id && t.nodePath === activeTaskKey.nodePath) || null
        : null,
    [activeTaskKey, allWorkspaceTodos],
  );

  // The open task was deleted (here or elsewhere): close its popup.
  useEffect(() => {
    if (activeTaskKey && !activeTodo) setActiveTaskKey(null);
  }, [activeTaskKey, activeTodo]);

  useEffect(() => {
    setIsEditingNotes(false);
    setDetailSubText("");
  }, [activeTaskKey?.id]);

  // Remember opened files, most recent first.
  useEffect(() => {
    if (activeExplorerFile && allWorkspaceFiles.some((f) => f.id === activeExplorerFile)) {
      setRecentFiles((prev) => {
        const next = [activeExplorerFile, ...prev.filter((p) => p !== activeExplorerFile)].slice(0, 50);
        writeLocal("productivity_recent_files", next);
        return next;
      });
    }
  }, [activeExplorerFile, allWorkspaceFiles]);

  // Global shortcuts: Alt+T (or Ctrl+Shift+T) for tasks, Ctrl+` for files.
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      const isTodoHotkey =
        (e.altKey && e.key.toLowerCase() === "t") ||
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "t");
      if (isTodoHotkey) {
        e.preventDefault();
        e.stopPropagation();
        setIsTodoOpen((prev) => !prev);
        setIsFileOpen(false);
        setTodoSearch("");
        setSelectedTodoIdx(0);
        return;
      }

      const isFileHotkey = (e.key === "`" || e.code === "Backquote") && e.ctrlKey;
      if (isFileHotkey) {
        e.preventDefault();
        e.stopPropagation();
        setIsFileOpen((prev) => !prev);
        setIsTodoOpen(false);
        setFileSearch("");
        setSelectedFileIdx(0);
      }
    };
    window.addEventListener("keydown", handleGlobalShortcuts, true);
    return () => window.removeEventListener("keydown", handleGlobalShortcuts, true);
  }, []);

  // On opening the task center: show the default list, the only list, or all lists.
  useEffect(() => {
    if (isTodoOpen && !wasTodoOpenRef.current) {
      const hasDefault = defaultListPath && todoLists.some((l) => l.path === defaultListPath);
      setSelectedListPath(hasDefault ? defaultListPath! : todoLists.length === 1 ? todoLists[0].path : "");
      setIsListMenuOpen(false);
      setIsCreatingList(false);
      setInlineSubParentId(null);
    }
    wasTodoOpenRef.current = isTodoOpen;
  }, [isTodoOpen, todoLists, defaultListPath]);

  // Close the list menu on outside click.
  useEffect(() => {
    if (!isListMenuOpen) return;
    const handle = (e: MouseEvent) => {
      if (listMenuRef.current && !listMenuRef.current.contains(e.target as Node)) {
        setIsListMenuOpen(false);
        setIsCreatingList(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [isListMenuOpen]);

  // Esc closes the task popup (its footer says so). Nested dialogs close first.
  useEffect(() => {
    if (!activeTaskKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || pendingConfirm || isCameraOpen) return;
      e.preventDefault();
      e.stopPropagation();
      setActiveTaskKey(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTaskKey, pendingConfirm, isCameraOpen]);

  // ─── Files: filtering ────────────────────────────────────────────────────────

  const filteredFiles = useMemo(() => {
    const list = allWorkspaceFiles.filter((f) => f.type !== "folder"); // only openable files
    if (!fileSearch.trim()) {
      // Pinned first, then most recently opened, then by name.
      return [...list].sort((a, b) => {
        const aPinned = pinnedFiles.includes(a.id);
        const bPinned = pinnedFiles.includes(b.id);
        if (aPinned !== bPinned) return aPinned ? -1 : 1;
        const aRecent = recentFiles.indexOf(a.id);
        const bRecent = recentFiles.indexOf(b.id);
        if (aRecent !== -1 && bRecent === -1) return -1;
        if (aRecent === -1 && bRecent !== -1) return 1;
        if (aRecent !== -1 && bRecent !== -1) return aRecent - bRecent;
        return a.name.localeCompare(b.name);
      });
    }

    return list
      .map((f) => {
        let isGlobMatch = false;
        if (fileSearch.includes("*") || fileSearch.includes("?")) {
          try {
            const escapeRegex = (s: string) => s.replace(/[-[\]{}()+.,\\^$|#\s]/g, "\\$&");
            const regexStr = "^" + escapeRegex(fileSearch).replace(/\\\*/g, ".*").replace(/\\\?/g, ".") + "$";
            const regex = new RegExp(regexStr, "i");
            isGlobMatch = regex.test(f.name) || regex.test(f.pathStr) || regex.test("/" + f.pathStr);
          } catch {
            /* not a valid pattern; fuzzy match only */
          }
        }
        let score = Math.max(scoreFuzzy(f.name, fileSearch), scoreFuzzy(f.pathStr, fileSearch));
        if (isGlobMatch) score = score > 0 ? score + 500 : 500;
        return { file: f, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.file);
  }, [allWorkspaceFiles, fileSearch, pinnedFiles, recentFiles]);

  // ─── Tasks: filtering ────────────────────────────────────────────────────────

  const isSearching = !!todoSearch.trim();

  const filteredTodos = useMemo(() => {
    let scope = selectedListPath
      ? allWorkspaceTodos.filter((t) => t.nodePath === selectedListPath)
      : allWorkspaceTodos;
    if (!showDone) scope = scope.filter((t) => !todo.isTaskDone(t));

    if (!isSearching) return scope;

    const q = todoSearch.toLowerCase().trim();
    return scope
      .map((t) => {
        const score = Math.max(
          scoreFuzzy(t.text || "", q),
          scoreFuzzy(t.notes || "", q),
          scoreFuzzy(t.nodeName || "", q),
          scoreFuzzy(t.status || "", q),
          scoreFuzzy(t.priority || "", q),
          (t.tags || []).some((tag) => scoreFuzzy(tag, q) > 0) ? 50 : 0,
        );
        return { item: t, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.item);
  }, [allWorkspaceTodos, todoSearch, isSearching, selectedListPath, showDone]);

  // Keep the keyboard selection in range.
  useEffect(() => {
    if (selectedTodoIdx >= filteredTodos.length) setSelectedTodoIdx(Math.max(0, filteredTodos.length - 1));
  }, [filteredTodos.length, selectedTodoIdx]);

  useEffect(() => {
    if (selectedFileIdx >= filteredFiles.length) setSelectedFileIdx(Math.max(0, filteredFiles.length - 1));
  }, [filteredFiles.length, selectedFileIdx]);

  // ─── Task actions (all through the shared todo store) ────────────────────────

  const updateTask = (task: TaskKey, patch: Partial<TodoTask>) =>
    writeTasks(task.nodePath, (tasks) => todo.editTask(tasks, task.id, patch));

  const toggleDone = (task: FlatTodoItem) => {
    const done = todo.isTaskDone(task);
    if (!done && todo.hasIncompleteChildren(task.tasks)) {
      notify("Complete its subtasks first", "info");
      return;
    }
    updateTask(task, { completed: !done });
  };

  const deleteTaskNow = (task: FlatTodoItem) => {
    writeTasks(task.nodePath, (tasks) => todo.removeTask(tasks, task.id));
    notify(`Deleted "${task.text || "Untitled task"}"`);
  };

  // A task with subtasks takes them with it, so that asks first.
  const requestDeleteTask = (task: FlatTodoItem) => {
    if (task.tasks?.length) setPendingConfirm({ kind: "deleteTask", task });
    else deleteTaskNow(task);
  };

  const addTask = (text: string, nodePath: string, parentId?: string) => {
    if (!text.trim() || !nodePath) return;
    writeTasks(nodePath, (tasks) => todo.addTask(tasks, todo.createTask(text), parentId));
  };

  const handleCreateList = async () => {
    const name = newListName.trim();
    const path = await createTodoList(name);
    if (!path) return;
    setSelectedListPath(path);
    setNewListName("");
    setIsCreatingList(false);
    setIsListMenuOpen(false);
    notify(`Created list "${name}"`);
  };

  const openTaskInWorkspace = (nodePath: string) => {
    openWorkspaceTab(nodePath, true);
    setExpandedJsNodeId(nodePath);
    setIsTodoOpen(false);
    setActiveTaskKey(null);
  };

  const openFile = (file: FlatFileItem) => {
    openWorkspaceTab(file.id, false);
    setExpandedJsNodeId(file.id);
    setIsFileOpen(false);
  };

  const togglePin = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setPinnedFiles((prev) => {
      const next = prev.includes(fileId) ? prev.filter((p) => p !== fileId) : [...prev, fileId];
      writeLocal("productivity_pinned_files", next);
      return next;
    });
  };

  // ─── Attachments ─────────────────────────────────────────────────────────────

  const handleMediaUpload = async (files: FileList | File[]) => {
    if (!activeTodo) return;
    const target: TaskKey = { id: activeTodo.id, nodePath: activeTodo.nodePath };
    setIsUploading(true);
    try {
      const added: string[] = [];
      for (const file of Array.from(files)) {
        if (/^(image|video|audio)\//.test(file.type)) {
          const { assetId } = await importFile(file);
          added.push(assetId);
        }
      }
      if (added.length) {
        // Merge into the latest list of attachments, not the one from before the upload.
        writeTasks(target.nodePath, (tasks) => {
          const current = todo.findTask(tasks, target.id);
          if (!current) return null;
          const hashes = [...(current.imageHashes || [])];
          for (const id of added) if (!hashes.includes(id)) hashes.push(id);
          return todo.updateTask(tasks, target.id, { imageHashes: hashes });
        });
      }
    } catch (err) {
      console.error("Upload failed", err);
      notify("Couldn't attach that file", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const pickMedia = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = MEDIA_ACCEPT;
    input.onchange = (e: any) => {
      if (e.target.files) handleMediaUpload(e.target.files);
    };
    input.click();
  };

  const handleDeleteMedia = (index: number) => {
    if (!activeTodo?.imageHashes) return;
    const hashes = activeTodo.imageHashes.filter((_, i) => i !== index);
    updateTask(activeTodo, { imageHashes: hashes });
  };

  const handlePreviewMedia = (index: number) => {
    const hash = activeTodo?.imageHashes?.[index];
    if (!hash) return;
    const lower = hash.toLowerCase();
    let type: "image" | "video" | "audio" | "smart" = "smart";
    if (/\.(mp4|mov|webm)$/.test(lower)) type = "video";
    else if (/\.(mp3|wav|ogg)$/.test(lower)) type = "audio";
    else if (/\.(jpg|jpeg|png|gif|webp|svg)$/.test(lower) || hash.startsWith("img_")) type = "image";
    useStore.getState().setActivePreviewMedia({ url: hash, type });
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (!activeTodo) return;
    const files = Array.from(e.clipboardData?.items || [])
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((f): f is File => !!f);
    if (files.length) {
      e.preventDefault();
      handleMediaUpload(files);
    }
  };

  // ─── Keyboard navigation ─────────────────────────────────────────────────────

  const handleFileKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.ctrlKey || e.metaKey) && /^[zy]$/i.test(e.key)) e.stopPropagation(); // keep undo local
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedFileIdx((prev) => (prev + 1) % Math.max(1, filteredFiles.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedFileIdx((prev) => (prev - 1 + filteredFiles.length) % Math.max(1, filteredFiles.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filteredFiles[selectedFileIdx];
      if (target) openFile(target);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsFileOpen(false);
    }
  };

  const handleTodoKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.ctrlKey || e.metaKey) && /^[zy]$/i.test(e.key)) e.stopPropagation(); // keep undo local
    const n = Math.max(1, filteredTodos.length);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedTodoIdx((prev) => (prev + 1) % n);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedTodoIdx((prev) => (prev - 1 + n) % n);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filteredTodos[selectedTodoIdx];
      if (!target) return;
      if (e.ctrlKey || e.metaKey) toggleDone(target);
      else setActiveTaskKey({ id: target.id, nodePath: target.nodePath });
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (isListMenuOpen) setIsListMenuOpen(false);
      else if (todoSearch) setTodoSearch("");
      else setIsTodoOpen(false);
    }
  };

  // Keep the keyboard selection scrolled into view.
  const todoListEl = useRef<HTMLDivElement>(null);
  const todoSearchRef = useRef<HTMLInputElement>(null);
  const hadDetailRef = useRef(false);
  useEffect(() => {
    if (hadDetailRef.current && !activeTaskKey && isTodoOpen) todoSearchRef.current?.focus();
    hadDetailRef.current = !!activeTaskKey;
  }, [activeTaskKey, isTodoOpen]);
  useEffect(() => {
    todoListEl.current?.querySelector(".is-selected-todo")?.scrollIntoView({ block: "nearest" });
  }, [selectedTodoIdx]);

  const fileListEl = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fileListEl.current?.querySelector(".is-selected-file")?.scrollIntoView({ block: "nearest" });
  }, [selectedFileIdx]);

  // ─── Render: file palette ────────────────────────────────────────────────────

  const renderFilePalette = () => (
    <PaletteShell key="file-palette" label="Open file" width={640} zIndex={11000} onClose={() => setIsFileOpen(false)}>
      <div className="flex items-center gap-2.5 px-4 h-12 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
        <Search size={16} className="text-slate-400 shrink-0" />
        <input
          autoFocus
          type="text"
          value={fileSearch}
          onChange={(e) => {
            setFileSearch(e.target.value.replace(/^~/, ""));
            setSelectedFileIdx(0);
          }}
          onKeyDown={handleFileKeyDown}
          placeholder="Search files by name or path (* and ? work too)"
          aria-label="Search files"
          className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
        />
        <span className="hidden sm:flex items-center gap-1">
          <Kbd>Ctrl</Kbd>
          <Kbd>`</Kbd>
        </span>
      </div>

      <div ref={fileListEl} role="listbox" className="flex-1 overflow-y-auto py-1.5 min-h-[120px]">
        {filteredFiles.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-2 text-center text-slate-500 dark:text-slate-400">
            <FolderOpen size={22} className="text-slate-300 dark:text-slate-600" />
            <span className="text-[13px]">No files match "{fileSearch}"</span>
          </div>
        ) : (
          <>
            {!fileSearch.trim() && (
              <div className="px-4 pt-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Pinned and recent
              </div>
            )}
            {filteredFiles.map((file, idx) => {
              const isSelected = idx === selectedFileIdx;
              const isOpen = activeExplorerFile === file.id;
              const isPinned = pinnedFiles.includes(file.id);
              return (
                <div
                  key={`${file.id}-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    "is-selected-file group relative flex items-center gap-3 mx-1.5 px-2.5 h-10 rounded-lg cursor-pointer",
                    isSelected ? "is-selected-file bg-slate-100 dark:bg-white/[0.06]" : "hover:bg-slate-50 dark:hover:bg-white/[0.03]",
                  )}
                  onMouseMove={() => selectedFileIdx !== idx && setSelectedFileIdx(idx)}
                  onClick={() => openFile(file)}
                >
                  {isSelected && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-blue-500" />}
                  <span className="shrink-0">{renderOverlayFileIcon(file.type, file.name)}</span>
                  <div className="min-w-0 flex-1 flex items-baseline gap-2">
                    <span className="text-[13px] font-medium truncate text-slate-800 dark:text-slate-100">{file.name}</span>
                    <span className="text-[11px] truncate text-slate-400 dark:text-slate-500">{file.pathStr}</span>
                  </div>
                  {isOpen && (
                    <span className="shrink-0 h-5 px-1.5 inline-flex items-center rounded-md text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      Open
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => togglePin(file.id, e)}
                    title={isPinned ? "Unpin" : "Pin to top"}
                    className={cn(
                      "shrink-0 h-6 w-6 inline-flex items-center justify-center rounded-md transition-opacity hover:bg-slate-200/70 dark:hover:bg-white/10",
                      isPinned ? "text-amber-500 opacity-100" : "text-slate-400 opacity-0 group-hover:opacity-100",
                    )}
                  >
                    <Pin size={12} className={isPinned ? "fill-current" : ""} />
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>

      <PaletteFooter
        hints={[
          [<><Kbd>↑</Kbd><Kbd>↓</Kbd></>, "Navigate"],
          [<Kbd>↵</Kbd>, "Open"],
          [<Kbd>Esc</Kbd>, "Close"],
        ]}
        right={`${filteredFiles.length} ${filteredFiles.length === 1 ? "file" : "files"}`}
      />
    </PaletteShell>
  );

  // ─── Render: task center ─────────────────────────────────────────────────────

  const renderListMenu = () => (
    <div ref={listMenuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsListMenuOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={isListMenuOpen}
        className="inline-flex items-center gap-1.5 h-7 max-w-[200px] pl-2 pr-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-[12px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
      >
        {selectedListPath ? <ClipboardList size={13} className="text-blue-500 shrink-0" /> : <Layers size={13} className="text-slate-400 shrink-0" />}
        <span className="truncate">{selectedListPath ? listName(selectedListPath) : "All lists"}</span>
        <ChevronDown size={12} className="text-slate-400 shrink-0" />
      </button>

      {isListMenuOpen && (
        <div className={cn(MENU_CLASS, "absolute right-0 top-full mt-1 z-20 w-64")} role="menu">
          <button
            type="button"
            onClick={() => {
              setSelectedListPath("");
              setIsListMenuOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 h-9 text-[12px] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <Layers size={14} className="text-slate-400" />
            <span className="flex-1 text-left">All lists</span>
            <span className="tabular-nums text-[11px] text-slate-400">{allWorkspaceTodos.length}</span>
            {!selectedListPath && <Check size={13} className="text-blue-500" />}
          </button>
          <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
          {todoLists.map((l) => {
            const stats = listStats.get(l.path) || { total: 0, completed: 0 };
            const isDefault = l.path === defaultListPath;
            return (
              <div
                key={l.path}
                className="group flex items-center gap-2.5 px-3 h-9 text-[12px] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
                onClick={() => {
                  setSelectedListPath(l.path);
                  setIsListMenuOpen(false);
                }}
              >
                <ClipboardList size={14} className="text-slate-400 shrink-0" />
                <span className="flex-1 truncate">{l.name}</span>
                <span className="tabular-nums text-[11px] text-slate-400">
                  {stats.completed}/{stats.total}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDefaultListPath(isDefault ? null : l.path);
                  }}
                  title={isDefault ? "Default list (opens first) — click to unset" : "Open this list first with Alt+T"}
                  className={cn(
                    "h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-slate-200/70 dark:hover:bg-white/10",
                    isDefault ? "text-amber-500" : "text-slate-400 opacity-0 group-hover:opacity-100",
                  )}
                >
                  <Star size={12} className={isDefault ? "fill-current" : ""} />
                </button>
                {selectedListPath === l.path && <Check size={13} className="text-blue-500" />}
              </div>
            );
          })}
          <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
          {isCreatingList ? (
            <div className="px-2 py-1.5 flex items-center gap-1.5">
              <input
                autoFocus
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateList();
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setIsCreatingList(false);
                  }
                }}
                placeholder="List name, e.g. Work"
                maxLength={todo.MAX_LIST_TITLE}
                className={cn(INPUT, "h-7 text-[12px]")}
              />
              <button
                type="button"
                onClick={handleCreateList}
                disabled={!newListName.trim()}
                className="h-7 px-2.5 shrink-0 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium disabled:opacity-40"
              >
                Create
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsCreatingList(true)}
              className="w-full flex items-center gap-2.5 px-3 h-9 text-[12px] text-blue-600 dark:text-blue-400 hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <Plus size={14} />
              New list…
            </button>
          )}
        </div>
      )}
    </div>
  );

  const renderTaskRow = (item: FlatTodoItem, idx: number) => {
    const isSelected = idx === selectedTodoIdx;
    const done = todo.isTaskDone(item);
    const blocked = !done && todo.hasIncompleteChildren(item.tasks);
    const priority = todo.priorityOf(item);
    const subtasks = item.tasks?.length ? todo.countTasks(item.tasks) : null;
    const indent = todoViewMode === "tree" && !isSearching ? item.depth * 18 : 0;
    const overdue = isOverdue(item);
    const showListName = !selectedListPath && todoLists.length > 1;

    return (
      <React.Fragment key={`${item.nodePath}-${item.id}`}>
        <div
          role="option"
          aria-selected={isSelected}
          className={cn(
            "group relative flex items-start gap-2.5 mx-1.5 pr-2 py-2 rounded-lg cursor-pointer",
            isSelected ? "is-selected-todo bg-slate-100 dark:bg-white/[0.06]" : "hover:bg-slate-50 dark:hover:bg-white/[0.03]",
          )}
          style={{ paddingLeft: 10 + indent }}
          onMouseMove={() => selectedTodoIdx !== idx && setSelectedTodoIdx(idx)}
          onClick={() => setActiveTaskKey({ id: item.id, nodePath: item.nodePath })}
        >
          {isSelected && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-blue-500" />}
          <TaskCheckbox
            done={done}
            blocked={blocked}
            onToggle={() => toggleDone(item)}
            onBlocked={() => notify("Complete its subtasks first", "info")}
            className="mt-0.5"
          />
          <div className="flex-1 min-w-0">
            <div
              className={cn(
                "text-[13px] leading-5 truncate",
                done ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-800 dark:text-slate-100",
              )}
            >
              {item.text || <span className="italic text-slate-400">Untitled task</span>}
            </div>
            {(showListName || priority !== todo.DEFAULT_PRIORITY || item.dueDate || subtasks || item.notes || item.imageHashes?.length || item.tags?.length) && (
              <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px] text-slate-500 dark:text-slate-400">
                {showListName && (
                  <span className="inline-flex items-center gap-1">
                    <ClipboardList size={11} />
                    {item.nodeName}
                  </span>
                )}
                {!done && priority !== todo.DEFAULT_PRIORITY && <PriorityBadge priority={priority} />}
                {item.dueDate && (
                  <span className={cn("inline-flex items-center gap-1", overdue && "text-red-500 font-medium")}>
                    <CalendarIcon size={11} />
                    {overdue ? `Overdue · ${formatDue(item.dueDate)}` : formatDue(item.dueDate)}
                  </span>
                )}
                {subtasks && (
                  <span className="inline-flex items-center gap-1 tabular-nums" title="Subtasks done">
                    <ListTree size={11} />
                    {subtasks.completed}/{subtasks.total}
                  </span>
                )}
                {item.notes && <AlignLeft size={11} aria-label="Has notes" />}
                {!!item.imageHashes?.length && (
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Paperclip size={11} />
                    {item.imageHashes.length}
                  </span>
                )}
                {(item.tags || []).slice(0, 3).map((tag) => (
                  <span key={tag} className={cn("inline-flex items-center h-4 px-1 rounded border text-[10px] font-medium", getTagColorClass(tag))}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div
            className={cn(
              "flex items-center gap-0.5 shrink-0 transition-opacity",
              isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100",
            )}
          >
            <button
              type="button"
              title="Add subtask"
              onClick={(e) => {
                e.stopPropagation();
                setInlineSubText("");
                setInlineSubParentId(inlineSubParentId === item.id ? null : item.id);
              }}
              className={ICON_BUTTON}
            >
              <Plus size={14} />
            </button>
            <button
              type="button"
              title="Delete task"
              onClick={(e) => {
                e.stopPropagation();
                requestDeleteTask(item);
              }}
              className={cn(ICON_BUTTON, "hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-500/10")}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {inlineSubParentId === item.id && (
          <div className="mx-1.5 mb-1 flex items-center gap-2" style={{ paddingLeft: 10 + indent + 26 }}>
            <CornerDownLeft size={13} className="text-slate-400 -scale-x-100 shrink-0" />
            <input
              autoFocus
              value={inlineSubText}
              maxLength={todo.MAX_TASK_TEXT}
              onChange={(e) => setInlineSubText(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter" && inlineSubText.trim()) {
                  addTask(inlineSubText, item.nodePath, item.id);
                  setInlineSubText("");
                  setInlineSubParentId(null);
                } else if (e.key === "Escape") {
                  setInlineSubParentId(null);
                }
              }}
              onBlur={() => !inlineSubText.trim() && setInlineSubParentId(null)}
              placeholder={`Subtask of "${item.text || "Untitled task"}" — Enter to add`}
              className={cn(INPUT, "h-7 text-[12px]")}
            />
          </div>
        )}
      </React.Fragment>
    );
  };

  const renderTodoCenter = () => (
    <PaletteShell key="todo-center" label="Tasks" width={680} zIndex={11000} onClose={() => setIsTodoOpen(false)}>
      <div className="flex items-center gap-2.5 pl-4 pr-2.5 h-12 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
        <Search size={16} className="text-slate-400 shrink-0" />
        <input
          autoFocus
          type="text"
          ref={todoSearchRef}
          value={todoSearch}
          onChange={(e) => {
            setTodoSearch(e.target.value);
            setSelectedTodoIdx(0);
          }}
          onKeyDown={handleTodoKeyDown}
          placeholder="Search tasks, notes, labels, status or priority"
          aria-label="Search tasks"
          className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
        />
        {todoLists.length > 0 && renderListMenu()}
      </div>

      {todoLists.length > 0 && (
        <div className="flex items-center justify-between gap-2 px-3 h-9 border-b border-slate-200/80 dark:border-slate-800 shrink-0 text-[12px]">
          <span className="text-slate-500 dark:text-slate-400 tabular-nums truncate">
            {isSearching
              ? `${filteredTodos.length} ${filteredTodos.length === 1 ? "match" : "matches"}`
              : (() => {
                  const scope = selectedListPath
                    ? listStats.get(selectedListPath) || { total: 0, completed: 0 }
                    : todoLists.reduce(
                        (acc, l) => {
                          const s = listStats.get(l.path);
                          return { total: acc.total + (s?.total || 0), completed: acc.completed + (s?.completed || 0) };
                        },
                        { total: 0, completed: 0 },
                      );
                  return scope.total === 0 ? "No tasks yet" : `${scope.completed} of ${scope.total} done`;
                })()}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              aria-pressed={!showDone}
              className={cn(GHOST_BUTTON, "h-6 text-[11px]", !showDone && "bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white")}
              title={showDone ? "Hide finished tasks" : "Show finished tasks"}
            >
              <CheckCircle2 size={12} />
              {showDone ? "Hide done" : "Showing open only"}
            </button>
            <div className="flex items-center p-0.5 rounded-md bg-slate-100 dark:bg-white/5" role="group" aria-label="View">
              {(
                [
                  ["tree", ListTree, "Tree view"],
                  ["flat", List, "Flat list"],
                ] as const
              ).map(([mode, Icon, label]) => (
                <button
                  key={mode}
                  type="button"
                  title={label}
                  aria-pressed={todoViewMode === mode}
                  onClick={() => setTodoViewMode(mode)}
                  className={cn(
                    "h-5 w-6 inline-flex items-center justify-center rounded-[5px] transition-colors",
                    todoViewMode === mode
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200",
                  )}
                >
                  <Icon size={12} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div ref={todoListEl} role="listbox" aria-label="Tasks" className="flex-1 overflow-y-auto py-1.5 min-h-[160px]">
        {todoLists.length === 0 ? (
          <div className="py-10 px-6 flex flex-col items-center gap-3 text-center">
            <div className="w-11 h-11 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <ClipboardList size={20} />
            </div>
            <div>
              <p className="text-[14px] font-medium text-slate-800 dark:text-slate-100">Create your first task list</p>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
                Lists are saved in your workspace and appear on the canvas as a Todo node.
              </p>
            </div>
            <div className="flex items-center gap-2 w-full max-w-xs">
              <input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateList()}
                placeholder="List name, e.g. Work"
                maxLength={todo.MAX_LIST_TITLE}
                className={INPUT}
              />
              <button
                type="button"
                onClick={handleCreateList}
                disabled={!newListName.trim()}
                className="h-8 px-3 shrink-0 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-medium disabled:opacity-40"
              >
                Create
              </button>
            </div>
          </div>
        ) : filteredTodos.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-2 text-center text-slate-500 dark:text-slate-400">
            <ClipboardList size={22} className="text-slate-300 dark:text-slate-600" />
            <span className="text-[13px]">
              {isSearching ? `No tasks match "${todoSearch}"` : showDone ? "No tasks yet — add one below" : "Everything here is done"}
            </span>
          </div>
        ) : (
          filteredTodos.map(renderTaskRow)
        )}
      </div>

      {todoLists.length > 0 && (
        <div className="flex items-center gap-2 px-3.5 h-11 border-t border-slate-200/80 dark:border-slate-800 shrink-0">
          <Plus size={15} className="text-slate-400 shrink-0" />
          <input
            value={newTodoText}
            maxLength={todo.MAX_TASK_TEXT}
            onChange={(e) => setNewTodoText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTodoText.trim()) {
                addTask(newTodoText, addTargetPath);
                setNewTodoText("");
              } else if (e.key === "Escape") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder={`Add a task to ${listName(addTargetPath)}…`}
            aria-label="New task"
            className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
          <LengthHint length={newTodoText.length} max={todo.MAX_TASK_TEXT} className="shrink-0" />
          {newTodoText.trim() ? (
            <button
              type="button"
              onClick={() => {
                addTask(newTodoText, addTargetPath);
                setNewTodoText("");
              }}
              className="h-6 px-2.5 shrink-0 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium"
            >
              Add
            </button>
          ) : (
            <Kbd>↵</Kbd>
          )}
        </div>
      )}

      <PaletteFooter
        hints={[
          [<><Kbd>↑</Kbd><Kbd>↓</Kbd></>, "Navigate"],
          [<Kbd>↵</Kbd>, "Open"],
          [<><Kbd>Ctrl</Kbd><Kbd>↵</Kbd></>, "Toggle done"],
          [<Kbd>Esc</Kbd>, "Close"],
        ]}
        right={<span className="flex items-center gap-1"><Kbd>Alt</Kbd><Kbd>T</Kbd></span>}
      />
    </PaletteShell>
  );

  // ─── Render: task detail ─────────────────────────────────────────────────────

  const renderTaskDetail = (task: FlatTodoItem) => {
    const done = todo.isTaskDone(task);
    const blocked = !done && todo.hasIncompleteChildren(task.tasks);
    const subtasks = task.tasks || [];
    const media = task.imageHashes || [];

    return (
      <PaletteShell
        key="todo-detail"
        label="Task details"
        width={600}
        zIndex={11500}
        onClose={() => setActiveTaskKey(null)}
        onPaste={handlePaste}
        takeFocus
      >
        <div className="flex items-center justify-between gap-3 pl-4 pr-2 h-11 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0 text-[12px] text-slate-500 dark:text-slate-400">
            <ClipboardList size={13} className="shrink-0" />
            <span className="truncate">{task.nodeName}</span>
            {task.parentTaskId && (
              <>
                <span className="text-slate-300 dark:text-slate-600">/</span>
                <span className="truncate">
                  {allWorkspaceTodos.find((t) => t.id === task.parentTaskId && t.nodePath === task.nodePath)?.text || "Parent task"}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button type="button" onClick={() => openTaskInWorkspace(task.nodePath)} className={ICON_BUTTON} title="Open list in workspace">
              <ExternalLink size={14} />
            </button>
            <button
              type="button"
              onClick={() => requestDeleteTask(task)}
              className={cn(ICON_BUTTON, "hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-500/10")}
              title="Delete task"
            >
              <Trash2 size={14} />
            </button>
            <div className="w-px h-4 mx-1 bg-slate-200 dark:bg-slate-800" />
            <button type="button" onClick={() => setActiveTaskKey(null)} className={ICON_BUTTON} title="Close (Esc)">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
          {/* Title */}
          <div className="flex items-start gap-3">
            <TaskCheckbox
              done={done}
              blocked={blocked}
              size="lg"
              onToggle={() => toggleDone(task)}
              onBlocked={() => notify("Complete its subtasks first", "info")}
              className="mt-1"
            />
            <div className="flex-1 min-w-0 relative">
              <textarea
                rows={1}
                maxLength={todo.MAX_TASK_TEXT}
                value={task.text || ""}
                onChange={(e) => updateTask(task, { text: e.target.value })}
                ref={(el) => {
                  if (el) {
                    el.style.height = "auto";
                    el.style.height = `${el.scrollHeight}px`;
                  }
                }}
                placeholder="Task name"
                aria-label="Task name"
                className={cn(
                  "w-full resize-none overflow-hidden bg-transparent outline-none text-[18px] font-semibold leading-snug placeholder:text-slate-300 dark:placeholder:text-slate-600 rounded-md -mx-1 px-1 focus:bg-slate-50 dark:focus:bg-white/[0.03]",
                  done ? "text-slate-400 dark:text-slate-500 line-through" : "text-slate-900 dark:text-white",
                )}
              />
              <LengthHint length={(task.text || "").length} max={todo.MAX_TASK_TEXT} className="absolute right-1 -bottom-3.5" />
            </div>
          </div>

          {/* Properties */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800">
            <div className="flex items-center justify-between gap-3 pl-3 pr-1.5 min-h-10">
              <span className="text-[12px] text-slate-500 dark:text-slate-400">Status</span>
              <StatusSelect value={task.status || "Todo"} onChange={(status) => updateTask(task, { status })} />
            </div>
            <div className="flex items-center justify-between gap-3 pl-3 pr-1.5 py-2">
              <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0">Priority</span>
              <PriorityPicker value={todo.priorityOf(task)} onChange={(priority) => updateTask(task, { priority })} className="justify-end" />
            </div>
            <div className="flex items-center justify-between gap-3 pl-3 pr-1.5 min-h-10">
              <span className="text-[12px] text-slate-500 dark:text-slate-400">Due date</span>
              <div className="flex items-center gap-1">
                <SmartDatePicker
                  selected={task.dueDate ? parseISO(task.dueDate) : null}
                  onChange={(date: Date | null) =>
                    updateTask(task, { dueDate: date ? format(date, "yyyy-MM-dd") : undefined })
                  }
                >
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[12px] hover:bg-slate-100 dark:hover:bg-white/5 transition-colors",
                      task.dueDate
                        ? isOverdue(task)
                          ? "text-red-500 font-medium"
                          : "text-slate-700 dark:text-slate-200"
                        : "text-slate-400",
                    )}
                  >
                    <CalendarIcon size={13} />
                    {task.dueDate ? `${isOverdue(task) ? "Overdue · " : ""}${format(parseISO(task.dueDate), "EEE, MMM d, yyyy")}` : "Set a date"}
                  </button>
                </SmartDatePicker>
                {task.dueDate && (
                  <button
                    type="button"
                    onClick={() => updateTask(task, { dueDate: undefined })}
                    className={cn(ICON_BUTTON, "h-6 w-6")}
                    title="Clear due date"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Subtasks */}
          <section>
            <SectionLabel
              icon={<ListTree size={12} />}
              right={
                subtasks.length > 0 && (
                  <span className="text-[11px] tabular-nums text-slate-400">
                    {todo.countTasks(subtasks).completed}/{todo.countTasks(subtasks).total}
                  </span>
                )
              }
            >
              Subtasks
            </SectionLabel>
            <div className="flex flex-col">
              {subtasks.map((sub) => {
                const subDone = todo.isTaskDone(sub);
                return (
                  <div
                    key={sub.id}
                    className="group flex items-center gap-2.5 px-2 h-8 -mx-2 rounded-md hover:bg-slate-50 dark:hover:bg-white/[0.03] cursor-pointer"
                    onClick={() => setActiveTaskKey({ id: sub.id, nodePath: task.nodePath })}
                    title="Open subtask"
                  >
                    <TaskCheckbox
                      done={subDone}
                      blocked={!subDone && todo.hasIncompleteChildren(sub.tasks)}
                      size="sm"
                      onToggle={() => updateTask({ id: sub.id, nodePath: task.nodePath }, { completed: !subDone })}
                      onBlocked={() => notify("Complete its subtasks first", "info")}
                    />
                    <span className={cn("flex-1 truncate text-[13px]", subDone ? "line-through text-slate-400" : "text-slate-700 dark:text-slate-200")}>
                      {sub.text || "Untitled task"}
                    </span>
                    {!!sub.tasks?.length && (
                      <span className="text-[11px] tabular-nums text-slate-400">
                        {todo.countTasks(sub.tasks).completed}/{todo.countTasks(sub.tasks).total}
                      </span>
                    )}
                  </div>
                );
              })}
              <div className="flex items-center gap-2.5 px-2 h-8 -mx-2">
                <Plus size={13} className="text-slate-400 shrink-0 ml-0.5" />
                <input
                  value={detailSubText}
                  maxLength={todo.MAX_TASK_TEXT}
                  onChange={(e) => setDetailSubText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && detailSubText.trim()) {
                      addTask(detailSubText, task.nodePath, task.id);
                      setDetailSubText("");
                    }
                  }}
                  placeholder="Add a subtask"
                  aria-label="New subtask"
                  className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>
            </div>
          </section>

          {/* Notes */}
          <section>
            <SectionLabel
              icon={<AlignLeft size={12} />}
              right={
                <button type="button" onClick={() => setIsEditingNotes((v) => !v)} className={cn(GHOST_BUTTON, "h-6 text-[11px]")}>
                  {isEditingNotes ? <Eye size={12} /> : <Pencil size={12} />}
                  {isEditingNotes ? "Preview" : "Edit"}
                </button>
              }
            >
              Notes
            </SectionLabel>
            {isEditingNotes ? (
              <textarea
                rows={6}
                autoFocus
                value={task.notes || ""}
                onChange={(e) => updateTask(task, { notes: e.target.value })}
                placeholder="Details, links, checklists… Markdown is supported."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/60 p-3 text-[13px] leading-relaxed text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-y"
              />
            ) : task.notes ? (
              <div
                className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 cursor-text hover:border-slate-300 dark:hover:border-slate-700 transition-colors prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-a:text-blue-500"
                onClick={() => setIsEditingNotes(true)}
              >
                <Markdown>{task.notes}</Markdown>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingNotes(true)}
                className="w-full rounded-lg border border-dashed border-slate-200 dark:border-slate-700 px-3 py-4 text-[12px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 transition-colors text-left"
              >
                Add notes…
              </button>
            )}
          </section>

          {/* Labels */}
          <section>
            <SectionLabel icon={<Hash size={12} />}>Labels</SectionLabel>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(task.tags || []).map((tag) => (
                <span
                  key={tag}
                  className={cn("inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-md border text-[12px] font-medium", getTagColorClass(tag))}
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => updateTask(task, { tags: (task.tags || []).filter((t) => t !== tag) })}
                    className="h-4 w-4 inline-flex items-center justify-center rounded opacity-60 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"
                    title={`Remove ${tag}`}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
              <LabelInput tags={task.tags || []} onAdd={(tag) => updateTask(task, { tags: [...(task.tags || []), tag] })} />
            </div>
          </section>

          {/* Attachments */}
          <section>
            <SectionLabel
              icon={<Paperclip size={12} />}
              right={
                media.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPendingConfirm({ kind: "clearMedia" })}
                    className={cn(GHOST_BUTTON, "h-6 text-[11px] hover:text-rose-500 hover:bg-rose-500/10")}
                  >
                    <Trash2 size={12} />
                    Remove all
                  </button>
                )
              }
            >
              Attachments
            </SectionLabel>
            {media.length > 0 && (
              <TaskImagePreview imageHashes={media} compact={false} onDelete={handleDeleteMedia} onPreview={handlePreviewMedia} />
            )}
            <div
              className={cn(
                "flex items-center gap-2",
                media.length > 0 ? "mt-2" : "rounded-lg border border-dashed border-slate-200 dark:border-slate-700 px-3 py-3",
              )}
            >
              {media.length === 0 && (
                <span className="flex-1 flex items-center gap-2 text-[12px] text-slate-400">
                  <ImageIcon size={14} />
                  Images, video or audio — or paste one here
                </span>
              )}
              <button type="button" onClick={pickMedia} disabled={isUploading} className={cn(GHOST_BUTTON, "border border-slate-200 dark:border-slate-700")}>
                <Upload size={13} />
                {isUploading ? "Uploading…" : "Upload"}
              </button>
              <button type="button" onClick={() => setIsCameraOpen(true)} className={cn(GHOST_BUTTON, "border border-slate-200 dark:border-slate-700")}>
                <Camera size={13} />
                Camera
              </button>
            </div>
          </section>
        </div>

        <PaletteFooter
          hints={[[<Kbd>Esc</Kbd>, "Close"]]}
          right={<span className="text-slate-400">Changes save automatically</span>}
        />

        {isCameraOpen && (
          <CameraCaptureModal onClose={() => setIsCameraOpen(false)} onCapture={(file) => handleMediaUpload([file])} />
        )}
      </PaletteShell>
    );
  };

  const confirmDetails =
    pendingConfirm?.kind === "deleteTask"
      ? {
          title: "Delete this task?",
          message: `"${pendingConfirm.task.text || "Untitled task"}" and its ${todo.countTasks(pendingConfirm.task.tasks).total} subtask${
            todo.countTasks(pendingConfirm.task.tasks).total === 1 ? "" : "s"
          } will be deleted. This can't be undone.`,
          confirmText: "Delete",
          run: () => deleteTaskNow(pendingConfirm.task),
        }
      : pendingConfirm?.kind === "clearMedia"
        ? {
            title: "Remove all attachments?",
            message: "Every attachment on this task will be removed. This can't be undone.",
            confirmText: "Remove all",
            run: () => activeTodo && updateTask(activeTodo, { imageHashes: [] }),
          }
        : null;

  if (typeof window === "undefined") return null;

  return createPortal(
    <div className="font-sans">
      <AnimatePresence>
        {isFileOpen && renderFilePalette()}
        {isTodoOpen && renderTodoCenter()}
        {activeTodo && renderTaskDetail(activeTodo)}
      </AnimatePresence>
      {confirmDetails && (
        <ConfirmModal
          isOpen
          title={confirmDetails.title}
          message={confirmDetails.message}
          confirmText={confirmDetails.confirmText}
          variant="danger"
          onConfirm={confirmDetails.run}
          onClose={() => setPendingConfirm(null)}
        />
      )}
    </div>,
    document.body,
  );
}
