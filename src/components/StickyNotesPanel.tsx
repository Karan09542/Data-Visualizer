import React, { useState, useMemo, useRef, useLayoutEffect, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Search, Mic, Star, Trash2, 
  ExternalLink, CopyPlus, Plus,
  CheckSquare, Square, ChevronDown, Maximize2, Check, Trash,
  StickyNote as StickyIcon
} from 'lucide-react';
import { db, StickyNote as IStickyNote } from '../lib/db';
import StickyNote from './StickyNote';
import { useLiveQuery } from 'dexie-react-hooks';
import { createPortal } from 'react-dom';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { extractTextFromLexical } from '../utils/LexicalUtils';

import StickyConfirmModal from './notes/StickyConfirmModal';
import { ensureFontsLoaded } from '../utils/fontRegistry';

interface Props {
  onClose: () => void;
  onFocus: (note: IStickyNote) => void;
  onDuplicate: (note: IStickyNote) => void;
  onAdd: () => void;
  onUpdate?: (note: IStickyNote) => void;
  onFullScreenNoteChange?: (id: string | null) => void;
}

const CARD_CHECK_REGEX = /^(\s*[-*]\s+\[)([ xX])(\]\s*)(.*)$/;

const CHECKLIST_REGEX = /^(\s*[-*]\s+\[)([ xX])(\]\s*)(.*)$/m;

const VOICE_LANGUAGES = [
  { code: 'hi-IN', label: 'Hindi (हिन्दी)', short: 'HI', flag: '🇮🇳' },
  { code: 'en-US', label: 'English (US)', short: 'EN', flag: '🇺🇸' },
  { code: 'en-IN', label: 'English (India)', short: 'EN-IN', flag: '🇮🇳' },
  { code: 'es-ES', label: 'Spanish (Español)', short: 'ES', flag: '🇪🇸' },
  { code: 'fr-FR', label: 'French (Français)', short: 'FR', flag: '🇫🇷' },
  { code: 'de-DE', label: 'German (Deutsch)', short: 'DE', flag: '🇩🇪' },
  { code: 'ja-JP', label: 'Japanese (日本語)', short: 'JA', flag: '🇯🇵' },
  { code: 'zh-CN', label: 'Chinese (中文)', short: 'ZH', flag: '🇨🇳' },
  { code: 'mr-IN', label: 'Marathi (मराठी)', short: 'MR', flag: '🇮🇳' },
  { code: 'ta-IN', label: 'Tamil (தமிழ்)', short: 'TA', flag: '🇮🇳' },
  { code: 'te-IN', label: 'Telugu (తెలుగు)', short: 'TE', flag: '🇮🇳' },
  { code: 'bn-IN', label: 'Bengali (বাংলা)', short: 'BN', flag: '🇮🇳' },
  { code: 'gu-IN', label: 'Gujarati (ગુજરાતી)', short: 'GU', flag: '🇮🇳' },
];

