// lib/voice/webhookSignature.js
//
// Proving a webhook delivery really came from Retell.
//
// ══ Why this file exists: every delivery was being turned away ═════════════
//
// Both public voice endpoints — /api/voice/webhook and /api/voice/tools/[tool]
// — verified the signature like this:
//
//     const expected = createHmac("sha256", RETELL_WEBHOOK_SECRET)
//       .update(rawBody).digest("hex");
//     timingSafeEqual(Buffer.from(header), Buffer.from(expected));
//
// Three separate things wrong with it, and any ONE of them rejects 100% of
// real deliveries:
//
//   1. THE HEADER IS NOT A BARE DIGEST. Retell sends
//          X-Retell-Signature: v=<unix-ms>,d=<hex>
//      The old code compared that whole ~85-character string against a
//      64-character hex digest, so the length guard above `timingSafeEqual`
//      returned false before any crypto ran. Every delivery, every time.
//
//   2. THE SIGNED MESSAGE IS BODY **+ TIMESTAMP**, not the body alone.
//
//   3. THE KEY IS THE RETELL API KEY, not a separate webhook secret. Retell
//      has no "webhook secret" to copy — it signs with an API key that carries
//      the webhook badge in their dashboard. `RETELL_WEBHOOK_SECRET` was a
//      variable nobody could ever have set to a correct value, and
//      docs/VERCEL.md told the owner to invent one with `openssl rand`.
//
// The consequence is the thing that made this worth digging out: a 401 on
// every delivery is indistinguishable from a phone nobody rang. `VoiceCall`
// was empty, no minute was ever billed, no lead was ever saved by the
// receptionist, and nothing anywhere said why. The owner's account has zero
// VoiceCall rows and this is the reason there could never have been one.
//
// ══ Rejections are now LOUD ════════════════════════════════════════════════
//
// The old handler returned 401 and wrote nothing. That is what let this hide
// for months. `verifyRetellSignature` returns a REASON, the routes record it,
// and lib/voice/readiness.js reports it on the settings screen — so the next
// time we turn Retell away, the contractor's own readiness check says so in
// one sentence instead of nobody finding out.
//
// Pure: no database, no network, no `process.env` read inside the verifier
// itself. The keys are passed in, so the check script can execute the whole
// decision table.
import crypto from "node:crypto";

/**
 * How far out of date a signature may be, in milliseconds.
 *
 * Retell documents a five-minute replay window and we match it rather than
 * widening it "just in case". A stale signature is now REPORTED rather than
 * silently dropped, so if a clock ever does skew we find out from the
 * readiness panel on the first call instead of from an empty call list.
 */
export const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;

/** Every reason a delivery can be turned away. The UI and the check share it. */
export const SIGNATURE_REASONS = {
  ok: "ok",
  /** No key configured on this deployment — we cannot verify anything. */
  no_key: "no_key",
  /** No X-Retell-Signature header at all. Not Retell, or not signed. */
  no_signature: "no_signature",
  /** Header present but not `v=<ms>,d=<hex>`. */
  malformed: "malformed",
  /** Correctly shaped, but the timestamp is outside the replay window. */
  stale: "stale",
  /** Correctly shaped and fresh, but no configured key produces that digest. */
  mismatch: "mismatch",
};

/**
 * Split `v=1712345678901,d=abc123…` into its two halves, or null.
 *
 * Deliberately strict about the digest being hex: a header that is *nearly*
 * right is far more likely to be a different provider, or a proxy that
 * rewrote it, than something we should spend a constant-time compare on.
 */
export function parseRetellSignature(header) {
  const raw = String(header || "").trim();
  if (!raw) return null;
  const m = /^v=(\d{1,20}),d=([0-9a-fA-F]{64})$/.exec(raw);
  if (!m) return null;
  return { timestamp: m[1], digest: m[2].toLowerCase() };
}

