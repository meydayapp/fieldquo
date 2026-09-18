// lib/sales/outreach/introLink.js
//
// The two links in the intro email — "call me back" and "book a demo" — and
// the unsubscribe beside them: what a token carries, how it is sealed, and
// the rules the public route applies to one. Plus the table of which call
// outcomes offer the email in the first place.
//
// ══ Sealed, not signed-and-readable ══════════════════════════════════════
//
// The brief asked for two things that pull apart: a signed token CARRYING
// leadId + repId + kind, and no ids exposed in the URL. A signed-but-plain
// token (lib/dataDeletion/signedRequest.js's shape) satisfies the first and
// fails the second — base64 is not a lock. So the payload is ENCRYPTED with
// AES-256-GCM through lib/meta/tokenCrypto.js, whose auth tag is the
// signature: a flipped byte, a swapped kind, a moved expiry all fail to open
// rather than open to something else. Same key, same implementation as the
// mailbox password (lib/sales/mailbox/secret.js says why not a second one),
// and the same precondition — an intro email can only be sent through a
// connected mailbox, which already needed the key.
//
// ══ Single-use per kind, and never on a GET ══════════════════════════════
//
// Outlook Safe Links and every corporate mail proxy fetch every link in a
// delivered message with a plain GET. A link that acted on GET would file a
// call-back request for every prospect whose mail server scanned the
// message, before a human read it — the failure app/api/no-contact/[token]
// already wrote down for the unsubscribe. So the public page shows ONE
// button and the request is a POST, and the row's stamp for that kind is
// set once (a WHERE on `null`), so the second press — or a replay of the
// POST — answers "already asked" and writes nothing.
//
// ══ Which outcomes ask ════════════════════════════════════════════════════
//
// no_answer and voicemail: the call did not become a conversation, so the
// written version is the next best thing. Not text_instead — they asked to
// be texted, and the composer opens instead. Not busy or hung_up: a busy
// tone is a retry in minutes, and somebody who picked up and put it down is
// not somebody to email inside the hour. Not any reached_* outcome: the
// pitch happened. The table is a table so the check can hold it.
//
// Pure except for the two crypto calls, which read the env key; the check
// sets one before importing.

import { decryptToken, encryptToken, tokenCryptoConfigured } from "@/lib/meta/tokenCrypto";
import { localTimeIn } from "@/lib/sales/callingWindow";

/** What the prospect can press. */
export const INTRO_LINK_KINDS = Object.freeze(["callback", "demo", "unsubscribe"]);
export const isIntroLinkKind = (v) => INTRO_LINK_KINDS.includes(v);

/** The two that create a request on the lead. `unsubscribe` writes the suppression list instead. */
export const INTRO_REQUEST_KINDS = Object.freeze(["callback", "demo"]);

/** How long the links work. Thirty days from the send. */
export const INTRO_LINK_DAYS = 30;

/** The same address is not sent a second intro inside this window, whoever rang. */
export const INTRO_REPEAT_DAYS = 14;

/** The path the public page and route live under. */
export const INTRO_LINK_PATH = "/i";

/** Call outcomes after which the pop-up offers the email. */
export const INTRO_EMAIL_ASK_CODES = Object.freeze(["no_answer", "voicemail"]);
export const asksIntroEmail = (code) => INTRO_EMAIL_ASK_CODES.includes(code);

/** Is the key present? Sending is refused without it — the links could not be minted. */
export function introLinksConfigured() {
  return tokenCryptoConfigured();
}

