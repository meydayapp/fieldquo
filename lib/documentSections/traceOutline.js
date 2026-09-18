// lib/documentSections/traceOutline.js
//
// The traced shape itself, drawn small on the document beside its area.
//
// ── Why a drawing when there is already a still ────────────────────────────
//
// A traced measurement already prints as a satellite still with the outline
// on it (lib/measure/measureImages.js measureEvidence) — when the still was
// captured. That capture is best-effort: no Cloudinary in local dev, a
// Static Maps key that was rotated, a timeout on save, and the document
// prints the caption alone. "Lawn measured: 1,850 sq ft" with nothing to
// show for it invites the first question on the call — "measured how?" —
// and the answer, the shape the homeowner drew, is on the takeoff the whole
// time. So the outline is drawn from the vertices directly: pure geometry,
// no key, no network, cannot fail to print. When the still IS there the
// drawing sits beside the caption anyway, so a quote traced in June and one
// traced in December look the same.
//
// ── One projection, two renderers ──────────────────────────────────────────
//
// This file is pure and imports nothing from @react-pdf, so the public quote
// page (HTML) and the PDF section share the numbers and draw them with their
// own <svg> / <Svg>. lib/email/quoteSections.js keeps out of it for the same
// reason ClientInfoSection split: the email has no picture to hang a caption
// on and an inline SVG is not something every mail client renders.
//
// ── Where a takeoff keeps its outline ──────────────────────────────────────
//
//   takeoff.lawn.vertices     lawn care, lawn mowing, the builder's tracer
//   takeoff.traced.vertices   paving (a driveway is never filed under `lawn`)
//
// Both are `{ lat, lng }` lists (lib/estimate/tracedArea.js normalisePolygon,
// app/components/quotes/builder/LotAreaMeasure.js canvasShapeToLatLng).
// Nothing else on the takeoff is read here — a countertop takeoff carries
// supplier cost and markup, and this is a projection that reaches a client.

/** The box the outline is fitted into, in document units. */
export const TRACE_OUTLINE_W = 72;
export const TRACE_OUTLINE_H = 48;
const PAD = 3;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** The vertex list a takeoff carries, or []. */
export function traceVerticesOf(takeoff) {
  const list = takeoff?.traced?.vertices ?? takeoff?.lawn?.vertices;
  if (!Array.isArray(list)) return [];
  return list
    .map((p) => ({ lat: num(p?.lat), lng: num(p?.lng) }))
    .filter((p) => p.lat !== null && p.lng !== null)
    .slice(0, 200);
}

/**
 * The outline as points in a W×H box, or null under three vertices.
 *
 * An equirectangular projection about the shape's own centre: x scales by
 * cos(lat) so a square driveway in Ottawa is drawn square, not 1.4× wide;
 * y is flipped so north is up. Fitted to the box preserving aspect, padded,
 * rounded to a tenth of a unit — the shape is the point, not the survey.
 *
 * @returns {{ points: number[][], pointsAttr: string, width: number, height: number } | null}
 */
export function traceOutline(takeoff) {
  const pts = traceVerticesOf(takeoff);
  if (pts.length < 3) return null;

  const lat0 = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const cos = Math.cos((lat0 * Math.PI) / 180) || 1;
  const xy = pts.map((p) => [p.lng * cos, -p.lat]);

  const xs = xy.map((p) => p[0]);
  const ys = xy.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  if (!(spanX > 0) || !(spanY > 0)) return null; // a line, not an area

  const innerW = TRACE_OUTLINE_W - PAD * 2;
  const innerH = TRACE_OUTLINE_H - PAD * 2;
  const scale = Math.min(innerW / spanX, innerH / spanY);
  const drawnW = spanX * scale;
  const drawnH = spanY * scale;
  const offX = PAD + (innerW - drawnW) / 2;
  const offY = PAD + (innerH - drawnH) / 2;

  const points = xy.map(([x, y]) => [
    Math.round((offX + (x - minX) * scale) * 10) / 10,
    Math.round((offY + (y - minY) * scale) * 10) / 10,
  ]);
  return {
    points,
    pointsAttr: points.map((p) => `${p[0]},${p[1]}`).join(" "),
    width: TRACE_OUTLINE_W,
    height: TRACE_OUTLINE_H,
  };
}
