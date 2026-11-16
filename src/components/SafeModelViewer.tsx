import React, { useCallback, useEffect, useRef, useState } from "react";
import { resolveAssetUrl } from "../utils/assetManager";
import { HexColorPicker } from "react-colorful";
import {
  RotateCw,
  Box,
  Grid3X3,
  Camera,
  RefreshCcw,
  Info,
  SlidersHorizontal,
  X,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  AlertTriangle,
  Check,
} from "lucide-react";
import CustomSelect from "./CustomSelect";

interface SafeModelViewerProps {
  src: string;
  alt?: string;
  autoRotate?: boolean;
  cameraControls?: boolean;
  style?: React.CSSProperties;
  /** The full viewer: toolbar, settings, model info and keyboard shortcuts. */
  showControls?: boolean;
}

type BgPreset = "transparent" | "dark" | "light" | "gradient" | "custom";
type LightPreset = "studio" | "neutral" | "outdoor" | "spruit" | "moon" | "photo_studio" | "kloofendal" | "custom";

interface ViewerSettings {
  bgPreset: BgPreset;
  bgColor: string;
  lightPreset: LightPreset;
  customLightUrl: string;
  showGrid: boolean;
  isWireframe: boolean;
  exposure: number;
  shadow: number;
  /** Auto-rotate speed, degrees per second. */
  spinSpeed: number;
}

interface ModelStats {
  triangles: number;
  vertices: number;
  meshes: number;
  materials: number;
  textures: number;
  animations: string[];
  size: { x: number; y: number; z: number } | null;
}

const SETTINGS_KEY = "safe-model-viewer-settings";
const DEFAULTS: ViewerSettings = {
  bgPreset: "transparent",
  bgColor: "#1e293b",
  lightPreset: "studio",
  customLightUrl: "",
  showGrid: false,
  isWireframe: false,
  exposure: 1,
  shadow: 1,
  spinSpeed: 30,
};

const loadSettings = (): ViewerSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
};

const ENVIRONMENTS: Record<Exclude<LightPreset, "custom">, string> = {
  studio: "neutral",
  neutral: "",
  outdoor: "legacy",
  spruit: "https://modelviewer.dev/shared-assets/environments/spruit_sunrise_1k_HDR.hdr",
  moon: "https://modelviewer.dev/shared-assets/environments/moon_1k.hdr",
  photo_studio: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/photo_studio_01_1k.hdr",
  kloofendal: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kloofendal_43d_clear_1k.hdr",
};

const LIGHT_OPTIONS: { value: LightPreset; label: string; description?: string }[] = [
  { value: "studio", label: "Studio", description: "Soft, even light (built in)" },
  { value: "neutral", label: "Neutral", description: "Plain light (built in)" },
  { value: "outdoor", label: "Classic", description: "Older model-viewer look (built in)" },
  { value: "spruit", label: "Sunrise", description: "Downloads a 1K HDR" },
  { value: "moon", label: "Moonlight", description: "Downloads a 1K HDR" },
  { value: "photo_studio", label: "Photo studio", description: "Downloads a 1K HDR" },
  { value: "kloofendal", label: "Clear sky", description: "Downloads a 1K HDR" },
  { value: "custom", label: "Custom HDR…", description: "Your own .hdr link" },
];

const BACKGROUNDS: { id: BgPreset; label: string; swatch: string }[] = [
  { id: "transparent", label: "None", swatch: "repeating-conic-gradient(#475569 0 25%, #1e293b 0 50%) 50% / 8px 8px" },
  { id: "dark", label: "Dark", swatch: "#0a0a0a" },
  { id: "light", label: "Light", swatch: "#f5f5f5" },
  { id: "gradient", label: "Gradient", swatch: "linear-gradient(135deg, #0f172a, #1e293b, #1e1b4b)" },
];

const BG_CLASS: Record<BgPreset, string> = {
  transparent: "bg-transparent",
  dark: "bg-[#0a0a0a]",
  light: "bg-[#f5f5f5]",
  gradient: "bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950",
  custom: "",
};

const ModelViewerTag = "model-viewer" as any;

/** model-viewer keeps its three.js scene under a private symbol; reach it without copying the lib. */
function sceneOf(mv: any): any | null {
  if (!mv) return null;
  const sym = Object.getOwnPropertySymbols(mv).find((s) => s.description === "scene");
  return sym ? mv[sym] : null;
}

