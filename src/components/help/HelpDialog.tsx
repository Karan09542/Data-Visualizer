import React, { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, Check, Copy, Plus, type LucideIcon } from 'lucide-react';
import { useStore, getEffectiveTheme } from '../../store/useStore';

/*
 * One dialog for every help popup in the app. Each popup is just a HelpContent object
 * (see helpContent.ts); this file owns how all of them look and behave.
 *
 * Text fields are plain strings so search can read them. Wrap code in backticks
 * (`_api_node`) and it renders as inline code.
 */

export type HelpTone = 'indigo' | 'amber' | 'blue' | 'emerald' | 'rose' | 'purple' | 'cyan';

export type HelpBlock =
  /** A short highlighted explanation, usually the first thing in a section */
  | { type: 'callout'; title?: string; text: string }
  /** Keyboard or gesture shortcuts: label on the left, keys on the right */
  | { type: 'shortcuts'; items: { keys: string[]; label: string }[] }
  /** Syntax examples: code on the left, what it does on the right */
  | { type: 'syntax'; items: { code: string; label: string }[] }
  /** Feature cards in a two-column grid */
  | { type: 'cards'; items: { icon: LucideIcon; title: string; text: string }[] }
  /** A copyable code sample */
  | { type: 'code'; title?: string; language?: string; code: string }
  /**
   * Formulas or snippets to copy, each optionally with a rendered preview (see renderPreview) and a
   * payload for the dialog's exampleAction, such as "Insert into graph"
   */
  | { type: 'examples'; items: HelpExample[] };

export interface HelpExample {
  code: string;
  title?: string;
  text?: string;
  /** Source for renderPreview, e.g. LaTeX */
  preview?: string;
  /** Handed to exampleAction.onRun; items without one only offer Copy */
  payload?: unknown;
}

export interface HelpSection {
  id: string;
  title: string;
  icon: LucideIcon;
  tone?: HelpTone;
  description?: string;
  blocks: HelpBlock[];
}

export interface HelpContent {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  sections: HelpSection[];
  /** A shortcut worth remembering, shown at the bottom left */
  footerHint?: { keys: string[]; label: string };
}

export interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
  content: HelpContent;
  /** An optional extra button beside "Done", such as inserting an example */
  action?: { label: string; icon?: LucideIcon; onClick: () => void };
  /** A button on each example that has a payload, e.g. "Insert" into the open graph */
  exampleAction?: { label: string; icon?: LucideIcon; onRun: (payload: unknown) => void };
  /** Draws an example's preview, e.g. LaTeX with KaTeX; kept out of here so other help needs no KaTeX */
  renderPreview?: (preview: string) => React.ReactNode;
  /** Stacking order, for dialogs opened over something already high (a fullscreen editor) */
  zIndex?: number;
}

const ExampleContext = createContext<Pick<HelpDialogProps, 'exampleAction' | 'renderPreview'>>({});

