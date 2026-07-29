// app/api/settings/business-info/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { normaliseHours } from "@/lib/company/businessHours";

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
      // When the business is open. Feeds the website's hours block, the
      // "Open now" pill, and openingHoursSpecification in the LocalBusiness
      // JSON-LD — which is what puts opening hours in a Google result.
      businessHours: true,
      // New — website/subdomain publish stub
      sitePublished: true,

      stripeAccountId: true,
      stripeOnboarded: true,
      stripeChargesEnabled: true,
    },
  });

  return NextResponse.json(company);
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
    timezone,
    dateFormat,
    weekStartsOn,
    businessHours,
    sitePublished,
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

  const updated = await db.company.update({
    where: { id: member.companyId },
    data: {
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
    },
  });

  return NextResponse.json(updated);
}
