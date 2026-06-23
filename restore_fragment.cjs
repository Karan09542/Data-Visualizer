const fs = require('fs');
let code = fs.readFileSync('src/components/MathNodeRenderer.tsx', 'utf8');

code = code.replace(/ \)\}\n<\/React\.Fragment>\n\s*\);/g, '</React.Fragment>\n                            )}\n                        </React.Fragment>\n                      );');
fs.writeFileSync('src/components/MathNodeRenderer.tsx', code);
