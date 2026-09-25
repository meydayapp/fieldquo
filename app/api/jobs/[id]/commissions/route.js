// app/api/jobs/[id]/commissions/route.js
//
// The job page's Commissions card.
//
// GET    who earns on this job, what they would earn if every invoice were
//        collected, what they HAVE earned (the ledger), and whether the ledger
//        is behind the current figures. Pure — it never writes, so a read-only
//        support session can open a job without moving anyone's pay.
// PATCH  change who earns and how: splits, fixed overrides, the lines each
//        person earns on — or `{ reset: true }` to go back to the defaults.
//        Every change is appended to JobCommission.audit in the same write
//        (who, when, from what, to what), then the ledger is re-synced.
// POST   `{ action: "recalculate" }` — re-sync the ledger now: after a rate
//        change, costs arriving on a gross-profit job, or a basis change.
//
// Gates: the job's own (jobs ≥ view_only, scoped to the member's assigned jobs
// where that applies), then lib/commissions/access.js — everyone's figures
// for payroll view_all or jobCosting, your own otherwise; changes need
// payroll view_all.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { assignedJobWhere } from "@/lib/permissions/enforce";
import { commissionAccess, visibleEarners } from "@/lib/commissions/access";
import { normaliseEarners, fromCents, toCents, pctOrNull } from "@/lib/commissions/compute";
import {
  loadJobCommissionInputs,
  computeFromInputs,
  syncJobCommissions,
  memberDisplayName,
} from "@/lib/commissions/sync";
import { recordActivity } from "@/lib/activity/log";

const AUDIT_CAP = 200;

async function gate(request, params) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return { response };
  const { full, response: denied } = await levelOrRefusal(member, "jobs", "view_only", "see jobs");
  if (denied) return { response: denied };
  const job = await db.job.findFirst({
    where: { id, companyId: member.companyId, ...assignedJobWhere(full) },
    select: { id: true, title: true },
  });
  if (!job) return { response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { member, full, job, access: commissionAccess(full) };
}

/** Ledger rows → per (member, role): earned so far, and how much of it is settled. */
async function ledgerFor(companyId, jobId) {
  const rows = await db.jobCommissionEntry.findMany({
    where: { companyId, jobId },
    orderBy: [{ createdAt: "asc" }, { seq: "asc" }],
    select: {
      id: true,
      invoiceRootId: true,
      memberId: true,
      memberName: true,
      role: true,
      seq: true,
      amount: true,
      total: true,
      reason: true,
      payRunId: true,
      createdAt: true,
    },
  });
  const runIds = [...new Set(rows.map((r) => r.payRunId).filter(Boolean))];
  const runs = runIds.length
    ? await db.payRun.findMany({ where: { id: { in: runIds }, companyId }, select: { id: true, status: true } })
    : [];
  const runStatus = new Map(runs.map((r) => [r.id, r.status]));
  return { rows, runStatus };
}

