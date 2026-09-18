// lib/sales/calls/browserDial.js
//
// The call happens inside FieldQuo. A rep presses a button on a laptop, talks
// through a headset, and the prospect's phone rings showing a number FieldQuo
// owns. Twilio carries it and is never a surface anybody sees — the same
// relationship Stripe has to money here.
//
// ══ What this module is, and is not ═══════════════════════════════════════
//
// Pure. It decides three things and performs none of them:
//
//   1. whether this deployment can place a browser call at all, and what is
//      missing when it cannot;
//   2. which number to present — always one FieldQuo owns, never spoofed;
//   3. what the bridge should do, as a plain object the TwiML route renders.
//
// It reaches no vendor. The routes do that. Keeping the decisions here is what
// lets scripts/check-sales-call-handling.mjs execute every branch — no
// credentials, no TwiML app, a prospect in an area code we hold, one we do
// not — instead of reading the route and hoping.
//
// ══ The dial is STILL human-initiated, and that is structural ═════════════
//
// A rep presses call; the server then bridges two legs. Nothing places a call
// on a schedule, nothing dials ahead of a rep being free, and no recorded or
// synthesised voice is ever played to a prospect. That is what keeps
// 47 U.S.C. §227(b)(1)(A)(iii) out of scope, and it is why
// scripts/check-sales-calling-window.mjs's negative control — no sales path
// reaches lib/voice/outboundCall.js — must keep passing after this exists.
// That control is not about the file; it is about the property.
//
// ══ The window gate now guards TWO doors ══════════════════════════════════
//
// Until now the only way to place a sales call was `dialHref()`, which cannot
// return a target from a refusal or an unknown — the structural half of the
// calling-window rule. A browser dialer is a SECOND door, and a gate on one
// door is not a gate. So callPlan() below takes the readiness object and
// refuses on anything that is not `allowed`, in exactly the same shape, and
// the check script calls it with each decision and reads the answer.

import { areaCodeOf } from "@/lib/voice/numberSearch";
import { CALL_ALLOWED } from "../callingRules";

/** The TwiML Application the browser SDK's outgoing calls are routed through. */
export const TWIML_APP_ENV = "TWILIO_SALES_TWIML_APP_SID";

/**
 * How long an access token lives.
 *
 * ── Short on purpose ─────────────────────────────────────────────────────
 *
 * A Twilio access token is a CREDENTIAL: whoever holds it can place calls that
 * FieldQuo pays for, from FieldQuo's numbers, until it expires. Ten minutes is
 * long enough to cover a call already in progress and short enough that one
 * lifted from a console tab is worthless by the time anybody uses it. The
 * client asks for a new one whenever the old one is close to expiry, which is
 * a page-level concern and not a reason to lengthen this.
 */
export const TOKEN_TTL_SECONDS = 600;

/** Ask for a fresh token this long before the current one dies. */
export const TOKEN_REFRESH_MARGIN_SECONDS = 120;

/**
 * The SDK identity string for a rep.
 *
 * Prefixed and parsed rather than being the bare id, so a token minted for a
 * sales rep can never be mistaken for one minted for anything else that might
 * later share the same TwiML app. The prefix is checked on the way back in —
 * see salesRepIdFromIdentity — because the identity arrives on a webhook from
 * outside and an unprefixed id would be a caller-supplied primary key.
 */
export const IDENTITY_PREFIX = "sales_rep:";

export function repIdentity(salesRepId) {
  if (typeof salesRepId !== "string" || !salesRepId) return null;
  // Twilio identities allow a restricted character set; a cuid is safe, and
  // anything that is not is refused rather than mangled into something that
  // resolves to a different rep.
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(salesRepId)) return null;
  return `${IDENTITY_PREFIX}${salesRepId}`;
}

/**
 * The rep behind an identity, or null.
 *
 * ── Twilio adds its own prefix, and forgetting it costs every call ───────
 *
 * A call placed from the browser SDK arrives at the TwiML application with
 * `From=client:<identity>`, not the bare identity. Accepting only the bare
 * form would refuse every real bridge while passing every test written with a
 * hand-made string — a bug that is invisible until a rep presses call. So one
 * optional `client:` is stripped, and exactly one: `client:client:x` is not a
 * shape Twilio produces and is refused rather than unwrapped twice.
 */
export const CLIENT_PREFIX = "client:";

