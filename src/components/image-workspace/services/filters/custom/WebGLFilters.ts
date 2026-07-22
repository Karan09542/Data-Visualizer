import * as fabric from 'fabric';

export class CyberpunkDuotoneFilter extends (fabric as any).filters.BaseFilter {
  static type = 'CyberpunkDuotone';
  intensity: number = 1.0;
  
  constructor(options: any = {}) {
    super(options);
    this.intensity = options.intensity !== undefined ? options.intensity : 1.0;
  }
  
  getFragmentSource() {
    return `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      uniform sampler2D uTexture;
      uniform float uIntensity;
      varying vec2 vTexCoord;
      
      void main() {
        vec4 color = texture2D(uTexture, vTexCoord);
        float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        vec3 darkColor = vec3(0.05, 0.0, 0.3); 
        vec3 midColor = vec3(0.8, 0.1, 0.5);
        vec3 lightColor = vec3(0.0, 1.0, 0.9);
        
        vec3 duotone;
        if (luma < 0.5) {
           duotone = mix(darkColor, midColor, luma * 2.0);
        } else {
           duotone = mix(midColor, lightColor, (luma - 0.5) * 2.0);
        }
        
        gl_FragColor = vec4(mix(color.rgb, duotone, uIntensity), color.a);
      }
    `;
  }
  
  getUniformLocations(gl: any, program: any) {
    return {
      uIntensity: gl.getUniformLocation(program, 'uIntensity'),
    };
  }
  
  sendUniformData(gl: any, uniformLocations: any) {
    gl.uniform1f(uniformLocations.uIntensity, this.intensity);
  }
  
  toObject() {
    return { ...super.toObject(), intensity: this.intensity };
  }
}

export class HalationBloomFilter extends (fabric as any).filters.BaseFilter {
  static type = 'HalationBloom';
  intensity: number = 0.5;
  
  constructor(options: any = {}) {
    super(options);
    this.intensity = options.intensity !== undefined ? options.intensity : 0.5;
  }
  
  getFragmentSource() {
    return `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      uniform sampler2D uTexture;
      uniform float uIntensity;
      varying vec2 vTexCoord;
      
      void main() {
        vec4 color = texture2D(uTexture, vTexCoord);
        vec3 sum = vec3(0.0);
        // Pseudo-bloom: Sample neighboring pixels (simplified 5-tap for halation)
        sum += texture2D(uTexture, vTexCoord + vec2(-0.005, -0.005)).rgb;
        sum += texture2D(uTexture, vTexCoord + vec2(0.005, -0.005)).rgb;
        sum += texture2D(uTexture, vTexCoord + vec2(-0.005, 0.005)).rgb;
        sum += texture2D(uTexture, vTexCoord + vec2(0.005, 0.005)).rgb;
        
        vec3 blur = sum * 0.25;
        // Halation specifically tints the highlight spread red
        float highlight = max(0.0, dot(blur, vec3(0.33)) - 0.5) * 2.0;
        vec3 halationColor = vec3(1.0, 0.2, 0.1) * highlight * uIntensity * 2.0;
        
        gl_FragColor = vec4(color.rgb + halationColor + blur * uIntensity * 0.2, color.a);
      }
    `;
  }
  
  getUniformLocations(gl: any, program: any) {
    return {
      uIntensity: gl.getUniformLocation(program, 'uIntensity'),
    };
  }
  
  sendUniformData(gl: any, uniformLocations: any) {
    gl.uniform1f(uniformLocations.uIntensity, this.intensity);
  }
  
  toObject() {
    return { ...super.toObject(), intensity: this.intensity };
  }
}

export class VHSGlitchFilter extends (fabric as any).filters.BaseFilter {
  static type = 'VHSGlitch';
  intensity: number = 0.5;
  
  constructor(options: any = {}) {
    super(options);
    this.intensity = options.intensity !== undefined ? options.intensity : 0.5;
  }
  