/** Constant-time hex compare that tolerates a length mismatch. */
function sameDigest(a, b) {
  const ba = Buffer.from(String(a), "utf8");
  const bb = Buffer.from(String(b), "utf8");
  if (ba.length !== bb.length) return false;
  try {
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * The digest Retell would have produced.
 *
 * `rawBody + timestamp`, string concatenation, HMAC-SHA256, hex. The raw body
 * as it arrived on the wire — re-serialising the parsed JSON changes the
 * bytes and the digest with them, which is the mistake Retell's own docs
 * single out.
 */
export function retellDigest({ rawBody, timestamp, key }) {
  return crypto
    .createHmac("sha256", String(key))
    .update(`${rawBody}${timestamp}`)
    .digest("hex");
}

/**
 * Is this delivery really Retell's?
 *
 * @param rawBody   the body exactly as received, before JSON.parse
 * @param header    the X-Retell-Signature header value
 * @param keys      candidate signing keys, in order of likelihood
 * @param now       injectable clock, so the check script owns time
 * @returns {{ ok: boolean, reason: string, keyIndex: number|null, ageMs: number|null }}
 *
 * `keys` is a LIST because Retell signs with whichever API key carries the
 * webhook badge, and that is not necessarily the key we make API calls with.
 * The owner can name the signing key separately without us pretending there is
 * a "webhook secret" — see signingKeys() below. Every candidate is tried with a
 * constant-time compare; `keyIndex` says which one matched, so the readiness
 * panel can tell the owner their signing key and their API key have diverged
 * instead of just saying "unauthorised".
 */
export function verifyRetellSignature({
  rawBody,
  header,
  keys = [],
  now = Date.now(),
  toleranceMs = SIGNATURE_TOLERANCE_MS,
}) {
  const usable = (Array.isArray(keys) ? keys : [keys]).filter(
    (k) => typeof k === "string" && k.length > 0,
  );
  if (!usable.length) {
    return { ok: false, reason: SIGNATURE_REASONS.no_key, keyIndex: null, ageMs: null };
  }
  if (!header) {
    return { ok: false, reason: SIGNATURE_REASONS.no_signature, keyIndex: null, ageMs: null };
  }

  const parsed = parseRetellSignature(header);
  if (!parsed) {
    return { ok: false, reason: SIGNATURE_REASONS.malformed, keyIndex: null, ageMs: null };
  }

  // Freshness BEFORE the compare. A replayed delivery carries a genuine
  // signature, so the digest would pass and the replay is the whole attack.
  const ageMs = Number(now) - Number(parsed.timestamp);
  if (!Number.isFinite(ageMs) || Math.abs(ageMs) > toleranceMs) {
    return { ok: false, reason: SIGNATURE_REASONS.stale, keyIndex: null, ageMs };
  }

  for (let i = 0; i < usable.length; i += 1) {
    const expected = retellDigest({ rawBody, timestamp: parsed.timestamp, key: usable[i] });
    if (sameDigest(parsed.digest, expected)) {
      return { ok: true, reason: SIGNATURE_REASONS.ok, keyIndex: i, ageMs };
    }
  }
  return { ok: false, reason: SIGNATURE_REASONS.mismatch, keyIndex: null, ageMs };
}

/**
 * The keys this deployment will accept a signature from.
 *
 * `RETELL_API_KEY` first, because that is what Retell signs with by default
 * and it is the one variable the owner already has to set. `RETELL_WEBHOOK_SECRET`
 * is kept ONLY as the escape hatch for the case Retell's docs describe — an
 * account whose webhook-badged key is a different key from the one we call the
 * API with. It is no longer a random secret the owner invents; docs/VERCEL.md
 * now says so.
 *
 * Order matters for `keyIndex`: index 0 means "signed with our API key", which
 * is the healthy case.
 */
export function signingKeys({
  // Named arguments rather than an `env` object so both variables appear here
  // as literal `process.env.X` reads — scripts/check-env-docs.mjs sweeps for
  // exactly that, and a variable it cannot see is one it reports as work the
  // owner does for nothing.
  apiKey = process.env.RETELL_API_KEY,
  altSigningKey = process.env.RETELL_WEBHOOK_SECRET,
} = {}) {
  return [apiKey, altSigningKey].filter(Boolean);
}

/**
 * One sentence per reason, for a log line and for the readiness panel.
 *
 * Written for the person who has to act, not for a developer: "we are turning
 * Retell away" is actionable, "401" is not.
 */
export const SIGNATURE_REASON_TEXT = {
  no_key: "No Retell key is set on this deployment, so nothing can be verified.",
  no_signature: "The request arrived with no Retell signature header.",
  malformed:
    "The signature header wasn't in Retell's v=<timestamp>,d=<digest> form — something between Retell and us rewrote it.",
  stale:
    "The signature was outside the five-minute replay window — this server's clock and Retell's disagree.",
  mismatch:
    "The signature didn't match any key we hold. The key Retell signs with isn't the key set here.",
};
