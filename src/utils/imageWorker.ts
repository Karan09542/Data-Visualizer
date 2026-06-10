// Image processing Web Worker for heavy resizing and encoding tasks (jSquash WASM-based)

let isResizeInitialised = false;
let isPngInitialised = false;
let isJpegInitialised = false;
let isWebpInitialised = false;
let isAvifInitialised = false;

const loadWasmModule = async (url: string): Promise<WebAssembly.Module> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch WASM from ${url}`);
  const buffer = await res.arrayBuffer();
  return WebAssembly.compile(buffer);
};

// Floyd-Steinberg color quantization and dithering helper
function quantizeAndDither(imgData: ImageData, paletteColors: number, ditherLevel: number): ImageData {
  const data = imgData.data;
  const w = imgData.width;
  const h = imgData.height;

  // Generate dynamic uniform color-cube partitioning based on paletteColors
  const levels = Math.max(2, Math.floor(Math.pow(paletteColors, 1 / 3)));
  const step = 255 / (levels - 1);

  const findNearest = (r: number, g: number, b: number) => {
    const nr = Math.round(Math.round(r / step) * step);
    const ng = Math.round(Math.round(g / step) * step);
    const nb = Math.round(Math.round(b / step) * step);
    return [
      Math.min(255, Math.max(0, nr)),
      Math.min(255, Math.max(0, ng)),
      Math.min(255, Math.max(0, nb))
    ];
  };

  // Error buffers
  const errorBufferR = new Float32Array(w * h);
  const errorBufferG = new Float32Array(w * h);
  const errorBufferB = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;

      let r = data[idx] + errorBufferR[y * w + x] * ditherLevel;
      let g = data[idx + 1] + errorBufferG[y * w + x] * ditherLevel;
      let b = data[idx + 2] + errorBufferB[y * w + x] * ditherLevel;

      r = Math.min(255, Math.max(0, r));
      g = Math.min(255, Math.max(0, g));
      b = Math.min(255, Math.max(0, b));

      const [nr, ng, nb] = findNearest(r, g, b);

      data[idx] = nr;
      data[idx + 1] = ng;
      data[idx + 2] = nb;

      const errR = r - nr;
      const errG = g - ng;
      const errB = b - nb;

      const distribute = (nx: number, ny: number, weight: number) => {
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          const nidx = ny * w + nx;
          errorBufferR[nidx] += errR * weight;
          errorBufferG[nidx] += errG * weight;
          errorBufferB[nidx] += errB * weight;
        }
      };

      distribute(x + 1, y, 7 / 16);
      distribute(x - 1, y + 1, 3 / 16);
      distribute(x, y + 1, 5 / 16);
      distribute(x + 1, y + 1, 1 / 16);
    }
  }
  return imgData;
}

self.onmessage = async (e: MessageEvent) => {
  const {
    pixelBuffer,
    width,
    height,
    exportWidth,
    exportHeight,
    exportResizeMethod,
    exportFormat,
    exportQuality,
    wasmUrls,
    hasSimdResult,
    hasThreadsResult,

    // Advanced Squoosh Parameters
    mozjpegTrellis,
    mozjpegSubsampling,
    webpLossless,
    webpEffort,
    avifSpeed,
    paletteReduction,
    paletteColors,
    ditherLevel,
  } = e.data;

  try {
    // 1. Recreate ImageData
    let imgData = new ImageData(new Uint8ClampedArray(pixelBuffer), width, height);

    // 2. Resize if required
    if (exportWidth !== width || exportHeight !== height) {
      const resizeImageModule = await import('@jsquash/resize') as any;
      const resizeFn = resizeImageModule.default;
      if (!isResizeInitialised) {
        const { initResize } = resizeImageModule;
        await initResize(wasmUrls.resize);
        isResizeInitialised = true;
      }
      imgData = await resizeFn(imgData, {
        width: exportWidth,
        height: exportHeight,
        method: exportResizeMethod,
        premul: e.data.exportResizePremul ?? true,
        linearRGB: e.data.exportResizeLinearRGB ?? true,
      });
    }

    // 2.5 Optional Color Palette Reduction and Floyd-Steinberg Dithering
    if (paletteReduction) {
      imgData = quantizeAndDither(imgData, paletteColors, ditherLevel);
    }

    // 3. Compress based on format
    let rawBuffer: ArrayBuffer;

    if (exportFormat === 'png') {
      const encodePngModule = await import('@jsquash/png/encode') as any;
      const encodePng = encodePngModule.default;
      if (!isPngInitialised) {
        const { init } = encodePngModule;
        await init(wasmUrls.png);
        isPngInitialised = true;
      }
      rawBuffer = await encodePng(imgData, {
        level: e.data.pngLevel ?? 2,
        interlace: e.data.pngInterlace ?? false,
      });
    } else if (exportFormat === 'jpeg') {
      const encodeJpegModule = await import('@jsquash/jpeg/encode') as any;
      const encodeJpeg = encodeJpegModule.default;
      if (!isJpegInitialised) {
        const { init } = encodeJpegModule;
        const jpegModule = await loadWasmModule(wasmUrls.jpeg);
        await init(jpegModule);
        isJpegInitialised = true;
      }
      // Pass MozJPEG settings
      rawBuffer = await encodeJpeg(imgData, { 
        quality: e.data.mozjpeg?.quality ?? exportQuality, 
        baseline: e.data.mozjpeg?.baseline ?? false,
        arithmetic: e.data.mozjpeg?.arithmetic ?? false,
        progressive: e.data.mozjpeg?.progressive ?? true,
        optimize_coding: e.data.mozjpeg?.optimize_coding ?? true,
        smoothing: e.data.mozjpeg?.smoothing ?? 0,
        trellis_multipass: e.data.mozjpeg?.trellis_multipass ?? false,
        trellis_opt_zero: e.data.mozjpeg?.trellis_opt_zero ?? false,
        trellis_opt_table: e.data.mozjpeg?.trellis_opt_table ?? false,
        trellis_loops: e.data.mozjpeg?.trellis_loops ?? 1,
        auto_subsample: e.data.mozjpeg?.auto_subsample ?? true,
        chroma_subsample: e.data.mozjpeg?.chroma_subsample ?? 2,
        separate_chroma_quality: e.data.mozjpeg?.separate_chroma_quality ?? false,
        chroma_quality: e.data.mozjpeg?.chroma_quality ?? 75,
      });
    } else if (exportFormat === 'webp') {
      const encodeWebpModule = await import('@jsquash/webp/encode') as any;
      const encodeWebp = encodeWebpModule.default;
      if (!isWebpInitialised) {
        const { init } = encodeWebpModule;
        const webpModule = await loadWasmModule(hasSimdResult ? wasmUrls.webpSimd : wasmUrls.webp);
        await init(webpModule);
        isWebpInitialised = true;
      }
      // Pass WebP settings
      rawBuffer = await encodeWebp(imgData, { 
        quality: e.data.webp?.quality ?? exportQuality, 
        target_size: e.data.webp?.target_size ?? 0,
        target_PSNR: e.data.webp?.target_PSNR ?? 0,
        method: e.data.webp?.method ?? 4,
        sns_strength: e.data.webp?.sns_strength ?? 50,
        filter_strength: e.data.webp?.filter_strength ?? 60,
        filter_sharpness: e.data.webp?.filter_sharpness ?? 0,
        filter_type: e.data.webp?.filter_type ?? 1,
        partitions: e.data.webp?.partitions ?? 0,
        segments: e.data.webp?.segments ?? 4,
        pass: e.data.webp?.pass ?? 1,
        show_compressed: e.data.webp?.show_compressed ?? 0,
        preprocessing: e.data.webp?.preprocessing ?? 0,
        autofilter: e.data.webp?.autofilter ?? 0,
        partition_limit: e.data.webp?.partition_limit ?? 0,
        alpha_compression: e.data.webp?.alpha_compression ?? 1,
        alpha_filtering: e.data.webp?.alpha_filtering ?? 1,
        alpha_quality: e.data.webp?.alpha_quality ?? 100,
        lossless: e.data.webp?.lossless ?? 0,
        exact: e.data.webp?.exact ?? 0,
        image_hint: e.data.webp?.image_hint ?? 0,
        emulate_jpeg_size: e.data.webp?.emulate_jpeg_size ?? 0,
        thread_level: e.data.webp?.thread_level ?? 0,
        low_memory: e.data.webp?.low_memory ?? 0,
        near_lossless: e.data.webp?.near_lossless ?? 100,
        use_delta_palette: e.data.webp?.use_delta_palette ?? 0,
        use_sharp_yuv: e.data.webp?.use_sharp_yuv ?? 0,
      });
    } else {
      const encodeAvifModule = await import('@jsquash/avif/encode') as any;
      const encodeAvif = encodeAvifModule.default;
      if (!isAvifInitialised) {
        const { init } = encodeAvifModule;
        const avifModule = await loadWasmModule(hasThreadsResult ? wasmUrls.avifMt : wasmUrls.avif);
        await init(avifModule);
        isAvifInitialised = true;
      }
      // Pass AVIF settings
      rawBuffer = await encodeAvif(imgData, { 
        cqLevel: e.data.avif?.cqLevel ?? 33,
        cqAlphaLevel: e.data.avif?.cqAlphaLevel ?? -1,
        denoiseLevel: e.data.avif?.denoiseLevel ?? 0,
        tileRowsLog2: e.data.avif?.tileRowsLog2 ?? 0,
        tileColsLog2: e.data.avif?.tileColsLog2 ?? 0,
        speed: e.data.avif?.speed ?? 6,
        subsample: e.data.avif?.subsample ?? 1,
        chromaDeltaQ: e.data.avif?.chromaDeltaQ ?? false,
        sharpness: e.data.avif?.sharpness ?? 0,
        tune: e.data.avif?.tune ?? 0,
      });
    }

    // Pass the rawBuffer back to the main thread as transferable
    const result: any = { success: true, resultBuffer: rawBuffer };

    // Try to calculate PSNR if requested
    if (e.data.calculateMetrics) {
      try {
        let decodedData: ImageData | null = null;
        if (exportFormat === 'png') {
           const decodePngModule = await import('@jsquash/png/decode') as any;
           decodedData = await decodePngModule.default(rawBuffer);
        } else if (exportFormat === 'jpeg') {
           const decodeJpegModule = await import('@jsquash/jpeg/decode') as any;
           const jpegModule = await loadWasmModule(wasmUrls.jpegDecode || "https://unpkg.com/@jsquash/jpeg@1.6.0/codec/dec/mozjpeg_dec.wasm");
           await decodeJpegModule.init(jpegModule);
           decodedData = await decodeJpegModule.default(rawBuffer);
        } else if (exportFormat === 'webp') {
           const decodeWebpModule = await import('@jsquash/webp/decode') as any;
           const webpModule = await loadWasmModule(wasmUrls.webpDecode || "https://unpkg.com/@jsquash/webp@1.5.0/codec/dec/webp_dec.wasm");
           await decodeWebpModule.init(webpModule);
           decodedData = await decodeWebpModule.default(rawBuffer);
        } else if (exportFormat === 'avif') {
           const decodeAvifModule = await import('@jsquash/avif/decode') as any;
           const avifModule = await loadWasmModule(wasmUrls.avifDecode || "https://unpkg.com/@jsquash/avif@2.1.1/codec/dec/avif_dec.wasm");
           await decodeAvifModule.init(avifModule);
           decodedData = await decodeAvifModule.default(rawBuffer);
        }

        if (decodedData) {
          // Calculate PSNR
          const original = new Uint8ClampedArray(pixelBuffer);
          const optimized = decodedData.data;
          
          if (original.length === optimized.length) {
            let mse = 0;
            for (let i = 0; i < original.length; i++) {
              const diff = original[i] - optimized[i];
              mse += diff * diff;
            }
            mse /= original.length;
            
            if (mse === 0) {
              result.psnr = 100; // Infinity or 100 as max
            } else {
              result.psnr = 10 * Math.log10((255 * 255) / mse);
            }
          }
        }
      } catch (metricsErr) {
        console.error("Failed to calculate metrics", metricsErr);
      }
    }

    (self as any).postMessage(result, [rawBuffer]);
  } catch (err: any) {
    (self as any).postMessage({ success: false, error: err.message || String(err) });
  }
};
