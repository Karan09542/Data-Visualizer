const fs = require('fs');

let jsx = fs.readFileSync('scratch_filters.txt', 'utf8');

// The JSX starts with:
// {/* FILTER STUDIO PANEL */}
// {activeTab === 'filters' && (
//    <div className="p-4 space-y-6 text-[#C0C0C0]">
// We want to remove the activeTab wrapper line.

const activeTabLine = "{activeTab === 'filters' && (";
jsx = jsx.replace(activeTabLine, "");

// Read the methods block from the scratch file
let methodsBlock = fs.readFileSync('scratch_filter_methods.txt', 'utf8');

const finalCode = `import React, { useState, useEffect } from 'react';
import { 
  Sliders, Plus, MoveUp, MoveDown, Copy, Trash2, X, Save, Sparkles, Download, ArrowUp, Zap, Activity
} from 'lucide-react';
import * as fabric from 'fabric';
import { useWorkspaceUI } from '../../../contexts/WorkspaceUIContext';
import { useCanvas } from '../../../contexts/CanvasContext';
import { useHistory } from '../../../contexts/HistoryContext';
import { FilterPipelineCommand } from '../../../commands/filter/FilterPipelineCommand';
import { FilterConfig } from '../../../types/filters';

export const FilterStudioTab: React.FC = () => {
  const { 
    imageFilters, setImageFilters, benchmarkInfo, setBenchmarkInfo, selectionType
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
console.log("FilterStudioTab regenerated");
