// app/api/platform/manuals/[id]/route.js
//
// One manual in FieldQuo's shared library.
//
//   PATCH { status?: "live" | "retired", tags?: { brand, modelPattern, category, trade } }
//
// "live" is the review: a company's share (pending) becomes something every
// company's AI team may read only when a platform admin says so here.
// "retired" takes it out of every reply without deleting a byte (no data
// deletion — the row and its pages stay, and "live" brings it back). The
// moves allowed are sharedLibrary.js canMove(); a withdrawn share stays
// withdrawn — that was the company's call.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { cleanTags } from "@/lib/aiEmployee/reference";
import { canMove, platformView } from "@/lib/aiEmployee/sharedLibrary";

export async function PATCH(request, { params }) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    requirePlatformPermission(admin.role, "manual_library:manage");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }
  const { id } = await params;
  const current = await db.sharedManual.findUnique({ where: { id: String(id || "") } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data = {};
  if (body?.status !== undefined) {
    if (!canMove(current.status, body.status)) {
      return NextResponse.json({ error: `A ${current.status} manual can't be made ${body.status}.`, reason: "bad_move" }, { status: 409 });
    }
    data.status = body.status;
    if (body.status === "live") {
      data.reviewedAt = new Date();
      data.reviewedByAdminId = admin.id;
    }
  }
  if (body?.tags && typeof body.tags === "object") {
    const tags = cleanTags({ ...current, ...body.tags });
    if (!tags.brand) return NextResponse.json({ error: "A library manual needs its brand.", field: "brand" }, { status: 400 });
    Object.assign(data, tags);
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  const row = await db.sharedManual.update({ where: { id: current.id }, data });
  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "manual_status_changed",
      ...(current.sharedByCompanyId ? { targetCompanyId: current.sharedByCompanyId } : {}),
      details: { manualId: current.id, from: current.status, to: row.status, tags: body?.tags ? data : undefined },
    },
  }).catch(() => {});
  return NextResponse.json({ manual: platformView(row) });
}
