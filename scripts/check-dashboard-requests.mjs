// scripts/check-dashboard-requests.mjs
//
// The dashboard's Requests list: one predicate shared with the cron, and a
// dismissal whose blast radius stays where it was put.
//
//   npm run check:dashboard-requests
//
// ── Why this exists ────────────────────────────────────────────────────────
//
// lib/dashboard/workPanel.js answered "does this lead still need chasing?"
// with its own copy of the rule:
//
//     lead.status === "new" && !lead.quoteId
//
// character-for-character the follow-up cron's old `where` clause, asked on a
// screen. Two copies of a rule drift, and the drift is invisible because each
// copy looks right on its own. This one was already wrong about real people.
//
// Measured on the live tenant: 38 rows on that list, of which two belonged to
// homeowners who already had quotes. One had been quoted TWICE in May and was
// shown as "New request · today". Another had DECLINED twice in June and sat
// there as new demand. Neither carried LeadRequest.quoteId, because those
// quotes were imported and predate the lead row — so `!lead.quoteId` could
// never have caught either of them, however correct it looked.
//
// And the dismissal the owner asked for is the kind of field that leaks: one
// `where` clause somewhere else and a triage action has quietly become a
// second `lost`, with none of the evidence a real `lost` carries. Most of the
// assertions below are about that not happening.

import { readFileSync } from "node:fs";
import { requestNeedsAction, requestHiddenReason, DISMISSED_REASON } from "@/lib/dashboard/requests";
import { isUnansweredLead, buildWorkPanel } from "@/lib/dashboard/workPanel";
import { LEAD_STOP_REASONS } from "@/lib/followUps/stopConditions";
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
const panel = code(read("lib/dashboard/workPanel.js"));
const home = code(read("lib/dashboard/homeData.js"));
const ui = read("app/components/dashboard/WorkPanel.js");
const leadRoute = code(read("app/api/leads/[id]/route.js"));
const leadsPage = read("app/app/leads/page.js");
const schema = read("prisma/schema.prisma");
const docs = code(read("lib/leads/linkedDocuments.js"));

const now = new Date("2026-11-03T12:00:00Z");
const DAY = 86400000;
const lead = (over = {}) => ({ id: "l1", status: "new", quoteId: null, createdAt: new Date(now - 2 * DAY), ...over });

// ══ 1. The two live rows that proved the bug ══════════════════════════════
console.log("\nThe two rows this was wrong about");

// Harman Marzara: lead created 2026-11-02, quoted twice in May, quoteId NULL
// because those quotes were imported. The OLD rule shows him; the new one
// does not.
const harman = lead({ id: "harman", createdAt: new Date("2026-11-02"), quoteId: null });
ok("the old rule would have shown a lead whose quotes are only contact-matched",
  harman.status === "new" && !harman.quoteId);
ok("…and the new one drops him on the matched quote",
  requestNeedsAction({ lead: harman, facts: { hasQuote: true }, now }) === false);
ok("…reporting WHY, in the cron's own word", requestHiddenReason({ lead: harman, facts: { hasQuote: true }, now }) === "quoted");
// Elaine Cecile: two quotes, both DECLINED, in June. Declined is still quoted
// — she is not new demand, and the list must not read her as such.
ok("a lead whose only quotes were DECLINED is still not new demand",
  requestNeedsAction({ lead: lead({ id: "elaine" }), facts: { hasQuote: true }, now }) === false);
// 0 of the 38 had an appointment or a job, so these are the untested-in-live
// branches and are executed here instead.
ok("an appointment drops the row", requestNeedsAction({ lead: lead(), facts: { hasAppointment: true }, now }) === false);
ok("a job drops the row", requestNeedsAction({ lead: lead(), facts: { hasJob: true }, now }) === false);
ok("a plain new enquiry stays", requestNeedsAction({ lead: lead(), facts: {}, now }) === true);