  getFragmentSource() {
    return `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      uniform sampler2D uTexture;
      uniform float uIntensity;
      varying vec2 vTexCoord;
      
      float rand(vec2 co) {
          return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
      }
      
      void main() {
        // Scanlines
        float scanline = sin(vTexCoord.y * 800.0) * 0.04 * uIntensity;
        
        // RGB split (chromatic aberration & glitch displacement)
        float displacement = rand(vec2(vTexCoord.y, 1.0)) > 0.95 ? 0.02 * uIntensity : 0.0;
        
        vec2 rCoord = vTexCoord + vec2(0.005 * uIntensity + displacement, 0.0);
        vec2 gCoord = vTexCoord;
        vec2 bCoord = vTexCoord + vec2(-0.005 * uIntensity - displacement, 0.0);
        
        float r = texture2D(uTexture, rCoord).r;
        float g = texture2D(uTexture, gCoord).g;
        float b = texture2D(uTexture, bCoord).b;
        
        vec3 col = vec3(r, g, b);
        col -= scanline;
        
        gl_FragColor = vec4(col, texture2D(uTexture, vTexCoord).a);
      }
    `;
  }
  
  getUniformLocations(gl: any, program: any) {
    return {
      uIntensity: gl.getUniformLocation(program, 'uIntensity'),
    };
  }
  
  sendUniformData(gl: any, uniformLocations: any) {
    gl.uniform1f(uniformLocations.uIntensity, this.intensity);
  }
  
  toObject() {
    return { ...super.toObject(), intensity: this.intensity };
  }
}

export class FrostedGlassFilter extends (fabric as any).filters.BaseFilter {
  static type = 'FrostedGlass';
  intensity: number = 0.5;
  
  constructor(options: any = {}) {
    super(options);
    this.intensity = options.intensity !== undefined ? options.intensity : 0.5;
  }
  
  getFragmentSource() {
    return `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      uniform sampler2D uTexture;
      uniform float uIntensity;
      varying vec2 vTexCoord;
      
      float rand(vec2 co) {
          return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
      }
      
      void main() {
        vec2 offset = vec2(
           (rand(vTexCoord) - 0.5) * 0.03 * uIntensity,
           (rand(vTexCoord + vec2(1.0, 1.0)) - 0.5) * 0.03 * uIntensity
        );
        vec4 color = texture2D(uTexture, vTexCoord + offset);
        gl_FragColor = color;
      }
    `;
  }
  
  getUniformLocations(gl: any, program: any) {
    return {
      uIntensity: gl.getUniformLocation(program, 'uIntensity'),
    };
  }
  
  sendUniformData(gl: any, uniformLocations: any) {
    gl.uniform1f(uniformLocations.uIntensity, this.intensity);
  }
  
  toObject() {
    return { ...super.toObject(), intensity: this.intensity };
  }
}

export class VaporwaveHalftoneFilter extends (fabric as any).filters.BaseFilter {
  static type = 'VaporwaveHalftone';
  intensity: number = 1.0;
  
  constructor(options: any = {}) {
    super(options);
    this.intensity = options.intensity !== undefined ? options.intensity : 1.0;
  }
  
  getFragmentSource() {
    return `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      uniform sampler2D uTexture;
      uniform float uIntensity;
      varying vec2 vTexCoord;
      
      void main() {
        vec4 color = texture2D(uTexture, vTexCoord);
        float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        
        // Halftone dot logic
        float scale = 150.0;
        vec2 grid = fract(vTexCoord * scale) - 0.5;
        float dist = length(grid);
        float radius = (1.0 - luma) * 0.7;
        
        float halftone = smoothstep(radius, radius + 0.1, dist);
        
        // Vaporwave color tinting
        vec3 vwColor1 = vec3(0.9, 0.3, 0.8); // Pink
        vec3 vwColor2 = vec3(0.1, 0.8, 0.9); // Cyan
        
        vec3 outColor = mix(vwColor1, vwColor2, halftone);
        
        gl_FragColor = vec4(mix(color.rgb, outColor, uIntensity), color.a);
      }
    `;
  }
  
  getUniformLocations(gl: any, program: any) {
    return {
      uIntensity: gl.getUniformLocation(program, 'uIntensity'),
    };
  }
  
  sendUniformData(gl: any, uniformLocations: any) {
    gl.uniform1f(uniformLocations.uIntensity, this.intensity);
  }
  
