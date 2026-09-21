// scripts/check-sales-lead-status.mjs
//
// A lead's status follows what happened — lib/sales/leadStatus.js — and
// never moves backwards. Every transition and its idempotence is executed
// here against a fake transaction; the wiring is read from the files.
//
//   node --import ./scripts/alias-loader.mjs scripts/check-sales-lead-status.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  LEAD_STATUS_RANK,
  statusesBelow,
  leadStatusForDisposition,
  advanceLeadStatus,
  leadForAttempt,
  applyDispositionToLead,
  backfillLeadStatuses,
} from "@/lib/sales/leadStatus";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`); }
}
const section = (t) => console.log(`\n${t}\n`);

/** An in-memory SalesLead / SalesCallAttempt / Prospect store with the four Prisma calls the module makes. */
function fakeTx({ leads = [], attempts = [], prospects = [], events = [] } = {}) {
  const matches = (row, where) =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === "object" && "in" in v) return v.in.includes(row[k]);
      if (v && typeof v === "object" && "not" in v) return row[k] !== v.not;
      if (v && typeof v === "object" && "gte" in v) return row[k] >= v.gte;
      return row[k] === v;
    });
  let seq = 0;
  const tx = {
    leads, attempts, prospects,
    salesLead: {
      findFirst: async ({ where }) => leads.filter((l) => matches(l, where)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0] || null,
      updateMany: async ({ where, data }) => { let n = 0; for (const l of leads) if (matches(l, where)) { Object.assign(l, data); n++; } return { count: n }; },
      create: async ({ data }) => { const l = { id: `lead${++seq}`, createdAt: seq, ...data }; leads.push(l); return { id: l.id, status: l.status, businessName: l.businessName }; },
      groupBy: async () => { const m = {}; for (const l of leads) m[l.status] = (m[l.status] || 0) + 1; return Object.entries(m).map(([status, n]) => ({ status, _count: { _all: n } })); },
    },
    salesCallAttempt: {
      findMany: async ({ where }) => attempts.filter((a) => matches(a, where)),
      updateMany: async ({ where, data }) => { let n = 0; for (const a of attempts) if (matches(a, where)) { Object.assign(a, data); n++; } return { count: n }; },
    },
    prospect: { findFirst: async ({ where }) => prospects.find((p) => matches(p, where)) || null },
    salesEvent: { findMany: async ({ where }) => events.filter((e) => matches(e, where)) },
    $transaction: async (fn) => fn(tx),
  };
  return tx;
}

section("1. The order, and what each outcome means for the lead");
{
  ok("new < contacted < demoed < lost < signed", LEAD_STATUS_RANK.new < LEAD_STATUS_RANK.contacted && LEAD_STATUS_RANK.contacted < LEAD_STATUS_RANK.demoed && LEAD_STATUS_RANK.demoed < LEAD_STATUS_RANK.lost && LEAD_STATUS_RANK.lost < LEAD_STATUS_RANK.signed);
  ok("a move to contacted may overwrite only new", JSON.stringify(statusesBelow("contacted")) === '["new"]');
  ok("a move to signed may overwrite everything, lost included", statusesBelow("signed").sort().join() === "contacted,demoed,lost,new");
  ok("an unknown target overwrites nothing", statusesBelow("bogus").length === 0);
  ok("reached / callback / reached_not_interested / reached_interested → contacted", ["reached", "callback", "reached_not_interested", "reached_interested", "agreed_link_sent"].every((c) => leadStatusForDisposition(c) === "contacted"));
  ok("not_a_fit and do_not_call → lost", leadStatusForDisposition("not_a_fit") === "lost" && leadStatusForDisposition("do_not_call") === "lost");
  ok("no_answer / busy / voicemail / bad_number move nothing", ["no_answer", "busy", "voicemail", "bad_number", "nope", null].every((c) => leadStatusForDisposition(c) === null));
}

section("2. Forward only, and a no-op the second time");
{
  const tx = fakeTx({ leads: [{ id: "L1", salesRepId: "rep", status: "new", notes: null }] });
  const a = await advanceLeadStatus(tx, { leadId: "L1", salesRepId: "rep", to: "contacted" });
  ok("new → contacted moves one row", a.moved === 1 && tx.leads[0].status === "contacted");
  const b = await advanceLeadStatus(tx, { leadId: "L1", salesRepId: "rep", to: "contacted" });
  ok("…and the same move again moves nothing", b.moved === 0 && tx.leads[0].status === "contacted");
  const c = await advanceLeadStatus(tx, { leadId: "L1", salesRepId: "rep", to: "demoed" });
  const d = await advanceLeadStatus(tx, { leadId: "L1", salesRepId: "rep", to: "contacted" });
  ok("demoed, then a contacted arriving late leaves demoed", c.moved === 1 && d.moved === 0 && tx.leads[0].status === "demoed");
  const e = await advanceLeadStatus(tx, { leadId: "L1", salesRepId: "rep", to: "lost", reason: "Not a business we can sell to — franchise HQ", now: new Date("2026-09-21T12:00:00Z") });
  ok("demoed → lost, with the reason on the notes", e.moved === 1 && tx.leads[0].status === "lost" && tx.leads[0].notes === "Lost (2026-09-21): Not a business we can sell to — franchise HQ", tx.leads[0].notes);
  const f = await advanceLeadStatus(tx, { leadId: "L1", salesRepId: "rep", to: "contacted" });
  ok("lost never goes back to contacted", f.moved === 0 && tx.leads[0].status === "lost");
  const g = await advanceLeadStatus(tx, { leadId: "L1", salesRepId: "rep", to: "signed" });
  ok("…but a signup wins over lost", g.moved === 1 && tx.leads[0].status === "signed");
  const h = await advanceLeadStatus(tx, { leadId: "L1", salesRepId: "rep", to: "lost", reason: "x" });
  ok("and a signed lead cannot be lost by a phone call", h.moved === 0 && tx.leads[0].status === "signed");
  const other = fakeTx({ leads: [{ id: "L2", salesRepId: "someone-else", status: "new" }] });
  ok("another rep's lead is never touched", (await advanceLeadStatus(other, { leadId: "L2", salesRepId: "rep", to: "contacted" })).moved === 0 && other.leads[0].status === "new");
  const withNotes = fakeTx({ leads: [{ id: "L3", salesRepId: "rep", status: "contacted", notes: "Spoke to Sam." }] });
  await advanceLeadStatus(withNotes, { leadId: "L3", salesRepId: "rep", to: "lost", reason: "Requested no call-backs", now: new Date("2026-09-21T12:00:00Z") });
  ok("the reason is appended under the rep's own notes, not over them", withNotes.leads[0].notes === "Spoke to Sam.\nLost (2026-09-21): Requested no call-backs");
}

section("3. The lead is found or created from the attempt");
{
  const prospects = [{ id: "P1", assignedRepId: "rep", businessName: "Acme Roofing", email: "a@acme.test", phoneE164: "+15550001111", country: "CA", province: "QC" }];
  const tx = fakeTx({ prospects, attempts: [{ id: "A1", salesRepId: "rep", prospectId: "P1", leadId: null }] });
  const made = await leadForAttempt(tx, { attempt: tx.attempts[0], salesRepId: "rep" });
  ok("no lead on the prospect: one is created from it, through createSalesLead, and the attempt is linked", made?.created === true && tx.leads.length === 1 && tx.leads[0].businessName === "Acme Roofing" && tx.leads[0].prospectId === "P1" && tx.leads[0].phone === "+15550001111" && tx.attempts[0].leadId === tx.leads[0].id, tx.leads[0]);
  const again = await leadForAttempt(tx, { attempt: { id: "A2", salesRepId: "rep", prospectId: "P1", leadId: null }, salesRepId: "rep" });
  ok("a second attempt on the prospect finds the same lead — never a duplicate", again?.created === false && again.id === tx.leads[0].id && tx.leads.length === 1);
  const byId = await leadForAttempt(tx, { attempt: { id: "A3", salesRepId: "rep", prospectId: null, leadId: tx.leads[0].id }, salesRepId: "rep" });
  ok("an attempt with a leadId finds it by id", byId?.id === tx.leads[0].id && byId.created === false);
  const notMine = await leadForAttempt(tx, { attempt: { id: "A4", salesRepId: "rep", prospectId: "P1", leadId: null }, salesRepId: "other" });
  ok("a prospect claimed by somebody else yields no lead and creates none", notMine === null && tx.leads.length === 1);
  ok("no prospect, no lead: null", (await leadForAttempt(tx, { attempt: { id: "A5", prospectId: null, leadId: null }, salesRepId: "rep" })) === null);
}

section("4. A disposition, applied");
{
  const prospects = [{ id: "P1", assignedRepId: "rep", businessName: "Acme", phoneE164: "+1", email: null, country: null, province: null }];
  const tx = fakeTx({ prospects, attempts: [{ id: "A1", salesRepId: "rep", prospectId: "P1", leadId: null }] });
  const none = await applyDispositionToLead(tx, { attempt: tx.attempts[0], salesRepId: "rep", code: "no_answer" });
  ok("no_answer on a prospect with no lead creates nothing and moves nothing", none.to === null && none.moved === 0 && tx.leads.length === 0);
  const r1 = await applyDispositionToLead(tx, { attempt: tx.attempts[0], salesRepId: "rep", code: "callback" });
  ok("callback creates the lead and moves it to contacted", r1.to === "contacted" && r1.created === true && r1.moved === 1 && tx.leads[0].status === "contacted");
  const r2 = await applyDispositionToLead(tx, { attempt: tx.attempts[0], salesRepId: "rep", code: "reached_not_interested" });
  ok("reached_not_interested on the same lead is a no-op", r2.moved === 0 && r2.created === false);
  const r3 = await applyDispositionToLead(tx, { attempt: tx.attempts[0], salesRepId: "rep", code: "not_a_fit", note: "Franchise head office", now: new Date("2026-09-21T00:00:00Z") });
  ok("not_a_fit → lost, the catalogue label and the rep's note as the reason", r3.to === "lost" && r3.moved === 1 && tx.leads[0].status === "lost" && /Lost \(2026-09-21\): Not a business we can sell to — Franchise head office/.test(tx.leads[0].notes), tx.leads[0].notes);
}

section("5. The backfill, twice");
{
  const prospects = [
    { id: "P1", assignedRepId: "rep", businessName: "One", phoneE164: "+1", email: null, country: null, province: null },
    { id: "P2", assignedRepId: "rep", businessName: "Two", phoneE164: "+2", email: null, country: null, province: null },
    { id: "P3", assignedRepId: "rep", businessName: "Three", phoneE164: "+3", email: null, country: null, province: null },
  ];
  const since = new Date("2026-09-14T00:00:00Z");
  const t1 = new Date("2026-09-15T00:00:00Z");
  const tx = fakeTx({
    prospects,
    leads: [{ id: "L9", salesRepId: "rep", prospectId: "P3", status: "new", createdAt: 1 }],
    attempts: [
      { id: "A1", salesRepId: "rep", prospectId: "P1", leadId: null, disposition: "reached", dispositionNote: "", dispositionAt: t1, dialledAt: t1 },
      { id: "A2", salesRepId: "rep", prospectId: "P1", leadId: null, disposition: "callback", dispositionNote: "", dispositionAt: t1, dialledAt: t1 },
      { id: "A3", salesRepId: "rep", prospectId: "P2", leadId: null, disposition: "no_answer", dispositionNote: "", dispositionAt: t1, dialledAt: t1 },
      { id: "A4", salesRepId: "rep", prospectId: "P3", leadId: null, disposition: "do_not_call", dispositionNote: "said so", dispositionAt: t1, dialledAt: t1 },
      { id: "A0", salesRepId: "rep", prospectId: "P2", leadId: null, disposition: "reached", dispositionNote: "", dispositionAt: new Date("2026-09-01T00:00:00Z"), dialledAt: new Date("2026-09-01T00:00:00Z") },
    ],
    events: [{ type: "demo", createdAt: t1, leadId: "L9", salesRepId: "rep" }],
  });
  const first = await backfillLeadStatuses({ client: tx, since });
  ok("first run: two dispositions moved, one lead created, one lost; the no_answer and the pre-window dial ignored", first.attempts === 3 && first.created === 1 && first.moved === 2 && tx.leads.length === 2, first);
  ok("…the demo moved nothing — its lead was already lost by the do-not-call", first.demos === 1 && first.demoMoved === 0 && tx.leads.find((l) => l.id === "L9").status === "lost");
  ok("…and the counts per status come back", first.byStatus.contacted === 1 && first.byStatus.lost === 1, first.byStatus);
  const second = await backfillLeadStatuses({ client: tx, since });
  ok("second run: nothing moves, nothing is created", second.moved === 0 && second.created === 0 && second.demoMoved === 0 && tx.leads.length === 2, second);
}

section("6. Wiring the check can only read");
{
  const store = read("lib/sales/calls/store.js");
  ok("saveDisposition applies the outcome to the lead through applyDispositionToLead, not a bare updateMany", /applyDispositionToLead\(tx, \{ attempt: existing, salesRepId, code, note, now \}\)/.test(store) && !/tx\.salesLead\.updateMany\(\{\s*where: \{ id: existing\.leadId/.test(store));
  ok("the catalogue says not_a_fit is lost", /not_a_fit: \{[\s\S]*?leadStatus: "lost"/.test(read("lib/sales/calls/dispositions.js")));
  ok("a demo booked from the demo page moves the lead to demoed", /advanceLeadStatus\(tx, \{ leadId, salesRepId: rep\.id, to: "demoed", now \}\)/.test(read("lib/sales/demoBooking/book.js")));
  ok("a demo the rep puts on the calendar moves the lead to demoed", /type === "demo" && leadId\) await advanceLeadStatus\(db, \{ leadId, salesRepId: rep\.id, to: "demoed" \}\)/.test(read("app/api/sales/events/route.js")));
  ok("a signup still writes signed (leadLink.js), the one transition older than this file", /status: "signed"/.test(read("lib/sales/leadLink.js")));
  ok("the cron replays the last fortnight every tick, in its own try", /backfillLeadStatuses\(\{ client: db, since: new Date\(now\.getTime\(\) - 14 \* 24 \* 60 \* 60 \* 1000\), now \}\)/.test(read("app/api/cron/sales-pipeline/route.js")));
  ok("the lead is created through createSalesLead — the one place leads are made", /createSalesLead\(tx, \{ salesRepId, source: prospect, status: "new" \}\)/.test(read("lib/sales/leadStatus.js")));
  const pkg = JSON.parse(read("package.json"));
  ok("check:sales-lead-status is a script and check:all runs it", typeof pkg.scripts["check:sales-lead-status"] === "string" && /check:sales-lead-status\b/.test(pkg.scripts["check:all"]));
}

console.log(`\n${failures.length === 0 ? "PASS" : "FAIL"} — ${pass} checks passed, ${failures.length} failed.`);
if (failures.length) process.exit(1);
