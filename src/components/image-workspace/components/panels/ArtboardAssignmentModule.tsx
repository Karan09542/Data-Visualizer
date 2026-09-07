import React from 'react';
import * as fabric from 'fabric';
import {
   SquareDashed, AlignStartVertical, AlignCenterVertical, AlignEndVertical,
   AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, Anchor
} from 'lucide-react';
import { useCanvas } from '../../contexts/CanvasContext';
import { useSelection } from '../../contexts/SelectionContext';
import { useWorkspaceUI } from '../../contexts/WorkspaceUIContext';

export const ArtboardAssignmentModule: React.FC = () => {
   const { alignSelection } = useCanvas();
   const { selectionType, parentAlignmentObj, setParentAlignmentObj, activeObjs } = useSelection();
   const { nudgeStep, setNudgeStep, nudgeStepLarge, setNudgeStepLarge } = useWorkspaceUI();

   const labelFor = (obj: fabric.Object, i: number) =>
      (obj as any).customName
      || ((obj as any).text ? `"${String((obj as any).text).slice(0, 10)}"` : null)
      || `${obj.type} ${i + 1}`;

   return (
      <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-[#2C2C2C] mb-4">
         <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-[#A0A0A0] flex items-center gap-2">
            <span className="flex items-center gap-2">
               <SquareDashed size={12} /> Alignment & Spacing
               {parentAlignmentObj && (
                  <span className="text-[8px] bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 px-1.5 py-0.5 rounded uppercase font-bold tracking-tight">
                     KEY OBJECT ACTIVE
                  </span>
               )}
            </span>
         </div>

         {/* Key Object Alignment Helper text */}
         {/* selectionType is fabric's own `type` string, lowercased since v6 */}
         {selectionType === 'activeselection' && (
            <div className="p-2.5 rounded-lg bg-blue-50/80 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-500/10 text-[10px] text-slate-600 dark:text-[#A0A0A0] space-y-1.5 my-2">
               <div className="flex justify-between items-center text-slate-900 dark:text-white text-xs font-semibold">
                  <span>Key Object (Parent Alignment)</span>
                  {parentAlignmentObj ? (
                     <button
                        onClick={() => setParentAlignmentObj(null)}
                        className="text-[9px] text-slate-500 dark:text-[#A0A0A0] hover:text-slate-900 dark:hover:text-white underline font-normal bg-transparent border-0 cursor-pointer"
                     >
                        Clear Parent
                     </button>
                  ) : null}
               </div>
               <p className="text-slate-500 dark:text-[#8A8A8A]">
                  {parentAlignmentObj
                     ? 'Everything else in the selection aligns to the parent. Tap it again to clear.'
                     : 'Tap an object below to make it the parent - the rest of the selection aligns to it.'}
               </p>

               {/* Tap picker. The Ctrl+Shift+click gesture does the same thing, but needs a
                   keyboard, so this is the only route on touch. */}
               <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {activeObjs.map((obj, i) => {
                     const isParent = parentAlignmentObj === obj;
                     return (
                        <button
                           key={(obj as any).id || i}
                           type="button"
                           onClick={() => setParentAlignmentObj(isParent ? null : obj)}
                           aria-pressed={isParent}
                           title={isParent ? 'Clear parent' : 'Use as parent'}
                           className={`min-h-[32px] px-2.5 py-1 rounded-md text-[10px] font-semibold capitalize flex items-center gap-1.5 border transition-colors ${
                              isParent
                                 ? 'bg-blue-600 border-blue-400 text-white'
                                 : 'bg-white dark:bg-[#1C1C1C] border-slate-200 dark:border-[#333] text-slate-600 dark:text-[#B0B0B0] hover:border-blue-400 dark:hover:border-blue-500/60 active:bg-blue-50 dark:active:bg-blue-950/40'
                           }`}
                        >
                           {isParent && <Anchor size={11} strokeWidth={2.5} />}
                           <span className="truncate max-w-[92px]">{labelFor(obj, i)}</span>
                        </button>
                     );
                  })}
               </div>

               <p className="text-[9px] text-slate-400 dark:text-[#6A6A6A] pt-0.5">
                  On a keyboard: <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-[#2C2C2C] text-slate-800 dark:text-white rounded font-mono text-[9px]">Ctrl / ⌘</kbd> + <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-[#2C2C2C] text-slate-800 dark:text-white rounded font-mono text-[9px]">Shift</kbd> + click a selected object.
               </p>
            </div>
         )}

         {/* Quick alignment buttons targeting assigned or closest artboard */}
         <div className="space-y-3">
            <div className="flex flex-col gap-1.5">
               <div className="text-[10px] text-slate-500 dark:text-[#A0A0A0] flex justify-between items-center">
                  <span>Snap Alignment ({parentAlignmentObj ? "Key Object" : "Artboard"})</span>
                  <span className="text-[9px] bg-blue-100 dark:bg-[#1a2e3b] text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter">{parentAlignmentObj ? "Parent" : "Artboard"}</span>
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
                        className="h-8 bg-slate-100 dark:bg-[#282828] hover:bg-slate-200 dark:hover:bg-[#323232] text-slate-700 dark:text-white rounded transition flex items-center justify-center border border-slate-200 dark:border-transparent hover:border-slate-300 dark:hover:border-[#444] shadow-sm"
                        title={btn.title}
                     >
                        {btn.icon}
                     </button>
                  ))}
               </div>
            </div>

            <div className="flex flex-col gap-1.5">
               <div className="text-[10px] text-slate-500 dark:text-[#A0A0A0] flex justify-between items-center">
                  <span>{parentAlignmentObj ? 'Sizing (Key Object)' : 'Fitting, Sizing & Spacing'}</span>
               </div>

               {parentAlignmentObj ? (
                  // With a key object set, every one of these resolves against the parent, so the
                  // artboard-labelled actions below would be lying about what they do. Clear the
                  // parent to get them back.
                  <div className="grid grid-cols-2 gap-1">
                     {[
                        { action: 'utils_fitInside', label: 'Fit inside Parent', title: 'Scale each other object down to fit inside the parent, and centre it there' },
                        { action: 'utils_centerInside', label: 'Center in Parent', title: 'Centre each other object on the parent without resizing' },
                     ].map(btn => (
                        <button
                           key={btn.action}
                           onClick={() => alignSelection(btn.action as any)}
                           title={btn.title}
                           className="h-8 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-[10px] font-semibold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/30 rounded transition flex items-center justify-center px-2"
                        >
                           {btn.label}
                        </button>
                     ))}

                     <div className="col-span-2 pt-1.5 mt-0.5 border-t border-slate-200 dark:border-white/5">
                        <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 dark:text-[#7A7A7A] block mb-1">
                           Match Parent Size <span className="font-normal normal-case tracking-normal">- resizes in place, nothing moves</span>
                        </span>
                        <div className="grid grid-cols-3 gap-1">
                           {[
                              { action: 'matchSizeWidth', label: 'Width', title: "Set every other object's width to the parent's, keeping it where it is" },
                              { action: 'matchSizeHeight', label: 'Height', title: "Set every other object's height to the parent's, keeping it where it is" },
                              { action: 'matchSizeBoth', label: 'Both', title: "Set every other object's width and height to the parent's, keeping it where it is" },
                           ].map(btn => (
                              <button
                                 key={btn.action}
                                 onClick={() => alignSelection(btn.action as any)}
                                 title={btn.title}
                                 className="h-8 bg-blue-50/60 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-900/35 text-[10px] font-semibold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40 rounded transition flex items-center justify-center px-2"
                              >
                                 {btn.label}
                              </button>
                           ))}
                        </div>
                     </div>
                  </div>
               ) : (
                  <div className="grid grid-cols-2 gap-1">
                     {[
                        { action: 'fit', label: 'Fit to Artboard' },
                        { action: 'fill', label: 'Fill Artboard' },
                        { action: 'fitWidth', label: 'Fit Width' },
                        { action: 'fitHeight', label: 'Fit Height' }
                     ].map(btn => (
                        <button
                           key={btn.action}
                           onClick={() => alignSelection(btn.action as any)}
                           className="h-8 bg-slate-100 dark:bg-[#282828] hover:bg-slate-200 dark:hover:bg-[#323232] text-[10px] font-medium text-slate-700 dark:text-white rounded transition flex items-center justify-center gap-1.5 px-2 border border-slate-200 dark:border-transparent hover:border-slate-300 dark:hover:border-[#444] shadow-sm"
                        >
                           {btn.label}
                        </button>
                     ))}
                     <button
                        onClick={() => alignSelection('center')}
                        className="h-8 bg-slate-100 dark:bg-[#282828] hover:bg-slate-200 dark:hover:bg-[#323232] text-[10px] font-medium text-slate-700 dark:text-white rounded transition flex items-center justify-center gap-1.5 px-2 col-span-2 border border-slate-200 dark:border-transparent hover:border-slate-300 dark:hover:border-[#444] shadow-sm"
                     >
                        Center Selection
                     </button>
                  </div>
               )}
            </div>
         </div>

         {/* Arrow-key nudge distances */}
         <div className="pt-3 border-t border-slate-200 dark:border-white/5">
            <div className="flex items-baseline justify-between mb-1.5">
               <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-[#A0A0A0]">Arrow Key Nudge</span>
               <span className="text-[9px] text-slate-400 dark:text-[#6A6A6A]">per press</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
               <label className="flex items-center h-9 rounded-lg border bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 focus-within:border-blue-500 transition-colors cursor-text">
                  <span className="w-14 shrink-0 text-center text-[9px] font-bold uppercase text-slate-400 dark:text-zinc-500 select-none">Arrow</span>
                  <input
                     type="number" min="0.1" step="0.1"
                     value={nudgeStep}
                     onChange={(e) => setNudgeStep(Math.max(0.1, Number(e.target.value) || 0.1))}
                     title="Distance moved by a single arrow key press"
                     className="w-full min-w-0 bg-transparent text-[11px] font-mono text-slate-800 dark:text-white outline-none"
                  />
                  <span className="pr-2 text-[10px] text-slate-400 dark:text-zinc-500 select-none">px</span>
               </label>
               <label className="flex items-center h-9 rounded-lg border bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 focus-within:border-blue-500 transition-colors cursor-text">
                  <span className="w-14 shrink-0 text-center text-[9px] font-bold uppercase text-slate-400 dark:text-zinc-500 select-none">+ Shift</span>
                  <input
                     type="number" min="0.1" step="0.1"
                     value={nudgeStepLarge}
                     onChange={(e) => setNudgeStepLarge(Math.max(0.1, Number(e.target.value) || 0.1))}
                     title="Distance moved when Shift is held"
                     className="w-full min-w-0 bg-transparent text-[11px] font-mono text-slate-800 dark:text-white outline-none"
                  />
                  <span className="pr-2 text-[10px] text-slate-400 dark:text-zinc-500 select-none">px</span>
               </label>
            </div>
         </div>

      </div>
   );
};
