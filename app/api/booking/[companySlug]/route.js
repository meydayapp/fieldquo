// app/api/booking/[companySlug]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import { effectiveBookingFeeCents } from "@/lib/booking/fee";

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
    currency: true,
    // A visit fee can only be charged if the company can actually take card
    // payments (Stripe Connect done). Without it, a paid event type falls back
    // to a free booking — never a fee the visitor is shown but can't be charged.
    stripeChargesEnabled: true,
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
        feeCents: true,
        promoFeeCents: true,
        promoActive: true,
      },
    },
  });

  if (!company) {
    return NextResponse.json(
      { error: "Booking page not found" },
      { status: 404 },
    );
  }

  // Resolve the EFFECTIVE fee per event type server-side (the browser never
  // computes money) via the shared helper the confirm route also uses.
  const eventTypes = (company.eventTypes || []).map((et) => {
    const { feeCents, feeStandardCents } = effectiveBookingFeeCents(company, et);
    return {
      id: et.id,
      name: et.name,
      slug: et.slug,
      durationMinutes: et.durationMinutes,
      location: et.location,
      feeCents,
      feeStandardCents,
    };
  });

  // Don't leak stripeChargesEnabled / raw fee columns to the public page.
  const { stripeChargesEnabled, ...pub } = company;
  return NextResponse.json({ ...pub, eventTypes });
}
