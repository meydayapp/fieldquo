// app/api/hr/tax-forms/[id]/pdf/route.js
//
// The submitted form as a sheet the payroll admin keeps. Readable by a
// manager (user:manage) or by the person who signed it — nobody else — and
// rendered from the stored answers on every request, never stored as a
// file. The renderer is imported lazily, like every other PDF route, so
// the engine is not in the module graph of a page that never prints.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { canManageHr, myWorker } from "@/lib/hr/access";

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const submission = await db.taxFormSubmission.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true, workerId: true, formKind: true, taxYear: true, fields: true, signatureName: true, submittedAt: true },
  });
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canManageHr(member)) {
    const mine = await myWorker(db, member);
    if (!mine || mine.id !== submission.workerId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [worker, company] = await Promise.all([
    db.worker.findFirst({ where: { id: submission.workerId, companyId: member.companyId }, select: { name: true } }),
    db.company.findUnique({ where: { id: member.companyId }, select: { name: true, defaultLanguage: true } }),
  ]);
  const { renderTaxFormPdfBuffer } = await import("@/lib/hr/renderTaxFormPdf");
  const pdf = await renderTaxFormPdfBuffer({ submission, workerName: worker?.name || "", companyName: company?.name || "", language: company?.defaultLanguage || "en" });
  const slug = (s) => String(s || "form").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${submission.formKind}-${slug(worker?.name)}-${submission.taxYear}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
