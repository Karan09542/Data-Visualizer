import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, CopyPlus, Palette, Settings, Power, List, GripHorizontal } from 'lucide-react';
import { db, StickyNote as IStickyNote } from '../lib/db';
import StickyNote from './StickyNote';
import StickyNotesPanel from './StickyNotesPanel';
import { useStore } from '../store/useStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { getMinNoteWidth } from '../utils/NoteUtils';

const COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff', '#fed7aa', '#fbcfe8'];

export default function StickyNotesManager() {
  const { stickyNotesEnabled, setStickyNotesEnabled } = useStore();
  const notes = useLiveQuery(() => db.stickyNotes.toArray()) || [];
  const [showPanel, setShowPanel] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [showColors, setShowColors] = useState(false);
  const [dockPos, setDockPos] = useState({ x: window.innerWidth - 70, y: window.innerHeight / 2 - 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [manualPos, setManualPos] = useState<{ x: number, y: number } | null>(null);

  const activeNotes = notes.filter(n => !n.isMinimized);
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

  const handleUpdate = async (note: IStickyNote) => {
    await db.stickyNotes.put(note);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this sticky note?')) {
      await db.stickyNotes.delete(id);
      if (selectedNoteId === id) {
        setSelectedNoteId(null);
        setShowColors(false);
      }
    }
  };

  const handleDuplicate = async (note: IStickyNote) => {
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
  };

  const handleFocus = async (id: string) => {
    setSelectedNoteId(id);
    const note = notes.find(n => n.id === id);
    if (!note) return;

    const maxZ = Math.max(...notes.map(n => n.zIndex || 20000), 20000);
    if (note.zIndex === maxZ && notes.length > 1) return;

    await db.stickyNotes.update(id, { zIndex: maxZ + 1 });
  };

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
      
      {/* Vertical Glassmorphic Toolbar Dock */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1, x: dockPos.x, y: dockPos.y }}
        transition={{ type: "spring", damping: 25, stiffness: 200, mass: 0.8 }}
        className="sticky-note-toolbar fixed flex flex-col items-center p-1.5 gap-1 bg-white dark:bg-[#1a1a1a] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.18)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)] border border-black/5 dark:border-white/10 rounded-[20px] pointer-events-auto z-[22000]"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Grab Handle - only this initiates drag */}
        <div
          className="w-full flex justify-center pt-0.5 pb-1 opacity-40 hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={handleToolbarGrabPointerDown}
        >
           <GripHorizontal size={14} className="text-black/30 dark:text-white/30" />
        </div>

        {/* 1. Add Note - Vibrant Yellow to look like a sticky note */}
        <button
          onClick={handleAddCanvasNote}
          className="w-9 h-9 rounded-xl bg-yellow-400 hover:bg-yellow-500 shadow-[0_4px_12px_rgba(250,204,21,0.3)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all text-black group border border-yellow-300"
          title="Add Sticky Note"
        >
          <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>

        {/* 2. Enable/Disable */}
        <button
          onClick={() => setStickyNotesEnabled(false)}
          className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-black/70 dark:text-white/70"
          title="Disable Sticky Notes"
        >
          <Power size={16} />
        </button>

        <div className="w-6 h-px bg-black/10 dark:bg-white/10 mx-auto my-0.5" />

        {/* Contextual Actions */}
        <AnimatePresence mode="popLayout">
          {selectedNote && !selectedNote.isMinimized && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-col gap-1.5 w-full"
            >
              {/* 3. Duplicate */}
              <button
                onClick={() => handleDuplicate(selectedNote)}
                className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-black/70 dark:text-white/70"
                title="Duplicate Note"
              >
                <CopyPlus size={16} />
              </button>

              {/* 4. Change Color */}
              <div className="relative w-full">
                <button
                  onClick={() => setShowColors(!showColors)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${showColors ? 'bg-black/10 dark:bg-white/20' : 'hover:bg-black/10 dark:hover:bg-white/10'} text-black/70 dark:text-white/70`}
                  title="Change Color"
                >
                  <Palette size={16} />
                </button>
                {/* Color Picker Popup */}
                <AnimatePresence>
                  {showColors && (
                    <motion.div
                      initial={{ opacity: 0, x: 10, scale: 0.9 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: 10, scale: 0.9 }}
                      className="absolute top-0 right-[110%] flex flex-col gap-1.5 bg-white/95 dark:bg-[#1a1a1a]/95 p-2 rounded-2xl shadow-xl border border-black/5 dark:border-white/10 backdrop-blur-xl cursor-default"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => changeColor(c)}
                          className={`w-6 h-6 rounded-full border shadow-sm transition-transform hover:scale-110 active:scale-95 ${selectedNote.color === c ? 'border-black/30 dark:border-white/50 scale-110' : 'border-black/5 dark:border-white/10'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 5. List / Manage Notes (Changed from Settings to List icon) */}
        <button
          onClick={() => setShowPanel(true)}
          className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-black/70 dark:text-white/70"
          title="Manage All Notes"
        >
          <List size={16} />
        </button>

        {/* 6. Delete */}
        <AnimatePresence mode="popLayout">
          {selectedNote && !selectedNote.isMinimized && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <button
                onClick={() => handleDelete(selectedNote.id)}
                className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-red-500/20 dark:hover:bg-red-500/30 transition-colors text-red-700 dark:text-red-400 mt-0.5"
                title="Delete Note"
              >
                <Trash2 size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>

      {/* Render Sticky Notes */}
      <AnimatePresence>
        {activeNotes.map(note => (
          <div key={note.id} className="pointer-events-auto sticky-note-element">
            <StickyNote
              note={note}
              onDelete={handleDelete}
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
            onClose={() => setShowPanel(false)}
            onFocus={(n) => {
              handleFocus(n.id);
              setShowPanel(false);
            }}
            onDuplicate={handleDuplicate}
            onAdd={handleAddManagerNote}
            onUpdate={handleUpdate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
