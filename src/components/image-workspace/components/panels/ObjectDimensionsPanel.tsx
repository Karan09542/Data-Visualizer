import React, { useState, useEffect, useCallback } from "react";
import * as fabric from "fabric";
import { Ruler, Lock, Unlock, RotateCcw } from "lucide-react";
import { PanelSection, Label } from "../shared/PanelPrimitives";

/** Compact numeric field with the axis letter sitting inside the control, Figma-style. */
const NumField: React.FC<{
   axis: string;
   value: number;
   onChange: (v: number) => void;
   suffix?: string;
   accent?: boolean;
   title?: string;
}> = ({ axis, value, onChange, suffix, accent, title }) => (
   <label
      title={title}
      className={`flex items-center h-8 rounded-lg border transition-colors cursor-text ${accent
         ? 'bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40 focus-within:border-blue-500'
         : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 focus-within:border-blue-500'}`}
   >
      <span className={`w-6 shrink-0 text-center text-[10px] font-bold uppercase select-none ${accent
         ? 'text-blue-600 dark:text-blue-400'
         : 'text-slate-400 dark:text-zinc-500'}`}
      >
         {axis}
      </span>
      <input
         type="number"
         value={Number.isFinite(value) ? Math.round(value) : 0}
         onChange={(e) => onChange(Number(e.target.value))}
         className="w-full min-w-0 bg-transparent text-[11px] font-mono text-slate-800 dark:text-white outline-none"
      />
      {suffix && <span className="pr-2 pl-1 text-[10px] text-slate-400 dark:text-zinc-500 select-none">{suffix}</span>}
   </label>
);

const Metric: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
   <div className="flex items-baseline justify-between gap-2 min-w-0">
      <span className="text-[10px] text-slate-500 dark:text-zinc-500 truncate">{label}</span>
      <span className="text-[10px] font-mono text-slate-800 dark:text-white shrink-0">{value}</span>
   </div>
);

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
         // A zero-height object has no aspect to preserve; dividing by it produced NaN scales
         // that silently made the object vanish.
         const aspect = dims.scaledHeight ? dims.scaledWidth / dims.scaledHeight : 0;
         if (aspect) {
            if (updates.scaledWidth !== undefined && updates.scaledHeight === undefined) {
               updates.scaledHeight = updates.scaledWidth / aspect;
            } else if (updates.scaledHeight !== undefined && updates.scaledWidth === undefined) {
               updates.scaledWidth = updates.scaledHeight * aspect;
            }
         }
      }

      if (updates.scaledWidth !== undefined && dims.width) {
         active.set('scaleX', updates.scaledWidth / dims.width);
      }
      if (updates.scaledHeight !== undefined && dims.height) {
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

   const isScaled = Math.round(dims.scaleX * 100) !== 100 || Math.round(dims.scaleY * 100) !== 100;

   return (
      <PanelSection title="Dimensions" icon={<Ruler size={14} className="text-slate-500 dark:text-zinc-400" />}>
         <div>
            <Label>Position</Label>
            <div className="grid grid-cols-2 gap-2">
               <NumField axis="X" value={dims.x} onChange={(v) => updateObject({ x: v })} title="Horizontal position" />
               <NumField axis="Y" value={dims.y} onChange={(v) => updateObject({ y: v })} title="Vertical position" />
            </div>
         </div>

         <div>
            <div className="flex items-center justify-between mb-1.5">
               <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-zinc-500">Size</span>
               <button
                  type="button"
                  onClick={() => setLockedRatio(!lockedRatio)}
                  title={lockedRatio ? 'Aspect ratio locked - width and height change together' : 'Aspect ratio unlocked - resize each axis freely'}
                  aria-pressed={lockedRatio}
                  className={`flex items-center gap-1 h-5 px-1.5 rounded text-[9px] font-bold uppercase tracking-wider border transition-colors ${lockedRatio
                     ? 'bg-blue-50 dark:bg-blue-500/15 border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-300'
                     : 'bg-transparent border-slate-200 dark:border-white/10 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300'}`}
               >
                  {lockedRatio ? <Lock size={9} /> : <Unlock size={9} />}
                  Ratio
               </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
               <NumField axis="W" accent value={dims.scaledWidth} onChange={(v) => updateObject({ scaledWidth: v })} suffix="px" title="Rendered width" />
               <NumField axis="H" accent value={dims.scaledHeight} onChange={(v) => updateObject({ scaledHeight: v })} suffix="px" title="Rendered height" />
            </div>
         </div>

         <div>
            <div className="flex items-center justify-between mb-1.5">
               <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-zinc-500">Transform</span>
               {isScaled && (
                  <button
                     type="button"
                     onClick={resetScale}
                     title="Return to 100% scale"
                     className="flex items-center gap-1 h-5 px-1.5 rounded text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-white/10 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/25 active:scale-95 transition-all"
                  >
                     <RotateCcw size={9} /> Reset
                  </button>
               )}
            </div>
            <div className="grid grid-cols-3 gap-2">
               <NumField axis="SX" value={dims.scaleX * 100} onChange={(v) => updateObject({ scaleX: v / 100 })} suffix="%" title="Horizontal scale" />
               <NumField axis="SY" value={dims.scaleY * 100} onChange={(v) => updateObject({ scaleY: v / 100 })} suffix="%" title="Vertical scale" />
               <NumField axis="R" value={dims.rotation} onChange={(v) => updateObject({ rotation: v })} suffix="°" title="Rotation" />
            </div>
         </div>

         <div>
            <Label>Base Geometry</Label>
            <div className="grid grid-cols-2 gap-2">
               <NumField axis="W" value={dims.width} onChange={(v) => updateObject({ width: v })} suffix="px" title="Unscaled width" />
               <NumField axis="H" value={dims.height} onChange={(v) => updateObject({ height: v })} suffix="px" title="Unscaled height" />
            </div>
         </div>

         <div className="pt-3 border-t border-slate-200 dark:border-white/5 grid grid-cols-2 gap-x-4 gap-y-1.5">
            <Metric label="BBox W" value={Math.round(dims.bboxW)} />
            <Metric label="BBox H" value={Math.round(dims.bboxH)} />
            <Metric label="Center X" value={Math.round(dims.centerX)} />
            <Metric label="Center Y" value={Math.round(dims.centerY)} />
         </div>

         {dims.isImage && dims.originalRes && (
            <div className="pt-3 border-t border-slate-200 dark:border-white/5 space-y-1.5">
               <Metric label="Source resolution" value={`${dims.originalRes.w} x ${dims.originalRes.h} px`} />
               <Metric label="Displayed size" value={`${Math.round(dims.scaledWidth)} x ${Math.round(dims.scaledHeight)} px`} />
            </div>
         )}
      </PanelSection>
   );
};
