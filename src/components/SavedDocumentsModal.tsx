import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type SavedDocument } from '../lib/db';
import { useStore } from '../store/useStore';
import { X, Save, FolderOpen, Trash2, Search, Plus, MoreVertical, Copy, Edit2, Pin, Clock, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';

export default function SavedDocumentsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { code, setCode, activeDocumentId, setActiveDocumentId, setIsDirty, isDirty, setActiveDocumentName } = useStore();
  const [docName, setDocName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'modified' | 'created' | 'name'>('modified');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmAction, setConfirmAction] = useState<{
    type: 'delete' | 'switch';
    title: string;
    message: string;
    actionId?: number;
    doc?: SavedDocument;
  } | null>(null);

  const documents = useLiveQuery(() => db.documents.toArray());

  const filteredAndSortedDocs = useMemo(() => {
    if (!documents) return [];
    
    let filtered = documents;
    if (searchQuery) {
      filtered = filtered.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    return filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      
      switch (sortBy) {
        case 'modified': return b.updatedAt - a.updatedAt;
        case 'created': return b.createdAt - a.createdAt;
        case 'name': return a.name.localeCompare(b.name);
        default: return 0;
      }
    });
  }, [documents, searchQuery, sortBy]);

  const handleCreateNew = async () => {
    if (!docName.trim()) {
      useStore.getState().setNotification({ message: 'Please enter a document name', type: 'error' });
      return;
    }
    const defaultCode = "{\n  \n}";
    const newId = await db.documents.add({
      name: docName.trim(),
      code: defaultCode,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isPinned: false
    });
    setActiveDocumentId(newId as number);
    setActiveDocumentName(docName.trim());
    useStore.getState().setLastSavedCode(defaultCode);
    setCode(defaultCode);
    setIsDirty(false);
    setDocName('');
    useStore.getState().setNotification({ message: 'Document created successfully', type: 'success' });
  };

  const handleDuplicate = async (doc: SavedDocument) => {
    await db.documents.add({
      name: `${doc.name} Copy`,
      code: doc.code,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isPinned: false
    });
    useStore.getState().setNotification({ message: 'Document duplicated', type: 'success' });
  };

  const handleTogglePin = async (doc: SavedDocument) => {
    await db.documents.update(doc.id, { isPinned: !doc.isPinned });
  };

  const handleSaveRename = async (id: number) => {
    if (!editName.trim()) return;
    await db.documents.update(id, { name: editName.trim() });
    if (activeDocumentId === id) setActiveDocumentName(editName.trim());
    setEditingId(null);
  };

  const handleLoad = async (doc: SavedDocument) => {
    if (activeDocumentId === doc.id) {
       onClose();
       return;
    }

    if (!activeDocumentId && isDirty) {
      setConfirmAction({
        type: 'switch',
        title: 'Unsaved Changes',
        message: 'Your current document is unnamed and has unsaved changes. Switch and discard them?',
        doc
      });
      return;
    } else if (activeDocumentId && isDirty) {
      setConfirmAction({
        type: 'switch',
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Switch without saving?',
        doc
      });
      return;
    }

    performLoad(doc);
  };

  const performLoad = (doc: SavedDocument) => {
    useStore.getState().setLastSavedCode(doc.code);
    setActiveDocumentId(doc.id);
    setActiveDocumentName(doc.name);
    setCode(doc.code);
    setIsDirty(false);
    setConfirmAction(null);
    onClose();
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setConfirmAction({
      type: 'delete',
      title: 'Delete Document',
      message: 'Are you sure you want to delete this document?',
      actionId: id
    });
  };

  const confirmDelete = async (id: number) => {
    if (activeDocumentId === id) {
      setActiveDocumentId(null);
      setActiveDocumentName(null);
    }
    await db.documents.delete(id);
    setConfirmAction(null);
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center sm:p-4 bg-slate-950/90 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            className="relative w-full max-w-4xl h-[100dvh] sm:h-full max-h-none sm:max-h-[85vh] bg-slate-900 border-0 sm:border border-slate-800 shadow-2xl rounded-none sm:rounded-xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg shrink-0">
                  <FolderOpen size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white tracking-tight">Document Manager</h2>
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Saved Collections</p>
                </div>
              </div>
              <button 
                onClick={onClose} 
                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Toolbar */}
            <div className="p-4 bg-slate-900/50 border-b border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search documents..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:border-indigo-500/30 text-slate-200 transition-colors placeholder:text-slate-600"
                  />
                </div>
                
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500/30 text-slate-300 appearance-none cursor-pointer"
                >
                  <option value="modified">Recently Modified</option>
                  <option value="created">Created Date</option>
                  <option value="name">Name</option>
                </select>
              </div>

              <div className="flex gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800 shadow-inner">
                <input 
                  type="text" 
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateNew()}
                  placeholder="New document name..."
                  className="flex-1 bg-transparent px-3 py-1.5 text-xs outline-none text-slate-200 placeholder:text-slate-600"
                />
                <button 
                  onClick={handleCreateNew}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all active:scale-95 shadow-lg shadow-indigo-600/10"
                >
                  <Plus size={14} /> 
                  <span className="hidden sm:inline">Create New</span>
                  <span className="sm:hidden">Create</span>
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-slate-950 custom-scrollbar relative min-h-0">
              {documents === undefined ? (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs font-mono tracking-widest animate-pulse">LOADING DOCUMENTS...</div>
              ) : filteredAndSortedDocs.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 p-8 text-center">
                  <div className="p-4 bg-slate-900 rounded-full mb-4 border border-slate-800">
                    <FolderOpen size={32} className="text-slate-700" />
                  </div>
                  <p className="text-xs font-mono uppercase tracking-widest">No documents found</p>
                  <p className="text-[10px] mt-2 opacity-60">Create a new document to get started</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredAndSortedDocs.map((doc) => (
                    <div 
                      key={doc.id} 
                      className={`group flex flex-col p-3 rounded-xl border transition-all duration-200
                        ${activeDocumentId === doc.id 
                            ? 'border-indigo-500/50 bg-indigo-500/5 shadow-lg shadow-indigo-500/5' 
                            : 'border-slate-800 bg-slate-900 hover:border-slate-700 hover:bg-slate-900/80 shadow-sm'
                        }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <button 
                            onClick={() => handleTogglePin(doc)}
                            className={`shrink-0 transition-colors ${doc.isPinned ? 'text-indigo-400' : 'text-slate-700 hover:text-slate-500'}`}
                            title={doc.isPinned ? "Unpin" : "Pin"}
                          >
                            <Pin size={12} className={doc.isPinned ? "fill-current" : ""} />
                          </button>
                          
                          {editingId === doc.id ? (
                            <input
                              autoFocus
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onBlur={() => handleSaveRename(doc.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename(doc.id);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              className="flex-1 bg-slate-950 border border-indigo-500/50 rounded px-2 py-0.5 text-xs outline-none text-white"
                            />
                          ) : (
                            <span 
                              onClick={() => handleLoad(doc)}
                              className="text-xs font-semibold text-slate-200 truncate cursor-pointer hover:text-indigo-400 transition-colors"
                            >
                              {doc.name}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={(e) => { e.stopPropagation(); setEditingId(doc.id); setEditName(doc.name); }} className="p-1.5 hover:bg-slate-800 rounded-md transition-colors text-slate-500 hover:text-slate-300" title="Rename"><Edit2 size={12} /></button>
                          <button onClick={(e) => { e.stopPropagation(); handleDuplicate(doc); }} className="p-1.5 hover:bg-slate-800 rounded-md transition-colors text-slate-500 hover:text-slate-300" title="Duplicate"><Copy size={12} /></button>
                          <button onClick={(e) => handleDelete(doc.id, e)} className="p-1.5 hover:bg-red-500/10 rounded-md transition-colors text-slate-500 hover:text-red-400" title="Delete"><Trash2 size={12} /></button>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-800/50">
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1.5 text-[9px] text-slate-600 font-mono">
                            <Clock size={10} /> {new Date(doc.updatedAt).toLocaleDateString()}
                          </span>
                          <span className="text-[9px] text-slate-700 font-mono ml-4">
                            {new Date(doc.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        
                        {activeDocumentId === doc.id ? (
                          <div className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md flex items-center gap-1.5 tracking-widest border border-indigo-500/20">
                            <div className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse"></div>
                            ACTIVE
                          </div>
                        ) : (
                          <button 
                             onClick={() => handleLoad(doc)}
                             className="text-[10px] font-bold text-slate-500 hover:text-indigo-400 transition-colors uppercase tracking-widest"
                          >
                            Open →
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Backdrop Click */}
            <div 
              className="absolute inset-0 -z-10" 
              onClick={onClose}
            />

            {/* Confirm Overlay */}
            <AnimatePresence>
              {confirmAction && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4"
                >
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-slate-900 p-6 rounded-xl shadow-2xl border border-slate-800 max-w-sm w-full"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`p-2 rounded-lg ${confirmAction.type === 'delete' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                        <AlertTriangle size={20} />
                      </div>
                      <h3 className="text-sm font-bold text-white tracking-tight">{confirmAction.title}</h3>
                    </div>
                    <p className="text-slate-400 text-xs leading-relaxed mb-6">{confirmAction.message}</p>
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => {
                          if (confirmAction.type === 'delete' && confirmAction.actionId) {
                            confirmDelete(confirmAction.actionId);
                          } else if (confirmAction.type === 'switch' && confirmAction.doc) {
                            performLoad(confirmAction.doc);
                          }
                        }}
                        className={`w-full py-2 text-xs font-bold text-white rounded-lg transition-all active:scale-95 ${confirmAction.type === 'delete' ? 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/10' : 'bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/10'}`}
                      >
                        {confirmAction.type === 'delete' ? 'Confirm Delete' : 'Discard & Switch'}
                      </button>
                      <button 
                        onClick={() => setConfirmAction(null)}
                        className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        Go back
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

