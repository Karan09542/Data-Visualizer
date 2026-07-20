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

fs.writeFileSync('src/components/image-workspace/ImageWorkspace.tsx', code);
console.log("Injected AlignmentProvider.");
