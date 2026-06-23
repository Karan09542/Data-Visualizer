const fs = require('fs');
let code = fs.readFileSync('src/components/MathNodeRenderer.tsx', 'utf8');

// Inside the Side Settings Panel (under label input), let's add Label Position inputs
const labelSettingsInsertion = `                                  className="flex-1 bg-white dark:bg-slate-800 text-xs px-2 py-1.5 rounded outline-none border border-slate-300 dark:border-slate-600 focus:border-blue-500 transition-colors text-slate-700 dark:text-slate-200"
                                />
                              </div>`;

const newLabelSettings = `                                  className="flex-1 bg-white dark:bg-slate-800 text-xs px-2 py-1.5 rounded outline-none border border-slate-300 dark:border-slate-600 focus:border-blue-500 transition-colors text-slate-700 dark:text-slate-200"
                                />
                              </div>
                              <div className="flex gap-2 mb-2">
                                <div className="flex-1 flex gap-1 items-center">
                                  <span className="text-slate-500 dark:text-slate-400 text-[10px] w-4">X</span>
                                  <input 
                                    type="number"
                                    value={f.labelPosition?.[0] ?? 0.3}
                                    onChange={(e) => setFunctions(prev => prev.map(fn => fn.id === f.id ? {...fn, labelPosition: [parseFloat(e.target.value) || 0, fn.labelPosition?.[1] ?? 0.3]} : fn))}
                                    className="w-full bg-white dark:bg-slate-800 text-center px-1 py-1 rounded outline-none border border-slate-300 dark:border-slate-600 focus:border-blue-500 text-[10px] text-slate-700 dark:text-slate-200 font-mono"
                                  />
                                </div>
                                <div className="flex-1 flex gap-1 items-center">
                                  <span className="text-slate-500 dark:text-slate-400 text-[10px] w-4">Y</span>
                                  <input 
                                    type="number"
                                    value={f.labelPosition?.[1] ?? 0.3}
                                    onChange={(e) => setFunctions(prev => prev.map(fn => fn.id === f.id ? {...fn, labelPosition: [fn.labelPosition?.[0] ?? 0.3, parseFloat(e.target.value) || 0]} : fn))}
                                    className="w-full bg-white dark:bg-slate-800 text-center px-1 py-1 rounded outline-none border border-slate-300 dark:border-slate-600 focus:border-blue-500 text-[10px] text-slate-700 dark:text-slate-200 font-mono"
                                  />
                                </div>
                              </div>`;

code = code.replace(labelSettingsInsertion, newLabelSettings);

// Now for point-based labels: add labelPosition usage
const pointLabel = `                                                  <SafeLabel
                                                    at={[
                                                      p[0] + 0.3,
                                                      p[1] + 0.3,
                                                    ]}`;
const newPointLabel = `                                                  <SafeLabel
                                                    at={[
                                                      p[0] + (f.labelPosition?.[0] ?? 0.3),
                                                      p[1] + (f.labelPosition?.[1] ?? 0.3),
                                                    ]}`;
code = code.replace(pointLabel, newPointLabel);

// Now for continuous curve labels we added earlier:
const curveLabelRegex = /\{\!isPointBased && f\.showLabel && f\.label && \([\s\S]*?<\/Text>\n                                      \)\}/g;

const newCurveLabel = `{!isPointBased && f.showLabel && f.label && (
                                        <SafeLabel
                                          at={[px + (f.labelPosition?.[0] ?? 0.3), py + (f.labelPosition?.[1] ?? 0.3)]}
                                          tex={f.label}
                                          color={f.color}
                                        />
                                      )}`;

code = code.replace(curveLabelRegex, newCurveLabel);

fs.writeFileSync('src/components/MathNodeRenderer.tsx', code);
