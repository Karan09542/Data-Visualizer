import { TaskPipeline, PipelineExecutionArgs } from '../registry/TaskRegistry';
import { aiSessionManager } from '../runtime/AISessionManager';
import { imageToImageData } from '../utils';
import { AIProgressState, DepthEstimationResult } from '../types';
import { LiteRTRuntime } from '../runtime/LiteRTRuntime';
import { modelRegistry } from '../registry/ModelRegistry';
import { DepthModelConfig } from '../types';

/** Where the picture itself sits inside the model's input, once it has been fitted to it. */
interface ContentRect { x: number; y: number; width: number; height: number }

interface FittedInput {
  width: number;
  height: number;
  content: ContentRect;
}

type DepthMode = 'grayscale' | 'colored' | '3d' | 'portrait-blur' | 'relighting' | 'fog';

export class DepthEstimationPipeline implements TaskPipeline {
  private runtime: LiteRTRuntime | null = null;

  async execute(args: PipelineExecutionArgs) {
    const { image, options, onProgress } = args;

    const notify = (state: AIProgressState, progress?: number) => {
      if (onProgress) onProgress(state, progress || 0);
    };

    if (options?.signal?.aborted) throw new Error('AbortError');

    const modelId = options?.modelId || 'depth_anything_v2';
    const depthMode: DepthMode = (options?.metadata?.depthMode as DepthMode) || 'colored';
    // How strong the look is, for the effects that have one. 1 is the default strength.
    const strength = Math.max(0.1, Math.min(3, Number(options?.metadata?.effectStrength) || 1));
    // Each checkpoint has its own input shape, scaling and sense of which way depth runs.
    const config: DepthModelConfig = modelRegistry.get(modelId)?.depth ?? {};

    this.runtime = await aiSessionManager.getRuntime(modelId, options?.preferredBackend, notify, options?.signal);

    notify('preparing-image', 0);
    const imageData = await imageToImageData(image);

    let inputShape: number[] | undefined;
    try {
      const details = (this.runtime as any).session?.getInputDetails?.();
      if (details && details.length > 0) inputShape = details[0].shape as number[];
    } catch (e) {}

    const inputResult = this.preprocess(imageData, inputShape, config);
    notify('preparing-image', 100);

    if (options?.signal?.aborted) throw new Error('AbortError');

    notify('inference', 0);
    const outputTensor = await this.runtime.execute(inputResult.data, inputResult.shape);

    if (options?.signal?.aborted) throw new Error('AbortError');
    notify('inference', 100);

    notify('post-processing', 0);
    const result = this.postprocess(outputTensor, imageData, depthMode, config, inputResult.input, strength);
    notify('post-processing', 100);

    notify('encoding', 100);

    return {
      output: result
    };
  }

  private preprocess(
    imageData: ImageData,
    inputShape: number[] | undefined,
    config: DepthModelConfig
  ): { data: Float32Array; shape: number[]; input: FittedInput } {
    const { width: targetWidth, height: targetHeight, layout, shape } = this.resolveInputShape(inputShape);

    const fitted = this.fitImage(imageData, targetWidth, targetHeight, this.resolveFit(imageData, targetWidth, targetHeight, config));
    const resizedData = fitted.pixels;
    const float32Data = new Float32Array(targetWidth * targetHeight * 3);

    // Both MiDaS and the Depth Anything exports take ImageNet-normalized RGB; a checkpoint that
    // wants plain [0,1] says so in its manifest.
    const imagenet = (config.normalization ?? 'imagenet') === 'imagenet';
    const mean = imagenet ? [0.485, 0.456, 0.406] : [0, 0, 0];
    const std = imagenet ? [0.229, 0.224, 0.225] : [1, 1, 1];
    const planeSize = targetWidth * targetHeight;

    for (let i = 0; i < planeSize; i++) {
      const r = (resizedData.data[i * 4 + 0] / 255.0 - mean[0]) / std[0];
      const g = (resizedData.data[i * 4 + 1] / 255.0 - mean[1]) / std[1];
      const b = (resizedData.data[i * 4 + 2] / 255.0 - mean[2]) / std[2];

      if (layout === 'NCHW') {
        float32Data[i] = r;
        float32Data[planeSize + i] = g;
        float32Data[planeSize * 2 + i] = b;
      } else {
        float32Data[i * 3 + 0] = r;
        float32Data[i * 3 + 1] = g;
        float32Data[i * 3 + 2] = b;
      }
    }

    return {
      data: float32Data,
      shape,
      input: { width: targetWidth, height: targetHeight, content: fitted.content },
    };
  }

