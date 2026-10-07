// lib/planRead/sameSurface.js
//
// ONE room, ONE wall — however many sheets draw it.
//
// A drawing set draws the same building more than once: a whole plan at
// 1:200, a part plan at 1:100, the plan "as existing" beside the scheme that
// replaces it; an elevation on its own sheet and again on a combined one. The
// measurement pass measures every view it is shown, so the church's set
// (St Paul's, 2026-10-06, read cmuun5kc00000vst66kp7qc81) came back with the
// nave three times — 1,338 sq ft of floor on the part plan, 3,036 on the
// whole-church scheme, 2,208 on the plan as existing — and the transepts,
// the crossing, the boiler room and the vestry twice. The synthesis cites
// faces by id; nothing stopped two surfaces citing the nave from two sheets,
// or one surface citing a sheet whose rooms are the PROPOSED layout while the
// job is a repaint of the building as it stands.
//
// This file decides, in code, after the model and before any quantity:
//
//   1. WHICH FACES ARE THE SAME SURFACE. Same normalised name (or one of its
//      "/" alternatives: "Chancel / sanctuary" is the chancel), same side,
//      both rooms or both walls, a plausible size (a room's perimeter within
//      ROOM_PERIMETER_SPREAD×, a wall's area within WALL_AREA_SPREAD× — the
//      model's boxes are loose, the church's transept came back at 72, 95 and
//      135 ft round), on different views. A room must be on the same level
//      when both views name one ("Ground floor" is not "First floor"); a wall
//      must face the same way, from the elevation's own title — a wall with
//      no stated orientation is never merged, because "New glazed porch" on
//      the west and on the north elevation are two different faces of it. A
//      name that appears twice on one view ("Store", "Store") is ambiguous
//      and never merged.
//
//   2. WHICH MEASUREMENT IS KEPT: printed figures first, then the larger
//      scale (1:100 before 1:200), then the higher confidence, then the
//      drawing of the building as it stands. The others are named on the
//      line — "also drawn on…" — for the estimator to check against.
//      One exception, from 3: when the set draws the building both as it
//      stands and as proposed, a room or wall drawn on an "as existing"
//      drawing is kept FROM that drawing, whatever the proposed one prints.
//      The proposed plan draws the room after the works (the church's part
//      plan has the nave at 1,338 sq ft of floor, cut by the new lobbies;
//      as it stands it is 2,208), and printed sizes of the wrong state are
//      not a better measurement of the state priced.
//
//   3. WHICH STATE OF THE BUILDING IS PRICED, when the set holds both an "as
//      existing" and a "proposed" / scheme drawing of the same building (a
//      room matched across the two). ONE state, never both summed:
//        existing   the rooms and walls as they stand. Rooms drawn ONLY on
//                   the proposed drawings (the extension) are left out —
//                   named on "Check before sending", one tap to include them.
//        with_new   the same, plus the proposed new rooms.
//      FieldQuo decides from the client's request: a repaint prices what
//      exists; the new rooms come in only when the request says so
//      ("extension", "new build", "proposed", "new rooms" — not after "no",
//      "not", "excluding"). The estimator's own choice (PATCH op
//      set_plan_state) wins over both and is kept on the model.
//
// Nothing here is a model call and nothing is stored but the estimator's
// choice: computeProject (lib/planRead/projectModel.js) runs it on every
// view, so an existing read is de-duplicated the next time it is opened —
// no re-read, no re-measure, no charge.
//
// Pure.

import { FACE_MEASURES, defaultMeasure } from "./takeoff";

export const PLAN_STATES = Object.freeze(["existing", "with_new"]);
/** A room's perimeter on two sheets: within this factor it can be the same room. */
export const ROOM_PERIMETER_SPREAD = 2;
/** A wall's area on two sheets: within this factor it can be the same wall. */
export const WALL_AREA_SPREAD = 2.5;

// ── What a drawing shows: the building as it stands, or as proposed ────────
const EXISTING = /\bas[- ]?existing\b|\bexisting\s+(?:plans?|layouts?|floor|ground|first|second|basement|elevations?|sections?|conditions?|building|church|house)\b|\bsurvey(?:ed)?\s+(?:plans?|drawings?|elevations?)\b|^\s*existing\b|[-–—(:]\s*existing\s*\)?\s*$/i;
const PROPOSED = /\bas[- ]?proposed\b|\bproposed\b|\bscheme\b|\boption\s+[a-z0-9]{1,3}\b/i;

