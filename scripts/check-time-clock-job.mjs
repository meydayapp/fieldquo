// scripts/check-time-clock-job.mjs
//
//   npm run check:time-clock-job
//
// The self-serve time clock used to write `{ workerId, clockIn, status }` and
// no `jobId`. Job costing reads `where: { jobId: job.id }`, so every hour a
// crew member punched on their own phone was invisible to the job it was
// worked on — labour cost understated by however much the crew clocks
// themselves in, which on a field-service company is most of it. Payroll never
// noticed, because payroll groups by worker.
//
// ══ WHAT THIS EXECUTES, AND WHY THAT MATTERS ══════════════════════════════
//
// The route itself, not a description of it. `scripts/timeclock-stub-loader.mjs`
// points `@/lib/db` and `@/lib/apiMember` at a fixture whose filter engine
// actually APPLIES the nested Prisma operators this path uses — so "a punch on
// another company's job is refused" is a claim about what the query returns,
// not about what the source text says. Delete `companyId` from
// clockableJobWhere and the foreign job matches and this check fails.
//
// The costing arithmetic is executed too — the pure functions in
// lib/costing/unattributedHours.js, against a mix of tagged and untagged rows.
//
// A handful of assertions are unavoidably about SOURCE: that the costing route
// asks for the unattributed figure and returns it under its own key rather than
// folding it into the labour total. Those are scoped by brace matching to ONE
// named function, because a file-wide `indexOf` proves nothing — note that
// `src.indexOf(a) < src.indexOf(b)` FALSE-PASSES when `a` is absent, since -1
// is less than everything.

import { readFileSync } from "node:fs";
import { db, rows, writes, session, reset } from "@/lib/db";
import { GET, POST } from "@/app/api/time-clock/route.js";
import {
  buildJobOptions,
  clockableJobWhere,
  dayBoundsInZone,
  MAX_JOB_OPTIONS,
} from "@/lib/timeclock/jobChoices";
import {
  jobActivitySpan,
  summariseUnattributed,
  unattributedLabourForJob,
} from "@/lib/costing/unattributedHours";
import { actualJobCost } from "@/lib/costing/actualJobCost";

