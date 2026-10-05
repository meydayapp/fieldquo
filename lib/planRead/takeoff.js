// lib/planRead/takeoff.js
//
// The first pass's TAKEOFF, in code: the measurement pass's boxes and printed
// figures (lib/planRead/measurePrompts.js) → faces, rooms and heights with
// lengths, areas and working heights, each with its source sheet, the
// dimensions or scale used, a confidence, and the sentence a person would
// check.
//
// ══ Scaling, as an estimator does it ═══════════════════════════════════════
//
// A sheet's paper is known from the PDF itself (`pointsWidth`/`pointsHeight`,
// 1/72 in — lib/planRead/ingest.js), and its scale from the title block or
// the view's own label (lib/planRead/dimensions.js parseScale). A face that
// spans 0.40 of an A3 sheet's 420 mm at 1:100 is 0.40 × 420 × 100 = 16.8 m.
// Nothing here trusts a length the model wrote; it trusts where the model
// says the face IS, and the paper and the scale.
//
// ══ Printed wins, and checks the scale ═════════════════════════════════════
//
// A printed dimension (an extracted id, or a figure read off a scan) or a
// printed area ("135.22 sq.m") is used as printed. Where a view has both a
// printed figure and the box it measures, the two are compared: within 20%,
// the ratio CALIBRATES every scaled figure on that view (the model's boxes are
// a little loose; the printed figure is not); beyond it, nothing is
// calibrated and every scaled figure on the view drops to low confidence with
// the disagreement said — a wrong scale or a mislabelled box, which a person
// must look at.
//
// ══ Confidence ════════════════════════════════════════════════════════════
//
//   high     every figure printed (dimensions or a printed area)
//   medium   scaled on a vector sheet at a printed scale — calibrated, or with
//            nothing printed on the view to check it against
//   low      scaled on a scan, at a scale only the model read, against a
//            calibration that failed, or resting on an assumed height
//
// Pure.

import { findDimensions, parseScale, FEET_PER_METRE, SQFT_PER_M2 } from "./dimensions";
import { HEIGHT_BANDS, bandShares } from "@/lib/pricing/paintHeightPrep";
import { sheetKind } from "./sheetKinds";

export const CALIBRATION_TOLERANCE = 0.2;
/** A storey height assumed when nothing on the set states one — said on the line. */
export const DEFAULT_STOREY_M = 3.0;
export const DEFAULT_STOREY_FT = 9;
const MAX_FACES = 40;
const MAX_HEIGHTS = 20;
const MAX_VIEWS = 8;

const r = (n, dp = 0) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};
const text = (s, max = 160) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");
const nullable = (s, max) => text(s, max) || null;

// ═══════════════════════════════════════════════════════════════════════════
// WHAT THE MODEL RETURNED → what is stored on the sheet
// ═══════════════════════════════════════════════════════════════════════════

/** [left, top, right, bottom] as fractions, ordered and clamped — or null. */
export function cleanBox(box) {
  if (!Array.isArray(box) || box.length !== 4) return null;
  const v = box.map((n) => Number(n));
  if (!v.every((n) => Number.isFinite(n))) return null;
  const c = (n) => Math.min(1, Math.max(0, n));
  const x0 = c(Math.min(v[0], v[2]));
  const x1 = c(Math.max(v[0], v[2]));
  const y0 = c(Math.min(v[1], v[3]));
  const y1 = c(Math.max(v[1], v[3]));
  if (x1 - x0 < 0.002 && y1 - y0 < 0.002) return null;
  return [r(x0, 4), r(y0, 4), r(x1, 4), r(y1, 4)];
}

const FACE_KINDS = ["wall_face", "gable", "tower", "room", "ceiling", "other"];
const HEIGHT_KINDS = ["eaves", "ridge", "ceiling", "storey", "wall_plate", "parapet", "tower", "other"];
const SHEET_TYPES = ["elevation", "plan", "section", "site", "schedule", "photo", "detail", "cover", "other"];

/**
 * The measurement pass's JSON → what is stored on the sheet as `measure`.
 * Copies fields by name; a dimension id the sheet does not have is dropped,
 * never trusted. Pure.
 */
