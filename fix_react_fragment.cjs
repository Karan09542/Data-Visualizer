const fs = require('fs');
let code = fs.readFileSync('src/components/MathNodeRenderer.tsx', 'utf8');

// The remaining stray tags... let's just find them and delete them.
// They are exactly right before `{isPointBased && (`

const snippet = `return (
<React.Fragment key={f.id}>
<Transform translate={[tx, ty]}>
                            <Transform translate={[px, py]}>
                              <Transform rotate={rot}>
                                <Transform rotate={baseAngle}>
                                  <Transform scale={[sx, sy]}>
                                    <Transform rotate={-baseAngle}>
                                        <Transform translate={[-px, -py]}>`;

// In the code, earlier it was partially removed by \`fix_parse_error.cjs\` (6 tags were removed?). Wait.
// Since `fix_parse_error.cjs` ran, it actually matched the 6 tags and removed them, meaning `<Transform translate={[-px, -py]}>` is currently ALONE right after \`<React.Fragment key={f.id}>\`!

code = code.replace(/<React\.Fragment key=\{f\.id\}>\s*<Transform translate=\{\[-px, -py\]\}>/, '<React.Fragment key={f.id}>');

// Also, the previous script might have failed to replace it because I didn't include the 7th tag in the regex!
// Let me verify if there's any `<Transform translate={[tx, ty]}>` remaining.
code = code.replace(/return\s*\(\s*<React\.Fragment key=\{f\.id\}>\s*<Transform translate=\{\[tx, ty\]\}>\s*<Transform translate=\{\[px, py\]\}>\s*<Transform rotate=\{rot\}>\s*<Transform rotate=\{baseAngle\}>\s*<Transform scale=\{\[sx, sy\]\}>\s*<Transform rotate=\{-baseAngle\}>/, 'return (\n<React.Fragment key={f.id}>');

fs.writeFileSync('src/components/MathNodeRenderer.tsx', code);
