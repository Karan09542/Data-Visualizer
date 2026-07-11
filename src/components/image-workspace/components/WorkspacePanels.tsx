import React from 'react';
import { createPortal } from 'react-dom';
import { Settings, SquareDashed, Activity, Sparkles, Layers, History, Download, AlignLeft, AlignCenter, AlignRight, AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter, AlignVerticalSpaceBetween, AlignHorizontalSpaceBetween, MousePointer2, Copy, Trash2, ArrowUp, ArrowDown, ArrowUpToLine, ArrowDownToLine, Keyboard, Upload, Library, Link, Plus, Type, Grid, X, Edit2 } from 'lucide-react';
import { TabBtn } from './shared/TabBtn';
import { PropertiesTab } from './panels/PropertiesTab';
import { ArtboardsTab } from './panels/ArtboardsTab';
import { FilterStudioTab } from './panels/FilterStudioTab';
import { LayersTab } from './panels/LayersTab';
import { ContextMenuItem } from './shared/ContextMenuItem';
import { processPasteEvent } from '../../image-import/clipboard/clipboardImporter';

export interface WorkspacePanelsProps {
  isMobile: any;
  panelWidth: any;
  showMobilePanel: any;
  setShowMobilePanel: any;
  isResizingPanel: any;
  activeTab: any;
  setActiveTab: any;
  selectionType: any;
  createArtboard: any;
  setRenamingArtboard: any;
  renamingArtboard: any;
  activeArtboardId: any;
  setActiveArtboardId: any;
  artboards: any;
  closeContextMenu: any;
  setShowAssetGallery: any;
  setShowUrlPrompt: any;
  addText: any;
  processPasteEvent: any;
  importAssets: any;
  showMobileArtboardsGallery: any;
  setShowMobileArtboardsGallery: any;
  updateArtboardPropDirect: any;
  showShortcuts: any;
  setShowShortcuts: any;
}

