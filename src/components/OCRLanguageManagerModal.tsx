import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Trash2, CheckCircle, Loader2 } from 'lucide-react';
import { getDownloadedLanguages, downloadLanguage, deleteLanguage } from '../services/tesseractService';

interface OCRLanguageManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLanguageSelected: (lang: string) => void;
  selectedLanguage: string;
}

const AVAILABLE_LANGUAGES = [
  { code: 'eng', name: 'English' },
  { code: 'spa', name: 'Spanish' },
  { code: 'fra', name: 'French' },
  { code: 'deu', name: 'German' },
  { code: 'chi_sim', name: 'Chinese (Simplified)' },
  { code: 'chi_tra', name: 'Chinese (Traditional)' },
  { code: 'jpn', name: 'Japanese' },
  { code: 'kor', name: 'Korean' },
  { code: 'rus', name: 'Russian' },
  { code: 'ita', name: 'Italian' },
  { code: 'por', name: 'Portuguese' },
  { code: 'hin', name: 'Hindi' },
  { code: 'ara', name: 'Arabic' },
];

export default function OCRLanguageManagerModal({ isOpen, onClose, onLanguageSelected, selectedLanguage }: OCRLanguageManagerModalProps) {
  const [downloadedLangs, setDownloadedLangs] = useState<string[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadDownloaded();
    }
  }, [isOpen]);

  const loadDownloaded = async () => {
    try {
      const langs = await getDownloadedLanguages();
      setDownloadedLangs(langs);
      // Fallback to English if nothing is selected but eng is downloaded
      if (!selectedLanguage && langs.includes('eng')) {
        onLanguageSelected('eng');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownload = async (code: string) => {
    setDownloading(code);
    setProgress(0);
    setError(null);
    try {
      await downloadLanguage(code, (p) => setProgress(p));
      await loadDownloaded();
      if (!selectedLanguage) {
        onLanguageSelected(code);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to download language.');
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async (code: string) => {
    if (downloading) return;
    try {
      await deleteLanguage(code);
      await loadDownloaded();
      if (selectedLanguage === code) {
        onLanguageSelected(''); // reset if selected
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full h-[100dvh] sm:h-auto sm:max-w-md bg-white dark:bg-slate-900 rounded-none sm:rounded-2xl shadow-2xl border-0 sm:border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col sm:max-h-[85vh]"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">OCR Languages</h2>
              <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/50">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Language data is downloaded once and stored locally in your browser (OPFS). 
                You can use these offline for extracting text from images.
              </p>
            </div>

            {error && (
              <div className="p-3 m-4 mb-0 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs rounded-xl border border-red-200 dark:border-red-900/50">
                {error}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {AVAILABLE_LANGUAGES.map((lang) => {
                const isDownloaded = downloadedLangs.includes(lang.code);
                const isSelected = selectedLanguage === lang.code;
                const isDownloadingThis = downloading === lang.code;

                return (
                  <div 
                    key={lang.code} 
                    className={`flex flex-col p-3 rounded-xl border transition-all ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex-1 flex items-center gap-3 cursor-pointer"
                        onClick={() => {
                          if (isDownloaded) onLanguageSelected(lang.code);
                        }}
                      >
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-blue-500 bg-blue-500' : 'border-slate-300 dark:border-slate-600'
                        }`}>
                          {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 block">{lang.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{lang.code}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isDownloadingThis ? (
                          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-3 py-1.5 rounded-lg">
                            <Loader2 size={14} className="animate-spin" /> {progress}%
                          </div>
                        ) : isDownloaded ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-md">
                              <CheckCircle size={12} /> Ready
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(lang.code); }}
                              disabled={!!downloading}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50"
                              title="Delete Language"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDownload(lang.code); }}
                            disabled={!!downloading}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Download size={14} /> Download
                          </button>
                        )}
                      </div>
                    </div>
                    {isDownloadingThis && (
                      <div className="mt-3 h-1.5 w-full bg-blue-100 dark:bg-blue-900/30 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 transition-all duration-200" 
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-md active:scale-[0.98] transition-all"
              >
                Done
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
