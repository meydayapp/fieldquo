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
//
// ── Job visits too ─────────────────────────────────────────────────────────
//
// This read the Appointment table only. A crew visit scheduled on a job is a
// JobVisit — the row the job page, the calendar and the dashboard all count —
// and it reminded nobody, while the notifications card promised a reminder
// before every visit. Both tables are read now, both pass through the same
// verdict (lib/sms/reminderPlan.js), both are claimed once, and the text is
// the same template from the same editor. The visit's client is the job's;
// its "location" is the job site, else the client's address.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { sendSms, toE164 } from "@/lib/sms/twilioClient";
import { clientSmsFrom } from "@/lib/sms/clientLine";
import { formatWhen } from "@/lib/sms/templates";
import { renderMessage } from "@/lib/sms/renderTemplate";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import { maySms } from "@/lib/sms/optOut";
import { reminderWindow, reminderVerdict } from "@/lib/sms/reminderPlan";

// Only look a week out, whatever a company's lead time is — bounds the query,
// and no sane reminder lead time exceeds it. The per-company window is applied
// in JS below.
const HORIZON_MS = 7 * 24 * 60 * 60 * 1000;

const COMPANY_SELECT = {
  id: true,
  name: true,
  appointmentReminderHours: true,
  smsFromNumber: true,
  smsTemplates: true,
  defaultLanguage: true,
  timezone: true,
};

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const now = new Date();
  const window = reminderWindow(now, HORIZON_MS);

  const [appointments, visits] = await Promise.all([
    db.appointment.findMany({
      where: {
        status: "scheduled",
        ...window,
        // Opt-in only. `not: null` skips every company that hasn't set a lead time.
        company: { appointmentReminderHours: { not: null } },
      },
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        location: true,
        // language: the text follows the client, the way the quote and the
        // covering email already do. timezone: the appointment is where the
        // company is, and formatting without a zone gave every client UTC.
        client: { select: { phone: true, language: true } },
        company: { select: COMPANY_SELECT },
      },
    }),
    db.jobVisit.findMany({
      where: {
        ...window,
        // Archived jobs are filed away; their visits leave the calendar and
        // must leave the reminders with them.
        job: { archivedAt: null, company: { appointmentReminderHours: { not: null } } },
      },
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        job: {
          select: {
            siteAddress: true,
            client: { select: { phone: true, language: true, address: true } },
            company: { select: COMPANY_SELECT },
          },
        },
      },
    }),
  ]);

  // One shape for both, so the loop below cannot treat them differently.
  const due = [
    ...appointments.map((a) => ({
      kind: "appointment",
      id: a.id,
      status: a.status,
      scheduledAt: a.scheduledAt,
      location: a.location,
      client: a.client,
      company: a.company,
    })),
    ...visits.map((v) => ({
      kind: "visit",
      id: v.id,
      status: v.status,
      scheduledAt: v.scheduledAt,
      location: v.job.siteAddress || v.job.client?.address || null,
      client: v.job.client,
      company: v.job.company,
    })),
  ];

  let sent = 0;
  let skipped = 0;

  for (const row of due) {
    const verdict = reminderVerdict(row, now, toE164);
    if (!verdict.send) {
      skipped++;
      continue;
    }
    const e164 = verdict.e164;

    // An opt-out always wins. Checked per row — reminder volume is low and
    // this is a cron, so the extra query is cheaper than the risk of texting
    // someone who asked us to stop.
    const allowed = await maySms({ companyId: row.company.id, phone: e164 });
    if (!allowed) {
      skipped++;
      continue;
    }

    // Claim it BEFORE sending — the unique-ish stamp means a concurrent run
    // can't double-text even if two invocations overlap. If the send then
    // fails, we've traded a possible missed reminder for never double-sending,
    // which is the right way round for something that costs money and goodwill.
    if (row.kind === "visit") {
      await db.jobVisit.update({ where: { id: row.id }, data: { reminderSentAt: now } });
    } else {
      await db.appointment.update({ where: { id: row.id }, data: { reminderSentAt: now } });
    }

    const language = resolveClientLanguage({ client: row.client, company: row.company });
    const result = await sendSms({
      to: e164,
      // The company's own wording when they set it and the client reads the
      // language it was written in; the built-in wording in the client's
      // language otherwise — see renderMessage.
      body: renderMessage({
        type: "appointment_reminder",
        templates: row.company.smsTemplates,
        language,
        templateLanguage: row.company.defaultLanguage || "en",
        values: {
          company: row.company.name,
          when: formatWhen(row.scheduledAt, { language, timezone: row.company.timezone }),
          location: row.location,
        },
      }),
      // The company's own number when they have one; the shared system number
      // (with the company name in the body) otherwise — the same decision the
      // inbound STOP route resolves in reverse. See lib/sms/clientLine.js.
      from: clientSmsFrom(row.company),
      // A demo's seeded clients carry plausible NANP numbers, not @example.com
      // addresses — so this cron would have texted them for real. See
      // lib/sms/demoSms.js.
      companyId: row.company.id,
    });

    if (result.success) sent++;
    else {
      skipped++;
      console.error(`[appointment-reminders] ${row.kind} ${row.id}: ${result.error}`);
    }
  }

  return NextResponse.json({ success: true, considered: due.length, sent, skipped });
}
