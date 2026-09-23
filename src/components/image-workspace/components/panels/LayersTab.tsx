import React, { useState } from 'react';
import { LayoutGrid, MoreHorizontal, Check, Anchor, X, Minus, Eye, EyeOff } from 'lucide-react';
import { useLayers } from '../../contexts/LayersContext';
import { useSelection } from '../../contexts/SelectionContext';
import { useWorkspaceUI } from '../../contexts/WorkspaceUIContext';
import { LayerThumbnail } from './LayerThumbnail';
import { ModernSelect } from '../shared/ModernSelect';
import * as fabric from 'fabric';

type ThumbSize = 'small' | 'standard' | 'medium' | 'large';

const getPxForSize = (s: ThumbSize) => {
   switch (s) {
      case 'small': return 16;
      case 'standard': return 24;
      case 'medium': return 32;
      case 'large': return 48;
      default: return 24;
   }
};

export const LayersTab: React.FC = () => {
   const { layers, selectedLayerId, selectLayer, toggleLayerSelection, setLayerSelection, toggleLayerVisibility, setLayersVisibility } = useLayers();
   const { activeObjs, parentAlignmentObj, setParentAlignmentObj } = useSelection();
   const { artboards, openObjectContextMenu } = useWorkspaceUI();
   const [thumbSize, setThumbSize] = useState<ThumbSize>('standard');

   /**
    * Opens the object's own menu, the same one the canvas shows, so a row offers every action
    * rather than the handful this panel used to repeat.
    */
   const openMenuFor = (layer: fabric.Object, x: number, y: number) => {
      if (!openObjectContextMenu) return;
      // A row already in a multi-selection keeps it, so the menu can act on the whole group
      if (!activeObjs.includes(layer)) selectLayer((layer as any).id);
      openObjectContextMenu(x, y, layer);
   };

   // Only layers that can actually be selected count towards "all": hidden ones (other artboards
   // on mobile) and locked helpers would otherwise keep the header box from ever reading as full.
   const selectableLayers = layers.filter(l => l.selectable !== false && l.visible !== false);
   const selectedCount = selectableLayers.filter(l => activeObjs.includes(l)).length;
   const allSelected = selectableLayers.length > 0 && selectedCount === selectableLayers.length;
   const someSelected = selectedCount > 0 && !allSelected;

   const toggleSelectAll = () => {
      // The list runs top layer first; the canvas wants bottom-up order.
      setLayerSelection(allSelected ? [] : [...selectableLayers].reverse());
   };

   /**
    * Checkbox click, with two modifiers:
    * - Alt: this layer only - everything else is deselected.
    * - Shift: this layer and every layer below it in the list, replacing the selection, so the
    *   gesture always means the same thing whatever was ticked before.
    * A plain click toggles just this one.
    */
   const onCheckboxClick = (e: React.MouseEvent, index: number, layer: fabric.Object) => {
      e.stopPropagation();

      if (e.altKey) {
         setLayerSelection([layer]);
         return;
      }

      if (e.shiftKey) {
         // Rows from here to the bottom of the list, handed over in canvas (bottom-up) order.
         setLayerSelection(layers.slice(index).reverse());
         return;
      }

      toggleLayerSelection((layer as any).id);
   };

   return (
      <div className="p-2 space-y-2 flex flex-col h-full">
         <div className="px-1 flex items-center justify-between shrink-0 mb-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
               <LayoutGrid size={14} className="text-blue-400" />
               Layers
            </div>
            <div className="w-28">
               <ModernSelect
                  value={thumbSize}
                  onChange={(val) => setThumbSize(val as ThumbSize)}
                  groups={[
                     {
                        label: 'Thumbnail Size',
                        options: [
                           { value: 'small', label: 'Small' },
                           { value: 'standard', label: 'Standard' },
                           { value: 'medium', label: 'Medium' },
                           { value: 'large', label: 'Large' }
                        ]
                     }
                  ]}
               />
            </div>
         </div>

         {layers.length > 0 && (
            <div className="px-2 flex items-center gap-2 shrink-0">
               <button
                  type="button"
                  role="checkbox"
                  aria-checked={allSelected ? 'true' : someSelected ? 'mixed' : 'false'}
                  onClick={toggleSelectAll}
                  title={allSelected ? 'Deselect all layers' : 'Select all layers'}
                  className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-md border transition-colors ${allSelected || someSelected
                     ? 'bg-blue-600 border-blue-400 text-white'
                     : 'bg-transparent border-[#3A3A3A] text-transparent hover:border-blue-500/60 active:bg-blue-600/20'}`}
               >
                  {someSelected ? <Minus size={13} strokeWidth={3} /> : <Check size={13} strokeWidth={3} />}
               </button>
               <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-[11px] font-semibold text-slate-300 hover:text-white transition-colors"
               >
                  {allSelected ? 'Deselect all' : 'Select all'}
               </button>
               <span className="ml-auto text-[9px] text-slate-500 truncate hidden md:inline">
                  Shift: this layer and below · Alt: only this
               </span>
            </div>
         )}

         {activeObjs.length > 1 && (
            <div className="mb-2 px-2.5 py-2 rounded-lg bg-blue-950/30 border border-blue-500/20 flex items-center gap-2">
               <span className="text-[10px] font-bold text-blue-300 shrink-0">{activeObjs.length} selected</span>
               <span className="text-[10px] text-[#8A8A8A] truncate flex-1 min-w-0">
                  {parentAlignmentObj
                     ? <>Parent: <span className="text-white font-semibold capitalize">{(parentAlignmentObj as any).customName || parentAlignmentObj.type}</span></>
                     : 'Tap the anchor on a row to set the parent'}
               </span>
               <button
                  type="button"
                  onClick={() => {
                     const ids = activeObjs.map((o: any) => (o as any).id).filter(Boolean);
                     if (setLayersVisibility && ids.length > 0) {
                        const anyHidden = activeObjs.some((o: any) => (o as any).hidden || o.visible === false);
                        setLayersVisibility(ids, anyHidden);
                     }
                  }}
                  title={activeObjs.some((o: any) => (o as any).hidden || o.visible === false) ? "Show selected layers" : "Hide selected layers"}
                  className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md border border-[#3A3A3A] text-[#A0A0A0] hover:text-white hover:border-blue-500/60 active:bg-blue-600/20 transition-colors"
               >
                  {activeObjs.some((o: any) => (o as any).hidden || o.visible === false) ? <Eye size={13} /> : <EyeOff size={13} />}
               </button>
               {parentAlignmentObj && (
                  <button
                     type="button"
                     onClick={() => setParentAlignmentObj(null)}
                     title="Clear parent"
                     className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md border border-[#3A3A3A] text-[#A0A0A0] hover:text-white hover:border-blue-500/60 active:bg-blue-600/20"
                  >
                     <X size={13} />
                  </button>
               )}
            </div>
         )}

         <div className="space-y-1 overflow-y-auto custom-scrollbar pr-1 pb-4 flex-1">
            {layers.map((layer, idx) => {
               const inSelection = activeObjs.includes(layer);
               const isParent = parentAlignmentObj === layer;
               const isSelected = inSelection || selectedLayerId === (layer as any).id;
               const isHidden = (layer as any).hidden || layer.visible === false;
               const sizePx = getPxForSize(thumbSize);

               return (
                  <div
                     key={(layer as any).id || idx}
                     onClick={() => !isHidden && selectLayer((layer as any).id)}
                     onContextMenu={(e) => {
                        e.preventDefault();
                        openMenuFor(layer, e.clientX, e.clientY);
                     }}
                     className={`flex items-center group px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                        isSelected
                           ? 'bg-blue-600/20 text-blue-100 border border-blue-500/30'
                           : 'hover:bg-[#2C2C2C] text-[#C0C0C0] border border-transparent'
                     } ${isHidden ? 'opacity-50 hover:opacity-75 bg-[#1b1b1b]/40' : ''}`}
                  >
                     {/* Tap target for building a multi-selection without a keyboard */}
                     <button
                        type="button"
                        onClick={(e) => onCheckboxClick(e, idx, layer)}
                        title={`${inSelection ? 'Remove from selection' : 'Add to selection'} - Shift+click: this layer and all below · Alt+click: only this layer`}
                        aria-pressed={inSelection}
                        className={`w-7 h-7 mr-1.5 shrink-0 flex items-center justify-center rounded-md border transition-colors ${
                           inSelection
                              ? 'bg-blue-600 border-blue-400 text-white'
                              : 'bg-transparent border-[#3A3A3A] text-transparent hover:border-blue-500/60 active:bg-blue-600/20'
                        }`}
                     >
                        <Check size={13} strokeWidth={3} />
                     </button>

                     {/* Designates the key object the rest of the selection aligns to. Deliberately
                         does not call selectLayer, which would collapse the multi-selection. */}
                     {activeObjs.length > 1 && inSelection && (
                        <button
                           type="button"
                           onClick={(e) => { e.stopPropagation(); setParentAlignmentObj(isParent ? null : layer); }}
                           title={isParent ? 'Clear parent' : 'Set as parent'}
                           aria-pressed={isParent}
                           className={`w-7 h-7 mr-1.5 shrink-0 flex items-center justify-center rounded-md border transition-colors ${
                              isParent
                                 ? 'bg-blue-600 border-blue-400 text-white'
                                 : 'bg-transparent border-[#3A3A3A] text-[#6A6A6A] hover:border-blue-500/60 hover:text-blue-300 active:bg-blue-600/20'
                           }`}
                        >
                           <Anchor size={13} strokeWidth={2.5} />
                        </button>
                     )}

                     <div className="mr-3 shrink-0">
                        <LayerThumbnail layer={layer as any} sizePx={sizePx} />
                     </div>

                     <div className="flex flex-col flex-1 min-w-0 justify-center">
                        <div className="flex items-center gap-1.5 min-w-0">
                           <span className={`text-xs truncate capitalize font-medium ${isHidden ? 'text-slate-500 line-through' : ''}`}>
                              {(layer as any).customName || layer.type} {(layer as any).text ? `"${(layer as any).text.substring(0, 10)}..."` : ''}
                           </span>
                           {isHidden && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-400/90 border border-amber-500/20 shrink-0 font-normal leading-tight">
                                 Hidden
                              </span>
                           )}
                        </div>
                        <span className="text-[9px] text-slate-500 truncate">
                           {(() => {
                              const b = artboards.find(a => a.id === (layer as any).artboardId);
                              return b ? b.name : 'Global Canvas';
                           })()}
                        </span>
                     </div>

                     <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                           type="button"
                           className={`p-1.5 hover:bg-[#3A3A3A] rounded transition-colors ${
                              isHidden
                                 ? 'opacity-100 text-amber-400/90 hover:text-amber-300 hover:bg-amber-400/10'
                                 : 'opacity-100 md:opacity-0 md:group-hover:opacity-100 text-slate-400 hover:text-white'
                           }`}
                           onClick={(e) => {
                              e.stopPropagation();
                              toggleLayerVisibility((layer as any).id);
                           }}
                           title={isHidden ? "Unhide layer (click to show on canvas)" : "Hide layer (click to hide on canvas)"}
                        >
                           {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>

                        <button
                           type="button"
                           className="p-1.5 hover:bg-[#3A3A3A] hover:text-white rounded text-[#8A8A8A] opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                           onClick={(e) => {
                              e.stopPropagation();
                              // Anchored to the button, so the menu lands beside the row it belongs to
                              const rect = e.currentTarget.getBoundingClientRect();
                              openMenuFor(layer, rect.right, rect.bottom + 4);
                           }}
                           title="Layer options"
                        >
                           <MoreHorizontal size={14} />
                        </button>
                     </div>
                  </div>
               );
            })}
            {layers.length === 0 && (
               <div className="p-4 text-xs text-[#8A8A8A] text-center italic mt-10">Canvas is empty</div>
            )}
         </div>
      </div>
   );
};
