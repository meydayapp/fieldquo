// app/api/subcontractors/[id]/route.js
//
// One sub: the record, its documents, the jobs it has been on, and — behind
// the money gate — what it was paid in a chosen year.
//
// Same two gates as the list (see app/api/subcontractors/route.js and
// lib/subcontractors/access.js). The year-to-date figure is the T5018 /
// 1099-NEC number, computed by lib/subcontractors/money.js's yearToDatePaid
// over the rows this route fetched, so the screen and the year-end export
// cannot disagree.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, permissionErrorResponse } from "@/lib/permissions/enforce";
import {
  requireSubcontractorRead,
  requireSubcontractorWrite,
  canWriteSubcontractors,
  canSeeSubcontractorMoney,
} from "@/lib/subcontractors/access";
import { subcontractorAttention } from "@/lib/subcontractors/expiry";
import { yearToDatePaid, requestedYear } from "@/lib/subcontractors/money";
import {
  parseSubcontractorBody,
  SUBCONTRACTOR_DETAIL_SELECT,
  SUBCONTRACTOR_SELECT,
  DOCUMENT_SELECT,
  JOB_SUBCONTRACTOR_SELECT,
  PAYMENT_SELECT,
  stripJobSubcontractorMoney,
} from "@/lib/subcontractors/payload";
import { recordActivity } from "@/lib/activity/log";

async function ownSub(id, companyId, select = SUBCONTRACTOR_DETAIL_SELECT) {
  return db.subcontractor.findFirst({ where: { id, companyId }, select });
}

export async function GET(request, { params }) {
  // Next 16: `params` is a Promise.
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireSubcontractorRead(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const sub = await ownSub(id, member.companyId);
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canSeeMoney = canSeeSubcontractorMoney(full);
  const { searchParams } = new URL(request.url);
  const year = requestedYear(searchParams);
  const now = new Date();

  const [documents, jobs, payments] = await Promise.all([
    db.subcontractorDocument.findMany({
      where: { subcontractorId: sub.id, companyId: member.companyId },
      select: DOCUMENT_SELECT,
      orderBy: { uploadedAt: "desc" },
    }),
    db.jobSubcontractor.findMany({
      where: { subcontractorId: sub.id, companyId: member.companyId },
      select: {
        ...JOB_SUBCONTRACTOR_SELECT,
        job: { select: { id: true, title: true, status: true, client: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Every payment ever, not just the year's: the ledger below the year
    // picker is the whole history, and the year figure is bucketed from the
    // same rows by the same rule the export uses. Refused members get none.
    canSeeMoney
      ? db.subcontractorPayment.findMany({
          where: { subcontractorId: sub.id, companyId: member.companyId },
          select: PAYMENT_SELECT,
          orderBy: { date: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const attention = subcontractorAttention(sub, { asOf: now });

  // Which years have a payment at all, so the picker offers real years
  // rather than a decade of empties.
  const years = [...new Set(payments.map((p) => new Date(p.date).getUTCFullYear()))].sort((a, b) => b - a);
  if (!years.includes(year)) years.unshift(year);

  return NextResponse.json({
    subcontractor: { ...sub, attention: { state: attention.state, reasons: attention.reasons, expiries: attention.expiries } },
    documents,
    jobs: canSeeMoney ? jobs : jobs.map(stripJobSubcontractorMoney),
    ...(canSeeMoney
      ? { payments, yearToDate: yearToDatePaid(payments, year), years }
      : { payments: null, yearToDate: null, years: [] }),
    canEdit: canWriteSubcontractors(full),
    canSeeMoney,
  });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireSubcontractorWrite(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const existing = await ownSub(id, member.companyId, { id: true, name: true, active: true });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const parsed = parseSubcontractorBody(body, { creating: false });
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  if (parsed.data.linkedCompanyId) {
    if (parsed.data.linkedCompanyId === member.companyId)
      return NextResponse.json({ error: "You can't list your own company as a subcontractor." }, { status: 400 });
    const linked = await db.company.findUnique({
      where: { id: parsed.data.linkedCompanyId },
      select: { id: true },
    });
    if (!linked) return NextResponse.json({ error: "That FieldQuo company wasn't found." }, { status: 400 });
  }

  const updated = await db.subcontractor.update({
    where: { id: existing.id },
    data: parsed.data,
    select: SUBCONTRACTOR_SELECT,
  });

  const changed = Object.keys(parsed.data);
  await recordActivity(member, {
    action:
      parsed.data.active === false && existing.active
        ? "subcontractor.deactivated"
        : parsed.data.active === true && !existing.active
          ? "subcontractor.reactivated"
          : "subcontractor.updated",
    entityType: "subcontractor",
    entityId: updated.id,
    summary: `Updated subcontractor ${updated.name} (${changed.join(", ")})`,
    metadata: { subcontractorId: updated.id, fields: changed },
  });

  return NextResponse.json({ subcontractor: updated });
}
