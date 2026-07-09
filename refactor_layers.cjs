const fs = require('fs');

let code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');

// 1. Add imports
code = code.replace(/import \{([^}]+)\} from '\.\/contexts\/WorkspaceUIContext';/, 
  "import {$1} from './contexts/WorkspaceUIContext';\nimport { LayersProvider } from './contexts/LayersContext';\nimport { useLayersPanel } from './hooks/useLayersPanel';\nimport { LayersTab } from './components/panels/LayersTab';"
);

// 2. Replace state definitions
code = code.replace(/const \[layers, setLayers\] = useState<fabric\.Object\[\]>\(\[\]\);\s+const \[selectedLayerId, setSelectedLayerId\] = useState<string \| null>\(null\);/, 
  "const layersPanel = useLayersPanel(fabricRef, executeCommand);\n   const { layers, selectedLayerId } = layersPanel;"
);

// 3. Remove updateLayersList
code = code.replace(/const updateLayersList = useCallback\(\(\) => \{[\s\S]*?\}, \[\]\);\s+/, '');
code = code.replace(/const updateLayersList = useCallback\(\(\) => \{[\s\S]*?\}, \[\]\);\s+/, '');

// 4. Remove getLayersOrder
code = code.replace(/const getLayersOrder = useCallback\(\(\) => \{[\s\S]*?\}, \[\]\);\s+/, '');

// 5. Remove handleLayerOrder
code = code.replace(/const handleLayerOrder = useCallback\(\(action: 'front' \| 'forward' \| 'backward' \| 'back'\) => \{[\s\S]*?\}, \[getLayersOrder, executeCommand, updateLayersList\]\);\s+/, '');

// 6. Remove selectLayer
code = code.replace(/const selectLayer = \(id: string\) => \{[\s\S]*?\};\s+/, '');

// 7. Remove moveLayerUp
code = code.replace(/const moveLayerUp = \(id: string\) => \{[\s\S]*?\};\s+/, '');

// 8. Remove moveLayerDown
code = code.replace(/const moveLayerDown = \(id: string\) => \{[\s\S]*?\};\s+/, '');

// 9. Add provider
code = code.replace(/<WorkspaceUIProvider value=\{\{([\s\S]*?)\}\}>/, 
  "<WorkspaceUIProvider value={{$1}}>\n                     <LayersProvider value={layersPanel}>"
);
code = code.replace(/<\/WorkspaceUIProvider>/g, 
  "</LayersProvider>\n                  </WorkspaceUIProvider>"
);

// 10. Replace Layers Panel JSX with LayersTab component
code = code.replace(/\{\/\* LAYERS PANEL \*\/\}\s+\{activeTab === 'layers' && \([\s\S]*?\}\s+<\/div>\s+\)\}/, 
  "{/* LAYERS PANEL */}\n                                 {activeTab === 'layers' && <LayersTab />}"
);

fs.writeFileSync('src/components/image-workspace/ImageWorkspace.tsx', code);
console.log('Refactoring complete.');
