import React from 'react';
import { Check, IdCard } from 'lucide-react';
import { DOCUMENT_PRESETS, type DocPresetKey } from '../constants';
import type { DimensionState } from '../hooks/useDimensionState';
import { DimensionEditor } from '../components/DimensionEditor';
import { SettingsCard, cx } from '../ui/primitives';

export const DocumentSizeSection: React.FC<{
  docPreset: DocPresetKey;
  onSelect: (key: DocPresetKey) => void;
  photoDims: DimensionState;
}> = ({ docPreset, onSelect, photoDims }) => (
  <SettingsCard
    icon={<IdCard size={15} />}
    title="Photo size"
    description="Pick the document you are printing for"
  >
    <div className="grid grid-cols-2 gap-2">
      {(Object.keys(DOCUMENT_PRESETS) as DocPresetKey[]).map((key) => {
        const preset = DOCUMENT_PRESETS[key];
        const isSelected = docPreset === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(key)}
            className={cx(
              'relative flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
              isSelected
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 dark:border-blue-500/70'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:bg-white/[0.04] dark:hover:border-white/15',
            )}
          >
            <span className={cx(
              'flex items-center justify-center w-7 h-7 rounded-md shrink-0 transition-colors',
              isSelected
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-zinc-400',
            )}>
              {preset.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className={cx(
                'block text-xs font-semibold truncate',
                isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-zinc-200',
              )}>
                {preset.name}
              </span>
              <span className="block text-[10px] font-mono mt-0.5 truncate text-slate-500 dark:text-zinc-500">
                {preset.desc}
              </span>
            </span>
            {isSelected && (
              <Check size={13} strokeWidth={3} className="absolute top-2 right-2 text-blue-600 dark:text-blue-400" />
            )}
          </button>
        );
      })}
    </div>

    {docPreset === 'custom' && (
      <DimensionEditor title="Custom photo dimensions" dims={photoDims} max={1000} />
    )}
  </SettingsCard>
);
