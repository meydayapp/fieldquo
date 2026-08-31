// scripts/check-worker-archive.mjs
//
// The owner deleted a worker ("Jonny") and could still see them in Payroll.
//
// ══ What DELETE /api/workers/[id] actually did ═════════════════════════════
//
// It checked ONLY `payouts.length` before deciding whether to hard-delete —
// so a worker who had logged hours (TimeEntry, which cascade-deletes with the
// Worker row) or already appeared on a committed pay run (PayRunLine) but had
// never actually drawn a Stripe payout was destroyed outright. Their time log
// vanished silently with the cascade; their pay-run line either dangled or
// blocked the delete with a raw database error the route never caught — "the
// person is gone, and Payroll still has something to say about them" either
// way.
//
// lib/billing/access.js already states the rule for a COMPANY that stops
// paying: "a locked account is inaccessible, not erased." This is the same
// rule one level down, applied to a PERSON — see lib/team/workerArchive.js.
//
// ══ What these assert ═══════════════════════════════════════════════════════
//
//  1. hasWorkerHistory() — the pure decision — against hostile inputs: no
//     history at all, each kind of history alone, and history findable only
//     by re-reading columns nobody had checked before.
//  2. DELETE /api/workers/[id] actually queries all three tables and gates the
//     hard-delete on hasWorkerHistory(), rather than reintroducing the
//     payouts-only check as a parallel, unused decision.
//  3. Re-adding an archived worker by email REATTACHES to the existing row
//     (app/api/team/quick-add/route.js) instead of refusing outright or
//     silently creating a second, empty employment record — and does NOT
//     delete that row if the invitation email then fails to send.
//  4. Pickers that must not show an archived worker actually filter on
//     `active`, and the historical pay-run line renderer does NOT filter (or
//     join) on Worker at all — a March pay run must still name whoever it
//     paid even if that person left in August.
//
// Comments are STRIPPED before any regex runs over route source — a check
// that just greps prose passes on a file that only TALKS about doing the
// right thing. Every source-regex below is also scoped to the specific
// function it is about (sliced out by its own start/end markers), not run
// loose over the whole file, so a mutation in a different handler in the same
// file can't be mistaken for a pass here.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-worker-archive.mjs

import { readFileSync } from "node:fs";
import { hasWorkerHistory } from "@/lib/team/workerArchive";

let pass = 0;
const fails = [];
const ok = (label, cond) =>
  cond ? (pass++, console.log(`  ok  ${label}`)) : fails.push(label);

const read = (r) => readFileSync(new URL(r, import.meta.url), "utf8");
// Block comments, then line comments — same order check-booking-fee.mjs uses,
// because a line-comment strip run first can eat a `//` inside a block
// comment's own text and leave the rest of that block live as code.
const codeOf = (r) =>
  read(r)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

// Slice a named exported function's body out of a source string, up to the
// next top-level `export` (or EOF). Scoping every regex below to the actual
// handler it claims to test — not the whole file — is what stops a fix in
// GET from being mistaken for a fix in DELETE, or a comment two functions
// away from being mistaken for wiring.
function functionBody(source, exportSignature) {
  const start = source.indexOf(exportSignature);
  if (start === -1) throw new Error(`could not find ${exportSignature}`);
  const rest = source.slice(start + exportSignature.length);
  const next = rest.search(/\nexport (async function|function|const)/);
  return next === -1 ? rest : rest.slice(0, next);
}

console.log("\nhasWorkerHistory — the pure decision, hostile inputs");
ok("no history at all → false", hasWorkerHistory({}) === false);
ok("no history at all, explicit zeros → false",
  hasWorkerHistory({ payoutCount: 0, timeEntryCount: 0, payRunLineCount: 0 }) === false);
ok("a Payout alone → true", hasWorkerHistory({ payoutCount: 1 }) === true);
ok("a TimeEntry alone → true (the exact gap: paid by cheque, no Payout row)",
  hasWorkerHistory({ timeEntryCount: 1 }) === true);
ok("a PayRunLine alone → true (appeared on a run, whether or not it was disbursed)",
  hasWorkerHistory({ payRunLineCount: 1 }) === true);
ok("all three → true", hasWorkerHistory({ payoutCount: 3, timeEntryCount: 9, payRunLineCount: 1 }) === true);
ok("string counts from a raw count() coerce, not vacuously pass",
  hasWorkerHistory({ timeEntryCount: "2" }) === true);
ok("negative/garbage counts never READ as history",
  hasWorkerHistory({ payoutCount: -1, timeEntryCount: NaN, payRunLineCount: undefined }) === false);

