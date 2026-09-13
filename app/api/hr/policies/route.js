// app/api/hr/policies/route.js — Settings → Policies: the list with its
// signature counts, and creating one (from scratch or from a starter).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hrManagerOrRefusal } from "@/lib/hr/gate";
import { parsePolicyBody } from "@/lib/hr/policies";
import { createPolicy, acknowledgementReport, POLICY_SELECT } from "@/lib/hr/policyService";
import { recordActivity } from "@/lib/activity/log";

export async function GET(request) {
  const { member, response } = await hrManagerOrRefusal(request);
  if (response) return response;
  const includeArchived = new URL(request.url).searchParams.get("archived") === "1";
  const policies = await db.companyPolicy.findMany({
    where: { companyId: member.companyId, ...(includeArchived ? {} : { archivedAt: null }) },
    select: POLICY_SELECT,
    orderBy: [{ archivedAt: "asc" }, { title: "asc" }],
  });
  const out = [];
  for (const p of policies) {
    const report = p.archivedAt ? { counts: { inScope: 0, acknowledged: 0, pending: 0 } } : await acknowledgementReport(db, { companyId: member.companyId, policy: p });
    out.push({ ...p, counts: report.counts });
  }
  const titles = await db.worker.findMany({ where: { companyId: member.companyId, active: true, title: { not: null } }, select: { title: true }, distinct: ["title"] });
  return NextResponse.json({ policies: out, jobTitles: titles.map((t) => t.title).filter(Boolean).sort() });
}

export async function POST(request) {
  const { member, response } = await hrManagerOrRefusal(request);
  if (response) return response;
  const raw = await request.json().catch(() => ({}));
  const parsed = parsePolicyBody(raw, { creating: true });
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const policy = await createPolicy(db, { companyId: member.companyId, data: parsed.data, actorUserId: member.userId || null });
  await recordActivity(member, { action: "hr.policy_created", entityType: "policy", entityId: policy.id, summary: `Published policy "${policy.title}" (v1)` });
  return NextResponse.json({ policy }, { status: 201 });
}
