import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Trash, CopyPlus, Power, List, GripHorizontal, RotateCcw } from 'lucide-react';
import { db, StickyNote as IStickyNote } from '../lib/db';
import StickyNote from './StickyNote';
import StickyNotesPanel from './StickyNotesPanel';
import { useStore } from '../store/useStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { getMinNoteWidth } from '../utils/NoteUtils';
import { ensureFontsLoaded } from '../utils/fontRegistry';
import { extractTextFromLexical } from '../utils/LexicalUtils';

import StickyConfirmModal from './notes/StickyConfirmModal';

const RECENT_OPENED_KEY = 'sticky_notes_recent_opened';
const RECENT_CLOSED_KEY = 'sticky_notes_recent_closed';

const getStoredIds = (key: string): string[] => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveStoredIds = (key: string, ids: string[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(ids.slice(0, 30)));
  } catch {}
};

/** Same surface language as the notes, so the dock reads as part of the same tool */
const DOCK_SURFACE =
  'bg-white/95 dark:bg-[#1c1c1f]/95 ring-1 ring-black/6 dark:ring-white/10 shadow-[0_20px_44px_-16px_rgba(0,0,0,0.45)] backdrop-blur-xl';
const DOCK_BUTTON =
  'flex h-9 w-9 items-center justify-center rounded-xl text-black/60 dark:text-white/60 transition-colors hover:bg-black/6 dark:hover:bg-white/10 hover:text-black/85 dark:hover:text-white';
const DOCK_BUTTON_ACTIVE =
  'flex h-9 w-9 items-center justify-center rounded-xl bg-black/8 dark:bg-white/16 text-black dark:text-white transition-colors';
const DOCK_BUTTON_DANGER =
  'flex h-9 w-9 items-center justify-center rounded-xl text-red-600 dark:text-red-400 transition-colors hover:bg-red-500/10';

/** Stable empty list, so a pending query does not hand out a new array every render */
const NO_NOTES: IStickyNote[] = [];

