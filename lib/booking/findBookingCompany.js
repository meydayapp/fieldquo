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

export async function findBookingCompany(slug, select) {
  if (!slug) return null;

  const byBookingSlug = await db.company.findUnique({
    where: { bookingSlug: slug },
    ...(select ? { select } : {}),
  });
  if (byBookingSlug) return byBookingSlug;

  return db.company.findUnique({
    where: { slug },
    ...(select ? { select } : {}),
  });
}
