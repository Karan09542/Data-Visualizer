import React from 'react';
import { Link2, Unlink2 } from 'lucide-react';
import { UNITS } from '../constants';
import type { DimensionState } from '../hooks/useDimensionState';
import { FieldLabel, Hint, IconButton, Inset, NumberInput, Segmented } from '../ui/primitives';

/** Custom width × height editor with unit switcher and aspect-ratio lock. */
export const DimensionEditor: React.FC<{
  title: string;
  dims: DimensionState;
  max: number;
}> = ({ title, dims, max }) => {
  const step = dims.unit === 'inch' ? '0.1' : '1';
  return (
    <Inset className="animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">{title}</span>
        <Segmented
          size="sm"
          className="w-44"
          value={dims.unit}
          onChange={dims.changeUnit}
          options={UNITS.map(u => ({ value: u, label: u }))}
        />
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1 min-w-0">
          <FieldLabel>Width</FieldLabel>
          <NumberInput
            step={step} min="0.1" max={max}
            value={dims.displayW}
            suffix={dims.unit}
            onValueChange={raw => dims.changeDisplayW(parseFloat(raw) || 0)}
          />
        </div>

        <IconButton
          onClick={dims.toggleLock}
          active={dims.lockRatio}
          title={dims.lockRatio ? 'Unlock Aspect Ratio' : 'Lock Aspect Ratio'}
        >
          {dims.lockRatio ? <Link2 size={15} /> : <Unlink2 size={15} />}
        </IconButton>

        <div className="flex-1 min-w-0">
          <FieldLabel>Height</FieldLabel>
          <NumberInput
            step={step} min="0.1" max={max}
            value={dims.displayH}
            suffix={dims.unit}
            onValueChange={raw => dims.changeDisplayH(parseFloat(raw) || 0)}
          />
        </div>
      </div>

      <Hint className="font-mono">
        = {Math.round(dims.wMM * 10) / 10} × {Math.round(dims.hMM * 10) / 10} mm
      </Hint>
    </Inset>
  );
};
