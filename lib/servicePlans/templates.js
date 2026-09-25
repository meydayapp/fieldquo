// lib/servicePlans/templates.js
//
// Maintenance-plan templates, the offers built from them on a quote, and the
// ServicePlan an approved offer becomes. Pure — no database, no clock that
// isn't injected — so scripts/check-plan-templates.mjs can throw hostile input
// at every step between "the contractor typed a price" and "a client is billed".
//
// ── One arithmetic, three screens ───────────────────────────────────────────
//
// The settings screen, the staff quote panel and the client's quote page all
// show what a plan costs. Every one of them goes through offerPricing(), which
// goes through occurrenceAmounts() in ./pricing.js — the function the plan
// engine bills with. So "$148.50 a visit" on the quote is the figure the visit's
// invoice will carry, to the cent, including how the discount rounds.
//
// ── Monthly and yearly are DERIVED, never stored ────────────────────────────
//
// Housecall Pro prices a plan as "$50/month or $599/year" and bills that fee
// whatever the visit count. FieldQuo's engine bills per VISIT. A stored monthly
// figure would be a second price that nothing collects — the "control that
// appears to work" failure — so the monthly and yearly figures here are the
// per-visit charge times the visits in a year, and are labelled as what the
// plan "works out to". A yearly figure is only given when the plan actually
// runs a year: two monthly visits do not cost "$X a year".

import { PLAN_FREQUENCIES, PLAN_FREQUENCY_KEYS, occurrenceDate } from "@/lib/servicePlans/schedule";
import { occurrenceAmounts, termTotals, fromCents } from "@/lib/servicePlans/pricing";
import { validatePlanInput } from "@/lib/servicePlans/validate";

/** The document languages a template can carry wording in (Quote.language's set). */
export const PLAN_TEMPLATE_LANGUAGES = ["en", "fr", "es", "it", "de", "uk", "pa", "tl"];

/** included = part of the deal; optional = the client may tick it. */
export const OFFER_MODES = ["included", "optional"];

/** Visits a year per cadence — the multiplier for the derived yearly figure. */
export const VISITS_PER_YEAR = {
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  semiannual: 2,
  annual: 1,
};

/** More plans than this on one quote is a second quote, not an offer. */
export const MAX_OFFERS_PER_QUOTE = 4;

const MAX_VISITS = 520; // validatePlanInput's own ceiling

function trimmed(v, max) {
  return String(v ?? "").trim().slice(0, max);
}

function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * A { lang: text } map, keeping only known languages and non-empty strings.
 * Returns null when nothing survives — an empty map is not a name.
 */
