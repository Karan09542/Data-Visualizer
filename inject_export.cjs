const fs = require('fs');

let code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');

// 1. Add imports
code = code.replace(
  "import { ViewportProvider, useViewport } from './contexts/ViewportContext';",
  "import { ViewportProvider, useViewport } from './contexts/ViewportContext';\nimport { ExportProvider, useExport } from './contexts/ExportContext';"
);

// 2. Wrap ImageWorkspace with ExportProvider
const wrapperPattern = /                  <ViewportProvider>/g;
code = code.replace(
  wrapperPattern,
  `                  <ViewportProvider>\n                     <ExportProvider>`
);

const wrapperEndPattern = /                  <\/ViewportProvider>/g;
code = code.replace(
  wrapperEndPattern,
  `                     </ExportProvider>\n                  </ViewportProvider>`
);

// 3. Inject hook
const hookPattern = /   const \{ zoomPercent, setZoomPercent, fitView, validateViewport, handleWheelZoom \} = useViewport\(\);\n/g;
code = code.replace(
  hookPattern,
  `   const { zoomPercent, setZoomPercent, fitView, validateViewport, handleWheelZoom } = useViewport();\n   const { exportTarget, setExportTarget, selectedExportIds, setSelectedExportIds, exportSettings, setExportSettings, isExporting, handleExport, comparisonMode, setComparisonMode, originalImageUrl, optimizedImageUrl, psnr, originalSize, optimizedSize, currentPreviewOp, isGeneratingPreview, originalPreviewDims, optimizedPreviewDims, generateLivePreview } = useExport();\n`
);

// 4. Remove old state
const statePattern1 = /   const \[exportTarget, setExportTarget\] = useState<"current" \| "selected" \| "all">\("current"\);\n/g;
code = code.replace(statePattern1, '');

const statePattern2 = /   const \[selectedExportIds, setSelectedExportIds\] = useState<\{ \[key: string\]: boolean \}>\(\{\}\);\n/g;
code = code.replace(statePattern2, '');

const statePattern3 = /   const \[exportSettings, setExportSettings\] = useState<ExportSettings>\(\{\n      format: "png",\n      quality: 0.8,\n      effort: 4,\n      resize: \{ enabled: false, width: 1920, height: 1080 \}\n   \}\);\n/g;
code = code.replace(statePattern3, '');

const statePattern4 = /   const \[isExporting, setIsExporting\] = useState\(false\);\n/g;
code = code.replace(statePattern4, '');

const statePattern5 = /   const \[comparisonMode, setComparisonMode\] = useState\(false\);\n   const \[originalImageUrl, setOriginalImageUrl\] = useState<string \| null>\(null\);\n   const \[optimizedImageUrl, setOptimizedImageUrl\] = useState<string \| null>\(null\);\n   const \[psnr, setPsnr\] = useState<number \| null>\(null\);\n   const \[originalSize, setOriginalSize\] = useState<number \| null>\(null\);\n   const \[optimizedSize, setOptimizedSize\] = useState<number \| null>\(null\);\n   const \[currentPreviewOp, setCurrentPreviewOp\] = useState<string>\(""\);\n   const \[isGeneratingPreview, setIsGeneratingPreview\] = useState\(false\);\n   const \[originalPreviewDims, setOriginalPreviewDims\] = useState<\{w: number, h: number\}>\(\{w: 0, h: 0\}\);\n   const \[optimizedPreviewDims, setOptimizedPreviewDims\] = useState<\{w: number, h: number\}>\(\{w: 0, h: 0\}\);\n/g;
code = code.replace(statePattern5, '');

// 5. Remove handleExport
const exportStartIdx = code.indexOf("   const handleExport = async () => {");
if (exportStartIdx !== -1) {
    let braceCount = 0;
    let endIdx = -1;
    for (let i = exportStartIdx; i < code.length; i++) {
        if (code[i] === '{') braceCount++;
        else if (code[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
                endIdx = i;
                break;
            }
        }
    }
    const fullEndIdx = code.indexOf(';\n', endIdx);
    const finalEnd = fullEndIdx !== -1 && fullEndIdx - endIdx <= 3 ? fullEndIdx + 2 : endIdx + 1;
    code = code.substring(0, exportStartIdx) + code.substring(finalEnd);
}

// 6. Remove generateLivePreview
const genStartIdx = code.indexOf("   const generateLivePreview = async () => {");
if (genStartIdx !== -1) {
    let braceCount = 0;
    let endIdx = -1;
    for (let i = genStartIdx; i < code.length; i++) {
        if (code[i] === '{') braceCount++;
        else if (code[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
                endIdx = i;
                break;
            }
        }
    }
    const fullEndIdx = code.indexOf(';\n', endIdx);
    const finalEnd = fullEndIdx !== -1 && fullEndIdx - endIdx <= 3 ? fullEndIdx + 2 : endIdx + 1;
    code = code.substring(0, genStartIdx) + code.substring(finalEnd);
}

// 7. Remove useEffect for comparisonMode
const effect1Idx = code.indexOf("   // Sync tab open/close to active comparison mode\n   useEffect(() => {\n      if (activeTab === \"export\") {");
if (effect1Idx !== -1) {
    const effect1EndIdx = code.indexOf("   }, [activeTab]);\n", effect1Idx);
    code = code.substring(0, effect1Idx) + code.substring(effect1EndIdx + 20);
}

// 8. Remove useEffect for debounced preview
const effect2Idx = code.indexOf("   // Debounced live regeneration hook responding to setting changes\n   useEffect(() => {\n      if (!comparisonMode) return;");
if (effect2Idx !== -1) {
    const effect2EndIdx = code.indexOf("   ]);\n", effect2Idx);
    code = code.substring(0, effect2Idx) + code.substring(effect2EndIdx + 6);
}

fs.writeFileSync('src/components/image-workspace/ImageWorkspace.tsx', code);
console.log("Injected ExportProvider.");
