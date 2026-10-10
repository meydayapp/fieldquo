// lib/jobs/selections.js
//
// A job's colours and materials — "Uppers: BM Chantilly Lace OC-65, satin,
// 2 coats". The rules, the words and the quote → job copy, with no database
// and no React, so the job card, the quote builder, the work order and
// scripts/check-job-selections.mjs all execute the same functions.
//
// ══ Why this exists (owner, 2026-10-10) ════════════════════════════════════
//
// "For painting jobs shouldn't the job have the color needed? Roofing → color
// and type of shingle; painting → top coat color; epoxy → color and finish.
// If they use multiple colors it should allow for that. I'm looking at
// Q-2026-0022 and I don't see where I could put that."
//
// Until now the only colour anywhere was ONE Colour / Sheen / Door style on a
// cabinet group in the quote builder, written into the base line's meta and
// printed on the work order. Nothing on the job, nothing for any other trade,
// and one colour per kitchen. This adds rows — as many as the work has — on
// the job (JobSelection) and on each quote service (QuoteScopeGroup.selections),
// WITHOUT moving the single cabinet fields: they keep saving and printing
// exactly as before, and are shown as the first row wherever rows are shown.
//
// ══ What a template is, and is not ═════════════════════════════════════════
//
// Every row has the same fields whatever the trade. A template only SUGGESTS:
// the areas a painter names (walls, ceilings, trim), the finishes a roofer
// picks between (architectural, 3-tab), a placeholder for the product. It
// never limits what is typed and never fills a field on its own — a
// suggestion is a datalist under a text box, so the row says what the person
// chose and nothing the template chose for them (AGENTS.md failure class 5).
//
// ══ Absence stays absence ══════════════════════════════════════════════════
//
// Every field is optional and null when not stated. Coats is never 0: a row
// with no coats says nothing about coats. A row with nothing in it at all is
// refused on the job (it would print an empty line on the work order) and
// dropped on the quote (an unfilled new row in the builder is not a
// statement).
import { isUploadedUrl } from "./documents.js";

export const SELECTION_TEXT_LIMITS = Object.freeze({
  area: 80,
  product: 120,
  colourName: 80,
  colourCode: 40,
  finish: 40,
  notes: 500,
});
export const SELECTION_TEXT_FIELDS = Object.freeze(Object.keys(SELECTION_TEXT_LIMITS));
export const MAX_COATS = 20;
export const MAX_SELECTIONS_PER_JOB = 100;
export const MAX_SELECTIONS_PER_GROUP = 30;

// ── The trade templates ────────────────────────────────────────────────────
//
// Each suggestion is [i18n key, English]. The words are translated for the
// person typing (app/i18n/appMessages.js) and stored as they chose them — a
// French painter's row says "Murs", which is what their crew reads.
const S = (key, en) => Object.freeze([`app.selections.${key}`, en]);
const COMMON_FINISHES = [
  S("finish.flat", "Flat"),
  S("finish.matte", "Matte"),
  S("finish.eggshell", "Eggshell"),
  S("finish.satin", "Satin"),
  S("finish.semiGloss", "Semi-gloss"),
  S("finish.gloss", "Gloss"),
];

