import { X, Image as ImageIcon, Expand, Maximize, LayoutTemplate, Palette, RotateCcw, Keyboard } from 'lucide-react';
import { useStore, CanvasTheme, defaultSettings } from '../store/useStore';
import { ChromePicker, ColorResult } from 'react-color';
import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

const canvasThemes: CanvasTheme[] = ['none', 'dots', 'grid', 'lines'];

export default function AdvancedPanel() {
  const {
    isAdvancedPanelOpen, setIsAdvancedPanelOpen,
    showMediaPreview, setShowMediaPreview,
    nodeSpread, setNodeSpread,
    nodeSize, setNodeSize,
    canvasTheme, setCanvasTheme,
    canvasBackgroundColor, setCanvasBackgroundColor,
    canvasPatternColor, setCanvasPatternColor,
    canvasBackgroundImage, setCanvasBackgroundImage,
    canvasBackgroundBlur, setCanvasBackgroundBlur,
    resetAllSettings, setIsShortcutsOpen
  } = useStore();

  const [showBgPicker, setShowBgPicker] = useState(false);
  const [showPatternPicker, setShowPatternPicker] = useState(false);

  const bgPickerRef = useRef<HTMLDivElement>(null);
  const patternPickerRef = useRef<HTMLDivElement>(null);
  const bgButtonRef = useRef<HTMLButtonElement>(null);
  const patternButtonRef = useRef<HTMLButtonElement>(null);

  const [bgPickerStyle, setBgPickerStyle] = useState<React.CSSProperties>({ position: 'fixed', top: -9999, left: -9999, opacity: 0 });
  const [patternPickerStyle, setPatternPickerStyle] = useState<React.CSSProperties>({ position: 'fixed', top: -9999, left: -9999, opacity: 0 });

  useLayoutEffect(() => {
    const updatePosition = (buttonRef: React.RefObject<HTMLButtonElement>, setStyle: React.Dispatch<React.SetStateAction<React.CSSProperties>>) => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const pickerWidth = 225; // Approximate ChromePicker width
      const pickerHeight = 250; // Approximate ChromePicker height
      
      let top = rect.bottom + 8;
      let left = rect.right - pickerWidth;
      
      // Auto-adjust vertical if overflowing bottom
      if (top + pickerHeight > window.innerHeight) {
        top = rect.top - pickerHeight - 8;
      }
      
      // Auto-adjust horizontal if overflowing left
      if (left < 10) {
        left = 10;
      }
      
      setStyle({
        position: 'fixed',
        top,
        left,
        zIndex: 9999,
        opacity: 1
      });
    };

    if (showBgPicker) updatePosition(bgButtonRef, setBgPickerStyle);
    if (showPatternPicker) updatePosition(patternButtonRef, setPatternPickerStyle);
    
    // Auto-update position on window resize
    const handleResize = () => {
      if (showBgPicker) updatePosition(bgButtonRef, setBgPickerStyle);
      if (showPatternPicker) updatePosition(patternButtonRef, setPatternPickerStyle);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Adding scroll listener to the panel container would be ideal, but window resize is usually enough.
    // For a fixed element, we might want to update position when scrolling the advanced panel.
    const panelNode = bgButtonRef.current?.closest('.overflow-y-auto');
    if (panelNode) {
      panelNode.addEventListener('scroll', handleResize);
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (panelNode) {
        panelNode.removeEventListener('scroll', handleResize);
      }
    };
  }, [showBgPicker, showPatternPicker]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Don't close if clicking the toggle button itself
      if (bgButtonRef.current?.contains(event.target as Node) || 
          patternButtonRef.current?.contains(event.target as Node)) {
        return;
      }
      if (bgPickerRef.current && !bgPickerRef.current.contains(event.target as Node)) {
        setShowBgPicker(false);
        setBgPickerStyle({ position: 'fixed', top: -9999, left: -9999, opacity: 0 });
      }
      if (patternPickerRef.current && !patternPickerRef.current.contains(event.target as Node)) {
        setShowPatternPicker(false);
        setPatternPickerStyle({ position: 'fixed', top: -9999, left: -9999, opacity: 0 });
      }
    };
    if (showBgPicker || showPatternPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showBgPicker, showPatternPicker]);

  const handleColorChange = (color: ColorResult, setter: (val: string) => void) => {
    const { r, g, b, a } = color.rgb;
    setter(`rgba(${r}, ${g}, ${b}, ${a})`);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${isAdvancedPanelOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsAdvancedPanelOpen(false)}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 bottom-0 w-80 bg-slate-50 dark:bg-slate-900 border-l border-slate-300 dark:border-slate-800 z-50 transform transition-transform duration-300 ease-out flex flex-col shadow-2xl ${isAdvancedPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-300 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Advanced Options</h2>
          <button
            onClick={() => setIsAdvancedPanelOpen(false)}
            className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors focus:outline-none"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-4">
          {/* Media Preview Toggle */}
          <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-300 dark:border-slate-700/50">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-md shrink-0">
                <ImageIcon size={18} />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200">Media Preview</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">Renders image/audio/video from URLs or Base64 explicitly</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={showMediaPreview}
                onChange={(e) => setShowMediaPreview(e.target.checked)}
              />
              <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-200 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
            </label>
          </div>

          {/* Node Spread Slider */}
          <div className="flex flex-col p-3 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-300 dark:border-slate-700/50 gap-2">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-md shrink-0">
                <Expand size={18} />
              </div>
              <div className="w-full">
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200 flex justify-between items-center w-full">
                  <span>Node Spread Distance</span>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-500 dark:text-blue-400">{nodeSpread.toFixed(1)}x</span>
                    <button onClick={() => setNodeSpread(defaultSettings.nodeSpread)} title="Reset" className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                      <RotateCcw size={12} />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">Adjust the padding/margin between nodes uniformly.</div>
              </div>
            </div>
            <div className="px-1 pt-2 pb-1">
              <input
                type="range"
                min="0.5"
                max="5.0"
                step="0.1"
                value={nodeSpread}
                onChange={(e) => setNodeSpread(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>0.5x</span>
                <span>5.0x</span>
              </div>
            </div>
          </div>

          {/* Node Size Slider */}
          <div className="flex flex-col p-3 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-300 dark:border-slate-700/50 gap-2">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-md shrink-0">
                <Maximize size={18} />
              </div>
              <div className="w-full">
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200 flex justify-between items-center">
                  <span>Node Size Scale</span>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-500 dark:text-emerald-400">{nodeSize.toFixed(1)}x</span>
                    <button onClick={() => setNodeSize(defaultSettings.nodeSize)} title="Reset" className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                      <RotateCcw size={12} />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">Adjust the overall size of nodes and their content.</div>
              </div>
            </div>
            <div className="px-1 pt-2 pb-1">
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={nodeSize}
                onChange={(e) => setNodeSize(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>0.5x</span>
                <span>2.0x</span>
              </div>
            </div>
          </div>

          {/* Canvas Theme Selector */}
          <div className="flex flex-col p-3 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-300 dark:border-slate-700/50 gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-md shrink-0">
                <LayoutTemplate size={18} />
              </div>
              <div className="w-full">
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>Canvas Background</span>
                  <button onClick={() => setCanvasTheme(defaultSettings.canvasTheme)} title="Reset" className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                    <RotateCcw size={12} />
                  </button>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">Choose a background pattern for the canvas.</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {canvasThemes.map((theme) => (
                <button
                  key={theme}
                  onClick={() => setCanvasTheme(theme)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${canvasTheme === theme
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200 border border-slate-300 dark:border-slate-700'
                    }`}
                >
                  {theme}
                </button>
              ))}
            </div>

            <div className="flex items-start gap-3 mt-2 pt-3 border-t border-slate-300 dark:border-slate-700/50">
              <div className="p-2 bg-pink-500/10 text-pink-500 dark:text-pink-400 rounded-md shrink-0">
                <Palette size={18} />
              </div>
              <div className="w-full">
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200 flex justify-between items-center">
                  <span>Canvas Colors</span>
                  <button 
                    onClick={() => {
                      setCanvasBackgroundColor(defaultSettings.canvasBackgroundColor);
                      setCanvasPatternColor(defaultSettings.canvasPatternColor);
                    }} 
                    title="Reset Colors" 
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    <RotateCcw size={12} />
                  </button>
                </div>
                <div className="flex flex-col gap-3 mt-3 w-full">
                  <div className="flex items-center justify-between relative">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Background</span>
                    <div className="flex items-center gap-2">
                      <button
                        ref={bgButtonRef}
                        onClick={() => {
                          if (showBgPicker) {
                            setShowBgPicker(false);
                            setBgPickerStyle({ position: 'fixed', top: -9999, left: -9999, opacity: 0 });
                          } else {
                            setShowBgPicker(true); 
                            setShowPatternPicker(false);
                          }
                        }}
                        className="w-8 h-8 rounded border border-slate-300 dark:border-slate-600 shadow-sm transition-transform cursor-pointer"
                        style={{ backgroundColor: canvasBackgroundColor }}
                      />
                      {showBgPicker && createPortal(
                        <div style={bgPickerStyle} ref={bgPickerRef}>
                          <ChromePicker
                            color={canvasBackgroundColor}
                            onChange={(color) => handleColorChange(color, setCanvasBackgroundColor)}
                            disableAlpha={false}
                          />
                        </div>,
                        document.body
                      )}
                    </div>
                  </div>
                  {canvasTheme !== 'none' && (
                    <div className="flex items-center justify-between relative mt-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Pattern Shape</span>
                      <div className="flex items-center gap-2">
                        <button
                          ref={patternButtonRef}
                          onClick={() => {
                            if (showPatternPicker) {
                              setShowPatternPicker(false);
                              setPatternPickerStyle({ position: 'fixed', top: -9999, left: -9999, opacity: 0 });
                            } else {
                              setShowPatternPicker(true);
                              setShowBgPicker(false);
                            }
                          }}
                          className="w-8 h-8 rounded border border-slate-300 dark:border-slate-600 shadow-sm transition-transform cursor-pointer"
                          style={{ backgroundColor: canvasPatternColor }}
                        />
                        {showPatternPicker && createPortal(
                          <div style={patternPickerStyle} ref={patternPickerRef}>
                            <ChromePicker
                              color={canvasPatternColor}
                              onChange={(color) => handleColorChange(color, setCanvasPatternColor)}
                              disableAlpha={false}
                            />
                          </div>,
                          document.body
                        )}
                      </div>
                    </div>
                  )}

                  {/* Background Image Sub-section */}
                  <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/50">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Background Image Settings</span>
                      <button 
                        onClick={() => {
                          setCanvasBackgroundImage(defaultSettings.canvasBackgroundImage);
                          setCanvasBackgroundBlur(defaultSettings.canvasBackgroundBlur);
                        }} 
                        title="Reset Background Image" 
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      >
                        <RotateCcw size={12} />
                      </button>
                    </div>
                    
                    <div className="flex flex-col gap-2 relative">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Image URL</span>
                      <input 
                        type="text" 
                        value={canvasBackgroundImage}
                        onChange={(e) => setCanvasBackgroundImage(e.target.value)}
                        placeholder="https://example.com/image.png"
                        className="w-full bg-slate-100 dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Image Blur</span>
                      <span className="text-xs text-slate-700 dark:text-slate-300">{canvasBackgroundBlur}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max="20" step="1"
                      value={canvasBackgroundBlur}
                      onChange={(e) => setCanvasBackgroundBlur(parseFloat(e.target.value))}
                      className="w-full mt-1 accent-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Global Reset and Shortcuts */}
        <div className="p-4 border-t border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex gap-2">
          <button
            onClick={() => setIsShortcutsOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 rounded-md transition-colors text-sm font-medium"
          >
            <Keyboard size={16} />
            Shortcuts
          </button>
          <button
            onClick={resetAllSettings}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-md transition-colors text-sm font-medium"
          >
            <RotateCcw size={16} />
            Reset All
          </button>
        </div>
      </div>
    </>
  );
}
