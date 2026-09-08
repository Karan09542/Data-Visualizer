import React from 'react';
import { 
  Image as ImageIcon, Undo, Redo, Upload, Info, Sliders, FileOutput, Maximize2, Minimize2
} from 'lucide-react';
import { useHistory } from '../../contexts/HistoryContext';
import { useWorkspaceUI } from '../../contexts/WorkspaceUIContext';

export const WorkspaceHeader: React.FC = () => {
  const { commandIndex, historyNames, performUndo, performRedo } = useHistory();
  const { 
    isMobile, setShowShortcuts, setActiveTab, 
    handleImportImageClick, handleFileUpload, artboards,
    chromeHidden, onToggleChrome
  } = useWorkspaceUI();

  return (
    <div className={`border-b border-slate-200 dark:border-[#2C2C2C] bg-white dark:bg-[#1E1E1E] text-slate-800 dark:text-white flex items-center px-2 md:px-4 gap-2 md:gap-3 shrink-0 overflow-x-auto no-scrollbar transition-all ${isMobile ? 'h-10' : 'h-12'}`}>
        <span className={`flex items-center justify-center shrink-0 rounded-md bg-blue-500/10 border border-blue-500/25 ${isMobile ? 'h-7 w-7' : 'h-8 w-8'}`} aria-hidden="true">
          <ImageIcon size={18} className="text-blue-400" />
        </span>
        <span className="font-semibold text-sm text-slate-900 dark:text-white mr-2 md:mr-4 tracking-tight shrink-0 hidden sm:inline-block">Studio Editor</span>
        
        {/* Action History Tools */}
        <div className="flex border border-slate-200 dark:border-[#3A3A3A] rounded shadow-sm bg-slate-100 dark:bg-[#181818] shrink-0">
          <button className={`flex items-center justify-center transition-colors border ${commandIndex >= 0 ? 'text-red-500 dark:text-red-400 border-red-500 hover:bg-red-500/10' : 'text-slate-300 dark:text-[#4A4A4A] border-transparent'} ${isMobile ? 'h-7 w-7' : 'h-8 w-8'}`} onClick={performUndo} title="Undo (Ctrl+Z)" disabled={commandIndex < 0}>
             <Undo size={14} />
          </button>
          <div className={`w-px bg-slate-200 dark:bg-[#3A3A3A] ${isMobile ? 'h-7' : 'h-8'}`} />
          <button className={`flex items-center justify-center transition-colors border ${commandIndex < historyNames.length - 1 ? 'text-red-500 dark:text-red-400 border-red-500 hover:bg-red-500/10' : 'text-slate-300 dark:text-[#4A4A4A] border-transparent'} ${isMobile ? 'h-7 w-7' : 'h-8 w-8'}`} onClick={performRedo} title="Redo (Ctrl+Y)" disabled={commandIndex >= historyNames.length - 1}>
             <Redo size={14} />
          </button>
        </div>

        <div className={`w-px bg-slate-200 dark:bg-[#3A3A3A] mx-0.5 md:mx-1 shrink-0 ${isMobile ? 'h-5' : 'h-6'}`} />

        <button className={`hover:bg-slate-100 dark:hover:bg-[#2C2C2C] text-slate-500 dark:text-[#A0A0A0] hover:text-slate-900 dark:hover:text-white flex items-center justify-center rounded transition-colors shrink-0 ${isMobile ? 'h-7 w-7' : 'h-8 w-8'}`} title="Import Image" onClick={handleImportImageClick}>
          <Upload size={14} />
        </button>
        <input id="img-upload" type="file" multiple className="hidden" accept="image/*,image/svg+xml" onChange={handleFileUpload} />

        <div className="flex-1" />

        <button className={`hidden sm:flex hover:bg-slate-100 dark:hover:bg-[#2C2C2C] text-slate-500 dark:text-[#A0A0A0] hover:text-slate-900 dark:hover:text-white items-center justify-center rounded transition-colors shrink-0 mr-1 h-8 w-8`} title="Shortcuts Info" onClick={() => setShowShortcuts(true)}>
          <Info size={14} />
        </button>

        {/* Distraction-free toggle: hands the title bar and tab strip's height to the canvas. */}
        {onToggleChrome && (
          <button
            type="button"
            onClick={onToggleChrome}
            aria-pressed={!!chromeHidden}
            title={chromeHidden ? 'Show tabs and title bar' : 'Hide tabs and title bar for a full-height canvas'}
            className={`${isMobile ? 'h-7 w-7' : 'h-8 w-8'} flex items-center justify-center rounded transition-colors shrink-0 mr-1 ${chromeHidden
              ? 'bg-blue-100 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400'
              : 'hover:bg-slate-100 dark:hover:bg-[#2C2C2C] text-slate-500 dark:text-[#A0A0A0] hover:text-slate-900 dark:hover:text-white'}`}
          >
            {chromeHidden ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        )}

        <button 
           onClick={() => setActiveTab('export')} 
           disabled={artboards.length === 0}
           title="Export Studio"
           aria-label="Export Studio"
           className={`${isMobile ? 'h-7 px-2.5 gap-1.5 rounded-md' : 'h-8 px-3 md:px-5 rounded-lg gap-2'} text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all shrink-0 whitespace-nowrap flex items-center justify-center ${
             artboards.length > 0
               ? `text-white bg-gradient-to-r from-indigo-500 via-blue-600 to-indigo-600 hover:from-indigo-400 hover:via-blue-500 hover:to-indigo-500 active:scale-[0.98] border border-blue-400/20 ${isMobile ? 'shadow-sm' : 'shadow-[0_2px_10px_rgba(79,70,229,0.25)] hover:shadow-[0_4px_16px_rgba(79,70,229,0.4)]'}`
               : 'bg-slate-200 text-slate-400 border border-slate-300 dark:bg-[#2A2A2A] dark:text-[#666] dark:border-[#333] cursor-not-allowed opacity-60'
           }`}
        >
          {artboards.length > 0 && <span className="hidden md:inline-block w-1.5 h-1.5 rounded-full bg-blue-300 animate-pulse" />}
          {isMobile
            ? <><FileOutput size={13} strokeWidth={2.5} /><span>Export</span></>
            : 'Export Studio'}
        </button>
      </div>
  );
};
