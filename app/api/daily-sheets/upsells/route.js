// app/api/daily-sheets/upsells/route.js
//
// GET ?jobId= — the add-ons the homeowner ticked on the job's quote and the
// approved change orders on the job: what a crew member can be credited
// with having sold. Amounts come from those rows; the sheet's PUT copies
// them by id and ignores any amount the browser sends for a linked row.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { linkedUpsellsForJob } from "@/lib/dailySheets/load";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ options: [] });
  const job = await db.job.findFirst({ where: { id: jobId, companyId: member.companyId }, select: { id: true } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  const { options } = await linkedUpsellsForJob({ companyId: member.companyId, jobId });
  return NextResponse.json({ options });
}
