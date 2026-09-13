// app/api/hr/me/tax-forms/route.js
//
// A new hire answers the TD1 / W-4 questions and signs with their name.
// The answers are kept (TaxFormSubmission) and rendered to a PDF on demand;
// nothing is sent anywhere. The form kinds offered are the company's
// country's (lib/hr/taxForms.js) — a US company never sees a TD1.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hrSelfOrRefusal } from "@/lib/hr/gate";
import { parseTaxFormBody, taxFormKindsForCountry, TAX_FORM_FIELDS, TAX_FORM_COUNTRY } from "@/lib/hr/taxForms";
import { resolveCountry } from "@/lib/company/resolveCountry";
import { reconcileRunsForWorker } from "@/lib/onboarding/service";
import { clientIp } from "@/lib/rateLimit";

const SELECT = { id: true, formKind: true, taxYear: true, signatureName: true, submittedAt: true };

export async function GET(request) {
  const { member, worker, response } = await hrSelfOrRefusal(request);
  if (response) return response;
  const company = await db.company.findUnique({ where: { id: member.companyId }, select: { country: true, address: true, province: true } });
  const { country } = resolveCountry(company || {});
  const submissions = await db.taxFormSubmission.findMany({
    where: { companyId: member.companyId, workerId: worker.id },
    select: SELECT,
    orderBy: { submittedAt: "desc" },
  });
  return NextResponse.json({
    country,
    kinds: taxFormKindsForCountry(country),
    fields: TAX_FORM_FIELDS,
    submissions,
  });
}

export async function POST(request) {
  const { member, worker, response } = await hrSelfOrRefusal(request);
  if (response) return response;

  const raw = await request.json().catch(() => ({}));
  const parsed = parseTaxFormBody(raw);
  if (parsed.error) return NextResponse.json({ error: parsed.error, field: parsed.field || null }, { status: 400 });

  const company = await db.company.findUnique({ where: { id: member.companyId }, select: { country: true, address: true, province: true } });
  const { country } = resolveCountry(company || {});
  if (TAX_FORM_COUNTRY[parsed.data.formKind] !== country) {
    return NextResponse.json({ error: "That form isn't the one for this company's country." }, { status: 400 });
  }

  const submission = await db.taxFormSubmission.create({
    data: {
      ...parsed.data,
      companyId: member.companyId,
      workerId: worker.id,
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent")?.slice(0, 300) || null,
    },
    select: SELECT,
  });
  await reconcileRunsForWorker(db, { companyId: member.companyId, workerId: worker.id, actorUserId: member.userId });
  return NextResponse.json({ submission }, { status: 201 });
}
