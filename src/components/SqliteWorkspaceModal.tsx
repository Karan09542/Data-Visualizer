import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Database,
  Download,
  Upload,
  FileCode,
  Check,
  X,
  FileText,
  Layers,
  Sparkles,
  AlertCircle,
  Search,
  Eye,
  FileSpreadsheet,
  RefreshCw,
  HardDrive,
  Table,
  Paperclip,
  Film,
  Music,
  CheckSquare
} from 'lucide-react';
import { db, type SavedDocument } from '../lib/db';
import { useStore } from '../store/useStore';
import {
  exportDocumentsToSqliteBinary,
  exportDocumentsToSqlScript,
  parseSqliteWorkspace,
  parseSqlScriptWorkspace,
  downloadSqliteFile,
  downloadSqlTextFile,
  isSqliteBinary,
  restoreSqliteAssets,
  getAssetsForDocuments,
  type ParsedSqliteWorkspace,
  type SqliteWorkspaceAsset,
} from '../utils/sqliteWorkspace';

interface ModernCheckboxProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  className?: string;
  size?: 'sm' | 'md';
}

function ModernCheckbox({ checked, onChange, className = '', size = 'md' }: ModernCheckboxProps) {
  const isSm = size === 'sm';
  const sizeClasses = isSm ? 'w-4 h-4 rounded-[5px]' : 'w-5 h-5 rounded-md';
  const iconSize = isSm ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <div
      role="checkbox"
      aria-checked={checked}
      onClick={(e) => {
        if (onChange) {
          e.stopPropagation();
          onChange(!checked);
        }
      }}
      className={`relative shrink-0 flex items-center justify-center transition-all duration-200 select-none ${onChange ? 'cursor-pointer active:scale-90' : ''
        } ${sizeClasses} ${checked
          ? 'bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 border border-indigo-500 shadow-sm shadow-indigo-500/40 text-white'
          : 'border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 hover:border-indigo-400 dark:hover:border-indigo-500/80'
        } ${className}`}
    >
      <Check
        className={`${iconSize} stroke-[3] text-white transition-all duration-150 ${checked ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
          }`}
      />
    </div>
  );
}