// Sortable Note Item Component
function SortableNoteItem({ note, handleRestore, handleOpenFullScreen, toggleFavorite, formatDate, handleDuplicate, handleDelete }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: note.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? transition : undefined,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.9 : 1,
  };

  const rawText = extractTextFromLexical(note.content);
  const lines = rawText.split('\n');
  const maxLines = 12;
  const isTruncated = lines.length > maxLines;
  const isEmpty = rawText.trim().length === 0;
  const fontStack = note.fontFamily
    ? `"${note.fontFamily}", "Noto Sans Devanagari", "Noto Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
    : 'system-ui, sans-serif';

  // Checklist progress, which is the useful thing to know about a list at a glance
  const todoTotal = lines.filter((line: string) => CARD_CHECK_REGEX.test(line)).length;
  const todoDone = lines.filter((line: string) => {
    const match = CARD_CHECK_REGEX.exec(line);
    return match && match[2].toLowerCase() === 'x';
  }).length;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style,
        backgroundColor: note.color,
        boxShadow: note.isFavorite ? 'inset 0 0 0 2px rgba(0,0,0,0.35)' : 'inset 0 0 0 1px rgba(0,0,0,0.07)'
      }}
      className="group relative mb-3 flex max-h-[320px] min-h-[96px] cursor-grab break-inside-avoid flex-col gap-2 overflow-hidden rounded-2xl p-4 transition-shadow hover:shadow-[0_12px_28px_-10px_rgba(0,0,0,0.35)] active:cursor-grabbing sm:mb-5"
      {...attributes}
      {...listeners}
      onClick={(e) => handleOpenFullScreen(note, e)}
    >
      {/* Favourite, floating so it never pushes the text around */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(note, e); }}
        onPointerDown={(e) => e.stopPropagation()}
        className={`absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full transition-colors ${note.isFavorite
          ? 'bg-black/75 text-white'
          : 'text-black/25 hover:bg-black/8 hover:text-black/50'
          }`}
        title={note.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
        aria-label={note.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
      >
        <Star size={14} fill={note.isFavorite ? 'currentColor' : 'none'} strokeWidth={note.isFavorite ? 0 : 2} />
      </button>

      {/* Card Content */}
      <div className="pointer-events-none relative min-h-0 flex-1 overflow-hidden pr-7 text-[#1a1a1a]">
        <div style={{ fontFamily: fontStack, fontSize: '14px', lineHeight: 1.55 }}>
          {isEmpty ? (
            <span className="italic text-black/25">Empty note</span>
          ) : (
            lines.slice(0, maxLines).map((line: string, i: number) => {
              const checkMatch = CARD_CHECK_REGEX.exec(line);
              if (checkMatch) {
                const isChecked = checkMatch[2].toLowerCase() === 'x';
                return (
                  <div key={i} className="mb-[3px] flex items-start gap-1.5">
                    {isChecked ? (
                      <CheckSquare size={14} className="mt-[3px] shrink-0 text-emerald-700/75" />
                    ) : (
                      <Square size={14} className="mt-[3px] shrink-0 text-black/30" />
                    )}
                    <span className={`line-clamp-2 ${isChecked ? 'text-black/40 line-through' : 'text-black/85'}`}>
                      {checkMatch[4]}
                    </span>
                  </div>
                );
              }

              const bulletMatch = /^(\s*[-*]\s+)(?!\[[ xX]\]\s*)(.*)$/.exec(line);
              if (bulletMatch) {
                return (
                  <div key={i} className="mb-[3px] flex items-start gap-1.5 text-black/85">
                    <span className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-current opacity-40" />
                    <span className="line-clamp-3">{bulletMatch[2]}</span>
                  </div>
                );
              }

              return (
                <div key={i} className="line-clamp-4 min-h-[1.55em] text-black/85">
                  {line || <br />}
                </div>
              );
            })
          )}
        </div>

        {/* Only fade the text out when there is more of it below */}
        {isTruncated && (
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t to-transparent"
            style={{ backgroundImage: `linear-gradient(to top, ${note.color}, transparent)` }}
          />
        )}
      </div>

      {/* Footer */}
      <div className="flex shrink-0 items-center gap-2 text-[11px] text-black/45">
        <span className="truncate">{formatDate(note.updatedAt)}</span>
        {todoTotal > 0 && (
          <span className="shrink-0 rounded-md bg-black/8 px-1.5 py-0.5 font-medium tabular-nums text-black/55">
            {todoDone}/{todoTotal}
          </span>
        )}
        {isTruncated && (
          <span className="shrink-0 text-black/35">+{lines.length - maxLines} more</span>
        )}
      </div>

      {/* Card Actions */}
      <div className="absolute bottom-2.5 right-2.5 z-20 flex items-center gap-0.5 rounded-xl bg-white/80 p-0.5 shadow-sm ring-1 ring-black/6 backdrop-blur-md transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDuplicate(note, e); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="p-1.5 sm:p-2 rounded-lg text-black/60 hover:text-black hover:bg-black/10 transition-colors"
          title="Duplicate Note"
        >
          <CopyPlus size={16} />
        </button>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOpenFullScreen(note, e); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="p-1.5 sm:p-2 rounded-lg text-black/60 hover:text-black hover:bg-black/10 transition-colors"
          title="Open Full Screen"
        >
          <Maximize2 size={16} />
        </button>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRestore(note, e); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="p-1.5 sm:p-2 rounded-lg text-black/60 hover:text-black hover:bg-black/10 transition-colors"
          title="Open on Canvas"
        >
          <ExternalLink size={16} />
        </button>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(note.id, e); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="p-1.5 sm:p-2 rounded-lg text-red-500/70 hover:text-red-600 hover:bg-red-500/10 transition-colors"
          title="Delete Note"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}


export default function StickyNotesPanel({ onClose, onFocus, onDuplicate, onAdd, onUpdate, onFullScreenNoteChange }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'favorites' | 'lists'>('all');
  const [sortBy, setSortBy] = useState<'manual' | 'updated' | 'created'>('manual');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [fullScreenNoteId, setFullScreenNoteId] = useState<string | null>(null);
  const wasMinimizedMapRef = useRef<Map<string, boolean>>(new Map());

  const updateFullScreenNoteId = useCallback((id: string | null) => {
    setFullScreenNoteId(id);
    onFullScreenNoteChange?.(id);
  }, [onFullScreenNoteChange]);
  const [isListening, setIsListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState('hi-IN');
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const recognitionRef = useRef<any>(null);

  const activeLangObj = useMemo(() => {
    return VOICE_LANGUAGES.find(l => l.code === voiceLang) || VOICE_LANGUAGES[0];
  }, [voiceLang]);

  const toggleVoiceSearch = useCallback(() => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in this browser. Please try Chrome or Edge.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = voiceLang;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((res: any) => res[0].transcript)
          .join('')
          .replace(/[\p{P}\s]+$/gu, '')
          .trim();
        setSearch(transcript);
      };

      recognition.onerror = (err: any) => {
        console.error('Voice search error:', err);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setSearch(prev => prev.replace(/[\p{P}\s]+$/gu, '').trim());
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error('Error starting speech recognition:', e);
      setIsListening(false);
    }
  }, [isListening, voiceLang]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);
  
  const allNotes = useLiveQuery(() => db.stickyNotes.toArray()) || [];
  const fullScreenNote = useMemo(() => allNotes.find(n => n.id === fullScreenNoteId), [allNotes, fullScreenNoteId]);

  // Preload all fonts used across notes for the manager grid
  useEffect(() => {
    if (allNotes.length > 0) {
      ensureFontsLoaded(allNotes.map(n => n.fontFamily));
    }
  }, [allNotes]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const filteredNotes = useMemo(() => {
    return allNotes
      .filter(n => {
        const plainText = extractTextFromLexical(n.content);
        if (search && !plainText.toLowerCase().includes(search.toLowerCase())) return false;
        if (filter === 'favorites' && !n.isFavorite) return false;
        if (filter === 'lists' && !CHECKLIST_REGEX.test(plainText)) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'updated') return b.updatedAt - a.updatedAt;
        if (sortBy === 'created') return b.createdAt - a.createdAt;
        // manual order (ascending)
        return (a.order || 0) - (b.order || 0);
      });
  }, [allNotes, search, filter, sortBy]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (sortBy !== 'manual') return; // Only allow drag-and-drop in manual mode
    if (!over || active.id === over.id) return;

    const oldIndex = filteredNotes.findIndex(n => n.id === active.id);
    const newIndex = filteredNotes.findIndex(n => n.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newItems = arrayMove(filteredNotes, oldIndex, newIndex);
      
      // Update order field for all notes to persist the new order
      const updates = newItems.map((note, index) => ({
        ...note,
        order: index // simple sequential ordering
      }));

      // Update in DB (bulkPut)
      await db.stickyNotes.bulkPut(updates);
    }
  };

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Sticky Note',
      message: 'Are you sure you want to delete this note?',
      confirmText: 'Delete Note',
      onConfirm: async () => {
        await db.stickyNotes.delete(id);
        if (fullScreenNoteId === id) updateFullScreenNoteId(null);
      },
    });
  };

  const handleOpenFullScreen = (note: IStickyNote, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    wasMinimizedMapRef.current.set(note.id, note.isMinimized);
    updateFullScreenNoteId(note.id);
  };

  const handleRestore = async (note: IStickyNote, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    updateFullScreenNoteId(null);
    
    // Ensure the note is visible in the current viewport (crucial for mobile)
    let { x, y } = note;
    const padding = 20;
    const noteWidth = Math.max(note.width || 280, 200);
    const noteHeight = Math.max(note.height || 280, 180);

    if (x + 100 > window.innerWidth) {
      x = Math.max(padding, window.innerWidth - noteWidth - padding);
    }
    if (y + 100 > window.innerHeight) {
      y = Math.max(padding, window.innerHeight - noteHeight - padding);
    }
    x = Math.max(padding, x);
    y = Math.max(padding, y);

    // Do not update updatedAt here so the note doesn't jump to the top of the list
    const updatedNote = { ...note, x, y, isMinimized: false, isMaximized: false };
    await db.stickyNotes.put(updatedNote);
    onFocus(updatedNote);
    onClose();
  };

  const handleDuplicate = (note: IStickyNote, e: React.MouseEvent) => {
    e.stopPropagation();
    onDuplicate(note);
  };

  const toggleFavorite = async (note: IStickyNote, e: React.MouseEvent) => {
    e.stopPropagation();
    // Do not update updatedAt here so the note doesn't jump to the top of the list
    await db.stickyNotes.update(note.id, { isFavorite: !note.isFavorite });
  };

  // Format date like "March 9"
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  };

  const panelRef = useRef<HTMLDivElement>(null);
  const [isLayoutReady, setIsLayoutReady] = useState(false);

  useLayoutEffect(() => {
    if (panelRef.current) {
      panelRef.current.style.transformOrigin = 'center center';
    }
    setIsLayoutReady(true);
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[25000] flex items-center justify-center bg-black/40 backdrop-blur-sm sm:p-4 p-0">
      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, y: 15, scale: 0.96 }}
        animate={{ opacity: isLayoutReady ? 1 : 0, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 15, scale: 0.96 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative flex h-full w-full flex-col overflow-hidden bg-white shadow-[0_28px_60px_-20px_rgba(0,0,0,0.5)] dark:bg-[#161618] sm:h-[85vh] sm:max-w-3xl sm:rounded-3xl sm:ring-1 sm:ring-black/6 dark:sm:ring-white/10"
      >
        {/* Header Section */}
        <div className="relative z-10 shrink-0 overflow-visible border-b border-black/6 px-4 pb-3.5 pt-4 dark:border-white/8 sm:px-6 sm:pt-5">
          <div className="mb-3.5 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-500 ring-1 ring-inset ring-amber-500/20">
                <StickyIcon size={18} />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold tracking-tight text-black dark:text-white sm:text-lg">
                  All notes
                </h2>
                <p className="truncate text-xs text-black/45 dark:text-white/45">
                  {allNotes.length === 0
                    ? 'Nothing saved yet'
                    : filteredNotes.length === allNotes.length
                      ? `${allNotes.length} ${allNotes.length === 1 ? 'note' : 'notes'}`
                      : `${filteredNotes.length} of ${allNotes.length} notes`}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={onAdd}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-amber-400 px-3 text-[13px] font-semibold text-black/80 ring-1 ring-inset ring-black/10 transition-colors hover:bg-amber-300 hover:text-black active:scale-95"
                title="New note"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">New</span>
              </button>
              <button
                onClick={() => {
                  updateFullScreenNoteId(null);
                  onClose();
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-black/50 transition-colors hover:bg-black/6 hover:text-black dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
                title="Close"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-black/35 dark:text-white/35" size={16} />
            <input
              type="text"
              placeholder="Search notes"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-black/8 bg-black/3 pl-10 pr-28 text-sm text-black/85 outline-none transition-colors placeholder:text-black/35 focus:border-amber-400/50 focus:bg-transparent dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/35"
            />

            <div className="absolute right-2 top-1/2 z-20 flex -translate-y-1/2 items-center gap-1">
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-black/40 transition-colors hover:bg-black/6 hover:text-black/70 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white/70"
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              )}

              {/* Language Selector Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsLangDropdownOpen(prev => !prev)}
                  className="flex items-center gap-1 rounded-lg bg-black/5 px-2 py-1 text-[11px] font-semibold text-black/70 transition-colors hover:bg-black/10 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/20"
                  title="Voice recognition language"
                >
                  <span className="text-xs">{activeLangObj.flag}</span>
                  <span>{activeLangObj.short}</span>
                  <ChevronDown size={12} className={`opacity-60 transition-transform ${isLangDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isLangDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsLangDropdownOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.14, ease: 'easeOut' }}
                        className="custom-scrollbar absolute right-0 top-full z-50 mt-1.5 max-h-60 w-52 overflow-y-auto rounded-2xl bg-white/95 p-1.5 shadow-[0_20px_44px_-16px_rgba(0,0,0,0.45)] ring-1 ring-black/7 backdrop-blur-xl dark:bg-[#1c1c1f]/95 dark:ring-white/12"
                      >
                        <div className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-black/40 dark:text-white/40">
                          Voice language
                        </div>
                        {VOICE_LANGUAGES.map((lang) => {
                          const isSelected = voiceLang === lang.code;
                          return (
                            <button
                              type="button"
                              key={lang.code}
                              onClick={() => {
                                setVoiceLang(lang.code);
                                setIsLangDropdownOpen(false);
                                if (isListening && recognitionRef.current) {
                                  recognitionRef.current.lang = lang.code;
                                }
                              }}
                              className={`flex h-9 w-full items-center justify-between gap-2 rounded-lg px-2.5 text-left text-[13px] transition-colors ${isSelected
                                ? 'bg-black/7 font-semibold text-black dark:bg-white/14 dark:text-white'
                                : 'text-black/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/8'
                                }`}
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <span>{lang.flag}</span>
                                <span className="truncate">{lang.label}</span>
                              </span>
                              {isSelected && <Check size={14} className="shrink-0 text-emerald-500" />}
                            </button>
                          );
                        })}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Mic Toggle Button */}
              <button
                type="button"
                onClick={toggleVoiceSearch}
                className={`relative flex items-center justify-center rounded-lg p-1.5 transition-all ${isListening
                  ? 'bg-red-500/15 text-red-500 ring-1 ring-red-500/40 dark:bg-red-500/25'
                  : 'text-black/40 hover:bg-black/6 hover:text-black/75 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white/75'
                  }`}
                title={isListening ? `Listening in ${activeLangObj.label}, click to stop` : `Voice search (${activeLangObj.label})`}
              >
                <Mic size={16} />
                {isListening && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-red-500 ring-2 ring-white dark:ring-[#161618]" />
                )}
              </button>
            </div>
          </div>

          {/* Filters & Sort */}
          <div className="relative flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto no-scrollbar">
              {([
                { id: 'all', label: 'All' },
                { id: 'favorites', label: 'Favourites' },
                { id: 'lists', label: 'Lists' },
              ] as const).map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  aria-pressed={filter === id}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${filter === id
                    ? 'bg-black/8 text-black dark:bg-white/16 dark:text-white'
                    : 'text-black/55 hover:bg-black/4 hover:text-black/80 dark:text-white/55 dark:hover:bg-white/6 dark:hover:text-white/80'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <div className="relative shrink-0">
              <button
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                className="flex items-center gap-1.5 rounded-lg border border-black/8 px-2.5 py-1.5 text-xs font-medium text-black/65 transition-colors hover:bg-black/4 dark:border-white/10 dark:text-white/65 dark:hover:bg-white/5"
                title="Sort notes"
              >
                <span className="hidden sm:inline">{sortBy === 'manual' ? 'Custom' : sortBy === 'updated' ? 'Recent' : 'Oldest'}</span>
                <span className="sm:hidden">Sort</span>
                <ChevronDown size={13} className={`opacity-60 transition-transform ${isSortDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isSortDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsSortDropdownOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.14, ease: 'easeOut' }}
                      className="absolute right-0 top-full z-50 mt-1.5 w-44 rounded-2xl bg-white/95 p-1.5 shadow-[0_20px_44px_-16px_rgba(0,0,0,0.45)] ring-1 ring-black/7 backdrop-blur-xl dark:bg-[#1c1c1f]/95 dark:ring-white/12"
                    >
                      {([
                        { id: 'manual', label: 'Custom order' },
                        { id: 'updated', label: 'Recently edited' },
                        { id: 'created', label: 'Date created' },
                      ] as const).map(({ id, label }) => (
                        <button
                          key={id}
                          onClick={() => { setSortBy(id); setIsSortDropdownOpen(false); }}
                          className={`flex h-9 w-full items-center justify-between gap-2 rounded-lg px-2.5 text-left text-[13px] transition-colors ${sortBy === id
                            ? 'bg-black/7 font-semibold text-black dark:bg-white/14 dark:text-white'
                            : 'text-black/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/8'
                            }`}
                        >
                          <span>{label}</span>
                          {sortBy === id && <Check size={14} className="shrink-0 text-emerald-500" />}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Kept well away from New, since it wipes everything */}
            {allNotes.length > 0 && (
              <button
                onClick={() => {
                  setConfirmConfig({
                    isOpen: true,
                    title: 'Delete All Sticky Notes',
                    message: `Are you sure you want to delete ALL ${allNotes.length} sticky note(s)? This action cannot be undone.`,
                    confirmText: `Delete All (${allNotes.length})`,
                    onConfirm: async () => {
                      await db.stickyNotes.clear();
                      if (fullScreenNoteId) updateFullScreenNoteId(null);
                    },
                  });
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-black/40 transition-colors hover:bg-red-500/10 hover:text-red-600 dark:text-white/40 dark:hover:text-red-400"
                title={`Delete all ${allNotes.length} notes`}
                aria-label={`Delete all ${allNotes.length} notes`}
              >
                <Trash size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Notes Grid */}
        <div className="custom-scrollbar flex-1 overflow-y-auto bg-black/[0.02] px-3 pb-6 dark:bg-black/20 sm:px-6">
          {filteredNotes.length > 0 ? (
            <div className="mt-3">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={filteredNotes.map(n => n.id)} strategy={rectSortingStrategy}>
                  <div className="columns-2 gap-3 sm:gap-5 w-full">
                    {filteredNotes.map(note => (
                      <SortableNoteItem
                        key={note.id}
                        note={note}
                        handleRestore={handleRestore}
                        handleOpenFullScreen={handleOpenFullScreen}
                        toggleFavorite={toggleFavorite}
                        formatDate={formatDate}
                        handleDuplicate={handleDuplicate}
                        handleDelete={handleDelete}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black/4 text-black/25 dark:bg-white/5 dark:text-white/25">
                {search || filter !== 'all' ? <Search size={24} /> : <StickyIcon size={24} />}
              </div>
              <p className="mt-4 text-sm font-medium text-black/70 dark:text-white/70">
                {search
                  ? 'No notes match that search'
                  : filter === 'favorites'
                    ? 'No favourites yet'
                    : filter === 'lists'
                      ? 'No checklists yet'
                      : 'No notes yet'}
              </p>
              <p className="mt-1 text-xs text-black/40 dark:text-white/40">
                {search
                  ? 'Try a different word'
                  : filter === 'favorites'
                    ? 'Star a note to keep it here'
                    : filter === 'lists'
                      ? 'Notes with checkboxes show up here'
                      : 'Notes you create will be listed here'}
              </p>
              <button
                onClick={search || filter !== 'all' ? () => { setSearch(''); setFilter('all'); } : onAdd}
                className="mt-4 flex h-9 items-center gap-1.5 rounded-xl bg-amber-400 px-3.5 text-[13px] font-semibold text-black/80 ring-1 ring-inset ring-black/10 transition-colors hover:bg-amber-300 hover:text-black"
              >
                {search || filter !== 'all' ? <X size={15} /> : <Plus size={15} />}
                {search || filter !== 'all' ? 'Clear filters' : 'New note'}
              </button>
            </div>
          )}
        </div>

        {/* Fullscreen Original Sticky Note Editor directly on top of manager */}
        <AnimatePresence>
          {fullScreenNote && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-0 z-[26000] flex items-center justify-center bg-black/60 backdrop-blur-md pointer-events-auto"
            >
              <StickyNote
                note={{ ...fullScreenNote, isMaximized: true, isMinimized: false }}
                onDelete={async (id) => {
                  await db.stickyNotes.delete(id);
                  updateFullScreenNoteId(null);
                }}
                onUpdate={async (updatedNote) => {
                  const wasMinimized = wasMinimizedMapRef.current.has(updatedNote.id)
                    ? wasMinimizedMapRef.current.get(updatedNote.id)!
                    : fullScreenNote.isMinimized;
                  const shouldClose = !updatedNote.isMaximized || updatedNote.isMinimized;
                  if (shouldClose) {
                    updateFullScreenNoteId(null);
                  }
                  const noteToPersist = shouldClose
                    ? { ...updatedNote, isMaximized: false, isMinimized: wasMinimized }
                    : { ...updatedNote, isMaximized: true, isMinimized: wasMinimized };
                  await db.stickyNotes.put(noteToPersist);
                  if (onUpdate) onUpdate(noteToPersist);
                }}
                onDuplicate={(noteToDup) => {
                  onDuplicate(noteToDup);
                }}
                onFocus={() => {}}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <StickyConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        onConfirm={confirmConfig.onConfirm}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>,
    document.body
  );
}
