import { TaskPipeline, PipelineExecutionArgs } from '../registry/TaskRegistry';
import { LiteRTRuntime } from '../runtime/LiteRTRuntime';
import { aiSessionManager } from '../runtime/AISessionManager';
import { imageToImageData } from '../utils';
import { AIProgressState, FaceDetectionResult, DetectedFace, Point2D } from '../types';

/**
 * BlazeFace SSD anchor configuration.
 * Short-range: 128×128 input, 896 anchors
 * Full-range:  192×192 input, 2016 anchors (not yet supported — falls back to short-range anchors)
 *
 * Each anchor is decoded as:
 *   cx = anchor_cx + regressor[0] * anchor_w
 *   cy = anchor_cy + regressor[1] * anchor_h
 *   w  = anchor_w  * exp(regressor[2])    ← NOT used; BlazeFace stores w/h directly
 *   h  = anchor_h  * exp(regressor[3])    ← same note
 *
 * BlazeFace actually stores raw offsets for the bbox center and size,
 * plus 6 keypoint (x, y) pairs = 16 values per anchor.
 *
 * Output tensors:
 *   [0] regressors — shape [1, numAnchors, 16]
 *   [1] classifiers — shape [1, numAnchors, 1]
 */

// ----- Anchor generation (matches MediaPipe's SSD anchors for BlazeFace) -----

interface Anchor {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

function generateAnchors(inputSize: number): Anchor[] {
  // BlazeFace short-range (128×128) uses these layer configs:
  // strides: [8, 16, 16, 16]
  // num_anchors per location: [2, 6]  (2 for stride-8, 6 for stride-16)
  const strides = inputSize === 128 ? [8, 16, 16, 16] : [4, 8, 8, 16, 16, 16];
  const anchorsPerStride = inputSize === 128 ? [2, 6, 6, 6] : [2, 2, 6, 6, 6, 6];

  // For short-range, typical layer structure produces 896 anchors:
  //   128/8 = 16 → 16×16×2 = 512
  //   128/16 = 8 → 8×8×6  = 384
  //   Total = 896
  // (MediaPipe collapses 3 stride-16 layers into one with 6 anchors)

  // Simplified: use the MediaPipe approach
  if (inputSize === 128) {
    return generateAnchorsShortRange(inputSize);
  } else {
    return generateAnchorsFullRange(inputSize);
  }
}

function generateAnchorsShortRange(inputSize: number): Anchor[] {
  const anchors: Anchor[] = [];

  // Layer 0: stride 8, 2 anchors per cell
  const stride8 = 8;
  const gridSize8 = Math.floor(inputSize / stride8); // 16
  for (let y = 0; y < gridSize8; y++) {
    for (let x = 0; x < gridSize8; x++) {
      const cx = (x + 0.5) / gridSize8;
      const cy = (y + 0.5) / gridSize8;
      anchors.push({ cx, cy, w: 1.0, h: 1.0 });
      anchors.push({ cx, cy, w: 1.0, h: 1.0 });
    }
  }

  // Layer 1: stride 16, 6 anchors per cell
  const stride16 = 16;
  const gridSize16 = Math.floor(inputSize / stride16); // 8
  for (let y = 0; y < gridSize16; y++) {
    for (let x = 0; x < gridSize16; x++) {
      const cx = (x + 0.5) / gridSize16;
      const cy = (y + 0.5) / gridSize16;
      for (let k = 0; k < 6; k++) {
        anchors.push({ cx, cy, w: 1.0, h: 1.0 });
      }
    }
  }

  return anchors; // Should be 896
}

function generateAnchorsFullRange(inputSize: number): Anchor[] {
  const anchors: Anchor[] = [];

  // Full-range uses 192×192 with different strides
  // Strides: [4] with 1 anchor, then [8, 8, 16] with various anchors
  // This produces ~2016 anchors. Simplified approximation:
  
  const configs = [
    { stride: 4, numAnchors: 2 },
    { stride: 8, numAnchors: 6 },
  ];

  for (const cfg of configs) {
    const gridSize = Math.floor(inputSize / cfg.stride);
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const cx = (x + 0.5) / gridSize;
        const cy = (y + 0.5) / gridSize;
        for (let k = 0; k < cfg.numAnchors; k++) {
          anchors.push({ cx, cy, w: 1.0, h: 1.0 });
        }
      }
    }
  }

  return anchors;
}

