const fs = require('fs');

const srcFile = 'src/components/image-workspace/ImageWorkspace.tsx';
let code = fs.readFileSync(srcFile, 'utf8');

function extractHook(startRegex, endRegex, hookName, hookFile, imports = '') {
  const startMatch = code.match(startRegex);
  const endMatch = code.match(endRegex);

  if (!startMatch || !endMatch) {
    console.log('Failed to match for ' + hookName);
    return;
  }

  const startIdx = startMatch.index;
  const endIdx = endMatch.index + endMatch[0].length;
  const block = code.substring(startIdx, endIdx);

  const vars = [...block.matchAll(/const \[([a-zA-Z0-9_]+),\s*([a-zA-Z0-9_]+)\]/g)];
  const varNames = vars.map(m => m[1] + ', ' + m[2]).join(',\n    ');

  const hookContent = `import { useState } from "react";\n${imports}\n\nexport const ${hookName} = () => {\n${block}\n\n  return {\n    ${varNames}\n  };\n};`;
  
  fs.writeFileSync(hookFile, hookContent);
  console.log(`Created ${hookFile}`);

  const replacement = `const {\n    ${varNames}\n  } = ${hookName}();`;
  code = code.substring(0, startIdx) + replacement + code.substring(endIdx);
  
  code = `import { ${hookName} } from "./hooks/${hookName}";\n` + code;
}

extractHook(
  /const \[artboards/m,
  /const \[activeArtboardId, setActiveArtboardId\] = useState<string>\("artboard_default"\);/m,
  'useArtboardState',
  'src/components/image-workspace/hooks/useArtboardState.ts',
  'import { Artboard } from "../types/artboard";'
);

fs.writeFileSync(srcFile, code);
console.log('Extracted useArtboardState.');
