// lib/planRead/photoScale.js
//
// Sizes estimated from SITE PHOTOS, by reference objects — and the same wall
// seen in three photos counted once.
//
// ══ The owner's ask (2026-10-03) ═══════════════════════════════════════════
//
// "Dimensions must ALSO be estimated from photos, not only from drawing
// files — they know it's approximate." The approach he approved:
//
//   1. Reference-object scaling. The model names a known-size object in the
//      picture (a standard interior door is 80 in tall) and says how many of
//      it the surface spans across and up. THIS FILE does the arithmetic,
//      with the reference sizes written down below, and every result says
//      "from photo — estimated, verify" and which reference it used.
//   2. Cross-photo matching. The model says when photos 3, 7 and 9 show the
//      same north wall; the surface is then ONE surface, measured from the
//      photo whose reference is most reliable, never three surfaces added
//      together. The estimator can split or merge a grouping
//      (splitPhotoSurface / mergePhotoSurfaces) and the quantity follows.
//   3. Drawings win. When a drawing dimension covers the same surface the
//      photo becomes condition and complexity evidence, and a disagreement
//      becomes a question for the estimator (lib/planRead/projectModel.js).
//
// It is the deep photo read's own rule (lib/ai/deepReadEvidence.js), applied
// to a new question: the model judges by eye in a unit a picture can carry,
// the conversion is code, and the result is shown as an estimate.
//
// Pure — no imports.

/**
 * Known sizes, in inches, along the axis the model is asked to count in.
 * `min`/`max` where the real object varies, so the estimate carries the
 * spread instead of pretending the nominal size is exact.
 */
export const REFERENCE_OBJECTS = Object.freeze({
  interior_door: Object.freeze({ label: "standard interior door", inches: 80, min: 78, max: 80, axis: "height" }),
  exterior_door: Object.freeze({ label: "exterior door", inches: 80, min: 80, max: 96, axis: "height" }),
  garage_door: Object.freeze({ label: "garage door", inches: 84, min: 84, max: 96, axis: "height" }),
  outlet_plate: Object.freeze({ label: "outlet cover plate", inches: 4.5, min: 4.5, max: 4.75, axis: "height" }),
  switch_plate: Object.freeze({ label: "light-switch plate", inches: 4.5, min: 4.5, max: 4.75, axis: "height" }),
  brick_course: Object.freeze({ label: "brick course (3 courses = 8 in)", inches: 8 / 3, min: 8 / 3, max: 8 / 3, axis: "height" }),
  block_course: Object.freeze({ label: "concrete block course", inches: 8, min: 8, max: 8, axis: "height" }),
  siding_course: Object.freeze({ label: "lap siding course (exposure 4–7 in)", inches: 6, min: 4, max: 7, axis: "height" }),
  base_cabinet: Object.freeze({ label: "base cabinet with counter", inches: 36, min: 34.5, max: 36, axis: "height" }),
  upper_cabinet: Object.freeze({ label: "upper cabinet", inches: 30, min: 30, max: 42, axis: "height" }),
  drawer_front: Object.freeze({ label: "drawer front", inches: 6, min: 5, max: 7, axis: "height" }),
  window_sash: Object.freeze({ label: "double-hung window sash", inches: 30, min: 24, max: 36, axis: "height" }),
  stair_riser: Object.freeze({ label: "stair riser", inches: 7.5, min: 7, max: 7.75, axis: "height" }),
});

export const REFERENCE_KINDS = Object.freeze(Object.keys(REFERENCE_OBJECTS));
export const PHOTO_ESTIMATE_LABEL = "from photo — estimated, verify";

const finitePos = (v, max = 500) => (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= max ? v : null);
const r2 = (n) => Math.round(n * 100) / 100;

/** How much a reference's size varies, 0 for an exact one. Lower is better. */
export function referenceSpread(kind) {
  const ref = REFERENCE_OBJECTS[kind];
  if (!ref) return Infinity;
  return (ref.max - ref.min) / ref.inches;
}

/**
 * One measurement → feet, with the spread the reference carries. Pure.
 *
 * @param {{ kind: string, widthInRefs?: number|null, heightInRefs?: number|null }} m
 *   "the wall is 6.5 doors wide and 1.4 doors tall" — counts of the
 *   reference's own length, which is what a person can judge by eye.
 * @returns {{ widthFt, heightFt, low, high, reference } | null}
 */
