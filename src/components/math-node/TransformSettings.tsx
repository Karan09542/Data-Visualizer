import React, { useEffect, useRef, useState } from "react";
import { Link2, Link2Off, RotateCcw } from "lucide-react";
import type { MathFunction } from "./mathTypes";
import { FIELD_CLASS } from "./SettingsControls";

const DEG = 180 / Math.PI;

/** A number shown tidily (no long tails from a drag), and as typed while it has focus. */
function NumberField({
  value,
  onChange,
  places = 2,
  step = 0.1,
  title,
  placeholder,
  className = "",
}: {
  value: number;
  onChange: (v: number) => void;
  places?: number;
  step?: number;
  title: string;
  placeholder?: string;
  className?: string;
}) {
  const shown = (v: number) => String(Number((Number.isFinite(v) ? v : 0).toFixed(places)));
  const [text, setText] = useState(() => shown(value));
  const focused = useRef(false);
  // Moved from outside (a handle, the 3D gizmo, Reset): show it, unless being typed in.
  useEffect(() => {
    if (!focused.current) setText(shown(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, places]);
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      title={title}
      aria-label={title}
      placeholder={placeholder}
      value={text}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        setText(shown(value));
      }}
      onChange={(e) => {
        setText(e.target.value);
        const v = parseFloat(e.target.value);
        // Half-typed ("-", "1.", ""): wait for a number.
        if (Number.isFinite(v)) onChange(v);
      }}
      className={`${FIELD_CLASS} flex-1 text-center px-1 min-w-0 ${className}`}
    />
  );
}

/** A label above its fields, which share the full width: readable in a narrow panel. */
const ROW = "flex flex-col gap-1";
const LABEL = "text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap";

/**
 * Where a row is moved, turned and resized: the same settings the drawing tools' Select
 * tool, the row's own handles and the 3D gizmo change, always showing what they hold now.
 * Changing the pivot keeps the shape where it is, as dragging the pivot handle does.
 */