export const SELECTION_TEMPLATES = Object.freeze({
  painting: Object.freeze({
    label: S("tpl.painting", "Painting"),
    areas: [
      S("area.walls", "Walls"),
      S("area.ceilings", "Ceilings"),
      S("area.trim", "Trim"),
      S("area.doors", "Doors"),
      S("area.accentWall", "Accent wall"),
      S("area.siding", "Siding"),
    ],
    finishes: COMMON_FINISHES,
    productHint: S("hint.painting", "e.g. Benjamin Moore Regal Select"),
  }),
  cabinets: Object.freeze({
    label: S("tpl.cabinets", "Cabinets"),
    areas: [
      S("area.uppers", "Uppers"),
      S("area.lowers", "Lowers"),
      S("area.island", "Island"),
      S("area.boxes", "Boxes and frames"),
      S("area.interiors", "Interiors"),
    ],
    // The stain kinds lib/pricing/stainFinish.js prices (gel or liquid), as
    // finishes a person can pick — never inferred from the quote's tick.
    finishes: [
      S("finish.matte", "Matte"),
      S("finish.satin", "Satin"),
      S("finish.semiGloss", "Semi-gloss"),
      S("finish.gloss", "Gloss"),
      S("finish.gelStain", "Gel stain"),
      S("finish.liquidStain", "Liquid stain"),
    ],
    productHint: S("hint.cabinets", "e.g. Benjamin Moore Advance"),
  }),
  roofing: Object.freeze({
    label: S("tpl.roofing", "Roofing"),
    areas: [
      S("area.shingles", "Shingles"),
      S("area.underlayment", "Underlayment"),
      S("area.dripEdge", "Drip edge"),
      S("area.ridgeCap", "Ridge cap"),
      S("area.flashing", "Flashing"),
    ],
    finishes: [
      S("finish.architectural", "Architectural"),
      S("finish.threeTab", "3-tab"),
      S("finish.designer", "Designer"),
      S("finish.metal", "Metal"),
    ],
    productHint: S("hint.roofing", "e.g. GAF Timberline HDZ"),
  }),
  epoxy: Object.freeze({
    label: S("tpl.epoxy", "Epoxy & coatings"),
    areas: [
      S("area.baseCoat", "Base coat"),
      S("area.flake", "Flake"),
      S("area.topcoat", "Topcoat"),
    ],
    finishes: [
      S("finish.gloss", "Gloss"),
      S("finish.satin", "Satin"),
      S("finish.matte", "Matte"),
    ],
    productHint: S("hint.epoxy", "e.g. full-flake system, polyaspartic topcoat"),
  }),
  flooring: Object.freeze({
    label: S("tpl.flooring", "Flooring"),
    areas: [
      S("area.floor", "Floor"),
      S("area.stairs", "Stairs"),
      S("area.transitions", "Transitions"),
      S("area.baseboard", "Baseboard"),
    ],
    finishes: [
      S("finish.matte", "Matte"),
      S("finish.satin", "Satin"),
      S("finish.semiGloss", "Semi-gloss"),
      S("finish.gloss", "Gloss"),
    ],
    productHint: S("hint.flooring", "e.g. Shaw Floorté Pro"),
  }),
  generic: Object.freeze({
    label: S("tpl.generic", "Other"),
    areas: [],
    finishes: [],
    productHint: S("hint.generic", "Brand and product"),
  }),
});
export const SELECTION_TEMPLATE_KEYS = Object.freeze(Object.keys(SELECTION_TEMPLATES));

/** Every i18n key a template can print — for the translations check. */
export function selectionTemplateMessageKeys() {
  const out = new Set();
  for (const tpl of Object.values(SELECTION_TEMPLATES)) {
    out.add(tpl.label[0]);
    out.add(tpl.productHint[0]);
    for (const [k] of [...tpl.areas, ...tpl.finishes]) out.add(k);
  }
  return [...out];
}

// The trades whose service key says plainly which template they are. Anything
// else falls to the patterns below, and then to "generic" — a guess at a
// trade's suggestions would only put words in front of somebody who did not
// sell that work.
const TRADE_TEMPLATE = Object.freeze({
  interior_painting: "painting",
  exterior_painting: "painting",
  cabinet_refinishing: "cabinets",
  cabinet_refacing: "cabinets",
  kitchen_design: "cabinets",
  roofing_service: "roofing",
  roofing: "roofing",
  epoxy: "epoxy",
  flooring: "flooring",
  flooring_install: "flooring",
});

/** The template a service category key edits its rows with. */
export function templateKeyForTrade(categoryKey) {
  const key = String(categoryKey || "").toLowerCase();
  if (!key) return "generic";
  if (TRADE_TEMPLATE[key]) return TRADE_TEMPLATE[key];
  // Order matters: an "epoxy_floor" key is a coating, not a floor.
  if (/epoxy/.test(key)) return "epoxy";
  if (/cabinet/.test(key)) return "cabinets";
  if (/roof/.test(key)) return "roofing";
  if (/paint/.test(key)) return "painting";
  if (/floor/.test(key)) return "flooring";
  return "generic";
}

