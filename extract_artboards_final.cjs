const fs = require('fs');
const lines = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8').split('\n');

const jsx = lines.slice(6959, 7212).join('\n');

const finalCode = `import React, { useState } from 'react';
import { 
  SquareDashed, Plus, X, Copy, Trash2, Layout, Maximize, ChevronDown
} from 'lucide-react';
import { useWorkspaceUI } from '../../../contexts/WorkspaceUIContext';
import { useCanvas } from '../../../contexts/CanvasContext';
import { useHistory } from '../../../contexts/HistoryContext';
import { ARTBOARD_PRESETS } from '../../../types/artboards';
import { ModernCheckbox } from '../../shared/ModernCheckbox';
import { PRESET_REGISTRY } from '../../../../lib/imagePresets';
import { ColorPickerTrigger } from '../../shared/ColorPickers';

export const ArtboardsTab: React.FC = () => {
  const { 
    artboards, setArtboards, activeArtboardId, setActiveArtboardId,
    createArtboard, createArtboardFromPreset, duplicateArtboard, deleteArtboard,
    updateArtboardProp, onArtboardPropStart, onArtboardPropCommit
  } = useWorkspaceUI();

  const { updateArtboardPropDirect, fabricRef, setZoomPercent } = useCanvas();
  const { executeCommand } = useHistory();

  const [draggedArtboardIdx, setDraggedArtboardIdx] = useState<number | null>(null);
  const [dragOverArtboardIdx, setDragOverArtboardIdx] = useState<number | null>(null);

  const moveArtboard = (sourceIndex: number, destIndex: number) => {
    if (sourceIndex === destIndex) return;
    const newArtboards = [...artboards];
    const [removed] = newArtboards.splice(sourceIndex, 1);
    newArtboards.splice(destIndex, 0, removed);
    
    // Command history integration
    const cmd = {
       name: "Reorder Artboards",
       execute: () => { setArtboards(newArtboards); },
       undo: () => {
          const revertArtboards = [...newArtboards];
          const [popped] = revertArtboards.splice(destIndex, 1);
          revertArtboards.splice(sourceIndex, 0, popped);
          setArtboards(revertArtboards);
       }
    };
    executeCommand(cmd as any);
  };

  return (
    <>
${jsx}
    </>
  );
};
`;

fs.writeFileSync('src/components/image-workspace/components/panels/ArtboardsTab.tsx', finalCode);
console.log("ArtboardsTab generated with all missing dependencies");
