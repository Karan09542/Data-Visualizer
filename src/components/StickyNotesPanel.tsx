import React, { useState, useMemo, useRef, useLayoutEffect, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Search, Mic, Star, Trash2, 
  ExternalLink, CopyPlus, Plus,
  CheckSquare, Square, ChevronDown, Maximize2, Check, Globe
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

interface Props {
  onClose: () => void;
  onFocus: (note: IStickyNote) => void;
  onDuplicate: (note: IStickyNote) => void;
  onAdd: () => void;
  onUpdate?: (note: IStickyNote) => void;
}

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

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, 
        backgroundColor: note.color,
        border: `2px solid ${note.isFavorite ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.05)'}`
      }}
      className="group relative flex flex-col p-4 sm:p-5 rounded-[1.5rem] hover:shadow-xl hover:shadow-black/10 cursor-grab active:cursor-grabbing max-h-[320px] min-h-[160px] overflow-hidden break-inside-avoid mb-3 sm:mb-5"
      {...attributes}
      {...listeners}
      onClick={(e) => handleOpenFullScreen(note, e)}
    >
      {/* Card Header */}
      <div className="flex justify-between items-start mb-2">
        <span className="text-[12px] sm:text-[13px] font-bold text-black/50">
          {formatDate(note.updatedAt)}
        </span>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(note, e); }}
          onPointerDown={(e) => e.stopPropagation()}
          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-colors shrink-0 z-20 ${
            note.isFavorite 
              ? 'bg-black/80 text-white shadow-md' 
              : 'bg-transparent text-black/30 hover:bg-white/40'
          }`}
        >
          <Star size={16} fill={note.isFavorite ? "currentColor" : "none"} strokeWidth={note.isFavorite ? 0 : 2} />
        </button>
      </div>

      {/* Card Content */}
      <div className="flex-1 text-[#1a1a1a] overflow-hidden relative pointer-events-none">
        {(() => {
          const rawText = extractTextFromLexical(note.content);
          const lines = rawText.split('\n');
          const maxLines = 12;
          const fontStack = note.fontFamily ? `"${note.fontFamily}", "Noto Sans Devanagari", "Noto Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` : 'system-ui, sans-serif';
          
          return (
            <div className="flex flex-col h-full font-medium" style={{ fontFamily: fontStack, fontSize: '13px', lineHeight: 1.55 }}>
              <div className="flex-1">
                {lines.length === 1 && lines[0] === '' && (
                  <span className="opacity-20 italic">Empty note</span>
                )}
                {lines.slice(0, maxLines).map((line: string, i: number) => {
                  const checkMatch = /^(\s*[-*]\s+\[)([ xX])(\]\s*)(.*)$/.exec(line);
                  if (checkMatch) {
                    const isChecked = checkMatch[2].toLowerCase() === 'x';
                    return (
                      <div key={i} className="flex items-start gap-1.5 mb-[2px] opacity-80">
                        {isChecked ? (
                          <CheckSquare size={13} className="mt-[2px] shrink-0 text-emerald-700/80" />
                        ) : (
                          <Square size={13} className="mt-[2px] shrink-0 opacity-40" />
                        )}
                        <span className={`line-clamp-2 ${isChecked ? 'line-through opacity-60' : ''}`}>
                          {checkMatch[4]}
                        </span>
                      </div>
                    );
                  }
                  
                  const bulletMatch = /^(\s*[-*]\s+)(?!\[[ xX]\]\s*)(.*)$/.exec(line);
                  if (bulletMatch) {
                    return (
                      <div key={i} className="flex items-start gap-1.5 mb-[2px] opacity-80">
                        <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-current opacity-40" />
                        <span className="line-clamp-3">{bulletMatch[2]}</span>
                      </div>
                    );
                  }
                  
                  return (
                    <div key={i} className="min-h-[1.5em] opacity-80 line-clamp-4">
                      {line || <br />}
                    </div>
                  );
                })}
                {lines.length > maxLines && (
                  <p className="text-[11px] font-bold opacity-40 mt-1">+{lines.length - maxLines} more lines</p>
                )}
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[var(--tw-card-bg)] to-transparent pointer-events-none" style={{ '--tw-card-bg': note.color } as React.CSSProperties} />
            </div>
          );
        })()}
      </div>

      {/* Card Actions */}
      <div className="absolute bottom-3 right-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center p-1 gap-1 bg-white/40 hover:bg-white/60 backdrop-blur-md rounded-xl shadow-sm border border-black/5 z-20">
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


