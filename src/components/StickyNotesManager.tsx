import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Trash, CopyPlus, Power, List, GripHorizontal } from 'lucide-react';
import { db, StickyNote as IStickyNote } from '../lib/db';
import StickyNote from './StickyNote';
import StickyNotesPanel from './StickyNotesPanel';
import { useStore } from '../store/useStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { getMinNoteWidth } from '../utils/NoteUtils';
import { ensureFontsLoaded } from '../utils/fontRegistry';

import StickyConfirmModal from './notes/StickyConfirmModal';

const COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff', '#fed7aa', '#fbcfe8'];

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
  const [showColors, setShowColors] = useState(false);
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
        setShowColors(false);
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
  };

  const handleUpdate = useCallback(async (note: IStickyNote) => {
    await db.stickyNotes.put(note);
  }, []);

  const performDirectDelete = useCallback(async (id: string) => {
    await db.stickyNotes.delete(id);
    if (selectedNoteIdRef.current === id) {
      setSelectedNoteId(null);
      setShowColors(false);
    }
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
        setShowColors(false);
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
  }, []);

  // Runs on every pointer down inside a note, so it must not write unless the order changes
  const handleFocus = useCallback(async (id: string) => {
    const notes = notesRef.current;
    setSelectedNoteId(current => (current === id ? current : id));

    const note = notes.find(n => n.id === id);
    if (!note) return;

    const maxZ = Math.max(...notes.map(n => n.zIndex || 20000), 20000);
    if (note.zIndex === maxZ) return;

    await db.stickyNotes.update(id, { zIndex: maxZ + 1 });
  }, []);

  const changeColor = async (color: string) => {
    if (selectedNote) {
      await handleUpdate({ ...selectedNote, color, updatedAt: Date.now() });
      setShowColors(false);
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

              <div className="relative">
                <button
                  onClick={() => setShowColors(!showColors)}
                  className={showColors ? DOCK_BUTTON_ACTIVE : DOCK_BUTTON}
                  title="Note colour"
                  aria-label="Note colour"
                >
                  <span
                    className="h-4 w-4 rounded-full ring-1 ring-inset ring-black/15 dark:ring-white/25"
                    style={{ backgroundColor: selectedNote.color }}
                  />
                </button>

                <AnimatePresence>
                  {showColors && (
                    <motion.div
                      initial={{ opacity: 0, x: 8, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: 8, scale: 0.95 }}
                      transition={{ duration: 0.14, ease: 'easeOut' }}
                      className={`absolute right-[115%] top-0 flex cursor-default flex-col gap-1.5 rounded-2xl p-2 ${DOCK_SURFACE}`}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => changeColor(c)}
                          title="Change colour"
                          className={`h-6 w-6 rounded-full transition-transform hover:scale-110 active:scale-95 ${selectedNote.color === c
                            ? 'ring-2 ring-black/30 dark:ring-white/60 ring-offset-2 ring-offset-white dark:ring-offset-[#1c1c1f]'
                            : 'ring-1 ring-inset ring-black/10 dark:ring-white/20'
                            }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

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
            onFullScreenNoteChange={setPanelFullScreenNoteId}
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
