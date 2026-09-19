// scripts/check-site-visit.mjs
//
// An on-site measure scheduled from a quote (lib/quotes/siteVisit.js),
// executed rather than read.
//
//   node --import ./scripts/alias-loader.mjs scripts/check-site-visit.mjs
//
// ── What is worth executing here ───────────────────────────────────────────
//
// The pure builders decide what the job's history SAYS about the estimator's
// visit, and which catalogue key the reader's language renders it through.
// Two of the ways that goes wrong are invisible to a reader of the source:
// a template that renders "with  (Q-2026-0007)" for an unassigned visit, and
// a carry that writes "completed" for a visit that was cancelled. Both are a
// function call away from being caught, so they are called.
//
// ── What is asserted about the wiring, not executed ───────────────────────
//
// The route reads `quoteId` and sends the confirmation, the calendar carries
// the quote back, the builder and the detail page both mount the panel, and
// every catalogue key the builders emit exists in English AND French — the
// two languages check:translations gates. These are greps over the files
// that have to keep saying so; a feature that "works" because nothing calls
// it is the failure AGENTS.md opens with.

import { readFileSync } from "node:fs";
import {
  SITE_VISIT_VERBS,
  siteVisitVerbForStatus,
  describeSiteVisitWhen,
  siteVisitEvent,
  siteVisitCarryEvents,
} from "@/lib/quotes/siteVisit";
import { serviceName } from "@/lib/schedule/clientNotice";
import {
  linkInstantVisits,
  orphanVisitWhere,
  bookedVisitWhere,
  INSTANT_VISIT_LINK_WINDOW_MS,
} from "@/lib/quotes/linkInstantVisits";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";
import { EMAIL_COPY } from "../lib/i18n/emailCopy.js";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);
const read = (p) => readFileSync(p, "utf8");

// ── 1. The verb a status change amounts to ─────────────────────────────────

section("1. siteVisitVerbForStatus");

ok(siteVisitVerbForStatus("scheduled", "completed") === "completed", "scheduled → completed is 'completed'");
ok(siteVisitVerbForStatus("needs_supervisor", "cancelled") === "cancelled", "needs_supervisor → cancelled is 'cancelled'");
ok(siteVisitVerbForStatus("cancelled", "scheduled") === null, "putting a cancelled visit back on writes nothing (not a second 'scheduled')");
ok(siteVisitVerbForStatus("completed", "completed") === null, "no change, no row");
ok(siteVisitVerbForStatus("scheduled", undefined) === null, "a PATCH without a status writes nothing");
ok(siteVisitVerbForStatus("scheduled", "needs_supervisor") === null, "an assignment-driven status flip is not history");

// ── 2. The date, in the company's zone ─────────────────────────────────────

section("2. describeSiteVisitWhen");

const at = new Date("2026-09-22T14:00:00Z");
const toronto = describeSiteVisitWhen(at, "America/Toronto");
ok(/10:00/.test(toronto) && /E[DS]T/.test(toronto), "14:00Z in America/Toronto reads 10:00 EDT", toronto);
const utc = describeSiteVisitWhen(at, null);
ok(/14:00/.test(utc) && /UTC/.test(utc), "no zone falls back to UTC and says so", utc);
const bogus = describeSiteVisitWhen(at, "Mars/Olympus");
ok(/14:00/.test(bogus) && /UTC/.test(bogus), "an unknown zone name falls back to UTC rather than throwing", bogus);
ok(describeSiteVisitWhen("not a date", "UTC") === "", "an invalid date is an empty string, not 'Invalid Date'");

// ── 3. One event, both shapes ──────────────────────────────────────────────

section("3. siteVisitEvent");

