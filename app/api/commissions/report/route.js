// app/api/commissions/report/route.js
//
// Reports › Commissions — by member, over a date range, split into what has
// been PAID (on a pay run recorded as paid), what is ON a pay run not yet
// paid, and what is PENDING (earned, on no run yet). On screen only: the
// owner decided against exports, so there is no CSV twin of this route.
//
// A row's date is when it was EARNED — the ledger row's createdAt, which is
// when the payment (or refund) that moved it was synced — not when the job
// was done or the invoice sent.
//
// Everyone may call it. What they get back is scoped on the server by
// lib/commissions/access.js: everyone's rows for payroll view_all or
// jobCosting, their own rows otherwise — the query filters, nothing is
// hidden in the browser.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember } from "@/lib/permissions/enforce";
import { commissionAccess } from "@/lib/commissions/access";
import { toCents, fromCents } from "@/lib/commissions/compute";

const ROW_CAP = 500;
const DAY = 86400000;

/** "YYYY-MM-DD" → a UTC day boundary, or null for anything else. */
function day(v, endOfDay = false) {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return endOfDay ? new Date(d.getTime() + DAY - 1) : d;
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const full = await loadEnforceableMember(db, member.id);
  const access = commissionAccess(full);

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const from = day(searchParams.get("from")) || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = day(searchParams.get("to"), true) || now;
  if (to < from) return NextResponse.json({ error: "The end date is before the start date." }, { status: 400 });
  const wanted = searchParams.get("memberId");

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { commissionsEnabled: true, commissionBasis: true, currency: true },
  });

  // Own rows only unless the grant says otherwise — and a memberId filter from
  // someone without it can only ever narrow to themselves.
  const memberFilter = access.seesAll ? (wanted ? { memberId: wanted } : {}) : { memberId: member.id };

  const rows = await db.jobCommissionEntry.findMany({
    where: { companyId: member.companyId, createdAt: { gte: from, lte: to }, ...memberFilter },
    orderBy: { createdAt: "desc" },
    take: ROW_CAP + 1,
    select: {
      id: true,
      jobId: true,
      memberId: true,
      memberName: true,
      role: true,
      amount: true,
      reason: true,
      detail: true,
      payRunId: true,
      createdAt: true,
    },
  });
  const truncated = rows.length > ROW_CAP;
  const list = rows.slice(0, ROW_CAP);

  // Totals are taken over EVERY row in range, not the capped list — a capped
  // total would be a wrong number presented as the answer.
  const all = truncated
    ? await db.jobCommissionEntry.findMany({
        where: { companyId: member.companyId, createdAt: { gte: from, lte: to }, ...memberFilter },
        select: { memberId: true, memberName: true, role: true, amount: true, payRunId: true },
      })
    : list;

  const runIds = [...new Set(all.map((r) => r.payRunId).filter(Boolean))];
  const jobIds = [...new Set(list.map((r) => r.jobId))];
  const [runs, jobs, current, summaries] = await Promise.all([
    runIds.length
      ? db.payRun.findMany({
          where: { id: { in: runIds }, companyId: member.companyId },
          select: { id: true, status: true, periodStart: true, periodEnd: true },
        })
      : [],
    jobIds.length
      ? db.job.findMany({ where: { id: { in: jobIds }, companyId: member.companyId }, select: { id: true, title: true } })
      : [],
    db.member.findMany({
      where: { companyId: member.companyId, ...(access.seesAll ? {} : { id: member.id }) },
      select: { id: true, user: { select: { name: true, email: true } } },
    }),
    // "Not yet collected": what each person would still earn if every open
    // invoice on their jobs were paid, from each job's last sync. Not date
    // ranged — it is a statement about now.
    db.jobCommission.findMany({
      where: { companyId: member.companyId },
      select: { summary: true },
    }),
  ]);
  const runById = new Map(runs.map((r) => [r.id, r]));
  const titleOf = new Map(jobs.map((j) => [j.id, j.title]));
  const nameNow = new Map(current.map((m) => [m.id, m.user?.name || m.user?.email || null]));
  const statusOf = (payRunId) => {
    const run = payRunId ? runById.get(payRunId) : null;
    if (!run || run.status === "cancelled") return "pending";
    return run.status === "paid" ? "paid" : "in_pay_run";
  };

  const byMember = new Map();
  for (const r of all) {
    const cur = byMember.get(r.memberId) || {
      memberId: r.memberId,
      name: nameNow.get(r.memberId) || r.memberName || null,
      earnedCents: 0,
      paidCents: 0,
      inPayRunCents: 0,
      pendingCents: 0,
      workedCents: 0,
      soldCents: 0,
      uncollectedCents: 0,
    };
    const c = toCents(r.amount);
    cur.earnedCents += c;
    cur[r.role === "sold" ? "soldCents" : "workedCents"] += c;
    const st = statusOf(r.payRunId);
    if (st === "paid") cur.paidCents += c;
    else if (st === "in_pay_run") cur.inPayRunCents += c;
    else cur.pendingCents += c;
    byMember.set(r.memberId, cur);
  }
  const visibleIds = new Set(current.map((m) => m.id));
  for (const s of summaries) {
    for (const e of Array.isArray(s.summary?.earners) ? s.summary.earners : []) {
      if (!access.seesAll && e.memberId !== member.id) continue;
      if (!visibleIds.has(e.memberId) && !byMember.has(e.memberId)) continue;
      const gap = toCents(e.potential) - toCents(e.earned);
      if (gap <= 0) continue;
      const cur = byMember.get(e.memberId) || {
        memberId: e.memberId,
        name: nameNow.get(e.memberId) || e.name || null,
        earnedCents: 0,
        paidCents: 0,
        inPayRunCents: 0,
        pendingCents: 0,
        workedCents: 0,
        soldCents: 0,
        uncollectedCents: 0,
      };
      cur.uncollectedCents += gap;
      byMember.set(e.memberId, cur);
    }
  }

  const members = [...byMember.values()]
    .map((m) => ({
      memberId: m.memberId,
      name: m.name,
      earned: fromCents(m.earnedCents),
      worked: fromCents(m.workedCents),
      sold: fromCents(m.soldCents),
      paid: fromCents(m.paidCents),
      inPayRun: fromCents(m.inPayRunCents),
      pending: fromCents(m.pendingCents),
      uncollected: fromCents(m.uncollectedCents),
    }))
    .sort((a, b) => b.earned - a.earned || String(a.name).localeCompare(String(b.name)));

  const sum = (f) => fromCents(members.reduce((s, m) => s + toCents(m[f]), 0));

  return NextResponse.json({
    enabled: Boolean(company?.commissionsEnabled),
    basis: company?.commissionBasis || "revenue",
    currency: company?.currency || null,
    seesAll: access.seesAll,
    memberId: member.id,
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    totals: { earned: sum("earned"), paid: sum("paid"), inPayRun: sum("inPayRun"), pending: sum("pending"), uncollected: sum("uncollected") },
    members,
    // For the member picker: only people this caller may see.
    people: access.seesAll ? current.map((m) => ({ memberId: m.id, name: nameNow.get(m.id) })) : [],
    entries: list.map((r) => ({
      id: r.id,
      date: r.createdAt,
      memberId: r.memberId,
      name: nameNow.get(r.memberId) || r.memberName || null,
      jobId: r.jobId,
      jobTitle: titleOf.get(r.jobId) || null,
      invoiceNumber: r.detail?.invoiceNumber || null,
      role: r.role,
      reason: r.reason,
      amount: Number(r.amount),
      status: statusOf(r.payRunId),
    })),
    truncated,
  });
}
