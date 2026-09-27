import React from 'react';
import { Crop, Minus, Plus } from 'lucide-react';
import { FIT_MODES, IMAGE_POSITIONS, SCALE_PRESETS } from '../constants';
import type { ImageFitMode, ImagePosition } from '../types';
import { Chip, ChipRow, FieldLabel, IconButton, Segmented, SettingsCard, Slider, ValueBadge, cx } from '../ui/primitives';

export const PhotoFitSection: React.FC<{
  photoScale: number;
  setPhotoScale: React.Dispatch<React.SetStateAction<number>>;
  imageFit: ImageFitMode;
  setImageFit: (m: ImageFitMode) => void;
  imagePosition: ImagePosition;
  setImagePosition: (p: ImagePosition) => void;
}> = ({ photoScale, setPhotoScale, imageFit, setImageFit, imagePosition, setImagePosition }) => (
  <SettingsCard
    icon={<Crop size={15} />}
    title="Framing"
    description="How the photo sits inside each frame"
    aside={<ValueBadge>{photoScale}%</ValueBadge>}
  >
    <div>
      <FieldLabel>Photo zoom</FieldLabel>
      <div className="flex items-center gap-2">
        <IconButton size="sm" onClick={() => setPhotoScale(prev => Math.max(70, prev - 5))} title="Shrink Photo Scale">
          <Minus size={14} />
        </IconButton>
        <Slider className="flex-1" min={70} max={130} value={photoScale} onChange={setPhotoScale} />
        <IconButton size="sm" onClick={() => setPhotoScale(prev => Math.min(130, prev + 5))} title="Enlarge Photo Scale">
          <Plus size={14} />
        </IconButton>
      </div>
      <ChipRow className="mt-2.5">
        {SCALE_PRESETS.map(preset => (
          <Chip key={preset.val} active={photoScale === preset.val} onClick={() => setPhotoScale(preset.val)}>
            {preset.label}
          </Chip>
        ))}
      </ChipRow>
    </div>

    <div>
      <FieldLabel>Fit mode</FieldLabel>
      <Segmented
        value={imageFit}
        onChange={setImageFit}
        options={FIT_MODES.map(m => ({ value: m.id, label: m.label, hint: m.desc }))}
      />
    </div>

    {/* Image Position Anchor Grid (visible for cover/contain) */}
    {imageFit !== 'fill' && (
      <div>
        <FieldLabel aside={<span className="text-[11px] font-mono capitalize text-slate-500 dark:text-zinc-400">{imagePosition.replace(' ', ' / ')}</span>}>
          Anchor position
        </FieldLabel>
        <div className="flex items-center gap-3">
          <div className="grid grid-cols-3 gap-1 p-1.5 rounded-lg border bg-slate-50 border-slate-200 dark:bg-black/20 dark:border-white/[0.06] shrink-0">
            {IMAGE_POSITIONS.map(pos => {
              const active = imagePosition === pos;
              return (
                <button
                  key={pos}
                  type="button"
                  onClick={() => setImagePosition(pos)}
                  title={pos}
                  aria-pressed={active}
                  className={cx(
                    'w-7 h-7 rounded-md flex items-center justify-center transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
                    active ? 'bg-blue-600' : 'hover:bg-slate-200 dark:hover:bg-white/[0.08]',
                  )}
                >
                  <span className={cx('rounded-full', active ? 'w-2 h-2 bg-white' : 'w-1.5 h-1.5 bg-slate-300 dark:bg-zinc-600')} />
                </button>
              );
            })}
          </div>
          <p className="text-[11px] leading-snug text-slate-500 dark:text-zinc-500">
            Choose which part of the photo stays visible when it is cropped or letterboxed inside the frame.
          </p>
        </div>
      </div>
    )}
  </SettingsCard>
);
