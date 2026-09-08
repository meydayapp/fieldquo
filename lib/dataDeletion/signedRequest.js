// lib/dataDeletion/signedRequest.js
//
// Verifies the `signed_request` Meta POSTs to an app's Data Deletion Request
// callback when a person removes the app from their Facebook settings.
//
// Format (Meta's, unchanged since the Facebook Login days):
//
//   <signature>.<payload>
//
// Both halves base64url. `payload` is JSON — { algorithm: "HMAC-SHA256",
// issued_at, user_id, ... } — and `signature` is the raw HMAC-SHA256 of the
// payload STRING (the encoded form, not the decoded JSON) keyed with the app
// secret. A callback that answers without checking this is a public endpoint
// that files a deletion request for any user id anybody cares to name.
//
// Pure: takes the secret as an argument rather than reading process.env, so
// scripts/check-data-deletion.mjs can execute the forged, valid and
// missing-secret cases against the real function. The route is the one place
// that reads META_APP_SECRET — the same variable lib/meta/client.js already
// uses for the OAuth exchange, so a working ads connection and a working
// callback are one configuration, not two.

import { createHmac, timingSafeEqual } from "node:crypto";

function base64urlDecode(s) {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded + "=".repeat((4 - (padded.length % 4)) % 4), "base64");
}

/**
 * @returns {{ ok: true, payload: object } | { ok: false, reason: string }}
 *
 * Refuses, in order: no secret configured (fail CLOSED — an unset secret is
 * "we cannot verify", never "skip verification"), malformed input, an
 * algorithm we did not expect, a signature that does not match, a payload
 * that is not JSON. `reason` is for the log and the check, not the caller —
 * the route answers Meta with a bare 400 either way, because telling an
 * attacker WHICH check they failed is a hint.
 */
export function parseSignedRequest(raw, secret) {
  if (!secret) return { ok: false, reason: "secret_unset" };
  if (typeof raw !== "string" || !raw.includes(".")) {
    return { ok: false, reason: "malformed" };
  }
  const dot = raw.indexOf(".");
  const encodedSig = raw.slice(0, dot);
  const encodedPayload = raw.slice(dot + 1);
  if (!encodedSig || !encodedPayload) return { ok: false, reason: "malformed" };

  let payload;
  try {
    payload = JSON.parse(base64urlDecode(encodedPayload).toString("utf8"));
  } catch {
    return { ok: false, reason: "payload_not_json" };
  }
  if (!payload || typeof payload !== "object") {
    return { ok: false, reason: "payload_not_object" };
  }

  // Meta pins the algorithm in the payload. Anything else is refused outright
  // rather than "supported": an attacker who can pick the algorithm can pick
  // "none".
  if (String(payload.algorithm || "").toUpperCase() !== "HMAC-SHA256") {
    return { ok: false, reason: "unexpected_algorithm" };
  }

  const expected = createHmac("sha256", secret).update(encodedPayload).digest();
  const given = base64urlDecode(encodedSig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "bad_signature" };
  }

  return { ok: true, payload };
}

/**
 * The inverse, for the check script and for nothing in the product: builds a
 * signed_request the way Meta would. Exported so the check exercises the
 * verifier with a signature produced by the same primitive Meta uses rather
 * than a hand-pasted fixture that can't be re-derived.
 */
export function buildSignedRequest(payload, secret) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${sig}.${encodedPayload}`;
}