function when(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

const b64ToUrl = (s) => s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const urlToB64 = (s) => {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  return padded + "=".repeat((4 - (padded.length % 4)) % 4);
};

/**
 * Seal one link's token.
 *
 * @param introEmailId  the SalesIntroEmail row.
 * @param leadId, salesRepId  carried and re-checked against the row on open.
 * @param kind          an INTRO_LINK_KINDS value.
 * @param expiresAt     the row's expiry.
 * @returns a URL-safe string, or throws when the key is missing.
 */
export function sealIntroLink({ introEmailId, leadId, salesRepId, kind, expiresAt }) {
  if (!introEmailId || !leadId || !salesRepId) throw new Error("sealIntroLink needs the row, the lead and the rep");
  if (!isIntroLinkKind(kind)) throw new Error(`sealIntroLink: unknown kind ${String(kind)}`);
  const exp = when(expiresAt);
  if (!exp) throw new Error("sealIntroLink needs an expiry");
  const payload = JSON.stringify({ v: 1, i: introEmailId, l: leadId, r: salesRepId, k: kind, x: exp.getTime() });
  return b64ToUrl(encryptToken(payload));
}

/**
 * Open a token.
 *
 * @returns { ok: true, introEmailId, leadId, salesRepId, kind, expiresAt }
 *        | { ok: false, reason: "unconfigured" | "malformed" | "tampered" | "expired" }
 *
 * `tampered` covers a wrong key, a flipped byte and a forged blob alike —
 * GCM cannot tell them apart and the caller has no reason to. `expired` is
 * decided from the token's own stamp against `now`; the route re-checks the
 * row's expiresAt too, so a token from before an owner shortened the window
 * is judged by the row.
 */
export function openIntroLink(token, { now = new Date() } = {}) {
  if (!tokenCryptoConfigured()) return { ok: false, reason: "unconfigured" };
  if (typeof token !== "string" || token.length < 40 || token.length > 2000 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    return { ok: false, reason: "malformed" };
  }
  let plaintext;
  try {
    plaintext = decryptToken(urlToB64(token));
  } catch {
    return { ok: false, reason: "tampered" };
  }
  let payload;
  try {
    payload = JSON.parse(plaintext);
  } catch {
    return { ok: false, reason: "tampered" };
  }
  if (!payload || typeof payload !== "object" || payload.v !== 1) return { ok: false, reason: "tampered" };
  const { i, l, r, k, x } = payload;
  if (typeof i !== "string" || typeof l !== "string" || typeof r !== "string" || !isIntroLinkKind(k) || !Number.isFinite(x)) {
    return { ok: false, reason: "tampered" };
  }
  const at = when(now) || new Date();
  if (x <= at.getTime()) return { ok: false, reason: "expired" };
  return { ok: true, introEmailId: i, leadId: l, salesRepId: r, kind: k, expiresAt: new Date(x) };
}

/** The absolute URL for a token. */
export function introLinkUrl(origin, token) {
  return `${String(origin || "").replace(/\/+$/, "")}${INTRO_LINK_PATH}/${encodeURIComponent(token)}`;
}

/** The row's expiry from its send time. */
export function introLinkExpiry(sentAt = new Date()) {
  const at = when(sentAt) || new Date();
  return new Date(at.getTime() + INTRO_LINK_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Was this address sent an intro inside INTRO_REPEAT_DAYS?
 *
 * @param rows  [{ sentAt }] for the address, any order.
 * @returns the most recent send inside the window, or null.
 */
export function recentIntroSend(rows, { now = new Date() } = {}) {
  const at = (when(now) || new Date()).getTime();
  const floor = at - INTRO_REPEAT_DAYS * 24 * 60 * 60 * 1000;
  let latest = null;
  for (const r of Array.isArray(rows) ? rows : []) {
    const sent = when(r?.sentAt);
    if (!sent || sent.getTime() <= floor) continue;
    if (!latest || sent > latest) latest = sent;
  }
  return latest;
}

/**
 * The next business hour where the prospect is: the next top-of-hour at
 * least one hour on, Monday to Friday, 09:00–17:00 local. Not the
 * telemarketing window (lib/sales/callingWindow.js, to 21:30) — a homeowner
 * who pressed "call me back" at 20:40 did not mean 21:00.
 *
 * ══ An unknown zone is not padded ════════════════════════════════════════
 *
 * With no usable zone the answer is `{ at: <next full hour>, zone: null }`
 * — the soonest honest time — and the caller says the zone was unknown on
 * the calendar entry, rather than evaluating 09:00 in a zone nobody stated.
 * AGENTS.md failure class #5.
 *
 * @returns { at: Date, zone: string|null }
 */
export function nextBusinessHour(now = new Date(), timeZone = null) {
  const base = when(now) || new Date();
  const HOUR = 60 * 60 * 1000;
  // The next top of the hour that is at least an hour away.
  let t = Math.ceil((base.getTime() + HOUR) / HOUR) * HOUR;
  const usable = typeof timeZone === "string" && timeZone && localTimeIn(timeZone, base);
  if (!usable) return { at: new Date(t), zone: null };
  const limit = base.getTime() + 8 * 24 * HOUR;
  while (t <= limit) {
    const local = localTimeIn(timeZone, new Date(t));
    if (local) {
      const weekday = local.weekday >= 1 && local.weekday <= 5;
      const inHours = local.minute >= 9 * 60 && local.minute < 17 * 60;
      if (weekday && inHours) return { at: new Date(t), zone: timeZone };
    }
    t += HOUR;
  }
  // Eight days without a weekday business hour is a zone that does not
  // exist; the soonest honest time again.
  return { at: new Date(Math.ceil((base.getTime() + HOUR) / HOUR) * HOUR), zone: null };
}
