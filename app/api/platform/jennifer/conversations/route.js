// app/api/platform/jennifer/conversations/route.js
//
// The operator queue: every escalated Jennifer conversation, oldest first —
// same ordering choice app/api/platform/feedback/route.js makes for the same
// reason, a queue that surfaces the newest thing is a queue where the oldest
// complaint quietly rots.
//
// Staff-only, like every /api/platform/* route. Read-only in the sense that
// matters most for AGENTS.md non-negotiable #3 ("the platform console can
// view everything and edit nothing on a company's data") — this route lists
// and reads a company's Jennifer conversation, which is a support artefact
// FieldQuo itself generated (Jennifer is FieldQuo's own assistant), not a
// company's quote, invoice or client record. Replying to it (the [id] route's
// POST) is the one deliberate exception non-negotiable #3 already carves out
// implicitly: FieldQuo answering its OWN support conversation is not editing
// the company's data, it's FieldQuo doing the job Jennifer escalated.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "escalated";

  const [rows, companies] = await Promise.all([
    db.jenniferConversation.findMany({
      where: { status },
      orderBy: { updatedAt: "asc" },
      take: 200,
      include: {
        messages: { orderBy: { createdAt: "asc" }, take: 1 }, // first line, for a preview
      },
    }),
    db.jenniferConversation.groupBy({ by: ["status"], _count: true }),
  ]);

  // Denormalise the company name in one extra query rather than a join per
  // row — JenniferConversation deliberately carries no Prisma relation to
  // Company (see the schema comment), matching Feedback's own precedent.
  const companyIds = [...new Set(rows.map((r) => r.companyId))];
  const companyRows = companyIds.length
    ? await db.company.findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(companyRows.map((c) => [c.id, c.name]));

  return NextResponse.json({
    rows: rows.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      companyName: nameById.get(r.companyId) || "(deleted company)",
      status: r.status,
      escalationReason: r.escalationReason,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      preview: r.messages[0]?.content?.slice(0, 140) || "",
    })),
    counts: Object.fromEntries(companies.map((c) => [c.status, c._count])),
  });
}
