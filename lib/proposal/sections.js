// lib/proposal/sections.js
//
// The client proposal — the mini-site a quote link opens (app/q/[token]) —
// as a set of SECTIONS beside the quote itself, and the rules for which of
// them render.
//
// ── The rule ────────────────────────────────────────────────────────────────
//
// A section renders when THREE things are true, and the first of them is
// not a setting:
//
//   1. the company has content behind it — a story, at least one gallery
//      pair, a document marked "show on quotes" that has not expired, a
//      published review, an enabled service;
//   2. the company default for the section is on (Company.proposalSections;
//      null means on);
//   3. this quote has not switched it off (Quote.presentation.sections; null
//      means "follow the company").
//
// A section with nothing behind it is never rendered and never listed in
// the table of contents, whatever the two switches say — the same rule the
// quote email applies to an empty References section, and the reason is the
// same: a heading over nothing is a control that appears to work and
// doesn't. "Your project" (the quote) is always rendered and has no switch.
//
// ── Pure ────────────────────────────────────────────────────────────────────
//
// No Prisma, no fetch. The public route loads the content (lib/proposal/
// load.js) and hands it here, so scripts/check-client-proposal.mjs can
// execute every rule against fixtures — including the two that matter most:
// an empty section is omitted, and a plan is never invented for a quote
// with no hours.

/** The optional sections, in the order the page and the TOC list them. */
export const PROPOSAL_SECTION_KEYS = [
  "about",
  "beforeAfter",
  "documents",
  "testimonials",
  "services",
];

/**
 * Per-section metadata: the i18n key the staff panel translates, and the
 * settings anchor that fills it. The client-facing headings live in
 * lib/i18n/clientDocCopy.js under the same keys.
 */
export const PROPOSAL_SECTIONS = {
  about: { key: "about", labelKey: "app.proposal.section.about", fillHref: "/app/settings/presentation#story" },
  beforeAfter: { key: "beforeAfter", labelKey: "app.proposal.section.beforeAfter", fillHref: "/app/settings/presentation#gallery" },
  documents: { key: "documents", labelKey: "app.proposal.section.documents", fillHref: "/app/settings/presentation#documents" },
  testimonials: { key: "testimonials", labelKey: "app.proposal.section.testimonials", fillHref: "/app/settings/reviews#google-business" },
  services: { key: "services", labelKey: "app.proposal.section.services", fillHref: "/app/settings/services" },
};

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

/**
 * Company.proposalSections, cleaned. Only the known keys, only booleans;
 * anything else is dropped so a stray string cannot switch a section off
 * (`Boolean("no")` is true — and it could just as easily be read the other
 * way by the next reader).
 */