function eachMesh(root: any, fn: (mesh: any) => void) {
  root?.traverse?.((o: any) => {
    if (o.isMesh && o.material && !o.material.isShadowMaterial) fn(o);
  });
}

function readStats(mv: any): ModelStats {
  const scene = sceneOf(mv);
  const root = scene?._model ?? null;
  let triangles = 0;
  let vertices = 0;
  let meshes = 0;
  const materials = new Set<any>();
  const textures = new Set<any>();
  eachMesh(root, (m) => {
    meshes++;
    const g = m.geometry;
    const pos = g?.attributes?.position;
    if (pos) {
      vertices += pos.count;
      triangles += Math.floor((g.index ? g.index.count : pos.count) / 3);
    }
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      materials.add(mat);
      for (const v of Object.values(mat)) if ((v as any)?.isTexture) textures.add(v);
    }
  });
  let size: ModelStats["size"] = null;
  try {
    const d = mv.getDimensions?.();
    if (d) size = { x: d.x, y: d.y, z: d.z };
  } catch {
    /* not loaded */
  }
  return {
    triangles,
    vertices,
    meshes,
    materials: materials.size || mv.model?.materials?.length || 0,
    textures: textures.size,
    animations: [...(mv.availableAnimations ?? [])],
    size,
  };
}

function setWireframe(mv: any, on: boolean) {
  const scene = sceneOf(mv);
  if (!scene?._model) return;
  eachMesh(scene._model, (m) => {
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      if ("wireframe" in mat && mat.wireframe !== on) {
        mat.wireframe = on;
        mat.needsUpdate = true;
      }
    }
  });
  scene.queueRender?.();
}

const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : n.toLocaleString());
const metres = (v: number) => (v >= 1 ? `${v.toFixed(2)} m` : `${(v * 100).toFixed(1)} cm`);

/**
 * Loads @google/model-viewer once, for every viewer on the page. Its meshopt decoder has no
 * default location, so meshopt-compressed GLBs (gltfpack and many exporters) would fail to
 * open: point it at our own copy (public/decoders, from meshoptimizer, MIT), which also works
 * offline.
 */
let viewerModule: Promise<unknown> | null = null;
const loadViewer = () =>
  (viewerModule ??= import("@google/model-viewer").then((m) => {
    const ModelViewer = customElements.get("model-viewer") as any;
    if (ModelViewer && !ModelViewer.meshoptDecoderLocation) {
      ModelViewer.meshoptDecoderLocation = `${import.meta.env.BASE_URL}decoders/meshopt_decoder.js`;
    }
    return m;
  }));

/**
 * A 3D model (GLB / glTF). Embedded, it is a light, lazily loaded preview; with `showControls`
 * it is the full viewer: lighting, background, wireframe, animations, real model statistics,
 * screenshot and full screen.
 */
