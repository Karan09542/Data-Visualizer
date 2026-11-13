/**
 * Cutting shapes to the 3D view's box, for export: what is saved matches what shows,
 * and a surface that runs off to infinity doesn't become a model miles across.
 */

/**
 * A polygon (corners as [x, y, z, …extra], extra such as a colour carried along)
 * cut to the box lo–hi, plane by plane.
 */
export function clipToBox(poly: number[][], lo: number[], hi: number[]): number[][] {
  let out = poly;
  for (let axis = 0; axis < 3 && out.length; axis++) {
    for (const side of [0, 1]) {
      const inside = (p: number[]) => (side ? hi[axis] - p[axis] : p[axis] - lo[axis]);
      const next: number[][] = [];
      for (let i = 0; i < out.length; i++) {
        const a = out[i];
        const b = out[(i + 1) % out.length];
        const da = inside(a);
        const db = inside(b);
        if (da >= 0) next.push(a);
        if (da >= 0 !== db >= 0) {
          const t = da / (da - db);
          next.push(a.map((v, k) => v + (b[k] - v) * t));
        }
      }
      out = next;
      if (!out.length) break;
    }
  }
  return out;
}

/** A segment cut to the box, or null if none of it is inside. */
export function clipSegmentToBox(a: number[], b: number[], lo: number[], hi: number[]): [number[], number[]] | null {
  let t0 = 0;
  let t1 = 1;
  for (let k = 0; k < 3; k++) {
    const d = b[k] - a[k];
    for (const [edge, sign] of [[lo[k], 1], [hi[k], -1]] as const) {
      const num = sign * (a[k] - edge);
      const den = sign * d;
      if (den === 0) {
        if (num < 0) return null;
      } else {
        const t = -num / den;
        if (den > 0) t0 = Math.max(t0, t);
        else t1 = Math.min(t1, t);
      }
    }
  }
  if (t0 > t1) return null;
  const at = (t: number) => a.map((v, k) => v + (b[k] - v) * t);
  return [at(t0), at(t1)];
}