/** A template key from a request, or the fallback when it names none. */
export function normaliseTemplateKey(raw, fallback = "generic") {
  return SELECTION_TEMPLATE_KEYS.includes(raw) ? raw : fallback;
}

// ── Cleaning one row ───────────────────────────────────────────────────────

function cleanText(value, max, { multiline = false } = {}) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" && typeof value !== "number") return null;
  let s = String(value);
  s = multiline
    ? s.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n")
    : s.replace(/\s+/g, " ");
  s = s.trim().slice(0, max).trim();
  return s || null;
}

/**
 * Coats as stated, or null. `ok: false` for a value that is present and not a
 * whole number between 1 and MAX_COATS — refused rather than rounded, because
 * "2.5 coats" rounded to 3 is a number nobody typed.
 */
export function parseCoats(value) {
  if (value === null || value === undefined || value === "") return { ok: true, value: null };
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > MAX_COATS) return { ok: false, value: null };
  return { ok: true, value: n };
}

/** True when a row states nothing at all. */
export function isBlankSelection(row) {
  if (!row || typeof row !== "object") return true;
  if (SELECTION_TEXT_FIELDS.some((f) => cleanText(row[f], 10000))) return false;
  if (row.coats !== null && row.coats !== undefined && row.coats !== "" && Number(row.coats) > 0) return false;
  if (row.swatchUrl) return false;
  return true;
}

/**
 * One row from a request body → the columns to write, or a refusal.
 *
 * @param raw        the body
 * @param partial    true on a PATCH: only the keys PRESENT are returned, so an
 *                   edit to the notes cannot blank the colour
 * @param cloudName  our Cloudinary cloud — a swatch anywhere else is refused
 * @returns {{ ok: true, data } | { ok: false, code, error }}
 */
export function normaliseSelectionInput(raw, { partial = false, cloudName = null } = {}) {
  const body = raw && typeof raw === "object" ? raw : {};
  const data = {};
  for (const f of SELECTION_TEXT_FIELDS) {
    if (partial && !(f in body)) continue;
    data[f] = cleanText(body[f], SELECTION_TEXT_LIMITS[f], { multiline: f === "notes" });
  }
  if (!partial || "coats" in body) {
    const coats = parseCoats(body.coats);
    if (!coats.ok) {
      return { ok: false, code: "coats", error: `Coats must be a whole number from 1 to ${MAX_COATS}.` };
    }
    data.coats = coats.value;
  }
  if (!partial || "swatchUrl" in body) {
    const url = body.swatchUrl;
    if (url === null || url === undefined || url === "") {
      data.swatchUrl = null;
    } else if (isUploadedUrl(url, { cloudName })) {
      data.swatchUrl = String(url).slice(0, 1000);
    } else {
      // Refused, not dropped: dropping it would answer "saved" with the
      // photo silently missing.
      return { ok: false, code: "swatch", error: "That swatch photo wasn't uploaded here. Upload it again." };
    }
  }
  if (!partial || "templateKey" in body) {
    data.templateKey = normaliseTemplateKey(body.templateKey);
  }
  if (!partial && isBlankSelection(data)) {
    return { ok: false, code: "empty", error: "Say at least the area, the product or the colour." };
  }
  return { ok: true, data };
}

// ── The words ──────────────────────────────────────────────────────────────

/**
 * One row as the crew reads it: "Uppers: BM Chantilly Lace OC-65, satin,
 * 2 coats". The notes are returned apart — they are a sentence, not a spec.
 *
 * @param coatsText  (n) => "2 coats" in the reader's language
 * @returns {{ line: string, notes: string|null }}
 */
