/**
 * The "Special Nodes" choices when adding a field: one tile per kind of node, each with its own
 * colour, and the real logos for the languages - Python, JavaScript, TypeScript.
 */
import React from "react";
import { ArrowRightLeft, Check, Globe, Image as ImageIcon, ListTodo, Search, Sigma } from "lucide-react";
import { PythonIcon } from "./FileIcons";

export type SpecialNodeType =
  | "api_node"
  | "js_node"
  | "ts_node"
  | "py_node"
  | "math_node"
  | "todo_node"
  | "image_node"
  | "transfer_node"
  | "search_node";

/** The JavaScript logo: black letters on the yellow square. */
const JsLogo = ({ size = 20 }: { size?: number }) => (
  <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
    <rect width="32" height="32" rx="4" fill="#F7DF1E" />
    <text x="29" y="28.5" textAnchor="end" fill="#000" fontFamily="'Segoe UI', system-ui, -apple-system, sans-serif" fontWeight="700" fontSize="15" letterSpacing="-0.5">JS</text>
  </svg>
);

/** The TypeScript logo: white "TS" on the blue square. */
const TsLogo = ({ size = 20 }: { size?: number }) => (
  <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
    <rect width="32" height="32" rx="4" fill="#3178C6" />
    <text x="29" y="28.5" textAnchor="end" fill="#fff" fontFamily="'Segoe UI', system-ui, -apple-system, sans-serif" fontWeight="700" fontSize="15" letterSpacing="-0.5">TS</text>
  </svg>
);

interface SpecialNode {
  type: SpecialNodeType;
  label: string;
  /** What it is for, shown on hover. */
  hint: string;
  /** Its colour: the tile's tint, border and icon. */
  color: string;
  /** The label's colour when chosen, on a light and on a dark background. */
  ink: [light: string, dark: string];
  icon: React.ReactNode;
  /** A logo in its own colours rather than an icon drawn in `color`. */
  isLogo?: boolean;
}

const SPECIAL_NODES: SpecialNode[] = [
  { type: "py_node", label: "Python", hint: "Python code, run in the browser", color: "#3776AB", ink: ["#2B6AA3", "#6FA8DC"], icon: <PythonIcon size={20} />, isLogo: true },
  { type: "js_node", label: "JavaScript", hint: "JavaScript code with npm packages", color: "#E4C71A", ink: ["#9A7D00", "#F7DF1E"], icon: <JsLogo />, isLogo: true },
  { type: "ts_node", label: "TypeScript", hint: "TypeScript code with npm packages", color: "#3178C6", ink: ["#2F6FB8", "#6AA5EA"], icon: <TsLogo />, isLogo: true },
  { type: "api_node", label: "API", hint: "An HTTP request and its response", color: "#0EA5E9", ink: ["#0284C7", "#38BDF8"], icon: <Globe size={18} strokeWidth={2.2} /> },
  { type: "math_node", label: "Math", hint: "Formulas and calculations", color: "#8B5CF6", ink: ["#7C3AED", "#A78BFA"], icon: <Sigma size={18} strokeWidth={2.4} /> },
  { type: "todo_node", label: "Todo", hint: "A task list", color: "#10B981", ink: ["#059669", "#34D399"], icon: <ListTodo size={18} strokeWidth={2.2} /> },
  { type: "image_node", label: "Image", hint: "An image you can edit", color: "#EC4899", ink: ["#DB2777", "#F472B6"], icon: <ImageIcon size={18} strokeWidth={2.2} /> },
  { type: "transfer_node", label: "Transfer", hint: "Send files and text between devices", color: "#F59E0B", ink: ["#D97706", "#FBBF24"], icon: <ArrowRightLeft size={18} strokeWidth={2.2} /> },
  { type: "search_node", label: "Search", hint: "Search the web and keep the results", color: "#06B6D4", ink: ["#0891B2", "#22D3EE"], icon: <Search size={18} strokeWidth={2.4} /> },
];

/** A hex colour at some opacity, for tints. */
const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

interface SpecialNodePickerProps {
  value: string;
  onChange: (type: SpecialNodeType) => void;
  /** The mobile form is always dark; elsewhere the tiles follow the app's theme. */
  alwaysDark?: boolean;
}

export function SpecialNodePicker({ value, onChange, alwaysDark }: SpecialNodePickerProps) {
  const idle = alwaysDark
    ? "bg-[#121824] border-slate-800 text-slate-300 hover:bg-slate-800/60 hover:border-slate-700"
    : "bg-white dark:bg-[#121824] border-slate-200 dark:border-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700";

  return (
    <div className="grid grid-cols-3 gap-1.5 mt-1" role="radiogroup" aria-label="Special nodes">
      {SPECIAL_NODES.map((node) => {
        const selected = value === node.type;
        return (
          <button
            key={node.type}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(node.type)}
            title={node.hint}
            className={`group relative flex flex-col items-center justify-center gap-1.5 py-2.5 px-1 rounded-lg border transition-all duration-150 cursor-pointer active:scale-[0.97] ${selected ? "" : idle}`}
            style={
              selected
                ? {
                  backgroundColor: alpha(node.color, 0.12),
                  borderColor: alpha(node.color, 0.75),
                  boxShadow: `0 0 0 1px ${alpha(node.color, 0.35)}, 0 4px 14px ${alpha(node.color, 0.18)}`,
                }
                : undefined
            }
          >
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-150 group-hover:scale-105"
              style={{
                backgroundColor: alpha(node.color, node.isLogo ? 0.14 : 0.16),
                color: node.color,
                boxShadow: `inset 0 0 0 1px ${alpha(node.color, selected ? 0.5 : 0.22)}`,
              }}
            >
              {node.icon}
            </span>
            <span
              className={`text-[10.5px] font-semibold leading-none tracking-tight ${selected ? (alwaysDark ? "text-[var(--ink-dark)]" : "text-[var(--ink-light)] dark:text-[var(--ink-dark)]") : ""}`}
              style={{ "--ink-light": node.ink[0], "--ink-dark": node.ink[1] } as React.CSSProperties}
            >
              {node.label}
            </span>
            {selected && (
              <span
                className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                // Dark on the yellow, white on the rest - whichever reads.
                style={{ backgroundColor: node.color, color: node.type === "js_node" ? "#000" : "#fff" }}
                aria-hidden="true"
              >
                <Check size={9} strokeWidth={3.5} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
