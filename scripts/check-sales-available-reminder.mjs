// scripts/check-sales-available-reminder.mjs
//
//   npm run check:sales-available-reminder
//
// "You're shown as Off" — the reminder a rep sees after signing in without
// pressing Available (lib/sales/availableReminder.js,
// app/components/sales/AvailableReminder.js).
//
// ══ What it proves ════════════════════════════════════════════════════════
//
//   1. shouldRemind() is total and fails closed: every input that is not the
//      exact set of facts — mounted, loaded, tables present, no call, no
//      ring, not dismissed, state offline or no row — answers no. The
//      complete truth table is executed, and a hostile state string, a
//      string "true" and an undefined field are each a no.
//   2. The storage helpers survive a storage that throws (private mode) in
//      the direction that shows NO modal on every route change.
//   3. Source: the modal is role="dialog" aria-modal="true", labelled by
//      its own heading, traps Tab, closes on Escape through the same
//      dismiss, posts Go available through the provider's setStatus with
//      the picker's own `available` choice (never a state typed here), is
//      mounted in the shell under the presence provider, and the login page
//      and sign-out clear the session flag so the next sign-in asks again.
//   4. The four strings exist in all nine languages and the English says
//      what the owner asked it to say.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  AVAILABLE_REMINDER_KEY,
  clearReminderDismissed,
  readReminderDismissed,
  shouldRemind,
  writeReminderDismissed,
} from "@/lib/sales/availableReminder";
import { REP_STATES, STATE_OFFLINE } from "@/lib/sales/calls/agentState";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (src) => src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

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
const section = (h) => console.log(`\n${h}\n`);
const LANGS = Object.keys(APP_MESSAGES);

// ═══════════════════════════════════════════════════════════════════════════
section("1. shouldRemind(): the truth table");
// ═══════════════════════════════════════════════════════════════════════════

const YES = { mounted: true, loading: false, storeReady: true, state: STATE_OFFLINE, callUp: false, inboundRinging: false, dismissed: false };
ok("the one yes: mounted, loaded, tables present, offline, no call, no ring, not dismissed", shouldRemind(YES) === true);
ok("…and a rep with NO row at all (state null) is offline too", shouldRemind({ ...YES, state: null }) === true);
ok("…state undefined likewise", shouldRemind({ ...YES, state: undefined }) === true);

for (const [label, patch] of [
  ["not mounted", { mounted: false }],
  ["still loading", { loading: true }],
  ["tables absent", { storeReady: false }],
  ["a call is up", { callUp: true }],
  ["a contractor is ringing", { inboundRinging: true }],
  ["dismissed this session", { dismissed: true }],
]) {
  ok(`no when ${label}`, shouldRemind({ ...YES, ...patch }) === false);
}
for (const code of Object.keys(REP_STATES)) {
  if (code === STATE_OFFLINE) continue;
  ok(`no when the rep is ${code}`, shouldRemind({ ...YES, state: code }) === false);
}
ok("no for a state the vocabulary does not know", shouldRemind({ ...YES, state: "banana" }) === false && shouldRemind({ ...YES, state: 42 }) === false && shouldRemind({ ...YES, state: {} }) === false);
ok("only the literal true is mounted / ready; \"true\" is not", shouldRemind({ ...YES, mounted: "true" }) === false && shouldRemind({ ...YES, storeReady: 1 }) === false);
ok("an absent field fails closed — undefined reads as loading / dismissed / not mounted", shouldRemind({ ...YES, loading: undefined }) === false && shouldRemind({ ...YES, dismissed: undefined }) === false && shouldRemind({ ...YES, mounted: undefined }) === false && shouldRemind({ ...YES, storeReady: undefined }) === false);
ok("no arguments at all is no", shouldRemind() === false && shouldRemind(null) === false);

