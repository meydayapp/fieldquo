// lib/estimate/financing.js
//
// Whether, and how, a company offers financing to a homeowner.
//
// ══ FieldQuo never invents a monthly payment ═══════════════════════════════
//
// This is the whole point of the file, and it's why it doesn't do any maths.
// FieldQuo does not provide financing. So a "$182/month" figure computed here —
// the way the original cabinet site did it, at a hardcoded 15% APR — is a term
// the CONTRACTOR would be held to that nobody at the contractor ever agreed. It
// is the same failure as the phone agent quoting a price the business hasn't
// seen, and it's refused the same way: there is no APR, no term, no payment
// calculation anywhere in this module.
//
// What a company CAN do is one of two honest things:
//
//   contact   "We offer financing — ask us." Their own wording, their own
//             terms, arranged directly with them. No number from us.
//   provider  A hand-off to a real financing provider (Shop Pay, Affirm, a
//             bank). The PROVIDER quotes the terms on their own page; we only
//             send the homeowner there. Still no number from us.
//
// Off by default, because most contractors don't finance and a financing
// mention they didn't ask for reads as a promise.
//
// Pure. Give it the company's saved setting; it returns what's safe to show.

/** http(s) only — a `javascript:`/`data:` URL under a contractor's brand is their reputation. */
function safeHttpUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * What to show a homeowner about financing, or null.
 *
 * @param financing  the company's saved setting:
 *                   { enabled, note, url }  — url present means "provider"
 * @param {object} opts { language }
 * @returns null when off, else:
 *   { mode: "contact"|"provider", note: string|null, url: string|null }
 *
 * Note that there is NO monthly figure, APR or term in the return shape. There
 * is nowhere for one to come from, by design.
 */
export function financingOffer(financing, { language = "en" } = {}) {
  if (!financing || typeof financing !== "object" || !financing.enabled) return null;

  const url = safeHttpUrl(financing.url);
  const note =
    typeof financing.note === "string" && financing.note.trim()
      ? financing.note.trim().slice(0, 400)
      : null;

  // A provider hand-off needs a working link; without one it's really the
  // "ask us" case, so it degrades to contact rather than showing a dead button.
  const mode = url ? "provider" : "contact";

  // Never blank: if the company enabled financing but wrote no note, fall back
  // to a plain, true sentence — "available, ask us" — that promises no terms.
  const fallbackNote =
    language === "fr"
      ? "Du financement est disponible — demandez-nous les détails."
      : "Financing is available — ask us for details.";

  return { mode, note: note || fallbackNote, url };
}

/** The call-to-action label for a provider hand-off, per language. */
export function financingCtaLabel(language = "en") {
  return language === "fr" ? "Voir les options de financement" : "See financing options";
}

/**
 * Normalise a submitted financing setting for storage.
 *
 * Clamps the note, validates the URL (dropped if not http(s)), and coerces
 * enabled to a real boolean — so a malformed save can't store a
 * `javascript:` URL or a novel-length note.
 */
export function normaliseFinancing(input) {
  if (!input || typeof input !== "object") return { enabled: false };
  return {
    enabled: Boolean(input.enabled),
    note:
      typeof input.note === "string" && input.note.trim()
        ? input.note.trim().slice(0, 400)
        : null,
    url: safeHttpUrl(input.url),
  };
}
