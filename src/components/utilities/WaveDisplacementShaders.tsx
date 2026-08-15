import React from 'react';
import { Waves, Wind, Droplet, RotateCw, Droplets, Zap, Flame, Triangle, BarChart3, Activity, Sigma, TrendingDown, Binary, Spline, Radical, Box, Atom, Magnet, Grid3X3 } from 'lucide-react';

/**
 * Filter Mode Definitions for GLSL Displacement Shader
 */
export type FilterMode = 'directional' | 'diagonal_wipe' | 'wave' | 'vortex' | 'noise' | 'glitch' | 'radial';
export type AspectRatioMode = 'auto' | '16:9' | '9:16' | '1:1' | '4:3' | '3:4';

// Displacement Math Function Definitions
export interface DisplacementFunctionPreset {
   id: number;
   name: string;
   description: string;
   icon: React.ReactNode;
   category: 'Trigonometric' | 'Wave Shapes' | 'Physics' | 'Mathematical';
}

export const DISPLACEMENT_FUNCTIONS: DisplacementFunctionPreset[] = [
   // Trigonometric
   { id: 0, name: 'Sin / Cos', description: 'Classic smooth waves', icon: <Waves size={14} className="text-cyan-400" />, category: 'Trigonometric' },
   { id: 1, name: 'Needle Spike', description: 'Sharp peaks, mostly flat', icon: <Activity size={14} className="text-orange-400" />, category: 'Trigonometric' },
   { id: 2, name: 'Beat Interference', description: 'Pulsing detuned pattern', icon: <Spline size={14} className="text-purple-400" />, category: 'Trigonometric' },
   { id: 3, name: 'Soft Clip', description: 'Trapezoidal flat-top wave', icon: <TrendingDown size={14} className="text-teal-400" />, category: 'Trigonometric' },
   { id: 4, name: 'Chirp Sweep', description: 'Frequency-modulated wave', icon: <Sigma size={14} className="text-pink-400" />, category: 'Trigonometric' },
   // Wave Shapes
   { id: 5, name: 'Pulse Train', description: 'Narrow bursts, long gaps', icon: <Binary size={14} className="text-green-400" />, category: 'Wave Shapes' },
   { id: 6, name: 'Square Wave', description: 'Flat plateaus, instant jumps', icon: <BarChart3 size={14} className="text-yellow-400" />, category: 'Wave Shapes' },
   { id: 7, name: 'Sawtooth', description: 'Linear ramp, sharp drops', icon: <Triangle size={14} className="text-red-400" />, category: 'Wave Shapes' },
   { id: 8, name: 'Triangle Wave', description: 'Zig-zag V-shaped peaks', icon: <Triangle size={14} className="text-sky-400" />, category: 'Wave Shapes' },
   // Physics
   { id: 9, name: 'Tremolo', description: 'Slow pulsing amplitude envelope', icon: <TrendingDown size={14} className="text-amber-400" />, category: 'Physics' },
   { id: 10, name: 'Bounce', description: 'Rectified always-positive bumps', icon: <Atom size={14} className="text-lime-400" />, category: 'Physics' },
   { id: 11, name: 'Elastic', description: 'Decaying spring ring per period', icon: <Magnet size={14} className="text-fuchsia-400" />, category: 'Physics' },
   // Mathematical
   { id: 12, name: 'Logarithmic', description: 'Compressed peaks, wide valleys', icon: <Radical size={14} className="text-indigo-400" />, category: 'Mathematical' },
   { id: 13, name: 'Square Root', description: 'Widened rounded peaks', icon: <Radical size={14} className="text-emerald-400" />, category: 'Mathematical' },
   { id: 14, name: 'Harmonic Fractal', description: 'Multi-frequency organic warp', icon: <Box size={14} className="text-rose-400" />, category: 'Mathematical' },
   { id: 15, name: 'Quantized', description: 'Retro staircase stepped levels', icon: <Grid3X3 size={14} className="text-violet-400" />, category: 'Mathematical' },
];

export interface FilterPreset {
   id: FilterMode;
   name: string;
   description: string;
   icon: React.ReactNode;
   category: string;
}

