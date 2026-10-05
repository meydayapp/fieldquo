// scripts/check-appointment-outcomes.mjs
//
//   npm run check:appointment-outcomes
//
// What happened at a past visit — held, no-show, rescheduled, cancelled — and
// the daily "Did this visit happen?" nudge (2026-10-05). Executed, not read:
// the pure rules (lib/appointments/outcome.js), the calendar's buttons
// (lib/appointments/statusLabels.js appointmentActions), the outcome route
// and the cron route themselves against an in-memory store
// (scripts/fixtures/memoryPrisma.mjs) as a Crew member, a Dispatcher and an
// owner:
//
//   1. the rules: who may mark, only once the time has passed, one ask per
//      visit inside the week, the assignee else the booker;
//   2. the buttons: a past open visit asks the four outcomes, a future one
//      keeps the office moves, a no-show reopens; every status labelled in
//      nine languages;
//   3. the route: crew mark their own visits only (another's is a blind 404,
//      an unassigned one a 403), never a future one, nobody written to;
//   4. the cron: the secret, one notification per visit to its one person,
//      none twice, none outside the week or for a marked or future visit;
//   5. wiring: the calendar posts to the route, rebooks after "rescheduled",
//      the nudge's link opens the visit, the cron is scheduled.
//
// Ends with a mutation pass over lib/appointments/outcome.js (cp backups).

