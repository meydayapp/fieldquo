// app/api/booking/[companySlug]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public — company branding + bookable event types for the public booking page
export async function GET(request, { params }) {
  const company = await db.company.findUnique({
    where: { slug: params.companySlug },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      brandColor: true,
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