export const FILTER_PRESETS: FilterPreset[] = [
   { id: 'directional', name: 'Directional Surge', description: 'Ocean wave rolling at custom angle', icon: <Waves size={18} className="text-cyan-400" />, category: 'Directional' },
   { id: 'diagonal_wipe', name: 'Wave Front Wipe', description: 'Diagonal wave revealing next frame', icon: <Wind size={18} className="text-blue-400" />, category: 'Directional' },
   { id: 'wave', name: 'Liquid Ripple', description: 'Organic sine-cosine fluid distortion', icon: <Droplet size={18} className="text-teal-400" />, category: 'Organic' },
   { id: 'vortex', name: 'Vortex Swirl', description: 'Spiral twirl & circular whirlpool', icon: <RotateCw size={18} className="text-indigo-400" />, category: 'Organic' },
   { id: 'noise', name: 'Water Noise', description: 'Multi-layered FBM fluid noise', icon: <Droplets size={18} className="text-sky-400" />, category: 'Organic' },
   { id: 'glitch', name: 'Cyber Glitch', description: 'Digital chromatic displacement shift', icon: <Zap size={18} className="text-amber-400" />, category: 'FX' },
   { id: 'radial', name: 'Heat Haze', description: 'Radial expanding heat pulse wave', icon: <Flame size={18} className="text-rose-400" />, category: 'FX' },
];

export const ASPECT_PRESETS: { id: AspectRatioMode; label: string; ratio: number | null }[] = [
   { id: 'auto', label: 'Auto (Original)', ratio: null },
   { id: '1:1', label: '1:1 Square', ratio: 1.0 },
   { id: '16:9', label: '16:9 Widescreen', ratio: 16 / 9 },
   { id: '9:16', label: '9:16 Story/Reel', ratio: 9 / 16 },
   { id: '4:3', label: '4:3 Standard', ratio: 4 / 3 },
   { id: '3:4', label: '3:4 Portrait', ratio: 3 / 4 },
];

import { ArrowDownRight, ArrowDownLeft, ArrowUpLeft, ArrowUpRight, ArrowRight, ArrowDown } from 'lucide-react';

export const QUICK_ANGLES = [
   { label: 'TL → BR', angle: 45, arrow: <ArrowDownRight size={14} /> },
   { label: 'TR → BL', angle: 135, arrow: <ArrowDownLeft size={14} /> },
   { label: 'BR → TL', angle: 225, arrow: <ArrowUpLeft size={14} /> },
   { label: 'BL → TR', angle: 315, arrow: <ArrowUpRight size={14} /> },
   { label: 'Left → Right', angle: 0, arrow: <ArrowRight size={14} /> },
   { label: 'Top → Bottom', angle: 90, arrow: <ArrowDown size={14} /> },
];

/**
 * GLSL Shaders for WebGL Wave & Multi-Filter Displacement with Aspect-Ratio & Black-Screen Safeguards
 */
export const VERTEX_SHADER = `
varying vec2 vUv;
void main() {
   vUv = uv;
   gl_Position = vec4(position, 1.0);
}
`;

