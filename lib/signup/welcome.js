// lib/signup/welcome.js
//
// The questions a new owner answers AFTER "Start my free trial" — the
// Jobber-shaped signup the owner approved on 2026-09-29 — as data and pure
// functions. The screens live at app/welcome/[step]; the writes go through
// PATCH /api/signup/personalize; nothing here touches React, the network or
// the database, so scripts/check-welcome-flow.mjs executes every rule.
//
// ══ Why the company exists before these questions are asked ════════════════
//
// /signup is one screen now: email, password, "Start my free trial". That
// press creates the login AND the company (POST /api/companies, nameless),
// because the trial is real from that moment — the next screen says "your
// free trial is now active" and it has to be true. So everything below is an
// UPDATE to a company that already exists, and a person who stops half way
// has a company with explicit nulls where the answers would be: no invented
// country, no CAD, no Toronto. lib/company/profileReadiness.js refuses every
// client-facing send until the business screen has been answered.
//
// ══ Resume ═════════════════════════════════════════════════════════════════
//
// The next unanswered screen is stored on Company.onboardingStep after every
// answer, so a person who signs out, closes the tab or comes back next week
// lands exactly there (lib/signup/welcomeGate.js routes the owner; the
// recovery emails link there). It is recomputed from the ANSWERS, never
// trusted from a counter: resumeWelcomeStep() walks the steps in order and
// stops at the first one whose answer is missing, so a screen can never be
// skipped by a stale column or a hand-rolled PATCH.

import { TEAM_SIZE_BANDS, YEARS_BANDS, cleanYearsBand } from "@/lib/signup/signupPreview";
import { formatPhoneInput, isValidPhone } from "@/lib/validation";
import { containsMarkupCharacters } from "@/lib/security/rejectMarkupCharacters";
import { INDUSTRIES } from "@/app/data/industries";
import { TRADE_CATALOG, tradeKeys } from "@/lib/trades/catalog";

/**
 * Every welcome screen, in the order they are walked. "setup" is the last:
 * the progress screen that seeds the trade's services and templates and then
 * stamps Company.personalizedAt.
 */
export const WELCOME_STEPS = Object.freeze([
  "profile",
  "business",
  "size",
  "revenue",
  "priority",
  "focus",
  "source",
  "setup",
]);

export const WELCOME_BASE_PATH = "/welcome";

/** The URL of a step, or of the first one for anything unrecognised. */
export function welcomePath(step) {
  return `${WELCOME_BASE_PATH}/${WELCOME_STEPS.includes(step) ? step : WELCOME_STEPS[0]}`;
}

export function isWelcomeStep(step) {
  return WELCOME_STEPS.includes(step);
}

/* ── The closed lists ─────────────────────────────────────────────────────── */

/**
 * "How many people work at your company (including you)?" — the six chips
 * the screen offers. The keys are TEAM_SIZE_BANDS' (lib/signup/signupPreview.js,
 * which gained "16-20" and "21+" for this screen); "16+" stays readable there
 * for companies that answered the old chips, and is never offered again.
 */
export const WELCOME_TEAM_KEYS = Object.freeze(["1", "2-5", "6-10", "11-15", "16-20", "21+"]);
export const WELCOME_TEAM_BANDS = Object.freeze(
  WELCOME_TEAM_KEYS.map((key) => TEAM_SIZE_BANDS.find((b) => b.key === key)).filter(Boolean),
);

/** The "Just me" key. Answering it stamps Company.worksAloneAt. */
export const SOLO_TEAM_KEY = "1";

/** "How many years have you been in business?" — YEARS_BANDS, unchanged. */
export const WELCOME_YEARS_BANDS = YEARS_BANDS;

/**
 * "Estimated revenue this year" — amounts in thousands, so the label can be
 * drawn in the company's own currency symbol. "prefer_not" is an ANSWER (the
 * owner said so on purpose) and is stored as that key; an unanswered screen
 * stores nothing.
 */
export const WELCOME_REVENUE_BANDS = Object.freeze([
  Object.freeze({ key: "0-50k", from: 0, to: 50 }),
  Object.freeze({ key: "50-150k", from: 50, to: 150 }),
  Object.freeze({ key: "150-500k", from: 150, to: 500 }),
  Object.freeze({ key: "500k-1m", from: 500, to: 1000 }),
  Object.freeze({ key: "1-2m", from: 1000, to: 2000 }),
  Object.freeze({ key: "2m+", from: 2000, to: null }),
  Object.freeze({ key: "prefer_not", from: null, to: null }),
]);

