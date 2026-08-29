// app/api/analytics/utilisation/route.js
//
// Hours paid for, against hours that reached a job.
//
// ── Why it is its own endpoint and not part of burn-rate ──────────────────
//
// Because it deliberately does NOT feed the burn rate. Unabsorbed labour is a
// real cost and it behaves like overhead, but wiring it into
// calculateBurnRate() would raise costPerJob and therefore the minimum price on
// every quote — on the strength of time entries nobody has audited yet. A
// company whose crew logs time patchily would read most of the week as
// unabsorbed and price itself out of work.
//
// So this reports, and the overhead screen shows it beside the burn rate.
// Turning it into money that moves a price is one addition to burnRate.js and a
// deliberate decision, not a refactor. See lib/costing/utilisation.js.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { requireCostBasisRead } from "@/lib/permissions/costBasis";
import { labourUtilisation, weeksBetween } from "@/lib/costing/utilisation";

/** How far back to look, in days. Kept short — a quarter of stale rota data
 *  says less about this week than the last month does. */
const DEFAULT_DAYS = 30;
const MAX_DAYS = 180;

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Every row here is somebody's wage multiplied by somebody's hours. Same gate
  // the burn rate carries, and for the same reason: refusing the itemised
  // overhead page while serving the same money through a sibling endpoint is
  // not refusing it.
  // ── Non-negotiable #3: the console views everything and edits nothing ────
  //
  // loadEnforceableMember returns null for a support session — it has no Member
  // row and therefore no id — and requireCostBasisRead denies a null member,
  // correctly, for a real caller it cannot identify. Here that would blind
  // FieldQuo support to the very panel a contractor is ringing about, so the
  // READ opts out explicitly. There is no write on this route to protect, and
  // getCurrentMember refuses every write from an impersonation session anyway.
  if (!member.impersonation) {
    const full = await loadEnforceableMember(db, member.id);
    try {
      requireCostBasisRead(full, "burnRate");
    } catch (err) {
      const { body, status } = permissionErrorResponse(err);
      return NextResponse.json(body, { status });
    }
  }

  const raw = Number(new URL(request.url).searchParams.get("days"));
  const days = Number.isFinite(raw) && raw > 0 ? Math.min(raw, MAX_DAYS) : DEFAULT_DAYS;
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  const [workers, grouped, company] = await Promise.all([
    db.worker.findMany({
      where: { companyId: member.companyId, active: true },
      select: {
        id: true,
        name: true,
        workType: true,
        scheduledHoursPerWeek: true,
        hourlyRate: true,
      },
    }),
    // APPROVED and ON A JOB. Pending time is an unverified claim — paying
    // attention to it here would make approval decorative, the same reason
    // payroll refuses it — and time with no jobId is company time, which is
    // precisely the thing being measured as unabsorbed rather than counted as
    // absorbed.
    db.timeEntry.groupBy({
      by: ["workerId"],
      where: {
        worker: { companyId: member.companyId },
        status: "approved",
        jobId: { not: null },
        clockIn: { gte: from, lte: to },
      },
      _sum: { hours: true },
    }),
    db.company.findUnique({
      where: { id: member.companyId },
      select: { currency: true },
    }),
  ]);

  const jobHoursById = {};
  for (const g of grouped) {
    if (g.workerId) jobHoursById[g.workerId] = Number(g._sum.hours || 0);
  }

  const result = labourUtilisation({
    workers: workers.map((w) => ({
      ...w,
      scheduledHoursPerWeek:
        w.scheduledHoursPerWeek === null ? null : Number(w.scheduledHoursPerWeek),
      hourlyRate: w.hourlyRate === null ? null : Number(w.hourlyRate),
    })),
    jobHoursById,
    weeks: weeksBetween(from, to),
  });

  return NextResponse.json({
    ...result,
    days,
    from: from.toISOString(),
    to: to.toISOString(),
    // Stated, never guessed — the same rule the payroll export follows. A
    // figure with no currency beside it is a number somebody will read in
    // whatever currency they were thinking of.
    currency: company?.currency || null,
  });
}
