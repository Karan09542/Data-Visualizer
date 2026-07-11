const fs = require('fs');
const path = require('path');

// 1. Fix the 4 contexts
const contextsToFix = [
    'AlignmentContext.tsx',
    'SnappingContext.tsx',
    'ViewportContext.tsx',
    'ExportContext.tsx'
];

for (const ctx of contextsToFix) {
    const p = path.join('src', 'components', 'image-workspace', 'contexts', ctx);
    let code = fs.readFileSync(p, 'utf8');
    code = code.replace(/import \{ useWorkspace \} from '\.\/WorkspaceContext';/, "import { useWorkspaceUI } from './WorkspaceUIContext';");
    code = code.replace(/const \{ state: \{ artboards, activeArtboardId, activeTab \} \} = useWorkspace\(\);/, "const { artboards, activeArtboardId, activeTab } = useWorkspaceUI();");
    code = code.replace(/const \{ state: \{ artboards, activeArtboardId \} \} = useWorkspace\(\);/, "const { artboards, activeArtboardId } = useWorkspaceUI();");
    fs.writeFileSync(p, code);
}

// 2. Add activeTab to WorkspaceUIContext
const uiCtxPath = path.join('src', 'components', 'image-workspace', 'contexts', 'WorkspaceUIContext.tsx');
let uiCtxCode = fs.readFileSync(uiCtxPath, 'utf8');
uiCtxCode = uiCtxCode.replace(/setActiveTab: \(val: any\) => void;/, "activeTab: string;\n  setActiveTab: (val: any) => void;");
fs.writeFileSync(uiCtxPath, uiCtxCode);

// 3. Pass activeTab to WorkspaceUIProvider in ImageWorkspace.tsx
const iwPath = path.join('src', 'components', 'image-workspace', 'ImageWorkspace.tsx');
let iwCode = fs.readFileSync(iwPath, 'utf8');
iwCode = iwCode.replace(/setActiveTab, handleImportImageClick/g, "activeTab, setActiveTab, handleImportImageClick");
fs.writeFileSync(iwPath, iwCode);

console.log("Fixed context imports and activeTab.");
