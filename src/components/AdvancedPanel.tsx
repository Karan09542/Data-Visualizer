import { X, Image as ImageIcon, Expand, Maximize, LayoutTemplate, Palette } from 'lucide-react';
import { useStore, CanvasTheme } from '../store/useStore';
import { ChromePicker, ColorResult } from 'react-color';
import { useState, useRef, useEffect } from 'react';

const canvasThemes: CanvasTheme[] = ['none', 'dots', 'grid', 'lines'];

export default function AdvancedPanel() {
  const {
    isAdvancedPanelOpen, setIsAdvancedPanelOpen,
    showMediaPreview, setShowMediaPreview,
    nodeSpread, setNodeSpread,
    nodeSize, setNodeSize,
    canvasTheme, setCanvasTheme,
    canvasBackgroundColor, setCanvasBackgroundColor,
    canvasPatternColor, setCanvasPatternColor
  } = useStore();

  const [showBgPicker, setShowBgPicker] = useState(false);
  const [showPatternPicker, setShowPatternPicker] = useState(false);

  const bgPickerRef = useRef<HTMLDivElement>(null);
  const patternPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bgPickerRef.current && !bgPickerRef.current.contains(event.target as Node)) {
        setShowBgPicker(false);
      }
      if (patternPickerRef.current && !patternPickerRef.current.contains(event.target as Node)) {
        setShowPatternPicker(false);
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
        className={`fixed top-0 right-0 bottom-0 w-80 bg-slate-900 border-l border-slate-800 z-50 transform transition-transform duration-300 ease-out flex flex-col shadow-2xl ${isAdvancedPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-slate-200">Advanced Options</h2>
          <button
            onClick={() => setIsAdvancedPanelOpen(false)}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors focus:outline-none"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {/* Media Preview Toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-md shrink-0">
                <ImageIcon size={18} />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-200">Media Preview</div>
                <div className="text-xs text-slate-400 mt-0.5 leading-snug">Renders image/audio/video from URLs or Base64 explicitly</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
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
          <div className="flex flex-col p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 gap-2">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-md shrink-0">
                <Expand size={18} />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-200 flex justify-between">
                  <span>Node Spread Distance</span>
                  <span className="text-blue-400">{nodeSpread.toFixed(1)}x</span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5 leading-snug">Adjust the padding/margin between nodes uniformly.</div>
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
          <div className="flex flex-col p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 gap-2">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-md shrink-0">
                <Maximize size={18} />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-200 flex justify-between">
                  <span>Node Size Scale</span>
                  <span className="text-emerald-400">{nodeSize.toFixed(1)}x</span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5 leading-snug">Adjust the overall size of nodes and their content.</div>
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
          <div className="flex flex-col p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-md shrink-0">
                <LayoutTemplate size={18} />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-200">Canvas Background</div>
                <div className="text-xs text-slate-400 mt-0.5 leading-snug">Choose a background pattern for the canvas.</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {canvasThemes.map((theme) => (
                <button
                  key={theme}
                  onClick={() => setCanvasTheme(theme)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${canvasTheme === theme
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-700'
                    }`}
                >
                  {theme}
                </button>
              ))}
            </div>

            <div className="flex items-start gap-3 mt-2 pt-3 border-t border-slate-700/50">
              <div className="p-2 bg-pink-500/10 text-pink-400 rounded-md shrink-0">
                <Palette size={18} />
              </div>
              <div className="w-full">
                <div className="text-sm font-medium text-slate-200">Canvas Colors</div>
                <div className="flex flex-col gap-3 mt-3 w-full">
                  <div className="flex items-center justify-between relative">
                    <span className="text-xs text-slate-400">Background</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setShowBgPicker(!showBgPicker); setShowPatternPicker(false); }}
                        className="w-8 h-8 rounded border border-slate-600 shadow-sm transition-transform cursor-pointer"
                        style={{ backgroundColor: canvasBackgroundColor }}
                      />
                      {showBgPicker && (
                        <div className="absolute right-0 top-10 z-50" ref={bgPickerRef}>
                          <ChromePicker
                            color={canvasBackgroundColor}
                            onChange={(color) => handleColorChange(color, setCanvasBackgroundColor)}
                            disableAlpha={false}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  {canvasTheme !== 'none' && (
                    <div className="flex items-center justify-between relative">
                      <span className="text-xs text-slate-400">Pattern Shape</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setShowPatternPicker(!showPatternPicker); setShowBgPicker(false); }}
                          className="w-8 h-8 rounded border border-slate-600 shadow-sm transition-transform cursor-pointer"
                          style={{ backgroundColor: canvasPatternColor }}
                        />
                        {showPatternPicker && (
                          <div className="absolute right-0 top-10 z-50" ref={patternPickerRef}>
                            <ChromePicker
                              color={canvasPatternColor}
                              onChange={(color) => handleColorChange(color, setCanvasPatternColor)}
                              disableAlpha={false}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
