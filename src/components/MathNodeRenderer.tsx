import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, Play, Pause, Square, SkipBack, Repeat, Layers, Plus, Trash2, Settings, Crosshair, HelpCircle, X, Search, ChevronDown, ChevronRight, ChevronUp, Edit2, Copy, CopyPlus, RotateCcw, GripVertical, Folder, FolderPlus, Menu, MoreVertical } from "lucide-react";
import { Mafs, Coordinates, Plot, Transform, Point, Vector, Polygon, Circle, MovablePoint, Text, Line, LaTeX, usePaneContext } from "mafs";
import "mafs/core.css";
import "mafs/font.css";
import "katex/dist/katex.min.css";
import katex from "katex";
import * as mathjs from "mathjs";
import { useStore } from "../store/useStore";
import { HexAlphaColorPicker } from "react-colorful";

const InsertAboveIcon = ({ size = 14, className = "" }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 3v7" />
    <path d="M8.5 6.5h7" />
    <rect x="4" y="15" width="16" height="5" rx="1.5" />
  </svg>
);

const InsertBelowIcon = ({ size = 14, className = "" }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="4" y="4" width="16" height="5" rx="1.5" />
    <path d="M12 14v7" />
    <path d="M8.5 17.5h7" />
  </svg>
);

interface MathFunction {
  id: string;
  name?: string;
  expr: string;
  color: string;
  visible: boolean;
  type: "function" | "parametric" | "point" | "implicit" | "differential" | "polar" | "vector" | "polygon" | "line";
  compiled?: any;
  expr2?: string; // For parametric x/y or polar r/theta
  compiled2?: any;
  error?: string;
  isDraggable?: boolean;
  showLabel?: boolean;
  label?: string;
  fillColor?: string;
  fillOpacity?: number;
}

interface MathVariable {
  id: string;
  name: string;
  displayName: string;
  description: string;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  groupId: string;
  showSlider?: boolean;
}

interface VariableGroup {
  id: string;
  name: string;
  isCollapsed: boolean;
}

const VariableEditorModal = ({ variable, groups, existingVariables, onSave, onClose }: any) => {
  const isNew = !variable || variable.name.endsWith("_copy");
  const [formData, setFormData] = useState<MathVariable>(() => {
    if (variable) {
      return { showSlider: variable.showSlider !== false, ...variable };
    }
    return {
      id: Math.random().toString(36).substring(7),
      name: "",
      displayName: "",
      description: "",
      value: 1,
      defaultValue: 1,
      min: -10,
      max: 10,
      step: 0.1,
      groupId: groups[0]?.id || "default",
      showSlider: true
    };
  });

  const [groupMode, setGroupMode] = useState<"select" | "new">("select");
  const [newGroupName, setNewGroupName] = useState("");
  const [error, setError] = useState("");

  const handleSave = () => {
    setError("");
    const trimmedSymbol = formData.name.trim();
    if (!trimmedSymbol) return setError("Symbol is required.");
    if (!/^[a-zA-Z_]\w*$/.test(trimmedSymbol)) return setError("Invalid symbol format (must start with letter/underscore, e.g. k, a_1).");
    if (existingVariables.some((v: any) => v.name === trimmedSymbol && v.id !== formData.id)) return setError(`Symbol '${trimmedSymbol}' already exists.`);
    
    // Validate bounds only if slider is enabled
    const isSliderEnabled = formData.showSlider !== false;
    const minVal = isNaN(formData.min) ? -10 : formData.min;
    const maxVal = isNaN(formData.max) ? 10 : formData.max;
    if (isSliderEnabled && minVal >= maxVal) return setError("Min must be less than Max.");

    const finalVar = {
      ...formData,
      name: trimmedSymbol,
      min: minVal,
      max: maxVal,
      step: isNaN(formData.step) || formData.step <= 0 ? 0.1 : formData.step,
      defaultValue: isNaN(formData.defaultValue) ? 1 : formData.defaultValue,
      value: isNaN(formData.value) ? (isNaN(formData.defaultValue) ? 1 : formData.defaultValue) : formData.value,
      showSlider: isSliderEnabled
    };

    if (groupMode === "new") {
      const trimmedGroup = newGroupName.trim();
      if (!trimmedGroup) {
        return setError("Please enter a custom group name.");
      }
      const existingGroup = groups.find((g: any) => g.name.toLowerCase() === trimmedGroup.toLowerCase());
      if (existingGroup) {
        onSave({ ...finalVar, groupId: existingGroup.id });
      } else {
        const newGroupId = `group_${Math.random().toString(36).substring(7)}`;
        const newGroup = {
          id: newGroupId,
          name: trimmedGroup,
          isCollapsed: false
        };
        onSave({ ...finalVar, groupId: newGroupId }, newGroup);
      }
    } else {
      onSave(finalVar);
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl w-full max-w-sm flex flex-col nodrag cursor-default text-slate-800 dark:text-slate-100 overflow-hidden transform transition-all">
         {/* Modal Header */}
         <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
           <div className="flex items-center gap-2">
             <div className="p-1.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-lg">
               <FolderPlus size={16} />
             </div>
             <div>
               <h3 className="font-semibold text-slate-900 dark:text-slate-50 text-sm leading-none">{isNew ? "Add Variable" : "Edit Variable"}</h3>
               <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Define properties for your variable</p>
             </div>
           </div>
           <button onClick={onClose} className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-350 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
             <X size={16}/>
           </button>
         </div>

         {/* Modal Body */}
         <div className="p-4 flex flex-col gap-4 overflow-y-auto max-h-[60vh] custom-scrollbar">
            {error && (
              <div className="text-red-600 dark:text-red-400 text-xs font-semibold bg-red-500/10 dark:bg-red-950/20 p-2.5 rounded-lg border border-red-200 dark:border-red-900/30">
                {error}
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-3 flex-shrink-0">
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 block uppercase tracking-wider">Symbol *</label>
                <input 
                  type="text" 
                  value={formData.name} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })} 
                  className="w-full bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-sm text-slate-900 dark:text-slate-100 font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none transition-all" 
                  placeholder="e.g. a" 
                  disabled={!isNew}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 block uppercase tracking-wider">Display Name</label>
                <input 
                  type="text" 
                  value={formData.displayName} 
                  onChange={e => setFormData({ ...formData, displayName: e.target.value })} 
                  className="w-full bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none transition-all" 
                  placeholder="e.g. Amplitude" 
                />
              </div>
            </div>

            {/* Range Slider Toggle */}
            <div className="flex items-center justify-between p-2.5 bg-slate-50/50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 flex-shrink-0">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider">Show Range Slider</span>
                <span className="text-[9px] text-slate-400 dark:text-slate-500">Provide an interactive slider for quick tuning</span>
              </div>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, showSlider: !prev.showSlider }))}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  formData.showSlider !== false ? "bg-blue-600 dark:bg-blue-500" : "bg-slate-200 dark:bg-slate-800"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    formData.showSlider !== false ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className={`grid grid-cols-3 gap-2 flex-shrink-0 transition-opacity duration-200 ${
              formData.showSlider !== false ? "opacity-100" : "opacity-45 pointer-events-none"
            }`}>
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 block uppercase tracking-wider">Min</label>
                <input 
                  type="number" 
                  value={isNaN(formData.min) ? "" : formData.min} 
                  onChange={e => setFormData({ ...formData, min: parseFloat(e.target.value) })} 
                  className="w-full bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-100 font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none" 
                  disabled={formData.showSlider === false}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 block uppercase tracking-wider">Max</label>
                <input 
                  type="number" 
                  value={isNaN(formData.max) ? "" : formData.max} 
                  onChange={e => setFormData({ ...formData, max: parseFloat(e.target.value) })} 
                  className="w-full bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-100 font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none" 
                  disabled={formData.showSlider === false}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 block uppercase tracking-wider">Step</label>
                <input 
                  type="number" 
                  value={isNaN(formData.step) ? "" : formData.step} 
                  onChange={e => setFormData({ ...formData, step: parseFloat(e.target.value) })} 
                  className="w-full bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-100 font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none" 
                  disabled={formData.showSlider === false}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 flex-shrink-0">
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 block uppercase tracking-wider">Default Value</label>
                <input 
                  type="number" 
                  value={isNaN(formData.defaultValue) ? "" : formData.defaultValue} 
                  onChange={e => setFormData({ ...formData, defaultValue: parseFloat(e.target.value) })} 
                  className="w-full bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-sm text-slate-900 dark:text-slate-100 font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none" 
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 block uppercase tracking-wider">Group</label>
                <div className="flex bg-slate-100 dark:bg-slate-950 rounded-lg p-0.5 border border-slate-200 dark:border-slate-800 text-[11px] h-[38px] items-center">
                  <button 
                    type="button" 
                    onClick={() => setGroupMode("select")}
                    className={`flex-1 text-center py-1 rounded-md transition-all font-medium ${
                      groupMode === "select" 
                        ? "bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-slate-50 border border-slate-200/55 dark:border-slate-700/60" 
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-white/40 dark:hover:bg-slate-900/40"
                    }`}
                  >
                    Select
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setGroupMode("new")}
                    className={`flex-1 text-center py-1 rounded-md transition-all font-medium ${
                      groupMode === "new" 
                        ? "bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-slate-50 border border-slate-200/55 dark:border-slate-700/60" 
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-white/40 dark:hover:bg-slate-900/40"
                    }`}
                  >
                    + New
                  </button>
                </div>
              </div>
            </div>

            {/* Conditional Group Area */}
            <div className="flex flex-col gap-1.5 p-2.5 bg-slate-50/50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
              {groupMode === "select" ? (
                <div>
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1 block uppercase tracking-wider">Select Group Name</label>
                  <select 
                    value={formData.groupId} 
                    onChange={e => setFormData({ ...formData, groupId: e.target.value })} 
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                  >
                    {groups.map((g: any) => (
                      <option key={g.id} value={g.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1 block uppercase tracking-wider">Custom Group Name</label>
                  <input 
                    type="text" 
                    value={newGroupName} 
                    onChange={e => setNewGroupName(e.target.value)} 
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500" 
                    placeholder="e.g. Physics Constants"
                  />
                </div>
              )}
            </div>

            <div className="flex-shrink-0">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 block uppercase tracking-wider">Description</label>
              <textarea 
                value={formData.description} 
                onChange={e => setFormData({ ...formData, description: e.target.value })} 
                className="w-full bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-sm text-slate-900 dark:text-slate-100 resize-none h-14 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none" 
                placeholder="What does this variable do?" 
              />
            </div>

         </div>
         <div className="p-3 border-t border-slate-150 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-900/50">
            <button onClick={onClose} className="px-4 py-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg font-medium text-xs transition-colors">Cancel</button>
            <button onClick={handleSave} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium text-xs transition-colors shadow">Save</button>
         </div>
      </div>
    </div>
  )
}

const hslToHex = (h: number, s: number, l: number) => {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

export const getVarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return hslToHex(hue, 85, 65);
};

const MATH_COMPLETIONS = [
  { name: "sin", desc: "Sine of x", insert: "sin(" },
  { name: "cos", desc: "Cosine of x", insert: "cos(" },
  { name: "tan", desc: "Tangent of x", insert: "tan(" },
  { name: "asin", desc: "Inverse sine", insert: "asin(" },
  { name: "acos", desc: "Inverse cosine", insert: "acos(" },
  { name: "atan", desc: "Inverse tangent", insert: "atan(" },
  { name: "exp", desc: "Exponential e^x", insert: "exp(" },
  { name: "log", desc: "Natural logarithm", insert: "log(" },
  { name: "log10", desc: "Base 10 logarithm", insert: "log10(" },
  { name: "sqrt", desc: "Square root", insert: "sqrt(" },
  { name: "cbrt", desc: "Cube root", insert: "cbrt(" },
  { name: "abs", desc: "Absolute value", insert: "abs(" },
  { name: "pi", desc: "Constant π (3.14159...)", insert: "pi" },
  { name: "e", desc: "Constant e (2.71828...)", insert: "e" },
  { name: "phi", desc: "Golden ratio (1.618...)", insert: "phi" },
  { name: "mean", desc: "Mean of values", insert: "mean(" },
  { name: "median", desc: "Median of values", insert: "median(" },
  { name: "std", desc: "Standard deviation", insert: "std(" },
  { name: "derivative", desc: "Derivative of expression", insert: "derivative(" },
  { name: "round", desc: "Round to nearest integer", insert: "round(" },
  { name: "floor", desc: "Round down", insert: "floor(" },
  { name: "ceil", desc: "Round up", insert: "ceil(" }
];

const EquationInput = ({ value, onChange, variables, hoveredVar, error, onAddEnter }: any) => {
  const [isFocused, setIsFocused] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selIndex, setSelIndex] = useState(0);
  const [inputRect, setInputRect] = useState<DOMRect | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const appTheme = useStore((state) => state.appTheme);

  useEffect(() => {
    if (!isFocused) {
      setSuggestions([]);
      return;
    }
    const match = value.slice(0, cursorPos).match(/[a-zA-Z_]\w*$/);
    if (match) {
      const search = match[0].toLowerCase();
      const dynamicCompletions = [
        ...MATH_COMPLETIONS,
        ...variables.map((v: any) => ({ name: v.name, desc: v.displayName || `Variable ${v.name}`, insert: v.name })),
        { name: "theta", desc: "Polar angle", insert: "theta" }
      ];
      const filtered = dynamicCompletions.filter(c => c.name.startsWith(search));
      setSuggestions(filtered);
      setSelIndex(0);
    } else {
      setSuggestions([]);
    }
    if (containerRef.current) {
       setInputRect(containerRef.current.getBoundingClientRect());
    }
  }, [value, cursorPos, isFocused]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const dynamicCompletions = [
      ...MATH_COMPLETIONS,
      ...variables.map(v => ({ name: v.name, desc: v.displayName || `Variable ${v.name}`, insert: v.name })),
      { name: "theta", desc: "Polar angle", insert: "theta" }
    ];

    if (e.ctrlKey && e.key === " ") {
      e.preventDefault();
      const match = value.slice(0, cursorPos).match(/[a-zA-Z_]\w*$/);
      const search = match ? match[0].toLowerCase() : "";
      const filtered = dynamicCompletions.filter(c => c.name.startsWith(search));
      setSuggestions(filtered);
      setSelIndex(0);
      return;
    }

    if (suggestions.length > 0) {
      if (e.key === "Escape") { e.preventDefault(); setSuggestions([]); }
      if (e.key === "ArrowDown") { e.preventDefault(); setSelIndex(i => (i + 1) % suggestions.length); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelIndex(i => (i - 1 + suggestions.length) % suggestions.length); }
      if (e.key === "Tab" || e.key === "Enter") {
         e.preventDefault();
         const match = value.slice(0, cursorPos).match(/[a-zA-Z_]\w*$/);
         const before = match ? value.slice(0, cursorPos - match[0].length) : value.slice(0, cursorPos);
         const after = value.slice(cursorPos);
         const insert = suggestions[selIndex].insert;
         onChange(before + insert + after);
         setSuggestions([]);
         setTimeout(() => {
            if (inputRef.current) {
              const newPos = before.length + insert.length;
              inputRef.current.selectionStart = newPos;
              inputRef.current.selectionEnd = newPos;
              setCursorPos(newPos);
            }
         }, 0);
      }
    } else if (e.key === "Enter" && !e.shiftKey && onAddEnter) {
      e.preventDefault();
      onAddEnter();
    }
  };

  const getColoredText = () => {
     if (!value) return <span className="opacity-0">placeholder</span>;
     const tokens = value.split(/([a-zA-Z_]\w*)/);
     const isDark = appTheme === "dark";
     return tokens.map((tok: string, i: number) => {
        if (/^[a-zA-Z_]\w*$/.test(tok)) {
           const isVar = variables.some((v: any) => v.name === tok) || ["x", "y", "t", "theta"].includes(tok);
           if(isVar) {
              const color = tok === "x" ? "#10b981" : tok === "t" ? "#8b5cf6" : tok === "y" ? "#3b82f6" : tok === "theta" ? "#f59e0b" : getVarColor(tok);
              return <span key={i} style={{ color, textShadow: hoveredVar === tok ? `0 0 8px ${color}` : 'none', fontWeight: hoveredVar === tok ? 'bold' : 'normal', transition: 'all 0.2s' }}>{tok}</span>
           }
           if (MATH_COMPLETIONS.some(c => c.name === tok)) {
              return <span key={i} style={{ color: isDark ? '#eab308' : '#b45309' }}>{tok}</span>;
           }
        }
        return <span key={i} style={{ color: isDark ? '#cbd5e1' : '#334155' }}>{tok}</span>;
     });
  };

  let renderedLatex = null;
  if (!isFocused && !error && value.trim()) {
    try {
      const node = mathjs.parse(value);
      const latex = node.toTex({
        handler: (n: any) => {
           if (n.isSymbolNode) {
              const isVar = variables.some((v: any) => v.name === n.name) || ["x", "y", "t", "theta"].includes(n.name);
              if (isVar) {
                 const color = n.name === "x" ? "#10b981" : n.name === "t" ? "#8b5cf6" : n.name === "y" ? "#3b82f6" : n.name === "theta" ? "#f59e0b" : getVarColor(n.name);
                 const display = n.name === "theta" ? "\\theta" : n.name;
                 return `\\textcolor{${color}}{${display}}`;
              }
           }
           return undefined;
        }
      });
      renderedLatex = <span dangerouslySetInnerHTML={{ __html: katex.renderToString(latex, { throwOnError: true }) }} />;
    } catch (e) {
      // Fallback: leaving renderedLatex as null will cause the component to show the plain colored text editor instead
    }
  }

  return (
    <div className="relative flex-1 group" ref={containerRef}>
       <div 
         className={`relative w-full rounded border group-hover:border-slate-350 dark:group-hover:border-slate-700/50 transition-colors cursor-text min-h-[36px] ${isFocused ? 'bg-white dark:bg-slate-900 border-blue-500 dark:border-slate-500 shadow-sm' : 'bg-slate-100 dark:bg-slate-900/40 border-slate-200 dark:border-transparent'}`}
         onClick={() => {
            if (!isFocused) setIsFocused(true);
            setTimeout(() => inputRef.current?.focus(), 10);
         }}
       >
         <div className={`relative w-full ${isFocused || error || !renderedLatex ? 'block' : 'hidden'}`}>
            <div className="px-2 py-1.5 font-mono text-sm whitespace-pre-wrap break-all pointer-events-none opacity-0 select-none z-0 w-full min-h-[28px]">
               {value + "\n."}
            </div>
            
            <div className="absolute inset-0 px-2 py-1.5 pointer-events-none font-mono text-sm whitespace-pre-wrap break-all z-0">
               {getColoredText()}
            </div>
            <textarea
              ref={inputRef}
              value={value}
              onChange={(e) => {
                 onChange(e.target.value);
                 setCursorPos(e.target.selectionStart || 0);
              }}
              onClick={(e) => setCursorPos(e.currentTarget.selectionStart || 0)}
              onKeyUp={(e) => setCursorPos(e.currentTarget.selectionStart || 0)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 200)}
              onKeyDown={handleKeyDown}
              className="absolute inset-0 w-full h-full bg-transparent outline-none caret-blue-550 dark:caret-blue-400 font-mono text-sm px-2 py-1.5 z-20 resize-none text-transparent"
              placeholder={isFocused ? "e.g. a * sin(b*x + c)" : ""}
              spellCheck={false}
              autoComplete="off"
              style={{ overflow: 'hidden' }}
            />
         </div>

         {(!isFocused && renderedLatex && !error) && (
            <div className="w-full px-2 py-2 flex items-center overflow-x-auto custom-scrollbar">
               <div className="text-slate-805 dark:text-slate-200 text-[13px] [&_.katex]:text-[14px] [&_.katex-display]:m-0">{renderedLatex}</div>
            </div>
         )}
       </div>
       
       {error && <div className="text-[10px] text-red-400 mt-1 ml-1 flex items-center gap-1 opacity-80"><span className="w-1 h-1 rounded-full bg-red-400 block" />{error}</div>}

       {suggestions.length > 0 && inputRect && createPortal(
          <div 
             className="fixed bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-2xl rounded-lg overflow-hidden z-[99999] flex flex-col py-1 text-slate-800 dark:text-slate-200"
             style={{
                top: inputRect.bottom + 4,
                left: inputRect.left,
                width: Math.max(256, inputRect.width)
             }}
          >
             {suggestions.map((s, idx) => (
                <div key={s.name} className={`px-3 py-1.5 flex flex-col cursor-pointer transition-colors ${idx === selIndex ? 'bg-slate-100 dark:bg-slate-700' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`} onClick={() => {
                   const match = value.slice(0, cursorPos).match(/[a-zA-Z_]\w*$/);
                   if (match) {
                      const before = value.slice(0, cursorPos - match[0].length);
                      const after = value.slice(cursorPos);
                      onChange(before + s.insert + after);
                   }
                }}>
                   <div className="flex items-baseline justify-between">
                     <span className="font-mono text-blue-600 dark:text-blue-400 text-sm font-semibold">{s.name}</span>
                     <span className="text-[10px] text-slate-550 dark:text-slate-500">{idx === selIndex ? 'Tab to insert' : ''}</span>
                   </div>
                   <span className="text-xs text-slate-500 dark:text-slate-400">{s.desc}</span>
                </div>
             ))}
          </div>,
          document.body
       )}
    </div>
  );
};

