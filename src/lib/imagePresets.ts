import { Crop, FileText, Image as ImageIcon, Instagram, Linkedin, MonitorPlay, Palette, Printer, ShoppingBag, Smartphone, Twitter, Youtube } from "lucide-react";

export type PresetCategory = "document" | "social" | "ecommerce" | "print" | "screens" | "frames" | "collage" | "quick";

export interface ImagePreset {
  id: string;
  name: string;
  category: PresetCategory;
  width: number;
  height: number;
  unit: "px" | "mm" | "in";
  dpi: number;
  description?: string;
  icon?: any;
  safeAreas?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  exportRecommendation?: {
    format: "image/png" | "image/jpeg" | "image/webp";
    quality: number;
    message: string;
  };
}

export const PRESET_REGISTRY: ImagePreset[] = [
  // ---- Screen & Editing Sizes ----
  { id: "screen_1080p", name: "Full HD (1920x1080)", category: "screens", width: 1920, height: 1080, unit: "px", dpi: 72 },
  { id: "screen_4k", name: "4K Ultra HD (3840x2160)", category: "screens", width: 3840, height: 2160, unit: "px", dpi: 72 },
  { id: "screen_2k", name: "2K QHD (2560x1440)", category: "screens", width: 2560, height: 1440, unit: "px", dpi: 72 },
  { id: "screen_720p", name: "HD 720p (1280x720)", category: "screens", width: 1280, height: 720, unit: "px", dpi: 72 },
  { id: "screen_mobile", name: "Mobile Screen (390x844)", category: "screens", width: 390, height: 844, unit: "px", dpi: 72 },
  { id: "screen_tablet", name: "Tablet Screen (820x1180)", category: "screens", width: 820, height: 1180, unit: "px", dpi: 72 },
  { id: "screen_square_hd", name: "Square HD (1080x1080)", category: "screens", width: 1080, height: 1080, unit: "px", dpi: 72 },

  // ---- Document & ID Photo Studio ----
  { id: "doc_in_passport", name: "India Passport", category: "document", width: 35, height: 45, unit: "mm", dpi: 300, exportRecommendation: { format: "image/jpeg", quality: 90, message: "Use high quality JPEG for printing." } },
  { id: "doc_us_passport", name: "US Passport", category: "document", width: 2, height: 2, unit: "in", dpi: 300, exportRecommendation: { format: "image/jpeg", quality: 90, message: "Use high quality JPEG for printing. Must be 2x2 inches." } },
  { id: "doc_uk_passport", name: "UK Passport", category: "document", width: 35, height: 45, unit: "mm", dpi: 300 },
  { id: "doc_eu_passport", name: "EU Passport", category: "document", width: 35, height: 45, unit: "mm", dpi: 300 },
  { id: "doc_ca_passport", name: "Canada Passport", category: "document", width: 50, height: 70, unit: "mm", dpi: 300 },
  { id: "doc_au_passport", name: "Australia Passport", category: "document", width: 35, height: 45, unit: "mm", dpi: 300 },
  
  { id: "doc_schengen_visa", name: "Schengen Visa", category: "document", width: 35, height: 45, unit: "mm", dpi: 300 },
  { id: "doc_us_visa", name: "US Visa", category: "document", width: 2, height: 2, unit: "in", dpi: 300 },
  { id: "doc_uk_visa", name: "UK Visa", category: "document", width: 35, height: 45, unit: "mm", dpi: 300 },
  { id: "doc_ca_visa", name: "Canada Visa", category: "document", width: 35, height: 45, unit: "mm", dpi: 300 },

  { id: "doc_aadhaar", name: "Aadhaar / PAN Card", category: "document", width: 25, height: 35, unit: "mm", dpi: 300 },
  
  // ---- Social Media Studio ----
  { id: "soc_ig_post", name: "Instagram Square Post", category: "social", width: 1080, height: 1080, unit: "px", dpi: 72, exportRecommendation: { format: "image/jpeg", quality: 85, message: "Ideal balance for Instagram feeds." } },
  { id: "soc_ig_portrait", name: "Instagram Portrait Post", category: "social", width: 1080, height: 1350, unit: "px", dpi: 72 },
  { id: "soc_ig_story", name: "Instagram Story / Reel", category: "social", width: 1080, height: 1920, unit: "px", dpi: 72 },
  
  { id: "soc_yt_thumbnail", name: "YouTube Thumbnail", category: "social", width: 1280, height: 720, unit: "px", dpi: 72, exportRecommendation: { format: "image/jpeg", quality: 85, message: "Must be under 2MB." } },
  { id: "soc_yt_banner", name: "YouTube Channel Banner", category: "social", width: 2560, height: 1440, unit: "px", dpi: 72, safeAreas: { top: 508, bottom: 508, left: 507, right: 507 } },
  
  { id: "soc_li_post", name: "LinkedIn Post", category: "social", width: 1200, height: 627, unit: "px", dpi: 72 },
  { id: "soc_li_cover", name: "LinkedIn Cover", category: "social", width: 1584, height: 396, unit: "px", dpi: 72 },

  { id: "soc_fb_post", name: "Facebook Post", category: "social", width: 1200, height: 630, unit: "px", dpi: 72 },
  { id: "soc_fb_cover", name: "Facebook Cover", category: "social", width: 820, height: 312, unit: "px", dpi: 72 },
  
  { id: "soc_x_post", name: "X (Twitter) Post", category: "social", width: 1200, height: 675, unit: "px", dpi: 72 },
  { id: "soc_x_header", name: "X Header", category: "social", width: 1500, height: 500, unit: "px", dpi: 72 },

  // ---- E-Commerce ----
  { id: "ecom_amazon_main", name: "Amazon Main Image", category: "ecommerce", width: 2000, height: 2000, unit: "px", dpi: 72, exportRecommendation: { format: "image/jpeg", quality: 90, message: "Amazon requires high-res images for zoom to work." } },
  { id: "ecom_shopify_square", name: "Shopify Square", category: "ecommerce", width: 2048, height: 2048, unit: "px", dpi: 72, exportRecommendation: { format: "image/webp", quality: 80, message: "Use WebP for fast store loading." } },
  { id: "ecom_etsy_thumb", name: "Etsy Thumbnail", category: "ecommerce", width: 2000, height: 2000, unit: "px", dpi: 72 },

  // ---- Print Sizes ----
  { id: "print_4x6", name: "4x6 Photo", category: "print", width: 4, height: 6, unit: "in", dpi: 300 },
  { id: "print_5x7", name: "5x7 Photo", category: "print", width: 5, height: 7, unit: "in", dpi: 300 },
  { id: "print_8x10", name: "8x10 Photo", category: "print", width: 8, height: 10, unit: "in", dpi: 300 },
  { id: "print_a4", name: "A4 Document", category: "print", width: 210, height: 297, unit: "mm", dpi: 300, exportRecommendation: { format: "image/jpeg", quality: 100, message: "High-resolution output for print." } },
  { id: "print_a3", name: "A3 Poster", category: "print", width: 297, height: 420, unit: "mm", dpi: 300 },
  { id: "print_letter", name: "US Letter", category: "print", width: 8.5, height: 11, unit: "in", dpi: 300 },
];

export const getDimensionsInPixels = (preset: ImagePreset): { width: number; height: number } => {
  if (preset.unit === "px") return { width: preset.width, height: preset.height };
  if (preset.unit === "in") return { width: Math.round(preset.width * preset.dpi), height: Math.round(preset.height * preset.dpi) };
  if (preset.unit === "mm") return { width: Math.round((preset.width / 25.4) * preset.dpi), height: Math.round((preset.height / 25.4) * preset.dpi) };
  return { width: 800, height: 600 };
};
