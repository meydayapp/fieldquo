#!/usr/bin/env node
//
// scripts/check-sales-call-panel.mjs
//
//   npm run check:sales-call-panel
//
// The end of a call, from the rep's side — what the line logs by itself and
// what it leaves to the rep.
//
// ══ Why this file exists ═══════════════════════════════════════════════════
//
// 2026-09-14, a rep on the floor: "the client hung up, I can't call the next
// one." Her last attempt: answered 13:40:34, ended 13:40:34, no outcome. The
// panel demanded one before the next dial and drew the form on a tab she was
// not on, so all she saw was the refusal. Three things were wrong and each is
// asserted below: a hang-up nobody could argue with was left for the rep to
// type; the form lived only in the Disposition tab; and the refusal did not
// say what to press.
//
// ══ What is EXECUTED ═══════════════════════════════════════════════════════
//
// autoLogOutcome() is pure and takes the attempt row as the status webhook and
// the panel's `ended` post would have left it. Every branch is driven with a
// fake row: the far end dropping at zero seconds, at four, at forty-five; the
// rep's own Hang up; a no-answer, a busy tone, a failed leg; a completed leg
// whose "answered" event was lost; a handset dial nothing reports on; a row
// the carrier has not finished with. The structural half — the form drawn in
// the Dialer column, the undo strip, the grace timer — is asserted against the
// panel's source, scoped to the expression each lives in.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  AUTO_LOGGED_CODES,
  AUTO_LOG_GRACE_SECONDS,
  AUTO_LOG_MAX_TALK_SECONDS,
  AUTO_LOG_UNDO_SECONDS,
  DISPOSITIONS,
  DISPOSITION_ORDER,
  HUNG_UP_BY_PROSPECT,
  HUNG_UP_BY_REP,
  PROVIDER_ENDED,
  autoLogOutcome,
  dispositionOptions,
  endOfCall,
  isDisposition,
  planDisposition,
} from "@/lib/sales/calls/dispositions";
import { RETRY_RULES, RETRY_KIND_RETRY, nextAttempt } from "@/lib/sales/retryRules";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let passed = 0;
let failed = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  ✗ ${name}${got === undefined ? "" : `  — got: ${JSON.stringify(got)}`}`);
  }
}
function section(title) {
  console.log(`\n── ${title}`);
}
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}
const source = (rel) => stripComments(readFileSync(join(ROOT, rel), "utf8"));
/** From `from` to `to` inside a source, comment-stripped; "" when either is missing. */
function between(src, from, to) {
  const a = src.indexOf(from);
  if (a === -1) return "";
  const b = src.indexOf(to, a + from.length);
  return b === -1 ? src.slice(a) : src.slice(a, b);
}

const T0 = new Date("2026-09-14T13:40:00Z");
const secs = (n) => new Date(T0.getTime() + n * 1000);

// What /api/rep-dial/status would have written (app/api/rep-dial/status/route.js:
// answeredAt on "in-progress"/"completed", endedAt on "completed", talkSeconds
// from CallDuration on the terminal event) plus the panel's `ended` post.
const browserRow = (over) => ({ dialChannel: "browser", disposition: null, providerStatus: null, answeredAt: null, endedAt: null, talkSeconds: null, hungUpBy: null, ...over });

// ═══════════════════════════════════════════════════════════════════════════
section("1. hung_up is a real disposition with real consequences");
// ═══════════════════════════════════════════════════════════════════════════
ok("hung_up is in the table", isDisposition("hung_up"));
ok("…and in the picker order, beside the other line-reported outcomes", DISPOSITION_ORDER.indexOf("hung_up") === DISPOSITION_ORDER.indexOf("busy") + 1);
ok("…not reached: nobody spoke", DISPOSITIONS.hung_up.reached === false);
ok("…holds the claim like no_answer does", DISPOSITIONS.hung_up.claim === DISPOSITIONS.no_answer.claim);
ok("…needs no note and no callback, or it could not be written by a machine", !DISPOSITIONS.hung_up.requiresNote && !DISPOSITIONS.hung_up.requiresCallback);
ok("…has a retry rule of the retry kind", RETRY_RULES.hung_up?.kind === RETRY_KIND_RETRY);
ok("…that counts the dial as an attempt", nextAttempt({ outcome: "hung_up", attemptCount: 0, now: T0, timeZone: "America/Toronto" }).attemptCount === 1);
ok("…and does not ring straight back (longer than busy's fifteen minutes)", RETRY_RULES.hung_up.delayMinutes > RETRY_RULES.busy.delayMinutes);
ok("…and is exhausted at its ceiling", nextAttempt({ outcome: "hung_up", attemptCount: RETRY_RULES.hung_up.maxAttempts - 1, now: T0, timeZone: "America/Toronto" }).exhausted === true);
ok("planDisposition plans it with no words", planDisposition({ code: "hung_up", now: T0 }).ok === true);
{
  const langs = Object.keys(APP_MESSAGES);
  const missing = langs.filter((l) => !APP_MESSAGES[l]["app.salesCall.disposition.hung_up.label"] || !APP_MESSAGES[l]["app.salesCall.disposition.hung_up.hint"]);
  ok(`its label and hint exist in all ${langs.length} languages`, missing.length === 0, missing);
}
ok("the three line-reported outcomes are exactly no_answer, busy, hung_up", AUTO_LOGGED_CODES.slice().sort().join() === "busy,hung_up,no_answer");
ok("…and every one of them is a real disposition", AUTO_LOGGED_CODES.every(isDisposition));
ok("…still offered by dispositionOptions() (the picker filters; the vocabulary does not shrink)", dispositionOptions().some((d) => d.code === "hung_up"));

// ═══════════════════════════════════════════════════════════════════════════
section("2. autoLogOutcome — every branch, with the payloads the line sends");
// ═══════════════════════════════════════════════════════════════════════════
ok("the constants are what the floor was promised: 10 s talk, 5 s grace, 15 s undo", AUTO_LOG_MAX_TALK_SECONDS === 10 && AUTO_LOG_GRACE_SECONDS === 5 && AUTO_LOG_UNDO_SECONDS === 15);
ok("PROVIDER_ENDED is Twilio's five terminal statuses", PROVIDER_ENDED.slice().sort().join() === "busy,canceled,completed,failed,no-answer");

{
  // Rachel's row, exactly: answered and ended in the same second, no hangup report yet.
  const rachel = browserRow({ providerStatus: "completed", answeredAt: secs(34), endedAt: secs(34), talkSeconds: 0 });
  const v = autoLogOutcome(rachel);
  ok("answered and ended in the same second → hung_up (the report that stopped the floor)", v.code === "hung_up" && v.talkSeconds === 0, v);
}
{
  const v = autoLogOutcome(browserRow({ providerStatus: "completed", answeredAt: secs(0), endedAt: secs(4), talkSeconds: 4, hungUpBy: HUNG_UP_BY_PROSPECT }));
  ok("prospect dropped at 4 s → hung_up, with the seconds", v.code === "hung_up" && v.talkSeconds === 4 && v.reason === "prospect_hung_up", v);
}
{
  const v = autoLogOutcome(browserRow({ providerStatus: "completed", answeredAt: secs(0), endedAt: secs(9), talkSeconds: 9, hungUpBy: HUNG_UP_BY_PROSPECT }));
  ok("9 s is still a hang-up", v.code === "hung_up", v);
}
{
  const v = autoLogOutcome(browserRow({ providerStatus: "completed", answeredAt: secs(0), endedAt: secs(10), talkSeconds: 10, hungUpBy: HUNG_UP_BY_PROSPECT }));
  ok("10 s is a conversation — not auto-logged, reason 'talked'", v.code === null && v.reason === "talked" && v.talkSeconds === 10, v);
}
{
  const v = autoLogOutcome(browserRow({ providerStatus: "completed", answeredAt: secs(0), endedAt: secs(45), talkSeconds: 45, hungUpBy: HUNG_UP_BY_PROSPECT }));
  ok("45 s talk, prospect hung up → the rep is asked (a conversation happened)", v.code === null && v.reason === "talked", v);
}
{
  const v = autoLogOutcome(browserRow({ providerStatus: "completed", answeredAt: secs(0), endedAt: secs(2), talkSeconds: 2, hungUpBy: HUNG_UP_BY_REP }));
  ok("the REP hung up at 2 s → never auto-logged; they were there", v.code === null && v.reason === "rep_hung_up", v);
}
{
  const v = autoLogOutcome(browserRow({ providerStatus: "no-answer" }));
  ok("never connected, status no-answer → no_answer", v.code === "no_answer" && v.reason === "no-answer", v);
}
{
  const v = autoLogOutcome(browserRow({ providerStatus: "busy" }));
  ok("never connected, status busy → busy", v.code === "busy", v);
}
for (const status of ["failed", "canceled"]) {
  const v = autoLogOutcome(browserRow({ providerStatus: status }));
  ok(`never connected, status ${status} → no_answer (the closest word the table has)`, v.code === "no_answer" && v.reason === status, v);
}
{
  const v = autoLogOutcome(browserRow({ providerStatus: "ringing" }));
  ok("still ringing (no terminal status) → not_reported, ask again", v.code === null && v.reason === "not_reported", v);
}
{
  const v = autoLogOutcome(browserRow({ providerStatus: "in-progress", answeredAt: secs(0), hungUpBy: HUNG_UP_BY_PROSPECT }));
  ok("browser says the prospect dropped but the carrier has not ended it → not_reported (never trusts the browser's clock)", v.code === null && v.reason === "not_reported", v);
}
{
  const v = autoLogOutcome(browserRow({ providerStatus: "completed", answeredAt: null, endedAt: secs(30), talkSeconds: 30 }));
  ok("completed with no answered stamp (the answered event was lost) → the rep is asked, never a guess", v.code === null && v.reason === "not_reported", v);
}
{
  const v = autoLogOutcome(browserRow({ providerStatus: "completed", answeredAt: secs(0), endedAt: secs(3), talkSeconds: null }));
  ok("no CallDuration but both stamps → talk is the gap (3 s) → hung_up", v.code === "hung_up" && v.talkSeconds === 3, v);
}
{
  const v = autoLogOutcome({ ...browserRow({ providerStatus: "no-answer" }), dialChannel: "handset" });
  ok("a handset dial is never auto-logged, whatever the row says", v.code === null && v.reason === "handset", v);
}
{
  const v = autoLogOutcome(browserRow({ providerStatus: "no-answer", disposition: "voicemail" }));
  ok("a row already written up is left alone", v.code === null && v.reason === "already_logged", v);
}
ok("garbage in → null out, with a reason", autoLogOutcome(null).code === null && autoLogOutcome("x").code === null && autoLogOutcome(undefined).reason === "no_row");
ok("every code autoLogOutcome can produce is in AUTO_LOGGED_CODES", ["hung_up", "no_answer", "busy"].every((c) => AUTO_LOGGED_CODES.includes(c)));

// ═══════════════════════════════════════════════════════════════════════════
section("3. endOfCall — the sentence the history row prints");
// ═══════════════════════════════════════════════════════════════════════════
{
  const e = endOfCall(browserRow({ hungUpBy: HUNG_UP_BY_PROSPECT, answeredAt: secs(0), endedAt: secs(4), talkSeconds: 4 }));
  ok("they hung up · 4 s", e?.key === "app.salesCall.ended.prospect" && e.talkSeconds === 4, e);
  const r = endOfCall(browserRow({ hungUpBy: HUNG_UP_BY_REP, answeredAt: secs(0), endedAt: secs(90), talkSeconds: 90 }));
  ok("you hung up · 90 s", r?.key === "app.salesCall.ended.rep" && r.talkSeconds === 90, r);
  ok("busy", endOfCall(browserRow({ providerStatus: "busy" }))?.key === "app.salesCall.ended.busy");
  ok("no answer", endOfCall(browserRow({ providerStatus: "no-answer" }))?.key === "app.salesCall.ended.noAnswer");
  ok("failed / canceled → did not connect", endOfCall(browserRow({ providerStatus: "failed" }))?.key === "app.salesCall.ended.failed" && endOfCall(browserRow({ providerStatus: "canceled" }))?.key === "app.salesCall.ended.failed");
  ok("nothing known → null, not an invented sentence", endOfCall(browserRow({})) === null && endOfCall(null) === null);
  const keys = ["app.salesCall.ended.prospect", "app.salesCall.ended.rep", "app.salesCall.ended.busy", "app.salesCall.ended.noAnswer", "app.salesCall.ended.failed", "app.salesCall.ended.withTalk"];
  const missing = Object.keys(APP_MESSAGES).flatMap((l) => keys.filter((k) => !APP_MESSAGES[l][k]).map((k) => `${l}:${k}`));
  ok("every sentence it can name exists in every language", missing.length === 0, missing);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The server: who hung up, and the line's write");
// ═══════════════════════════════════════════════════════════════════════════
{
  const store = source("lib/sales/calls/store.js");
  const end = between(store, "export async function recordCallEnd(", "\nexport ");
  ok("recordCallEnd writes hungUpBy once — the WHERE requires it null", /hungUpBy: null/.test(end) && /data: \{ hungUpBy/.test(end));
  ok("…scoped to the rep's own attempt", /salesRepId,/.test(end) || /salesRepId /.test(end));
  ok("…and refuses any value but rep / prospect", /HUNG_UP_BY_REP/.test(end) && /HUNG_UP_BY_PROSPECT/.test(end));
  const auto = between(store, "export async function autoLogAttempt(", "\nexport ");
  ok("autoLogAttempt reads the row fresh and runs autoLogOutcome on it", /findFirst/.test(auto) && /autoLogOutcome\(row\)/.test(auto));
  ok("…and writes through saveDisposition with autoLogged: true — same plan, same claim, same retry rule", /saveDisposition\(\{[^}]*autoLogged: true/.test(auto));
  const save = between(store, "export async function saveDisposition(", "\nexport ");
  ok("saveDisposition stamps dispositionAutoLogged from the flag", /dispositionAutoLogged: autoLogged === true/.test(save));
  ok("…a rep's correction runs the retry rule against the count from BEFORE the auto-log", /attemptCount: Math\.max\(0, Number\(pool\.attemptCount \|\| 0\) - 1\)/.test(save));
  ok("…and the line never overwrites anything, its own outcome included", /existing\.dispositionAutoLogged === true && !autoLogged/.test(save));
  const attach = between(store, "export async function attachProviderCall(", "\nexport ");
  ok("attachProviderCall records the carrier's terminal status as the end reason for a call that never connected", /data\.endReason = providerStatus/.test(attach) && /providerStatus !== "completed"/.test(attach));

  const route = source("app/api/sales/calls/route.js");
  ok("the route knows the two actions", /"ended", "auto_log"/.test(route));
  const ended = between(route, 'if (action === "ended")', 'if (action === "auto_log")');
  ok("…`ended` goes through recordCallEnd with the rep's id", /recordCallEnd\(\{[\s\S]*salesRepId: rep\.id/.test(ended));
  const autoRoute = between(route, 'if (action === "auto_log")', 'if (action === "autodial")');
  ok("…`auto_log` goes through autoLogAttempt and moves the rep to available on success", /autoLogAttempt\(\{ salesRepId: rep\.id/.test(autoRoute) && /STATE_AVAILABLE/.test(autoRoute));
  ok("…and answers a refusal as data (ok:false + reason), not as an HTTP error", /ok: result\.ok,/.test(autoRoute) && /reason: result\.reason/.test(autoRoute));
  ok("GET's pendingAttempt carries what the panel needs to ask at once", /dialChannel: row\.dialChannel/.test(route) && /hungUpBy: row\.hungUpBy/.test(route) && /providerStatus: row\.providerStatus/.test(route));

  const schema = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");
  const model = between(schema, "model SalesCallAttempt {", "\nmodel ");
  ok("the three columns exist on SalesCallAttempt, additive", /dispositionAutoLogged Boolean @default\(false\)/.test(model) && /hungUpBy String\?/.test(model) && /endReason String\?/.test(model));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The panel: the form where the rep is, the grace, the undo");
// ═══════════════════════════════════════════════════════════════════════════
{
  const panel = source("app/components/sales/CallPanel.js");
  const hang = between(panel, "function hangUp()", "\n  }");
  ok("Hang up sets hungUpBy = rep BEFORE it disconnects", (() => {
    const set = hang.indexOf("hungUpByRef.current = HUNG_UP_BY_REP");
    const disc = hang.indexOf("disconnect");
    return set !== -1 && disc !== -1 && set < disc;
  })());
  const onDisconnect = between(panel, 'call.on("disconnect"', 'call.on("error"');
  ok("`disconnect` posts who hung up: rep if the button was pressed, else prospect", /HUNG_UP_BY_REP \? HUNG_UP_BY_REP : HUNG_UP_BY_PROSPECT/.test(onDisconnect) && /action: "ended"/.test(onDisconnect));
  ok("…and arms the auto-ask with the grace, except for the rep's own hang-up", /autoAsk: hungUpBy !== HUNG_UP_BY_REP/.test(onDisconnect) && /graceMs: AUTO_LOG_GRACE_SECONDS \* 1000/.test(onDisconnect));
  const timer = between(panel, "const autoAskSeen = useRef(null);", "useEffect(() => {\n    if (!flash)");
  ok("the timer stays out of it once the rep has started typing", /if \(codeRef\.current \|\| noteRef\.current\) return;/.test(timer));
  ok("…posts auto_log after the grace", /action: "auto_log"/.test(timer) && /setTimeout\(ask, Math\.max\(0, Number\(pending\.graceMs\)/.test(timer));
  ok("…asks again while the carrier has not reported, a bounded number of times", /reason === "not_reported" && tries < 5/.test(timer));
  ok("…and on success clears the pending call, opens the undo strip for AUTO_LOG_UNDO_SECONDS, and frees the dialler (refresh, load, onWorked)", /setAutoLogged\(\{ attemptId, code: body\.code[^}]*until: Date\.now\(\) \+ AUTO_LOG_UNDO_SECONDS \* 1000/.test(timer) && /await presenceRef\.current\.refresh\(\);\s*await load\(\);\s*onWorked\?\.\(\);/.test(timer));
  const load = between(panel, "const load = useCallback(async () => {", "}, []);");
  ok("a call that ended while nobody was looking is asked about on load, at once, browser dials only", /autoAsk: row\.dialChannel === "browser" && \(Boolean\(row\.endedAt\) \|\| PROVIDER_ENDED\.includes\(row\.providerStatus\)\)/.test(load) && /graceMs: 0/.test(load));

  const change = between(panel, "function changeAutoLogged()", "\n  }");
  ok("Change reopens the form on the same attempt, marked as an override, and never re-arms the auto-ask", /override: autoLogged\.code/.test(change) && /autoAsk: false/.test(change));

  // The form is drawn in the Dialer column AND the tab — `both()`, not `into()`.
  const form = between(panel, "{!startedAt && pending", "{/* ── What the line logged by itself");
  ok("the outcome form is rendered through both() — inline in the Dialer column and again in the Disposition slot", /\? both\(slots\?\.disposition \|\| null, \(inline\) =>/.test(form));
  ok("…the inline copy carries data-call-disposition=\"dialer\" and the scroll ref; the tab copy carries \"tab\"", /data-call-disposition=\{inline \? "dialer" : "tab"\}/.test(form) && /ref=\{inline \? formRef : null\}/.test(form));
  const bothFn = between(panel, "const both = (slot, render) =>", "\n  );");
  ok("both() renders inline first and portals a second copy only when the slot exists", /render\(true\)/.test(bothFn) && /slot \? createPortal\(render\(false\), slot\) : null/.test(bothFn));
  const strip = between(panel, "{autoLogged && !pending && !startedAt", "{/* ── The call button");
  ok("the undo strip is in both places too, names the outcome, and its button is Change", /both\(slots\?\.disposition \|\| null/.test(strip) && /app\.salesCall\.autoLoggedAs/.test(strip) && /onClick=\{changeAutoLogged\}/.test(strip));
  ok("the strip auto-dismisses at `until`", /setTimeout\(\(\) => setAutoLogged\(null\), ms\)/.test(panel));
  ok("the Call button is back once pending is null (the dialler is free)", /\{!startedAt && !pending \? \(/.test(panel));

  const refusal = between(panel, "const dialRequestSeen = useRef(null);", "function hangUp()");
  ok("a refused dial press says the sentence, flashes the form and scrolls to it", /app\.salesCall\.dialWhileBusy/.test(refusal) && /setFlash\(\(n\) => n \+ 1\)/.test(refusal) && /formRef\.current\?\.scrollIntoView/.test(refusal));
  const en = APP_MESSAGES.en["app.salesCall.dialWhileBusy"];
  ok("…and the sentence says what to press, in English", /choose what happened below/.test(en) && /hang-up is logged by itself/.test(en), en);
  const stale = Object.keys(APP_MESSAGES).filter((l) => /finish that first|terminez d’abord cela|termina eso primero/.test(APP_MESSAGES[l]["app.salesCall.dialWhileBusy"] || ""));
  ok("…and no language still carries the old bare refusal", stale.length === 0, stale);
  const newKeys = ["app.salesCall.autoLoggedAs", "app.salesCall.autoLoggedChange", "app.salesCall.changeAutoLoggedBody", "app.salesCall.autoLogPending"];
  const missing = Object.keys(APP_MESSAGES).flatMap((l) => newKeys.filter((k) => !APP_MESSAGES[l][k]).map((k) => `${l}:${k}`));
  ok("the strip's and the form's new sentences exist in every language", missing.length === 0, missing);
}

console.log(`\ncheck-sales-call-panel: ${passed} passed, ${failed} failed`);
if (failed) {
  console.log("Failed:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
