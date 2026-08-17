import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Copy, Check, Type, Edit3, Save, FileText, Layout, Globe,
  Bold, Italic, List, Link as LinkIcon, Code, ListOrdered, Hash, ChevronRight, ChevronDown, ListTodo, Menu, Settings,
  ZoomIn, ZoomOut, RotateCcw, ChevronUp, ChevronLeft,
  ArrowLeft, ArrowRight, ArrowUp, ArrowDown, ArrowLeftToLine, ArrowRightToLine, ClipboardPaste, Quote,
  Undo, Redo, Keyboard, CornerDownLeft, Delete, Minus
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Highlight, themes } from 'prism-react-renderer';
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

  useEffect(() => {
    const isDark = ['notebook-dark', 'default-dark', 'github-dark', 'retro-arcade', 'synthwave', 'chalkboard'].includes(theme || '');
    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? 'dark' : 'default',
      fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif'
    });
    mermaid.render(id, code).then((result) => {
      setSvg(result.svg);
      setHasError(false);
    }).catch(e => {
      console.error('Mermaid render error:', e);
      setHasError(true);
    });
  }, [code, id]);

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

  if (!isBlock && (inline || (!match && !code.includes('\n')))) {
    return (
      <code className="bg-slate-800/60 text-indigo-300 px-1.5 py-0.5 rounded text-[13px] font-mono border border-slate-700/40" {...props}>
        {children}
      </code>
    );
  }

  if (language === 'mermaid') {
    return <MermaidDiagram code={code} theme={theme} />;
  }

  return (
    <div className="not-prose relative group rounded-lg overflow-hidden my-4 border border-slate-800/80 bg-slate-950/70">
      {/* Floating Top-Right Controls */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 opacity-100 sm:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity z-10">
        {language && language !== 'text' && language !== 'code' && (
          <span className="text-[10px] font-mono text-slate-400 uppercase select-none px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-800 backdrop-blur">
            {language}
          </span>
        )}
        <button
          onClick={handleCopy}
          className="p-1.5 text-slate-400 hover:text-white bg-slate-900/90 hover:bg-slate-800 rounded-md border border-slate-800 shadow-sm backdrop-blur transition-all flex items-center gap-1"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check size={13} className="text-emerald-400" />
              <span className="text-[10px] text-emerald-400 font-sans font-medium pr-0.5">Copied</span>
            </>
          ) : (
            <Copy size={13} />
          )}
        </button>
      </div>

      {/* Syntax Highlighted Code Body */}
      <Highlight theme={themes.vsDark} code={code} language={language || 'text'}>
        {({ className: highlightClass, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className="!p-4 sm:!p-5 !pr-16 !m-0 overflow-x-auto text-[13px] font-mono leading-relaxed custom-scrollbar selection:bg-indigo-500/30 text-slate-200"
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
  const { level, children, id: propId, onHeadingClick, ...restProps } = props;
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
      className: `scroll-mt-20 group relative cursor-pointer hover:opacity-90 transition-opacity ${getHeadingClass(level)}`,
      ...restProps
    },
    [
      <a
        href={`#${id}`}
        key="anchor"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (onHeadingClick) onHeadingClick(id);
        }}
        className="absolute -left-6 top-1 opacity-0 group-hover:opacity-100 text-slate-400 hidden sm:block hover:text-indigo-400 transition-colors"
        title="Direct link to section"
      >
        <LinkIcon size={16} />
      </a>,
      ...childArray
    ]
  );
};

