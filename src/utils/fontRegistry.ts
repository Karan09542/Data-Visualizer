export type FontCategory = "Modern Sans Serif" | "Elegant Serif" | "Creative & Display";

export interface FontNode {
  id: string;
  fontFamily: string;
  category: FontCategory;
  supportsHindi: boolean;
  supportsEnglish: boolean;
  previewText?: string;
  googleFontName: string;
}

export const FONTS: FontNode[] = [
  // Modern Sans Serif - Dual Script
  { id: "poppins", fontFamily: "Poppins", category: "Modern Sans Serif", supportsHindi: true, supportsEnglish: true, googleFontName: "Poppins" },
  { id: "hind", fontFamily: "Hind", category: "Modern Sans Serif", supportsHindi: true, supportsEnglish: true, googleFontName: "Hind" },
  { id: "inter", fontFamily: "Inter", category: "Modern Sans Serif", supportsHindi: true, supportsEnglish: true, googleFontName: "Inter" },
  { id: "yantramanav", fontFamily: "Yantramanav", category: "Modern Sans Serif", supportsHindi: true, supportsEnglish: true, googleFontName: "Yantramanav" },
  { id: "rajdhani", fontFamily: "Rajdhani", category: "Modern Sans Serif", supportsHindi: true, supportsEnglish: true, googleFontName: "Rajdhani" },
  { id: "khand", fontFamily: "Khand", category: "Modern Sans Serif", supportsHindi: true, supportsEnglish: true, googleFontName: "Khand" },
  { id: "teko", fontFamily: "Teko", category: "Modern Sans Serif", supportsHindi: true, supportsEnglish: true, googleFontName: "Teko" },
  { id: "mukta", fontFamily: "Mukta", category: "Modern Sans Serif", supportsHindi: true, supportsEnglish: true, googleFontName: "Mukta" },
  { id: "jaldi", fontFamily: "Jaldi", category: "Modern Sans Serif", supportsHindi: true, supportsEnglish: true, googleFontName: "Jaldi" },
  { id: "biryani", fontFamily: "Biryani", category: "Modern Sans Serif", supportsHindi: true, supportsEnglish: true, googleFontName: "Biryani" },

  // Modern Sans Serif - English
  { id: "montserrat", fontFamily: "Montserrat", category: "Modern Sans Serif", supportsHindi: false, supportsEnglish: true, googleFontName: "Montserrat" },
  { id: "oswald", fontFamily: "Oswald", category: "Modern Sans Serif", supportsHindi: false, supportsEnglish: true, googleFontName: "Oswald" },
  { id: "opensans", fontFamily: "Open Sans", category: "Modern Sans Serif", supportsHindi: false, supportsEnglish: true, googleFontName: "Open Sans" },
  { id: "lato", fontFamily: "Lato", category: "Modern Sans Serif", supportsHindi: false, supportsEnglish: true, googleFontName: "Lato" },
  { id: "raleway", fontFamily: "Raleway", category: "Modern Sans Serif", supportsHindi: false, supportsEnglish: true, googleFontName: "Raleway" },
  { id: "bebasneue", fontFamily: "Bebas Neue", category: "Modern Sans Serif", supportsHindi: false, supportsEnglish: true, googleFontName: "Bebas Neue" },
  { id: "rubik", fontFamily: "Rubik", category: "Modern Sans Serif", supportsHindi: false, supportsEnglish: true, googleFontName: "Rubik" },
  { id: "anton", fontFamily: "Anton", category: "Modern Sans Serif", supportsHindi: false, supportsEnglish: true, googleFontName: "Anton" },
  { id: "nunito", fontFamily: "Nunito", category: "Modern Sans Serif", supportsHindi: false, supportsEnglish: true, googleFontName: "Nunito" },
  { id: "arimo", fontFamily: "Arimo", category: "Modern Sans Serif", supportsHindi: false, supportsEnglish: true, googleFontName: "Arimo" },

  // Elegant Serif - Dual Script
  { id: "tirodevanagari", fontFamily: "Tiro Devanagari Hindi", category: "Elegant Serif", supportsHindi: true, supportsEnglish: true, googleFontName: "Tiro Devanagari Hindi" },
  { id: "rozhaone", fontFamily: "Rozha One", category: "Elegant Serif", supportsHindi: true, supportsEnglish: true, googleFontName: "Rozha One" },
  { id: "martel", fontFamily: "Martel", category: "Elegant Serif", supportsHindi: true, supportsEnglish: true, googleFontName: "Martel" },
  { id: "kadwa", fontFamily: "Kadwa", category: "Elegant Serif", supportsHindi: true, supportsEnglish: true, googleFontName: "Kadwa" },
  { id: "rhodiumlibre", fontFamily: "Rhodium Libre", category: "Elegant Serif", supportsHindi: true, supportsEnglish: true, googleFontName: "Rhodium Libre" },
  { id: "sahitya", fontFamily: "Sahitya", category: "Elegant Serif", supportsHindi: true, supportsEnglish: true, googleFontName: "Sahitya" },
  { id: "kurale", fontFamily: "Kurale", category: "Elegant Serif", supportsHindi: true, supportsEnglish: true, googleFontName: "Kurale" },
  { id: "modak", fontFamily: "Modak", category: "Elegant Serif", supportsHindi: true, supportsEnglish: true, googleFontName: "Modak" },

  // Elegant Serif - English
  { id: "playfair", fontFamily: "Playfair Display", category: "Elegant Serif", supportsHindi: false, supportsEnglish: true, googleFontName: "Playfair Display" },
  { id: "merriweather", fontFamily: "Merriweather", category: "Elegant Serif", supportsHindi: false, supportsEnglish: true, googleFontName: "Merriweather" },
  { id: "lora", fontFamily: "Lora", category: "Elegant Serif", supportsHindi: false, supportsEnglish: true, googleFontName: "Lora" },
  { id: "cinzel", fontFamily: "Cinzel", category: "Elegant Serif", supportsHindi: false, supportsEnglish: true, googleFontName: "Cinzel" },
  { id: "prata", fontFamily: "Prata", category: "Elegant Serif", supportsHindi: false, supportsEnglish: true, googleFontName: "Prata" },
  { id: "ptserif", fontFamily: "PT Serif", category: "Elegant Serif", supportsHindi: false, supportsEnglish: true, googleFontName: "PT Serif" },
  { id: "bodonimoda", fontFamily: "Bodoni Moda", category: "Elegant Serif", supportsHindi: false, supportsEnglish: true, googleFontName: "Bodoni Moda" },

  // Creative & Display - Dual Script
  { id: "baloo2", fontFamily: "Baloo 2", category: "Creative & Display", supportsHindi: true, supportsEnglish: true, googleFontName: "Baloo 2" },
  { id: "amita", fontFamily: "Amita", category: "Creative & Display", supportsHindi: true, supportsEnglish: true, googleFontName: "Amita" },
  { id: "yatraone", fontFamily: "Yatra One", category: "Creative & Display", supportsHindi: true, supportsEnglish: true, googleFontName: "Yatra One" },
  { id: "gotu", fontFamily: "Gotu", category: "Creative & Display", supportsHindi: true, supportsEnglish: true, googleFontName: "Gotu" },
  { id: "girish", fontFamily: "Girish", category: "Creative & Display", supportsHindi: true, supportsEnglish: true, googleFontName: "Girish" },
  { id: "palanquin", fontFamily: "Palanquin", category: "Creative & Display", supportsHindi: true, supportsEnglish: true, googleFontName: "Palanquin" },
  { id: "chanakya", fontFamily: "Chanakya", category: "Creative & Display", supportsHindi: true, supportsEnglish: true, googleFontName: "Chanakya" },
  { id: "karma", fontFamily: "Karma", category: "Creative & Display", supportsHindi: true, supportsEnglish: true, googleFontName: "Karma" },

  // Creative & Display - English
  { id: "fredoka", fontFamily: "Fredoka", category: "Creative & Display", supportsHindi: false, supportsEnglish: true, googleFontName: "Fredoka" },
  { id: "lilitaone", fontFamily: "Lilita One", category: "Creative & Display", supportsHindi: false, supportsEnglish: true, googleFontName: "Lilita One" },
  { id: "pacifico", fontFamily: "Pacifico", category: "Creative & Display", supportsHindi: false, supportsEnglish: true, googleFontName: "Pacifico" },
  { id: "lobster", fontFamily: "Lobster", category: "Creative & Display", supportsHindi: false, supportsEnglish: true, googleFontName: "Lobster" },
  { id: "satisfy", fontFamily: "Satisfy", category: "Creative & Display", supportsHindi: false, supportsEnglish: true, googleFontName: "Satisfy" },
  { id: "bangers", fontFamily: "Bangers", category: "Creative & Display", supportsHindi: false, supportsEnglish: true, googleFontName: "Bangers" },
  { id: "permanentmarker", fontFamily: "Permanent Marker", category: "Creative & Display", supportsHindi: false, supportsEnglish: true, googleFontName: "Permanent Marker" },
];

