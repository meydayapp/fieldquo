// scripts/check-visit-reminders.mjs
//
//   npm run check:visit-reminders
//
// The reminder text reached Appointment rows and nothing else. A crew visit
// scheduled on a job — JobVisit, the row the job page, the calendar and the
// dashboard all count — reminded nobody, while Settings → Notifications
// promised a reminder before every visit.
//
// This drives the REAL verdict (lib/sms/reminderPlan.js) that both kinds now
// pass through, against a crafted week: the window, the once-only claim, a
// cancelled visit, a missing phone. Then it reads the cron to confirm both
// tables are queried, both are claimed before the send, and both render the
// same template through the same opt-out gate. Nothing here opens a
// connection.

import { readFileSync } from "node:fs";
import { reminderVerdict, reminderWindow } from "@/lib/sms/reminderPlan";
import { toE164 } from "@/lib/sms/twilioClient";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const NOW = new Date("2026-08-24T13:00:00Z");
const hoursOut = (h) => new Date(NOW.getTime() + h * 3_600_000);
const company = (hours) => ({ id: "cmp", appointmentReminderHours: hours });
const row = (over = {}) => ({
  kind: "visit",
  id: "v1",
  status: "scheduled",
  scheduledAt: hoursOut(20),
  client: { phone: "(613) 555-0142" },
  company: company(24),
  ...over,
});

console.log("\n1. The window rules, for a visit exactly as for an appointment\n");
{
  const v = reminderVerdict(row(), NOW, toE164);
  ok("20 h out with a 24 h lead time: send", v.send === true && v.e164 === "+16135550142", v);
  const a = reminderVerdict(row({ kind: "appointment" }), NOW, toE164);
  ok("the same row as an appointment gets the same verdict", a.send === v.send && a.e164 === v.e164, a);
  const early = reminderVerdict(row({ scheduledAt: hoursOut(30) }), NOW, toE164);
  ok("30 h out: not yet — left for a later run", early.send === false && early.reason === "not_yet", early);
  const edge = reminderVerdict(row({ scheduledAt: hoursOut(24) }), NOW, toE164);
  ok("exactly at the lead time: send", edge.send === true, edge);
  const none = reminderVerdict(row({ company: company(null) }), NOW, toE164);
  ok("a company with no lead time set gets nothing (opt-in)", none.send === false && none.reason === "no_lead_time", none);
  const zero = reminderVerdict(row({ company: company(0) }), NOW, toE164);
  ok("a zero lead time is off, not 'immediately'", zero.send === false && zero.reason === "no_lead_time", zero);
}

console.log("\n2. Who is not reminded\n");
{
  for (const status of ["cancelled", "canceled", "completed"]) {
    const v = reminderVerdict(row({ status }), NOW, toE164);
    ok(`a ${status} visit reminds nobody`, v.send === false && v.reason === "cancelled", v);
  }
  const noPhone = reminderVerdict(row({ client: { phone: null } }), NOW, toE164);
  ok("no phone: no text, said as no_phone", noPhone.send === false && noPhone.reason === "no_phone", noPhone);
  const badPhone = reminderVerdict(row({ client: { phone: "call the office" } }), NOW, toE164);
  ok("an unparseable phone is no phone", badPhone.send === false && badPhone.reason === "no_phone", badPhone);
  const garbage = reminderVerdict(row({ scheduledAt: "soon" }), NOW, toE164);
  ok("an unreadable time never sends", garbage.send === false, garbage);
  ok("a null row does not throw", reminderVerdict(null, NOW, toE164).send === false);
}

console.log("\n3. The shared query window\n");
{
  const w = reminderWindow(NOW, 7 * 24 * 3_600_000);
  ok("never reminded before (the once-only claim)", w.reminderSentAt === null);
  ok("due after now and inside the horizon", w.scheduledAt.gt === NOW && w.scheduledAt.lte.getTime() === NOW.getTime() + 7 * 24 * 3_600_000, w);
}

console.log("\n4. The cron reads both tables and treats them alike\n");
{
  const cron = code(read("app/api/cron/appointment-reminders/route.js"));
  ok("appointments are queried", /db\.appointment\.findMany\(/.test(cron));
  ok("job visits are queried", /db\.jobVisit\.findMany\(/.test(cron));
  ok("…excluding archived jobs", /archivedAt: null/.test(cron));
  ok("…for companies that opted in", (cron.match(/appointmentReminderHours: \{ not: null \}/g) || []).length === 2);
  ok("both go through reminderVerdict", /reminderVerdict\(row, now, toE164\)/.test(cron));
  ok("both are claimed BEFORE the send — once-only", /jobVisit\.update\(\{ where: \{ id: row\.id \}, data: \{ reminderSentAt: now \} \}\)/.test(cron) && /appointment\.update\(\{ where: \{ id: row\.id \}, data: \{ reminderSentAt: now \} \}\)/.test(cron));
  ok("…and the claim precedes sendSms", cron.indexOf("reminderSentAt: now") < cron.indexOf("await sendSms("));
  ok("both pass the STOP gate", /maySms\(\{ companyId: row\.company\.id/.test(cron));
  ok("both render the same template through renderMessage", /type: "appointment_reminder"/.test(cron) && (cron.match(/renderMessage\(/g) || []).length === 1);
  ok("a visit's location is the job site, else the client's address", /siteAddress \|\| v\.job\.client\?\.address/.test(cron));

  const schema = read("prisma/schema.prisma");
  const visitModel = schema.match(/model JobVisit \{[\s\S]*?\n\}/)[0];
  ok("JobVisit.reminderSentAt exists to hold the claim", /reminderSentAt\s+DateTime\?/.test(visitModel));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
