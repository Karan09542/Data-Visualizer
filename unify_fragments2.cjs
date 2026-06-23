const fs = require('fs');
let code = fs.readFileSync('src/components/MathNodeRenderer.tsx', 'utf8');

code = code.replace(/<>/g, '<React.Fragment>');
code = code.replace(/<\/>/g, '</React.Fragment>');
code = code.replace(/<\/React\.Fragment>\s*\)\}\s*<\/React\.Fragment>\n\s*\}\s*catch/g, '</React.Fragment>\n                            )}\n                        </React.Fragment>\n                      );\n                    } catch');

// Just to ensure no `</React.Fragment>` are left unbalanced:
// If it builds now, great.
fs.writeFileSync('src/components/MathNodeRenderer.tsx', code);
