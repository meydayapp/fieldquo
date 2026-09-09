// lib/leads/qualifiers.js
//
// The two universal qualifying questions every self-quote lead now answers —
// budget and timeline — as stable KEYS, never display strings. The public form
// renders localized/branded labels from these; scoring and the leads UI sort on
// the keys. Keeping the vocabulary in one place stops the form, the scorer and
// the pipeline from ever disagreeing about what "5k_15k" means.
//
// Budget is the CLIENT stating their own budget — that's theirs to share, and
// nothing here exposes the company's rate card (non-negotiable #4). The bands
// are round numbers that read the same across currencies; the form prefixes the
// company's currency symbol.

export const BUDGET_BANDS = [
  { key: "unsure", min: null, max: null },
  { key: "under_1k", min: 0, max: 1000 },
  { key: "1k_5k", min: 1000, max: 5000 },
  { key: "5k_15k", min: 5000, max: 15000 },
  { key: "15k_plus", min: 15000, max: null },
];

export const TIMELINES = [
  { key: "asap", urgency: 3 },
  { key: "2_weeks", urgency: 2 },
  { key: "1_3_months", urgency: 1 },
  { key: "exploring", urgency: 0 },
];

const BUDGET_KEYS = new Set(BUDGET_BANDS.map((b) => b.key));
const TIMELINE_KEYS = new Set(TIMELINES.map((t) => t.key));

// Guards for the public submit path: an unknown value from a hand-crafted POST
// becomes null rather than a stored string nothing can score.
export function cleanBudgetBand(v) {
  return BUDGET_KEYS.has(v) ? v : null;
}
export function cleanTimeline(v) {
  return TIMELINE_KEYS.has(v) ? v : null;
}

// ── Which channels put these two questions at all ─────────────────────────
//
// The leads screen rendered "Not stated" for every empty qualifier, on every
// lead, from every source. On a self-quote that is true and useful: the
// homeowner saw a budget question and skipped it, and declining to answer is
// itself worth knowing. On an instant quote it is a small lie — that form has
// no timeline question on it, so the household never declined anything.
//
// Keyed by SOURCE and listing only the channels whose form is OURS and FIXED.
// `funnel:*`, `imported` and `embed_form` are deliberately absent: a funnel's
// questions are built by the contractor, a CSV's columns come from whatever
// they exported, and the embed form is HTML on their own site. For those,
// empty really does mean "we don't know", which is what "Not stated" says.
//
// This map is about what the SCREEN may claim. The scorer has its own,
// narrower map (UNASKABLE_BY_SOURCE in lib/leads/createLead.js) covering only
// the channel that is FORBIDDEN to ask — the phone, and money. Widening the
// scorer to everything below would re-rank every lead board in production, so
// it waits on the owner rather than being slipped in behind a display fix.
// check-lead-intake.mjs pins the one relationship that must hold: everything
// the scorer treats as unaskable is listed here too.
export const NOT_ASKED_BY_SOURCE = {
  // The receptionist may not discuss money at all (lib/voice/prompt.js), and a
  // call has no form to put a timeline question on — it asks urgency instead,
  // which save_caller maps onto timeline. So budget only.
  phone_agent: ["budget"],
  phone_agent_recovered: ["budget"],
  // The instant quote asks the budget (as a tap on the company's own bands)
  // and never asks when they want it done.
  instant_quote: ["timeline"],
  // The kitchen designer collects a drawn layout, an address and notes. Its
  // route accepts budgetBand/timeline, and the form has never sent either.
  self_quote_kitchen: ["budget", "timeline"],
  // An existing client asking for more work: a category and a message.
  client_portal: ["budget", "timeline"],
  // Books a callback. Neither question is put.
  ai_employee: ["budget", "timeline"],
};

/** Did this channel's form put `field` ("budget" | "timeline") to them at all? */
export function wasAsked(source, field) {
  return !(NOT_ASKED_BY_SOURCE[source] || []).includes(field);
}

// English fallbacks. The form pulls translated labels from appMessages; these
// exist so server-side surfaces (score reasons, staff email) read cleanly even
// without an i18n context.
export const BUDGET_LABELS_EN = {
  unsure: "Not sure yet",
  under_1k: "Under 1,000",
  "1k_5k": "1,000 – 5,000",
  "5k_15k": "5,000 – 15,000",
  "15k_plus": "15,000+",
};
export const TIMELINE_LABELS_EN = {
  asap: "As soon as possible",
  "2_weeks": "Within 2 weeks",
  "1_3_months": "Within 1–3 months",
  exploring: "Just exploring",
};