  /**
   * Squash the picture to the model's input, or keep its proportions and pad.
   *
   * Squashing is what most exports expect and it gives the picture the whole frame. It only hurts
   * when the two shapes are far apart - a 16:9 photo squeezed into a 9:16 input is stretched to
   * about three times its height, and the depth that comes back is of that distorted scene.
   * Measured over several photos, padding wins clearly in that case and loses slightly in milder
   * ones, so `auto` pads only past the point where the distortion is severe.
   */
  private resolveFit(
    imageData: ImageData,
    targetWidth: number,
    targetHeight: number,
    config: DepthModelConfig
  ): 'stretch' | 'contain' {
    const requested = config.fit ?? 'stretch';
    if (requested !== 'auto') return requested;
    const imageAspect = imageData.width / Math.max(1, imageData.height);
    const inputAspect = targetWidth / Math.max(1, targetHeight);
    const mismatch = Math.max(imageAspect / inputAspect, inputAspect / imageAspect);
    return mismatch > 2 ? 'contain' : 'stretch';
  }

  /**
   * Puts the picture into the model's input rectangle.
   *
   * `stretch` fills it, which is what a model exported that way expects. `contain` keeps the
   * picture's proportions and fills the rest by repeating the edge pixels - a model with a fixed
   * portrait input would otherwise see a landscape photo squeezed to a third of its width, and
   * predict depth for that distorted scene. The area the picture actually occupies is returned so
   * the padding can be cut off the result.
   */
  private fitImage(
    imageData: ImageData,
    targetWidth: number,
    targetHeight: number,
    fit: 'stretch' | 'contain'
  ): { pixels: ImageData; content: ContentRect } {
    const source = document.createElement('canvas');
    source.width = imageData.width;
    source.height = imageData.height;
    source.getContext('2d')!.putImageData(imageData, 0, 0);

    const out = document.createElement('canvas');
    out.width = targetWidth;
    out.height = targetHeight;
    const ctx = out.getContext('2d', { willReadFrequently: true })!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (fit === 'stretch') {
      ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
      return {
        pixels: ctx.getImageData(0, 0, targetWidth, targetHeight),
        content: { x: 0, y: 0, width: targetWidth, height: targetHeight },
      };
    }

    const scale = Math.min(targetWidth / imageData.width, targetHeight / imageData.height);
    const w = Math.max(1, Math.round(imageData.width * scale));
    const h = Math.max(1, Math.round(imageData.height * scale));
    const x = Math.floor((targetWidth - w) / 2);
    const y = Math.floor((targetHeight - h) / 2);
    ctx.drawImage(source, x, y, w, h);

    // Repeat the outermost row and column outwards. Black bars would read as a wall at the edge
    // of the scene and pull the whole prediction towards it.
    if (x > 0) {
      ctx.drawImage(out, x, y, 1, h, 0, y, x, h);
      ctx.drawImage(out, x + w - 1, y, 1, h, x + w, y, targetWidth - x - w, h);
    }
    if (y > 0) {
      ctx.drawImage(out, x, y, w, 1, x, 0, w, y);
      ctx.drawImage(out, x, y + h - 1, w, 1, x, y + h, w, targetHeight - y - h);
    }
    if (x > 0 && y > 0) {
      ctx.drawImage(out, x, y, 1, 1, 0, 0, x, y);
      ctx.drawImage(out, x + w - 1, y, 1, 1, x + w, 0, targetWidth - x - w, y);
      ctx.drawImage(out, x, y + h - 1, 1, 1, 0, y + h, x, targetHeight - y - h);
      ctx.drawImage(out, x + w - 1, y + h - 1, 1, 1, x + w, y + h, targetWidth - x - w, targetHeight - y - h);
    }

    return {
      pixels: ctx.getImageData(0, 0, targetWidth, targetHeight),
      content: { x, y, width: w, height: h },
    };
  }

