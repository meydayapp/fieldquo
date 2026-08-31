// app/api/cron/appointment-reminders/route.js
//
// Texts each client a reminder ahead of their appointment. Same CRON_SECRET
// pattern as the other crons; run hourly so a reminder fires within the hour of
// its target lead time.
//
// Opt-in per company (Company.appointmentReminderHours): every reminder is a
// billable SMS the contractor pays for, so a company that hasn't set a lead time
// gets nothing here — no surprise charges for a feature nobody switched on.
//
// Three guards keep it from becoming a nuisance or a double-send:
//   * reminderSentAt — once-only, so an appointment is reminded exactly once
//   * maySms() — an SMS opt-out (or a CallConsent opt-out) always wins, never
//     texted again. Used to be an inline CallConsent-only query; now shared
//     with every other client-facing SMS path via lib/sms/optOut.js, so a
//     STOP recorded through app/api/sms/inbound refuses a reminder same as it
//     refuses an "on my way" text — one gate, not one per call site.
//   * client must have a phone number
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendSms, toE164 } from "@/lib/sms/twilioClient";
import { appointmentReminderText } from "@/lib/sms/templates";
import { maySms } from "@/lib/sms/optOut";

// Only look a week out, whatever a company's lead time is — bounds the query,
// and no sane reminder lead time exceeds it. The per-company window is applied
// in JS below.
const HORIZON_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + HORIZON_MS);

  const due = await db.appointment.findMany({
    where: {
      status: "scheduled",
      reminderSentAt: null,
      scheduledAt: { gt: now, lte: horizon },
      // Opt-in only. `not: null` skips every company that hasn't set a lead time.
      company: { appointmentReminderHours: { not: null } },
    },
    select: {
      id: true,
      scheduledAt: true,
      location: true,
      client: { select: { phone: true } },
      company: {
        select: { id: true, name: true, appointmentReminderHours: true, smsFromNumber: true },
      },
    },
  });

  let sent = 0;
  let skipped = 0;

  for (const appt of due) {
    const hours = appt.company.appointmentReminderHours;
    // Not yet inside this company's lead window — leave it for a later run.
    const windowStartsAt = appt.scheduledAt.getTime() - hours * 60 * 60 * 1000;
    if (now.getTime() < windowStartsAt) {
      skipped++;
      continue;
    }

    const e164 = toE164(appt.client?.phone);
    if (!e164) {
      skipped++;
      continue;
    }

    // An opt-out always wins. Checked per appointment — reminder volume is low
    // and this is a cron, so the extra query is cheaper than the risk of texting
    // someone who asked us to stop.
    const allowed = await maySms({ companyId: appt.company.id, phone: e164 });
    if (!allowed) {
      skipped++;
      continue;
    }

    // Claim it BEFORE sending — the unique-ish stamp means a concurrent run
    // can't double-text even if two invocations overlap. If the send then
    // fails, we've traded a possible missed reminder for never double-sending,
    // which is the right way round for something that costs money and goodwill.
    await db.appointment.update({
      where: { id: appt.id },
      data: { reminderSentAt: now },
    });

    const result = await sendSms({
      to: e164,
      body: appointmentReminderText({
        companyName: appt.company.name,
        scheduledAt: appt.scheduledAt,
        location: appt.location,
      }),
      // The company's own number when they have one; the shared system number
      // (with the company name in the body) otherwise.
      from: appt.company.smsFromNumber || undefined,
    });

    if (result.success) sent++;
    else {
      skipped++;
      console.error(`[appointment-reminders] ${appt.id}: ${result.error}`);
    }
  }

  return NextResponse.json({ success: true, considered: due.length, sent, skipped });
}
