// app/api/cron/recurring-jobs/route.js
//
// Keeps every active recurring job supplied with its next visit. Same
// CRON_SECRET pattern as the other crons (see follow-ups). The real work is
// ensureUpcomingVisit in lib/jobs/recurrence.js, which is idempotent — this just
// fans it across every recurring job once a day. The visit-completion path calls
// the same helper the instant a visit is closed, so the next one appears without
// waiting for the nightly run; this cron is the backstop for visits that lapse
// without ever being marked complete.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureUpcomingVisit } from "@/lib/jobs/recurrence";

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await db.job.findMany({
    where: { recurring: true, status: { notIn: ["completed", "cancelled"] } },
    select: { id: true },
  });

  let created = 0;
  for (const job of jobs) {
    try {
      const visit = await ensureUpcomingVisit(db, job.id);
      if (visit) created += 1;
    } catch (err) {
      // One malformed job must not stop the run for all the others.
      console.error(`[recurring-jobs] ${job.id}:`, err.message);
    }
  }

  return NextResponse.json({ success: true, jobsChecked: jobs.length, created });
}
