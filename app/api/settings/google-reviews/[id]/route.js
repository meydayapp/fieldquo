// app/api/settings/google-reviews/[id]/route.js
//
// PATCH { showOnSite } — the only writable field on a Google review. The
// words, the rating, the name and the date are Google's and stay as fetched.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { refuseUnlessAdmin } from "@/lib/reviews/testimonialAccess";

export async function PATCH(request, { params }) {
  // Next 16: params is a Promise.
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const refusal = refuseUnlessAdmin(member);
  if (refusal) return refusal;

  const body = await request.json().catch(() => ({}));
  if (typeof body.showOnSite !== "boolean") {
    return NextResponse.json({ error: "Only showOnSite can be changed on a Google review." }, { status: 400 });
  }

  const updated = await db.googleReview.updateMany({
    where: { id, companyId: member.companyId },
    data: { showOnSite: body.showOnSite },
  });
  if (updated.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, showOnSite: body.showOnSite });
}