  private postprocess(
    outputTensor: any,
    originalImage: ImageData,
    depthMode: DepthMode,
    config: DepthModelConfig,
    input: FittedInput,
    strength: number
  ): DepthEstimationResult {
    const width = originalImage.width;
    const height = originalImage.height;
    const tensorData = outputTensor as Float32Array | Uint8Array | Int32Array;
    const full = this.resolveOutputSize(tensorData.length);

    // Cut away whatever padding was added to fit the picture, before anything is measured: the
    // repeated edge pixels are not part of the scene and would skew the depth range.
    const { values, width: outWidth, height: outHeight } = this.cropToContent(tensorData, full, input);
    const pixelCount = outWidth * outHeight;
    const normalized = this.normalizeDepth(values, pixelCount);

    // Everything downstream reads larger as nearer, the MiDaS convention. A model that returns
    // metric depth means the opposite, so it is flipped once, here.
    if ((config.polarity ?? 'inverse') === 'metric') {
      for (let i = 0; i < pixelCount; i++) {
        normalized[i] = 1.0 - normalized[i];
      }
    }

    // Generate the depth map image according to mode
    const outImageData = new ImageData(outWidth, outHeight);

    if (depthMode === 'colored' || depthMode === '3d') {
      // Viridis-inspired colormap for beautiful depth visualization
      for (let i = 0; i < pixelCount; i++) {
        const t = Math.max(0, Math.min(1, normalized[i]));
        const [r, g, b] = this.viridisColor(t);
        outImageData.data[i * 4 + 0] = r;
        outImageData.data[i * 4 + 1] = g;
        outImageData.data[i * 4 + 2] = b;
        outImageData.data[i * 4 + 3] = 255;
      }
    } else {
      // Grayscale mode
      for (let i = 0; i < pixelCount; i++) {
        const value = Math.max(0, Math.min(255, Math.round(normalized[i] * 255)));
        outImageData.data[i * 4 + 0] = value;
        outImageData.data[i * 4 + 1] = value;
        outImageData.data[i * 4 + 2] = value;
        outImageData.data[i * 4 + 3] = 255;
      }
    }

    // Resize to original dimensions
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = outWidth;
    tempCanvas.height = outHeight;
    tempCanvas.getContext('2d')!.putImageData(outImageData, 0, 0);

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = width;
    finalCanvas.height = height;
    const finalCtx = finalCanvas.getContext('2d')!;
    finalCtx.imageSmoothingEnabled = true;
    finalCtx.drawImage(tempCanvas, 0, 0, width, height);

    let depthMap = finalCtx.getImageData(0, 0, width, height);

    // Also resize rawDepth to original dimensions via bilinear interpolation
    const rawDepth = this.resizeDepthMap(normalized, outWidth, outHeight, width, height);

    // Apply advanced depth effects if selected
    if (depthMode === 'portrait-blur') {
      depthMap = this.applyPortraitBlur(originalImage, rawDepth, width, height, strength);
    } else if (depthMode === 'relighting') {
      depthMap = this.applyRelighting(originalImage, rawDepth, width, height, strength);
    } else if (depthMode === 'fog') {
      depthMap = this.applyFog(originalImage, rawDepth, width, height, strength);
    }

    return {
      depthMap,
      rawDepth,
      width,
      height
    };
  }

  /**
   * A blur radius that suits the picture rather than a fixed number of pixels: 12px is a heavy
   * blur on a phone-sized crop and invisible on a 6000px photo.
   */
  private blurRadiusFor(width: number, height: number, strength: number): number {
    return Math.max(4, Math.min(110, Math.max(width, height) * 0.03 * strength));
  }

