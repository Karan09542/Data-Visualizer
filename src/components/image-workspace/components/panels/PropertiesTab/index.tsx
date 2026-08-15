import React from 'react';
import * as fabric from 'fabric';
import {
   Brush, FlipHorizontal, FlipVertical, Move, SquareDashed, Layout, Square, Palette, MousePointer2, Copy, Trash2, Crop, RotateCcw, Settings,
   Droplets, Sparkles, Printer, Plus, Minus
} from 'lucide-react';
import { useTool } from '../../../contexts/ToolContext';
import { useCanvas } from '../../../contexts/CanvasContext';
import { useWorkspaceUI } from '../../../contexts/WorkspaceUIContext';
import { useSelection } from '../../../contexts/SelectionContext';
import { useCollageConfig } from '../../../hooks/useCollageConfig';
import { useShapeProperties } from '../../../hooks/useShapeProperties';
import { ObjectDimensionsPanel } from '../ObjectDimensionsPanel';
import { FilterSlider } from '../../shared/FilterSlider';
import { ColorPickerTrigger } from '../../shared/ColorPickers';
import { BrushPreview } from '../../shared/BrushPreview';
import { ModernCheckbox } from '../../shared/ModernCheckbox';
import { TypographyPanel } from '../TypographyPanel';
import { SmartCollageBlockCustomizationPanel } from '../SmartCollageBlockCustomizationPanel';
import { ArtboardAssignmentModule } from '../ArtboardAssignmentModule';
import { ModernSelect, SelectGroup } from '../../shared/ModernSelect';

const BRUSH_TYPE_GROUPS: SelectGroup[] = [
   {
      label: "Standard Brushes",
      options: [
         { value: "pencil", label: "Pencil" },
         { value: "brush", label: "Art Brush" },
         { value: "marker", label: "Permanent Marker" },
         { value: "highlighter", label: "Highlighter" },
      ]
   },
   {
      label: "Technical & Artistic",
      options: [
         { value: "ink", label: "Ink Pen" },
         { value: "calligraphy", label: "Calligraphy Brush" },
         { value: "pixel", label: "Pixel Brush" },
         { value: "watercolor", label: "Watercolor Brush" },
      ]
   },
   {
      label: "Air & Sprays",
      options: [
         { value: "airbrush", label: "Airbrush" },
         { value: "spray", label: "Spray / Splatter" },
         { value: "chalk", label: "Chalk Brush" },
      ]
   },
   {
      label: "Pattern Brushes",
      options: [
         { value: "pattern_dots", label: "Pattern - Dots" },
         { value: "pattern_dashed", label: "Pattern - Dashed Lines" },
         { value: "pattern_texture", label: "Pattern - Texture Stamp" },
         { value: "pattern_decorative", label: "Pattern - Decorative Diamonds" },
         { value: "pattern_repeating_shapes", label: "Pattern - Repeating Squares" },
      ]
   }
];

// Common UI Components for the Panel
const PanelSection: React.FC<{ title: React.ReactNode; icon?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, icon, children, className = '' }) => (
   <div className={`bg-white dark:bg-[#181818] rounded-xl border border-slate-200 dark:border-[#2A2A2A] p-4 space-y-4 shadow-sm ${className}`}>
      <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-900 dark:text-white tracking-wide uppercase">
         {icon}
         <span>{title}</span>
      </div>
      {children}
   </div>
);

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
   <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-zinc-500 block mb-1.5">{children}</span>
);

const RangeSlider: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string; valueDisplay?: string | number; displayUnit?: string }> = ({ label, valueDisplay, displayUnit = '', ...props }) => (
   <div>
      {(label || valueDisplay !== undefined) && (
         <div className="flex justify-between items-center text-[10px] text-slate-600 dark:text-zinc-400 mb-1.5 font-medium">
            {label && <span>{label}</span>}
            {valueDisplay !== undefined && <span className="font-mono text-slate-800 dark:text-white/90 bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/10">{valueDisplay}{displayUnit}</span>}
         </div>
      )}
      <input
         type="range"
         {...props}
         className={`w-full accent-blue-500 hover:accent-blue-400 h-1.5 bg-slate-200 dark:bg-[#2C2C2C] rounded-full appearance-none outline-none cursor-pointer ${props.className || ''}`}
      />
   </div>
);

