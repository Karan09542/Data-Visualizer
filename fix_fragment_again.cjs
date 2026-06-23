const fs = require('fs');
let code = fs.readFileSync('src/components/MathNodeRenderer.tsx', 'utf8');

// I will just revert those `<>` to `<React.Fragment>` and fix the ones that actually mismatch!
// In `fix_fragment_mismatch.cjs` I did:
// code = code.replace(/<React\.Fragment>\s*<MovablePoint/g, '<>\n<MovablePoint');
code = code.replace(/<>\n<MovablePoint/g, '<React.Fragment>\n<MovablePoint');

// The original issue was around line 8258 which was:
//                                 )}
//                             </>
//                           )}
//                         </React.Fragment>
// It seems `</>` was inside `React.Fragment`. Wait! If `</>` was INSIDE, what did it match??
// Let's look at 8200-8260.
//                     {f.isDraggable &&
//                              ...
//                             <React.Fragment>
//                               <MovablePoint
//                                  ...
//                                />
//                               {f.isPivotEnabled && (...) }
//                             </React.Fragment> // <-- I need to change `</>` to `</React.Fragment>` !

const brokenRegex = /<React\.Fragment>\s*<MovablePoint([\s\S]*?)<\/React\.Fragment>/g;
// Wait, the original was `</>` matching `<React.Fragment>`.
// Let's do string replacement for the EXACT snippet:

code = code.replace(/<\/React\.Fragment>\n\s*\);\n\s*\} catch/g, '</React.Fragment>\n                      );\n                    } catch');

// Let's fix the stray `</>` that is just before `)} </React.Fragment>`.
// Wait, my regex `replace(/<React\.Fragment>\s*<MovablePoint/g, '<>\n<MovablePoint');` created opening fragments. I reverted it.
// Let's look at the remaining `</>` in lines 7900-8300.
code = code.replace(/<React\.Fragment>\s*(<MovablePoint[\s\S]*?)<\/>/g, '<React.Fragment>\n$1</React.Fragment>');

fs.writeFileSync('src/components/MathNodeRenderer.tsx', code);
