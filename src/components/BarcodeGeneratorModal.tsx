import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Copy, Check, Barcode, QrCode, Image as ImageIcon, Upload, Trash2, Maximize2, Minimize2, AlertTriangle, HelpCircle, Sparkles, Camera, Settings, Loader2, ScanLine, ExternalLink } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { QRCodeSVG } from 'qrcode.react';
import CustomSelect from './CustomSelect';
import CustomMultiSelect from './CustomMultiSelect';
import { CameraCaptureModal } from './CameraCaptureModal';
import OCRLanguageManagerModal from './OCRLanguageManagerModal';
import { recognizeText, getDownloadedLanguages } from '../services/tesseractService';
import { decodeBarcodeFromImage } from '../services/barcodeService';

interface BarcodeGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormatSpec {
  name: string;
  example: string;
  hint: string;
  validate: (val: string) => boolean;
}

const FORMAT_SPECS: Record<string, FormatSpec> = {
  CODE128: {
    name: 'Code 128',
    example: '123456789012',
    hint: 'Supports all standard ASCII text & numbers',
    validate: (val) => /^[\x00-\x7F]+$/.test(val),
  },
  CODE39: {
    name: 'Code 39',
    example: 'CODE39TEST',
    hint: 'Uppercase letters, numbers, space, -, ., $, /, +, %',
    validate: (val) => /^[0-9A-Z\-\.\ \$\/\+\%]*$/i.test(val),
  },
  EAN13: {
    name: 'EAN-13',
    example: '9780201379624',
    hint: 'Requires exactly 12 or 13 digits',
    validate: (val) => /^\d{12,13}$/.test(val),
  },
  EAN8: {
    name: 'EAN-8',
    example: '90311017',
    hint: 'Requires exactly 7 or 8 digits',
    validate: (val) => /^\d{7,8}$/.test(val),
  },
  UPC: {
    name: 'UPC',
    example: '012345678905',
    hint: 'Requires exactly 11 or 12 digits',
    validate: (val) => /^\d{11,12}$/.test(val),
  },
  ITF14: {
    name: 'ITF-14',
    example: '10012345678902',
    hint: 'Requires exactly 14 digits',
    validate: (val) => /^\d{14}$/.test(val),
  },
  MSI: {
    name: 'MSI',
    example: '1234567',
    hint: 'Numbers only (0-9)',
    validate: (val) => /^\d+$/.test(val),
  },
  pharmacode: {
    name: 'Pharmacode',
    example: '12345',
    hint: 'Numbers between 3 and 131070. Standard does not display text below.',
    validate: (val) => {
      const num = Number(val);
      return /^\d+$/.test(val) && num >= 3 && num <= 131070;
    },
  },
};