/** A small button that briefly confirms what it did */
const ConfirmButton: React.FC<{
  onClick: () => void | Promise<void>;
  icon: LucideIcon;
  label: string;
  done: string;
  primary?: boolean;
}> = ({ onClick, icon: Icon, label, done, primary }) => {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await onClick();
          setConfirmed(true);
          setTimeout(() => setConfirmed(false), 1500);
        } catch {
          // Clipboard can be blocked; the text stays selectable
        }
      }}
      className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-all ${
        primary
          ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm shadow-indigo-500/20 active:scale-95'
          : 'text-slate-600 dark:text-slate-300 bg-slate-100/90 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/80 hover:text-slate-900 dark:hover:text-white border border-slate-200/70 dark:border-slate-700/60'
      }`}
      aria-label={label}
      title={label}
    >
      {confirmed ? <Check size={13} className={primary ? '' : 'text-emerald-500'} /> : <Icon size={13} />}
      <span className={primary ? '' : 'sr-only sm:not-sr-only'}>{confirmed ? done : label}</span>
    </button>
  );
};

const Examples: React.FC<{ items: HelpExample[]; codeClass: string }> = ({ items, codeClass }) => {
  const { exampleAction, renderPreview } = useContext(ExampleContext);
  return (
    <ul className="divide-y divide-slate-200/80 rounded-xl border border-slate-200/90 bg-slate-50/40 dark:divide-slate-800/80 dark:border-slate-800 dark:bg-slate-800/20">
      {items.map((item, i) => (
        <li key={i} className="space-y-2 px-3.5 py-3">
          {(item.title || item.text) && (
            <div>
              {item.title && <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>}
              {item.text && (
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-400">
                  <RichText text={item.text} />
                </p>
              )}
            </div>
          )}
          <div className="flex items-start gap-1.5">
            <div className="min-w-0 flex-1 rounded-lg bg-slate-100/70 p-2.5 border border-slate-200/60 dark:bg-slate-950/60 dark:border-slate-800/60">
              {item.preview && renderPreview && (
                <div className="mb-1.5 overflow-x-auto text-[15px] text-slate-900 dark:text-slate-100">{renderPreview(item.preview)}</div>
              )}
              <code className={`block whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed ${codeClass}`}>{item.code}</code>
            </div>
            <ConfirmButton onClick={() => navigator.clipboard.writeText(item.code)} icon={Copy} label="Copy" done="Copied" />
            {exampleAction && item.payload !== undefined && (
              <ConfirmButton
                onClick={() => exampleAction.onRun(item.payload)}
                icon={exampleAction.icon ?? Plus}
                label={exampleAction.label}
                done="Added"
                primary
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
};

/** Tailwind needs whole class names, so each tone spells its classes out */
const TONES: Record<HelpTone, { icon: string; soft: string; code: string }> = {
  indigo: {
    icon: 'text-indigo-600 dark:text-indigo-400',
    soft: 'bg-indigo-50/80 border-indigo-200/80 dark:bg-indigo-950/30 dark:border-indigo-800/50',
    code: 'text-indigo-600 dark:text-indigo-300',
  },
  amber: {
    icon: 'text-amber-600 dark:text-amber-400',
    soft: 'bg-amber-50/80 border-amber-200/80 dark:bg-amber-950/30 dark:border-amber-800/50',
    code: 'text-amber-600 dark:text-amber-300',
  },
  blue: {
    icon: 'text-sky-600 dark:text-sky-400',
    soft: 'bg-sky-50/80 border-sky-200/80 dark:bg-sky-950/30 dark:border-sky-800/50',
    code: 'text-sky-600 dark:text-sky-300',
  },
  emerald: {
    icon: 'text-emerald-600 dark:text-emerald-400',
    soft: 'bg-emerald-50/80 border-emerald-200/80 dark:bg-emerald-950/30 dark:border-emerald-800/50',
    code: 'text-emerald-600 dark:text-emerald-300',
  },
  rose: {
    icon: 'text-rose-600 dark:text-rose-400',
    soft: 'bg-rose-50/80 border-rose-200/80 dark:bg-rose-950/30 dark:border-rose-800/50',
    code: 'text-rose-600 dark:text-rose-300',
  },
  purple: {
    icon: 'text-purple-600 dark:text-purple-400',
    soft: 'bg-purple-50/80 border-purple-200/80 dark:bg-purple-950/30 dark:border-purple-800/50',
    code: 'text-purple-600 dark:text-purple-300',
  },
  cyan: {
    icon: 'text-cyan-600 dark:text-cyan-400',
    soft: 'bg-cyan-50/80 border-cyan-200/80 dark:bg-cyan-950/30 dark:border-cyan-800/50',
    code: 'text-cyan-600 dark:text-cyan-300',
  },
};

const SURFACE = 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl';
const LINE = 'border-slate-200/90 dark:border-slate-800/80';
const MUTED = 'text-slate-500 dark:text-slate-400';

/** Turns `backticks` into inline code */
const RichText: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(/(`[^`]+`)/g).map((part, i) =>
      part.startsWith('`') && part.endsWith('`') ? (
        <code
          key={i}
          className="rounded-md bg-slate-100 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60 px-1.5 py-0.5 font-mono text-[0.85em] text-slate-800 dark:text-slate-200 font-medium"
        >
          {part.slice(1, -1)}
        </code>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      ),
    )}
  </>
);

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-b-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-200 shadow-xs">
    {children}
  </kbd>
);

