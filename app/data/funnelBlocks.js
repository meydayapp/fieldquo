// app/data/funnelBlocks.js
//
// The funnel step vocabulary and its sanitiser — the boundary between "what a
// browser sent" and "what is served to the public", exactly like siteBlocks.js
// is for websites. A funnel is an ordered array of typed STEPS; each step is a
// full-screen mobile card. The model (in AI generation) and the builder may only
// produce these kinds and these fields, and everything crossing the boundary is
// clamped here so a stored funnel can never become a script, a layout it didn't
// define, or a javascript: image URL.
//
// Kinds:
//   intro          — hook: headline, subhead, CTA, optional image
//   question_single— one tappable answer; can branch and can map to a scorer key
//   question_multi — several tappable answers
//   form           — the contact capture (name / email / phone)
//   photo_upload   — homeowner attaches photos of the job
//   thankyou       — end screen

export const FUNNEL_STEP_KINDS = [
  "intro",
  "question_single",
  "question_multi",
  "form",
  "photo_upload",
  "thankyou",
];

// Which text fields each kind owns, and their max length. Anything not listed is
// dropped. Mirrors siteBlocks' `editable` whitelist.
const TEXT_FIELDS = {
  intro: { headline: 120, subhead: 300, buttonText: 40 },
  question_single: { question: 160, help: 300 },
  question_multi: { question: 160, help: 300, buttonText: 40 },
  form: { headline: 120, subhead: 300, buttonText: 40, consent: 300 },
  photo_upload: { headline: 120, subhead: 300, buttonText: 40 },
  thankyou: { headline: 120, subhead: 400 },
};

// Steps that carry an answer list, and whether the visitor may pick more than one.
const ANSWER_KINDS = new Set(["question_single", "question_multi"]);

// A question answer can map its chosen value onto a lead-scoring input, so a
// funnel budget/timeline question feeds the same triage as the self-quote form.
const ANSWER_MAPS = new Set(["budget", "timeline", ""]);

// The only contact fields a form step may request.
const FORM_FIELDS = ["name", "email", "phone"];

const MAX_STEPS = 24;
const MAX_ANSWERS = 12;

function str(v, max) {
  return typeof v === "string" ? v.slice(0, max) : "";
}

// http(s) only — blocks javascript:/data: exactly as the website sanitiser does.
function safeUrl(value) {
  if (typeof value !== "string") return "";
  const v = value.trim();
  return /^https?:\/\//i.test(v) ? v.slice(0, 2000) : "";
}

// Stable-ish id when one is missing. No Math.random (banned in some run
// contexts and irrelevant here) — index + kind is unique within a funnel.
function stepId(step, i) {
  return typeof step?.id === "string" && step.id ? step.id.slice(0, 40) : `s${i}`;
}

function cleanAnswers(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, MAX_ANSWERS).map((a, i) => {
    const maps = ANSWER_MAPS.has(a?.maps) ? a.maps : "";
    return {
      id: typeof a?.id === "string" && a.id ? a.id.slice(0, 40) : `a${i}`,
      label: str(a?.label, 120),
      // `value` is what gets stored/scored; defaults to the label when unset.
      value: str(a?.value ?? a?.label, 120),
      // Optional per-answer weight for a lightweight quiz score (0–50).
      weight: Number.isFinite(a?.weight) ? Math.max(0, Math.min(50, Math.round(a.weight))) : 0,
      // Branch target step id, or null for "next".
      next: typeof a?.next === "string" && a.next ? a.next.slice(0, 40) : null,
      ...(maps ? { maps } : {}),
    };
  });
}

/**
 * The boundary. Returns a clean, render-safe steps array. Unknown kinds are
 * dropped; a funnel with no steps left falls back to a single thank-you so the
 * public page never renders blank.
 */
export function sanitiseFunnelSteps(steps) {
  const arr = Array.isArray(steps) ? steps.slice(0, MAX_STEPS) : [];
  const clean = [];

  for (let i = 0; i < arr.length; i++) {
    const step = arr[i];
    const kind = FUNNEL_STEP_KINDS.includes(step?.kind) ? step.kind : null;
    if (!kind) continue;

    const out = { id: stepId(step, i), kind };

    const fields = TEXT_FIELDS[kind] || {};
    for (const [field, max] of Object.entries(fields)) {
      if (step[field] != null) out[field] = str(step[field], max);
    }

    if (kind === "intro" || kind === "thankyou" || kind === "photo_upload") {
      const img = safeUrl(step.image);
      if (img) out.image = img;
    }

    if (ANSWER_KINDS.has(kind)) {
      out.answers = cleanAnswers(step.answers);
      // What this question feeds, if anything (budget/timeline). Single-choice
      // only — a multi-select budget makes no sense.
      if (kind === "question_single" && ANSWER_MAPS.has(step.maps) && step.maps) {
        out.maps = step.maps;
      }
    }

    if (kind === "form") {
      const requested = Array.isArray(step.fields) ? step.fields : FORM_FIELDS;
      out.fields = FORM_FIELDS.filter((f) => requested.includes(f));
      // Name is always collected; a form with no way to reply is useless.
      if (!out.fields.includes("name")) out.fields.unshift("name");
      if (!out.fields.includes("email") && !out.fields.includes("phone")) {
        out.fields.push("email");
      }
    }

    clean.push(out);
  }

  if (clean.length === 0) {
    return [{ id: "s0", kind: "thankyou", headline: "Thanks — we'll be in touch." }];
  }
  return clean;
}

// Does this funnel have a way to capture a lead? A funnel with no form step
// collects nothing — the builder warns, and publish is blocked on it.
export function funnelHasForm(steps) {
  return Array.isArray(steps) && steps.some((s) => s?.kind === "form");
}
