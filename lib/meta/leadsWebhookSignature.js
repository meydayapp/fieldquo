// lib/meta/leadsWebhookSignature.js
//
// Verifies the `X-Hub-Signature-256` header Meta puts on every webhook
// delivery. Different mechanism from lib/dataDeletion/signedRequest.js — that
// one verifies a `signed_request` FORM FIELD, this one verifies a HEADER
// against the raw request body — but the same discipline, and deliberately
// the same shape, so the two read alike.
//
// Format (Meta's):
//
//   X-Hub-Signature-256: sha256=<hex HMAC-SHA256 of the raw body, keyed with
//                                the app secret>
//
// ══ Why the RAW body ═══════════════════════════════════════════════════════
//
// The HMAC is over the exact bytes Meta sent. Parsing the JSON and
// re-serialising it changes key order and whitespace, so the signature will
// not match — the route must read request.text() once and hand that string
// here, then JSON.parse the same string. This is the single most common way
// to get a webhook verifier that never verifies anything, so the route does
// it in that order and scripts/check-meta-leads.mjs asserts the result.
//
// ══ Fail closed ═══════════════════════════════════════════════════════════
//
// No secret means verification is IMPOSSIBLE, which is refused — never
// "skipped". /api/meta/leads/webhook creates lead rows in a contractor's
// tenant; an unverified one is a public endpoint that lets any stranger file
// leads into any company that has ever connected a Page.
//
// Pure: takes the secret as an argument rather than reading process.env, so
// the check can execute the valid, forged, missing-secret and swapped-
// algorithm cases against the real function.

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * @param {string} rawBody  the request body, exactly as received
 * @param {string} header   the X-Hub-Signature-256 header value
 * @param {string} secret   META_APP_SECRET
 * @returns {{ ok: true } | { ok: false, reason: string }}
 *
 * Refuses, in order: no secret (fail closed), a missing or non-string header,
 * a prefix that is not `sha256=`, a signature that is not hex of the right
 * length, and finally a mismatch. `reason` is for the log and the check — the
 * route answers a bare 403 either way, because telling a caller WHICH check
 * they failed is a hint.
 */
export function verifyWebhookSignature(rawBody, header, secret) {
  if (!secret) return { ok: false, reason: "secret_unset" };
  if (typeof rawBody !== "string") return { ok: false, reason: "no_body" };
  if (typeof header !== "string" || !header) return { ok: false, reason: "no_signature" };

  // ── The algorithm is pinned, not read ────────────────────────────────────
  //
  // Meta names the algorithm in the header prefix, and an attacker who can
  // CHOOSE the algorithm can choose a weak one — the classic JWT "alg: none"
  // shape. So `sha1=` (Meta's older X-Hub-Signature) is refused here rather
  // than supported: this endpoint subscribes to a v21.0 webhook, which always
  // sends sha256, and accepting the weaker one to be tolerant would be
  // accepting a downgrade anyone can request.
  const [algo, hex] = header.split("=", 2);
  if (algo !== "sha256") return { ok: false, reason: "unexpected_algorithm" };
  if (!hex || !/^[0-9a-f]+$/i.test(hex)) return { ok: false, reason: "malformed_signature" };

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  const given = Buffer.from(hex, "hex");
  // Length is compared first because timingSafeEqual THROWS on a mismatch
  // rather than returning false, and a throw here would be a 500 where a 403
  // belongs. The length itself leaks nothing the wire did not already.
  if (given.length !== expected.length) return { ok: false, reason: "bad_signature" };
  if (!timingSafeEqual(given, expected)) return { ok: false, reason: "bad_signature" };

  return { ok: true };
}

/**
 * The inverse, for the check script and for nothing in the product: builds the
 * header Meta would send. Exported so the verifier is exercised against a
 * signature produced by the same primitive Meta uses, rather than a
 * hand-pasted fixture nobody can re-derive when the body changes.
 */
export function buildWebhookSignature(rawBody, secret) {
  return `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
}

/**
 * Meta's subscription handshake, executed rather than described.
 *
 * When a webhook subscription is created or edited in the App Dashboard, Meta
 * GETs the callback URL with:
 *
 *   hub.mode=subscribe & hub.verify_token=<what we typed in> & hub.challenge=<n>
 *
 * and expects the challenge echoed back as a bare body. Echoing it WITHOUT
 * checking the token would let anyone who guesses the URL complete somebody
 * else's subscription, so the token is compared — timing-safe, and refusing
 * when META_WEBHOOK_VERIFY_TOKEN is unset, on the same fail-closed rule as
 * the signature above.
 *
 * @returns {{ ok: true, challenge: string } | { ok: false, reason: string }}
 */
export function verifySubscriptionHandshake({ mode, token, challenge }, expectedToken) {
  if (!expectedToken) return { ok: false, reason: "verify_token_unset" };
  if (mode !== "subscribe") return { ok: false, reason: "unexpected_mode" };
  if (typeof token !== "string" || !token) return { ok: false, reason: "no_token" };

  const a = Buffer.from(token);
  const b = Buffer.from(String(expectedToken));
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_verify_token" };
  }
  // Echoed verbatim as a string. Meta sends a number as text and compares the
  // body byte for byte; coercing it through Number() would drop a leading
  // zero and fail a handshake for no reason anybody could see.
  if (typeof challenge !== "string" || !challenge) return { ok: false, reason: "no_challenge" };

  return { ok: true, challenge };
}
