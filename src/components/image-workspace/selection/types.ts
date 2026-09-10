/**
 * Region selection primitives.
 *
 * Deliberately free of fabric and React: a shape is plain data in scene coordinates, so the same
 * definitions drive the canvas tools, the saved-shape list, and the raster operations. Anything
 * that needs a selection can depend on this file alone.
 */

export type SelectionToolId =
  | 'sel-rect' | 'sel-ellipse' | 'sel-pen' | 'sel-object' | 'sel-brush' | 'sel-erase';

export interface Point {
  x: number;
  y: number;
}

/**
 * Rectangle in scene units. `x/y/width/height` are always the UNROTATED box; `angle` is applied
 * about its centre at draw and hit-test time. Keeping rotation as a property rather than baking
 * it into coordinates is what lets the transform box stay glued to the shape after rotating.
 */
export interface RectSelection {
  kind: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees clockwise about the box centre. */
  angle?: number;
}

/** Ellipse described by its unrotated bounding box, in scene units. */
export interface EllipseSelection {
  kind: 'ellipse';
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees clockwise about the box centre. */
  angle?: number;
}

/**
 * Free-form polygon from the pen tool. `closed` is false while the user is still placing points;
 * only a closed path can become a selection.
 */
export interface PathSelection {
  kind: 'path';
  points: Point[];
  /**
   * Extra rings beyond the outer one, filled even-odd. An AI segmentation is rarely a single
   * loop - a hole through the subject, or two disjoint pieces of it, both land here, and even-odd
   * turns each into the right thing without the caller having to know which it was.
   */
  subpaths?: Point[][];
  closed: boolean;
  /** Degrees clockwise about the point cloud's centre. */
  angle?: number;
}

export type SelectionShape = RectSelection | EllipseSelection | PathSelection;

/** A shape the user chose to keep, listed in the Selections tab. */
export interface SavedSelection {
  id: string;
  name: string;
  shape: SelectionShape;
  createdAt: number;
}

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What to do with the pixels a selection covers. */
export type RegionFilter =
  | 'brightness' | 'contrast' | 'saturate' | 'grayscale' | 'invert' | 'blur' | 'sepia';

export type SelectionOperation =
  | { type: 'delete' }
  | { type: 'fill'; color: string }
  | { type: 'replace'; image: CanvasImageSource; fit: 'cover' | 'contain' | 'stretch' }
  /** Re-renders only the selected pixels through a filter. */
  | { type: 'filter'; filter: RegionFilter; value: number }
  /** Draws an already-rendered source through the selection, e.g. a filtered copy of the image. */
  | { type: 'composite'; source: CanvasImageSource };

export const isClosedShape = (shape: SelectionShape): boolean =>
  shape.kind === 'path' ? shape.closed && shape.points.length >= 3 : true;

/** Every ring of a path shape, outer first. Non-path shapes have none. */
export const pathRings = (shape: SelectionShape): Point[][] =>
  shape.kind === 'path' ? [shape.points, ...(shape.subpaths || [])] : [];
