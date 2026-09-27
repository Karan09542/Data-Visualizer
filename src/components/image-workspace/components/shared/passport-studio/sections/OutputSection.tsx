import React from 'react';
import { FileDown, Printer } from 'lucide-react';
import { DPI_PRESETS, FILE_SIZE_PRESETS } from '../constants';
import type { SheetLayout } from '../types';
import { Chip, ChipRow, FieldLabel, Hint, NumberInput, Segmented, SettingsCard, ValueBadge } from '../ui/primitives';

export const ResolutionSection: React.FC<{
  printDPI: number;
  setPrintDPI: (dpi: number) => void;
  layout: SheetLayout;
}> = ({ printDPI, setPrintDPI, layout }) => (
  <SettingsCard
    icon={<Printer size={15} />}
    title="Print resolution"
    description="Higher DPI gives sharper prints and larger files"
    aside={<ValueBadge>{printDPI} DPI</ValueBadge>}
  >
    <Segmented
      value={printDPI}
      onChange={setPrintDPI}
      options={DPI_PRESETS.map(p => ({ value: p.dpi, label: p.label, hint: p.hint, title: `${p.label} DPI (${p.hint})` }))}
    />

    <div>
      <FieldLabel>Custom DPI</FieldLabel>
      <NumberInput
        min="72" max="1200" step="10"
        placeholder="300"
        value={printDPI}
        suffix="DPI"
        onValueChange={raw => {
          const val = Math.max(72, parseInt(raw) || 300);
          setPrintDPI(val);
        }}
      />
    </div>

    <Hint className="font-mono">
      Output: {Math.round((layout.pWidth / 25.4) * printDPI)} × {Math.round((layout.pHeight / 25.4) * printDPI)} px
    </Hint>
  </SettingsCard>
);

export const FileSizeSection: React.FC<{
  maxFileKB: number;
  setMaxFileKB: (kb: number) => void;
}> = ({ maxFileKB, setMaxFileKB }) => (
  <SettingsCard
    icon={<FileDown size={15} />}
    title="File size limit"
    description="For upload portals with a KB cap (JPEG / WEBP export)"
    aside={<ValueBadge>{maxFileKB > 0 ? `≤ ${maxFileKB} KB` : 'Original'}</ValueBadge>}
  >
    <ChipRow>
      {FILE_SIZE_PRESETS.map(item => (
        <Chip key={item.label} active={maxFileKB === item.kb} onClick={() => setMaxFileKB(item.kb)}>
          {item.label}
        </Chip>
      ))}
    </ChipRow>

    <div>
      <FieldLabel
        aside={maxFileKB > 0 && (
          <button
            type="button"
            onClick={() => setMaxFileKB(0)}
            className="text-[11px] font-medium text-slate-500 hover:text-rose-600 dark:text-zinc-500 dark:hover:text-rose-400"
            title="Clear Limit"
          >
            Clear
          </button>
        )}
      >
        Custom limit
      </FieldLabel>
      <NumberInput
        min="5" max="10000" step="5"
        placeholder="e.g. 35"
        value={maxFileKB > 0 ? maxFileKB : ''}
        suffix="KB"
        onValueChange={raw => {
          const val = Math.max(0, parseInt(raw) || 0);
          setMaxFileKB(val);
        }}
      />
    </div>

    <Hint>Resolution and quality are tuned automatically to stay under the limit. PNG exports are always lossless.</Hint>
  </SettingsCard>
);