// ══ 2. One predicate, two callers ═════════════════════════════════════════
console.log("\nOne predicate");

ok("the work panel delegates rather than deciding", /requestNeedsAction\(\{ lead, facts \}\)/.test(panel));
ok("…and its old rule is gone", !/lead\.status === "new" && !lead\.quoteId/.test(panel));
// Same inputs, same answer, through both doors.
for (const [label, facts] of [["nothing", {}], ["a quote", { hasQuote: true }], ["an appointment", { hasAppointment: true }], ["a job", { hasJob: true }], ["a reply", { repliedAt: new Date(now - DAY) }], ["a human's mark", { reachedAt: new Date(now - DAY) }]]) {
  ok(`${label}: the panel and the module agree`,
    isUnansweredLead(lead(), facts) === requestNeedsAction({ lead: lead(), facts, now: new Date() }));
}
// `before_rule` is about one automation's activation date, not about whether
// somebody owes this person a call — so it must not hide a dashboard row.
ok("a rule's activation date never hides a dashboard row",
  requestNeedsAction({ lead: lead({ createdAt: new Date("2020-01-01") }), facts: {}, now }) === true);
ok("…and the hidden-reason helper never reports it either",
  requestHiddenReason({ lead: lead({ createdAt: new Date("2020-01-01") }), facts: {}, now }) === null);

console.log("\nDegrading safely");

// On this panel an empty list reads as "no work waiting". A failed lookup must
// therefore SHOW rows, not hide them.
ok("no facts at all → the row is shown", requestNeedsAction({ lead: lead(), now }) === true);
ok("the panel with no facts map behaves as it did before", isUnansweredLead(lead()) === true);
ok("homeData treats a failed gather as 'nothing known', not as an empty list",
  /leadFacts = new Map\(\);/.test(home) && /lead facts not gathered/.test(read("lib/dashboard/homeData.js")));
ok("no lead → not shown, and never a throw", requestNeedsAction({}) === false && requestNeedsAction() === false);
ok("the panel survives a lead row with nothing on it", isUnansweredLead(null) === false && isUnansweredLead(undefined) === false);

// ══ 3. The query stopped pre-filtering ═══════════════════════════════════
console.log("\nThe query");

