/**
 * Word art: layered fills, outlines and glows applied to a normal text object.
 *
 * Everything here is expressed in **em** rather than pixels. A 4px outline reads as a bold cartoon
 * edge on 24px type and as a hairline on 120px type, so a library written in pixels only looks
 * right at the one size it was designed at. Storing fractions of the font size and resolving them
 * at apply time means a style looks like itself at any size.
 *
 * Pure data plus pure resolvers - no fabric, no React - so the whole library can be checked
 * off-browser and the same definitions drive both the canvas and the CSS thumbnails.
 */

export interface GradientSpec {
  type: 'linear' | 'radial';
  /** Only for linear: the direction the ramp runs. */
  direction?: 'vertical' | 'horizontal' | 'diagonal';
  stops: { offset: number; color: string }[];
}

export interface ShadowSpec {
  color: string;
  /** All three are fractions of the font size. */
  blurEm: number;
  offsetXEm: number;
  offsetYEm: number;
}

export interface WordArtStyle {
  id: string;
  name: string;
  category: string;
  /** Suggested typeface. Applied unless the caller chooses to keep the current font. */
  fontFamily: string;
  fontWeight: string;
  fill: string | GradientSpec;
  stroke: string | null;
  /** Outline width as a fraction of the font size. */
  strokeEm: number;
  /** Stroke behind the fill keeps letterforms crisp; over it thickens them deliberately. */
  paintFirst: 'fill' | 'stroke';
  shadow: ShadowSpec | null;
  /** Fabric's charSpacing is already 1/1000 em, so it needs no scaling. */
  charSpacing: number;
  skewX: number;
  /** Two or three glyphs for the picker tile. */
  sample: string;
}

/** Resolved for one font size: every length in real pixels, ready for fabric. */
export interface ResolvedWordArt {
  fontFamily: string;
  fontWeight: string;
  fill: string | GradientSpec;
  stroke: string | null;
  strokeWidth: number;
  strokeLineJoin: 'round';
  paintFirst: 'fill' | 'stroke';
  shadow: { color: string; blur: number; offsetX: number; offsetY: number } | null;
  charSpacing: number;
  skewX: number;
}

const OM = 'ॐ';

