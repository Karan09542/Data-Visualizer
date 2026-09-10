/**
 * Keeping artboards from overlapping when one of them changes size.
 *
 * Boards sit in a row with a fixed gap, but each stores an absolute x. Growing one therefore ran
 * it straight into its neighbour. This works out where every affected neighbour should go so the
 * gap on either side of the resized board stays what it was - growing pushes neighbours out,
 * shrinking pulls them back in.
 *
 * Pure: geometry in, target positions out. The caller moves the boards and their objects.
 */

export interface BoardGeom {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Board extends BoardGeom {
  id: string;
}

/** Boards within this distance of an edge still count as lying beyond it. */
const EDGE_TOLERANCE = 0.5;

/**
 * Returns the new position of every board that has to move, keyed by id.
 *
 * `previous` is the geometry as it was last observed and `boards` is the current state. Only a
 * change of width or height triggers a reflow; a board that merely moved leaves its neighbours
 * alone, since otherwise dragging one board would shove the rest of the row along with it.
 *
 * Targets are measured from where each neighbour was last *seen*, not from where it is now. When a
 * whole-state snapshot is restored by undo, the neighbours arrive already put back at their old
 * places while the resized board shrinks at the same moment; building on the observed position
 * brings them home exactly once instead of pulling them back a second time.
 */
export const computeArtboardReflow = (
  previous: Map<string, BoardGeom>,
  boards: Board[]
): Map<string, { x: number; y: number }> => {
  const shifts = new Map<string, { dx: number; dy: number }>();

  for (const board of boards) {
    const old = previous.get(board.id);
    if (!old) continue;
    if (old.width === board.width && old.height === board.height) continue;

    const deltaRight = (board.x + board.width) - (old.x + old.width);
    const deltaBottom = (board.y + board.height) - (old.y + old.height);
    if (!deltaRight && !deltaBottom) continue;

    for (const other of boards) {
      if (other.id === board.id) continue;
      const seen = previous.get(other.id);
      // A board that has only just appeared has no layout of its own to preserve yet.
      if (!seen) continue;

      const sameRow = seen.y < old.y + old.height && seen.y + seen.height > old.y;
      const sameColumn = seen.x < old.x + old.width && seen.x + seen.width > old.x;
      const toTheRight = seen.x >= old.x + old.width - EDGE_TOLERANCE;
      const below = seen.y >= old.y + old.height - EDGE_TOLERANCE;

      const shift = shifts.get(other.id) || { dx: 0, dy: 0 };
      if (deltaRight && sameRow && toTheRight) shift.dx += deltaRight;
      if (deltaBottom && sameColumn && below) shift.dy += deltaBottom;
      if (shift.dx || shift.dy) shifts.set(other.id, shift);
    }
  }

  const targets = new Map<string, { x: number; y: number }>();
  shifts.forEach((shift, id) => {
    const seen = previous.get(id)!;
    targets.set(id, { x: seen.x + shift.dx, y: seen.y + shift.dy });
  });
  return targets;
};
