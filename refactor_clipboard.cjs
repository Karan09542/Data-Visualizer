const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'image-workspace', 'ImageWorkspace.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// Normalize line endings to LF
code = code.replace(/\r\n/g, '\n');

// 1. Add imports
code = code.replace(
  "import { HistoryProvider } from './contexts/HistoryContext';",
  "import { HistoryProvider, useHistoryActions } from './contexts/HistoryContext';\nimport { ClipboardProvider, useClipboardActions } from './contexts/ClipboardContext';"
);

// 2. Wrap ImageWorkspace with ClipboardProvider
const wrapperPattern = /export default function ImageWorkspace\(props: any\) \{\n   return \(\n      <HistoryProvider>\n         <SelectionProvider>\n            <ImageWorkspaceContent \{\.\.\.props\} \/>\n         <\/SelectionProvider>\n      <\/HistoryProvider>\n   \);\n\}/g;
code = code.replace(
  wrapperPattern,
  `export default function ImageWorkspace(props: any) {\n   return (\n      <ClipboardProvider>\n         <HistoryProvider>\n            <SelectionProvider>\n               <ImageWorkspaceContent {...props} />\n            </SelectionProvider>\n         </HistoryProvider>\n      </ClipboardProvider>\n   );\n}`
);

// 3. Inject hooks in ImageWorkspaceContent
const hooksInjectionPoint = /   const containerRef = useRef<HTMLDivElement>\(null\);\n/g;
code = code.replace(
  hooksInjectionPoint,
  `   const containerRef = useRef<HTMLDivElement>(null);\n\n   const { executeCommand, initializeHistory } = useHistoryActions();\n   const { initializeClipboard, copyActiveObjectAsFormat, duplicateActiveObject, duplicateArtboard } = useClipboardActions();\n`
);

// 4. Initialize History and Clipboard inside useEffect
const initPattern = /      fabricRef\.current = canvas;\n/g;
code = code.replace(
  initPattern,
  `      fabricRef.current = canvas;\n\n      initializeHistory(canvas, updateLayersList, () => {});\n      initializeClipboard({\n         canvas,\n         getActiveArtboardId: () => activeArtboardIdRef.current,\n         getArtboards: () => artboardsRef.current,\n         setArtboards,\n         setActiveArtboardId,\n         updateLayersList,\n         executeCommand,\n         setNotification,\n         setSelectedExportIds\n      });\n`
);

// 5. Remove copyActiveObjectAsFormat
const copyRegex = /   const copyActiveObjectAsFormat = async \([\s\S]*?   \};\n/g;
code = code.replace(copyRegex, '');

// 6. Remove duplicateActiveObject
const dupObjRegex = /   const duplicateActiveObject = \(\) => \{[\s\S]*?   \};\n/g;
code = code.replace(dupObjRegex, '');

// 7. Remove duplicateArtboard
const dupArtRegex = /   const duplicateArtboard = \(board: Artboard\) => \{[\s\S]*?   \};\n/g;
code = code.replace(dupArtRegex, '');

// 8. Remove global handlePaste
const pasteRegex = /      const handlePaste = async \(e: ClipboardEvent\) => \{[\s\S]*?      return \(\) => window\.removeEventListener\('paste', handlePaste\);\n/g;
code = code.replace(pasteRegex, '');

fs.writeFileSync(filePath, code);
console.log('Script completed successfully');
