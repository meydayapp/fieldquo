// scripts/check-appointment-about.mjs
//
// What a hand-booked appointment is about (lib/schedule/appointmentAbout.js),
// executed rather than read, and the wiring around it asserted.
//
//   node --import ./scripts/alias-loader.mjs scripts/check-appointment-about.mjs
//
// ── What is worth executing ────────────────────────────────────────────────
//
// The stage suggestion and the mismatch verdict are the two judgements the
// dialog makes on the office's behalf. The ways they go wrong are quiet: a
// paid invoice suggested because the caller forgot to filter; a mismatch
// raised between a client and an unknown; a body carrying `quoteId: { in: }`
// reaching a Prisma where. Each is a call away from being caught.
//
// ── What is asserted, not executed ─────────────────────────────────────────
//
// Both write routes prove a linked id belongs to the caller's company
// through loadAboutRecord (companyId on the where) and answer 404 on a
// miss; the calendar, the job page and the invoice page read the link; the
// letters name the record through `about`; every catalogue key the dialog
// and the card use exists in all nine app languages; and the script is in
// check:all. Greps over the files that have to keep saying so.

import { readFileSync } from "node:fs";
import {
  ABOUT_KINDS,
  OPEN_QUOTE_STATUSES,
  OPEN_JOB_STATUSES,
  UNPAID_INVOICE_STATUSES,
  pickAbout,
  suggestAbout,
  openOnly,
  clientMismatch,
  aboutLabel,
  aboutHref,
  prefillLocation,
} from "@/lib/schedule/appointmentAbout";
import { isMeasure } from "@/lib/schedule/clientNotice";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";
import { EMAIL_COPY } from "../lib/i18n/emailCopy.js";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);
const read = (p) => readFileSync(p, "utf8");

// ── 1. pickAbout: one id, string only ──────────────────────────────────────

section("1. pickAbout");

ok(pickAbout({}).about === null, "nothing given → no link");
ok(pickAbout(null).about === null, "null body → no link, no throw");
ok(pickAbout({ quoteId: null, jobId: "", invoiceId: undefined }).about === null, "null / '' / undefined are 'not given'");
ok(pickAbout({ jobId: "j1" }).about?.kind === "job", "jobId → job");
ok(pickAbout({ invoiceId: "i1" }).about?.id === "i1", "invoiceId → its id");
ok(!!pickAbout({ quoteId: "q1", jobId: "j1" }).error, "two ids → refused, not first-wins");
ok(!!pickAbout({ quoteId: { in: ["q1"] } }).error, "a Prisma-shaped object is refused, never a where");
ok(!!pickAbout({ jobId: 12 }).error, "a number is refused");
ok(!!pickAbout({ invoiceId: ["i1"] }).error, "an array is refused");
ok(pickAbout({ __proto__: { quoteId: "q1" } }).about === null, "an inherited key is not a given key");

// ── 2. suggestAbout: the stage picks ───────────────────────────────────────

section("2. suggestAbout / openOnly");

const q = (id, status, updatedAt = "2026-09-01") => ({ id, status, updatedAt });
ok(suggestAbout({ quotes: [q("q1", "sent")] })?.kind === "quote", "only an unaccepted quote → the quote");
ok(suggestAbout({ quotes: [q("q1", "sent")], jobs: [q("j1", "in_progress")] })?.kind === "job", "an open job outranks the quote");
ok(
  suggestAbout({ jobs: [q("j1", "in_progress")], invoices: [q("i1", "overdue")] })?.kind === "invoice",
  "an unpaid invoice outranks the job",
);
ok(suggestAbout({ quotes: [q("q1", "accepted")], jobs: [q("j1", "completed")], invoices: [q("i1", "paid")] }) === null, "everything closed → nothing suggested");
ok(suggestAbout({}) === null, "no lists → null");
ok(suggestAbout(null) === null, "null → null, no throw");
ok(suggestAbout({ invoices: [q("i1", "paid")] }) === null, "a paid invoice is never suggested even if handed over");
ok(
  suggestAbout({ jobs: [q("old", "scheduled", "2026-01-01"), q("new", "scheduled", "2026-09-01")] })?.id === "new",
  "within a kind, the most recently updated",
);
ok(openOnly("not a list", "job").length === 0, "openOnly: a non-array is nothing");
ok(openOnly([null, 1, { status: "sent" }, { id: "", status: "sent" }], "quote").length === 0, "openOnly: rows without a string id are dropped");
ok(openOnly([q("x", "sent")], "receipt").length === 0, "openOnly: an unknown kind is nothing");
ok(openOnly([q("x", "sent", "garbage")], "quote").length === 1, "openOnly: an unparseable date sorts, does not throw");
ok(OPEN_QUOTE_STATUSES.every((s) => ["draft", "sent"].includes(s)), "open quote statuses are before acceptance");
ok(!OPEN_JOB_STATUSES.includes("completed") && !OPEN_JOB_STATUSES.includes("cancelled"), "a done or cancelled job is not open");
ok(!UNPAID_INVOICE_STATUSES.includes("paid") && !UNPAID_INVOICE_STATUSES.includes("draft"), "paid and draft invoices are not 'unpaid'");
ok(ABOUT_KINDS.join() === "quote,job,invoice", "the three kinds, in pipeline order");

