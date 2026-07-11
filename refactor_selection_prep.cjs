const fs = require('fs');

let code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');

// 1. Rename ImageWorkspace to ImageWorkspaceContent
code = code.replace(/export default function ImageWorkspace\(\s*\{/, 'function ImageWorkspaceContent({');

// 2. Add the wrapper at the bottom
const wrapper = `
export default function ImageWorkspace(props: any) {
   return (
      <SelectionProvider>
         <ImageWorkspaceContent {...props} />
      </SelectionProvider>
   );
}
`;
code += wrapper;

// 3. Import SelectionProvider and hooks
const imports = `import { SelectionProvider, useSelection, useSelectionActions } from "./contexts/SelectionContext";\n`;
// Replace the old import
code = code.replace(/import { SelectionProvider } from '\.\/contexts\/SelectionContext';/, imports);
// Also remove old useSelection if any, but let's just make sure we only have one import.
// Actually, I can just insert it at the top.
code = code.replace('import React, { ', 'import React, { '); 

// 4. Inside ImageWorkspaceContent, replace states
const stateToRemove = [
   `const [selectionType, setSelectionType] = useState<string | null>(null);`,
   `const [parentAlignmentObj, setParentAlignmentObj] = useState<fabric.Object | null>(null);`,
   `const parentAlignmentObjRef = useRef<fabric.Object | null>(null);`
];
for (const s of stateToRemove) {
   code = code.replace(s, '');
}

// 5. Add useSelection inside ImageWorkspaceContent
const hookCode = `
   const { activeObject: activeObj, activeObjects: activeObjs, activeSelection, selectionType, parentAlignmentObj, textContent, textObj, isCollageBlock, isCollageSelected } = useSelection();
   const { initializeSelection, detachSelection, setParentAlignmentObj } = useSelectionActions();
`;
code = code.replace('const [zoomPercent, setZoomPercent] = useState(100);', hookCode + '\n   const [zoomPercent, setZoomPercent] = useState(100);');

// 6. Remove handleSelectionContext
const handleSelectionRegex = /const handleSelectionContext = useCallback\(\(e: any\) => \{[\s\S]*?\}, \[updateLayersList, handleSelectionContext\]\);/g;
// Wait, the regex might fail because it references itself in the deps array? The deps array is `[updateLayersList, handleSelectionContext]`.
// Let's just find the index of `const handleSelectionContext = useCallback(` and the matching `}, [updateLayersList]);` or similar.
// It's safer to just replace using string search.

const handleStart = code.indexOf('const handleSelectionContext = useCallback((e: any) => {');
if (handleStart !== -1) {
    const handleEndStr = '}, [updateLayersList, handleSelectionContext]);';
    let handleEnd = code.indexOf(handleEndStr, handleStart);
    if (handleEnd !== -1) {
        // Wait, handleSelectionContext appears MULTIPLE times in ImageWorkspace.tsx? 
        // No, it's defined once, and used in deps array of performUndo, performRedo etc.
        // Let's remove the definition.
        // The definition actually doesn't have handleSelectionContext in its own deps!
        // The definition is: }, [updateLayersList]);
        // Let's find the exact end of definition.
    }
}
