import { X, Keyboard } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function ShortcutsPopup() {
  const { isShortcutsOpen, setIsShortcutsOpen } = useStore();

  if (!isShortcutsOpen) return null;

  const shortcuts = [
    { keys: ['Shift', '~'], desc: 'Quick search files' },
    { keys: ['Alt', 'T'], desc: 'Todo Center' },
    { keys: ['Shift', 'D'], desc: 'Toggle Drawing Toolbar' },
    { keys: ['Shift', 'V'], desc: 'Select Tool' },
    { keys: ['Shift', 'P'], desc: 'Pen Tool' },
    { keys: ['Shift', 'H'], desc: 'Highlighter Tool' },
    { keys: ['Shift', 'F'], desc: 'Function Brush' },
    { keys: ['Shift', 'E'], desc: 'Eraser Tool' },
    { keys: ['Ctrl', 'Drag'], desc: 'Draw when toolbar is hidden' },
    { keys: ['Alt', 'R/O/Y/G/S/B/P/V/W/K'], desc: 'Color Presets' },
    { keys: ['Ctrl', 'Z / Y'], desc: 'Undo / Redo' },
    { keys: ['Tab / Shift+Tab'], desc: 'Change Shape While Drawing' },
    { keys: ['Double Finger Tap'], desc: 'Undo' },
    { keys: ['Double Finger Tap x2'], desc: 'Redo' },
    { keys: ['Scroll'], desc: 'Zoom In/Out' },
    { keys: ['Two Fingers Pinch'], desc: 'Zoom Graph (when tool active)' },
    { keys: ['Click & Drag'], desc: 'Pan Graph' },
    { keys: ['Shift', 'Drag Node'], desc: 'Drag Node & Subtree' },
    { keys: ['Right Click'], desc: 'Node Actions Options' },
  ];

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsShortcutsOpen(false)}>
      <div 
        className="w-full max-w-sm bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold">
            <Keyboard size={18} className="text-blue-500" />
            <span>Keyboard & Touch Shortcuts</span>
          </div>
          <button 
            onClick={() => setIsShortcutsOpen(false)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{s.desc}</span>
              <div className="flex items-center flex-wrap gap-1">
                {s.keys.map((k, j) => (
                  <span key={j} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono text-slate-700 dark:text-slate-300">
                    {k}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
