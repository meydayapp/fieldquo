// scripts/check-lead-attempts.mjs
//
// The contact-attempt log: what was tried, whether another is owed today, and
// the one thing an attempt must never be mistaken for.
//
//   npm run check:lead-attempts
//
// ══ The assertion this file exists for ════════════════════════════════════
//
// An attempt is OUTBOUND. A call nobody answered and a voicemail nobody
// returned are evidence that somebody tried, and evidence of nothing at all
// about whether the homeowner was reached.
//
// If an attempt ever stopped the follow-up chase, FieldQuo would go quiet on a
// lead precisely BECAUSE nobody had got hold of them — three unanswered calls
// would read as success. So lib/followUps/stopConditions.js must have no
// notion of an attempt, and must not be able to grow one. Several assertions
// below do nothing but hold that line.
//
// The second thing held here: nothing in the log is invented. FieldQuo writes
// a "system" row only for a send it actually made, and a call or a voicemail
// can only ever come from a person pressing a button, because FieldQuo cannot
// see a phone ring.

import { readFileSync } from "node:fs";
import {
  ATTEMPT_KINDS,
  ATTEMPT_KIND_KEYS,
  ATTEMPT_SOURCES,
  cleanAttemptKind,
  kindMayBeSystem,
  callsPerDay,
  DEFAULT_CALLS_PER_DAY,
  dayStart,
  attemptStanding,
  attemptOwed,
} from "@/lib/leads/attempts";
import { buildWorkPanel } from "@/lib/dashboard/workPanel";
import { leadChaseBlocker, LEAD_STOP_REASONS } from "@/lib/followUps/stopConditions";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); }
};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const stops = code(read("lib/followUps/stopConditions.js"));
const facts = code(read("lib/followUps/leadChaseFacts.js"));
const cron = code(read("app/api/cron/follow-ups/route.js"));
const route = code(read("app/api/leads/[id]/attempts/route.js"));
const cadence = code(read("app/api/settings/lead-cadence/route.js"));
const panel = code(read("lib/dashboard/workPanel.js"));
const home = code(read("lib/dashboard/homeData.js"));
const ui = read("app/components/dashboard/WorkPanel.js");
const leadsPage = read("app/app/leads/page.js");
const schema = read("prisma/schema.prisma");

// ══ 1. An attempt is not contact ══════════════════════════════════════════
console.log("\nAn attempt never stops the chase");

ok("stopConditions has no notion of an attempt", !/attempt/i.test(stops));
ok("…and cannot reach the module that defines one", !/leads\/attempts/.test(stops));
ok("the fact gatherer has none either", !/attempt/i.test(facts.replace(/loadLeadAppointments\w*/g, "")));
ok("\"attempt\" is not a stop reason", !LEAD_STOP_REASONS.some((r) => /attempt/i.test(r)));
// Executed: the blocker is handed every shape an attempt could arrive in and
// must keep chasing regardless.
const now = new Date("2026-11-03T15:00:00Z");
const DAY = 86400000;
const lead = (over = {}) => ({ id: "l1", status: "new", quoteId: null, createdAt: new Date(now - 2 * DAY), ...over });
for (const extra of [
  { attempts: [{ kind: "call", at: new Date(now - 3600000) }] },
  { attemptCount: 9 },
  { lastAttemptAt: new Date(now - 60000) },
  { hasAttempt: true },
]) {
  ok(`a lead carrying ${Object.keys(extra)[0]} is STILL chased`,
    leadChaseBlocker({ lead: lead(), rule: null, facts: extra, now }) === null, extra);
}
// Three unanswered calls and nothing else: the exact case that must not read
// as success.
ok("three unanswered calls do not make a lead 'reached'",
  leadChaseBlocker({ lead: lead(), rule: null, facts: { attempts: [1, 2, 3].map(() => ({ kind: "call", at: now })) }, now }) === null);
// And the two things that DO stop it still do.
ok("a reply still stops it", leadChaseBlocker({ lead: lead(), rule: null, facts: { repliedAt: new Date(now - DAY) }, now }) === "replied");
ok("a human's mark still stops it", leadChaseBlocker({ lead: lead(), rule: null, facts: { reachedAt: now }, now }) === "reached");
// The attempts route writes no lead column at all.
ok("the attempts route cannot touch the lead row", !/leadRequest\.update/.test(route));
ok("…and says so to anyone reading it", /outbound/i.test(read("app/api/leads/[id]/attempts/route.js")));