export function scaleFromReference(m) {
  const ref = REFERENCE_OBJECTS[m?.kind];
  if (!ref) return null;
  const w = finitePos(m.widthInRefs);
  const h = finitePos(m.heightInRefs);
  if (w === null && h === null) return null;
  const ft = (n, inches) => (n === null ? null : r2((n * inches) / 12));
  return {
    widthFt: ft(w, ref.inches),
    heightFt: ft(h, ref.inches),
    low: { widthFt: ft(w, ref.min), heightFt: ft(h, ref.min) },
    high: { widthFt: ft(w, ref.max), heightFt: ft(h, ref.max) },
    reference: `${ref.label}, ${r2(ref.inches)} in`,
  };
}

/**
 * The quantity one photo measurement gives, in the unit asked for. Pure.
 *   sqft — width × height (both needed)
 *   lnft — width (or height when only that was judged)
 */
export function photoQuantity(scaled, unit) {
  if (!scaled) return null;
  if (unit === "sqft") {
    if (scaled.widthFt === null || scaled.heightFt === null) return null;
    return {
      value: r2(scaled.widthFt * scaled.heightFt),
      low: r2(scaled.low.widthFt * scaled.low.heightFt),
      high: r2(scaled.high.widthFt * scaled.high.heightFt),
    };
  }
  if (unit === "lnft") {
    const v = scaled.widthFt ?? scaled.heightFt;
    const lo = scaled.low.widthFt ?? scaled.low.heightFt;
    const hi = scaled.high.widthFt ?? scaled.high.heightFt;
    return v === null ? null : { value: v, low: lo, high: hi };
  }
  return null;
}

/**
 * The model's photo reading, cleaned to what can be trusted. Pure.
 *
 * A reference id must name a reference in the SAME photo as the measurement
 * — a door in photo 2 cannot scale a wall in photo 5 — and a photo number
 * must be one that was sent. Everything else is dropped, not repaired.
 */
export function sanitisePhotoRead(raw, photoCount) {
  const n = Number.isInteger(photoCount) && photoCount > 0 ? photoCount : 0;
  const okPhoto = (p) => Number.isInteger(p) && p >= 1 && p <= n;
  const text = (s, max = 200) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");
  const references = [];
  for (const r of Array.isArray(raw?.references) ? raw.references : []) {
    if (!r || typeof r.id !== "string" || !okPhoto(r.photo) || !REFERENCE_OBJECTS[r.kind]) continue;
    if (references.some((x) => x.id === r.id)) continue;
    references.push({ id: r.id.slice(0, 20), photo: r.photo, kind: r.kind, note: text(r.note, 120) });
  }
  const refById = new Map(references.map((r) => [r.id, r]));
  const surfaces = [];
  const seenPhotoSurface = new Set();
  for (const s of Array.isArray(raw?.surfaces) ? raw.surfaces : []) {
    if (!s || typeof s.id !== "string" || surfaces.some((x) => x.id === s.id)) continue;
    const photos = [...new Set((Array.isArray(s.photos) ? s.photos : []).filter(okPhoto))].sort((a, b) => a - b);
    if (!photos.length) continue;
    const measurements = [];
    // Top-level and keyed by surface (lib/planRead/prompts.js PHOTO_SCHEMA);
    // a surface's own nested list is still read, for a reply in that shape.
    const own = [
      ...(Array.isArray(s.measurements) ? s.measurements : []),
      ...(Array.isArray(raw?.measurements) ? raw.measurements.filter((m) => m?.surfaceId === s.id) : []),
    ];
    for (const m of own) {
      const ref = refById.get(m?.referenceId);
      if (!ref || ref.photo !== m.photo || !photos.includes(m.photo)) continue;
      const w = finitePos(m.widthInRefs);
      const h = finitePos(m.heightInRefs);
      if (w === null && h === null) continue;
      measurements.push({ photo: m.photo, referenceId: ref.id, kind: ref.kind, widthInRefs: w, heightInRefs: h, basis: text(m.basis, 160) });
    }
    const label = text(s.label, 80) || "Surface";
    // The same photo described as the same surface twice is one surface.
    const sig = `${label.toLowerCase()}|${photos.join(",")}`;
    if (seenPhotoSurface.has(sig)) continue;
    seenPhotoSurface.add(sig);
    surfaces.push({
      id: s.id.slice(0, 20),
      label,
      surface: text(s.surface, 30) || "other",
      side: s.side === "exterior" ? "exterior" : "interior",
      photos,
      sameReason: photos.length > 1 ? text(s.sameReason, 160) || null : null,
      measurements,
      condition: text(s.condition, 200) || null,
      confidence: ["low", "medium", "high"].includes(s.confidence) ? s.confidence : "low",
    });
  }
  return { references, surfaces };
}

