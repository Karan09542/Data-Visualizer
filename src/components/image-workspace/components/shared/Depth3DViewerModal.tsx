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
  Layers,
  Paintbrush,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
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
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);

  // Depth Mask & Overlay Refs
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const maskMeshRef = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null>(null);
  const planeDimsRef = useRef<{ width: number; height: number }>({ width: 1.15, height: 1.15 });

  // Undo / Redo stacks (STRICTLY LOCAL TO MODAL)
  const undoStackRef = useRef<ImageData[]>([]);
  const redoStackRef = useRef<ImageData[]>([]);
  const strokeStartSnapshotRef = useRef<ImageData | null>(null);
  const isPaintingRef = useRef(false);
  const lastUVRef = useRef<{ u: number; v: number } | null>(null);
  const lastPointerPosRef = useRef<{ x: number; y: number } | null>(null);

  // Tools & Display State
  const [activeTool, setActiveTool] = useState<'orbit' | 'brush' | 'eraser'>('orbit');
  const [brushSize, setBrushSize] = useState(32);
  const [showMaskOverlay, setShowMaskOverlay] = useState(true);
  const [show3DGlobe, setShow3DGlobe] = useState(false);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [hasMask, setHasMask] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: -100, y: -100 });
  const [isPointerInCanvas, setIsPointerInCanvas] = useState(false);

  // 3D Parameters State
  const [displacement, setDisplacement] = useState(0.35);
  const [isInverted, setIsInverted] = useState(false);
  const [isWireframe, setIsWireframe] = useState(false);
  const [isAutoRotating, setIsAutoRotating] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Ref to hold current state for handlers
  const showMaskOverlayRef = useRef(showMaskOverlay);
  showMaskOverlayRef.current = showMaskOverlay;

  /**
   * Updates mesh vertex Z values based on depthResult, displacement, inversion,
   * AND the brush mask (where mask alpha > 0 flattens depth to 0).
   */
  const updateMeshVertices = useCallback(() => {
    if (!meshRef.current || !depthResult || !maskCanvasRef.current) return;

    const geometry = meshRef.current.geometry;
    const posAttr = geometry.attributes.position;
    const uvAttr = geometry.attributes.uv;

    const maskW = maskCanvasRef.current.width;
    const maskH = maskCanvasRef.current.height;
    const maskCtx = maskCanvasRef.current.getContext('2d', { willReadFrequently: true });
    const maskData = maskCtx ? maskCtx.getImageData(0, 0, maskW, maskH).data : null;

    const depthW = depthResult.width;
    const depthH = depthResult.height;
    const rawDepth = depthResult.rawDepth;

    for (let i = 0; i < posAttr.count; i++) {
      const u = uvAttr.getX(i);
      const v = uvAttr.getY(i);

      const px = Math.min(depthW - 1, Math.max(0, Math.floor(u * depthW)));
      const py = Math.min(depthH - 1, Math.max(0, Math.floor((1 - v) * depthH)));
      const rawVal = rawDepth[py * depthW + px] || 0;
      const depthVal = isInverted ? (1 - rawVal) : rawVal;

      // Mask alpha determines depth reduction: 0 = full depth, 255 = 0 depth (flat)
      let depthFactor = 1.0;
      if (maskData) {
        const mx = Math.min(maskW - 1, Math.max(0, Math.floor(u * maskW)));
        const my = Math.min(maskH - 1, Math.max(0, Math.floor((1 - v) * maskH)));
        const maskAlpha = maskData[(my * maskW + mx) * 4 + 3];
        depthFactor = Math.max(0, 1.0 - (maskAlpha / 255));
      }

      posAttr.setZ(i, depthVal * depthFactor * displacement * 0.4);
    }

    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();

    if (maskTextureRef.current) {
      maskTextureRef.current.needsUpdate = true;
    }
  }, [depthResult, isInverted, displacement]);

  /**
   * Helper to check if mask has any painted pixels.
   */
  const checkMaskPixels = useCallback(() => {
    if (!maskCanvasRef.current) return false;
    const ctx = maskCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    const imgData = ctx.getImageData(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
    const data = imgData.data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 10) return true;
    }
    return false;
  }, []);

  /**
   * Pushes a mask snapshot onto the local undo stack.
   */
  const pushUndo = useCallback((snapshot: ImageData) => {
    undoStackRef.current.push(snapshot);
    if (undoStackRef.current.length > 30) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
    setHasMask(checkMaskPixels());
  }, [checkMaskPixels]);

  /**
   * Strictly Local Undo for brush strokes.
   */
  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0 || !maskCanvasRef.current) return;
    const ctx = maskCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const currentSnapshot = ctx.getImageData(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
    redoStackRef.current.push(currentSnapshot);

    const previousSnapshot = undoStackRef.current.pop()!;
    ctx.putImageData(previousSnapshot, 0, 0);

    updateMeshVertices();
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(true);
    setHasMask(checkMaskPixels());
  }, [updateMeshVertices, checkMaskPixels]);

  /**
   * Strictly Local Redo for brush strokes.
   */
  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0 || !maskCanvasRef.current) return;
    const ctx = maskCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const currentSnapshot = ctx.getImageData(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
    undoStackRef.current.push(currentSnapshot);

    const nextSnapshot = redoStackRef.current.pop()!;
    ctx.putImageData(nextSnapshot, 0, 0);

    updateMeshVertices();
    setCanUndo(true);
    setCanRedo(redoStackRef.current.length > 0);
    setHasMask(checkMaskPixels());
  }, [updateMeshVertices, checkMaskPixels]);

  /**
   * Resets the mask (restoring depth everywhere).
   */
  const handleClearMask = useCallback(() => {
    if (!maskCanvasRef.current) return;
    const ctx = maskCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const currentSnapshot = ctx.getImageData(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
    undoStackRef.current.push(currentSnapshot);
    redoStackRef.current = [];

    ctx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
    updateMeshVertices();
    setCanUndo(true);
    setCanRedo(false);
    setHasMask(false);
  }, [updateMeshVertices]);

  // Keyboard events: strictly isolated to modal (never leaks to ImageWorkspace or global undo/redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrlOrCmd = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Undo: Ctrl+Z (without Shift)
      if (ctrlOrCmd && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleUndo();
        return;
      }

      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if (ctrlOrCmd && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleRedo();
        return;
      }

      // Close modal on Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
        return;
      }

      // Brush size shortcuts: [ and ]
      if (e.key === '[' && !ctrlOrCmd) {
        e.preventDefault();
        e.stopPropagation();
        setBrushSize(s => Math.max(5, s - 5));
        return;
      }
      if (e.key === ']' && !ctrlOrCmd) {
        e.preventDefault();
        e.stopPropagation();
        setBrushSize(s => Math.min(120, s + 5));
        return;
      }

      // Tool switches: B for brush, E for eraser, V for orbit / navigate
      if (key === 'b' && !ctrlOrCmd) {
        e.preventDefault();
        e.stopPropagation();
        setActiveTool('brush');
        return;
      }
      if (key === 'e' && !ctrlOrCmd) {
        e.preventDefault();
        e.stopPropagation();
        setActiveTool('eraser');
        return;
      }
      if (key === 'v' && !ctrlOrCmd) {
        e.preventDefault();
        e.stopPropagation();
        setActiveTool('orbit');
        return;
      }
      if (key === 'x' && !ctrlOrCmd) {
        e.preventDefault();
        e.stopPropagation();
        setActiveTool(t => (t === 'brush' ? 'eraser' : 'brush'));
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [handleUndo, handleRedo, onClose]);

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

    // OrbitControls for natural 3D interaction
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

    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.addEventListener('dragging-changed', function (event) {
      if (controlsRef.current) {
        controlsRef.current.enabled = !event.value;
      }
    });
    transformControls.setMode('rotate');
    transformControls.visible = false;
    transformControls.enabled = false;
    scene.add(transformControls);
    transformControlsRef.current = transformControls;

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
    planeDimsRef.current = { width: planeWidth, height: planeHeight };

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

    const meshGroup = new THREE.Group();
    scene.add(meshGroup);
    meshGroupRef.current = meshGroup;

    const mesh = new THREE.Mesh(geometry, material);
    meshGroup.add(mesh);
    meshRef.current = mesh;

    // Mask Canvas & Overlay Mesh for visual feedback of painted regions
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = depthResult.width;
    maskCanvas.height = depthResult.height;
    maskCanvasRef.current = maskCanvas;

    const maskTexture = new THREE.CanvasTexture(maskCanvas);
    maskTexture.minFilter = THREE.LinearFilter;
    maskTexture.magFilter = THREE.LinearFilter;
    maskTextureRef.current = maskTexture;

    const maskMaterial = new THREE.MeshBasicMaterial({
      map: maskTexture,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      side: THREE.DoubleSide
    });

    const maskMesh = new THREE.Mesh(geometry, maskMaterial);
    maskMesh.visible = activeTool !== 'orbit' && showMaskOverlayRef.current;
    meshGroup.add(maskMesh);
    maskMeshRef.current = maskMesh;

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
      maskMaterial.dispose();
      texture.dispose();
      maskTexture.dispose();
      transformControls.dispose();
      if (renderer.domElement && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      meshRef.current = null;
      maskMeshRef.current = null;
      meshGroupRef.current = null;
      materialRef.current = null;
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      transformControlsRef.current = null;
      maskCanvasRef.current = null;
      maskTextureRef.current = null;
    };
  }, [depthResult, originalImage]);

  // Update mesh vertices whenever displacement or inversion changes
  useEffect(() => {
    updateMeshVertices();
  }, [updateMeshVertices]);

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

  // Mask overlay visibility toggle: only visible in brush or eraser mode
  useEffect(() => {
    if (maskMeshRef.current) {
      maskMeshRef.current.visible = activeTool !== 'orbit' && showMaskOverlay;
    }
  }, [activeTool, showMaskOverlay]);

  // TransformControls visibility
  useEffect(() => {
    if (transformControlsRef.current && meshGroupRef.current) {
      if (show3DGlobe && activeTool === 'orbit') {
        transformControlsRef.current.attach(meshGroupRef.current);
        transformControlsRef.current.visible = true;
        transformControlsRef.current.enabled = true;
      } else {
        transformControlsRef.current.detach();
        transformControlsRef.current.visible = false;
        transformControlsRef.current.enabled = false;
      }
    }
  }, [show3DGlobe, activeTool]);

  // OrbitControls configuration based on activeTool and show3DGlobe
  useEffect(() => {
    if (!controlsRef.current) return;
    const controls = controlsRef.current;
    
    if (activeTool === 'orbit') {
      controls.enabled = true;
      controls.enableRotate = true;
        
      if (!show3DGlobe) {
        // Restrict OrbitControls to Y-axis rotation only
        controls.minPolarAngle = Math.PI / 2;
        controls.maxPolarAngle = Math.PI / 2;
      } else {
        // Allow full orbital rotation
        controls.minPolarAngle = 0;
        controls.maxPolarAngle = Math.PI;
      }

      controls.minAzimuthAngle = -Infinity;
      controls.maxAzimuthAngle = Infinity;

      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
      };
      controls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN
      };
    } else {
      // When in Brush or Eraser mode:
      controls.enabled = true;
      controls.enableRotate = true;
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = Math.PI;
      controls.minAzimuthAngle = -Infinity;
      controls.maxAzimuthAngle = Infinity;
      
      controls.mouseButtons = {
        LEFT: null as any,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE
      };
      controls.touches = {
        ONE: null as any,
        TWO: THREE.TOUCH.DOLLY_PAN
      };
    }
  }, [activeTool, show3DGlobe]);

  /**
   * Accurate UV raycasting from client screen position to mesh surface.
   */
  const getUVFromClientPos = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current;
    const camera = cameraRef.current;
    const mesh = meshRef.current;
    if (!container || !camera || !mesh) return null;

    const rect = container.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      return null;
    }

    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

    // 1. Try direct raycast on the 3D displaced mesh
    const intersects = raycaster.intersectObject(mesh, false);
    if (intersects.length > 0 && intersects[0].uv) {
      return { u: intersects[0].uv.x, v: intersects[0].uv.y };
    }

    // 2. Fallback: raycast onto the mesh geometry plane in local space
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, mesh.position);
    const targetPoint = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, targetPoint)) {
      mesh.worldToLocal(targetPoint);
      const { width: pw, height: ph } = planeDimsRef.current;
      const u = targetPoint.x / pw + 0.5;
      const v = targetPoint.y / ph + 0.5;
      if (u >= -0.05 && u <= 1.05 && v >= -0.05 && v <= 1.05) {
        return {
          u: Math.max(0, Math.min(1, u)),
          v: Math.max(0, Math.min(1, v))
        };
      }
    }

    return null;
  }, []);

  /**
   * Draw a circular feathered brush dab onto the mask canvas.
   */
  const drawDab = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    isEraser: boolean
  ) => {
    ctx.save();
    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      const grad = ctx.createRadialGradient(x, y, radius * 0.4, x, y, radius);
      grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.globalCompositeOperation = 'source-over';
      const grad = ctx.createRadialGradient(x, y, radius * 0.35, x, y, radius);
      grad.addColorStop(0, 'rgba(239, 68, 68, 0.95)');
      grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }, []);

  /**
   * Draw continuous stroke line between two points to prevent dotted gaps.
   */
  const drawLine = useCallback((
    ctx: CanvasRenderingContext2D,
    x0: number, y0: number,
    x1: number, y1: number,
    radius: number,
    isEraser: boolean
  ) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const step = Math.max(1, radius * 0.25);
    const steps = Math.ceil(dist / step);

    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const x = x0 + dx * t;
      const y = y0 + dy * t;
      drawDab(ctx, x, y, radius, isEraser);
    }
  }, [drawDab]);

  /**
   * Pointer down handler: initiates brush or eraser stroke.
   */
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool === 'orbit' || e.button !== 0) return;

    // Strict guard: NEVER paint if clicking on the toolbar, buttons, sliders, or UI overlays
    const target = e.target as HTMLElement | null;
    if (target?.closest?.('[data-toolbar="true"], button, input, select, textarea, [data-no-paint="true"]')) {
      return;
    }

    // Temporarily pause OrbitControls while stroke is active so the 3D model never moves or jitters
    if (controlsRef.current) {
      controlsRef.current.enabled = false;
    }

    const container = containerRef.current;
    if (!container || !maskCanvasRef.current) return;

    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) {}

    const rect = container.getBoundingClientRect();
    setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setIsPointerInCanvas(true);

    const ctx = maskCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Snapshot state before stroke starts for Undo
    strokeStartSnapshotRef.current = ctx.getImageData(
      0,
      0,
      maskCanvasRef.current.width,
      maskCanvasRef.current.height
    );

    const uv = getUVFromClientPos(e.clientX, e.clientY);
    if (!uv) return;

    isPaintingRef.current = true;
    lastUVRef.current = uv;

    const maskW = maskCanvasRef.current.width;
    const maskH = maskCanvasRef.current.height;

    // Calibrate mask radius from screen brush size
    const uvRadius = (brushSize / Math.min(rect.width, rect.height)) * 1.6;
    const maskRadius = Math.max(2, uvRadius * maskW);

    const x = uv.u * maskW;
    const y = (1 - uv.v) * maskH;

    drawDab(ctx, x, y, maskRadius, activeTool === 'eraser');
    updateMeshVertices();
  };

  /**
   * Pointer move handler: paints along stroke path and updates circular brush cursor.
   */
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;

    // If pointer is over the toolbar or controls, do not paint and hide the brush indicator cursor
    const target = e.target as HTMLElement | null;
    const isOverUI = !!target?.closest?.('[data-toolbar="true"], button, input, select, textarea, [data-no-paint="true"]');

    if (isOverUI) {
      if (!isPaintingRef.current) {
        setIsPointerInCanvas(false);
      }
      if (activeTool === 'orbit') {
        lastPointerPosRef.current = { x: e.clientX, y: e.clientY };
      }
      return;
    }

    if (activeTool === 'orbit') {
      lastPointerPosRef.current = { x: e.clientX, y: e.clientY };
      const rect = container.getBoundingClientRect();
      setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setIsPointerInCanvas(true);
      return;
    }

    const rect = container.getBoundingClientRect();
    setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setIsPointerInCanvas(true);

    if (!isPaintingRef.current || !lastUVRef.current || !maskCanvasRef.current) return;
    const ctx = maskCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const uv = getUVFromClientPos(e.clientX, e.clientY);
    if (!uv) return;

    const maskW = maskCanvasRef.current.width;
    const maskH = maskCanvasRef.current.height;
    const uvRadius = (brushSize / Math.min(rect.width, rect.height)) * 1.6;
    const maskRadius = Math.max(2, uvRadius * maskW);

    const x0 = lastUVRef.current.u * maskW;
    const y0 = (1 - lastUVRef.current.v) * maskH;
    const x1 = uv.u * maskW;
    const y1 = (1 - uv.v) * maskH;

    drawLine(ctx, x0, y0, x1, y1, maskRadius, activeTool === 'eraser');
    lastUVRef.current = uv;
    updateMeshVertices();
  };

  /**
   * Pointer up handler: finishes stroke and registers with undo stack.
   */
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      if ((e.target as HTMLElement).hasPointerCapture?.(e.pointerId)) {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch (_) {}

    // Restore OrbitControls based on active tool
    if (controlsRef.current) {
      controlsRef.current.enabled = true;
    }

    // On mobile touch: hide brush indicator circle when finger lifts up
    if (e.pointerType === 'touch') {
      setIsPointerInCanvas(false);
    }

    if (e.button !== 0 && e.button !== -1) return;
    if (isPaintingRef.current && strokeStartSnapshotRef.current) {
      pushUndo(strokeStartSnapshotRef.current);
      strokeStartSnapshotRef.current = null;
    }
    isPaintingRef.current = false;
    lastUVRef.current = null;
  };

  // Reset Camera View
  const handleResetView = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(0, 0, 1.6);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.reset();
  }, []);

  /**
   * Captures the 3D snapshot with the mask overlay hidden, ensuring a clean render.
   */
  const getCleanCroppedCanvas = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return null;
    const wasVisible = maskMeshRef.current?.visible;
    if (maskMeshRef.current) maskMeshRef.current.visible = false;
    const cropCanvas = getCropped3DCanvas(rendererRef.current, sceneRef.current, cameraRef.current);
    if (maskMeshRef.current) maskMeshRef.current.visible = !!wasVisible;
    return cropCanvas;
  }, []);

  // Export as PNG file
  const handleExportPng = useCallback(() => {
    const cropCanvas = getCleanCroppedCanvas();
    if (!cropCanvas) return;
    const dataUrl = cropCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `depth-3d-model-${Date.now()}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [getCleanCroppedCanvas]);

  // Copy snapshot as PNG to clipboard
  const handleCopyAsPng = useCallback(async () => {
    const cropCanvas = getCleanCroppedCanvas();
    if (!cropCanvas) return;

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
  }, [getCleanCroppedCanvas, handleExportPng]);

  // Add 3D view as new layer in ImageWorkspace
  const handleAddToCanvas = useCallback(() => {
    const cropCanvas = getCleanCroppedCanvas();
    if (!cropCanvas || !canvas) return;

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
  }, [getCleanCroppedCanvas, canvas, sourceObj, updateLayers, onClose]);

  // Replace active image with current 3D view snapshot (UNIFORM SCALE)
  const handleReplaceImage = useCallback(() => {
    const cropCanvas = getCleanCroppedCanvas();
    if (!cropCanvas || !canvas) return;

    const dataUrl = cropCanvas.toDataURL('image/png');
    const obj = sourceObj;
    const oldWidth = obj.width || 1;
    const oldHeight = obj.height || 1;
    const oldScaleX = obj.scaleX || 1;
    const oldScaleY = obj.scaleY || 1;

    const oldVisualW = oldWidth * oldScaleX;
    const oldVisualH = oldHeight * oldScaleY;
    const oldCenterX = (obj.left || 0) + oldVisualW / 2;
    const oldCenterY = (obj.top || 0) + oldVisualH / 2;

    obj.setSrc(dataUrl, { crossOrigin: 'anonymous' } as any).then(() => {
      const newWidth = obj.width || 1;
      const newHeight = obj.height || 1;
      const uniformScale = Math.min(oldVisualW / newWidth, oldVisualH / newHeight);

      obj.set({
        scaleX: uniformScale,
        scaleY: uniformScale,
        left: oldCenterX - (newWidth * uniformScale) / 2,
        top: oldCenterY - (newHeight * uniformScale) / 2
      });
      obj.applyFilters();
      obj.setCoords();
      obj.dirty = true;
      canvas.renderAll();
      updateLayers();
      onClose();
    });
  }, [getCleanCroppedCanvas, canvas, sourceObj, updateLayers, onClose]);

  if (typeof document === 'undefined') return null;

  // Modern dynamic slider gradients
  const brushPercent = Math.round(((brushSize - 5) / (120 - 5)) * 100);
  const brushTrackColor = activeTool === 'eraser' ? '#38bdf8' : '#ef4444';
  const brushTrackGradient = `linear-gradient(to right, ${brushTrackColor} 0%, ${brushTrackColor} ${brushPercent}%, rgba(255,255,255,0.12) ${brushPercent}%, rgba(255,255,255,0.12) 100%)`;

  const depthPercent = Math.round(displacement * 100);
  const depthTrackGradient = `linear-gradient(to right, #6366f1 0%, #818cf8 ${depthPercent}%, rgba(255,255,255,0.12) ${depthPercent}%, rgba(255,255,255,0.12) 100%)`;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 backdrop-blur-md p-0 sm:p-4 md:p-6 select-none"
      onClick={onClose}
    >
      <div
        data-isolate-modal="true"
        className="relative w-full sm:max-w-[1150px] h-full sm:h-[88vh] sm:max-h-[850px] sm:min-h-[500px] bg-[#0c0c14] rounded-none sm:rounded-2xl border-0 sm:border border-white/10 shadow-none sm:shadow-[0_25px_60px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-3 sm:px-5 py-2 sm:py-3 bg-gradient-to-r from-[#131320] to-[#0c0c14] border-b border-white/[0.08] shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-7.5 h-7.5 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
              <Box size={15} className="text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h2 className="text-white font-semibold text-xs sm:text-sm tracking-wide whitespace-nowrap truncate">3D Depth Viewer</h2>
                <span className="hidden sm:inline-flex text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium whitespace-nowrap">
                  3D Mesh
                </span>
              </div>
              <p className="text-white/40 text-[10px] sm:text-[11px] hidden md:block truncate">
                Brush areas to flatten depth · Eraser to restore · Right-click rotates
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
        <div
          className="flex-1 min-h-0 relative overflow-hidden bg-[#07070d]"
          onContextMenu={e => e.preventDefault()}
        >
          {/* Floating Brush & Navigation Toolbar */}
          <div
            data-toolbar="true"
            className="absolute top-2 sm:top-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center max-w-[95vw] select-none pointer-events-auto cursor-default transition-all"
            onPointerDown={e => e.stopPropagation()}
            onPointerMove={e => e.stopPropagation()}
            onPointerUp={e => e.stopPropagation()}
            onPointerCancel={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            onMouseMove={e => e.stopPropagation()}
            onMouseUp={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            onPointerEnter={() => setIsPointerInCanvas(false)}
            onPointerLeave={() => setIsPointerInCanvas(true)}
          >
            {/* Unified Compact Glass Island */}
            <div className="flex flex-col sm:flex-row items-center gap-1.5 p-1 sm:p-1.5 rounded-2xl sm:rounded-full bg-[#0b0b14]/92 backdrop-blur-2xl border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.85)] w-auto transition-all">
              {/* Row 1: Tools + History + Mask Actions */}
              <div className="flex items-center gap-1 sm:gap-1.5">
                {/* Tool Mode Segmented Switch */}
                <div className="flex items-center gap-0.5 bg-white/[0.06] p-0.5 rounded-full border border-white/[0.06]">
                  {/* 3D Globe Toggle for Orbit Tool */}
                  {activeTool === 'orbit' && (
                    <div className="flex items-center mr-1 pr-1 border-r border-white/10">
                      <button
                        onClick={() => setShow3DGlobe(v => !v)}
                        className={`flex items-center justify-center gap-1.5 h-7 sm:h-7.5 px-2.5 sm:px-3 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                          show3DGlobe
                            ? 'bg-fuchsia-500 text-white shadow-sm shadow-fuchsia-500/40 font-semibold'
                            : 'text-white/60 hover:text-white hover:bg-white/10'
                        }`}
                        title="Toggle 3D Rotation Gizmo"
                      >
                        <Orbit size={13} />
                        <span className="hidden sm:inline">3D Globe</span>
                      </button>
                    </div>
                  )}

                  {/* Move Tool */}
                  <button
                    onClick={() => setActiveTool('orbit')}
                    className={`flex items-center justify-center gap-1.5 h-7 sm:h-7.5 px-2.5 sm:px-3 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                      activeTool === 'orbit'
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/40 font-semibold'
                        : 'text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                    title="Move Tool (V) - Drag to rotate, 2 fingers to zoom/pan"
                  >
                    <Move size={13} />
                    <span className="hidden sm:inline">Move</span>
                  </button>

                  {/* Depth Brush */}
                  <button
                    onClick={() => setActiveTool('brush')}
                    className={`flex items-center justify-center gap-1.5 h-7 sm:h-7.5 px-2.5 sm:px-3 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                      activeTool === 'brush'
                        ? 'bg-red-500 text-white shadow-sm shadow-red-500/40 font-semibold'
                        : 'text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                    title="Depth Brush (B) - Paint over areas to flatten 3D depth"
                  >
                    <Paintbrush size={13} />
                    <span className="hidden sm:inline">Brush</span>
                  </button>

                  {/* Eraser */}
                  <button
                    onClick={() => setActiveTool('eraser')}
                    className={`flex items-center justify-center gap-1.5 h-7 sm:h-7.5 px-2.5 sm:px-3 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                      activeTool === 'eraser'
                        ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/40 font-semibold'
                        : 'text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                    title="Eraser (E) - Restore 3D depth"
                  >
                    <Eraser size={13} />
                    <span className="hidden sm:inline">Eraser</span>
                  </button>
                </div>

                {/* Inline Brush Size for Desktop (hidden on mobile, shown on sm+) */}
                {activeTool !== 'orbit' && (
                  <div className="hidden sm:flex items-center gap-1.5 h-7.5 px-2.5 bg-white/[0.06] rounded-full border border-white/[0.06] animate-fadeIn">
                    <button
                      onClick={() => setBrushSize(s => Math.max(5, s - 5))}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/15 active:scale-95 transition-all"
                      title="Decrease Size ([)"
                    >
                      <Minus size={10} />
                    </button>
                    <input
                      type="range"
                      min="5"
                      max="120"
                      step="1"
                      value={brushSize}
                      onChange={e => setBrushSize(parseInt(e.target.value, 10))}
                      onPointerDown={e => e.stopPropagation()}
                      onPointerMove={e => e.stopPropagation()}
                      onPointerUp={e => e.stopPropagation()}
                      onMouseDown={e => e.stopPropagation()}
                      onMouseMove={e => e.stopPropagation()}
                      onMouseUp={e => e.stopPropagation()}
                      style={{ background: brushTrackGradient }}
                      className="w-20 md:w-24 h-1.5 rounded-full appearance-none cursor-pointer outline-none transition-all
                        [&::-webkit-slider-thumb]:appearance-none
                        [&::-webkit-slider-thumb]:w-3.5
                        [&::-webkit-slider-thumb]:h-3.5
                        [&::-webkit-slider-thumb]:rounded-full
                        [&::-webkit-slider-thumb]:bg-white
                        [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(255,255,255,0.9)]
                        [&::-webkit-slider-thumb]:border
                        [&::-webkit-slider-thumb]:border-white/60
                        [&::-webkit-slider-thumb]:transition-transform
                        [&::-webkit-slider-thumb]:active:scale-125
                        [&::-moz-range-thumb]:w-3.5
                        [&::-moz-range-thumb]:h-3.5
                        [&::-moz-range-thumb]:rounded-full
                        [&::-moz-range-thumb]:bg-white
                        [&::-moz-range-thumb]:border-0"
                    />
                    <button
                      onClick={() => setBrushSize(s => Math.min(120, s + 5))}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/15 active:scale-95 transition-all"
                      title="Increase Size (])"
                    >
                      <Plus size={10} />
                    </button>
                    <span className="px-1.5 py-0.5 rounded bg-white/[0.08] text-white/90 font-mono text-[10px] font-semibold tabular-nums shrink-0">
                      {brushSize}px
                    </span>
                  </div>
                )}

                <div className="w-px h-4 bg-white/15 mx-0.5" />

                {/* Undo & Redo (STRICTLY LOCAL TO MODAL) */}
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={handleUndo}
                    disabled={!canUndo}
                    className={`w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full flex items-center justify-center transition-all ${
                      canUndo
                        ? 'text-white/75 hover:text-white hover:bg-white/10 active:scale-95'
                        : 'text-white/20 cursor-not-allowed'
                    }`}
                    title="Undo Stroke (Ctrl+Z)"
                  >
                    <Undo2 size={13} />
                  </button>

                  <button
                    onClick={handleRedo}
                    disabled={!canRedo}
                    className={`w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full flex items-center justify-center transition-all ${
                      canRedo
                        ? 'text-white/75 hover:text-white hover:bg-white/10 active:scale-95'
                        : 'text-white/20 cursor-not-allowed'
                    }`}
                    title="Redo Stroke (Ctrl+Y / Ctrl+Shift+Z)"
                  >
                    <Redo2 size={13} />
                  </button>
                </div>

                {/* Mask Overlay Visibility & Clear */}
                <div className="flex items-center gap-0.5">
                  {activeTool !== 'orbit' && (
                    <button
                      onClick={() => setShowMaskOverlay(v => !v)}
                      className={`w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full flex items-center justify-center transition-all ${
                        showMaskOverlay
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm shadow-amber-500/10'
                          : 'text-white/40 hover:text-white hover:bg-white/10'
                      }`}
                      title={showMaskOverlay ? 'Hide Red Mask Highlight' : 'Show Red Mask Highlight'}
                    >
                      {showMaskOverlay ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                  )}

                  {hasMask && (
                    <button
                      onClick={handleClearMask}
                      className="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full flex items-center justify-center text-rose-300 hover:text-white bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 transition-all active:scale-95"
                      title="Clear Mask (Restore Full 3D Depth Everywhere)"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Row 2: Integrated Mobile Modern Slider (seamlessly inside the same card, no second floating pill!) */}
              {activeTool !== 'orbit' && (
                <div className="sm:hidden flex items-center justify-between gap-2.5 w-full pt-1 px-1 border-t border-white/[0.08] animate-fadeIn">
                  <button
                    onClick={() => setBrushSize(s => Math.max(5, s - 5))}
                    className="w-5.5 h-5.5 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/15 active:scale-95 transition-all shrink-0"
                    title="Decrease Size"
                  >
                    <Minus size={10} />
                  </button>
                  <div className="flex-1 relative flex items-center min-w-0">
                    <input
                      type="range"
                      min="5"
                      max="120"
                      step="1"
                      value={brushSize}
                      onChange={e => setBrushSize(parseInt(e.target.value, 10))}
                      onPointerDown={e => e.stopPropagation()}
                      onPointerMove={e => e.stopPropagation()}
                      onPointerUp={e => e.stopPropagation()}
                      onMouseDown={e => e.stopPropagation()}
                      onMouseMove={e => e.stopPropagation()}
                      onMouseUp={e => e.stopPropagation()}
                      style={{ background: brushTrackGradient }}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer outline-none transition-all
                        [&::-webkit-slider-thumb]:appearance-none
                        [&::-webkit-slider-thumb]:w-3.5
                        [&::-webkit-slider-thumb]:h-3.5
                        [&::-webkit-slider-thumb]:rounded-full
                        [&::-webkit-slider-thumb]:bg-white
                        [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(255,255,255,0.9)]
                        [&::-webkit-slider-thumb]:border
                        [&::-webkit-slider-thumb]:border-white/60
                        [&::-webkit-slider-thumb]:transition-transform
                        [&::-webkit-slider-thumb]:active:scale-125
                        [&::-moz-range-thumb]:w-3.5
                        [&::-moz-range-thumb]:h-3.5
                        [&::-moz-range-thumb]:rounded-full
                        [&::-moz-range-thumb]:bg-white
                        [&::-moz-range-thumb]:border-0"
                    />
                  </div>
                  <button
                    onClick={() => setBrushSize(s => Math.min(120, s + 5))}
                    className="w-5.5 h-5.5 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/15 active:scale-95 transition-all shrink-0"
                    title="Increase Size"
                  >
                    <Plus size={10} />
                  </button>
                  <span className="px-1.5 py-0.5 rounded bg-white/[0.08] text-white/90 font-mono text-[10px] font-semibold tabular-nums shrink-0">
                    {brushSize}px
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Three.js Canvas Mount */}
          <div
            ref={containerRef}
            className={`w-full h-full ${
              activeTool === 'orbit' ? 'cursor-grab active:cursor-grabbing' : 'cursor-none'
            }`}
            style={{ touchAction: 'none' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerEnter={(e) => {
              if (e.pointerType !== 'touch') {
                setIsPointerInCanvas(true);
              }
            }}
            onPointerLeave={(e) => {
              if (!isPaintingRef.current || e.pointerType === 'touch') {
                setIsPointerInCanvas(false);
              }
            }}
          />

          {/* High-precision Brush Indicator Cursor */}
          {activeTool !== 'orbit' && isPointerInCanvas && (
            <div
              className="pointer-events-none absolute rounded-full border shadow-[0_0_12px_rgba(0,0,0,0.6)] -translate-x-1/2 -translate-y-1/2 transition-[width,height] duration-75 z-20"
              style={{
                left: cursorPos.x,
                top: cursorPos.y,
                width: brushSize * 2,
                height: brushSize * 2,
                borderColor: activeTool === 'brush' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(56, 189, 248, 0.95)',
                backgroundColor: activeTool === 'brush' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)'
              }}
            >
              {/* Center crosshair dot */}
              <div
                className="absolute top-1/2 left-1/2 w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  backgroundColor: activeTool === 'brush' ? '#ef4444' : '#38bdf8'
                }}
              />
            </div>
          )}

          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#07070d] pointer-events-none z-10">
              <div className="flex flex-col items-center gap-3">
                <div className="w-9 h-9 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-white/60 text-xs font-medium tracking-wide">Building 3D Mesh…</span>
              </div>
            </div>
          )}

          {/* Quick interactive floating guide */}
          <div className="absolute bottom-3 left-3 pointer-events-none hidden md:flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-black/75 backdrop-blur-md border border-white/10 text-[11px] text-white/80 shadow-lg z-10">
            {activeTool === 'orbit' ? (
              <>
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
              </>
            ) : (
              <>
                <span className="flex items-center gap-1.5">
                  <Paintbrush size={13} className="text-red-400" />
                  <span>Left Drag: {activeTool === 'brush' ? 'Flatten Depth' : 'Restore Depth'}</span>
                </span>
                <span className="text-white/20">|</span>
                <span className="flex items-center gap-1.5">
                  <Orbit size={13} className="text-indigo-400" />
                  <span>Right Drag: Rotate 3D</span>
                </span>
                <span className="text-white/20">|</span>
                <span className="text-white/60 font-mono text-[10px]">
                  [ ] Size · Ctrl+Z Undo
                </span>
              </>
            )}
          </div>
        </div>

        {/* Bottom Controls Bar */}
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
                  className="w-6 h-6 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-all active:scale-95 shrink-0"
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
                  style={{ background: depthTrackGradient }}
                  className="flex-1 sm:w-28 md:w-32 h-1.5 rounded-full appearance-none cursor-pointer outline-none transition-all
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-3.5
                    [&::-webkit-slider-thumb]:h-3.5
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-white
                    [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(99,102,241,0.8)]
                    [&::-webkit-slider-thumb]:border
                    [&::-webkit-slider-thumb]:border-white/60
                    [&::-webkit-slider-thumb]:transition-transform
                    [&::-webkit-slider-thumb]:active:scale-125
                    [&::-moz-range-thumb]:w-3.5
                    [&::-moz-range-thumb]:h-3.5
                    [&::-moz-range-thumb]:rounded-full
                    [&::-moz-range-thumb]:bg-white
                    [&::-moz-range-thumb]:border-0
                    [&::-moz-range-thumb]:shadow-[0_0_10px_rgba(99,102,241,0.8)]"
                />
                <button
                  onClick={() => setDisplacement(d => Math.min(1, Math.round((d + 0.05) * 100) / 100))}
                  className="w-6 h-6 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-all active:scale-95 shrink-0"
                  title="Increase Depth"
                >
                  <Plus size={11} />
                </button>
                <span className="px-1.5 py-0.5 rounded bg-white/[0.08] text-indigo-300 text-[11px] font-mono font-medium tabular-nums w-10 text-center shrink-0">
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
              <span className="hidden sm:inline">Reset View</span>
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
