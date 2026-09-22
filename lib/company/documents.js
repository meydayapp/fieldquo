// lib/company/documents.js
//
// The rules of the company document library (CompanyDocument): what a
// document type is, when a document has expired, which documents a client
// may see, and what a waiver's body must look like.
//
// ── Expiry is measured, and it hides ────────────────────────────────────────
//
// A certificate of insurance a homeowner can open must never be one that
// has lapsed. So `expiresAt` is compared to NOW on every client read — not
// to a flag somebody was supposed to flip — and an expired document is out
// of the proposal the moment the date passes, while /app shows it with an
// "Expired" chip so the company knows to replace it. The expiry date itself
// is never sent to the client: what they see is the company's own one-line
// summary.
//
// ── Pure ────────────────────────────────────────────────────────────────────
//
// No Prisma. scripts/check-client-proposal.mjs executes every function here
// against hostile input (an expiry of "tomorrow", a waiver with two
// acknowledgements, a `javascript:` file URL).

export const DOCUMENT_TYPES = [
  "insurance",
  "licence",
  "wsib",
  "warranty",
  "datasheet",
  "waiver",
  "other",
];

/** Staff-facing labels, by type. The client sees the document's own title. */
export const DOCUMENT_TYPE_LABEL_KEYS = Object.fromEntries(
  DOCUMENT_TYPES.map((t) => [t, `app.companyDocuments.type.${t}`]),
);

const HTTP_URL = /^https?:\/\//i;
const str = (v) => (typeof v === "string" ? v.trim() : "");

export function isDocumentType(value) {
  return DOCUMENT_TYPES.includes(value);
}

/** True when the document carries an expiry date that has passed. */
export function isExpired(doc, now = new Date()) {
  const at = doc?.expiresAt ? new Date(doc.expiresAt) : null;
  if (!at || Number.isNaN(at.getTime())) return false;
  return at.getTime() < now.getTime();
}

/** Expires within `days` — the "renew soon" chip in /app. */
export function expiresSoon(doc, days = 30, now = new Date()) {
  const at = doc?.expiresAt ? new Date(doc.expiresAt) : null;
  if (!at || Number.isNaN(at.getTime())) return false;
  const ms = at.getTime() - now.getTime();
  return ms >= 0 && ms <= days * 86_400_000;
}

/**
 * The documents a client may see on a quote.
 *
 * `ids` is the quote's own selection (Quote.presentation.documentIds) or
 * null for "every document marked show on quotes". A selected id that has
 * since expired or been archived is dropped — the quote's list is a subset
 * of what is allowed, never a way around it.
 *
 * Waivers are not documents to READ here; they are attached and signed
 * through DocumentSignature, so they are excluded from this list.
 */
export function clientVisibleDocuments(docs, { ids = null, now = new Date() } = {}) {
  const want = Array.isArray(ids) ? new Set(ids) : null;
  return (Array.isArray(docs) ? docs : []).filter((d) => {
    if (!d || d.archivedAt) return false;
    if (d.type === "waiver") return false;
    if (!d.showOnQuotes) return false;
    if (!HTTP_URL.test(str(d.fileUrl))) return false;
    if (isExpired(d, now)) return false;
    if (want && !want.has(d.id)) return false;
    return true;
  });
}

/**
 * The client-facing projection of one document. No id, no expiry date, no
 * public id — a title, a line, a type (for the card's icon) and the file.
 */
export function presentDocument(doc) {
  return {
    type: isDocumentType(doc?.type) ? doc.type : "other",
    title: str(doc?.title),
    summary: str(doc?.summary),
    url: str(doc?.fileUrl),
    mimeType: str(doc?.mimeType) || null,
  };
}

// ── Waivers ─────────────────────────────────────────────────────────────────

export const WAIVER_MIN_ACKNOWLEDGEMENTS = 1;
export const WAIVER_MAX_ACKNOWLEDGEMENTS = 5;
export const WAIVER_MAX_SECTIONS = 12;

/**
 * A waiver body, cleaned: { sections: [{ heading, text }], acknowledgements:
 * [string] }. Sections with no text are dropped; acknowledgements are
 * trimmed, deduplicated and capped at five. Returns null when there is no
 * text at all — a waiver with nothing to read is not a waiver.
 *
 * Three to five acknowledgement lines is the mockup's guidance; ONE is the
 * floor enforced here, because a release with a single "I understand" line
 * is still a release the company chose to write, and refusing it would be
 * this file deciding the company's legal wording for it.
 */
export function sanitiseWaiverBody(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const sections = (Array.isArray(src.sections) ? src.sections : [])
    .map((s) => ({ heading: str(s?.heading).slice(0, 200), text: str(s?.text).slice(0, 5000) }))
    .filter((s) => s.text)
    .slice(0, WAIVER_MAX_SECTIONS);
  const acknowledgements = [
    ...new Set(
      (Array.isArray(src.acknowledgements) ? src.acknowledgements : [])
        .map((a) => str(typeof a === "string" ? a : a?.text).slice(0, 500))
        .filter(Boolean),
    ),
  ].slice(0, WAIVER_MAX_ACKNOWLEDGEMENTS);
  if (!sections.length) return null;
  return { sections, acknowledgements };
}

/** True when the waiver can be attached and signed: text plus at least one line to tick. */
export function waiverIsSignable(body) {
  const clean = sanitiseWaiverBody(body);
  return Boolean(clean && clean.acknowledgements.length >= WAIVER_MIN_ACKNOWLEDGEMENTS);
}
