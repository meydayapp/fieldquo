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
  INBOUND_DAY_END_CODES,
  LIVE_AUTO_LOGGED_CODES,
  dayEndOutcome,
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
import {
  CALL_BACK_DEFAULT_WHEN,
  WHEN_IN_AN_HOUR,
  WHEN_KINDS,
  CHOICE_CALL_BACK,
  CHOICE_KEYS,
  CHOICE_NOT_NOW,
  CHOICE_NO_CALLBACKS,
  CHOICE_SENT_LINK,
  CHOICE_VOICEMAIL,
  CHOICE_TEXT_INSTEAD,
  CHOICE_WRONG_OR_NOT_BUSINESS,
  MORE_CHOICE_KEYS,
  OFFERED_CODES,
  OUTCOME_CHOICES,
  OUTCOME_NOTE_MAX,
  PRIMARY_CHOICE_KEYS,
  WHEN_LATER_TODAY,
  WHEN_PICK,
  WHEN_TOMORROW,
  WHICH_NOT_A_BUSINESS,
  WHICH_WRONG_NUMBER,
  callbackTimeFor,
  choiceCoverage,
  choiceForCode,
  foldChoice,
} from "@/lib/sales/calls/outcomeChoices";
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
ok("the line-reported outcomes are the live three (no_answer, busy, hung_up) plus the inbound day-end two (reached, missed)", AUTO_LOGGED_CODES.slice().sort().join() === "busy,hung_up,missed,no_answer,reached" && LIVE_AUTO_LOGGED_CODES.slice().sort().join() === "busy,hung_up,no_answer" && INBOUND_DAY_END_CODES.slice().sort().join() === "hung_up,missed,reached");
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
  ok("the REP hung up a CONNECTED call at 2 s → never auto-logged; they were there (and talkSeconds says it connected)", v.code === null && v.reason === "rep_hung_up" && v.talkSeconds === 2, v);
  const ringing = autoLogOutcome(browserRow({ providerStatus: "canceled", hungUpBy: HUNG_UP_BY_REP }));
  ok("the rep hung up while it was still RINGING (Twilio: canceled) → no_answer by the line; nothing unanswered reaches the rep", ringing.code === "no_answer" && ringing.reason === "canceled", ringing);
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
  ok("the timer stays out of it once the rep has started typing", /if \(draftStarted\(draftRef\.current\)\) return;/.test(timer));
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

