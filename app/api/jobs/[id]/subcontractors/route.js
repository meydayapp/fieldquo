// app/api/jobs/[id]/subcontractors/route.js
//
// The subs on one job: who, for how much, and where it stands.
//
// ══ Two gates on the read, three on the write ══════════════════════════════
//
// READ — jobs:view_only plus the job's scope, exactly as the visits list. A
// crew member on the job sees WHO the electrician is (they will meet them on
// site); the agreed amount comes off unless they also hold jobCosting, the
// toggle the costing route reads for the same number.
//
// WRITE — jobs:view_create_edit (it is the job record being changed), plus
// the roster gate `user:manage` from lib/subcontractors/access.js (putting a
// company on a job is a staffing decision, like job:assign), plus jobCosting
// for anything that touches the AGREED AMOUNT or the STATUS. A dispatcher
// without jobCosting can book the sub onto Thursday's visit and describe the
// scope; they cannot set or change what the sub is owed, because they cannot
// see it.
//
// ══ Adopting an imported quote ═════════════════════════════════════════════
//
// When the job's quote carries a QuoteImport (the sub's own FieldQuo quote,
// pulled in as a cost line — lib/quotes/importQuote.js), the GC can turn it
// into a JobSubcontractor with one click. The amount is the import's
// snapshot, read here, never from the browser; the sub is matched by
// linkedCompanyId, or created from the source company's name when the GC
// has never listed them. JobSubcontractor.quoteImportId records where the
// number came from, and job costing uses it to count that cost once — see
// lib/subcontractors/money.js.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { assignedJobWhere, hasLevel, hasToggle } from "@/lib/permissions/enforce";
import {
  canWriteSubcontractors,
  requireSubcontractorWrite,
  SUBCONTRACTOR_MONEY_TOGGLE,
} from "@/lib/subcontractors/access";
import { subcontractorAttention } from "@/lib/subcontractors/expiry";
import { paymentsCover } from "@/lib/subcontractors/money";
import {
  parseJobSubcontractorBody,
  JOB_SUBCONTRACTOR_SELECT,
  PAYMENT_SELECT,
  stripJobSubcontractorMoney,
} from "@/lib/subcontractors/payload";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";
import { recordActivity } from "@/lib/activity/log";

const ROW_SELECT = {
  ...JOB_SUBCONTRACTOR_SELECT,
  subcontractor: {
    select: {
      id: true,
      name: true,
      trade: true,
      active: true,
      insuranceExpiresAt: true,
      clearanceExpiresAt: true,
    },
  },
  visit: { select: { id: true, scheduledAt: true } },
  payments: { select: PAYMENT_SELECT, orderBy: { date: "desc" } },
};

async function ownJob(jobId, companyId, full) {
  return db.job.findFirst({
    where: { id: jobId, companyId, ...assignedJobWhere(full) },
    select: { id: true, title: true, quoteId: true },
  });
}

function decorate(row, { canSeeMoney, now }) {
  const attention = subcontractorAttention(row.subcontractor, { asOf: now });
  const cover = paymentsCover(row.agreedAmount, row.payments);
  const shaped = {
    ...row,
    subcontractor: {
      id: row.subcontractor.id,
      name: row.subcontractor.name,
      trade: row.subcontractor.trade,
      active: row.subcontractor.active,
      attention: { state: attention.state, reasons: attention.reasons },
    },
    paid: cover.paid,
    remaining: cover.remaining,
    // A fact about the row, not a figure, so it survives the money strip:
    // the "take off this job" control must not be offered where the DELETE
    // will refuse.
    hasPayments: row.payments.length > 0,
  };
  return canSeeMoney ? shaped : stripJobSubcontractorMoney(shaped);
}

