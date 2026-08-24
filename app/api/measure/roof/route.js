// app/api/measure/roof/route.js
//
// Roof geometry for the quote builder's roofing takeoff: area, pitch and how
// cut-up the roof is, from the client's address.
//
// The measurement itself already existed for the public instant quote
// (lib/measure/roofMeasurement.js). This route is the same call behind
// getCurrentMember, for the estimator's side of the product — the alternative
// was the builder posting to the public instant-quote endpoint, which would
// have meant an authenticated screen depending on a surface whose whole design
// constraint is that it must never return a price.
//
// The Google key never reaches the browser. Same rule, same reason, as
// /api/measure/satellite: GOOGLE_MAPS_SERVER_KEY is unrestricted and unlocks
// billable APIs, so it stays on this side of the wire.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/currentMember";
import { measureRoof } from "@/lib/measure/roofMeasurement";

/** Human text per machine reason, so the UI can show something and branch on something. */
const REASONS = {
  no_key: {
    status: 503,
    message:
      "Satellite roof measuring isn't configured. Set GOOGLE_MAPS_SERVER_KEY (with Geocoding and Solar enabled) and redeploy.",
  },
  no_address: {
    status: 400,
    message: "This client has no address to measure.",
  },
  geocode_failed: {
    status: 404,
    message: "We couldn't find that address. Enter the roof area by hand.",
  },
  no_roof_coverage: {
    status: 422,
    message:
      "Google has no roof model for this building. Enter the area and pitch by hand.",
  },
  unparseable: {
    status: 422,
    message: "The roof model came back unreadable. Enter the area by hand.",
  },
};

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const address = (
    new URL(request.url).searchParams.get("address") || ""
  ).trim();
  if (!address) {
    const r = REASONS.no_address;
    return NextResponse.json(
      { ok: false, reason: "no_address", message: r.message },
      { status: r.status },
    );
  }

  const result = await measureRoof(address);
  if (result?.ok) return NextResponse.json(result);

  // Every miss gets a verdict the takeoff can render. Falling through to a
  // generic 500 would leave the estimator with a spinner and no idea whether
  // to keep waiting or start typing.
  const r = REASONS[result?.reason] || {
    status: 502,
    message: "Roof measuring is unavailable right now. Enter the area by hand.",
  };
  return NextResponse.json(
    { ...result, ok: false, message: r.message },
    { status: r.status },
  );
}
