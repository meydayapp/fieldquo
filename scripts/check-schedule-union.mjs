// scripts/check-schedule-union.mjs
//
// Scheduling a visit on a job advanced the job to "scheduled" and put nothing
// on the Calendar — visits live in JobVisit, /api/appointments read Appointment,
// and nothing joined them. A manager booked Tuesday's crew work, opened the one
// screen that answers "what is happening this week", and saw an empty week.
// Two dashboard tiles read 0 against jobs that plainly had visits.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-schedule-union.mjs

import {
  toCalendarEntry,
  appointmentToCalendarEntry,
  mergeSchedule,
  countUpcoming,
} from "@/lib/schedule/jobVisits";
import { readFileSync } from "node:fs";

let fail = 0;
const t = (name, got, want = true) => {
  const ok = String(got) === String(want);
  if (!ok) fail++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${ok ? "" : `  got=${got} want=${want}`}`);
};
const read = (r) => readFileSync(new URL(r, import.meta.url), "utf8");

const visit = {
  id: "v1", jobId: "j1", scheduledAt: new Date("2026-08-25T13:00:00Z"),
  status: "scheduled", assignedToId: "u1",
  assignedTo: { id: "u1", name: "Daniel" },
  job: { id: "j1", title: "Repaint", client: { id: "c1", name: "Acme", address: "1 Queen St" } },
};
const appt = {
  id: "a1", scheduledAt: new Date("2026-08-24T13:00:00Z"), status: "scheduled",
  assignedToId: "u2", client: { id: "c2", name: "Bee" }, location: "2 King St",
};

console.log("\nA visit becomes a calendar entry");
const v = toCalendarEntry(visit);
t("it is marked as a visit, not an appointment", v.kind, "visit");
t("it carries its job so the row can link to it", v.jobId, "j1");
t("it takes its address from the client", v.location, "1 Queen St");
t("assignedToId is present — the person filter reads THAT, not assignedTo.id",
  v.assignedToId, "u1");
// These are read off appointments by the calendar. A visit has none of them,
// and must say so rather than leave keys undefined.
t("booking is explicitly null", v.booking, null);
t("requiresSupervisor is explicitly false", v.requiresSupervisor, false);
t("coordinates are explicitly null", v.latitude === null && v.longitude === null);

console.log("\nA client with no address does not get an invented one");
const noAddr = toCalendarEntry({ ...visit, job: { ...visit.job, client: { id: "c1", name: "Acme" } } });
t("location is null, not an empty string", noAddr.location, null);

console.log("\nBoth sources merge, soonest first");
const merged = mergeSchedule([appt], [visit]);
t("two entries", merged.length, 2);
t("the earlier one leads", merged[0].id, "a1");
t("the appointment kept its kind", merged[0].kind, "appointment");
t("the visit is in the list at all — the whole bug", merged.some((e) => e.kind === "visit"));

console.log("\nHostile input");
t("nulls in, no throw", mergeSchedule(null, null).length, 0);
t("junk rows dropped", mergeSchedule([null, {}], [null, {}, visit]).length, 1);
t("an undated entry is dropped, not sorted to an arbitrary end",
  mergeSchedule([], [{ id: "x", job: visit.job }]).length, 0);
t("an undated entry is not counted",
  countUpcoming([{ id: "x", status: "scheduled" }], new Date("2026-01-01")), 0);
t("an unparseable date is not counted",
  countUpcoming([{ id: "x", scheduledAt: "not a date" }], new Date("2026-01-01")), 0);

console.log("\nWhat 'upcoming' counts");
t("both are ahead of August 1st", countUpcoming(merged, new Date("2026-08-01")), 2);
t("neither is ahead of September", countUpcoming(merged, new Date("2026-09-01")), 0);
t("a cancelled visit is not upcoming",
  countUpcoming(mergeSchedule([], [{ ...visit, status: "cancelled" }]), new Date("2026-08-01")), 0);
t("...but it is still ON the calendar",
  mergeSchedule([], [{ ...visit, status: "cancelled" }]).length, 1);
t("American and British spellings both excluded",
  countUpcoming(mergeSchedule([], [{ ...visit, status: "canceled" }]), new Date("2026-08-01")), 0);

console.log("\nThe wiring is actually in place");
const api = read("../app/api/appointments/route.js");
t("the calendar API reads JobVisit", /db\.jobVisit\.findMany/.test(api));
// Matches the company scope wherever it sits in the job filter — the filter
// has since gained `archivedAt: null` too, and an exact-string assertion
// failed on a change that kept the scoping perfectly intact.
t("...scoped to the company", /job: \{[^}]*companyId: member\.companyId/.test(api));
// Was /seesEveryone/, matching an inline ternary that each of the queries
// carried its own copy of. That rule now comes from ownScheduleFilter() in
// lib/schedule/teamScope.js, so the assertion moved with it — and got
// stronger: the point was never that a particular variable existed, it was
// that every source on this calendar splits own-vs-everyone the SAME way.
// Counting the call sites says that; grepping for a name did not.
t("...and honours the same own-vs-everyone split", /ownScheduleFilter/.test(api));
t("...via one shared rule, applied to every source on the calendar",
  (api.match(/ownFilter\(/g) || []).length, 3);

const cal = read("../app/app/appointments/page.js");
// Bookings joined visits as a kind whose id is not an Appointment id, so
// PATCHing either against /api/appointments/[id] would 404.
t("a visit is not offered the appointment assign control",
  /appt\.kind === "visit" \|\| appt\.kind === "booking" \? \(/.test(cal));
t("...and neither is a client booking",
  /appt\.kind === "booking" \|\| appt\.kind === "visit" \? \(/.test(cal) ||
    /appt\.kind === "visit" \|\| appt\.kind === "booking" \? \(/.test(cal));
t("a visit links to its job instead", /app\/jobs\/\$\{appt\.jobId\}/.test(cal));

const dash = read("../app/app/page.js");
t("the dashboard counts the full list, not the 5-row preview",
  /countUpcoming\(all\)/.test(dash));
t("...and the tile renders that count", /\{upcomingCount\}/.test(dash));

console.log("\nThe stale 'schedule the job' task gets closed");
const visits = read("../app/api/jobs/[id]/visits/route.js");
t("scheduling a visit resolves the task", /resolveTaskBySource/.test(visits));
t("...keyed off the quote it was created from", /quote_accepted:\$\{job\.quoteId\}/.test(visits));
const tasks = read("../lib/tasks/autoCreate.js");
t("only OPEN tasks are touched — a cancelled one stays cancelled",
  /status: "open"/.test(tasks));
t("closed as done, not deleted", /data: \{ status: "done" \}/.test(tasks));

console.log(fail ? `\n${fail} FAILED\n` : "\nALL PASS — scheduled work appears where people look for it\n");
process.exit(fail ? 1 : 0);