// ── 3. clientMismatch: a warning between two known people only ─────────────

section("3. clientMismatch");

const mary = { id: "c-mary", name: "Mary Smith" };
const john = { id: "c-john", name: "John Smith" };
const v = clientMismatch({ record: { clientId: "c-mary", client: mary }, appointmentClient: john });
ok(v.mismatch === true && v.recordClientName === "Mary Smith" && v.appointmentClientName === "John Smith", "different clients → both names for the sentence", v);
ok(clientMismatch({ record: { clientId: "c-john" }, appointmentClient: john }).mismatch === false, "same client → no warning");
ok(clientMismatch({ record: { client: mary }, appointmentClient: mary }).mismatch === false, "client id read off record.client when clientId is absent");
ok(clientMismatch({ record: null, appointmentClient: john }).mismatch === false, "no record → no warning");
ok(clientMismatch({ record: { clientId: "c-mary" }, appointmentClient: { name: "New caller" } }).mismatch === false, "a new client with no id yet is unknown, not a disagreement");
ok(clientMismatch({}).mismatch === false, "nothing → no warning, no throw");
ok(clientMismatch({ record: { clientId: 42 }, appointmentClient: { id: 42 } }).mismatch === false, "non-string ids are unknown, not compared");
ok(clientMismatch({ record: { clientId: "c-mary", client: { name: "" } }, appointmentClient: john }).recordClientName === null, "a blank record name is null, not ''");

// ── 4. aboutLabel / aboutHref / prefillLocation ────────────────────────────

section("4. aboutLabel, aboutHref, prefillLocation");

ok(aboutLabel({ quote: { id: "q1", quoteNumber: "Q-1042" } })?.ref === "Q-1042", "a quote's number is the ref");
ok(aboutLabel({ job: { id: "j1", title: "Kitchen repaint" } })?.title === "Kitchen repaint", "a job's title is the title");
ok(aboutLabel({ invoice: { id: "i1", invoiceNumber: "INV-88" } })?.kind === "invoice", "an invoice");
ok(aboutLabel({ quote: { id: "q1" }, job: { id: "j1", title: "x" }, invoice: { id: "i1" } })?.kind === "invoice", "with several set, the furthest along wins — the label agrees with the suggestion");
ok(aboutLabel({ quote: null, job: null, invoice: null }) === null, "nothing linked → null");
ok(aboutLabel(null) === null && aboutLabel("x") === null, "garbage → null");
ok(aboutHref({ kind: "job", id: "j 1" }) === "/app/jobs/j%201", "href is encoded");
ok(aboutHref({ kind: "receipt", id: "r1" }) === null, "an unknown kind links nowhere");
ok(aboutHref(null) === null, "no label → no href");
ok(prefillLocation({ typed: " 12 Maple St ", record: { siteAddress: "9 Oak" } }) === "12 Maple St", "typed wins, trimmed");
ok(prefillLocation({ typed: "", record: { siteAddress: "9 Oak" }, client: { address: "1 Elm" } }) === "9 Oak", "the job's site before the client's home");
ok(prefillLocation({ record: { job: { siteAddress: "9 Oak" } }, client: { address: "1 Elm" } }) === "9 Oak", "an invoice's job's site");
ok(prefillLocation({ record: { clientId: "x", client: { address: "2 Birch" } }, client: null }) === "2 Birch", "the record's client's address when the caller has none");
ok(prefillLocation({ record: { clientId: "x" }, client: { address: "1 Elm" } }) === "1 Elm", "a quote has no address; the client's");
ok(prefillLocation({}) === null, "nothing → null, not ''");
ok(isMeasure({ id: "q1" }, null) === true, "about a quote → a measure");
ok(isMeasure({ id: "q1" }, { kind: "quote" }) === true, "a quote label is still a measure");
ok(isMeasure(null, { kind: "job" }) === false && isMeasure(null, { kind: "invoice" }) === false, "about a job or invoice → a plain visit");

// ── 5. Wiring ──────────────────────────────────────────────────────────────

section("5. Wiring");

const schema = read("prisma/schema.prisma");
const appt = schema.slice(schema.indexOf("model Appointment {"));
const apptBody = appt.slice(0, appt.indexOf("\n}"));
ok(/jobId\s+String\?/.test(apptBody) && /invoiceId\s+String\?/.test(apptBody), "Appointment.jobId and .invoiceId are nullable columns");
ok(/@@index\(\[jobId\]\)/.test(apptBody) && /@@index\(\[invoiceId\]\)/.test(apptBody), "both indexed");

