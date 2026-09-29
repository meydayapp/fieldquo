// lib/booking/findBookingCompany.js
//
// Resolves the slug in /book/<slug> to a company.
//
// Both slugs have to work. Settings → Lead Capture Form builds its embed from
// `bookingSlug || slug`, but all three booking API routes looked up
// `where: { slug }` only — so any company that set a custom booking slug got
// an iframe pointing at a 404, and no error anywhere said why.
//
// Prefers an exact bookingSlug match, because that's the one the company chose
// deliberately.

import { db } from "@/lib/db";
import { clientFacingGaps, PROFILE_READINESS_SELECT } from "@/lib/company/profileReadiness";

export async function findBookingCompany(slug, select) {
  if (!slug) return null;
  // The public booking page, the self-quote form and the instant quote all
  // resolve their company here, and every one of them prints the company's
  // name to a stranger and prices in its currency. A company whose welcome
  // business screen is unanswered has neither (lib/company/profileReadiness.js),
  // so it has no public pages yet — not found, exactly like a slug that does
  // not exist.
  const withReadiness = select ? { ...select, ...PROFILE_READINESS_SELECT } : undefined;
  const ready = (c) => (c && clientFacingGaps(c).length === 0 ? c : null);

  const byBookingSlug = await db.company.findUnique({
    where: { bookingSlug: slug },
    ...(withReadiness ? { select: withReadiness } : {}),
  });
  if (byBookingSlug) return ready(byBookingSlug);

  return ready(
    await db.company.findUnique({
      where: { slug },
      ...(withReadiness ? { select: withReadiness } : {}),
    }),
  );
}