export const WORD_ART_STYLES: WordArtStyle[] = [
  // ---------------------------------------------------------------- Vedic / Puranic
  {
    id: 'golden-shloka', name: 'Golden Shloka', category: 'Vedic', sample: OM,
    fontFamily: 'Tiro Devanagari Hindi', fontWeight: '400',
    fill: { type: 'linear', direction: 'vertical', stops: [
      { offset: 0, color: '#FFF3C4' }, { offset: 0.45, color: '#FFC14D' },
      { offset: 0.75, color: '#C77800' }, { offset: 1, color: '#7A4A00' }] },
    stroke: '#4E2600', strokeEm: 0.035, paintFirst: 'stroke',
    shadow: { color: 'rgba(255,164,28,0.55)', blurEm: 0.28, offsetXEm: 0, offsetYEm: 0.04 },
    charSpacing: 20, skewX: 0
  },
  {
    id: 'temple-stone', name: 'Temple Stone', category: 'Vedic', sample: OM,
    fontFamily: 'Martel', fontWeight: '700',
    fill: { type: 'linear', direction: 'vertical', stops: [
      { offset: 0, color: '#E8DCCB' }, { offset: 0.55, color: '#B29B7E' }, { offset: 1, color: '#7A6449' }] },
    stroke: '#5A452F', strokeEm: 0.02, paintFirst: 'stroke',
    // Down-right and dark: reads as carved into the surface rather than floating above it.
    shadow: { color: 'rgba(46,32,18,0.6)', blurEm: 0.03, offsetXEm: 0.035, offsetYEm: 0.045 },
    charSpacing: 40, skewX: 0
  },
  {
    id: 'palm-leaf', name: 'Palm Leaf', category: 'Vedic', sample: OM,
    fontFamily: 'Kadwa', fontWeight: '400',
    fill: '#4A2C14',
    stroke: '#B98A44', strokeEm: 0.012, paintFirst: 'stroke',
    shadow: { color: 'rgba(190,150,90,0.5)', blurEm: 0.12, offsetXEm: 0, offsetYEm: 0 },
    charSpacing: 30, skewX: 0
  },
  {
    id: 'vermilion-chant', name: 'Vermilion Chant', category: 'Vedic', sample: OM,
    fontFamily: 'Rozha One', fontWeight: '400',
    fill: { type: 'linear', direction: 'vertical', stops: [
      { offset: 0, color: '#FF6B4A' }, { offset: 0.6, color: '#D62828' }, { offset: 1, color: '#8B1414' }] },
    stroke: '#FFCF6B', strokeEm: 0.022, paintFirst: 'stroke',
    shadow: { color: 'rgba(214,40,40,0.5)', blurEm: 0.22, offsetXEm: 0, offsetYEm: 0.03 },
    charSpacing: 15, skewX: 0
  },
  {
    id: 'divine-aura', name: 'Divine Aura', category: 'Vedic', sample: OM,
    fontFamily: 'Yatra One', fontWeight: '400',
    fill: { type: 'radial', stops: [
      { offset: 0, color: '#FFFDF2' }, { offset: 0.55, color: '#FFD98A' }, { offset: 1, color: '#E9962B' }] },
    stroke: null, strokeEm: 0, paintFirst: 'fill',
    shadow: { color: 'rgba(255,153,51,0.75)', blurEm: 0.45, offsetXEm: 0, offsetYEm: 0 },
    charSpacing: 25, skewX: 0
  },
  {
    id: 'copper-plate', name: 'Copper Plate', category: 'Vedic', sample: OM,
    fontFamily: 'Rhodium Libre', fontWeight: '400',
    fill: { type: 'linear', direction: 'diagonal', stops: [
      { offset: 0, color: '#F3B58C' }, { offset: 0.4, color: '#B5651D' },
      { offset: 0.7, color: '#7B3F00' }, { offset: 1, color: '#C98A4A' }] },
    stroke: '#4A2609', strokeEm: 0.025, paintFirst: 'stroke',
    shadow: { color: 'rgba(30,15,5,0.55)', blurEm: 0.05, offsetXEm: 0.02, offsetYEm: 0.035 },
    charSpacing: 35, skewX: 0
  },

  // ---------------------------------------------------------------- Modern
  {
    id: 'clean-gradient', name: 'Clean Gradient', category: 'Modern', sample: 'Aa',
    fontFamily: 'Inter', fontWeight: '700',
    fill: { type: 'linear', direction: 'diagonal', stops: [
      { offset: 0, color: '#4F46E5' }, { offset: 1, color: '#06B6D4' }] },
    stroke: null, strokeEm: 0, paintFirst: 'fill',
    shadow: { color: 'rgba(15,23,42,0.25)', blurEm: 0.12, offsetXEm: 0, offsetYEm: 0.04 },
    charSpacing: -10, skewX: 0
  },
  {
    id: 'hollow', name: 'Hollow', category: 'Modern', sample: 'Aa',
    fontFamily: 'Montserrat', fontWeight: '700',
    fill: 'transparent',
    stroke: '#111827', strokeEm: 0.03, paintFirst: 'fill',
    shadow: null, charSpacing: 60, skewX: 0
  },
  {
    id: 'soft-emboss', name: 'Soft Emboss', category: 'Modern', sample: 'Aa',
    fontFamily: 'Poppins', fontWeight: '600',
    fill: { type: 'linear', direction: 'vertical', stops: [
      { offset: 0, color: '#F8FAFC' }, { offset: 1, color: '#94A3B8' }] },
    stroke: '#64748B', strokeEm: 0.008, paintFirst: 'stroke',
    shadow: { color: 'rgba(15,23,42,0.35)', blurEm: 0.04, offsetXEm: 0.012, offsetYEm: 0.02 },
    charSpacing: 0, skewX: 0
  },
  {
    id: 'ink-fade', name: 'Ink Fade', category: 'Modern', sample: 'Aa',
    fontFamily: 'Raleway', fontWeight: '700',
    fill: { type: 'linear', direction: 'vertical', stops: [
      { offset: 0, color: '#111827' }, { offset: 1, color: '#9CA3AF' }] },
    stroke: null, strokeEm: 0, paintFirst: 'fill',
    shadow: null, charSpacing: 40, skewX: 0
  },

  // ---------------------------------------------------------------- Neon
  {
    id: 'neon-cyan', name: 'Neon Cyan', category: 'Neon', sample: 'Aa',
    fontFamily: 'Rajdhani', fontWeight: '700',
    fill: '#E0FBFF',
    stroke: '#22D3EE', strokeEm: 0.02, paintFirst: 'fill',
    shadow: { color: 'rgba(34,211,238,0.95)', blurEm: 0.42, offsetXEm: 0, offsetYEm: 0 },
    charSpacing: 60, skewX: 0
  },
  {
    id: 'neon-pink', name: 'Neon Pink', category: 'Neon', sample: 'Aa',
    fontFamily: 'Rajdhani', fontWeight: '700',
    fill: '#FFE9F6',
    stroke: '#EC4899', strokeEm: 0.02, paintFirst: 'fill',
    shadow: { color: 'rgba(236,72,153,0.95)', blurEm: 0.42, offsetXEm: 0, offsetYEm: 0 },
    charSpacing: 60, skewX: 0
  },
  {
    id: 'neon-lime', name: 'Neon Lime', category: 'Neon', sample: 'Aa',
    fontFamily: 'Teko', fontWeight: '700',
    fill: '#F2FFE0',
    stroke: '#84CC16', strokeEm: 0.022, paintFirst: 'fill',
    shadow: { color: 'rgba(132,204,22,0.95)', blurEm: 0.4, offsetXEm: 0, offsetYEm: 0 },
    charSpacing: 50, skewX: 0
  },
  {
    id: 'neon-tube', name: 'Neon Tube', category: 'Neon', sample: 'Aa',
    fontFamily: 'Rajdhani', fontWeight: '700',
    // Hollow, so the glow reads as a glass tube rather than a lit solid.
    fill: 'transparent',
    stroke: '#A855F7', strokeEm: 0.028, paintFirst: 'fill',
    shadow: { color: 'rgba(168,85,247,0.9)', blurEm: 0.38, offsetXEm: 0, offsetYEm: 0 },
    charSpacing: 80, skewX: 0
  },

  // ---------------------------------------------------------------- Display
  {
    id: 'fire', name: 'Fire', category: 'Display', sample: 'Aa',
    fontFamily: 'Anton', fontWeight: '400',
    fill: { type: 'linear', direction: 'vertical', stops: [
      { offset: 0, color: '#FFF3B0' }, { offset: 0.4, color: '#FDBA23' },
      { offset: 0.75, color: '#F03B20' }, { offset: 1, color: '#8C1A0B' }] },
    stroke: '#5A1005', strokeEm: 0.02, paintFirst: 'stroke',
    shadow: { color: 'rgba(240,80,20,0.7)', blurEm: 0.3, offsetXEm: 0, offsetYEm: -0.03 },
    charSpacing: 20, skewX: 0
  },
  {
    id: 'ice', name: 'Ice', category: 'Display', sample: 'Aa',
    fontFamily: 'Anton', fontWeight: '400',
    fill: { type: 'linear', direction: 'vertical', stops: [
      { offset: 0, color: '#FFFFFF' }, { offset: 0.5, color: '#CFF2FF' }, { offset: 1, color: '#5BA7D9' }] },
    stroke: '#1E5F8C', strokeEm: 0.022, paintFirst: 'stroke',
    shadow: { color: 'rgba(91,167,217,0.75)', blurEm: 0.26, offsetXEm: 0, offsetYEm: 0.03 },
    charSpacing: 20, skewX: 0
  },
  {
    id: 'comic-pop', name: 'Comic Pop', category: 'Display', sample: 'Aa',
    fontFamily: 'Bangers', fontWeight: '400',
    fill: '#FFD400',
    stroke: '#111827', strokeEm: 0.06, paintFirst: 'stroke',
    shadow: { color: 'rgba(17,24,39,1)', blurEm: 0, offsetXEm: 0.05, offsetYEm: 0.05 },
    charSpacing: 30, skewX: -6
  },
  {
    id: 'retro-sunset', name: 'Retro Sunset', category: 'Display', sample: 'Aa',
    fontFamily: 'Oswald', fontWeight: '700',
    fill: { type: 'linear', direction: 'vertical', stops: [
      { offset: 0, color: '#FDE68A' }, { offset: 0.5, color: '#FB7185' }, { offset: 1, color: '#7C3AED' }] },
    stroke: '#2E1065', strokeEm: 0.018, paintFirst: 'stroke',
    shadow: { color: 'rgba(124,58,237,0.6)', blurEm: 0.02, offsetXEm: 0.06, offsetYEm: 0.06 },
    charSpacing: 10, skewX: 0
  }
];

