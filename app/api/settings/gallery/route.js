// app/api/settings/gallery/route.js
//
// The company's ONE before/after gallery (lib/company/gallery.js). GET lists
// it; PUT replaces it with the pairs sent, in that order. Removed pairs are
// soft-removed, never deleted; the files stay on Cloudinary because the
// same upload can sit on the website (see the quote-email route's note).
//
// Every reader — the website block, the quote email, the client proposal —
// reads what this writes, which is the point of there being one.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { loadCompanyGallery, replaceCompanyGallery } from "@/lib/company/gallery";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  return NextResponse.json({ pairs: await loadCompanyGallery(member.companyId) });
}

export async function PUT(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json({ error: "Only owners/admins can change the gallery." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  if (!Array.isArray(body?.pairs)) {
    return NextResponse.json({ error: "pairs must be an array." }, { status: 400 });
  }
  const pairs = await replaceCompanyGallery(member.companyId, body.pairs, { source: "manual" });
  await recordActivity(member, {
    action: "settings.gallery_updated",
    entityType: "company",
    entityId: member.companyId,
    summary: `Set ${pairs.length} before/after pair(s) in the company gallery`,
    metadata: { pairs: pairs.length },
  });
  return NextResponse.json({ pairs });
}
