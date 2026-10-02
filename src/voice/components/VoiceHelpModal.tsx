import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Search, Sparkles, Trash2, Compass, ScanSearch, Palette, PanelsTopLeft, FileUp, MousePointerClick, MessageCircle, CheckCircle2 } from 'lucide-react';
import { useVoiceStore } from '../useVoiceStore';
import { CommandRegistry, VOICE_GROUPS, type VoiceCommand, type VoiceGroup } from '../CommandRegistry';
import { TOTAL_BYTES } from '../semantic/modelStore';
import { prepare, refreshStatus, removeModel } from '../semantic/SemanticMatcher';
import { VoiceSpirit3D } from './VoiceSpirit3D';

const MODEL_MB = Math.round(TOTAL_BYTES / 1e6);

const GROUPS: Record<VoiceGroup, { label: string; icon: React.FC<{ className?: string }> }> = {
  navigate: { label: 'Navigate', icon: Compass },
  view: { label: 'View', icon: ScanSearch },
  look: { label: 'Look', icon: Palette },
  panels: { label: 'Panels', icon: PanelsTopLeft },
  files: { label: 'Files', icon: FileUp },
};

/** How a wildcard reads in a phrase: "go to ‹node›". `*args` is an optional extra ("zoom in 2 times"). */
const PLACEHOLDERS: Record<string, string> = {
  node: 'node', query: 'words', format: 'format', fmt: 'format',
  layout: 'layout', theme: 'theme', edge: 'style', shape: 'shape', args: '…',
};

/** A spoken phrase, with its wildcard shown as a placeholder. */
const Phrase: React.FC<{ text: string }> = ({ text }) => (
  <span className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-2.5 py-1 text-[13px] font-medium text-slate-800 dark:text-slate-100">
    <span className="-mr-1 text-cyan-600/70 dark:text-cyan-300/70">“</span>
    {text.split(/(\*\w+)/).filter(Boolean).map((part, i) =>
      part.startsWith('*') ? (
        <span key={i} className="rounded bg-violet-500/15 px-1.5 text-[12px] font-semibold text-violet-700 dark:text-violet-300">
          {PLACEHOLDERS[part.slice(1)] ?? part.slice(1)}
        </span>
      ) : (
        <span key={i}>{part.trim()}</span>
      ),
    )}
    <span className="-ml-1 text-cyan-600/70 dark:text-cyan-300/70">”</span>
  </span>
);

/** The phrase to lead with: the first that needs nothing extra, or else the first. */
const primaryPhrase = (cmd: VoiceCommand) => cmd.phrases.find((p) => !p.includes('*args')) ?? cmd.phrases[0];

const CommandCard: React.FC<{ cmd: VoiceCommand }> = ({ cmd }) => {
  const [open, setOpen] = useState(false);
  const primary = primaryPhrase(cmd);
  const others = cmd.phrases.filter((p) => p !== primary);

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:border-cyan-400/50 dark:border-slate-700/60 dark:bg-slate-800/40 dark:hover:border-cyan-400/40">
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{cmd.title ?? primary.replace(/\*\w+/g, '').trim()}</p>
      {cmd.description && <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{cmd.description}</p>}

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <Phrase text={primary} />
        {cmd.example && cmd.example !== primary && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            e.g. <span className="font-medium text-slate-700 dark:text-slate-300">“{cmd.example}”</span>
          </span>
        )}
      </div>

      {cmd.options && (
        <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-600 dark:text-slate-300">Values: </span>
          {cmd.options.join(', ')}
        </p>
      )}

      {others.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="text-xs font-medium text-cyan-700 hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200"
          >
            {open ? 'Fewer ways to say it' : `+${others.length} more way${others.length > 1 ? 's' : ''} to say it`}
          </button>
          {open && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {others.map((p) => <Phrase key={p} text={p} />)}
            </div>
          )}
        </div>
      )}
    </li>
  );
};