export const WorkspacePanels: React.FC<WorkspacePanelsProps> = ({ isMobile, panelWidth, showMobilePanel, setShowMobilePanel, isResizingPanel, activeTab, setActiveTab, selectionType, createArtboard, setRenamingArtboard, renamingArtboard, activeArtboardId, setActiveArtboardId, artboards, closeContextMenu, setShowAssetGallery, setShowUrlPrompt, addText, processPasteEvent, importAssets, showMobileArtboardsGallery, setShowMobileArtboardsGallery, updateArtboardPropDirect, showShortcuts, setShowShortcuts }) => {
  return (
    <>
      {/* Right Sidebar - Logic Panels */}
                              <div
                                 style={{ width: isMobile ? '100%' : `${panelWidth}px` }}
                                 className={`${isMobile ? `fixed bottom-0 left-0 right-0 z-50 h-[85vh] rounded-t-2xl transform transition-transform duration-300 ${showMobilePanel ? 'translate-y-0' : 'translate-y-full'}` : 'h-full'} border-l ${isResizingPanel ? 'border-blue-500/50' : 'border-[#2C2C2C]'} bg-[#1E1E1E] flex flex-col shrink-0 overflow-hidden shadow-[0_-4px_24px_rgba(0,0,0,0.5)] md:shadow-[-4px_0_12px_rgba(0,0,0,0.2)] transition-colors duration-150`}
                              >
                                 {isMobile && (
                                    <div
                                       className="w-full flex justify-center py-3 shrink-0 z-10 sticky top-0 bg-[#1E1E1E]"
                                       onTouchStart={(e) => {
                                          const startY = e.touches[0].clientY;
                                          const handleMove = (eMove: TouchEvent) => {
                                             const delta = eMove.touches[0].clientY - startY;
                                             if (delta > 50) {
                                                setShowMobilePanel(false);
                                                document.removeEventListener('touchmove', handleMove);
                                             }
                                          };
                                          const handleEnd = () => {
                                             document.removeEventListener('touchmove', handleMove);
                                             document.removeEventListener('touchend', handleEnd);
                                          };
                                          document.addEventListener('touchmove', handleMove);
                                          document.addEventListener('touchend', handleEnd);
                                       }}
                                    >
                                       <div className="w-16 h-1.5 bg-[#4A4A4A] rounded-full" />
                                    </div>
                                 )}

                                 <div className="flex w-full bg-[#1A1A1A] border-b border-[#2C2C2C] overflow-x-auto select-none no-scrollbar shrink-0">
                                    <TabBtn tab="properties" active={activeTab} set={setActiveTab} label="Props" icon={Settings} />
                                    <TabBtn tab="artboards" active={activeTab} set={setActiveTab} label="Boards" icon={SquareDashed} />
                                    <TabBtn tab="quick" active={activeTab} set={setActiveTab} label="Quick" icon={Activity} />
                                    <TabBtn tab="filters" active={activeTab} set={setActiveTab} label="Filters" icon={Sparkles} />
                                    <TabBtn tab="layers" active={activeTab} set={setActiveTab} label="Layers" icon={Layers} />
                                    <TabBtn tab="history" active={activeTab} set={setActiveTab} label="History" icon={History} />
                                    <TabBtn tab="export" active={activeTab} set={setActiveTab} label="Export" icon={Download} />
                                 </div>

                                 <div className="flex-1 overflow-y-auto overflow-x-hidden">

                                    {/* PROPERTIES PANEL */}
                                    {activeTab === 'properties' && (
                                       <PropertiesTab />
                                    )}
                                    {/* ARTBOARDS PANEL */}
                                    {activeTab === 'artboards' && (
                                       <ArtboardsTab />

                                    )}

                                    {/* QUICK ACTIONS PANEL */}
                                    {activeTab === 'quick' && (
                                       <div className="p-4 space-y-6 text-[#C0C0C0]">
                                          {selectionType !== 'image' && selectionType !== 'frameGroup' ? (
                                             <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
                                                <Activity size={32} className="mb-4 text-emerald-500 animate-pulse" />
                                                <span className="text-sm font-semibold text-white">Quick Actions</span>
                                                <span className="text-xs mt-2 w-48 text-[#8A8A8A]">Select an Image layer on the canvas to access one-click utilities and fixes.</span>
                                             </div>
                                          ) : (
                                             <div className="space-y-6 flex flex-col h-full">

                                                {/* One-Click Quick Fixes */}
                                                <div className="space-y-2">
                                                   <div className="text-[10px] uppercase font-bold tracking-wider text-[#8A8A8A] flex items-center gap-1.5 font-sans">
                                                      <Sparkles size={11} className="text-yellow-400" /> Quick Fixes
                                                   </div>
                                                   <div className="grid grid-cols-1 gap-1.5">
                                                      <button onClick={() => { addFilterToPipeline('brightness'); applyFilter('brightness', 0.1); addFilterToPipeline('contrast'); applyFilter('contrast', 0.15); applyFilter('vibrance', undefined); addFilterToPipeline('vibrance'); }} className="p-2 border border-[#2C2C2C] hover:border-emerald-500/50 hover:bg-emerald-900/20 bg-[#1A1A1A] rounded text-left text-[11px] font-medium transition duration-150 group font-sans flex items-center gap-3">
                                                         <div className="w-6 h-6 rounded bg-[#2A2A2A] flex items-center justify-center text-white"><Sparkles size={12} /></div>
                                                         <div>
                                                            <div className="text-white group-hover:text-emerald-400 transition-colors">Auto Enhance</div>
                                                            <div className="text-[9px] text-[#6A6A6A]">Smart contrast, brightness, and vibrance</div>
                                                         </div>
                                                      </button>
                                                      <button onClick={() => { addFilterToPipeline('sharpen'); applyFilter('sharpen', 0.3); }} className="p-2 border border-[#2C2C2C] hover:border-blue-500/50 hover:bg-blue-900/20 bg-[#1A1A1A] rounded text-left text-[11px] font-medium transition duration-150 group font-sans flex items-center gap-3">
                                                         <div className="w-6 h-6 rounded bg-[#2A2A2A] flex items-center justify-center text-white"><Eye size={12} /></div>
                                                         <div>
                                                            <div className="text-white group-hover:text-blue-400 transition-colors">Auto Sharpen</div>
                                                            <div className="text-[9px] text-[#6A6A6A]">Enhance edge detail and clarity</div>
                                                         </div>
                                                      </button>
                                                      <button onClick={() => { addFilterToPipeline('saturation'); applyFilter('saturation', 0.2); addFilterToPipeline('vibrance'); }} className="p-2 border border-[#2C2C2C] hover:border-violet-500/50 hover:bg-violet-900/20 bg-[#1A1A1A] rounded text-left text-[11px] font-medium transition duration-150 group font-sans flex items-center gap-3">
                                                         <div className="w-6 h-6 rounded bg-[#2A2A2A] flex items-center justify-center text-white"><Palette size={12} /></div>
                                                         <div>
                                                            <div className="text-white group-hover:text-violet-400 transition-colors">Auto Color Correct</div>
                                                            <div className="text-[9px] text-[#6A6A6A]">Boost missing saturation and colors</div>
                                                         </div>
                                                      </button>
                                                   </div>
                                                </div>

                                                {/* Quick Utilities */}
                                                <div className="space-y-2">
                                                   <div className="text-[10px] uppercase font-bold tracking-wider text-[#8A8A8A] flex items-center gap-1.5 font-sans">
                                                      <Settings2 size={11} className="text-slate-400" /> Transform Utilities
                                                   </div>
                                                   <div className="grid grid-cols-2 gap-1.5">
                                                      {[
                                                         { label: 'Fit to Print', target: 'print' },
                                                         { label: 'Fit to Web', target: 'web' },
                                                         { label: 'Center Subject', target: 'center' },
                                                         { label: 'Reset Aspect', target: 'reset' }
                                                      ].map(u => (
                                                         <button
                                                            key={u.label}
                                                            onClick={() => {
                                                               if (u.target === 'reset') resetCrop();
                                                               else alignSelection('centerH');
                                                            }}
                                                            className="py-1 px-2 border border-[#2C2C2C] hover:border-slate-500/50 hover:text-white bg-[#1A1A1A] hover:bg-[#252525] rounded text-center text-[10px] font-medium transition duration-150 font-sans"
                                                         >
                                                            {u.label}
                                                         </button>
                                                      ))}
                                                   </div>
                                                </div>

                                                {/* Digital Frames */}
                                                <div className="space-y-2">
                                                   <div className="text-[10px] uppercase font-bold tracking-wider text-[#8A8A8A] flex items-center gap-1.5 font-sans">
                                                      <ImageIcon size={11} className="text-orange-400" /> Digital Frames
                                                   </div>
                                                   <div className="grid grid-cols-2 gap-1.5">
                                                      {[
                                                         { label: 'Polaroid', target: 'polaroid' },
                                                         { label: 'Classic White', target: 'white' },
                                                         { label: 'Gallery Black', target: 'black' },
                                                         { label: 'Metallic Gold', target: 'metallic' },
                                                         { label: 'Vintage Brown', target: 'vintage' }
                                                      ].map(u => (
                                                         <button
                                                            key={u.label}
                                                            onClick={() => applyFrame(u.target)}
                                                            className="py-1 px-2 border border-[#2C2C2C] hover:border-orange-500/50 hover:text-white bg-[#1A1A1A] hover:bg-[#252525] rounded text-center text-[10px] font-medium transition duration-150 font-sans"
                                                         >
                                                            {u.label}
                                                         </button>
                                                      ))}
                                                   </div>
                                                </div>

                                                {selectionType === 'frameGroup' && (
                                                   <div className="space-y-1 mt-3">
                                                      <div className="flex justify-between items-center text-[10px] text-[#A0A0A0] mb-1 font-semibold">
                                                         <span>Border Width</span>
                                                         <span className="bg-[#181818] px-1.5 py-0.5 rounded border border-[#3A3A3A] text-[10px] text-white font-mono">{frameBorderWidth}px</span>
                                                      </div>
                                                      <input
                                                         type="range" min="1" max="150" step="1" value={frameBorderWidth}
                                                         onChange={(e) => updateFrameBorderWidth(Number(e.target.value))}
                                                         className="w-full accent-orange-500 h-1"
                                                      />
                                                   </div>
                                                )}

                                                {/* Document Prep */}
                                                <div className="space-y-2 mt-4 pt-4 border-t border-[#2C2C2C]">
                                                   <div className="text-[10px] uppercase font-bold tracking-wider text-[#8A8A8A] flex items-center gap-1.5 font-sans">
                                                      <FileText size={11} className="text-red-400" /> Formatting Utilities
                                                   </div>
                                                   <div className="text-[9px] text-slate-500 mb-2 leading-relaxed">Instantly reformat open imagery strictly into normalized document proportions.</div>
                                                   <div className="h-[300px] overflow-y-auto no-scrollbar pr-1 grid grid-cols-1 gap-1.5">
                                                      {PRESET_REGISTRY.filter(p => p.category === 'document' || p.category === 'social' || p.category === 'ecommerce').map((preset) => (
                                                         <button key={preset.id} onClick={() => createArtboardFromPreset(preset.id)} className="flex items-center gap-2 p-1.5 bg-[#222] hover:bg-white/5 border border-[#333] hover:border-white/20 rounded text-left transition-colors font-sans">
                                                            <div className={`w-5 h-5 rounded bg-[#333] flex items-center justify-center shrink-0 ${preset.category === 'social' ? 'text-fuchsia-500' : preset.category === 'ecommerce' ? 'text-orange-500' : 'text-blue-400'}`}>
                                                               {preset.category === 'social' ? <Instagram size={10} /> : preset.category === 'ecommerce' ? <ShoppingBag size={10} /> : <FileText size={10} />}
                                                            </div>
                                                            <div className="flex-1 overflow-hidden">
                                                               <div className="text-[10px] font-medium text-white truncate">Convert to {preset.name}</div>
                                                               <div className="text-[8px] text-slate-500 font-mono">{preset.width}x{preset.height} {preset.unit}</div>
                                                            </div>
                                                         </button>
                                                      ))}
                                                   </div>
                                                </div>
                                             </div>
                                          )}
                                       </div>
                                    )}

                                    <FilterStudioTab />



                                    {/* LAYERS PANEL */}
                                    {activeTab === 'layers' && <LayersTab />}

                                    {/* HISTORY PANEL */}
                                    {activeTab === 'history' && (
                                       <div className="p-2">
                                          <div className="text-[10px] uppercase font-bold tracking-wider text-[#A0A0A0] mb-3 ml-2 mt-2">Action History</div>
                                          <div className="space-y-1">
                                             {historyNames.map((name, idx) => {
                                                const isCurrent = idx === commandIndex;
                                                const isFuture = idx > commandIndex;
                                                return (
                                                   <div key={idx} onClick={() => jumpToHistory(idx)} className={`flex items-center px-3 py-2 rounded-md cursor-pointer text-xs transition-colors ${isCurrent ? 'bg-blue-600/20 text-blue-300 font-medium' : isFuture ? 'text-[#6A6A6A] hover:bg-[#2C2C2C]' : 'text-[#C0C0C0] hover:bg-[#2C2C2C]'}`}>
                                                      <div className={`w-2 h-2 rounded-full mr-3 ${isCurrent ? 'bg-blue-500' : isFuture ? 'bg-[#3A3A3A]' : 'bg-[#6A6A6A]'}`} />
                                                      {name}
                                                   </div>
                                                );
                                             })}
                                             {historyNames.length === 0 && (
                                                <div className="p-4 text-xs text-[#8A8A8A] text-center italic mt-10">No history track found.</div>
                                             )}
                                          </div>
                                       </div>
                                    )}

                                    {/* EXPORT WORKSPACE (jSquash with Artboards) */}
                                    {activeTab === 'export' && (
                                       <ExportStudio
                                          settings={exportSettings}
                                          onChange={setExportSettings}
                                          onExport={handleExport}
                                          isExporting={isExporting}
                                          originalSize={originalSize}
                                          optimizedSize={optimizedSize}
                                          originalWidth={artboards.find(b => b.id === activeArtboardId)?.width || 800}
                                          originalHeight={artboards.find(b => b.id === activeArtboardId)?.height || 600}
                                          psnr={psnr}
                                          artboards={artboards}
                                          activeArtboardId={activeArtboardId}
                                          setActiveArtboardId={setActiveArtboardId}
                                          exportTarget={exportTarget}
                                          setExportTarget={setExportTarget}
                                          selectedExportIds={selectedExportIds}
                                          setSelectedExportIds={setSelectedExportIds}
                                       />
                                    )}
                                 </div>
                              </div>
                              {/* Suggestion Toast */}
                              {activeSuggestion && (
                                 <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-bounce-subtle pointer-events-auto">
                                    <div className="bg-[#242424] border border-blue-500/50 shadow-[0_8px_32px_rgba(0,0,0,0.5)] rounded-2xl px-5 py-3 flex items-center gap-4 text-white">
                                       <div className="bg-blue-500/20 p-2 rounded-xl text-blue-400">
                                          <Sparkles size={18} />
                                       </div>
                                       <div>
                                          <div className="text-xs font-bold leading-tight">Image too large?</div>
                                          <div className="text-[10px] text-slate-400">Try smart fitting actions</div>
                                       </div>
                                       <div className="flex gap-2 ml-2">
                                          <button onClick={() => { alignSelection('fit'); setActiveSuggestion(null); }} className="h-7 px-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-[10px] font-bold transition">Fit to Artboard</button>
                                          <button onClick={() => { alignSelection('fill'); setActiveSuggestion(null); }} className="h-7 px-3 bg-[#333] hover:bg-[#444] rounded-lg text-[10px] font-bold transition">Fill Artboard</button>
                                          <button onClick={() => setActiveSuggestion(null)} className="p-1 hover:bg-white/10 rounded-lg"><X size={14} /></button>
                                       </div>
                                    </div>
                                 </div>
                              )}

                              {/* Context Menu Portal */}
                              {activeContextMenu && createPortal(
                                 <div
                                    ref={contextMenuRef}
                                    className="fixed z-[9999] w-52 bg-[#1A1A1A] border border-[#2D2D2D] shadow-[0_12px_48px_rgba(0,0,0,0.7)] rounded-xl overflow-y-auto custom-scrollbar max-h-[85vh] py-1 context-menu-container"
                                    style={{ left: activeContextMenu.x, top: activeContextMenu.y, visibility: 'hidden' }}
                                    onClick={(e) => e.stopPropagation()}
                                 >
                                    {activeContextMenu.obj ? (
                                       <>
                                          <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-[#252525] mb-1">Align To Artboard</div>
                                          {(activeContextMenu.obj?.type === 'image' || (activeContextMenu.obj as any)?.isFrameGroup) && (
                                             <>
                                                <ContextMenuItem icon={Crop} label="Crop Image" onClick={() => { enterCropMode(activeContextMenu.obj as fabric.Image); closeContextMenu(); }} />
                                                <div className="h-px bg-[#252525] my-1" />
                                             </>
                                          )}
                                          <ContextMenuItem icon={AlignLeft} label="Align Left" onClick={() => { alignSelection('left'); closeContextMenu(); }} />
                                          <ContextMenuItem icon={AlignCenter} label="Align Center H" onClick={() => { alignSelection('centerH'); closeContextMenu(); }} />
                                          <ContextMenuItem icon={AlignRight} label="Align Right" onClick={() => { alignSelection('right'); closeContextMenu(); }} />
                                          <div className="h-px bg-[#252525] my-1" />
                                          <ContextMenuItem icon={Move} label="Fit To Artboard" onClick={() => { alignSelection('fit'); closeContextMenu(); }} />
                                          <ContextMenuItem icon={SquareDashed} label="Fill Artboard" onClick={() => { alignSelection('fill'); closeContextMenu(); }} />
                                          <ContextMenuItem icon={Expand} label="Stretch to Artboard" onClick={() => { alignSelection('stretch'); closeContextMenu(); }} />
                                          <div className="h-px bg-[#252525] my-1" />
                                          <ContextMenuItem icon={ImageIcon} label="Fit Width" onClick={() => { alignSelection('fitWidth'); closeContextMenu(); }} />
                                          <ContextMenuItem icon={ImageIcon} label="Fit Height" onClick={() => { alignSelection('fitHeight'); closeContextMenu(); }} />
                                          <div className="h-px bg-[#252525] my-1" />
                                          <ContextMenuItem icon={Crop} label="Resize Artboard to Selection" onClick={() => { resizeArtboardToSelection('both'); closeContextMenu(); }} />
                                          <ContextMenuItem icon={Crop} label="Resize Artboard Width to Selection" onClick={() => { resizeArtboardToSelection('width'); closeContextMenu(); }} />
                                          <ContextMenuItem icon={Crop} label="Resize Artboard Height to Selection" onClick={() => { resizeArtboardToSelection('height'); closeContextMenu(); }} />
                                          <ContextMenuItem icon={Crop} label="Resize Artboard to Selection Bounds" onClick={() => { resizeArtboardToSelection('bounds'); closeContextMenu(); }} />
                                          <div className="h-px bg-[#252525] my-1" />
                                          <ContextMenuItem icon={Copy} label="Copy as PNG" onClick={() => { copyActiveObjectAsFormat('png'); closeContextMenu(); }} />
                                          {activeContextMenu.obj?.type !== 'image' && (
                                             <ContextMenuItem icon={Copy} label="Copy as SVG" onClick={() => { copyActiveObjectAsFormat('svg'); closeContextMenu(); }} />
                                          )}
                                          <ContextMenuItem icon={Copy} label="Duplicate" shortcut="Ctrl+D" onClick={() => { duplicateActiveObject(); closeContextMenu(); }} />
                                          {activeContextMenu.obj?.type === 'group' && (
                                             <ContextMenuItem icon={Images} label="Ungroup Frame" onClick={() => {
                                                const group = activeContextMenu.obj as any;
                                                if (group && typeof group.toActiveSelection === 'function') {
                                                   const sel = group.toActiveSelection();
                                                   fabricRef.current?.setActiveObject(sel);
                                                } else {
                                                   const items = (group as any).removeAll();
                                                   fabricRef.current?.remove(group as fabric.Group);
                                                   items.forEach(i => fabricRef.current?.add(i));
                                                   const sel = new fabric.ActiveSelection(items, { canvas: fabricRef.current });
                                                   fabricRef.current?.setActiveObject(sel);
                                                }
                                                fabricRef.current?.requestRenderAll();
                                                updateLayersList();
                                                closeContextMenu();
                                             }} />
                                          )}
                                          <ContextMenuItem icon={Trash2} label="Delete" shortcut="Del" danger onClick={() => { deleteActiveObject(); closeContextMenu(); }} />
                                          <div className="h-px bg-[#252525] my-1" />

                                          {(() => {
                                             let maxIdx = -1;
                                             let minIdx = Number.MAX_SAFE_INTEGER;
                                             const totalObjs = fabricRef.current?.getObjects().length || 0;
                                             activeContextMenu.targets.forEach(t => {
                                                const idx = fabricRef.current?.getObjects().indexOf(t) ?? -1;
                                                if (idx > maxIdx) maxIdx = idx;
                                                if (idx !== -1 && idx < minIdx) minIdx = idx;
                                             });
                                             const canBringForward = maxIdx !== -1 && maxIdx < totalObjs - 1;
                                             const canSendBackward = minIdx !== -1 && minIdx > 0;

                                             return (
                                                <>
                                                   <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-[#252525] mb-1">Layer Order</div>
                                                   <ContextMenuItem icon={BringToFront} label="Bring to Front" shortcut="Ctrl+Shift+]" disabled={!canBringForward} onClick={() => { handleLayerOrder('front'); closeContextMenu(); }} />
                                                   <ContextMenuItem icon={ArrowUp} label="Bring Forward" shortcut="Ctrl+]" disabled={!canBringForward} onClick={() => { handleLayerOrder('forward'); closeContextMenu(); }} />
                                                   <ContextMenuItem icon={ArrowDown} label="Send Backward" shortcut="Ctrl+[" disabled={!canSendBackward} onClick={() => { handleLayerOrder('backward'); closeContextMenu(); }} />
                                                   <ContextMenuItem icon={SendToBack} label="Send to Back" shortcut="Ctrl+Shift+[" disabled={!canSendBackward} onClick={() => { handleLayerOrder('back'); closeContextMenu(); }} />
                                                   <div className="h-px bg-[#252525] my-1" />
                                                </>
                                             );
                                          })()}

                                          <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-[#252525] mb-1">Move To Artboard</div>
                                          {artboards.map(b => (
                                             <ContextMenuItem
                                                key={b.id}
                                                icon={SquareDashed}
                                                label={b.name}
                                                onClick={() => {
                                                   if (!fabricRef.current) return;
                                                   const activeSelection = fabricRef.current.getActiveObject();
                                                   if (!activeSelection) return;

                                                   let objectsToProcess: any[] = [];
                                                   if (activeSelection.type === 'activeSelection') {
                                                      objectsToProcess = (activeSelection as any).getObjects();
                                                      fabricRef.current.discardActiveObject();
                                                   } else {
                                                      objectsToProcess = [activeSelection];
                                                   }

                                                   objectsToProcess.forEach(obj => {
                                                      const prevArtboardId = obj.artboardId;
                                                      if (prevArtboardId !== b.id) {
                                                         const prevBoard = artboards.find(x => x.id === prevArtboardId) || artboards[0];
                                                         const dx = b.x - prevBoard.x;
                                                         const dy = b.y - prevBoard.y;

                                                         obj.artboardId = b.id;
                                                         if (typeof obj.set === 'function') {
                                                            obj.set({
                                                               left: (obj.left ?? 0) + dx,
                                                               top: (obj.top ?? 0) + dy
                                                            });
                                                            if (typeof obj.setCoords === 'function') obj.setCoords();
                                                         }
                                                      }
                                                   });

                                                   if (objectsToProcess.length > 1) {
                                                      const sel = new fabric.ActiveSelection(objectsToProcess, { canvas: fabricRef.current });
                                                      fabricRef.current.setActiveObject(sel);
                                                   } else if (objectsToProcess.length === 1) {
                                                      fabricRef.current.setActiveObject(objectsToProcess[0]);
                                                   }

                                                   fabricRef.current.renderAll();
                                                   updateLayersList();
                                                   closeContextMenu();
                                                }}
                                             />
                                          ))}
                                          <div className="h-px bg-[#252525] my-1" />
                                          <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-[#252525] mb-1">Import</div>
                                          <ContextMenuItem icon={Upload} label="Upload Files..." onClick={() => { document.getElementById('img-upload')?.click(); closeContextMenu(); }} />
                                          <ContextMenuItem icon={Clipboard} label="Paste from Clipboard" onClick={async () => {
                                             try {
                                                const items = await navigator.clipboard.read();
                                                const results = await processPasteEvent({ clipboardData: { items: items as any } } as any);
                                                if (results.length > 0) importAssets(results);
                                             } catch (e) { }
                                             closeContextMenu();
                                          }} />
                                          <ContextMenuItem icon={Library} label="Import Local Assets..." onClick={() => { setShowAssetGallery(true); closeContextMenu(); }} />
                                          <ContextMenuItem icon={Link} label="Import from URL..." onClick={() => {
                                             setShowUrlPrompt(true);
                                             closeContextMenu();
                                          }} />
                                       </>
                                    ) : (
                                       <>
                                          <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-[#252525] mb-1">Canvas Actions</div>
                                          <ContextMenuItem icon={Plus} label="New Artboard" onClick={() => { createArtboard(); closeContextMenu(); }} />
                                          <ContextMenuItem icon={Type} label="Add Text" onClick={() => { addText(); closeContextMenu(); }} />
                                          <ContextMenuItem icon={Grid} label="Toggle Grid" onClick={() => { closeContextMenu(); }} />
                                          <div className="h-px bg-[#252525] my-1" />
                                          <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-[#252525] mb-1">Import</div>
                                          <ContextMenuItem icon={Upload} label="Upload Files..." onClick={() => { document.getElementById('img-upload')?.click(); closeContextMenu(); }} />
                                          <ContextMenuItem icon={Clipboard} label="Paste from Clipboard" onClick={async () => {
                                             try {
                                                const items = await navigator.clipboard.read();
                                                // This uses a hacky adapter to pass to our processPasteEvent which expects a standard PasteEvent
                                                const dataItems = Array.from(items).flatMap((item: any) =>
                                                   item.types.map((type: string) => ({
                                                      type,
                                                      getType: () => item.getType(type),
                                                   }))
                                                );
                                                // We actually already have a processClipboardItems function for exactly this!
                                                const { processClipboardItems } = await import('../image-import/clipboard/clipboardImporter');
                                                const results = await processClipboardItems(items as any);
                                                if (results.length > 0) importAssets(results);
                                             } catch (e) { }
                                             closeContextMenu();
                                          }} />
                                          <ContextMenuItem icon={Library} label="Import Local Assets..." onClick={() => { setShowAssetGallery(true); closeContextMenu(); }} />
                                          <ContextMenuItem icon={Link} label="Import from URL..." onClick={() => {
                                             setShowUrlPrompt(true);
                                             closeContextMenu();
                                          }} />
                                       </>
                                    )}
                                 </div>,
                                 document.body
                              )}

                              {/* Mobile Artboard Gallery Modal */}
                              {isMobile && showMobileArtboardsGallery && (
                                 <div className="fixed inset-0 z-[100] bg-[#121212] overflow-y-auto w-full h-full animate-in fade-in zoom-in-95 duration-200">
                                    <div className="sticky top-0 bg-[#1A1A1A] border-b border-[#2C2C2C] p-4 flex justify-between items-center z-10 shadow-md">
                                       <h2 className="text-white font-bold tracking-tight text-lg flex items-center gap-2">
                                          <SquareDashed size={18} className="text-blue-500" />
                                          Select Artboard
                                       </h2>
                                       <button
                                          onClick={() => setShowMobileArtboardsGallery(false)}
                                          className="w-8 h-8 flex items-center justify-center rounded-full bg-[#333] text-white hover:bg-[#444]"
                                       >
                                          <X size={18} />
                                       </button>
                                    </div>

                                    <div className="p-4 grid grid-cols-2 gap-4 pb-20">
                                       {artboards.map(b => {
                                          const isActive = b.id === activeArtboardId;
                                          return (
                                             <div
                                                key={b.id}
                                                onClick={() => {
                                                   setActiveArtboardId(b.id);
                                                   setShowMobileArtboardsGallery(false);
                                                }}
                                                className={`flex flex-col gap-2 p-3 rounded-xl cursor-pointer transition-all border ${isActive ? 'bg-blue-600/10 border-blue-500' : 'bg-[#1E1E1E] border-[#333] hover:border-gray-500'}`}
                                             >
                                                <div className="w-full aspect-square bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg overflow-hidden flex items-center justify-center relative shadow-inner">
                                                   <div
                                                      className="w-16 h-16 rounded-sm shadow-sm opacity-80"
                                                      style={{
                                                         backgroundColor: b.backgroundColor || '#fff',
                                                         aspectRatio: `${b.width}/${b.height}`,
                                                         width: b.orientation === 'landscape' ? '60%' : undefined,
                                                         height: b.orientation === 'portrait' ? '60%' : undefined,
                                                         ...(b.transparent ? { backgroundImage: 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYNgGwEg9AMRAGQzUQJDw/wP9h2IIMhqwYYwGKDAaINBQgAHTyMAwwAEAnpIEB3aIfjIAAAAASUVORK5CYII=")' } : {})
                                                      }}
                                                   />
                                                   {isActive && (
                                                      <div className="absolute inset-0 border-2 border-blue-500 rounded-lg pointer-events-none" />
                                                   )}
                                                </div>
                                                <div className="flex flex-col">
                                                   <span className={`text-sm font-bold truncate ${isActive ? 'text-blue-400' : 'text-white'}`}>{b.name}</span>
                                                   <span className="text-[10px] text-gray-500 font-mono tracking-tighter">{b.width} × {b.height}</span>
                                                </div>
                                             </div>
                                          )
                                       })}

                                       <div
                                          onClick={() => {
                                             createArtboard();
                                             setShowMobileArtboardsGallery(false);
                                          }}
                                          className="flex flex-col gap-2 p-3 rounded-xl cursor-pointer transition-all bg-[#1E1E1E] border border-dashed border-[#444] hover:border-gray-400 items-center justify-center group"
                                       >
                                          <div className="w-10 h-10 rounded-full bg-blue-600 group-hover:bg-blue-500 flex items-center justify-center text-white shadow-lg transition-colors">
                                             <Plus size={20} />
                                          </div>
                                          <span className="text-xs font-bold text-gray-400 group-hover:text-white mt-1">New Artboard</span>
                                       </div>
                                    </div>
                                 </div>
                              )}

                              {/* Rename Artboard Modal Dialog */}
                              {renamingArtboard && createPortal(
                                 <div
                                    className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
                                    onClick={() => setRenamingArtboard(null)}
                                 >
                                    <div
                                       className="bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl shadow-[0_24px_64px_rgba(0,0,0,0.85)] w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 cursor-default"
                                       onClick={(e) => e.stopPropagation()}
                                    >
                                       <div className="px-5 py-4 border-b border-[#2C2C2C] flex items-center justify-between">
                                          <h3 className="text-sm font-semibold text-[#E0E0E0] flex items-center gap-2">
                                             <Edit2 size={14} className="text-blue-500" />
                                             Rename Artboard
                                          </h3>
                                          <button
                                             onClick={() => setRenamingArtboard(null)}
                                             className="text-gray-500 hover:text-white transition-colors"
                                          >
                                             <X size={16} />
                                          </button>
                                       </div>
                                       <div className="p-5 space-y-4">
                                          <div className="space-y-1.5">
                                             <label className="text-[10px] font-semibold text-[#8A8A8A] uppercase tracking-wider">Artboard Name</label>
                                             <input
                                                type="text"
                                                autoFocus
                                                className="w-full h-9 bg-black border border-[#2C2C2C] rounded-lg px-3 text-xs text-white placeholder-gray-600 outline-none focus:border-blue-500 transition-colors"
                                                value={renamingArtboard.name}
                                                onChange={(e) => setRenamingArtboard({ ...renamingArtboard, name: e.target.value })}
                                                onKeyDown={(e) => {
                                                   if (e.key === "Enter") {
                                                      const trimmed = renamingArtboard.name.trim();
                                                      if (trimmed) {
                                                         updateArtboardPropDirect(renamingArtboard.id, "name", trimmed, true);
                                                      }
                                                      setRenamingArtboard(null);
                                                   } else if (e.key === "Escape") {
                                                      setRenamingArtboard(null);
                                                   }
                                                }}
                                             />
                                          </div>
                                          <div className="flex justify-end gap-2 pt-1">
                                             <button
                                                onClick={() => setRenamingArtboard(null)}
                                                className="h-8 px-4 text-xs font-semibold border border-[#2D2D2D] text-[#808080] hover:text-white rounded-lg transition-colors"
                                             >
                                                Cancel
                                             </button>
                                             <button
                                                onClick={() => {
                                                   const trimmed = renamingArtboard.name.trim();
                                                   if (trimmed) {
                                                      updateArtboardPropDirect(renamingArtboard.id, "name", trimmed, true);
                                                   }
                                                   setRenamingArtboard(null);
                                                }}
                                                className="h-8 px-4 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                                             >
                                                Save
                                             </button>
                                          </div>
                                       </div>
                                    </div>
                                 </div>,
                                 document.body
                              )}

                              {showShortcuts && createPortal(
                                 <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setShowShortcuts(false)}>
                                    <div className="bg-[#181818] border border-[#2c2c2c] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                                       <div className="flex items-center justify-between p-4 border-b border-[#2c2c2c] bg-[#1a1a1a]">
                                          <div className="font-semibold text-sm text-white flex items-center gap-2">
                                             <Keyboard size={16} className="text-blue-400" /> Image Node Shortcuts
                                          </div>
                                          <button onClick={() => setShowShortcuts(false)} className="text-gray-400 hover:text-white transition">
                                             <X size={16} />
                                          </button>
                                       </div>
                                       <div className="p-4 space-y-3">
                                          <div className="flex items-center justify-between">
                                             <span className="text-xs text-slate-300">Bring Forward</span>
                                             <div className="flex gap-1"><span className="px-1.5 py-0.5 bg-[#2c2c2c] rounded text-[10px] font-mono border border-[#3a3a3a] text-slate-300">Ctrl</span><span className="px-1.5 py-0.5 bg-[#2c2c2c] rounded text-[10px] font-mono border border-[#3a3a3a] text-slate-300">]</span></div>
                                          </div>
                                          <div className="flex items-center justify-between">
                                             <span className="text-xs text-slate-300">Send Backward</span>
                                             <div className="flex gap-1"><span className="px-1.5 py-0.5 bg-[#2c2c2c] rounded text-[10px] font-mono border border-[#3a3a3a] text-slate-300">Ctrl</span><span className="px-1.5 py-0.5 bg-[#2c2c2c] rounded text-[10px] font-mono border border-[#3a3a3a] text-slate-300">[</span></div>
                                          </div>
                                          <div className="flex items-center justify-between">
                                             <span className="text-xs text-slate-300">Bring to Front</span>
                                             <div className="flex gap-1"><span className="px-1.5 py-0.5 bg-[#2c2c2c] rounded text-[10px] font-mono border border-[#3a3a3a] text-slate-300">Ctrl+Shift</span><span className="px-1.5 py-0.5 bg-[#2c2c2c] rounded text-[10px] font-mono border border-[#3a3a3a] text-slate-300">]</span></div>
                                          </div>
                                          <div className="flex items-center justify-between">
                                             <span className="text-xs text-slate-300">Send to Back</span>
                                             <div className="flex gap-1"><span className="px-1.5 py-0.5 bg-[#2c2c2c] rounded text-[10px] font-mono border border-[#3a3a3a] text-slate-300">Ctrl+Shift</span><span className="px-1.5 py-0.5 bg-[#2c2c2c] rounded text-[10px] font-mono border border-[#3a3a3a] text-slate-300">[</span></div>
                                          </div>
                                          <div className="flex items-center justify-between">
                                             <span className="text-xs text-slate-300">Context Menu (Mobile)</span>
                                             <div className="flex gap-1"><span className="px-1.5 py-0.5 bg-[#2c2c2c] rounded text-[10px] font-mono border border-[#3a3a3a] text-slate-300">2-Finger Hold</span></div>
                                          </div>
                                       </div>
                                    </div>
                                 </div>,
                                 document.body
                              )}
    </>
  );
};