  /**
   * The picture blurred, with its edge pixels repeated outwards first so the border does not fade
   * into nothing the way a plain canvas blur leaves it.
   */
  private blurredCopy(source: ImageData, radius: number): ImageData {
    const { width, height } = source;
    const pad = Math.ceil(radius * 3);
    const plate = document.createElement('canvas');
    plate.width = width + pad * 2;
    plate.height = height + pad * 2;
    const ctx = plate.getContext('2d', { willReadFrequently: true })!;

    const middle = document.createElement('canvas');
    middle.width = width;
    middle.height = height;
    middle.getContext('2d')!.putImageData(source, 0, 0);
    ctx.drawImage(middle, pad, pad);
    if (pad > 0) {
      ctx.drawImage(plate, pad, pad, 1, height, 0, pad, pad, height);
      ctx.drawImage(plate, pad + width - 1, pad, 1, height, pad + width, pad, pad, height);
      ctx.drawImage(plate, pad, pad, width, 1, pad, 0, width, pad);
      ctx.drawImage(plate, pad, pad + height - 1, width, 1, pad, pad + height, width, pad);
      ctx.drawImage(plate, pad, pad, 1, 1, 0, 0, pad, pad);
      ctx.drawImage(plate, pad + width - 1, pad, 1, 1, pad + width, 0, pad, pad);
      ctx.drawImage(plate, pad, pad + height - 1, 1, 1, 0, pad + height, pad, pad);
      ctx.drawImage(plate, pad + width - 1, pad + height - 1, 1, 1, pad + width, pad + height, pad, pad);
    }

    const blurred = document.createElement('canvas');
    blurred.width = plate.width;
    blurred.height = plate.height;
    const bctx = blurred.getContext('2d', { willReadFrequently: true })!;
    bctx.filter = `blur(${radius}px)`;
    bctx.drawImage(plate, 0, 0);
    bctx.filter = 'none';

    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    const octx = out.getContext('2d', { willReadFrequently: true })!;
    octx.drawImage(blurred, pad, pad, width, height, 0, 0, width, height);
    return octx.getImageData(0, 0, width, height);
  }

  /** A value from the depth map at the given rank, read off a sample rather than the whole map. */
  private depthAtRank(depth: Float32Array, rank: number): number {
    const stride = Math.max(1, Math.floor(depth.length / 20000));
    const sample: number[] = [];
    for (let i = 0; i < depth.length; i += stride) sample.push(depth[i]);
    sample.sort((a, b) => a - b);
    return sample[Math.min(sample.length - 1, Math.max(0, Math.floor(sample.length * rank)))];
  }

  /**
   * Where the subject ends and the background begins, in depth.
   *
   * A photographed subject occupies a range of distances - a face is further off than the hands or
   * the flowers in front of it - so focusing on a single distance, as picking the nearest point
   * did, throws the rest of the subject out of focus. The depth map of such a photo has two
   * groupings, near and far, and this finds the dividing line between them (Otsu's method): the
   * value that leaves each side as tightly grouped as it can.
   */
  private focusThreshold(depth: Float32Array): number {
    const bins = 128;
    const histogram = new Float64Array(bins);
    for (let i = 0; i < depth.length; i++) {
      const bin = Math.min(bins - 1, Math.max(0, Math.round(depth[i] * (bins - 1))));
      histogram[bin]++;
    }

    let total = 0;
    let weighted = 0;
    for (let b = 0; b < bins; b++) {
      total += histogram[b];
      weighted += b * histogram[b];
    }

    let behind = 0;
    let behindWeighted = 0;
    let best = 0;
    let bestSplit = Math.round(bins * 0.5);
    for (let b = 0; b < bins - 1; b++) {
      behind += histogram[b];
      if (behind === 0) continue;
      const inFront = total - behind;
      if (inFront === 0) break;
      behindWeighted += b * histogram[b];
      const meanBehind = behindWeighted / behind;
      const meanInFront = (weighted - behindWeighted) / inFront;
      // How far apart the two groupings sit, weighted by how much of the picture each holds.
      const spread = behind * inFront * (meanBehind - meanInFront) ** 2;
      if (spread > best) {
        best = spread;
        bestSplit = b;
      }
    }

    const threshold = bestSplit / (bins - 1);
    // A split that keeps almost nothing, or almost everything, is no split at all.
    let subject = 0;
    for (let i = 0; i < depth.length; i++) if (depth[i] >= threshold) subject++;
    const share = subject / Math.max(1, depth.length);
    return share < 0.03 || share > 0.85 ? this.depthAtRank(depth, 0.55) : threshold;
  }

