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
  ExternalLink,
  Plus,
  Camera,
  Upload,
  Video,
  Music,
  Image as ImageIcon,
  ChevronLeft,
  Star
} from "lucide-react";
import Markdown from "react-markdown";
import { SmartDatePicker } from "./SmartDatePicker";
import { CameraCaptureModal } from "./CameraCaptureModal";
import { format, parseISO } from "date-fns";
import { useStore } from "../store/useStore";
import { getValueAtPath, setValueAtPath } from "../utils/pathUtils";
import { STATUS_OPTIONS, PRIORITY_OPTIONS, PREDEFINED_TAGS, getTagColorClass } from "./TodoWorkspace";
import { JavaScriptIcon, TypeScriptIcon, PythonIcon, JsonIcon, MarkdownIcon, TextIcon } from "./FileIcons";
import { TaskImagePreview } from "./TaskImagePreview";
import { cn } from "@/lib/utils";
import { importFile } from "../utils/assetManager";

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
  imageHashes?: string[];
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
    } else if (keyLower.endsWith("_search_node") || keyLower.endsWith(".search")) {
      items.push({ id: currentPath, name: keyLower.endsWith(".search") ? key : key.replace(/_search_node$/i, ".search"), type: "search_node", pathStr: currentPath.replace(/^root\./, ""), realKey: key });
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
  _ignoredParsedData: any, // kept for signature compatibility from previous usage
  nodePath: string,
  taskId: string,
  updates: any | null // null means delete
) {
  const { parsedData, setCode, codeFormat } = useStore.getState();
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
    const syncTaskCompletionState = (tList: any[]): any[] => {
      return tList.map((t) => {
        let updatedTasks = t.tasks;
        if (t.tasks && t.tasks.length > 0) {
          updatedTasks = syncTaskCompletionState(t.tasks);
        }
        const hasChildren = updatedTasks && updatedTasks.length > 0;
        const hasIncomplete = hasChildren && updatedTasks.some((child: any) => !child.completed && child.status !== "Completed");
        return {
          ...t,
          tasks: updatedTasks,
          completed: hasChildren ? !hasIncomplete : t.completed,
          status: hasChildren ? (hasIncomplete ? "Todo" : "Completed") : t.status,
        };
      });
    };

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
      nodeObj.tasks = syncTaskCompletionState(walk(nodeObj.tasks));
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
      nodeObj.tasks = syncTaskCompletionState(walk(nodeObj.tasks));
    }
  }

  const finalVal = wasString ? JSON.stringify(nodeObj, null, 2) : nodeObj;
  const nextUpdatedData = setValueAtPath(updatedData, nodePath, finalVal);

  let newCode = "";
  if (codeFormat === "yaml") {
    try {
      const yaml = (await import("js-yaml")).default;
      newCode = yaml.dump(nextUpdatedData);
    } catch {
      newCode = JSON.stringify(nextUpdatedData, null, 2);
    }
  } else {
    newCode = JSON.stringify(nextUpdatedData, null, 2);
  }
  setCode(newCode);
  return nextUpdatedData;
}