import { readFileSync, writeFileSync, copyFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MUTANT = process.argv.includes("--mutant");
const route = (rel) => import(pathToFileURL(join(ROOT, rel)).href);
const code = (rel) => readFileSync(join(ROOT, rel), "utf8");

const { OUTCOME_STATUS, OUTCOMES, mayMarkOutcome, needsOutcome, dueForNudge, nudgeRecipient, nudgeWindow, visitWhen } = await import("@/lib/appointments/outcome");
const { appointmentActions, appointmentStatusLabel, APPOINTMENT_STATUS_PRESENTATION, APPOINTMENT_FILTERS } = await import("@/lib/appointments/statusLabels");
const { PERMISSION_PRESETS } = await import("@/lib/permissions");
const { hrefFor } = await import("@/lib/notifications/render");
const { APP_MESSAGES } = await import("@/app/i18n/appMessages");
const { db } = await import("@/lib/db");
const { session } = await import("@/lib/apiMember");

let pass = 0;
const fails = [];
const ok = (label, cond, got) => {
  if (cond) {
    pass++;
    if (!MUTANT) console.log(`  ✓ ${label}`);
  } else {
    fails.push(`${label}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
    if (!MUTANT) console.log(`  ✗ ${label}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
};
const section = (t) => !MUTANT && console.log(`\n${t}`);
const NOW = new Date();
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3600_000);

// ═══════════════════════════════════════════════════════════════════════════
section("1. The rules");
// ═══════════════════════════════════════════════════════════════════════════
ok("held is the existing `completed`, cancelled the existing `cancelled`; only no_show and rescheduled are new", OUTCOME_STATUS.held === "completed" && OUTCOME_STATUS.cancelled === "cancelled" && OUTCOME_STATUS.no_show === "no_show" && OUTCOME_STATUS.rescheduled === "rescheduled" && OUTCOMES.length === 4);
const schema = code("prisma/schema.prisma");
const enumBody = schema.match(/enum AppointmentStatus \{([\s\S]*?)\}/)[1].replace(/\/\/\/.*$/gm, "");
const enumValues = enumBody.split(/\s+/).filter(Boolean);
ok("AppointmentStatus holds every outcome's status", Object.values(OUTCOME_STATUS).every((s) => enumValues.includes(s)), enumValues);
const past = { scheduledAt: hoursAgo(5), status: "scheduled", assignedToId: "u_crew" };
ok("the assignee may mark their own past visit", mayMarkOutcome({ appt: past, outcome: "no_show", userId: "u_crew" }).ok === true);
ok("another crew member may not", mayMarkOutcome({ appt: past, outcome: "no_show", userId: "u_other" }).reason === "not_yours");
ok("an unassigned visit needs edit_all", mayMarkOutcome({ appt: { ...past, assignedToId: null }, outcome: "held", userId: "u_crew" }).reason === "not_yours" && mayMarkOutcome({ appt: { ...past, assignedToId: null }, outcome: "held", userId: "u_disp", hasEditAll: true }).ok === true);
ok("…and a null user never matches a null assignee", mayMarkOutcome({ appt: { ...past, assignedToId: null }, outcome: "held", userId: null }).reason === "not_yours");
ok("not before its time", mayMarkOutcome({ appt: { ...past, scheduledAt: new Date(NOW.getTime() + 3600_000) }, outcome: "held", userId: "u_crew" }).reason === "not_yet");
ok("an outcome outside the four is refused", ["", "completed", "noshow", null, "scheduled"].every((o) => mayMarkOutcome({ appt: past, outcome: o, userId: "u_crew" }).reason === "bad_outcome"));
ok("needsOutcome: past and open (scheduled / needs_supervisor) only", needsOutcome(past, NOW) && needsOutcome({ ...past, status: "needs_supervisor" }, NOW) && !needsOutcome({ ...past, status: "completed" }, NOW) && !needsOutcome({ ...past, status: "no_show" }, NOW) && !needsOutcome({ ...past, scheduledAt: new Date(NOW.getTime() + 60_000) }, NOW));
ok("the nudge asks the assignee, else whoever booked it", nudgeRecipient({ assignedToId: "a", createdById: "b" }) === "a" && nudgeRecipient({ assignedToId: null, createdById: "b" }) === "b" && nudgeRecipient({}) === null);
const w = nudgeWindow(NOW);
ok("the window: over at least two hours, at most a week back", NOW.getTime() - w.lte.getTime() === 2 * 3600_000 && NOW.getTime() - w.gte.getTime() === 7 * 24 * 3600_000);
const cands = [
  { id: "a1", status: "scheduled", scheduledAt: hoursAgo(5), assignedToId: "u1" },
  { id: "a2", status: "scheduled", scheduledAt: hoursAgo(1), assignedToId: "u1" }, // not over
  { id: "a3", status: "scheduled", scheduledAt: hoursAgo(24 * 8), assignedToId: "u1" }, // older than the week
  { id: "a4", status: "completed", scheduledAt: hoursAgo(5), assignedToId: "u1" }, // marked
  { id: "a5", status: "needs_supervisor", scheduledAt: hoursAgo(30), assignedToId: null, createdById: "u2" },
  { id: "a6", status: "scheduled", scheduledAt: hoursAgo(30), assignedToId: null, createdById: null }, // nobody to ask
  { id: "a7", status: "scheduled", scheduledAt: hoursAgo(10), assignedToId: "u1" }, // already asked
];
ok("dueForNudge: over, inside the week, open, somebody to ask, not asked before", JSON.stringify(dueForNudge(cands, { now: NOW, asked: new Set(["a7"]) }).map((a) => a.id)) === JSON.stringify(["a1", "a5"]), dueForNudge(cands, { now: NOW, asked: new Set(["a7"]) }).map((a) => a.id));
ok("the nudge's time is in the reader's language and the company's zone", /lun\.|lundi/i.test(visitWhen("2026-10-05T14:00:00Z", { language: "fr", timeZone: "America/Toronto" })) && /10/.test(visitWhen("2026-10-05T14:00:00Z", { language: "en", timeZone: "America/Toronto" })), visitWhen("2026-10-05T14:00:00Z", { language: "fr", timeZone: "America/Toronto" }));

// ═══════════════════════════════════════════════════════════════════════════
section("2. The calendar's buttons");
// ═══════════════════════════════════════════════════════════════════════════
const pastActs = appointmentActions("scheduled", { scheduledAt: hoursAgo(3), now: NOW });
ok("a past open visit asks the four outcomes, each one tap with its outcome", JSON.stringify(pastActs.map((a) => a.outcome)) === JSON.stringify(["held", "no_show", "rescheduled", "cancelled"]) && pastActs.every((a) => a.office && OUTCOME_STATUS[a.outcome] === a.to));
ok("…a needs-supervisor visit too", appointmentActions("needs_supervisor", { scheduledAt: hoursAgo(3), now: NOW }).length === 4);
ok("a future visit keeps the office moves (complete, cancel with its letter), no outcome", appointmentActions("scheduled", { scheduledAt: new Date(NOW.getTime() + 3600_000), now: NOW }).every((a) => !a.outcome) && appointmentActions("scheduled", { scheduledAt: new Date(NOW.getTime() + 3600_000), now: NOW }).some((a) => a.cancels));
ok("a caller that passes no time gets what it always got", JSON.stringify(appointmentActions("scheduled").map((a) => a.to)) === JSON.stringify(["completed", "cancelled"]));
ok("a no-show or a reschedule recorded by mistake reopens", ["no_show", "rescheduled"].every((s) => JSON.stringify(appointmentActions(s).map((a) => a.to)) === JSON.stringify(["scheduled"])));
const langs = Object.keys(APP_MESSAGES);
const keysUsed = [
  ...pastActs.map((a) => a.labelKey),
  APPOINTMENT_STATUS_PRESENTATION.no_show.labelKey,
  APPOINTMENT_STATUS_PRESENTATION.rescheduled.labelKey,
  "app.visitOutcome.question",
  "app.visitOutcome.saved",
  "app.notif.type.appointment.outcomeNeeded",
];
const missing = keysUsed.flatMap((k) => langs.filter((l) => typeof APP_MESSAGES[l][k] !== "string").map((l) => `${l}:${k}`));
ok(`every outcome string in all ${langs.length} languages`, langs.length === 9 && missing.length === 0, missing.slice(0, 8));
ok("the badges: No-show, Rescheduled — never the raw column", appointmentStatusLabel("no_show") === "No-show" && appointmentStatusLabel("rescheduled") === "Rescheduled");
ok("the filter chips can list no-shows and reschedules", APPOINTMENT_FILTERS.includes("no_show") && APPOINTMENT_FILTERS.includes("rescheduled"));

// ═══════════════════════════════════════════════════════════════════════════
section("3. The outcome route");
// ═══════════════════════════════════════════════════════════════════════════
const CO = "co_out";
async function seed() {
  db.__reset();
  await db.company.create({ data: { id: CO, name: "Out Painting", slug: "out-painting", timezone: "America/Toronto", defaultLanguage: "en" } });
  await db.company.create({ data: { id: "co_other", name: "Other", slug: "other-co" } });
  for (const [u, lang] of [["u_owner", "en"], ["u_crew", "fr"], ["u_crew2", "en"], ["u_disp", "en"]]) await db.user.create({ data: { id: u, email: `${u}@x.test`, name: u, language: lang } });
  await db.member.create({ data: { id: "m_owner", userId: "u_owner", companyId: CO, role: "owner", active: true, permissions: null } });
  await db.member.create({ data: { id: "m_crew", userId: "u_crew", companyId: CO, role: "employee", active: true, permissions: { ...PERMISSION_PRESETS.worker.values } } });
  await db.member.create({ data: { id: "m_crew2", userId: "u_crew2", companyId: CO, role: "employee", active: true, permissions: { ...PERMISSION_PRESETS.worker.values } } });
  await db.member.create({ data: { id: "m_disp", userId: "u_disp", companyId: CO, role: "supervisor", active: true, permissions: { ...PERMISSION_PRESETS.dispatcher.values } } });
  await db.client.create({ data: { id: "cl_1", companyId: CO, name: "Jane Client", email: "jane@client.test", phone: "+16135550100" } });
  const mk = (id, scheduledAt, extra = {}) => db.appointment.create({ data: { id, companyId: CO, clientId: "cl_1", scheduledAt, status: "scheduled", createdById: "u_owner", assignedToId: "u_crew", createdAt: hoursAgo(24 * 10), cancelReason: null, ...extra } });
  await mk("ap_mine", hoursAgo(5));
  await mk("ap_theirs", hoursAgo(5), { assignedToId: "u_crew2" });
  await mk("ap_unassigned", hoursAgo(26), { assignedToId: null });
  await mk("ap_future", new Date(NOW.getTime() + 24 * 3600_000));
  await mk("ap_old", hoursAgo(24 * 9));
  await mk("ap_recent", hoursAgo(1));
  await mk("ap_marked", hoursAgo(30), { status: "completed" });
  await mk("ap_cancel_reason", hoursAgo(28), { assignedToId: "u_crew2", status: "cancelled", cancelReason: "rain" });
  await db.appointment.create({ data: { id: "ap_foreign", companyId: "co_other", clientId: "cl_x", scheduledAt: hoursAgo(5), status: "scheduled", createdById: "u_x", assignedToId: "u_crew", createdAt: hoursAgo(48) } });
}
await seed();
const { POST } = await route("app/api/appointments/[id]/outcome/route.js");
const as = (memberId, userId, role) => ({ id: memberId, userId, companyId: CO, role });
const post = async (who, id, body) => {
  session.member = who;
  const res = await POST(new Request(`http://x/api/appointments/${id}/outcome`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
  return { status: res.status, body: await res.json().catch(() => null) };
};
const row = async (id) => db.appointment.findFirst({ where: { id } });
const CREW = as("m_crew", "u_crew", "employee");
const DISP = as("m_disp", "u_disp", "supervisor");

session.member = null;
ok("nobody signed in → 401", (await post(null, "ap_mine", { outcome: "held" })).status === 401);
const mine = await post(CREW, "ap_mine", { outcome: "no_show" });
ok("Crew marks their own past visit a no-show → 200, stored no_show", mine.status === 200 && (await row("ap_mine")).status === "no_show", mine);
const theirs = await post(CREW, "ap_theirs", { outcome: "held" });
ok("Crew on a colleague's visit → the blind 404, nothing written", theirs.status === 404 && (await row("ap_theirs")).status === "scheduled", theirs);
const unassigned = await post(CREW, "ap_unassigned", { outcome: "held" });
ok("Crew on an unassigned visit (which they can see) → 403 with who to ask, nothing written", unassigned.status === 403 && unassigned.body?.code === "not_yours" && (await row("ap_unassigned")).status === "scheduled", unassigned);
const future = await post(CREW, "ap_future", { outcome: "no_show" });
ok("a visit whose time has not come → 409, nothing written", future.status === 409 && future.body?.code === "not_yet" && (await row("ap_future")).status === "scheduled", future);
const bad = await post(CREW, "ap_recent", { outcome: "completed" });
ok("an outcome outside the four → 400", bad.status === 400 && (await row("ap_recent")).status === "scheduled", bad);
const foreign = await post(CREW, "ap_foreign", { outcome: "held" });
ok("another company's appointment → 404, untouched", foreign.status === 404 && (await row("ap_foreign")).status === "scheduled");
const disp = await post(DISP, "ap_theirs", { outcome: "held" });
ok("a Dispatcher (edit everyone's schedule) marks a colleague's visit held → stored `completed`", disp.status === 200 && (await row("ap_theirs")).status === "completed", disp);
const resched = await post(DISP, "ap_unassigned", { outcome: "rescheduled" });
ok("…and an unassigned one rescheduled", resched.status === 200 && (await row("ap_unassigned")).status === "rescheduled");
const corrected = await post(CREW, "ap_mine", { outcome: "held" });
ok("a wrong answer can be corrected (no-show → held)", corrected.status === 200 && (await row("ap_mine")).status === "completed");
const reheld = await post(DISP, "ap_cancel_reason", { outcome: "held" });
ok("an earlier office cancel's reason is cleared when the outcome is not a cancel", reheld.status === 200 && (await row("ap_cancel_reason")).cancelReason === null);
const routeSrc = code("app/api/appointments/[id]/outcome/route.js");
ok("the route writes nobody: no client letter, no text, no time change", !/notifyClient|textClientOf|sendEmail|sendSms|clientNotice|changeText/.test(routeSrc.replace(/\/\/.*$/gm, "")) && !/data: \{[^}]*scheduledAt/.test(routeSrc));

// ═══════════════════════════════════════════════════════════════════════════
section("4. The daily nudge");
// ═══════════════════════════════════════════════════════════════════════════
await seed();
const cron = await route("app/api/cron/appointment-outcomes/route.js");
process.env.CRON_SECRET = "s3cret";
const runCron = async (auth = "Bearer s3cret") => {
  const res = await cron.GET(new Request("http://x/api/cron/appointment-outcomes", { headers: auth ? { authorization: auth } : {} }));
  return { status: res.status, body: await res.json().catch(() => null) };
};
ok("no secret → 401, nobody asked", (await runCron(null)).status === 401 && (await db.notificationEvent.findMany({ where: {} })).length === 0);
const first = await runCron();
const events = await db.notificationEvent.findMany({ where: { type: "appointment.outcomeNeeded" } });
const askedIds = events.map((e) => e.entityId).sort();
ok("asked about the open past visits inside the week (mine, a colleague’s, the unassigned one via its booker) — another company’s visit names no member here, so nobody", first.status === 200 && JSON.stringify(askedIds) === JSON.stringify(["ap_mine", "ap_theirs", "ap_unassigned"].sort()), { askedIds, body: first.body });
ok("…never the future, the not-yet-over, the marked, the cancelled or the one older than a week", !askedIds.some((id) => ["ap_future", "ap_recent", "ap_marked", "ap_cancel_reason", "ap_old"].includes(id)));
const deliveries = await db.notificationDelivery.findMany({ where: {} });
const deliveredTo = (eventId) => deliveries.filter((d) => d.eventId === eventId).map((d) => d.memberId).sort();
const ev = (id) => events.find((e) => e.entityId === id);
ok("each to its ONE person: the assignee (crew) — not the owner, not the dispatcher", JSON.stringify(deliveredTo(ev("ap_mine")?.id)) === JSON.stringify(["m_crew"]) && JSON.stringify(deliveredTo(ev("ap_theirs")?.id)) === JSON.stringify(["m_crew2"]), deliveries);
ok("…an unassigned visit to whoever booked it", JSON.stringify(deliveredTo(ev("ap_unassigned")?.id)) === JSON.stringify(["m_owner"]));
ok("the sentence's params: the client's name and the time in the reader's language", ev("ap_mine")?.params?.clientName === "Jane Client" && typeof ev("ap_mine")?.params?.when === "string" && ev("ap_mine").params.when.length > 4, ev("ap_mine")?.params);
const second = await runCron();
ok("a second run the same day asks nobody again", second.status === 200 && (await db.notificationEvent.findMany({ where: { type: "appointment.outcomeNeeded" } })).length === events.length, second.body);
ok("the notification opens the calendar on that visit", hrefFor({ entityType: "appointment", entityId: "ap_mine" }) === "/app/appointments?appointment=ap_mine");

// ═══════════════════════════════════════════════════════════════════════════
section("5. Wiring");
// ═══════════════════════════════════════════════════════════════════════════
const actions = code("app/components/schedule/EntryActions.js");
ok("the calendar's row passes the visit's time, so a past one asks its outcome", /appointmentActions\(status, \{ scheduledAt \}\)/.test(actions));
ok("an outcome tap posts { outcome } to the outcome route — not the PATCH whose cancel writes to the client", /\/api\/appointments\/\$\{id\}\/outcome/.test(actions) && /a\.outcome \? markOutcome\(a\)/.test(actions) && /JSON\.stringify\(\{ outcome: action\.outcome \}\)/.test(actions));
ok("\"Rescheduled\" then opens New appointment for the same client", /if \(action\.outcome === "rescheduled"\) onRebook\?\.\(\)/.test(actions) && /onRebook=\{\(\) => rebook\(appt\)\}/.test(code("app/app/appointments/page.js")) && /initialClient=\{rebookClient\}/.test(code("app/app/appointments/page.js")) && /onRebook=\{onRebook\}/.test(code("app/components/schedule/EntryCardsWeek.js")) && /onRebook\(entry\)/.test(code("app/components/schedule/EntryPanel.js")));
ok("the page opens the visit a nudge links to (?appointment=)", /searchParams\?\.get\("appointment"\)/.test(code("app/app/appointments/page.js")) && /setOpenRows\(\(prev\) => new Set\(prev\)\.add\(`appointment-\$\{hit\.id\}`\)\)/.test(code("app/app/appointments/page.js")));
ok("the cron is scheduled daily", /"path": "\/api\/cron\/appointment-outcomes",\s*"schedule": "30 13 \* \* \*"/.test(code("vercel.json")));
const pkg = JSON.parse(code("package.json"));
ok("check:appointment-outcomes is in check:all", /check:appointment-outcomes/.test(pkg.scripts["check:all"]));
ok("the help says it, in en, fr and es", ["en", "fr", "es"].every((l) => /id: "visit-outcome"/.test(code(`content/help/${l}/jobs-and-scheduling-1.js`))));

// ═══════════════════════════════════════════════════════════════════════════
// Mutation pass (cp backups only — never git checkout)
// ═══════════════════════════════════════════════════════════════════════════
if (!MUTANT && !fails.length) {
  console.log("\nMutation pass — each change to lib/appointments/outcome.js must fail this check");
  const LIB = join(ROOT, "lib/appointments/outcome.js");
  const backupDir = join(ROOT, ".mutation-backup-appointment-outcomes");
  mkdirSync(backupDir, { recursive: true });
  copyFileSync(LIB, join(backupDir, "outcome.js"));
  const ORIGINAL = readFileSync(LIB, "utf8");
  const MUTATIONS = [
    ["anyone may mark", "if (!mine && !hasEditAll) return { ok: false, reason: \"not_yours\" };", ""],
    ["a future visit may be marked", "if (!isPast(appt, now)) return { ok: false, reason: \"not_yet\" };", ""],
    ["asked every day", "    if (asked.has(a.id)) return false;\n", ""],
    ["no week limit", "if (!Number.isFinite(at) || at < w.gte.getTime() || at > w.lte.getTime()) return false;", "if (!Number.isFinite(at) || at > w.lte.getTime()) return false;"],
    ["the booker never asked", "return appt?.assignedToId || appt?.createdById || null;", "return appt?.assignedToId || null;"],
  ];
  const escaped = [];
  try {
    for (const [label, from, to] of MUTATIONS) {
      if (!ORIGINAL.includes(from)) {
        escaped.push(`${label} — target not found`);
        continue;
      }
      writeFileSync(LIB, ORIGINAL.replace(from, to));
      let survived = false;
      try {
        execFileSync(process.execPath, ["--import", "./scripts/alias-loader.mjs", "--import", "./scripts/memory-route-stub-loader.mjs", "scripts/check-appointment-outcomes.mjs", "--mutant"], { cwd: ROOT, stdio: "pipe" });
        survived = true;
      } catch {
        survived = false;
      }
      writeFileSync(LIB, ORIGINAL);
      if (survived) escaped.push(`${label} — NOT caught`);
      else console.log(`  ✓ caught: ${label}`);
    }
  } finally {
    writeFileSync(LIB, ORIGINAL);
    rmSync(backupDir, { recursive: true, force: true });
  }
  ok(`all ${MUTATIONS.length} mutants caught`, escaped.length === 0, escaped.join(" | "));
}

if (!MUTANT) console.log(fails.length ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}` : `\nPASSED — ${pass}/${pass} assertions`);
process.exit(fails.length ? 1 : 0);
