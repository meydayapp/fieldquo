// app/api/hr/me/summary/route.js
//
// The counts the employee home shows beside the HR rows (lib/me/
// moreLinks.js `badge` names) and the banner it draws when something is
// waiting: policies to sign, notes to acknowledge, open checklist items,
// documents about to lapse. One cheap read for the shell; the pages behind
// each count are the real screens.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { myWorker } from "@/lib/hr/access";
import { pendingPolicyCount, pendingNoteCount } from "@/lib/hr/pending";
import { expiringDocuments } from "@/lib/hr/documentExpiry";
import { progress } from "@/lib/onboarding/run";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const worker = await myWorker(db, member);
  if (!worker) return NextResponse.json({ hasWorker: false, policiesPending: 0, notesPending: 0, onboardingOpen: 0, documentsExpiring: 0 });

  const [policiesPending, notesPending, run, documents] = await Promise.all([
    pendingPolicyCount(worker.id, { db }),
    pendingNoteCount(worker.id, { db }),
    db.onboardingRun.findFirst({ where: { companyId: member.companyId, workerId: worker.id, completedAt: null }, select: { items: true }, orderBy: { startedAt: "desc" } }),
    db.workerDocument.findMany({ where: { companyId: member.companyId, workerId: worker.id, archivedAt: null }, select: { id: true, kind: true, expiresAt: true, archivedAt: true } }),
  ]);
  const p = run ? progress(run.items) : null;
  return NextResponse.json({
    hasWorker: true,
    policiesPending,
    notesPending,
    onboardingOpen: p ? p.total - p.done : 0,
    documentsExpiring: expiringDocuments(documents).length,
  });
}
