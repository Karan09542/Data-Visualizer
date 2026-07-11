const fs = require('fs');
const orig = fs.readFileSync('temp_original.tsx', 'utf16le').split('\n');
const curr = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8').split('\n');

function getBalances(lines) {
  let balances = [];
  let b = 0;
  for(let line of lines) {
    for(let c of line) {
      if (c === '{') b++;
      if (c === '}') b--;
    }
    balances.push(b);
  }
  return balances;
}

const origB = getBalances(orig);
const currB = getBalances(curr);

let diffIdx = -1;
for(let i=0; i<Math.min(origB.length, currB.length); i++) {
  if (origB[i] !== currB[i]) {
    diffIdx = i;
    break;
  }
}

if (diffIdx !== -1) {
  console.log('Diverges at line', diffIdx + 1);
  console.log('Orig balance:', origB[diffIdx], 'Curr balance:', currB[diffIdx]);
  console.log('Orig line:', orig[diffIdx]);
  console.log('Curr line:', curr[diffIdx]);
} else {
  console.log('No divergence?');
}
