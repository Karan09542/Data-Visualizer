// TODO(Refactor): Move to src/components/image-workspace/types/artboards.ts
export interface Artboard {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  backgroundColor: string;
  borderColor?: string;
  transparent: boolean;
  dpi: number;
  orientation: "portrait" | "landscape";
  showGrid?: boolean;
  showSafeArea?: boolean;
  showMargins?: boolean;
  showBleed?: boolean;
  showCenter?: boolean;
}


export const ARTBOARD_PRESETS = [{ name: '1080x1080', width: 1080, height: 1080 }, { name: '1920x1080', width: 1920, height: 1080 }, { name: '1080x1920', width: 1080, height: 1920 }, { name: 'A4', width: 2480, height: 3508 }];