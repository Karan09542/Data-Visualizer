import type { PhotoUnit } from '../types';

// DPI conversion: pixels = (mm / 25.4) * dpi
export const MM_TO_PX = (mm: number, dpi: number = 300) => Math.round((mm / 25.4) * dpi);

export const MM_TO_UNIT = (mm: number, unit: PhotoUnit, dpi: number = 300): number => {
  switch (unit) {
    case 'cm': return Math.round((mm / 10) * 100) / 100;
    case 'inch': return Math.round((mm / 25.4) * 100) / 100;
    case 'px': return Math.round((mm / 25.4) * dpi);
    case 'mm':
    default: return Math.round(mm * 10) / 10;
  }
};

export const UNIT_TO_MM = (val: number, unit: PhotoUnit, dpi: number = 300): number => {
  if (isNaN(val) || val <= 0) return 1;
  switch (unit) {
    case 'cm': return val * 10;
    case 'inch': return val * 25.4;
    case 'px': return (val / dpi) * 25.4;
    case 'mm':
    default: return val;
  }
};