export async function addNewTodoToWorkspace(
  _ignoredParsedData: any, // kept for signature compatibility
  nodePath: string,
  newTaskText: string,
  parentTaskId?: string
) {
  const { parsedData, setCode, codeFormat } = useStore.getState();
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
  const nextUpdatedData = setValueAtPath(updatedData, nodePath, finalVal);

  let newCode = "";
  if (codeFormat === "yaml") {
    try {
      const yaml = (await import("js-yaml")).default;
      newCode = yaml.dump(nextUpdatedData);
    } catch {
      newCode = JSON.stringify(nextUpdatedData, null, 2);
    }
  } else {
    newCode = JSON.stringify(nextUpdatedData, null, 2);
  }
  setCode(newCode);
  return nextUpdatedData;
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
  } else if (type === "search_node" || name.endsWith(".search")) {
    return <Search className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />;
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

const checkHasIncompleteChildren = (tasks?: any[]): boolean => {
  if (!tasks || tasks.length === 0) return false;
  return tasks.some((t: any) => {
    const isComp = t.completed || t.status === "Completed";
    if (!isComp) return true;
    return checkHasIncompleteChildren(t.tasks);
  });
};

const CustomDateInput = forwardRef<HTMLDivElement, any>(({ value, onClick, className, children }, ref) => (
  <div onClick={onClick} ref={ref} className={className}>
    {children}
  </div>
));

export default function ProductivityLayer() {
  const parsedData = useStore((s) => s.parsedData);
  const activeExplorerFile = useStore((s) => s.activeExplorerFile);
  const openWorkspaceTab = useStore((state) => state.openWorkspaceTab);
  const setExpandedJsNodeId = useStore((state) => state.setExpandedJsNodeId);

  // Dialog opened states
  const [isTodoOpen, setIsTodoOpen] = useState(false);
  const wasTodoOpenRef = useRef(false);
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
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirmingDeleteAll, setIsConfirmingDeleteAll] = useState(false);

  // New task creation states
  const [isCreatingTodo, setIsCreatingTodo] = useState(false);
  const [newTodoText, setNewTodoText] = useState("");
  const [isNewTodoFocused, setIsNewTodoFocused] = useState(false);
  const [isDetailTitleFocused, setIsDetailTitleFocused] = useState(false);
  const [selectedNodePath, setSelectedNodePath] = useState("");
  const [targetParentTaskId, setTargetParentTaskId] = useState("");

  // List/Todo Node Navigation & Default Selection states
  const [todoCenterMode, setTodoCenterMode] = useState<"nodes_list" | "tasks_list">("tasks_list");
  const [defaultTodoNodeId, setDefaultTodoNodeIdState] = useState<string | null>(() => 
    localStorage.getItem("productivity_default_todo_node")
  );

  const setDefaultTodoNodeId = (id: string | null) => {
    setDefaultTodoNodeIdState(id);
    if (id) {
      localStorage.setItem("productivity_default_todo_node", id);
    } else {
      localStorage.removeItem("productivity_default_todo_node");
    }
  };

  // Create new .todo node (list) states
  const [isCreatingTodoNode, setIsCreatingTodoNode] = useState(false);
  const [newTodoNodeName, setNewTodoNodeName] = useState("");

  // Dropdown open states
  const [isDefaultDropdownOpen, setIsDefaultDropdownOpen] = useState(false);
  const [isDetailDefaultDropdownOpen, setIsDetailDefaultDropdownOpen] = useState(false);

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
    const todosForNode = selectedNodePath
      ? allWorkspaceTodos.filter(t => t.nodePath === selectedNodePath)
      : allWorkspaceTodos;

    if (!todoSearch.trim()) {
      // Default grouping order: Overdue first, then High priority, then Pinned, then Chronological Active
      return todosForNode;
    }

    const q = todoSearch.toLowerCase().trim();
    const matched = todosForNode
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
  }, [allWorkspaceTodos, todoSearch, selectedNodePath]);

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
    if (todoCenterMode === "nodes_list") {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedTodoIdx((prev) => (prev + 1) % Math.max(1, allTodoFiles.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedTodoIdx((prev) => (prev - 1 + allTodoFiles.length) % Math.max(1, allTodoFiles.length));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const target = allTodoFiles[selectedTodoIdx];
        if (target) {
          setSelectedNodePath(target.id);
          setTodoCenterMode("tasks_list");
          setSelectedTodoIdx(0);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIsTodoOpen(false);
      }
    } else {
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
    const hasIncompleteChildren = checkHasIncompleteChildren(task.tasks);

    if (!isCompleted && hasIncompleteChildren) {
      useStore.getState().setNotification?.({
        message: "Complete subtasks first",
        type: "info",
      });
      return;
    }

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

  const handleMediaUpload = async (files: FileList | File[]) => {
    if (!activeTodo) return;
    setIsUploading(true);
    try {
      const hashes = [...(activeTodo.imageHashes || [])];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/')) {
          const { assetId } = await importFile(file);
          if (!hashes.includes(assetId)) {
            hashes.push(assetId);
          }
        }
      }
      if (hashes.length !== (activeTodo.imageHashes || []).length) {
        await handleUpdateTodoField(activeTodo.id, activeTodo.nodePath, "imageHashes", hashes);
      }
    } catch (err) {
      console.error("Paste/Upload failed", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteMedia = async (index: number) => {
    if (!activeTodo || !activeTodo.imageHashes) return;
    const hashes = [...activeTodo.imageHashes];
    hashes.splice(index, 1);
    await handleUpdateTodoField(activeTodo.id, activeTodo.nodePath, "imageHashes", hashes);
  };

  const handleDeleteAllMedia = async () => {
    if (!activeTodo) return;
    await handleUpdateTodoField(activeTodo.id, activeTodo.nodePath, "imageHashes", []);
    setIsConfirmingDeleteAll(false);
  };

  const handlePreviewMedia = async (index: number) => {
    if (!activeTodo || !activeTodo.imageHashes) return;
    const hash = activeTodo.imageHashes[index];
    
    let type: "image" | "video" | "audio" | "smart" = "smart";
    const lowerHash = hash.toLowerCase();
    if (lowerHash.endsWith('.mp4') || lowerHash.endsWith('.mov') || lowerHash.endsWith('.webm')) type = "video";
    else if (lowerHash.endsWith('.mp3') || lowerHash.endsWith('.wav') || lowerHash.endsWith('.ogg')) type = "audio";
    else if (lowerHash.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) type = "image";
    else if (hash.startsWith('img_')) type = "image"; // Assets starting with img_ are usually images

    useStore.getState().setActivePreviewMedia({ url: hash, type });
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (!activeTodo) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      handleMediaUpload(files);
    }
  };

  const allTodoFiles = useMemo(() => {
    return allWorkspaceFiles.filter(f => f.type === "todo_node" || f.name.endsWith(".todo"));
  }, [allWorkspaceFiles]);

  useEffect(() => {
    if (isTodoOpen && !wasTodoOpenRef.current) {
      if (allTodoFiles.length === 0) {
        setTodoCenterMode("tasks_list");
      } else if (allTodoFiles.length === 1) {
        setSelectedNodePath(allTodoFiles[0].id);
        setTodoCenterMode("tasks_list");
      } else {
        const foundDefault = allTodoFiles.find(f => f.id === defaultTodoNodeId);
        if (foundDefault) {
          setSelectedNodePath(foundDefault.id);
          setTodoCenterMode("tasks_list");
        } else {
          setTodoCenterMode("nodes_list");
          setSelectedTodoIdx(0);
        }
      }
    }
    wasTodoOpenRef.current = isTodoOpen;
  }, [isTodoOpen, allTodoFiles, defaultTodoNodeId]);

  const handleCreateTodoNodeSubmit = async () => {
    if (!newTodoNodeName.trim()) return;
    try {
      const cleanName = newTodoNodeName.trim();
      const finalKey = cleanName.replace(/\s+/g, "_") + "_todo_node";
      const initialValue = JSON.stringify({ title: cleanName, tasks: [] }, null, 2);
      
      const { parsedData, setCode, codeFormat } = useStore.getState();
      const updatedData = JSON.parse(JSON.stringify(parsedData));
      
      const nextUpdatedData = setValueAtPath(updatedData, `root.${finalKey}`, initialValue);
      
      let newCode = "";
      if (codeFormat === "yaml") {
        try {
          const yaml = (await import("js-yaml")).default;
          newCode = yaml.dump(nextUpdatedData);
        } catch {
          newCode = JSON.stringify(nextUpdatedData, null, 2);
        }
      } else {
        newCode = JSON.stringify(nextUpdatedData, null, 2);
      }
      setCode(newCode);
      
      const newPathId = `root.${finalKey}`;
      setSelectedNodePath(newPathId);
      setNewTodoNodeName("");
      setIsCreatingTodoNode(false);
      setTodoCenterMode("tasks_list");
    } catch (err) {
      console.error(err);
    }
  };

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
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z" || e.key === "y" || e.key === "Y")) {
                        e.stopPropagation();
                      }
                      handleFileKeyDown(e);
                    }}
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
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z" || e.key === "y" || e.key === "Y")) {
                        e.stopPropagation();
                      }
                      handleTodoKeyDown(e);
                    }}
                    placeholder={
                      todoCenterMode === "nodes_list"
                        ? "Navigate through lists (arrow keys)..."
                        : "Search tasks, filter by Priority, Status, Label (Alt + T to close)..."
                    }
                    className="w-full text-sm font-sans bg-transparent border-none outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-550"
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        setIsCreatingTodoNode(prev => !prev);
                        setIsCreatingTodo(false);
                      }}
                      className={cn(
                        "px-2 py-1 text-[10px] font-bold rounded font-mono uppercase tracking-wider transition-colors flex items-center gap-1",
                        isCreatingTodoNode
                          ? "bg-amber-600 text-white"
                          : "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                      )}
                    >
                      + New List
                    </button>
                    {todoCenterMode === "tasks_list" && allTodoFiles.length > 0 && (
                      <button
                        onClick={() => {
                          setIsCreatingTodo(prev => !prev);
                          setIsCreatingTodoNode(false);
                        }}
                        className={cn(
                          "px-2 py-1 text-[10px] font-bold rounded font-mono uppercase tracking-wider transition-colors flex items-center gap-1",
                          isCreatingTodo
                            ? "bg-emerald-600 text-white"
                            : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                        )}
                      >
                        + Create
                      </button>
                    )}
                    {todoCenterMode === "tasks_list" && allTodoFiles.length > 0 && (
                      <button
                        onClick={() => setTodoViewMode(prev => prev === "tree" ? "flat" : "tree")}
                        className={cn("px-2 py-1 text-[10px] font-bold rounded font-mono uppercase tracking-wider transition-colors", todoViewMode === "tree" ? "bg-blue-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500")}
                      >
                        {todoViewMode === "tree" ? "Tree View" : "Flat List"}
                      </button>
                    )}
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-500 font-bold font-mono ml-2">
                      Alt + T
                    </div>
                  </div>
                </div>

                {isCreatingTodoNode && (
                  <div className="px-4 py-3.5 bg-slate-50 dark:bg-[#111622] border-b border-slate-100 dark:border-slate-800/80 flex flex-col gap-3 select-none animate-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-500 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping shrink-0" />
                        Create New Todo List
                      </span>
                      <button 
                        onClick={() => setIsCreatingTodoNode(false)} 
                        className="text-slate-450 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 w-full">
                      <input
                        type="text"
                        autoFocus
                        value={newTodoNodeName}
                        onChange={(e) => setNewTodoNodeName(e.target.value)}
                        placeholder="Type list name (e.g. Work, Personal)..."
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleCreateTodoNodeSubmit();
                          }
                        }}
                        className="flex-1 text-xs bg-white dark:bg-[#161d2b] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 outline-none text-slate-850 dark:text-slate-200 placeholder-slate-400 focus:border-amber-500 transition-colors"
                      />
                      <button
                        onClick={handleCreateTodoNodeSubmit}
                        disabled={!newTodoNodeName.trim()}
                        className="p-2.5 px-4 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-colors shrink-0 cursor-pointer bg-amber-600 hover:bg-amber-500"
                      >
                        Create
                      </button>
                    </div>
                  </div>
                )}

                {/* Subheader for current todo list in tasks_list mode */}
                {todoCenterMode === "tasks_list" && allTodoFiles.length > 0 && (
                  <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-[#0c1017] border-b border-slate-100 dark:border-slate-800/80 text-[11px]">
                    <div className="flex items-center gap-2 text-slate-650 dark:text-slate-400">
                      {allTodoFiles.length > 1 && (
                        <button
                          onClick={() => setTodoCenterMode("nodes_list")}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-150 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 font-bold text-[9px] text-slate-600 dark:text-slate-300 transition cursor-pointer"
                        >
                          <ChevronLeft size={10} />
                          All Lists
                        </button>
                      )}
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {allTodoFiles.find(f => f.id === selectedNodePath)?.name || "Task List"}
                      </span>
                      {allTodoFiles.length > 1 && (
                        <button
                          onClick={() => {
                            if (selectedNodePath) {
                              setDefaultTodoNodeId(defaultTodoNodeId === selectedNodePath ? null : selectedNodePath);
                            }
                          }}
                          className="text-amber-500 hover:scale-110 active:scale-95 transition-transform"
                          title={defaultTodoNodeId === selectedNodePath ? "Remove as default list" : "Set as default list"}
                        >
                          <Star 
                            size={12} 
                            fill={defaultTodoNodeId === selectedNodePath ? "currentColor" : "none"} 
                            className={cn(defaultTodoNodeId === selectedNodePath ? "text-amber-500 animate-pulse" : "text-slate-300 dark:text-slate-600")}
                          />
                        </button>
                      )}
                    </div>
                    
                    {allTodoFiles.length > 1 && (
                      <div className="flex items-center gap-1.5 font-mono text-[9px] text-slate-400 relative">
                        <span>Default:</span>
                        <div className="relative">
                          <button
                            onClick={() => setIsDefaultDropdownOpen(prev => !prev)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-350 hover:border-amber-500/50 hover:text-slate-800 dark:hover:text-slate-200 transition-colors font-sans text-[10px] font-semibold cursor-pointer shrink-0"
                          >
                            <span className="truncate max-w-[80px]">
                              {allTodoFiles.find(f => f.id === defaultTodoNodeId)?.name || "(None)"}
                            </span>
                            <ChevronDown size={10} className="text-slate-400" />
                          </button>
                          
                          <AnimatePresence>
                            {isDefaultDropdownOpen && (
                              <>
                                {/* Backdrop click listener */}
                                <div className="fixed inset-0 z-40" onClick={() => setIsDefaultDropdownOpen(false)} />
                                
                                <motion.div
                                  initial={{ opacity: 0, y: -4, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: -4, scale: 0.95 }}
                                  transition={{ duration: 0.1 }}
                                  className="absolute right-0 mt-1.5 w-36 bg-white dark:bg-[#161d2b] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1 z-50 text-[10px] font-sans text-slate-750 dark:text-slate-300 overflow-hidden"
                                >
                                  <button
                                    onClick={() => {
                                      setDefaultTodoNodeId(null);
                                      setIsDefaultDropdownOpen(false);
                                    }}
                                    className={cn(
                                      "w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between cursor-pointer transition-colors font-medium",
                                      !defaultTodoNodeId && "text-amber-500 font-bold bg-amber-500/5 dark:bg-amber-500/10"
                                    )}
                                  >
                                    <span>(None)</span>
                                    {!defaultTodoNodeId && <Check size={11} className="text-amber-500 shrink-0" />}
                                  </button>
                                  {allTodoFiles.map(f => {
                                    const isSelected = f.id === defaultTodoNodeId;
                                    return (
                                      <button
                                        key={f.id}
                                        onClick={() => {
                                          setDefaultTodoNodeId(f.id);
                                          setIsDefaultDropdownOpen(false);
                                        }}
                                        className={cn(
                                          "w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between cursor-pointer transition-colors truncate font-medium",
                                          isSelected && "text-amber-500 font-bold bg-amber-500/5 dark:bg-amber-500/10"
                                        )}
                                      >
                                        <span className="truncate mr-2">{f.name}</span>
                                        {isSelected && <Check size={11} className="text-amber-500 shrink-0" />}
                                      </button>
                                    );
                                  })}
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    )}
                  </div>
                )}

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
                            <option key={file.id} value={file.id} className="bg-white dark:bg-[#161d2b] text-slate-800 dark:text-slate-100">
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
                          <option value="" className="bg-white dark:bg-[#161d2b] text-slate-800 dark:text-slate-100">None (Top Level Root Task)</option>
                          {allWorkspaceTodos
                            .filter((t) => t.nodePath === selectedNodePath)
                            .map((t) => (
                              <option key={t.id} value={t.id} className="bg-white dark:bg-[#161d2b] text-slate-800 dark:text-slate-100">
                                {"— ".repeat(t.depth || 0)}{t.text}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    {/* Task text bar and Submit button */}
                    <div className="flex items-center gap-2 w-full">
                      <div className="relative flex-1 flex items-center">
                        <input
                          type="text"
                          maxLength={100}
                          value={newTodoText}
                          onChange={(e) => setNewTodoText(e.target.value)}
                          onFocus={() => setIsNewTodoFocused(true)}
                          onBlur={() => setIsNewTodoFocused(false)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleCreateTodoSubmit();
                            }
                          }}
                          placeholder="Type task details and press Enter to save..."
                          className="w-full text-xs bg-white dark:bg-[#161d2b] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 outline-none text-slate-850 dark:text-slate-200 placeholder-slate-400 focus:border-blue-500 transition-colors pr-16"
                        />
                        {isNewTodoFocused && (
                          <span className="absolute right-3 text-[9px] font-mono font-bold text-blue-500 bg-blue-50 dark:bg-blue-950/60 px-1 py-0.5 rounded border border-blue-150 dark:border-blue-900 pointer-events-none select-none z-10 animate-in fade-in duration-100 animate-out fade-out">
                            Max: 100 | Remaining: {100 - newTodoText.length}
                          </span>
                        )}
                      </div>
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
                  {allTodoFiles.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center gap-3">
                      <ClipboardList size={32} className="text-slate-300 dark:text-slate-700 animate-bounce" />
                      <div className="text-sm font-bold text-slate-700 dark:text-slate-300">No Todo Lists Found</div>
                      <span className="text-xs max-w-[320px] leading-relaxed">
                        Create your first todo list below to start adding tasks and organizing your workspace.
                      </span>
                      <div className="flex flex-col gap-2 w-full max-w-[320px] mt-2">
                        <input
                          type="text"
                          value={newTodoNodeName}
                          onChange={(e) => setNewTodoNodeName(e.target.value)}
                          placeholder="Type list name (e.g. Tasks, Work)..."
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleCreateTodoNodeSubmit();
                            }
                          }}
                          className="w-full text-xs bg-white dark:bg-[#161d2b] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 outline-none text-slate-850 dark:text-slate-200 placeholder-slate-400 text-center"
                        />
                        <button
                          onClick={handleCreateTodoNodeSubmit}
                          disabled={!newTodoNodeName.trim()}
                          className="w-full p-2.5 text-white text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-500 transition-colors disabled:opacity-40"
                        >
                          Create First Todo List
                        </button>
                      </div>
                    </div>
                  ) : todoCenterMode === "nodes_list" ? (
                    <div className="px-2.5 py-1.5 space-y-1">
                      <div className="px-3.5 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Select a Todo List to view tasks
                      </div>
                      {allTodoFiles.map((file, idx) => {
                        const isSelected = idx === selectedTodoIdx;
                        const isDefault = file.id === defaultTodoNodeId;
                        
                        // Count tasks in this list
                        const listTasks = allWorkspaceTodos.filter(t => t.nodePath === file.id);
                        const completedCount = listTasks.filter(t => t.completed || t.status === "Completed").length;
                        
                        return (
                          <motion.div
                            key={file.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                              "is-selected-todo flex items-center justify-between px-4 py-3 cursor-pointer transition-all relative select-none mx-1 my-0.5 rounded-xl border group",
                              isSelected
                                ? "bg-amber-600/15 border-amber-500/30 dark:bg-amber-600/20 dark:border-amber-500/40 shadow-[0_0_15px_-5px_rgba(245,158,11,0.3)]"
                                : "bg-white dark:bg-[#0d1117]/50 border-slate-200/60 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                            )}
                            onClick={() => {
                              setSelectedNodePath(file.id);
                              setTodoCenterMode("tasks_list");
                              setSelectedTodoIdx(0);
                            }}
                          >
                            {isSelected && (
                              <div className="absolute left-0 top-3 bottom-3 w-1 bg-amber-500 rounded-r-full shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                            )}
                            
                            <div className="flex items-center gap-3.5 min-w-0">
                              <ClipboardList size={16} className={cn(isSelected ? "text-amber-500" : "text-slate-400")} />
                              <div className="flex flex-col min-w-0 leading-tight">
                                <span className={cn(
                                  "text-xs font-semibold truncate",
                                  isSelected ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"
                                )}>
                                  {file.name}
                                </span>
                                <span className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                  {listTasks.length === 0 ? "No tasks" : `${completedCount}/${listTasks.length} tasks completed`}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {isDefault && (
                                <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                                  <Star size={10} fill="currentColor" />
                                  Default
                                </span>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDefaultTodoNodeId(isDefault ? null : file.id);
                                }}
                                className={cn(
                                  "p-1.5 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-slate-100 dark:hover:bg-slate-800",
                                  isDefault ? "opacity-100 text-amber-500" : "text-slate-400 hover:text-amber-500"
                                )}
                                title={isDefault ? "Remove as default" : "Set as default"}
                              >
                                <Star size={13} fill={isDefault ? "currentColor" : "none"} />
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : filteredTodos.length === 0 ? (
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
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.02 }}
                            className={cn(
                              "is-selected-todo flex items-center justify-between px-4 py-3 cursor-pointer transition-all relative select-none mx-2.5 my-1 rounded-xl border group",
                              isSelected
                                ? "bg-blue-600/15 border-blue-500/30 dark:bg-blue-600/20 dark:border-blue-500/40 shadow-[0_0_15px_-5px_rgba(59,130,246,0.3)]"
                                : "bg-white dark:bg-[#0d1117]/50 border-slate-200/60 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                            )}
                            style={todoViewMode === "tree" && !todoSearch.trim() ? { marginLeft: `${Math.max(0.6, (todo.depth || 0) * 1.5 + 0.6)}rem` } : {}}
                            onClick={() => {
                              setActiveTodo(todo);
                            }}
                          >
                            {isSelected && (
                              <div className="absolute left-0 top-3 bottom-3 w-1 bg-blue-500 rounded-r-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                            )}
                            
                            <div className="flex items-center gap-4 min-w-0 pr-4">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleTodoStatus(todo);
                                }}
                                className={cn(
                                  "transition-all duration-300 shrink-0", 
                                  (!isCompleted && checkHasIncompleteChildren(todo.tasks))
                                    ? "opacity-30 cursor-not-allowed"
                                    : "hover:scale-110 active:scale-95"
                                )}
                                title={!isCompleted && checkHasIncompleteChildren(todo.tasks) ? "Complete subtasks first" : isCompleted ? "Mark Pending" : "Mark Completed"}
                              >
                                {isCompleted ? (
                                  <CheckCircle2 size={18} className="text-emerald-500 drop-shadow-sm" />
                                ) : (
                                  <Circle size={18} className={cn(isSelected ? "text-blue-500" : "text-slate-300 dark:text-slate-600")} />
                                )}
                              </button>
                              
                              <div className="flex flex-col min-w-0">
                                <span className={cn(
                                  "text-[13px] font-semibold truncate tracking-tight transition-all",
                                  isSelected ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300",
                                  isCompleted && "line-through opacity-40 font-normal"
                                )}>
                                  {todo.text || <em className="font-mono text-[10px] opacity-50">unlabeled task</em>}
                                </span>
                                
                                <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                                  <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-tight">
                                    <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                                    {todo.nodeName}
                                  </div>
                                  
                                  {todo.priority && todo.priority !== "Normal" && (
                                    <span className={cn(
                                      "text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md leading-none",
                                      priorityBg
                                    )}>
                                      {todo.priority}
                                    </span>
                                  )}
                                  
                                  {todo.dueDate && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-md font-mono shrink-0 flex items-center gap-1 bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                      <CalendarIcon size={10} />
                                      {todo.dueDate}
                                    </span>
                                  )}
                                </div>
                                
                                {todo.imageHashes && todo.imageHashes.length > 0 && (
                                  <div className="mt-2.5 rounded-lg overflow-hidden border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
                                    <TaskImagePreview imageHashes={todo.imageHashes} compact={true} />
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap shrink-0">
                              <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1 mr-1">
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
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all active:scale-90"
                                  title="Add Subtask"
                                >
                                  <Plus size={14} />
                                </button>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await handleDeleteTodo(todo);
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all active:scale-90"
                                  title="Delete Task"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>

                              {(todo.tags || []).slice(0, 2).map((tag, tagIdx) => (
                                <span key={`${tag}-${tagIdx}`} className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-800/50 select-none font-mono">
                                  {tag}
                                </span>
                              ))}
                              
                              {isSelected && (
                                <div className="flex items-center gap-1.5 ml-2 px-2 py-1 rounded-md bg-blue-500 text-white shadow-sm ring-1 ring-blue-400 animate-in fade-in zoom-in duration-200">
                                  <span className="text-[9px] font-bold uppercase tracking-tighter font-mono">view</span>
                                  <ExternalLink size={10} />
                                </div>
                              )}
                            </div>
                          </motion.div>

                          <AnimatePresence>
                            {inlineSubParentId === todo.id && (
                              <motion.div 
                                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                animate={{ opacity: 1, height: 'auto', marginTop: 4 }}
                                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                className="overflow-hidden"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="px-3 sm:px-8 pb-4">
                                  <div className="bg-slate-50/50 dark:bg-slate-900/20 border border-slate-200/80 dark:border-slate-800/60 rounded-2xl p-4 shadow-inner">
                                    <div className="border border-slate-200 dark:border-slate-700/50 rounded-xl overflow-hidden bg-white dark:bg-[#0d1117] flex flex-col shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500/50 transition-all">
                                      <textarea
                                        maxLength={100}
                                        autoFocus
                                        rows={1}
                                        value={inlineSubText}
                                        onChange={(e) => setInlineSubText(e.target.value)}
                                        onInput={(e) => {
                                          const target = e.target as HTMLTextAreaElement;
                                          target.style.height = 'auto';
                                          target.style.height = `${target.scrollHeight}px`;
                                        }}
                                        onKeyDown={async (e) => {
                                          if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
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
                                            setInlineSubText("");
                                          }
                                        }}
                                        placeholder="What needs to be done?"
                                        className="w-full bg-transparent p-4 text-[13px] text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 outline-none resize-none min-h-[50px] transition-height duration-200 font-medium pr-16"
                                      />
                                      <div className="flex justify-between items-center px-3 py-2 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800/50">
                                        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono pl-1">
                                          <div className="flex items-center gap-1.5">
                                            <span className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 uppercase tracking-tighter">Esc</span>
                                            <span>to cancel</span>
                                          </div>
                                          <div className="w-px h-3 bg-slate-200 dark:bg-slate-700" />
                                          <div className="text-blue-500 font-bold">
                                            {inlineSubText.length}/100
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => {
                                              setInlineSubParentId(null);
                                              setInlineSubText("");
                                            }}
                                            className="px-4 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-all uppercase tracking-wider"
                                          >
                                            Cancel
                                          </button>
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
                                            className="flex items-center gap-2 px-5 py-2 rounded-lg text-[11px] font-extrabold bg-blue-600 hover:bg-blue-500 active:scale-95 text-white transition-all shadow-md shadow-blue-500/20 uppercase tracking-widest ring-1 ring-blue-400/50"
                                          >
                                            <Check size={14} strokeWidth={3} />
                                            Add Subtask
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
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
              className="fixed inset-0 z-[11500] w-screen h-screen flex items-center justify-center bg-slate-950/60 dark:bg-black/90 backdrop-blur-md p-4 text-slate-800 dark:text-slate-200"
              onClick={() => setActiveTodo(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 30 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="w-full max-w-[680px] bg-white/95 dark:bg-[#0d1117]/95 backdrop-blur-2xl rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
                onPaste={handlePaste}
              >
                {/* Header controls layout */}
                <div className="px-5 py-4 bg-slate-50/50 dark:bg-[#0f141d]/50 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between shrink-0 select-none">
                  <div className="flex items-center text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-widest font-mono uppercase truncate mr-4">
                    <button
                      onClick={() => setActiveTodo(null)}
                      className="p-2 mr-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 hover:text-blue-500 shadow-sm transition-all"
                    >
                      <ArrowLeft size={14} strokeWidth={2.5} />
                    </button>
                    <div className="flex items-center gap-1.5 truncate">
                      <ClipboardList size={14} className="text-blue-500" />
                      <span className="truncate">{activeTodo.nodeName}</span>
                      <span className="opacity-30">/</span>
                      <span className="text-slate-500 dark:text-slate-400">Detail</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        openWorkspaceTab(activeTodo.nodePath, true);
                        setExpandedJsNodeId(activeTodo.nodePath);
                        setIsTodoOpen(false);
                        setActiveTodo(null);
                      }}
                      className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 hover:text-blue-500 shadow-sm transition-all"
                      title="Open in Workspace"
                    >
                      <ExternalLink size={14} strokeWidth={2.5} />
                    </button>
                    <button
                      onClick={() => handleToggleTodoStatus(activeTodo)}
                      className={cn(
                        "px-4 py-2 rounded-xl border-2 font-bold text-[11px] uppercase tracking-widest flex items-center gap-2 transition-all shadow-sm active:scale-95",
                        activeTodo.completed || activeTodo.status === "Completed"
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/15"
                          : "bg-blue-600 text-white border-transparent hover:bg-blue-500 shadow-blue-500/20"
                      )}
                    >
                      {activeTodo.completed || activeTodo.status === "Completed" ? (
                        <>
                          <CheckCircle2 size={14} strokeWidth={3} />
                          <span>Done</span>
                        </>
                      ) : (
                        <>
                          <Circle size={14} strokeWidth={3} />
                          <span>Mark Complete</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteTodo(activeTodo)}
                      className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-rose-500/10 hover:border-rose-500 hover:text-rose-500 shadow-sm transition-all"
                    >
                      <Trash2 size={14} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>

                {/* Body Content Editor */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 custom-scrollbar">
                  {/* Title editor */}
                  <div className="space-y-2 relative">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-[0.15em] select-none px-1">
                        Task Title
                      </label>
                      {isDetailTitleFocused && (
                        <span className="text-[10px] font-mono font-bold text-blue-500 bg-blue-100/60 dark:bg-blue-950/40 px-1.5 py-0.5 rounded shadow-sm border border-blue-200/55 dark:border-blue-900/60 pointer-events-none select-none animate-in fade-in duration-100">
                          Max: 100 | Remaining: {100 - (activeTodo.text || "").length}
                        </span>
                      )}
                    </div>
                    <textarea
                      maxLength={100}
                      rows={1}
                      autoFocus
                      value={activeTodo.text || ""}
                      onChange={(e) => handleUpdateTodoField(activeTodo.id, activeTodo.nodePath, "text", e.target.value)}
                      onFocus={() => setIsDetailTitleFocused(true)}
                      onBlur={() => setIsDetailTitleFocused(false)}
                      ref={(el) => {
                        if (el) {
                          el.style.height = 'auto';
                          el.style.height = `${el.scrollHeight}px`;
                        }
                      }}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = `${target.scrollHeight}px`;
                      }}
                      placeholder="Task Headline..."
                      className="w-full text-2xl sm:text-3xl font-black bg-transparent border-none outline-none text-slate-900 dark:text-white py-1 focus:ring-0 resize-none placeholder-slate-200 dark:placeholder-slate-800 leading-[1.1] transition-all px-1 overflow-hidden"
                    />
                  </div>

                  {/* Attributes Box Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/50 dark:bg-slate-900/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                    <div className="space-y-3">
                      {/* Priority */}
                      <div className="flex items-center justify-between group">
                        <div className="flex items-center gap-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          <AlertCircle size={13} className="text-blue-500" />
                          <span>Priority</span>
                        </div>
                        <InlineDropdown
                          value={activeTodo.priority || "Normal"}
                          onChange={(val: string) => handleUpdateTodoField(activeTodo.id, activeTodo.nodePath, "priority", val)}
                          options={PRIORITY_OPTIONS}
                          defaultLabel="Normal"
                          variant="priority"
                        />
                      </div>

                      {/* Status */}
                      <div className="flex items-center justify-between group">
                        <div className="flex items-center gap-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          <Layers size={13} className="text-indigo-500" />
                          <span>Status</span>
                        </div>
                        <InlineDropdown
                          value={activeTodo.status || "Todo"}
                          onChange={(val: string) => handleUpdateTodoField(activeTodo.id, activeTodo.nodePath, "status", val)}
                          options={STATUS_OPTIONS}
                          defaultLabel="Todo"
                        />
                      </div>
                    </div>

                    <div className="space-y-3 pt-3 sm:pt-0 sm:border-l border-slate-200 dark:border-slate-800 sm:pl-4">
                      {/* Target Date */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          <CalendarIcon size={13} className="text-rose-500" />
                          <span>Deadline</span>
                        </div>
                        <div className="relative group">
                          <SmartDatePicker
                            selected={activeTodo.dueDate ? parseISO(activeTodo.dueDate) : null}
                            onChange={(date: Date | null) => {
                              const dateString = date ? format(date, "yyyy-MM-dd") : null;
                              handleUpdateTodoField(activeTodo.id, activeTodo.nodePath, "dueDate", dateString);
                            }}
                          >
                            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:border-blue-500/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
                              {activeTodo.dueDate ? format(parseISO(activeTodo.dueDate), "MMM dd, yyyy") : "dd / mm / yyyy"}
                            </button>
                          </SmartDatePicker>
                        </div>
                      </div>

                      {/* Last Modified (Placeholder for context) */}
                      <div className="flex items-center justify-between opacity-50">
                        <div className="flex items-center gap-2.5 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                          <Sparkles size={13} />
                          <span>Auto-save</span>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-slate-400">ACTIVE</span>
                      </div>

                      {/* Default Todo Node / List selector (when multiple exist) */}
                      {allTodoFiles.length > 1 && (
                        <div className="flex items-center justify-between pt-2 border-t border-slate-150 dark:border-slate-800/80 relative">
                          <div className="flex items-center gap-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            <Star size={13} className="text-amber-500" fill={defaultTodoNodeId === activeTodo.nodePath ? "currentColor" : "none"} />
                            <span>Default List</span>
                          </div>
                          <div className="relative">
                            <button
                              onClick={() => setIsDetailDefaultDropdownOpen(prev => !prev)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-500/50 hover:text-slate-900 dark:hover:text-slate-100 transition-colors font-sans text-[11px] font-bold cursor-pointer"
                            >
                              <span className="truncate max-w-[120px]">
                                {allTodoFiles.find(f => f.id === defaultTodoNodeId)?.name || "None (Always Select)"}
                              </span>
                              <ChevronDown size={11} className="text-slate-400" />
                            </button>
                            
                            <AnimatePresence>
                              {isDetailDefaultDropdownOpen && (
                                <>
                                  {/* Backdrop click listener */}
                                  <div className="fixed inset-0 z-40" onClick={() => setIsDetailDefaultDropdownOpen(false)} />
                                  
                                  <motion.div
                                    initial={{ opacity: 0, y: 4, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 4, scale: 0.95 }}
                                    transition={{ duration: 0.1 }}
                                    className="absolute right-0 bottom-full mb-1.5 w-44 bg-white dark:bg-[#161d2b] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1 z-50 text-[11px] font-sans text-slate-750 dark:text-slate-300 overflow-hidden"
                                  >
                                    <button
                                      onClick={() => {
                                        setDefaultTodoNodeId(null);
                                        setIsDetailDefaultDropdownOpen(false);
                                      }}
                                      className={cn(
                                        "w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between cursor-pointer transition-colors font-medium",
                                        !defaultTodoNodeId && "text-amber-500 font-bold bg-amber-500/5 dark:bg-amber-500/10"
                                      )}
                                    >
                                      <span>None (Always Select)</span>
                                      {!defaultTodoNodeId && <Check size={12} className="text-amber-500 shrink-0" />}
                                    </button>
                                    {allTodoFiles.map(f => {
                                      const isSelected = f.id === defaultTodoNodeId;
                                      return (
                                        <button
                                          key={f.id}
                                          onClick={() => {
                                            setDefaultTodoNodeId(f.id);
                                            setIsDetailDefaultDropdownOpen(false);
                                          }}
                                          className={cn(
                                            "w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between cursor-pointer transition-colors truncate font-medium",
                                            isSelected && "text-amber-500 font-bold bg-amber-500/5 dark:bg-amber-500/10"
                                          )}
                                        >
                                          <span className="truncate mr-2">{f.name}</span>
                                          {isSelected && <Check size={12} className="text-amber-500 shrink-0" />}
                                        </button>
                                      );
                                    })}
                                  </motion.div>
                                </>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Attached Media Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                      <label className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-[0.2em] select-none flex items-center gap-2 shrink-0">
                        <Hash size={12} strokeWidth={3} className="text-emerald-500" />
                        Attached Media
                      </label>
                      <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                      {activeTodo.imageHashes && activeTodo.imageHashes.length > 0 && (
                        <div className="flex items-center gap-1">
                          {isConfirmingDeleteAll ? (
                            <div className="flex items-center gap-1 bg-rose-500/10 rounded-lg p-0.5 animate-in slide-in-from-right-2">
                               <button 
                                 onClick={handleDeleteAllMedia}
                                 className="px-2 py-1 text-[9px] font-bold text-rose-500 hover:bg-rose-500 hover:text-white rounded transition-colors"
                               >
                                 Confirm Delete All
                               </button>
                               <button 
                                 onClick={() => setIsConfirmingDeleteAll(false)}
                                 className="px-2 py-1 text-[9px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                               >
                                 Cancel
                               </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => setIsConfirmingDeleteAll(true)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                              title="Delete all media"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-4">
                      {activeTodo.imageHashes && activeTodo.imageHashes.length > 0 ? (
                        <div className="space-y-4">
                           <TaskImagePreview 
                             imageHashes={activeTodo.imageHashes} 
                             compact={false} 
                             onDelete={handleDeleteMedia}
                             onPreview={handlePreviewMedia}
                           />
                           <div className="flex items-center gap-2">
                             <button 
                               onClick={() => {
                                 const input = document.createElement('input');
                                 input.type = 'file';
                                 input.multiple = true;
                                 input.accept = 'image/*,video/*,audio/*';
                                 input.onchange = (e: any) => {
                                   if (e.target.files) handleMediaUpload(e.target.files);
                                 };
                                 input.click();
                               }}
                               disabled={isUploading}
                               className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:text-blue-500 hover:border-blue-500/50 transition-all shadow-sm"
                             >
                                <Upload size={14} strokeWidth={2.5} />
                                {isUploading ? "Uploading..." : "Add More Media"}
                             </button>
                             <button 
                               onClick={() => setIsCameraOpen(true)}
                               className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-emerald-500 hover:border-emerald-500/50 transition-all shadow-sm"
                             >
                                <Camera size={16} strokeWidth={2.5} />
                             </button>
                           </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 gap-4">
                          <div className="flex gap-4">
                            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                              <ImageIcon size={24} />
                            </div>
                            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                              <Video size={24} />
                            </div>
                            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                              <Music size={24} />
                            </div>
                          </div>
                          <div className="text-center space-y-1">
                            <h4 className="text-[13px] font-bold text-slate-700 dark:text-slate-200">No media attached</h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-500">Upload images, videos, or record a clip</p>
                          </div>
                          <div className="flex items-center gap-2 w-full max-w-[280px]">
                            <button 
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.multiple = true;
                                input.accept = 'image/*,video/*,audio/*';
                                input.onchange = (e: any) => {
                                  if (e.target.files) handleMediaUpload(e.target.files);
                                };
                                input.click();
                              }}
                              disabled={isUploading}
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-[11px] hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
                            >
                               <Upload size={14} strokeWidth={2.5} />
                               {isUploading ? "Uploading..." : "Upload File"}
                            </button>
                            <button 
                              onClick={() => setIsCameraOpen(true)}
                              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:text-emerald-500 hover:border-emerald-500/50 transition-all shadow-sm"
                            >
                               <Camera size={16} strokeWidth={2.5} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes / Description */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-[0.15em] select-none flex items-center gap-2">
                        Notes & Description
                      </label>
                      <button
                        onClick={() => setIsEditingNotes(!isEditingNotes)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border shadow-sm",
                          isEditingNotes 
                            ? "bg-blue-600 text-white border-transparent" 
                            : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-blue-500/50 hover:text-blue-500"
                        )}
                      >
                        {isEditingNotes ? (
                          <><Eye size={12} strokeWidth={3} /> Save View</>
                        ) : (
                          <><Edit2 size={12} strokeWidth={3} /> Write Mode</>
                        )}
                      </button>
                    </div>
                    
                    <div className="relative group" onPaste={handlePaste}>
                      {isEditingNotes ? (
                        <textarea
                          rows={6}
                          value={activeTodo.notes || ""}
                          onChange={(e) => handleUpdateTodoField(activeTodo.id, activeTodo.nodePath, "notes", e.target.value)}
                          onPaste={handlePaste}
                          placeholder="Strategize, plan, and document..."
                          className="w-full text-sm font-medium bg-white dark:bg-[#090c12] border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-5 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder-slate-300 dark:placeholder-slate-700 outline-none leading-relaxed transition-all shadow-sm"
                        />
                      ) : (
                        <div 
                          className={cn(
                           "w-full text-[14px] bg-slate-50/30 dark:bg-slate-900/10 border border-slate-100 dark:border-slate-850 rounded-2xl p-6 min-h-[140px] leading-relaxed transition-all",
                            !activeTodo.notes ? "flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 italic gap-2 hover:bg-slate-50 dark:hover:bg-slate-900/20 cursor-pointer border-dashed" : "cursor-text hover:border-slate-300 dark:hover:border-slate-700 shadow-sm"
                          )}
                          onClick={() => setIsEditingNotes(true)}
                        >
                          {activeTodo.notes ? (
                            <div className="prose dark:prose-invert prose-slate max-w-none prose-p:my-2 prose-headings:font-black prose-a:text-blue-500 prose-img:rounded-xl">
                              <Markdown>{activeTodo.notes}</Markdown>
                            </div>
                          ) : (
                            <>
                              <Edit2 size={24} className="opacity-20 mb-1" />
                              <span className="text-[13px] font-bold tracking-tight">Click to compose notes...</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Labels Section */}
                  <div className="space-y-4 pt-2">
                    <label className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-[0.15em] select-none flex items-center gap-2 px-1">
                      <Hash size={12} strokeWidth={3} className="text-blue-500" />
                      Dynamic Labels
                    </label>
                    <div className="flex items-center gap-2 flex-wrap px-1">
                      {(activeTodo.tags || []).map((tag: string, tagIdx: number) => (
                        <span
                          key={`${tag}-${tagIdx}`}
                          className={cn(
                            "group text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border flex items-center gap-2 select-none shadow-sm transition-all", 
                            getTagColorClass(tag)
                          )}
                        >
                          {tag}
                          <button
                            onClick={() => {
                              const nextTags = (activeTodo.tags || []).filter((t: string) => t !== tag);
                              handleUpdateTodoField(activeTodo.id, activeTodo.nodePath, "tags", nextTags);
                            }}
                            className="opacity-40 hover:opacity-100 hover:text-rose-500 transition-all p-0.5 rounded-full hover:bg-white/40"
                          >
                            <X size={10} strokeWidth={4} />
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

                {/* Footer status bar */}
                <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#090d14] flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] font-black text-blue-500 uppercase tracking-widest">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse" />
                    Secure Local Storage Active
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest opacity-60">
                    Esc to Close
                  </div>
                </div>

                {isCameraOpen && (
                  <CameraCaptureModal 
                    onClose={() => setIsCameraOpen(false)}
                    onCapture={(file) => handleMediaUpload([file])}
                  />
                )}
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
