import { X, SlidersHorizontal } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { AISettingsPanel } from './AISettingsPanel';
import { useState, useRef, useEffect } from 'react';

export default function AISettingsSidebar() {
  const { isAISettingsPanelOpen, setIsAISettingsPanelOpen, appTheme } = useStore();
  const isDark = appTheme === 'dark';

  const [panelWidth, setPanelWidth] = useState(420);
  const isResizing = useRef(false);
  
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 340 && newWidth <= 800) {
      setPanelWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] transition-opacity duration-300 ${isAISettingsPanelOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsAISettingsPanelOpen(false)}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-[10010] transform transition-transform duration-300 ease-out flex flex-col shadow-2xl border-l backdrop-blur-2xl ${
          isDark 
            ? 'bg-black/70 border-neutral-800 text-white' 
            : 'bg-white/80 border-neutral-200 text-black'
        } ${isAISettingsPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ width: windowWidth < 640 ? '100%' : `${panelWidth}px` }}
      >
        {/* Resize Handle */}
        <div 
          className="absolute top-0 bottom-0 -left-1 w-2 cursor-col-resize group z-10 hidden sm:flex justify-center"
          onMouseDown={handleMouseDown}
        >
          <div className={`w-0.5 h-full bg-transparent transition-colors ${isDark ? 'group-hover:bg-white' : 'group-hover:bg-black'}`} />
        </div>

        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${
          isDark ? 'bg-black/20 border-neutral-800' : 'bg-white/50 border-neutral-200'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-none border ${isDark ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-neutral-100 border-neutral-200 text-black'}`}>
              <SlidersHorizontal size={18} />
            </div>
            <div>
              <h2 className={`text-sm font-bold tracking-wide uppercase ${isDark ? 'text-white' : 'text-black'}`}>
                Parameters
              </h2>
              <p className={`text-[11px] ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
                Configure AI providers, models & hyper-parameters
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsAISettingsPanelOpen(false)}
            className={`p-1.5 rounded-none transition-colors focus:outline-none ${
              isDark 
                ? 'text-neutral-500 hover:text-white hover:bg-neutral-900' 
                : 'text-neutral-500 hover:text-black hover:bg-neutral-100'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
          <AISettingsPanel />
        </div>
      </div>
    </>
  );
}
