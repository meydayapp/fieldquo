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
