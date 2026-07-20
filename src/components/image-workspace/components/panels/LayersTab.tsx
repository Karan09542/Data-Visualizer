import React from 'react';
import { Layers, Image as ImageIcon, Type, Brush, Square, Circle, RotateCw, Trash2 } from 'lucide-react';
import { useLayers } from '../../contexts/LayersContext';
import { useCanvas } from '../../contexts/CanvasContext';
import { useWorkspaceUI } from '../../contexts/WorkspaceUIContext';

export const LayersTab: React.FC = () => {
  const { layers, selectedLayerId, selectLayer, moveLayerUp } = useLayers();
  const { deleteActiveObject } = useCanvas();
  const { artboards } = useWorkspaceUI();

  return (
    <div className="p-2 space-y-1">
      {layers.map((layer, idx) => {
        const isSelected = selectedLayerId === (layer as any).id;
        return (
          <div key={(layer as any).id || idx} onClick={() => selectLayer((layer as any).id)} className={`flex items-center group px-3 py-2 rounded-md cursor-pointer transition-colors ${isSelected ? 'bg-blue-600/20 text-blue-100 border border-blue-500/30' : 'hover:bg-[#2C2C2C] text-[#C0C0C0] border border-transparent'}`}>
            <div className="w-5 flex justify-center mr-2 opacity-60">
              {layer.type === 'image' ? <ImageIcon size={14} /> :
                layer.type === 'i-text' || layer.type === 'text' || layer.type === 'textbox' ? <Type size={14} /> : layer.type === 'path' ? <Brush size={14} /> :
                  layer.type === 'rect' ? <Square size={14} /> :
                    layer.type === 'circle' ? <Circle size={14} /> :
                      <Layers size={14} />}
            </div>
            <span className="text-xs flex-1 truncate capitalize">
              {(layer as any).customName || layer.type} {(layer as any).text ? `"${(layer as any).text.substring(0, 6)}..."` : ''}
              <span className="block text-[9px] text-slate-500 mt-0.5">
                {(() => {
                  const b = artboards.find(a => a.id === (layer as any).artboardId);
                  return b ? b.name : 'Global';
                })()}
              </span>
            </span>

            <div className={`flex gap-1 opacity-0 ${isSelected ? 'opacity-100' : 'group-hover:opacity-100'} transition-opacity`}>
              <button className="p-1 hover:bg-[#3A3A3A] hover:text-white rounded text-[#8A8A8A]" onClick={(e) => { e.stopPropagation(); moveLayerUp((layer as any).id); }}><RotateCw size={12} /></button>
              <button className="p-1 hover:bg-[#3A3A3A] hover:text-red-400 rounded text-[#8A8A8A]" onClick={(e) => { e.stopPropagation(); deleteActiveObject(); }}><Trash2 size={12} /></button>
            </div>
          </div>
        );
      })}
      {layers.length === 0 && (
        <div className="p-4 text-xs text-[#8A8A8A] text-center italic mt-10">Canvas is empty</div>
      )}
    </div>
  );
};