export function TransformSettings({
  f,
  is3d,
  onPatch,
}: {
  f: MathFunction;
  is3d: boolean;
  onPatch: (patch: Partial<MathFunction>) => void;
}) {
  const [tx, ty] = f.transformTranslate ?? [0, 0];
  const tz = f.transformTranslateZ ?? 0;
  const rot = f.transformRotate ?? 0;
  const rx = f.transformRotateX ?? 0;
  const ry = f.transformRotateY ?? 0;
  const [sx, sy] = f.transformScale ?? [1, 1];
  const [px, py] = f.transformPivot ?? [0, 0];
  const [linked, setLinked] = useState(() => Math.abs(sx - sy) < 1e-9);
  // A resize from elsewhere that pulls the two apart unlinks them.
  useEffect(() => {
    if (Math.abs(sx - sy) > 1e-9) setLinked(false);
  }, [sx, sy]);

  // Turned, resized or tilted: what the card shows; set up by the Select tool counts too.
  const transformed =
    !!rot || !!rx || !!ry || Math.abs(sx - 1) > 1e-9 || Math.abs(sy - 1) > 1e-9 || !!tx || !!ty || !!tz;
  const showTurn = !!f.isTransformable && (!!f.isRotatable || !!f.handlesOnSelect || !!rot || !!rx || !!ry);
  const showScale = !!f.isTransformable && (!!f.isResizable || !!f.handlesOnSelect || Math.abs(sx - 1) > 1e-9 || Math.abs(sy - 1) > 1e-9);
  const showPivot = !!f.isTransformable && !!f.isPivotEnabled;

  /**
   * A new pivot, with the shift that keeps the shape still. Exact for an even resize;
   * an uneven one depends on the shape's own direction, so there the shape may move.
   */
  const setPivot = (nx: number, ny: number) => {
    const dx = nx - px;
    const dy = ny - py;
    if (Math.abs(sx - sy) > 1e-9) return onPatch({ transformPivot: [nx, ny] });
    const c = Math.cos(rot) * sx;
    const s = Math.sin(rot) * sx;
    const mx = c * dx - s * dy;
    const my = s * dx + c * dy;
    onPatch({ transformPivot: [nx, ny], transformTranslate: [tx + mx - dx, ty + my - dy] });
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">Transform</span>
        {transformed && (
          <button
            type="button"
            onClick={() =>
              onPatch({
                transformTranslate: [0, 0],
                transformTranslateZ: 0,
                transformRotate: 0,
                transformRotateX: 0,
                transformRotateY: 0,
                transformScale: [1, 1],
              })
            }
            title="Put it back where it was: no shift, turn or resize"
            className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 hover:border-blue-400 transition-colors"
          >
            <RotateCcw size={10} />
            Reset
          </button>
        )}
      </div>
      {f.handlesOnSelect && (
        <span className="-mt-1 text-[10px] leading-snug text-slate-400 dark:text-slate-500">
          Follows the Select tool's handles; type here to set exact values.
        </span>
      )}

      <div className={ROW}>
        <span className={LABEL}>{is3d ? "Shift [h, k, z]" : "Shift [h, k]"}</span>
        <div className="flex gap-1.5">
          <NumberField title="h: shift along x" placeholder="h" value={tx} onChange={(v) => onPatch({ transformTranslate: [v, ty] })} />
          <NumberField title="k: shift along y" placeholder="k" value={ty} onChange={(v) => onPatch({ transformTranslate: [tx, v] })} />
          {is3d && <NumberField title="z: height shift (3D view only)" placeholder="z" value={tz} onChange={(v) => onPatch({ transformTranslateZ: v })} />}
        </div>
      </div>

      {showTurn && (
        <div className={ROW}>
          <span className={LABEL}>{is3d ? "Turn (°) x, y, z" : "Turn (°)"}</span>
          <div className="flex gap-1.5">
            {is3d && (
              <>
                <NumberField title="Turn about x, degrees (3D view only)" places={1} step={5} value={rx * DEG} onChange={(v) => onPatch({ transformRotateX: v / DEG })} />
                <NumberField title="Turn about y, degrees (3D view only)" places={1} step={5} value={ry * DEG} onChange={(v) => onPatch({ transformRotateY: v / DEG })} />
              </>
            )}
            <NumberField title="Turn about z (in the plane), degrees" places={1} step={5} value={rot * DEG} onChange={(v) => onPatch({ transformRotate: v / DEG })} />
          </div>
        </div>
      )}

      {showScale && (
        <div className={ROW}>
          <span className={LABEL}>Scale</span>
          <div className="flex items-center gap-1.5">
            <NumberField
              title={linked ? "Scale" : "Scale along the shape's own length"}
              places={3}
              step={0.1}
              value={sx}
              onChange={(v) => v !== 0 && onPatch({ transformScale: linked ? [v, v] : [v, sy] })}
            />
            {!linked && (
              <NumberField title="Scale across the shape" places={3} step={0.1} value={sy} onChange={(v) => v !== 0 && onPatch({ transformScale: [sx, v] })} />
            )}
            <button
              type="button"
              onClick={() => {
                if (!linked) onPatch({ transformScale: [sx, sx] });
                setLinked(!linked);
              }}
              title={linked ? "Scale the two ways separately" : "Keep the shape: one scale for both ways"}
              aria-pressed={linked}
              className={`shrink-0 h-6 w-6 inline-flex items-center justify-center rounded-md border transition-colors ${
                linked
                  ? "border-blue-400 text-blue-600 dark:text-blue-400 bg-blue-500/10"
                  : "border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              }`}
            >
              {linked ? <Link2 size={12} /> : <Link2Off size={12} />}
            </button>
          </div>
        </div>
      )}

      {showPivot && (
        <div className={ROW}>
          <span className={LABEL} title="The point it turns and resizes about">
            Pivot [x, y]
          </span>
          <div className="flex gap-1.5">
            <NumberField title="Pivot x" step={0.5} value={px} onChange={(v) => setPivot(v, py)} />
            <NumberField title="Pivot y" step={0.5} value={py} onChange={(v) => setPivot(px, v)} />
          </div>
        </div>
      )}
    </div>
  );
}
