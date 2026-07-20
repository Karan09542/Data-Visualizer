const fs = require('fs');

let bp = fs.readFileSync('src/components/image-workspace/components/panels/BrushPreview.tsx', 'utf8');
bp = bp.replace('import React from "react";', 'import React, { useRef, useEffect } from "react";');
fs.writeFileSync('src/components/image-workspace/components/panels/BrushPreview.tsx', bp);

let odp = fs.readFileSync('src/components/image-workspace/components/panels/ObjectDimensionsPanel.tsx', 'utf8');
odp = odp.replace('import React, { useState, useEffect } from "react";', 'import React, { useState, useEffect, useCallback } from "react";');
odp = odp.replace(/from "lucide-react";/, ', Layout } from "lucide-react";');
fs.writeFileSync('src/components/image-workspace/components/panels/ObjectDimensionsPanel.tsx', odp);

let iw = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');
iw = iw.replace(/import \{ dataURLtoFile \} from "\.\/utils\/file";\n/g, '');
iw = 'import { dataURLtoFile } from "./utils/file";\n' + iw;
iw = iw.replace(/\.\.\/image-import\/clipboard\/clipboardImporter/g, '../../image-import/clipboard/clipboardImporter');
fs.writeFileSync('src/components/image-workspace/ImageWorkspace.tsx', iw);

let brushes = fs.readFileSync('src/components/image-workspace/fabric/brushes.ts', 'utf8');
if (!brushes.includes('export const createPatternSource')) {
  brushes = brushes.replace('const createPatternSource', 'export const createPatternSource');
  fs.writeFileSync('src/components/image-workspace/fabric/brushes.ts', brushes);
}

let apc = fs.readFileSync('src/components/image-workspace/commands/artboard/ArtboardPropertyCommand.ts', 'utf8');
apc = apc.replace(/import \{ setOpacityOnHex \} from "\.\.\/\.\.\/utils\/color";/, 'import { setOpacityOnHex } from "../../utils/color";');
fs.writeFileSync('src/components/image-workspace/commands/artboard/ArtboardPropertyCommand.ts', apc);

console.log('Fixed TS errors.');
