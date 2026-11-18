/**
 * One light colour palette per tool. Written out as literal class names so Tailwind
 * generates them (it cannot see classes built from strings at run time).
 * Generated — edit the generator, not by hand.
 */
import { createContext, useContext } from "react";

export type Hue = "red" | "orange" | "amber" | "yellow" | "lime" | "green" | "emerald" | "teal" | "cyan" | "sky" | "blue" | "indigo" | "violet" | "purple" | "fuchsia" | "pink" | "rose";

export interface Accent {
  /** Icon square: light tint + coloured icon */
  icon: string;
  /** Tile border on hover */
  hover: string;
  /** Solid button */
  solid: string;
  /** Bars and fills (slider, progress, switch on) */
  fill: string;
  /** Selected chip / option */
  soft: string;
  /** Coloured text */
  text: string;
  /** Slider thumb border */
  thumb: string;
  /** Coloured border */
  border: string;
  /** Focus ring */
  ring: string;
  /** Canvas colours: [light theme, dark theme] */
  hex: [string, string];
}

export const ACCENTS: Record<Hue, Accent> = {
  red: {
    icon: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
    hover: "hover:border-red-300 dark:hover:border-red-500/40",
    solid: "bg-red-600 hover:bg-red-700 text-white dark:bg-red-500 dark:hover:bg-red-400",
    fill: "bg-red-500",
    soft: "border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-300",
    text: "text-red-600 dark:text-red-400",
    thumb: "[&::-webkit-slider-thumb]:border-red-500 [&::-moz-range-thumb]:border-red-500",
    border: "border-red-500",
    ring: "focus-visible:ring-red-500/40",
    hex: ["#ef4444", "#f87171"],
  },
  orange: {
    icon: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400",
    hover: "hover:border-orange-300 dark:hover:border-orange-500/40",
    solid: "bg-orange-600 hover:bg-orange-700 text-white dark:bg-orange-500 dark:hover:bg-orange-400",
    fill: "bg-orange-500",
    soft: "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/40 dark:bg-orange-500/15 dark:text-orange-300",
    text: "text-orange-600 dark:text-orange-400",
    thumb: "[&::-webkit-slider-thumb]:border-orange-500 [&::-moz-range-thumb]:border-orange-500",
    border: "border-orange-500",
    ring: "focus-visible:ring-orange-500/40",
    hex: ["#f97316", "#fb923c"],
  },
  amber: {
    icon: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
    hover: "hover:border-amber-300 dark:hover:border-amber-500/40",
    solid: "bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500 dark:hover:bg-amber-400",
    fill: "bg-amber-500",
    soft: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300",
    text: "text-amber-600 dark:text-amber-400",
    thumb: "[&::-webkit-slider-thumb]:border-amber-500 [&::-moz-range-thumb]:border-amber-500",
    border: "border-amber-500",
    ring: "focus-visible:ring-amber-500/40",
    hex: ["#f59e0b", "#fbbf24"],
  },
  yellow: {
    icon: "bg-yellow-50 text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-400",
    hover: "hover:border-yellow-300 dark:hover:border-yellow-500/40",
    solid: "bg-yellow-600 hover:bg-yellow-700 text-white dark:bg-yellow-500 dark:hover:bg-yellow-400",
    fill: "bg-yellow-500",
    soft: "border-yellow-300 bg-yellow-50 text-yellow-700 dark:border-yellow-500/40 dark:bg-yellow-500/15 dark:text-yellow-300",
    text: "text-yellow-600 dark:text-yellow-400",
    thumb: "[&::-webkit-slider-thumb]:border-yellow-500 [&::-moz-range-thumb]:border-yellow-500",
    border: "border-yellow-500",
    ring: "focus-visible:ring-yellow-500/40",
    hex: ["#eab308", "#facc15"],
  },
  lime: {
    icon: "bg-lime-50 text-lime-600 dark:bg-lime-500/10 dark:text-lime-400",
    hover: "hover:border-lime-300 dark:hover:border-lime-500/40",
    solid: "bg-lime-600 hover:bg-lime-700 text-white dark:bg-lime-500 dark:hover:bg-lime-400",
    fill: "bg-lime-500",
    soft: "border-lime-300 bg-lime-50 text-lime-700 dark:border-lime-500/40 dark:bg-lime-500/15 dark:text-lime-300",
    text: "text-lime-600 dark:text-lime-400",
    thumb: "[&::-webkit-slider-thumb]:border-lime-500 [&::-moz-range-thumb]:border-lime-500",
    border: "border-lime-500",
    ring: "focus-visible:ring-lime-500/40",
    hex: ["#84cc16", "#a3e635"],
  },
  green: {
    icon: "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400",
    hover: "hover:border-green-300 dark:hover:border-green-500/40",
    solid: "bg-green-600 hover:bg-green-700 text-white dark:bg-green-500 dark:hover:bg-green-400",
    fill: "bg-green-500",
    soft: "border-green-300 bg-green-50 text-green-700 dark:border-green-500/40 dark:bg-green-500/15 dark:text-green-300",
    text: "text-green-600 dark:text-green-400",
    thumb: "[&::-webkit-slider-thumb]:border-green-500 [&::-moz-range-thumb]:border-green-500",
    border: "border-green-500",
    ring: "focus-visible:ring-green-500/40",
    hex: ["#22c55e", "#4ade80"],
  },
  emerald: {
    icon: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    hover: "hover:border-emerald-300 dark:hover:border-emerald-500/40",
    solid: "bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-400",
    fill: "bg-emerald-500",
    soft: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300",
    text: "text-emerald-600 dark:text-emerald-400",
    thumb: "[&::-webkit-slider-thumb]:border-emerald-500 [&::-moz-range-thumb]:border-emerald-500",
    border: "border-emerald-500",
    ring: "focus-visible:ring-emerald-500/40",
    hex: ["#10b981", "#34d399"],
  },
  teal: {
    icon: "bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400",
    hover: "hover:border-teal-300 dark:hover:border-teal-500/40",
    solid: "bg-teal-600 hover:bg-teal-700 text-white dark:bg-teal-500 dark:hover:bg-teal-400",
    fill: "bg-teal-500",
    soft: "border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-500/40 dark:bg-teal-500/15 dark:text-teal-300",
    text: "text-teal-600 dark:text-teal-400",
    thumb: "[&::-webkit-slider-thumb]:border-teal-500 [&::-moz-range-thumb]:border-teal-500",
    border: "border-teal-500",
    ring: "focus-visible:ring-teal-500/40",
    hex: ["#14b8a6", "#2dd4bf"],
  },
  cyan: {
    icon: "bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400",
    hover: "hover:border-cyan-300 dark:hover:border-cyan-500/40",
    solid: "bg-cyan-600 hover:bg-cyan-700 text-white dark:bg-cyan-500 dark:hover:bg-cyan-400",
    fill: "bg-cyan-500",
    soft: "border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/15 dark:text-cyan-300",
    text: "text-cyan-600 dark:text-cyan-400",
    thumb: "[&::-webkit-slider-thumb]:border-cyan-500 [&::-moz-range-thumb]:border-cyan-500",
    border: "border-cyan-500",
    ring: "focus-visible:ring-cyan-500/40",
    hex: ["#06b6d4", "#22d3ee"],
  },
  sky: {
    icon: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400",
    hover: "hover:border-sky-300 dark:hover:border-sky-500/40",
    solid: "bg-sky-600 hover:bg-sky-700 text-white dark:bg-sky-500 dark:hover:bg-sky-400",
    fill: "bg-sky-500",
    soft: "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-300",
    text: "text-sky-600 dark:text-sky-400",
    thumb: "[&::-webkit-slider-thumb]:border-sky-500 [&::-moz-range-thumb]:border-sky-500",
    border: "border-sky-500",
    ring: "focus-visible:ring-sky-500/40",
    hex: ["#0ea5e9", "#38bdf8"],
  },
  blue: {
    icon: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
    hover: "hover:border-blue-300 dark:hover:border-blue-500/40",
    solid: "bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-400",
    fill: "bg-blue-500",
    soft: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300",
    text: "text-blue-600 dark:text-blue-400",
    thumb: "[&::-webkit-slider-thumb]:border-blue-500 [&::-moz-range-thumb]:border-blue-500",
    border: "border-blue-500",
    ring: "focus-visible:ring-blue-500/40",
    hex: ["#3b82f6", "#60a5fa"],
  },
  indigo: {
    icon: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
    hover: "hover:border-indigo-300 dark:hover:border-indigo-500/40",
    solid: "bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-400",
    fill: "bg-indigo-500",
    soft: "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-300",
    text: "text-indigo-600 dark:text-indigo-400",
    thumb: "[&::-webkit-slider-thumb]:border-indigo-500 [&::-moz-range-thumb]:border-indigo-500",
    border: "border-indigo-500",
    ring: "focus-visible:ring-indigo-500/40",
    hex: ["#6366f1", "#818cf8"],
  },
  violet: {
    icon: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400",
    hover: "hover:border-violet-300 dark:hover:border-violet-500/40",
    solid: "bg-violet-600 hover:bg-violet-700 text-white dark:bg-violet-500 dark:hover:bg-violet-400",
    fill: "bg-violet-500",
    soft: "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-300",
    text: "text-violet-600 dark:text-violet-400",
    thumb: "[&::-webkit-slider-thumb]:border-violet-500 [&::-moz-range-thumb]:border-violet-500",
    border: "border-violet-500",
    ring: "focus-visible:ring-violet-500/40",
    hex: ["#8b5cf6", "#a78bfa"],
  },
  purple: {
    icon: "bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400",
    hover: "hover:border-purple-300 dark:hover:border-purple-500/40",
    solid: "bg-purple-600 hover:bg-purple-700 text-white dark:bg-purple-500 dark:hover:bg-purple-400",
    fill: "bg-purple-500",
    soft: "border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-500/40 dark:bg-purple-500/15 dark:text-purple-300",
    text: "text-purple-600 dark:text-purple-400",
    thumb: "[&::-webkit-slider-thumb]:border-purple-500 [&::-moz-range-thumb]:border-purple-500",
    border: "border-purple-500",
    ring: "focus-visible:ring-purple-500/40",
    hex: ["#a855f7", "#c084fc"],
  },
  fuchsia: {
    icon: "bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-500/10 dark:text-fuchsia-400",
    hover: "hover:border-fuchsia-300 dark:hover:border-fuchsia-500/40",
    solid: "bg-fuchsia-600 hover:bg-fuchsia-700 text-white dark:bg-fuchsia-500 dark:hover:bg-fuchsia-400",
    fill: "bg-fuchsia-500",
    soft: "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-500/40 dark:bg-fuchsia-500/15 dark:text-fuchsia-300",
    text: "text-fuchsia-600 dark:text-fuchsia-400",
    thumb: "[&::-webkit-slider-thumb]:border-fuchsia-500 [&::-moz-range-thumb]:border-fuchsia-500",
    border: "border-fuchsia-500",
    ring: "focus-visible:ring-fuchsia-500/40",
    hex: ["#d946ef", "#e879f9"],
  },
  pink: {
    icon: "bg-pink-50 text-pink-600 dark:bg-pink-500/10 dark:text-pink-400",
    hover: "hover:border-pink-300 dark:hover:border-pink-500/40",
    solid: "bg-pink-600 hover:bg-pink-700 text-white dark:bg-pink-500 dark:hover:bg-pink-400",
    fill: "bg-pink-500",
    soft: "border-pink-300 bg-pink-50 text-pink-700 dark:border-pink-500/40 dark:bg-pink-500/15 dark:text-pink-300",
    text: "text-pink-600 dark:text-pink-400",
    thumb: "[&::-webkit-slider-thumb]:border-pink-500 [&::-moz-range-thumb]:border-pink-500",
    border: "border-pink-500",
    ring: "focus-visible:ring-pink-500/40",
    hex: ["#ec4899", "#f472b6"],
  },
  rose: {
    icon: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
    hover: "hover:border-rose-300 dark:hover:border-rose-500/40",
    solid: "bg-rose-600 hover:bg-rose-700 text-white dark:bg-rose-500 dark:hover:bg-rose-400",
    fill: "bg-rose-500",
    soft: "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300",
    text: "text-rose-600 dark:text-rose-400",
    thumb: "[&::-webkit-slider-thumb]:border-rose-500 [&::-moz-range-thumb]:border-rose-500",
    border: "border-rose-500",
    ring: "focus-visible:ring-rose-500/40",
    hex: ["#f43f5e", "#fb7185"],
  },
};

const AccentContext = createContext<Accent>(ACCENTS.indigo);
export const AccentProvider = AccentContext.Provider;
/** The colours of the tool being shown. */
export const useAccent = () => useContext(AccentContext);
