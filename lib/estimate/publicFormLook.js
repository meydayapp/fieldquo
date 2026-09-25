// lib/estimate/publicFormLook.js
//
// The look a public form page hands its flow: the company's saved appearance
// and the brand it derives from, read on the SERVER at render time.
//
// ── Why the server and not a URL parameter ─────────────────────────────────
//
// The embed sits on a website FieldQuo does not control, inside an iframe
// whose src is a string somebody pasted. Anything the look took from that
// URL could be changed by whoever writes the page — a dark form on a light
// site, an unreadable one — under the contractor's own name. So the look
// travels in the server-rendered page, from the company row, and the public
// routes read nothing about it from the request. The same applies to the
// standalone pages, for symmetry and for first paint: the font link is in the
// HTML before the flow has fetched anything.
//
// Null when the company does not resolve; the pages already 404 or let the
// flow say "not found" in that case, and a null look is the default look.

import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import { normaliseFormAppearance, isDefaultAppearance } from "@/lib/estimate/formAppearance";

/**
 * @returns {{ appearance: object, brandColor: string|null }|null}
 *   `appearance` is normalised; the flows treat the default as "no look".
 */
export async function loadPublicFormLook(companySlug) {
  const company = await findBookingCompany(companySlug, {
    brandColor: true,
    publicFormAppearance: true,
  }).catch(() => null);
  if (!company) return null;
  const { appearance } = normaliseFormAppearance(company.publicFormAppearance);
  if (isDefaultAppearance(appearance)) return null;
  return { appearance, brandColor: company.brandColor || null };
}