const getHexWithAlpha = (baseHex: string, alpha: number) => {
  if (!baseHex) return "#ffffff33";
  let cleanHex = baseHex;
  if (baseHex.startsWith("#")) {
    if (baseHex.length === 9) {
      cleanHex = baseHex.substring(0, 7);
    } else if (baseHex.length === 5) {
      cleanHex = "#" + baseHex[1] + baseHex[1] + baseHex[2] + baseHex[2] + baseHex[3] + baseHex[3];
    } else if (baseHex.length === 4) {
      cleanHex = "#" + baseHex[1] + baseHex[1] + baseHex[2] + baseHex[2] + baseHex[3] + baseHex[3];
    }
  } else {
    return baseHex;
  }
  const rounded = Math.max(0, Math.min(255, Math.round(alpha * 255)));
  const hexAlpha = rounded.toString(16).padStart(2, "0");
  return `${cleanHex}${hexAlpha}`;
};

const stripAlpha = (hex: string) => {
  if (hex && hex.startsWith("#") && hex.length === 9) {
    return hex.substring(0, 7);
  }
  return hex;
};

const ReadableColorBadge = ({ color }: { color: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(color);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy color", err);
    }
  };

  return (
    <span 
      onClick={handleCopy}
      className="group/hex relative inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50 cursor-pointer font-mono text-[10px] text-slate-700 dark:text-slate-300 font-semibold select-none transition-all hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:border-blue-200 dark:hover:border-blue-800"
      title="Click to copy HEX color"
    >
      <span className="w-2.5 h-2.5 rounded-sm border border-slate-300 dark:border-slate-650 shrink-0 shadow-xs" style={{ backgroundColor: color }} />
      <span>{color}</span>
      <span className="inline-flex items-center opacity-0 group-hover/hex:opacity-100 transition-opacity">
        {copied ? (
          <span className="text-green-500 font-bold scale-110">✓</span>
        ) : (
          <Copy className="w-2.5 h-2.5 text-slate-400 group-hover/hex:text-blue-500 dark:group-hover/hex:text-blue-400" />
        )}
      </span>
      {/* Tooltip */}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/hex:block bg-slate-900 text-white text-[9px] py-0.5 px-1.5 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none font-sans font-normal opacity-95">
        {copied ? "Copied!" : "Copy color"}
      </span>
    </span>
  );
};

const PortalColorPicker = ({
  isOpen,
  onClose,
  color,
  onChange,
  title,
  triggerEl
}: {
  isOpen: boolean;
  onClose: () => void;
  color: string;
  onChange: (c: string) => void;
  title: string;
  triggerEl: HTMLElement | null;
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!isOpen || !triggerEl || !popoverRef.current) return;

    const updatePosition = () => {
      const trigger = triggerEl;
      const popover = popoverRef.current;
      if (!trigger || !popover) return;

      const triggerRect = trigger.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Desired position is directly underneath, horizontally centered on the trigger
      let top = triggerRect.bottom + 8;
      let left = triggerRect.left + triggerRect.width / 2 - popoverRect.width / 2;

      // Check if it goes beyond the bottom of the viewport
      if (top + popoverRect.height > viewportHeight) {
        // Space above trigger instead
        const spaceAbove = triggerRect.top - 8 - popoverRect.height;
        if (spaceAbove > 10) {
          top = spaceAbove;
        } else {
          // If no space above either, position it matching the bottom safely clamped
          top = Math.max(10, viewportHeight - popoverRect.height - 10);
        }
      }

      // Check horizontal bounds
      if (left < 10) {
        left = 10;
      } else if (left + popoverRect.width > viewportWidth - 10) {
        left = viewportWidth - popoverRect.width - 10;
      }

      // Ensure top is not negative if viewport is tiny
      if (top < 10) { top = 10; }

      setCoords({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition, { passive: true });
    window.addEventListener("scroll", updatePosition, { passive: true });

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition);
    };
  }, [isOpen, triggerEl]);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const popover = popoverRef.current;
      const trigger = triggerEl;

      if (
        popover && !popover.contains(event.target as Node) &&
        trigger && !trigger.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose, triggerEl]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: "fixed",
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        zIndex: 9999,
      }}
      className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl w-[220px] flex flex-col items-center gap-2 animate-fadeIn"
    >
      <div className="flex justify-between items-center w-full mb-1">
        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{title}</span>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="w-[196px] polygon-picker">
        <HexAlphaColorPicker color={color} onChange={onChange} />
      </div>
      <input
        type="text"
        value={color}
        onChange={(e) => {
          const val = e.target.value;
          if (val.startsWith("#") && val.length <= 9) {
            onChange(val);
          }
        }}
        className="w-full text-center font-mono text-[10px] py-1 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 uppercase outline-none focus:border-blue-500"
        placeholder="#HEXCODE"
      />
    </div>,
    document.body
  );
};

interface MathNodeRendererProps {
  nodeId: string;
  data: any;
  isExpanded: boolean;
}

