// app/api/service-area/[companySlug]/route.js
//
// Public, unauthenticated: "is this address inside the company's service
// area?" — the one question the booking page and the instant estimate ask
// before the homeowner presses Send. Both flows call this; the answer shape
// is the contract they render from, so it must not change without them.
//
//   GET /api/service-area/<slug>?address=…[&postalCode=…]
//
//   { configured: false }                       — the company never said
//   { configured: true, inside: true|false|null,
//     radiusKm, city, distanceKm }              — inside / outside / unknown
//
// `inside: null` is "we could not tell" (the address did not geocode and
// carried no postal code), and the flows say nothing for it — "we don't know"
// must never render as "outside". The rule itself is lib/company/serviceArea.js.
//
// ── What never leaves ─────────────────────────────────────────────────────
//
// The company's own coordinates. A stranger can already read the city off the
// public page, but the base lat/lng is where the owner's van sleeps, and the
// answer needs none of it: the distance is computed here and only the number
// is returned. scripts/check-service-area.mjs asserts, from the source, that
// no response of this file carries `latitude` or `longitude`.
//
// The address is geocoded server-side with the same Google call the roof
// measurement uses, once per request. Rate-limited like every other public
// route, because each call is a paid geocode and a loop over this endpoint
// is a bill.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import { geocodeAddress } from "@/lib/measure/roofMeasurement";
import {
  checkServiceArea,
  cleanRadiusKm,
  postalCodeFromAddress,
  serviceAreaConfigured,
} from "@/lib/company/serviceArea";

// A short address is a street name, and geocoding it returns the middle of a
// road — a verdict about nothing. Anything longer is capped so a hostile query
// string cannot be forwarded to Google whole.
const MIN_ADDRESS_CHARS = 5;
const MAX_ADDRESS_CHARS = 300;

export async function GET(request, { params }) {
  // Tighter than the lead intakes: a homeowner checks one or two addresses,
  // and every call here is a geocode FieldQuo pays for.
  const limited = rateLimit(request, "service-area", { limit: 30, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;

  const { companySlug } = await params;
  // bookingSlug first, then slug — the booking page addresses a company by
  // whichever the owner chose, and a custom booking slug must not 404 here
  // while the rest of the page works. Same resolver the booking routes use.
  const company = await findBookingCompany(companySlug, {
    name: true,
    city: true,
    latitude: true,
    longitude: true,
    serviceRadiusKm: true,
    servicePostalPrefixes: true,
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Decided BEFORE the address is read: a company with no area set answers
  // "not configured" for every address and never spends a geocode on it.
  if (!serviceAreaConfigured(company)) {
    return NextResponse.json({ configured: false });
  }

  const url = new URL(request.url);
  const address = String(url.searchParams.get("address") || "").trim().slice(0, MAX_ADDRESS_CHARS);
  const postedPostal = String(url.searchParams.get("postalCode") || "").trim().slice(0, 12);

  // Geocoded only when there is an address worth geocoding and the company
  // has a radius to measure against. A prefix-only area needs no pin: the
  // postal code alone decides, and geocoding it would be a paid call whose
  // result nothing reads.
  const radius = cleanRadiusKm(company.serviceRadiusKm);
  const hasBase =
    Number.isFinite(Number(company.latitude)) && Number.isFinite(Number(company.longitude));
  const hit =
    radius && hasBase && address.length >= MIN_ADDRESS_CHARS ? await geocodeAddress(address) : null;

  // The postal code the caller passed wins — the booking form has a field for
  // it — and otherwise it is read out of Google's formatted address, which
  // carries one even when the homeowner typed none, or out of the raw text.
  const postalCode = postedPostal || postalCodeFromAddress(hit?.formattedAddress || address);

  const verdict = checkServiceArea(company, {
    lat: hit?.lat ?? null,
    lng: hit?.lng ?? null,
    postalCode,
  });

  // Exactly these keys. `city` and `radiusKm` are what the outside-area
  // sentence prints ("25 km around Ottawa"); the base coordinates are not
  // returned and must not be added.
  return NextResponse.json({
    configured: true,
    inside: verdict.inside,
    radiusKm: radius && hasBase ? radius : null,
    city: company.city || null,
    distanceKm: verdict.distanceKm,
  });
}