ok("the `quoteId: null` guard is gone from the dashboard read", !/status: "new", quoteId: null/.test(home));
// It was in THREE places, not two. This one is the "Your focus" headline,
// which would otherwise have said "1 request waiting" over a list showing
// none — found by this check while it was asserting the other two.
ok("…including the \"Your focus\" count, which is now derived from the same rows",
  /facts\.leadsUnanswered = leads\.filter\(/.test(home) && /requestNeedsAction\(\{ lead: l/.test(home));
ok("…and it still narrows by status and the read cap", /where: \{ companyId, status: "new" \}/.test(home) && /take: READ_CAP/.test(home));
ok("it selects what the predicate reads", /reachedAt: true, dismissedAt: true/.test(home));
ok("the facts are gathered through the SAME function the cron uses", /gatherLeadChaseFacts\(db, \{ companyId, leads \}\)/.test(home));
ok("…imported statically, because homeData is server-only", /^import \{ gatherLeadChaseFacts \}/m.test(home));
ok("…and only when somebody may see requests at all", /perms\.requests && leads\.length/.test(home));

console.log("\nAnd it is affordable on a page load");

// READ_CAP is 500. The appointment rule was two queries PER LEAD, which is a
// thousand on one dashboard load.
ok("the appointment rule has a batched shape", /export async function loadLeadAppointmentsBatch/.test(docs));
ok("…and the single-lead one is a wrapper over it, so there is one rule",
  /loadLeadAppointmentsBatch\(db, \{\n?\s*leads: \[\{ id: leadId, quoteId: quoteId \|\| null \}\],/.test(docs));
ok("the gatherer uses the batch, not the per-lead shape",
  /loadLeadAppointmentsBatch/.test(code(read("lib/followUps/leadChaseFacts.js")))
    && !/await loadLeadAppointments\(/.test(code(read("lib/followUps/leadChaseFacts.js"))));

// ══ 4. Dismissal, and where it may NOT go ════════════════════════════════
//
// The assertions this file exists for.
console.log("\nDismissal does what it says");

ok("a dismissed lead leaves the list", requestNeedsAction({ lead: lead({ dismissedAt: new Date() }), facts: {}, now }) === false);
ok("…with its own reason, which is not one of the cron's", requestHiddenReason({ lead: lead({ dismissedAt: new Date() }), now }) === DISMISSED_REASON);
ok("…and that reason is NOT in the chase's list", !LEAD_STOP_REASONS.includes(DISMISSED_REASON));
ok("undismissing brings it back", requestNeedsAction({ lead: lead({ dismissedAt: null }), facts: {}, now }) === true);

console.log("\nDismissal does NOT do anything else");

// The boundary that matters most: a lead taken off a list is not a lead
// somebody spoke to, and the chase must never learn the word.
ok("lib/followUps/stopConditions.js has no notion of dismissal", !/dismiss/i.test(stops));
ok("…nor does the chase's fact gatherer", !/dismiss/i.test(code(read("lib/followUps/leadChaseFacts.js"))));
ok("…nor the cron", !/dismiss/i.test(code(read("app/api/cron/follow-ups/route.js"))));
// And it must never reach a number anybody reports.
for (const f of ["lib/agency/leadFacts.js", "lib/analytics/campaignRollup.js", "lib/analytics/campaignRollupData.js"]) {
  ok(`${f.split("/").slice(-1)[0]} never reads it — a triage action in a report is a shadow "lost"`, !/dismissedAt/.test(read(f)));
}
ok("exactly one module knows the word at all",
  /lead\.dismissedAt/.test(code(read("lib/dashboard/requests.js"))) && !/dismissedAt/.test(panel));
// It is not the status column, and the schema says why with the live numbers.
ok("it is two additive nullable columns", /dismissedAt\s+DateTime\?/.test(schema) && /dismissedById\s+String\?/.test(schema));
ok("…and LeadStatus is untouched", !/dismiss/i.test((schema.match(/enum LeadStatus \{[\s\S]*?\}/) || [""])[0]));
{
  const block = schema.slice(schema.indexOf("dismissedAt"), schema.indexOf("dismissedAt") + 40);
  const why = schema.slice(Math.max(0, schema.indexOf("Why this is NOT `status:") - 200), schema.indexOf("dismissedAt"));
  ok("the schema records all three reasons it is not `lost`", Boolean(block)
    && /destroys a real dataset/.test(why) && /forces a reason nobody gave/.test(why) && /false about specific people/.test(why));
}

// ══ 5. The write ══════════════════════════════════════════════════════════
console.log("\nThe write");

ok("the PATCH takes a boolean, so nobody can post a backdated mark", /typeof body\.dismissed !== "boolean"/.test(leadRoute));
ok("who and when are stamped together", /data\.dismissedAt = body\.dismissed \? new Date\(\) : null;/.test(leadRoute)
  && /data\.dismissedById = body\.dismissed \? member\.userId \|\| null : null;/.test(leadRoute));
ok("the change is logged, on a real transition only",
  /lead\.dismissed/.test(leadRoute) && /lead\.undismissed/.test(leadRoute)
  && /Boolean\(existing\.dismissedAt\) !== Boolean\(data\.dismissedAt\)/.test(leadRoute));
ok("the log entry says the follow-ups are unaffected", /follow-ups are unaffected/.test(leadRoute));
ok("dismissing and reaching are separate branches of the PATCH",
  /if \(body\.dismissed !== undefined\)/.test(leadRoute) && /if \(body\.reached !== undefined\)/.test(leadRoute));

console.log("\nThe screens");

ok("the dashboard row carries its own dismiss url, built from a checked id", /dismiss: `\/api\/leads\/\$\{id\}`/.test(panel));
ok("…only on an enquiry row", /item\.kind === "lead" && item\.dismiss/.test(ui));
ok("…and a failed dismiss is reported on the row, not swallowed", /reportResponseError\(/.test(ui) && /async function dismiss\(item\)/.test(ui));
ok("the row itself opens the lead now — the name was plain text", /<Link\n?\s*href=\{item\.action\?\.href \|\| LIST_HREF\[current\.key\]\}\n?\s*className="block truncate/.test(ui));
ok("…at the same href the button already used, so there is one destination", (ui.match(/item\.action\?\.href \|\| LIST_HREF\[current\.key\]/g) || []).length >= 2);
ok("the Leads board still shows a dismissed lead, and undoes it there",
  /lead\.dismissedAt &&/.test(leadsPage) && /patch\(\{ dismissed: false \}\)/.test(leadsPage));
ok("…and says plainly that the follow-ups are unaffected", /app\.leads\.dismissed\.note/.test(leadsPage));

console.log("\nThe words");

{
  const hint = APP_MESSAGES.en["app.dash.work.dismissHint"] || "";
  const note = APP_MESSAGES.en["app.leads.dismissed.note"] || "";
  ok("the dashboard hint says it stays a lead and the follow-ups run", /stays a lead/i.test(hint) && /follow-?up/i.test(hint), hint);
  ok("the lead-page note says the follow-ups are unaffected", /unaffected/i.test(note), note);
}
for (const key of ["app.leads.dismissed.note", "app.leads.dismissed.undo", "app.dash.work.dismiss", "app.dash.work.dismissHint", "app.dash.work.dismissed"]) {
  const missing = Object.keys(APP_MESSAGES).filter((l) => !APP_MESSAGES[l][key]);
  ok(`${key} in all nine languages`, missing.length === 0, missing.join(","));
}

// ══ 6. buildWorkPanel end to end ═════════════════════════════════════════
console.log("\nThe panel, built");

{
  const base = {
    now, timeZone: null, companyId: "c1",
    allowed: { requests: true }, showMoney: false,
    estimates: [], bookings: [], quotes: [], jobs: [], visits: [],
  };
  const rows = [
    { id: "keep", companyId: "c1", name: "Keep", status: "new", quoteId: null, createdAt: new Date(now - DAY) },
    { id: "quoted", companyId: "c1", name: "Quoted", status: "new", quoteId: null, createdAt: new Date(now - DAY) },
    { id: "gone", companyId: "c1", name: "Dismissed", status: "new", quoteId: null, createdAt: new Date(now - DAY), dismissedAt: new Date() },
  ];
  const facts = new Map([["quoted", { hasQuote: true }]]);
  const tabOf = (built) => (built.tabs || []).find((tb) => tb.key === "requests") || { items: [] };
  const built = buildWorkPanel({ ...base, leads: rows, leadFacts: facts });
  const ids = tabOf(built).items.map((i) => i.id);
  ok("the matched-quote row and the dismissed row are both gone", ids.join(",") === "keep", ids);
  ok("the surviving row can be dismissed", tabOf(built).items[0]?.dismiss === "/api/leads/keep");
  // Without a facts map nothing is known, so both non-dismissed rows show —
  // the pre-change behaviour, which is the safe direction.
  const noFacts = buildWorkPanel({ ...base, leads: rows });
  ok("with no facts, only the dismissed row is dropped",
    tabOf(noFacts).items.map((i) => i.id).join(",") === "keep,quoted");
  // A lead belonging to another tenant never appears, facts or no facts.
  const other = buildWorkPanel({ ...base, leads: [{ ...rows[0], id: "x", companyId: "c2" }], leadFacts: new Map() });
  ok("another company's lead is never on this panel", tabOf(other).items.length === 0);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