export async function GET(request, { params }) {
  const g = await gate(request, params);
  if (g.response) return g.response;
  const { member, full, job, access } = g;

  const inputs = await loadJobCommissionInputs(db, { companyId: member.companyId, jobId: job.id });
  if (!inputs) return NextResponse.json({ enabled: false });
  const live = computeFromInputs(inputs);
  const { rows, runStatus } = await ledgerFor(member.companyId, job.id);

  // What the ledger holds per (family, member, role) — its latest running
  // total — against what the figures say now. Any difference means the
  // ledger is behind (a rate edited, costs arrived) and "Recalculate" is due.
  const held = new Map();
  for (const r of rows) held.set(`${r.invoiceRootId}|${r.memberId}|${r.role}`, toCents(r.total));
  const want = new Map();
  for (const e of live.earners) for (const b of e.byFamily) want.set(`${b.rootId}|${e.memberId}|${e.role}`, b.earnedCents);
  const keys = new Set([...held.keys(), ...want.keys()]);
  const stale = [...keys].some((k) => (held.get(k) || 0) !== (want.get(k) || 0));

  // Per earner: settled (on a PAID pay run), on a run not yet paid, pending.
  const byEarner = new Map();
  for (const r of rows) {
    const k = `${r.memberId}|${r.role}`;
    const cur = byEarner.get(k) || { earnedCents: 0, paidCents: 0, inRunCents: 0, pendingCents: 0, name: r.memberName };
    const c = toCents(r.amount);
    cur.earnedCents += c;
    const st = r.payRunId ? runStatus.get(r.payRunId) : null;
    if (st === "paid") cur.paidCents += c;
    else if (st && st !== "cancelled") cur.inRunCents += c;
    else cur.pendingCents += c;
    byEarner.set(k, cur);
  }

  const earnerRows = live.earners.map((e) => {
    const l = byEarner.get(`${e.memberId}|${e.role}`) || {};
    return {
      memberId: e.memberId,
      name: e.name,
      role: e.role,
      memberPct: e.memberPct,
      splitPct: e.splitPct,
      fixedAmount: e.fixedAmount,
      excludedLines: e.excludedLines,
      potential: fromCents(e.potentialCents),
      earnedNow: fromCents(e.earnedCents),
      ledger: {
        earned: fromCents(l.earnedCents || 0),
        paid: fromCents(l.paidCents || 0),
        inPayRun: fromCents(l.inRunCents || 0),
        pending: fromCents(l.pendingCents || 0),
      },
    };
  });
  // Someone the ledger paid who is no longer on the job — their reversal is
  // pending until the next sync, and the card must still show them.
  for (const [k, l] of byEarner) {
    const [memberId, role] = k.split("|");
    if (earnerRows.some((e) => e.memberId === memberId && e.role === role)) continue;
    // Fully reversed and never settled: nothing left to say about them.
    if (!l.earnedCents && !l.paidCents && !l.inRunCents && !l.pendingCents) continue;
    earnerRows.push({
      memberId,
      name: l.name,
      role,
      removed: true,
      potential: 0,
      earnedNow: 0,
      ledger: {
        earned: fromCents(l.earnedCents),
        paid: fromCents(l.paidCents),
        inPayRun: fromCents(l.inRunCents),
        pending: fromCents(l.pendingCents),
      },
    });
  }

  const visible = visibleEarners(full, earnerRows, member.id);
  const commissionRow = access.canEdit
    ? await db.jobCommission.findUnique({ where: { jobId: job.id }, select: { audit: true, syncedAt: true } })
    : null;

  return NextResponse.json({
    enabled: true,
    basis: live.basis,
    seesAll: access.seesAll,
    canEdit: access.canEdit,
    memberId: member.id,
    stale,
    storedEarners: inputs.storedEarners,
    earners: visible,
    // The job's money — lines, revenue, cost, the invoices — only for someone
    // who sees everyone's commission. A member seeing their own figure sees
    // their own figure, not the job's price list.
    ...(access.seesAll
      ? {
          revenue: live.revenue,
          cost: live.cost,
          costDetail: inputs.costDetail,
          grossProfitRatio: live.grossProfitRatio,
          lines: live.lines,
          invoices: inputs.families.map((f) => ({
            rootId: f.rootId,
            invoiceId: f.invoiceId,
            invoiceNumber: f.invoiceNumber,
            total: f.total,
            amountPaid: f.amountPaid,
            eligible: f.eligible,
          })),
        }
      : {}),
    ...(access.canEdit
      ? {
          team: inputs.members
            .filter((m) => m.active || earnerRows.some((e) => e.memberId === m.id))
            .map((m) => ({
              memberId: m.id,
              name: memberDisplayName(m),
              workedByPct: pctOrNull(m.workedByPct),
              soldByPct: pctOrNull(m.soldByPct),
            })),
          defaults: inputs.defaults,
          audit: Array.isArray(commissionRow?.audit) ? commissionRow.audit.slice(-30).reverse() : [],
          syncedAt: commissionRow?.syncedAt || null,
        }
      : {}),
  });
}

/**
 * What changed, as data — { kind, name, role, from, to } — so the card can
 * say it in the reader's language (the audit is read by an owner in French as
 * readily as in English), with an English sentence beside each for the
 * activity log, which is English at write time like every other row in it.
 */
