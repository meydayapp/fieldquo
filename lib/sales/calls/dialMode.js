// lib/sales/calls/dialMode.js
//
// How a call gets placed — and the switch that keeps every automated answer
// off until somebody deliberately turns it on.
//
// ══ What ships on, and what ships off ══════════════════════════════════════
//
// ON:  preview. A human reads the card, decides, and presses the button. One
//      call, one press. This is what FieldQuo does today and it is not a
//      limitation to be worked around — it is a property worth keeping, and
//      the check script's permanent negative control (no sales path reaches
//      lib/voice/outboundCall.js) is what proves it is still true.
//
// OFF: progressive and predictive. Both are designed here, both are named,
//      neither can run. The gate below refuses them regardless of the
//      environment variable until `SALES_AUTOMATED_DIAL_ENABLED` is set
//      explicitly — two switches, not one, so a stray value in a deployment
//      config cannot start automated dialling by itself.
//
// ══ Why they are off, stated accurately ═══════════════════════════════════
//
// The position is PENDING, not impossible. The owner is taking the telecom-law
// question himself and these are human reps on real phones. What the automated
// modes change is who originates the call: a server placing it on a schedule is
// a different question from a person tapping a number, and it is the question
// worth having answered before it runs rather than after. So this file makes
// enabling them a config decision instead of a rebuild, and refuses until then.
//
// The three things that do NOT change with the mode, and are enforced
// elsewhere regardless, are worth naming here because a dial mode is where
// somebody would look for them: the calling-window gate
// (lib/sales/callingRules.js), the do-not-call list (lib/sales/suppression.js)
// and the per-24h caps. An automated mode that skipped any of them would be a
// bug in the automation, not a property of it.
//
// ══ This module reaches no telephony vendor, on purpose ═══════════════════
//
// It imports nothing from lib/voice/ and must not. It answers one question —
// "which mode is this deployment in" — and the answer is a string.
// scripts/check-sales-call-handling.mjs asserts the import graph from here
// contains no vendor client, alongside the existing control in
// scripts/check-sales-calling-window.mjs.

export const MODE_PREVIEW = "preview";
export const MODE_PROGRESSIVE = "progressive";
export const MODE_PREDICTIVE = "predictive";

/**
 * The modes, what each means in FieldQuo's own terms, and whether it can run.
 *
 * `automated` is the property the gate keys on — not the mode name — so a
 * fourth mode added later is refused by default rather than by having been
 * remembered.
 */
export const DIAL_MODES = Object.freeze({
  [MODE_PREVIEW]: {
    code: MODE_PREVIEW,
    label: "Preview",
    automated: false,
    summary:
      "The rep reads the prospect card, then presses call. Nothing dials on its own and nothing is queued behind it.",
  },
  [MODE_PROGRESSIVE]: {
    code: MODE_PROGRESSIVE,
    label: "Progressive",
    automated: true,
    summary:
      "One call is placed automatically as soon as a rep becomes available. There is no over-dialling and nobody is dropped, but the server originates the call rather than the rep.",
  },
  [MODE_PREDICTIVE]: {
    code: MODE_PREDICTIVE,
    label: "Predictive",
    automated: true,
    summary:
      "More calls are placed than there are free reps, on a forecast of how many will be answered. Some answered calls reach nobody, which is the whole reason the mode is faster and the whole reason it is the most heavily regulated.",
  },
});

export const DIAL_MODE_ORDER = Object.freeze([MODE_PREVIEW, MODE_PROGRESSIVE, MODE_PREDICTIVE]);

/** The two variables. Named as literals so check:env-docs can see them. */
export const DIAL_MODE_ENV = "SALES_DIAL_MODE";
export const AUTOMATED_DIAL_ENV = "SALES_AUTOMATED_DIAL_ENABLED";

/**
 * Is the automated-dial master switch on?
 *
 * Exactly the string "true". Not truthiness, not "1", not "yes": a variable
 * that turns on server-originated calling should require somebody to have
 * typed the word, and every near-miss should read as off.
 */
export function automatedDialEnabled(env = readDialEnv()) {
  return String(env?.SALES_AUTOMATED_DIAL_ENABLED ?? "") === "true";
}

/**
 * The two variables, read literally.
 *
 * Written as `process.env.NAME` rather than through a computed lookup for the
 * reason lib/platform/salesCall.js records for FIELDQUO_SALES_NUMBER:
 * scripts/check-env-docs.mjs scans for exactly that shape, and a dynamic read
 * drops the variable out of the deployment checklist the owner works from —
 * which is precisely the document that must not go stale.
 *
 * Every function below takes the result as an argument so the check script can
 * walk every combination without touching the real environment.
 */
export function readDialEnv() {
  return {
    SALES_DIAL_MODE: process.env.SALES_DIAL_MODE,
    SALES_AUTOMATED_DIAL_ENABLED: process.env.SALES_AUTOMATED_DIAL_ENABLED,
  };
}

/**
 * Which mode this deployment is actually in, and why it is not the one that
 * was asked for.
 *
 * Total. Fails to preview for every unreadable input, and says so — an unknown
 * mode is not an error to throw at a rep holding a phone, it is a deployment
 * that has to keep working the way it worked yesterday.
 *
 * @returns {{mode:string, requested:string|null, automated:boolean,
 *            refused:boolean, reason:string|null}}
 */
export function dialModeState(env = readDialEnv()) {
  const raw = String(env?.SALES_DIAL_MODE ?? "").trim().toLowerCase();
  const requested = raw || null;

  if (!requested || requested === MODE_PREVIEW) {
    return { mode: MODE_PREVIEW, requested, automated: false, refused: false, reason: null };
  }

  const wanted = DIAL_MODES[requested];
  if (!wanted) {
    return {
      mode: MODE_PREVIEW,
      requested,
      automated: false,
      refused: true,
      reason: `${DIAL_MODE_ENV} is set to "${requested}", which is not a mode this build has. Preview is in use.`,
    };
  }

  if (wanted.automated && !automatedDialEnabled(env)) {
    return {
      mode: MODE_PREVIEW,
      requested,
      automated: false,
      refused: true,
      reason:
        `${wanted.label} dialling is built but switched off. It places calls without a rep pressing ` +
        `anything, and the decision to allow that is the owner's and is pending. Set ` +
        `${AUTOMATED_DIAL_ENV}=true to enable it deliberately; until then preview is in use.`,
    };
  }

  return {
    mode: wanted.code,
    requested,
    automated: wanted.automated,
    refused: false,
    reason: null,
  };
}

/**
 * May this deployment place a call without a rep pressing anything?
 *
 * The single question every future automated path must ask, so there is one
 * place to read and one place to revoke. It exists now, with no caller, and
 * that is deliberate: a gate written after the thing it gates is a gate
 * somebody has to remember to add.
 */
export function canDialAutomatically(env = readDialEnv()) {
  return dialModeState(env).automated === true;
}
