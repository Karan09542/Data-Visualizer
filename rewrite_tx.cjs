const fs = require('fs');
let code = fs.readFileSync('src/components/MathNodeRenderer.tsx', 'utf8');

code = code.replace(/scope\.x = xMin \+ i \* dx \- tx;/g, 'scope.x = xMin + i * dx;');
code = code.replace(/scope\.y = yMin \+ j \* dy \- ty;/g, 'scope.y = yMin + j * dy;');
// Ensure InequalityPlot also respects
code = code.replace(/scope\.x = x - tx;/g, 'scope.x = x;');
code = code.replace(/scope\.y = y - ty;/g, 'scope.y = y;');

fs.writeFileSync('src/components/MathNodeRenderer.tsx', code);
