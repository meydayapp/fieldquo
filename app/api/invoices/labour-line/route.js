// app/api/invoices/labour-line/route.js
//
// GET ?jobId=…  — the "add today's clocked hours" offer for the invoice
// editor: which of the job's clock-ins can be billed, by whom, and at which
// of the company's hourly rates. Everything money-shaped in the answer is
// the server's (the rate options come from lib/invoices/labourRates.js);
// the editor shows it and posts back ids and a rate key, never a number.
//
// Cached by public/sw.js like the other editor reads, so the offer is still
// on the phone in a basement — built from the last clock-ins the phone saw,
// which the bar's "sends when you're back online" sentence covers.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { partitionBillable, hoursByWorker, sumHours } from "@/lib/invoices/labourLine";
import { labourRateOptions } from "@/lib/invoices/labourRates";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { response: denied } = await levelOrRefusal(member, "invoices", "view_create_edit", "create invoices");
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });

  const job = await db.job.findFirst({
    where: { id: jobId, companyId: member.companyId },
    select: { id: true, title: true, clientId: true, client: { select: { id: true, name: true } } },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const [entries, rates] = await Promise.all([
    db.timeEntry.findMany({
      where: { jobId: job.id, worker: { companyId: member.companyId } },
      orderBy: { clockIn: "asc" },
      select: {
        id: true, clockIn: true, clockOut: true, hours: true, status: true, billedInvoiceId: true,
        worker: { select: { name: true } },
      },
    }),
    labourRateOptions(db, member.companyId),
  ]);

  const { billable, skipped } = partitionBillable(entries);
  return NextResponse.json({
    job: { id: job.id, title: job.title, clientId: job.clientId, clientName: job.client?.name || "" },
    entries: billable.map((e) => ({
      id: e.id,
      workerName: e.worker?.name || "",
      clockIn: e.clockIn,
      clockOut: e.clockOut,
      hours: e.hours,
    })),
    hours: sumHours(entries),
    byWorker: hoursByWorker(entries),
    // Why the rest were left out — the editor says "1 still clocked in" rather
    // than silently offering fewer hours than the person can see on the clock.
    skipped: skipped.reduce((acc, s) => ({ ...acc, [s.reason]: (acc[s.reason] || 0) + 1 }), {}),
    rates,
  });
}
