import React, { useState, useEffect, useRef } from 'react';
import { 
  SquareDashed, Plus, X, Copy, Trash2, Layout, Maximize, ChevronDown, MoreVertical, Settings, Edit2
} from 'lucide-react';
import { useWorkspaceUI } from '../../contexts/WorkspaceUIContext';
import { useCanvas } from '../../contexts/CanvasContext';
import { useHistory } from '../../contexts/HistoryContext';
import { ARTBOARD_PRESETS } from '../../types/artboards';
import { ModernCheckbox } from '../shared/ModernCheckbox';
import { PRESET_REGISTRY, getDimensionsInPixels } from '../../../../lib/imagePresets';
import { ColorPickerTrigger } from '../shared/ColorPickers';

export const ArtboardsTab: React.FC = () => {
  const { 
    artboards, setArtboards, activeArtboardId, setActiveArtboardId,
    createArtboard, createArtboardFromPreset, duplicateArtboard, deleteArtboard,
    updateArtboardProp, onArtboardPropStart, onArtboardPropCommit
  } = useWorkspaceUI();

  const { updateArtboardPropDirect, fabricRef, setZoomPercent } = useCanvas();
  const { executeCommand } = useHistory();

  const [draggedArtboardIdx, setDraggedArtboardIdx] = useState<number | null>(null);
  const [dragOverArtboardIdx, setDragOverArtboardIdx] = useState<number | null>(null);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [expandedSettingsId, setExpandedSettingsId] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [showPresetsMenu, setShowPresetsMenu] = useState(false);
  const [presetCategoryFilter, setPresetCategoryFilter] = useState<string>("all");
  const presetsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (presetsMenuRef.current && !presetsMenuRef.current.contains(e.target as Node)) {
        setShowPresetsMenu(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    if (showPresetsMenu || openMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showPresetsMenu, openMenuId]);

  const moveArtboard = (sourceIndex: number, destIndex: number) => {
    if (sourceIndex === destIndex) return;
    const newArtboards = [...artboards];
    const [removed] = newArtboards.splice(sourceIndex, 1);
    newArtboards.splice(destIndex, 0, removed);
    
    // Command history integration
    const cmd = {
       name: "Reorder Artboards",
       execute: () => { setArtboards(newArtboards); },
       undo: () => {
          const revertArtboards = [...newArtboards];
          const [popped] = revertArtboards.splice(destIndex, 1);
          revertArtboards.splice(sourceIndex, 0, popped);
          setArtboards(revertArtboards);
       }
    };
    executeCommand(cmd as any);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden text-white font-sans selection:bg-blue-500/30">
       {/* Header & Create */}
       <div className="p-3 md:p-4 shrink-0 border-b border-[#2C2C2C] bg-[#1A1A1A] z-10 shadow-sm flex flex-col gap-3 md:gap-4 pb-4 md:pb-5">
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-2">
                <SquareDashed size={14} className="text-blue-400 opacity-80 md:w-4 md:h-4"/>
                <span className="text-xs md:text-sm font-semibold text-[#EEEEEE] tracking-tight">Artboards</span>
             </div>
             <span className="text-[10px] bg-[#222] text-[#888] border border-[#333] px-1.5 py-0.5 rounded font-mono font-medium">{artboards.length} Boards</span>
          </div>
          <div className="flex flex-col md:flex-row gap-2 md:gap-2 relative">
             <div className="flex-1 relative">
                <button 
                   type="button"
                   onClick={(e) => { e.stopPropagation(); setShowPresetsMenu(!showPresetsMenu); }}
                   className="w-full h-10 min-h-[40px] md:h-8 md:min-h-0 bg-[#222] hover:bg-[#2A2A2A] text-[#CCC] rounded text-[11px] font-semibold transition border border-[#333] flex items-center justify-between px-3 md:px-2.5 touch-manipulation cursor-pointer"
                >
                   <span className="truncate">Presets ({PRESET_REGISTRY.length})</span>
                   <ChevronDown size={13} className={`opacity-70 transition-transform ${showPresetsMenu ? 'rotate-180 text-blue-400' : ''}`} />
                </button>

                {showPresetsMenu && (
                   <div 
                      ref={presetsMenuRef}
                      className="absolute top-full left-0 w-full md:w-[280px] mt-1 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg shadow-2xl z-[99999] flex flex-col max-h-[380px] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                   >
                      {/* Category tabs */}
                      <div className="p-1.5 bg-[#222] border-b border-[#333] flex gap-1 overflow-x-auto no-scrollbar shrink-0">
                         {['all', 'screens', 'social', 'document', 'print', 'ecommerce'].map(cat => (
                            <button
                               key={cat}
                               type="button"
                               onClick={() => setPresetCategoryFilter(cat)}
                               className={`px-3 py-1.5 md:px-2 md:py-0.5 rounded text-[10px] md:text-[9px] font-bold uppercase tracking-wider transition shrink-0 touch-manipulation min-h-[36px] md:min-h-0 ${presetCategoryFilter === cat ? 'bg-blue-600 text-white' : 'text-[#888] hover:text-[#CCC] bg-[#181818]'}`}
                            >
                               {cat}
                            </button>
                         ))}
                      </div>

                      {/* Presets list */}
                      <div className="flex-1 overflow-y-auto custom-scrollbar p-1 divide-y divide-[#262626]">
                         {PRESET_REGISTRY
                            .filter(p => presetCategoryFilter === 'all' || p.category === presetCategoryFilter)
                            .map((preset) => {
                               const dims = getDimensionsInPixels(preset);
                               return (
                                  <div 
                                     key={preset.id}
                                     className="p-2 hover:bg-[#252525] rounded transition flex items-center justify-between gap-2 group font-sans min-h-[44px] md:min-h-0"
                                  >
                                     <button 
                                        type="button"
                                        onClick={() => {
                                           createArtboardFromPreset(preset.id);
                                           setShowPresetsMenu(false);
                                        }}
                                        className="flex-1 text-left min-w-0 touch-manipulation h-full"
                                        title={`Apply ${preset.name} (${dims.width}x${dims.height}) to active artboard`}
                                     >
                                        <div className="text-[12px] md:text-[11px] font-semibold text-[#E0E0E0] group-hover:text-blue-300 truncate">{preset.name}</div>
                                        <div className="text-[10px] md:text-[9px] font-mono text-[#777] flex items-center gap-1 mt-0.5">
                                           <span>{dims.width} x {dims.height} px</span>
                                           <span className="opacity-40">•</span>
                                           <span className="capitalize">{preset.category}</span>
                                        </div>
                                     </button>

                                     <button
                                        type="button"
                                        onClick={(e) => {
                                           e.stopPropagation();
                                           createArtboard(preset.name, dims.width, dims.height);
                                           setShowPresetsMenu(false);
                                        }}
                                        className="px-3 py-2 md:px-2 md:py-1 bg-blue-600/20 hover:bg-blue-600 border border-blue-500/30 text-blue-300 hover:text-white rounded text-[10px] md:text-[9px] font-semibold transition shrink-0 touch-manipulation flex items-center gap-1 min-h-[36px] md:min-h-0"
                                        title="Create brand new artboard with this preset"
                                     >
                                        <Plus size={12} className="md:w-[10px] md:h-[10px]" /> New
                                     </button>
                                  </div>
                               );
                            })}
                      </div>
                   </div>
                )}
             </div>
             <button 
                onClick={() => createArtboard()}
                className="flex-1 h-10 min-h-[40px] md:h-8 md:min-h-0 bg-blue-600/90 hover:bg-blue-500 text-white rounded text-[11px] font-semibold transition shadow touch-manipulation"
             >
                + Custom
             </button>
          </div>
       </div>

       {/* List existing artboards */}
       <div className="flex-1 overflow-y-auto w-full no-scrollbar px-2 py-3 bg-[#111] md:bg-[#151515]">
         {artboards.length === 0 && (
            <div className="text-center p-6 text-xs text-[#6A6A6A] italic">No artboards created yet.</div>
         )}
         <div className="space-y-1.5 pb-24">
             {artboards.map((board, idx) => {
               const isActive = board.id === activeArtboardId;
               const objCount = fabricRef.current ? fabricRef.current.getObjects().filter(o => (o as any).artboardId === board.id).length : 0;
               const isDragOver = dragOverArtboardIdx === idx;
               const isDragging = draggedArtboardIdx === idx;
               
               return (
                 <div 
                   key={board.id}
                   draggable
                   onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggedArtboardIdx(idx);
                   }}
                   onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverArtboardIdx(idx);
                   }}
                   onDrop={(e) => {
                      e.preventDefault();
                      if (draggedArtboardIdx !== null && dragOverArtboardIdx !== null) {
                         moveArtboard(draggedArtboardIdx, dragOverArtboardIdx);
                      }
                      setDraggedArtboardIdx(null);
                      setDragOverArtboardIdx(null);
                   }}
                   onDragEnd={() => {
                      setDraggedArtboardIdx(null);
                      setDragOverArtboardIdx(null);
                   }}
                   onClick={() => setActiveArtboardId(board.id)} 
                   onDoubleClick={() => {
                      setActiveArtboardId(board.id);
                      if (fabricRef.current) {
                        const cw = fabricRef.current.width!;
                        const ch = fabricRef.current.height!;
                        const zoom = Math.min(cw / (board.width + 100), ch / (board.height + 100), 2);
                        fabricRef.current.setZoom(zoom);
                        
                        const vpt = fabricRef.current.viewportTransform!;
                        const newVpt = vpt.slice() as any;
                        newVpt[4] = cw / 2 - (board.x + board.width / 2) * zoom;
                        newVpt[5] = ch / 2 - (board.y + board.height / 2) * zoom;
                        fabricRef.current.setViewportTransform(newVpt);
                        setZoomPercent(Math.round(zoom * 100));
                      }
                   }}
                   className={`
                     relative p-2.5 rounded-lg cursor-pointer border select-none transition-colors group
                     ${isActive ? 'bg-blue-600/10 border-blue-500/80 shadow-[0_0_0_1px_rgba(59,130,246,0.2)_inset]' : 'bg-[#1C1C1C] border-[#2C2C2C] hover:border-[#4A4A4A]'} 
                     ${isDragging ? 'opacity-30 border-dashed' : 'opacity-100'}
                     ${isDragOver && draggedArtboardIdx !== null && draggedArtboardIdx > idx ? 'border-t-2 border-t-blue-400' : ''}
                     ${isDragOver && draggedArtboardIdx !== null && draggedArtboardIdx < idx ? 'border-b-2 border-b-blue-400' : ''}
                   `}
                 >
                    <div className="flex gap-3 items-center">
                       {/* Preview Thumbnail placeholder */}
                       <div 
                          className="w-10 h-10 shrink-0 border border-[#3A3A3A] rounded flex items-center justify-center overflow-hidden"
                          style={{ backgroundColor: board.backgroundColor || '#fff', ...(!board.transparent ? {} : { backgroundImage: 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYNgGwEg9AMRAGQzUQJDw/wP9h2IIMhqwYYwGKDAaINBQgAHTyMAwwAEAnpIEB3aIfjIAAAAASUVQRVGGIII=")' }) }}
                       >
                          {board.transparent && <div className="w-full h-full bg-black/10"></div>}
                       </div>
                       
                       <div className="flex-1 w-0 min-w-0 flex flex-col justify-center">
                          {editingNameId === board.id ? (
                             <input 
                               type="text" 
                               autoFocus
                               className="w-full h-8 bg-[#111] border border-[#444] rounded px-2 text-[11px] font-semibold text-white outline-none focus:border-blue-500 transition-colors mb-0.5" 
                               value={board.name} 
                               onFocus={() => onArtboardPropStart(board.name)}
                               onChange={(e) => updateArtboardProp(board.id, "name", e.target.value)} 
                               onBlur={(e) => {
                                  onArtboardPropCommit(board.id, "name", e.target.value);
                                  setEditingNameId(null);
                               }}
                               onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === 'Escape') {
                                    onArtboardPropCommit(board.id, "name", board.name);
                                    setEditingNameId(null);
                                  }
                               }}
                             />
                          ) : (
                             <div className="flex items-center justify-between mb-0.5">
                               <span className={`text-[11px] font-semibold truncate ${isActive ? 'text-blue-300' : 'text-[#E0E0E0]'}`}>{board.name}</span>
                               <div className="flex items-center gap-1 shrink-0 ml-2">
                                   <span className="text-[8px] bg-[#222] text-[#888] px-1.5 py-0.5 rounded-sm font-mono border border-[#333]">{objCount}</span>
                               </div>
                             </div>
                          )}
                          <div className="text-[9px] text-[#777] font-mono flex items-center gap-1.5">
                             <span>{board.width}<span className="opacity-40">x</span>{board.height}</span>
                             <span className="opacity-30">|</span>
                             <span className={`${board.orientation === 'landscape' ? 'text-cyan-600/80' : 'text-purple-600/80'} uppercase tracking-tight`}>{board.orientation === 'landscape' ? 'LND' : 'PRT'}</span>
                          </div>
                       </div>
                       
                       {/* Context Menu Toggle */}
                       <div className="shrink-0 relative">
                          <button
                            onClick={(e) => {
                               e.stopPropagation();
                               setOpenMenuId(openMenuId === board.id ? null : board.id);
                            }}
                            className="w-8 h-10 flex items-center justify-center hover:bg-white/10 text-[#888] hover:text-white rounded transition-colors touch-manipulation"
                          >
                            <MoreVertical size={16} />
                          </button>
                          
                          {openMenuId === board.id && (
                             <div 
                               ref={menuRef}
                               className="absolute right-0 top-full mt-1 w-40 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg shadow-2xl z-[99999] flex flex-col py-1 animate-in fade-in zoom-in-95 duration-100"
                             >
                                <button
                                   onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingNameId(board.id);
                                      setOpenMenuId(null);
                                   }}
                                   className="w-full px-3 py-2 text-left text-[11px] font-semibold text-[#CCC] hover:text-white hover:bg-[#333] transition-colors flex items-center gap-2 touch-manipulation"
                                >
                                   <Edit2 size={12} /> Rename
                                </button>
                                <button
                                   onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedSettingsId(expandedSettingsId === board.id ? null : board.id);
                                      setOpenMenuId(null);
                                      // If it's not active, make it active so settings apply properly on canvas
                                      if (!isActive) setActiveArtboardId(board.id);
                                   }}
                                   className="w-full px-3 py-2 text-left text-[11px] font-semibold text-[#CCC] hover:text-white hover:bg-[#333] transition-colors flex items-center gap-2 touch-manipulation"
                                >
                                   <Settings size={12} /> {expandedSettingsId === board.id ? 'Hide Settings' : 'Settings'}
                                </button>
                                <button
                                   onClick={(e) => {
                                      e.stopPropagation();
                                      duplicateArtboard(board);
                                      setOpenMenuId(null);
                                   }}
                                   className="w-full px-3 py-2 text-left text-[11px] font-semibold text-[#CCC] hover:text-white hover:bg-[#333] transition-colors flex items-center gap-2 touch-manipulation"
                                >
                                   <Copy size={12} /> Duplicate
                                </button>
                                <div className="h-px bg-[#333] my-1 mx-2" />
                                <button
                                   onClick={(e) => {
                                      e.stopPropagation();
                                      deleteArtboard(board.id);
                                      setOpenMenuId(null);
                                   }}
                                   className="w-full px-3 py-2 text-left text-[11px] font-semibold text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors flex items-center gap-2 touch-manipulation"
                                >
                                   <Trash2 size={12} /> Delete
                                </button>
                             </div>
                          )}
                       </div>
                    </div>
                    
                    {/* Advanced Settings Expansion */}
                    {expandedSettingsId === board.id && (
                       <div className="mt-3 pt-3 border-t border-[#333] space-y-4 md:space-y-3 animate-in fade-in slide-in-from-top-1 duration-200" onClick={e => e.stopPropagation()}>
                          
                          {/* Dimensions & Orientation */}
                          <div className="flex flex-col md:flex-row gap-3 md:gap-2">
                             <div className="flex gap-2 flex-1">
                                <div className="flex-1 flex flex-col gap-1.5 md:gap-1">
                                   <span className="text-[10px] md:text-[9px] text-[#666] uppercase font-bold tracking-wider">Width</span>
                                   <input 
                                     type="number" 
                                     className="w-full h-10 md:h-7 bg-[#111] border border-[#333] rounded px-2 md:px-1.5 text-[11px] md:text-[10px] font-mono text-[#CCC] outline-none focus:border-blue-500 transition-colors" 
                                     value={board.width} 
                                     onFocus={() => onArtboardPropStart(board.width)}
                                     onChange={(e) => updateArtboardProp(board.id, "width", Math.max(10, Number(e.target.value)))} 
                                     onBlur={(e) => onArtboardPropCommit(board.id, "width", Math.max(10, Number(e.target.value)))}
                                   />
                                </div>
                                <div className="flex-1 flex flex-col gap-1.5 md:gap-1">
                                   <span className="text-[10px] md:text-[9px] text-[#666] uppercase font-bold tracking-wider">Height</span>
                                   <input 
                                     type="number" 
                                     className="w-full h-10 md:h-7 bg-[#111] border border-[#333] rounded px-2 md:px-1.5 text-[11px] md:text-[10px] font-mono text-[#CCC] outline-none focus:border-blue-500 transition-colors" 
                                     value={board.height} 
                                     onFocus={() => onArtboardPropStart(board.height)}
                                     onChange={(e) => updateArtboardProp(board.id, "height", Math.max(10, Number(e.target.value)))} 
                                     onBlur={(e) => onArtboardPropCommit(board.id, "height", Math.max(10, Number(e.target.value)))}
                                   />
                                </div>
                             </div>
                             
                             <div className="flex flex-col gap-1.5 md:gap-1 shrink-0">
                                <span className="text-[10px] md:text-[9px] text-[#666] uppercase font-bold tracking-wider">Orientation</span>
                                <div className="flex bg-[#111] border border-[#333] rounded p-0.5 h-10 md:h-7">
                                   <button 
                                     onClick={() => updateArtboardPropDirect(board.id, "orientation", "portrait", true)}
                                     className={`flex-1 md:w-8 flex items-center justify-center rounded-[2px] transition ${board.orientation === "portrait" ? "bg-[#333] text-white" : "text-[#666] hover:text-[#CCC]"}`}
                                     title="Portrait"
                                   >
                                      <div className="w-2.5 h-3.5 border-2 border-current rounded-sm"></div>
                                   </button>
                                   <button 
                                     onClick={() => updateArtboardPropDirect(board.id, "orientation", "landscape", true)}
                                     className={`flex-1 md:w-8 flex items-center justify-center rounded-[2px] transition ${board.orientation === "landscape" ? "bg-[#333] text-white" : "text-[#666] hover:text-[#CCC]"}`}
                                     title="Landscape"
                                   >
                                      <div className="w-3.5 h-2.5 border-2 border-current rounded-sm"></div>
                                   </button>
                                </div>
                             </div>
                          </div>

                          {/* Background */}
                          <div className="flex items-center gap-3 md:gap-2">
                             <div className="relative shrink-0">
                               <ColorPickerTrigger 
                                  color={board.backgroundColor || "#ffffff"}
                                  onChange={(newColor) => updateArtboardProp(board.id, "backgroundColor", newColor)}
                                  onStart={(initialColor) => onArtboardPropStart(initialColor)}
                                  onCommit={(initialColor, finalColor) => {
                                     onArtboardPropStart(initialColor);
                                     onArtboardPropCommit(board.id, "backgroundColor", finalColor);
                                  }}
                                  label="Background"
                                  className="w-10 h-10 md:w-7 md:h-7 rounded border border-[#333]"
                               />
                             </div>
                             <input 
                                type="text" 
                                className="h-10 md:h-7 flex-1 md:flex-none bg-[#111] border border-[#333] rounded px-3 md:px-2 text-[11px] md:text-[10px] text-[#CCC] w-full md:w-20 uppercase font-mono outline-none focus:border-blue-500 transition-colors" 
                                value={board.backgroundColor || "#FFFFFF"} 
                                onFocus={() => onArtboardPropStart(board.backgroundColor || "#ffffff")}
                                onChange={(e) => updateArtboardProp(board.id, "backgroundColor", e.target.value)} 
                                onBlur={(e) => onArtboardPropCommit(board.id, "backgroundColor", e.target.value)}
                             />
                             <div className="ml-auto flex h-10 md:h-7 items-center">
                               <ModernCheckbox 
                                 label="Transparent"
                                 checked={!!board.transparent} 
                                 onChange={(val) => updateArtboardPropDirect(board.id, "transparent", val, true)} 
                               />
                             </div>
                          </div>

                          {/* Guides toggle */}
                          <div className="pt-3 md:pt-2 border-t border-[#333] grid grid-cols-2 gap-3 md:gap-1.5 opacity-80">
                             <ModernCheckbox label="Show Grid" checked={!!board.showGrid} onChange={val => updateArtboardPropDirect(board.id, "showGrid", val, true)} />
                             <ModernCheckbox label="Safe Area" checked={!!board.showSafeArea} onChange={val => updateArtboardPropDirect(board.id, "showSafeArea", val, true)} />
                             <ModernCheckbox label="Margins" checked={!!board.showMargins} onChange={val => updateArtboardPropDirect(board.id, "showMargins", val, true)} />
                             <ModernCheckbox label="Center Guide" checked={!!board.showCenter} onChange={val => updateArtboardPropDirect(board.id, "showCenter", val, true)} />
                          </div>
                       </div>
                    )}
                 </div>
               )
             })}
         </div>
       </div>
    </div>
  );
};
