// app/api/settings/tracking/route.js
//
// The company's own ad-tracking ids — Meta Pixel, Google tag (GA4 / Google
// Ads), TikTok pixel — and whether a visitor must accept before any of them
// loads. Read by the instant estimate's public payload and by every lead
// funnel that has not set its own id (lib/funnels/pixels.js effectivePixels).
//
// Owner/admin, the same as the rest of the instant-quote settings screen this
// card sits on. The ids are public identifiers once live (they are in page
// source on every site that runs them), so the read is open to the platform
// console's impersonation carve-out; the write is not.
//
// A malformed id is REFUSED with the field named, never stored — see
// validateTrackingIdsForWrite for why. Nothing is half-saved: one bad field
// refuses the whole write.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { recordActivity } from "@/lib/activity/log";
import { validateTrackingIdsForWrite, TRACKING_ID_FIELDS } from "@/lib/funnels/pixels";

const isAdmin = (role) => role === "owner" || role === "admin";

const SELECT = { metaPixelId: true, tiktokPixelId: true, ga4Id: true, pixelConsentRequired: true, slug: true };

function shape(row) {
  return {
    metaPixelId: row?.metaPixelId || "",
    tiktokPixelId: row?.tiktokPixelId || "",
    ga4Id: row?.ga4Id || "",
    pixelConsentRequired: Boolean(row?.pixelConsentRequired),
    // For the link builder: /instant-quote/<slug> resolves by the company's
    // slug only (lib/estimate/instantQuoteServer.js), never the booking slug.
    publicSlug: row?.slug || null,
  };
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!member.impersonation && !isAdmin(member.role)) {
    return NextResponse.json({ error: "Only an owner or admin can see ad tracking settings." }, { status: 403 });
  }
  const row = await db.company.findUnique({ where: { id: member.companyId }, select: SELECT });
  return NextResponse.json({ ...shape(row), canEdit: !member.impersonation && isAdmin(member.role) });
}

export async function PUT(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!isAdmin(member.role)) {
    return NextResponse.json({ error: "Only an owner or admin can change ad tracking." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { data, errors } = validateTrackingIdsForWrite(body);
  if (errors.length) {
    return NextResponse.json(
      { error: "One of the ids isn't in the shape the platform issues.", fields: errors },
      { status: 400 },
    );
  }
  if (typeof body.pixelConsentRequired === "boolean") data.pixelConsentRequired = body.pixelConsentRequired;
  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const row = await db.company.update({ where: { id: member.companyId }, data, select: SELECT });
  const changed = [...TRACKING_ID_FIELDS, "pixelConsentRequired"].filter((k) => Object.hasOwn(data, k));
  await recordActivity(member, {
    action: "settings.tracking_updated",
    entityType: "company",
    entityId: member.companyId,
    summary: `Updated ad tracking (${changed.join(", ")})`,
  });
  return NextResponse.json({ ...shape(row), canEdit: true });
}