const Keys: React.FC<{ keys: string[] }> = ({ keys }) => (
  <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
    {keys.map((k, i) => (
      <React.Fragment key={i}>
        {i > 0 && <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">+</span>}
        <Kbd>{k}</Kbd>
      </React.Fragment>
    ))}
  </span>
);

const CodeSample: React.FC<{ block: Extract<HelpBlock, { type: 'code' }> }> = ({ block }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(block.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (insecure origin, denied permission); the text is still selectable
    }
  };
  return (
    <div className={`overflow-hidden rounded-xl border ${LINE}`}>
      <div className={`flex items-center justify-between gap-2 border-b ${LINE} bg-slate-100/70 px-3.5 py-1.5 dark:bg-slate-800/60`}>
        <span className={`truncate text-xs font-semibold ${MUTED}`}>
          {block.title ?? 'Example'}
          {block.language && <span className="ml-2 font-mono text-[10px] uppercase opacity-70 tracking-wider">{block.language}</span>}
        </span>
        <button
          onClick={copy}
          className={`flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium ${MUTED} transition-colors hover:bg-slate-200/70 hover:text-slate-900 dark:hover:bg-slate-700/70 dark:hover:text-white`}
          aria-label="Copy example"
        >
          {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="custom-scrollbar overflow-x-auto bg-slate-50/80 p-3.5 font-mono text-[12px] leading-relaxed text-slate-800 dark:bg-slate-950/70 dark:text-slate-200">
        {block.code}
      </pre>
    </div>
  );
};

const Block: React.FC<{ block: HelpBlock; tone: HelpTone }> = ({ block, tone }) => {
  const t = TONES[tone];
  switch (block.type) {
    case 'callout':
      return (
        <div className={`rounded-xl border p-4 text-[13px] leading-relaxed text-slate-700 dark:text-slate-300 shadow-xs ${t.soft}`}>
          {block.title && <p className="mb-1 font-semibold text-slate-900 dark:text-slate-100">{block.title}</p>}
          <RichText text={block.text} />
        </div>
      );

    case 'shortcuts':
      return (
        <ul className={`divide-y rounded-xl border ${LINE} divide-slate-200/80 dark:divide-slate-800/80 bg-slate-50/40 dark:bg-slate-800/20`}>
          {block.items.map((item, i) => (
            <li key={i} className="flex min-h-11 items-center justify-between gap-4 px-3.5 py-2">
              <span className="text-[13px] text-slate-700 dark:text-slate-300">
                <RichText text={item.label} />
              </span>
              <Keys keys={item.keys} />
            </li>
          ))}
        </ul>
      );

    case 'syntax':
      return (
        <ul className={`divide-y rounded-xl border ${LINE} divide-slate-200/80 dark:divide-slate-800/80 bg-slate-50/40 dark:bg-slate-800/20`}>
          {block.items.map((item, i) => (
            <li key={i} className="flex flex-col gap-1 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <code className={`font-mono text-[12.5px] font-medium ${t.code} bg-slate-100/70 dark:bg-slate-950/50 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-800/60 w-fit`}>{item.code}</code>
              <span className={`text-[12.5px] sm:text-right ${MUTED}`}>
                <RichText text={item.label} />
              </span>
            </li>
          ))}
        </ul>
      );

    case 'cards':
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {block.items.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className={`rounded-xl border ${LINE} bg-slate-50/60 dark:bg-slate-800/30 p-3.5 hover:border-slate-300 dark:hover:border-slate-700/80 transition-all shadow-xs`}>
                <div className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                  <div className="p-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/50 shadow-xs">
                    <Icon size={14} className={t.icon} />
                  </div>
                  {item.title}
                </div>
                <p className={`text-[12.5px] leading-relaxed ${MUTED}`}>
                  <RichText text={item.text} />
                </p>
              </div>
            );
          })}
        </div>
      );

    case 'code':
      return <CodeSample block={block} />;

    case 'examples':
      return <Examples items={block.items} codeClass={t.code} />;
  }
};

