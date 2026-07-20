const fs = require('fs');
const lines = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8').split('\n');

const jsx = lines.slice(6959, 7212).join('\n');

const finalCode = `import React from 'react';
import { 
  SquareDashed, Plus, X, Copy, Trash2, Layout, Maximize, ChevronDown
} from 'lucide-react';
import { useWorkspaceUI } from '../../../contexts/WorkspaceUIContext';
import { useCanvas } from '../../../contexts/CanvasContext';
import { ARTBOARD_PRESETS } from '../../../types/artboards';
import { ModernCheckbox } from '../../shared/ModernCheckbox';
import { PRESET_REGISTRY } from '../../../../lib/imagePresets';

export const ArtboardsTab: React.FC = () => {
  const { 
    artboards, activeArtboardId, setActiveArtboardId,
    createArtboard, createArtboardFromPreset, duplicateArtboard, deleteArtboard,
    updateArtboardProp, onArtboardPropStart, onArtboardPropCommit
  } = useWorkspaceUI();

  const { updateArtboardPropDirect } = useCanvas();

  return (
    <>
${jsx}
    </>
  );
};
`;

fs.writeFileSync('src/components/image-workspace/components/panels/ArtboardsTab.tsx', finalCode);
console.log("ArtboardsTab extracted correctly");
