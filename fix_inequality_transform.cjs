const fs = require('fs');

let code = fs.readFileSync('src/components/MathNodeRenderer.tsx', 'utf8');

const regexInequalityProps = /tx\?:\s*number;\s*ty\?:\s*number;/;
code = code.replace(regexInequalityProps, `tx?: number;
  ty?: number;
  rot?: number;
  sx?: number;
  sy?: number;
  px?: number;
  py?: number;`);

const regexInequalityRenderProps = /tx=\{tx\}\n\s*ty=\{ty\}/g;
code = code.replace(regexInequalityRenderProps, `tx={tx}
                                          ty={ty}
                                          rot={rot}
                                          sx={sx}
                                          sy={sy}
                                          px={px}
                                          py={py}`);

const regexInequalityDestructure = /tx\s*=\s*0,\s*ty\s*=\s*0,/g;
code = code.replace(regexInequalityDestructure, `tx = 0,
  ty = 0,
  rot = 0,
  sx = 1,
  sy = 1,
  px = 0,
  py = 0,`);

const inequalityLoop = /const scope = \{ \.\.\.baseScope, x: 0, y: 0 \};\s*for \(let j = 0; j <= GRID_SIZE; j\+\+\) \{\s*const y = yMin \+ j \* dy;\s*scope\.y = y;[\s\S]*?scope\.x = x;[\s\S]*?try \{/;

const newInequalityLoop = `const scope = { ...baseScope, x: 0, y: 0 };
    for (let j = 0; j <= GRID_SIZE; j++) {
        const y = yMin + j * dy;
        let xStart: number | null = null;
        
        for (let i = 0; i <= GRID_SIZE; i++) {
            const x = xMin + i * dx;
            
            // Inverse Transform for Inequality
            let lx = x - tx - px;
            let ly = y - ty - py;
            
            const nx = lx * Math.cos(-rot) - ly * Math.sin(-rot);
            const ny = lx * Math.sin(-rot) + ly * Math.cos(-rot);
            
            scope.x = (nx / sx) + px;
            scope.y = (ny / sy) + py;

            try {`;

code = code.replace(inequalityLoop, newInequalityLoop);

fs.writeFileSync('src/components/MathNodeRenderer.tsx', code);
