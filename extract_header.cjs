const fs = require('fs');

const jsx = fs.readFileSync('scratch_properties.txt', 'utf8');

const code = `import React from 'react';
import * as fabric from 'fabric';
import { 
  Brush, FlipHorizontal, FlipVertical, Move, SquareDashed, Layout, 
  Circle, Square, Palette, MousePointer2, BoxSelect, Maximize, 
  AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, 
  AlignEndVertical, AlignStartHorizontal, AlignStartVertical, 
  FlipHorizontal2, Grid, AlignLeft, AlignCenter, AlignRight, Underline, Bold, Italic, 
  Type, CaseUpper, CaseLower, Space, RotateCw, Spline, ArrowDownToLine, 
  ArrowUpToLine, ArrowDown, ArrowUp, Zap, Sliders, Scissors, Sun, 
  Contrast, Droplet, Check, Copy, Trash2, Crop, RotateCcw, Settings, 
  Droplets, Sparkles, LucideImage, Printer, Plus, ChevronUp, AlignJustify, ChevronDown
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
import { FontPicker } from '../../../../FontPicker';
import { TypographyPresets } from '../../../../TypographyPresets';

export const PropertiesTab: React.FC = () => {
  const { 
    activeTool, brushType, setBrushType, brushSize, setBrushSize, 
    brushOpacity, setBrushOpacity, brushHardness, setBrushHardness, 
    brushFlow, setBrushFlow, brushSmoothing, setBrushSmoothing, 
    textProps, setTextProps, brushColor
  } = useTool();

  const { 
    fabricRef, flipX, flipY, addAlignedCollageText, updateSelectedShapeProperty, 
    changeTextProp, applyFilter, alignSelection, duplicateActiveObject, 
    deleteActiveObject, updateArtboardPropDirect, generateSmartCollage, 
    generateBleed, enterCropMode, resetCrop, updateCollageBlockStyleProperty, fillCollageBlockWithImage
  } = useCanvas();

  const { artboards, activeArtboardId, imageFilters } = useWorkspaceUI();

  const {
    selectionType, parentAlignmentObj, setParentAlignmentObj, isCollageBlock, isCollageSelected
  } = useSelection();
  
  const { executeCommand } = useHistory();

  // Create local ref to solve parentAlignmentObjRef issue
  const parentAlignmentObjRef = React.useRef(parentAlignmentObj);
  React.useEffect(() => {
    parentAlignmentObjRef.current = parentAlignmentObj;
  }, [parentAlignmentObj]);

  const {
    collagePaddingPercent, setCollagePaddingPercent, collageGapPercent, setCollageGapPercent,
    collageBgColor, setCollageBgColor, collageBorderColor, setCollageBorderColor,
    collageBorderWidth, setCollageBorderWidth, collageCornerRadius, setCollageCornerRadius,
    collageBorderStyle, setCollageBorderStyle,
    useIndividualCorners, collageCornerTL, collageCornerTR, collageCornerBL, collageCornerBR
  } = useCollageConfig();

  const {
    shapeStrokeLineCap, shapeStrokeLineJoin, shapeFillColor, shapeStrokeColor, shapeStrokeWidth,
    shapeBorderStyle, shapeOpacity,
    shapeUseIndividualCorners, shapeCornerTL, shapeCornerTR, shapeCornerBL, shapeCornerBR, shapeCornerRadius
  } = useShapeProperties();

  return (
    ${jsx}
  );
};
`;

fs.writeFileSync('src/components/image-workspace/components/panels/PropertiesTab/index.tsx', code);
console.log("PropertiesTab created successfully");
