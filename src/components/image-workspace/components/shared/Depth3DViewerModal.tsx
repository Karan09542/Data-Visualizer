import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ImagePlus,
  Replace,
  RotateCcw,
  Minus,
  Plus,
  Copy,
  Check,
  Play,
  Pause,
  Box,
  FlipHorizontal,
  Download,
  Orbit,
  Move,
  ZoomIn,
  Sliders,
  Layers
} from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as fabric from 'fabric';
import { DepthEstimationResult } from '../../../../ai/types';

interface Depth3DViewerModalProps {
  depthResult: DepthEstimationResult;
  originalImage: ImageData;
  sourceObj: fabric.Image;
  canvas: fabric.Canvas;
  updateLayers: () => void;
  onClose: () => void;
}

/**
 * Captures the 3D model with transparent background and auto-crops
 * away empty padding so the exported/replaced image tightly frames the 3D subject
 * without distortion or giant black bars.
 */
function getCropped3DCanvas(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera
): HTMLCanvasElement {
  // Ensure the scene is freshly rendered
  renderer.render(scene, camera);
  const webglCanvas = renderer.domElement;
  const w = webglCanvas.width;
  const h = webglCanvas.height;

  // Draw to 2D canvas to inspect alpha pixels
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = w;
  tempCanvas.height = h;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return webglCanvas;

  tempCtx.drawImage(webglCanvas, 0, 0);
  const imgData = tempCtx.getImageData(0, 0, w, h);
  const data = imgData.data;

  let minX = w, minY = h, maxX = -1, maxY = -1;

  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++) {
      const alpha = data[row + x * 4 + 3];
      if (alpha > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // If no transparent pixels found or bounding box is invalid, return original canvas
  if (maxX <= minX || maxY <= minY) {
    return tempCanvas;
  }

  // Add 16px clean padding around the 3D model
  const pad = 16;
  const cropX = Math.max(0, minX - pad);
  const cropY = Math.max(0, minY - pad);
  const cropW = Math.min(w - cropX, (maxX - minX + 1) + pad * 2);
  const cropH = Math.min(h - cropY, (maxY - minY + 1) + pad * 2);

  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = cropW;
  cropCanvas.height = cropH;
  const cropCtx = cropCanvas.getContext('2d');
  if (!cropCtx) return tempCanvas;

  cropCtx.drawImage(tempCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  return cropCanvas;
}

export const Depth3DViewerModal: React.FC<Depth3DViewerModalProps> = ({
  depthResult,
  originalImage,
  sourceObj,
  canvas,
  updateLayers,
  onClose
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshRef = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial> | null>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);

  const [displacement, setDisplacement] = useState(0.35);
  const [isInverted, setIsInverted] = useState(false);
  const [isWireframe, setIsWireframe] = useState(false);
  const [isAutoRotating, setIsAutoRotating] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Main Three.js setup
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = Math.max(container.clientWidth || 800, 300);
    const height = Math.max(container.clientHeight || 500, 300);

    // Scene with transparent background so snapshots don't have solid black boxes
    const scene = new THREE.Scene();
    scene.background = null;
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 1.6);
    cameraRef.current = camera;

    // WebGL Renderer with alpha transparency and preserved drawing buffer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.outline = 'none';
    renderer.domElement.style.userSelect = 'none';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // OrbitControls for natural 3D interaction (drag rotate, right-click pan, scroll zoom)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.rotateSpeed = 0.85;
    controls.zoomSpeed = 1.0;
    controls.panSpeed = 0.8;
    controls.minDistance = 0.35;
    controls.maxDistance = 6.0;
    controls.target.set(0, 0, 0);
    controls.autoRotate = false;
    controls.autoRotateSpeed = 2.0;
    controlsRef.current = controls;

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 0.9);
    mainLight.position.set(2, 3, 4);
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x818cf8, 0.35);
    fillLight.position.set(-3, -1, 2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xc084fc, 0.3);
    rimLight.position.set(0, -3, -3);
    scene.add(rimLight);

    // Create texture from original image
    const imgCanvas = document.createElement('canvas');
    imgCanvas.width = originalImage.width;
    imgCanvas.height = originalImage.height;
    const imgCtx = imgCanvas.getContext('2d')!;
    imgCtx.putImageData(originalImage, 0, 0);

    const texture = new THREE.CanvasTexture(imgCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    // Create plane geometry
    const aspect = originalImage.width / originalImage.height;
    const segmentsX = Math.min(256, Math.max(64, Math.round(128 * aspect)));
    const segmentsY = Math.min(256, Math.max(64, Math.round(128 / aspect)));

    const planeWidth = aspect >= 1 ? 1.15 : 1.15 * aspect;
    const planeHeight = aspect >= 1 ? 1.15 / aspect : 1.15;

    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, segmentsX, segmentsY);

    // Initial vertex displacement from depth map
    const posAttr = geometry.attributes.position;
    const uvAttr = geometry.attributes.uv;

    for (let i = 0; i < posAttr.count; i++) {
      const u = uvAttr.getX(i);
      const v = uvAttr.getY(i);

      const px = Math.min(depthResult.width - 1, Math.max(0, Math.floor(u * depthResult.width)));
      const py = Math.min(depthResult.height - 1, Math.max(0, Math.floor((1 - v) * depthResult.height)));
      const depthVal = depthResult.rawDepth[py * depthResult.width + px] || 0;

      posAttr.setZ(i, depthVal * 0.35 * 0.4);
    }
    geometry.computeVertexNormals();

    // Material with transparent support and alphaTest so cutouts stay clean
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      side: THREE.DoubleSide,
      roughness: 0.6,
      metalness: 0.08,
      transparent: true,
      alphaTest: 0.02,
      wireframe: false
    });
    materialRef.current = material;

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    meshRef.current = mesh;

    setIsLoaded(true);

    // Animation loop
    let rafId = 0;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // ResizeObserver for reliable dimension tracking
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      texture.dispose();
      if (renderer.domElement && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      meshRef.current = null;
      materialRef.current = null;
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, [depthResult, originalImage]);

  // Real-time displacement & inversion updates (fast vertex update, no re-initialization)
  useEffect(() => {
    if (!meshRef.current || !depthResult) return;

    const geometry = meshRef.current.geometry;
    const posAttr = geometry.attributes.position;
    const uvAttr = geometry.attributes.uv;

    for (let i = 0; i < posAttr.count; i++) {
      const u = uvAttr.getX(i);
      const v = uvAttr.getY(i);

      const px = Math.min(depthResult.width - 1, Math.max(0, Math.floor(u * depthResult.width)));
      const py = Math.min(depthResult.height - 1, Math.max(0, Math.floor((1 - v) * depthResult.height)));
      const rawVal = depthResult.rawDepth[py * depthResult.width + px] || 0;
      const depthVal = isInverted ? (1 - rawVal) : rawVal;

      posAttr.setZ(i, depthVal * displacement * 0.4);
    }

    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
  }, [displacement, isInverted, depthResult]);

  // Wireframe toggle
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.wireframe = isWireframe;
      materialRef.current.needsUpdate = true;
    }
  }, [isWireframe]);

  // Auto-rotate toggle
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = isAutoRotating;
    }
  }, [isAutoRotating]);

  // Reset Camera View
  const handleResetView = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(0, 0, 1.6);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.reset();
  }, []);

  // Export as PNG file
  const handleExportPng = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    const cropCanvas = getCropped3DCanvas(rendererRef.current, sceneRef.current, cameraRef.current);
    const dataUrl = cropCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `depth-3d-model-${Date.now()}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  // Copy snapshot as PNG to clipboard
  const handleCopyAsPng = useCallback(async () => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    const cropCanvas = getCropped3DCanvas(rendererRef.current, sceneRef.current, cameraRef.current);

    try {
      cropCanvas.toBlob(async (blob) => {
        if (!blob) {
          handleExportPng();
          return;
        }
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2200);
        } catch (clipboardErr) {
          console.warn('Clipboard write failed, triggering download fallback:', clipboardErr);
          handleExportPng();
        }
      }, 'image/png');
    } catch (e) {
      console.warn('toBlob failed, triggering download fallback:', e);
      handleExportPng();
    }
  }, [handleExportPng]);

  // Add 3D view as new layer in ImageWorkspace
  const handleAddToCanvas = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !canvas) return;

    const cropCanvas = getCropped3DCanvas(rendererRef.current, sceneRef.current, cameraRef.current);
    const dataUrl = cropCanvas.toDataURL('image/png');

    const img = new Image();
    img.onload = () => {
      const origVisualW = (sourceObj.width || 1) * (sourceObj.scaleX || 1);
      const origVisualH = (sourceObj.height || 1) * (sourceObj.scaleY || 1);
      const uniformScale = Math.min(origVisualW / img.width, origVisualH / img.height);

      const fabricImg = new fabric.Image(img, {
        left: (sourceObj.left || 0) + 30,
        top: (sourceObj.top || 0) + 30,
        scaleX: uniformScale,
        scaleY: uniformScale,
        name: '3D Depth Model',
        data: { ai3DDepth: true }
      } as any);
      canvas.add(fabricImg);
      canvas.setActiveObject(fabricImg);
      canvas.renderAll();
      updateLayers();
      onClose();
    };
    img.src = dataUrl;
  }, [canvas, sourceObj, updateLayers, onClose]);

  // Replace active image with current 3D view snapshot (UNIFORM SCALE: no shrink, no distortion)
  const handleReplaceImage = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !canvas) return;

    const cropCanvas = getCropped3DCanvas(rendererRef.current, sceneRef.current, cameraRef.current);
    const dataUrl = cropCanvas.toDataURL('image/png');

    const obj = sourceObj;
    const oldWidth = obj.width || 1;
    const oldHeight = obj.height || 1;
    const oldScaleX = obj.scaleX || 1;
    const oldScaleY = obj.scaleY || 1;

    // Visual dimensions and center of the target image before replacement
    const oldVisualW = oldWidth * oldScaleX;
    const oldVisualH = oldHeight * oldScaleY;
    const oldCenterX = (obj.left || 0) + (oldVisualW / 2);
    const oldCenterY = (obj.top || 0) + (oldVisualH / 2);

    obj.setSrc(dataUrl, { crossOrigin: 'anonymous' } as any).then(() => {
      const newWidth = obj.width || 1;
      const newHeight = obj.height || 1;

      // Fit uniformly within the original bounds — preserving natural aspect ratio
      const uniformScale = Math.min(oldVisualW / newWidth, oldVisualH / newHeight);

      obj.set({
        scaleX: uniformScale,
        scaleY: uniformScale,
        left: oldCenterX - (newWidth * uniformScale) / 2,
        top: oldCenterY - (newHeight * uniformScale) / 2,
      });
      obj.applyFilters();
      obj.setCoords();
      obj.dirty = true;
      canvas.renderAll();
      updateLayers();
      onClose();
    });
  }, [canvas, sourceObj, updateLayers, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 backdrop-blur-md p-0 sm:p-4 md:p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-[1100px] h-full sm:h-[85vh] sm:max-h-[820px] sm:min-h-[480px] bg-[#0c0c14] rounded-none sm:rounded-2xl border-0 sm:border border-white/10 shadow-none sm:shadow-[0_25px_60px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-3.5 sm:px-5 py-2.5 sm:py-3.5 bg-gradient-to-r from-[#131320] to-[#0c0c14] border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
              <Box size={16} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-white font-semibold text-xs sm:text-sm tracking-wide">3D Depth Viewer</h2>
                <span className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
                  3D
                </span>
              </div>
              <p className="text-white/40 text-[10px] sm:text-[11px] hidden md:block">
                Drag left click to rotate · Right click to pan · Scroll wheel to zoom
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Auto-rotate Toggle */}
            <button
              onClick={() => setIsAutoRotating(v => !v)}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isAutoRotating
                  ? 'bg-indigo-500/25 text-indigo-300 border border-indigo-500/40'
                  : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/5'
              }`}
              title="Toggle Auto Rotation"
            >
              {isAutoRotating ? <Pause size={13} /> : <Play size={13} />}
              <span className="hidden md:inline">{isAutoRotating ? 'Pause' : 'Auto'}</span>
            </button>

            {/* Wireframe Toggle */}
            <button
              onClick={() => setIsWireframe(v => !v)}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isWireframe
                  ? 'bg-purple-500/25 text-purple-300 border border-purple-500/40'
                  : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/5'
              }`}
              title="Toggle 3D Wireframe Mesh"
            >
              <Layers size={13} />
              <span className="hidden md:inline">Wireframe</span>
            </button>

            {/* Invert Depth */}
            <button
              onClick={() => setIsInverted(v => !v)}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isInverted
                  ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                  : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/5'
              }`}
              title="Invert Depth Map"
            >
              <FlipHorizontal size={13} />
              <span className="hidden md:inline">Invert</span>
            </button>

            <div className="w-px h-5 bg-white/10 mx-0.5 sm:mx-1" />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-300 transition-all border border-white/5 hover:border-red-500/30"
              title="Close (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 3D Canvas Area */}
        <div className="flex-1 min-h-0 relative overflow-hidden bg-[#07070d]">
          {/* Dedicated Three.js canvas mount container (no React children to prevent DOM mismatch) */}
          <div
            ref={containerRef}
            className="w-full h-full cursor-grab active:cursor-grabbing"
            style={{ touchAction: 'none' }}
          />

          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#07070d] pointer-events-none">
              <div className="flex flex-col items-center gap-3">
                <div className="w-9 h-9 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-white/60 text-xs font-medium tracking-wide">Building 3D Mesh…</span>
              </div>
            </div>
          )}

          {/* Quick interactive floating guide (clean Lucide icons instead of emojis) */}
          <div className="absolute bottom-3 left-3 pointer-events-none hidden md:flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-black/75 backdrop-blur-md border border-white/10 text-[11px] text-white/80 shadow-lg">
            <span className="flex items-center gap-1.5">
              <Orbit size={13} className="text-indigo-400" />
              <span>Rotate: Drag Left</span>
            </span>
            <span className="text-white/20">|</span>
            <span className="flex items-center gap-1.5">
              <Move size={13} className="text-cyan-400" />
              <span>Pan: Drag Right</span>
            </span>
            <span className="text-white/20">|</span>
            <span className="flex items-center gap-1.5">
              <ZoomIn size={13} className="text-purple-400" />
              <span>Zoom: Scroll</span>
            </span>
          </div>
        </div>

        {/* Bottom Controls Bar (always visible, fully responsive for mobile fullscreen) */}
        <div className="px-3 sm:px-5 py-2.5 sm:py-3.5 bg-[#090911] border-t border-white/[0.08] shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 select-none pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {/* Top Row on Mobile / Left on Desktop: Depth Slider & Reset */}
          <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 sm:flex-initial">
              <span className="flex items-center gap-1.5 text-white/50 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap">
                <Sliders size={13} className="text-indigo-400" />
                <span>Depth</span>
              </span>
              <div className="flex items-center gap-1 sm:gap-1.5 bg-white/5 px-2 py-1 rounded-xl border border-white/10 flex-1 sm:flex-initial">
                <button
                  onClick={() => setDisplacement(d => Math.max(0, Math.round((d - 0.05) * 100) / 100))}
                  className="w-6 h-6 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-all active:scale-95"
                  title="Decrease Depth"
                >
                  <Minus size={11} />
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={displacement}
                  onChange={e => setDisplacement(parseFloat(e.target.value))}
                  className="flex-1 sm:w-28 md:w-32 h-1.5 accent-indigo-500 bg-white/10 rounded-full cursor-pointer"
                />
                <button
                  onClick={() => setDisplacement(d => Math.min(1, Math.round((d + 0.05) * 100) / 100))}
                  className="w-6 h-6 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-all active:scale-95"
                  title="Increase Depth"
                >
                  <Plus size={11} />
                </button>
                <span className="text-indigo-300 text-xs font-mono font-medium tabular-nums w-8 text-right">
                  {Math.round(displacement * 100)}%
                </span>
              </div>
            </div>

            {/* Reset View Button */}
            <button
              onClick={handleResetView}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-medium transition-all border border-white/5 hover:border-white/15 shrink-0"
              title="Reset Camera Angle & Zoom"
            >
              <RotateCcw size={12} />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>

          {/* Bottom Row on Mobile / Right on Desktop: Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5 sm:py-0">
            {/* Copy as PNG */}
            <button
              onClick={handleCopyAsPng}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all border whitespace-nowrap ${
                copied
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                  : 'bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border-white/10 hover:border-white/20'
              }`}
              title="Copy 3D snapshot to clipboard as PNG"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{copied ? 'Copied!' : 'Copy PNG'}</span>
            </button>

            {/* Export PNG (Download) */}
            <button
              onClick={handleExportPng}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-medium transition-all border border-white/10 hover:border-white/20 whitespace-nowrap"
              title="Download 3D snapshot as PNG file"
            >
              <Download size={13} />
              <span>Export</span>
            </button>

            {/* Add as New Layer */}
            <button
              onClick={handleAddToCanvas}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500/20 to-blue-500/20 hover:from-indigo-500/30 hover:to-blue-500/30 text-indigo-200 hover:text-white text-xs font-medium transition-all border border-indigo-500/30 hover:border-indigo-500/50 shadow-sm whitespace-nowrap"
              title="Add current 3D view as new layer to workspace"
            >
              <ImagePlus size={13} />
              <span>Add Layer</span>
            </button>

            {/* Replace Image */}
            <button
              onClick={handleReplaceImage}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 text-purple-200 hover:text-white text-xs font-medium transition-all border border-purple-500/30 hover:border-purple-500/50 shadow-sm whitespace-nowrap"
              title="Replace selected image with current 3D view"
            >
              <Replace size={13} />
              <span>Replace</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
