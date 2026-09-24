import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Crop,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Rotate3D,
  Sparkles,
  Download,
  Copy,
  Check,
  X,
  Lock,
  Unlock,
  Grid,
  Square,
  Circle,
  Shapes,
  SlidersHorizontal,
  RefreshCw,
  ArrowLeft,
  Upload,
  Info,
  Layers,
  FolderOpen,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { FileDropzoneUpload, SampleImageItem } from "./FileDropzoneUpload";
import CustomSelect from "../CustomSelect";

// ═════════════════════════════════════════════════════════════
//  PRESETS & SHAPES DEFINITIONS
// ═════════════════════════════════════════════════════════════

export type CropShape =
  | "rectangle"
  | "square"
  | "circle"
  | "rounded"
  | "ellipse"
  | "triangle"
  | "pentagon"
  | "star"
  | "polygon"
  | "heart";

export interface CropPreset {
  id: string;
  name: string;
  category: "aspect" | "social";
  aspectRatio: number | null; // null = free
  width?: number; // target width if fixed
  height?: number; // target height if fixed
  badge: string;
  description: string;
}

const PRESETS: CropPreset[] = [
  // Free / Standard
  { id: "free", name: "Free", category: "aspect", aspectRatio: null, badge: "Freeform", description: "Unconstrained custom cropping" },
  { id: "1:1", name: "1:1 Square", category: "aspect", aspectRatio: 1, badge: "1:1", description: "Square (1:1)" },
  { id: "4:3", name: "4:3 Standard", category: "aspect", aspectRatio: 4 / 3, badge: "4:3", description: "Standard photo & display (4:3)" },
  { id: "3:4", name: "3:4 Portrait", category: "aspect", aspectRatio: 3 / 4, badge: "3:4", description: "Classic vertical portrait (3:4)" },
  { id: "16:9", name: "16:9 Widescreen", category: "aspect", aspectRatio: 16 / 9, badge: "16:9", description: "Modern widescreen display & TV (16:9)" },
  { id: "9:16", name: "9:16 Vertical", category: "aspect", aspectRatio: 9 / 16, badge: "9:16", description: "Vertical mobile screen & video (9:16)" },

  // Social Platforms
  { id: "yt-thumb", name: "YouTube Thumbnail", category: "social", aspectRatio: 16 / 9, width: 1280, height: 720, badge: "1280 × 720", description: "Standard YouTube video thumbnail (16:9)" },
  { id: "yt-shorts", name: "YouTube Shorts", category: "social", aspectRatio: 9 / 16, width: 1080, height: 1920, badge: "1080 × 1920", description: "YouTube Shorts vertical format (9:16)" },
  { id: "ig-post", name: "Instagram Post", category: "social", aspectRatio: 1, width: 1080, height: 1080, badge: "1080 × 1080", description: "Instagram Square feed post (1:1)" },
  { id: "ig-portrait", name: "Instagram Portrait", category: "social", aspectRatio: 4 / 5, width: 1080, height: 1350, badge: "1080 × 1350", description: "Instagram Portrait feed post (4:5)" },
  { id: "ig-story", name: "Instagram Story / Reel", category: "social", aspectRatio: 9 / 16, width: 1080, height: 1920, badge: "1080 × 1920", description: "Instagram Story & Reels video (9:16)" },
  { id: "fb-post", name: "Facebook Post", category: "social", aspectRatio: 1200 / 630, width: 1200, height: 630, badge: "1200 × 630", description: "Facebook landscape feed image (1.91:1)" },
  { id: "fb-cover", name: "Facebook Cover", category: "social", aspectRatio: 820 / 312, width: 820, height: 312, badge: "820 × 312", description: "Facebook profile / page banner (2.63:1)" },
  { id: "x-post", name: "Twitter / X Post", category: "social", aspectRatio: 16 / 9, width: 1200, height: 675, badge: "1200 × 675", description: "Twitter/X in-stream media card (16:9)" },
  { id: "linkedin-post", name: "LinkedIn Post", category: "social", aspectRatio: 1200 / 627, width: 1200, height: 627, badge: "1200 × 627", description: "LinkedIn shared image post (1.91:1)" },
  { id: "custom-size", name: "Custom Size", category: "aspect", aspectRatio: null, badge: "Custom px", description: "Enter exact custom width and height" },
];

const SHAPES: { id: CropShape; label: string; icon: string }[] = [
  { id: "rectangle", label: "Rectangle", icon: "▭" },
  { id: "square", label: "Square", icon: "◻" },
  { id: "circle", label: "Circle", icon: "○" },
  { id: "rounded", label: "Rounded", icon: "▢" },
  { id: "ellipse", label: "Ellipse", icon: "⬭" },
  { id: "triangle", label: "Triangle", icon: "△" },
  { id: "pentagon", label: "Pentagon", icon: "⬠" },
  { id: "star", label: "Star", icon: "★" },
  { id: "polygon", label: "Polygon", icon: "⬡" },
  { id: "heart", label: "Heart", icon: "♥" },
];

const SAMPLE_IMAGES: SampleImageItem[] = [
  {
    label: "Mountain Vista",
    url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=80&auto=format&fit=crop",
    badge: "Landscape",
    description: "Panoramic mountain ridges with deep depth",
  },
  {
    label: "Modern Architecture",
    url: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80&auto=format&fit=crop",
    badge: "City",
    description: "Sleek geometric glass skyscraper lines",
  },
  {
    label: "Coffee & Workspace",
    url: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1200&q=80&auto=format&fit=crop",
    badge: "Flatlay",
    description: "Artistic overhead composition",
  },
  {
    label: "Portrait",
    url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200&q=80&auto=format&fit=crop",
    badge: "Portrait",
    description: "Studio portrait with sharp facial details",
  },
];

type ExportFormat = "png" | "jpeg" | "webp";
type GridType = "thirds" | "golden" | "cross" | "none";
type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "rotate" | "inside";

// ═════════════════════════════════════════════════════════════
//  SVG / CANVAS SHAPE PATH GENERATOR
// ═════════════════════════════════════════════════════════════

