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

import { CURRENCY_SYMBOL } from "@/lib/currency";

// Channel copy differs only at the hook — the mechanics are identical, because
// what qualifies a lead doesn't change with where the ad ran.
export const FUNNEL_TEMPLATES = [
  {
    key: "web_quote",
    channel: "web",
    name: "Website — get a quote",
    hook: (co) => `Get your ${co} quote`,
    sub: "Answer a few quick questions and we'll get you a price.",
  },
  {
    key: "tiktok_quiz",
    channel: "tiktok",
    name: "TikTok — 60-second quiz",
    hook: () => "Get your price in 60 seconds",
    sub: "Tap through — no calls, no obligation.",
  },
  {
    key: "instagram_estimate",
    channel: "instagram",
    name: "Instagram — free estimate",
    hook: (co) => `Free estimate from ${co}`,
    sub: "A few taps and we'll be in touch with your number.",
  },
  {
    key: "youtube_leadmagnet",
    channel: "youtube",
    name: "YouTube — book your visit",
    hook: (co) => `Work with ${co}`,
    sub: "Tell us about the job and book a time that suits you.",
  },
];

function symbol(currency) {
  return CURRENCY_SYMBOL[currency] || "$";
}

function timelineStep() {
  return {
    id: "timeline",
    kind: "question_single",
    question: "When are you hoping to start?",
    maps: "timeline",
    answers: [
      { id: "asap", label: "As soon as possible", value: "asap" },
      { id: "2w", label: "Within 2 weeks", value: "2_weeks" },
      { id: "13m", label: "In the next 1–3 months", value: "1_3_months" },
      { id: "exp", label: "Just exploring", value: "exploring" },
    ],
  };
}

function budgetStep(currency) {
  const s = symbol(currency);
  return {
    id: "budget",
    kind: "question_single",
    question: "Roughly what's your budget?",
    maps: "budget",
    answers: [
      { id: "u1", label: `Under ${s}1,000`, value: "under_1k" },
      { id: "1t5", label: `${s}1,000 – ${s}5,000`, value: "1k_5k" },
      { id: "5t15", label: `${s}5,000 – ${s}15,000`, value: "5k_15k" },
      { id: "15p", label: `${s}15,000+`, value: "15k_plus" },
      { id: "uns", label: "Not sure yet", value: "unsure" },
    ],
  };
}

// The service question is built from the company's real enabled services. With
// none configured it's skipped rather than invented.
function serviceStep(services) {
  const list = (services || []).filter((s) => s?.label).slice(0, 8);
  if (list.length < 2) return null;
  return {
    id: "service",
    kind: "question_single",
    question: "What can we help with?",
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
 * @param {{name?:string, currency?:string}} ctx.company
 * @param {Array<{key?:string,label:string}>} [ctx.services]
 * @returns {{ name:string, channel:string, steps:object[] }}
 */
export function buildFunnelFromTemplate(templateKey, { company = {}, services = [] } = {}) {
  const tpl = FUNNEL_TEMPLATES.find((t) => t.key === templateKey) || FUNNEL_TEMPLATES[0];
  const co = company.name || "us";

  const steps = [
    {
      id: "intro",
      kind: "intro",
      headline: tpl.hook(co),
      subhead: tpl.sub,
      buttonText: "Get started",
    },
    serviceStep(services),
    timelineStep(),
    budgetStep(company.currency),
    {
      id: "photos",
      kind: "photo_upload",
      headline: "Add a few photos (optional)",
      subhead: "A picture of the job helps us give you an accurate price faster.",
      buttonText: "Continue",
    },
    {
      id: "contact",
      kind: "form",
      headline: "Where should we send your quote?",
      subhead: "One of email or phone is enough.",
      buttonText: "Get my quote",
      fields: ["name", "email", "phone"],
    },
    {
      id: "done",
      kind: "thankyou",
      headline: "Thanks — we've got everything we need",
      subhead: `${co === "us" ? "We" : co} will be in touch shortly with your price. No obligation.`,
    },
  ].filter(Boolean);

  return { name: tpl.name, channel: tpl.channel, steps };
}
