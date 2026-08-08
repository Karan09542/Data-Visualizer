import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, FileImage, FolderArchive, Binary, Hash, Palette, FileSpreadsheet, Key } from "lucide-react";
import { ImageToPdfConverter } from "./ImageToPdfConverter";
import { FolderToZipConverter } from "./FolderToZipConverter";
import { Base64Converter } from "./Base64Converter";
import { HashGenerator } from "./HashGenerator";
import { ColorConverter } from "./ColorConverter";
import { CsvToJsonConverter } from "./CsvToJsonConverter";
import { JwtDecoder } from "./JwtDecoder";
import { ImageColorExtractor } from "./ImageColorExtractor";
import { Pipette } from "lucide-react";

interface QuickUtilsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickUtilsModal({ isOpen, onClose }: QuickUtilsModalProps) {
  const [activeTab, setActiveTab] = useState<"img2pdf" | "folder2zip" | "base64" | "hash" | "color" | "csv2json" | "jwt" | "colorthief">("img2pdf");

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-0 md:p-4 sm:p-2">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full h-full md:h-[85vh] md:max-h-[800px] max-w-5xl bg-slate-50 dark:bg-[#0c0f16] shadow-2xl border border-black/10 dark:border-white/10 flex flex-col md:flex-row overflow-hidden md:rounded-2xl"
          >
            {/* Close button for mobile (absolute top right) */}
            <button
              onClick={onClose}
              className="md:hidden absolute top-3 right-3 z-50 p-2 bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 rounded-full text-slate-800 dark:text-slate-200 transition-colors"
            >
              <X size={20} />
            </button>

            {/* Sidebar / Top Navigation */}
            <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161b22] flex flex-col shrink-0 select-none">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h1 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Quick Utilities
                </h1>
                {/* Close button for desktop */}
                <button
                  onClick={onClose}
                  className="hidden md:flex p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              
              <div className="flex flex-row md:flex-col overflow-x-auto md:overflow-y-auto p-3 gap-2 scrollbar-none">
                <button
                  onClick={() => setActiveTab("img2pdf")}
                  className={`flex-1 md:flex-none flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === "img2pdf"
                      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-200/50 dark:border-blue-800/30"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-transparent"
                  }`}
                >
                  <FileImage size={18} className="shrink-0" />
                  <span>Image to PDF</span>
                </button>
                
                <button
                  onClick={() => setActiveTab("folder2zip")}
                  className={`flex-1 md:flex-none flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === "folder2zip"
                      ? "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 shadow-sm border border-purple-200/50 dark:border-purple-800/30"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-transparent"
                  }`}
                >
                  <FolderArchive size={18} className="shrink-0" />
                  <span>Folder to ZIP</span>
                </button>

                <button
                  onClick={() => setActiveTab("colorthief")}
                  className={`flex-1 md:flex-none flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === "colorthief"
                      ? "bg-fuchsia-50 dark:bg-fuchsia-900/20 text-fuchsia-600 dark:text-fuchsia-400 shadow-sm border border-fuchsia-200/50 dark:border-fuchsia-800/30"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-transparent"
                  }`}
                >
                  <Pipette size={18} className="shrink-0" />
                  <span>Color Thief</span>
                </button>

                <button
                  onClick={() => setActiveTab("base64")}
                  className={`flex-1 md:flex-none flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === "base64"
                      ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-200/50 dark:border-emerald-800/30"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-transparent"
                  }`}
                >
                  <Binary size={18} className="shrink-0" />
                  <span>Base64</span>
                </button>

                <button
                  onClick={() => setActiveTab("hash")}
                  className={`flex-1 md:flex-none flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === "hash"
                      ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 shadow-sm border border-red-200/50 dark:border-red-800/30"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-transparent"
                  }`}
                >
                  <Hash size={18} className="shrink-0" />
                  <span>Hash Generator</span>
                </button>

                <button
                  onClick={() => setActiveTab("color")}
                  className={`flex-1 md:flex-none flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === "color"
                      ? "bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 shadow-sm border border-pink-200/50 dark:border-pink-800/30"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-transparent"
                  }`}
                >
                  <Palette size={18} className="shrink-0" />
                  <span>Color Converter</span>
                </button>

                <button
                  onClick={() => setActiveTab("csv2json")}
                  className={`flex-1 md:flex-none flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === "csv2json"
                      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-200/50 dark:border-blue-800/30"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-transparent"
                  }`}
                >
                  <FileSpreadsheet size={18} className="shrink-0" />
                  <span>CSV to JSON</span>
                </button>

                <button
                  onClick={() => setActiveTab("jwt")}
                  className={`flex-1 md:flex-none flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === "jwt"
                      ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 shadow-sm border border-amber-200/50 dark:border-amber-800/30"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-transparent"
                  }`}
                >
                  <Key size={18} className="shrink-0" />
                  <span>JWT Decoder</span>
                </button>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 h-full overflow-hidden flex flex-col bg-slate-50/50 dark:bg-[#0c0f16]/50">
              {activeTab === "img2pdf" && <ImageToPdfConverter />}
              {activeTab === "folder2zip" && <FolderToZipConverter />}
              {activeTab === "base64" && <Base64Converter />}
              {activeTab === "hash" && <HashGenerator />}
              {activeTab === "color" && <ColorConverter />}
              {activeTab === "csv2json" && <CsvToJsonConverter />}
              {activeTab === "jwt" && <JwtDecoder />}
              {activeTab === "colorthief" && <ImageColorExtractor />}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
