import type React from "react";

/**
 * Colours for the PDF viewer, as CSS variables on its root (and on anything it portals out).
 * Classes then read them, e.g. `bg-(--pv-panel)`, so one set of markup serves both themes.
 */
const DARK = {
  "--pv-canvas": "#0b0d12",
  "--pv-panel": "#11141b",
  "--pv-elevated": "#181c25",
  "--pv-line": "rgb(255 255 255 / 0.08)",
  "--pv-hover": "rgb(255 255 255 / 0.06)",
  "--pv-chip": "rgb(255 255 255 / 0.05)",
  "--pv-text": "#e7e9ef",
  "--pv-muted": "#8c94a6",
  "--pv-accent": "#8b9cff",
  "--pv-accent-soft": "rgb(139 156 255 / 0.14)",
  "--pv-on-accent": "#0b0d12",
  "--pv-shadow": "0 12px 40px -12px rgb(0 0 0 / 0.7)",
};

const LIGHT = {
  "--pv-canvas": "#e9ebf0",
  "--pv-panel": "#ffffff",
  "--pv-elevated": "#ffffff",
  "--pv-line": "rgb(15 23 42 / 0.09)",
  "--pv-hover": "rgb(15 23 42 / 0.05)",
  "--pv-chip": "rgb(15 23 42 / 0.04)",
  "--pv-text": "#0f172a",
  "--pv-muted": "#64748b",
  "--pv-accent": "#4f46e5",
  "--pv-accent-soft": "rgb(79 70 229 / 0.1)",
  "--pv-on-accent": "#ffffff",
  "--pv-shadow": "0 12px 40px -12px rgb(15 23 42 / 0.3)",
};

export const pdfPalette = (isDark: boolean) => (isDark ? DARK : LIGHT) as React.CSSProperties;

/** A round icon button in the viewer's chrome */
export const ICON_BUTTON =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-(--pv-muted) transition-colors hover:bg-(--pv-hover) hover:text-(--pv-text) disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--pv-accent)";
