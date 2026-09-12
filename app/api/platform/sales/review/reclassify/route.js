// app/api/platform/sales/review/reclassify/route.js
//
// The one-off re-classification of licence-register rows, from the Review
// folder's maintenance panel. Dry run by default; `{ apply: true }` writes.
//
// lib/sales/discovery/reclassifyRegisters.js carries the reasoning and the
// counter arithmetic. This route only adds the gate and the time budget: a
// real run over ~117,000 rows is minutes of paged updateMany calls, which is
// why maxDuration is the cron's 300 rather than the default. The same
// function is runnable from a laptop — scripts/reclassify-licence-registers.mjs
// — for the case where the deployment's budget is not enough.
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { reclassifyLicenceRegisterRows } from "@/lib/sales/discovery/reclassifyRegisters";

export async function POST(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => ({}));
  const apply = body?.apply === true;
  try {
    const result = await reclassifyLicenceRegisterRows({ db, dryRun: !apply, now: new Date(), adminId: admin.id });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[platform/sales/review/reclassify]", err);
    return NextResponse.json({ error: err?.message || "The reclassification did not finish." }, { status: 500 });
  }
}
