import * as fabric from "fabric";
import { FilterConfig } from "../../types/filters";
import { CyberpunkDuotoneFilter, HalationBloomFilter, VHSGlitchFilter, FrostedGlassFilter, VaporwaveHalftoneFilter, ThermalHeatmapFilter, NeonSobelEdgeFilter, LiquidRippleFilter, AsciiMatrixFilter, MandalaMirrorFilter, GodRaysFilter, AnamorphicFlareFilter } from "./custom/WebGLFilters";

// Dynamically detect maximum texture size supported by the hardware to prevent WebGL allocation crashes on mobile GPUs
const getMaxSupportedTextureSize = (): number => {
  try {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const maxHardwareSize = (gl as WebGLRenderingContext).getParameter((gl as WebGLRenderingContext).MAX_TEXTURE_SIZE);
        if (typeof maxHardwareSize === 'number' && maxHardwareSize > 0) {
          return maxHardwareSize;
        }
      }
    }
  } catch (e) {
    console.warn("Could not query GPU max texture size, using fallback limit", e);
  }
  return 8192; // Safe fallback limit
};

if (fabric.config) {
  const maxSize = getMaxSupportedTextureSize();
  fabric.config.textureSize = maxSize;
  fabric.config.maxCacheSideLimit = maxSize;
  fabric.config.perfLimitSizeTotal = maxSize * maxSize;
}

