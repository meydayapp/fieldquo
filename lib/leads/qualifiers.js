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
// This map is about what the SCREEN may claim ("Nobody asked" vs "Not
// stated"). The SCORER's rule is wider and lives below (ASKED_BY_SOURCE /
// unaskedForScoring): since the owner's decision of 2026-10-03 it holds an
// absent answer against a lead only when the channel put the question. The
// two differ on purpose for the "we don't know" sources (a CSV, the embed
// form, a funnel): the screen says "Not stated" — true, nobody knows — and
// the scorer does not count it against them. check-lead-intake.mjs pins the
// one relationship that must hold: everything listed here as not asked is
// also not held against a lead by the scorer.
export const NOT_ASKED_BY_SOURCE = {
  // The receptionist may not discuss money at all (lib/voice/prompt.js), and a
  // call has no form to put a timeline question on — it asks urgency instead,
  // which save_caller maps onto timeline. So budget only.
  phone_agent: ["budget"],
  phone_agent_recovered: ["budget"],
  // The instant quote asks the budget (as a tap on the company's own bands)
  // AND, since the "when do you need this done?" ladder was added to the
  // public form (lib/leads/tradeQuestions.js), when they want it done — so it
  // is no longer listed here. An older instant-quote lead with no timeline
  // predates the question; "Not stated" on those is the one small lie this
  // map cannot avoid without a date on the row.
  // The kitchen designer collects a drawn layout, an address and notes. Its
  // route accepts budgetBand/timeline, and the form has never sent either.
  self_quote_kitchen: ["budget", "timeline"],
  // An existing client asking for more work: a category and a message.
  client_portal: ["budget", "timeline"],
  // Books a callback. Neither question is put.
  ai_employee: ["budget", "timeline"],
  // A visit booked on the booking page with no enquiry before it
  // (lib/booking/bookingLead.js). The page asks no budget; its required
  // "when do you need this done?" answer IS the lead's timeline (the owner,
  // 2026-10-05), so timeline is asked — see ASKED_BY_SOURCE.
  booking_page: ["budget"],
  // The same employee, on FieldQuo's own two channels (lib/aiEmployee/respond.js
  // stamps the channel as the source): a chat asks no budget band and no
  // timeline picker, so neither may count against the lead's score.
  web_chat: ["budget", "timeline"],
  sms: ["budget", "timeline"],
  // A lead a staff member typed in (/app/leads/new, POST /api/leads). The form
  // is name, phone, email, address, service and a note — the owner's own list,
  // with no budget or timeline question on it — so "Not stated" would claim
  // the household declined a question the form never put. (The scorer, too,
  // no longer counts either against it — see unaskedForScoring below.)
  manual: ["budget", "timeline"],
  // Meta's lead form is built by the contractor in Ads Manager, and Meta has
  // no budget band or timeline picker of ours: an answer to "when do you want
  // it done?" lands in intake as the person's own words, never in these two
  // columns. A conversation (Messenger, Instagram, WhatsApp) puts no form
  // question at all — the AI reads a timeline out of what they said when they
  // said one (lib/ai/conversationLeadExtract.js), and that is not "asked".
  meta_lead_form: ["budget", "timeline"],
  meta_messenger: ["budget", "timeline"],
  meta_instagram: ["budget", "timeline"],
  meta_whatsapp: ["budget", "timeline"],
};

/** Did this channel's form put `field` ("budget" | "timeline") to them at all? */
export function wasAsked(source, field) {
  return !(NOT_ASKED_BY_SOURCE[source] || []).includes(field);
}

// ── What the SCORER may hold against a lead (owner, 2026-10-03) ────────────
//
// The scorer used to withhold only the phone's budget (the receptionist may
// not discuss money). Everything else from every other channel was scored out
// of the full hundred, so a Facebook lead-form lead — a name, a phone, an
// email, a real address — came out cold for "Budget not stated" and no
// timeline, on a form that never had either question. The owner: "remove the
// penalty if they are sourced from somewhere else; the AI should still assess
// them or the algorithm, based on the information of the lead."
//
// So it is inverted. A missing budget or timeline is held against a lead ONLY
// when the channel actually PUT that question to them — today our own
// self-quote form and the instant quote (both questions), and the phone
// receptionist (timeline: it asks urgency and save_caller maps it). Every
// other source — a hand-typed lead, a Meta form, a conversation, a CSV, a
// contractor-built funnel, the embed form on their own site — is scored on
// what it CAN capture, and an absent answer comes out of the denominator with
// a reason saying it was unknown (lib/leads/score.js).
//
// An answer that IS present always counts, whatever the source: a funnel that
// has a budget step, or a conversation the AI read "asap" out of, scores that
// answer like a form would. Only absence stops being a penalty.
//
// Funnels are keyed `funnel` or `funnel:<channel>` (lib/funnels/ingest.js) and
// are deliberately NOT listed: a contractor-built funnel may or may not carry
// a budget step, and a lead with no budget on it is "we don't know", which
// is exactly the case that must not count against them.
export const ASKED_BY_SOURCE = Object.freeze({
  self_quote: Object.freeze(["budget", "timeline"]),
  instant_quote: Object.freeze(["budget", "timeline"]),
  phone_agent: Object.freeze(["timeline"]),
  phone_agent_recovered: Object.freeze(["timeline"]),
  // The booking page's "when do you need this done?" is required, so a
  // booking_page lead always has its own answer (lib/booking/bookingLead.js).
  booking_page: Object.freeze(["timeline"]),
});

/** The two factors a channel can leave unasked. */
export const SCORED_QUESTIONS = Object.freeze(["budget", "timeline"]);

/**
 * The factors the scorer must NOT hold against a lead from `source` when they
 * are absent. Pure. A source FieldQuo has never heard of gets both — an
 * unknown channel is the case "we don't know" was written for.
 */
export function unaskedForScoring(source) {
  const asked = ASKED_BY_SOURCE[source] || [];
  return SCORED_QUESTIONS.filter((f) => !asked.includes(f));
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
