import { createLucideIcon } from "lucide-react";

/**
 * Icons for the 3D drawing tools, drawn like the textbook figures they make.
 * Built as lucide icons so they match the rest of the toolbar (and the help guide).
 */

/** A plane in perspective, with the triangle of three points it passes through. */
export const PlaneIcon = createLucideIcon("plane-3-points", [
  ["path", { d: "M2 19 7 6h15l-5 13Z", key: "plane" }],
  ["path", { d: "M7.5 15.5 13 9.5l3 6Z", key: "points" }],
]);

/** A point above a plane (seen edge-on), the perpendicular dropped to it, and the right angle at the foot. */
export const FootIcon = createLucideIcon("perpendicular-foot", [
  ["path", { d: "M2 20h20", key: "plane" }],
  ["circle", { cx: "12", cy: "4", r: "1.5", key: "point" }],
  ["path", { d: "M12 5.5V20", key: "drop" }],
  ["path", { d: "M12 15.5h4.5V20", key: "right-angle" }],
]);

/** Two planes meeting along an edge, with the angle between them. */
export const DihedralIcon = createLucideIcon("dihedral-angle", [
  ["path", { d: "M3 21h14l4-5H7Z", key: "floor" }],
  ["path", { d: "M3 21 9 7l4-5-6 14", key: "wall" }],
  ["path", { d: "M10.5 21A7.5 7.5 0 0 0 6 14.1", key: "arc" }],
]);

/** A line passing through a plane, with the point where they meet. */
export const LinePlaneIcon = createLucideIcon("line-meets-plane", [
  ["path", { d: "M2 17 7 10h15l-5 7Z", key: "plane" }],
  ["path", { d: "M9 2l2.7 9.6", key: "line-above" }],
  ["path", { d: "M12.9 15.6 15 23", key: "line-below" }],
  ["circle", { cx: "12.3", cy: "13.6", r: "1.6", key: "meet" }],
]);

/** Two lines that never meet, and the shortest distance between them. */
export const SkewLinesIcon = createLucideIcon("skew-lines-distance", [
  ["path", { d: "M2 8 22 3", key: "line-1" }],
  ["path", { d: "M2 16l20 5", key: "line-2" }],
  ["path", { d: "M12 7.5v9", key: "gap" }],
  ["path", { d: "m10.5 9 1.5-1.5 1.5 1.5", key: "head-1" }],
  ["path", { d: "m10.5 15 1.5 1.5 1.5-1.5", key: "head-2" }],
]);
