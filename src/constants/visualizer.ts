export const LAYOUT_MODES = [
  "vertical",
  "horizontal",
  "radial",
  "force",
  "compact",
  "mindmap",
  "grid",
  "molecule",
] as const;

export const CODE_FORMATS = ["json", "yaml"] as const;

export const NODE_THEMES = [
  "vscode",
  "github",
  "nord",
  "dracula",
  "solarized",
  "catppuccin",
  "tokyo-night",
  "rose-pine",
  "graphite",
  "paper",
  "minimal",
  "gradient",
  "terminal",
  "retro",
  "notebook",
  "custom",
  "glass",
  "math",
  "tree",
  "hacker",
  "ocean",
  "rune",
  "zen",
  "architect",
  "nature",
  "seed",
  "chalk",
] as const;

/** Themes with a matching dark and light variant; the renderers pick one from the app theme */
export const PALETTE_THEMES = [
  "nord",
  "dracula",
  "solarized",
  "catppuccin",
  "tokyo-night",
  "rose-pine",
  "graphite",
  "paper",
] as const;

/** Edge colour for each palette theme: [dark, light] */
export const PALETTE_EDGE_COLORS: Record<(typeof PALETTE_THEMES)[number], [string, string]> = {
  nord: ["#81a1c1", "#5e81ac"],
  dracula: ["#bd93f9", "#644ac9"],
  solarized: ["#268bd2", "#268bd2"],
  catppuccin: ["#cba6f7", "#8839ef"],
  "tokyo-night": ["#7aa2f7", "#2e7de9"],
  "rose-pine": ["#ea9a97", "#d7827e"],
  graphite: ["#52525b", "#a1a1aa"],
  paper: ["#8a857a", "#b5afa3"],
};

export const EDGE_STYLES = [
  "curved",
  "arrow",
  "dotted",
  "fade",
  "arc",
  "ribbon",
  "straight",
  "step",
  "dashed",
  "pipe",
  "circuit",
  "seed",
  "metro",
  "angled-step",
] as const;

export const NODE_SHAPES = [
  "default",
  "circle",
  "rectangle",
  "triangle",
  "hexagon",
  "pill",
  "diamond",
  "parallelogram",
] as const;

export type LayoutMode = typeof LAYOUT_MODES[number];
export type CodeFormat = typeof CODE_FORMATS[number];
export type NodeTheme = typeof NODE_THEMES[number];
export type EdgeStyle = typeof EDGE_STYLES[number];
export type NodeShape = typeof NODE_SHAPES[number];
