import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { TreeNode } from "../utils/transformer";
import { useStore } from "../store/useStore";
import {
  CheckCircle2,
  Circle,
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
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  CornerDownRight,
  CornerLeftUp,
  PlusCircle,
  GripVertical
} from "lucide-react";
import { setValueAtPath } from "../utils/pathUtils";
import { TaskImagePreview } from "./TaskImagePreview";

export interface TodoTask {
  id: string;
  text: string;
  completed: boolean;
  status?: "Todo" | "In Progress" | "Blocked" | "Review" | "Completed";
  priority?: "Critical" | "High" | "Medium" | "Low" | "Normal";
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

const checkHasIncompleteChildren = (tasks?: TodoTask[]): boolean => {
  if (!tasks || tasks.length === 0) return false;
  return tasks.some((t) => {
    const isComp = t.completed || t.status === "Completed";
    if (!isComp) return true;
    return checkHasIncompleteChildren(t.tasks);
  });
};

interface TodoNodeProps {
  nodeId: string;
  data: TreeNode;
  isExpanded: boolean;
  onResize?: (width: number, height: number) => void;
}

export function TodoNodeRenderer({ nodeId, data, isExpanded, onResize }: TodoNodeProps) {
  const { parsedData, setCode, codeFormat, setExpandedJsNodeId, setCustomNodeSize, nodeSizes, setSelectedNodeId, setNotification } = useStore();
  const customSize = nodeSizes[nodeId];
  const [todoData, setTodoData] = useState<TodoNodeData>({ title: "Tasks", tasks: [] });
  
  // Compact state internally toggles Tree vs Flat view in this node
  const [nodeIsFlat, setNodeIsFlat] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);
  const [collapsedTaskIds, setCollapsedTaskIds] = useState<string[]>([]);
  const [activeMenuTaskId, setActiveMenuTaskId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const serializedValue = typeof data?.value === "object" && data?.value !== null
    ? JSON.stringify(data.value)
    : (data?.value || "");

  useEffect(() => {
    try {
      if (typeof data.value === "string") {
        setTodoData(JSON.parse(data.value));
      } else if (typeof data.value === "object" && data.value !== null) {
        setTodoData(data.value as any);
      }
    } catch (e) {
      setTodoData({ title: "Tasks", tasks: [] });
    }
  }, [serializedValue]);

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
    if (newData.tasks && (!nodeIsFlat || forceSync)) {
      newData.tasks = syncTaskCompletionState(newData.tasks);
    }
    setTodoData(newData);
    const updated = setValueAtPath(parsedData, data.path, newData);
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
    walk(tasks || []);
    return { total, completed };
  };

  const { total, completed } = getStats(todoData.tasks);
  const remaining = total - completed;
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

  const toggleTaskComplete = (taskId: string) => {
    const setCompletedRecursive = (task: TodoTask, completed: boolean): TodoTask => {
      if (nodeIsFlat) return task; // In flat mode, do not affect children
      return {
        ...task,
        completed,
        status: completed ? "Completed" : "Todo",
        tasks: task.tasks ? task.tasks.map(t => setCompletedRecursive(t, completed)) : []
      };
    };

    const toggleAndPropagate = (tList: TodoTask[]): TodoTask[] => {
      return tList.map(t => {
        if (t.id === taskId) {
          const nextVal = !t.completed;
          return {
            ...t,
            completed: nextVal,
            status: nextVal ? "Completed" : "Todo",
            tasks: t.tasks && !nodeIsFlat ? t.tasks.map(sub => setCompletedRecursive(sub, nextVal)) : t.tasks
          };
        }
        if (t.tasks && t.tasks.length > 0) {
          return {
            ...t,
            tasks: toggleAndPropagate(t.tasks)
          };
        }
        return t;
      });
    };

    const firstPass = toggleAndPropagate(todoData.tasks || []);
    // `saveTodoData` automatically calls syncTaskCompletionState which handles bubbling status UP
    saveTodoData({ ...todoData, tasks: firstPass });
  };