export function formatSelectionLine(row, { coatsText = (n) => `${n} coat${n === 1 ? "" : "s"}` } = {}) {
  const r = row && typeof row === "object" ? row : {};
  const t = (f) => cleanText(r[f], SELECTION_TEXT_LIMITS[f] || 500);
  const what = [t("product"), t("colourName"), t("colourCode")].filter(Boolean).join(" ");
  const coats = Number(r.coats) > 0 ? coatsText(Number(r.coats)) : null;
  const spec = [what, t("finish"), coats].filter(Boolean).join(", ");
  const area = t("area");
  const line = area && spec ? `${area}: ${spec}` : area || spec || "";
  return { line, notes: cleanText(r.notes, SELECTION_TEXT_LIMITS.notes, { multiline: true }) };
}

// ── The cabinet group's own Colour / Sheen / Door style ────────────────────

/**
 * The single finish a cabinet group has always carried, from wherever it lives
 * on the group in hand: on an unsaved builder group as `color` / `sheen` /
 * `doorStyle`; on a saved one in the base line's `meta` (the builder writes
 * them there — lib/quotes/builderPayload.js), with the intake as the last
 * resort, the same read order lib/workOrder/build.js finishFacts uses. Top
 * coats ride along from the intake when stated. Null when none of the three
 * was given — coats alone are a pricing answer, not a colour.
 */
export function legacyFinishOf(group) {
  if (!group || typeof group !== "object") return null;
  const lines = Array.isArray(group.lineItems) ? group.lineItems : [];
  const meta = lines.find((l) => l && l.meta && typeof l.meta === "object")?.meta || {};
  const iv = group.intakeValues && typeof group.intakeValues === "object" ? group.intakeValues : {};
  const first = (...vals) => {
    for (const v of vals) {
      const s = cleanText(v, 80);
      if (s) return s;
    }
    return null;
  };
  const colour = first(group.color, meta.colour, meta.color, iv.colour, iv.color);
  const sheen = first(group.sheen, meta.sheen, iv.sheen);
  const doorStyle = first(group.doorStyle, meta.doorStyle, iv.doorStyle);
  if (!colour && !sheen && !doorStyle) return null;
  const coats = parseCoats(group.topCoats ?? iv.topCoats);
  return { colour, sheen, doorStyle, coats: coats.ok ? coats.value : null };
}

/** The legacy finish as a row in the JobSelection shape. */
export function legacyFinishRow(group, { doorStyleText = (v) => `Door style: ${v}`, area = null } = {}) {
  const f = legacyFinishOf(group);
  if (!f) return null;
  return {
    area: cleanText(area, SELECTION_TEXT_LIMITS.area),
    product: null,
    colourName: f.colour ? f.colour.slice(0, SELECTION_TEXT_LIMITS.colourName) : null,
    colourCode: null,
    finish: f.sheen ? f.sheen.slice(0, SELECTION_TEXT_LIMITS.finish) : null,
    coats: f.coats,
    notes: f.doorStyle ? cleanText(doorStyleText(f.doorStyle), SELECTION_TEXT_LIMITS.notes) : null,
  };
}

// ── A quote service's added rows (QuoteScopeGroup.selections) ──────────────

const ROW_ID = /^[A-Za-z0-9_-]{1,64}$/;

function newRowId() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return `sel-${c.randomUUID().slice(0, 13)}`;
  return `sel-${Math.random().toString(36).slice(2, 12)}`;
}

/** A fresh row for the builder. Blank: nothing is stated until it is typed. */
export function newQuoteSelectionRow() {
  return { id: newRowId(), area: "", product: "", colourName: "", colourCode: "", finish: "", coats: "", notes: "" };
}

/**
 * The rows a quote service carries, as they are stored: cleaned, blanks
 * dropped, ids kept (they are what makes a second "Pull from quote" add only
 * what is missing), capped. Null when nothing is left — the column holds null,
 * never [], for a group with no rows. No swatch on the quote: a photo is the
 * job's (uploaded on site, against the real cabinet door).
 *
 * A coats value that is not a whole number in range is dropped from that row
 * rather than refusing the whole quote save — the builder's box is a number
 * input, and the row's colour is worth more than a typo in its coats.
 */
