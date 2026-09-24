import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  X,
  Palette,
  Sparkles,
  Copy,
  Download,
  Check,
  RotateCcw,
  Eye,
  SlidersHorizontal,
  Wand2,
  ZoomIn,
  ZoomOut,
  AlertCircle,
  ShieldCheck,
  Brush,
  Paintbrush,
  Sliders,
  Image as ImageIcon,
  Layers,
  Upload,
  Contrast,
  Sun,
  Flame,
} from "lucide-react";
import { FileDropzoneUpload, SampleImageItem } from "./FileDropzoneUpload";
import CustomSelect from "../CustomSelect";
import { ai } from "../../ai";
import { AIProgressEvent } from "../../ai/types";

// Curated sample content photos for instant 1-click test
const SAMPLE_CONTENT_IMAGES: SampleImageItem[] = [
  {
    label: "Studio Portrait",
    url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80&auto=format&fit=crop",
    badge: "Portrait",
    description: "High detail facial features & soft studio lighting",
  },
  {
    label: "Mountain Vista",
    url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80&auto=format&fit=crop",
    badge: "Nature",
    description: "Alpine peaks with dramatic clouds and shadows",
  },
  {
    label: "Golden Pet",
    url: "https://images.unsplash.com/photo-1552053831-71594a27632d?w=600&q=80&auto=format&fit=crop",
    badge: "Animal",
    description: "Golden fur texture in outdoor sunlight",
  },
];

export interface ArtStylePreset {
  id: string;
  name: string;
  artist: string;
  badge: string;
  description: string;
  styleImageUrl: string;
  /** Palette hints for fast local artistic stylization */
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    contrast: number;
    saturation: number;
    warmth: number;
  };
}

const PRESET_STYLES: ArtStylePreset[] = [
  {
    id: "starry_night",
    name: "The Starry Night",
    artist: "Vincent van Gogh",
    badge: "Post-Impressionism",
    description: "Swirling cobalt blue skies with luminous golden crescent stars",
    styleImageUrl: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=400&q=80&auto=format&fit=crop",
    palette: {
      primary: "#1c2e63",
      secondary: "#e0ad36",
      accent: "#4d78b8",
      contrast: 1.25,
      saturation: 1.35,
      warmth: 15,
    },
  },
  {
    id: "water_lilies",
    name: "Water Lilies",
    artist: "Claude Monet",
    badge: "Impressionism",
    description: "Ethereal pastel brushstrokes dancing on tranquil pond reflections",
    styleImageUrl: "https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?w=400&q=80&auto=format&fit=crop",
    palette: {
      primary: "#4a7062",
      secondary: "#b39ba8",
      accent: "#9ec4a7",
      contrast: 1.05,
      saturation: 1.2,
      warmth: 5,
    },
  },
  {
    id: "the_scream",
    name: "The Scream",
    artist: "Edvard Munch",
    badge: "Expressionism",
    description: "Fiery orange swirling skies with intense emotional contours",
    styleImageUrl: "https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?w=400&q=80&auto=format&fit=crop",
    palette: {
      primary: "#bf451d",
      secondary: "#1f2d3d",
      accent: "#e68437",
      contrast: 1.3,
      saturation: 1.4,
      warmth: 35,
    },
  },
  {
    id: "kandinsky",
    name: "Abstract Energy",
    artist: "Wassily Kandinsky",
    badge: "Abstract Art",
    description: "Geometric vitality, rhythmic splashes, and bold primary chords",
    styleImageUrl: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=400&q=80&auto=format&fit=crop",
    palette: {
      primary: "#c82d33",
      secondary: "#2c5aa0",
      accent: "#f4bc26",
      contrast: 1.35,
      saturation: 1.5,
      warmth: 10,
    },
  },
  {
    id: "cyberpunk_neon",
    name: "Cyberpunk Neon",
    artist: "Digital Synthwave",
    badge: "Futuristic",
    description: "High-contrast electric magenta, cyan reflections, and dark alley glow",
    styleImageUrl: "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=400&q=80&auto=format&fit=crop",
    palette: {
      primary: "#ff007f",
      secondary: "#00f0ff",
      accent: "#7b00ff",
      contrast: 1.4,
      saturation: 1.6,
      warmth: -5,
    },
  },
  {
    id: "charcoal_sketch",
    name: "Pencil & Charcoal",
    artist: "Classical Drawing",
    badge: "Monochrome",
    description: "Expressive cross-hatching, graphite texture, and vintage paper grain",
    styleImageUrl: "https://images.unsplash.com/photo-1582561424760-0321d75e81fa?w=400&q=80&auto=format&fit=crop",
    palette: {
      primary: "#262626",
      secondary: "#e6e1d5",
      accent: "#737373",
      contrast: 1.4,
      saturation: 0.05,
      warmth: 8,
    },
  },
  {
    id: "stained_glass",
    name: "Stained Glass",
    artist: "Cathedral Mosaic",
    badge: "Mosaic",
    description: "Luminous jewel-toned facets bounded by dark leaded contours",
    styleImageUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80&auto=format&fit=crop",
    palette: {
      primary: "#991b1b",
      secondary: "#1e40af",
      accent: "#d97706",
      contrast: 1.35,
      saturation: 1.45,
      warmth: 12,
    },
  },
];

export interface StyleTransferSettings {
  strength: number; // 10 - 100%
  preserveColor: boolean; // Keep photo's natural colors
  brightness: number; // -30 - 30
  contrast: number; // 70 - 140
  saturation: number; // 50 - 160
  sharpness: number; // 0 - 100
}

const DEFAULT_SETTINGS: StyleTransferSettings = {
  strength: 75,
  preserveColor: false,
  brightness: 0,
  contrast: 105,
  saturation: 110,
  sharpness: 30,
};

const EXPORT_FORMAT_OPTIONS = [
  { label: "PNG", value: "png", description: "Lossless quality" },
  { label: "JPG", value: "jpeg", description: "Standard photo" },
  { label: "WEBP", value: "webp", description: "High compression" },
];

