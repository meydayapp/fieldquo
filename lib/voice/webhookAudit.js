// lib/voice/webhookAudit.js
//
// Where Retell posts call events, and what to do when it is posting nowhere.
//
// ══ The symptom, and why nothing could act on it ═══════════════════════════
//
// The platform panel reports calls "billed by the hourly reconciler because
// Retell's webhook never delivered them" — a real, correct warning, derived
// from VoiceCall.recoveredAt. It named the problem and offered no way to fix
// it: no button, no setting, no action. A diagnostic with no remedy is only
// half a control.
//
// ══ The cause, already documented one file over ════════════════════════════
//
// lib/voice/readiness.js's originIsStable() says it outright: provisionAgent
// derives webhook_url from the origin of whichever request triggered it, which
// is the right default — a preview deployment must wire to itself or it would
// post test calls into production. The cost is that a save made from a preview
// URL, or from a laptop, silently repoints the LIVE agent at an address that
// stops existing.
//
// The phone still answers perfectly. The events go into the void. The hourly
// reconciler picks the calls up later and bills them, which is why the money is
// right and the call list is empty.
//
// ══ Why repairing from an unstable origin is REFUSED ═══════════════════════
//
// This is the whole safety property of the file. A repair run from a
// *.vercel.app preview or from localhost would rewrite every live agent to
// point at that preview — turning a diagnostic tool into the very bug it
// exists to fix, across every tenant at once. So the audit reads from
// anywhere, and the repair refuses unless the origin it would write is one
// that can still be there next month.
//
// Pure decisions here, provider calls in the caller. Every branch below is
// reachable from a check script without a database or a network.

/** Where Retell should be posting, for a given origin. */
export function expectedWebhookUrl(origin) {
  return origin ? `${origin}/api/voice/webhook` : null;
}

/**
 * What is wrong with this agent's webhook, if anything.
 *
 * @param holds     the webhook_url the provider currently has, read back
 * @param expected  the URL it should hold
 * @returns { state, reason } — state is "ok" | "wrong" | "unknown"
 *
 * "unknown" is a real answer and deliberately not merged into "wrong": an agent
 * we could not read is not an agent we know is broken, and repairing on a failed
 * read would rewrite agents on the strength of a timeout.
 */
export function webhookVerdict(holds, expected) {
  if (!expected) return { state: "unknown", reason: "no_expected_url" };
  if (holds === undefined || holds === null) {
    // Distinguishable from a mismatch: the field was never written at all,
    // which is what an agent created before webhooks existed looks like.
    return { state: "wrong", reason: "never_set" };
  }
  if (typeof holds !== "string" || !holds) return { state: "wrong", reason: "empty" };
  return holds === expected
    ? { state: "ok", reason: "matches" }
    : { state: "wrong", reason: "points_elsewhere" };
}

/**
 * May a repair write this origin onto live agents?
 *
 * Takes originIsStable's answer rather than re-deriving it, so there is one
 * definition of "stable" in the codebase and not two that can disagree.
 */
export function mayRepair({ originStable, expected }) {
  if (!expected) return { allowed: false, reason: "no_origin" };
  if (!originStable) {
    // The refusal that matters. Named specifically so the screen can say WHY
    // rather than greying a button out silently — a disabled control with no
    // explanation is the thing this file was written to stop shipping.
    return { allowed: false, reason: "unstable_origin" };
  }
  return { allowed: true, reason: "ok" };
}

/**
 * Roll a set of per-agent verdicts into what the screen leads with.
 *
 * `unknown` is carried separately from `wrong` all the way to the top for the
 * same reason it exists at all: "we could not check six agents" and "six agents
 * are broken" are different sentences, and a panel that merges them either
 * invents an outage or hides one.
 */
export function summarise(verdicts = []) {
  const list = Array.isArray(verdicts) ? verdicts : [];
  const wrong = list.filter((v) => v?.state === "wrong").length;
  const unknown = list.filter((v) => v?.state === "unknown").length;
  const ok = list.filter((v) => v?.state === "ok").length;
  return {
    total: list.length,
    ok,
    wrong,
    unknown,
    // Nothing to repair is not the same as nothing to report — a run where
    // every agent was unreadable must not read as a clean bill of health.
    healthy: list.length > 0 && wrong === 0 && unknown === 0,
  };
}