/** "existing", "proposed" or null — from the sheet's title and the view's. */
export function drawingState(face) {
  const t = [face?.sheetTitle, face?.view].filter(Boolean).join(" · ");
  if (!t) return null;
  const e = EXISTING.test(t);
  const p = PROPOSED.test(t);
  return e && !p ? "existing" : p && !e ? "proposed" : null;
}

// ── A plan's level ─────────────────────────────────────────────────────────
const LEVELS = [
  [/\bbasement\b|\bcellar\b/i, "basement"],
  [/\blower[- ]ground\b/i, "lower ground"],
  [/\bground(?:[- ]floor|[- ]level)?\b/i, "ground"],
  [/\bfirst[- ]floor\b|\b1st[- ]floor\b|\blevel\s*1\b/i, "1"],
  [/\bsecond[- ]floor\b|\b2nd[- ]floor\b|\blevel\s*2\b/i, "2"],
  [/\bthird[- ]floor\b|\b3rd[- ]floor\b|\blevel\s*3\b/i, "3"],
  [/\bmezzanine\b/i, "mezzanine"],
  [/\battic\b|\bloft\b/i, "attic"],
];
export function planLevel(face) {
  const t = [face?.sheetTitle, face?.view].filter(Boolean).join(" · ");
  for (const [re, level] of LEVELS) if (re.test(t)) return level;
  return null;
}

// ── An elevation's orientation ─────────────────────────────────────────────
// The word nearest BEFORE "elevation": "New glazed south porch (east
// elevation)" faces east; "Extension Rear /East Elevation" faces east.
const ORIENT = /\b(north[- ]?east|north[- ]?west|south[- ]?east|south[- ]?west|north|south|east|west|front|rear|back)\b/gi;
export function orientation(face) {
  const t = String(face?.view || "");
  const at = t.search(/elevation/i);
  if (at < 0) return null;
  const words = [...t.slice(0, at).matchAll(ORIENT)].map((m) => m[1].toLowerCase().replace(/[- ]/g, ""));
  const w = words[words.length - 1] || null;
  return w === "back" ? "rear" : w;
}

// ── A face's names ─────────────────────────────────────────────────────────
const STATE_WORDS = /\b(?:existing|proposed|new|the|ex|prop)\b/g;
/** The normalised names a face answers to: "Chancel / sanctuary" → chancel, sanctuary. */
export function nameKeys(name) {
  return new Set(
    String(name || "")
      .toLowerCase()
      .split(/\s*(?:\/|\bor\b)\s*/)
      .map((x) => x.replace(/[^a-z0-9]+/g, " ").replace(STATE_WORDS, " ").replace(/\s+/g, " ").trim())
      .filter((x) => x.length >= 2),
  );
}

const CONF = { high: 3, medium: 2, low: 1, none: 0 };
const viewKey = (f) => `${f.sheetKey}|${f.viewId || ""}`;
const spread = (a, b) => (a > 0 && b > 0 ? Math.max(a, b) / Math.min(a, b) : null);

/** Where a face is drawn, in words: “Plan - as existing” (page 11, 1:100). */
export function drawnWhere(f) {
  const bits = [f.page ? `page ${f.page}` : f.sheet, f.scaleRatio ? `1:${f.scaleRatio}` : null].filter(Boolean).join(", ");
  return `${f.view ? `“${f.view}”` : f.sheet}${bits ? ` (${bits})` : ""}`;
}

/** Why one measurement was kept over another, in words. */
function keptWhy(keep, other, paired = false) {
  if (paired && drawingState(keep) === "existing" && drawingState(other) !== "existing") return "the drawing as existing — the layout priced";
  if ((keep.printed || 0) > (other.printed || 0)) return "printed sizes";
  if (keep.scaleRatio && other.scaleRatio && keep.scaleRatio < other.scaleRatio) return "the larger scale";
  if ((CONF[keep.confidence] || 0) > (CONF[other.confidence] || 0)) return "the higher confidence";
  if (drawingState(keep) === "existing" && drawingState(other) !== "existing") return "the drawing as existing";
  return "the first sheet";
}

/**
 * Which measured faces are the same surface, which one is kept, which state
 * of the building is priced and what that leaves out. Pure.
 *
 * @param takeoff  buildTakeoff()
 * @param o.request    the client's request (PlanRead.clientRequest)
 * @param o.planState  the model's stored choice ({ value, source: "person" })
 * @returns {{ groups, groupOf: Map, out: Map, state, drawings }}
 */
