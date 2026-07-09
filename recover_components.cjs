const fs = require('fs');

fs.mkdirSync('src/components/image-workspace/components/shared', { recursive: true });
fs.mkdirSync('src/components/image-workspace/components/panels', { recursive: true });

const code = fs.readFileSync('original_ImageWorkspace.tsx', 'utf8');

function extractUIComponent(name, endPattern, isMulti = false, outName = name) {
  let startStr = `const ${name} =`;
  let startIdx = code.indexOf(startStr);
  if (startIdx === -1) {
    console.log('Could not find ' + name);
    return;
  }
  
  // Find where it ends based on endPattern
  let substring = code.substring(startIdx);
  let match = substring.match(endPattern);
  if (!match) {
    console.log('Could not find end for ' + name);
    return;
  }
  
  let block = substring.substring(0, match.index + match[0].length);
  
  // Clean up and add imports
  let imports = `import React from "react";\n`;
  if (name === 'ColorPickerPortal' || name === 'BrushPreview') {
    imports += `import { RgbaStringColorPicker } from "react-colorful";\n`;
  }
  if (block.includes('lucide-react')) {
    // Usually lucide icons are passed as props, we might need types but `any` is used
  }

  // If multi, we might need to find other related components (e.g. ColorPickerTrigger)
  if (isMulti && name === 'ColorPickerPortal') {
     const nextName = 'ColorPickerTrigger';
     const nextIdx = substring.indexOf(`const ${nextName} =`);
     if (nextIdx > -1) {
        const nextSub = substring.substring(nextIdx);
        const nextMatch = nextSub.match(endPattern);
        if (nextMatch) {
           block += '\n\n' + nextSub.substring(0, nextMatch.index + nextMatch[0].length);
        }
     }
  }

  // Add exports
  block = block.replace(new RegExp(`const ${name} =`, 'g'), `export const ${name} =`);
  if (isMulti && name === 'ColorPickerPortal') {
     block = block.replace(/const ColorPickerTrigger =/g, 'export const ColorPickerTrigger =');
  }

  let finalContent = `${imports}\n${block}`;
  
  // Write to file
  const outPath = `src/components/image-workspace/components/shared/${outName}.tsx`;
  fs.writeFileSync(outPath, finalContent);
  console.log(`Saved ${outPath}`);
}

extractUIComponent('ContextMenuItem', /\);\n/, false);
extractUIComponent('ToolBtn', /\);\n};\n/, false);
extractUIComponent('TabBtn', /\);\n/, false);
extractUIComponent('BtnSelect', /\);\n/, false);
extractUIComponent('FilterSlider', /\}\n/, false);
extractUIComponent('ColorPickerPortal', /\}\n/, true, 'ColorPickers');
extractUIComponent('ModernCheckbox', /\);\n/, false);

// ARTBOARD_PRESETS was likely at the top or bottom
let apIdx = code.indexOf('const ARTBOARD_PRESETS');
if (apIdx > -1) {
   let sub = code.substring(apIdx);
   let match = sub.match(/\n};\n/);
   if (match) {
       let block = sub.substring(0, match.index + match[0].length);
       block = block.replace('const ARTBOARD_PRESETS', 'export const ARTBOARD_PRESETS');
       fs.writeFileSync('src/components/image-workspace/types/artboard.ts', 
          fs.readFileSync('src/components/image-workspace/types/artboard.ts', 'utf8') + '\n\n' + block);
       console.log('Appended ARTBOARD_PRESETS');
   }
}

