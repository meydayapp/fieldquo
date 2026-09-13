// app/api/hr/me/policies/[id]/acknowledge/route.js
//
// "I have read and understood." A typed name over the CURRENT version —
// the version and hash the screen showed are checked against the row, so a
// tab left open across a re-publish signs nothing (lib/hr/policies.js
// parseAcknowledgement). Same audit shape as a quote signature: ip, user
// agent, hash. Once per version, by the unique index; a second POST for
// the same version answers the existing row rather than an error, because
// a double-tap on a phone is not a second decision.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hrSelfOrRefusal } from "@/lib/hr/gate";
import { parseAcknowledgement, policyAppliesTo } from "@/lib/hr/policies";
import { POLICY_SELECT } from "@/lib/hr/policyService";
import { reconcileRunsForWorker } from "@/lib/onboarding/service";
import { clientIp } from "@/lib/rateLimit";

const ACK_SELECT = { id: true, policyId: true, policyVersion: true, acknowledgedAt: true, signatureName: true };

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, worker, response } = await hrSelfOrRefusal(request);
  if (response) return response;

  const policy = await db.companyPolicy.findFirst({ where: { id, companyId: member.companyId, archivedAt: null }, select: POLICY_SELECT });
  if (!policy || !policyAppliesTo(policy, worker)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const raw = await request.json().catch(() => ({}));
  const parsed = parseAcknowledgement(raw, policy);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const existing = await db.policyAcknowledgement.findFirst({
    where: { companyId: member.companyId, policyId: policy.id, policyVersion: policy.version, workerId: worker.id },
    select: ACK_SELECT,
  });
  if (existing) return NextResponse.json({ acknowledgement: existing, already: true });

  const acknowledgement = await db.policyAcknowledgement.create({
    data: {
      companyId: member.companyId,
      policyId: policy.id,
      policyVersion: parsed.data.policyVersion,
      workerId: worker.id,
      signatureName: parsed.data.signatureName,
      bodyHash: parsed.data.bodyHash,
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent")?.slice(0, 300) || null,
    },
    select: ACK_SELECT,
  });
  await reconcileRunsForWorker(db, { companyId: member.companyId, workerId: worker.id, actorUserId: member.userId });
  return NextResponse.json({ acknowledgement }, { status: 201 });
}