const CONF_RANK = { high: 0, medium: 1, low: 2 };

/**
 * ONE quantity for a photo surface, however many photos show it. Pure.
 *
 * The measurement whose reference varies least wins (an outlet plate beats a
 * window sash); ties go to the surface's own confidence order, then the
 * earlier photo. The rest are kept as `others` — corroboration the screen
 * can show — and are never added in.
 */
export function photoSurfaceQuantity(surface, unit) {
  const candidates = [];
  for (const m of surface?.measurements || []) {
    const scaled = scaleFromReference(m);
    const q = photoQuantity(scaled, unit);
    if (!q) continue;
    candidates.push({ ...q, photo: m.photo, reference: scaled.reference, spread: referenceSpread(m.kind), basis: m.basis, widthFt: scaled.widthFt, heightFt: scaled.heightFt });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.spread - b.spread || a.photo - b.photo);
  const [best, ...others] = candidates;
  return {
    value: best.value,
    low: best.low,
    high: best.high,
    unit,
    photo: best.photo,
    photos: surface.photos,
    reference: best.reference,
    // The two sides, so the screen can say "≈ 42 ft × 18 ft".
    widthFt: best.widthFt,
    heightFt: best.heightFt,
    label: PHOTO_ESTIMATE_LABEL,
    sourceText: `${PHOTO_ESTIMATE_LABEL} — photo ${best.photo}, scaled on ${best.reference}`,
    others: others.map((o) => ({ photo: o.photo, value: o.value, reference: o.reference })),
    confidence: surface.confidence || "low",
  };
}

/** "Photos 3, 7 and 9 show the same north wall." Pure. */
export function groupingSentence(surface) {
  const p = surface?.photos || [];
  if (p.length < 2) return null;
  const list = p.length === 2 ? `${p[0]} and ${p[1]}` : `${p.slice(0, -1).join(", ")} and ${p[p.length - 1]}`;
  return `Photos ${list} show the same ${String(surface.label || "surface").toLowerCase()}`;
}

/**
 * Split a grouped surface into one surface per photo — the estimator saying
 * "those are two different walls". Each keeps only its own photo's
 * measurements. Pure; returns a new read.
 */
export function splitPhotoSurface(read, surfaceId) {
  const surfaces = Array.isArray(read?.surfaces) ? read.surfaces : [];
  const s = surfaces.find((x) => x.id === surfaceId);
  if (!s || s.photos.length < 2) return read;
  const parts = s.photos.map((p, i) => ({
    ...s,
    id: `${s.id}.${i + 1}`,
    label: `${s.label} (photo ${p})`,
    photos: [p],
    sameReason: null,
    measurements: s.measurements.filter((m) => m.photo === p),
    splitFrom: s.id,
  }));
  return { ...read, surfaces: surfaces.flatMap((x) => (x.id === surfaceId ? parts : [x])) };
}

/**
 * Merge surfaces the estimator says are the same thing. The first id keeps
 * its label; photos and measurements are the union, so the quantity is
 * re-chosen from all of them — still once. Pure; returns a new read.
 */
export function mergePhotoSurfaces(read, ids) {
  const surfaces = Array.isArray(read?.surfaces) ? read.surfaces : [];
  const chosen = surfaces.filter((x) => Array.isArray(ids) && ids.includes(x.id));
  if (chosen.length < 2) return read;
  const [head, ...rest] = chosen;
  const merged = {
    ...head,
    photos: [...new Set(chosen.flatMap((x) => x.photos))].sort((a, b) => a - b),
    measurements: chosen.flatMap((x) => x.measurements),
    sameReason: "Merged by the estimator",
    confidence: chosen.map((x) => x.confidence).sort((a, b) => CONF_RANK[a] - CONF_RANK[b])[0] || "low",
  };
  const drop = new Set(rest.map((x) => x.id));
  return { ...read, surfaces: surfaces.filter((x) => !drop.has(x.id)).map((x) => (x.id === head.id ? merged : x)) };
}
