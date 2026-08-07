// lib/funnels/generate.js
//
// AI funnel generation, on the same leash as lib/site/generateSite.js: the model
// writes SENTENCES only. It never invents the funnel mechanics, a service, or a
// price, and it never touches the scoring steps — the timeline and budget
// questions keep their fixed answer values (asap / 5k_15k / …) so a generated
// funnel scores leads exactly like a hand-built one. Every path falls back to the
// deterministic channel template, so AI being down produces plainer copy, never a
// broken funnel.

import { complete, isAiConfigured } from "@/lib/ai/provider";
import { buildFunnelFromTemplate } from "@/lib/funnels/templates";
import { sanitiseFunnelSteps } from "@/app/data/funnelBlocks";

// Keyword match, no model — gives the prompt "teeth" even offline, exactly like
// promptIntent does for websites.
function channelFromPrompt(prompt) {
  const p = String(prompt || "").toLowerCase();
  if (/tiktok|tik tok/.test(p)) return "tiktok";
  if (/instagram|insta\b|\big\b|reels/.test(p)) return "instagram";
  if (/youtube|\byt\b/.test(p)) return "youtube";
  return "web";
}

const TEMPLATE_FOR = {
  tiktok: "tiktok_quiz",
  instagram: "instagram_estimate",
  youtube: "youtube_leadmagnet",
  web: "web_quote",
};

const SYSTEM = `You write the COPY for a field-service contractor's mobile lead funnel — a short, tap-through quiz that turns an ad click into a booked estimate. Think Instagram-Stories pacing: punchy, concrete, one idea per screen, written for a homeowner on a phone.

You are given: the company name, the ad channel, the company's real services, and what the contractor asked for. Write copy that fits THAT business and THAT channel.

Return ONLY a JSON object, no markdown, with exactly these keys:
{
  "name": "internal funnel name, 2-5 words",
  "intro": { "headline": "the hook, under 8 words", "subhead": "one supporting line", "buttonText": "2-3 words" },
  "extraQuestion": { "question": "one extra qualifying question that fits this trade", "answers": ["3-5 short answer labels"] },
  "form": { "headline": "why they should leave details", "subhead": "one reassuring line" },
  "thankyou": { "headline": "warm confirmation", "subhead": "what happens next" }
}

Rules:
- NEVER invent a service the company doesn't offer, and NEVER state or imply a price, discount, or guarantee.
- The extraQuestion is a QUALITATIVE question (condition, size, style, property type) — NOT about budget or timing (those are asked separately). If nothing useful fits, set "extraQuestion" to null.
- Keep every string short enough to read on a phone in one glance. No emojis unless the channel is TikTok or Instagram, and at most one.`;

function slugFromLabel(label, i) {
  const s = String(label || "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 40);
  return s || `opt${i + 1}`;
}

// Fold the model's prose onto the deterministic skeleton. Scoring steps
// (service / timeline / budget / photo / form fields) keep their structure; only
// the words change, plus one optional extra qualitative question after service.
function mergeFunnelCopy(baseSteps, copy) {
  const steps = baseSteps.map((s) => ({ ...s }));

  const intro = steps.find((s) => s.kind === "intro");
  if (intro && copy.intro) {
    if (copy.intro.headline) intro.headline = copy.intro.headline;
    if (copy.intro.subhead) intro.subhead = copy.intro.subhead;
    if (copy.intro.buttonText) intro.buttonText = copy.intro.buttonText;
  }

  const form = steps.find((s) => s.kind === "form");
  if (form && copy.form) {
    if (copy.form.headline) form.headline = copy.form.headline;
    if (copy.form.subhead) form.subhead = copy.form.subhead;
  }

  const ty = steps.find((s) => s.kind === "thankyou");
  if (ty && copy.thankyou) {
    if (copy.thankyou.headline) ty.headline = copy.thankyou.headline;
    if (copy.thankyou.subhead) ty.subhead = copy.thankyou.subhead;
  }

  // Insert the extra qualitative question after the service step (or after the
  // intro if there's no service step). No `maps` — it colours the lead, never
  // the score.
  const eq = copy.extraQuestion;
  if (eq && eq.question && Array.isArray(eq.answers) && eq.answers.length >= 2) {
    const q = {
      id: "aiq",
      kind: "question_single",
      question: eq.question,
      answers: eq.answers.slice(0, 5).map((label, i) => ({
        id: `aiq${i}`,
        label: String(label).slice(0, 120),
        value: slugFromLabel(label, i),
      })),
    };
    const anchor = steps.findIndex((s) => s.id === "service");
    const at = anchor >= 0 ? anchor + 1 : 1;
    steps.splice(at, 0, q);
  }

  return steps;
}

/**
 * @returns {{ name:string, channel:string, steps:object[], generated:boolean }}
 */
export async function generateFunnel({ company = {}, services = [], prompt, onUsage, forceFallback = false }) {
  const channel = channelFromPrompt(prompt);
  const fallback = buildFunnelFromTemplate(TEMPLATE_FOR[channel], { company, services });

  // forceFallback: the caller (over AI quota) wants the deterministic template
  // without spending a model call.
  if (forceFallback || !isAiConfigured()) {
    return { name: fallback.name, channel, steps: sanitiseFunnelSteps(fallback.steps), generated: false };
  }

  const facts = {
    company: company.name || "the company",
    channel,
    services: (services || []).map((s) => s.label).filter(Boolean).slice(0, 8),
    request: String(prompt || "").slice(0, 500),
  };

  let text;
  try {
    text = await complete({
      system: SYSTEM,
      prompt: JSON.stringify(facts),
      maxTokens: 900,
      quality: "writing",
      onUsage,
    });
  } catch {
    return { name: fallback.name, channel, steps: sanitiseFunnelSteps(fallback.steps), generated: false };
  }

  if (!text) {
    return { name: fallback.name, channel, steps: sanitiseFunnelSteps(fallback.steps), generated: false };
  }

  let copy;
  try {
    copy = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim());
  } catch {
    return { name: fallback.name, channel, steps: sanitiseFunnelSteps(fallback.steps), generated: false };
  }

  const merged = mergeFunnelCopy(fallback.steps, copy);
  return {
    name: (copy.name || fallback.name).slice(0, 120),
    channel,
    steps: sanitiseFunnelSteps(merged),
    generated: true,
  };
}
