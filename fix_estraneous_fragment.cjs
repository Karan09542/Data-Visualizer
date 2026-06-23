const fs = require('fs');
let code = fs.readFileSync('src/components/MathNodeRenderer.tsx', 'utf8');

// I will just replace the `</React.Fragment>` at 8258 that is followed by `)}` then `</React.Fragment>`
// Wait, the block was:
//                           )}
//                       </React.Fragment> // This is the extraneous one that was `</>`
//                   )}
//               </React.Fragment> // This is the correct one

// I will just remove it.
const regex = /<\/React\.Fragment>\s*\)\}\s*<\/React\.Fragment>/g;
code = code.replace(regex, ')}\n</React.Fragment>');

fs.writeFileSync('src/components/MathNodeRenderer.tsx', code);
