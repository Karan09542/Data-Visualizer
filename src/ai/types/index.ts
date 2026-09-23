import { ModelConfig } from '../config/ModelConfig';

export type AITask = 
  | 'background-removal'
  | 'upscale'
  | 'low-light'
  | 'document-enhancement'
  | 'object-removal'
  | 'face-restoration'
  | 'caption-generation'
  | 'segmentation'
  | 'auto-enhance'
  | 'face-detection'
  | 'depth-estimation'
  | 'style-transfer';

export type AIBackend = 'webgpu' | 'webnn' | 'wasm';

export interface ModelSource {
  type: 'huggingface' | 'cdn' | 'local' | 'custom';
  url: string;
}

/**
 * What a depth model needs said about it, because these differ per checkpoint and getting any of
 * them wrong turns a good model into a bad-looking one.
 */
export interface DepthModelConfig {
  /**
   * How the picture is fitted to the model's input. `stretch` squashes it to the input's exact
   * size, which is what most exports expect; `contain` keeps its proportions and pads the rest;
   * `auto` squashes unless the two shapes are far enough apart for that to distort the scene.
   */
  fit?: 'stretch' | 'contain' | 'auto';
  /** Whether a larger number means nearer (inverse depth, MiDaS-style) or further (metric). */
  polarity?: 'inverse' | 'metric';
  /** How pixels are scaled before the network sees them. */
  normalization?: 'imagenet' | 'zero_to_one';
}

export interface ModelManifest {
  id: string;
  version: string;
  task: AITask;
  name?: string;
  description?: string;
  sources: ModelSource[];
  size?: number; // Estimated size in bytes
  supports?: string[]; // E.g., ['remove', 'portrait', 'passport']
  dependencies?: string[]; // Other registered model ids required by this model/pipeline.
  internal?: boolean; // Hide implementation-only model shards from user-facing pickers.
  customConfig?: ModelConfig;
  /** Depth models only: how to feed this one and how to read what it returns. */
  depth?: DepthModelConfig;
}

export type AIProgressState = 
  | 'idle'
  | 'queued'
  | 'downloading'
  | 'loading-model'
  | 'preparing-image'
  | 'inference'
  | 'post-processing'
  | 'encoding'
  | 'completed'
  | 'failed'
  | 'error'
  | 'cancelled';

export interface AIProgressEvent {
  state: AIProgressState;
  progress?: number; // 0 to 100
  message?: string;
  error?: string;
}

export interface AIExecutionOptions {
  onProgress?: (event: AIProgressEvent) => void;
  preferredBackend?: AIBackend;
  modelId?: string;
  signal?: AbortSignal;
  metadata?: Record<string, any>;
}

export interface AIExecutionResult {
  // Output format can be an ImageBitmap, standard ImageData, generic Blob, or structured detection result
  output: ImageBitmap | ImageData | Blob | FaceDetectionResult | DepthEstimationResult | null;
  metadata?: Record<string, any>;
}

export interface SegmentationResult {
  foreground: ImageBitmap | ImageData;
  alphaMask: ImageBitmap | ImageData;
  confidenceMask?: Float32Array;
  boundingBox: DOMRect;
  width: number;
  height: number;
  modelId: string;
  inferenceTime: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface DetectedFace {
  boundingBox: DOMRect;
  keypoints: Point2D[];
  score: number;
}

export interface FaceDetectionResult {
  faces: DetectedFace[];
  width: number;
  height: number;
  modelId: string;
  inferenceTime: number;
}

export interface DepthEstimationResult {
  depthMap: ImageData;      // Grayscale depth visualization
  rawDepth: Float32Array;   // Raw depth values for programmatic use
  width: number;
  height: number;
}


// Web Worker Communication Types
export type WorkerMessageType = 
  | 'EXECUTE_TASK'
  | 'PROGRESS_UPDATE'
  | 'EXECUTION_COMPLETE'
  | 'EXECUTION_ERROR'
  | 'PRELOAD_MODEL';

export interface WorkerRequest {
  id: string; // unique request id
  type: WorkerMessageType;
  task?: AITask;
  image?: ImageBitmap | ImageData; // Transferable
  options?: Omit<AIExecutionOptions, 'onProgress'>;
  modelId?: string; // For PRELOAD_MODEL
}

export interface WorkerResponse {
  id: string; // Matches request id
  type: WorkerMessageType;
  progressEvent?: AIProgressEvent;
  result?: AIExecutionResult;
  error?: string;
}