type ViewMode = "split" | "side-by-side" | "result";
type ExportFormat = "png" | "jpeg" | "webp";

/** What a run is painted from: an uploaded reference, or one of the presets. */
interface StyleChoice {
  image?: HTMLImageElement | null;
  preset?: ArtStylePreset | null;
}

/**
 * How much of the reference the model is asked for.
 *
 * Not the Style Strength slider: that mixes the finished painting with the photo as you drag it,
 * and a model run takes seconds. So the painting is made once, boldly, and the slider decides how
 * much of it shows - the full range stays reachable without repainting.
 */
const PAINT_STRENGTH = 0.75;

/** The preview is composed at most this wide or tall; saving still uses the photo's own size. */
const PREVIEW_MAX_DIM = 1600;

export function StyleTransferUtil() {
  // Source Content Image
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [sourceFileName, setSourceFileName] = useState("photo");
  const [sourceFileSize, setSourceFileSize] = useState(0);

  // Active Style Selection
  const [selectedStyleId, setSelectedStyleId] = useState<string>("starry_night");
  const [customStyleImage, setCustomStyleImage] = useState<HTMLImageElement | null>(null);
  const [customStyleName, setCustomStyleName] = useState<string>("Custom Style");
  const customFileInputRef = useRef<HTMLInputElement>(null);

  // Style Settings
  const [settings, setSettings] = useState<StyleTransferSettings>(DEFAULT_SETTINGS);

  // AI Pipeline Processing State
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [progressStatus, setProgressStatus] = useState("Ready");
  const [progressPercent, setProgressPercent] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  /** The job now running, so a download the user did not want can be stopped. */
  const activeJobRef = useRef<string | null>(null);

  // The painted layer, in state: a ref would not tell React to re-compose when a paint lands,
  // which is why a finished painting used to sit unseen behind the preview it was meant to replace.
  const [painting, setPainting] = useState<HTMLCanvasElement | null>(null);
  // Only the newest run may publish its painting; changing style mid-paint starts another.
  const runTokenRef = useRef(0);
  const [previewUrl, setPreviewUrl] = useState("");

  // Viewport / Comparison state
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [isHoldingOriginal, setIsHoldingOriginal] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [mobileTab, setMobileTab] = useState<"canvas" | "controls">("canvas");

  // Export State
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");

  // Split Comparison Slider Drag Tracking
  const splitBoxRef = useRef<HTMLDivElement>(null);
  const isDraggingSplitRef = useRef(false);
  const [splitPos, setSplitPos] = useState(50); // percentage 0 - 100

  // ═════════════════════════════════════════════════════════════
  // Spacebar Peek Original
  // ═════════════════════════════════════════════════════════════
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        setIsHoldingOriginal(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setIsHoldingOriginal(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // ═════════════════════════════════════════════════════════════
  // Split Slider Drag Handlers (Pixel-Accurate)
  // ═════════════════════════════════════════════════════════════
  const updateSplitFromClientX = useCallback((clientX: number) => {
    const container = splitBoxRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return;
    const rawPos = ((clientX - rect.left) / rect.width) * 100;
    const pos = Math.max(0, Math.min(100, Math.round(rawPos * 10) / 10));
    setSplitPos(pos);
  }, []);

  const handleSplitPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    isDraggingSplitRef.current = true;
    updateSplitFromClientX(e.clientX);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch { }
  };

  const handleSplitPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSplitRef.current) return;
    e.preventDefault();
    updateSplitFromClientX(e.clientX);
  };

  const handleSplitPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingSplitRef.current) {
      isDraggingSplitRef.current = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch { }
    }
  };

  useEffect(() => {
    const onMove = (e: PointerEvent | MouseEvent) => {
      if (!isDraggingSplitRef.current) return;
      updateSplitFromClientX(e.clientX);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isDraggingSplitRef.current || e.touches.length === 0) return;
      updateSplitFromClientX(e.touches[0].clientX);
    };
    const onEnd = () => {
      isDraggingSplitRef.current = false;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onEnd);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [updateSplitFromClientX]);

  // Current active style reference
  const currentStylePreset = useMemo(() => {
    return PRESET_STYLES.find((s) => s.id === selectedStyleId);
  }, [selectedStyleId]);

  // The reference a new photo is painted from: the uploaded one only while it is the choice, so
  // picking a preset after uploading one actually switches back to the preset.
  const activeStyle = useMemo<StyleChoice>(
    () =>
      selectedStyleId === "custom"
        ? { image: customStyleImage, preset: null }
        : { image: null, preset: currentStylePreset },
    [selectedStyleId, customStyleImage, currentStylePreset]
  );

  // ═════════════════════════════════════════════════════════════
  // Fast Local Artistic Canvas Stylization (Instant Preview / Fallback)
  // ═════════════════════════════════════════════════════════════
  const generateArtisticFallback = useCallback(
    (contentImg: HTMLImageElement, preset?: ArtStylePreset): HTMLCanvasElement => {
      const c = document.createElement("canvas");
      // Work at up to 800px for 60fps instant response, then upscale cleanly
      const maxDim = 800;
      let w = contentImg.naturalWidth;
      let h = contentImg.naturalHeight;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }

      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(contentImg, 0, 0, w, h);

      const srcData = ctx.getImageData(0, 0, w, h);
      const s = srcData.data;
      const outData = ctx.createImageData(w, h);
      const d = outData.data;

      const p = preset?.palette || {
        primary: "#1c2e63",
        secondary: "#e0ad36",
        accent: "#4d78b8",
        contrast: 1.25,
        saturation: 1.35,
        warmth: 15,
      };

      const pr = parseInt(p.primary.slice(1, 3), 16) || 28;
      const pg = parseInt(p.primary.slice(3, 5), 16) || 46;
      const pb = parseInt(p.primary.slice(5, 7), 16) || 99;

      const sr = parseInt(p.secondary.slice(1, 3), 16) || 224;
      const sg = parseInt(p.secondary.slice(3, 5), 16) || 173;
      const sb = parseInt(p.secondary.slice(5, 7), 16) || 54;

      const radius = 3;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;

          // 4 quadrant regions for painterly stroke edge preservation
          const xMin = Math.max(0, x - radius);
          const xMax = Math.min(w - 1, x + radius);
          const yMin = Math.max(0, y - radius);
          const yMax = Math.min(h - 1, y + radius);

          const quads = [
            { x0: xMin, x1: x, y0: yMin, y1: y },
            { x0: x, x1: xMax, y0: yMin, y1: y },
            { x0: xMin, x1: x, y0: y, y1: yMax },
            { x0: x, x1: xMax, y0: y, y1: yMax },
          ];

          let minVar = Infinity;
          let bestR = s[idx];
          let bestG = s[idx + 1];
          let bestB = s[idx + 2];

          for (let q = 0; q < 4; q++) {
            const quad = quads[q];
            let sumR = 0, sumG = 0, sumB = 0;
            let sumSqR = 0, sumSqG = 0, sumSqB = 0;
            let cnt = 0;

            for (let qy = quad.y0; qy <= quad.y1; qy++) {
              for (let qx = quad.x0; qx <= quad.x1; qx++) {
                const qIdx = (qy * w + qx) * 4;
                const r = s[qIdx];
                const g = s[qIdx + 1];
                const b = s[qIdx + 2];
                sumR += r;
                sumG += g;
                sumB += b;
                sumSqR += r * r;
                sumSqG += g * g;
                sumSqB += b * b;
                cnt++;
              }
            }

            if (cnt > 0) {
              const mR = sumR / cnt;
              const mG = sumG / cnt;
              const mB = sumB / cnt;
              const vR = sumSqR / cnt - mR * mR;
              const vG = sumSqG / cnt - mG * mG;
              const vB = sumSqB / cnt - mB * mB;
              const totVar = vR + vG + vB;

              if (totVar < minVar) {
                minVar = totVar;
                bestR = mR;
                bestG = mG;
                bestB = mB;
              }
            }
          }

          // Luminance of painterly pixel
          const lum = (0.299 * bestR + 0.587 * bestG + 0.114 * bestB) / 255;
          const contrastLum = lum < 0.5 ? 2 * lum * lum : 1 - 2 * (1 - lum) * (1 - lum);

          // Color palette mapping: shadows to primary style color, highlights to secondary
          const styleR = (1 - contrastLum) * pr + contrastLum * sr;
          const styleG = (1 - contrastLum) * pg + contrastLum * sg;
          const styleB = (1 - contrastLum) * pb + contrastLum * sb;

          // Brush stroke texture (canvas grain & impasto ridges)
          const brushTexture = (Math.sin(x * 0.35 + y * 0.2) + Math.cos(x * 0.15 - y * 0.3)) * 6;

          // Blend painterly content with style palette
          let finalR = 0.45 * bestR + 0.55 * styleR + brushTexture;
          let finalG = 0.45 * bestG + 0.55 * styleG + brushTexture;
          let finalB = 0.45 * bestB + 0.55 * styleB + brushTexture;

          d[idx] = Math.min(255, Math.max(0, Math.round(finalR)));
          d[idx + 1] = Math.min(255, Math.max(0, Math.round(finalG)));
          d[idx + 2] = Math.min(255, Math.max(0, Math.round(finalB)));
          d[idx + 3] = 255;
        }
      }

      ctx.putImageData(outData, 0, 0);

      if (w !== contentImg.naturalWidth || h !== contentImg.naturalHeight) {
        const fullCanvas = document.createElement("canvas");
        fullCanvas.width = contentImg.naturalWidth;
        fullCanvas.height = contentImg.naturalHeight;
        const fCtx = fullCanvas.getContext("2d")!;
        fCtx.drawImage(c, 0, 0, fullCanvas.width, fullCanvas.height);
        return fullCanvas;
      }

      return c;
    },
    []
  );

  // ═════════════════════════════════════════════════════════════
  // Run Neural Style Transfer Pipeline (Google Magenta Arbitrary)
  // ═════════════════════════════════════════════════════════════
  const runStyleTransferAI = useCallback(
    async (contentImg: HTMLImageElement, style: StyleChoice) => {
      const token = ++runTokenRef.current;
      const isStale = () => runTokenRef.current !== token;

      setIsProcessingAI(true);
      setErrorMsg(null);
      setProgressStatus("Preparing Images...");
      setProgressPercent(10);

      try {
        // Which reference to paint from is decided by the caller, because the state behind it -
        // the preset just clicked, the custom image just uploaded - has not been applied yet.
        let styleEl = style.image || undefined;
        if (!styleEl && style.preset) {
          styleEl = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error("Failed to load reference style image"));
            img.src = style.preset!.styleImageUrl;
          });
        }

        if (!styleEl) {
          throw new Error("No style image available");
        }
        if (isStale()) return;

        const cc = document.createElement("canvas");
        cc.width = contentImg.naturalWidth;
        cc.height = contentImg.naturalHeight;
        cc.getContext("2d")!.drawImage(contentImg, 0, 0);
        const contentData = cc.getContext("2d")!.getImageData(0, 0, cc.width, cc.height);

        const sc = document.createElement("canvas");
        sc.width = styleEl.naturalWidth || styleEl.width || 384;
        sc.height = styleEl.naturalHeight || styleEl.height || 384;
        sc.getContext("2d")!.drawImage(styleEl, 0, 0);
        const styleData = sc.getContext("2d")!.getImageData(0, 0, sc.width, sc.height);

        setProgressStatus("Running Style Encoder...");
        setProgressPercent(25);

        // Execute task 'style-transfer' via Magenta TFLite pipeline
        const { jobId, promise } = ai.execute(
          "style-transfer",
          contentData,
          {
            preferredBackend: "wasm",
            metadata: {
              styleImage: styleData,
              // Always painted boldly. The Style Strength slider mixes this against the photo
              // while you drag it, which a model run - seconds of work - cannot follow.
              styleStrength: PAINT_STRENGTH,
            },
          },
          5
        );

        activeJobRef.current = jobId;

        const unsub = ai.subscribe(jobId, (ev: AIProgressEvent & { jobId: string }) => {
          if (ev.state === "downloading") {
            setProgressStatus(`Downloading Style Model (${ev.progress || 0}%)...`);
            setProgressPercent(Math.round((ev.progress || 0) * 0.35));
          } else if (ev.state === "loading-model") {
            setProgressStatus("Compiling Neural Runtimes...");
            setProgressPercent(40);
          } else if (ev.state === "preparing-image") {
            setProgressStatus("Encoding Style Bottleneck...");
            setProgressPercent(55);
          } else if (ev.state === "inference") {
            setProgressStatus(`Painting Canvas (${ev.progress || 0}%)...`);
            setProgressPercent(55 + Math.round((ev.progress || 0) * 0.4));
          }
        });

        let result: any = null;
        try {
          result = await promise;
        } catch (execErr: any) {
          // Stopping on purpose is not a failure, and must not leave a painting behind.
          if (execErr?.message === "AbortError") return;
          console.warn("[StyleTransfer] Neural inference fallback to algorithmic filter:", execErr);
        } finally {
          unsub();
        }

        let stylizedCanvas: HTMLCanvasElement;
        if (result?.output) {
          const out = result.output;
          stylizedCanvas = document.createElement("canvas");
          stylizedCanvas.width = out.width;
          stylizedCanvas.height = out.height;
          const oCtx = stylizedCanvas.getContext("2d")!;
          if (out instanceof ImageData) {
            oCtx.putImageData(out, 0, 0);
          } else if (out instanceof ImageBitmap) {
            oCtx.drawImage(out, 0, 0);
          }
        } else {
          // Graceful fallback to client-side painterly render
          stylizedCanvas = generateArtisticFallback(contentImg, currentStylePreset);
        }

        if (isStale()) return;
        setPainting(stylizedCanvas);
        setProgressPercent(100);
        setProgressStatus("Finished Painting");
      } catch (err: any) {
        if (err?.message === "AbortError") return;
        console.error("[StyleTransfer] Execution error:", err);
        if (isStale()) return;
        // Fall back to the painterly filter, and say so rather than passing it off as the model.
        try {
          setPainting(generateArtisticFallback(contentImg, style.preset || undefined));
          setErrorMsg("Neural model unavailable - applied the local painterly filter instead.");
        } catch {
          setErrorMsg(err.message || "Could not paint this image.");
        }
      } finally {
        activeJobRef.current = null;
        if (!isStale()) setIsProcessingAI(false);
      }
    },
    [generateArtisticFallback]
  );

  /** Stops the run, and with it the model download it may still be in the middle of. */
  const cancelAiRun = useCallback(() => {
    const jobId = activeJobRef.current;
    runTokenRef.current++;
    activeJobRef.current = null;
    if (jobId) ai.cancel(jobId);
    setIsProcessingAI(false);
    setProgressPercent(0);
    setProgressStatus("Ready");
  }, []);

  // ═════════════════════════════════════════════════════════════
  // Real-Time Final Canvas Assembly & Adjustment Sliders
  // ═════════════════════════════════════════════════════════════
  const compose = useCallback((maxDim?: number): HTMLCanvasElement | null => {
    if (!sourceImage) return null;

    const nativeW = sourceImage.naturalWidth;
    const nativeH = sourceImage.naturalHeight;
    // The preview is composed small so dragging a slider stays smooth; saving and copying ask
    // for the full size, where the same passes run once.
    const fit = maxDim ? Math.min(1, maxDim / Math.max(nativeW, nativeH)) : 1;
    const w = Math.max(1, Math.round(nativeW * fit));
    const h = Math.max(1, Math.round(nativeH * fit));

    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const ctx = out.getContext("2d")!;

    // 1. Prepare the painted layer at this size
    const styledCanvas = document.createElement("canvas");
    styledCanvas.width = w;
    styledCanvas.height = h;
    const sCtx = styledCanvas.getContext("2d")!;
    if (painting) sCtx.drawImage(painting, 0, 0, w, h);

    // 2. Color Preservation:
    // When enabled, preserves 100% of the photo's true natural colors (skin tones, sky, clothing),
    // while adopting the style's rich painterly brush strokes, impasto relief, and contrast!
    if (settings.preserveColor) {
      // Hardware-accelerated W3C "color" composite operation:
      // Preserves the luminance & painterly brush textures of styledCanvas,
      // while adopting the exact hue & saturation of sourceImage.
      sCtx.globalCompositeOperation = "color";
      sCtx.drawImage(sourceImage, 0, 0, w, h);
      sCtx.globalCompositeOperation = "source-over";
    }

    // 3. Draw original photo as base
    ctx.drawImage(sourceImage, 0, 0, w, h);

    // 4. Mix the painting over it. Until one exists the photo stands on its own, adjustments and
    //    all, rather than a stand-in that looks like a result.
    if (painting) {
      ctx.globalAlpha = Math.min(1, Math.max(0.1, settings.strength / 100));
      ctx.drawImage(styledCanvas, 0, 0, w, h);
      ctx.globalAlpha = 1.0;
    }

    // 5. Fine tuning: Brightness, Contrast, Saturation
    const contrastMult = settings.contrast / 100;
    const satMult = settings.saturation / 100;
    const brightOffset = settings.brightness * 2.5;

    if (contrastMult !== 1.0 || satMult !== 1.0 || brightOffset !== 0 || settings.sharpness > 0) {
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;

      for (let i = 0; i < d.length; i += 4) {
        let r = d[i] + brightOffset;
        let g = d[i + 1] + brightOffset;
        let b = d[i + 2] + brightOffset;

        // Contrast
        if (contrastMult !== 1.0) {
          r = (r - 128) * contrastMult + 128;
          g = (g - 128) * contrastMult + 128;
          b = (b - 128) * contrastMult + 128;
        }

        // Saturation
        if (satMult !== 1.0) {
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          r = lum + (r - lum) * satMult;
          g = lum + (g - lum) * satMult;
          b = lum + (b - lum) * satMult;
        }

        d[i] = Math.min(255, Math.max(0, Math.round(r)));
        d[i + 1] = Math.min(255, Math.max(0, Math.round(g)));
        d[i + 2] = Math.min(255, Math.max(0, Math.round(b)));
      }

      // 6. Sharpness: the difference between a pixel and the average around it, added back on
      //    top of it. What stood here before - the picture drawn over itself in overlay mode -
      //    only deepened the contrast and left every edge exactly as soft as it found it.
      if (settings.sharpness > 0) {
        const source = new Uint8ClampedArray(d);
        const amount = (settings.sharpness / 100) * 1.2;
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const i = (y * w + x) * 4;
            for (let c = 0; c < 3; c++) {
              const at = i + c;
              let around = 0;
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  around += source[at + (dy * w + dx) * 4];
                }
              }
              d[at] = Math.min(255, Math.max(0, Math.round(source[at] + amount * (source[at] - around / 9))));
            }
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
    }

    return out;
  }, [sourceImage, painting, settings]);

  // The preview follows the sliders, one frame behind a drag rather than one full-size redraw
  // per tick - which on a photo straight off a phone took long enough to feel like a freeze.
  useEffect(() => {
    if (!sourceImage) {
      setPreviewUrl("");
      return;
    }
    const timer = window.setTimeout(() => {
      const canvas = compose(PREVIEW_MAX_DIM);
      if (canvas) setPreviewUrl(canvas.toDataURL("image/jpeg", 0.9));
    }, 60);
    return () => window.clearTimeout(timer);
  }, [compose, sourceImage]);

  // Handle new source image
  const handleContentImage = useCallback(
    (file: File) => {
      setSourceFileName(file.name.replace(/\.[^/.]+$/, ""));
      setSourceFileSize(file.size);

      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          setSourceImage(img);
          setPainting(null);
          runStyleTransferAI(img, activeStyle);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    },
    [runStyleTransferAI, activeStyle]
  );

  // Handle sample image click
  const launchSampleImage = useCallback(
    (url: string) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        setSourceImage(img);
        setSourceFileName("artistic-sample");
        setSourceFileSize(0);
        setPainting(null);
        runStyleTransferAI(img, activeStyle);
      };
      img.src = url;
    },
    [runStyleTransferAI, activeStyle]
  );

  // Handle custom style upload
  const handleCustomStyleFile = (file: File) => {
    setCustomStyleName(file.name.replace(/\.[^/.]+$/, ""));
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        setCustomStyleImage(img);
        setSelectedStyleId("custom");
        setPainting(null);
        if (sourceImage) runStyleTransferAI(sourceImage, { image: img, preset: null });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Select Preset Style
  const chooseStyle = (style: ArtStylePreset) => {
    setSelectedStyleId(style.id);
    setPainting(null);
    // The preset goes along with the request: reading it back from state here would paint with
    // the one chosen before this click, and a custom image uploaded earlier would win outright.
    if (sourceImage) {
      runStyleTransferAI(sourceImage, { image: null, preset: style });
    }
  };

  // ═════════════════════════════════════════════════════════════
  // Copy to Clipboard (PNG)
  // ═════════════════════════════════════════════════════════════
  const copyToClipboard = async () => {
    const fullSize = compose();
    if (!fullSize) return;
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        fullSize.toBlob(resolve, "image/png")
      );
      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch (err) {
      console.error("Failed to copy image to clipboard", err);
    }
  };

  // ═════════════════════════════════════════════════════════════
  // Download Image
  // ═════════════════════════════════════════════════════════════
  const downloadImage = () => {
    const fullSize = compose();
    if (!fullSize) return;
    const mime =
      exportFormat === "png"
        ? "image/png"
        : exportFormat === "jpeg"
          ? "image/jpeg"
          : "image/webp";
    const ext = exportFormat === "png" ? "png" : exportFormat === "jpeg" ? "jpg" : "webp";

    const styleTag =
      selectedStyleId === "custom" ? "custom-style" : currentStylePreset?.name.toLowerCase().replace(/\s+/g, "-") || "style";

    fullSize.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${sourceFileName}-${styleTag}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
      mime,
      0.95
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-[#0c0f16] text-slate-900 dark:text-slate-100">
      {/* ── Top Header Bar ── */}
      <header className="px-2.5 sm:px-5 py-1.5 sm:py-3 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#161b22]/80 backdrop-blur-md flex flex-nowrap items-center justify-between gap-1.5 sm:gap-2.5 shrink-0 z-10">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
          <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-violet-500/10 text-violet-500 border border-violet-500/20 shrink-0">
            <Palette className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h2 className="text-[13px] sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                Art Style Transfer
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/25 shrink-0 hidden sm:flex items-center gap-1">
                <Sparkles size={9} /> Magenta AI
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate hidden sm:block">
              Transform photos into masterwork paintings, sketches & futuristic art
            </p>
          </div>
        </div>

        {sourceImage && (
          <div className="flex items-center gap-1 sm:gap-2 ml-auto shrink-0">
            {/* View Mode Controls (Desktop) */}
            <div className="hidden sm:flex items-center rounded-xl p-0.5 border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#12161f]">
              <button
                type="button"
                onClick={() => setViewMode("split")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${viewMode === "split"
                  ? "bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                title="Split comparison slider"
              >
                <SlidersHorizontal size={13} />
                <span>Split</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("side-by-side")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${viewMode === "side-by-side"
                  ? "bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                title="Side-by-side dual view"
              >
                <Eye size={13} />
                <span>Dual</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("result")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${viewMode === "result"
                  ? "bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                title="Stylized result only"
              >
                <Check size={13} />
                <span>Result</span>
              </button>
            </div>

            {/* Hold to Peek Button */}
            <button
              type="button"
              onMouseDown={() => setIsHoldingOriginal(true)}
              onMouseUp={() => setIsHoldingOriginal(false)}
              onTouchStart={() => setIsHoldingOriginal(true)}
              onTouchEnd={() => setIsHoldingOriginal(false)}
              className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-medium border transition-colors ${isHoldingOriginal
                ? "bg-violet-500 text-white border-violet-500"
                : "bg-white dark:bg-[#12161f] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
                }`}
              title="Hold to see original photo (or hold Spacebar)"
            >
              <Eye size={13} />
              <span>Original</span>
            </button>

            {/* Copy PNG Button */}
            <button
              type="button"
              onClick={copyToClipboard}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg sm:rounded-xl text-xs font-bold transition-all shadow-xs border ${copyFeedback
                ? "bg-emerald-500 text-white border-emerald-500"
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-violet-500"
                }`}
              title="Copy artwork as PNG to clipboard"
            >
              {copyFeedback ? <Check size={14} /> : <Copy size={14} />}
              <span className="hidden sm:inline">{copyFeedback ? "Copied PNG!" : "Copy PNG"}</span>
            </button>

            {/* Export Format Selector & Download Button */}
            <div className="flex items-center gap-1.5">
              <div className="w-[78px] sm:w-[95px]">
                <CustomSelect
                  value={exportFormat}
                  onChange={(v) => setExportFormat(v as ExportFormat)}
                  options={EXPORT_FORMAT_OPTIONS}
                  variant="toolbar"
                  className="text-xs font-bold"
                />
              </div>
              <button
                type="button"
                onClick={downloadImage}
                className="bg-violet-600 hover:bg-violet-500 active:scale-95 text-white text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all shadow-xs shrink-0"
                title={`Download artwork (${exportFormat.toUpperCase()})`}
              >
                <Download size={14} />
                <span className="hidden sm:inline">Save</span>
              </button>
            </div>

            {/* Reset / New Button */}
            <button
              type="button"
              onClick={() => {
                runTokenRef.current++;
                setSourceImage(null);
                setPainting(null);
                setPreviewUrl("");
                setIsProcessingAI(false);
                setErrorMsg(null);
              }}
              className="p-1 sm:p-1.5 rounded-lg sm:rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              title="Open different photo"
            >
              <RotateCcw size={15} />
            </button>
          </div>
        )}
      </header>

      {/* ── Main Workspace Body ── */}
      {!sourceImage ? (
        /* Empty / Upload State */
        <div className="flex-1 flex flex-col items-center sm:justify-center p-4 sm:p-6 overflow-y-auto custom-scrollbar">
          <FileDropzoneUpload
            onFileSelected={handleContentImage}
            accept="image/*"
            title="Drop Photo to Re-Imagine in Famous Art Styles"
            subtitle="JPG, PNG, WEBP high-res photo • or paste from clipboard"
            pasteNotice="Paste Image to Stylize"
            accentColor="purple"
            enableCamera={true}
            sampleImages={SAMPLE_CONTENT_IMAGES}
            onSampleSelect={launchSampleImage}
            className="w-full max-w-2xl"
          />
        </div>
      ) : (
        /* Active Workspace: Viewport & Style Gallery Panel */
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 relative">
          {/* Mobile Tab Switcher */}
          <div className="md:hidden flex items-center border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12161f] p-1 shrink-0 z-10">
            <button
              type="button"
              onClick={() => setMobileTab("canvas")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold text-center transition-all ${mobileTab === "canvas"
                ? "bg-violet-500/15 text-violet-600 dark:text-violet-400 shadow-xs"
                : "text-slate-500 dark:text-slate-400"
                }`}
            >
              Preview
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("controls")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold text-center transition-all ${mobileTab === "controls"
                ? "bg-violet-500/15 text-violet-600 dark:text-violet-400 shadow-xs"
                : "text-slate-500 dark:text-slate-400"
                }`}
            >
              Styles & Adjustments
            </button>
          </div>

          {/* ── Center Viewport Canvas ── */}
          <div
            className={`flex-1 bg-slate-900/95 dark:bg-[#070a0f] flex items-center justify-center overflow-hidden relative select-none ${mobileTab === "canvas" ? "flex" : "hidden md:flex"
              }`}
          >
            {/* Background grid dots */}
            <div
              className="absolute inset-0 pointer-events-none opacity-20"
              style={{
                backgroundImage: "radial-gradient(#64748b 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            />

            {/* AI Progress Overlay */}
            {isProcessingAI && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
                <div className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-2xl flex flex-col items-center max-w-xs w-full text-center">
                  <div className="w-12 h-12 rounded-2xl bg-violet-500/15 text-violet-500 flex items-center justify-center mb-3 animate-pulse">
                    <Brush size={24} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Applying Art Style
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">{progressStatus}</p>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
                    <div
                      className="bg-violet-500 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={cancelAiRun}
                    className="mt-3.5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-500/15 hover:text-rose-600 dark:hover:text-rose-300 border border-slate-200 dark:border-white/10 transition-colors active:scale-95"
                  >
                    <X size={13} /> Cancel
                  </button>
                  <p className="text-[10px] text-slate-400 mt-2">Stops the download too. What is already saved is kept.</p>
                </div>
              </div>
            )}

            {/* Error Message Toast */}
            {errorMsg && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 shadow-lg max-w-sm">
                <AlertCircle size={15} className="shrink-0" />
                <span className="truncate">{errorMsg}</span>
              </div>
            )}

            {/* Visualizer Display Area */}
            {sourceImage && previewUrl && (
              <div
                className="relative max-w-full max-h-full flex items-center justify-center p-4 transition-transform duration-100"
                style={{ transform: `scale(${zoomLevel})` }}
              >
                {/* ── Mode 1: Split Slider Comparison ── */}
                {viewMode === "split" && !isHoldingOriginal && (
                  <div
                    ref={splitBoxRef}
                    onPointerDown={handleSplitPointerDown}
                    onPointerMove={handleSplitPointerMove}
                    onPointerUp={handleSplitPointerUp}
                    onPointerCancel={handleSplitPointerUp}
                    className="relative overflow-hidden rounded-xl shadow-2xl border border-slate-700/60 max-w-[90vw] max-h-[75vh] cursor-ew-resize select-none touch-none"
                  >
                    {/* Stylized Artwork */}
                    <img
                      src={previewUrl}
                      alt="Stylized Artwork"
                      className="w-auto h-auto max-w-[85vw] max-h-[70vh] object-contain select-none pointer-events-none block"
                      draggable={false}
                    />

                    {/* Original Clip (Left Side) */}
                    <div
                      className="absolute inset-0 overflow-hidden pointer-events-none"
                      style={{ clipPath: `inset(0 ${100 - splitPos}% 0 0)` }}
                    >
                      <img
                        src={sourceImage.src}
                        alt="Original Photo"
                        className="w-auto h-auto max-w-[85vw] max-h-[70vh] object-contain select-none pointer-events-none block"
                        draggable={false}
                      />
                      <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-[10px] font-bold tracking-wider uppercase text-white shadow-xs">
                        Original Photo
                      </div>
                    </div>

                    {/* Stylized Label (Right Side) */}
                    <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-violet-600/90 backdrop-blur-xs text-[10px] font-bold tracking-wider uppercase text-white shadow-xs pointer-events-none">
                      {selectedStyleId === "custom" ? customStyleName : currentStylePreset?.name || "Artwork"}
                    </div>

                    {/* Split Divider Line & Draggable Handle */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.8)] pointer-events-none z-20 flex items-center justify-center -translate-x-1/2"
                      style={{ left: `${splitPos}%` }}
                    >
                      <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-900 text-violet-500 shadow-xl border-2 border-violet-500 flex items-center justify-center active:scale-110 transition-transform pointer-events-auto">
                        <SlidersHorizontal size={14} />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Mode 2: Side-by-Side Dual View ── */}
                {viewMode === "side-by-side" && !isHoldingOriginal && (
                  <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 max-w-[90vw] max-h-[75vh]">
                    <div className="relative rounded-xl overflow-hidden shadow-xl border border-slate-700/60 max-h-[35vh] sm:max-h-[70vh]">
                      <img
                        src={sourceImage.src}
                        alt="Original"
                        className="w-auto h-auto max-w-[42vw] max-h-[35vh] sm:max-h-[70vh] object-contain block"
                      />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-[9px] font-bold uppercase tracking-wider text-white">
                        Original Photo
                      </div>
                    </div>

                    <div className="relative rounded-xl overflow-hidden shadow-xl border border-violet-500/40 max-h-[35vh] sm:max-h-[70vh]">
                      <img
                        src={previewUrl}
                        alt="Stylized"
                        className="w-auto h-auto max-w-[42vw] max-h-[35vh] sm:max-h-[70vh] object-contain block"
                      />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-violet-600/90 backdrop-blur-xs text-[9px] font-bold uppercase tracking-wider text-white">
                        {selectedStyleId === "custom" ? customStyleName : currentStylePreset?.name || "Artwork"}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Mode 3: Result Only or Hold Spacebar ── */}
                {(viewMode === "result" || isHoldingOriginal) && (
                  <div className="relative rounded-xl overflow-hidden shadow-2xl border border-slate-700/60 max-w-[85vw] max-h-[75vh]">
                    <img
                      src={isHoldingOriginal ? sourceImage.src : previewUrl}
                      alt={isHoldingOriginal ? "Original" : "Stylized Artwork"}
                      className="w-auto h-auto max-w-[85vw] max-h-[75vh] object-contain select-none block"
                    />
                    <div
                      className={`absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase text-white shadow-xs ${isHoldingOriginal ? "bg-black/70" : "bg-violet-600/90"
                        }`}
                    >
                      {isHoldingOriginal
                        ? "Original (Holding Space)"
                        : selectedStyleId === "custom"
                          ? customStyleName
                          : currentStylePreset?.name || "Artwork"}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Zoom & Mobile View Controls */}
            {sourceImage && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs">
                {/* Mobile View Mode Switcher */}
                <div className="sm:hidden flex items-center mr-1 pr-1 border-r border-white/20">
                  <button
                    type="button"
                    onClick={() =>
                      setViewMode(
                        viewMode === "split"
                          ? "side-by-side"
                          : viewMode === "side-by-side"
                            ? "result"
                            : "split"
                      )
                    }
                    className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-violet-500/30 text-violet-300"
                  >
                    {viewMode === "split" ? "Split" : viewMode === "side-by-side" ? "Dual" : "Result"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))}
                  className="p-1 hover:text-violet-400 transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut size={14} />
                </button>
                <span className="font-mono text-[11px] w-10 text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))}
                  className="p-1 hover:text-violet-400 transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn size={14} />
                </button>
                <div className="w-px h-3.5 bg-white/20 mx-0.5" />
                <button
                  type="button"
                  onClick={() => setZoomLevel(1)}
                  className="text-[10px] font-semibold text-slate-300 hover:text-white px-1"
                >
                  Fit
                </button>
              </div>
            )}
          </div>

          {/* ── Right / Mobile Controls & Styles Drawer ── */}
          <div
            className={`w-full md:w-84 lg:w-92 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161b22] flex flex-col p-4 overflow-y-auto overscroll-contain custom-scrollbar touch-pan-y min-h-0 ${mobileTab === "controls"
              ? "flex flex-1 h-full max-h-full"
              : "hidden md:flex md:h-full md:max-h-full"
              }`}
          >
            {/* Section 1: Choose Style */}
            <div className="space-y-3 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                  <Brush size={13} className="text-violet-500" /> Art Style Library
                </span>
                <span className="text-[10px] text-slate-400">1-click apply</span>
              </div>

              {/* Custom Style Upload Card */}
              <div
                onClick={() => customFileInputRef.current?.click()}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between gap-2.5 ${selectedStyleId === "custom"
                  ? "border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/40 shadow-xs"
                  : "border-dashed border-slate-300 dark:border-slate-700 hover:border-violet-500/50 bg-slate-50/50 dark:bg-[#12161f]"
                  }`}
              >
                <input
                  ref={customFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleCustomStyleFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                <div className="flex items-center gap-2.5 min-w-0">
                  {customStyleImage ? (
                    <img
                      src={customStyleImage.src}
                      alt="Custom Style"
                      className="w-8 h-8 rounded-lg object-cover border border-violet-500/40 shrink-0"
                    />
                  ) : (
                    <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-500 border border-violet-500/20 shrink-0">
                      <Upload size={14} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {customStyleImage ? customStyleName : "Use Custom Style Image"}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {customStyleImage ? "Custom image active • Click to change" : "Upload any reference painting or photo"}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 shrink-0">
                  {customStyleImage ? "Change" : "Browse"}
                </span>
              </div>

              {/* Grid of Preset Styles */}
              <div className="grid grid-cols-2 gap-2">
                {PRESET_STYLES.map((style) => {
                  const isActive = selectedStyleId === style.id;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => chooseStyle(style)}
                      className={`relative group rounded-xl overflow-hidden border text-left transition-all p-1.5 flex flex-col gap-1.5 ${isActive
                        ? "border-violet-500 bg-violet-500/10 ring-2 ring-violet-500/40 shadow-xs"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-[#12161f]"
                        }`}
                    >
                      <div className="relative w-full h-16 rounded-lg overflow-hidden bg-slate-900 shrink-0">
                        <img
                          src={style.styleImageUrl}
                          alt={style.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        <span className="absolute bottom-1 left-1.5 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-black/60 text-white/90 backdrop-blur-xs">
                          {style.badge}
                        </span>
                        {isActive && (
                          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-violet-500 text-white flex items-center justify-center">
                            <Check size={10} />
                          </div>
                        )}
                      </div>
                      <div className="px-0.5">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {style.name}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                          {style.artist}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Fine-Tuning Sliders & Settings */}
            <div className="space-y-4 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                  <Sliders size={13} className="text-violet-500" /> Fine Adjustments
                </span>
                <button
                  type="button"
                  onClick={() => setSettings(DEFAULT_SETTINGS)}
                  className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                >
                  Reset
                </button>
              </div>

              {/* Slider 1: Style Strength */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                    <Wand2 size={12} className="text-violet-500" /> Style Strength
                  </span>
                  <span className="font-mono text-slate-400">{settings.strength}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="5"
                  value={settings.strength}
                  onChange={(e) => setSettings((s) => ({ ...s, strength: parseInt(e.target.value) }))}
                  className="w-full accent-violet-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Toggle: Preserve Original Colors */}
              <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#12161f] flex items-center justify-between">
                <div className="pr-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Paintbrush size={12} className="text-violet-500" /> Preserve Photo Colors
                  </span>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Keep your photo's natural colors while adopting brush textures
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.preserveColor}
                  onClick={() => setSettings((s) => ({ ...s, preserveColor: !s.preserveColor }))}
                  className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors shrink-0 ${settings.preserveColor ? "bg-violet-600" : "bg-slate-300 dark:bg-slate-700"
                    }`}
                >
                  <div
                    className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${settings.preserveColor ? "translate-x-4" : "translate-x-0"
                      }`}
                  />
                </button>
              </div>

              {/* Slider 2: Brightness */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">Brightness</span>
                  <span className="font-mono text-slate-400">
                    {settings.brightness >= 0 ? `+${settings.brightness}%` : `${settings.brightness}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  step="2"
                  value={settings.brightness}
                  onChange={(e) => setSettings((s) => ({ ...s, brightness: parseInt(e.target.value) }))}
                  className="w-full accent-violet-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider 3: Contrast */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">Contrast</span>
                  <span className="font-mono text-slate-400">{settings.contrast}%</span>
                </div>
                <input
                  type="range"
                  min="70"
                  max="140"
                  step="2"
                  value={settings.contrast}
                  onChange={(e) => setSettings((s) => ({ ...s, contrast: parseInt(e.target.value) }))}
                  className="w-full accent-violet-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider 4: Saturation / Vibrance */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">Color Vibrance</span>
                  <span className="font-mono text-slate-400">{settings.saturation}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="160"
                  step="5"
                  value={settings.saturation}
                  onChange={(e) => setSettings((s) => ({ ...s, saturation: parseInt(e.target.value) }))}
                  className="w-full accent-violet-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider 5: Texture Sharpness */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">Brush Stroke Sharpness</span>
                  <span className="font-mono text-slate-400">{settings.sharpness}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={settings.sharpness}
                  onChange={(e) => setSettings((s) => ({ ...s, sharpness: parseInt(e.target.value) }))}
                  className="w-full accent-violet-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Section 3: Artwork & Engine Metadata Card */}
            <div className="pt-4 pb-24 md:pb-8 space-y-2 text-xs border-t border-slate-100 dark:border-slate-800/60 mt-2 shrink-0">
              <div className="flex items-center justify-between text-slate-400">
                <span>Original Dimensions:</span>
                <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                  {sourceImage.naturalWidth} × {sourceImage.naturalHeight} px
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>File Size:</span>
                <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                  {sourceFileSize > 0 ? `${Math.round(sourceFileSize / 1024)} KB` : "Embedded"}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Active Art Style:</span>
                <span className="font-mono font-medium text-violet-600 dark:text-violet-400 truncate max-w-[140px]">
                  {selectedStyleId === "custom" ? customStyleName : currentStylePreset?.name || "Masterpiece"}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Engine:</span>
                <span className="font-mono font-medium text-violet-600 dark:text-violet-400 flex items-center gap-1">
                  <ShieldCheck size={12} /> Google Magenta Neural
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
