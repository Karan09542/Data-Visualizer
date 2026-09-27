export type PhotoQueueItem = {
  id: string;
  src: string;
  originalSrc?: string;
  quantity: number;
};

export type PhotoUnit = 'mm' | 'cm' | 'inch' | 'px';

/** cover = crop to fill, contain = fit inside with letterbox, fill = stretch */
export type ImageFitMode = 'cover' | 'contain' | 'fill';

/** 9-point anchor grid, maps to CSS background-position */
export type ImagePosition =
  | 'top left' | 'top center' | 'top right'
  | 'center left' | 'center center' | 'center right'
  | 'bottom left' | 'bottom center' | 'bottom right';

export type Orientation = 'portrait' | 'landscape';

export type ExportFormat = 'png' | 'jpeg' | 'webp';

export type SheetLayout = {
  pWidth: number;
  pHeight: number;
  phWidth: number;
  phHeight: number;
  cols: number;
  rows: number;
  maxCapacity: number;
  activePhotoCount: number;
  actualMarginLeft: number;
  actualMarginTop: number;
};
