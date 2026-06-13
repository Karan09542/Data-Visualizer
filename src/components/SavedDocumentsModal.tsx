import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type SavedDocument } from '../lib/db';
import { useStore } from '../store/useStore';
import { X, Save, FolderOpen, Trash2, Search, Plus, MoreVertical, Copy, Edit2, Pin, Clock } from 'lucide-react';

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#0d1117] w-full max-w-2xl rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#161b22]/50">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FolderOpen size={20} className="text-blue-500" />
            Document Manager
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="w-full bg-slate-50 dark:bg-[#161b22] border border-slate-300 dark:border-slate-700 rounded-md pl-9 pr-3 py-2 text-sm outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200 transition-colors"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-50 dark:bg-[#161b22] border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200"
              >
                <option value="modified">Recently Modified</option>
                <option value="created">Created Date</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 isolate pt-2 border-t border-slate-100 dark:border-slate-800/50 mt-1">
            <input 
              type="text" 
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateNew()}
              placeholder="New document name..."
              className="flex-1 bg-white dark:bg-[#0d1117] border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
            />
            <button 
              onClick={handleCreateNew}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors shrink-0 shadow-sm"
            >
              <Plus size={16} /> Create New
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 bg-slate-50 dark:bg-[#0d1117] custom-scrollbar relative min-h-[300px]">
          {documents === undefined ? (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">Loading documents...</div>
          ) : filteredAndSortedDocs.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 text-sm">
              <FolderOpen size={48} className="text-slate-300 dark:text-slate-700 mb-4" />
              <p>No documents found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredAndSortedDocs.map((doc) => (
                <div 
                  key={doc.id} 
                  className={`flex flex-col p-3 rounded-lg border transition-all select-none
                    ${activeDocumentId === doc.id 
                        ? 'border-blue-500 ring-1 ring-blue-500/20 bg-blue-50/50 dark:bg-blue-500/10' 
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-[#161b22]'
                    }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <button 
                        onClick={() => handleTogglePin(doc)}
                        className={`shrink-0 ${doc.isPinned ? 'text-blue-500' : 'text-slate-300 dark:text-slate-600 hover:text-slate-400'}`}
                        title={doc.isPinned ? "Unpin" : "Pin"}
                      >
                        <Pin size={14} className={doc.isPinned ? "fill-current" : ""} />
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
                          className="flex-1 bg-white dark:bg-[#0d1117] border border-blue-500 rounded px-1.5 py-0.5 text-sm outline-none"
                        />
                      ) : (
                        <span 
                          onClick={() => handleLoad(doc)}
                          className="font-semibold text-slate-800 dark:text-slate-200 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          {doc.name}
                        </span>
                      )}
                    </div>
                    
                    {/* Inline Actions */}
                    <div className="flex items-center gap-1 opacity-60 hover:opacity-100 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); setEditingId(doc.id); setEditName(doc.name); }} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors text-slate-600 dark:text-slate-400" title="Rename"><Edit2 size={14} /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDuplicate(doc); }} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors text-slate-600 dark:text-slate-400" title="Duplicate"><Copy size={14} /></button>
                      <button onClick={(e) => handleDelete(doc.id, e)} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors text-slate-600 dark:text-slate-400 hover:text-red-600" title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-auto">
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      <Clock size={12} /> {new Date(doc.updatedAt).toLocaleDateString()} {new Date(doc.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                    
                    {activeDocumentId === doc.id ? (
                      <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                        Active
                      </span>
                    ) : (
                      <button 
                         onClick={() => handleLoad(doc)}
                         className="text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
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
      </div>

      {confirmAction && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-xl">
          <div className="bg-white dark:bg-[#161b22] p-6 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">{confirmAction.title}</h3>
            <p className="text-slate-600 dark:text-slate-300 text-sm mb-6">{confirmAction.message}</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (confirmAction.type === 'delete' && confirmAction.actionId) {
                    confirmDelete(confirmAction.actionId);
                  } else if (confirmAction.type === 'switch' && confirmAction.doc) {
                    performLoad(confirmAction.doc);
                  }
                }}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${confirmAction.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {confirmAction.type === 'delete' ? 'Delete Document' : 'Discard & Switch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
