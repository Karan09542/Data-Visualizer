import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  X,
  Search,
  Play,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Radio,
  FileCode,
  Tag,
  KeyRound,
} from 'lucide-react';
import {
  FREE_API_PRESETS,
  FREE_API_CATEGORIES,
  FreeApiPreset,
  FreeApiCategory,
} from '../constants/freeApis';

interface FreeApiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (preset: FreeApiPreset, autoRun: boolean) => void;
}

export function FreeApiModal({ isOpen, onClose, onSelect }: FreeApiModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FreeApiCategory>('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 80);
    } else {
      setSearchQuery('');
      setSelectedCategory('All');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredPresets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return FREE_API_PRESETS.filter((preset) => {
      const matchCategory =
        selectedCategory === 'All' || preset.category === selectedCategory;
      if (!matchCategory) return false;
      if (!q) return true;

      return (
        preset.name.toLowerCase().includes(q) ||
        preset.description.toLowerCase().includes(q) ||
        preset.url.toLowerCase().includes(q) ||
        preset.category.toLowerCase().includes(q) ||
        preset.method.toLowerCase().includes(q) ||
        (preset.badge && preset.badge.toLowerCase().includes(q))
      );
    });
  }, [searchQuery, selectedCategory]);

  const handleCopyUrl = async (preset: FreeApiPreset, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(preset.url);
      setCopiedId(preset.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[10002] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-xs sm:backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-label="Famous Free APIs for Quick Testing"
        className="relative flex flex-col w-full max-w-full sm:max-w-[760px] h-[92vh] sm:h-[84vh] max-h-[92vh] overflow-hidden rounded-t-3xl sm:rounded-2xl border-t border-x border-b-0 sm:border-b border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-[#0b1120] dark:text-slate-100 animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-250"
      >
        {/* Mobile Pull Handle */}
        <div
          className="flex sm:hidden w-full items-center justify-center pt-2.5 pb-1 shrink-0 cursor-grab active:cursor-grabbing touch-pan-y"
          onClick={onClose}
          title="Tap or swipe to close"
        >
          <div className="h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700/80 transition-transform active:scale-95" />
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 sm:px-5 py-3 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500/20 via-blue-500/20 to-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
              <Sparkles size={18} className="text-amber-500" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Famous Free APIs
                </span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Zero Config
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[280px] sm:max-w-[460px]">
                Instant test endpoints with CORS enabled and no authentication keys required.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search & Category Filter Section */}
        <div className="border-b border-slate-200 bg-slate-50/60 p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-950/40 shrink-0 space-y-2.5">
          {/* Search Bar */}
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 shrink-0"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by API name, category, description, or IP..."
              spellCheck={false}
              className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-8 font-sans text-xs text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {FREE_API_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                    active
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Preset Cards List */}
        <div
          className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 custom-scrollbar"
          style={{ minHeight: 200 }}
        >
          {filteredPresets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
              <Globe size={32} className="opacity-40 mb-2 stroke-[1.5]" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                No matching APIs found
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Try searching with different keywords or switch categories.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                }}
                className="mt-3 text-xs font-semibold text-indigo-500 hover:underline cursor-pointer"
              >
                Reset filters
              </button>
            </div>
          ) : (
            filteredPresets.map((preset) => {
              const isPost = preset.method === 'POST';
              const isCopied = copiedId === preset.id;

              return (
                <div
                  key={preset.id}
                  className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white p-3 sm:p-3.5 shadow-xs transition-all hover:border-indigo-500/50 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-indigo-500/40"
                >
                  {/* Left: Info */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                          isPost
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {preset.method}
                      </span>
                      <span className="font-semibold text-xs sm:text-[13px] text-slate-900 dark:text-slate-100">
                        {preset.name}
                      </span>
                      {preset.badge && (
                        <span className="rounded bg-indigo-500/10 px-1.5 py-0.2 text-[9px] font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                          {preset.badge}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 hidden sm:inline">
                        • {preset.category}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">
                      {preset.description}
                    </p>

                    <div className="flex items-center gap-2 pt-0.5">
                      <span
                        className="truncate font-mono text-[10px] text-slate-500 dark:text-slate-500 max-w-[240px] sm:max-w-[400px] select-all"
                        title={preset.url}
                      >
                        {preset.url}
                      </span>
                      {preset.body && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[9px] font-medium text-amber-600 dark:text-amber-400"
                          title="Includes sample JSON payload"
                        >
                          <FileCode size={10} />
                          <span>Body</span>
                        </span>
                      )}
                      {preset.extractPath && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[9px] font-medium text-indigo-600 dark:text-indigo-400"
                          title={`Extract key: ${preset.extractPath}`}
                        >
                          <KeyRound size={10} />
                          <span>{preset.extractPath}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={(e) => handleCopyUrl(preset, e)}
                      title={isCopied ? 'Copied URL!' : 'Copy endpoint URL'}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      {isCopied ? (
                        <Check size={12} className="text-emerald-500" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelect(preset, false)}
                      className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition-all cursor-pointer"
                      title="Load URL and configuration into node"
                    >
                      <span>Load</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelect(preset, true)}
                      className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 text-[11px] font-semibold text-white shadow-xs hover:from-blue-500 hover:to-indigo-500 active:scale-95 transition-all cursor-pointer"
                      title="Load preset and immediately fetch response"
                    >
                      <Play size={10} className="fill-current" />
                      <span>Run Now</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-4 py-2.5 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-950/20 shrink-0">
          <span>{filteredPresets.length} free APIs available</span>
          <span className="text-slate-400 text-[10px]">
            Tip: Click <strong>Run Now</strong> to immediately fetch and see node data
          </span>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
export default FreeApiModal;
