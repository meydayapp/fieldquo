// scripts/check-visit-status.mjs
//
// Three features and a counter that were correct in source and unreachable.
//
// ══ What was wrong ═════════════════════════════════════════════════════════
//
// `JobVisit.status` was written once, at creation, as "scheduled". Nothing in
// the product could ever change it again. The PATCH route accepted a status and
// reacted to two values; the only client that ever called that route was the
// checklist, which sends `checklistItems` and nothing else.
//
// So: the "on my way" text to the homeowner had editable wording at
// /app/settings/messages (under a heading saying it is the ONE message that
// really sends), a template renderer, a STOP/opt-out check and a Twilio call —
// and no button anywhere could fire it. `ensureUpcomingVisit` never ran from a
// human action. And the job page's "0 of 3 complete" counter, filtering on
// status === "completed", could never move off zero.
//
// ══ Why the guard is structural ════════════════════════════════════════════
//
// Every one of those files passed every check in this repo. `check:all` was
// green, the build was green, the route's own logic was right. What was missing
// was a CALLER, and no check in the repo asked whether a route had one.
//
// So this asks the question that was never asked: does a non-API surface send
// a status to that endpoint, and is every status it can send one the route and
// the badge map actually know about?
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  visitActions,
  VISIT_STATUS_LABELS,
  VISIT_STATUS_TONE,
  VISIT_TONE_CLASSES,
  visitStatusLabel,
  visitStatusClasses,
  mayMoveVisit,
} from "../lib/jobs/visitStatus.js";
import { validateJobDates, parseDateOrNull } from "../lib/jobs/validateJobDates.js";
import { isVisitOutsideJobRange } from "../lib/jobs/visitInRange.js";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const read = (p) => strip(readFileSync(p, "utf8"));

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

// ══ 1. A human surface actually sends a status ═════════════════════════════

section("1. Something outside app/api PATCHes a visit with a status");

const clientFiles = walk("app").filter((f) => !f.startsWith(join("app", "api")));
const senders = clientFiles.filter((f) => {
  const src = read(f);
  // The endpoint, and a status in the body. Both, in the same file — either
  // alone is what the codebase had before and it was not enough.
  return /\/visits\/\$\{[^}]*\}/.test(src) && /body:\s*JSON\.stringify\(\{\s*status/.test(src);
});
ok(senders.length > 0, "at least one client surface sends { status } to /api/jobs/[id]/visits/[visitId]", senders);

// ══ 2. Every status the UI can send is one the route knows ═════════════════

section("2. Every offered transition lands somewhere real");

const ROUTE = read("app/api/jobs/[id]/visits/[visitId]/route.js");
const offered = [...new Set(
  ["scheduled", "on_the_way", "completed", "cancelled", "canceled", "in_progress", "zzz-unknown"]
    .flatMap((s) => visitActions(s).map((a) => a.to)),
)];

ok(offered.includes("on_the_way"), "the UI can put a visit on the way — the state the SMS hangs off", offered);
ok(offered.includes("completed"), "the UI can complete a visit — the state the counter and recurrence hang off", offered);

for (const status of offered) {
  ok(
    Object.prototype.hasOwnProperty.call(VISIT_STATUS_LABELS, status),
    `"${status}" has a human label rather than rendering raw`,
  );
}

// ══ 2b. That label is a KEY, and the page actually resolves it ═════════════
//
// This map held English strings, so the badge said "On the way" in a French
// office — a state a crew member is texted about, on the one screen the office
// watches it from. Two halves have to hold: the map carries a translation key,
// and the one caller passes a `t` to resolve it. Either alone is a screen that
// still renders English.

section("2b. The visit badge is translated, not English out of lib/");

for (const [status, entry] of Object.entries(VISIT_STATUS_LABELS)) {
  ok(
    Array.isArray(entry) && typeof entry[0] === "string" && entry[0].startsWith("app."),
    `"${status}" carries a translation key, not a bare English word`,
    entry,
  );
  ok(
    typeof entry?.[1] === "string" && entry[1].length > 0,
    `"${status}" keeps an English fallback for a language missing the key`,
    entry,
  );
}

// Resolved through a `t`, not returned as the fallback regardless — a label
// function that ignores its `t` is a translated map and an English screen.
const asked = [];
const fakeT = (key, fallback) => {
  asked.push(key);
  return `[${key}|${fallback}]`;
};
ok(
  visitStatusLabel("on_the_way", fakeT) === "[app.status.onTheWay|On the way]",
  "visitStatusLabel routes through t() rather than returning its own English",
  visitStatusLabel("on_the_way", fakeT),
);
ok(asked.length > 0, "t() was actually consulted", asked);

// A missing status really is scheduled — the column is
// `String @default("scheduled")`, so absence means the default.
ok(
  visitStatusLabel(null, fakeT) === "[app.status.scheduled|Scheduled]",
  "a missing status still reads as Scheduled, which is what the default means",
  visitStatusLabel(null, fakeT),
);
// An UNKNOWN one is a different fact and must not borrow another status's
// word. This used to answer "Scheduled" for anything it did not recognise,
// which made it disagree with lib/appointments/statusLabels.js about the very
// same visit.
ok(
  visitStatusLabel("abducted_by_aliens", fakeT) === "abducted by aliens",
  "an unrecognised status falls back to the tidied raw value, not to Scheduled",
  visitStatusLabel("abducted_by_aliens", fakeT),
);

// The one caller has to pass its `t`. Without this, every assertion above is
// true of a file nobody translates.
{
  const detailSrc = read("app/app/jobs/[id]/JobDetail.js");
  ok(
    /visitStatusLabel\(v\.status,\s*t\)/.test(detailSrc),
    "the job page passes its t into visitStatusLabel",
  );
  ok(
    !/visitStatusLabel\([^,)]*\)/.test(detailSrc),
    "no caller left calling visitStatusLabel without a t",
  );
}

