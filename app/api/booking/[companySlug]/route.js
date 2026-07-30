// app/api/booking/[companySlug]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";

// Public — company branding + bookable event types for the public booking page
export async function GET(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const company = await findBookingCompany(_params.companySlug, {
    id: true,
    name: true,
    logoUrl: true,
    brandColor: true,
    phone: true,
    email: true,
    // Which ways a client may meet them. Public on purpose — the visitor has to
    // choose one before booking.
    bookingModes: true,
    eventTypes: {
      where: { active: true },
      select: {
        id: true,
        name: true,
        slug: true,
        durationMinutes: true,
        location: true,
      },
    },
  });

  if (!company) {
    return NextResponse.json(
      { error: "Booking page not found" },
      { status: 404 },
    );
  }

  return NextResponse.json(company);
}
