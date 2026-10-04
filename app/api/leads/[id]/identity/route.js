// app/api/leads/[id]/identity/route.js
//
// "Not the same person" — undo one LeadIdentityLink on this lead.
//
//   POST { linkId }
//
// The links themselves are listed by GET /api/leads/[id]/documents
// (`identityLinks`), beside the evidence each rests on. Undoing one is what
// makes linking safe to do automatically at all: a Facebook form submission
// folded into this lead becomes its own lead again, a conversation joined by
// a shared phone stops pointing here, a client tie is dropped — and the pair
// is remembered so the matcher never proposes it again. Nothing is deleted;
// see lib/leads/identityLinks.js undoIdentityLink.
//
// The requests dial at view_create_edit — the same rung as editing the lead
// or linking its quote (app/api/leads/[id]/quote-link). A member of the
// company only: memberOrRefusal refuses an impersonation cookie on every
// non-GET (non-negotiable #2/#3).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { recordActivity } from "@/lib/activity/log";
import { undoIdentityLink } from "@/lib/leads/identityLinks";

const REFUSAL = {
  not_found: { status: 404, error: "That link isn't on this lead." },
  already_undone: { status: 409, error: "That link was already undone." },
};

export async function POST(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { response: denied } = await levelOrRefusal(member, "requests", "view_create_edit", "change a request");
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const linkId = typeof body?.linkId === "string" ? body.linkId.trim() : "";
  if (!linkId) return NextResponse.json({ error: "`linkId` is required." }, { status: 400 });

  // The lead first, scoped to the company — a link id from the body is
  // trusted only as far as it hangs off a lead of THIS tenant.
  const lead = await db.leadRequest.findFirst({ where: { id, companyId: member.companyId }, select: { id: true, name: true } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await undoIdentityLink(db, {
    companyId: member.companyId,
    leadId: lead.id,
    linkId,
    userId: member.userId || null,
  });
  if (!result.ok) {
    const r = REFUSAL[result.reason] || { status: 400, error: "That link could not be undone." };
    return NextResponse.json({ error: r.error, code: result.reason }, { status: r.status });
  }

  await recordActivity(member, {
    action: "lead.identity_unlinked",
    entityType: "lead",
    entityId: lead.id,
    summary: result.splitLeadId
      ? `Marked a Facebook form submission as not the same person as lead "${lead.name}" — it is its own lead again`
      : `Marked a linked record as not the same person as lead "${lead.name}"`,
    metadata: { leadId: lead.id, linkId, splitLeadId: result.splitLeadId || null },
  });

  return NextResponse.json({ ok: true, splitLeadId: result.splitLeadId || null });
}