export function salesRepIdFromIdentity(identity) {
  if (typeof identity !== "string") return null;
  const bare = identity.startsWith(CLIENT_PREFIX)
    ? identity.slice(CLIENT_PREFIX.length)
    : identity;
  if (!bare.startsWith(IDENTITY_PREFIX)) return null;
  const id = bare.slice(IDENTITY_PREFIX.length);
  return /^[A-Za-z0-9_-]{1,120}$/.test(id) ? id : null;
}

/**
 * Everything that has to be true before a rep can talk through the browser,
 * as a chain of named links.
 *
 * The shape lib/voice/readiness.js already uses for the tenant receptionist,
 * and reused for the same reason /platform/sales-agent reuses it: a second
 * opinion that disagreed with the first would be worse than none. Each link is
 * `{ key, ok, title, fix }` and the first failing one is what a screen shows.
 *
 * Takes its inputs rather than reading the environment itself, so the check
 * script can walk every combination.
 */
export function browserDialReadiness({
  twilioConfigured = false,
  twimlAppSid = null,
  callerNumbers = [],
  // True when FieldQuo holds lines but every one belongs to another rep —
  // a different gap from holding none, with a different fix (assign one
  // to this rep, not buy one), and said as such.
  heldButNotMine = false,
  micPermission = null,
  origin = null,
} = {}) {
  const numbers = Array.isArray(callerNumbers) ? callerNumbers.filter(Boolean) : [];

  const links = [
    {
      key: "twilio",
      ok: Boolean(twilioConfigured),
      title: "Twilio credentials",
      fix: "TWILIO_ACCOUNT_SID plus either an API key pair or the auth token. Without them nothing can be minted and nothing can be bridged.",
    },
    {
      key: "twiml_app",
      ok: Boolean(twimlAppSid),
      title: "A TwiML Application for outgoing calls",
      fix: `${TWIML_APP_ENV} is unset. The browser SDK routes every outgoing call through a TwiML app, and a token minted without one can connect and then reach nothing.`,
    },
    {
      key: "caller_id",
      ok: numbers.length > 0,
      title: heldButNotMine ? "A number assigned to you" : "At least one number FieldQuo owns",
      fix: heldButNotMine
        ? "Every line FieldQuo holds is assigned to another rep, and a call from their line sends their callbacks to the wrong person. Ask for a line to be assigned to you on /platform/crew-lines."
        : "A call has to present a number we control — spec §25, and Twilio enforces it mechanically (error 21210). Buy one and record it before the first call.",
    },
    {
      key: "origin",
      ok: Boolean(origin),
      title: "A public origin for the bridge webhook",
      fix: "Twilio fetches the bridge TwiML over the internet. A deployment that cannot say its own URL cannot be called back.",
    },
    {
      key: "microphone",
      // Three-valued deliberately. `null` means the browser has not been asked
      // yet, which is not a failure and must not render as one — the same
      // has / gap / unknown discipline the queue screen already uses.
      ok: micPermission === null ? null : micPermission === "granted",
      title: "Microphone access",
      fix:
        micPermission === "denied"
          ? "The browser has refused the microphone for this site. Nothing can be spoken into, so the call button is switched off rather than left looking live. Re-allow it in the site settings and reload."
          : "The browser asks the first time you press call.",
    },
  ];

  const blocking = links.filter((l) => l.ok === false);
  return {
    links,
    ready: blocking.length === 0,
    blockedBy: blocking[0] || null,
    // The mic being unasked is not "ready", and is not "blocked" either.
    pending: links.some((l) => l.ok === null),
  };
}

// ── Why a number was presented. Stored on SalesCallAttempt.callerIdRule ───
/** The rep's own assigned line. */
export const CALLER_ID_RULE_ASSIGNED = "assigned";
/** A line assigned to the rep's agency — the team's number. */
export const CALLER_ID_RULE_AGENCY = "agency";
/** An unassigned line in the prospect's area code. */
export const CALLER_ID_RULE_POOL_LOCAL = "pool_local";
/** An unassigned line, the same one every time. */
export const CALLER_ID_RULE_POOL = "pool";