export default function StickyNotesPanel({ onClose, onFocus, onDuplicate, onAdd, onUpdate }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'favorites' | 'lists'>('all');
  const [sortBy, setSortBy] = useState<'manual' | 'updated' | 'created'>('manual');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [fullScreenNoteId, setFullScreenNoteId] = useState<string | null>(null);
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
        if (fullScreenNoteId === id) setFullScreenNoteId(null);
      },
    });
  };

  const handleOpenFullScreen = (note: IStickyNote, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFullScreenNoteId(note.id);
  };

  const handleRestore = async (note: IStickyNote, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
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
        className="w-full h-full sm:h-[85vh] sm:max-w-3xl bg-white dark:bg-[#1a1a1a] shadow-2xl sm:rounded-[2rem] flex flex-col overflow-hidden relative"
      >
        {/* Floating Add, Delete All, and Close Buttons for Desktop/Mobile */}
        <div className="absolute top-4 right-4 sm:top-5 sm:right-5 flex items-center gap-2 z-20">
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
                    if (fullScreenNoteId) setFullScreenNoteId(null);
                  },
                });
              }}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 shadow-sm flex items-center justify-center hover:bg-red-500/20 dark:hover:bg-red-500/30 transition-colors"
              title={`Delete All Notes (${allNotes.length})`}
            >
              <Trash2 size={18} />
            </button>
          )}
          <button
            onClick={onAdd}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black dark:bg-white text-white dark:text-black shadow-md flex items-center justify-center hover:bg-[#2a2a4e] dark:hover:bg-slate-200 transition-colors"
            title="New Note"
          >
            <Plus size={18} />
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Header Section */}
        <div className="px-4 sm:px-8 pt-5 sm:pt-6 pb-3.5 shrink-0 bg-white dark:bg-[#1a1a1a] border-b border-slate-100 dark:border-white/5 overflow-visible relative z-10">
          <h1 className="text-xl sm:text-2xl font-extrabold text-black dark:text-white tracking-tight mb-0.5">Hello, Dev</h1>
          <p className="text-black/60 dark:text-white/60 font-medium text-xs sm:text-sm mb-3.5">Here are all your notes</p>

          {/* Search Bar */}
          <div className="relative mb-3.5">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40" size={16} />
            <input
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-28 py-2 sm:py-2.5 bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/10 rounded-xl text-xs sm:text-sm font-semibold text-black dark:text-white focus:outline-none focus:border-black/30 dark:focus:border-white/30 transition-all placeholder:text-black/40 dark:placeholder:text-white/40"
            />
            
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-20">
              {/* Language Selector Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsLangDropdownOpen(prev => !prev)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-[11px] font-bold text-black/80 dark:text-white/80 transition-colors cursor-pointer"
                  title="Voice Recognition Language"
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
                        initial={{ opacity: 0, y: -6, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.95 }}
                        className="absolute right-0 top-full mt-1.5 z-50 w-48 max-h-60 overflow-y-auto bg-white/98 dark:bg-[#1c1c1c]/98 border border-black/10 dark:border-white/10 shadow-2xl rounded-xl p-1 backdrop-blur-xl custom-scrollbar"
                      >
                        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40">
                          Voice Language
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
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors text-left ${
                                isSelected 
                                  ? 'bg-black/10 dark:bg-white/20 text-black dark:text-white font-bold' 
                                  : 'text-black/80 dark:text-white/80 hover:bg-black/5 dark:hover:bg-white/10'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <span>{lang.flag}</span>
                                <span>{lang.label}</span>
                              </span>
                              {isSelected && <Check size={13} className="opacity-70" />}
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
                className={`relative p-1.5 rounded-full transition-all cursor-pointer flex items-center justify-center ${
                  isListening 
                    ? 'text-red-500 bg-red-500/15 dark:bg-red-500/25 ring-2 ring-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.35)] animate-pulse' 
                    : 'text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title={isListening ? `Listening in ${activeLangObj.label}... Click to stop` : `Voice Search (${activeLangObj.label})`}
              >
                <Mic size={16} />
                {isListening && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-black animate-pulse" />
                )}
              </button>
            </div>
          </div>

          {/* Filters & Sort */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap pb-1 relative">
            <span className="text-xs font-bold text-black/70 dark:text-white/70 shrink-0 mr-0.5">Filter by:</span>
            <button
              onClick={() => setFilter('all')}
              className={`px-3.5 py-1.5 sm:px-4 sm:py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 border ${
                filter === 'all' 
                  ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' 
                  : 'bg-white dark:bg-black text-black dark:text-white border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('favorites')}
              className={`px-3.5 py-1.5 sm:px-4 sm:py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 border ${
                filter === 'favorites' 
                  ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' 
                  : 'bg-white dark:bg-black text-black dark:text-white border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
              }`}
            >
              Favorites
            </button>
            <button
              onClick={() => setFilter('lists')}
              className={`px-3.5 py-1.5 sm:px-4 sm:py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 border ${
                filter === 'lists' 
                  ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' 
                  : 'bg-white dark:bg-black text-black dark:text-white border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
              }`}
            >
              Lists
            </button>

            {/* Separator */}
            <div className="w-px h-5 bg-slate-200 dark:bg-white/10 mx-1 shrink-0" />

            {/* Sort Dropdown */}
            <div className="relative shrink-0">
              <button
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-black text-black dark:text-white border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-all"
              >
                Sort: {sortBy === 'manual' ? 'Custom' : sortBy === 'updated' ? 'Recent' : 'Oldest'}
                <ChevronDown size={14} className={`transition-transform ${isSortDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              <AnimatePresence>
                {isSortDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsSortDropdownOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="absolute right-0 top-[110%] z-50 w-36 bg-white dark:bg-black border border-slate-200 dark:border-white/10 shadow-xl rounded-xl overflow-hidden flex flex-col"
                    >
                      <button
                        onClick={() => { setSortBy('manual'); setIsSortDropdownOpen(false); }}
                        className={`px-3 py-2 text-left text-xs font-semibold transition-colors ${sortBy === 'manual' ? 'bg-slate-50 dark:bg-white/5 text-blue-600 dark:text-blue-400' : 'hover:bg-slate-50 dark:hover:bg-white/5 text-black dark:text-white'}`}
                      >
                        Custom Order
                      </button>
                      <button
                        onClick={() => { setSortBy('updated'); setIsSortDropdownOpen(false); }}
                        className={`px-3 py-2 text-left text-xs font-semibold transition-colors ${sortBy === 'updated' ? 'bg-slate-50 dark:bg-white/5 text-blue-600 dark:text-blue-400' : 'hover:bg-slate-50 dark:hover:bg-white/5 text-black dark:text-white'}`}
                      >
                        Recently Edited
                      </button>
                      <button
                        onClick={() => { setSortBy('created'); setIsSortDropdownOpen(false); }}
                        className={`px-3 py-2 text-left text-xs font-semibold transition-colors ${sortBy === 'created' ? 'bg-slate-50 dark:bg-white/5 text-blue-600 dark:text-blue-400' : 'hover:bg-slate-50 dark:hover:bg-white/5 text-black dark:text-white'}`}
                      >
                        Date Created
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Notes Grid */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 pb-6 custom-scrollbar bg-slate-50/50 dark:bg-black/20">
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
            <div className="h-full flex flex-col items-center justify-center text-black/40 dark:text-white/40">
              <Star size={40} strokeWidth={1.5} className="mb-4 opacity-50" />
              <p className="text-[16px] font-extrabold text-black/60 dark:text-white/60">No notes found</p>
              <p className="text-sm font-semibold mt-1">Try changing your filters or add a new note.</p>
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
                  setFullScreenNoteId(null);
                }}
                onUpdate={async (updatedNote) => {
                  if (!updatedNote.isMaximized || updatedNote.isMinimized) {
                    setFullScreenNoteId(null);
                  }
                  await db.stickyNotes.put(updatedNote);
                  if (onUpdate) onUpdate(updatedNote);
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
