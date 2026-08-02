// app/api/settings/business-info/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { normaliseHours } from "@/lib/company/businessHours";
import { clampWindow } from "@/lib/booking/arrivalWindow";

/**
 * Coordinates for a stored address that has none.
 *
 * The mini map on Company Settings is gated on latitude/longitude, and those are
 * only written when someone picks an address from the autocomplete. An address
 * that arrived at SIGNUP has neither — so the map said "Enter an address to
 * preview it on the map" while the address fields right above it were filled in,
 * which reads as the page not working.
 *
 * Geocoded once, on read, and persisted so it costs one Google call ever. Silent
 * on failure: no coordinates means no map, which is what the company already had,
 * and a geocoding outage must not stop Company Settings loading.
 */
async function backfillCoordinates(companyId, company) {
  if (!company?.address) return company;
  if (company.latitude != null && company.longitude != null) return company;

  try {
    const { geocodeAddress } = await import("@/lib/measure/roofMeasurement");
    const full = [company.address, company.city, company.province, company.postalCode]
      .filter(Boolean)
      .join(", ");
    const hit = await geocodeAddress(full);
    if (!hit?.lat || !hit?.lng) return company;

    await db.company.update({
      where: { id: companyId },
      data: { latitude: hit.lat, longitude: hit.lng },
    });
    return { ...company, latitude: hit.lat, longitude: hit.lng };
  } catch (err) {
    console.error("[business-info] coordinate backfill failed:", err?.message);
    return company;
  }
}

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: {
      name: true,
      email: true,
      phone: true,
      address: true,
      city: true,
      province: true,
      // New — read-only display of what was picked at signup, see
      // app/app/settings/company/page.js
      industries: true,
      // New — Company Settings page (address autocomplete + mini map)
      postalCode: true,
      country: true,
      latitude: true,
      longitude: true,
      website: true,
      logoUrl: true,
      logoPublicId: true,
      brandColor: true,
      brandColors: true,
      paymentTerms: true,
      defaultProcessNotes: true,
      taxRate: true,
      paymentMethods: true,
      shareAnonymizedPricing: true,
      bookingSlug: true,
      // New — read-only identity used for the {slug}.fieldquo.com preview
      slug: true,
      // New — "Help clients find my business" toggle
      discoverable: true,
      // New — Tax settings
      taxIdName: true,
      taxIdNumber: true,
      autoApplyLocalTax: true,
      taxRates: {
        select: { id: true, name: true, rate: true, isDefault: true },
        orderBy: { createdAt: "asc" },
      },
      // New — Regional settings
      timezone: true,
      dateFormat: true,
      weekStartsOn: true,
      currency: true,
      // When the business is open. Feeds the website's hours block, the
      // "Open now" pill, and openingHoursSpecification in the LocalBusiness
      // JSON-LD — which is what puts opening hours in a Google result.
      businessHours: true,
      defaultVisitMinutes: true,
      bookingModes: true,
      travelCheckEnabled: true,
      travelBufferMinutes: true,
      arrivalWindowMinutes: true,
      // New — website/subdomain publish stub
      sitePublished: true,

      stripeAccountId: true,
      stripeOnboarded: true,
      stripeChargesEnabled: true,
      // Offer Affirm pay-over-time alongside card on the invoice pay page.
      // Opt-in: the connected account must have Affirm activated in Stripe.
      offerFinancing: true,
    },
  });

  // One-time geocode so the map works for an address that came from signup.
  const withCoords = await backfillCoordinates(member.companyId, company);

  return NextResponse.json(withCoords);
}

