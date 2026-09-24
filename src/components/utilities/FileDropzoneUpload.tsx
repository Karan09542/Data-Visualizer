import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload,
  Camera,
  Sparkles,
  ArrowUpRight,
  ClipboardPaste,
  Check,
  AlertCircle,
  Loader2,
  FolderOpen,
} from "lucide-react";
import { useClipboardImages } from "./useQuickUtilsPaste";
import { CameraCaptureModal } from "../CameraCaptureModal";

export interface SampleImageItem {
  label: string;
  url: string;
  description?: string;
  badge?: string;
}

export interface FileDropzoneUploadProps {
  /** Callback when a single file is selected/dropped/pasted */
  onFileSelected?: (file: File) => void;
  /** Legacy alias for onFileSelected */
  onImageSelected?: (file: File) => void;
  /** Callback when multiple files are selected */
  onFilesSelected?: (files: File[]) => void;
  /** Legacy alias for onFilesSelected */
  onImagesSelected?: (files: File[]) => void;
  /** Accept attribute for file input (e.g. "image/*", ".pdf,image/*") */
  accept?: string;
  /** Allow selecting multiple files */
  multiple?: boolean;
  /** Primary headline text */
  title?: string;
  /** Secondary description text */
  subtitle?: string;
  /** Notice text for clipboard paste button */
  pasteNotice?: string;
  /** Color theme for accents and hover effects */
  accentColor?: "indigo" | "emerald" | "blue" | "purple" | "cyan" | "amber" | "orange" | "fuchsia";
  /** Compact card mode vs full hero container */
  compact?: boolean;
  /** Custom icon to render inside the drop badge */
  icon?: React.ReactNode;
  /** Optional camera button trigger callback. If omitted, built-in CameraCaptureModal will open automatically */
  onCameraClick?: () => void;
  /** Whether to show the camera button (defaults to true) */
  enableCamera?: boolean;
  /** Whether to show the clipboard paste button (defaults to true) */
  enableClipboard?: boolean;
  /** Optional sample images to click for rapid testing */
  sampleImages?: SampleImageItem[];
  /** Callback when a sample image is clicked */
  onSampleSelect?: (url: string) => void;
  /** Custom Sample Image column */
  sampleImageColumn?: number;
  /** Disable interaction */
  disabled?: boolean;
  /** Extra class names for wrapper */
  className?: string;
}

const ACCENT_STYLES = {
  indigo: {
    border: "hover:border-indigo-500 dark:hover:border-indigo-500",
    dragActive: "bg-indigo-500/10 border-indigo-500 ring-2 ring-indigo-500/30",
    iconBg: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400",
    badge: "text-indigo-600 dark:text-indigo-400 border-indigo-500/20 bg-indigo-500/10",
    pillIcon: "text-indigo-500",
    btnHover: "hover:text-indigo-600 dark:hover:text-indigo-400",
  },
  emerald: {
    border: "hover:border-emerald-500 dark:hover:border-emerald-500",
    dragActive: "bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/30",
    iconBg: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400",
    badge: "text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
    pillIcon: "text-emerald-500",
    btnHover: "hover:text-emerald-600 dark:hover:text-emerald-400",
  },
  blue: {
    border: "hover:border-blue-500 dark:hover:border-blue-500",
    dragActive: "bg-blue-500/10 border-blue-500 ring-2 ring-blue-500/30",
    iconBg: "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400",
    badge: "text-blue-600 dark:text-blue-400 border-blue-500/20 bg-blue-500/10",
    pillIcon: "text-blue-500",
    btnHover: "hover:text-blue-600 dark:hover:text-blue-400",
  },
  purple: {
    border: "hover:border-purple-500 dark:hover:border-purple-500",
    dragActive: "bg-purple-500/10 border-purple-500 ring-2 ring-purple-500/30",
    iconBg: "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400",
    badge: "text-purple-600 dark:text-purple-400 border-purple-500/20 bg-purple-500/10",
    pillIcon: "text-purple-500",
    btnHover: "hover:text-purple-600 dark:hover:text-purple-400",
  },
  cyan: {
    border: "hover:border-cyan-500 dark:hover:border-cyan-500",
    dragActive: "bg-cyan-500/10 border-cyan-500 ring-2 ring-cyan-500/30",
    iconBg: "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400",
    badge: "text-cyan-600 dark:text-cyan-400 border-cyan-500/20 bg-cyan-500/10",
    pillIcon: "text-cyan-500",
    btnHover: "hover:text-cyan-600 dark:hover:text-cyan-400",
  },
  amber: {
    border: "hover:border-amber-500 dark:hover:border-amber-500",
    dragActive: "bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/30",
    iconBg: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400",
    badge: "text-amber-600 dark:text-amber-400 border-amber-500/20 bg-amber-500/10",
    pillIcon: "text-amber-500",
    btnHover: "hover:text-amber-600 dark:hover:text-amber-400",
  },
  orange: {
    border: "hover:border-orange-500 dark:hover:border-orange-500",
    dragActive: "bg-orange-500/10 border-orange-500 ring-2 ring-orange-500/30",
    iconBg: "bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400",
    badge: "text-orange-600 dark:text-orange-400 border-orange-500/20 bg-orange-500/10",
    pillIcon: "text-orange-500",
    btnHover: "hover:text-orange-600 dark:hover:text-orange-400",
  },
  fuchsia: {
    border: "hover:border-fuchsia-500 dark:hover:border-fuchsia-500",
    dragActive: "bg-fuchsia-500/10 border-fuchsia-500 ring-2 ring-fuchsia-500/30",
    iconBg: "bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-600 dark:text-fuchsia-400",
    badge: "text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/20 bg-fuchsia-500/10",
    pillIcon: "text-fuchsia-500",
    btnHover: "hover:text-fuchsia-600 dark:hover:text-fuchsia-400",
  },
};

