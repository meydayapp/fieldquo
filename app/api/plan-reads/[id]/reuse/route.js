// app/api/plan-reads/[id]/reuse/route.js
//
// POST { fromPlanReadId } — copy an earlier read's sheet passes of the SAME
// drawing file into this read's unread sheets, instead of paying for them
// again (lib/planRead/sheetCache.js). Free: no model is called.
//
// The browser names only WHICH earlier read; the offer itself is recomputed
// here from the database, scoped to the member's company, so a request can
// neither name another company's read nor a file that is not the same bytes.
// Logged in the read's history as the estimator's own change.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { loadPlanRead } from "@/lib/planRead/load";
import { findSheetCache, applySheetReuse } from "@/lib/planRead/sheetCache";
import { editLogEntry } from "@/lib/planRead/history";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { response: denied } = await levelOrRefusal(member, "quotes", "view_create_edit", "change a drawing read");
  if (denied) return denied;

  const read = await loadPlanRead(id, member.companyId, { messages: false });
  if (!read) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (read.status === "reading") return NextResponse.json({ error: "A read is running. Reuse earlier sheets when it finishes." }, { status: 409 });

  const raw = await request.json().catch(() => ({}));
  const fromId = typeof raw?.fromPlanReadId === "string" ? raw.fromPlanReadId : "";
  const { offers, sources } = await findSheetCache(read, { companyId: member.companyId, prisma: db });
  const offer = offers.find((o) => o.fromId === fromId);
  const source = sources.find((s) => s.id === fromId);
  if (!offer || !source) {
    return NextResponse.json({ error: "Those sheets can't be reused here any more — read them instead.", code: "no_offer" }, { status: 409 });
  }

  // The documents route's lock: a drawing set uploaded while this runs
  // appends sheets under the same row lock, so neither write loses the other.
  const reused = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "PlanRead" WHERE id = ${read.id} FOR UPDATE`;
    const fresh = await tx.planRead.findFirst({ where: { id: read.id, companyId: member.companyId }, select: { status: true, sheets: true } });
    if (!fresh || fresh.status === "reading") return 0;
    const next = applySheetReuse(fresh.sheets, offer, source);
    if (!next.reused) return 0;
    await tx.planRead.updateMany({ where: { id: read.id, companyId: member.companyId }, data: { sheets: next.sheets } });
    const log = editLogEntry({
      changes: [`Reused ${next.reused} sheet reading${next.reused === 1 ? "" : "s"} from “${source.title || "an earlier read"}” instead of reading them again`],
      companyId: member.companyId,
      planReadId: read.id,
      userId: member.userId || null,
    });
    if (log) await tx.planReadMessage.create({ data: log });
    return next.reused;
  });
  if (!reused) return NextResponse.json({ error: "Nothing left to reuse — those sheets were already read.", code: "nothing_to_reuse" }, { status: 409 });
  return NextResponse.json({ ok: true, reused });
}