export function sanitiseCompanySections(raw) {
  if (!isObj(raw)) return null;
  const out = {};
  for (const key of PROPOSAL_SECTION_KEYS) {
    if (typeof raw[key] === "boolean") out[key] = raw[key];
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Quote.presentation, cleaned. Three-state per section (true / false / null),
 * an explicit document list or null, a crew size or null.
 *
 * `crewSize` is bounded 1–20: the plan divides hours by it, and a typo of
 * 200 would print a job as finished in an hour.
 */
export function sanitisePresentation(raw) {
  const src = isObj(raw) ? raw : {};
  const sections = {};
  const given = isObj(src.sections) ? src.sections : {};
  for (const key of PROPOSAL_SECTION_KEYS) {
    sections[key] = typeof given[key] === "boolean" ? given[key] : null;
  }
  const documentIds = Array.isArray(src.documentIds)
    ? [...new Set(src.documentIds.filter((id) => typeof id === "string" && id.trim()).map((id) => id.trim()))]
    : null;
  // A number, not a numeric string: "3" out of stored JSON is a type
  // somebody did not intend, and coercing it is how a typo becomes a plan.
  const crew = src.crewSize;
  const crewSize = Number.isInteger(crew) && crew >= 1 && crew <= 20 ? crew : null;
  return { sections, documentIds, crewSize };
}

/**
 * Whether each section is on, and why.
 *
 * @param company  { proposalSections }
 * @param quote    { presentation } or null (resolves the company defaults
 *                 alone, which is what the settings page previews)
 * @param content  { about: bool, beforeAfter: number, documents: number,
 *                   testimonials: number, services: number } — how much is
 *                 behind each section. Counts, not the rows: this function
 *                 decides, it does not render.
 *
 * Returns, per key: { key, on, inherited, hasContent, rendered }.
 *   on         the switch, after the company default and the quote override
 *   inherited  true when `on` came from the company rather than this quote
 *   hasContent something exists to show
 *   rendered   on AND hasContent — the only thing the page reads
 */
export function resolveProposalSections({ company = {}, quote = null, content = {} } = {}) {
  const defaults = sanitiseCompanySections(company?.proposalSections) || {};
  const pres = sanitisePresentation(quote?.presentation);
  const out = {};
  for (const key of PROPOSAL_SECTION_KEYS) {
    const override = quote ? pres.sections[key] : null;
    const inherited = override === null;
    const companyOn = key in defaults ? defaults[key] : true;
    const on = inherited ? companyOn : override;
    const amount = content?.[key];
    const hasContent = typeof amount === "boolean" ? amount : Number(amount) > 0;
    out[key] = { key, on, inherited, companyDefault: companyOn, hasContent, rendered: on && hasContent };
  }
  return out;
}

/** The keys the page should draw, in order. */
export function renderedSectionKeys(resolved) {
  return PROPOSAL_SECTION_KEYS.filter((key) => resolved?.[key]?.rendered);
}

/**
 * The projection with nothing in it — what a page draws when the company
 * sections could not be loaded: no sections, no headings over nothing.
 * Same shape as lib/proposal/load.js#projectProposal.
 */
export const EMPTY_PROPOSAL = Object.freeze({
  sections: [],
  about: null,
  gallery: [],
  documents: [],
  testimonials: [],
  services: [],
});

// ── The day-by-day plan ─────────────────────────────────────────────────────
//
// Derived, never written: the takeoff's hours (lib/pricing/tradeScope.js
// tradeLabourDetail — the SAME hours the price was built from) divided
// across a crew. No hours, no plan. No crew size, no plan. The plan says
// which parts of the work fall on which day; it does not invent a phase
// ("prep", "second coat") the takeoff did not state, because the takeoff
// states areas, not phases, and a plan that promised "Day 2 — second coat"
// off nothing would be exactly the padding-absent-data failure AGENTS.md
// names.

export const HOURS_PER_DAY = 8;

/**
 * @param parts      [{ name, hours }] — the labour breakdown, in work order.
 *                   Parts with no hours are skipped.
 * @param totalHours the takeoff total, used when `parts` is empty (a trade
 *                   that states one figure and no breakdown)
 * @param crewSize   people on site
 * @returns [{ day, labels: string[], hours, halfDay }] or null when there is
 *          nothing honest to derive.
 */
export function dayPlan({ parts = [], totalHours = 0, crewSize = null, hoursPerDay = HOURS_PER_DAY } = {}) {
  const crew = crewSize;
  if (!Number.isInteger(crew) || crew < 1) return null;
  const capacity = crew * (Number(hoursPerDay) > 0 ? Number(hoursPerDay) : HOURS_PER_DAY);

  const named = (Array.isArray(parts) ? parts : [])
    .map((p) => ({ name: String(p?.name || "").trim(), hours: Number(p?.hours) }))
    .filter((p) => Number.isFinite(p.hours) && p.hours > 0);

  const total = named.length
    ? named.reduce((s, p) => s + p.hours, 0)
    : Number(totalHours);
  if (!Number.isFinite(total) || total <= 0) return null;

  // Walk the parts across the days. A part that straddles a day boundary is
  // listed on both days — the crew is in that room on both, which is the
  // truth a homeowner is asking for ("when is the kitchen out of action").
  const days = [];
  let dayHours = 0;
  let labels = [];
  const close = () => {
    days.push({ day: days.length + 1, labels: [...new Set(labels)], hours: round1(dayHours), halfDay: false });
    dayHours = 0;
    labels = [];
  };
  const queue = named.length ? named.map((p) => ({ ...p })) : [{ name: "", hours: total }];
  for (const part of queue) {
    let left = part.hours;
    while (left > 0) {
      const room = capacity - dayHours;
      const take = Math.min(room, left);
      if (part.name) labels.push(part.name);
      dayHours += take;
      left -= take;
      if (dayHours >= capacity - 1e-9) close();
    }
  }
  if (dayHours > 1e-9) close();
  // Cap: a plan of forty days is a schedule, not a proposal section, and the
  // takeoff hours behind it deserve a conversation rather than a list.
  if (days.length > 30) return null;
  // The last day is a half day when it holds under half the crew's capacity.
  const last = days[days.length - 1];
  if (last && last.hours < capacity / 2) last.halfDay = true;
  return days;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * What paint and how many coats, from a painting takeoff result — the
 * `purchase` list (product labels) and the substrate lines' `coats`. Both
 * are facts the estimator entered; nothing is defaulted in. Returns null
 * when the takeoff carries neither.
 */
export function paintSpec(result) {
  if (!result || typeof result !== "object") return null;
  const products = [
    ...new Set(
      (Array.isArray(result.purchase) ? result.purchase : [])
        .map((p) => String(p?.label || "").trim())
        .filter(Boolean),
    ),
  ];
  const coats = new Set();
  for (const area of Array.isArray(result.areas) ? result.areas : []) {
    for (const line of Array.isArray(area?.lines) ? area.lines : []) {
      const c = Number(line?.coats);
      if (Number.isInteger(c) && c > 0) coats.add(c);
    }
  }
  if (!products.length && !coats.size) return null;
  return {
    products,
    coats: [...coats].sort((a, b) => a - b),
  };
}
