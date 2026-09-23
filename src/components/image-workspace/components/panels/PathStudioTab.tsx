import React, { useMemo, useRef } from 'react';
import {
  ArrowLeftRight, Check, Dices, Image as ImageIcon, MoveHorizontal, PenTool, RotateCcw,
  Shapes, Smile, Spline, Type, Upload,
} from 'lucide-react';
import { ColorField, GridButton, Label, PanelSection, RangeSlider, ToggleSwitch } from '../shared/PanelPrimitives';
import type { PathStudioApi } from '../../hooks/usePathStudio';

/**
 * Path Studio's panel: what to put along the drawn path, how often, and how it sits on the line.
 */

const QUICK_EMOJI = ['✨', '⭐', '❤️', '🌿', '🔥', '💧', '🎵', '🌸', '🐾', '🎈'];

/** A small drawing of the path, so it is clear which line is being worked on. */
const PathPreview: React.FC<{ points: { x: number; y: number }[]; closed: boolean }> = ({ points, closed }) => {
  const d = useMemo(() => {
    if (points.length < 2) return null;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const w = Math.max(1, Math.max(...xs) - minX);
    const h = Math.max(1, Math.max(...ys) - minY);
    const scale = Math.min(96 / w, 40 / h);
    const ox = (112 - w * scale) / 2;
    const oy = (52 - h * scale) / 2;
    const at = (p: { x: number; y: number }) => `${(ox + (p.x - minX) * scale).toFixed(1)} ${(oy + (p.y - minY) * scale).toFixed(1)}`;
    return `M ${at(points[0])} ${points.slice(1).map((p) => `L ${at(p)}`).join(' ')}${closed ? ' Z' : ''}`;
  }, [points, closed]);

  if (!d) return null;
  return (
    <svg viewBox="0 0 112 52" className="w-[112px] h-[52px] shrink-0" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/** Segmented picker used for the small either/or choices in this panel. */
const Segmented = <T extends string>({ value, onChange, options }: {
  value: T;
  /** Kept out of the inference so the choice's own union type wins, not a plain string. */
  onChange: (v: NoInfer<T>) => void;
  options: { id: T; label: string; icon?: React.ReactNode }[];
}) => (
  <div className="grid gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
    {options.map((o) => (
      <button
        key={o.id}
        type="button"
        onClick={() => onChange(o.id)}
        aria-pressed={value === o.id}
        className={`flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-md text-[10.5px] font-semibold transition-all active:scale-[0.97] cursor-pointer ${value === o.id
          ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
          : 'text-slate-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'}`}
      >
        {o.icon}
        {o.label}
      </button>
    ))}
  </div>
);

export const PathStudioTab: React.FC<{ studio: PathStudioApi; onDrawPath: () => void }> = ({ studio, onDrawPath }) => {
  const fileRef = useRef<HTMLInputElement>(null);

  if (!studio.hasPath) {
    return (
      <div className="p-4 text-slate-700 dark:text-[#C0C0C0] font-sans">
        <div className="flex flex-col items-center text-center gap-3 px-4 py-10 rounded-xl border border-dashed border-slate-300 dark:border-white/10 bg-slate-50/60 dark:bg-white/[0.02]">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-blue-500/10 text-blue-500">
            <Spline size={22} />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-slate-800 dark:text-white">Draw a path first</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-zinc-400">
              Draw a line or outline with the Pen tool, then lay shapes, emoji, a picture or text along it.
              A marquee or ellipse selection works too.
            </p>
          </div>
          <button
            type="button"
            onClick={onDrawPath}
            className="mt-1 h-9 px-3.5 flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold shadow-sm shadow-blue-500/25 transition-all active:scale-[0.98] cursor-pointer"
          >
            <PenTool size={14} /> Draw with the Pen
          </button>
        </div>
      </div>
    );
  }

  const isText = studio.mode === 'text';

  return (
    <div className="flex flex-col min-h-full text-slate-700 dark:text-[#C0C0C0] font-sans">
      <div className="p-4 space-y-4 flex-1">
        {/* ── The path ── */}
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] p-3 space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="text-blue-500 dark:text-blue-400"><PathPreview points={studio.pathPoints} closed={studio.isLoop} /></div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] uppercase tracking-wider font-bold text-slate-400 dark:text-zinc-500">Your path</p>
              <p className="text-[11px] font-semibold text-slate-800 dark:text-white">
                {Math.round(studio.pathLength)} px {studio.isLoop ? 'loop' : 'line'}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                {isText ? '1 text layer' : `${studio.itemCount} item${studio.itemCount === 1 ? '' : 's'}`}
              </p>
            </div>
          </div>
          <Segmented
            value={studio.closing}
            onChange={studio.setClosing}
            options={[
              { id: 'auto', label: 'Auto' },
              { id: 'open', label: 'Line' },
              { id: 'loop', label: 'Loop' },
            ]}
          />
          <button
            type="button"
            onClick={() => studio.setReverse(!studio.reverse)}
            aria-pressed={studio.reverse}
            className={`w-full h-8 flex items-center justify-center gap-1.5 rounded-lg border text-[10.5px] font-semibold transition-colors cursor-pointer ${studio.reverse
              ? 'bg-blue-600 border-blue-500 text-white'
              : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'}`}
          >
            <ArrowLeftRight size={13} /> Flip direction
          </button>
        </div>

        {/* ── What goes along it ── */}
        <Segmented
          value={studio.mode}
          onChange={studio.setMode}
          options={[
            { id: 'repeat', label: 'Repeat', icon: <Shapes size={13} /> },
            { id: 'text', label: 'Text on path', icon: <Type size={13} /> },
          ]}
        />

        {!isText && (
          <PanelSection icon={<Shapes size={14} />} title="What to place">
            <Segmented
              value={studio.kind}
              onChange={studio.setKind}
              options={[
                { id: 'shape', label: 'Shape', icon: <Shapes size={13} /> },
                { id: 'emoji', label: 'Emoji', icon: <Smile size={13} /> },
                { id: 'image', label: 'Picture', icon: <ImageIcon size={13} /> },
              ]}
            />

            {studio.kind === 'shape' && (
              <div className="grid grid-cols-5 gap-1.5">
                {studio.shapes.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    title={s.label}
                    onClick={() => studio.setShapeId(s.id)}
                    aria-pressed={studio.shapeId === s.id}
                    className={`aspect-square flex items-center justify-center rounded-lg border transition-all active:scale-95 cursor-pointer ${studio.shapeId === s.id
                      ? 'bg-blue-600 border-blue-500 text-white shadow-sm shadow-blue-500/25'
                      : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'}`}
                  >
                    <svg viewBox="0 0 100 100" className="w-5 h-5" aria-hidden="true">
                      <path d={s.d} fill="currentColor" />
                    </svg>
                  </button>
                ))}
              </div>
            )}

            {studio.kind === 'emoji' && (
              <div className="space-y-2">
                <div className="grid grid-cols-5 gap-1.5">
                  {QUICK_EMOJI.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => studio.setEmoji(e)}
                      aria-pressed={studio.emoji === e}
                      className={`aspect-square text-[18px] flex items-center justify-center rounded-lg border transition-all active:scale-95 cursor-pointer ${studio.emoji === e
                        ? 'bg-blue-600/15 border-blue-500'
                        : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <input
                  value={studio.emoji}
                  onChange={(e) => studio.setEmoji(e.target.value)}
                  placeholder="Or type any character"
                  className="w-full h-9 px-2.5 rounded-lg bg-white dark:bg-[#0d0d0d] border border-slate-200 dark:border-white/10 text-[12px] text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            {studio.kind === 'image' && (
              <div className="space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) studio.pickImageFile(file);
                    e.target.value = '';
                  }}
                />
                <div className="grid grid-cols-2 gap-1.5">
                  <GridButton onClick={() => fileRef.current?.click()} className="flex items-center justify-center gap-1.5">
                    <Upload size={12} /> Choose file
                  </GridButton>
                  <GridButton onClick={() => studio.useSelectedImage()} className="flex items-center justify-center gap-1.5">
                    <ImageIcon size={12} /> Selected layer
                  </GridButton>
                </div>
                {studio.image && (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10">
                    <img
                      src={studio.image.element instanceof HTMLImageElement ? studio.image.element.src : (studio.image.element as HTMLCanvasElement).toDataURL()}
                      alt=""
                      className="w-8 h-8 rounded object-cover border border-slate-200 dark:border-white/10"
                    />
                    <span className="flex-1 min-w-0 truncate text-[10.5px] text-slate-600 dark:text-zinc-300">{studio.image.name}</span>
                    <button type="button" onClick={studio.clearImage} className="text-[10px] font-semibold text-slate-400 hover:text-red-500 cursor-pointer">Remove</button>
                  </div>
                )}
              </div>
            )}
          </PanelSection>
        )}

        {isText && (
          <PanelSection icon={<Type size={14} />} title="Text">
            <textarea
              value={studio.text}
              onChange={(e) => studio.setText(e.target.value)}
              rows={2}
              placeholder="Type the words to run along the path"
              className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-[#0d0d0d] border border-slate-200 dark:border-white/10 text-[12px] text-slate-800 dark:text-white resize-y focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div>
              <Label>Font</Label>
              <select
                value={studio.fontFamily}
                onChange={(e) => studio.setFontFamily(e.target.value)}
                className="w-full h-9 px-2 rounded-lg bg-white dark:bg-[#0d0d0d] border border-slate-200 dark:border-white/10 text-[12px] text-slate-800 dark:text-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {studio.fonts.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
              </select>
            </div>
            <Segmented
              value={studio.fontWeight}
              onChange={studio.setFontWeight}
              options={[{ id: '400', label: 'Regular' }, { id: '700', label: 'Bold' }]}
            />
            <RangeSlider label="Size" valueDisplay={studio.fontSize} displayUnit="px" min={8} max={200} step={1} value={studio.fontSize} onChange={(e) => studio.setFontSize(Number(e.target.value))} />
            <RangeSlider label="Letter spacing" valueDisplay={studio.charSpacing} min={-200} max={800} step={10} value={studio.charSpacing} onChange={(e) => studio.setCharSpacing(Number(e.target.value))} />
            <RangeSlider label="Start along path" valueDisplay={Math.round(studio.textStart)} displayUnit="px" min={-1000} max={1000} step={5} value={studio.textStart} onChange={(e) => studio.setTextStart(Number(e.target.value))} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Side</Label>
                <Segmented value={studio.textSide} onChange={studio.setTextSide} options={[{ id: 'left', label: 'Above' }, { id: 'right', label: 'Below' }]} />
              </div>
              <div>
                <Label>Align</Label>
                <Segmented value={studio.textAlign} onChange={studio.setTextAlign} options={[{ id: 'left', label: 'Start' }, { id: 'center', label: 'Middle' }, { id: 'right', label: 'End' }]} />
              </div>
            </div>
          </PanelSection>
        )}

        {/* ── Spacing and placement ── */}
        {!isText && (
          <PanelSection icon={<MoveHorizontal size={14} />} title="Placement">
            <Segmented
              value={studio.spreadMode}
              onChange={studio.setSpreadMode}
              options={[{ id: 'spacing', label: 'Even gaps' }, { id: 'count', label: 'Fixed number' }]}
            />
            {studio.spreadMode === 'spacing' ? (
              <RangeSlider label="Gap" valueDisplay={studio.spacing} displayUnit="px" min={4} max={400} step={2} value={studio.spacing} onChange={(e) => studio.setSpacing(Number(e.target.value))} />
            ) : (
              <RangeSlider label="How many" valueDisplay={studio.count} min={1} max={200} step={1} value={studio.count} onChange={(e) => studio.setCount(Number(e.target.value))} />
            )}
            <RangeSlider label="Size" valueDisplay={studio.size} displayUnit="px" min={2} max={400} step={1} value={studio.size} onChange={(e) => studio.setSize(Number(e.target.value))} />
            <RangeSlider label="Slide along" valueDisplay={Math.round(studio.offsetAlong)} displayUnit="px" min={-400} max={400} step={2} value={studio.offsetAlong} onChange={(e) => studio.setOffsetAlong(Number(e.target.value))} />
            <RangeSlider label="Off to the side" valueDisplay={Math.round(studio.sideOffset)} displayUnit="px" min={-300} max={300} step={2} value={studio.sideOffset} onChange={(e) => studio.setSideOffset(Number(e.target.value))} />
            <div className="grid grid-cols-2 gap-2">
              <RangeSlider label="Trim start" valueDisplay={Math.round(studio.startTrim * 100)} displayUnit="%" min={0} max={45} step={1} value={Math.round(studio.startTrim * 100)} onChange={(e) => studio.setStartTrim(Number(e.target.value) / 100)} />
              <RangeSlider label="Trim end" valueDisplay={Math.round(studio.endTrim * 100)} displayUnit="%" min={0} max={45} step={1} value={Math.round(studio.endTrim * 100)} onChange={(e) => studio.setEndTrim(Number(e.target.value) / 100)} />
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[10.5px] font-medium text-slate-600 dark:text-zinc-300">Turn with the path</span>
              <ToggleSwitch checked={studio.rotateWithPath} onChange={studio.setRotateWithPath} showState={false} />
            </div>
            <RangeSlider label="Extra turn" valueDisplay={studio.extraAngle} displayUnit="°" min={-180} max={180} step={1} value={studio.extraAngle} onChange={(e) => studio.setExtraAngle(Number(e.target.value))} />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-medium text-slate-600 dark:text-zinc-300">Alternate sides</span>
              <ToggleSwitch checked={studio.alternate} onChange={studio.setAlternate} showState={false} />
            </div>
          </PanelSection>
        )}

        {/* ── Look ── */}
        <PanelSection icon={<Spline size={14} />} title="Look">
          {(isText || studio.kind !== 'image') && <ColorField label={isText ? 'Text colour' : 'Fill'} color={studio.fill} onChange={studio.setFill} />}
          {(isText || studio.kind === 'shape') && (
            <>
              <RangeSlider label="Outline" valueDisplay={studio.strokeWidth} displayUnit="px" min={0} max={20} step={0.5} value={studio.strokeWidth} onChange={(e) => studio.setStrokeWidth(Number(e.target.value))} />
              {studio.strokeWidth > 0 && <ColorField label="Outline colour" color={studio.stroke} onChange={studio.setStroke} />}
            </>
          )}
          <RangeSlider label="Opacity" valueDisplay={Math.round(studio.opacity * 100)} displayUnit="%" min={5} max={100} step={1} value={Math.round(studio.opacity * 100)} onChange={(e) => studio.setOpacity(Number(e.target.value) / 100)} />
        </PanelSection>

        {/* ── Scatter ── */}
        {!isText && (
          <PanelSection
            icon={<Dices size={14} />}
            title={
              <span className="flex items-center justify-between gap-2">
                Scatter
                <button type="button" onClick={studio.shuffle} className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                  Shuffle
                </button>
              </span>
            }
          >
            <RangeSlider label="Position" valueDisplay={Math.round(studio.jitterPosition)} displayUnit="px" min={0} max={120} step={1} value={studio.jitterPosition} onChange={(e) => studio.setJitterPosition(Number(e.target.value))} />
            <RangeSlider label="Size" valueDisplay={Math.round(studio.jitterSize * 100)} displayUnit="%" min={0} max={90} step={1} value={Math.round(studio.jitterSize * 100)} onChange={(e) => studio.setJitterSize(Number(e.target.value) / 100)} />
            <RangeSlider label="Turn" valueDisplay={Math.round(studio.jitterAngle)} displayUnit="°" min={0} max={180} step={1} value={studio.jitterAngle} onChange={(e) => studio.setJitterAngle(Number(e.target.value))} />
          </PanelSection>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="sticky bottom-0 p-3 space-y-2 bg-white/95 dark:bg-[#111]/95 backdrop-blur border-t border-slate-200 dark:border-white/10">
        {!isText && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10.5px] font-medium text-slate-600 dark:text-zinc-300">Keep as one group</span>
            <ToggleSwitch checked={studio.groupItems} onChange={studio.setGroupItems} showState={false} />
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={studio.reset}
            title="Back to the default settings"
            aria-label="Reset settings"
            className="h-9 w-9 flex items-center justify-center rounded-lg border bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            onClick={studio.apply}
            disabled={studio.itemCount === 0}
            className="flex-1 h-9 flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold shadow-sm shadow-blue-500/25 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            <Check size={14} />
            {isText ? 'Add text to canvas' : `Add ${studio.itemCount} to canvas`}
          </button>
        </div>
      </div>
    </div>
  );
};
