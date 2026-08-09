// Image processing Web Worker for heavy resizing and encoding tasks (jSquash WASM-based)

let isResizeInitialised = false;
let isPngInitialised = false;
let isJpegInitialised = false;
let isWebpInitialised = false;
let isAvifInitialised = false;
let isJxlInitialised = false;

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
    paletteReduction,
    paletteColors,
    ditherLevel,
    targetSize
  } = e.data;

  try {
    let rawBuffer: ArrayBuffer;
    const targetBytes = targetSize?.enabled ? (targetSize.unit === 'MB' ? targetSize.value * 1024 * 1024 : targetSize.value * 1024) : 0;

    const ensureTargetSize = async (
      minQ: number, maxQ: number,
      encodeFn: (img: ImageData, q: number) => Promise<ArrayBuffer>
    ) => {
      if (!targetBytes) return await encodeFn(imgData, -1);

      let currentImg = imgData;
      let bestBuffer: ArrayBuffer | null = null;
      let scale = 1.0;

      // Try up to 4 different scales (1x, 0.75x, 0.56x, 0.42x) if it cannot hit the target
      for (let attempt = 0; attempt < 4; attempt++) {
        let low = minQ;
        let high = maxQ;
        let bestDiff = Infinity;
        let iters = 0;
        const maxIterations = 8;
        let tempBestBuffer: ArrayBuffer | null = null;

        while (low <= high && iters < maxIterations) {
          const mid = Math.floor((low + high) / 2);
          const buffer = await encodeFn(currentImg, mid);
          const size = buffer.byteLength;

          if (size <= targetBytes) {
            const diff = targetBytes - size;
            if (diff < bestDiff) {
              bestDiff = diff;
              tempBestBuffer = buffer;
            }
            low = mid + 1; // increase quality to increase size
          } else {
            high = mid - 1; // decrease quality to decrease size
          }
          iters++;
        }

        if (tempBestBuffer) {
          bestBuffer = tempBestBuffer;
          break; // We hit the target size!
        }

        // If we couldn't hit it even at lowest quality, scale down the image by 25% for next attempt
        scale *= 0.75;
        const newW = Math.max(1, Math.round(width * scale));
        const newH = Math.max(1, Math.round(height * scale));

        const resizeImageModule = await import('@jsquash/resize') as any;
        if (!isResizeInitialised) {
          await resizeImageModule.initResize(wasmUrls.resize);
          isResizeInitialised = true;
        }
        currentImg = await resizeImageModule.default(imgData, {
          width: newW, height: newH, method: exportResizeMethod
        });
      }

      if (!bestBuffer) bestBuffer = await encodeFn(currentImg, minQ);
      return bestBuffer;
    };

    // 1. Recreate ImageData
    let imgData = new ImageData(new Uint8ClampedArray(pixelBuffer), width, height);

    // 2. Resize if required
    if (exportWidth <= 0 || exportHeight <= 0) {
      throw new Error("Export dimensions must be greater than 0.");
    }
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

    if (exportFormat === 'png') {
      const encodePngModule = await import('@jsquash/png/encode') as any;
      const encodePng = encodePngModule.default;
      if (!isPngInitialised) {
        const { init } = encodePngModule;
        await init(wasmUrls.png);
        isPngInitialised = true;
      }
      rawBuffer = await encodePng(imgData, {
        level: Math.max(0, Math.min(9, e.data.png?.level ?? e.data.pngLevel ?? 1)),
        interlace: Boolean(e.data.png?.interlace ?? e.data.pngInterlace ?? false),
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

      let chroma_subsample = e.data.mozjpeg?.chroma_subsample ?? 1;
      // Prevent encoding error for odd dimensions in 4:2:0 / 4:2:2 modes by falling back to 4:4:4
      if (chroma_subsample > 1 && (imgData.width % 2 !== 0 || imgData.height % 2 !== 0)) {
        chroma_subsample = 1;
      }

      // Pass MozJPEG settings via binary search with dynamic downscaling
      rawBuffer = await ensureTargetSize(1, 100, async (img, q) => {
        const quality = q === -1 ? Math.max(1, Math.min(100, e.data.mozjpeg?.quality ?? exportQuality ?? 95)) : q;
        const chroma_q = e.data.mozjpeg?.separate_chroma_quality ? Math.max(1, Math.min(100, e.data.mozjpeg?.chroma_quality ?? 95)) : quality;

        return await encodeJpeg(img, {
          quality: quality,
          baseline: Boolean(e.data.mozjpeg?.baseline ?? false),
          arithmetic: Boolean(e.data.mozjpeg?.arithmetic ?? false),
          progressive: Boolean(e.data.mozjpeg?.progressive ?? true),
          optimize_coding: Boolean(e.data.mozjpeg?.optimize_coding ?? true),
          smoothing: Math.max(0, Math.min(100, e.data.mozjpeg?.smoothing ?? 0)),
          trellis_multipass: Boolean(e.data.mozjpeg?.trellis_multipass ?? false),
          trellis_opt_zero: Boolean(e.data.mozjpeg?.trellis_opt_zero ?? false),
          trellis_opt_table: Boolean(e.data.mozjpeg?.trellis_opt_table ?? false),
          trellis_loops: Math.max(1, Math.min(50, e.data.mozjpeg?.trellis_loops ?? 1)),
          auto_subsample: Boolean(e.data.mozjpeg?.auto_subsample ?? true),
          chroma_subsample: chroma_subsample,
          separate_chroma_quality: Boolean(e.data.mozjpeg?.separate_chroma_quality ?? false),
          chroma_quality: chroma_q,
        });
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
      // Pass WebP settings via dynamic binary search
      rawBuffer = await ensureTargetSize(1, 100, async (img, q) => {
        const quality = q === -1 ? Math.max(0, Math.min(100, e.data.webp?.quality ?? exportQuality ?? 95)) : q;

        return await encodeWebp(img, {
          quality: quality,
          target_size: 0, // We handle size manually now to support dynamic scaling
          target_PSNR: Math.max(0, e.data.webp?.target_PSNR ?? 0),
          method: Math.max(0, Math.min(6, e.data.webp?.method ?? 4)),
          sns_strength: Math.max(0, Math.min(100, e.data.webp?.sns_strength ?? 50)),
          filter_strength: Math.max(0, Math.min(100, e.data.webp?.filter_strength ?? 60)),
          filter_sharpness: Math.max(0, Math.min(7, e.data.webp?.filter_sharpness ?? 0)),
          filter_type: Math.max(0, Math.min(1, e.data.webp?.filter_type ?? 1)),
          partitions: Math.max(0, Math.min(3, e.data.webp?.partitions ?? 0)),
          segments: Math.max(1, Math.min(4, e.data.webp?.segments ?? 4)),
          pass: Math.max(1, Math.min(10, e.data.webp?.pass ?? 1)),
          show_compressed: 0,
          preprocessing: Math.max(0, Math.min(2, e.data.webp?.preprocessing ?? 0)),
          autofilter: Math.max(0, Math.min(1, e.data.webp?.autofilter ?? 0)),
          partition_limit: Math.max(0, Math.min(100, e.data.webp?.partition_limit ?? 0)),
          alpha_compression: Math.max(0, Math.min(1, e.data.webp?.alpha_compression ?? 1)),
          alpha_filtering: Math.max(0, Math.min(2, e.data.webp?.alpha_filtering ?? 1)),
          alpha_quality: Math.max(0, Math.min(100, e.data.webp?.alpha_quality ?? 100)),
          lossless: Math.max(0, Math.min(1, e.data.webp?.lossless ?? 0)),
          exact: Math.max(0, Math.min(1, e.data.webp?.exact ?? 0)),
          image_hint: Math.max(0, Math.min(3, e.data.webp?.image_hint ?? 0)),
          emulate_jpeg_size: 0,
          thread_level: 0,
          low_memory: Math.max(0, Math.min(1, e.data.webp?.low_memory ?? 0)),
          near_lossless: Math.max(0, Math.min(100, e.data.webp?.near_lossless ?? 100)),
          use_delta_palette: 0,
          use_sharp_yuv: Math.max(0, Math.min(1, e.data.webp?.use_sharp_yuv ?? 0)),
        });
      });
    } else if (exportFormat === 'avif') {
      const encodeAvifModule = await import('@jsquash/avif/encode') as any;
      const encodeAvif = encodeAvifModule.default;
      if (!isAvifInitialised) {
        const { init } = encodeAvifModule;
        const avifModule = await loadWasmModule(hasThreadsResult ? wasmUrls.avifMt : wasmUrls.avif);
        await init(avifModule);
        isAvifInitialised = true;
      }

      let avifSubsample = e.data.avif?.subsample ?? 1;
      if (avifSubsample !== 0 && (imgData.width % 2 !== 0 || imgData.height % 2 !== 0)) {
        avifSubsample = 0;
      }

      // Pass AVIF settings via binary search if target size is enabled
      rawBuffer = await ensureTargetSize(0, 100, async (img, q) => {
        let cqLevel, cqAlphaLevel;
        if (q === -1) {
          cqLevel = Math.max(0, Math.min(63, e.data.avif?.cqLevel ?? 15));
          cqAlphaLevel = (e.data.avif?.cqAlphaLevel !== undefined && e.data.avif.cqAlphaLevel >= 0)
            ? Math.max(0, Math.min(63, e.data.avif.cqAlphaLevel))
            : cqLevel;
        } else {
          // Normalize Q (0-100) to AVIF cqLevel (63-0 where 63 is lowest size/quality)
          cqLevel = 63 - Math.floor((q / 100) * 63);
          cqAlphaLevel = cqLevel;
        }

        return await encodeAvif(img, {
          cqLevel: cqLevel,
          cqAlphaLevel: cqAlphaLevel,
          denoiseLevel: Math.max(0, Math.min(50, e.data.avif?.denoiseLevel ?? 0)),
          tileRowsLog2: Math.max(0, Math.min(6, e.data.avif?.tileRowsLog2 ?? 0)),
          tileColsLog2: Math.max(0, Math.min(6, e.data.avif?.tileColsLog2 ?? 0)),
          speed: Math.max(0, Math.min(10, e.data.avif?.speed ?? 6)),
          subsample: avifSubsample,
          chromaDeltaQ: Boolean(e.data.avif?.chromaDeltaQ),
          sharpness: Math.max(0, Math.min(7, e.data.avif?.sharpness ?? 0)),
          tune: e.data.avif?.tune ?? 0,
        });
      });
    } else if (exportFormat === 'jxl') {
      const encodeJxlModule = await import('@jsquash/jxl/encode') as any;
      const encodeJxl = encodeJxlModule.default;
      if (!isJxlInitialised) {
        const { init } = encodeJxlModule;
        const jxlModule = await loadWasmModule(wasmUrls.jxl);
        await init(jxlModule);
        isJxlInitialised = true;
      }

      rawBuffer = await ensureTargetSize(1, 100, async (img, q) => {
        const quality = q === -1 ? Math.max(1, Math.min(100, e.data.jxl?.quality ?? 95)) : q;
        return await encodeJxl(img, {
          effort: Math.max(1, Math.min(9, e.data.jxl?.effort ?? 7)),
          quality: quality,
          progressive: Boolean(e.data.jxl?.progressive ?? false),
          lossless: Boolean(e.data.jxl?.lossless ?? false),
        });
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
        } else if (exportFormat === 'jxl') {
          const decodeJxlModule = await import('@jsquash/jxl/decode') as any;
          const jxlModule = await loadWasmModule(wasmUrls.jxlDecode || "https://unpkg.com/@jsquash/jxl@1.3.0/codec/dec/jxl_dec.wasm");
          await decodeJxlModule.init(jxlModule);
          decodedData = await decodeJxlModule.default(rawBuffer);
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

          // For formats that might not render natively in all browsers (like JXL),
          // we pass the raw decoded pixels back so the main thread can render a PNG preview
          if (exportFormat === 'jxl') {
            result.decodedPixels = new Uint8ClampedArray(optimized).buffer; // clone buffer reference
            result.decodedWidth = decodedData.width;
            result.decodedHeight = decodedData.height;
          }
        }
      } catch (metricsErr) {
        console.error("Failed to calculate metrics", metricsErr);
      }
    }

    const transferables = [rawBuffer];
    if (result.decodedPixels) {
      transferables.push(result.decodedPixels);
    }

    (self as any).postMessage(result, transferables);
  } catch (err: any) {
    (self as any).postMessage({ success: false, error: err.message || String(err) });
  }
};
