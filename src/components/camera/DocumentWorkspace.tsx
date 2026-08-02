import React, { useState, useEffect, useRef } from 'react';
import { PerspectiveOverlay, Point } from './ui/PerspectiveOverlay';
import { ToolbarBottom } from './ui/ToolbarBottom';
import { FilterOptions, applyFilters } from '../../utils/image/ImageFilters';
import { WebGLPerspectiveEngine } from '../../utils/image/webgl-engine';

interface DocumentWorkspaceProps {
  imageSrc: string; // Base64 or Blob URL of captured image
  onSave: (finalBlob: Blob) => void;
  onCancel: () => void;
}

const DEFAULT_CORNERS: Point[] = [
  { x: 0.1, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.9, y: 0.9 },
  { x: 0.1, y: 0.9 }
];

export function DocumentWorkspace({ imageSrc, onSave, onCancel }: DocumentWorkspaceProps) {
  const [tab, setTab] = useState<'crop' | 'adjust'>('crop');
  const [corners, setCorners] = useState<Point[]>(DEFAULT_CORNERS);
  const [cropMode, setCropMode] = useState<'perspective' | 'rectangle'>('rectangle');
  const [filters, setFilters] = useState<FilterOptions>({ type: 'none', brightness: 0, contrast: 0 });
  const [isProcessing, setIsProcessing] = useState(false);

  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [baseImage, setBaseImage] = useState<HTMLImageElement | null>(null);
  const [previewBaseImage, setPreviewBaseImage] = useState<HTMLImageElement | null>(null);
  const [workingImageSrc, setWorkingImageSrc] = useState<string>(imageSrc);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  const imgRef = useRef<HTMLImageElement | null>(null);
  const webglEngineRef = useRef<WebGLPerspectiveEngine | null>(null);

  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [pipPreviewUrl, setPipPreviewUrl] = useState<string | null>(null);

  // Initialize WebGL engine and load base image
  useEffect(() => {
    webglEngineRef.current = new WebGLPerspectiveEngine();
    const img = new Image();
    img.onload = () => {
      setBaseImage(img);

      // Generate a downscaled version for smooth live rotation preview
      const scale = Math.min(1, 800 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const pImg = new Image();
      pImg.onload = () => {
        setPreviewBaseImage(pImg);
        imgRef.current = pImg;
        setCorners([
          { x: 0.05, y: 0.05 },
          { x: 0.95, y: 0.05 },
          { x: 0.95, y: 0.95 },
          { x: 0.05, y: 0.95 }
        ]);
      };
      pImg.src = canvas.toDataURL('image/jpeg', 0.8);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Handle Rotation by generating a working image from the PREVIEW image
  useEffect(() => {
    if (!previewBaseImage) return;
    if (rotation === 0) {
      setWorkingImageSrc(previewBaseImage.src);
      imgRef.current = previewBaseImage;
      return;
    }
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const rad = (rotation * Math.PI) / 180;
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));
    const newW = previewBaseImage.width * cos + previewBaseImage.height * sin;
    const newH = previewBaseImage.width * sin + previewBaseImage.height * cos;

    canvas.width = newW;
    canvas.height = newH;
    ctx.translate(newW / 2, newH / 2);
    ctx.rotate(rad);
    ctx.drawImage(previewBaseImage, -previewBaseImage.width / 2, -previewBaseImage.height / 2);

    // Fast encoding for live preview
    const rotatedSrc = canvas.toDataURL('image/jpeg', 0.6);
    setWorkingImageSrc(rotatedSrc);

    const rotatedImg = new Image();
    rotatedImg.onload = () => { imgRef.current = rotatedImg; };
    rotatedImg.src = rotatedSrc;
  }, [rotation, previewBaseImage]);

  const handleSetAspect = (newAspect?: number) => {
    setAspect(newAspect);
    if (!newAspect || !imgRef.current) return;

    const imgAspect = imgRef.current.width / imgRef.current.height;
    let w = 1.0;
    let h = 1.0;
    if (imgAspect > newAspect) {
      w = newAspect / imgAspect;
    } else {
      h = imgAspect / newAspect;
    }
    const x0 = (1 - w) / 2;
    const y0 = (1 - h) / 2;
    setCorners([
      { x: x0, y: y0 },
      { x: x0 + w, y: y0 },
      { x: x0 + w, y: y0 + h },
      { x: x0, y: y0 + h }
    ]);
  };

  // Update container size for the overlay
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerSize({ w: entries[0].contentRect.width, h: entries[0].contentRect.height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [tab]);

  // Handle updating PiP and main preview
  useEffect(() => {
    if (!imgRef.current || !webglEngineRef.current) return;

    if (tab === 'adjust') {
      updatePreview();
    } else if (tab === 'crop') {
      updatePipPreview();
    }
  }, [tab, filters, corners, workingImageSrc]);

  const updatePipPreview = () => {
    if (!imgRef.current || !webglEngineRef.current) return;

    const pixelCorners = corners.map(c => ({
      x: c.x * imgRef.current!.width,
      y: c.y * imgRef.current!.height
    }));

    // Calculate actual pixel width/height of the crop area
    const topW = Math.hypot(pixelCorners[1].x - pixelCorners[0].x, pixelCorners[1].y - pixelCorners[0].y);
    const bottomW = Math.hypot(pixelCorners[2].x - pixelCorners[3].x, pixelCorners[2].y - pixelCorners[3].y);
    const cropW = Math.max(topW, bottomW);

    const leftH = Math.hypot(pixelCorners[3].x - pixelCorners[0].x, pixelCorners[3].y - pixelCorners[0].y);
    const rightH = Math.hypot(pixelCorners[2].x - pixelCorners[1].x, pixelCorners[2].y - pixelCorners[1].y);
    const cropH = Math.max(leftH, rightH);

    if (cropW === 0 || cropH === 0) return;

    // Very small scale for real-time 60fps PiP (max 200px)
    const scale = Math.min(1, 200 / Math.max(cropW, cropH));
    const outW = Math.max(1, Math.round(cropW * scale));
    const outH = Math.max(1, Math.round(cropH * scale));

    const warpedCanvas = webglEngineRef.current.warp(imgRef.current, pixelCorners, outW, outH);
    setPipPreviewUrl(warpedCanvas.toDataURL('image/jpeg', 0.5));
  };

  const updatePreview = () => {
    if (!imgRef.current || !webglEngineRef.current) return;

    // 1. Warp Perspective
    // Convert normalized corners [0,1] back to pixel coordinates relative to original image
    const pixelCorners = corners.map(c => ({
      x: c.x * imgRef.current!.width,
      y: c.y * imgRef.current!.height
    }));

    // Calculate actual pixel width/height of the crop area
    const topW = Math.hypot(pixelCorners[1].x - pixelCorners[0].x, pixelCorners[1].y - pixelCorners[0].y);
    const bottomW = Math.hypot(pixelCorners[2].x - pixelCorners[3].x, pixelCorners[2].y - pixelCorners[3].y);
    const cropW = Math.max(topW, bottomW);

    const leftH = Math.hypot(pixelCorners[3].x - pixelCorners[0].x, pixelCorners[3].y - pixelCorners[0].y);
    const rightH = Math.hypot(pixelCorners[2].x - pixelCorners[1].x, pixelCorners[2].y - pixelCorners[1].y);
    const cropH = Math.max(leftH, rightH);

    if (cropW === 0 || cropH === 0) return;

    // Scale down for live preview performance (max 800px)
    const scale = Math.min(1, 800 / Math.max(cropW, cropH));
    const outW = Math.max(1, Math.round(cropW * scale));
    const outH = Math.max(1, Math.round(cropH * scale));

    const warpedCanvas = webglEngineRef.current.warp(imgRef.current, pixelCorners, outW, outH);

    // 2. Apply Filters
    const filteredCanvas = applyFilters(warpedCanvas, filters);

    setPreviewDataUrl(filteredCanvas.toDataURL('image/jpeg', 0.8));
  };

  const handleSave = async () => {
    if (!baseImage || !webglEngineRef.current) return;
    setIsProcessing(true);

    try {
      // 1. Bake rotation into FULL-RES baseImage
      let finalSourceImage = baseImage;
      if (rotation !== 0) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        const rad = (rotation * Math.PI) / 180;
        const sin = Math.abs(Math.sin(rad));
        const cos = Math.abs(Math.cos(rad));
        canvas.width = baseImage.width * cos + baseImage.height * sin;
        canvas.height = baseImage.width * sin + baseImage.height * cos;
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(rad);
        ctx.drawImage(baseImage, -baseImage.width / 2, -baseImage.height / 2);

        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            finalSourceImage = img;
            resolve();
          };
          img.src = canvas.toDataURL('image/jpeg', 1.0);
        });
      }

      // 2. Warp Full Resolution
      const pixelCorners = corners.map(c => ({
        x: c.x * finalSourceImage.width,
        y: c.y * finalSourceImage.height
      }));

      const topW = Math.hypot(pixelCorners[1].x - pixelCorners[0].x, pixelCorners[1].y - pixelCorners[0].y);
      const bottomW = Math.hypot(pixelCorners[2].x - pixelCorners[3].x, pixelCorners[2].y - pixelCorners[3].y);
      const outW = Math.round(Math.max(topW, bottomW));

      const leftH = Math.hypot(pixelCorners[3].x - pixelCorners[0].x, pixelCorners[3].y - pixelCorners[0].y);
      const rightH = Math.hypot(pixelCorners[2].x - pixelCorners[1].x, pixelCorners[2].y - pixelCorners[1].y);
      const outH = Math.round(Math.max(leftH, rightH));

      const warpedCanvas = webglEngineRef.current.warp(finalSourceImage, pixelCorners, outW, outH);

      // 3. Apply Filters
      const filteredCanvas = applyFilters(warpedCanvas, filters);

      // 4. Export
      filteredCanvas.toBlob((blob) => {
        if (blob) onSave(blob);
        else onCancel();
      }, 'image/jpeg', 0.92);

    } catch (e) {
      console.error("Save failed:", e);
      onCancel();
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-black overflow-hidden z-[9999]">
      <div className="flex-1 relative flex items-center justify-center p-4" ref={containerRef}>

        {tab === 'crop' && containerSize.w > 0 && (
          <>
            <PerspectiveOverlay
              imageSrc={workingImageSrc}
              corners={corners}
              onChange={setCorners}
              containerWidth={containerSize.w}
              containerHeight={containerSize.h}
              cropMode={cropMode}
            />
            {/* Live PiP Perspective Preview */}
            {pipPreviewUrl && (
              <div className="absolute top-4 right-4 z-50 pointer-events-none rounded-lg overflow-hidden border-2 border-white/30 shadow-2xl bg-black/50 backdrop-blur flex items-center justify-center w-28 h-28 sm:w-40 sm:h-40">
                <img
                  src={pipPreviewUrl}
                  alt="Live Warp Preview"
                  className="max-w-full max-h-full object-contain"
                />
                <div className="absolute bottom-0 left-0 w-full bg-black/60 text-[8px] text-white/80 text-center py-0.5 uppercase tracking-widest font-bold z-10">
                  Live Preview
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'adjust' && previewDataUrl && (
          <img
            src={previewDataUrl}
            alt="Preview"
            className="max-w-full max-h-full object-contain shadow-2xl transition-all"
          />
        )}

      </div>

      <ToolbarBottom
        currentTab={tab}
        setTab={setTab}
        filters={filters}
        setFilters={setFilters}
        onSave={handleSave}
        onCancel={onCancel}
        onResetCrop={() => {
          setCorners(DEFAULT_CORNERS);
          setRotation(0);
          setAspect(undefined);
        }}
        isProcessing={isProcessing}
        onSetAspect={handleSetAspect}
        aspect={aspect}
        onRotate90={() => setRotation(r => (r + 90) % 360)}
        rotation={rotation}
        onRotateCustom={setRotation}
        cropMode={cropMode}
        onToggleCropMode={() => {
          setCropMode(prev => {
            const nextMode = prev === 'perspective' ? 'rectangle' : 'perspective';
            if (nextMode === 'rectangle') {
              // Snap corners to bounding box
              const minX = Math.min(...corners.map(c => c.x));
              const maxX = Math.max(...corners.map(c => c.x));
              const minY = Math.min(...corners.map(c => c.y));
              const maxY = Math.max(...corners.map(c => c.y));
              setCorners([
                { x: minX, y: minY },
                { x: maxX, y: minY },
                { x: maxX, y: maxY },
                { x: minX, y: maxY }
              ]);
            }
            return nextMode;
          });
        }}
      />
    </div>
  );
}
