import React from 'react';
import { 
  MousePointer2, Move, Crop, Brush, Eraser, Type, Square, Circle, Triangle, Minus,
  SquareDashed, PenTool
} from 'lucide-react';
import { useTool } from '../../contexts/ToolContext';
import { useCanvas } from '../../contexts/CanvasContext';
import { ToolBtn } from '../shared/ToolBtn';
import { ColorPickerTrigger } from '../shared/ColorPickers';

export const LeftToolbar: React.FC = () => {
  const { activeTool, setTool, brushColor, changeCurrentColor, bgColor, changeBgColor, swapColors } = useTool();
  const { enterCropMode, addText, addRect, addCircle, addTriangle, addLine, activeSelectionTool, setActiveSelectionTool } = useCanvas();

  return (
    <div className="hidden md:flex w-14 border-r border-slate-200 dark:border-[#2C2C2C] bg-white dark:bg-[#1E1E1E] flex flex-col items-center py-4 gap-2 z-10 shrink-0 shadow-sm dark:shadow-[4px_0_12px_rgba(0,0,0,0.1)]">
        <ToolBtn icon={MousePointer2} tool="select" current={activeTool} set={setTool} title="Move (V)"/>
        <ToolBtn icon={Move} tool="pan" current={activeTool} set={setTool} title="Pan Canvas (H / Hold Space)"/>
        <ToolBtn icon={Crop} tool="crop" current={activeTool} set={() => enterCropMode()} title="Crop Image (C)"/>
        <ToolBtn icon={Brush} tool="brush" current={activeTool} set={setTool} title="Brush (B)"/>
        <ToolBtn icon={Eraser} tool="eraser" current={activeTool} set={setTool} title="Eraser (E)"/>
        
        <div className="w-8 h-px bg-slate-200 dark:bg-[#3A3A3A] my-2" />

        {/* Region selection. These arm a drawing mode rather than creating an object, so they
            track activeSelectionTool instead of the shared activeTool. */}
        <ToolBtn
          icon={SquareDashed}
          tool="sel-rect"
          current={activeSelectionTool || ''}
          set={() => setActiveSelectionTool?.(activeSelectionTool === 'sel-rect' ? null : 'sel-rect')}
          title="Rectangular Select"
        />
        <ToolBtn
          icon={Circle}
          tool="sel-ellipse"
          current={activeSelectionTool || ''}
          set={() => setActiveSelectionTool?.(activeSelectionTool === 'sel-ellipse' ? null : 'sel-ellipse')}
          title="Elliptical Select"
        />
        <ToolBtn
          icon={PenTool}
          tool="sel-pen"
          current={activeSelectionTool || ''}
          set={() => setActiveSelectionTool?.(activeSelectionTool === 'sel-pen' ? null : 'sel-pen')}
          title="Pen Select (Alt+Enter to close)"
        />

        <div className="w-8 h-px bg-slate-200 dark:bg-[#3A3A3A] my-2" />

        <ToolBtn icon={Type} tool="text" current={activeTool} set={addText} title="Text (T)"/>
        <ToolBtn icon={Square} tool="rect" current={activeTool} set={addRect} title="Rectangle"/>
        <ToolBtn icon={Circle} tool="circle" current={activeTool} set={addCircle} title="Ellipse (Circle)"/>
        <ToolBtn icon={Triangle} tool="triangle" current={activeTool} set={addTriangle} title="Triangle"/>
        <ToolBtn icon={Minus} tool="line" current={activeTool} set={addLine} title="Line"/>
        
        <div className="flex-1" />

        {/* ── Photoshop-style Foreground / Background color swatches ── */}
        <div className="relative" style={{ width: 38, height: 38 }}>
           {/* Background swatch (behind, offset to bottom-right) */}
           <div
              className="absolute bottom-0 right-0 w-[24px] h-[24px] rounded-[4px] border border-slate-400 dark:border-white/30 shadow-inner overflow-hidden"
              style={{ backgroundColor: bgColor }}
              title="Background Color (Alt+Delete to fill)"
           >
              <ColorPickerTrigger
                 color={bgColor}
                 onChange={changeBgColor}
                 className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                 label="Background Color"
              />
           </div>

           {/* Foreground swatch (in front, offset to top-left) */}
           <div
              className="absolute top-0 left-0 w-[24px] h-[24px] rounded-[4px] border-2 border-white dark:border-zinc-300 shadow-md overflow-hidden z-[1]"
              style={{ backgroundColor: brushColor }}
              title="Foreground Color (Ctrl+Delete to fill)"
           >
              <ColorPickerTrigger
                 color={brushColor}
                 onChange={changeCurrentColor}
                 className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                 label="Foreground Color"
              />
           </div>

           {/* Swap button (X) — top-right corner */}
           <button
              type="button"
              onClick={swapColors}
              className="absolute -top-1 -right-1 z-[2] flex items-center justify-center w-[14px] h-[14px] rounded-full bg-zinc-700 dark:bg-zinc-600 border border-zinc-500 dark:border-zinc-400 text-[8px] font-bold text-white hover:bg-zinc-500 dark:hover:bg-zinc-400 hover:text-white transition-all active:scale-90 shadow-sm"
              title="Swap Foreground & Background (X)"
           >
              ⇄
           </button>

           {/* Reset to defaults (D) — bottom-left corner */}
           <button
              type="button"
              onClick={() => {
                 changeCurrentColor('#000000');
                 changeBgColor('#ffffff');
              }}
              className="absolute -bottom-1 -left-1 z-[2] flex items-center justify-center w-[14px] h-[14px] rounded-full bg-zinc-700 dark:bg-zinc-600 border border-zinc-500 dark:border-zinc-400 hover:bg-zinc-500 dark:hover:bg-zinc-400 transition-all active:scale-90 shadow-sm overflow-hidden"
              title="Reset to Default Colors (D)"
           >
              {/* Mini fg/bg preview icon */}
              <span className="block w-full h-full relative">
                 <span className="absolute top-0 left-0 w-[7px] h-[7px] bg-black rounded-[1px]" />
                 <span className="absolute bottom-0 right-0 w-[7px] h-[7px] bg-white rounded-[1px]" />
              </span>
           </button>
        </div>
     </div>
  );
};
