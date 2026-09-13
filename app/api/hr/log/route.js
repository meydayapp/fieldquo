// app/api/hr/log/route.js — the manager's day book. Newest day first;
// ?day=YYYY-MM-DD and ?tag= narrow it. Managers only (user:manage).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hrManagerOrRefusal } from "@/lib/hr/gate";
import { parseLogBody, parseLogFilter, LOG_SELECT, LOG_TAGS } from "@/lib/hr/log";

const PAGE = 100;

export async function GET(request) {
  const { member, response } = await hrManagerOrRefusal(request);
  if (response) return response;
  const filter = parseLogFilter(new URL(request.url).searchParams);
  if (filter.error) return NextResponse.json({ error: filter.error }, { status: 400 });
  const entries = await db.managerLogEntry.findMany({
    where: { companyId: member.companyId, ...filter.where },
    select: LOG_SELECT,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: PAGE,
  });
  // `mine` rather than the member id: the screen needs "may I edit this
  // line", not who wrote it by id.
  return NextResponse.json({
    entries: entries.map(({ authorMemberId, ...e }) => ({ ...e, mine: authorMemberId === member.id })),
    tags: LOG_TAGS,
    truncated: entries.length === PAGE,
  });
}

export async function POST(request) {
  const { member, response } = await hrManagerOrRefusal(request);
  if (response) return response;
  const raw = await request.json().catch(() => ({}));
  const parsed = parseLogBody(raw, { creating: true });
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const author = member.userId ? await db.user.findUnique({ where: { id: member.userId }, select: { name: true } }) : null;
  const entry = await db.managerLogEntry.create({
    data: { ...parsed.data, companyId: member.companyId, authorMemberId: member.id, authorName: author?.name || null },
    select: LOG_SELECT,
  });
  return NextResponse.json({ entry }, { status: 201 });
}
