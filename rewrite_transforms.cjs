const fs = require('fs');

let code = fs.readFileSync('src/components/MathNodeRenderer.tsx', 'utf8');

const searchStart = '{!isPointBased && f.type === "parametric" && (';
const explicitBlock = `{!isPointBased && f.type === "function" && (`;
const expStart = code.indexOf(explicitBlock);
const expEnd = code.indexOf(')}', expStart + explicitBlock.length) + 2;

const startIdx = code.indexOf(searchStart);

if (startIdx === -1 || expStart === -1) {
    console.error("Could not find plots block");
    process.exit(1);
}

const plotsBlock = code.substring(startIdx, expEnd);

code = code.substring(0, startIdx) + code.substring(expEnd);

const insertionPointRegex = /                                      <\/Transform>\s*$/m;
code = code.replace(insertionPointRegex, (match) => {
    return plotsBlock + "\n" + match;
});

// Also fix tx and ty being subtracted in InequalityPlot and ImplicitPlot!
// Actually, Mafs custom InequalityPlot will need fix
code = code.replace(/tx=\{0\}/g, '');
code = code.replace(/ty=\{0\}/g, '');
code = code.replace(/scope\.x = x - tx;/g, 'scope.x = x;');
code = code.replace(/scope\.y = y - ty;/g, 'scope.y = y;');

fs.writeFileSync('src/components/MathNodeRenderer.tsx', code);
console.log("Rewritten!");
