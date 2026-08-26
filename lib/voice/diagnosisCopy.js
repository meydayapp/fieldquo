// lib/voice/diagnosisCopy.js
//
// What the settings screen SAYS about each number verdict.
//
// Split out of the page for one reason: it is the half that can be wrong
// silently. lib/voice/diagnose.js decides the truth; this decides the sentence,
// and a verdict with no sentence renders an empty banner while a verdict with
// the WRONG sentence tells a contractor they are being billed for a phone that
// does not exist. Neither is visible in a screenshot of the happy path, so both
// are asserted in scripts/check-voice-knowledge.mjs — which needs to import the
// table, and cannot import a client component full of JSX and icons.
//
// Pure data. No React, no database, no i18n machinery: the strings here are the
// per-key English FALLBACK, and app/i18n/appMessages.js carries the real
// catalogue under `app.setVoice.diag.<verdict>`.

/**
 * Which verdicts put a banner on screen, and how alarmed it should look.
 *
 * Four of the eleven verdicts are deliberately absent:
 *
 *   ok / no_number   nothing to say; the rest of the card already says it.
 *   porting          not a fault. The port card owns that state, and it
 *                    already prints the expected date.
 *   not_configured   the banner at the top of the page says it once already,
 *                    and repeating it beside a number reads as a second,
 *                    different problem.
 *
 * "info" rather than "warn" is not a styling preference. `voice_off` and
 * `no_credit` are the system doing exactly what the company told it to do —
 * amber there is telling somebody their own decision is broken. And
 * `provider_unreachable` claims nothing at all, because we did not look
 * successfully; absence of a reply is not a reply.
 */
export const DIAGNOSIS_TONE = {
  ghost: "warn",
  no_agent: "warn",
  unbound: "warn",
  status_stale: "warn",
  voice_off: "info",
  no_credit: "info",
  provider_unreachable: "info",
};

/** One sentence per verdict. A shared "something went wrong" is useless to
 *  somebody deciding whether to buy a second number — which is the decision
 *  this banner exists to inform, and the wrong answer costs them a rental. */
export const DIAGNOSIS_TEXT = {
  ghost:
    "This number was never actually created at our phone provider — the purchase stopped halfway through. Clearing it out here frees you to set one up properly.",
  no_agent:
    "Your number is real and it's yours, but the receptionist that should answer on it was never built, so callers reach nothing.",
  unbound:
    "Your number is real and the receptionist exists, but the two were never connected, so nothing answers when someone calls.",
  status_stale:
    "Your number is working and answering. Our own record of it was left behind, which is why this page has been telling you otherwise.",
  voice_off:
    "Nothing is answering because the receptionist is switched off. That's how you left it — turn it on below whenever you're ready.",
  no_credit:
    "Nothing is answering because the credit ran out. Top up above and it starts picking up again.",
  provider_unreachable:
    "We couldn't reach the phone provider just now, so we can't tell you anything about this number without guessing. Try again in a moment.",
};

/** Whose end it is, because the owner asked to be told. */
export const SIDE_TEXT = {
  fieldquo: "This one is on us, not on anything you did.",
  company: "Nothing is broken — this is your own setting doing what you asked.",
  unknown: "We can't tell yet which end this is.",
};

export const diagnosisKey = (verdict) => `app.setVoice.diag.${verdict}`;
export const sideKey = (side) => `app.setVoice.diag.side.${side}`;