export async function PATCH(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can edit business info" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const {
    name,
    email,
    phone,
    address,
    city,
    province,
    postalCode,
    country,
    latitude,
    longitude,
    website,
    logoUrl,
    logoPublicId,
    brandColor,
    brandColors,
    paymentTerms,
    defaultProcessNotes,
    taxRate,
    paymentMethods,
    shareAnonymizedPricing,
    discoverable,
    taxIdName,
    taxIdNumber,
    autoApplyLocalTax,
    currency,
    timezone,
    dateFormat,
    weekStartsOn,
    businessHours,
    defaultVisitMinutes,
    bookingModes,
    travelCheckEnabled,
    travelBufferMinutes,
    arrivalWindowMinutes,
    sitePublished,
    offerFinancing,
  } = body;

  // Replacing a logo used to leave the old file on Cloudinary forever. On a
  // shared account that's storage nobody is using and everybody is paying for,
  // and it compounds — a company fiddling with its branding for an afternoon
  // leaves a dozen dead images behind.
  //
  // Deliberately fired before the update and NOT awaited into the response
  // path: if Cloudinary is down or the asset is already gone, the company's
  // branding still saves. A failed cleanup is a housekeeping problem; a failed
  // save is the user's problem.
  if (logoPublicId !== undefined) {
    const current = await db.company.findUnique({
      where: { id: member.companyId },
      select: { logoPublicId: true },
    });

    if (current?.logoPublicId && current.logoPublicId !== logoPublicId) {
      const stale = current.logoPublicId;
      import("@/lib/cloudinary")
        .then(({ deleteAsset }) => deleteAsset(stale))
        .catch((err) =>
          console.error("[branding] couldn't remove old logo:", err?.message),
        );
    }
  }

  // An address typed by hand (rather than picked from the autocomplete) arrives
  // with no coordinates, and stale coordinates from a PREVIOUS address would put
  // the map on the wrong house. So: if the address changed and the caller didn't
  // supply coordinates, look them up.
  let coords = null;
  if (address !== undefined && latitude === undefined && longitude === undefined) {
    const before = await db.company.findUnique({
      where: { id: member.companyId },
      select: { address: true },
    });
    if ((before?.address || "") !== (address || "")) {
      try {
        const { geocodeAddress } = await import("@/lib/measure/roofMeasurement");
        const full = [address, city, province, postalCode].filter(Boolean).join(", ");
        const hit = full ? await geocodeAddress(full) : null;
        // null when it fails, which CLEARS the old coordinates rather than
        // leaving the map pointing at the previous address.
        coords = { latitude: hit?.lat ?? null, longitude: hit?.lng ?? null };
      } catch (err) {
        console.error("[business-info] geocode on save failed:", err?.message);
        coords = { latitude: null, longitude: null };
      }
    }
  }

  const updated = await db.company.update({
    where: { id: member.companyId },
    data: {
      ...(coords || {}),
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(address !== undefined && { address }),
      ...(city !== undefined && { city }),
      ...(province !== undefined && { province }),
      ...(postalCode !== undefined && { postalCode }),
      ...(country !== undefined && { country }),
      ...(latitude !== undefined && { latitude }),
      ...(longitude !== undefined && { longitude }),
      ...(website !== undefined && { website }),
      ...(logoUrl !== undefined && { logoUrl }),
      ...(logoPublicId !== undefined && { logoPublicId }),
      ...(brandColor !== undefined && { brandColor }),
      ...(brandColors !== undefined && { brandColors }),
      ...(paymentTerms !== undefined && { paymentTerms }),
      ...(defaultProcessNotes !== undefined && { defaultProcessNotes }),
      ...(taxRate !== undefined && { taxRate }),
      ...(paymentMethods !== undefined && { paymentMethods }),
      ...(shareAnonymizedPricing !== undefined && { shareAnonymizedPricing }),
      ...(discoverable !== undefined && { discoverable }),
      ...(taxIdName !== undefined && { taxIdName }),
      ...(taxIdNumber !== undefined && { taxIdNumber }),
      ...(autoApplyLocalTax !== undefined && { autoApplyLocalTax }),
      ...(timezone !== undefined && { timezone }),
      ...(dateFormat !== undefined && { dateFormat }),
      ...(weekStartsOn !== undefined && { weekStartsOn }),
      // Clamped to a sane range rather than trusted: a 0-minute visit makes
      // computeAvailability emit infinite slots, and a 10-hour one emits none.
      ...(defaultVisitMinutes !== undefined && {
        defaultVisitMinutes: Math.min(480, Math.max(10, Number(defaultVisitMinutes) || 60)),
      }),
      // Filtered to the known set, and never allowed to be empty: a company with
      // no bookable modes has a booking page that cannot be completed. Falls back
      // to a site visit, which is the default for a field trade.
      ...(Array.isArray(bookingModes) && {
        bookingModes: (() => {
          const clean = bookingModes.filter((m) => ["call", "visit", "video"].includes(m));
          return clean.length ? clean : ["visit"];
        })(),
      }),
      ...(travelCheckEnabled !== undefined && {
        travelCheckEnabled: Boolean(travelCheckEnabled),
      }),
      // Clamped, not trusted. This number ADDS to the drive between jobs, so a
      // fat-fingered 600 would quietly empty the booking page — every slot
      // ten hours from the last one. Two hours is already generous for
      // parking, unloading and writing up the previous job.
      ...(travelBufferMinutes !== undefined && {
        travelBufferMinutes: Math.min(120, Math.max(0, Math.round(Number(travelBufferMinutes) || 0))),
      }),
      // Clamped by the same helper the renderer uses, so what's stored and
      // what's shown can't disagree.
      ...(arrivalWindowMinutes !== undefined && {
        arrivalWindowMinutes: clampWindow(arrivalWindowMinutes),
      }),
      ...(currency !== undefined && { currency }),
      // Normalised on the way in, not trusted. This column is read by the
      // public website and by the structured data a search engine indexes, so
      // a close time earlier than the open time would become a Google listing
      // that says "Closes 8 AM". normaliseHours treats that as closed rather
      // than guessing which of the two numbers was the typo.
      //
      // `null` is meaningful and distinct from an empty array: it means "never
      // told us", which renders as nothing. Seven closed days means "shut all
      // week", which renders as a table of closures.
      ...(businessHours !== undefined && {
        businessHours:
          businessHours === null ? null : normaliseHours(businessHours),
      }),
      ...(sitePublished !== undefined && { sitePublished }),
      ...(offerFinancing !== undefined && {
        offerFinancing: Boolean(offerFinancing),
      }),
    },
  });

  // Record which fields changed — enough for support to answer "who changed
  // the tax rate / branding / hours", without dumping full before/after values.
  const changed = Object.keys(body).filter((k) => body[k] !== undefined);
  await recordActivity(member, {
    action: "settings.business_info_updated",
    entityType: "settings",
    summary: `Updated business settings: ${changed.join(", ") || "—"}`,
    metadata: { fields: changed },
  });

  return NextResponse.json(updated);
}