export default function StickyNotesManager() {
  const stickyNotesEnabled = useStore((state) => state.stickyNotesEnabled);
  const setStickyNotesEnabled = useStore((state) => state.setStickyNotesEnabled);
  const notes = useLiveQuery(() => db.stickyNotes.toArray()) ?? NO_NOTES;

  // Let the handlers below stay stable instead of being rebuilt whenever a note changes
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const [showPanel, setShowPanel] = useState(false);
  const [panelFullScreenNoteId, setPanelFullScreenNoteId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const selectedNoteIdRef = useRef(selectedNoteId);
  selectedNoteIdRef.current = selectedNoteId;

  // Preload all fonts used in sticky notes from IndexedDB
  useEffect(() => {
    if (notes.length > 0) {
      ensureFontsLoaded(notes.map(n => n.fontFamily));
    }
  }, [notes]);
  const [recentOpenedIds, setRecentOpenedIds] = useState<string[]>(() => getStoredIds(RECENT_OPENED_KEY));
  const [recentClosedIds, setRecentClosedIds] = useState<string[]>(() => getStoredIds(RECENT_CLOSED_KEY));

  const recordOpened = useCallback((id: string) => {
    setRecentOpenedIds(prev => {
      const next = [id, ...prev.filter(item => item !== id)].slice(0, 30);
      saveStoredIds(RECENT_OPENED_KEY, next);
      return next;
    });
    setRecentClosedIds(prev => {
      if (!prev.includes(id)) return prev;
      const next = prev.filter(item => item !== id);
      saveStoredIds(RECENT_CLOSED_KEY, next);
      return next;
    });
  }, []);

  const recordClosed = useCallback((id: string) => {
    setRecentClosedIds(prev => {
      const next = [id, ...prev.filter(item => item !== id)].slice(0, 30);
      saveStoredIds(RECENT_CLOSED_KEY, next);
      return next;
    });
  }, []);

  const [dockPos, setDockPos] = useState({ x: window.innerWidth - 70, y: window.innerHeight / 2 - 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [manualPos, setManualPos] = useState<{ x: number, y: number } | null>(null);
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
    onConfirm: () => { },
  });

  useLayoutEffect(() => {
    const isMobile = window.innerWidth < 640;
    const initialX = Math.max(10, window.innerWidth - 70);
    const initialY = Math.max(10, isMobile ? window.innerHeight - 240 : window.innerHeight / 2 - 100);
    setDockPos({ x: initialX, y: initialY });
  }, []);

  const activeNotes = useMemo(() => {
    return notes.filter(n => !n.isMinimized && (!showPanel || n.id !== panelFullScreenNoteId));
  }, [notes, showPanel, panelFullScreenNoteId]);
  const selectedNote = notes.find(n => n.id === selectedNoteId);

  // Handle clicking outside to deselect
  useEffect(() => {
    const handleGlobalPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.sticky-note-element') && !target.closest('.sticky-note-toolbar')) {
        setSelectedNoteId(null);
      }
    };
    window.addEventListener('pointerdown', handleGlobalPointerDown);
    return () => window.removeEventListener('pointerdown', handleGlobalPointerDown);
  }, []);

  // Update dock position based on selected note
  useEffect(() => {
    if (isDragging) return; // Don't auto-dock while user is dragging

    if (manualPos) {
      setDockPos(manualPos);
      return;
    }

    const isMobile = window.innerWidth < 640;

    if (isMobile) {
      // On mobile, keep toolbar at a consistent position without auto-repositioning on select/deselect
      setDockPos({ x: window.innerWidth - 70, y: window.innerHeight - 240 });
      return;
    }

    if (selectedNote && !selectedNote.isMinimized) {
      const actualWidth = Math.max(selectedNote.width, getMinNoteWidth());
      let newX = selectedNote.x + actualWidth + 16;
      if (newX + 60 > window.innerWidth) { // No space on right, move to left
        newX = selectedNote.x - 64;
      }
      if (newX < 10) newX = 10;

      let newY = selectedNote.y;
      if (newY + 300 > window.innerHeight) {
        newY = window.innerHeight - 320;
      }
      if (newY < 10) newY = 10;

      setDockPos({ x: newX, y: newY });
    } else {
      // Default position when no note selected
      setDockPos({ x: window.innerWidth - 70, y: window.innerHeight / 2 - 100 });
    }
  }, [selectedNoteId, selectedNote?.x, selectedNote?.y, selectedNote?.width, selectedNote?.isMinimized, isDragging, manualPos]);

  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 640;
      if (!manualPos) {
        setDockPos({
          x: window.innerWidth - 70,
          y: isMobile ? window.innerHeight - 240 : window.innerHeight / 2 - 100
        });
      } else {
        setManualPos(prev => {
          if (!prev) return null;
          return {
            x: Math.max(10, Math.min(window.innerWidth - 70, prev.x)),
            y: Math.max(10, Math.min(window.innerHeight - 300, prev.y))
          };
        });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [manualPos]);

  const handleAddCanvasNote = async () => {
    const maxZ = Math.max(...notes.map(n => n.zIndex || 20000), 20000);
    const maxOrder = notes.length > 0 ? Math.max(...notes.map(n => n.order || 0)) : 0;
    const newNote: IStickyNote = {
      id: uuidv4(),
      content: '',
      x: Math.random() * Math.max(80, window.innerWidth - 420) + 50,
      y: Math.random() * (window.innerHeight - 300) + 50,
      width: getMinNoteWidth(),
      height: 280,
      color: '#fef08a',
      fontFamily: 'Hind',
      fontSize: 15,
      isMinimized: false, // Adding from floating sticky panel shows note on canvas
      isMaximized: false,
      zIndex: maxZ + 1,
      order: maxOrder + 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.stickyNotes.add(newNote);
    setSelectedNoteId(newNote.id);
    recordOpened(newNote.id);
  };

  const handleAddManagerNote = async () => {
    const maxZ = Math.max(...notes.map(n => n.zIndex || 20000), 20000);
    const maxOrder = notes.length > 0 ? Math.max(...notes.map(n => n.order || 0)) : 0;
    const newNote: IStickyNote = {
      id: uuidv4(),
      content: '',
      x: Math.random() * Math.max(80, window.innerWidth - 420) + 50,
      y: Math.random() * (window.innerHeight - 300) + 50,
      width: getMinNoteWidth(),
      height: 280,
      color: '#fef08a',
      fontFamily: 'Hind',
      fontSize: 15,
      isMinimized: true, // Created in manager list
      isMaximized: false,
      zIndex: maxZ + 1,
      order: maxOrder + 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.stickyNotes.add(newNote);
    recordClosed(newNote.id);
  };

  const handleUpdate = useCallback(async (note: IStickyNote) => {
    const prev = notesRef.current.find(n => n.id === note.id);
    if (prev && !prev.isMinimized && note.isMinimized) {
      recordClosed(note.id);
    } else if (prev && prev.isMinimized && !note.isMinimized) {
      recordOpened(note.id);
    }
    await db.stickyNotes.put(note);
  }, [recordClosed, recordOpened]);

  const performDirectDelete = useCallback(async (id: string) => {
    await db.stickyNotes.delete(id);
    if (selectedNoteIdRef.current === id) {
      setSelectedNoteId(null);
    }
    setRecentOpenedIds(prev => {
      const next = prev.filter(item => item !== id);
      saveStoredIds(RECENT_OPENED_KEY, next);
      return next;
    });
    setRecentClosedIds(prev => {
      const next = prev.filter(item => item !== id);
      saveStoredIds(RECENT_CLOSED_KEY, next);
      return next;
    });
  }, []);

  const handleDockDeleteNote = async (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Sticky Note',
      message: 'Are you sure you want to delete this sticky note?',
      confirmText: 'Delete Note',
      onConfirm: () => performDirectDelete(id),
    });
  };

  const handleDeleteAll = async () => {
    if (notes.length === 0) return;
    setConfirmConfig({
      isOpen: true,
      title: 'Delete All Sticky Notes',
      message: `Are you sure you want to delete ALL ${notes.length} sticky note(s)? This action cannot be undone.`,
      confirmText: `Delete All (${notes.length})`,
      onConfirm: async () => {
        await db.stickyNotes.clear();
        setSelectedNoteId(null);
        setRecentOpenedIds([]);
        setRecentClosedIds([]);
        saveStoredIds(RECENT_OPENED_KEY, []);
        saveStoredIds(RECENT_CLOSED_KEY, []);
      },
    });
  };

  const handleDuplicate = useCallback(async (note: IStickyNote) => {
    const notes = notesRef.current;
    const maxZ = Math.max(...notes.map(n => n.zIndex || 20000), 20000);
    const maxOrder = notes.length > 0 ? Math.max(...notes.map(n => n.order || 0)) : 0;
    const duplicated: IStickyNote = {
      ...note,
      id: uuidv4(),
      x: note.x + 30,
      y: note.y + 30,
      isMinimized: false,
      isMaximized: false,
      zIndex: maxZ + 1,
      order: maxOrder + 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.stickyNotes.add(duplicated);
    setSelectedNoteId(duplicated.id);
    recordOpened(duplicated.id);
  }, [recordOpened]);

  // Runs on every pointer down inside a note, so it must not write unless the order changes
  const handleFocus = useCallback(async (id: string) => {
    recordOpened(id);
    const notes = notesRef.current;
    setSelectedNoteId(current => (current === id ? current : id));

    const note = notes.find(n => n.id === id);
    if (!note) return;

    const maxZ = Math.max(...notes.map(n => n.zIndex || 20000), 20000);
    if (note.zIndex === maxZ) return;

    await db.stickyNotes.update(id, { zIndex: maxZ + 1 });
  }, [recordOpened]);

  // Find which note should be reopened/focused
  const recentTarget = useMemo(() => {
    if (notes.length === 0) return null;

    // 1. Look for a closed (minimized) note in recently closed history
    for (const id of recentClosedIds) {
      const match = notes.find(n => n.id === id);
      if (match && match.isMinimized) return match;
    }

    // 2. Look for a closed (minimized) note in recently opened history
    for (const id of recentOpenedIds) {
      const match = notes.find(n => n.id === id);
      if (match && match.isMinimized) return match;
    }

    // 3. Fallback: most recently updated closed note
    const minimizedNotes = notes.filter(n => n.isMinimized);
    if (minimizedNotes.length > 0) {
      return [...minimizedNotes].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    }

    // 4. If all notes are open, pick the most recent opened note to focus
    for (const id of recentOpenedIds) {
      const match = notes.find(n => n.id === id);
      if (match) return match;
    }

    return [...notes].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  }, [notes, recentClosedIds, recentOpenedIds]);

  const hasClosedNotes = useMemo(() => notes.some(n => n.isMinimized), [notes]);

  const recentNoteTooltip = useMemo(() => {
    if (!recentTarget) return 'No sticky notes to reopen';
    const text = extractTextFromLexical(recentTarget.content).trim();
    let snippet = 'Empty note';
    if (text) {
      const firstLine = text.split('\n')[0].replace(/^[-*]\s+(\[[ xX]\]\s*)?/, '').trim();
      snippet = firstLine ? (firstLine.length > 25 ? `${firstLine.slice(0, 25)}…` : firstLine) : 'Empty note';
    }

    if (recentTarget.isMinimized) {
      return `Reopen recent note: "${snippet}"`;
    }
    return `Focus recent note: "${snippet}"`;
  }, [recentTarget]);

  const handleReopenRecentNote = async () => {
    if (!recentTarget) return;

    if (showPanel) {
      setShowPanel(false);
      setPanelFullScreenNoteId(null);
    }

    if (recentTarget.isMinimized) {
      // Ensure the note is visible in the current viewport
      let { x, y } = recentTarget;
      const padding = 20;
      const noteWidth = Math.max(recentTarget.width || getMinNoteWidth(), 200);
      const noteHeight = Math.max(recentTarget.height || 280, 180);

      if (x + 100 > window.innerWidth) {
        x = Math.max(padding, window.innerWidth - noteWidth - padding);
      }
      if (y + 100 > window.innerHeight) {
        y = Math.max(padding, window.innerHeight - noteHeight - padding);
      }
      x = Math.max(padding, x);
      y = Math.max(padding, y);

      const maxZ = Math.max(...notes.map(n => n.zIndex || 20000), 20000);

      await db.stickyNotes.update(recentTarget.id, {
        isMinimized: false,
        isMaximized: false,
        zIndex: maxZ + 1,
        x,
        y,
        updatedAt: Date.now(),
      });

      setSelectedNoteId(recentTarget.id);
      recordOpened(recentTarget.id);
    } else {
      await handleFocus(recentTarget.id);
    }
  };

  const handleToolbarGrabPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);

    const startPointerX = e.clientX;
    const startPointerY = e.clientY;
    const startDockX = dockPos.x;
    const startDockY = dockPos.y;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startPointerX;
      const deltaY = moveEvent.clientY - startPointerY;
      const newX = Math.max(10, Math.min(window.innerWidth - 70, startDockX + deltaX));
      const newY = Math.max(10, Math.min(window.innerHeight - 300, startDockY + deltaY));
      const newPos = { x: newX, y: newY };
      setManualPos(newPos);
      setDockPos(newPos);
    };

    const onPointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  if (!stickyNotesEnabled) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[19000] no-export" data-capture-exclude="true">

      {/* Floating toolbar dock */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: dockPos.x, y: dockPos.y }}
        animate={{ opacity: 1, scale: 1, x: dockPos.x, y: dockPos.y }}
        transition={{ type: "spring", damping: 25, stiffness: 200, mass: 0.8 }}
        className={`sticky-note-toolbar fixed flex flex-col items-center gap-1 rounded-[20px] p-1.5 pointer-events-auto z-[22000] ${DOCK_SURFACE}`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Grab handle, the only part that starts a drag */}
        <div
          className="flex w-full cursor-grab touch-none justify-center pb-0.5 pt-1 text-black/20 dark:text-white/20 transition-colors hover:text-black/45 dark:hover:text-white/45 active:cursor-grabbing"
          onPointerDown={handleToolbarGrabPointerDown}
          title="Drag toolbar"
        >
          <GripHorizontal size={14} />
        </div>

        {/* Add note, the one thing this toolbar is mostly for */}
        <button
          onClick={handleAddCanvasNote}
          className="group flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400 text-black/80 ring-1 ring-inset ring-black/10 transition-all hover:bg-amber-300 hover:text-black active:scale-95"
          title="New sticky note"
          aria-label="New sticky note"
        >
          <Plus size={18} className="transition-transform duration-300 group-hover:rotate-90" />
        </button>

        {/* Reopen recent note that was opened last time or recently closed */}
        <button
          onClick={handleReopenRecentNote}
          disabled={!recentTarget}
          className={`relative ${DOCK_BUTTON} ${
            !recentTarget
              ? 'opacity-35 cursor-not-allowed hover:bg-transparent dark:hover:bg-transparent hover:text-black/60 dark:hover:text-white/60'
              : 'hover:text-black dark:hover:text-white'
          }`}
          title={recentNoteTooltip}
          aria-label={recentNoteTooltip}
        >
          <RotateCcw size={16} className="transition-transform duration-200 hover:-rotate-45" />
          {hasClosedNotes && (
            <span
              className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-[#1c1c1f]"
              title="Closed note available to reopen"
            />
          )}
        </button>

        {/* All notes, with how many there are */}
        <button
          onClick={() => setShowPanel(true)}
          className={`relative ${DOCK_BUTTON}`}
          title="All notes"
          aria-label={`All notes (${notes.length})`}
        >
          <List size={16} />
          {notes.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-black/75 px-1 text-[9px] font-bold tabular-nums text-white dark:bg-white/85 dark:text-black">
              {notes.length > 99 ? '99+' : notes.length}
            </span>
          )}
        </button>

        {/* Actions for the note you have selected */}
        <AnimatePresence mode="popLayout">
          {selectedNote && !selectedNote.isMinimized && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex w-full flex-col items-center gap-1 overflow-hidden"
            >
              <div className="my-0.5 h-px w-5 bg-black/10 dark:bg-white/10" />

              <button
                onClick={() => handleDuplicate(selectedNote)}
                className={DOCK_BUTTON}
                title="Duplicate note"
                aria-label="Duplicate note"
              >
                <CopyPlus size={16} />
              </button>

              <button
                onClick={() => handleDockDeleteNote(selectedNote.id)}
                className={DOCK_BUTTON_DANGER}
                title="Delete this note"
                aria-label="Delete this note"
              >
                <Trash2 size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="my-0.5 h-px w-5 bg-black/10 dark:bg-white/10" />

        {/* Clearing everything sits on its own, well away from the single-note delete */}
        {notes.length > 0 && (
          <button
            onClick={handleDeleteAll}
            className={`relative ${DOCK_BUTTON} hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10`}
            title={`Delete all ${notes.length} notes`}
            aria-label={`Delete all ${notes.length} notes`}
          >
            <Trash size={16} />
          </button>
        )}

        <button
          onClick={() => setStickyNotesEnabled(false)}
          className={DOCK_BUTTON}
          title="Hide sticky notes"
          aria-label="Hide sticky notes"
        >
          <Power size={16} />
        </button>
      </motion.div>

      {/* Render Sticky Notes */}
      <AnimatePresence>
        {activeNotes.map(note => (
          <div key={note.id} className="pointer-events-auto sticky-note-element">
            <StickyNote
              note={note}
              onDelete={performDirectDelete}
              onUpdate={handleUpdate}
              onDuplicate={handleDuplicate}
              onFocus={handleFocus}
            />
          </div>
        ))}
      </AnimatePresence>

      {/* Show All Notes Panel */}
      <AnimatePresence>
        {showPanel && (
          <StickyNotesPanel
            onClose={() => {
              setPanelFullScreenNoteId(null);
              setShowPanel(false);
            }}
            onFocus={(n) => {
              handleFocus(n.id);
              setPanelFullScreenNoteId(null);
              setShowPanel(false);
            }}
            onDuplicate={handleDuplicate}
            onAdd={handleAddManagerNote}
            onUpdate={handleUpdate}
            onFullScreenNoteChange={(id) => {
              setPanelFullScreenNoteId(id);
              if (id) recordOpened(id);
            }}
          />
        )}
      </AnimatePresence>

      <StickyConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        onConfirm={confirmConfig.onConfirm}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
