// lib/businessNumber/state.js
//
// Where a brought number is, in one vocabulary, whichever way it is coming
// in. PURE — no database, no Twilio — so every transition is executed by
// scripts/check-bring-your-number.mjs rather than reasoned about.
//
// ══ One vocabulary for two provider dialects ═══════════════════════════════
//
// Hosted SMS reports `twilio-processing → received → pending-verification →
// verified → pending-loa → carrier-processing → testing → completed`. A US
// port-in reports "In review", "Waiting for Signature", "In progress",
// "Completed". A Canadian port has no API status at all — FieldQuo files it
// through Twilio's porting form and records what it did (PortFiling). The
// company's screen should not have to know any of that, so each is mapped
// here onto ten words, and the provider's own word is kept beside ours on
// the row (providerStatus) for a support conversation to quote.
//
// ══ `active` is ours, never the provider's ══════════════════════════════════
//
// Twilio saying `completed` means the number is in the account. It does not
// mean texts arrive here: the number's webhooks have to point at FieldQuo and
// Company.smsFromNumber has to name it, or inbound texts resolve to nobody.
// So no mapping below ever returns `active`. They return `completed: true`,
// and only lib/businessNumber/store.js's activate() — which does the wiring
// and then writes `active` — can make the screen say it is live. A status
// that said live before the wiring was done is the "Send button that emailed
// nobody" in this feature's shape.

/** Every status a BroughtNumber can hold. */
export const STATUSES = Object.freeze([
  "draft", // classified, nothing sent anywhere
  "submitted", // with Twilio, being checked
  "awaiting_filing", // a Canadian port: with FieldQuo, to be filed on Twilio's form
  "pending_verification", // hosted: the ownership call is next / in progress
  "awaiting_signature", // the authorization (LOA) email is out
  "carrier_processing", // the carrier is doing its part
  "action_required", // stopped, and the company has to fix something
  "active", // wired and live
  "failed",
  "cancelled",
]);

export const TERMINAL = Object.freeze(["active", "failed", "cancelled"]);

/** Statuses during which a number is "being brought in" and may not be claimed by anyone else. */
export const IN_FLIGHT = Object.freeze(
  STATUSES.filter((s) => !["draft", "failed", "cancelled"].includes(s)),
);

export const isTerminal = (status) => TERMINAL.includes(status);

/**
 * May a row move from `from` to `to`? PURE.
 *
 * Three rules:
 *   - Nothing leaves a terminal state by sync. A late provider read that says
 *     "In progress" after we went active must not un-live a number.
 *     `restart` (explicit, by the company) is the only way back to draft,
 *     and only from failed or cancelled.
 *   - Nothing reaches `active` except through activation (`via: "activate"`).
 *   - Cancelling is allowed from anywhere not terminal.
 */
export function canTransition(from, to, { via = "sync" } = {}) {
  if (!STATUSES.includes(to)) return false;
  if (from === to) return true;
  if (via === "restart") return ["failed", "cancelled", "draft"].includes(from) && to === "draft";
  if (isTerminal(from)) return false;
  if (to === "active") return via === "activate";
  if (to === "cancelled") return via === "cancel";
  return true;
}

// ── Hosted SMS ──────────────────────────────────────────────────────────────

/**
 * Twilio HostedNumberOrder.status → ours. PURE.
 *
 * @returns {{ status, completed, callPlaced, reason }}
 */
export function mapHostedStatus(providerStatus, failureReason = null) {
  const s = String(providerStatus || "").trim().toLowerCase();
  const reason = failureReason ? String(failureReason).slice(0, 500) : null;
  switch (s) {
    case "twilio-processing":
      return { status: "submitted", completed: false, callPlaced: false, reason: null };
    case "received":
      // Eligible. The ownership call is the company's to start — it rings the
      // number itself, and somebody has to be standing next to it.
      return { status: "pending_verification", completed: false, callPlaced: false, reason: null };
    case "pending-verification":
      return { status: "pending_verification", completed: false, callPlaced: true, reason: null };
    case "verified":
    case "pending-loa":
      return { status: "awaiting_signature", completed: false, callPlaced: false, reason: null };
    case "carrier-processing":
    case "testing":
      return { status: "carrier_processing", completed: false, callPlaced: false, reason: null };
    case "completed":
      return { status: "carrier_processing", completed: true, callPlaced: false, reason: null };
    case "action-required":
      return { status: "action_required", completed: false, callPlaced: false, reason: reason || "The carrier needs something fixed before this can continue." };
    case "failed":
      return { status: "failed", completed: false, callPlaced: false, reason: reason || "Texting couldn't be moved for this number." };
    default:
      // A status this version doesn't know. Not guessed into a state: the row
      // keeps whatever it had, and the provider's word is still shown.
      return { status: null, completed: false, callPlaced: false, reason: null };
  }
}

/**
 * Is this the "already text-enabled somewhere else" refusal? PURE.
 *
 * Twilio's eligibility step fails a number "currently SMS enabled" with its
 * current provider. It is the most likely failure for a business landline
 * (a texting app, an old VoIP add-on), and the one the company CAN fix, so it
 * gets its own sentence with what to do rather than the provider's wording.
 */
