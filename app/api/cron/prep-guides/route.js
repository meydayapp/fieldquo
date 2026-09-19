// app/api/cron/prep-guides/route.js
//
// Daily, 13:00 UTC: send the client preparation guide for every job whose
// start date is N days out, N being the company's own setting.
//
// 13:00 UTC is 09:00 in Toronto and 06:00 in Vancouver — the morning, so a
// company that set "0 days" gets the guide to the client before the crew
// leaves the yard, and every other lead lands in the client's morning inbox
// rather than at 05:00 with the other crons (see signup-recovery's header for
// the same reasoning).
//
// The rule itself — N days before, by calendar day, never after the start
// day, never twice, never to a job with no email or no date — is in
// lib/prepGuide/schedule.js and is pure, so this route reads a bounded
// window of candidates and asks it per job. The send, the claim, the
// release on failure and the filing are all lib/prepGuide/send.js's.
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { candidateStartWindow, prepGuideDecision } from "@/lib/prepGuide/schedule";
import { sendPrepGuide } from "@/lib/prepGuide/send";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const now = new Date();

  const jobs = await db.job.findMany({
    where: {
      prepGuideSentAt: null,
      prepGuideSuppressedAt: null,
      archivedAt: null,
      historicalImportedAt: null,
      status: { not: "cancelled" },
      startDate: candidateStartWindow(now),
    },
    select: {
      id: true,
      companyId: true,
      status: true,
      startDate: true,
      archivedAt: true,
      historicalImportedAt: true,
      prepGuideSentAt: true,
      prepGuideSuppressedAt: true,
      client: { select: { email: true } },
      company: { select: { prepGuideLeadDays: true } },
    },
    orderBy: { startDate: "asc" },
    // Bounded per run; the query is driven by state, so anything left is
    // picked up tomorrow rather than dropped.
    take: 200,
  });

  let sent = 0;
  const skipped = {};
  const note = (reason) => {
    skipped[reason] = (skipped[reason] || 0) + 1;
  };

  for (const job of jobs) {
    const verdict = prepGuideDecision({ job, company: job.company, client: job.client, now });
    if (!verdict.send) {
      note(verdict.reason);
      continue;
    }
    const result = await sendPrepGuide({ jobId: job.id, companyId: job.companyId }, { db, now: () => now });
    if (result.sent) sent++;
    else note(result.reason);
  }

  return NextResponse.json({ ok: true, candidates: jobs.length, sent, skipped });
}
