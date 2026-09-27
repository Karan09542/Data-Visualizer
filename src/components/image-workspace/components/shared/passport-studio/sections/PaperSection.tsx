import React from 'react';
import { FileText, Scissors } from 'lucide-react';
import { CustomSelect } from '../../CustomSelect';
import { PAPER_SIZES, type PaperSizeKey } from '../constants';
import type { DimensionState } from '../hooks/useDimensionState';
import type { Orientation, SheetLayout } from '../types';
import { DimensionEditor } from '../components/DimensionEditor';
import { FieldLabel, NumberInput, Segmented, SettingsCard, SwitchRow, ValueBadge } from '../ui/primitives';

export const PaperSection: React.FC<{
  paperSize: PaperSizeKey;
  onSelectPaperSize: (key: PaperSizeKey) => void;
  paperDims: DimensionState;
  orientation: Orientation;
  setOrientation: (o: Orientation) => void;
  layout: SheetLayout;
}> = ({ paperSize, onSelectPaperSize, paperDims, orientation, setOrientation, layout }) => (
  <SettingsCard
    icon={<FileText size={15} />}
    title="Paper sheet"
    description="The paper you will print on"
    aside={<ValueBadge>{layout.pWidth} × {layout.pHeight} mm</ValueBadge>}
  >
    <div>
      <FieldLabel>Paper size</FieldLabel>
      <CustomSelect
        value={paperSize}
        onChange={onSelectPaperSize}
        options={Object.entries(PAPER_SIZES).map(([k, v]) => ({ value: k, label: v.name }))}
      />
    </div>

    {paperSize === 'custom' && (
      <DimensionEditor title="Custom paper dimensions" dims={paperDims} max={5000} />
    )}

    <div>
      <FieldLabel>Orientation</FieldLabel>
      <Segmented
        value={orientation}
        onChange={setOrientation}
        options={[
          { value: 'portrait', label: <><span className="w-2.5 h-3.5 border-[1.5px] border-current rounded-[2px]" />Portrait</> },
          { value: 'landscape', label: <><span className="w-3.5 h-2.5 border-[1.5px] border-current rounded-[2px]" />Landscape</> },
        ]}
      />
    </div>
  </SettingsCard>
);

export const SpacingSection: React.FC<{
  spacing: number;
  setSpacing: (v: number) => void;
  marginTop: number;
  setMarginTop: (v: number) => void;
  marginLeft: number;
  setMarginLeft: (v: number) => void;
  drawCropMarks: boolean;
  setDrawCropMarks: (v: boolean) => void;
}> = ({ spacing, setSpacing, marginTop, setMarginTop, marginLeft, setMarginLeft, drawCropMarks, setDrawCropMarks }) => (
  <SettingsCard
    icon={<Scissors size={15} />}
    title="Spacing & cut guides"
    description="Gaps between photos and sheet margins"
  >
    <div className="grid grid-cols-3 gap-2">
      <div>
        <FieldLabel>Gap</FieldLabel>
        <NumberInput min="0" max="50" value={spacing} suffix="mm" onValueChange={raw => setSpacing(Math.max(0, Number(raw)))} />
      </div>
      <div>
        <FieldLabel>Top margin</FieldLabel>
        <NumberInput min="0" max="100" value={marginTop} suffix="mm" onValueChange={raw => setMarginTop(Math.max(0, Number(raw)))} />
      </div>
      <div>
        <FieldLabel>Side margin</FieldLabel>
        <NumberInput min="0" max="100" value={marginLeft} suffix="mm" onValueChange={raw => setMarginLeft(Math.max(0, Number(raw)))} />
      </div>
    </div>

    <SwitchRow
      checked={drawCropMarks}
      onToggle={() => setDrawCropMarks(!drawCropMarks)}
      icon={<Scissors size={15} />}
      label="Draw cut guidelines"
      description="Dashed borders and scissor marks for trimming"
    />
  </SettingsCard>
);
