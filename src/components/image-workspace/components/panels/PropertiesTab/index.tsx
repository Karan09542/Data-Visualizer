import React, { useRef } from 'react';
import * as fabric from 'fabric';
import {
   Brush, Eraser, FlipHorizontal, FlipVertical, Move, SquareDashed, Layout, Square, Palette, MousePointer2, Copy, Trash2, Crop, RotateCcw, Settings,
   Droplets, Sparkles, Printer, Plus, Minus, RotateCw
} from 'lucide-react';
import { useTool } from '../../../contexts/ToolContext';
import { useCanvas } from '../../../contexts/CanvasContext';
import { useWorkspaceUI } from '../../../contexts/WorkspaceUIContext';
import { useSelection } from '../../../contexts/SelectionContext';
import { useCollageConfig, COLLAGE_DEFAULTS } from '../../../hooks/useCollageConfig';
import { useShapeProperties } from '../../../hooks/useShapeProperties';
import { ObjectDimensionsPanel } from '../ObjectDimensionsPanel';
import { FilterSlider } from '../../shared/FilterSlider';
import { ColorPickerTrigger } from '../../shared/ColorPickers';
import { BrushPreview } from '../../shared/BrushPreview';
import { ModernCheckbox } from '../../shared/ModernCheckbox';
import { TypographyPanel } from '../TypographyPanel';
import { ImageBorderPanel } from '../ImageBorderPanel';
import { EdgeRefinePanel } from '../EdgeRefinePanel';
import { SmartCollageBlockCustomizationPanel } from '../SmartCollageBlockCustomizationPanel';
import { ArtboardAssignmentModule } from '../ArtboardAssignmentModule';
import { ModernSelect, SelectGroup } from '../../shared/ModernSelect';
import { PanelSection, Label, RangeSlider, GridButton, ColorField, BorderStylePicker } from '../../shared/PanelPrimitives';
import { isActiveSelection } from '../../../../../utils/fabric-utils';

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
// Miniature of each collage layout, so the preset buttons show the arrangement instead of a code.
const CollageLayoutPreview: React.FC<{ id: string }> = ({ id }) => {
   const cell = 'flex-1 rounded-[2px] bg-slate-300 dark:bg-zinc-600 group-hover:bg-purple-400 dark:group-hover:bg-purple-400/80 transition-colors';
   const frame = 'w-10 h-8 flex gap-[3px] p-[3px] rounded-md bg-slate-100 dark:bg-[#0A0A0A] border border-slate-300 dark:border-zinc-700 group-hover:border-purple-400/50 transition-colors';
   const row = 'flex flex-1 gap-[3px]';
   const col = 'flex flex-1 flex-col gap-[3px]';
   switch (id) {
      case '2x':  return <div className={frame}><i className={cell} /><i className={cell} /></div>;
      case '3x':  return <div className={frame}><i className={cell} /><i className={cell} /><i className={cell} /></div>;
      case '4x':  return <div className={`${frame} flex-col`}><div className={row}><i className={cell} /><i className={cell} /></div><div className={row}><i className={cell} /><i className={cell} /></div></div>;
      case '1-2': return <div className={frame}><i className={cell} /><div className={col}><i className={cell} /><i className={cell} /></div></div>;
      case '2-1': return <div className={`${frame} flex-col`}><i className={cell} /><div className={row}><i className={cell} /><i className={cell} /></div></div>;
      case 'film':return <div className={`${frame} flex-col`}><i className={cell} /><i className={cell} /><i className={cell} /></div>;
      default:    return null;
   }
};

