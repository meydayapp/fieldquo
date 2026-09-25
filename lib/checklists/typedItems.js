// lib/checklists/typedItems.js
//
// What a typed checklist item means once a crew has it in hand: is it
// answered, which required ones are still empty, and how a template becomes a
// copy on a job or a visit.
//
// The item SHAPE is still decided in one place — lib/jobs/checklistItems.js —
// and this file only reads it. Pure and alias-free (relative import, with the
// extension) so scripts/check-checklist-templates.mjs runs it under plain node.
//
// ── Why `done` stays the one completion flag ───────────────────────────────
//
// Every surface that counts a checklist ("3/8 checklist items" on the job
// page, the crew's list) counts `done`. A typed answer therefore SETS `done`
// (answerItem below) rather than inventing a second notion of finished that
// those counts would not see. `isAnswered` is the rule for what counts.

import { normalizeChecklistItems } from "../jobs/checklistItems.js";

export const STOPLIGHT_VALUES = ["green", "amber", "red"];

/** Has the crew given this item the answer its type asks for? */
export function isAnswered(item) {
  if (!item || typeof item !== "object") return false;
  const r = item.response;
  switch (item.responseType) {
    case "text":
      return typeof r === "string" && r.trim().length > 0;
    case "numeric":
      return typeof r === "number" ? Number.isFinite(r) : r !== undefined && r !== null && r !== "" && Number.isFinite(Number(r));
    case "single_select":
      return typeof r === "string" && r.trim().length > 0;
    case "multi_select":
      return Array.isArray(r) && r.length > 0;
    case "stoplight":
      return STOPLIGHT_VALUES.includes(r);
    case "photo":
      return (item.media || []).some((m) => m && m.kind === "photo" && m.url);
    case "signature":
      return !!(r && typeof r === "object" && typeof r.dataUrl === "string" && r.dataUrl);
    default:
      // A tick, and the three legacy answer types the visit screen has always
      // treated as a tick (pass_fail_na, yes_no, date).
      return item.done === true;
  }
}

/**
 * Record an answer and keep `done` in step with it. Returns a NEW item.
 * `patch` is any of { response, media, note }.
 */
export function answerItem(item, patch) {
  const next = { ...item, ...patch };
  if (next.response === "" || next.response === undefined || (Array.isArray(next.response) && next.response.length === 0)) {
    delete next.response;
  }
  next.done = isAnswered(next);
  return next;
}

/**
 * The required items still empty, across any number of lists. What the job
 * close refusal names, so it says WHICH items rather than "some".
 */
export function unansweredRequired(...lists) {
  const missing = [];
  for (const list of lists) {
    for (const item of Array.isArray(list) ? list : []) {
      if (item && item.required === true && !isAnswered(item)) {
        missing.push({ label: item.label, checklist: item.checklist || null });
      }
    }
  }
  return missing;
}

/** "Painting — Primer applied; Cabinet painting — Client signature (and 3 more)". */
export function describeMissing(missing, max = 5) {
  const shown = missing.slice(0, max).map((m) => (m.checklist ? `${m.checklist} — ${m.label}` : m.label));
  const rest = missing.length - shown.length;
  return shown.join("; ") + (rest > 0 ? ` (and ${rest} more)` : "");
}

/** A template's name in `lang`, else English, else its own. */
export function templateName(template, lang) {
  const tr = template?.translations?.[lang]?.name || template?.translations?.en?.name;
  return (typeof tr === "string" && tr.trim()) || template?.name || "";
}

/**
 * How an item reads for someone working in `lang`: that language where the
 * item carries it, English next, the wording on the row last. `options` are
 * DISPLAY strings index-aligned with `item.options` — the stored answer is
 * always the row's own option, so an answer given in Punjabi and read in
 * French is the same answer.
 */
export function localizeItem(item, lang) {
  const mine = (item?.i18n && item.i18n[lang]) || {};
  const en = (item?.i18n && item.i18n.en) || {};
  const base = Array.isArray(item?.options) ? item.options : [];
  const pick = (key) => mine[key] || en[key] || item?.[key] || null;
  const optionsFrom = (list) =>
    Array.isArray(list) && list.length === base.length ? list : null;
  return {
    label: pick("label") || "",
    section: pick("section"),
    checklist: pick("checklist"),
    options: optionsFrom(mine.options) || optionsFrom(en.options) || base,
  };
}

/** The display text for a stored option answer (see localizeItem). */
export function optionLabel(item, value, lang) {
  const i = (item?.options || []).indexOf(value);
  if (i < 0) return value;
  return localizeItem(item, lang).options[i] ?? value;
}

/**
 * A template → the items a job or visit receives.
 *
 * The copy is taken once and never re-derived (the reason
 * lib/jobs/checklistItems.js gives for stamping phase on the item). It keeps
 * the template's wording in EVERY language (`i18n`), with the list's own name
 * in each language beside it, so each crew member reads it in theirs
 * (localizeItem) — the office applying a list in English does not decide the
 * language a Punjabi-speaking painter works in. The row's own label stays in
 * the company's language; `lang` only chooses which name leads.
 * `requiredToClose` on the template marks every item required; otherwise each
 * item keeps its own flag.
 */
export function itemsFromTemplate(template, lang) {
  const raw = Array.isArray(template?.items) ? template.items : [];
  const name = template?.name || templateName(template, lang);
  const names = template?.translations && typeof template.translations === "object" ? template.translations : {};
  const stamped = raw.map((item) => {
    if (!item || typeof item !== "object") return item;
    const next = { ...item };
    const i18n = { ...(item.i18n || {}) };
    for (const [l, tr] of Object.entries(names)) {
      if (tr && typeof tr.name === "string" && tr.name.trim()) {
        i18n[l] = { ...(i18n[l] || {}), checklist: tr.name.trim() };
      }
    }
    if (Object.keys(i18n).length) next.i18n = i18n;
    next.checklist = name;
    if (template.id) next.templateId = template.id;
    if (template.requiredToClose === true) next.required = true;
    return next;
  });
  return normalizeChecklistItems(stamped, { phase: template?.phase });
}

/**
 * Group a job's items into forms: `[{ checklist, templateId, sections: [{
 * section, items }] }]`, first-appearance order at both levels (the order the
 * author wrote them in). `index` into the original array is carried so a
 * control can write back to the right slot.
 */
export function groupByChecklist(items) {
  const forms = [];
  const byKey = new Map();
  (Array.isArray(items) ? items : []).forEach((item, index) => {
    if (!item) return;
    const key = item.templateId || item.checklist || "";
    if (!byKey.has(key)) {
      const form = { checklist: item.checklist || null, templateId: item.templateId || null, sections: [], _s: new Map() };
      byKey.set(key, form);
      forms.push(form);
    }
    const form = byKey.get(key);
    const sKey = item.section || "";
    if (!form._s.has(sKey)) {
      const section = { section: item.section || null, items: [] };
      form._s.set(sKey, section);
      form.sections.push(section);
    }
    form._s.get(sKey).items.push({ ...item, index });
  });
  return forms.map(({ _s, ...form }) => form);
}
