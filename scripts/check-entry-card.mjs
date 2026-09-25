// scripts/check-entry-card.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-entry-card.mjs
//
// The calendar's Cards view (app/components/schedule/EntryCardsWeek.js) draws
// each entry through lib/schedule/entryCard.js. Executed here:
//
//   1. shortAddress against junk — never invents, never blows a card open.
//   2. entryCard for each of the three kinds the feed merges: the right
//      client/service/time/address, and quick links offered ONLY on the dial
//      that guards the page each opens (a missing access key is a NO).
//   3. mayActOnEntry is the list's old inline rule, clause for clause —
//      compared against a transcription of that expression over a matrix of
//      roles, assignees and grids, so the refactor provably changed nothing.
//   4. weekDays across a DST change and a garbage weekStartsOn.
//   5. toCalendarEntry now carries the visit's job quoteId, and nothing
//      money-shaped rides on a card.

import { shortAddress, entryAddress, entryCard, mayActOnEntry, weekDays } from "@/lib/schedule/entryCard";
import { toCalendarEntry, VISIT_INCLUDE } from "@/lib/schedule/jobVisits";
import { mayMoveVisit } from "@/lib/jobs/visitStatus";
import { hasLevel } from "@/lib/permissions/enforce";

let checks = 0;
let failures = 0;
function ok(name, pass, detail) {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${!pass && detail !== undefined ? `  — ${JSON.stringify(detail)}` : ""}`);
}
const section = (s) => console.log(`\n${s}\n`);

// ═══════════════════════════════════════════════════════════════════════════
section("1. shortAddress");
// ═══════════════════════════════════════════════════════════════════════════

ok("street line of a full address", shortAddress("12 Oak St, Ottawa, ON K1A 0B1") === "12 Oak St");
ok("a unit first keeps the street with it", shortAddress("Unit 4, 12 Oak St, Ottawa") === "Unit 4, 12 Oak St");
ok("'#2' first keeps the street", shortAddress("#2, 99 Bank St") === "#2, 99 Bank St");
ok("null / undefined / number → null", shortAddress(null) === null && shortAddress(undefined) === null && shortAddress(42) === null);
ok("whitespace → null", shortAddress("   ") === null);
ok("commas only → null", shortAddress(" , ,, ") === null);
ok("a pasted paragraph is bounded with an ellipsis", (() => {
  const s = shortAddress("x".repeat(300));
  return s.length === 40 && s.endsWith("…");
})());
ok("no commas at all → the whole (short) string", shortAddress("Farm road 7") === "Farm road 7");

// ═══════════════════════════════════════════════════════════════════════════
section("2. entryCard — the three kinds, and links gated per dial");
// ═══════════════════════════════════════════════════════════════════════════

const ALL = { quotes: true, jobs: true, invoices: true, clients: true };

const appt = {
  kind: "appointment",
  id: "a1",
  scheduledAt: "2026-09-29T13:00:00.000Z",
  status: "scheduled",
  location: "12 Oak St, Ottawa, ON",
  client: { id: "c1", name: "Ana Silva", phone: "613-555-0100", address: "1 Home Rd" },
  assignedTo: { id: "u1", name: "Sam Estimator" },
  assignedToId: "u1",
  quote: { id: "q1", quoteNumber: "Q-0031" },
  job: null,
  invoice: { id: "i1", invoiceNumber: "INV-9" },
  booking: { endTime: "2026-09-29T14:30:00.000Z", mode: "visit" },
  notes: "Gate code 4417",
};
let c = entryCard(appt, ALL);
ok("appointment: client, status, start and end", c.clientName === "Ana Silva" && c.status === "scheduled" &&
  c.start.toISOString() === appt.scheduledAt && c.end.toISOString() === appt.booking.endTime, c);
ok("appointment: location beats the client's own address", c.address === "12 Oak St, Ottawa, ON" && c.addressShort === "12 Oak St");
ok("appointment: 'what for' comes from its about-link (the invoice wins, as aboutLabel ranks)", c.about?.kind === "invoice" && c.service === null, c.about);
ok("appointment: quote, invoice and client links with everything allowed",
  c.links.quote?.id === "q1" && c.links.quote.ref === "Q-0031" && c.links.invoice?.id === "i1" && c.links.client?.id === "c1" && c.links.job === null, c.links);
ok("key is kind-scoped (an Appointment id and a JobVisit id may collide)", c.key === "appointment-a1");

c = entryCard(appt, { quotes: true });
ok("only quotes allowed → only the quote link", c.links.quote && !c.links.invoice && !c.links.client && !c.links.job, c.links);
c = entryCard(appt, {});
ok("an access object missing every key offers NO links (fewer, never more)", Object.values(c.links).every((v) => v === null), c.links);
c = entryCard(appt);
ok("no access argument at all → no links", Object.values(c.links).every((v) => v === null));
c = entryCard(appt, { quotes: "yes", invoices: 1 });
ok("truthy junk in access is still read as allowed only by truthiness — documented, no crash", c !== null);

const phoneAppt = { ...appt, id: "a2", booking: { endTime: appt.booking.endTime, mode: "call" } };
c = entryCard(phoneAppt, ALL);
ok("a phone booking has no address to drive to (not the billing address)", c.address === null && c.addressShort === null && c.mode === "call", c);
ok("…entryAddress agrees", entryAddress(phoneAppt) === null);

const visit = toCalendarEntry({
  id: "v1",
  jobId: "j1",
  scheduledAt: "2026-09-30T12:00:00.000Z",
  status: "scheduled",
  notes: null,
  assignedTo: { id: "u9", name: "Crew Carl" },
  assignedToId: "u9",
  job: { id: "j1", title: "Kitchen repaint", quoteId: "q7", client: { id: "c2", name: "Bo Lee", address: "5 Elm Ave, Gatineau" } },
});
ok("toCalendarEntry now carries the job's quoteId", visit.quoteId === "q7", visit);
ok("VISIT_INCLUDE selects job.quoteId (write it AND read it)", VISIT_INCLUDE.job.select.quoteId === true);
c = entryCard(visit, ALL);
ok("visit: service is the job title, job + quote + client links", c.service === "Kitchen repaint" && c.links.job?.id === "j1" && c.links.quote?.id === "q7" && c.links.client?.id === "c2", c);
ok("visit: address from the job's client", c.addressShort === "5 Elm Ave");
ok("visit: no end time is invented", c.end === null);
c = entryCard(visit, { jobs: true });
ok("visit for a member with jobs only → job link only", c.links.job && !c.links.quote && !c.links.client, c.links);

const bookingEntry = {
  kind: "booking",
  id: "b1",
  scheduledAt: "2026-10-01T15:00:00.000Z",
  status: "confirmed",
  notes: "visit",
  title: "Free estimate",
  client: { id: null, name: "Stranger Dan", phone: "555-0100", synthetic: true },
  location: null,
  booking: { endTime: "2026-10-01T15:00:00.000Z", mode: "video" },
};
c = entryCard(bookingEntry, ALL);
ok("booking: synthetic client → no client link", c.links.client === null);
ok("booking: service is the event type", c.service === "Free estimate");
ok("booking: notes ('visit' = the mode word) are not shown as notes", c.notes === null);
ok("booking: an end equal to the start is not an end", c.end === null);

ok("restricted client (feed removed phone) → no phone, flagged restricted",
  (() => {
    const r = entryCard({ ...appt, client: { id: "c1", name: "Ana", restricted: true } }, ALL);
    return r.phone === null && r.clientRestricted === true;
  })());
ok("garbage entries → null", entryCard(null) === null && entryCard("x") === null && entryCard({}) === null);
ok("unparseable date → start null (the week view skips it rather than crash)", entryCard({ ...appt, scheduledAt: "not a date" }, ALL).start === null);
ok("an unknown kind is treated as an appointment, not trusted", entryCard({ ...appt, kind: "<script>" }, ALL).kind === "appointment");

// No money on a card.
const withMoney = { ...appt, quote: { id: "q1", quoteNumber: "Q-1", total: 9999 }, invoice: { id: "i1", invoiceNumber: "I", amountDue: 8888 } };
ok("nothing money-shaped rides on a card", !/9999|8888/.test(JSON.stringify(entryCard(withMoney, ALL))));

// ═══════════════════════════════════════════════════════════════════════════
section("3. mayActOnEntry === the list's old inline rule");
// ═══════════════════════════════════════════════════════════════════════════

// Transcribed from app/app/appointments/page.js before the refactor.
function oldRule(e, caller, myUserId) {
  if (e.kind === "visit") {
    return mayMoveVisit({ assignedToId: e.assignedToId ?? null, userId: myUserId, hasEditAll: hasLevel(caller, "schedule", "edit_all") });
  }
  if (e.kind === "booking") return false;
  return Boolean(!caller?.role || (myUserId && e.assignedToId === myUserId) || hasLevel(caller, "schedule", "edit_all"));
}
const callers = [
  null,
  { role: null },
  { role: "owner", permissions: null },
  { role: "employee", permissions: null },
  { role: "employee", permissions: { schedule: "view_own" } },
  { role: "employee", permissions: { schedule: "edit_all" } },
  { role: "supervisor", permissions: { schedule: "view_all" } },
];
const kinds = ["appointment", "visit", "booking"];
const assignees = [null, undefined, "u1", "u2"];
const me = [null, "u1"];
let mismatches = 0;
let cases = 0;
for (const caller of callers)
  for (const kind of kinds)
    for (const assignedToId of assignees)
      for (const myUserId of me) {
        cases++;
        const e = { kind, id: "x", assignedToId };
        if (oldRule(e, caller, myUserId) !== mayActOnEntry(e, { caller, myUserId })) mismatches++;
      }
ok(`mayActOnEntry matches the old rule on all ${cases} combinations`, mismatches === 0, { mismatches });
ok("mayActOnEntry(null) → false", mayActOnEntry(null) === false);

// ═══════════════════════════════════════════════════════════════════════════
section("4. weekDays");
// ═══════════════════════════════════════════════════════════════════════════

const ymd = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
let w = weekDays(new Date(2026, 9, 28), 1); // Wed 28 Oct 2026, Monday start
ok("Monday-start week of a Wednesday starts on that Monday", ymd(w[0]) === "2026-10-26" && ymd(w[6]) === "2026-11-1", w.map(ymd));
w = weekDays(new Date(2026, 10, 3), 0); // week across the Nov 1 US DST change
ok("seven distinct consecutive days across a DST change", new Set(w.map(ymd)).size === 7 && ymd(w[0]) === "2026-11-1", w.map(ymd));
ok("garbage weekStartsOn falls back to Sunday", weekDays(new Date(2026, 9, 28), "monday")[0].getDay() === 0 && weekDays(new Date(2026, 9, 28), 9)[0].getDay() === 0);
ok("an invalid anchor falls back to today, not Invalid Date", !Number.isNaN(weekDays(new Date("nope"), 0)[0].getTime()));

console.log(`\n${checks} checks, ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