export function sameSurfacePlan(takeoff, { request = null, planState = null } = {}) {
  const faces = [...(takeoff?.faces?.values() || [])].filter((f) => f && f.measured);
  // A name twice on one view is two things, never one.
  const perView = new Map();
  for (const f of faces) {
    const k = viewKey(f);
    if (!perView.has(k)) perView.set(k, new Map());
    const counts = perView.get(k);
    for (const n of nameKeys(f.name)) counts.set(n, (counts.get(n) || 0) + 1);
  }
  const keysOf = new Map(faces.map((f) => [f.id, [...nameKeys(f.name)].filter((n) => perView.get(viewKey(f)).get(n) === 1)]));
  // Two faces of ONE view never share a name that is unique on it, so they
  // are never merged — no separate same-view rule is needed.
  const compatible = (a, b) => {
    if (Boolean(a.room) !== Boolean(b.room) || a.side !== b.side) return false;
    const ka = keysOf.get(a.id);
    if (!keysOf.get(b.id).some((n) => ka.includes(n))) return false;
    if (a.room) {
      const la = planLevel(a);
      const lb = planLevel(b);
      if (la && lb && la !== lb) return false;
      const s = spread(a.perimeterFt, b.perimeterFt) ?? (spread(a.floorSqft, b.floorSqft) === null ? null : Math.sqrt(spread(a.floorSqft, b.floorSqft)));
      return s !== null && s <= ROOM_PERIMETER_SPREAD;
    }
    const oa = orientation(a);
    if (!oa || oa !== orientation(b)) return false;
    const s = spread(a.grossSqft, b.grossSqft);
    return s !== null && s <= WALL_AREA_SPREAD;
  };
  // Best first: printed, larger scale, confidence, the drawing as existing,
  // then the set's own order — so a group's first member is the one kept.
  const order = new Map(faces.map((f, i) => [f.id, i]));
  const ranked = faces.slice().sort(
    (a, b) =>
      (b.printed || 0) - (a.printed || 0) ||
      (a.scaleRatio || Infinity) - (b.scaleRatio || Infinity) ||
      (CONF[b.confidence] || 0) - (CONF[a.confidence] || 0) ||
      Number(drawingState(b) === "existing") - Number(drawingState(a) === "existing") ||
      order.get(a.id) - order.get(b.id),
  );
  const groups = [];
  for (const f of ranked) {
    const g = groups.find((x) => x.members.every((m) => compatible(m, f)));
    if (g) g.members.push(f);
    else groups.push({ key: `g${groups.length + 1}`, members: [f] });
  }
  // ── Existing or proposed ──
  const stateOf = new Map(faces.map((f) => [f.id, drawingState(f)]));
  const paired = groups.some((g) => g.members.some((m) => stateOf.get(m.id) === "existing") && g.members.some((m) => stateOf.get(m.id) === "proposed"));
  const groupOf = new Map();
  for (const g of groups) {
    // Members are best-first. In a set drawn both ways, a room the existing
    // drawings show is measured from them (point 2's exception, above).
    const keep = (paired && g.members.find((m) => stateOf.get(m.id) === "existing")) || g.members[0];
    g.keep = keep.id;
    g.name = keep.name;
    const other = g.members.find((m) => m.id !== keep.id);
    g.why = other ? keptWhy(keep, other, paired) : null;
    for (const m of g.members) groupOf.set(m.id, g);
  }
  const out = new Map();
  let state = null;
  const drawings = { existing: [], proposed: [] };
  if (paired) {
    for (const f of faces) {
      const s = stateOf.get(f.id);
      const title = f.view || f.sheetTitle;
      if (s && title && !drawings[s].includes(title)) drawings[s].push(title);
    }
    state = choosePlanState({ request, stored: planState });
    if (state.value === "existing") {
      // Drawn only on the proposed drawings, where an existing drawing of the
      // same kind (a plan of the same level, an elevation facing the same
      // way) shows the building as it stands: the new work — left out.
      const existingViews = faces.filter((f) => stateOf.get(f.id) === "existing");
      const covered = (f) =>
        existingViews.some((e) => Boolean(e.room) === Boolean(f.room) && (f.room ? !planLevel(e) || !planLevel(f) || planLevel(e) === planLevel(f) : orientation(e) && orientation(e) === orientation(f)));
      for (const g of groups) {
        if (g.members.some((m) => stateOf.get(m.id) !== "proposed")) continue;
        if (!g.members.some(covered)) continue;
        for (const m of g.members) out.set(m.id, { reason: "proposed_only", group: g.key });
      }
    }
  }
  return { groups, groupOf, out, state, drawings, paired };
}

// ── The client's request: is the new work in? ─────────────────────────────
const NEW_WORK = /\b(extensions?|new[- ]build|new\s+(?:rooms?|wing|annexe|annex|addition|hall|block|layout)|proposed|additions?|once\s+(?:built|finished|complete)|after\s+the\s+(?:works|build|building\s+work))\b/gi;
const NEGATED = /\b(?:no|not|excluding|exclude|except|without|nor|other\s+than)\s+(?:the\s+|any\s+|a\s+|an\s+)?(?:new\s+)?$/i;

