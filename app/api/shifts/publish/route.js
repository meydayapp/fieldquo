// app/api/shifts/publish/route.js
//
// Publish (or unpublish) every draft shift in a date range in one action — the
// "Publish week" button. Publishing is the moment the schedule becomes visible
// to workers, so it's deliberately explicit rather than per-shift-on-create.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { can } from "@/lib/permissions";

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(member.role, "user:manage")) {
    return NextResponse.json({ error: "Only an admin or owner can publish the schedule." }, { status: 403 });
  }

  const { from, to, published = true } = await request.json().catch(() => ({}));
  if (!from || !to) return NextResponse.json({ error: "from and to are required." }, { status: 400 });

  const result = await db.shift.updateMany({
    where: { companyId: member.companyId, start: { gte: new Date(from), lte: new Date(to) } },
    data: { published: Boolean(published) },
  });
  return NextResponse.json({ ok: true, count: result.count, published: Boolean(published) });
}
