const fs = require('fs');

let code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');

// 1. Rename main export
code = code.replace('export default function ImageWorkspace(props: any) {', 'function ImageWorkspaceContent(props: any) {');

// 2. Add the provider wrapper
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

// 3. Import SelectionProvider and hooks (it already imports SelectionProvider, replace it)
const oldImport = "import { SelectionProvider } from './contexts/SelectionContext';";
const newImport = "import { SelectionProvider, useSelection, useSelectionActions } from './contexts/SelectionContext';";
code = code.replace(oldImport, newImport);

// 4. State removal
code = code.replace('const [selectionType, setSelectionType] = useState<string | null>(null);\n', '');
code = code.replace('const [parentAlignmentObj, setParentAlignmentObj] = useState<fabric.Object | null>(null);\n', '');
code = code.replace('const parentAlignmentObjRef = useRef<fabric.Object | null>(null);\n', '');

// 5. Inject useSelection hooks
const hookInjectionPoint = 'const [zoomPercent, setZoomPercent] = useState(100);';
const hooks = `
   const { activeObject: activeObj, activeObjects: activeObjs, activeSelection, selectionType, parentAlignmentObj, textContent, textObj, isCollageBlock, isCollageSelected } = useSelection();
   const { initializeSelection, detachSelection, setParentAlignmentObj } = useSelectionActions();
`;
code = code.replace(hookInjectionPoint, hooks + '\n   ' + hookInjectionPoint);

// 6. Fix setSelectionType usages
// ImageWorkspace no longer has setSelectionType. The only places it was used were handleSelectionContext (removed) and setupCanvas or something?
// Let's remove handleSelectionContext completely.
const handleStartIdx = code.indexOf('const handleSelectionContext = useCallback((e: any) => {');
if (handleStartIdx !== -1) {
   const handleEndIdx = code.indexOf('}, [updateLayersList]);', handleStartIdx) + '}, [updateLayersList]);'.length;
   code = code.substring(0, handleStartIdx) + code.substring(handleEndIdx);
}

// Also remove it from deps arrays:
code = code.replace(/, handleSelectionContext/g, '');
// Also remove handleSelectionContext(null)
code = code.replace(/handleSelectionContext\(null\);/g, '');

// 7. Remove selection listeners from useEffect
code = code.replace("canvas.on('selection:created', handleSelectionContext);\n", '');
code = code.replace("canvas.on('selection:updated', handleSelectionContext);\n", '');
code = code.replace("canvas.on('selection:cleared', handleSelectionContext);\n", '');

// 8. Add initializeSelection to canvas mount
const setupPoint = "setCanvas(canvas);\n";
code = code.replace(setupPoint, setupPoint + "            initializeSelection(canvas);\n");

// 9. Remove the old <SelectionProvider value={{...}}> block
// It spans from <SelectionProvider value={{ to }}>. Let's find it.
const startProvider = code.indexOf('<SelectionProvider value={{');
if (startProvider !== -1) {
    const endProvider = code.indexOf('}}>', startProvider) + 3;
    code = code.substring(0, startProvider) + '<>\n' + code.substring(endProvider);
    // Remove the closing tag
    code = code.replace('</SelectionProvider>', '</>');
}

fs.writeFileSync('src/components/image-workspace/ImageWorkspace.tsx', code);
console.log('Refactoring complete.');
