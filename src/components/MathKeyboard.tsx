import React, { useState, useEffect } from "react";
import {
  X,
  Delete,
  ArrowLeft,
  ArrowRight,
  CornerDownLeft,
  History,
  Star,
  Calculator,
} from "lucide-react";

interface MathKeyboardProps {
  onInsert: (insertStr: string, isTemplate?: boolean) => void;
  onDelete: () => void;
  onMoveCursor?: (dir: "left" | "right") => void;
  onAction?: (action: "enter" | "undo" | "redo" | "space") => void;
  onClose: () => void;
  variables?: any[];
}

const CATEGORIES = [
  { id: "common", label: "Common", icon: Calculator },
  { id: "functions", label: "f(x)" },
  { id: "trig", label: "sin" },
  { id: "calculus", label: "∫ dx" },
  { id: "greek", label: "αβγ" },
];

const SYMBOLS: Record<
  string,
  {
    label: React.ReactNode;
    insert: string;
    template?: boolean;
    variant?: "number" | "operator" | "function" | "variable" | "template";
  }[]
> = {
  common: [
    { label: "7", insert: "7", variant: "number" },
    { label: "8", insert: "8", variant: "number" },
    { label: "9", insert: "9", variant: "number" },
    { label: "+", insert: "+", variant: "operator" },
    { label: "−", insert: "-", variant: "operator" },

    { label: "4", insert: "4", variant: "number" },
    { label: "5", insert: "5", variant: "number" },
    { label: "6", insert: "6", variant: "number" },
    { label: "×", insert: "*", variant: "operator" },
    { label: "÷", insert: "/", variant: "operator" },

    { label: "1", insert: "1", variant: "number" },
    { label: "2", insert: "2", variant: "number" },
    { label: "3", insert: "3", variant: "number" },
    { label: "=", insert: "=", variant: "operator" },
    { label: "xⁿ", insert: "^", variant: "operator" },

    { label: "0", insert: "0", variant: "number" },
    { label: ".", insert: ".", variant: "number" },
    { label: "π", insert: "pi", variant: "variable" },
    { label: "e", insert: "e", variant: "variable" },
    { label: "%", insert: "%", variant: "operator" },

    { label: "x", insert: "x", variant: "variable" },
    { label: "y", insert: "y", variant: "variable" },
    { label: "t", insert: "t", variant: "variable" },
    { label: "(", insert: "(", variant: "template" },
    { label: ")", insert: ")", variant: "template" },

    { label: "sin", insert: "sin()", template: true, variant: "function" },
    { label: "cos", insert: "cos()", template: true, variant: "function" },
    { label: "tan", insert: "tan()", template: true, variant: "function" },
    { label: "log", insert: "log()", template: true, variant: "function" },
    { label: "ln", insert: "ln()", template: true, variant: "function" },

    { label: "√", insert: "sqrt()", template: true, variant: "function" },
    { label: "x²", insert: "^2", variant: "function" },
    { label: ",", insert: ",", variant: "operator" },
    { label: "<", insert: "<", variant: "operator" },
    { label: ">", insert: ">", variant: "operator" },
  ],
  functions: [
    { label: "x²", insert: "^2", variant: "function" },
    { label: "x³", insert: "^3", variant: "function" },
    { label: "xⁿ", insert: "^", variant: "function" },
    { label: "√", insert: "sqrt()", template: true, variant: "function" },
    { label: "ⁿ√", insert: "nthRoot(, )", template: true, variant: "function" },
    { label: "abs", insert: "abs()", template: true, variant: "function" },
    { label: "log", insert: "log()", template: true, variant: "function" },
    { label: "log₁₀", insert: "log10()", template: true, variant: "function" },
    { label: "exp", insert: "exp()", template: true, variant: "function" },
    { label: "(", insert: "(", variant: "template" },
    { label: ")", insert: ")", variant: "template" },
    { label: "x", insert: "x", variant: "variable" },
  ],
  trig: [
    { label: "sin", insert: "sin()", template: true, variant: "function" },
    { label: "cos", insert: "cos()", template: true, variant: "function" },
    { label: "tan", insert: "tan()", template: true, variant: "function" },
    { label: "sec", insert: "sec()", template: true, variant: "function" },
    { label: "csc", insert: "csc()", template: true, variant: "function" },
    { label: "cot", insert: "cot()", template: true, variant: "function" },
    { label: "asin", insert: "asin()", template: true, variant: "function" },
    { label: "acos", insert: "acos()", template: true, variant: "function" },
    { label: "atan", insert: "atan()", template: true, variant: "function" },
  ],
  calculus: [
    { label: "d/dx", insert: "derivative(, x)", template: true, variant: "function" },
    { label: "∫", insert: "integral(, x)", template: true, variant: "function" },
    { label: "lim", insert: "limit(, x, )", template: true, variant: "function" },
    { label: "Σ", insert: "sum(, )", template: true, variant: "function" },
    { label: "Π", insert: "prod(, )", template: true, variant: "function" },
    { label: "det", insert: "det()", template: true, variant: "function" },
  ],
  greek: [
    { label: "α", insert: "alpha", variant: "variable" },
    { label: "β", insert: "beta", variant: "variable" },
    { label: "γ", insert: "gamma", variant: "variable" },
    { label: "δ", insert: "delta", variant: "variable" },
    { label: "ε", insert: "epsilon", variant: "variable" },
    { label: "θ", insert: "theta", variant: "variable" },
    { label: "λ", insert: "lambda", variant: "variable" },
    { label: "μ", insert: "mu", variant: "variable" },
    { label: "π", insert: "pi", variant: "variable" },
    { label: "σ", insert: "sigma", variant: "variable" },
    { label: "φ", insert: "phi", variant: "variable" },
    { label: "ω", insert: "omega", variant: "variable" },
  ],
};

