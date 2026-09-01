// lib/photoAnnotator/constants.js
//
// Pure data for the job-photo annotator — no fabric, no DOM. Mirrors the
// split lib/designer/constants.js already made (see that file's own header):
// keeping the tool/brush/colour tables fabric-free is what lets
// scripts/check-job-photos.mjs execute against them under plain Node.
//
// ── Why this is a SEPARATE table from lib/designer/constants.js ────────────
//
// The marketing designer's FILL_COLOR/STROKE_COLOR/STROKE_WIDTH etc. are
// tuned for a graphic-design canvas: thin 2px default strokes, a picker built
// from material-colors' 500-weight swatches. A markup tool on a job-site
// photo needs the opposite defaults — thick enough to be visible on a phone
// photo of a stucco wall, high-contrast colours (real red, real yellow, not
// material-design's slightly-muted 500 shades), and exactly four brushes
// instead of a generic stroke-width slider. Sharing the table would mean
// either the designer inherits "highlighter yellow" as a shape-fill option,
// or the annotator inherits a 2px default nobody could see on a truck door.

/** @typedef {"select"|"pencil"|"pen"|"marker"|"highlighter"|"text"|"arrow"|"rectangle"|"ellipse"} AnnotatorTool */

export const TOOLS = {
  SELECT: "select",
  PENCIL: "pencil",
  PEN: "pen",
  MARKER: "marker",
  HIGHLIGHTER: "highlighter",
  TEXT: "text",
  ARROW: "arrow",
  RECTANGLE: "rectangle",
  ELLIPSE: "ellipse",
};

/** The four "Pen / marker / pencil" brushes the owner asked for, "identical
 * to Apple" — plus a highlighter, which iOS Markup also ships as a distinct
 * tool from its pens. All four ride the same fabric.PencilBrush (the only
 * brush in this fabric build suited to a smooth continuous line — see
 * DrawSidebar.js's sibling in the designer, and docs/PHOTO-ANNOTATION.md for
 * why CircleBrush/SprayBrush were not options); what makes them feel
 * different is width, opacity, and compositing, set on the brush before each
 * stroke starts.
 *
 * `composite` is a canvas globalCompositeOperation. "multiply" is what makes
 * the highlighter behave like a real one — it darkens whatever's under it
 * rather than painting an opaque band over it, so text or detail under a
 * highlight stroke stays legible, the same way a felt-tip highlighter works
 * on paper.
 *
 * `haloExtra` is how many extra pixels of width the halo behind the ink gets
 * — see lib/photoAnnotator/contrast.js. The highlighter's is deliberately
 * small: a thick opaque outline around a translucent highlight band would
 * read as a solid box, defeating the point of a highlighter. */
export const BRUSHES = {
  [TOOLS.PENCIL]: { width: 3, opacity: 1, composite: "source-over", haloExtra: 3 },
  [TOOLS.PEN]: { width: 6, opacity: 1, composite: "source-over", haloExtra: 4 },
  [TOOLS.MARKER]: { width: 14, opacity: 0.92, composite: "source-over", haloExtra: 5 },
  [TOOLS.HIGHLIGHTER]: { width: 24, opacity: 0.38, composite: "multiply", haloExtra: 2 },
};

/** High-saturation, high-value colours chosen to be visible against real job
 * photos (brick, drywall, wood, stucco, sky) — not material-colors' muted
 * 500-weight set, which the marketing designer's ColorPicker already uses
 * for a different job (matching a company's brand palette). White and black
 * are both included on purpose: white ink reads on a dark garage interior
 * that red or yellow would wash out on, and black reads on a bright white
 * wall that yellow disappears into. */
export const ANNOTATION_COLORS = [
  "#ff3b30", // Apple system red
  "#ff9500", // orange
  "#ffcc00", // yellow
  "#34c759", // green
  "#0a84ff", // blue
  "#af52de", // purple
  "#ffffff",
  "#111111",
];

export const DEFAULT_INK_COLOR = ANNOTATION_COLORS[0];

/** @see lib/photoAnnotator/arrowGeometry.js#buildArrowPath — these are its
 * default args, kept here so the toolbar and the geometry function agree on
 * what "an arrow, unscaled" looks like without importing from each other. */
export const ARROW_DEFAULTS = { length: 150, headLength: 36, headWidth: 28, thickness: 9 };

export const TEXT_DEFAULTS = { fontSize: 34, fontFamily: "Arial", fontWeight: 700 };

/** Shape stroke width for rectangle/ellipse — thicker than the designer's
 * STROKE_WIDTH (2) for the same "visible on a phone photo" reason as the
 * brushes above. */
export const SHAPE_STROKE_WIDTH = 6;

export { ANNOTATOR_MAX_WIDTH, MAX_ANNOTATION_JSON_BYTES, MAX_ANNOTATION_OBJECTS } from "@/lib/jobs/photoAnnotation";
