import React, { useState, useEffect, useRef } from "react";
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
  Check
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
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  const saveTodoData = async (newData: TodoNodeData) => {
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
            tasks: t.tasks ? t.tasks.map(sub => setCompletedRecursive(sub, nextVal)) : []
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

    const adjustParents = (tList: TodoTask[]): TodoTask[] => {
      return tList.map(t => {
        if (t.tasks && t.tasks.length > 0) {
          const processedChildren = adjustParents(t.tasks);
          const allChildrenCompleted = processedChildren.every(sub => sub.completed);
          return {
            ...t,
            completed: allChildrenCompleted,
            status: allChildrenCompleted ? "Completed" : "Todo",
            tasks: processedChildren
          };
        }
        return t;
      });
    };

    const nextTasks = adjustParents(firstPass);
    saveTodoData({ ...todoData, tasks: nextTasks });
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

  // Helper to flatten tasks with depth mapping
  const flattenTasks = (tasks: TodoTask[], depth = 0): { task: TodoTask, depth: number }[] => {
    let result: { task: TodoTask, depth: number }[] = [];
    for (const t of tasks || []) {
      result.push({ task: t, depth });
      if (t.tasks && t.tasks.length > 0) {
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
      className="w-[360px] sm:w-[380px] select-none pointer-events-auto cursor-default overflow-hidden bg-[#0a0f1d]/95 backdrop-blur-md border border-[#1e293b] rounded-[20px] shadow-2xl transition-all nodrag"
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
        className="flex items-center justify-between px-4 py-3.5 border-b border-[#1b2230] bg-[#111625]/60 shrink-0 drag-handle cursor-move"
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
          <div className="relative flex items-center justify-center w-9 h-9 rounded-full bg-[#1e40af]/20 border border-[#3b82f6]/30 shadow-[0_0_12px_rgba(59,130,246,0.25)] text-blue-400 shrink-0">
            <ListTodo size={17} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest leading-none mb-0.5 select-none font-bold truncate max-w-full">
              node: {typeof data.name === "string" ? data.name.replace("_todo_node", "").replace(".todo", "") : "tasks"}
            </span>
            <input
              type="text"
              className="font-bold text-[15px] leading-tight text-slate-100 bg-transparent border-none outline-none w-full truncate focus:ring-1 focus:ring-blue-500/30 rounded px-1 -ml-1 transition-all"
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
          <div className="flex bg-[#131924] p-0.5 rounded-lg border border-slate-800/80">
            <button
              onClick={() => setNodeIsFlat(false)}
              className={`p-1 rounded-md transition-all ${!nodeIsFlat ? "bg-blue-600/20 text-blue-400 border border-blue-500/10 shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
              title="Tree structure"
            >
              <FolderTree size={13} />
            </button>
            <button
              onClick={() => setNodeIsFlat(true)}
              className={`p-1 rounded-md transition-all ${nodeIsFlat ? "bg-blue-600/20 text-blue-400 border border-blue-500/10 shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
              title="Flat list"
            >
              <Layers size={13} />
            </button>
          </div>

          <button
            onClick={openWorkspace}
            className="p-1.5 rounded-lg border border-slate-800 bg-[#161B26]/60 hover:bg-[#1E2533] text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
            title="Open Fullscreen Workspace"
          >
            <Maximize2 size={13} />
          </button>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-1.5 rounded-lg border border-slate-800 bg-[#161B26]/60 hover:bg-[#1E2533] text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
            title="Options Menu"
          >
            <MoreVertical size={13} />
          </button>

          {isMenuOpen && (
            <div 
              ref={dropdownRef}
              className="absolute right-0 top-10 w-44 bg-[#0e1322] border border-slate-800 rounded-xl shadow-xl py-1 z-50 overflow-hidden"
            >
              <button
                onClick={addSampleTasks}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2 transition-colors"
              >
                <Sparkles size={12} className="text-amber-400" />
                <span>Load Sample Tasks</span>
              </button>
              <button
                onClick={clearCompletedTasks}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2 transition-colors"
              >
                <Trash2 size={12} className="text-emerald-400" />
                <span>Clear Completed</span>
              </button>
              <button
                onClick={resetAllTasks}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2 transition-colors"
              >
                <RefreshCw size={12} className="text-blue-400" />
                <span>Reset All Tasks</span>
              </button>
              <button
                onClick={clearAllTasks}
                className="w-full text-left px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-950/20 hover:text-rose-300 flex items-center gap-2 transition-colors border-t border-slate-800/60"
              >
                <Trash2 size={12} className="text-rose-500" />
                <span>Clear All Tasks</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress Indicators matching mock precisely */}
      <div className="px-4 py-3 bg-[#111625]/20 shrink-0">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs font-semibold text-slate-100">{progress}% Complete</span>
          <span className="text-xs text-slate-400 font-normal">{completed} done • {remaining} remaining</span>
        </div>
        <div className="w-full h-1.5 bg-[#1b2230] rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(59,130,246,0.5)]" 
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Tasks Queue List Area */}
      <div className="overflow-y-auto max-h-[260px] custom-scrollbar divide-y divide-[#1b2230] border-t border-[#1b2230]">
        {tasksToRender.length === 0 ? (
          <div className="py-8 px-4 flex-1 flex flex-col items-center justify-center text-slate-500 text-xs italic">
            <span className="mb-1">No tasks in this node yet.</span>
            <span className="text-[10px] text-slate-600">Type below to create one instantly!</span>
          </div>
        ) : (
          tasksToRender.map(({ task, depth }, idx) => {
            const isDone = task.completed || task.status === "Completed";
            const meta = priorityMeta(task);
            
            return (
              <div 
                key={`${task.id}-${idx}`}
                className="flex items-center gap-3 py-2 px-4 hover:bg-slate-800/10 group transition-all duration-150"
                style={{ paddingLeft: !nodeIsFlat ? `${depth * 1.1 + 1}rem` : "1rem" }}
              >
                {/* Check/Circle Bullet toggles state */}
                <button
                  onClick={() => toggleTaskComplete(task.id)}
                  className={`shrink-0 flex items-center justify-center w-5 h-5 rounded-full transition-colors ${
                    isDone 
                      ? 'text-emerald-500 hover:text-emerald-400' 
                      : 'text-slate-600 hover:text-blue-400 border border-slate-700 hover:border-blue-400/55'
                  }`}
                  title={isDone ? "Mark Pending" : "Mark Completed"}
                >
                  {isDone ? (
                    <CheckCircle2 size={16} className="fill-emerald-500/10" />
                  ) : (
                    <Circle size={15} />
                  )}
                </button>

                {/* Optional nested connector line for subtasks in Tree View */}
                {!nodeIsFlat && depth > 0 && (
                  <div className="w-1.5" />
                )}

                  <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    {/* Title */}
                    {editingTaskId === task.id ? (
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            saveEditedTaskName(task.id, editingText);
                          } else if (e.key === "Escape") {
                            setEditingTaskId(null);
                          }
                        }}
                        onBlur={() => saveEditedTaskName(task.id, editingText)}
                        autoFocus
                        className="bg-[#111625] text-white text-[12.5px] px-1.5 py-0.5 rounded border border-blue-500/80 outline-none w-full font-normal"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span 
                        className={`text-[12.5px] font-normal leading-normal truncate w-full cursor-text ${
                          isDone 
                            ? 'text-slate-500 line-through' 
                            : 'text-slate-100 hover:text-white transition-colors'
                        }`}
                        onDoubleClick={() => startEditingTask(task.id, task.text)}
                        title="Double-click to rename"
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
                <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
                  {/* Copy Task Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(task.text);
                      setCopiedTaskId(task.id);
                      setTimeout(() => {
                        setCopiedTaskId(prev => prev === task.id ? null : prev);
                      }, 2000);
                      setNotification({ type: 'success', message: 'Task text copied' });
                    }}
                    className={`p-1 rounded cursor-pointer transition-colors ${
                      copiedTaskId === task.id
                        ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10"
                        : "text-slate-400 hover:text-blue-400 hover:bg-slate-800/40"
                    }`}
                    title={copiedTaskId === task.id ? "Copied!" : "Copy Task"}
                  >
                    {copiedTaskId === task.id ? <Check size={13} /> : <Copy size={13} />}
                  </button>

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
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                    }`}
                    title={editingTaskId === task.id ? "Save name" : "Edit Name"}
                  >
                    {editingTaskId === task.id ? (
                      <CheckCircle2 size={13} />
                    ) : (
                      <Pencil size={13} />
                    )}
                  </button>

                  {/* Delete Task Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTask(task.id);
                    }}
                    className="p-1 text-slate-400 hover:text-rose-500 hover:bg-[#ffe4e6]/5 rounded cursor-pointer transition-colors"
                    title="Delete Task"
                  >
                    <Trash2 size={13} />
                  </button>
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
        className="px-4 py-2 border-t border-[#1b2230] bg-[#111625]/40 flex items-center gap-2 hover:bg-[#111625]/70 transition-colors"
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
          className="bg-transparent border-none outline-none text-xs text-slate-100 placeholder-slate-500 w-full focus:ring-0"
        />
        <button
          type="submit"
          className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-slate-800 bg-slate-800/80 text-slate-400 hover:text-blue-400 transition-colors shrink-0"
        >
          Enter
        </button>
      </form>
    </div>
  );
}
