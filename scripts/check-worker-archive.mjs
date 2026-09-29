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
//  2. DELETE /api/workers/[id] NEVER deletes (2026-09-29): it archives
//     (active:false) and answers { success, deactivated }, and nothing in
//     the app calls it. hasWorkerHistory() stays tested in (1) as the pure
//     rule it states, though the route no longer needs to ask it.
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
//  5. Ending employment (2026-09-29, "Jonny" again — removed from the team,
//     still on payroll, and no way to say he was dismissed or why):
//     parseSeparation / redactSeparation against hostile input; the
//     separation route's gates, transaction and private note; the Workers
//     page and Manage Team buttons call the right route with the right
//     body; the Edit form's PATCH body is byte-identical to before (md5 of
//     the serialised payload for fixed fixtures); the cancel-invitation
//     dialog's opt-in; every new string in every app language.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-worker-archive.mjs

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { hasWorkerHistory } from "@/lib/team/workerArchive";
import {
  SEPARATION_TYPES,
  SEPARATION_FIELDS,
  parseSeparation,
  parseCalendarDay,
  redactSeparation,
  isSeparated,
  separationNoteBody,
  splitSeparationNote,
  separationTypeKey,
} from "@/lib/team/separation";
import { parseNoteBody, NOTE_KINDS, SYSTEM_NOTE_KINDS } from "@/lib/hr/notes";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

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

