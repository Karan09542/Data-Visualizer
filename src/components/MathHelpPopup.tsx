import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, HelpCircle, Variable, Zap, Waves, Search, Copy, Check, Plus, BookOpen,
  LineChart, Binary, Play, Move, Layers, Compass, Sparkles, Info, ChevronRight, CheckSquare
} from 'lucide-react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useStore } from '../store/useStore';

interface MathHelpPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertFormula?: (formula: {
    type: "function" | "parametric" | "point" | "implicit" | "polar" | "vector" | "polygon" | "inequality" | "line";
    expr: string;
    expr2?: string;
    name?: string;
  }) => void;
}

interface DocArticle {
  title: string;
  keywords: string[];
  content: React.ReactNode;
}

const MathHelpPopup: React.FC<MathHelpPopupProps> = ({ isOpen, onClose, onInsertFormula }) => {
  const appTheme = useStore((state) => state.appTheme);
  const isDark = appTheme === 'dark';
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('getting-started');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [insertedId, setInsertedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInsert = (formula: {
    type: "function" | "parametric" | "point" | "implicit" | "polar" | "vector" | "polygon" | "inequality" | "line";
    expr: string;
    expr2?: string;
    name?: string;
  }, id: string) => {
    if (onInsertFormula) {
      onInsertFormula(formula);
      setInsertedId(id);
      setTimeout(() => setInsertedId(null), 2000);
    }
  };

  // Safe KaTeX renderer helper
  const renderLatex = (latex: string) => {
    try {
      return (
        <span
          dangerouslySetInnerHTML={{
            __html: katex.renderToString(latex, {
              throwOnError: false,
              displayMode: false,
            }),
          }}
        />
      );
    } catch (e) {
      return <span className="font-mono text-xs text-rose-500">{latex}</span>;
    }
  };

  const docSections = [
    { id: 'getting-started', title: 'Getting Started', icon: HelpCircle, badge: 'Basics' },
    { id: 'function-types', title: 'Function Types', icon: LineChart, badge: '10 Types' },
    { id: 'latex-guide', title: 'LaTeX Guide', icon: BookOpen, badge: 'Formula' },
    { id: 'mathjs-guide', title: 'MathJS Reference', icon: Binary, badge: 'Engine' },
    { id: 'variables', title: 'Variables & Sliders', icon: Variable, badge: 'Dynamic' },
    { id: 'animation', title: 'Animation & Timeline', icon: Play, badge: 'Motion' },
    { id: 'transformations', title: 'Transformations', icon: Move, badge: 'Gizmos' },
    { id: 'inequalities', title: 'Inequalities', icon: Layers, badge: 'Shading' },
    { id: 'polar-parametric', title: 'Polar & Parametric', icon: Compass, badge: 'Curves' },
    { id: 'advanced-gallery', title: 'Advanced Gallery', icon: Sparkles, badge: 'Ready' },
  ];

  // Raw search indices to scan
  const searchIndex = useMemo(() => {
    return [
      {
        section: 'getting-started',
        title: 'What is Math Graph Studio?',
        keywords: ['getting started', 'canvas', 'node', 'algebra', 'graph', 'evaluation', 'coordinate', 'introduction'],
        snippet: 'An advanced graphing canvas to plot coordinates, explicit, polar, parametric, and implicit curves.',
      },
      {
        section: 'getting-started',
        title: 'Continuous Evaluation Loop',
        keywords: ['loop', 'render', 'evaluation', 'fps', 'real-time', 'mafs'],
        snippet: 'Plots vectors and math shapes with ultra-crisp precision on resize-friendly canvas elements.',
      },
      {
        section: 'function-types',
        title: 'Cartesian Functions (Explicit)',
        keywords: ['explicit', 'cartesian', 'function', 'sine', 'wave', 'y='],
        snippet: 'y = f(x) standard functions mapping inputs along the coordinate grid.',
      },
      {
        section: 'function-types',
        title: 'Implicit Functions & Relations',
        keywords: ['implicit', 'circle', 'relation', 'ellipse', 'hyperbola', 'matrix', 'xy='],
        snippet: 'Plot custom planar curves and algebraic structures matching f(x, y) = 0.',
      },
      {
        section: 'function-types',
        title: 'Polar Curves',
        keywords: ['polar', 'angle', 'theta', 'spiral', 'rose', 'r='],
        snippet: 'r = f(theta) curves describing distance from the origin at any angle sweep.',
      },
      {
        section: 'latex-guide',
        title: 'LaTeX Math Formulas',
        keywords: ['latex', 'katex', 'fraction', 'sqrt', 'power', 'sum', 'integral', 'greek', 'symbol'],
        snippet: 'Complete LaTeX catalog displaying input parameters, dynamic math rendering, and copy codes.',
      },
      {
        section: 'mathjs-guide',
        title: 'MathJS Scientific Engine',
        keywords: ['mathjs', 'trig', 'sine', 'cos', 'log', 'abs', 'determinant', 'matrix', 'matrix math'],
        snippet: 'Rich operations including det(M) matrices, nested operations, arrays, and piecewise helpers.',
      },
      {
        section: 'variables',
        title: 'Dynamic Variable Sliders',
        keywords: ['variable', 'slider', 'custom', 'rig', 'dependency', 'constant', 'time', 't'],
        snippet: 'Type a custom parameter like a, k, or freq to instantly generate user-controlled sliders.',
      },
      {
        section: 'animation',
        title: 'Animate and Timeline Controls',
        keywords: ['animation', 'timeline', 'play', 'speed', 'time', 't', 'orbit', 'frequency'],
        snippet: 'Animate graphs with variable t linking your mathematical loops directly to elapsed time.',
      },
      {
        section: 'transformations',
        title: 'Geometric Transformations',
        keywords: ['transformation', 'rotate', 'scale', 'translate', 'pivot', 'draggable', 'gizmo'],
        snippet: 'Rotate, shift, or stretch elements on-the-fly with interactive viewport drag gizmos.',
      },
      {
        section: 'inequalities',
        title: 'Inequality Regions & Shading',
        keywords: ['inequality', 'shade', 'less', 'greater', 'bounds', 'region', 'domain'],
        snippet: 'Shade custom feasibility regions using standard comparative bounds (<, <=, >, >=).',
      },
      {
        section: 'polar-parametric',
        title: 'Parametric Curve Parameter',
        keywords: ['parametric', 'curve', 'coordinate', 'time', 't', 'path', 'orbit'],
        snippet: 'Define continuous coordinates as an array [x(t), y(t)] using parameter t.',
      },
      {
        section: 'advanced-gallery',
        title: 'Advanced Gallery Presets',
        keywords: ['heart', 'butterfly', 'spiral', 'fractal', 'lissajous', 'fourier', 'wave interference', 'rose'],
        snippet: 'A curated sandbox of stunning pre-made curves to copy and insert into your node immediately.',
      },
    ];
  }, []);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return searchIndex.filter(item => 
      item.title.toLowerCase().includes(query) ||
      item.snippet.toLowerCase().includes(query) ||
      item.keywords.some(kw => kw.toLowerCase().includes(query))
    );
  }, [searchQuery, searchIndex]);

  const popupContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-0 md:p-6" id="math-help-portal">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
            onClick={onClose}
            id="math-help-backdrop"
          />

          {/* Help Center Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 15 }}
            className="relative w-full max-w-6xl h-[100dvh] md:h-[85vh] bg-white dark:bg-[#0b0f19] border-0 md:border border-slate-200 dark:border-slate-800 rounded-none md:rounded-2xl shadow-2xl flex flex-col overflow-hidden font-sans nodrag select-text"
            id="math-help-dialog"
          >
            {/* Header with Search and Close */}
            <div className="flex flex-col md:flex-row md:items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/60 gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Sparkles size={22} className="animate-pulse" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    Math Studio Help Center
                    <span className="text-[10px] bg-indigo-500/10 text-indigo-500 font-bold uppercase px-2 py-0.5 rounded-full">v2.0 PRO</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Interactive Formula Guide, LaTeX Notation Reference, and Preset Gallery</p>
                </div>
              </div>

              {/* Instant Search Bar */}
              <div className="flex items-center gap-3 flex-1 max-w-md">
                <div className="relative w-full">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search terms (e.g., matrix, polar, sin)..."
                    className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-500/30 focus:border-indigo-500 dark:focus:border-indigo-500 transition-all font-medium"
                    id="doc-search-input"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition-all text-xs"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl transition-all shrink-0 border border-transparent hover:border-slate-200 dark:hover:border-slate-800"
                  id="doc-close-btn"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Main Workspace Frame */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              
              {/* Sidebar Navigation */}
              <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-250 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 flex flex-col shrink-0">
                <div className="p-3 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider hidden md:block">
                  Documentation Guide
                </div>
                <div className="flex md:flex-col overflow-x-auto md:overflow-y-auto px-2 pb-2 md:pb-4 gap-1.5 md:space-y-1 no-scrollbar pt-2 md:pt-0">
                  {docSections.map((section) => {
                    const Icon = section.icon;
                    const isActive = activeTab === section.id && !searchQuery;
                    return (
                      <button
                        key={section.id}
                        onClick={() => {
                          setSearchQuery('');
                          setActiveTab(section.id);
                        }}
                        className={`shrink-0 md:w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all group ${
                          isActive
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-slate-100'
                        }`}
                        id={`sidebar-tab-${section.id}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon size={16} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'} />
                          <span className="text-xs font-semibold tracking-tight">{section.title}</span>
                        </div>
                        <span className={`hidden md:block text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          isActive ? 'bg-indigo-500 text-white' : 'bg-slate-200/60 dark:bg-slate-800/80 text-slate-500'
                        }`}>
                          {section.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-auto p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 hidden md:block">
                  <div className="flex gap-2 items-start text-[10px] text-slate-400">
                    <Info size={12} className="shrink-0 mt-0.5 text-indigo-500" />
                    <div>
                      <p className="font-bold text-slate-500 dark:text-slate-300 mb-0.5">Quick Help</p>
                      <p className="leading-normal">Press <code className="font-mono bg-slate-200 dark:bg-slate-800 px-1 rounded text-[9px]">F1</code> or <code className="font-mono bg-slate-200 dark:bg-slate-800 px-1 rounded text-[9px]">Alt+H</code> inside the editor to open this dialog.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Content Panel */}
              <div className="flex-1 bg-white dark:bg-[#0b0f19] overflow-y-auto p-6 md:p-8 custom-scrollbar">
                
                {/* Search Results Mode */}
                {searchQuery ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                      <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                        Search Results for <span className="text-indigo-600 dark:text-indigo-400 font-mono">"{searchQuery}"</span>
                      </h3>
                      <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-900 px-2.5 py-1 rounded-full font-medium">
                        {searchResults.length} {searchResults.length === 1 ? 'match' : 'matches'} found
                      </span>
                    </div>

                    {searchResults.length > 0 ? (
                      <div className="grid grid-cols-1 gap-4">
                        {searchResults.map((result, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              setActiveTab(result.section);
                              setSearchQuery('');
                            }}
                            className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 hover:border-indigo-500/40 dark:hover:border-indigo-500/30 rounded-xl transition-all cursor-pointer group flex justify-between items-start"
                          >
                            <div className="space-y-1.5 flex-1 pr-4">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-extrabold uppercase text-indigo-500 tracking-wider">
                                  {result.section.replace('-', ' ')}
                                </span>
                                <ChevronRight size={10} className="text-slate-400" />
                                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                  {result.title}
                                </h4>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                                {result.snippet}
                              </p>
                            </div>
                            <button className="text-[10px] font-bold text-indigo-500 group-hover:underline flex items-center gap-1 shrink-0 pt-0.5">
                              View Guide <ChevronRight size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-16 space-y-3">
                        <div className="inline-flex p-4 bg-slate-100 dark:bg-slate-900 rounded-full text-slate-400">
                          <Search size={32} />
                        </div>
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No match found</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                          We couldn't find any articles matching "{searchQuery}". Try searching for categories like "latex", "polar", "inequality", or standard functions.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  
                  /* Section Documentation Content */
                  <div className="space-y-8">
                    
                    {/* Getting Started */}
                    {activeTab === 'getting-started' && (
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Getting Started with Math Graph Node</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            Welcome to the interactive Math Graph Studio! The Math Graph Node provides a rich sandbox for dynamic vector plots, parametric curves, system modeling, and geometric proofs.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-xl space-y-2">
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                              <Info size={14} className="text-indigo-500" />
                              What is a Math Node?
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                              It's a full algebra environment inside your node system. Unlike simple calculators, it parses complex explicit or parametric formulas and renders crisp mathematical plots using high-performance vectors.
                            </p>
                          </div>

                          <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-xl space-y-2">
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                              <Zap size={14} className="text-indigo-500" />
                              Continuous Evaluation Loop
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                              The system monitors all inputs, expressions, and parameters, recalculating values over a high frame-rate rendering thread. Your changes are shown instantly as you type!
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">How Graphs Work Internally</h4>
                          <div className="border border-slate-150 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                            <div className="grid grid-cols-3 bg-slate-50 dark:bg-slate-900/80 p-2.5 font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                              <div>Step Component</div>
                              <div className="col-span-2">Functional Responsibility</div>
                            </div>
                            <div className="grid grid-cols-3 p-3 border-b border-slate-100 dark:border-slate-800/40 text-slate-600 dark:text-slate-400">
                              <div className="font-semibold text-slate-800 dark:text-slate-200">1. MathJS Parser</div>
                              <div className="col-span-2">Compiles user expressions into parse trees. Validates algebraic syntax and reports real-time syntax errors.</div>
                            </div>
                            <div className="grid grid-cols-3 p-3 border-b border-slate-100 dark:border-slate-800/40 text-slate-600 dark:text-slate-400">
                              <div className="font-semibold text-slate-800 dark:text-slate-200">2. Evaluation Scope</div>
                              <div className="col-span-2">Creates a unified variable dictionary containing coordinate positions (x, y), timeline coordinates (t), and slider arrays.</div>
                            </div>
                            <div className="grid grid-cols-3 p-3 text-slate-600 dark:text-slate-400">
                              <div className="font-semibold text-slate-800 dark:text-slate-200">3. Vector Canvas Renderer</div>
                              <div className="col-span-2">Draws paths, fields, polygons, coordinates, and labels beautifully. Keeps shapes aligned with coordinate zooming.</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Function Types */}
                    {activeTab === 'function-types' && (
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Mathematical Function Types</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            The Math Node supports 10 distinct mathematical objects. Clicking the operator icon on the left of any equation lets you specify its functional mode:
                          </p>
                        </div>

                        <div className="space-y-4">
                          {[
                            {
                              name: 'Cartesian Function (Explicit)',
                              type: 'function',
                              template: 'y = f(x)',
                              desc: 'Draws a path representing standard single-variable equations.',
                              example: 'sin(x) * cos(t)',
                            },
                            {
                              name: 'Implicit Relation',
                              type: 'implicit',
                              template: 'f(x, y) = 0',
                              desc: 'Plots all coordinate coordinates (x, y) satisfying the field equation. Great for conic shapes, circles, ellipses, or matrix grids.',
                              example: 'x^2 + y^2 - 9',
                            },
                            {
                              name: 'Polar Curves',
                              type: 'polar',
                              template: 'r = f(theta)',
                              desc: 'Draws coordinates in terms of radius from origin r and angle theta.',
                              example: '2 * cos(4 * theta)',
                            },
                            {
                              name: 'Parametric Orbits',
                              type: 'parametric',
                              template: '[x(t), y(t)]',
                              desc: 'Traces curves where coordinates are separated as a function of variable t (from 0 to 2π).',
                              example: '[3 * cos(t), 2 * sin(t)]',
                            },
                            {
                              name: 'Discrete Points',
                              type: 'point',
                              template: '[px, py]',
                              desc: 'Plots standalone dots at designated coordinates. Can be linked to variables or dragged interactively.',
                              example: '[2, 3]',
                            },
                            {
                              name: 'Directed Vectors',
                              type: 'vector',
                              template: '[vx, vy]',
                              desc: 'Renders an arrow pointing from coordinate origin (or custom pivot) to the specified displacement vector.',
                              example: '[3, 2]',
                            }
                          ].map((item, idx) => (
                            <div
                              key={idx}
                              className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black uppercase bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded">
                                    {item.template}
                                  </span>
                                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    {item.name}
                                  </h4>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl">
                                  {item.desc}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 self-start md:self-auto">
                                <code className="text-xs bg-white dark:bg-slate-950 px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-indigo-500 dark:text-indigo-400 font-mono font-medium">
                                  {item.example}
                                </code>
                                <button
                                  onClick={() => handleCopy(item.example, `copy-type-${idx}`)}
                                  className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-800 transition-all"
                                  title="Copy formula"
                                >
                                  {copiedId === `copy-type-${idx}` ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                </button>
                                {onInsertFormula && (
                                  <button
                                    onClick={() => handleInsert({ type: item.type as any, expr: item.example }, `insert-type-${idx}`)}
                                    className="p-2 hover:bg-indigo-600 bg-indigo-500 text-white rounded-lg transition-all"
                                    title="Insert into graph"
                                  >
                                    {insertedId === `insert-type-${idx}` ? <Check size={14} /> : <Plus size={14} />}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* LaTeX Guide */}
                    {activeTab === 'latex-guide' && (
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">LaTeX Notation Reference</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            Use standard mathematical notation inside labels, notes, or equations. The editor translates raw inputs into stunning KaTeX vectors.
                          </p>
                        </div>

                        <div className="border border-slate-200 dark:border-slate-850 rounded-xl overflow-hidden text-xs">
                          <div className="grid grid-cols-12 bg-slate-50 dark:bg-slate-900/80 p-3 font-bold text-slate-700 dark:text-slate-300 border-b border-slate-250 dark:border-slate-800">
                            <div className="col-span-3">Concept / Formula</div>
                            <div className="col-span-3 font-mono">LaTeX Code</div>
                            <div className="col-span-3">Typeset Result</div>
                            <div className="col-span-3 text-right">Actions</div>
                          </div>

                          {[
                            { name: 'Exponentiation', code: 'x^2', latex: 'x^2', insert: 'x^2' },
                            { name: 'Long Superscript', code: 'x^{10}', latex: 'x^{10}', insert: 'x^10' },
                            { name: 'Mathematical Fraction', code: '\\frac{a}{b}', latex: '\\frac{a}{b}', insert: 'a/b' },
                            { name: 'Square Root', code: '\\sqrt{x}', latex: '\\sqrt{x}', insert: 'sqrt(x)' },
                            { name: 'Summation Series', code: '\\sum_{i=1}^{n}', latex: '\\sum_{i=1}^{n} i^2', insert: 'sum(map(1:n, f(i)=i^2))' },
                            { name: 'Product Series', code: '\\prod_{i=1}^{n}', latex: '\\prod_{i=1}^{n} i', insert: 'prod(map(1:n, f(i)=i))' },
                            { name: 'Definite Integral', code: '\\int_a^b', latex: '\\int_a^b f(x)\\,dx', insert: 'int_a^b' },
                            { name: 'Greek Angle Theta', code: '\\theta', latex: '\\theta', insert: 'theta' },
                            { name: 'Greek Angle Alpha', code: '\\alpha', latex: '\\alpha', insert: 'alpha' },
                            { name: 'Mathematical Constant Pi', code: '\\pi', latex: '\\pi', insert: 'pi' }
                          ].map((item, idx) => (
                            <div
                              key={idx}
                              className="grid grid-cols-12 p-3 border-b border-slate-100 dark:border-slate-800/40 text-slate-600 dark:text-slate-400 items-center hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors"
                            >
                              <div className="col-span-3 font-semibold text-slate-850 dark:text-slate-200">{item.name}</div>
                              <div className="col-span-3 font-mono text-indigo-500 dark:text-indigo-400 bg-slate-50 dark:bg-slate-950 px-2 py-1 rounded w-fit text-[11px] select-all">
                                {item.code}
                              </div>
                              <div className="col-span-3 text-slate-900 dark:text-slate-100 text-sm">
                                {renderLatex(item.latex)}
                              </div>
                              <div className="col-span-3 flex justify-end gap-1.5">
                                <button
                                  onClick={() => handleCopy(item.code, `copy-latex-${idx}`)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-850 rounded text-[10px] font-bold text-slate-600 dark:text-slate-300 transition-all flex items-center gap-1"
                                >
                                  {copiedId === `copy-latex-${idx}` ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                  Copy Code
                                </button>
                                {onInsertFormula && (
                                  <button
                                    onClick={() => handleInsert({ type: 'function', expr: item.insert }, `insert-latex-${idx}`)}
                                    className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 rounded transition-all flex items-center gap-1 border border-indigo-250 dark:border-indigo-900/60"
                                  >
                                    {insertedId === `insert-latex-${idx}` ? <Check size={11} /> : <Plus size={11} />}
                                    Insert Formula
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* MathJS Guide */}
                    {activeTab === 'mathjs-guide' && (
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">MathJS Expression Reference</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            Your expressions are evaluated with the powerful <code>Math.js</code> algebra library. Here are the core mathematical operations and array features:
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              <Zap size={14} className="text-amber-500" />
                              Scientific Trigonometry & Logarithms
                            </h4>
                            <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-xs">
                              <div className="flex justify-between items-center border-b border-slate-150 dark:border-slate-800/60 pb-1.5">
                                <span className="font-semibold">Standard Functions</span>
                                <code className="font-mono text-indigo-500 dark:text-indigo-400">sin(x), cos(x), tan(x)</code>
                              </div>
                              <div className="flex justify-between items-center border-b border-slate-150 dark:border-slate-800/60 pb-1.5">
                                <span className="font-semibold">Absolute & Roots</span>
                                <code className="font-mono text-indigo-500 dark:text-indigo-400">abs(x), sqrt(x), sign(x)</code>
                              </div>
                              <div className="flex justify-between items-center border-b border-slate-150 dark:border-slate-800/60 pb-1.5">
                                <span className="font-semibold">Logarithmic Base</span>
                                <code className="font-mono text-indigo-500 dark:text-indigo-400">log(x), log10(x), ln(x)</code>
                              </div>
                              <div className="flex justify-between items-center pb-0.5">
                                <span className="font-semibold">Exponents & Euler</span>
                                <code className="font-mono text-indigo-500 dark:text-indigo-400">exp(x), pow(x, y), x^y</code>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              <Layers size={14} className="text-emerald-500" />
                              Matrices, Determinants & Arrays
                            </h4>
                            <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-xs">
                              <div className="flex justify-between items-start border-b border-slate-150 dark:border-slate-800/60 pb-1.5">
                                <span className="font-semibold">Custom Matrices</span>
                                <code className="font-mono text-indigo-500 dark:text-indigo-400">[[1, 2], [3, 4]]</code>
                              </div>
                              <div className="flex justify-between items-start border-b border-slate-150 dark:border-slate-800/60 pb-1.5">
                                <span className="font-semibold">Matrix Determinant</span>
                                <code className="font-mono text-indigo-500 dark:text-indigo-400">det(M)</code>
                              </div>
                              <div className="flex justify-between items-start border-b border-slate-150 dark:border-slate-800/60 pb-1.5">
                                <span className="font-semibold">Interactive Vectors</span>
                                <code className="font-mono text-indigo-500 dark:text-indigo-400">dot(V1, V2), norm(V1)</code>
                              </div>
                              <div className="flex justify-between items-start border-b border-slate-150 dark:border-slate-800/60 pb-1.5">
                                <span className="font-semibold">Map Iteration (Loop)</span>
                                <code className="font-mono text-indigo-500 dark:text-indigo-400 text-right">map(1:5, f(i)=i^2)</code>
                              </div>
                              <div className="flex justify-between items-start border-b border-slate-150 dark:border-slate-800/60 pb-1.5">
                                <span className="font-semibold">Filter Iteration</span>
                                <code className="font-mono text-indigo-500 dark:text-indigo-400 text-right">filter([1,2,3,4], f(x)=x&gt;2)</code>
                              </div>
                              <div className="flex justify-between items-start pb-0.5">
                                <span className="font-semibold">For Each (Returns nothing)</span>
                                <code className="font-mono text-indigo-500 dark:text-indigo-400 text-right">forEach([1,2], f(x)=x^2)</code>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <LineChart size={14} className="text-rose-500" />
                            Statistics & Series Analysis
                          </h4>
                          <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-xs">
                            <div className="flex justify-between items-start border-b border-slate-150 dark:border-slate-800/60 pb-1.5">
                              <span className="font-semibold">Maximum of a Series</span>
                              <code className="font-mono text-indigo-500 dark:text-indigo-400">max(map(1:10, f(i) = -i^2 + 5i))</code>
                            </div>
                            <div className="flex justify-between items-start border-b border-slate-150 dark:border-slate-800/60 pb-1.5">
                              <span className="font-semibold">Minimum of a Series</span>
                              <code className="font-mono text-indigo-500 dark:text-indigo-400">min(map(1:10, f(i) = i^2))</code>
                            </div>
                            <div className="flex justify-between items-start border-b border-slate-150 dark:border-slate-800/60 pb-1.5">
                              <span className="font-semibold">Mean / Average</span>
                              <code className="font-mono text-indigo-500 dark:text-indigo-400">mean(map(1:10, f(i) = i^2))</code>
                            </div>
                            <div className="flex justify-between items-start border-b border-slate-150 dark:border-slate-800/60 pb-1.5">
                              <span className="font-semibold">Median</span>
                              <code className="font-mono text-indigo-500 dark:text-indigo-400 text-right">median(map(1:10, f(i) = i^2))</code>
                            </div>
                            <div className="flex justify-between items-start pb-0.5">
                              <span className="font-semibold">Standard Deviation</span>
                              <code className="font-mono text-indigo-500 dark:text-indigo-400 text-right">std(map(1:10, f(i) = i^2))</code>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 bg-indigo-600/5 border border-indigo-500/15 rounded-xl space-y-2 text-xs">
                          <h4 className="font-bold text-indigo-600 dark:text-indigo-400">Advanced Mathematical Feature: Linear Geometry proofs</h4>
                          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                            You can plot linear algebra constraints directly using matrix equations in <b>Implicit Relations</b>. For instance, the determinant of a 3x3 matrix equating to zero defines collinearity of points:
                          </p>
                          <div className="p-3 bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-lg flex justify-between items-center font-mono">
                            <span className="text-[11px] text-slate-800 dark:text-slate-350 font-bold">[[x, y, 1], [a, b, 1], [c, d, 1]] = 0</span>
                            <button
                              onClick={() => handleCopy('[[x, y, 1], [1, 1, 1], [2, 3, 1]]', 'copy-collinear')}
                              className="px-2 py-1 bg-indigo-500 text-white rounded text-[10px] font-bold flex items-center gap-1 hover:bg-indigo-600 transition-all"
                            >
                              {copiedId === 'copy-collinear' ? <Check size={12} /> : <Copy size={12} />}
                              Copy Example
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Variables & Sliders */}
                    {activeTab === 'variables' && (
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Variables & Dynamic Slider Rigs</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            A major capability of Math Node is the automated variable system. You do not need to pre-define sliders: typing an unknown parameter will declare it instantly!
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-xs">
                            <span className="font-black text-indigo-500 uppercase text-[9px] tracking-wider block">Standard Core Coordinates</span>
                            <ul className="space-y-1.5 text-slate-600 dark:text-slate-400">
                              <li className="flex justify-between border-b border-slate-150 dark:border-slate-800/40 pb-1">
                                <code className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">x</code>
                                <span>Input coordinate along horizontal axis</span>
                              </li>
                              <li className="flex justify-between border-b border-slate-150 dark:border-slate-800/40 pb-1">
                                <code className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">y</code>
                                <span>Input coordinate along vertical axis</span>
                              </li>
                              <li className="flex justify-between border-b border-slate-150 dark:border-slate-800/40 pb-1">
                                <code className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">t</code>
                                <span>Elapsed animation clock in seconds</span>
                              </li>
                              <li className="flex justify-between pb-0.5">
                                <code className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">theta / θ</code>
                                <span>Polar sweep angle for Polar functions</span>
                              </li>
                            </ul>
                          </div>

                          <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-xs">
                            <span className="font-black text-indigo-500 uppercase text-[9px] tracking-wider block">Automated Custom Sliders</span>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                              Whenever you write a formula containing variables like <code className="font-mono bg-white dark:bg-slate-950 px-1 py-0.5 border border-slate-200 dark:border-slate-800 rounded text-indigo-500 font-bold">a</code>, <code className="font-mono bg-white dark:bg-slate-950 px-1 py-0.5 border border-slate-200 dark:border-slate-800 rounded text-indigo-500 font-bold">k</code>, or <code className="font-mono bg-white dark:bg-slate-950 px-1 py-0.5 border border-slate-200 dark:border-slate-800 rounded text-indigo-500 font-bold">freq</code>, an interactive slider with range settings (-10 to 10 by default) is appended beneath your function stack.
                            </p>
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg text-indigo-700 dark:text-indigo-300 border border-indigo-150 dark:border-indigo-900/40">
                              <b>Pro Tip:</b> You can establish mathematical relationships between sliders! For example, create slider <code>a</code> and define variable <code>b</code> as <code>a * 2</code>. Moving slider <code>a</code> will lock <code>b</code> dynamically!
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Animation & Timeline */}
                    {activeTab === 'animation' && (
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Animation, Motion, & Timeline Clock</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            Unlock dynamic motion inside your canvas! By incorporating the global time variable <code>t</code> (or <code>time</code>) into your expressions, you can create evolving harmonic oscillations and continuous movement.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {[
                            {
                              title: 'Timeline Controls',
                              desc: 'Use Play, Pause, Speed scaling (0.5x to 2x), and Skip-Back to control the timeline clock t.',
                              example: 't',
                            },
                            {
                              title: 'Harmonic Motion',
                              desc: 'Introduce a phase shift inside trigonometric functions to animate smooth continuous wave propagations.',
                              example: 'sin(x - t)',
                            },
                            {
                              title: 'Evolving Orbits',
                              desc: 'Animate vectors, points, and segments dynamically along circular paths as a factor of time.',
                              example: '[cos(t), sin(t)]',
                            }
                          ].map((card, idx) => (
                            <div
                              key={idx}
                              className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 text-xs"
                            >
                              <h4 className="font-bold text-slate-850 dark:text-slate-200">{card.title}</h4>
                              <p className="text-slate-500 dark:text-slate-400 leading-normal">{card.desc}</p>
                              <div className="flex justify-between items-center p-2.5 bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-800/80 rounded-lg">
                                <code className="font-mono text-indigo-500 dark:text-indigo-400">{card.example}</code>
                                <button
                                  onClick={() => handleCopy(card.example, `copy-anim-${idx}`)}
                                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                  {copiedId === `copy-anim-${idx}` ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Transformations */}
                    {activeTab === 'transformations' && (
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Geometric Transformations & Interactive Gizmos</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            Transform equations physically inside the vector viewport. The editor supports Translate, Rotate, Scale, and Pivot bounds directly on equations or collections.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-xs">
                            <span className="font-black text-indigo-500 uppercase text-[9px] tracking-wider block">Viewport Drag Handles</span>
                            <p className="text-slate-600 dark:text-slate-400 leading-normal">
                              Toggle the <b>Draggable</b> switch on any Point or Vector. Doing so mounts live coordinate rings directly on the viewport canvas, allowing you to drag them physically and see linked equations transform.
                            </p>
                          </div>

                          <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-xs">
                            <span className="font-black text-indigo-500 uppercase text-[9px] tracking-wider block">Transform Matrices</span>
                            <p className="text-slate-600 dark:text-slate-400 leading-normal">
                              You can mathematically apply scale, shear, and offset transformations to your curves by combining vector coordinates or utilizing coordinate offsets.
                            </p>
                            <div className="mt-1 font-mono text-[10px] text-slate-400 italic">Scale Sine: y = 2 * sin(x * 1.5)</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Inequalities */}
                    {activeTab === 'inequalities' && (
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Inequality Feasibility Shading</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            Plot solid and dashed boundaries to visualize bounded systems and linear programming spaces. The canvas paints satisfying coordinate spaces smoothly.
                          </p>
                        </div>

                        <div className="space-y-4">
                          {[
                            {
                              expr: 'y <= sin(x)',
                              desc: "Shades everything beneath the boundary sine wave. The solid line edge indicates boundary inclusion (<= vs <).",
                            },
                            {
                              expr: 'x^2 + y^2 <= 9',
                              desc: 'Fills the circular region of radius 3 centered at the origin. Useful for demonstrating radius constraints.',
                            }
                          ].map((item, idx) => (
                            <div
                              key={idx}
                              className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4"
                            >
                              <div className="space-y-1">
                                <h4 className="text-xs font-bold text-slate-850 dark:text-slate-200">
                                  Equation: <code className="font-mono text-indigo-500 dark:text-indigo-400">{item.expr}</code>
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                  {item.desc}
                                </p>
                              </div>

                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleCopy(item.expr, `copy-ineq-${idx}`)}
                                  className="p-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg transition-all"
                                  title="Copy formula"
                                >
                                  {copiedId === `copy-ineq-${idx}` ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                </button>
                                {onInsertFormula && (
                                  <button
                                    onClick={() => handleInsert({ type: 'inequality', expr: item.expr }, `insert-ineq-${idx}`)}
                                    className="p-2 bg-indigo-500 hover:bg-indigo-650 text-white rounded-lg transition-all"
                                    title="Insert into graph"
                                  >
                                    {insertedId === `insert-ineq-${idx}` ? <Check size={14} /> : <Plus size={14} />}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Polar & Parametric */}
                    {activeTab === 'polar-parametric' && (
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Polar & Parametric Curves</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            Create circular sweeps, harmonic Lissajous patterns, spirals, and transcendental orbits by mapping polar or parameter systems.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                            <span className="text-[10px] font-black uppercase text-indigo-500 bg-indigo-500/10 px-2.5 py-0.5 rounded w-fit block">Polar Orbits</span>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-normal">
                              In polar mode, you calculate radius <code className="font-mono text-indigo-500">r</code> as a function of angle <code className="font-mono text-indigo-500">theta</code> or <code className="font-mono text-indigo-500">θ</code>. The sweep evaluates through a full 2π rotational interval.
                            </p>
                            <div className="flex justify-between items-center p-2.5 bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-lg text-xs">
                              <code className="font-mono text-indigo-500">r = 3 * sin(5 * theta)</code>
                              <button
                                onClick={() => handleCopy('3 * sin(5 * theta)', 'copy-polar-ex')}
                                className="p-1 border border-slate-200 dark:border-slate-800 rounded text-slate-400 hover:text-slate-600"
                              >
                                {copiedId === 'copy-polar-ex' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                              </button>
                            </div>
                          </div>

                          <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                            <span className="text-[10px] font-black uppercase text-indigo-500 bg-indigo-500/10 px-2.5 py-0.5 rounded w-fit block">Parametric curves</span>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-normal">
                              In parametric mode, you enter standard continuous positions as vector arrays. Traces orbits with parameter <code className="font-mono text-indigo-500">t</code> from 0 to 2π.
                            </p>
                            <div className="flex justify-between items-center p-2.5 bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-lg text-xs">
                              <code className="font-mono text-indigo-500">[cos(t*3), sin(t*2)]</code>
                              <button
                                onClick={() => handleCopy('[cos(t*3), sin(t*2)]', 'copy-param-ex')}
                                className="p-1 border border-slate-200 dark:border-slate-800 rounded text-slate-400 hover:text-slate-600"
                              >
                                {copiedId === 'copy-param-ex' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Advanced Examples Gallery */}
                    {activeTab === 'advanced-gallery' && (
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Interactive Math Sandbox Gallery</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            Select and experiment with pre-assembled high-fidelity mathematical formulas. Clicking "Insert" will instantly add these formulas into your current node stack!
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {[
                            {
                              id: 'g-circle',
                              name: 'Perfect Parametric Circle',
                              type: 'parametric',
                              expr: '[3*cos(t), 3*sin(t)]',
                              desc: 'Standard circle sweep with a parametric radius of 3.',
                            },
                            {
                              id: 'g-heart',
                              name: 'Transcendental Fourier Heart',
                              type: 'polar',
                              expr: '2 - 2*sin(theta) + sin(theta)*sqrt(abs(cos(theta))) / (sin(theta) + 1.4)',
                              desc: 'Famous algebraic polar heart curve containing absolute cosine factors.',
                            },
                            {
                              id: 'g-rose',
                              name: 'Sinusoidal Rose (8 Petals)',
                              type: 'polar',
                              expr: '3 * cos(4 * theta)',
                              desc: 'Creates a beautiful harmonic circular rose layout of petal nodes.',
                            },
                            {
                              id: 'g-spiral',
                              name: 'Archimedean Math Spiral',
                              type: 'polar',
                              expr: '0.2 * theta',
                              desc: 'A steady radial spiral sweep directly proportional to theta.',
                            },
                            {
                              id: 'g-lissajous',
                              name: 'Lissajous Knot (Ratio 3:2)',
                              type: 'parametric',
                              expr: '[3*sin(3*t), 3*cos(2*t)]',
                              desc: 'Visualizes 2D harmonic wave alignment with phase shift.',
                            },
                            {
                              id: 'g-butterfly',
                              name: 'Temple Fay Butterfly Curve',
                              type: 'polar',
                              expr: 'exp(cos(theta)) - 2*cos(4*theta) + sin(theta/12)^5',
                              desc: 'Complex exponential polar spiral mimicking nature wing shapes.',
                            },
                            {
                              id: 'g-fourier',
                              name: 'Fourier Summation Wave',
                              type: 'function',
                              expr: 'sin(x) + sin(3*x)/3 + sin(5*x)/5',
                              desc: 'Demonstrates square wave approximations via Fourier harmonics.',
                            },
                            {
                              id: 'g-interference',
                              name: 'Constructive Interference Loop',
                              type: 'function',
                              expr: 'sin(x - t) + sin(x + t)',
                              desc: 'Two traveling waves colliding, showing active time modulation.',
                            }
                          ].map((preset) => (
                            <div
                              key={preset.id}
                              className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col justify-between gap-3 group"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-black uppercase text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded">
                                    {preset.type}
                                  </span>
                                  <h4 className="text-xs font-bold text-slate-850 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                    {preset.name}
                                  </h4>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                                  {preset.desc}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 p-2 bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-lg">
                                <code className="flex-1 font-mono text-[11px] text-slate-800 dark:text-slate-300 font-medium truncate select-all" title={preset.expr}>
                                  {preset.expr}
                                </code>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => handleCopy(preset.expr, preset.id)}
                                    className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md transition-all"
                                    title="Copy preset equation"
                                  >
                                    {copiedId === preset.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                  </button>
                                  {onInsertFormula && (
                                    <button
                                      onClick={() => handleInsert({ type: preset.type as any, expr: preset.expr }, preset.id)}
                                      className="px-2 py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded-md text-[10px] font-bold transition-all flex items-center gap-1 shadow shadow-indigo-500/10"
                                    >
                                      {insertedId === preset.id ? <Check size={12} /> : <Plus size={12} />}
                                      Insert
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer metadata */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2 font-medium">
                <Info size={14} className="text-indigo-500" />
                <span>Support sections: Calculus, Linear Algebra, Matrix shapes, Trigonometry</span>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-500/15 active:scale-95"
                id="doc-got-it-btn"
              >
                Got it, close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(popupContent, document.body);
};

export default MathHelpPopup;
