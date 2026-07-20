const fs = require('fs');

let code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');
code = code.replace(/\r\n/g, '\n');

// Remove executeCommand
const execRegex = /   \/\/ History Execute Core Engine\n   const executeCommand = useCallback\(\(cmd: Command\) => \{[\s\S]*?   \}, \[updateLayersList\]\);\n/g;
code = code.replace(execRegex, '');

// Remove performUndo
const undoRegex = /   const performUndo = useCallback\(\(\) => \{[\s\S]*?   \}, \[executeCommand\]\);\n/g;
code = code.replace(undoRegex, '');

// Remove performRedo
const redoRegex = /   const performRedo = useCallback\(\(\) => \{[\s\S]*?   \}, \[executeCommand\]\);\n/g;
code = code.replace(redoRegex, '');

// Also remove states
const statesRegex = /   const commandsListRef = useRef<Command\[\]>\(\[\]\);\n   const commandIndexRef = useRef<number>\(-1\);\n   const \[historyNames, setHistoryNames\] = useState<string\[\]>\(\[\]\);\n   const \[commandIndex, setCommandIndex\] = useState<number>\(-1\);\n/g;
code = code.replace(statesRegex, '');

fs.writeFileSync('src/components/image-workspace/ImageWorkspace.tsx', code);
console.log('Deleted old history methods.');
