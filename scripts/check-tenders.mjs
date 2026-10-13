// scripts/check-tenders.mjs
//
//   npm run check:tenders
//
// Government and public tenders (owner, 2026-10-13), EXECUTED: the real route
// handlers under app/api/tenders against an in-memory database
// (scripts/fixtures/tendersDb.mjs), the real reminder runner against a
// recording notifier, and the pure modules against hostile input.
//
//   1. Time: instants and reminder marks across both 2026 DST changes in
//      Eastern time — a 14:00 closing ON the November boundary is reminded
//      25 hours before, not 24 — and across zones.
//   2. Reminders: each once (a second run, two runs at once, and a moved
//      closing date), superseded marks, no reminder after the deadline or
//      for a closed tender, none for a company whose feature is hidden.
//   3. No email or text path: nothing reachable from the tender modules
//      imports a mail or SMS sender, and the reminders go through notifyEvent
//      (feed + Web Push to Member rows) only.
//   4. Status transitions: every from→to pair against the table, and what
//      each move requires.
//   5. Payload: hostile input refused, not clamped.
//   6. Tenant scope: another company's tender, client, quote, job and upload
//      folder are all refused by the routes.
//   7. Permission gates: every preset, the nav row against the route.
//   8. The win/loss summary, in cents.
//   9. The feature gate: hidden by default, row/pages/API/cron all keyed.
//  10. Mobile: the tender screens' controls are ≥ 44px and nothing is wider
//      than a phone.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

import { store, reset, db } from "./fixtures/tendersDb.mjs";
import { session } from "./fixtures/apiMemberStub.mjs";
import { calls as createJobCalls } from "./fixtures/tendersCreateJobStub.mjs";

import {
  instantOf,
  isIsoDate,
  isHhmm,
  isTimeZone,
  shiftDate,
  reminderMarks,
  remindersDue,
  tenderInstants,
  closingState,
  countdownParts,
} from "@/lib/tenders/time";
import { TENDER_STATUSES, OPEN_TENDER_STATUSES, TENDER_SOURCES } from "@/lib/tenders/constants";
import { TENDER_TRANSITIONS, canTransition, planTransition, parseMoney } from "@/lib/tenders/status";
import { parseTenderBody, finaliseTenderWrite } from "@/lib/tenders/payload";
import { winLossSummary, tenderValueCents } from "@/lib/tenders/summary";
import { runTenderReminders, notificationTypeFor } from "@/lib/tenders/reminders";
import { isCompanyTenderUpload, parseTenderDocument } from "@/lib/tenders/documents";
import { canReadTenders, canWriteTenders, canSeeTenderContacts, canSeeTenderMoney, CONTACT_FIELDS, MONEY_FIELDS } from "@/lib/tenders/access";
import { filterTenders, sortTenders, isOverdue } from "@/lib/tenders/list";
import { tenderCalendar } from "@/lib/tenders/ics";
import { NAV_REQUIREMENTS, navRowAllowed } from "@/lib/permissions/nav";
import { PERMISSION_PRESETS, PRESET_TO_ROLE } from "@/lib/permissions";
import { featureEntry, featureForApiPath, featureForRoutePath } from "@/lib/features/registry";
import { navRowState } from "@/lib/features/nav";
import { NOTIFICATION_TYPES, typeProblems } from "@/lib/notifications/catalog";
import { hrefFor } from "@/lib/notifications/render";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

import * as listRoute from "@/app/api/tenders/route";
import * as oneRoute from "@/app/api/tenders/[id]/route";
import * as statusRoute from "@/app/api/tenders/[id]/status/route";
import * as quoteRoute from "@/app/api/tenders/[id]/quote/route";
import * as jobRoute from "@/app/api/tenders/[id]/job/route";
import * as docsRoute from "@/app/api/tenders/[id]/documents/route";
import * as docRoute from "@/app/api/tenders/[id]/documents/[docId]/route";
import * as icsRoute from "@/app/api/tenders/[id]/ics/route";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
let fail = 0;
function ok(cond, name, detail) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.log(`  ✗ ${name}${detail !== undefined ? `  got: ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
  }
}
const section = (s) => console.log(`\n── ${s}`);
const iso = (d) => (d instanceof Date ? d.toISOString() : d);
const HOUR = 3600 * 1000;

// ═══════════════════════════════════════════════════════════════════════════
section("1. Time zones and DST");
// ═══════════════════════════════════════════════════════════════════════════

// Toronto 2026: EDT until 2026-11-01 02:00, EDT from 2026-03-08 02:00.
ok(iso(instantOf("2026-11-01", "14:00", "America/Toronto")) === "2026-11-01T19:00:00.000Z", "14:00 Eastern on the November boundary day is EST (19:00Z)", iso(instantOf("2026-11-01", "14:00", "America/Toronto")));
ok(iso(instantOf("2026-10-31", "14:00", "America/Toronto")) === "2026-10-31T18:00:00.000Z", "14:00 Eastern the day before is EDT (18:00Z)");
ok(iso(instantOf("2026-03-08", "14:00", "America/Toronto")) === "2026-03-08T18:00:00.000Z", "14:00 Eastern on the March boundary day is EDT (18:00Z)");
ok(iso(instantOf("2026-11-04", "14:00", "America/Vancouver")) === "2026-11-04T22:00:00.000Z", "14:00 Pacific is three hours after 14:00 Eastern");
ok(iso(instantOf("2026-07-01", "14:00", "America/Regina")) === "2026-07-01T20:00:00.000Z", "Regina keeps CST all year");
const gap = instantOf("2026-03-08", "02:30", "America/Toronto");
ok(gap instanceof Date && Number.isFinite(gap.getTime()), "a wall time inside the spring-forward gap still resolves to a real instant", iso(gap));

for (const bad of ["2026-02-30", "2026-13-01", "26-01-01", "2026-1-1", "", null, 20261101, "2026-11-01T00:00", "1999-01-01", "2026-02-29"]) {
  ok(!isIsoDate(bad), `isIsoDate refuses ${JSON.stringify(bad)}`);
}
ok(isIsoDate("2028-02-29"), "isIsoDate accepts a real leap day");
for (const bad of ["24:00", "9:00", "12:60", "12:00:00", "", null, 1400, "noon"]) ok(!isHhmm(bad), `isHhmm refuses ${JSON.stringify(bad)}`);
for (const bad of ["Mars/Olympus", "", null, "EST5EDT; DROP", "x".repeat(80)]) ok(!isTimeZone(bad), `isTimeZone refuses ${JSON.stringify(bad)}`);
ok(instantOf("2026-11-01", "14:00", "Mars/Olympus") === null, "an unknown zone gives no instant rather than UTC");
ok(shiftDate("2026-03-01", -1) === "2026-02-28" && shiftDate("2026-12-31", 1) === "2027-01-01", "shiftDate crosses month and year ends");

