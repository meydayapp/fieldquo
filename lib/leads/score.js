// lib/leads/score.js
//
// Lead triage: turn a self-quote submission into a hot / warm / cold verdict a
// contractor can act on before their coffee's cold. Deliberately a transparent,
// explainable heuristic — NOT a model. Every point added carries a human-readable
// reason, so the rep sees *why* a lead is hot and can overrule it. A black-box
// number nobody trusts gets ignored, and an ignored score is a dead control.
//
// The weights encode what actually predicts a won trade job, in priority order:
//   1. Timeline — the strongest buying signal. "ASAP" beats a big budget that's
//      "just exploring".
//   2. Budget — a bigger stated budget is a bigger, more committed job.
//   3. Emergency — a burst pipe or storm damage is a now-job whatever box they
//      ticked for timeline.
//   4. Contactability — a phone number is worth more than an email to a trade.
//   5. Engagement — effort spent (photos, a drawn kitchen, a real description)
//      predicts intent.
//
// Pure function of the lead's own fields, so it can run at creation time in every
// intake route AND be recomputed later from a stored lead with identical results.

import { countMediaKinds } from "@/lib/media/validate";

const BUDGET_POINTS = {
  "15k_plus": 30,
  "5k_15k": 22,
  "1k_5k": 14,
  under_1k: 6,
  unsure: 0,
};
const BUDGET_REASON = {
  "15k_plus": "Budget $15k+",
  "5k_15k": "Budget $5k–$15k",
  "1k_5k": "Budget $1k–$5k",
  under_1k: "Budget under $1k",
  unsure: "Budget not stated",
};
const TIMELINE_POINTS = { asap: 35, "2_weeks": 25, "1_3_months": 12, exploring: 2 };
const TIMELINE_REASON = {
  asap: "Ready to start ASAP",
  "2_weeks": "Wants to start within 2 weeks",
  "1_3_months": "Planning within 1–3 months",
  exploring: "Just exploring for now",
};

// Intake answer keys that mean "this is an emergency" across trades. These are
// the only structured urgency signals that already existed in the intake schema
// (plumbing, hvac, fencing…), so a lead that tripped one is a now-job.
const EMERGENCY_KEYS = ["isEmergency", "isEmergencyOrStormDamage", "emergency"];

function isEmergencyIntake(intake) {
  if (!intake || typeof intake !== "object") return false;
  return EMERGENCY_KEYS.some((k) => {
    const v = intake[k];
    return v === true || v === "true" || v === "yes";
  });
}

/**
 * @param {object} lead - a LeadRequest-shaped object (may be pre-create data).
 *   Reads: budgetBand, timeline, phone, email, clientPhotos, kitchenDesign,
 *   message, and intake (for emergency flags).
 * @returns {{ score:number, temperature:"hot"|"warm"|"cold", reasons:{label:string,weight:number}[] }}
 */
/**
 * Points only a form can collect, and what each is worth.
 *
 * ── Why a channel has to be able to say "nobody asked" ────────────────────
 *
 * The score was earned out of a fixed 100, and 30 of those points are BUDGET —
 * which the phone receptionist is FORBIDDEN to ask about. Absolute rule 1 in
 * lib/voice/prompt.js: never give a price, never discuss one. So every lead the
 * receptionist ever took was marked against a total it could not reach.
 *
 * The effect was not subtle. A real call — a name, an email, a number, an
 * address and thirty-seven cabinet doors with soft-close hinges and new handle
 * holes — scored 17 and came out COLD, below a web form where somebody ticked
 * "ASAP" and typed nothing else. That word is what a contractor uses to decide
 * who to ring first.
 *
 * Same rule the rest of the product already follows: absence of a statement is
 * not a statement. A question nobody asked is not a question answered badly, so
 * its points leave the DENOMINATOR rather than counting against the lead.
 */
const CHANNEL_MAX = { budget: 30 };

export function scoreLead(lead = {}, { unasked = [] } = {}) {
  const reasons = [];
  let score = 0;
  const add = (points, label) => {
    if (points > 0) {
      score += points;
      reasons.push({ label, weight: points });
    }
  };

  // 1 — Timeline
  const tPts = TIMELINE_POINTS[lead.timeline];
  if (tPts != null) add(tPts, TIMELINE_REASON[lead.timeline]);

  // 2 — Budget (0-point "unsure" still gets a reason so its absence is visible)
  const bPts = BUDGET_POINTS[lead.budgetBand];
  if (bPts != null) {
    if (bPts > 0) add(bPts, BUDGET_REASON[lead.budgetBand]);
    else reasons.push({ label: BUDGET_REASON[lead.budgetBand], weight: 0 });
  }

  // 3 — Emergency (from structured intake flags)
  if (isEmergencyIntake(lead.intake)) add(20, "Flagged as an emergency");

  // 4 — Contactability
  if (lead.phone) add(8, "Phone number provided");
  if (lead.email) add(4, "Email provided");

  // 5 — Engagement
  //
  // Photos and plans are scored separately, and a plan is worth more.
  //
  // A photo means someone pointed a phone at a wall — thirty seconds of effort,
  // and a real signal, which is why it scores at all. A PDF plan means they have
  // already been through IKEA's kitchen planner (or an architect), settled on a
  // layout, and produced a document. That is someone with a decided project and
  // a shortlist of contractors, not someone browsing — much closer to the
  // "Designed a kitchen layout" signal below, which the codebase already scores
  // at 8, than to a snapshot.
  //
  // Deliberately not scored as a bigger photo count: they are different acts, so
  // folding them together would let four blurry photos outrank a plan.
  const { visual: photoCount, documents: planCount } = countMediaKinds(lead.clientPhotos);
  if (photoCount > 0) {
    add(Math.min(10, photoCount * 4), `${photoCount} photo${photoCount > 1 ? "s" : ""} attached`);
  }
  if (planCount > 0) {
    // Capped at one plan's worth: a second PDF is usually the same kitchen's
    // second page, not twice the intent.
    add(12, `Sent a plan (${planCount} PDF${planCount > 1 ? "s" : ""})`);
  }
  if (lead.kitchenDesign) add(8, "Designed a kitchen layout");
  if ((lead.message || "").trim().length >= 120) add(5, "Wrote a detailed description");

  // ── Out of what was ASKABLE, not out of a flat hundred ─────────────────
  //
  // `unasked` names the factors this channel cannot collect. Their points come
  // out of the DENOMINATOR, so a phone lead is measured against phone leads
  // rather than against a form it was never shown. Empty for the web, which is
  // why every existing score is unchanged.
  const withheld = (Array.isArray(unasked) ? unasked : [])
    .map((k) => CHANNEL_MAX[k] || 0)
    .reduce((a, b) => a + b, 0);
  const available = Math.max(1, 100 - withheld);

  score = Math.max(0, Math.min(100, Math.round((score / available) * 100)));
  // Hot ≥ 60, warm ≥ 30, else cold. Tuned so an ASAP job with any real budget or
  // an emergency lands hot, and a budgeted-but-unhurried enquiry lands warm.
  const temperature = score >= 60 ? "hot" : score >= 30 ? "warm" : "cold";
  reasons.sort((a, b) => b.weight - a.weight);
  // Said where the reasons are read, so nobody wonders why a lead with no
  // budget on it scores like one that has a budget.
  if (withheld > 0) {
    reasons.push({ label: "Scored without budget — the phone can't ask", weight: 0 });
  }
  return { score, temperature, reasons };
}

// The three bands, for UI that iterates them (filter chips, legend).
export const TEMPERATURES = ["hot", "warm", "cold"];