/** "$50K", "$1.5M" — one amount, in thousands, with the symbol given. */
function amountLabel(symbol, thousands) {
  if (thousands === 0) return `${symbol}0`;
  if (thousands >= 1000) {
    const m = thousands / 1000;
    return `${symbol}${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  return `${symbol}${thousands}K`;
}

/**
 * A revenue chip's words. The money bands are figures and a symbol, the same
 * in every language; only "I'd prefer not to say" is a catalogue sentence,
 * which the caller passes in as `preferNot`. `symbol` is the company's own
 * currency symbol — never a guessed one; with none the bare figures are shown.
 */
export function revenueBandLabel(band, symbol = "", preferNot = "I'd prefer not to say") {
  const b = typeof band === "string" ? WELCOME_REVENUE_BANDS.find((x) => x.key === band) : band;
  if (!b) return "";
  if (b.key === "prefer_not") return preferNot;
  const s = typeof symbol === "string" ? symbol : "";
  if (b.to === null) return `${amountLabel(s, b.from)}+`;
  return `${amountLabel(s, b.from)}–${amountLabel(s, b.to)}`;
}

/**
 * Everything a new owner can ask FieldQuo to help with first, keyed once so
 * one focus that appears under two priorities is one answer, not two.
 */
export const WELCOME_FOCUS = Object.freeze({
  sending_quotes: "Sending professional quotes",
  approvals_deposits: "Getting approvals and deposits",
  invoicing_payments: "Invoicing and online payments",
  attracting_clients: "Attracting more clients",
  client_organization: "Improving client organization",
  scheduling: "Scheduling jobs efficiently",
  onsite_info: "Capturing information on-site",
  team_management: "Managing my team better",
  route_planning: "Planning smarter routes",
  automating_admin: "Automating admin tasks",
  invoices_paid_faster: "Sending invoices and getting paid faster",
  jobs_on_the_go: "Run jobs on the go",
  leads_followups: "Stay on top of leads and follow-ups",
  repeat_business: "Achieving more repeat business",
  more_requests: "Getting more job requests",
  winning_quotes: "Quotes that win work",
  never_miss_leads: "Never missing new leads",
  manage_clients: "Manage clients",
  something_else: "Something else",
});

/**
 * The four priorities, each with the focus options offered UNDER it and in
 * the order the owner listed them. The heading and the line under it are
 * FieldQuo's own wording (catalogue keys app.welcome.priority.<key>.*).
 */
export const WELCOME_PRIORITIES = Object.freeze([
  Object.freeze({
    key: "professional",
    focus: Object.freeze(["sending_quotes", "approvals_deposits", "invoicing_payments", "attracting_clients", "client_organization"]),
  }),
  Object.freeze({
    key: "control",
    focus: Object.freeze([
      "client_organization",
      "scheduling",
      "onsite_info",
      "team_management",
      "route_planning",
      "automating_admin",
      "invoices_paid_faster",
      "jobs_on_the_go",
    ]),
  }),
  Object.freeze({
    key: "win_more",
    focus: Object.freeze(["leads_followups", "attracting_clients", "repeat_business", "more_requests", "winning_quotes", "never_miss_leads"]),
  }),
  Object.freeze({
    key: "exploring",
    focus: Object.freeze(["sending_quotes", "scheduling", "manage_clients", "more_requests", "invoicing_payments", "something_else"]),
  }),
]);

/** The focus keys a priority offers — empty for an unknown priority. */
export function focusOptionsFor(priorityKey) {
  return [...(WELCOME_PRIORITIES.find((p) => p.key === priorityKey)?.focus || [])];
}

/** "How did you hear about FieldQuo?" — the select's options, in order. */
export const WELCOME_SOURCES = Object.freeze([
  "search_engine",
  "social_media",
  "youtube",
  "friend",
  "another_business",
  "online_ad",
  "review_site",
  "fieldquo_rep",
  "event",
  "other",
]);

/* ── The industry select ─────────────────────────────────────────────────── */

/**
 * The industry select's groups: one per FieldQuo industry
 * (app/data/industries.js) holding that industry's trades
 * (lib/trades/catalog.js), then "Other trades" for the catalogue's trades no
 * industry lists. A trade sold by two industries appears under both — a
 * roofer looking under Roofing for gutters must find them — and the option's
 * value carries the industry it was picked under, so the answer says which.
 *
 * @returns [{ slug, label, options: [{ value, industry, tradeKey, label }] }]
 */
export function industryGroups() {
  const keys = tradeKeys();
  const groups = INDUSTRIES.map((ind) => ({
    slug: ind.slug,
    label: ind.label,
    options: keys
      .filter((k) => TRADE_CATALOG[k].industries.includes(ind.slug))
      .map((k) => ({ value: `${ind.slug}:${k}`, industry: ind.slug, tradeKey: k, label: TRADE_CATALOG[k].label })),
  })).filter((g) => g.options.length > 0);
  const orphans = keys.filter((k) => TRADE_CATALOG[k].industries.length === 0);
  if (orphans.length) {
    groups.push({
      slug: OTHER_GROUP,
      label: "Other trades",
      options: orphans.map((k) => ({ value: `${OTHER_GROUP}:${k}`, industry: null, tradeKey: k, label: TRADE_CATALOG[k].label })),
    });
  }
  return groups;
}

export const OTHER_GROUP = "other";

/**
 * Read an industry select value ("painting:interior_painting"). Null unless
 * the pair is one the select actually offers — a trade under an industry
 * that does not sell it is not an answer.
 */
export function readIndustryChoice(value) {
  if (typeof value !== "string") return null;
  const [group, tradeKey] = value.split(":");
  // Own keys only: "__proto__" is a key of every object, and a hostile
  // value naming it must be a refusal, not a crash (check:welcome-flow).
  if (!group || !tradeKey || !Object.hasOwn(TRADE_CATALOG, tradeKey)) return null;
  const entry = TRADE_CATALOG[tradeKey];
  if (group === OTHER_GROUP) {
    return entry.industries.length === 0 ? { industry: null, tradeKey } : null;
  }
  if (!INDUSTRIES.some((i) => i.slug === group)) return null;
  return entry.industries.includes(group) ? { industry: group, tradeKey } : null;
}

/** The select value for a stored answer, for the prefill. */
export function industryChoiceValue({ industries = [], tradeKey = null } = {}) {
  if (typeof tradeKey !== "string" || !Object.hasOwn(TRADE_CATALOG, tradeKey)) return "";
  const list = Array.isArray(industries) ? industries : [];
  const group = list.find((slug) => TRADE_CATALOG[tradeKey].industries.includes(slug));
  if (group) return `${group}:${tradeKey}`;
  if (TRADE_CATALOG[tradeKey].industries.length === 0) return `${OTHER_GROUP}:${tradeKey}`;
  return `${TRADE_CATALOG[tradeKey].industries[0]}:${tradeKey}`;
}

/* ── Reading one answer ──────────────────────────────────────────────────── */

const NAME_MAX = 80;
const COMPANY_NAME_MAX = 120;

function cleanText(value, max) {
  if (typeof value !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max).trim();
}

const refuse = (field, code) => ({ ok: false, field, code });

/**
 * One screen's answer, read and validated. Pure: the route resolves what
 * needs the database (the country from the address, the category row for the
 * trade) and passes it in.
 *
 * Returns { ok: true, user?, company?, tradeKey?, industry? } — the fields to
 * write — or { ok: false, field, code }, where `code` names a catalogue
 * sentence (app.welcome.error.<code>) the screen shows under `field`.
 */
export function readWelcomeAnswer(step, body = {}, ctx = {}) {
  const b = body && typeof body === "object" ? body : {};
  switch (step) {
    case "profile": {
      const firstName = cleanText(b.firstName, NAME_MAX);
      const lastName = cleanText(b.lastName, NAME_MAX);
      const phone = formatPhoneInput(b.phone || "");
      if (!firstName) return refuse("firstName", "firstName");
      if (!lastName) return refuse("lastName", "lastName");
      if (containsMarkupCharacters(firstName) || containsMarkupCharacters(lastName)) return refuse("firstName", "markup");
      if (!isValidPhone(phone)) return refuse("phone", "phone");
      return { ok: true, user: { name: `${firstName} ${lastName}`, phone } };
    }
    case "business": {
      const name = cleanText(b.companyName, COMPANY_NAME_MAX);
      if (!name) return refuse("companyName", "companyName");
      if (containsMarkupCharacters(name)) return refuse("companyName", "markup");
      // The one address field: the country (and province, city, postal code)
      // come from the PLACE the person selected — their own statement — and
      // the route has already read it through billingBasis. No place, no
      // country, no answer: nothing here guesses one.
      const address = cleanText(b.address, 300);
      if (!address || !ctx.country) return refuse("address", "address");
      const choice = readIndustryChoice(b.industry);
      if (!choice) return refuse("industry", "industry");
      if (ctx.website?.error) return refuse("website", "website");
      return {
        ok: true,
        tradeKey: choice.tradeKey,
        industry: choice.industry,
        company: {
          name,
          address,
          city: cleanText(b.city, 120) || null,
          province: cleanText(b.province, 120) || null,
          postalCode: cleanText(b.postalCode, 20) || null,
          country: ctx.country,
          currency: ctx.currency || null,
          ...(ctx.timezone ? { timezone: ctx.timezone } : {}),
          industries: choice.industry ? [choice.industry] : [],
          website: ctx.website?.website ?? null,
          hasWebsite: ctx.website?.hasWebsite ?? null,
        },
      };
    }
    case "size": {
      const team = WELCOME_TEAM_KEYS.includes(b.teamSizeBand) ? b.teamSizeBand : null;
      const years = cleanYearsBand(b.yearsInBusinessBand);
      if (!team) return refuse("teamSizeBand", "teamSize");
      if (!years) return refuse("yearsInBusinessBand", "years");
      return {
        ok: true,
        company: {
          teamSizeBand: team,
          yearsInBusinessBand: years,
          // "Just me" is the same statement Settings' "I work alone" makes
          // (Company.worksAloneAt removes the Team step from the set-up
          // list). Any other band clears it — during the welcome questions
          // the only thing that could have set it is this screen.
          worksAloneAt: team === SOLO_TEAM_KEY ? ctx.now || new Date() : null,
        },
      };
    }
    case "revenue": {
      const band = WELCOME_REVENUE_BANDS.some((x) => x.key === b.revenueBand) ? b.revenueBand : null;
      if (!band) return refuse("revenueBand", "revenue");
      return { ok: true, company: { revenueBand: band } };
    }
    case "priority": {
      const p = WELCOME_PRIORITIES.some((x) => x.key === b.signupPriority) ? b.signupPriority : null;
      if (!p) return refuse("signupPriority", "priority");
      // A focus picked under a different priority is not an answer to this
      // one: keep only what the new priority offers.
      const offered = new Set(focusOptionsFor(p));
      const kept = (Array.isArray(ctx.currentFocus) ? ctx.currentFocus : []).filter((f) => offered.has(f));
      return { ok: true, company: { signupPriority: p, signupFocus: kept } };
    }
    case "focus": {
      const offered = focusOptionsFor(ctx.priority);
      if (!offered.length) return refuse("signupPriority", "priority");
      const picked = [...new Set(Array.isArray(b.signupFocus) ? b.signupFocus : [])].filter((f) => offered.includes(f));
      if (!picked.length) return refuse("signupFocus", "focus");
      // In the order the screen lists them, whatever order they were tapped.
      return { ok: true, company: { signupFocus: offered.filter((f) => picked.includes(f)) } };
    }
    case "source": {
      const s = WELCOME_SOURCES.includes(b.signupSource) ? b.signupSource : null;
      if (!s) return refuse("signupSource", "source");
      return { ok: true, company: { signupSource: s } };
    }
    default:
      return refuse("step", "step");
  }
}

/* ── Where they are ──────────────────────────────────────────────────────── */

/**
 * Is this screen answered, judged from what is stored? `state` is
 *   { user: { name, phone }, company: { name, country, address,
 *     teamSizeBand, yearsInBusinessBand, revenueBand, signupPriority,
 *     signupFocus, signupSource }, tradeKeys: [enabled category keys] }
 */
export function welcomeStepAnswered(step, state = {}) {
  const u = state.user || {};
  const c = state.company || {};
  switch (step) {
    case "profile":
      return Boolean(String(u.name || "").trim()) && isValidPhone(u.phone || "");
    case "business":
      return (
        Boolean(String(c.name || "").trim()) &&
        Boolean(c.country) &&
        Boolean(String(c.address || "").trim()) &&
        Array.isArray(state.tradeKeys) &&
        state.tradeKeys.length > 0
      );
    case "size":
      return WELCOME_TEAM_KEYS.includes(c.teamSizeBand) && Boolean(cleanYearsBand(c.yearsInBusinessBand));
    case "revenue":
      return WELCOME_REVENUE_BANDS.some((b) => b.key === c.revenueBand);
    case "priority":
      return WELCOME_PRIORITIES.some((p) => p.key === c.signupPriority);
    case "focus": {
      const offered = focusOptionsFor(c.signupPriority);
      const focus = Array.isArray(c.signupFocus) ? c.signupFocus : [];
      return offered.length > 0 && focus.length > 0 && focus.every((f) => offered.includes(f));
    }
    case "source":
      return WELCOME_SOURCES.includes(c.signupSource);
    case "setup":
      return Boolean(c.personalizedAt);
    default:
      return false;
  }
}

/* ── A general contractor arriving from a sub's quote ─────────────────────── */

/**
 * The welcome screens for a contractor who signed up from "Add this price to
 * your own quote" (lib/quotes/addToQuoteLink.js) — the brief's "welcome
 * questions cut to what a GC needs, then straight back to the add page"
 * (owner 2026-10-06).
 *
 * Who they are and what their business is: profile and business, because the
 * company cannot send a document without them (lib/company/profileReadiness.js)
 * and its currency comes from the business address. Then setup, which seeds
 * the trade and stamps personalizedAt. Size, revenue, priority, focus and
 * source are FieldQuo's own marketing questions; a GC who came to put a price
 * in a quote is not held up by them, and they stay unanswered — null, never a
 * default (AGENTS.md failure class 5).
 *
 * Chosen per request by lib/signup/gcWelcome.js from the add-to-quote cookie,
 * re-checked against the database — never from a stored counter. A browser
 * without the cookie walks the full list, which is the old behaviour.
 */
export const GC_WELCOME_STEPS = Object.freeze(["profile", "business", "setup"]);

/** The step list in force: the full one unless a valid list is given. */
function stepList(opts) {
  const steps = opts?.steps;
  return Array.isArray(steps) &&
    steps.length > 0 &&
    steps.every((s) => WELCOME_STEPS.includes(s)) &&
    steps[steps.length - 1] === "setup"
    ? steps
    : WELCOME_STEPS;
}

/**
 * The first screen whose answer is missing — where a returning owner lands.
 * "setup" once every question is answered (the seeding has not run until
 * personalizedAt says so), null once personalizedAt is set.
 */
export function resumeWelcomeStep(state = {}, opts = {}) {
  if (state.company?.personalizedAt) return null;
  for (const step of stepList(opts)) {
    if (!welcomeStepAnswered(step, state)) return step;
  }
  return "setup";
}

/**
 * May this screen be shown, given where they are? Any screen up to and
 * including the resume step (Back is allowed); a later one is sent to the
 * resume step — a question is never skipped by typing a URL.
 *
 * @returns the step to render, or the step to redirect to
 */
export function allowedWelcomeStep(requested, state = {}, opts = {}) {
  const steps = stepList(opts);
  const resume = resumeWelcomeStep(state, opts);
  if (!resume) return null;
  // A screen the list in force does not have is not shown — the short list
  // sends /welcome/size to where they are, not to a question it skips.
  if (!steps.includes(requested)) return resume;
  return steps.indexOf(requested) <= steps.indexOf(resume) ? requested : resume;
}

/** The screen after this one, or null after the last question. */
export function nextWelcomeStep(step, opts = {}) {
  const steps = stepList(opts);
  const i = steps.indexOf(step);
  return i >= 0 && i < steps.length - 1 ? steps[i + 1] : null;
}

/** The screen before this one, or null on the first. */
export function previousWelcomeStep(step, opts = {}) {
  const steps = stepList(opts);
  const i = steps.indexOf(step);
  return i > 0 ? steps[i - 1] : null;
}