let pass = 0;
const failures = [];
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `   got: ${JSON.stringify(got)}` : ""}`);
  }
};
const eq = (name, got, want) =>
  ok(`${name}`, JSON.stringify(got) === JSON.stringify(want), got);
const section = (title) => console.log(`\n── ${title} ${"─".repeat(Math.max(0, 66 - title.length))}`);

// ═══════════════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════════════

const OURS = "co_ours";
const THEIRS = "co_theirs";
const TZ = "America/Toronto";

/**
 * A crew member, with the REAL Crew grid.
 *
 * Both dials matter and a made-up `{ jobs: "view_only" }` would not be scoped
 * at all: seesOnlyAssignedJobs narrows only when jobs is below view_create_edit
 * AND clientsProperties is below full_view — the job list is the client book in
 * another shape, so holding either one un-scopes the other. The first version
 * of this fixture stated only the first half and every scoping assertion below
 * passed for the wrong reason.
 */
const CREW = {
  id: "mem_crew",
  userId: "usr_crew",
  companyId: OURS,
  role: "employee",
  permissions: { jobs: "view_only", clientsProperties: "name_address_only" },
};

/**
 * A calendar day's worth of instants. Noon local, so the day-boundary maths is
 * exercised without straddling one by accident.
 *
 * Anchored to TODAY, not to a fixed calendar date. It was `2026-09-02`, with a
 * comment saying a fixed anchor stopped the check changing meaning depending on
 * when it ran — a good instinct that is wrong for this particular route, which
 * calls `new Date()` itself and accepts no clock. Against a real now, a frozen
 * anchor means the seeded visits are "today" on exactly one calendar day: this
 * passed on 2 September 2026 and failed on the 3rd, reporting a defect in code
 * nobody had touched.
 *
 * The date is read in TZ rather than UTC because the route computes its day
 * bounds in the company's zone — taking the UTC date would put the anchor on
 * the wrong day for the four hours before local midnight.
 */
const TODAY_ISO = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const TODAY_NOON = new Date(`${TODAY_ISO}T16:00:00.000Z`); // 12:00 in TZ

// dayBoundsInZone() is a pure function of the instant it is given, so the
// assertions about it keep a FROZEN date — that is the case where pinning the
// calendar is right, and the expected ISO strings below are only meaningful
// against a known day. Only the route tests, which race a real `new Date()`,
// need TODAY_NOON.
const FIXED_NOON = new Date("2026-09-02T16:00:00.000Z"); // 12:00 EDT, 2 Sep 2026
const at = (hhmm) => new Date(`${TODAY_ISO}T${hhmm}:00.000Z`);

function seed({ visits = [], jobs = [], entries = [], worker = true } = {}) {
  reset();
  session.member = { ...CREW };
  rows.company = [{ id: OURS, timezone: TZ }, { id: THEIRS, timezone: TZ }];
  rows.member = [{ ...CREW }];
  rows.worker = worker
    ? [{ id: "wrk_1", companyId: OURS, userId: "usr_crew", name: "Dee", hourlyRate: 30 }]
    : [];
  rows.job = jobs;
  rows.jobVisit = visits;
  rows.timeEntry = entries;
}

/** A job, ours and clockable unless told otherwise. */
const job = (id, over = {}) => ({
  id,
  companyId: OURS,
  title: `Job ${id}`,
  status: "in_progress",
  archivedAt: null,
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  client: { name: `Client ${id}` },
  ...over,
});

/** A visit assigned to our crew member today. */
const visit = (id, jobId, hhmm, over = {}) => ({
  id,
  jobId,
  assignedToId: "usr_crew",
  scheduledAt: at(hhmm),
  status: "scheduled",
  ...over,
});

const body = (payload) => ({ json: async () => payload });
const readJson = async (res) => ({ status: res.status, body: await res.json() });

// ═══════════════════════════════════════════════════════════════════════════
section("The day boundary is the COMPANY's, not the server's");
// ═══════════════════════════════════════════════════════════════════════════
{
  const { start, next } = dayBoundsInZone(FIXED_NOON, TZ);
  eq("Toronto's 2 Sep starts at 04:00Z", start.toISOString(), "2026-09-02T04:00:00.000Z");
  eq("...and ends at 04:00Z on the 3rd", next.toISOString(), "2026-09-03T04:00:00.000Z");

  // 01:00Z on the 3rd is still the 2nd in Toronto. A server-local
  // `setHours(0,0,0,0)` would have called it the 3rd and looked for the wrong
  // day's visits for every company west of Greenwich.
  const late = dayBoundsInZone(new Date("2026-09-03T01:00:00.000Z"), TZ);
  eq("21:00 on the 2nd is still the 2nd", late.start.toISOString(), "2026-09-02T04:00:00.000Z");

  // A month boundary: "day + 1" arithmetic would produce the 31st of September.
  const eom = dayBoundsInZone(new Date("2026-09-30T16:00:00.000Z"), TZ);
  eq("30 Sep rolls to 1 Oct, not 31 Sep", eom.next.toISOString(), "2026-10-01T04:00:00.000Z");

  const utc = dayBoundsInZone(FIXED_NOON, "UTC");
  eq("a UTC company's day starts at 00:00Z", utc.start.toISOString(), "2026-09-02T00:00:00.000Z");

  // ── The pair that survives whatever zone the runner happens to be in ─────
  //
  // Every assertion above can be satisfied by reading the SERVER's calendar
  // date and then applying the company's offset to it — which is a different
  // and wrong function, and one whose mutant this file failed to kill on the
  // first attempt because the machine running it sits in America/Toronto.
  //
  // The same instant, in two zones that disagree about what DAY it is. A
  // server-local implementation can only produce one date, so it must get one
  // of these two wrong no matter where it runs.
  const brink = new Date("2026-09-03T01:00:00.000Z");
  eq(
    "at 01:00Z a UTC company is already on the 3rd",
    dayBoundsInZone(brink, "UTC").start.toISOString(),
    "2026-09-03T00:00:00.000Z",
  );
  eq(
    "...and at the same instant a Toronto company is still on the 2nd",
    dayBoundsInZone(brink, TZ).start.toISOString(),
    "2026-09-02T04:00:00.000Z",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("The one where-fragment both halves use");
// ═══════════════════════════════════════════════════════════════════════════
{
  // The picker's list and the write's check are the SAME object. Two copies of
  // this rule is how a server comes to accept a job the screen never offered —
  // or refuse one it did.
  const w = clockableJobWhere({ companyId: OURS, full: CREW, jobId: "j1" });
  eq("the tenant boundary is part of the definition", w.companyId, OURS);
  eq("archived jobs are out", w.archivedAt, null);
  eq("cancelled jobs are out", w.status, { not: "cancelled" });
  eq("the id is applied when one is asked about", w.id, "j1");
  ok("a scoped member is narrowed to their own visits", Boolean(w.visits?.some?.assignedToId));
  const unscoped = clockableJobWhere({ companyId: OURS, full: { role: "owner" } });
  ok("an owner is not narrowed", !("visits" in unscoped));
  ok("...and the id is simply absent when none is asked about", !("id" in unscoped));
}

// ═══════════════════════════════════════════════════════════════════════════
section("What the picker offers — and what it dares to default");
// ═══════════════════════════════════════════════════════════════════════════
{
  // NO VISIT TODAY. Their other open jobs are still offered — a two-week
  // repaint has one visit on day one and thirteen days of work after it — but
  // nothing is suggested, because nothing is more likely than anything else.
  const none = buildJobOptions([], [job("j1"), job("j2")]);
  eq("no visit today → nothing suggested", none.suggestedJobId, null);
  eq("...but the open jobs are still offered", none.options.length, 2);
  eq("...and none of them claims to be today's", none.options.some((o) => o.today), false);
  eq("...todayCount says zero, so the screen can say why", none.todayCount, 0);

  // EXACTLY ONE. Defaulting is kindness, not a guess: there is no other answer.
  const one = buildJobOptions([{ jobId: "j1", scheduledAt: at("12:00"), job: job("j1") }], [job("j2")]);
  eq("one visit today → that job is suggested", one.suggestedJobId, "j1");
  eq("...it sorts first", one.options[0].id, "j1");
  eq("...and is marked as today's", one.options[0].today, true);
  eq("...the other open job is still reachable", one.options[1].id, "j2");

  // THREE. A guess would be wrong two times in three. Ask.
  const three = buildJobOptions(
    [
      { jobId: "j2", scheduledAt: at("13:00"), job: job("j2") },
      { jobId: "j1", scheduledAt: at("11:00"), job: job("j1") },
      { jobId: "j3", scheduledAt: at("17:00"), job: job("j3") },
    ],
    [job("j4")],
  );
  eq("three visits today → nothing is suggested", three.suggestedJobId, null);
  eq("...the count is reported so the screen can ask a real question", three.todayCount, 3);
  eq("...in the order the day happens", three.options.slice(0, 3).map((o) => o.id), ["j1", "j2", "j3"]);

  // TWO VISITS ON ONE JOB is one option and one job — you cannot clock into the
  // same job twice — so it must still default.
  const twice = buildJobOptions(
    [
      { jobId: "j1", scheduledAt: at("11:00"), job: job("j1") },
      { jobId: "j1", scheduledAt: at("18:00"), job: job("j1") },
    ],
    [],
  );
  eq("two visits on ONE job is still one choice", twice.options.length, 1);
  eq("...so it is unambiguous and gets defaulted", twice.suggestedJobId, "j1");

  // The cap can only ever drop jobs with no visit today.
  const many = buildJobOptions(
    [{ jobId: "j_today", scheduledAt: at("11:00"), job: job("j_today") }],
    Array.from({ length: MAX_JOB_OPTIONS + 20 }, (_, i) => job(`bulk${i}`)),
  );
  eq("the option list is capped", many.options.length, MAX_JOB_OPTIONS);
  eq("...truncation is reported, not hidden", many.truncated, true);
  eq("...and today's visit survives the cap", many.options[0].id, "j_today");
  eq("...and is still the suggestion", many.suggestedJobId, "j_today");

  // Hostile input: a visit row with no job at all must not become an option
  // with a null id that the <select> would happily submit.
  const junk = buildJobOptions([{ scheduledAt: at("09:00") }, null], [null, { title: "no id" }]);
  eq("a visit with no job is dropped", junk.options.length, 0);
  eq("...and nothing is suggested from it", junk.suggestedJobId, null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("GET — the screen's own view of the day");
// ═══════════════════════════════════════════════════════════════════════════
{
  seed({
    jobs: [job("j1"), job("j2"), job("theirs", { companyId: THEIRS })],
    visits: [visit("v1", "j1", "12:30")],
  });
  const res = await GET(new Request("http://x/api/time-clock"));
  const { status, body: payload } = await readJson(res);
  eq("200", status, 200);
  eq("exactly one visit today is suggested", payload.suggestedJobId, "j1");
  eq("...todayCount is one", payload.todayCount, 1);
  ok(
    "another company's job is not in the picker",
    !payload.jobOptions.some((o) => o.id === "theirs"),
    payload.jobOptions.map((o) => o.id),
  );
  // A SCOPED crew member sees only the jobs they have a visit on — j2 is ours
  // and open and still absent, because the clock screen must not become a wider
  // door onto the client book than /app/jobs already is. Same rule, one
  // definition (assignedJobWhere), reused rather than restated here.
  eq("a scoped crew member is offered only their own job", payload.jobOptions.map((o) => o.id), ["j1"]);

  // The same fixture, read by an owner: unscoped, so both jobs are reachable —
  // which is what stops a sole trader with no visit assigned to themselves from
  // being locked out of their own job costing.
  session.member = { id: "mem_o", userId: "usr_o", companyId: OURS, role: "owner", permissions: null };
  rows.member = [session.member];
  rows.worker = [{ id: "wrk_o", companyId: OURS, userId: "usr_o", name: "Boss", hourlyRate: 60 }];
  const asOwner = await (await GET(new Request("http://x/api/time-clock"))).json();
  eq("an owner is offered both open jobs", asOwner.jobOptions.map((o) => o.id).sort(), ["j1", "j2"]);
  eq("...and still not the other tenant's", asOwner.jobOptions.some((o) => o.id === "theirs"), false);
  eq("...with no visit of their own, nothing is suggested", asOwner.suggestedJobId, null);

  // Three visits: the same route, no suggestion.
  seed({
    jobs: [job("j1"), job("j2"), job("j3")],
    visits: [visit("v1", "j1", "11:00"), visit("v2", "j2", "14:00"), visit("v3", "j3", "18:00")],
  });
  const three = await (await GET(new Request("http://x/api/time-clock"))).json();
  eq("three visits → no suggestion from the route either", three.suggestedJobId, null);
  eq("...and the count reaches the screen", three.todayCount, 3);

  // Cancelled visits and archived jobs are not somewhere anybody is going.
  seed({
    jobs: [job("j1"), job("j_arch", { archivedAt: new Date() }), job("j_cx", { status: "cancelled" })],
    visits: [visit("v1", "j1", "09:00", { status: "cancelled" })],
  });
  const filtered = await (await GET(new Request("http://x/api/time-clock"))).json();
  eq("a cancelled visit does not count as today's", filtered.todayCount, 0);
  eq("an archived job is not offered", filtered.jobOptions.some((o) => o.id === "j_arch"), false);
  eq("a cancelled job is not offered", filtered.jobOptions.some((o) => o.id === "j_cx"), false);
  eq("the live job still is", filtered.jobOptions.map((o) => o.id), ["j1"]);

  // Someone who was never added under Workers gets an honest empty shape, not
  // a picker they cannot use.
  seed({ worker: false, jobs: [job("j1")] });
  const nobody = await (await GET(new Request("http://x/api/time-clock"))).json();
  eq("no worker record → null worker", nobody.worker, null);
  eq("...and no options to tease them with", nobody.jobOptions, []);
}

// ═══════════════════════════════════════════════════════════════════════════
section("POST — punching in, with and without a job");
// ═══════════════════════════════════════════════════════════════════════════
{
  // A punch with NO job chosen. Legitimate: travel, the yard, a day of
  // quoting. It must succeed, and it must write an explicit null rather than
  // omitting the column.
  seed({ jobs: [job("j1")] });
  const res = await POST(body({ action: "in" }));
  const { status, body: out } = await readJson(res);
  eq("a punch with no job is accepted", status, 200);
  eq("...and the entry carries no job", out.open.jobId, null);
  const created = writes.find((w) => w.model === "timeEntry" && w.action === "create");
  ok("...jobId is written explicitly, not omitted", "jobId" in created.data, Object.keys(created.data));
  eq("...as null", created.data.jobId, null);
  eq("...and it is pending, like every other punch", created.data.status, "pending");

  // The whole point of the exercise.
  seed({ jobs: [job("j1")], visits: [visit("v1", "j1", "12:00")] });
  const withJob = await readJson(await POST(body({ action: "in", jobId: "j1" })));
  eq("a punch with a job is accepted", withJob.status, 200);
  eq("...and the entry reaches costing", withJob.body.open.jobId, "j1");
  eq(
    "...the row really carries it",
    writes.find((w) => w.action === "create").data.jobId,
    "j1",
  );

  // ── The one that would be a cross-tenant write ───────────────────────────
  // A time entry booked against another tenant's jobId lands in THEIR job
  // costing — hours and labour cost against a job they can see and we cannot,
  // silent on both sides. This is the assertion the fixture's filter engine
  // exists for: it applies `companyId`, so a route that stopped scoping would
  // find the row and this would fail.
  seed({ jobs: [job("j1"), job("theirs", { companyId: THEIRS })] });
  const foreign = await readJson(await POST(body({ action: "in", jobId: "theirs" })));
  eq("another company's job is refused", foreign.status, 400);
  ok("...with a sentence, not a stack trace", typeof foreign.body.error === "string" && foreign.body.error.length > 10);
  eq("...and NOTHING is written", writes.length, 0);

  // A job id that does not exist at all, and a non-string one.
  seed({ jobs: [job("j1")] });
  eq("an unknown job is refused", (await readJson(await POST(body({ action: "in", jobId: "nope" })))).status, 400);
  eq("...nothing written", writes.length, 0);
  seed({ jobs: [job("j1")] });
  eq(
    "a non-string jobId is refused",
    (await readJson(await POST(body({ action: "in", jobId: { evil: true } })))).status,
    400,
  );
  eq("...nothing written", writes.length, 0);

  // An archived job cannot take new hours, and the picker never offered it.
  seed({ jobs: [job("j_arch", { archivedAt: new Date() })] });
  eq(
    "an archived job is refused",
    (await readJson(await POST(body({ action: "in", jobId: "j_arch" })))).status,
    400,
  );

  // A crew member SCOPED to their own jobs may only book to jobs they have a
  // visit on — the same rule /app/jobs applies, reused rather than restated.
  seed({ jobs: [job("j_mine"), job("j_theirs_internal")], visits: [visit("v1", "j_mine", "09:00")] });
  session.member = { ...CREW };
  rows.member = [{ ...CREW }];
  const scoped = await readJson(await POST(body({ action: "in", jobId: "j_theirs_internal" })));
  eq("a scoped crew member cannot book to a job that isn't theirs", scoped.status, 400);
  seed({ jobs: [job("j_mine"), job("j_other")], visits: [visit("v1", "j_mine", "09:00")] });
  eq(
    "...but can book to the one that is",
    (await readJson(await POST(body({ action: "in", jobId: "j_mine" })))).status,
    200,
  );

  // An owner is unscoped and reaches every open job — the sole trader with no
  // visit assigned to themselves must not be locked out of their own costing.
  seed({ jobs: [job("j_any")] });
  const owner = { id: "mem_owner", userId: "usr_owner", companyId: OURS, role: "owner", permissions: null };
  session.member = owner;
  rows.member = [owner];
  rows.worker = [{ id: "wrk_o", companyId: OURS, userId: "usr_owner", name: "Boss", hourlyRate: 60 }];
  eq(
    "an owner with no visit can still tag a job",
    (await readJson(await POST(body({ action: "in", jobId: "j_any" })))).status,
    200,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("POST — the states a phone actually gets into");
// ═══════════════════════════════════════════════════════════════════════════
{
  // Already clocked in. One open entry at a time, the same guard the manual API
  // enforces — and a second punch must not create a shadow entry.
  seed({
    jobs: [job("j1")],
    entries: [{ id: "te_open", workerId: "wrk_1", clockIn: at("09:00"), clockOut: null, jobId: null, status: "pending" }],
  });
  const dup = await readJson(await POST(body({ action: "in", jobId: "j1" })));
  eq("a second clock-in is refused", dup.status, 409);
  eq("...nothing is written", writes.length, 0);

  // Clock out with no open entry.
  seed({ jobs: [job("j1")] });
  const noOpen = await readJson(await POST(body({ action: "out" })));
  eq("clocking out when you aren't in is refused", noOpen.status, 409);
  eq("...nothing is written", writes.length, 0);

  // Clock out keeps the job the hours were worked on.
  seed({
    jobs: [job("j1")],
    entries: [{ id: "te1", workerId: "wrk_1", clockIn: new Date(Date.now() - 2 * 3600000), clockOut: null, jobId: "j1", status: "pending" }],
  });
  const out = await readJson(await POST(body({ action: "out" })));
  eq("clock-out succeeds", out.status, 200);
  eq("...and keeps the job", out.body.entry.jobId, "j1");
  ok("...with about two hours booked", Math.abs(out.body.entry.hours - 2) < 0.02, out.body.entry.hours);

  // Switching with nothing open.
  seed({ jobs: [job("j1")] });
  eq(
    "switching when you aren't clocked in is refused",
    (await readJson(await POST(body({ action: "switch", jobId: "j1" })))).status,
    409,
  );

  // An unknown action does not silently succeed.
  seed({ jobs: [job("j1")] });
  eq("an unknown action is refused", (await readJson(await POST(body({ action: "lunch" })))).status, 400);
  eq("...nothing written", writes.length, 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("Moving to a second job without going off the clock");
// ═══════════════════════════════════════════════════════════════════════════
{
  // The failure this exists to stop: the crew stays clocked in and the whole
  // day lands on the first job. A switch SPLITS — the morning stays where it
  // was worked.
  const startedAt = new Date(Date.now() - 3 * 3600000);
  seed({
    jobs: [job("j1"), job("j2")],
    visits: [visit("v1", "j1", "09:00"), visit("v2", "j2", "17:00")],
    entries: [{ id: "te1", workerId: "wrk_1", clockIn: startedAt, clockOut: null, jobId: "j1", status: "pending" }],
  });
  const sw = await readJson(await POST(body({ action: "switch", jobId: "j2" })));
  eq("a switch succeeds", sw.status, 200);
  const closed = writes.find((w) => w.action === "update");
  const opened = writes.find((w) => w.action === "create");
  ok("the first entry is CLOSED, not re-pointed", Boolean(closed?.data?.clockOut), closed?.data);
  ok("...with about three hours on it", Math.abs(closed.data.hours - 3) < 0.02, closed.data.hours);
  ok("...and it keeps job j1", !("jobId" in closed.data), closed.data);
  eq("a new entry opens on j2", opened.data.jobId, "j2");
  eq("...and it is pending like any other punch", opened.data.status, "pending");
  eq("...one open entry, still", rows.timeEntry.filter((e) => !e.clockOut).length, 1);

  // Switching to the same job is a control that would appear to work and do
  // nothing. Refused with a sentence.
  seed({
    jobs: [job("j1")],
    visits: [visit("v1", "j1", "09:00")],
    entries: [{ id: "te1", workerId: "wrk_1", clockIn: startedAt, clockOut: null, jobId: "j1", status: "pending" }],
  });
  eq(
    "switching to the job you're already on is refused",
    (await readJson(await POST(body({ action: "switch", jobId: "j1" })))).status,
    409,
  );
  eq("...nothing written", writes.length, 0);

  // Switching TO no job is legitimate — leaving site to drive.
  seed({
    jobs: [job("j1")],
    entries: [{ id: "te1", workerId: "wrk_1", clockIn: startedAt, clockOut: null, jobId: "j1", status: "pending" }],
  });
  const toNothing = await readJson(await POST(body({ action: "switch" })));
  eq("switching to no job succeeds", toNothing.status, 200);
  eq("...and the new entry has none", toNothing.body.open.jobId, null);

  // A switch to another company's job is refused on the same rule as a punch,
  // and must not close the entry on the way to refusing.
  seed({
    jobs: [job("j1"), job("theirs", { companyId: THEIRS })],
    entries: [{ id: "te1", workerId: "wrk_1", clockIn: startedAt, clockOut: null, jobId: "j1", status: "pending" }],
  });
  const swForeign = await readJson(await POST(body({ action: "switch", jobId: "theirs" })));
  eq("switching to another company's job is refused", swForeign.status, 400);
  eq("...and the open entry is untouched", writes.length, 0);
  eq("...still on the clock", rows.timeEntry.filter((e) => !e.clockOut).length, 1);

  // The mis-tap: chose the wrong job, fixed it ten seconds later. Splitting
  // would file a 0.00h entry against a job nobody worked, on a timesheet
  // somebody has to approve.
  seed({
    jobs: [job("j1"), job("j2")],
    visits: [visit("v1", "j1", "09:00"), visit("v2", "j2", "14:00")],
    entries: [{ id: "te1", workerId: "wrk_1", clockIn: new Date(Date.now() - 10_000), clockOut: null, jobId: "j1", status: "pending" }],
  });
  const mistap = await readJson(await POST(body({ action: "switch", jobId: "j2" })));
  eq("a ten-second correction succeeds", mistap.status, 200);
  eq("...and is flagged as a correction, not a shift", mistap.body.corrected, true);
  eq("...no second entry is created", writes.filter((w) => w.action === "create").length, 0);
  eq("...the open entry is re-pointed", writes.find((w) => w.action === "update").data.jobId, "j2");
  ok(
    "...and no zero-hour row exists",
    !rows.timeEntry.some((e) => e.hours === 0),
    rows.timeEntry.map((e) => e.hours),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("Costing — attributed and unattributed, told apart");
// ═══════════════════════════════════════════════════════════════════════════
{
  // The arithmetic the job panel runs. Attributed hours are the ONLY ones in
  // the labour cost, which is correct — and is precisely why the untagged ones
  // have to be named somewhere.
  const attributed = [
    { hours: 8, status: "approved", workerId: "w1", clockIn: new Date("2026-08-03T12:00:00Z"), clockOut: new Date("2026-08-03T20:00:00Z"), worker: { hourlyRate: 30 } },
    { hours: 6, status: "pending", workerId: "w2", clockIn: new Date("2026-08-05T12:00:00Z"), clockOut: new Date("2026-08-05T18:00:00Z"), worker: { hourlyRate: 25 } },
  ];
  const cost = actualJobCost([], attributed);
  eq("only approved, tagged hours are a cost", cost.labour.cost, 240);
  eq("...pending ones are reported, not counted", cost.labour.pendingHours, 6);

  const span = jobActivitySpan({ entries: attributed });
  eq("the window opens at the first clock-in", span.from.toISOString(), "2026-08-03T12:00:00.000Z");
  eq("...and closes at the last clock-out", span.to.toISOString(), "2026-08-05T18:00:00.000Z");

  // An entry still open has no clockOut; its clock-in is the latest honest fact.
  const openSpan = jobActivitySpan({
    entries: [{ clockIn: new Date("2026-08-03T12:00:00Z"), clockOut: null }],
  });
  eq("an open entry bounds the window at its clock-in", openSpan.to.toISOString(), "2026-08-03T12:00:00.000Z");

  // No entries at all — the case this whole feature is about, a job worked
  // entirely from phones that landed nowhere. The job's own dates carry it.
  const fromDates = jobActivitySpan({
    entries: [],
    job: { startDate: new Date("2026-08-01T00:00:00Z"), endDate: new Date("2026-08-09T00:00:00Z") },
  });
  eq("a job with no logged hours falls back to its own dates", fromDates.from.toISOString(), "2026-08-01T00:00:00.000Z");
  eq("...to its end date", fromDates.to.toISOString(), "2026-08-09T00:00:00.000Z");

  const running = jobActivitySpan({
    entries: [],
    job: { startDate: new Date("2026-08-01T00:00:00Z") },
    now: new Date("2026-08-20T00:00:00Z"),
  });
  eq("a job still running runs to now", running.to.toISOString(), "2026-08-20T00:00:00.000Z");

  // Nothing to say is said as nothing.
  eq("no hours and no dates is null, not a guessed window", jobActivitySpan({ entries: [], job: {} }), null);
  eq(
    "a backwards window is null rather than silently matching nothing",
    jobActivitySpan({
      entries: [],
      job: { startDate: new Date("2026-08-09T00:00:00Z"), completedAt: new Date("2026-08-01T00:00:00Z") },
    }),
    null,
  );

  // The summing rules.
  const summary = summariseUnattributed([
    { hours: 8, status: "approved", workerId: "w1" },
    { hours: 4, status: "pending", workerId: "w2" },
    { hours: 99, status: "rejected", workerId: "w3" },
    { hours: 0, status: "approved", workerId: "w4" },
    { hours: 2, status: "approved", workerId: "w1" },
  ]);
  eq("approved untagged hours", summary.approvedHours, 10);
  eq("pending untagged hours", summary.pendingHours, 4);
  eq("both, because both are missing from costing", summary.hours, 14);
  ok(
    "a REJECTED entry is not a gap — somebody said it didn't happen",
    summary.hours === 14,
    summary,
  );
  eq("distinct people", summary.workers, 2);
  eq("entries counted", summary.entries, 3);
}

// ═══════════════════════════════════════════════════════════════════════════
section("Costing — the query that finds the untagged hours");
// ═══════════════════════════════════════════════════════════════════════════
{
  // Executed against the same filter engine, so "company-scoped" and "untagged
  // only" are properties of what comes back, not of the source text.
  reset();
  rows.worker = [
    { id: "w_ours", companyId: OURS, name: "Ours", hourlyRate: 30 },
    { id: "w_theirs", companyId: THEIRS, name: "Theirs", hourlyRate: 30 },
  ];
  rows.job = [job("j1")];
  rows.timeEntry = [
    // Tagged to the job — already in the labour figure, must not be double-counted.
    { id: "a", workerId: "w_ours", jobId: "j1", hours: 8, status: "approved", clockIn: new Date("2026-08-03T12:00:00Z"), clockOut: new Date("2026-08-03T20:00:00Z") },
    { id: "a2", workerId: "w_ours", jobId: "j1", hours: 6, status: "approved", clockIn: new Date("2026-08-05T12:00:00Z"), clockOut: new Date("2026-08-05T18:00:00Z") },
    // Untagged, ours, inside the window — the whole point.
    { id: "b", workerId: "w_ours", jobId: null, hours: 5, status: "approved", clockIn: new Date("2026-08-04T12:00:00Z"), clockOut: new Date("2026-08-04T17:00:00Z") },
    { id: "c", workerId: "w_ours", jobId: null, hours: 3, status: "pending", clockIn: new Date("2026-08-04T18:00:00Z"), clockOut: new Date("2026-08-04T21:00:00Z") },
    // Untagged, ours, OUTSIDE the window.
    { id: "d", workerId: "w_ours", jobId: null, hours: 40, status: "approved", clockIn: new Date("2026-07-01T12:00:00Z"), clockOut: new Date("2026-07-01T20:00:00Z") },
    // Untagged, ANOTHER TENANT, inside the window.
    { id: "e", workerId: "w_theirs", jobId: null, hours: 100, status: "approved", clockIn: new Date("2026-08-04T12:00:00Z"), clockOut: new Date("2026-08-04T20:00:00Z") },
  ];

  const attributed = rows.timeEntry.filter((e) => e.jobId === "j1");
  const result = await unattributedLabourForJob(db, { companyId: OURS, jobId: "j1", attributed });
  eq("untagged hours inside the window are found", result.hours, 8);
  eq("...approved and pending told apart", [result.approvedHours, result.pendingHours], [5, 3]);
  ok("hours outside the window are not swept in", result.hours !== 48, result);
  ok("another tenant's untagged hours are NOT counted", result.hours !== 108, result);
  eq("the window is reported so the sentence can name it", result.from, "2026-08-03T12:00:00.000Z");

  // Nothing untagged in the window says nothing, rather than "0 h".
  rows.timeEntry = rows.timeEntry.filter((e) => e.jobId === "j1");
  eq(
    "a clean period returns null, not a zero",
    await unattributedLabourForJob(db, { companyId: OURS, jobId: "j1", attributed }),
    null,
  );

  // A job with nothing logged and no dates has no window — and no sentence.
  rows.job = [job("j_bare", { startDate: null, endDate: null, completedAt: null })];
  eq(
    "no window, no claim",
    await unattributedLabourForJob(db, { companyId: OURS, jobId: "j_bare", attributed: [] }),
    null,
  );

  // ...but a job with a start date and untagged hours in it DOES speak, even
  // with nothing tagged to it. That is the headline case: a week of work that
  // shows as an untouched job.
  rows.job = [job("j_phone", { startDate: new Date("2026-08-01T00:00:00Z"), endDate: new Date("2026-08-09T00:00:00Z") })];
  rows.timeEntry = [
    { id: "p", workerId: "w_ours", jobId: null, hours: 32, status: "approved", clockIn: new Date("2026-08-04T12:00:00Z"), clockOut: new Date("2026-08-04T20:00:00Z") },
  ];
  const phoneOnly = await unattributedLabourForJob(db, { companyId: OURS, jobId: "j_phone", attributed: [] });
  eq("a job with no tagged hours still reports the gap", phoneOnly.hours, 32);
}

// ═══════════════════════════════════════════════════════════════════════════
section("The wiring nothing else can prove — scoped to one function each");
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The body of one named function, brace-matched.
 *
 * The parameter list is walked to its closing paren first: taking the next `{`
 * after the name lands on the destructuring brace of `GET(request, { params })`
 * and matches a two-word "body" every assertion then passes against.
 */
function functionBody(src, name) {
  const start = src.search(new RegExp(`(export\\s+)?(async\\s+)?function\\s+${name}\\s*\\(`));
  if (start === -1) return null;
  const paren = src.indexOf("(", start);
  if (paren === -1) return null;
  let parens = 0;
  let afterParams = -1;
  for (let i = paren; i < src.length; i++) {
    if (src[i] === "(") parens++;
    else if (src[i] === ")") {
      parens--;
      if (parens === 0) {
        afterParams = i;
        break;
      }
    }
  }
  if (afterParams === -1) return null;
  const open = src.indexOf("{", afterParams);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

/**
 * `a` appears before `b`, and BOTH appear.
 *
 * `src.indexOf(a) < src.indexOf(b)` false-passes whenever `a` is absent: -1 is
 * less than every index, so deleting the very line under test makes the
 * assertion pass. Every ordering claim below goes through here.
 */
function before(src, a, b) {
  const i = src.indexOf(a);
  const j = src.indexOf(b);
  return i !== -1 && j !== -1 && i < j;
}

// The guard's own guard. `before` is only worth having if it fails on an
// ABSENT needle — the naive `indexOf(a) < indexOf(b)` returns true there,
// because -1 is less than every index, so deleting the line under test would
// make the assertion pass. This is the trap, executed.
ok("before() refuses an absent needle", before("bc", "a", "b") === false);
ok("before() refuses an absent haystack term", before("ab", "a", "z") === false);
ok("before() still says yes when both are present and ordered", before("ab", "a", "b") === true);
ok("before() says no when the order is wrong", before("ba", "a", "b") === false);

{
  const COSTING = "app/api/jobs/[id]/costing/route.js";
  const src = readFileSync(COSTING, "utf8");
  const get = functionBody(src, "GET");
  ok(`${COSTING} — GET is brace-matched`, Boolean(get));

  ok(
    "the costing route asks for the unattributed figure",
    /unattributedLabourForJob\s*\(/.test(get),
  );
  ok(
    "...scoped to the caller's company, not the job alone",
    /unattributedLabourForJob\([\s\S]{0,400}?companyId:\s*member\.companyId/.test(get),
  );
  ok(
    "...and returns it under its OWN key, never folded into labour",
    /\n\s*unattributed,\n/.test(get),
  );
  ok(
    "the labour query still filters by this job — the figure above it is attributed hours only",
    /db\.timeEntry\.findMany\(\{[\s\S]{0,200}?jobId:\s*job\.id/.test(get),
  );
  ok(
    "...and selects the timestamps the window is measured from",
    /clockIn:\s*true/.test(get) && /clockOut:\s*true/.test(get),
  );
  ok(
    "the unattributed lookup happens AFTER the entries it is measured against",
    before(get, "db.timeEntry.findMany", "unattributedLabourForJob"),
  );

  // The panel must render them apart. A single blended number that quietly
  // INCLUDES untagged hours is a different lie from one that excludes them.
  const panel = readFileSync("app/components/jobs/JobCosting.js", "utf8");
  ok(
    "the panel reads the unattributed figure",
    /data\.unattributed/.test(panel),
  );
  // Scoped to the 500 characters immediately before the note itself, not to the
  // file. The first version of this assertion scanned the whole panel and was
  // satisfied by an identical condition 200 lines earlier — so replacing the
  // render guard with `{false && (` left the block dead and the check green.
  const noteAt = panel.indexOf("app.jobCosting.unattributedNote");
  ok("the panel has a place to say it", noteAt !== -1);
  ok(
    "...rendered only when there is something to say, at the note's OWN guard",
    noteAt !== -1 &&
      /unattributed\s*&&\s*unattributed\.hours\s*>\s*0\s*&&/.test(
        panel.slice(Math.max(0, noteAt - 500), noteAt),
      ),
  );
  ok(
    "...under its own key rather than added to a displayed total",
    !/actual\.total\s*\+\s*unattributed/.test(panel) &&
      !/unattributed\.hours\s*\+\s*actual\.labour/.test(panel),
  );
  ok(
    "...and the labour note says the hours are this job's",
    /hoursApproved/.test(panel),
  );

  const messages = readFileSync("app/i18n/appMessages.js", "utf8");
  for (const key of [
    "app.jobCosting.unattributedNote",
    "app.jobCosting.unattributedFix",
    "app.clock.jobLabel",
    "app.clock.noJob",
    "app.clock.switchAction",
    "app.clock.noJobEntry",
  ]) {
    // Twice: English and French. The app catalogue gates French, and a crew
    // screen that falls back to English mid-sentence is the failure the
    // catalogue exists to prevent.
    const count = messages.split(`"${key}"`).length - 1;
    ok(`${key} is defined in both gated languages`, count >= 2, count);
  }

  const clock = readFileSync("app/app/clock/page.js", "utf8");
  ok(
    "the clock screen never asks for a location",
    !/geolocation|getCurrentPosition|watchPosition/i.test(clock),
  );
  ok(
    "...and the route stores no coordinate",
    !/latitude|longitude/i.test(readFileSync("app/api/time-clock/route.js", "utf8")),
  );
  ok(
    "the picker is 16px or larger, so iOS does not zoom the page on focus",
    /<select[\s\S]{0,400}?text-base/.test(clock),
  );
}

console.log(
  `\n${failures.length === 0 ? `ALL PASS — ${pass} checks` : `${failures.length} FAILED of ${pass + failures.length}`}`,
);
for (const f of failures) console.log(`  ✗ ${f}`);
process.exit(failures.length ? 1 : 0);