/** The whole panel payload, shared by GET and the writes. */
async function loadPanel({ job, member, full }) {
  const canSeeMoney = hasToggle(full, SUBCONTRACTOR_MONEY_TOGGLE);
  const canManage = hasLevel(full, "jobs", "view_create_edit") && canWriteSubcontractors(full);
  const now = new Date();

  const [rows, roster, visits, imports] = await Promise.all([
    db.jobSubcontractor.findMany({
      where: { jobId: job.id, companyId: member.companyId },
      select: ROW_SELECT,
      orderBy: { createdAt: "asc" },
    }),
    canManage
      ? db.subcontractor.findMany({
          where: { companyId: member.companyId, active: true },
          select: { id: true, name: true, trade: true, linkedCompanyId: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    canManage
      ? db.jobVisit.findMany({
          where: { jobId: job.id },
          select: { id: true, scheduledAt: true },
          orderBy: { scheduledAt: "asc" },
        })
      : Promise.resolve([]),
    canManage && job.quoteId
      ? db.quoteImport.findMany({
          where: { targetQuoteId: job.quoteId, targetCompanyId: member.companyId },
          select: {
            id: true,
            label: true,
            snapshotAmount: true,
            sourceCompanyId: true,
            sourceCompany: { select: { name: true } },
          },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const adoptedImportIds = new Set(rows.map((r) => r.quoteImportId).filter(Boolean));
  const bySourceCompany = new Map(roster.filter((s) => s.linkedCompanyId).map((s) => [s.linkedCompanyId, s]));

  return {
    rows: rows.map((r) => decorate(r, { canSeeMoney, now })),
    roster: roster.map(({ id, name, trade }) => ({ id, name, trade })),
    visits,
    imports: imports.map((imp) => ({
      id: imp.id,
      label: imp.label,
      sourceCompanyName: imp.sourceCompany?.name || null,
      adopted: adoptedImportIds.has(imp.id),
      matchedSubcontractorId: bySourceCompany.get(imp.sourceCompanyId)?.id || null,
      // The snapshot is the GC's cost, so it is money — off for anyone
      // without the toggle, like every other figure on this payload.
      ...(canSeeMoney ? { amount: Number(imp.snapshotAmount) } : {}),
    })),
    canManage,
    canSeeMoney,
  };
}

export async function GET(request, { params }) {
  // Next 16: `params` is a Promise.
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { full, response: denied } = await levelOrRefusal(member, "jobs", "view_only", "see jobs");
  if (denied) return denied;

  const job = await ownJob(id, member.companyId, full);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(await loadPanel({ job, member, full }));
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { full, response: denied } = await levelOrRefusal(
    member,
    "jobs",
    "view_create_edit",
    "put a subcontractor on this job",
  );
  if (denied) return denied;
  try {
    requireSubcontractorWrite(full);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const job = await ownJob(id, member.companyId, full);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const canSeeMoney = hasToggle(full, SUBCONTRACTOR_MONEY_TOGGLE);

  // ── Adopting an import: the amount and the sub come from the import ─────
  let imp = null;
  if (typeof body?.quoteImportId === "string" && body.quoteImportId.trim()) {
    imp = await db.quoteImport.findFirst({
      where: { id: body.quoteImportId.trim(), targetCompanyId: member.companyId, targetQuoteId: job.quoteId || "__none__" },
      select: { id: true, label: true, snapshotAmount: true, sourceCompanyId: true, sourceCompany: { select: { name: true } } },
    });
    if (!imp) return NextResponse.json({ error: "That imported quote isn't on this job's quote." }, { status: 404 });
    const already = await db.jobSubcontractor.findFirst({
      where: { jobId: job.id, companyId: member.companyId, quoteImportId: imp.id },
      select: { id: true },
    });
    if (already)
      return NextResponse.json({ error: "That imported quote is already on this job." }, { status: 409 });
  }

  // With an import the browser sends no money: the snapshot is the amount.
  const parsed = parseJobSubcontractorBody(
    imp
      ? {
          ...body,
          subcontractorId: body?.subcontractorId || "__from_import__",
          agreedAmount: Number(imp.snapshotAmount),
          status: body?.status ?? "agreed",
          description: body?.description ?? imp.label ?? undefined,
          quoteImportId: imp.id,
        }
      : body,
    { creating: true },
  );
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  // Money without the money gate: a dispatcher can add the sub and the scope,
  // not the price. `quoted` at 0 is what "no price yet" looks like.
  if (!canSeeMoney && (data.agreedAmount > 0 || data.status !== "quoted"))
    return NextResponse.json(
      { error: "Your access level doesn't include job costing, so you can add the subcontractor but not what they're owed." },
      { status: 403 },
    );

  // ── Resolve the sub ──────────────────────────────────────────────────────
  let subcontractorId = data.subcontractorId;
  let createdSub = null;
  if (imp && subcontractorId === "__from_import__") {
    const matched = await db.subcontractor.findFirst({
      where: { companyId: member.companyId, linkedCompanyId: imp.sourceCompanyId },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    if (matched) subcontractorId = matched.id;
    else {
      // The GC has never listed this company. Create the roster entry from
      // the import's own source — name and link only; nothing else of the
      // other tenant is copied.
      createdSub = await db.subcontractor.create({
        data: {
          companyId: member.companyId,
          name: (imp.sourceCompany?.name || imp.label || "Subcontractor").slice(0, 160),
          trade: imp.label ? imp.label.slice(0, 80) : null,
          linkedCompanyId: imp.sourceCompanyId,
        },
        select: { id: true, name: true },
      });
      subcontractorId = createdSub.id;
    }
  }

  // The sub has to be ours; the visit has to be this job's. A JobVisit has no
  // companyId — it hangs off the job proved above — so it is checked inline.
  const notOurs = await ownedIdsRefusal(NextResponse, db, member.companyId, { subcontractorId });
  if (notOurs) return notOurs;
  if (data.visitId) {
    const visit = await db.jobVisit.findFirst({ where: { id: data.visitId, jobId: job.id }, select: { id: true } });
    if (!visit) return NextResponse.json({ error: "That visit isn't on this job." }, { status: 400 });
  }

  const created = await db.jobSubcontractor.create({
    data: {
      companyId: member.companyId,
      jobId: job.id,
      subcontractorId,
      visitId: data.visitId ?? null,
      description: data.description ?? null,
      agreedAmount: data.agreedAmount,
      status: data.status,
      quoteImportId: data.quoteImportId ?? null,
    },
    select: { id: true, subcontractor: { select: { name: true } } },
  });

  if (createdSub) {
    await recordActivity(member, {
      action: "subcontractor.created",
      entityType: "subcontractor",
      entityId: createdSub.id,
      summary: `Added subcontractor ${createdSub.name} from an imported quote`,
      metadata: { subcontractorId: createdSub.id, quoteImportId: imp?.id ?? null, jobId: job.id },
    });
  }
  await recordActivity(member, {
    action: "job.subcontractor_added",
    entityType: "job",
    entityId: job.id,
    summary: `Put ${created.subcontractor.name} on ${job.title || "the job"} (${data.status}${data.agreedAmount ? `, ${data.agreedAmount}` : ""})`,
    metadata: {
      jobId: job.id,
      jobSubcontractorId: created.id,
      subcontractorId,
      status: data.status,
      agreedAmount: data.agreedAmount,
      quoteImportId: data.quoteImportId ?? null,
    },
  });

  return NextResponse.json(await loadPanel({ job, member, full }), { status: 201 });
}
