const fs = require('fs');
const code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');

const startTag = '{/* ARTBOARDS PANEL */}';
const endTag = '{/* QUICK ACTIONS PANEL */}';

const startIndex = code.indexOf(startTag);
const endIndex = code.indexOf(endTag);

const block = code.substring(startIndex, endIndex);
// block looks like:
// {/* ARTBOARDS PANEL */}
// {activeTab === 'artboards' && (
//   <div className="...">
//     ...
//   </div>
// )}

const divStart = block.indexOf('<div className="flex flex-col h-full overflow-hidden text-white font-sans selection:bg-blue-500/30">');
const divEnd = block.lastIndexOf('</div>');

const jsx = block.substring(divStart, divEnd + 6);

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
console.log("ArtboardsTab extracted correctly using indexOf");
