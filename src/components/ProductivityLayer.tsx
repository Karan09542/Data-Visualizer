import React, { useState, useRef, useEffect, useMemo, forwardRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  X,
  Circle,
  CheckCircle2,
  AlertCircle,
  Eye,
  Check,
  Hash,
  Command,
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
  Layers,
  ListTodo,
  ArrowLeft,
  CornerDownLeft,
  Edit2,
  ExternalLink
} from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import Markdown from "react-markdown";
import DatePicker from "react-datepicker";
import { format, parseISO } from "date-fns";
import "react-datepicker/dist/react-datepicker.css";
import { useStore } from "../store/useStore";
import { getValueAtPath, setValueAtPath } from "../utils/pathUtils";
import { STATUS_OPTIONS, PRIORITY_OPTIONS, PREDEFINED_TAGS, getTagColorClass } from "./TodoWorkspace";
import { JavaScriptIcon, TypeScriptIcon, PythonIcon, JsonIcon, MarkdownIcon, TextIcon } from "./FileIcons";
import { cn } from "@/lib/utils";

// --- Types ---
export interface FlatFileItem {
  id: string; // "root.dataSources.transform_users_js_node"
  name: string; // "transform_users.js"
  type: string; // "js_node" | "ts_node" | "py_node" | "api_node" | "todo_node" | "transfer_node" | "primitive" | "folder"
  pathStr: string; // "dataSources.transform_users_js_node"
  realKey: string; // "transform_users_js_node"
}

export interface FlatTodoItem {
  id: string;
  text: string;
  completed: boolean;
  status?: string;
  priority?: string;
  dueDate?: string;
  tags?: string[];
  notes?: string;
  tasks?: any[];
  nodePath: string; // The .todo node path
  nodeName: string; // Friendly file name of the .todo node
  parentTaskId?: string;
  assignee?: string;
  depth?: number;
}

// --- Helper: scan all files in the virtual workspace ---
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

    if (keyLower.endsWith("_js_node")) {
      items.push({ id: currentPath, name: key.replace(/_js_node$/i, ".js"), type: "js_node", pathStr: currentPath.replace(/^root\./, ""), realKey: key });
    } else if (keyLower.endsWith("_py_node")) {
      items.push({ id: currentPath, name: key.replace(/_py_node$/i, ".py"), type: "py_node", pathStr: currentPath.replace(/^root\./, ""), realKey: key });
    } else if (keyLower.endsWith("_ts_node")) {
      items.push({ id: currentPath, name: key.replace(/_ts_node$/i, ".ts"), type: "ts_node", pathStr: currentPath.replace(/^root\./, ""), realKey: key });
    } else if (keyLower.endsWith("_api_node")) {
      items.push({ id: currentPath, name: key.replace(/_api_node$/i, ".api"), type: "api_node", pathStr: currentPath.replace(/^root\./, ""), realKey: key });
    } else if (keyLower.endsWith("_todo_node") || keyLower.endsWith(".todo")) {
      items.push({ id: currentPath, name: keyLower.endsWith(".todo") ? key : key.replace(/_todo_node$/i, ".todo"), type: "todo_node", pathStr: currentPath.replace(/^root\./, ""), realKey: key });
    } else if (keyLower.endsWith("_transfer_node") || keyLower.endsWith(".transfer")) {
      items.push({ id: currentPath, name: keyLower.endsWith(".transfer") ? key : key.replace(/_transfer_node$/i, ".transfer"), type: "transfer_node", pathStr: currentPath.replace(/^root\./, ""), realKey: key });
    } else if (keyLower.endsWith("_math_node") || keyLower.endsWith(".math")) {
      items.push({ id: currentPath, name: keyLower.endsWith(".math") ? key : key.replace(/_math_node$/i, ".math"), type: "math_node", pathStr: currentPath.replace(/^root\./, ""), realKey: key });
    } else if (keyLower.endsWith("_json")) {
      items.push({ id: currentPath, name: key.replace(/_json$/i, ".json"), type: "primitive", pathStr: currentPath.replace(/^root\./, ""), realKey: key });
    } else if (keyLower.endsWith("_yaml")) {
      items.push({ id: currentPath, name: key.replace(/_yaml$/i, ".yaml"), type: "primitive", pathStr: currentPath.replace(/^root\./, ""), realKey: key });
    } else if (keyLower.endsWith("_yml")) {
      items.push({ id: currentPath, name: key.replace(/_yml$/i, ".yml"), type: "primitive", pathStr: currentPath.replace(/^root\./, ""), realKey: key });
    } else if (keyLower.endsWith("_csv")) {
      items.push({ id: currentPath, name: key.replace(/_csv$/i, ".csv"), type: "primitive", pathStr: currentPath.replace(/^root\./, ""), realKey: key });
    } else if (keyLower.endsWith("_xml")) {
      items.push({ id: currentPath, name: key.replace(/_xml$/i, ".xml"), type: "primitive", pathStr: currentPath.replace(/^root\./, ""), realKey: key });
    } else if (keyLower.endsWith("_md")) {
      items.push({ id: currentPath, name: key.replace(/_md$/i, ".md"), type: "primitive", pathStr: currentPath.replace(/^root\./, ""), realKey: key });
    } else if (keyLower.endsWith("_txt")) {
      items.push({ id: currentPath, name: key.replace(/_txt$/i, ".txt"), type: "primitive", pathStr: currentPath.replace(/^root\./, ""), realKey: key });
    } else if (typeof value === "object" && value !== null) {
      items.push({ id: currentPath, name: displayName, type: "folder", pathStr: currentPath.replace(/^root\./, ""), realKey: key });
      items.push(...getAllFiles(value, currentPath));
    } else {
      items.push({ id: currentPath, name: displayName, type: "primitive", pathStr: currentPath.replace(/^root\./, ""), realKey: key });
    }
  }
  return items;
}

// --- Helper: scan todos across all .todo files recursively ---
export function scanAllTodos(data: any, path: string = "root"): FlatTodoItem[] {
  if (!data || typeof data !== "object") return [];
  const todos: FlatTodoItem[] = [];
  const isParentArray = Array.isArray(data);

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "function") continue;
    const currentPath = path === "root" ? `root.${key}` : `${path}.${key}`;
    const keyLower = key.toLowerCase();

    if (keyLower.endsWith("_todo_node") || keyLower.endsWith(".todo")) {
      const displayName = keyLower.endsWith(".todo") ? key : key.replace(/_todo_node$/i, ".todo");
      try {
        let nodeData: any = value;
        if (typeof value === "string") {
          nodeData = JSON.parse(value);
        }

        if (nodeData && Array.isArray(nodeData.tasks)) {
          const processTasks = (tasksList: any[], parentId?: string, depth = 0) => {
            tasksList.forEach(task => {
              if (task && typeof task === "object") {
                todos.push({
                  ...task,
                  nodePath: currentPath,
                  nodeName: displayName,
                  parentTaskId: parentId,
                  depth,
                });
                if (Array.isArray(task.tasks)) {
                  processTasks(task.tasks, task.id, depth + 1);
                }
              }
            });
          };
          processTasks(nodeData.tasks);
        }
      } catch (e) {
        console.error("Failed to parse todo data for path", currentPath, e);
      }
    } else if (typeof value === "object" && value !== null) {
      todos.push(...scanAllTodos(value, currentPath));
    }
  }
  return todos;
}

