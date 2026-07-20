import React, { useRef, useEffect } from 'react';
import * as fabric from 'fabric';
import {
   SquareDashed, AlignStartVertical, AlignCenterVertical, AlignEndVertical,
   AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal
} from 'lucide-react';
import { useCanvas } from '../../contexts/CanvasContext';
import { useSelection } from '../../contexts/SelectionContext';

export const ArtboardAssignmentModule: React.FC = () => {
   const { fabricRef, alignSelection } = useCanvas();
   const { selectionType, parentAlignmentObj, setParentAlignmentObj } = useSelection();

   // Create local ref to solve parentAlignmentObjRef issue
   const parentAlignmentObjRef = useRef(parentAlignmentObj);
   useEffect(() => {
      parentAlignmentObjRef.current = parentAlignmentObj;
   }, [parentAlignmentObj]);

   return (
      <div className="space-y-3 pt-4 border-t border-[#2C2C2C] mb-4">
         <div className="text-[10px] uppercase font-bold tracking-wider text-[#A0A0A0] flex items-center gap-2">
            <span className="flex items-center gap-2">
               <SquareDashed size={12} /> Alignment & Spacing
               {parentAlignmentObj && (
                  <span className="text-[8px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded uppercase font-bold tracking-tight">
                     KEY OBJECT ACTIVE
                  </span>
               )}
            </span>
         </div>

         {/* Key Object Alignment Helper text */}
         {selectionType === 'activeSelection' && (
            <div className="p-2.5 rounded-lg bg-blue-950/20 border border-blue-500/10 text-[10px] text-[#A0A0A0] space-y-1.5 my-2">
               <div className="flex justify-between items-center text-white text-xs font-semibold">
                  <span>Key Object (Parent Alignment)</span>
                  {parentAlignmentObj ? (
                     <button
                        onClick={() => {
                           parentAlignmentObjRef.current = null;
                           setParentAlignmentObj(null);
                           if (fabricRef.current) fabricRef.current.requestRenderAll();
                        }}
                        className="text-[9px] text-[#A0A0A0] hover:text-white underline font-normal bg-transparent border-0 cursor-pointer"
                     >
                        Clear Parent
                     </button>
                  ) : null}
               </div>
               {parentAlignmentObj ? (
                  <p className="text-blue-300 font-mono">
                     Using <span className="font-bold underline text-white">{(parentAlignmentObj as any).name || (parentAlignmentObj as any).type || "object"}</span> as Parent
                  </p>
               ) : (
                  <p className="text-[#8A8A8A]">
                     Pro Tip: Hold <kbd className="px-1 py-0.5 bg-[#2C2C2C] text-white rounded font-mono text-[9px]">Ctrl / ⌘</kbd> and click any selected item to designate it as the **Parent Container**.
                  </p>
               )}
            </div>
         )}

         {/* Quick alignment buttons targeting assigned or closest artboard */}
         <div className="space-y-3">
            <div className="flex flex-col gap-1.5">
               <div className="text-[10px] text-[#A0A0A0] flex justify-between items-center">
                  <span>Snap Alignment ({parentAlignmentObj ? "Key Object" : "Artboard"})</span>
                  <span className="text-[9px] bg-[#1a2e3b] text-blue-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter">{parentAlignmentObj ? "Parent" : "Artboard"}</span>
               </div>
               <div className="grid grid-cols-3 gap-1">
                  {[
                     { action: 'left', title: 'Align Left', icon: <AlignStartVertical size={14} /> },
                     { action: 'centerH', title: 'Align Center Horizontal', icon: <AlignCenterVertical size={14} /> },
                     { action: 'right', title: 'Align Right', icon: <AlignEndVertical size={14} /> },
                     { action: 'top', title: 'Align Top', icon: <AlignStartHorizontal size={14} /> },
                     { action: 'centerV', title: 'Align Center Vertical', icon: <AlignCenterHorizontal size={14} /> },
                     { action: 'bottom', title: 'Align Bottom', icon: <AlignEndHorizontal size={14} /> },
                  ].map((btn) => (
                     <button
                        key={btn.action}
                        onClick={() => alignSelection(btn.action as any)}
                        className="h-8 bg-[#282828] hover:bg-[#323232] text-white rounded transition flex items-center justify-center border border-transparent hover:border-[#444]"
                        title={btn.title}
                     >
                        {btn.icon}
                     </button>
                  ))}
               </div>
            </div>

            <div className="flex flex-col gap-1.5">
               <div className="text-[10px] text-[#A0A0A0] flex justify-between items-center">
                  <span>Fitting, Sizing & Spacing</span>
               </div>
               <div className="grid grid-cols-2 gap-1">

                  {parentAlignmentObj && (
                     <>
                        {[
                           { action: 'utils_fitInside', title: 'Fit Children Inside Parent', label: 'Fit inside Parent', classes: 'bg-blue-950/40 hover:bg-blue-900/50 text-[10px] text-blue-300 rounded transition flex items-center justify-center gap-1.5 px-2 border border-blue-900/30 font-semibold' },
                           { action: 'utils_centerInside', title: 'Center Children Inside Parent', label: 'Center in Parent', classes: 'bg-blue-950/40 hover:bg-blue-900/50 text-[10px] text-blue-300 rounded transition flex items-center justify-center gap-1.5 px-2 border border-blue-900/30 font-semibold' },
                           { action: 'matchWidth', title: 'Match Parent Width', label: 'Match Width', classes: 'bg-blue-950/20 hover:bg-blue-900/35 text-[10px] text-blue-300 border border-blue-900/40 rounded transition flex items-center justify-center gap-1.5 px-2' },
                           { action: 'matchHeight', title: 'Match Parent Height', label: 'Match Height', classes: 'bg-blue-950/20 hover:bg-blue-900/35 text-[10px] text-blue-300 border border-blue-900/40 rounded transition flex items-center justify-center gap-1.5 px-2' },
                        ].map(btn => (
                           <button key={btn.action} onClick={() => alignSelection(btn.action as any)} className={`h-8 ${btn.classes}`} title={btn.title}>{btn.label}</button>
                        ))}
                     </>
                  )}

                  {[
                     { action: 'fit', label: 'Fit to Artboard' },
                     { action: 'fill', label: 'Fill Artboard' },
                     { action: 'fitWidth', label: 'Fit Width' },
                     { action: 'fitHeight', label: 'Fit Height' }
                  ].map(btn => (
                     <button key={btn.action} onClick={() => alignSelection(btn.action as any)} className="h-8 bg-[#282828] hover:bg-[#323232] text-[10px] text-white rounded transition flex items-center justify-center gap-1.5 px-2 border border-transparent hover:border-[#444]">{btn.label}</button>
                  ))}
                  <button onClick={() => alignSelection('center')} className="h-8 bg-[#282828] hover:bg-[#323232] text-[10px] text-white rounded transition flex items-center justify-center gap-1.5 px-2 col-span-2 font-mono border border-transparent hover:border-[#444]">Center Selection</button>
               </div>
            </div>
         </div>

      </div>
   );
};
