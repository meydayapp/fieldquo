// lib/platform/callBack.js
//
// "Needs call back" on /platform/companies (the owner's decision,
// 2026-09-29): a company whose owner stopped part-way — in the welcome
// questions after "Start my free trial", or in the onboarding checklist after
// them — is somebody FieldQuo should ring. The flag names where they stopped
// and carries the owner's own number, so the person making the call knows
// what to help with before dialling.
//
// Pure, so scripts/check-welcome-flow.mjs runs the matrix. The two inputs are
// read by the callers from what already decides each state — never a second
// rule:
//
//   · the welcome questions: Company.onboardingStep while personalizedAt is
//     null (lib/signup/welcomeGate.js reads the same pair);
//   · the onboarding checklist: lib/onboarding.js getOnboardingStatus —
//     `complete` and the first step not done — asked only for companies that
//     have not stamped onboardingCompletedAt, read-only.
//
// A demo company never needs a call; a company FieldQuo has ended
// (platformEndsAt) is a different conversation, not a call-back.

/** The screen a welcome step names, for the badge. */
export const WELCOME_STEP_LABELS = Object.freeze({
  profile: "About you",
  business: "Business details",
  size: "Team & years",
  revenue: "Revenue",
  priority: "Priority",
  focus: "Focus",
  source: "How they heard",
  setup: "Setup screen",
});

/**
 * @param company     { isDemo, platformEndsAt, onboardingStep, personalizedAt,
 *                      onboardingCompletedAt }
 * @param onboarding  getOnboardingStatus()'s { complete, steps } or null when
 *                    it was not asked (a company whose checklist is stamped
 *                    complete) or could not be read
 * @param ownerPhone  the owner's own number (User.phone), or null
 * @returns null, or { kind: "welcome"|"setup", step, label, phone }
 */
export function callBackFor({ company, onboarding = null, ownerPhone = null } = {}) {
  const c = company && typeof company === "object" ? company : null;
  if (!c || c.isDemo || c.platformEndsAt) return null;
  const phone = typeof ownerPhone === "string" && ownerPhone.trim() ? ownerPhone.trim() : null;
  if (c.onboardingStep && !c.personalizedAt) {
    return { kind: "welcome", step: c.onboardingStep, label: WELCOME_STEP_LABELS[c.onboardingStep] || c.onboardingStep, phone };
  }
  if (c.onboardingCompletedAt) return null;
  if (!onboarding || onboarding.complete) return null;
  const open = (Array.isArray(onboarding.steps) ? onboarding.steps : []).find((s) => s && !s.done);
  if (!open) return null;
  return { kind: "setup", step: open.key, label: open.label || open.key, phone };
}

/** Whether the checklist needs asking at all for this company. */
export function needsChecklistRead(company) {
  return Boolean(company && !company.isDemo && !company.platformEndsAt && !(company.onboardingStep && !company.personalizedAt) && !company.onboardingCompletedAt);
}
