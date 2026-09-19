// app/api/work-areas/[id]/polygon/route.js
//
// PUT { polygon: [{ lat, lng }, ...] | null } — the zone as drawn on
// Settings → Work areas, or cleared.
//
// Gated on `workarea:assign`, the same permission that creates a work area
// and moves people between them: whoever decides whose patch a street is
// may draw the patch. Everyone else sees the polygon read-only (GET
// /api/work-areas returns it to anyone on the company) and the page offers
// them no drawing tool.
//
// Scoped to the company before the write, as every /api/work-areas write
// is: an id from another tenant misses with a 404, never a 403 that says
// the row exists.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { normalisePolygon } from "@/lib/workAreas/polygon";

export async function PUT(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "workarea:assign");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const { id } = await params;
  const existing = await db.workArea.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send JSON." }, { status: 400 });
  }
  const parsed = normalisePolygon(body?.polygon);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const updated = await db.workArea.update({
    where: { id },
    // A Json column is cleared with Prisma.DbNull (a SQL NULL), never a bare
    // null, which Prisma refuses for Json — the invoice routes do the same.
    data: { polygon: parsed.polygon === null ? Prisma.DbNull : parsed.polygon },
    include: {
      assignments: { include: { user: { select: { id: true, name: true } } } },
    },
  });

  return NextResponse.json(updated);
}
