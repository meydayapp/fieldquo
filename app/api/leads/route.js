// app/api/leads/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

// Authed — the pipeline view for staff
export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const temperature = searchParams.get("temperature");
  const source = searchParams.get("source");
  const assignedToId = searchParams.get("assignedToId");
  const q = (searchParams.get("q") || "").trim();
  const sort = searchParams.get("sort"); // "score" | default recent

  // "score" sorts hottest-first (nulls — unscored legacy leads — sink to the
  // bottom), then most recent within a tier. Default stays newest-first.
  const orderBy =
    sort === "score"
      ? [{ score: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }]
      : [{ createdAt: "desc" }];

  const leads = await db.leadRequest.findMany({
    where: {
      companyId: member.companyId,
      ...(status && { status }),
      ...(temperature && { temperature }),
      ...(source && { source }),
      ...(assignedToId && {
        assignedToId: assignedToId === "unassigned" ? null : assignedToId,
      }),
      ...(q && {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { message: { contains: q, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      category: { select: { label: true } },
      assignedTo: { select: { id: true, name: true } },
      quote: { select: { id: true, quoteNumber: true, status: true } },
    },
    orderBy,
  });

  // ── Who has asked not to be called ──────────────────────────────────────
  //
  // Shown on the list so a contractor knows BEFORE they pick up the phone.
  // Someone who asked us to stop and then gets rung anyway is the complaint
  // that ends in a regulator, and the person dialling had no way to know.
  //
  // One query for the whole page rather than one per lead: this list can be
  // hundreds long, and N+1 on a page people open all day is how it gets slow.
  const numbers = [...new Set(leads.map((l) => l.phone).filter(Boolean))];
  const optedOut = numbers.length
    ? await db.callConsent.findMany({
        where: { companyId: member.companyId, e164: { in: numbers }, optedOutAt: { not: null } },
        select: { e164: true },
      })
    : [];
  const blocked = new Set(optedOut.map((c) => c.e164));

  return NextResponse.json(
    leads.map((l) => ({ ...l, doNotCall: Boolean(l.phone && blocked.has(l.phone)) })),
  );
}

export async function PATCH(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status } = await request.json();
  if (!id || !status) {
    return NextResponse.json(
      { error: "id and status are required" },
      { status: 400 },
    );
  }
  // Same allow-list as the per-lead route — an arbitrary string here would be
  // stored and then silently bucketed into "new" by the board.
  if (!["new", "contacted", "converted", "lost"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const existing = await db.leadRequest.findFirst({
    where: { id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await db.leadRequest.update({
    where: { id },
    data: { status },
  });
  return NextResponse.json(updated);
}
