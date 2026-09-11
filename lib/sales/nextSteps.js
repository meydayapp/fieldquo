// lib/sales/nextSteps.js
//
// The three next steps a call can end in, and the rule that gates the third.
//
// ══ Demo, sign-up, walkthrough — three different things ═══════════════════
//
// The owner, on the disposition form: a call that went well ends in one of
// three places, and the form offered one ("Schedule a call back").
//
//   demo         thirty minutes with the REP, on the rep's own calendar —
//                "I can show you in fifteen minutes how it works for a
//                business like yours", booked as a SalesEvent of type "demo"
//                with an end time, so it is a span on the calendar and not a
//                point like a callback.
//   signup       the rep texted or emailed the sign-up link. The lead moves
//                to the pipeline's waiting-to-sign state, and from here the
//                REP is responsible for the company finishing onboarding:
//                once the lead is linked to the company that registered, the
//                lead card shows "3 of 8 setup steps done" so the rep can
//                chase.
//   walkthrough  one hour with a SPECIALIST — a platform admin on FieldQuo's
//                own demo calendar (DemoHostAvailability), the same calendar
//                the homepage demo and the migration consultation book
//                against. Offered ONLY once the linked company's onboarding
//                is complete: a walkthrough of a company with no prices and
//                no Stripe is an hour spent on setup, which the rep and the
//                checklist already own.
//
// ══ The status a "sent to sign up" lead moves to ═════════════════════════
//
// SalesLead.status is a closed list — new · contacted · demoed · signed ·
// lost (lib/sales/outreachPipeline.js) — and the schema header is its
// authority. "demoed" is the one state between contacted and signed: the
// pitch has happened and the company has been handed the link. It is used
// here for exactly that, and NOT widened with a sixth value, because the
// board, the funnel and the performance report all count these five and a
// sixth would be a status three screens do not know.
//
// ══ Pure ═════════════════════════════════════════════════════════════════
//
// No database. The route hands in what it read and this says what to do,
// so every branch — no lead, lead not linked, linked but two steps short,
// complete — is executed by scripts/check-playbook-voice.mjs.

/** The three kinds. A SalesEvent.type for two of them; a status write for one. */
export const NEXT_STEP_KINDS = Object.freeze(["demo", "signup", "walkthrough"]);

/** The calendar kinds, with the length a booking spans. */
export const NEXT_STEP_MINUTES = Object.freeze({ demo: 30, walkthrough: 60 });

/** Where a "sent to sign up" lead goes. See the header. */
export const SIGNUP_SENT_STATUS = "demoed";

/** The DemoBooking.source a walkthrough is filed under. */
export const WALKTHROUGH_SOURCE = "walkthrough";

export const isNextStepKind = (v) => NEXT_STEP_KINDS.includes(v);

/** The moment a span ends. `startAt` is a Date; the result is a new one. */
export function endOf(kind, startAt) {
  const minutes = NEXT_STEP_MINUTES[kind];
  if (!minutes || !(startAt instanceof Date) || Number.isNaN(startAt.getTime())) return null;
  return new Date(startAt.getTime() + minutes * 60_000);
}

/** Why a walkthrough may not be booked. A closed list, keyed for the screen. */
export const WALKTHROUGH_REFUSALS = Object.freeze({
  no_lead: "A walkthrough is booked from a lead, so the company it is for is known.",
  not_linked: "The lead is not linked to a company yet. Link the sign-up first — the walkthrough is for a company that exists.",
  onboarding_incomplete: "Their setup is not finished. A walkthrough is for a company that has finished onboarding; until then the checklist is the next step.",
});

/**
 * May this lead book the specialist?
 *
 * @param lead        { id, convertedCompanyId } or null
 * @param onboarding  getOnboardingStatus() output for the linked company, or
 *                    null when there is no company to read
 * @returns { allowed, reason, reasonKey, done, total }
 */
export function walkthroughGate({ lead = null, onboarding = null } = {}) {
  const done = Array.isArray(onboarding?.steps) ? onboarding.steps.filter((s) => s.done).length : 0;
  const total = Array.isArray(onboarding?.steps) ? onboarding.steps.length : 0;
  const refuse = (code) => ({
    allowed: false,
    reason: WALKTHROUGH_REFUSALS[code],
    reasonKey: `app.salesCall.walkthroughRefusal.${code}`,
    done,
    total,
  });
  if (!lead?.id) return refuse("no_lead");
  if (!lead.convertedCompanyId || !onboarding) return refuse("not_linked");
  if (onboarding.complete !== true) return refuse("onboarding_incomplete");
  return { allowed: true, reason: null, reasonKey: null, done, total };
}

/**
 * The onboarding progress a lead card prints for a linked company — the
 * count, not the steps, because the rep's job is to chase, and the steps
 * themselves are the company's own dashboard.
 */
export function onboardingProgress(onboarding) {
  if (!onboarding || !Array.isArray(onboarding.steps)) return null;
  const done = onboarding.steps.filter((s) => s.done).length;
  return {
    done,
    total: onboarding.steps.length,
    complete: onboarding.complete === true,
    // The keys of what is still open, so the rep can say which, not only
    // how many. Labels stay on the company's own screen.
    open: onboarding.steps.filter((s) => !s.done).map((s) => s.key),
  };
}
