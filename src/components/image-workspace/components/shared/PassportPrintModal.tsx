import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Printer, Download, Image as ImageIcon, Settings2, Grid2X2, 
  Lock, Unlock, RotateCw, ZoomIn, ZoomOut, Maximize2, AlertCircle, Sliders, Eye,
  Sun, Moon, Scissors, Sparkles, Check, ChevronDown, Camera, Upload, RotateCcw, Wand2,
  Globe, FileText, BadgeCheck, CreditCard, Wallet, Settings, Contact, UserCheck, ShieldCheck
} from 'lucide-react';
import { CustomSelect } from './CustomSelect';
import { useStore } from '../../../../store/useStore';
import { CameraCaptureModal } from '../../../CameraCaptureModal';

interface PassportPrintModalProps {
  sourceImage: string; // Data URL of the generated passport photo
  onClose: () => void;
}

// DPI conversion: pixels = (mm / 25.4) * dpi
const MM_TO_PX = (mm: number, dpi: number = 300) => Math.round((mm / 25.4) * dpi);

export type PhotoUnit = 'mm' | 'cm' | 'inch' | 'px';

export const MM_TO_UNIT = (mm: number, unit: PhotoUnit, dpi: number = 300): number => {
  switch (unit) {
    case 'cm': return Math.round((mm / 10) * 100) / 100;
    case 'inch': return Math.round((mm / 25.4) * 100) / 100;
    case 'px': return Math.round((mm / 25.4) * dpi);
    case 'mm':
    default: return Math.round(mm * 10) / 10;
  }
};

export const UNIT_TO_MM = (val: number, unit: PhotoUnit, dpi: number = 300): number => {
  if (isNaN(val) || val <= 0) return 1;
  switch (unit) {
    case 'cm': return val * 10;
    case 'inch': return val * 25.4;
    case 'px': return (val / dpi) * 25.4;
    case 'mm':
    default: return val;
  }
};