export function SqliteWorkspaceModal() {
  const isOpen = useStore((state) => state.isSqliteModalOpen);
  const setIsOpen = useStore((state) => state.setIsSqliteModalOpen);
  const initialTab = useStore((state) => state.sqliteModalInitialTab) || 'export';
  const pendingImport = useStore((state) => state.pendingSqliteImport);
  const setPendingImport = useStore((state) => state.setPendingSqliteImport);
  const activeDocumentId = useStore((state) => state.activeDocumentId);
  const activeDocumentName = useStore((state) => state.activeDocumentName);
  const currentCode = useStore((state) => state.code);
  const setCode = useStore((state) => state.setCode);
  const setActiveDocumentId = useStore((state) => state.setActiveDocumentId);
  const setActiveDocumentName = useStore((state) => state.setActiveDocumentName);
  const setIsDirty = useStore((state) => state.setIsDirty);
  const setNotification = useStore((state) => state.setNotification);

  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [format, setFormat] = useState<'sqlite' | 'sql'>('sqlite');
  const [scope, setScope] = useState<'workspace' | 'active' | 'custom'>('workspace');
  const [includeExtras, setIncludeExtras] = useState(true);
  const [customFilename, setCustomFilename] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<Set<number>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [exportMediaSummary, setExportMediaSummary] = useState<{
    count: number;
    bytes: number;
    breakdown: { pdf: number; video: number; audio: number; image: number; other: number };
  } | null>(null);

  // Import State
  const [parsedImport, setParsedImport] = useState<ParsedSqliteWorkspace | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importSelectedIndices, setImportSelectedIndices] = useState<Set<number>>(new Set());
  const [importSearch, setImportSearch] = useState('');
  const [collisionStrategy, setCollisionStrategy] = useState<'rename' | 'replace'>('rename');
  const [openFirstAfterImport, setOpenFirstAfterImport] = useState(true);
  const [previewDocIndex, setPreviewDocIndex] = useState<number | null>(null);
  const [importedFileName, setImportedFileName] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const documents = useLiveQuery(() => db.documents.toArray()) ?? [];

  // Sync initial tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      // Initialize selected doc IDs with all docs
      setSelectedDocIds(new Set(documents.map((d) => d.id)));
    }
  }, [isOpen, initialTab, documents.length]);

  // Handle pending import from fileProcessor or drag-and-drop
  useEffect(() => {
    if (pendingImport && isOpen) {
      setActiveTab('import');
      handleParseFile(pendingImport.filename, pendingImport.buffer, pendingImport.sqlText);
    }
  }, [pendingImport, isOpen]);

  // Reset custom filename default when scope changes
  useEffect(() => {
    const dateStr = new Date().toISOString().slice(0, 10);
    if (scope === 'active') {
      const safeName = (activeDocumentName || 'current_document').replace(/[^a-zA-Z0-9_-]/g, '_');
      setCustomFilename(`${safeName}.${format}`);
    } else {
      setCustomFilename(`workspace_${dateStr}.${format}`);
    }
  }, [scope, format, activeDocumentName]);

  const handleParseFile = async (
    filename: string,
    buffer?: ArrayBuffer | Uint8Array,
    sqlText?: string
  ) => {
    setIsParsing(true);
    setParseError(null);
    setImportedFileName(filename);
    try {
      let parsed: ParsedSqliteWorkspace;
      if (sqlText || filename.toLowerCase().endsWith('.sql')) {
        const text = sqlText || (buffer ? new TextDecoder().decode(buffer) : '');
        parsed = await parseSqlScriptWorkspace(text);
      } else if (buffer) {
        parsed = await parseSqliteWorkspace(buffer);
      } else {
        throw new Error('No file data provided');
      }

      setParsedImport(parsed);
      setImportSelectedIndices(new Set(parsed.documents.map((_, idx) => idx)));
    } catch (err: any) {
      console.error('Failed to parse SQLite/SQL file:', err);
      setParseError(err?.message || 'Failed to read SQLite database. Ensure it is a valid SQLite 3 or SQL file.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportedFileName(file.name);

    if (file.name.toLowerCase().endsWith('.sql')) {
      const text = await file.text();
      handleParseFile(file.name, undefined, text);
    } else {
      const arrayBuffer = await file.arrayBuffer();
      handleParseFile(file.name, arrayBuffer);
    }
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.sql')) {
      const text = await file.text();
      handleParseFile(file.name, undefined, text);
    } else {
      const arrayBuffer = await file.arrayBuffer();
      handleParseFile(file.name, arrayBuffer);
    }
  };

  // Compile export documents list
  const exportDocsList = useMemo(() => {
    const list: Array<{
      id?: number;
      name: string;
      code: string;
      createdAt?: number;
      updatedAt?: number;
      isPinned?: boolean;
    }> = [];

    if (scope === 'active') {
      list.push({
        id: activeDocumentId || undefined,
        name: activeDocumentName || 'Active Document',
        code: currentCode,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    } else if (scope === 'custom') {
      for (const doc of documents) {
        if (selectedDocIds.has(doc.id)) {
          // If this is the active document, use latest editor code
          const codeToUse = doc.id === activeDocumentId ? currentCode : doc.code;
          list.push({
            ...doc,
            code: codeToUse,
          });
        }
      }
    } else {
      // Entire workspace
      if (documents.length === 0) {
        // Fallback to active document if no saved documents exist yet
        list.push({
          id: activeDocumentId || undefined,
          name: activeDocumentName || 'Active Document',
          code: currentCode,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      } else {
        for (const doc of documents) {
          const codeToUse = doc.id === activeDocumentId ? currentCode : doc.code;
          list.push({
            ...doc,
            code: codeToUse,
          });
        }
      }
    }
    return list;
  }, [scope, documents, selectedDocIds, activeDocumentId, activeDocumentName, currentCode]);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const totalLines = useMemo(() => {
    return exportDocsList.reduce((acc, d) => acc + (d.code ? d.code.split('\n').length : 0), 0);
  }, [exportDocsList]);

  // Dynamically calculate multimedia assets for the export scope
  useEffect(() => {
    let active = true;
    const calcMedia = async () => {
      try {
        const assets = await getAssetsForDocuments(exportDocsList, scope === 'workspace');
        if (!active) return;
        const breakdown = { pdf: 0, video: 0, audio: 0, image: 0, other: 0 };
        let totalBytes = 0;
        for (const { asset, data } of assets) {
          const size = data?.length || asset.size || 0;
          totalBytes += size;
          const mime = (asset.mimeType || '').toLowerCase();
          const fn = (asset.filename || asset.assetId || '').toLowerCase();
          if (mime.includes('pdf') || fn.endsWith('.pdf')) breakdown.pdf++;
          else if (mime.startsWith('video/') || fn.match(/\.(mp4|webm|mov|mkv)$/)) breakdown.video++;
          else if (mime.startsWith('audio/') || fn.match(/\.(mp3|wav|ogg|m4a|flac|aac)$/)) breakdown.audio++;
          else if (mime.startsWith('image/') || fn.match(/\.(png|jpg|jpeg|gif|webp|svg)$/)) breakdown.image++;
          else breakdown.other++;
        }
        setExportMediaSummary({
          count: assets.length,
          bytes: totalBytes,
          breakdown,
        });
      } catch (e) {
        if (active) setExportMediaSummary(null);
      }
    };
    calcMedia();
    return () => {
      active = false;
    };
  }, [exportDocsList, scope]);

  // Calculate multimedia assets summary for imported database
  const importMediaSummary = useMemo(() => {
    if (!parsedImport?.assets || parsedImport.assets.length === 0) return null;
    const breakdown = { pdf: 0, video: 0, audio: 0, image: 0, other: 0 };
    let totalBytes = 0;
    for (const a of parsedImport.assets) {
      const size = a.data?.length || a.size || 0;
      totalBytes += size;
      const mime = (a.mimeType || '').toLowerCase();
      const fn = (a.filename || a.assetId || '').toLowerCase();
      if (mime.includes('pdf') || fn.endsWith('.pdf')) breakdown.pdf++;
      else if (mime.startsWith('video/') || fn.match(/\.(mp4|webm|mov|mkv)$/)) breakdown.video++;
      else if (mime.startsWith('audio/') || fn.match(/\.(mp3|wav|ogg|m4a|flac|aac)$/)) breakdown.audio++;
      else if (mime.startsWith('image/') || fn.match(/\.(png|jpg|jpeg|gif|webp|svg)$/)) breakdown.image++;
      else breakdown.other++;
    }
    return { count: parsedImport.assets.length, bytes: totalBytes, breakdown };
  }, [parsedImport]);

  const handleExecuteExport = async () => {
    if (exportDocsList.length === 0) {
      setNotification({ message: 'No documents selected for export', type: 'error' });
      return;
    }

    setIsExporting(true);
    try {
      const meta = {
        app: 'JSON/YAML Visualizer',
        version: '1.1.0',
        exportedAt: Date.now(),
        activeDocumentName: activeDocumentName || 'Untitled Document',
        documentCount: exportDocsList.length,
      };

      const finalName = customFilename.trim() || `workspace_${new Date().toISOString().slice(0, 10)}`;

      if (format === 'sql') {
        const sqlScript = await exportDocumentsToSqlScript(exportDocsList, meta);
        downloadSqlTextFile(sqlScript, finalName);
        setNotification({
          message: `Exported ${exportDocsList.length} documents as SQL Script`,
          type: 'success',
        });
      } else {
        const stickyNoteMedia = includeExtras && scope === 'workspace'
          ? await db.stickyNoteMedia.toArray()
          : undefined;

        const extras =
          includeExtras && scope === 'workspace'
            ? {
              stickyNotes: await db.stickyNotes.toArray(),
              stickyNoteMedia,
              customFormulas: await db.customFormulas.toArray(),
              nodePositions: await db.nodePositions.toArray(),
              mathScenes: await db.mathScenes.toArray(),
            }
            : undefined;

        const binaryBytes = await exportDocumentsToSqliteBinary(exportDocsList, meta, extras);
        downloadSqliteFile(binaryBytes, finalName);
        const sizeStr = formatBytes(binaryBytes.length);
        const mediaTag = exportMediaSummary && exportMediaSummary.count > 0
          ? ` with ${exportMediaSummary.count} media file${exportMediaSummary.count === 1 ? '' : 's'}`
          : '';
        setNotification({
          message: `Exported ${exportDocsList.length} documents${mediaTag} as SQLite database (${sizeStr})`,
          type: 'success',
        });
      }
      setIsOpen(false);
    } catch (err: any) {
      console.error('Export failed:', err);
      setNotification({ message: `Export failed: ${err?.message || 'Unknown error'}`, type: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!parsedImport || importSelectedIndices.size === 0) {
      setNotification({ message: 'Please select at least one document to import', type: 'error' });
      return;
    }

    const docsToImport = parsedImport.documents.filter((_, idx) => importSelectedIndices.has(idx));
    if (docsToImport.length === 0) return;

    try {
      // 1. Restore multimedia assets into device storage (OPFS/IndexedDB) and db.assets
      let restoredAssetsCount = 0;
      if (parsedImport.assets && parsedImport.assets.length > 0) {
        restoredAssetsCount = await restoreSqliteAssets(parsedImport.assets);
      }

      // 2. Restore sticky note media if present in database
      if (parsedImport.extraTables?.stickyNoteMedia && parsedImport.extraTables.stickyNoteMedia.length > 0) {
        for (const media of parsedImport.extraTables.stickyNoteMedia) {
          await db.stickyNoteMedia.put(media);
        }
      }

      const existingDocs = await db.documents.toArray();
      const existingNames = new Set(existingDocs.map((d) => d.name.toLowerCase()));
      let firstImportedId: number | null = null;
      let firstImportedDoc: SavedDocument | null = null;

      for (const doc of docsToImport) {
        let targetName = doc.name;

        if (collisionStrategy === 'rename' && existingNames.has(targetName.toLowerCase())) {
          let counter = 2;
          let candidate = `${targetName} (${counter})`;
          while (existingNames.has(candidate.toLowerCase())) {
            counter++;
            candidate = `${targetName} (${counter})`;
          }
          targetName = candidate;
        } else if (collisionStrategy === 'replace' && existingNames.has(targetName.toLowerCase())) {
          const matching = existingDocs.find((d) => d.name.toLowerCase() === targetName.toLowerCase());
          if (matching) {
            await db.documents.update(matching.id, {
              code: doc.code,
              updatedAt: Date.now(),
            });
            if (!firstImportedId) {
              firstImportedId = matching.id;
              firstImportedDoc = { ...matching, code: doc.code, updatedAt: Date.now() };
            }
            continue;
          }
        }

        const newId = await db.documents.add({
          name: targetName,
          code: doc.code,
          createdAt: doc.createdAt || Date.now(),
          updatedAt: Date.now(),
          isPinned: doc.isPinned || false,
        });

        existingNames.add(targetName.toLowerCase());

        if (!firstImportedId) {
          firstImportedId = newId as number;
          firstImportedDoc = {
            id: newId as number,
            name: targetName,
            code: doc.code,
            createdAt: doc.createdAt || Date.now(),
            updatedAt: Date.now(),
          };
        }
      }

      // If extras (sticky notes, formulas) were in SQLite, import them too
      if (parsedImport.extraTables?.stickyNotes && parsedImport.extraTables.stickyNotes.length > 0) {
        for (const note of parsedImport.extraTables.stickyNotes) {
          await db.stickyNotes.put(note);
        }
      }
      if (parsedImport.extraTables?.customFormulas && parsedImport.extraTables.customFormulas.length > 0) {
        for (const formula of parsedImport.extraTables.customFormulas) {
          await db.customFormulas.add(formula);
        }
      }

      // Open first document if requested
      if (openFirstAfterImport && firstImportedDoc && firstImportedId) {
        setActiveDocumentId(firstImportedId);
        setActiveDocumentName(firstImportedDoc.name);
        setCode(firstImportedDoc.code);
        useStore.getState().setLastSavedCode(firstImportedDoc.code);
        setIsDirty(false);
      }

      const mediaMsg = restoredAssetsCount > 0
        ? ` and restored ${restoredAssetsCount} multimedia file${restoredAssetsCount === 1 ? '' : 's'}`
        : '';

      setNotification({
        message: `Successfully imported ${docsToImport.length} document${docsToImport.length === 1 ? '' : 's'}${mediaMsg} from SQLite database!`,
        type: 'success',
      });

      setPendingImport(null);
      setParsedImport(null);
      setIsOpen(false);
    } catch (err: any) {
      console.error('Import failed:', err);
      setNotification({ message: `Import failed: ${err?.message || 'Unknown error'}`, type: 'error' });
    }
  };

  const handleClose = () => {
    setPendingImport(null);
    setParsedImport(null);
    setParseError(null);
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[100050] flex items-center justify-center p-0 sm:p-6 select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-3xl bg-white dark:bg-slate-900 border-0 sm:border border-slate-200 dark:border-slate-800 rounded-none sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 z-10"
        >
          {/* Header */}
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 shrink-0">
                <Database className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                    SQLite Workspace Engine
                  </h3>
                  <span className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
                    SQL WASM
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                  Export binary SQLite databases & deserialize workspace documents
                </p>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0 ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center px-3 sm:px-6 pt-2 sm:pt-3 border-b border-slate-200 dark:border-slate-800 gap-1 sm:gap-2 bg-slate-50/40 dark:bg-slate-900/40 shrink-0">
            <button
              onClick={() => setActiveTab('export')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${activeTab === 'export'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Download & Export</span>
              <span className="hidden sm:inline-block px-1.5 py-0.2 text-[9px] font-bold rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                Binary
              </span>
            </button>

            <button
              onClick={() => setActiveTab('import')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${activeTab === 'import'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
            >
              <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Upload & Import</span>
              {parsedImport && (
                <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  {parsedImport.documents.length} Docs
                </span>
              )}
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
            {activeTab === 'export' ? (
              <div className="space-y-6">
                {/* Scope Selection */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
                    Export Scope
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setScope('workspace')}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${scope === 'workspace'
                        ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Layers className="w-4 h-4 text-indigo-500" />
                        <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">
                          {documents.length || 1} Docs
                        </span>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">Whole Workspace</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">All documents & state</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setScope('active')}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${scope === 'active'
                        ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <FileCode className="w-4 h-4 text-emerald-500" />
                        <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                          Active
                        </span>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">Current Document</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {activeDocumentName || 'Editor Content'}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setScope('custom')}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${scope === 'custom'
                        ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <CheckSquare className="w-4 h-4 text-purple-500" />
                        <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400">
                          {selectedDocIds.size} Selected
                        </span>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">Select Documents</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">Choose specific files</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Custom Documents List (if scope is custom) */}
                {scope === 'custom' && (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                      <span>Select documents to include:</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedDocIds(new Set(documents.map((d) => d.id)))}
                          className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          Select All
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => setSelectedDocIds(new Set())}
                          className="text-[11px] text-slate-400 hover:underline cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                      {documents.map((doc) => {
                        const isChecked = selectedDocIds.has(doc.id);
                        const lines = doc.code ? doc.code.split('\n').length : 0;
                        return (
                          <div
                            key={doc.id}
                            onClick={() => {
                              const next = new Set(selectedDocIds);
                              if (isChecked) next.delete(doc.id);
                              else next.add(doc.id);
                              setSelectedDocIds(next);
                            }}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${isChecked
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 text-slate-900 dark:text-white font-medium'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                              }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <ModernCheckbox checked={isChecked} size="sm" />
                              <span className="truncate">{doc.name}</span>
                              {doc.id === activeDocumentId && (
                                <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-indigo-500/10 text-indigo-500">
                                  Current
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 shrink-0">{lines} lines</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Format & Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Format Selector */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
                      Export Format
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormat('sqlite')}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${format === 'sqlite'
                          ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                          }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                          <HardDrive className="w-3.5 h-3.5" />
                          <span>SQLite Binary</span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          .sqlite file for direct sharing & deserialization
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormat('sql')}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${format === 'sql'
                          ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                          }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 text-purple-600 dark:text-purple-400 font-bold text-xs">
                          <FileText className="w-3.5 h-3.5" />
                          <span>SQL Script</span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          .sql text with CREATE TABLE & INSERT statements
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Filename Input */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
                      Output Filename
                    </label>
                    <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-3 py-2 text-xs focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-500">
                      <input
                        type="text"
                        value={customFilename}
                        onChange={(e) => setCustomFilename(e.target.value)}
                        placeholder="filename.sqlite"
                        className="w-full bg-transparent border-none outline-none font-medium"
                      />
                    </div>
                    {scope === 'workspace' && (
                      <div
                        onClick={() => setIncludeExtras(!includeExtras)}
                        className="flex items-center gap-2.5 mt-3 cursor-pointer text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors select-none"
                      >
                        <ModernCheckbox checked={includeExtras} size="sm" />
                        <span>Include Sticky Notes, Formulas & Visualizer Layout</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Media Assets Info for Export */}
                {exportMediaSummary && exportMediaSummary.count > 0 && (
                  <div className="p-3.5 rounded-xl border border-indigo-500/25 bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-indigo-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 rounded-lg bg-indigo-500/15 text-indigo-500 shrink-0">
                        <Paperclip className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                          <span>Packaging {exportMediaSummary.count} Media File{exportMediaSummary.count === 1 ? '' : 's'}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-indigo-500/15 text-indigo-500">
                            {formatBytes(exportMediaSummary.bytes)}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          Embedded directly into SQLite BLOBs for portable sharing and instant playback
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {exportMediaSummary.breakdown.pdf > 0 && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {exportMediaSummary.breakdown.pdf} PDF{exportMediaSummary.breakdown.pdf > 1 ? 's' : ''}
                        </span>
                      )}
                      {exportMediaSummary.breakdown.video > 0 && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                          <Film className="w-3 h-3" />
                          {exportMediaSummary.breakdown.video} Video{exportMediaSummary.breakdown.video > 1 ? 's' : ''}
                        </span>
                      )}
                      {exportMediaSummary.breakdown.audio > 0 && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1">
                          <Music className="w-3 h-3" />
                          {exportMediaSummary.breakdown.audio} Audio
                        </span>
                      )}
                      {exportMediaSummary.breakdown.image > 0 && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {exportMediaSummary.breakdown.image} Image{exportMediaSummary.breakdown.image > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Summary Banner */}
                <div className="p-3.5 sm:p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/5 border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-indigo-500 text-white rounded-lg shadow-sm shrink-0">
                      <Database className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                        <span>Ready to export {exportDocsList.length} document{exportDocsList.length === 1 ? '' : 's'}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-indigo-500/10 text-indigo-500">
                          ~{totalLines} lines
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Target format: <span className="font-semibold">{format.toUpperCase()}</span> • Ready for download & deserialization
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleExecuteExport}
                    disabled={isExporting || exportDocsList.length === 0}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {isExporting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Download {format === 'sqlite' ? '.sqlite' : '.sql'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* IMPORT TAB */
              <div className="space-y-6">
                {!parsedImport ? (
                  /* File Dropzone */
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-colors bg-slate-50/50 dark:bg-slate-900/50 cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileInputChange}
                      accept=".sqlite,.db,.sqlite3,.sql"
                      className="hidden"
                    />

                    {isParsing ? (
                      <div className="flex flex-col items-center gap-3">
                        <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin" />
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          Reading SQLite binary with WASM engine...
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="p-4 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mb-4">
                          <Database className="w-10 h-10" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                          Upload SQLite Database or SQL File
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-4">
                          Drop your <code>.sqlite</code>, <code>.db</code>, or <code>.sql</code> file here to deserialize workspace documents
                        </p>
                        <button
                          type="button"
                          className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
                        >
                          Browse SQLite File
                        </button>
                      </>
                    )}

                    {parseError && (
                      <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 text-left">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{parseError}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Parsed Content Review */
                  <div className="space-y-4">
                    {/* Database Info Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                          <Database className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                            <span className="truncate max-w-[180px] sm:max-w-none">{importedFileName || 'SQLite Database'}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 shrink-0">
                              {parsedImport.documents.length} Document{parsedImport.documents.length === 1 ? '' : 's'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {parsedImport.meta.exportedAt ? (
                              <span>Exported: {new Date(parsedImport.meta.exportedAt).toLocaleDateString()}</span>
                            ) : (
                              <span>SQLite 3 database successfully deserialized</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setParsedImport(null);
                          setImportSelectedIndices(new Set());
                        }}
                        className="self-end sm:self-auto px-2.5 py-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      >
                        Choose another file
                      </button>
                    </div>

                    {/* Media Assets Info for Import */}
                    {importMediaSummary && importMediaSummary.count > 0 && (
                      <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-emerald-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                            <Paperclip className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                              <span>Found {importMediaSummary.count} Embedded Media File{importMediaSummary.count === 1 ? '' : 's'}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                {formatBytes(importMediaSummary.bytes)}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                              All multimedia will be restored into device storage and rendered automatically
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          {importMediaSummary.breakdown.pdf > 0 && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {importMediaSummary.breakdown.pdf} PDF{importMediaSummary.breakdown.pdf > 1 ? 's' : ''}
                            </span>
                          )}
                          {importMediaSummary.breakdown.video > 0 && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                              <Film className="w-3 h-3" />
                              {importMediaSummary.breakdown.video} Video{importMediaSummary.breakdown.video > 1 ? 's' : ''}
                            </span>
                          )}
                          {importMediaSummary.breakdown.audio > 0 && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1">
                              <Music className="w-3 h-3" />
                              {importMediaSummary.breakdown.audio} Audio
                            </span>
                          )}
                          {importMediaSummary.breakdown.image > 0 && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              {importMediaSummary.breakdown.image} Image{importMediaSummary.breakdown.image > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Document Selection List */}
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Documents in SQLite File
                          </span>
                          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                            ({importSelectedIndices.size}/{parsedImport.documents.length} selected)
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => setImportSelectedIndices(new Set(parsedImport.documents.map((_, idx) => idx)))}
                            className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                          >
                            Select All
                          </button>
                          <span className="text-slate-300">•</span>
                          <button
                            type="button"
                            onClick={() => setImportSelectedIndices(new Set())}
                            className="text-slate-400 hover:underline cursor-pointer"
                          >
                            Deselect
                          </button>
                        </div>
                      </div>

                      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                        {parsedImport.documents.map((doc, idx) => {
                          const isSelected = importSelectedIndices.has(idx);
                          const lineCount = doc.code ? doc.code.split('\n').length : 0;
                          return (
                            <div
                              key={idx}
                              onClick={() => {
                                const next = new Set(importSelectedIndices);
                                if (isSelected) next.delete(idx);
                                else next.add(idx);
                                setImportSelectedIndices(next);
                              }}
                              className={`flex items-center justify-between p-2.5 cursor-pointer text-xs transition-colors ${isSelected
                                ? 'bg-indigo-50/60 dark:bg-indigo-950/30'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <ModernCheckbox checked={isSelected} size="sm" />
                                <div className="truncate font-semibold text-slate-800 dark:text-slate-200">
                                  {doc.name}
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-[11px] text-slate-400">{lineCount} lines</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewDocIndex(previewDocIndex === idx ? null : idx);
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                  title="Preview code"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Code Preview Drawer if opened */}
                      {previewDocIndex !== null && parsedImport.documents[previewDocIndex] && (
                        <div className="mt-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-100 font-mono text-[11px] max-h-40 overflow-y-auto">
                          <div className="flex items-center justify-between pb-1 mb-2 border-b border-slate-800 text-[10px] text-slate-400">
                            <span>{parsedImport.documents[previewDocIndex].name}</span>
                            <button
                              onClick={() => setPreviewDocIndex(null)}
                              className="text-slate-400 hover:text-white"
                            >
                              Close Preview
                            </button>
                          </div>
                          <pre className="whitespace-pre-wrap">
                            {parsedImport.documents[previewDocIndex].code.slice(0, 1000)}
                            {parsedImport.documents[previewDocIndex].code.length > 1000 && '\n... (truncated)'}
                          </pre>
                        </div>
                      )}
                    </div>

                    {/* Import Settings */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                          Name Collision Handling
                        </label>
                        <select
                          value={collisionStrategy}
                          onChange={(e) => setCollisionStrategy(e.target.value as any)}
                          className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200 cursor-pointer"
                        >
                          <option value="rename">Keep Both (Auto-rename to "Name (2)")</option>
                          <option value="replace">Overwrite Existing Document</option>
                        </select>
                      </div>

                      <div className="flex items-center pt-2 sm:pt-5">
                        <div
                          onClick={() => setOpenFirstAfterImport(!openFirstAfterImport)}
                          className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors select-none"
                        >
                          <ModernCheckbox checked={openFirstAfterImport} size="sm" />
                          <span>Open first imported document in editor now</span>
                        </div>
                      </div>
                    </div>

                    {/* Import Button */}
                    <div className="pt-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-3">
                      <button
                        type="button"
                        onClick={handleClose}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-center"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleExecuteImport}
                        disabled={importSelectedIndices.size === 0}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>Import {importSelectedIndices.size} Document{importSelectedIndices.size === 1 ? '' : 's'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