  const startEditingTask = (taskId: string, currentText: string) => {
    setEditingTaskId(taskId);
    setEditingText(currentText);
  };

  const saveEditedTaskName = (taskId: string, newText: string) => {
    if (!newText.trim()) return;
    const walk = (tList: TodoTask[]): TodoTask[] => {
      return tList.map(t => {
        if (t.id === taskId) {
          return { ...t, text: newText.trim() };
        }
        if (t.tasks) return { ...t, tasks: walk(t.tasks) };
        return t;
      });
    };
    saveTodoData({ ...todoData, tasks: walk(todoData.tasks || []) });
    setEditingTaskId(null);
  };

  const cyclePriority = (taskId: string) => {
    const walk = (tList: TodoTask[]): TodoTask[] => {
      return tList.map(t => {
        if (t.id === taskId) {
          const current = t.priority || "Low";
          let next: "Critical" | "High" | "Medium" | "Low" | "Normal" = "Low";
          if (current === "Low") next = "Medium";
          else if (current === "Medium") next = "High";
          else if (current === "High") next = "Low";
          return { ...t, priority: next };
        }
        if (t.tasks) return { ...t, tasks: walk(t.tasks) };
        return t;
      });
    };
    saveTodoData({ ...todoData, tasks: walk(todoData.tasks || []) });
  };

