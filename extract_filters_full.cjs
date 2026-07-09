const fs = require('fs');
const code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');

// 1. Get JSX block
const startTag = '{/* FILTER STUDIO PANEL */}';
const endTag = '{/* LAYERS PANEL */}';

const startIndex = code.indexOf(startTag);
const endIndex = code.indexOf(endTag);
const block = code.substring(startIndex, endIndex);

const divStart = block.indexOf('<div className="p-0 h-full flex flex-col relative text-[#D4D4D4] font-sans selection:bg-blue-500/30">');
const divEnd = block.lastIndexOf('</div>');
const jsx = block.substring(divStart, divEnd + 6);

// 2. Get Methods block
const methStart = code.indexOf('const applyFilterStack =');
const nextMeth = code.indexOf('// jSquash Export Pipeline');
const methodsBlock = code.substring(methStart, nextMeth).trim();

// 3. Create FilterStudioTab.tsx
const finalCode = `import React, { useState, useEffect } from 'react';
import { 
  Sliders, Plus, MoveUp, MoveDown, Copy, Trash2, X, Save, Sparkles, Download, ArrowUp, Zap
} from 'lucide-react';
import * as fabric from 'fabric';
import { useWorkspaceUI } from '../../../contexts/WorkspaceUIContext';
import { useCanvas } from '../../../contexts/CanvasContext';
import { useHistory } from '../../../contexts/HistoryContext';
import { FilterPipelineCommand } from '../../../commands/filter/FilterPipelineCommand';
import { FilterConfig } from '../../../types/filters';

export const FilterStudioTab: React.FC = () => {
  const { 
    imageFilters, setImageFilters, benchmarkInfo, setBenchmarkInfo
  } = useWorkspaceUI();

  const { fabricRef } = useCanvas();
  const { executeCommand } = useHistory();

  const [customPresets, setCustomPresets] = useState<{ name: string; stack: FilterConfig[] }[]>([]);
  const [newPresetName, setNewPresetName] = useState("");
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("workspace_custom_filters_presets");
      if (saved) {
        setCustomPresets(JSON.parse(saved));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const getTargetImageForFilters = () => {
    let obj = fabricRef.current?.getActiveObject() as any;
    if (obj && obj.get('isFrameGroup')) {
       const items = obj.getObjects();
       obj = items.find((i: any) => i.type === 'image') || obj;
    }
    return obj;
  };

  ${methodsBlock}

  return (
    <>
${jsx}
    </>
  );
};
`;

fs.writeFileSync('src/components/image-workspace/components/panels/FilterStudioTab.tsx', finalCode);

// 4. Remove Methods and JSX from ImageWorkspace.tsx
const beforeMeth = code.substring(0, methStart);
const afterMeth = code.substring(nextMeth);
const codeWithoutMeth = beforeMeth + afterMeth;

const newStartIndex = codeWithoutMeth.indexOf(startTag);
const newEndIndex = codeWithoutMeth.indexOf(endTag);
const newBlock = codeWithoutMeth.substring(newStartIndex, newEndIndex);

const newDivStart = newBlock.indexOf('<div className="p-0 h-full flex flex-col relative text-[#D4D4D4] font-sans selection:bg-blue-500/30">');
const newDivEnd = newBlock.lastIndexOf('</div>');

const beforeDiv = newBlock.substring(0, newDivStart);
const afterDiv = newBlock.substring(newDivEnd + 6);
const finalBlock = beforeDiv + '<FilterStudioTab />\n' + afterDiv;

const newCode = codeWithoutMeth.substring(0, newStartIndex) + finalBlock + codeWithoutMeth.substring(newEndIndex);

fs.writeFileSync('src/components/image-workspace/ImageWorkspace.tsx', newCode);

console.log("FilterStudioTab extracted and methods moved successfully");
