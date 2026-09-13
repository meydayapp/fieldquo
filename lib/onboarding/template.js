// lib/onboarding/template.js
//
// The shape of a new-hire checklist, and the one function that decides
// whether a browser's version of one is allowed into the database.
//
// ══ Why items are Json and validated here ══════════════════════════════════
//
// A checklist is a list of a dozen small things with four different kinds.
// A table per kind would be four tables with one row each per company, and a
// template that reorders on drag would be four updates. The list is stored
// as one Json column and THIS file is the boundary — the same job
// app/data/siteBlocks.js's sanitiseBlocks does for the website builder —
// so nothing with an unknown kind, a blank label, a negative due day or a
// foreign policy id is ever written.
//
// ══ Item kinds ═════════════════════════════════════════════════════════════
//
//   task      — something to do or be shown; the worker or a manager ticks it
//   document  — a document of `documentKind` the worker must upload
//               (lib/hr/documents.js WORKER_DOCUMENT_KINDS); done when a
//               non-archived document of that kind exists on their file
//   policy    — a CompanyPolicy (`policyId`) to read and sign; done when a
//               PolicyAcknowledgement for its current version exists
//   form      — a tax form (`formKind`, lib/hr/taxForms.js); done when a
//               TaxFormSubmission of that kind exists
//
// `dueDays` counts from the run's start (the hire's first day on the
// checklist), null means no deadline. `required` decides whether the run can
// complete without it.
import { WORKER_DOCUMENT_KINDS } from "@/lib/hr/documents";
import { TAX_FORM_KINDS } from "@/lib/hr/taxForms";

export const ITEM_KINDS = Object.freeze(["task", "document", "policy", "form"]);
const KIND_SET = new Set(ITEM_KINDS);

export const MAX_ITEMS = 60;
const LABEL_MAX = 160;
const KEY_MAX = 40;
const DUE_MAX = 365;

/** A stable per-item key: what the browser sent if it is clean, else derived. */
function keyFor(raw, index) {
  const k = typeof raw === "string" ? raw.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") : "";
  return (k || `item-${index + 1}`).slice(0, KEY_MAX);
}

/**
 * The template's items, cleaned — or an error naming the first bad one.
 *
 * @param items          what the browser sent
 * @param opts.policyIds the company's own policy ids, so a policy item can
 *                       only point INSIDE the tenant. A missing set refuses
 *                       every policy item rather than trusting the id.
 * @returns {{ items }} or {{ error }}
 */
export function normaliseTemplateItems(items, { policyIds = new Set() } = {}) {
  if (!Array.isArray(items)) return { error: "The checklist must be a list of items." };
  if (items.length === 0) return { error: "A checklist needs at least one item." };
  if (items.length > MAX_ITEMS) return { error: `A checklist can hold at most ${MAX_ITEMS} items.` };

  const out = [];
  const seen = new Set();
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it || typeof it !== "object") return { error: `Item ${i + 1} isn't an item.` };
    const kind = typeof it.kind === "string" ? it.kind : "task";
    if (!KIND_SET.has(kind)) return { error: `Item ${i + 1}: "${String(it.kind).slice(0, 30)}" isn't an item kind.` };
    const label = typeof it.label === "string" ? it.label.trim().slice(0, LABEL_MAX) : "";
    if (!label) return { error: `Item ${i + 1} needs a label.` };

    let key = keyFor(it.key, i);
    while (seen.has(key)) key = `${key}-${i + 1}`.slice(0, KEY_MAX);
    seen.add(key);

    let dueDays = null;
    if (it.dueDays !== undefined && it.dueDays !== null && it.dueDays !== "") {
      const n = Number(it.dueDays);
      if (!Number.isInteger(n) || n < 0 || n > DUE_MAX) {
        return { error: `Item ${i + 1}: due days must be a whole number between 0 and ${DUE_MAX}.` };
      }
      dueDays = n;
    }

    const row = { key, label, kind, required: it.required !== false, dueDays };

    if (kind === "document") {
      if (!WORKER_DOCUMENT_KINDS.includes(it.documentKind)) {
        return { error: `Item ${i + 1}: pick which document kind is expected.` };
      }
      row.documentKind = it.documentKind;
    }
    if (kind === "policy") {
      if (typeof it.policyId !== "string" || !policyIds.has(it.policyId)) {
        return { error: `Item ${i + 1}: that policy isn't one of this company's.` };
      }
      row.policyId = it.policyId;
    }
    if (kind === "form") {
      if (!TAX_FORM_KINDS.includes(it.formKind)) {
        return { error: `Item ${i + 1}: pick which tax form is expected.` };
      }
      row.formKind = it.formKind;
    }
    out.push(row);
  }
  return { items: out };
}

/** The template name, or a fallback — never blank. */
export function normaliseTemplateName(raw, fallback = "New hire checklist") {
  const name = typeof raw === "string" ? raw.trim().slice(0, 80) : "";
  return name || fallback;
}
