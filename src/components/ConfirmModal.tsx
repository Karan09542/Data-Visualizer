import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onClose: () => void;
  variant?: "danger" | "primary" | "warning";
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onClose,
  variant = "danger",
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen, onClose]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  let btnClass = "bg-blue-600 hover:bg-blue-700 text-white";
  let iconClass = "text-blue-500 bg-blue-100 dark:bg-blue-500/20";
  
  if (variant === "danger") {
    btnClass = "bg-red-600 hover:bg-red-700 text-white shadow-red-600/30 shadow-lg";
    iconClass = "text-red-500 bg-red-100 dark:bg-red-500/20";
  } else if (variant === "warning") {
    btnClass = "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/30 shadow-lg";
    iconClass = "text-amber-500 bg-amber-100 dark:bg-amber-500/20";
  }

  const modalContent = (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div 
        ref={modalRef}
        className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col scale-100 transform transition-all"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex flex-col p-6 items-center text-center">
          <div className={`h-12 w-12 rounded-full mb-4 flex items-center justify-center ${iconClass}`}>
            <AlertTriangle size={24} className={variant === "danger" ? "text-red-500" : variant === "warning" ? "text-amber-500" : "text-blue-500"} />
          </div>
          
          <h3 id="modal-title" className="text-lg font-bold text-slate-900 dark:text-white mb-2">
            {title}
          </h3>
          <div className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            {message}
          </div>

          <div className="flex items-center gap-3 w-full">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              {cancelText}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${btnClass}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