export function rebuildFabricFilters(obj: any, filtersObj: any) {
  if (!obj || !filtersObj) return;
  const startTime = performance.now();
  
  obj.filters = [];
  const configList: FilterConfig[] = obj.customFilters || [];
  
  for (const item of configList) {
    if (!item.enabled) continue;
    let filterInstance: any = null;
    
    try {
      switch (item.type) {
        case 'brightness':
          if (filtersObj.Brightness) {
            filterInstance = new filtersObj.Brightness({ brightness: Number(item.params.value || 0) });
          }
          break;
        case 'contrast':
          if (filtersObj.Contrast) {
            filterInstance = new filtersObj.Contrast({ contrast: Number(item.params.value || 0) });
          }
          break;
        case 'saturation':
          if (filtersObj.Saturation) {
            filterInstance = new filtersObj.Saturation({ saturation: Number(item.params.value || 0) });
          }
          break;
        case 'vibrance':
          if (filtersObj.Saturation) {
            // Stronger selective saturation boost
            filterInstance = new filtersObj.Saturation({ saturation: Number(item.params.value || 0) * 1.35 });
          }
          break;
        case 'exposure':
          if (filtersObj.Brightness) {
            // Exposure modeled through Brightness values
            filterInstance = new filtersObj.Brightness({ brightness: Number(item.params.value || 0) });
          }
          break;
        case 'gamma':
          if (filtersObj.Gamma) {
            const r = item.params.red !== undefined ? Number(item.params.red) : 1.0;
            const g = item.params.green !== undefined ? Number(item.params.green) : 1.0;
            const b = item.params.blue !== undefined ? Number(item.params.blue) : 1.0;
            filterInstance = new filtersObj.Gamma({ gamma: [r, g, b] });
          }
          break;
        case 'temperature':
          if (filtersObj.ColorMatrix) {
            const val = Number(item.params.value || 0);
            const matrix = [
              1 + val, 0, 0, 0, 0,
              0, 1, 0, 0, 0,
              0, 0, 1 - val, 0, 0,
              0, 0, 0, 1, 0
            ];
            filterInstance = new filtersObj.ColorMatrix({ matrix });
          }
          break;
        case 'tint':
          if (filtersObj.ColorMatrix) {
            const val = Number(item.params.value || 0);
            const matrix = [
              1, 0, 0, 0, 0,
              0, 1 - val, 0, 0, 0,
              0, 0, 1, 0, 0,
              0, 0, 0, 1, 0
            ];
            filterInstance = new filtersObj.ColorMatrix({ matrix });
          }
          break;
        case 'hueRotation':
          if (filtersObj.HueRotation) {
            filterInstance = new filtersObj.HueRotation({ rotation: Number(item.params.value || 0) });
          } else if (filtersObj.ColorMatrix) {
            const angle = (Number(item.params.value || 0) || 0) * Math.PI / 180;
            const cosVal = Math.cos(angle);
            const sinVal = Math.sin(angle);
            const matrix = [
              0.213 + cosVal*0.787 - sinVal*0.213, 0.715 - cosVal*0.715 - sinVal*0.715, 0.072 - cosVal*0.072 + sinVal*0.928, 0, 0,
              0.213 - cosVal*0.213 + sinVal*0.143, 0.715 + cosVal*0.285 + sinVal*0.140, 0.072 - cosVal*0.072 - sinVal*0.283, 0, 0,
              0.213 - cosVal*0.213 - sinVal*0.787, 0.715 - cosVal*0.715 + sinVal*0.715, 0.072 + cosVal*0.928 + sinVal*0.072, 0, 0,
              0, 0, 0, 1, 0
            ];
            filterInstance = new filtersObj.ColorMatrix({ matrix });
          }
          break;
        case 'grayscale':
          if (filtersObj.Grayscale) {
            filterInstance = new filtersObj.Grayscale({ mode: item.params.mode || 'luminosity' });
          }
          break;
        case 'invert':
          if (filtersObj.Invert) {
            filterInstance = new filtersObj.Invert();
          }
          break;
        case 'sepia':
          if (filtersObj.Sepia) {
            filterInstance = new filtersObj.Sepia();
          }
          break;
        case 'blackwhite':
          if (filtersObj.ColorMatrix) {
            const matrix = [
              1.5, 1.5, 1.5, 0, -1,
              1.5, 1.5, 1.5, 0, -1,
              1.5, 1.5, 1.5, 0, -1,
              0, 0, 0, 1, 0
            ];
            filterInstance = new filtersObj.ColorMatrix({ matrix });
          } else if (filtersObj.Grayscale) {
            filterInstance = new filtersObj.Grayscale();
          }
          break;
        case 'removeColor':
          if (filtersObj.RemoveColor) {
            filterInstance = new filtersObj.RemoveColor({
              color: item.params.color || '#ffffff',
              distance: Number(item.params.distance !== undefined ? item.params.distance : 0.15)
            });
          }
          break;
        case 'noise':
          if (filtersObj.Noise) {
            filterInstance = new filtersObj.Noise({ noise: Number(item.params.value || 50) });
          }
          break;
        case 'pixelate':
          if (filtersObj.Pixelate) {
            filterInstance = new filtersObj.Pixelate({ blocksize: Number(item.params.value || 8) });
          }
          break;
        case 'blur':
          if (filtersObj.Blur) {
            filterInstance = new filtersObj.Blur({ blur: Number(item.params.value || 0.2) });
          }
          break;
        case 'edge':
          if (filtersObj.Convolute) {
            filterInstance = new filtersObj.Convolute({
              matrix: [-1, -1, -1, -1, 8, -1, -1, -1, -1]
            });
          }
          break;
        case 'sharpen':
          if (filtersObj.Convolute) {
            filterInstance = new filtersObj.Convolute({
              matrix: [0, -1, 0, -1, 5, -1, 0, -1, 0]
            });
          }
          break;
        case 'emboss':
          if (filtersObj.Convolute) {
            filterInstance = new filtersObj.Convolute({
              matrix: [-2, -1, 0, -1, 1, 1, 0, 1, 2]
            });
          }
          break;
        case 'vignette':
          if (filtersObj.ColorMatrix) {
            const matrix = [
              0.9, 0, 0, 0, -10,
              0, 0.9, 0, 0, -10,
              0, 0, 0.9, 0, -15,
              0, 0, 0, 1, 0
            ];
            filterInstance = new filtersObj.ColorMatrix({ matrix });
          }
          break;
        case 'bloom':
          if (filtersObj.ColorMatrix) {
            const matrix = [
              1.3, 0, 0, 0, 12,
              0, 1.3, 0, 0, 12,
              0, 0, 1.3, 0, 12,
              0, 0, 0, 1, 0
            ];
            filterInstance = new filtersObj.ColorMatrix({ matrix });
          }
          break;
        case 'chromatic':
          if (filtersObj.ColorMatrix) {
            const matrix = [
              1.22, 0, 0, 0, 0,
              0, 1.0, 0, 0, 0,
              0, 0, 1.22, 0, 0,
              0, 0, 0, 1.0, 0
            ];
            filterInstance = new filtersObj.ColorMatrix({ matrix });
          }
          break;
        case 'nightVision':
          if (filtersObj.ColorMatrix) {
            const matrix = [
              0, 0, 0, 0, 0,
              0, 1.2, 0, 0, 0,
              0, 0, 0, 0, 0,
              0, 0, 0, 1, 0
            ];
            filterInstance = new filtersObj.ColorMatrix({ matrix });
          }
          break;
        case 'unsharpMask':
          if (filtersObj.Convolute) {
            filterInstance = new filtersObj.Convolute({
              matrix: [-1, -1, -1, -1, 9, -1, -1, -1, -1]
            });
          }
          break;
        case 'blendColor':
          if (filtersObj.BlendColor) {
            filterInstance = new filtersObj.BlendColor({
              color: item.params.color || '#3b82f6',
              mode: item.params.mode || 'multiply',
              alpha: Number(item.params.alpha !== undefined ? item.params.alpha : 0.5)
            });
          }
          break;
        case 'cyberpunkDuotone':
          filterInstance = new CyberpunkDuotoneFilter({ intensity: Number(item.params.value !== undefined ? item.params.value : 1.0) });
          break;
        case 'halationBloom':
          filterInstance = new HalationBloomFilter({ intensity: Number(item.params.value !== undefined ? item.params.value : 0.5) });
          break;
        case 'vhsGlitch':
          filterInstance = new VHSGlitchFilter({ intensity: Number(item.params.value !== undefined ? item.params.value : 0.5) });
          break;
        case 'frostedGlass':
          filterInstance = new FrostedGlassFilter({ intensity: Number(item.params.value !== undefined ? item.params.value : 0.5) });
          break;
        case 'vaporwaveHalftone':
          filterInstance = new VaporwaveHalftoneFilter({ intensity: Number(item.params.value !== undefined ? item.params.value : 1.0) });
          break;
        case 'thermalHeatmap':
          filterInstance = new ThermalHeatmapFilter({ intensity: Number(item.params.value !== undefined ? item.params.value : 1.0) });
          break;
        case 'neonSobelEdge':
          filterInstance = new NeonSobelEdgeFilter({
            intensity: Number(item.params.value !== undefined ? item.params.value : 1.0),
            color: item.params.color || '#00ffcc'
          });
          break;
        case 'liquidRipple':
          filterInstance = new LiquidRippleFilter({ intensity: Number(item.params.value !== undefined ? item.params.value : 1.0) });
          break;
        case 'asciiMatrix':
          filterInstance = new AsciiMatrixFilter({ intensity: Number(item.params.value !== undefined ? item.params.value : 1.0) });
          break;
        case 'mandalaMirror':
          filterInstance = new MandalaMirrorFilter({ intensity: Number(item.params.value !== undefined ? item.params.value : 1.0) });
          break;
        case 'godRays':
          filterInstance = new GodRaysFilter({ intensity: Number(item.params.value !== undefined ? item.params.value : 1.0) });
          break;
        case 'anamorphicFlare':
          filterInstance = new AnamorphicFlareFilter({ intensity: Number(item.params.value !== undefined ? item.params.value : 1.0) });
          break;
        case 'preset':
          if (filtersObj.ColorMatrix) {
            const presetName = item.params.name;
            let m: number[] = [];
            if (presetName === 'brownie') {
              m = [0.5997, 0.3455, -0.2708, 0, 0.186, -0.0377, 0.8609, 0.1505, 0, -0.1449, 0.2411, -0.0744, 1.3503, 0, -0.0296, 0, 0, 0, 1, 0];
            } else if (presetName === 'vintage') {
              m = [0.6279, 0.3202, -0.0396, 0, 0.037, -0.0257, 0.6400, 0.2191, 0, 0.025, 0.0464, -0.0822, 0.3015, 0, 0.074, 0, 0, 0, 1, 0];
            } else if (presetName === 'technicolor') {
              m = [1.9125, -0.8545, -0.0915, 0, 0.0462, -0.3087, 1.7658, -0.1060, 0, -0.0125, -0.2311, -0.7501, 1.8475, 0, 0.1214, 0, 0, 0, 1, 0];
            } else if (presetName === 'kodachrome') {
              m = [1.1285, -0.0445, -0.0078, 0, 0.0597, -0.0221, 1.0751, 0.0070, 0, 0.0638, -0.0483, -0.1537, 1.2582, 0, -0.1387, 0, 0, 0, 1, 0];
            } else if (presetName === 'polaroid') {
              m = [1.438, -0.062, -0.062, 0, 0, -0.122, 1.378, -0.122, 0, 0, -0.016, -0.016, 1.483, 0, 0, 0, 0, 0, 1, 0];
            } else if (presetName === 'hdr') {
              m = [1.2, 0,  0, 0, 0.1,  0, 1.2, 0, 0, 0.1,  0, 0, 1.2, 0, 0.1,  0, 0, 0, 1, 0];
            } else if (presetName === 'film') {
              m = [0.88, 0.06, 0.06, 0, 0,  0.06, 0.88, 0.06, 0, 0,  0.06, 0.06, 0.88, 0, 0,  0, 0, 0, 1, 0];
            } else if (presetName === 'instagram') {
              m = [1.08, 0, 0.08, 0, 0,  0, 1.08, 0, 0, 0,  0, 0, 1.15, 0, -0.08,  0, 0, 0, 1, 0];
            } else if (presetName === 'vibrant') {
              m = [1.18, -0.08, -0.08, 0, 0,  -0.08, 1.18, -0.08, 0, 0,  -0.08, -0.08, 1.18, 0, 0,  0, 0, 0, 1, 0];
            } else if (presetName === 'soft') {
              m = [0.92, 0.04, 0.04, 0, 0.01,  0.04, 0.92, 0.04, 0, 0.01,  0.04, 0.04, 0.92, 0, 0.01,  0, 0, 0, 1, 0];
            }
            if (m.length > 0) {
              filterInstance = new filtersObj.ColorMatrix({ matrix: m });
            }
          }
          break;
        default:
          break;
      }
      if (filterInstance) {
        obj.filters.push(filterInstance);
      }
    } catch (err) {
      console.error("Error defining filter instance:", item.type, err);
    }
  }
  
  try {
    obj.applyFilters();
  } catch (applyErr) {
    console.error("Error executing obj.applyFilters():", applyErr);
  }
  const endTime = performance.now();
  obj.lastFilterBenchmark = {
    filterTimeMs: (endTime - startTime).toFixed(1),
    backend: "WebGL",
    outputWidth: obj.width ? Math.round(obj.width * (obj.scaleX || 1)) : 0,
    outputHeight: obj.height ? Math.round(obj.height * (obj.scaleY || 1)) : 0
  };
}
