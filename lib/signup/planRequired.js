// lib/signup/planRequired.js
//
// The browser half of lib/signup/planGate.js.
//
// A refused send is a 402 carrying `planRequired`. The owner asked for "maybe
// prompting them to complete it", so that body must not land in an error toast
// and die there — it names a reason and a path, and the screen has to offer the
// path.
//
// Same shape as lib/clientErrors.js and for the same reason its header gives:
// one listener mounted once in the app shell (app/components/PlanRequiredPrompt.js),
// so a call site needs one line and no markup. Nine screens can send something;
// nine copies of a modal is the duplication AGENTS.md names, and the copy that
// rots is the one guarding the screen nobody looks at.
//
// No imports on purpose: this is reached from client components AND from
// lib/clientErrors.js, which everything imports.

export const PLAN_REQUIRED_EVENT = "fieldquo:plan-required";

/**
 * The `planRequired` payload of a refusal, or null.
 *
 * Both halves are demanded — the 402 AND the field. A 402 alone is also the
 * BILLING gate's status (a card that failed, a lapsed plan), which is a
 * different state with a different screen; reading this off the status would
 * put the wrong prompt in front of a customer who has paid for two years.
 */
export function planRequiredPayload(status, data) {
  if (status !== 402) return null;
  const payload = data?.planRequired;
  if (!payload || typeof payload !== "object") return null;
  return { ...payload, message: data?.error || null };
}

/** Opens the prompt. Safe to call from anywhere client-side. */
export function showPlanRequired(payload) {
  if (typeof window === "undefined" || !payload) return;
  window.dispatchEvent(
    new CustomEvent(PLAN_REQUIRED_EVENT, { detail: payload }),
  );
}

/**
 * One line at a send call site:
 *
 *   if (planRequiredFrom(res.status, data)) return;
 *
 * @returns true when this was the plan gate and the prompt has been opened, so
 *          the caller stops rather than also reporting it as an error. Anything
 *          else is false and the caller's normal error path runs untouched.
 */
export function planRequiredFrom(status, data) {
  const payload = planRequiredPayload(status, data);
  if (!payload) return false;
  showPlanRequired(payload);
  return true;
}
