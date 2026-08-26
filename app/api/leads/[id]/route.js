// app/api/leads/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { rescoreLead } from "@/lib/leads/createLead";
import { cleanBudgetBand, cleanTimeline } from "@/lib/leads/qualifiers";
import {
  loadEnforceableMember,
  requireLevel,
  redactLead,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";

// One lead, with everything the detail view shows.
export async function GET(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { id } = await params;
  const lead = await db.leadRequest.findFirst({
    where: { id, companyId: member.companyId },
    include: {
      category: { select: { label: true } },
      assignedTo: { select: { id: true, name: true } },
      quote: { select: { id: true, quoteNumber: true, status: true } },
      notes: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!lead)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Do-not-call is derived (there's no column) — same rule as the list.
  let doNotCall = false;
  if (lead.phone) {
    const optOut = await db.callConsent.findFirst({
      where: { companyId: member.companyId, e164: lead.phone, optedOutAt: { not: null } },
      select: { id: true },
    });
    doNotCall = Boolean(optOut);
  }

  // The same filter as the list beside it. Enumerating ids off a redacted
  // board and pulling each detail is precisely how the client leak was
  // reached before it — see the note in app/api/clients/[id]/route.js — so the
  // detail door closes at the same time as the list.
  const full = await loadEnforceableMember(db, member.id);
  return NextResponse.json(redactLead(full, { ...lead, doNotCall }));
}

// Update pipeline state, owner, or the qualifiers. Changing a qualifier
// re-triages the lead so the score never goes stale against its own inputs.
export async function PATCH(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // The same gate as the board's PATCH beside it. This route is the wider of
  // the two — it reassigns the lead and rewrites the qualifiers that drive the
  // score, not just the column — and it had exactly the same nothing.
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "requests", "view_create_edit", "change a request");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const { id } = await params;
  const existing = await db.leadRequest.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true, budgetBand: true, timeline: true },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const data = {};

  if (body.status !== undefined) {
    const allowed = ["new", "contacted", "converted", "lost"];
    if (!allowed.includes(body.status))
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    data.status = body.status;
  }

  if (body.assignedToId !== undefined) {
    if (body.assignedToId === null || body.assignedToId === "") {
      data.assignedToId = null;
    } else {
      // Only a member of THIS company can own the lead — never assign to a user
      // from another tenant (or a stranger's id posted by hand).
      const isMember = await db.member.findFirst({
        where: { userId: body.assignedToId, companyId: member.companyId },
        select: { id: true },
      });
      if (!isMember)
        return NextResponse.json(
          { error: "That person isn't on your team." },
          { status: 400 },
        );
      data.assignedToId = body.assignedToId;
    }
  }

  let qualifiersChanged = false;
  if (body.budgetBand !== undefined) {
    data.budgetBand = cleanBudgetBand(body.budgetBand);
    qualifiersChanged = true;
  }
  if (body.timeline !== undefined) {
    data.timeline = cleanTimeline(body.timeline);
    qualifiersChanged = true;
  }

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  await db.leadRequest.update({ where: { id }, data });

  // Re-triage after a qualifier edit so score/temperature reflect the new inputs.
  if (qualifiersChanged) await rescoreLead(id);

  const updated = await db.leadRequest.findFirst({
    where: { id },
    include: {
      category: { select: { label: true } },
      assignedTo: { select: { id: true, name: true } },
      quote: { select: { id: true, quoteNumber: true, status: true } },
    },
  });
  return NextResponse.json(updated);
}
