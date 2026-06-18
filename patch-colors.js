const fs = require('fs');
const file = 'src/components/TodoNodeRenderer.tsx';
let content = fs.readFileSync(file, 'utf8');

const replacements = [
  // Container
  ['bg-[#0a0f1d]/95', 'bg-white/95 dark:bg-[#0a0f1d]/95'],
  ['border-[#1e293b]', 'border-slate-200 dark:border-[#1e293b]'],
  
  // Header
  ['border-[#1b2230]', 'border-slate-200 dark:border-[#1b2230]'],
  ['bg-[#111625]/60', 'bg-slate-50/60 dark:bg-[#111625]/60'],
  
  // Custom Icon/buttons
  ['bg-[#1e40af]/20', 'bg-blue-100 dark:bg-[#1e40af]/20'],
  ['border-[#3b82f6]/30', 'border-blue-200 dark:border-[#3b82f6]/30'],
  
  // General
  ['bg-[#131924]', 'bg-slate-100 dark:bg-[#131924]'],
  ['border-slate-800/80', 'border-slate-200 dark:border-slate-800/80'],
  ['bg-[#161B26]/60', 'bg-slate-100/60 dark:bg-[#161B26]/60'],
  ['hover:bg-[#1E2533]', 'hover:bg-slate-200 dark:hover:bg-[#1E2533]'],
  ['bg-[#0e1322]', 'bg-white dark:bg-[#0e1322]'],
  ['border-slate-800', 'border-slate-200 dark:border-slate-800'],
  ['bg-[#111625]/20', 'bg-slate-50/20 dark:bg-[#111625]/20'],
  ['bg-[#111625]/40', 'bg-slate-50/40 dark:bg-[#111625]/40'],
  ['bg-[#111625]/70', 'bg-slate-100/70 dark:bg-[#111625]/70'],
  ['bg-[#111625]', 'bg-white dark:bg-[#111625]'],
  
  // Progress Bar
  ['bg-[#1b2230]', 'bg-slate-200 dark:bg-[#1b2230]'],
  
  // Text Colors
  ['text-slate-400', 'text-slate-500 dark:text-slate-400'],
  // Be careful with text-white as there might be a few
  ['text-white', 'text-slate-800 dark:text-white'],
  ['text-slate-200', 'text-slate-700 dark:text-slate-200'],

  // Input background
  ['bg-[#0A0F1A]', 'bg-white dark:bg-[#0A0F1A]'],
  ['border-slate-700/50', 'border-slate-300 dark:border-slate-700/50'],

  // hover states
  ['hover:bg-[#182132]', 'hover:bg-slate-100 dark:hover:bg-[#182132]'],
  ['hover:bg-white/10', 'hover:bg-slate-200 dark:hover:bg-white/10'],

  // badge style text
  ['text-[#94a3b8]', 'text-slate-500 dark:text-slate-400'],
  // shadow colors
];

replacements.forEach(([from, to]) => {
  content = content.split(from).join(to);
});

fs.writeFileSync(file, content);
console.log('Update complete');