// Every combination of the six booleans over the six states: exactly the
// rows above answer yes, and nothing else does.
{
  let yes = 0;
  let total = 0;
  const bools = [true, false];
  for (const mounted of bools) for (const loading of bools) for (const storeReady of bools) for (const callUp of bools) for (const inboundRinging of bools) for (const dismissed of bools) for (const state of [...Object.keys(REP_STATES), null, "x"]) {
    total += 1;
    const r = shouldRemind({ mounted, loading, storeReady, state, callUp, inboundRinging, dismissed });
    const expect = mounted && !loading && storeReady && !callUp && !inboundRinging && !dismissed && (state === null || state === STATE_OFFLINE);
    if (r !== expect) {
      failures.push(`truth table row ${JSON.stringify({ mounted, loading, storeReady, state, callUp, inboundRinging, dismissed })}`);
    }
    if (r) yes += 1;
  }
  ok(`the full truth table (${total} rows) answers yes on exactly 2 rows`, yes === 2, yes);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The session flag, against a storage that throws");
// ═══════════════════════════════════════════════════════════════════════════

{
  const mem = new Map();
  const good = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  ok("fresh storage: not dismissed", readReminderDismissed(good) === false);
  writeReminderDismissed(good);
  ok("after OK: dismissed, under the one key", readReminderDismissed(good) === true && mem.get(AVAILABLE_REMINDER_KEY) === "1");
  clearReminderDismissed(good);
  ok("after a sign-in clears it: not dismissed again", readReminderDismissed(good) === false && mem.size === 0);
  const bad = { getItem: () => { throw new Error("private"); }, setItem: () => { throw new Error("private"); }, removeItem: () => { throw new Error("private"); } };
  ok("a storage that throws reads as dismissed — no modal on every route change in private mode", readReminderDismissed(bad) === true);
  let threw = false;
  try { writeReminderDismissed(bad); clearReminderDismissed(bad); } catch { threw = true; }
  ok("…and the writes do not throw", !threw);
  ok("no storage at all (the server) reads as dismissed", readReminderDismissed(null) === true);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. Source: the modal, the shell, the sign-in and the sign-out");
// ═══════════════════════════════════════════════════════════════════════════

{
  const modal = decomment(read("app/components/sales/AvailableReminder.js"));
  // 2026-09-17: the mechanics moved to app/components/AlertDialog.js — the
  // one modal primitive, shared with the incoming-call ring — and this file
  // passes its own decisions as props. The assertions below follow the code:
  // the aria wiring and the trap are held to the primitive, the choice of
  // what Escape and the scrim do to this file.
  const dialog = decomment(read("app/components/AlertDialog.js"));
  ok("it is a dialog, modal, labelled and described by its own text", /<AlertDialog/.test(modal) && /role="dialog"/.test(modal) && /labelledBy="fq-available-reminder-title"/.test(modal) && /id="fq-available-reminder-title"/.test(modal) && /describedBy="fq-available-reminder-body"/.test(modal) && /id="fq-available-reminder-body"/.test(modal) && /aria-modal="true"/.test(dialog) && /aria-labelledby=\{labelledBy\}/.test(dialog) && /aria-describedby=\{describedBy\}/.test(dialog));
  ok("the decision is shouldRemind() and nothing local", /const open = shouldRemind\(\{/.test(modal) && !/presence\?\.state === STATE_OFFLINE/.test(modal));
  ok("…fed the provider's facts: loading, store.ready, presence.state, callUp, inboundRinging", /storeReady: store\?\.ready === true,/.test(modal) && /state: presence\?\.state \?\? null,/.test(modal) && /callUp,\s*inboundRinging,/.test(modal));
  ok("Escape is OK — the same dismiss, and so is the scrim", /onEscape=\{dismiss\}/.test(modal) && /onScrim=\{dismiss\}/.test(modal) && /if \(e\.key === "Escape"\) \{[\s\S]*?e\.preventDefault\(\);\s*escapeRef\.current\?\.\(\);/.test(dialog) && /onClick=\{onScrim\}/.test(dialog));
  ok("Tab is trapped inside the card, both ways", /if \(e\.shiftKey && document\.activeElement === first\)/.test(dialog) && /else if \(!e\.shiftKey && document\.activeElement === last\)/.test(dialog));
  ok("focus lands on Go available on open and returns afterwards", /initialFocusRef=\{primaryRef\}/.test(modal) && /ref=\{primaryRef\}/.test(modal) && /primary\?\.focus\?\.\(\);/.test(dialog) && /returnTo\.current = /.test(dialog) && /back\.focus\(\)/.test(dialog));
  ok("Go available is the picker's own choice through setStatus — no state typed here, no fetch of its own", /\(choices \|\| \[\]\)\.find\(\(c\) => c\.state === STATE_AVAILABLE\)/.test(modal) && /await setStatus\(choice\)/.test(modal) && !/action: "state"/.test(modal) && !/fetch\(/.test(modal));
  ok("a refused press is said and the modal stays", /setRefused\(result\.error \|\| t\("app\.salesStatus\.changeFailed"\)\)/.test(modal) && /role="alert"/.test(modal));
  ok("OK writes the session flag through the helper, never a key of its own", /writeReminderDismissed\(\)/.test(modal) && !/sessionStorage\./.test(modal));
  ok("the two buttons carry hooks a test can find, 44px tall", /data-reminder-go-available/.test(modal) && /data-reminder-ok/.test(modal) && /min-h-\[44px\]/.test(modal));
  ok("Go available is first in the DOM and the row is reversed from sm up", /data-reminder-go-available[\s\S]*data-reminder-ok/.test(modal) && /sm:flex-row-reverse/.test(modal));
  ok("it sits above the tour and below the incoming-call dialog", /zClass="z-\[65\]"/.test(modal) && /z-\[60\]/.test(read("app/components/sales/SalesTour.js")) && /zClass="z-\[80\]"/.test(read("app/components/sales/IncomingCallDock.js")));

  const shell = decomment(read("app/sales/SalesShell.js"));
  const iProvider = shell.indexOf("<RepPresenceProvider>");
  const iDock = shell.indexOf("<IncomingCallDock />");
  const iReminder = shell.indexOf("<AvailableReminder />");
  const iEnd = shell.indexOf("</RepPresenceProvider>");
  ok("the shell mounts it once, under the presence provider, beside the dock", iReminder > iProvider && iReminder < iEnd && iDock > 0 && (shell.match(/<AvailableReminder \/>/g) || []).length === 1);
  ok("sign-out clears the session flag", /clearReminderDismissed\(\);\s*window\.location\.href = "\/sales\/login";/.test(shell));
  const login = decomment(read("app/sales/login/page.js"));
  ok("a successful sign-in clears it before navigating into the portal", /clearReminderDismissed\(\);\s*window\.location\.href = "\/sales";/.test(login));
  const i18n = read("scripts/check-sales-portal-i18n.mjs");
  ok("the portal i18n check holds the modal to no bare English", /"app\/components\/sales\/AvailableReminder\.js"/.test(i18n));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The words, in nine languages");
// ═══════════════════════════════════════════════════════════════════════════

const KEYS = ["app.salesStatus.reminder.title", "app.salesStatus.reminder.body", "app.salesStatus.reminder.goAvailable", "app.salesStatus.reminder.ok"];
for (const lang of LANGS) {
  ok(`${lang} has all four`, KEYS.every((k) => typeof APP_MESSAGES[lang][k] === "string" && APP_MESSAGES[lang][k].trim().length > 0));
}
ok("English says what the owner asked", /shown as Off/.test(APP_MESSAGES.en["app.salesStatus.reminder.title"]) && /ring back/.test(APP_MESSAGES.en["app.salesStatus.reminder.body"]) && /Available/.test(APP_MESSAGES.en["app.salesStatus.reminder.body"]) && APP_MESSAGES.en["app.salesStatus.reminder.ok"] === "OK");
ok("the modal renders every key it names", KEYS.every((k) => read("app/components/sales/AvailableReminder.js").includes(`"${k}"`)));

const pkg = JSON.parse(read("package.json"));
ok("check:sales-available-reminder is wired", typeof pkg.scripts["check:sales-available-reminder"] === "string" && /npm run check:sales-available-reminder\b/.test(pkg.scripts["check:all"]));

console.log(`\n${failures.length ? "FAILED" : "PASSED"} — ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
