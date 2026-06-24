const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'MathNodeRenderer.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Find the start of the copy block
const searchStartStr = "{/* Predefined Variables Copy Box */}";
const startIndex = content.indexOf(searchStartStr);
if (startIndex === -1) {
  console.error("Could not find start of predefined variables copy box");
  process.exit(1);
}

// Let's find the closing tags of this section.
const targetEndStr = "Change Origin [h, k]";
const endIndex = content.indexOf(targetEndStr, startIndex);
if (endIndex === -1) {
  console.error("Could not find end reference 'Change Origin [h, k]'");
  process.exit(1);
}

// Slice the text between startIndex and the `Change Origin [h, k]` line
const beforeText = content.substring(0, startIndex);
const afterText = content.substring(endIndex);

const replacementText = `{/* Predefined Variables Copy Box */}
                                        <div className="mt-1.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/80 dark:border-blue-900/40 p-2.5 rounded-lg flex flex-col gap-1.5">
                                          <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1">
                                            <Sparkles size={11} className="text-blue-500 dark:text-blue-400" /> Referencing this Timeline
                                          </span>
                                          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                            Type these variables into math formulas to read this specific timeline:
                                          </p>
                                          <div className="flex flex-col gap-1.5 mt-0.5">
                                            {(() => {
                                              const copyId = \`\${f.id}-t\`;
                                              const isCopied = copiedVarId === copyId;
                                              return (
                                                <div 
                                                  className={\`flex items-center justify-between px-2 py-1 rounded border shadow-2xs cursor-pointer transition-all \${
                                                    isCopied 
                                                      ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800" 
                                                      : "bg-white dark:bg-slate-800/80 border-blue-100 dark:border-blue-900 hover:border-blue-300 dark:hover:border-blue-700"
                                                  }\`}
                                                  onClick={() => {
                                                    navigator.clipboard.writeText("t");
                                                    setCopiedVarId(copyId);
                                                    setTimeout(() => setCopiedVarId(null), 1500);
                                                  }}
                                                  title="Click to copy 't'"
                                                >
                                                  <div className="flex items-center gap-1.5">
                                                    <code className={\`text-[10px] font-mono px-1 py-0.5 rounded font-bold transition-colors \${
                                                      isCopied 
                                                        ? "bg-emerald-100/50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400" 
                                                        : "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                                                    }\`}>t</code>
                                                    <span className="text-[9px] text-slate-500 dark:text-slate-400">Inside this function</span>
                                                    {isCopied && <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium animate-fadeIn">Copied!</span>}
                                                  </div>
                                                  {isCopied ? (
                                                    <Check size={11} className="text-emerald-500 dark:text-emerald-400" />
                                                  ) : (
                                                    <Copy size={10} className="text-blue-500 dark:text-blue-400" />
                                                  )}
                                                </div>
                                              );
                                            })()}

                                            {(() => {
                                              const copyId = \`\${f.id}-t_\${fnIndex}\`;
                                              const isCopied = copiedVarId === copyId;
                                              return (
                                                <div 
                                                  className={\`flex items-center justify-between px-2 py-1 rounded border shadow-2xs cursor-pointer transition-all \${
                                                    isCopied 
                                                      ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800" 
                                                      : "bg-white dark:bg-slate-800/80 border-blue-100 dark:border-blue-900 hover:border-blue-300 dark:hover:border-blue-700"
                                                  }\`}
                                                  onClick={() => {
                                                    navigator.clipboard.writeText(\`t_\${fnIndex}\`);
                                                    setCopiedVarId(copyId);
                                                    setTimeout(() => setCopiedVarId(null), 1500);
                                                  }}
                                                  title={\`Click to copy 't_\${fnIndex}'\`}
                                                >
                                                  <div className="flex items-center gap-1.5">
                                                    <code className={\`text-[10px] font-mono px-1 py-0.5 rounded font-bold transition-colors \${
                                                      isCopied 
                                                        ? "bg-emerald-100/50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400" 
                                                        : "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                                                    }\`}>{\`t_\${fnIndex}\`}</code>
                                                    <span className="text-[9px] text-slate-500 dark:text-slate-400">Any function in workspace</span>
                                                    {isCopied && <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium animate-fadeIn">Copied!</span>}
                                                  </div>
                                                  {isCopied ? (
                                                    <Check size={11} className="text-emerald-500 dark:text-emerald-400" />
                                                  ) : (
                                                    <Copy size={10} className="text-blue-500 dark:text-blue-400" />
                                                  )}
                                                </div>
                                              );
                                            })()}

                                            {fnCleanName && fnCleanName !== "t" && fnCleanName !== "time" && (() => {
                                              const copyId = \`\${f.id}-t_\${fnCleanName}\`;
                                              const isCopied = copiedVarId === copyId;
                                              return (
                                                <div 
                                                  className={\`flex items-center justify-between px-2 py-1 rounded border shadow-2xs cursor-pointer transition-all \${
                                                    isCopied 
                                                      ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800" 
                                                      : "bg-white dark:bg-slate-800/80 border-blue-100 dark:border-blue-900 hover:border-blue-300 dark:hover:border-blue-700"
                                                  }\`}
                                                  onClick={() => {
                                                    navigator.clipboard.writeText(\`t_\${fnCleanName}\`);
                                                    setCopiedVarId(copyId);
                                                    setTimeout(() => setCopiedVarId(null), 1500);
                                                  }}
                                                  title={\`Click to copy 't_\${fnCleanName}'\`}
                                                >
                                                  <div className="flex items-center gap-1.5">
                                                    <code className={\`text-[10px] font-mono px-1 py-0.5 rounded font-bold transition-colors \${
                                                      isCopied 
                                                        ? "bg-emerald-100/50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400" 
                                                        : "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                                                    }\`}>{\`t_\${fnCleanName}\`}</code>
                                                    <span className="text-[9px] text-slate-500 dark:text-slate-400">Any function in workspace</span>
                                                    {isCopied && <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium animate-fadeIn">Copied!</span>}
                                                  </div>
                                                  {isCopied ? (
                                                    <Check size={11} className="text-emerald-500 dark:text-emerald-400" />
                                                  ) : (
                                                    <Copy size={10} className="text-blue-500 dark:text-blue-400" />
                                                  )}
                                                </div>
                                              );
                                            })()}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>

                                <div className="flex items-center justify-between mt-1 p-2 border border-blue-500/10 bg-blue-500/5 dark:bg-blue-500/5 rounded">
                                  `;

fs.writeFileSync(filePath, beforeText + replacementText + afterText, 'utf8');
console.log("Predefined Variables copy boxes replaced successfully!");