/** On/off, status and removal for matching commands by meaning (see semantic/SemanticMatcher). */
const SmartMatchingRow: React.FC = () => {
  const smartMatching = useVoiceStore((s) => s.smartMatching);
  const setSmartMatching = useVoiceStore((s) => s.setSmartMatching);
  const status = useVoiceStore((s) => s.matcherStatus);
  const progress = useVoiceStore((s) => s.matcherProgress);
  const error = useVoiceStore((s) => s.matcherError);

  useEffect(() => {
    void refreshStatus();
  }, []);

  const toggle = () => {
    setSmartMatching(!smartMatching);
    if (!smartMatching) void prepare();
  };

  const statusText =
    status === 'downloading' ? `Downloading the model… ${Math.round(progress * 100)}%`
    : status === 'loading' ? 'Loading the model…'
    : status === 'ready' ? 'Ready'
    : status === 'stored' ? `Downloaded (${MODEL_MB} MB), starts with the mic`
    : status === 'error' ? `Not available: ${error}`
    : `Downloads a ${MODEL_MB} MB model once, when the mic first starts`;

  return (
    <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3.5">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Understand natural phrasing</p>
            <button
              role="switch"
              aria-checked={smartMatching}
              aria-label="Understand natural phrasing"
              onClick={toggle}
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${smartMatching ? 'bg-violet-500' : 'bg-slate-300 dark:bg-slate-600'}`}
            >
              <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${smartMatching ? 'translate-x-4' : ''}`} />
            </button>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            You don't have to say the exact phrase: “take me to users” works, and so does a misheard “hit center”.
          </p>
          {smartMatching && (
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className={`flex items-center gap-1.5 text-xs ${status === 'error' ? 'text-red-500' : status === 'ready' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                {status === 'ready' && <CheckCircle2 className="h-3.5 w-3.5" />}
                {statusText}
              </span>
              {(status === 'ready' || status === 'stored' || status === 'error') && (
                <button
                  onClick={() => void removeModel()}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 transition-colors hover:text-red-500"
                  title="Delete the downloaded model from this browser"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              )}
            </div>
          )}
          {status === 'downloading' && (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div className="h-full bg-violet-500 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const STEPS = [
  { icon: MousePointerClick, text: 'Tap the spirit' },
  { icon: MessageCircle, text: 'Say what you want' },
  { icon: CheckCircle2, text: 'It shows what it did' },
];

export const VoiceHelpModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const voiceState = useVoiceStore((s) => s.state);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<VoiceGroup | 'all'>('all');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    // Desktop only: on a phone, focusing would pop the keyboard over the list.
    if (window.matchMedia('(min-width: 640px)').matches) searchRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const commands = isOpen ? CommandRegistry.getCommands() : [];
  const sections = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = (cmd: VoiceCommand) => {
      if (group !== 'all' && cmd.group !== group) return false;
      const haystack = [cmd.title, cmd.description, cmd.example, ...cmd.phrases, ...(cmd.examples ?? []), ...(cmd.options ?? [])].join(' ').toLowerCase();
      return words.every((w) => haystack.includes(w));
    };
    return [...VOICE_GROUPS, undefined]
      .map((g) => ({ group: g, commands: commands.filter((c) => c.group === g && matches(c)) }))
      .filter((s) => s.commands.length > 0);
  }, [commands, query, group]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-0 backdrop-blur-sm sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-help-title"
        className="flex h-full max-h-[100dvh] w-full max-w-3xl flex-col overflow-hidden bg-slate-50 shadow-2xl animate-in fade-in zoom-in-95 dark:bg-[#0b1120] sm:h-auto sm:max-h-[90vh] sm:rounded-2xl sm:border sm:border-slate-200 dark:sm:border-slate-800"
      >
        {/* Header: the Kailash spirit, live, in its own patch of night sky */}
        <div className="relative shrink-0 bg-[radial-gradient(circle_at_15%_30%,#1e1b4b_0%,#0b0a1f_55%,#020205_100%)] px-4 pb-4 pt-safe text-white sm:px-6">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-4 pt-4">
            <div className="shrink-0 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.18)_0%,transparent_70%)]">
              <VoiceSpirit3D mode={voiceState} size={76} />
            </div>
            <div className="min-w-0 pr-8">
              <h2 id="voice-help-title" className="text-xl font-bold tracking-tight">Voice commands</h2>
              <p className="mt-0.5 text-sm text-slate-300">Talk to the Kailash spirit to drive the visualizer hands-free.</p>
            </div>
          </div>
          <ol className="mt-4 grid grid-cols-3 gap-2">
            {STEPS.map(({ icon: Icon, text }, i) => (
              <li key={text} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-slate-200">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-[11px] font-bold text-cyan-300">{i + 1}</span>
                <Icon className="hidden h-3.5 w-3.5 shrink-0 text-cyan-300 sm:block" />
                <span className="leading-tight">{text}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Search and sections */}
        <div className="shrink-0 space-y-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60 sm:px-6">
          <label className="relative block">
            <span className="sr-only">Search commands</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search commands, e.g. zoom, theme, export"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100"
            />
          </label>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {(['all', ...VOICE_GROUPS] as const).map((g) => {
              const active = group === g;
              const Icon = g === 'all' ? null : GROUPS[g].icon;
              return (
                <button
                  key={g}
                  onClick={() => setGroup(g)}
                  aria-pressed={active}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? 'border-cyan-500 bg-cyan-500 text-white dark:border-cyan-400 dark:bg-cyan-400 dark:text-slate-950'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-400/60 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
                  }`}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  {g === 'all' ? 'All' : GROUPS[g].label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto px-4 py-4 sm:px-6">
          {/* A setting, not a command: out of the way while searching. */}
          {!query && <SmartMatchingRow />}

          {sections.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No command matches “{query}”</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Try other words, or just say it: with natural phrasing on, the spirit works out what you mean.</p>
            </div>
          ) : (
            sections.map(({ group: g, commands: list }) => {
              const Icon = g ? GROUPS[g].icon : Sparkles;
              return (
                <section key={g ?? 'other'} aria-label={g ? GROUPS[g].label : 'Other'}>
                  <h3 className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    <Icon className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-300" />
                    {g ? GROUPS[g].label : 'Other'}
                    <span className="font-normal normal-case tracking-normal text-slate-400 dark:text-slate-500">· {list.length}</span>
                  </h3>
                  <ul className="grid gap-2.5 sm:grid-cols-2">
                    {list.map((cmd) => <CommandCard key={cmd.phrases[0]} cmd={cmd} />)}
                  </ul>
                </section>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
