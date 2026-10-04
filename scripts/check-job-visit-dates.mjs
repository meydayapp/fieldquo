// scripts/check-job-visit-dates.mjs
//
//   npm run check:job-visit-dates
//
// The owner, 2026-10-04: "Booking a visit should give the job its dates —
// when a job has no start date and a visit is scheduled, set the job's start
// from the earliest visit (and end from the last visit when the job has
// none). Never overwrite dates a person set." lib/jobs/visitDates.js has the
// rule; this executes it against hostile input, then runs the SHIPPED visit
// route against the Prisma-shaped stub (as check:role-access does) to prove
// the booking writes the dates.
import { tables, writes, resetShapeStub } from "./fixtures/prismaShapeStub.mjs";
import { session } from "./fixtures/apiMemberStub.mjs";
import { readFileSync } from "node:fs";
import { derivedJobDates, personDateFlags, visitDay } from "@/lib/jobs/visitDates";
import { PERMISSION_PRESETS, PRESET_TO_ROLE } from "@/lib/permissions";

let pass = 0;
const failures = [];
const ok = (label, cond, detail = "") => {
  if (cond) {
    pass += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}${detail ? `  — ${detail}` : ""}`);
  }
};
const D = (s) => new Date(`${s}T00:00:00.000Z`);
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const TZ = "America/Toronto";
const visit = (at, status = "scheduled") => ({ scheduledAt: new Date(at), status });

console.log("\n1. The day is the COMPANY's calendar day, stored at UTC midnight\n");
ok("13:00Z on 6 Oct is 6 Oct in Toronto", iso(visitDay("2026-10-06T13:00:00Z", TZ)) === "2026-10-06");
ok("02:00Z on 7 Oct is still 6 Oct in Toronto (22:00 the evening before)", iso(visitDay("2026-10-07T02:00:00Z", TZ)) === "2026-10-06");
ok("…and 7 Oct in UTC — the zone decides, not the server", iso(visitDay("2026-10-07T02:00:00Z", "UTC")) === "2026-10-07");
ok("stored at UTC midnight", visitDay("2026-10-06T13:00:00Z", TZ).toISOString() === "2026-10-06T00:00:00.000Z");
ok("an unknown zone reads the UTC calendar, never throws", iso(visitDay("2026-10-07T02:00:00Z", "Mars/Olympus")) === "2026-10-07");
ok("an unreadable instant is no day", visitDay("not a date", TZ) === null);

console.log("\n2. An empty job takes its dates from the visits\n");
{
  const empty = { startDate: null, endDate: null, startDateFromVisits: false, endDateFromVisits: false };
  const one = derivedJobDates({ job: empty, visits: [visit("2026-10-06T13:00:00Z")], timeZone: TZ });
  ok("one visit: start = end = its day, both marked as FieldQuo's", iso(one.data?.startDate) === "2026-10-06" && iso(one.data?.endDate) === "2026-10-06" && one.data.startDateFromVisits === true && one.data.endDateFromVisits === true, JSON.stringify(one.data));
  const two = derivedJobDates({ job: empty, visits: [visit("2026-10-14T13:00:00Z"), visit("2026-10-06T13:00:00Z"), visit("2026-10-09T13:00:00Z", "cancelled")], timeZone: TZ });
  ok("three visits, one cancelled: start = earliest, end = latest live one", iso(two.data?.startDate) === "2026-10-06" && iso(two.data?.endDate) === "2026-10-14", JSON.stringify(two.data));
  const none = derivedJobDates({ job: empty, visits: [visit("2026-10-06T13:00:00Z", "cancelled")], timeZone: TZ });
  ok("only a cancelled visit: nothing written", none.data === null);
  for (const junk of [null, undefined, "x", [null, {}, { scheduledAt: "garbage" }]]) {
    ok(`junk visits (${JSON.stringify(junk)}) write nothing`, derivedJobDates({ job: empty, visits: junk, timeZone: TZ }).data === null);
  }
  const rec = derivedJobDates({ job: { ...empty, recurring: true }, visits: [visit("2026-10-06T13:00:00Z"), visit("2026-10-13T13:00:00Z")], timeZone: TZ });
  ok("a recurring job gets a start and NO end (it has no last visit)", iso(rec.data?.startDate) === "2026-10-06" && rec.data.endDate === undefined && rec.data.endDateFromVisits === undefined, JSON.stringify(rec.data));
}

console.log("\n3. Derived dates follow the visits\n");
{
  const derived = { startDate: D("2026-10-06"), endDate: D("2026-10-06"), startDateFromVisits: true, endDateFromVisits: true };
  const earlier = derivedJobDates({ job: derived, visits: [visit("2026-10-06T13:00:00Z"), visit("2026-10-02T13:00:00Z")], timeZone: TZ });
  ok("an earlier visit moves a derived start back", iso(earlier.data?.startDate) === "2026-10-02" && earlier.data.endDate === undefined);
  const later = derivedJobDates({ job: derived, visits: [visit("2026-10-06T13:00:00Z"), visit("2026-10-20T13:00:00Z")], timeZone: TZ });
  ok("a later visit moves a derived end forward", iso(later.data?.endDate) === "2026-10-20" && later.data.startDate === undefined);
  const gone = derivedJobDates({ job: derived, visits: [visit("2026-10-06T13:00:00Z", "cancelled")], timeZone: TZ });
  ok("every visit cancelled: derived dates cleared, flags off", gone.data?.startDate === null && gone.data?.endDate === null && gone.data.startDateFromVisits === false && gone.data.endDateFromVisits === false, JSON.stringify(gone.data));
  const same = derivedJobDates({ job: derived, visits: [visit("2026-10-06T15:00:00Z")], timeZone: TZ });
  ok("a visit moved within the same day writes nothing", same.data === null);
  const far = derivedJobDates({ job: derived, visits: [visit("2026-10-06T13:00:00Z"), visit("2028-10-06T13:00:00Z")], timeZone: TZ });
  ok("a visit two years out (a mistyped year) changes nothing — no span over 366 days", far.data === null);
}

console.log("\n4. A person's date is never moved\n");
{
  const person = { startDate: D("2026-10-10"), endDate: D("2026-10-24"), startDateFromVisits: false, endDateFromVisits: false };
  const r = derivedJobDates({ job: person, visits: [visit("2026-10-01T13:00:00Z"), visit("2026-11-30T13:00:00Z")], timeZone: TZ });
  ok("both a person's: nothing written, whatever the visits", r.data === null);
  const startOnly = { startDate: D("2026-10-10"), endDate: null, startDateFromVisits: false, endDateFromVisits: false };
  const s1 = derivedJobDates({ job: startOnly, visits: [visit("2026-10-03T13:00:00Z"), visit("2026-10-12T13:00:00Z")], timeZone: TZ });
  ok("a person's start, no end: the start stays, the end comes from the last visit", s1.data?.startDate === undefined && iso(s1.data?.endDate) === "2026-10-12" && s1.data.endDateFromVisits === true, JSON.stringify(s1.data));
  const s2 = derivedJobDates({ job: startOnly, visits: [visit("2026-10-03T13:00:00Z")], timeZone: TZ });
  ok("…but never an end before the person's start (no end written)", s2.data === null);
  const endPerson = { startDate: D("2026-10-06"), endDate: D("2026-10-20"), startDateFromVisits: true, endDateFromVisits: false };
  const e1 = derivedJobDates({ job: endPerson, visits: [visit("2026-10-06T13:00:00Z", "cancelled")], timeZone: TZ });
  ok("a person's end with a derived start: cancelling every visit keeps the start (no end without a start)", e1.data === null);
  const e2 = derivedJobDates({ job: endPerson, visits: [visit("2026-10-25T13:00:00Z")], timeZone: TZ });
  ok("…and a visit after the person's end does not drag the start past it", e2.data === null || e2.data.startDate === undefined, JSON.stringify(e2.data));
}

console.log("\n5. A person changing a date makes it theirs; re-saving decides nothing\n");
{
  const existing = { startDate: D("2026-10-06"), endDate: D("2026-10-09"), startDateFromVisits: true, endDateFromVisits: true };
  ok("the edit form re-sending the same dates leaves the flags", JSON.stringify(personDateFlags({ existing, sentStart: "2026-10-06", sentEnd: "2026-10-09", nextStart: D("2026-10-06"), nextEnd: D("2026-10-09") })) === "{}");
  ok("a changed start is the person's", JSON.stringify(personDateFlags({ existing, sentStart: "2026-10-07", sentEnd: "2026-10-09", nextStart: D("2026-10-07"), nextEnd: D("2026-10-09") })) === JSON.stringify({ startDateFromVisits: false }));
  ok("a cleared end is the person's decision too", JSON.stringify(personDateFlags({ existing, sentStart: undefined, sentEnd: "", nextStart: D("2026-10-06"), nextEnd: null })) === JSON.stringify({ endDateFromVisits: false }));
  ok("not sent: untouched", JSON.stringify(personDateFlags({ existing, sentStart: undefined, sentEnd: undefined, nextStart: existing.startDate, nextEnd: existing.endDate })) === "{}");
}

console.log("\n6. The shipped route: booking a visit gives the job its dates\n");
{
  resetShapeStub();
  const company = { id: "co1", name: "Tremblay Painting", timezone: TZ, currency: "CAD" };
  const mgr = { id: "m_mgr", userId: "u_mgr", companyId: "co1", role: PRESET_TO_ROLE.manager, permissions: { ...PERMISSION_PRESETS.manager.values } };
  const job = { id: "j1", companyId: "co1", clientId: "c1", quoteId: null, title: "Roy deck stain", status: "unscheduled", startDate: null, endDate: null, startDateFromVisits: false, endDateFromVisits: false, recurring: false, archivedAt: null, company, shifts: [] };
  // The stub records writes without applying them, and reads a relation off
  // the row: point the job's visits at the visits the route has created.
  Object.defineProperty(job, "visits", {
    get: () => writes.filter((w) => w.model === "jobVisit" && w.action === "create").map((w) => w.args.data),
    enumerable: true,
  });
  tables.company = [company];
  tables.member = [mgr];
  tables.user = [{ id: "u_mgr", name: "mgr person" }];
  tables.job = [job];
  tables.jobVisit = [];
  for (const m of ["activityLog", "task", "companyChatRoom", "calendarConnection", "googleCalendarBusy", "shift", "booking", "appointment"]) tables[m] ||= [];
  const VISITS = await import("../app/api/jobs/[id]/visits/route.js");
  session.member = { ...mgr };
  const req = new Request("http://test.local/api", { method: "POST", body: JSON.stringify({ scheduledAt: "2026-10-07T02:00:00Z" }), headers: { "Content-Type": "application/json" } });
  const res = await VISITS.POST(req, { params: Promise.resolve({ id: "j1" }) });
  ok("the visit is booked (201)", res.status === 201, `status ${res.status}`);
  const jobWrites = writes.filter((w) => w.model === "job" && w.action === "update").map((w) => w.args.data);
  const dates = jobWrites.find((d) => "startDate" in d);
  ok("…and the job gets the visit's COMPANY day as start and end (6 Oct, not 7)", iso(dates?.startDate) === "2026-10-06" && iso(dates?.endDate) === "2026-10-06", JSON.stringify(jobWrites));
  ok("…marked as FieldQuo's, so a person's later edit wins", dates?.startDateFromVisits === true && dates?.endDateFromVisits === true);
  ok("…and still flipped off 'Needs a date'", jobWrites.some((d) => d.status === "scheduled"));
}

console.log("\n7. Wired where visits change, and nowhere a person's date is written\n");
{
  const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  ok("POST /api/jobs/[id]/visits syncs after booking", /await syncJobDatesFromVisits\(_params\.id\)/.test(src("app/api/jobs/[id]/visits/route.js")));
  ok("PATCH a visit syncs on a move, a cancel or a reopen", /if \(plan \|\| \(status !== undefined && status !== visit\.status && \(cancelling \|\| reopening\)\)\) \{\s*await syncJobDatesFromVisits/.test(src("app/api/jobs/[id]/visits/[visitId]/route.js")));
  ok("PATCH /api/jobs/[id] hands a CHANGED date to the person", /personDateFlags\(\{ existing, sentStart: startDate, sentEnd: endDate, nextStart, nextEnd \}\)/.test(src("app/api/jobs/[id]/route.js")));
  ok("the job page says when the dates came from the visits", /job\.startDateFromVisits \|\| job\.endDateFromVisits/.test(src("app/app/jobs/[id]/JobDetail.js")));
  ok("the edit form says so too", /app\.jobEdit\.datesFromVisits/.test(src("app/app/jobs/[id]/edit/page.js")));
  const schema = src("prisma/schema.prisma");
  ok("schema: two additive booleans, default false (every existing date is a person's)", /startDateFromVisits Boolean @default\(false\)/.test(schema) && /endDateFromVisits   Boolean @default\(false\)/.test(schema));
}

console.log(`\n${pass + failures.length} checks, ${failures.length} failure(s).\n`);
if (failures.length) process.exitCode = 1;
