// app/api/subcontractors/export/route.js
//
// The accountant's list: every sub, whether they go on the year-end
// contractor form, what they were paid in the year, and how many payments
// made that total. One CSV, one calendar year.
//
// ══ Why this exists ════════════════════════════════════════════════════════
//
// In Canada a contractor who paid a construction sub more than $500 in the
// year files a T5018 for them; in the US it is a 1099-NEC over $600. Both are
// a list of (company, amount) that the bookkeeper has been reconstructing
// from cheque stubs. Every figure here is yearToDatePaidBySubcontractor over
// the same rows the sub's own page reads, so the two never disagree.
//
// The threshold is deliberately NOT applied. Every sub is listed, including
// the ones paid $0 and the ones marked "no tax form", because the accountant
// decides who files and the product does not know which jurisdiction's rule
// applies. A zero row says "we checked, nothing"; a missing row says nothing.
//
// ══ The gate ═══════════════════════════════════════════════════════════════
//
// The money gate (jobCosting on top of user:manage) — this is nothing BUT
// money. Same shape as the payroll export: a read-only support session is
// refused, because loadEnforceableMember returns null for an impersonated
// member and the gate denies null.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, permissionErrorResponse } from "@/lib/permissions/enforce";
import { requireSubcontractorMoney } from "@/lib/subcontractors/access";
import { yearToDatePaidBySubcontractor, requestedYear } from "@/lib/subcontractors/money";
import { money, toCsv } from "@/lib/export/accountingExport";
import { recordActivity } from "@/lib/activity/log";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireSubcontractorMoney(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const { searchParams } = new URL(request.url);
  const year = requestedYear(searchParams);

  const [company, subs, payments] = await Promise.all([
    db.company.findUnique({ where: { id: member.companyId }, select: { name: true, currency: true } }),
    db.subcontractor.findMany({
      where: { companyId: member.companyId },
      select: { id: true, name: true, trade: true, taxFormRequired: true, active: true, linkedCompanyId: true },
      orderBy: { name: "asc" },
    }),
    db.subcontractorPayment.findMany({
      where: {
        companyId: member.companyId,
        date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
      },
      select: { subcontractorId: true, amount: true, date: true },
    }),
  ]);

  const paid = yearToDatePaidBySubcontractor(payments, year);

  const rows = [["Subcontractor", "Trade", "Tax form", "Paid in year", "Payments", "Active"]];
  let total = 0;
  for (const s of subs) {
    const p = paid.get(s.id) || { total: 0, count: 0 };
    total += p.total;
    rows.push([
      s.name,
      s.trade || "",
      s.taxFormRequired ? "yes" : "no",
      money(p.total),
      String(p.count),
      s.active ? "yes" : "no",
    ]);
  }
  rows.push([]);
  rows.push(["TOTAL", "", "", money(total), String(payments.length), ""]);

  // Currency stated, never guessed — the same stance as the payroll export.
  const currency =
    typeof company?.currency === "string" && company.currency.trim() ? company.currency.trim() : null;
  rows.push([]);
  rows.push([`${company?.name || "Company"} — subcontractor payments, calendar year ${year}`]);
  rows.push([
    `Currency: ${currency ?? "not recorded — set it in Settings → Company"}   Recorded in FieldQuo; no form has been filed through this system.`,
  ]);

  await recordActivity(member, {
    action: "subcontractor.exported",
    entityType: "subcontractor",
    summary: `Exported subcontractor payments for ${year} as CSV (${subs.length} subcontractors)`,
    metadata: { year, subcontractors: subs.length, payments: payments.length },
  });

  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="subcontractors-${year}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
