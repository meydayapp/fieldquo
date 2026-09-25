// app/api/complexity-factors/[id]/route.js
//
// DELETE → takes a factor out of the company's library. ARCHIVED, not
//          deleted: the row stays with `archivedAt` set, the list stops
//          offering it, and the lines already copied onto quotes are copies
//          that never pointed at it in the first place.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { response: denied } = await levelOrRefusal(member, "quotes", "view_create_edit", "edit the complexity library");
  if (denied) return denied;

  const existing = await db.complexityFactorPreset.findFirst({
    where: { id, companyId: member.companyId, archivedAt: null },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Factor not found" }, { status: 404 });

  await db.complexityFactorPreset.update({ where: { id }, data: { archivedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
