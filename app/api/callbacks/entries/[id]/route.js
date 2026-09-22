// app/api/callbacks/entries/[id]/route.js
//
// POST { outcome, note, callBackOn } — log what the call ended in.
//
// Written by whoever may see the list (the assignee, or an owner/admin).
// "do_not_contact" is the one outcome with a side effect outside the row:
// it marks the client and opts the number out of the voice agent's consent
// ledger in the same request, so a wish said to a person is honoured by
// the machine. Every outcome is also an activity row on the client's
// timeline (recordActivity, entityType "client").
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { recordActivity } from "@/lib/activity/log";
import { optOut } from "@/lib/voice/outbound";
import { normaliseOutcome } from "@/lib/callbacks/outcomes";
import { listScope } from "@/lib/callbacks/scope";

export async function POST(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = normaliseOutcome(body || {});
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const entry = await db.callbackEntry.findFirst({
    where: { id, companyId: member.companyId, list: listScope(member) },
    include: { client: { select: { id: true, name: true, phone: true } } },
  });
  if (!entry) return NextResponse.json({ error: "Not on a list you can work." }, { status: 404 });

  const updated = await db.callbackEntry.update({
    where: { id: entry.id },
    data: {
      outcome: parsed.outcome,
      outcomeNote: parsed.note || null,
      callBackOn: parsed.callBackOn,
      outcomeById: member.userId,
      outcomeAt: new Date(),
    },
  });

  if (parsed.outcome === "do_not_contact") {
    await db.client.update({
      where: { id: entry.client.id },
      data: { doNotContactAt: new Date(), doNotContactReason: parsed.note || "Asked not to be called (callback list)" },
    });
    if (entry.client.phone) {
      await optOut({ companyId: member.companyId, phone: entry.client.phone, note: "Asked not to be called (callback list)" }).catch(() => {});
    }
  }

  await recordActivity(member, {
    action: `callback.${parsed.outcome}`,
    entityType: "client",
    entityId: entry.client.id,
    summary: `Callback to ${entry.client.name}: ${parsed.outcome.replace(/_/g, " ")}${parsed.note ? ` — ${parsed.note}` : ""}${parsed.callBackOn ? ` (${parsed.callBackOn.toISOString().slice(0, 10)})` : ""}`,
    metadata: { entryId: entry.id, outcome: parsed.outcome, callBackOn: parsed.callBackOn },
  });

  return NextResponse.json({
    id: updated.id,
    outcome: updated.outcome,
    outcomeNote: updated.outcomeNote,
    callBackOn: updated.callBackOn ? updated.callBackOn.toISOString().slice(0, 10) : null,
    outcomeAt: updated.outcomeAt,
    bookHref: parsed.outcome === "booked" ? `/app/quotes/new?clientId=${entry.client.id}` : null,
  });
}
