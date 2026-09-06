import React from 'react';
import { 
  MousePointer2, Move, Crop, Brush, Eraser, Type, Square, Circle, Triangle, Minus
} from 'lucide-react';
import { useTool } from '../../contexts/ToolContext';
import { useCanvas } from '../../contexts/CanvasContext';
import { ToolBtn } from '../shared/ToolBtn';
import { ColorPickerTrigger } from '../shared/ColorPickers';

export const LeftToolbar: React.FC = () => {
  const { activeTool, setTool, brushColor, changeCurrentColor } = useTool();
  const { enterCropMode, addText, addRect, addCircle, addTriangle, addLine } = useCanvas();

  return (
    <div className="hidden md:flex w-14 border-r border-slate-200 dark:border-[#2C2C2C] bg-white dark:bg-[#1E1E1E] flex flex-col items-center py-4 gap-2 z-10 shrink-0 shadow-sm dark:shadow-[4px_0_12px_rgba(0,0,0,0.1)]">
        <ToolBtn icon={MousePointer2} tool="select" current={activeTool} set={setTool} title="Move (V)"/>
        <ToolBtn icon={Move} tool="pan" current={activeTool} set={setTool} title="Pan Canvas (H / Hold Space)"/>
        <ToolBtn icon={Crop} tool="crop" current={activeTool} set={() => enterCropMode()} title="Crop Image (C)"/>
        <ToolBtn icon={Brush} tool="brush" current={activeTool} set={setTool} title="Brush (B)"/>
        <ToolBtn icon={Eraser} tool="eraser" current={activeTool} set={setTool} title="Eraser (E)"/>
        
        <div className="w-8 h-px bg-slate-200 dark:bg-[#3A3A3A] my-2" />
        
        <ToolBtn icon={Type} tool="text" current={activeTool} set={addText} title="Text (T)"/>
        <ToolBtn icon={Square} tool="rect" current={activeTool} set={addRect} title="Rectangle"/>
        <ToolBtn icon={Circle} tool="circle" current={activeTool} set={addCircle} title="Ellipse (Circle)"/>
        <ToolBtn icon={Triangle} tool="triangle" current={activeTool} set={addTriangle} title="Triangle"/>
        <ToolBtn icon={Minus} tool="line" current={activeTool} set={addLine} title="Line"/>
        
        <div className="flex-1" />

        <div className="relative">
            <ColorPickerTrigger 
               color={brushColor} 
               onChange={changeCurrentColor} 
               className="w-8 h-8 rounded-full border-2 border-slate-300 dark:border-white/20 shadow-inner relative overflow-hidden"
               label="Brush Color"
            />
         </div>
     </div>
  );
};