// Set DPI metadata in JPEG images (JFIF APP0 marker density bytes)
function setJpegDPI(dataUrl: string, dpi: number): string {
  try {
    const parts = dataUrl.split(',');
    if (!parts[1]) return dataUrl;
    const binary = atob(parts[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    // Check SOI (FF D8) and APP0 (FF E0)
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF && bytes[3] === 0xE0) {
      bytes[13] = 1; // 1 = dots per inch
      bytes[14] = (dpi >> 8) & 0xFF;
      bytes[15] = dpi & 0xFF;
      bytes[16] = (dpi >> 8) & 0xFF;
      bytes[17] = dpi & 0xFF;

      let outStr = '';
      for (let i = 0; i < bytes.length; i++) outStr += String.fromCharCode(bytes[i]);
      return parts[0] + ',' + btoa(outStr);
    }
  } catch (err) {
    console.error('Error setting JPEG DPI metadata:', err);
  }
  return dataUrl;
}

// Set DPI metadata in PNG images (pHYs chunk insertion)
function setPngDPI(dataUrl: string, dpi: number): string {
  try {
    const parts = dataUrl.split(',');
    if (!parts[1]) return dataUrl;
    const binary = atob(parts[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    // Pixels per meter = dpi * 39.3701
    const ppm = Math.round(dpi * 39.3701);

    // Build pHYs data: 4 bytes type ('pHYs') + 4 bytes ppm_x + 4 bytes ppm_y + 1 byte unit (1 = meter)
    const physData = new Uint8Array(13);
    physData[0] = 0x70; physData[1] = 0x48; physData[2] = 0x59; physData[3] = 0x73;
    physData[4] = (ppm >> 24) & 0xFF;
    physData[5] = (ppm >> 16) & 0xFF;
    physData[6] = (ppm >> 8) & 0xFF;
    physData[7] = ppm & 0xFF;
    physData[8] = (ppm >> 24) & 0xFF;
    physData[9] = (ppm >> 16) & 0xFF;
    physData[10] = (ppm >> 8) & 0xFF;
    physData[11] = ppm & 0xFF;
    physData[12] = 1; // 1 = meters

    // CRC32 calculation over type + data
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < physData.length; i++) {
      crc ^= physData[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
      }
    }
    crc = (crc ^ 0xFFFFFFFF) >>> 0;

    // Build complete pHYs chunk: 4 bytes length (00 00 00 09) + 13 bytes physData + 4 bytes CRC
    const chunk = new Uint8Array(21);
    chunk[0] = 0; chunk[1] = 0; chunk[2] = 0; chunk[3] = 9;
    chunk.set(physData, 4);
    chunk[17] = (crc >> 24) & 0xFF;
    chunk[18] = (crc >> 16) & 0xFF;
    chunk[19] = (crc >> 8) & 0xFF;
    chunk[20] = crc & 0xFF;

    // PNG signature (8 bytes) + IHDR chunk (25 bytes) ends at offset 33
    const ihdrEnd = 33;
    if (bytes.length > ihdrEnd && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      const newBytes = new Uint8Array(bytes.length + chunk.length);
      newBytes.set(bytes.subarray(0, ihdrEnd), 0);
      newBytes.set(chunk, ihdrEnd);
      newBytes.set(bytes.subarray(ihdrEnd), ihdrEnd + chunk.length);

      let outStr = '';
      for (let i = 0; i < newBytes.length; i++) outStr += String.fromCharCode(newBytes[i]);
      return parts[0] + ',' + btoa(outStr);
    }
  } catch (err) {
    console.error('Error setting PNG DPI metadata:', err);
  }
  return dataUrl;
}

const PAPER_SIZES = {
  a4: { name: 'A4 (210×297 mm)', width: 210, height: 297 },
  a5: { name: 'A5 (148×210 mm)', width: 148, height: 210 },
  letter: { name: 'Letter (8.5×11")', width: 215.9, height: 279.4 },
  legal: { name: 'Legal (8.5×14")', width: 215.9, height: 355.6 },
  r4x6: { name: '4×6" Photo Paper (10×15 cm)', width: 101.6, height: 152.4 },
  r5x7: { name: '5×7" Photo Paper (13×18 cm)', width: 127, height: 177.8 },
  custom: { name: 'Custom Paper Size', width: 210, height: 297 },
};

export const DOCUMENT_PRESETS = {
  indian_passport: {
    id: 'indian_passport',
    name: 'Indian Passport',
    desc: '35×45 mm (3.5×4.5 cm)',
    widthMM: 35,
    heightMM: 45,
    icon: <BadgeCheck size={18} className="text-blue-500" />
  },
  indian_aadhaar_pan: {
    id: 'indian_aadhaar_pan',
    name: 'Aadhaar / PAN / OCI',
    desc: '2×2 in (51×51 mm)',
    widthMM: 51,
    heightMM: 51,
    icon: <CreditCard size={18} className="text-emerald-500" />
  },
  schengen_visa: {
    id: 'schengen_visa',
    name: 'Schengen Visa',
    desc: '35×45 mm',
    widthMM: 35,
    heightMM: 45,
    icon: <Globe size={18} className="text-indigo-500" />
  },
  us_passport: {
    id: 'us_passport',
    name: 'US Passport & Visa',
    desc: '2×2 in (51×51 mm)',
    widthMM: 51,
    heightMM: 51,
    icon: <FileText size={18} className="text-rose-500" />
  },
  uk_visa: {
    id: 'uk_visa',
    name: 'UK Visa & Passport',
    desc: '35×45 mm',
    widthMM: 35,
    heightMM: 45,
    icon: <Globe size={18} className="text-purple-500" />
  },
  canada_visa: {
    id: 'canada_visa',
    name: 'Canada Visa',
    desc: '50×70 mm',
    widthMM: 50,
    heightMM: 70,
    icon: <Globe size={18} className="text-amber-500" />
  },
  standard_id: {
    id: 'standard_id',
    name: 'Standard ID Card',
    desc: '30×40 mm',
    widthMM: 30,
    heightMM: 40,
    icon: <Contact size={18} className="text-teal-500" />
  },
  stamp_size: {
    id: 'stamp_size',
    name: 'Stamp / Wallet Size',
    desc: '25×35 mm',
    widthMM: 25,
    heightMM: 35,
    icon: <Wallet size={18} className="text-pink-500" />
  },
  custom: {
    id: 'custom',
    name: 'Custom Dimension',
    desc: 'Specify custom unit & size',
    widthMM: 35,
    heightMM: 45,
    icon: <Settings size={18} className="text-slate-400" />
  }
};

export const PassportPrintModal: React.FC<PassportPrintModalProps> = ({ sourceImage, onClose }) => {
  const { appTheme, setAppTheme } = useStore();
  const isDark = appTheme === 'dark';

  const [paperSize, setPaperSize] = useState<keyof typeof PAPER_SIZES>('a4');
  const [docPreset, setDocPreset] = useState<keyof typeof DOCUMENT_PRESETS>('indian_passport');
  
  // Custom Paper Dimensions (in MM, with display values according to paperUnit)
  const [paperUnit, setPaperUnit] = useState<PhotoUnit>('mm');
  const [customPaperWMM, setCustomPaperWMM] = useState(210);
  const [customPaperHMM, setCustomPaperHMM] = useState(297);
  const [displayPaperWVal, setDisplayPaperWVal] = useState<number>(210);
  const [displayPaperHVal, setDisplayPaperHVal] = useState<number>(297);
  
  const [lockPaperRatio, setLockPaperRatio] = useState(false);
  const [paperRatio, setPaperRatio] = useState(210 / 297);

  // Photo Unit state: 'mm' | 'cm' | 'inch' | 'px'
  const [photoUnit, setPhotoUnit] = useState<PhotoUnit>('mm');

  // Photo Dimensions (internally maintained in MM, default to standard Indian Passport 35x45 mm)
  const [photoWMM, setPhotoWMM] = useState(35);
  const [photoHMM, setPhotoHMM] = useState(45);
  const [displayWVal, setDisplayWVal] = useState<number>(35);
  const [displayHVal, setDisplayHVal] = useState<number>(45);
  
  const [lockPhotoRatio, setLockPhotoRatio] = useState(false);
  const [photoRatio, setPhotoRatio] = useState(35 / 45);

  // Photo count specification
  const [requestedPhotoCount, setRequestedPhotoCount] = useState<number | 'max'>('max');

  // Spacing & Guidelines
  const [marginTop, setMarginTop] = useState(10);
  const [marginLeft, setMarginLeft] = useState(10);
  const [spacing, setSpacing] = useState(5);
  const [drawCropMarks, setDrawCropMarks] = useState(true);
  
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);

  // Mobile View Toggle: 'preview' | 'settings'
  const [mobileTab, setMobileTab] = useState<'preview' | 'settings'>('preview');
  
  // Preview Zoom Scale
  const [zoomLevel, setZoomLevel] = useState(100);

  // Responsive window width tracking for mobile viewport fitting
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1000);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Responsive base paper preview width for 100% zoom
  const basePaperWidthPx = useMemo(() => {
    const isMobile = windowWidth < 640;
    if (isMobile) {
      // Fit mobile screen width with container padding
      const maxMobileW = Math.max(260, windowWidth - 40);
      return orientation === 'portrait' 
        ? Math.min(340, maxMobileW) 
        : Math.min(480, maxMobileW);
    }
    return orientation === 'portrait' ? 520 : 680;
  }, [windowWidth, orientation]);

  // Photo scale inside frame (70% - 130%)
  const [photoScale, setPhotoScale] = useState(100);

  // Image Fit Mode: cover (crop to fill), contain (fit inside with letterbox), fill (stretch)
  type ImageFitMode = 'cover' | 'contain' | 'fill';
  const [imageFit, setImageFit] = useState<ImageFitMode>('cover');

  // Image Position Anchor (9-point grid, maps to CSS background-position)
  type ImagePosition = 'top left' | 'top center' | 'top right' | 'center left' | 'center center' | 'center right' | 'bottom left' | 'bottom center' | 'bottom right';
  const [imagePosition, setImagePosition] = useState<ImagePosition>('center center');

  // Image Filter Adjustments (Brightness, Contrast, Saturation, Grayscale, Sepia)
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [saturation, setSaturation] = useState<number>(100);
  const [grayscale, setGrayscale] = useState<number>(0);
  const [sepia, setSepia] = useState<number>(0);
  const [activeFilterPreset, setActiveFilterPreset] = useState<string>('normal');

  const filterCss = useMemo(() => {
    return `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) grayscale(${grayscale}%) sepia(${sepia}%)`;
  }, [brightness, contrast, saturation, grayscale, sepia]);

  const resetFilters = useCallback(() => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setGrayscale(0);
    setSepia(0);
    setActiveFilterPreset('normal');
  }, []);

  const applyFilterPreset = useCallback((preset: string) => {
    setActiveFilterPreset(preset);
    switch (preset) {
      case 'passport_warm':
        setBrightness(104); setContrast(106); setSaturation(110); setGrayscale(0); setSepia(8);
        break;
      case 'studio_cool':
        setBrightness(102); setContrast(108); setSaturation(95); setGrayscale(0); setSepia(0);
        break;
      case 'b_and_w':
        setBrightness(102); setContrast(118); setSaturation(0); setGrayscale(100); setSepia(0);
        break;
      case 'vivid_sharp':
        setBrightness(106); setContrast(115); setSaturation(125); setGrayscale(0); setSepia(0);
        break;
      case 'normal':
      default:
        setBrightness(100); setContrast(100); setSaturation(100); setGrayscale(0); setSepia(0);
        break;
    }
  }, []);

  // Target Export File Size Limit in KB (0 = no limit)
  const [maxFileKB, setMaxFileKB] = useState<number>(0);

  // Dynamic Print Resolution DPI (Default 300 DPI)
  const [printDPI, setPrintDPI] = useState<number>(300);

  // Export Image Format Dropdown state
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const canvasViewportRef = useRef<HTMLDivElement>(null);
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartZoomRef = useRef<number>(100);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setIsExportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Trackpad / Wheel pinch zoom handler
  const handleWheelZoom = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 10 : -10;
      setZoomLevel(prev => Math.min(250, Math.max(40, prev + delta)));
    }
  };

  // Mobile Touch Pinch-to-Zoom gesture listener
  useEffect(() => {
    const viewport = canvasViewportRef.current;
    if (!viewport) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        touchStartDistRef.current = dist;
        touchStartZoomRef.current = zoomLevel;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchStartDistRef.current !== null && touchStartDistRef.current > 0) {
        if (e.cancelable) e.preventDefault();
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const scaleRatio = currentDist / touchStartDistRef.current;
        const newZoom = Math.min(250, Math.max(40, Math.round(touchStartZoomRef.current * scaleRatio)));
        setZoomLevel(newZoom);
      }
    };

    const handleTouchEnd = () => {
      touchStartDistRef.current = null;
    };

    viewport.addEventListener('touchstart', handleTouchStart, { passive: true });
    viewport.addEventListener('touchmove', handleTouchMove, { passive: false });
    viewport.addEventListener('touchend', handleTouchEnd);
    viewport.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      viewport.removeEventListener('touchstart', handleTouchStart);
      viewport.removeEventListener('touchmove', handleTouchMove);
      viewport.removeEventListener('touchend', handleTouchEnd);
      viewport.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [zoomLevel]);

  // Sync photo display numeric inputs when MM or photoUnit changes
  useEffect(() => {
    setDisplayWVal(MM_TO_UNIT(photoWMM, photoUnit));
    setDisplayHVal(MM_TO_UNIT(photoHMM, photoUnit));
  }, [photoWMM, photoHMM, photoUnit]);

  // Sync paper display numeric inputs when MM or paperUnit changes
  useEffect(() => {
    setDisplayPaperWVal(MM_TO_UNIT(customPaperWMM, paperUnit));
    setDisplayPaperHVal(MM_TO_UNIT(customPaperHMM, paperUnit));
  }, [customPaperWMM, customPaperHMM, paperUnit]);

  // Handle document preset change
  const handleSelectDocPreset = (key: keyof typeof DOCUMENT_PRESETS) => {
    setDocPreset(key);
    if (key !== 'custom') {
      const preset = DOCUMENT_PRESETS[key];
      setPhotoWMM(preset.widthMM);
      setPhotoHMM(preset.heightMM);
      setPhotoRatio(preset.widthMM / preset.heightMM);
    }
  };

  // Handle photo unit change with auto-conversion
  const handlePhotoUnitChange = (newUnit: PhotoUnit) => {
    if (newUnit === photoUnit) return;
    setPhotoUnit(newUnit);
  };

  // Handle paper unit change with auto-conversion
  const handlePaperUnitChange = (newUnit: PhotoUnit) => {
    if (newUnit === paperUnit) return;
    setPaperUnit(newUnit);
  };

  // Handle Width change in custom photo mode
  const handleDisplayWChange = (newVal: number) => {
    const safeVal = Math.max(0.1, newVal);
    setDisplayWVal(safeVal);
    const calculatedMM = UNIT_TO_MM(safeVal, photoUnit);
    setPhotoWMM(calculatedMM);

    if (lockPhotoRatio && photoRatio) {
      const targetHMM = calculatedMM / photoRatio;
      setPhotoHMM(targetHMM);
      setDisplayHVal(MM_TO_UNIT(targetHMM, photoUnit));
    }
  };

  // Handle Height change in custom photo mode
  const handleDisplayHChange = (newVal: number) => {
    const safeVal = Math.max(0.1, newVal);
    setDisplayHVal(safeVal);
    const calculatedMM = UNIT_TO_MM(safeVal, photoUnit);
    setPhotoHMM(calculatedMM);

    if (lockPhotoRatio && photoRatio) {
      const targetWMM = calculatedMM * photoRatio;
      setPhotoWMM(targetWMM);
      setDisplayWVal(MM_TO_UNIT(targetWMM, photoUnit));
    }
  };

  // Handle Width change in custom paper mode
  const handleDisplayPaperWChange = (newVal: number) => {
    const safeVal = Math.max(0.1, newVal);
    setDisplayPaperWVal(safeVal);
    const calculatedMM = UNIT_TO_MM(safeVal, paperUnit);
    setCustomPaperWMM(calculatedMM);

    if (lockPaperRatio && paperRatio) {
      const targetHMM = calculatedMM / paperRatio;
      setCustomPaperHMM(targetHMM);
      setDisplayPaperHVal(MM_TO_UNIT(targetHMM, paperUnit));
    }
  };

  // Handle Height change in custom paper mode
  const handleDisplayPaperHChange = (newVal: number) => {
    const safeVal = Math.max(0.1, newVal);
    setDisplayPaperHVal(safeVal);
    const calculatedMM = UNIT_TO_MM(safeVal, paperUnit);
    setCustomPaperHMM(calculatedMM);

    if (lockPaperRatio && paperRatio) {
      const targetWMM = calculatedMM * paperRatio;
      setCustomPaperWMM(targetWMM);
      setDisplayPaperWVal(MM_TO_UNIT(targetWMM, paperUnit));
    }
  };

  // Handle paper size selector
  const handleSelectPaperSize = (key: keyof typeof PAPER_SIZES) => {
    setPaperSize(key);
    if (key !== 'custom') {
      const preset = PAPER_SIZES[key];
      setCustomPaperWMM(preset.width);
      setCustomPaperHMM(preset.height);
      setPaperRatio(preset.width / preset.height);
    }
  };

  const togglePaperLock = () => {
    if (!lockPaperRatio) setPaperRatio(customPaperWMM / (customPaperHMM || 1));
    setLockPaperRatio(!lockPaperRatio);
  };

  const togglePhotoLock = () => {
    if (!lockPhotoRatio) setPhotoRatio(photoWMM / (photoHMM || 1));
    setLockPhotoRatio(!lockPhotoRatio);
  };

  const [activeImageSrc, setActiveImageSrc] = useState<string>(sourceImage);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file upload from device
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setActiveImageSrc(reader.result);
      }
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  useEffect(() => {
    setActiveImageSrc(sourceImage);
  }, [sourceImage]);

  // Load the active image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setImageObj(img);
    img.src = activeImageSrc;
  }, [activeImageSrc]);

  // Prevent background scrolling
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  // Grid Layout Calculation (in MM)
  const layout = useMemo(() => {
    const pWBase = paperSize === 'custom' ? (customPaperWMM || 210) : PAPER_SIZES[paperSize].width;
    const pHBase = paperSize === 'custom' ? (customPaperHMM || 297) : PAPER_SIZES[paperSize].height;

    const pWidth = orientation === 'portrait' ? pWBase : pHBase;
    const pHeight = orientation === 'portrait' ? pHBase : pWBase;
    
    const phWidth = docPreset === 'custom' ? (photoWMM || 35) : DOCUMENT_PRESETS[docPreset].widthMM;
    const phHeight = docPreset === 'custom' ? (photoHMM || 45) : DOCUMENT_PRESETS[docPreset].heightMM;

    // Available space
    const availWidth = Math.max(0, pWidth - (marginLeft * 2));
    const availHeight = Math.max(0, pHeight - (marginTop * 2));

    // How many can fit in columns and rows?
    let maxCols = phWidth > 0 ? Math.floor((availWidth + spacing) / (phWidth + spacing)) : 0;
    let maxRows = phHeight > 0 ? Math.floor((availHeight + spacing) / (phHeight + spacing)) : 0;

    maxCols = Math.max(0, maxCols);
    maxRows = Math.max(0, maxRows);
    const maxCapacity = maxCols * maxRows;

    // Active rendered photo count limited by user setting
    let activePhotoCount = maxCapacity;
    if (requestedPhotoCount !== 'max' && typeof requestedPhotoCount === 'number') {
      activePhotoCount = Math.min(maxCapacity, Math.max(1, requestedPhotoCount));
    }

    // Center grid inside paper
    const consumedWidth = (maxCols * phWidth) + Math.max(0, maxCols - 1) * spacing;
    const consumedHeight = (maxRows * phHeight) + Math.max(0, maxRows - 1) * spacing;
    
    const actualMarginLeft = marginLeft + Math.max(0, (availWidth - consumedWidth) / 2);
    const actualMarginTop = marginTop + Math.max(0, (availHeight - consumedHeight) / 2);

    return { 
      pWidth, pHeight, phWidth, phHeight, 
      cols: maxCols, rows: maxRows, maxCapacity, activePhotoCount,
      actualMarginLeft, actualMarginTop 
    };
  }, [paperSize, docPreset, marginTop, marginLeft, spacing, orientation, customPaperWMM, customPaperHMM, photoWMM, photoHMM, requestedPhotoCount]);

  // High-Resolution Print Canvas Generation (Dynamic DPI)
  const generatePrintCanvas = async (): Promise<HTMLCanvasElement | null> => {
    if (!imageObj || layout.cols === 0 || layout.rows === 0) return null;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const dpi = printDPI || 300;
    const mmToPx = (val: number) => MM_TO_PX(val, dpi);

    // Set canvas size based on selected DPI
    canvas.width = mmToPx(layout.pWidth);
    canvas.height = mmToPx(layout.pHeight);

    // Fill white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const startX = mmToPx(layout.actualMarginLeft);
    const startY = mmToPx(layout.actualMarginTop);
    const pW = mmToPx(layout.phWidth);
    const pH = mmToPx(layout.phHeight);
    const gap = mmToPx(spacing);

    let photosDrawn = 0;

    // Draw photos and cut guidelines
    for (let r = 0; r < layout.rows; r++) {
      for (let c = 0; c < layout.cols; c++) {
        if (photosDrawn >= layout.activePhotoCount) break;

        const x = startX + c * (pW + gap);
        const y = startY + r * (pH + gap);

        // Draw Image with inner scale clipping + fit mode
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, pW, pH);
        ctx.clip();

        const imgW = imageObj.naturalWidth;
        const imgH = imageObj.naturalHeight;
        const cellAspect = pW / pH;
        const imgAspect = imgW / imgH;

        let drawW: number, drawH: number;

        if (imageFit === 'cover') {
          // Cover: fill cell, crop overflow
          if (imgAspect > cellAspect) {
            drawH = pH;
            drawW = pH * imgAspect;
          } else {
            drawW = pW;
            drawH = pW / imgAspect;
          }
        } else if (imageFit === 'contain') {
          // Contain: fit entire image, letterbox
          if (imgAspect > cellAspect) {
            drawW = pW;
            drawH = pW / imgAspect;
          } else {
            drawH = pH;
            drawW = pH * imgAspect;
          }
        } else {
          // Fill: stretch to fill cell exactly
          drawW = pW;
          drawH = pH;
        }

        // Apply photoScale on top of fit
        const scaledW = drawW * (photoScale / 100);
        const scaledH = drawH * (photoScale / 100);

        // Position-aware offset calculation (9-point anchor)
        const [posV, posH] = imagePosition.split(' ') as [string, string];
        let offsetX: number, offsetY: number;

        // Horizontal position
        if (posH === 'left') {
          offsetX = x;
        } else if (posH === 'right') {
          offsetX = x + (pW - scaledW);
        } else {
          offsetX = x + (pW - scaledW) / 2;
        }

        // Vertical position
        if (posV === 'top') {
          offsetY = y;
        } else if (posV === 'bottom') {
          offsetY = y + (pH - scaledH);
        } else {
          offsetY = y + (pH - scaledH) / 2;
        }

        // Apply CSS filters (brightness, contrast, saturation, etc.) to canvas
        ctx.filter = filterCss;
        ctx.drawImage(imageObj, offsetX, offsetY, scaledW, scaledH);
        ctx.restore();

        // Draw cut guidelines (dashed borders & scissor marks) if requested
        if (drawCropMarks) {
          ctx.save();
          ctx.strokeStyle = '#94A3B8'; // Slate 400
          ctx.lineWidth = mmToPx(0.4); // 0.4mm dash stroke
          ctx.setLineDash([mmToPx(1.5), mmToPx(1.5)]); // Dashed line
          ctx.strokeRect(x, y, pW, pH);
          ctx.restore();

          // Draw Scissor Icon on top-left corner of each photo box if gap >= 2mm or on boundaries
          if (c === 0 || r === 0 || gap > mmToPx(2)) {
            ctx.save();
            ctx.font = `${Math.max(14, mmToPx(3))}px sans-serif`;
            ctx.fillStyle = '#64748B';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // Scissor symbol top left corner
            ctx.fillText('✂', x - mmToPx(1), y - mmToPx(1));
            ctx.restore();
          }
        }

        photosDrawn++;
      }
    }

    return canvas;
  };

  const handleExportImage = async (format: 'png' | 'jpeg' | 'webp' = exportFormat) => {
    setExportFormat(format);
    setIsExportDropdownOpen(false);
    const canvas = await generatePrintCanvas();
    if (!canvas) return;
    
    const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
    let dataUrl = canvas.toDataURL(mimeType, 0.95);

    // 100% Guaranteed Target File Size Compression (Scale + Dynamic Quality Tuning)
    if (maxFileKB > 0 && format !== 'png') {
      const head = mimeType === 'image/jpeg' ? 'data:image/jpeg;base64,' : 'data:image/webp;base64,';
      
      let minScale = 0.05;
      let maxScale = 1.0;
      let bestUrl = '';
      let bestSizeKB = Infinity;

      // 8-step binary search over scale + quality combinations
      for (let step = 0; step < 8; step++) {
        const midScale = (minScale + maxScale) / 2;
        const scaledCanvas = document.createElement('canvas');
        scaledCanvas.width = Math.max(100, Math.round(canvas.width * midScale));
        scaledCanvas.height = Math.max(100, Math.round(canvas.height * midScale));
        const sCtx = scaledCanvas.getContext('2d');
        
        if (sCtx) {
          sCtx.imageSmoothingEnabled = true;
          sCtx.imageSmoothingQuality = 'high';
          sCtx.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
          
          // Dynamically scale quality from 0.85 down to 0.40 based on midScale
          const q = Math.max(0.35, Math.min(0.92, midScale * 0.9));
          const testUrl = scaledCanvas.toDataURL(mimeType, q);
          const base64Str = testUrl.substring(head.length);
          const testSizeKB = Math.round((base64Str.length * 3) / 4 / 1024);

          if (testSizeKB <= maxFileKB) {
            bestUrl = testUrl;
            bestSizeKB = testSizeKB;
            minScale = midScale; // Try higher resolution if possible
          } else {
            maxScale = midScale;
          }
        }
      }

      // Strict Fallback Pass: If scale loop didn't get below maxFileKB (e.g. for tiny <20KB targets)
      if (!bestUrl || bestSizeKB > maxFileKB) {
        for (let scale = 0.25; scale >= 0.05; scale -= 0.04) {
          for (let q = 0.80; q >= 0.10; q -= 0.10) {
            const fbCanvas = document.createElement('canvas');
            fbCanvas.width = Math.max(80, Math.round(canvas.width * scale));
            fbCanvas.height = Math.max(80, Math.round(canvas.height * scale));
            const fCtx = fbCanvas.getContext('2d');
            if (fCtx) {
              fCtx.imageSmoothingEnabled = true;
              fCtx.imageSmoothingQuality = 'high';
              fCtx.drawImage(canvas, 0, 0, fbCanvas.width, fbCanvas.height);
              const testUrl = fbCanvas.toDataURL(mimeType, q);
              const testSizeKB = Math.round(((testUrl.substring(head.length).length) * 3) / 4 / 1024);
              
              if (testSizeKB <= maxFileKB) {
                bestUrl = testUrl;
                break;
              }
              if (!bestUrl) bestUrl = testUrl;
            }
          }
          if (bestUrl && Math.round(((bestUrl.substring(head.length).length) * 3) / 4 / 1024) <= maxFileKB) {
            break;
          }
        }
      }

      if (bestUrl) {
        dataUrl = bestUrl;
      }
    }

    // Embed DPI resolution metadata into image headers for OS & Photoshop file details
    if (format === 'jpeg') {
      dataUrl = setJpegDPI(dataUrl, printDPI);
    } else if (format === 'png') {
      dataUrl = setPngDPI(dataUrl, printDPI);
    }

    const link = document.createElement('a');
    link.href = dataUrl;
    const docLabel = docPreset === 'custom' ? `${layout.phWidth}x${layout.phHeight}mm` : DOCUMENT_PRESETS[docPreset].name.split(' ')[0];
    const kbLabel = maxFileKB > 0 ? `_${maxFileKB}kb` : '';
    link.download = `passport_studio_${docLabel}_${layout.activePhotoCount}photos_${printDPI}dpi${kbLabel}.${format}`;
    link.click();
  };

  const handleExportPDF = async () => {
    const canvas = await generatePrintCanvas();
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png', 1.0);
    
    // Create an invisible iframe to print from
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <html>
        <head>
          <title>Passport Studio Print</title>
          <style>
            @page {
              size: ${layout.pWidth}mm ${layout.pHeight}mm;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              background: white;
            }
            img {
              width: ${layout.pWidth}mm;
              height: ${layout.pHeight}mm;
            }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" />
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 10000);
  };

  // Build array of active photo indices for preview grid
  const photoIndices = useMemo(() => {
    const indices: { r: number; c: number }[] = [];
    let count = 0;
    for (let r = 0; r < layout.rows; r++) {
      for (let c = 0; c < layout.cols; c++) {
        if (count < layout.activePhotoCount) {
          indices.push({ r, c });
          count++;
        }
      }
    }
    return indices;
  }, [layout.rows, layout.cols, layout.activePhotoCount]);

  return createPortal(
    <div className={`fixed inset-0 z-[99999] w-screen h-screen max-h-screen flex flex-col overflow-hidden font-sans select-none touch-manipulation animate-in fade-in duration-200 ${
      isDark ? 'bg-[#0A0A0A] text-white' : 'bg-slate-50 text-slate-900'
    }`}>
      
      {/* Studio Header Navigation */}
      <header className={`h-14 sm:h-16 border-b px-3 sm:px-6 flex items-center justify-between shrink-0 z-40 relative shadow-sm ${
        isDark ? 'border-[#222] bg-[#111111]' : 'border-slate-200 bg-white'
      }`}>
        
        {/* Left: Passport Studio Branding */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
          <div className="p-1.5 sm:p-2 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl text-white shadow-md shadow-blue-500/20 shrink-0">
            <UserCheck size={18} className="sm:w-[20px] sm:h-[20px]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xs sm:text-base font-black tracking-tight whitespace-nowrap">
                Passport Studio
              </h1>
              <span className="hidden md:inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full shrink-0">
                <Sparkles size={10} /> {printDPI} DPI Print
              </span>
            </div>
            <p className={`text-[11px] hidden lg:block truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Commercial passport photo generator & print grid layout engine
            </p>
          </div>
        </div>

        {/* Right: Actions & Theme Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          
          {/* Hidden file input for Upload Photo */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
            id="passport-studio-file-upload"
          />

          {/* Modern Camera & Upload Pill Group */}
          <div className={`flex items-center rounded-xl border overflow-hidden ${
            isDark ? 'border-[#333] bg-[#1C1C1C]' : 'border-slate-200 bg-white shadow-sm'
          }`}>
            {/* Camera Button */}
            <button
              onClick={() => setIsCameraOpen(true)}
              title="Snap new photo with camera"
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-semibold transition-all active:scale-[0.97] ${
                isDark
                  ? 'text-indigo-400 hover:bg-[#252525]'
                  : 'text-indigo-700 hover:bg-indigo-50'
              }`}
            >
              <Camera size={15} />
              <span className="hidden sm:inline">Camera</span>
            </button>

            {/* Divider */}
            <div className={`w-px h-5 ${
              isDark ? 'bg-[#333]' : 'bg-slate-200'
            }`} />

            {/* Upload Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Upload photo from device"
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-semibold transition-all active:scale-[0.97] ${
                isDark
                  ? 'text-emerald-400 hover:bg-[#252525]'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <Upload size={15} />
              <span className="hidden sm:inline">Upload</span>
            </button>
          </div>

          {/* Light / Dark Mode Toggle Button */}
          <button
            onClick={() => setAppTheme(isDark ? 'light' : 'dark')}
            title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
            className={`p-2 rounded-xl border transition-all ${
              isDark 
                ? 'bg-[#1C1C1C] border-[#333] text-amber-400 hover:bg-[#252525]' 
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          <div className={`w-px h-5 sm:h-6 mx-0.5 sm:mx-1 ${isDark ? 'bg-[#2B2B2B]' : 'bg-slate-200'}`} />

          {/* Modern Export Image Format Dropdown */}
          <div className="relative" ref={exportDropdownRef}>
            <button
              onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
              className={`flex items-center gap-1.5 p-2 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-all active:scale-95 border ${
                isDark 
                  ? 'bg-[#1C1C1C] hover:bg-[#282828] border-[#333] text-white' 
                  : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800 shadow-sm'
              }`}
            >
              <Download size={15} className="text-blue-500" />
              <span className="hidden sm:inline">Export</span>
              <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                {exportFormat}
              </span>
              <ChevronDown size={14} className={`transition-transform duration-200 text-slate-400 ${isExportDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isExportDropdownOpen && (
              <div className={`absolute right-0 top-full mt-2 w-60 rounded-2xl border shadow-xl p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 ${
                isDark ? 'bg-[#181818] border-[#333] text-white shadow-black/60' : 'bg-white border-slate-200 text-slate-900 shadow-slate-300/50'
              }`}>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1.5">
                  Export Image Format
                </div>

                {[
                  { id: 'png' as const, label: 'PNG Image', ext: '.png', desc: 'Lossless 300 DPI high quality' },
                  { id: 'jpeg' as const, label: 'JPEG Image', ext: '.jpeg', desc: 'Compressed photo format' },
                  { id: 'webp' as const, label: 'WEBP Image', ext: '.webp', desc: 'Modern compact Web format' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleExportImage(item.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all ${
                      exportFormat === item.id 
                        ? 'bg-blue-500/10 text-blue-500 font-bold' 
                        : isDark ? 'hover:bg-[#252525] text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold flex items-center gap-1.5">
                        {item.label}
                        {exportFormat === item.id && <Check size={12} className="text-blue-500" />}
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                        {item.desc}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-slate-200 dark:bg-[#2A2A2A] text-slate-600 dark:text-slate-400 shrink-0">
                      {item.ext}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleExportPDF}
            title="Print or Save PDF"
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white p-2 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all active:scale-95 shadow-md shadow-blue-600/20"
          >
            <Printer size={15} />
            <span className="hidden sm:inline">Print / PDF</span>
          </button>

          <button 
            onClick={onClose} 
            className={`p-2 rounded-xl transition-colors shrink-0 ${
              isDark ? 'text-slate-400 hover:text-white hover:bg-[#222]' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="Close Passport Studio"
          >
            <X size={19} />
          </button>
        </div>
      </header>

      {/* Studio Subheader: Mobile Tabs & Modern Professional Zoom Controls in One Single Block */}
      <div className={`h-12 border-b px-3 sm:px-5 flex items-center justify-between shrink-0 z-20 shadow-sm ${
        isDark ? 'border-[#222] bg-[#141414]' : 'border-slate-200 bg-slate-100'
      }`}>
        
        {/* Left: Mobile Segmented Switcher / Desktop Workspace Title */}
        <div className="flex items-center gap-3">
          {/* Mobile Segmented Switcher (Preview / Controls) */}
          <div className={`flex sm:hidden items-center p-0.5 rounded-xl border ${
            isDark ? 'bg-[#1C1C1C] border-[#2A2A2A]' : 'bg-white border-slate-300 shadow-sm'
          }`}>
            <button
              type="button"
              onClick={() => setMobileTab('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                mobileTab === 'preview' ? 'bg-blue-600 text-white shadow-md' : isDark ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              <Eye size={13} /> Preview
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('settings')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                mobileTab === 'settings' ? 'bg-blue-600 text-white shadow-md' : isDark ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              <Sliders size={13} /> Controls
            </button>
          </div>

          {/* Desktop Section Title */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="font-bold text-slate-700 dark:text-slate-300 text-xs tracking-wide">
              Paper Sheet Preview
            </span>
          </div>
        </div>

        {/* Right: Modern Professional Zoom Control Pill (Only visible when viewing preview) */}
        {mobileTab === 'preview' && (
          <div className={`flex items-center p-0.5 rounded-xl border transition-all ${
            isDark ? 'bg-[#1C1C1C] border-[#2A2A2A]' : 'bg-white border-slate-300 shadow-sm'
          }`}>
            <button 
              type="button"
              onClick={() => setZoomLevel(prev => Math.max(40, prev - 15))}
              className={`p-1.5 rounded-lg transition-colors ${
                isDark ? 'hover:bg-[#282828] text-slate-300 active:text-white' : 'hover:bg-slate-200 text-slate-700'
              }`}
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(100)}
              className={`px-2 py-0.5 text-[11px] font-mono font-bold tracking-tight rounded-md transition-colors ${
                isDark ? 'hover:bg-[#252525] text-blue-400' : 'hover:bg-slate-200 text-blue-600'
              }`}
              title="Reset Zoom to 100%"
            >
              {zoomLevel}%
            </button>
            <button 
              type="button"
              onClick={() => setZoomLevel(prev => Math.min(200, prev + 15))}
              className={`p-1.5 rounded-lg transition-colors ${
                isDark ? 'hover:bg-[#282828] text-slate-300 active:text-white' : 'hover:bg-slate-200 text-slate-700'
              }`}
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            <div className={`w-px h-3.5 mx-0.5 ${isDark ? 'bg-[#333]' : 'bg-slate-300'}`} />
            <button 
              type="button"
              onClick={() => setZoomLevel(100)}
              className={`p-1.5 rounded-lg transition-colors ${
                isDark ? 'hover:bg-[#282828] text-slate-300 hover:text-blue-400' : 'hover:bg-slate-200 text-slate-700 hover:text-blue-600'
              }`}
              title="Reset Zoom to Fit"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        )}

      </div>

      {/* Main Studio Workspace */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Left Sidebar: Controls & Presets */}
        <aside className={`w-full sm:w-80 md:w-96 border-r flex flex-col shrink-0 overflow-hidden transition-all z-10 ${
          isDark ? 'border-[#222] bg-[#0F0F0F]' : 'border-slate-200 bg-white'
        } ${mobileTab === 'settings' ? 'flex w-full h-full' : 'hidden sm:flex'}`}>
          
          {/* Photos Fit & Count Capacity Banner */}
          <div className={`p-4 border-b ${isDark ? 'border-[#222] bg-[#141414]' : 'border-slate-200 bg-slate-50'}`}>
            <div className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
              layout.maxCapacity > 0 
                ? isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : isDark ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${layout.maxCapacity > 0 ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`}>
                  <Grid2X2 size={20} />
                </div>
                <div>
                  <div className="text-xl font-black tracking-tight flex items-baseline gap-1.5">
                    {layout.activePhotoCount}
                    <span className="text-xs font-normal opacity-80">
                      {layout.activePhotoCount === 1 ? 'photo' : 'photos'} printing
                    </span>
                  </div>
                  <div className="text-[11px] opacity-75 font-medium">
                    {layout.cols} cols × {layout.rows} rows (Max {layout.maxCapacity} fit)
                  </div>
                </div>
              </div>
              <div className="text-right text-[11px] font-mono font-bold opacity-80">
                {layout.phWidth}×{layout.phHeight}mm
              </div>
            </div>

            {layout.maxCapacity === 0 && (
              <div className="mt-2.5 text-xs text-rose-500 flex items-center gap-1.5 bg-rose-500/10 px-3 py-2 rounded-xl border border-rose-500/20">
                <AlertCircle size={14} className="shrink-0" />
                <span>Dimensions or margins exceed available paper space.</span>
              </div>
            )}
          </div>

          {/* Scrollable Settings Form */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 custom-scrollbar">
            
            {/* 1. Document Preset Selector */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  <ImageIcon size={13} /> Photo Size by Document Type
                </h2>
              </div>

              {/* Grid of Preset Cards */}
              <div className="grid grid-cols-2 gap-2">
                {Object.values(DOCUMENT_PRESETS).map((preset) => {
                  const isSelected = docPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectDocPreset(preset.id as any)}
                      className={`p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/50' 
                          : isDark 
                            ? 'border-[#262626] bg-[#161616] hover:bg-[#1F1F1F] text-slate-300' 
                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="p-1 rounded-lg bg-slate-100 dark:bg-[#222]">
                          {preset.icon}
                        </div>
                        {isSelected && <Check size={14} className="text-blue-500" />}
                      </div>
                      <div className="mt-2">
                        <div className={`text-xs font-bold truncate ${isSelected ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                          {preset.name}
                        </div>
                        <div className={`text-[10px] font-mono mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {preset.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Custom Photo Size Input with Multi-Unit Support */}
              {docPreset === 'custom' && (
                <div className={`p-3.5 border rounded-2xl space-y-3 animate-in slide-in-from-top-2 duration-150 ${
                  isDark ? 'bg-[#161616] border-[#2B2B2B]' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Custom Photo Dimensions</span>
                    
                    {/* Unit Switcher: mm | cm | inch | px */}
                    <div className={`flex items-center p-0.5 rounded-lg border text-[10px] font-bold ${
                      isDark ? 'bg-[#222] border-[#333]' : 'bg-white border-slate-300'
                    }`}>
                      {(['mm', 'cm', 'inch', 'px'] as PhotoUnit[]).map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => handlePhotoUnitChange(u)}
                          className={`px-2 py-0.5 rounded-md uppercase transition-all ${
                            photoUnit === u 
                              ? 'bg-blue-600 text-white shadow-sm' 
                              : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Width ({photoUnit})</label>
                      <input 
                        type="number" step={photoUnit === 'inch' ? '0.1' : '1'} min="0.1" max="1000" 
                        value={displayWVal} 
                        onChange={e => handleDisplayWChange(parseFloat(e.target.value) || 0)} 
                        className={`w-full border rounded-xl px-2.5 py-1.5 text-xs font-mono outline-none focus:border-blue-500 transition-colors ${
                          isDark ? 'bg-[#202020] border-[#333] text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>
                    
                    <button 
                      onClick={togglePhotoLock} 
                      title={lockPhotoRatio ? 'Unlock Aspect Ratio' : 'Lock Aspect Ratio'} 
                      className={`p-2 mt-4 rounded-xl border transition-all ${
                        lockPhotoRatio 
                          ? 'bg-blue-500/20 border-blue-500/40 text-blue-500' 
                          : isDark ? 'bg-[#202020] border-[#333] text-slate-400' : 'bg-white border-slate-300 text-slate-500'
                      }`}
                    >
                      {lockPhotoRatio ? <Lock size={14} /> : <Unlock size={14} />}
                    </button>

                    <div className="flex-1 space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Height ({photoUnit})</label>
                      <input 
                        type="number" step={photoUnit === 'inch' ? '0.1' : '1'} min="0.1" max="1000" 
                        value={displayHVal} 
                        onChange={e => handleDisplayHChange(parseFloat(e.target.value) || 0)} 
                        className={`w-full border rounded-xl px-2.5 py-1.5 text-xs font-mono outline-none focus:border-blue-500 transition-colors ${
                          isDark ? 'bg-[#202020] border-[#333] text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Converted MM: {Math.round(photoWMM * 10) / 10} × {Math.round(photoHMM * 10) / 10} mm
                  </div>
                </div>
              )}
            </section>

            <div className={`w-full h-px ${isDark ? 'bg-[#222]' : 'bg-slate-200'}`} />

            {/* 2. Photo Count Limit Specification */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  <Grid2X2 size={13} /> Photo Quantity
                </h2>
                <span className="text-[11px] font-mono text-blue-500 font-semibold">
                  {requestedPhotoCount === 'max' ? `Max Fit (${layout.maxCapacity})` : `${requestedPhotoCount} photos`}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'Max Fill', val: 'max' as const },
                  { label: '1', val: 1 },
                  { label: '2', val: 2 },
                  { label: '4', val: 4 },
                  { label: '6', val: 6 },
                  { label: '8', val: 8 },
                  { label: '12', val: 12 },
                  { label: '16', val: 16 },
                ].map((item) => {
                  const isActive = requestedPhotoCount === item.val;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setRequestedPhotoCount(item.val as any)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                        isActive 
                          ? 'bg-blue-600 border-blue-600 text-white font-bold shadow-sm' 
                          : isDark 
                            ? 'bg-[#161616] border-[#262626] text-slate-300 hover:bg-[#202020]' 
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {/* Custom Quantity Input Box */}
              <div className={`p-3 border rounded-xl flex items-center justify-between gap-3 ${
                isDark ? 'bg-[#161616] border-[#2B2B2B]' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="text-xs font-semibold">Custom Quantity</div>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" min="1" max={Math.max(1, layout.maxCapacity)} 
                    value={typeof requestedPhotoCount === 'number' ? requestedPhotoCount : 1}
                    onChange={e => {
                      const val = Math.max(1, parseInt(e.target.value) || 1);
                      setRequestedPhotoCount(val);
                    }}
                    className={`w-20 border rounded-lg px-2.5 py-1 text-xs font-mono text-center outline-none focus:border-blue-500 transition-colors ${
                      isDark ? 'bg-[#202020] border-[#333] text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                  <span className="text-[10px] text-slate-400 font-mono">/ {layout.maxCapacity} max</span>
                </div>
              </div>
            </section>

            <div className={`w-full h-px ${isDark ? 'bg-[#222]' : 'bg-slate-200'}`} />

            {/* 3. Photo Zoom & Target File Compression */}
            <section className="space-y-3">
              <h2 className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}>
                <Sliders size={13} /> Photo Zoom & Lossless Compression
              </h2>

              {/* Modern Custom Photo Scale Slider */}
              <div className={`p-3.5 border rounded-2xl space-y-3 ${
                isDark ? 'bg-[#141414] border-[#262626]' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <Maximize2 size={13} className="text-blue-500" />
                    <span>Photo Frame Fit / Zoom</span>
                  </div>
                  <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20">
                    {photoScale}%
                  </span>
                </div>

                {/* Range Slider Track & Stepper Controls */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPhotoScale(prev => Math.max(70, prev - 5))}
                    className={`w-7 h-7 rounded-lg border flex items-center justify-center font-bold text-xs transition-all active:scale-95 ${
                      isDark ? 'bg-[#1F1F1F] border-[#333] text-slate-300 hover:bg-[#282828]' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                    title="Shrink Photo Scale"
                  >
                    -
                  </button>

                  <div className="relative flex-1 flex items-center">
                    <input 
                      type="range" min="70" max="130" step="1"
                      value={photoScale}
                      onChange={e => setPhotoScale(Number(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none bg-slate-200 dark:bg-[#262626] outline-none cursor-pointer accent-blue-600"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setPhotoScale(prev => Math.min(130, prev + 5))}
                    className={`w-7 h-7 rounded-lg border flex items-center justify-center font-bold text-xs transition-all active:scale-95 ${
                      isDark ? 'bg-[#1F1F1F] border-[#333] text-slate-300 hover:bg-[#282828]' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                    title="Enlarge Photo Scale"
                  >
                    +
                  </button>
                </div>

                {/* Quick Fit Presets */}
                <div className="flex items-center justify-between gap-1.5 pt-0.5">
                  {[
                    { label: '85% Padding', val: 85 },
                    { label: '100% Default', val: 100 },
                    { label: '115% Tight Crop', val: 115 },
                  ].map(preset => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setPhotoScale(preset.val)}
                      className={`flex-1 py-1 rounded-lg border text-[10px] font-semibold transition-all ${
                        photoScale === preset.val
                          ? 'bg-blue-600 border-blue-600 text-white font-bold shadow-sm'
                          : isDark
                            ? 'bg-[#1C1C1C] border-[#2A2A2A] text-slate-400 hover:text-white hover:bg-[#252525]'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Image Fit Mode Selector */}
                <div className="pt-1 space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Image Fit Mode</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { id: 'cover' as ImageFitMode, label: 'Cover', desc: 'Crop to fill' },
                      { id: 'contain' as ImageFitMode, label: 'Contain', desc: 'Fit inside' },
                      { id: 'fill' as ImageFitMode, label: 'Fill', desc: 'Stretch' },
                    ]).map(mode => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setImageFit(mode.id)}
                        className={`py-1.5 rounded-lg border text-center transition-all ${
                          imageFit === mode.id
                            ? 'bg-violet-600 border-violet-600 text-white font-bold shadow-sm'
                            : isDark
                              ? 'bg-[#1C1C1C] border-[#2A2A2A] text-slate-400 hover:text-white hover:bg-[#252525]'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="text-[11px] font-semibold">{mode.label}</div>
                        <div className={`text-[9px] ${
                          imageFit === mode.id ? 'text-violet-200' : 'text-slate-400'
                        }`}>{mode.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Image Position Anchor Grid (visible for cover/contain) */}
                {imageFit !== 'fill' && (
                  <div className="pt-1 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Image Position</div>
                      <div className="text-[9px] font-mono text-violet-500 font-bold">
                        {imagePosition.replace(' ', ' / ')}
                      </div>
                    </div>
                    <div className={`p-2.5 border rounded-xl flex items-center gap-4 ${
                      isDark ? 'bg-[#1A1A1A] border-[#2A2A2A]' : 'bg-white border-slate-200 shadow-sm'
                    }`}>
                      {/* 3x3 Visual Dot Grid */}
                      <div className="grid grid-cols-3 gap-[3px] shrink-0">
                        {([
                          'top left', 'top center', 'top right',
                          'center left', 'center center', 'center right',
                          'bottom left', 'bottom center', 'bottom right'
                        ] as ImagePosition[]).map(pos => (
                          <button
                            key={pos}
                            type="button"
                            onClick={() => setImagePosition(pos)}
                            title={pos}
                            className={`w-5 h-5 rounded-[4px] border transition-all active:scale-90 ${
                              imagePosition === pos
                                ? 'bg-violet-500 border-violet-500 shadow-md shadow-violet-500/30 scale-110'
                                : isDark
                                  ? 'bg-[#252525] border-[#333] hover:bg-[#333] hover:border-violet-500/50'
                                  : 'bg-slate-100 border-slate-300 hover:bg-violet-100 hover:border-violet-400'
                            }`}
                          >
                            {imagePosition === pos && (
                              <div className="w-1.5 h-1.5 bg-white rounded-full mx-auto" />
                            )}
                          </button>
                        ))}
                      </div>
                      {/* Position Labels */}
                      <div className="flex-1 min-w-0">
                        <div className="grid grid-cols-3 gap-x-1 gap-y-0.5">
                          {([
                            { pos: 'top left' as ImagePosition, label: 'TL' },
                            { pos: 'top center' as ImagePosition, label: 'TC' },
                            { pos: 'top right' as ImagePosition, label: 'TR' },
                            { pos: 'center left' as ImagePosition, label: 'CL' },
                            { pos: 'center center' as ImagePosition, label: 'C' },
                            { pos: 'center right' as ImagePosition, label: 'CR' },
                            { pos: 'bottom left' as ImagePosition, label: 'BL' },
                            { pos: 'bottom center' as ImagePosition, label: 'BC' },
                            { pos: 'bottom right' as ImagePosition, label: 'BR' },
                          ]).map(item => (
                            <button
                              key={item.pos}
                              type="button"
                              onClick={() => setImagePosition(item.pos)}
                              className={`text-[9px] font-bold py-0.5 rounded transition-colors ${
                                imagePosition === item.pos
                                  ? 'text-violet-500'
                                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Image Enhancements & Color Filters Section */}
              <div className={`p-3.5 border rounded-2xl space-y-3.5 ${
                isDark ? 'bg-[#141414] border-[#262626]' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <Wand2 size={13} className="text-amber-500" />
                    <span>Image Filters & Enhancements</span>
                  </div>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-amber-400 px-1.5 py-0.5 rounded hover:bg-slate-800/40 transition-colors"
                    title="Reset All Filters"
                  >
                    <RotateCcw size={10} /> Reset
                  </button>
                </div>

                {/* Filter Preset Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'normal', label: 'Normal' },
                    { id: 'passport_warm', label: 'Warm Skin' },
                    { id: 'studio_cool', label: 'Studio Cool' },
                    { id: 'b_and_w', label: 'B&W Official' },
                    { id: 'vivid_sharp', label: 'Vivid Sharp' },
                  ].map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyFilterPreset(preset.id)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
                        activeFilterPreset === preset.id
                          ? 'bg-amber-600 border-amber-600 text-white font-bold shadow-sm'
                          : isDark
                            ? 'bg-[#1C1C1C] border-[#2A2A2A] text-slate-400 hover:text-white hover:bg-[#252525]'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Adjustment Sliders */}
                <div className="space-y-2.5 pt-1">
                  {/* Brightness Slider */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">Brightness</span>
                      <span className="font-mono text-amber-500 font-bold text-[10px]">{brightness}%</span>
                    </div>
                    <input
                      type="range" min="50" max="150" step="1"
                      value={brightness}
                      onChange={e => { setBrightness(Number(e.target.value)); setActiveFilterPreset('custom'); }}
                      className="w-full h-1.5 rounded-lg appearance-none bg-slate-200 dark:bg-[#262626] outline-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  {/* Contrast Slider */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">Contrast</span>
                      <span className="font-mono text-amber-500 font-bold text-[10px]">{contrast}%</span>
                    </div>
                    <input
                      type="range" min="50" max="150" step="1"
                      value={contrast}
                      onChange={e => { setContrast(Number(e.target.value)); setActiveFilterPreset('custom'); }}
                      className="w-full h-1.5 rounded-lg appearance-none bg-slate-200 dark:bg-[#262626] outline-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  {/* Saturation Slider */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">Saturation</span>
                      <span className="font-mono text-amber-500 font-bold text-[10px]">{saturation}%</span>
                    </div>
                    <input
                      type="range" min="0" max="200" step="1"
                      value={saturation}
                      onChange={e => { setSaturation(Number(e.target.value)); setActiveFilterPreset('custom'); }}
                      className="w-full h-1.5 rounded-lg appearance-none bg-slate-200 dark:bg-[#262626] outline-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  {/* Grayscale Slider */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">Grayscale</span>
                      <span className="font-mono text-amber-500 font-bold text-[10px]">{grayscale}%</span>
                    </div>
                    <input
                      type="range" min="0" max="100" step="1"
                      value={grayscale}
                      onChange={e => { setGrayscale(Number(e.target.value)); setActiveFilterPreset('custom'); }}
                      className="w-full h-1.5 rounded-lg appearance-none bg-slate-200 dark:bg-[#262626] outline-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  {/* Sepia Slider */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">Sepia Tone</span>
                      <span className="font-mono text-amber-500 font-bold text-[10px]">{sepia}%</span>
                    </div>
                    <input
                      type="range" min="0" max="100" step="1"
                      value={sepia}
                      onChange={e => { setSepia(Number(e.target.value)); setActiveFilterPreset('custom'); }}
                      className="w-full h-1.5 rounded-lg appearance-none bg-slate-200 dark:bg-[#262626] outline-none cursor-pointer accent-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Target File Size Limit (KB) */}
              <div className={`p-3.5 border rounded-2xl space-y-3 ${
                isDark ? 'bg-[#141414] border-[#262626]' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>Target Export File Size</span>
                  <span className="text-[10px] font-mono text-emerald-500 font-bold">
                    {maxFileKB > 0 ? `Max ${maxFileKB} KB` : 'Original (300 DPI)'}
                  </span>
                </div>

                {/* Target KB Preset Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Original', kb: 0 },
                    { label: '< 200 KB', kb: 200 },
                    { label: '< 100 KB', kb: 100 },
                    { label: '< 50 KB', kb: 50 },
                    { label: '< 20 KB', kb: 20 },
                  ].map(item => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setMaxFileKB(item.kb)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
                        maxFileKB === item.kb
                          ? 'bg-emerald-600 border-emerald-600 text-white font-bold shadow-sm'
                          : isDark
                            ? 'bg-[#1C1C1C] border-[#2A2A2A] text-slate-300 hover:bg-[#252525]'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {/* Custom KB Input Box */}
                <div className={`p-2.5 border rounded-xl flex items-center justify-between gap-2 ${
                  isDark ? 'bg-[#1A1A1A] border-[#2E2E2E]' : 'bg-white border-slate-300 shadow-sm'
                }`}>
                  <span className="text-xs font-semibold text-slate-400">Custom Size Limit</span>
                  <div className="flex items-center gap-1.5">
                    <input 
                      type="number" min="5" max="10000" step="5"
                      placeholder="e.g. 35"
                      value={maxFileKB > 0 ? maxFileKB : ''}
                      onChange={e => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        setMaxFileKB(val);
                      }}
                      className={`w-20 border rounded-lg px-2 py-1 text-xs font-mono text-center outline-none focus:border-emerald-500 transition-colors ${
                        isDark ? 'bg-[#242424] border-[#383838] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                    <span className="text-xs font-mono font-bold text-slate-500">KB</span>
                    {maxFileKB > 0 && (
                      <button
                        type="button"
                        onClick={() => setMaxFileKB(0)}
                        className="text-[10px] font-mono text-slate-400 hover:text-rose-400 px-1"
                        title="Clear Limit"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 font-normal leading-tight">
                  Guaranteed target KB compression with dynamic high-quality image smoothing.
                </div>
              </div>
            </section>

            <div className={`w-full h-px ${isDark ? 'bg-[#222]' : 'bg-slate-200'}`} />

            {/* 4. Print Resolution (DPI) Settings */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  <Printer size={13} /> Print Resolution (DPI)
                </h2>
                <span className="text-[11px] font-mono text-indigo-500 font-bold">
                  {printDPI} DPI
                </span>
              </div>

              <div className={`p-3.5 border rounded-2xl space-y-3 ${
                isDark ? 'bg-[#141414] border-[#262626]' : 'bg-slate-50 border-slate-200'
              }`}>
                {/* DPI Preset Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: '300 DPI (Commercial)', dpi: 300 },
                    { label: '600 DPI (Ultra HD)', dpi: 600 },
                    { label: '200 DPI (Web)', dpi: 200 },
                    { label: '150 DPI (Medium)', dpi: 150 },
                    { label: '72 DPI (Draft)', dpi: 72 },
                  ].map(item => (
                    <button
                      key={item.dpi}
                      type="button"
                      onClick={() => setPrintDPI(item.dpi)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
                        printDPI === item.dpi
                          ? 'bg-indigo-600 border-indigo-600 text-white font-bold shadow-sm'
                          : isDark
                            ? 'bg-[#1C1C1C] border-[#2A2A2A] text-slate-300 hover:bg-[#252525]'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {/* Custom DPI Input Box */}
                <div className={`p-2.5 border rounded-xl flex items-center justify-between gap-2 ${
                  isDark ? 'bg-[#1A1A1A] border-[#2E2E2E]' : 'bg-white border-slate-300 shadow-sm'
                }`}>
                  <span className="text-xs font-semibold text-slate-400">Custom DPI Resolution</span>
                  <div className="flex items-center gap-1.5">
                    <input 
                      type="number" min="72" max="1200" step="10"
                      placeholder="300"
                      value={printDPI}
                      onChange={e => {
                        const val = Math.max(72, parseInt(e.target.value) || 300);
                        setPrintDPI(val);
                      }}
                      className={`w-20 border rounded-lg px-2 py-1 text-xs font-mono text-center outline-none focus:border-indigo-500 transition-colors ${
                        isDark ? 'bg-[#242424] border-[#383838] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                    <span className="text-xs font-mono font-bold text-slate-500">DPI</span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 font-normal leading-tight">
                  Output canvas size: {Math.round((layout.pWidth / 25.4) * printDPI)} × {Math.round((layout.pHeight / 25.4) * printDPI)} px
                </div>
              </div>
            </section>

            <div className={`w-full h-px ${isDark ? 'bg-[#222]' : 'bg-slate-200'}`} />

            {/* 3. Paper Format Settings */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  <Settings2 size={13} /> Paper Sheet Format
                </h2>
                <span className="text-[11px] font-mono text-slate-400">
                  {layout.pWidth} × {layout.pHeight} mm
                </span>
              </div>

              <div className="space-y-2">
                <CustomSelect 
                  value={paperSize} 
                  onChange={handleSelectPaperSize} 
                  options={Object.entries(PAPER_SIZES).map(([k, v]) => ({ value: k, label: v.name }))} 
                />

                {paperSize === 'custom' && (
                  <div className={`p-3.5 border rounded-2xl space-y-3 animate-in slide-in-from-top-2 duration-150 ${
                    isDark ? 'bg-[#161616] border-[#2B2B2B]' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">Custom Paper Dimensions</span>
                      
                      {/* Unit Switcher: mm | cm | inch | px */}
                      <div className={`flex items-center p-0.5 rounded-lg border text-[10px] font-bold ${
                        isDark ? 'bg-[#222] border-[#333]' : 'bg-white border-slate-300'
                      }`}>
                        {(['mm', 'cm', 'inch', 'px'] as PhotoUnit[]).map((u) => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => handlePaperUnitChange(u)}
                            className={`px-2 py-0.5 rounded-md uppercase transition-all ${
                              paperUnit === u 
                                ? 'bg-blue-600 text-white shadow-sm' 
                                : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Width ({paperUnit})</label>
                        <input 
                          type="number" step={paperUnit === 'inch' ? '0.1' : '1'} min="0.1" max="5000" 
                          value={displayPaperWVal} 
                          onChange={e => handleDisplayPaperWChange(parseFloat(e.target.value) || 0)} 
                          className={`w-full border rounded-xl px-2.5 py-1.5 text-xs font-mono outline-none focus:border-blue-500 transition-colors ${
                            isDark ? 'bg-[#202020] border-[#333] text-white' : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </div>
                      
                      <button 
                        onClick={togglePaperLock} 
                        title={lockPaperRatio ? 'Unlock Aspect Ratio' : 'Lock Aspect Ratio'} 
                        className={`p-2 mt-4 rounded-xl border transition-all ${
                          lockPaperRatio 
                            ? 'bg-blue-500/20 border-blue-500/40 text-blue-500' 
                            : isDark ? 'bg-[#202020] border-[#333] text-slate-400' : 'bg-white border-slate-300 text-slate-500'
                        }`}
                      >
                        {lockPaperRatio ? <Lock size={14} /> : <Unlock size={14} />}
                      </button>

                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Height ({paperUnit})</label>
                        <input 
                          type="number" step={paperUnit === 'inch' ? '0.1' : '1'} min="0.1" max="5000" 
                          value={displayPaperHVal} 
                          onChange={e => handleDisplayPaperHChange(parseFloat(e.target.value) || 0)} 
                          className={`w-full border rounded-xl px-2.5 py-1.5 text-xs font-mono outline-none focus:border-blue-500 transition-colors ${
                            isDark ? 'bg-[#202020] border-[#333] text-white' : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Converted MM: {Math.round(customPaperWMM * 10) / 10} × {Math.round(customPaperHMM * 10) / 10} mm
                    </div>
                  </div>
                )}

                {/* Orientation Selector */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => setOrientation('portrait')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      orientation === 'portrait' 
                        ? 'bg-blue-600/15 border-blue-500/40 text-blue-500 font-bold' 
                        : isDark ? 'bg-[#161616] border-[#262626] text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="w-3 h-4 border-2 border-current rounded-sm" />
                    Portrait
                  </button>
                  <button
                    onClick={() => setOrientation('landscape')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      orientation === 'landscape' 
                        ? 'bg-blue-600/15 border-blue-500/40 text-blue-500 font-bold' 
                        : isDark ? 'bg-[#161616] border-[#262626] text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="w-4 h-3 border-2 border-current rounded-sm" />
                    Landscape
                  </button>
                </div>
              </div>
            </section>

            <div className={`w-full h-px ${isDark ? 'bg-[#222]' : 'bg-slate-200'}`} />

            {/* 4. Spacing & Cut Guidelines */}
            <section className="space-y-3">
              <h2 className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}>
                <Scissors size={13} /> Spacing & Cut Guidelines
              </h2>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-400">Gap (mm)</label>
                  <input 
                    type="number" min="0" max="50" 
                    value={spacing} 
                    onChange={e => setSpacing(Math.max(0, Number(e.target.value)))}
                    className={`w-full border rounded-xl px-2.5 py-2 text-xs font-mono outline-none focus:border-blue-500 transition-colors ${
                      isDark ? 'bg-[#161616] border-[#2B2B2B] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-400">Top Margin</label>
                  <input 
                    type="number" min="0" max="100" 
                    value={marginTop} 
                    onChange={e => setMarginTop(Math.max(0, Number(e.target.value)))}
                    className={`w-full border rounded-xl px-2.5 py-2 text-xs font-mono outline-none focus:border-blue-500 transition-colors ${
                      isDark ? 'bg-[#161616] border-[#2B2B2B] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-400">Side Margin</label>
                  <input 
                    type="number" min="0" max="100" 
                    value={marginLeft} 
                    onChange={e => setMarginLeft(Math.max(0, Number(e.target.value)))}
                    className={`w-full border rounded-xl px-2.5 py-2 text-xs font-mono outline-none focus:border-blue-500 transition-colors ${
                      isDark ? 'bg-[#161616] border-[#2B2B2B] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* Scissor Cut Guidelines Toggle */}
              <div 
                className={`flex items-center justify-between p-3.5 border rounded-xl cursor-pointer transition-colors ${
                  isDark ? 'bg-[#161616] border-[#2B2B2B] hover:bg-[#1F1F1F]' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
                onClick={() => setDrawCropMarks(!drawCropMarks)}
              >
                <div className="flex items-center gap-2">
                  <Scissors size={15} className="text-blue-500" />
                  <span className="text-xs font-bold">Draw Cut Guidelines (Scissors)</span>
                </div>
                <div className={`relative w-[34px] h-[18px] rounded-full transition-colors duration-200 ${drawCropMarks ? 'bg-blue-600' : 'bg-[#444]'}`}>
                  <div className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] bg-white rounded-full transition-transform duration-200 shadow ${drawCropMarks ? 'translate-x-[16px]' : 'translate-x-0'}`} />
                </div>
              </div>
            </section>

          </div>
        </aside>

        {/* Right Canvas Area: Live Interactive Preview */}
        <main className={`flex-1 flex-col relative overflow-hidden ${
          isDark ? 'bg-[#090909]' : 'bg-slate-100'
        } ${mobileTab === 'preview' ? 'flex' : 'hidden sm:flex'}`}>

          {/* Canvas Viewport Area */}
          <div 
            ref={canvasViewportRef}
            onWheel={handleWheelZoom}
            className="flex-1 relative flex overflow-auto p-3 sm:p-12 custom-scrollbar touch-none select-none"
          >
            {/* Floating Paper Dimension Badge */}
            <div className="absolute top-3 left-3 z-20 pointer-events-none">
              <div className={`px-2.5 py-1 rounded-xl border backdrop-blur-md shadow-md text-[10px] font-mono font-bold flex items-center gap-1.5 ${
                isDark 
                  ? 'bg-[#121212]/85 border-[#2A2A2A] text-slate-300' 
                  : 'bg-white/85 border-slate-200 text-slate-700'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                {layout.pWidth} × {layout.pHeight} mm ({orientation} • {printDPI} DPI)
              </div>
            </div>

            {/* Background grid dot pattern */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-[0.15] min-w-full min-h-full" 
              style={{ 
                backgroundImage: isDark ? 'radial-gradient(#555 1px, transparent 1px)' : 'radial-gradient(#000 1px, transparent 1px)', 
                backgroundSize: '24px 24px' 
              }} 
            />

            {/* Outer Scroll Sizing Wrapper (Instant Size Bounds for Scrollbar) */}
            <div 
              className="m-auto flex items-center justify-center shrink-0"
              style={{ 
                width: `${basePaperWidthPx * (zoomLevel / 100)}px`,
                height: `${(basePaperWidthPx * (zoomLevel / 100) * layout.pHeight) / layout.pWidth}px`,
              }}
            >
              {/* Paper Sheet Rendering Container (60fps Hardware Accelerated Center Zoom) */}
              <div 
                className="relative bg-white shadow-2xl shrink-0 will-change-transform"
                style={{ 
                  width: `${basePaperWidthPx}px`,
                  height: `${(basePaperWidthPx * layout.pHeight) / layout.pWidth}px`,
                  transform: `scale(${zoomLevel / 100})`,
                  transformOrigin: '50% 50%',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)'
                }}
              >

                {/* Photos rendering */}
                {photoIndices.map(({ r, c }) => {
                  const left = layout.actualMarginLeft + c * (layout.phWidth + spacing);
                  const top = layout.actualMarginTop + r * (layout.phHeight + spacing);
                  return (
                    <div 
                      key={`${r}-${c}`}
                      className="absolute transition-all duration-150 overflow-visible"
                      style={{
                        left: `${(left / layout.pWidth) * 100}%`,
                        top: `${(top / layout.pHeight) * 100}%`,
                        width: `${(layout.phWidth / layout.pWidth) * 100}%`,
                        height: `${(layout.phHeight / layout.pHeight) * 100}%`,
                      }}
                    >
                      {/* Photo Image Box with Inner Scale Control */}
                      <div 
                        className="w-full h-full relative overflow-hidden flex items-center justify-center bg-white"
                        style={{
                          border: drawCropMarks ? '1px dashed #94A3B8' : 'none',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
                        }}
                      >
                        <div 
                          className="w-full h-full transition-transform duration-100"
                          style={{
                            backgroundImage: imageObj ? `url(${imageObj.src})` : 'none',
                            backgroundSize: imageFit === 'fill' ? '100% 100%' : imageFit,
                            backgroundPosition: imagePosition,
                            backgroundRepeat: 'no-repeat',
                            transform: `scale(${photoScale / 100})`,
                            transformOrigin: 'center center',
                            filter: filterCss,
                          }}
                        />
                        {!imageObj && (
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-slate-300">
                            <ImageIcon size={20} />
                          </div>
                        )}
                      </div>

                      {/* Scissor cut guideline icon badge */}
                      {drawCropMarks && (c === 0 || r === 0 || spacing >= 2) && (
                        <div 
                          className="absolute -top-2.5 -left-2.5 z-10 text-slate-500 select-none pointer-events-none transform -rotate-45"
                          style={{ fontSize: '10px' }}
                        >
                          ✂
                        </div>
                      )}
                    </div>
                  );
                })}

              </div>
            </div>

          </div>

          {/* Footer Metadata: Mobile Safe Area Padding */}
          <footer className={`min-h-[36px] border-t px-3 sm:px-4 py-1.5 flex items-center justify-between text-[10px] sm:text-[11px] shrink-0 font-mono pb-[max(0.5rem,env(safe-area-inset-bottom))] ${
            isDark ? 'border-[#1F1F1F] bg-[#0D0D0D] text-slate-400' : 'border-slate-200 bg-white text-slate-600'
          }`}>
            <div className="truncate pr-1">
              <span className="hidden sm:inline">Grid Capacity: {layout.cols} × {layout.rows} ({layout.maxCapacity} max) | </span>
              Rendering {layout.activePhotoCount} {layout.activePhotoCount === 1 ? 'photo' : 'photos'}
            </div>
            <div className="shrink-0 text-right">
              {MM_TO_PX(layout.pWidth)} × {MM_TO_PX(layout.pHeight)} px @ 300 DPI
            </div>
          </footer>
        </main>

      </div>

      {/* Render CameraCaptureModal when requested */}
      {isCameraOpen && (
        <CameraCaptureModal
          onClose={() => setIsCameraOpen(false)}
          onCapture={(file) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === 'string') {
                setActiveImageSrc(reader.result);
              }
              setIsCameraOpen(false);
            };
            reader.readAsDataURL(file);
          }}
        />
      )}
    </div>,
    document.body
  );
};
