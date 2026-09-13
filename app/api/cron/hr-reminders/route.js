// app/api/cron/hr-reminders/route.js
//
// Daily, 07:40 UTC: the HR file's three reminders.
//
//   1. A certification or licence lapsing: the person at 30 and 7 days,
//      their managers at 7 (lib/hr/documentExpiry.js reminderDue — the
//      marks are decided there, pure, and stamped on the row so each fires
//      once).
//   2. An onboarding run: "your checklist is ready" for a run whose worker
//      had no login when it started (startRun tells the ones who did), and
//      "N items are overdue" once, then again no sooner than a week later.
//   3. A run that completed without its managers being told (a race, or a
//      run completed by the reconcile on a read) — announced now.
//
// Fleet, equipment and subcontractor expiries have no cron today; they are
// read on their own screens. Certifications get one because the person who
// has to act — book the course, renew the licence — is a crew member who
// does not open the compliance screen, and a reminder nobody sees is not a
// reminder.
//
// Daily, not hourly: the windows are measured in days. One invocation a
// day, a handful of small queries — see docs/VERCEL.md.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { reminderDue, stampForReminder } from "@/lib/hr/documentExpiry";
import { REMINDER_DAYS } from "@/lib/hr/documents";
import { overdueItems } from "@/lib/onboarding/run";
import { announceCompletion, RUN_SELECT } from "@/lib/onboarding/service";
import { notifyWorker, notifyManagers } from "@/lib/hr/notify";

const DAY_MS = 86400000;
const BATCH = 500;
const OVERDUE_REPEAT_DAYS = 7;

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const now = new Date();
  const counts = { documentsWorker: 0, documentsManager: 0, onboardingStarted: 0, onboardingOverdue: 0, onboardingCompleted: 0 };

  // ── 1. Expiring documents ─────────────────────────────────────────────
  const horizon = new Date(now.getTime() + (REMINDER_DAYS.worker[0] + 1) * DAY_MS);
  const documents = await db.workerDocument.findMany({
    where: { archivedAt: null, kind: { in: ["certification", "licence"] }, expiresAt: { not: null, gte: new Date(now.getTime() - DAY_MS), lte: horizon } },
    select: { id: true, companyId: true, workerId: true, kind: true, title: true, expiresAt: true, archivedAt: true, reminded30At: true, reminded7At: true, worker: { select: { id: true, name: true, userId: true } } },
    take: BATCH,
  });
  for (const doc of documents) {
    const due = reminderDue(doc, { asOf: now });
    if (!due.worker && !due.manager) continue;
    // Claim first, so a second run this morning finds the stamp and stops.
    const claimed = await db.workerDocument.updateMany({
      where: { id: doc.id, ...(due.worker === 30 ? { reminded30At: null } : { reminded7At: null }) },
      data: stampForReminder(due, now),
    });
    if (claimed.count === 0) continue;
    const days = Math.max(0, Math.round((doc.expiresAt.getTime() - now.getTime()) / DAY_MS));
    if (due.worker) {
      const r = await notifyWorker(doc.worker, { companyId: doc.companyId, type: "hr.document.expiring", entityId: doc.id, params: { title: doc.title, days } }, { db });
      if (r?.delivered) counts.documentsWorker += 1;
    }
    if (due.manager) {
      const r = await notifyManagers({ companyId: doc.companyId, type: "hr.document.expiringManager", entityId: doc.workerId, params: { workerName: doc.worker?.name || "", title: doc.title, days } }, { db });
      if (r?.delivered) counts.documentsManager += 1;
    }
  }

  // ── 2. Onboarding runs ────────────────────────────────────────────────
  const runs = await db.onboardingRun.findMany({
    where: { completedAt: null },
    select: { ...RUN_SELECT, companyId: true, dayOneNotifiedAt: true, overdueNotifiedAt: true, worker: { select: { id: true, name: true, userId: true } } },
    take: BATCH,
  });
  for (const run of runs) {
    if (!run.worker?.userId) continue;
    if (!run.dayOneNotifiedAt) {
      const claimed = await db.onboardingRun.updateMany({ where: { id: run.id, dayOneNotifiedAt: null }, data: { dayOneNotifiedAt: now } });
      if (claimed.count) {
        const open = (run.items || []).filter((it) => it.status !== "done").length;
        const r = await notifyWorker(run.worker, { companyId: run.companyId, type: "hr.onboarding.started", entityId: run.id, params: { count: open } }, { db });
        if (r?.delivered) counts.onboardingStarted += 1;
      }
    }
    const overdue = overdueItems(run.items, run.startedAt, now);
    const repeatAfter = run.overdueNotifiedAt ? new Date(run.overdueNotifiedAt.getTime() + OVERDUE_REPEAT_DAYS * DAY_MS) : null;
    if (overdue.length && (!repeatAfter || repeatAfter <= now)) {
      const claimed = await db.onboardingRun.updateMany({
        where: { id: run.id, ...(run.overdueNotifiedAt ? { overdueNotifiedAt: run.overdueNotifiedAt } : { overdueNotifiedAt: null }) },
        data: { overdueNotifiedAt: now },
      });
      if (claimed.count) {
        const r = await notifyWorker(run.worker, { companyId: run.companyId, type: "hr.onboarding.overdue", entityId: run.id, params: { count: overdue.length } }, { db });
        if (r?.delivered) counts.onboardingOverdue += 1;
      }
    }
  }

  // ── 3. Completed, not yet announced ───────────────────────────────────
  const completed = await db.onboardingRun.findMany({
    where: { completedAt: { not: null }, completedNotifiedAt: null },
    select: { ...RUN_SELECT, companyId: true },
    take: BATCH,
  });
  for (const run of completed) {
    await announceCompletion(db, run, { companyId: run.companyId });
    counts.onboardingCompleted += 1;
  }

  return NextResponse.json({ success: true, ...counts });
}