const isFileAccepted = (file: File, accept?: string): boolean => {
  if (!accept || accept === "*" || accept === "*/*") return true;
  const parts = accept.split(",").map((s) => s.trim().toLowerCase());
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  return parts.some((pattern) => {
    if (pattern.startsWith(".")) {
      return name.endsWith(pattern);
    }
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -2);
      return type.startsWith(prefix);
    }
    return type === pattern;
  });
};

/**
 * Safely compute Tailwind grid classes for sample images without dynamic string interpolation.
 * Automatically adjusts 1 or 2 items on large screens so single images don't balloon into massive squares.
 */
function getSampleGridClass(sampleImageColumn?: number, count: number = 1): string {
  if (sampleImageColumn) {
    switch (sampleImageColumn) {
      case 1:
        return "grid-cols-1 sm:grid-cols-2 md:grid-cols-4";
      case 2:
        return "grid-cols-2 max-w-md";
      case 3:
        return "grid-cols-2 sm:grid-cols-3 max-w-xl";
      case 4:
        return "grid-cols-2 sm:grid-cols-4 max-w-2xl";
      case 5:
        return "grid-cols-2 sm:grid-cols-3 md:grid-cols-5 max-w-3xl";
      case 6:
        return "grid-cols-3 sm:grid-cols-6 max-w-4xl";
      default:
        return "grid-cols-2 sm:grid-cols-4 max-w-2xl";
    }
  }

  // Automatic adjustment based on count:
  // On big screens (md/lg), single or 2 items should NOT blow up to 300-600px!
  // Setting 4 columns on desktop (md/lg) keeps each card cleanly constrained to ~150-160px.
  if (count <= 2) {
    return "grid-cols-2 sm:grid-cols-3 md:grid-cols-4";
  }
  if (count === 3) {
    return "grid-cols-2 sm:grid-cols-3";
  }
  return "grid-cols-2 sm:grid-cols-4";
}

/**
 * Universal Drag-and-Drop, Clipboard Paste, Camera Capture, and File Upload Component
 * Works seamlessly on desktop and mobile devices for Images, PDFs, and general files.
 */
