const fs = require('fs');
const text = fs.readFileSync('temp_original.tsx', 'utf16le');
const lines = text.split('\n');

let pasteLine = -1;
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('const handlePaste = async')) {
    pasteLine = i;
    break;
  }
}

if (pasteLine !== -1) {
  let out = '';
  for(let i=pasteLine-5; i<pasteLine+35; i++) {
    out += lines[i] + '\n';
  }
  fs.writeFileSync('dump3.txt', out, 'utf8');
}