// The brief's own case: a closing at 14:00 Eastern ON a DST boundary.
const boundary = {
  status: "preparing",
  timeZone: "America/Toronto",
  closingDate: "2026-11-01",
  closingTime: "14:00",
  questionsDeadlineDate: "2026-10-30",
  questionsDeadlineTime: "12:00",
  siteVisitDate: "2026-10-27",
  siteVisitTime: null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
};
const marks = Object.fromEntries(reminderMarks(boundary).map((m) => [m.kind, m]));
ok(iso(marks.closing_1d?.dueAt) === "2026-10-31T18:00:00.000Z", "closing −1 day is 14:00 EDT the day before", iso(marks.closing_1d?.dueAt));
ok(marks.closing_1d && (boundary && instantOf("2026-11-01", "14:00", "America/Toronto").getTime() - marks.closing_1d.dueAt.getTime()) === 25 * HOUR, "…which is 25 hours before, not 24");
ok(iso(marks.closing_3d?.dueAt) === "2026-10-29T18:00:00.000Z", "closing −3 days is 14:00 EDT on the 29th");
ok(iso(marks.closing_3h?.dueAt) === "2026-11-01T16:00:00.000Z", "closing −3 hours is an interval: 11:00 EST", iso(marks.closing_3h?.dueAt));
ok(iso(marks.questions_2d?.dueAt) === "2026-10-28T16:00:00.000Z", "Q&A −2 days at the deadline's own time (12:00 EDT)");
ok(iso(marks.site_visit_1d?.dueAt) === "2026-10-26T13:00:00.000Z", "a date-only site visit is reminded at 09:00 local the day before", iso(marks.site_visit_1d?.dueAt));
ok(iso(marks.site_visit_1d?.eventAt) === "2026-10-28T04:00:00.000Z", "a date-only site visit counts as passed at the END of its day, local");

const spring = { ...boundary, closingDate: "2026-03-08", questionsDeadlineDate: null, siteVisitDate: null, createdAt: new Date("2026-01-01") };
const springMarks = Object.fromEntries(reminderMarks(spring).map((m) => [m.kind, m]));
ok(instantOf("2026-03-08", "14:00", "America/Toronto").getTime() - springMarks.closing_1d.dueAt.getTime() === 23 * HOUR, "in March the same −1 day is 23 hours");

// remindersDue across a timeline: one per event, latest mark wins.
const at = (s) => new Date(s);
const dueKinds = (t, now) => remindersDue(t, now, OPEN_TENDER_STATUSES).map((m) => m.kind).sort();
ok(dueKinds(boundary, at("2026-10-20T00:00:00Z")).length === 0, "nothing is due three weeks out");
ok(dueKinds(boundary, at("2026-10-26T13:00:00Z")).join() === "site_visit_1d", "the site visit reminder comes due on its mark", dueKinds(boundary, at("2026-10-26T13:00:00Z")));
ok(dueKinds(boundary, at("2026-10-29T18:01:00Z")).join() === "closing_3d,questions_2d", "at the three-day mark: closing −3d and Q&A −2d", dueKinds(boundary, at("2026-10-29T18:01:00Z")));
ok(dueKinds(boundary, at("2026-10-31T18:01:00Z")).join() === "closing_1d", "at −1 day the earlier closing mark is superseded, and the Q&A deadline has passed", dueKinds(boundary, at("2026-10-31T18:01:00Z")));
ok(dueKinds(boundary, at("2026-11-01T16:00:00Z")).join() === "closing_3h", "at −3 hours, exactly on the mark");
ok(dueKinds(boundary, at("2026-11-01T19:00:00Z")).length === 0, "nothing at or after the closing instant");
for (const s of TENDER_STATUSES.filter((x) => !OPEN_TENDER_STATUSES.includes(x))) {
  ok(dueKinds({ ...boundary, status: s }, at("2026-11-01T16:30:00Z")).length === 0, `no reminder for a ${s} tender`);
}
ok(dueKinds({ ...boundary, createdAt: at("2026-10-30T12:00:00Z") }, at("2026-10-30T12:05:00Z")).length === 0, "a tender entered after the −3d mark does not ring at once with 'three days left'");
ok(dueKinds({ ...boundary, createdAt: at("2026-10-30T12:00:00Z") }, at("2026-10-31T18:05:00Z")).join() === "closing_1d", "…and still gets the −1 day reminder");
ok(remindersDue(null, new Date(), OPEN_TENDER_STATUSES).length === 0 && remindersDue(boundary, "now", OPEN_TENDER_STATUSES).length === 0, "remindersDue refuses garbage");
ok(reminderMarks({ ...boundary, timeZone: "Nowhere/Land" }).length === 0, "an unknown zone has no marks rather than UTC ones");

// Closing state for the list, in the tender's zone.
const vancouver = { timeZone: "America/Vancouver", closingDate: "2026-11-04", closingTime: "14:00" };
vancouver.closingAt = instantOf(vancouver.closingDate, vancouver.closingTime, vancouver.timeZone);
ok(closingState(vancouver, at("2026-11-04T07:30:00Z")).state === "soon", "07:30Z on the 4th is still 23:30 on the 3rd in Vancouver: not 'today' yet", closingState(vancouver, at("2026-11-04T07:30:00Z")));
ok(closingState(vancouver, at("2026-11-04T08:30:00Z")).state === "today", "08:30Z is 00:30 PST on the 4th: closing today, by the tender's zone");
ok(closingState(vancouver, at("2026-11-04T22:00:00Z")).state === "closed", "at the instant it is closed");
ok(JSON.stringify(countdownParts(26 * HOUR + 5 * 60000)) === JSON.stringify({ days: 1, hours: 2, minutes: 5 }), "countdown parts");
ok(JSON.stringify(countdownParts(-5)) === JSON.stringify({ days: 0, hours: 0, minutes: 0 }) && countdownParts("x").days === 0, "countdown never goes negative or NaN");

// ═══════════════════════════════════════════════════════════════════════════
section("2. Reminders: once each, own team only, feature-gated");
// ═══════════════════════════════════════════════════════════════════════════

function seedReminderWorld() {
  reset();
  store.company.push({ id: "coA", defaultLanguage: "en", timezone: "America/Toronto" }, { id: "coB", defaultLanguage: "fr", timezone: "America/Toronto" });
  store.tender.push({
    id: "tA",
    companyId: "coA",
    title: "Roof repairs, Place du Portage",
    solicitationNumber: "EP123-260001",
    ...boundary,
    closingAt: instantOf("2026-11-01", "14:00", "America/Toronto"),
    contractingAuthorityEmail: "lisa.hampel@example.gc.ca",
  });
  store.tender.push({ id: "tB", companyId: "coB", title: "Hidden co", ...boundary, closingAt: instantOf("2026-11-01", "14:00", "America/Toronto") });
}
const sent = [];
const notify = async (args) => {
  sent.push(args);
  return { created: true, delivered: 2, reason: "ok" };
};
const featureAllowed = async (companyId) => companyId === "coA";

