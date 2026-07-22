import React, { useState, useEffect } from 'react';
import {
   Sliders, Plus, Copy, X, Sparkles, Activity, Bookmark, Power, ChevronUp, ChevronDown, GripVertical
} from 'lucide-react';
import * as fabric from 'fabric';
import { useWorkspaceUI } from '../../contexts/WorkspaceUIContext';
import { useCanvas } from '../../contexts/CanvasContext';
import { useHistory } from '../../contexts/HistoryContext';
import { useSelection } from '../../contexts/SelectionContext';
import { FilterConfig } from '../../types/filters';
import { ColorPickerTrigger } from '../shared/ColorPickers';
import { useFilterPipeline } from '../../hooks/useFilterPipeline';

export const FilterStudioTab: React.FC = () => {
   const {
      imageFilters, setImageFilters, benchmarkInfo, setBenchmarkInfo
   } = useWorkspaceUI();

   const { selectionType, isCollageSelected } = useSelection();
   const { fabricRef } = useCanvas();
   const { executeCommand } = useHistory();

   const [customPresets, setCustomPresets] = useState<{ name: string; stack: FilterConfig[] }[]>([]);
   const [newPresetName, setNewPresetName] = useState("");
   const [showSavePresetModal, setShowSavePresetModal] = useState(false);
   const [draggedFilterId, setDraggedFilterId] = useState<string | null>(null);
   const [dragOverFilterId, setDragOverFilterId] = useState<string | null>(null);

   useEffect(() => {
      try {
         const saved = localStorage.getItem("workspace_custom_filters_presets");
         if (saved) {
            setCustomPresets(JSON.parse(saved));
         }
      } catch (e) {
         console.error(e);
      }
   }, []);

   const getTargetImageForFilters = () => {
      let targetImage = fabricRef.current?.getActiveObject();
      if (targetImage && targetImage.type === 'activeSelection') {
         // Filter the first valid filterable object
         const objects = (targetImage as fabric.ActiveSelection).getObjects();
         targetImage = objects.find(o => o.type === 'image' || (o as any).isCollageBlock) || targetImage;
      }
      if (targetImage && targetImage.get('isFrameGroup')) {
         const items = (targetImage as any).getObjects();
         targetImage = items.find((i: any) => i.type === 'image') || targetImage;
      }
      return targetImage;
   };

   const {
      addFilterToPipeline, removeFilterFromPipeline, toggleFilterEnabled, duplicateFilterInPipeline,
      updateFilterParam, moveFilterInPipeline, applyCreativePreset, loadSavedPreset, saveCurrentStackAsPreset, deleteCustomPreset,
      applyFilterStack
   } = useFilterPipeline(
      imageFilters, setImageFilters, setBenchmarkInfo, getTargetImageForFilters, executeCommand,
      customPresets, setCustomPresets, setNewPresetName, setShowSavePresetModal
   );

   const handleDragStart = (e: React.DragEvent, id: string) => {
      setDraggedFilterId(id);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
      const cardEl = (e.currentTarget as HTMLElement).closest('.filter-card-item');
      if (cardEl && e.dataTransfer.setDragImage) {
         e.dataTransfer.setDragImage(cardEl, 20, 20);
      }
   };

   const handleDragOver = (e: React.DragEvent, id: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverFilterId(id);
   };

   const handleDragLeave = (e: React.DragEvent, id: string) => {
      if (dragOverFilterId === id) {
         setDragOverFilterId(null);
      }
   };

   const handleDragEnd = () => {
      setDraggedFilterId(null);
      setDragOverFilterId(null);
   };

   const handleDrop = (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      if (!draggedFilterId || draggedFilterId === targetId) {
         setDragOverFilterId(null);
         return;
      }

      const draggedIndex = imageFilters.findIndex(f => f.id === draggedFilterId);
      const targetIndex = imageFilters.findIndex(f => f.id === targetId);

      if (draggedIndex === -1 || targetIndex === -1) {
         setDragOverFilterId(null);
         return;
      }

      const newFilters = [...imageFilters];
      const [removed] = newFilters.splice(draggedIndex, 1);
      newFilters.splice(targetIndex, 0, removed);

      applyFilterStack(newFilters, "Reorder Filters");
      setDraggedFilterId(null);
      setDragOverFilterId(null);
   };

   return (
      <>
         {/* FILTER STUDIO PANEL */}
         <div className="p-4 space-y-6 text-[#C0C0C0]">
            {selectionType !== 'image' && selectionType !== 'frameGroup' && !isCollageSelected ? (
               <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
                  <Sparkles size={32} className="mb-4 text-amber-500 animate-pulse" />
                  <span className="text-sm font-semibold text-white">Filter Studio</span>
                  <span className="text-xs mt-2 w-48 text-[#8A8A8A]">Select an Image or Collage Block layer to utilize the professional filter pipeline.</span>
               </div>
            ) : (
               <div className="space-y-6 flex flex-col h-full">

                  {/* BENCHMARK & DIAGNOSTICS */}
                  <div className="bg-[#181818] border border-[#2C2C2C] rounded-lg p-3 space-y-2">
                     <div className="flex justify-between items-center border-b border-[#2C2C2C] pb-1.5 mb-1.5">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[#8A8A8A] flex items-center gap-1.5 font-sans">
                           <Activity size={12} className="text-emerald-500" /> Pipeline Diagnostics
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${(benchmarkInfo?.backend || 'WebGL') === 'WebGL' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/30' : 'bg-amber-950/40 text-amber-500 border border-amber-800/20'
                           }`}>
                           {benchmarkInfo?.backend || 'WebGL'}
                        </span>
                     </div>
                     <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                        <div>
                           <span className="text-[#8A8A8A] text-[9px] block">Process Time</span>
                           <span className="text-white font-semibold">{benchmarkInfo?.filterTimeMs || '0.0'} ms</span>
                        </div>
                        <div>
                           <span className="text-[#8A8A8A] text-[9px] block">Dimensions</span>
                           <span className="text-white font-semibold truncate block">
                              {benchmarkInfo?.outputWidth || 0} x {benchmarkInfo?.outputHeight || 0}
                           </span>
                        </div>
                     </div>
                  </div>

                  {/* PRESETS BLOCK */}
                  <div className="space-y-2">
                     <div className="text-[10px] uppercase font-bold tracking-wider text-[#8A8A8A] flex items-center gap-1.5 font-sans">
                        <Bookmark size={11} className="text-blue-400" /> Instant Creative Presets
                     </div>
                     <div className="grid grid-cols-2 gap-1.5">
                        {[
                           { id: 'brownie', label: 'Brownie' },
                           { id: 'vintage', label: 'Vintage' },
                           { id: 'technicolor', label: 'Technicolor' },
                           { id: 'kodachrome', label: 'Kodachrome' },
                           { id: 'polaroid', label: 'Polaroid' },
                           { id: 'hdr', label: 'HDR Light' },
                           { id: 'film', label: 'Fine Film' },
                           { id: 'instagram', label: 'Insta Vibe' },
                           { id: 'vibrant', label: 'Vibrant' },
                           { id: 'soft', label: 'Soft Cinema' }
                        ].map(p => (
                           <button
                              key={p.id}
                              onClick={() => applyCreativePreset(p.id)}
                              type="button"
                              className="py-1 px-2 border border-[#2C2C2C] hover:border-blue-500/50 hover:text-white bg-[#1A1A1A] hover:bg-[#252525] rounded text-left text-[11px] font-medium transition duration-150 flex items-center justify-between group font-sans"
                           >
                              <span className="truncate">{p.label}</span>
                              <Plus size={10} className="opacity-40 group-hover:opacity-100 text-blue-400 shrink-0 ml-1" />
                           </button>
                        ))}
                     </div>
                  </div>

                  {/* ADD NEW FILTER */}
                  <div className="space-y-2">
                     <div className="text-[10px] uppercase font-bold tracking-wider text-[#8A8A8A] flex items-center gap-1.5 font-sans">
                        <Plus size={12} className="text-blue-500" /> Apply Filter Effect
                     </div>
                     <div className="space-y-3 bg-[#181818] border border-[#2C2C2C] p-3 rounded-lg">

                        {/* Adjustments */}
                        <div>
                           <span className="text-[9px] font-bold text-[#8A8A8A] uppercase tracking-wider block mb-1.5 font-sans">Adjustments</span>
                           <div className="flex flex-wrap gap-1.5">
                              {[
                                 { type: 'brightness', label: 'Brightness' },
                                 { type: 'contrast', label: 'Contrast' },
                                 { type: 'saturation', label: 'Saturation' },
                                 { type: 'vibrance', label: 'Vibrance' },
                                 { type: 'exposure', label: 'Exposure' },
                                 { type: 'gamma', label: 'Gamma' },
                                 { type: 'temperature', label: 'Temperature' },
                                 { type: 'tint', label: 'Tint' },
                                 { type: 'hueRotation', label: 'Hue' }
                              ].map(f => (
                                 <button
                                    key={f.type}
                                    onClick={() => addFilterToPipeline(f.type)}
                                    type="button"
                                    className="px-2 py-0.5 bg-[#2C2C2C] hover:bg-[#3A3A3A] border border-[#3A3A3A] hover:border-blue-500/50 text-white rounded text-[10px] font-medium transition font-sans"
                                 >
                                    + {f.label}
                                 </button>
                              ))}
                           </div>
                        </div>

                        {/* Colors */}
                        <div>
                           <span className="text-[9px] font-bold text-[#8A8A8A] uppercase tracking-wider block mb-1.5 font-sans">Color Effects</span>
                           <div className="flex flex-wrap gap-1.5">
                              {[
                                 { type: 'grayscale', label: 'Grayscale' },
                                 { type: 'invert', label: 'Invert' },
                                 { type: 'sepia', label: 'Sepia' },
                                 { type: 'blackwhite', label: 'B & W' },
                                 { type: 'removeColor', label: 'Chroma Key' }
                              ].map(f => (
                                 <button
                                    key={f.type}
                                    onClick={() => addFilterToPipeline(f.type)}
                                    type="button"
                                    className="px-2 py-0.5 bg-[#2C2C2C] hover:bg-[#3A3A3A] border border-[#3A3A3A] hover:border-[#525252] text-white rounded text-[10px] font-medium transition font-sans"
                                 >
                                    + {f.label}
                                 </button>
                              ))}
                           </div>
                        </div>

                        {/* Distort & Artsy */}
                        <div>
                           <span className="text-[9px] font-bold text-[#8A8A8A] uppercase tracking-wider block mb-1.5 font-sans">Artsy & Details</span>
                           <div className="flex flex-wrap gap-1.5">
                              {[
                                 { type: 'blur', label: 'Blur' },
                                 { type: 'sharpen', label: 'Sharpen' },
                                 { type: 'unsharpMask', label: 'Unsharp Mask' },
                                 { type: 'emboss', label: 'Emboss' },
                                 { type: 'edge', label: 'Edges' },
                                 { type: 'noise', label: 'Noise' },
                                 { type: 'pixelate', label: 'Pixelate' },
                                 { type: 'vignette', label: 'Vignette' },
                                 { type: 'bloom', label: 'Bloom' },
                                 { type: 'chromatic', label: 'Chroma' },
                                 { type: 'nightVision', label: 'Night Vision' }
                              ].map(f => (
                                 <button
                                    key={f.type}
                                    onClick={() => addFilterToPipeline(f.type)}
                                    type="button"
                                    className="px-2 py-0.5 bg-[#2C2C2C] hover:bg-[#3A3A3A] border border-[#3A3A3A] hover:border-[#525252] text-white rounded text-[10px] font-medium transition font-sans"
                                 >
                                    + {f.label}
                                 </button>
                              ))}
                           </div>
                        </div>

                        {/* Blends */}
                        <div>
                           <span className="text-[9px] font-bold text-[#8A8A8A] uppercase tracking-wider block mb-1.5 font-sans">Blends</span>
                           <div className="flex flex-wrap gap-1.5">
                              <button
                                 onClick={() => addFilterToPipeline('blendColor')}
                                 type="button"
                                 className="px-2 py-0.5 bg-[#2C2C2C] hover:bg-[#3A3A3A] border border-[#3A3A3A] hover:border-amber-500/50 text-white rounded text-[10px] font-medium transition flex items-center gap-1 font-sans"
                              >
                                 <Sliders size={10} className="text-amber-500" /> + Blend Color Map
                              </button>
                           </div>
                        </div>

                        {/* WebGL Custom */}
                        <div>
                           <span className="text-[9px] font-bold text-[#8A8A8A] uppercase tracking-wider block mt-3 mb-1.5 font-sans">Advanced WebGL Effects</span>
                           <div className="flex flex-wrap gap-1.5">
                              {[
                                 { type: 'cyberpunkDuotone', label: 'Cyberpunk Duotone' },
                                 { type: 'halationBloom', label: 'Film Halation' },
                                 { type: 'vhsGlitch', label: 'VHS Glitch' },
                                 { type: 'frostedGlass', label: 'Frosted Glass' },
                                 { type: 'vaporwaveHalftone', label: 'Vaporwave Dither' },
                                 { type: 'thermalHeatmap', label: 'Thermal Vision' },
                                 { type: 'neonSobelEdge', label: 'Neon Edge' },
                                 { type: 'liquidRipple', label: 'Liquid Ripple' },
                                 { type: 'asciiMatrix', label: 'ASCII Matrix' },
                                 { type: 'mandalaMirror', label: 'Mandala Mirror' },
                                 { type: 'godRays', label: 'God Rays' },
                                 { type: 'anamorphicFlare', label: 'Anamorphic Flare' }
                              ].map(f => (
                                 <button
                                    key={f.type}
                                    onClick={() => addFilterToPipeline(f.type)}
                                    type="button"
                                    className="px-2 py-0.5 bg-[#1F1735] hover:bg-[#30214f] border border-[#3c2a63] hover:border-[#6a49b0] text-[#E0D4F5] rounded text-[10px] font-medium transition font-sans"
                                 >
                                    + {f.label}
                                 </button>
                              ))}
                           </div>
                        </div>

                     </div>
                  </div>

                  {/* ACTIVE STACK CONTAINER */}
                  <div className="space-y-3">
                     <div className="flex justify-between items-center border-b border-[#2C2C2C] pb-2 font-sans">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[#8A8A8A] flex items-center gap-1.5">
                           <Sliders size={12} className="text-blue-500" /> Filter Stack ({imageFilters.length})
                        </span>
                        {imageFilters.length > 0 && (
                           <button
                              onClick={() => setShowSavePresetModal(true)}
                              type="button"
                              className="text-[11px] font-semibold text-blue-400 hover:text-white transition flex items-center gap-1 bg-blue-950/40 px-2 py-0.5 border border-blue-900/40 rounded"
                           >
                              <Bookmark size={10} /> Save Preset
                           </button>
                        )}
                     </div>

                     {/* Preset Save Modal Form */}
                     {showSavePresetModal && (
                        <div className="bg-[#1A1A1A] border border-[#2C2C2C] rounded-lg p-3 space-y-2">
                           <span className="text-xs font-semibold text-white block font-sans">Preset Name</span>
                           <div className="flex gap-1">
                              <input
                                 type="text"
                                 placeholder="Epic cinematic grain..."
                                 value={newPresetName}
                                 onChange={(e) => setNewPresetName(e.target.value)}
                                 className="min-w-0 flex-1 h-8 bg-black border border-[#2C2C2C] rounded text-xs px-2 text-white placeholder-[#444] outline-none focus:border-blue-500 font-sans"
                              />
                              <button
                                 onClick={() => saveCurrentStackAsPreset(newPresetName)}
                                 type="button"
                                 className="h-8 px-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-[10px] transition font-sans shrink-0"
                              >
                                 Save
                              </button>
                              <button
                                 onClick={() => setShowSavePresetModal(false)}
                                 type="button"
                                 className="h-8 px-2 border border-[#2C2C2C] text-[#8A8A8A] hover:text-white rounded text-[10px] transition font-sans shrink-0"
                              >
                                 Cancel
                              </button>
                           </div>
                        </div>
                     )}

                     {imageFilters.length === 0 ? (
                        <div className="py-8 bg-black/10 border border-dashed border-[#2C2C2C] rounded-lg flex flex-col items-center justify-center p-4 text-center">
                           <span className="text-xs text-[#8A8A8A] line-clamp-2 font-sans">No active filters in stack. Click filters above or quick presets to style this layer!</span>
                        </div>
                     ) : (
                        <div className="space-y-3">
                           {[...imageFilters].reverse().map((f, reversedIndex) => {
                              const index = imageFilters.length - 1 - reversedIndex;
                              const isDragging = draggedFilterId === f.id;
                              const isDragOver = dragOverFilterId === f.id && draggedFilterId !== f.id;
                              
                              return (
                                 <div 
                                    key={f.id} 
                                    onDragOver={(e) => handleDragOver(e, f.id)}
                                    onDragLeave={(e) => handleDragLeave(e, f.id)}
                                    onDrop={(e) => handleDrop(e, f.id)}
                                    className={`filter-card-item bg-[#181818] border ${f.enabled ? 'border-[#2C2C2C]' : 'border-dashed border-[#2A2A2A] opacity-50'} rounded-lg transition-all shadow-sm ${isDragging ? 'opacity-50' : ''} ${isDragOver ? 'border-t-2 border-t-blue-500 shadow-[0_-2px_8px_rgba(59,130,246,0.2)]' : ''}`}
                                 >

                                    {/* Title & Control buttons bar */}
                                    <div className="flex items-center justify-between px-3 py-1.5 bg-[#1B1B1B] border-b border-[#2C2C2C] rounded-t-lg">
                                       <div className="flex items-center gap-2">
                                          <div 
                                             draggable
                                             onDragStart={(e) => handleDragStart(e, f.id)}
                                             onDragEnd={handleDragEnd}
                                             className="cursor-grab text-[#555] hover:text-[#888] active:cursor-grabbing p-1 rounded hover:bg-[#2A2A2A] transition"
                                             title="Drag to reorder filter"
                                          >
                                             <GripVertical size={14} />
                                          </div>
                                          <button
                                             onClick={() => toggleFilterEnabled(f.id)}
                                             type="button"
                                             className={`p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded transition duration-150 touch-manipulation ${f.enabled ? 'bg-blue-600/20 text-blue-400' : 'bg-[#2A2A2A] text-[#8A8A8A]'}`}
                                             title={f.enabled ? 'Disable Filter' : 'Enable Filter'}
                                          >
                                             <Power size={11} />
                                          </button>
                                          <span className="text-[11px] font-bold text-white tracking-tight font-sans">{f.name}</span>
                                       </div>

                                       <div className="flex items-center gap-1">
                                          <button
                                             onClick={() => moveFilterInPipeline(f.id, 'down')}
                                             disabled={index === imageFilters.length - 1}
                                             type="button"
                                             className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center text-[#8A8A8A] hover:text-white disabled:opacity-30 disabled:pointer-events-none transition touch-manipulation"
                                             title="Move Up"
                                          >
                                             <ChevronUp size={13} />
                                          </button>
                                          <button
                                             onClick={() => moveFilterInPipeline(f.id, 'up')}
                                             disabled={index === 0}
                                             type="button"
                                             className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center text-[#8A8A8A] hover:text-white disabled:opacity-30 disabled:pointer-events-none transition touch-manipulation"
                                             title="Move Down"
                                          >
                                             <ChevronDown size={13} />
                                          </button>
                                          <button
                                             onClick={() => duplicateFilterInPipeline(f.id)}
                                             type="button"
                                             className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center text-[#8A8A8A] hover:text-white transition touch-manipulation"
                                             title="Duplicate"
                                          >
                                             <Copy size={12} />
                                          </button>
                                          <button
                                             onClick={() => removeFilterFromPipeline(f.id)}
                                             type="button"
                                             className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center text-[#8A8A8A] hover:text-red-400 font-semibold transition touch-manipulation"
                                             title="Delete Filter"
                                          >
                                             <X size={13} />
                                          </button>
                                       </div>
                                    </div>

                                    {/* Filter Slider/Controls Area */}
                                    {f.enabled && (
                                       <div className="p-3 space-y-3 touch-manipulation">

                                          {/* Adjustments: Brightness, Contrast, Saturation, Vibrance, Exposure, HueRotation */}
                                          {['brightness', 'contrast', 'saturation', 'vibrance', 'exposure', 'hueRotation', 'temperature', 'tint'].includes(f.type) && (
                                             <div className="space-y-1.5 font-sans">
                                                <div className="flex justify-between items-center text-[10px] text-[#A0A0A0]">
                                                   <span>Intensity</span>
                                                   <span className="font-mono text-white text-[11px] font-semibold">
                                                      {f.params.value || 0}
                                                   </span>
                                                </div>
                                                <input
                                                   type="range"
                                                   min={f.type === 'hueRotation' ? '0' : '-1'}
                                                   max={f.type === 'hueRotation' ? '360' : '1'}
                                                   step="0.01"
                                                   value={f.params.value || 0}
                                                   onChange={(e) => updateFilterParam(f.id, 'value', Number(e.target.value))}
                                                   className="w-full accent-blue-500 h-1 cursor-pointer bg-[#2A2A2A]"
                                                />
                                             </div>
                                          )}

                                          {/* Gamma channel controls */}
                                          {f.type === 'gamma' && (
                                             <div className="space-y-2 font-sans">
                                                {/* Red */}
                                                <div className="space-y-1">
                                                   <div className="flex justify-between items-center text-[9px] text-[#A0A0A0]">
                                                      <span className="text-red-400 font-sans">Red Channel</span>
                                                      <span className="font-mono text-white text-[10px]">
                                                         {f.params.red !== undefined ? f.params.red : 1.0}
                                                      </span>
                                                   </div>
                                                   <input
                                                      type="range" min="0.1" max="3" step="0.02"
                                                      value={f.params.red !== undefined ? f.params.red : 1.0}
                                                      onChange={(e) => updateFilterParam(f.id, 'red', Number(e.target.value))}
                                                      className="w-full accent-red-500 h-1"
                                                   />
                                                </div>
                                                {/* Green */}
                                                <div className="space-y-1">
                                                   <div className="flex justify-between items-center text-[9px] text-[#A0A0A0]">
                                                      <span className="text-emerald-400 font-sans">Green Channel</span>
                                                      <span className="font-mono text-white text-[10px]">
                                                         {f.params.green !== undefined ? f.params.green : 1.0}
                                                      </span>
                                                   </div>
                                                   <input
                                                      type="range" min="0.1" max="3" step="0.02"
                                                      value={f.params.green !== undefined ? f.params.green : 1.0}
                                                      onChange={(e) => updateFilterParam(f.id, 'green', Number(e.target.value))}
                                                      className="w-full accent-emerald-500 h-1"
                                                   />
                                                </div>
                                                {/* Blue */}
                                                <div className="space-y-1">
                                                   <div className="flex justify-between items-center text-[9px] text-[#A0A0A0]">
                                                      <span className="text-[#3b82f6] font-sans">Blue Channel</span>
                                                      <span className="font-mono text-white text-[10px]">
                                                         {f.params.blue !== undefined ? f.params.blue : 1.0}
                                                      </span>
                                                   </div>
                                                   <input
                                                      type="range" min="0.1" max="3" step="0.02"
                                                      value={f.params.blue !== undefined ? f.params.blue : 1.0}
                                                      onChange={(e) => updateFilterParam(f.id, 'blue', Number(e.target.value))}
                                                      className="w-full accent-blue-500 h-1"
                                                   />
                                                </div>
                                             </div>
                                          )}

                                          {/* Noise & Grain */}
                                          {f.type === 'noise' && (
                                             <div className="space-y-1.5 font-sans">
                                                <div className="flex justify-between items-center text-[10px] text-[#A0A0A0]">
                                                   <span>Grain Density</span>
                                                   <span className="font-mono text-white">
                                                      {f.params.value}
                                                   </span>
                                                </div>
                                                <input
                                                   type="range" min="0" max="800" step="10"
                                                   value={f.params.value || 50}
                                                   onChange={(e) => updateFilterParam(f.id, 'value', Number(e.target.value))}
                                                   className="w-full accent-blue-500 h-1"
                                                />
                                             </div>
                                          )}

                                          {/* Pixelate */}
                                          {f.type === 'pixelate' && (
                                             <div className="space-y-1.5 font-sans">
                                                <div className="flex justify-between items-center text-[10px] text-[#A0A0A0]">
                                                   <span>Block Size</span>
                                                   <span className="font-mono text-white">
                                                      {f.params.value} px
                                                   </span>
                                                </div>
                                                <input
                                                   type="range" min="2" max="60" step="1"
                                                   value={f.params.value || 8}
                                                   onChange={(e) => updateFilterParam(f.id, 'value', Number(e.target.value))}
                                                   className="w-full accent-blue-500 h-1"
                                                />
                                             </div>
                                          )}

                                          {/* Blur */}
                                          {f.type === 'blur' && (
                                             <div className="space-y-1.5 font-sans">
                                                <div className="flex justify-between items-center text-[10px] text-[#A0A0A0]">
                                                   <span>Blur Radius</span>
                                                   <span className="font-mono text-white font-sans">
                                                      {(f.params.value || 0).toFixed(2)}
                                                   </span>
                                                </div>
                                                <input
                                                   type="range" min="0.01" max="1" step="0.02"
                                                   value={f.params.value || 0.2}
                                                   onChange={(e) => updateFilterParam(f.id, 'value', Number(e.target.value))}
                                                   className="w-full accent-blue-500 h-1"
                                                />
                                             </div>
                                          )}

                                          {/* Chromatic Color Key */}
                                          {f.type === 'removeColor' && (
                                             <div className="space-y-2 font-sans">
                                                <div className="flex justify-between items-center text-[10px] text-[#A0A0A0]">
                                                   <span>Tolerance</span>
                                                   <span className="font-mono text-white">
                                                      {f.params.distance !== undefined ? f.params.distance : 0.15}
                                                   </span>
                                                </div>
                                                <input
                                                   type="range" min="0" max="0.9" step="0.01"
                                                   value={f.params.distance !== undefined ? f.params.distance : 0.15}
                                                   onChange={(e) => updateFilterParam(f.id, 'distance', Number(e.target.value))}
                                                   className="w-full accent-blue-500 h-1"
                                                />
                                                <div className="flex items-center justify-between text-[10px] text-[#A0A0A0] font-sans">
                                                   <span>Key Color</span>
                                                   <ColorPickerTrigger
                                                      color={f.params.color || '#ffffff'}
                                                      onChange={(c) => updateFilterParam(f.id, 'color', c)}
                                                      label="Key Color"
                                                   />
                                                </div>
                                             </div>
                                          )}

                                          {/* Blend Color Matrix */}
                                          {f.type === 'blendColor' && (
                                             <div className="space-y-2 text-[11px] font-sans">
                                                <div className="flex items-center justify-between">
                                                   <span className="text-[#A0A0A0] font-sans">Map Mode</span>
                                                   <select
                                                      value={f.params.mode || 'multiply'}
                                                      onChange={(e) => updateFilterParam(f.id, 'mode', e.target.value)}
                                                      className="bg-[#1A1A1A] border border-[#2D2D2D] rounded px-1.5 py-0.5 outline-none text-xs hover:border-[#444] text-white font-sans"
                                                   >
                                                      <option value="multiply">Multiply</option>
                                                      <option value="screen">Screen</option>
                                                      <option value="overlay">Overlay</option>
                                                      <option value="darken">Darken</option>
                                                      <option value="lighten">Lighten</option>
                                                   </select>
                                                </div>
                                                <div className="space-y-1">
                                                   <div className="flex justify-between items-center text-[9px] text-[#A0A0A0]">
                                                      <span className="font-sans">Blend Opacity</span>
                                                      <span className="font-mono text-white">
                                                         {f.params.alpha !== undefined ? f.params.alpha : 0.4}
                                                      </span>
                                                   </div>
                                                   <input
                                                      type="range" min="0" max="1" step="0.02"
                                                      value={f.params.alpha !== undefined ? f.params.alpha : 0.4}
                                                      onChange={(e) => updateFilterParam(f.id, 'alpha', Number(e.target.value))}
                                                      className="w-full accent-blue-500 h-1"
                                                   />
                                                </div>
                                                <div className="flex items-center justify-between text-[10px] text-[#A0A0A0] font-sans">
                                                   <span>Color</span>
                                                   <ColorPickerTrigger
                                                      color={f.params.color || '#3b82f6'}
                                                      onChange={(c) => updateFilterParam(f.id, 'color', c)}
                                                   />
                                                </div>
                                             </div>
                                          )}

                                          {/* WebGL Intensity */}
                                          {['cyberpunkDuotone', 'halationBloom', 'vhsGlitch', 'frostedGlass', 'vaporwaveHalftone', 'thermalHeatmap', 'neonSobelEdge', 'liquidRipple', 'asciiMatrix', 'mandalaMirror', 'godRays', 'anamorphicFlare'].includes(f.type) && (
                                             <div className="space-y-1.5 font-sans">
                                                <div className="flex justify-between items-center text-[10px] text-[#A0A0A0]">
                                                   <span>Effect Intensity</span>
                                                   <span className="font-mono text-purple-400 font-semibold">
                                                      {(f.params.value !== undefined ? f.params.value : 1.0).toFixed(2)}
                                                   </span>
                                                </div>
                                                <input
                                                   type="range" min="0" max="2" step="0.05"
                                                   value={f.params.value !== undefined ? f.params.value : 1.0}
                                                   onChange={(e) => updateFilterParam(f.id, 'value', Number(e.target.value))}
                                                   className="w-full accent-purple-500 h-1 cursor-pointer bg-[#2A2A2A]"
                                                />
                                             </div>
                                          )}

                                          {/* Neon Edge Custom Color Picker */}
                                          {f.type === 'neonSobelEdge' && (
                                             <div className="flex items-center justify-between text-[10px] text-[#A0A0A0] font-sans">
                                                <span>Neon Glow Color</span>
                                                <ColorPickerTrigger
                                                   color={f.params.color || '#00ffcc'}
                                                   onChange={(c) => updateFilterParam(f.id, 'color', c)}
                                                   label="Neon Color"
                                                />
                                             </div>
                                          )}

                                          {/* Grayscale Modes */}
                                          {f.type === 'grayscale' && (
                                             <div className="flex items-center justify-between text-[11px] font-sans">
                                                <span className="text-[#A0A0A0]">Formula Mode</span>
                                                <select
                                                   value={f.params.mode || 'luminosity'}
                                                   onChange={(e) => updateFilterParam(f.id, 'mode', e.target.value)}
                                                   className="bg-[#1A1A1A] border border-[#2D2D2D] rounded px-1.5 py-0.5 outline-none text-xs text-white font-sans"
                                                >
                                                   <option value="average">Average</option>
                                                   <option value="luminosity">Luminosity</option>
                                                   <option value="lightness">Lightness</option>
                                                </select>
                                             </div>
                                          )}

                                          {/* Presets and custom assets info */}
                                          {['invert', 'sepia', 'blackwhite', 'edge', 'sharpen', 'emboss', 'vignette', 'bloom', 'chromatic', 'preset'].includes(f.type) && (
                                             <div className="text-[10px] text-[#808080] font-sans font-medium italic flex items-center gap-1">
                                                <Activity size={11} className="text-blue-500 shrink-0" /> Fast pipeline shader applied. No customizable metrics.
                                             </div>
                                          )}

                                       </div>
                                    )}

                                 </div>
                              );
                           })}
                        </div>
                     )}

                  </div>

                  {/* CUSTOM SAVED PRESETS LOGIC */}
                  <div className="space-y-2 pb-6">
                     <div className="text-[10px] uppercase font-bold tracking-wider text-[#8A8A8A] flex items-center gap-1.5 font-sans">
                        <Bookmark size={11} className="text-emerald-400" /> Custom Saved Presets
                     </div>

                     {customPresets.length === 0 ? (
                        <div className="py-6 bg-black/15 rounded-lg border border-dashed border-[#2C2C2C] text-center p-3 text-[11px] text-[#8A8A8A] font-sans">
                           No saved custom presets yet. Build a stack and save it!
                        </div>
                     ) : (
                        <div className="space-y-1.5">
                           {customPresets.map((p, pIdx) => (
                              <div key={p.name + pIdx} className="flex items-center justify-between p-2 bg-[#1A1A1A] border border-[#2C2C2C] rounded-md text-[11px] font-sans">
                                 <span className="font-semibold truncate text-[#C0C0C0] max-w-[150px]" title={p.name}>{p.name}</span>
                                 <div className="flex gap-1.5 font-sans">
                                    <button
                                       onClick={() => loadSavedPreset(p)}
                                       type="button"
                                       className="px-2 py-0.5 bg-blue-600/10 hover:bg-blue-600 border border-blue-500/20 text-blue-200 hover:text-white rounded text-[10px] font-semibold transition"
                                    >
                                       Apply
                                    </button>
                                    <button
                                       onClick={() => deleteCustomPreset(p.name)}
                                       type="button"
                                       className="px-2 py-0.5 bg-red-950/20 hover:bg-red-900 border border-red-900/20 text-red-400 hover:text-white rounded text-[10px] font-semibold transition"
                                    >
                                       Delete
                                    </button>
                                 </div>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>

               </div>
            )}
         </div>
      </>
   );
};