/** The words of the request that bring the new work in, or null. Pure. */
export function newWorkMention(request) {
  const t = String(request || "");
  for (const m of t.matchAll(NEW_WORK)) {
    if (NEGATED.test(t.slice(Math.max(0, m.index - 40), m.index))) continue;
    return m[0];
  }
  return null;
}

/**
 * The state priced: the estimator's choice, else the request's, else the
 * building as it stands. Pure.
 */
export function choosePlanState({ request = null, stored = null } = {}) {
  if (stored && PLAN_STATES.includes(stored.value) && stored.source === "person") {
    return { value: stored.value, source: "person", by: stored.by || null, at: stored.at || null };
  }
  const words = newWorkMention(request);
  if (words) return { value: "with_new", source: "request", words };
  return { value: "existing", source: "default" };
}

/** Faces of one claim: a room's walls and its ceiling are two surfaces; its walls twice is one. */
function claimClass(measure, itemKey) {
  if (measure === "net_area" || measure === "gross_area") return "area";
  if (measure === "perimeter" || measure === "length") return `${measure}:${itemKey}`;
  return measure || "other";
}

/**
 * Each surface's faces after de-duplication, in the model's order: a cited
 * face swapped for the group's kept one, a face another (active) surface
 * already counts for the same measure dropped, a face of the state not
 * priced left out — each with what to say about it. Pure.
 *
 * @param surfaces  the model's surfaces
 * @param takeoff   buildTakeoff()
 * @param plan      sameSurfacePlan()
 * @param o.unitOf  (surface) → its unit (sqft, lnft…)
 * @param o.isActive (surface) → whether it is priced
 * @returns Map<surfaceId, { faceRefs, swapped, counted, out, emptied }>
 */
export function assignFaces(surfaces, takeoff, plan, { unitOf = () => "sqft", isActive = () => true } = {}) {
  const res = new Map();
  if (!plan) return res;
  const claimed = new Map();
  const labelOf = new Map((surfaces || []).map((s) => [s.id, s.label || s.id]));
  for (const s of surfaces || []) {
    const refs = Array.isArray(s?.faceRefs) ? s.faceRefs : [];
    if (!refs.length) continue;
    const measured = refs.map((id) => takeoff?.faces?.get(id)).filter((f) => f && f.measured);
    if (!measured.length) continue;
    const measure = FACE_MEASURES.includes(s.faceMeasure) ? s.faceMeasure : defaultMeasure(s, unitOf(s), measured);
    const cls = claimClass(measure, s.itemKey);
    const active = isActive(s);
    const out = [];
    const counted = [];
    const swapped = [];
    const faceRefs = [];
    let changed = false;
    for (const id of refs) {
      const f = takeoff?.faces?.get(id);
      if (!f || !f.measured) {
        faceRefs.push(id);
        continue;
      }
      if (plan.out.has(id)) {
        out.push(f);
        changed = true;
        continue;
      }
      const g = plan.groupOf.get(id);
      const keep = g ? g.keep : id;
      if (faceRefs.includes(keep)) {
        // The same room cited twice by one surface, from two sheets.
        if (keep !== id) swapped.push({ from: f, to: takeoff.faces.get(keep), within: true });
        changed = true;
        continue;
      }
      const ck = `${g ? g.key : id}|${cls}`;
      const by = claimed.get(ck);
      if (by && by !== s.id) {
        counted.push({ face: f, by, byLabel: labelOf.get(by) });
        changed = true;
        continue;
      }
      if (active) claimed.set(ck, s.id);
      faceRefs.push(keep);
      if (keep !== id) {
        swapped.push({ from: f, to: takeoff.faces.get(keep) });
        changed = true;
      }
    }
    // The group's other drawings, named on the line — "also drawn on…".
    const alsoOn = [];
    for (const id of faceRefs) {
      const g = plan.groupOf.get(id);
      if (g && g.members.length > 1) alsoOn.push({ keep: takeoff.faces.get(g.keep), others: g.members.filter((m) => m.id !== g.keep), why: g.why });
    }
    if (!changed && !alsoOn.length) continue;
    res.set(s.id, { faceRefs, swapped, counted, out, alsoOn, emptied: faceRefs.filter((id) => takeoff?.faces?.get(id)?.measured).length === 0 });
  }
  return res;
}

