const fs = require('fs');
const file = 'c:/Users/karan/project/Data-Visualizer/src/components/math-node/TraceOverlay.tsx';
let content = fs.readFileSync(file, 'utf8');

const importRegex = /import\s+\{\s*Point,\s*useTransformContext,\s*usePaneContext,\s*Text\s*\}\s*from\s*"mafs";/;
content = content.replace(importRegex, 'import { Point, useTransformContext, usePaneContext, Text, vec } from "mafs";');

const oldLogic = `      const mathX = xRange[0] + (px / rect.width) * (xRange[1] - xRange[0]);
      const mathY = yRange[1] - (py / rect.height) * (yRange[1] - yRange[0]);

      // Conversion factors for calculating pixel distances
      const pixelsPerUnitX = rect.width / (xRange[1] - xRange[0]);
      const pixelsPerUnitY = rect.height / (yRange[1] - yRange[0]);`;

const newLogic = `      const viewBoxX = (xRange[0] / (xRange[1] - xRange[0])) * rect.width;
      const viewBoxY = (yRange[1] / (yRange[0] - yRange[1])) * rect.height;

      const inverseViewTransform = vec.matrixInvert(viewTransform);
      if (!inverseViewTransform) return;

      const [mathX, mathY] = vec.transform(
        [px + viewBoxX, py + viewBoxY],
        inverseViewTransform
      );

      // viewTransform is [a, c, tx, b, d, ty]. Index 0 is scaleX, Index 4 is scaleY.
      const pixelsPerUnitX = Math.abs(viewTransform[0]);
      const pixelsPerUnitY = Math.abs(viewTransform[4]);`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync(file, content);
console.log("Successfully patched mapping logic.");
