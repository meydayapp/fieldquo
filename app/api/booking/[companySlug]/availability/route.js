// app/api/booking/[companySlug]/availability/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeAvailableSlots } from "@/lib/booking/computeAvailability";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import { geocodeAddress } from "@/lib/measure/roofMeasurement";

// Public — open slots for a given event type over a date range
// GET /api/booking/acme-cabinets/availability?eventTypeSlug=in-home-consult&from=2026-07-05&to=2026-07-12
export async function GET(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { searchParams } = new URL(request.url);
  const eventTypeSlug = searchParams.get("eventTypeSlug");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!eventTypeSlug || !from || !to) {
    return NextResponse.json(
      { error: "eventTypeSlug, from, and to are required" },
      { status: 400 },
    );
  }

  const company = await findBookingCompany(_params.companySlug);
  if (!company)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const eventType = await db.eventType.findFirst({
    where: { companyId: company.id, slug: eventTypeSlug, active: true },
  });
  if (!eventType)
    return NextResponse.json(
      { error: "Event type not found" },
      { status: 404 },
    );

  // ── Where the visitor wants to be seen ───────────────────────────────────
  //
  // Optional. Given one, slots the estimator can't physically reach from their
  // previous job are removed. Given nothing — a phone consult, or an address
  // not typed yet — the result is exactly what it was before travel time
  // existed, because unknown never filters.
  //
  // Geocoded here, server-side, and echoed back so the confirm step can store
  // the coordinates without paying for a second lookup.
  const address = searchParams.get("address");
  let destination = null;
  let resolvedAddress = null;

  if (address && company.travelCheckEnabled) {
    const hit = await geocodeAddress(address);
    if (hit) {
      destination = { lat: hit.lat, lng: hit.lng };
      resolvedAddress = hit.formattedAddress;
    }
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);

  const maxRangeDays = 60;
  if ((toDate - fromDate) / (1000 * 60 * 60 * 24) > maxRangeDays) {
    return NextResponse.json(
      { error: `Range cannot exceed ${maxRangeDays} days` },
      { status: 400 },
    );
  }

  const slotsByDate = await computeAvailableSlots({
    eventType,
    fromDate,
    toDate,
    destination,
    travelBuffer: company.travelBufferMinutes || 0,
  });

  return NextResponse.json({
    eventType: {
      name: eventType.name,
      durationMinutes: eventType.durationMinutes,
      location: eventType.location,
    },
    slots: slotsByDate,
    // So the UI can say "times you can be reached from" honestly, and say
    // nothing at all when the address didn't resolve. A silent failure here
    // would look identical to a successful one.
    travel: address
      ? {
          applied: Boolean(destination),
          address: resolvedAddress,
          ...(destination || {}),
        }
      : null,
  });
}