// ══ 2. Nothing is invented ════════════════════════════════════════════════
console.log("\nFieldQuo only logs what it actually did");

ok("a call is manual-only", ATTEMPT_KINDS.call.manualOnly === true && kindMayBeSystem("call") === false);
ok("a voicemail is manual-only", ATTEMPT_KINDS.voicemail.manualOnly === true && kindMayBeSystem("voicemail") === false);
ok("a text and an email may be FieldQuo's own", kindMayBeSystem("text") === true && kindMayBeSystem("email") === true);
ok("an unknown kind may never be a system row", kindMayBeSystem("pigeon") === false && kindMayBeSystem(null) === false);
ok("only two sources exist", ATTEMPT_SOURCES.join(",") === "manual,system");
// The route a browser drives can only ever write "manual".
ok("the browser-driven route hard-codes manual", /source: "manual"/.test(route));
ok("…and never reads a source off the request", !/body\?\.source|body\.source/.test(route));
// The cron writes system rows, gated on the kind rather than on a comment.
ok("the cron gates its own rows on kindMayBeSystem", /kindMayBeSystem\(kind\)/.test(cron));
ok("…and writes them as system with no author — a cron is nobody", /source: "system", byId: null/.test(cron));
ok("…only for an enquiry", /entityType !== "lead"/.test(cron));
ok("…only after the send was accepted, so a refused send logs nothing",
  cron.indexOf("noteAttempt({") > cron.indexOf("if (outcome.texted) {")
    && /if \(outcome\.ok\) \{\n\s*sent\+\+;\n\s*await noteAttempt\(/.test(cron));
ok("…and a lost log row never costs the run", /\.catch\(\(err\) => \{\n\s*console\.error\("\[follow-ups\] attempt not logged/.test(cron));
// A nonsense kind is refused outright rather than stored as "other".
ok("an unknown kind is refused, not folded into 'other'",
  cleanAttemptKind("pigeon") === null && /reason: "bad_kind"/.test(route));
ok("…and a known one is accepted however it was typed", cleanAttemptKind(" CALL ") === "call");

// ══ 3. The cadence, executed ══════════════════════════════════════════════
console.log("\nThe cadence");

ok("it is the company's number, not a constant", /leadCallsPerDay\s+Int\s+@default\(2\)/.test(schema));
ok("…defaulting to the conservative end of the one cadence anybody stated", DEFAULT_CALLS_PER_DAY === 2);
ok("0 is legal and means no nudge", callsPerDay({ leadCallsPerDay: 0 }) === 0);
ok("a missing select falls back to the default, not to zero", callsPerDay({}) === DEFAULT_CALLS_PER_DAY && callsPerDay(null) === DEFAULT_CALLS_PER_DAY);
ok("nonsense falls back too", callsPerDay({ leadCallsPerDay: "lots" }) === DEFAULT_CALLS_PER_DAY);
ok("negatives read as off", callsPerDay({ leadCallsPerDay: -4 }) === 0);
ok("it is capped, because this is somebody's phone ringing", callsPerDay({ leadCallsPerDay: 500 }) === 10);
ok("a fraction is floored", callsPerDay({ leadCallsPerDay: 2.9 }) === 2);
// The route refuses what it cannot honestly store.
ok("the route refuses out-of-range rather than clamping silently", /raw < 0 \|\| raw > 10/.test(cadence) && /reason: "out_of_range"/.test(cadence));
ok("…and only owners and admins may set it", /requirePermission\(member\.role, "user:manage"\)/.test(cadence));
ok("…never a support session", /member\.impersonation/.test(cadence));
ok("the change is logged, including switching it off", /settings\.lead_cadence/.test(cadence) && /Switched off the daily reminder/.test(cadence));

console.log("\nThe day is the company's day");

// 2026-11-03T15:00Z is 10am in Toronto, so the day began at 05:00Z.
ok("midnight is resolved in the company's zone", dayStart(now, "America/Toronto").toISOString() === "2026-11-03T05:00:00.000Z");
ok("a different zone gives a different midnight", dayStart(now, "Europe/Berlin").toISOString() === "2026-11-02T23:00:00.000Z");
ok("an invalid zone degrades rather than throwing", dayStart(now, "Mars/Olympus") instanceof Date);
ok("an invalid date is null, never NaN arithmetic", dayStart("nope", "America/Toronto") === null);

console.log("\nThe standing, executed");

const co = { leadCallsPerDay: 2, timezone: "America/Toronto" };
const at = (iso) => new Date(iso);
ok("nothing tried → the full target is owed",
  JSON.stringify(attemptStanding({ attempts: [], company: co, now }).owed) === "2");
ok("one call today → one owed", attemptStanding({ attempts: [{ kind: "call", at: at("2026-11-03T13:00:00Z") }], company: co, now }).owed === 1);
ok("two → none owed", attemptStanding({ attempts: [{ kind: "call", at: at("2026-11-03T13:00:00Z") }, { kind: "voicemail", at: at("2026-11-03T14:00:00Z") }], company: co, now }).owed === 0);
// The boundary that makes "a day" mean anything.
ok("yesterday's call does not count toward today",
  attemptStanding({ attempts: [{ kind: "call", at: at("2026-11-02T20:00:00Z") }], company: co, now }).today === 0);
ok("…but it is still the last attempt, so the row can say when",
  attemptStanding({ attempts: [{ kind: "call", at: at("2026-11-02T20:00:00Z") }], company: co, now }).lastAt?.toISOString() === "2026-11-02T20:00:00.000Z");
// The one that would have let the software mark its own homework.
ok("an automated email does NOT discharge a CALL target",
  attemptStanding({ attempts: [{ kind: "email", at: at("2026-11-03T13:00:00Z") }], company: co, now }).today === 0);
ok("…though it is still shown in the log", attemptStanding({ attempts: [{ kind: "email", at: at("2026-11-03T13:00:00Z") }], company: co, now }).byKind.email === 1);
ok("a target of 0 owes nothing, for every lead", attemptOwed({ attempts: [], company: { leadCallsPerDay: 0 }, now }) === false);
ok("a lead nobody has touched IS owed one — the case the nudge exists for", attemptOwed({ attempts: [], company: co, now }) === true);
ok("rows with an unreadable kind or time are ignored, not counted",
  attemptStanding({ attempts: [{ kind: "pigeon", at: now }, { kind: "call", at: "nope" }, null], company: co, now }).today === 0);
ok("no input at all does not throw", attemptStanding().owed === DEFAULT_CALLS_PER_DAY && attemptOwed() === true);

// ══ 4. The nudge is the list that was already there ══════════════════════
console.log("\nThe nudge");

// Not a new panel, a new card or a notification: the owner asked for a
// reminder, and the Requests list is already the dashboard's answer to "what
// needs doing".
ok("no new dashboard mechanism was added — the standing rides the existing row",
  /standing: attemptStanding\(\{/.test(panel) && !/NOTIFICATION|new Notification/.test(panel));
ok("the panel's arithmetic is the shared pure one", /from "@\/lib\/leads\/attempts"/.test(panel));
ok("homeData reads only TODAY's rows, in the company's zone", /at: \{ gte: from \}/.test(home) && /dayStart\(now, company\?\.timezone/.test(home));
ok("…batched for the whole list, not per lead", /leadId: \{ in: leads\.map\(\(l\) => l\.id\) \}/.test(home));
ok("…and a failed gather leaves the count unreported rather than zero",
  /attemptsByLead = new Map\(\);/.test(home) && /lead attempts not gathered/.test(read("lib/dashboard/homeData.js")));
ok("the row prints nothing when the standing is unknown", /item\.standing && item\.standing\.target > 0/.test(ui));
ok("…emphasises only what is actually owed", /item\.standing\.owed > 0/.test(ui));

{
  // Built end to end: two leads, one already called twice today.
  const base = {
    now, timeZone: "America/Toronto", companyId: "c1",
    allowed: { requests: true }, showMoney: false,
    estimates: [], bookings: [], quotes: [], jobs: [], visits: [],
    leadCallsPerDay: 2,
  };
  const rows = [
    { id: "owed", companyId: "c1", name: "Owed", status: "new", quoteId: null, createdAt: new Date(now - DAY) },
    { id: "done", companyId: "c1", name: "Done", status: "new", quoteId: null, createdAt: new Date(now - DAY) },
  ];
  const attempts = new Map([["done", [
    { kind: "call", at: at("2026-11-03T13:00:00Z") },
    { kind: "call", at: at("2026-11-03T14:00:00Z") },
  ]]]);
  const built = buildWorkPanel({ ...base, leads: rows, leadFacts: new Map(), leadAttempts: attempts });
  const items = ((built.tabs || []).find((tb) => tb.key === "requests") || { items: [] }).items;
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  ok("the untouched lead is owed its target", byId.owed?.standing?.owed === 2 && byId.owed?.standing?.today === 0);
  ok("the twice-called lead owes nothing", byId.done?.standing?.owed === 0 && byId.done?.standing?.today === 2);
  ok("both rows are still ON the list — the nudge is a count, not a filter", items.length === 2);
  // No attempts gathered at all: the standing must be absent, not zero.
  const noneGathered = buildWorkPanel({ ...base, leads: rows, leadFacts: new Map() });
  const plain = ((noneGathered.tabs || []).find((tb) => tb.key === "requests") || { items: [] }).items;
  ok("with no attempts gathered, no row claims a count", plain.every((i) => i.standing === undefined));
}

// ══ 5. The screens ═══════════════════════════════════════════════════════
console.log("\nThe screens");

ok("the drawer logs only the two kinds a person can claim", /\["call", "voicemail"\]\.map/.test(leadsPage));
ok("…and offers no button for a text or an email", !/attempt\.log\.text|attempt\.log\.email/.test(leadsPage));
ok("…behind the notes permission, like the call-back log", /canWriteNotes && \(\n?\s*<div className="flex flex-wrap gap-1\.5">\n?\s*\{\["call", "voicemail"\]/.test(leadsPage));
ok("the standing comes from the server's answer, not a count in the browser",
  /if \(d\?\.standing\) setAttemptStand\(d\.standing\)/.test(leadsPage) && !/attempts\.length \+ 1/.test(leadsPage));
ok("a system row is marked as automatic, so nobody reads it as a colleague's call",
  /a\.source === "system"/.test(leadsPage) && /app\.leads\.attempt\.automatic/.test(leadsPage));
ok("a failed load or save is said on the panel", /app\.leads\.attempt\.loadError/.test(leadsPage) && /app\.leads\.attempt\.saveError/.test(leadsPage));
ok("the cadence is set where chasing is configured", /api\/settings\/lead-cadence/.test(read("app/app/settings/follow-ups/page.js")));

console.log("\nThe words");

{
  const hint = APP_MESSAGES.en["app.leads.attempt.hint"] || "";
  ok("the hint says logging a try does NOT stop the follow-ups", /does not stop the follow-ups/i.test(hint), hint);
  ok("…and points at the control that does", /spoken to them/i.test(hint), hint);
  const post = APP_MESSAGES.en["app.setFollowUps.cadencePost"] || "";
  ok("the cadence copy says it sends nothing", /sends nothing/i.test(post), post);
  ok("…and that 0 switches the count off", /0 turns the count off/i.test(post), post);
}
// Every kind's label must resolve, or the log prints a raw key at a contractor.
{
  const keys = [...ATTEMPT_KIND_KEYS.map((k) => ATTEMPT_KINDS[k].labelKey), "app.leads.attempt.automatic"];
  const missing = Object.entries(APP_MESSAGES).flatMap(([l, d]) => keys.filter((k) => !d[k]).map((k) => `${l}:${k}`));
  ok("every attempt kind has a label in every language", missing.length === 0, missing.slice(0, 6));
}
for (const key of [
  "app.leads.attempt.title", "app.leads.attempt.standing", "app.leads.attempt.log.call",
  "app.leads.attempt.log.voicemail", "app.leads.attempt.hint", "app.leads.attempt.loadError",
  "app.leads.attempt.saveError", "app.dash.work.attemptsOwed", "app.dash.work.attemptsDone",
  "app.setFollowUps.cadencePre", "app.setFollowUps.cadencePost", "app.setFollowUps.cadenceAria",
  "app.setFollowUps.cadenceRange", "app.setFollowUps.cadenceError",
]) {
  const missing = Object.keys(APP_MESSAGES).filter((l) => !APP_MESSAGES[l][key]);
  ok(`${key} in all nine languages`, missing.length === 0, missing.join(","));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