export const FRAGMENT_SHADER = `
uniform float uTime;
uniform float uWaveSpeed;
uniform float uWaveFrequency;
uniform float uWaveAmplitude;
uniform float uWaveAngle;             // Direction angle in radians (0 to 2PI)
uniform float uTransitionProgress;   // 0.0 = Texture1, 1.0 = Texture2
uniform int uFilterMode;              // 0: Directional Surge, 1: Ocean Wave Wipe, 2: Liquid Wave, 3: Vortex, 4: Noise, 5: Glitch, 6: Radial
uniform int uDisplacementFunc;        // 0-15: mathematical function for displacement
uniform sampler2D uMaskTexture1;
uniform bool uHasMask1;
uniform sampler2D uMaskTexture2;
uniform bool uHasMask2;
uniform bool uIsMaskMode;
uniform sampler2D uTexture1;
uniform sampler2D uTexture2;
uniform bool uHasTexture1;
uniform bool uHasTexture2;
uniform vec2 uResolution;
uniform vec2 uImageRes1;
uniform vec2 uImageRes2;

// Text Compositing Uniforms
uniform sampler2D uTextTextureDisplaced;
uniform bool uHasTextDisplaced;
uniform sampler2D uTextTextureOverlay;
uniform bool uHasTextOverlay;

// Per-Image Customization Uniforms
uniform float uScale1;
uniform float uScale2;
uniform float uDispIntensity1;
uniform float uDispIntensity2;
uniform float uRotation1;
uniform float uRotation2;
uniform vec2 uFlip1;
uniform vec2 uFlip2;
uniform vec2 uTranslate1;
uniform vec2 uTranslate2;
uniform int uFilterMode1;
uniform int uFilterMode2;
uniform vec4 uColorSettings1; // x: brightness, y: contrast, z: exposure, w: hue
uniform float uSepia1;
uniform vec4 uColorSettings2;
uniform float uSepia2;

varying vec2 vUv;

// Color Correction Functions
vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
vec3 applyColorFilters(vec3 color, vec4 settings, float sepiaIntensity) {
    // 1. Exposure
    color = color * settings.z;
    // 2. Brightness & Contrast
    color = (color - 0.5) * settings.y + 0.5 + (settings.x - 1.0);
    // 3. Hue
    if (settings.w != 0.0) {
        vec3 hsv = rgb2hsv(color);
        hsv.x += settings.w / 360.0;
        hsv.x = fract(hsv.x);
        color = hsv2rgb(hsv);
    }
    // 4. Sepia
    if (sepiaIntensity > 0.0) {
        vec3 sepiaColor;
        sepiaColor.r = dot(color, vec3(0.393, 0.769, 0.189));
        sepiaColor.g = dot(color, vec3(0.349, 0.686, 0.168));
        sepiaColor.b = dot(color, vec3(0.272, 0.534, 0.131));
        color = mix(color, sepiaColor, sepiaIntensity);
    }
    return clamp(color, 0.0, 1.0);
}

// Comprehensive Displacement Function Evaluator
// Computes rich, distinct mathematical & physical wave patterns
vec2 evaluateDisplacement(vec2 uv, vec2 dir, vec2 perp, float proj, float perpProj, float t, float freq, float amp, int func) {
    vec2 shift = vec2(0.0);
    float p = proj * freq * 14.0 - t * 2.0;
    float pp = perpProj * freq * 8.0 + t * 0.8;

    // 0: Sin / Cos (Classic Ocean Wave)
    if (func == 0) {
        float w1 = sin(p) * 0.08;
        float w2 = cos(pp) * 0.035;
        shift = dir * w1 + perp * w2;
    }
    // 1: Tangent (Needle Spikes & Asymptotes)
    else if (func == 1) {
        float phase = mod(p, 3.14159) - 1.5708;
        float tanVal = clamp(tan(phase * 0.94), -4.0, 4.0);
        float w1 = tanVal * 0.035;
        float w2 = sin(pp * 2.0) * 0.025;
        shift = dir * w1 + perp * w2;
    }
    // 2: Beat Interference (Dual-Frequency Nodes & Moiré)
    else if (func == 2) {
        float w1 = sin(p) * sin(p * 1.37 + t * 1.2) * 0.12;
        float w2 = cos(pp * 1.5 - t * 0.6) * sin(p * 0.7) * 0.06;
        shift = dir * w1 + perp * w2;
    }
    // 3: Soft Clip / S-Curve (Trapezoidal Shelf Plateaus)
    else if (func == 3) {
        float s = sin(p);
        float w1 = clamp(s * 4.0, -1.0, 1.0) * 0.085;
        float w2 = sign(cos(pp)) * pow(abs(cos(pp)), 0.3) * 0.04;
        shift = dir * w1 + perp * w2;
    }
    // 4: Chirp Sweep (Accelerating Doppler Wavefronts)
    else if (func == 4) {
        float normalizedPos = proj + 0.6;
        float chirpP = normalizedPos * normalizedPos * freq * 24.0 - t * 2.8;
        float w1 = sin(chirpP) * 0.09;
        float w2 = cos(pp * 0.6) * 0.03;
        shift = dir * w1 + perp * w2;
    }
    // 5: Pulse Train (Digital Scanline Bursts)
    else if (func == 5) {
        float phase = fract((proj * freq * 10.0 - t * 1.5) / 6.2832);
        float pulse = (phase < 0.22) ? 1.0 : -0.25;
        float w1 = pulse * 0.085;
        float w2 = (fract(perpProj * freq * 6.0 + t) > 0.5 ? 0.03 : -0.03);
        shift = dir * w1 + perp * w2;
    }
    // 6: Square Wave / Signum (Hard Binary Tectonic Slices)
    else if (func == 6) {
        float w1 = sign(sin(p)) * 0.07;
        float w2 = sign(cos(pp)) * 0.04;
        shift = dir * w1 + perp * w2;
    }
    // 7: Sawtooth (Linear Shearing Shredder with Snapback)
    else if (func == 7) {
        float w1 = (fract(p / 6.2832) - 0.5) * 0.13;
        float w2 = (fract(pp / 6.2832) - 0.5) * 0.045;
        shift = dir * w1 + perp * w2;
    }
    // 8: Triangle Wave (Origami Accordion Prism Chevrons)
    else if (func == 8) {
        float w1 = (abs(fract(p / 6.2832) * 2.0 - 1.0) * 2.0 - 1.0) * 0.09;
        float w2 = (abs(fract(pp / 6.2832) * 2.0 - 1.0) * 2.0 - 1.0) * 0.04;
        shift = dir * w1 + perp * w2;
    }
    // 9: Tremolo / Pulsar (Rhythmic Breathing Pump)
    else if (func == 9) {
        float envelope = pow(sin(t * 1.8) * 0.5 + 0.5, 2.2);
        float w1 = sin(p) * (0.015 + envelope * 0.14);
        float w2 = cos(pp) * envelope * 0.06;
        shift = dir * w1 + perp * w2;
    }
    // 10: Bounce (Gravitational Floor Impacts)
    else if (func == 10) {
        float bounceVal = abs(sin(p * 0.8));
        float w1 = (bounceVal * 1.6 - 0.8) * 0.09;
        float squash = sin(p * 1.6) * 0.045;
        shift = dir * w1 + perp * squash;
    }
    // 11: Elastic (High-Frequency Ringing Spring Shudder)
    else if (func == 11) {
        float env = 1.0 - fract(p / 6.2832);
        float ring = sin(p * 4.0) * env * env;
        float w1 = ring * 0.11;
        float w2 = sin(pp * 5.0) * env * 0.04;
        shift = dir * w1 + perp * w2;
    }
    // 12: Logarithmic (Perspective Tunnel Suction)
    else if (func == 12) {
        float s = sin(p);
        float logCurv = sign(s) * log(1.0 + abs(s) * 15.0) / log(16.0);
        float radial = log(length(uv - vec2(0.5)) * 5.0 + 1.0);
        float w1 = logCurv * 0.09;
        float w2 = sin(radial * 14.0 - t * 2.0) * 0.045;
        shift = dir * w1 + (uv - vec2(0.5)) * w2;
    }
    // 13: Square Root (Parabolic Gravitational Lens Bulges)
    else if (func == 13) {
        float s = sin(p);
        float rootCurve = sign(s) * sqrt(abs(s));
        float lens = pow(clamp(1.0 - length(uv - vec2(0.5)) * 1.5, 0.0, 1.0), 2.0);
        float w1 = rootCurve * 0.09;
        float w2 = sin(pp * 1.5) * (0.02 + lens * 0.08);
        shift = dir * w1 + perp * w2;
    }
    // 14: Harmonic Fractal (Turbulent Chaos Moiré)
    else if (func == 14) {
        float h1 = sin(p);
        float h2 = sin(p * 2.1 + pp * 1.6 + t);
        float h3 = sin(p * 3.8 - pp * 2.2 - t * 1.4);
        float w1 = (h1 + h2 * 0.6 + h3 * 0.35) * 0.07;
        float w2 = (h2 - h3 * 0.5) * 0.045;
        shift = dir * w1 + perp * w2;
    }
    // 15: Quantized (Retro 8-Bit Matrix Voxel Staircase)
    else if (func == 15) {
        float raw1 = sin(p);
        float raw2 = cos(pp);
        float steps = 5.0;
        float w1 = (floor(raw1 * steps + 0.5) / steps) * 0.09;
        float w2 = (floor(raw2 * steps + 0.5) / steps) * 0.045;
        shift = dir * w1 + perp * w2;
    }

    return shift * amp;
}

// 1D Scalar function evaluator for secondary filters
float evaluateScalarFunc(float x, int func) {
    if (func == 0) return sin(x);
    if (func == 1) {
        float phase = mod(x, 3.14159) - 1.5708;
        return clamp(tan(phase * 0.94) * 0.6, -1.0, 1.0);
    }
    if (func == 2) return sin(x) * sin(x * 1.37);
    if (func == 3) return clamp(sin(x) * 3.5, -1.0, 1.0);
    if (func == 4) {
        float phase = x + sin(x * 0.4) * 3.0;
        return sin(phase);
    }
    if (func == 5) {
        float phase = fract(x / 6.2832);
        return (phase < 0.25) ? 1.0 : -0.3;
    }
    if (func == 6) return sign(sin(x));
    if (func == 7) return fract(x / 6.2832) * 2.0 - 1.0;
    if (func == 8) return abs(fract(x / 6.2832) * 2.0 - 1.0) * 2.0 - 1.0;
    if (func == 9) return sin(x) * (pow(sin(x * 0.15) * 0.5 + 0.5, 2.0) * 1.5);
    if (func == 10) return abs(sin(x * 1.2)) * 2.0 - 1.0;
    if (func == 11) {
        float env = 1.0 - fract(x / 6.2832);
        return sin(x * 4.0) * env * env * 1.5;
    }
    if (func == 12) {
        float s = sin(x);
        return sign(s) * log(1.0 + abs(s) * 15.0) / log(16.0);
    }
    if (func == 13) {
        float s = sin(x);
        return sign(s) * sqrt(abs(s));
    }
    if (func == 14) return sin(x + sin(x * 2.1) * 1.2);
    if (func == 15) return floor(sin(x) * 5.0 + 0.5) / 5.0;
    return sin(x);
}

// Simple 2D Pseudo Random / Noise Helper
float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

// 2D Value Noise
float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = rand(i);
    float b = rand(i + vec2(1.0, 0.0));
    float c = rand(i + vec2(0.0, 1.0));
    float d = rand(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// Multi-octave FBM Noise
float fbm(vec2 st) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 3; i++) {
        value += amplitude * noise(st);
        st *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

// Object-Fit COVER calculation for aspect ratio matching
vec2 getCoverUv(vec2 uv, vec2 canvasRes, vec2 imageRes) {
    if (imageRes.x <= 0.0 || imageRes.y <= 0.0 || canvasRes.x <= 0.0 || canvasRes.y <= 0.0) return uv;
    float canvasAspect = canvasRes.x / canvasRes.y;
    float imageAspect = imageRes.x / imageRes.y;
    vec2 scale = vec2(1.0);
    if (canvasAspect > imageAspect) {
        scale = vec2(1.0, imageAspect / canvasAspect);
    } else {
        scale = vec2(canvasAspect / imageAspect, 1.0);
    }
    return (uv - 0.5) * scale + 0.5;
}

// Transform UV coordinates (Rotation and Flip)
vec2 applyTransform(vec2 uv, float rotation, vec2 flip) {
    vec2 center = vec2(0.5, 0.5);
    uv -= center;
    uv *= flip; // flip = vec2(-1.0, 1.0)
    float s = sin(rotation);
    float c = cos(rotation);
    uv = vec2(
        uv.x * c - uv.y * s,
        uv.x * s + uv.y * c
    );
    uv += center;
    return uv;
}

// Fallback Gradient when no image is loaded
vec4 getProceduralGradient(vec2 uv, float t) {
    vec3 c1 = vec3(0.08, 0.12, 0.25) + 0.25 * vec3(sin(uv.x * 4.0 + t), cos(uv.y * 4.0 + t), sin(t));
    vec3 c2 = vec3(0.45, 0.15, 0.55) + 0.25 * vec3(cos(uv.y * 5.0 - t), sin(uv.x * 5.0 + t), cos(t));
    return vec4(mix(c1, c2, uv.y + 0.2 * sin(uv.x * 6.0 + t)), 1.0);
}

// Extract Independent Displacement Vector per Filter Mode
vec2 getDisplacement(vec2 uv, int filterMode, float t, float waveAmplitude, float waveFrequency, float waveAngle) {
    vec2 dir = vec2(cos(waveAngle), sin(waveAngle));
    vec2 perp = vec2(-dir.y, dir.x);
    int df = uDisplacementFunc;

    float proj = dot(uv - vec2(0.5), dir);
    float perpProj = dot(uv - vec2(0.5), perp);

    // Filter Mode 0: Directional Surge (Full Rich Vector Evaluation)
    if (filterMode == 0) {
        return evaluateDisplacement(uv, dir, perp, proj, perpProj, t, waveFrequency, waveAmplitude, df);
    }
    // Filter Mode 1: Diagonal Wave Front Wipe
    else if (filterMode == 1) {
        vec2 d = evaluateDisplacement(uv, dir, perp, proj, perpProj, t, waveFrequency * 1.3, waveAmplitude * 1.2, df);
        return d;
    }
    // Filter Mode 2: Liquid Ripple
    else if (filterMode == 2) {
        float waveX = evaluateScalarFunc(uv.y * waveFrequency * 12.0 + t * 1.2, df) * evaluateScalarFunc(uv.x * waveFrequency * 9.0 + t * 0.8 + 1.57, df) * waveAmplitude * 0.06;
        float waveY = evaluateScalarFunc(uv.x * waveFrequency * 14.0 - t * 1.4 + 1.57, df) * evaluateScalarFunc(uv.y * waveFrequency * 10.0 + t * 0.6, df) * waveAmplitude * 0.06;
        return vec2(waveX, waveY);
    } 
    // Filter Mode 3: Vortex Swirl
    else if (filterMode == 3) {
        vec2 center = vec2(0.5, 0.5);
        vec2 delta = uv - center;
        float len = length(delta);
        float angle = atan(delta.y, delta.x);
        float waveVal = evaluateScalarFunc(len * waveFrequency * 18.0 - t * 2.5, df);
        float twirl = waveVal * waveAmplitude * 2.5 * exp(-len * 3.0);
        angle += twirl;
        return (center + vec2(cos(angle), sin(angle)) * len) - uv;
    }
    // Filter Mode 4: Water Noise
    else if (filterMode == 4) {
        vec2 nUv = uv * waveFrequency * 5.0 + vec2(t * 0.5, t * 0.3);
        float n1 = fbm(nUv);
        float n2 = fbm(nUv + vec2(5.2, 1.3));
        float m1 = evaluateScalarFunc(n1 * 6.2832, df) * 0.5;
        float m2 = evaluateScalarFunc(n2 * 6.2832 + 1.57, df) * 0.5;
        return vec2(m1, m2) * waveAmplitude * 0.08;
    }
    // Filter Mode 5: Cyber Glitch
    else if (filterMode == 5) {
        float strip = floor(uv.y * waveFrequency * 16.0);
        float noiseVal = rand(vec2(strip, floor(t * 8.0)));
        float rawShift = (noiseVal > 0.55) ? (rand(vec2(strip, t)) - 0.5) : 0.0;
        float shift = evaluateScalarFunc(rawShift * 6.2832 + proj * 10.0, df) * waveAmplitude * 0.09;
        return vec2(shift, 0.0);
    }
    // Filter Mode 6: Heat Haze (Radial)
    else if (filterMode == 6) {
        vec2 center = vec2(0.5, 0.5);
        float dist = length(uv - center);
        float pulse = evaluateScalarFunc(dist * waveFrequency * 22.0 - t * 2.2, df) * waveAmplitude * 0.06;
        return normalize(uv - center + vec2(0.0001)) * pulse;
    }
    
    return vec2(0.0);
}

void main() {
    vec2 uv = vUv;
    float t = uTime * uWaveSpeed;

    float overrideBlend = -1.0;

    // Check Global Filter Mode for Cross-fade Specific Wipe overrides
    if (uFilterMode == 1) {
        vec2 dir = vec2(cos(uWaveAngle), sin(uWaveAngle));
        float proj = dot(uv - vec2(0.5), dir);
        float waveCrest = evaluateScalarFunc(proj * uWaveFrequency * 20.0 - t * 2.5, uDisplacementFunc) * uWaveAmplitude * 0.08;
        float progressPos = (uTransitionProgress - 0.5) * 1.5;
        float waveFront = smoothstep(progressPos - 0.15, progressPos + 0.15, proj + waveCrest * 0.6);
        overrideBlend = clamp(waveFront, 0.0, 1.0);
    }

    // Per-image masks
    float maskVal1 = 1.0;
    if (uHasMask1) {
        maskVal1 = texture2D(uMaskTexture1, uv).r;
    }
    
    float maskVal2 = 1.0;
    if (uHasMask2) {
        maskVal2 = texture2D(uMaskTexture2, uv).r;
    }

    // Apply specific intensities & strictly clamp coordinates
    vec2 shift1 = getDisplacement(uv, uFilterMode1, t, uWaveAmplitude, uWaveFrequency, uWaveAngle);
    vec2 shift2 = getDisplacement(uv, uFilterMode2, t, uWaveAmplitude, uWaveFrequency, uWaveAngle);
    
    vec2 distortedUv1 = clamp(uv + (shift1 * uDispIntensity1 * maskVal1), 0.0, 1.0);
    vec2 distortedUv2 = clamp(uv + (shift2 * uDispIntensity2 * maskVal2), 0.0, 1.0);

    // Apply Aspect-Ratio Cover, Scale & Translate UV transformation for each texture
    vec2 coverUv1 = getCoverUv(distortedUv1, uResolution, uImageRes1);
    coverUv1 = applyTransform(coverUv1, uRotation1, uFlip1);
    coverUv1 = (coverUv1 - 0.5) / uScale1 + 0.5;
    coverUv1 += uTranslate1;
    
    vec2 coverUv2 = getCoverUv(distortedUv2, uResolution, uImageRes2);
    coverUv2 = applyTransform(coverUv2, uRotation2, uFlip2);
    coverUv2 = (coverUv2 - 0.5) / uScale2 + 0.5;
    coverUv2 += uTranslate2;

    // Sample Textures
    vec4 col1 = (uHasTexture1 && uImageRes1.x > 0.0) ? texture2D(uTexture1, coverUv1) : getProceduralGradient(distortedUv1, t);
    vec4 col2 = (uHasTexture2 && uImageRes2.x > 0.0) ? texture2D(uTexture2, coverUv2) : col1;

    // Apply Dynamic Per-Image Color Filters
    if (uHasTexture1 && uImageRes1.x > 0.0) col1.rgb = applyColorFilters(col1.rgb, uColorSettings1, uSepia1);
    if (uHasTexture2 && uImageRes2.x > 0.0) col2.rgb = applyColorFilters(col2.rgb, uColorSettings2, uSepia2);

    // Smoothstep transition blending between Texture 1 and Texture 2
    float blendFactor = (overrideBlend >= 0.0) ? overrideBlend : smoothstep(0.0, 1.0, clamp(uTransitionProgress, 0.0, 1.0));
    vec4 finalColor = mix(col1, col2, blendFactor);

    // Chromatic Aberration detail during heavy glitch transition
    if (uFilterMode == 5 && uWaveAmplitude > 0.3) {
        float rShift = uWaveAmplitude * 0.015;
        float r = (uHasTexture1 && uImageRes1.x > 0.0) ? texture2D(uTexture1, clamp(coverUv1 + vec2(rShift, 0.0), 0.0, 1.0)).r : finalColor.r;
        float b = (uHasTexture1 && uImageRes1.x > 0.0) ? texture2D(uTexture1, clamp(coverUv1 - vec2(rShift, 0.0), 0.0, 1.0)).b : finalColor.b;
        finalColor = vec4(r, finalColor.g, b, finalColor.a);
    }

    // Mask Overlay Visualizer (shows mask for the first texture since we edit masks when focused on one image)
    if (uIsMaskMode) {
        float overlay = (1.0 - maskVal1) * 0.4; // 40% red tint on masked-out areas
        finalColor.rgb = mix(finalColor.rgb, vec3(1.0, 0.0, 0.0), overlay);
    }

    // Text Compositing
    if (uHasTextDisplaced) {
        vec2 textDisplacedUv = clamp(uv + mix(shift1 * uDispIntensity1, shift2 * uDispIntensity2, blendFactor), 0.0, 1.0);
        vec4 textDispColor = texture2D(uTextTextureDisplaced, textDisplacedUv);
        finalColor.rgb = mix(finalColor.rgb, textDispColor.rgb, textDispColor.a);
    }
    
    if (uHasTextOverlay) {
        vec4 textOverlayColor = texture2D(uTextTextureOverlay, uv);
        finalColor.rgb = mix(finalColor.rgb, textOverlayColor.rgb, textOverlayColor.a);
    }

    gl_FragColor = finalColor;
}
`

