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
  if (typeof document === 'undefined') return;
  const linkId = `font-${fontName.replace(/\s+/g, '-')}`;
  if (document.getElementById(linkId)) return;
  
  const link = document.createElement('link');
  link.id = linkId;
  link.href = `https://fonts.googleapis.com/css?family=${fontName.replace(/\s+/g, '+')}:300,400,400i,500,600,700,700i&display=swap`;
  link.rel = 'stylesheet';
  document.head.appendChild(link);
};