// ----- NMS (Non-Maximum Suppression) -----

function iou(a: DOMRect, b: DOMRect): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = a.width * a.height;
  const areaB = b.width * b.height;

  return intersection / (areaA + areaB - intersection + 1e-6);
}

function nms(detections: DetectedFace[], iouThreshold: number): DetectedFace[] {
  const sorted = [...detections].sort((a, b) => b.score - a.score);
  const kept: DetectedFace[] = [];

  for (const det of sorted) {
    let dominated = false;
    for (const k of kept) {
      if (iou(det.boundingBox, k.boundingBox) > iouThreshold) {
        dominated = true;
        break;
      }
    }
    if (!dominated) kept.push(det);
  }

  return kept;
}

// ----- Pipeline -----

export class FaceDetectionPipeline implements TaskPipeline {
  private runtime: LiteRTRuntime | null = null;
  private modelId = 'blaze_face_short_range';
  private inputSize = 128;
  private scaleX = 1;
  private scaleY = 1;
  private offsetX = 0;
  private offsetY = 0;
  private origWidth = 0;
  private origHeight = 0;

  setRuntime(runtime: LiteRTRuntime) {
    this.runtime = runtime;
  }

  async preload(): Promise<void> {
    await aiSessionManager.getRuntime(this.modelId);
  }

  async execute(args: PipelineExecutionArgs) {
    const { image, options, onProgress } = args;

    const notify = (state: AIProgressState, progress?: number) => {
      if (onProgress) onProgress(state, progress || 0);
    };

    if (options?.modelId) {
      this.modelId = options.modelId;
    }

    this.inputSize = this.modelId.includes('full') ? 192 : 128;

    this.runtime = await aiSessionManager.getRuntime(this.modelId, options?.preferredBackend, notify);

    notify('preparing-image', 0);
    const imageData = await imageToImageData(image);
    this.origWidth = imageData.width;
    this.origHeight = imageData.height;

    const tensorData = this.preprocess(imageData);
    notify('preparing-image', 100);

    notify('inference', 0);

    // BlazeFace produces 2 output tensors — use multi-output execution
    const outputs = await this.runtime.executeMultiOutput(
      tensorData,
      [1, this.inputSize, this.inputSize, 3]
    );
    notify('inference', 100);

    notify('post-processing', 0);
    const result = this.postprocess(outputs);
    notify('post-processing', 100);

    notify('encoding', 100);

    return { output: result };
  }

  private preprocess(imageData: ImageData): Float32Array {
    const targetSize = this.inputSize;

    const canvas = new OffscreenCanvas(targetSize, targetSize);
    const ctx = canvas.getContext('2d')!;

    // Create source canvas from ImageData
    const srcCanvas = new OffscreenCanvas(imageData.width, imageData.height);
    srcCanvas.getContext('2d')!.putImageData(imageData, 0, 0);

    // Letterbox: fit inside targetSize×targetSize preserving aspect ratio
    const scale = Math.min(targetSize / imageData.width, targetSize / imageData.height);
    const newW = imageData.width * scale;
    const newH = imageData.height * scale;
    const dx = (targetSize - newW) / 2;
    const dy = (targetSize - newH) / 2;

    this.scaleX = scale;
    this.scaleY = scale;
    this.offsetX = dx;
    this.offsetY = dy;

    // Fill with black (letterbox padding)
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, targetSize, targetSize);
    ctx.drawImage(srcCanvas, dx, dy, newW, newH);

    const resized = ctx.getImageData(0, 0, targetSize, targetSize);

    // Normalize to [-1, 1]
    const float32Data = new Float32Array(targetSize * targetSize * 3);
    const numPixels = targetSize * targetSize;

