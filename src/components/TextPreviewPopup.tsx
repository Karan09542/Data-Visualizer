import React, { useState, useEffect, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Copy, Check, Type, Edit3, FileText, Layout, Globe,
  Bold, Italic, List, Link as LinkIcon, Code, ListOrdered, Hash, ChevronRight, ChevronDown, ListTodo, Menu, Settings,
  ZoomIn, ZoomOut, RotateCcw, ChevronUp, ChevronLeft,
  ArrowLeft, ArrowRight, ArrowUp, ArrowDown, ArrowLeftToLine, ArrowRightToLine, ClipboardPaste, Quote,
  Undo, Redo, Keyboard, CornerDownLeft, Delete, Minus, Maximize2, Minimize2, MoreVertical, Tag,
  Download, Search, WrapText, ImageOff, Eye,
  Info, Lightbulb, MessageSquareWarning, TriangleAlert, OctagonAlert, BookOpen, Sun, Moon
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { Highlight, themes, type PrismTheme } from 'prism-react-renderer';
import mermaid from 'mermaid';
import { FONTS, loadGoogleFont } from '../utils/fontRegistry';
import CustomSelect from './CustomSelect';

const MermaidDiagram = memo(({ code, theme }: { code: string, theme?: string }) => {
  const [svg, setSvg] = useState<string>('');
  const [hasError, setHasError] = useState(false);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const id = useMemo(() => `mermaid-${Math.random().toString(36).substr(2, 9)}`, []);
  const renderCountRef = React.useRef(0);
  const diagramRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    // A fresh id per render: StrictMode runs this effect twice, and reusing one id let the
    // second run's cleanup delete the already-displayed SVG (which carries that same id).
    const renderId = `${id}-${++renderCountRef.current}`;
    const isDark = ['notebook-dark', 'default-dark', 'github-dark', 'retro-arcade', 'synthwave', 'chalkboard'].includes(theme || '');
    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? 'dark' : 'default',
      fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
      suppressErrorRendering: true
    });

    // Mermaid can leave its off-screen scratch nodes in the DOM; never touch the visible diagram
    const cleanupTempNodes = () => {
      [renderId, `d${renderId}`].forEach((nodeId) => {
        const el = document.getElementById(nodeId);
        if (el && !diagramRef.current?.contains(el)) el.remove();
      });
    };

    mermaid.render(renderId, code).then((result) => {
      cleanupTempNodes();
      if (cancelled) return;
      setSvg(result.svg);
      setHasError(false);
    }).catch(e => {
      cleanupTempNodes();
      if (cancelled) return;
      console.error('Mermaid render error:', e);
      setHasError(true);
    });

    return () => {
      cancelled = true;
    };
  }, [code, id, theme]);

  const handleZoomIn = () => setScale(s => Math.min(s + 0.25, 4));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.25, 0.25));
  const handleReset = () => { setScale(1); setPos({ x: 0, y: 0 }); };
  const handlePan = (dx: number, dy: number) => setPos(p => ({ x: p.x + dx, y: p.y + dy }));

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pos.x, y: e.clientY - pos.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPos({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  if (hasError) {
    return (
      <div className="relative group rounded-lg overflow-hidden my-4 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <span className="text-xs font-mono text-slate-500 uppercase">mermaid (fallback)</span>
        </div>
        <pre className="p-4 overflow-x-auto bg-[#1e1e1e] text-[#c9d1d9] text-[13px] font-mono leading-relaxed whitespace-pre-wrap">
          {code}
        </pre>
      </div>
    );
  }

  return (
    <div
      className="relative group rounded-lg border border-black/10 dark:border-white/10 my-6 overflow-hidden bg-black/5 h-[400px]"
    >
      <div
        className={`w-full h-full flex items-center justify-center ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          ref={diagramRef}
          className="mermaid not-prose font-sans !leading-normal [&_text]:!font-sans [&>svg]:!max-w-full [&>svg]:!w-[800px] [&>svg]:!h-auto [&>svg]:min-w-[400px]"
          dangerouslySetInnerHTML={{ __html: svg }}
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            transition: isDragging ? 'none' : 'transform 0.2s ease-in-out',
            transformOrigin: 'center center'
          }}
        />
      </div>

      {/* Floating Controls */}
      <div className="absolute right-4 bottom-4 flex flex-col gap-2 opacity-40 hover:opacity-100 focus-within:opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <div className="flex bg-slate-900/80 backdrop-blur rounded-lg border border-slate-700/50 shadow-xl overflow-hidden p-1 flex-col gap-1 items-center self-end">
          <button onClick={() => handlePan(0, 50)} title="Pan Up" className="p-1.5 hover:bg-slate-700/50 text-slate-300 rounded"><ChevronUp size={16} /></button>
          <div className="flex gap-1">
            <button onClick={() => handlePan(50, 0)} title="Pan Left" className="p-1.5 hover:bg-slate-700/50 text-slate-300 rounded"><ChevronLeft size={16} /></button>
            <button onClick={handleReset} title="Reset View" className="p-1.5 hover:bg-slate-700/50 text-slate-300 rounded bg-slate-800/50"><RotateCcw size={16} /></button>
            <button onClick={() => handlePan(-50, 0)} title="Pan Right" className="p-1.5 hover:bg-slate-700/50 text-slate-300 rounded"><ChevronRight size={16} /></button>
          </div>
          <button onClick={() => handlePan(0, -50)} title="Pan Down" className="p-1.5 hover:bg-slate-700/50 text-slate-300 rounded"><ChevronDown size={16} /></button>
        </div>

        <div className="flex bg-slate-900/80 backdrop-blur rounded-lg border border-slate-700/50 shadow-xl overflow-hidden p-1 gap-1 items-center self-end">
          <button onClick={handleZoomOut} title="Zoom Out" className="p-1.5 hover:bg-slate-700/50 text-slate-300 rounded"><ZoomOut size={16} /></button>
          <span className="text-xs text-slate-400 font-mono w-10 text-center select-none">{Math.round(scale * 100)}%</span>
          <button onClick={handleZoomIn} title="Zoom In" className="p-1.5 hover:bg-slate-700/50 text-slate-300 rounded"><ZoomIn size={16} /></button>
        </div>
      </div>
    </div>
  );
});

// Types for Document Outline
interface Heading {
  id: string;
  text: string;
  level: number;
}

type ThemeMode = 'light' | 'dark';

// The picker shows theme names only; light/dark is a separate toggle. Each name maps to the
// variant ids it ships in (those ids are what `mdTheme` stores, so saved prefs keep working).
const MD_THEME_FAMILIES: { name: string; light?: string; dark?: string }[] = [
  { name: 'Notebook', light: 'notebook', dark: 'notebook-dark' },
  { name: 'GitHub', light: 'github-light', dark: 'github-dark' },
  { name: 'Default', dark: 'default-dark' },
  { name: 'Borderlands', light: 'borderlands' },
  { name: 'Comic Minimal', light: 'comic-minimal' },
  { name: 'Anime Pastel', light: 'anime-pastel' },
  { name: 'Manga Scan', light: 'manga-scan' },
  { name: 'Cyberpunk 2077', light: 'cyberpunk' },
  { name: 'Retro Arcade', dark: 'retro-arcade' },
  { name: 'Synthwave', dark: 'synthwave' },
  { name: 'Neubrutalism', light: 'neubrutalism' },
  { name: 'Kawaii Cute', light: 'kawaii' },
  { name: 'Chalkboard', dark: 'chalkboard' },
];

type ViewMode = 'raw' | 'markdown' | 'html' | 'edit';

// View switcher entries: [mode, short label, icon, tooltip]
const VIEW_MODES = [
  ['raw', 'Raw', FileText, 'Code View'],
  ['markdown', 'Preview', Layout, 'Markdown Preview'],
  ['html', 'HTML', Globe, 'HTML Preview'],
  ['edit', 'Edit', Edit3, 'Edit Text'],
] as const;

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  raw: 'Raw text',
  markdown: 'Markdown preview',
  html: 'HTML preview',
  edit: 'Editing',
};

const getThemeFamily = (themeId: string) =>
  MD_THEME_FAMILIES.find((f) => f.light === themeId || f.dark === themeId) ?? MD_THEME_FAMILIES[0];

const getThemeMode = (themeId: string): ThemeMode =>
  getThemeFamily(themeId).dark === themeId ? 'dark' : 'light';

const GITHUB_THEMES = ['github-light', 'github-dark'];
// Themes styled by scoped CSS in index.css (no `prose`): get heading anchors and plain <kbd>
const CSS_STYLED_THEMES = [...GITHUB_THEMES, 'default-dark', 'borderlands', 'comic-minimal', 'anime-pastel', 'manga-scan', 'cyberpunk', 'retro-arcade', 'synthwave', 'neubrutalism', 'kawaii', 'chalkboard'];

// Google font families a theme needs, loaded when the theme is selected
const THEME_FONTS: Record<string, string[]> = {
  borderlands: ['Bangers'],
  'anime-pastel': ['M PLUS Rounded 1c'],
  'manga-scan': ['Dela Gothic One', 'Zen Kaku Gothic New'],
  cyberpunk: ['Chakra Petch', 'Rajdhani'],
  'retro-arcade': ['Press Start 2P', 'VT323'],
  synthwave: ['Audiowide', 'Exo 2'],
  neubrutalism: ['Archivo Black', 'Space Grotesk'],
  kawaii: ['Fredoka', 'Nunito'],
  chalkboard: ['Cabin Sketch', 'Patrick Hand'],
};

// GitHub's dark syntax palette (prism-react-renderer ships only a light GitHub theme)
const githubDarkPrism: PrismTheme = {
  plain: { color: '#f0f6fc', backgroundColor: '#151b23' },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#9198a1', fontStyle: 'italic' } },
    { types: ['keyword', 'selector', 'important', 'atrule'], style: { color: '#ff7b72' } },
    { types: ['string', 'char', 'attr-value', 'regex', 'inserted'], style: { color: '#a5d6ff' } },
    { types: ['function', 'class-name'], style: { color: '#d2a8ff' } },
    { types: ['number', 'boolean', 'constant', 'symbol', 'builtin', 'property', 'attr-name'], style: { color: '#79c0ff' } },
    { types: ['tag'], style: { color: '#7ee787' } },
    { types: ['deleted'], style: { color: '#ffa198' } },
    { types: ['variable', 'parameter'], style: { color: '#ffa657' } },
    { types: ['punctuation', 'operator'], style: { color: '#f0f6fc' } },
  ],
};

// Monochrome print palette: tokens are told apart by weight, style and grey level, not hue
const mangaPrism: PrismTheme = {
  plain: { color: '#141414', backgroundColor: '#fbfaf6' },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#7a7a7a', fontStyle: 'italic' } },
    { types: ['keyword', 'selector', 'important', 'atrule', 'tag'], style: { color: '#0a0a0a', fontWeight: 'bold' } },
    { types: ['string', 'char', 'attr-value', 'regex', 'inserted'], style: { color: '#2b2b2b', backgroundColor: 'rgba(0, 0, 0, 0.07)' } },
    { types: ['function', 'class-name'], style: { color: '#0a0a0a', fontWeight: 'bold' } },
    { types: ['number', 'boolean', 'constant', 'symbol', 'builtin'], style: { color: '#0a0a0a', fontStyle: 'italic' } },
    { types: ['property', 'attr-name', 'variable', 'parameter'], style: { color: '#2b2b2b' } },
    { types: ['deleted'], style: { color: '#7a7a7a', textDecorationLine: 'line-through' } },
    { types: ['punctuation', 'operator'], style: { color: '#5c5c5c' } },
  ],
};

// Coloured chalk on slate: pink keywords, yellow strings, blue calls, orange numbers
const chalkPrism: PrismTheme = {
  plain: { color: '#ece8dc', backgroundColor: '#243a2e' },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#9aa89e', fontStyle: 'italic' } },
    { types: ['keyword', 'selector', 'important', 'atrule', 'tag'], style: { color: '#f5a3b7' } },
    { types: ['string', 'char', 'attr-value', 'regex', 'inserted'], style: { color: '#f7e37a' } },
    { types: ['function', 'class-name'], style: { color: '#9fd3f0' } },
    { types: ['number', 'boolean', 'constant', 'symbol', 'builtin'], style: { color: '#f6b77c' } },
    { types: ['property', 'attr-name'], style: { color: '#b6e3a1' } },
    { types: ['variable', 'parameter'], style: { color: '#ece8dc' } },
    { types: ['deleted'], style: { color: '#f5a3b7' } },
    { types: ['punctuation', 'operator'], style: { color: '#c9c4b4' } },
  ],
};

// Candy palette on white: strawberry keywords, mint strings, lavender calls, caramel numbers
const kawaiiPrism: PrismTheme = {
  plain: { color: '#5a4a55', backgroundColor: '#fdfbff' },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#b8a8b3', fontStyle: 'italic' } },
    { types: ['keyword', 'selector', 'important', 'atrule'], style: { color: '#e0457b', fontWeight: 'bold' } },
    { types: ['string', 'char', 'attr-value', 'regex', 'inserted'], style: { color: '#1f8a6e' } },
    { types: ['function', 'class-name'], style: { color: '#6a4fd0' } },
    { types: ['number', 'boolean', 'constant', 'symbol', 'builtin'], style: { color: '#c77700' } },
    { types: ['property', 'attr-name', 'tag'], style: { color: '#1f78b4' } },
    { types: ['variable', 'parameter'], style: { color: '#5a4a55' } },
    { types: ['deleted'], style: { color: '#d6336c' } },
    { types: ['punctuation', 'operator'], style: { color: '#9a8a95' } },
  ],
};

// Arcade cabinet palette: ghost pink keywords, Pac-Man yellow strings, cyan calls, 1UP green numbers
const arcadePrism: PrismTheme = {
  plain: { color: '#e8e6ff', backgroundColor: '#0e0a24' },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#6c6796', fontStyle: 'italic' } },
    { types: ['keyword', 'selector', 'important', 'atrule'], style: { color: '#ff7ad9' } },
    { types: ['string', 'char', 'attr-value', 'regex', 'inserted'], style: { color: '#ffd23f' } },
    { types: ['function', 'class-name'], style: { color: '#2de2e6' } },
    { types: ['number', 'boolean', 'constant', 'symbol', 'builtin'], style: { color: '#39ff88' } },
    { types: ['property', 'attr-name', 'variable', 'parameter'], style: { color: '#ffa53b' } },
    { types: ['tag', 'deleted'], style: { color: '#ff3b5c' } },
    { types: ['punctuation', 'operator'], style: { color: '#8b85b8' } },
  ],
};

// Night City terminal: red keywords, yellow strings, cyan calls on near-black
const cyberpunkPrism: PrismTheme = {
  plain: { color: '#e6e6e6', backgroundColor: '#0a0a0f' },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#6b7280', fontStyle: 'italic' } },
    { types: ['keyword', 'selector', 'important', 'atrule'], style: { color: '#ff003c', fontWeight: 'bold' } },
    { types: ['string', 'char', 'attr-value', 'regex', 'inserted'], style: { color: '#fcee0a' } },
    { types: ['function', 'class-name', 'tag'], style: { color: '#00e5f5' } },
    { types: ['number', 'boolean', 'constant', 'symbol', 'builtin'], style: { color: '#c77dff' } },
    { types: ['property', 'attr-name'], style: { color: '#7df9ff' } },
    { types: ['variable', 'parameter'], style: { color: '#e6e6e6' } },
    { types: ['deleted'], style: { color: '#ff5c7a' } },
    { types: ['punctuation', 'operator'], style: { color: '#9ca3af' } },
  ],
};

// `header` swaps the floating hover controls for a window-style title bar
// `dots` gives each window dot its own class; otherwise all three use `dot`
type CodeHeader = { bar: string; dot: string; dots?: [string, string, string]; label: string; button: string };
type CodeStyles = { inline: string; card: string; chip: string; copy: string; copied: string; pre: string; prism: PrismTheme; header?: CodeHeader };

const CODE_STYLES: Record<string, CodeStyles> = {
  'default-dark': {
    inline: 'bg-indigo-500/10 text-indigo-200 border-indigo-400/15',
    card: '!rounded-xl border border-white/[0.08] bg-[#0d1424] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_30px_-14px_rgba(0,0,0,0.7)]',
    chip: '',
    copy: '',
    copied: 'text-emerald-400',
    pre: 'text-slate-200 selection:bg-indigo-500/35',
    prism: themes.oneDark,
    header: {
      bar: 'border-b border-white/[0.06] bg-white/[0.025]',
      dot: 'bg-slate-700/80',
      label: 'text-slate-400 lowercase',
      button: 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.06]',
    },
  },
  // Slate tablet: chalk-outlined dark board, dashed chalk rule under the bar, chalk-colour dots
  chalkboard: {
    inline: 'bg-white/10 text-[#fff5b8] border-[#f4f1e8]/25',
    card: '!rounded-md border-2 border-[#f4f1e8]/40 bg-[#243a2e] shadow-[inset_0_0_30px_rgba(0,0,0,0.35)]',
    chip: '',
    copy: '',
    copied: 'text-[#b6e3a1]',
    pre: 'text-[#ece8dc] selection:bg-[#f7e37a]/30',
    prism: chalkPrism,
    header: {
      bar: 'bg-black/15 border-b-2 border-dashed border-[#f4f1e8]/30',
      dot: '',
      dots: ['bg-[#f5a3b7]', 'bg-[#f7e37a]', 'bg-[#b6e3a1]'],
      label: 'text-[#f7e37a] lowercase',
      button: 'text-[#9fd3f0] hover:bg-white/10 hover:text-white',
    },
  },
  // Candy card: lavender rim with a chunky bottom edge, strawberry/butter/mint dots
  kawaii: {
    inline: 'bg-[#ffe4ee] text-[#d6336c] border-[#ffc2d6] font-bold',
    card: '!rounded-[22px] border-[3px] border-[#c8b6ff] bg-[#fdfbff] shadow-[0_5px_0_#c8b6ff]',
    chip: '',
    copy: '',
    copied: 'text-[#1f8a6e]',
    pre: 'text-[#5a4a55] selection:bg-[#ffd6e5]',
    prism: kawaiiPrism,
    header: {
      bar: 'bg-[#f1ecff] border-b-[3px] border-[#c8b6ff]',
      dot: '',
      dots: ['bg-[#ff8fb8]', 'bg-[#ffd566]', 'bg-[#8fe3cf]'],
      label: 'text-[#6a4fd0] font-bold lowercase',
      button: '!rounded-full text-[#d6336c] font-bold bg-white hover:bg-[#ffe4ee]',
    },
  },
  // Brutal card: 3px ink border + hard shadow, yellow title bar, bordered colour dots
  neubrutalism: {
    inline: 'bg-[#ffdc58] text-black !border-2 border-black font-bold !rounded-md',
    card: '!rounded-xl border-[3px] border-black bg-white shadow-[6px_6px_0_#000]',
    chip: '',
    copy: '',
    copied: 'text-black',
    pre: 'text-[#111] selection:bg-[#ffdc58]',
    prism: themes.oneLight,
    header: {
      bar: 'bg-[#ffdc58] border-b-[3px] border-black',
      dot: '',
      dots: ['bg-[#ff6b6b] border-2 border-black', 'bg-[#88aaee] border-2 border-black', 'bg-[#a3e636] border-2 border-black'],
      label: 'text-black font-bold uppercase tracking-wider',
      button: 'text-black font-bold uppercase border-2 border-black bg-white hover:bg-black hover:text-[#ffdc58]',
    },
  },
  // Neon night: pink-rimmed glowing block, sunset title bar, glowing dots, Synthwave '84 tokens
  synthwave: {
    inline: 'bg-[#ff2bd6]/10 text-[#ff9de6] border-[#ff2bd6]/30',
    card: '!rounded-xl border border-[#ff2bd6]/40 bg-[#1b0b33] shadow-[0_0_28px_-10px_rgba(255,43,214,0.55)]',
    chip: '',
    copy: '',
    copied: 'text-[#3dffa8]',
    pre: 'text-[#ece6ff] selection:bg-[#ff2bd6]/40',
    prism: themes.synthwave84,
    header: {
      bar: 'bg-gradient-to-r from-[#2a0f4d] via-[#1b0b33] to-[#0f1a3d] border-b border-[#ff2bd6]/30',
      dot: '',
      dots: ['bg-[#ff2bd6] shadow-[0_0_6px_#ff2bd6]', 'bg-[#ffd319] shadow-[0_0_6px_#ffd319]', 'bg-[#00e5ff] shadow-[0_0_6px_#00e5ff]'],
      label: 'text-[#ff9de6] lowercase',
      button: 'text-[#00e5ff] hover:bg-[#00e5ff]/10 hover:text-white',
    },
  },
  // CRT screen: notched pixel frame in maze blue, square red/yellow/green lights
  'retro-arcade': {
    inline: 'bg-[#120c33] text-[#39ff88] border-[#3a5bff] !rounded-none',
    card: '!rounded-none border-0 bg-[#0e0a24] shadow-[0_-4px_0_0_#3a5bff,0_4px_0_0_#3a5bff,-4px_0_0_0_#3a5bff,4px_0_0_0_#3a5bff]',
    chip: '',
    copy: '',
    copied: 'text-[#39ff88]',
    pre: 'text-[#e8e6ff] selection:bg-[#ff7ad9]/40',
    prism: arcadePrism,
    header: {
      bar: 'bg-[#120c33] border-b-4 border-[#3a5bff]',
      dot: '',
      dots: ['!rounded-none bg-[#ff3b5c]', '!rounded-none bg-[#ffd23f]', '!rounded-none bg-[#39ff88]'],
      label: 'text-[#ffd23f] font-bold uppercase tracking-[0.2em]',
      button: '!rounded-none text-[#2de2e6] font-bold uppercase hover:bg-[#2de2e6] hover:text-[#05030f]',
    },
  },
  // HUD terminal: black block (chamfered via CSS), yellow-rimmed bar, square status lights
  cyberpunk: {
    inline: 'bg-[#0d0d0d] text-[#fcee0a] border-[#0d0d0d] font-semibold !rounded-none',
    card: '!rounded-none border-2 border-[#0d0d0d] bg-[#0a0a0f]',
    chip: '',
    copy: '',
    copied: 'text-[#fcee0a]',
    pre: 'text-[#e6e6e6] selection:bg-[#ff003c]/50',
    prism: cyberpunkPrism,
    header: {
      bar: 'bg-[#0d0d0d] border-b-2 border-[#fcee0a]',
      dot: '',
      dots: ['!rounded-none bg-[#ff003c]', '!rounded-none bg-[#fcee0a]', '!rounded-none bg-[#00e5f5]'],
      label: 'text-[#fcee0a] font-bold uppercase tracking-[0.18em]',
      button: '!rounded-none text-[#00e5f5] font-bold uppercase hover:bg-[#00e5f5] hover:text-[#0d0d0d]',
    },
  },
  // Printed panel: inked outline, black title bar, monochrome code
  'manga-scan': {
    inline: 'bg-[#0a0a0a] text-[#f4f1ea] border-[#0a0a0a] font-bold !rounded-none',
    card: '!rounded-none border-[3px] border-[#0a0a0a] bg-[#fbfaf6]',
    chip: '',
    copy: '',
    copied: 'text-current',
    pre: 'text-[#141414] selection:bg-[#0a0a0a] selection:text-[#f4f1ea]',
    prism: mangaPrism,
    header: {
      bar: 'bg-[#0a0a0a]',
      dot: 'bg-transparent border-[1.5px] border-[#f4f1ea]',
      label: 'text-[#f4f1ea] font-bold uppercase tracking-[0.2em]',
      button: '!rounded-none text-[#f4f1ea] font-bold uppercase hover:bg-[#f4f1ea] hover:text-[#0a0a0a]',
    },
  },
  // Dreamy pastel card: lavender outline, sakura/lavender/sky gradient title bar
  'anime-pastel': {
    inline: 'bg-[#fce7f3] text-[#be185d] border-[#fbcfe8] font-semibold',
    card: 'border-[1.5px] border-[#e9d5ff] bg-[#fdfaff] shadow-[0_10px_30px_-16px_rgba(168,85,247,0.35)]',
    chip: '',
    copy: '',
    copied: 'text-[#059669]',
    pre: 'text-[#4a3a5c] selection:bg-[#fbcfe8]',
    prism: themes.oneLight,
    header: {
      bar: 'border-b-[1.5px] border-[#e9d5ff] bg-gradient-to-r from-[#fce7f3] via-[#f3e8ff] to-[#e0f2fe]',
      dot: '',
      dots: ['bg-[#f9a8d4]', 'bg-[#c4b5fd]', 'bg-[#7dd3fc]'],
      label: 'text-[#7c3aed] font-bold lowercase',
      button: 'text-[#9d174d] font-bold hover:bg-white/70',
    },
  },
  // Comic strip: light card, ink outline + offset shadow, red/yellow/green window dots
  'comic-minimal': {
    inline: 'bg-[#fef9c3] text-[#b91c1c] border-[#fde68a] font-bold',
    card: 'border-[2.5px] border-[#1f2937] bg-[#fffdf5] shadow-[5px_5px_0_#1f2937]',
    chip: '',
    copy: '',
    copied: 'text-[#16a34a]',
    pre: 'text-[#1f2937] selection:bg-[#fde047]',
    prism: themes.oneLight,
    header: {
      bar: 'border-b-[2.5px] border-[#1f2937] bg-[#dbeafe]',
      dot: '',
      dots: [
        'bg-[#ef4444] border-[1.5px] border-[#1f2937]',
        'bg-[#facc15] border-[1.5px] border-[#1f2937]',
        'bg-[#22c55e] border-[1.5px] border-[#1f2937]',
      ],
      label: 'text-[#1f2937] font-bold lowercase',
      button: 'text-[#1f2937] font-bold hover:bg-[#1f2937] hover:text-white',
    },
  },
  // Comic panel: ink outline + hard shadow, yellow title bar, Monokai-style code
  borderlands: {
    inline: 'bg-[#ffd400] text-[#111] border-[#111] font-bold',
    card: '!rounded-none border-[3px] border-[#111] bg-[#1b1b1b] shadow-[6px_6px_0_#111]',
    chip: '',
    copy: '',
    copied: 'text-current',
    pre: 'text-[#f8f8f2] selection:bg-[#ffd400]/40',
    prism: themes.okaidia,
    header: {
      bar: 'border-b-[3px] border-[#111] bg-[#ffd400]',
      dot: 'bg-[#111]',
      label: 'text-[#111] font-black uppercase tracking-wider',
      button: 'text-[#111] font-bold uppercase hover:bg-[#111] hover:text-[#ffd400]',
    },
  },
  // Light notebook: paper "index card"
  notebook: {
    inline: 'bg-yellow-100/90 text-slate-900 border-yellow-200/80',
    card: 'border border-[#dbe4f2] border-l-4 border-l-indigo-300 bg-[#fffef9] shadow-[0_1px_2px_rgba(30,58,138,0.06),0_6px_16px_-6px_rgba(30,58,138,0.18)]',
    chip: 'text-indigo-500 bg-indigo-50/95 border-indigo-100',
    copy: 'text-slate-400 hover:text-indigo-600 bg-white/95 hover:bg-indigo-50 border-slate-200',
    copied: 'text-emerald-600',
    pre: 'text-slate-800 selection:bg-indigo-100',
    prism: themes.oneLight,
  },
  'github-light': {
    inline: 'bg-[#818b9833] text-[#1f2328] border-transparent',
    card: '!rounded-md bg-[#f6f8fa]',
    chip: 'text-[#59636e] bg-[#f6f8fa] border-[#d1d9e0]',
    copy: 'text-[#59636e] hover:text-[#1f2328] bg-[#f6f8fa] hover:bg-[#eff2f5] border-[#d1d9e0]',
    copied: 'text-[#1a7f37]',
    pre: 'text-[#1f2328] selection:bg-[#0969da]/20',
    prism: themes.github,
  },
  'github-dark': {
    inline: 'bg-[#656c7633] text-[#f0f6fc] border-transparent',
    card: '!rounded-md bg-[#151b23]',
    chip: 'text-[#9198a1] bg-[#212830] border-[#3d444d]',
    copy: 'text-[#9198a1] hover:text-[#f0f6fc] bg-[#212830] hover:bg-[#262c36] border-[#3d444d]',
    copied: 'text-[#3fb950]',
    pre: 'text-[#f0f6fc] selection:bg-[#4493f8]/30',
    prism: githubDarkPrism,
  },
  default: {
    inline: 'bg-slate-800/60 text-indigo-300 border-slate-700/40',
    card: 'border border-slate-800/80 bg-slate-950/70',
    chip: 'text-slate-400 bg-slate-900/90 border-slate-800',
    copy: 'text-slate-400 hover:text-white bg-slate-900/90 hover:bg-slate-800 border-slate-800',
    copied: 'text-emerald-400',
    pre: 'text-slate-200 selection:bg-indigo-500/30',
    prism: themes.vsDark,
  },
};

const CodeBlock = ({ inline, children, className, theme, ...props }: any) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const code = String(children).replace(/\n$/, '');

  const isBlock = !inline && (Boolean(match) || code.includes('\n') || (className && className.includes('language-')));

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const styles = CODE_STYLES[theme] ?? CODE_STYLES.default;

  if (!isBlock && (inline || (!match && !code.includes('\n')))) {
    return (
      <code className={`px-1.5 py-0.5 rounded text-[13px] font-mono border ${styles.inline}`} {...props}>
        {children}
      </code>
    );
  }

  if (language === 'mermaid') {
    return <MermaidDiagram code={code} theme={theme} />;
  }

  return (
    <div className={`not-prose relative group rounded-lg overflow-hidden my-4 ${styles.card}`}>
      {styles.header && (
        <div className={`flex items-center justify-between gap-3 h-9 pl-3.5 pr-1.5 ${styles.header.bar}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex gap-1.5 shrink-0" aria-hidden="true">
              {(styles.header.dots ?? [styles.header.dot, styles.header.dot, styles.header.dot]).map((dotClass, i) => (
                <span key={i} className={`w-2.5 h-2.5 rounded-full ${dotClass}`} />
              ))}
            </div>
            <span className={`text-[11px] font-mono truncate ${styles.header.label}`}>{language || 'text'}</span>
          </div>
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 h-6 px-2 rounded-md text-[11px] font-medium transition-colors ${styles.header.button}`}
            title="Copy code"
          >
            {copied ? <><Check size={13} className={styles.copied} />Copied</> : <><Copy size={13} />Copy</>}
          </button>
        </div>
      )}

      {/* Floating Top-Right Controls */}
      {!styles.header && <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 opacity-100 sm:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity z-10">
        {language && language !== 'text' && language !== 'code' && (
          <span className={`text-[10px] font-mono uppercase select-none px-1.5 py-0.5 rounded border backdrop-blur ${styles.chip}`}>
            {language}
          </span>
        )}
        <button
          onClick={handleCopy}
          className={`p-1.5 rounded-md border shadow-sm backdrop-blur transition-all flex items-center gap-1 ${styles.copy}`}
          title="Copy code"
        >
          {copied ? (
            <>
              <Check size={13} className={styles.copied} />
              <span className={`text-[10px] font-sans font-medium pr-0.5 ${styles.copied}`}>Copied</span>
            </>
          ) : (
            <Copy size={13} />
          )}
        </button>
      </div>}

      {/* Syntax Highlighted Code Body */}
      <Highlight theme={styles.prism} code={code} language={language || 'text'}>
        {({ className: highlightClass, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={`!p-4 sm:!p-5 ${styles.header ? '' : '!pr-16'} !m-0 overflow-x-auto text-[13px] font-mono leading-relaxed custom-scrollbar ${styles.pre}`}
            style={{
              ...style,
              backgroundColor: 'transparent',
              padding: '16px 20px',
              paddingRight: '60px',
              margin: 0
            }}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
};

// Image renderer with lazy loading, error fallback, and zoom lightbox
const ImageRenderer = memo(({ src, alt, ...props }: any) => {
  const [hasError, setHasError] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  if (hasError) {
    return (
      <div className="my-4 flex items-center gap-3 p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-400">
        <ImageOff size={20} className="shrink-0 text-slate-500" />
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-300">Image failed to load</div>
          {src && <div className="text-[10px] font-mono truncate mt-0.5 opacity-60">{src}</div>}
        </div>
      </div>
    );
  }

  return (
    <>
      <img
        src={src}
        alt={alt || ''}
        loading="lazy"
        onClick={() => setZoomed(true)}
        onError={() => setHasError(true)}
        className="cursor-zoom-in transition-transform hover:scale-[1.01] active:scale-100"
        {...props}
      />
      {zoomed && createPortal(
        <div
          className="fixed inset-0 z-[10001] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoomed(false)}
        >
          <img
            src={src}
            alt={alt || ''}
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setZoomed(false)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur transition-colors"
          >
            <X size={20} />
          </button>
          {alt && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-white/70 bg-black/50 px-4 py-2 rounded-full backdrop-blur max-w-md truncate">
              {alt}
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
});

// Styled details/summary for collapsible sections
const DetailsRenderer = ({ children, ...props }: any) => (
  <details
    className="my-4 rounded-lg border border-slate-700/50 bg-slate-800/30 overflow-hidden group/details open:ring-1 open:ring-indigo-500/20 transition-all"
    {...props}
  >
    {children}
  </details>
);

const SummaryRenderer = ({ children, ...props }: any) => (
  <summary
    className="px-4 py-3 cursor-pointer select-none font-semibold text-sm text-slate-200 hover:text-white bg-slate-800/50 hover:bg-slate-800/80 transition-colors list-none flex items-center gap-2 [&::-webkit-details-marker]:hidden"
    {...props}
  >
    <ChevronRight size={14} className="shrink-0 transition-transform group-open/details:rotate-90 text-indigo-400" />
    {children}
  </summary>
);

const extractHeadings = (text: string): Heading[] => {
  const headings: Heading[] = [];
  const lines = text.split('\n');
  const codeBlockRegex = /^```/;
  let inCodeBlock = false;
  const slugCounts: Record<string, number> = {};

  lines.forEach((line) => {
    if (codeBlockRegex.test(line)) {
      inCodeBlock = !inCodeBlock;
    }
    if (!inCodeBlock) {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const rawText = match[2];
        // Remove markdown formatting from heading text for the outline
        const cleanText = rawText
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          .replace(/[*_~`]/g, '')
          .trim();
        // Generate a URL-friendly slug
        const baseSlug = cleanText.toLowerCase().replace(/[^\p{L}\p{M}\p{N}_]+/gu, '-').replace(/(^-|-$)/g, '');
        let id = baseSlug;
        if (slugCounts[baseSlug]) {
          id = `${baseSlug}-${slugCounts[baseSlug]}`;
          slugCounts[baseSlug]++;
        } else {
          slugCounts[baseSlug] = 1;
        }
        headings.push({ level, text: cleanText, id });
      }
    }
  });
  return headings;
};

// Flatten React children to text to generate anchor IDs
const flatten = (text: string, child: any): string => {
  if (typeof child === 'string' || typeof child === 'number') {
    return text + String(child);
  }
  if (child && typeof child === 'object' && 'props' in child && child.props.children) {
    return React.Children.toArray(child.props.children).reduce(flatten, text) as string;
  }
  return text;
};

const customRehypeSlug = () => (tree: any) => {
  const slugCounts: Record<string, number> = {};

  const addSlugsToTree = (node: any) => {
    if (node.type === 'element' && /^h[1-6]$/.test(node.tagName)) {
      let text = '';
      const extractText = (n: any) => {
        if (n.type === 'text') text += n.value;
        else if (n.children) n.children.forEach(extractText);
      };
      extractText(node);
      const baseSlug = text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}_]+/gu, '-').replace(/(^-|-$)/g, '');
      let id = baseSlug;
      if (slugCounts[baseSlug]) {
        id = `${baseSlug}-${slugCounts[baseSlug]}`;
        slugCounts[baseSlug]++;
      } else {
        slugCounts[baseSlug] = 1;
      }
      node.properties = node.properties || {};
      node.properties.id = id;
    }
    if (node.children) {
      node.children.forEach((child: any) => addSlugsToTree(child));
    }
  };

  addSlugsToTree(tree);
};

const getHeadingClass = (level: number) => {
  switch (level) {
    case 1:
      return 'text-2xl sm:text-3xl font-extrabold tracking-tight mt-7 mb-4 border-b border-slate-700/50 pb-2.5';
    case 2:
      return 'text-xl sm:text-2xl font-bold tracking-tight mt-6 mb-3 border-b border-slate-800/40 pb-2';
    case 3:
      return 'text-lg sm:text-xl font-bold mt-5 mb-2.5';
    case 4:
      return 'text-base sm:text-lg font-semibold mt-4 mb-2';
    case 5:
      return 'text-sm sm:text-base font-semibold text-slate-300 mt-3 mb-1.5 uppercase tracking-wide';
    case 6:
      return 'text-xs sm:text-sm font-semibold text-slate-400 mt-2.5 mb-1 uppercase tracking-wider';
    default:
      return 'font-bold';
  }
};

const HeadingRenderer = (props: any) => {
  const { level, children, id: propId, onHeadingClick, theme, ...restProps } = props;
  const isCssStyled = CSS_STYLED_THEMES.includes(theme);
  const childArray = React.Children.toArray(children);
  const text = (childArray.reduce(flatten, '') as string) || '';
  const slug = text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}_]+/gu, '-').replace(/(^-|-$)/g, '');
  const id = propId || slug;

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const closestAnchor = target.closest('a');
    if (closestAnchor && closestAnchor.getAttribute('href') !== `#${id}`) {
      return;
    }
    e.preventDefault();
    if (onHeadingClick) {
      onHeadingClick(id);
    }
  };

  return React.createElement(
    `h${level}`,
    {
      id,
      onClick: handleClick,
      // CSS-styled themes size headings in index.css (.gh-markdown / .dd-markdown)
      className: `scroll-mt-20 group relative cursor-pointer hover:opacity-90 transition-opacity ${isCssStyled ? '' : getHeadingClass(level)}`,
      ...restProps
    },
    isCssStyled
      ? [<a key="heading-anchor" href={`#${id}`} className="heading-anchor" aria-hidden="true"><LinkIcon size={16} /></a>, ...childArray]
      : childArray
  );
};

const GITHUB_ALERTS: Record<string, { label: string; icon: typeof Info }> = {
  note: { label: 'Note', icon: Info },
  tip: { label: 'Tip', icon: Lightbulb },
  important: { label: 'Important', icon: MessageSquareWarning },
  warning: { label: 'Warning', icon: TriangleAlert },
  caution: { label: 'Caution', icon: OctagonAlert },
};

// Turns `> [!NOTE]` style blockquotes into GitHub alerts: strips the marker and tags the node
const rehypeGithubAlerts = () => (tree: any) => {
  const visit = (node: any) => {
    if (node.type === 'element' && node.tagName === 'blockquote') {
      const firstP = node.children?.find((c: any) => c.type === 'element');
      const firstText = firstP?.tagName === 'p' ? firstP.children?.[0] : null;
      const match = firstText?.type === 'text' ? /^\s*\[!(note|tip|important|warning|caution)\]\s*/i.exec(firstText.value) : null;
      if (match) {
        const type = match[1].toLowerCase();
        firstText.value = firstText.value.slice(match[0].length);
        if (!firstText.value) firstP.children.shift();
        if (firstP.children[0]?.tagName === 'br') firstP.children.shift();
        if (firstP.children.length === 0) node.children.splice(node.children.indexOf(firstP), 1);
        node.properties = { ...node.properties, className: ['markdown-alert', `markdown-alert-${type}`], dataAlert: type };
      }
    }
    node.children?.forEach(visit);
  };
  visit(tree);
};

const RULED_THEMES = ['notebook', 'notebook-dark'];
const RULE_HEIGHT = 32;

// Pads each block so its height is a whole number of ruled lines, keeping
// the text after code blocks, tables, images, diagrams and math on the lines.
const snapToRuledLines = (root: HTMLElement) => {
  const blocks = Array.from(
    root.querySelectorAll<HTMLElement>(':scope > *, :scope li > *, :scope blockquote > *, :scope details > *')
  )
    .filter((el) => !getComputedStyle(el).display.startsWith('inline'))
    .reverse(); // innermost first, so parents measure already-snapped children

  blocks.forEach((el) => el.style.removeProperty('--snap'));
  blocks.forEach((el) => {
    const height = el.getBoundingClientRect().height;
    const snapped = Math.ceil((height - 0.5) / RULE_HEIGHT) * RULE_HEIGHT;
    el.style.setProperty('--snap', `${Math.max(0, snapped - height)}px`);
  });
};

const getThemeClasses = (theme: string) => {
  switch (theme) {
    // GitHub themes skip `prose`; .gh-markdown in index.css reproduces GitHub's README styles
    case 'github-light':
      return {
        container: "flex-1 px-3 py-4 sm:p-8 overflow-auto bg-white custom-scrollbar scroll-smooth",
        prose: "gh-markdown gh-light markdown-body"
      };
    case 'github-dark':
      return {
        container: "flex-1 px-3 py-4 sm:p-8 overflow-auto bg-[#0d1117] custom-scrollbar scroll-smooth",
        prose: "gh-markdown gh-dark markdown-body"
      };
    // Always dark (it used to follow the app's light/dark class); styled by .dd-markdown in index.css
    case 'default-dark':
      return {
        container: "dd-surface flex-1 px-5 py-8 sm:px-10 sm:py-12 overflow-auto custom-scrollbar scroll-smooth",
        prose: "dd-markdown markdown-body"
      };
    case 'notebook-dark':
      return {
        // pt-8 keeps the content top on a rule; bg-local makes the lines scroll with the text
        container: "flex-1 px-4 pt-8 pb-8 sm:px-8 overflow-auto bg-[#1e1e2e] text-slate-300 custom-scrollbar scroll-smooth bg-local bg-[linear-gradient(transparent_31px,#3b82f61a_32px)] bg-[length:100%_32px]",
        prose: "ruled-notebook [--heading-rule:rgba(129,140,248,0.35)] prose prose-sm sm:prose-base dark:prose-invert max-w-3xl mx-auto font-['Comic_Neue','Comic_Sans_MS','Chalkboard_SE','Marker_Felt',sans-serif] " +
          "prose-headings:font-['Comic_Neue','Comic_Sans_MS','Chalkboard_SE','Marker_Felt',sans-serif] prose-headings:text-indigo-300 " +
          "prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline " +
          "prose-pre:p-0 prose-pre:bg-transparent prose-pre:border-0 " +
          "prose-code:bg-yellow-900/30 prose-code:text-yellow-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none " +
          "prose-th:bg-blue-900/20 prose-th:px-2 prose-td:px-2 " +
          "prose-img:rounded-lg prose-img:shadow-md " +
          "prose-blockquote:border-l-4 prose-blockquote:border-red-500/50 prose-blockquote:bg-red-900/10 prose-blockquote:px-4 prose-blockquote:italic prose-blockquote:text-slate-400 " +
          "markdown-body pb-12 relative " +
          "before:absolute before:top-0 before:bottom-0 before:w-px before:bg-red-500/30 before:-left-6 sm:before:-left-8"
      };
    // Comic panel on halftone paper; styled by .bl-markdown in index.css (Bangers loaded on select)
    case 'borderlands':
      return {
        container: "bl-surface flex-1 px-4 py-8 sm:px-10 sm:py-12 overflow-auto custom-scrollbar scroll-smooth",
        prose: "bl-markdown markdown-body"
      };
    // Sunday comic strip on sketchbook paper; styled by .cm-markdown in index.css
    case 'comic-minimal':
      return {
        container: "cm-surface flex-1 px-5 py-8 sm:px-10 sm:py-12 overflow-auto custom-scrollbar scroll-smooth",
        prose: "cm-markdown markdown-body"
      };
    // Dreamy pastel haze + frosted page; styled by .ap-markdown in index.css (M PLUS Rounded 1c loaded on select)
    case 'anime-pastel':
      return {
        container: "ap-surface flex-1 px-4 py-8 sm:px-10 sm:py-12 overflow-auto custom-scrollbar scroll-smooth",
        prose: "ap-markdown markdown-body"
      };
    // Scanned B&W manga page on a dark reader; styled by .ms-markdown in index.css (fonts loaded on select)
    case 'manga-scan':
      return {
        container: "ms-surface flex-1 px-3 py-8 sm:px-10 sm:py-12 overflow-auto custom-scrollbar scroll-smooth",
        prose: "ms-markdown markdown-body"
      };
    // Yellow HUD with a chamfered paper panel; styled by .cp-markdown in index.css (fonts loaded on select)
    case 'cyberpunk':
      return {
        container: "cp-surface flex-1 px-3 py-8 sm:px-10 sm:py-12 overflow-auto custom-scrollbar scroll-smooth",
        prose: "cp-markdown markdown-body"
      };
    // 80s cabinet CRT with a neon bezel; styled by .rc-markdown in index.css (pixel fonts loaded on select)
    case 'retro-arcade':
      return {
        container: "rc-surface flex-1 px-3 py-8 sm:px-10 sm:py-12 overflow-auto custom-scrollbar scroll-smooth",
        prose: "rc-markdown markdown-body"
      };
    // '84 sunset: static sky/sun/grid behind a frosted neon panel; styled by .sw-markdown in index.css
    // (extra top padding lets the sun rise above the panel before content scrolls over it)
    case 'synthwave':
      return {
        container: "sw-surface flex-1 px-4 pt-28 pb-12 sm:px-10 sm:pt-44 sm:pb-16 overflow-auto custom-scrollbar scroll-smooth",
        prose: "sw-markdown markdown-body"
      };
    // Flat brights + ink borders on one white card; styled by .nb-markdown in index.css (fonts loaded on select)
    case 'neubrutalism':
      return {
        container: "nb-surface flex-1 px-4 py-8 sm:px-10 sm:py-12 overflow-auto custom-scrollbar scroll-smooth",
        prose: "nb-markdown markdown-body"
      };
    // Candy-shop sticker book: polka dots + one lace-edged card; styled by .kw-markdown in index.css
    // (extra top padding leaves room for the lace trim and face sticker)
    case 'kawaii':
      return {
        container: "kw-surface flex-1 px-4 pt-10 pb-12 sm:px-10 sm:pt-14 sm:pb-16 overflow-auto custom-scrollbar scroll-smooth",
        prose: "kw-markdown markdown-body"
      };
    // Classroom slate in a wooden frame with a chalk tray; styled by .cb-markdown in index.css
    // (padding leaves room for the frame and the tray below the board)
    case 'chalkboard':
      return {
        container: "cb-surface flex-1 px-5 pt-10 pb-16 sm:px-12 sm:pt-14 sm:pb-20 overflow-auto custom-scrollbar scroll-smooth",
        prose: "cb-markdown markdown-body"
      };
    case 'notebook':
    default:
      return {
        container: "flex-1 px-4 pt-8 pb-8 sm:px-8 overflow-auto bg-[#fdfaf6] text-slate-800 custom-scrollbar scroll-smooth bg-local bg-[linear-gradient(transparent_31px,#3b82f633_32px)] bg-[length:100%_32px]",
        prose: "ruled-notebook [--heading-rule:rgba(59,130,246,0.4)] prose prose-sm sm:prose-base max-w-3xl mx-auto font-['Comic_Neue','Comic_Sans_MS','Chalkboard_SE','Marker_Felt',sans-serif] " +
          "prose-headings:font-['Comic_Neue','Comic_Sans_MS','Chalkboard_SE','Marker_Felt',sans-serif] prose-headings:text-indigo-900 " +
          "prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline " +
          "prose-pre:p-0 prose-pre:bg-transparent prose-pre:border-0 " +
          "prose-code:bg-yellow-100 prose-code:text-slate-900 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none " +
          "prose-th:bg-blue-50 prose-th:px-2 prose-td:px-2 " +
          "prose-img:rounded-lg prose-img:shadow-md " +
          "prose-blockquote:border-l-4 prose-blockquote:border-red-400 prose-blockquote:bg-red-50/50 prose-blockquote:px-4 prose-blockquote:italic prose-blockquote:text-slate-700 " +
          "markdown-body pb-12 relative " +
          "before:absolute before:top-0 before:bottom-0 before:w-px before:bg-red-400/60 before:-left-6 sm:before:-left-8"
      };
  }
};

const getCaretCoordinates = (element: HTMLTextAreaElement, position: number) => {
  const div = document.createElement('div');
  const computed = window.getComputedStyle(element);

  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap = 'break-word';
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';

  const props = [
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'textTransform', 'wordSpacing', 'textIndent',
    'lineHeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderWidth', 'boxSizing', 'width'
  ];
  props.forEach((prop: any) => {
    div.style[prop] = computed[prop];
  });

  div.textContent = element.value.substring(0, position);
  const span = document.createElement('span');
  span.textContent = element.value.substring(position) || '.';
  div.appendChild(span);

  document.body.appendChild(div);
  const top = span.offsetTop;
  document.body.removeChild(div);
  return top;
};

const TextPreviewPopup: React.FC = () => {
  const activePreviewText = useStore(state => state.activePreviewText);
  const activePreviewPath = useStore(state => state.activePreviewPath);
  const setActivePreviewText = useStore(state => state.setActivePreviewText);
  const updateNodeValue = useStore(state => state.updateNodeValue);
  const [copied, setCopied] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'raw' | 'markdown' | 'html' | 'edit'>('raw');
  const [mdTheme, setMdTheme] = React.useState<string>(() => localStorage.getItem('mdTheme') || 'notebook-dark');
  const [mdFont, setMdFont] = React.useState<string>(() => localStorage.getItem('mdFont') || 'System Default');

  React.useEffect(() => {
    localStorage.setItem('mdTheme', mdTheme);
    THEME_FONTS[mdTheme]?.forEach((font) => loadGoogleFont(font));
  }, [mdTheme]);

  const mdFamily = getThemeFamily(mdTheme);
  const mdMode = getThemeMode(mdTheme);
  const canToggleMdMode = Boolean(mdFamily.light && mdFamily.dark);
  const mdModeUnavailableHint = `${mdFamily.name} only comes in ${mdMode} mode`;

  // Switching theme keeps the current mode when the new theme has it
  const selectMdThemeFamily = (name: string) => {
    const family = MD_THEME_FAMILIES.find((f) => f.name === name);
    const next = family && (family[mdMode] ?? family.light ?? family.dark);
    if (next) setMdTheme(next);
  };

  const setMdMode = (mode: ThemeMode) => {
    const next = mdFamily[mode];
    if (next) setMdTheme(next);
  };

  // Mobile actions live in a bottom sheet rendered inside the popup, so it inherits the theme chrome
  const [showMobileMenu, setShowMobileMenu] = React.useState(false);

  // Desktop-only: expand the popup to fill the viewport (small screens are already full screen)
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const fileName = activePreviewPath?.split(/[/\\]/).pop() || 'Untitled';

  React.useEffect(() => {
    localStorage.setItem('mdFont', mdFont);
    if (mdFont !== 'System Default') {
      const fontNode = FONTS.find(f => f.fontFamily === mdFont);
      if (fontNode) {
        loadGoogleFont(fontNode.googleFontName);
      }
    }
  }, [mdFont]);
  const [editText, setEditText] = React.useState('');
  const [showHeader, setShowHeader] = React.useState(true);
  const [showOutline, setShowOutline] = React.useState(false);
  const [outlineFullScreen, setOutlineFullScreen] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);

  // Esc closes the Appearance drawer
  React.useEffect(() => {
    if (!showSettings) return;
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSettings(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [showSettings]);
  const [activeHeadingId, setActiveHeadingId] = React.useState<string>('');
  const [keyboardLocked, setKeyboardLocked] = React.useState(false);
  const [wordWrap, setWordWrap] = React.useState(true);
  const [showSearch, setShowSearch] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchMatchCount, setSearchMatchCount] = React.useState(0);
  const [currentSearchMatch, setCurrentSearchMatch] = React.useState(0);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 640 && !showHeader) {
        setShowHeader(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [showHeader]);

  const initializedPathRef = React.useRef<string | null>(null);
  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const outlineRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const proseRef = React.useRef<HTMLDivElement>(null);

  // Notebook themes: keep every block aligned to the ruled lines. Re-snaps
  // whenever the rendered document changes size (images, mermaid, fonts, resize).
  const isRuledTheme = RULED_THEMES.includes(mdTheme);
  React.useLayoutEffect(() => {
    const root = proseRef.current;
    if (viewMode !== 'markdown' || !isRuledTheme || !root) return;
    let frame = 0;
    snapToRuledLines(root);
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => snapToRuledLines(root));
    });
    observer.observe(root);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [viewMode, isRuledTheme, editText, mdFont]);

  const navHoldTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNavHoldRef = React.useRef(false);

  const touchStartX = React.useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const dx = touchEndX - touchStartX.current;

    if (dx > 50 && viewMode === 'markdown' && window.innerWidth < 640 && !showOutline && touchStartX.current < window.innerWidth / 2) {
      setShowOutline(true);
    } else if (dx < -50 && showOutline) {
      setShowOutline(false);
    }

    touchStartX.current = null;
  };

  const handleHeadingClick = React.useCallback((id: string) => {
    setActiveHeadingId(id);
    if (contentRef.current) {
      const el = document.getElementById(id);
      if (el) {
        const container = contentRef.current;
        const containerTop = container.getBoundingClientRect().top;
        const elTop = el.getBoundingClientRect().top;
        container.scrollTo({
          top: container.scrollTop + (elTop - containerTop) - 20,
          behavior: 'smooth'
        });
      }
    }
  }, []);

  React.useEffect(() => {
    if (!activePreviewPath) {
      initializedPathRef.current = null;
      return;
    }

    if (activePreviewText !== null && activePreviewText !== undefined && activePreviewPath !== initializedPathRef.current) {
      initializedPathRef.current = activePreviewPath;
      setEditText(activePreviewText);
      if (!activePreviewText) {
        setViewMode('edit');
      } else {
        const val = activePreviewText.toLowerCase().trim();
        if (
          val.startsWith('<html') ||
          val.startsWith('<!doc') ||
          val.includes('<head>') ||
          val.includes('<body>') ||
          val.includes('</div>') ||
          val.includes('</p>') ||
          val.includes('</a>')
        ) {
          setViewMode('html');
        } else if (activePreviewText.startsWith('#') || activePreviewText.includes('\n# ') || activePreviewPath.endsWith('.md')) {
          setViewMode('markdown');
        } else {
          setViewMode('raw');
        }
      }
    }
  }, [activePreviewText, activePreviewPath]);

  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Scroll active item into view in outline sidebar
  React.useEffect(() => {
    if (activeHeadingId && outlineRef.current) {
      try {
        const activeEl = outlineRef.current.querySelector(`[data-outline-id="${CSS.escape(activeHeadingId)}"]`);
        if (activeEl) {
          activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      } catch (err) {
        // Fallback if querySelector fails
      }
    }
  }, [activeHeadingId]);

  // Update active heading based on scroll
  React.useEffect(() => {
    if (viewMode !== 'markdown') return;

    const handleScroll = () => {
      if (!contentRef.current) return;
      const headings = Array.from(contentRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      let currentActiveId = '';

      for (const heading of headings) {
        const rect = heading.getBoundingClientRect();
        if (rect.top <= 120) { // Offset for the sticky header
          currentActiveId = heading.id;
        } else {
          break; // Stop once we find a heading below the offset
        }
      }

      if (currentActiveId) setActiveHeadingId(currentActiveId);
    };

    const container = contentRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [viewMode]);

  // Ctrl+F search handler
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        e.stopPropagation();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
        setSearchQuery('');
        clearSearchHighlights();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [showSearch]);

  // Search highlight logic
  const clearSearchHighlights = React.useCallback(() => {
    if (!contentRef.current) return;
    const marks = contentRef.current.querySelectorAll('mark[data-search-highlight]');
    marks.forEach((mark) => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
        parent.normalize();
      }
    });
    setSearchMatchCount(0);
    setCurrentSearchMatch(0);
  }, []);

  const performSearch = React.useCallback((query: string) => {
    clearSearchHighlights();
    if (!query.trim() || !contentRef.current) return;

    const walker = document.createTreeWalker(contentRef.current, NodeFilter.SHOW_TEXT, null);
    const textNodes: Text[] = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode as Text);
    }

    let matchCount = 0;
    const lowerQuery = query.toLowerCase();

    textNodes.forEach((node) => {
      const text = node.textContent || '';
      const lowerText = text.toLowerCase();
      if (!lowerText.includes(lowerQuery)) return;

      const frag = document.createDocumentFragment();
      let lastIndex = 0;

      let idx = lowerText.indexOf(lowerQuery, lastIndex);
      while (idx !== -1) {
        if (idx > lastIndex) {
          frag.appendChild(document.createTextNode(text.slice(lastIndex, idx)));
        }
        const mark = document.createElement('mark');
        mark.setAttribute('data-search-highlight', String(matchCount));
        mark.className = 'bg-yellow-400/40 text-inherit rounded-sm px-0.5';
        mark.textContent = text.slice(idx, idx + query.length);
        frag.appendChild(mark);
        matchCount++;
        lastIndex = idx + query.length;
        idx = lowerText.indexOf(lowerQuery, lastIndex);
      }

      if (lastIndex < text.length) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      node.parentNode?.replaceChild(frag, node);
    });

    setSearchMatchCount(matchCount);
    if (matchCount > 0) {
      setCurrentSearchMatch(1);
      scrollToMatch(0);
    }
  }, [clearSearchHighlights]);

  const scrollToMatch = React.useCallback((index: number) => {
    if (!contentRef.current) return;
    const marks = contentRef.current.querySelectorAll('mark[data-search-highlight]');
    marks.forEach((m) => m.classList.remove('!bg-indigo-500/60', 'ring-2', 'ring-indigo-400'));
    if (marks[index]) {
      marks[index].classList.add('!bg-indigo-500/60', 'ring-2', 'ring-indigo-400');
      marks[index].scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, []);

  const nextSearchMatch = React.useCallback(() => {
    if (searchMatchCount === 0) return;
    const next = currentSearchMatch >= searchMatchCount ? 1 : currentSearchMatch + 1;
    setCurrentSearchMatch(next);
    scrollToMatch(next - 1);
  }, [currentSearchMatch, searchMatchCount, scrollToMatch]);

  const prevSearchMatch = React.useCallback(() => {
    if (searchMatchCount === 0) return;
    const prev = currentSearchMatch <= 1 ? searchMatchCount : currentSearchMatch - 1;
    setCurrentSearchMatch(prev);
    scrollToMatch(prev - 1);
  }, [currentSearchMatch, searchMatchCount, scrollToMatch]);

  React.useEffect(() => {
    const timer = setTimeout(() => performSearch(searchQuery), 200);
    return () => clearTimeout(timer);
  }, [searchQuery, performSearch]);

  // Download handler
  const handleDownload = React.useCallback((format: 'md' | 'html' | 'txt') => {
    let content = editText;
    let mimeType = 'text/plain';
    let ext = 'txt';

    if (format === 'md') {
      mimeType = 'text/markdown';
      ext = 'md';
    } else if (format === 'html') {
      // For HTML, grab the rendered content if we're in markdown/html mode
      if (contentRef.current) {
        content = contentRef.current.innerHTML;
      }
      mimeType = 'text/html';
      ext = 'html';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const baseName = activePreviewPath?.split('.').slice(0, -1).join('.') || 'document';
    a.href = url;
    a.download = `${baseName}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [editText, activePreviewPath]);

  const headings = useMemo(() => extractHeadings(editText), [editText]);


  const markdownComponents = React.useMemo(() => ({
    pre: ({ children }: any) => <>{children}</>,
    code: ({ node, inline, className, children, ...props }: any) => (
      <CodeBlock inline={inline} className={className} theme={mdTheme} {...props}>
        {children}
      </CodeBlock>
    ),
    h1: (props: any) => <HeadingRenderer level={1} theme={mdTheme} onHeadingClick={handleHeadingClick} {...props} />,
    h2: (props: any) => <HeadingRenderer level={2} theme={mdTheme} onHeadingClick={handleHeadingClick} {...props} />,
    h3: (props: any) => <HeadingRenderer level={3} theme={mdTheme} onHeadingClick={handleHeadingClick} {...props} />,
    h4: (props: any) => <HeadingRenderer level={4} theme={mdTheme} onHeadingClick={handleHeadingClick} {...props} />,
    h5: (props: any) => <HeadingRenderer level={5} theme={mdTheme} onHeadingClick={handleHeadingClick} {...props} />,
    h6: (props: any) => <HeadingRenderer level={6} theme={mdTheme} onHeadingClick={handleHeadingClick} {...props} />,
    blockquote: ({ node, children, ...props }: any) => {
      const alert = GITHUB_ALERTS[props['data-alert']];
      if (!alert) return <blockquote {...props}>{children}</blockquote>;
      const Icon = alert.icon;
      return (
        <blockquote {...props}>
          <p className="markdown-alert-title"><Icon size={16} strokeWidth={2.25} />{alert.label}</p>
          {children}
        </blockquote>
      );
    },
    kbd: ({ node, ...props }: any) => CSS_STYLED_THEMES.includes(mdTheme) ? <kbd {...props} /> : (
      <kbd
        className="!inline-flex !items-center !justify-center !bg-indigo-500/10 !text-indigo-400 !px-2.5 !py-0.5 !mx-1 !rounded-full !text-[10px] !tracking-widest !font-sans !font-bold !border !border-indigo-500/30 !shadow-none !whitespace-nowrap uppercase !leading-none align-baseline transform -translate-y-[1px]"
        {...props}
      />
    ),
    a: ({ node, href, children, ...props }: any) => {
      if (href && href.startsWith('#')) {
        const targetId = href.substring(1);
        return (
          <a
            href={href}
            onClick={(e) => {
              e.preventDefault();
              handleHeadingClick(targetId);
            }}
            {...props}
          >
            {children}
          </a>
        );
      }
      return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
    },
    table: ({ node, ...props }: any) => (
      <div className="overflow-x-auto my-6 rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left border-collapse m-0" {...props} />
      </div>
    ),
    input: ({ node, ...props }: any) => {
      if (props.type === 'checkbox') {
        return <input type="checkbox" className="mr-2 rounded text-indigo-500 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700" {...props} disabled={false} readOnly />
      }
      return <input {...props} />
    },
    img: ({ node, ...props }: any) => <ImageRenderer {...props} />,
    details: ({ node, ...props }: any) => <DetailsRenderer {...props} />,
    summary: ({ node, ...props }: any) => <SummaryRenderer {...props} />,
  }), [mdTheme, handleHeadingClick]);

  const [showHeadingMenu, setShowHeadingMenu] = React.useState(false);
  const headingTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = React.useRef(false);

  const startHeadingPress = () => {
    isLongPressRef.current = false;
    if (headingTimerRef.current) clearTimeout(headingTimerRef.current);
    headingTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setShowHeadingMenu(true);
    }, 250);
  };

  const endHeadingPress = () => {
    if (headingTimerRef.current) {
      clearTimeout(headingTimerRef.current);
      headingTimerRef.current = null;
    }
  };

  const selectHeadingLevel = (lvl: number) => {
    insertTextAtCursor('#'.repeat(lvl) + ' ', '');
    setShowHeadingMenu(false);
  };

  const [pasted, setPasted] = React.useState(false);

  const handleUndo = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    try {
      document.execCommand('undo');
      setEditText(textarea.value);
      triggerSave(textarea.value);
    } catch (err) {
      console.warn('Native undo failed:', err);
    }
  };

  const handleRedo = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    try {
      document.execCommand('redo');
      setEditText(textarea.value);
      triggerSave(textarea.value);
    } catch (err) {
      console.warn('Native redo failed:', err);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePasteClipboard = async () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    try {
      const clipText = await navigator.clipboard.readText();
      if (!clipText) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      textarea.focus();
      textarea.setSelectionRange(start, end);

      if (!document.execCommand('insertText', false, clipText)) {
        const newValue = editText.substring(0, start) + clipText + editText.substring(end);
        setEditText(newValue);
        triggerSave(newValue);
      }

      setTimeout(() => {
        textarea.setSelectionRange(start + clipText.length, start + clipText.length);
      }, 0);

      setPasted(true);
      setTimeout(() => setPasted(false), 1500);
    } catch (err) {
      console.warn('Clipboard read failed:', err);
    }
  };

  const setCursorAndScroll = (textarea: HTMLTextAreaElement, pos: number) => {
    textarea.focus();
    textarea.setSelectionRange(pos, pos);
    try {
      const caretTop = getCaretCoordinates(textarea, pos);
      const scrollTop = textarea.scrollTop;
      const clientHeight = textarea.clientHeight;
      const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight) || 20;

      if (caretTop < scrollTop + lineHeight) {
        textarea.scrollTop = Math.max(0, caretTop - lineHeight * 2);
      } else if (caretTop > scrollTop + clientHeight - lineHeight * 2) {
        textarea.scrollTop = caretTop - clientHeight + lineHeight * 3;
      }
    } catch (e) { }
  };

  const moveCursorLeft = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const pos = Math.max(0, textarea.selectionStart - 1);
    setCursorAndScroll(textarea, pos);
  };

  const moveCursorRight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const pos = Math.min(textarea.value.length, textarea.selectionEnd + 1);
    setCursorAndScroll(textarea, pos);
  };

  const moveCursorUp = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const val = textarea.value;
    const currentPos = textarea.selectionStart;
    const before = val.slice(0, currentPos);
    const currentLineStart = before.lastIndexOf('\n') + 1;
    const col = currentPos - currentLineStart;

    if (currentLineStart > 0) {
      const prevText = val.slice(0, currentLineStart - 1);
      const prevLineStart = prevText.lastIndexOf('\n') + 1;
      const prevLineLength = (currentLineStart - 1) - prevLineStart;
      const targetPos = prevLineStart + Math.min(col, prevLineLength);
      setCursorAndScroll(textarea, targetPos);
    } else {
      setCursorAndScroll(textarea, 0);
    }
  };

  const moveCursorToTop = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    setCursorAndScroll(textarea, 0);
  };

  const moveCursorToBottom = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    setCursorAndScroll(textarea, textarea.value.length);
  };

  const handleNavPointerDown = (action: 'up' | 'down') => {
    isNavHoldRef.current = false;
    if (navHoldTimeoutRef.current) clearTimeout(navHoldTimeoutRef.current);
    navHoldTimeoutRef.current = setTimeout(() => {
      isNavHoldRef.current = true;
      if (action === 'up') moveCursorToTop();
      else moveCursorToBottom();
    }, 400);
  };

  const handleNavPointerUp = (action: 'up' | 'down') => {
    if (navHoldTimeoutRef.current) clearTimeout(navHoldTimeoutRef.current);
    if (!isNavHoldRef.current) {
      if (action === 'up') moveCursorUp();
      else moveCursorDown();
    }
    isNavHoldRef.current = false;
  };

  const handleNavPointerCancel = () => {
    if (navHoldTimeoutRef.current) clearTimeout(navHoldTimeoutRef.current);
    isNavHoldRef.current = false;
  };

  const moveCursorDown = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const val = textarea.value;
    const currentPos = textarea.selectionStart;
    const before = val.slice(0, currentPos);
    const currentLineStart = before.lastIndexOf('\n') + 1;
    const col = currentPos - currentLineStart;

    const nextNewline = val.indexOf('\n', currentPos);
    if (nextNewline !== -1) {
      const nextLineStart = nextNewline + 1;
      const followingNewline = val.indexOf('\n', nextLineStart);
      const nextLineLength = (followingNewline === -1 ? val.length : followingNewline) - nextLineStart;
      const targetPos = nextLineStart + Math.min(col, nextLineLength);
      setCursorAndScroll(textarea, targetPos);
    } else {
      setCursorAndScroll(textarea, val.length);
    }
  };

  const moveCursorToLineStart = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const val = textarea.value;
    const currentPos = textarea.selectionStart;
    const before = val.slice(0, currentPos);
    const lineStart = before.lastIndexOf('\n') + 1;
    setCursorAndScroll(textarea, lineStart);
  };

  const moveCursorToLineEnd = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const val = textarea.value;
    const currentPos = textarea.selectionEnd;
    const nextNewline = val.indexOf('\n', currentPos);
    const lineEnd = nextNewline === -1 ? val.length : nextNewline;
    setCursorAndScroll(textarea, lineEnd);
  };

  const insertTextAtCursor = (prefix: string, suffix: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = editText.substring(start, end);
    const replacement = prefix + selectedText + suffix;

    textarea.focus();
    textarea.setSelectionRange(start, end);

    if (!document.execCommand('insertText', false, replacement)) {
      const newValue = editText.substring(0, start) + replacement + editText.substring(end);
      setEditText(newValue);
      triggerSave(newValue);
    }

    setTimeout(() => {
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
      setCursorAndScroll(textarea, start + prefix.length);
    }, 0);
  };

  const handleBackspace = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    let start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start === end) {
      if (start === 0) return;
      start -= 1;
    }

    textarea.focus();
    textarea.setSelectionRange(start, end);
    if (!document.execCommand('delete', false)) {
      const newValue = editText.substring(0, start) + editText.substring(end);
      setEditText(newValue);
      triggerSave(newValue);
    }
    setTimeout(() => setCursorAndScroll(textarea, start), 0);
  };

  const handleDelete = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    let end = textarea.selectionEnd;

    if (start === end) {
      if (end === editText.length) return;
      end += 1;
    }

    textarea.focus();
    textarea.setSelectionRange(start, end);
    if (!document.execCommand('forwardDelete', false)) {
      const newValue = editText.substring(0, start) + editText.substring(end);
      setEditText(newValue);
      triggerSave(newValue);
    }
    setTimeout(() => setCursorAndScroll(textarea, start), 0);
  };

  const triggerSave = (newValue: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (activePreviewPath) {
        await updateNodeValue(activePreviewPath, newValue);
        setActivePreviewText(newValue, activePreviewPath);
      }
    }, 500);
  };

  return createPortal(
    <AnimatePresence>
      {(activePreviewText !== null && activePreviewText !== undefined) && (
        <div
          className={`fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm ${isFullscreen ? 'sm:p-0' : 'sm:p-4'}`}
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            // In markdown preview the chrome (header, outline, settings, footer) takes the theme's
            // palette: index.css remaps Tailwind's slate/indigo colour variables per data-md-chrome
            data-md-chrome={viewMode === 'markdown' ? mdTheme : undefined}
            // `layout` animates the size change when toggling full screen instead of snapping
            layout
            transition={{ layout: { duration: 0.28, ease: [0.32, 0.72, 0, 1] } }}
            className={`relative w-full h-[100dvh] sm:h-full max-h-none bg-slate-900 border-0 border-slate-800 shadow-2xl rounded-none flex flex-col overflow-hidden ${isFullscreen
              ? 'max-w-none'
              : 'max-w-6xl sm:max-h-[90vh] sm:border sm:rounded-xl'
              }`}
          >
            {/* Toggle Header Handle (Mobile) */}
            <button
              type="button"
              onClick={() => setShowHeader(!showHeader)}
              className="sm:hidden absolute top-0 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center w-14 h-3.5 bg-slate-900/95 hover:bg-slate-800 active:bg-slate-700 border border-slate-700/80 border-t-0 rounded-b-md shadow-md transition-all text-slate-400 hover:text-white group"
              title={showHeader ? "Collapse Header" : "Expand Header"}
            >
              <motion.div
                animate={{ rotate: showHeader ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-center text-slate-400 group-hover:text-indigo-400"
              >
                <ChevronDown size={12} strokeWidth={2.5} />
              </motion.div>
            </button>

            {/* Header */}
            <AnimatePresence initial={false}>
              {showHeader && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="shrink-0 relative z-10 overflow-hidden bg-slate-900 border-b border-slate-800"
                >
                  <div className="w-full px-3 pt-2.5 pb-2 sm:pl-3 sm:pr-2 sm:py-2">
                  <div className="flex flex-row items-center justify-between gap-2">
                    {/* File identity: name as the title, view mode underneath */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-9 h-9 flex items-center justify-center bg-indigo-500/10 text-indigo-400 rounded-xl shrink-0">
                        <Type size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h3 className="text-sm font-semibold text-white tracking-tight truncate" title={activePreviewPath || ''}>
                            {fileName}
                          </h3>
                          <span className="text-[9px] leading-none bg-slate-800 text-slate-400 px-1.5 py-1 rounded-md border border-slate-700 font-mono uppercase shrink-0">
                            {activePreviewPath?.split('.').pop()}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500 truncate">
                          {VIEW_MODE_LABELS[viewMode]}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                      {/* Desktop Light/Dark Toggle */}
                      {viewMode === 'markdown' && (
                        <button
                          onClick={() => setMdMode(mdMode === 'dark' ? 'light' : 'dark')}
                          disabled={!canToggleMdMode}
                          className="hidden sm:block p-1.5 rounded-md transition-all text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-slate-400 disabled:hover:bg-slate-800/50"
                          title={canToggleMdMode ? `Switch to ${mdMode === 'dark' ? 'light' : 'dark'} mode` : mdModeUnavailableHint}
                          aria-label="Toggle light or dark mode"
                        >
                          {mdMode === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                        </button>
                      )}
                      {/* Desktop Appearance Settings */}
                      {viewMode === 'markdown' && (
                        <button
                          onClick={() => setShowSettings(!showSettings)}
                          className="hidden sm:block p-1.5 rounded-md transition-all text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800"
                          title="Appearance Settings"
                        >
                          <Settings size={18} />
                        </button>
                      )}
                      {/* Desktop view switcher (icon-only); mobile gets a labelled row below */}
                      <div className="hidden sm:flex bg-slate-950 rounded-lg p-0.5 border border-slate-800 shrink-0">
                        {VIEW_MODES.map(([mode, , Icon, title]) => (
                          <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`p-1.5 rounded-md transition-all ${viewMode === mode ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                            title={title}
                          >
                            <Icon size={14} />
                          </button>
                        ))}
                      </div>

                      <div className="h-4 w-[1px] bg-slate-800 mx-1 hidden sm:block" />

                      <div className="flex items-center gap-1">
                        <button
                          onClick={handleCopy}
                          className="hidden sm:flex p-1.5 sm:px-2.5 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors border border-slate-700 items-center gap-2"
                        >
                          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                          <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
                        </button>

                        {/* Search Button (Desktop) */}
                        <button
                          onClick={() => {
                            setShowSearch(!showSearch);
                            if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 50);
                          }}
                          className={`hidden sm:flex p-1.5 rounded-lg text-xs font-medium transition-colors border items-center gap-2 ${showSearch ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/40' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'}`}
                          title="Search in document (Ctrl+F)"
                        >
                          <Search size={14} />
                        </button>

                        {/* Word Wrap Toggle (Desktop, raw view only) */}
                        {viewMode === 'raw' && (
                          <button
                            onClick={() => setWordWrap(!wordWrap)}
                            className={`hidden sm:flex p-1.5 rounded-lg text-xs font-medium transition-colors border items-center gap-2 ${wordWrap ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/40' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'}`}
                            title={wordWrap ? 'Disable Word Wrap' : 'Enable Word Wrap'}
                          >
                            <WrapText size={14} />
                          </button>
                        )}

                        {/* Download Button (Desktop) */}
                        <CustomSelect
                          value=""
                          placeholder=""
                          options={[
                            { label: 'Download as .md', value: 'md', icon: <FileText size={14} /> },
                            { label: 'Download as .txt', value: 'txt', icon: <FileText size={14} /> },
                            ...(viewMode === 'markdown' || viewMode === 'html' ? [{ label: 'Download as .html', value: 'html', icon: <Globe size={14} /> }] : []),
                          ]}
                          onChange={(val) => handleDownload(val as 'md' | 'html' | 'txt')}
                          icon={<Download size={14} />}
                          variant="toolbar"
                          className="hidden sm:block [&>button]:!p-1.5 [&>button]:w-8 [&>button]:h-8 [&>button]:!bg-slate-800 [&>button]:!border-slate-700 hover:[&>button]:!bg-slate-700 [&>button]:text-slate-300 [&_span.truncate]:hidden [&>button>svg:last-child]:hidden [&>button>div]:w-full [&>button>div]:justify-center"
                        />

                        {/* Full screen toggle (Desktop only) */}
                        <button
                          onClick={() => setIsFullscreen((f) => !f)}
                          className="hidden sm:flex p-1.5 rounded-lg transition-colors items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800"
                          title={isFullscreen ? 'Exit full screen' : 'Full screen'}
                          aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
                          aria-pressed={isFullscreen}
                        >
                          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>

                        {/* Mobile: open the actions sheet */}
                        <button
                          onClick={() => setShowMobileMenu(true)}
                          className={`sm:hidden w-9 h-9 flex items-center justify-center rounded-xl border transition-colors ${showMobileMenu ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-800/50 text-slate-300 border-slate-800 active:bg-slate-800'}`}
                          aria-haspopup="menu"
                          aria-expanded={showMobileMenu}
                          aria-label="More actions"
                        >
                          <MoreVertical size={18} />
                        </button>

                        <button
                          onClick={() => setActivePreviewText(null)}
                          className="w-9 h-9 sm:w-auto sm:h-auto sm:p-1.5 flex items-center justify-center hover:bg-slate-800 active:bg-slate-800 text-slate-400 hover:text-white rounded-xl sm:rounded-lg transition-colors"
                          aria-label="Close preview"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Mobile view switcher: full-width, labelled, thumb-sized */}
                  <div className="sm:hidden mt-2.5 grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800">
                    {VIEW_MODES.map(([mode, label, Icon, title]) => (
                      <button
                        key={mode}
                        onClick={() => setViewMode(mode)}
                        className={`h-8 flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === mode ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 active:text-slate-300'}`}
                        title={title}
                        aria-pressed={viewMode === mode}
                      >
                        <Icon size={14} />
                        {label}
                      </button>
                    ))}
                  </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mobile Actions Sheet (inside the popup so it follows the theme chrome) */}
            <AnimatePresence>
              {showMobileMenu && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="sm:hidden absolute inset-0 z-[60] bg-black/40 backdrop-blur-[2px]"
                    onClick={() => setShowMobileMenu(false)}
                  />
                  <motion.div
                    role="menu"
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 32, stiffness: 340 }}
                    drag="y"
                    dragConstraints={{ top: 0, bottom: 0 }}
                    dragElastic={{ top: 0, bottom: 0.6 }}
                    onDragEnd={(_, info) => {
                      if (info.offset.y > 80 || info.velocity.y > 500) setShowMobileMenu(false);
                    }}
                    className="sm:hidden absolute inset-x-0 bottom-0 z-[61] bg-slate-900 border-t border-slate-800 rounded-t-2xl shadow-2xl pb-[max(env(safe-area-inset-bottom),12px)]"
                  >
                    <div className="flex justify-center pt-2.5 pb-1">
                      <span className="w-10 h-1 rounded-full bg-slate-700" />
                    </div>
                    <div className="flex items-center justify-between gap-3 px-4 pb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{fileName}</p>
                        <p className="text-[11px] text-slate-500">{VIEW_MODE_LABELS[viewMode]}</p>
                      </div>
                      <button
                        onClick={() => setShowMobileMenu(false)}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 active:text-white shrink-0"
                        aria-label="Close menu"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="max-h-[60dvh] overflow-y-auto custom-scrollbar px-3 pb-1">
                      {(() => {
                        type SheetItem = {
                          key: string;
                          label: string;
                          icon: React.ReactNode;
                          onSelect: () => void;
                          hint?: string;
                          disabled?: boolean;
                          toggle?: boolean;
                          closeOnSelect?: boolean;
                          trailing?: React.ReactNode;
                        };
                        const closeThen = (fn: () => void) => () => { fn(); setShowMobileMenu(false); };
                        const sections: { title: string; items: SheetItem[] }[] = [
                          {
                            title: 'View',
                            items: viewMode === 'markdown' ? [
                              ...(headings.length > 0 ? [{ key: 'outline', label: 'Outline', icon: <Menu size={16} />, onSelect: closeThen(() => setShowOutline(true)) }] : []),
                              { key: 'appearance', label: 'Appearance', hint: `${mdFamily.name} theme`, icon: <Settings size={16} />, onSelect: closeThen(() => setShowSettings(true)) },
                              {
                                key: 'mode',
                                label: 'Dark mode',
                                hint: canToggleMdMode ? undefined : mdModeUnavailableHint,
                                icon: mdMode === 'dark' ? <Moon size={16} /> : <Sun size={16} />,
                                disabled: !canToggleMdMode,
                                toggle: mdMode === 'dark',
                                onSelect: () => setMdMode(mdMode === 'dark' ? 'light' : 'dark'),
                              },
                            ] : [],
                          },
                          {
                            title: 'Document',
                            items: [
                              {
                                key: 'copy',
                                label: copied ? 'Copied to clipboard' : 'Copy content',
                                icon: copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />,
                                onSelect: handleCopy,
                              },
                              {
                                key: 'search',
                                label: 'Search in document',
                                icon: <Search size={16} />,
                                onSelect: closeThen(() => { setShowSearch(true); setTimeout(() => searchInputRef.current?.focus(), 50); }),
                              },
                              ...(viewMode === 'raw' ? [{ key: 'wrap', label: 'Word wrap', icon: <WrapText size={16} />, toggle: wordWrap, onSelect: () => setWordWrap(!wordWrap) }] : []),
                            ],
                          },
                          {
                            title: 'Download',
                            items: [
                              { key: 'md', label: 'Markdown', hint: '.md', icon: <Download size={16} />, onSelect: closeThen(() => handleDownload('md')) },
                              { key: 'txt', label: 'Plain text', hint: '.txt', icon: <FileText size={16} />, onSelect: closeThen(() => handleDownload('txt')) },
                              ...(viewMode === 'markdown' || viewMode === 'html'
                                ? [{ key: 'html', label: 'HTML page', hint: '.html', icon: <Globe size={16} />, onSelect: closeThen(() => handleDownload('html')) }]
                                : []),
                            ],
                          },
                        ];

                        return sections.filter((s) => s.items.length > 0).map((section) => (
                          <div key={section.title} className="py-1.5">
                            <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{section.title}</p>
                            <div className="rounded-xl bg-slate-950/60 border border-slate-800 overflow-hidden divide-y divide-slate-800">
                              {section.items.map((item) => (
                                <button
                                  key={item.key}
                                  role={item.toggle === undefined ? 'menuitem' : 'menuitemcheckbox'}
                                  aria-checked={item.toggle}
                                  disabled={item.disabled}
                                  onClick={item.onSelect}
                                  className="w-full min-h-11 flex items-center gap-3 px-3 py-2 text-left active:bg-slate-800 disabled:opacity-50 transition-colors"
                                >
                                  <span className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center shrink-0">
                                    {item.icon}
                                  </span>
                                  <span className="flex-1 min-w-0">
                                    <span className="block text-sm text-slate-200 truncate">{item.label}</span>
                                    {item.hint && <span className="block text-[11px] text-slate-500 truncate">{item.hint}</span>}
                                  </span>
                                  {item.toggle !== undefined && (
                                    <span className={`w-10 h-6 p-0.5 rounded-full shrink-0 transition-colors ${item.toggle ? 'bg-indigo-500' : 'bg-slate-700'}`}>
                                      <span className={`block w-5 h-5 rounded-full bg-[#fff] shadow transition-transform ${item.toggle ? 'translate-x-4' : ''}`} />
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* Search Bar */}
            <AnimatePresence>
              {showSearch && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="shrink-0 overflow-hidden bg-slate-900 border-b border-slate-800"
                >
                  <div className="flex items-center gap-2 px-3 py-2">
                    <Search size={14} className="text-slate-500 shrink-0" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                          if (e.shiftKey) prevSearchMatch();
                          else nextSearchMatch();
                        }
                        if (e.key === 'Escape') {
                          setShowSearch(false);
                          setSearchQuery('');
                          clearSearchHighlights();
                        }
                      }}
                      onKeyUp={(e) => e.stopPropagation()}
                      placeholder="Search in document..."
                      className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none min-w-0"
                      autoFocus
                    />
                    {searchQuery && (
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">
                        {searchMatchCount > 0 ? `${currentSearchMatch}/${searchMatchCount}` : 'No results'}
                      </span>
                    )}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={prevSearchMatch}
                        className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                        title="Previous match (Shift+Enter)"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        onClick={nextSearchMatch}
                        className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                        title="Next match (Enter)"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        setShowSearch(false);
                        setSearchQuery('');
                        clearSearchHighlights();
                      }}
                      className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors shrink-0"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Content Area with optional Sidebar */}
            <div
              className="flex-1 overflow-hidden flex flex-row bg-slate-950 relative min-w-0 w-full"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >

              {/* Document Outline Sidebar (Desktop) / Drawer (Mobile) */}
              <AnimatePresence>
                {(viewMode === 'markdown' && headings.length > 0) && (
                  <>
                    {/* Mobile Backdrop */}
                    {showOutline && (
                      <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/50 z-20 sm:hidden"
                        onClick={() => setShowOutline(false)}
                      />
                    )}
                    {/* Sidebar */}
                    <div
                      className={`absolute sm:relative z-30 ${outlineFullScreen ? 'w-full' : 'w-64'} sm:w-64 h-full bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300 ease-out sm:translate-x-0 ${showOutline ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}
                    >
                      <div className="p-3 border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                          <ListOrdered size={14} /> Outline
                        </h4>
                        <div className="flex items-center gap-1 sm:hidden">
                          <button
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                            onClick={() => setOutlineFullScreen(!outlineFullScreen)}
                            title={outlineFullScreen ? "Collapse Width" : "Expand to Full Width"}
                          >
                            {outlineFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                          </button>
                          <button
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors"
                            onClick={() => setShowOutline(false)}
                            title="Close Outline"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                      <div ref={outlineRef} className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                        {headings.map((h, i) => {
                          const isActive = activeHeadingId === h.id || activeHeadingId.startsWith(h.id);
                          return (
                            <a
                              key={i}
                              data-outline-id={h.id}
                              href={`#${h.id}`}
                              onClick={(e) => {
                                e.preventDefault();
                                handleHeadingClick(h.id);
                                if (window.innerWidth < 640) setShowOutline(false);
                              }}
                              className={`block py-1.5 px-2 rounded-md text-sm truncate transition-colors ${isActive ? 'bg-indigo-500/10 text-indigo-400 font-medium' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                                }`}
                              style={{ paddingLeft: `${(h.level - 1) * 12 + 8}px` }}
                              title={h.text}
                            >
                              {h.text}
                            </a>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
              </AnimatePresence>

              {/* Settings Sidebar (Right Drawer) */}
              <AnimatePresence>
                {showSettings && (
                  <>
                    {/* Light scrim: the drawer tweaks the document, it shouldn't black it out */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="absolute inset-0 z-40 bg-black/40 sm:bg-black/15"
                      onClick={() => setShowSettings(false)}
                    />
                    {/* Slides its own width with an eased tween (no spring overshoot, no fade) */}
                    <motion.div
                      role="dialog"
                      aria-label="Appearance settings"
                      initial={{ x: '100%' }}
                      animate={{ x: 0 }}
                      exit={{ x: '100%' }}
                      transition={{ type: 'tween', duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                      className="absolute right-0 top-0 bottom-0 z-50 w-[85%] max-w-xs sm:w-72 bg-slate-900 border-l border-slate-800 flex flex-col shadow-[-16px_0_40px_-16px_rgba(0,0,0,0.5)] will-change-transform"
                    >
                      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-900 shrink-0">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                            <Settings size={16} />
                          </span>
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-white leading-tight">Appearance</h4>
                            <p className="text-[11px] text-slate-500 truncate">{mdFamily.name} · {mdMode} mode</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowSettings(false)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
                          aria-label="Close appearance settings"
                          title="Close (Esc)"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <div className="p-4 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
                        <div className="flex flex-col gap-2.5">
                          <label className="text-xs text-slate-400 font-medium">Font Family</label>
                          <CustomSelect
                            value={mdFont}
                            onChange={(val) => setMdFont(val)}
                            searchable={true}
                            options={[
                              { label: "System Font", value: "System Default" },
                              ...FONTS.map(f => ({ label: f.fontFamily, value: f.fontFamily }))
                            ]}
                            className="w-full [&>button]:w-full [&>button]:py-2 [&>button]:px-3 [&>button]:bg-slate-950 [&>button]:border-slate-800 [&>button]:text-slate-200 [&>button]:text-sm"
                          />
                        </div>

                        <div className="flex flex-col gap-2.5">
                          <label className="text-xs text-slate-400 font-medium">Theme</label>
                          <CustomSelect
                            value={mdFamily.name}
                            onChange={selectMdThemeFamily}
                            options={MD_THEME_FAMILIES.map((f) => ({ label: f.name, value: f.name }))}
                            className="w-full [&>button]:w-full [&>button]:py-2 [&>button]:px-3 [&>button]:bg-slate-950 [&>button]:border-slate-800 [&>button]:text-slate-200 [&>button]:text-sm"
                          />
                        </div>

                        <div className="flex flex-col gap-2.5">
                          <label className="text-xs text-slate-400 font-medium">Mode</label>
                          <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-950 border border-slate-800">
                            {(['light', 'dark'] as const).map((mode) => {
                              const available = Boolean(mdFamily[mode]);
                              const active = mdMode === mode;
                              return (
                                <button
                                  key={mode}
                                  onClick={() => setMdMode(mode)}
                                  disabled={!available}
                                  title={available ? undefined : mdModeUnavailableHint}
                                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium capitalize transition-all disabled:opacity-35 disabled:cursor-not-allowed ${active ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 disabled:hover:text-slate-400'}`}
                                >
                                  {mode === 'light' ? <Sun size={13} /> : <Moon size={13} />}
                                  {mode}
                                </button>
                              );
                            })}
                          </div>
                          {!canToggleMdMode && (
                            <p className="text-[11px] text-slate-500 leading-snug">{mdModeUnavailableHint}.</p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

              {/* Main Content Pane */}
              {viewMode === 'edit' ? (
                <div className="flex-1 p-3 sm:p-4 flex flex-col gap-2.5 relative bg-slate-950 min-w-0 max-w-full w-full overflow-hidden">
                  {/* Heading Level Selector Bar (Shows on hold or tap ▾) */}
                  <AnimatePresence>
                    {showHeadingMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -6, height: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden bg-slate-900 border border-indigo-500/40 rounded-lg p-1 sm:p-1.5 flex items-center justify-between gap-1 shadow-xl shrink-0"
                      >
                        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar py-0.5">
                          <span className="text-[11px] font-mono uppercase text-indigo-400 font-bold px-1.5 shrink-0">Heading:</span>
                          {[1, 2, 3, 4, 5, 6].map((lvl) => (
                            <button
                              key={lvl}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => selectHeadingLevel(lvl)}
                              className="px-2.5 py-1 text-xs font-bold font-mono text-slate-300 hover:text-white bg-slate-800 hover:bg-indigo-600 rounded border border-slate-700/60 hover:border-indigo-500 transition-all flex items-center gap-1 shrink-0 active:scale-95"
                              title={`Heading ${lvl} (${'#'.repeat(lvl)} )`}
                            >
                              <span className="text-indigo-300 font-bold">H{lvl}</span>
                              <span className="text-[9px] text-slate-400 font-mono opacity-80">{'#'.repeat(lvl)}</span>
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowHeadingMenu(false)}
                          className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 shrink-0 ml-1"
                          title="Close"
                        >
                          <X size={14} />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Formatting & Navigation Toolbar */}
                  <div
                    ref={toolbarRef}
                    className="w-full max-w-full min-w-0 flex flex-wrap items-center gap-1 sm:gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg shrink-0 shadow-sm"
                  >
                    {/* Group 1: Utilities & Formatting */}
                    <div className="flex items-center gap-0.5 shrink-0 bg-slate-950/60 p-0.5 rounded-md border border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => setKeyboardLocked(!keyboardLocked)}
                        className={`p-1.5 rounded transition-colors shrink-0 flex items-center gap-1.5 ${keyboardLocked
                          ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700 border border-transparent'
                          }`}
                        title={keyboardLocked ? "Unlock Native Keyboard" : "Lock Native Keyboard (Use UI Only)"}
                      >
                        <Keyboard size={15} />
                      </button>
                      <div className="w-px h-3.5 bg-slate-800/80 mx-0.5 shrink-0" />
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleUndo}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700 rounded transition-colors shrink-0"
                        title="Undo (Ctrl+Z)"
                      >
                        <Undo size={15} />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleRedo}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700 rounded transition-colors shrink-0"
                        title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
                      >
                        <Redo size={15} />
                      </button>
                      <div className="w-px h-3.5 bg-slate-800/80 mx-0.5 shrink-0" />
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handlePasteClipboard()}
                        className={`p-1.5 rounded transition-all flex items-center gap-1.5 shrink-0 ${pasted
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700'
                          }`}
                        title="Paste from clipboard"
                      >
                        {pasted ? <Check size={15} className="text-emerald-400" /> : <ClipboardPaste size={15} />}
                        <span className="text-[11px] font-medium hidden md:inline">{pasted ? 'Pasted!' : 'Paste'}</span>
                      </button>
                      <div className="w-px h-3.5 bg-slate-800/80 mx-0.5 shrink-0" />
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertTextAtCursor('**', '**')}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700 rounded transition-colors shrink-0"
                        title="Bold (**text**)"
                      >
                        <Bold size={15} />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertTextAtCursor('*', '*')}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700 rounded transition-colors shrink-0"
                        title="Italic (*text*)"
                      >
                        <Italic size={15} />
                      </button>
                      <div className="w-px h-3.5 bg-slate-800/80 mx-0.5 shrink-0" />
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertTextAtCursor('[](', ')')}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700 rounded transition-colors shrink-0"
                        title="Insert Link [text](url)"
                      >
                        <LinkIcon size={15} />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertTextAtCursor('`', '`')}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700 rounded transition-colors shrink-0"
                        title="Inline Code (`code`)"
                      >
                        <Code size={15} />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertTextAtCursor('```\n', '\n```')}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700 rounded transition-colors shrink-0"
                        title="Code Block (```)"
                      >
                        <div className="flex flex-col gap-0.5 items-center justify-center h-3.5 w-3.5"><Code size={10} /><Code size={10} /></div>
                      </button>
                    </div>

                    {/* Group 2B: Extra Nav */}
                    <div className="flex items-center gap-0.5 shrink-0 bg-slate-950/60 p-0.5 rounded-md border border-slate-800/80">
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => moveCursorToLineStart()}
                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 active:bg-slate-700 rounded transition-colors shrink-0"
                        title="Start of Line (Home)"
                      >
                        <ArrowLeftToLine size={15} />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => moveCursorToLineEnd()}
                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 active:bg-slate-700 rounded transition-colors shrink-0"
                        title="End of Line (End)"
                      >
                        <ArrowRightToLine size={15} />
                      </button>
                    </div>

                    {/* Group 4: Typing Actions */}
                    <div className="flex items-center gap-0.5 shrink-0 bg-slate-950/60 p-0.5 rounded-md border border-slate-800/80">
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleBackspace}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 active:bg-slate-700 rounded transition-colors shrink-0"
                        title="Backspace"
                      >
                        <Delete size={15} />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleDelete}
                        className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-red-400 hover:bg-slate-800 active:bg-slate-700 rounded transition-colors shrink-0"
                        title="Delete"
                      >
                        DEL
                      </button>
                      <div className="w-px h-3 bg-slate-800/80 mx-0.5 shrink-0" />
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertTextAtCursor('  ')}
                        className="px-2 py-1 text-xs font-medium text-slate-400 hover:text-indigo-400 hover:bg-slate-800 active:bg-slate-700 rounded transition-colors shrink-0"
                        title="Tab"
                      >
                        Tab
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertTextAtCursor('\n')}
                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 active:bg-slate-700 rounded transition-colors shrink-0"
                        title="Enter"
                      >
                        <CornerDownLeft size={14} />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertTextAtCursor(' ')}
                        className="px-4 py-1 text-[10px] uppercase font-bold tracking-widest text-slate-400 hover:text-indigo-400 hover:bg-slate-800 active:bg-slate-700 rounded transition-colors shrink-0"
                        title="Space"
                      >
                        Space
                      </button>
                      <div className="w-px h-3 bg-slate-800/80 mx-0.5 shrink-0" />
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertTextAtCursor('<kbd>', '</kbd>')}
                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 active:bg-slate-700 rounded transition-colors shrink-0 flex items-center gap-1"
                        title="Insert Chip/Label (<kbd>)"
                      >
                        <Tag size={14} />
                      </button>
                    </div>

                    {/* Group 2: Blocks & Extra Nav */}
                    <div className="flex items-center gap-0.5 shrink-0 bg-slate-950/60 p-0.5 rounded-md border border-slate-800/80">
                      <div className="flex items-center rounded transition-colors bg-slate-900 border border-slate-700/60 shrink-0 overflow-hidden">
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            startHeadingPress();
                          }}
                          onMouseUp={endHeadingPress}
                          onTouchStart={startHeadingPress}
                          onTouchEnd={endHeadingPress}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setShowHeadingMenu(prev => !prev);
                          }}
                          onClick={() => {
                            if (isLongPressRef.current) {
                              isLongPressRef.current = false;
                              return;
                            }
                            insertTextAtCursor('# ', '');
                          }}
                          className={`p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700 transition-colors flex items-center justify-center ${showHeadingMenu ? 'bg-indigo-600/30 text-indigo-300' : ''
                            }`}
                          title="Insert H1 (# ) - Hold for H1-H6"
                        >
                          <Hash size={15} />
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setShowHeadingMenu(prev => !prev)}
                          className={`py-1.5 px-1 text-slate-400 hover:text-white hover:bg-slate-800 border-l border-slate-700/60 transition-colors flex items-center justify-center ${showHeadingMenu ? 'bg-indigo-600/30 text-indigo-300' : ''
                            }`}
                          title="Choose Heading Level (H1-H6)"
                        >
                          <ChevronDown size={11} className={`transition-transform duration-150 ${showHeadingMenu ? 'rotate-180 text-indigo-400' : ''}`} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertTextAtCursor('- ', '')}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700 rounded transition-colors shrink-0"
                        title="Bullet List (- )"
                      >
                        <List size={15} />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertTextAtCursor('1. ', '')}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700 rounded transition-colors shrink-0"
                        title="Numbered List (1. )"
                      >
                        <ListOrdered size={15} />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertTextAtCursor('- [ ] ', '')}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700 rounded transition-colors shrink-0"
                        title="Task Checkbox (- [ ] )"
                      >
                        <ListTodo size={15} />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertTextAtCursor('> ', '')}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700 rounded transition-colors shrink-0"
                        title="Blockquote (> )"
                      >
                        <Quote size={15} />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertTextAtCursor('\n---\n\n', '')}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700 rounded transition-colors shrink-0"
                        title="Divider (---)"
                      >
                        <Minus size={15} />
                      </button>
                      <div className="w-px h-3.5 bg-slate-800/80 mx-0.5 shrink-0" />
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => moveCursorLeft()}
                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 active:bg-slate-700 rounded transition-colors shrink-0"
                        title="Move Left (←)"
                      >
                        <ArrowLeft size={15} />
                      </button>
                      <button
                        type="button"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          handleNavPointerDown('up');
                        }}
                        onPointerUp={(e) => {
                          e.preventDefault();
                          handleNavPointerUp('up');
                        }}
                        onPointerLeave={handleNavPointerCancel}
                        onPointerCancel={handleNavPointerCancel}
                        onContextMenu={(e) => e.preventDefault()}
                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 active:bg-slate-700 rounded transition-colors shrink-0"
                        title="Move Up (↑) / Hold for Top"
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        type="button"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          handleNavPointerDown('down');
                        }}
                        onPointerUp={(e) => {
                          e.preventDefault();
                          handleNavPointerUp('down');
                        }}
                        onPointerLeave={handleNavPointerCancel}
                        onPointerCancel={handleNavPointerCancel}
                        onContextMenu={(e) => e.preventDefault()}
                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 active:bg-slate-700 rounded transition-colors shrink-0"
                        title="Move Down (↓) / Hold for Bottom"
                      >
                        <ArrowDown size={15} />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => moveCursorRight()}
                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 active:bg-slate-700 rounded transition-colors shrink-0"
                        title="Move Right (→)"
                      >
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  </div>
                  <textarea
                    ref={textareaRef}
                    autoFocus
                    inputMode={keyboardLocked ? "none" : "text"}
                    value={editText}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setEditText(newValue);
                      triggerSave(newValue);
                    }}
                    className="flex-1 bg-slate-900/50 text-slate-200 font-mono text-sm leading-relaxed outline-none resize-none p-4 border border-slate-800 rounded-lg focus:border-indigo-500/30 transition-colors custom-scrollbar"
                    placeholder="Enter content here..."
                  />
                  <div className="flex justify-end items-center gap-3">
                    <span className="text-slate-500 text-xs italic flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/50 animate-pulse"></div>
                      Auto-saving on type...
                    </span>
                    <button
                      onClick={() => setViewMode('markdown')}
                      className="flex items-center gap-2 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95"
                    >
                      <Check size={14} />
                      Preview
                    </button>
                  </div>
                </div>
              ) : viewMode === 'markdown' ? (
                <div ref={contentRef} className={`${getThemeClasses(mdTheme).container} md-content`}>
                  {GITHUB_THEMES.includes(mdTheme) && (
                    <div className={`gh-readme-header ${mdTheme === 'github-dark' ? 'gh-dark' : 'gh-light'}`}>
                      <BookOpen size={16} />
                      <span className="truncate">{activePreviewPath?.split(/[/\\]/).pop() || 'README'}</span>
                      <span className="gh-readme-meta">
                        {editText.split('\n').length} lines · {(new Blob([editText]).size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  )}
                  <div
                    ref={proseRef}
                    className={getThemeClasses(mdTheme).prose}
                    style={mdFont !== 'System Default' ? { fontFamily: `'${mdFont}', sans-serif` } : undefined}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeRaw, rehypeKatex, customRehypeSlug, rehypeGithubAlerts]}
                      components={markdownComponents}
                    >
                      {editText}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : viewMode === 'html' ? (
                <div className="flex-1 p-2 bg-slate-950 overflow-hidden flex flex-col">
                  <iframe
                    srcDoc={editText}
                    sandbox="allow-scripts allow-popups"
                    className="w-full flex-1 rounded-lg bg-white border-0 shadow-inner"
                    title="HTML Preview"
                  />
                </div>
              ) : (
                <div ref={contentRef} className="flex-1 overflow-auto bg-slate-950 custom-scrollbar">
                  <pre className={`p-4 sm:p-6 font-mono text-sm text-slate-300 leading-relaxed min-h-full selection:bg-indigo-500/30 ${wordWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'}`}>
                    {editText}
                  </pre>
                </div>
              )}

              {/* Floating Action Buttons when Header is Hidden */}
              <AnimatePresence>
                {!showHeader && viewMode !== 'edit' && (
                  <>
                    <motion.button
                      initial={{ opacity: 0, scale: 0.85, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.85, y: 10 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => setViewMode('edit')}
                      className="absolute bottom-4 right-4 z-40 flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-[var(--md-on-accent,#fff)] rounded-full shadow-xl shadow-indigo-950/60 border border-indigo-400/40 text-xs font-semibold backdrop-blur transition-all active:scale-95"
                      title="Switch to Editor"
                    >
                      <Edit3 size={14} />
                      <span>Edit</span>
                    </motion.button>
                    <motion.button
                      initial={{ opacity: 0, scale: 0.85, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.85, y: -10 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => setActivePreviewText(null)}
                      className="absolute top-4 right-4 z-40 flex items-center justify-center p-2 bg-slate-800/80 hover:bg-slate-700 active:bg-slate-900 text-slate-300 hover:text-white rounded-full shadow-xl shadow-indigo-950/60 border border-slate-700/80 backdrop-blur transition-all active:scale-95 opacity-50 hover:opacity-100"
                      title="Close Preview"
                    >
                      <X size={16} />
                    </motion.button>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Bottom Bar */}
            <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 text-[9px] text-slate-600 font-mono flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="text-slate-400 font-bold">{editText.length}</span>
                  <span>CHARS</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-slate-400 font-bold">{editText.split(/\s+/).filter(Boolean).length}</span>
                  <span>WORDS</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                {viewMode === 'edit' ? (
                  <div className="flex items-center gap-1.5 text-indigo-400">
                    <div className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse"></div>
                    EDITING
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-slate-500 uppercase tracking-widest">
                    <div className="w-1 h-1 rounded-full bg-emerald-500/50"></div>
                    {viewMode === 'markdown' ? 'Markdown' : (viewMode === 'html' ? 'HTML' : 'Read Only')}
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Backdrop Click */}
          <div
            className="absolute inset-0 -z-10"
            onClick={() => {
              if (viewMode !== 'edit' || editText === activePreviewText) {
                setActivePreviewText(null);
              }
            }}
          />
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default memo(TextPreviewPopup);