/** Keeps a section whose title matches, otherwise only the rows that match */
const filterSections = (sections: HelpSection[], query: string): HelpSection[] => {
  const q = query.trim();
  if (!q) return sections;
  // Match from the start of a word, so "pen" finds "Pen" but not "Open"
  const pattern = new RegExp(`(^|[^a-z0-9])${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
  const has = (...parts: (string | undefined)[]) => parts.some((p) => p !== undefined && pattern.test(p));

  return sections.flatMap((section) => {
    if (has(section.title, section.description)) return [section];
    const blocks = section.blocks.flatMap((block): HelpBlock[] => {
      switch (block.type) {
        case 'callout':
          return has(block.title, block.text) ? [block] : [];
        case 'code':
          return has(block.title, block.code) ? [block] : [];
        case 'shortcuts': {
          const items = block.items.filter((i) => has(i.label, ...i.keys));
          return items.length ? [{ ...block, items }] : [];
        }
        case 'syntax': {
          const items = block.items.filter((i) => has(i.code, i.label));
          return items.length ? [{ ...block, items }] : [];
        }
        case 'cards': {
          const items = block.items.filter((i) => has(i.title, i.text));
          return items.length ? [{ ...block, items }] : [];
        }
        case 'examples': {
          const items = block.items.filter((i) => has(i.title, i.text, i.code));
          return items.length ? [{ ...block, items }] : [];
        }
      }
    });
    return blocks.length ? [{ ...section, blocks }] : [];
  });
};

export default function HelpDialog({ open, onClose, content, action, exampleAction, renderPreview, zIndex }: HelpDialogProps) {
  const rawAppTheme = useStore((s) => s.appTheme);
  const systemTheme = useStore((s) => s.systemTheme);
  const effectiveTheme = getEffectiveTheme(rawAppTheme, systemTheme);
  const isDark = effectiveTheme === 'dark';

  const titleId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState(content.sections[0]?.id);

  const sections = useMemo(() => filterSections(content.sections, query), [content.sections, query]);
  const showNav = content.sections.length > 1;

  // Start fresh each time it opens
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveId(content.sections[0]?.id);
    panelRef.current?.focus();
  }, [open, content.sections]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  /** Highlights whichever section is at the top of the scroll area */
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
    let current = sections[0]?.id;
    for (const s of sections) {
      const node = el.querySelector<HTMLElement>(`[data-section="${s.id}"]`);
      if (node && node.offsetTop - el.scrollTop <= 24) current = s.id;
    }
    if (atBottom && sections.length) current = sections[sections.length - 1].id;
    setActiveId(current);
  };

  const jumpTo = (id: string) => {
    const el = scrollRef.current;
    const node = el?.querySelector<HTMLElement>(`[data-section="${id}"]`);
    if (!el || !node) return;
    setActiveId(id);
    el.scrollTo({ top: node.offsetTop - 8, behavior: 'smooth' });
  };

  const navItem = (s: HelpSection, compact: boolean) => {
    const Icon = s.icon;
    const isActive = activeId === s.id;
    const tone = TONES[s.tone ?? 'indigo'];
    return (
      <button
        key={s.id}
        onClick={() => jumpTo(s.id)}
        aria-current={isActive ? 'true' : undefined}
        className={
          compact
            ? `flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-all ${
                isActive
                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:bg-slate-800'
              }`
            : `flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] font-medium transition-all ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200/60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/50 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200 border border-transparent'
              }`
        }
      >
        <Icon size={compact ? 13 : 15} className={isActive ? tone.icon : 'opacity-70'} />
        <span className="truncate">{s.title}</span>
      </button>
    );
  };

  const HeaderIcon = content.icon;
  const ActionIcon = action?.icon;

  return createPortal(
    <div className={isDark ? "dark font-sans" : "font-sans"}>
      <AnimatePresence>
        {open && (
          <div
            className="fixed inset-0 z-10000 flex items-end justify-center sm:items-center sm:p-6"
            style={zIndex ? { zIndex } : undefined}
            // The popups open from inside the canvas; keep its pan and zoom from reacting
            onWheel={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-slate-950/60 dark:bg-slate-950/75 backdrop-blur-sm"
              onClick={onClose}
            />

            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className={`relative flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border ${LINE} ${SURFACE} text-slate-900 shadow-2xl shadow-slate-950/50 outline-none dark:text-slate-100 sm:h-[min(720px,88vh)] sm:max-w-4xl sm:rounded-2xl`}
            >
              {/* Header */}
              <header className={`flex shrink-0 flex-col gap-3 border-b ${LINE} bg-slate-50/70 px-4 pb-3 pt-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5 dark:bg-slate-900/80 backdrop-blur-md`}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/20 shadow-xs">
                    <HeaderIcon size={18} />
                  </div>
                  <div className="min-w-0">
                    <h2 id={titleId} className="truncate text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                      {content.title}
                    </h2>
                    {content.subtitle && <p className={`truncate text-xs ${MUTED}`}>{content.subtitle}</p>}
                  </div>
                  <button
                    onClick={onClose}
                    className={`ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${MUTED} transition-colors hover:bg-slate-200/60 hover:text-slate-900 dark:hover:bg-slate-800/80 dark:hover:text-white sm:hidden`}
                    aria-label="Close"
                  >
                    <X size={19} />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-64 sm:flex-none">
                    <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search this guide"
                      aria-label="Search this guide"
                      className={`h-9 w-full rounded-lg border ${LINE} bg-white dark:bg-slate-950/70 pl-9 pr-3 text-[13px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30`}
                    />
                  </div>
                  <button
                    onClick={onClose}
                    className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg ${MUTED} transition-colors hover:bg-slate-200/60 hover:text-slate-900 dark:hover:bg-slate-800/80 dark:hover:text-white sm:flex`}
                    aria-label="Close"
                    title="Close (Esc)"
                  >
                    <X size={19} />
                  </button>
                </div>
              </header>

              {/* Section chips on phones */}
              {showNav && !query && (
                <nav className={`flex shrink-0 gap-1.5 overflow-x-auto border-b ${LINE} bg-slate-50/50 dark:bg-slate-900/50 px-4 py-2 [scrollbar-width:none] md:hidden`}>
                  {content.sections.map((s) => navItem(s, true))}
                </nav>
              )}

              <div className="flex min-h-0 flex-1">
                {/* Section list on wider screens */}
                {showNav && (
                  <nav className={`custom-scrollbar hidden w-56 shrink-0 flex-col gap-0.5 overflow-y-auto border-r ${LINE} bg-slate-50/40 dark:bg-slate-900/30 p-3 md:flex`}>
                    <p className={`px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500`}>On this page</p>
                    {(query ? sections : content.sections).map((s) => navItem(s, false))}
                  </nav>
                )}

                <div
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="custom-scrollbar relative min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 bg-white dark:bg-slate-900/40"
                >
                  {sections.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <Search size={24} className="text-slate-300 dark:text-slate-600 mb-1" />
                      <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">Nothing matches “{query}”</p>
                      <p className={`mt-1 text-xs ${MUTED}`}>Try a shorter word, or clear the search.</p>
                    </div>
                  ) : (
                    <div className="mx-auto flex max-w-2xl flex-col gap-9">
                      {sections.map((s) => {
                        const Icon = s.icon;
                        const tone = s.tone ?? 'indigo';
                        return (
                          <section key={s.id} data-section={s.id} className="scroll-mt-2">
                            <div className="mb-3 flex items-center gap-2">
                              <Icon size={16} className={TONES[tone].icon} />
                              <h3 className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">{s.title}</h3>
                            </div>
                            {s.description && (
                              <p className={`-mt-1 mb-3 text-[13px] leading-relaxed ${MUTED}`}>
                                <RichText text={s.description} />
                              </p>
                            )}
                            <div className="flex flex-col gap-3">
                              <ExampleContext.Provider value={{ exampleAction, renderPreview }}>
                                {s.blocks.map((b, i) => (
                                  <Block key={i} block={b} tone={tone} />
                                ))}
                              </ExampleContext.Provider>
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <footer className={`flex shrink-0 items-center justify-between gap-3 border-t ${LINE} bg-slate-50/70 px-4 py-3 pb-[max(env(safe-area-inset-bottom),12px)] sm:px-5 dark:bg-slate-900/80 backdrop-blur-md`}>
                <div className={`hidden min-w-0 items-center gap-2 text-xs sm:flex ${MUTED}`}>
                  {content.footerHint ? (
                    <>
                      <Keys keys={content.footerHint.keys} />
                      <span className="truncate">{content.footerHint.label}</span>
                    </>
                  ) : (
                    <>
                      <Kbd>Esc</Kbd>
                      <span>to close</span>
                    </>
                  )}
                </div>
                <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
                  {action && (
                    <button
                      onClick={action.onClick}
                      className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 px-3.5 text-[13px] font-medium text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 sm:flex-none`}
                    >
                      {ActionIcon && <ActionIcon size={15} />}
                      {action.label}
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="h-9 flex-1 rounded-lg bg-indigo-600 px-6 text-[13px] font-semibold text-white shadow-md shadow-indigo-500/25 transition-all hover:bg-indigo-500 active:scale-[0.98] sm:flex-none"
                  >
                    Done
                  </button>
                </div>
              </footer>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