  toObject() {
    return { ...super.toObject(), intensity: this.intensity };
  }
}

export class ThermalHeatmapFilter extends (fabric as any).filters.BaseFilter {
  static type = 'ThermalHeatmap';
  intensity: number = 1.0;
  
  constructor(options: any = {}) {
    super(options);
    this.intensity = options.intensity !== undefined ? options.intensity : 1.0;
  }
  
  getFragmentSource() {
    return `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      uniform sampler2D uTexture;
      uniform float uIntensity;
      varying vec2 vTexCoord;
      
      vec3 getThermalColor(float v) {
         if(v < 0.25) return mix(vec3(0.0, 0.0, 0.2), vec3(0.2, 0.0, 0.8), v * 4.0);
         if(v < 0.5) return mix(vec3(0.2, 0.0, 0.8), vec3(0.8, 0.0, 0.4), (v - 0.25) * 4.0);
         if(v < 0.75) return mix(vec3(0.8, 0.0, 0.4), vec3(0.9, 0.8, 0.0), (v - 0.5) * 4.0);
         return mix(vec3(0.9, 0.8, 0.0), vec3(1.0, 1.0, 1.0), (v - 0.75) * 4.0);
      }
      
      void main() {
        vec4 color = texture2D(uTexture, vTexCoord);
        float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        vec3 thermal = getThermalColor(luma);
        
        gl_FragColor = vec4(mix(color.rgb, thermal, uIntensity), color.a);
      }
    `;
  }
  
  getUniformLocations(gl: any, program: any) {
    return {
      uIntensity: gl.getUniformLocation(program, 'uIntensity'),
    };
  }
  
  sendUniformData(gl: any, uniformLocations: any) {
    gl.uniform1f(uniformLocations.uIntensity, this.intensity);
  }
  
  toObject() {
    return { ...super.toObject(), intensity: this.intensity };
  }
}

function parseHexToRgbaNormalized(colorStr: string): [number, number, number, number] {
  if (!colorStr) return [0.0, 1.0, 0.8, 1.0];

  // 1. Check for rgb(...) or rgba(...) strings (returned by RgbaStringColorPicker)
  const rgbaMatch = colorStr.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i);
  if (rgbaMatch) {
    const r = Math.max(0, Math.min(255, parseInt(rgbaMatch[1], 10))) / 255;
    const g = Math.max(0, Math.min(255, parseInt(rgbaMatch[2], 10))) / 255;
    const b = Math.max(0, Math.min(255, parseInt(rgbaMatch[3], 10))) / 255;
    const a = rgbaMatch[4] !== undefined ? Math.max(0, Math.min(1, parseFloat(rgbaMatch[4]))) : 1.0;
    return [r, g, b, a];
  }

  // 2. Check for hex format #rgb, #rrggbb, #rgba, #rrggbbaa
  let cleanHex = colorStr.trim();
  if (cleanHex.startsWith('#')) {
    let hex = cleanHex.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = hex.split('').map(x => x + x).join('');
    }
    if (hex.length === 6) {
      const num = parseInt(hex, 16);
      if (!isNaN(num)) {
        return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255, 1.0];
      }
    } else if (hex.length === 8) {
      const num = parseInt(hex, 16);
      if (!isNaN(num)) {
        return [((num >> 24) & 255) / 255, ((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
      }
    }
  }

  // 3. Fallback: Use Fabric Color parser if available
  if (fabric && (fabric as any).Color) {
    try {
      const c = new (fabric as any).Color(colorStr);
      if (c && typeof c.getSource === 'function') {
        const source = c.getSource();
        if (source && source.length >= 3) {
          const a = source.length >= 4 ? source[3] : 1.0;
          return [source[0] / 255, source[1] / 255, source[2] / 255, a];
        }
      }
    } catch (e) {}
  }

  // 4. Fallback: Canvas2D fillStyle parsing for named colors or HSL
  try {
    if (typeof document !== 'undefined') {
      const tempCtx = document.createElement('canvas').getContext('2d');
      if (tempCtx) {
        tempCtx.fillStyle = colorStr;
        const computed = tempCtx.fillStyle;
        const m = computed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i);
        if (m) {
          const a = m[4] !== undefined ? parseFloat(m[4]) : 1.0;
          return [parseInt(m[1], 10) / 255, parseInt(m[2], 10) / 255, parseInt(m[3], 10) / 255, a];
        }
      }
    }
  } catch (e) {}

  return [0.0, 1.0, 0.8, 1.0]; // Cyan fallback with full opacity
}

