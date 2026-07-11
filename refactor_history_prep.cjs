const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'image-workspace', 'ImageWorkspace.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Remove state declarations for history
code = code.replace(/   const \[commandIndex, setCommandIndex\] = useState\(-1\);\n/g, '');
code = code.replace(/   const \[historyNames, setHistoryNames\] = useState<string\[\]>\(\[\]\);\n/g, '');
code = code.replace(/   const commandsListRef = useRef<Command\[\]>\(\[\]\);\n/g, '');
code = code.replace(/   const commandIndexRef = useRef\(-1\);\n/g, '');

// 2. Add History hooks imports and usage
code = code.replace(
  "import { HistoryProvider } from './contexts/HistoryContext';",
  "import { HistoryProvider, useHistory, useHistoryActions } from './contexts/HistoryContext';"
);

code = code.replace(
  "   const isInternalChange = useRef(false);",
  "   const isInternalChange = useRef(false);\n   const { executeCommand } = useHistoryActions();\n   const setIsInternalChange = useCallback((val: boolean) => { isInternalChange.current = val; }, []);"
);

// 3. Remove executeCommand, performUndo, performRedo, jumpToHistory
const executeCommandRegex = /   \/\/ History Execute Core Engine[\s\S]*?   \}, \[updateLayersList\]\);\n\n/g;
code = code.replace(executeCommandRegex, '');

const historyFunctionsRegex = /   const performUndo = useCallback\(\(\) => \{[\s\S]*?   const jumpToHistory = useCallback\(\(idx: number\) => \{[\s\S]*?   \}, \[updateLayersList\]\);\n/g;
code = code.replace(historyFunctionsRegex, '');

// 4. Initialize History
const initializeSelectionRegex = /      initializeSelection\(canvas\);\n/g;
code = code.replace(
  initializeSelectionRegex,
  "      initializeSelection(canvas);\n      const { initializeHistory } = useHistoryActions();\n      initializeHistory(canvas, updateLayersList, setIsInternalChange);\n"
);
// Note: hooks can't be called inside useEffect!
// Wait! `useHistoryActions()` is a hook! I must call it at the component top-level!

fs.writeFileSync(filePath, code);
console.log('Done script prep');
