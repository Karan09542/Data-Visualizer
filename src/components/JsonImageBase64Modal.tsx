import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Image as ImageIcon,
  Upload,
  Trash2,
  Plus,
  X,
  Sparkles,
  ListPlus,
  Key,
  RefreshCw,
  RotateCcw,
  Eye,
  Download,
} from 'lucide-react';
import MediaCarousel from './MediaCarousel';

export interface ConvertedImage {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  dataUrl: string;
  base64: string;
  dimensions?: { width: number; height: number };
}

export interface ExistingImageItem {
  id: string;
  originalValue: string;
  dataUrl: string;
  approxSize: number;
  dimensions?: { width: number; height: number };
}

interface JsonImageBase64ModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentJson: string;
  initialFiles?: File[];
  cursorPosition: { lineNumber: number; column: number } | null;
  onInsertAtCursor: (text: string) => void;
  onUpdateFullJson: (newJson: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isLikelyBase64Image(val: unknown): boolean {
  if (typeof val !== 'string') return false;
  const s = val.trim();
  if (s.length < 20) return false;
  if (s.startsWith('data:image/')) return true;
  if (
    s.startsWith('/9j/') || // JPEG
    s.startsWith('iVBORw') || // PNG
    s.startsWith('R0lGOD') || // GIF
    s.startsWith('UklGR') || // WebP
    s.startsWith('PHN2Zy') || // SVG
    s.startsWith('PD94bW') || // SVG XML
    s.startsWith('Qk0') || // BMP
    s.startsWith('AAABAA') // ICO
  ) {
    return true;
  }
  // Generic base64 image strings
  if (s.length >= 80 && /^[A-Za-z0-9+/=\r\n]+$/.test(s)) {
    return true;
  }
  return false;
}

export function toDisplayableDataUrl(str: string): string {
  if (!str || typeof str !== 'string') return '';
  const s = str.trim();
  if (s.startsWith('data:image/')) return s;
  if (s.startsWith('/9j/')) return `data:image/jpeg;base64,${s}`;
  if (s.startsWith('iVBORw')) return `data:image/png;base64,${s}`;
  if (s.startsWith('R0lGOD')) return `data:image/gif;base64,${s}`;
  if (s.startsWith('UklGR')) return `data:image/webp;base64,${s}`;
  if (s.startsWith('PHN2Zy') || s.startsWith('PD94bW')) return `data:image/svg+xml;base64,${s}`;
  if (s.startsWith('Qk0')) return `data:image/bmp;base64,${s}`;
  return `data:image/jpeg;base64,${s}`;
}

function extractExistingImages(
  jsonStr: string,
  targetMode: 'key' | 'cursor' | 'existing_array',
  keyName: string,
  activeObjectTarget: 'root' | 'chat_message',
  chatMessageIndex: number,
  selectedArrayPath: string
): { items: ExistingImageItem[]; isTargetArray: boolean; targetExists: boolean } {
  if (targetMode === 'cursor') {
    return { items: [], isTargetArray: false, targetExists: false };
  }

  let parsed: any = null;
  try {
    parsed = JSON.parse(jsonStr || '{}');
    if (typeof parsed !== 'object' || parsed === null) {
      return { items: [], isTargetArray: false, targetExists: false };
    }
  } catch {
    return { items: [], isTargetArray: false, targetExists: false };
  }

  let targetVal: any = undefined;
  let targetExists = false;

  if (targetMode === 'existing_array') {
    const path = selectedArrayPath.trim();
    if (path.startsWith('messages[') && Array.isArray(parsed.messages)) {
      const idx = chatMessageIndex >= 0 ? chatMessageIndex : 0;
      const targetMsg = parsed.messages[idx];
      if (targetMsg && 'images' in targetMsg) {
        targetVal = targetMsg.images;
        targetExists = true;
      }
    } else if (path && path in parsed) {
      targetVal = parsed[path];
      targetExists = true;
    }
  } else {
    // Key mode
    const key = keyName.trim();
    if (!key) return { items: [], isTargetArray: false, targetExists: false };

    if (activeObjectTarget === 'chat_message' && Array.isArray(parsed.messages)) {
      const idx = chatMessageIndex >= 0 ? chatMessageIndex : 0;
      const targetMsg = parsed.messages[idx];
      if (targetMsg && key in targetMsg) {
        targetVal = targetMsg[key];
        targetExists = true;
      }
    } else if (key in parsed) {
      targetVal = parsed[key];
      targetExists = true;
    }
  }

  if (!targetExists || targetVal === undefined || targetVal === null) {
    return { items: [], isTargetArray: false, targetExists: false };
  }

  const isTargetArray = Array.isArray(targetVal);
  const rawItems: string[] = [];

  if (Array.isArray(targetVal)) {
    targetVal.forEach((item) => {
      if (typeof item === 'string' && isLikelyBase64Image(item)) {
        rawItems.push(item);
      }
    });
  } else if (typeof targetVal === 'string' && isLikelyBase64Image(targetVal)) {
    rawItems.push(targetVal);
  }

  const items = rawItems.map((rawStr, idx) => ({
    id: `existing-${idx}-${rawStr.slice(0, 10)}`,
    originalValue: rawStr,
    dataUrl: toDisplayableDataUrl(rawStr),
    approxSize: Math.round((rawStr.length * 3) / 4),
  }));

  return { items, isTargetArray, targetExists };
}

export default function JsonImageBase64Modal({
  isOpen,
  onClose,
  currentJson,
  initialFiles,
  cursorPosition: _cursorPosition,
  onInsertAtCursor,
  onUpdateFullJson,
}: JsonImageBase64ModalProps) {
  const [images, setImages] = useState<ConvertedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [useRawBase64, setUseRawBase64] = useState(true);
  const [targetMode, setTargetMode] = useState<'cursor' | 'key' | 'existing_array'>('key');
  const [keyName, setKeyName] = useState('images');
  const [valueType, setValueType] = useState<'array' | 'string'>('array');
  const [selectedArrayPath, setSelectedArrayPath] = useState('');
  const [activeObjectTarget, setActiveObjectTarget] = useState<'root' | 'chat_message'>('root');

  // Existing image state
  const [existingImages, setExistingImages] = useState<ExistingImageItem[]>([]);
  const [existingMode, setExistingMode] = useState<'append' | 'replace'>('append');
  const [existingImagesModified, setExistingImagesModified] = useState(false);
  const [_targetExistsInJson, setTargetExistsInJson] = useState(false);
  const [targetIsArrayInJson, setTargetIsArrayInJson] = useState(false);
  const lastTargetRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carousel preview state
  const [carouselIndex, setCarouselIndex] = useState<number | null>(null);
  const [carouselSource, setCarouselSource] = useState<'existing' | 'uploaded'>('existing');

  const isDark = typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true;

  // Process incoming File objects into ConvertedImage
  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileArr.length === 0) return;

    setIsProcessing(true);
    let completed = 0;
    const newItems: ConvertedImage[] = [];

    fileArr.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = (e.target?.result as string) || '';
        const base64 = dataUrl.split(',')[1] || '';

        const img = new Image();
        img.onload = () => {
          newItems.push({
            id: Math.random().toString(36).substring(2, 9),
            file,
            fileName: file.name,
            fileSize: file.size,
            dataUrl,
            base64,
            dimensions: { width: img.width, height: img.height },
          });
          completed++;
          if (completed === fileArr.length) {
            setImages((prev) => [...prev, ...newItems]);
            setIsProcessing(false);
          }
        };
        img.onerror = () => {
          newItems.push({
            id: Math.random().toString(36).substring(2, 9),
            file,
            fileName: file.name,
            fileSize: file.size,
            dataUrl,
            base64,
          });
          completed++;
          if (completed === fileArr.length) {
            setImages((prev) => [...prev, ...newItems]);
            setIsProcessing(false);
          }
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  }, []);

  // Process initialFiles when opened
  useEffect(() => {
    if (isOpen && initialFiles && initialFiles.length > 0) {
      processFiles(initialFiles);
    }
  }, [isOpen, initialFiles, processFiles]);

  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      setImages([]);
      setTargetMode('key');
      setKeyName('images');
      setValueType('array');
      setExistingImages([]);
      setExistingImagesModified(false);
      setCarouselIndex(null);
      lastTargetRef.current = '';
    }
  }, [isOpen]);

  // Scan current JSON for existing arrays and chat message structures
  const jsonAnalysis = useMemo(() => {
    let parsed: any = null;
    let isValid = false;
    const detectedArrays: { path: string; label: string; count: number }[] = [];
    let hasChatMessages = false;
    let chatMessageIndex = -1;

    try {
      parsed = JSON.parse(currentJson || '{}');
      isValid = typeof parsed === 'object' && parsed !== null;
    } catch {
      isValid = false;
    }

    if (isValid && parsed) {
      if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        Object.entries(parsed).forEach(([k, v]) => {
          if (Array.isArray(v)) {
            detectedArrays.push({
              path: k,
              label: `${k} (current: ${v.length} items)`,
              count: v.length,
            });
          }
        });

        // Check for Ollama/OpenAI messages array
        if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
          hasChatMessages = true;
          let userIdx = -1;
          for (let i = parsed.messages.length - 1; i >= 0; i--) {
            if (parsed.messages[i]?.role === 'user') {
              userIdx = i;
              break;
            }
          }
          chatMessageIndex = userIdx !== -1 ? userIdx : parsed.messages.length - 1;

          const targetMsg = parsed.messages[chatMessageIndex];
          if (targetMsg && Array.isArray(targetMsg.images)) {
            detectedArrays.push({
              path: `messages[${chatMessageIndex}].images`,
              label: `messages[${chatMessageIndex}].images (current: ${targetMsg.images.length} items)`,
              count: targetMsg.images.length,
            });
          }
        }
      }
    }

    return {
      isValid,
      parsed,
      detectedArrays,
      hasChatMessages,
      chatMessageIndex,
    };
  }, [currentJson]);

  // Auto-select detected array if available and user switches to existing_array
  useEffect(() => {
    if (jsonAnalysis.detectedArrays.length > 0 && !selectedArrayPath) {
      const match = jsonAnalysis.detectedArrays.find((a) => a.path.includes('images')) || jsonAnalysis.detectedArrays[0];
      setSelectedArrayPath(match.path);
    }
  }, [jsonAnalysis.detectedArrays, selectedArrayPath]);

  // Auto-switch valueType to array when multiple images are loaded
  useEffect(() => {
    if (images.length > 1) {
      setValueType('array');
    }
  }, [images.length]);

  // Sync existing images whenever target mode, key name, target object, or array path changes
  const targetId = `${targetMode}:${targetMode === 'key' ? `${activeObjectTarget}:${keyName.trim()}` : selectedArrayPath.trim()}`;

  useEffect(() => {
    if (!isOpen) {
      lastTargetRef.current = '';
      setExistingImages([]);
      setExistingImagesModified(false);
      setTargetExistsInJson(false);
      setTargetIsArrayInJson(false);
      return;
    }

    if (lastTargetRef.current !== targetId) {
      lastTargetRef.current = targetId;
      const { items, isTargetArray, targetExists } = extractExistingImages(
        currentJson,
        targetMode,
        keyName,
        activeObjectTarget,
        jsonAnalysis.chatMessageIndex,
        selectedArrayPath
      );
      setExistingImages(items);
      setExistingImagesModified(false);
      setTargetExistsInJson(targetExists);
      setTargetIsArrayInJson(isTargetArray);
      if (items.length > 0) {
        setExistingMode('append');
        setValueType('array');
      } else if (isTargetArray) {
        setValueType('array');
      }
    }
  }, [
    isOpen,
    targetId,
    currentJson,
    targetMode,
    keyName,
    activeObjectTarget,
    jsonAnalysis.chatMessageIndex,
    selectedArrayPath,
  ]);

  // Asynchronously resolve image dimensions for existing images
  const existingIdsKey = existingImages.map((i) => i.id).join(',');
  useEffect(() => {
    const missing = existingImages.filter((img) => !img.dimensions && img.dataUrl);
    if (missing.length === 0) return;

    missing.forEach((img) => {
      const tempImg = new Image();
      tempImg.onload = () => {
        setExistingImages((prev) =>
          prev.map((item) =>
            item.id === img.id
              ? { ...item, dimensions: { width: tempImg.width, height: tempImg.height } }
              : item
          )
        );
      };
      tempImg.src = img.dataUrl;
    });
  }, [existingIdsKey]);

  // Delete an existing image
  const handleDeleteExistingImage = (idToDelete: string) => {
    setExistingImages((prev) => prev.filter((img) => img.id !== idToDelete));
    setExistingImagesModified(true);
  };

  // Restore existing images from JSON
  const handleRestoreExistingImages = () => {
    const { items } = extractExistingImages(
      currentJson,
      targetMode,
      keyName,
      activeObjectTarget,
      jsonAnalysis.chatMessageIndex,
      selectedArrayPath
    );
    setExistingImages(items);
    setExistingImagesModified(false);
  };

  // Prepare items for MediaCarousel
  const carouselItems = useMemo(() => {
    if (carouselSource === 'existing') {
      return existingImages.map((img, idx) => ({
        id: img.id,
        title: `Existing Image #${idx + 1} (${keyName.trim() || 'images'})`,
        dataUrl: img.dataUrl,
        size: img.approxSize,
        dimensions: img.dimensions,
        isExisting: true,
      }));
    }
    return images.map((img) => ({
      id: img.id,
      title: img.fileName,
      dataUrl: img.dataUrl,
      size: img.fileSize,
      dimensions: img.dimensions,
      isExisting: false,
    }));
  }, [carouselSource, existingImages, images, keyName]);

  // Compute preview snippet
  const previewSnippet = useMemo(() => {
    if (images.length === 0 && !existingImagesModified) return '';

    const sampleNew = images[0] ? (useRawBase64 ? images[0].base64 : images[0].dataUrl) : '';
    const truncatedNewB64 = sampleNew
      ? sampleNew.slice(0, 32) + '… (' + formatBytes(images[0]?.fileSize || 0) + ')'
      : '';

    if (targetMode === 'cursor') {
      if (images.length > 1 || valueType === 'array') {
        return `[\n  "${truncatedNewB64}",\n  ... (${images.length} new ${images.length === 1 ? 'image' : 'images'})\n]`;
      }
      return `"${truncatedNewB64}"`;
    }

    const effectiveKey =
      targetMode === 'existing_array'
        ? selectedArrayPath.trim() || 'images'
        : keyName.trim() || 'images';

    const hasRemainingExisting = existingImages.length > 0;

    if (images.length === 0 && existingImagesModified) {
      if (!hasRemainingExisting) {
        return `"${effectiveKey}": []  // All existing images removed`;
      }
      return `"${effectiveKey}": [\n  // ${existingImages.length} remaining existing image${existingImages.length > 1 ? 's' : ''}\n  ... (${existingImages.length} items)\n]`;
    }

    if (existingMode === 'append' && hasRemainingExisting) {
      return `"${effectiveKey}": [\n  // ${existingImages.length} existing image${existingImages.length > 1 ? 's' : ''} kept\n  ... ,\n  "${truncatedNewB64}"  // + ${images.length} new image${images.length > 1 ? 's' : ''}\n]`;
    }

    if (existingMode === 'replace' && (hasRemainingExisting || existingImagesModified)) {
      return `"${effectiveKey}": [\n  // Existing array replaced entirely\n  "${truncatedNewB64}"  // ${images.length} new image${images.length > 1 ? 's' : ''}\n]`;
    }

    // Standard key insertion
    if (valueType === 'array' || images.length > 1) {
      return `"${effectiveKey}": [\n  "${truncatedNewB64}"\n]`;
    }
    return `"${effectiveKey}": "${truncatedNewB64}"`;
  }, [
    images,
    existingImages,
    existingImagesModified,
    existingMode,
    useRawBase64,
    targetMode,
    valueType,
    keyName,
    selectedArrayPath,
  ]);

  // Execute insertion / update
  const handleConfirmInsert = () => {
    if (images.length === 0 && !existingImagesModified) return;

    const newBase64Strings = images.map((img) => (useRawBase64 ? img.base64 : img.dataUrl));

    if (targetMode === 'cursor') {
      if (images.length === 0) return;
      let insertStr = '';
      if (images.length === 1 && valueType === 'string') {
        insertStr = `"${newBase64Strings[0]}"`;
      } else {
        insertStr = JSON.stringify(newBase64Strings, null, 2);
      }
      onInsertAtCursor(insertStr);
      onClose();
      return;
    }

    let parsed: any = {};
    try {
      parsed = JSON.parse(currentJson || '{}');
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        parsed = {};
      }
    } catch {
      parsed = {};
    }

    let finalStrings: string[] = [];
    if (existingMode === 'replace') {
      finalStrings = [...newBase64Strings];
    } else {
      const remainingExisting = existingImages.map((e) => e.originalValue);
      finalStrings = [...remainingExisting, ...newBase64Strings];
    }

    const shouldBeArray =
      valueType === 'array' ||
      finalStrings.length > 1 ||
      targetIsArrayInJson ||
      (existingImages.length > 0 && valueType !== 'string');

    const payload = shouldBeArray
      ? finalStrings
      : finalStrings.length === 1
      ? finalStrings[0]
      : valueType === 'string'
      ? ''
      : [];

    if (targetMode === 'existing_array') {
      const path = selectedArrayPath.trim() || 'images';
      if (path.startsWith('messages[') && jsonAnalysis.hasChatMessages) {
        const msgIdx = jsonAnalysis.chatMessageIndex >= 0 ? jsonAnalysis.chatMessageIndex : 0;
        if (parsed.messages && parsed.messages[msgIdx]) {
          parsed.messages[msgIdx].images = finalStrings;
        }
      } else {
        parsed[path] = finalStrings;
      }
    } else {
      // Key mode
      const targetKey = keyName.trim() || 'images';
      if (activeObjectTarget === 'chat_message' && jsonAnalysis.hasChatMessages) {
        const msgIdx = jsonAnalysis.chatMessageIndex >= 0 ? jsonAnalysis.chatMessageIndex : 0;
        if (parsed.messages && parsed.messages[msgIdx]) {
          parsed.messages[msgIdx][targetKey] = payload;
        } else {
          parsed[targetKey] = payload;
        }
      } else {
        parsed[targetKey] = payload;
      }
    }

    const formatted = JSON.stringify(parsed, null, 2);
    onUpdateFullJson(formatted);
    onClose();
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[10010] flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full h-[100dvh] sm:h-auto sm:max-h-[92vh] max-w-full sm:max-w-xl flex flex-col rounded-none sm:rounded-2xl border-0 sm:border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <ImageIcon size={17} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                Insert Image as Base64
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium">
                  Ollama & Vision LLMs
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Upload image(s) to convert into Base64 and insert directly into JSON payload
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3.5 sm:space-y-4 text-xs">
          {/* File Upload Drop Area */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) processFiles(e.target.files);
                e.target.value = '';
              }}
            />

            {images.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
                }}
                className="flex flex-col items-center justify-center py-7 px-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-purple-50/30 dark:hover:bg-purple-950/10 hover:border-purple-400 dark:hover:border-purple-500/50 transition-all cursor-pointer group"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform mb-2">
                  <Upload size={18} />
                </div>
                <div className="text-center">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Click to select image(s)
                  </span>{' '}
                  <span className="text-slate-500">or drag & drop</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Supports multiple images · PNG, JPG, WEBP, GIF, SVG
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Selected Images ({images.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                  >
                    <Plus size={12} /> Add more
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1">
                  {images.map((img, idx) => (
                    <div
                      key={img.id}
                      onClick={() => {
                        setCarouselSource('uploaded');
                        setCarouselIndex(idx);
                      }}
                      className="group/card flex items-center gap-2.5 p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:border-purple-400 dark:hover:border-purple-500/50 hover:bg-purple-50/20 dark:hover:bg-purple-950/20 transition-all cursor-pointer"
                    >
                      <div className="relative h-10 w-10 shrink-0 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <img
                          src={img.dataUrl}
                          alt={img.fileName}
                          className="h-full w-full object-cover group-hover/card:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <Eye size={12} />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className="truncate font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200"
                          title={img.fileName}
                        >
                          {img.fileName}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <span>{formatBytes(img.fileSize)}</span>
                          {img.dimensions && (
                            <>
                              <span>·</span>
                              <span>
                                {img.dimensions.width}×{img.dimensions.height}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImages(images.filter((_, i) => i !== idx));
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                        title="Remove image"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Base64 Format Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
            <div>
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                Raw Base64 string
                <span className="ml-1.5 text-[10px] font-normal text-emerald-600 dark:text-emerald-400 font-mono">
                  (Ollama Standard)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {useRawBase64
                  ? 'Strips data:image/*;base64, prefix so Ollama receives clean raw base64'
                  : 'Includes full data URI scheme (data:image/png;base64,...)'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={useRawBase64}
              onClick={() => setUseRawBase64(!useRawBase64)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                useRawBase64 ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  useRawBase64 ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Target Insertion Mode */}
          <div className="space-y-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Where to insert in JSON?
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTargetMode('key')}
                className={`flex flex-col text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                  targetMode === 'key'
                    ? 'border-purple-500 bg-purple-500/10 text-purple-900 dark:text-purple-200 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <Key size={13} className="text-purple-500" />
                  <span>Key-Value Pair</span>
                </div>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-1">
                  Add as key (e.g. "images": [...])
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTargetMode('cursor')}
                className={`flex flex-col text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                  targetMode === 'cursor'
                    ? 'border-purple-500 bg-purple-500/10 text-purple-900 dark:text-purple-200 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <Sparkles size={13} className="text-purple-500" />
                  <span>At Active Cursor</span>
                </div>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-1">
                  Insert directly at cursor location
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTargetMode('existing_array')}
                className={`flex flex-col text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                  targetMode === 'existing_array'
                    ? 'border-purple-500 bg-purple-500/10 text-purple-900 dark:text-purple-200 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <ListPlus size={13} className="text-purple-500" />
                  <span>Existing Array</span>
                </div>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-1">
                  Append to an existing array
                </p>
              </button>
            </div>
          </div>

          {/* Mode Configuration Details */}
          {targetMode === 'key' && (
            <div className="space-y-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              {/* Key Name Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Key Name
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    placeholder="images"
                    className="flex-1 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 font-mono text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-purple-500"
                  />
                  <div className="flex items-center gap-1 text-[11px]">
                    {['images', 'image', 'picture'].map((suggested) => (
                      <button
                        key={suggested}
                        type="button"
                        onClick={() => {
                          setKeyName(suggested);
                          setValueType(suggested === 'images' ? 'array' : 'string');
                        }}
                        className={`px-2 py-1 rounded-md font-mono transition-colors cursor-pointer ${
                          keyName === suggested
                            ? 'bg-purple-600 text-white font-semibold'
                            : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300'
                        }`}
                      >
                        {suggested}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Value type selection: string or array */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Value Format
                  </span>
                  <p className="text-[10.5px] text-slate-500">
                    {images.length > 1 || existingImages.length > 1
                      ? 'Multiple images use array format: "images": ["..."]'
                      : 'Ollama models expect an array of strings: "images": ["..."]'}
                  </p>
                </div>
                <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-900 shrink-0">
                  <button
                    type="button"
                    disabled={images.length > 1 || existingImages.length > 1}
                    onClick={() => setValueType('string')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                      valueType === 'string'
                        ? 'bg-white text-purple-600 shadow-sm dark:bg-slate-800 dark:text-purple-400 font-semibold'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                    } ${images.length > 1 || existingImages.length > 1 ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    String "..."
                  </button>
                  <button
                    type="button"
                    onClick={() => setValueType('array')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                      valueType === 'array'
                        ? 'bg-white text-purple-600 shadow-sm dark:bg-slate-800 dark:text-purple-400 font-semibold'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                    }`}
                  >
                    Array string[]
                  </button>
                </div>
              </div>

              {/* Target placement if chat messages detected */}
              {jsonAnalysis.hasChatMessages && (
                <div className="space-y-1.5 pt-1 border-t border-slate-200 dark:border-slate-800">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Target Object
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveObjectTarget('root')}
                      className={`flex-1 py-1.5 px-2 rounded-lg border text-left font-mono text-[11px] transition-all cursor-pointer ${
                        activeObjectTarget === 'root'
                          ? 'border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-300 font-semibold'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Root Object &#123; "model": ... &#125;
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveObjectTarget('chat_message')}
                      className={`flex-1 py-1.5 px-2 rounded-lg border text-left font-mono text-[11px] transition-all cursor-pointer ${
                        activeObjectTarget === 'chat_message'
                          ? 'border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-300 font-semibold'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Inside messages[{jsonAnalysis.chatMessageIndex}]
                    </button>
                  </div>
                </div>
              )}

              {/* Existing Images & Array Push vs Replace Section */}
              {(existingImages.length > 0 || existingImagesModified) && (
                <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                        Existing Base64 in{' '}
                        <span className="font-mono text-purple-600 dark:text-purple-400">
                          "{keyName.trim() || 'images'}"
                        </span>
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold">
                        {existingImages.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {existingImagesModified && (
                        <button
                          type="button"
                          onClick={handleRestoreExistingImages}
                          className="inline-flex items-center gap-1 text-[10.5px] font-medium text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                          title="Restore original images from JSON"
                        >
                          <RotateCcw size={11} /> Restore
                        </button>
                      )}
                      {existingImages.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setExistingImages([]);
                            setExistingImagesModified(true);
                          }}
                          className="inline-flex items-center gap-1 text-[10.5px] font-medium text-rose-500 hover:underline cursor-pointer"
                          title="Remove all existing images from this key"
                        >
                          <Trash2 size={11} /> Clear all
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Existing Images Grid */}
                  {existingImages.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1">
                      {existingImages.map((img, idx) => (
                        <div
                          key={img.id}
                          onClick={() => {
                            setCarouselSource('existing');
                            setCarouselIndex(idx);
                          }}
                          className="group/card flex items-center gap-2.5 p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-xs hover:border-purple-400 dark:hover:border-purple-500/50 hover:bg-purple-50/20 dark:hover:bg-purple-950/20 transition-all cursor-pointer"
                          title="Click to preview in fullscreen carousel"
                        >
                          <div className="relative h-10 w-10 shrink-0 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <img
                              src={img.dataUrl}
                              alt={`Existing ${idx + 1}`}
                              className="h-full w-full object-cover group-hover/card:scale-105 transition-transform"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                            <ImageIcon size={14} className="text-slate-400 absolute pointer-events-none -z-0" />
                            <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <Eye size={12} />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                              <span>Existing #{idx + 1}</span>
                              <Eye size={10} className="text-purple-500 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <span>{formatBytes(img.approxSize)}</span>
                              {img.dimensions ? (
                                <>
                                  <span>·</span>
                                  <span>
                                    {img.dimensions.width}×{img.dimensions.height}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span>·</span>
                                  <span>Base64</span>
                                </>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteExistingImage(img.id);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                            title="Delete this image from JSON"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg border border-dashed border-amber-300 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 text-[11px] flex items-center justify-between">
                      <span>All existing images will be removed when applying changes.</span>
                      <button
                        type="button"
                        onClick={handleRestoreExistingImages}
                        className="text-[10.5px] font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                      >
                        Undo / Restore
                      </button>
                    </div>
                  )}

                  {/* Array Action Choice: Push into Existing Array vs Replace Entirely */}
                  {images.length > 0 && (
                    <div className="space-y-1.5 pt-1.5 border-t border-slate-200/80 dark:border-slate-800/80">
                      <label className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-300">
                        Array Action
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setExistingMode('append')}
                          className={`flex items-start gap-2 p-2 rounded-lg border text-left transition-all cursor-pointer ${
                            existingMode === 'append'
                              ? 'border-purple-500 bg-purple-500/10 text-purple-900 dark:text-purple-200 font-semibold shadow-xs'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                          }`}
                        >
                          <div
                            className={`p-1 rounded-md mt-0.5 ${
                              existingMode === 'append'
                                ? 'bg-purple-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            }`}
                          >
                            <Plus size={12} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] leading-tight font-medium">
                              Push into Existing Array
                            </div>
                            <div className="text-[9.5px] text-slate-400 font-normal mt-0.5">
                              Keep {existingImages.length} existing & append new
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setExistingMode('replace')}
                          className={`flex items-start gap-2 p-2 rounded-lg border text-left transition-all cursor-pointer ${
                            existingMode === 'replace'
                              ? 'border-purple-500 bg-purple-500/10 text-purple-900 dark:text-purple-200 font-semibold shadow-xs'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                          }`}
                        >
                          <div
                            className={`p-1 rounded-md mt-0.5 ${
                              existingMode === 'replace'
                                ? 'bg-purple-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            }`}
                          >
                            <RefreshCw size={12} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] leading-tight font-medium">
                              Replace Entirely
                            </div>
                            <div className="text-[9.5px] text-slate-400 font-normal mt-0.5">
                              Overwrite existing with new
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {targetMode === 'existing_array' && (
            <div className="space-y-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Select Existing Array in JSON
              </label>
              {jsonAnalysis.detectedArrays.length > 0 ? (
                <div className="space-y-1.5">
                  {jsonAnalysis.detectedArrays.map((arr) => (
                    <button
                      key={arr.path}
                      type="button"
                      onClick={() => setSelectedArrayPath(arr.path)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg border text-left font-mono text-xs transition-all cursor-pointer ${
                        selectedArrayPath === arr.path
                          ? 'border-purple-500 bg-purple-500/10 text-purple-900 dark:text-purple-200 font-semibold'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <span>{arr.path}</span>
                      <span className="text-[10.5px] text-slate-400 font-sans">
                        {arr.count} existing items
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  <input
                    type="text"
                    value={selectedArrayPath}
                    onChange={(e) => setSelectedArrayPath(e.target.value)}
                    placeholder="e.g. images"
                    className="w-full h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 font-mono text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-purple-500"
                  />
                  <p className="text-[10.5px] text-amber-600 dark:text-amber-400">
                    No array found in root object; will create array at this key if missing.
                  </p>
                </div>
              )}

              {/* Existing Images & Array Action for existing_array mode */}
              {(existingImages.length > 0 || existingImagesModified) && (
                <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                        Existing Images in{' '}
                        <span className="font-mono text-purple-600 dark:text-purple-400">
                          "{selectedArrayPath || 'array'}"
                        </span>
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold">
                        {existingImages.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {existingImagesModified && (
                        <button
                          type="button"
                          onClick={handleRestoreExistingImages}
                          className="inline-flex items-center gap-1 text-[10.5px] font-medium text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                        >
                          <RotateCcw size={11} /> Restore
                        </button>
                      )}
                      {existingImages.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setExistingImages([]);
                            setExistingImagesModified(true);
                          }}
                          className="inline-flex items-center gap-1 text-[10.5px] font-medium text-rose-500 hover:underline cursor-pointer"
                        >
                          <Trash2 size={11} /> Clear all
                        </button>
                      )}
                    </div>
                  </div>

                  {existingImages.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1">
                      {existingImages.map((img, idx) => (
                        <div
                          key={img.id}
                          onClick={() => {
                            setCarouselSource('existing');
                            setCarouselIndex(idx);
                          }}
                          className="group/card flex items-center gap-2.5 p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-xs hover:border-purple-400 dark:hover:border-purple-500/50 hover:bg-purple-50/20 dark:hover:bg-purple-950/20 transition-all cursor-pointer"
                          title="Click to preview in fullscreen carousel"
                        >
                          <div className="relative h-10 w-10 shrink-0 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <img
                              src={img.dataUrl}
                              alt={`Existing ${idx + 1}`}
                              className="h-full w-full object-cover group-hover/card:scale-105 transition-transform"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                            <ImageIcon size={14} className="text-slate-400 absolute pointer-events-none -z-0" />
                            <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <Eye size={12} />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                              <span>Existing #{idx + 1}</span>
                              <Eye size={10} className="text-purple-500 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <span>{formatBytes(img.approxSize)}</span>
                              {img.dimensions ? (
                                <>
                                  <span>·</span>
                                  <span>
                                    {img.dimensions.width}×{img.dimensions.height}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span>·</span>
                                  <span>Base64</span>
                                </>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteExistingImage(img.id);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                            title="Delete this image"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg border border-dashed border-amber-300 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 text-[11px] flex items-center justify-between">
                      <span>All existing images will be removed when applying changes.</span>
                      <button
                        type="button"
                        onClick={handleRestoreExistingImages}
                        className="text-[10.5px] font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                      >
                        Undo / Restore
                      </button>
                    </div>
                  )}

                  {images.length > 0 && (
                    <div className="space-y-1.5 pt-1.5 border-t border-slate-200/80 dark:border-slate-800/80">
                      <label className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-300">
                        Array Action
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setExistingMode('append')}
                          className={`flex items-start gap-2 p-2 rounded-lg border text-left transition-all cursor-pointer ${
                            existingMode === 'append'
                              ? 'border-purple-500 bg-purple-500/10 text-purple-900 dark:text-purple-200 font-semibold shadow-xs'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                          }`}
                        >
                          <div
                            className={`p-1 rounded-md mt-0.5 ${
                              existingMode === 'append'
                                ? 'bg-purple-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            }`}
                          >
                            <Plus size={12} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] leading-tight font-medium">
                              Push into Existing Array
                            </div>
                            <div className="text-[9.5px] text-slate-400 font-normal mt-0.5">
                              Keep {existingImages.length} existing & append new
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setExistingMode('replace')}
                          className={`flex items-start gap-2 p-2 rounded-lg border text-left transition-all cursor-pointer ${
                            existingMode === 'replace'
                              ? 'border-purple-500 bg-purple-500/10 text-purple-900 dark:text-purple-200 font-semibold shadow-xs'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                          }`}
                        >
                          <div
                            className={`p-1 rounded-md mt-0.5 ${
                              existingMode === 'replace'
                                ? 'bg-purple-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            }`}
                          >
                            <RefreshCw size={12} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] leading-tight font-medium">
                              Replace Entirely
                            </div>
                            <div className="text-[9.5px] text-slate-400 font-normal mt-0.5">
                              Overwrite existing with new
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {targetMode === 'cursor' && (
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Cursor Format
                </span>
                <p className="text-[10.5px] text-slate-500">
                  {images.length > 1
                    ? 'Will insert array of base64 strings'
                    : 'Choose string or array format'}
                </p>
              </div>
              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-900 shrink-0">
                <button
                  type="button"
                  disabled={images.length > 1}
                  onClick={() => setValueType('string')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                    valueType === 'string'
                      ? 'bg-white text-purple-600 shadow-sm dark:bg-slate-800 dark:text-purple-400 font-semibold'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  } ${images.length > 1 ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  String "..."
                </button>
                <button
                  type="button"
                  onClick={() => setValueType('array')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                    valueType === 'array'
                      ? 'bg-white text-purple-600 shadow-sm dark:bg-slate-800 dark:text-purple-400 font-semibold'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                >
                  Array [...]
                </button>
              </div>
            </div>
          )}

          {/* Insertion Preview Snippet */}
          {(images.length > 0 || existingImagesModified) && (
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Insertion Preview:
              </span>
              <pre className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900 text-purple-300 font-mono text-[10.5px] leading-relaxed overflow-x-auto whitespace-pre">
                {previewSnippet}
              </pre>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex shrink-0 items-center justify-between px-4 sm:px-5 py-3 pb-6 sm:pb-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={(images.length === 0 && !existingImagesModified) || isProcessing}
            onClick={handleConfirmInsert}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white shadow-md transition-all ${
              (images.length === 0 && !existingImagesModified) || isProcessing
                ? 'bg-purple-400/50 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-500 active:scale-98 shadow-purple-500/20 cursor-pointer'
            }`}
          >
            <Sparkles size={13} />
            <span>
              {images.length > 0
                ? `Insert ${images.length} Image${images.length > 1 ? 's' : ''} into JSON`
                : existingImagesModified
                ? `Save Changes (${existingImages.length} Image${existingImages.length === 1 ? '' : 's'} in JSON)`
                : 'Insert Image into JSON'}
            </span>
          </button>
        </div>
      </div>

      {/* Media Carousel Preview */}
      <MediaCarousel
        isOpen={carouselIndex !== null}
        onClose={() => setCarouselIndex(null)}
        items={carouselItems}
        selectedIndex={carouselIndex ?? 0}
        onIndexChange={(newIdx) => setCarouselIndex(newIdx)}
        isDark={isDark}
        keepMounted={false}
        renderHeaderMiddle={(item, index, total) => (
          <div className="text-center px-2">
            <p className="text-sm sm:text-base font-bold text-white truncate max-w-[280px] sm:max-w-[420px]">
              {item.title}
            </p>
            <div className="flex items-center justify-center gap-2 text-white/70 text-[10px] sm:text-xs font-mono mt-0.5">
              <span>{formatBytes(item.size)}</span>
              {item.dimensions && (
                <>
                  <span className="w-1 h-1 rounded-full bg-white/40 shrink-0" />
                  <span>
                    {item.dimensions.width}×{item.dimensions.height}
                  </span>
                </>
              )}
              <span className="w-1 h-1 rounded-full bg-white/40 shrink-0" />
              <span className="font-semibold text-purple-300">
                {index + 1} / {total}
              </span>
            </div>
          </div>
        )}
        renderHeaderRight={(item, index) => (
          <div className="flex items-center gap-2">
            {item.isExisting && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteExistingImage(item.id);
                  if (carouselItems.length <= 1) {
                    setCarouselIndex(null);
                  } else if (index >= carouselItems.length - 1) {
                    setCarouselIndex(Math.max(0, index - 1));
                  }
                }}
                className="p-2 sm:px-3 sm:py-2 rounded-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                title="Delete this image from JSON"
              >
                <Trash2 size={14} />
                <span className="hidden sm:inline">Delete</span>
              </button>
            )}
            <a
              href={item.dataUrl}
              download={item.title.toLowerCase().replace(/[^a-z0-9]/g, '_') + '.png'}
              onClick={(e) => e.stopPropagation()}
              className="p-2 sm:px-3 sm:py-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
              title="Download image"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Download</span>
            </a>
          </div>
        )}
        renderItem={(item) => (
          <div className="w-full h-full flex items-center justify-center p-3 sm:p-6 select-none">
            <img
              src={item.dataUrl}
              alt={item.title}
              className="max-h-[82vh] max-w-[92vw] object-contain rounded-xl shadow-2xl border border-white/10"
            />
          </div>
        )}
      />
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
