// app/api/payroll/runs/[id]/payslip/[lineId]/route.js
//
// One payslip, as a PDF.
//
// ── Who can download whose ──────────────────────────────────────────────────
//
// Someone with payroll:view_all (or owner/admin) can download anyone's.
// Everyone else can download their OWN and only their own, resolved from their
// Worker row rather than from anything the browser sends — a line id in a URL
// is a guess anyone can make.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  hasLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { renderPayslipPdfBuffer } from "@/lib/payroll/renderPayslipPdf";
import { currencyMeta } from "@/lib/currency";

function slug(s) {
  return String(s || "payslip")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET(request, { params }) {
  // Next 16: params is a Promise.
  const { id, lineId } = await params;

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const line = await db.payRunLine.findFirst({
    where: { id: lineId, payRunId: id, payRun: { companyId: member.companyId } },
    include: { payRun: true },
  });
  if (!line) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Permission: all-access, or it's theirs.
  let canViewAll = member.role === "owner" || member.role === "admin";
  if (!canViewAll) {
    try {
      const full = await loadEnforceableMember(db, member.id);
      canViewAll =
        hasLevel(full, "payroll", "view_all") ||
        hasLevel(full, "payroll", "run_payroll");
    } catch (err) {
      const { body, status } = permissionErrorResponse(err);
      return NextResponse.json(body, { status });
    }
  }
  if (!canViewAll) {
    const own = await db.worker.findFirst({
      where: { companyId: member.companyId, userId: member.userId },
      select: { id: true },
    });
    if (!own || own.id !== line.workerId) {
      return NextResponse.json(
        { error: "You can only download your own payslip." },
        { status: 403 },
      );
    }
  }

  // A draft run's numbers can still change. Handing someone a payslip for a run
  // nobody has approved invites them to treat a working figure as their pay.
  if (line.payRun.status === "draft") {
    return NextResponse.json(
      { error: "This pay run hasn't been approved yet, so there's no payslip to issue." },
      { status: 409 },
    );
  }

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: {
      name: true,
      address: true,
      logoUrl: true,
      brandColor: true,
      currency: true,
    },
  });

  const pdf = await renderPayslipPdfBuffer({
    line,
    run: line.payRun,
    company,
    // The symbol only — the run stores no currency of its own, so it inherits
    // the company's billing currency rather than defaulting to a dollar sign.
    currency: currencyMeta(company?.currency).symbol,
  });

  const period = new Date(line.payRun.periodEnd).toISOString().slice(0, 10);
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="payslip-${slug(line.workerName)}-${period}.pdf"`,
      // Payslips carry pay data; no shared cache should hold one.
      "Cache-Control": "private, no-store",
    },
  });
}
