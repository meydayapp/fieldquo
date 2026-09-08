// lib/messaging/webhookSignature.js
//
// Verifies the `X-Hub-Signature-256` header Meta puts on every webhook POST.
//
// Format: `sha256=<hex>`, where <hex> is HMAC-SHA256 of the RAW REQUEST BODY
// keyed with the app secret. The raw bytes matter — re-serialising the parsed
// JSON changes whitespace and key order and the signature stops matching, so
// the route reads request.text() once and hands that exact string here.
//
// An unverified messaging webhook is an endpoint where anyone who guesses a
// Page id can inject a conversation into a contractor's inbox — including a
// message that looks like it came from a homeowner and quotes a price.
//
// ── Why this is a sibling of lib/dataDeletion/signedRequest.js and not a
//    call into it ──────────────────────────────────────────────────────────
//
// That file verifies Meta's OTHER signature scheme: `signed_request`, a
// dot-separated base64url pair carrying its own JSON payload and its own
// declared algorithm, used by the Data Deletion callback. This one is a plain
// header HMAC over the body. Same primitive, different envelope — folding them
// into one function would mean a parameter that switches between two formats,
// which is how a verifier ends up accepting the wrong one. What IS shared is
// the posture, deliberately copied line for line:
//
//   * fail CLOSED when the secret is unset. An unset secret is "we cannot
//     verify", never "skip verification".
//   * timing-safe comparison.
//   * `reason` is for the log and the check script; the route answers a bare
//     403 either way, because telling an attacker which check they failed is
//     a hint.
//
// Pure: the secret is an argument, not a process.env read, so the check script
// can execute the valid, forged, missing-header and missing-secret cases
// against the real function.

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * @param {string} rawBody   the exact bytes of the POST body, as text
 * @param {string} header    the X-Hub-Signature-256 header value
 * @param {string} secret    META_APP_SECRET
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function verifyWebhookSignature(rawBody, header, secret) {
  if (!secret) return { ok: false, reason: "secret_unset" };
  if (typeof rawBody !== "string") return { ok: false, reason: "no_body" };
  if (typeof header !== "string" || !header) return { ok: false, reason: "no_signature" };

  // Meta prefixes the algorithm. Anything else is refused outright rather than
  // "supported": an attacker who can pick the algorithm can pick a weak one.
  const [algo, given] = header.split("=");
  if (algo !== "sha256" || !given) return { ok: false, reason: "unexpected_algorithm" };

  // A non-hex signature would make Buffer.from(..., "hex") silently truncate,
  // and a truncated buffer that happens to match a prefix would pass a naive
  // length check. Rejected before any comparison happens.
  if (!/^[0-9a-f]+$/i.test(given)) return { ok: false, reason: "malformed_signature" };

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  const givenBuf = Buffer.from(given, "hex");
  if (givenBuf.length !== expected.length || !timingSafeEqual(givenBuf, expected)) {
    return { ok: false, reason: "bad_signature" };
  }
  return { ok: true };
}

/**
 * The inverse, for the check script and for nothing in the product: signs a
 * body the way Meta would. Exported so the check exercises the verifier with a
 * signature produced by the same primitive rather than a pasted fixture that
 * cannot be re-derived when the body changes.
 */
export function signWebhookBody(rawBody, secret) {
  return `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
}

/**
 * Meta's GET verification handshake, done once when the callback URL is saved
 * in the App Dashboard: Meta calls with hub.mode/hub.verify_token/hub.challenge
 * and expects the challenge echoed back verbatim IF the token matches the one
 * typed into the dashboard.
 *
 * Fails closed on an unset verify token for the same reason as the signature:
 * echoing a challenge to anybody who asks lets a stranger point their own Meta
 * app at this deployment's webhook.
 *
 * @returns {{ ok: true, challenge: string } | { ok: false, reason: string }}
 */
export function verifySubscribeChallenge(params, verifyToken) {
  if (!verifyToken) return { ok: false, reason: "verify_token_unset" };
  const mode = params?.get?.("hub.mode");
  const token = params?.get?.("hub.verify_token");
  const challenge = params?.get?.("hub.challenge");
  if (mode !== "subscribe") return { ok: false, reason: "unexpected_mode" };
  if (typeof token !== "string" || token.length !== verifyToken.length) {
    return { ok: false, reason: "bad_verify_token" };
  }
  // Timing-safe here too: this token is a shared secret like any other, and a
  // string === on it is an oracle.
  const a = Buffer.from(token, "utf8");
  const b = Buffer.from(verifyToken, "utf8");
  if (!timingSafeEqual(a, b)) return { ok: false, reason: "bad_verify_token" };
  if (typeof challenge !== "string" || !challenge) {
    return { ok: false, reason: "no_challenge" };
  }
  return { ok: true, challenge };
}
