const fs = require('fs');

let code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');

// 1. Add hook imports at the top
const hookImports = `
import { useHistory, useHistoryActions } from './contexts/HistoryContext';
import { useSelection, useSelectionActions } from './contexts/SelectionContext';
import { useClipboardActions } from './contexts/ClipboardContext';
import { useAlignment } from './contexts/AlignmentContext';
import { useSnapping } from './contexts/SnappingContext';
import { useViewport } from './contexts/ViewportContext';
import { useExport } from './contexts/ExportContext';
import { ClipboardProvider } from './contexts/ClipboardContext';
import { AlignmentProvider } from './contexts/AlignmentContext';
import { SnappingProvider } from './contexts/SnappingContext';
import { ViewportProvider } from './contexts/ViewportContext';
import { ExportProvider } from './contexts/ExportContext';
`;
code = code.replace("import * as fabric from \"fabric\";", "import * as fabric from \"fabric\";\n" + hookImports);

// 2. Rename ImageWorkspace to ImageWorkspaceContent
code = code.replace("export default function ImageWorkspace({ path }: ImageWorkspaceProps) {", "function ImageWorkspaceContent({ path }: ImageWorkspaceProps) {");

// 3. Inject hooks at the top of ImageWorkspaceContent
const contentTop = "function ImageWorkspaceContent({ path }: ImageWorkspaceProps) {\n";
const hooksToInject = `
   const { commandIndex, historyNames } = useHistory();
   const { performUndo, performRedo, executeCommand, initializeHistory, detachHistory } = useHistoryActions();
   const { initializeSelection, setParentAlignmentObj, clearSelection } = useSelectionActions();
   const { activeObj, activeObjs, activeSelection, isCollageBlock, isCollageSelected, parentAlignmentObj, selectionType, textObj, textContent } = useSelection();
   const { initializeClipboard, copyActiveObjectAsFormat, duplicateActiveObject } = useClipboardActions();
   const { alignSelection } = useAlignment();
   const { isSnappingEnabled, setIsSnappingEnabled, snapTolerance, setSnapTolerance, guides, clearSnapping } = useSnapping();
   const { zoomPercent, setZoomPercent, fitView, validateViewport, handleWheelZoom } = useViewport();
   const { exportTarget, setExportTarget, selectedExportIds, setSelectedExportIds, exportSettings, setExportSettings, isExporting, handleExport, comparisonMode, setComparisonMode, originalImageUrl, optimizedImageUrl, psnr, originalSize, optimizedSize, currentPreviewOp, isGeneratingPreview, originalPreviewDims, optimizedPreviewDims, generateLivePreview } = useExport();

`;
code = code.replace(contentTop, contentTop + hooksToInject);

// 4. In useEffect that creates canvas, initialize the controllers
const canvasInitPattern = /            fabricRef\.current = newCanvas;\n/g;
code = code.replace(canvasInitPattern, `            fabricRef.current = newCanvas;\n            initializeHistory(newCanvas, updateLayersList, setIsInternalChange);\n            initializeSelection(newCanvas);\n            initializeClipboard(newCanvas);\n`);

// 5. Remove the old Local SelectionProvider wrapper
const selProvPattern = /            <SelectionProvider value=\{\{[\s\S]*?\}\}>\n/g;
code = code.replace(selProvPattern, "");

// 6. Remove the old Local HistoryProvider wrapper
const histProvPattern = /               <HistoryProvider value=\{\{[\s\S]*?\}\}>\n/g;
code = code.replace(histProvPattern, "");

// 7. Remove the new Providers from the return statement
code = code.replace(/                        <ClipboardProvider>\n/g, "");
code = code.replace(/                           <AlignmentProvider>\n/g, "");
code = code.replace(/                              <SnappingProvider>\n/g, "");
code = code.replace(/                                 <ViewportProvider>\n/g, "");
code = code.replace(/                                    <ExportProvider>\n/g, "");

// 8. Remove the closing tags for all removed providers
code = code.replace(/                                    <\/ExportProvider>\n/g, "");
code = code.replace(/                                 <\/ViewportProvider>\n/g, "");
code = code.replace(/                              <\/SnappingProvider>\n/g, "");
code = code.replace(/                           <\/AlignmentProvider>\n/g, "");
code = code.replace(/                        <\/ClipboardProvider>\n/g, "");
code = code.replace(/               <\/HistoryProvider>\n/g, "");
code = code.replace(/            <\/SelectionProvider>\n/g, "");

// 9. Append the Wrapper Component
const wrapperComponent = `

export default function ImageWorkspace(props: ImageWorkspaceProps) {
   return (
      <HistoryProvider>
         <SelectionProvider>
            <ClipboardProvider>
               <AlignmentProvider>
                  <SnappingProvider>
                     <ViewportProvider>
                        <ExportProvider>
                           <ImageWorkspaceContent {...props} />
                        </ExportProvider>
                     </ViewportProvider>
                  </SnappingProvider>
               </AlignmentProvider>
            </ClipboardProvider>
         </SelectionProvider>
      </HistoryProvider>
   );
}
`;
code += wrapperComponent;

fs.writeFileSync('src/components/image-workspace/ImageWorkspace.tsx', code);
console.log("Splitting completed.");