export function alreadyTextEnabled(reason) {
  const r = String(reason || "");
  return /(sms|messaging|text)[\s-]*enabled|already.{0,40}(sms|messag|text)/i.test(r);
}

export const ALREADY_TEXT_ENABLED_ADVICE =
  "This number can already send and receive texts through another company — a texting app, your phone provider's business-texting add-on, or a previous software tool. " +
  "Texting can only be moved here for a number that isn't text-enabled anywhere else. Ask whoever provides that texting to remove (\"de-provision\") SMS from the number, " +
  "wait for them to confirm, then start again here. Your calls are not affected either way.";

// ── Porting ─────────────────────────────────────────────────────────────────

/**
 * Twilio port-in request status → ours. PURE.
 *
 * Twilio's strings are title-cased sentences ("Waiting for Signature"); they
 * are compared case-insensitively and with any separator, so a provider
 * cosmetics change ("waiting_for_signature") still maps.
 */
export function mapPortStatus(providerStatus, cancellationReason = null) {
  const s = String(providerStatus || "").trim().toLowerCase().replace(/[\s_-]+/g, " ");
  const reason = cancellationReason ? String(cancellationReason).slice(0, 500) : null;
  switch (s) {
    case "in review":
      return { status: "submitted", completed: false, reason: null };
    case "waiting for signature":
      return { status: "awaiting_signature", completed: false, reason: null };
    case "in progress":
      return { status: "carrier_processing", completed: false, reason: null };
    case "action required":
      return { status: "action_required", completed: false, reason: reason || "The carrier needs a detail corrected." };
    case "completed":
      return { status: "carrier_processing", completed: true, reason: null };
    case "expired":
      return { status: "failed", completed: false, reason: reason || "The request expired before it was completed." };
    case "canceled":
    case "cancelled":
      return { status: "failed", completed: false, reason: reason || "The port was cancelled." };
    default:
      return { status: null, completed: false, reason: null };
  }
}

/**
 * A Canadian port's status, from FieldQuo's own filing log. PURE.
 *
 * @param filings  PortFiling rows, any order
 * @param landed   whether the number is now in FieldQuo's Twilio account —
 *                 the one fact that ends the wait, read from Twilio, not
 *                 from a person's note
 */
export function mapCanadianFiling(filings = [], { landed = false } = {}) {
  if (landed) return { status: "carrier_processing", completed: true, reason: null, portDate: null };
  const sorted = (Array.isArray(filings) ? filings : [])
    .filter((f) => f && ["filed", "rejected", "confirmed"].includes(f.action))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const last = sorted[sorted.length - 1];
  if (!last) return { status: "awaiting_filing", completed: false, reason: null, portDate: null };
  if (last.action === "rejected") {
    return { status: "action_required", completed: false, reason: last.note || "The carrier rejected the request.", portDate: null };
  }
  const confirmed = [...sorted].reverse().find((f) => f.action === "confirmed" && f.portDate);
  return { status: "carrier_processing", completed: false, reason: null, portDate: confirmed?.portDate || null };
}

/**
 * Should the port secrets (account number, PIN, bill) be gone by now?
 *
 * Kept while the request may still need them — a carrier rejection on a
 * mistyped PIN is fixed by resubmitting, and for a Canadian port FieldQuo
 * staff have to read them to file the form. Gone the moment nothing can
 * use them again.
 */
export function secretsShouldBePurged(status) {
  return isTerminal(status);
}

/**
 * What the company should do next — a key for the screen, never a sentence
 * (the screen owns the words, in nine languages). PURE.
 */
export function nextStepFor(row = {}) {
  const status = row.status;
  if (status === "draft") return "fill_form";
  if (status === "active") return (row.forwardTo || []).length || row.path === "hosted_sms" ? "none" : "set_forwarding";
  if (status === "failed") return "restart";
  if (status === "cancelled") return "restart";
  if (status === "action_required") return "fix_and_resubmit";
  if (row.path === "hosted_sms") {
    if (status === "pending_verification") return row.callPlaced ? "answer_call" : "start_call";
    if (status === "awaiting_signature") return "sign_email";
    return "wait";
  }
  // Port.
  if (status === "awaiting_signature") return "sign_email";
  if (status === "awaiting_filing") return "wait_fieldquo";
  if (status === "carrier_processing") return row.lineType === "mobile" ? "approve_carrier_text" : "wait";
  return "wait";
}

/** Working-day expectations, said before anyone starts. */
export const TIMELINES = Object.freeze({
  hosted_sms: { minDays: 1, maxDays: 3, note: "Landlines up to 1 business day after signing; toll-free 2–3." },
  port: { minDays: 5, maxDays: 7, worstDays: 28, note: "5–7 working days once filed; up to 4 weeks if the carrier pushes back." },
});

/** A rough "expected by", in calendar days from now, for the tracker. PURE. */
export function expectedBy(path, from = new Date()) {
  const t = TIMELINES[path];
  if (!t) return null;
  // Working days → calendar days: every five working days carry a weekend.
  const working = t.maxDays;
  const calendar = working + Math.floor(working / 5) * 2;
  return new Date(new Date(from).getTime() + calendar * 24 * 60 * 60 * 1000);
}