export const PropertiesTab: React.FC = () => {
   const {
      activeTool, brushType, setBrushType, brushSize, setBrushSize,
      brushOpacity, setBrushOpacity, brushHardness, setBrushHardness,
      brushFlow, setBrushFlow, brushSmoothing, setBrushSmoothing,
      eraseMode, setEraseMode,
      textProps, setTextProps, brushColor
   } = useTool();

   const {
      fabricRef, flipX, flipY, updateSelectedShapeProperty, applyFilter, duplicateActiveObject,
      deleteActiveObject, updateArtboardPropDirect, generateSmartCollage,
      generateBleed, enterCropMode, resetCrop, updateCollageBlockStyleProperty
   } = useCanvas();

   const { artboards, activeArtboardId } = useWorkspaceUI();

   const {
      selectionType
   } = useSelection();

   const {
      collagePaddingPercent, setCollagePaddingPercent, collageGapPercent, setCollageGapPercent,
      collageBgColor, setCollageBgColor, collageBorderColor, setCollageBorderColor,
      collageBorderWidth, setCollageBorderWidth, collageCornerRadius, setCollageCornerRadius,
      collageBorderStyle, setCollageBorderStyle, resetCollageConfig
   } = useCollageConfig();

   const {
      shapeStrokeLineCap, shapeStrokeLineJoin, shapeFillColor, shapeStrokeColor, shapeStrokeWidth,
      shapeBorderStyle, shapeOpacity, shapeBlendMode,
      shapeUseIndividualCorners, shapeCornerTL, shapeCornerTR, shapeCornerBL, shapeCornerBR, shapeCornerRadius
   } = useShapeProperties();

   const activeObj = fabricRef.current?.getActiveObject();
   const isCollageSelected = activeObj && (
      (activeObj as any).isCollageBlock ||
      (isActiveSelection(activeObj) && (activeObj as fabric.ActiveSelection).getObjects().some(o => (o as any).isCollageBlock))
   );

   // Blend modes are impossible to judge by name against a particular layer and background, so
   // hovering or holding one shows it on the canvas. Written straight to the objects and undone
   // from this snapshot, so scrubbing the list never reaches the undo history.
   const blendPreviewRef = useRef<{ obj: any; value: any }[]>([]);

   const previewBlendMode = (val: string | null) => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      if (val === null) {
         blendPreviewRef.current.forEach(({ obj, value }) => obj.set('globalCompositeOperation', value));
         blendPreviewRef.current = [];
         canvas.requestRenderAll();
         return;
      }

      const objs = canvas.getActiveObjects();
      if (!objs.length) return;
      if (!blendPreviewRef.current.length) {
         blendPreviewRef.current = objs.map(o => ({ obj: o, value: o.get('globalCompositeOperation') }));
      }
      objs.forEach(o => o.set('globalCompositeOperation', val as any));
      canvas.requestRenderAll();
   };

   return (
      <div className="p-4 space-y-4 font-sans max-w-full overflow-x-hidden">
         {activeTool === 'brush' || activeTool === 'eraser' ? (
            <PanelSection
               title={activeTool === 'eraser' ? 'Eraser' : 'Brush Engine'}
               icon={activeTool === 'eraser'
                  ? <Eraser size={14} className="text-blue-400" />
                  : <Brush size={14} className="text-blue-400" />}
            >
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

               {activeTool === 'eraser' && (
                  <div>
                     <Label>Mode</Label>
                     <div className="flex gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-[#181818] border border-slate-200 dark:border-[#3A3A3A]">
                        {(['erase', 'restore'] as const).map((mode) => (
                           <button
                              key={mode}
                              onClick={() => setEraseMode(mode)}
                              className={`flex-1 h-7 rounded-md text-[11px] font-semibold transition-colors ${eraseMode === mode
                                 ? 'bg-blue-600 text-white shadow-sm'
                                 : 'text-slate-500 dark:text-[#8A8A8A] hover:text-slate-900 dark:hover:text-[#E0E0E0]'
                                 }`}
                              title={mode === 'erase'
                                 ? 'Remove pixels from the image under the cursor'
                                 : 'Paint erased pixels back in'}
                           >
                              {mode === 'erase' ? 'Erase' : 'Restore'}
                           </button>
                        ))}
                     </div>
                  </div>
               )}

               <div className="space-y-4 pt-1">
                  <RangeSlider label="Size" min="1" max="500" step="1" value={brushSize} valueDisplay={brushSize} displayUnit="px" onChange={(e) => setBrushSize(Number(e.target.value))} />

                  <RangeSlider label="Opacity" min="1" max="100" step="1" value={brushOpacity} valueDisplay={brushOpacity} displayUnit="%" onChange={(e) => setBrushOpacity(Number(e.target.value))} />
                  <RangeSlider label="Hardness" min="1" max="100" step="1" value={brushHardness} valueDisplay={brushHardness} displayUnit="%" onChange={(e) => setBrushHardness(Number(e.target.value))} />

                  {activeTool === 'brush' && (
                     <>
                        <RangeSlider label="Flow" min="1" max="100" step="1" value={brushFlow} valueDisplay={brushFlow} displayUnit="%" onChange={(e) => setBrushFlow(Number(e.target.value))} />
                        <RangeSlider label="Smoothing" min="0" max="100" step="1" value={brushSmoothing} valueDisplay={brushSmoothing} displayUnit="%" onChange={(e) => setBrushSmoothing(Number(e.target.value))} />
                     </>
                  )}
               </div>

               {activeTool === 'brush' && (
                  <div className="pt-3 border-t border-slate-200 dark:border-white/5">
                     <BrushPreview type={brushType} color={brushColor} size={brushSize} opacity={brushOpacity} hardness={brushHardness} flow={brushFlow} smoothing={brushSmoothing} />
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
                              onPreview={previewBlendMode}
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
                     <EdgeRefinePanel />
                     <ImageBorderPanel />
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
                           <div className="flex items-center justify-between w-full gap-2">
                              <span className="flex items-center gap-2">
                                 Smart Collage Builder
                                 <span className="text-[9px] font-bold bg-blue-500 text-white px-2 py-0.5 rounded-full shadow-sm shadow-blue-500/20">PERFECT FIT</span>
                              </span>
                              <button
                                 type="button"
                                 onClick={() => {
                                    resetCollageConfig();
                                    // Push the defaults onto any collage cells that are selected, so
                                    // Reset means the same thing on canvas as it does in this panel.
                                    updateCollageBlockStyleProperty('fill', COLLAGE_DEFAULTS.bgColor);
                                    updateCollageBlockStyleProperty('stroke', COLLAGE_DEFAULTS.borderColor);
                                    updateCollageBlockStyleProperty('strokeWidth', COLLAGE_DEFAULTS.borderWidth);
                                    updateCollageBlockStyleProperty('rx', COLLAGE_DEFAULTS.cornerRadius);
                                    updateCollageBlockStyleProperty('borderStyle', COLLAGE_DEFAULTS.borderStyle);
                                 }}
                                 title="Reset all collage presets to their defaults"
                                 className="shrink-0 flex items-center gap-1 h-6 px-2 rounded-md text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/25 active:scale-95 transition-all"
                              >
                                 <RotateCw size={11} /> Reset
                              </button>
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
                                 title={'Generate a ' + c.l + ' collage that fills the artboard'}
                                 className="py-2.5 bg-slate-50 dark:bg-[#141414] hover:bg-slate-100 dark:hover:bg-[#1C1C1C] border border-slate-200 dark:border-[#333] hover:border-purple-500/50 rounded-lg text-[10px] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white flex flex-col items-center justify-center gap-1.5 transition-all group active:scale-95 shadow-sm"
                              >
                                 <CollageLayoutPreview id={c.i} />
                                 <span className="font-medium">{c.l}</span>
                              </button>
                           ))}
                        </div>

                        <div className="space-y-4 bg-slate-50 dark:bg-[#111] p-3 rounded-lg border border-slate-200 dark:border-white/5 mt-2">
                           <div className="flex items-baseline justify-between">
                              <Label>Preset Options</Label>
                              <span className="text-[9px] text-slate-400 dark:text-zinc-500">applies live to selected cells</span>
                           </div>

                           <RangeSlider label="Outer Padding (Margin)" min="0" max="15" step="1" value={collagePaddingPercent} valueDisplay={collagePaddingPercent} displayUnit="%" onChange={(e) => setCollagePaddingPercent(Number(e.target.value))} />
                           <RangeSlider label="Inner Gap (Spacing)" min="0" max="10" step="0.5" value={collageGapPercent} valueDisplay={collageGapPercent} displayUnit="%" onChange={(e) => setCollageGapPercent(Number(e.target.value))} />

                           <div className="pt-3 border-t border-slate-200 dark:border-white/5 space-y-4">
                              {/* These also write straight to any selected cells. Setting state alone
                                  was not enough: selecting a cell re-syncs the config from that object,
                                  which silently reverted the value the moment it happened. */}
                              <RangeSlider
                                 label="Border Width" min="0" max="50" step="1"
                                 value={collageBorderWidth} valueDisplay={collageBorderWidth} displayUnit="px"
                                 onChange={(e) => {
                                    const v = Number(e.target.value);
                                    setCollageBorderWidth(v);
                                    updateCollageBlockStyleProperty('strokeWidth', v);
                                 }}
                              />
                              <RangeSlider
                                 label="Corner Radius" min="0" max="100" step="1"
                                 value={collageCornerRadius} valueDisplay={collageCornerRadius} displayUnit="%"
                                 onChange={(e) => {
                                    const v = Number(e.target.value);
                                    setCollageCornerRadius(v);
                                    updateCollageBlockStyleProperty('rx', v);
                                 }}
                              />
                           </div>

                           <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200 dark:border-white/5">
                              <ColorField
                                 label="Block Fill"
                                 color={collageBgColor}
                                 onChange={(c) => { setCollageBgColor(c); updateCollageBlockStyleProperty('fill', c); }}
                              />
                              <ColorField
                                 label="Border Color"
                                 color={collageBorderColor}
                                 muted={collageBorderStyle === 'none'}
                                 onChange={(c) => { setCollageBorderColor(c); updateCollageBlockStyleProperty('stroke', c); }}
                              />
                           </div>

                           <div className="pt-3 border-t border-slate-200 dark:border-white/5">
                              <Label>Border Style</Label>
                              <BorderStylePicker
                                 value={collageBorderStyle}
                                 onChange={(st) => { setCollageBorderStyle(st); updateCollageBlockStyleProperty('borderStyle', st); }}
                              />
                           </div>
                        </div>
                     </PanelSection>

                     {/* Print Settings */}
                     <PanelSection title="Print Preparation" icon={<Printer size={14} className="text-slate-600 dark:text-zinc-400" />}>
                        <div className="flex items-start justify-between gap-3">
                           <div className="min-w-0">
                              <span className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200">Show Print Margins</span>
                              <span className="block text-[9px] text-slate-400 dark:text-zinc-500 mt-0.5">Safe area guide, 0.25&quot; inside the trim edge.</span>
                           </div>
                           <ModernCheckbox
                              checked={!!artboards.find(b => b.id === activeArtboardId)?.showMargins}
                              onChange={(val: boolean) => updateArtboardPropDirect(activeArtboardId, 'showMargins', val, true)}
                              className="shrink-0 mt-0.5"
                           />
                        </div>

                        <div className="pt-3 border-t border-slate-200 dark:border-white/5">
                           <div className="flex items-baseline justify-between mb-1.5">
                              <Label>Bleed</Label>
                              <span className="text-[9px] font-mono text-slate-400 dark:text-zinc-500">0.125&quot;</span>
                           </div>
                           <div className="grid grid-cols-2 gap-2">
                              <GridButton
                                 onClick={() => generateBleed(false)}
                                 className="flex items-center justify-center gap-1.5 h-9"
                                 title="Grow the artboard by 0.125&quot; on every side"
                              >
                                 <Plus size={13} /> Add Bleed
                              </GridButton>
                              <GridButton
                                 onClick={() => generateBleed(true)}
                                 className="flex items-center justify-center gap-1.5 h-9"
                                 title="Shrink the artboard back by 0.125&quot; on every side"
                              >
                                 <Minus size={13} /> Remove Bleed
                              </GridButton>
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
