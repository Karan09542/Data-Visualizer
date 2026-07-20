const fs = require('fs');
const code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');

const startTag = '{/* FILTER STUDIO PANEL */}';
const endTag = '{/* LAYERS PANEL */}';

const startIndex = code.indexOf(startTag);
const endIndex = code.indexOf(endTag);

const block = code.substring(startIndex, endIndex);

const divStart = block.indexOf('<div className="p-0 h-full flex flex-col relative text-[#D4D4D4] font-sans selection:bg-blue-500/30">');
const divEnd = block.lastIndexOf('</div>');

const jsx = block.substring(divStart, divEnd + 6);

fs.writeFileSync('scratch_filters.txt', jsx);
console.log('JSX length:', jsx.length);