export function sanitiseMeasure(raw, facts, { now = null } = {}) {
  const dimIds = new Set([...(facts?.dims || []), ...(facts?.scanDims || [])].map((d) => d.id));
  const ref = (id) => (typeof id === "string" && dimIds.has(id) ? id : null);
  const views = [];
  for (const v of Array.isArray(raw?.views) ? raw.views : []) {
    if (views.length >= MAX_VIEWS) break;
    const id = text(v?.id, 12);
    if (!id || views.some((x) => x.id === id)) continue;
    const groundY = Number(v.groundY);
    views.push({
      id,
      title: text(v.title, 120),
      viewType: ["elevation", "plan", "section", "other"].includes(v.viewType) ? v.viewType : "other",
      side: v.side === "interior" ? "interior" : "exterior",
      scaleText: nullable(v.scaleText, 40),
      box: cleanBox(v.box),
      groundY: Number.isFinite(groundY) && groundY >= 0 && groundY <= 1 ? r(groundY, 4) : null,
    });
  }
  const viewIds = new Set(views.map((v) => v.id));
  const viewOf = (id) => (typeof id === "string" && viewIds.has(id) ? id : views[0]?.id || null);
  const faces = [];
  for (const f of Array.isArray(raw?.faces) ? raw.faces : []) {
    if (faces.length >= MAX_FACES) break;
    const id = text(f?.id, 12);
    const box = cleanBox(f?.box);
    if (!id || faces.some((x) => x.id === id) || (!box && !ref(f?.lengthDimRef) && !f?.printedAreaText)) continue;
    const share = Number(f.openingsShare);
    faces.push({
      id,
      viewId: viewOf(f.viewId),
      name: text(f.name, 80) || id,
      kind: FACE_KINDS.includes(f.kind) ? f.kind : "other",
      side: f.side === "interior" ? "interior" : "exterior",
      box,
      shape: f.shape === "triangle" ? "triangle" : "rectangle",
      lengthDimRef: ref(f.lengthDimRef),
      heightDimRef: ref(f.heightDimRef),
      lengthText: nullable(f.lengthText, 40),
      heightText: nullable(f.heightText, 40),
      printedAreaText: nullable(f.printedAreaText, 60),
      openingsShare: Number.isFinite(share) && share >= 0 && share <= 0.9 ? r(share, 3) : null,
      openingsBasis: nullable(f.openingsBasis, 160),
      material: nullable(f.material, 40),
      note: nullable(f.note, 200),
    });
  }
  const heights = [];
  for (const h of Array.isArray(raw?.heights) ? raw.heights : []) {
    if (heights.length >= MAX_HEIGHTS) break;
    const id = text(h?.id, 12);
    const box = cleanBox(h?.box);
    if (!id || heights.some((x) => x.id === id) || (!box && !ref(h?.dimRef) && !h?.text)) continue;
    heights.push({
      id,
      viewId: viewOf(h.viewId),
      label: text(h.label, 80) || id,
      kind: HEIGHT_KINDS.includes(h.kind) ? h.kind : "other",
      box,
      dimRef: ref(h.dimRef),
      text: nullable(h.text, 40),
    });
  }
  return {
    sheetType: SHEET_TYPES.includes(raw?.sheetType) ? raw.sheetType : "other",
    reason: text(raw?.sheetTypeReason, 200),
    views,
    faces,
    heights,
    ...(now ? { at: now } : {}),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PRINTED AREAS
// ═══════════════════════════════════════════════════════════════════════════

const AREA = /(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(sq\.?\s*m(?:etres?|eters?)?\.?|square\s+met(?:re|er)s?|m2|m²|sqm|sq\.?\s*f(?:ee)?t\.?|square\s+f(?:ee|oo)t|ft2|ft²|sf)(?![a-z])/gi;

/** Every area printed in a piece of text, in m². Pure. */
export function printedAreasIn(raw) {
  const s = String(raw || "").replace(/\s+/g, " ");
  const out = [];
  for (const m of s.matchAll(AREA)) {
    const n = Number(m[1].replace(/,/g, ""));
    if (!(n > 0) || n > 1_000_000) continue;
    const metric = /m/i.test(m[2]) && !/f/i.test(m[2]);
    out.push({ text: m[0].trim(), m2: r(metric ? n : n / SQFT_PER_M2, 2), system: metric ? "metric" : "imperial" });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// SCALING ONE SHEET
// ═══════════════════════════════════════════════════════════════════════════

/** The paper, in millimetres, from the PDF page size. Null without one. */
export function paperMm(sheet) {
  const w = Number(sheet?.pointsWidth);
  const h = Number(sheet?.pointsHeight);
  if (!(w > 0) || !(h > 0)) return null;
  return { w: (w / 72) * 25.4, h: (h / 72) * 25.4 };
}

const ISO = [
  ["A0", 1189, 841],
  ["A1", 841, 594],
  ["A2", 594, 420],
  ["A3", 420, 297],
  ["A4", 297, 210],
  ["ANSI D", 864, 559],
  ["ARCH D", 914, 610],
  ["ANSI B", 432, 279],
];
/** "A3" for a 420 × 297 mm page — only to make the sentence readable. */
function paperName(p) {
  if (!p) return null;
  const [a, b] = [Math.max(p.w, p.h), Math.min(p.w, p.h)];
  const hit = ISO.find(([, w, h]) => Math.abs(w - a) < 6 && Math.abs(h - b) < 6);
  return hit ? hit[0] : `${Math.round(p.w)} × ${Math.round(p.h)} mm`;
}

/** A printed figure (an extracted id, or text read off the sheet) in metres. */
function printedMetres(dimRef, raw, dims, metric) {
  const d = dimRef ? dims.get(dimRef) : null;
  if (d && Number(d.metres) > 0) return { m: Number(d.metres), raw: d.raw, fromScan: Boolean(d.fromScan), unitAssumed: Boolean(d.unitAssumed) };
  if (raw) {
    const found = findDimensions(raw, { metric })[0] || null;
    if (found && found.metres > 0) return { m: found.metres, raw: found.raw, fromScan: true, unitAssumed: Boolean(found.unitAssumed) };
  }
  return null;
}

function scaleFor(view, sheet) {
  const own = view?.scaleText ? parseScale(view.scaleText) : null;
  if (own && !own.nts && own.ratio) return { ratio: own.ratio, text: own.text, from: "view" };
  if (own?.nts) return { ratio: null, text: "NTS", from: "view", nts: true };
  const s = sheet?.scale;
  if (s && !s.nts && s.ratio) return { ratio: s.ratio, text: s.text, from: "title block" };
  if (s?.nts) return { ratio: null, text: "NTS", from: "title block", nts: true };
  return { ratio: null, text: null, from: null };
}

const median = (xs) => {
  const v = xs.slice().sort((a, b) => a - b);
  return v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null;
};
const fmtM = (m) => `${r(m, 2)} m`;
const fmtFt = (ft) => `${r(ft, 1)} ft`;
const fmtSqft = (v) => `${Math.round(v).toLocaleString("en-US")} sq ft`;

/**
 * One sheet's faces and heights, measured. Pure.
 * @param sheet  the stored sheet (facts + `measure`)
 * @param dims   buildDimIndex() over the read's sheets
 */
export function sheetTakeoff(sheet, dims = new Map()) {
  const m = sheet?.measure;
  if (!m || m.failed) return { faces: [], heights: [] };
  const name = sheet.sheetNumber || `Page ${sheet.page}`;
  const sheetLabel = sheet.title ? `${name} · ${sheet.title}` : name;
  const paper = paperMm(sheet);
  const metric = sheet.scale?.system === "metric" || /\d\s*:\s*\d/.test(String(sheet.scale?.text || ""));
  const scan = sheet.vector === false;
  const views = new Map((m.views || []).map((v) => [v.id, v]));

  // ── Scale each item, before calibration ──
  const scaled = (box, axis, view) => {
    if (!box || !paper) return null;
    const sc = scaleFor(view, sheet);
    if (!sc.ratio) return null;
    const frac = axis === "x" ? box[2] - box[0] : box[3] - box[1];
    const paperSpan = axis === "x" ? paper.w : paper.h;
    if (!(frac > 0)) return null;
    return { m: (frac * paperSpan * sc.ratio) / 1000, frac, paperSpan, scale: sc };
  };
  const items = [];
  for (const f of m.faces || []) {
    const view = views.get(f.viewId) || null;
    const isRoom = f.kind === "room" || f.kind === "ceiling" || view?.viewType === "plan";
    items.push({
      type: "face",
      f,
      view,
      isRoom,
      len: { printed: printedMetres(f.lengthDimRef, f.lengthText, dims, metric), scaled: scaled(f.box, "x", view) },
      hgt: { printed: printedMetres(f.heightDimRef, f.heightText, dims, metric), scaled: scaled(f.box, "y", view) },
      area: f.printedAreaText ? printedAreasIn(f.printedAreaText)[0] || null : null,
    });
  }
  for (const h of m.heights || []) {
    const view = views.get(h.viewId) || null;
    items.push({ type: "height", h, view, hgt: { printed: printedMetres(h.dimRef, h.text, dims, metric), scaled: scaled(h.box, "y", view) } });
  }

  // ── Calibration per view: printed ÷ scaled, where both exist ──
  const cal = new Map();
  for (const viewId of new Set(items.map((i) => i.view?.id || null))) {
    const ratios = [];
    for (const it of items.filter((x) => (x.view?.id || null) === viewId)) {
      for (const k of ["len", "hgt"]) {
        const p = it[k]?.printed;
        const s = it[k]?.scaled;
        if (p && s && s.m > 0) ratios.push({ k: p.m / s.m, raw: p.raw });
      }
    }
    if (!ratios.length) {
      cal.set(viewId, { k: 1, state: "none" });
      continue;
    }
    const k = median(ratios.map((x) => x.k));
    const ok = Math.abs(k - 1) <= CALIBRATION_TOLERANCE;
    cal.set(viewId, { k: ok ? k : 1, state: ok ? "calibrated" : "disagrees", raw: ratios[0].raw, off: r((k - 1) * 100) });
  }

  const pick = (part, c) => {
    if (part.printed) return { m: part.printed.m, how: "printed", raw: part.printed.raw, low: part.printed.fromScan || part.printed.unitAssumed };
    if (part.scaled) return { m: part.scaled.m * c.k, how: "scaled", s: part.scaled, low: scan || c.state === "disagrees" || part.scaled.scale.from === "view" && !sheet.scale?.ratio };
    return null;
  };
  const scaledWords = (p, c, axis) => {
    const s = p.s;
    const pct = Math.round(s.frac * 1000) / 10;
    const paperWord = paperName(paper);
    let w = `scaled at ${s.scale.text}: ${pct}% of the ${paperWord} sheet's ${Math.round(s.paperSpan)} mm ${axis === "x" ? "width" : "height"}`;
    if (c.state === "calibrated" && Math.abs(c.k - 1) > 0.005) w += `, calibrated ×${r(c.k, 3)} against the printed “${c.raw}”`;
    if (c.state === "disagrees") w += ` — the printed “${c.raw}” on this view disagrees with the scale by ${c.off}%, check it`;
    return w;
  };
  const partWords = (p, c, axis) => (p.how === "printed" ? `printed “${p.raw}”` : scaledWords(p, c, axis));

  const faces = [];
  for (const it of items.filter((x) => x.type === "face")) {
    const { f, view } = it;
    const c = cal.get(view?.id || null) || { k: 1, state: "none" };
    const L = pick(it.len, c);
    const H = pick(it.hgt, c);
    const id = `${sheet.key}.${f.id}`;
    const where = `${sheetLabel}${view?.title ? ` · ${view.title}` : ""} — ${f.name}`;
    const base = { id, sheetKey: sheet.key, sheet: name, view: view?.title || null, name: f.name, kind: f.kind, side: f.side, material: f.material, note: f.note, box: f.box };
    if (it.isRoom) {
      // A room: its floor area (printed wins) and its perimeter.
      const W = H; // on a plan the box's vertical extent is the room's other side
      const printedArea = it.area;
      const floorM2 = printedArea ? printedArea.m2 : L && W ? L.m * W.m : null;
      const perimM = L && W ? 2 * (L.m + W.m) : null;
      if (!floorM2 && !perimM) {
        faces.push({ ...base, room: true, measured: false, confidence: "none", sentence: `${where}: no scale or printed size to measure it by — measure it on the sheet`, check: null });
        continue;
      }
      // Two figures, two confidences: a PRINTED area is the architect's own
      // number whatever the box says; the perimeter is only ever as good as
      // the sides it comes from.
      const lows = [L, W].filter(Boolean).some((p) => p.low);
      const sidesPrinted = L?.how === "printed" && W?.how === "printed" && !lows;
      const perimeterConfidence = sidesPrinted ? "high" : lows ? "low" : "medium";
      const confidence = printedArea ? "high" : perimeterConfidence;
      const parts = [];
      if (printedArea) parts.push(`floor area printed “${printedArea.text}” = ${fmtSqft(printedArea.m2 * SQFT_PER_M2)}`);
      else if (L && W) parts.push(`${fmtM(L.m)} (${partWords(L, c, "x")}) × ${fmtM(W.m)} (${partWords(W, c, "y")}) = ${fmtSqft(L.m * W.m * SQFT_PER_M2)} floor`);
      if (perimM) parts.push(`perimeter 2 × (${fmtM(L.m)} + ${fmtM(W.m)}) = ${fmtFt(perimM * FEET_PER_METRE)}${printedArea ? ` (scaled)` : ""}`);
      faces.push({
        ...base,
        room: true,
        measured: true,
        lengthFt: L ? r(L.m * FEET_PER_METRE, 2) : null,
        widthFt: W ? r(W.m * FEET_PER_METRE, 2) : null,
        floorSqft: floorM2 ? r(floorM2 * SQFT_PER_M2) : null,
        perimeterFt: perimM ? r(perimM * FEET_PER_METRE, 1) : null,
        heightFt: null,
        openingsShare: f.openingsShare,
        confidence,
        perimeterConfidence,
        sentence: `${where}: ${parts.join("; ")}`,
        check: L?.how === "scaled" ? `the room's ${fmtM(L.m)} side on ${name}` : null,
      });
      continue;
    }
    // A wall face on an elevation or a section.
    if (!L || !H) {
      faces.push({ ...base, room: false, measured: false, confidence: "none", sentence: `${where}: ${!L ? "no length" : "no height"} could be measured (no scale and nothing printed) — measure it on the sheet`, check: null });
      continue;
    }
    const triangle = f.shape === "triangle";
    const grossM2 = L.m * H.m * (triangle ? 0.5 : 1);
    const open = f.openingsShare ?? 0;
    const netM2 = grossM2 * (1 - open);
    // The face's base above the ground line, from the view's ground line —
    // a gable sits on the eaves, a tower's upper stage on its lower one.
    let bottomM = 0;
    let bottomSaid = "from the ground";
    if (view?.groundY !== null && view?.groundY !== undefined && f.box && paper) {
      const sc = scaleFor(view, sheet);
      if (sc.ratio) {
        bottomM = Math.max(0, ((view.groundY - f.box[3]) * paper.h * sc.ratio * c.k) / 1000);
        bottomSaid = bottomM > 0.3 ? `starting ${fmtM(bottomM)} above the ground line` : "from the ground";
      }
    }
    const lows = L.low || H.low;
    const confidence = L.how === "printed" && H.how === "printed" && !lows ? "high" : lows ? "low" : "medium";
    const openWords = f.openingsShare === null ? "no openings deducted (none judged)" : `less ${Math.round(open * 100)}% windows and doors (${f.openingsBasis || "judged from the drawing"})`;
    faces.push({
      ...base,
      room: false,
      measured: true,
      lengthFt: r(L.m * FEET_PER_METRE, 2),
      heightFt: r(H.m * FEET_PER_METRE, 2),
      bottomFt: r(bottomM * FEET_PER_METRE, 2),
      topFt: r((bottomM + H.m) * FEET_PER_METRE, 2),
      shape: triangle ? "triangle" : "rectangle",
      grossSqft: r(grossM2 * SQFT_PER_M2),
      netSqft: r(netM2 * SQFT_PER_M2),
      openingsShare: f.openingsShare,
      confidence,
      sentence: `${where}: ${fmtM(L.m)} long (${partWords(L, c, "x")}) × ${fmtM(H.m)} high (${partWords(H, c, "y")})${triangle ? " × ½ (gable)" : ""} = ${r(grossM2, 1)} m² (${fmtSqft(grossM2 * SQFT_PER_M2)}), ${openWords} = ${fmtSqft(netM2 * SQFT_PER_M2)}; ${bottomSaid}`,
      check:
        L.how === "scaled" && H.how === "scaled"
          ? `the ${fmtM(L.m)} length and ${fmtM(H.m)} height on ${name}`
          : L.how === "scaled"
            ? `the ${fmtM(L.m)} length on ${name}`
            : H.how === "scaled"
              ? `the ${fmtM(H.m)} height on ${name}`
              : null,
    });
  }

  const heights = [];
  for (const it of items.filter((x) => x.type === "height")) {
    const { h, view } = it;
    const c = cal.get(view?.id || null) || { k: 1, state: "none" };
    const H = pick(it.hgt, c);
    const id = `${sheet.key}.${h.id}`;
    if (!H) {
      heights.push({ id, sheetKey: sheet.key, sheet: name, label: h.label, kind: h.kind, measured: false, confidence: "none", sentence: `${sheetLabel} — ${h.label}: not measurable (no scale, nothing printed)` });
      continue;
    }
    heights.push({
      id,
      sheetKey: sheet.key,
      sheet: name,
      label: h.label,
      kind: h.kind,
      measured: true,
      heightFt: r(H.m * FEET_PER_METRE, 2),
      confidence: H.how === "printed" && !H.low ? "high" : H.low ? "low" : "medium",
      sentence: `${sheetLabel}${view?.title ? ` · ${view.title}` : ""} — ${h.label}: ${fmtM(H.m)} (${partWords(H, c, "y")})`,
    });
  }
  return { faces, heights };
}

/**
 * Every measured face and height across a read's sheets, by id ("p5.f1",
 * "p9.h2"), plus each sheet's kind (its titles, else what the measurement
 * pass said). Pure — recomputed on every view, never stored, so it cannot go
 * stale against the sheets it came from.
 */
export function buildTakeoff(sheets, dims = new Map()) {
  const faces = new Map();
  const heights = new Map();
  const kinds = new Map();
  for (const s of Array.isArray(sheets) ? sheets : []) {
    const titled = sheetKind(s);
    const said = s.measure && !s.measure.failed ? s.measure.sheetType : null;
    kinds.set(s.key, titled !== "unknown" ? titled : said && said !== "other" ? said : titled);
    const t = sheetTakeoff(s, dims);
    for (const f of t.faces) faces.set(f.id, f);
    for (const h of t.heights) heights.set(h.id, h);
  }
  return { faces, heights, kinds };
}

/** What the synthesis is shown of the takeoff: compact rows, measured only. */
export function takeoffForPrompt(takeoff) {
  const faces = [...(takeoff?.faces?.values() || [])].filter((f) => f.measured);
  const heights = [...(takeoff?.heights?.values() || [])].filter((h) => h.measured);
  if (!faces.length && !heights.length) return null;
  return {
    faces: {
      columns: ["id", "sheet", "view", "name", "kind", "side", "lengthFt", "heightFt", "bottomFt", "netSqft", "floorSqft", "perimeterFt", "material", "confidence"],
      rows: faces.map((f) => [f.id, f.sheet, f.view, f.name, f.room ? "room" : f.kind, f.side, f.lengthFt ?? null, f.heightFt ?? null, f.bottomFt ?? null, f.netSqft ?? null, f.floorSqft ?? null, f.perimeterFt ?? null, f.material || null, f.confidence]),
    },
    heights: { columns: ["id", "sheet", "label", "kind", "heightFt", "confidence"], rows: heights.map((h) => [h.id, h.sheet, h.label, h.kind, h.heightFt, h.confidence]) },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// A SURFACE'S QUANTITY FROM FACES, AND ITS HEIGHT BANDS
// ═══════════════════════════════════════════════════════════════════════════

export const FACE_MEASURES = Object.freeze(["net_area", "gross_area", "walls", "ceiling", "floor", "perimeter", "length"]);

/** Items painted on a ceiling plane, at the room's height. */
const CEILING_ITEMS = new Set(["ceiling", "crown_moulding", "soffit_fascia"]);
/** Items worked at the floor (no height of their own). */
const FLOOR_ITEMS = new Set(["baseboard", "stain_deck", "stain_tread", "stain_riser", "door", "french_door", "door_frame", "ext_door", "stain_front_door", "garage_door", "closet_small", "window_sill", "cab_door", "cab_drawer", "cab_box", "cab_builtin", "stain_cab_door", "stain_cab_drawer", "stain_vanity_door", "stain_vanity_drawer"]);

/** Share of an area in each height band — the preset's own function
 *  (lib/pricing/paintHeightPrep.js), one copy for the builder and the read. */
export { bandShares };

/** The measure a surface's faces are read by, when the model named none. */
function defaultMeasure(surface, unit, faces) {
  const rooms = faces.some((f) => f.room);
  if (unit === "lnft") return rooms ? "perimeter" : "length";
  if (unit !== "sqft") return null;
  if (!rooms) return "net_area";
  if (surface.itemKey === "ceiling") return "ceiling";
  if (surface.itemKey === "stain_deck") return "floor";
  return "walls";
}

/** The height a surface's rooms are measured to, with what it rests on. */
export function roomHeight(surface, takeoff, faces, { metric = true } = {}) {
  const ref = surface.heightRef ? takeoff?.heights?.get(surface.heightRef) || takeoff?.faces?.get(surface.heightRef) : null;
  if (ref?.measured && ref.heightFt > 0) return { ft: ref.heightFt, said: ref.sentence, confidence: ref.confidence, assumed: false };
  const own = faces.find((f) => f.heightFt > 0);
  if (own) return { ft: own.heightFt, said: own.sentence, confidence: own.confidence, assumed: false };
  return metric
    ? { ft: r(DEFAULT_STOREY_M * FEET_PER_METRE, 2), said: `assumed ${DEFAULT_STOREY_M.toFixed(1)} m storey height — nothing on the set states one, verify`, confidence: "low", assumed: true }
    : { ft: DEFAULT_STOREY_FT, said: `assumed ${DEFAULT_STOREY_FT} ft wall height — nothing on the set states one, verify`, confidence: "low", assumed: true };
}

const worst = (list) => (list.includes("none") ? "low" : list.includes("low") ? "low" : list.includes("medium") ? "medium" : "high");

/**
 * A surface's quantity from the faces it cites, with its height bands and the
 * sentences behind both. Null when it cites none that were measured. Pure.
 *
 * @returns {{ value, source: "face", confidence, estimated, sourceText,
 *             bands: number[], heightBasis, faceIds }} | null
 */
export function faceQuantity(surface, unit, takeoff, { metric = true } = {}) {
  const ids = Array.isArray(surface?.faceRefs) ? surface.faceRefs : [];
  const faces = ids.map((id) => takeoff?.faces?.get(id)).filter((f) => f && f.measured);
  if (!faces.length) return null;
  const measure = FACE_MEASURES.includes(surface.faceMeasure) ? surface.faceMeasure : defaultMeasure(surface, unit, faces);
  if (!measure) return null;
  const bands = HEIGHT_BANDS.map(() => 0);
  const lines = [];
  const conf = [];
  let value = 0;
  let heightBasis = null;
  let topFt = 0;
  const addBands = (qty, shares) => shares.forEach((s, i) => (bands[i] += qty * s));
  if (measure === "net_area" || measure === "gross_area") {
    if (unit !== "sqft") return null;
    for (const f of faces.filter((x) => !x.room)) {
      const q = measure === "net_area" ? f.netSqft : f.grossSqft;
      value += q;
      addBands(q, bandShares(f.bottomFt, f.topFt, f.shape));
      topFt = Math.max(topFt, f.topFt || 0);
      lines.push(f.sentence);
      conf.push(f.confidence);
    }
    heightBasis = "the faces' own heights on the elevations";
  } else if (measure === "walls") {
    if (unit !== "sqft") return null;
    const H = roomHeight(surface, takeoff, faces, { metric });
    for (const f of faces.filter((x) => x.room && x.perimeterFt > 0)) {
      const q = f.perimeterFt * H.ft * (1 - (f.openingsShare || 0));
      value += q;
      addBands(q, bandShares(0, H.ft, "rectangle"));
      lines.push(`${f.sentence}; walls ${fmtFt(f.perimeterFt)} × ${fmtFt(H.ft)}${f.openingsShare ? ` less ${Math.round(f.openingsShare * 100)}% openings` : " (openings not deducted)"} = ${fmtSqft(q)}`);
      conf.push(f.perimeterConfidence || f.confidence);
    }
    conf.push(H.confidence);
    topFt = H.ft;
    heightBasis = `height ${fmtFt(H.ft)}: ${H.said}`;
  } else if (measure === "ceiling" || measure === "floor") {
    if (unit !== "sqft") return null;
    const H = measure === "ceiling" ? roomHeight(surface, takeoff, faces, { metric }) : null;
    for (const f of faces.filter((x) => x.room && x.floorSqft > 0)) {
      value += f.floorSqft;
      addBands(f.floorSqft, bandShares(H ? H.ft : 0, H ? H.ft : 0));
      lines.push(f.sentence);
      conf.push(f.confidence);
    }
    if (H) {
      conf.push(H.confidence);
      topFt = H.ft;
      heightBasis = `worked at the ceiling, ${fmtFt(H.ft)}: ${H.said}`;
    } else heightBasis = "worked at floor level";
  } else if (measure === "perimeter") {
    if (unit !== "lnft") return null;
    const atCeiling = CEILING_ITEMS.has(surface.itemKey);
    const H = atCeiling ? roomHeight(surface, takeoff, faces, { metric }) : null;
    for (const f of faces.filter((x) => x.room && x.perimeterFt > 0)) {
      value += f.perimeterFt;
      addBands(f.perimeterFt, bandShares(H ? H.ft : 0, H ? H.ft : 0));
      lines.push(f.sentence);
      conf.push(f.perimeterConfidence || f.confidence);
    }
    if (H) topFt = H.ft;
    heightBasis = H ? `at the ceiling, ${fmtFt(H.ft)}: ${H.said}` : "at floor level";
  } else if (measure === "length") {
    if (unit !== "lnft") return null;
    for (const f of faces.filter((x) => !x.room && x.lengthFt > 0)) {
      value += f.lengthFt;
      // A run along a face (fascia, trim) is worked at the face's top.
      const at = CEILING_ITEMS.has(surface.itemKey) ? f.topFt : FLOOR_ITEMS.has(surface.itemKey) ? 0 : f.topFt;
      addBands(f.lengthFt, bandShares(at, at));
      topFt = Math.max(topFt, at);
      lines.push(f.sentence);
      conf.push(f.confidence);
    }
    heightBasis = "along the faces' tops";
  }
  if (!(value > 0)) return null;
  const confidence = worst(conf);
  return {
    value: unit === "lnft" ? r(value, 1) : r(value),
    source: "face",
    confidence,
    estimated: confidence !== "high",
    sourceText: lines.join(" · ").slice(0, 3000),
    bands: bands.map((q) => q / value),
    heightBasis,
    topFt: r(topFt, 1),
    faceIds: faces.map((f) => f.id),
    check: faces.map((f) => f.check).filter(Boolean).slice(0, 3),
  };
}

/**
 * Height bands for a surface whose quantity did NOT come from faces: from its
 * `heightRef` (a measured height or face), by what the item is — a wall runs
 * floor to that height, a ceiling is worked at it, trim at the floor. With no
 * height at all, the first band, SAID: "no height on the drawings — priced at
 * ground level". Pure.
 */
export function bandsWithoutFaces(surface, unit, takeoff) {
  const ref = surface.heightRef ? takeoff?.heights?.get(surface.heightRef) || takeoff?.faces?.get(surface.heightRef) : null;
  const H = ref?.measured && ref.heightFt > 0 ? ref.heightFt : null;
  if (FLOOR_ITEMS.has(surface.itemKey) || unit === "each" || unit === "side" || unit === "pair") {
    return { bands: bandShares(0, 0), heightBasis: "worked from the floor", topFt: 0 };
  }
  if (!H) return { bands: bandShares(0, 0), heightBasis: "no height on the drawings for this surface — priced at ground level (up to 8 ft); give it a height if it is higher", assumed: true, topFt: 0 };
  if (CEILING_ITEMS.has(surface.itemKey)) return { bands: bandShares(H, H), heightBasis: `worked at ${fmtFt(H)}: ${ref.sentence}`, topFt: H };
  return { bands: bandShares(0, H), heightBasis: `floor to ${fmtFt(H)}: ${ref.sentence}`, topFt: H };
}