const getVariantClasses = (variant?: string) => {
  switch (variant) {
    case "number":
      return "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold text-[15px]";
    case "operator":
      return "bg-slate-100 dark:bg-slate-900/50 text-blue-600 dark:text-blue-400 border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-800 font-medium";
    case "function":
      return "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-700 font-medium";
    case "variable":
      return "bg-slate-50 dark:bg-slate-800/80 text-emerald-600 dark:text-emerald-400 border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-slate-700 font-medium italic";
    case "template":
      return "bg-slate-100 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 font-medium";
    default:
      return "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700";
  }
};

export const MathKeyboard: React.FC<MathKeyboardProps> = ({
  onInsert,
  onDelete,
  onMoveCursor,
  onAction,
  onClose,
  variables = [],
}) => {
  const [activeTab, setActiveTab] = useState(CATEGORIES[0].id);
  const [recent, setRecent] = useState<{ label: React.ReactNode; insert: string; template?: boolean; variant?: string }[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("math-keyboard-recent");
      if (stored) {
        setRecent(JSON.parse(stored));
      }
    } catch (e) {
      // Ignore
    }
  }, []);

  const handleInsert = (sym: any) => {
    onInsert(sym.insert, sym.template);
    
    // Add to recent
    setRecent((prev) => {
      const filtered = prev.filter((r) => r.insert !== sym.insert);
      const newRecent = [sym, ...filtered].slice(0, 10);
      try {
        localStorage.setItem("math-keyboard-recent", JSON.stringify(newRecent));
      } catch (e) {}
      return newRecent;
    });
  };

  const dynamicVariables = variables.map((v) => ({
    label: v.name,
    insert: v.name,
    variant: "variable",
  }));

  const activeSymbols = activeTab === "common" 
    ? [...SYMBOLS.common]
    : SYMBOLS[activeTab] || [];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 md:relative md:w-full bg-slate-50 dark:bg-[#0d121b] border-t border-slate-200 dark:border-slate-800 shadow-[0_-10px_40px_rgba(0,0,0,0.15)] md:shadow-lg md:rounded-lg md:border z-[100000] flex flex-col pointer-events-auto max-h-[85vh]"
      onMouseDown={(e) => e.preventDefault()}
      onTouchStart={(e) => e.preventDefault()}
    >
      {/* Quick Variables Bar (if any) */}
      {dynamicVariables.length > 0 && (
        <div className="flex items-center px-2 py-1 gap-1.5 border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 overflow-x-auto custom-scrollbar shrink-0">
          <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider pr-1 shrink-0">Vars</span>
          {dynamicVariables.map((v, i) => (
            <button
              key={i}
              onClick={() => handleInsert(v)}
              className="px-2.5 py-0.5 rounded-full bg-emerald-100/50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs font-mono italic hover:bg-emerald-200/50 dark:hover:bg-emerald-900/40 transition-colors border border-emerald-200/50 dark:border-emerald-800/30 shrink-0"
            >
              {v.label}
            </button>
          ))}
        </div>
      )}

      {/* Header / Tabs */}
      <div className="flex items-center justify-between p-1.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] shrink-0">
        <div className="flex flex-1 overflow-x-auto custom-scrollbar gap-1 mr-2 px-1">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-[13px] shrink-0 transition-colors ${
                  activeTab === cat.id
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {Icon && <Icon size={14} className={activeTab === cat.id ? "text-blue-600 dark:text-blue-400" : "opacity-60"} />}
                {cat.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors shrink-0"
        >
          <X size={16} />
        </button>
      </div>

      {/* Keyboard Grid */}
      <div className="p-1 md:p-1.5 bg-slate-100/50 dark:bg-[#161b22]/50 flex-1 overflow-y-auto min-h-[150px]">
        
        {/* Recent Section */}
        {recent.length > 0 && activeTab === "common" && (
          <div className="mb-2">
            <div className="flex items-center gap-1.5 mb-1.5 px-1 opacity-60">
              <History size={12} className="text-slate-500" />
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">Recent</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-1">
              {recent.map((sym, idx) => (
                <button
                  key={idx}
                  onClick={() => handleInsert(sym)}
                  className={`shrink-0 min-w-[40px] h-7 md:h-8 border rounded shadow-sm flex items-center justify-center font-mono text-xs transition-colors active:scale-95 ${getVariantClasses(sym.variant)}`}
                >
                  {sym.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={`grid gap-1 md:gap-1.5 ${activeTab === 'common' ? 'grid-cols-5' : 'grid-cols-4 md:grid-cols-6'}`}>
          {activeSymbols.map((sym, idx) => (
            <button
              key={idx}
              onClick={() => handleInsert(sym)}
              className={`h-8 md:h-9 border rounded shadow-sm flex items-center justify-center font-mono text-sm transition-colors active:scale-95 ${getVariantClasses(sym.variant)}`}
            >
              {sym.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sticky Bottom Row */}
      <div className="p-1 md:p-1.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] grid grid-cols-5 md:grid-cols-6 gap-1 md:gap-1.5 shrink-0">
        <button
          onClick={() => onMoveCursor?.("left")}
          className="h-8 md:h-9 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded shadow-sm flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors active:scale-95"
        >
          <ArrowLeft size={16} />
        </button>
        <button
          onClick={() => onMoveCursor?.("right")}
          className="h-8 md:h-9 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded shadow-sm flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors active:scale-95"
        >
          <ArrowRight size={16} />
        </button>
        <button
          onClick={() => onAction?.("space")}
          className="h-8 md:h-9 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded shadow-sm flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors active:scale-95 font-medium text-[10px] tracking-widest uppercase opacity-80"
        >
          Space
        </button>
        <button
          onClick={onDelete}
          className="h-8 md:h-9 border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded shadow-sm flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors active:scale-95"
        >
          <Delete size={16} />
        </button>
        <button
          onClick={() => onAction?.("enter")}
          className="h-8 md:h-9 md:col-span-2 border border-blue-600 bg-blue-500 text-white rounded shadow-sm flex items-center justify-center hover:bg-blue-600 transition-colors active:scale-95"
        >
          <CornerDownLeft size={16} />
        </button>
      </div>
    </div>
  );
};
