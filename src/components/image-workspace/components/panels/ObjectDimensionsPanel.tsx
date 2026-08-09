import React, { useState, useEffect, useCallback } from "react";
import * as fabric from "fabric";
import { Layout } from "lucide-react";

// TODO(Refactor): Move to src/components/image-workspace/components/panels/ObjectDimensionsPanel.tsx
export const ObjectDimensionsPanel = ({ fabricRef }: { fabricRef: React.RefObject<fabric.Canvas> }) => {
   const [dims, setDims] = useState<any>(null);
   const [lockedRatio, setLockedRatio] = useState(true);

   const updateDims = useCallback(() => {
      if (!fabricRef.current) return;
      const active = fabricRef.current.getActiveObject();
      if (!active) {
         setDims(null);
         return;
      }

      const objType = active.type;
      const isImage = objType === 'image';
      const isVector = ['path', 'polygon', 'polyline', 'rect', 'circle', 'triangle', 'line'].includes(objType || '');

      const absBounds = active.getBoundingRect();

      const baseW = active.width || 0;
      const baseH = active.height || 0;

      const scaleX = active.scaleX || 1;
      const scaleY = active.scaleY || 1;

      const scaledW = baseW * scaleX;
      const scaledH = baseH * scaleY;

      const center = active.getCenterPoint();

      let originalRes = null;
      if (isImage) {
         originalRes = {
            w: (active as fabric.Image).getOriginalSize?.().width || (active as fabric.Image).width,
            h: (active as fabric.Image).getOriginalSize?.().height || (active as fabric.Image).height
         };
      }

      setDims({
         x: active.left || 0,
         y: active.top || 0,
         width: baseW,
         height: baseH,
         scaleX,
         scaleY,
         scaledWidth: scaledW,
         scaledHeight: scaledH,
         rotation: active.angle || 0,
         bboxW: absBounds.width,
         bboxH: absBounds.height,
         centerX: center.x,
         centerY: center.y,
         isImage,
         originalRes,
         isVector
      });
   }, [fabricRef]);

   useEffect(() => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      const events = ['selection:created', 'selection:updated', 'selection:cleared', 'object:modified', 'object:moving', 'object:scaling', 'object:rotating', 'object:skewing'];

      events.forEach(e => canvas.on(e as any, updateDims));
      updateDims();
      return () => {
         events.forEach(e => canvas.off(e as any, updateDims));
      };
   }, [fabricRef, updateDims]);

   if (!dims) return null;

   const updateObject = (updates: any) => {
      const active = fabricRef.current?.getActiveObject();
      if (!active) return;

      if (lockedRatio && (updates.scaledWidth !== undefined || updates.scaledHeight !== undefined)) {
         const aspect = dims.scaledWidth / dims.scaledHeight;
         if (updates.scaledWidth !== undefined && updates.scaledHeight === undefined) {
            updates.scaledHeight = updates.scaledWidth / aspect;
         } else if (updates.scaledHeight !== undefined && updates.scaledWidth === undefined) {
            updates.scaledWidth = updates.scaledHeight * aspect;
         }
      }

      if (updates.scaledWidth !== undefined) {
         active.set('scaleX', updates.scaledWidth / dims.width);
      }
      if (updates.scaledHeight !== undefined) {
         active.set('scaleY', updates.scaledHeight / dims.height);
      }

      if (updates.width !== undefined) active.set('width', updates.width);
      if (updates.height !== undefined) active.set('height', updates.height);
      if (updates.x !== undefined) active.set('left', updates.x);
      if (updates.y !== undefined) active.set('top', updates.y);
      if (updates.rotation !== undefined) active.set('angle', updates.rotation);
      if (updates.scaleX !== undefined) active.set('scaleX', updates.scaleX);
      if (updates.scaleY !== undefined) active.set('scaleY', updates.scaleY);

      active.setCoords();
      fabricRef.current?.requestRenderAll();
      updateDims();
   };

   const resetScale = () => {
      updateObject({ scaleX: 1, scaleY: 1, scaledWidth: dims.width, scaledHeight: dims.height });
   };

   return (
      <div className="space-y-4 border-b border-slate-200 dark:border-[#2C2C2C] pb-4 animate-fade-in mt-4">
         <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-[#A0A0A0] flex items-center justify-between">
            <div className="flex items-center gap-2"><Layout size={12} /> Dimensions</div>
         </div>

         <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-[#222] p-2.5 rounded-lg">
            <div className="space-y-1">
               <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-[#8A8A8A] block font-bold">X</span>
               <input type="number" className="w-full bg-white dark:bg-[#0C0C0C] border border-slate-200 dark:border-[#333] rounded px-2 py-1 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500" value={Math.round(dims.x)} onChange={(e) => updateObject({ x: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
               <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-[#8A8A8A] block font-bold">Y</span>
               <input type="number" className="w-full bg-white dark:bg-[#0C0C0C] border border-slate-200 dark:border-[#333] rounded px-2 py-1 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500" value={Math.round(dims.y)} onChange={(e) => updateObject({ y: Number(e.target.value) })} />
            </div>

            <div className="space-y-1">
               <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-[#8A8A8A] block font-bold">Width</span>
               <input type="number" className="w-full bg-white dark:bg-[#0C0C0C] border border-slate-200 dark:border-[#333] rounded px-2 py-1 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500" value={Math.round(dims.width)} onChange={(e) => updateObject({ width: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
               <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-[#8A8A8A] block font-bold">Height</span>
               <input type="number" className="w-full bg-white dark:bg-[#0C0C0C] border border-slate-200 dark:border-[#333] rounded px-2 py-1 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500" value={Math.round(dims.height)} onChange={(e) => updateObject({ height: Number(e.target.value) })} />
            </div>

            <div className="space-y-1 relative">
               <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-[#8A8A8A] block font-bold text-blue-400">Scaled Width</span>
               <input type="number" className="w-full bg-blue-50 dark:bg-[#0C0C0C] border border-blue-200 dark:border-blue-900/30 rounded px-2 py-1 text-xs text-blue-700 dark:text-blue-200 focus:outline-none" value={Math.round(dims.scaledWidth)} onChange={(e) => updateObject({ scaledWidth: Number(e.target.value) })} />
            </div>
            <div className="space-y-1 relative">
               <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-[#8A8A8A] block font-bold text-blue-400">Scaled Height</span>
               <input type="number" className="w-full bg-blue-50 dark:bg-[#0C0C0C] border border-blue-200 dark:border-blue-900/30 rounded px-2 py-1 text-xs text-blue-700 dark:text-blue-200 focus:outline-none" value={Math.round(dims.scaledHeight)} onChange={(e) => updateObject({ scaledHeight: Number(e.target.value) })} />
            </div>

            <div className="col-span-2 flex items-center justify-between text-slate-500 dark:text-[#8A8A8A]">
               <button onClick={() => setLockedRatio(!lockedRatio)} className={`text-[10px] flex items-center gap-1 hover:text-slate-900 dark:text-white transition ${lockedRatio ? 'text-blue-400' : ''}`}>
                  Aspect Ratio {lockedRatio ? '🔒' : '🔓'}
               </button>
               <button onClick={resetScale} className="text-[10px] hover:text-slate-900 dark:text-white transition">Reset Scale</button>
            </div>

            <div className="space-y-1">
               <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-[#8A8A8A] block font-bold">Scale X (%)</span>
               <input type="number" className="w-full bg-white dark:bg-[#0C0C0C] border border-slate-200 dark:border-[#333] rounded px-2 py-1 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500" value={Math.round(dims.scaleX * 100)} onChange={(e) => updateObject({ scaleX: Number(e.target.value) / 100 })} />
            </div>
            <div className="space-y-1">
               <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-[#8A8A8A] block font-bold">Scale Y (%)</span>
               <input type="number" className="w-full bg-white dark:bg-[#0C0C0C] border border-slate-200 dark:border-[#333] rounded px-2 py-1 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500" value={Math.round(dims.scaleY * 100)} onChange={(e) => updateObject({ scaleY: Number(e.target.value) / 100 })} />
            </div>

            <div className="space-y-1">
               <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-[#8A8A8A] block font-bold">Rotation (°)</span>
               <input type="number" className="w-full bg-white dark:bg-[#0C0C0C] border border-slate-200 dark:border-[#333] rounded px-2 py-1 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500" value={Math.round(dims.rotation)} onChange={(e) => updateObject({ rotation: Number(e.target.value) })} />
            </div>

            <div className="col-span-2 pt-2 mt-1 border-t border-slate-200 dark:border-[#222]">
               <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 dark:text-[#8A8A8A]">
                  <div>BBox W: <span className="font-mono text-slate-900 dark:text-white">{Math.round(dims.bboxW)}</span></div>
                  <div>BBox H: <span className="font-mono text-slate-900 dark:text-white">{Math.round(dims.bboxH)}</span></div>
                  <div>Center X: <span className="font-mono text-slate-900 dark:text-white">{Math.round(dims.centerX)}</span></div>
                  <div>Center Y: <span className="font-mono text-slate-900 dark:text-white">{Math.round(dims.centerY)}</span></div>
               </div>
            </div>

            {dims.isImage && dims.originalRes && (
               <div className="col-span-2 pt-2 mt-1 border-t border-slate-200 dark:border-[#222]">
                  <div className="grid gap-1 text-[10px] text-slate-500 dark:text-[#8A8A8A]">
                     <div>Image Resolution: <span className="font-mono text-slate-900 dark:text-white">{dims.originalRes.w} × {dims.originalRes.h} px</span></div>
                     <div>Displayed Size: <span className="font-mono text-slate-900 dark:text-white">{Math.round(dims.scaledWidth)} × {Math.round(dims.scaledHeight)} px</span></div>
                  </div>
               </div>
            )}

            {dims.isVector && (
               <div className="col-span-2 pt-2 mt-1 border-t border-slate-200 dark:border-[#222]">
                  <div className="grid gap-1 text-[10px] text-slate-500 dark:text-[#8A8A8A]">
                     <div>Geometry Width: <span className="font-mono text-slate-900 dark:text-white">{Math.round(dims.width)} px</span></div>
                     <div>Geometry Height: <span className="font-mono text-slate-900 dark:text-white">{Math.round(dims.height)} px</span></div>
                  </div>
               </div>
            )}

         </div>
      </div>
   );
};