// ═══════════════════════════════════════════════════════════════════════════
section("6. The owner's six buttons — presentation over the vocabulary");
// ═══════════════════════════════════════════════════════════════════════════
// Five primary since 2026-09-18: "Text me instead" joined the owner's four
// (a company that would rather text was the answer the reps were hearing
// and had no button for). The four keep their order and their keys.
ok("five primary, in the owner's order: Sent the link, Call back, Not now, Left a voicemail — then Text me instead", PRIMARY_CHOICE_KEYS.join() === [CHOICE_SENT_LINK, CHOICE_CALL_BACK, CHOICE_NOT_NOW, CHOICE_VOICEMAIL, CHOICE_TEXT_INSTEAD].join());
ok("exactly two under More: Requested no call-backs, Wrong number / not a business", MORE_CHOICE_KEYS.join() === [CHOICE_NO_CALLBACKS, CHOICE_WRONG_OR_NOT_BUSINESS].join());
ok("keys 1–5 on the primary five, none on More", OUTCOME_CHOICES.filter((c) => c.primary).map((c) => c.hotkey).join() === "1,2,3,4,5" && OUTCOME_CHOICES.filter((c) => !c.primary).every((c) => c.hotkey === null));
{
  // "Text me instead" — the code, its rule, and what the panel does on save.
  const f = foldChoice({ key: CHOICE_TEXT_INSTEAD, note: "prefers text" });
  ok("Text me instead → text_instead, note kept, no callback", f.ok && f.code === "text_instead" && f.note === "prefers text" && f.callbackAt === null, f);
  ok("text_instead is reached, HOLDS the claim, marks the lead contacted, suppresses nothing", DISPOSITIONS.text_instead.reached === true && DISPOSITIONS.text_instead.claim === "hold" && DISPOSITIONS.text_instead.leadStatus === "contacted" && DISPOSITIONS.text_instead.doNotContact === false);
  ok("…and its retry rule is FINAL — no re-dial for somebody who asked to be texted", RETRY_RULES.text_instead?.kind === "final" && RETRY_RULES.text_instead.delayMinutes === null);
  ok("…and it is in the picker's order, after callback", DISPOSITION_ORDER.indexOf("text_instead") === DISPOSITION_ORDER.indexOf("callback") + 1);
  const panelSrc = source("app/components/sales/CallPanel.js");
  ok("the call panel opens the composer on save — the Text them door, then the thread", /if \(fold\.code === "text_instead"\) \{/.test(panelSrc) && /await openTextThread\(\{\s*e164: pending\.toE164 \|\| phoneE164,/.test(panelSrc) && /router\.push\(href\)/.test(panelSrc));
  ok("…AFTER the outcome is saved, never instead of it", panelSrc.indexOf('if (fold.code === "text_instead") {') > panelSrc.indexOf('action: "disposition",'));
  const langs = Object.keys(APP_MESSAGES);
  const missingKeys = langs.flatMap((l) => ["app.salesCall.choice.text_instead.label", "app.salesCall.choice.text_instead.hint", "app.salesCall.disposition.text_instead.label", "app.salesCall.disposition.text_instead.hint", "app.salesText.textThem", "app.salesText.textThemNamed", "app.salesText.ratherText", "app.salesDial.callerTextThem"].filter((k) => !APP_MESSAGES[l][k]).map((k) => `${l}:${k}`));
  ok("the button, the outcome and the Text them control exist in every language", missingKeys.length === 0, missingKeys);
}
{
  const cov = choiceCoverage();
  ok("every code a button can become is a real disposition", cov.unknown.length === 0, cov.unknown);
  ok("the line's three (no_answer, busy, hung_up) are NOT offered", cov.autoOffered.length === 0, cov.autoOffered);
  ok("…and with the line's three, the buttons reach every outcome in the table — nothing became unreachable", cov.unreachable.length === 0, cov.unreachable);
  ok("OFFERED_CODES is exactly the table minus the line's three", OFFERED_CODES.slice().sort().join() === DISPOSITION_ORDER.filter((c) => !AUTO_LOGGED_CODES.includes(c)).sort().join());
}
ok("the folds are the real codes: Call back → callback | gatekeeper | reached_interested; Wrong/not a business → bad_number | not_a_fit", OUTCOME_CHOICES.find((c) => c.key === CHOICE_CALL_BACK).folds.join() === "callback,gatekeeper,reached_interested" && OUTCOME_CHOICES.find((c) => c.key === CHOICE_WRONG_OR_NOT_BUSINESS).folds.join() === "bad_number,not_a_fit");
ok("Not now → reached_not_interested (the stored code is unchanged; only the words moved)", OUTCOME_CHOICES.find((c) => c.key === CHOICE_NOT_NOW).folds.join() === "reached_not_interested" && DISPOSITIONS.reached_not_interested.label === "Not now");
ok("Requested no call-backs → do_not_call, the one suppression code", OUTCOME_CHOICES.find((c) => c.key === CHOICE_NO_CALLBACKS).folds.join() === "do_not_call" && DISPOSITIONS.do_not_call.doNotContact === true);
ok("the note is capped at 280", OUTCOME_NOTE_MAX === 280);

// ── foldChoice, every branch ─────────────────────────────────────────────
{
  const f = foldChoice({ key: CHOICE_SENT_LINK, note: "  they said yes  ", now: T0 });
  ok("Sent the link → agreed_link_sent, note trimmed", f.ok && f.code === "agreed_link_sent" && f.note === "they said yes" && f.callbackAt === null, f);
  ok("…and planDisposition accepts what the fold produced", planDisposition({ code: f.code, note: f.note, callbackAt: f.callbackAt, now: T0 }).ok === true);
}
ok("Left a voicemail → voicemail", foldChoice({ key: CHOICE_VOICEMAIL, now: T0 }).code === "voicemail");
{
  const f = foldChoice({ key: CHOICE_NOT_NOW, note: "call after the season", now: T0 });
  ok("Not now → reached_not_interested with the objection as the note", f.ok && f.code === "reached_not_interested" && f.note === "call after the season", f);
  ok("…which planDisposition plans, holding the claim", planDisposition({ code: f.code, note: f.note, now: T0 }).ok === true && planDisposition({ code: f.code, note: f.note, now: T0 }).prospect.claimExpiresAt instanceof Date);
}
{
  const later = foldChoice({ key: CHOICE_CALL_BACK, whenKind: WHEN_LATER_TODAY, now: T0 });
  ok("Call back · later today → callback three hours on", later.ok && later.code === "callback" && later.callbackAt.getTime() === T0.getTime() + 3 * 60 * 60 * 1000, later);
  ok("…and planDisposition accepts it", planDisposition({ code: later.code, callbackAt: later.callbackAt, now: T0 }).ok === true);
  const tmrw = foldChoice({ key: CHOICE_CALL_BACK, whenKind: WHEN_TOMORROW, now: T0 });
  const expect = callbackTimeFor(WHEN_TOMORROW, { now: T0 });
  ok("Call back · tomorrow → callback at 10:00 the next day (the caller's zone)", tmrw.ok && tmrw.code === "callback" && tmrw.callbackAt.getTime() === expect.getTime() && expect.getHours() === 10 && expect.getTime() > T0.getTime(), tmrw);
  const pick = foldChoice({ key: CHOICE_CALL_BACK, whenKind: WHEN_PICK, whenAt: "2026-09-16T15:00:00Z", now: T0 });
  ok("Call back · pick → callback at the chosen time", pick.ok && pick.code === "callback" && pick.callbackAt.toISOString() === "2026-09-16T15:00:00.000Z", pick);
  const badPick = foldChoice({ key: CHOICE_CALL_BACK, whenKind: WHEN_PICK, whenAt: "not a date", now: T0 });
  ok("Call back · pick with an unreadable time → refused with the key", !badPick.ok && badPick.reasonKey === "app.salesCall.choice.call_back.needsTime", badPick);
  const gk = foldChoice({ key: CHOICE_CALL_BACK, notOwner: true, now: T0 });
  ok("Call back · no time · not the owner → gatekeeper", gk.ok && gk.code === "gatekeeper" && gk.callbackAt === null, gk);
  const int = foldChoice({ key: CHOICE_CALL_BACK, interested: true, now: T0 });
  ok("Call back · no time · interested → reached_interested", int.ok && int.code === "reached_interested", int);
  const neither = foldChoice({ key: CHOICE_CALL_BACK, now: T0 });
  ok("Call back · no time · nothing ticked → refused, never a callback at an invented hour", !neither.ok && neither.reasonKey === "app.salesCall.choice.call_back.needsTimeOrTick", neither);
  const both = foldChoice({ key: CHOICE_CALL_BACK, notOwner: true, interested: true, now: T0 });
  ok("Call back · no time · both ticked → refused (one or the other)", !both.ok && both.reasonKey === "app.salesCall.choice.call_back.needsTimeOrTick", both);
  const timed = foldChoice({ key: CHOICE_CALL_BACK, whenKind: WHEN_LATER_TODAY, notOwner: true, now: T0 });
  ok("Call back · with a time · a tick as well → the time wins; it is a callback", timed.ok && timed.code === "callback", timed);
}
{
  const empty = foldChoice({ key: CHOICE_NO_CALLBACKS, note: "   ", now: T0 });
  ok("Requested no call-backs with no words → refused", !empty.ok && empty.reasonKey === "app.salesCall.choice.no_callbacks.needsWords", empty);
  const said = foldChoice({ key: CHOICE_NO_CALLBACKS, note: "take me off your list", now: T0 });
  ok("…with their words → do_not_call, and planDisposition writes the suppression", said.ok && said.code === "do_not_call" && planDisposition({ code: said.code, note: said.note, now: T0 }).suppression?.channels.join() === "phone");
}
{
  const which = foldChoice({ key: CHOICE_WRONG_OR_NOT_BUSINESS, now: T0 });
  ok("Wrong number / not a business with nothing chosen → refused", !which.ok && which.reasonKey === "app.salesCall.choice.wrong_or_not_business.needsWhich", which);
  const wrong = foldChoice({ key: CHOICE_WRONG_OR_NOT_BUSINESS, which: WHICH_WRONG_NUMBER, now: T0 });
  ok("…wrong number → bad_number, no words needed", wrong.ok && wrong.code === "bad_number", wrong);
  const nb = foldChoice({ key: CHOICE_WRONG_OR_NOT_BUSINESS, which: WHICH_NOT_A_BUSINESS, now: T0 });
  ok("…not a business, no words → refused", !nb.ok && nb.reasonKey === "app.salesCall.choice.wrong_or_not_business.needsWords", nb);
  const nb2 = foldChoice({ key: CHOICE_WRONG_OR_NOT_BUSINESS, which: WHICH_NOT_A_BUSINESS, note: "a franchise head office", now: T0 });
  ok("…not a business, with words → not_a_fit", nb2.ok && nb2.code === "not_a_fit" && planDisposition({ code: nb2.code, note: nb2.note, now: T0 }).ok === true, nb2);
}
ok("a note longer than 280 is clipped, not refused", foldChoice({ key: CHOICE_VOICEMAIL, note: "x".repeat(500), now: T0 }).note.length === OUTCOME_NOTE_MAX);
ok("an unknown key → refused with a key, never a code", (() => { const f = foldChoice({ key: "made_up", now: T0 }); return !f.ok && f.code === null && f.reasonKey === "app.salesCall.choice.unknown"; })() && !foldChoice({}).ok && !foldChoice(null).ok);
ok("choiceForCode maps a stored code back to its button, and the line's codes to none", choiceForCode("gatekeeper")?.key === CHOICE_CALL_BACK && choiceForCode("not_a_fit")?.key === CHOICE_WRONG_OR_NOT_BUSINESS && choiceForCode("hung_up") === null);
{
  const langs = Object.keys(APP_MESSAGES);
  const missing = langs.flatMap((l) => CHOICE_KEYS.filter((k) => !APP_MESSAGES[l][`app.salesCall.choice.${k}.label`]).map((k) => `${l}:${k}`));
  ok(`every button has a label in all ${langs.length} languages`, missing.length === 0, missing);
  ok("FR and ES carry the owner's wording for option 5", APP_MESSAGES.fr["app.salesCall.choice.no_callbacks.label"] === "A demandé de ne plus être rappelé" && APP_MESSAGES.es["app.salesCall.choice.no_callbacks.label"] === "Pidió que no lo vuelvan a llamar");
  ok("…and the stored code's own label says the same in English", APP_MESSAGES.en["app.salesCall.disposition.do_not_call.label"] === "Requested no call-backs" && APP_MESSAGES.en["app.salesCall.disposition.reached_not_interested.label"] === "Not now");
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The pop-up: after an answered call ended, never on connect, never a wall");
// ═══════════════════════════════════════════════════════════════════════════
{
  const panel = source("app/components/sales/CallPanel.js");
  const form = source("app/components/sales/OutcomeForm.js");
  ok("the picker is OutcomeForm, in all three places (Dialer column / tab through both(), and the sheet)", (panel.match(/<OutcomeForm /g) || []).length === 2 && /both\(slots\?\.disposition \|\| null, \(inline\) =>/.test(panel) && /<OutcomeSheet/.test(panel));
  ok("…and no copy of the panel still renders a <select> of dispositions", !/<select/.test(panel) && !/<select/.test(form));
  const timer = between(panel, "const autoAskSeen = useRef(null);", "useEffect(() => {\n    if (!flash)");
  ok("the sheet opens ONLY from the auto-log reply: reason talked | rep_hung_up AND a numeric talkSeconds (connected)", /\(body\?\.reason === "talked" \|\| body\?\.reason === "rep_hung_up"\) && typeof body\?\.talkSeconds === "number"/.test(timer) && /setSheetOpen\(true\)/.test(timer));
  ok("…nothing else in the panel opens it", (panel.match(/setSheetOpen\(true\)/g) || []).length === 1);
  const connect = between(panel, "const call = await device.connect(", 'call.on("disconnect"');
  ok("…not on connect", !/setSheetOpen/.test(connect));
  const onDisconnect = between(panel, 'call.on("disconnect"', 'call.on("error"');
  ok("…not on disconnect either (the carrier's word comes first)", !/setSheetOpen/.test(onDisconnect));
  ok("the sheet is closed while a call is up and when nothing is pending", /open=\{Boolean\(sheetOpen && pending && !startedAt\)\}/.test(panel));
  ok("a save closes it; 'later' closes it first, then defers (section 8)", /setSheetOpen\(false\);/.test(between(panel, "async function saveOutcome()", "const later")) && /const later = useCallback\(async \(\) => \{\s*setSheetOpen\(false\);/.test(panel));
  ok("the timer never auto-logs once the rep has started (draftStarted)", /if \(draftStarted\(draftRef\.current\)\) return;/.test(timer));

  const sheet = between(form, "export function OutcomeSheet(", "\n}");
  ok("Esc is later", /e\.key === "Escape"/.test(sheet) && /onLater\?\.\(\);/.test(sheet));
  ok("1–4 press the primary buttons and M opens More, but never while typing in a field", /OUTCOME_CHOICES\.find\(\(c\) => c\.hotkey === e\.key\)/.test(sheet) && /e\.key === "m" \|\| e\.key === "M"/.test(sheet) && /if \(typing\) return;/.test(sheet));
  ok("the backdrop is a 'later' button, and the dialog is not aria-modal", /data-outcome-backdrop/.test(sheet) && /onClick=\{onLater\}/.test(sheet) && /aria-modal="false"/.test(sheet));
  ok("a phone gets a bottom sheet, a desktop a centred dialog", /items-end sm:items-center sm:justify-center/.test(sheet));
  ok("the sheet AND the panel copies carry 'Write it up later' — except when the rep is correcting a line-logged outcome", /onLater=\{later\}/.test(between(panel, "<OutcomeSheet", "</OutcomeSheet>")) && /onLater=\{pending\.override \? null : later\}/.test(between(panel, "both(slots?.disposition || null, (inline) =>", "{autoLogged && !pending && !startedAt")));
  ok("the note field is capped at OUTCOME_NOTE_MAX in the form", /maxLength=\{OUTCOME_NOTE_MAX\}/.test(form));
  ok("the fold, not the screen, names the code: saveOutcome posts fold.code", /disposition: fold\.code/.test(panel) && !/disposition: code/.test(panel));
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. Write it up later: the dialler is freed, the list counts only unlogged, day end logs the rest");
// ═══════════════════════════════════════════════════════════════════════════
{
  const store = source("lib/sales/calls/store.js");
  const route = source("app/api/sales/calls/route.js");
  const panel = source("app/components/sales/CallPanel.js");

  const defer = between(store, "export async function deferDisposition(", "\nexport ");
  ok("deferDisposition stamps dispositionDeferredAt on the rep's own unlogged row and refuses one with an outcome", /where: \{ id: attemptId, salesRepId \}/.test(defer) && /if \(row\.disposition\) return \{ ok: false/.test(defer) && /data: \{ dispositionDeferredAt: now \}/.test(defer));
  ok("…gives the retry pool a PROVISIONAL schedule from the line's verdict, else no_answer — and the day-end word on an inbound row", /const provisional = row\.direction === "in" \? dayEndOutcome\(row\)\.code : autoLogOutcome\(row\)\.code \|\| "no_answer";/.test(defer) && /retryWriteFor\(\{ outcome: provisional/.test(defer));
  ok("…and defer takes EITHER direction: the WHERE is id + rep, nothing about direction", /where: \{ id: attemptId, salesRepId \}/.test(defer) && !/direction: "out"/.test(defer) && /direction: true/.test(defer));
  ok("…and never writes lastOutcome for an outcome nobody chose", /const \{ lastOutcome, \.\.\.data \} = retry\.data;/.test(defer));
  ok("…a second defer is a no-op that says so", /if \(row\.dispositionDeferredAt\) return \{ ok: true, deferred: true, already: true/.test(defer));

  const save = between(store, "export async function saveDisposition(", "\nexport ");
  ok("the real outcome recomputes against the pre-provisional count (deferred or line-logged)", /const recount = overriding \|\| Boolean\(existing\.dispositionDeferredAt\);/.test(save) && /prospect: recount \?/.test(save));

  // The dialler is freed: GET's pendingAttempt skips a deferred row.
  const pendingExpr = between(route, "pendingAttempt: attempts", "today:");
  ok("deferring frees the dialler — pendingAttempt skips rows with dispositionDeferredAt", /!a\.disposition &&\s*!a\.dispositionDeferredAt/.test(pendingExpr));
  // 2026-09-17: an inbound row held a rep's dialler hostage with "You rang".
  ok("pendingAttempt EXCLUDES direction \"in\" — only a browser OUTBOUND dial the carrier has finished with holds the dialler", /a\.direction === "out"/.test(pendingExpr) && /a\.dialChannel === "browser"/.test(pendingExpr) && /Boolean\(a\.endedAt\) \|\| PROVIDER_ENDED\.includes\(a\.providerStatus\)/.test(pendingExpr));
  ok("…and carries the row's direction so the panel's sentence is chosen by the row, not assumed", /direction: row\.direction/.test(pendingExpr) && /function whatHappenedBody\(row\)/.test(panel) && /row\?\.direction === "in"/.test(panel) && /app\.salesCall\.whatHappenedBodyInbound/.test(panel));
  const deferRoute = between(route, 'if (action === "defer")', 'if (action === "autodial")');
  ok("…the route's `defer` goes through deferDisposition and moves the rep to available", /deferDisposition\(\{ salesRepId: rep\.id, attemptId, now \}\)/.test(deferRoute) && /STATE_AVAILABLE/.test(deferRoute));
  const laterFn = between(panel, "const later = useCallback(async () => {", "}, [pending?.id, pending?.override]);");
  ok("…and the panel's 'later' posts defer, clears pending, refreshes presence and re-arms the dialler (load, onWorked)", /action: "defer"/.test(laterFn) && /setPending\(\(p\) => \(p\?\.id === row\.id \? null : p\)\)/.test(laterFn) && /await presenceRef\.current\.refresh\(\);\s*await load\(\);\s*onWorked\?\.\(\);/.test(laterFn));
  ok("…but a correction of a line-logged outcome cannot be deferred (nothing to defer)", /if \(!row\?\.id \|\| row\.override\) return;/.test(laterFn));

  // The list counts only unlogged attempts.
  const whereFn = between(store, "export function unloggedWhere(", "\n}");
  ok("unloggedWhere is the ONE definition: this rep, disposition null, BOTH directions — nothing about deferral, nothing about today", /salesRepId,\s*disposition: null,/.test(whereFn) && /\{ direction: "out" \}/.test(whereFn) && /direction: "in"/.test(whereFn) && !/dispositionDeferredAt/.test(whereFn) && !/dialledAt/.test(whereFn));
  ok("…except an inbound row the carrier says ended unanswered (no claim, no answer stamp, terminal status): that is a missed call, not an unwritten one", /\{ answeredAt: \{ not: null \} \}/.test(whereFn) && /\{ answeredByRepId: \{ not: null \} \}/.test(whereFn) && /\{ providerStatus: null \}/.test(whereFn) && /\{ providerStatus: \{ notIn: PROVIDER_ENDED \} \}/.test(whereFn) && !/NOT:/.test(whereFn));
  ok("…the list carries direction and the row prints \"They called you back\" for an inbound one", /direction: r\.direction/.test(between(store, "export async function unloggedAttempts(", "\nexport ")) && /row\.direction === "in"/.test(source("app/components/sales/UnloggedCalls.js")) && /app\.salesCall\.calledYouBack/.test(source("app/components/sales/UnloggedCalls.js")));
  const list = between(store, "export async function unloggedAttempts(", "\nexport ");
  ok("…the list reads it", /where: unloggedWhere\(salesRepId\)/.test(list));
  const badges = source("app/api/sales/badges/route.js");
  ok("…and so does the badge", /db\.salesCallAttempt\.count\(\{ where: unloggedWhere\(rep\.id\) \}\)/.test(badges) && /unlogged,/.test(badges));
  const shell = source("app/sales/SalesShell.js");
  ok("the Queue row wears the badge", /"\/sales\/queue": "unlogged"/.test(shell));
  ok("sign-out asks the list first and offers 'sign out anyway'", /fetchJson\("\/api\/sales\/calls\/unlogged"\)/.test(between(shell, "async function signOut()", "\n  }")) && /onProceed=\{signOutNow\}/.test(shell) && /app\.salesCall\.unlogged\.signOutAnyway/.test(shell));
  const queue = source("app/sales/queue/page.js");
  ok("'Release the rest' asks the list first and offers 'release anyway'", /if \(action === "release_rest" && !pastUnloggedGate\)/.test(queue) && /act\("release_rest", \{ pastUnloggedGate: true \}\)/.test(queue));
  ok("…and the gate flag never reaches the wire", /async function act\(action, \{ pastUnloggedGate = false, \.\.\.extra \} = \{\}\)/.test(queue));
  const home = source("app/sales/page.js");
  ok("the Today card counts them and opens the same list", /useEndpoint\("\/api\/sales\/calls\/unlogged"/.test(home) && /<UnloggedCallsList/.test(home) && /app\.salesCall\.unlogged\.todayLine/.test(home));
  const listCmp = source("app/components/sales/UnloggedCalls.js");
  ok("every row of the list saves through the same fold and the same disposition action", /foldChoice\(/.test(listCmp) && /action: "disposition"/.test(listCmp) && /<OutcomeForm /.test(listCmp));

  // Day end.
  const stale = between(store, "export async function autoLogStale(", "\nexport ");
  ok("autoLogStale reads unlogged rows of BOTH directions with a rep, oldest first", /direction: \{ in: \["out", "in"\] \}, disposition: null, salesRepId: \{ not: null \}/.test(stale) && /orderBy: \{ dialledAt: "asc" \}/.test(stale));
  ok("…uses the rep's day (latest claim's repTimeZone, UTC otherwise) through staleAtDayEnd", /distinct: \["salesRepId"\]/.test(stale) && /staleAtDayEnd\(\{ dialledAt: row\.dialledAt, timeZone: zone, now \}\)/.test(stale));
  ok("…logs dayEndOutcome's word, marked autoLogged, through saveDisposition", /const code = dayEndOutcome\(row\)\.code;/.test(stale) && /saveDisposition\(\{ salesRepId: row\.salesRepId, attemptId: row\.id, code, now, client, autoLogged: true \}\)/.test(stale));
  // dayEndOutcome, every branch — pure, so executed.
  const inRow = (over) => ({ direction: "in", dialChannel: "inbound", disposition: null, providerStatus: null, answeredAt: null, answeredByRepId: null, endedAt: null, talkSeconds: null, hungUpBy: null, ...over });
  ok("outbound, line has a verdict → that verdict", dayEndOutcome(browserRow({ direction: "out", providerStatus: "busy" })).code === "busy");
  ok("outbound, nothing known → no_answer", dayEndOutcome(browserRow({ direction: "out" })).code === "no_answer" && dayEndOutcome({ direction: "out", dialChannel: "handset", disposition: null }).code === "no_answer");
  ok("inbound, answered (carrier stamp), 3 minutes → reached, NEVER no_answer", dayEndOutcome(inRow({ answeredAt: "2026-09-17T20:31:20Z", endedAt: "2026-09-17T20:34:20Z", talkSeconds: 180, providerStatus: "completed" })).code === "reached");
  ok("inbound, answered (a rep's claim, no carrier data) → reached", dayEndOutcome(inRow({ answeredByRepId: "rep_r" })).code === "reached");
  ok("inbound, answered and dropped inside the threshold → hung_up", dayEndOutcome(inRow({ answeredAt: "2026-09-17T20:31:20Z", endedAt: "2026-09-17T20:31:24Z", talkSeconds: 4, providerStatus: "completed" })).code === "hung_up");
  ok("inbound, carrier says the desk leg ended unanswered → missed", dayEndOutcome(inRow({ providerStatus: "no-answer", endedAt: "2026-09-17T20:31:40Z" })).code === "missed");
  ok("inbound, nothing known at all (the 2026-09-17 row) → missed, the line's overwritable guess", dayEndOutcome(inRow()).code === "missed");
  ok("every day-end word is a real disposition the line may write", ["reached", "missed", "hung_up", "no_answer", "busy"].every((c) => isDisposition(c) && AUTO_LOGGED_CODES.includes(c)) && DISPOSITIONS.reached.reached === true && DISPOSITIONS.missed.reached === false);
  ok("autoLogOutcome never writes an inbound row live — the dock asks", autoLogOutcome(inRow({ providerStatus: "no-answer" })).code === null && autoLogOutcome(inRow({ providerStatus: "no-answer" })).reason === "inbound");
  {
    const langs = Object.keys(APP_MESSAGES);
    const miss = langs.flatMap((l) => ["reached", "missed"].flatMap((c) => ["label", "hint"].filter((k) => typeof APP_MESSAGES[l][`app.salesCall.disposition.${c}.${k}`] !== "string").map((k) => `${l}:${c}.${k}`)));
    ok(`reached and missed have a label and a hint in all ${langs.length} languages`, miss.length === 0, miss);
  }
  ok("…and deletes nothing", !/delete/.test(stale));
  const cron = source("app/api/cron/sales-queue-release/route.js");
  ok("the day-end cron calls it after the release, soft", /await releaseDayEnded\(/.test(cron) && /autoLog = await autoLogStale\(\{ client: db, now/.test(cron) && cron.indexOf("releaseDayEnded(") < cron.indexOf("autoLogStale("));

  const schema = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");
  ok("dispositionDeferredAt exists on SalesCallAttempt, nullable", /dispositionDeferredAt DateTime\?/.test(between(schema, "model SalesCallAttempt {", "\nmodel ")));
  // ── 2026-09-17: inbound wording, the refusal you cannot miss, the default time ──
  {
    const langs = Object.keys(APP_MESSAGES);
    const need = ["app.salesCall.whatHappenedBodyInbound", "app.salesCall.calledYouBack", "app.salesCall.choice.call_back.in_an_hour", "app.salesCall.choice.no_callbacks.beforePress"];
    const miss = langs.flatMap((l) => need.filter((k) => typeof APP_MESSAGES[l][k] !== "string").map((k) => `${l}:${k}`));
    ok(`the inbound sentence, the in-an-hour chip and the no-call-backs helper exist in all ${langs.length} languages`, langs.length === 9 && miss.length === 0, miss);
    ok("…and the inbound sentence says they called, with the number and the time, never \"You rang\"", langs.every((l) => /\{number\}/.test(APP_MESSAGES[l]["app.salesCall.whatHappenedBodyInbound"]) && /\{time\}/.test(APP_MESSAGES[l]["app.salesCall.whatHappenedBodyInbound"]) && /\{number\}/.test(APP_MESSAGES[l]["app.salesCall.calledYouBack"]) && /\{time\}/.test(APP_MESSAGES[l]["app.salesCall.calledYouBack"])) && /^They called you back from \{number\} at \{time\}/.test(APP_MESSAGES.en["app.salesCall.whatHappenedBodyInbound"]) && !/You rang/.test(APP_MESSAGES.en["app.salesCall.whatHappenedBodyInbound"]));
  }
  const form = source("app/components/sales/OutcomeForm.js");
  ok("Call back has a default time: pressing it pre-selects CALL_BACK_DEFAULT_WHEN, and the fold accepts that chip on its own", CALL_BACK_DEFAULT_WHEN === WHEN_IN_AN_HOUR && WHEN_KINDS.includes(CALL_BACK_DEFAULT_WHEN) && /whenKind: next === CHOICE_CALL_BACK \? CALL_BACK_DEFAULT_WHEN : null/.test(form) && foldChoice({ key: CHOICE_CALL_BACK, whenKind: CALL_BACK_DEFAULT_WHEN, now: T0 }).code === "callback");
  ok("…in an hour is one hour on", callbackTimeFor(WHEN_IN_AN_HOUR, { now: T0 }).getTime() === T0.getTime() + 60 * 60 * 1000);
  ok("…and the fold itself still refuses Call back with no time and no tick — the default is the form's, not an invented hour", foldChoice({ key: CHOICE_CALL_BACK, now: T0 }).ok === false);
  ok("…the chip is drawn first among the four", /\[WHEN_IN_AN_HOUR, WHEN_LATER_TODAY, WHEN_TOMORROW, WHEN_PICK\]\.map/.test(form));
  const refusal = between(form, "{error ? (", ") : null}");
  ok("the refusal is a boxed alert with data-outcome-refusal, drawn under the buttons and above the note field", /data-outcome-refusal/.test(refusal) && /role="alert"/.test(refusal) && /aria-live="assertive"/.test(refusal) && /AlertTriangle/.test(refusal) && /border-2 border-amber-500/.test(refusal) && form.indexOf("data-outcome-refusal") < form.indexOf("data-outcome-note") && form.indexOf("data-outcome-more") < form.indexOf("data-outcome-refusal"));
  ok("No call-backs says it needs their words BEFORE the press", /data-outcome-needs-words/.test(form) && /draft\.choice === CHOICE_NO_CALLBACKS && !draft\.note\.trim\(\)/.test(form) && /app\.salesCall\.choice\.no_callbacks\.beforePress/.test(form));
  // The dock asks in place, once.
  const dock = source("app/components/sales/IncomingCallDock.js");
  ok("the inbound dock writes up an answered callback in place: the same OutcomeForm, the same fold, the same disposition and defer actions", /<OutcomeForm /.test(dock) && /foldChoice\(/.test(dock) && /action: "disposition"/.test(dock) && /action: "defer"/.test(dock) && /data-inbound-write-up/.test(dock));
  ok("…with the inbound sentence, never \"You rang\"", /app\.salesCall\.whatHappenedBodyInbound/.test(dock) && !/app\.salesCall\.whatHappenedBody"/.test(dock));
  ok("…asked once per attempt (askedRef), only after a call that was live, only with a matched attempt", /askedRef\.current\.has\(logged\.attemptId\)/.test(dock) && /askedRef\.current\.add\(logged\.attemptId\)/.test(dock) && /wasLive && logged\?\.attemptId/.test(dock));
  ok("…and a new ring while it is open defers it rather than losing it", /laterRef\.current\?\.\(\);/.test(between(dock, 'device.on("incoming"', "setIncoming({")));

  // ── 2026-09-17: the call-backs a rep promised, and the button that keeps them ──
  {
    const promised = between(store, "export async function promisedCallbacks(", "\n}");
    ok("promisedCallbacks reads the rep's own callback outcomes with a time, soonest first", /where: \{ salesRepId, callbackAt: \{ not: null \}, disposition: "callback" \}/.test(promised) && /orderBy: \{ callbackAt: "asc" \}/.test(promised));
    ok("…a promise is kept by a LATER OUTBOUND dial to the same number, and dropped by a later closing outcome or a do-not-contact", /after\.some\(\(a\) => a\.direction === "out"\)/.test(promised) && /CLOSED\.has\(a\.disposition\)/.test(promised) && /doNotContactAt\) continue/.test(promised));
    ok("…and says per row whether the console can still dial it (`held`: this rep's, not merged, claim not lapsed)", /assignedRepId === salesRepId/.test(promised) && /mergedIntoId === null/.test(promised) && /claimExpiresAt > at/.test(promised) && /held,/.test(promised));
    const cbRoute = source("app/api/sales/calls/callbacks/route.js");
    ok("GET /api/sales/calls/callbacks is the rep-gated read of it", /requireCallingRep\(request\)/.test(cbRoute) && /promisedCallbacks\(\{ salesRepId: rep\.id, now \}\)/.test(cbRoute) && /due:/.test(cbRoute));
    const strip = source("app/components/sales/CallbacksStrip.js");
    ok("the strip reads that route, flags due rows, and draws Call now ONLY on a held prospect — a lead links to its page, anything else says why there is no button", /fetchJson\("\/api\/sales\/calls\/callbacks"\)/.test(strip) && /data-callback-due=\{row\.due/.test(strip) && /row\.held && row\.prospectId \?/.test(strip) && /data-callback-call-now/.test(strip) && /data-callback-open-lead/.test(strip) && /data-callback-no-button/.test(strip) && !/fetchJson\("\/api\/sales\/calls", \{/.test(strip));
    const queue = source("app/sales/queue/page.js");
    const callNowFn = between(queue, "const callNow = useCallback(", "const onDialKey");
    ok("the queue's Call now is the queue's own dial path: current business → dialNumber, else select() then dialNumber once it is current — never a second dialler", /dialNumber\(e164\)/.test(callNowFn) && /select\(prospectId\)/.test(callNowFn) && /current\?\.id === callNowPending\.prospectId/.test(callNowFn) && /dialNumber\(callNowPending\.e164\)/.test(callNowFn) && !/\/api\/sales\/calls/.test(callNowFn));
    ok("…a business that did not load as current is refused in words and the list re-read", /setError\(t\("app\.salesCall\.callbacks\.notHeld"\)\)/.test(callNowFn) && /setCallbacksKey\(\(n\) => n \+ 1\)/.test(callNowFn));
    ok("…the strip is drawn in the dialler column and re-read after every outcome (worked)", /<CallbacksStrip/.test(queue) && /onCallNow=\{callNow\}/.test(queue) && /setCallbacksKey\(\(n\) => n \+ 1\);\s*\}, \[auto\.onWorked, load\]\);/.test(queue));
    ok("…and the Tasks tab's rows carry the same Call now, with the attempt's own number when the list knows it", /data-task-call-now/.test(queue) && /const known = \(promised\.items \|\| \[\]\)\.find\(\(r\) => r\.id === a\.id\)/.test(queue) && /callNow\(\{ id: a\.id, prospectId: current\.id, toE164: e164 \}\)/.test(queue));
    const cbKeys = ["title", "dueCount", "loading", "loadFailed", "tryAgain", "callNow", "loadAndCall", "openLead", "notHeld", "noRecord"];
    const cbMissing = Object.keys(APP_MESSAGES).flatMap((l) => cbKeys.filter((k) => typeof APP_MESSAGES[l][`app.salesCall.callbacks.${k}`] !== "string").map((k) => `${l}:${k}`));
    ok("the strip's sentences exist in every language", cbMissing.length === 0, cbMissing);
  }

  const keys = ["title", "count", "todayLine", "gateBody", "gateBodyNoCount", "none", "writeThemUp", "writeUp", "close", "stay", "signOutAnyway", "releaseAnyway", "loading", "loadFailed", "tryAgain"];
  const missing = Object.keys(APP_MESSAGES).flatMap((l) => keys.filter((k) => APP_MESSAGES[l][`app.salesCall.unlogged.${k}`] === undefined).map((k) => `${l}:${k}`));
  ok("the list's sentences exist in every language", missing.length === 0, missing);
  ok("the count declines by language (a countedNoun, not a bare number)", typeof APP_MESSAGES.fr["app.salesCall.unlogged.count"] === "function" && APP_MESSAGES.fr["app.salesCall.unlogged.count"]({ value: 3 }) === "3 appels" && APP_MESSAGES.en["app.salesCall.unlogged.count"]({ value: 1 }) === "1 call");
}

// ── staleAtDayEnd, executed ──────────────────────────────────────────────
{
  const { staleAtDayEnd } = await import("@/lib/sales/calls/store");
  const noon = new Date("2026-09-14T16:00:00Z"); // 12:00 Toronto
  ok("a call from yesterday afternoon (Toronto) is stale at noon today", staleAtDayEnd({ dialledAt: new Date("2026-09-13T20:00:00Z"), timeZone: "America/Toronto", now: noon }) === true);
  ok("a call from this morning is not", staleAtDayEnd({ dialledAt: new Date("2026-09-14T13:00:00Z"), timeZone: "America/Toronto", now: noon }) === false);
  ok("23:50 last night Toronto is stale at 00:10 — day end is the calendar, not 24 h", staleAtDayEnd({ dialledAt: new Date("2026-09-14T03:50:00Z"), timeZone: "America/Toronto", now: new Date("2026-09-14T04:10:00Z") }) === true);
  ok("…and the same instant is NOT stale for a rep in Vancouver, where it is still the same day", staleAtDayEnd({ dialledAt: new Date("2026-09-14T03:50:00Z"), timeZone: "America/Vancouver", now: new Date("2026-09-14T04:10:00Z") }) === false);
  ok("a broken date is never stale", staleAtDayEnd({ dialledAt: "nope", timeZone: "America/Toronto", now: noon }) === false);
  ok("an unusable zone falls back to UTC rather than throwing", staleAtDayEnd({ dialledAt: new Date("2026-09-13T20:00:00Z"), timeZone: "Mars/Olympus", now: noon }) === true);
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. Call history: outcome + note + endReason per attempt, and the 'last time' line");
// ═══════════════════════════════════════════════════════════════════════════
{
  const { callHistoryRows, lastTime, HISTORY_SELECT } = await import("@/lib/sales/calls/history");
  const rows = [
    { id: "a1", salesRepId: "rep_r", dialledAt: "2026-08-15T14:00:00Z", direction: "out", dialChannel: "browser", providerStatus: "completed", answeredAt: "2026-08-15T14:00:10Z", endedAt: "2026-08-15T14:02:00Z", talkSeconds: 110, hungUpBy: HUNG_UP_BY_PROSPECT, endReason: "prospect_hangup", disposition: "reached_not_interested", dispositionAt: "2026-08-15T14:02:30Z", dispositionAutoLogged: false, dispositionDeferredAt: null, dispositionNote: "call after the season", callbackAt: null },
    { id: "a2", salesRepId: "rep_r", dialledAt: "2026-09-14T13:40:00Z", direction: "out", dialChannel: "browser", providerStatus: "completed", answeredAt: "2026-09-14T13:40:34Z", endedAt: "2026-09-14T13:40:34Z", talkSeconds: 0, hungUpBy: HUNG_UP_BY_PROSPECT, endReason: "prospect_hangup", disposition: "hung_up", dispositionAt: "2026-09-14T13:40:40Z", dispositionAutoLogged: true, dispositionDeferredAt: null, dispositionNote: null, callbackAt: null },
    { id: "a3", salesRepId: "rep_other", dialledAt: "2026-09-01T10:00:00Z", direction: "out", dialChannel: "handset", providerStatus: null, answeredAt: null, endedAt: null, talkSeconds: null, hungUpBy: null, endReason: null, disposition: "callback", dispositionAt: "2026-09-01T10:05:00Z", dispositionAutoLogged: false, dispositionDeferredAt: null, dispositionNote: "the other rep's words", callbackAt: "2026-09-03T15:00:00Z" },
    { id: "a4", salesRepId: "rep_r", dialledAt: "2026-09-14T15:00:00Z", direction: "out", dialChannel: "browser", providerStatus: "completed", answeredAt: "2026-09-14T15:00:05Z", endedAt: "2026-09-14T15:03:00Z", talkSeconds: 175, hungUpBy: HUNG_UP_BY_REP, endReason: "rep_hangup", disposition: null, dispositionAt: null, dispositionAutoLogged: false, dispositionDeferredAt: "2026-09-14T15:03:10Z", dispositionNote: null, callbackAt: null },
    { id: "bad", salesRepId: "rep_r", dialledAt: "not a date" },
    null,
  ];
  const h = callHistoryRows(rows, { repId: "rep_r" });
  ok("newest first, broken rows dropped", h.map((r) => r.id).join() === "a4,a2,a3,a1", h.map((r) => r.id));
  const a1 = h.find((r) => r.id === "a1");
  ok("each attempt carries outcome + note + endReason + who hung up + talk seconds + when", a1.disposition === "reached_not_interested" && a1.note === "call after the season" && a1.endReason === "prospect_hangup" && a1.hungUpBy === HUNG_UP_BY_PROSPECT && a1.talkSeconds === 110 && a1.dialledAt === "2026-08-15T14:00:00.000Z" && a1.dispositionAt === "2026-08-15T14:02:30.000Z", a1);
  ok("…and the ended sentence: they hung up · 110 s", a1.ended?.key === "app.salesCall.ended.prospect" && a1.ended.talkSeconds === 110);
  const a2 = h.find((r) => r.id === "a2");
  ok("a line-logged outcome is marked autoLogged", a2.autoLogged === true && a2.disposition === "hung_up");
  const a3 = h.find((r) => r.id === "a3");
  ok("another rep's attempt is included, marked, with the callback time but WITHOUT their note", a3.mine === false && a3.callbackAt === "2026-09-03T15:00:00.000Z" && a3.note === null);
  const a4 = h.find((r) => r.id === "a4");
  ok("a deferred call reads as deferred, not as an outcome", a4.deferred === true && a4.disposition === null && a4.ended?.key === "app.salesCall.ended.rep");
  ok("garbage in → empty list", callHistoryRows(null).length === 0 && callHistoryRows("x").length === 0);
  ok("HISTORY_SELECT names every column the shaper reads", ["dispositionNote", "endReason", "hungUpBy", "dispositionAutoLogged", "dispositionDeferredAt", "callbackAt", "talkSeconds", "answeredAt", "endedAt", "providerStatus"].every((k) => HISTORY_SELECT[k] === true));

  // The line above the script, for a returning lead.
  const now = new Date("2026-09-15T14:00:00Z");
  const lt = lastTime(callHistoryRows(rows.slice(0, 1), { repId: "rep_r" }), { now, timeZone: "America/Toronto" });
  ok("a lead back after a month: Last time (Aug 15): Not now — 'call after the season'", lt && lt.dialledAt === "2026-08-15T14:00:00.000Z" && lt.disposition === "reached_not_interested" && lt.note === "call after the season" && lt.autoLogged === false, lt);
  const today = lastTime(h, { now: new Date("2026-09-14T20:00:00Z"), timeZone: "America/Toronto" });
  ok("…but the newest write-up being TODAY'S (the 13:40 hang-up) says nothing — no line for a lead rung this morning", today === null, today);
  const tomorrow = lastTime(h, { now: new Date("2026-09-15T14:00:00Z"), timeZone: "America/Toronto" });
  ok("…and tomorrow it names today's newest write-up, the line's, marked so", tomorrow && tomorrow.disposition === "hung_up" && tomorrow.autoLogged === true, tomorrow);
  ok("no written-up call → null", lastTime(callHistoryRows([rows[3]], { repId: "rep_r" }), { now }) === null && lastTime(null) === null);

  const route = source("app/api/sales/calls/history/route.js");
  ok("the route scopes a prospect through queueWhere and a lead through the rep's own id", /queueWhere\(rep\.id\)/.test(route) && /salesRepId: rep\.id/.test(route) && /select: HISTORY_SELECT/.test(route));
  const queue = source("app/sales/queue/page.js");
  ok("the queue reads the history ONCE and draws the line above the dial, the strip under it, the full list in the Disposition tab", /useCallHistory\(\{ prospectId: current\?\.id \|\| null, refreshKey: historyKey \}\)/.test(queue) && /<LastTimeLine loaded=\{callHistory\} \/>/.test(queue) && /<CallHistoryStrip loaded=\{callHistory\} limit=\{3\} \/>/.test(queue) && /<CallHistoryStrip loaded=\{callHistory\} limit=\{0\} \/>/.test(queue));
  ok("…and re-reads it after every outcome", /setHistoryKey\(\(n\) => n \+ 1\);/.test(between(queue, "const worked = useCallback(() => {", "}, [auto.onWorked, load]);")));
  const leadPage = source("app/sales/leads/[id]/page.js");
  ok("the lead page draws the line and the strip", /<LastTimeLine leadId=\{lead\.id\}/.test(leadPage) && /<CallHistoryStrip leadId=\{lead\.id\}/.test(leadPage));
  const texts = source("app/sales/messages/page.js");
  ok("the Texts contact panel draws the strip for a lead", /<CallHistoryStrip leadId=\{lead\.id\} limit=\{3\} \/>/.test(texts));
  const cmp = source("app/components/sales/CallHistory.js");
  ok("the strip prints the note, the auto mark, the callback and the ended sentence", /row\.note/.test(cmp) && /row\.autoLogged/.test(cmp) && /row\.callbackAt/.test(cmp) && /app\.salesCall\.ended\.withTalk/.test(cmp));
  const keys = ["title", "none", "loading", "loadFailed", "unlogged", "deferred", "auto", "autoLoggedTitle", "inbound", "anotherRep", "callbackAt", "showAll", "showFewer", "lastTime", "lastTimeWithNote"];
  const missing = Object.keys(APP_MESSAGES).flatMap((l) => keys.filter((k) => APP_MESSAGES[l][`app.salesCall.history.${k}`] === undefined).map((k) => `${l}:${k}`));
  ok("the history's sentences exist in every language", missing.length === 0, missing);
}

// ═══════════════════════════════════════════════════════════════════════════
section("10. Never a second dial over a live inbound call (QA 2026-09-17, finding 1)");
// ═══════════════════════════════════════════════════════════════════════════
//
// The presence provider holds the outbound call (CallPanel) and the inbound
// call (IncomingCallDock) as two flags and derives `callLive`; CallPanel
// refuses on it from every press path and says so above a disabled button.
// The server half — the route's 409 — is check-sales-call-handling's.
{
  const provider = source("app/components/sales/RepStatus.js");
  ok("the provider keeps the two calls as two flags and derives callLive", /const \[outboundUp, setCallUp\] = useState\(false\);/.test(provider) && /const \[inboundLive, setInboundLive\] = useState\(false\);/.test(provider) && /const callLive = outboundUp \|\| inboundLive;/.test(provider));
  const value = between(provider, "const value = useMemo(", "return <Ctx.Provider");
  ok("…and exposes callLive, callUp (the older name for the same fact), inboundLive and both setters", /callLive,\s*callUp: callLive,\s*inboundLive,/.test(value) && /setCallUp,\s*setInboundLive,/.test(value));
  const detached = between(provider, "const DETACHED = Object.freeze({", "});");
  ok("…the detached shape carries them too, inert", /callLive: false/.test(detached) && /inboundLive: false/.test(detached) && /setInboundLive: noop/.test(detached));
  const dock = source("app/components/sales/IncomingCallDock.js");
  ok("the dock reports through setInboundLive — true on answer, false on disconnect and hang-up — and never touches the panel's flag", /setInboundLive\(true\)/.test(between(dock, "async function answer()", "function decline()")) && (dock.match(/setInboundLive\(false\)/g) || []).length >= 2 && !/setCallUp\(/.test(dock));

  const panel = source("app/components/sales/CallPanel.js");
  ok("CallPanel derives onAnotherCall = callLive && !startedAt", /const onAnotherCall = presence\.callLive === true && !startedAt;/.test(panel));
  const place = between(panel, "async function place(channel", "const autoDialSeen");
  ok("place() refuses — through the ref, with the sentence — before anything is posted", (() => {
    const guard = place.indexOf("presenceRef.current.callLive === true");
    const post = place.indexOf('fetchJson("/api/sales/calls"');
    return guard !== -1 && post !== -1 && guard < post && /setError\(t\("app\.salesCall\.onACall"\)\);\s*return false;/.test(place.slice(guard, post));
  })());
  ok("…and the server's 409 already_on_a_call is printed in the rep's language", /err\?\.data\?\.code === ALREADY_ON_A_CALL\s*\? t\("app\.salesCall\.onACall"\)/.test(place));
  const auto = between(panel, "const autoDialSeen = useRef(null);", "const dialRequestSeen");
  ok("the autodialler's press reports not_idle on it rather than dialling", /\|\| onAnotherCall\) \{\s*onAutoDialResult\?\.\(\{ token, ok: false, reason: "not_idle" \}\);/.test(auto));
  const req = between(panel, "const dialRequestSeen = useRef(null);", "function hangUp()");
  ok("the Dial button's press (and Call now's) is refused, and the sentence above the button is brought into view", /if \(onAnotherCall\) \{[\s\S]*?data-call-on-another-call[\s\S]*?return;\s*\}/.test(req) && req.indexOf("if (onAnotherCall)") < req.indexOf("if (busy || startedAt || pending)"));
  const buttons = between(panel, "{!startedAt && !pending ? (", "{into(");
  ok("both Call buttons are disabled while another call is live", (buttons.match(/disabled=\{Boolean\(busy\) \|\| onAnotherCall\}/g) || []).length === 2);
  ok("…and the sentence is printed above them, only then", /\{onAnotherCall \? \([\s\S]*?data-call-on-another-call[\s\S]*?app\.salesCall\.onACall/.test(buttons));
  const missing = Object.keys(APP_MESSAGES).filter((l) => typeof APP_MESSAGES[l]["app.salesCall.onACall"] !== "string" || !APP_MESSAGES[l]["app.salesCall.onACall"]);
  ok("the sentence exists in every language", missing.length === 0, missing);
  ok("…and is not the English in the complete languages", ["fr", "es", "de", "zh", "it"].every((l) => APP_MESSAGES[l]["app.salesCall.onACall"] !== APP_MESSAGES.en["app.salesCall.onACall"]));
  const control = source("app/components/sales/AutodialControl.js");
  ok("the autodialler still reads the provider's flag, so a countdown halts on an answered inbound call", /callUp/.test(between(control, "export function useAutodial(", "const nowMs")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("11. A missed ring-back or a voicemail is not a to-do (QA 2026-09-17, finding 5)");
// ═══════════════════════════════════════════════════════════════════════════
{
  const cmp = source("app/components/sales/CallHistory.js");
  ok("nothingToWriteUp: inbound, unanswered, no outcome, and missed or a voicemail", /function nothingToWriteUp\(row\) \{\s*return row\.direction === "in" && !row\.answered && !row\.disposition && Boolean\(row\.missed \|\| row\.voicemail\);/.test(cmp));
  const outcome = between(cmp, "function outcomeText(t, row) {", 'return t("app.salesCall.history.unlogged");');
  ok("outcomeText says nothing for it — 'Not written up' is kept for calls somebody had", /if \(nothingToWriteUp\(row\)\) return "";/.test(outcome) && outcome.indexOf("nothingToWriteUp") > outcome.indexOf("history.deferred"));
  ok("…and the outcome span is not drawn at all when the sentence is empty", /\{outcomeText\(t, row\) \? \(/.test(cmp));
  ok("the missed line is quiet, not amber", /data-call-history-missed=\{row\.id\}/.test(cmp) && /className="text-muted-foreground" data-call-history-missed/.test(cmp));
  ok("the row's outcome hook names it: missed or voicemail, never unlogged", /nothingToWriteUp\(row\) \? \(row\.voicemail \? "voicemail" : "missed"\) : "unlogged"/.test(cmp));
}

console.log(`\ncheck-sales-call-panel: ${passed} passed, ${failed} failed`);
if (failed) {
  console.log("Failed:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
