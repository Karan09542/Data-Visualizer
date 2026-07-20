
export type ExportFormat = 'png' | 'jpeg' | 'webp' | 'avif' | 'jxl';

export type ResizeMethod = 'lanczos3' | 'lanczos2' | 'triangle' | 'catmullRom' | 'mitchell' | 'nearest';

export interface MozJpegOptions {
  quality: number;
  baseline: boolean;
  arithmetic: boolean;
  progressive: boolean;
  optimize_coding: boolean;
  smoothing: number;
  trellis_multipass: boolean;
  trellis_opt_zero: boolean;
  trellis_opt_table: boolean;
  trellis_loops: number;
  auto_subsample: boolean;
  chroma_subsample: number;
  separate_chroma_quality: boolean;
  chroma_quality: number;
}

export interface WebpOptions {
  quality: number;
  target_size: number;
  target_PSNR: number;
  method: number;
  sns_strength: number;
  filter_strength: number;
  filter_sharpness: number;
  filter_type: number;
  partitions: number;
  segments: number;
  pass: number;
  show_compressed: number;
  preprocessing: number;
  autofilter: number;
  partition_limit: number;
  alpha_compression: number;
  alpha_filtering: number;
  alpha_quality: number;
  lossless: number;
  exact: number;
  image_hint: number;
  emulate_jpeg_size: number;
  thread_level: number;
  low_memory: number;
  near_lossless: number;
  use_delta_palette: number;
  use_sharp_yuv: number;
}

export interface AvifOptions {
  cqLevel: number;
  cqAlphaLevel: number;
  denoiseLevel: number;
  tileRowsLog2: number;
  tileColsLog2: number;
  speed: number;
  subsample: number;
  chromaDeltaQ: boolean;
  sharpness: number;
  tune: number;
}

export interface PngOptions {
  level: number;
  interlace: boolean;
  paletteReduction: boolean;
  paletteColors: number;
  ditherLevel: number;
}

export interface JxlOptions {
  effort: number;
  quality: number;
  progressive: boolean;
  lossless: boolean;
}

export interface ExportSettings {
  format: ExportFormat;
  askForFilename?: boolean;
  resize: {
    enabled: boolean;
    width: number;
    height: number;
    maintainAspectRatio: boolean;
    method: ResizeMethod;
    premul: boolean;
    linearRGB: boolean;
  };
  mozjpeg: MozJpegOptions;
  webp: WebpOptions;
  avif: AvifOptions;
  png: PngOptions;
  jxl: JxlOptions;
}

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: 'webp',
  askForFilename: false,
  resize: {
    enabled: false,
    width: 800,
    height: 600,
    maintainAspectRatio: true,
    method: 'lanczos3',
    premul: true,
    linearRGB: true,
  },
  mozjpeg: {
    quality: 75,
    baseline: false,
    arithmetic: false,
    progressive: true,
    optimize_coding: true,
    smoothing: 0,
    trellis_multipass: false,
    trellis_opt_zero: false,
    trellis_opt_table: false,
    trellis_loops: 1,
    auto_subsample: true,
    chroma_subsample: 2,
    separate_chroma_quality: false,
    chroma_quality: 75,
  },
  webp: {
    quality: 75,
    target_size: 0,
    target_PSNR: 0,
    method: 4,
    sns_strength: 50,
    filter_strength: 60,
    filter_sharpness: 0,
    filter_type: 1,
    partitions: 0,
    segments: 4,
    pass: 1,
    show_compressed: 0,
    preprocessing: 0,
    autofilter: 0,
    partition_limit: 0,
    alpha_compression: 1,
    alpha_filtering: 1,
    alpha_quality: 100,
    lossless: 0,
    exact: 0,
    image_hint: 0,
    emulate_jpeg_size: 0,
    thread_level: 0,
    low_memory: 0,
    near_lossless: 100,
    use_delta_palette: 0,
    use_sharp_yuv: 0,
  },
  avif: {
    cqLevel: 33,
    cqAlphaLevel: -1,
    denoiseLevel: 0,
    tileRowsLog2: 0,
    tileColsLog2: 0,
    speed: 6,
    subsample: 1,
    chromaDeltaQ: false,
    sharpness: 0,
    tune: 0,
  },
  png: {
    level: 2,
    interlace: false,
    paletteReduction: false,
    paletteColors: 256,
    ditherLevel: 1.0,
  },
  jxl: {
    effort: 7,
    quality: 75,
    progressive: false,
    lossless: false,
  },
};
