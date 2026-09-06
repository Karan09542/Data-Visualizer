import React, { useState, useEffect, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, FileImage, FolderArchive, Binary, Hash, Palette, FileSpreadsheet, Key, Printer, Pipette, Waves, Maximize2, Minimize2, Scissors, FileStack, Sticker } from "lucide-react";
import { ImageToPdfConverter } from "./ImageToPdfConverter";
import { FolderToZipConverter } from "./FolderToZipConverter";
import { Base64Converter } from "./Base64Converter";
import { HashGenerator } from "./HashGenerator";
import { ColorConverter } from "./ColorConverter";
import { CsvToJsonConverter } from "./CsvToJsonConverter";
import { JwtDecoder } from "./JwtDecoder";
import { ImageColorExtractor } from "./ImageColorExtractor";
import { PassportStudioUtil } from "./PassportStudioUtil";
import { ImageSlicerUtil } from "./ImageSlicerUtil";
import { PdfMergeUtil } from "./PdfMergeUtil";
import CustomSelect from "../CustomSelect";

const WaveDisplacementStudio = lazy(() => import("./WaveDisplacementStudio").then(m => ({ default: m.WaveDisplacementStudio })));
// Split out: it pulls in the AI runtime, the eraser engine and d3, none of
// which are needed unless the Sticker Maker tab is actually opened.
const StickerMakerUtil = lazy(() => import("./StickerMakerUtil").then(m => ({ default: m.StickerMakerUtil })));

const TABS = [
  { id: "passport", label: "Passport Studio", icon: Printer, activeClass: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-200/50 dark:border-blue-800/30 font-bold", iconClass: "text-blue-500" },
  { id: "img2pdf", label: "Image to PDF", icon: FileImage, activeClass: "bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 shadow-sm border border-sky-200/50 dark:border-sky-800/30", iconClass: "text-sky-500" },
  { id: "pdfmerge", label: "Merge PDFs", icon: FileStack, activeClass: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-200/50 dark:border-blue-800/30 font-bold", iconClass: "text-blue-500" },
  { id: "imgslicer", label: "Image Slicer", icon: Scissors, activeClass: "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 shadow-sm border border-orange-200/50 dark:border-orange-800/30", iconClass: "text-orange-500" },
  { id: "wavedisp", label: "Wave Studio", icon: Waves, activeClass: "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 shadow-sm border border-cyan-200/50 dark:border-cyan-800/30 font-bold", iconClass: "text-cyan-500" },
  { id: "folder2zip", label: "Folder to ZIP", icon: FolderArchive, activeClass: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 shadow-sm border border-purple-200/50 dark:border-purple-800/30", iconClass: "text-purple-500" },
  { id: "colorthief", label: "Color Thief", icon: Pipette, activeClass: "bg-fuchsia-50 dark:bg-fuchsia-900/20 text-fuchsia-600 dark:text-fuchsia-400 shadow-sm border border-fuchsia-200/50 dark:border-fuchsia-800/30", iconClass: "text-fuchsia-500" },
  { id: "base64", label: "Base64", icon: Binary, activeClass: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-200/50 dark:border-emerald-800/30", iconClass: "text-emerald-500" },
  { id: "hash", label: "Hash Generator", icon: Hash, activeClass: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 shadow-sm border border-red-200/50 dark:border-red-800/30", iconClass: "text-red-500" },
  { id: "color", label: "Color Converter", icon: Palette, activeClass: "bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 shadow-sm border border-pink-200/50 dark:border-pink-800/30", iconClass: "text-pink-500" },
  { id: "csv2json", label: "CSV to JSON", icon: FileSpreadsheet, activeClass: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-200/50 dark:border-indigo-800/30", iconClass: "text-indigo-500" },
  { id: "jwt", label: "JWT Decoder", icon: Key, activeClass: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 shadow-sm border border-amber-200/50 dark:border-amber-800/30", iconClass: "text-amber-500" },
  { id: "stickermaker", label: "Sticker Maker", icon: Sticker, activeClass: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 shadow-sm border border-purple-200/50 dark:border-purple-800/30", iconClass: "text-purple-500" },
] as const;

interface QuickUtilsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickUtilsModal({ isOpen, onClose }: QuickUtilsModalProps) {
  const [activeTab, setActiveTab] = useState<"wavedisp" | "passport" | "img2pdf" | "pdfmerge" | "imgslicer" | "folder2zip" | "base64" | "hash" | "color" | "csv2json" | "jwt" | "colorthief" | "stickermaker">("passport");
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
        <div 
          data-quick-utils-modal="true"
          className={`custom-dropzone quick-utils-modal fixed inset-0 z-[600] flex items-center justify-center ${isMaximized ? "p-0" : "p-0 md:p-4 sm:p-2"}`}
          onDragEnter={(e) => {
            e.stopPropagation();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDragLeave={(e) => {
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
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
            {/* Sidebar / Top Navigation */}
            <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161b22] flex flex-col shrink-0 select-none">
              <div className="p-2.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                <h1 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0 truncate">
                  Quick Utils
                </h1>
                
                <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
                  {/* Mobile Dropdown */}
                  <div className="md:hidden w-[150px] sm:w-[200px]">
                    <CustomSelect
                      value={activeTab}
                      onChange={(val) => setActiveTab(val as any)}
                      options={TABS.map(t => ({
                        label: t.label,
                        value: t.id,
                        icon: <t.icon size={14} className={t.iconClass} />
                      }))}
                      icon={
                        TABS.find(t => t.id === activeTab) ? (
                          (() => {
                            const TabIcon = TABS.find(t => t.id === activeTab)!.icon;
                            const iconClass = TABS.find(t => t.id === activeTab)!.iconClass;
                            return <TabIcon size={16} className={iconClass} />;
                          })()
                        ) : undefined
                      }
                      className="w-full font-semibold shadow-sm text-xs sm:text-sm"
                    />
                  </div>

                  {/* Mobile Close Button */}
                  <button
                    onClick={onClose}
                    className="md:hidden p-1.5 sm:p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300 transition-colors shrink-0"
                  >
                    <X size={16} />
                  </button>

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
              </div>

              {/* Desktop Tabs */}
              <div className="hidden md:flex flex-col overflow-y-auto p-3 gap-2 scrollbar-none">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.id
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
              {activeTab === "pdfmerge" && <PdfMergeUtil />}
              {activeTab === "imgslicer" && <ImageSlicerUtil />}
              {activeTab === "folder2zip" && <FolderToZipConverter />}
              {activeTab === "base64" && <Base64Converter />}
              {activeTab === "hash" && <HashGenerator />}
              {activeTab === "color" && <ColorConverter />}
              {activeTab === "csv2json" && <CsvToJsonConverter />}
              {activeTab === "jwt" && <JwtDecoder />}
              {activeTab === "colorthief" && <ImageColorExtractor />}
              {activeTab === "stickermaker" && (
                <Suspense fallback={<div className="flex items-center justify-center w-full h-full text-slate-500">Loading Sticker Maker...</div>}>
                  <StickerMakerUtil />
                </Suspense>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
