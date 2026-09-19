// app/api/schedule/map/route.js
//
// One day of the calendar, as the map needs it: the same rows GET
// /api/appointments would give this caller, on one day, plus where to centre
// and a bounded geocode backfill.
//
// ── Same rows, same caller ─────────────────────────────────────────────────
//
// No scoping is written here. lib/schedule/feed.js is the ONE reader of the
// three tables and it takes the caller's grid; this route only adds the
// day's bounds. An owner sees everyone, a member on view_own sees their own
// rows plus the unassigned appointments the calendar already shows them,
// Crew see their own jobs' stops with the client redacted to name and
// address — because that is what the feed hands back, and the check
// (scripts/check-schedule-map.mjs) executes this route as each of them.
//
// ── The day is the company's day ───────────────────────────────────────────
//
// `?day=YYYY-MM-DD` is a wall-clock date in the company's timezone, bounded
// [midnight, next midnight) there — lib/booking/timezone.js, the same
// arithmetic the booking page uses. Midnight UTC would put a Toronto
// company's 8pm visit on tomorrow's map.
//
// ── The backfill spends, so it is bounded ──────────────────────────────────
//
// The booking flow wrote coordinates for years; the office's own calendar
// bookings were never geocoded. Rather than a migration nobody scheduled,
// the first map load of a day tries the rows on it that have an address and
// were never tried — `needsGeocode` — up to GEOCODE_BACKFILL_CAP of them, in
// parallel, each bounded by the wrapper's own timeout. A row that was tried
// and refused (a town centroid) is stamped and not asked again. The response
// says how many were tried, placed, and still waiting, so the page can say
// "3 more will be placed next time" instead of nothing.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember } from "@/lib/permissions/enforce";
import { loadScheduleFeed } from "@/lib/schedule/feed";
import { geocodeAppointment, needsGeocode } from "@/lib/geo/geocodeAppointment";
import { ensureCompanyCoordinates } from "@/lib/company/coordinates";
import { DEFAULT_TIMEZONE } from "@/lib/time/wallClock";
import { parseDay, dayBoundsFor, GEOCODE_BACKFILL_CAP } from "@/lib/schedule/mapDay";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const url = new URL(request.url);
  const ymd = parseDay(url.searchParams.get("day"));
  if (!ymd) {
    return NextResponse.json({ error: "day must be YYYY-MM-DD." }, { status: 400 });
  }

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: {
      timezone: true,
      address: true,
      city: true,
      province: true,
      postalCode: true,
      latitude: true,
      longitude: true,
    },
  });
  if (!company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  const { from, to } = dayBoundsFor(ymd, company.timezone);
  const full = await loadEnforceableMember(db, member.id);
  const entries = await loadScheduleFeed(db, member, full, { from, to });

  // ── The backfill, over the rows THIS caller may see ──────────────────────
  //
  // Only appointments: a visit's point is its job's and a booking's was
  // written at booking time. Scoped to the feed rather than the whole day so
  // a crew member's map load never geocodes a stranger's appointment on
  // their behalf — the row is not theirs to touch, even invisibly.
  const waiting = entries.filter((e) => e.kind === "appointment" && needsGeocode(e));
  const batch = waiting.slice(0, GEOCODE_BACKFILL_CAP);
  let placed = 0;
  if (batch.length) {
    const results = await Promise.all(batch.map((e) => geocodeAppointment(db, e)));
    batch.forEach((e, i) => {
      const coords = results[i];
      e.latitude = coords.latitude;
      e.longitude = coords.longitude;
      e.geocodedAt = coords.geocodedAt;
      if (coords.latitude != null) placed += 1;
    });
  }

  const centred = await ensureCompanyCoordinates(db, member.companyId, company);
  const centre =
    centred.latitude != null && centred.longitude != null
      ? { lat: Number(centred.latitude), lng: Number(centred.longitude) }
      : null;

  return NextResponse.json({
    day: `${ymd.year}-${String(ymd.month).padStart(2, "0")}-${String(ymd.day).padStart(2, "0")}`,
    timezone: company.timezone || DEFAULT_TIMEZONE,
    from: from.toISOString(),
    to: to.toISOString(),
    centre,
    entries,
    geocoded: {
      tried: batch.length,
      placed,
      remaining: waiting.length - batch.length,
    },
  });
}
