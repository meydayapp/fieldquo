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
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { assignedJobWhere } from "@/lib/permissions/enforce";
import { seesUpsells } from "@/lib/dailySheets/access";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  // ── Only a job this member can open ────────────────────────────────────
  //
  // Was a session check and a company check: any member could read the
  // add-on prices and agreed change-order amounts of ANY job in the company
  // by id (the 2026-10-03 role-access audit), and only for the jobs they are
  // on, the same scope as every job route.
  //
  // ── …and only for someone who sells (owner, 2026-10-04) ────────────────
  //
  // This used to keep the amounts for crew, as their bonus base. The owner's
  // ruling: crew do not sell, so they do not see upsell amounts at all —
  // estimators and up only (lib/dailySheets/access.js seesUpsells). Refused
  // outright rather than shaped: the options ARE amounts, and a list of
  // add-ons without them is not something the sheet offers a crew member.
  const { full, response: denied } = await levelOrRefusal(member, "jobs", "view_only", "see jobs");
  if (denied) return denied;
  if (!seesUpsells(full)) {
    return NextResponse.json(
      { error: "Upsells are recorded by the people who sell — an estimator, a manager or the owner.", code: "upsells_hidden" },
      { status: 403 },
    );
  }
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ options: [] });
  const job = await db.job.findFirst({
    where: { id: jobId, companyId: member.companyId, ...assignedJobWhere(full) },
    select: { id: true },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  const { options } = await linkedUpsellsForJob({ companyId: member.companyId, jobId });
  return NextResponse.json({ options });
}