export class NeonSobelEdgeFilter extends (fabric as any).filters.BaseFilter {
  static type = 'NeonSobelEdge';
  intensity: number = 1.0;
  color: string = '#00ffcc';
  
  constructor(options: any = {}) {
    super(options);
    this.intensity = options.intensity !== undefined ? options.intensity : 1.0;
    this.color = options.color || '#00ffcc';
  }
  
  getFragmentSource() {
    return `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      uniform sampler2D uTexture;
      uniform float uIntensity;
      uniform vec4 uColor;
      varying vec2 vTexCoord;
      
      float luma(vec3 color) {
         return dot(color, vec3(0.299, 0.587, 0.114));
      }
      
      void main() {
        vec2 d = vec2(0.002, 0.002);
        
        float s00 = luma(texture2D(uTexture, vTexCoord + vec2(-d.x, -d.y)).rgb);
        float s10 = luma(texture2D(uTexture, vTexCoord + vec2(0.0, -d.y)).rgb);
        float s20 = luma(texture2D(uTexture, vTexCoord + vec2(d.x, -d.y)).rgb);
        
        float s01 = luma(texture2D(uTexture, vTexCoord + vec2(-d.x, 0.0)).rgb);
        float s21 = luma(texture2D(uTexture, vTexCoord + vec2(d.x, 0.0)).rgb);
        
        float s02 = luma(texture2D(uTexture, vTexCoord + vec2(-d.x, d.y)).rgb);
        float s12 = luma(texture2D(uTexture, vTexCoord + vec2(0.0, d.y)).rgb);
        float s22 = luma(texture2D(uTexture, vTexCoord + vec2(d.x, d.y)).rgb);
        
        float sx = s00 + 2.0 * s10 + s20 - (s02 + 2.0 * s12 + s22);
        float sy = s00 + 2.0 * s01 + s02 - (s20 + 2.0 * s21 + s22);
        float dist = sqrt(sx * sx + sy * sy);
        
        vec3 edgeGlow = uColor.rgb * dist * 3.0;
        float glowMix = uColor.a * uIntensity;
        
        vec4 orig = texture2D(uTexture, vTexCoord);
        gl_FragColor = vec4(mix(orig.rgb, edgeGlow, glowMix), orig.a);
      }
    `;
  }
  
  getUniformLocations(gl: any, program: any) {
    return {
      uIntensity: gl.getUniformLocation(program, 'uIntensity'),
      uColor: gl.getUniformLocation(program, 'uColor'),
    };
  }
  
  sendUniformData(gl: any, uniformLocations: any) {
    gl.uniform1f(uniformLocations.uIntensity, this.intensity);
    const rgba = parseHexToRgbaNormalized(this.color);
    gl.uniform4f(uniformLocations.uColor, rgba[0], rgba[1], rgba[2], rgba[3]);
  }
  
  toObject() {
    return { ...super.toObject(), intensity: this.intensity, color: this.color };
  }
}

export class LiquidRippleFilter extends (fabric as any).filters.BaseFilter {
  static type = 'LiquidRipple';
  intensity: number = 1.0;
  
  constructor(options: any = {}) {
    super(options);
    this.intensity = options.intensity !== undefined ? options.intensity : 1.0;
  }
  
  getFragmentSource() {
    return `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      uniform sampler2D uTexture;
      uniform float uIntensity;
      varying vec2 vTexCoord;
      
      void main() {
        float dist = distance(vTexCoord, vec2(0.5));
        vec2 offset = normalize(vTexCoord - vec2(0.5)) * sin(dist * 50.0) * 0.05 * uIntensity;
        vec4 color = texture2D(uTexture, vTexCoord + offset);
        gl_FragColor = color;
      }
    `;
  }
  
