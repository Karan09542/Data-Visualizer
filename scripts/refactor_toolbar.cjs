const fs = require('fs');

const path = 'src/components/MathNodeRenderer.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove overflow-hidden from line 5029
content = content.replace(
  '                        <div className="flex flex-col flex-1 min-w-0 w-full md:w-auto overflow-hidden relative">',
  '                        <div className="flex flex-col flex-1 min-w-0 w-full md:w-auto relative">'
);

// 2. Add relative group/input to line 5030
content = content.replace(
  '                          <div className="flex items-center font-mono text-sm w-full gap-1">',
  '                          <div className="flex items-center font-mono text-sm w-full gap-1 relative group/input">'
);

// Extract the Desktop Inline Actions
const startTag = '{/* Desktop Inline Actions */}';
const endTag = '{/* Mobile Dropdown Actions Block */}';
const startIndex = content.indexOf(startTag);
const endIndex = content.indexOf(endTag);

if (startIndex === -1 || endIndex === -1) {
  console.log('Could not find Desktop Inline Actions block');
  process.exit(1);
}

const desktopActions = content.substring(startIndex, endIndex);

// Remove the Desktop Inline Actions from their original place
content = content.replace(desktopActions, '');

// Modify the desktopActions classes
let modifiedDesktopActions = desktopActions.replace(
  'className={`hidden md:opacity-0 md:group-hover:opacity-100 md:flex items-center gap-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-md p-0.5 transition-opacity`}',
  'className={`absolute right-[-36px] top-1/2 -translate-y-1/2 hidden md:opacity-0 md:group-hover/input:opacity-100 md:flex items-center gap-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-md p-0.5 transition-opacity z-[1000]`}'
);

// We also need to remove the top right position from the Action Buttons Block since we moved the desktop actions. 
// Wait, the Mobile Dropdown Actions are still there. They need to be positioned properly.
// The wrapper is: <div className="absolute right-2 top-2 nodrag shrink-0 z-[1000] flex flex-col md:flex-row items-end md:items-center">
// It is perfectly fine to leave it for the Mobile Dropdown Actions.

// Insert the modified desktop actions just before the closing </div> of the group/input
const targetInsert = `                                }
                              />
                            </div>
                          </div>`;

const newInsert = `                                }
                              />
                            </div>
                            
                            ${modifiedDesktopActions.trim()}
                          </div>`;

content = content.replace(targetInsert, newInsert);

fs.writeFileSync(path, content, 'utf8');
console.log('Success');