const getThemeClasses = (theme: string) => {
  switch (theme) {
    case 'github-light':
      return {
        container: "flex-1 p-4 sm:p-8 overflow-auto bg-white text-slate-900 custom-scrollbar scroll-smooth",
        prose: "prose prose-sm sm:prose-base max-w-3xl mx-auto " +
          "prose-headings:border-b prose-headings:border-slate-200 prose-headings:pb-2 " +
          "prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline " +
          "prose-pre:p-0 prose-pre:bg-transparent prose-pre:border-0 " +
          "prose-code:bg-slate-100 prose-code:text-slate-900 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none " +
          "prose-table:border prose-table:border-slate-200 prose-th:bg-slate-50 prose-th:p-2 prose-td:p-2 " +
          "prose-blockquote:border-l-4 prose-blockquote:border-slate-300 prose-blockquote:text-slate-500 prose-blockquote:not-italic " +
          "markdown-body pb-12"
      };
    case 'github-dark':
      return {
        container: "flex-1 p-4 sm:p-8 overflow-auto bg-[#0d1117] text-[#c9d1d9] custom-scrollbar scroll-smooth",
        prose: "prose prose-sm sm:prose-base prose-invert max-w-3xl mx-auto " +
          "prose-headings:text-[#c9d1d9] prose-headings:border-b prose-headings:border-[#21262d] prose-headings:pb-2 " +
          "prose-a:text-[#58a6ff] prose-a:no-underline hover:prose-a:underline " +
          "prose-p:text-[#c9d1d9] prose-li:text-[#c9d1d9] prose-strong:text-[#c9d1d9] " +
          "prose-pre:p-0 prose-pre:bg-transparent prose-pre:border-0 " +
          "prose-code:bg-[#161b22] prose-code:text-[#c9d1d9] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none " +
          "prose-table:border prose-table:border-[#30363d] prose-th:bg-[#161b22] prose-th:p-2 prose-td:p-2 " +
          "prose-blockquote:border-l-4 prose-blockquote:border-[#30363d] prose-blockquote:text-[#8b949e] prose-blockquote:not-italic " +
          "markdown-body pb-12"
      };
    case 'default-dark':
      return {
        container: "flex-1 p-4 sm:p-8 overflow-auto bg-white dark:bg-[#0d1117] custom-scrollbar scroll-smooth",
        prose: "prose prose-sm sm:prose-base dark:prose-invert max-w-3xl mx-auto " +
          "prose-headings:tracking-tight prose-headings:border-b prose-headings:border-slate-200 dark:prose-headings:border-slate-800/50 prose-headings:pb-2 " +
          "prose-a:text-indigo-500 dark:prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline " +
          "prose-pre:p-0 prose-pre:bg-transparent prose-pre:border-0 " +
          "prose-code:text-indigo-600 dark:prose-code:text-indigo-400 prose-code:bg-indigo-50 dark:prose-code:bg-indigo-500/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none " +
          "prose-table:border prose-table:border-slate-200 dark:prose-table:border-slate-800 prose-th:bg-slate-50 dark:prose-th:bg-slate-900 prose-th:p-2 prose-td:p-2 " +
          "prose-img:rounded-lg prose-img:shadow-sm " +
          "prose-blockquote:border-l-4 prose-blockquote:border-indigo-500 prose-blockquote:bg-indigo-50 dark:prose-blockquote:bg-indigo-500/10 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:not-italic prose-blockquote:text-slate-700 dark:prose-blockquote:text-slate-300 " +
          "markdown-body pb-12"
      };
    case 'notebook-dark':
      return {
        container: "flex-1 p-4 sm:p-8 overflow-auto bg-[#1e1e2e] text-slate-300 custom-scrollbar scroll-smooth bg-[linear-gradient(transparent_31px,#3b82f61a_32px)] bg-[length:100%_32px]",
        prose: "prose prose-sm sm:prose-base dark:prose-invert max-w-3xl mx-auto font-['Comic_Neue','Comic_Sans_MS','Chalkboard_SE','Marker_Felt',sans-serif] " +
          "prose-headings:font-['Comic_Neue','Comic_Sans_MS','Chalkboard_SE','Marker_Felt',sans-serif] prose-headings:border-b-2 prose-headings:border-blue-500/20 prose-headings:pb-2 prose-headings:text-indigo-300 " +
          "prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline " +
          "prose-p:leading-8 prose-li:leading-8 prose-headings:leading-8 " +
          "prose-pre:p-0 prose-pre:bg-transparent prose-pre:border-0 " +
          "prose-code:bg-yellow-900/30 prose-code:text-yellow-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none " +
          "prose-table:border prose-table:border-blue-900/50 prose-th:bg-blue-900/20 prose-th:p-2 prose-td:p-2 " +
          "prose-img:rounded-lg prose-img:shadow-md " +
          "prose-blockquote:border-l-4 prose-blockquote:border-red-500/50 prose-blockquote:bg-red-900/10 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:italic prose-blockquote:text-slate-400 " +
          "markdown-body pb-12 relative " +
          "before:absolute before:top-0 before:bottom-0 before:w-px before:bg-red-500/30 before:-left-6 sm:before:-left-8"
      };
    case 'borderlands':
      return {
        container: "flex-1 p-4 sm:p-8 overflow-auto bg-[#e5e5e5] text-black font-sans custom-scrollbar scroll-smooth",
        prose: "prose prose-sm sm:prose-base max-w-3xl mx-auto " +
          "prose-headings:font-black prose-headings:uppercase prose-headings:-skew-x-3 prose-headings:text-yellow-400 prose-headings:drop-shadow-[2px_2px_0_#000] prose-headings:border-b-4 prose-headings:border-black prose-headings:pb-2 " +
          "prose-a:text-red-500 prose-a:font-bold prose-a:no-underline hover:prose-a:underline hover:prose-a:bg-yellow-400 hover:prose-a:text-black " +
          "prose-p:font-bold prose-p:text-black prose-strong:text-black prose-strong:font-black " +
          "prose-pre:bg-white prose-pre:border-4 prose-pre:border-black prose-pre:shadow-[4px_4px_0_#000] prose-pre:rounded-none " +
          "prose-code:text-red-600 prose-code:font-bold prose-code:bg-white prose-code:border-2 prose-code:border-black prose-code:px-1.5 prose-code:py-0.5 prose-code:shadow-[2px_2px_0_#000] " +
          "prose-table:border-4 prose-table:border-black prose-th:bg-yellow-400 prose-th:border-b-4 prose-th:border-black prose-th:text-black prose-th:uppercase prose-th:font-black prose-td:border-b-2 prose-td:border-black " +
          "prose-img:border-4 prose-img:border-black prose-img:shadow-[6px_6px_0_#000] prose-img:rounded-none " +
          "prose-blockquote:border-l-8 prose-blockquote:border-black prose-blockquote:bg-yellow-400 prose-blockquote:text-black prose-blockquote:font-black prose-blockquote:italic prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:shadow-[4px_4px_0_#000] " +
          "markdown-body pb-12"
      };
    case 'comic-minimal':
      return {
        container: "flex-1 p-4 sm:p-8 overflow-auto bg-white text-slate-800 font-['Comic_Neue','Comic_Sans_MS','Chalkboard_SE','Marker_Felt',sans-serif] custom-scrollbar scroll-smooth",
        prose: "prose prose-sm sm:prose-base max-w-3xl mx-auto " +
          "prose-headings:text-blue-500 prose-headings:border-b-4 prose-headings:border-yellow-400 prose-headings:rounded-full prose-headings:px-4 prose-headings:py-1 prose-headings:inline-block " +
          "prose-a:text-red-500 hover:prose-a:text-blue-500 " +
          "prose-pre:bg-blue-50 prose-pre:border-4 prose-pre:border-blue-200 prose-pre:rounded-2xl " +
          "prose-code:text-red-500 prose-code:bg-yellow-100 prose-code:px-2 prose-code:py-1 prose-code:rounded-full " +
          "prose-blockquote:border-l-0 prose-blockquote:bg-blue-50 prose-blockquote:rounded-2xl prose-blockquote:py-3 prose-blockquote:px-6 prose-blockquote:text-blue-800 " +
          "markdown-body pb-12"
      };
    case 'anime-pastel':
      return {
        container: "flex-1 p-4 sm:p-8 overflow-auto bg-[#fff0f5] text-[#7851a9] font-sans custom-scrollbar scroll-smooth",
        prose: "prose prose-sm sm:prose-base max-w-3xl mx-auto " +
          "prose-headings:text-[#ffb6c1] prose-headings:drop-shadow-[1px_1px_0_#7851a9] prose-headings:border-b-2 prose-headings:border-[#ff69b4] prose-headings:border-dashed " +
          "prose-a:text-[#00ced1] hover:prose-a:text-[#ff69b4] " +
          "prose-pre:bg-[#e6e6fa] prose-pre:border-2 prose-pre:border-[#ffb6c1] prose-pre:rounded-xl " +
          "prose-code:text-[#ff69b4] prose-code:bg-[#fff] prose-code:px-2 prose-code:py-0.5 prose-code:rounded-md prose-code:border prose-code:border-[#ffb6c1] " +
          "prose-blockquote:border-l-4 prose-blockquote:border-[#ff69b4] prose-blockquote:bg-[#ffe4e1] prose-blockquote:rounded-r-xl prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:text-[#ff69b4] " +
          "markdown-body pb-12"
      };
    case 'manga-scan':
      return {
        container: "flex-1 p-4 sm:p-8 overflow-auto bg-white text-black font-serif custom-scrollbar scroll-smooth " +
          "bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px] [background-position:0_0,8px_8px] opacity-90",
        prose: "prose prose-sm sm:prose-base max-w-3xl mx-auto bg-white p-8 border-4 border-black " +
          "prose-headings:font-black prose-headings:text-black prose-headings:uppercase prose-headings:border-b-8 prose-headings:border-black prose-headings:pb-1 " +
          "prose-a:text-black prose-a:bg-gray-200 prose-a:font-bold prose-a:no-underline hover:prose-a:bg-black hover:prose-a:text-white " +
          "prose-p:font-medium prose-p:text-black " +
          "prose-pre:bg-white prose-pre:border-4 prose-pre:border-black prose-pre:rounded-none " +
          "prose-code:text-black prose-code:font-bold prose-code:bg-gray-200 prose-code:border-2 prose-code:border-black prose-code:px-1.5 prose-code:py-0.5 " +
          "prose-img:border-8 prose-img:border-black prose-img:rounded-none prose-img:grayscale " +
          "prose-blockquote:border-l-8 prose-blockquote:border-black prose-blockquote:bg-gray-100 prose-blockquote:text-black prose-blockquote:font-black prose-blockquote:italic prose-blockquote:py-3 prose-blockquote:px-6 " +
          "markdown-body pb-12"
      };
    case 'cyberpunk':
      return {
        container: "flex-1 p-4 sm:p-8 overflow-auto bg-[#fbee0f] text-black font-mono custom-scrollbar scroll-smooth",
        prose: "prose prose-sm sm:prose-base max-w-3xl mx-auto " +
          "prose-headings:font-black prose-headings:text-[#00ffff] prose-headings:bg-black prose-headings:inline-block prose-headings:px-4 prose-headings:py-1 prose-headings:uppercase prose-headings:tracking-widest prose-headings:-skew-x-6 " +
          "prose-a:text-[#ff003c] prose-a:font-bold prose-a:bg-black prose-a:px-1 hover:prose-a:text-black hover:prose-a:bg-[#00ffff] " +
          "prose-p:font-medium prose-p:text-black " +
          "prose-pre:bg-black prose-pre:border-l-8 prose-pre:border-[#ff003c] prose-pre:rounded-none " +
          "prose-code:text-[#00ffff] prose-code:font-bold prose-code:bg-black prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-none " +
          "prose-img:border-4 prose-img:border-black prose-img:rounded-none prose-img:shadow-[8px_8px_0_#ff003c] " +
          "prose-blockquote:border-l-8 prose-blockquote:border-[#00ffff] prose-blockquote:bg-black prose-blockquote:text-[#ff003c] prose-blockquote:font-mono prose-blockquote:py-3 prose-blockquote:px-6 prose-blockquote:-skew-x-6 " +
          "markdown-body pb-12"
      };
    case 'retro-arcade':
      return {
        container: "flex-1 p-4 sm:p-8 overflow-auto bg-black text-[#00ff00] font-mono custom-scrollbar scroll-smooth",
        prose: "prose prose-sm sm:prose-base dark:prose-invert max-w-3xl mx-auto " +
          "prose-headings:font-black prose-headings:text-[#ff00ff] prose-headings:uppercase prose-headings:tracking-widest prose-headings:border-b-4 prose-headings:border-[#ff00ff] prose-headings:border-dashed " +
          "prose-a:text-[#00ffff] prose-a:uppercase hover:prose-a:bg-[#00ffff] hover:prose-a:text-black " +
          "prose-p:text-[#00ff00] " +
          "prose-pre:bg-[#111] prose-pre:border-4 prose-pre:border-[#00ff00] prose-pre:rounded-none " +
          "prose-code:text-[#ff00ff] prose-code:bg-[#222] prose-code:border prose-code:border-[#ff00ff] prose-code:px-1.5 prose-code:py-0.5 prose-code:uppercase " +
          "prose-blockquote:border-l-8 prose-blockquote:border-[#00ffff] prose-blockquote:bg-[#0a0a0a] prose-blockquote:text-[#00ffff] prose-blockquote:uppercase prose-blockquote:py-3 prose-blockquote:px-6 " +
          "markdown-body pb-12"
      };
    case 'synthwave':
      return {
        container: "flex-1 p-4 sm:p-8 overflow-auto bg-[#1a0b2e] text-[#b399ff] font-sans custom-scrollbar scroll-smooth bg-[linear-gradient(transparent_0%,rgba(255,0,255,0.1)_50%,transparent_100%)] bg-[length:100%_4px]",
        prose: "prose prose-sm sm:prose-base dark:prose-invert max-w-3xl mx-auto " +
          "prose-headings:font-black prose-headings:text-transparent prose-headings:bg-clip-text prose-headings:bg-gradient-to-r prose-headings:from-[#ff00a0] prose-headings:to-[#00d2ff] prose-headings:drop-shadow-[0_0_8px_rgba(255,0,160,0.8)] " +
          "prose-a:text-[#00d2ff] hover:prose-a:text-[#ff00a0] hover:prose-a:drop-shadow-[0_0_5px_rgba(255,0,160,0.8)] " +
          "prose-pre:bg-[#0d0221] prose-pre:border prose-pre:border-[#00d2ff] prose-pre:shadow-[0_0_15px_rgba(0,210,255,0.3)] " +
          "prose-code:text-[#ff00a0] prose-code:bg-[#2b0f4c] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded " +
          "prose-blockquote:border-l-4 prose-blockquote:border-[#ff00a0] prose-blockquote:bg-[#2b0f4c]/50 prose-blockquote:text-[#00d2ff] prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:shadow-[inset_4px_0_10px_rgba(255,0,160,0.2)] " +
          "markdown-body pb-12"
      };
    case 'neubrutalism':
      return {
        container: "flex-1 p-4 sm:p-8 overflow-auto bg-[#ffd600] text-black font-sans custom-scrollbar scroll-smooth",
        prose: "prose prose-sm sm:prose-base max-w-3xl mx-auto " +
          "prose-headings:font-black prose-headings:text-white prose-headings:bg-black prose-headings:px-4 prose-headings:py-2 prose-headings:inline-block prose-headings:shadow-[8px_8px_0_#ff4500] prose-headings:border-4 prose-headings:border-black prose-headings:rotate-1 " +
          "prose-a:text-black prose-a:bg-[#ff4500] prose-a:px-1 prose-a:font-bold prose-a:border-2 prose-a:border-black prose-a:shadow-[2px_2px_0_#000] hover:prose-a:translate-y-[2px] hover:prose-a:translate-x-[2px] hover:prose-a:shadow-none hover:prose-a:bg-[#00ff00] " +
          "prose-p:font-medium prose-p:text-black prose-p:bg-white prose-p:p-4 prose-p:border-4 prose-p:border-black prose-p:shadow-[6px_6px_0_#000] " +
          "prose-pre:bg-[#00ff00] prose-pre:border-4 prose-pre:border-black prose-pre:shadow-[8px_8px_0_#000] prose-pre:rounded-none prose-pre:rotate-[-1deg] " +
          "prose-code:text-black prose-code:font-bold prose-code:bg-white prose-code:border-2 prose-code:border-black prose-code:px-1.5 prose-code:py-0.5 prose-code:shadow-[2px_2px_0_#000] " +
          "prose-img:border-4 prose-img:border-black prose-img:shadow-[8px_8px_0_#000] prose-img:rounded-none " +
          "prose-blockquote:border-4 prose-blockquote:border-black prose-blockquote:bg-[#ff4500] prose-blockquote:text-black prose-blockquote:font-black prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:shadow-[8px_8px_0_#000] prose-blockquote:-rotate-1 " +
          "markdown-body pb-12"
      };
    case 'kawaii':
      return {
        container: "flex-1 p-4 sm:p-8 overflow-auto bg-[#fff0f5] text-[#555] font-sans custom-scrollbar scroll-smooth",
        prose: "prose prose-sm sm:prose-base max-w-3xl mx-auto " +
          "prose-headings:font-bold prose-headings:text-[#ff69b4] prose-headings:bg-white prose-headings:rounded-full prose-headings:px-6 prose-headings:py-2 prose-headings:shadow-sm prose-headings:border-2 prose-headings:border-[#ffb6c1] prose-headings:text-center " +
          "prose-a:text-[#00ced1] prose-a:font-bold hover:prose-a:text-[#ff69b4] " +
          "prose-p:bg-white prose-p:rounded-3xl prose-p:p-5 prose-p:shadow-sm prose-p:border-2 prose-p:border-[#ffefd5] " +
          "prose-pre:bg-[#f0f8ff] prose-pre:border-2 prose-pre:border-[#add8e6] prose-pre:rounded-3xl prose-pre:shadow-sm " +
          "prose-code:text-[#ff69b4] prose-code:bg-[#fff] prose-code:px-2 prose-code:py-0.5 prose-code:rounded-full prose-code:border prose-code:border-[#ffe4e1] " +
          "prose-img:rounded-3xl prose-img:border-4 prose-img:border-white prose-img:shadow-md " +
          "prose-blockquote:border-0 prose-blockquote:bg-[#ffe4e1] prose-blockquote:text-[#ff69b4] prose-blockquote:rounded-3xl prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:shadow-sm prose-blockquote:text-center prose-blockquote:font-medium " +
          "markdown-body pb-12"
      };
    case 'chalkboard':
      return {
        container: "flex-1 p-4 sm:p-8 overflow-auto bg-[#2b3a32] text-[#f4f4f0] font-['Comic_Neue','Comic_Sans_MS','Chalkboard_SE','Marker_Felt',sans-serif] custom-scrollbar scroll-smooth " +
          "bg-[radial-gradient(circle,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:10px_10px]",
        prose: "prose prose-sm sm:prose-base dark:prose-invert max-w-3xl mx-auto " +
          "prose-headings:font-['Comic_Neue','Comic_Sans_MS','Chalkboard_SE','Marker_Felt',sans-serif] prose-headings:text-[#f4f4f0] prose-headings:border-b-2 prose-headings:border-white/20 prose-headings:pb-2 prose-headings:drop-shadow-[1px_1px_1px_rgba(255,255,255,0.3)] " +
          "prose-a:text-[#ffdfba] hover:prose-a:text-[#ffffba] prose-a:underline prose-a:decoration-wavy " +
          "prose-p:text-[#e0e0e0] prose-strong:text-[#ffffba] " +
          "prose-pre:bg-[#1f2b25] prose-pre:border-2 prose-pre:border-white/10 prose-pre:rounded-sm " +
          "prose-code:text-[#bae1ff] prose-code:bg-[#1f2b25] prose-code:px-1.5 prose-code:py-0.5 prose-code:border border-white/20 " +
          "prose-blockquote:border-l-4 prose-blockquote:border-[#ffb3ba] prose-blockquote:bg-[#1f2b25] prose-blockquote:text-[#ffb3ba] prose-blockquote:py-2 prose-blockquote:px-4 " +
          "markdown-body pb-12"
      };
    case 'notebook':
    default:
      return {
        container: "flex-1 p-4 sm:p-8 overflow-auto bg-[#fdfaf6] text-slate-800 custom-scrollbar scroll-smooth bg-[linear-gradient(transparent_31px,#3b82f633_32px)] bg-[length:100%_32px]",
        prose: "prose prose-sm sm:prose-base max-w-3xl mx-auto font-['Comic_Neue','Comic_Sans_MS','Chalkboard_SE','Marker_Felt',sans-serif] " +
          "prose-headings:font-['Comic_Neue','Comic_Sans_MS','Chalkboard_SE','Marker_Felt',sans-serif] prose-headings:border-b-2 prose-headings:border-blue-300/30 prose-headings:pb-2 prose-headings:text-indigo-900 " +
          "prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline " +
          "prose-p:leading-8 prose-li:leading-8 prose-headings:leading-8 " +
          "prose-pre:p-0 prose-pre:bg-transparent prose-pre:border-0 " +
          "prose-code:bg-yellow-100 prose-code:text-slate-900 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none " +
          "prose-table:border prose-table:border-blue-200 prose-th:bg-blue-50 prose-th:p-2 prose-td:p-2 " +
          "prose-img:rounded-lg prose-img:shadow-md " +
          "prose-blockquote:border-l-4 prose-blockquote:border-red-400 prose-blockquote:bg-red-50/50 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:italic prose-blockquote:text-slate-700 " +
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
  const { activePreviewText, activePreviewPath, setActivePreviewText, updateNodeValue } = useStore();
  const [copied, setCopied] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'raw' | 'markdown' | 'html' | 'edit'>('raw');
  const [mdTheme, setMdTheme] = React.useState<string>(() => localStorage.getItem('mdTheme') || 'notebook-dark');
  const [mdFont, setMdFont] = React.useState<string>(() => localStorage.getItem('mdFont') || 'System Default');

  React.useEffect(() => {
    localStorage.setItem('mdTheme', mdTheme);
  }, [mdTheme]);

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
  const [showSettings, setShowSettings] = React.useState(false);
  const [activeHeadingId, setActiveHeadingId] = React.useState<string>('');
  const [keyboardLocked, setKeyboardLocked] = React.useState(false);

  const initializedPathRef = React.useRef<string | null>(null);
  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const outlineRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  
  const navHoldTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNavHoldRef = React.useRef(false);

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

  const headings = useMemo(() => extractHeadings(editText), [editText]);

  const markdownComponents = React.useMemo(() => ({
    pre: ({ children }: any) => <>{children}</>,
    code: ({ node, inline, className, children, ...props }: any) => (
      <CodeBlock inline={inline} className={className} theme={mdTheme} {...props}>
        {children}
      </CodeBlock>
    ),
    h1: (props: any) => <HeadingRenderer level={1} onHeadingClick={handleHeadingClick} {...props} />,
    h2: (props: any) => <HeadingRenderer level={2} onHeadingClick={handleHeadingClick} {...props} />,
    h3: (props: any) => <HeadingRenderer level={3} onHeadingClick={handleHeadingClick} {...props} />,
    h4: (props: any) => <HeadingRenderer level={4} onHeadingClick={handleHeadingClick} {...props} />,
    h5: (props: any) => <HeadingRenderer level={5} onHeadingClick={handleHeadingClick} {...props} />,
    h6: (props: any) => <HeadingRenderer level={6} onHeadingClick={handleHeadingClick} {...props} />,
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
    }
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
    } catch (e) {}
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
          className="fixed inset-0 z-[10000] flex items-center justify-center sm:p-4 bg-slate-950/90 backdrop-blur-sm"
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            className="relative w-full max-w-6xl h-[100dvh] sm:h-full max-h-none sm:max-h-[90vh] bg-slate-900 border-0 sm:border border-slate-800 shadow-2xl rounded-none sm:rounded-xl flex flex-col overflow-hidden"
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
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pl-4 pr-3 sm:pr-2 py-3 sm:py-2.5">
                    <div className="flex items-center gap-3 min-w-0 w-full sm:flex-1">
                      <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-md shrink-0">
                        <Type size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-white tracking-tight truncate">
                            {viewMode === 'edit' ? 'Editor' : (viewMode === 'markdown' ? 'Markdown' : (viewMode === 'html' ? 'HTML' : 'Raw View'))}
                          </h3>
                          <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700 font-mono uppercase shrink-0">
                            {activePreviewPath?.split('.').pop()}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono truncate max-w-[150px] sm:max-w-xs" title={activePreviewPath || ''}>
                          {activePreviewPath}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto">
                      {/* Mobile Outline Toggle */}
                      {viewMode === 'markdown' && headings.length > 0 && (
                        <button
                          onClick={() => setShowOutline(!showOutline)}
                          className="sm:hidden p-1.5 rounded-md transition-all text-slate-400 hover:text-white"
                        >
                          <Menu size={18} />
                        </button>
                      )}

                      {/* Mode Toggles */}
                      {viewMode === 'markdown' && (
                        <button
                          onClick={() => setShowSettings(!showSettings)}
                          className="p-1.5 rounded-md transition-all text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800"
                          title="Appearance Settings"
                        >
                          <Settings size={18} />
                        </button>
                      )}
                      <div className="flex bg-slate-950 rounded-lg p-0.5 border border-slate-800 shrink-0">
                        <button
                          onClick={() => setViewMode('raw')}
                          className={`p-1.5 rounded-md transition-all ${viewMode === 'raw' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                          title="Code View"
                        >
                          <FileText size={14} />
                        </button>
                        <button
                          onClick={() => setViewMode('markdown')}
                          className={`p-1.5 rounded-md transition-all ${viewMode === 'markdown' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                          title="Markdown Preview"
                        >
                          <Layout size={14} />
                        </button>
                        <button
                          onClick={() => setViewMode('html')}
                          className={`p-1.5 rounded-md transition-all ${viewMode === 'html' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                          title="HTML Preview"
                        >
                          <Globe size={14} />
                        </button>
                        <button
                          onClick={() => setViewMode('edit')}
                          className={`p-1.5 rounded-md transition-all ${viewMode === 'edit' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                          title="Edit Text"
                        >
                          <Edit3 size={14} />
                        </button>
                      </div>

                      <div className="h-4 w-[1px] bg-slate-800 mx-1 hidden sm:block" />

                      <div className="flex items-center gap-1">
                        <button
                          onClick={handleCopy}
                          className="p-1.5 sm:px-2.5 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors border border-slate-700 flex items-center gap-2"
                        >
                          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                          <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
                        </button>

                        <button
                          onClick={() => setActivePreviewText(null)}
                          className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Content Area with optional Sidebar */}
            <div className="flex-1 overflow-hidden flex flex-row bg-slate-950 relative min-w-0 w-full">

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
                    <motion.div
                      initial={{ x: -300, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: -300, opacity: 0 }}
                      className={`absolute sm:relative z-30 w-64 h-full bg-slate-900 border-r border-slate-800 flex flex-col ${showOutline ? 'block' : 'hidden sm:flex'}`}
                    >
                      <div className="p-3 border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0">
                        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                          <ListOrdered size={14} /> Outline
                        </h4>
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
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

              {/* Settings Sidebar (Right Drawer) */}
              <AnimatePresence>
                {showSettings && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-black/50 z-40"
                      onClick={() => setShowSettings(false)}
                    />
                    <motion.div
                      initial={{ x: 300, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 300, opacity: 0 }}
                      className="absolute right-0 top-0 bottom-0 z-50 w-64 bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl"
                    >
                      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur sticky top-0">
                        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                          <Settings size={14} /> Appearance
                        </h4>
                        <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white transition-colors">
                          <X size={18} />
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
                            className="w-full [&>button]:w-full [&>button]:py-2 [&>button]:px-3 [&>button]:bg-slate-950 [&>button]:border-slate-800 [&>button]:text-sm"
                          />
                        </div>

                        <div className="flex flex-col gap-2.5">
                          <label className="text-xs text-slate-400 font-medium">Theme</label>
                          <CustomSelect
                            value={mdTheme}
                            onChange={(val) => setMdTheme(val as any)}
                            options={[
                              { label: 'Notebook (Light)', value: 'notebook' },
                              { label: 'Notebook (Dark)', value: 'notebook-dark' },
                              { label: 'Default Dark', value: 'default-dark' },
                              { label: 'GitHub Light', value: 'github-light' },
                              { label: 'GitHub Dark', value: 'github-dark' },
                              { label: 'Borderlands', value: 'borderlands' },
                              { label: 'Comic Minimal', value: 'comic-minimal' },
                              { label: 'Anime Pastel', value: 'anime-pastel' },
                              { label: 'Manga Scan', value: 'manga-scan' },
                              { label: 'Cyberpunk 2077', value: 'cyberpunk' },
                              { label: 'Retro Arcade', value: 'retro-arcade' },
                              { label: 'Synthwave', value: 'synthwave' },
                              { label: 'Neubrutalism', value: 'neubrutalism' },
                              { label: 'Kawaii Cute', value: 'kawaii' },
                              { label: 'Chalkboard', value: 'chalkboard' }
                            ]}
                            className="w-full [&>button]:w-full [&>button]:py-2 [&>button]:px-3 [&>button]:bg-slate-950 [&>button]:border-slate-800 [&>button]:text-sm"
                          />
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
                        className={`p-1.5 rounded transition-colors shrink-0 flex items-center gap-1.5 ${
                          keyboardLocked 
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
                          className={`p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700 transition-colors flex items-center justify-center ${
                            showHeadingMenu ? 'bg-indigo-600/30 text-indigo-300' : ''
                          }`}
                          title="Insert H1 (# ) - Hold for H1-H6"
                        >
                          <Hash size={15} />
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setShowHeadingMenu(prev => !prev)}
                          className={`py-1.5 px-1 text-slate-400 hover:text-white hover:bg-slate-800 border-l border-slate-700/60 transition-colors flex items-center justify-center ${
                            showHeadingMenu ? 'bg-indigo-600/30 text-indigo-300' : ''
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

                    {/* Group 3: Navigation & Typing */}
                    <div className="flex items-center gap-0.5 shrink-0 bg-slate-950/60 p-0.5 rounded-md border border-slate-800/80">
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
                      <div className="w-px h-3 bg-slate-800/80 mx-0.5 shrink-0" />
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
                <div ref={contentRef} className={getThemeClasses(mdTheme).container}>
                  <div
                    className={getThemeClasses(mdTheme).prose}
                    style={mdFont !== 'System Default' ? { fontFamily: `'${mdFont}', sans-serif` } : undefined}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex, customRehypeSlug]}
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
                <div className="flex-1 overflow-auto bg-slate-950 custom-scrollbar">
                  <pre className="p-4 sm:p-6 font-mono text-sm text-slate-300 leading-relaxed whitespace-pre-wrap break-words min-h-full selection:bg-indigo-500/30">
                    {editText}
                  </pre>
                </div>
              )}

              {/* Floating Quick Edit Button when Header is Hidden */}
              <AnimatePresence>
                {!showHeader && viewMode !== 'edit' && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.85, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85, y: 10 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => setViewMode('edit')}
                    className="absolute bottom-4 right-4 z-40 flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-full shadow-xl shadow-indigo-950/60 border border-indigo-400/40 text-xs font-semibold backdrop-blur transition-all active:scale-95"
                    title="Switch to Editor"
                  >
                    <Edit3 size={14} />
                    <span>Edit</span>
                  </motion.button>
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
