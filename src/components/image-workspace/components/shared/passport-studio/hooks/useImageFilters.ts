import { useCallback, useMemo, useState } from 'react';

/** Brightness / contrast / saturation / grayscale / sepia adjustments plus named presets. */
export function useImageFilters() {
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [saturation, setSaturation] = useState<number>(100);
  const [grayscale, setGrayscale] = useState<number>(0);
  const [sepia, setSepia] = useState<number>(0);
  const [activePreset, setActivePreset] = useState<string>('normal');

  const filterCss = useMemo(() => {
    return `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) grayscale(${grayscale}%) sepia(${sepia}%)`;
  }, [brightness, contrast, saturation, grayscale, sepia]);

  const resetFilters = useCallback(() => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setGrayscale(0);
    setSepia(0);
    setActivePreset('normal');
  }, []);

  const applyPreset = useCallback((preset: string) => {
    setActivePreset(preset);
    switch (preset) {
      case 'passport_warm':
        setBrightness(104); setContrast(106); setSaturation(110); setGrayscale(0); setSepia(8);
        break;
      case 'studio_cool':
        setBrightness(102); setContrast(108); setSaturation(95); setGrayscale(0); setSepia(0);
        break;
      case 'b_and_w':
        setBrightness(102); setContrast(118); setSaturation(0); setGrayscale(100); setSepia(0);
        break;
      case 'vivid_sharp':
        setBrightness(106); setContrast(115); setSaturation(125); setGrayscale(0); setSepia(0);
        break;
      case 'normal':
      default:
        setBrightness(100); setContrast(100); setSaturation(100); setGrayscale(0); setSepia(0);
        break;
    }
  }, []);

  /** Manual slider edits move the preset to 'custom'. */
  const setters = {
    brightness: (v: number) => { setBrightness(v); setActivePreset('custom'); },
    contrast: (v: number) => { setContrast(v); setActivePreset('custom'); },
    saturation: (v: number) => { setSaturation(v); setActivePreset('custom'); },
    grayscale: (v: number) => { setGrayscale(v); setActivePreset('custom'); },
    sepia: (v: number) => { setSepia(v); setActivePreset('custom'); },
  };

  return {
    values: { brightness, contrast, saturation, grayscale, sepia },
    setters, activePreset, filterCss, resetFilters, applyPreset,
  };
}

export type ImageFiltersState = ReturnType<typeof useImageFilters>;
