// lib/crew/sharedLineAdvice.js
//
// What to do about TWILIO_PHONE_NUMBER, decided from what is actually there.
//
// ══ The question ═══════════════════════════════════════════════════════════
//
// /platform/crew-lines reports that TWILIO_PHONE_NUMBER names +17372212163 and
// that this Twilio account does not hold an SMS-capable number at that address.
// True, and the owner's reply was that he has no idea what to do with it. Three
// things are possible — buy that number, point the variable at one the account
// does hold, or unset it — and the screen picked none.
//
// ══ What the variable actually does, since nothing said ════════════════════
//
// Two jobs, neither of them obvious from its name, and both are FALLBACKS:
//
//   1. lib/sms/systemNumber.js — the outbound "From" when FieldQuo has bought
//      no `system` number. A bought row wins; the variable answers only when
//      there is no row.
//   2. lib/crew/platformNumber.js's sharedTestLine() — the number lent to one
//      company at a time so a contractor can prove the crew inbox works. Again
//      a bought `shared_test` row wins, and only since this change: until now
//      the variable was the ONLY thing consulted, so a number bought through
//      the console's own purchase panel with purpose "shared test line" was
//      written and read by nothing.
//
// ══ Why naming a number you do not own is worse than naming none ═══════════
//
// Unset, `sendSms` throws "No SMS 'from' number" — loud, in a log, at the send.
// Set to a number the account has never held, Twilio rejects the message with
// error 21606 and `sendSms` returns `{ success: false }`, which several callers
// swallow because an SMS failure must not fail the request that also marked a
// job complete. So the wrong value converts a loud, obvious misconfiguration
// into a quiet one. That is the argument that settles the three options.
//
// Pure. Takes what the route found, returns what to say. Executed against every
// combination by scripts/check-platform-diagnostics.mjs, because advice about
// money and carriers is exactly the kind of thing that should not first be
// exercised by a person opening a page.

/**
 * @param envValue    TWILIO_PHONE_NUMBER, or null/"" when unset
 * @param envHeld     does this Twilio account hold an SMS-capable number at
 *                    that address? Asked of Twilio, never assumed — `null`
 *                    means we could not ask, which is not "no".
 * @param boughtSharedTest  e164 of an active PlatformSmsNumber with purpose
 *                    "shared_test", or null
 * @param boughtSystem      the same for purpose "system", or null
 * @param heldCount   how many SMS-capable numbers the account holds
 *
 * @returns null when there is nothing worth saying, else
 *          { state, tone, headline, why, action }
 */
export function sharedLineAdvice({
  envValue = null,
  envHeld = null,
  boughtSharedTest = null,
  boughtSystem = null,
  heldCount = 0,
} = {}) {
  const env = typeof envValue === "string" && envValue.trim() ? envValue.trim() : null;

  // ── We could not ask ─────────────────────────────────────────────────────
  //
  // First, and it returns its own state rather than falling through: every
  // branch below turns on whether the account holds the number, and answering
  // that from an unread provider would be the invented-fact failure this whole
  // page is about. Absence of a statement is not a statement.
  if (env && envHeld === null) {
    return {
      state: "unknown",
      tone: "note",
      headline: `Whether this account holds ${env} was not established.`,
      why:
        "Twilio was not asked, or did not answer, so nothing is claimed about the number TWILIO_PHONE_NUMBER names.",
      action: "Press Refresh once the number list above has loaded, and this will say something useful.",
    };
  }

  if (!env) {
    if (boughtSharedTest) return null; // Bought, lent, nothing to say.
    return {
      state: "nothing_to_lend",
      tone: "note",
      headline: "There is no shared test line, and nothing pretends there is.",
      why:
        "TWILIO_PHONE_NUMBER is unset and no number has been bought with the “shared test line” purpose, so a contractor pressing “turn on crew texting” is correctly told FieldQuo has no number to give them.",
      action:
        heldCount > 0
          ? "Buy one above as a shared test line, or leave it — this is an honest state, not a fault."
          : "Buy one above as a shared test line when you want contractors to be able to try the crew inbox.",
    };
  }

  if (envHeld === true) return null; // It names a number we hold. Working as intended.

  // ── The variable names a number this account does not hold ───────────────
  const supersededBy = [
    boughtSharedTest ? `the shared test line (${boughtSharedTest})` : null,
    boughtSystem ? `the outbound From (${boughtSystem})` : null,
  ].filter(Boolean);

  if (supersededBy.length === 2) {
    return {
      state: "env_superseded",
      tone: "note",
      headline: `TWILIO_PHONE_NUMBER names ${env}, which this account does not hold — and nothing reads it any more.`,
      why: `Both of its jobs are now done by numbers FieldQuo actually bought: ${supersededBy.join(
        " and ",
      )}. A bought row wins over a configured one in both places, so the value is dead weight.`,
      action:
        "Unset TWILIO_PHONE_NUMBER in Vercel and redeploy. Nothing changes when you do, which is the point — it can only start mattering again the day one of those numbers is released.",
    };
  }

  return {
    state: supersededBy.length === 1 ? "env_partly_live" : "env_phantom",
    tone: "warn",
    headline: `TWILIO_PHONE_NUMBER names ${env}, and this Twilio account holds no SMS-capable number at that address.`,
    why:
      `Naming a number is not owning it. ${
        supersededBy.length === 1
          ? `${supersededBy[0]} has been bought and supersedes it there, but not everywhere.`
          : "Nothing has been bought to supersede it."
      } Where it is still the fallback, a text sent through it is rejected by Twilio with error 21606 and the send returns a quiet failure — several callers swallow that deliberately, so a job still gets marked complete and nobody is told the text never went. Unset, the same send throws “No SMS 'from' number” instead, which is loud and findable.`,
    action:
      "Unset TWILIO_PHONE_NUMBER in Vercel and redeploy, and buy what each feature needs from the panel above — “System” for the outbound From, “Shared test line” to lend. Pointing the variable at one of the numbers listed below also works and is one step rather than two, but it leaves the same trap set for the next person who changes it.",
  };
}
