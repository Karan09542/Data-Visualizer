import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, HelpCircle, Variable, FunctionSquare, Zap, Waves, Disc } from 'lucide-react';

interface MathHelpPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const MathHelpPopup: React.FC<MathHelpPopupProps> = ({ isOpen, onClose }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden font-sans"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <FunctionSquare className="text-blue-500" size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Math Canvas Guide</h2>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Dynamic Expression Rendering</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Variable className="text-purple-500" size={16} />
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Standard Variables</h3>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                    <li className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                      <code className="text-blue-500 font-mono">x</code>
                      <span>Input variable</span>
                    </li>
                    <li className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                      <code className="text-blue-500 font-mono">t</code>
                      <span>Time elapsed (seconds)</span>
                    </li>
                    <li className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                      <code className="text-blue-500 font-mono">p</code>
                      <span>Individual seed/phase</span>
                    </li>
                    <li className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                      <code className="text-blue-500 font-mono">theta</code>
                      <span>Polar angle (for Polar)</span>
                    </li>
                  </ul>
                </section>

                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="text-amber-500" size={16} />
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Modern Syntax</h3>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
                    Powered by Math.js. Supports advanced functions like <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">signum</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">sqrt</code>, and trigonometry.
                  </p>
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
                    <code className="text-[11px] font-mono text-purple-600 dark:text-purple-400 block">sin(x/p) * abs(cos(t))</code>
                  </div>
                </section>
              </div>

              <div className="mt-8 space-y-6">
                <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Waves className="text-blue-500" size={16} />
                    <h4 className="text-[13px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Function Types</h4>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-[100px_1fr] gap-4">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Explicit</span>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">
                        Standard <code className="font-mono text-blue-500">y = f(x)</code>. Draws a path tracing the function.
                        <div className="mt-1 font-mono text-slate-400 italic">Example: sin(x) + cos(t)</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-[100px_1fr] gap-4">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Parametric</span>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">
                        Define <code className="font-mono text-blue-500">x(t)</code> and <code className="font-mono text-blue-500">y(t)</code> using a semicolon.
                        <div className="mt-1 font-mono text-slate-400 italic">Example: x(t)=sin(t*5); y(t)=cos(t*3)</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-[100px_1fr] gap-4">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Polar</span>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">
                        Define <code className="font-mono text-blue-500">r = f(theta)</code>.
                        <div className="mt-1 font-mono text-slate-400 italic">Example: r = 1 + 0.5*sin(5*theta)</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-[100px_1fr] gap-4">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Implicit</span>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">
                        Field equations <code className="font-mono text-blue-500">f(x, y) = 0</code>.
                        <div className="mt-1 font-mono text-slate-400 italic">Example: sin(x*y + t) = 0</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                  <HelpCircle className="text-amber-500 shrink-0" size={18} />
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1 uppercase tracking-tighter">Pro Tip</span>
                    Use the <span className="font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1 rounded">p</span> variable to create variation between multiple shapes using the same function. It provides a unique seed for every stroke.
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95"
              >
                Got it!
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default MathHelpPopup;
