import { AIBackend } from '../types';

/**
 * Adapter for @litertjs/core.
 * The runtime only knows how to load a model blob and execute tensors.
 * It is completely isolated from high-level tasks like 'Background Removal'.
 * 
 * IMPORTANT: This must run on the main thread because @litertjs/core uses
 * importScripts() internally to load WASM files, which is not supported
 * in ES module Web Workers.
 */

// Module-level flag: has LiteRT WASM been initialized?
let liteRtInitialized = false;
let liteRtInitPromise: Promise<void> | null = null;

export class LiteRTRuntime {
  private session: any | null = null;
  private backend: AIBackend = 'wasm';

  get isLoaded(): boolean {
    return this.session !== null;
  }

  /**
   * Automatically detect the best available hardware acceleration.
   */
  static async detectBestBackend(): Promise<AIBackend> {
    // 1. Check for WebGPU
    if ('gpu' in navigator) {
      try {
        const adapter = await (navigator as any).gpu.requestAdapter();
        if (adapter) return 'webgpu';
      } catch (e) {
        console.warn('WebGPU not available:', e);
      }
    }
    
    // 2. Check for WebNN
    if ('ml' in navigator) {
      return 'webnn';
    }
    
    // 3. Fallback to WASM/XNNPACK
    return 'wasm';
  }

  /**
   * Ensure the LiteRT WASM module is loaded exactly once.
   */
  private static async ensureLiteRtLoaded(litert: typeof import('@litertjs/core')): Promise<void> {
    if (liteRtInitialized) return;
    
    if (liteRtInitPromise) {
      await liteRtInitPromise;
      return;
    }

    liteRtInitPromise = (async () => {
      try {
        console.log('[LiteRTRuntime] Initializing LiteRT WASM...');
        // WASM files are copied from node_modules/@litertjs/core/wasm/ to public/wasm/litert/
        // Vite serves files in public/ at the root URL
        await litert.loadLiteRt('/wasm/litert/');
        liteRtInitialized = true;
        console.log('[LiteRTRuntime] LiteRT WASM initialized successfully!');
      } catch (err: any) {
        // If it's already loaded, that's fine
        if (err?.message?.includes('already')) {
          liteRtInitialized = true;
          console.log('[LiteRTRuntime] LiteRT was already initialized.');
        } else {
          liteRtInitPromise = null; // Allow retry
          throw err;
        }
      }
    })();

    await liteRtInitPromise;
  }

  /**
   * Initialize a new LiteRT session with the provided model ArrayBuffer.
   */
  async loadModel(modelData: ArrayBuffer, preferredBackend?: AIBackend) {
    this.backend = preferredBackend || await LiteRTRuntime.detectBestBackend();
    
    const litert = await import('@litertjs/core');
    
    console.log(`[LiteRTRuntime] Loading model on backend: ${this.backend}`);
    
    // Initialize LiteRT WASM (only happens once)
    await LiteRTRuntime.ensureLiteRtLoaded(litert);

    // Load and compile the model
    const modelBuffer = new Uint8Array(modelData);
    const compileOptions = {};
    
    console.log(`[LiteRTRuntime] Compiling model (${(modelData.byteLength / 1024 / 1024).toFixed(1)} MB)...`);
    this.session = await litert.loadAndCompile(modelBuffer, compileOptions);
    
    if (!this.session) {
      throw new Error('loadAndCompile returned null or undefined');
    }
    
    // Log model input/output details for debugging
    try {
      const inputDetails = this.session.getInputDetails();
      const outputDetails = this.session.getOutputDetails();
      console.log('[LiteRTRuntime] Model input details (JSON):', JSON.stringify(inputDetails, null, 2));
      console.log('[LiteRTRuntime] Model output details (JSON):', JSON.stringify(outputDetails, null, 2));
    } catch (e) {
      console.warn('[LiteRTRuntime] Could not read model details:', e);
    }
    
    console.log('[LiteRTRuntime] Model compiled and ready for inference!');
  }

  /**
   * Execute inference on the loaded session.
   * 
   * @param inputs - A Float32Array (or any TypedArray) of preprocessed input data.
   *                 The runtime wraps it into a Tensor for @litertjs/core.
   * @param inputShape - Optional shape array [batch, height, width, channels].
   *                     If not provided, it will be inferred from the model's input details.
   * @returns The raw output as a Float32Array (or TypedArray).
   */
  async execute(inputs: Float32Array | any, inputShape?: number[]): Promise<Float32Array> {
    if (!this.session) {
      throw new Error('LiteRT session not loaded. Call loadModel() first.');
    }
    
    const { Tensor } = await import('@litertjs/core');
    
    // If inputs is already a Tensor, use it directly
    let inputTensor: InstanceType<typeof Tensor>;
    
    if (inputs instanceof Float32Array || inputs instanceof Uint8Array || inputs instanceof Int32Array) {
      // Get the expected shape from model details if not provided
      if (!inputShape) {
        try {
          const inputDetails = this.session.getInputDetails();
          if (inputDetails && inputDetails.length > 0) {
            inputShape = inputDetails[0].shape as number[];
            console.log('[LiteRTRuntime] Using model input shape:', inputShape);
          }
        } catch (e) {
          console.warn('[LiteRTRuntime] Could not read input shape, using data length as 1D');
        }
      }
      
      inputTensor = new Tensor(inputs, inputShape);
    } else {
      // Assume it's already a Tensor or compatible object
      inputTensor = inputs;
    }
    
    console.log('[LiteRTRuntime] Running inference...');
    const startTime = performance.now();
    
    // Run with positional input (single tensor as array)
    const outputTensors = await this.session.run([inputTensor]);
    
    const elapsed = performance.now() - startTime;
    console.log(`[LiteRTRuntime] Inference completed in ${elapsed.toFixed(0)}ms`);
    
    // Extract output data
    // outputTensors is Tensor[] when using positional inputs
    if (Array.isArray(outputTensors) && outputTensors.length > 0) {
      const outputData = await outputTensors[0].data();
      // Clean up output tensors
      outputTensors.forEach((t: any) => { try { t.delete(); } catch(_){} });
      // Clean up input tensor
      try { inputTensor.delete(); } catch(_){}
      return outputData as Float32Array;
    }
    
    // Clean up input tensor
    try { inputTensor.delete(); } catch(_){}
    throw new Error('Model produced no output tensors');
  }

  /**
   * Free memory associated with the LiteRT session.
   */
  dispose() {
    if (this.session) {
      this.session.delete();
      this.session = null;
    }
  }
}