  const handleAddNewTask = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTaskText.trim()) return;
    const newTask: TodoTask = { 
      id: Math.random().toString(36).substr(2, 9), 
      text: newTaskText.trim(), 
      completed: false,
      priority: "Low",
      status: "Todo"
    };
    saveTodoData({
      ...todoData,
      tasks: [...(todoData.tasks || []), newTask]
    });
    setNewTaskText("");
  };

  const deleteTask = (taskId: string) => {
    const walk = (tList: TodoTask[]): TodoTask[] => {
      return tList
        .filter(t => t.id !== taskId)
        .map(t => ({
          ...t,
          tasks: t.tasks ? walk(t.tasks) : []
        }));
    };
    saveTodoData({ ...todoData, tasks: walk(todoData.tasks || []) });
  };

  const openWorkspace = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedJsNodeId(data.path);
  };

  const clearCompletedTasks = () => {
    const walk = (tList: TodoTask[]): TodoTask[] => {
      return tList
        .filter(t => !t.completed && t.status !== "Completed")
        .map(t => ({
          ...t,
          tasks: t.tasks ? walk(t.tasks) : []
        }));
    };
    saveTodoData({ ...todoData, tasks: walk(todoData.tasks || []) });
    setIsMenuOpen(false);
  };

  const resetAllTasks = () => {
    const walk = (tList: TodoTask[]): TodoTask[] => {
      return tList.map(t => ({
        ...t,
        completed: false,
        status: "Todo",
        tasks: t.tasks ? walk(t.tasks) : []
      }));
    };
    saveTodoData({ ...todoData, tasks: walk(todoData.tasks || []) });
    setIsMenuOpen(false);
  };

  const clearAllTasks = () => {
    saveTodoData({ ...todoData, tasks: [] });
    setIsMenuOpen(false);
  };

  const addSampleTasks = () => {
    const samples: TodoTask[] = [
      { 
        id: "s1", 
        text: "Database Layer Setup", 
        completed: false, 
        status: "Todo", 
        priority: "High",
        tasks: [
          { id: "s1-1", text: "Setup Redis Server", completed: true, status: "Completed", priority: "Low" },
          { id: "s1-2", text: "Add redis caching layer", completed: true, status: "Completed", priority: "Low" },
          { id: "s1-3", text: "Optimize database queries", completed: false, status: "Todo", priority: "High" }
        ]
      },
      { 
        id: "s2", 
        text: "Backend Security Protection", 
        completed: false, 
        status: "Todo", 
        priority: "Medium",
        tasks: [
          { id: "s2-1", text: "Implement rate limiting", completed: false, status: "Todo", priority: "Medium" },
          { id: "s2-2", text: "Write system integration tests", completed: false, status: "Todo", priority: "Low" }
        ]
      }
    ];
    saveTodoData({ ...todoData, tasks: samples });
    setIsMenuOpen(false);
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
      setTimeout(() => startEditingTask(id, editingText), 50);
    }
  };

  const outdentTask = (id: string) => {
    let taskToMove: TodoTask | null = null;
    const removeAndExtract = (tList: TodoTask[], parentId: string | null = null): { list: TodoTask[]; parentOfTarget: string | null } => {
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

    const { list: cleanList, parentOfTarget } = removeAndExtract(todoData.tasks || []);
    if (!taskToMove || !parentOfTarget) return;

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
    setTimeout(() => startEditingTask(id, editingText), 50);
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
    }
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
          return { ...t, tasks: [...(t.tasks || []), newTask] };
        }
        if (t.tasks) return { ...t, tasks: walk(t.tasks) };
        return t;
      });
    };

    setCollapsedTaskIds((prev) => prev.filter((x) => x !== parentId));
    saveTodoData({ ...todoData, tasks: walk(todoData.tasks || []) });
    setEditingTaskId(newId);
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
    setIsMenuOpen(false);
  };

  const expandAllSubtasks = () => {
    setCollapsedTaskIds([]);
    setIsMenuOpen(false);
  };

  // Helper to flatten tasks with depth mapping
  const flattenTasks = (tasks: TodoTask[], depth = 0): { task: TodoTask, depth: number }[] => {
    let result: { task: TodoTask, depth: number }[] = [];
    for (const t of tasks || []) {
      result.push({ task: t, depth });
      if (t.tasks && t.tasks.length > 0 && (nodeIsFlat ? true : !collapsedTaskIds.includes(t.id))) {
        result = result.concat(flattenTasks(t.tasks, depth + 1));
      }
    }
    return result;
  };
  
  const flatTasks = flattenTasks(todoData.tasks);
  
  // Auto handle resizing based on number of preview tasks in Tree/Flat list views
  useEffect(() => {
    const taskCount = flatTasks.length;
    const targetWidth = 385;
    // Cap at 8 items for a neat compact flow, standard item h=39
    const itemsCount = Math.min(taskCount, 8);
    const calculatedHeight = isExpanded 
      ? Math.max(260, 56 + 54 + (itemsCount === 0 ? 80 : itemsCount * 39) + 40) 
      : 130;
    
    if (!customSize || customSize.width !== targetWidth || customSize.height !== calculatedHeight) {
      setCustomNodeSize(nodeId, targetWidth, calculatedHeight);
    }
    
    if (onResize) {
      onResize(targetWidth, calculatedHeight);
    }
  }, [isExpanded, total, nodeId, nodeIsFlat, todoData.tasks, customSize, setCustomNodeSize, onResize, flatTasks.length]);

  // Choose sequence of tasks to display based on isFlatList setting
  const tasksToRender = nodeIsFlat 
    ? flatTasks.map(item => ({ ...item, depth: 0 }))
    : flatTasks;

  const priorityMeta = (task: TodoTask) => {
    const isDone = task.completed || task.status === "Completed";
    if (isDone) {
      return {
        badgeStyle: "bg-emerald-950/40 text-emerald-400 border border-emerald-500/15 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md",
        dotStyle: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]",
        label: "Done"
      };
    }

    const priority = task.priority || "Low";
    switch (priority) {
      case "Critical":
      case "High":
        return {
          badgeStyle: "bg-amber-950/40 text-amber-500 border border-amber-500/15 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md",
          dotStyle: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]",
          label: "High"
        };
      case "Medium":
        return {
          badgeStyle: "bg-indigo-950/40 text-indigo-400 border border-indigo-500/15 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md",
          dotStyle: "bg-indigo-500 shadow-[0_0_8px_rgba(129,140,248,0.5)]",
          label: "Medium"
        };
      case "Low":
      case "Normal":
      default:
        return {
          badgeStyle: "bg-blue-950/40 text-blue-400 border border-blue-500/15 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md",
          dotStyle: "bg-[#2563EB] shadow-[0_0_8px_rgba(37,99,235,0.5)]",
          label: "Low"
        };
    }
  };

  return (
    <div 
      className="w-[360px] sm:w-[380px] select-none pointer-events-auto cursor-default overflow-hidden bg-white/95 dark:bg-[#0a0f1d]/95 backdrop-blur-md border border-slate-200 dark:border-[#1e293b] rounded-[20px] shadow-2xl transition-all nodrag"
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
      {/* Header Panel */}
      <div 
        className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-[#1b2230] bg-slate-50/60 dark:bg-[#111625]/60 shrink-0 drag-handle cursor-move"
        onClick={(e) => {
          e.stopPropagation();
          const selectedId = useStore.getState().selectedNodeId;
          if (selectedId !== nodeId) {
            setSelectedNodeId(nodeId);
          }
        }}
      >
        <div className="flex items-center gap-3 max-w-[65%]">
          {/* List Indicator with Blue glow */}
          <div className="relative flex items-center justify-center w-9 h-9 rounded-full bg-blue-100 dark:bg-[#1e40af]/20 border border-blue-200 dark:border-[#3b82f6]/30 shadow-[0_0_12px_rgba(59,130,246,0.25)] text-blue-400 shrink-0">
            <ListTodo size={17} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest leading-none mb-0.5 select-none font-bold truncate max-w-full">
              node: {typeof data.name === "string" ? data.name.replace("_todo_node", "").replace(".todo", "") : "tasks"}
            </span>
            <input
              type="text"
              className="font-bold text-[15px] leading-tight text-slate-800 dark:text-slate-100 bg-transparent border-none outline-none w-full truncate focus:ring-1 focus:ring-blue-500/30 rounded px-1 -ml-1 transition-all"
              value={todoData.title || "Tasks"}
              onChange={(e) => saveTodoData({ ...todoData, title: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </div>
          <span className="text-[11px] font-semibold text-blue-400 bg-blue-500/15 px-2.5 py-0.5 rounded-full border border-blue-500/10 shrink-0">
            {completed} / {total}
          </span>
        </div>

        {/* Dynamic Controls Option (Tree, Flat, Detail, More) */}
        <div className="flex items-center gap-1.5 shrink-0 relative">
          {/* Compact Switcher between Tree vs Flat List */}
          <div className="flex bg-slate-100 dark:bg-[#131924] p-0.5 rounded-lg border border-slate-200 dark:border-slate-800/80">
            <button
              onClick={() => {
                setNodeIsFlat(false);
                if (todoData.tasks) {
                  saveTodoData({ ...todoData }, true);
                }
              }}
              className={`p-1 rounded-md transition-all ${!nodeIsFlat ? "bg-blue-600/20 text-blue-400 border border-blue-500/10 shadow-sm" : "text-slate-500 hover:text-slate-600 dark:text-slate-300"}`}
              title="Tree structure"
            >
              <FolderTree size={13} />
            </button>
            <button
              onClick={() => setNodeIsFlat(true)}
              className={`p-1 rounded-md transition-all ${nodeIsFlat ? "bg-blue-600/20 text-blue-400 border border-blue-500/10 shadow-sm" : "text-slate-500 hover:text-slate-600 dark:text-slate-300"}`}
              title="Flat list"
            >
              <Layers size={13} />
            </button>
          </div>

          <button
            onClick={openWorkspace}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-[#161B26]/60 hover:bg-slate-200 dark:hover:bg-[#1E2533] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
            title="Open Fullscreen Workspace"
          >
            <Maximize2 size={13} />
          </button>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-[#161B26]/60 hover:bg-slate-200 dark:hover:bg-[#1E2533] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
            title="Options Menu"
          >
            <MoreVertical size={13} />
          </button>

          {isMenuOpen && (
            <div 
              ref={dropdownRef}
              className="absolute right-0 top-10 w-44 bg-white dark:bg-[#0e1322] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1 z-50 overflow-hidden"
            >
              <button
                onClick={addSampleTasks}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white flex items-center gap-2 transition-colors border-b border-slate-200 dark:border-slate-800/60"
              >
                <Sparkles size={12} className="text-amber-400" />
                <span>Load Sample Tasks</span>
              </button>
              <button
                onClick={expandAllSubtasks}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white flex items-center gap-2 transition-colors"
              >
                <FolderTree size={12} className="text-blue-400" />
                <span>Expand All</span>
              </button>
              <button
                onClick={collapseAllSubtasks}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white flex items-center gap-2 transition-colors border-b border-slate-200 dark:border-slate-800/60"
              >
                <Layers size={12} className="text-slate-500 dark:text-slate-400" />
                <span>Collapse All</span>
              </button>
              <button
                onClick={clearCompletedTasks}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white flex items-center gap-2 transition-colors"
              >
                <Trash2 size={12} className="text-emerald-400" />
                <span>Clear Completed</span>
              </button>
              <button
                onClick={resetAllTasks}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white flex items-center gap-2 transition-colors"
              >
                <RefreshCw size={12} className="text-blue-400" />
                <span>Reset All Tasks</span>
              </button>
              <button
                onClick={clearAllTasks}
                className="w-full text-left px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-950/20 hover:text-rose-300 flex items-center gap-2 transition-colors border-t border-slate-200 dark:border-slate-800/60"
              >
                <Trash2 size={12} className="text-rose-500" />
                <span>Clear All Tasks</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress Indicators matching mock precisely */}
      <div className="px-4 py-3 bg-slate-50/20 dark:bg-[#111625]/20 shrink-0">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{progress}% Complete</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">{completed} done • {remaining} remaining</span>
        </div>
        <div className="w-full h-1.5 bg-slate-200 dark:bg-[#1b2230] rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(59,130,246,0.5)]" 
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Tasks Queue List Area */}
      <div className="overflow-y-auto max-h-[260px] custom-scrollbar divide-y divide-slate-200 dark:divide-[#1b2230] border-t border-slate-200 dark:border-[#1b2230]">
        {tasksToRender.length === 0 ? (
          <div className="py-8 px-4 flex-1 flex flex-col items-center justify-center text-slate-500 text-xs italic">
            <span className="mb-1">No tasks in this node yet.</span>
            <span className="text-[10px] text-slate-600">Type below to create one instantly!</span>
          </div>
        ) : (
          tasksToRender.map(({ task, depth }, idx) => {
            const isDone = task.completed || task.status === "Completed";
            const hasIncompleteChildren = !nodeIsFlat && checkHasIncompleteChildren(task.tasks);
            const meta = priorityMeta(task);
            
            return (
              <div 
                key={`${task.id}-${idx}`}
                className="flex items-center gap-3 py-2 px-4 hover:bg-slate-800/10 group transition-all duration-150"
                style={{ paddingLeft: !nodeIsFlat ? `${depth * 1.1 + 1}rem` : "1rem" }}
              >
                {/* Check/Circle Bullet toggles state */}
                <button
                  onClick={() => {
                    if (!isDone && hasIncompleteChildren) {
                      setNotification({ message: 'Complete subtasks first', type: 'info' });
                      return;
                    }
                    toggleTaskComplete(task.id);
                  }}
                  className={`shrink-0 flex items-center justify-center w-5 h-5 rounded-full transition-colors outline-none ${
                    !isDone && hasIncompleteChildren 
                      ? 'cursor-not-allowed opacity-50 text-slate-600 border border-slate-700'
                      : isDone 
                        ? 'text-emerald-500 hover:text-emerald-400' 
                        : 'text-slate-600 hover:text-blue-400 border border-slate-700 hover:border-blue-400/55'
                  }`}
                  title={!isDone && hasIncompleteChildren ? "Complete subtasks first" : isDone ? "Mark Pending" : "Mark Completed"}
                >
                  {isDone ? (
                    <CheckCircle2 size={16} className="fill-emerald-500/10" />
                  ) : (
                    <Circle size={15} />
                  )}
                </button>

                {/* Subtask Hierarchy Controls */}
                {!nodeIsFlat && task.tasks && task.tasks.length > 0 ? (
                  <button
                    onClick={(e) => toggleCollapseTask(task.id, e)}
                    className="shrink-0 flex items-center justify-center w-3 h-3 ml-[-8px] mr-0.5 text-slate-500 hover:text-slate-600 dark:text-slate-300"
                  >
                    <ChevronRight size={14} className={`transition-transform ${!collapsedTaskIds.includes(task.id) ? "rotate-90" : ""}`} />
                  </button>
                ) : !nodeIsFlat && depth > 0 ? (
                  <div className="w-2 ml-[-8px] mr-0.5 border-l border-slate-300 dark:border-slate-700/50 h-5" />
                ) : null}

                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                  {/* Title */}
                  {editingTaskId === task.id ? (
                    <textarea
                      value={editingText}
                      onChange={(e) => {
                        setEditingText(e.target.value);
                        e.target.style.height = 'auto';
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
                          if (e.shiftKey) {
                            saveEditedTaskName(task.id, editingText);
                            outdentTask(task.id);
                          } else {
                            saveEditedTaskName(task.id, editingText);
                            indentTask(task.id);
                          }
                        }
                      }}
                      onBlur={() => saveEditedTaskName(task.id, editingText)}
                      autoFocus
                      rows={1}
                      className="bg-white dark:bg-[#111625] text-slate-800 dark:text-white text-[12.5px] px-1.5 py-0.5 rounded border border-blue-500/80 outline-none w-full font-normal resize-none overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      style={{ minHeight: "24px", height: "auto" }}
                      onFocus={(e) => {
                        e.target.style.height = 'auto';
                        e.target.style.height = `${Math.max(24, e.target.scrollHeight)}px`;
                        e.target.setSelectionRange(e.target.value.length, e.target.value.length);
                      }}
                    />
                  ) : (
                    <span 
                      className={`text-[12.5px] font-normal leading-normal truncate w-full cursor-text ${
                        isDone 
                          ? 'text-slate-500 line-through' 
                          : 'text-slate-800 dark:text-slate-100 hover:text-slate-900 dark:hover:text-white transition-colors'
                      }`}
                      onClick={() => startEditingTask(task.id, task.text)}
                      title="Click to edit"
                    >
                      {task.text}
                    </span>
                  )}

                  {/* Image Preview */}
                  {task.imageHashes && task.imageHashes.length > 0 && (
                    <TaskImagePreview imageHashes={task.imageHashes} compact={true} />
                  )}
                </div>

                {/* Clickable Priority/Done Pill Badge (cycles priority on click!) */}
                <button 
                  onClick={() => cyclePriority(task.id)}
                  className={meta.badgeStyle}
                  title="Click to cycle priority"
                >
                  {meta.label}
                </button>

                {/* Action Controls Container */}
                <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity shrink-0 task-menu-container relative">
                  {/* Edit/Rename button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (editingTaskId === task.id) {
                        saveEditedTaskName(task.id, editingText);
                      } else {
                        startEditingTask(task.id, task.text);
                      }
                    }}
                    className={`p-1 rounded cursor-pointer transition-colors ${
                      editingTaskId === task.id
                        ? "text-emerald-400 hover:bg-emerald-950/20"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/40"
                    }`}
                    title={editingTaskId === task.id ? "Save name" : "Edit Name"}
                  >
                    {editingTaskId === task.id ? (
                      <CheckCircle2 size={13} />
                    ) : (
                      <Pencil size={13} />
                    )}
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
                  />
                </div>

                {/* Right Margin Status Dot */}
                <div className="flex items-center justify-center pr-1 shrink-0">
                  <span className={`w-1.5 h-1.5 rounded-full ${meta.dotStyle}`} />
                </div>
              </div>
            );
          })
        )}
      </div>
      
      {/* Footer input to Add Task directly inside Node */}
      <form 
        onSubmit={handleAddNewTask}
        className="px-4 py-2 border-t border-slate-200 dark:border-[#1b2230] bg-slate-50/40 dark:bg-[#111625]/40 flex items-center gap-2 hover:bg-slate-100/70 dark:hover:bg-[#111625]/70 transition-colors"
      >
        <button
          type="button"
          onClick={() => handleAddNewTask()}
          className="w-5 h-5 rounded-full border border-dashed border-slate-600 hover:border-blue-400 flex items-center justify-center text-slate-500 hover:text-blue-400 transition-all shrink-0"
          title="Add task"
        >
          <Plus size={12} />
        </button>
        <input 
          type="text"
          placeholder="Add new task..."
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          className="bg-transparent border-none outline-none text-xs text-slate-800 dark:text-slate-100 placeholder-slate-500 w-full focus:ring-0"
        />
        <button
          type="submit"
          className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shrink-0"
        >
          Enter
        </button>
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
}: any) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const isOpen = activeMenuTaskId === task.id;

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
        position: 'fixed',
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
      
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside, true);
        document.addEventListener('touchstart', handleClickOutside, true);
      }, 0);
      
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside, true);
        document.removeEventListener('touchstart', handleClickOutside, true);
      };
    }
  }, [isOpen, setActiveMenuTaskId]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onMouseDown={(e) => {
          // Changed to onMouseDown to ensure it captures events quickly before click outside
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
          setActiveMenuTaskId(isOpen ? null : task.id);
        }}
        className={`p-1 rounded cursor-pointer transition-colors ${
          isOpen ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/40"
        }`}
      >
        <MoreVertical size={13} />
      </button>

      {isOpen && createPortal(
        <div ref={menuRef} style={style} className="w-44 bg-white dark:bg-[#0e1322] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1 flex flex-col pointer-events-auto">
          <button
            onClick={(e) => { e.stopPropagation(); addNestedSubtask(task.id); setActiveMenuTaskId(null); }}
            className="w-full text-left px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white flex items-center gap-2 transition-colors"
          >
            <PlusCircle size={12} className="text-blue-400" />
            <span>Add Subtask</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); indentTask(task.id); setActiveMenuTaskId(null); }}
            className="w-full text-left px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white flex items-center gap-2 transition-colors"
          >
            <CornerDownRight size={12} className="text-slate-500 dark:text-slate-400" />
            <span>Convert to Subtask</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); outdentTask(task.id); setActiveMenuTaskId(null); }}
            className="w-full text-left px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white flex items-center gap-2 transition-colors border-b border-slate-200 dark:border-slate-800/60"
          >
            <CornerLeftUp size={12} className="text-slate-500 dark:text-slate-400" />
            <span>Promote to Parent</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); moveTaskInTree(task.id, 'up'); setActiveMenuTaskId(null); }}
            className="w-full text-left px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white flex items-center gap-2 transition-colors"
          >
            <ArrowUp size={12} className="text-slate-500 dark:text-slate-400" />
            <span>Move Up</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); moveTaskInTree(task.id, 'down'); setActiveMenuTaskId(null); }}
            className="w-full text-left px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white flex items-center gap-2 transition-colors border-b border-slate-200 dark:border-slate-800/60"
          >
            <ArrowDown size={12} className="text-slate-500 dark:text-slate-400" />
            <span>Move Down</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); deleteTask(task.id); setActiveMenuTaskId(null); }}
            className="w-full text-left px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-950/20 hover:text-rose-300 flex items-center gap-2 transition-colors"
          >
            <Trash2 size={12} className="text-rose-500" />
            <span>Delete Task</span>
          </button>
        </div>,
        document.body
      )}
    </>
  );
};

