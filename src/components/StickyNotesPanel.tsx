import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Search, SortAsc, SortDesc, Trash2, Edit3, Plus, ExternalLink, Calendar, List, CopyPlus } from 'lucide-react';
import { db, StickyNote as IStickyNote } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { createPortal } from 'react-dom';

interface Props {
  onClose: () => void;
  onFocus: (note: IStickyNote) => void;
  onDuplicate: (note: IStickyNote) => void;
  onAdd: () => void;
}

export default function StickyNotesPanel({ onClose, onFocus, onDuplicate, onAdd }: Props) {
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const allNotes = useLiveQuery(() => db.stickyNotes.toArray()) || [];

  const filteredNotes = allNotes
    .filter(n => n.content.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortOrder === 'desc' ? b.updatedAt - a.updatedAt : a.updatedAt - b.updatedAt);

  const handleDelete = async (id: string) => {
    if (confirm('Delete this note?')) {
      await db.stickyNotes.delete(id);
    }
  };

  const handleRestore = async (note: IStickyNote) => {
    await db.stickyNotes.put({ ...note, isMinimized: false, updatedAt: Date.now() });
    onFocus(note);
  };

  return createPortal(
    <div className="fixed inset-0 z-[6000] flex items-center justify-center sm:p-4 p-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full h-full sm:h-[80vh] sm:max-w-2xl bg-slate-900 sm:border border-slate-800 shadow-2xl sm:rounded-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/10 text-yellow-500 rounded-xl">
              <List size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Workspace Notes</h2>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-[0.2em]">{allNotes.length} Total Notes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onAdd}
              className="p-2.5 bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl transition-all active:scale-95"
              title="New Note"
            >
              <Plus size={18} />
            </button>
            <button
              onClick={onClose}
              className="p-2.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/30 flex items-center gap-4 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Search notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/50 text-slate-200 placeholder:text-slate-600"
            />
          </div>
          <button
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors border border-slate-700"
          >
            {sortOrder === 'desc' ? <SortDesc size={14} /> : <SortAsc size={14} />}
            {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
          </button>
        </div>

        {/* Notes Grid */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
          {filteredNotes.length > 0 ? (
            filteredNotes.map(note => (
              <div
                key={note.id}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-800/40 border border-slate-700/50 rounded-2xl hover:border-yellow-500/30 hover:bg-slate-800/60 transition-all cursor-default"
              >
                <div className="flex-1 min-w-0 flex items-start gap-4">
                  <div
                    className="w-3 h-3 mt-1.5 rounded-full shrink-0 border border-black/10"
                    style={{ backgroundColor: note.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-slate-200 font-medium line-clamp-1 group-hover:line-clamp-none transition-all">
                      {note.content || <span className="opacity-30 italic">No content</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                        <Calendar size={10} />
                        {new Date(note.updatedAt).toLocaleDateString()}
                      </span>
                      {note.isMinimized && (
                        <span className="px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded text-[9px] font-bold uppercase tracking-wider border border-slate-600">
                          Minimized
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleRestore(note)}
                    className="p-2 hover:bg-yellow-500/10 text-yellow-500 rounded-lg transition-colors"
                    title="Open on Canvas"
                  >
                    <ExternalLink size={16} />
                  </button>
                  <button
                    onClick={() => onDuplicate(note)}
                    className="p-2 hover:bg-blue-500/10 text-blue-400 rounded-lg transition-colors"
                    title="Duplicate"
                  >
                    <CopyPlus size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(note.id)}
                    className="p-2 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
              <Edit3 size={40} strokeWidth={1.5} className="mb-4" />
              <p className="text-sm font-medium">No notes found</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-center">
          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">
            Drag to reposition workspace button
          </p>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
