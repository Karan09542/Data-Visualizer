import React from 'react';
import * as fabric from 'fabric';
import { Type, RotateCw, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react';
import { useTool } from '../../contexts/ToolContext';
import { useCanvas } from '../../contexts/CanvasContext';
import { useHistory } from '../../contexts/HistoryContext';
import { FontPicker } from '../../../FontPicker';
import { TypographyPresets } from '../../../TypographyPresets';

export const TypographyPanel: React.FC = () => {
   const { textProps, setTextProps } = useTool();
   const { fabricRef, changeTextProp } = useCanvas();
   const { executeCommand } = useHistory();

   return (
      <div className="space-y-4 border-b border-[#2C2C2C] pb-5 animate-fade-in">
         <div className="flex items-center justify-between mb-1">
            <div className="text-[10px] uppercase font-bold tracking-widest text-[#A0A0A0] flex items-center gap-2">
               <Type size={12} /> Typography
            </div>
            <TypographyPresets onApplyPreset={(props) => {
               const activeObjs = fabricRef.current?.getActiveObjects();
               if (!activeObjs || activeObjs.length === 0) return;

               const beforeStates = activeObjs.map(o => {
                  const before: any = {};
                  Object.keys(props).forEach(key => {
                     before[key] = (o as any).get(key);
                  });
                  return { obj: o, before, after: { ...props } };
               });

               executeCommand({
                  name: "Apply Preset",
                  execute: (canvas) => {
                     activeObjs.forEach(o => {
                        if (props.shadow) o.shadow = new fabric.Shadow(props.shadow);
                        else if (props.shadow === null) o.shadow = null;
                        o.set(props);
                     });
                     canvas.requestRenderAll();
                  },
                  undo: (canvas) => {
                     beforeStates.forEach(s => {
                        if (s.before.shadow) s.obj.shadow = new fabric.Shadow(s.before.shadow);
                        else if (s.before.shadow === null) s.obj.shadow = null;
                        s.obj.set(s.before);
                     });
                     canvas.requestRenderAll();
                  },
                  redo: (canvas) => {
                     beforeStates.forEach(s => {
                        if (s.after.shadow) s.obj.shadow = new fabric.Shadow(s.after.shadow);
                        else if (s.after.shadow === null) s.obj.shadow = null;
                        s.obj.set(s.after);
                     });
                     canvas.requestRenderAll();
                  }
               });

               setTextProps((prev: any) => ({ ...prev, ...props }));
            }} />
         </div>

         <div className="bg-[#181818] border border-[#2c2c2c] rounded-lg p-2.5 space-y-3">
            
            {/* Font Family */}
            <div className="space-y-1">
               <label className="text-[9px] text-[#8A8A8A] font-semibold uppercase tracking-wider block">Font Family</label>
               <FontPicker
                  className="w-full text-xs"
                  value={textProps.fontFamily}
                  selectedText={textProps.textContent}
                  onHover={(val) => {
                     const activeObjs = fabricRef.current?.getActiveObjects();
                     if (!activeObjs) return;
                     activeObjs.forEach(o => {
                        if (o.type === 'i-text' || o.type === 'text' || o.type === 'textbox') {
                           const textObj = o as any;
                           if (val) {
                              textObj.set('fontFamily', val);
                           } else {
                              textObj.set('fontFamily', textProps.fontFamily);
                           }
                        }
                     });
                     fabricRef.current?.requestRenderAll();
                  }}
                  onChange={(val) => changeTextProp("fontFamily", val, "Change Font Family")}
               />
            </div>

            {/* Size & Weight */}
            <div className="grid grid-cols-2 gap-2">
               <div className="space-y-1">
                  <label className="text-[9px] text-[#8A8A8A] font-semibold uppercase tracking-wider block">Size</label>
                  <input
                     type="number"
                     className="w-full h-7 bg-[#121212] border border-[#333] rounded text-xs px-2 outline-none text-slate-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all font-mono"
                     value={textProps.fontSize}
                     onChange={(e) => {
                        const val = Math.max(1, Number(e.target.value));
                        changeTextProp("fontSize", val, "Change Font Size");
                     }}
                  />
               </div>
               <div className="space-y-1">
                  <label className="text-[9px] text-[#8A8A8A] font-semibold uppercase tracking-wider block">Weight</label>
                  <select
                     className="w-full h-7 bg-[#121212] border border-[#333] rounded text-xs px-1.5 outline-none text-slate-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all cursor-pointer"
                     value={textProps.fontWeight}
                     onChange={(e) => changeTextProp("fontWeight", e.target.value, "Change Font Weight")}
                  >
                     <option value="normal">Normal</option>
                     <option value="bold">Bold</option>
                     <option value="300">Light</option>
                     <option value="500">Medium</option>
                     <option value="700">Semibold</option>
                     <option value="900">Black</option>
                  </select>
               </div>
            </div>

            <hr className="border-[#2a2a2a]" />

            {/* Alignment and Style */}
            <div className="space-y-2">
               <div className="flex items-center gap-2">
                  <label className="text-[9px] text-[#8A8A8A] font-semibold uppercase tracking-wider w-10 shrink-0">Align</label>
                  <div className="flex-1 flex bg-[#121212] border border-[#333] rounded p-0.5 justify-between gap-0.5 shadow-inner">
                     <button
                        type="button"
                        className={`flex-1 h-6 flex items-center justify-center rounded-sm transition-all active:scale-95 ${textProps.textAlign === 'left' ? 'bg-blue-600 text-slate-900 dark:text-white shadow-sm' : 'text-[#8A8A8A] hover:text-slate-900 dark:text-white hover:bg-[#2A2A2A]'}`}
                        onClick={() => changeTextProp("textAlign", 'left', "Align Left")}
                        title="Align Left"
                     >
                        <AlignLeft size={12} strokeWidth={2.5} />
                     </button>
                     <button
                        type="button"
                        className={`flex-1 h-6 flex items-center justify-center rounded-sm transition-all active:scale-95 ${textProps.textAlign === 'center' ? 'bg-blue-600 text-slate-900 dark:text-white shadow-sm' : 'text-[#8A8A8A] hover:text-slate-900 dark:text-white hover:bg-[#2A2A2A]'}`}
                        onClick={() => changeTextProp("textAlign", 'center', "Align Center")}
                        title="Align Center"
                     >
                        <AlignCenter size={12} strokeWidth={2.5} />
                     </button>
                     <button
                        type="button"
                        className={`flex-1 h-6 flex items-center justify-center rounded-sm transition-all active:scale-95 ${textProps.textAlign === 'right' ? 'bg-blue-600 text-slate-900 dark:text-white shadow-sm' : 'text-[#8A8A8A] hover:text-slate-900 dark:text-white hover:bg-[#2A2A2A]'}`}
                        onClick={() => changeTextProp("textAlign", 'right', "Align Right")}
                        title="Align Right"
                     >
                        <AlignRight size={12} strokeWidth={2.5} />
                     </button>
                     <button
                        type="button"
                        className={`flex-1 h-6 flex items-center justify-center rounded-sm transition-all active:scale-95 ${textProps.textAlign === 'justify' ? 'bg-blue-600 text-slate-900 dark:text-white shadow-sm' : 'text-[#8A8A8A] hover:text-slate-900 dark:text-white hover:bg-[#2A2A2A]'}`}
                        onClick={() => changeTextProp("textAlign", 'justify', "Justify")}
                        title="Justify"
                     >
                        <AlignJustify size={12} strokeWidth={2.5} />
                     </button>
                  </div>
               </div>

               <div className="flex items-center gap-2">
                  <label className="text-[9px] text-[#8A8A8A] font-semibold uppercase tracking-wider w-10 shrink-0">Style</label>
                  <div className="flex-1 flex bg-[#121212] border border-[#333] rounded p-0.5 justify-between gap-0.5 shadow-inner">
                     <button
                        type="button"
                        className={`flex-1 h-6 flex items-center justify-center rounded-sm transition-all active:scale-95 ${textProps.fontWeight === 'bold' || textProps.fontWeight === '700' || textProps.fontWeight === '900' ? 'bg-blue-600 text-slate-900 dark:text-white shadow-sm' : 'text-[#8A8A8A] hover:text-slate-900 dark:text-white hover:bg-[#2A2A2A]'}`}
                        onClick={() => changeTextProp("fontWeight", (textProps.fontWeight === 'bold' || textProps.fontWeight === '700' || textProps.fontWeight === '900') ? 'normal' : 'bold', "Toggle Bold")}
                        title="Bold"
                     >
                        <Bold size={12} strokeWidth={3} />
                     </button>
                     <button
                        type="button"
                        className={`flex-1 h-6 flex items-center justify-center rounded-sm transition-all active:scale-95 ${textProps.fontStyle === 'italic' ? 'bg-blue-600 text-slate-900 dark:text-white shadow-sm' : 'text-[#8A8A8A] hover:text-slate-900 dark:text-white hover:bg-[#2A2A2A]'}`}
                        onClick={() => changeTextProp("fontStyle", textProps.fontStyle === 'italic' ? 'normal' : 'italic', "Toggle Italic")}
                        title="Italic"
                     >
                        <Italic size={12} strokeWidth={3} />
                     </button>
                     <button
                        type="button"
                        className={`flex-1 h-6 flex items-center justify-center rounded-sm transition-all active:scale-95 ${textProps.underline ? 'bg-blue-600 text-slate-900 dark:text-white shadow-sm' : 'text-[#8A8A8A] hover:text-slate-900 dark:text-white hover:bg-[#2A2A2A]'}`}
                        onClick={() => changeTextProp("underline", !textProps.underline, "Toggle Underline")}
                        title="Underline"
                     >
                        <Underline size={12} strokeWidth={2.5} />
                     </button>
                     <button
                        type="button"
                        className={`flex-1 h-6 flex items-center justify-center rounded-sm transition-all font-bold active:scale-95 text-[10px] ${textProps.overline ? 'bg-blue-600 text-slate-900 dark:text-white shadow-sm' : 'text-[#8A8A8A] hover:text-slate-900 dark:text-white hover:bg-[#2A2A2A]'}`}
                        onClick={() => changeTextProp("overline", !textProps.overline, "Toggle Overline")}
                        title="Overline"
                     >
                        O&#773;
                     </button>
                     <button
                        type="button"
                        className={`flex-1 h-6 flex items-center justify-center rounded-sm transition-all line-through active:scale-95 text-[10px] ${textProps.linethrough ? 'bg-blue-600 text-slate-900 dark:text-white shadow-sm font-semibold' : 'text-[#8A8A8A] hover:text-slate-900 dark:text-white hover:bg-[#2A2A2A]'}`}
                        onClick={() => changeTextProp("linethrough", !textProps.linethrough, "Toggle Strikethrough")}
                        title="Strikethrough"
                     >
                        S
                     </button>
                  </div>
               </div>
            </div>

            <hr className="border-[#2a2a2a]" />

            {/* Layout Options */}
            <div className="space-y-2">
               <div className="flex items-center gap-2">
                  <label className="text-[9px] text-[#8A8A8A] font-semibold uppercase tracking-wider w-10 shrink-0">Layout</label>
                  <div className="flex-1 flex bg-[#121212] border border-[#333] rounded p-0.5 gap-0.5 shadow-inner">
                     <button
                        type="button"
                        className={`flex-1 h-6 text-[9px] font-bold rounded-sm transition-all active:scale-95 ${textProps.angle === 0 ? 'bg-blue-600 text-slate-900 dark:text-white shadow-sm' : 'text-[#8A8A8A] hover:text-slate-900 dark:text-white hover:bg-[#2A2A2A]'}`}
                        onClick={() => changeTextProp("angle", 0, "Set Horizontal")}
                        title="Horizontal (0°)"
                     >
                        HORIZ
                     </button>
                     <button
                        type="button"
                        className={`flex-1 h-6 text-[9px] font-bold rounded-sm transition-all active:scale-95 ${textProps.angle === 90 ? 'bg-blue-600 text-slate-900 dark:text-white shadow-sm' : 'text-[#8A8A8A] hover:text-slate-900 dark:text-white hover:bg-[#2A2A2A]'}`}
                        onClick={() => changeTextProp("angle", 90, "Set Vertical Clockwise")}
                        title="Vertical CW (90°)"
                     >
                        VERT CW
                     </button>
                     <button
                        type="button"
                        className={`flex-1 h-6 text-[9px] font-bold rounded-sm transition-all active:scale-95 ${textProps.angle === 270 ? 'bg-blue-600 text-slate-900 dark:text-white shadow-sm' : 'text-[#8A8A8A] hover:text-slate-900 dark:text-white hover:bg-[#2A2A2A]'}`}
                        onClick={() => changeTextProp("angle", 270, "Set Vertical Counter-Clockwise")}
                        title="Vertical CCW (270°)"
                     >
                        VERT CCW
                     </button>
                  </div>
               </div>

               {/* Rotation */}
               <div className="space-y-1">
                  <div className="flex justify-between items-center text-[9px] text-[#A0A0A0]">
                     <span className="flex items-center gap-1 font-semibold"><RotateCw size={10} /> Angle</span>
                     <span className="font-mono text-slate-900 dark:text-white bg-[#121212] px-1.5 py-[1px] rounded border border-[#333]">{Math.round(textProps.angle || 0)}°</span>
                  </div>
                  <input
                     type="range"
                     min="0"
                     max="360"
                     step="1"
                     value={textProps.angle || 0}
                     onChange={(e) => {
                        const val = Number(e.target.value);
                        changeTextProp("angle", val, "Rotate Text");
                     }}
                     className="w-full h-1 bg-[#2C2C2C] rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
               </div>

               {/* Spacing */}
               <div className="space-y-1">
                  <div className="flex justify-between items-center text-[9px] text-[#A0A0A0]">
                     <span className="font-semibold">Letter Spacing</span>
                     <span className="font-mono text-slate-900 dark:text-white bg-[#121212] px-1.5 py-[1px] rounded border border-[#333]">{textProps.charSpacing}</span>
                  </div>
                  <input
                     type="range"
                     min="-100"
                     max="800"
                     step="5"
                     value={textProps.charSpacing}
                     onChange={(e) => {
                        const val = Number(e.target.value);
                        changeTextProp("charSpacing", val, "Change Letter Spacing");
                     }}
                     className="w-full h-1 bg-[#2C2C2C] rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
               </div>
            </div>
         </div>
      </div>
   );
};
