// app/api/settings/gallery/route.js
//
// The company's ONE before/after gallery (lib/company/gallery.js). GET lists
// it; PUT replaces it with the pairs sent, in that order. Removed pairs are
// soft-removed, never deleted; the files stay on Cloudinary because the
// same upload can sit on the website (see the quote-email route's note).
//
// Every reader — the website block, the quote email, the client proposal —
// reads what this writes, which is the point of there being one.
//
// ── The unfinished pair (2026-09-25) ────────────────────────────────────────
//
// GET also answers `draft` — the one pair with only a before (or only an
// after) uploaded — and PUT takes `draft` alongside or instead of `pairs`:
// an object stores it, null clears it. Completing a pair sends both in ONE
// request ({ pairs: [...old, finished], draft: null }); pairs are written
// first, so a failure leaves the draft in place to retry from rather than
// losing the photo. The draft lives in its own column, never in the gallery
// rows the client-facing surfaces read.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { loadCompanyGallery, replaceCompanyGallery, loadGalleryDraft, saveGalleryDraft } from "@/lib/company/gallery";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const [pairs, draft] = await Promise.all([
    loadCompanyGallery(member.companyId),
    loadGalleryDraft(member.companyId),
  ]);
  return NextResponse.json({ pairs, draft });
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
  const hasPairs = Boolean(body) && Object.prototype.hasOwnProperty.call(body, "pairs");
  const hasDraft = Boolean(body) && Object.prototype.hasOwnProperty.call(body, "draft");
  if (!hasPairs && !hasDraft) {
    return NextResponse.json({ error: "pairs must be an array." }, { status: 400 });
  }
  if (hasPairs && !Array.isArray(body.pairs)) {
    return NextResponse.json({ error: "pairs must be an array." }, { status: 400 });
  }
  if (hasDraft && body.draft !== null && typeof body.draft !== "object") {
    return NextResponse.json({ error: "draft must be an object or null." }, { status: 400 });
  }

  let pairs = null;
  if (hasPairs) {
    pairs = await replaceCompanyGallery(member.companyId, body.pairs, { source: "manual" });
    await recordActivity(member, {
      action: "settings.gallery_updated",
      entityType: "company",
      entityId: member.companyId,
      summary: `Set ${pairs.length} before/after pair(s) in the company gallery`,
      metadata: { pairs: pairs.length },
    });
  }
  const draft = hasDraft
    ? await saveGalleryDraft(member.companyId, body.draft)
    : await loadGalleryDraft(member.companyId);
  if (!pairs) pairs = await loadCompanyGallery(member.companyId);
  return NextResponse.json({ pairs, draft });
}
