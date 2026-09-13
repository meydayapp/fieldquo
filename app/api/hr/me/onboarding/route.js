// app/api/hr/me/onboarding/route.js — my checklist, reconciled against my
// own file on every read so an upload made a minute ago shows as done.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hrSelfOrRefusal } from "@/lib/hr/gate";
import { RUN_SELECT, reconcileRunsForWorker } from "@/lib/onboarding/service";
import { describeRun } from "@/lib/onboarding/run";
import { resolveCountry } from "@/lib/company/resolveCountry";

export async function GET(request) {
  const { member, worker, response } = await hrSelfOrRefusal(request);
  if (response) return response;

  await reconcileRunsForWorker(db, { companyId: member.companyId, workerId: worker.id, actorUserId: member.userId });
  const run = await db.onboardingRun.findFirst({
    where: { companyId: member.companyId, workerId: worker.id },
    select: RUN_SELECT,
    orderBy: { startedAt: "desc" },
  });
  // Policy items carry the policy's title so the row can say which one.
  const policyIds = (run?.items || []).filter((it) => it.kind === "policy").map((it) => it.policyId);
  const policies = policyIds.length
    ? await db.companyPolicy.findMany({ where: { companyId: member.companyId, id: { in: policyIds } }, select: { id: true, title: true } })
    : [];
  const titles = new Map(policies.map((p) => [p.id, p.title]));
  const described = describeRun(run);
  if (described) described.items = described.items.map((it) => (it.kind === "policy" ? { ...it, policyTitle: titles.get(it.policyId) || null } : it));

  const company = await db.company.findUnique({ where: { id: member.companyId }, select: { name: true, country: true, address: true, province: true } });
  return NextResponse.json({
    worker: { id: worker.id, name: worker.name },
    company: { name: company?.name || "", country: resolveCountry(company || {}).country },
    run: described,
  });
}
