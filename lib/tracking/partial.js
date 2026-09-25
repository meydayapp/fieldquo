// lib/tracking/partial.js
//
// A homeowner's contact details typed into a company's funnel or instant
// estimate and never sent — the "partial lead" — and the rules for keeping
// it. The shape follows /signup's capture (lib/signup/leads.js
// normaliseCapture / planCaptureWrite): refuse rather than repair, keep a
// value the visitor typed even when a later capture arrives blank, and set
// the consent moment once.
//
// ══ On what basis ══════════════════════════════════════════════════════════
//
// /signup keeps what a business owner types under the implied consent of a
// business inquiry (CASL s.10(9)(b)), recorded on FieldQuo's privacy page.
// A homeowner on a contractor's estimate page is making the same kind of
// inquiry of THAT contractor — but nothing on a contractor's page may point
// at FieldQuo's privacy policy, so the notice is on the form itself, beside
// the fields, in the visitor's language: "We save what you type so <Company>
// can follow up" (lib/i18n/trackingCopy.js saveNotice). The browser only
// captures once that sentence is rendered, and posts `notice: true` with it;
// a capture without it is refused.
//
// What the notice promises is exactly what happens: the company can see it
// and choose to call. The system itself never emails, texts or rings a
// partial — it is not a LeadRequest, so no notification, no scoring, no
// follow-up rule and no outbound voice queue can reach it.
//
// ══ How long ═══════════════════════════════════════════════════════════════
//
// PARTIAL_EXPIRE_DAYS after the details were typed, a partial is flagged
// expired and hidden: a call about an estimate somebody abandoned five weeks
// ago reads as being watched, not helped, and the same thirty-day window
// governs /signup's own follow-up (lib/signup/abandoned.js NUDGE_WINDOW_DAYS).
// Flagged, not deleted — the owner's rule is that FieldQuo deletes nothing.

import { isValidEmail } from "@/lib/validation";
import { containsMarkupCharacters } from "@/lib/security/rejectMarkupCharacters";

export const PARTIAL_EXPIRE_DAYS = 30;
export const PARTIAL_EXPIRE_MS = PARTIAL_EXPIRE_DAYS * 24 * 60 * 60 * 1000;

/** Browser-side: how long after the last keystroke a capture is posted. */
export const PARTIAL_DEBOUNCE_MS = 1500;

function text(value, max) {
  if (typeof value !== "string") return null;
  const v = value.replace(/\s+/g, " ").trim().slice(0, max);
  return v || null;
}

/**
 * A phone as typed, kept only when it has the digits of a real number
 * (7 to 15, E.164's range). Stored as typed rather than normalised: the
 * company rings it from their own phone, and a guessed country code on a
 * number the homeowner typed without one is a number that no longer
 * connects.
 */
export function cleanPartialPhone(value) {
  const v = text(value, 40);
  if (!v) return null;
  if (!/^[+()\d\s.\-]+$/.test(v)) return null;
  const digits = v.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 ? v : null;
}

/**
 * What the browser posted as contact details, or { error }. Needs an email
 * that is one, or a phone that is one: a name alone cannot be followed up,
 * and keeping it would be keeping something about a person for no purpose.
 */
export function normalisePartialContact(body = {}) {
  const b = body && typeof body === "object" ? body : {};
  if (b.notice !== true) return { error: "notice" };
  const name = text(b.name, 120);
  if (name && containsMarkupCharacters(name)) return { error: "name" };
  const emailRaw = text(b.email, 254);
  const email = emailRaw && isValidEmail(emailRaw) ? emailRaw.toLowerCase() : null;
  const phone = cleanPartialPhone(b.phone);
  if (!email && !phone) return { error: "contact" };
  return { contact: { name, email, phone } };
}

/**
 * The columns to write for a capture against the stored visit, or null when
 * nothing may be written. A visit that has become a lead is finished — the
 * lead holds what they sent, and a later keystroke on the thank-you screen
 * must not rewrite it.
 */
export function planPartialWrite(existing, contact, now = new Date()) {
  if (!contact || existing?.completedAt || existing?.leadId) return null;
  return {
    contactName: contact.name ?? existing?.contactName ?? null,
    contactEmail: contact.email ?? existing?.contactEmail ?? null,
    contactPhone: contact.phone ?? existing?.contactPhone ?? null,
    contactAt: existing?.contactAt ?? now,
  };
}

/** Is this partial past its window? */
export function partialExpired(visit, now = new Date()) {
  if (!visit?.contactAt) return false;
  if (visit.partialExpiredAt) return true;
  return now.getTime() - new Date(visit.contactAt).getTime() > PARTIAL_EXPIRE_MS;
}

/** The Prisma WHERE for partials still inside their window. */
export function livePartialWhere(companyId, now = new Date()) {
  return {
    companyId,
    contactAt: { gte: new Date(now.getTime() - PARTIAL_EXPIRE_MS) },
    completedAt: null,
    partialExpiredAt: null,
  };
}

/** The Prisma WHERE for partials that have gone stale and are not yet flagged. */
export function stalePartialWhere(companyId, now = new Date()) {
  return {
    companyId,
    contactAt: { lt: new Date(now.getTime() - PARTIAL_EXPIRE_MS) },
    completedAt: null,
    partialExpiredAt: null,
  };
}