seedReminderWorld();
sent.length = 0;
let r1 = await runTenderReminders({ db, notify, featureAllowed, now: at("2026-10-31T18:30:00Z") });
let r2 = await runTenderReminders({ db, notify, featureAllowed, now: at("2026-10-31T18:45:00Z") });
ok(sent.length === 1 && sent[0].type === "tender.closing" && sent[0].entityId === "tA", "one closing reminder for the company that has tenders", sent.map((s) => s.type));
ok(r1.claimed === 1 && r2.claimed === 0 && r2.alreadySent === 1, "a second run in the same window claims nothing", { r1, r2 });
ok(r1.companiesSkipped === 1 && !sent.some((s) => s.companyId === "coB"), "a company whose tenders feature is hidden gets nothing");
ok(store.tenderReminder.length === 1 && store.tenderReminder[0].delivered === 2, "the claim row records how many were told");
const params = sent[0].params;
ok(Object.keys(params).sort().join() === "title,when" && /EP123-260001/.test(params.title) && /EST|GMT-5/.test(params.when), "params are the title and the closing time WITH its zone", params);
ok(!JSON.stringify(sent).includes("lisa.hampel"), "the buyer's email never reaches a reminder");
ok(Object.keys(sent[0]).every((k) => ["companyId", "type", "entityId", "params"].includes(k)), "notifyEvent gets no recipient, channel or address of its own", Object.keys(sent[0]));

// Two runs at once: the unique claim is the lock.
seedReminderWorld();
sent.length = 0;
await Promise.all([
  runTenderReminders({ db, notify, featureAllowed, now: at("2026-11-01T16:10:00Z") }),
  runTenderReminders({ db, notify, featureAllowed, now: at("2026-11-01T16:10:00Z") }),
]);
ok(sent.length === 1 && sent[0].type === "tender.closing", "two overlapping runs send one reminder", sent.length);

// A moved closing date is a new deadline and is reminded afresh.
seedReminderWorld();
sent.length = 0;
await runTenderReminders({ db, notify, featureAllowed, now: at("2026-10-31T18:30:00Z") });
Object.assign(store.tender[0], { closingDate: "2026-11-02", closingAt: instantOf("2026-11-02", "14:00", "America/Toronto") });
await runTenderReminders({ db, notify, featureAllowed, now: at("2026-11-01T19:30:00Z") });
ok(sent.length === 2 && store.tenderReminder.length === 2, "a closing moved a day later is reminded again for the new date", sent.length);

// Mandatory site visit gets its own sentence; submitted gets nothing.
ok(notificationTypeFor({ event: "siteVisit" }, { siteVisitMandatory: true }) === "tender.siteVisitMandatory", "a mandatory visit uses the mandatory sentence");
ok(notificationTypeFor({ event: "questions" }, {}) === "tender.questionsDue" && notificationTypeFor({ event: "closing" }, {}) === "tender.closing", "event → type");
seedReminderWorld();
sent.length = 0;
store.tender[0].status = "submitted";
await runTenderReminders({ db, notify, featureAllowed, now: at("2026-11-01T16:10:00Z") });
ok(sent.length === 0, "a submitted bid is not reminded");

for (const type of ["tender.questionsDue", "tender.siteVisit", "tender.siteVisitMandatory", "tender.closing"]) {
  const meta = NOTIFICATION_TYPES[type];
  ok(meta && typeProblems(type).length === 0, `${type} is a sound catalog entry`, typeProblems(type));
  ok(meta?.money === false && meta?.audience?.category === "quotes" && meta?.audience?.level === "view_only", `${type}: no money, audience is the tender read rung`);
  ok(APP_MESSAGES.en[`app.notif.type.${type}`]?.includes("{title}"), `${type} has an English sentence using {title}`);
}
ok(hrefFor({ entityType: "tender", entityId: "t1" }) === "/app/tenders/t1", "a tender notification opens the tender");

// ═══════════════════════════════════════════════════════════════════════════
section("3. No email or SMS path anywhere in the tender module");
// ═══════════════════════════════════════════════════════════════════════════