const LabelInput = ({ value, onChange, placeholder }: { value: string, onChange: (v: string) => void, placeholder?: string }) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  let renderedLatex = null;
  if (!isFocused && value.trim()) {
    let latexStr = value;
    // Try to parse as mathjs first to give it the "math like" formatting if it is an equation
    try {
      const node = mathjs.parse(value);
      latexStr = node.toTex();
    } catch(e) {
      // It's not a valid mathjs expression, stick to raw value
    }

    try {
      renderedLatex = <span dangerouslySetInnerHTML={{ __html: katex.renderToString(latexStr, { throwOnError: true, displayMode: false }) }} />;
    } catch (e) {
       // If KaTeX still fails (e.g. invalid latex like a raw backslash), fallback to plain text
      renderedLatex = <span className="font-mono">{value}</span>;
    }
  }

  return (
    <div 
      className={`relative w-[180px] rounded border transition-colors cursor-text min-h-[32px] overflow-hidden ${isFocused ? 'bg-white dark:bg-slate-900 border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.5)]' : 'bg-slate-100 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}
      onClick={() => {
        if (!isFocused) setIsFocused(true);
        setTimeout(() => inputRef.current?.focus(), 10);
      }}
    >
      <div className={`relative w-full ${isFocused || !renderedLatex ? 'block' : 'hidden'}`}>
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="w-full bg-transparent outline-none caret-blue-550 dark:caret-blue-400 font-mono text-xs px-2 py-1 resize-y text-slate-800 dark:text-slate-200 custom-scrollbar min-h-[32px] block"
          placeholder={isFocused ? placeholder : ""}
          spellCheck={false}
          autoComplete="off"
          rows={Math.min(4, Math.max(1, value.split('\n').length))}
        />
      </div>

      {(!isFocused && renderedLatex) && (
        <div className="w-full px-2 py-1.5 flex flex-wrap items-center overflow-x-auto overflow-y-hidden custom-scrollbar">
          <div className="text-slate-800 dark:text-slate-200 text-[12px] [&_.katex]:text-[13px] [&_.katex-display]:m-0 min-w-min">{renderedLatex}</div>
        </div>
      )}
    </div>
  );
};

const SafeLabel = ({ at, tex, color }: { at: [number, number], tex: string, color: string }) => {
  if (!tex) return null;
  
  let finalTex = tex;
  try {
    const node = mathjs.parse(tex);
    finalTex = node.toTex();
  } catch(e) {
    // Stick to raw tex
  }

  try {
    katex.renderToString(finalTex, { throwOnError: true });
    return <LaTeX at={at} tex={finalTex} color={color} />;
  } catch (e) {
    return <Text x={at[0]} y={at[1]} color={color} attach="ne">{tex}</Text>;
  }
};

const ImplicitPlot: React.FC<{
  compiledLHS: any;
  compiledRHS: any;
  baseScope: any;
  color: string;
  weight?: number;
  opacity?: number;
}> = ({ compiledLHS, compiledRHS, baseScope, color, weight = 3, opacity = 1 }) => {
  let xRange: [number, number] = [-10, 10];
  let yRange: [number, number] = [-10, 10];

  try {
    const pane = usePaneContext();
    if (pane && pane.xPaneRange && pane.yPaneRange) {
      xRange = pane.xPaneRange;
      yRange = pane.yPaneRange;
    }
  } catch (e) {
    // Fallback if not inside pane context
  }

  const GRID_SIZE = 60;
  
  const segments = React.useMemo(() => {
    if (!compiledLHS) return [];

    const xMin = xRange[0];
    const xMax = xRange[1];
    const yMin = yRange[0];
    const yMax = yRange[1];

    const dx = (xMax - xMin) / GRID_SIZE;
    const dy = (yMax - yMin) / GRID_SIZE;

    const evalF = (x: number, y: number): number => {
      try {
        const lhs = Number(compiledLHS.evaluate({ ...baseScope, x, y }));
        const rhs = compiledRHS ? Number(compiledRHS.evaluate({ ...baseScope, x, y })) : 0;
        return lhs - rhs;
      } catch {
        return NaN;
      }
    };

    const grid: number[][] = [];
    for (let i = 0; i <= GRID_SIZE; i++) {
      grid[i] = [];
      const x = xMin + i * dx;
      for (let j = 0; j <= GRID_SIZE; j++) {
        const y = yMin + j * dy;
        grid[i][j] = evalF(x, y);
      }
    }

    const localSegments: { p1: [number, number]; p2: [number, number] }[] = [];

    const lerp = (
      p1: [number, number],
      p2: [number, number],
      val1: number,
      val2: number
    ): [number, number] => {
      if (Math.abs(val1 - val2) < 1e-9) return p1;
      const t = -val1 / (val2 - val1);
      const clampedT = Math.max(0, Math.min(1, t));
      return [
        p1[0] + clampedT * (p2[0] - p1[0]),
        p1[1] + clampedT * (p2[1] - p1[1])
      ];
    };

    for (let i = 0; i < GRID_SIZE; i++) {
      const x0 = xMin + i * dx;
      const x1 = x0 + dx;
      for (let j = 0; j < GRID_SIZE; j++) {
        const y0 = yMin + j * dy;
        const y1 = y0 + dy;

        const v00 = grid[i][j];
        const v10 = grid[i + 1][j];
        const v11 = grid[i + 1][j + 1];
        const v01 = grid[i][j + 1];

        if (isNaN(v00) || isNaN(v10) || isNaN(v11) || isNaN(v01)) {
          continue;
        }

        const s0 = v00 >= 0 ? 1 : 0;
        const s1 = v10 >= 0 ? 1 : 0;
        const s2 = v11 >= 0 ? 1 : 0;
        const s3 = v01 >= 0 ? 1 : 0;

        const index = (s0 << 3) | (s1 << 2) | (s2 << 1) | s3;

        if (index === 0 || index === 15) continue;

        const p00: [number, number] = [x0, y0];
        const p10: [number, number] = [x1, y0];
        const p11: [number, number] = [x1, y1];
        const p01: [number, number] = [x0, y1];

        const getEdgePoint = (edge: number): [number, number] => {
          switch (edge) {
            case 0: return lerp(p00, p10, v00, v10);
            case 1: return lerp(p10, p11, v10, v11);
            case 2: return lerp(p01, p11, v01, v11);
            case 3: return lerp(p00, p01, v00, v01);
            default: return p00;
          }
        };

        const addSegment = (e1: number, e2: number) => {
          localSegments.push({ p1: getEdgePoint(e1), p2: getEdgePoint(e2) });
        };

        switch (index) {
          case 1:
            addSegment(2, 3);
            break;
          case 2:
            addSegment(1, 2);
            break;
          case 3:
            addSegment(1, 3);
            break;
          case 4:
            addSegment(0, 1);
            break;
          case 5:
            addSegment(0, 3);
            addSegment(1, 2);
            break;
          case 6:
            addSegment(0, 2);
            break;
          case 7:
            addSegment(0, 3);
            break;
          case 8:
            addSegment(0, 3);
            break;
          case 9:
            addSegment(0, 2);
            break;
          case 10:
            addSegment(0, 1);
            addSegment(2, 3);
            break;
          case 11:
            addSegment(0, 1);
            break;
          case 12:
            addSegment(1, 3);
            break;
          case 13:
            addSegment(1, 2);
            break;
          case 14:
            addSegment(2, 3);
            break;
        }
      }
    }

    return localSegments;
  }, [compiledLHS, compiledRHS, baseScope, xRange[0], xRange[1], yRange[0], yRange[1]]);

  return (
    <React.Fragment>
      {segments.map((s, idx) => (
        <Line.Segment
          key={idx}
          point1={s.p1}
          point2={s.p2}
          color={color}
          weight={weight}
          opacity={opacity}
        />
      ))}
    </React.Fragment>
  );
};

const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];

export const MathNodeRenderer: React.FC<MathNodeRendererProps> = ({
  nodeId,
  data,
  isExpanded,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewResetKey, setViewResetKey] = useState(0);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
  const [activeExample, setActiveExample] = useState<string | null>(null);
  const [activeColorPickerFnId, setActiveColorPickerFnId] = useState<string | null>(null);
  const [activeColorPickerType, setActiveColorPickerType] = useState<"outline" | "fill" | null>(null);
  const [activeColorPickerTriggerEl, setActiveColorPickerTriggerEl] = useState<HTMLElement | null>(null);
  const [expandedSettingsFnId, setExpandedSettingsFnId] = useState<string | null>(null);
  
  const [functions, setFunctions] = useState<MathFunction[]>([
    {
      id: "f1",
      expr: "sin(x + t)",
      color: COLORS[0],
      visible: true,
      type: "function"
    },
    {
      id: "f2",
      expr: "a * x^2 + b * x + c",
      color: COLORS[1],
      visible: true,
      type: "function"
    }
  ]);

  const [variables, setVariables] = useState<MathVariable[]>([
    { id: "v1", name: "a", displayName: "Amplitude", description: "Controls wave height", value: 1, defaultValue: 1, min: -5, max: 5, step: 0.1, groupId: "default" },
    { id: "v2", name: "b", displayName: "Frequency", description: "", value: 0, defaultValue: 0, min: -5, max: 5, step: 0.1, groupId: "default" },
    { id: "v3", name: "c", displayName: "Phase Offset", description: "", value: 0, defaultValue: 0, min: -5, max: 5, step: 0.1, groupId: "default" }
  ]);

  const [groups, setGroups] = useState<VariableGroup[]>([
    { id: "default", name: "Mathematical Parameters", isCollapsed: false }
  ]);

  const [searchVar, setSearchVar] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [hoveredVar, setHoveredVar] = useState<string | null>(null);
  const [editingVar, setEditingVar] = useState<MathVariable | null>(null);
  const [showVarEditor, setShowVarEditor] = useState(false);
  const [missingVars, setMissingVars] = useState<string[]>([]);

  // Drag and Drop States for Functions & Variables
  const [draggedFunctionId, setDraggedFunctionId] = useState<string | null>(null);
  const [dragOverFunctionId, setDragOverFunctionId] = useState<string | null>(null);
  const [dragOverFunctionPosition, setDragOverFunctionPosition] = useState<"top" | "bottom" | null>(null);
  const [canDragFunctionId, setCanDragFunctionId] = useState<string | null>(null);

  const [draggedVariableId, setDraggedVariableId] = useState<string | null>(null);
  const [dragOverVariableId, setDragOverVariableId] = useState<string | null>(null);
  const [dragOverVariablePosition, setDragOverVariablePosition] = useState<"top" | "bottom" | null>(null);
  const [canDragVariableId, setCanDragVariableId] = useState<string | null>(null);

  const reorderList = <T extends { id: string }>(
    list: T[],
    draggedId: string,
    targetId: string,
    position: "top" | "bottom"
  ): T[] => {
    if (draggedId === targetId) return list;
    const draggedIndex = list.findIndex(item => item.id === draggedId);
    if (draggedIndex === -1) return list;
    
    const newList = [...list];
    const [draggedItem] = newList.splice(draggedIndex, 1);
    
    const targetIndex = newList.findIndex(item => item.id === targetId);
    if (targetIndex === -1) return list;
    
    const insertIndex = position === "bottom" ? targetIndex + 1 : targetIndex;
    newList.splice(insertIndex, 0, draggedItem);
    return newList;
  };

  const handleDropFunction = (targetId: string, position: "top" | "bottom") => {
    if (!draggedFunctionId || draggedFunctionId === targetId) return;
    setFunctions(prev => reorderList(prev, draggedFunctionId, targetId, position));
    setDraggedFunctionId(null);
    setDragOverFunctionId(null);
    setDragOverFunctionPosition(null);
  };

  const handleDropVariable = (targetId: string, targetGroupId: string, position: "top" | "bottom") => {
    if (!draggedVariableId || draggedVariableId === targetId) return;
    setVariables(prev => {
      const updatedGroupId = prev.map(v => 
        v.id === draggedVariableId ? { ...v, groupId: targetGroupId } : v
      );
      return reorderList(updatedGroupId, draggedVariableId, targetId, position);
    });
    setDraggedVariableId(null);
    setDragOverVariableId(null);
    setDragOverVariablePosition(null);
  };

  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isResizingSidebar) return;
    const handleMouseMove = (e: MouseEvent) => {
       if (sidebarRef.current) {
          const rect = sidebarRef.current.getBoundingClientRect();
          const newWidth = Math.max(250, Math.min(e.clientX - rect.left, 800));
          setSidebarWidth(newWidth);
       }
    };
    const handleMouseUp = () => setIsResizingSidebar(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
       window.removeEventListener('mousemove', handleMouseMove);
       window.removeEventListener('mouseup', handleMouseUp);
    }
  }, [isResizingSidebar]);

  const [time, setTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [timeMode, setTimeMode] = useState<"loop" | "bounce" | "continuous">("loop");
  const [timeBounds, setTimeBounds] = useState({ min: 0, max: 10, speed: 1, direction: 1 });
  const [showTimeSettings, setShowTimeSettings] = useState(false);
  const [tracePoints, setTracePoints] = useState(false);
  const [gridType, setGridType] = useState<"cartesian" | "polar" | "none">("cartesian");
  const [axisFilter, setAxisFilter] = useState<"all" | "even" | "odd" | "custom">("even"); // Default to even as it was before
  const [customAxisFilter, setCustomAxisFilter] = useState("n % 3 == 0");
  const [graphSize, setGraphSize] = useState({ width: 800, height: 600 });
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const appTheme = useStore((state) => state.appTheme);

  const getAxisLabel = (n: number) => {
    if (n === 0) return 0; // Usually the origin is skipped or 0, let's keep 0
    if (axisFilter === "all") return n % 1 === 0 ? n : "";
    if (axisFilter === "even") return n % 2 === 0 ? n : "";
    if (axisFilter === "odd") return Math.abs(n % 2) === 1 ? n : "";
    if (axisFilter === "custom") {
      try {
        const res = mathjs.evaluate(customAxisFilter, { n });
        return res ? n : "";
      } catch {
        return "";
      }
    }
    return n;
  };

  useEffect(() => {
    if (!graphContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setGraphSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(graphContainerRef.current);
    return () => observer.disconnect();
  }, [isFullscreen, isExpanded]);

  const timeRef = useRef(0);

  const reqRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Compile functions & extract variables
  useEffect(() => {
    const varsToAdd = new Set<string>();
    const assignedVars = new Set<string>();

    const newFunctions = functions.map(f => {
      try {
        if (f.type === "implicit") {
          const parts = f.expr.split('=');
          const lhsStr = parts[0].trim();
          const rhsStr = parts[1] ? parts[1].trim() : '0';
          
          const lhsNode = mathjs.parse(lhsStr);
          const rhsNode = mathjs.parse(rhsStr);
          const compiledLHS = lhsNode.compile();
          const compiledRHS = rhsNode.compile();

          // Add object label/name to assigned variables to prevent missing var prompts
          if (f.label) assignedVars.add(f.label);
          if (f.name) assignedVars.add(f.name);

          const extractSymbols = (node: any) => {
            node.traverse((n: any) => {
              if (n.isSymbolNode && !["x", "y", "t", "theta"].includes(n.name) && !mathjs[n.name as keyof typeof mathjs] && !assignedVars.has(n.name)) {
                varsToAdd.add(n.name);
              }
            });
          };
          extractSymbols(lhsNode);
          extractSymbols(rhsNode);

          return { ...f, compiled: compiledLHS, compiled2: compiledRHS, error: undefined };
        }

        const node = mathjs.parse(f.expr);
        const compiled = node.compile();
        
        // Add object label/name to assigned variables to prevent missing var prompts
        if (f.label) assignedVars.add(f.label);
        if (f.name) assignedVars.add(f.name);

        // Find assigned variables first (LHS)
        node.traverse((n: any, path: string, parent: any) => {
           if (n.isAssignmentNode) {
             if (n.object && n.object.isSymbolNode) {
               assignedVars.add(n.object.name);
             } else if (n.name) { // sometimes simple assignments just have name
               assignedVars.add(n.name); 
             }
           }
           if (n.isFunctionAssignmentNode) {
             assignedVars.add(n.name);
           }
        });

        // Auto-extract variables
        node.traverse((n: any) => {
          if (n.isSymbolNode && !["x", "y", "t", "theta"].includes(n.name) && !mathjs[n.name as keyof typeof mathjs] && !assignedVars.has(n.name)) {
            varsToAdd.add(n.name);
          }
        });

        return { ...f, compiled, error: undefined };
      } catch (e: any) {
        return { ...f, compiled: undefined, error: e.message };
      }
    });

    setFunctions(newFunctions);

    // Detect missing vars
    const currentVarNames = new Set(variables.map(v => v.name));
    const missing = Array.from(varsToAdd).filter(v => !currentVarNames.has(v) && !assignedVars.has(v));
    setMissingVars(missing);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [functions.map(f => f.expr).join(","), variables.map(v => v.name).join(",")]); // Compile when expressions or variables change

  // Animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
      lastTimeRef.current = 0;
      return;
    }

    const loop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;
      
      setTime(prevTime => {
        let newTime = prevTime + (dt * timeBounds.speed * timeBounds.direction);
        
        if (timeMode !== "continuous") {
          if (newTime >= timeBounds.max) {
             if (timeMode === "loop") newTime = timeBounds.min;
             else if (timeMode === "bounce") {
                newTime = timeBounds.max;
                setTimeBounds(b => ({ ...b, direction: -1 }));
             }
          } else if (newTime <= timeBounds.min) {
             if (timeMode === "loop") newTime = timeBounds.max;
             else if (timeMode === "bounce") {
                newTime = timeBounds.min;
                setTimeBounds(b => ({ ...b, direction: 1 }));
             }
          }
        }
        
        timeRef.current = newTime;
        return newTime;
      });
      
      reqRef.current = requestAnimationFrame(loop);
    };

    reqRef.current = requestAnimationFrame(loop);
    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, [isPlaying, timeBounds.speed, timeBounds.direction, timeBounds.min, timeBounds.max, timeMode]);

  const baseScope = variables.reduce((acc, v) => ({ ...acc, [v.name]: v.value }), {} as any);
  baseScope.t = time;

  // Pre-evaluate functions so definitions or matrices are available sequentially 
  functions.forEach(f => {
    if (f.compiled) {
      try {
        const val = f.compiled.evaluate(baseScope);
        const refName = f.label || f.name;
        if (refName) {
          baseScope[refName] = val;
        }
      } catch (e) {}
    }
  });

  const handleUpdateVar = (id: string, updates: Partial<MathVariable>) => {
    setVariables(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
  };

  const handleAutoAddVar = (name: string) => {
    const newVar: MathVariable = {
      id: Math.random().toString(36).substring(7),
      name,
      displayName: "",
      description: "",
      value: 1,
      defaultValue: 1,
      min: -10,
      max: 10,
      step: 0.1,
      groupId: "default"
    };
    setVariables(prev => [...prev, newVar]);
  };

  const handleDeleteVar = (id: string) => {
    setVariables(prev => prev.filter(v => v.id !== id));
  };

  const handleUpdateExpr = (id: string, expr: string) => {
    setFunctions(prev => prev.map(f => f.id === id ? { ...f, expr } : f));
  };

  const handleAddFunction = () => {
    setFunctions(prev => [...prev, {
      id: Math.random().toString(36).substring(7),
      expr: "x",
      color: COLORS[prev.length % COLORS.length],
      visible: true,
      type: "function"
    }]);
  };

  const handleAddFunctionAt = (targetFnId: string, position: "above" | "below") => {
    setFunctions(prev => {
      const targetIndex = prev.findIndex(f => f.id === targetFnId);
      if (targetIndex === -1) return prev;

      const newFn = {
        id: Math.random().toString(36).substring(7),
        expr: "x",
        color: COLORS[(prev.length) % COLORS.length],
        visible: true,
        type: "function" as const
      };

      const insertIndex = position === "above" ? targetIndex : targetIndex + 1;
      const next = [...prev];
      next.splice(insertIndex, 0, newFn);
      return next;
    });
  };

  const handleDuplicateFunction = (targetFnId: string) => {
    setFunctions(prev => {
      const targetIndex = prev.findIndex(f => f.id === targetFnId);
      if (targetIndex === -1) return prev;

      const targetFn = prev[targetIndex];
      const newFn = {
        ...targetFn,
        id: Math.random().toString(36).substring(7),
        color: COLORS[(prev.length) % COLORS.length]
      };

      const next = [...prev];
      next.splice(targetIndex + 1, 0, newFn);
      return next;
    });
  };

  const handleAddVariableAt = (targetVarId: string, position: "above" | "below") => {
    setVariables(prev => {
      const targetIndex = prev.findIndex(v => v.id === targetVarId);
      if (targetIndex === -1) return prev;
      
      const targetVar = prev[targetIndex];
      
      // Let's generate a unique variable name
      const alphabets = "abcdefghijklmnopqrstuvwxyzkmnpqrstuvw";
      let chosenName = "k";
      const existingNames = new Set(prev.map(v => v.name.toLowerCase()));
      for (const char of alphabets) {
        if (!existingNames.has(char)) {
          chosenName = char;
          break;
        }
      }
      if (existingNames.has(chosenName)) {
        let suffix = 1;
        while (existingNames.has(`k_${suffix}`)) {
          suffix++;
        }
        chosenName = `k_${suffix}`;
      }
      
      const newVar: MathVariable = {
        id: Math.random().toString(36).substring(7),
        name: chosenName,
        displayName: `${chosenName.toUpperCase()} Parameter`,
        description: "",
        value: 1,
        defaultValue: 1,
        min: -10,
        max: 10,
        step: 0.1,
        groupId: targetVar.groupId,
        showSlider: true
      };
      
      const insertIndex = position === "above" ? targetIndex : targetIndex + 1;
      const next = [...prev];
      next.splice(insertIndex, 0, newVar);
      return next;
    });
  };

  const handleRemoveFunction = (id: string) => {
    setFunctions(prev => prev.filter(f => f.id !== id));
    setActiveExample(null);
  };

  const handleLoadExample = (exampleName: string) => {
    if (activeExample === exampleName) {
      setFunctions([]);
      setVariables([]);
      setActiveExample(null);
      return;
    }
    setActiveExample(exampleName);
    if (exampleName === 'Lissajous') {
       setFunctions([
         { id: "f1", expr: "[A * sin(a*t + d), B * sin(b*t)]", type: "parametric", color: COLORS[0], visible: true }
       ]);
       setVariables([
         { id: "v1", name: "A", displayName: "Amplitude X", description: "", value: 3, defaultValue: 3, min: 0, max: 5, step: 0.1, groupId: "default" },
         { id: "v2", name: "B", displayName: "Amplitude Y", description: "", value: 3, defaultValue: 3, min: 0, max: 5, step: 0.1, groupId: "default" },
         { id: "v3", name: "a", displayName: "Freq X", description: "", value: 3, defaultValue: 3, min: 0, max: 5, step: 0.1, groupId: "default" },
         { id: "v4", name: "b", displayName: "Freq Y", description: "", value: 4, defaultValue: 4, min: 0, max: 5, step: 0.1, groupId: "default" },
         { id: "v5", name: "d", displayName: "Phase", description: "", value: Math.PI/2, defaultValue: Math.PI/2, min: 0, max: Math.PI*2, step: 0.1, groupId: "default" }
       ]);
    } else if (exampleName === 'Fourier') {
       setFunctions([
         { id: "f1", expr: "4/pi * (sin(x) + sin(3*x)/3 + sin(5*x)/5 + sin(7*x)/7)", type: "function", color: COLORS[2], visible: true }
       ]);
       setVariables([]);
    } else if (exampleName === 'Wave') {
       setFunctions([
         { id: "f1", expr: "A * sin(k*x - w*t + phi)", type: "function", color: COLORS[3], visible: true }
       ]);
       setVariables([
         { id: "v1", name: "A", displayName: "Amplitude", description: "", value: 2, defaultValue: 2, min: 0, max: 5, step: 0.1, groupId: "default" },
         { id: "v2", name: "k", displayName: "Wave Number", description: "", value: 2, defaultValue: 2, min: 0, max: 10, step: 0.1, groupId: "default" },
         { id: "v3", name: "w", displayName: "Angular Freq", description: "", value: 3, defaultValue: 3, min: 0, max: 10, step: 0.1, groupId: "default" },
         { id: "v4", name: "phi", displayName: "Phase String", description: "", value: 0, defaultValue: 0, min: 0, max: 6.28, step: 0.1, groupId: "default" },
       ]);
    } else if (exampleName === 'Geometry') {
       setFunctions([
         { id: "f1", expr: "A = [2, 3]", type: "point", color: COLORS[0], visible: true },
         { id: "f2", expr: "B = [-1, 2]", type: "point", color: COLORS[1], visible: true },
         { id: "f3", expr: "C = [1, -2]", type: "point", color: COLORS[2], visible: true },
         { id: "f4", expr: "[A, B, C]", type: "polygon", color: COLORS[3], visible: true },
         { id: "f5", expr: "v = A - B", type: "vector", color: COLORS[4], visible: true },
         { id: "f6", expr: "[r * cos(t), r * sin(t)]", type: "parametric", color: COLORS[5], visible: true }
       ]);
       setVariables([
         { id: "v1", name: "r", displayName: "Circle Radius", description: "Radius of implicit circle", value: 2, defaultValue: 2, min: 0.1, max: 10, step: 0.1, groupId: "default" }
       ]);
    } else if (exampleName === 'Statistics') {
       setFunctions([
         { id: "f1", expr: "(1/(sigma * sqrt(2*pi))) * e^(-0.5 * ((x - mu)/sigma)^2)", type: "function", color: COLORS[4], visible: true }
       ]);
       setVariables([
         { id: "v1", name: "mu", displayName: "Mean", description: "Center of distribution", value: 0, defaultValue: 0, min: -10, max: 10, step: 0.5, groupId: "default" },
         { id: "v2", name: "sigma", displayName: "Standard Dev", description: "Spread of distribution", value: 1, defaultValue: 1, min: 0.1, max: 5, step: 0.1, groupId: "default" },
       ]);
    }
  };

  const content = (
    <div className={`${appTheme} flex flex-col bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-2xl overflow-hidden transition-all duration-300 ${isFullscreen ? "fixed inset-0 z-[9999] rounded-none" : "w-full h-full rounded-xl"}`}>
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 cursor-move drag-handle">
        <div className="flex items-center gap-2">
          <button 
            className="md:hidden p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-500 dark:text-slate-400 nodrag"
            onClick={() => setIsMobileSidebarOpen(prev => !prev)}
            title="Toggle Sidebar"
          >
            <Menu size={16} />
          </button>
          <Layers size={16} className="hidden md:block text-blue-500 dark:text-blue-400" />
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-300">Advanced Math Graph</span>
        </div>
        <div className="flex items-center gap-1 nodrag">
          <button 
            onClick={() => setViewResetKey(k => k + 1)}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            title="Reset Origin (Center Graph)"
          >
            <Crosshair size={16} />
          </button>
          <button 
            onClick={() => setShowHelp(true)}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            title="Help & Info"
          >
            <HelpCircle size={16} />
          </button>
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            title={isFullscreen ? "Minimize" : "Maximize Node"}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {!isExpanded && !isFullscreen ? (
        <div className="flex-1 flex items-center justify-center text-slate-500 font-mono text-sm p-4 text-center">
          Expand node to explore mathematics
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden relative">
          
          {/* Mobile Overlay */}
          {isMobileSidebarOpen && (
            <div 
              className="absolute inset-0 bg-slate-900/20 dark:bg-slate-900/40 z-10 md:hidden nodrag"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
          )}
          
          {/* Sidebar */}
          <div 
            ref={sidebarRef}
            className={`bg-slate-50 dark:bg-slate-800 flex flex-col border-r border-slate-200 dark:border-slate-700 nodrag z-20 absolute inset-y-0 left-0 md:relative transition-transform duration-300 md:translate-x-0 max-w-[85vw] ${isMobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`} 
            style={{ width: sidebarWidth }}
            onClick={() => setActiveActionMenuId(null)}
          >
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 custom-scrollbar">
              {/* Functions */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Functions & Equations</h3>
                <button onClick={handleAddFunction} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-550 dark:text-slate-300 transition-colors" title="Add Function">
                  <Plus size={14} />
                </button>
              </div>
              
              <div className="flex flex-col gap-3">
                {functions.map(f => (
                  <div 
                    key={f.id} 
                    draggable={canDragFunctionId === f.id}
                    onDragStart={(e) => {
                      setDraggedFunctionId(f.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDraggedFunctionId(null);
                      setDragOverFunctionId(null);
                      setDragOverFunctionPosition(null);
                      setCanDragFunctionId(null);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      const rect = e.currentTarget.getBoundingClientRect();
                      const relativeY = e.clientY - rect.top;
                      const isTop = relativeY < rect.height / 2;
                      setDragOverFunctionId(f.id);
                      setDragOverFunctionPosition(isTop ? "top" : "bottom");
                    }}
                    onDragLeave={() => {
                      if (dragOverFunctionId === f.id) {
                        setDragOverFunctionId(null);
                        setDragOverFunctionPosition(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragOverFunctionId && dragOverFunctionPosition) {
                        handleDropFunction(f.id, dragOverFunctionPosition);
                      }
                    }}
                    className={`flex items-center gap-2 bg-white dark:bg-slate-900/50 p-2 border-l-[3px] rounded bg-gradient-to-r from-transparent to-slate-100 dark:to-slate-900/20 shadow-sm dark:shadow-inner group transition-all hover:border-slate-400 dark:hover:border-slate-500 relative
                      ${draggedFunctionId === f.id ? "opacity-40" : ""} ${draggedFunctionId !== null ? "[&>*]:pointer-events-none" : ""}
                    `} 
                    style={{ borderLeftColor: f.color }}
                  >
                    {/* Real-time drop insertion line boundary indicator */}
                    {dragOverFunctionId === f.id && dragOverFunctionPosition && (
                      <div 
                        className={`absolute left-0 right-0 h-0.5 bg-blue-500 dark:bg-blue-400 z-50 rounded-full transition-all ${
                          dragOverFunctionPosition === "top" ? "-top-[1px]" : "-bottom-[1px]"
                        }`}
                      />
                    )}
                    {/* Grip Handle */}
                    <div 
                      onMouseDown={() => setCanDragFunctionId(f.id)}
                      onMouseUp={() => setCanDragFunctionId(null)}
                      onTouchStart={() => setCanDragFunctionId(f.id)}
                      onTouchEnd={() => setCanDragFunctionId(null)}
                      className="cursor-grab active:cursor-grabbing text-slate-450 dark:text-slate-500 hover:text-slate-650 dark:hover:text-slate-350 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      title="Drag to reorder"
                    >
                      <GripVertical size={14} />
                    </div>
                    <div 
                      className="w-4 h-4 rounded-full flex-shrink-0 cursor-pointer transition-transform hover:scale-110" 
                      style={{ backgroundColor: f.visible ? f.color : 'transparent', border: `2px solid ${f.color}` }}
                      onClick={() => setFunctions(prev => prev.map(fn => fn.id === f.id ? { ...fn, visible: !fn.visible } : fn))}
                    />
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center font-mono text-sm w-full">
                        <select
                           value={f.type}
                           onChange={(e) => setFunctions(prev => prev.map(fn => fn.id === f.id ? { ...fn, type: e.target.value as any } : fn))}
                           className="bg-slate-100 dark:bg-transparent text-slate-550 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700/50 rounded outline-none p-1 mr-2 text-xs font-semibold cursor-pointer appearance-none text-center"
                           style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                           title={
                             f.type === 'function' ? 'Function (y = f(x))' :
                             f.type === 'polar' ? 'Polar equation (r = f(t))' :
                             f.type === 'parametric' ? 'Parametric equation ([x(t), y(t)])' :
                             f.type === 'implicit' ? 'Implicit equation (f(x,y) = 0)' :
                             f.type === 'vector' ? 'Vector' :
                             f.type === 'point' ? 'Point' :
                             f.type === 'line' ? 'Line Segment' :
                             f.type === 'polygon' ? 'Polygon' : 'Select function type'
                           }
                        >
                           <option value="function" title="Function" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">y =</option>
                           <option value="polar" title="Polar equation" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">r =</option>
                           <option value="parametric" title="Parametric equation" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">[x,y] =</option>
                           <option value="implicit" title="Implicit equation" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">XY =</option>
                           <option value="vector" title="Vector" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">V =</option>
                           <option value="point" title="Point" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">P =</option>
                           <option value="line" title="Line Segment" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">Line =</option>
                           <option value="polygon" title="Polygon" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">Poly =</option>
                        </select>
                        <EquationInput
                           value={f.expr}
                           onChange={(val: string) => handleUpdateExpr(f.id, val)}
                           variables={variables}
                           hoveredVar={hoveredVar}
                           setHoveredVar={setHoveredVar}
                           error={f.error}
                           onAddEnter={handleAddFunction}
                        />
                      </div>
                      {f.type === "point" && (
                         <div className="flex flex-col mt-2 pl-[48px] gap-2 text-[11px]">
                           <div className="flex items-center gap-4">
                             <label className="flex items-center gap-1.5 cursor-pointer group/cb">
                               <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${f.isDraggable ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300 dark:border-slate-500 bg-slate-100 dark:bg-slate-800 group-hover/cb:border-slate-400'}`}>
                                 {f.isDraggable && <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                               </div>
                               <input type="checkbox" checked={f.isDraggable || false} onChange={(e) => setFunctions(prev => prev.map(fn => fn.id === f.id ? { ...fn, isDraggable: e.target.checked } : fn))} className="hidden" />
                               <span className="text-slate-500 dark:text-slate-400 group-hover/cb:text-slate-750 dark:group-hover/cb:text-slate-200 transition-colors">Draggable</span>
                             </label>

                             <label className="flex items-center gap-1.5 cursor-pointer group/cb">
                               <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${f.showLabel ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300 dark:border-slate-500 bg-slate-100 dark:bg-slate-800 group-hover/cb:border-slate-400'}`}>
                                 {f.showLabel && <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                               </div>
                               <input type="checkbox" checked={f.showLabel || false} onChange={(e) => setFunctions(prev => prev.map(fn => fn.id === f.id ? { ...fn, showLabel: e.target.checked } : fn))} className="hidden" />
                               <span className="text-slate-500 dark:text-slate-400 group-hover/cb:text-slate-750 dark:group-hover/cb:text-slate-200 transition-colors">Show Label</span>
                             </label>
                           </div>
                           
                           {f.showLabel && (
                             <div className="flex mt-0.5">
                               <LabelInput value={f.label || ''} onChange={(val) => setFunctions(prev => prev.map(fn => fn.id === f.id ? { ...fn, label: val } : fn))} placeholder="Text or LaTeX (e.g. A_1)" />
                             </div>
                           )}
                         </div>
                      )}                      {f.type === "polygon" && expandedSettingsFnId === f.id && (
                          <div className="flex flex-col mt-2 pl-[48px] gap-2.5 text-[11px] pb-1 animate-fadeIn">
                            {/* Outline/Stroke Color */}
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500 dark:text-slate-400 font-semibold">Outline Color:</span>
                                <ReadableColorBadge color={f.color} />
                              </div>
                              <div className="flex flex-wrap gap-1.5 items-center">
                                {COLORS.map(c => (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() => {
                                      setFunctions(prev => prev.map(fn => fn.id === f.id ? { ...fn, color: c } : fn));
                                      if (activeColorPickerFnId === f.id && activeColorPickerType === "outline") {
                                        setActiveColorPickerFnId(null);
                                        setActiveColorPickerType(null);
                                        setActiveColorPickerTriggerEl(null);
                                      }
                                    }}
                                    className={`w-3.5 h-3.5 rounded-full border transition-transform ${f.color === c ? 'scale-125 border-slate-700 dark:border-white shadow-sm' : 'border-transparent hover:scale-110'}`}
                                    style={{ backgroundColor: c }}
                                    title={c}
                                  />
                                ))}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    if (activeColorPickerFnId === f.id && activeColorPickerType === "outline") {
                                      setActiveColorPickerFnId(null);
                                      setActiveColorPickerType(null);
                                      setActiveColorPickerTriggerEl(null);
                                    } else {
                                      setActiveColorPickerFnId(f.id);
                                      setActiveColorPickerType("outline");
                                      setActiveColorPickerTriggerEl(e.currentTarget);
                                    }
                                  }}
                                  className={`w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer transition-all duration-200 ${
                                    activeColorPickerFnId === f.id && activeColorPickerType === "outline" ? "ring-2 ring-blue-500 scale-115" : "hover:scale-110"
                                  }`}
                                  style={{ background: 'linear-gradient(45deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #a855f7, #ec4899)' }}
                                  title="Spectrum Color Picker"
                                />
                              </div>

                              <PortalColorPicker
                                isOpen={activeColorPickerFnId === f.id && activeColorPickerType === "outline"}
                                onClose={() => {
                                  setActiveColorPickerFnId(null);
                                  setActiveColorPickerType(null);
                                  setActiveColorPickerTriggerEl(null);
                                }}
                                color={f.color}
                                onChange={(newColor) => {
                                  setFunctions(prev => prev.map(fn => fn.id === f.id ? { ...fn, color: newColor } : fn));
                                }}
                                title="Custom Outline Color"
                                triggerEl={activeColorPickerTriggerEl}
                              />
                            </div>

                            {/* Divider */}
                            <div className="border-t border-slate-200 dark:border-slate-800/60 my-0.5" />

                            {/* Is Custom Fill Active */}
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500 dark:text-slate-400 font-semibold font-semibold">Fill Customization</span>
                                <label className="flex items-center gap-1.5 cursor-pointer group/cb">
                                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${f.fillColor !== undefined ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300 dark:border-slate-500 bg-slate-100 dark:bg-slate-800 group-hover/cb:border-slate-400'}`}>
                                    {f.fillColor !== undefined && <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                  </div>
                                  <input 
                                    type="checkbox" 
                                    checked={f.fillColor !== undefined} 
                                    onChange={(e) => {
                                      setFunctions(prev => prev.map(fn => fn.id === f.id ? { 
                                        ...fn, 
                                        fillColor: e.target.checked ? getHexWithAlpha(f.color, f.fillOpacity !== undefined ? f.fillOpacity : 0.2) : undefined 
                                      } : fn));
                                      if (!e.target.checked && activeColorPickerFnId === f.id && activeColorPickerType === "fill") {
                                        setActiveColorPickerFnId(null);
                                        setActiveColorPickerType(null);
                                        setActiveColorPickerTriggerEl(null);
                                      }
                                    }}
                                    className="hidden" 
                                  />
                                  <span className="text-slate-550 dark:text-slate-400 pl-1 group-hover/cb:text-blue-500 dark:group-hover/cb:text-blue-400 select-none font-medium">Different Fill</span>
                                </label>
                              </div>

                              {f.fillColor === undefined ? (
                                <div className="text-[10px] text-slate-400 italic pl-1">
                                  Using outline color for fill.
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1.5 p-1.5 bg-slate-100/50 dark:bg-slate-900/30 rounded border border-slate-200 dark:border-slate-800">
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-400 font-medium">Fill Color Palette:</span>
                                    <ReadableColorBadge color={f.fillColor || f.color} />
                                  </div>
                                  <div className="flex flex-wrap gap-1.5 items-center">
                                    {COLORS.map(c => (
                                      <button
                                        key={c}
                                        type="button"
                                        onClick={() => {
                                          const currentAlpha = f.fillOpacity !== undefined ? f.fillOpacity : 0.2;
                                          const colorWithAlpha = getHexWithAlpha(c, currentAlpha);
                                          setFunctions(prev => prev.map(fn => fn.id === f.id ? { ...fn, fillColor: colorWithAlpha } : fn));
                                          if (activeColorPickerFnId === f.id && activeColorPickerType === "fill") {
                                            setActiveColorPickerFnId(null);
                                            setActiveColorPickerType(null);
                                            setActiveColorPickerTriggerEl(null);
                                          }
                                        }}
                                        className={`w-3.5 h-3.5 rounded-full border transition-transform ${f.fillColor === c ? 'scale-125 border-slate-700 dark:border-white shadow-sm' : 'border-transparent hover:scale-110'}`}
                                        style={{ backgroundColor: c }}
                                        title={c}
                                      />
                                    ))}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        if (activeColorPickerFnId === f.id && activeColorPickerType === "fill") {
                                          setActiveColorPickerFnId(null);
                                          setActiveColorPickerType(null);
                                          setActiveColorPickerTriggerEl(null);
                                        } else {
                                          setActiveColorPickerFnId(f.id);
                                          setActiveColorPickerType("fill");
                                          setActiveColorPickerTriggerEl(e.currentTarget);
                                        }
                                      }}
                                      className={`w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer transition-all duration-200 ${
                                        activeColorPickerFnId === f.id && activeColorPickerType === "fill" ? "ring-2 ring-blue-500 scale-115" : "hover:scale-110"
                                      }`}
                                      style={{ background: 'linear-gradient(45deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #a855f7, #ec4899)' }}
                                      title="Spectrum Fill Picker"
                                    />
                                  </div>

                                  <PortalColorPicker
                                    isOpen={activeColorPickerFnId === f.id && activeColorPickerType === "fill"}
                                    onClose={() => {
                                      setActiveColorPickerFnId(null);
                                      setActiveColorPickerType(null);
                                      setActiveColorPickerTriggerEl(null);
                                    }}
                                    color={getHexWithAlpha(f.fillColor || f.color, f.fillOpacity !== undefined ? f.fillOpacity : 0.2)}
                                    onChange={(newColor) => {
                                      let parsedAlpha = f.fillOpacity !== undefined ? f.fillOpacity : 0.2;
                                      if (newColor.startsWith("#") && newColor.length === 9) {
                                        const alphaHex = newColor.slice(7, 9);
                                        parsedAlpha = Math.round((parseInt(alphaHex, 16) / 255) * 100) / 100;
                                      } else if (newColor.startsWith("#") && newColor.length === 7) {
                                        parsedAlpha = 1.0;
                                      }
                                      setFunctions(prev => prev.map(fn => fn.id === f.id ? { 
                                        ...fn, 
                                        fillColor: newColor, 
                                        fillOpacity: parsedAlpha 
                                      } : fn));
                                    }}
                                    title="Custom Fill Color"
                                    triggerEl={activeColorPickerTriggerEl}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Fill Opacity Slider */}
                            <div className="flex flex-col gap-1 mt-0.5">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500 dark:text-slate-400 font-semibold">Fill Alpha (Transparency)</span>
                                <span className="font-mono text-slate-500 dark:text-slate-400 text-[10px] font-semibold">
                                  {Math.round((f.fillOpacity !== undefined ? f.fillOpacity : 0.2) * 100)}%
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] text-slate-400 font-mono">0.0</span>
                                <input 
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.05"
                                  value={f.fillOpacity !== undefined ? f.fillOpacity : 0.2}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    setFunctions(prev => prev.map(fn => {
                                      if (fn.id === f.id) {
                                        const baseColor = fn.fillColor || fn.color;
                                        const updatedColor = getHexWithAlpha(baseColor, val);
                                        return { 
                                          ...fn, 
                                          fillOpacity: val,
                                          fillColor: updatedColor
                                        };
                                      }
                                      return fn;
                                    }));
                                  }}
                                  className="h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 flex-1 outline-none text-blue-500 dark:text-blue-400"
                                />
                                <span className="text-[9px] text-slate-400 font-mono">1.0</span>
                              </div>
                            </div>
                          </div>
                      )}
                    </div>
                    {f.type === "polygon" && (
                      <button 
                        type="button"
                        onClick={() => setExpandedSettingsFnId(prev => prev === f.id ? null : f.id)}
                        className={`p-1.5 rounded transition-all group-hover:opacity-100 ${
                          expandedSettingsFnId === f.id ? 'opacity-100 bg-blue-500/10 text-blue-500 dark:text-blue-400' : 'opacity-60 group-hover:opacity-100 hover:bg-slate-500/20 text-slate-500 dark:text-slate-400'
                        }`}
                        title="Polygon settings"
                      >
                        <Settings size={14} className={`transform transition-transform duration-300 ${expandedSettingsFnId === f.id ? 'rotate-90 text-blue-500 dark:text-blue-400' : 'hover:rotate-45'}`} />
                      </button>
                    )}
                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 ml-auto nodrag">
                      {/* Mobile toggle button */}
                      <button 
                        className="md:hidden p-1 opacity-60 hover:opacity-100 text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 rounded transition-all flex items-center justify-center"
                        onClick={(e) => { e.stopPropagation(); setActiveActionMenuId(activeActionMenuId === f.id ? null : f.id); }}
                      >
                        <MoreVertical size={16} />
                      </button>
                      
                      {/* Button group */}
                      <div className={`items-center gap-0.5 md:gap-1 ${activeActionMenuId === f.id ? 'flex absolute right-8 top-2 bg-white border border-slate-200 dark:border-slate-700 dark:bg-slate-800 shadow-xl p-1.5 rounded-lg z-50 animate-in fade-in zoom-in-95 duration-200' : 'hidden md:flex'}`}>
                        <button 
                          onClick={() => { setActiveActionMenuId(null); handleAddFunctionAt(f.id, "above"); }}
                          className="p-1.5 md:p-1 md:opacity-0 md:group-hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 rounded transition-all flex items-center justify-center"
                          title="Insert Function Above"
                        >
                          <InsertAboveIcon size={14} />
                        </button>
                        <button 
                          onClick={() => { setActiveActionMenuId(null); handleAddFunctionAt(f.id, "below"); }}
                          className="p-1.5 md:p-1 md:opacity-0 md:group-hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 rounded transition-all flex items-center justify-center"
                          title="Insert Function Below"
                        >
                          <InsertBelowIcon size={14} />
                        </button>
                        <button 
                          onClick={() => { setActiveActionMenuId(null); handleDuplicateFunction(f.id); }}
                          className="p-1.5 md:p-1 md:opacity-0 md:group-hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 rounded transition-all flex items-center justify-center"
                          title="Duplicate Function"
                        >
                          <CopyPlus size={14} strokeWidth={2} />
                        </button>
                        <button 
                          onClick={() => { setActiveActionMenuId(null); handleRemoveFunction(f.id); }}
                          className="p-1.5 md:p-1.5 md:opacity-0 md:group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 text-slate-500 rounded transition-all"
                          title="Remove"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Popular & Examples */}
              <div className="flex flex-col gap-4 pt-3 border-t border-slate-200 dark:border-slate-700/50">
                <div className="flex flex-col gap-2">
                   <h4 className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Quick Inserts & Templates</h4>
                   <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'Linear', fn: 'm*x + b', type: 'function' },
                        { label: 'Quadratic', fn: 'a*x^2 + b*x + c', type: 'function' },
                        { label: 'Polynomial', fn: 'a*x^3 + b*x^2 + c*x + d', type: 'function' },
                        { label: 'Exponential', fn: 'a * e^(k*x)', type: 'function' },
                        { label: 'Logarithmic', fn: 'a * ln(x) + b', type: 'function' },
                        { label: 'Circle', fn: '1', type: 'polar' },
                        { label: 'Spiral', fn: 'a * theta', type: 'polar' },
                        { label: 'Animated Rose', fn: 'sin(3 * theta + t)', type: 'polar' },
                        { label: 'Ellipse (Implicit)', fn: 'x^2/a^2 + y^2/b^2 = 1', type: 'implicit' }
                      ].map(tmpl => (
                         <button 
                           key={tmpl.label} 
                           onClick={() => {
                             setActiveExample(null); // Clear example highlight when custom item is inserted
                             setFunctions(prev => [...prev, { id: Math.random().toString(36).substring(7), expr: tmpl.fn, color: COLORS[prev.length%COLORS.length], type: (tmpl.type as any) || 'function', visible: true }]);
                           }} 
                           className="px-2 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono text-[10px] rounded border border-slate-200 dark:border-slate-700 transition-colors shadow-sm"
                           title={tmpl.type === 'polar' ? `r = ${tmpl.fn}` : tmpl.type === 'implicit' ? `${tmpl.fn}` : `y = ${tmpl.fn}`}
                         >
                           {tmpl.label}
                         </button>
                      ))}
                   </div>
                </div>

                <div className="flex flex-col gap-2">
                   <h4 className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Popular Functions</h4>
                   <div className="flex flex-wrap gap-1.5">
                      {['sin(x)', 'cos(x)', 'x^2', 'x^3', 'e^x', 'ln(x)', 'sin(x)+cos(x)'].map(fn => (
                         <button 
                           key={fn} 
                           onClick={() => {
                             setActiveExample(null); // Clear example highlight when custom equation is inserted
                             setFunctions(prev => [...prev, { id: Math.random().toString(36).substring(7), expr: fn, color: COLORS[prev.length%COLORS.length], type:'function', visible: true }]);
                           }} 
                           className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-800/40 text-blue-600 dark:text-blue-300 font-mono text-[10px] rounded border border-blue-200 dark:border-blue-800/50 transition-colors shadow-sm"
                         >
                           y={fn}
                         </button>
                      ))}
                   </div>
                </div>

                <div className="flex flex-col gap-2 pt-1 border-t border-slate-250 dark:border-slate-700/50">
                   <h4 className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Examples Gallery</h4>
                   <div className="grid grid-cols-2 gap-2">
                       <button 
                         onClick={() => handleLoadExample('Lissajous')} 
                         className={`text-left p-2 rounded transition-all group shadow-sm flex flex-col gap-0.5 border ${
                           activeExample === 'Lissajous'
                             ? 'bg-blue-500/10 border-blue-400 dark:border-blue-500 ring-1 ring-blue-400/50'
                             : 'bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-700/80 border-slate-200 dark:border-slate-700'
                         }`}
                       >
                          <span className="text-[10px] text-blue-500 font-semibold dark:text-blue-400 group-hover:text-blue-600 dark:group-hover:text-blue-300">Animation</span>
                          <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">Lissajous Curves</span>
                       </button>

                       <button 
                         onClick={() => handleLoadExample('Fourier')} 
                         className={`text-left p-2 rounded transition-all group shadow-sm flex flex-col gap-0.5 border ${
                           activeExample === 'Fourier'
                             ? 'bg-emerald-500/10 border-emerald-400 dark:border-emerald-500 ring-1 ring-emerald-400/50'
                             : 'bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-700/80 border-slate-200 dark:border-slate-700'
                         }`}
                       >
                          <span className="text-[10px] text-emerald-600 font-semibold dark:text-emerald-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-300">Mathematics</span>
                          <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">Fourier Series</span>
                       </button>

                       <button 
                         onClick={() => handleLoadExample('Wave')} 
                         className={`text-left p-2 rounded transition-all group shadow-sm flex flex-col gap-0.5 border ${
                           activeExample === 'Wave'
                             ? 'bg-amber-500/10 border-amber-400 dark:border-amber-500 ring-1 ring-amber-400/50'
                             : 'bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-700/80 border-slate-200 dark:border-slate-700'
                         }`}
                       >
                          <span className="text-[10px] text-amber-600 font-semibold dark:text-amber-400 group-hover:text-amber-700 dark:group-hover:text-amber-300">Physics</span>
                          <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">Traveling Wave</span>
                       </button>

                       <button 
                         onClick={() => handleLoadExample('Statistics')} 
                         className={`text-left p-2 rounded transition-all group shadow-sm flex flex-col gap-0.5 border ${
                           activeExample === 'Statistics'
                             ? 'bg-purple-500/10 border-purple-400 dark:border-purple-500 ring-1 ring-purple-400/50'
                             : 'bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-700/80 border-slate-200 dark:border-slate-700'
                         }`}
                       >
                          <span className="text-[10px] text-purple-600 font-semibold dark:text-purple-400 group-hover:text-purple-700 dark:group-hover:text-purple-300">Statistics</span>
                          <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">Normal Dist.</span>
                       </button>

                       <button 
                         onClick={() => handleLoadExample('Geometry')} 
                         className={`text-left p-2 rounded transition-all group shadow-sm flex flex-col gap-0.5 border ${
                           activeExample === 'Geometry'
                             ? 'bg-pink-500/10 border-pink-400 dark:border-pink-500 ring-1 ring-pink-400/50'
                             : 'bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-700/80 border-slate-200 dark:border-slate-700'
                         }`}
                       >
                          <span className="text-[10px] text-pink-600 font-semibold dark:text-pink-400 group-hover:text-pink-700 dark:group-hover:text-pink-300">Geometry</span>
                          <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">Vectors & Polygons</span>
                       </button>
                   </div>
                </div>
              </div>

            </div>

            {/* Variables */}
            <div className="flex flex-col gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-xs text-slate-400 uppercase tracking-wider">Variables Manager</h3>
                <div className="flex items-center gap-1">
                   <button onClick={() => setShowSearch(!showSearch)} className={`p-1 rounded text-slate-500 dark:text-slate-300 transition-colors ${showSearch ? 'bg-slate-200 dark:bg-slate-700' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`} title="Search Variables">
                     <Search size={14} />
                   </button>
                   <button onClick={() => { setEditingVar(null); setShowVarEditor(true); }} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-300 transition-colors" title="Add Variable">
                     <Plus size={14} />
                   </button>
                </div>
              </div>
              
              {showSearch && (
                <input 
                  type="text" 
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 mt-[-8px] outline-none focus:border-blue-500 transition-all" 
                  placeholder="Search variables..." 
                  value={searchVar} 
                  onChange={e => setSearchVar(e.target.value)} 
                />
              )}

              {missingVars.length > 0 && (
                <div className="bg-blue-900/20 border border-blue-500/30 p-2.5 rounded-lg flex flex-col gap-2">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-blue-400">Detected missing variables</div>
                  <div className="flex flex-wrap gap-1.5">
                    {missingVars.map(mv => (
                       <button key={mv} className="bg-blue-600/80 hover:bg-blue-500 text-white px-2 py-0.5 rounded text-xs transition-colors flex items-center gap-1 shadow-sm" onClick={() => handleAutoAddVar(mv)}>
                         <Plus size={10} /> {mv}
                       </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-5">
                {groups.map(group => {
                  const groupVars = variables.filter(v => 
                    v.groupId === group.id && 
                    (v.name.toLowerCase().includes(searchVar.toLowerCase()) || (v.displayName && v.displayName.toLowerCase().includes(searchVar.toLowerCase())))
                  );
                  
                  // Hide empty groups ONLY when there is an active search query
                  if (groupVars.length === 0 && searchVar) return null;
                  const isEmpty = groupVars.length === 0;
                  
                  return (
                    <div key={group.id} className="flex flex-col gap-2">
                       <div className="flex items-center justify-between group/header text-[10px] font-semibold text-slate-500 uppercase select-none">
                         <div 
                           className="flex items-center gap-1 cursor-pointer hover:text-slate-705 dark:hover:text-slate-350" 
                           onClick={() => setGroups(groups.map(g => g.id === group.id ? { ...g, isCollapsed: !g.isCollapsed } : g))}
                         >
                           {group.isCollapsed ? <ChevronRight size={12}/> : <ChevronDown size={12}/>}
                           <span>{group.name}</span>
                         </div>
                         
                         {/* Allow deletion of empty custom groups */}
                         {group.id !== "default" && isEmpty && (
                           <button 
                             onClick={() => {
                               setGroups(prev => prev.filter(g => g.id !== group.id));
                             }} 
                             className="text-slate-400 hover:text-red-500 opacity-0 group-hover/header:opacity-100 transition-opacity p-0.5"
                             title="Delete empty group"
                           >
                             <Trash2 size={10} />
                           </button>
                         )}
                       </div>

                       {!group.isCollapsed && isEmpty && (
                         <div 
                           onDragOver={(e) => {
                             e.preventDefault();
                             // Set drop indicator for this group
                             setDragOverVariableId(`empty_${group.id}`);
                           }}
                           onDragLeave={() => {
                             if (dragOverVariableId === `empty_${group.id}`) {
                               setDragOverVariableId(null);
                             }
                           }}
                           onDrop={(e) => {
                             e.preventDefault();
                             if (draggedVariableId) {
                               // Drop into this group
                               setVariables(prev => prev.map(v => 
                                 v.id === draggedVariableId ? { ...v, groupId: group.id } : v
                               ));
                             }
                             setDragOverVariableId(null);
                             setDraggedVariableId(null);
                           }}
                           className={`border-2 border-dashed rounded-lg p-3 text-center text-xs transition-all flex flex-col items-center justify-center gap-1 min-h-[64px] ${
                             dragOverVariableId === `empty_${group.id}` 
                               ? "border-blue-500 bg-blue-500/10 text-blue-500" 
                               : "border-slate-200 dark:border-slate-800/60 text-slate-400 dark:text-slate-500 hover:border-slate-350 dark:hover:border-slate-700"
                           }`}
                         >
                           <Folder className="opacity-30" size={14} />
                           <span>Empty. Drag variables here.</span>
                         </div>
                       )}

                       {!group.isCollapsed && groupVars.map(v => (
                         <div 
                           key={v.id} 
                            draggable={canDragVariableId === v.id}
                            onDragStart={(e) => {
                              setDraggedVariableId(v.id);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onDragEnd={() => {
                              setDraggedVariableId(null);
                              setDragOverVariableId(null);
                              setDragOverVariablePosition(null);
                              setCanDragVariableId(null);
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              const rect = e.currentTarget.getBoundingClientRect();
                              const relativeY = e.clientY - rect.top;
                              const isTop = relativeY < rect.height / 2;
                              setDragOverVariableId(v.id);
                              setDragOverVariablePosition(isTop ? "top" : "bottom");
                            }}
                            onDragLeave={() => {
                              if (dragOverVariableId === v.id) {
                                setDragOverVariableId(null);
                                setDragOverVariablePosition(null);
                              }
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (dragOverVariableId && dragOverVariablePosition) {
                                handleDropVariable(v.id, group.id, dragOverVariablePosition);
                              }
                            }}
                            className={`flex flex-col gap-2 bg-white dark:bg-slate-900/50 p-3 rounded-lg border group transition-all relative ${
                              hoveredVar === v.name ? 'border-blue-500/50' : 'border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600'
                            } ${draggedVariableId === v.id ? "opacity-40" : ""} ${draggedVariableId !== null ? "[&>*]:pointer-events-none" : ""} ${
                              ""
                            } ${
                              ""
                            }`}
                           onMouseEnter={() => setHoveredVar(v.name)}
                           onMouseLeave={() => setHoveredVar(null)}
                         >
                           {/* Real-time drop insertion line boundary indicator */}
                           {dragOverVariableId === v.id && dragOverVariablePosition && (
                             <div 
                               className={`absolute left-0 right-0 h-0.5 bg-blue-500 dark:bg-blue-400 z-50 rounded-full transition-all ${
                                 dragOverVariablePosition === "top" ? "-top-[1px]" : "-bottom-[1px]"
                               }`}
                             />
                           )}
                           <div className="flex items-start justify-between">
                              <div className="flex items-center gap-1.5">
                                {/* Grip Handle */}
                                <div 
                                  onMouseDown={() => setCanDragVariableId(v.id)}
                                  onMouseUp={() => setCanDragVariableId(null)}
                                  onTouchStart={() => setCanDragVariableId(v.id)}
                                  onTouchEnd={() => setCanDragVariableId(null)}
                                  className="cursor-grab active:cursor-grabbing text-slate-450 dark:text-slate-605 hover:text-slate-650 dark:hover:text-slate-350 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                  title="Drag to reorder"
                                >
                                  <GripVertical size={12} />
                                </div>
                                <div className="flex flex-col">
                                 <div className="flex items-baseline gap-2">
                                    <span className="text-sm font-mono font-semibold" style={{ color: getVarColor(v.name) }}>{v.name}</span>
                                    <span className="text-[10px] font-mono text-slate-500">=</span>
                                    <input 
                                      type="number" 
                                      value={v.value}
                                      onChange={e => handleUpdateVar(v.id, { value: parseFloat(e.target.value) || 0 })}
                                      className="w-16 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-mono px-1.5 py-0.5 rounded outline-none border border-slate-200 dark:border-transparent focus:border-blue-500"
                                    />
                                 </div>
                                 {v.displayName && <span className="text-xs text-slate-400 mt-0.5">{v.displayName}</span>}
                              </div>
                              </div>
                              <div className="flex items-center gap-1 ml-auto">
                                {/* Mobile toggle button */}
                                <button 
                                  className="md:hidden p-1 opacity-60 hover:opacity-100 text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 rounded transition-all flex items-center justify-center nodrag"
                                  onClick={(e) => { e.stopPropagation(); setActiveActionMenuId(activeActionMenuId === v.id ? null : v.id); }}
                                >
                                  <MoreVertical size={16} />
                                </button>
                                
                                {/* Button group */}
                                <div className={`items-center gap-0.5 md:gap-1 ${activeActionMenuId === v.id ? 'flex absolute right-8 top-2 bg-white border border-slate-200 dark:border-slate-700 dark:bg-slate-800 shadow-xl p-1.5 rounded-lg z-50 animate-in fade-in zoom-in-95 duration-200' : 'hidden md:flex'}`}>
                                   <button className="p-1.5 md:p-1 md:opacity-0 md:group-hover:opacity-100 text-slate-455 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-blue-500 dark:hover:text-blue-400 rounded flex items-center justify-center transition-all opacity-100" onClick={() => { setActiveActionMenuId(null); handleAddVariableAt(v.id, "above"); }} title="Insert Variable Above">
                                     <InsertAboveIcon size={14} />
                                   </button>
                                   <button className="p-1.5 md:p-1 md:opacity-0 md:group-hover:opacity-100 text-slate-455 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-blue-500 dark:hover:text-blue-400 rounded flex items-center justify-center transition-all opacity-100" onClick={() => { setActiveActionMenuId(null); handleAddVariableAt(v.id, "below"); }} title="Insert Variable Below">
                                     <InsertBelowIcon size={14} />
                                   </button>
                                   <button className="p-1.5 md:p-1 md:opacity-0 md:group-hover:opacity-100 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-200 rounded transition-all opacity-100" onClick={() => { setActiveActionMenuId(null); handleUpdateVar(v.id, { value: v.defaultValue }); }} title="Reset"><RotateCcw size={12}/></button>
                                   <button className="p-1.5 md:p-1 md:opacity-0 md:group-hover:opacity-100 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-200 rounded transition-all opacity-100" onClick={() => { setActiveActionMenuId(null); setEditingVar(v); setShowVarEditor(true); }} title="Edit"><Edit2 size={12}/></button>
                                   <button className="p-1.5 md:p-1 md:opacity-0 md:group-hover:opacity-100 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-200 rounded transition-all opacity-100" onClick={() => { setActiveActionMenuId(null); setEditingVar({...v, id: Math.random().toString(36).substring(7), name: v.name + "_copy"}); setShowVarEditor(true); }} title="Duplicate"><Copy size={12}/></button>
                                   <button className="p-1.5 md:p-1 md:opacity-0 md:group-hover:opacity-100 text-slate-400 hover:bg-red-500/20 hover:text-red-400 rounded transition-all opacity-100" onClick={() => { setActiveActionMenuId(null); handleDeleteVar(v.id); }} title="Delete"><Trash2 size={12}/></button>
                                </div>
                              </div>
                           </div>
                           
                           {v.description && <div className="text-[10px] text-slate-500 italic leading-tight">{v.description}</div>}
                           
                           {v.showSlider !== false && (
                             <div className="flex items-center gap-2 mt-1">
                               <span className="text-[10px] text-slate-500 font-mono w-6 text-right select-none">{v.min}</span>
                               <input 
                                 type="range" 
                                 min={v.min} 
                                 max={v.max} 
                                 step={v.step} 
                                 value={v.value}
                                 onChange={(e) => handleUpdateVar(v.id, { value: parseFloat(e.target.value) })}
                                 className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer hover:bg-slate-305 dark:hover:bg-slate-600 transition-colors flex-1"
                                 style={{ accentColor: getVarColor(v.name) }}
                               />
                               <span className="text-[10px] text-slate-500 font-mono w-6 text-left select-none">{v.max}</span>
                             </div>
                           )}
                         </div>
                       ))}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Timeline & Controls */}
            <div className="flex flex-col gap-3 mt-auto pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Timeline (t)</h3>
                <button 
                  onClick={() => setTracePoints(!tracePoints)}
                  className={`p-1.5 rounded transition-colors text-xs flex items-center gap-1 ${tracePoints ? "bg-emerald-500/20 dark:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
                  title="Trace Points"
                >
                  <Crosshair size={12} /> Trace
                </button>
              </div>
              
              <div className="flex items-center gap-2 justify-center bg-slate-50 dark:bg-slate-900/50 py-2 rounded-lg border border-slate-200 dark:border-slate-800/50 shadow-xs">
                <button 
                  onClick={() => {
                    setTime(timeBounds.min);
                    timeRef.current = timeBounds.min;
                  }} 
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400 hover:text-slate-905 dark:hover:text-white transition-colors"
                  title="Reset Time"
                >
                  <SkipBack size={16} />
                </button>
                <button 
                  onClick={() => setIsPlaying(!isPlaying)} 
                  className={`p-2.5 rounded-full text-white shadow-md transition-transform hover:scale-105 ${isPlaying ? "bg-slate-600 hover:bg-slate-500" : "bg-blue-600 hover:bg-blue-500"}`}
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
                </button>
                <button 
                  onClick={() => setShowTimeSettings(!showTimeSettings)}
                  className={`p-1.5 rounded transition-colors ${showTimeSettings ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}
                  title="Timeline Settings"
                >
                  <Settings size={16} />
                </button>
              </div>
              
              {showTimeSettings && (
                <div className="flex flex-col gap-2 p-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs text-slate-705 dark:text-slate-300">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-500 dark:text-slate-400">Range</span>
                    <div className="flex items-center gap-1.5">
                      <input 
                        type="number" 
                        value={timeBounds.min}
                        onChange={(e) => setTimeBounds(prev => ({ ...prev, min: Number(e.target.value) }))}
                        className="w-12 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-750 text-slate-800 dark:text-slate-100 rounded px-1 py-0.5 outline-none focus:border-blue-500" 
                        title="Start Time"
                      />
                      <span className="text-slate-500 text-[10px]">to</span>
                      <input 
                        type="number" 
                        value={timeBounds.max}
                        onChange={(e) => setTimeBounds(prev => ({ ...prev, max: Number(e.target.value) }))}
                        className="w-12 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-750 text-slate-800 dark:text-slate-100 rounded px-1 py-0.5 outline-none focus:border-blue-500" 
                        title="End Time"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-500 dark:text-slate-400">Mode</span>
                    <div className="flex gap-1 bg-slate-200 dark:bg-slate-800 p-0.5 rounded border border-slate-300 dark:border-slate-700">
                      {(["continuous", "loop", "bounce"] as const).map(m => (
                        <button
                          key={m}
                          onClick={() => setTimeMode(m)}
                          className={`px-2 py-0.5 rounded capitalize ${timeMode === m ? 'bg-blue-600 text-white shadow-xs' : 'hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'}`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-500 dark:text-slate-400">Speed</span>
                    <input 
                      type="number" 
                      step="0.1"
                      value={timeBounds.speed}
                      onChange={(e) => setTimeBounds(prev => ({ ...prev, speed: Number(e.target.value) }))}
                      className="w-16 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-750 text-slate-800 dark:text-slate-100 rounded px-1 py-0.5 outline-none focus:border-blue-500" 
                      title="Playback Speed"
                    />
                  </div>
                </div>
              )}
              
              <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-900/50 py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-800/50 shadow-xs">
                <div className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300 font-mono">
                  <span className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider">time</span>
                  <span>{time.toFixed(2)}</span>
                </div>
                
                {timeMode !== "continuous" && (
                  <div className="w-full flex items-center justify-center">
                    <input 
                      type="range"
                      min={timeBounds.min}
                      max={timeBounds.max}
                      step={(timeBounds.max - timeBounds.min) / 1000}
                      value={time}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setTime(val);
                        timeRef.current = val;
                      }}
                      onMouseDown={() => setIsPlaying(false)}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer outline-none hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors accent-blue-500"
                    />
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>

          {/* Splitter */}
          <div 
            className="hidden md:flex w-1 bg-slate-700/50 hover:bg-blue-500 cursor-col-resize z-20 flex-col justify-center transition-colors relative group"
            onMouseDown={() => setIsResizingSidebar(true)}
          >
             <div className="absolute inset-y-0 -left-1 -right-1 cursor-col-resize z-20"></div>
             <div className="w-1 h-8 bg-slate-500 rounded-full mx-auto group-hover:bg-white transition-colors" />
          </div>

          <style>
            {`
              .group\\/graph .MafsView {
                --mafs-bg: ${appTheme === "dark" ? "#020617" : "#ffffff"} !important;
                --mafs-fg: ${appTheme === "dark" ? "#f8fafc" : "#0f172a"} !important;
                --mafs-line-color: ${appTheme === "dark" ? "#334155" : "#e2e8f0"} !important;
                --grid-line-subdivision-color: ${appTheme === "dark" ? "#1e293b" : "#f1f5f9"} !important;
              }
            `}
          </style>

          {/* Graph Canvas */}
          <div 
            ref={graphContainerRef} 
            className={`flex-1 relative ${appTheme === "dark" ? "bg-slate-950" : "bg-white"} overflow-hidden select-none nodrag cursor-crosshair group/graph`}
            style={{
              "--mafs-bg": appTheme === "dark" ? "#020617" : "#ffffff",
              "--mafs-fg": appTheme === "dark" ? "#f8fafc" : "#0f172a",
              "--mafs-line-color": appTheme === "dark" ? "#334155" : "#e2e8f0",
              "--grid-line-subdivision-color": appTheme === "dark" ? "#1e293b" : "#f1f5f9"
            } as React.CSSProperties}
          >
             {/* Graph Controls */}
             <div className="absolute top-4 left-4 z-40 flex bg-slate-900/80 backdrop-blur border border-slate-700/50 rounded-lg pointer-events-auto p-1 shadow-2xl opacity-0 group-hover/graph:opacity-100 transition-opacity duration-300">
               <button 
                 onClick={() => setGridType("none")} 
                 className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors ${gridType === "none" ? "bg-slate-700 text-slate-200 shadow" : "text-slate-400 hover:text-slate-300 hover:bg-slate-800"}`}
                 title="No Grid"
               >None</button>
               <button 
                 onClick={() => setGridType("cartesian")} 
                 className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors ${gridType === "cartesian" ? "bg-slate-700 text-slate-200 shadow" : "text-slate-400 hover:text-slate-300 hover:bg-slate-800"}`}
                 title="Cartesian Grid"
               >Cartesian</button>
               <button 
                 onClick={() => setGridType("polar")} 
                 className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors ${gridType === "polar" ? "bg-slate-700 text-slate-200 shadow" : "text-slate-400 hover:text-slate-300 hover:bg-slate-800"}`}
                 title="Polar Grid"
               >Polar</button>
               <div className="w-px bg-slate-700 my-1 mx-1"></div>
               <select 
                 value={axisFilter}
                 onChange={(e) => setAxisFilter(e.target.value as any)}
                 className="bg-transparent text-slate-400 hover:text-slate-200 outline-none px-2 text-xs font-mono rounded-md cursor-pointer appearance-none"
                 title="Axis Label Filter"
               >
                 <option value="all" className="bg-slate-800">Labels: All</option>
                 <option value="even" className="bg-slate-800">Labels: Even</option>
                 <option value="odd" className="bg-slate-800">Labels: Odd</option>
                 <option value="custom" className="bg-slate-800">Labels: Custom</option>
               </select>
               {axisFilter === "custom" && (
                 <div className="relative flex items-center group/filterinfo">
                   <input 
                     type="text" 
                     value={customAxisFilter}
                     onChange={(e) => setCustomAxisFilter(e.target.value)}
                     className="bg-slate-900 border border-slate-600 rounded px-2 w-24 text-xs font-mono text-slate-200 outline-none focus:border-blue-500 ml-1"
                     placeholder="e.g. n % 3 == 0"
                   />
                   <HelpCircle className="w-3.5 h-3.5 text-slate-400 ml-1.5 cursor-help" />
                   
                   <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-slate-800 border border-slate-600 rounded-lg text-xs text-slate-300 shadow-2xl opacity-0 group-hover/filterinfo:opacity-100 pointer-events-none transition-opacity whitespace-normal z-50">
                     <p className="font-semibold text-slate-200 mb-1">Custom Label Filter</p>
                     <p className="mb-1">Use a valid mathjs expression returning a boolean. The variable <code className="text-blue-400 bg-slate-900 px-1 rounded">n</code> represents the axis sub-division value.</p>
                     <p className="text-slate-400">Examples:</p>
                     <ul className="list-disc pl-4 text-slate-400 mt-0.5 space-y-0.5">
                       <li><code className="text-blue-400">n % 3 == 0</code> (multiples of 3)</li>
                       <li><code className="text-blue-400">abs(n) &gt; 2</code> (skip -2 to 2)</li>
                       <li><code className="text-blue-400">n &gt; 0</code> (positive only)</li>
                     </ul>
                   </div>
                 </div>
               )}
             </div>

             <Mafs 
              key={viewResetKey}
              width={graphSize.width}
              height={graphSize.height}
              zoom={{ min: 0.1, max: 20 }}
              viewBox={{ x: [-5, 5], y: [-5, 5] }}
              preserveAspectRatio="contain"
              pan={true}
             >
                {gridType === "cartesian" && (
                  <Coordinates.Cartesian 
                    xAxis={{ lines: 1, labels: getAxisLabel }}
                    yAxis={{ lines: 1, labels: getAxisLabel }}
                    subdivisions={4}
                  />
                )}
                {gridType === "polar" && (
                  <Coordinates.Polar 
                    lines={1}
                    subdivisions={4}
                  />
                )}
                
                {functions.filter(f => f.visible).map(f => {
                  if (f.compiled) {
                    if (f.type === "point" || f.type === "vector" || f.type === "polygon" || f.type === "line") {
                      try {
                        const evaluated = f.compiled.evaluate(baseScope);
                        let points: [number, number][] = [];
                        
                        // Handle mathjs Matrix or JS Array
                        const data = evaluated && evaluated.toArray ? evaluated.toArray() : evaluated;
                        
                        if (Array.isArray(data)) {
                          if (data.length === 2 && typeof data[0] === 'number') {
                            points = [[Number(data[0]), Number(data[1])]];
                          } else if (data.length > 0 && Array.isArray(data[0])) {
                            points = data.map(p => [(p as any)[0] || 0, (p as any)[1] || 0]);
                          }
                        }

                        // Filter out valid numbers only to prevent SVG crashes
                        points = points.filter(p => !isNaN(p[0]) && !isNaN(p[1]) && isFinite(p[0]) && isFinite(p[1]));

                        if (points.length === 0) return null;

                        return (
                          <React.Fragment key={f.id}>
                             {f.type === "point" && points.map((p, i) => {
                               const showLabel = f.showLabel && f.label;
                               return (
                                 <React.Fragment key={i}>
                                   {f.isDraggable && points.length === 1 ? (
                                     <MovablePoint 
                                       point={[p[0], p[1]]} 
                                       color={f.color} 
                                       onMove={(newPt) => {
                                         let newExpr = `[${newPt[0].toFixed(2)}, ${newPt[1].toFixed(2)}]`;
                                         const match = f.expr.match(/^([^=]+=\s*)/);
                                         if (match) {
                                           newExpr = `${match[1]} [${newPt[0].toFixed(2)}, ${newPt[1].toFixed(2)}]`;
                                         }
                                         handleUpdateExpr(f.id, newExpr);
                                       }} 
                                     />
                                   ) : (
                                     <Point x={p[0]} y={p[1]} color={f.color} />
                                   )}
                                   {showLabel && (
                                     <SafeLabel at={[p[0] + 0.3, p[1] + 0.3]} tex={f.label || ""} color={f.color} />
                                   )}
                                 </React.Fragment>
                               );
                             })}
                             {f.type === "vector" && points.map((p, i) => (
                               <Vector key={i} tail={[0,0]} tip={p} color={f.color} />
                             ))}
                             {f.type === "polygon" && points.length > 2 && (
                               <Polygon 
                                 points={points} 
                                 color={f.color} 
                                 fillOpacity={f.fillOpacity !== undefined ? f.fillOpacity : 0.2}
                                 svgPolygonProps={{
                                   style: {
                                     fill: stripAlpha(f.fillColor !== undefined ? f.fillColor : f.color),
                                     stroke: f.color
                                   }
                                 }}
                               />
                             )}
                             {f.type === "line" && points.length >= 2 && (
                               <Line.Segment point1={points[0]} point2={points[1]} color={f.color} />
                             )}
                          </React.Fragment>
                        );
                      } catch {
                        return null;
                      }
                    }

                    if (f.type === "parametric") {
                      return (
                        <React.Fragment key={f.id}>
                          <Plot.Parametric
                            xy={(t: number) => {
                               try {
                                 const res = f.compiled.evaluate({ ...baseScope, t });
                                 const arr = res && res.toArray ? res.toArray() : res;
                                 if (Array.isArray(arr) && arr.length >= 2) {
                                  return [Number(arr[0]), Number(arr[1])];
                                 }
                                 return [0, 0];
                               } catch {
                                 return [0, 0];
                               }
                            }}
                            t={[0, 2 * Math.PI]} 
                            color={f.color}
                            weight={hoveredVar && new RegExp(`\\b${hoveredVar}\\b`).test(f.expr) ? 6 : 3}
                            opacity={hoveredVar ? (new RegExp(`\\b${hoveredVar}\\b`).test(f.expr) ? 1 : 0.3) : 1}
                          />
                        </React.Fragment>
                      );
                    }

                    if (f.type === "implicit") {
                      return (
                        <ImplicitPlot
                          key={f.id}
                          compiledLHS={f.compiled}
                          compiledRHS={f.compiled2}
                          baseScope={baseScope}
                          color={f.color}
                          weight={hoveredVar && new RegExp(`\\b${hoveredVar}\\b`).test(f.expr) ? 6 : 3}
                          opacity={hoveredVar ? (new RegExp(`\\b${hoveredVar}\\b`).test(f.expr) ? 1 : 0.3) : 1}
                        />
                      );
                    }

                    if (f.type === "polar") {
                      const useThetaAsAngle = /\btheta\b/.test(f.expr);
                      return (
                        <React.Fragment key={f.id}>
                          <Plot.Parametric
                            xy={(tVal: number) => {
                               try {
                                 const scope = { ...baseScope };
                                 if (useThetaAsAngle) {
                                   scope.theta = tVal;
                                   scope.x = tVal;
                                 } else {
                                   scope.t = tVal;
                                   scope.x = tVal;
                                   scope.theta = tVal;
                                 }
                                 const r = Number(f.compiled.evaluate(scope));
                                 if (isNaN(r) || (typeof r === 'object')) return [0, 0];
                                 return [r * Math.cos(tVal), r * Math.sin(tVal)];
                               } catch {
                                 return [0, 0];
                               }
                            }}
                            t={[0, 2 * Math.PI * 5]} // Up to 5 full rotations, can adjust if user wants varying domain
                            color={f.color}
                            weight={hoveredVar && new RegExp(`\\b${hoveredVar}\\b`).test(f.expr) ? 6 : 3}
                            opacity={hoveredVar ? (new RegExp(`\\b${hoveredVar}\\b`).test(f.expr) ? 1 : 0.3) : 1}
                          />
                          {tracePoints && (
                             <Point 
                               x={(() => {
                                 try {
                                   const tVal = time/2 % (2*Math.PI);
                                   const scope = { ...baseScope };
                                   if (useThetaAsAngle) {
                                     scope.theta = tVal;
                                     scope.x = tVal;
                                   } else {
                                     scope.t = tVal;
                                     scope.x = tVal;
                                     scope.theta = tVal;
                                   }
                                   const r = Number(f.compiled.evaluate(scope));
                                   return typeof r === 'object' ? NaN : r * Math.cos(tVal);
                                 } catch { return 0; }
                               })()}
                               y={(() => {
                                 try {
                                   const tVal = time/2 % (2*Math.PI);
                                   const scope = { ...baseScope };
                                   if (useThetaAsAngle) {
                                     scope.theta = tVal;
                                     scope.x = tVal;
                                   } else {
                                     scope.t = tVal;
                                     scope.x = tVal;
                                     scope.theta = tVal;
                                   }
                                   const r = Number(f.compiled.evaluate(scope));
                                   return typeof r === 'object' ? NaN : r * Math.sin(tVal);
                                 } catch { return 0; }
                               })()}
                               color={f.color}
                             />
                          )}
                        </React.Fragment>
                      );
                    }
                    // Cartesian default
                    return (
                      <React.Fragment key={f.id}>
                        <Plot.OfX
                          y={x => {
                            try {
                              const res = f.compiled.evaluate({ ...baseScope, x });
                              // Return NaN if imaginary or invalid
                              if (typeof res === 'object' && res.im !== undefined) return NaN;
                              return Number(res);
                            } catch {
                              return NaN;
                            }
                          }}
                          color={f.color}
                          weight={hoveredVar && new RegExp(`\\b${hoveredVar}\\b`).test(f.expr) ? 6 : 3}
                          opacity={hoveredVar ? (new RegExp(`\\b${hoveredVar}\\b`).test(f.expr) ? 1 : 0.3) : 1}
                        />
                        {/* Trace Point Support */}
                        {tracePoints && (
                           <Point 
                             x={time % 10 - 5} 
                             y={(() => {
                               try {
                                 const res = f.compiled.evaluate({ ...baseScope, x: time % 10 - 5 });
                                 return typeof res === 'object' ? NaN : Number(res);
                               } catch {
                                 return 0;
                               }
                             })()} 
                             color={f.color}
                             opacity={hoveredVar ? (new RegExp(`\\b${hoveredVar}\\b`).test(f.expr) ? 1 : 0.3) : 1} 
                           />
                        )}
                      </React.Fragment>
                     );
                  }
                  return null;
                })}
             </Mafs>

             {isFullscreen && (
               <div className="absolute top-4 right-4 bg-white/90 dark:bg-slate-900/80 backdrop-blur border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-mono p-3 rounded-lg shadow-2xl">
                 <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1 border-b border-slate-200 dark:border-slate-700 pb-1">Inspector</div>
                 <div className="flex flex-col gap-1 mt-2">
                   {functions.filter(f => f.visible && f.compiled).map(f => {
                     try {
                        if (f.type === 'function') {
                           const val = f.compiled.evaluate({ ...baseScope, x: time % 10 - 5 });
                           if (val == null || typeof val === 'object' || typeof val === 'function' || isNaN(Number(val))) return null;
                           const y = Number(val).toFixed(2);
                           return <div key={f.id} className="flex gap-2"><span style={{color: f.color}}>f({(time % 10 - 5).toFixed(1)})</span>: {y}</div>
                        } else if (f.type === 'parametric' || f.type === 'polar') {
                           const tVal = time/2 % (2*Math.PI);
                           if (f.type === 'polar') {
                             const useThetaAsAngle = /\btheta\b/.test(f.expr);
                             const scope = { ...baseScope };
                             if (useThetaAsAngle) {
                               scope.theta = tVal;
                               scope.x = tVal;
                             } else {
                               scope.t = tVal;
                               scope.x = tVal;
                               scope.theta = tVal;
                             }
                             const r = Number(f.compiled.evaluate(scope));
                             if (isNaN(r)) return null;
                             return <div key={f.id} className="flex gap-2"><span style={{color: f.color}}>r({tVal.toFixed(1)})</span>: {r.toFixed(2)}</div>
                           } else {
                             const res = f.compiled.evaluate({ ...baseScope, t: tVal });
                             const arr = res && res.toArray ? res.toArray() : res;
                             if (Array.isArray(arr) && arr.length >= 2 && !isNaN(Number(arr[0])) && !isNaN(Number(arr[1]))) {
                               return <div key={f.id} className="flex gap-2"><span style={{color: f.color}}>[x,y]({tVal.toFixed(1)})</span>: [{Number(arr[0]).toFixed(2)}, {Number(arr[1]).toFixed(2)}]</div>
                             }
                           }
                        } else if (f.type === 'point' || f.type === 'vector') {
                           const evaluated = f.compiled.evaluate(baseScope);
                           const data = evaluated && evaluated.toArray ? evaluated.toArray() : evaluated;
                           if (Array.isArray(data)) {
                             // Handle nested array or flat array
                             const pt = Array.isArray(data[0]) ? data[0] : data;
                             if (pt.length >= 2 && !isNaN(Number(pt[0])) && !isNaN(Number(pt[1]))) {
                               return <div key={f.id} className="flex gap-2"><span style={{color: f.color}}>{f.type === 'point' ? 'P' : 'V'}</span>: [{Number(pt[0]).toFixed(2)}, {Number(pt[1]).toFixed(2)}]</div>
                             }
                           }
                        }
                        return null;
                     } catch {
                        return null;
                     }
                   })}
                 </div>
               </div>
             )}
          </div>

          {/* Help Modal Overlay */}
          {showHelp && (
            <div className="absolute inset-0 z-50 bg-slate-900/60 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6">
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-2xl rounded-xl w-full max-w-2xl max-h-full flex flex-col nodrag cursor-default text-slate-800 dark:text-slate-200">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 rounded-t-xl">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <HelpCircle size={18} className="text-blue-400" />
                    Advanced Math Graph Guide
                  </h3>
                  <button onClick={() => setShowHelp(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded transition-colors">
                    <X size={18} />
                  </button>
                </div>
                <div className="p-5 overflow-y-auto custom-scrollbar flex flex-col gap-6 text-sm text-slate-600 dark:text-slate-300">
                  <section>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2 border-b border-slate-200 dark:border-slate-700 pb-1">Mathematical Elements (Types)</h4>
                    <p className="mb-2">Click the type selector on the left of any equation to change its type and behavior:</p>
                    <ul className="space-y-2">
                       <li><strong className="text-blue-400">y = (Function)</strong> Standard Cartesian functions. Example: <code>sin(x)</code></li>
                       <li><strong className="text-blue-400">r = (Polar)</strong> Polar coordinates using 't' or 'theta'. Example: <code>sin(5*t)</code></li>
                       <li><strong className="text-blue-400">[x,y] = (Parametric)</strong> Parametric curves. Example: <code>[cos(t), sin(t)]</code></li>
                       <li><strong className="text-blue-400">XY = (Implicit)</strong> Not supported dynamically yet. (Placeholder)</li>
                       <li><strong className="text-blue-400">V = (Vector)</strong> Draw a directed vector. Example: <code>[3, 1]</code> or <code>A - B</code></li>
                       <li><strong className="text-blue-400">P = (Point)</strong> Plot points on the graph. Example: <code>[2, 3]</code></li>
                       <li><strong className="text-blue-400">Poly = (Polygon)</strong> Draw a filled polygon connecting points. Example: <code>[A, B, C]</code></li>
                    </ul>
                  </section>
                  <section>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2 border-b border-slate-200 dark:border-slate-700 pb-1">Expressions & Constants</h4>
                    <p className="mb-2">Enter any valid mathematical expression using standard syntax. Supported by <code>math.js</code>.</p>
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700/50 font-mono text-xs">
                      <div className="text-blue-500 dark:text-blue-400 mb-1">operators: <span className="text-slate-700 dark:text-slate-300">+, -, *, /, ^, %</span></div>
                      <div className="text-blue-500 dark:text-blue-400 mb-1">functions: <span className="text-slate-700 dark:text-slate-300">sin(x), cos(x), tan(x), sqrt(x), log(x), exp(x), abs(x)</span></div>
                      <div className="text-blue-500 dark:text-blue-400">constants: <span className="text-slate-700 dark:text-slate-300">pi, e, phi, tau</span></div>
                    </div>
                  </section>
                  <section>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2 border-b border-slate-200 dark:border-slate-700 pb-1">Automated Custom Variables</h4>
                    <p className="mb-2">
                      When you type an unknown variable into an expression (like <code className="text-blue-400 font-mono">a, b, m, k, freq</code>), the node will <strong>automatically create a slider</strong> for it. 
                      You don't need to manually define them.
                    </p>
                    <ul className="list-disc pl-5 space-y-1.5 marker:text-slate-500">
                      <li><strong><code className="text-blue-400 font-mono">a, b, c...</code></strong>: Custom variables automatically generate adjustable sliders.</li>
                      <li><strong><code className="text-blue-400 font-mono">x</code></strong>: The built-in horizontal axis space.</li>
                      <li><strong><code className="text-blue-400 font-mono">t</code></strong>: The built-in timeline space. Link it to expressions like <code className="text-blue-400 font-mono">sin(x + t)</code> to create animations!</li>
                    </ul>
                  </section>
                  <section>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2 border-b border-slate-200 dark:border-slate-700 pb-1">Interactive Geometry Workspace</h4>
                    <p className="mb-2">You can construct geometry like GeoGebra using draggable points and references!</p>
                    <ul className="list-disc pl-5 space-y-1.5 marker:text-slate-500">
                      <li><strong>Create Points:</strong> Add a Point <code>[2, 3]</code>, give it a Label (e.g., <code>A</code>), and toggle <strong>Draggable</strong>.</li>
                      <li><strong>Reference Points:</strong> Create another Point <code>B</code>. Now add a <strong>Line Segment</strong> or <strong>Polygon</strong> and use the points: <code>[A, B]</code>.</li>
                      <li><strong>Drag to Update:</strong> Dragging point <code>A</code> on the canvas will automatically update the line or polygon in real-time!</li>
                    </ul>
                  </section>
                  <section>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2 border-b border-slate-200 dark:border-slate-700 pb-1">Drawing Modes & Features</h4>
                    <ul className="list-disc pl-5 space-y-1.5 marker:text-slate-500">
                      <li><strong>Graph Tracing:</strong> Use the "Trace" button on the timeline to spawn an active particle that tracks the function at the current time <code>t</code>.</li>
                      <li><strong>Full Screen:</strong> Click the Maximize icon to enter full-screen immersive mathematics mode. Useful for studying intersections.</li>
                      <li><strong>Inspector:</strong> When Maximized, a HUD will appear displaying real-time coordinate positions of the active Trace points.</li>
                    </ul>
                  </section>
                </div>
                <div className="p-4 border-t border-slate-700 bg-slate-800/80 rounded-b-xl flex justify-end">
                  <button onClick={() => setShowHelp(false)} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium shadow transition-colors">
                    Get Started
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Editor Modal Overlay */}
          {showVarEditor && (
            <VariableEditorModal 
               variable={editingVar}
               groups={groups}
               existingVariables={variables}
               onSave={(newVar: any, newGroup?: any) => {
                 if (newGroup) {
                   setGroups(prev => {
                     if (prev.some(g => g.id === newGroup.id || g.name.toLowerCase() === newGroup.name.toLowerCase())) {
                       return prev;
                     }
                     return [...prev, newGroup];
                   });
                 }
                 if (variables.some((v: any) => v.id === newVar.id)) {
                    handleUpdateVar(newVar.id, newVar);
                 } else {
                    setVariables(prev => [...prev, newVar]);
                 }
                 setShowVarEditor(false);
                 setEditingVar(null);
               }}
               onClose={() => {
                 setShowVarEditor(false);
                 setEditingVar(null);
               }}
            />
          )}

        </div>
      )}
    </div>
  );

  return isFullscreen ? (
    <>
      <div className="w-full h-full flex items-center justify-center bg-slate-900 border border-slate-700 rounded-xl relative overflow-hidden group">
         <div className="absolute inset-0 opacity-20 pointer-events-none">
           <svg width="100%" height="100%">
             <pattern id="math-grid" width="20" height="20" patternUnits="userSpaceOnUse">
               <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-slate-500" />
             </pattern>
             <rect width="100%" height="100%" fill="url(#math-grid)" />
           </svg>
         </div>
         <div className="flex flex-col items-center gap-3 z-10">
           <Layers className="text-blue-500 w-12 h-12 opacity-80" />
           <span className="text-sm font-semibold text-slate-300">Math Graph Maximized</span>
           <button 
             onClick={() => setIsFullscreen(false)}
             className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-colors shadow-lg"
           >
             Restore View
           </button>
         </div>
      </div>
      {createPortal(content, document.body)}
    </>
  ) : (
    content
  );
};
