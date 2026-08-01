import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function StickyConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  isDanger = true,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-[200000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm pointer-events-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="w-full max-w-sm bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/10 shadow-2xl rounded-3xl p-5 flex flex-col gap-4 text-black dark:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header / Icon */}
            <div className="flex items-start justify-between">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${isDanger ? 'bg-red-500/10 text-red-600 dark:text-red-400 ring-1 ring-red-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                {isDanger ? <Trash2 size={22} /> : <AlertTriangle size={22} />}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div>
              <h3 className="text-base font-extrabold tracking-tight text-black dark:text-white">{title}</h3>
              <p className="text-xs font-semibold text-black/60 dark:text-white/60 mt-1 leading-relaxed">{message}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-black dark:text-white transition-all active:scale-95"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md active:scale-95 ${
                  isDanger
                    ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
                    : 'bg-black dark:bg-white text-white dark:text-black'
                }`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
