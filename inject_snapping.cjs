const fs = require('fs');

let code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');

// 1. Add imports
code = code.replace(
  "import { AlignmentProvider, useAlignment } from './contexts/AlignmentContext';",
  "import { AlignmentProvider, useAlignment } from './contexts/AlignmentContext';\nimport { SnappingProvider, useSnapping } from './contexts/SnappingContext';"
);

// 2. Wrap ImageWorkspace with SnappingProvider
const wrapperPattern = /            <AlignmentProvider>/g;
code = code.replace(
  wrapperPattern,
  `            <AlignmentProvider>\n               <SnappingProvider>`
);

const wrapperEndPattern = /            <\/AlignmentProvider>/g;
code = code.replace(
  wrapperEndPattern,
  `               </SnappingProvider>\n            </AlignmentProvider>`
);

// 3. Inject hook and remove old states
const hookPattern = /   const \{ alignSelection \} = useAlignment\(\);\n/g;
code = code.replace(
  hookPattern,
  `   const { alignSelection } = useAlignment();\n   const { isSnappingEnabled, setIsSnappingEnabled, snapTolerance, setSnapTolerance, guides, clearSnapping } = useSnapping();\n`
);

const oldStatesRegex = /   const \[isSnappingEnabled, setIsSnappingEnabled\] = useState\(true\);\n   const \[snapTolerance, setSnapTolerance\] = useState\(10\);\n   const \[guides, setGuides\] = useState<\{ type: 'v' \| 'h'; pos: number \}\[\]>\(\[\]\);\n/g;
code = code.replace(oldStatesRegex, '');

const oldRefsRegex = /   const snapToleranceRef = useRef\(10\);\n   const isSnappingEnabledRef = useRef\(true\);\n/g;
code = code.replace(oldRefsRegex, '');

const oldGuidesRefRegex = /   const guidesRef = useRef<\{ type: 'v' \| 'h', pos: number \}\[\]>\(\[\]\);\n/g;
code = code.replace(oldGuidesRefRegex, '');

const syncEffectRegex = /   useEffect\(\(\) => \{\n      snapToleranceRef\.current = snapTolerance;\n      isSnappingEnabledRef\.current = isSnappingEnabled;\n   \}, \[snapTolerance, isSnappingEnabled\]\);\n/g;
code = code.replace(syncEffectRegex, '');

// 4. Remove drawing guides from after:render
// The pattern starts at `         // 2. Draw snapping guides` and ends at `         }\n\n         // 3. Draw frames border`
const drawGuidesStartIdx = code.indexOf("         // 2. Draw snapping guides");
if (drawGuidesStartIdx !== -1) {
    const drawGuidesEndIdx = code.indexOf("         // 3. Draw frames border", drawGuidesStartIdx);
    if (drawGuidesEndIdx !== -1) {
        code = code.substring(0, drawGuidesStartIdx) + code.substring(drawGuidesEndIdx);
        console.log("Removed draw snapping guides from after:render.");
    }
}

// 5. Replace guidesRef.current = [] with clearSnapping()
const clearSnappingRegex = /         guidesRef\.current = \[\];\n/g;
code = code.replace(clearSnappingRegex, '         clearSnapping();\n');

// 6. Wait! We also need to remove `canvas.on('object:moving', handleSnapping);` which was not found before!
// Let me check if it's there.
const oldMovingRegex = /      canvas\.on\('object:moving', handleSnapping\);\n/g;
code = code.replace(oldMovingRegex, '');

fs.writeFileSync('src/components/image-workspace/ImageWorkspace.tsx', code);
console.log("Injected SnappingProvider and cleaned up old state.");