export const WORD_ART_CATEGORIES = ['Vedic', 'Modern', 'Neon', 'Display'];

/** Turns a style's em-based geometry into pixels for one font size. */
export const resolveWordArt = (style: WordArtStyle, fontSize: number): ResolvedWordArt => {
  const size = fontSize > 0 ? fontSize : 40;
  const round2 = (n: number) => Math.round(n * 100) / 100;

  return {
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    fill: style.fill,
    stroke: style.stroke,
    // An outline thinner than half a pixel disappears, so a style that asks for one gets one.
    strokeWidth: style.stroke ? Math.max(0.5, round2(size * style.strokeEm)) : 0,
    strokeLineJoin: 'round',
    paintFirst: style.paintFirst,
    shadow: style.shadow
      ? {
        color: style.shadow.color,
        blur: round2(size * style.shadow.blurEm),
        offsetX: round2(size * style.shadow.offsetXEm),
        offsetY: round2(size * style.shadow.offsetYEm)
      }
      : null,
    charSpacing: style.charSpacing,
    skewX: style.skewX
  };
};

/** Gradient coordinates in percentage units, so the ramp fits whatever the text turns out to be. */
export const gradientCoords = (spec: GradientSpec) => {
  if (spec.type === 'radial') {
    return { x1: 0.5, y1: 0.5, r1: 0, x2: 0.5, y2: 0.5, r2: 0.7 };
  }
  switch (spec.direction) {
    case 'horizontal': return { x1: 0, y1: 0, x2: 1, y2: 0 };
    case 'diagonal': return { x1: 0, y1: 0, x2: 1, y2: 1 };
    default: return { x1: 0, y1: 0, x2: 0, y2: 1 };
  }
};