const named = siteVisitEvent("scheduled", {
  entityType: "job",
  entityId: "job_1",
  appointment: { id: "appt_1", scheduledAt: at, assignedToId: "u_1", assignedTo: { name: "Dana" } },
  quoteNumber: "Q-2026-0007",
  timeZone: "America/Toronto",
});
ok(named.action === "job.site_visit.scheduled", "action is <entity>.site_visit.<verb>", named.action);
ok(named.entityType === "job" && named.entityId === "job_1", "written against the entity it was asked for");
ok(/^On-site measure scheduled for .*10:00.* with Dana \(Q-2026-0007\)$/.test(named.summary), "English summary names the time, the estimator and the quote", named.summary);
ok(named.summaryKey === "app.activity.event.siteVisitScheduled", "a named estimator picks the 'with {who}' key", named.summaryKey);
ok(named.summaryParams.who === "Dana" && named.summaryParams.quote === "Q-2026-0007", "params carry the estimator and the quote number");
ok(named.metadata.appointmentId === "appt_1" && named.metadata.assignedToId === "u_1", "metadata points back at the appointment row");

const unassigned = siteVisitEvent("scheduled", {
  entityType: "quote",
  entityId: "q_1",
  appointment: { id: "appt_2", scheduledAt: at, assignedTo: null },
  quoteNumber: "Q-2026-0008",
});
ok(!/with\s+\(/.test(unassigned.summary), "an unassigned visit never renders 'with  (' — the dangling preposition", unassigned.summary);
ok(unassigned.summaryKey === "app.activity.event.siteVisitScheduledUnassigned", "an unassigned visit picks the key without {who}", unassigned.summaryKey);

const cancelledWithReason = siteVisitEvent("cancelled", {
  entityType: "job",
  entityId: "job_1",
  appointment: { id: "appt_3", scheduledAt: at, assignedTo: { name: "Dana" }, cancelReason: "Client away" },
  quoteNumber: "Q-2026-0009",
});
ok(/Client away$/.test(cancelledWithReason.summary), "a cancellation carries the office's reason", cancelledWithReason.summary);
ok(cancelledWithReason.summaryParams.reason.startsWith(" — "), "the reason param carries its own separator so the key can end in {reason}", cancelledWithReason.summaryParams.reason);

const cancelledNoReason = siteVisitEvent("cancelled", {
  entityType: "job",
  entityId: "job_1",
  appointment: { id: "appt_4", scheduledAt: at, assignedTo: { name: "Dana" } },
  quoteNumber: "Q-2026-0009",
});
ok(!/—\s*$/.test(cancelledNoReason.summary), "no reason, no dangling dash", cancelledNoReason.summary);
ok(cancelledNoReason.summaryParams.reason === "", "and the reason param is empty so the translated key renders nothing there");

const completedReason = siteVisitEvent("completed", {
  entityType: "job",
  entityId: "job_1",
  appointment: { id: "appt_5", scheduledAt: at, assignedTo: { name: "Dana" }, cancelReason: "stale reason from an earlier cancel" },
  quoteNumber: "Q-1",
});
ok(!/stale reason/.test(completedReason.summary), "a completion ignores a cancel reason left on the row from an earlier cancellation");

ok(siteVisitEvent("rescheduled", { entityType: "job", entityId: "j", appointment: { id: "a", scheduledAt: at } }) === null, "an unknown verb is null, not a row with 'undefined' in it");
ok(siteVisitEvent("scheduled", { entityType: "job", entityId: "j", appointment: null }) === null, "no appointment, no event");

// ── 4. The carry into a new job ────────────────────────────────────────────

section("4. siteVisitCarryEvents");

const later = new Date("2026-09-25T13:00:00Z");
const carried = siteVisitCarryEvents(
  [
    { id: "b", scheduledAt: later, status: "cancelled", cancelReason: "Rain", assignedTo: { name: "Lee" } },
    { id: "a", scheduledAt: at, status: "completed", assignedTo: { name: "Dana" } },
    { id: "c", scheduledAt: new Date("2026-09-28T13:00:00Z"), status: "scheduled", assignedTo: null },
    { id: "d", scheduledAt: new Date("2026-09-29T13:00:00Z"), status: "needs_supervisor", assignedTo: null },
    { id: "broken", scheduledAt: null, status: "scheduled" },
  ],
  { jobId: "job_9", quoteNumber: "Q-2026-0010", timeZone: "America/Toronto" },
);
const actions = carried.map((e) => `${e.metadata.appointmentId}:${e.action.split(".").pop()}`);
ok(
  JSON.stringify(actions) ===
    JSON.stringify(["a:scheduled", "a:completed", "b:scheduled", "b:cancelled", "c:scheduled", "d:scheduled"]),
  "oldest first; scheduled once per visit, then completed or cancelled where the row got there; a dateless row is dropped",
  actions,
);
ok(carried.every((e) => e.entityType === "job" && e.entityId === "job_9"), "every carried row is against the job");
ok(carried.every((e) => e.summaryParams.quote === "Q-2026-0010"), "every carried row names the quote it came from");
ok(siteVisitCarryEvents([], { jobId: "j", quoteNumber: "Q" }).length === 0, "a quote with no measures carries nothing");
ok(siteVisitCarryEvents(null, { jobId: "j", quoteNumber: "Q" }).length === 0, "a missing list carries nothing rather than throwing");

// ── 5. Every key the builders emit exists — in English and in French ───────

section("5. Catalogue keys");

const keys = new Set();
for (const verb of SITE_VISIT_VERBS) {
  for (const assignedTo of [{ name: "Dana" }, null]) {
    const e = siteVisitEvent(verb, { entityType: "job", entityId: "j", appointment: { id: "a", scheduledAt: at, assignedTo } });
    keys.add(e.summaryKey);
  }
}
ok(keys.size === 6, "six keys: three verbs × named/unassigned", [...keys]);
for (const k of keys) {
  ok(typeof APP_MESSAGES.en[k] === "string", `en has ${k}`);
  ok(typeof APP_MESSAGES.fr[k] === "string", `fr has ${k}`);
  // The English template must consume exactly the params the builder sends,
  // or a reader sees a literal "{who}" in the middle of their history.
  const placeholders = (APP_MESSAGES.en[k] || "").match(/\{(\w+)\}/g) || [];
  const allowed = k.includes("Unassigned") ? ["{when}", "{quote}", "{reason}"] : ["{when}", "{who}", "{quote}", "{reason}"];
  ok(placeholders.every((p) => allowed.includes(p)), `${k} uses only params the builder sends`, placeholders);
  if (!k.includes("Unassigned")) ok(placeholders.includes("{who}"), `${k} names the estimator`);
  if (k.includes("Cancelled")) ok(placeholders.includes("{reason}"), `${k} ends with the reason`);
}

for (const k of [
  "app.siteVisit.title",
  "app.siteVisit.schedule",
  "app.siteVisit.sentTo",
  "app.siteVisit.notSentNoEmail",
  "app.siteVisit.seeOnCalendar",
  "app.siteVisit.onJobHeading",
  "app.appts.openQuote",
]) {
  ok(typeof APP_MESSAGES.en[k] === "string" && typeof APP_MESSAGES.fr[k] === "string", `panel key ${k} exists in en and fr`);
}

// ── 6. The letter names the measure, in the client's language ──────────────

section("6. The confirmation letter's service name");

for (const lang of Object.keys(EMAIL_COPY)) {
  const word = serviceName({ language: lang, measure: true });
  ok(
    typeof word === "string" && word && word !== EMAIL_COPY[lang].visit.serviceFallback,
    `${lang}: a measure is named as one, not as the bare word for a visit`,
    word,
  );
}
ok(serviceName({ eventTypeName: "Estimate", language: "fr", measure: true }) === "Estimate", "an event type still wins over the measure word");
ok(serviceName({ language: "fr" }) === "visite", "and a bare appointment still gets the plain word");

// ── 7. The wiring that has to keep saying so ───────────────────────────────

section("7. Wiring");

const post = read("app/api/appointments/route.js");
// The column is written through the one generic spread that also writes
// jobId and invoiceId (lib/schedule/appointmentAbout.js pickAbout) — the
// quote is still proved company-owned first, by loadAboutRecord.
ok(/\[`\$\{about\.kind\}Id`\]: about\.id/.test(post) && /loadAboutRecord\(db, member\.companyId, about\)/.test(post), "POST /api/appointments writes Appointment.quoteId from the verified quote");
ok(/clientId = quote\.clientId/.test(post), "the client is the quote's client, read from the row, not from the browser");
ok(/sendBookingConfirmationEmail\(/.test(post), "the client gets the EXISTING booking confirmation letter");
// `document` is the quote when the appointment is about one (an invoice's
// own language, or a job's quote's, otherwise) — the same resolver.
ok(/aboutRecord\.quote \|\| null : aboutRecord;\s*const language = resolveClientLanguage\(\{ document, client, company \}\)/.test(post), "in the quote's language, by lib/i18n/clientLanguage.js");
ok(/recordSiteVisit\(member, "scheduled"/.test(post), "and the scheduling is history on the quote (and its job)");
ok(/memberOrRefusal\(request\)/.test(post), "behind memberOrRefusal, so an impersonating session is refused on POST");

const patch = read("app/api/appointments/[id]/route.js");
ok(/siteVisitVerbForStatus\(existing\.status, updated\.status\)/.test(patch), "PATCH turns a completion or cancellation into history");

const convert = read("lib/jobs/createJobFromQuote.js");
ok(/carrySiteVisitsIntoJob\(/.test(convert), "the conversion carries the quote's measures into the new job's history");

const quoteGet = read("app/api/quotes/[id]/route.js");
ok(/appointments: \{/.test(quoteGet), "GET /api/quotes/[id] returns the quote's measures");

const jobGet = read("app/api/jobs/[id]/route.js");
ok(/appointments: \{/.test(jobGet), "GET /api/jobs/[id] returns the quote's measures under job.quote");

const detail = read("app/app/quotes/[id]/page.js");
const builder = read("app/components/quotes/builder/QuoteBuilder.js");
const jobPage = read("app/app/jobs/[id]/JobDetail.js");
ok(/<SiteVisitPanel quoteId=\{id\} quote=\{quote\}/.test(detail), "the quote detail page mounts the panel");
ok(/isEdit && start\.quote && \(/.test(builder) && /<SiteVisitPanel/.test(builder), "the builder mounts the panel on an edit, never on a create");
ok(/<SiteVisitRows visits=\{job\.quote\.appointments\}/.test(jobPage), "the job page lists the measures above the crew's visits");

const panel = read("app/components/quotes/SiteVisitPanel.js");
ok(/fetchJson\("\/api\/appointments", \{\s*method: "POST"/.test(panel), "the panel posts through fetchJson (an error is a sentence, never a silent nothing)");
ok(/quoteId,/.test(panel) && !/clientId/.test(panel.split("fetchJson(\"/api/appointments\"")[1].split("})")[0]), "the body carries quoteId and no clientId — the server resolves the client");
ok(/appointments\?day=/.test(panel), "each row links to its day on the calendar");

const calendar = read("app/app/appointments/page.js");
// useSearchParams() is read once into `searchParams` now that ?view= is read
// off the same object; the landing day still comes from it.
ok(/landingDayFrom\(searchParams\)/.test(calendar) && /const searchParams = useSearchParams\(\)/.test(calendar) && /useState\(landingDay\)/.test(calendar), "the calendar opens on ?day=");
// Through aboutHref(aboutLabel(appt)), which resolves a quote-linked row to
// /app/quotes/<id> — the same door a job- or invoice-linked row now has.
ok(/aboutHref\(aboutLabel\(appt\)\)/.test(calendar) && /app\.appts\.openAbout/.test(calendar), "a measure on the calendar links back to its quote");
// The GET's query moved to lib/schedule/feed.js (shared with the day map).
const getRoute = read("lib/schedule/feed.js");
ok(/quote: \{ select: \{ id: true, quoteNumber: true \} \}/.test(getRoute), "GET /api/appointments carries the quote so that link has something to point at");
ok(/loadScheduleFeed\(db, member, full\)/.test(post.split("export async function POST")[0]), "…through the shared feed the route calls");

// ── 8. The visit the homeowner booked off an instant estimate ──────────────
//
// Q-2026-0003: the homeowner booked a measure straight after the instant
// estimate. The booking route verified the draft's id and wrote it onto the
// Booking row only; the Appointment beside it — the row this panel reads —
// carried no quoteId, so the calendar had the visit and the quote page said
// "No visit scheduled yet". Both creators must write it, and the repair for
// rows written before they did is executed here against a scripted db.

section("8. A homeowner's booking reaches the quote page");

const confirm = read("app/api/booking/[companySlug]/confirm/route.js");
const apptCreate = confirm.split("db.appointment.create(")[1]?.split("});")[0] || "";
ok(/\.\.\.\(linkedQuoteId && \{ quoteId: linkedQuoteId \}\)/.test(apptCreate), "the free booking path writes the verified quote id onto the APPOINTMENT, not only the Booking");
const settle = read("lib/booking/settleBookingFee.js");
const settleCreate = settle.split("prisma.appointment.create(")[1]?.split("});")[0] || "";
ok(/\.\.\.\(held\.quoteId && \{ quoteId: held\.quoteId \}\)/.test(settleCreate), "the paid booking path copies the held booking's quote id onto the appointment");
ok(/linkInstantVisits\(db, quote\)/.test(quoteGet) && /if \(quote\.autoEstimated\)/.test(quoteGet), "GET /api/quotes/[id] repairs an auto-estimated draft's unlinked visits on read");

{
  const calls = [];
  const fakeDb = {
    appointment: {
      updateMany: async ({ where, data }) => {
        calls.push({ where, data });
        return { count: calls.length === 1 ? 1 : 0 };
      },
    },
  };
  const created = new Date("2026-09-19T17:56:26.833Z");
  const draft = { id: "q_draft", companyId: "co_1", clientId: "cl_1", createdAt: created, autoEstimated: true };
  const linked = await linkInstantVisits(fakeDb, draft);
  ok(linked === 1, "returns how many rows it attached", linked);
  ok(calls.length === 2, "two rules, two writes: the verified booking and the same-client window", calls.length);
  ok(calls.every((c) => c.data.quoteId === "q_draft"), "every write sets THIS draft's id and nothing else", calls.map((c) => c.data));
  ok(calls.every((c) => c.where.quoteId === null && c.where.companyId === "co_1"), "and only into an EMPTY quoteId, inside the draft's own company", calls.map((c) => c.where));
  const booked = bookedVisitWhere(draft);
  ok(booked.booking?.is?.quoteId === "q_draft", "rule 1: the Booking beside the appointment names this quote", booked);
  const orphan = orphanVisitWhere(draft);
  ok(orphan.clientId === "cl_1" && orphan.jobId === null && orphan.invoiceId === null, "rule 2: the same client, and an appointment about nothing else yet", orphan);
  ok(
    orphan.createdAt.gte.getTime() === created.getTime() &&
      orphan.createdAt.lte.getTime() === created.getTime() + INSTANT_VISIT_LINK_WINDOW_MS &&
      INSTANT_VISIT_LINK_WINDOW_MS === 24 * 60 * 60 * 1000,
    "…created within the 24 hours AFTER the draft, never before it",
    orphan.createdAt,
  );

  calls.length = 0;
  const manual = await linkInstantVisits(fakeDb, { ...draft, autoEstimated: false });
  ok(manual === 0 && calls.length === 0, "a hand-built quote is never touched — the rule is for instant drafts only");
}

console.log(fail ? `\n${fail} FAILED\n` : "\nall passed\n");
process.exit(fail ? 1 : 0);