function describeChange(before, after, nameOf) {
  const key = (e) => `${e.memberId}|${e.role}`;
  const roleWord = (r) => (r === "sold" ? "sold-by" : "worked-by");
  const b = new Map((before || []).map((e) => [key(e), e]));
  const a = new Map((after || []).map((e) => [key(e), e]));
  const out = [];
  const push = (kind, e, from, to, text) =>
    out.push({ kind, memberId: e.memberId, name: nameOf(e.memberId), role: e.role, from, to, text });
  for (const [k, e] of a) {
    const was = b.get(k);
    const who = `${nameOf(e.memberId)} (${roleWord(e.role)})`;
    if (!was) {
      push("added", e, null, e.splitPct, `added ${who} at ${e.splitPct}%`);
      if (e.fixedAmount != null) push("fixed", e, null, e.fixedAmount, `${who} fixed override none → ${e.fixedAmount}`);
      continue;
    }
    if (Number(was.splitPct) !== Number(e.splitPct)) {
      push("split", e, was.splitPct, e.splitPct, `${who} split ${was.splitPct}% → ${e.splitPct}%`);
    }
    const wf = was.fixedAmount ?? null;
    const nf = e.fixedAmount ?? null;
    if (wf !== nf) push("fixed", e, wf, nf, `${who} fixed override ${wf == null ? "none" : wf} → ${nf == null ? "none" : nf}`);
    const wl = [...(was.excludedLines || [])].sort().join(",");
    const nl = [...(e.excludedLines || [])].sort().join(",");
    if (wl !== nl) {
      const n = e.excludedLines?.length || 0;
      push("lines", e, (was.excludedLines || []).length, n, `${who} now opts out of ${n} line${n === 1 ? "" : "s"}`);
    }
  }
  for (const [k, e] of b) if (!a.has(k)) push("removed", e, e.splitPct, null, `removed ${nameOf(e.memberId)} (${roleWord(e.role)})`);
  return out;
}

async function currentEarners(companyId, jobId) {
  const inputs = await loadJobCommissionInputs(db, { companyId, jobId, force: true });
  return {
    inputs,
    earners: (inputs?.earners || []).map((e) => ({
      memberId: e.memberId,
      role: e.role,
      splitPct: e.splitPct,
      fixedAmount: e.fixedAmount ?? null,
      excludedLines: e.excludedLines || [],
    })),
  };
}

export async function PATCH(request, { params }) {
  const g = await gate(request, params);
  if (g.response) return g.response;
  const { member, job, access } = g;
  if (!access.canEdit) {
    return NextResponse.json({ error: "You don't have permission to change commissions." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { inputs, earners: before } = await currentEarners(member.companyId, job.id);
  if (!inputs) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let next = null; // null = back to the defaults
  if (body.reset !== true) {
    const vetted = normaliseEarners(body.earners, new Set(inputs.members.map((m) => m.id)));
    if (!vetted.ok) return NextResponse.json({ error: vetted.error, code: vetted.code }, { status: 400 });
    next = vetted.earners;
  }

  const nameOf = (id) => memberDisplayName(inputs.members.find((m) => m.id === id)) || "someone";
  const changes =
    body.reset === true
      ? [{ kind: "reset", memberId: null, name: null, role: null, from: null, to: null, text: "reset to the defaults" }]
      : describeChange(before, next, nameOf);
  if (!changes.length) return NextResponse.json({ ok: true, unchanged: true });

  const existing = await db.jobCommission.findUnique({ where: { jobId: job.id }, select: { audit: true } });
  const actor = await db.user.findUnique({ where: { id: member.userId }, select: { name: true, email: true } });
  const entry = {
    at: new Date().toISOString(),
    byUserId: member.userId,
    byName: actor?.name || actor?.email || null,
    changes,
    before,
    after: next,
  };
  const audit = [...(Array.isArray(existing?.audit) ? existing.audit : []), entry].slice(-AUDIT_CAP);

  await db.jobCommission.upsert({
    where: { jobId: job.id },
    create: { companyId: member.companyId, jobId: job.id, earners: next ?? Prisma.DbNull, audit },
    update: { earners: next ?? Prisma.DbNull, audit },
  });

  await recordActivity(member, {
    action: "commissions.job_changed",
    entityType: "job",
    entityId: job.id,
    summary: `Commissions on ${job.title}: ${changes.map((c) => c.text).join("; ")}`,
    metadata: { before, after: next },
  });

  // The ledger follows the new terms now — money already collected is
  // re-earned on them, and the difference is written as "recalculated".
  const synced = await syncJobCommissions(db, { companyId: member.companyId, jobId: job.id });
  return NextResponse.json({ ok: true, written: synced.written ?? 0 });
}

export async function POST(request, { params }) {
  const g = await gate(request, params);
  if (g.response) return g.response;
  const { member, job, access } = g;
  if (!access.canEdit) {
    return NextResponse.json({ error: "You don't have permission to recalculate commissions." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  if (body.action !== "recalculate") return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  const synced = await syncJobCommissions(db, { companyId: member.companyId, jobId: job.id });
  if (synced.skipped) return NextResponse.json({ error: "Commissions are switched off." }, { status: 409 });
  if (synced.written) {
    await recordActivity(member, {
      action: "commissions.recalculated",
      entityType: "job",
      entityId: job.id,
      summary: `Recalculated commissions on ${job.title} (${synced.written} ledger ${synced.written === 1 ? "entry" : "entries"})`,
    });
  }
  return NextResponse.json({ ok: true, written: synced.written ?? 0 });
}