/**
 * Which of our numbers to present, and why.
 *
 * ── Assignment first, because a callback has to reach the caller ─────────
 *
 * Until 2026-09-18 this function took a bare list of every line FieldQuo
 * held, preferred one in the prospect's area code, and otherwise took the
 * first in sort order. Every line by then belonged to a rep
 * (PlatformSmsNumber.assignedRepId — lib/sales/numbers.js's callerIdForRep
 * had said "a rep with an assigned number presents it, always", and nothing
 * called it). So Favor, dialling an 888 number with no local match, presented
 * "+1438…" — the lowest-sorting line, which was Rachel's — on twelve dials in
 * a morning, and the office that texted back reached Rachel's line. Not a
 * cache: a deterministic sort with the assignment table never consulted.
 *
 * Now, in order:
 *   1. the rep's OWN assigned line;
 *   2. a line assigned to the rep's AGENCY (their manager, when it is an
 *      agency account) — the team's number;
 *   3. an UNASSIGNED line, local to the prospect's area code where one
 *      exists, otherwise the same one every time;
 *   4. nothing. Another rep's personal line is never borrowed: a callback
 *      to it reaches the wrong person, and that is worse than no call.
 *
 * ── And never anything else ──────────────────────────────────────────────
 *
 * The candidate list is numbers FieldQuo has actually bought. There is no path
 * here that constructs a plausible-looking local number: presenting a number
 * you do not own is spoofing, spec §25 forbids it, Twilio rejects it (21210),
 * and it is the difference between a legitimate sales call and a violation.
 *
 * @param prospectE164   who is being rung.
 * @param callerNumbers  `{ e164, assignedRepId?, assignedAdminId? }` rows, or
 *                       bare E.164 strings (read as unassigned — the shape the
 *                       older check drives it with).
 * @param salesRepId     who is dialling; null reads every assigned line as
 *                       somebody else's.
 * @param agencyRepIds   the rep's agency / team accounts whose line counts as
 *                       theirs.
 * @returns `{ e164, rule }` — `{ e164: null, rule: null }` when nothing may
 *          be presented, which callPlan() refuses on by name.
 */
export function chooseCallerIdFor({ prospectE164 = null, callerNumbers = [], salesRepId = null, agencyRepIds = [] } = {}) {
  const rows = (Array.isArray(callerNumbers) ? callerNumbers : [])
    .map((n) => (typeof n === "string" ? { e164: n, assignedRepId: null, assignedAdminId: null } : n))
    .filter((n) => n && typeof n.e164 === "string" && n.e164.startsWith("+") && n.active !== false);
  if (rows.length === 0) return { e164: null, rule: null };

  const mine = salesRepId ? rows.find((n) => n.assignedRepId === salesRepId) : null;
  if (mine) return { e164: mine.e164, rule: CALLER_ID_RULE_ASSIGNED };

  const team = new Set((Array.isArray(agencyRepIds) ? agencyRepIds : []).filter(Boolean));
  if (team.size) {
    // Stable within the team's lines too — sorted, not "first row returned".
    const theirs = rows.filter((n) => n.assignedRepId && team.has(n.assignedRepId)).map((n) => n.e164).sort();
    if (theirs.length) return { e164: theirs[0], rule: CALLER_ID_RULE_AGENCY };
  }

  const pool = rows.filter((n) => !n.assignedRepId && !n.assignedAdminId).map((n) => n.e164);
  if (pool.length === 0) return { e164: null, rule: null };

  // A contractor in Tulsa answers a 918 number and lets an unknown one ring
  // out, so a local pool line beats a distant one.
  const want = areaCodeOf(prospectE164);
  if (want) {
    const local = pool.find((n) => areaCodeOf(n) === want);
    if (local) return { e164: local, rule: CALLER_ID_RULE_POOL_LOCAL };
  }
  // Stable rather than "the first row the database returned": two calls to the
  // same prospect an hour apart should come from the same number, or the
  // contractor sees two strangers.
  return { e164: [...pool].sort()[0], rule: CALLER_ID_RULE_POOL };
}

/**
 * The number alone. Kept for callers that only want the E.164; the same
 * decision as chooseCallerIdFor(), never a second one.
 */
export function chooseCallerId(prospectE164, callerNumbers = [], { salesRepId = null, agencyRepIds = [] } = {}) {
  return chooseCallerIdFor({ prospectE164, callerNumbers, salesRepId, agencyRepIds }).e164;
}

