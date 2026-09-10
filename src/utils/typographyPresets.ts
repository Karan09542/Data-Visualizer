/**
 * The typography preset library.
 *
 * Kept as plain data in its own module so the set can be validated off-browser - every family
 * checked against the font registry, every preset checked for a complete property list - instead
 * of the problems only showing up when someone applies one.
 */

export interface Preset {
  name: string;
  /** One line on what it is for, shown as the row's tooltip. */
  hint: string;
  props: {
    fontFamily: string;
    fontWeight: string | number;
    fontStyle: string;
    fontSize: number;
    fill: string;
    textAlign: string;
    charSpacing: number;
    lineHeight: number;
    /**
     * Every preset states all of these, including the "off" values.
     *
     * A preset used to list only what it wanted, so applying one after another layered them: pick
     * YouTube Thumbnail then Poster Title and the poster kept the thumbnail's 8px black outline.
     * Spelling out the whole look makes applying a preset a replacement rather than an addition.
     */
    stroke: string | null;
    strokeWidth: number;
    shadow: { color: string; blur: number; offsetX: number; offsetY: number } | null;
    underline: boolean;
    overline: boolean;
    linethrough: boolean;
  };
}

/** The neutral end of every preset, so each one only has to say what makes it different. */
const BASE = {
  fontWeight: '400',
  fontStyle: 'normal',
  textAlign: 'center',
  charSpacing: 0,
  lineHeight: 1.3,
  stroke: null,
  strokeWidth: 0,
  shadow: null,
  underline: false,
  overline: false,
  linethrough: false
} as const;

/**
 * Every fontFamily here is one the app's own font registry knows about, so a preset can always be
 * re-picked from the font dropdown afterwards. Impact and Fira Code were used before and are in
 * neither the registry nor, in Impact's case, reliably on the machine.
 */
