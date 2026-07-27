import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Copy, Check, Type, Edit3, Save, FileText, Layout, Globe,
  Bold, Italic, List, Link as LinkIcon, Code, ListOrdered, Hash, ChevronRight, ChevronDown, ListTodo, Menu
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Highlight, themes } from 'prism-react-renderer';

// Types for Document Outline
interface Heading {
  id: string;
  text: string;
  level: number;
}

const CodeBlock = ({ children, className }: any) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const code = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!match) {
    return (
      <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-sm font-mono text-slate-800 dark:text-slate-200">
        {children}
      </code>
    );
  }

  return (
    <div className="relative group rounded-lg overflow-hidden my-4 border border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <span className="text-xs font-mono text-slate-500 uppercase">{language}</span>
        <button
          onClick={handleCopy}
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded transition-colors"
          title="Copy code"
        >
          {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
        </button>
      </div>
      <Highlight theme={themes.vsDark} code={code} language={language}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre className="p-4 overflow-x-auto bg-[#1e1e1e] text-[13px] font-mono leading-relaxed" style={{ ...style, backgroundColor: '#1e1e1e' }}>
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

  lines.forEach((line) => {
    if (codeBlockRegex.test(line)) {
      inCodeBlock = !inCodeBlock;
    }
    if (!inCodeBlock) {
      const match = line.match(/^(#{1,4})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const rawText = match[2];
        // Remove simple markdown formatting from heading text for the outline
        const cleanText = rawText.replace(/[*_~`]/g, '').trim();
        // Generate a URL-friendly slug
        const id = cleanText.toLowerCase().replace(/[^\w]+/g, '-').replace(/(^-|-$)/g, '');
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

const HeadingRenderer = (props: any) => {
  const children = React.Children.toArray(props.children);
  const text = (children.reduce(flatten, '') as string) || '';
  // the ID here should match the one generated in extractHeadings. We can approximate or just use the text.
  // Actually, to make them match exactly, it's tricky without a shared counter. 
  // Let's use a simpler slug and assume users don't have exactly duplicate headers, 
  // or use the text + position if we could.
  // For simplicity, we just slugify the text here. It might break if there are exact duplicates.
  const slug = text.toLowerCase().replace(/[^\w]+/g, '-').replace(/(^-|-$)/g, '');
  const id = props.id || slug; // if remark-slug was used, props.id would be there
  return React.createElement(`h${props.level}`, { id, className: 'scroll-mt-20 group relative' }, [
    <a href={`#${id}`} key="anchor" className="absolute -left-6 top-1 opacity-0 group-hover:opacity-100 text-slate-400 hidden sm:block">
      <LinkIcon size={16} />
    </a>,
    ...children
  ]);
};


const TextPreviewPopup: React.FC = () => {
  const { activePreviewText, activePreviewPath, setActivePreviewText, updateNodeValue } = useStore();
  const [copied, setCopied] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'raw' | 'markdown' | 'html' | 'edit'>('raw');
  const [editText, setEditText] = React.useState('');
  const [showOutline, setShowOutline] = React.useState(false);
  const [activeHeadingId, setActiveHeadingId] = React.useState<string>('');

  const initializedPathRef = React.useRef<string | null>(null);
  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (!activePreviewPath) {
      initializedPathRef.current = null;
      return;
    }
    
    if (activePreviewText && activePreviewPath !== initializedPathRef.current) {
      initializedPathRef.current = activePreviewPath;
      setEditText(activePreviewText);
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
  }, [activePreviewText, activePreviewPath]);

  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Update active heading based on scroll
  React.useEffect(() => {
    if (viewMode !== 'markdown') return;

    const handleScroll = () => {
      if (!contentRef.current) return;
      const headings = Array.from(contentRef.current.querySelectorAll('h1, h2, h3, h4'));
      let currentActiveId = '';
      
      for (const heading of headings) {
        const rect = heading.getBoundingClientRect();
        if (rect.top <= 100) { // Offset for the sticky header
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

  if (!activePreviewText) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(editText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    }, 0);
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

  // Generate ID for markdown renderer
  // We apply a little trick: remark-slug or custom heading renderer is needed.
  // We wrote HeadingRenderer above. We'll pass it to components.

  return createPortal(
    <AnimatePresence>
      {activePreviewText && (
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
            {/* Header */}
            <div className="flex flex-row items-center justify-between gap-3 pl-4 pr-2 py-2 sm:py-2.5 bg-slate-900 border-b border-slate-800 shrink-0 relative z-10">
              <div className="flex items-center gap-3 min-w-0 flex-1">
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
              
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
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

            {/* Content Area with optional Sidebar */}
            <div className="flex-1 overflow-hidden flex flex-row bg-slate-950 relative">
              
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
                      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                        {headings.map((h, i) => {
                          const isActive = activeHeadingId === h.id || activeHeadingId.startsWith(h.id);
                          return (
                            <a
                              key={i}
                              href={`#${h.id}`}
                              onClick={(e) => {
                                e.preventDefault();
                                const el = document.getElementById(h.id);
                                if (el && contentRef.current) {
                                  const container = contentRef.current;
                                  const containerTop = container.getBoundingClientRect().top;
                                  const elTop = el.getBoundingClientRect().top;
                                  // Scroll the container, not window
                                  container.scrollTo({
                                    top: container.scrollTop + (elTop - containerTop) - 20,
                                    behavior: 'smooth'
                                  });
                                  setActiveHeadingId(h.id);
                                }
                                if (window.innerWidth < 640) setShowOutline(false);
                              }}
                              className={`block py-1.5 px-2 rounded-md text-sm truncate transition-colors ${
                                isActive ? 'bg-indigo-500/10 text-indigo-400 font-medium' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
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

              {/* Main Content Pane */}
              {viewMode === 'edit' ? (
                <div className="flex-1 p-3 sm:p-4 flex flex-col gap-3 relative bg-slate-950">
                  {/* Formatting Toolbar */}
                  <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg shrink-0">
                    <button onClick={() => insertTextAtCursor('**', '**')} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded" title="Bold"><Bold size={16} /></button>
                    <button onClick={() => insertTextAtCursor('*', '*')} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded" title="Italic"><Italic size={16} /></button>
                    <div className="w-px h-4 bg-slate-700 mx-1"></div>
                    <button onClick={() => insertTextAtCursor('# ', '')} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded" title="Heading"><Hash size={16} /></button>
                    <button onClick={() => insertTextAtCursor('- ', '')} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded" title="Bullet List"><List size={16} /></button>
                    <button onClick={() => insertTextAtCursor('1. ', '')} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded" title="Numbered List"><ListOrdered size={16} /></button>
                    <button onClick={() => insertTextAtCursor('- [ ] ', '')} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded" title="Task List"><ListTodo size={16} /></button>
                    <div className="w-px h-4 bg-slate-700 mx-1"></div>
                    <button onClick={() => insertTextAtCursor('[](', ')')} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded" title="Link"><LinkIcon size={16} /></button>
                    <button onClick={() => insertTextAtCursor('`', '`')} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded" title="Inline Code"><Code size={16} /></button>
                    <button onClick={() => insertTextAtCursor('```\n', '\n```')} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded" title="Code Block">
                      <div className="flex flex-col gap-0.5 items-center justify-center h-4 w-4"><Code size={12}/><Code size={12}/></div>
                    </button>
                  </div>
                  <textarea
                    ref={textareaRef}
                    autoFocus
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
                <div ref={contentRef} className="flex-1 p-4 sm:p-8 overflow-auto bg-white dark:bg-[#0d1117] custom-scrollbar scroll-smooth">
                  <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-3xl mx-auto
                                prose-headings:tracking-tight prose-headings:border-b prose-headings:border-slate-200 dark:prose-headings:border-slate-800/50 prose-headings:pb-2
                                prose-a:text-indigo-500 dark:prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline
                                prose-pre:p-0 prose-pre:bg-transparent prose-pre:border-0
                                prose-code:text-indigo-600 dark:prose-code:text-indigo-400 prose-code:bg-indigo-50 dark:prose-code:bg-indigo-500/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
                                prose-table:border prose-table:border-slate-200 dark:prose-table:border-slate-800 prose-th:bg-slate-50 dark:prose-th:bg-slate-900 prose-th:p-2 prose-td:p-2
                                prose-img:rounded-lg prose-img:shadow-sm
                                prose-blockquote:border-l-4 prose-blockquote:border-indigo-500 prose-blockquote:bg-indigo-50 dark:prose-blockquote:bg-indigo-500/10 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:not-italic prose-blockquote:text-slate-700 dark:prose-blockquote:text-slate-300
                                markdown-body pb-32">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        code: CodeBlock,
                        h1: (props) => <HeadingRenderer level={1} {...props} />,
                        h2: (props) => <HeadingRenderer level={2} {...props} />,
                        h3: (props) => <HeadingRenderer level={3} {...props} />,
                        h4: (props) => <HeadingRenderer level={4} {...props} />,
                        h5: (props) => <HeadingRenderer level={5} {...props} />,
                        h6: (props) => <HeadingRenderer level={6} {...props} />,
                        table: ({node, ...props}) => (
                          <div className="overflow-x-auto my-6 rounded-lg border border-slate-200 dark:border-slate-800">
                            <table className="w-full text-left border-collapse m-0" {...props} />
                          </div>
                        ),
                        input: ({node, ...props}) => {
                          if (props.type === 'checkbox') {
                            return <input type="checkbox" className="mr-2 rounded text-indigo-500 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700" {...props} disabled={false} readOnly />
                          }
                          return <input {...props} />
                        }
                      }}
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
