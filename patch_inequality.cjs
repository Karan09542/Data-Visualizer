const fs = require('fs');
let code = fs.readFileSync('src/components/MathNodeRenderer.tsx', 'utf8');

// 1. Fix InequalityPlot grid generation (apply inverse transform)
const gridGenRegex = /const grid = new Float32Array\(\(GRID_SIZE \+ 1\) \* \(GRID_SIZE \+ 1\)\);\s*for \(let i = 0; i <= GRID_SIZE; i\+\+\) \{\s*scope\.x = xMin \+ i \* dx;\s*for \(let j = 0; j <= GRID_SIZE; j\+\+\) \{\s*scope\.y = yMin \+ j \* dy;\s*let l; try \{ l = compiledLHS\.evaluate\(scope\); \} catch \{ l = NaN; \}\s*let r; if \(compiledRHS\) \{ try \{ r = compiledRHS\.evaluate\(scope\); \} catch \{ r = NaN; \} \} else \{ r = 0; \}\s*grid\[i \* \(GRID_SIZE \+ 1\) \+ j\] = Number\(l\) - Number\(r\);\s*\}\s*\}/;

const newGridGen = `const grid = new Float32Array((GRID_SIZE + 1) * (GRID_SIZE + 1));
    for (let i = 0; i <= GRID_SIZE; i++) {
        const x = xMin + i * dx;
        for (let j = 0; j <= GRID_SIZE; j++) {
            const y = yMin + j * dy;
            let lx = x - tx - px;
            let ly = y - ty - py;
            const nx = lx * Math.cos(-rot) - ly * Math.sin(-rot);
            const ny = lx * Math.sin(-rot) + ly * Math.cos(-rot);
            scope.x = (nx / scaleX) + px;
            scope.y = (ny / scaleY) + py;

            let l; try { l = compiledLHS.evaluate(scope); } catch { l = NaN; }
            let r; if (compiledRHS) { try { r = compiledRHS.evaluate(scope); } catch { r = NaN; } } else { r = 0; }
            grid[i * (GRID_SIZE + 1) + j] = Number(l) - Number(r);
        }
    }`;

code = code.replace(gridGenRegex, newGridGen);

// 2. Fix fillPath condition
const fillPathRegex = /let fillPath = "";\s*\/\/ Evaluate horizontally\s*const scope = \{ \.\.\.baseScope, x: 0, y: 0 \};\s*for \(let j = 0; j <= GRID_SIZE; j\+\+\) \{/;
const newFillPath = `let fillPath = "";
    // Evaluate horizontally
    const scope = { ...baseScope, x: 0, y: 0 };
    if (operator && operator !== "=") {
    for (let j = 0; j <= GRID_SIZE; j++) {`;

code = code.replace(fillPathRegex, newFillPath);

// Find the end of the J loop for fillPath
const afterFillPathRegex = /\s*if \(xStart !== null\) fillPath \+= `M \$\{xStart - dx\/2\} \$\{y - dy\/2\} L \$\{xMax \+ dx\/2\} \$\{y - dy\/2\} L \$\{xMax \+ dx\/2\} \$\{y \+ dy\/2\} L \$\{xStart - dx\/2\} \$\{y \+ dy\/2\} Z `;\s*\}/;
const newAfterFillPath = `        if (xStart !== null) fillPath += \`M \${xStart - dx/2} \${y - dy/2} L \${xMax + dx/2} \${y - dy/2} L \${xMax + dx/2} \${y + dy/2} L \${xStart - dx/2} \${y + dy/2} Z \`;
    }
    }`;

code = code.replace(afterFillPathRegex, newAfterFillPath);

// 3. Fix marching squares condition
const marchingConditionRegex = /const b00 = isInside\(v00\) \? 1 : 0;\s*const b10 = isInside\(v10\) \? 1 : 0;\s*const b11 = isInside\(v11\) \? 1 : 0;\s*const b01 = isInside\(v01\) \? 1 : 0;/;
const newMarchingCondition = `const b00 = v00 > 0 ? 1 : 0;
        const b10 = v10 > 0 ? 1 : 0;
        const b11 = v11 > 0 ? 1 : 0;
        const b01 = v01 > 0 ? 1 : 0;`;

code = code.replace(marchingConditionRegex, newMarchingCondition);

// 4. Fix line 7760 to include implicit
code = code.replace(/\{\!isPointBased && f\.type === "inequality" && \(/, '{!isPointBased && (f.type === "inequality" || f.type === "implicit") && (');

// 5. Update InequalityPlot operator prop usage in line 7765
// operator={f.operator || "<"} -> operator={f.operator || (f.type === "implicit" ? "=" : "<")}
code = code.replace(/operator=\{f\.operator \|\| "<"\}/, 'operator={f.operator || (f.type === "implicit" ? "=" : "<")}');

fs.writeFileSync('src/components/MathNodeRenderer.tsx', code);
