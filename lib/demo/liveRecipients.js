// lib/demo/liveRecipients.js
//
// The numbers and the matching rules behind "a demo may send for real to a
// client somebody created live in the demo". Pure — no database, no vendor —
// so the rep's panel, the cost page and scripts/check-demo-live-recipients.mjs
// can all read the same figures, and so the gate in lib/demo/simulatedSpend.js
// (demoSendVerdict) stays the ONE place that decides.
//
// ══ What the owner asked for, and the one line it must not cross ═══════════
//
// "Can the demo accounts send actual emails and have the text messages sent
// when someone books, so that it can be shown to a client?" — then, narrowed:
// "Not the info that's already there, but if we need to create a new quote or
// create a client." So a demo sends for real only to an address a PERSON typed
// during the demo, onto a record created then. Everything that came from the
// seed or a re-dress stays simulated, even after a rep edits it: a seeded
// client with a stranger's address typed onto it is still a seeded client.
// A blanket "demos send for real" would message whoever a fixture's plausible
// address belongs to (lib/sms/demoSms.js's header is the reason).

/**
 * How long a live-created record keeps sending for real. A walkthrough is an
 * hour; 24 hours also covers the next-morning reminder the prospect was
 * promised on the call, and nothing longer — the demo is re-dressed or reset
 * for the next prospect, and that ends it anyway (the rows are wiped, or the
 * rep demo is retired).
 */
export const LIVE_WINDOW_HOURS = 24;

/**
 * Real sends per demo company per rolling 24 hours, per channel. FieldQuo pays
 * for every one, and a cap is what turns "a rep left a marketing campaign
 * running on a demo" from a bill into a log line. Past it, the send is
 * simulated exactly as before and the rep is told why.
 */
export const LIVE_DAILY_CAP = Object.freeze({ email: 30, sms: 20 });

/** The ActivityLog verb a real demo send is recorded under — audit, cap and cost all count these. */
export const LIVE_ACTION = Object.freeze({ email: "email.demo_live", sms: "sms.demo_live" });

/**
 * List-price estimates, for the cost page and the report — never billed from.
 * Twilio US/CA outbound SMS is $0.0083 a segment plus carrier pass-through
 * fees (roughly $0.003–0.005), so ~1.3¢ a one-segment text; Resend's plan
 * prices an email at well under a tenth of a cent and the monthly plan
 * already covers it.
 */
export const LIVE_COST_ESTIMATE_CENTS = Object.freeze({ email: 0.04, sms: 1.3 });

/** Why a demo send was simulated, in words a rep can act on. */
export const SIMULATED_REASON_TEXT = Object.freeze({
  not_live: "the recipient isn't a client somebody created live in this demo",
  expired: `that client was created live more than ${LIVE_WINDOW_HOURS} hours ago`,
  retired: "this demo has been reset (retired), so nothing on it sends for real",
  cap: "this demo has used today's real sends",
  opted_out: "that number replied STOP",
  no_sms_number: "FieldQuo has no texting number to send from",
  us_unregistered: "texts to US phones need FieldQuo's A2P 10DLC registration, which isn't verified",
  no_recipient: "there was no recipient to check",
});

/** Lower-cased, trimmed email — the same key cleanEmail() stores clients under. */
export function normaliseEmail(value) {
  const s = String(value ?? "").trim().toLowerCase();
  return s.includes("@") ? s : null;
}

/**
 * The ten national digits of a North American number, however it was typed,
 * or null. Phones on Client rows are stored as the person typed them
 * ("819-238-7263"), sends arrive as E.164 — this is the one comparable form.
 * Deliberately local rather than imported from lib/sms: that module imports
 * the gate, and the gate importing it back would be a cycle.
 */
export function nanpDigits(value) {
  const d = String(value ?? "").replace(/\D/g, "");
  if (d.length === 10) return d;
  if (d.length === 11 && d.startsWith("1")) return d.slice(1);
  return null;
}

/** Every recipient of a send as a flat list (Resend takes a string or an array). */
export function recipientList(to) {
  return (Array.isArray(to) ? to : [to]).map((x) => String(x ?? "").trim()).filter(Boolean);
}

/**
 * Pure half of the verdict: given the recipients and the demo's live-created
 * records, which recipients are live and which are not.
 *
 * @param channel   "email" | "sms"
 * @param to        string | string[]
 * @param records   [{ email, phone, demoLiveAt }] — live-created clients and leads
 * @param now       Date
 * @returns {{ live: boolean, reason?: "not_live"|"expired"|"no_recipient" }}
 *
 * EVERY recipient must be live. A send with one live and one seeded address
 * is simulated whole — there is no partial send, and splitting it would mean
 * the seeded address's copy goes nowhere while the route reports "sent".
 */
export function matchLiveRecipients({ channel, to, records = [], now = new Date() }) {
  const keyOf = channel === "sms" ? nanpDigits : normaliseEmail;
  const wanted = recipientList(to).map(keyOf);
  if (wanted.length === 0) return { live: false, reason: "no_recipient" };
  if (wanted.some((k) => !k)) return { live: false, reason: "not_live" };

  const since = now.getTime() - LIVE_WINDOW_HOURS * 3600 * 1000;
  let sawExpired = false;
  for (const key of wanted) {
    const hits = records.filter((r) => r?.demoLiveAt && keyOf(channel === "sms" ? r.phone : r.email) === key);
    if (hits.length === 0) return { live: false, reason: "not_live" };
    const fresh = hits.some((r) => new Date(r.demoLiveAt).getTime() >= since && new Date(r.demoLiveAt).getTime() <= now.getTime() + 60_000);
    if (!fresh) sawExpired = true;
  }
  return sawExpired ? { live: false, reason: "expired" } : { live: true };
}

/**
 * Which sentence the send banner adds after "Sent to <address>." for a demo,
 * from what the send route reported — or null for a real company's send.
 *
 * The route answers `simulated` (and why) or `demoLive`; everything else in
 * its response is identical to a real send by design, so this is the only
 * thing standing between the rep and a green banner that lies in either
 * direction: "sent" over a letter that never left, or "nothing was sent"
 * over one that is in the prospect's inbox right now.
 */
export function demoSendNoteKey(data) {
  if (data?.demoLive === true) return "app.demo.sentLive";
  if (data?.simulated !== true) return null;
  if (data.simulatedReason === "cap") return "app.demo.notEmailedCap";
  if (data.simulatedReason === "not_live" || data.simulatedReason === "expired") return "app.demo.notEmailedNotLive";
  return "app.demo.notEmailed";
}
