// app/api/booking/[companySlug]/members/route.js
//
// Public — the "pick your estimator" list behind the Calendly-style booking.
// Returns the company's bookable team members (role can quote + availability
// set), each with the consultation event to book and their next opening.
//
// No availability rate card or private data leaks: just a name, a role title,
// the event slug the confirm step needs, and the next free slot.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import { listBookableMembers } from "@/lib/booking/bookableMembers";

// Human title from the internal role — a homeowner shouldn't see "supervisor".
const ROLE_TITLE = {
  owner: "Owner",
  admin: "Manager",
  supervisor: "Estimator",
  employee: "Estimator",
};

export async function GET(request, { params }) {
  const { companySlug } = await params;

  const company = await findBookingCompany(companySlug, {
    id: true,
    name: true,
    logoUrl: true,
    brandColor: true,
  });
  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const members = await listBookableMembers(company.id);

  return NextResponse.json({
    company: { name: company.name, logoUrl: company.logoUrl, brandColor: company.brandColor },
    members: members.map((m) => ({
      // No userId or memberId to the public — the eventSlug is the handle the
      // booking flow actually needs.
      name: m.name,
      title: ROLE_TITLE[m.role] || "Estimator",
      eventSlug: m.eventSlug,
      durationMinutes: m.durationMinutes,
      nextSlot: m.nextSlot,
    })),
  });
}
