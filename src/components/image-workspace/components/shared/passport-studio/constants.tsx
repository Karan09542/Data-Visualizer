import React from 'react';
import { BadgeCheck, CreditCard, Globe, FileText, Contact, Wallet, Settings } from 'lucide-react';
import type { ExportFormat, ImageFitMode, ImagePosition, PhotoUnit } from './types';

export const PAPER_SIZES = {
  a4: { name: 'A4 (210×297 mm)', width: 210, height: 297 },
  a5: { name: 'A5 (148×210 mm)', width: 148, height: 210 },
  letter: { name: 'Letter (8.5×11")', width: 215.9, height: 279.4 },
  legal: { name: 'Legal (8.5×14")', width: 215.9, height: 355.6 },
  r4x6: { name: '4×6" Photo Paper (10×15 cm)', width: 101.6, height: 152.4 },
  r5x7: { name: '5×7" Photo Paper (13×18 cm)', width: 127, height: 177.8 },
  custom: { name: 'Custom Paper Size', width: 210, height: 297 },
};

export type PaperSizeKey = keyof typeof PAPER_SIZES;

export const DOCUMENT_PRESETS = {
  indian_passport: {
    id: 'indian_passport',
    name: 'Indian Passport',
    desc: '35×45 mm (3.5×4.5 cm)',
    widthMM: 35,
    heightMM: 45,
    icon: <BadgeCheck size={16} />
  },
  indian_aadhaar_pan: {
    id: 'indian_aadhaar_pan',
    name: 'Aadhaar / PAN / OCI',
    desc: '2×2 in (51×51 mm)',
    widthMM: 51,
    heightMM: 51,
    icon: <CreditCard size={16} />
  },
  schengen_visa: {
    id: 'schengen_visa',
    name: 'Schengen Visa',
    desc: '35×45 mm',
    widthMM: 35,
    heightMM: 45,
    icon: <Globe size={16} />
  },
  us_passport: {
    id: 'us_passport',
    name: 'US Passport & Visa',
    desc: '2×2 in (51×51 mm)',
    widthMM: 51,
    heightMM: 51,
    icon: <FileText size={16} />
  },
  uk_visa: {
    id: 'uk_visa',
    name: 'UK Visa & Passport',
    desc: '35×45 mm',
    widthMM: 35,
    heightMM: 45,
    icon: <Globe size={16} />
  },
  canada_visa: {
    id: 'canada_visa',
    name: 'Canada Visa',
    desc: '50×70 mm',
    widthMM: 50,
    heightMM: 70,
    icon: <Globe size={16} />
  },
  standard_id: {
    id: 'standard_id',
    name: 'Standard ID Card',
    desc: '30×40 mm',
    widthMM: 30,
    heightMM: 40,
    icon: <Contact size={16} />
  },
  stamp_size: {
    id: 'stamp_size',
    name: 'Stamp / Wallet Size',
    desc: '25×35 mm',
    widthMM: 25,
    heightMM: 35,
    icon: <Wallet size={16} />
  },
  custom: {
    id: 'custom',
    name: 'Custom Dimension',
    desc: 'Specify custom unit & size',
    widthMM: 35,
    heightMM: 45,
    icon: <Settings size={16} />
  }
};

export type DocPresetKey = keyof typeof DOCUMENT_PRESETS;

export const UNITS: PhotoUnit[] = ['mm', 'cm', 'inch', 'px'];

export const QUANTITY_PRESETS = [1, 2, 4, 6, 8, 12, 16];

export const SCALE_PRESETS = [
  { label: '85% Padding', val: 85 },
  { label: '100% Default', val: 100 },
  { label: '115% Tight', val: 115 },
];

export const FIT_MODES: { id: ImageFitMode; label: string; desc: string }[] = [
  { id: 'cover', label: 'Cover', desc: 'Crop to fill' },
  { id: 'contain', label: 'Contain', desc: 'Fit inside' },
  { id: 'fill', label: 'Fill', desc: 'Stretch' },
];

export const IMAGE_POSITIONS: ImagePosition[] = [
  'top left', 'top center', 'top right',
  'center left', 'center center', 'center right',
  'bottom left', 'bottom center', 'bottom right',
];

export const FILTER_PRESETS = [
  { id: 'normal', label: 'Normal' },
  { id: 'passport_warm', label: 'Warm Skin' },
  { id: 'studio_cool', label: 'Studio Cool' },
  { id: 'b_and_w', label: 'B&W Official' },
  { id: 'vivid_sharp', label: 'Vivid Sharp' },
];

export const FILE_SIZE_PRESETS = [
  { label: 'Original', kb: 0 },
  { label: '< 200 KB', kb: 200 },
  { label: '< 100 KB', kb: 100 },
  { label: '< 50 KB', kb: 50 },
  { label: '< 20 KB', kb: 20 },
];

export const DPI_PRESETS = [
  { label: '72', hint: 'Draft', dpi: 72 },
  { label: '150', hint: 'Medium', dpi: 150 },
  { label: '200', hint: 'Web', dpi: 200 },
  { label: '300', hint: 'Commercial', dpi: 300 },
  { label: '600', hint: 'Ultra HD', dpi: 600 },
];

export const EXPORT_FORMATS: { id: ExportFormat; label: string; ext: string; desc: string }[] = [
  { id: 'png', label: 'PNG Image', ext: '.png', desc: 'Lossless, highest print quality' },
  { id: 'jpeg', label: 'JPEG Image', ext: '.jpeg', desc: 'Compressed photo format' },
  { id: 'webp', label: 'WEBP Image', ext: '.webp', desc: 'Modern compact web format' },
];

export const ZOOM_MIN = 40;
export const ZOOM_MAX = 300;
