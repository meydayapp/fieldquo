// app/api/measure/gutters/route.js
//
// Gutter footage and a downspout count for the quote builder's gutter
// takeoff, from the client's address — the same Google Solar roof model
// /api/measure/roof reads, read for its eaves instead of its area
// (lib/measure/gutterMeasurement.js).
//
// A separate route rather than a `?trade=` switch on the roof one because the
// two return different shapes and the panel that calls each branches on its
// own fields; one route answering two shapes is the kind of thing a later
// edit gets half right. Same gate (getCurrentMember, via memberOrRefusal),
// same reason the key never reaches the browser.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { measureGutters } from "@/lib/measure/gutterMeasurement";

/** Human text per machine reason, so the UI can show something and branch on something. */
const REASONS = {
  no_key: {
    status: 503,
    message:
      "Satellite measuring isn't configured. Set GOOGLE_MAPS_SERVER_KEY (with Geocoding and Solar enabled) and redeploy.",
  },
  no_address: { status: 400, message: "This client has no address to measure." },
  geocode_failed: { status: 404, message: "We couldn't find that address. Enter the gutter run by hand." },
  no_roof_coverage: {
    status: 422,
    message: "Google has no roof model for this building. Measure the run by hand.",
  },
  no_linear_geometry: {
    status: 422,
    message: "The roof model here has no edge geometry to read a gutter run off. Measure it by hand.",
  },
  unparseable: { status: 422, message: "The roof model came back unreadable. Measure the run by hand." },
};

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const address = (new URL(request.url).searchParams.get("address") || "").trim();
  if (!address) {
    const r = REASONS.no_address;
    return NextResponse.json({ ok: false, reason: "no_address", message: r.message }, { status: r.status });
  }

  const result = await measureGutters(address);
  if (result?.ok) return NextResponse.json(result);

  const r = REASONS[result?.reason] || {
    status: 502,
    message: "Satellite measuring is unavailable right now. Enter the gutter run by hand.",
  };
  return NextResponse.json({ ...result, ok: false, message: r.message }, { status: r.status });
}