export default function BarcodeGeneratorModal({ isOpen, onClose }: BarcodeGeneratorModalProps) {
  const [mode, setMode] = useState<'barcode' | 'qrcode' | 'scan'>('barcode');
  const [value, setValue] = useState('123456789012');
  
  // Barcode specific settings
  const [barcodeFormat, setBarcodeFormat] = useState('CODE128');
  const [barWidth, setBarWidth] = useState(2);
  const [barHeight, setBarHeight] = useState(80);
  const [displayValue, setDisplayValue] = useState(true);

  // QR code specific settings
  const [qrDensity, setQrDensity] = useState<'L' | 'M' | 'Q' | 'H'>('M');
  const [qrMargin, setQrMargin] = useState(true);
  const [qrSize, setQrSize] = useState(160);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoSize, setLogoSize] = useState<number>(36);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Color settings
  const [fgColor, setFgColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');

  // Render & Error handling
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedPng, setCopiedPng] = useState(false);

  // OCR state
  const [cameraModalConfig, setCameraModalConfig] = useState<{ isOpen: boolean; initialImageSrc?: string | null }>({ isOpen: false });
  const [isOCRManagerOpen, setIsOCRManagerOpen] = useState(false);
  const [ocrLanguages, setOcrLanguages] = useState<string[]>([]);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<{ status: string; progress: number } | null>(null);
  const [downloadedLangs, setDownloadedLangs] = useState<string[]>([]);
  const [ocrPsm, setOcrPsm] = useState<string>('3');
  const [ocrOem, setOcrOem] = useState<number>(1);
  const ocrFileInputRef = useRef<HTMLInputElement>(null);

  // New Image Preview State
  const [scannedFile, setScannedFile] = useState<File | null>(null);
  const [scannedImagePreviewUrl, setScannedImagePreviewUrl] = useState<string | null>(null);

  // Scan Mode State
  const [captureMode, setCaptureMode] = useState<'ocr' | 'scan'>('ocr');
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const refreshLanguages = async () => {
    const langs = await getDownloadedLanguages();
    setDownloadedLangs(langs);
    if (langs.length > 0 && ocrLanguages.length === 0) {
      setOcrLanguages([langs[0]]);
    }
  };

  useEffect(() => {
    getDownloadedLanguages().then(langs => {
      setDownloadedLangs(langs);
      if (langs.includes('eng')) setOcrLanguages(['eng']);
      else if (langs.length > 0) setOcrLanguages([langs[0]]);
    });
  }, []);

  const handleCapture = async (file: File) => {
    // Shared state updates for both modes
    setScannedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setScannedImagePreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return objectUrl;
    });

    if (captureMode === 'scan') {
      setOcrProcessing(true);
      setScanError(null);
      setScanResult(null);
      setOcrProgress({ status: 'Scanning image for barcodes...', progress: 0.5 });
      try {
        const text = await decodeBarcodeFromImage(file);
        setScanResult(text);
      } catch (e: any) {
        setScanError(e.message || 'No barcode or QR code found in the image.');
      } finally {
        setOcrProcessing(false);
        setOcrProgress(null);
      }
      return;
    }

    // OCR Mode logic
    if (ocrLanguages.length === 0) {
       setCameraModalConfig({ isOpen: false });
       setIsOCRManagerOpen(true);
       return;
    }

    setOcrProcessing(true);
    setBarcodeError(null);
    try {
      const text = await recognizeText(file, {
        langs: ocrLanguages,
        psm: ocrPsm,
        oem: ocrOem,
        onProgress: (m) => setOcrProgress({ status: m.status, progress: m.progress })
      });
      if (text.trim()) {
        setValue(text.trim());
      } else {
        setBarcodeError('No text found in image.');
      }
    } catch (e: any) {
      console.error(e);
      setBarcodeError('Failed to extract text from image.');
    } finally {
      setOcrProcessing(false);
      setOcrProgress(null);
    }
  };

  // Re-run OCR automatically when settings change (only for OCR mode)
  useEffect(() => {
    if (scannedFile && ocrLanguages.length > 0 && captureMode === 'ocr') {
      handleCapture(scannedFile);
    }
  }, [ocrLanguages, ocrPsm, ocrOem]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (scannedImagePreviewUrl) URL.revokeObjectURL(scannedImagePreviewUrl);
    };
  }, [scannedImagePreviewUrl]);

  const handleOcrFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCameraModalConfig({ isOpen: true, initialImageSrc: event.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const barcodeFormats = [
    { label: 'Code 128 (General)', value: 'CODE128' },
    { label: 'Code 39 (Alphanumeric)', value: 'CODE39' },
    { label: 'EAN-13 (Retail)', value: 'EAN13' },
    { label: 'EAN-8 (Small Package)', value: 'EAN8' },
    { label: 'UPC (North America)', value: 'UPC' },
    { label: 'ITF-14 (Shipping)', value: 'ITF14' },
    { label: 'MSI Plessey', value: 'MSI' },
    { label: 'Pharmacode (Pharma)', value: 'pharmacode' },
  ];

  const qrDensityOptions = [
    { label: 'Low (7%)', value: 'L' },
    { label: 'Medium (15%)', value: 'M' },
    { label: 'Quartile (25%)', value: 'Q' },
    { label: 'High (30%)', value: 'H' },
  ];

  const colorPresets = [
    { name: 'Classic Black', fg: '#000000', bg: '#ffffff' },
    { name: 'Ocean Blue', fg: '#1e40af', bg: '#ffffff' },
    { name: 'Emerald', fg: '#065f46', bg: '#ffffff' },
    { name: 'Purple Neon', fg: '#6b21a8', bg: '#ffffff' },
    { name: 'Dark Mode Contrast', fg: '#ffffff', bg: '#0f172a' },
  ];

  const psmOptions = [
    { value: '1', label: 'Complex Layout (Auto + OSD)' },
    { value: '3', label: 'Standard Document (Default)' },
    { value: '4', label: 'Single Column (Magazine/List)' },
    { value: '6', label: 'Single Block (Paragraph/Book)' },
    { value: '7', label: 'Single Line (Serial/Label)' },
    { value: '8', label: 'Single Word (Captcha/Tag)' },
    { value: '11', label: 'Scattered Text (Receipts)' },
  ];

  const oemOptions = [
    { value: '0', label: 'Legacy (Fast/Retro fonts)' },
    { value: '1', label: 'Deep Learning (Accurate)' },
    { value: '3', label: 'Auto (Best available)' },
  ];

  const getSvgElement = (): SVGElement | null => {
    if (mode === 'qrcode') {
      return wrapperRef.current?.querySelector('svg') || null;
    }
    return svgRef.current;
  };

  // Safe barcode rendering function
  const renderBarcode = () => {
    if (!svgRef.current) return;
    setBarcodeError(null);

    const trimmedValue = value.trim();

    // If input is empty or whitespace-only, do not show format error
    if (!trimmedValue) {
      svgRef.current.innerHTML = '';
      return;
    }

    const spec = FORMAT_SPECS[barcodeFormat];
    if (spec && !spec.validate(trimmedValue)) {
      setBarcodeError(`Invalid format for ${spec.name}. ${spec.hint}`);
      return;
    }

    try {
      // Clear previous SVG content to avoid artifacts
      svgRef.current.innerHTML = '';
      JsBarcode(svgRef.current, trimmedValue, {
        format: barcodeFormat,
        lineColor: fgColor,
        background: bgColor === 'transparent' ? undefined : bgColor,
        width: barWidth,
        height: barHeight,
        displayValue: displayValue,
        margin: 10
      });
    } catch (err: any) {
      console.warn('Barcode render exception:', err);
      setBarcodeError(err?.message || `Failed to render ${barcodeFormat} barcode.`);
    }
  };

  // Trigger barcode render whenever relevant options change or modal opens/switches to barcode mode
  useEffect(() => {
    if (isOpen && mode === 'barcode') {
      // Use microtask / frame to ensure DOM ref is attached
      requestAnimationFrame(() => {
        renderBarcode();
      });
    }
  }, [value, barcodeFormat, barWidth, barHeight, displayValue, fgColor, bgColor, mode, isOpen, isFullscreenPreview]);

  // When format changes, if current value is invalid, auto-suggest sample value
  const handleFormatChange = (newFormat: string) => {
    setBarcodeFormat(newFormat);
    const spec = FORMAT_SPECS[newFormat];
    const trimmedValue = value.trim();
    if (trimmedValue && spec && !spec.validate(trimmedValue)) {
      setValue(spec.example);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setLogoUrl(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCopySvg = async () => {
    const svgEl = getSvgElement();
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    try {
      await navigator.clipboard.writeText(svgData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy SVG:', err);
    }
  };

  const handleCopyPng = async () => {
    const svgEl = getSvgElement();
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = async () => {
      const padding = 20;
      canvas.width = (img.width || 300) + padding * 2;
      canvas.height = (img.height || 300) + padding * 2;
      if (ctx) {
        if (bgColor !== 'transparent') {
          ctx.fillStyle = bgColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, padding, padding);
        canvas.toBlob(async (blob) => {
          if (blob) {
            try {
              await navigator.clipboard.write([
                new window.ClipboardItem({
                  'image/png': blob
                })
              ]);
              setCopiedPng(true);
              setTimeout(() => setCopiedPng(false), 2000);
            } catch (err) {
              console.error('Failed to copy PNG:', err);
            }
          }
        }, 'image/png');
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const handleDownloadSvg = () => {
    const svgEl = getSvgElement();
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filename = mode === 'qrcode' ? `qrcode-${value}.svg` : `barcode-${barcodeFormat.toLowerCase()}-${value}.svg`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPng = () => {
    const svgEl = getSvgElement();
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const padding = 20;
      canvas.width = (img.width || 300) + padding * 2;
      canvas.height = (img.height || 300) + padding * 2;
      if (ctx) {
        if (bgColor !== 'transparent') {
          ctx.fillStyle = bgColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, padding, padding);
        const pngUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = mode === 'qrcode' ? `qrcode-${value}.png` : `barcode-${barcodeFormat.toLowerCase()}-${value}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const currentSpec = FORMAT_SPECS[barcodeFormat];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white/70 dark:bg-slate-950/70 backdrop-blur-md"
            onClick={onClose}
          />

          {cameraModalConfig.isOpen && (
            <CameraCaptureModal
              onClose={() => setCameraModalConfig({ isOpen: false })}
              onCapture={handleCapture}
              initialImageSrc={cameraModalConfig.initialImageSrc}
            />
          )}
          
            <OCRLanguageManagerModal
              isOpen={isOCRManagerOpen}
              onClose={() => {
                setIsOCRManagerOpen(false);
                refreshLanguages();
              }}
              onLanguageSelected={(lang) => {
                if (!ocrLanguages.includes(lang)) {
                  setOcrLanguages(prev => [...prev, lang]);
                }
              }}
              selectedLanguage={ocrLanguages[0] || ''}
            />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 15 }}
            className="relative w-full h-[100dvh] sm:h-auto sm:max-w-2xl sm:max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 border-0 sm:border border-slate-200 dark:border-slate-800 shadow-2xl rounded-none sm:rounded-2xl overflow-hidden text-slate-900 dark:text-slate-100"
          >
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:px-6 border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur shrink-0 gap-3 sm:gap-0 relative">
              <div className="flex items-center gap-3 pr-8 sm:pr-0">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                  {mode === 'barcode' ? <Barcode size={22} /> : <QrCode size={22} />}
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">Code Studio</h2>
                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 line-clamp-1">Generate custom Barcodes and QR Codes</p>
                </div>
              </div>

              {/* Mode Switcher Tabs */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 w-full sm:w-auto mt-1 sm:mt-0">
                <button
                  onClick={() => setMode('barcode')}
                  className={`flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    mode === 'barcode'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  <Barcode size={14} /> Barcode
                </button>
                <button
                  onClick={() => setMode('qrcode')}
                  className={`flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    mode === 'qrcode'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  <QrCode size={14} /> QR Code
                </button>
                <button
                  onClick={() => setMode('scan')}
                  className={`flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    mode === 'scan'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  <ScanLine size={14} /> Scan
                </button>
              </div>

              <button
                onClick={onClose}
                className="absolute top-4 right-4 sm:relative sm:top-0 sm:right-0 p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors sm:ml-2"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content - Scrollable Grid */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar space-y-4">
              
              {/* Controls & Preview Layout */}
              {mode === 'scan' ? (
                <div className="flex flex-col h-full gap-4">
                  {/* Scan Input Actions */}
                  <div className="flex flex-row gap-3">
                    <button
                      onClick={() => {
                        setCaptureMode('scan');
                        setCameraModalConfig({ isOpen: true, initialImageSrc: null });
                      }}
                      className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-slate-600 dark:text-slate-400 group"
                    >
                      <Camera className="w-6 h-6 sm:w-8 sm:h-8 mb-1 sm:mb-2 group-hover:text-blue-500 transition-colors" />
                      <span className="font-semibold text-xs sm:text-sm group-hover:text-blue-500 transition-colors">Camera</span>
                      <span className="text-[9px] sm:text-[10px] mt-0.5 sm:mt-1 text-center hidden sm:block">Take a photo of a barcode</span>
                    </button>

                    <button
                      onClick={() => {
                        setCaptureMode('scan');
                        ocrFileInputRef.current?.click();
                      }}
                      className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all text-slate-600 dark:text-slate-400 group"
                    >
                      <Upload className="w-6 h-6 sm:w-8 sm:h-8 mb-1 sm:mb-2 group-hover:text-emerald-500 transition-colors" />
                      <span className="font-semibold text-xs sm:text-sm group-hover:text-emerald-500 transition-colors">Upload</span>
                      <span className="text-[9px] sm:text-[10px] mt-0.5 sm:mt-1 text-center hidden sm:block">Select image from device</span>
                    </button>
                    <input
                      type="file"
                      ref={ocrFileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleOcrFileUpload}
                    />
                  </div>

                  {/* Processing Indicator */}
                  {ocrProcessing && (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader2 size={32} className="animate-spin text-blue-500 mb-4" />
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{ocrProgress?.status || 'Processing...'}</span>
                    </div>
                  )}

                  {/* Scan Result */}
                  {!ocrProcessing && scanResult && (
                    <div className="flex-1 flex flex-col p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl">
                      <div className="flex items-center gap-2 mb-3 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                        <Check size={18} /> Decode Successful
                      </div>
                      
                      <div className="flex-1 bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 p-4 overflow-y-auto mb-3 whitespace-pre-wrap break-all font-mono text-sm text-slate-800 dark:text-slate-200">
                        {scanResult.match(/^https?:\/\//) ? (
                          <a href={scanResult} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center gap-1 break-all">
                            {scanResult}
                            <ExternalLink size={12} className="inline-block flex-shrink-0" />
                          </a>
                        ) : (
                          scanResult
                        )}
                      </div>

                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(scanResult);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          } catch (err) {}
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-all text-sm shadow-md"
                      >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                        {copied ? 'Copied to Clipboard!' : 'Copy Result'}
                      </button>
                    </div>
                  )}

                  {/* Scan Error */}
                  {!ocrProcessing && scanError && (
                    <div className="flex flex-col items-center justify-center py-8 px-4 text-center text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900/50">
                      <AlertTriangle size={32} className="mb-3 text-red-500" />
                      <span className="font-bold mb-1">Scan Failed</span>
                      <span className="text-sm opacity-80">{scanError}</span>
                    </div>
                  )}

                  {/* Preview of uploaded image if any */}
                  {scannedImagePreviewUrl && !ocrProcessing && (
                    <div className="mt-auto relative w-full h-40 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden group">
                      <img src={scannedImagePreviewUrl} alt="Scanned Code" className="w-full h-full object-contain" />
                      <div className="absolute inset-0 bg-black/10 sm:bg-black/40 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-end sm:items-center justify-center p-3 gap-2">
                        <button 
                          onClick={() => setCameraModalConfig({ isOpen: true, initialImageSrc: scannedImagePreviewUrl })}
                          className="px-3 py-1.5 bg-white/95 sm:bg-white text-slate-900 rounded-lg text-xs font-bold hover:bg-slate-100 shadow-md backdrop-blur-sm sm:backdrop-blur-none"
                        >
                          Edit Crop
                        </button>
                        <button 
                          onClick={() => {
                            setScannedFile(null);
                            setScannedImagePreviewUrl(null);
                            setScanResult(null);
                            setScanError(null);
                          }}
                          className="p-1.5 bg-red-500/95 sm:bg-red-500 text-white rounded-lg hover:bg-red-600 shadow-md backdrop-blur-sm sm:backdrop-blur-none"
                          title="Remove Image"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className={`grid gap-4 ${isFullscreenPreview ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                
                {/* Left Column: Format & Density Options (Hidden in Full Preview mode) */}
                {!isFullscreenPreview && (
                  <div className="space-y-3">
                  
                    {/* Value Input */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Encoded Data / Value
                        </label>
                        <div className="flex items-center gap-2">
                          {mode === 'barcode' && currentSpec && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 border-r border-slate-300 dark:border-slate-700 pr-2" title={currentSpec.hint}>
                              <HelpCircle size={10} /> {currentSpec.name}
                            </span>
                          )}
                          <div className="flex items-center gap-1">
                            <div className="w-[85px]">
                              <CustomMultiSelect
                                value={ocrLanguages}
                                onChange={setOcrLanguages}
                                options={downloadedLangs.length > 0 
                                  ? downloadedLangs.map(lang => ({ label: lang.toUpperCase(), value: lang })) 
                                  : [{ label: 'NONE', value: '' }]
                                }
                                variant="toolbar"
                                disabled={downloadedLangs.length === 0}
                                placeholder="Languages"
                              />
                            </div>
                            <button
                              onClick={() => setIsOCRManagerOpen(true)}
                              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                              title="Download & Manage OCR Languages"
                            >
                              <Download size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col space-y-2">
                        {scannedImagePreviewUrl && captureMode === 'ocr' && (
                          <div className="relative w-full h-32 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden group">
                            <img src={scannedImagePreviewUrl} alt="Scanned Document" className="w-full h-full object-contain" />
                            <div className="absolute inset-0 bg-black/10 sm:bg-black/40 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-end sm:items-center justify-center p-3 gap-2">
                              <button 
                                onClick={() => setCameraModalConfig({ isOpen: true, initialImageSrc: scannedImagePreviewUrl })}
                                className="px-3 py-1.5 bg-white/95 sm:bg-white text-slate-900 rounded-lg text-xs font-bold hover:bg-slate-100 shadow-md backdrop-blur-sm sm:backdrop-blur-none"
                              >
                                Edit Crop
                              </button>
                              <button 
                                onClick={() => {
                                  setScannedFile(null);
                                  setScannedImagePreviewUrl(null);
                                }}
                                className="p-1.5 bg-red-500/95 sm:bg-red-500 text-white rounded-lg hover:bg-red-600 shadow-md backdrop-blur-sm sm:backdrop-blur-none"
                                title="Remove Image"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        )}
                        <div className="relative">
                          <textarea
                            rows={3}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60 text-slate-900 dark:text-white font-mono text-xs shadow-inner resize-y min-h-[70px] max-h-[160px] custom-scrollbar transition-colors"
                            placeholder="Enter text or numbers to encode..."
                          />
                          {value && (
                            <button
                              onClick={() => setValue('')}
                              className="absolute top-2 right-2 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
                              title="Clear Input"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <input
                        type="file"
                        accept="image/*"
                        ref={ocrFileInputRef}
                        className="hidden"
                        onChange={handleOcrFileUpload}
                      />
                      <div className="flex gap-1.5 w-full pt-0.5">
                        <button
                          onClick={() => {
                            setCaptureMode('ocr');
                            setCameraModalConfig({ isOpen: true, initialImageSrc: null });
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 rounded-md text-[10px] font-medium transition-colors shadow-sm"
                        >
                          <Camera size={12} className="text-indigo-500 dark:text-indigo-400" /> Camera
                        </button>
                        <button
                          onClick={() => {
                            setCaptureMode('ocr');
                            ocrFileInputRef.current?.click();
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 rounded-md text-[10px] font-medium transition-colors shadow-sm"
                        >
                          <Upload size={12} className="text-emerald-500 dark:text-emerald-400" /> Upload
                        </button>
                      </div>

                      {downloadedLangs.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block" title="Page Segmentation Mode (Layout)">Text Layout</label>
                            <CustomSelect value={ocrPsm} onChange={setOcrPsm} options={psmOptions} className="w-full text-[10px]" variant="toolbar" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block" title="OCR Engine Mode">OCR Engine</label>
                            <CustomSelect value={ocrOem.toString()} onChange={(v) => setOcrOem(Number(v))} options={oemOptions} className="w-full text-[10px]" variant="toolbar" />
                          </div>
                        </div>
                      )}
                    </div>

                    {mode === 'barcode' ? (
                      <div className="space-y-2.5">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Barcode Standard
                          </label>
                          <CustomSelect
                            value={barcodeFormat}
                            options={barcodeFormats}
                            onChange={handleFormatChange}
                            className="w-full"
                          />
                          {currentSpec && (
                            <p className="text-[10px] text-slate-500 pt-0.5">{currentSpec.hint}</p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                              Bar Width: <span className="text-blue-600 dark:text-blue-400 font-mono text-[11px]">{barWidth}px</span>
                            </label>
                            <input
                              type="range"
                              min="1"
                              max="4"
                              step="1"
                              value={barWidth}
                              onChange={(e) => setBarWidth(Number(e.target.value))}
                              className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                              Height: <span className="text-blue-600 dark:text-blue-400 font-mono text-[11px]">{barHeight}px</span>
                            </label>
                            <input
                              type="range"
                              min="40"
                              max="140"
                              step="5"
                              value={barHeight}
                              onChange={(e) => setBarHeight(Number(e.target.value))}
                              className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs">
                          <span className="font-medium text-slate-700 dark:text-slate-300 text-[11px]">Display Text Below</span>
                          <button
                            onClick={() => setDisplayValue(!displayValue)}
                            className={`w-8 h-4.5 flex items-center rounded-full p-0.5 transition-colors ${
                              displayValue ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-800'
                            }`}
                          >
                            <div
                              className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                                displayValue ? 'translate-x-3.5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Error Correction Level (Density)
                          </label>
                          <CustomSelect
                            value={qrDensity}
                            options={qrDensityOptions}
                            onChange={(val) => setQrDensity(val as any)}
                            className="w-full text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              QR Size
                            </label>
                            <span className="text-blue-600 dark:text-blue-400 font-mono text-[11px] font-bold">{qrSize}px</span>
                          </div>
                          <input
                            type="range"
                            min="120"
                            max="260"
                            step="10"
                            value={qrSize}
                            onChange={(e) => setQrSize(Number(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                        </div>

                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs">
                          <span className="font-medium text-slate-700 dark:text-slate-300 text-[11px]">Quiet Margin</span>
                          <button
                            onClick={() => setQrMargin(!qrMargin)}
                            className={`w-8 h-4.5 flex items-center rounded-full p-0.5 transition-colors ${
                              qrMargin ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-800'
                            }`}
                          >
                            <div
                              className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                                qrMargin ? 'translate-x-3.5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Embed Logo / Photo */}
                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Center Logo</span>
                            {logoUrl ? (
                              <div className="flex items-center gap-1.5">
                                <img src={logoUrl} alt="Logo" className="w-5 h-5 object-contain rounded bg-white p-0.5" />
                                <button onClick={() => setLogoUrl(null)} className="text-red-400 hover:text-red-300 text-[11px] font-semibold">Remove</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-1 px-2 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-medium rounded transition-colors"
                              >
                                <Upload size={11} /> Upload Image
                              </button>
                            )}
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              className="hidden"
                            />
                          </div>
                          {logoUrl && (
                            <div className="flex items-center gap-2 pt-0.5">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400">Size ({logoSize}px)</span>
                              <input
                                type="range"
                                min="20"
                                max="60"
                                step="2"
                                value={logoSize}
                                onChange={(e) => setLogoSize(Number(e.target.value))}
                                className="flex-1 h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Preset Colors */}
                    <div className="space-y-1 pt-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Color Theme
                      </label>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {colorPresets.map((preset) => (
                          <button
                            key={preset.name}
                            onClick={() => {
                              setFgColor(preset.fg);
                              setBgColor(preset.bg);
                            }}
                            title={preset.name}
                            className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-medium transition-all ${
                              fgColor === preset.fg && bgColor === preset.bg
                                ? 'border-blue-500 bg-blue-500/15 text-blue-700 dark:text-blue-300'
                                : 'border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-slate-300 dark:border-slate-700 shrink-0"
                              style={{ backgroundColor: preset.fg }}
                            />
                            <span>{preset.name.split(' ')[0]}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Right Column / Full Area: Live Code Preview Box */}
                <div className={`flex flex-col items-center justify-center p-6 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl relative group overflow-hidden shadow-inner transition-all ${
                  isFullscreenPreview ? 'col-span-full min-h-[380px] sm:min-h-[420px]' : 'min-h-[240px]'
                }`}>
                  {/* Toggle Full View Button */}
                  <button
                    onClick={() => setIsFullscreenPreview(!isFullscreenPreview)}
                    className="absolute top-3 right-3 p-2 rounded-xl bg-white/90 dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 shadow-md transition-all z-20 flex items-center gap-1.5 text-xs font-semibold"
                    title={isFullscreenPreview ? "Exit Full View" : "Full View Mode"}
                  >
                    {isFullscreenPreview ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                    <span className="hidden sm:inline">{isFullscreenPreview ? "Settings" : "Full View"}</span>
                  </button>

                  {/* Subtle Grid overlay for transparent codes */}
                  <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]" />
                  
                  <div
                    ref={wrapperRef}
                    className="relative z-10 p-4 rounded-xl shadow-lg transition-all flex flex-col items-center justify-center"
                    style={{ backgroundColor: bgColor === 'transparent' ? 'transparent' : bgColor }}
                  >
                    {ocrProcessing && (
                      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm rounded-xl">
                        <Loader2 size={32} className="animate-spin text-blue-500 mb-3" />
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Extracting Text...</span>
                        {ocrProgress && (
                          <div className="flex flex-col items-center w-full max-w-[200px]">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 mb-1 font-mono uppercase truncate w-full text-center">{ocrProgress.status}</span>
                            <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 transition-all duration-200" style={{ width: `${Math.round(ocrProgress.progress * 100)}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {!value.trim() ? (
                      /* Friendly Empty State UI */
                      <div className="flex flex-col items-center justify-center p-6 text-center max-w-xs bg-white/90 dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md backdrop-blur-sm">
                        <div className="w-12 h-12 rounded-full bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center mb-3 text-blue-600 dark:text-blue-400">
                          {mode === 'barcode' ? <Barcode size={26} /> : <QrCode size={26} />}
                        </div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                          Ready to Generate {mode === 'barcode' ? 'Barcode' : 'QR Code'}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                          Type or paste your text or numbers into the box on the left to preview live.
                        </span>
                        <button
                          onClick={() => setValue(mode === 'barcode' && currentSpec ? currentSpec.example : '123456789012')}
                          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-600/25 transition-all active:scale-95 flex items-center gap-1.5"
                        >
                          <Sparkles size={13} />
                          Insert Sample Data
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* QR Code Container */}
                        <div className={mode === 'qrcode' ? 'block' : 'hidden'}>
                          <QRCodeSVG
                            value={value.trim()}
                            size={isFullscreenPreview ? Math.max(qrSize, 240) : qrSize}
                            level={logoUrl ? 'H' : qrDensity}
                            includeMargin={qrMargin}
                            fgColor={fgColor}
                            bgColor={bgColor}
                            imageSettings={
                              logoUrl
                                ? {
                                    src: logoUrl,
                                    x: undefined,
                                    y: undefined,
                                    height: logoSize,
                                    width: logoSize,
                                    excavate: true,
                                  }
                                : undefined
                            }
                            className="max-w-full h-auto"
                          />
                        </div>

                        {/* Barcode Container */}
                        <div className={mode === 'barcode' ? 'block' : 'hidden'}>
                          {barcodeError && (
                            <div className="flex flex-col items-center justify-center p-4 text-center text-amber-600 dark:text-amber-400 max-w-xs bg-white/90 dark:bg-slate-900/90 rounded-xl border border-amber-500/20 shadow-md">
                              <AlertTriangle size={24} className="mb-2 text-amber-500" />
                              <span className="text-xs font-bold mb-1">Invalid Format</span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">{barcodeError}</span>
                              {currentSpec && (
                                <button
                                  onClick={() => setValue(currentSpec.example)}
                                  className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold transition-all active:scale-95"
                                >
                                  Use Valid Sample ({currentSpec.example})
                                </button>
                              )}
                            </div>
                          )}
                          <svg ref={svgRef} className={`max-w-full h-auto ${barcodeError ? 'hidden' : 'block'}`} />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Format tag badge */}
                  <div className="absolute bottom-3 right-3 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                    {mode === 'qrcode' ? `QR (${qrDensity})` : barcodeFormat}
                  </div>
                </div>
                </div>
              )}

            </div>

            {mode !== 'scan' && (
              <div className="p-4 sm:px-6 border-t border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                {(() => {
                const isExportDisabled = !value.trim() || (mode === 'barcode' && !!barcodeError);
                return (
                  <>
                    <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={handleCopySvg}
                        disabled={isExportDisabled}
                        className="flex items-center justify-center gap-1.5 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl font-bold transition-all text-xs active:scale-95 shadow-sm"
                      >
                        {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                        {copied ? 'Copied!' : 'Copy SVG'}
                      </button>
                      <button
                        onClick={handleCopyPng}
                        disabled={isExportDisabled}
                        className="flex items-center justify-center gap-1.5 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl font-bold transition-all text-xs active:scale-95 shadow-sm"
                      >
                        {copiedPng ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                        {copiedPng ? 'Copied!' : 'Copy PNG'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={handleDownloadSvg}
                        disabled={isExportDisabled}
                        className="flex items-center justify-center gap-1.5 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:pointer-events-none text-white rounded-xl font-bold transition-all text-xs active:scale-95 shadow-lg shadow-blue-600/25"
                      >
                        <Download size={15} /> Save SVG
                      </button>
                      <button
                        onClick={handleDownloadPng}
                        disabled={isExportDisabled}
                        className="flex items-center justify-center gap-1.5 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white rounded-xl font-bold transition-all text-xs active:scale-95 shadow-lg shadow-emerald-600/25"
                      >
                        <ImageIcon size={15} /> Save PNG
                      </button>
                    </div>
                  </>
                );
              })()}
              </div>
            )}

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