// --- Helper: write back todo update to specific node ---
export async function saveTodoChangesToWorkspace(
  parsedData: any,
  nodePath: string,
  taskId: string,
  updates: any | null // null means delete
) {
  const updatedData = JSON.parse(JSON.stringify(parsedData));
  const val = getValueAtPath(updatedData, nodePath);
  if (!val) return parsedData;

  let nodeObj: any = val;
  let wasString = false;
  if (typeof val === "string") {
    try {
      nodeObj = JSON.parse(val);
      wasString = true;
    } catch {
      return parsedData;
    }
  }

  if (nodeObj && Array.isArray(nodeObj.tasks)) {
    if (updates === null) {
      // Delete task
      const walk = (tList: any[]): any[] => {
        return tList
          .filter(t => t.id !== taskId)
          .map(t => {
            if (t.tasks && t.tasks.length > 0) {
              return { ...t, tasks: walk(t.tasks) };
            }
            return t;
          });
      };
      nodeObj.tasks = walk(nodeObj.tasks);
    } else {
      // Update task
      const walk = (tList: any[]): any[] => {
        return tList.map(t => {
          if (t.id === taskId) {
            const merged = { ...t, ...updates };
            if (updates.status === "Completed") {
              merged.completed = true;
            } else if (updates.status && updates.status !== "Completed") {
              merged.completed = false;
            }
            if (updates.completed === true) {
              merged.status = "Completed";
            } else if (updates.completed === false) {
              if (t.status === "Completed") merged.status = "Todo";
            }
            return merged;
          }
          if (t.tasks && t.tasks.length > 0) {
            return { ...t, tasks: walk(t.tasks) };
          }
          return t;
        });
      };
      nodeObj.tasks = walk(nodeObj.tasks);
    }
  }

  const finalVal = wasString ? JSON.stringify(nodeObj, null, 2) : nodeObj;
  setValueAtPath(updatedData, nodePath, finalVal);

  const { setCode, codeFormat } = useStore.getState();
  let newCode = "";
  if (codeFormat === "yaml") {
    try {
      const yaml = (await import("js-yaml")).default;
      newCode = yaml.dump(updatedData);
    } catch {
      newCode = JSON.stringify(updatedData, null, 2);
    }
  } else {
    newCode = JSON.stringify(updatedData, null, 2);
  }
  setCode(newCode);
  return updatedData;
}

export async function addNewTodoToWorkspace(
  parsedData: any,
  nodePath: string,
  newTaskText: string,
  parentTaskId?: string
) {
  const updatedData = JSON.parse(JSON.stringify(parsedData));
  const val = getValueAtPath(updatedData, nodePath);
  if (!val) return parsedData;

  let nodeObj: any = val;
  let wasString = false;
  if (typeof val === "string") {
    try {
      nodeObj = JSON.parse(val);
      wasString = true;
    } catch {
      return parsedData;
    }
  }

  const newId = Math.random().toString(36).substring(2, 9);
  const newTask: any = {
    id: newId,
    text: newTaskText.trim(),
    completed: false,
    status: "Todo",
    priority: "Normal",
    tasks: []
  };

  if (nodeObj && Array.isArray(nodeObj.tasks)) {
    if (!parentTaskId) {
      nodeObj.tasks.push(newTask);
    } else {
      const walk = (tList: any[]): boolean => {
        for (let i = 0; i < tList.length; i++) {
          if (tList[i].id === parentTaskId) {
            if (!tList[i].tasks) tList[i].tasks = [];
            tList[i].tasks.push(newTask);
            return true;
          }
          if (tList[i].tasks && tList[i].tasks.length > 0) {
            if (walk(tList[i].tasks)) return true;
          }
        }
        return false;
      };
      walk(nodeObj.tasks);
    }
  }

  const finalVal = wasString ? JSON.stringify(nodeObj, null, 2) : nodeObj;
  setValueAtPath(updatedData, nodePath, finalVal);

  const { setCode, codeFormat } = useStore.getState();
  let newCode = "";
  if (codeFormat === "yaml") {
    try {
      const yaml = (await import("js-yaml")).default;
      newCode = yaml.dump(updatedData);
    } catch {
      newCode = JSON.stringify(updatedData, null, 2);
    }
  } else {
    newCode = JSON.stringify(updatedData, null, 2);
  }
  setCode(newCode);
  return updatedData;
}

// --- Helper: fuzzy match algorithm ---
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

// --- Dynamic File Icon Renderer Helper ---
function renderOverlayFileIcon(type: string, name: string) {
  const iconClass = "w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0";
  if (type === "js_node" || name.endsWith(".js")) {
    return <JavaScriptIcon />;
  } else if (type === "py_node" || name.endsWith(".py")) {
    return <PythonIcon />;
  } else if (type === "ts_node" || name.endsWith(".ts")) {
    return <TypeScriptIcon />;
  } else if (type === "api_node" || name.endsWith(".api")) {
    return <Globe className="w-4 h-4 text-sky-500 dark:text-sky-400 shrink-0" />;
  } else if (type === "todo_node" || name.endsWith(".todo")) {
    return <CheckCircle2 className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0" />;
  } else if (type === "transfer_node" || name.endsWith(".transfer")) {
    return <Globe className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />;
  } else if (type === "math_node" || name.endsWith(".math")) {
    return <Sparkles className="w-4 h-4 text-fuchsia-500 dark:text-fuchsia-400 shrink-0" />;
  } else if (type === "folder") {
    return <Folder className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />;
  } else {
    if (name.endsWith(".json")) return <JsonIcon />;
    if (name.endsWith(".md")) return <MarkdownIcon />;
    if (name.endsWith(".txt")) return <TextIcon />;
    return <FileText className={iconClass} />;
  }
}