function walk(dir, out = []) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return out;
  for (const e of readdirSync(abs)) {
    const rel = join(dir, e);
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.(js|mjs)$/.test(e)) out.push(rel);
  }
  return out;
}
const tenderSources = [...walk("lib/tenders"), ...walk("app/api/tenders"), ...walk("app/app/tenders"), "app/api/cron/tender-reminders/route.js"];
const SENDER = /lib\/email\/|lib\/sms\/|from ["'](resend|twilio|nodemailer)["']|sendEmail|sendSms|sendMail\b|lib\/mailbox\/send|lib\/messaging\/send/;
// Transitive over local imports, stopping at the shared modules whose own
// checks cover them and whose job is not sending to a client: createJob (the
// job screen's helper), notify (the feed, whose header states it sends no
// email), and the session layer every /app route sits behind (apiMember →
// currentMember → Better Auth, which mails the USER their sign-in links —
// reachable from every route in the product, and never with a tender's data).
const STOP = new Set([
  "lib/jobs/createJob.js",
  "lib/notifications/notify.js",
  "lib/apiMember.js",
  "lib/currentMember.js",
  "app/components/FeatureGate.js",
]);
function localImports(file) {
  const src = read(file);
  const specs = [...src.matchAll(/(?:import|export)\s[^;]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1] || m[2]);
  const out = [];
  for (const s of specs) {
    let base = null;
    if (s.startsWith("@/")) base = s.slice(2);
    else if (s.startsWith(".")) base = join(dirname(file), s);
    if (!base) continue;
    for (const cand of [base, `${base}.js`, `${base}.mjs`, join(base, "index.js")]) {
      if (existsSync(join(ROOT, cand)) && statSync(join(ROOT, cand)).isFile()) {
        out.push(cand);
        break;
      }
    }
  }
  return out;
}
const seen = new Set();
const queue = [...tenderSources];
while (queue.length) {
  const f = queue.shift();
  if (seen.has(f)) continue;
  seen.add(f);
  if (STOP.has(f)) continue;
  if (/appMessages\.js$/.test(f)) continue;
  for (const dep of localImports(f)) queue.push(dep);
}
const senders = [...seen].filter((f) => !STOP.has(f) && !/appMessages\.js$/.test(f) && SENDER.test(read(f).replace(/\/\/.*$/gm, "")));
ok(seen.has("lib/tenders/reminders.js") && seen.has("app/api/tenders/[id]/job/route.js") && seen.size > 30, "the walk actually covered the tender modules", seen.size);
ok(senders.length === 0, `no module reachable from the tender code sends mail or SMS (${seen.size} modules walked)`, senders);
ok(!/contractingAuthorityEmail|technicalAuthorityEmail/.test(read("lib/tenders/reminders.js").replace(/\/\/.*$/gm, "")), "the reminder module never reads a buyer email");
ok(read("lib/notifications/catalog.js").includes("the feed sends NO email and NO SMS"), "the notification feed still states it sends no email or SMS");

// ═══════════════════════════════════════════════════════════════════════════
section("4. Status transitions");
// ═══════════════════════════════════════════════════════════════════════════

const NOW = new Date("2026-10-13T15:00:00Z");
let pairs = 0;
for (const from of TENDER_STATUSES) {
  for (const to of TENDER_STATUSES) {
    pairs++;
    const allowed = TENDER_TRANSITIONS[from].includes(to);
    const plan = planTransition({ status: from }, to, { reason: "Because", winningPrice: "1", awardedValue: "1" }, NOW);
    if (from === to) ok(!plan.ok && plan.status === 409, `${from} → ${from} is a 409`);
    else if (allowed) ok(plan.ok && plan.data.status === to, `${from} → ${to} is allowed`, plan);
    else ok(!plan.ok && plan.status === 409, `${from} → ${to} is refused`, plan);
  }
}
ok(pairs === 81, "all 81 pairs walked");
for (const bad of ["deleted", "", null, "__proto__", "constructor", "WON"]) {
  const p = planTransition({ status: "submitted" }, bad, {}, NOW);
  ok(!p.ok && p.status === 400, `status ${JSON.stringify(bad)} is a 400`);
  ok(!canTransition(bad, "won") && !canTransition("submitted", bad), `canTransition refuses ${JSON.stringify(bad)}`);
}
ok(!planTransition({ status: "watching" }, "no_bid", {}, NOW).ok, "no-bid without a reason is refused");
ok(!planTransition({ status: "watching" }, "no_bid", { reason: "   " }, NOW).ok, "…and a blank reason is no reason");
ok(planTransition({ status: "watching" }, "no_bid", { reason: "Bonding limit" }, NOW).data.decisionReason === "Bonding limit", "no-bid records the reason");
ok(!planTransition({ status: "watching" }, "bid", { reason: "x".repeat(1001) }, NOW).ok, "a 1001-character reason is refused, not cut");
ok(!planTransition({ status: "watching" }, "bid", { reason: { $ne: 1 } }, NOW).ok, "an object reason is refused");
const sub = planTransition({ status: "preparing" }, "submitted", { confirmationNumber: "ARIBA-77" }, NOW);
ok(sub.ok && sub.data.submittedAt.getTime() === NOW.getTime() && sub.data.confirmationNumber === "ARIBA-77", "submitted stamps now and keeps the confirmation number");
ok(!planTransition({ status: "preparing" }, "submitted", { submittedAt: "2099-01-01T00:00:00Z" }, NOW).ok, "a submission in the future is refused");
ok(!planTransition({ status: "preparing" }, "submitted", { submittedAt: "yesterday" }, NOW).ok, "a submitted time that is not a date is refused");
const corrected = planTransition({ status: "won", submittedAt: new Date("2026-10-01T18:00:00Z"), confirmationNumber: "C-1" }, "submitted", {}, NOW);
ok(corrected.ok && corrected.data.submittedAt.toISOString() === "2026-10-01T18:00:00.000Z" && corrected.data.confirmationNumber === undefined, "won → submitted (a correction) keeps the original submission", corrected.data);
for (const bad of ["-5", "abc", "1e9", "12.345", "100000000000.01", { v: 1 }, true, "Infinity", "NaN"]) {
  ok(!planTransition({ status: "submitted" }, "lost", { winningPrice: bad }, NOW).ok, `winning price ${JSON.stringify(bad)} is refused`);
}
ok(planTransition({ status: "submitted" }, "lost", { winningPrice: "$1,234,567.50" }, NOW).data.winningPrice === "1234567.50", "a pasted '$1,234,567.50' is read as the amount");
ok(parseMoney(0.1 + 0.2, "x").ok === false, "a float with a long tail is refused rather than rounded silently");

// ═══════════════════════════════════════════════════════════════════════════
section("5. Payload: refused, not clamped");
// ═══════════════════════════════════════════════════════════════════════════

const full = { canSeeContacts: true, canSeeMoney: true };
const good = { clientId: "c1", title: "Roof", closingDate: "2026-11-04", closingTime: "14:00" };
ok(parseTenderBody(good, { creating: true, ...full }).ok, "a minimal tender parses");
const refusals = [
  [null, "null body"],
  [[], "an array body"],
  ["text", "a string body"],
  [{ ...good, title: "x".repeat(201) }, "a 201-character title"],
  [{ ...good, title: "   " }, "a blank title"],
  [{ ...good, clientId: "" }, "no buyer"],
  [{ ...good, clientId: { $ne: null } }, "an object client id"],
  [{ ...good, source: "evil" }, "an unknown source"],
  [{ ...good, source: "__proto__" }, "a prototype source"],
  [{ ...good, sourceUrl: "javascript:alert(1)" }, "a javascript: link"],
  [{ ...good, sourceUrl: "https://user:pw@canadabuys.canada.ca/x" }, "a link with credentials"],
  [{ ...good, sourceUrl: "ftp://x" }, "an ftp link"],
  [{ ...good, contractingAuthorityEmail: "lisa@" }, "a broken email"],
  [{ ...good, closingDate: "2026-02-30" }, "an impossible closing date"],
  [{ ...good, closingTime: "25:00" }, "an impossible closing time"],
  [{ ...good, closingTime: "" }, "no closing time"],
  [{ ...good, timeZone: "Mars/Olympus" }, "an unknown zone"],
  [{ ...good, bidValidityDays: -1 }, "negative validity"],
  [{ ...good, bidValidityDays: "1e3" }, "validity in exponent form"],
  [{ ...good, bidValidityDays: 731 }, "validity over two years"],
  [{ ...good, bidValidityDays: 1.5 }, "fractional validity"],
  [{ ...good, siteVisitMandatory: "yes" }, "a string boolean"],
  [{ ...good, estimatedValue: "-1" }, "a negative estimate"],
  [{ ...good, notes: "x".repeat(5001) }, "5001-character notes"],
];
for (const [body, name] of refusals) {
  const p = parseTenderBody(body, { creating: true, ...full });
  ok(!p.ok && p.status === 400, `refused: ${name}`, p);
}
const blindContacts = parseTenderBody({ ...good, contractingAuthorityEmail: "a@b.ca" }, { creating: true, canSeeContacts: false, canSeeMoney: true });
ok(!blindContacts.ok && blindContacts.status === 403, "a contact field from a member below full_view is a 403, not ignored");
const blindMoney = parseTenderBody({ ...good, estimatedValue: "100" }, { creating: true, canSeeContacts: true, canSeeMoney: false });
ok(!blindMoney.ok && blindMoney.status === 403, "a money field from a pricing-blind member is a 403");
const patchOnly = parseTenderBody({ notes: "Bring hard hats" }, { creating: false, ...full });
ok(patchOnly.ok && Object.keys(patchOnly.data).join() === "notes", "an edit touches only what it sent", patchOnly.data);
const ignored = parseTenderBody({ ...good, status: "won", companyId: "coB", quoteId: "q9", closingAt: "2000-01-01" }, { creating: true, ...full });
ok(ignored.ok && !("status" in ignored.data) && !("companyId" in ignored.data) && !("quoteId" in ignored.data) && !("closingAt" in ignored.data), "status, companyId, quoteId and the computed instants cannot be set through the form");
ok(!finaliseTenderWrite(null, { ...good, questionsDeadlineTime: "10:00" }, { defaultTimeZone: "America/Toronto" }).ok, "a questions time with no date is refused");
ok(!finaliseTenderWrite(null, { ...good, siteVisitTime: "10:00" }, { defaultTimeZone: "America/Toronto" }).ok, "a site-visit time with no date is refused");
const fin = finaliseTenderWrite(null, { ...good, bidSecurityRequired: false, bidSecurityAmount: "500" }, { defaultTimeZone: "America/Halifax" });
ok(fin.ok && fin.data.timeZone === "America/Halifax" && fin.data.bidSecurityAmount === null, "a new tender takes the company's zone; a security amount without security is cleared");
ok(iso(fin.data.closingAt) === "2026-11-04T18:00:00.000Z", "closingAt is computed in that zone (14:00 AST = 18:00Z)", iso(fin.data.closingAt));
const moved = finaliseTenderWrite({ ...good, timeZone: "America/Toronto", closingAt: new Date(0) }, { timeZone: "America/Vancouver" }, { defaultTimeZone: "America/Toronto" });
ok(moved.ok && iso(moved.data.closingAt) === "2026-11-04T22:00:00.000Z", "changing only the zone recomputes the instant");
ok(JSON.stringify(tenderInstants({ ...good, timeZone: "America/Toronto", questionsDeadlineDate: "2026-10-30" })).includes('"questionsDeadlineAt":null'), "a date-only Q&A deadline stores no invented instant");

// ═══════════════════════════════════════════════════════════════════════════
section("6–7. Routes: tenant scope and permission gates, executed");
// ═══════════════════════════════════════════════════════════════════════════

const OWNER = { id: "m_owner", userId: "u_owner", companyId: "coA", role: "owner", permissions: null };
const OTHER = { id: "m_other", userId: "u_other", companyId: "coB", role: "owner", permissions: null };
const presetMember = (key, extra = {}) => ({
  id: `m_${key}`,
  userId: `u_${key}`,
  companyId: "coA",
  role: PRESET_TO_ROLE[key],
  permissions: { ...PERMISSION_PRESETS[key].values, ...extra },
});

function seedRouteWorld() {
  reset();
  createJobCalls.length = 0;
  store.company.push({ id: "coA", timezone: "America/Toronto", defaultLanguage: "en" }, { id: "coB", timezone: "America/Vancouver", defaultLanguage: "en" });
  store.member.push(OWNER, OTHER);
  for (const key of Object.keys(PERMISSION_PRESETS)) store.member.push(presetMember(key));
  store.client.push(
    { id: "cA", companyId: "coA", name: "PSPC", type: "company" },
    { id: "cA2", companyId: "coA", name: "Dana Homeowner", type: "individual" },
    { id: "cB", companyId: "coB", name: "Their client", type: "company" },
  );
  store.quote.push(
    { id: "qA", companyId: "coA", clientId: "cA", quoteNumber: "Q-101", status: "draft", total: "250000.00", createdAt: new Date() },
    { id: "qA2", companyId: "coA", clientId: "cA2", quoteNumber: "Q-102", status: "draft", total: "900.00", createdAt: new Date() },
    { id: "qB", companyId: "coB", clientId: "cB", quoteNumber: "Q-9", status: "draft", total: "1.00", createdAt: new Date() },
  );
}
const asMember = (m) => {
  session.member = m ? { id: m.id, userId: m.userId, companyId: m.companyId, role: m.role } : null;
};
const req = (url, method = "GET", body) =>
  new Request(`http://localhost${url}`, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const p = (obj) => ({ params: Promise.resolve(obj) });
const json = async (res) => ({ status: res.status, body: await res.json().catch(() => null) });

seedRouteWorld();
asMember(OWNER);
const fullBody = {
  clientId: "cA",
  title: "Roof repairs, Place du Portage Phase III",
  solicitationNumber: "EP123-260001",
  buyerBranch: "Science and Parliamentary Infrastructure Branch",
  source: "sap_ariba",
  sourceUrl: "https://service.ariba.com/x",
  questionsChannel: "Only through SAP Ariba Event Messages",
  contractingAuthorityName: "Lisa Hampel",
  contractingAuthorityEmail: "lisa.hampel@example.gc.ca",
  contractingAuthorityPhone: "819-555-0100",
  closingDate: "2026-11-01",
  closingTime: "14:00",
  estimatedValue: "300000",
  bidSecurityRequired: true,
  bidSecurityAmount: "15000",
};
let res = await json(await listRoute.POST(req("/api/tenders", "POST", fullBody)));
ok(res.status === 201 && res.body?.tender?.id, "an owner creates a tender", res);
const tA = res.body.tender;
ok(tA.timeZone === "America/Toronto" && iso(new Date(tA.closingAt)) === "2026-11-01T19:00:00.000Z", "it took the company's zone and computed the DST-correct instant", [tA.timeZone, tA.closingAt]);
ok(store.tender[0].companyId === "coA" && store.tender[0].createdById === "u_owner", "stored under the caller's company, by the caller");

res = await json(await listRoute.POST(req("/api/tenders", "POST", { ...fullBody, clientId: "cB" })));
ok(res.status === 400 && store.tender.length === 1, "a tender for ANOTHER company's client is refused (assertOwnedIds)", res);
res = await json(await listRoute.POST(req("/api/tenders", "POST", { ...fullBody, clientId: "nope" })));
ok(res.status === 400, "a tender for a client that does not exist is refused");

asMember(OTHER);
ok((await oneRoute.GET(req(`/api/tenders/${tA.id}`), p({ id: tA.id }))).status === 404, "another company GETs it: 404");
ok((await oneRoute.PATCH(req(`/api/tenders/${tA.id}`, "PATCH", { title: "pwned" }), p({ id: tA.id }))).status === 404, "another company PATCHes it: 404");
ok((await statusRoute.POST(req(`/api/tenders/${tA.id}/status`, "POST", { status: "bid" }), p({ id: tA.id }))).status === 404, "another company moves its status: 404");
ok((await quoteRoute.POST(req(`/api/tenders/${tA.id}/quote`, "POST", { quoteId: "qB" }), p({ id: tA.id }))).status === 404, "another company links a quote: 404");
ok((await jobRoute.POST(req(`/api/tenders/${tA.id}/job`, "POST", {}), p({ id: tA.id }))).status === 404, "another company converts it: 404");
ok((await icsRoute.GET(req(`/api/tenders/${tA.id}/ics`), p({ id: tA.id }))).status === 404, "another company downloads its calendar: 404");
res = await json(await listRoute.GET(req("/api/tenders")));
ok(res.status === 200 && res.body.tenders.length === 0, "another company's list does not include it");
ok(store.tender[0].title === fullBody.title, "nothing was changed by the other company");

asMember(OWNER);
res = await json(await quoteRoute.POST(req(`/api/tenders/${tA.id}/quote`, "POST", { quoteId: "qB" }), p({ id: tA.id })));
ok(res.status === 400 && !store.tender[0].quoteId, "linking ANOTHER company's quote is refused", res);
res = await json(await quoteRoute.POST(req(`/api/tenders/${tA.id}/quote`, "POST", { quoteId: "qA2" }), p({ id: tA.id })));
ok(res.status === 400 && !store.tender[0].quoteId, "linking our quote for a DIFFERENT client is refused", res);
res = await json(await quoteRoute.POST(req(`/api/tenders/${tA.id}/quote`, "POST", { quoteId: "qA" }), p({ id: tA.id })));
ok(res.status === 200 && res.body.tender.quote?.quoteNumber === "Q-101" && res.body.tender.quote.total === "250000.00", "linking the buyer's quote works and shows our bid", res.body?.tender?.quote);
res = await json(await oneRoute.PATCH(req(`/api/tenders/${tA.id}`, "PATCH", { clientId: "cB" }), p({ id: tA.id })));
ok(res.status === 400 && store.tender[0].clientId === "cA", "re-pointing the tender at another company's client is refused");

// Documents: only an upload in THIS company's folder.
const CLOUD = "fqcloud";
const goodUrl = `https://res.cloudinary.com/${CLOUD}/raw/upload/v1/fieldquo/companies/coA/plans/0b8e2c4e-1111-4222-8333-944455556666.pdf`;
const prev = process.env.CLOUDINARY_CLOUD_NAME;
process.env.CLOUDINARY_CLOUD_NAME = CLOUD;
const hostileUrls = [
  goodUrl.replace("/coA/", "/coB/"),
  goodUrl.replace("res.cloudinary.com", "res.cloudinary.com.evil.io"),
  goodUrl.replace(`/${CLOUD}/`, "/othercloud/"),
  goodUrl.replace("https:", "http:"),
  goodUrl.replace("/plans/", "/hr/"),
  goodUrl.replace("/plans/", "/plans/../hr/"),
  goodUrl.replace("0b8e2c4e-1111-4222-8333-944455556666.pdf", "anything.pdf"),
  `https://user:pw@res.cloudinary.com/${CLOUD}/raw/upload/v1/fieldquo/companies/coA/plans/0b8e2c4e-1111-4222-8333-944455556666.pdf`,
  "javascript:alert(1)",
  "",
];
for (const u of hostileUrls) ok(!isCompanyTenderUpload(u, "coA"), `refused upload URL: ${u.slice(0, 90)}`);
ok(isCompanyTenderUpload(goodUrl, "coA"), "this company's own tender upload is accepted");
ok(isCompanyTenderUpload(goodUrl.replace("raw/upload", "image/upload").replace(".pdf", ".jpg"), "coA"), "a photo upload is accepted");
res = await json(await docsRoute.POST(req(`/api/tenders/${tA.id}/documents`, "POST", { url: hostileUrls[0], name: "x.pdf", kind: "solicitation" }), p({ id: tA.id })));
ok(res.status === 400 && store.tenderDocument.length === 0, "the route refuses a file from another company's folder");
res = await json(await docsRoute.POST(req(`/api/tenders/${tA.id}/documents`, "POST", { url: goodUrl, name: "RFSA.pdf", kind: "nonsense" }), p({ id: tA.id })));
ok(res.status === 400, "an unknown document kind is refused");
res = await json(await docsRoute.POST(req(`/api/tenders/${tA.id}/documents`, "POST", { url: goodUrl, name: "RFSA.pdf", kind: "solicitation", sizeBytes: 1234 }), p({ id: tA.id })));
ok(res.status === 201 && res.body.documents?.length === 1 && store.tenderDocument[0].companyId === "coA", "a real upload is filed on the tender", res.status);
const docId = store.tenderDocument[0].id;
asMember(OTHER);
ok((await docRoute.DELETE(req(`/api/tenders/${tA.id}/documents/${docId}`, "DELETE"), p({ id: tA.id, docId }))).status === 404 && store.tenderDocument.length === 1, "another company cannot remove it");
asMember(OWNER);
ok((await docRoute.DELETE(req(`/api/tenders/${tA.id}/documents/nope`, "DELETE"), p({ id: tA.id, docId: "nope" }))).status === 404, "removing a document that is not on this tender is a 404");
ok((await docRoute.DELETE(req(`/api/tenders/${tA.id}/documents/${docId}`, "DELETE"), p({ id: tA.id, docId }))).status === 200 && store.tenderDocument.length === 0, "the owner removes it");
process.env.CLOUDINARY_CLOUD_NAME = prev;
ok(!parseTenderDocument({ url: goodUrl, name: "" }, { companyId: "coA", cloudName: CLOUD }).ok, "a document needs a name");

// Status through the route, including the optimistic lock.
res = await json(await statusRoute.POST(req(`/api/tenders/${tA.id}/status`, "POST", { status: "won" }), p({ id: tA.id })));
ok(res.status === 409 && store.tender[0].status === "watching", "watching → won through the route is a 409");
res = await json(await statusRoute.POST(req(`/api/tenders/${tA.id}/status`, "POST", { status: "bid", reason: "Fits our bonding" }), p({ id: tA.id })));
ok(res.status === 200 && res.body.tender.status === "bid" && res.body.nextStatuses.includes("submitted"), "watching → bid", res.body?.nextStatuses);
const realUpdateMany = db.tender.updateMany;
db.tender.updateMany = async (args) => {
  store.tender[0].status = "no_bid"; // somebody else got there first
  return realUpdateMany(args);
};
res = await json(await statusRoute.POST(req(`/api/tenders/${tA.id}/status`, "POST", { status: "preparing" }), p({ id: tA.id })));
db.tender.updateMany = realUpdateMany;
ok(res.status === 409 && store.tender[0].status === "no_bid", "a move that lost a race is a 409, not an overwrite", res.status);
store.tender[0].status = "bid";

// Convert to job: only when won, once.
res = await json(await jobRoute.POST(req(`/api/tenders/${tA.id}/job`, "POST", {}), p({ id: tA.id })));
ok(res.status === 409 && createJobCalls.length === 0, "a tender that is not won does not become a job");
await statusRoute.POST(req(`/api/tenders/${tA.id}/status`, "POST", { status: "submitted", confirmationNumber: "ARIBA-77" }), p({ id: tA.id }));
res = await json(await statusRoute.POST(req(`/api/tenders/${tA.id}/status`, "POST", { status: "won", contractNumber: "W1234-56", awardedValue: "248000" }), p({ id: tA.id })));
ok(res.status === 200 && res.body.tender.status === "won" && res.body.tender.awardedValue === "248000", "submitted → won with the contract value", res.body?.tender?.awardedValue);
res = await json(await jobRoute.POST(req(`/api/tenders/${tA.id}/job`, "POST", {}), p({ id: tA.id })));
ok(res.status === 201 && res.body.created === true && createJobCalls.length === 1, "won → Convert to job calls the shared createJob once", res.status);
ok(createJobCalls[0]?.clientId === "cA" && createJobCalls[0]?.quoteId === "qA" && createJobCalls[0]?.companyId === "coA" && /W1234-56/.test(createJobCalls[0]?.title), "…with the tender's buyer, our bid quote and the contract number", createJobCalls[0]);
ok(store.tender[0].jobId === res.body.jobId && res.body.tender.job?.id === res.body.jobId, "the job is linked back to the tender");
res = await json(await jobRoute.POST(req(`/api/tenders/${tA.id}/job`, "POST", {}), p({ id: tA.id })));
ok(res.status === 200 && res.body.created === false && createJobCalls.length === 1 && store.job.length === 1, "a second press returns the same job, no second job");

// A quote that already has a job (converted from the quote screen) is linked, not duplicated.
store.tender[0].jobId = null;
res = await json(await jobRoute.POST(req(`/api/tenders/${tA.id}/job`, "POST", {}), p({ id: tA.id })));
ok(res.status === 200 && res.body.created === false && store.job.length === 1 && store.tender[0].jobId === store.job[0].id, "the quote's existing job is linked instead of a second one", res.status);

// The calendar file: times only, no people, no money.
const icsRes = await icsRoute.GET(req(`/api/tenders/${tA.id}/ics?lang=fr`), p({ id: tA.id }));
const ics = await icsRes.text();
ok(icsRes.status === 200 && /text\/calendar/.test(icsRes.headers.get("content-type")), "the calendar route answers an .ics");
ok(/DTEND:20261101T190000Z/.test(ics), "the closing event ends at the DST-correct instant", ics.split("\r\n").filter((l) => /DT/.test(l)));
ok(!/lisa|819-555|300000|15000|248000/i.test(ics), "no contact detail or money in a file that syncs to a third-party calendar");
ok(/^SUMMARY:.+EP123-260001/m.test(ics) && !ics.includes("app.tenders.ics"), "the summary is a sentence in the reader's language, not a key");
const dateOnlyIcs = tenderCalendar({ id: "t9", title: "T", closingAt: new Date("2026-11-01T19:00:00Z"), questionsDeadlineDate: "2026-10-30", siteVisitDate: null }, { closing: "C", questions: "Q", siteVisit: "S", siteVisitMandatory: "M", dateOnly: "D" });
ok((dateOnlyIcs.match(/BEGIN:VEVENT/g) || []).length === 1 && /2026-10-30/.test(dateOnlyIcs), "a date-only deadline is listed, never given an invented time");

// Permission gates per preset — the nav row and the route agree.
const navReq = NAV_REQUIREMENTS["app.nav.tenders"];
ok(navReq?.category === "quotes" && navReq?.level === "view_only", "the nav row is the quotes read rung");
for (const key of Object.keys(PERMISSION_PRESETS)) {
  const m = presetMember(key);
  asMember(m);
  const r = await listRoute.GET(req("/api/tenders"));
  const routeAllows = r.status === 200;
  ok(navRowAllowed("app.nav.tenders", m) === routeAllows, `${key}: the sidebar row and GET /api/tenders agree (${routeAllows ? "shown" : "hidden"})`, { nav: navRowAllowed("app.nav.tenders", m), route: r.status });
  ok(canReadTenders(m) === routeAllows, `${key}: canReadTenders matches the route`);
  if (routeAllows) {
    const body = await r.json();
    const t = body.tenders.find((x) => x.id === tA.id);
    ok(CONTACT_FIELDS.every((f) => (f in t) === canSeeTenderContacts(m)), `${key}: contact fields present exactly when clientsProperties ≥ full_view`);
    ok(MONEY_FIELDS.every((f) => (f in t) === canSeeTenderMoney(m)) && ((t.quote && "total" in t.quote) === canSeeTenderMoney(m)), `${key}: money present exactly with showPricing`);
    ok((body.summary.byStatus.won.value === null) === !canSeeTenderMoney(m), `${key}: the summary's values follow showPricing`);
  }
  const w = await listRoute.POST(req("/api/tenders", "POST", { clientId: "cA", title: "T", closingDate: "2026-12-01", closingTime: "14:00" }));
  ok((w.status === 201) === canWriteTenders(m), `${key}: POST allowed exactly at quotes ≥ view_create_edit`, w.status);
}
// No preset reads tenders without full client info or without prices, so a
// hand-set grid proves the redaction: a member who may read quotes but not
// see a client's contacts, and one who may not see prices.
const noContacts = { ...presetMember("estimator", { clientsProperties: "name_address_only" }), id: "m_nocontacts" };
const noPrices = { ...presetMember("estimator", { showPricing: false }), id: "m_noprices" };
store.member.push(noContacts, noPrices);
asMember(noContacts);
let detail = await json(await oneRoute.GET(req(`/api/tenders/${tA.id}`), p({ id: tA.id })));
ok(detail.status === 200 && CONTACT_FIELDS.every((f) => !(f in detail.body.tender)) && !JSON.stringify(detail.body).includes("lisa.hampel"), "below full_view: no Contracting Authority name, email or phone anywhere in the detail", detail.status);
ok(MONEY_FIELDS.some((f) => f in detail.body.tender), "…while prices still show to them");
asMember(noPrices);
detail = await json(await oneRoute.GET(req(`/api/tenders/${tA.id}`), p({ id: tA.id })));
ok(
  detail.status === 200 &&
    MONEY_FIELDS.every((f) => !(f in detail.body.tender)) &&
    !("total" in (detail.body.tender.quote || {})) &&
    detail.body.candidateQuotes.every((q) => !("total" in q)) &&
    !/300000|15000|250000/.test(JSON.stringify(detail.body)),
  "without showPricing: no estimate, security amount, contract value, winning price or quote total anywhere in the detail",
);
const blindList = await json(await listRoute.GET(req("/api/tenders")));
ok(!/300000|15000|250000/.test(JSON.stringify(blindList.body)), "…nor anywhere in the list");

// A won tender with NO bid quote converts once: the tender's own jobId is
// the only guard there is (no quote to find a job through).
asMember(OWNER);
store.tender.push({ ...store.tender[0], id: "t_noquote", quoteId: null, jobId: null, status: "won" });
createJobCalls.length = 0;
const jobsBefore = store.job.length;
await jobRoute.POST(req("/api/tenders/t_noquote/job", "POST", {}), p({ id: "t_noquote" }));
res = await json(await jobRoute.POST(req("/api/tenders/t_noquote/job", "POST", {}), p({ id: "t_noquote" })));
ok(res.status === 200 && res.body.created === false && createJobCalls.length === 1 && store.job.length === jobsBefore + 1, "a quote-less won tender pressed twice raises one job", { calls: createJobCalls.length });

// The Crew preset specifically (the audience most likely to be wrong).
const crew = presetMember("worker");
ok(!canReadTenders(crew) && !navRowAllowed("app.nav.tenders", crew), "Crew sees no Tenders row and no tender");
// A pricing-blind member sending money is refused, not ignored.
const blind = presetMember("estimator", { showPricing: false });
blind.id = "m_blind";
store.member.push(blind);
asMember(blind);
res = await json(await statusRoute.POST(req(`/api/tenders/${tA.id}/status`, "POST", { status: "submitted", winningPrice: "1" }), p({ id: tA.id })));
ok(res.status === 403, "a pricing-blind member cannot post a winning price on a status move", res.status);
res = await json(await oneRoute.PATCH(req(`/api/tenders/${tA.id}`, "PATCH", { estimatedValue: "1" }), p({ id: tA.id })));
ok(res.status === 403 && store.tender[0].estimatedValue === "300000", "…or an estimated value on an edit");
// A member who can write tenders but not create jobs cannot convert.
const noJobs = presetMember("estimator", { jobs: "view_only" });
noJobs.id = "m_nojobs";
store.member.push(noJobs);
asMember(noJobs);
store.tender[0].jobId = null;
store.job.length = 0;
res = await json(await jobRoute.POST(req(`/api/tenders/${tA.id}/job`, "POST", {}), p({ id: tA.id })));
ok(res.status === 403 && store.job.length === 0, "Convert to job needs the jobs create rung, like POST /api/jobs", res.status);
asMember(null);
ok((await listRoute.GET(req("/api/tenders"))).status === 401, "no session: 401");

// ═══════════════════════════════════════════════════════════════════════════
section("8. Win/loss summary");
// ═══════════════════════════════════════════════════════════════════════════

const rows = [
  { status: "won", awardedValue: "0.10", quote: { total: "999" } },
  { status: "won", awardedValue: null, quote: { total: "0.20" } },
  { status: "lost", estimatedValue: "1000.005" },
  { status: "lost", estimatedValue: "500" },
  { status: "submitted" },
  { status: "watching", estimatedValue: "-5" },
  { status: "nonsense", estimatedValue: "1" },
  null,
  "garbage",
];
const s = winLossSummary(rows, { canSeeMoney: true });
ok(s.byStatus.won.count === 2 && s.byStatus.won.value === 0.3, "won: the contract value first, then the bid quote — summed in cents (0.1 + 0.2 = 0.3)", s.byStatus.won);
ok(s.byStatus.lost.value === 1500.01 && s.byStatus.lost.unvalued === 0, "lost: the buyer's estimate, rounded to the cent", s.byStatus.lost);
ok(s.byStatus.submitted.count === 1 && s.byStatus.submitted.unvalued === 1 && s.byStatus.submitted.value === 0, "a tender with no value is counted and said to be unvalued");
ok(s.byStatus.watching.unvalued === 1, "a negative estimate is not a value");
ok(s.total === 6 && s.decided === 4 && s.winRate === 0.5, "unknown statuses and garbage rows are not counted; win rate is won / decided", s);
const blindS = winLossSummary(rows, { canSeeMoney: false });
ok(Object.values(blindS.byStatus).every((b) => b.value === null && b.unvalued === null) && blindS.byStatus.won.count === 2, "without showPricing the counts stay and every value is absent");
ok(winLossSummary([], {}).winRate === null && winLossSummary(undefined).total === 0, "nothing decided: no win rate, not 0%");
ok(tenderValueCents({ status: "won", awardedValue: "12" })?.basis === "awarded" && tenderValueCents({ status: "lost", awardedValue: "12" }) === null, "an awarded value only counts on a won tender");

// List filters.
const now = new Date("2026-11-01T15:00:00Z");
const L = [
  { id: "a", status: "preparing", timeZone: "America/Toronto", closingDate: "2026-11-01", closingTime: "14:00", closingAt: new Date("2026-11-01T19:00:00Z") },
  { id: "b", status: "preparing", timeZone: "America/Toronto", closingDate: "2026-10-30", closingTime: "14:00", closingAt: new Date("2026-10-30T18:00:00Z") },
  { id: "c", status: "won", timeZone: "America/Toronto", closingDate: "2026-09-01", closingTime: "14:00", closingAt: new Date("2026-09-01T18:00:00Z") },
  { id: "d", status: "watching", timeZone: "America/Toronto", closingDate: "2026-11-05", closingTime: "14:00", closingAt: new Date("2026-11-05T19:00:00Z") },
];
ok(filterTenders(L, { status: "open", closing: "today" }, now).map((x) => x.id).join() === "a", "closing today, in the tender's zone");
ok(filterTenders(L, { status: "open", closing: "overdue" }, now).map((x) => x.id).join() === "b" && isOverdue(L[1], now), "overdue = still open after closing");
ok(filterTenders(L, { status: "open", closing: "week" }, now).map((x) => x.id).sort().join() === "a,d", "closing within a week");
ok(filterTenders(L, { status: "won" }, now).map((x) => x.id).join() === "c" && filterTenders(L, { status: "evil" }, now).length === 3, "a status filter; an unknown filter falls back to open");
ok(sortTenders(L, now).map((x) => x.id).join() === "b,a,d,c", "overdue first, then soonest closing, then decided", sortTenders(L, now).map((x) => x.id));

// ═══════════════════════════════════════════════════════════════════════════
section("9. The feature gate: off by default, everything keyed to it");
// ═══════════════════════════════════════════════════════════════════════════

const entry = featureEntry("tenders");
ok(entry?.defaultState === "hidden", "tenders is hidden by default");
ok(entry?.navKeys.includes("app.nav.tenders") && entry.routePrefixes.includes("/app/tenders") && entry.apiPrefixes.includes("/api/tenders") && entry.cronPaths.includes("/api/cron/tender-reminders"), "row, pages, API and cron are all claimed");
ok(featureForApiPath("/api/tenders/abc/status") === "tenders" && featureForRoutePath("/app/tenders/new") === "tenders", "every tender path resolves to the feature");
ok(navRowState("app.nav.tenders", { tenders: { state: "hidden", visible: false, usable: false } }).show === false, "a hidden feature drops the row");
ok(navRowState("app.nav.tenders", { tenders: { state: "on", visible: true, usable: true } }).show === true, "an enabled one shows it");
ok(/<FeatureGate[^>]*feature="tenders"/.test(read("app/app/tenders/layout.js")), "the pages mount the gate");
ok(/featureAllowsSpend\(companyId, "tenders"\)/.test(read("app/api/cron/tender-reminders/route.js")), "the cron asks the gate per company");
ok(/"\/api\/cron\/tender-reminders"[\s\S]{0,40}"17 \* \* \* \*"/.test(read("vercel.json")), "the cron is scheduled hourly");
ok(/app\.nav\.tenders/.test(read("app/components/layout/AdminSidebar.js")), "the sidebar carries the row");

// ═══════════════════════════════════════════════════════════════════════════
section("10. Mobile: 44px controls, nothing wider than a phone");
// ═══════════════════════════════════════════════════════════════════════════

const screens = walk("app/app/tenders");
for (const f of screens) {
  const src = read(f);
  ok(!/<table/.test(src), `${f}: no table`);
  ok(!/\bw-\[(\d{3,})px\]|min-w-\[(\d{3,})px\]/.test(src), `${f}: no fixed width wider than a phone`);
  // Every <button …> and <select …> carries the 44px floor itself or through
  // a class constant that does.
  const consts = Object.fromEntries([...src.matchAll(/const (\w+Class)\s*=\s*\n?\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]));
  const tags = [...src.matchAll(/<(button|select)\b([\s\S]*?)(?<!=)>/g)];
  const short = tags.filter(([, , attrs]) => {
    if (/min-h-\[44px\]/.test(attrs)) return false;
    const used = [...attrs.matchAll(/\$\{(\w+Class)\}|className=\{(\w+Class)\}/g)].map((m) => m[1] || m[2]);
    return !used.some((c) => /min-h-\[44px\]/.test(consts[c] || ""));
  });
  ok(short.length === 0, `${f}: every button and select is at least 44px`, short.map((m) => m[0].slice(0, 80)));
}

// ═══════════════════════════════════════════════════════════════════════════
section("Translations");
// ═══════════════════════════════════════════════════════════════════════════

const usedKeys = new Set();
for (const f of [...screens, "app/api/tenders/[id]/ics/route.js"]) for (const m of read(f).matchAll(/["'](app\.(?:tenders|nav\.tenders)[A-Za-z0-9_.]*)["']/g)) usedKeys.add(m[1]);
for (const lang of Object.keys(APP_MESSAGES)) {
  const missing = [...usedKeys].filter((k) => typeof APP_MESSAGES[lang][k] !== "string");
  ok(missing.length === 0, `${lang}: every tender key is translated`, missing.slice(0, 5));
}

console.log(`\ncheck:tenders — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
