import { X, Keyboard, Command, Move, Type } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';

export default function ShortcutsPopup() {
  const isShortcutsOpen = useStore((state) => state.isShortcutsOpen);
  const setIsShortcutsOpen = useStore((state) => state.setIsShortcutsOpen);

  const categories = [
    {
      title: 'General',
      icon: <Command size={14} />,
      items: [
        { keys: ['Shift', '~'], desc: 'Quick search files' },
        { keys: ['Alt', 'T'], desc: 'Todo Center' },
        { keys: ['Ctrl', 'Z / Y'], desc: 'Undo / Redo' },
        { keys: ['Double Tap'], desc: 'Undo (Touch)' },
      ]
    },
    {
      title: 'Drawing Tools',
      icon: <Type size={14} />,
      items: [
        { keys: ['Shift', 'D'], desc: 'Toggle Toolbar' },
        { keys: ['Shift', 'V'], desc: 'Select Tool' },
        { keys: ['Shift', 'P'], desc: 'Pen Tool' },
        { keys: ['Shift', 'H'], desc: 'Highlighter' },
        { keys: ['Shift', 'E'], desc: 'Eraser Tool' },
        { keys: ['Alt', 'Color Key'], desc: 'Color Presets' },
        { keys: ['Tab'], desc: 'Rotate Shapes' },
      ]
    },
    {
      title: 'Navigation & Graph',
      icon: <Move size={14} />,
      items: [
        { keys: ['Scroll'], desc: 'Zoom In/Out' },
        { keys: ['Drag'], desc: 'Pan Canvas' },
        { keys: ['Shift', 'Drag'], desc: 'Move Subtree' },
        { keys: ['Right Click'], desc: 'Node Actions' },
      ]
    }
  ];

  return createPortal(
    <AnimatePresence>
      {isShortcutsOpen && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center sm:p-4 bg-slate-950/90 backdrop-blur-sm"
          onClick={() => setIsShortcutsOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            className="relative w-full max-w-lg h-[100dvh] sm:h-auto sm:max-h-[85vh] bg-slate-900 border-0 sm:border border-slate-800 shadow-2xl rounded-none sm:rounded-xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg shrink-0">
                  <Keyboard size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white tracking-tight">System Shortcuts</h2>
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Keyboard & Gestures</p>
                </div>
              </div>
              <button
                onClick={() => setIsShortcutsOpen(false)}
                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 bg-slate-950 custom-scrollbar">
              {categories.map((cat, i) => (
                <section key={i}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="text-indigo-500">{cat.icon}</div>
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">{cat.title}</h3>
                  </div>
                  <div className="space-y-2">
                    {cat.items.map((item, j) => (
                      <div
                        key={j}
                        className="flex items-center justify-between gap-4 p-2.5 rounded-lg bg-slate-900/50 border border-slate-800/50 group hover:border-slate-700 transition-colors"
                      >
                        <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors font-medium">
                          {item.desc}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {item.keys.map((k, l) => (
                            <kbd
                              key={l}
                              className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-[10px] font-mono text-indigo-400 min-w-[24px] text-center shadow-sm"
                            >
                              {k}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-slate-900 border-t border-slate-800 shrink-0 flex justify-center">
              <button
                onClick={() => setIsShortcutsOpen(false)}
                className="w-full sm:w-auto px-8 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95 border border-slate-700"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
