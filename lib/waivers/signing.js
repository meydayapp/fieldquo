// lib/waivers/signing.js
//
// Signing a waiver: every acknowledgement ticked, then the same signature
// evidence a quote approval carries — and a hash over the waiver's text AND
// the acknowledgement lines, so a later edit to either cannot change what
// was agreed.
//
// ── The server decides, not the button ─────────────────────────────────────
//
// The client page unlocks its Sign button when every box is ticked. That is
// a courtesy, not the rule: `buildWaiverSignature()` below returns null
// unless the POSTED acknowledgements cover every line the waiver carries,
// and the route refuses the signature on null. Hiding a button is not
// access control (AGENTS.md non-negotiable #2 says it about impersonation;
// it is true of a release of liability too).
//
// ── Pure ────────────────────────────────────────────────────────────────────
//
// node:crypto only, same as lib/documents/signatureAudit.js, whose
// buildSignatureRecord this reuses for the name / mark / consent / IP / UA
// shape. Executed against hostile input by scripts/check-client-proposal.mjs:
// four of five boxes ticked, a box index out of range, the same box twice,
// a text that does not match the waiver's.

import { createHash, randomBytes } from "crypto";
import { buildSignatureRecord } from "@/lib/documents/signatureAudit";
import { sanitiseWaiverBody } from "@/lib/company/documents";

/**
 * Canonical input for the hash: the waiver's title, its sections and its
 * acknowledgement lines, in order. An explicitly ordered array rather than
 * an object, for the same reason signatureAudit uses one — key order is not
 * a guarantee, an array is.
 */
export function waiverDigestInput({ title, body }) {
  const clean = sanitiseWaiverBody(body) || { sections: [], acknowledgements: [] };
  return JSON.stringify([
    ["title", String(title || "")],
    ["sections", clean.sections.map((s) => [s.heading, s.text])],
    ["acknowledgements", clean.acknowledgements],
  ]);
}

export function hashWaiver(doc) {
  return createHash("sha256").update(waiverDigestInput(doc)).digest("hex");
}

/**
 * The acknowledgements the client posted, matched against the waiver's own
 * lines. Accepts either indexes or the line texts; returns the covered
 * indexes, deduplicated, or null when a posted value matches nothing.
 */
export function coveredAcknowledgements(lines, posted) {
  if (!Array.isArray(posted)) return [];
  const out = new Set();
  for (const item of posted) {
    if (Number.isInteger(item) && item >= 0 && item < lines.length) {
      out.add(item);
      continue;
    }
    if (typeof item === "string") {
      const at = lines.indexOf(item.trim());
      if (at >= 0) out.add(at);
    }
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * The signed record, or null.
 *
 * @param document  { id, title, body } — the CompanyDocument row
 * @param ticked    what the browser posted: indexes or texts
 * @param name, signatureDataUrl, consent — the client's own inputs
 * @param ip, userAgent, now — supplied by the server, never the browser
 *
 * Null when ANY acknowledgement is unticked, when the waiver has no
 * acknowledgements to tick (an unsignable waiver must not be signed by
 * omission), or when the name / mark / consent do not make a signature.
 */
export function buildWaiverSignature({ document, ticked, name, signatureDataUrl, consent, ip, userAgent, now }) {
  const clean = sanitiseWaiverBody(document?.body);
  if (!clean || clean.acknowledgements.length === 0) return null;

  const covered = coveredAcknowledgements(clean.acknowledgements, ticked);
  if (covered.length !== clean.acknowledgements.length) return null;

  const signedAt = now || new Date().toISOString();
  const signature = buildSignatureRecord({
    // The hash is the WAIVER's, computed below; buildSignatureRecord hashes a
    // quote shape, so it is handed an empty one and its documentHash replaced.
    quote: {},
    name,
    signatureDataUrl,
    consent,
    ip,
    userAgent,
    now: signedAt,
  });
  if (!signature) return null;

  const documentHash = hashWaiver({ title: document?.title, body: clean });
  return {
    acknowledgements: clean.acknowledgements.map((text) => ({ text, tickedAt: signedAt })),
    signature: { ...signature, documentHash },
    documentHash,
    signedAt,
  };
}

/** Re-verify a stored waiver signature against the document as it is now. */
export function verifyWaiverSignature(document, stored) {
  if (!stored?.documentHash) return false;
  return stored.documentHash === hashWaiver({ title: document?.title, body: document?.body });
}

/** The public token for /w/[token]: 24 url-safe characters from crypto. */
export function newWaiverToken() {
  return `wv_${randomBytes(24).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}`;
}
