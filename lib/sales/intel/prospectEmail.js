// lib/sales/intel/prospectEmail.js
//
// The email address a business publishes on its own site, read off the
// evidence that says it does.
//
// ══ Why this exists ═══════════════════════════════════════════════════════
//
// The playbook told a rep "Publishes an email address" and the lead made
// from that prospect had an empty email field. The address had been in
// ProspectEvidence.rawValue since the crawl — the `mailto:` link, or the
// address matched in the page text (lib/sales/intel/capabilityDetect.js,
// EMAIL_CONTACT) — and nothing copied it anywhere a form could read it.
// Prospect.email and Prospect.emailSource are that copy. This file decides
// what goes in them, and it is pure so the rule can be run against every
// shape a website puts an address in.
//
// ══ Strongest evidence wins ═══════════════════════════════════════════════
//
// A `mailto:` link is the business saying "write to us here" (weight 0.9);
// an address found in running text is often the web designer's, a
// photographer's credit, or an image filename that happens to contain an @
// (weight 0.55). Highest confidence first, then the earliest observation,
// so the same evidence always yields the same address.
//
// ══ What is refused ═══════════════════════════════════════════════════════
//
// Placeholders a template ships with (example@example.com, email@domain.com,
// yourname@yourdomain.com), retina image names (logo@2x.png), addresses at
// hosts that are not mailboxes (sentry.io, wixpress.com, w3.org), and
// anything that is not shaped like an address once the mailto: prefix and
// its ?subject= tail are stripped. A refusal returns null; a null is "the
// crawler saw no usable address", never a guess.

/** The evidence detector ids this file reads. Mirrors capabilityDetect.js. */
export const EMAIL_EVIDENCE_IDS = Object.freeze(["mailto", "email_in_text"]);

/** Placeholder local parts and hosts that are never a business's mailbox. */
const PLACEHOLDER_LOCAL = /^(?:example|email|yourname|your-?email|name|user|username|test|info@example|someone|firstname|first\.last|john\.?doe|jane\.?doe|admin@example|contact@example|mail@example|noreply|no-reply|donotreply|do-not-reply)$/i;
const PLACEHOLDER_HOST = /(?:^|\.)(?:example\.(?:com|org|net)|domain\.com|yourdomain\.com|yourcompany\.com|email\.com|test\.com|company\.com|website\.com|mail\.com|sentry\.io|sentry-next\.wixpress\.com|wixpress\.com|w3\.org|schema\.org|googleapis\.com|gstatic\.com|cloudfront\.net|akamaihd\.net|squarespace\.com|wordpress\.com|wp\.com|jquery\.com|github\.com|npmjs\.com|unpkg\.com|jsdelivr\.net)$/i;
/** An @ inside a filename: logo@2x.png, hero@3x.jpg. */
const IMAGE_TLD = /\.(?:png|jpe?g|gif|svg|webp|avif|ico|css|js|mjs|json|woff2?|ttf|otf|mp4|webm|pdf)$/i;
const RETINA = /@[0-9](?:\.[0-9])?x\b/i;

const SHAPE = /^[a-z0-9][a-z0-9._%+'-]{0,63}@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/i;

/**
 * One address out of one evidence value, or null.
 *
 * Handles the shapes the detector stores: "mailto:info@x.com",
 * "mailto:info@x.com?subject=Quote", "MAILTO:Info@X.com", a bare address, and
 * an address with surrounding punctuation from the text match.
 */
export function normaliseEmailEvidence(rawValue) {
  let s = typeof rawValue === "string" ? rawValue.trim() : "";
  if (!s) return null;
  s = s.replace(/^mailto:/i, "");
  s = s.split(/[?#]/)[0];
  s = s.replace(/^[\s<("'[]+|[\s>)"'\].,;:]+$/g, "").trim().toLowerCase();
  if (!s || !SHAPE.test(s)) return null;
  if (RETINA.test(s) || IMAGE_TLD.test(s)) return null;
  const [local, host] = s.split("@");
  if (PLACEHOLDER_LOCAL.test(local) || PLACEHOLDER_HOST.test(host)) return null;
  // "email@domain.com"-style templates: both halves generic.
  if (/^(?:email|mail|info|contact)$/i.test(local) && /^(?:domain|yourdomain|example|website|company)\./i.test(host)) return null;
  return s;
}

/**
 * The address to write on the prospect, from its EMAIL_CONTACT evidence.
 *
 * @param rows  ProspectEvidence rows: { rawValue, confidence, observedAt,
 *              type, normalizedValue, detector }. Only rows whose value
 *              normalises to an address count; the rest are ignored, so a
 *              caller may hand over every evidence row it has.
 * @returns { email, emailSource, confidence } or null.
 *
 * `emailSource` is the detector id of the winning row — "mailto" or
 * "email_in_text" — so a reader can see how sure to be. It is derived from
 * the row's shape (a `link` row starting mailto: is the mailto detector; a
 * `page_content` row is the text match) because ProspectEvidence stores the
 * capability detector's NAME, not the signal id, and the signal id is what
 * says which of the two found it.
 */
export function emailFromEvidence(rows) {
  const candidates = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    const raw = typeof r?.rawValue === "string" ? r.rawValue : "";
    if (!raw || !/@/.test(raw)) continue;
    // Only the two shapes the EMAIL_CONTACT detectors write. A JSON `link`
    // row from the crawl extractor or a technology fingerprint that happens
    // to contain an @ is not an address the business published.
    const isMailto = /^mailto:/i.test(raw.trim());
    const isText = r.type === "page_content" && !raw.trim().startsWith("{");
    if (!isMailto && !isText) continue;
    const email = normaliseEmailEvidence(raw);
    if (!email) continue;
    candidates.push({
      email,
      emailSource: isMailto ? "mailto" : "email_in_text",
      confidence: Number.isFinite(Number(r.confidence)) ? Number(r.confidence) : isMailto ? 0.9 : 0.55,
      observedAt: r.observedAt ? new Date(r.observedAt).getTime() : Number.MAX_SAFE_INTEGER,
    });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.confidence - a.confidence || a.observedAt - b.observedAt || a.email.localeCompare(b.email));
  const { email, emailSource, confidence } = candidates[0];
  return { email, emailSource, confidence };
}