export function cleanLanguageMap(raw, { max = 120 } = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out = {};
  for (const lang of PLAN_TEMPLATE_LANGUAGES) {
    if (!Object.hasOwn(raw, lang)) continue;
    const v = raw[lang];
    if (typeof v !== "string") continue;
    const s = v.trim().slice(0, max);
    if (s) out[lang] = s;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * The text for one language, or the company's own, or the first one there is.
 *
 * Never a translation: a quote in Tagalog for a template written only in
 * English prints the English the contractor wrote — their own words — rather
 * than a sentence nobody wrote. Settings shows which languages are missing.
 */
export function textIn(map, language, fallbackLanguage = "en") {
  if (!map || typeof map !== "object") return "";
  if (typeof map[language] === "string" && map[language].trim()) return map[language];
  if (typeof map[fallbackLanguage] === "string" && map[fallbackLanguage].trim()) return map[fallbackLanguage];
  for (const lang of PLAN_TEMPLATE_LANGUAGES) {
    if (typeof map[lang] === "string" && map[lang].trim()) return map[lang];
  }
  return "";
}

/**
 * The boundary between the settings form and a stored template.
 *
 * @returns { ok: true, template } | { ok: false, error } — a sentence the
 *          contractor can act on, like validatePlanInput's.
 */
export function validateTemplateInput(body, { productIds = null } = {}) {
  const name = cleanLanguageMap(body?.name, { max: 120 });
  if (!name) return { ok: false, error: "Give the plan a name." };

  const description = cleanLanguageMap(body?.description, { max: 1200 });

  const frequency = trimmed(body?.frequency, 32);
  if (!PLAN_FREQUENCY_KEYS.includes(frequency)) {
    return { ok: false, error: "Choose how often the plan's visits happen." };
  }

  // Blank / null = until cancelled. Anything else must be a real count.
  let visitCount = null;
  const rawCount = body?.visitCount;
  if (rawCount !== null && rawCount !== undefined && rawCount !== "") {
    const n = Number(rawCount);
    if (!Number.isInteger(n) || n < 1 || n > MAX_VISITS) {
      return { ok: false, error: "How many visits? A whole number between 1 and 520, or leave it blank for until cancelled." };
    }
    visitCount = n;
  }

  // Null is allowed — "not priced yet" — and such a template cannot be put on
  // a quote (offerFromTemplate refuses it). Zero and negatives are not a price.
  let pricePerVisit = null;
  const rawPrice = body?.pricePerVisit;
  if (rawPrice !== null && rawPrice !== undefined && rawPrice !== "") {
    const n = Number(rawPrice);
    if (!Number.isFinite(n) || n <= 0) {
      return { ok: false, error: "Enter what one visit costs, before the plan discount — or leave it blank until you've decided." };
    }
    if (n > 1_000_000) return { ok: false, error: "That price looks wrong. Check it before saving." };
    pricePerVisit = Math.round(n * 100) / 100;
  }

  const rawDiscount = body?.discountPct;
  const discountPct = rawDiscount === "" || rawDiscount === null || rawDiscount === undefined ? 0 : Number(rawDiscount);
  if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct >= 100) {
    return { ok: false, error: "The plan discount has to be between 0 and 99%." };
  }

  // Only ids this company owns survive — the caller passes the set it read
  // under the company's own where clause. Without that set, nothing survives:
  // an unverified id is not something to store.
  const allowed = productIds instanceof Set ? productIds : new Set(productIds || []);
  const includedProductIds = [
    ...new Set(
      (Array.isArray(body?.includedProductIds) ? body.includedProductIds : [])
        .filter((id) => typeof id === "string" && allowed.has(id)),
    ),
  ].slice(0, 20);

  return {
    ok: true,
    template: {
      name,
      description,
      frequency,
      visitCount,
      pricePerVisit,
      discountPct: Math.round(discountPct * 1000) / 1000,
      includedProductIds,
      categoryId: trimmed(body?.categoryId, 64) || null,
      active: body?.active === undefined ? true : body.active === true,
    },
  };
}

/** A template row as the settings screen and the quote panel read it. */
export function shapeTemplate(t) {
  return {
    id: t.id,
    seedKey: t.seedKey || null,
    name: t.name || {},
    description: t.description || {},
    categoryId: t.categoryId || null,
    includedProductIds: t.includedProductIds || [],
    frequency: t.frequency,
    visitCount: t.visitCount ?? null,
    pricePerVisit: t.pricePerVisit === null || t.pricePerVisit === undefined ? null : Number(t.pricePerVisit),
    discountPct: Number(t.discountPct || 0),
    active: t.active !== false,
    sortOrder: t.sortOrder ?? 0,
  };
}

/**
 * What a plan costs, every way it is shown.
 *
 * @param terms { pricePerVisit, discountPct, taxRatePct, frequency, visitCount }
 * @returns {
 *   perVisit: occurrenceAmounts(...)   — gross, discount, subtotal, tax, total
 *   visitsPerYear,
 *   monthly  — the pre-tax charge a month works out to, or null
 *   yearly   — the pre-tax charge a year works out to, or null when the plan
 *              runs less than a year (the figure would describe nothing sold)
 *   term     — termTotals over visitCount, or null when until cancelled
 * }
 * Every derived figure is summed from whole-cent visits, so it can never
 * disagree with the invoices by a stray cent.
 */
export function offerPricing(terms) {
  const planShape = {
    amountPerOccurrence: num(terms?.pricePerVisit) ?? 0,
    discountPct: num(terms?.discountPct) ?? 0,
    taxRatePct: terms?.taxRatePct === null || terms?.taxRatePct === undefined || terms?.taxRatePct === "" ? null : num(terms.taxRatePct),
  };
  const perVisit = occurrenceAmounts(planShape);
  const visitsPerYear = VISITS_PER_YEAR[terms?.frequency] || null;
  const count = Number.isInteger(terms?.visitCount) && terms.visitCount > 0 ? terms.visitCount : null;

  let monthly = null;
  let yearly = null;
  if (visitsPerYear && perVisit.subtotalCents > 0) {
    const yearCents = perVisit.subtotalCents * visitsPerYear;
    // A plan that stops before a year does not "cost $X a year". Until-
    // cancelled plans and plans of at least a year's visits do.
    const runsAYear = count === null || count >= visitsPerYear;
    if (runsAYear) yearly = fromCents(yearCents);
    // A month's share of that year, rounded to the cent — for a weekly plan
    // that is 52 visits over 12 months, not "4 visits a month".
    monthly = runsAYear ? fromCents(Math.round(yearCents / 12)) : null;
  }

  return {
    perVisit,
    visitsPerYear,
    monthly,
    yearly,
    term: count ? termTotals(planShape, count) : null,
  };
}

/**
 * The effective tax rate a quote charges, as a percentage to 3 places, or null
 * when it charges none. Recovered from the quote's own stored figures, the same
 * way the public route's effectiveTaxRate does, so a plan offered on a 13%
 * quote is taxed at 13% — a default the staff member can overrule.
 */
export function quoteTaxRatePct(quote) {
  if (!quote?.taxEnabled) return null;
  const base = (num(quote.subtotal) ?? 0) - (num(quote.discount) ?? 0);
  const tax = num(quote.tax) ?? 0;
  if (!(base > 0) || !(tax > 0)) return null;
  return Math.round((tax / base) * 100 * 1000) / 1000;
}

/**
 * Freeze a template onto a quote.
 *
 * @param template  the ServicePlanTemplate row
 * @param opts.language          the quote's resolved language
 * @param opts.companyLanguage   the company's own (the fallback wording)
 * @param opts.products          [{ id, name, translations }] — the company's
 *                                rows for the template's includedProductIds
 * @param opts.mode              included | optional
 * @param opts.startDate         YYYY-MM-DD or null
 * @param opts.taxRatePct        number, null (no tax) — already decided
 * @param opts.now               clock
 * @returns { ok: true, offer } | { ok: false, error }
 */
export function offerFromTemplate(template, {
  language = "en",
  companyLanguage = "en",
  products = [],
  mode = "optional",
  startDate = null,
  taxRatePct = null,
  now = new Date(),
} = {}) {
  if (!template) return { ok: false, error: "That plan template doesn't exist." };
  if (template.active === false) return { ok: false, error: "That plan is retired. Switch it back on in Settings to offer it." };
  if (!OFFER_MODES.includes(mode)) return { ok: false, error: "Choose whether the plan is included or optional." };
  const price = num(template.pricePerVisit);
  if (!(price > 0)) {
    return { ok: false, error: "This plan has no price yet. Set its price per visit in Settings → Maintenance plans first." };
  }
  if (!PLAN_FREQUENCY_KEYS.includes(template.frequency)) {
    return { ok: false, error: "This plan's cadence isn't valid. Fix it in Settings → Maintenance plans." };
  }

  let start = null;
  if (startDate) {
    const s = String(startDate).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { ok: false, error: "The first visit date isn't a date." };
    start = new Date(`${s}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime())) return { ok: false, error: "The first visit date isn't a date." };
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    if (start < today) return { ok: false, error: "The first visit can't be in the past." };
  }

  let tax = null;
  if (taxRatePct !== null && taxRatePct !== undefined && taxRatePct !== "") {
    const n = Number(taxRatePct);
    if (!Number.isFinite(n) || n < 0 || n > 100) return { ok: false, error: "The tax rate has to be between 0 and 100%." };
    tax = Math.round(n * 1000) / 1000;
  }

  const name = textIn(template.name, language, companyLanguage).slice(0, 120);
  if (!name) return { ok: false, error: "Give the plan a name in Settings first." };
  const description = textIn(template.description, language, companyLanguage).slice(0, 1200) || null;

  // The included services, by name, in the quote's language where the
  // company holds one — Product.translations { fr: { name } }.
  const wanted = Array.isArray(template.includedProductIds) ? template.includedProductIds : [];
  const byId = new Map((products || []).map((p) => [p.id, p]));
  const names = wanted
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((p) => {
      const tr = p.translations && typeof p.translations === "object" ? p.translations[language] : null;
      return String((tr && typeof tr.name === "string" && tr.name.trim()) || p.name || "").trim();
    })
    .filter(Boolean);
  // ServicePlan.serviceName is required and what the plan's invoices print.
  // With no services named, the plan's own name IS what is being sold.
  const serviceName = (names.length ? names.join(", ") : name).slice(0, 120);

  return {
    ok: true,
    offer: {
      templateId: template.id || null,
      mode,
      language,
      name,
      description,
      serviceName,
      categoryId: template.categoryId || null,
      frequency: template.frequency,
      visitCount: Number.isInteger(template.visitCount) && template.visitCount > 0 ? template.visitCount : null,
      startDate: start,
      pricePerVisit: Math.round(price * 100) / 100,
      discountPct: num(template.discountPct) ?? 0,
      taxRatePct: tax,
    },
  };
}

/**
 * Which offers an approval takes: every `included` one, plus the `optional`
 * ones whose ids the client posted. Ids are intersected with THIS quote's own
 * offers, so an id copied from another quote — or invented — takes nothing and
 * confirms nothing. The client never sends a price; there is nowhere to put one.
 */
export function offersTaken(offers, requestedIds) {
  const list = Array.isArray(offers) ? offers : [];
  const asked = new Set((Array.isArray(requestedIds) ? requestedIds : []).filter((id) => typeof id === "string"));
  return list.filter((o) => o && (o.mode === "included" || (o.mode === "optional" && asked.has(o.id))));
}

/**
 * The first visit of a plan created on approval.
 *
 * A stated date still ahead of the approval is kept. Otherwise — none stated,
 * or the stated one passed while the quote waited — the first visit is one
 * cadence step after the approval day, which is what the quote page told the
 * client ("first visit about three months after you approve"). Never the
 * approval day itself: that would raise an invoice the same night for a visit
 * nobody has booked, and a start date in the past would silently drop the
 * visits before the plan existed (dueOccurrences skips them, by design).
 */
export function planStartDate(offer, acceptedAt = new Date()) {
  const a = acceptedAt instanceof Date ? acceptedAt : new Date(acceptedAt);
  const day = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()));
  const stated = offer?.startDate ? new Date(offer.startDate) : null;
  if (stated && !Number.isNaN(stated.getTime()) && stated > day) return stated;
  return occurrenceDate(day, offer?.frequency, 1);
}

/**
 * The ServicePlan data an approved offer becomes — through validatePlanInput,
 * the same gate a plan typed by hand at /app/plans/new passes, so a plan sold
 * on a quote cannot hold terms a hand-made one would be refused.
 *
 * Collection is `invoice`: each visit raises an invoice and emails the pay
 * link. Automatic charging needs the client's own written authorisation
 * (/plan/<token>), which staff can request from the plan page afterwards.
 */
export function planInputFromOffer(offer, { clientId, acceptedAt = new Date() } = {}) {
  const start = planStartDate(offer, acceptedAt);
  if (!start) return { ok: false, error: "malformed_start" };
  const body = {
    name: offer.name,
    serviceName: offer.serviceName,
    clientId,
    categoryId: offer.categoryId || null,
    frequency: offer.frequency,
    startDate: start.toISOString().slice(0, 10),
    endMode: offer.visitCount ? "count" : "open",
    occurrenceCount: offer.visitCount || null,
    amountPerOccurrence: num(offer.pricePerVisit),
    discountPct: num(offer.discountPct) ?? 0,
    taxRatePct: offer.taxRatePct === null || offer.taxRatePct === undefined ? null : num(offer.taxRatePct),
    collectionMode: "invoice",
  };
  return validatePlanInput(body, { language: offer.language || "en" });
}

/** Cadence keys, re-exported for the settings form. */
export { PLAN_FREQUENCY_KEYS, PLAN_FREQUENCIES };
