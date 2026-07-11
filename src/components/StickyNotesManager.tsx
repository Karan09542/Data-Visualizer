import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue } from 'motion/react';
import { Plus, List, Trash2, StickyNote as StickyIcon } from 'lucide-react';
import { db, StickyNote as IStickyNote } from '../lib/db';
import StickyNote from './StickyNote';
import StickyNotesPanel from './StickyNotesPanel';
import { useStore } from '../store/useStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';

export default function StickyNotesManager() {
  const { stickyNotesEnabled } = useStore();
  const notes = useLiveQuery(() => db.stickyNotes.toArray()) || [];
  const [showPanel, setShowPanel] = useState(false);

  // Floating button position source of truth
  const [buttonPos, setButtonPos] = useState({ x: window.innerWidth - 80, y: 80 });

  // Motion values for smoother dragging and persistence
  const x = useMotionValue(buttonPos.x);
  const y = useMotionValue(buttonPos.y);

  // Sync motion values when source of truth changes (e.g. resize)
  useEffect(() => {
    x.set(buttonPos.x);
    y.set(buttonPos.y);
  }, [buttonPos, x, y]);

  useEffect(() => {
    const handleResize = () => {
      setButtonPos(prev => ({
        x: Math.min(prev.x, window.innerWidth - 60),
        y: Math.min(prev.y, window.innerHeight - 60)
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Active notes are those not minimized
  const activeNotes = notes.filter(n => !n.isMinimized);

  const handleAddNote = async () => {
    const maxZ = Math.max(...notes.map(n => n.zIndex || 5000), 5000);
    const newNote: IStickyNote = {
      id: uuidv4(),
      content: '',
      x: Math.random() * Math.max(80, window.innerWidth - 420) + 50,
      y: Math.random() * (window.innerHeight - 300) + 50,
      width: 360,
      height: 280,
      color: '#fef08a',
      fontFamily: 'Hind',
      fontSize: 15,
      isMinimized: false,
      isMaximized: false,
      zIndex: maxZ + 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.stickyNotes.add(newNote);
  };

  const handleUpdate = async (note: IStickyNote) => {
    await db.stickyNotes.put(note);
  };

  const handleDelete = async (id: string) => {
    await db.stickyNotes.delete(id);
  };

  const handleDuplicate = async (note: IStickyNote) => {
    const maxZ = Math.max(...notes.map(n => n.zIndex || 5000), 5000);
    const duplicated: IStickyNote = {
      ...note,
      id: uuidv4(),
      x: note.x + 30,
      y: note.y + 30,
      isMinimized: false,
      isMaximized: false,
      zIndex: maxZ + 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.stickyNotes.add(duplicated);
  };

  const handleFocus = async (id: string) => {
    const note = notes.find(n => n.id === id);
    if (!note) return;

    const maxZ = Math.max(...notes.map(n => n.zIndex || 5000), 5000);
    if (note.zIndex === maxZ && notes.length > 1) return;

    await db.stickyNotes.update(id, { zIndex: maxZ + 1 });
  };

  const handleClearAll = async () => {
    if (confirm('Delete all sticky notes?')) {
      await db.stickyNotes.clear();
    }
  };

  if (!stickyNotesEnabled) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[4900] no-export" data-capture-exclude="true">
      {/* Floating Action Button */}
      <motion.div
        drag
        dragMomentum={false}
        initial={{ opacity: 0, scale: 0.5 }}
        style={{ x, y }}
        animate={{ opacity: 1, scale: 1 }}
        onDragEnd={() => {
          setButtonPos({ x: x.get(), y: y.get() });
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowPanel(true);
        }}
        className="fixed w-14 h-14 bg-yellow-500 hover:bg-yellow-400 text-black rounded-full shadow-[0_10px_40px_rgba(234,179,8,0.3)] flex items-center justify-center pointer-events-auto cursor-grab active:cursor-grabbing border-4 border-white/30 group"
      >
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleAddNote();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute inset-0 w-full h-full flex items-center justify-center z-10 rounded-full"
          title="New Note (Right click for All)"
        >
          <Plus size={28} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>

        {/* Panel Button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowPanel(true);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute -left-12 w-10 h-10 bg-slate-800 text-slate-400 rounded-full flex items-center justify-center shadow-lg hover:bg-slate-700 hover:text-white transition-all scale-0 group-hover:scale-100 origin-right border border-slate-700 pointer-events-auto z-20"
          title="Show All Notes"
        >
          <List size={18} />
        </button>

        {/* Clear All button */}
        {notes.length > 0 && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleClearAll();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute -right-2 -top-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors scale-0 group-hover:scale-100 pointer-events-auto z-20"
            title="Clear All"
          >
            <Trash2 size={12} />
          </button>
        )}
      </motion.div>

      {/* Render Sticky Notes */}
      <AnimatePresence>
        {activeNotes.map(note => (
          <div key={note.id} className="pointer-events-auto">
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
            onAdd={handleAddNote}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
