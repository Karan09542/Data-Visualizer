import { X, Image as ImageIcon, Expand, Maximize, Palette, RotateCcw, Keyboard, PenTool, HelpCircle, Layers, ChevronDown, ChevronUp, AlignLeft, Youtube, Mic, Shield } from 'lucide-react';
import { useStore, defaultSettings, NodeTheme, EdgeStyle } from '../store/useStore';
import { useAnnotationStore } from '../store/useAnnotationStore';
import { useVoiceStore } from '../voice/useVoiceStore';
import { VoiceHelpModal } from '../voice/components/VoiceHelpModal';
import { ProxySettingsModal } from './ProxySettingsModal';
import { RgbaColorPicker } from 'react-colorful';
import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';


const nodeThemes: NodeTheme[] = ['vscode', 'github', 'glassmorphism', 'cyberpunk', 'minimal', 'gradient', 'pastel', 'terminal', 'material', 'blueprint', 'retro', 'holographic', 'notebook', 'custom', 'nature', 'circuit', 'galaxy', 'glass', 'neon', 'math', 'neural', 'river', 'tree', 'pixel', 'hacker', 'cloud', 'dna', 'lava', 'ocean', 'rhythm', 'rune', 'zen', 'abstract', 'architect', 'ludo', 'chess', 'octopus', 'nature2', 'hydrogen', 'seed', 'banyan', 'peepal'];
const edgeStyles: EdgeStyle[] = ['curved', 'bezier', 'straight', 'step', 'animated', 'dashed', 'neon', 'double', 'pipe', 'thin', 'orgChart', 'circuit', 'glow', 'zigzag', 'pulse', 'ludo', 'chess', 'octopus', 'nature2', 'hydrogen', 'seed', 'metro', 'angled-step'];