// ══ 3. The promises on the buttons are still true ══════════════════════════

section("3. The side effects the labels promise still exist in the route");

ok(
  /status === "on_the_way"/.test(ROUTE) && /sendSms\(/.test(ROUTE),
  'the route still texts the client on the way into "on_the_way" — the button says it does',
);
ok(
  /status === "completed"/.test(ROUTE) && /ensureUpcomingVisit\(/.test(ROUTE),
  "completing a visit on a recurring job still spawns the next one",
);
ok(
  /maySms\(/.test(ROUTE),
  "the on-my-way send still checks the STOP opt-out before it goes",
);

// The one transition flagged `texts: true` must be the one the route texts on,
// and no other. A button that quietly gained an SMS, or lost one while keeping
// the label, is the same failure in reverse.
const texting = visitActions("scheduled").filter((a) => a.texts).map((a) => a.to);
ok(
  texting.length === 1 && texting[0] === "on_the_way",
  "exactly one offered transition is marked as texting the client, and it is on_the_way",
  texting,
);

// ══ 4. No transition produces an unstyled badge ════════════════════════════

section("4. Every reachable status is styled on the job page");

const DETAIL = read("app/app/jobs/[id]/JobDetail.js");

// ── Was: scrape `const STATUS_STYLES` out of JobDetail.js ─────────────────
//
// That map has been lifted into visitStatusClasses(), so the scrape found
// nothing, `indexOf` returned -1, and the parse produced []. It failed loudly
// here only by luck: the assertion asks whether a status IS styled, so an
// empty parse fails. Phrased the other way round — "no status is unstyled" —
// [] would have passed vacuously forever.
//
// So it drives the shipped function instead of reading a page's source. A
// styling rule that lives in a module is testable; one scraped out of JSX is
// only testable until somebody moves it.
ok(
  Object.keys(VISIT_STATUS_TONE).length >= 5,
  "the visit tone map is populated — an empty one would pass every check below vacuously",
  Object.keys(VISIT_STATUS_TONE),
);
for (const status of offered) {
  const cls = visitStatusClasses(status);
  ok(
    typeof cls === "string" && /bg-/.test(cls) && !/undefined|null/.test(cls),
    `"${status}" yields real chip classes`,
    cls,
  );
  // The grey fallback is `off`, which is what a CANCELLED visit gets. A live
  // status landing there is the bug this section has always been about: the
  // moment a visit could be put on the way, its badge looked cancelled.
  ok(
    status === "cancelled" || status === "canceled" || cls !== VISIT_TONE_CLASSES.off,
    `"${status}" has a badge style of its own, not the grey a cancelled visit gets`,
    cls,
  );
}
// The one the old comment singled out, pinned by name: purple, not amber,
// because `in_progress` is an amber JOB status and the two chips sit inches
// apart on this page.
ok(
  visitStatusClasses("on_the_way") === VISIT_TONE_CLASSES.moving,
  "on_the_way keeps its own colour rather than borrowing in_progress's amber",
);
// Every literal colour ramp carries its dark: half — a bare bg-*-50 is a
// bright slab in a dark cab.
for (const [tone, cls] of Object.entries(VISIT_TONE_CLASSES)) {
  for (const util of cls.match(/(?:^|\s)(?:bg|text|border)-[a-z]+-\d{2,3}(?:\/\d+)?/g) || []) {
    const [prefix] = util.trim().split("-");
    ok(
      new RegExp(`dark:${prefix}-`).test(cls),
      `visit tone "${tone}" pairs ${util.trim()} with a dark: ${prefix}`,
    );
  }
}
// NOT asserted here: that JobDetail.js keeps no private `const STATUS_STYLES`.
// It is the right assertion and it belongs with the change that removes that
// map — which is in flight and not committed yet. Asserting it early turns
// somebody else's unfinished refactor into a red build on main, and this check
// is not the place to hold a file hostage to work it does not own. Add it when
// the map goes.
ok(
  !/v\.status\?\.replace\(/.test(DETAIL),
  "the visit badge uses the shared label, not a raw underscore-strip",
);

// ══ 5. The UI's permission rule is the route's rule ════════════════════════

section("5. mayMoveVisit mirrors the route's three clauses");

ok(mayMoveVisit({ assignedToId: null, userId: "u1", hasEditAll: false }) === true, "unassigned: anyone may move it");
ok(mayMoveVisit({ assignedToId: "u1", userId: "u1", hasEditAll: false }) === true, "the assignee may move their own");
ok(mayMoveVisit({ assignedToId: "u2", userId: "u1", hasEditAll: false }) === false, "someone else's visit is refused");
ok(mayMoveVisit({ assignedToId: "u2", userId: "u1", hasEditAll: true }) === true, "schedule:edit_all overrides");
ok(mayMoveVisit({ assignedToId: "u2", userId: null, hasEditAll: false }) === false, "no session is not a match");

ok(
  /visit\.assignedToId === member\.userId/.test(ROUTE) &&
    /visit\.assignedToId !== null/.test(ROUTE) &&
    /hasLevel\(full, "schedule", "edit_all"\)/.test(ROUTE),
  "the route still asks those same three questions — if it stops, the UI above is now guessing",
);

// ══ 6. A visit isn't the only way off "unscheduled" ════════════════════════
//
// The job page used to offer exactly one door out of `unscheduled` —
// "Schedule a visit" — for work that has no site trip at all, only a start
// and end date. Job.startDate/endDate is the second door; this section checks
// the validator hostile input can't get past, and that the route and the
// banner actually wired it up rather than adding a column nobody reads.

section("6. Job.startDate/endDate — the second way off \"unscheduled\"");

ok(validateJobDates({ startDate: null, endDate: null }).ok === true, "no dates at all is valid — nothing to say yet");
ok(
  validateJobDates({ startDate: new Date("2026-03-01"), endDate: null }).ok === true,
  "a start with no end is valid — the work has begun and isn't finished yet",
);
{
  const r = validateJobDates({ startDate: null, endDate: new Date("2026-03-01") });
  ok(r.ok === false, "an end with no start is refused", r);
}
{
  const r = validateJobDates({
    startDate: new Date("2026-03-10"),
    endDate: new Date("2026-03-01"),
  });
  ok(r.ok === false, "an end before its own start is refused", r);
}
ok(
  validateJobDates({
    startDate: new Date("2026-03-01"),
    endDate: new Date("2026-03-01"),
  }).ok === true,
  "a same-day start and end is valid — a one-day job",
);
{
  // Exactly the 366-day ceiling (a real project spanning one calendar year,
  // leap day included) must still be accepted — only OVER it is refused.
  const start = new Date("2026-01-01");
  const end = new Date(start.getTime() + 366 * 86400000);
  ok(validateJobDates({ startDate: start, endDate: end }).ok === true, "366 days — the ceiling itself — is accepted");
  const tooFar = new Date(start.getTime() + 367 * 86400000);
  const r = validateJobDates({ startDate: start, endDate: tooFar });
  ok(r.ok === false, "367 days is refused as almost certainly a typo'd year", r);
}
{
  const r = validateJobDates({ startDate: new Date("2026-01-01"), endDate: "not-a-date" });
  ok(r.ok === false, "an unparseable end date is refused, not silently dropped", r);
}
ok(parseDateOrNull("") === null, "an empty string clears the field rather than throwing");
ok(parseDateOrNull(null) === null, "null clears the field");
ok(parseDateOrNull("banana") === null, "garbage input parses to null for the route to turn into a 400");
ok(
  parseDateOrNull("2026-03-01T00:00:00.000Z") instanceof Date,
  "a real ISO string still parses to a Date",
);

const JOB_ROUTE = read("app/api/jobs/[id]/route.js");
ok(
  /validateJobDates\(/.test(JOB_ROUTE),
  "PATCH /api/jobs/[id] actually calls the validator rather than trusting the body",
);
ok(
  /schedulingByDate/.test(JOB_ROUTE) && /status === "unscheduled"/.test(JOB_ROUTE),
  "setting a start date flips the job off \"unscheduled\", mirroring the visits route",
);
ok(
  /existing\.quoteId && !existing\.startDate && nextStart/.test(JOB_ROUTE),
  "giving the job dates also resolves the \"schedule this job\" task, same as a first visit does",
);

// The banner an invoice shows for its job ("204 Avro Cir has no visit
// booked") is exactly the "needs a visit" claim the owner reported as wrong
// for a job that only needs its own dates — see lib/invoices/lifecycle.js and
// scripts/check-invoice-banners.mjs for the fix to the claim itself. This
// checks the other half: the API route that feeds that banner has to
// actually SELECT startDate/endDate, or the fixed logic sees `undefined`
// forever and the false claim comes right back.
const LIFECYCLE_ROUTE = read("app/api/invoices/[id]/lifecycle/route.js");
ok(
  /const JOB_SELECT = \{[\s\S]*?startDate: true,[\s\S]*?endDate: true,[\s\S]*?\}/.test(LIFECYCLE_ROUTE),
  "the invoice lifecycle route's JOB_SELECT loads startDate/endDate, not just visits",
);

// isVisitOutsideJobRange: a nudge, never a rule — see lib/jobs/visitInRange.js.
// `new Date(null)` is a real, valid date (1970-01-01), not NaN, which is
// exactly the trap that made an early version of this flag EVERY visit on
// EVERY job that simply had no date range set yet — "after 1970" is not a
// warning anyone needs. These cases exist specifically to keep that from
// coming back.
ok(isVisitOutsideJobRange({ scheduledAt: "2026-03-05T14:00:00Z" }, { startDate: "2026-03-01", endDate: "2026-03-10" }) === false, "a visit inside the range is not flagged");
ok(isVisitOutsideJobRange({ scheduledAt: "2026-02-28T14:00:00Z" }, { startDate: "2026-03-01", endDate: "2026-03-10" }) === true, "a visit before the start is flagged");
ok(isVisitOutsideJobRange({ scheduledAt: "2026-03-11T00:30:00Z" }, { startDate: "2026-03-01", endDate: "2026-03-10" }) === true, "a visit after the end is flagged");
ok(isVisitOutsideJobRange({ scheduledAt: "2026-03-10T23:00:00Z" }, { startDate: "2026-03-01", endDate: "2026-03-10" }) === false, "late in the day on the end date still counts as on-range — day comparison, not timestamp");
ok(isVisitOutsideJobRange({ scheduledAt: "2026-06-01T00:00:00Z" }, { startDate: "2026-03-01", endDate: null }) === false, "an open-ended job (no end date yet) never flags a later visit as \"after\" a bound that doesn't exist");
ok(isVisitOutsideJobRange({ scheduledAt: "2026-03-05T00:00:00Z" }, { startDate: null, endDate: null }) === false, "a job with no dates at all flags nothing — null must not read as epoch 1970");
ok(isVisitOutsideJobRange({ scheduledAt: null }, { startDate: "2026-03-01", endDate: "2026-03-10" }) === false, "a visit missing its own scheduledAt is not flagged");
ok(isVisitOutsideJobRange({ scheduledAt: "garbage" }, { startDate: "2026-03-01", endDate: "2026-03-10" }) === false, "an unparseable visit date is not flagged");
ok(isVisitOutsideJobRange(null, { startDate: "2026-03-01" }) === false, "a null visit doesn't throw");
ok(isVisitOutsideJobRange({ scheduledAt: "2026-03-05" }, null) === false, "a null job doesn't throw");

const JOB_DETAIL = read("app/app/jobs/[id]/JobDetail.js");
ok(
  /isVisitOutsideJobRange/.test(JOB_DETAIL) &&
    /outsideRange|visitOutsideRange/i.test(JOB_DETAIL),
  "the job page actually surfaces the flag, not only computes it",
);
ok(
  /job\.status === "unscheduled"/.test(JOB_DETAIL),
  "the \"needs a date\" banner is still keyed off the same status a date OR a visit both resolve",
);
ok(
  /startDate/.test(JOB_DETAIL) && /endDate/.test(JOB_DETAIL),
  "the job page actually reads startDate/endDate rather than only visits — the banner would otherwise still point at just one door",
);
ok(
  /\/edit/.test(JOB_DETAIL.slice(JOB_DETAIL.indexOf("needs a date") - 400, JOB_DETAIL.indexOf("needs a date") + 800)) ||
    /jobs\/\$\{jobId\}\/edit/.test(JOB_DETAIL),
  "the banner (or the page around it) offers a path to the edit page where dates are set, not only \"schedule a visit\"",
);

console.log(
  fail
    ? `\n✗ visit status: ${fail} check${fail === 1 ? "" : "s"} failed\n`
    : "\n✓ visit status: a human can move a visit, and every move it offers is real\n",
);
process.exit(fail ? 1 : 0);
