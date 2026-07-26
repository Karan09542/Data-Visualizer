import React, { useEffect, useState, useRef, useCallback } from "react";
import { resolveAssetUrl } from "../utils/assetManager";
import { HexColorPicker } from "react-colorful";
import { 
  RotateCw, 
  Box, 
  Grid3X3, 
  Camera, 
  Sun, 
  Palette, 
  Maximize, 
  RefreshCcw, 
  Info, 
  ChevronRight,
  Download,
  Settings2,
  X,
  Link
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SafeModelViewerProps {
  src: string;
  alt?: string;
  autoRotate?: boolean;
  cameraControls?: boolean;
  style?: React.CSSProperties;
  showControls?: boolean;
}

type BgPreset = "dark" | "light" | "transparent" | "gradient" | "custom";
type LightPreset = "studio" | "neutral" | "outdoor" | "spruit" | "moon" | "photo_studio" | "kloofendal" | "custom";

export function SafeModelViewer({ 
  src, 
  alt, 
  autoRotate: initialAutoRotate, 
  cameraControls, 
  style,
  showControls = false 
}: SafeModelViewerProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const modelViewerRef = useRef<any>(null);

  // Enhanced state
  const [bgPreset, setBgPreset] = useState<BgPreset>("transparent");
  const [bgColor, setBgColor] = useState("#1e293b");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isCustomLightOpen, setIsCustomLightOpen] = useState(false);
  const [lightPreset, setLightPreset] = useState<LightPreset>("studio");
  const [customLightUrl, setCustomLightUrl] = useState("");
  const [isRotating, setIsRotating] = useState(initialAutoRotate ?? true);
  const [rotateSpeed, setRotateSpeed] = useState(1.0);
  const [showGrid, setShowGrid] = useState(false);
  const [isWireframe, setIsWireframe] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<any>(null);

  // Persistence
  useEffect(() => {
    if (!showControls) return;
    const saved = localStorage.getItem("safe-model-viewer-settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setBgPreset(parsed.bgPreset || "transparent");
        setBgColor(parsed.bgColor || "#1e293b");
        setLightPreset(parsed.lightPreset || "studio");
        setCustomLightUrl(parsed.customLightUrl || "");
        setShowGrid(parsed.showGrid ?? false);
        setIsWireframe(parsed.isWireframe ?? false);
      } catch (e) {
        console.error("Failed to load settings", e);
      }
    }
  }, [showControls]);

  useEffect(() => {
    if (!showControls) return;
    localStorage.setItem("safe-model-viewer-settings", JSON.stringify({
      bgPreset,
      bgColor,
      lightPreset,
      customLightUrl,
      showGrid,
      isWireframe
    }));
  }, [bgPreset, bgColor, lightPreset, customLightUrl, showGrid, isWireframe, showControls]);

  useEffect(() => {
    let active = true;
    const isAsset = src && (src.startsWith('img_') || src.startsWith('thumb_'));
    if (isAsset) {
      resolveAssetUrl(src).then(url => {
        if (active) setResolvedUrl(url);
      }).catch(err => {
        if (active) setError("Could not read asset from IndexedDB");
      });
    } else {
      setResolvedUrl(src);
    }
    
    return () => { active = false; };
  }, [src]);

  useEffect(() => {
    let active = true;
    import("@google/model-viewer")
      .then(() => {
        if (active) setLoaded(true);
      })
      .catch((err) => {
        console.error("Failed to load @google/model-viewer", err);
        if (active) setError(err.message || "Failed to load 3D viewer package");
      });
    return () => {
      active = false;
    };
  }, []);

  const handleResetCamera = useCallback(() => {
    if (modelViewerRef.current) {
      modelViewerRef.current.cameraOrbit = "0deg 75deg 105%";
      modelViewerRef.current.cameraTarget = "auto auto auto";
      modelViewerRef.current.fieldOfView = "auto";
    }
  }, []);

  const handleScreenshot = useCallback(async () => {
    if (modelViewerRef.current) {
      const blob = await modelViewerRef.current.toBlob({ idealAspect: true });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `model-screenshot-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    if (!showControls) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input (though we don't have many here)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key.toLowerCase()) {
        case 'r': handleResetCamera(); break;
        case 'g': setShowGrid(prev => !prev); break;
        case 'w': setIsWireframe(prev => !prev); break;
        case ' ': 
          e.preventDefault();
          setIsRotating(prev => !prev); 
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showControls, handleResetCamera]);

  // Wireframe logic (experimental for model-viewer)
  useEffect(() => {
    if (!modelViewerRef.current || !loaded) return;
    const mv = modelViewerRef.current;
    
    const applyWireframe = (obj: any, wireframe: boolean, visited = new Set()) => {
      if (!obj || visited.has(obj)) return;
      visited.add(obj);

      // If it's a mesh, toggle wireframe on its materials
      if (obj.isMesh && obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m: any) => {
          if ('wireframe' in m) {
            m.wireframe = wireframe;
            m.needsUpdate = true;
          }
        });
      }

      // If it is a Material with a reference to three.js material
      if (obj.wireframe !== undefined && typeof obj === 'object') {
        obj.wireframe = wireframe;
        if ('needsUpdate' in obj) {
          obj.needsUpdate = true;
        }
      }

      // Traverse children
      if (obj.children && Array.isArray(obj.children)) {
        obj.children.forEach((child: any) => applyWireframe(child, wireframe, visited));
      }

      // Traverse properties if it's not a DOM element
      if (!(obj instanceof HTMLElement)) {
        for (const key in obj) {
          try {
            const val = obj[key];
            if (val && typeof val === 'object') {
              if (val.isMesh || val.isGroup || val.isScene || val.traverse || key === 'scene' || key === 'model' || key === 'materials') {
                applyWireframe(val, wireframe, visited);
              }
            }
          } catch (e) {}
        }
        
        // Also check symbols
        const symbols = Object.getOwnPropertySymbols(obj);
        for (const sym of symbols) {
          try {
            const val = obj[sym];
            if (val && typeof val === 'object') {
              applyWireframe(val, wireframe, visited);
            }
          } catch (e) {}
        }
      }
    };

    try {
      const visited = new Set();
      // Look for Three.js objects or properties on the model-viewer element
      const keysAndSymbols: any[] = [...Object.getOwnPropertyNames(mv), ...Object.getOwnPropertySymbols(mv)];
      for (const key of keysAndSymbols) {
        try {
          const val = (mv as any)[key];
          if (val && typeof val === 'object') {
            applyWireframe(val, isWireframe, visited);
          }
        } catch (e) {}
      }
      
      // Request update from model-viewer
      if (typeof mv.requestUpdate === 'function') {
        mv.requestUpdate();
      }
    } catch (e) {
      console.warn("Wireframe toggle failed", e);
    }
  }, [isWireframe, loaded]);

  const onModelLoad = () => {
    if (modelViewerRef.current) {
      const modelViewer = modelViewerRef.current;
      // Get stats
      const materialCount = modelViewer.model?.materials.length || 0;
      // Statistics API
      // model-viewer stats are usually available after load
      // There isn't a direct "getStatistics" that returns everything in one go easily
      // but we can estimate
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-4 w-full h-full bg-slate-800 text-slate-400 rounded-lg border border-slate-700 text-center text-xs">
        <p className="font-semibold text-slate-300">Could not load 3D</p>
        <p className="text-[10px] text-slate-500 mt-1">{error}</p>
      </div>
    );
  }

  if (!loaded || !resolvedUrl) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full text-slate-400 text-xs gap-2 py-8 bg-slate-950/20 rounded">
        <div className="w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
        <span>Loading 3D asset...</span>
      </div>
    );
  }

  const ModelViewer = "model-viewer" as any;

  const bgStyles: Record<BgPreset, string> = {
    dark: "bg-[#0a0a0a]",
    light: "bg-[#f5f5f5]",
    transparent: "bg-transparent",
    gradient: "bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950",
    custom: ""
  };

  const environmentImages: Record<LightPreset, string> = {
    studio: "neutral",
    neutral: "",
    outdoor: "legacy",
    spruit: "https://modelviewer.dev/shared-assets/environments/spruit_sunrise_1k_HDR.hdr",
    moon: "https://modelviewer.dev/shared-assets/environments/moon_1k.hdr",
    photo_studio: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/photo_studio_01_1k.hdr",
    kloofendal: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kloofendal_43d_clear_1k.hdr",
    custom: customLightUrl
  };

  if (showControls) {
    return (
      <div 
        className={`relative w-full h-full overflow-hidden ${bgPreset === 'custom' ? '' : bgStyles[bgPreset]} transition-colors duration-500 group/viewer`}
        style={{ ...style, backgroundColor: bgPreset === 'custom' ? bgColor : undefined }}
      >
        {/* Grid Overlay */}
        {showGrid && (
          <div className="absolute inset-0 pointer-events-none opacity-20" 
               style={{ 
                 backgroundImage: `radial-gradient(circle, #4f46e5 1px, transparent 1px), linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)`,
                 backgroundSize: `40px 40px, 40px 40px, 40px 40px`,
                 maskImage: 'radial-gradient(circle at center, black, transparent 80%)'
               }} 
          />
        )}

        <ModelViewer
          ref={modelViewerRef}
          id="safe-model-viewer-element"
          src={resolvedUrl}
          alt={alt}
          auto-rotate={isRotating ? "true" : undefined}
          camera-controls={cameraControls ? "true" : undefined}
          environment-image={environmentImages[lightPreset] || undefined}
          shadow-intensity="1"
          exposure="1.2"
          onLoad={onModelLoad}
          style={{ width: "100%", height: "100%", background: "transparent" }}
        >
          <div slot="poster"></div>
        </ModelViewer>

        {/* Controls Overlay */}
        <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 flex flex-wrap md:flex-nowrap items-center justify-center gap-2 p-2 bg-slate-950/85 md:bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl opacity-100 md:opacity-0 md:group-hover/viewer:opacity-100 transition-all duration-300 w-[92%] sm:w-auto max-w-[480px] md:max-w-none z-50">
          <div className="flex items-center gap-1">
             <button 
              onClick={() => setIsRotating(!isRotating)}
              className={`p-1.5 md:p-2 rounded-xl transition-all ${isRotating ? 'bg-indigo-500 text-white' : 'hover:bg-white/10 text-slate-400'}`}
              title="Auto Rotate (Space)"
            >
              <RotateCw size={16} className={isRotating ? 'animate-spin-slow' : ''} />
            </button>
            {isRotating && (
              <input 
                type="range" 
                min="0.1" 
                max="5" 
                step="0.1" 
                value={rotateSpeed} 
                onChange={(e) => setRotateSpeed(parseFloat(e.target.value))}
                className="w-16 sm:w-20 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            )}
          </div>

          <div className="hidden md:block w-[1px] h-4 bg-white/10 mx-1" />

          <div className="flex items-center gap-1">
            <button 
              onClick={() => setShowGrid(!showGrid)}
              className={`p-1.5 md:p-2 rounded-xl transition-all ${showGrid ? 'bg-indigo-500 text-white' : 'hover:bg-white/10 text-slate-400'}`}
              title="Toggle Grid (G)"
            >
              <Grid3X3 size={16} />
            </button>
            <button 
              onClick={() => setIsWireframe(!isWireframe)}
              className={`p-1.5 md:p-2 rounded-xl transition-all ${isWireframe ? 'bg-indigo-500 text-white' : 'hover:bg-white/10 text-slate-400'}`}
              title="Toggle Wireframe (W)"
            >
              <Box size={16} />
            </button>
          </div>

          <div className="hidden md:block w-[1px] h-4 bg-white/10 mx-1" />

          <div className="flex items-center gap-1.5">
            <select 
              value={bgPreset} 
              onChange={(e) => setBgPreset(e.target.value as BgPreset)}
              className="w-[95px] sm:w-[110px] bg-transparent text-slate-300 text-xs border border-white/10 rounded-lg px-2 py-1.5 hover:bg-white/5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 appearance-none cursor-pointer text-center"
            >
              <option value="transparent" className="bg-slate-800 text-slate-300">Transparent</option>
              <option value="dark" className="bg-slate-800 text-slate-300">Dark</option>
              <option value="light" className="bg-slate-800 text-slate-300">Light</option>
              <option value="gradient" className="bg-slate-800 text-slate-300">Gradient</option>
              <option value="custom" className="bg-slate-800 text-slate-300">Custom</option>
            </select>

            {bgPreset === 'custom' && (
              <div className="relative">
                <button 
                  onClick={() => setIsPickerOpen(!isPickerOpen)}
                  className="w-5 h-5 rounded-md border border-white/20 shadow-inner"
                  style={{ backgroundColor: bgColor }}
                />
                <AnimatePresence>
                  {isPickerOpen && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 10 }}
                      className="absolute bottom-full mb-4 left-0 z-[10000]"
                    >
                      <div className="p-3 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-bold text-white uppercase">BG Color</span>
                          <button onClick={() => setIsPickerOpen(false)} className="text-slate-500 hover:text-white">
                            <X size={14} />
                          </button>
                        </div>
                        <HexColorPicker color={bgColor} onChange={setBgColor} />
                        <div className="mt-2 text-center text-[10px] font-mono text-slate-400">
                          {bgColor.toUpperCase()}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div className="w-[1px] h-4 bg-white/10" />
            
            <div className="flex items-center gap-1.5">
              <select 
                value={lightPreset} 
                onChange={(e) => setLightPreset(e.target.value as LightPreset)}
                className="w-[90px] sm:w-[110px] bg-transparent text-slate-300 text-xs border border-white/10 rounded-lg px-2 py-1.5 hover:bg-white/5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 appearance-none cursor-pointer text-center"
              >
                <optgroup label="Default (Built-in)" className="bg-slate-900 text-slate-400">
                  <option value="studio" className="bg-slate-800 text-slate-300">Studio</option>
                  <option value="neutral" className="bg-slate-800 text-slate-300">Neutral</option>
                  <option value="outdoor" className="bg-slate-800 text-slate-300">Legacy</option>
                </optgroup>
                <optgroup label="Online Presets" className="bg-slate-900 text-slate-400">
                  <option value="spruit" className="bg-slate-800 text-slate-300">Sunrise (Online)</option>
                  <option value="moon" className="bg-slate-800 text-slate-300">Moon (Online)</option>
                  <option value="photo_studio" className="bg-slate-800 text-slate-300">Photo Studio (Online)</option>
                  <option value="kloofendal" className="bg-slate-800 text-slate-300">Kloofendal (Online)</option>
                </optgroup>
                <option value="custom" className="bg-slate-800 text-slate-300">Custom HDR...</option>
              </select>

              {lightPreset === 'custom' && (
                <div className="relative">
                  <button
                    onClick={() => setIsCustomLightOpen(!isCustomLightOpen)}
                    className={`p-1.5 rounded-md border ${isCustomLightOpen ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'border-white/20 text-slate-400 hover:text-white'}`}
                  >
                    <Link size={14} />
                  </button>
                  <AnimatePresence>
                    {isCustomLightOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        className="absolute bottom-full mb-4 right-0 z-[10000]"
                      >
                        <div className="p-3 bg-slate-900 border border-white/10 rounded-xl shadow-2xl w-64 flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-white uppercase">Custom HDR URL</span>
                            <button onClick={() => setIsCustomLightOpen(false)} className="text-slate-500 hover:text-white">
                              <X size={14} />
                            </button>
                          </div>
                          <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                               <input
                                type="text"
                                value={customLightUrl}
                                onChange={(e) => setCustomLightUrl(e.target.value)}
                                placeholder="Paste .hdr or .exr URL..."
                                className="flex-1 min-w-0 bg-black/50 text-slate-300 text-xs border border-white/10 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                              />
                              {customLightUrl && (
                                <button
                                  onClick={() => setCustomLightUrl('')}
                                  className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors flex-shrink-0"
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 leading-tight">
                              Get free HDR environments from <a href="https://polyhaven.com/hdris" target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">polyhaven.com</a>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>

          <div className="hidden md:block w-[1px] h-4 bg-white/10 mx-1" />

          <div className="flex items-center gap-1">
            <button 
              onClick={handleResetCamera}
              className="p-1.5 md:p-2 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-all"
              title="Reset Camera (R)"
            >
              <RefreshCcw size={16} />
            </button>
            <button 
              onClick={handleScreenshot}
              className="p-1.5 md:p-2 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-all"
              title="Capture Screenshot (PNG)"
            >
              <Camera size={16} />
            </button>
            <button 
              onClick={() => setShowStats(!showStats)}
              className={`p-1.5 md:p-2 rounded-xl transition-all ${showStats ? 'bg-indigo-500 text-white' : 'hover:bg-white/10 text-slate-400'}`}
              title="Model Info"
            >
              <Info size={16} />
            </button>
          </div>
        </div>

        {/* Stats Panel */}
        {showStats && (
          <div className="absolute top-6 right-6 w-64 bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in slide-in-from-right-4 fade-in duration-300">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-widest">
                <Settings2 size={14} className="text-indigo-400" />
                Model Intelligence
              </div>
              <button onClick={() => setShowStats(false)} className="text-slate-500 hover:text-white transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-slate-500">FORMAT</span>
                <span className="text-indigo-400 font-bold">GLB / GLTF</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-slate-500">SHADOWS</span>
                <span className="text-slate-300">SOFT RAYTRACED</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-slate-500">EXPOSURE</span>
                <span className="text-slate-300">1.0 EV</span>
              </div>
              <div className="pt-2 border-t border-white/5">
                <p className="text-[9px] text-slate-500 uppercase tracking-tighter mb-2">Shortcuts</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/5 p-1.5 rounded text-[9px] text-slate-400 flex justify-between">
                    <span>Reset</span> <span className="text-white font-bold">[R]</span>
                  </div>
                  <div className="bg-white/5 p-1.5 rounded text-[9px] text-slate-400 flex justify-between">
                    <span>Grid</span> <span className="text-white font-bold">[G]</span>
                  </div>
                  <div className="bg-white/5 p-1.5 rounded text-[9px] text-slate-400 flex justify-between">
                    <span>Wire</span> <span className="text-white font-bold">[W]</span>
                  </div>
                  <div className="bg-white/5 p-1.5 rounded text-[9px] text-slate-400 flex justify-between">
                    <span>Spin</span> <span className="text-white font-bold">[SP]</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-3 bg-indigo-500/10 text-[9px] text-indigo-300 text-center font-bold tracking-widest uppercase">
              Hardware Accelerated View
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <ModelViewer
      ref={modelViewerRef}
      id="safe-model-viewer-element"
      src={resolvedUrl}
      alt={alt}
      auto-rotate={isRotating ? "true" : undefined}
      camera-controls={cameraControls ? "true" : undefined}
      shadow-intensity="1"
      exposure="1.2"
      style={{ width: "100%", height: "100%", background: "transparent", ...style }}
    >
      <div slot="poster"></div>
    </ModelViewer>
  );
}
