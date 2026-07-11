const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'image-workspace', 'ImageWorkspace.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Wrap ImageWorkspace with HistoryProvider
const workspaceWrapperRegex = /export default function ImageWorkspace\(props: any\) \{\n   return \(\n      <SelectionProvider>\n         <ImageWorkspaceContent \{\.\.\.props\} \/>\n      <\/SelectionProvider>\n   \);\n\}/g;
code = code.replace(
  workspaceWrapperRegex,
  `export default function ImageWorkspace(props: any) {\n   return (\n      <HistoryProvider>\n         <SelectionProvider>\n            <ImageWorkspaceContent {...props} />\n         </SelectionProvider>\n      </HistoryProvider>\n   );\n}`
);

// 2. Add imports
code = code.replace(
  "import { HistoryProvider } from './contexts/HistoryContext';",
  "import { HistoryProvider, useHistoryActions } from './contexts/HistoryContext';"
);

// 3. Setup hooks in ImageWorkspaceContent
const hooksInjectionPoint = /   const \{ initializeSelection, detachSelection, setParentAlignmentObj \} = useSelectionActions\(\);\n/g;
code = code.replace(
  hooksInjectionPoint,
  "   const { initializeSelection, detachSelection, setParentAlignmentObj } = useSelectionActions();\n   const { executeCommand, initializeHistory } = useHistoryActions();\n   const setIsInternalChange = useCallback((val: boolean) => { isInternalChange.current = val; }, []);\n"
);

// 4. Remove state declarations for history
code = code.replace(/   const \[commandIndex, setCommandIndex\] = useState\(-1\);\n/g, '');
code = code.replace(/   const \[historyNames, setHistoryNames\] = useState<string\[\]>\(\[\]\);\n/g, '');
code = code.replace(/   const commandsListRef = useRef<Command\[\]>\(\[\]\);\n/g, '');
code = code.replace(/   const commandIndexRef = useRef\(-1\);\n/g, '');

// 5. Initialize History in useEffect
const initializeSelectionCallRegex = /      initializeSelection\(canvas\);\n/g;
code = code.replace(
  initializeSelectionCallRegex,
  "      initializeSelection(canvas);\n      initializeHistory(canvas, updateLayersList, setIsInternalChange);\n"
);

// 6. Remove executeCommand, performUndo, performRedo, jumpToHistory implementations
const executeCommandRegex = /   \/\/ History Execute Core Engine[\s\S]*?   \}, \[updateLayersList\]\);\n\n/g;
code = code.replace(executeCommandRegex, '');

const undoRedoRegex = /   const performUndo = useCallback\(\(\) => \{[\s\S]*?   \}, \[updateLayersList\]\);\n\n   const performRedo = useCallback\(\(\) => \{[\s\S]*?   \}, \[updateLayersList\]\);\n\n   const jumpToHistory = useCallback\(\(idx: number\) => \{[\s\S]*?   \}, \[updateLayersList\]\);\n/g;
code = code.replace(undoRedoRegex, '');

// 7. Remove deep HistoryProvider
const oldHistoryProviderRegex = /      <HistoryProvider value=\{\{ commandIndex, historyNames, performUndo, performRedo, executeCommand \}\}>\n/g;
code = code.replace(oldHistoryProviderRegex, '');

const oldHistoryProviderEndRegex = /            <\/HistoryProvider>\n/g;
code = code.replace(oldHistoryProviderEndRegex, '');

fs.writeFileSync(filePath, code);
console.log('Script completed successfully');