// ==================== MAIN COMPONENT ====================
function InlineDropdown({ value, options, onChange, icon: Icon, defaultLabel = "Select", variant = "default" }: any) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const activeOption = options.find((o: any) => o.value === value) || options[0];
  const ActiveIcon = activeOption?.icon || Icon;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 font-semibold rounded-md transition-colors border",
          variant === "priority" 
            ? cn("uppercase tracking-wider text-[10px]", activeOption?.bgColor || "bg-white border-slate-200 dark:bg-[#151a23] dark:border-slate-800")
            : "text-xs bg-white hover:bg-slate-50 border-slate-200 text-slate-700 dark:bg-[#151a23] dark:hover:bg-[#1a212d] dark:border-slate-800 dark:text-slate-300"
        )}
      >
        {variant !== "priority" && ActiveIcon && <ActiveIcon size={12} className={activeOption?.color || "text-slate-500"} />}
        <span className={variant === "priority" ? activeOption?.color : ""}>{activeOption ? activeOption.label : defaultLabel}</span>
        <ChevronDown size={12} className={variant === "priority" ? cn(activeOption?.color, "opacity-70") : "text-slate-400 ml-0.5"} />
      </button>
      
      <AnimatePresence>
        {open && (
          <motion.div
            key="inline-dropdown"
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="absolute left-0 top-full mt-1.5 w-max min-w-[140px] z-[12000] bg-white dark:bg-[#0f141d] border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl overflow-hidden py-1"
          >
            {options.map((opt: any) => {
              const OptIcon = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-800",
                    value === opt.value ? "text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800/50" : "text-slate-600 dark:text-slate-400"
                  )}
                >
                  {variant !== "priority" && OptIcon && <OptIcon size={12} className={opt.color || "text-slate-400"} />}
                  <span className={variant === "priority" ? cn("uppercase tracking-wider font-bold text-[10px]", opt.color) : ""}>
                    {opt.label}
                  </span>
                  {value === opt.value && <Check size={12} className={variant === "priority" ? cn(opt.color, "ml-auto") : "ml-auto text-blue-500"} />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LabelInput({ tags, onAdd }: { tags: string[], onAdd: (tag: string) => void }) {
  const [val, setVal] = useState("");
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, isAbove: false });
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const popupHeight = 220; // safe estimate
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      const isAbove = spaceBelow < popupHeight && spaceAbove > spaceBelow;
      
      setCoords({
        top: isAbove ? rect.top - 8 : rect.bottom + 8, // add spacing
        left: rect.left,
        isAbove
      });
    }
  };

  useEffect(() => {
    if (open) {
      updatePosition();
      // use capture phase for scroll to catch inner scrolls
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
    }
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        popupRef.current && !popupRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const handleAdd = (tagToAdd: string) => {
    const trimmed = tagToAdd.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      onAdd(trimmed);
    }
    setVal("");
    setOpen(false);
    inputRef.current?.focus();
  };

  const suggestions = PREDEFINED_TAGS.filter((t) => !tags.includes(t) && t.includes(val.toLowerCase().trim()));

  return (
    <div className="relative group" ref={dropdownRef}>
      <div className="flex items-center relative w-[130px]">
        <input
          ref={inputRef}
          type="text"
          placeholder="ADD LABEL..."
          value={val}
          onChange={(e) => {
            setVal(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd(val);
            }
          }}
          className="w-full text-[10px] items-center font-bold uppercase tracking-wider bg-transparent border border-dashed border-slate-400 dark:border-slate-700 px-2.5 pl-6 py-1.5 pr-7 rounded-lg outline-none text-slate-700 dark:text-slate-300 focus:border-blue-500 focus:bg-blue-500/5 transition-colors placeholder:text-slate-500/70"
        />
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
          <Hash size={10} className="text-slate-400" />
        </div>
        <button
          onClick={() => handleAdd(val)}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-blue-500 cursor-pointer"
        >
          <CornerDownLeft size={12} />
        </button>
      </div>

      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {open && suggestions.length > 0 && (
            <motion.div
              key="label-popup"
              ref={popupRef}
              initial={{ opacity: 0, y: coords.isAbove ? 4 : -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1 } }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              style={{
                position: "fixed",
                top: coords.isAbove ? "auto" : coords.top,
                bottom: coords.isAbove ? window.innerHeight - coords.top : "auto",
                left: coords.left,
              }}
              className="w-48 z-[13000] bg-white dark:bg-[#11151d] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-2 flex flex-col gap-1.5 origin-top"
            >
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleAdd(s)}
                  className="flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 p-1.5 rounded-md transition-colors w-full text-left cursor-pointer"
                >
                  <Hash size={12} className="text-slate-400 shrink-0" />
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border leading-none",
                      getTagColorClass(s)
                    )}
                  >
                    {s}
                  </span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

const CustomDateInput = forwardRef<HTMLDivElement, any>(({ value, onClick, className, children }, ref) => (
  <div onClick={onClick} ref={ref} className={className}>
    {children}
  </div>
));

export default function ProductivityLayer() {
  const parsedData = useStore((s) => s.parsedData);
  const activeExplorerFile = useStore((s) => s.activeExplorerFile);
  const { openWorkspaceTab, setExpandedJsNodeId } = useStore();

  // Dialog opened states
  const [isTodoOpen, setIsTodoOpen] = useState(false);
  const [isFileOpen, setIsFileOpen] = useState(false);

  // Search input state
  const [todoSearch, setTodoSearch] = useState("");
  const [fileSearch, setFileSearch] = useState("");

  // Keyboard pointer selection
  const [selectedTodoIdx, setSelectedTodoIdx] = useState(0);
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);

  // Todo Detail state
  const [activeTodo, setActiveTodo] = useState<FlatTodoItem | null>(null);
  const [todoViewMode, setTodoViewMode] = useState<"flat" | "tree">("flat");
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // New task creation states
  const [isCreatingTodo, setIsCreatingTodo] = useState(false);
  const [newTodoText, setNewTodoText] = useState("");
  const [selectedNodePath, setSelectedNodePath] = useState("");
  const [targetParentTaskId, setTargetParentTaskId] = useState("");

  // Inline subtask states
  const [inlineSubParentId, setInlineSubParentId] = useState<string | null>(null);
  const [inlineSubText, setInlineSubText] = useState("");

  // Saved / Pinned Files and chronological swap logs in LocalStorage
  const [recentFiles, setRecentFiles] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("productivity_recent_files");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (activeTodo) {
      setIsEditingNotes(false);
    }
  }, [activeTodo?.id]);

  const [pinnedFiles, setPinnedFiles] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("productivity_pinned_files");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Track file list
  const allWorkspaceFiles = useMemo(() => getAllFiles(parsedData), [parsedData]);

  // Sync opened file to chronological history list
  useEffect(() => {
    if (activeExplorerFile && allWorkspaceFiles.some(f => f.id === activeExplorerFile)) {
      setRecentFiles((prev) => {
        const filtered = prev.filter((p) => p !== activeExplorerFile);
        const next = [activeExplorerFile, ...filtered].slice(0, 50);
        localStorage.setItem("productivity_recent_files", JSON.stringify(next));
        return next;
      });
    }
  }, [activeExplorerFile, allWorkspaceFiles]);

  // Global Key Shortcut Listener
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // 1. Check Todo Center triggers: Alt + T or Ctrl + Shift + T
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

      // 2. Check File switcher / Quick explorer: Shift + ~ (tilde)
      // Standard: e.key === "~" or backquote code with shift
      const isFileHotkey = e.key === "~" || (e.code === "Backquote" && e.shiftKey);

      if (isFileHotkey) {
        e.preventDefault();
        e.stopPropagation();

        setIsFileOpen((prev) => !prev);
        setIsTodoOpen(false);
        setFileSearch("");
        setSelectedFileIdx(0);
        return;
      }
    };

    window.addEventListener("keydown", handleGlobalShortcuts, true);
    return () => window.removeEventListener("keydown", handleGlobalShortcuts, true);
  }, []);

  // --- Filtering & Sorting: FILE LISTS ---
  const filteredFiles = useMemo(() => {
    const list = allWorkspaceFiles.filter(f => f.type !== "folder"); // don't list empty directories, only openables
    if (!fileSearch.trim()) {
      // chronological swap + pinned files first
      const sorted = [...list].sort((a, b) => {
        const aPinned = pinnedFiles.includes(a.id);
        const bPinned = pinnedFiles.includes(b.id);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;

        const aRecentIdx = recentFiles.indexOf(a.id);
        const bRecentIdx = recentFiles.indexOf(b.id);

        if (aRecentIdx !== -1 && bRecentIdx === -1) return -1;
        if (aRecentIdx === -1 && bRecentIdx !== -1) return 1;
        if (aRecentIdx !== -1 && bRecentIdx !== -1) return aRecentIdx - bRecentIdx;

        return a.name.localeCompare(b.name);
      });
      return sorted;
    }

    const matched = list
      .map(f => {
        let isGlobMatch = false;
        if (fileSearch.includes('*') || fileSearch.includes('?')) {
          try {
            const escapeRegex = (s: string) => s.replace(/[-[\]{}()+.,\\^$|#\s]/g, '\\$&');
            // If the user doesn't start with *, we assume they mean "starts with" or we can just allow substring glob by doing '.*' + regex + '.*' 
            // Standard glob: * means anything.
            const regexStr = '^' + escapeRegex(fileSearch).replace(/\\\*/g, '.*').replace(/\\\?/g, '.') + '$';
            const regex = new RegExp(regexStr, 'i');
            isGlobMatch = regex.test(f.name) || regex.test(f.pathStr) || regex.test('/' + f.pathStr);
          } catch(e) {}
        }

        const scoreName = scoreFuzzy(f.name, fileSearch);
        const scorePath = scoreFuzzy(f.pathStr, fileSearch);
        let finalScore = Math.max(scoreName, scorePath);

        if (isGlobMatch) {
          finalScore = finalScore > 0 ? finalScore + 500 : 500;
        }

        return { file: f, score: finalScore };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.file);

    return matched;
  }, [allWorkspaceFiles, fileSearch, pinnedFiles, recentFiles]);

  // --- Filtering & Sorting: TODOS ---
  const allWorkspaceTodos = useMemo(() => scanAllTodos(parsedData), [parsedData]);

  const filteredTodos = useMemo(() => {
    if (!todoSearch.trim()) {
      // Default grouping order: Overdue first, then High priority, then Pinned, then Chronological Active
      return allWorkspaceTodos;
    }

    const q = todoSearch.toLowerCase().trim();
    const matched = allWorkspaceTodos
      .map(t => {
        const scText = scoreFuzzy(t.text || "", q);
        const scNotes = scoreFuzzy(t.notes || "", q);
        const scNode = scoreFuzzy(t.nodeName || "", q);
        const scStatus = scoreFuzzy(t.status || "", q);
        const scPriority = scoreFuzzy(t.priority || "", q);
        const scAssignee = scoreFuzzy(t.assignee || "", q);
        const scTags = (t.tags || []).some(tag => scoreFuzzy(tag, q) > 0) ? 50 : 0;

        const maxScore = Math.max(scText, scNotes, scNode, scStatus, scPriority, scAssignee, scTags);
        return { item: t, score: maxScore };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.item);

    return matched;
  }, [allWorkspaceTodos, todoSearch]);

  // Auto bounds selector checks
  useEffect(() => {
    if (selectedTodoIdx >= filteredTodos.length) {
      setSelectedTodoIdx(Math.max(0, filteredTodos.length - 1));
    }
  }, [filteredTodos.length, selectedTodoIdx]);

  useEffect(() => {
    if (selectedFileIdx >= filteredFiles.length) {
      setSelectedFileIdx(Math.max(0, filteredFiles.length - 1));
    }
  }, [filteredFiles.length, selectedFileIdx]);

  // Keyboard navigation for File navigation overlays
  const handleFileKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedFileIdx((prev) => (prev + 1) % Math.max(1, filteredFiles.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedFileIdx((prev) => (prev - 1 + filteredFiles.length) % Math.max(1, filteredFiles.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filteredFiles[selectedFileIdx];
      if (target) {
        openWorkspaceTab(target.id, false);
        setExpandedJsNodeId(target.id);
        setIsFileOpen(false);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsFileOpen(false);
    }
  };

  // Keyboard navigation for Todo Center overlays
  const handleTodoKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedTodoIdx((prev) => (prev + 1) % Math.max(1, filteredTodos.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedTodoIdx((prev) => (prev - 1 + filteredTodos.length) % Math.max(1, filteredTodos.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filteredTodos[selectedTodoIdx];
      if (target) {
        setActiveTodo(target);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsTodoOpen(false);
    }
  };

  // State handlers inside Todo Details
  const handleToggleTodoPin = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setPinnedFiles((prev) => {
      const next = prev.includes(fileId) ? prev.filter((p) => p !== fileId) : [...prev, fileId];
      localStorage.setItem("productivity_pinned_files", JSON.stringify(next));
      return next;
    });
  };

  const handleUpdateTodoField = async (taskId: string, nodePath: string, field: string, value: any) => {
    const updated = await saveTodoChangesToWorkspace(parsedData, nodePath, taskId, { [field]: value });
    // Update local details popup references
    if (activeTodo && activeTodo.id === taskId) {
      setActiveTodo((prev) => (prev ? { ...prev, [field]: value } : null));
    }
  };

  const handleToggleTodoStatus = async (task: FlatTodoItem) => {
    const isCompleted = task.completed || task.status === "Completed";
    const nextStatus = isCompleted ? "Todo" : "Completed";
    await handleUpdateTodoField(task.id, task.nodePath, "status", nextStatus);
  };

  const handleDeleteTodo = async (task: FlatTodoItem) => {
    await saveTodoChangesToWorkspace(parsedData, task.nodePath, task.id, null);
    setActiveTodo(null);
    useStore.getState().setNotification?.({
      message: `Deleted task "${task.text || "unlabeled task"}"`,
      type: "success"
    });
  };

  const allTodoFiles = useMemo(() => {
    return allWorkspaceFiles.filter(f => f.type === "todo_node" || f.name.endsWith(".todo"));
  }, [allWorkspaceFiles]);

  useEffect(() => {
    if (allTodoFiles.length > 0 && !selectedNodePath) {
      setSelectedNodePath(allTodoFiles[0].id);
    }
  }, [allTodoFiles, selectedNodePath]);

  const handleCreateTodoSubmit = async () => {
    if (!newTodoText.trim() || !selectedNodePath) return;
    await addNewTodoToWorkspace(
      parsedData,
      selectedNodePath,
      newTodoText,
      targetParentTaskId || undefined
    );
    setNewTodoText("");
    setIsCreatingTodo(false);
  };

  const todoCenterListEl = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = todoCenterListEl.current;
    if (el) {
      const selectedEl = el.querySelector(".is-selected-todo");
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedTodoIdx]);

  const fileExplorerListEl = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = fileExplorerListEl.current;
    if (el) {
      const selectedEl = el.querySelector(".is-selected-file");
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedFileIdx]);

  // Render Portal Node to root document layer
  const renderPortalContent = () => {
    return (
      <div className="text-sans">
        <AnimatePresence>
          {/* 1. KEYBOARD SWAP: QUICK FILE PALETTE OVERLAY */}
          {isFileOpen && (
            <motion.div
              key="file-palette"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[11000] w-screen h-screen flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-[3px] p-4 md:p-6"
              onClick={() => setIsFileOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.15 }}
                className="w-full max-w-[650px] bg-white dark:bg-[#0c1017] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden max-h-[480px] select-none"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Search Bar */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800/80">
                  <Search size={17} className="text-slate-400 dark:text-slate-500 shrink-0" />
                  <input
                    autoFocus
                    type="text"
                    value={fileSearch}
                    onChange={(e) => {
                      setFileSearch(e.target.value.replace(/^~/, ''));
                      setSelectedFileIdx(0);
                    }}
                    onKeyDown={handleFileKeyDown}
                    placeholder="Search files fuzzy matching (glob pattern search allowed here, Shift+~ to close)..."
                    className="w-full text-sm font-mono bg-transparent border-none outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-550"
                  />
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-500 font-bold font-mono">
                    <Command size={10} className="mr-0.5" />P
                  </div>
                </div>

                {/* File List */}
                <div
                  ref={fileExplorerListEl}
                  className="flex-1 overflow-y-auto py-2 text-xs divide-y divide-slate-50/50 dark:divide-slate-900/40"
                >
                  {filteredFiles.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 dark:text-slate-500 select-none flex flex-col items-center gap-2">
                      <FolderOpen size={24} className="text-slate-300 dark:text-slate-700" />
                      <span>No matching files found</span>
                    </div>
                  ) : (
                    filteredFiles.map((file, idx) => {
                      const isSelected = idx === selectedFileIdx;
                      const isOpen = activeExplorerFile === file.id;
                      const isPinned = pinnedFiles.includes(file.id);

                      return (
                        <div
                          key={`${file.id}-${idx}`}
                          className={cn(
                            "is-selected-file group flex items-center justify-between px-3 py-2 cursor-pointer transition-colors relative font-mono select-none mx-2 my-0.5 rounded-md",
                            isSelected
                              ? "bg-blue-600 text-white shadow-sm"
                              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                          )}
                          onClick={() => {
                            openWorkspaceTab(file.id, false);
                            setExpandedJsNodeId(file.id);
                            setIsFileOpen(false);
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-6">
                            <span>{renderOverlayFileIcon(file.type, file.name)}</span>
                            <div className="min-w-0 flex flex-col md:flex-row md:items-baseline md:gap-3 leading-none md:leading-normal">
                              <span className={cn("text-xs font-semibold tracking-tight truncate", isOpen && !isSelected && "text-blue-600 dark:text-blue-400")}>
                                {file.name}
                              </span>
                              <span className={cn("text-[10px] truncate mt-0.5 md:mt-0", isSelected ? "text-blue-200" : "text-slate-450 dark:text-slate-500")}>
                                {file.pathStr}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isOpen && (
                              <span className={cn("text-[9px] uppercase font-bold px-1 py-0.5 rounded tracking-wider shrink-0 select-none", isSelected ? "bg-white/20 text-white" : "text-blue-500 bg-blue-500/10 dark:bg-blue-500/20")}>
                                active
                              </span>
                            )}
                            <button
                              onClick={(e) => handleToggleTodoPin(file.id, e)}
                              className={cn("p-1 rounded opacity-0 group-hover:opacity-100 transition shrink-0", isSelected ? "text-white/70 hover:text-white hover:bg-white/10" : "text-slate-400 hover:text-amber-500 hover:bg-slate-150 dark:hover:bg-slate-750")}
                            >
                              <Pin size={11} className={cn(isPinned ? (isSelected ? "fill-white text-white opacity-100" : "fill-amber-500 text-amber-500 opacity-100") : "")} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer bar */}
                <div className="p-2 border-t border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-[#090d14] flex items-center justify-between font-mono text-[9px] text-slate-400 select-none shrink-0 uppercase tracking-widest pl-4 pr-3.5">
                  <div className="flex items-center gap-4">
                    <span>↑↓ to navigate</span>
                    <span>⏎ select</span>
                    <span>⎋ escape</span>
                  </div>
                  <div>
                    <span>{filteredFiles.length} files total</span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* 2. KEYBOARD SWAP: GLOBAL TODO CENTER */}
          {isTodoOpen && (
            <motion.div
              key="global-todo-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[11000] w-screen h-screen flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-[3px] p-4 md:p-6"
              onClick={() => setIsTodoOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.15 }}
                className="w-full max-w-[700px] bg-white dark:bg-[#0c1017] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden max-h-[500px] select-none"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Search Header */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800/80">
                  <ListTodo size={17} className="text-blue-500 dark:text-blue-400 shrink-0 animate-pulse" />
                  <input
                    autoFocus
                    type="text"
                    value={todoSearch}
                    onChange={(e) => {
                      setTodoSearch(e.target.value);
                      setSelectedTodoIdx(0);
                    }}
                    onKeyDown={handleTodoKeyDown}
                    placeholder="Search all todos, filter by Priority, Status, Label (Alt + T to close)..."
                    className="w-full text-sm font-sans bg-transparent border-none outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-550"
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setIsCreatingTodo(prev => !prev)}
                      className={cn(
                        "px-2 py-1 text-[10px] font-bold rounded font-mono uppercase tracking-wider transition-colors flex items-center gap-1",
                        isCreatingTodo
                          ? "bg-emerald-600 text-white"
                          : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                      )}
                    >
                      + Create
                    </button>
                    <button
                      onClick={() => setTodoViewMode(prev => prev === "tree" ? "flat" : "tree")}
                      className={cn("px-2 py-1 text-[10px] font-bold rounded font-mono uppercase tracking-wider transition-colors", todoViewMode === "tree" ? "bg-blue-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500")}
                    >
                      {todoViewMode === "tree" ? "Tree View" : "Flat List"}
                    </button>
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-500 font-bold font-mono ml-2">
                      Alt + T
                    </div>
                  </div>
                </div>

                {isCreatingTodo && (
                  <div className="px-4 py-3.5 bg-slate-50 dark:bg-[#111622] border-b border-slate-100 dark:border-slate-800/80 flex flex-col gap-3 select-none">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#10b981] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-ping shrink-0" />
                        Create New Task (supports nesting)
                      </span>
                      <button 
                        onClick={() => setIsCreatingTodo(false)} 
                        className="text-slate-450 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Destination .todo file select */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                          Destination File
                        </label>
                        <select
                          value={selectedNodePath}
                          onChange={(e) => {
                            setSelectedNodePath(e.target.value);
                            setTargetParentTaskId(""); // reset parent
                          }}
                          className="w-full text-xs bg-white dark:bg-[#161d2b] border border-slate-200 dark:border-slate-800 rounded-lg p-2 outline-none text-slate-850 dark:text-slate-200 cursor-pointer"
                        >
                          {allTodoFiles.map((file) => (
                            <option key={file.id} value={file.id}>
                              {file.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Parent Task Selector (Nesting!) */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                          Nesting / Parent Task (Optional)
                        </label>
                        <select
                          value={targetParentTaskId}
                          onChange={(e) => setTargetParentTaskId(e.target.value)}
                          className="w-full text-xs bg-white dark:bg-[#161d2b] border border-slate-200 dark:border-slate-800 rounded-lg p-2 outline-none text-slate-850 dark:text-slate-200 cursor-pointer"
                        >
                          <option value="">None (Top Level Root Task)</option>
                          {allWorkspaceTodos
                            .filter((t) => t.nodePath === selectedNodePath)
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {"— ".repeat(t.depth || 0)}{t.text}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    {/* Task text bar and Submit button */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newTodoText}
                        onChange={(e) => setNewTodoText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleCreateTodoSubmit();
                          }
                        }}
                        placeholder="Type task details and press Enter to save..."
                        className="flex-1 text-xs bg-white dark:bg-[#161d2b] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 outline-none text-slate-850 dark:text-slate-200 placeholder-slate-400 focus:border-blue-500 transition-colors"
                      />
                      <button
                        onClick={handleCreateTodoSubmit}
                        disabled={!newTodoText.trim() || !selectedNodePath}
                        className="p-2.5 px-4 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-colors shrink-0 cursor-pointer bg-blue-600 hover:bg-blue-500"
                      >
                        Create
                      </button>
                    </div>
                  </div>
                )}

                {/* Todo List Content */}
                <div
                  ref={todoCenterListEl}
                  className="flex-1 overflow-y-auto py-1.5 divide-y divide-slate-50 dark:divide-slate-900/40"
                >
                  {filteredTodos.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
                      <ClipboardList size={28} className="text-slate-300 dark:text-slate-700" />
                      <span className="text-xs font-semibold">No tasks match your search criteria</span>
                    </div>
                  ) : (
                    filteredTodos.map((todo, idx) => {
                      const isSelected = idx === selectedTodoIdx;
                      const isCompleted = todo.completed || todo.status === "Completed";
                      
                      let priorityBg = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-350";
                      if (todo.priority === "High" || todo.priority === "Critical") {
                        priorityBg = "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20";
                      } else if (todo.priority === "Medium") {
                        priorityBg = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20";
                      } else if (todo.priority === "Low") {
                        priorityBg = "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20";
                      }

                      return (
                        <React.Fragment key={`${todo.nodePath}-${todo.id}-${idx}`}>
                          <div
                            className={cn(
                              "is-selected-todo flex items-center justify-between px-3 py-2.5 cursor-pointer transition-colors relative select-none mx-2 my-0.5 rounded-md",
                              isSelected
                                ? "bg-blue-600 text-white border-transparent shadow-sm"
                                : "hover:bg-slate-100 dark:hover:bg-slate-800/80"
                            )}
                            style={todoViewMode === "tree" && !todoSearch.trim() ? { paddingLeft: `${Math.max(1, (todo.depth || 0) * 1.5 + 1)}rem` } : {}}
                            onClick={() => {
                              setActiveTodo(todo);
                            }}
                          >
                            <div className="flex items-center gap-3 min-w-0 pr-4">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleTodoStatus(todo);
                                }}
                                className={cn("transition shrink-0", isSelected ? "text-white/80 hover:text-white" : "text-slate-400 hover:text-blue-500")}
                              >
                                {isCompleted ? (
                                  <CheckCircle2 size={15} className={cn(isSelected ? "text-white" : "text-emerald-500")} />
                                ) : (
                                  <Circle size={15} className={cn(isSelected ? "text-white/60" : "text-slate-450 dark:text-slate-500")} />
                                )}
                              </button>
                              <div className="flex flex-col min-w-0">
                                <span className={cn(
                                  "text-xs font-medium truncate tracking-tight",
                                  isSelected ? "text-white" : "text-slate-800 dark:text-slate-200",
                                  isCompleted && (isSelected ? "line-through text-white/60 font-normal" : "line-through text-slate-400 dark:text-slate-550 font-normal")
                                )}>
                                  {todo.text || <em className={cn("font-mono text-[10px]", isSelected ? "text-white/60" : "text-slate-450 dark:text-slate-600")}>unlabeled task</em>}
                                </span>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className={cn("font-mono text-[9px] px-1 py-0.5 rounded flex items-center leading-none", isSelected ? "bg-white/20 text-white/90" : "text-slate-450 dark:text-slate-500 bg-slate-100 dark:bg-slate-900")}>
                                    {todo.nodeName}
                                  </span>
                                  {todo.priority && todo.priority !== "Normal" && (
                                    <span className={cn("text-[8px] uppercase tracking-wide font-bold px-1 rounded leading-none pt-0.5 pb-px", isSelected ? "bg-white/20 text-white" : priorityBg)}>
                                      {todo.priority}
                                    </span>
                                  )}
                                  {todo.dueDate && (
                                    <span className={cn("text-[8px] px-1 rounded font-mono shrink-0 flex items-center gap-0.5", isSelected ? "bg-white/20 text-white" : "text-rose-500 bg-rose-500/10")}>
                                      <CalendarIcon size={8} />
                                      {todo.dueDate}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (inlineSubParentId === todo.id) {
                                    setInlineSubParentId(null);
                                  } else {
                                    setInlineSubParentId(todo.id);
                                    setInlineSubText("");
                                  }
                                }}
                                title="Add child/subtask"
                                className={cn(
                                  "text-[9px] uppercase font-bold px-1.5 py-0.5 rounded font-mono select-none flex items-center gap-0.5 transition-colors cursor-pointer",
                                  isSelected 
                                    ? "bg-white/20 text-white hover:bg-white/30" 
                                    : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100"
                                )}
                              >
                                + subtask
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await handleDeleteTodo(todo);
                                }}
                                title="Delete task"
                                className={cn(
                                  "p-1 rounded font-mono transition-colors cursor-pointer flex items-center justify-center shrink-0",
                                  isSelected
                                    ? "text-white/80 hover:text-rose-250 hover:bg-white/15"
                                    : "text-slate-450 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                                )}
                              >
                                <Trash2 size={13} />
                              </button>
                              {(todo.tags || []).map((tag, tagIdx) => (
                                <span key={`${tag}-${tagIdx}`} className={cn("text-[8px] font-bold uppercase tracking-wider border px-1 py-0.5 rounded font-mono select-none", isSelected ? "bg-white/20 text-white border-transparent" : "text-slate-400 bg-slate-100 dark:bg-slate-900 border-slate-250 dark:border-slate-800/80")}>
                                  {tag}
                                </span>
                              ))}
                              {isSelected && (
                                <span className="text-[9px] text-white/70 uppercase font-mono pl-1 shrink-0 select-none">
                                  ⏎ view
                                </span>
                              )}
                            </div>
                          </div>

                          {inlineSubParentId === todo.id && (
                            <div 
                              className="px-4 py-2 bg-slate-50 dark:bg-[#111622] border-t border-b border-slate-100 dark:border-slate-800/80 flex items-center gap-2 select-none"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="text-[10px] font-bold text-emerald-500 font-mono tracking-wide shrink-0">
                                SUBTASK OF "{todo.text.slice(0, 15)}...":
                              </span>
                              <input
                                autoFocus
                                type="text"
                                value={inlineSubText}
                                onChange={(e) => setInlineSubText(e.target.value)}
                                onKeyDown={async (e) => {
                                  if (e.key === "Enter") {
                                    if (inlineSubText.trim()) {
                                      await addNewTodoToWorkspace(
                                        parsedData,
                                        todo.nodePath,
                                        inlineSubText,
                                        todo.id
                                      );
                                      setInlineSubText("");
                                      setInlineSubParentId(null);
                                    }
                                  } else if (e.key === "Escape") {
                                    setInlineSubParentId(null);
                                  }
                                }}
                                placeholder="Type subtask name and press Enter..."
                                className="flex-1 bg-white dark:bg-[#161d2b] border border-slate-200 dark:border-slate-800 rounded-md p-1.5 text-xs text-slate-850 dark:text-slate-200 placeholder-slate-400 outline-none"
                              />
                              <button
                                onClick={async () => {
                                  if (inlineSubText.trim()) {
                                    await addNewTodoToWorkspace(
                                      parsedData,
                                      todo.nodePath,
                                      inlineSubText,
                                      todo.id
                                    );
                                    setInlineSubText("");
                                    setInlineSubParentId(null);
                                  }
                                }}
                                className="text-[10px] uppercase font-bold tracking-wider px-2 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
                              >
                                Add
                              </button>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </div>

                {/* Footer bar */}
                <div className="p-2 border-t border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-[#090d14] flex items-center justify-between font-mono text-[9px] text-slate-400 select-none shrink-0 uppercase tracking-widest pl-4 pr-3.5">
                  <div className="flex items-center gap-4">
                    <span>↑↓ to select</span>
                    <span>⏎ open detail popup</span>
                    <span>⎋ escape</span>
                  </div>
                  <div>
                    <span>{filteredTodos.length} tasks total</span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* 3. TODO DETAIL POPUP */}
          {activeTodo && (
            <motion.div
              key="todo-detail-popup"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[11500] w-screen h-screen flex items-center justify-center bg-black/65 dark:bg-black/85 backdrop-blur-[4px] p-4 text-slate-800 dark:text-slate-200"
              onClick={() => setActiveTodo(null)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="w-full max-w-[620px] bg-white dark:bg-[#0c1017] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header controls layout */}
                <div className="px-3 sm:px-4 py-3 bg-slate-50 dark:bg-[#0e141f] border-b border-slate-100 dark:border-slate-850 flex items-center justify-between shrink-0 select-none overflow-hidden">
                  <div className="flex items-center text-[10px] sm:text-xs font-semibold text-slate-500 tracking-wide font-mono min-w-0 pr-2">
                    <button
                      onClick={() => setActiveTodo(null)}
                      className="p-1 sm:p-1.5 mr-1.5 sm:mr-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-450 dark:text-slate-505 transition cursor-pointer shrink-0"
                    >
                      <ArrowLeft size={13} />
                    </button>
                    <ClipboardList size={14} className="text-blue-500 mr-1.5 shrink-0 hidden sm:block" />
                    <span className="truncate min-w-0">{activeTodo.nodeName}</span>
                    <span className="text-slate-300 dark:text-slate-700 mx-1 sm:mx-1.5 shrink-0">/</span>
                    <span className="text-slate-400 shrink-0 whitespace-nowrap hidden sm:inline">TASK DETAIL</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        openWorkspaceTab(activeTodo.nodePath, true);
                        setExpandedJsNodeId(activeTodo.nodePath);
                        setIsTodoOpen(false);
                        setActiveTodo(null);
                      }}
                      title="Open file in workspace"
                      className="p-1 sm:p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-450 dark:text-slate-500 transition cursor-pointer shrink-0"
                    >
                      <ExternalLink size={13} />
                    </button>
                    <button
                      onClick={() => handleToggleTodoStatus(activeTodo)}
                      className={cn(
                        "text-[10px] sm:text-xs px-2 sm:px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer shrink-0",
                        activeTodo.completed || activeTodo.status === "Completed"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-800"
                          : "bg-blue-50 text-blue-700 border-blue-250 dark:bg-blue-900/10 dark:text-blue-400 dark:border-blue-800"
                      )}
                    >
                      {activeTodo.completed || activeTodo.status === "Completed" ? (
                        <>
                          <CheckCircle2 size={13} className="shrink-0" />
                          <span className="hidden sm:inline">Completed</span>
                        </>
                      ) : (
                        <>
                          <Circle size={13} className="shrink-0" />
                          <span className="hidden sm:inline">Mark Complete</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteTodo(activeTodo)}
                      className="p-1 sm:p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-rose-500/10 hover:border-rose-500/20 hover:text-rose-500 text-slate-450 dark:text-slate-500 transition cursor-pointer shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Body Content Editor */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 sm:space-y-5 custom-scrollbar">
                  {/* Title editor */}
                  <div className="space-y-1">
                    <label className="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider select-none px-1">
                      Task Title
                    </label>
                    <TextareaAutosize
                      minRows={1}
                      maxRows={5}
                      value={activeTodo.text || ""}
                      onChange={(e) => handleUpdateTodoField(activeTodo.id, activeTodo.nodePath, "text", e.target.value)}
                      placeholder="Give this task a name..."
                      className="w-full text-xl sm:text-2xl font-extrabold bg-transparent border-none outline-none text-slate-900 dark:text-white py-1 focus:ring-0 resize-none placeholder-slate-300 dark:placeholder-slate-700 leading-tight px-1 shadow-none transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30 focus:bg-slate-50/50 dark:focus:bg-slate-800/30 rounded-sm"
                    />
                  </div>

                  {/* Attributes Box Grid */}
                  <div className="flex flex-col gap-2.5 sm:gap-3 border-y border-slate-100 dark:border-slate-850 py-3 sm:py-4 px-2">
                    {/* Priority Selector */}
                    <div className="flex items-center min-h-[28px]">
                      <span className="w-24 sm:w-28 shrink-0 text-[10px] sm:text-[11px] text-slate-450 dark:text-slate-500 font-semibold select-none flex items-center gap-1.5 uppercase tracking-wider">
                        <AlertCircle size={11} className="hidden sm:block" /> Priority
                      </span>
                      <InlineDropdown
                        value={activeTodo.priority || "Normal"}
                        onChange={(val: string) => handleUpdateTodoField(activeTodo.id, activeTodo.nodePath, "priority", val)}
                        options={PRIORITY_OPTIONS}
                        defaultLabel="Normal"
                        variant="priority"
                      />
                    </div>

                    {/* Status selector */}
                    <div className="flex items-center min-h-[28px]">
                      <span className="w-24 sm:w-28 shrink-0 text-[10px] sm:text-[11px] text-slate-450 dark:text-slate-500 font-semibold select-none flex items-center gap-1.5 uppercase tracking-wider">
                        <Layers size={11} className="hidden sm:block" /> Status
                      </span>
                      <InlineDropdown
                        value={activeTodo.status || "Todo"}
                        onChange={(val: string) => handleUpdateTodoField(activeTodo.id, activeTodo.nodePath, "status", val)}
                        options={STATUS_OPTIONS}
                        defaultLabel="Todo"
                      />
                    </div>

                    {/* Target Date picker input */}
                    <div className="flex items-center min-h-[28px]">
                      <span className="w-24 sm:w-28 shrink-0 text-[10px] sm:text-[11px] text-slate-450 dark:text-slate-500 font-semibold select-none flex items-center gap-1.5 uppercase tracking-wider">
                        <CalendarIcon size={11} className="hidden sm:block" /> Target Date
                      </span>
                      <div className="relative group w-[110px]">
                        <DatePicker
                          selected={activeTodo.dueDate ? parseISO(activeTodo.dueDate) : null}
                          onChange={(date: Date | null) => {
                            const dateString = date ? format(date, "yyyy-MM-dd") : null;
                            handleUpdateTodoField(activeTodo.id, activeTodo.nodePath, "dueDate", dateString);
                          }}
                          customInput={
                            <CustomDateInput className="bg-white dark:bg-[#151a23] border border-slate-200 dark:border-slate-800 rounded-md px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 w-[110px] flex items-center group-hover:bg-slate-50 dark:group-hover:bg-[#1a212d] transition-colors cursor-pointer relative z-0">
                              <span className={cn(!activeTodo.dueDate && "text-slate-400 group-hover:text-slate-500")}>
                                {activeTodo.dueDate ? format(parseISO(activeTodo.dueDate), "MM/dd/yyyy") : "mm/dd/yyyy"}
                              </span>
                            </CustomDateInput>
                          }
                          withPortal
                          portalId="datepicker-portal"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notes / Description */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider select-none flex items-center gap-1 px-1">
                        Notes & Description
                      </label>
                      <button
                        onClick={() => setIsEditingNotes(!isEditingNotes)}
                        className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-blue-500 hover:border-blue-500/50 transition flex items-center gap-1"
                      >
                        {isEditingNotes ? (
                          <><Eye size={10} /> Preview</>
                        ) : (
                          <><Edit2 size={10} /> Edit</>
                        )}
                      </button>
                    </div>
                    {isEditingNotes ? (
                      <textarea
                        rows={4}
                        value={activeTodo.notes || ""}
                        onChange={(e) => handleUpdateTodoField(activeTodo.id, activeTodo.nodePath, "notes", e.target.value)}
                        placeholder="Add markdown or plan details here..."
                        className="w-full text-[13px] font-sans bg-slate-50/50 dark:bg-slate-900/30 border border-slate-150 dark:border-slate-800/80 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-400 dark:placeholder-slate-600 outline-none leading-relaxed custom-scrollbar"
                      />
                    ) : (
                      <div 
                        className={cn(
                          "w-full text-xs sm:text-[13px] bg-slate-50/50 dark:bg-slate-900/30 border border-slate-150 dark:border-slate-800/80 rounded-xl p-3 sm:p-4 min-h-[5rem]",
                          !activeTodo.notes ? "flex items-center justify-center text-slate-400 dark:text-slate-500 italic" : "cursor-text"
                        )}
                        onClick={() => setIsEditingNotes(true)}
                      >
                        {activeTodo.notes ? (
                          <div className="prose dark:prose-invert prose-sm max-w-none prose-p:my-1.5 prose-headings:my-2 !prose-headings:font-bold prose-h1:text-lg prose-h2:text-base prose-h3:text-sm prose-h4:text-xs prose-h1:border-b-0 prose-h2:border-b-0 prose-a:text-blue-500 prose-ul:my-1 prose-li:my-0.5">
                            <Markdown>{activeTodo.notes}</Markdown>
                          </div>
                        ) : (
                          "Click to add notes or description..."
                        )}
                      </div>
                    )}
                  </div>

                  {/* Labels Section */}
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider select-none flex items-center gap-1">
                      <Hash size={14} /> Labels
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(activeTodo.tags || []).map((tag: string, tagIdx: number) => (
                        <span
                          key={`${tag}-${tagIdx}`}
                          className={cn("group text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border flex items-center gap-1 select-none", getTagColorClass(tag))}
                        >
                          {tag}
                          <button
                            onClick={() => {
                              const nextTags = (activeTodo.tags || []).filter((t: string) => t !== tag);
                              handleUpdateTodoField(activeTodo.id, activeTodo.nodePath, "tags", nextTags);
                            }}
                            className="opacity-50 hover:opacity-100 hover:text-rose-500 transition-opacity ml-0.5 cursor-pointer"
                          >
                            <X size={9} />
                          </button>
                        </span>
                      ))}
                      <LabelInput
                        tags={activeTodo.tags || []}
                        onAdd={(newTag: string) => handleUpdateTodoField(activeTodo.id, activeTodo.nodePath, "tags", [...(activeTodo.tags || []), newTag])}
                      />
                    </div>
                  </div>
                </div>

                {/* Detail popup informative footer */}
                <div className="p-2.5 border-t border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-[#090d14] flex items-center justify-between font-mono text-[9px] text-slate-400 select-none shrink-0 uppercase pl-4 pr-4">
                  <div className="flex items-center gap-1 text-[8.5px] text-blue-500">
                    <Sparkles size={10} className="animate-spin duration-3000" />
                    <span>Real-time persistence enabled</span>
                  </div>
                  <div>
                    <span>Press outside or X to return</span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  if (typeof window === "undefined") return null;

  return createPortal(renderPortalContent(), document.body);
}