export function normaliseQuoteGroupSelections(raw, { makeId = newRowId } = {}) {
  if (!Array.isArray(raw)) return null;
  const seen = new Set();
  const out = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const row = {};
    for (const f of SELECTION_TEXT_FIELDS) {
      row[f] = cleanText(r[f], SELECTION_TEXT_LIMITS[f], { multiline: f === "notes" });
    }
    const coats = parseCoats(r.coats);
    row.coats = coats.ok ? coats.value : null;
    if (isBlankSelection(row)) continue;
    // A missing or duplicate id gets a fresh one; a makeId that answers
    // nothing (the quote → job copy, which must never invent a sourceKey)
    // skips the row instead.
    let id = typeof r.id === "string" && ROW_ID.test(r.id) ? r.id : makeId();
    while (id && seen.has(id)) id = makeId();
    if (!id) continue;
    seen.add(id);
    out.push({ id, ...row });
    if (out.length >= MAX_SELECTIONS_PER_GROUP) break;
  }
  return out.length ? out : null;
}

/**
 * What scopeGroupPayload sends for a builder group's rows: the cleaned rows;
 * `[]` when a group that HAD stored rows has had them all removed (so the save
 * clears them); `undefined` — the key absent — otherwise. Absent is what keeps
 * a group nobody added a row to byte-identical to the payload it sent before
 * rows existed (scripts/check-job-selections.mjs holds the md5s).
 */
export function groupSelectionsForPayload(group) {
  const rows = Array.isArray(group?.selections) ? group.selections : [];
  const cleaned = normaliseQuoteGroupSelections(rows, { makeId: newRowId }) || [];
  if (cleaned.length) return cleaned;
  return group?.selectionsStored ? [] : undefined;
}

// ── Quote → job ────────────────────────────────────────────────────────────

/** The sourceKey of a quote row on a job — see JobSelection.sourceKey. */
export const finishSourceKey = (groupId) => `qsg:${groupId}:finish`;
export const rowSourceKey = (groupId, rowId) => `qsg:${groupId}:${rowId}`;

/**
 * Every row an accepted quote carries, in the order the job lists them: per
 * service in its sort order, the cabinet finish first (it is "the first row"
 * wherever rows are shown), then the service's added rows.
 *
 * @param groups  [{ id, label, category: { key, label }, lineItems,
 *                  intakeValues, selections }] — the quote's scope groups
 * @param doorStyleText  (v) => "Door style: slab" in the company's language
 * @returns rows with sourceKey, quoteScopeGroupId and templateKey set
 */
export function selectionCandidatesFromGroups(groups, { doorStyleText } = {}) {
  const out = [];
  for (const g of Array.isArray(groups) ? groups : []) {
    if (!g || !g.id) continue;
    const templateKey = templateKeyForTrade(g.category?.key);
    const area = cleanText(g.label || g.category?.label, SELECTION_TEXT_LIMITS.area);
    const legacy = legacyFinishRow(g, { doorStyleText, area });
    if (legacy) {
      out.push({ ...legacy, sourceKey: finishSourceKey(g.id), quoteScopeGroupId: g.id, templateKey });
    }
    // makeId answers nothing: a stored row always has an id, and one without
    // could not be pulled idempotently, so it is skipped rather than given a
    // key that would differ on the next pull.
    for (const row of normaliseQuoteGroupSelections(g.selections, { makeId: () => null }) || []) {
      const { id, ...fields } = row;
      out.push({ ...fields, swatchUrl: null, sourceKey: rowSourceKey(g.id, id), quoteScopeGroupId: g.id, templateKey });
    }
  }
  return out;
}

/** The templates a job's quote services suggest, first service first. */
export function templatesForGroups(groups) {
  const keys = [];
  for (const g of Array.isArray(groups) ? groups : []) {
    const k = templateKeyForTrade(g?.category?.key);
    if (!keys.includes(k)) keys.push(k);
  }
  return keys;
}