  getUniformLocations(gl: any, program: any) {
    return {
      uIntensity: gl.getUniformLocation(program, 'uIntensity'),
    };
  }
  
  sendUniformData(gl: any, uniformLocations: any) {
    gl.uniform1f(uniformLocations.uIntensity, this.intensity);
  }
  
  toObject() {
    return { ...super.toObject(), intensity: this.intensity };
  }
}

export class AsciiMatrixFilter extends (fabric as any).filters.BaseFilter {
  static type = 'AsciiMatrix';
  intensity: number = 1.0;
  
  constructor(options: any = {}) {
    super(options);
    this.intensity = options.intensity !== undefined ? options.intensity : 1.0;
  }
  
  getFragmentSource() {
    return `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      uniform sampler2D uTexture;
      uniform float uIntensity;
      varying vec2 vTexCoord;
      
      void main() {
        vec2 grid = floor(vTexCoord * 100.0) / 100.0;
        vec3 sampleColor = texture2D(uTexture, grid).rgb;
        float luma = dot(sampleColor, vec3(0.299, 0.587, 0.114));
        
        vec2 cell = fract(vTexCoord * 100.0) - 0.5;
        float charMask = 0.0;
        
        if (luma > 0.8) { charMask = step(length(cell), 0.4); } 
        else if (luma > 0.6) { charMask = step(abs(cell.x)+abs(cell.y), 0.4); } 
        else if (luma > 0.4) { charMask = step(abs(cell.x), 0.2) + step(abs(cell.y), 0.2); } 
        else if (luma > 0.2) { charMask = step(abs(cell.y), 0.2); } 
        else if (luma > 0.05) { charMask = step(length(cell), 0.1); } 
        
        vec3 asciiColor = vec3(0.0, 1.0, 0.0) * charMask;
        vec4 orig = texture2D(uTexture, vTexCoord);
        
        gl_FragColor = vec4(mix(orig.rgb, asciiColor, uIntensity), orig.a);
      }
    `;
  }
  
  getUniformLocations(gl: any, program: any) {
    return {
      uIntensity: gl.getUniformLocation(program, 'uIntensity'),
    };
  }
  
  sendUniformData(gl: any, uniformLocations: any) {
    gl.uniform1f(uniformLocations.uIntensity, this.intensity);
  }
  
  toObject() {
    return { ...super.toObject(), intensity: this.intensity };
  }
}

export class MandalaMirrorFilter extends (fabric as any).filters.BaseFilter {
  static type = 'MandalaMirror';
  intensity: number = 1.0;
  
  constructor(options: any = {}) {
    super(options);
    this.intensity = options.intensity !== undefined ? options.intensity : 1.0;
  }
  
  getFragmentSource() {
    return `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      uniform sampler2D uTexture;
      uniform float uIntensity;
      varying vec2 vTexCoord;
      
      void main() {
        vec2 p = vTexCoord - 0.5;
        float r = length(p);
        float a = atan(p.y, p.x);
        float segments = 6.0;
        a = mod(a, 3.14159 * 2.0 / segments);
        a = abs(a - 3.14159 / segments);
        vec2 newUv = r * vec2(cos(a), sin(a)) + 0.5;
        
        vec4 color = texture2D(uTexture, mix(vTexCoord, newUv, uIntensity));
        gl_FragColor = color;
      }
    `;
  }
  
  getUniformLocations(gl: any, program: any) {
    return {
      uIntensity: gl.getUniformLocation(program, 'uIntensity'),
    };
  }
  
  sendUniformData(gl: any, uniformLocations: any) {
    gl.uniform1f(uniformLocations.uIntensity, this.intensity);
  }
  
  toObject() {
    return { ...super.toObject(), intensity: this.intensity };
  }
}

export class GodRaysFilter extends (fabric as any).filters.BaseFilter {
  static type = 'GodRays';
  intensity: number = 1.0;
  
  constructor(options: any = {}) {
    super(options);
    this.intensity = options.intensity !== undefined ? options.intensity : 1.0;
  }
  
