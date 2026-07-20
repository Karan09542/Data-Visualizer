const fs = require('fs');
const code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');

const startStr = '{/* ARTBOARDS PANEL */}';
const endStr = '{/* QUICK ACTIONS PANEL */}';

const start = code.indexOf(startStr);
const end = code.indexOf(endStr, start);

const block = code.substring(start, end);
const match = block.match(/\{activeTab === 'artboards' && \(\s*([\s\S]+?)\s*\)\}/);

let jsx = '';
if (match) {
    jsx = match[1];
} else {
    console.error("Could not match the block!");
    process.exit(1);
}

const finalCode = `import React from 'react';
import { 
  SquareDashed, Plus, X, Copy, Trash2, Layout, Maximize
} from 'lucide-react';
import { useWorkspaceUI } from '../../contexts/WorkspaceUIContext';
import { useCanvas } from '../../contexts/CanvasContext';
import { ARTBOARD_PRESETS } from '../../types/artboards';
import { ModernCheckbox } from '../shared/ModernCheckbox';

export const ArtboardsTab: React.FC = () => {
  const { 
    artboards, activeArtboardId, setActiveArtboardId,
    createArtboard, createArtboardFromPreset, duplicateArtboard, deleteArtboard,
    updateArtboardProp, onArtboardPropStart, onArtboardPropCommit
  } = useWorkspaceUI();

  const { updateArtboardPropDirect } = useCanvas();

  return (
    <>
      {/* ARTBOARDS PANEL */}
      ${jsx}
    </>
  );
};
`;

fs.writeFileSync('src/components/image-workspace/components/panels/ArtboardsTab.tsx', finalCode);
console.log("ArtboardsTab fixed and created successfully");
