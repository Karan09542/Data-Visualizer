/**
 * Derives the Code Workspace shell palette (side bar, tab bar, panel, status
 * bar, borders...) from the two colours an editor theme always defines.
 *
 * VS Code themes work the same way: the chrome is a small set of shades around
 * the editor background, so picking Dracula in the editor should not leave the
 * surrounding panels on the default neutral grey.
 */

interface RGB {
  r: number;
  g: number;
  b: number;
}

const BLACK: RGB = { r: 0, g: 0, b: 0 };

function parseHex(hex: string): RGB | null {
  if (typeof hex !== "string") return null;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3 || h.length === 4) {
    h = h
      .slice(0, 3)
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length === 8) h = h.slice(0, 6);
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

function toHex(c: RGB): string {
  return (
    "#" +
    [c.r, c.g, c.b]
      .map((v) => clamp(v).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** t = 0 returns a, t = 1 returns b. */
function mix(a: RGB, b: RGB, t: number): RGB {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function rgba(c: RGB, alpha: number): string {
  return `rgba(${clamp(c.r)}, ${clamp(c.g)}, ${clamp(c.b)}, ${alpha})`;
}

/** Monaco only accepts hex, so alpha has to be baked into an #rrggbbaa string. */
function hexa(c: RGB, alpha: number): string {
  return (
    toHex(c) +
    clamp(alpha * 255)
      .toString(16)
      .padStart(2, "0")
  );
}

function isDarkColor(c: RGB): boolean {
  // Rec. 601 luma is good enough for a light/dark decision.
  return (c.r * 299 + c.g * 587 + c.b * 114) / 1000 < 128;
}

/** The default (no explicit editor theme) surfaces, matching VS Code Modern. */
export const DEFAULT_SHELL = {
  dark: { bg: "#1f1f1f", fg: "#cccccc" },
  light: { bg: "#ffffff", fg: "#3b3b3b" },
};

export function buildShellPalette(
  bgHex: string,
  fgHex: string,
): Record<string, string> {
  const bg = parseHex(bgHex) || parseHex(DEFAULT_SHELL.dark.bg)!;
  const fg = parseHex(fgHex) || parseHex(DEFAULT_SHELL.dark.fg)!;
  const dark = isDarkColor(bg);

  // Chrome always sits a touch darker than the editor, in both polarities -
  // that is what gives VS Code its recessed side bar.
  const chrome = mix(bg, BLACK, dark ? 0.16 : 0.03);
  const accent = dark ? "#0078d4" : "#005fb8";
  const accentRgb = parseHex(accent)!;
  const muted = mix(fg, bg, 0.35);

  return {
    "--vsc-titlebar": toHex(chrome),
    "--vsc-sidebar": toHex(chrome),
    "--vsc-editor": toHex(bg),
    "--vsc-tabbar": toHex(chrome),
    "--vsc-tab-active": toHex(bg),
    "--vsc-tab-inactive-fg": toHex(muted),
    "--vsc-panel": toHex(chrome),
    "--vsc-panel-body": toHex(bg),
    "--vsc-statusbar": toHex(chrome),
    "--vsc-border": toHex(mix(bg, fg, 0.1)),
    "--vsc-border-strong": toHex(mix(bg, fg, 0.2)),
    "--vsc-fg": toHex(fg),
    "--vsc-fg-muted": toHex(muted),
    "--vsc-accent": accent,
    "--vsc-accent-fg": "#ffffff",
    "--vsc-hover": rgba(fg, 0.08),
    "--vsc-active": rgba(fg, 0.12),
    "--vsc-selection": toHex(mix(bg, accentRgb, dark ? 0.35 : 0.18)),
    "--vsc-input": dark ? toHex(mix(bg, fg, 0.07)) : toHex(bg),
    // Menus and dialogs lift slightly off the chrome in dark themes, and stay
    // on the plain editor background in light ones - as VS Code does.
    "--vsc-widget": dark ? toHex(mix(chrome, fg, 0.05)) : toHex(bg),
    "--vsc-widget-shadow": rgba(BLACK, dark ? 0.55 : 0.16),
    "--vsc-badge": toHex(mix(bg, fg, 0.35)),
    "--vsc-badge-fg": toHex(fg),
    "--vsc-row-actions": toHex(mix(chrome, fg, 0.08)),
  };
}

/**
 * Monaco colour overrides so the code surface uses exactly the same background
 * as the shell derived above.
 */
export function buildMonacoColors(
  bgHex: string,
  fgHex: string,
): Record<string, string> {
  const bg = parseHex(bgHex) || parseHex(DEFAULT_SHELL.dark.bg)!;
  const fg = parseHex(fgHex) || parseHex(DEFAULT_SHELL.dark.fg)!;
  const dark = isDarkColor(bg);

  return {
    "editor.background": toHex(bg),
    "editor.foreground": toHex(fg),
    "editorGutter.background": toHex(bg),
    "minimap.background": toHex(bg),
    "editorLineNumber.foreground": toHex(mix(fg, bg, 0.55)),
    "editorLineNumber.activeForeground": toHex(fg),
    "editor.lineHighlightBackground": toHex(mix(bg, fg, dark ? 0.06 : 0.04)),
    "editor.lineHighlightBorder": "#00000000",
    "editorIndentGuide.background": toHex(mix(bg, fg, 0.14)),
    "editorIndentGuide.activeBackground": toHex(mix(bg, fg, 0.32)),
    "editorWhitespace.foreground": toHex(mix(bg, fg, 0.22)),
    "editorWidget.background": toHex(mix(bg, BLACK, dark ? 0.12 : 0)),
    "editorWidget.border": toHex(mix(bg, fg, 0.2)),
    "editorSuggestWidget.background": toHex(mix(bg, BLACK, dark ? 0.12 : 0)),
    "editorSuggestWidget.border": toHex(mix(bg, fg, 0.2)),
    "editorHoverWidget.background": toHex(mix(bg, BLACK, dark ? 0.12 : 0)),
    "editorHoverWidget.border": toHex(mix(bg, fg, 0.2)),
    "editorOverviewRuler.border": "#00000000",
    "scrollbarSlider.background": hexa(fg, 0.16),
    "scrollbarSlider.hoverBackground": hexa(fg, 0.26),
    "scrollbarSlider.activeBackground": hexa(fg, 0.36),
  };
}
