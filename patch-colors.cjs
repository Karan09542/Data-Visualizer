const fs = require('fs');

const path = 'src/components/SearchNodeWorkspace.tsx';
let code = fs.readFileSync(path, 'utf8');

// Background colors
code = code.replace(/bg-\[\#0F1623\]/g, 'bg-slate-50 dark:bg-[#0F1623]');
code = code.replace(/bg-\[\#0B1120\]/g, 'bg-slate-100 dark:bg-[#0B1120]');
code = code.replace(/bg-\[\#151D2C\]/g, 'bg-white dark:bg-[#151D2C]');
code = code.replace(/bg-\[\#1A2333\]/g, 'bg-slate-50 dark:bg-[#1A2333]');

// Text colors
code = code.replace(/text-slate-100/g, 'text-slate-900 dark:text-slate-100');
code = code.replace(/text-slate-200/g, 'text-slate-800 dark:text-slate-200');
code = code.replace(/text-slate-300/g, 'text-slate-700 dark:text-slate-300');
code = code.replace(/text-slate-400/g, 'text-slate-600 dark:text-slate-400');

// Border colors
code = code.replace(/border-slate-800/g, 'border-slate-200 dark:border-slate-800');
code = code.replace(/border-slate-700/g, 'border-slate-300 dark:border-slate-700');

fs.writeFileSync(path, code);
console.log("Replaced colors.");
