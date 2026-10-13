// app/api/cron/tender-reminders/route.js
//
// Hourly at :17 — tender deadline reminders to the company's own team:
// Q&A deadline −2 days, site visit −1 day, closing −3 days / −1 day /
// −3 hours, each once, in the tender's own time zone. The rules are
// lib/tenders/time.js (when) and lib/tenders/reminders.js (once, and to whom
// — the bell and Web Push, never an email or text, never the buyer).
//
// Hourly, not daily, because of the three-hour mark: a daily run would ring
// a 14:00 closing at 07:00 or not at all. One invocation an hour, one indexed
// query over open tenders and a feature lookup per company that has any —
// see docs/VERCEL.md.
//
// A company whose `tenders` feature is hidden or locked is skipped: the
// reminders follow the screens (lib/features/registry.js).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { notifyEvent } from "@/lib/notifications/notify";
import { featureAllowsSpend } from "@/lib/features/gate";
import { runTenderReminders } from "@/lib/tenders/reminders";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  // featureAllowsSpend is "is this feature usable for this company" (on or
  // preview) — the cron-side question every feature with scheduled work asks.
  // Tenders spend nothing at a vendor; the name is the gate's, not a claim.
  const counts = await runTenderReminders({
    db,
    notify: (args) => notifyEvent(args),
    featureAllowed: (companyId) => featureAllowsSpend(companyId, "tenders"),
    now: new Date(),
  });
  return NextResponse.json({ success: true, ...counts });
}