export default function AdvancedPanel() {
  const {
    isAdvancedPanelOpen, setIsAdvancedPanelOpen,
    showMediaPreview, setShowMediaPreview,
    globalTextExpanded, setGlobalTextExpanded,
    nodeSpread, setNodeSpread,
    nodeSize, setNodeSize,
    nodeTheme, setNodeTheme,
    edgeStyle, setEdgeStyle,
    nodeColor, setNodeColor,
    nodeTextColor, setNodeTextColor,
    nodeGradientColor1, setNodeGradientColor1,
    nodeGradientColor2, setNodeGradientColor2,
    useNodeGradient, setUseNodeGradient,
    nodeGradientAngle, setNodeGradientAngle,
    nodeGradientType, setNodeGradientType,
    canvasTheme, setCanvasTheme,
    canvasBackgroundColor, setCanvasBackgroundColor,
    canvasPatternColor, setCanvasPatternColor,
    canvasBackgroundImage, setCanvasBackgroundImage,
    canvasBackgroundBlur, setCanvasBackgroundBlur,
    resetAllSettings, setIsShortcutsOpen,
    setIsMathHelpOpen,
    stickyNotesEnabled, setStickyNotesEnabled,
    setIsYoutubeSearchOpen,
    setIsProxyModalOpen
  } = useStore();

  const {
    isToolbarVisible, setIsToolbarVisible,
    toolbarOpacity, setToolbarOpacity,
    toolbarOrientation, setToolbarOrientation,
    toolbarScale, setToolbarScale,
    resetPreferences
  } = useAnnotationStore();

  const { isVoiceEnabled, setIsVoiceEnabled } = useVoiceStore();
  const [isVoiceHelpOpen, setIsVoiceHelpOpen] = useState(false);

  const [panelWidth, setPanelWidth] = useState(320);
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
    if (newWidth >= 280 && newWidth <= 800) {
      setPanelWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const [showBgPicker, setShowBgPicker] = useState(false);
  const [showPatternPicker, setShowPatternPicker] = useState(false);
  const [showNodeColorPicker, setShowNodeColorPicker] = useState(false);
  const [showNodeTextColorPicker, setShowNodeTextColorPicker] = useState(false);
  const [showNodeGradient1Picker, setShowNodeGradient1Picker] = useState(false);
  const [showNodeGradient2Picker, setShowNodeGradient2Picker] = useState(false);

  const bgPickerRef = useRef<HTMLDivElement>(null);
  const patternPickerRef = useRef<HTMLDivElement>(null);
  const nodeColorPickerRef = useRef<HTMLDivElement>(null);
  const nodeTextColorPickerRef = useRef<HTMLDivElement>(null);
  const nodeGradient1PickerRef = useRef<HTMLDivElement>(null);
  const nodeGradient2PickerRef = useRef<HTMLDivElement>(null);

  const bgButtonRef = useRef<HTMLButtonElement>(null);
  const patternButtonRef = useRef<HTMLButtonElement>(null);
  const nodeColorButtonRef = useRef<HTMLButtonElement>(null);
  const nodeTextColorButtonRef = useRef<HTMLButtonElement>(null);
  const nodeGradient1ButtonRef = useRef<HTMLButtonElement>(null);
  const nodeGradient2ButtonRef = useRef<HTMLButtonElement>(null);

  const [bgPickerStyle, setBgPickerStyle] = useState<React.CSSProperties>({ position: 'fixed', top: -9999, left: -9999, opacity: 0 });
  const [patternPickerStyle, setPatternPickerStyle] = useState<React.CSSProperties>({ position: 'fixed', top: -9999, left: -9999, opacity: 0 });
  const [nodeColorPickerStyle, setNodeColorPickerStyle] = useState<React.CSSProperties>({ position: 'fixed', top: -9999, left: -9999, opacity: 0 });
  const [nodeTextColorPickerStyle, setNodeTextColorPickerStyle] = useState<React.CSSProperties>({ position: 'fixed', top: -9999, left: -9999, opacity: 0 });
  const [nodeGradient1PickerStyle, setNodeGradient1PickerStyle] = useState<React.CSSProperties>({ position: 'fixed', top: -9999, left: -9999, opacity: 0 });
  const [nodeGradient2PickerStyle, setNodeGradient2PickerStyle] = useState<React.CSSProperties>({ position: 'fixed', top: -9999, left: -9999, opacity: 0 });

  const [isThemeExpanded, setIsThemeExpanded] = useState(false);
  const [isLinkStyleExpanded, setIsLinkStyleExpanded] = useState(false);

  const togglePicker = (picker: string) => {
    setShowBgPicker(picker === 'bg' ? !showBgPicker : false);
    setShowPatternPicker(picker === 'pattern' ? !showPatternPicker : false);
    setShowNodeColorPicker(picker === 'node' ? !showNodeColorPicker : false);
    setShowNodeTextColorPicker(picker === 'text' ? !showNodeTextColorPicker : false);
    setShowNodeGradient1Picker(picker === 'g1' ? !showNodeGradient1Picker : false);
    setShowNodeGradient2Picker(picker === 'g2' ? !showNodeGradient2Picker : false);

    // Reset styles for those being closed
    if (picker !== 'bg') setBgPickerStyle({ position: 'fixed', top: -9999, left: -9999, opacity: 0 });
    if (picker !== 'pattern') setPatternPickerStyle({ position: 'fixed', top: -9999, left: -9999, opacity: 0 });
    if (picker !== 'node') setNodeColorPickerStyle({ position: 'fixed', top: -9999, left: -9999, opacity: 0 });
    if (picker !== 'text') setNodeTextColorPickerStyle({ position: 'fixed', top: -9999, left: -9999, opacity: 0 });
    if (picker !== 'g1') setNodeGradient1PickerStyle({ position: 'fixed', top: -9999, left: -9999, opacity: 0 });
    if (picker !== 'g2') setNodeGradient2PickerStyle({ position: 'fixed', top: -9999, left: -9999, opacity: 0 });
  };

  useLayoutEffect(() => {
    const updatePosition = (buttonRef: React.RefObject<HTMLButtonElement>, setStyle: React.Dispatch<React.SetStateAction<React.CSSProperties>>) => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const pickerWidth = 240;
      const pickerHeight = 280;

      let top = rect.bottom + 8;
      let left = rect.right - pickerWidth;

      if (top + pickerHeight > window.innerHeight) {
        top = rect.top - pickerHeight - 8;
      }

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
    if (showNodeColorPicker) updatePosition(nodeColorButtonRef, setNodeColorPickerStyle);
    if (showNodeTextColorPicker) updatePosition(nodeTextColorButtonRef, setNodeTextColorPickerStyle);
    if (showNodeGradient1Picker) updatePosition(nodeGradient1ButtonRef, setNodeGradient1PickerStyle);
    if (showNodeGradient2Picker) updatePosition(nodeGradient2ButtonRef, setNodeGradient2PickerStyle);

    const handleResize = () => {
      if (showBgPicker) updatePosition(bgButtonRef, setBgPickerStyle);
      if (showPatternPicker) updatePosition(patternButtonRef, setPatternPickerStyle);
      if (showNodeColorPicker) updatePosition(nodeColorButtonRef, setNodeColorPickerStyle);
      if (showNodeTextColorPicker) updatePosition(nodeTextColorButtonRef, setNodeTextColorPickerStyle);
      if (showNodeGradient1Picker) updatePosition(nodeGradient1ButtonRef, setNodeGradient1PickerStyle);
      if (showNodeGradient2Picker) updatePosition(nodeGradient2ButtonRef, setNodeGradient2PickerStyle);
    };

    window.addEventListener('resize', handleResize);

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
  }, [showBgPicker, showPatternPicker, showNodeColorPicker, showNodeTextColorPicker, showNodeGradient1Picker, showNodeGradient2Picker]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const isPickerClick = [
        bgPickerRef, patternPickerRef,
        nodeColorPickerRef, nodeTextColorPickerRef, nodeGradient1PickerRef, nodeGradient2PickerRef
      ].some(ref => ref.current?.contains(event.target as Node));

      const isButtonClick = [
        bgButtonRef, patternButtonRef,
        nodeColorButtonRef, nodeTextColorButtonRef, nodeGradient1ButtonRef, nodeGradient2ButtonRef
      ].some(ref => ref.current?.contains(event.target as Node));

      if (isPickerClick || isButtonClick) return;

      setShowBgPicker(false);
      setShowPatternPicker(false);
      setShowNodeColorPicker(false);
      setShowNodeTextColorPicker(false);
      setShowNodeGradient1Picker(false);
      setShowNodeGradient2Picker(false);

      setBgPickerStyle({ position: 'fixed', top: -9999, left: -9999, opacity: 0 });
      setPatternPickerStyle({ position: 'fixed', top: -9999, left: -9999, opacity: 0 });
      setNodeColorPickerStyle({ position: 'fixed', top: -9999, left: -9999, opacity: 0 });
      setNodeTextColorPickerStyle({ position: 'fixed', top: -9999, left: -9999, opacity: 0 });
      setNodeGradient1PickerStyle({ position: 'fixed', top: -9999, left: -9999, opacity: 0 });
      setNodeGradient2PickerStyle({ position: 'fixed', top: -9999, left: -9999, opacity: 0 });
    };

    if (showBgPicker || showPatternPicker || showNodeColorPicker || showNodeTextColorPicker || showNodeGradient1Picker || showNodeGradient2Picker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showBgPicker, showPatternPicker, showNodeColorPicker, showNodeTextColorPicker, showNodeGradient1Picker, showNodeGradient2Picker]);

  const parseRgba = (color: string) => {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      return {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3]),
        a: match[4] ? parseFloat(match[4]) : 1
      };
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };

  const handleColorChange = (rgba: { r: number; g: number; b: number; a: number }, setter: (val: string) => void) => {
    setter(`rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})`);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-[600] transition-opacity duration-300 ${isAdvancedPanelOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsAdvancedPanelOpen(false)}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 bottom-0 bg-slate-50 dark:bg-[#0b1120] border-l border-slate-300 dark:border-slate-800 z-[610] transform transition-transform duration-300 ease-out flex flex-col shadow-2xl text-slate-900 dark:text-slate-100 ${isAdvancedPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ width: windowWidth < 640 ? '100%' : `${panelWidth}px` }}
      >
        {/* Resize Handle */}
        <div
          className="absolute top-0 bottom-0 -left-1 w-2 cursor-col-resize group z-10 hidden sm:flex justify-center"
          onMouseDown={handleMouseDown}
        >
          <div className="w-0.5 h-full bg-transparent group-hover:bg-blue-500 transition-colors" />
        </div>
        <div className="flex items-center justify-between p-4 border-b border-slate-300 dark:border-slate-800 bg-white dark:bg-[#0b1120]">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Advanced Options</h2>
          <button
            onClick={() => setIsAdvancedPanelOpen(false)}
            className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors focus:outline-none"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-4">
          {/* Node Appearance Section */}
          <div className="flex flex-col gap-3 p-3 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-300 dark:border-slate-700/50 text-slate-900 dark:text-slate-100">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-500/10 text-blue-500 rounded-md shrink-0">
                <Layers size={18} />
              </div>
              <div className="w-full">
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200">Node Appearance</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">Themes, shapes, and custom colors</div>
              </div>
            </div>

            {/* Theme Selection */}
            <div className="mt-1 border-t border-slate-200 dark:border-slate-700/30 pt-2">
              <button
                onClick={() => setIsThemeExpanded(!isThemeExpanded)}
                className="flex items-center justify-between w-full text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-500 uppercase mb-1 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                <span>Theme</span>
                {isThemeExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>

              <AnimatePresence>
                {isThemeExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-3 gap-1.5 min-h-0 pt-1 pb-2">
                      {nodeThemes.map((t) => (
                        <button
                          key={t}
                          onClick={() => setNodeTheme(t)}
                          title={t}
                          className={`px-1 py-1 rounded-sm text-[9px] font-medium capitalize truncate transition-all duration-200 border ${nodeTheme === t
                            ? 'bg-blue-500/10 border-blue-500/50 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/10'
                            : 'bg-slate-100/50 dark:bg-slate-900/50 border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                            }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Edge Style Selection */}
            <div className="mt-1 border-t border-slate-200 dark:border-slate-700/30 pt-2">
              <button
                onClick={() => setIsLinkStyleExpanded(!isLinkStyleExpanded)}
                className="flex items-center justify-between w-full text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-500 uppercase mb-1 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                <span>Link Style</span>
                {isLinkStyleExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>

              <AnimatePresence>
                {isLinkStyleExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-3 gap-1.5 pt-1 pb-2">
                      {edgeStyles.map((s) => (
                        <button
                          key={s}
                          onClick={() => setEdgeStyle(s)}
                          title={s}
                          className={`px-1 py-1 rounded-sm text-[9px] font-medium capitalize truncate transition-all duration-200 border ${edgeStyle === s
                            ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500/10'
                            : 'bg-slate-100/50 dark:bg-slate-900/50 border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                            }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Custom Design Section */}
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Custom Override</span>
                <div className="flex bg-slate-100 dark:bg-slate-900 rounded-lg p-0.5 border border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => { setUseNodeGradient(false); setNodeTheme('custom'); }}
                    className={`px-3 py-1 rounded-md text-[9px] font-bold transition-all ${!useNodeGradient ? 'bg-white dark:bg-slate-800 text-blue-500 shadow-sm border border-slate-200 dark:border-slate-700' : 'text-slate-400 hover:text-slate-500'}`}
                  >
                    SOLID
                  </button>
                  <button
                    onClick={() => { setUseNodeGradient(true); setNodeTheme('custom'); }}
                    className={`px-3 py-1 rounded-md text-[9px] font-bold transition-all ${useNodeGradient ? 'bg-white dark:bg-slate-800 text-purple-500 shadow-sm border border-slate-200 dark:border-slate-700' : 'text-slate-400 hover:text-slate-500'}`}
                  >
                    GRADIENT
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Fill Picker(s) */}
                <div className="flex flex-col gap-1.5 p-2 bg-slate-100/30 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700/50">
                  <span className="text-[9px] font-bold text-slate-500 dark:text-slate-500 uppercase px-1">Background</span>
                  <div className="flex items-center gap-2">
                    {!useNodeGradient ? (
                      <button
                        ref={nodeColorButtonRef}
                        onClick={() => togglePicker('node')}
                        className="w-full h-8 rounded-lg border border-white dark:border-slate-800 shadow-sm cursor-pointer transition-transform active:scale-95 ring-1 ring-slate-200 dark:ring-slate-700"
                        style={{ backgroundColor: nodeColor }}
                      />
                    ) : (
                      <div className="flex gap-1 w-full">
                        <button
                          ref={nodeGradient1ButtonRef}
                          onClick={() => togglePicker('g1')}
                          className="flex-1 h-8 rounded-lg border border-white dark:border-slate-800 shadow-sm cursor-pointer transition-transform active:scale-95 ring-1 ring-slate-200 dark:ring-slate-700"
                          style={{ backgroundColor: nodeGradientColor1 }}
                        />
                        <button
                          ref={nodeGradient2ButtonRef}
                          onClick={() => togglePicker('g2')}
                          className="flex-1 h-8 rounded-lg border border-white dark:border-slate-800 shadow-sm cursor-pointer transition-transform active:scale-95 ring-1 ring-slate-200 dark:ring-slate-700"
                          style={{ backgroundColor: nodeGradientColor2 }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Text Picker */}
                <div className="flex flex-col gap-1.5 p-2 bg-slate-100/30 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700/50">
                  <span className="text-[9px] font-bold text-slate-500 dark:text-slate-500 uppercase px-1">Foreground</span>
                  <button
                    ref={nodeTextColorButtonRef}
                    onClick={() => togglePicker('text')}
                    className="w-full h-8 rounded-lg border border-white dark:border-slate-800 shadow-sm cursor-pointer transition-transform active:scale-95 ring-1 ring-slate-200 dark:ring-slate-700"
                    style={{ backgroundColor: nodeTextColor }}
                  />
                </div>
              </div>

              {useNodeGradient && (
                <div className="mt-2 space-y-2">
                  {/* Direction & Type Row */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1 px-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Angle</span>
                        <span className="text-[9px] font-mono text-slate-400">{nodeGradientAngle}°</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        step="45"
                        value={nodeGradientAngle}
                        onChange={(e) => {
                          setNodeGradientAngle(parseInt(e.target.value));
                          setNodeTheme('custom');
                        }}
                        className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-full appearance-none cursor-pointer accent-purple-500"
                      />
                    </div>

                    <div className="flex flex-col gap-1 px-1">
                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Style</span>
                      <div className="flex bg-slate-200 dark:bg-slate-900 rounded-md p-0.5">
                        {(['linear', 'radial'] as const).map((type) => (
                          <button
                            key={type}
                            onClick={() => {
                              setNodeGradientType(type);
                              setNodeTheme('custom');
                            }}
                            className={`flex-1 text-[8px] py-0.5 font-bold uppercase transition-all rounded ${nodeGradientType === type ? 'bg-white dark:bg-slate-800 text-purple-500 shadow-sm' : 'text-slate-500 hover:text-slate-400'}`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="px-1">
                    <div className="h-1 w-full rounded-full overflow-hidden shadow-inner bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full w-full"
                        style={{
                          background: nodeGradientType === 'linear'
                            ? `linear-gradient(${nodeGradientAngle}deg, ${nodeGradientColor1}, ${nodeGradientColor2})`
                            : `radial-gradient(circle at center, ${nodeGradientColor1}, ${nodeGradientColor2})`
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>


            {/* Portals for Pickers */}
            {showNodeColorPicker && createPortal(
              <div style={nodeColorPickerStyle} ref={nodeColorPickerRef} className="bg-[#121A2F] p-4 rounded-2xl border border-slate-800 shadow-2xl z-[10000]">
                <RgbaColorPicker
                  color={parseRgba(nodeColor)}
                  onChange={(color) => {
                    handleColorChange(color, setNodeColor);
                    setNodeTheme('custom');
                  }}
                />
                <div className="mt-4 grid grid-cols-5 gap-1.5">
                  {['rgba(59, 130, 246, 1)', 'rgba(16, 185, 129, 1)', 'rgba(245, 158, 11, 1)', 'rgba(239, 68, 68, 1)', 'rgba(139, 92, 246, 1)', 'rgba(236, 72, 153, 1)', 'rgba(20, 184, 166, 1)', 'rgba(100, 116, 139, 1)', 'rgba(255, 255, 255, 1)', 'rgba(0, 0, 0, 1)'].map(c => (
                    <button key={c} onClick={() => { setNodeColor(c); setNodeTheme('custom'); }} className="w-8 h-8 rounded-md border border-white/10 hover:scale-110 transition-transform" style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>,
              document.body
            )}

            {showNodeTextColorPicker && createPortal(
              <div style={nodeTextColorPickerStyle} ref={nodeTextColorPickerRef} className="bg-[#121A2F] p-4 rounded-2xl border border-slate-800 shadow-2xl z-[10000]">
                <RgbaColorPicker
                  color={parseRgba(nodeTextColor)}
                  onChange={(color) => {
                    handleColorChange(color, setNodeTextColor);
                    setNodeTheme('custom');
                  }}
                />
                <div className="mt-4 grid grid-cols-5 gap-1.5">
                  {['rgba(255, 255, 255, 1)', 'rgba(241, 245, 249, 1)', 'rgba(148, 163, 184, 1)', 'rgba(71, 85, 105, 1)', 'rgba(15, 23, 42, 1)', 'rgba(59, 130, 246, 1)', 'rgba(239, 68, 68, 1)', 'rgba(245, 158, 11, 1)', 'rgba(16, 185, 129, 1)', 'rgba(236, 72, 153, 1)'].map(c => (
                    <button key={c} onClick={() => { setNodeTextColor(c); setNodeTheme('custom'); }} className="w-8 h-8 rounded-md border border-white/10 hover:scale-110 transition-transform" style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>,
              document.body
            )}

            {showNodeGradient1Picker && createPortal(
              <div style={nodeGradient1PickerStyle} ref={nodeGradient1PickerRef} className="bg-[#121A2F] p-4 rounded-2xl border border-slate-800 shadow-2xl z-[10000]">
                <RgbaColorPicker
                  color={parseRgba(nodeGradientColor1)}
                  onChange={(color) => {
                    handleColorChange(color, setNodeGradientColor1);
                    setNodeTheme('custom');
                  }}
                />
              </div>,
              document.body
            )}

            {showNodeGradient2Picker && createPortal(
              <div style={nodeGradient2PickerStyle} ref={nodeGradient2PickerRef} className="bg-[#121A2F] p-4 rounded-2xl border border-slate-800 shadow-2xl z-[10000]">
                <RgbaColorPicker
                  color={parseRgba(nodeGradientColor2)}
                  onChange={(color) => {
                    handleColorChange(color, setNodeGradientColor2);
                    setNodeTheme('custom');
                  }}
                />
              </div>,
              document.body
            )}


            {/* Global Theme Swatches */}
            <div className="mt-4 border-t border-slate-200 dark:border-slate-700/50 pt-3">
              <span className="text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase mb-2 block text-center">Presets</span>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  'rgba(30, 41, 59, 1)',   // Slate
                  'rgba(59, 130, 246, 1)', // Blue
                  'rgba(16, 185, 129, 1)', // Emerald
                  'rgba(79, 70, 229, 1)', // Indigo
                  'rgba(147, 51, 234, 1)', // Violet
                  'rgba(236, 72, 153, 1)', // Pink
                  'rgba(244, 63, 94, 1)',  // Rose
                  'rgba(245, 158, 11, 1)', // Amber
                  'rgba(20, 184, 166, 1)', // Teal
                  'rgba(255, 255, 255, 1)', // White
                  'rgba(10, 10, 10, 1)'    // Black
                ].map(c => (
                  <button
                    key={c}
                    onClick={() => {
                      setNodeTheme('custom');
                      if (useNodeGradient) {
                        setNodeGradientColor1(c);
                      } else {
                        setNodeColor(c);
                      }
                    }}
                    title="Apply to node fill"
                    className={`w-6 h-6 rounded-md border transition-all cursor-pointer hover:scale-110 active:scale-95 ${(useNodeGradient ? nodeGradientColor1 === c : nodeColor === c)
                      ? 'border-blue-500 ring-2 ring-blue-500/20'
                      : 'border-slate-300 dark:border-slate-800'
                      } shadow-sm`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* AI Settings Sidebar Trigger */}
          <div className="flex flex-col gap-3 p-3 bg-white dark:bg-[#0F172A] rounded-lg border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-500/10 text-blue-500 rounded-md shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-200">AI Platform Settings</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">Configure providers and parameters</div>
                </div>
              </div>
              <button
                onClick={() => {
                  useStore.getState().setIsAdvancedPanelOpen(false);
                  useStore.getState().setIsAISettingsPanelOpen(true);
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
              >
                Configure
              </button>
            </div>
          </div>

          {/* Voice Commands Settings */}
          <div className="flex flex-col gap-3 p-3 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-300 dark:border-slate-700/50 text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-md shrink-0">
                  <Mic size={18} />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-200">Voice Commands</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">Mic and voice control</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsVoiceHelpOpen(true)}
                  title="View available voice commands"
                  className="p-1.5 text-indigo-500 hover:bg-indigo-500/10 rounded-md transition-all active:scale-90"
                >
                  <HelpCircle size={16} />
                </button>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={isVoiceEnabled}
                    onChange={(e) => setIsVoiceEnabled(e.target.checked)}
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-500"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Drawing Toolbar Settings */}
          <div className="flex flex-col gap-3 p-3 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-300 dark:border-slate-700/50 text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-purple-500/10 text-purple-500 rounded-md shrink-0">
                  <PenTool size={18} />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-200">Drawing Toolbar</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">Annotations and overlay tools</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMathHelpOpen(true)}
                  title="How to use Math Canvas"
                  className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-md transition-all active:scale-90"
                >
                  <HelpCircle size={16} />
                </button>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={isToolbarVisible}
                    onChange={(e) => setIsToolbarVisible(e.target.checked)}
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-blue-500"></div>
                </label>
              </div>
            </div>

            {isToolbarVisible && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/50 flex flex-col gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase">Opacity</span>
                    <span className="text-xs text-slate-600 dark:text-slate-300">{Math.round(toolbarOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={toolbarOpacity}
                    onChange={(e) => setToolbarOpacity(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase">Scale</span>
                    <span className="text-xs text-slate-600 dark:text-slate-300">{toolbarScale.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={toolbarScale}
                    onChange={(e) => setToolbarScale(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase block mb-2">Orientation</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setToolbarOrientation('horizontal')}
                      className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md border ${toolbarOrientation === 'horizontal'
                        ? 'bg-blue-500/10 border-blue-500/50 text-blue-600 dark:text-blue-400'
                        : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400'
                        }`}
                    >
                      Horizontal
                    </button>
                    <button
                      onClick={() => setToolbarOrientation('vertical')}
                      className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md border ${toolbarOrientation === 'vertical'
                        ? 'bg-blue-500/10 border-blue-500/50 text-blue-600 dark:text-blue-400'
                        : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400'
                        }`}
                    >
                      Vertical
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-300 dark:border-slate-700/50 text-slate-900 dark:text-slate-100">
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

          <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-300 dark:border-slate-700/50 text-slate-900 dark:text-slate-100">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-yellow-500/10 text-yellow-500 rounded-md shrink-0">
                <PenTool size={18} />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200">Sticky Notes</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">Floating workspace notes (local only)</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={stickyNotesEnabled}
                onChange={(e) => setStickyNotesEnabled(e.target.checked)}
              />
              <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-200 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-500"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-300 dark:border-slate-700/50 text-slate-900 dark:text-slate-100">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-500/10 text-red-500 rounded-md shrink-0">
                <Youtube size={18} />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200">YouTube Search</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">Global search and embed YouTube videos</div>
              </div>
            </div>
            <button
              onClick={() => setIsYoutubeSearchOpen(true)}
              className="px-3 py-1.5 ml-3 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
            >
              Open
            </button>
          </div>

          <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-300 dark:border-slate-700/50 text-slate-900 dark:text-slate-100">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-md shrink-0">
                <AlignLeft size={18} />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200">Expand All Text</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">Force all multiline text nodes to show full content</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={globalTextExpanded}
                onChange={(e) => setGlobalTextExpanded(e.target.checked)}
              />
              <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-200 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
            </label>
          </div>

          {/* Node Spread Slider */}
          <div className="flex flex-col p-3 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-300 dark:border-slate-700/50 gap-2 text-slate-900 dark:text-slate-100">
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
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>0.5x</span>
                <span>5.0x</span>
              </div>
            </div>
          </div>

          {/* Node Size Slider */}
          <div className="flex flex-col p-3 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-300 dark:border-slate-700/50 gap-2 text-slate-900 dark:text-slate-100">
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
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>0.5x</span>
                <span>2.0x</span>
              </div>
            </div>
          </div>

          {/* Canvas Design Section */}
          <div className="flex flex-col gap-3 p-3 bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-300 dark:border-slate-700/50 text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-pink-500/10 text-pink-500 rounded-xl border border-pink-500/10">
                  <Palette size={18} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold tracking-tight">Canvas Design</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 -mt-0.5">Colors and pattern styles</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setCanvasTheme(defaultSettings.canvasTheme);
                  setCanvasBackgroundColor(defaultSettings.canvasBackgroundColor);
                  setCanvasPatternColor(defaultSettings.canvasPatternColor);
                }}
                title="Reset All"
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <RotateCcw size={14} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5 p-2 bg-slate-100/30 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700/50">
                <span className="text-[9px] font-bold text-slate-500 uppercase px-1">Backdrop</span>
                <button
                  ref={bgButtonRef}
                  onClick={() => togglePicker('bg')}
                  className="w-full h-8 rounded-lg border border-white dark:border-slate-800 shadow-sm transition-transform active:scale-95 cursor-pointer ring-1 ring-slate-200 dark:ring-slate-700"
                  style={{ backgroundColor: canvasBackgroundColor }}
                />
                {showBgPicker && createPortal(
                  <div style={bgPickerStyle} ref={bgPickerRef} className="bg-[#121A2F] p-4 rounded-2xl border border-slate-800 shadow-2xl z-[10000]">
                    <RgbaColorPicker
                      color={parseRgba(canvasBackgroundColor)}
                      onChange={(color) => handleColorChange(color, setCanvasBackgroundColor)}
                    />
                  </div>,
                  document.body
                )}
              </div>

              <div className="flex flex-col gap-1.5 p-2 bg-slate-100/30 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700/50">
                <span className="text-[9px] font-bold text-slate-500 uppercase px-1">Overlay</span>
                <button
                  ref={patternButtonRef}
                  onClick={() => togglePicker('pattern')}
                  className="w-full h-8 rounded-lg border border-white dark:border-slate-800 shadow-sm transition-transform active:scale-95 cursor-pointer ring-1 ring-slate-200 dark:ring-slate-700 disabled:opacity-30"
                  disabled={canvasTheme === 'none'}
                  style={{ backgroundColor: canvasPatternColor }}
                />
                {showPatternPicker && createPortal(
                  <div style={patternPickerStyle} ref={patternPickerRef} className="bg-[#121A2F] p-4 rounded-2xl border border-slate-800 shadow-2xl z-[10000]">
                    <RgbaColorPicker
                      color={parseRgba(canvasPatternColor)}
                      onChange={(color) => handleColorChange(color, setCanvasPatternColor)}
                    />
                  </div>,
                  document.body
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1 custom-scrollbar px-1">
              {(['none', 'dots', 'grid', 'lines'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setCanvasTheme(t)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all border shrink-0 ${canvasTheme === t
                    ? 'bg-pink-500/10 border-pink-500/40 text-pink-600 dark:text-pink-400 ring-1 ring-pink-500/10'
                    : 'bg-slate-100/50 dark:bg-slate-900/50 border-transparent text-slate-500 hover:bg-slate-200'
                    }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>






          <div className="mt-2 pt-4 border-t border-slate-200 dark:border-slate-800/50 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-xl border border-blue-500/10">
                  <ImageIcon size={18} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-200">Backdrop Image</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 -mt-0.5">Use a custom image URL</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setCanvasBackgroundImage(defaultSettings.canvasBackgroundImage);
                  setCanvasBackgroundBlur(defaultSettings.canvasBackgroundBlur);
                }}
                title="Reset Image"
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <RotateCcw size={14} />
              </button>
            </div>

            <div className="space-y-3 px-1">
              <input
                type="text"
                value={canvasBackgroundImage}
                onChange={(e) => setCanvasBackgroundImage(e.target.value)}
                placeholder="https://example.com/image.png"
                className="w-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:focus:ring-purple-500/40 transition-all font-mono"
              />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter px-1">Blur Intensity</span>
                  <span className="text-[10px] font-mono text-slate-400">{canvasBackgroundBlur}px</span>
                </div>
                <input
                  type="range"
                  min="0" max="20" step="1"
                  value={canvasBackgroundBlur}
                  onChange={(e) => setCanvasBackgroundBlur(parseFloat(e.target.value))}
                  className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-full appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Global Reset, Proxy Settings, and Shortcuts */}
        <div className="flex flex-col gap-2 p-4 border-t border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-[#0b1120] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
          <div className="flex gap-2">
            <button
              onClick={() => {
                import('../audio/stores/audioStore').then(m => m.useAudioStore.getState().togglePlayer());
                setIsAdvancedPanelOpen(false);
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 rounded-xl transition-colors text-xs font-medium border border-indigo-500/10"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
              Audio Player
            </button>
            <button
              onClick={() => setIsProxyModalOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 rounded-xl transition-colors text-xs font-medium border border-purple-500/10"
            >
              <Shield size={14} />
              Proxy Settings
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsShortcutsOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 rounded-xl transition-colors text-sm font-medium border border-blue-500/10"
            >
              <Keyboard size={16} />
              Shortcuts
            </button>
            <button
              onClick={() => {
                resetAllSettings();
                resetPreferences();
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl transition-colors text-sm font-medium border border-slate-700/50"
            >
              <RotateCcw size={16} />
              Reset All
            </button>
          </div>
        </div>
      </div>
      <VoiceHelpModal isOpen={isVoiceHelpOpen} onClose={() => setIsVoiceHelpOpen(false)} />
      <ProxySettingsModal />
    </>
  );
}