const GridButton: React.FC<{ active?: boolean; onClick: () => void; children: React.ReactNode; className?: string }> = ({ active, onClick, children, className = '' }) => (
   <button
      type="button"
      onClick={onClick}
      className={`py-1.5 text-[10px] font-semibold rounded-md transition-all active:scale-95 ${active ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10'} ${className}`}
   >
      {children}
   </button>
);

export const PropertiesTab: React.FC = () => {
   const {
      activeTool, brushType, setBrushType, brushSize, setBrushSize,
      brushOpacity, setBrushOpacity, brushHardness, setBrushHardness,
      brushFlow, setBrushFlow, brushSmoothing, setBrushSmoothing,
      textProps, setTextProps, brushColor
   } = useTool();

   const {
      fabricRef, flipX, flipY, updateSelectedShapeProperty, applyFilter, duplicateActiveObject,
      deleteActiveObject, updateArtboardPropDirect, generateSmartCollage,
      generateBleed, enterCropMode, resetCrop
   } = useCanvas();

   const { artboards, activeArtboardId } = useWorkspaceUI();

   const {
      selectionType
   } = useSelection();

   const {
      collagePaddingPercent, setCollagePaddingPercent, collageGapPercent, setCollageGapPercent,
      collageBgColor, setCollageBgColor, collageBorderColor, setCollageBorderColor,
      collageBorderWidth, setCollageBorderWidth, collageCornerRadius, setCollageCornerRadius,
      collageBorderStyle, setCollageBorderStyle
   } = useCollageConfig();

   const {
      shapeStrokeLineCap, shapeStrokeLineJoin, shapeFillColor, shapeStrokeColor, shapeStrokeWidth,
      shapeBorderStyle, shapeOpacity, shapeBlendMode,
      shapeUseIndividualCorners, shapeCornerTL, shapeCornerTR, shapeCornerBL, shapeCornerBR, shapeCornerRadius
   } = useShapeProperties();

   const activeObj = fabricRef.current?.getActiveObject();
   const isCollageSelected = activeObj && (
      (activeObj as any).isCollageBlock ||
      (activeObj.type === 'activeSelection' && (activeObj as fabric.ActiveSelection).getObjects().some(o => (o as any).isCollageBlock))
   );

   return (
      <div className="p-4 space-y-4 font-sans max-w-full overflow-x-hidden">
         {activeTool === 'brush' || activeTool === 'eraser' ? (
            <PanelSection title="Brush Engine" icon={<Brush size={14} className="text-blue-400" />}>
               {activeTool === 'brush' && (
                  <div>
                     <Label>Brush Type</Label>
                     <ModernSelect
                        value={brushType || 'pencil'}
                        onChange={(val) => setBrushType(val)}
                        groups={BRUSH_TYPE_GROUPS}
                     />
                  </div>
               )}

               <div className="space-y-4 pt-1">
                  <RangeSlider label="Size" min="1" max="500" step="1" value={brushSize} valueDisplay={brushSize} displayUnit="px" onChange={(e) => setBrushSize(Number(e.target.value))} />

                  {activeTool === 'brush' && (
                     <>
                        <RangeSlider label="Opacity" min="1" max="100" step="1" value={brushOpacity} valueDisplay={brushOpacity} displayUnit="%" onChange={(e) => setBrushOpacity(Number(e.target.value))} />
                        <RangeSlider label="Flow" min="1" max="100" step="1" value={brushFlow} valueDisplay={brushFlow} displayUnit="%" onChange={(e) => setBrushFlow(Number(e.target.value))} />
                        <RangeSlider label="Hardness" min="1" max="100" step="1" value={brushHardness} valueDisplay={brushHardness} displayUnit="%" onChange={(e) => setBrushHardness(Number(e.target.value))} />
                        <RangeSlider label="Smoothing" min="0" max="100" step="1" value={brushSmoothing} valueDisplay={brushSmoothing} displayUnit="%" onChange={(e) => setBrushSmoothing(Number(e.target.value))} />
                     </>
                  )}
               </div>

               {activeTool === 'brush' && (
                  <div className="pt-3 border-t border-slate-200 dark:border-white/5">
                     <BrushPreview type={brushType} color={brushColor} size={brushSize} opacity={brushOpacity} hardness={brushHardness} flow={brushFlow} />
                  </div>
               )}
            </PanelSection>
         ) : selectionType ? (
            <div className="space-y-4">
               {/* Artboard Ownership Info */}
               <div className="bg-white dark:bg-[#181818] border border-blue-500/20 p-3 rounded-xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-2">
                     <div className="w-6 h-6 rounded bg-blue-500/10 flex items-center justify-center">
                        <SquareDashed size={14} className="text-blue-400" />
                     </div>
                     <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wide">Artboard</span>
                  </div>
                  <span className="text-[10px] text-slate-900 dark:text-white font-mono truncate max-w-[120px] bg-slate-200 dark:bg-white/10 px-2 py-1 rounded-md border border-slate-200 dark:border-white/5">
                     {(() => {
                        const obj = fabricRef.current?.getActiveObject() as any;
                        if (!obj) return 'None';
                        const boardId = obj.artboardId;
                        if (boardId) {
                           const b = artboards.find(a => a.id === boardId);
                           return b ? b.name : 'Unknown';
                        }
                        return 'Global';
                     })()}
                  </span>
               </div>

               {/* Object Dimensions & Transform Panel */}
               <ObjectDimensionsPanel fabricRef={fabricRef} />

               {/* Transform Module */}
               <PanelSection title="Transform" icon={<Move size={14} className="text-green-400" />}>
                  <div className="flex gap-2">
                     <button className="flex-1 h-9 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:bg-white/10 rounded-lg flex justify-center items-center gap-2 text-[11px] font-medium text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-all border border-slate-200 dark:border-white/10 active:scale-95 shadow-sm" onClick={flipX}><FlipHorizontal size={14} /> Flip X</button>
                     <button className="flex-1 h-9 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:bg-white/10 rounded-lg flex justify-center items-center gap-2 text-[11px] font-medium text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-all border border-slate-200 dark:border-white/10 active:scale-95 shadow-sm" onClick={flipY}><FlipVertical size={14} /> Flip Y</button>
                  </div>
               </PanelSection>

               {/* Appearance Panel */}
               {!isCollageSelected && selectionType !== 'frameGroup' && (
                  <PanelSection title="Appearance" icon={<Sparkles size={14} className="text-yellow-400" />}>
                     <div className="space-y-4">
                        <RangeSlider
                           label="Opacity"
                           min="1" max="100" step="1"
                           value={shapeOpacity} valueDisplay={shapeOpacity} displayUnit="%"
                           onChange={(e) => updateSelectedShapeProperty('opacity', Number(e.target.value))}
                        />
                        <div>
                           <Label>Blend Mode</Label>
                           <ModernSelect
                              value={shapeBlendMode || 'source-over'}
                              onChange={(val) => updateSelectedShapeProperty('globalCompositeOperation', val)}
                              groups={[
                                 { label: 'Normal', options: [{ value: 'source-over', label: 'Normal' }] },
                                 {
                                    label: 'Darken', options: [
                                       { value: 'darken', label: 'Darken' },
                                       { value: 'multiply', label: 'Multiply' },
                                       { value: 'color-burn', label: 'Color Burn' }
                                    ]
                                 },
                                 {
                                    label: 'Lighten', options: [
                                       { value: 'lighten', label: 'Lighten' },
                                       { value: 'screen', label: 'Screen' },
                                       { value: 'color-dodge', label: 'Color Dodge' }
                                    ]
                                 },
                                 {
                                    label: 'Contrast', options: [
                                       { value: 'overlay', label: 'Overlay' },
                                       { value: 'soft-light', label: 'Soft Light' },
                                       { value: 'hard-light', label: 'Hard Light' }
                                    ]
                                 },
                                 {
                                    label: 'Inversion', options: [
                                       { value: 'difference', label: 'Difference' },
                                       { value: 'exclusion', label: 'Exclusion' }
                                    ]
                                 },
                                 {
                                    label: 'Component', options: [
                                       { value: 'hue', label: 'Hue' },
                                       { value: 'saturation', label: 'Saturation' },
                                       { value: 'color', label: 'Color' },
                                       { value: 'luminosity', label: 'Luminosity' }
                                    ]
                                 }
                              ]}
                           />
                        </div>
                     </div>
                  </PanelSection>
               )}

               {/* Smart Collage Block Customization Panel */}
               <SmartCollageBlockCustomizationPanel />

               {/* Shape Customization Panel */}
               {!isCollageSelected && ['rect', 'circle', 'triangle', 'line'].includes(selectionType || '') && (
                  <PanelSection title="Shape Properties" icon={<Palette size={14} className="text-pink-400" />}>
                     {/* Fill and Stroke Colors */}
                     <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-white/5 p-3 rounded-lg">
                        {/* Fill color */}
                        {selectionType !== 'line' && (
                           <div className="space-y-1.5">
                              <Label>Fill Color</Label>
                              <div className="flex gap-2 items-center">
                                 <div className="w-8 h-8 rounded-md shrink-0 border border-white/20 shadow-inner relative overflow-hidden transition-transform hover:scale-105 cursor-pointer" style={{ backgroundColor: shapeFillColor }}>
                                    {shapeFillColor === 'transparent' && (
                                       <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIj48L3JlY3Q+CjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNjY2MiPjwvcmVjdD4KPHJlY3QgeD0iNCIgeT0iNCIgd2lkdGg9IjQiIGhlaWdodD0iNCIgZmlsbD0iI2NjYyI+PC9yZWN0Pgo8L3N2Zz4=')] flex items-center justify-center">
                                          <div className="w-full h-[2px] bg-red-500/80 rotate-45" />
                                       </div>
                                    )}
                                    <ColorPickerTrigger
                                       color={shapeFillColor === 'transparent' ? '#ffffff' : shapeFillColor}
                                       onChange={(color) => updateSelectedShapeProperty('fill', color)}
                                       className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                 </div>
                                 <button
                                    type="button"
                                    onClick={() => updateSelectedShapeProperty('fill', 'transparent')}
                                    className="px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-md text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                                 >
                                    None
                                 </button>
                              </div>
                           </div>
                        )}

                        {/* Border (Stroke) color */}
                        <div className={selectionType === 'line' ? 'col-span-2 space-y-1.5' : 'space-y-1.5'}>
                           <Label>{selectionType === 'line' ? 'Line Color' : 'Border Color'}</Label>
                           <div className="flex gap-2">
                              <div className="w-8 h-8 rounded-md shrink-0 border border-white/20 shadow-inner relative overflow-hidden transition-transform hover:scale-105 cursor-pointer" style={{ backgroundColor: shapeStrokeColor }}>
                                 {shapeStrokeColor === 'transparent' && (
                                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIj48L3JlY3Q+CjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNjY2MiPjwvcmVjdD4KPHJlY3QgeD0iNCIgeT0iNCIgd2lkdGg9IjQiIGhlaWdodD0iNCIgZmlsbD0iI2NjYyI+PC9yZWN0Pgo8L3N2Zz4=')] flex items-center justify-center">
                                       <div className="w-full h-[2px] bg-red-500/80 rotate-45" />
                                    </div>
                                 )}
                                 <ColorPickerTrigger
                                    color={shapeStrokeColor === 'transparent' ? '#ffffff' : shapeStrokeColor}
                                    onChange={(color) => updateSelectedShapeProperty('stroke', color)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                 />
                              </div>
                           </div>
                        </div>
                     </div>

                     {/* Border Style & Thickness */}
                     <div className="space-y-4 pt-1">
                        {selectionType !== 'line' && (
                           <div>
                              <Label>Outline Style</Label>
                              <div className="grid grid-cols-3 gap-1 bg-slate-50 dark:bg-[#111] rounded-lg p-1 border border-slate-200 dark:border-white/5">
                                 {['none', 'solid', 'dashed'].map((st) => (
                                    <GridButton key={st} active={shapeBorderStyle === st} onClick={() => updateSelectedShapeProperty('borderStyle', st)}>
                                       <span className="capitalize">{st}</span>
                                    </GridButton>
                                 ))}
                              </div>
                           </div>
                        )}

                        <RangeSlider
                           label={selectionType === 'line' ? 'Line Thickness' : 'Border Thickness'}
                           min={selectionType === 'line' ? "1" : "0"} max="50" step="1"
                           value={shapeStrokeWidth} valueDisplay={shapeStrokeWidth} displayUnit="px"
                           onChange={(e) => updateSelectedShapeProperty('strokeWidth', Number(e.target.value))}
                        />
                     </div>

                     {/* Corner Rounding Controls - RECTANGLE ONLY */}
                     {selectionType === 'rect' && (
                        <div className="pt-3 border-t border-slate-200 dark:border-white/10 space-y-3">
                           <div className="flex items-center justify-between">
                              <Label>Corner Rounding</Label>
                              <ModernCheckbox
                                 checked={shapeUseIndividualCorners}
                                 onChange={(val) => updateSelectedShapeProperty('useIndividualCorners', val)}
                                 label="Separate"
                                 labelLeft
                              />
                           </div>

                           {shapeUseIndividualCorners ? (
                              <div className="grid grid-cols-2 gap-4">
                                 <RangeSlider label="Top L" min="0" max="100" step="1" value={shapeCornerTL} valueDisplay={shapeCornerTL} displayUnit="%" onChange={(e) => updateSelectedShapeProperty('rx_tl', Number(e.target.value))} />
                                 <RangeSlider label="Top R" min="0" max="100" step="1" value={shapeCornerTR} valueDisplay={shapeCornerTR} displayUnit="%" onChange={(e) => updateSelectedShapeProperty('rx_tr', Number(e.target.value))} />
                                 <RangeSlider label="Bot L" min="0" max="100" step="1" value={shapeCornerBL} valueDisplay={shapeCornerBL} displayUnit="%" onChange={(e) => updateSelectedShapeProperty('rx_bl', Number(e.target.value))} />
                                 <RangeSlider label="Bot R" min="0" max="100" step="1" value={shapeCornerBR} valueDisplay={shapeCornerBR} displayUnit="%" onChange={(e) => updateSelectedShapeProperty('rx_br', Number(e.target.value))} />
                              </div>
                           ) : (
                              <RangeSlider label="Radius" min="0" max="100" step="1" value={shapeCornerRadius} valueDisplay={shapeCornerRadius} displayUnit="%" onChange={(e) => updateSelectedShapeProperty('rx', Number(e.target.value))} />
                           )}
                        </div>
                     )}
                  </PanelSection>
               )}

               {/* Corner Rounding & Connections for Triangle/Line */}
               {['triangle', 'line'].includes(selectionType || '') && (
                  <PanelSection title={selectionType === 'triangle' ? 'Triangle Rounding' : 'Line Join / End Caps'} icon={<Palette size={14} />}>
                     <div className="space-y-4">
                        {selectionType !== 'line' && (
                           <div>
                              <Label>Corner Style</Label>
                              <div className="grid grid-cols-3 gap-1 bg-slate-50 dark:bg-[#111] rounded-lg p-1 border border-slate-200 dark:border-white/5">
                                 {[
                                    { id: 'miter', label: 'Sharp' },
                                    { id: 'round', label: 'Rounded' },
                                    { id: 'bevel', label: 'Beveled' }
                                 ].map((st) => (
                                    <GridButton key={st.id} active={shapeStrokeLineJoin === st.id} onClick={() => updateSelectedShapeProperty('strokeLineJoin', st.id)}>
                                       {st.label}
                                    </GridButton>
                                 ))}
                              </div>
                              <p className="text-[10px] text-slate-500 dark:text-zinc-500 mt-2 font-medium">
                                 {shapeStrokeLineJoin === 'round'
                                    ? '✓ Corners are rounded based on Border Thickness.'
                                    : 'ℹ Select "Rounded" to round corners.'}
                              </p>
                           </div>
                        )}

                        {selectionType === 'line' && (
                           <div>
                              <Label>Line End Caps</Label>
                              <div className="grid grid-cols-3 gap-1 bg-slate-50 dark:bg-[#111] rounded-lg p-1 border border-slate-200 dark:border-white/5">
                                 {[
                                    { id: 'butt', label: 'Butt' },
                                    { id: 'round', label: 'Round' },
                                    { id: 'square', label: 'Square' }
                                 ].map((cp) => (
                                    <GridButton key={cp.id} active={shapeStrokeLineCap === cp.id} onClick={() => updateSelectedShapeProperty('strokeLineCap', cp.id)}>
                                       {cp.label}
                                    </GridButton>
                                 ))}
                              </div>
                           </div>
                        )}
                     </div>
                  </PanelSection>
               )}

               {/* Typography Module */}
               {(selectionType === 'i-text' || selectionType === 'text' || selectionType === 'textbox') && (
                  <TypographyPanel />
               )}

               {/* Image Adjustments Module */}
               {(selectionType === 'image' || selectionType === 'frameGroup') && (
                  <div className="space-y-4">
                     <PanelSection title="Crop & Composition" icon={<Crop size={14} className="text-orange-400" />}>
                        <div className="flex gap-2">
                           <button
                              onClick={() => enterCropMode()}
                              className="flex-1 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 hover:border-orange-500/50 rounded-lg text-[11px] font-medium py-2 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                           >
                              <Crop size={14} /> Crop Image
                           </button>
                           <button
                              onClick={() => resetCrop()}
                              className="bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 transition-all flex items-center justify-center active:scale-95 shadow-sm"
                              title="Reset Crop"
                           >
                              <RotateCcw size={14} />
                           </button>
                        </div>
                     </PanelSection>

                     <PanelSection title="Adjustments (Non-Destructive)" icon={<Settings size={14} className="text-slate-600 dark:text-zinc-400" />}>
                        <div className="space-y-4">
                           <FilterSlider label="Brightness" min="-0.5" max="0.5" step="0.01" onChange={(v) => applyFilter('brightness', v)} />
                           <FilterSlider label="Contrast" min="-0.5" max="0.5" step="0.01" onChange={(v) => applyFilter('contrast', v)} />
                           <FilterSlider label="Saturation" min="-1" max="1" step="0.01" onChange={(v) => applyFilter('saturation', v)} />
                           <FilterSlider label="Grayscale" min="0" max="1" step="0.01" onChange={(v) => applyFilter('grayscale', v)} />
                        </div>
                     </PanelSection>
                  </div>
               )}

               {/* Artboard Assignment and Alignment Module */}
               <ArtboardAssignmentModule />

               {/* Quick Actions */}
               <div className="pt-2">
                  <div className="flex gap-2">
                     <button className="flex-1 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white rounded-lg text-[11px] font-medium transition-all shadow-sm active:scale-95 flex justify-center items-center gap-1.5" onClick={duplicateActiveObject}>
                        <Copy size={14} /> Duplicate
                     </button>
                     <button className="flex-1 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 rounded-lg text-[11px] font-medium transition-all shadow-sm active:scale-95 flex justify-center items-center gap-1.5" onClick={deleteActiveObject}>
                        <Trash2 size={14} /> Delete
                     </button>
                  </div>
               </div>
            </div>
         ) : (
            <>
               {artboards.find(b => b.id === activeArtboardId) ? (
                  <div className="space-y-5">
                     <div className="flex items-center gap-2 px-1">
                        <Square size={16} className="text-slate-700 dark:text-slate-700 dark:text-white/80" />
                        <span className="text-[12px] font-bold tracking-wider text-slate-900 dark:text-white uppercase">Artboard Properties</span>
                     </div>

                     {/* Smart Background Studio */}
                     <PanelSection title="Smart Background" icon={<Droplets size={14} className="text-blue-400" />}>
                        <div className="flex gap-3 items-center">
                           <div className="w-12 h-12 rounded-xl shrink-0 border border-white/20 shadow-inner relative overflow-hidden transition-transform hover:scale-105 cursor-pointer" style={{ backgroundColor: artboards.find(b => b.id === activeArtboardId)?.backgroundColor as string || '#ffffff' }}>
                              <ColorPickerTrigger
                                 color={artboards.find(b => b.id === activeArtboardId)?.backgroundColor as string || '#ffffff'}
                                 onChange={(c) => updateArtboardPropDirect(activeArtboardId, 'backgroundColor', c, true)}
                                 className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              />
                           </div>
                           <div className="grid grid-cols-4 gap-1.5 flex-1">
                              {['#FFFFFF', '#000000', '#F3F4F6', '#E5E7EB', '#3B82F6', '#EF4444', '#10B981', '#F59E0B'].map(c => (
                                 <button key={c} onClick={() => updateArtboardPropDirect(activeArtboardId, 'backgroundColor', c, true)} className="w-full h-5 rounded-md border border-slate-200 dark:border-white/10 hover:border-white/50 hover:scale-110 active:scale-95 transition-all shadow-sm" style={{ backgroundColor: c }} />
                              ))}
                           </div>
                        </div>
                     </PanelSection>

                     {/* Smart Collage Builder */}
                     <PanelSection
                        title={
                           <div className="flex items-center justify-between w-full">
                              <span>Smart Collage Builder</span>
                              <span className="text-[9px] font-bold bg-blue-500 text-slate-900 dark:text-white px-2 py-0.5 rounded-full shadow-sm shadow-blue-500/20">PERFECT FIT</span>
                           </div>
                        }
                        icon={<Layout size={14} className="text-purple-400" />}
                     >
                        <div className="grid grid-cols-3 gap-2">
                           {[
                              { l: '2x Grid', i: '2x' },
                              { l: '3x Grid', i: '3x' },
                              { l: '4x Quad', i: '4x' },
                              { l: '1L 2R', i: '1-2' },
                              { l: '2T 1B', i: '2-1' },
                              { l: 'Filmstrip', i: 'film' }
                           ].map(c => (
                              <button
                                 key={c.i}
                                 onClick={() => generateSmartCollage(c.i)}
                                 className="py-2.5 bg-slate-50 dark:bg-[#141414] hover:bg-slate-100 dark:hover:bg-[#1C1C1C] border border-slate-200 dark:border-[#333] hover:border-purple-500/50 rounded-lg text-[10px] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white flex flex-col items-center justify-center gap-1.5 transition-all group active:scale-95 shadow-sm"
                              >
                                 <div className="w-8 h-8 border border-slate-300 dark:border-zinc-700 group-hover:border-purple-400/50 rounded-md bg-slate-100 dark:bg-[#0A0A0A] group-hover:bg-purple-500/10 flex items-center justify-center text-[10px] font-mono transition-colors text-slate-500 dark:text-zinc-500 group-hover:text-purple-300">{c.i}</div>
                                 <span className="font-medium">{c.l}</span>
                              </button>
                           ))}
                        </div>

                        <div className="space-y-4 bg-slate-50 dark:bg-[#111] p-3 rounded-lg border border-slate-200 dark:border-white/5 mt-2">
                           <Label>Preset Options (Perfect Fit)</Label>

                           <RangeSlider label="Outer Padding (Margin)" min="0" max="15" step="1" value={collagePaddingPercent} valueDisplay={collagePaddingPercent} displayUnit="%" onChange={(e) => setCollagePaddingPercent(Number(e.target.value))} />
                           <RangeSlider label="Inner Gap (Spacing)" min="0" max="10" step="0.5" value={collageGapPercent} valueDisplay={collageGapPercent} displayUnit="%" onChange={(e) => setCollageGapPercent(Number(e.target.value))} />

                           <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-white/5">
                              <div>
                                 <Label>Block Fill</Label>
                                 <div className="w-full h-8 rounded-md border border-white/20 shadow-inner relative overflow-hidden transition-transform hover:scale-105 cursor-pointer" style={{ backgroundColor: collageBgColor }}>
                                    <ColorPickerTrigger color={collageBgColor} onChange={setCollageBgColor} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                 </div>
                              </div>
                              <div>
                                 <Label>Border Color</Label>
                                 <div className="w-full h-8 rounded-md border border-white/20 shadow-inner relative overflow-hidden transition-transform hover:scale-105 cursor-pointer" style={{ backgroundColor: collageBorderColor }}>
                                    <ColorPickerTrigger color={collageBorderColor} onChange={setCollageBorderColor} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                 </div>
                              </div>
                           </div>

                           <div className="grid grid-cols-2 gap-4 pt-1">
                              <div>
                                 <Label>Border Width</Label>
                                 <input
                                    type="number" min="0" max="10"
                                    value={collageBorderWidth}
                                    onChange={(e) => setCollageBorderWidth(Number(e.target.value))}
                                    className="w-full h-8 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[11px] text-slate-900 dark:text-white px-2 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                                 />
                              </div>
                              <div>
                                 <Label>Corner Radius</Label>
                                 <input
                                    type="number" min="0" max="100"
                                    value={collageCornerRadius}
                                    onChange={(e) => setCollageCornerRadius(Number(e.target.value))}
                                    className="w-full h-8 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[11px] text-slate-900 dark:text-white px-2 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                                 />
                              </div>
                           </div>

                           <div className="pt-1">
                              <Label>Border Style</Label>
                              <div className="grid grid-cols-3 gap-1 bg-slate-50 dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/5 rounded-lg p-1">
                                 {['none', 'solid', 'dashed'].map((st) => (
                                    <GridButton key={st} active={collageBorderStyle === st} onClick={() => setCollageBorderStyle(st as any)}>
                                       <span className="capitalize">{st}</span>
                                    </GridButton>
                                 ))}
                              </div>
                           </div>
                        </div>
                     </PanelSection>

                     {/* Print Settings */}
                     <PanelSection title="Print Preparation" icon={<Printer size={14} className="text-slate-600 dark:text-zinc-400" />}>
                        <div className="space-y-3">
                           <div className="bg-slate-50 dark:bg-[#111] p-3 rounded-lg border border-slate-200 dark:border-white/5">
                              <ModernCheckbox
                                 checked={!!artboards.find(b => b.id === activeArtboardId)?.showMargins}
                                 onChange={(val) => updateArtboardPropDirect(activeArtboardId, 'showMargins', val, true)}
                                 label='Show Print Margins (0.25")'
                                 labelLeft
                              />
                           </div>
                           <div className="flex gap-2">
                              <button
                                 onClick={() => generateBleed(false)}
                                 className="flex-1 py-2.5 px-3 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-[11px] rounded-lg flex gap-2 justify-center items-center font-medium transition-all shadow-sm active:scale-95"
                                 title="Add 0.125&#34; Bleed"
                              >
                                 <Plus className="text-slate-600 dark:text-zinc-400" size={14} />
                                 <span>Add Bleed</span>
                              </button>
                              <button
                                 onClick={() => generateBleed(true)}
                                 className="flex-1 py-2.5 px-3 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-[11px] rounded-lg flex gap-2 justify-center items-center font-medium transition-all shadow-sm active:scale-95"
                                 title="Remove 0.125&#34; Bleed"
                              >
                                 <Minus className="text-slate-600 dark:text-zinc-400" size={14} />
                                 <span>Remove Bleed</span>
                              </button>
                           </div>
                        </div>
                     </PanelSection>
                  </div>
               ) : (
                  <div className="flex flex-col items-center justify-center py-24 text-center opacity-40">
                     <MousePointer2 size={36} className="mb-4 text-slate-900 dark:text-white" strokeWidth={1.5} />
                     <span className="text-sm font-semibold text-slate-900 dark:text-white">No Selection</span>
                     <span className="text-xs mt-2 w-56 text-slate-600 dark:text-zinc-400 leading-relaxed">Select an object or an artboard on the canvas to edit its properties.</span>
                  </div>
               )}
            </>
         )}
      </div>
   );
};