// ── 2026-09-29: DELETE never deletes ─────────────────────────────────────
//
// It used to hard-delete a worker with no payouts / time entries / pay-run
// lines. That judged "no history" by three tables out of the dozen that
// cascade with a Worker (HR notes and documents, onboarding, shifts, leave),
// and the owner's rule is plain: no data deletion. It had no caller; it now
// always archives and answers the shape the history branch always did.
console.log("\nDELETE /api/workers/[id] — archives, never deletes");
const workerRoute = codeOf("../app/api/workers/[id]/route.js");
const del = functionBody(workerRoute, "export async function DELETE(request, { params }) {");
ok("DELETE never calls db.worker.delete (or deleteMany)",
  !/\.worker\.delete(Many)?\(/.test(del));
ok("no delete of any kind anywhere in the worker route",
  !/\.delete(Many)?\(/.test(workerRoute));
ok("DELETE archives this company's worker: active:false on the id it just found company-scoped",
  /db\.worker\.findFirst\(\{\s*where:\s*\{\s*id:\s*_params\.id,\s*companyId:\s*member\.companyId/.test(del) &&
  /db\.worker\.update\(\{\s*where:\s*\{\s*id:\s*_params\.id\s*\},\s*data:\s*\{\s*active:\s*false\s*\}/.test(del));
ok("DELETE answers the same success shape the archive branch always did",
  /return NextResponse\.json\(\{\s*success:\s*true,\s*deactivated:\s*true\s*\}\);\s*\}\s*$/.test(del.trim()));
ok("DELETE still refuses without user:manage",
  /requirePermission\(member\.role,\s*"user:manage"\)/.test(del));
// Nothing in the app sends DELETE here — asserted rather than remembered, so
// a new caller has to be looked at by whoever adds it.
{
  const { execFileSync } = await import("node:child_process");
  const root = new URL("..", import.meta.url).pathname;
  let hits = "";
  try {
    hits = execFileSync("grep", ["-rln", "--include=*.js", "-E", "method:\\s*\"DELETE\"", "app", "lib"], { cwd: root, encoding: "utf8" });
  } catch { hits = ""; }
  const callers = hits.split("\n").filter(Boolean).filter((f) => {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
    return /[`"']\/api\/workers\/\$\{[^}]+\}[`"']/.test(src) &&
      /method:\s*"DELETE"[\s\S]{0,5}/.test(src) &&
      /fetch(Json)?\(\s*`\/api\/workers\/\$\{[^}]+\}`\s*,\s*\{\s*method:\s*"DELETE"/.test(src);
  });
  ok(`DELETE /api/workers/[id] has no caller in app/ or lib/ (found: ${callers.join(", ") || "none"})`,
    callers.length === 0);
}

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

// ══ 5. Ending employment ════════════════════════════════════════════════
console.log("\nparseSeparation — hostile input");
const NOW = new Date("2026-09-29T15:00:00Z");
const good = { type: "dismissed", lastDay: "2026-09-29", explanation: "Repeated no-shows after two written warnings.", rehireEligible: false };
const p = (b, o = {}) => parseSeparation(b, { now: NOW, ...o });
ok("a complete, honest record parses", !!p(good).data && p(good).data.type === "dismissed");
ok("last day is stored as a UTC calendar day", p(good).data.lastDay.toISOString() === "2026-09-29T00:00:00.000Z");
ok("no type → refused (never defaulted to Quit)", p({ ...good, type: undefined }).field === "type");
ok("empty-string type → refused", p({ ...good, type: "" }).field === "type");
ok("an unknown type → refused", p({ ...good, type: "fired_lol" }).field === "type");
ok("a prototype key as type → refused", p({ ...good, type: "constructor" }).field === "type");
ok("a non-string type → refused", p({ ...good, type: ["dismissed"] }).field === "type");
ok("every offered type is accepted", SEPARATION_TYPES.every((type) => !!p({ ...good, type }).data));
ok("no last day → refused", p({ ...good, lastDay: undefined }).field === "lastDay");
ok("an impossible date (Feb 31) → refused, not rolled into March", p({ ...good, lastDay: "2026-02-31" }).field === "lastDay");
ok("a date with a time on it → refused", p({ ...good, lastDay: "2026-09-29T10:00" }).field === "lastDay");
ok("garbage → refused", p({ ...good, lastDay: "yesterday" }).field === "lastDay");
ok("a pre-1950 date → refused", p({ ...good, lastDay: "1901-01-01" }).field === "lastDay");
ok("60 days ahead → accepted (handed in notice)", !!p({ ...good, lastDay: "2026-11-28" }).data);
ok("a year ahead → refused (a typo in the year)", p({ ...good, lastDay: "2027-09-29" }).field === "lastDayFuture");
ok("before their start date → refused", p({ ...good, lastDay: "2026-01-01" }, { hiredOn: new Date("2026-03-01T00:00:00Z") }).field === "lastDayBeforeHire");
ok("ON their start date → accepted", !!p({ ...good, lastDay: "2026-03-01" }, { hiredOn: new Date("2026-03-01T00:00:00Z") }).data);
ok("an unparseable hiredOn is ignored, not a crash", !!p(good, { hiredOn: "nonsense" }).data);
ok("no explanation → refused", p({ ...good, explanation: undefined }).field === "explanation");
ok("whitespace-padded 9 chars → refused (trimmed first)", p({ ...good, explanation: "   fired it   " }).field === "explanation");
ok("an object as explanation → refused", p({ ...good, explanation: { toString: () => "long enough text here" } }).field === "explanation");
ok("an essay over the note limit → refused, not truncated", p({ ...good, explanation: "x".repeat(5001) }).field === "explanationLong");
ok("rehire true stays true", p({ ...good, rehireEligible: true }).data.rehireEligible === true);
ok("rehire false stays false", p({ ...good, rehireEligible: false }).data.rehireEligible === false);
ok("rehire unanswered is null, never a refusal", p({ ...good, rehireEligible: undefined }).data.rehireEligible === null);
ok("rehire 'false' (a string) is NOT read as a refusal", p({ ...good, rehireEligible: "false" }).data.rehireEligible === null);
ok("a null body → refused, not a crash", p(null).field === "type");
ok("parseCalendarDay refuses non-strings", parseCalendarDay(20260929) === null && parseCalendarDay(null) === null);

console.log("\nisSeparated / redactSeparation / the note's shape");
ok("inactive + separatedOn → separated", isSeparated({ active: false, separatedOn: new Date() }));
ok("re-activated keeps the history but is NOT separated", !isSeparated({ active: true, separatedOn: new Date() }));
ok("inactive with no reason on file is not 'separated'", !isSeparated({ active: false, separatedOn: null }));
const row = { id: "w1", name: "Jonny", active: false, separatedOn: new Date(), separationType: "dismissed", separationRehireEligible: false, separatedById: "m1" };
const stripped = redactSeparation(row, false);
ok("a non-HR caller gets none of the separation fields", SEPARATION_FIELDS.every((f) => !(f in stripped)));
ok("…and keeps everything else", stripped.id === "w1" && stripped.name === "Jonny" && stripped.active === false);
ok("…without mutating the row it was given", row.separationType === "dismissed");
ok("an HR manager gets the row untouched", redactSeparation(row, true) === row);
ok("redact passes null/garbage through", redactSeparation(null, false) === null && redactSeparation("x", false) === "x");
const body = separationNoteBody("Employment ended — Dismissed — last day worked 2026-09-29", "Line one.\n\nLine two of what happened.");
ok("the note splits back into header and the explanation VERBATIM (blank lines inside kept)",
  splitSeparationNote(body).header.startsWith("Employment ended") &&
  splitSeparationNote(body).explanation === "Line one.\n\nLine two of what happened.");
ok("a body with no header is all explanation", splitSeparationNote("just text").explanation === "just text");
ok("an unknown stored type labels as Other, not a raw key", separationTypeKey("nope") === "app.separation.type.other");

console.log("\nHR notes — the two system kinds can't be typed by hand");
ok("separation/reactivation are not in the picker's NOTE_KINDS",
  SYSTEM_NOTE_KINDS.every((k) => !NOTE_KINDS.includes(k)));
ok("POST /notes refuses a hand-typed 'separation' note", !!parseNoteBody({ kind: "separation", body: "fired" }).error);
ok("POST /notes refuses a hand-typed 'reactivation' note", !!parseNoteBody({ kind: "reactivation", body: "back" }).error);

console.log("\nPOST/GET /api/workers/[id]/separation");
const sepRoute = codeOf("../app/api/workers/[id]/separation/route.js");
const sepPost = functionBody(sepRoute, "export async function POST(request, { params }) {");
const sepGet = functionBody(sepRoute, "export async function GET(request, { params }) {");
ok("params awaited (Next 16)", /const \{ id \} = await params;/.test(sepPost) && /const \{ id \} = await params;/.test(sepGet));
ok("POST requires user:manage (the PATCH/HR gate)", /requirePermission\(member\.role,\s*"user:manage"\)/.test(sepPost));
ok("POST requires payroll admin (the Workers page's gate)", /if\s*\(\s*!isPayrollAdmin\(member\.role\)\s*\)/.test(sepPost));
ok("POST scopes the worker to the caller's company", /where:\s*\{\s*id,\s*companyId:\s*member\.companyId\s*\}/.test(sepPost));
ok("POST validates with the shared parser, against their start date", /parseSeparation\(raw,\s*\{\s*hiredOn:\s*worker\.hiredOn\s*\}\)/.test(sepPost));
ok("POST refuses to overwrite a current separation (409)", /if\s*\(\s*isSeparated\(worker\)\s*\)[\s\S]{0,400}status:\s*409/.test(sepPost));
const tx = sepPost.slice(sepPost.indexOf("db.$transaction"));
ok("the flip and the note are ONE transaction", /db\.\$transaction\(async \(tx\) =>/.test(sepPost) &&
  /tx\.worker\.update\(/.test(tx) && /tx\.workerNote\.create\(/.test(tx));
ok("the flip sets active:false and all four separation columns",
  /active:\s*false,\s*separatedOn:\s*data\.lastDay,\s*separationType:\s*data\.type,\s*separationRehireEligible:\s*data\.rehireEligible,\s*separatedById:\s*member\.id/.test(tx));
ok("the note is kind 'separation', private, never asks for a signature",
  /kind:\s*"separation"/.test(tx) && /visibleToWorker:\s*false/.test(tx) && /requiresAcknowledgement:\s*false/.test(tx));
ok("the explanation is NOT in the activity log summary or metadata",
  !/explanation/.test(sepPost.slice(sepPost.indexOf("recordActivity"))));
ok("no delete of any kind in the separation route", !/\.delete(Many)?\(/.test(sepRoute));
ok("GET sits behind the HR gate", /await hrManagerOrRefusal\(request\)/.test(sepGet));
ok("GET reads the note from THIS company only", /workerNote\.findFirst\(\{\s*where:\s*\{\s*companyId:\s*member\.companyId,\s*workerId:\s*worker\.id,\s*kind:\s*"separation"/.test(sepGet));
ok("the worker's own 'me' notes route still only serves visible notes (a separation is private)",
  /visibleToWorker:\s*true/.test(codeOf("../app/api/hr/me/notes/route.js")));

console.log("\nPATCH /api/workers/[id] — re-activation, and nothing else changed");
const patch = functionBody(workerRoute, "export async function PATCH(request, { params }) {");
ok("a reactivation note only when an INACTIVE worker is switched ON",
  /const reactivating = active === true && existing\.active === false;/.test(patch));
ok("…in the same transaction as the flip, private",
  /if \(reactivating\)[\s\S]*?db\.\$transaction[\s\S]*?tx\.worker\.update\(\{ where: \{ id: _params\.id \}, data \}\)[\s\S]*?kind:\s*"reactivation"[\s\S]*?visibleToWorker:\s*false/.test(patch));
ok("every other PATCH writes exactly the same data object, the old way",
  /\} else \{\s*updated = await db\.worker\.update\(\{ where: \{ id: _params\.id \}, data \}\);/.test(patch));
// The data object's entries, line for line (whitespace-trimmed), as they were
// before this change — only the `const data = {` opener replaced
// `db.worker.update({ where, data: {`. Baseline md5 taken from origin/main.
{
  const a = patch.indexOf("const data = {");
  const inner = a === -1 ? "" : patch.slice(a + "const data = {".length, patch.indexOf("\n  };", a));
  const norm = inner.split("\n").map((l) => l.trim()).filter(Boolean).join("\n");
  const md5 = createHash("md5").update(norm).digest("hex");
  ok(`PATCH's data object is unchanged (md5 ${md5})`, md5 === "5b8ac1f09fceee87b647bc7fd4598b49");
}

console.log("\nGET /api/workers and /api/workers/[id] — separation facts for HR only");
const listRoute = codeOf("../app/api/workers/route.js");
ok("the roster list strips them for non-HR callers",
  /const seesHr = canManageHr\(member\);/.test(listRoute) && /redactSeparation\(w,\s*seesHr\)/.test(listRoute));
ok("the single-worker read strips them too",
  /redactSeparation\(\s*redactPay\([\s\S]*?\),\s*canManageHr\(member\),?\s*\)/.test(functionBody(workerRoute, "export async function GET(request, { params }) {")));
ok("the explanation is never a Worker column (only the HR note holds it)",
  !/separationReason/.test(read("../prisma/schema.prisma")));

console.log("\nThe buttons — right route, right body");
const workersPage = read("../app/app/settings/team/workers/page.js");
const endComp = read("../app/components/team/EndEmployment.js");
ok("Workers rows offer End employment for active workers", /worker\.active !== false && onEnd && \(/.test(workersPage) && /t\("app\.separation\.endEmployment"\)/.test(workersPage));
ok("…Re-activate for inactive ones", /worker\.active === false && onReactivate && \(/.test(workersPage));
ok("…and 'record why' for inactive ones with no reason on file", /worker\.active === false && onEnd && !isSeparated\(worker\)/.test(workersPage));
ok("the actions are gated on canChange('payroll') (the page's own capability, never live under impersonation)",
  /const canEnd = access\.canChange\("payroll"\);/.test(workersPage) &&
  /onEnd=\{canEnd \? \(\) => setEnding\(w\) : null\}/.test(workersPage) &&
  /onReactivate=\{canEnd \? \(\) => setReactivating\(w\) : null\}/.test(workersPage));
ok("the page's own gate is still canSee('payroll')", /if \(!access\.canSee\("payroll"\)\) return <NoAccessPanel capability="payroll" \/>;/.test(workersPage));
ok("End employment POSTs to /api/workers/${id}/separation with separationPayload(form)",
  /fetchJson\(`\/api\/workers\/\$\{workerId\}\/separation`,\s*\{\s*method:\s*"POST",\s*body:\s*separationPayload\(form\),?\s*\}\)/.test(endComp));
ok("Re-activate PATCHes /api/workers/${id} with EXACTLY { active: true }",
  /fetchJson\(`\/api\/workers\/\$\{worker\.id\}`,\s*\{\s*method:\s*"PATCH",\s*body:\s*\{\s*active:\s*true\s*\},?\s*\}\)/.test(endComp));
ok("failures surface (fetchJson throws; both dialogs catch into an error line)",
  (endComp.match(/catch \(err\) \{\s*set(Error)\(/g) || []).length >= 2 && !/if \(res\.ok\)/.test(endComp));
// separationPayload, executed: extract the function and run it.
{
  const src = endComp.slice(endComp.indexOf("export function separationPayload(form) {"));
  const fnSrc = src.slice(0, src.indexOf("\n}\n") + 2).replace("export ", "");
  const separationPayload = new Function(`${fnSrc}; return separationPayload;`)();
  const out = separationPayload({ type: "quit", lastDay: "2026-09-29", explanation: "Moved away.", rehire: "yes", extra: "x" });
  ok("separationPayload sends exactly type, lastDay, explanation, rehireEligible",
    JSON.stringify(Object.keys(out)) === JSON.stringify(["type", "lastDay", "explanation", "rehireEligible"]) && out.rehireEligible === true);
  ok("…'no' → false, '' → null (unanswered is not a refusal)",
    separationPayload({ rehire: "no" }).rehireEligible === false && separationPayload({ rehire: "" }).rehireEligible === null);
  ok("…and it parses server-side as sent", !!parseSeparation(separationPayload({ type: "retired", lastDay: "2026-09-29", explanation: "Retired after 30 years.", rehire: "" }), { now: NOW }).data);
}
// The Edit form's PATCH body, serialised for fixed fixtures, md5'd. The
// baseline was taken from origin/main's page before this change.
{
  const start = workersPage.indexOf("async function save(e) {");
  const saveSrc = workersPage.slice(start, workersPage.indexOf("\n  if (editing) {", start));
  const at = saveSrc.indexOf("body: JSON.stringify(");
  let i = at + "body: JSON.stringify(".length, depth = 1;
  for (; i < saveSrc.length && depth; i++) {
    if (saveSrc[i] === "(") depth++;
    else if (saveSrc[i] === ")") depth--;
  }
  const build = new Function("form", `return (${saveSrc.slice(at + "body: JSON.stringify(".length, i - 1)});`);
  const fixtures = [
    { name: "Jonny", title: "", phone: "", hourlyRate: "", hiredOn: "", active: true, managerId: "", workType: "field", scheduledHoursPerWeek: "" },
    { name: "Ana", title: "Foreman", phone: "(514) 555-1234", hourlyRate: "26.5", hiredOn: "2024-03-01", active: false, managerId: "w1", workType: "office", scheduledHoursPerWeek: "37.5" },
  ];
  const md5 = createHash("md5").update(fixtures.map((f) => JSON.stringify(build(f))).join("\n")).digest("hex");
  ok(`the Edit form's PATCH body is byte-identical to before (md5 ${md5})`, md5 === "8bb4ef8f5b87f3d1f28a27915650f395");
  ok("the Edit form's Active checkbox is still there and still sends active",
    /checked=\{form\.active\}/.test(workersPage) && /t\("app\.setWorkers\.activeLabel"\)/.test(workersPage));
}

console.log("\nManage Team — no-login rows and the cancel-invitation dialog");
ok("no-login rows offer End employment, gated on canChange('payroll')",
  /const canEndEmployment = access\.canChange\("payroll"\);/.test(teamPage) &&
  /\{canEndEmployment && \(\s*<button[\s\S]{0,120}onClick=\{\(\) => setEndingWorker\(w\)\}/.test(teamPage));
ok("the dialog is the shared one", /<EndEmploymentDialog\s+worker=\{endingWorker\}/.test(teamPage));
ok("'also end their employment' starts UNticked, every time the dialog opens",
  /useState\(false\);\s*\n\s*const \[revokeSeparation/.test(teamPage) &&
  /function openRevoke\(pendingRow\) \{\s*setRevokeAlsoEnd\(false\);/.test(teamPage));
ok("…offered only when a linked worker exists AND the reader can end employment",
  /const linkedWorker = canEndEmployment \? linkedWorkerFor\(confirmRevoke\) : null;/.test(teamPage) &&
  /\{linkedWorker && \(/.test(teamPage));
ok("the link is the cancel route's own: same company roster, same email",
  /unlinkedWorkers\.find\(\(w\) => w\.email && w\.email === pendingRow\.email\)/.test(teamPage) &&
  /where:\s*\{\s*companyId:\s*member\.companyId,\s*email:\s*pending\.email\s*\}/.test(codeOf("../app/api/settings/members/pending/[id]/route.js")));
{
  const v = teamPage.indexOf("separationFormError(revokeSeparation");
  const d = teamPage.indexOf("`/api/settings/members/pending/${pendingRow.id}`, {\n        method: \"DELETE\"");
  ok("the form is validated BEFORE the cancel (no half-done state)", v >= 0 && d >= 0 && v < d);
}
ok("after the cancel succeeds it ends the worker the SERVER reported (workerKept.id)",
  /const kept = data\?\.workerKept;[\s\S]{0,200}submitSeparation\(t, kept\.id, revokeSeparation\)/.test(teamPage));
ok("…and says so when the separation fails, instead of claiming success",
  /catch \(err\) \{\s*setError\(t\("app\.separation\.cancelThenFailed"/.test(teamPage));
for (const [code, dict] of Object.entries(APP_MESSAGES)) {
  const bodyText = dict["app.setTeam.cancelInviteBody"] || "";
  ok(`${code}: the cancel dialog no longer sends people to a Remove that doesn't exist`,
    !!bodyText && !/remove that from Workers|supprimez-la|quítala|видаліть його|ਹਟਾਓ।|alisin iyon|entfernen Sie ihn|删掉|la rimuova/.test(bodyText));
}

console.log("\nEvery new string, every app language");
const newKeys = Object.keys(APP_MESSAGES.en).filter((k) => k.startsWith("app.separation.") || k === "app.hr.notes.kind.separation" || k === "app.hr.notes.kind.reactivation");
ok(`${newKeys.length} new keys defined in English`, newKeys.length >= 40);
ok("every separation type has a label", SEPARATION_TYPES.every((type) => typeof APP_MESSAGES.en[separationTypeKey(type)] === "string"));
for (const [code, dict] of Object.entries(APP_MESSAGES)) {
  const missing = newKeys.filter((k) => typeof dict[k] !== "string" || !dict[k].trim());
  ok(`${code}: all ${newKeys.length} keys present${missing.length ? ` (missing ${missing.slice(0, 3).join(", ")}…)` : ""}`, missing.length === 0);
  const badParams = newKeys.filter((k) => {
    const want = (APP_MESSAGES.en[k].match(/\{\w+\}/g) || []).sort().join();
    const got = (String(dict[k] || "").match(/\{\w+\}/g) || []).sort().join();
    return want !== got;
  });
  ok(`${code}: placeholders match English${badParams.length ? ` (${badParams.join(", ")})` : ""}`, badParams.length === 0);
}
// Every key the new screens ask for exists — a t() on an undefined key
// renders English in all nine languages while coverage reads 100%.
{
  const screens = [
    read("../app/components/team/EndEmployment.js"),
    read("../app/components/hr/SeparationSummary.js"),
    workersPage,
    read("../app/app/settings/team/page.js"),
  ].join("\n");
  const asked = [...new Set([...screens.matchAll(/t\(\s*"(app\.separation\.[\w.]+)"/g)].map((m) => m[1]))];
  const undefinedKeys = asked.filter((k) => !(k in APP_MESSAGES.en));
  ok(`every app.separation.* key the screens ask for exists (${asked.length} asked)`, undefinedKeys.length === 0);
}

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  console.error("\nFAILED:");
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
