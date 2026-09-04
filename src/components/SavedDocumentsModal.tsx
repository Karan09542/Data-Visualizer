import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type SavedDocument } from '../lib/db';
import { useStore } from '../store/useStore';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  Copy,
  Edit2,
  FileCode,
  Files,
  Filter,
  FolderOpen,
  Pin,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import CustomSelect from './CustomSelect';

const formatTimestamp = (timestamp: number) =>
  new Date(timestamp).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const formatCreatedDate = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const getLineLabel = (code: string) => {
  const lineCount = code ? code.split(/\r\n|\r|\n/).length : 0;
  return `${lineCount} ${lineCount === 1 ? 'line' : 'lines'}`;
};

export default function SavedDocumentsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const setCode = useStore((state) => state.setCode);
  const activeDocumentId = useStore((state) => state.activeDocumentId);
  const setActiveDocumentId = useStore((state) => state.setActiveDocumentId);
  const setIsDirty = useStore((state) => state.setIsDirty);
  const isDirty = useStore((state) => state.isDirty);
  const setActiveDocumentName = useStore((state) => state.setActiveDocumentName);
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
  const totalDocuments = documents?.length ?? 0;
  const pinnedDocuments = useMemo(() => documents?.filter((doc) => doc.isPinned).length ?? 0, [documents]);
  const activeDocument = useMemo(() => documents?.find((doc) => doc.id === activeDocumentId), [documents, activeDocumentId]);
  const isSearching = searchQuery.trim().length > 0;

  const filteredAndSortedDocs = useMemo(() => {
    if (!documents) return [];

    let filtered = [...documents];
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (normalizedQuery) {
      filtered = filtered.filter(d => d.name.toLowerCase().includes(normalizedQuery));
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

    // Clear runtime state to prevent bleeding across documents
    useStore.setState({
      apiNodeResponses: {},
      apiNodeLoading: {},
      apiNodeErrors: {},
      jsNodeResponses: {},
      jsNodeLoading: {},
      jsNodeErrors: {},
      jsNodeDurations: {},
      jsNodeLastRuns: {},
      jsNodeLogs: {},
      activePreviewMedia: null,
      activePreviewText: null,
      globalTextExpanded: false,
      collapsedNodes: new Set(),
    });

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

    // Clear runtime state to prevent bleeding across documents
    useStore.setState({
      apiNodeResponses: {},
      apiNodeLoading: {},
      apiNodeErrors: {},
      jsNodeResponses: {},
      jsNodeLoading: {},
      jsNodeErrors: {},
      jsNodeDurations: {},
      jsNodeLastRuns: {},
      jsNodeLogs: {},
      activePreviewMedia: null,
      activePreviewText: null,
      globalTextExpanded: false,
      collapsedNodes: new Set(),
    });

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
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm dark:bg-black/70"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 15 }}
            className="relative flex h-[100dvh] w-full max-w-5xl flex-col overflow-hidden rounded-none border-0 bg-slate-50 text-slate-900 shadow-2xl ring-1 ring-black/5 dark:bg-slate-950 dark:text-slate-100 sm:h-[86vh] sm:rounded-2xl sm:border sm:border-slate-200 dark:border-slate-800"
          >
            <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900 sm:px-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                    <FolderOpen size={22} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
                        Documents
                      </h2>
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {totalDocuments} saved
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
                      Saved visualizations and drafts
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {activeDocument && (
                    <div className="hidden max-w-[220px] items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300 md:flex">
                      <Check size={14} />
                      <span className="truncate">{activeDocument.name}</span>
                    </div>
                  )}
                  <button
                    onClick={onClose}
                    className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                    title="Close"
                    aria-label="Close documents"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            </div>

            <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900 sm:px-5">
              <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/70">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="relative flex-1">
                      <FileCode size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                      <input
                        type="text"
                        value={docName}
                        onChange={(e) => setDocName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateNew()}
                        placeholder="New document name"
                        className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                      />
                    </div>
                    <button
                      onClick={handleCreateNew}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 active:scale-[0.98] sm:w-auto"
                    >
                      <Plus size={16} />
                      <span>Create</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="relative">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search documents"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                  </div>

                  <CustomSelect
                    value={sortBy}
                    onChange={(val) => setSortBy(val as any)}
                    options={[
                      { label: 'Recently Modified', value: 'modified' },
                      { label: 'Created Date', value: 'created' },
                      { label: 'Name (A-Z)', value: 'name' },
                    ]}
                    className="w-full"
                    icon={<Filter size={14} />}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 dark:border-slate-800 dark:bg-slate-950">
                    <Files size={13} />
                    Showing {filteredAndSortedDocs.length} of {totalDocuments}
                  </span>
                  {pinnedDocuments > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                      <Pin size={13} className="fill-current" />
                      {pinnedDocuments} pinned
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="relative min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950 sm:p-5 custom-scrollbar">
              {documents === undefined ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((item) => (
                    <div
                      key={item}
                      className="h-20 animate-pulse rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                    />
                  ))}
                </div>
              ) : filteredAndSortedDocs.length === 0 ? (
                <div className="flex min-h-full items-center justify-center py-12">
                  <div className="w-full max-w-sm text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500">
                      <FolderOpen size={30} />
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                      {isSearching ? 'No matching documents' : 'No documents yet'}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {isSearching
                        ? 'Try a different name or clear the search.'
                        : 'Create a document to save your current visualization.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAndSortedDocs.map((doc) => {
                    const isActive = activeDocumentId === doc.id;

                    return (
                      <div
                        key={doc.id}
                        onClick={() => handleLoad(doc)}
                        className={`group flex cursor-pointer flex-col gap-3 rounded-lg border p-3 transition-all sm:flex-row sm:items-center sm:justify-between ${
                          isActive
                            ? 'border-blue-300 bg-blue-50/80 shadow-sm ring-1 ring-blue-500/20 dark:border-blue-500/40 dark:bg-blue-500/10'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-900/80'
                        }`}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                            isActive
                              ? 'border-blue-200 bg-white text-blue-600 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300'
                              : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            <FileCode size={18} />
                          </div>

                          <div className="min-w-0 flex-1">
                            {editingId === doc.id ? (
                              <input
                                autoFocus
                                value={editName}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setEditName(e.target.value)}
                                onBlur={() => handleSaveRename(doc.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveRename(doc.id);
                                  if (e.key === 'Escape') setEditingId(null);
                                }}
                                className="h-9 w-full rounded-lg border border-blue-400 bg-white px-3 text-sm font-medium text-slate-900 outline-none ring-2 ring-blue-500/20 dark:bg-slate-950 dark:text-white"
                              />
                            ) : (
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <span className="truncate text-sm font-semibold text-slate-950 dark:text-white" title={doc.name}>
                                  {doc.name}
                                </span>
                                {doc.isPinned && (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                                    <Pin size={11} className="fill-current" />
                                    Pinned
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                              <span className="inline-flex items-center gap-1.5">
                                <Clock size={12} />
                                Updated {formatTimestamp(doc.updatedAt)}
                              </span>
                              <span className="inline-flex items-center gap-1.5">
                                <CalendarDays size={12} />
                                Created {formatCreatedDate(doc.createdAt)}
                              </span>
                              <span>{getLineLabel(doc.code)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 sm:justify-end">
                          {isActive ? (
                            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                              <Check size={14} />
                              Active
                            </span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLoad(doc);
                              }}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                            >
                              Open
                              <ArrowRight size={13} />
                            </button>
                          )}

                          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-950">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTogglePin(doc);
                              }}
                              className={`rounded-md p-1.5 transition-colors ${
                                doc.isPinned
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
                              }`}
                              title={doc.isPinned ? 'Unpin document' : 'Pin document'}
                              aria-label={doc.isPinned ? 'Unpin document' : 'Pin document'}
                            >
                              <Pin size={14} className={doc.isPinned ? 'fill-current' : ''} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingId(doc.id);
                                setEditName(doc.name);
                              }}
                              className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                              title="Rename"
                              aria-label="Rename document"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicate(doc);
                              }}
                              className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                              title="Duplicate"
                              aria-label="Duplicate document"
                            >
                              <Copy size={14} />
                            </button>
                            <button
                              onClick={(e) => handleDelete(doc.id, e)}
                              className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                              title="Delete"
                              aria-label="Delete document"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <AnimatePresence>
              {confirmAction && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
                >
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 8 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 8 }}
                    className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="p-5">
                      <div className="mb-3 flex items-center gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                          confirmAction.type === 'delete'
                            ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
                            : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300'
                        }`}>
                          <AlertTriangle size={20} />
                        </div>
                        <h3 className="text-base font-semibold tracking-tight text-slate-950 dark:text-white">
                          {confirmAction.title}
                        </h3>
                      </div>
                      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        {confirmAction.message}
                      </p>
                    </div>
                    <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:justify-end">
                      <button
                        onClick={() => setConfirmAction(null)}
                        className="inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
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
                        className={`inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 ${
                          confirmAction.type === 'delete'
                            ? 'bg-red-600 shadow-red-600/20 hover:bg-red-500 focus:ring-red-500/40'
                            : 'bg-blue-600 shadow-blue-600/20 hover:bg-blue-500 focus:ring-blue-500/40'
                        }`}
                      >
                        {confirmAction.type === 'delete' ? 'Delete Document' : 'Switch Document'}
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
