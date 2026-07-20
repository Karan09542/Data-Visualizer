const fs = require('fs');
const code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');

const startTag = '{/* ARTBOARDS PANEL */}';
const endTag = '{/* QUICK ACTIONS PANEL */}';

const startIndex = code.indexOf(startTag);
const endIndex = code.indexOf(endTag);

const block = code.substring(startIndex, endIndex);

const divStart = block.indexOf('<div className="flex flex-col h-full overflow-hidden text-white font-sans selection:bg-blue-500/30">');
const divEnd = block.lastIndexOf('</div>');

const beforeDiv = block.substring(0, divStart);
const afterDiv = block.substring(divEnd + 6); // length of </div>

const newBlock = beforeDiv + '<ArtboardsTab />\n' + afterDiv;

const newCode = code.substring(0, startIndex) + newBlock + code.substring(endIndex);

fs.writeFileSync('src/components/image-workspace/ImageWorkspace.tsx', newCode);
console.log('Replaced Artboards panel with <ArtboardsTab /> in ImageWorkspace.tsx');
