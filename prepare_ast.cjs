const fs = require('fs');

let code = fs.readFileSync('src/components/MathNodeRenderer.tsx', 'utf8');

const applyTransformBody = `
                      const applyForwardTransform = (pt: [number, number]): [number, number] => {
                        if (isNaN(pt[0]) || isNaN(pt[1])) return pt;
                        let lx = pt[0] - px;
                        let ly = pt[1] - py;
                        
                        let x1 = lx * Math.cos(-baseAngle) - ly * Math.sin(-baseAngle);
                        let y1 = lx * Math.sin(-baseAngle) + ly * Math.cos(-baseAngle);
                        
                        x1 *= sx;
                        y1 *= sy;
                        
                        let x2 = x1 * Math.cos(rot + baseAngle) - y1 * Math.sin(rot + baseAngle);
                        let y2 = x1 * Math.sin(rot + baseAngle) + y1 * Math.cos(rot + baseAngle);
                        
                        return [x2 + px + tx, y2 + py + ty];
                      };
`;

code = code.replace(/return\s*\(\s*<React.Fragment key=\{f\.id\}>\s*<Transform translate=\{\[tx, ty\]\}>/, applyTransformBody + '\nreturn (\n<React.Fragment key={f.id}>\n<Transform translate={[tx, ty]}>');

fs.writeFileSync('src/modify_ast.cjs', code);
