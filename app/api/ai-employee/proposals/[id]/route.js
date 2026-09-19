// app/api/ai-employee/proposals/[id]/route.js
//
// Approve, edit-then-approve, or decline one proposal.
//
//   PATCH { action: "approve", argsHash, args? }
//   PATCH { action: "decline" }
//
// The hash is REQUIRED on an approve: it is the hash of the arguments the
// person read on the screen (or the edited ones they are sending), and
// lib/aiEmployee/proposals.js refuses to execute anything whose recomputed
// hash differs. The row is read under the member's companyId, so a proposal
// belonging to another company is "not found" — and executeProposal injects
// that same companyId into the tool, never anything from this body.
//
// Owner/admin only, never a support session: this is the one button that
// turns a proposal into a booking.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { executeProposal, declineProposal } from "@/lib/aiEmployee/proposals";

const STATUS = { unknown_proposal: 404, already_decided: 409, hash_mismatch: 409, stale: 410, tool_failed: 502 };

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (member.impersonation) {
    return NextResponse.json({ error: "A support session can look, not approve." }, { status: 403 });
  }
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json({ error: "Only an owner or admin can approve what the AI employee proposes." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action === "approve" ? "approve" : body.action === "decline" ? "decline" : null;
  if (!action) return NextResponse.json({ error: "Approve or decline." }, { status: 400 });

  const company = await db.company.findUnique({ where: { id: member.companyId }, select: { defaultLanguage: true } });

  if (action === "decline") {
    const out = await declineProposal({ companyId: member.companyId, id, userId: member.userId });
    if (!out.ok) return NextResponse.json({ error: out.reason, status: out.status || null }, { status: STATUS[out.reason] || 400 });
    await recordActivity(member, {
      action: "ai_employee.proposal_declined",
      entityType: "settings",
      entityId: id,
      summary: "Declined an AI employee proposal",
      summaryKey: "app.activity.event.aiEmployee.proposalDeclined",
    });
    return NextResponse.json({ ok: true, status: out.status });
  }

  const expectedHash = typeof body.argsHash === "string" ? body.argsHash : null;
  if (!expectedHash) {
    return NextResponse.json({ error: "The approval must name what it approves.", reason: "no_hash" }, { status: 400 });
  }
  const args = body.args && typeof body.args === "object" && !Array.isArray(body.args) ? body.args : undefined;

  const out = await executeProposal({
    companyId: member.companyId,
    id,
    args,
    expectedHash,
    userId: member.userId,
    language: company?.defaultLanguage || null,
  });

  if (!out.ok) {
    return NextResponse.json(
      { error: out.reason, status: out.status || null, result: out.result || null },
      { status: STATUS[out.reason] || 400 },
    );
  }

  await recordActivity(member, {
    action: "ai_employee.proposal_approved",
    entityType: "settings",
    entityId: id,
    summary: args ? "Approved an AI employee proposal after editing it" : "Approved an AI employee proposal",
    summaryKey: args ? "app.activity.event.aiEmployee.proposalEdited" : "app.activity.event.aiEmployee.proposalApproved",
  });

  return NextResponse.json({ ok: true, status: out.status, result: out.result || null });
}
