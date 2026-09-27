import { useEffect, useState } from 'react';
import type { PhotoUnit } from '../types';
import { MM_TO_UNIT, UNIT_TO_MM } from '../utils/units';

/**
 * Width/height pair kept internally in MM, with display values in the chosen unit and an optional
 * locked aspect ratio. Used for both the custom photo size and the custom paper size.
 */
export function useDimensionState(initialWMM: number, initialHMM: number) {
  const [unit, setUnit] = useState<PhotoUnit>('mm');
  const [wMM, setWMM] = useState(initialWMM);
  const [hMM, setHMM] = useState(initialHMM);
  const [displayW, setDisplayW] = useState<number>(initialWMM);
  const [displayH, setDisplayH] = useState<number>(initialHMM);
  const [lockRatio, setLockRatio] = useState(false);
  const [ratio, setRatio] = useState(initialWMM / initialHMM);

  // Sync display numeric inputs when MM or unit changes
  useEffect(() => {
    setDisplayW(MM_TO_UNIT(wMM, unit));
    setDisplayH(MM_TO_UNIT(hMM, unit));
  }, [wMM, hMM, unit]);

  const changeUnit = (newUnit: PhotoUnit) => {
    if (newUnit === unit) return;
    setUnit(newUnit);
  };

  const changeDisplayW = (newVal: number) => {
    const safeVal = Math.max(0.1, newVal);
    setDisplayW(safeVal);
    const calculatedMM = UNIT_TO_MM(safeVal, unit);
    setWMM(calculatedMM);

    if (lockRatio && ratio) {
      const targetHMM = calculatedMM / ratio;
      setHMM(targetHMM);
      setDisplayH(MM_TO_UNIT(targetHMM, unit));
    }
  };

  const changeDisplayH = (newVal: number) => {
    const safeVal = Math.max(0.1, newVal);
    setDisplayH(safeVal);
    const calculatedMM = UNIT_TO_MM(safeVal, unit);
    setHMM(calculatedMM);

    if (lockRatio && ratio) {
      const targetWMM = calculatedMM * ratio;
      setWMM(targetWMM);
      setDisplayW(MM_TO_UNIT(targetWMM, unit));
    }
  };

  const toggleLock = () => {
    if (!lockRatio) setRatio(wMM / (hMM || 1));
    setLockRatio(!lockRatio);
  };

  /** Adopt a preset size (and its ratio) */
  const applyPreset = (widthMM: number, heightMM: number) => {
    setWMM(widthMM);
    setHMM(heightMM);
    setRatio(widthMM / heightMM);
  };

  return {
    unit, wMM, hMM, displayW, displayH, lockRatio,
    changeUnit, changeDisplayW, changeDisplayH, toggleLock, applyPreset,
  };
}

export type DimensionState = ReturnType<typeof useDimensionState>;
