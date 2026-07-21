import { TaskPipeline, PipelineExecutionArgs } from '../registry/TaskRegistry';
import { LiteRTRuntime } from '../runtime/LiteRTRuntime';
import { aiSessionManager } from '../runtime/AISessionManager';
import { imageToImageData } from '../utils';
import { AIProgressState } from '../types';

export abstract class ImagePipeline implements TaskPipeline {
  protected runtime: LiteRTRuntime | null = null;
  protected abstract modelId: string;

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

    // Allow overriding the default model for this pipeline
    if (options?.modelId) {
      this.modelId = options.modelId;
    }

    // Get runtime from Session Manager (loads if needed) BEFORE preprocessing
    // so that we can check the model's input details (like shape format: NCHW vs NHWC).
    this.runtime = await aiSessionManager.getRuntime(this.modelId, options?.preferredBackend, notify);

    notify('preparing-image', 0);
    const imageData = await imageToImageData(image);
    // Extract inputShape from runtime if available
    let inputShape: number[] | undefined;
    try {
      const details = (this.runtime as any).session?.getInputDetails?.();
      if (details && details.length > 0) inputShape = details[0].shape as number[];
    } catch (e) {}
    
    const inputResult = this.preprocess(imageData, inputShape);
    notify('preparing-image', 100);

    let tensorData = inputResult;
    let actualShape: number[] | undefined;
    
    if (inputResult && inputResult.data && Array.isArray(inputResult.shape)) {
      tensorData = inputResult.data;
      actualShape = inputResult.shape;
    }

    notify('inference', 0);
    const outputTensor = await this.runtime.execute(tensorData, actualShape);
    notify('inference', 100);

    notify('post-processing', 0);
    const resultImage = this.postprocess(outputTensor, imageData.width, imageData.height, imageData);
    notify('post-processing', 100);

    notify('encoding', 100);

    return { output: resultImage };
  }

  protected abstract preprocess(imageData: ImageData, inputShape?: number[]): any;
  protected abstract postprocess(outputTensor: any, width: number, height: number, originalImageData?: ImageData): ImageData;
}
