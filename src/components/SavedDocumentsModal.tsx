import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type SavedDocument } from '../lib/db';
import { useStore } from '../store/useStore';
import { X, Save, FolderOpen, Trash2, Search, Plus, Copy, Edit2, Pin, Clock, AlertTriangle, FileCode, Check, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import CustomSelect from './CustomSelect';

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
        <div className="fixed inset-0 z-[1000] flex items-center justify-center sm:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />

          <motion.div 
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 15 }}
            className="relative w-full max-w-4xl h-[100dvh] sm:h-[85vh] bg-white dark:bg-slate-900 border-0 sm:border border-slate-200 dark:border-slate-800 shadow-2xl rounded-none sm:rounded-3xl flex flex-col overflow-hidden text-slate-900 dark:text-slate-100"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-white/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800/80 backdrop-blur shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-500/20">
                  <FolderOpen size={22} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">Document Manager</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Manage, organize, and switch your saved visualizations</p>
                </div>
              </div>
              <button 
                onClick={onClose} 
                className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Controls Bar: Search, Sort & Create */}
            <div className="p-4 sm:p-5 bg-slate-50/70 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800/80 space-y-3 shrink-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Search Box */}
                <div className="relative sm:col-span-2">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search documents by name..."
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-900 dark:text-slate-100 transition-all placeholder:text-slate-400"
                  />
                </div>
                
                {/* Custom Sort By Dropdown */}
                <CustomSelect
                  value={sortBy}
                  onChange={(val) => setSortBy(val as any)}
                  options={[
                    { label: "Recently Modified", value: "modified" },
                    { label: "Created Date", value: "created" },
                    { label: "Name (A-Z)", value: "name" },
                  ]}
                  className="w-full"
                  icon={<Filter size={13} />}
                />
              </div>

              {/* Create New Document Bar */}
              <div className="flex gap-2 p-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <input 
                  type="text" 
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateNew()}
                  placeholder="Enter new document name..."
                  className="flex-1 bg-transparent px-3 py-1.5 text-xs outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                />
                <button 
                  onClick={handleCreateNew}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all active:scale-95 shadow-md shadow-blue-500/20"
                >
                  <Plus size={15} /> 
                  <span>Create Document</span>
                </button>
              </div>
            </div>

            {/* Document List View */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-100/50 dark:bg-slate-950/80 custom-scrollbar relative min-h-0">
              {documents === undefined ? (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs font-mono tracking-widest animate-pulse">LOADING DOCUMENTS...</div>
              ) : filteredAndSortedDocs.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                  <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl mb-3 border border-slate-200 dark:border-slate-800 shadow-sm">
                    <FolderOpen size={36} className="text-slate-400" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Documents Found</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">Create a new document above or try adjusting your search filter.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredAndSortedDocs.map((doc) => (
                    <div 
                      key={doc.id} 
                      className={`group flex flex-col p-4 rounded-2xl border transition-all duration-200 relative overflow-hidden
                        ${activeDocumentId === doc.id 
                            ? 'border-blue-500 bg-white dark:bg-slate-900 ring-2 ring-blue-500/20 shadow-lg' 
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md'
                        }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <div className={`p-2 rounded-xl shrink-0 ${activeDocumentId === doc.id ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                            <FileCode size={16} />
                          </div>
                          
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
                              className="flex-1 bg-slate-50 dark:bg-slate-950 border border-blue-500 rounded-lg px-2 py-1 text-xs outline-none text-slate-900 dark:text-white"
                            />
                          ) : (
                            <span 
                              onClick={() => handleLoad(doc)}
                              className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                              title={doc.name}
                            >
                              {doc.name}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1 shrink-0">
                          <button 
                            onClick={() => handleTogglePin(doc)}
                            className={`p-1.5 rounded-lg transition-colors ${doc.isPinned ? 'text-amber-500 bg-amber-500/10' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            title={doc.isPinned ? "Unpin Document" : "Pin Document"}
                          >
                            <Pin size={13} className={doc.isPinned ? "fill-current" : ""} />
                          </button>
                        </div>
                      </div>

                      {/* Card Footer Info */}
                      <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100 dark:border-slate-800/80">
                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                          <Clock size={11} className="text-slate-400 shrink-0" />
                          <span>{new Date(doc.updatedAt).toLocaleDateString()} {new Date(doc.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>

                        {activeDocumentId === doc.id ? (
                          <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md flex items-center gap-1 tracking-wider border border-emerald-500/20">
                            <Check size={10} strokeWidth={3} />
                            <span>ACTIVE</span>
                          </div>
                        ) : (
                          <button 
                             onClick={() => handleLoad(doc)}
                             className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline uppercase tracking-wider"
                          >
                            Open →
                          </button>
                        )}
                      </div>

                      {/* Action hover overlay bar */}
                      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 dark:bg-slate-900/95 p-1 rounded-xl shadow-md border border-slate-200 dark:border-slate-800 backdrop-blur z-10">
                        <button onClick={(e) => { e.stopPropagation(); setEditingId(doc.id); setEditName(doc.name); }} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors" title="Rename"><Edit2 size={12} /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDuplicate(doc); }} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors" title="Duplicate"><Copy size={12} /></button>
                        <button onClick={(e) => handleDelete(doc.id, e)} className="p-1 hover:bg-red-500/10 rounded-lg text-slate-500 dark:text-slate-400 hover:text-red-500 transition-colors" title="Delete"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Confirm Overlay */}
            <AnimatePresence>
              {confirmAction && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
                >
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2.5 rounded-xl ${confirmAction.type === 'delete' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                        <AlertTriangle size={20} />
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">{confirmAction.title}</h3>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed mb-5">{confirmAction.message}</p>
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => {
                          if (confirmAction.type === 'delete' && confirmAction.actionId) {
                            confirmDelete(confirmAction.actionId);
                          } else if (confirmAction.type === 'switch' && confirmAction.doc) {
                            performLoad(confirmAction.doc);
                          }
                        }}
                        className={`w-full py-2.5 text-xs font-bold text-white rounded-xl transition-all active:scale-95 shadow-md ${confirmAction.type === 'delete' ? 'bg-red-600 hover:bg-red-500 shadow-red-600/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'}`}
                      >
                        {confirmAction.type === 'delete' ? 'Confirm Delete' : 'Discard & Switch'}
                      </button>
                      <button 
                        onClick={() => setConfirmAction(null)}
                        className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                      >
                        Cancel
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