export const TYPOGRAPHY_PRESETS: Record<string, Preset[]> = {
  "Social Media": [
    {
      name: "Instagram Quote",
      hint: "Elegant centred serif for a quote card",
      // Was white with no outline, which is invisible on the default white artboard.
      props: { ...BASE, fontFamily: "Playfair Display", fontStyle: "italic", fontSize: 44, fill: "#1F2937", charSpacing: 20, lineHeight: 1.5 }
    },
    {
      name: "YouTube Thumbnail",
      hint: "Heavy outlined caps that survive any background",
      props: { ...BASE, fontFamily: "Anton", fontSize: 96, fill: "#FFFFFF", charSpacing: 30, lineHeight: 1.05, stroke: "#000000", strokeWidth: 8, shadow: { color: "rgba(0,0,0,0.75)", blur: 18, offsetX: 0, offsetY: 10 } }
    },
    {
      name: "Meme Text",
      hint: "Classic top/bottom meme caption",
      props: { ...BASE, fontFamily: "Lilita One", fontSize: 64, fill: "#FFFFFF", charSpacing: 10, lineHeight: 1.15, stroke: "#000000", strokeWidth: 5 }
    },
    {
      name: "Poster Title",
      hint: "Tight, punchy headline in hot pink",
      props: { ...BASE, fontFamily: "Montserrat", fontWeight: "900", fontSize: 80, fill: "#FF3366", textAlign: "left", charSpacing: -20, lineHeight: 1.0 }
    },
    {
      name: "Story Caption",
      hint: "Soft-shadowed caption for photo stories",
      props: { ...BASE, fontFamily: "Poppins", fontWeight: "600", fontSize: 34, fill: "#FFFFFF", charSpacing: 15, lineHeight: 1.4, shadow: { color: "rgba(0,0,0,0.55)", blur: 12, offsetX: 0, offsetY: 4 } }
    },
    {
      name: "Handle / Tagline",
      hint: "Small, widely spaced line under a title",
      props: { ...BASE, fontFamily: "Inter", fontWeight: "500", fontSize: 22, fill: "#6B7280", charSpacing: 120, lineHeight: 1.4 }
    }
  ],

  "Sacred / Bhakti": [
    {
      name: "Bhagavad Gita",
      hint: "Saffron Devanagari with a warm glow",
      props: { ...BASE, fontFamily: "Tiro Devanagari Hindi", fontSize: 50, fill: "#FF9933", charSpacing: 10, lineHeight: 1.5, shadow: { color: "rgba(255, 153, 51, 0.4)", blur: 15, offsetX: 0, offsetY: 0 } }
    },
    {
      name: "Sanskrit Verse",
      hint: "Cream verse type for dark backgrounds",
      // Cream on a white artboard was unreadable; the shadow keeps the look and gives it an edge.
      props: { ...BASE, fontFamily: "Martel", fontWeight: "700", fontSize: 44, fill: "#FFFFCC", charSpacing: 0, lineHeight: 1.6, shadow: { color: "rgba(0,0,0,0.45)", blur: 10, offsetX: 0, offsetY: 2 } }
    },
    {
      name: "Ramayan",
      hint: "Bold devotional display in vermilion",
      props: { ...BASE, fontFamily: "Yatra One", fontSize: 60, fill: "#FF4D4D", charSpacing: 20, lineHeight: 1.2 }
    },
    {
      name: "Mantra Glow",
      hint: "Golden chant type with a lamp-like glow",
      props: { ...BASE, fontFamily: "Rozha One", fontSize: 64, fill: "#FFB703", charSpacing: 20, lineHeight: 1.3, shadow: { color: "rgba(255,140,0,0.55)", blur: 22, offsetX: 0, offsetY: 0 } }
    },
    {
      name: "Temple Banner",
      hint: "Deep maroon banner lettering",
      props: { ...BASE, fontFamily: "Martel", fontWeight: "700", fontSize: 52, fill: "#7B1E1E", charSpacing: 30, lineHeight: 1.35, shadow: { color: "rgba(0,0,0,0.25)", blur: 6, offsetX: 0, offsetY: 3 } }
    }
  ],

  "Editorial": [
    {
      name: "Magazine Cover",
      hint: "Huge condensed masthead",
      props: { ...BASE, fontFamily: "Oswald", fontWeight: "700", fontSize: 110, fill: "#111827", charSpacing: -30, lineHeight: 0.95 }
    },
    {
      name: "Pull Quote",
      hint: "Italic serif for a highlighted excerpt",
      props: { ...BASE, fontFamily: "Lora", fontStyle: "italic", fontSize: 40, fill: "#4B5563", charSpacing: 5, lineHeight: 1.6 }
    },
    {
      name: "Section Header",
      hint: "Classical spaced capitals",
      props: { ...BASE, fontFamily: "Cinzel", fontWeight: "700", fontSize: 46, fill: "#1F2937", charSpacing: 60, lineHeight: 1.3 }
    },
    {
      name: "Byline",
      hint: "Muted credit line under a headline",
      props: { ...BASE, fontFamily: "Inter", fontWeight: "600", fontSize: 16, fill: "#9CA3AF", charSpacing: 140, lineHeight: 1.5 }
    }
  ],

  "Professional": [
    {
      name: "Presentation Title",
      hint: "Slide headline, tightly tracked",
      props: { ...BASE, fontFamily: "Inter", fontWeight: "700", fontSize: 72, fill: "#111827", textAlign: "left", charSpacing: -20, lineHeight: 1.1 }
    },
    {
      name: "Blog Heading",
      hint: "Sturdy serif article heading",
      props: { ...BASE, fontFamily: "Merriweather", fontWeight: "900", fontSize: 56, fill: "#333333", textAlign: "left", lineHeight: 1.3 }
    },
    {
      name: "Tech Heading",
      hint: "Squared technical heading in blue",
      props: { ...BASE, fontFamily: "Rajdhani", fontWeight: "700", fontSize: 40, fill: "#0F62FE", textAlign: "left", charSpacing: 20, lineHeight: 1.4 }
    },
    {
      name: "Body Copy",
      hint: "Comfortable paragraph settings",
      props: { ...BASE, fontFamily: "Inter", fontSize: 20, fill: "#374151", textAlign: "left", lineHeight: 1.7 }
    },
    {
      name: "Caption",
      hint: "Small note under an image or figure",
      props: { ...BASE, fontFamily: "Inter", fontSize: 14, fill: "#6B7280", textAlign: "left", charSpacing: 20, lineHeight: 1.5 }
    }
  ],

  "Playful": [
    {
      name: "Sticker Pop",
      hint: "Chunky outlined sticker lettering",
      props: { ...BASE, fontFamily: "Baloo 2", fontWeight: "800", fontSize: 60, fill: "#FFFFFF", charSpacing: 5, lineHeight: 1.2, stroke: "#111827", strokeWidth: 6 }
    },
    {
      name: "Comic Punch",
      hint: "Comic-book shout in amber",
      props: { ...BASE, fontFamily: "Bangers", fontSize: 72, fill: "#F59E0B", charSpacing: 20, lineHeight: 1.1, stroke: "#111827", strokeWidth: 4 }
    },
    {
      name: "Handwritten",
      hint: "Friendly script in pink",
      props: { ...BASE, fontFamily: "Pacifico", fontSize: 48, fill: "#DB2777", lineHeight: 1.4 }
    },
    {
      name: "Marker Note",
      hint: "Scrawled marker annotation",
      props: { ...BASE, fontFamily: "Permanent Marker", fontSize: 40, fill: "#111827", textAlign: "left", lineHeight: 1.35 }
    }
  ]
};
