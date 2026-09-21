// lib/sales/calls/subDispositions.js
//
// The sub-reason under an outcome: "Not now — already has software",
// "Wrong number — disconnected". A closed list per outcome, picked in the
// disposition sheet, stored on the attempt, counted on the platform.
//
// ══ Where it comes from ═══════════════════════════════════════════════════
//
// OMniLeads (LGPL-3.0, read for design only — never copied):
// OpcionCalificacion.subcalificaciones (ominicontacto_app/models.py ~1674–
// 1732) is a JSON list of strings hanging off each disposition option, and
// CalificacionCliente.subcalificacion (~2983–3110) is the one the agent
// picked, stored as text beside the disposition. reportes_app/views_reportes.py
// (~150–165) prints it beside the disposition name in the per-contact
// history. That is the whole model: a list per option, one pick per
// disposition, shown in reports. Kept.
//
// ══ What is code and what is a setting ════════════════════════════════════
//
// lib/sales/calls/dispositions.js's header explains why the OUTCOMES are a
// closed vocabulary: each one carries code behaviour. A sub-reason carries
// none — it changes no claim, no status, no retry — so it is the one part of
// the vocabulary a superadmin MAY edit (the platform page under
// /platform/sales/outcomes), and the defaults below are what the floor runs
// on until somebody does. The edited lists live in PlatformSetting
// `sales.subDispositions`; effectiveSubDispositions() merges them.
//
// ══ Which outcomes take one ═══════════════════════════════════════════════
//
// Only outcomes a REP picks and that have a "why" worth counting. Never one
// the line writes (AUTO_LOGGED_CODES — nobody was there to say why), never
// callback or agreed (the outcome IS the reason). validateSubDispositionLists
// refuses a list on any other code.
//
// ══ Labels travel with the entry ══════════════════════════════════════════
//
// A default entry carries en/fr/es in this file; an edited entry carries
// whatever the superadmin typed for each. The rep's sheet prints the label
// in the rep's language and falls back to English — a custom entry cannot
// be in app/i18n/appMessages.js, and refusing custom entries because of
// that would make the editor a dead control.
//
// ══ Pure ═════════════════════════════════════════════════════════════════
//
// No db, no clock. scripts/check-sales-outcomes.mjs drives every branch.

import { AUTO_LOGGED_CODES, isDisposition } from "./dispositions";

/** The PlatformSetting key the edited lists live under. */
export const SUB_DISPOSITIONS_KEY = "sales.subDispositions";

/** The outcomes that MAY carry a list. Everything else refuses one. */
export const SUB_DISPOSITION_CODES = Object.freeze(["reached_not_interested", "bad_number", "not_a_fit", "gatekeeper", "do_not_call", "voicemail", "text_instead"]);

export const MAX_SUB_DISPOSITIONS_PER_CODE = 12;
export const MAX_SUB_DISPOSITION_DETAIL = 80;
const KEY_RE = /^[a-z][a-z0-9_]{1,39}$/;

const entry = (key, en, fr, es, extra = {}) => Object.freeze({ key, label: Object.freeze({ en, fr, es }), askDetail: false, ...extra });

/**
 * The defaults. `askDetail` marks the one entry per list that needs a word
 * from the rep — the competitor's name — stored in subDispositionDetail,
 * never mixed into the note.
 */
export const DEFAULT_SUB_DISPOSITIONS = Object.freeze({
  reached_not_interested: Object.freeze([
    entry("already_has_software", "Already has software", "A déjà un logiciel", "Ya tiene un software"),
    entry("too_small", "Too small — works alone or by hand", "Trop petit — travaille seul ou à la main", "Demasiado pequeño — trabaja solo o a mano"),
    entry("no_budget", "No budget right now", "Pas de budget pour l'instant", "Sin presupuesto por ahora"),
    entry("bad_timing", "Bad timing — busy season, ring later", "Mauvais moment — haute saison, rappeler plus tard", "Mal momento — temporada alta, llamar más tarde"),
    entry("using_competitor", "Using a competitor", "Utilise un concurrent", "Usa un competidor", {
      askDetail: true,
      detailLabel: Object.freeze({ en: "Which one?", fr: "Lequel ?", es: "¿Cuál?" }),
    }),
    entry("happy_as_is", "Happy with paper and phone", "Satisfait du papier et du téléphone", "Contento con papel y teléfono"),
  ]),
  bad_number: Object.freeze([
    entry("disconnected", "Disconnected or not in service", "Hors service ou déconnecté", "Desconectado o fuera de servicio"),
    entry("different_business", "A different business answered", "Une autre entreprise a répondu", "Contestó otro negocio"),
    entry("personal_line", "A personal line, not the business", "Une ligne personnelle, pas l'entreprise", "Una línea personal, no el negocio"),
    entry("fax_or_modem", "Fax or modem tone", "Tonalité de fax ou de modem", "Tono de fax o módem"),
  ]),
  not_a_fit: Object.freeze([
    entry("retailer_or_supplier", "A retailer or supplier, not a contractor", "Un détaillant ou fournisseur, pas un entrepreneur", "Un comercio o proveedor, no un contratista"),
    entry("franchise_head_office", "A franchise head office", "Un siège de franchise", "Una oficina central de franquicia"),
    entry("out_of_business", "Out of business", "A fermé", "Cerró el negocio"),
    entry("wrong_trade", "Wrong trade for what we sell", "Mauvais métier pour ce que nous vendons", "Oficio equivocado para lo que vendemos"),
    entry("no_field_work", "No field work — office or online only", "Pas de travail sur le terrain — bureau ou en ligne seulement", "Sin trabajo de campo — solo oficina o en línea"),
  ]),
  gatekeeper: Object.freeze([
    entry("receptionist", "Receptionist or answering service", "Réceptionniste ou service de réponse", "Recepcionista o servicio de contestación"),
    entry("partner_or_family", "Partner or family member", "Associé ou membre de la famille", "Socio o familiar"),
    entry("employee", "An employee or apprentice", "Un employé ou apprenti", "Un empleado o aprendiz"),
  ]),
  do_not_call: Object.freeze([]),
  voicemail: Object.freeze([]),
  text_instead: Object.freeze([]),
});

