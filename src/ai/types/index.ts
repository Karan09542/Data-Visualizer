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
  | 'face-detection';

export type AIBackend = 'webgpu' | 'webnn' | 'wasm';

export interface ModelSource {
  type: 'huggingface' | 'cdn' | 'local';
  url: string;
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
  customConfig?: ModelConfig;
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
}

export interface AIExecutionResult {
  // Output format can be an ImageBitmap, standard ImageData, generic Blob, or structured detection result
  output: ImageBitmap | ImageData | Blob | FaceDetectionResult | null;
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
