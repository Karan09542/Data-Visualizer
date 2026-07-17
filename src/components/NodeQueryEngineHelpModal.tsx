import React from 'react';
import { createPortal } from 'react-dom';
import { Command, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  showHelp: boolean;
  setShowHelp: (show: boolean) => void;
  appTheme: string;
}

export default function NodeQueryEngineHelpModal({ showHelp, setShowHelp, appTheme }: Props) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {showHelp && (
        <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-auto sm:p-4 bg-slate-950/90 backdrop-blur-sm"
            onWheel={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
        >
              <motion.div
                  initial={{ opacity: 0, scale: 0.98, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: 10 }}
                  className={`relative w-full max-w-2xl h-[100dvh] sm:h-full max-h-none sm:max-h-[90vh] shadow-2xl overflow-hidden flex flex-col sm:rounded-xl border-0 sm:border ${
                      appTheme === 'dark' ? 'bg-[#0d1117] border-slate-800' : 'bg-white border-slate-200'
                  }`}
              >
                  <div className={`px-4 sm:px-6 py-3 sm:py-4 border-b flex justify-between items-center shrink-0 ${appTheme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg shrink-0">
                              <Command size={18} />
                          </div>
                          <div>
                              <h2 className={`font-bold text-sm sm:text-base tracking-tight ${appTheme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>
                                  Search & Query Guide
                              </h2>
                              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mt-0.5">Advanced Syntax Helper</p>
                          </div>
                      </div>
                      <button
                          onClick={() => setShowHelp(false)}
                          className={`p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors ${appTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}
                      >
                          <X size={20} />
                      </button>
                  </div>
                  <div className={`flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar font-sans text-sm leading-relaxed ${appTheme === 'dark' ? 'bg-[#0d1117] text-slate-300' : 'bg-white text-slate-600'}`}>
                      
                      <div className="space-y-8">
                          <section>
                              <div className="flex items-center gap-2 mb-3">
                                  <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
                                  <h3 className={`font-bold text-xs uppercase tracking-wider ${appTheme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>Basic Search</h3>
                              </div>
                              <div className={`p-4 rounded-xl border ${appTheme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                                  <p className="mb-3 text-xs sm:text-sm">Type any word to perform a semantic fuzzy search across node names, values, paths, and types.</p>
                                  <code className={`px-3 py-2 rounded-lg text-xs font-mono block w-full ${appTheme === 'dark' ? 'bg-slate-950 text-indigo-400' : 'bg-white border border-slate-200 text-indigo-600'}`}>auth</code>
                              </div>
                          </section>
                          
                          <section>
                              <div className="flex items-center gap-2 mb-3">
                                  <div className="w-1 h-4 bg-amber-500 rounded-full"></div>
                                  <h3 className={`font-bold text-xs uppercase tracking-wider ${appTheme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>Field Queries & Comparisons</h3>
                              </div>
                              <div className={`p-4 rounded-xl border ${appTheme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                                  <p className="mb-4 text-xs sm:text-sm">Use <code className="font-mono text-indigo-500">field:value</code> syntax to query specific properties. Supports comparison operators (<code className="font-mono text-indigo-500">&gt;, &lt;, &gt;=, &lt;=, !=, ==</code>) on deeply nested fields.</p>
                                  <div className="space-y-2.5">
                                      {[
                                          { cmd: 'type:"array"', desc: 'Exact type match', color: 'text-amber-400' },
                                          { cmd: 'depth>=3', desc: 'Depth is ≥ 3', color: 'text-emerald-400' },
                                          { cmd: 'childrenCount > 5', desc: 'More than 5 children', color: 'text-pink-400' },
                                          { cmd: 'id!="root"', desc: 'ID is not "root"', color: 'text-purple-400' },
                                          { cmd: 'name/="^auth"', desc: 'Regex (starts with "auth")', color: 'text-fuchsia-400' },
                                          { cmd: 'price > 10 AND size < 5', desc: 'Multi-condition search', color: 'text-blue-400' }
                                      ].map((item, i) => (
                                          <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 p-2 rounded-lg bg-black/20 group hover:bg-black/30 transition-colors">
                                              <code className={`font-mono text-[11px] ${item.color}`}>{item.cmd}</code>
                                              <span className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">{item.desc}</span>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          </section>
                          
                          <section>
                              <div className="flex items-center gap-2 mb-3">
                                  <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
                                  <h3 className={`font-bold text-xs uppercase tracking-wider ${appTheme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>Strict Semantic Operators</h3>
                              </div>
                              <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 p-4 rounded-xl border ${appTheme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                                  {[
                                      { op: ':', desc: 'Equality' },
                                      { op: '~=', desc: 'Fuzzy' },
                                      { op: '*=', desc: 'Contains' },
                                      { op: '/=', desc: 'Regex' },
                                      { op: '>, <', desc: 'Numeric' },
                                      { op: 'IN', desc: 'Overlap' }
                                  ].map((item, i) => (
                                      <div key={i} className="flex flex-col items-center justify-center p-2 rounded-lg bg-black/20 text-center">
                                          <code className="text-indigo-400 font-bold text-xs mb-1">{item.op}</code>
                                          <span className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter">{item.desc}</span>
                                      </div>
                                  ))}
                              </div>
                          </section>
                          
                          <section>
                              <div className="flex items-center gap-2 mb-3">
                                  <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
                                  <h3 className={`font-bold text-xs uppercase tracking-wider ${appTheme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>Logical Grouping</h3>
                              </div>
                              <div className={`grid grid-cols-1 sm:grid-cols-3 gap-2 p-4 rounded-xl border ${appTheme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                                  <div className="flex items-center gap-3 p-2 rounded-lg bg-black/20">
                                      <code className="text-indigo-400 font-bold text-xs w-8">AND</code>
                                      <span className="text-[10px] text-slate-500 uppercase font-bold">All match</span>
                                  </div>
                                  <div className="flex items-center gap-3 p-2 rounded-lg bg-black/20">
                                      <code className="text-indigo-400 font-bold text-xs w-8">OR</code>
                                      <span className="text-[10px] text-slate-500 uppercase font-bold">Any match</span>
                                  </div>
                                  <div className="flex items-center gap-3 p-2 rounded-lg bg-black/20">
                                      <code className="text-indigo-400 font-bold text-xs w-8">( )</code>
                                      <span className="text-[10px] text-slate-500 uppercase font-bold">Priority</span>
                                  </div>
                              </div>
                          </section>
                          
                          <section>
                              <div className="flex items-center gap-2 mb-3">
                                  <div className="w-1 h-4 bg-purple-500 rounded-full"></div>
                                  <h3 className={`font-bold text-xs uppercase tracking-wider ${appTheme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>Deep Path Queries</h3>
                              </div>
                              <div className={`p-4 rounded-xl border ${appTheme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                                  <p className="mb-4 text-xs sm:text-sm text-slate-500 italic">Wildcards and array indices are supported.</p>
                                  <div className="space-y-2">
                                      <div className="p-2 rounded-lg bg-black/20">
                                          <code className="text-xs text-indigo-400 block mb-1">settings.theme:"dark"</code>
                                          <p className="text-[10px] text-slate-500">Matches nested objects</p>
                                      </div>
                                      <div className="p-2 rounded-lg bg-black/20">
                                          <code className="text-xs text-indigo-400 block mb-1">features[].name:"Export"</code>
                                          <p className="text-[10px] text-slate-500">Searches all array items</p>
                                      </div>
                                  </div>
                              </div>
                          </section>
                          
                          <section>
                              <div className="flex items-center gap-2 mb-3">
                                  <div className="w-1 h-4 bg-emerald-400 rounded-full"></div>
                                  <h3 className={`font-bold text-xs uppercase tracking-wider ${appTheme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>JSON Power User</h3>
                              </div>
                              <div className={`p-4 rounded-xl border ${appTheme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                                  <p className="mb-3 text-xs text-slate-500">Supports strict MongoDB-style operators.</p>
                                  <pre className={`p-4 rounded-xl text-[11px] font-mono overflow-x-auto border shadow-inner ${appTheme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}>
{`{
  "$or": [
    { "type": { "$eq": "object" } },
    { "depth": { "$gt": 2 } }
  ],
  "name": { "$regex": "^u.*" }
}`}
                                  </pre>
                              </div>
                          </section>
                      </div>
                  </div>

                  {/* Footer */}
                  <div className={`px-6 py-3 border-t shrink-0 flex justify-between items-center ${appTheme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex items-center gap-2">
                          <kbd className={`px-1.5 py-0.5 rounded text-[10px] border font-mono shadow-sm ${appTheme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-500'}`}>Ctrl+F</kbd>
                          <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Focus Search</span>
                      </div>
                      <button 
                          onClick={() => setShowHelp(false)}
                          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-lg shadow-indigo-600/10"
                      >
                          Got it
                      </button>
                  </div>
              </motion.div>
              
              {/* Backdrop Click */}
              <div 
                  className="absolute inset-0 -z-10" 
                  onClick={() => setShowHelp(false)}
              />
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
