const fs = require('fs');
let code = fs.readFileSync('src/components/MathNodeRenderer.tsx', 'utf8');

const regex = /<Transform translate=\{\[tx, ty\]\}>\s*<Transform translate=\{\[px, py\]\}>\s*<Transform rotate=\{rot\}>\s*<Transform rotate=\{baseAngle\}>\s*<Transform scale=\{\[sx, sy\]\}>\s*<Transform rotate=\{-baseAngle\}>/;
code = code.replace(regex, '');

// Also fix sx/sy in MathNodeRenderer near line 1771!
// In InequalityPlot, rename the inputs!
// Replace `sx?: number; sy?: number;` with `scaleX?: number; scaleY?: number;`

// In the interface `InequalityPlotProps`:
code = code.replace(/sx\?:\s*number;\s*sy\?:\s*number;/g, 'scaleX?: number; scaleY?: number;');

// In function destructuring:
code = code.replace(/rot\s*=\s*0,\s*sx\s*=\s*1,\s*sy\s*=\s*1,\s*px/g, 'rot = 0, scaleX = 1, scaleY = 1, px');

// In InequalityPlot jsx:
code = code.replace(/<InequalityPlot([\s\S]*?)sx=\{sx\}([\s\S]*?)sy=\{sy\}/g, '<InequalityPlot$1scaleX={sx}$2scaleY={sy}');

// Within InequalityPlot loop:
// scope.x = (nx / sx) + px;
// scope.y = (ny / sy) + py;
code = code.replace(/scope\.x = \(nx \/ sx\) \+ px;/g, 'scope.x = (nx / scaleX) + px;');
code = code.replace(/scope\.y = \(ny \/ sy\) \+ py;/g, 'scope.y = (ny / scaleY) + py;');

fs.writeFileSync('src/components/MathNodeRenderer.tsx', code);
