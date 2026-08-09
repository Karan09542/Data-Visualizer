import React, { useState } from 'react';
import { RotateCw, Trash2, LayoutGrid, MoreHorizontal, Copy, Image as ImageIcon } from 'lucide-react';
import { useLayers } from '../../contexts/LayersContext';
import { useCanvas } from '../../contexts/CanvasContext';
import { useWorkspaceUI } from '../../contexts/WorkspaceUIContext';
import { LayerThumbnail } from './LayerThumbnail';
import { ModernSelect } from '../shared/ModernSelect';
import { useStore } from '../../../../store/useStore';
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
   const { layers, selectedLayerId, selectLayer, moveLayerUp } = useLayers();
   const { deleteActiveObject } = useCanvas();
   const { artboards } = useWorkspaceUI();
   const { setNotification } = useStore();
   const [thumbSize, setThumbSize] = useState<ThumbSize>('standard');
   const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

   const copyLayerObject = (layer: fabric.Object) => {
      navigator.clipboard.writeText(JSON.stringify({ __fabricInternalClipboard: true })).catch(() => { });
      layer.clone(['id', 'artboardId']).then((cloned) => {
         (window as any)._fabricInternalClipboard = cloned;
         setNotification({ message: 'Object copied', type: 'success' });
      });
   };

   const copyLayerPNG = async (layer: fabric.Object) => {
      try {
         const dataUrl = layer.toDataURL({ format: 'png' });
         const res = await fetch(dataUrl);
         const blob = await res.blob();
         await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
         setNotification({ message: 'Copied as PNG', type: 'success' });
      } catch (e) {
         setNotification({ message: 'Failed to copy PNG', type: 'error' });
      }
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

         <div className="space-y-1 overflow-y-auto custom-scrollbar pr-1 pb-4 flex-1">
            {layers.map((layer, idx) => {
               const isSelected = selectedLayerId === (layer as any).id;
               const sizePx = getPxForSize(thumbSize);

               return (
                  <div key={(layer as any).id || idx} onClick={() => selectLayer((layer as any).id)} className={`flex items-center group px-2 py-1.5 rounded-md cursor-pointer transition-colors ${isSelected ? 'bg-blue-600/20 text-blue-100 border border-blue-500/30' : 'hover:bg-[#2C2C2C] text-[#C0C0C0] border border-transparent'}`}>
                     <div className="mr-3 shrink-0">
                        <LayerThumbnail layer={layer as any} sizePx={sizePx} />
                     </div>

                     <div className="flex flex-col flex-1 min-w-0 justify-center">
                        <span className="text-xs truncate capitalize font-medium">
                           {(layer as any).customName || layer.type} {(layer as any).text ? `"${(layer as any).text.substring(0, 10)}..."` : ''}
                        </span>
                        <span className="text-[9px] text-slate-500 truncate">
                           {(() => {
                              const b = artboards.find(a => a.id === (layer as any).artboardId);
                              return b ? b.name : 'Global Canvas';
                           })()}
                        </span>
                     </div>

                     <div className={`flex gap-1 shrink-0 ml-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity relative`}>
                        <button
                           className="p-1.5 hover:bg-[#3A3A3A] hover:text-white rounded text-[#8A8A8A]"
                           onClick={(e) => {
                              e.stopPropagation();
                              selectLayer((layer as any).id);
                              setMenuOpenId(menuOpenId === (layer as any).id ? null : (layer as any).id);
                           }}
                           title="Options"
                        >
                           <MoreHorizontal size={14} />
                        </button>

                        {menuOpenId === (layer as any).id && (
                           <div
                              className="absolute right-0 top-full mt-1 z-50 bg-[#1A1A1A] border border-[#333] shadow-xl rounded-lg w-40 py-1 overflow-hidden"
                              onMouseLeave={() => setMenuOpenId(null)}
                           >
                              <button className="w-full text-left px-3 py-2 text-[11px] font-medium text-slate-300 hover:bg-[#2A2A2A] hover:text-white flex items-center gap-2 transition-colors" onClick={(e) => { e.stopPropagation(); selectLayer((layer as any).id); copyLayerObject(layer as any); setMenuOpenId(null); }}>
                                 <Copy size={12} /> Copy Object
                              </button>
                              <button className="w-full text-left px-3 py-2 text-[11px] font-medium text-slate-300 hover:bg-[#2A2A2A] hover:text-white flex items-center gap-2 transition-colors" onClick={(e) => { e.stopPropagation(); selectLayer((layer as any).id); copyLayerPNG(layer as any); setMenuOpenId(null); }}>
                                 <ImageIcon size={12} /> Copy as PNG
                              </button>
                              <div className="h-px bg-[#333] my-1 mx-2" />
                              <button className="w-full text-left px-3 py-2 text-[11px] font-medium text-slate-300 hover:bg-[#2A2A2A] hover:text-white flex items-center gap-2 transition-colors" onClick={(e) => { e.stopPropagation(); selectLayer((layer as any).id); setTimeout(() => moveLayerUp((layer as any).id), 50); setMenuOpenId(null); }}>
                                 <RotateCw size={12} /> Bring Forward
                              </button>
                              <button className="w-full text-left px-3 py-2 text-[11px] font-medium text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors" onClick={(e) => { e.stopPropagation(); selectLayer((layer as any).id); setTimeout(() => deleteActiveObject(), 50); setMenuOpenId(null); }}>
                                 <Trash2 size={12} /> Delete
                              </button>
                           </div>
                        )}
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