/** A label in the rep's language, falling back to English. */
export function subDispositionLabel(e, language = "en") {
  if (!e || typeof e !== "object") return "";
  const l = e.label && typeof e.label === "object" ? e.label : {};
  return String(l[language] || l.en || e.key || "");
}

export function subDispositionDetailLabel(e, language = "en") {
  if (!e || typeof e !== "object" || !e.askDetail) return "";
  const l = e.detailLabel && typeof e.detailLabel === "object" ? e.detailLabel : {};
  return String(l[language] || l.en || "");
}

function cleanLabel(raw) {
  if (typeof raw === "string") return { en: raw.trim().slice(0, 80) };
  if (!raw || typeof raw !== "object") return null;
  const out = {};
  for (const lang of ["en", "fr", "es"]) {
    if (typeof raw[lang] === "string" && raw[lang].trim()) out[lang] = raw[lang].trim().slice(0, 80);
  }
  return out.en ? out : null;
}

/**
 * Validate one outcome's list as a superadmin would submit it. Returns the
 * cleaned entries or the sentence that refuses them. Pure.
 *
 * @returns {{ ok: true, entries } | { ok: false, error }}
 */
export function validateSubDispositionList(code, raw) {
  if (!isDisposition(code)) return { ok: false, error: `"${String(code)}" is not a call outcome.` };
  if (!SUB_DISPOSITION_CODES.includes(code)) {
    return { ok: false, error: `"${code}" cannot carry sub-reasons — ${AUTO_LOGGED_CODES.includes(code) ? "the line writes it, nobody was there to say why" : "the outcome is the reason"}.` };
  }
  if (!Array.isArray(raw)) return { ok: false, error: `${code}: send a list.` };
  if (raw.length > MAX_SUB_DISPOSITIONS_PER_CODE) return { ok: false, error: `${code}: at most ${MAX_SUB_DISPOSITIONS_PER_CODE} sub-reasons. A longer list is a form nobody fills in on a phone.` };
  const seen = new Set();
  const entries = [];
  for (const item of raw) {
    const key = typeof item?.key === "string" ? item.key.trim() : "";
    if (!KEY_RE.test(key)) return { ok: false, error: `${code}: "${key || "(empty)"}" is not a usable key — lowercase letters, digits and underscores, 2 to 40 characters.` };
    if (seen.has(key)) return { ok: false, error: `${code}: "${key}" appears twice.` };
    const label = cleanLabel(item?.label);
    if (!label) return { ok: false, error: `${code}: "${key}" needs an English label at least.` };
    const askDetail = item?.askDetail === true;
    const detailLabel = askDetail ? cleanLabel(item?.detailLabel) || { en: "Which?" } : undefined;
    seen.add(key);
    entries.push({ key, label, askDetail, ...(askDetail ? { detailLabel } : {}) });
  }
  return { ok: true, entries };
}

/** The whole object at once — every key must survive. */
export function validateSubDispositionLists(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, errors: ["Send an object keyed by outcome."] };
  const errors = [];
  const lists = {};
  for (const [code, list] of Object.entries(raw)) {
    const r = validateSubDispositionList(code, list);
    if (!r.ok) errors.push(r.error);
    else lists[code] = r.entries;
  }
  return errors.length ? { ok: false, errors } : { ok: true, lists };
}

/**
 * The lists a request runs on: the defaults, with each outcome's list
 * replaced by the stored one WHERE the stored one is valid. A stored empty
 * list is a deliberate "no sub-reasons here" and is honoured; a stored list
 * that fails validation falls back to the default for that outcome and is
 * named in `fallbacks`.
 *
 * @returns {{ lists: {[code]: entries[]}, source: {[code]: "default"|"custom"}, fallbacks: string[] }}
 */
