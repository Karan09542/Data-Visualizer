import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type SavedDocument } from '../lib/db';
import { useStore } from '../store/useStore';
import { X, Save, FolderOpen, Trash2 } from 'lucide-react';

export default function SavedDocumentsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { code, setCode } = useStore();
  const [docName, setDocName] = useState('');

  const documents = useLiveQuery(() => db.documents.orderBy('createdAt').reverse().toArray());

  const handleSave = async () => {
    if (!docName.trim()) {
      alert('Please enter a name for the document');
      return;
    }
    await db.documents.add({
      name: docName,
      code,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    setDocName('');
  };

  const handleLoad = (doc: SavedDocument) => {
    setCode(doc.code);
    onClose();
  };

  const handleDelete = async (id: number) => {
    await db.documents.delete(id);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#0d1117] w-full max-w-lg rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FolderOpen size={20} />
            Saved Documents
          </h2>
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#161b22]">
          <div className="flex flex-col sm:flex-row gap-2">
            <input 
              type="text" 
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="Enter document name..."
              className="flex-1 bg-white dark:bg-[#0d1117] border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
            />
            <button 
              onClick={handleSave}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors whitespace-nowrap shrink-0 w-full sm:w-auto"
            >
              <Save size={16} /> Save Current
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {documents === undefined ? (
            <div className="text-center text-slate-500 text-sm py-4">Loading documents...</div>
          ) : documents.length === 0 ? (
            <div className="text-center text-slate-500 text-sm py-8">No saved documents yet.</div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors group">
                  <div className="flex flex-col flex-1 min-w-0 mr-4 cursor-pointer" onClick={() => handleLoad(doc)}>
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{doc.name}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(doc.updatedAt).toLocaleString()}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleDelete(doc.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
