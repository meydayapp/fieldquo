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
      title: "At least one number FieldQuo owns",
      fix: "A call has to present a number we control — spec §25, and Twilio enforces it mechanically (error 21210). Buy one and record it before the first call.",
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

/**
 * Which of our numbers to present.
 *
 * ── Local, because a local number gets answered ──────────────────────────
 *
 * A contractor in Tulsa answers a 918 number and lets an unknown 1-800 ring
 * out. So the presented number matches the prospect's area code when FieldQuo
 * holds one there.
 *
 * ── And never anything else ──────────────────────────────────────────────
 *
 * The candidate list is numbers FieldQuo has actually bought. There is no path
 * here that constructs a plausible-looking local number: presenting a number
 * you do not own is spoofing, spec §25 forbids it, Twilio rejects it (21210),
 * and it is the difference between a legitimate sales call and a violation.
 * With no local match the default is used — a real number somebody answers,
 * which is worth more than a local one nobody can ring back.
 *
 * Returns null only when we hold no numbers at all, which readiness has
 * already refused. Null is never a licence to dial from nothing.
 */
export function chooseCallerId(prospectE164, callerNumbers = []) {
  const numbers = (Array.isArray(callerNumbers) ? callerNumbers : []).filter(
    (n) => typeof n === "string" && n.startsWith("+"),
  );
  if (numbers.length === 0) return null;

  const want = areaCodeOf(prospectE164);
  if (want) {
    const local = numbers.find((n) => areaCodeOf(n) === want);
    if (local) return local;
  }
  // Stable rather than "the first row the database returned": two calls to the
  // same prospect an hour apart should come from the same number, or the
  // contractor sees two strangers.
  return [...numbers].sort()[0];
}

/**
 * What the bridge should do — computed here, rendered as TwiML by the route.
 *
 * ══ Recording is OFF, and this is where that is decided ════════════════════
 *
 * `record` is false and there is no environment variable that flips it,
 * deliberately. Recording a two-party call is consent law, not a feature flag:
 * the jurisdictions this product already enumerates for calling hours include
 * all-party-consent states, and the contractor side of this codebase already
 * carries scripts/check-recording-disclosure.mjs because the same problem was
 * solved once. Turning recording on means playing a disclosure to both legs,
 * per jurisdiction, and storing the consent — that is a feature, not a
 * parameter, and shipping the parameter first would produce recordings nobody
 * may listen to.
 *
 * So: no recording, said out loud, rather than a `recordingEnabled` column
 * nothing sets.
 *
 * @returns {{ok:boolean, reason:string|null, to:string|null, callerId:string|null,
 *            record:boolean, timeoutSeconds:number}}
 */
export function callPlan({
  toE164 = null,
  readiness = null,
  callerNumbers = [],
  ownNumbers = [],
} = {}) {
  const no = (reason) => ({
    ok: false,
    reason,
    to: null,
    callerId: null,
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

  const callerId = chooseCallerId(to, callerNumbers);
  if (!callerId) {
    return no("FieldQuo holds no number to call from, and presenting one we do not own is not an option.");
  }

  return {
    ok: true,
    reason: null,
    to,
    callerId,
    record: false,
    // Long enough for a tradesperson to get down off a ladder, short enough
    // that a dead number does not tie up a rep. Twilio's own default is 60.
    timeoutSeconds: 30,
  };
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
