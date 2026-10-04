// lib/funnels/templates.js
//
// Prebuilt funnels by channel — the "pick a starting point, edit the copy in 20
// minutes" library, so a non-technical contractor never faces a blank canvas.
// Each template is a factual steps array built from the company's OWN services
// and currency (never invented), then editable in the builder afterwards. This
// is also the deterministic fallback the AI generator drops to when the model is
// unavailable — a plainer funnel, never a broken one (mirrors generateSite.js).
//
// Every template ends the same way: a timeline question, a budget question, an
// optional photo upload, a contact form, and a thank-you — because that tail is
// what turns a tap-through into a *scored* lead in the same pipeline as the rest.
//
// ── In the company's language (2026-10-03) ─────────────────────────────────
//
// The words come from lib/i18n/funnelStarterCopy.js, in the language the
// funnel's public page is drawn in — the company's (lib/i18n/funnelCopy.js's
// funnelPageLanguage). They were English for every company until then, so a
// French contractor's page opened on an English hook over French chrome.
// English output is unchanged, except a company with no name, whose web hook
// read "Get your us quote" and now reads "Get your quote".

import { CURRENCY_SYMBOL } from "@/lib/currency";
import { funnelStarterCopy } from "@/lib/i18n/funnelStarterCopy";
import { documentFormatters } from "@/lib/i18n/documentLabels";

const ENGLISH = funnelStarterCopy("en");

// Channel copy differs only at the hook — the mechanics are identical, because
// what qualifies a lead doesn't change with where the ad ran. `name`, `hook`
// and `sub` are the ENGLISH starter (the back office's template picker keys
// its own label off `key`); buildFunnelFromTemplate reads the language it is
// building in.
export const FUNNEL_TEMPLATES = [
  { key: "web_quote", channel: "web" },
  { key: "tiktok_quiz", channel: "tiktok" },
  { key: "instagram_estimate", channel: "instagram" },
  { key: "youtube_leadmagnet", channel: "youtube" },
].map((t) => ({ ...t, name: ENGLISH.templates[t.key].name, hook: ENGLISH.templates[t.key].hook, sub: ENGLISH.templates[t.key].sub }));

function symbol(currency) {
  return CURRENCY_SYMBOL[currency] || "$";
}

// Where a language writes the currency sign. The figure's grouping comes from
// the language's document locale (documentFormatters), so a French budget
// reads "1 000 $" and a German one "1.000 €" — the same convention as that
// reader's quotes. English keeps exactly what it always printed: "$1,000".
const SIGN_AFTER = new Set(["fr", "de", "it", "uk"]);

export function budgetAmount(n, currency, language = "en") {
  const s = symbol(currency);
  if (!language || language === "en") return `${s}${Number(n).toLocaleString("en-US")}`;
  let grouped;
  try {
    grouped = Number(n).toLocaleString(documentFormatters(language).locale);
  } catch {
    grouped = Number(n).toLocaleString("en-US");
  }
  return SIGN_AFTER.has(language) ? `${grouped} ${s}` : `${s}${grouped}`;
}

function timelineStep(c) {
  return {
    id: "timeline",
    kind: "question_single",
    question: c.timeline.question,
    maps: "timeline",
    answers: [
      { id: "asap", label: c.timeline.asap, value: "asap" },
      { id: "2w", label: c.timeline.twoWeeks, value: "2_weeks" },
      { id: "13m", label: c.timeline.months, value: "1_3_months" },
      { id: "exp", label: c.timeline.exploring, value: "exploring" },
    ],
  };
}

function budgetStep(c, currency, language) {
  const a = (n) => budgetAmount(n, currency, language);
  return {
    id: "budget",
    kind: "question_single",
    question: c.budget.question,
    maps: "budget",
    answers: [
      { id: "u1", label: c.budget.under(a(1000)), value: "under_1k" },
      { id: "1t5", label: c.budget.range(a(1000), a(5000)), value: "1k_5k" },
      { id: "5t15", label: c.budget.range(a(5000), a(15000)), value: "5k_15k" },
      { id: "15p", label: c.budget.plus(a(15000)), value: "15k_plus" },
      { id: "uns", label: c.budget.unsure, value: "unsure" },
    ],
  };
}

// The service question is built from the company's real enabled services. With
// none configured it's skipped rather than invented.
function serviceStep(services, c) {
  const list = (services || []).filter((s) => s?.label).slice(0, 8);
  if (list.length < 2) return null;
  return {
    id: "service",
    kind: "question_single",
    question: c.service,
    answers: list.map((s, i) => ({
      id: `svc${i}`,
      label: s.label.slice(0, 120),
      value: s.key || s.label,
    })),
  };
}

/**
 * @param {string} templateKey
 * @param {object} ctx
 * @param {{name?:string, currency?:string, defaultLanguage?:string}} ctx.company
 * @param {Array<{key?:string,label:string}>} [ctx.services]
 * @param {string} [ctx.language]  defaults to the company's language
 * @returns {{ name:string, channel:string, steps:object[] }}
 */
export function buildFunnelFromTemplate(templateKey, { company = {}, services = [], language = null } = {}) {
  const tpl = FUNNEL_TEMPLATES.find((t) => t.key === templateKey) || FUNNEL_TEMPLATES[0];
  const lang = language || company.defaultLanguage || "en";
  const c = funnelStarterCopy(lang);
  const words = c.templates[tpl.key];
  const co = String(company.name || "").trim();

  const steps = [
    {
      id: "intro",
      kind: "intro",
      headline: co ? words.hook(co) : words.hookNoName,
      subhead: words.sub,
      buttonText: c.introButton,
    },
    serviceStep(services, c),
    timelineStep(c),
    budgetStep(c, company.currency, lang),
    {
      id: "photos",
      kind: "photo_upload",
      headline: c.photos.headline,
      subhead: c.photos.subhead,
      buttonText: c.photos.button,
    },
    {
      id: "contact",
      kind: "form",
      headline: c.contact.headline,
      subhead: c.contact.subhead,
      buttonText: c.contact.button,
      fields: ["name", "email", "phone"],
    },
    {
      id: "done",
      kind: "thankyou",
      headline: c.done.headline,
      subhead: co ? c.done.subhead(co) : c.done.subheadNoName,
    },
  ].filter(Boolean);

  return { name: words.name, channel: tpl.channel, steps };
}

/**
 * The blank funnel's three steps ("start from scratch"), in the company's
 * language — the same rule as the starters. `name` is what the company typed,
 * or nothing.
 */
export function blankFunnelSteps(language, name = "") {
  const b = funnelStarterCopy(language).blank;
  return [
    { id: "intro", kind: "intro", headline: name || b.introHeadline, buttonText: b.introButton },
    { id: "contact", kind: "form", headline: b.contactHeadline, fields: ["name", "email", "phone"], buttonText: b.contactButton },
    { id: "done", kind: "thankyou", headline: b.doneHeadline },
  ];
}

/** The internal name for a funnel nobody named, in the company's language. */
export function untitledFunnelName(language) {
  return funnelStarterCopy(language).blank.untitled;
}
