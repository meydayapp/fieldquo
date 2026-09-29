// lib/signup/welcomeGate.js
//
// Should this visit to /app be sent to the welcome questions instead?
//
// The owner's requirement (2026-09-29): somebody who signs out, closes the
// tab or comes back days later must land exactly where they stopped, until
// they finish. The company exists from the first screen (lib/signup/welcome.js),
// so the only place that sees them come back is the /app shell — which is
// where app/app/layout.js calls this, beside the checkout gate
// (lib/signup/setupGate.js), for the reason middleware.js's header gives:
// middleware knows a cookie exists, not whose company it opens.
//
// ══ Who is never sent anywhere ═════════════════════════════════════════════
//
//   · a read-only support session (impersonation) — a superadmin looking at a
//     customer's account must see what is there, never be walked into that
//     customer's questions (non-negotiable #2);
//   · anybody who is not the OWNER — an invited estimator did not sign up and
//     has nothing to answer;
//   · every company created before this flow — Company.onboardingStep is NULL
//     on all of them, and null means "not on this flow", never "step one";
//   · a company whose questions are finished (personalizedAt set).
//
// Pure, so scripts/check-welcome-flow.mjs runs the matrix. /welcome is not
// under /app, so a redirect from here can never loop back into this layout.

import { WELCOME_STEPS, welcomePath } from "@/lib/signup/welcome";

/**
 * @param impersonating   member.impersonation
 * @param role            member.role
 * @param onboardingStep  Company.onboardingStep
 * @param personalizedAt  Company.personalizedAt
 * @returns {{ action: "allow"|"redirect", reason: string, path?: string }}
 */
export function welcomeGateDecision({
  impersonating = false,
  role = null,
  onboardingStep = null,
  personalizedAt = null,
} = {}) {
  if (impersonating) return { action: "allow", reason: "impersonation" };
  if (role !== "owner") return { action: "allow", reason: "not_owner" };
  if (!onboardingStep) return { action: "allow", reason: "not_on_welcome_flow" };
  if (personalizedAt) return { action: "allow", reason: "personalized" };
  const step = WELCOME_STEPS.includes(onboardingStep) ? onboardingStep : WELCOME_STEPS[0];
  return { action: "redirect", reason: "welcome_unfinished", path: welcomePath(step) };
}
