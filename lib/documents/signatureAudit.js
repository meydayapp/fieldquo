// lib/documents/signatureAudit.js
//
// The evidence that makes a self-built signature stand up: a stable hash of the
// exact quote the client agreed to, plus the who/when/where of the signing.
//
// Why the hash matters: without it, "they signed" and "we later edited the
// price" are indistinguishable — the signature would attach to nothing in
// particular. Hashing the priced content at signing time means the signed
// record can be re-verified against the document forever, and any change is
// detectable. This is the same tamper-evidence property a paid e-sign vendor
// sells; it just isn't magic, it's a hash.
//
// Pure and dependency-light (node:crypto only), so it's unit-tested against
// hostile input.

import { createHash } from "crypto";

// Canonicalise the parts of a quote that define WHAT was agreed. Deliberately
// excludes volatile/display fields (updatedAt, pdfUrl, review flags) so the
// hash reflects the deal, not incidental churn. Stable key order via
// JSON.stringify over an explicitly ordered array — object key order is not
// guaranteed, an array is.
export function documentDigestInput(quote) {
  const q = quote || {};
  return JSON.stringify([
    ["quoteNumber", q.quoteNumber ?? null],
    ["companyId", q.companyId ?? null],
    ["clientId", q.clientId ?? null],
    ["currency", q.currency ?? null],
    ["subtotal", str(q.subtotal)],
    ["tax", str(q.tax)],
    ["discount", str(q.discount)],
    ["total", str(q.total)],
    ["acceptedTotal", str(q.acceptedTotal)],
    ["lineItems", q.lineItems ?? null],
    ["scopeGroups", (q.scopeGroups || []).map((g) => [g.categoryId ?? null, str(g.subtotal), g.lineItems ?? null])],
    ["addOns", (q.addOns || []).filter((a) => a.selected).map((a) => [a.id, str(a.price)])],
  ]);
}

function str(v) {
  // Decimals come back as Prisma.Decimal or string; normalise to a plain string
  // so 5000, "5000", and Decimal(5000) all hash identically.
  if (v == null) return null;
  return String(v);
}

/** sha256 hex of a quote's agreed content. Pure. */
export function hashQuote(quote) {
  return createHash("sha256").update(documentDigestInput(quote)).digest("hex");
}

/**
 * Assemble the signature audit record stored on Quote.signature. The server
 * supplies ip/userAgent from the request (never trusted from the browser); the
 * browser supplies only the name, the drawn signature image, and consent.
 *
 * Returns null if the minimum for a valid signature isn't present — no name, no
 * mark, or consent not given. A caller must treat null as "not signed" and
 * refuse the acceptance, so an empty signature can never stand in for one.
 */
export function buildSignatureRecord({ quote, name, signatureDataUrl, consent, ip, userAgent, now }) {
  const trimmedName = String(name || "").trim();
  const hasMark = typeof signatureDataUrl === "string" && signatureDataUrl.startsWith("data:image/");
  if (!trimmedName || !hasMark || consent !== true) return null;

  return {
    name: trimmedName,
    signatureDataUrl,
    consent: true,
    signedAt: now || new Date().toISOString(),
    ip: ip || null,
    userAgent: userAgent || null,
    documentHash: hashQuote(quote),
  };
}

/** Re-verify a stored signature against the current quote. True if untampered. */
export function verifySignature(quote, signature) {
  if (!signature?.documentHash) return false;
  return signature.documentHash === hashQuote(quote);
}