    for (let p = 0; p < numPixels; p++) {
      float32Data[p * 3]     = (resized.data[p * 4]     / 127.5) - 1.0;
      float32Data[p * 3 + 1] = (resized.data[p * 4 + 1] / 127.5) - 1.0;
      float32Data[p * 3 + 2] = (resized.data[p * 4 + 2] / 127.5) - 1.0;
    }

    return float32Data;
  }

  private postprocess(outputs: Float32Array[]): FaceDetectionResult {
    // BlazeFace outputs:
    //   outputs[0] = regressors: [1, numAnchors, 16]
    //   outputs[1] = classifiers: [1, numAnchors, 1]
    //
    // If only 1 output, try to split it (some TFLite exports flatten them)

    let regressors: Float32Array;
    let classifiers: Float32Array;

    const anchors = generateAnchors(this.inputSize);
    const numAnchors = anchors.length;

    if (outputs.length >= 2) {
      // Standard 2-output BlazeFace
      regressors = outputs[0];
      classifiers = outputs[1];
    } else {
      // Single flat output — try to split
      const totalLen = outputs[0].length;
      const regLen = numAnchors * 16;
      const clsLen = numAnchors * 1;

      if (totalLen === regLen + clsLen) {
        regressors = outputs[0].slice(0, regLen);
        classifiers = outputs[0].slice(regLen);
      } else {
        console.warn(`[FaceDetection] Unexpected output length: ${totalLen}, expected ${regLen + clsLen}`);
        return { faces: [], width: this.origWidth, height: this.origHeight, modelId: this.modelId, inferenceTime: 0 };
      }
    }

    const scoreThreshold = 0.65;
    const inputSize = this.inputSize;
    const detections: DetectedFace[] = [];

    for (let i = 0; i < numAnchors; i++) {
      // Classifier score — apply sigmoid
      const rawScore = classifiers[i];
      const score = 1.0 / (1.0 + Math.exp(-rawScore));

      if (score < scoreThreshold) continue;

      const anchor = anchors[i];
      const regOffset = i * 16;

      // Decode bounding box center and size (in input-image pixel coordinates)
      // BlazeFace stores raw pixel offsets, not normalized values
      const cx = anchor.cx * inputSize + regressors[regOffset + 0];
      const cy = anchor.cy * inputSize + regressors[regOffset + 1];
      const w  = regressors[regOffset + 2];
      const h  = regressors[regOffset + 3];

      // Bounding box in input-image pixel coordinates
      const x1_input = cx - w / 2;
      const y1_input = cy - h / 2;

      // Map from letterboxed input coordinates back to original image coordinates
      const x1_orig = (x1_input - this.offsetX) / this.scaleX;
      const y1_orig = (y1_input - this.offsetY) / this.scaleY;
      const w_orig  = w / this.scaleX;
      const h_orig  = h / this.scaleY;

      // Clamp to image bounds
      const fx = Math.max(0, Math.min(this.origWidth, x1_orig));
      const fy = Math.max(0, Math.min(this.origHeight, y1_orig));
      const fw = Math.min(w_orig, this.origWidth - fx);
      const fh = Math.min(h_orig, this.origHeight - fy);

      if (fw <= 0 || fh <= 0) continue;

      // Decode 6 keypoints
      const keypoints: Point2D[] = [];
      for (let k = 0; k < 6; k++) {
        const kx_input = anchor.cx * inputSize + regressors[regOffset + 4 + k * 2];
        const ky_input = anchor.cy * inputSize + regressors[regOffset + 4 + k * 2 + 1];

        keypoints.push({
          x: (kx_input - this.offsetX) / this.scaleX,
          y: (ky_input - this.offsetY) / this.scaleY
        });
      }

      detections.push({
        boundingBox: new DOMRect(fx, fy, fw, fh),
        keypoints,
        score
      });
    }

    // Apply Non-Maximum Suppression
    const finalFaces = nms(detections, 0.3);

    console.log(`[FaceDetection] Detected ${finalFaces.length} face(s) from ${detections.length} candidates`);

    return {
      faces: finalFaces,
      width: this.origWidth,
      height: this.origHeight,
      modelId: this.modelId,
      inferenceTime: 0
    };
  }
}
