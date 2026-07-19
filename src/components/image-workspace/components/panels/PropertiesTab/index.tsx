import React from 'react';
import * as fabric from 'fabric';
import {
   Brush, FlipHorizontal, FlipVertical, Move, SquareDashed, Layout, Square, Palette, MousePointer2, Copy, Trash2, Crop, RotateCcw, Settings,
   Droplets, Sparkles, LucideImage, Printer, Plus
} from 'lucide-react';
import { useTool } from '../../../contexts/ToolContext';
import { useCanvas } from '../../../contexts/CanvasContext';
import { useWorkspaceUI } from '../../../contexts/WorkspaceUIContext';
import { useSelection } from '../../../contexts/SelectionContext';
import { useCollageConfig } from '../../../hooks/useCollageConfig';
import { useShapeProperties } from '../../../hooks/useShapeProperties';
import { useHistory } from '../../../contexts/HistoryContext';
import { ObjectDimensionsPanel } from '../ObjectDimensionsPanel';
import { FilterSlider } from '../../shared/FilterSlider';
import { ColorPickerTrigger } from '../../shared/ColorPickers';
import { BrushPreview } from '../../shared/BrushPreview';
import { ModernCheckbox } from '../../shared/ModernCheckbox';
import { TypographyPanel } from '../TypographyPanel';
import { SmartCollageBlockCustomizationPanel } from '../SmartCollageBlockCustomizationPanel';
import { ArtboardAssignmentModule } from '../ArtboardAssignmentModule';

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
      shapeBorderStyle, shapeOpacity,
      shapeUseIndividualCorners, shapeCornerTL, shapeCornerTR, shapeCornerBL, shapeCornerBR, shapeCornerRadius
   } = useShapeProperties();

   return (
      <div className="p-3 sm:p-4 space-y-5 sm:space-y-6 font-sans">
         {activeTool === 'brush' || activeTool === 'eraser' ? (
            <div className="space-y-4">
               <div className="text-[10px] uppercase font-bold tracking-wider text-[#A0A0A0] mb-1 flex items-center gap-2"><Brush size={12} /> Brush Engine</div>

               {activeTool === 'brush' && (
                  <div>
                     <label className="text-[10px] text-[#8A8A8A] block mb-1 font-semibold uppercase tracking-wider">Brush Type</label>
                     <select
                        className="w-full h-8 sm:h-9 bg-[#181818] border border-[#3A3A3A] rounded-lg text-xs px-2.5 outline-none text-white focus:border-blue-500 transition-colors cursor-pointer"
                        value={brushType || 'pencil'}
                        onChange={(e) => setBrushType(e.target.value)}
                     >
                        <optgroup label="Standard Brushes">
                           <option value="pencil">Pencil</option>
                           <option value="brush">Art Brush</option>
                           <option value="marker">Permanent Marker</option>
                           <option value="highlighter">Highlighter</option>
                        </optgroup>
                        <optgroup label="Technical & Artistic">
                           <option value="ink">Ink Pen</option>
                           <option value="calligraphy">Calligraphy Brush</option>
                           <option value="pixel">Pixel Brush</option>
                           <option value="watercolor">Watercolor Brush</option>
                        </optgroup>
                        <optgroup label="Air & Sprays">
                           <option value="airbrush">Airbrush</option>
                           <option value="spray">Spray / Splatter</option>
                           <option value="chalk">Chalk Brush</option>
                        </optgroup>
                        <optgroup label="Pattern Brushes">
                           <option value="pattern_dots">Pattern - Dots</option>
                           <option value="pattern_dashed">Pattern - Dashed Lines</option>
                           <option value="pattern_texture">Pattern - Texture Stamp</option>
                           <option value="pattern_decorative">Pattern - Decorative Diamonds</option>
                           <option value="pattern_repeating_shapes">Pattern - Repeating Squares</option>
                        </optgroup>
                     </select>
                  </div>
               )}

               <div>
                  <div className="flex justify-between items-center text-[10px] text-[#A0A0A0] mb-1 font-semibold">
                     <span>Brush Size</span>
                     <span className="bg-[#181818] px-1.5 py-0.5 rounded border border-[#3A3A3A] text-[10px] text-white font-mono">{brushSize}px</span>
                  </div>
                  <input
                     type="range" min="1" max="500" step="1" value={brushSize}
                     onChange={(e) => setBrushSize(Number(e.target.value))}
                     className="w-full accent-blue-500 hover:accent-blue-400 h-2 md:h-1 bg-[#2C2C2C] rounded-full appearance-none outline-none cursor-pointer"
                  />
               </div>

               {activeTool === 'brush' && (
                  <>
                     <div>
                        <div className="flex justify-between items-center text-[10px] text-[#A0A0A0] mb-1 font-semibold">
                           <span>Opacity</span>
                           <span className="bg-[#181818] px-1.5 py-0.5 rounded border border-[#3A3A3A] text-[10px] text-white font-mono">{brushOpacity}%</span>
                        </div>
                        <input
                           type="range" min="1" max="100" step="1" value={brushOpacity}
                           onChange={(e) => setBrushOpacity(Number(e.target.value))}
                           className="w-full accent-blue-500 hover:accent-blue-400 h-2 md:h-1 bg-[#2C2C2C] rounded-full appearance-none outline-none cursor-pointer"
                        />
                     </div>

                     <div>
                        <div className="flex justify-between items-center text-[10px] text-[#A0A0A0] mb-1 font-semibold">
                           <span>Flow</span>
                           <span className="bg-[#181818] px-1.5 py-0.5 rounded border border-[#3A3A3A] text-[10px] text-white font-mono">{brushFlow}%</span>
                        </div>
                        <input
                           type="range" min="1" max="100" step="1" value={brushFlow}
                           onChange={(e) => setBrushFlow(Number(e.target.value))}
                           className="w-full accent-blue-500 hover:accent-blue-400 h-2 md:h-1 bg-[#2C2C2C] rounded-full appearance-none outline-none cursor-pointer"
                        />
                     </div>

                     <div>
                        <div className="flex justify-between items-center text-[10px] text-[#A0A0A0] mb-1 font-semibold">
                           <span>Hardness</span>
                           <span className="bg-[#181818] px-1.5 py-0.5 rounded border border-[#3A3A3A] text-[10px] text-white font-mono">{brushHardness}%</span>
                        </div>
                        <input
                           type="range" min="1" max="100" step="1" value={brushHardness}
                           onChange={(e) => setBrushHardness(Number(e.target.value))}
                           className="w-full accent-blue-500 hover:accent-blue-400 h-2 md:h-1 bg-[#2C2C2C] rounded-full appearance-none outline-none cursor-pointer"
                        />
                     </div>

                     <div>
                        <div className="flex justify-between items-center text-[10px] text-[#A0A0A0] mb-1 font-semibold">
                           <span>Smoothing</span>
                           <span className="bg-[#181818] px-1.5 py-0.5 rounded border border-[#3A3A3A] text-[10px] text-white font-mono">{brushSmoothing}%</span>
                        </div>
                        <input
                           type="range" min="0" max="100" step="1" value={brushSmoothing}
                           onChange={(e) => setBrushSmoothing(Number(e.target.value))}
                           className="w-full accent-blue-500 h-1"
                        />
                     </div>

                     <div className="pt-2">
                        <BrushPreview
                           type={brushType}
                           color={brushColor}
                           size={brushSize}
                           opacity={brushOpacity}
                           hardness={brushHardness}
                           flow={brushFlow}
                        />
                     </div>
                  </>
               )}
            </div>
         ) : selectionType ? (
            <>
               {/* Artboard Ownership Info */}
               <div className="mb-4 bg-[#181818] border border-[#2c2c2c] p-2.5 sm:p-3 rounded-xl flex items-center justify-between hover:border-[#3a3a3a] transition-colors">
                  <div className="flex items-center gap-2">
                     <SquareDashed size={14} className="text-slate-400" />
                     <span className="text-[11px] font-semibold text-slate-300 tracking-wide uppercase">Artboard</span>
                  </div>
                  <span className="text-xs text-blue-400 font-mono truncate max-w-[120px] bg-blue-500/10 px-2 py-0.5 rounded">
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
               <div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-[#A0A0A0] mb-3 flex items-center gap-2"><Move size={12} /> Transform</div>
                  <div className="flex gap-2">
                     <button className="flex-1 h-8 sm:h-9 bg-[#2C2C2C] hover:bg-[#3A3A3A] rounded-lg flex justify-center items-center gap-2 text-xs transition border border-[#3A3A3A] active:scale-95" onClick={flipX}><FlipHorizontal size={14} /> Flip X</button>
                     <button className="flex-1 h-8 sm:h-9 bg-[#2C2C2C] hover:bg-[#3A3A3A] rounded-lg flex justify-center items-center gap-2 text-xs transition border border-[#3A3A3A] active:scale-95" onClick={flipY}><FlipVertical size={14} /> Flip Y</button>
                  </div>
               </div>

               {/* Smart Collage Block Customization Panel */}
               <SmartCollageBlockCustomizationPanel />
               {/* Shape Customization Panel */}
               {['rect', 'circle', 'triangle', 'line'].includes(selectionType || '') && (
                  <div className="space-y-4 border-b border-[#2C2C2C] pb-4 animate-fade-in">
                     <div className="text-[10px] uppercase font-bold tracking-wider text-[#A0A0A0] flex items-center gap-2">
                        <Palette size={12} /> Shape Properties
                     </div>

                     {/* Fill and Stroke Colors */}
                     <div className="grid grid-cols-2 gap-2 bg-[#141414] border border-[#222] p-2.5 rounded-lg">
                        {/* Fill color */}
                        {selectionType !== 'line' && (
                           <div className="space-y-1">
                              <span className="text-[9px] uppercase tracking-wider text-[#8A8A8A] block font-bold">Fill Color</span>
                              <div className="flex gap-2">
                                 <div className="w-8 h-8 rounded shrink-0 border border-[#2a2a2a] shadow-inner relative overflow-hidden" style={{ backgroundColor: shapeFillColor }}>
                                    {shapeFillColor === 'transparent' && (
                                       <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-red-500/20 to-transparent flex items-center justify-center">
                                          <div className="w-full h-[1px] bg-red-500 rotate-45" />
                                       </div>
                                    )}
                                    <ColorPickerTrigger
                                       color={shapeFillColor === 'transparent' ? '#ffffff' : shapeFillColor}
                                       onChange={(color) => {
                                          updateSelectedShapeProperty('fill', color);
                                       }}
                                       className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                 </div>
                                 <div className="flex-1 flex flex-col gap-1 justify-center">
                                    <button
                                       type="button"
                                       onClick={() => updateSelectedShapeProperty('fill', 'transparent')}
                                       className="py-1 px-1.5 text-[9px] bg-[#1a1a1a] border border-[#2a2a2a] rounded text-slate-400 hover:text-white"
                                    >
                                       Transparent
                                    </button>
                                 </div>
                              </div>
                           </div>
                        )}

                        {/* Border (Stroke) color */}
                        <div className={selectionType === 'line' ? 'col-span-2 space-y-1' : 'space-y-1'}>
                           <span className="text-[9px] uppercase tracking-wider text-[#8A8A8A] block font-bold">
                              {selectionType === 'line' ? 'Line Color' : 'Border Color'}
                           </span>
                           <div className="flex gap-2">
                              <div className="w-8 h-8 rounded shrink-0 border border-[#2a2a2a] shadow-inner relative overflow-hidden" style={{ backgroundColor: shapeStrokeColor }}>
                                 {shapeStrokeColor === 'transparent' && (
                                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-red-500/20 to-transparent flex items-center justify-center">
                                       <div className="w-full h-[1px] bg-red-500 rotate-45" />
                                    </div>
                                 )}
                                 <ColorPickerTrigger
                                    color={shapeStrokeColor === 'transparent' ? '#ffffff' : shapeStrokeColor}
                                    onChange={(color) => {
                                       updateSelectedShapeProperty('stroke', color);
                                    }}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                 />
                              </div>
                           </div>
                        </div>
                     </div>

                     {/* Border Style (Dashed/Solid/None) & Thickness */}
                     <div className="space-y-3 bg-[#141414] border border-[#222] p-3 rounded-lg">
                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#909090] block pb-1 border-b border-[#222]">
                           {selectionType === 'line' ? 'Line Style & Thickness' : 'Border & Outline Style'}
                        </span>

                        {selectionType !== 'line' && (
                           <div>
                              <span className="text-[9px] text-[#808080] block mb-1">Outline Style</span>
                              <div className="grid grid-cols-3 gap-0.5 bg-[#090909] rounded p-0.5 border border-[#222]">
                                 {['none', 'solid', 'dashed'].map((st) => (
                                    <button
                                       key={st}
                                       type="button"
                                       onClick={() => {
                                          updateSelectedShapeProperty('borderStyle', st);
                                       }}
                                       className={`py-1 text-[9px] font-bold rounded capitalize transition-all ${shapeBorderStyle === st ? 'bg-blue-600 text-white shadow-sm' : 'text-[#8A8A8A] hover:text-white hover:bg-[#1C1C1C]'}`}
                                    >
                                       {st}
                                    </button>
                                 ))}
                              </div>
                           </div>
                        )}

                        {/* Thickness/Stroke Width range slider */}
                        <div>
                           <div className="flex justify-between items-center text-[9px] text-[#8A8A8A] mb-1">
                              <span>{selectionType === 'line' ? 'Line Thickness' : 'Border Thickness'}</span>
                              <span className="font-mono text-blue-400 text-[10px] font-bold">{shapeStrokeWidth}px</span>
                           </div>
                           <input
                              type="range" min={selectionType === 'line' ? "1" : "0"} max="50" step="1"
                              value={shapeStrokeWidth}
                              onChange={(e) => {
                                 const val = Number(e.target.value);
                                 updateSelectedShapeProperty('strokeWidth', val);
                              }}
                              className="w-full h-1 bg-[#2C2C2C] rounded-lg appearance-none cursor-pointer accent-blue-500"
                           />
                        </div>

                        {/* General Opacity control */}
                        <div className="pt-1 border-t border-[#1C1C1C]">
                           <div className="flex justify-between items-center text-[9px] text-[#8A8A8A] mb-1">
                              <span>Opacity</span>
                              <span className="font-mono text-blue-400 text-[10px] font-bold">{shapeOpacity}%</span>
                           </div>
                           <input
                              type="range" min="1" max="100" step="1"
                              value={shapeOpacity}
                              onChange={(e) => {
                                 const val = Number(e.target.value);
                                 updateSelectedShapeProperty('opacity', val);
                              }}
                              className="w-full h-1 bg-[#2C2C2C] rounded-lg appearance-none cursor-pointer accent-blue-500"
                           />
                        </div>
                     </div>

                     {/* Corner Rounding Controls - RECTANGLE ONLY */}
                     {selectionType === 'rect' && (
                        <div className="space-y-3 bg-[#141414] border border-[#222] p-3 rounded-lg">
                           <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#909090] block pb-1 border-b border-[#222]">Corner Rounding</span>

                           <div className="py-1 border-b border-[#1C1C1C]">
                              <ModernCheckbox
                                 checked={shapeUseIndividualCorners}
                                 onChange={(val) => updateSelectedShapeProperty('useIndividualCorners', val)}
                                 label="Round Corners Separately"
                                 labelLeft
                              />
                           </div>

                           {shapeUseIndividualCorners ? (
                              <div className="grid grid-cols-2 gap-x-2 gap-y-2 pt-1">
                                 {/* Top Left */}
                                 <div>
                                    <div className="flex justify-between items-center text-[8px] text-[#8A8A8A] mb-0.5">
                                       <span>Top Left</span>
                                       <span className="font-mono text-blue-400 text-[8px] font-bold">{shapeCornerTL}%</span>
                                    </div>
                                    <input
                                       type="range" min="0" max="100" step="1"
                                       value={shapeCornerTL}
                                       onChange={(e) => {
                                          const val = Number(e.target.value);
                                          updateSelectedShapeProperty('rx_tl', val);
                                       }}
                                       className="w-full h-1 bg-[#2C2C2C] rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                 </div>
                                 {/* Top Right */}
                                 <div>
                                    <div className="flex justify-between items-center text-[8px] text-[#8A8A8A] mb-0.5">
                                       <span>Top Right</span>
                                       <span className="font-mono text-blue-400 text-[8px] font-bold">{shapeCornerTR}%</span>
                                    </div>
                                    <input
                                       type="range" min="0" max="100" step="1"
                                       value={shapeCornerTR}
                                       onChange={(e) => {
                                          const val = Number(e.target.value);
                                          updateSelectedShapeProperty('rx_tr', val);
                                       }}
                                       className="w-full h-1 bg-[#2C2C2C] rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                 </div>
                                 {/* Bottom Left */}
                                 <div>
                                    <div className="flex justify-between items-center text-[8px] text-[#8A8A8A] mb-0.5">
                                       <span>Bottom Left</span>
                                       <span className="font-mono text-blue-400 text-[8px] font-bold">{shapeCornerBL}%</span>
                                    </div>
                                    <input
                                       type="range" min="0" max="100" step="1"
                                       value={shapeCornerBL}
                                       onChange={(e) => {
                                          const val = Number(e.target.value);
                                          updateSelectedShapeProperty('rx_bl', val);
                                       }}
                                       className="w-full h-1 bg-[#2C2C2C] rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                 </div>
                                 {/* Bottom Right */}
                                 <div>
                                    <div className="flex justify-between items-center text-[8px] text-[#8A8A8A] mb-0.5">
                                       <span>Bottom Right</span>
                                       <span className="font-mono text-blue-400 text-[8px] font-bold">{shapeCornerBR}%</span>
                                    </div>
                                    <input
                                       type="range" min="0" max="100" step="1"
                                       value={shapeCornerBR}
                                       onChange={(e) => {
                                          const val = Number(e.target.value);
                                          updateSelectedShapeProperty('rx_br', val);
                                       }}
                                       className="w-full h-1 bg-[#2C2C2C] rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                 </div>
                              </div>
                           ) : (
                              <div>
                                 <div className="flex justify-between items-center text-[9px] text-[#8A8A8A] mb-1">
                                    <span>Corner Rounding (%)</span>
                                    <span className="font-mono text-blue-400 text-[10px] font-bold">{shapeCornerRadius}%</span>
                                 </div>
                                 <input
                                    type="range" min="0" max="100" step="1"
                                    value={shapeCornerRadius}
                                    onChange={(e) => {
                                       const val = Number(e.target.value);
                                       updateSelectedShapeProperty('rx', val);
                                    }}
                                    className="w-full h-1 bg-[#2C2C2C] rounded-lg appearance-none cursor-pointer accent-blue-500"
                                 />
                              </div>
                           )}
                        </div>
                     )}
                  </div>
               )}
               {/* Corner Rounding & Connections for Triangle/Line */}
               {['triangle', 'line'].includes(selectionType || '') && (
                  <div className="space-y-4 border-b border-[#2C2C2C] pb-4 animate-fade-in pl-1">
                     <div className="text-[10px] uppercase font-bold tracking-wider text-[#A0A0A0] flex items-center gap-2">
                        <Palette size={12} /> {selectionType === 'triangle' ? 'Triangle Rounding' : 'Line Join / End Caps'}
                     </div>

                     <div className="space-y-3 bg-[#141414] border border-[#222] p-3 rounded-lg">
                        {/* Line Join selection */}
                        {selectionType !== 'line' && (
                           <div>
                              <span className="text-[9px] text-[#808080] block mb-1">Corner Style</span>
                              <div className="grid grid-cols-3 gap-0.5 bg-[#090909] rounded p-0.5 border border-[#222]">
                                 {[
                                    { id: 'miter', label: 'Sharp' },
                                    { id: 'round', label: 'Rounded' },
                                    { id: 'bevel', label: 'Beveled' }
                                 ].map((st) => (
                                    <button
                                       key={st.id}
                                       type="button"
                                       onClick={() => {
                                          updateSelectedShapeProperty('strokeLineJoin', st.id);
                                       }}
                                       className={`py-1 text-[9px] font-bold rounded capitalize transition-all ${shapeStrokeLineJoin === st.id ? 'bg-blue-600 text-white shadow-sm' : 'text-[#8A8A8A] hover:text-white hover:bg-[#1C1C1C]'}`}
                                    >
                                       {st.label}
                                    </button>
                                 ))}
                              </div>
                              <p className="text-[8px] text-[#606060] mt-1.5 leading-normal">
                                 {shapeStrokeLineJoin === 'round'
                                    ? '✓ Corners are rounded based on Border Thickness.'
                                    : 'ℹ Select "Rounded" to round corners. Customise Border Thickness above to adjust the curve.'}
                              </p>
                           </div>
                        )}

                        {/* Line Cap style - specifically for lines */}
                        {selectionType === 'line' && (
                           <div className="pt-2 border-t border-[#1C1C1C]">
                              <span className="text-[9px] text-[#808080] block mb-1">Line End Caps</span>
                              <div className="grid grid-cols-3 gap-0.5 bg-[#090909] rounded p-0.5 border border-[#222]">
                                 {[
                                    { id: 'butt', label: 'Butt' },
                                    { id: 'round', label: 'Round' },
                                    { id: 'square', label: 'Square' }
                                 ].map((cp) => (
                                    <button
                                       key={cp.id}
                                       type="button"
                                       onClick={() => {
                                          updateSelectedShapeProperty('strokeLineCap', cp.id);
                                       }}
                                       className={`py-1 text-[9px] font-bold rounded capitalize transition-all ${shapeStrokeLineCap === cp.id ? 'bg-blue-600 text-white shadow-sm' : 'text-[#8A8A8A] hover:text-white hover:bg-[#1C1C1C]'}`}
                                    >
                                       {cp.label}
                                    </button>
                                 ))}
                              </div>
                           </div>
                        )}
                     </div>
                  </div>
               )}
               {/* Typography Module */}
               {(selectionType === 'i-text' || selectionType === 'text' || selectionType === 'textbox') && (
                  <TypographyPanel />
               )}

               {/* Image Adjustments Module */}
               {(selectionType === 'image' || selectionType === 'frameGroup') && (
                  <div className="space-y-6">
                     <div className="space-y-3">
                        <div className="text-[10px] uppercase font-bold tracking-wider text-[#A0A0A0] flex items-center gap-2"><Crop size={12} /> Crop & Composition</div>
                        <div className="flex gap-2">
                           <button
                              onClick={() => enterCropMode()}
                              className="flex-1 bg-[#2C2C2C] hover:bg-[#3C3C3C] text-white border border-[#3A3A3A] hover:border-blue-500 rounded text-xs py-2 transition flex items-center justify-center gap-1.5"
                           >
                              <Crop size={14} /> Crop Image
                           </button>
                           <button
                              onClick={() => resetCrop()}
                              className="bg-[#2C2C2C] hover:bg-[#3C3C3C] text-[#808080] hover:text-white border border-[#3A3A3A] rounded px-3 py-2 transition flex items-center justify-center gap-1.5"
                              title="Reset Crop"
                           >
                              <RotateCcw size={14} />
                           </button>
                        </div>
                     </div>

                     <div>
                        <div className="text-[10px] uppercase font-bold tracking-wider text-[#A0A0A0] mb-3 flex items-center gap-2"><Settings size={12} /> Adjustments Non-Destructive</div>
                        <div className="space-y-4">
                           <FilterSlider label="Brightness" min="-0.5" max="0.5" step="0.01" onChange={(v) => applyFilter('brightness', v)} />
                           <FilterSlider label="Contrast" min="-0.5" max="0.5" step="0.01" onChange={(v) => applyFilter('contrast', v)} />
                           <FilterSlider label="Saturation" min="-1" max="1" step="0.01" onChange={(v) => applyFilter('saturation', v)} />
                           <FilterSlider label="Grayscale" min="0" max="1" step="0.01" onChange={(v) => applyFilter('grayscale', v)} />
                        </div>
                     </div>
                  </div>
               )}

               {/* Artboard Assignment and Alignment Module */}
               <ArtboardAssignmentModule />

               {/* Quick Actions */}
               <div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-[#A0A0A0] mb-2 flex items-center gap-2">Actions</div>
                  <div className="flex gap-2">
                     <button className="flex-1 py-1.5 border border-[#3A3A3A] text-[#A0A0A0] hover:text-white bg-[#2C2C2C] hover:bg-[#3A3A3A] rounded text-xs transition-colors flex justify-center items-center" onClick={duplicateActiveObject}><Copy size={12} className="mr-1" /> Duplicate</button>
                     <button className="flex-1 py-1.5 border border-red-900/50 text-red-400 bg-red-950/20 hover:bg-red-900/50 hover:text-white rounded text-xs transition-colors flex justify-center items-center" onClick={deleteActiveObject}><Trash2 size={12} className="mr-1" /> Delete</button>
                  </div>
               </div>
            </>
         ) : (
            <>
               {artboards.find(b => b.id === activeArtboardId) ? (
                  <div className="space-y-6">
                     <div className="flex items-center justify-between">
                        <div className="text-[10px] uppercase font-bold tracking-wider text-[#A0A0A0] flex items-center gap-2"><Square size={12} /> Artboard Properties</div>
                     </div>

                     {/* Smart Background Studio */}
                     <div>
                        <div className="text-[10px] text-[#A0A0A0] mb-2 font-semibold flex items-center gap-1"><Droplets size={12} /> Smart Background</div>
                        <div className="flex gap-2 mb-2">
                           <div className="w-8 h-8 rounded shrink-0 border border-[#3A3A3A] overflow-hidden relative" style={{ backgroundColor: artboards.find(b => b.id === activeArtboardId)?.backgroundColor as string || '#ffffff' }}>
                              <ColorPickerTrigger
                                 color={artboards.find(b => b.id === activeArtboardId)?.backgroundColor as string || '#ffffff'}
                                 onChange={(c) => updateArtboardPropDirect(activeArtboardId, 'backgroundColor', c, true)}
                                 className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              />
                           </div>
                        </div>

                        <div className="grid grid-cols-4 gap-1 mb-2">
                           {['#FFFFFF', '#000000', '#F3F4F6', '#E5E7EB', '#3B82F6', '#EF4444', '#10B981', '#F59E0B'].map(c => (
                              <button key={c} onClick={() => updateArtboardPropDirect(activeArtboardId, 'backgroundColor', c, true)} className="w-full h-8 rounded border border-[#3A3A3A] hover:border-blue-500" style={{ backgroundColor: c }} />
                           ))}
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 mt-2">
                           <button className="py-1.5 px-2 bg-blue-900/20 hover:bg-blue-900/40 border border-blue-500/30 hover:border-blue-500/60 text-blue-400 text-[10px] rounded flex gap-1.5 justify-center items-center font-semibold transition-colors">
                              <Sparkles size={12} /> Auto-Remove BG
                           </button>
                           <button className="py-1.5 px-2 bg-[#2C2C2C] hover:bg-[#3A3A3A] border border-[#3A3A3A] text-white text-[10px] rounded flex gap-1.5 justify-center items-center transition-colors">
                              <LucideImage size={12} /> Gen AI Fill
                           </button>
                        </div>
                     </div>

                     {/* Smart Collage Builder */}
                     <div className="pt-4 border-t border-[#2C2C2C] space-y-3">
                        <div className="text-[10px] text-[#A0A0A0] font-semibold flex items-center justify-between">
                           <div className="flex items-center gap-1"><Layout size={12} /> Smart Collage Builder</div>
                           <span className="text-[9px] text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded">PERFECT FIT</span>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5">
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
                                 className="py-2 bg-[#202020] hover:bg-[#2A2A2A] border border-[#303030] rounded text-[9px] text-[#8A8A8A] hover:text-white flex flex-col items-center justify-center gap-1 transition"
                              >
                                 <div className="w-6 h-6 border border-[#555] rounded-sm opacity-50 flex items-center justify-center text-[8px] font-mono">{c.i}</div>
                                 {c.l}
                              </button>
                           ))}
                        </div>

                        <div className="space-y-2.5 bg-[#1A1A1A] p-2.5 rounded-lg border border-[#262626]">
                           <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">Preset Options (Perfect Fit)</span>

                           <div>
                              <div className="flex justify-between items-center text-[10px] text-[#8A8A8A] mb-1">
                                 <span>Outer Padding (Margin)</span>
                                 <span className="font-mono text-white text-[10px]">{collagePaddingPercent}%</span>
                              </div>
                              <input
                                 type="range" min="0" max="15" step="1"
                                 value={collagePaddingPercent}
                                 onChange={(e) => setCollagePaddingPercent(Number(e.target.value))}
                                 className="w-full h-1 bg-[#2C2C2C] rounded-lg appearance-none cursor-pointer accent-blue-500"
                              />
                           </div>

                           <div>
                              <div className="flex justify-between items-center text-[10px] text-[#8A8A8A] mb-1">
                                 <span>Inner Gap (Spacing)</span>
                                 <span className="font-mono text-white text-[10px]">{collageGapPercent}%</span>
                              </div>
                              <input
                                 type="range" min="0" max="10" step="0.5"
                                 value={collageGapPercent}
                                 onChange={(e) => setCollageGapPercent(Number(e.target.value))}
                                 className="w-full h-1 bg-[#2C2C2C] rounded-lg appearance-none cursor-pointer accent-blue-500"
                              />
                           </div>

                           <div className="grid grid-cols-2 gap-2 pt-1">
                              <div>
                                 <span className="text-[9px] text-[#8A8A8A] block mb-1">Block Fill</span>
                                 <div className="flex gap-1.5 items-center">
                                    <div className="w-5 h-5 rounded border border-[#3A3A3A] shrink-0 relative" style={{ backgroundColor: collageBgColor }}>
                                       <ColorPickerTrigger color={collageBgColor} onChange={setCollageBgColor} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                    </div>
                                 </div>
                              </div>
                              <div>
                                 <span className="text-[9px] text-[#8A8A8A] block mb-1">Border Color</span>
                                 <div className="flex gap-1.5 items-center">
                                    <div className="w-5 h-5 rounded border border-[#3A3A3A] shrink-0 relative" style={{ backgroundColor: collageBorderColor }}>
                                       <ColorPickerTrigger color={collageBorderColor} onChange={setCollageBorderColor} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                    </div>
                                 </div>
                              </div>
                           </div>

                           <div className="grid grid-cols-2 gap-2 pt-1">
                              <div>
                                 <span className="text-[9px] text-[#8A8A8A] block mb-1">Border Width</span>
                                 <input
                                    type="number" min="0" max="10"
                                    value={collageBorderWidth}
                                    onChange={(e) => setCollageBorderWidth(Number(e.target.value))}
                                    className="w-full h-6 bg-[#181818] border border-[#3A3A3A] text-[10px] text-white px-1.5 rounded outline-none focus:border-blue-500"
                                 />
                              </div>
                              <div>
                                 <span className="text-[9px] text-[#8A8A8A] block mb-1">Corner Radius</span>
                                 <input
                                    type="number" min="0" max="100"
                                    value={collageCornerRadius}
                                    onChange={(e) => setCollageCornerRadius(Number(e.target.value))}
                                    className="w-full h-6 bg-[#181818] border border-[#3A3A3A] text-[10px] text-white px-1.5 rounded outline-none focus:border-blue-500"
                                 />
                              </div>
                           </div>

                           <div>
                              <span className="text-[9px] text-[#8A8A8A] block mb-1 font-sans">Border Style</span>
                              <div className="grid grid-cols-3 gap-1 bg-[#181818] border border-[#2A2A2A] rounded p-0.5">
                                 {['none', 'solid', 'dashed'].map((st) => (
                                    <button
                                       key={st}
                                       type="button"
                                       onClick={() => setCollageBorderStyle(st as any)}
                                       className={`py-1 text-[9px] font-semibold rounded capitalize transition ${collageBorderStyle === st ? 'bg-[#3A3A3A] text-white' : 'text-[#8A8A8A] hover:text-white'}`}
                                    >
                                       {st}
                                    </button>
                                 ))}
                              </div>
                           </div>
                        </div>
                     </div>

                     {/* Print Settings */}
                     <div className="pt-4 border-t border-[#2C2C2C]">
                        <div className="text-[10px] text-[#A0A0A0] mb-2 font-semibold flex items-center gap-1"><Printer size={12} /> Print Preparation</div>
                        <div className="space-y-1.5">
                           <ModernCheckbox
                              checked={!!artboards.find(b => b.id === activeArtboardId)?.showMargins}
                              onChange={(val) => updateArtboardPropDirect(activeArtboardId, 'showMargins', val, true)}
                              label='Show Print Margins (0.25")'
                              labelLeft
                           />
                           <div className="flex gap-2">
                              <button
                                 onClick={() => generateBleed(false)}
                                 className="flex-1 py-1.5 px-2 bg-[#2C2C2C] hover:bg-[#3A3A3A] border border-[#3A3A3A] text-white text-[10px] rounded flex gap-1.5 justify-center items-center transition-colors active:scale-95"
                                 title="Add 0.125&#34; Bleed"
                              >
                                 <Plus className="opacity-70" size={12} />
                                 <span>Add Bleed</span>
                              </button>
                              <button
                                 onClick={() => generateBleed(true)}
                                 className="flex-1 py-1.5 px-2 bg-[#2C2C2C] hover:bg-[#3A3A3A] border border-[#3A3A3A] text-white text-[10px] rounded flex gap-1.5 justify-center items-center transition-colors active:scale-95"
                                 title="Remove 0.125&#34; Bleed"
                              >
                                 <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="M5 12h14" /></svg>
                                 <span>Remove Bleed</span>
                              </button>
                           </div>
                        </div>
                     </div>
                  </div>
               ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                     <MousePointer2 size={32} className="mb-4" />
                     <span className="text-sm font-medium">No layer selected</span>
                     <span className="text-xs mt-2 w-48">Select an object or an artboard on the canvas to edit its properties.</span>
                  </div>
               )}
            </>
         )}
         {false && (
            <div className="pt-6 border-t border-[#2C2C2C] space-y-4">
               <div className="text-[10px] uppercase font-bold tracking-wider text-[#A0A0A0] mb-1 flex items-center gap-2"><Brush size={12} /> Brush Engine</div>

               {activeTool === 'brush' && (
                  <div>
                     <label className="text-xs text-[#8A8A8A] block mb-1">Brush Type</label>
                     <select
                        className="w-full h-8 bg-[#181818] border border-[#3A3A3A] rounded text-xs px-2 outline-none text-white focus:border-blue-500"
                        value={brushType || 'pencil'}
                        onChange={(e) => setBrushType(e.target.value)}
                     >
                        <optgroup label="Standard Brushes">
                           <option value="pencil">Pencil</option>
                           <option value="brush">Art Brush</option>
                           <option value="marker">Permanent Marker</option>
                           <option value="highlighter">Highlighter</option>
                        </optgroup>
                        <optgroup label="Technical & Artistic">
                           <option value="ink">Ink Pen</option>
                           <option value="calligraphy">Calligraphy Brush</option>
                           <option value="pixel">Pixel Brush</option>
                           <option value="watercolor">Watercolor Brush</option>
                        </optgroup>
                        <optgroup label="Air & Sprays">
                           <option value="airbrush">Airbrush</option>
                           <option value="spray">Spray / Splatter</option>
                           <option value="chalk">Chalk Brush</option>
                        </optgroup>
                        <optgroup label="Pattern Brushes">
                           <option value="pattern_dots">Pattern - Dots</option>
                           <option value="pattern_dashed">Pattern - Dashed Lines</option>
                           <option value="pattern_texture">Pattern - Texture Stamp</option>
                           <option value="pattern_decorative">Pattern - Decorative Diamonds</option>
                           <option value="pattern_repeating_shapes">Pattern - Repeating Squares</option>
                        </optgroup>
                     </select>
                  </div>
               )}

               <div>
                  <div className="flex justify-between items-center text-[10px] text-[#A0A0A0] mb-1 font-semibold">
                     <span>Brush Size</span>
                     <span className="bg-[#181818] px-1.5 py-0.5 rounded border border-[#3A3A3A] text-[10px] text-white font-mono">{brushSize}px</span>
                  </div>
                  <input
                     type="range" min="1" max="500" step="1" value={brushSize}
                     onChange={(e) => setBrushSize(Number(e.target.value))}
                     className="w-full accent-blue-500 h-1"
                  />
               </div>

               {activeTool === 'brush' && (
                  <>
                     <div>
                        <div className="flex justify-between items-center text-[10px] text-[#A0A0A0] mb-1 font-semibold">
                           <span>Opacity</span>
                           <span className="bg-[#181818] px-1.5 py-0.5 rounded border border-[#3A3A3A] text-[10px] text-white font-mono">{brushOpacity}%</span>
                        </div>
                        <input
                           type="range" min="1" max="100" step="1" value={brushOpacity}
                           onChange={(e) => setBrushOpacity(Number(e.target.value))}
                           className="w-full accent-blue-500 h-1"
                        />
                     </div>

                     <div>
                        <div className="flex justify-between items-center text-[10px] text-[#A0A0A0] mb-1 font-semibold">
                           <span>Flow</span>
                           <span className="bg-[#181818] px-1.5 py-0.5 rounded border border-[#3A3A3A] text-[10px] text-white font-mono">{brushFlow}%</span>
                        </div>
                        <input
                           type="range" min="1" max="100" step="1" value={brushFlow}
                           onChange={(e) => setBrushFlow(Number(e.target.value))}
                           className="w-full accent-blue-500 h-1"
                        />
                     </div>

                     <div>
                        <div className="flex justify-between items-center text-[10px] text-[#A0A0A0] mb-1 font-semibold">
                           <span>Hardness</span>
                           <span className="bg-[#181818] px-1.5 py-0.5 rounded border border-[#3A3A3A] text-[10px] text-white font-mono">{brushHardness}%</span>
                        </div>
                        <input
                           type="range" min="1" max="100" step="1" value={brushHardness}
                           onChange={(e) => setBrushHardness(Number(e.target.value))}
                           className="w-full accent-blue-500 h-1"
                        />
                     </div>

                     <div>
                        <div className="flex justify-between items-center text-[10px] text-[#A0A0A0] mb-1 font-semibold">
                           <span>Smoothing</span>
                           <span className="bg-[#181818] px-1.5 py-0.5 rounded border border-[#3A3A3A] text-[10px] text-white font-mono">{brushSmoothing}%</span>
                        </div>
                        <input
                           type="range" min="0" max="100" step="1" value={brushSmoothing}
                           onChange={(e) => setBrushSmoothing(Number(e.target.value))}
                           className="w-full accent-blue-500 h-1"
                        />
                     </div>

                     <div className="pt-2">
                        <BrushPreview
                           type={brushType}
                           color={brushColor}
                           size={brushSize}
                           opacity={brushOpacity}
                           hardness={brushHardness}
                           flow={brushFlow}
                        />
                     </div>
                  </>
               )}
            </div>
         )}
      </div>
   );
};
