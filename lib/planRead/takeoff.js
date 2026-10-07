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
  // A room's arches arrive at the answer's root, by faceId (the schema
  // cannot nest them — measurePrompts.js); an older answer, or a stored one,
  // may still carry them on the face. Both end up on the face, as stored.
  const rootOpenings = Array.isArray(raw?.openings) ? raw.openings : [];
  const openingsOf = (f, id) => [...(Array.isArray(f?.openings) ? f.openings : []), ...rootOpenings.filter((o) => o && text(o.faceId, 12) === id)];
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
      openings: openingsOf(f, id)
        .slice(0, 8)
        .map((o) => ({ kind: o?.kind === "arch" ? "arch" : "opening", dimRef: ref(o?.dimRef), text: nullable(o?.text, 40), box: cleanBox(o?.box) }))
        .filter((o) => o.dimRef || o.text || o.box),
    });
  }
  const heights = [];
  for (const h of Array.isArray(raw?.heights) ? raw.heights : []) {
    if (heights.length >= MAX_HEIGHTS) break;
    const id = text(h?.id, 12);
    const box = cleanBox(h?.box);
    const photoM = Number(h?.photoHeightM);
    const photo = Number.isFinite(photoM) && photoM > 0.5 && photoM <= 40 ? r(photoM, 2) : null;
    if (!id || heights.some((x) => x.id === id) || (!box && !ref(h?.dimRef) && !h?.text && !photo)) continue;
    heights.push({
      id,
      viewId: viewOf(h.viewId),
      label: text(h.label, 80) || id,
      kind: HEIGHT_KINDS.includes(h.kind) ? h.kind : "other",
      side: h.side === "interior" ? "interior" : h.side === "exterior" ? "exterior" : null,
      box,
      dimRef: ref(h.dimRef),
      text: nullable(h.text, 40),
      photoHeightM: photo,
      photoBasis: photo ? nullable(h.photoBasis, 160) : null,
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
      // An arch's width: printed, else the long side of its box, scaled.
      openings: (f.openings || []).map((o) => {
        const sx = scaled(o.box, "x", view);
        const sy = scaled(o.box, "y", view);
        return { kind: o.kind, printed: printedMetres(o.dimRef, o.text, dims, metric), scaled: sx && sy ? (sx.m >= sy.m ? sx : sy) : sx || sy };
      }),
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
    // Where the face is drawn, for telling the same room or wall apart when
    // it is drawn on several sheets (lib/planRead/sameSurface.js): the view
    // and the sheet's own title (an "as existing" plan against a "proposed"
    // one), the page, and the scale it was measured at.
    const base = { id, sheetKey: sheet.key, sheet: name, page: Number(sheet.page) || null, view: view?.title || null, viewId: view?.id || null, viewType: view?.viewType || null, sheetTitle: sheet.title || null, scaleRatio: scaleFor(view, sheet).ratio || null, name: f.name, kind: f.kind, side: f.side, material: f.material, note: f.note, box: f.box };
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
        ...(() => {
          const ws = (it.openings || []).map((o) => pick(o, c)).filter(Boolean);
          if (!ws.length) return {};
          return {
            archWidthsFt: ws.map((w) => r(w.m * FEET_PER_METRE, 2)),
            archWords: ws.map((w, i) => `${it.openings[i]?.kind === "arch" ? "arch" : "opening"} ${fmtM(w.m)} (${partWords(w, c, "x")})`).join(", "),
            archLow: ws.some((w) => w.low),
          };
        })(),
        confidence,
        perimeterConfidence,
        printed: (printedArea ? 1 : 0) + [L, W].filter((p) => p?.how === "printed").length,
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
      printed: [L, H].filter((p) => p.how === "printed").length,
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
    const side = h.side || null;
    // A photo's height is an ESTIMATE against something of known size — never
    // better than medium, and said with the photo and the reference.
    if (!H && h.photoHeightM) {
      heights.push({
        id,
        sheetKey: sheet.key,
        sheet: name,
        label: h.label,
        kind: h.kind,
        side: side || "interior",
        photo: true,
        measured: true,
        heightFt: r(h.photoHeightM * FEET_PER_METRE, 2),
        confidence: h.photoBasis ? "medium" : "low",
        sentence: `${sheetLabel} — ${h.label}: about ${fmtM(h.photoHeightM)} estimated from the photo${h.photoBasis ? ` (${h.photoBasis})` : " (no reference named)"} — verify on site`,
      });
      continue;
    }
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
      side,
      viewType: view?.viewType || null,
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
    heights: { columns: ["id", "sheet", "label", "kind", "side", "heightFt", "confidence"], rows: heights.map((h) => [h.id, h.sheet, h.label, h.kind, h.side || null, h.heightFt, h.confidence]) },
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
export function defaultMeasure(surface, unit, faces) {
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

// ── A wall stops where the roof starts ─────────────────────────────────────
//
// The church's live read (2026-10-05) measured the nave's walls to its RIDGE
// (33.5 ft): an open truss roof above the wall is roof, not wall, and a
// walls-only scope excludes it — 30,655 sq ft of interior wall against
// ~11,900 measured by hand. The first fix stopped the walls at the OUTSIDE
// eaves (2.94 m); the church's interior photos show the inside walls rising
// well above that before the truss feet, so the outside eaves is only a
// lower bound. wallHeight() below takes the inside height from a section,
// else a photo, else the outside eaves AS A LOWER BOUND (low, with a check).
//
// A height that IS a ridge, apex, gable or tower figure is never a wall
// height; an outside height more than 25% over the eaves
// (WALL_HEIGHT_TOLERANCE — implied height = wall area ÷ perimeter, which for
// perimeter × height is the height itself) is not trusted for the inside
// either. Gable triangles are never added to a walls measure: they belong to
// gable walls, priced only when the scope names gables.

export const WALL_HEIGHT_TOLERANCE = 1.25;
const EAVES_KINDS = new Set(["eaves", "wall_plate", "storey", "ceiling"]);
const ROOF_KINDS = new Set(["ridge", "tower"]);
const EAVES_WORDS = /\b(eaves?|wall[- ]?plate|plate|wall[- ]?top|wall[- ]?head|top of (?:the )?wall|springing|ceiling)\b/i;
const ROOF_WORDS = /\b(ridge|apex|peak|gable|tower|spire|truss|roof)\b/i;
// Words that say nothing about WHICH building a height belongs to.
const STOP = new Set(["height", "heights", "shown", "roof", "ridge", "eaves", "wall", "walls", "top", "visible", "behind", "main", "the", "of", "to", "at", "and", "interior", "only", "high", "volume", "church", "existing", "level", "ft", "m", "metres", "quote", "upper", "lower", "side", "left", "right", "face", "line", "plate"]);
// A height of an add-on building is not the main building's.
const ANNEXE_WORDS = /\b(extension|annexe|annex|porch|lobby|link|outbuilding|garage)\b/i;
const words = (s) => new Set(String(s || "").toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2 && !STOP.has(w)));

/** "eaves" (a wall's top), "roof" (above the wall), or null. */
export function heightKind(h) {
  if (!h) return null;
  if (EAVES_KINDS.has(h.kind)) return "eaves";
  if (ROOF_KINDS.has(h.kind)) return "roof";
  const label = String(h.label || "");
  if (EAVES_WORDS.test(label)) return "eaves";
  if (ROOF_WORDS.test(label)) return "roof";
  return null;
}

/** The eaves / wall plate a surface's walls belong to, or null. */
function eavesFor(surface, ref, takeoff, areaName) {
  const own = `${surface?.label || ""} ${areaName || ""}`;
  const annexe = ANNEXE_WORDS.test(own);
  const mine = words(own);
  const refWords = words(ref?.label);
  const list = [...(takeoff?.heights?.values() || [])].filter((h) => h.measured && h.heightFt > 0 && heightKind(h) === "eaves" && (annexe || !ANNEXE_WORDS.test(h.label || "")));
  if (!list.length) return null;
  const score = (h) => {
    const w = words(h.label);
    let n = 0;
    for (const x of w) n += (mine.has(x) ? 2 : 0) + (refWords.has(x) ? 1 : 0);
    return n;
  };
  const below = (h) => (ref?.heightFt ? h.heightFt < ref.heightFt : true);
  return list.sort((a, b) => score(b) - score(a) || Number(below(b)) - Number(below(a)) || b.heightFt - a.heightFt)[0];
}

/** A height inside a room — said so by the measurement pass, or by its label. */
const INSIDE_WORDS = /\b(inside|interior|internal)\b/i;
export function isInsideHeight(h) {
  return Boolean(h) && (h.side === "interior" || (h.side !== "exterior" && INSIDE_WORDS.test(String(h.label || ""))));
}

/** A main church space — its inside height is not an annexe room's. */
const MAIN_SPACE_WORDS = /\b(nave|transepts?|chancel|crossing|sanctuary|choir|aisles?|apse)\b/i;

/**
 * The best inside wall height for a surface: a section's before a photo's.
 *
 * Never the nave's for an annexe room: the church's run 5 (2026-10-06) took
 * the boiler room, the vestry and the extension's cafe and kitchen to the
 * NAVE's 5.8 m truss feet (from the interior photos), over the synthesis's
 * own citation of the extension's 2.9 m wall plate — 11,119 sq ft of annexe
 * walls. An annexe surface takes an inside height only when that height is
 * the annexe's, or names no main church space; the converse rule for the
 * outside eaves is eavesFor's.
 */
function insideFor(surface, ref, takeoff, areaName) {
  const own = `${surface?.label || ""} ${areaName || ""}`;
  const annexe = ANNEXE_WORDS.test(own);
  const mine = words(own);
  const refWords = words(ref?.label);
  const list = [...(takeoff?.heights?.values() || [])].filter((h) => h.measured && h.heightFt > 0 && isInsideHeight(h) && heightKind(h) === "eaves" && (!annexe || ANNEXE_WORDS.test(h.label || "") || !MAIN_SPACE_WORDS.test(h.label || "")));
  if (!list.length) return null;
  const score = (h) => {
    let n = 0;
    for (const x of words(h.label)) n += (mine.has(x) ? 2 : 0) + (refWords.has(x) ? 1 : 0);
    return n;
  };
  const rank = { high: 3, medium: 2, low: 1 };
  return list.sort((a, b) => Number(Boolean(a.photo)) - Number(Boolean(b.photo)) || score(b) - score(a) || (rank[b.confidence] || 0) - (rank[a.confidence] || 0) || b.heightFt - a.heightFt)[0];
}

/**
 * The height a room's WALLS run to on the inside, by source, in order (the
 * coordinator, 2026-10-05, after the church's second run):
 *
 *   1. a section through the space: its inside wall plate / truss foot /
 *      ceiling height;
 *   2. an interior photo: the truss feet estimated against a door, a person
 *      or a pew — medium at best, low without a reference, the photo named;
 *   3. the OUTSIDE eaves — only as a LOWER BOUND, low confidence, and a
 *      check "interior wall height taken from outside eaves — measure on
 *      site". An open-roofed nave's inside walls rise well above its outside
 *      eaves (the church's photos), so the eaves can only say "at least".
 *
 * A ridge, apex, gable or tower figure is never a wall height. Returns
 * roomHeight's shape plus `capped` ({ source, fromFt, toFt, lowerBound })
 * when the source is not the height the model cited, `roofOnly` when a roof
 * figure stands with nothing to replace it. Pure.
 */
export function wallHeight(surface, takeoff, faces, { metric = true, areaName = null } = {}) {
  const H = roomHeight(surface, takeoff, faces, { metric });
  const ref = surface.heightRef ? takeoff?.heights?.get(surface.heightRef) || null : null;
  const roof = heightKind(ref) === "roof";
  // 1–2. The model cited an inside wall height itself.
  if (ref && !roof && isInsideHeight(ref) && ref.measured && ref.heightFt > 0) return { ...H, source: ref.photo ? "photo" : "section" };
  const inside = insideFor(surface, ref, takeoff, areaName);
  if (inside) {
    const from = ref?.label ? `; not the ${ref.label} (${fmtFt(H.ft)})` : H.assumed ? `; not the assumed ${fmtFt(H.ft)}` : "";
    return {
      ft: inside.heightFt,
      said: `${inside.sentence} — the inside wall height${inside.photo ? ", estimated from a photo" : " from the section"}${from}`,
      confidence: inside.photo ? (inside.confidence === "medium" ? "medium" : "low") : inside.confidence,
      assumed: false,
      source: inside.photo ? "photo" : "section",
      capped: { source: inside.photo ? "photo" : "section", fromFt: H.ft, toFt: inside.heightFt, heightId: inside.id, from: ref?.label || null },
    };
  }
  if (H.assumed) return H;
  // 3. No inside height: the outside eaves, as a lower bound only.
  const eaves = eavesFor(surface, ref, takeoff, areaName);
  const refOutside = ref && !isInsideHeight(ref);
  const refIsEaves = refOutside && heightKind(ref) === "eaves";
  if (eaves && (roof || refIsEaves || (refOutside && H.ft > eaves.heightFt * WALL_HEIGHT_TOLERANCE))) {
    const use = refIsEaves ? ref : eaves;
    const what = !refIsEaves && ref?.label ? `; the ${ref.label} (${fmtFt(H.ft)}) is ${roof ? "roof above the wall" : "not an inside wall height"}` : "";
    return {
      ft: use.heightFt,
      said: `${use.sentence} — the OUTSIDE eaves, taken as a lower bound for the inside walls (no section or photo gives the inside height)${what}; measure on site`,
      confidence: "low",
      assumed: false,
      source: "outside_eaves",
      capped: { source: "outside_eaves", lowerBound: true, fromFt: H.ft, toFt: use.heightFt, eavesId: use.id, from: ref?.label || null },
    };
  }
  if (roof) return { ...H, confidence: "low", said: `${H.said} — a roof / ridge height, and no eaves, wall plate, section or photo on the set to take the wall height from; verify`, roofOnly: true };
  return H;
}

// ── Arches are openings ────────────────────────────────────────────────────
//
// A church crossing is open on all four sides — its "walls" are the piers
// between the arches; the nave, transepts and chancel each open into it
// through one arch. Counting perimeter × height for all of them paints the
// air in the arches twice (once from each side). Where the measurement
// stated no opening for it, a room named as a crossing keeps only its piers,
// and a church space on the same plan as a crossing loses the arch on the
// side it shares. ARCH_SHARE is a FieldQuo assumption — said on the line.
export const ARCH_SHARE = 0.75;
const CROSSING = /\bcrossing\b/i;
const OPENS_TO_CROSSING = /\b(nave|transepts?|chancel|apse|sanctuary|choir|aisles?)\b/i;
const pageOf = (id) => String(id || "").split(".")[0];
const shortSide = (f) => {
  if (f.lengthFt > 0 && f.widthFt > 0) return Math.min(f.lengthFt, f.widthFt);
  const P = Number(f.perimeterFt) / 2;
  const A = Number(f.floorSqft);
  if (!(P > 0) || !(A > 0) || P * P < 4 * A) return null;
  return (P - Math.sqrt(P * P - 4 * A)) / 2;
};

/** The wall length of a room after its arches, with the sentence. Pure. */
export function solidPerimeter(f, takeoff) {
  const P = Number(f.perimeterFt) || 0;
  const name = String(f.name || "");
  // The plan's own arch widths win: printed, else scaled off the plan.
  if (Array.isArray(f.archWidthsFt) && f.archWidthsFt.length) {
    const open = Math.min(P * 0.9, f.archWidthsFt.reduce((n, w) => n + w, 0));
    return { ft: Math.max(0, P - open), note: `less ${fmtFt(open)} of arches and openings measured on the plan: ${f.archWords}`, low: Boolean(f.archLow) };
  }
  if (CROSSING.test(name)) {
    const solid = P * (1 - ARCH_SHARE);
    return { ft: solid, note: `a crossing: open arches on all four sides — only the piers between them are wall (the plan gives no arch widths: arches taken as ${Math.round(ARCH_SHARE * 100)}% of each side, FieldQuo assumption; check the piers on the plan)` };
  }
  if (OPENS_TO_CROSSING.test(name)) {
    const crossing = [...(takeoff?.faces?.values() || [])].some((x) => x.room && x.measured && pageOf(x.id) === pageOf(f.id) && CROSSING.test(String(x.name || "")));
    const side = crossing ? shortSide(f) : null;
    if (side) {
      const arch = side * ARCH_SHARE;
      return { ft: Math.max(0, P - arch), note: `open to the crossing through an arch: ${fmtFt(arch)} of its ${fmtFt(side)} end is opening, not wall (the plan gives no arch width: ${Math.round(ARCH_SHARE * 100)}%, FieldQuo assumption; check on the plan)` };
    }
  }
  return { ft: P, note: null };
}

const roomKey = (f) => String(f.name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const worst = (list) => (list.includes("none") ? "low" : list.includes("low") ? "low" : list.includes("medium") ? "medium" : "high");

/**
 * A surface's quantity from the faces it cites, with its height bands and the
 * sentences behind both. Null when it cites none that were measured. Pure.
 *
 * @returns {{ value, source: "face", confidence, estimated, sourceText,
 *             bands: number[], heightBasis, faceIds }} | null
 */
export function faceQuantity(surface, unit, takeoff, opts = {}) {
  const metric = opts.metric !== false;
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
  let wallCap = null;
  let wallSource = null;
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
    const H = wallHeight(surface, takeoff, faces, { metric, areaName: opts.areaName });
    // The same room drawn on two sheets (a part plan and the whole plan) is
    // ONE room: counted once, from the first sheet cited.
    const seen = new Set();
    const rooms = [];
    for (const f of faces.filter((x) => x.room && x.perimeterFt > 0)) {
      const k = roomKey(f);
      if (k && seen.has(k)) {
        lines.push(`${f.sentence} — the same room as above, on another sheet: not counted twice`);
        continue;
      }
      seen.add(k);
      rooms.push(f);
    }
    for (const f of rooms) {
      const solid = solidPerimeter(f, takeoff);
      const q = solid.ft * H.ft * (1 - (f.openingsShare || 0));
      value += q;
      addBands(q, bandShares(0, H.ft, "rectangle"));
      lines.push(`${f.sentence}; walls ${fmtFt(solid.ft)}${solid.note ? ` (${solid.note})` : ""} × ${fmtFt(H.ft)}${f.openingsShare ? ` less ${Math.round(f.openingsShare * 100)}% openings` : " (windows and doors not deducted)"} = ${fmtSqft(q)}`);
      conf.push(f.perimeterConfidence || f.confidence);
      if (solid.note) conf.push(solid.low ? "low" : "medium");
    }
    conf.push(H.confidence);
    topFt = H.ft;
    heightBasis = `height ${fmtFt(H.ft)}: ${H.said}`;
    if (H.capped) wallCap = H.capped;
    wallSource = H.source || (H.assumed ? "assumed" : "ref");
    if (H.roofOnly) wallCap = { roofOnly: true, fromFt: H.ft };
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
    ...(wallCap ? { wallCap } : {}),
    ...(wallSource ? { wallSource } : {}),
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
