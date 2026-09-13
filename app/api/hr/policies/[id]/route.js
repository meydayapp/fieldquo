// app/api/hr/policies/[id]/route.js — one policy: the text, the version
// history, and who has and hasn't signed. PATCH edits (versioning in
// lib/hr/policyService.js) or archives; nothing is deleted.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hrManagerOrRefusal } from "@/lib/hr/gate";
import { parsePolicyBody } from "@/lib/hr/policies";
import { updatePolicy, acknowledgementReport, POLICY_SELECT } from "@/lib/hr/policyService";
import { recordActivity } from "@/lib/activity/log";

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await hrManagerOrRefusal(request);
  if (response) return response;
  const policy = await db.companyPolicy.findFirst({ where: { id, companyId: member.companyId }, select: POLICY_SELECT });
  if (!policy) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [report, versions] = await Promise.all([
    acknowledgementReport(db, { companyId: member.companyId, policy }),
    db.companyPolicyVersion.findMany({ where: { companyId: member.companyId, policyId: policy.id }, select: { version: true, title: true, createdAt: true }, orderBy: { version: "desc" } }),
  ]);
  return NextResponse.json({ policy, report, versions });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await hrManagerOrRefusal(request);
  if (response) return response;
  const policy = await db.companyPolicy.findFirst({ where: { id, companyId: member.companyId }, select: POLICY_SELECT });
  if (!policy) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const raw = await request.json().catch(() => ({}));
  if (raw?.archived === true) {
    const updated = await db.companyPolicy.update({ where: { id: policy.id }, data: { archivedAt: new Date() }, select: POLICY_SELECT });
    await recordActivity(member, { action: "hr.policy_archived", entityType: "policy", entityId: policy.id, summary: `Archived policy "${policy.title}"` });
    return NextResponse.json({ policy: updated });
  }
  if (policy.archivedAt) return NextResponse.json({ error: "This policy is archived." }, { status: 409 });

  const parsed = parsePolicyBody(raw);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (Object.keys(parsed.data).length === 0) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  const result = await updatePolicy(db, { companyId: member.companyId, policy, patch: parsed.data });
  await recordActivity(member, {
    action: result.newVersion ? "hr.policy_reversioned" : "hr.policy_updated",
    entityType: "policy",
    entityId: policy.id,
    summary: result.newVersion ? `Published version ${result.policy.version} of "${result.policy.title}"` : `Updated policy "${result.policy.title}"`,
  });
  return NextResponse.json({ policy: result.policy, newVersion: result.newVersion });
}
