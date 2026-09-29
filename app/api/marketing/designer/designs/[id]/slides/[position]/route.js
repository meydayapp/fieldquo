// app/api/marketing/designer/designs/[id]/slides/[position]/route.js
//
// DELETE — "Remove slide" in the campaign editor's slide strip: carousel slide
// `position` + 1 (position is 1-based over the EXTRA slides, the same number
// the layouts route's ?slide= takes — lib/marketing/slides.js). Slide 1 is the
// design itself and cannot be removed here; deleting the design is its own
// confirmed action on the designer index.
//
// The slides after it move up one, in the same transaction, so the carousel
// the person sees and the one that would be posted never disagree about which
// image is third. Removing a slide changes the post, so the approval
// fingerprint changes with it and a previously approved design reads as
// "changed since approved" — which is true.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { MAX_SLIDES } from "@/lib/marketing/slides";

export async function DELETE(request, { params }) {
  const { id, position: positionParam } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can manage marketing" },
      { status: err.status || 403 },
    );
  }

  const position = Number(positionParam);
  if (!Number.isInteger(position) || position < 1 || position > MAX_SLIDES - 1) {
    return NextResponse.json({ error: "Unknown slide." }, { status: 400 });
  }

  const design = await db.marketingDesign.findUnique({ where: { id }, select: { id: true, companyId: true } });
  if (!design || design.companyId !== member.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const removed = await db.$transaction(async (tx) => {
    const gone = await tx.marketingDesignSlideLayout.deleteMany({ where: { designId: id, position } });
    if (!gone.count) return 0;
    const later = await tx.marketingDesignSlideLayout.findMany({
      where: { designId: id, position: { gt: position } },
      select: { position: true },
      distinct: ["position"],
      orderBy: { position: "asc" },
    });
    // Ascending, one position at a time: each move lands on the number the
    // previous step just freed, so the [designId, position, ratioKey] unique
    // key is never hit mid-shuffle.
    for (const { position: p } of later) {
      // eslint-disable-next-line no-await-in-loop
      await tx.marketingDesignSlideLayout.updateMany({ where: { designId: id, position: p }, data: { position: p - 1 } });
    }
    await tx.marketingDesign.update({ where: { id }, data: { updatedAt: new Date() } });
    return gone.count;
  });

  if (!removed) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