const cssGradient = (spec: GradientSpec): string => {
  const stops = spec.stops.map(s => `${s.color} ${Math.round(s.offset * 100)}%`).join(', ');
  if (spec.type === 'radial') return `radial-gradient(circle at 50% 50%, ${stops})`;
  const angle = spec.direction === 'horizontal' ? '90deg' : spec.direction === 'diagonal' ? '135deg' : '180deg';
  return `linear-gradient(${angle}, ${stops})`;
};

/**
 * The same style as CSS, for the picker thumbnails.
 *
 * An approximation on purpose: browsers paint `-webkit-text-stroke` over the fill and cannot put it
 * behind, so a stroke-first style shows a slightly heavier edge here than on the canvas. Close
 * enough to choose by, which is all a 3cm tile has to do.
 */
export const wordArtCss = (style: WordArtStyle, previewSize = 26): Record<string, string> => {
  const resolved = resolveWordArt(style, previewSize);
  const css: Record<string, string> = {
    fontFamily: `"${style.fontFamily}", sans-serif`,
    fontWeight: style.fontWeight,
    letterSpacing: `${(style.charSpacing / 1000) * previewSize}px`
  };

  if (typeof style.fill === 'string') {
    css.color = style.fill === 'transparent' ? 'transparent' : style.fill;
  } else {
    css.backgroundImage = cssGradient(style.fill);
    css.backgroundClip = 'text';
    css.WebkitBackgroundClip = 'text';
    css.color = 'transparent';
  }

  if (style.stroke && resolved.strokeWidth > 0) {
    // Halved: the canvas centres its stroke on the outline, CSS paints it inward from the edge.
    css.WebkitTextStroke = `${Math.max(0.5, resolved.strokeWidth / 2)}px ${style.stroke}`;
  }

  if (resolved.shadow) {
    const { offsetX, offsetY, blur, color } = resolved.shadow;
    css.filter = `drop-shadow(${offsetX}px ${offsetY}px ${Math.max(blur / 2, 0)}px ${color})`;
  }

  if (style.skewX) css.transform = `skewX(${style.skewX}deg)`;

  return css;
};
