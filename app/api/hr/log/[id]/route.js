// app/api/hr/log/[id]/route.js — the author corrects their own entry. Not
// somebody else's: a day book is a signed statement, and editing another
// manager's line is putting words in their mouth. No DELETE.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hrManagerOrRefusal } from "@/lib/hr/gate";
import { parseLogBody, LOG_SELECT } from "@/lib/hr/log";

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await hrManagerOrRefusal(request);
  if (response) return response;
  const existing = await db.managerLogEntry.findFirst({ where: { id, companyId: member.companyId }, select: { id: true, authorMemberId: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.authorMemberId !== member.id) return NextResponse.json({ error: "Only the person who wrote an entry can change it." }, { status: 403 });
  const raw = await request.json().catch(() => ({}));
  const parsed = parseLogBody(raw);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (Object.keys(parsed.data).length === 0) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  const entry = await db.managerLogEntry.update({ where: { id: existing.id }, data: parsed.data, select: LOG_SELECT });
  return NextResponse.json({ entry });
}
