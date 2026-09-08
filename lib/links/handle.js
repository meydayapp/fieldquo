// lib/links/handle.js
//
// The small muted line under the company's name on the bio-link page — the
// place nxt-lnk puts a username.
//
// A contractor has no username. What they have, sometimes, is a domain of
// their own, and failing that a town; either one is what a visitor would
// type to find them again, which is what the line is for. Nothing else
// qualifies, and when neither exists the line is absent rather than filled
// with the company name again or with "Contractor".
//
// ── Why the FieldQuo site's host never appears here ─────────────────────────
//
// A company whose website is a FieldQuo site has a host of the form
// `northline.fieldquo.com`. Its "Visit our website" row links there when the
// `website` column is empty (lib/links/candidates.js, "Website"), and the
// browser shows that address once the visitor taps — that is the row doing
// its job. Printing the host under the name is different: it puts our
// domain on the second line of the contractor's page, above the fold, for
// everyone who never taps anything — the exact leak the white-label rule
// exists to prevent. So only the `website` column — a domain the contractor
// owns — is eligible, and a FieldQuo-hosted site falls through to the town.
// The row and this line read the same two fields and answer differently on
// purpose: one is a control, the other is a caption.

import { safeUrl } from "./href";

/**
 * @param company  needs `website`, `city`, `province` — all optional
 * @returns a string, or "" when there is nothing honest to print
 */
export function linkPageHandle(company = {}) {
  const c = company && typeof company === "object" ? company : {};

  const own = safeUrl(c.website);
  if (own) {
    try {
      const host = new URL(own).hostname.replace(/^www\./i, "");
      // A bare IP or a localhost is technically a hostname and nothing a
      // visitor should be shown.
      if (host && /[a-z]/i.test(host) && host.includes(".") && !/fieldquo\.com$/i.test(host)) {
        return host.toLowerCase();
      }
    } catch {
      // safeUrl already parsed it; unreachable in practice, harmless if not.
    }
  }

  const place = [c.city, c.province]
    .map((v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : ""))
    .filter(Boolean);
  return place.join(", ").slice(0, 80);
}
