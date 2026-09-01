// app/api/safety-incidents/[id]/photos/route.js
//
// File a photo against a safety incident. Does NOT upload anything —
// /api/upload already owns that (signed, authenticated, foldered per
// company), same as app/api/jobs/[id]/photos/route.js; the browser posts the
// file there first and hands us the resulting URL.
//
// ── Why this reuses JobPhoto instead of a second photo table ───────────────
//
// Same Cloudinary pipeline, and — the reason that actually matters — the same
// "issue" stage that already never reaches the public gallery, the marketing
// AI's image context, the website builder's image picker, or any signed
// client-facing PDF (see lib/gallery/stages.js and every consumer listed in
// its header). Building a second photo table would mean re-proving that
// exclusion in every one of those places; reusing JobPhoto means it was
// already proven. `stage` is hardcoded to "issue" here — never accepted from
// the request — so this cannot be pointed anywhere else by a crafted call.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { scopeFilter } from "@/lib/permissions/enforce";

export async function POST(request, { params }) {
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Same floor as filing the report itself — a crew member attaching a photo
  // to the incident they just reported is not a higher-trust action than
  // filing it.
  const { full, response: denied } = await levelOrRefusal(
    member,
    "safety",
    "report_own",
    "add photos to a safety incident",
  );
  if (denied) return denied;

  const incident = await db.safetyIncident.findFirst({
    where: {
      id: _params.id,
      companyId: member.companyId,
      ...scopeFilter(full, "safety", "reportedByMemberId", full?.id),
    },
    select: { id: true },
  });
  if (!incident) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const items = Array.isArray(body?.photos) ? body.photos : [];

  // https only, length-capped — same rule app/api/jobs/[id]/photos/route.js
  // applies to the same shape of input.
  const rows = items
    .map((it) => ({
      url: typeof it?.url === "string" ? it.url.trim().slice(0, 500) : "",
      caption: typeof it?.caption === "string" ? it.caption.trim().slice(0, 200) || null : null,
    }))
    .filter((r) => /^https:\/\//.test(r.url))
    .slice(0, 20);

  if (!rows.length) {
    return NextResponse.json(
      { error: "No usable photo in that upload.", reason: "no_photos" },
      { status: 400 },
    );
  }

  await db.jobPhoto.createMany({
    data: rows.map((r) => ({
      ...r,
      companyId: member.companyId,
      safetyIncidentId: incident.id,
      stage: "issue",
    })),
  });

  const photos = await db.jobPhoto.findMany({
    where: { safetyIncidentId: incident.id, companyId: member.companyId },
    orderBy: { createdAt: "desc" },
    select: { id: true, url: true, caption: true, createdAt: true },
  });

  return NextResponse.json({ photos }, { status: 201 });
}