console.log("\nDELETE /api/workers/[id] — the route actually asks all three tables");
const workerRoute = codeOf("../app/api/workers/[id]/route.js");
const del = functionBody(workerRoute, "export async function DELETE(request, { params }) {");
ok("imports the shared decision rather than re-deriving it",
  /import\s*\{[^}]*hasWorkerHistory[^}]*\}\s*from\s*["']@\/lib\/team\/workerArchive["']/.test(workerRoute));
ok("counts Payout for this worker", /db\.payout\.count\(\{\s*where:\s*\{\s*workerId:/.test(del));
ok("counts TimeEntry for this worker", /db\.timeEntry\.count\(\{\s*where:\s*\{\s*workerId:/.test(del));
ok("counts PayRunLine for this worker", /db\.payRunLine\.count\(\{\s*where:\s*\{\s*workerId:/.test(del));
ok("the hard-delete branch is gated on hasWorkerHistory(...)",
  /if\s*\(\s*hasWorkerHistory\(/.test(del));
ok("history → deactivated, not deleted",
  /hasWorkerHistory\([\s\S]*?active:\s*false[\s\S]*?deactivated:\s*true/.test(del));
// The exact regression this file exists for: a payouts-only check reappearing
// ALONGSIDE the real one (e.g. someone "restoring" the old fast path) would
// still pass every assertion above, since hasWorkerHistory would still be
// called — this catches the parallel decision being reintroduced.
ok("no leftover payouts-only branch deciding the outcome by itself",
  !/if\s*\(\s*(existing\.)?payouts?\.length\s*>\s*0\s*\)/.test(del));
ok("only ONE db.worker.delete in this handler, and it is the final line",
  (del.match(/db\.worker\.delete\(/g) || []).length === 1 &&
  /db\.worker\.delete\(\{\s*where:\s*\{\s*id:\s*_params\.id\s*\}\s*\}\);\s*\n\s*return NextResponse\.json\(\{\s*success:\s*true,\s*deleted:\s*true/.test(del));

console.log("\nRe-adding an archived worker reattaches — app/api/team/quick-add/route.js");
const quickAdd = codeOf("../app/api/team/quick-add/route.js");
const post = functionBody(quickAdd, "export async function POST(request) {");
ok("an ACTIVE duplicate is still refused",
  /existingWorker\?\.active/.test(post) && /status:\s*409/.test(post));
// The bug: `if (existingWorker)` with no `?.active` refuses BOTH active and
// inactive rows, which is how re-adding Jonny stayed impossible rather than
// reattaching. This regex requires the bare form to be entirely absent — an
// `existingWorker?.active` check earlier in the file does not satisfy it,
// because `?.active` breaks the `existingWorker)` adjacency this pattern
// requires.
ok("the old unconditional refusal (blocks reattaching an archived worker) is gone",
  !/if\s*\(\s*existingWorker\s*\)/.test(post));
// The reactivate-or-create write itself was factored out to
// lib/team/ensureWorker.js (resolveQuickAddWorker) — not to dodge this
// check, but because a Prisma call whose safety depends on an id the CALLER
// already proved company-scoped is exactly the shape rule 2 of
// scripts/tenantScopeScan.mjs recognises a "helper" for; see the comment on
// resolveQuickAddWorker itself. The route's job is just to call it and act on
// the result, which is what's asserted here; the write's own correctness is
// asserted directly below.
ok("the route calls the shared resolver rather than writing Worker itself",
  /const workerResult = await resolveQuickAddWorker\(\{/.test(post) &&
  !/db\.worker\.(update|create)\(/.test(post));
const ensureWorker = codeOf("../lib/team/ensureWorker.js");
const resolver = functionBody(ensureWorker, "export async function resolveQuickAddWorker({");
ok("an inactive match is reactivated via db.worker.update on its OWN id",
  /if\s*\(\s*existingWorker\s*\)\s*\{[\s\S]{0,60}db\.worker\.update\(\{\s*where:\s*\{\s*id:\s*existingWorker\.id\s*\}/.test(resolver));
ok("reactivation flips active back to true",
  /if\s*\(\s*existingWorker\s*\)[\s\S]{0,40}db\.worker\.update\(\{[\s\S]{0,120}active:\s*true/.test(resolver));
ok("a brand-new row is created with THIS company's id, never a caller-supplied one",
  /db\.worker\.create\(\{\s*data:\s*\{\s*companyId:\s*member\.companyId/.test(resolver));
ok("the resolver reports which branch ran, so the caller knows what's safe to roll back",
  /return\s*\{\s*worker,\s*created:\s*false\s*\}/.test(resolver) &&
  /return\s*\{\s*worker,\s*created:\s*true\s*\}/.test(resolver));
ok("a failed invite does NOT delete a REACTIVATED worker (only a brand-new one)",
  /if\s*\(\s*workerResult\.created\s*\)\s*\{\s*\n?\s*await db\.worker\.delete/.test(post));

console.log("\nPickers and historical pay-run lines — the reverse check");
const teamPage = codeOf("../app/app/settings/team/page.js");
ok("the no-login roster excludes archived workers, not just unlinked ones",
  /filter\(\s*\(?w\)?\s*=>\s*!w\.userId\s*&&\s*w\.active\s*!==\s*false/.test(teamPage));

const timesheetsPage = codeOf("../app/app/settings/team/timesheets/page.js");
ok("the manual time-entry worker picker already excludes inactive workers",
  /w\.filter\(\(x\)\s*=>\s*x\.active\s*!==\s*false\)/.test(timesheetsPage));

const buildPayRun = codeOf("../lib/payroll/buildPayRun.js");
ok("a NEW pay run is built only from active workers",
  /db\.worker\.findMany\(\{\s*where:\s*\{[\s\S]{0,60}active:\s*true/.test(buildPayRun));

const runDetail = codeOf("../app/api/payroll/runs/[id]/route.js");
ok("a past run's lines render from PayRunLine's OWN captured fields, never re-joined to Worker",
  // \bworker\b (not \bworkerName\b/\bworkerType\b — those are PayRunLine's
  // own captured columns, not a relation) would be how a re-join snuck back
  // in: `lines: { include: { worker: true } } }` or similar.
  !/\bworker\s*:/.test(runDetail));

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  console.error("\nFAILED:");
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