const post = read("app/api/appointments/route.js");
const patch = read("app/api/appointments/[id]/route.js");
const loader = read("lib/schedule/aboutRecord.js");
ok(/where = \{ id: about\.id, companyId \}/.test(loader), "loadAboutRecord scopes every lookup to the caller's company");
ok(post.includes("pickAbout(body)") && post.includes("loadAboutRecord(db, member.companyId"), "POST proves the linked id through loadAboutRecord");
ok(/isn't on this account\.` \},\s*\{ status: 404 \}/.test(post), "POST answers 404 for another tenant's id");
ok(patch.includes("pickAbout(body)") && patch.includes("loadAboutRecord(db, member.companyId"), "PATCH proves a relink the same way");
ok(/isn't on this account\.` \},\s*\{ status: 404 \}/.test(patch), "PATCH answers 404 for another tenant's id");
ok(post.includes("[`${about.kind}Id`]: about.id"), "POST writes the one column the kind names");
ok(patch.includes("jobId: picked.about?.kind === \"job\"") && patch.includes("invoiceId: picked.about?.kind === \"invoice\""), "PATCH clears the other two on a relink");
ok(post.includes("prefillLocation({ typed: location, record: aboutRecord, client })"), "POST prefills the location from the record");
ok(post.includes("about: label,") && post.includes("sendBookingConfirmationEmail"), "the confirmation names the record");
ok(patch.includes("about: aboutLabel(updated)"), "moved and cancelled letters name the record");
for (const file of ["app/api/appointments/route.js", "app/api/appointments/[id]/route.js"]) {
  const src = read(file);
  ok(src.includes("job: { select: { id: true, title: true } }") && src.includes("invoice: { select: { id: true, invoiceNumber: true } }"), `${file} carries the job and invoice back`);
}
const lookup = read("app/api/appointments/about/route.js");
ok(lookup.includes('requirePermission(member.role, "appointment:create")'), "the lookup route needs the create permission");
ok(lookup.includes("assignedJobWhere(full)"), "the lookup route keeps the caller's assigned-jobs scope");

const page = read("app/app/appointments/page.js");
ok(page.includes("aboutText(aboutLabel(appt), t)"), "the calendar card says what the row is about");
ok(page.includes("aboutHref(aboutLabel(appt))"), "the details panel links to the record");
ok(page.includes("clientMismatch({ record: about.record, appointmentClient: client })"), "the dialog computes the mismatch");
ok(page.includes('t("app.appts.mismatchKeep"') && page.includes("setMismatchKept(true)"), "the mismatch is a one-click 'keep both', not a block");
ok(page.includes('fetchJson(`/api/clients?q=') && page.includes("isNew: true"), "the client picker types ahead and offers 'new client' last");
ok(page.includes("/api/appointments/about?clientId=") && page.includes("/api/appointments/about?q="), "the about picker asks by client and by search");
ok(page.includes("members.filter((m) => m.userId === myUserId)"), "the create form's assign select offers only the caller without appointment:assign");

const clients = read("app/api/clients/route.js");
ok(clients.includes('{ address: { contains: q, mode: "insensitive" } }'), "the client search covers the address");

ok(read("app/api/jobs/[id]/route.js").includes("appointments: {") && read("app/app/jobs/[id]/JobDetail.js").includes("visits={job.appointments}"), "the job page lists its appointments");
ok(read("app/api/invoices/[id]/route.js").includes("appointments: {") && read("app/app/invoices/[id]/page.js").includes("visits={invoice.appointments}"), "the invoice page lists its appointments");

const templates = read("app/admin/lib/email/templates.js");
ok((templates.match(/\.\.\.aboutLine\(\{ about, quoteNumber \}, copy\)/g) || []).length === 3, "all three letters go through aboutLine");
for (const lang of Object.keys(EMAIL_COPY)) {
  const visit = EMAIL_COPY[lang].visit;
  ok(typeof visit.aboutJob === "function" && typeof visit.aboutInvoice === "function", `email copy ${lang}: aboutJob and aboutInvoice`);
}

const KEYS = [
  "app.appts.aboutThisRecord", "app.appts.client", "app.appts.clientSearch", "app.appts.clientChange",
  "app.appts.newClient", "app.appts.newClientTag", "app.appts.searching", "app.appts.aboutOptional",
  "app.appts.aboutSuggested", "app.appts.aboutNone", "app.appts.aboutSearch", "app.appts.aboutNoMatch",
  "app.appts.aboutClear", "app.appts.aboutQuote", "app.appts.aboutJob", "app.appts.aboutInvoice",
  "app.appts.openAbout", "app.appts.kind.quote", "app.appts.kind.job", "app.appts.kind.invoice",
  "app.appts.anotherClient", "app.appts.mismatch", "app.appts.mismatchKeep", "app.appts.mismatchChange",
];
for (const lang of Object.keys(APP_MESSAGES)) {
  const missing = KEYS.filter((k) => !APP_MESSAGES[lang][k]);
  ok(missing.length === 0, `app strings in ${lang}`, missing);
}
ok(/\{kind\}.*\{recordClient\}.*\{caller\}/.test(APP_MESSAGES.en["app.appts.mismatch"]), "the mismatch sentence names both people");

const pkg = read("package.json");
ok(pkg.includes("npm run check:appointment-about"), "check:appointment-about is in check:all");

console.log(fail ? `\n${fail} FAILED\n` : "\nall ok\n");
process.exit(fail ? 1 : 0);
