import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Annotation, useAnnotationStore } from '../store/useAnnotationStore';
import { groupTransformUpdates, identityMatrix, unionBox, type GroupTransform } from '../utils/annotationSelection';

/**
 * The handles for a multi-shape selection made with Box select: the same box, rotate handle,
 * resize handles, tooltips and menu button as the single-shape TransformBox, acting on every
 * selected shape at once.
 *
 * Drag inside to move; drag a handle to resize around the centre (Shift keeps the aspect on a
 * corner), as TransformBox does; drag the round handle to rotate (Shift snaps to 90°). Shift-tap a
 * shape inside the box to drop it from (or add it to) the selection. Every gesture works from a
 * snapshot taken when it starts, so the shapes never drift.
 */

const HANDLE = 8;
const ROTATE_DIST = 30;

/** The box as shown: centre, size, and the angle it is turned through while rotating. */
interface Frame { cx: number; cy: number; w: number; h: number; angle: number }

export const GroupTransformBox = ({ annos, onOpenMenu }: { annos: Annotation[]; onOpenMenu: (x: number, y: number) => void }) => {
  const gRef = useRef<SVGGElement>(null);
  const union = unionBox(annos)!;
  const rest: Frame = {
    cx: (union.minX + union.maxX) / 2,
    cy: (union.minY + union.maxY) / 2,
    w: union.maxX - union.minX,
    h: union.maxY - union.minY,
    angle: 0,
  };
  // While a gesture runs, the box follows it; after, it is the box around the shapes again.
  const [live, setLive] = useState<Frame | null>(null);
  const [tooltip, setTooltip] = useState<string | null>(null);
  const frame = live ?? rest;

  const restRef = useRef(rest);
  restRef.current = rest;

  useEffect(() => {
    const g = gRef.current;
    if (!g) return;
    const parent = g.parentNode as Element;
    const sel = d3.select(g);

    // Keep the canvas, and the drawing system's own selection box, out of these gestures.
    sel.on('touchstart mousedown', (e) => e.stopPropagation());
    sel.on('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onOpenMenu(e.clientX, e.clientY);
    });

    const store = () => useAnnotationStore.getState();
    let snapshot: Annotation[] = [];
    let start: Frame = restRef.current;
    let startPointer: [number, number] = [0, 0];

    const begin = (e: any) => {
      e.sourceEvent?.stopPropagation();
      const state = store();
      snapshot = state.annotations.filter(a => state.selectedAnnotationIds.includes(a.id));
      start = restRef.current;
      startPointer = d3.pointer(e, parent);
    };
    const apply = (t: GroupTransform, shown: Frame) => {
      store().updateAnnotations(groupTransformUpdates(snapshot, t));
      setLive(shown);
    };
    const finish = () => {
      setLive(null);
      setTooltip(null);
      store().commitAction();
    };

    // 1. Move: drag inside the box. A Shift-tap toggles the shape under the pointer instead.
    let toggled = false;
    sel.select<SVGRectElement>('.gtb-bg').call(
      d3.drag<SVGRectElement, unknown>()
        .on('start', (e) => {
          begin(e);
          toggled = false;
          const src = e.sourceEvent as MouseEvent | undefined;
          if (src?.shiftKey) {
            const hit = document.elementsFromPoint(src.clientX, src.clientY)
              .map(el => el.getAttribute('data-anno-id'))
              .find(Boolean);
            if (hit) {
              const ids = store().selectedAnnotationIds;
              store().setSelectedAnnotations(ids.includes(hit) ? ids.filter(id => id !== hit) : [...ids, hit]);
              toggled = true;
            }
          }
        })
        .on('drag', (e) => {
          if (toggled) return;
          const [px, py] = d3.pointer(e, parent);
          const dx = px - startPointer[0];
          const dy = py - startPointer[1];
          apply({ cx: start.cx, cy: start.cy, m: identityMatrix, dx, dy }, { ...start, cx: start.cx + dx, cy: start.cy + dy });
        })
        .on('end', () => { if (!toggled) finish(); }),
    );

    // 2. Rotate about the centre, by the angle the pointer turns through.
    let startAngle = 0;
    sel.select<SVGGElement>('.gtb-rotate').call(
      d3.drag<SVGGElement, unknown>()
        .on('start', (e) => {
          begin(e);
          startAngle = Math.atan2(startPointer[1] - start.cy, startPointer[0] - start.cx);
          setTooltip('0°');
        })
        .on('drag', (e) => {
          const [px, py] = d3.pointer(e, parent);
          let deg = ((Math.atan2(py - start.cy, px - start.cx) - startAngle) * 180) / Math.PI;
          deg = ((deg + 540) % 360) - 180;
          if (e.sourceEvent?.shiftKey) deg = Math.round(deg / 90) * 90;
          const t = (deg * Math.PI) / 180;
          setTooltip(`${Math.round(deg)}°`);
          apply(
            { cx: start.cx, cy: start.cy, m: { a: Math.cos(t), b: -Math.sin(t), c: Math.sin(t), d: Math.cos(t) }, dx: 0, dy: 0 },
            { ...start, angle: deg },
          );
        })
        .on('end', finish),
    );

    // 3. Resize around the centre, as TransformBox does: a handle moved by d grows that side and
    // the opposite one, so the scale changes by 2d over the size.
    const resizer = (selector: string, xDir: number, yDir: number) => {
      sel.select<SVGGElement>(selector).call(
        d3.drag<SVGGElement, unknown>()
          .on('start', begin)
          .on('drag', (e) => {
            const [px, py] = d3.pointer(e, parent);
            let gx = xDir ? 1 + (xDir * (px - startPointer[0]) * 2) / Math.max(1, start.w) : 1;
            let gy = yDir ? 1 + (yDir * (py - startPointer[1]) * 2) / Math.max(1, start.h) : 1;
            if (e.sourceEvent?.shiftKey && xDir && yDir) {
              const g = Math.abs(gx - 1) > Math.abs(gy - 1) ? gx : gy;
              gx = g;
              gy = g;
            }
            // Never exactly zero: the shapes would collapse to a line and lose their size for good.
            const floor = (v: number) => (Math.abs(v) < 0.02 ? (v < 0 ? -0.02 : 0.02) : v);
            gx = floor(gx);
            gy = floor(gy);
            setTooltip(`${Math.round(Math.abs(start.w * gx))} × ${Math.round(Math.abs(start.h * gy))} px`);
            apply(
              { cx: start.cx, cy: start.cy, m: { a: gx, b: 0, c: 0, d: gy }, dx: 0, dy: 0 },
              { ...start, w: Math.abs(start.w * gx), h: Math.abs(start.h * gy) },
            );
          })
          .on('end', finish),
      );
    };
    resizer('.gtb-tl', -1, -1);
    resizer('.gtb-tr', 1, -1);
    resizer('.gtb-bl', -1, 1);
    resizer('.gtb-br', 1, 1);
    resizer('.gtb-t', 0, -1);
    resizer('.gtb-b', 0, 1);
    resizer('.gtb-l', -1, 0);
    resizer('.gtb-r', 1, 0);

    return () => {
      sel.on('touchstart mousedown', null).on('contextmenu', null);
    };
  }, [onOpenMenu]);

  const { w, h } = frame;
  const handle = (cls: string, x: number, y: number, cursor: string) => (
    <g className={`${cls} pointer-events-auto`} style={{ cursor, touchAction: 'none' }}>
      <rect x={x - 12} y={y - 12} width={24} height={24} fill="transparent" />
      <rect x={x - HANDLE / 2} y={y - HANDLE / 2} width={HANDLE} height={HANDLE} fill="#ffffff" stroke="#3b82f6" strokeWidth={1.5} />
    </g>
  );

  return (
    <g ref={gRef} className="transform-box pointer-events-auto" transform={`translate(${frame.cx}, ${frame.cy}) rotate(${frame.angle})`}>
      <rect
        className="gtb-bg pointer-events-auto"
        x={-w / 2} y={-h / 2} width={w} height={h}
        fill="rgba(59,130,246,0.04)"
        stroke="#3b82f6" strokeWidth={1} strokeDasharray="4 4"
        style={{ cursor: 'move', touchAction: 'none' }}
      />
      <line x1={0} y1={-h / 2} x2={0} y2={-h / 2 - ROTATE_DIST} stroke="#3b82f6" strokeWidth={1} />
      <g className="gtb-rotate pointer-events-auto" style={{ cursor: 'grab', touchAction: 'none' }}>
        <circle cx={0} cy={-h / 2 - ROTATE_DIST} r={15} fill="transparent" />
        <circle cx={0} cy={-h / 2 - ROTATE_DIST} r={5} fill="#ffffff" stroke="#3b82f6" strokeWidth={1.5} />
      </g>

      {handle('gtb-tl', -w / 2, -h / 2, 'nwse-resize')}
      {handle('gtb-tr', w / 2, -h / 2, 'nesw-resize')}
      {handle('gtb-bl', -w / 2, h / 2, 'nesw-resize')}
      {handle('gtb-br', w / 2, h / 2, 'nwse-resize')}
      {handle('gtb-t', 0, -h / 2, 'ns-resize')}
      {handle('gtb-b', 0, h / 2, 'ns-resize')}
      {handle('gtb-l', -w / 2, 0, 'ew-resize')}
      {handle('gtb-r', w / 2, 0, 'ew-resize')}

      {tooltip && (
        // Kept upright while the box turns.
        <g transform={`rotate(${-frame.angle}) translate(0, ${h / 2 + 40})`}>
          <rect x="-70" y="-20" width="140" height="32" rx="6" fill="#1e293b" />
          <text textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="16" fontWeight="bold" pointerEvents="none">
            {tooltip}
          </text>
        </g>
      )}

      {/* Menu: flip, rotate, order and delete for the whole selection. */}
      <g
        className="gtb-menu pointer-events-auto group"
        style={{ cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation();
          onOpenMenu(e.clientX, e.clientY);
        }}
        transform={`translate(${w / 2 + HANDLE + 20}, ${-h / 2 - HANDLE - 20})`}
      >
        <rect x="-16" y="-12" width="32" height="24" rx="6" className="fill-white dark:fill-slate-800 stroke-slate-200 dark:stroke-slate-700 transition-colors group-hover:stroke-blue-400" strokeWidth="1" />
        <circle cx="-6" cy="0" r="1.5" className="fill-slate-500 dark:fill-slate-400 group-hover:fill-blue-500" />
        <circle cx="0" cy="0" r="1.5" className="fill-slate-500 dark:fill-slate-400 group-hover:fill-blue-500" />
        <circle cx="6" cy="0" r="1.5" className="fill-slate-500 dark:fill-slate-400 group-hover:fill-blue-500" />
      </g>
    </g>
  );
};
