// lib/photoAnnotator/arrowGeometry.js
//
// The arrow shape "to point at something" — the one tool from the owner's
// brief ("shapes and items … arrow to point at something") that this fabric
// build has no built-in for. fabric.Line and fabric.Triangle exist, but a
// Line+Triangle fabric.Group needs its head kept a constant on-screen size
// while the user drags the shaft — fighting Group's default uniform scaling
// — or the arrowhead balloons into a giant triangle on a long drag. Simpler
// and more predictable (and closer to how Canva's own arrow shape behaves,
// which scales the whole glyph together): build ONE filled outline as a
// single SVG path, exactly like fabric's own Polygon-based shapes
// (addTriangle/addDiamond in the designer) are one object, not an assembly.
//
// Pure geometry — no fabric import, so scripts/check-job-photos.mjs can
// execute this and catch a degenerate/NaN path before it ever reaches a
// canvas. The path this returns is consumed as `new fabric.Path(d, {...})`
// in app/components/photoAnnotator/PhotoAnnotatorEditor.js, the one place in
// the annotator that's allowed to import "fabric" at all.
//
// Coordinate space: the tip sits at (length, 0); the tail is centred on the
// x-axis at x=0, spanning y=[-thickness/2, thickness/2]. Centring on y=0
// means fabric.Path's own bounding-box math places the object's rotation/
// scale origin at the shaft's visual centre, so rotating a placed arrow
// pivots around its middle the way Canva's shape rotation handle does, not
// around one end.

const round = (n) => Math.round(n * 100) / 100;

/**
 * @param {Object} [opts]
 * @param {number} [opts.length]    tip-to-tail length, in canvas units
 * @param {number} [opts.headLength] how far back from the tip the head's
 *                                    "shoulders" sit
 * @param {number} [opts.headWidth]  full width of the head at its shoulders
 * @param {number} [opts.thickness]  full width of the shaft
 * @returns {string} an SVG path `d` string — a single closed outline (shaft
 *   rectangle fused to a triangular head), suitable for `fill`, no `stroke`
 *   needed for the ink itself
 */
export function buildArrowPath({ length = 150, headLength = 36, headWidth = 28, thickness = 9 } = {}) {
  // Guard against a degenerate/hostile call (zero or negative length, a head
  // longer than the whole arrow) producing NaN or a self-intersecting path
  // rather than a small-but-valid arrow. Every dimension is clamped to a
  // sane positive minimum first.
  const safeThickness = Math.max(1, Number.isFinite(thickness) ? thickness : 1);
  const safeHeadWidth = Math.max(safeThickness + 2, Number.isFinite(headWidth) ? headWidth : safeThickness + 2);
  const safeHeadLength = Math.max(4, Number.isFinite(headLength) ? headLength : 4);
  const minLength = safeHeadLength + 4;
  const safeLength = Math.max(minLength, Number.isFinite(length) ? length : minLength);

  const shaftEnd = safeLength - safeHeadLength;
  const halfShaft = safeThickness / 2;
  const halfHead = safeHeadWidth / 2;

  const p = (x, y) => `${round(x)},${round(y)}`;

  return [
    `M ${p(0, -halfShaft)}`,
    `L ${p(shaftEnd, -halfShaft)}`,
    `L ${p(shaftEnd, -halfHead)}`,
    `L ${p(safeLength, 0)}`,
    `L ${p(shaftEnd, halfHead)}`,
    `L ${p(shaftEnd, halfShaft)}`,
    `L ${p(0, halfShaft)}`,
    "Z",
  ].join(" ");
}

/** The tip's coordinates within the path's own local space — the point a
 * caller would want to snap a rotation/drag handle to, without having to
 * re-derive it from the path string. Kept in sync with buildArrowPath's own
 * clamping so a caller never assumes an unclamped `length`. */
export function arrowTipPoint(opts) {
  const d = buildArrowPath(opts);
  // The 4th command (`L x,0`) is always the tip — see the path shape above.
  const match = d.match(/L ([-\d.]+),0 /);
  return match ? { x: Number(match[1]), y: 0 } : { x: 0, y: 0 };
}