export function effectiveSubDispositions(stored) {
  const src = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const lists = {};
  const source = {};
  const fallbacks = [];
  for (const code of SUB_DISPOSITION_CODES) {
    if (Object.hasOwn(src, code)) {
      const r = validateSubDispositionList(code, src[code]);
      if (r.ok) {
        lists[code] = r.entries;
        source[code] = "custom";
        continue;
      }
      fallbacks.push(`${code}: ${r.error}`);
    }
    lists[code] = DEFAULT_SUB_DISPOSITIONS[code].map((e) => ({ ...e, label: { ...e.label }, ...(e.detailLabel ? { detailLabel: { ...e.detailLabel } } : {}) }));
    source[code] = "default";
  }
  return { lists, source, fallbacks };
}

/** The list for one code, or [] — total. */
export function subDispositionsFor(code, lists) {
  const src = lists && typeof lists === "object" ? lists : effectiveSubDispositions(null).lists;
  const l = src[code];
  return Array.isArray(l) ? l : [];
}

/**
 * What a rep's pick means for the write. Pure and total.
 *
 *   - an outcome with a non-empty list and no pick → refused
 *   - a pick that is not on the list → refused
 *   - a pick on an outcome with no list → refused (the sheet has a bug)
 *   - an entry that asks a detail and gets none → refused
 *
 * @returns {{ ok: true, subDisposition: string|null, detail: string|null }
 *         | { ok: false, reasonKey: string, reason: string }}
 */
export function validateSubDispositionPick({ code, subDisposition = null, detail = null, lists = null } = {}) {
  const list = subDispositionsFor(code, lists);
  const pick = typeof subDisposition === "string" ? subDisposition.trim() : "";
  const text = typeof detail === "string" ? detail.trim().slice(0, MAX_SUB_DISPOSITION_DETAIL) : "";
  if (list.length === 0) {
    if (pick) return { ok: false, reasonKey: "app.salesCall.sub.notTaken", reason: `"${code}" does not take a sub-reason.` };
    return { ok: true, subDisposition: null, detail: null };
  }
  if (!pick) return { ok: false, reasonKey: "app.salesCall.sub.required", reason: "Pick the reason under the outcome — it is what the objection library learns from." };
  const e = list.find((x) => x.key === pick);
  if (!e) return { ok: false, reasonKey: "app.salesCall.sub.unknown", reason: `"${pick}" is not one of the reasons under this outcome.` };
  if (e.askDetail && !text) return { ok: false, reasonKey: "app.salesCall.sub.needsDetail", reason: `"${subDispositionLabel(e)}" needs the name.` };
  return { ok: true, subDisposition: e.key, detail: e.askDetail ? text : null };
}

/** Every reason key validateSubDispositionPick can print, for the copy check. */
export const SUB_DISPOSITION_REFUSAL_KEYS = Object.freeze([
  "app.salesCall.sub.notTaken",
  "app.salesCall.sub.required",
  "app.salesCall.sub.unknown",
  "app.salesCall.sub.needsDetail",
]);

/**
 * Count outcomes by sub-reason over a set of attempts — the breakdown the
 * platform performance page and the objection library read. Pure. Rows
 * without a sub-reason are counted under `none` so the denominator is the
 * outcome's total, not the share that had a list.
 *
 * @returns {{ [code]: { total, bySub: { [key]: count }, none: number, details: { [key]: { [detail]: count } } } }}
 */
export function subDispositionCounts(attempts = [], { lists = null } = {}) {
  const out = {};
  for (const row of Array.isArray(attempts) ? attempts : []) {
    const code = row?.disposition;
    if (!code || !SUB_DISPOSITION_CODES.includes(code)) continue;
    if (!out[code]) out[code] = { total: 0, bySub: {}, none: 0, details: {} };
    const o = out[code];
    o.total += 1;
    const sub = typeof row.subDisposition === "string" && row.subDisposition ? row.subDisposition : null;
    if (!sub) {
      o.none += 1;
      continue;
    }
    o.bySub[sub] = (o.bySub[sub] || 0) + 1;
    const detail = typeof row.subDispositionDetail === "string" && row.subDispositionDetail.trim() ? row.subDispositionDetail.trim().toLowerCase() : null;
    if (detail) {
      if (!o.details[sub]) o.details[sub] = {};
      o.details[sub][detail] = (o.details[sub][detail] || 0) + 1;
    }
  }
  // Label every key the screen will print, from the lists it runs on.
  const src = lists || effectiveSubDispositions(null).lists;
  for (const [code, o] of Object.entries(out)) {
    // The share is computed here, not on the screen: the performance page
    // prints the module's numbers and does no division of its own
    // (scripts/check-sales-admin.mjs holds it to that).
    o.rows = Object.entries(o.bySub)
      .map(([key, count]) => ({ key, count, percent: o.total > 0 ? Math.round((count / o.total) * 100) : null, label: subDispositionLabel(subDispositionsFor(code, src).find((e) => e.key === key) || { key }) }))
      .sort((a, b) => b.count - a.count);
  }
  return out;
}
