// scripts/check-support-escalation.mjs
//
//   npm run check:support-escalation
//
// A rep hears "the invoice email never arrived" from a contractor they signed
// up. Where does that go?
//
// ══ What this was built after ═════════════════════════════════════════════
//
// Nowhere. FieldQuo had no support channel at all — no SupportTicket model, no
// route, no screen, nothing in /platform that a customer problem could land on.
// The rep's options were a text message to the owner or dropping it, and there
// is no record anywhere in this repo of a problem reported by the person
// closest to the customer.
//
// ══ Executed, every branch ════════════════════════════════════════════════
//
// lib/support/escalation.js is pure over rows the caller has already read —
// the shape lib/sales/calls/inboundDistribution.js and lib/migrations/state.js
// use, and for the same reason. Every case below runs the real function with
// no database. The ones that matter are the REFUSALS:
//
//   · a rep raising a ticket about a company that is not attributed to them;
//   · a company attributed to nobody (31 tenants predate the sales portal and
//     their null attribution is permanent — "unattributed" must never read as
//     "everybody's");
//   · a ticket assigned when no superadmin exists;
//   · a status transition the state machine does not have.
//
// ══ Mutation-tested ═══════════════════════════════════════════════════════
//
// The attribution check, the "only an ACTIVE SUPERADMIN takes a ticket" rule,
// the same-status refusal, the resolvedAt clear-on-reopen, and the route's own
// assignedCompanyWhere narrowing were each broken on disk in turn, confirmed
// to fail here, and restored from a `cp` backup — never `git checkout`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  DEFAULT_PRIORITY,
  MAX_BODY_LENGTH,
  MAX_SUBJECT_LENGTH,
  PRIORITY_LABELS,
  STATUS_LABELS,
  SUPPORT_NOTE_KINDS,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
  UNRESOLVED_STATUSES,
  assignedAdminFor,
  canTransition,
  decideEscalation,
  decideStatusChange,
  normalisePriority,
  repStatusLine,
  repVisibleNotes,
  sanitiseBody,
  sanitiseSubject,
  statusChangeSentence,
} from "@/lib/support/escalation";
import { SUPERADMIN_ONLY_PERMISSIONS, canPlatform } from "@/lib/platform/permissions";
import { REP_OUTREACH_WRITES } from "@/lib/sales/outreachGate";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const readRaw = (p) => readFileSync(join(ROOT, p), "utf8");
// Every source-level rule below is about what the code DOES. A guard named in
// a comment is not a guard — and this file's own comments name most of them.
const read = (p) =>
  readRaw(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`);
  }
}
const section = (t) => console.log(`\n${t}\n`);

const NOW = new Date("2026-09-09T12:00:00Z");

/** A rep as the gate hands one over: read fresh, id only from the session. */
const REP = { id: "rep_owner", name: "Dana", email: "dana@fieldquo.com" };
const OTHER_REP = { id: "rep_someone_else", name: "Sam" };

/** A Company row exactly as the route selects it. */
const company = (id, attributedTo) => ({
  id,
  name: `Company ${id}`,
  salesAttribution: attributedTo ? { salesRepId: attributedTo } : null,
});

const MINE = company("co_mine", REP.id);
const THEIRS = company("co_theirs", OTHER_REP.id);
const UNATTRIBUTED = company("co_old", null);

// ═══════════════════════════════════════════════════════════════════════════
section("1. The closed sets are written down, and nothing else exists");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok("three statuses, and only three", SUPPORT_STATUSES.length === 3, SUPPORT_STATUSES);
  ok(
    "they are open / in_progress / resolved",
    ["open", "in_progress", "resolved"].every((s) => SUPPORT_STATUSES.includes(s)),
    SUPPORT_STATUSES,
  );
  // There is deliberately no `closed` beside `resolved` — see the schema
  // comment. Two words for "we are done" is how a queue gets a hiding place.
  ok("there is no separate `closed`", !SUPPORT_STATUSES.includes("closed"));
  ok("every status has a label", SUPPORT_STATUSES.every((s) => typeof STATUS_LABELS[s] === "string" && STATUS_LABELS[s]));
  ok("every priority has a label", SUPPORT_PRIORITIES.every((p) => typeof PRIORITY_LABELS[p] === "string" && PRIORITY_LABELS[p]));
  ok("priorities run low → urgent, so an index is a rank", SUPPORT_PRIORITIES.join(",") === "low,normal,high,urgent", SUPPORT_PRIORITIES);
  ok("the default priority is one of them", SUPPORT_PRIORITIES.includes(DEFAULT_PRIORITY));
  ok("unresolved means open + in_progress", UNRESOLVED_STATUSES.join(",") === "open,in_progress", UNRESOLVED_STATUSES);
  ok("…and every unresolved status is a real status", UNRESOLVED_STATUSES.every((s) => SUPPORT_STATUSES.includes(s)));
  ok("note kinds are message + status_change", SUPPORT_NOTE_KINDS.join(",") === "message,status_change", SUPPORT_NOTE_KINDS);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Sanitisers, against what a browser can actually send");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok("a subject is trimmed", sanitiseSubject("   Invoices  fail   ") === "Invoices fail", sanitiseSubject("   Invoices  fail   "));
  ok("whitespace alone is not a subject", sanitiseSubject("   \n\t  ") === "");
  ok("a number is not a subject", sanitiseSubject(42) === "");
  ok("null is not a subject", sanitiseSubject(null) === "");
  ok("an array is not a subject", sanitiseSubject(["x"]) === "");
  ok(`a subject is capped at ${MAX_SUBJECT_LENGTH}`, sanitiseSubject("x".repeat(500)).length === MAX_SUBJECT_LENGTH);
  // The body keeps its line breaks: a rep pasting three steps to reproduce
  // must not have them run into one paragraph.
  ok("a body keeps its newlines", sanitiseBody("one\ntwo\nthree") === "one\ntwo\nthree");
  ok("…but loses trailing space on each line", sanitiseBody("one   \ntwo\t\t") === "one\ntwo");
  ok("…and collapses runs of spaces inside a line", sanitiseBody("a     b") === "a b");
  ok("whitespace alone is not a body", sanitiseBody("\n\n   \n") === "");
  ok(`a body is capped at ${MAX_BODY_LENGTH}`, sanitiseBody("y".repeat(MAX_BODY_LENGTH + 400)).length === MAX_BODY_LENGTH);
  ok("an object is not a body", sanitiseBody({ toString: () => "sneaky" }) === "");
}

{
  // Absence is "nobody ranked it", which for a support queue genuinely is
  // normal. A PRESENT but unrecognised value is refused rather than quietly
  // downgraded — silently turning "critical" into "normal" is the padding
  // AGENTS.md failure class #5 is about.
  ok("no priority means normal", normalisePriority(undefined).priority === DEFAULT_PRIORITY && !normalisePriority(undefined).rejected);
  ok("an empty string means normal", normalisePriority("").priority === DEFAULT_PRIORITY);
  ok("whitespace means normal", normalisePriority("   ").priority === DEFAULT_PRIORITY);
  ok("case does not matter", normalisePriority("URGENT").priority === "urgent");
  ok("an invented priority is REJECTED, not downgraded", normalisePriority("critical").rejected === true && normalisePriority("critical").priority === null);
  ok("…and so is a number", normalisePriority(9).rejected === true);
  ok("…and so is an object", normalisePriority({ priority: "urgent" }).rejected === true);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. A rep may only escalate about a company in their OWN book");
// ═══════════════════════════════════════════════════════════════════════════

const GOOD = { subject: "Invoice emails aren't arriving", body: "Sent three on Monday; none landed." };

{
  const yes = decideEscalation({ rep: REP, company: MINE, ...GOOD });
  ok("the happy path is allowed", yes.ok === true, yes);
  ok("…and writes the rep id from the GATE, not from anywhere else", yes.ticket.salesRepId === REP.id, yes.ticket);
  ok("…and the company id off the row it was handed", yes.ticket.companyId === MINE.id);
  ok("…and opens the ticket open", yes.ticket.status === "open");
  ok("…at the default priority when none was given", yes.ticket.priority === DEFAULT_PRIORITY);
}

{
  // THE assertion this file exists for.
  const no = decideEscalation({ rep: REP, company: THEIRS, ...GOOD });
  ok("a company attributed to ANOTHER rep is refused", no.ok === false, no);
  ok("…with code company_not_in_book", no.code === "company_not_in_book", no.code);
  ok("…and nothing to write", no.ticket === null);
}

{
  // The 31 tenants that predate the sales portal have permanently null
  // attribution. "Unattributed" must never read as "everybody's".
  const no = decideEscalation({ rep: REP, company: UNATTRIBUTED, ...GOOD });
  ok("a company attributed to NOBODY is refused", no.ok === false && no.code === "company_not_in_book", no);
}

{
  const missing = decideEscalation({ rep: REP, company: null, ...GOOD });
  ok("a company that does not exist is refused", missing.ok === false, missing);
  // Deliberately the SAME refusal as "not yours": distinct answers would turn
  // this endpoint into an oracle for which company ids are real.
  const theirs = decideEscalation({ rep: REP, company: THEIRS, ...GOOD });
  ok("…and is indistinguishable from a company that is not theirs", missing.code === theirs.code && missing.status === theirs.status && missing.error === theirs.error);
}

{
  ok("a company row with no id is refused", decideEscalation({ rep: REP, company: { salesAttribution: { salesRepId: REP.id } }, ...GOOD }).ok === false);
  ok("an attribution naming the rep on a MISSING company does not pass", decideEscalation({ rep: REP, company: null, ...GOOD }).ok === false);
  ok("no rep at all is a 401", decideEscalation({ company: MINE, ...GOOD }).status === 401);
  ok("a rep with a blank id is a 401", decideEscalation({ rep: { id: "" }, company: MINE, ...GOOD }).status === 401);
  ok("calling it with nothing at all does not throw", decideEscalation().ok === false);
}

{
  // Scope is decided BEFORE the text is validated. "A ticket needs a subject",
  // answered about somebody else's company, is itself a statement about that
  // company.
  const hostile = decideEscalation({ rep: REP, company: THEIRS, subject: "", body: "" });
  ok("an empty ticket about somebody else's company answers scope, not validation", hostile.code === "company_not_in_book", hostile.code);
}

{
  ok("an empty subject is refused", decideEscalation({ rep: REP, company: MINE, subject: "  ", body: "x" }).code === "subject_required");
  ok("an empty body is refused", decideEscalation({ rep: REP, company: MINE, subject: "x", body: "\n " }).code === "body_required");
  ok("an invented priority is refused", decideEscalation({ rep: REP, company: MINE, ...GOOD, priority: "critical" }).code === "unknown_priority");
  ok("…and a real one is kept", decideEscalation({ rep: REP, company: MINE, ...GOOD, priority: "urgent" }).ticket.priority === "urgent");
  const long = decideEscalation({ rep: REP, company: MINE, subject: "s".repeat(400), body: "b".repeat(MAX_BODY_LENGTH * 2) });
  ok("a pasted log file is capped rather than stored whole", long.ok && long.ticket.subject.length === MAX_SUBJECT_LENGTH && long.ticket.body.length === MAX_BODY_LENGTH);
  // Nothing off the body may become the writing identity.
  ok("a salesRepId in the payload cannot become the author", decideEscalation({ rep: REP, company: MINE, ...GOOD, salesRepId: OTHER_REP.id }).ticket.salesRepId === REP.id);
  ok("a status in the payload cannot open a ticket resolved", decideEscalation({ rep: REP, company: MINE, ...GOOD, status: "resolved" }).ticket.status === "open");
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Assignment is LOOKED UP — never a hard-coded admin id");
// ═══════════════════════════════════════════════════════════════════════════

const admin = (id, role, active, createdAt) => ({ id, role, active, createdAt: new Date(createdAt) });

{
  const owner = admin("adm_owner", "superadmin", true, "2025-01-01T00:00:00Z");
  const later = admin("adm_second", "superadmin", true, "2026-05-01T00:00:00Z");
  ok("the one superadmin gets it", assignedAdminFor([owner]).adminId === "adm_owner");
  ok("…and so does the OLDEST when there are two", assignedAdminFor([later, owner]).adminId === "adm_owner", assignedAdminFor([later, owner]));
  ok("…whatever order the rows arrive in", assignedAdminFor([owner, later]).adminId === "adm_owner");
  ok("the reason says how it was chosen", assignedAdminFor([owner]).reason === "first_superadmin");
}

{
  // The four cases where a ticket must NOT be handed to somebody.
  ok("an `admin` is not a superadmin", assignedAdminFor([admin("a", "admin", true, "2020-01-01")]).adminId === null);
  ok("neither is `support`", assignedAdminFor([admin("a", "support", true, "2020-01-01")]).adminId === null);
  ok("a DEACTIVATED superadmin does not take tickets", assignedAdminFor([admin("a", "superadmin", false, "2020-01-01")]).adminId === null);
  // `active === true`, not truthy: an undefined here means the caller forgot
  // to select the column, and assigning on a column nobody read is exactly the
  // class of bug this repo keeps finding.
  ok("…nor one whose `active` column was never selected", assignedAdminFor([{ id: "a", role: "superadmin", createdAt: new Date() }]).adminId === null);
  ok("a row with no id is skipped", assignedAdminFor([{ role: "superadmin", active: true }]).adminId === null);
}

{
  // The hostile case in the brief: a ticket assigned when no superadmin exists.
  const none = assignedAdminFor([admin("a", "admin", true, "2020-01-01"), admin("b", "support", true, "2020-01-01")]);
  ok("no superadmin at all answers null", none.adminId === null, none);
  ok("…and says WHY, so the caller can tell the rep", none.reason === "no_superadmin");
  ok("an empty list does not throw", assignedAdminFor([]).adminId === null);
  ok("neither does null", assignedAdminFor(null).adminId === null);
  ok("neither does a string", assignedAdminFor("adm_owner").adminId === null);
  ok("neither does a list of nulls", assignedAdminFor([null, undefined]).adminId === null);
}

{
  // Two admins created in the same millisecond must not make assignment flip
  // between requests — the ticket would look reassigned with nobody moving it.
  const a = admin("adm_aaa", "superadmin", true, "2026-01-01T00:00:00Z");
  const b = admin("adm_bbb", "superadmin", true, "2026-01-01T00:00:00Z");
  ok("a same-instant tie is broken deterministically", assignedAdminFor([a, b]).adminId === assignedAdminFor([b, a]).adminId);
  ok("…on the lower id", assignedAdminFor([b, a]).adminId === "adm_aaa");
}

{
  // The owner's own PlatformAdmin id, from the brief. It must appear NOWHERE
  // in shipped code — a hard-coded id is wrong the day a second admin exists
  // or the database is reseeded, and wrong silently.
  const OWNER_ID = "cms3maolb0000bot6r7jmiibe";
  const files = [
    "lib/support/escalation.js",
    "lib/support/repClient.js",
    "app/api/sales/support/route.js",
    "app/api/sales/support/[id]/route.js",
    "app/api/platform/support/route.js",
    "app/api/platform/support/[id]/route.js",
    "app/platform/support/page.js",
    "app/sales/support/page.js",
  ];
  ok("no shipped file hard-codes the owner's admin id", files.every((f) => !readRaw(f).includes(OWNER_ID)));
  const post = read("app/api/sales/support/route.js");
  ok("the POST resolves the assignee through assignedAdminFor", post.includes("assignedAdminFor("));
  ok("…off a query for ACTIVE SUPERADMINS", /platformAdmin\.findMany\([\s\S]{0,220}role: "superadmin"[\s\S]{0,120}active: true/.test(post), post.match(/platformAdmin\.findMany\([\s\S]{0,260}/)?.[0]);
  ok("…and writes what it decided", /assignedAdminId: adminId/.test(post));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Status moves: the ones that exist, and the ones that are refused");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok("open → in_progress", canTransition("open", "in_progress"));
  ok("open → resolved", canTransition("open", "resolved"));
  ok("in_progress → resolved", canTransition("in_progress", "resolved"));
  ok("in_progress → open (put it back on the queue)", canTransition("in_progress", "open"));
  ok("resolved → open (a reopen keeps the thread)", canTransition("resolved", "open"));
  // Reopening lands in the queue, not in "somebody is on it" — that would be a
  // claim nobody made.
  ok("resolved → in_progress is NOT a move", !canTransition("resolved", "in_progress"));
  ok("a status cannot move to itself", !canTransition("open", "open") && !canTransition("resolved", "resolved"));
  ok("an unknown `from` has no edges", !canTransition("closed", "open"));
  ok("an unknown `to` has no edge", !canTransition("open", "archived"));
  ok("undefined does not throw", !canTransition(undefined, undefined));
}

{
  const openTicket = { id: "t1", status: "open" };
  const go = decideStatusChange({ ticket: openTicket, to: "in_progress", now: NOW });
  ok("a legal move is allowed", go.ok === true, go);
  ok("…and reports where it came from", go.from === "open" && go.to === "in_progress");
  ok("…and leaves resolvedAt null", go.data.resolvedAt === null, go.data);

  const done = decideStatusChange({ ticket: { status: "in_progress" }, to: "resolved", now: NOW });
  ok("resolving stamps resolvedAt", done.data.resolvedAt === NOW, done.data);

  // A reopened ticket that kept its old stamp would report a date on which it
  // demonstrably was not fixed, and the console's resolution-time figure would
  // count it.
  const reopen = decideStatusChange({ ticket: { status: "resolved", resolvedAt: NOW }, to: "open", now: NOW });
  ok("reopening CLEARS resolvedAt", reopen.ok === true && reopen.data.resolvedAt === null, reopen.data);
}

{
  // Refused rather than treated as a no-op success: two people working the
  // queue would both be told they moved it, and on `resolved` the second click
  // would re-stamp resolvedAt to a later time than the fix.
  const same = decideStatusChange({ ticket: { status: "open" }, to: "open" });
  ok("moving to the status it already has is refused", same.ok === false, same);
  ok("…as a 409, not a 200", same.status === 409 && same.code === "already_in_status");

  const illegal = decideStatusChange({ ticket: { status: "resolved" }, to: "in_progress" });
  ok("an illegal edge is refused", illegal.ok === false && illegal.code === "illegal_transition", illegal);
  ok("…and says both ends in words", /resolved/i.test(illegal.error) && /in progress/i.test(illegal.error), illegal.error);

  ok("an unknown target status is a 400", decideStatusChange({ ticket: { status: "open" }, to: "deleted" }).status === 400);
  ok("a non-string target is a 400", decideStatusChange({ ticket: { status: "open" }, to: 3 }).status === 400);
  ok("no ticket is a 404", decideStatusChange({ ticket: null, to: "open" }).status === 404);
  ok("a ticket with no status is a 404", decideStatusChange({ ticket: { id: "t" }, to: "open" }).status === 404);
  ok("calling it with nothing does not throw", decideStatusChange().ok === false);
}

{
  const sentence = statusChangeSentence({ from: "open", to: "in_progress" });
  ok("the trace names both ends", sentence.includes("Open") && sentence.includes("In progress"), sentence);
  ok("…and names the actor when there is one", statusChangeSentence({ from: "open", to: "resolved", actorName: "Emilio" }).startsWith("Emilio moved"));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. What the rep sees — internal notes, and the honest status line");
// ═══════════════════════════════════════════════════════════════════════════

{
  const notes = [
    { id: "n1", body: "Looking now.", internal: false },
    { id: "n2", body: "Neon cold start, don't tell them yet.", internal: true },
    { id: "n3", body: "Fixed.", internal: false },
  ];
  const visible = repVisibleNotes(notes);
  ok("an internal note never reaches the rep", visible.length === 2 && !visible.some((n) => n.internal), visible);
  ok("…and the ones that do keep their order", visible[0].id === "n1" && visible[1].id === "n3");
  // A note with no `internal` column selected is treated as visible, which is
  // the safe direction only because the route always selects it — asserted in
  // section 7.
  ok("a note with the flag absent is visible", repVisibleNotes([{ id: "x" }]).length === 1);
  ok("a non-array does not throw", repVisibleNotes(null).length === 0);
  ok("nor do null entries", repVisibleNotes([null, { id: "a", internal: false }]).length === 1);
}

{
  ok("an assigned open ticket says it is waiting", repStatusLine({ status: "open", assignedAdminId: "adm" }).toLowerCase().includes("waiting"));
  ok("in progress says somebody is on it", repStatusLine({ status: "in_progress", assignedAdminId: "adm" }).toLowerCase().includes("on it"));
  ok("resolved says so", repStatusLine({ status: "resolved", assignedAdminId: "adm" }).toLowerCase().includes("resolved"));
  // The line that stops this being a black hole: a ticket that landed on
  // nobody must SAY it landed on nobody. A screen showing "Open" either way is
  // the reassuring lie.
  const orphan = repStatusLine({ status: "open", assignedAdminId: null });
  ok("an UNASSIGNED ticket says nobody has it", /not assigned/i.test(orphan), orphan);
  ok("…and tells the rep to chase it", /by hand|chase/i.test(orphan), orphan);
  ok("no ticket is an empty string, not a crash", repStatusLine(null) === "");
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The routes actually enforce it — and the screens actually call it");
// ═══════════════════════════════════════════════════════════════════════════

{
  const post = read("app/api/sales/support/route.js");
  ok("the rep routes are behind requireOutreachRep", post.includes("requireOutreachRep("));
  // Deliberately twice: the query narrows, and the pure decision re-checks the
  // row. Same discipline as the impersonation gate.
  ok("the company query is narrowed by assignedCompanyWhere(rep.id)", /db\.company\.findFirst\([\s\S]{0,200}assignedCompanyWhere\(rep\.id\)/.test(post), post.match(/db\.company\.findFirst\([\s\S]{0,200}/)?.[0]);
  ok("…and the attribution is SELECTED so the pure check can re-read it", /salesAttribution: \{ select: \{ salesRepId: true \} \}/.test(post));
  ok("…and decideEscalation is what decides", post.includes("decideEscalation("));
  ok("the write uses what the decision produced, not the body", /data: \{ \.\.\.decision\.ticket/.test(post));
  ok("a refused decision is returned with its own status", /status: decision\.status/.test(post));
  ok("the rep's read is scoped to their own tickets", /where: \{ salesRepId: rep\.id/.test(post));
  ok("…and so are the counts beside it", /groupBy\([\s\S]{0,140}salesRepId: rep\.id/.test(post));
  ok("internal notes are filtered before they leave", post.includes("repVisibleNotes("));
  ok("…and `internal` is selected, so the filter has something to read", /internal: true,/.test(post));
  ok("an unknown status filter is refused rather than ignored", /SUPPORT_STATUSES\.includes\(status\)/.test(post));
}

{
  const patch = read("app/api/sales/support/[id]/route.js");
  ok("a rep's reply re-reads the ticket under their own id", /findFirst\([\s\S]{0,120}salesRepId: rep\.id/.test(patch), patch.match(/findFirst\([\s\S]{0,140}/)?.[0]);
  // A rep resolving their own ticket would close a contractor's problem before
  // anybody at FieldQuo had looked at it.
  ok("a rep cannot move the STATUS", !/status:\s*(payload|body)\./.test(patch) && !patch.includes("decideStatusChange"));
  ok("a rep's note is never internal", /internal: false/.test(patch));
  ok("params is awaited — Next 16", /await params/.test(patch));
}

{
  const list = read("app/api/platform/support/route.js");
  const detail = read("app/api/platform/support/[id]/route.js");
  ok("the platform list requires support:manage", list.includes('requirePlatformPermission(admin.role, "support:manage")'));
  ok("…and so does the detail route", detail.includes('requirePlatformPermission(admin.role, "support:manage")'));
  ok("both start from a real platform session", list.includes("getCurrentPlatformAdmin(") && detail.includes("getCurrentPlatformAdmin("));
  ok("the status move goes through decideStatusChange", detail.includes("decideStatusChange("));
  // Read fresh in the request that writes — never a status the caller
  // remembered from an earlier page load.
  ok("…on a row read fresh in the writing request", /findUnique\([\s\S]{0,120}select: \{ id: true, status: true \}/.test(detail));
  ok("the write is a compare-and-set on the status it decided against", /updateMany\([\s\S]{0,120}status: change\.from/.test(detail));
  ok("a lost race rolls the trace back rather than reporting it", detail.includes("$transaction(async") && /throw new Error\(RACED\)/.test(detail));
  ok("the status change leaves an attributed trace", /kind: "status_change"[\s\S]{0,160}authorAdminId: admin\.id/.test(detail));
  ok("…which the rep can always see", /kind: "status_change"[\s\S]{0,260}internal: false/.test(detail));
  ok("a PATCH that changes nothing is refused", /Nothing to change/.test(detail));
  ok("params is awaited in both — Next 16", /await params/.test(detail));
  ok("neither platform route writes into a company's own data", !/db\.(quote|invoice|client|job)\./i.test(list + detail));
}

{
  const perms = read("lib/platform/permissions.js");
  ok("support:manage is declared superadmin-only", SUPERADMIN_ONLY_PERMISSIONS.includes("support:manage"));
  ok("…and the matrix agrees", canPlatform("superadmin", "support:manage") && !canPlatform("admin", "support:manage") && !canPlatform("support", "support:manage"));
  ok("…and it is documented where the list is", perms.includes("support:manage"));
  // Every permission the matrix grants has to have wording, or /platform/team
  // prints a raw code at the person choosing a role. check-platform-truth.mjs
  // asserts this globally; pinned here so a rename fails in this file too.
  ok("it is described in words on the team screen", read("app/platform/team/page.js").includes('"support:manage":'));
}

{
  // The list of tables a rep may write claims to be complete. Two more are on
  // it now, and the claim has to stay true.
  ok("supportTicket is a declared rep write", REP_OUTREACH_WRITES.includes("supportTicket"));
  ok("supportTicketNote is too", REP_OUTREACH_WRITES.includes("supportTicketNote"));
}

{
  const schema = readRaw("prisma/schema.prisma");
  ok("the SupportTicket model exists", /model SupportTicket \{/.test(schema));
  ok("…with the fields the brief asked for", ["companyId", "salesRepId", "subject", "body", "status", "priority", "assignedAdminId", "createdAt", "resolvedAt"].every((f) => new RegExp(`\\n\\s+${f}\\s`).test(schema.split("model SupportTicket {")[1].split("\n}")[0] + "\n")));
  ok("the note model exists, which is how replies are recorded", /model SupportTicketNote \{/.test(schema));
  ok("…and carries the internal flag the rep read filters on", /model SupportTicketNote \{[\s\S]*?internal\s+Boolean/.test(schema));
  ok("the assignee is a real relation to PlatformAdmin", /assignedAdmin\s+PlatformAdmin\?\s+@relation/.test(schema));
}

{
  // A screen nothing links to is the failure scripts/check-nav-audit.mjs and
  // scripts/check-route-callers.mjs exist for.
  ok("the console links /platform/support", read("app/components/platform/PlatformSidebar.js").includes('"/platform/support"'));
  ok("the rep portal links /sales/support", read("app/sales/SalesShell.js").includes('"/sales/support"'));
  const repPage = read("app/sales/support/page.js");
  ok("the rep screen calls the documented client API", repPage.includes("raiseSupportTicket(") && repPage.includes("listSupportTickets(") && repPage.includes("replyToSupportTicket("));
  ok("…and never hand-rolls a fetch that could send [object Object]", !/\bfetch\(/.test(repPage.replace(/fetchJson\(/g, "")));
  ok("…and shows the SERVER's status line, not one it invented", repPage.includes("statusLine"));
  const client = read("lib/support/repClient.js");
  ok("the client API goes through fetchJson", client.includes("fetchJson(") && !/if \(res\.ok\)/.test(client));
  const console_ = read("app/platform/support/page.js");
  ok("the console only offers legal status moves", console_.includes("canTransition("));
  ok("…and reads its permission through PlatformWriteGate", console_.includes("PlatformWriteGate") && console_.includes("isSuperadmin"));
  ok("…and never renders an empty list for a failed fetch", console_.includes("setFailed(true)"));
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. The check is wired in");
// ═══════════════════════════════════════════════════════════════════════════

{
  const pkg = JSON.parse(readRaw("package.json"));
  ok("check:support-escalation is a script", typeof pkg.scripts?.["check:support-escalation"] === "string");
  ok("…and check:all runs it", (pkg.scripts?.["check:all"] || "").includes("check:support-escalation"));
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
