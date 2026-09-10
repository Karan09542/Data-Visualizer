import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { CROP_SHAPES, CropShape, CropShapeId, cropShapePoints } from '../../../../utils/cropShapes';

/**
 * Draws a shape at thumbnail size from the very same generator that cuts the pixels, so the
 * preview cannot drift from the result - including the stretch that makes a shape fill its box.
 */
const ShapeGlyph: React.FC<{ shape: CropShape; size?: number }> = ({ shape, size = 22 }) => {
  const inset = 1.5;
  const box = { x: inset, y: inset, width: size - inset * 2, height: size - inset * 2 };

  if (shape.id === 'ellipse') {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <ellipse
          cx={size / 2} cy={size / 2} rx={box.width / 2} ry={box.height / 2}
          fill="currentColor" fillOpacity={0.18} stroke="currentColor" strokeWidth={1.4}
        />
      </svg>
    );
  }

  const points = cropShapePoints(shape, box).map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <polygon
        points={points}
        fill="currentColor" fillOpacity={0.18} stroke="currentColor" strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </svg>
  );
};

interface Props {
  value: CropShape;
  onChange: (shape: CropShape) => void;
}

/** Shape picker for the crop bar: a glyph grid, plus the two dials a star and a polygon need. */
export const CropShapePicker: React.FC<Props> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const current = CROP_SHAPES.find(s => s.id === value.id) || CROP_SHAPES[0];
  const adjustable = value.id === 'star' || value.id === 'polygon';

  const pick = (id: CropShapeId) => {
    // Carry the dials across, so flipping between star and polygon keeps the count you set.
    onChange({ ...value, id });
    if (id !== 'star' && id !== 'polygon') setOpen(false);
  };

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Crop shape"
        aria-haspopup="true"
        aria-expanded={open}
        className={`h-9 pl-2 pr-1.5 rounded-xl border flex items-center gap-1.5 text-[11px] font-semibold transition-colors touch-manipulation ${open
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
          : 'border-slate-200 dark:border-[#333] bg-slate-100 dark:bg-[#2A2A2A] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#333]'}`}
      >
        <ShapeGlyph shape={value} size={18} />
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 right-0 w-[236px] p-2 rounded-2xl border shadow-2xl z-[60] bg-white dark:bg-[#1A1A1A] border-slate-200 dark:border-[#2D2D2D] animate-in fade-in zoom-in-95 duration-100">
          <div className="grid grid-cols-4 gap-1.5">
            {CROP_SHAPES.map(s => {
              const active = value.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  title={s.label}
                  aria-pressed={active}
                  onClick={() => pick(s.id)}
                  className={`h-14 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all active:scale-[0.96] touch-manipulation ${active
                    ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:border-blue-400 dark:hover:border-blue-500/60'}`}
                >
                  <ShapeGlyph shape={{ ...value, id: s.id }} />
                  <span className="text-[8px] font-bold uppercase tracking-tight truncate max-w-full px-0.5">
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>

          {adjustable && (
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/5 space-y-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                    {value.id === 'star' ? 'Points' : 'Sides'}
                  </span>
                  <span className="font-mono text-[10px] text-slate-600 dark:text-zinc-300">{value.sides ?? 5}</span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={12}
                  step={1}
                  value={value.sides ?? 5}
                  onChange={(e) => onChange({ ...value, sides: Number(e.target.value) })}
                  className="w-full accent-blue-500 h-1.5 bg-slate-200 dark:bg-[#2C2C2C] rounded-full appearance-none outline-none cursor-pointer"
                />
              </div>

              {value.id === 'star' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                      Depth
                    </span>
                    <span className="font-mono text-[10px] text-slate-600 dark:text-zinc-300">
                      {Math.round((1 - (value.innerRatio ?? 0.42)) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={80}
                    step={1}
                    // Shown as depth rather than inner radius: a deeper star is the spikier one,
                    // which is the way round people think about it.
                    value={Math.round((1 - (value.innerRatio ?? 0.42)) * 100)}
                    onChange={(e) => onChange({ ...value, innerRatio: 1 - Number(e.target.value) / 100 })}
                    className="w-full accent-blue-500 h-1.5 bg-slate-200 dark:bg-[#2C2C2C] rounded-full appearance-none outline-none cursor-pointer"
                  />
                </div>
              )}
            </div>
          )}

          <p className="mt-2 text-[9px] leading-relaxed text-slate-400 dark:text-zinc-500">
            Anything but Rectangle cuts the picture out with transparency, so it can sit on any
            background.
          </p>
        </div>
      )}
    </div>
  );
};
