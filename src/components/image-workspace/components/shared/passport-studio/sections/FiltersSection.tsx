import React from 'react';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { FILTER_PRESETS } from '../constants';
import type { ImageFiltersState } from '../hooks/useImageFilters';
import { Button, Chip, ChipRow, SettingsCard, Slider } from '../ui/primitives';

const SLIDERS = [
  { key: 'brightness', label: 'Brightness', min: 50, max: 150 },
  { key: 'contrast', label: 'Contrast', min: 50, max: 150 },
  { key: 'saturation', label: 'Saturation', min: 0, max: 200 },
  { key: 'grayscale', label: 'Grayscale', min: 0, max: 100 },
  { key: 'sepia', label: 'Sepia tone', min: 0, max: 100 },
] as const;

export const FiltersSection: React.FC<{ filters: ImageFiltersState }> = ({ filters }) => (
  <SettingsCard
    icon={<SlidersHorizontal size={15} />}
    title="Color & tone"
    description="Applied to every photo on the sheet"
    aside={
      <Button variant="ghost" size="sm" onClick={filters.resetFilters} title="Reset All Filters" icon={<RotateCcw size={12} />}>
        Reset
      </Button>
    }
  >
    <ChipRow>
      {FILTER_PRESETS.map(preset => (
        <Chip
          key={preset.id}
          active={filters.activePreset === preset.id}
          onClick={() => filters.applyPreset(preset.id)}
        >
          {preset.label}
        </Chip>
      ))}
    </ChipRow>

    <div className="space-y-3.5 pt-0.5">
      {SLIDERS.map(s => (
        <Slider
          key={s.key}
          label={s.label}
          min={s.min}
          max={s.max}
          value={filters.values[s.key]}
          display={`${filters.values[s.key]}%`}
          onChange={filters.setters[s.key]}
        />
      ))}
    </div>
  </SettingsCard>
);