/** What to say on a surface's line about its faces' other drawings. Pure. */
export function assignmentWords(a) {
  if (!a) return [];
  const words = [];
  for (const { keep, others, why } of a.alsoOn) {
    words.push(`${keep.name}: also drawn on ${others.map(drawnWhere).join(" and ")} — the same ${keep.room ? "room" : "wall"}, counted once, from ${drawnWhere(keep)} (${why})`);
  }
  for (const c of a.counted) words.push(`${c.face.name} (${drawnWhere(c.face)}) is counted in “${c.byLabel}” — not twice`);
  if (a.out.length) words.push(`${[...new Set(a.out.map((f) => f.name))].join(", ")}: only on the proposed drawings — not in the existing layout this price is for`);
  return words;
}

/**
 * The plan for the screen and the review, about the faces the read's priced
 * surfaces CITE (a room nobody asked for — the church hall on the site plan —
 * is not "left out"): the merged groups, the new rooms the state leaves out
 * (`outNames`) or brings in (`newNames`), every drawing's own verdict by face
 * id (`faces`), and the state. Null when there is nothing to say. Pure.
 *
 * @param cited  Set of face ids cited by active surfaces
 */
export function sameSurfaceSummary(plan, takeoff, cited = null) {
  if (!plan) return null;
  // In the order the read cites them (the overview's order), then the rest.
  const ids = cited ? [...cited].filter((id) => takeoff.faces.get(id)?.measured) : [...takeoff.faces.keys()];
  const groupsCited = (p) => [...new Set(ids.map((id) => p.groupOf.get(id)).filter(Boolean))];
  const merged = groupsCited(plan)
    .filter((g) => g.members.length > 1 && !plan.out.has(g.keep))
    .map((g) => {
      const keep = takeoff.faces.get(g.keep);
      return { name: g.name, side: keep?.side || null, room: Boolean(keep?.room), keep: { id: g.keep, where: drawnWhere(keep) }, others: g.members.filter((m) => m.id !== g.keep).map((m) => ({ id: m.id, where: drawnWhere(m) })) };
    });
  const listOut = (p) => groupsCited(p).filter((g) => p.out.has(g.keep)).map((g) => ({ name: g.name, side: takeoff.faces.get(g.keep)?.side || null }));
  const names = (xs) => [...new Set(xs.map((x) => x.name))];
  const out = listOut(plan);
  // With the new rooms in: which ones they are (the same rule, read the other way).
  const added = plan.state?.value === "with_new" ? listOut(sameSurfacePlan(takeoff, { planState: { value: "existing", source: "person" } })) : [];
  const outNames = names(out);
  const newNames = names(added);
  // The sides whose cited faces are on a drawing of one state or the other:
  // a part of the read (the exterior quote) whose faces are on neither is
  // not "priced on the existing layout" — sameSurfaceForSide.
  const stateSides = [...new Set(ids.filter((id) => drawingState(takeoff.faces.get(id))).map((id) => takeoff.faces.get(id).side).filter(Boolean))];
  // Each drawing's verdict, for the "Measured on the drawings" list.
  const faces = {};
  for (const g of plan.groups) {
    if (g.members.length < 2) continue;
    const keep = takeoff.faces.get(g.keep);
    for (const m of g.members) faces[m.id] = m.id === g.keep ? { alsoOn: g.members.filter((x) => x.id !== g.keep).map(drawnWhere) } : { sameAs: drawnWhere(keep) };
  }
  for (const id of plan.out.keys()) faces[id] = { ...(faces[id] || {}), stateOut: true };
  if (!merged.length && !plan.state) return null;
  return { merged, state: plan.state, outNames, newNames, out, added, stateSides, drawings: plan.drawings, faces };
}

/**
 * The summary for ONE side of the read — the exterior quote and the interior
 * quote drafted from one read (lib/planRead/slices.js). Without it the
 * exterior quote's office notes carried the interior's "the proposed
 * extension rooms Cafe, Kitchen… are not included — include them?". Pure.
 */
export function sameSurfaceForSide(ss, side) {
  if (!ss) return null;
  const merged = (ss.merged || []).filter((g) => g.side === side);
  const hasState = Boolean(ss.state) && (ss.stateSides || []).includes(side);
  if (!merged.length && !hasState) return null;
  const pick = (xs) => [...new Set((xs || []).filter((x) => x.side === side).map((x) => x.name))];
  return {
    ...ss,
    merged,
    state: hasState ? ss.state : null,
    out: (ss.out || []).filter((x) => x.side === side),
    added: (ss.added || []).filter((x) => x.side === side),
    outNames: hasState ? pick(ss.out) : [],
    newNames: hasState ? pick(ss.added) : [],
  };
}
