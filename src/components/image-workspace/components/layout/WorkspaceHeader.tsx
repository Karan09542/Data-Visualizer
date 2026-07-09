import React from 'react';
import { 
  Image as ImageIcon, Undo, Redo, Upload, Info, Sliders 
} from 'lucide-react';
import { useHistory } from '../../contexts/HistoryContext';
import { useWorkspaceUI } from '../../contexts/WorkspaceUIContext';

export const WorkspaceHeader: React.FC = () => {
  const { commandIndex, historyNames, performUndo, performRedo } = useHistory();
  const { 
    isMobile, setShowMobilePanel, setShowShortcuts, setActiveTab, 
    handleImportImageClick, handleFileUpload, artboards 
  } = useWorkspaceUI();

  return (
    <div className="h-12 border-b border-[#2C2C2C] bg-[#1E1E1E] flex items-center px-2 md:px-4 gap-2 md:gap-3 shrink-0 overflow-x-auto no-scrollbar">
        <ImageIcon size={18} className="text-blue-400 shrink-0 ml-1 md:ml-0" />
        <span className="font-semibold text-sm mr-2 md:mr-4 tracking-tight shrink-0 hidden sm:inline-block">Studio Editor</span>
        
        {/* Action History Tools */}
        <div className="flex border border-[#3A3A3A] rounded shadow-sm bg-[#181818] shrink-0">
          <button className={`h-8 w-8 flex items-center justify-center transition-colors border ${commandIndex >= 0 ? 'text-red-400 border-red-500 hover:bg-red-500/10' : 'text-[#4A4A4A] border-transparent'}`} onClick={performUndo} title="Undo (Ctrl+Z)" disabled={commandIndex < 0}>
             <Undo size={14} />
          </button>
          <div className="w-px h-8 bg-[#3A3A3A]" />
          <button className={`h-8 w-8 flex items-center justify-center transition-colors border ${commandIndex < historyNames.length - 1 ? 'text-red-400 border-red-500 hover:bg-red-500/10' : 'text-[#4A4A4A] border-transparent'}`} onClick={performRedo} title="Redo (Ctrl+Y)" disabled={commandIndex >= historyNames.length - 1}>
             <Redo size={14} />
          </button>
        </div>

        <div className="w-px h-6 bg-[#3A3A3A] mx-0.5 md:mx-1 shrink-0" />

        <button className="h-8 w-8 hover:bg-[#2C2C2C] text-[#A0A0A0] hover:text-white flex items-center justify-center rounded transition-colors shrink-0" title="Import Image" onClick={handleImportImageClick}>
          <Upload size={14} />
        </button>
        <input id="img-upload" type="file" multiple className="hidden" accept="image/*,image/svg+xml" onChange={handleFileUpload} />

        <div className="flex-1" />

        <button className="h-8 w-8 hover:bg-[#2C2C2C] text-[#A0A0A0] hover:text-white flex items-center justify-center rounded transition-colors shrink-0 mr-1" title="Shortcuts Info" onClick={() => setShowShortcuts(true)}>
          <Info size={14} />
        </button>

        <button 
           onClick={() => { setActiveTab('export'); if(isMobile) setShowMobilePanel(true); }} 
           disabled={artboards.length === 0}
           className={`h-8 px-3 md:px-5 text-[10px] md:text-[11px] font-black uppercase tracking-widest text-white rounded-lg transition-all shrink-0 whitespace-nowrap flex items-center justify-center gap-2 ${
             artboards.length > 0
               ? 'bg-gradient-to-r from-indigo-500 via-blue-600 to-indigo-600 hover:from-indigo-400 hover:via-blue-500 hover:to-indigo-500 shadow-[0_2px_10px_rgba(79,70,229,0.25)] hover:shadow-[0_4px_16px_rgba(79,70,229,0.4)] active:scale-[0.98] border border-blue-400/20'
               : 'bg-[#2A2A2A] text-[#666] border border-[#333] cursor-not-allowed opacity-50'
           }`}
        >
          {artboards.length > 0 && <span className="hidden md:inline-block w-1.5 h-1.5 rounded-full bg-blue-300 animate-pulse" />}
          Export Studio
        </button>
      </div>
  );
};
