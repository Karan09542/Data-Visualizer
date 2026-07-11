const fs = require('fs');

let code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');

// 1. Add imports
code = code.replace(
  "import { ClipboardProvider, useClipboardActions } from './contexts/ClipboardContext';",
  "import { ClipboardProvider, useClipboardActions } from './contexts/ClipboardContext';\nimport { AlignmentProvider, useAlignment } from './contexts/AlignmentContext';"
);

// 2. Wrap ImageWorkspace with AlignmentProvider
const wrapperPattern = /      <ClipboardProvider>\n         <HistoryProvider>/g;
code = code.replace(
  wrapperPattern,
  `      <ClipboardProvider>\n         <HistoryProvider>\n            <AlignmentProvider>`
);

const wrapperEndPattern = /         <\/HistoryProvider>\n      <\/ClipboardProvider>/g;
code = code.replace(
  wrapperEndPattern,
  `            </AlignmentProvider>\n         </HistoryProvider>\n      </ClipboardProvider>`
);

// 3. Inject hook
const hookPattern = /   const \{ initializeClipboard, copyActiveObjectAsFormat, duplicateActiveObject \} = useClipboardActions\(\);\n/g;
code = code.replace(
  hookPattern,
  `   const { initializeClipboard, copyActiveObjectAsFormat, duplicateActiveObject } = useClipboardActions();\n   const { alignSelection } = useAlignment();\n`
);

// 4. Remove alignSelection logic from ImageWorkspaceContent
const alignPattern = /   const alignSelection = \(mode: 'left' \| 'centerH' \| 'right' \| 'top' \| 'centerV' \| 'bottom' \| 'fit' \| 'fill' \| 'stretch' \| 'fitWidth' \| 'fitHeight' \| 'utils_fitInside' \| 'utils_centerInside' \| 'matchWidth' \| 'matchHeight' \| 'distributeH' \| 'distributeV'\) => \{[\s\S]*?      \}\n      this\.canvas\.requestRenderAll\(\);\n[\s\S]*?      const cmd = new TransformObjectsCommand\(`Align Selection: \$\{mode\}`\, afterStates\);\n      executeCommand\(cmd\);\n   \};\n/g;
// Wait, my regex above might be too strict. 
// Let's use string indexOf to precisely cut it out to avoid regex issues like last time.

const alignStartIdx = code.indexOf("   const alignSelection = (mode: 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom' | 'fit' | 'fill' | 'stretch' | 'fitWidth' | 'fitHeight' | 'utils_fitInside' | 'utils_centerInside' | 'matchWidth' | 'matchHeight' | 'distributeH' | 'distributeV') => {");

if (alignStartIdx !== -1) {
    const endStr = "      executeCommand(cmd);\n   };\n";
    const alignEndIdx = code.indexOf(endStr, alignStartIdx) + endStr.length;
    code = code.substring(0, alignStartIdx) + code.substring(alignEndIdx);
    console.log("Removed alignSelection.");
} else {
    console.log("Could not find alignSelection start.");
}

fs.writeFileSync('src/components/image-workspace/ImageWorkspace.tsx', code);
console.log("Refactoring done.");
