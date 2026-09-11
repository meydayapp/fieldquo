// app/api/subcontractors/route.js
//
// The subs: the companies this contractor hires per job. Who they are,
// whether their insurance and clearance are in date, and — for a member who
// may see cost — what each was paid this year.
//
// ══ What this is not ═══════════════════════════════════════════════════════
//
// Not the roster. A Worker is a PERSON, paid by the hour, clocking in; the
// people at /app/settings/team stay there. A Subcontractor is a COMPANY hired
// for a fixed amount, and the schema header on the four models says why the
// two were pulled apart. Nothing here reads WorkerType.contractor.
//
// ══ Two gates, on purpose ══════════════════════════════════════════════════
//
// `user:manage` opens the roster — a company name and a COI renewal date are
// operations, and the dispatcher deciding whether the electrician goes on
// site Thursday needs them. The money (year-to-date paid) comes off unless
// the member ALSO holds jobCosting. lib/subcontractors/access.js explains why
// one stricter gate would have been the wrong trade.
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
import { subcontractorAttention, subcontractorsDueSoon, subcontractorTally } from "@/lib/subcontractors/expiry";
import { yearToDatePaidBySubcontractor, paymentYear, requestedYear } from "@/lib/subcontractors/money";
import { parseSubcontractorBody, SUBCONTRACTOR_SELECT } from "@/lib/subcontractors/payload";
import { recordActivity } from "@/lib/activity/log";

/**
 * The whole roster payload. Shared with POST so a create can hand the screen
 * back exactly what a reload would.
 */
async function loadRoster({ member, full, year }) {
  const canEdit = canWriteSubcontractors(full);
  const canSeeMoney = canSeeSubcontractorMoney(full);
  const now = new Date();

  const subs = await db.subcontractor.findMany({
    where: { companyId: member.companyId },
    select: SUBCONTRACTOR_SELECT,
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  // One query for the year, not one per sub. Filtered to the year in SQL by
  // UTC day bounds, then re-bucketed by the same paymentYear() rule the
  // T5018 export uses, so the two screens cannot disagree by a timezone.
  let paidBySub = new Map();
  if (canSeeMoney && subs.length) {
    const payments = await db.subcontractorPayment.findMany({
      where: {
        companyId: member.companyId,
        date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
      },
      select: { subcontractorId: true, amount: true, date: true },
    });
    paidBySub = yearToDatePaidBySubcontractor(payments, year);
  }

  const rows = subs.map((sub) => {
    const attention = subcontractorAttention(sub, { asOf: now });
    const paid = paidBySub.get(sub.id);
    return {
      ...sub,
      attention: { state: attention.state, reasons: attention.reasons },
      // Absent, not zero, for a member who may not see money — a "$0 paid"
      // column on a restricted screen is a figure they were not allowed.
      ...(canSeeMoney
        ? { paidThisYear: paid ? paid.total : 0, paymentsThisYear: paid ? paid.count : 0 }
        : {}),
    };
  });

  const dueSoon = subcontractorsDueSoon(subs, { asOf: now }).map((r) => ({
    subcontractorId: r.sub.id,
    name: r.sub.name,
    trade: r.sub.trade,
    state: r.state,
    reasons: r.reasons.map((x) => ({ kind: x.kind, state: x.state, endsAt: x.endsAt, daysRemaining: x.daysRemaining })),
  }));

  return {
    subcontractors: rows,
    dueSoon,
    tally: subcontractorTally(subs, { asOf: now }),
    year,
    canEdit,
    canSeeMoney,
  };
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireSubcontractorRead(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const { searchParams } = new URL(request.url);
  const year = requestedYear(searchParams);
  return NextResponse.json(await loadRoster({ member, full, year }));
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireSubcontractorWrite(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = parseSubcontractorBody(body, { creating: true });
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // A linked company is, by definition, ANOTHER tenant's id, so ownedIds
  // cannot prove it. What can be proved: it exists, and it is not ourselves.
  // Nothing of that company is ever copied — the link resolves their quote
  // and Stripe account later, at read time, from their own rows.
  if (parsed.data.linkedCompanyId) {
    if (parsed.data.linkedCompanyId === member.companyId)
      return NextResponse.json({ error: "You can't list your own company as a subcontractor." }, { status: 400 });
    const linked = await db.company.findUnique({
      where: { id: parsed.data.linkedCompanyId },
      select: { id: true },
    });
    if (!linked) return NextResponse.json({ error: "That FieldQuo company wasn't found." }, { status: 400 });
  }

  const created = await db.subcontractor.create({
    data: { companyId: member.companyId, ...parsed.data },
    select: SUBCONTRACTOR_SELECT,
  });

  await recordActivity(member, {
    action: "subcontractor.created",
    entityType: "subcontractor",
    entityId: created.id,
    summary: `Added subcontractor ${created.name}${created.trade ? ` (${created.trade})` : ""}`,
    metadata: { subcontractorId: created.id, linkedCompanyId: created.linkedCompanyId ?? null },
  });

  const year = paymentYear(new Date());
  return NextResponse.json(
    { subcontractor: created, ...(await loadRoster({ member, full, year })) },
    { status: 201 },
  );
}