export const FileDropzoneUpload: React.FC<FileDropzoneUploadProps> = ({
  onFileSelected,
  onImageSelected,
  onFilesSelected,
  onImagesSelected,
  accept = "image/png,image/jpeg,image/webp,image/avif,image/bmp,image/svg+xml",
  multiple = false,
  title = "Drag & Drop File Here",
  subtitle = "Supports PNG, JPG, WEBP, AVIF, BMP • or tap to browse",
  pasteNotice = "Paste Clipboard",
  accentColor = "indigo",
  compact = false,
  icon,
  onCameraClick,
  enableCamera = true,
  enableClipboard = true,
  sampleImages,
  onSampleSelect,
  sampleImageColumn,
  disabled = false,
  className = "",
}) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isPasting, setIsPasting] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [pasteFeedback, setPasteFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const colors = ACCENT_STYLES[accentColor] || ACCENT_STYLES.indigo;

  const showFeedback = useCallback((type: "success" | "error" | "info", message: string) => {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    setPasteFeedback({ type, message });
    feedbackTimeoutRef.current = setTimeout(() => {
      setPasteFeedback(null);
    }, 3200);
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  const lastProcessedRef = useRef<{ time: number; signature: string }>({ time: 0, signature: "" });

  // Process incoming File items
  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      if (disabled) return;
      const fileList = Array.from(files).filter((file) => isFileAccepted(file, accept));
      if (fileList.length === 0) {
        if (files.length > 0) {
          showFeedback("error", `Unsupported file format. Accepted: ${accept}`);
        }
        return;
      }

      // Deduplication: prevent identical files from being processed more than once within 800ms
      const signature = fileList.map((f) => `${f.name}_${f.size}_${f.lastModified}`).join("|");
      const now = Date.now();
      if (now - lastProcessedRef.current.time < 800 && lastProcessedRef.current.signature === signature) {
        return;
      }
      lastProcessedRef.current = { time: now, signature };

      // Invoke either multi-file callback OR single-file callback, never both!
      if (multiple && (onFilesSelected || onImagesSelected)) {
        if (onFilesSelected) {
          onFilesSelected(fileList);
        } else if (onImagesSelected) {
          onImagesSelected(fileList);
        }
      } else if (fileList[0]) {
        if (onFileSelected) {
          onFileSelected(fileList[0]);
        } else if (onImageSelected) {
          onImageSelected(fileList[0]);
        }
      }
    },
    [disabled, accept, multiple, onFilesSelected, onImagesSelected, onFileSelected, onImageSelected, showFeedback]
  );

  // Hook into QuickUtils modal paste listener
  useClipboardImages(
    (pastedImages) => {
      if (!disabled && pastedImages.length > 0) {
        handleFiles(pastedImages);
        showFeedback("success", "Pasted from clipboard!");
      }
    },
    { enabled: !disabled, rootRef }
  );

  // Window fallback paste listener (only processes if event was not already handled by QuickUtilsPasteGuard)
  useEffect(() => {
    if (disabled) return;
    const handleWindowPaste = (e: ClipboardEvent) => {
      if (e.defaultPrevented) return;
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.items);
      const files = items
        .filter((item) => item.kind === "file")
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);

      if (files.length > 0) {
        handleFiles(files);
        showFeedback("success", "Pasted from clipboard!");
      }
    };

    window.addEventListener("paste", handleWindowPaste);
    return () => window.removeEventListener("paste", handleWindowPaste);
  }, [disabled, handleFiles, showFeedback]);

  // Mobile & Button trigger for Clipboard Paste
  const handleClipboardPaste = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (disabled || isPasting) return;

    setIsPasting(true);

    try {
      if (!navigator.clipboard) {
        showFeedback("error", "Clipboard API not supported. Please use file upload.");
        return;
      }

      let found = false;

      // 1. Try reading clipboard items (binary images / files)
      if (navigator.clipboard.read) {
        try {
          const items = await navigator.clipboard.read();
          for (const item of items) {
            const matchingType = item.types.find((t) => {
              if (accept.includes("image") && t.startsWith("image/")) return true;
              if (accept.includes("pdf") && t === "application/pdf") return true;
              return t.startsWith("image/");
            });

            if (matchingType) {
              const blob = await item.getType(matchingType);
              const ext = matchingType.split("/")[1]?.replace("+xml", "") || "png";
              const file = new File([blob], `clipboard-${Date.now()}.${ext}`, { type: matchingType });
              handleFiles([file]);
              found = true;
              showFeedback("success", "Pasted from clipboard!");
              return;
            }
          }
        } catch (readErr: any) {
          console.warn("navigator.clipboard.read failed, checking fallback:", readErr);
          if (readErr?.name === "NotAllowedError") {
            showFeedback("error", "Clipboard access was denied. Please allow clipboard permissions.");
            return;
          }
        }
      }

      // 2. Fallback: Try reading text from clipboard (data URL or image URL)
      if (!found && navigator.clipboard.readText) {
        try {
          const text = await navigator.clipboard.readText();
          const trimmed = text?.trim();

          if (trimmed) {
            // A. Data URI (e.g. data:image/png;base64,...)
            if (trimmed.startsWith("data:image/")) {
              const res = await fetch(trimmed);
              const blob = await res.blob();
              const ext = blob.type.split("/")[1]?.replace("+xml", "") || "png";
              const file = new File([blob], `clipboard-${Date.now()}.${ext}`, {
                type: blob.type || "image/png",
              });
              handleFiles([file]);
              found = true;
              showFeedback("success", "Pasted image from clipboard!");
              return;
            }

            // C. Direct Image URL
            if (/^https?:\/\/.+\.(png|jpe?g|webp|gif|svg|avif)(\?.*)?$/i.test(trimmed)) {
              if (onSampleSelect) {
                onSampleSelect(trimmed);
                found = true;
                showFeedback("success", "Loaded image URL from clipboard!");
                return;
              }
              try {
                const res = await fetch(trimmed);
                const blob = await res.blob();
                if (blob.type.startsWith("image/")) {
                  const ext = blob.type.split("/")[1]?.replace("+xml", "") || "png";
                  const file = new File([blob], `clipboard-${Date.now()}.${ext}`, { type: blob.type });
                  handleFiles([file]);
                  found = true;
                  showFeedback("success", "Loaded image URL from clipboard!");
                  return;
                }
              } catch {
                // CORS or network error, handled below
              }
            }

            // D. Spreadsheet / CSV text content
            const isSpreadsheet = accept.includes("csv") || accept.includes("xls") || accept.includes("sheet");
            if (isSpreadsheet && trimmed && !trimmed.startsWith("data:") && !trimmed.startsWith("http")) {
              const file = new File([trimmed], `clipboard-${Date.now()}.csv`, { type: "text/csv" });
              handleFiles([file]);
              found = true;
              showFeedback("success", "Pasted spreadsheet data from clipboard!");
              return;
            }
          }
        } catch (textErr) {
          console.warn("navigator.clipboard.readText failed:", textErr);
        }
      }

      showFeedback("error", "No compatible file found in clipboard. Copy an image or file first!");
    } catch (err: any) {
      console.error("Paste from clipboard failed:", err);
      showFeedback("error", err?.message || "Failed to access clipboard");
    } finally {
      setIsPasting(false);
    }
  };

  // Camera trigger handler
  const handleCameraTrigger = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    if (onCameraClick) {
      onCameraClick();
    } else {
      setIsCameraOpen(true);
    }
  };

  const handleCameraCapture = (file: File) => {
    setIsCameraOpen(false);
    handleFiles([file]);
    showFeedback("success", "Photo captured successfully!");
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDraggingOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    dragCounterRef.current = 0;
    setIsDraggingOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = ""; // Reset to allow re-uploading the same file
    }
  };

  return (
    <>
      <div
        ref={rootRef}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`w-full flex flex-col items-center justify-center transition-all ${className}`}
      >
        {/* Dropzone Card */}
        <div
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={`w-full relative border-2 border-dashed rounded-3xl transition-all duration-200 cursor-pointer group flex flex-col items-center justify-center select-none ${compact ? "p-4 sm:p-6 min-h-[140px]" : "p-6 sm:p-10 min-h-[210px]"
            } ${isDraggingOver
              ? colors.dragActive
              : `border-slate-300 dark:border-slate-700/80 bg-white/70 dark:bg-[#12161f]/70 ${colors.border} shadow-sm hover:shadow-md`
            } ${disabled ? "opacity-60 cursor-not-allowed pointer-events-none" : ""}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={handleInputChange}
            className="sr-only"
            tabIndex={-1}
          />

          {/* Central Icon */}
          <div
            className={`transition-all duration-200 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 ${compact ? "p-2.5 mb-2" : "p-3.5 sm:p-4 mb-3"
              } ${colors.iconBg}`}
          >
            {icon || <Upload size={compact ? 20 : 28} className="stroke-[2]" />}
          </div>

          {/* Title & Subtitle */}
          <h3
            className={`font-bold text-slate-900 dark:text-white transition-colors text-center px-2 ${compact ? "text-xs sm:text-sm" : "text-sm sm:text-base"
              }`}
          >
            {isDraggingOver ? "Drop to Load Instantly" : title}
          </h3>
          <p
            className={`text-slate-500 dark:text-slate-400 max-w-sm mt-1 text-center font-normal leading-relaxed px-2 ${compact ? "text-[11px]" : "text-xs sm:text-sm"
              }`}
          >
            {subtitle}
          </p>

          {/* Mobile-Friendly Action Buttons: Clipboard, Camera, Browse */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-3.5 sm:mt-4 max-w-full px-2">
            {enableClipboard && (
              <button
                type="button"
                onClick={handleClipboardPaste}
                disabled={isPasting || disabled}
                title="Paste directly from clipboard (mobile tap or Ctrl+V)"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs hover:shadow hover:bg-slate-50 dark:hover:bg-slate-700/80 active:scale-95 transition-all disabled:opacity-60 cursor-pointer ${colors.btnHover}`}
              >
                {isPasting ? (
                  <Loader2 size={13} className="animate-spin text-slate-400" />
                ) : (
                  <ClipboardPaste size={13} className={colors.pillIcon} />
                )}
                <span>{isPasting ? "Reading..." : pasteNotice}</span>
                {!pasteNotice.toLowerCase().includes("ctrl") && (
                  <span className="hidden sm:inline-block text-[10px] text-slate-400 dark:text-slate-500 font-mono font-normal">
                    (Ctrl+V)
                  </span>
                )}
              </button>
            )}

            {enableCamera && (
              <button
                type="button"
                onClick={handleCameraTrigger}
                disabled={disabled}
                title="Capture photo with your camera"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs hover:shadow hover:bg-slate-50 dark:hover:bg-slate-700/80 active:scale-95 transition-all disabled:opacity-60 cursor-pointer ${colors.btnHover}`}
              >
                <Camera size={13} className={colors.pillIcon} />
                <span>Take Photo</span>
              </button>
            )}

            {/* Tap to browse button for clear mobile affordance */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!disabled) fileInputRef.current?.click();
              }}
              disabled={disabled}
              title="Browse device files"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all sm:hidden cursor-pointer"
            >
              <FolderOpen size={13} />
              <span>Browse</span>
            </button>
          </div>

          {/* User Feedback Status Badge */}
          {pasteFeedback && (
            <div
              onClick={(e) => e.stopPropagation()}
              className={`mt-3 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border shadow-xs animate-in fade-in slide-in-from-top-1 duration-200 ${pasteFeedback.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                : pasteFeedback.type === "info"
                  ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800"
                  : "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                }`}
            >
              {pasteFeedback.type === "success" ? (
                <Check size={12} className="text-emerald-500 shrink-0" />
              ) : (
                <AlertCircle size={12} className="text-amber-500 shrink-0" />
              )}
              <span>{pasteFeedback.message}</span>
            </div>
          )}
        </div>

        {/* Optional Sample Images Grid */}
        {sampleImages && sampleImages.length > 0 && onSampleSelect && (
          <div className="w-full max-w-2xl mt-4 sm:mt-5 pt-1">
            <div className="flex items-center justify-between mb-2.5 px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                <Sparkles size={12} /> Or Try a Sample Image
              </span>
              <span className="text-[10px] text-slate-400">1-click test</span>
            </div>

            <div
              className={`grid gap-4 sm:gap-3 ${getSampleGridClass(sampleImageColumn, sampleImages.length)}`}
            >
              {sampleImages.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSampleSelect(sample.url)}
                  className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161b22] hover:border-slate-400 dark:hover:border-slate-600 hover:shadow-md transition-all text-left flex flex-col p-1.5 w-full max-w-[200px]"
                >
                  <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-900">
                    <img
                      src={sample.url}
                      alt={sample.label}
                      crossOrigin="anonymous"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    {sample.badge && (
                      <span className="absolute top-1 right-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-xs text-white">
                        {sample.badge}
                      </span>
                    )}
                  </div>
                  <div className="p-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate flex items-center justify-between">
                      <span>{sample.label}</span>
                      <ArrowUpRight
                        size={11}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 shrink-0"
                      />
                    </div>
                    {sample.description && (
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                        {sample.description}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Built-in CameraCaptureModal Portal */}
      {isCameraOpen && (
        <CameraCaptureModal
          onClose={() => setIsCameraOpen(false)}
          onCapture={handleCameraCapture}
        />
      )}
    </>
  );
};

// Aliases for backwards compatibility
export { FileDropzoneUpload as ImageDropzoneUpload };
export type { FileDropzoneUploadProps as ImageDropzoneUploadProps };
