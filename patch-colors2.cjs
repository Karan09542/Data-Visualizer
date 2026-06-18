const fs = require('fs');
const file = 'src/components/TodoNodeRenderer.tsx';
let content = fs.readFileSync(file, 'utf8');

const replacements = [
  ['text-slate-300', 'text-slate-600 dark:text-slate-300'],
  ['hover:bg-slate-800 hover:text-slate-800 dark:text-white', 'hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white'],
  ['bg-slate-800 text-slate-800 dark:text-white', 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'],
  ['hover:bg-slate-800/40', 'hover:bg-slate-100 dark:hover:bg-slate-800/40'],
  ['text-slate-100 hover:text-slate-800 dark:text-white', 'text-slate-800 dark:text-slate-100 hover:text-slate-900 dark:hover:text-white'],
];

replacements.forEach(([from, to]) => {
  content = content.split(from).join(to);
});

fs.writeFileSync(file, content);
console.log('Update complete');