function generateShapePath(
  shape: CropShape,
  x: number,
  y: number,
  w: number,
  h: number,
  options: {
    cornerRadius?: number; // 0 to 0.5 (percent of min dimension)
    polygonSides?: number; // 3 to 12
    starPoints?: number; // e.g. 5
    starInnerRatio?: number; // 0.2 to 0.8
  } = {}
): string {
  const {
    cornerRadius = 0.2,
    polygonSides = 6,
    starPoints = 5,
    starInnerRatio = 0.45,
  } = options;

  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = Math.max(1, w / 2);
  const ry = Math.max(1, h / 2);

  switch (shape) {
    case "square":
    case "rectangle": {
      return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
    }

    case "circle": {
      const r = Math.min(rx, ry);
      return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
    }

    case "ellipse": {
      return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
    }

    case "rounded": {
      const maxR = Math.min(w, h) / 2;
      const r = Math.min(maxR, Math.max(2, maxR * cornerRadius));
      return `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
    }

    case "triangle": {
      const p1 = `${cx} ${y}`;
      const p2 = `${x + w} ${y + h}`;
      const p3 = `${x} ${y + h}`;
      return `M ${p1} L ${p2} L ${p3} Z`;
    }

    case "pentagon": {
      const sides = 5;
      const pts: string[] = [];
      for (let i = 0; i < sides; i++) {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
        const px = cx + rx * Math.cos(angle);
        const py = cy + ry * Math.sin(angle);
        pts.push(`${px} ${py}`);
      }
      return `M ${pts[0]} L ${pts.slice(1).join(" L ")} Z`;
    }

    case "polygon": {
      const sides = Math.max(3, Math.min(12, polygonSides));
      const pts: string[] = [];
      for (let i = 0; i < sides; i++) {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
        const px = cx + rx * Math.cos(angle);
        const py = cy + ry * Math.sin(angle);
        pts.push(`${px} ${py}`);
      }
      return `M ${pts[0]} L ${pts.slice(1).join(" L ")} Z`;
    }

    case "star": {
      const points = starPoints;
      const pts: string[] = [];
      const totalPoints = points * 2;
      for (let i = 0; i < totalPoints; i++) {
        const isOuter = i % 2 === 0;
        const currRx = isOuter ? rx : rx * starInnerRatio;
        const currRy = isOuter ? ry : ry * starInnerRatio;
        const angle = -Math.PI / 2 + (i * Math.PI) / points;
        const px = cx + currRx * Math.cos(angle);
        const py = cy + currRy * Math.sin(angle);
        pts.push(`${px} ${py}`);
      }
      return `M ${pts[0]} L ${pts.slice(1).join(" L ")} Z`;
    }

    case "heart": {
      const topY = y + h * 0.28;
      const bottomY = y + h * 0.95;
      const controlY1 = y - h * 0.05;
      const controlY2 = y + h * 0.55;

      return `M ${cx} ${topY}
        C ${cx - rx * 0.6} ${controlY1}, ${x} ${controlY1 + h * 0.15}, ${x} ${topY + h * 0.22}
        C ${x} ${controlY2}, ${cx - rx * 0.3} ${bottomY - h * 0.2}, ${cx} ${bottomY}
        C ${cx + rx * 0.3} ${bottomY - h * 0.2}, ${x + w} ${controlY2}, ${x + w} ${topY + h * 0.22}
        C ${x + w} ${controlY1 + h * 0.15}, ${cx + rx * 0.6} ${controlY1}, ${cx} ${topY} Z`;
    }

    default:
      return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
  }
}

// ═════════════════════════════════════════════════════════════
//  MAIN COMPONENT: ImageCropUtil
// ═════════════════════════════════════════════════════════════

export function ImageCropUtil() {
  // Source Image State
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [imageName, setImageName] = useState("photo");
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Tool Modes & Configurations
  const [activeTab, setActiveTab] = useState<"presets" | "shapes" | "transform" | "export">("presets");
  const [activePreset, setActivePreset] = useState<string>("free");
  const [shape, setShape] = useState<CropShape>("rectangle");
  const [cornerRadius, setCornerRadius] = useState<number>(0.2); // 0 to 0.5
  const [polygonSides, setPolygonSides] = useState<number>(6); // 3 to 12
  const [starPoints, setStarPoints] = useState<number>(5);
  const [starInnerRatio, setStarInnerRatio] = useState<number>(0.45);

  // Aspect ratio lock
  const [lockAspect, setLockAspect] = useState<boolean>(false);
  const [customAspect, setCustomAspect] = useState<number | null>(null);

  // Custom Exact Dimension inputs
  const [customWidth, setCustomWidth] = useState<number>(1080);
  const [customHeight, setCustomHeight] = useState<number>(1080);

  // Crop Box Coordinates (in natural source image pixels)
  const [crop, setCrop] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  // Rotation & Flipping
  const [rotation, setRotation] = useState<number>(0); // -180 to 180 degrees
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);

  // Guides & UX
  const [gridType, setGridType] = useState<GridType>("thirds");
  const [isInteracting, setIsInteracting] = useState<boolean>(false);

  // Viewport Zoom & Pan (screen space)
  const [zoom, setZoom] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Export Settings
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [exportQuality, setExportQuality] = useState<number>(0.92);
  const [backgroundColor, setBackgroundColor] = useState<string>("transparent");
  const [exportAtPresetSize, setExportAtPresetSize] = useState<boolean>(false);

  // Feedback indicators
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Mobile Drawer & Splitter State
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== "undefined" && window.innerWidth < 768);
  const [mobilePanelHeight, setMobilePanelHeight] = useState<number>(310);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(false);
  const isResizingSplitterRef = useRef(false);
  const dragSplitterStartRef = useRef<{ startY: number; startH: number }>({ startY: 0, startH: 310 });

  // Update isMobile on window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Splitter pointer drag handler for mobile properties drawer
  const handleSplitterPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // If the click is on a button or inside a button, do not capture or drag
    if ((e.target as HTMLElement).closest("button")) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) {}

    isResizingSplitterRef.current = true;
    dragSplitterStartRef.current = {
      startY: e.clientY,
      startH: isPanelCollapsed ? 0 : mobilePanelHeight,
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (!isResizingSplitterRef.current) return;
      const deltaY = ev.clientY - dragSplitterStartRef.current.startY;
      // Dragging UP (ev.clientY < startY, deltaY < 0) => panel should grow
      const targetH = dragSplitterStartRef.current.startH - deltaY;

      if (targetH < 80) {
        setIsPanelCollapsed(true);
      } else {
        setIsPanelCollapsed(false);
        const containerH = containerRef.current?.clientHeight || 500;
        const maxH = Math.max(160, Math.min(containerH + mobilePanelHeight - 90, window.innerHeight * 0.78));
        setMobilePanelHeight(Math.min(Math.max(targetH, 110), maxH));
      }
    };

    const onPointerUp = () => {
      isResizingSplitterRef.current = false;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }, [isPanelCollapsed, mobilePanelHeight]);

  // Container & Interaction Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 800, height: 600 });

  // ═════════════════════════════════════════════════════════════
  // Container Sizing Observer
  // ═════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setContainerSize({ width: rect.width, height: rect.height });
        }
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    window.addEventListener("resize", updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, [sourceImage]);

  // ═════════════════════════════════════════════════════════════
  // Image Loading & Initialization
  // ═════════════════════════════════════════════════════════════

  const handleImageLoaded = useCallback((img: HTMLImageElement, name = "photo") => {
    setSourceImage(img);
    setImageName(name.replace(/\.[^/.]+$/, ""));
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    setNaturalDimensions({ width: w, height: h });

    // Initial default crop: 90% centered crop
    const initialW = Math.round(w * 0.9);
    const initialH = Math.round(h * 0.9);
    const initialX = Math.round((w - initialW) / 2);
    const initialY = Math.round((h - initialH) / 2);

    setCrop({
      x: initialX,
      y: initialY,
      width: initialW,
      height: initialH,
    });

    setCustomWidth(initialW);
    setCustomHeight(initialH);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setPanOffset({ x: 0, y: 0 });
    setZoom(1);
    setActivePreset("free");
    setShape("rectangle");
    setLockAspect(false);
    setCustomAspect(null);
  }, []);

  const handleFileSelected = useCallback(
    (file: File) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        handleImageLoaded(img, file.name);
      };
      img.src = url;
    },
    [handleImageLoaded]
  );

  const handleSampleSelected = useCallback(
    (url: string) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        handleImageLoaded(img, "sample-photo");
      };
      img.src = url;
    },
    [handleImageLoaded]
  );

  // ═════════════════════════════════════════════════════════════
  // Viewport Coordinates & Dynamic Fit Math
  // ═════════════════════════════════════════════════════════════

  // Compute Base Fit Scale (fit image with 32px padding, scaling up or down)
  const fitScale = useMemo(() => {
    if (!sourceImage || containerSize.width <= 0 || containerSize.height <= 0 || !naturalDimensions.width || !naturalDimensions.height) {
      return 1;
    }
    const padding = 36;
    const availW = Math.max(100, containerSize.width - padding * 2);
    const availH = Math.max(100, containerSize.height - padding * 2);
    return Math.min(availW / naturalDimensions.width, availH / naturalDimensions.height);
  }, [sourceImage, containerSize, naturalDimensions]);

  // Overall effective scale factor: natural image pixel -> screen pixel
  const effectiveScale = fitScale * zoom;

  // Image placement on screen
  const screenOrigin = useMemo(() => {
    const imgScreenW = naturalDimensions.width * effectiveScale;
    const imgScreenH = naturalDimensions.height * effectiveScale;
    const cx = containerSize.width / 2 + panOffset.x;
    const cy = containerSize.height / 2 + panOffset.y;
    return {
      x: cx - imgScreenW / 2,
      y: cy - imgScreenH / 2,
      width: imgScreenW,
      height: imgScreenH,
    };
  }, [containerSize, panOffset, naturalDimensions, effectiveScale]);

  // Natural -> Screen coordinate conversion
  const toScreen = useCallback(
    (nx: number, ny: number) => ({
      x: screenOrigin.x + nx * effectiveScale,
      y: screenOrigin.y + ny * effectiveScale,
    }),
    [screenOrigin, effectiveScale]
  );

  // Crop rectangle in screen coordinates
  const screenCrop = useMemo(() => {
    const p1 = toScreen(crop.x, crop.y);
    const w = crop.width * effectiveScale;
    const h = crop.height * effectiveScale;
    return {
      x: p1.x,
      y: p1.y,
      width: w,
      height: h,
      cx: p1.x + w / 2,
      cy: p1.y + h / 2,
    };
  }, [crop, effectiveScale, toScreen]);

  // ═════════════════════════════════════════════════════════════
  // Presets & Aspect Ratio Fitting
  // ═════════════════════════════════════════════════════════════

  const applyPreset = useCallback(
    (presetId: string) => {
      setActivePreset(presetId);
      const preset = PRESETS.find((p) => p.id === presetId);
      if (!preset || !naturalDimensions.width || !naturalDimensions.height) return;

      const imgW = naturalDimensions.width;
      const imgH = naturalDimensions.height;

      if (preset.id === "custom-size") {
        setLockAspect(false);
        setCustomAspect(null);
        return;
      }

      if (preset.aspectRatio === null) {
        setLockAspect(false);
        setCustomAspect(null);
        return;
      }

      // Proportional fitting inside image bounds
      const ratio = preset.aspectRatio;
      setLockAspect(true);
      setCustomAspect(ratio);

      let newW = imgW * 0.9;
      let newH = newW / ratio;
      if (newH > imgH * 0.9) {
        newH = imgH * 0.9;
        newW = newH * ratio;
      }

      const newX = Math.round((imgW - newW) / 2);
      const newY = Math.round((imgH - newH) / 2);

      setCrop({
        x: Math.max(0, newX),
        y: Math.max(0, newY),
        width: Math.round(newW),
        height: Math.round(newH),
      });

      if (preset.width && preset.height) {
        setCustomWidth(preset.width);
        setCustomHeight(preset.height);
      } else {
        setCustomWidth(Math.round(newW));
        setCustomHeight(Math.round(newH));
      }
    },
    [naturalDimensions]
  );

  const selectShape = useCallback(
    (newShape: CropShape) => {
      setShape(newShape);
      if (newShape === "square" || newShape === "circle") {
        setLockAspect(true);
        setCustomAspect(1);
        const size = Math.min(crop.width, crop.height);
        const imgW = naturalDimensions.width;
        const imgH = naturalDimensions.height;
        const cx = crop.x + crop.width / 2;
        const cy = crop.y + crop.height / 2;
        const newX = Math.max(0, Math.min(imgW - size, Math.round(cx - size / 2)));
        const newY = Math.max(0, Math.min(imgH - size, Math.round(cy - size / 2)));

        setCrop({
          x: newX,
          y: newY,
          width: size,
          height: size,
        });
      }
    },
    [crop, naturalDimensions]
  );

  const applyCustomDimensions = useCallback(
    (w: number, h: number) => {
      const validW = Math.max(10, Math.min(naturalDimensions.width, w));
      const validH = Math.max(10, Math.min(naturalDimensions.height, h));

      const cx = crop.x + crop.width / 2;
      const cy = crop.y + crop.height / 2;

      let newX = Math.round(cx - validW / 2);
      let newY = Math.round(cy - validH / 2);

      newX = Math.max(0, Math.min(naturalDimensions.width - validW, newX));
      newY = Math.max(0, Math.min(naturalDimensions.height - validH, newY));

      setCrop({
        x: newX,
        y: newY,
        width: validW,
        height: validH,
      });
      setCustomWidth(validW);
      setCustomHeight(validH);
    },
    [crop, naturalDimensions]
  );

  // ═════════════════════════════════════════════════════════════
  // Transform Actions: Rotate 90, Flip, Reset & Fit
  // ═════════════════════════════════════════════════════════════

  const rotate90CW = useCallback(() => {
    setRotation((r) => {
      const next = (r + 90) % 360;
      return next > 180 ? next - 360 : next;
    });
  }, []);

  const rotate90CCW = useCallback(() => {
    setRotation((r) => {
      const next = (r - 90) % 360;
      return next < -180 ? next + 360 : next;
    });
  }, []);

  const resetCrop = useCallback(() => {
    if (!naturalDimensions.width || !naturalDimensions.height) return;
    const w = naturalDimensions.width;
    const h = naturalDimensions.height;
    const initialW = Math.round(w * 0.9);
    const initialH = Math.round(h * 0.9);
    setCrop({
      x: Math.round((w - initialW) / 2),
      y: Math.round((h - initialH) / 2),
      width: initialW,
      height: initialH,
    });
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
    setActivePreset("free");
    setShape("rectangle");
    setLockAspect(false);
  }, [naturalDimensions]);

  // Fit image to view
  const fitToView = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // ═════════════════════════════════════════════════════════════
  // Pointer Event Handling (Handles, Inside Move, Rotation, Pan)
  // Window listeners guarantee zero lag & no lost pointer capture
  // ═════════════════════════════════════════════════════════════

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, handle: ResizeHandle) => {
      e.stopPropagation();
      e.preventDefault();

      const targetEl = e.currentTarget as HTMLElement;
      try {
        targetEl.setPointerCapture(e.pointerId);
      } catch (_) {}

      setIsInteracting(true);

      const startX = e.clientX;
      const startY = e.clientY;
      const startCrop = { ...crop };
      const startRotation = rotation;
      const startPan = { ...panOffset };

      const imgW = naturalDimensions.width;
      const imgH = naturalDimensions.height;
      const aspect = lockAspect ? (customAspect || (startCrop.width / startCrop.height)) : null;

      const onPointerMove = (ev: PointerEvent) => {
        const dxScreen = ev.clientX - startX;
        const dyScreen = ev.clientY - startY;

        // Rotation Handle Dragging
        if (handle === "rotate") {
          const cropCenterScreenX = screenCrop.cx;
          const cropCenterScreenY = screenCrop.cy;

          const currentAngle = Math.atan2(ev.clientY - cropCenterScreenY, ev.clientX - cropCenterScreenX) * (180 / Math.PI) + 90;
          let newAngle = Math.round(currentAngle);
          while (newAngle > 180) newAngle -= 360;
          while (newAngle < -180) newAngle += 360;

          // Snapping: snap to 0°, 45°, 90°, 135°, 180°, etc.
          const snaps = [0, 45, 90, 135, 180, -45, -90, -135, -180];
          for (const s of snaps) {
            if (Math.abs(newAngle - s) <= 3) {
              newAngle = s;
              break;
            }
          }
          setRotation(newAngle);
          return;
        }

        // Inside Move Dragging
        if (handle === "inside") {
          const dx = dxScreen / effectiveScale;
          const dy = dyScreen / effectiveScale;

          let newX = Math.round(startCrop.x + dx);
          let newY = Math.round(startCrop.y + dy);

          // Clamped within image natural bounds
          newX = Math.max(0, Math.min(imgW - startCrop.width, newX));
          newY = Math.max(0, Math.min(imgH - startCrop.height, newY));

          setCrop({
            ...startCrop,
            x: newX,
            y: newY,
          });
          return;
        }

        // Resize Handles with rotation-aware projection
        const rad = (-startRotation * Math.PI) / 180;
        const dxLocal = (dxScreen * Math.cos(rad) - dyScreen * Math.sin(rad)) / effectiveScale;
        const dyLocal = (dxScreen * Math.sin(rad) + dyScreen * Math.cos(rad)) / effectiveScale;

        let { x, y, width, height } = startCrop;
        const minSize = 24;

        switch (handle) {
          case "e": {
            width = Math.max(minSize, Math.min(imgW - x, startCrop.width + dxLocal));
            if (aspect) height = Math.max(minSize, Math.min(imgH - y, Math.round(width / aspect)));
            break;
          }
          case "s": {
            height = Math.max(minSize, Math.min(imgH - y, startCrop.height + dyLocal));
            if (aspect) width = Math.max(minSize, Math.min(imgW - x, Math.round(height * aspect)));
            break;
          }
          case "w": {
            const maxLeft = startCrop.x + startCrop.width - minSize;
            x = Math.max(0, Math.min(maxLeft, startCrop.x + dxLocal));
            width = startCrop.x + startCrop.width - x;
            if (aspect) height = Math.max(minSize, Math.min(imgH - y, Math.round(width / aspect)));
            break;
          }
          case "n": {
            const maxTop = startCrop.y + startCrop.height - minSize;
            y = Math.max(0, Math.min(maxTop, startCrop.y + dyLocal));
            height = startCrop.y + startCrop.height - y;
            if (aspect) width = Math.max(minSize, Math.min(imgW - x, Math.round(height * aspect)));
            break;
          }
          case "se": {
            width = Math.max(minSize, Math.min(imgW - x, startCrop.width + dxLocal));
            height = Math.max(minSize, Math.min(imgH - y, startCrop.height + dyLocal));
            if (aspect) {
              const byW = width / aspect;
              if (byW <= imgH - y) {
                height = Math.round(byW);
              } else {
                height = imgH - y;
                width = Math.round(height * aspect);
              }
            }
            break;
          }
          case "sw": {
            const maxLeft = startCrop.x + startCrop.width - minSize;
            x = Math.max(0, Math.min(maxLeft, startCrop.x + dxLocal));
            width = startCrop.x + startCrop.width - x;
            height = Math.max(minSize, Math.min(imgH - y, startCrop.height + dyLocal));
            if (aspect) height = Math.max(minSize, Math.min(imgH - y, Math.round(width / aspect)));
            break;
          }
          case "ne": {
            width = Math.max(minSize, Math.min(imgW - x, startCrop.width + dxLocal));
            const maxTop = startCrop.y + startCrop.height - minSize;
            y = Math.max(0, Math.min(maxTop, startCrop.y + dyLocal));
            height = startCrop.y + startCrop.height - y;
            if (aspect) {
              height = Math.max(minSize, Math.min(startCrop.y + startCrop.height, Math.round(width / aspect)));
              y = startCrop.y + startCrop.height - height;
            }
            break;
          }
          case "nw": {
            const maxLeft = startCrop.x + startCrop.width - minSize;
            x = Math.max(0, Math.min(maxLeft, startCrop.x + dxLocal));
            width = startCrop.x + startCrop.width - x;
            const maxTop = startCrop.y + startCrop.height - minSize;
            y = Math.max(0, Math.min(maxTop, startCrop.y + dyLocal));
            height = startCrop.y + startCrop.height - y;
            if (aspect) {
              height = Math.max(minSize, Math.round(width / aspect));
              y = startCrop.y + startCrop.height - height;
            }
            break;
          }
        }

        setCrop({
          x: Math.round(x),
          y: Math.round(y),
          width: Math.round(width),
          height: Math.round(height),
        });
        setCustomWidth(Math.round(width));
        setCustomHeight(Math.round(height));
      };

      const onPointerUp = (ev: PointerEvent) => {
        try {
          targetEl.releasePointerCapture(ev.pointerId);
        } catch (_) {}
        setIsInteracting(false);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    },
    [crop, rotation, panOffset, naturalDimensions, lockAspect, customAspect, screenCrop, effectiveScale]
  );

  // ═════════════════════════════════════════════════════════════
  // Pan Viewport Dragging (Background Pan)
  // ═════════════════════════════════════════════════════════════

  const handleStagePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only allow panning if zoomed in (> 105%) so normal cropping never moves the canvas or background
      if (zoom <= 1.05) {
        return;
      }
      // If clicking directly on the background stage
      if (e.target !== containerRef.current && (e.target as HTMLElement).tagName !== "svg" && (e.target as HTMLElement).tagName !== "path" && (e.target as HTMLElement).tagName !== "rect") {
        return;
      }
      const startX = e.clientX;
      const startY = e.clientY;
      const startPan = { ...panOffset };

      const onMove = (ev: PointerEvent) => {
        setPanOffset({
          x: startPan.x + (ev.clientX - startX),
          y: startPan.y + (ev.clientY - startY),
        });
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerup", onUp);
    },
    [panOffset, zoom]
  );

  // ═════════════════════════════════════════════════════════════
  // High-Resolution Export Engine
  // ═════════════════════════════════════════════════════════════

  const renderCroppedCanvas = useCallback((): HTMLCanvasElement | null => {
    if (!sourceImage || crop.width <= 0 || crop.height <= 0) return null;

    const activePresetObj = PRESETS.find((p) => p.id === activePreset);
    let outW = crop.width;
    let outH = crop.height;

    if (exportAtPresetSize && activePresetObj?.width && activePresetObj?.height) {
      outW = activePresetObj.width;
      outH = activePresetObj.height;
    }

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (backgroundColor !== "transparent" || exportFormat === "jpeg") {
      ctx.fillStyle = backgroundColor === "transparent" ? "#ffffff" : backgroundColor;
      ctx.fillRect(0, 0, outW, outH);
    }

    ctx.save();

    // Shape Clipping
    const pathStr = generateShapePath(shape, 0, 0, outW, outH, {
      cornerRadius,
      polygonSides,
      starPoints,
      starInnerRatio,
    });
    const clipPath = new Path2D(pathStr);
    ctx.clip(clipPath);

    // Coordinate transforms
    ctx.translate(outW / 2, outH / 2);
    if (rotation !== 0) ctx.rotate((rotation * Math.PI) / 180);
    if (flipH || flipV) ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

    // Draw Source Image
    ctx.drawImage(
      sourceImage,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      -outW / 2,
      -outH / 2,
      outW,
      outH
    );

    ctx.restore();
    return canvas;
  }, [
    sourceImage,
    crop,
    activePreset,
    exportAtPresetSize,
    backgroundColor,
    exportFormat,
    shape,
    cornerRadius,
    polygonSides,
    starPoints,
    starInnerRatio,
    rotation,
    flipH,
    flipV,
  ]);

  const copyAsPng = useCallback(async () => {
    const canvas = renderCroppedCanvas();
    if (!canvas) return;

    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([
          new ClipboardItem({
            "image/png": blob,
          }),
        ]);
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2200);
      }, "image/png");
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  }, [renderCroppedCanvas]);

  const downloadCroppedImage = useCallback(() => {
    const canvas = renderCroppedCanvas();
    if (!canvas) return;

    setIsExporting(true);
    const mimeType = exportFormat === "jpeg" ? "image/jpeg" : exportFormat === "webp" ? "image/webp" : "image/png";

    canvas.toBlob(
      (blob) => {
        setIsExporting(false);
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${imageName}-cropped.${exportFormat}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      },
      mimeType,
      exportQuality
    );
  }, [renderCroppedCanvas, exportFormat, exportQuality, imageName]);

  // ═════════════════════════════════════════════════════════════
  // Overlay Guides & SVG Paths
  // ═════════════════════════════════════════════════════════════

  const shapeSvgPath = useMemo(() => {
    return generateShapePath(
      shape,
      screenCrop.x,
      screenCrop.y,
      screenCrop.width,
      screenCrop.height,
      {
        cornerRadius,
        polygonSides,
        starPoints,
        starInnerRatio,
      }
    );
  }, [shape, screenCrop, cornerRadius, polygonSides, starPoints, starInnerRatio]);

  const guideLines = useMemo(() => {
    if (gridType === "none") return null;

    const { x, y, width: w, height: h } = screenCrop;
    const lines: React.ReactNode[] = [];

    if (gridType === "thirds") {
      lines.push(
        <line key="v1" x1={x + w / 3} y1={y} x2={x + w / 3} y2={y + h} stroke="rgba(255,255,255,0.4)" strokeDasharray="3 3" />,
        <line key="v2" x1={x + (w * 2) / 3} y1={y} x2={x + (w * 2) / 3} y2={y + h} stroke="rgba(255,255,255,0.4)" strokeDasharray="3 3" />,
        <line key="h1" x1={x} y1={y + h / 3} x2={x + w} y2={y + h / 3} stroke="rgba(255,255,255,0.4)" strokeDasharray="3 3" />,
        <line key="h2" x1={x} y1={y + (h * 2) / 3} x2={x + w} y2={y + (h * 2) / 3} stroke="rgba(255,255,255,0.4)" strokeDasharray="3 3" />
      );
    } else if (gridType === "golden") {
      lines.push(
        <line key="gv1" x1={x + w * 0.382} y1={y} x2={x + w * 0.382} y2={y + h} stroke="rgba(255,215,0,0.5)" strokeDasharray="4 2" />,
        <line key="gv2" x1={x + w * 0.618} y1={y} x2={x + w * 0.618} y2={y + h} stroke="rgba(255,215,0,0.5)" strokeDasharray="4 2" />,
        <line key="gh1" x1={x} y1={y + h * 0.382} x2={x + w} y2={y + h * 0.382} stroke="rgba(255,215,0,0.5)" strokeDasharray="4 2" />,
        <line key="gh2" x1={x} y1={y + h * 0.618} x2={x + w} y2={y + h * 0.618} stroke="rgba(255,215,0,0.5)" strokeDasharray="4 2" />
      );
    } else if (gridType === "cross") {
      lines.push(
        <line key="cx" x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} stroke="rgba(56,189,248,0.6)" strokeDasharray="2 2" />,
        <line key="cy" x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} stroke="rgba(56,189,248,0.6)" strokeDasharray="2 2" />
      );
    }
    return lines;
  }, [gridType, screenCrop]);

  const currentRatioString = useMemo(() => {
    if (!crop.width || !crop.height) return "1:1";
    const r = crop.width / crop.height;
    if (Math.abs(r - 1) < 0.02) return "1:1";
    if (Math.abs(r - 16 / 9) < 0.02) return "16:9";
    if (Math.abs(r - 9 / 16) < 0.02) return "9:16";
    if (Math.abs(r - 4 / 3) < 0.02) return "4:3";
    if (Math.abs(r - 3 / 4) < 0.02) return "3:4";
    if (Math.abs(r - 4 / 5) < 0.02) return "4:5";
    return `${r.toFixed(2)}:1`;
  }, [crop]);

  // ═════════════════════════════════════════════════════════════
  // RENDER: Upload & Dropzone View (Initial Screen)
  // ═════════════════════════════════════════════════════════════

  if (!sourceImage) {
    return (
      <div className="flex flex-col h-full bg-slate-900 text-slate-100 p-4 sm:p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col justify-center">
          <div className="mb-6 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <Crop size={13} />
              Advanced Image Crop
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
              Professional Crop, Shape & Preset Studio
            </h2>
            <p className="text-sm text-slate-400 max-w-lg mx-auto">
              Trim, rotate, and sculpt your photos for YouTube, Instagram, Facebook, and custom shapes with live pixel-perfect control.
            </p>
          </div>

          <FileDropzoneUpload
            title="Upload or Drag & Drop Photo to Crop"
            subtitle="Supports PNG, JPG, WebP, SVG, and high-resolution photos"
            accentColor="cyan"
            sampleImages={SAMPLE_IMAGES}
            onFileSelected={handleFileSelected}
            onSampleSelect={handleSampleSelected}
          />
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════
  // RENDER: Active Crop Editor View
  // ═════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Hidden File Input for Re-upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleFileSelected(e.target.files[0]);
        }}
      />

      {/* ── Top Bar: Back / Change Image, Rotation, Reset, Zoom, Re-upload ── */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md shrink-0 z-30 gap-2">
        {/* Left: Prominent Back to Dropzone & Change Image Button */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setSourceImage(null)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold shadow-xs active:scale-95 transition-all shrink-0"
            title="Back to upload dropzone / choose different photo"
          >
            <ArrowLeft size={14} className="text-teal-400" />
            <span className="hidden sm:inline">Change Photo</span>
            <span className="sm:hidden">Back</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-medium transition-all shrink-0"
            title="Choose another image file from disk"
          >
            <Upload size={13} />
            <span>Re-upload</span>
          </button>

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          {/* Current Dimensions Pill */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-bold text-white truncate max-w-[100px] sm:max-w-[140px]">{imageName}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700 shrink-0">
              {crop.width} × {crop.height} px
            </span>
            <span className="hidden md:inline-block text-[10px] px-1.5 py-0.5 rounded bg-teal-950/60 text-teal-300 font-mono border border-teal-800/40 shrink-0">
              {currentRatioString}
            </span>
          </div>
        </div>

        {/* Center: Transform Buttons (Rotate 90, Flip, Guides) */}
        <div className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
          <button
            onClick={rotate90CCW}
            title="Rotate 90° Counter-Clockwise"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            <RotateCcw size={15} />
          </button>
          <button
            onClick={rotate90CW}
            title="Rotate 90° Clockwise"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            <RotateCw size={15} />
          </button>
          <div className="w-px h-4 bg-slate-800 mx-0.5" />
          <button
            onClick={() => setFlipH((f) => !f)}
            title="Flip Horizontally"
            className={`p-1.5 rounded-lg transition-colors ${flipH ? "bg-teal-500/20 text-teal-300" : "hover:bg-slate-800 text-slate-300 hover:text-white"}`}
          >
            <FlipHorizontal size={15} />
          </button>
          <button
            onClick={() => setFlipV((f) => !f)}
            title="Flip Vertically"
            className={`p-1.5 rounded-lg transition-colors ${flipV ? "bg-teal-500/20 text-teal-300" : "hover:bg-slate-800 text-slate-300 hover:text-white"}`}
          >
            <FlipVertical size={15} />
          </button>
          <div className="w-px h-4 bg-slate-800 mx-0.5" />
          <button
            onClick={() => setGridType((g) => (g === "thirds" ? "golden" : g === "golden" ? "cross" : g === "cross" ? "none" : "thirds"))}
            title={`Guide Grid: ${gridType.toUpperCase()} (Click to toggle)`}
            className={`p-1.5 rounded-lg transition-colors ${gridType !== "none" ? "bg-cyan-500/20 text-cyan-300" : "hover:bg-slate-800 text-slate-400"}`}
          >
            <Grid size={15} />
          </button>
        </div>

        {/* Right: Zoom controls, Fit button & Reset */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-slate-950/60 rounded-xl border border-slate-800 p-0.5">
            <button
              onClick={() => setZoom((z) => Math.max(0.2, +(z - 0.15).toFixed(2)))}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-[11px] font-mono px-1.5 text-slate-300 w-10 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(4, +(z + 0.15).toFixed(2)))}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={fitToView}
              className="px-2 py-1 text-[11px] font-semibold text-teal-400 hover:text-teal-300 hover:bg-teal-500/10 rounded-md transition-colors"
              title="Fit Image to Viewport"
            >
              Fit
            </button>
          </div>

          <button
            onClick={resetCrop}
            title="Reset crop to full view"
            className="p-1.5 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-800/40 text-slate-300 hover:text-white transition-colors"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── Main Workspace: Canvas Viewport + Sidebar ── */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative min-h-0 min-w-0">
        {/* ── Central Viewport Stage ── */}
        <div
          ref={containerRef}
          className="flex-1 h-full min-h-0 min-w-0 relative overflow-hidden bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] bg-slate-950 flex items-center justify-center cursor-default select-none touch-none"
          onPointerDown={handleStagePointerDown}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.[0]) handleFileSelected(e.dataTransfer.files[0]);
          }}
        >
          {/* Base Image Container with Crisp Border & Shadow */}
          <div
            className="absolute origin-center pointer-events-none ring-1 ring-white/15 shadow-2xl"
            style={{
              left: screenOrigin.x,
              top: screenOrigin.y,
              width: screenOrigin.width,
              height: screenOrigin.height,
              transform: `rotate(${rotation}deg) scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`,
            }}
          >
            <img
              src={sourceImage.src}
              alt="Crop target"
              className="w-full h-full object-fill pointer-events-none block"
              draggable={false}
            />
          </div>

          {/* SVG Overlay: Dimmed Cutout Scrim + Guides + Shape Border */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden z-10">
            {/* Transformed Group: Outlines, Guides, Cutout Scrim */}
            <g transform={`rotate(${rotation} ${screenCrop.cx} ${screenCrop.cy})`}>
              {/* Dimmed Outside Scrim using EvenOdd Winding (Zero GPU Mask Buffers, 100% artifact-free on all mobile & desktop GPUs) */}
              <path
                d={`M -4000 -4000 H 8000 V 8000 H -4000 Z ${shapeSvgPath}`}
                fill="rgba(2, 6, 23, 0.58)"
                fillRule="evenodd"
              />

              {/* Internal Guides (Thirds / Golden / Cross) */}
              <g>{guideLines}</g>

              {/* Glowing Crop Outline (dual path: smooth glow halo + sharp cyan stroke, no buggy SVG filters) */}
              <path
                d={shapeSvgPath}
                fill="none"
                stroke="rgba(6, 182, 212, 0.3)"
                strokeWidth="4"
              />
              <path
                d={shapeSvgPath}
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2"
              />

              {/* Rotation Handle Connector Line */}
              <line
                x1={screenCrop.cx}
                y1={screenCrop.y}
                x2={screenCrop.cx}
                y2={screenCrop.y - 28}
                stroke="#22d3ee"
                strokeWidth="1.5"
                strokeDasharray="2 2"
              />
            </g>
          </svg>

          {/* Interactive Drag & Resize Layer (HTML elements with Pointer Events) */}
          <div
            className="absolute z-20 pointer-events-auto"
            style={{
              left: screenCrop.x,
              top: screenCrop.y,
              width: screenCrop.width,
              height: screenCrop.height,
              transformOrigin: "center center",
              transform: `rotate(${rotation}deg)`,
            }}
          >
            {/* Inside Draggable Area */}
            <div
              className="w-full h-full cursor-move touch-none"
              title="Drag to reposition crop frame"
              onPointerDown={(e) => handlePointerDown(e, "inside")}
            />

            {/* Rotation Knob above top center (Generous 48px touch target) */}
            <div
              className="absolute -top-9 left-1/2 -translate-x-1/2 w-8 h-8 flex items-center justify-center cursor-grab active:cursor-grabbing z-30 touch-none after:content-[''] after:absolute after:-inset-2"
              title="Drag to rotate crop angle (Snaps to 0°, 45°, 90°)"
              onPointerDown={(e) => handlePointerDown(e, "rotate")}
            >
              <div className="w-6 h-6 rounded-full bg-cyan-400 border-2 border-white shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-transform pointer-events-none">
                <Rotate3D size={11} className="text-slate-950 font-bold" />
              </div>
            </div>

            {/* 8 Resize Handles (High-contrast knobs with 48px mobile touch targets) */}
            {/* Top-Left */}
            <div
              className="absolute -top-4 -left-4 w-8 h-8 flex items-center justify-center cursor-nwse-resize z-30 touch-none after:content-[''] after:absolute after:-inset-2"
              onPointerDown={(e) => handlePointerDown(e, "nw")}
              title="Resize Top-Left"
            >
              <div className="w-4 h-4 rounded-full bg-white border-2 border-cyan-500 shadow-lg hover:scale-125 transition-transform pointer-events-none" />
            </div>
            {/* Top-Center */}
            <div
              className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 flex items-center justify-center cursor-ns-resize z-30 touch-none after:content-[''] after:absolute after:-inset-2"
              onPointerDown={(e) => handlePointerDown(e, "n")}
              title="Resize Top"
            >
              <div className="w-4 h-4 rounded-full bg-white border-2 border-cyan-500 shadow-lg hover:scale-125 transition-transform pointer-events-none" />
            </div>
            {/* Top-Right */}
            <div
              className="absolute -top-4 -right-4 w-8 h-8 flex items-center justify-center cursor-nesw-resize z-30 touch-none after:content-[''] after:absolute after:-inset-2"
              onPointerDown={(e) => handlePointerDown(e, "ne")}
              title="Resize Top-Right"
            >
              <div className="w-4 h-4 rounded-full bg-white border-2 border-cyan-500 shadow-lg hover:scale-125 transition-transform pointer-events-none" />
            </div>
            {/* Middle-Right */}
            <div
              className="absolute top-1/2 -right-4 -translate-y-1/2 w-8 h-8 flex items-center justify-center cursor-ew-resize z-30 touch-none after:content-[''] after:absolute after:-inset-2"
              onPointerDown={(e) => handlePointerDown(e, "e")}
              title="Resize Right"
            >
              <div className="w-4 h-4 rounded-full bg-white border-2 border-cyan-500 shadow-lg hover:scale-125 transition-transform pointer-events-none" />
            </div>
            {/* Bottom-Right */}
            <div
              className="absolute -bottom-4 -right-4 w-8 h-8 flex items-center justify-center cursor-nwse-resize z-30 touch-none after:content-[''] after:absolute after:-inset-2"
              onPointerDown={(e) => handlePointerDown(e, "se")}
              title="Resize Bottom-Right"
            >
              <div className="w-4 h-4 rounded-full bg-white border-2 border-cyan-500 shadow-lg hover:scale-125 transition-transform pointer-events-none" />
            </div>
            {/* Bottom-Center */}
            <div
              className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-8 h-8 flex items-center justify-center cursor-ns-resize z-30 touch-none after:content-[''] after:absolute after:-inset-2"
              onPointerDown={(e) => handlePointerDown(e, "s")}
              title="Resize Bottom"
            >
              <div className="w-4 h-4 rounded-full bg-white border-2 border-cyan-500 shadow-lg hover:scale-125 transition-transform pointer-events-none" />
            </div>
            {/* Bottom-Left */}
            <div
              className="absolute -bottom-4 -left-4 w-8 h-8 flex items-center justify-center cursor-nesw-resize z-30 touch-none after:content-[''] after:absolute after:-inset-2"
              onPointerDown={(e) => handlePointerDown(e, "sw")}
              title="Resize Bottom-Left"
            >
              <div className="w-4 h-4 rounded-full bg-white border-2 border-cyan-500 shadow-lg hover:scale-125 transition-transform pointer-events-none" />
            </div>
            {/* Middle-Left */}
            <div
              className="absolute top-1/2 -left-4 -translate-y-1/2 w-8 h-8 flex items-center justify-center cursor-ew-resize z-30 touch-none after:content-[''] after:absolute after:-inset-2"
              onPointerDown={(e) => handlePointerDown(e, "w")}
              title="Resize Left"
            >
              <div className="w-4 h-4 rounded-full bg-white border-2 border-cyan-500 shadow-lg hover:scale-125 transition-transform pointer-events-none" />
            </div>
          </div>

          {/* Floating Canvas Quick Status pill at bottom of viewport */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-800 text-[11px] text-slate-300 shadow-xl pointer-events-none">
            <span className="font-semibold text-white">{crop.width} × {crop.height} px</span>
            <span className="text-slate-500">•</span>
            <span>{currentRatioString}</span>
            {rotation !== 0 && (
              <>
                <span className="text-slate-500">•</span>
                <span className="text-cyan-400 font-mono">{rotation > 0 ? `+${rotation}°` : `${rotation}°`}</span>
              </>
            )}
          </div>
        </div>

        {/* ── Mobile Splitter Line with Notch & Hide/Unhide ── */}
        <div
          onPointerDown={handleSplitterPointerDown}
          onClick={(e) => {
            // If panel is collapsed and user tapped anywhere on the bar (not a button), expand it!
            if (isPanelCollapsed && !(e.target as HTMLElement).closest("button")) {
              setMobilePanelHeight((h) => (h < 200 ? 280 : h));
              setIsPanelCollapsed(false);
            }
          }}
          onDoubleClick={() => {
            setMobilePanelHeight(310);
            setIsPanelCollapsed(false);
          }}
          className="md:hidden relative z-30 shrink-0 w-full h-7 cursor-row-resize bg-slate-900 border-t border-slate-800 flex items-center justify-between px-3 select-none touch-none hover:bg-slate-850 active:bg-slate-800 transition-colors group"
          title={isPanelCollapsed ? "Tap or drag up to show controls" : "Drag up/down to resize properties drawer (Double-tap to reset)"}
        >
          {/* Left: Hide / Unhide Button */}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setIsPanelCollapsed((prev) => {
                if (prev && mobilePanelHeight < 200) {
                  setMobilePanelHeight(280);
                }
                return !prev;
              });
            }}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-200 hover:text-white px-2.5 py-0.5 rounded-md bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 transition-colors z-20 cursor-pointer touch-auto shadow-xs"
            title={isPanelCollapsed ? "Show controls drawer" : "Hide controls drawer"}
          >
            {isPanelCollapsed ? (
              <ChevronUp size={13} className="text-teal-400 shrink-0" />
            ) : (
              <ChevronDown size={13} className="text-teal-400 shrink-0" />
            )}
            <span>{isPanelCollapsed ? "Show Controls" : "Hide Controls"}</span>
          </button>

          {/* Center: Sleek Notch Pill (Grab Handle) - ABSOLUTELY CENTERED ON SCREEN */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
            <div
              className="w-14 h-1.5 rounded-full bg-slate-500 group-hover:bg-teal-400 group-active:bg-teal-300 transition-all shadow-xs"
              title="Drag up or down to resize"
            />
          </div>

          {/* Right: Dimension or State Pill */}
          <div className="flex items-center gap-1 z-10 pointer-events-none">
            <span className="text-[10px] text-slate-400 font-mono">
              {isPanelCollapsed ? "Hidden" : `${Math.round(mobilePanelHeight)}px`}
            </span>
          </div>
        </div>

        {/* ── Control Sidebar / Mobile Bottom Drawer ── */}
        <div
          className={`w-full md:w-80 lg:w-96 border-t md:border-t-0 md:border-l border-slate-800 bg-slate-900 md:!h-full md:!max-h-none shrink-0 overflow-hidden ${
            isPanelCollapsed ? "hidden md:flex md:flex-col" : "flex flex-col"
          }`}
          style={!isPanelCollapsed ? { height: `${mobilePanelHeight}px`, maxHeight: "80vh" } : undefined}
        >
          {/* Tab Navigation: Presets / Shapes / Transform / Export */}
          <div className="flex items-center justify-between p-1.5 bg-slate-950/70 border-b border-slate-800 gap-1 shrink-0">
            <div className="grid grid-cols-4 gap-1 flex-1">
              <button
                onClick={() => setActiveTab("presets")}
                className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === "presets" ? "bg-teal-500 text-slate-950 shadow-sm" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}
              >
                <Crop size={13} />
                <span>Presets</span>
              </button>
              <button
                onClick={() => setActiveTab("shapes")}
                className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === "shapes" ? "bg-teal-500 text-slate-950 shadow-sm" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}
              >
                <Shapes size={13} />
                <span>Shapes</span>
              </button>
              <button
                onClick={() => setActiveTab("transform")}
                className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === "transform" ? "bg-teal-500 text-slate-950 shadow-sm" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}
              >
                <SlidersHorizontal size={13} />
                <span>Adjust</span>
              </button>
              <button
                onClick={() => setActiveTab("export")}
                className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === "export" ? "bg-teal-500 text-slate-950 shadow-sm" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}
              >
                <Download size={13} />
                <span>Export</span>
              </button>
            </div>
            {/* Mobile-only collapse chevron button */}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setIsPanelCollapsed(true);
              }}
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 ml-1 cursor-pointer touch-auto"
              title="Hide controls drawer"
            >
              <ChevronDown size={15} />
            </button>
          </div>

          {/* Tab Content Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* ── TAB 1: PRESETS ── */}
            {activeTab === "presets" && (
              <div className="space-y-4">
                {/* Aspect Lock Toggle */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${lockAspect ? "bg-teal-500/20 text-teal-400" : "bg-slate-800 text-slate-400"}`}>
                      {lockAspect ? <Lock size={14} /> : <Unlock size={14} />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Lock Aspect Ratio</div>
                      <div className="text-[10px] text-slate-400">Keep proportional resizing</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setLockAspect(!lockAspect)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${lockAspect ? "bg-teal-500 text-slate-950" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
                  >
                    {lockAspect ? "Locked" : "Unlocked"}
                  </button>
                </div>

                {/* Aspect Presets Grid */}
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Common Ratios</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {PRESETS.filter((p) => p.category === "aspect" && p.id !== "custom-size").map((p) => {
                      const isSelected = activePreset === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => applyPreset(p.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all ${isSelected
                            ? "bg-teal-500/15 border-teal-500 text-white shadow-sm ring-1 ring-teal-500/50"
                            : "bg-slate-950/50 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white"
                            }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold">{p.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-teal-400 border border-slate-700">
                              {p.badge}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">{p.description}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Social Media Presets */}
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Social Media Dimensions
                  </div>
                  <div className="space-y-1.5">
                    {PRESETS.filter((p) => p.category === "social").map((p) => {
                      const isSelected = activePreset === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => applyPreset(p.id)}
                          className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${isSelected
                            ? "bg-teal-500/15 border-teal-500 text-white shadow-sm ring-1 ring-teal-500/50"
                            : "bg-slate-950/40 border-slate-800/80 hover:border-slate-700 text-slate-300 hover:text-white"
                            }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="text-xs font-bold truncate">{p.name}</div>
                            <div className="text-[10px] text-slate-400 truncate">{p.description}</div>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-teal-400 border border-slate-700 shrink-0">
                            {p.badge}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 2: SHAPES ── */}
            {activeTab === "shapes" && (
              <div className="space-y-4">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Select Crop Silhouette
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {SHAPES.map((s) => {
                    const isSelected = shape === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => selectShape(s.id)}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${isSelected
                          ? "bg-teal-500/20 border-teal-500 text-white shadow-sm ring-1 ring-teal-500/50"
                          : "bg-slate-950/50 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200"
                          }`}
                      >
                        <span className="text-2xl font-mono leading-none">{s.icon}</span>
                        <span className="text-xs font-semibold">{s.label}</span>
                      </button>
                    );
                  })}
                </div>

                {shape === "rounded" && (
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300">Corner Rounding</span>
                      <span className="font-mono text-teal-400">{Math.round(cornerRadius * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.02"
                      max="0.5"
                      step="0.01"
                      value={cornerRadius}
                      onChange={(e) => setCornerRadius(parseFloat(e.target.value))}
                      className="w-full accent-teal-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                )}

                {shape === "polygon" && (
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300">Polygon Sides</span>
                      <span className="font-mono text-teal-400">{polygonSides} Sides</span>
                    </div>
                    <input
                      type="range"
                      min="3"
                      max="12"
                      step="1"
                      value={polygonSides}
                      onChange={(e) => setPolygonSides(parseInt(e.target.value))}
                      className="w-full accent-teal-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Triangle (3)</span>
                      <span>Hexagon (6)</span>
                      <span>Dodecagon (12)</span>
                    </div>
                  </div>
                )}

                {shape === "star" && (
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-300">Star Points</span>
                        <span className="font-mono text-teal-400">{starPoints} Points</span>
                      </div>
                      <input
                        type="range"
                        min="4"
                        max="10"
                        step="1"
                        value={starPoints}
                        onChange={(e) => setStarPoints(parseInt(e.target.value))}
                        className="w-full accent-teal-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-300">Inner Depth</span>
                        <span className="font-mono text-teal-400">{Math.round(starInnerRatio * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.2"
                        max="0.75"
                        step="0.05"
                        value={starInnerRatio}
                        onChange={(e) => setStarInnerRatio(parseFloat(e.target.value))}
                        className="w-full accent-teal-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 3: TRANSFORM & EXACT PIXELS ── */}
            {activeTab === "transform" && (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">Rotation Angle</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-teal-400 font-bold">{rotation}°</span>
                      {rotation !== 0 && (
                        <button
                          onClick={() => setRotation(0)}
                          className="text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-800"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    step="1"
                    value={rotation}
                    onChange={(e) => setRotation(parseInt(e.target.value))}
                    className="w-full accent-teal-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>-180°</span>
                    <span>0°</span>
                    <span>+180°</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="text-xs font-semibold text-slate-300 mb-2">Flip Image</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setFlipH(!flipH)}
                      className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all ${flipH ? "bg-teal-500/20 border-teal-500 text-teal-300" : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"}`}
                    >
                      <FlipHorizontal size={14} />
                      <span>Flip Horizontal</span>
                    </button>
                    <button
                      onClick={() => setFlipV(!flipV)}
                      className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all ${flipV ? "bg-teal-500/20 border-teal-500 text-teal-300" : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"}`}
                    >
                      <FlipVertical size={14} />
                      <span>Flip Vertical</span>
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">Exact Dimensions (px)</span>
                    <span className="text-[10px] text-slate-500">Max: {naturalDimensions.width} × {naturalDimensions.height}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold block mb-1">WIDTH</label>
                      <input
                        type="number"
                        min="20"
                        max={naturalDimensions.width}
                        value={customWidth}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setCustomWidth(val);
                          applyCustomDimensions(val, customHeight);
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-teal-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold block mb-1">HEIGHT</label>
                      <input
                        type="number"
                        min="20"
                        max={naturalDimensions.height}
                        value={customHeight}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setCustomHeight(val);
                          applyCustomDimensions(customWidth, val);
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 4: EXPORT ── */}
            {activeTab === "export" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Export Format</label>
                  <CustomSelect
                    value={exportFormat}
                    onChange={(v) => setExportFormat(v as ExportFormat)}
                    options={[
                      { label: "PNG (Lossless & Transparent)", value: "png", description: "Best for non-rectangular shapes & transparent clips" },
                      { label: "JPEG (Standard & Compressed)", value: "jpeg", description: "Great for photos & standard social shares" },
                      { label: "WebP (Modern & Compact)", value: "webp", description: "High quality with tiny file size and alpha channel" },
                    ]}
                  />
                </div>

                {exportFormat !== "png" && (
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300">Output Quality</span>
                      <span className="font-mono text-teal-400">{Math.round(exportQuality * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.4"
                      max="1.0"
                      step="0.02"
                      value={exportQuality}
                      onChange={(e) => setExportQuality(parseFloat(e.target.value))}
                      className="w-full accent-teal-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                )}

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="text-xs font-semibold text-slate-300">Background Fill (Non-rect shapes)</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => setBackgroundColor("transparent")}
                      disabled={exportFormat === "jpeg"}
                      className={`py-1.5 px-2 rounded-lg border text-xs font-medium transition-all ${backgroundColor === "transparent" ? "bg-teal-500/20 border-teal-500 text-teal-300" : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"} ${exportFormat === "jpeg" ? "opacity-40 cursor-not-allowed" : ""}`}
                    >
                      Transparent
                    </button>
                    <button
                      onClick={() => setBackgroundColor("#ffffff")}
                      className={`py-1.5 px-2 rounded-lg border text-xs font-medium transition-all ${backgroundColor === "#ffffff" ? "bg-teal-500/20 border-teal-500 text-teal-300" : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"}`}
                    >
                      White
                    </button>
                    <button
                      onClick={() => setBackgroundColor("#000000")}
                      className={`py-1.5 px-2 rounded-lg border text-xs font-medium transition-all ${backgroundColor === "#000000" ? "bg-teal-500/20 border-teal-500 text-teal-300" : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"}`}
                    >
                      Black
                    </button>
                  </div>
                  {exportFormat === "jpeg" && (
                    <div className="text-[10px] text-amber-400/90 flex items-center gap-1">
                      <Info size={11} /> JPEG does not support transparency (white default)
                    </div>
                  )}
                </div>

                {PRESETS.find((p) => p.id === activePreset)?.width && (
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300">Preset Target Resolution</span>
                      <span className="font-mono text-teal-400">
                        {PRESETS.find((p) => p.id === activePreset)?.width} × {PRESETS.find((p) => p.id === activePreset)?.height} px
                      </span>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exportAtPresetSize}
                        onChange={(e) => setExportAtPresetSize(e.target.checked)}
                        className="rounded accent-teal-500"
                      />
                      <span>Scale output to exact preset dimensions</span>
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Fixed Bottom Actions in Sidebar: Copy PNG & Download ── */}
          <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2 shrink-0">
            <button
              onClick={copyAsPng}
              className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 ${copyFeedback
                ? "bg-emerald-500 text-white border-emerald-500"
                : "bg-slate-900 hover:bg-slate-800 text-white border-slate-700 hover:border-slate-600"
                }`}
            >
              {copyFeedback ? <Check size={14} /> : <Copy size={14} />}
              <span>{copyFeedback ? "Copied PNG!" : "Copy PNG"}</span>
            </button>

            <button
              onClick={downloadCroppedImage}
              disabled={isExporting}
              className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-teal-500/10 active:scale-95 transition-all disabled:opacity-50"
            >
              <Download size={14} />
              <span>{isExporting ? "Saving..." : `Download ${exportFormat.toUpperCase()}`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