export function SafeModelViewer({
  src,
  alt,
  autoRotate: initialAutoRotate,
  cameraControls,
  style,
  showControls = false,
}: SafeModelViewerProps) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedUrl, setResolvedUrl] = useState("");
  const [progress, setProgress] = useState(0);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [mv, setMv] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [settings, setSettings] = useState<ViewerSettings>(() => (showControls ? loadSettings() : DEFAULTS));
  const [isRotating, setIsRotating] = useState(initialAutoRotate ?? true);
  const [panel, setPanel] = useState<"settings" | "info" | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [stats, setStats] = useState<ModelStats | null>(null);
  const [animPlaying, setAnimPlaying] = useState(true);
  const [animName, setAnimName] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [shot, setShot] = useState(false);

  const update = useCallback((patch: Partial<ViewerSettings>) => setSettings((s) => ({ ...s, ...patch })), []);

  // Settings are remembered for the full viewer only.
  useEffect(() => {
    if (!showControls) return;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* storage full or blocked */
    }
  }, [settings, showControls]);

  // The model's address: stored assets are read from IndexedDB.
  useEffect(() => {
    let active = true;
    setError(null);
    setModelLoaded(false);
    setProgress(0);
    setStats(null);
    if (src && (src.startsWith("img_") || src.startsWith("thumb_"))) {
      resolveAssetUrl(src)
        .then((url) => active && setResolvedUrl(url))
        .catch(() => active && setError("The model file could not be read from this browser's storage."));
    } else {
      setResolvedUrl(src);
    }
    return () => {
      active = false;
    };
  }, [src]);

  useEffect(() => {
    let active = true;
    loadViewer()
      .then(() => active && setReady(true))
      .catch((err) => {
        console.error("Failed to load @google/model-viewer", err);
        if (active) setError("The 3D viewer could not be loaded. Check your connection and try again.");
      });
    return () => {
      active = false;
    };
  }, []);

  // The element's own events: progress, loaded, failed.
  useEffect(() => {
    if (!mv) return;
    const onProgress = (e: any) => setProgress(e.detail?.totalProgress ?? 0);
    const onLoad = () => {
      setModelLoaded(true);
      setProgress(1);
      if (showControls) {
        const s = readStats(mv);
        setStats(s);
        if (s.animations.length) {
          setAnimName((n) => (n && s.animations.includes(n) ? n : s.animations[0]));
          setAnimPlaying(true);
        }
      }
    };
    const onError = (e: any) => {
      const type = e.detail?.type;
      if (type === "webglcontextlost") setError("The graphics context was lost. Reload to view the model again.");
      else setError("This model couldn't be opened. It may be damaged or not a GLB / glTF file.");
    };
    mv.addEventListener("progress", onProgress);
    mv.addEventListener("load", onLoad);
    mv.addEventListener("error", onError);
    return () => {
      mv.removeEventListener("progress", onProgress);
      mv.removeEventListener("load", onLoad);
      mv.removeEventListener("error", onError);
    };
  }, [mv, showControls]);

  // Wireframe straight on the three.js materials, again whenever a model loads.
  useEffect(() => {
    if (mv && modelLoaded) setWireframe(mv, showControls && settings.isWireframe);
  }, [mv, modelLoaded, settings.isWireframe, showControls]);

  // Animations
  useEffect(() => {
    if (!mv || !modelLoaded || !stats?.animations.length) return;
    if (animName && mv.animationName !== animName) mv.animationName = animName;
    if (animPlaying) mv.play?.();
    else mv.pause?.();
  }, [mv, modelLoaded, stats, animName, animPlaying]);

  // Full screen
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const canFullscreen = typeof document !== "undefined" && !!document.fullscreenEnabled;
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void containerRef.current?.requestFullscreen?.();
  }, []);

  const resetCamera = useCallback(() => {
    if (!mv) return;
    mv.cameraOrbit = "0deg 75deg 105%";
    mv.cameraTarget = "auto auto auto";
    mv.fieldOfView = "auto";
    mv.resetTurntableRotation?.(0);
    mv.jumpCameraToGoal?.();
  }, [mv]);

  const screenshot = useCallback(async () => {
    if (!mv) return;
    try {
      const blob: Blob = await mv.toBlob({ idealAspect: true, mimeType: "image/png" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(alt || "model").replace(/\.[a-z0-9]+$/i, "").replace(/[^\w.-]+/g, "_") || "model"}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setShot(true);
      setTimeout(() => setShot(false), 1400);
    } catch (err) {
      console.error("Screenshot failed", err);
    }
  }, [mv, alt]);

  // Shortcuts only while the viewer has focus: typing elsewhere is never caught.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!showControls || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target as HTMLElement;
    if (t.closest("input, textarea, select, [contenteditable='true']")) return;
    const k = e.key.toLowerCase();
    if (k === "r") resetCamera();
    else if (k === "g") update({ showGrid: !settings.showGrid });
    else if (k === "w") update({ isWireframe: !settings.isWireframe });
    else if (k === "f" && canFullscreen) toggleFullscreen();
    else if (k === " ") setIsRotating((v) => !v);
    else if (k === "escape" && panel && !document.querySelector('[role="listbox"]')) setPanel(null);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  /* ------------------------------------------------------------- render */

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-4 w-full h-full min-h-[120px] text-center" style={style}>
        <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-500 inline-flex items-center justify-center">
          <AlertTriangle size={18} />
        </div>
        <p className="text-xs font-semibold text-slate-300">Couldn't show this 3D model</p>
        <p className="text-[11px] text-slate-500 max-w-[260px] leading-snug">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setModelLoaded(false);
            setProgress(0);
            setAttempt((n) => n + 1);
          }}
          className="mt-1 h-7 px-3 rounded-lg text-[11px] font-semibold bg-white/[0.07] hover:bg-white/[0.12] text-slate-200"
        >
          Try again
        </button>
      </div>
    );
  }

  const env = settings.lightPreset === "custom" ? settings.customLightUrl.trim() : ENVIRONMENTS[settings.lightPreset];

  const viewer = ready && resolvedUrl && (
    <ModelViewerTag
      key={`${resolvedUrl}#${attempt}`}
      ref={setMv}
      src={resolvedUrl}
      alt={alt || "3D model"}
      // Embedded previews load as they come near the screen; the full viewer straight away.
      loading={showControls ? "eager" : "lazy"}
      auto-rotate={isRotating ? "" : undefined}
      rotation-per-second={`${showControls ? settings.spinSpeed : 30}deg`}
      camera-controls={cameraControls ? "" : undefined}
      interaction-prompt="none"
      environment-image={showControls ? env || undefined : "neutral"}
      shadow-intensity={String(showControls ? settings.shadow : 1)}
      exposure={String(showControls ? settings.exposure : 1)}
      autoplay={stats?.animations.length ? "" : undefined}
      style={{ width: "100%", height: "100%", background: "transparent", outline: "none", ...(showControls ? null : style) }}
    >
      <div slot="poster" />
      <div slot="progress-bar" />
    </ModelViewerTag>
  );

  const loadingOverlay = !modelLoaded && (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 pointer-events-none">
      <div className="w-5 h-5 border-2 border-slate-500/60 border-t-transparent rounded-full animate-spin" />
      <span className="text-[11px] text-slate-400">{!ready || !resolvedUrl ? "Preparing 3D viewer…" : progress > 0 ? `Loading model… ${Math.round(progress * 100)}%` : "Loading model…"}</span>
      {progress > 0 && progress < 1 && (
        <div className="w-28 h-1 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-indigo-400 rounded-full transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
    </div>
  );

  // Embedded: the model and a loading state, nothing else.
  if (!showControls) {
    return (
      <div className="relative w-full h-full" style={style}>
        {viewer}
        {loadingOverlay}
      </div>
    );
  }

  /* ---------------------------------------------------------- full viewer */

  const btn = (on = false) =>
    `h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-xl transition-colors disabled:opacity-35 disabled:pointer-events-none ${
      on ? "bg-indigo-500 text-white" : "text-slate-300 hover:text-white hover:bg-white/10"
    }`;
  const sep = <span className="w-px h-5 bg-white/10 mx-0.5 shrink-0" />;
  const hasAnims = !!stats?.animations.length;

  const slider = (label: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void, shown: string) => (
    <label className="flex items-center gap-3">
      <span className="w-[72px] shrink-0 text-[11px] text-slate-400">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 accent-indigo-500 cursor-pointer"
        aria-label={label}
      />
      <span className="w-10 text-right text-[11px] tabular-nums text-slate-300">{shown}</span>
    </label>
  );

  const toggleRow = (label: string, on: boolean, onChange: () => void, hint?: string) => (
    <button onClick={onChange} className="w-full flex items-center justify-between gap-3 py-1" role="switch" aria-checked={on}>
      <span className="text-[11px] text-slate-300 text-left">
        {label}
        {hint && <span className="ml-1.5 text-slate-500">{hint}</span>}
      </span>
      <span className={`relative h-[18px] w-8 rounded-full transition-colors ${on ? "bg-indigo-500" : "bg-white/15"}`}>
        <span className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all ${on ? "left-[16px]" : "left-0.5"}`} />
      </span>
    </button>
  );

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={`relative w-full h-full overflow-hidden outline-none ${BG_CLASS[settings.bgPreset]} transition-colors duration-300 group/viewer`}
      style={{ ...style, backgroundColor: settings.bgPreset === "custom" ? settings.bgColor : style?.backgroundColor }}
    >
      {settings.showGrid && (
        <div
          className="absolute inset-0 pointer-events-none opacity-25"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(148,163,184,.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,.35) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            maskImage: "radial-gradient(circle at center, black, transparent 75%)",
          }}
        />
      )}

      {viewer}
      {loadingOverlay}

      {/* Screenshot saved */}
      {shot && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 h-8 px-3 rounded-full bg-slate-900/90 border border-white/10 text-xs text-slate-100 inline-flex items-center gap-1.5 shadow-xl">
          <Check size={14} className="text-emerald-400" /> Screenshot saved
        </div>
      )}

      {/* Settings / info panel */}
      {panel && (
        <div
          className="absolute z-50 right-3 bottom-[76px] w-[min(300px,calc(100%-24px))] max-h-[calc(100%-100px)] overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/90 backdrop-blur-xl shadow-2xl text-slate-200"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <p className="text-xs font-semibold">{panel === "settings" ? "View settings" : "Model info"}</p>
            <button onClick={() => setPanel(null)} className="h-7 w-7 -mr-1.5 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10" aria-label="Close">
              <X size={14} />
            </button>
          </div>

          {panel === "settings" ? (
            <div className="px-4 pb-4 space-y-4">
              <div>
                <p className="text-[11px] text-slate-400 mb-2">Background</p>
                <div className="flex items-center gap-2">
                  {BACKGROUNDS.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => {
                        update({ bgPreset: b.id });
                        setPickerOpen(false);
                      }}
                      title={b.label}
                      aria-label={`${b.label} background`}
                      aria-pressed={settings.bgPreset === b.id}
                      className={`h-7 w-7 rounded-full ring-offset-2 ring-offset-slate-950 transition-shadow ${settings.bgPreset === b.id ? "ring-2 ring-indigo-400" : "ring-1 ring-white/15 hover:ring-white/40"}`}
                      style={{ background: b.swatch }}
                    />
                  ))}
                  <button
                    onClick={() => {
                      update({ bgPreset: "custom" });
                      setPickerOpen((v) => settings.bgPreset !== "custom" || !v);
                    }}
                    title="Custom colour"
                    aria-label="Custom background colour"
                    aria-pressed={settings.bgPreset === "custom"}
                    className={`h-7 w-7 rounded-full ring-offset-2 ring-offset-slate-950 ${settings.bgPreset === "custom" ? "ring-2 ring-indigo-400" : "ring-1 ring-white/15 hover:ring-white/40"}`}
                    style={{ background: settings.bgPreset === "custom" ? settings.bgColor : "conic-gradient(#f43f5e, #f59e0b, #22c55e, #3b82f6, #a855f7, #f43f5e)" }}
                  />
                </div>
                {settings.bgPreset === "custom" && pickerOpen && (
                  <div className="mt-3 [&_.react-colorful]:w-full [&_.react-colorful]:h-32">
                    <HexColorPicker color={settings.bgColor} onChange={(c) => update({ bgColor: c })} />
                    <p className="mt-1.5 text-center text-[10px] font-mono text-slate-400">{settings.bgColor.toUpperCase()}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-[11px] text-slate-400 mb-2">Lighting</p>
                <CustomSelect
                  value={settings.lightPreset}
                  options={LIGHT_OPTIONS}
                  onChange={(v) => update({ lightPreset: v as LightPreset })}
                  variant="toolbar"
                  menuTitle="Lighting"
                  className="w-full [&>button]:h-8"
                />
                {settings.lightPreset === "custom" && (
                  <div className="mt-2">
                    <input
                      value={settings.customLightUrl}
                      onChange={(e) => update({ customLightUrl: e.target.value })}
                      placeholder="https://…/environment.hdr"
                      aria-label="Custom HDR link"
                      className="w-full h-8 px-2.5 rounded-lg bg-black/40 border border-white/10 text-xs text-slate-200 outline-none focus:border-indigo-500"
                    />
                    <p className="mt-1.5 text-[10px] text-slate-500">
                      Free HDRs at{" "}
                      <a href="https://polyhaven.com/hdris" target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">
                        polyhaven.com
                      </a>
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2.5">
                {slider("Brightness", settings.exposure, 0.2, 2.5, 0.05, (v) => update({ exposure: v }), settings.exposure.toFixed(2))}
                {slider("Shadow", settings.shadow, 0, 2, 0.05, (v) => update({ shadow: v }), settings.shadow.toFixed(2))}
                {slider("Spin speed", settings.spinSpeed, 5, 180, 5, (v) => update({ spinSpeed: v }), `${settings.spinSpeed}°/s`)}
              </div>

              <div className="pt-1 border-t border-white/[0.06]">
                {toggleRow("Wireframe", settings.isWireframe, () => update({ isWireframe: !settings.isWireframe }), "W")}
                {toggleRow("Grid", settings.showGrid, () => update({ showGrid: !settings.showGrid }), "G")}
              </div>

              {hasAnims && stats!.animations.length > 1 && (
                <div>
                  <p className="text-[11px] text-slate-400 mb-2">Animation</p>
                  <CustomSelect
                    value={animName}
                    options={stats!.animations}
                    onChange={(v) => {
                      setAnimName(v);
                      setAnimPlaying(true);
                    }}
                    variant="toolbar"
                    menuTitle="Animation"
                    className="w-full [&>button]:h-8"
                  />
                </div>
              )}

              <button
                onClick={() => setSettings(DEFAULTS)}
                className="w-full h-8 rounded-lg text-[11px] font-semibold text-slate-300 bg-white/[0.06] hover:bg-white/[0.1]"
              >
                Reset to defaults
              </button>
            </div>
          ) : (
            <div className="px-4 pb-4">
              {stats ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    ["Triangles", fmt(stats.triangles)],
                    ["Vertices", fmt(stats.vertices)],
                    ["Meshes", fmt(stats.meshes)],
                    ["Materials", fmt(stats.materials)],
                    ["Textures", fmt(stats.textures)],
                    ["Animations", stats.animations.length ? String(stats.animations.length) : "None"],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-white/[0.04] px-2.5 py-2">
                      <p className="text-[10px] text-slate-500">{k}</p>
                      <p className="text-sm font-semibold tabular-nums">{v}</p>
                    </div>
                  ))}
                  {stats.size && (
                    <div className="col-span-2 rounded-lg bg-white/[0.04] px-2.5 py-2">
                      <p className="text-[10px] text-slate-500">Size (W × H × D)</p>
                      <p className="text-xs font-semibold tabular-nums">
                        {metres(stats.size.x)} × {metres(stats.size.y)} × {metres(stats.size.z)}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500">Details appear once the model has loaded.</p>
              )}
              <div className="mt-3 pt-3 border-t border-white/[0.06]">
                <p className="text-[10px] text-slate-500 mb-2">Shortcuts (click the model first)</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-slate-400">
                  {[
                    ["Reset view", "R"],
                    ["Spin", "Space"],
                    ["Wireframe", "W"],
                    ["Grid", "G"],
                    ...(canFullscreen ? [["Full screen", "F"]] : []),
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between">
                      <span>{k}</span>
                      <kbd className="px-1.5 rounded bg-white/10 text-[10px] font-semibold text-slate-200">{v}</kbd>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toolbar: shown on hover with a mouse, always on touch, and while a panel is open */}
      <div
        className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-0.5 p-1 rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-xl shadow-2xl max-w-[calc(100%-16px)] overflow-x-auto no-scrollbar transition-opacity duration-200 ${
          panel ? "" : "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/viewer:opacity-100 [@media(hover:hover)]:focus-within:opacity-100"
        }`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button onClick={() => setIsRotating((v) => !v)} className={btn(isRotating)} title="Spin (Space)" aria-label="Spin" aria-pressed={isRotating}>
          <RotateCw size={16} />
        </button>
        {hasAnims && (
          <button
            onClick={() => setAnimPlaying((v) => !v)}
            className={btn()}
            title={animPlaying ? "Pause animation" : "Play animation"}
            aria-label={animPlaying ? "Pause animation" : "Play animation"}
          >
            {animPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
        )}
        <button onClick={resetCamera} disabled={!modelLoaded} className={btn()} title="Reset view (R)" aria-label="Reset view">
          <RefreshCcw size={16} />
        </button>
        {sep}
        <button
          onClick={() => update({ isWireframe: !settings.isWireframe })}
          className={btn(settings.isWireframe)}
          title="Wireframe (W)"
          aria-label="Wireframe"
          aria-pressed={settings.isWireframe}
        >
          <Box size={16} />
        </button>
        <button onClick={() => update({ showGrid: !settings.showGrid })} className={btn(settings.showGrid)} title="Grid (G)" aria-label="Grid" aria-pressed={settings.showGrid}>
          <Grid3X3 size={16} />
        </button>
        {sep}
        <button onClick={screenshot} disabled={!modelLoaded} className={btn()} title="Save screenshot (PNG)" aria-label="Save screenshot">
          <Camera size={16} />
        </button>
        {canFullscreen && (
          <button onClick={toggleFullscreen} className={btn()} title={isFullscreen ? "Exit full screen (F)" : "Full screen (F)"} aria-label={isFullscreen ? "Exit full screen" : "Full screen"}>
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        )}
        {sep}
        <button
          onClick={() => setPanel((p) => (p === "settings" ? null : "settings"))}
          className={btn(panel === "settings")}
          title="View settings"
          aria-label="View settings"
          aria-expanded={panel === "settings"}
        >
          <SlidersHorizontal size={16} />
        </button>
        <button
          onClick={() => setPanel((p) => (p === "info" ? null : "info"))}
          className={btn(panel === "info")}
          title="Model info"
          aria-label="Model info"
          aria-expanded={panel === "info"}
        >
          <Info size={16} />
        </button>
      </div>
    </div>
  );
}