export const loadGoogleFont = (fontName: string) => {
  if (typeof document === 'undefined' || !fontName) return;
  const trimmed = fontName.trim().replace(/^["']|["']$/g, '');
  const fontNode = FONTS.find(
    f => f.fontFamily.toLowerCase() === trimmed.toLowerCase() || f.googleFontName.toLowerCase() === trimmed.toLowerCase()
  );
  const actualGoogleName = fontNode ? fontNode.googleFontName : trimmed;
  const linkId = `font-${actualGoogleName.replace(/\s+/g, '-')}`;
  if (document.getElementById(linkId)) return;
  
  const link = document.createElement('link');
  link.id = linkId;
  link.href = `https://fonts.googleapis.com/css2?family=${actualGoogleName.replace(/\s+/g, '+')}&display=swap`;
  link.rel = 'stylesheet';
  document.head.appendChild(link);
};

export const ensureFontsLoaded = (fontNames: (string | undefined | null)[]) => {
  if (typeof document === 'undefined') return;
  const unique = Array.from(new Set(fontNames.filter((f): f is string => Boolean(f && f.trim()))));
  unique.forEach(f => loadGoogleFont(f));
};

export const extractFontsFromContent = (content: string): string[] => {
  if (!content) return [];
  const families: string[] = [];
  try {
    const regex = /font-family:\s*(\\?["']?)([^,"';\\]+)(\\?["']?)/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const familyName = match[2]?.trim()?.replace(/^["'\\]+|["'\\]+$/g, '');
      if (familyName && !families.includes(familyName)) {
        families.push(familyName);
      }
    }
  } catch {
    // ignore
  }
  return families;
};

export const loadFontsFromContent = (content: string) => {
  const families = extractFontsFromContent(content);
  if (families.length > 0) {
    ensureFontsLoaded(families);
  }
};

/** Weights worth asking Google Fonts about; it simply omits the ones a family lacks. */
const WEIGHT_CANDIDATES = [100, 200, 300, 400, 500, 600, 700, 800, 900];

export interface FontVariants {
  /** Weights this family really has, ascending */
  weights: number[];
  /** Whether the family ships a true italic */
  hasItalic: boolean;
}

const DEFAULT_VARIANTS: FontVariants = { weights: [400, 700], hasItalic: true };
const variantCache = new Map<string, Promise<FontVariants>>();

/**
 * Which weights and italics a family actually provides.
 *
 * Google returns only the faces that exist, so the stylesheet it serves is the list. The
 * answer is cached per family (in memory and in localStorage) because it never changes.
 */
export const getFontVariants = (googleFontName: string): Promise<FontVariants> => {
  const cached = variantCache.get(googleFontName);
  if (cached) return cached;

  const storageKey = `font_variants_${googleFontName}`;
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored) as FontVariants;
      if (parsed?.weights?.length) {
        const ready = Promise.resolve(parsed);
        variantCache.set(googleFontName, ready);
        return ready;
      }
    }
  } catch { /* private mode or bad JSON: just ask again */ }

  const request = (async (): Promise<FontVariants> => {
    try {
      const spec = WEIGHT_CANDIDATES.flatMap((w) => [String(w), `${w}i`]).join(',');
      const url = `https://fonts.googleapis.com/css?family=${googleFontName.replace(/\s+/g, '+')}:${spec}&display=swap`;
      const css = await (await fetch(url)).text();

      const weights = new Set<number>();
      let hasItalic = false;
      // Each @font-face block states the weight and style it covers
      css.split("@font-face").forEach((block) => {
        const weight = block.match(/font-weight:\s*(\d{3})/);
        if (weight) weights.add(Number(weight[1]));
        if (/font-style:\s*italic/.test(block)) hasItalic = true;
      });

      const result: FontVariants = weights.size
        ? { weights: Array.from(weights).sort((a, b) => a - b), hasItalic }
        : DEFAULT_VARIANTS;
      try {
        localStorage.setItem(storageKey, JSON.stringify(result));
      } catch { /* storage full or blocked: memory cache still helps */ }
      return result;
    } catch {
      return DEFAULT_VARIANTS;
    }
  })();

  variantCache.set(googleFontName, request);
  return request;
};

/** Loads one specific weight/italic of a family, for text that uses it. */
export const loadGoogleFontVariant = (fontName: string, weight: number, italic: boolean) => {
  if (typeof document === 'undefined') return;
  const linkId = `font-${fontName.replace(/\s+/g, '-')}-${weight}${italic ? 'i' : ''}`;
  if (document.getElementById(linkId)) return;

  const link = document.createElement('link');
  link.id = linkId;
  link.href = `https://fonts.googleapis.com/css?family=${fontName.replace(/\s+/g, '+')}:${weight}${italic ? 'i' : ''}&display=swap`;
  link.rel = 'stylesheet';
  document.head.appendChild(link);
};