  /**
   * Spreads the blur a little way into what stays sharp.
   *
   * The depth map's edges are softer than the photo's, so the subject's outline carries a thin
   * band of background that the split counts as subject. Left alone it stays sharp and draws a
   * halo around the subject; pushing the blur inwards by a few pixels hides it.
   */
  private spreadBlur(blend: Float32Array, width: number, height: number, radius: number): Float32Array {
    if (radius < 1) return blend;
    const pass = (src: Float32Array, horizontal: boolean) => {
      const out = new Float32Array(src.length);
      const len = horizontal ? width : height;
      const lines = horizontal ? height : width;
      const step = horizontal ? 1 : width;
      for (let line = 0; line < lines; line++) {
        const base = horizontal ? line * width : line;
        for (let i = 0; i < len; i++) {
          let most = 0;
          for (let k = -radius; k <= radius; k++) {
            const at = Math.min(len - 1, Math.max(0, i + k));
            const v = src[base + at * step];
            if (v > most) most = v;
          }
          out[base + i * step] = most;
        }
      }
      return out;
    };
    return pass(pass(blend, true), false);
  }

  /** Eased 0 to 1 between two edges; the plain ramp it replaces shows where it starts and stops. */
  private smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0 || 1)));
    return t * t * (3 - 2 * t);
  }

  /** Softens the depth map, so lighting reads as shape rather than as an outline of every edge. */
  private smoothDepth(depth: Float32Array, width: number, height: number, radius: number): Float32Array {
    if (radius < 1) return depth;
    const pass = (src: Float32Array, horizontal: boolean) => {
      const out = new Float32Array(src.length);
      const len = horizontal ? width : height;
      const lines = horizontal ? height : width;
      const step = horizontal ? 1 : width;
      for (let line = 0; line < lines; line++) {
        const base = horizontal ? line * width : line;
        let sum = 0;
        for (let i = -radius; i <= radius; i++) sum += src[base + Math.min(len - 1, Math.max(0, i)) * step];
        for (let i = 0; i < len; i++) {
          out[base + i * step] = sum / (radius * 2 + 1);
          sum += src[base + Math.min(len - 1, i + radius + 1) * step] - src[base + Math.max(0, i - radius) * step];
        }
      }
      return out;
    };
    return pass(pass(depth, true), false);
  }

  /**
   * Portrait blur: the subject stays sharp, everything else falls away.
   *
   * The subject is taken to be the nearest part of the scene, and everything within a band of that
   * distance is left untouched - blurring by depth alone, as this did before, left the subject
   * itself softened and nothing in the picture truly sharp. Beyond the band the blur eases in
   * through two strengths, which reads more like a lens than a single blurred copy faded in.
   */
  private applyPortraitBlur(
    original: ImageData,
    rawDepth: Float32Array,
    width: number,
    height: number,
    strength = 1
  ): ImageData {
    const threshold = this.focusThreshold(rawDepth);
    const falloff = 0.18;
    const radius = this.blurRadiusFor(width, height, strength);
    const gentle = this.blurredCopy(original, Math.max(2, radius * 0.35));
    const strong = this.blurredCopy(original, radius);

    // How much each pixel is blurred: nothing at the subject and anything in front of it, easing
    // to everything well behind it.
    const blend = new Float32Array(width * height);
    for (let i = 0; i < blend.length; i++) {
      blend[i] = 1 - this.smoothstep(threshold - falloff, threshold, rawDepth[i]);
    }
    const spread = this.spreadBlur(blend, width, height, Math.round(Math.max(width, height) * 0.004));

    const out = new ImageData(width, height);
    for (let i = 0; i < width * height; i++) {
      const t = spread[i];
      const p = i * 4;
      for (let c = 0; c < 3; c++) {
        const sharp = original.data[p + c];
        const soft = gentle.data[p + c];
        const softer = strong.data[p + c];
        // Through the gentle blur first, then on to the strong one.
        out.data[p + c] = t < 0.5
          ? sharp + (soft - sharp) * (t * 2)
          : soft + (softer - soft) * ((t - 0.5) * 2);
      }
      out.data[p + 3] = original.data[p + 3];
    }
    return out;
  }

  /**
   * Studio light: a light placed in front of the scene, to one side.
   *
   * Surface direction comes from how the depth changes across the picture. Measuring that between
   * neighbouring pixels made it depend on the photo's size - on a large photo the differences are
   * tiny, every surface came out facing the camera, and the effect was a flat dimming of the whole
   * picture. Sampling a fixed fraction of the picture instead makes the shading the same at any
   * size, and the light now both brightens and shades rather than only darkening.
   */
  private applyRelighting(
    original: ImageData,
    rawDepth: Float32Array,
    width: number,
    height: number,
    strength = 1
  ): ImageData {
    const out = new ImageData(width, height);
    const longest = Math.max(width, height);
    const step = Math.max(1, Math.round(longest / 256));
    // Smoothed more widely than it is sampled: a depth map is enlarged from a smaller grid, and
    // the ripples that leaves would otherwise be lit as if they were ridges in flat sky.
    const depth = this.smoothDepth(rawDepth, width, height, step * 3);

    // Light from the upper left, towards the viewer.
    const lx = -0.55;
    const ly = -0.62;
    const lz = 0.85;
    const lMag = Math.hypot(lx, ly, lz);
    const nLx = lx / lMag;
    const nLy = ly / lMag;
    const nLz = lz / lMag;
    // Halfway between the light and the viewer, for the sheen on surfaces facing both.
    const hMag = Math.hypot(nLx, nLy, nLz + 1);
    const hx = nLx / hMag;
    const hy = nLy / hMag;
    const hz = (nLz + 1) / hMag;

    const relief = 0.75 * strength;
    const diffuse = 0.58 * strength;
    // Broad and faint: a tight highlight picks out every wobble in the depth map as a ring.
    const sheen = 0.07 * strength;
    const maxSlope = 2.5;
    // Below this the surface counts as flat. Enlarging a depth map leaves faint ripples in even
    // ground and sky, and without this they are lit as texture that is not there.
    const flat = 0.14;
    const gains = new Float32Array(width * height);
    const speculars = new Float32Array(width * height);
    let gainTotal = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const left = depth[y * width + Math.max(0, x - step)];
        const right = depth[y * width + Math.min(width - 1, x + step)];
        const up = depth[Math.max(0, y - step) * width + x];
        const down = depth[Math.min(height - 1, y + step) * width + x];

        // Slope per fraction of the picture, so it does not change with the photo's size.
        // Capped, so a hard edge in the depth map cannot turn into a wall of shadow.
        const gx = Math.max(-maxSlope, Math.min(maxSlope, ((right - left) / (2 * step)) * longest * relief));
        const gy = Math.max(-maxSlope, Math.min(maxSlope, ((down - up) / (2 * step)) * longest * relief));
        // Eased rather than switched: a hard cut would draw its own outline where it took effect.
        const slope = Math.hypot(gx, gy);
        const keep = this.smoothstep(flat, flat * 3, slope);
        const fx = gx * keep;
        const fy = gy * keep;
        const nMag = Math.hypot(fx, fy, 1);
        const nx = -fx / nMag;
        const ny = -fy / nMag;
        const nz = 1 / nMag;

        const lambert = Math.max(0, nx * nLx + ny * nLy + nz * nLz);
        // A lamp in front reaches what is near it. That also keeps the shading off the far
        // distance, where an enlarged depth map is least trustworthy - sky picked up ripples of
        // light and shade that are not in the photograph.
        const reach = 0.3 + 0.7 * rawDepth[i];
        speculars[i] = Math.pow(Math.max(0, nx * hx + ny * hy + nz * hz), 12) * sheen * reach;
        gains[i] = 1 + diffuse * (lambert - 0.5) * reach;
        gainTotal += gains[i];
      }
    }

    // Centred on the picture's own brightness: lit sides come up, turned-away sides go down, and
    // the photo as a whole is no lighter or darker than it was.
    const average = gainTotal / Math.max(1, gains.length);
    for (let i = 0; i < gains.length; i++) {
      const gain = gains[i] / (average || 1);
      const p = i * 4;
      for (let c = 0; c < 3; c++) {
        out.data[p + c] = Math.min(255, original.data[p + c] * gain + 255 * speculars[i]);
      }
      out.data[p + 3] = original.data[p + 3];
    }
    return out;
  }

  /**
   * Fog: the distance fades into haze while the foreground stays clear.
   *
   * The haze thickens the way real haze does, over distance rather than in step with it, and the
   * nearest part of the scene is left alone - a straight curve on depth put a veil over the middle
   * of the picture too, which read as a washed-out photo rather than a foggy one.
   */
  private applyFog(
    original: ImageData,
    rawDepth: Float32Array,
    width: number,
    height: number,
    strength = 1
  ): ImageData {
    const out = new ImageData(width, height);
    const fog = [226, 232, 240];
    const density = 2.6 * strength;
    const clearUntil = 0.18;

    for (let i = 0; i < width * height; i++) {
      const away = Math.max(0, (1 - rawDepth[i] - clearUntil) / (1 - clearUntil));
      const amount = Math.min(0.97, 1 - Math.exp(-density * away * away));
      const p = i * 4;
      for (let c = 0; c < 3; c++) {
        out.data[p + c] = original.data[p + c] * (1 - amount) + fog[c] * amount;
      }
      out.data[p + 3] = original.data[p + 3];
    }
    return out;
  }

  /**
   * Viridis-inspired colormap: dark purple → blue → teal → green → yellow
   * Maps normalized depth [0..1] to vivid RGB colors.
   */
  private viridisColor(t: number): [number, number, number] {
    // Simplified viridis LUT with 5 control points
    const stops: [number, number, number, number][] = [
      [0.0,  68,   1, 84],
      [0.25, 59,  82, 139],
      [0.5,  33, 145, 140],
      [0.75, 94, 201,  98],
      [1.0, 253, 231,  37],
    ];

    // Find surrounding stops
    let lo = stops[0], hi = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i][0] && t <= stops[i + 1][0]) {
        lo = stops[i];
        hi = stops[i + 1];
        break;
      }
    }

    const f = hi[0] === lo[0] ? 0 : (t - lo[0]) / (hi[0] - lo[0]);
    return [
      Math.round(lo[1] + f * (hi[1] - lo[1])),
      Math.round(lo[2] + f * (hi[2] - lo[2])),
      Math.round(lo[3] + f * (hi[3] - lo[3])),
    ];
  }

  /** The part of the model's output that covers the picture, with any padding dropped. */
  private cropToContent(
    data: Float32Array | Uint8Array | Int32Array,
    full: { width: number; height: number },
    input: FittedInput
  ): { values: Float32Array; width: number; height: number } {
    const scaleX = full.width / Math.max(1, input.width);
    const scaleY = full.height / Math.max(1, input.height);
    const x = Math.max(0, Math.round(input.content.x * scaleX));
    const y = Math.max(0, Math.round(input.content.y * scaleY));
    const width = Math.max(1, Math.min(full.width - x, Math.round(input.content.width * scaleX)));
    const height = Math.max(1, Math.min(full.height - y, Math.round(input.content.height * scaleY)));

    if (x === 0 && y === 0 && width === full.width && height === full.height) {
      return { values: Float32Array.from(data as any), width: full.width, height: full.height };
    }

    const values = new Float32Array(width * height);
    for (let row = 0; row < height; row++) {
      const from = (y + row) * full.width + x;
      for (let col = 0; col < width; col++) {
        values[row * width + col] = Number(data[from + col]);
      }
    }
    return { values, width, height };
  }

  private resizeDepthMap(
    src: Float32Array,
    srcW: number,
    srcH: number,
    dstW: number,
    dstH: number
  ): Float32Array {
    const dst = new Float32Array(dstW * dstH);
    const xRatio = srcW / dstW;
    const yRatio = srcH / dstH;

    for (let y = 0; y < dstH; y++) {
      for (let x = 0; x < dstW; x++) {
        const sx = x * xRatio;
        const sy = y * yRatio;
        const x0 = Math.floor(sx);
        const y0 = Math.floor(sy);
        const x1 = Math.min(x0 + 1, srcW - 1);
        const y1 = Math.min(y0 + 1, srcH - 1);
        const fx = sx - x0;
        const fy = sy - y0;

        const v00 = src[y0 * srcW + x0];
        const v10 = src[y0 * srcW + x1];
        const v01 = src[y1 * srcW + x0];
        const v11 = src[y1 * srcW + x1];

        dst[y * dstW + x] =
          v00 * (1 - fx) * (1 - fy) +
          v10 * fx * (1 - fy) +
          v01 * (1 - fx) * fy +
          v11 * fx * fy;
      }
    }

    return dst;
  }

  private resolveInputShape(inputShape?: number[]) {
    const shape = inputShape ? Array.from(inputShape as ArrayLike<number>) : [1, 256, 256, 3];
    const isNchw = shape.length === 4 && shape[1] === 3;
    const height = isNchw ? shape[2] : shape[1];
    const width = isNchw ? shape[3] : shape[2];

    return {
      shape,
      layout: isNchw ? 'NCHW' as const : 'NHWC' as const,
      width: Number(width) || 256,
      height: Number(height) || 256
    };
  }

  private resolveOutputSize(length: number): { width: number; height: number } {
    try {
      const details = this.runtime?.getOutputDetails?.()[0];
      const shape = details?.shape ? Array.from(details.shape as ArrayLike<number>).filter(n => n > 1) : [];
      if (shape.length >= 2) {
        return { height: shape[shape.length - 2], width: shape[shape.length - 1] };
      }
    } catch {
      // Fall through to square inference.
    }

    const side = Math.max(1, Math.round(Math.sqrt(length)));
    return { width: side, height: Math.max(1, Math.floor(length / side)) };
  }

  private normalizeDepth(data: Float32Array | Uint8Array | Int32Array, pixelCount: number): Float32Array {
    const values: number[] = [];
    const limit = Math.min(pixelCount, data.length);

    for (let i = 0; i < limit; i++) {
      const value = Number(data[i]);
      if (Number.isFinite(value)) values.push(value);
    }

    if (values.length === 0) return new Float32Array(pixelCount);

    const sorted = [...values].sort((a, b) => a - b);
    const low = sorted[Math.floor((sorted.length - 1) * 0.02)];
    const high = sorted[Math.floor((sorted.length - 1) * 0.98)];
    const range = high - low || 1;
    const normalized = new Float32Array(pixelCount);

    for (let i = 0; i < pixelCount; i++) {
      const value = i < data.length && Number.isFinite(Number(data[i])) ? Number(data[i]) : low;
      normalized[i] = Math.max(0, Math.min(1, (value - low) / range));
    }

    return normalized;
  }

  private resizeImageData(imageData: ImageData, width: number, height: number): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    tempCanvas.getContext('2d')!.putImageData(imageData, 0, 0);

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tempCanvas, 0, 0, width, height);

    return ctx.getImageData(0, 0, width, height);
  }
}