  getFragmentSource() {
    return `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      uniform sampler2D uTexture;
      uniform float uIntensity;
      varying vec2 vTexCoord;
      
      void main() {
        vec2 center = vec2(0.5, 0.5); // Center the rays by default
        vec2 delta = (vTexCoord - center) * (1.0 / 30.0) * uIntensity;
        vec3 sum = vec3(0.0);
        vec2 uv = vTexCoord;
        float decay = 0.95;
        float weight = 1.0;
        
        for(int i=0; i<30; i++) {
            vec3 sampleColor = texture2D(uTexture, uv).rgb;
            // Lower threshold (0.4) so rays are more easily visible
            float luma = max(0.0, dot(sampleColor, vec3(0.299, 0.587, 0.114)) - 0.4);
            sum += sampleColor * luma * weight;
            weight *= decay;
            uv -= delta;
        }
        
        // Increase base multiplier to make it pop
        vec3 rays = sum * 0.3;
        vec4 orig = texture2D(uTexture, vTexCoord);
        gl_FragColor = vec4(orig.rgb + rays, orig.a);
      }
    `;
  }
  
  getUniformLocations(gl: any, program: any) {
    return {
      uIntensity: gl.getUniformLocation(program, 'uIntensity'),
    };
  }
  
  sendUniformData(gl: any, uniformLocations: any) {
    gl.uniform1f(uniformLocations.uIntensity, this.intensity);
  }
  
  toObject() {
    return { ...super.toObject(), intensity: this.intensity };
  }
}

export class AnamorphicFlareFilter extends (fabric as any).filters.BaseFilter {
  static type = 'AnamorphicFlare';
  intensity: number = 1.0;
  
  constructor(options: any = {}) {
    super(options);
    this.intensity = options.intensity !== undefined ? options.intensity : 1.0;
  }
  
  getFragmentSource() {
    return `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      uniform sampler2D uTexture;
      uniform float uIntensity;
      varying vec2 vTexCoord;
      
      void main() {
        vec3 sum = vec3(0.0);
        float spread = 0.02 * uIntensity;
        
        // Anamorphic horizontal streak
        for(int i=-15; i<=15; i++) {
            float offset = float(i) * spread;
            vec3 sampleColor = texture2D(uTexture, vTexCoord + vec2(offset, 0.0)).rgb;
            // Lower threshold (0.5) so flares trigger more easily
            float luma = max(0.0, dot(sampleColor, vec3(0.299, 0.587, 0.114)) - 0.5);
            // Distance attenuation
            float weight = 1.0 - abs(float(i)) / 15.0;
            sum += sampleColor * luma * weight;
        }
        
        // Classic anamorphic blue tint
        vec3 flare = sum * vec3(0.1, 0.3, 1.0) * 0.2; 
        vec4 orig = texture2D(uTexture, vTexCoord);
        gl_FragColor = vec4(orig.rgb + flare, orig.a);
      }
    `;
  }
  
  getUniformLocations(gl: any, program: any) {
    return {
      uIntensity: gl.getUniformLocation(program, 'uIntensity'),
    };
  }
  
  sendUniformData(gl: any, uniformLocations: any) {
    gl.uniform1f(uniformLocations.uIntensity, this.intensity);
  }
  
  toObject() {
    return { ...super.toObject(), intensity: this.intensity };
  }
}

// Register filters for Fabric serialization and deserialization
(fabric as any).classRegistry.setClass(CyberpunkDuotoneFilter);
(fabric as any).classRegistry.setClass(HalationBloomFilter);
(fabric as any).classRegistry.setClass(VHSGlitchFilter);
(fabric as any).classRegistry.setClass(FrostedGlassFilter);
(fabric as any).classRegistry.setClass(VaporwaveHalftoneFilter);
(fabric as any).classRegistry.setClass(ThermalHeatmapFilter);
(fabric as any).classRegistry.setClass(NeonSobelEdgeFilter);
(fabric as any).classRegistry.setClass(LiquidRippleFilter);
(fabric as any).classRegistry.setClass(AsciiMatrixFilter);
(fabric as any).classRegistry.setClass(MandalaMirrorFilter);
(fabric as any).classRegistry.setClass(GodRaysFilter);
(fabric as any).classRegistry.setClass(AnamorphicFlareFilter);
