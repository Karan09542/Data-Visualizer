import React, { useState, useEffect, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, FileImage, FolderArchive, Binary, Hash, Palette, FileSpreadsheet, Key, Printer, Pipette, Waves, Maximize2, Minimize2 } from "lucide-react";
import { ImageToPdfConverter } from "./ImageToPdfConverter";
import { FolderToZipConverter } from "./FolderToZipConverter";
import { Base64Converter } from "./Base64Converter";
import { HashGenerator } from "./HashGenerator";
import { ColorConverter } from "./ColorConverter";
import { CsvToJsonConverter } from "./CsvToJsonConverter";
import { JwtDecoder } from "./JwtDecoder";
import { ImageColorExtractor } from "./ImageColorExtractor";
import { PassportStudioUtil } from "./PassportStudioUtil";

const WaveDisplacementStudio = lazy(() => import("./WaveDisplacementStudio").then(m => ({ default: m.WaveDisplacementStudio })));

const TABS = [
  { id: "passport", label: "Passport Studio", icon: Printer, activeClass: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-200/50 dark:border-blue-800/30 font-bold", iconClass: "text-blue-500" },
  { id: "img2pdf", label: "Image to PDF", icon: FileImage, activeClass: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-200/50 dark:border-blue-800/30", iconClass: "" },
  { id: "wavedisp", label: "Wave Studio", icon: Waves, activeClass: "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 shadow-sm border border-cyan-200/50 dark:border-cyan-800/30 font-bold", iconClass: "text-cyan-500" },
  { id: "folder2zip", label: "Folder to ZIP", icon: FolderArchive, activeClass: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 shadow-sm border border-purple-200/50 dark:border-purple-800/30", iconClass: "" },
  { id: "colorthief", label: "Color Thief", icon: Pipette, activeClass: "bg-fuchsia-50 dark:bg-fuchsia-900/20 text-fuchsia-600 dark:text-fuchsia-400 shadow-sm border border-fuchsia-200/50 dark:border-fuchsia-800/30", iconClass: "" },
  { id: "base64", label: "Base64", icon: Binary, activeClass: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-200/50 dark:border-emerald-800/30", iconClass: "" },
  { id: "hash", label: "Hash Generator", icon: Hash, activeClass: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 shadow-sm border border-red-200/50 dark:border-red-800/30", iconClass: "" },
  { id: "color", label: "Color Converter", icon: Palette, activeClass: "bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 shadow-sm border border-pink-200/50 dark:border-pink-800/30", iconClass: "" },
  { id: "csv2json", label: "CSV to JSON", icon: FileSpreadsheet, activeClass: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-200/50 dark:border-blue-800/30", iconClass: "" },
  { id: "jwt", label: "JWT Decoder", icon: Key, activeClass: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 shadow-sm border border-amber-200/50 dark:border-amber-800/30", iconClass: "" },
] as const;

interface QuickUtilsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickUtilsModal({ isOpen, onClose }: QuickUtilsModalProps) {
  const [activeTab, setActiveTab] = useState<"wavedisp" | "passport" | "img2pdf" | "folder2zip" | "base64" | "hash" | "color" | "csv2json" | "jwt" | "colorthief">("passport");
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

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
        <div className={`fixed inset-0 z-[600] flex items-center justify-center ${isMaximized ? "p-0" : "p-0 md:p-4 sm:p-2"}`}>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={`relative transition-all duration-300 ${isMaximized
              ? "w-screen h-screen max-w-none max-h-none rounded-none border-none p-0"
              : "w-full h-full md:h-[90vh] md:max-h-[850px] max-w-6xl md:rounded-2xl border border-black/10 dark:border-white/10"
              } bg-slate-50 dark:bg-[#080b11] shadow-2xl flex flex-col md:flex-row overflow-hidden`}
          >
            {/* Close & Maximize buttons for mobile (absolute top right) */}
            <div className="md:hidden absolute top-3 right-3 z-50 flex items-center gap-1.5">
              <button
                onClick={onClose}
                className="p-2 bg-black/20 dark:bg-white/10 hover:bg-black/30 dark:hover:bg-white/20 rounded-full text-slate-800 dark:text-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Sidebar / Top Navigation */}
            <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161b22] flex flex-col shrink-0 select-none">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h1 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Quick Utilities
                </h1>
                {/* Maximize & Close buttons for desktop */}
                <div className="hidden md:flex items-center gap-1">
                  <button
                    onClick={() => setIsMaximized(!isMaximized)}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    title={isMaximized ? "Restore Modal" : "Maximize Fullscreen"}
                  >
                    {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                  </button>
                  <button
                    onClick={onClose}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    title="Close"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="flex flex-row md:flex-col overflow-x-auto md:overflow-y-auto p-3 gap-2 scrollbar-none">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 md:flex-none flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.id
                      ? tab.activeClass
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-transparent"
                      }`}
                  >
                    <tab.icon size={18} className={`shrink-0 ${tab.iconClass}`} />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 h-full overflow-hidden flex flex-col bg-slate-50/50 dark:bg-[#0c0f16]/50">
              <div className={activeTab === "wavedisp" ? "w-full h-full flex flex-col" : "hidden"}>
                <Suspense fallback={<div className="flex items-center justify-center w-full h-full text-slate-500">Loading Wave Studio...</div>}>
                  <WaveDisplacementStudio />
                </Suspense>
              </div>
              {activeTab === "passport" && <PassportStudioUtil />}
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
