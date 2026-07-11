const fs = require('fs');

let code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');

// 1. Add imports
code = code.replace(
  "import { SnappingProvider, useSnapping } from './contexts/SnappingContext';",
  "import { SnappingProvider, useSnapping } from './contexts/SnappingContext';\nimport { ViewportProvider, useViewport } from './contexts/ViewportContext';"
);

// 2. Wrap ImageWorkspace with ViewportProvider
const wrapperPattern = /               <SnappingProvider>/g;
code = code.replace(
  wrapperPattern,
  `               <SnappingProvider>\n                  <ViewportProvider>`
);

const wrapperEndPattern = /               <\/SnappingProvider>/g;
code = code.replace(
  wrapperEndPattern,
  `                  </ViewportProvider>\n               </SnappingProvider>`
);

// 3. Inject hook and remove zoomPercent state
const hookPattern = /   const \{ isSnappingEnabled, setIsSnappingEnabled, snapTolerance, setSnapTolerance, guides, clearSnapping \} = useSnapping\(\);\n/g;
code = code.replace(
  hookPattern,
  `   const { isSnappingEnabled, setIsSnappingEnabled, snapTolerance, setSnapTolerance, guides, clearSnapping } = useSnapping();\n   const { zoomPercent, setZoomPercent, fitView, validateViewport, handleWheelZoom } = useViewport();\n`
);

const oldZoomRegex = /   const \[zoomPercent, setZoomPercent\] = useState\(100\);\n/g;
code = code.replace(oldZoomRegex, '');

// 4. Replace mouse:wheel else block
const wheelStartIdx = code.indexOf("            let zoom = canvas.getZoom();");
if (wheelStartIdx !== -1) {
    const wheelEndIdx = code.indexOf("            validateViewport();\n         }", wheelStartIdx);
    if (wheelEndIdx !== -1) {
        code = code.substring(0, wheelStartIdx) + "            handleWheelZoom(opt);\n" + code.substring(wheelEndIdx + 32);
        console.log("Replaced wheel zoom logic.");
    } else {
        console.log("Could not find wheel zoom end.");
    }
} else {
    console.log("Could not find wheel zoom start.");
}

// 5. Replace references to zoomPercent setter since we use setZoomPercent directly
// We already have `setZoomPercent` exported from useViewport, so it should just work!

fs.writeFileSync('src/components/image-workspace/ImageWorkspace.tsx', code);
console.log("Injected ViewportProvider.");