/**
 * What the bridge should do — computed here, rendered as TwiML by the route.
 *
 * ══ Recording is ON, since 2026-09-17 ═════════════════════════════════════
 *
 * Until then `record` was false here with a consent-law argument: several of
 * the states callingRules.js enumerates are all-party-consent, so a recording
 * needs a disclosure. The disclosure IS needed, and it is a sentence, and the
 * rep says it: every default playbook opens with "this call may be recorded"
 * (lib/sales/playbook/defaults.js). With that in the script the owner's
 * decision stands — every sales call is recorded, dual-channel, so what a
 * rep said can be read against what the script asked. The attributes that
 * make it so live in lib/sales/calls/recording.js; `record: true` here is
 * the plan's statement of the fact, and there is still no environment
 * variable — it is not a setting.
 *
 * @returns {{ok:boolean, reason:string|null, to:string|null, callerId:string|null,
 *            callerIdRule:string|null, record:boolean, timeoutSeconds:number}}
 */
export function callPlan({
  toE164 = null,
  readiness = null,
  callerNumbers = [],
  ownNumbers = [],
  salesRepId = null,
  agencyRepIds = [],
} = {}) {
  const no = (reason) => ({
    ok: false,
    reason,
    to: null,
    callerId: null,
    callerIdRule: null,
    record: false,
    timeoutSeconds: 0,
  });

  const to = typeof toE164 === "string" ? toE164.trim() : "";
  if (!to.startsWith("+")) return no("That is not a number this build can dial.");

  // The same gate the href goes through, asked again at the second door. Not
  // "trust the caller, they already checked" — a browser posts to this route
  // directly and the window closes while a page is open.
  if (!readiness || readiness.decision !== CALL_ALLOWED) {
    return no(
      "The calling window has not cleared this number. There is no path to a dial from a refusal or an unknown, through the browser or otherwise.",
    );
  }

  // Ringing our own infrastructure bridges a loop, bills both legs, and — on a
  // tenant's number — puts a contractor's receptionist on the line with a
  // FieldQuo rep who was trying to sell to somebody else. Cheap to refuse.
  const own = (Array.isArray(ownNumbers) ? ownNumbers : []).filter(Boolean);
  if (own.includes(to)) {
    return no("That is one of our own numbers. Calling it would bridge a loop and bill both legs.");
  }

  const chosen = chooseCallerIdFor({ prospectE164: to, callerNumbers, salesRepId, agencyRepIds });
  if (!chosen.e164) {
    // Two different facts, said as two different sentences: no line at all,
    // or every line is somebody else's. The second is the one the floor
    // board reports per rep (callerNumberFor) so the owner assigns one.
    const held = (Array.isArray(callerNumbers) ? callerNumbers : []).length;
    return no(
      held
        ? "You have no number assigned to you, and every line FieldQuo holds belongs to another rep. Presenting theirs would send their callbacks to the wrong person, so ask for a line to be assigned to you."
        : "FieldQuo holds no number to call from, and presenting one we do not own is not an option.",
    );
  }

  return {
    ok: true,
    reason: null,
    to,
    callerId: chosen.e164,
    callerIdRule: chosen.rule,
    record: true,
    // Long enough for a tradesperson to get down off a ladder, short enough
    // that a dead number does not tie up a rep. Twilio's own default is 60.
    timeoutSeconds: 30,
  };
}

/**
 * The line a rep would present on their next dial, for the floor board.
 *
 * The same chooser as the dial, asked without a prospect — so it answers
 * "assigned" / "agency" / "pool" / none, and a rep who would be refused at
 * the dial is shown as having no number rather than as fine. Pure.
 */
export function callerNumberFor({ salesRepId, callerNumbers = [], agencyRepIds = [] } = {}) {
  return chooseCallerIdFor({ prospectE164: null, callerNumbers, salesRepId, agencyRepIds });
}

/**
 * What the prospect's leg actually cost, from Twilio's own figures.
 *
 * Both legs are billed: the browser leg (rep ↔ Twilio) and the PSTN leg
 * (Twilio ↔ prospect), plus rent on the number. Nothing here estimates any of
 * them — the same rule lib/voice/providerCost.js states for tenant calls, and
 * the same reason PlatformVoiceCall.providerCostCents is nullable: a guess
 * written into a cost column is indistinguishable from a reading a month
 * later.
 *
 * Returns null when the provider gave no figure. Never a zero.
 */
export function callCostCents(priceString) {
  if (typeof priceString !== "string" && typeof priceString !== "number") return null;
  const n = Number(priceString);
  if (!Number.isFinite(n)) return null;
  // Twilio reports outbound price as a NEGATIVE decimal in the account's
  // currency ("-0.0140"). The magnitude is the cost; the sign is bookkeeping
  // from the account's point of view and would make every total negative.
  return Math.round(Math.abs(n) * 100 * 100) / 100;
}
