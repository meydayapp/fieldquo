// scripts/check-voice-setup-steps.mjs
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-voice-setup-steps.mjs
//
// The seven numbered cards on /app/settings/voice stop being numbered once the
// company has finished setting the receptionist up.
//
// ── What was wrong ─────────────────────────────────────────────────────────
//
// `step="1."` … `step="7."` were literal props with no condition attached, so a
// contractor who set this up in March opened a numbered seven-step wizard in
// September to change one greeting. Numbering is a first-run affordance and it
// was rendered forever, on a page whose author had already computed everything
// needed to know first run was over.
//
// Nothing about the cards, their order or their contents changes — the order is
// argued in comments on each card and it is right (credit before the number
// that is charged against it; the switch after the two things it refuses to
// work without). Only the numbering is conditional.
//
// ── Why the rule is EXECUTED, not read ─────────────────────────────────────
//
// A regex can confirm the words `hasAnsweredCall` and `enabled` appear in the
// expression. `if (false && hasAnsweredCall)` contains those words and does
// nothing. So this pulls the shipped expressions out of the source and runs
// them against a truth table, including the two states that must NOT re-number
// the page: a phone switched off for a week, and a balance that dipped below
// one call. Those are the regressions worth catching — both are the same lie
// the numbering told in the first place, just triggered later.

import { readFileSync } from "node:fs";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

let pass = 0;
const failures = [];
// (condition, label). Stated because this repo has both argument orders in
// different check scripts, and a swapped pair passes silently — every label is
// a non-empty, truthy string, so the check would verify nothing at all.
function ok(cond, label) {
  if (cond) pass++;
  else failures.push(label);
}

const readRaw = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
// Comment-stripped. The comments on this page quote the very props they
// replaced — `step="1."` and `setupDone ? null : "n."` both appear in prose —
// so a raw scan would let an explanation satisfy an assertion about a render.
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const PAGE = "app/app/settings/voice/page.js";
const ROUTE = "app/api/settings/voice/route.js";
const SWITCH = "app/app/settings/voice/AnswerSwitch.js";
const page = strip(readRaw(PAGE));
const route = strip(readRaw(ROUTE));
const answerSwitch = strip(readRaw(SWITCH));

// ── 1. No step number is a literal any more ────────────────────────────────

ok(!/step="\d/.test(page), `${PAGE} has no hardcoded step number left`);

const steps = [...page.matchAll(/step=\{stepNo\("(\d)\."\)\}/g)].map((m) => m[1]);
ok(steps.length === 7, `all seven cards go through stepNo (got ${steps.length})`);
ok(
  steps.join("") === "1234567",
  `the cards are still numbered 1–7 in file order (got ${steps.join("")})`,
);

// The Card component must not paint a number for a falsy step, or `stepNo`
// returning null would render an empty bold span and a stray gap.
ok(
  /\{step && \(/.test(page),
  `${PAGE}'s Card renders the number only when it has one`,
);

// ── 2. The rule, executed ──────────────────────────────────────────────────

const setupDoneSrc = page.match(/\n  const setupDone = ([^;]+);/);
ok(!!setupDoneSrc, `${PAGE} declares setupDone`);
const stepNoSrc = page.match(/\n  const stepNo = \(n\) => ([^;]+);/);
ok(!!stepNoSrc, `${PAGE} declares stepNo`);

if (setupDoneSrc && stepNoSrc) {
  // The shipped expressions, run. Both are pure functions of the page's own
  // data; nothing here re-implements them.
  const setupDone = new Function(
    "hasAnsweredCall",
    "agent",
    "canEnable",
    "readiness",
    "number",
    `return (${setupDoneSrc[1]});`,
  );
  const stepNo = new Function("setupDone", "n", `return ((n) => ${stepNoSrc[1]})(n);`);

  const OFF = { enabled: false };
  const ON = { enabled: true };

  // A brand-new company, nothing done: numbered.
  ok(
    setupDone(false, null, false, { ready: false }, null) === false,
    "a company that has done nothing still gets the numbered wizard",
  );
  // Number bought, greeting written, switch never touched: still numbered.
  // This is why `providerAgentId` could not be the signal — it is written by
  // the purchase itself, long before anyone finishes.
  ok(
    setupDone(false, OFF, true, { ready: true }, { e164: "+15145550142" }) === false,
    "a company that has never switched it on is still setting up",
  );
  // Switched on five minutes ago, not rung yet: finished.
  ok(
    setupDone(false, ON, true, { ready: true }, { e164: "+1" }) === true,
    "switching it on ends first run",
  );
  // The two regressions. Neither may re-number the page.
  ok(
    setupDone(true, OFF, true, { ready: true }, { e164: "+1" }) === true,
    "switching it off for a week does NOT put the wizard back",
  );
  ok(
    setupDone(true, ON, false, { ready: false, reason: "insufficient_balance" }, { e164: "+1" }) === true,
    "a balance that dipped below one call does NOT put the wizard back",
  );
  ok(
    setupDone(true, OFF, false, { ready: false, reason: "insufficient_balance" }, null) === true,
    "a receptionist that has answered stays finished under every other failure",
  );

  // Independence, proved rather than asserted: flipping ONLY canEnable and
  // readiness must never change the verdict. A `canEnable` slipped into this
  // expression is the exact bug that would ship next.
  let readinessMatters = false;
  for (const answered of [false, true]) {
    for (const a of [null, OFF, ON]) {
      const withReady = setupDone(answered, a, true, { ready: true }, { e164: "+1" });
      const withoutReady = setupDone(answered, a, false, { ready: false }, null);
      if (withReady !== withoutReady) readinessMatters = true;
    }
  }
  ok(!readinessMatters, "readiness/canEnable has no bearing on whether first run is over");

  // And it does depend on both of the two facts it claims to.
  ok(
    setupDone(true, OFF, false, null, null) !== setupDone(false, OFF, false, null, null),
    "hasAnsweredCall genuinely moves the verdict",
  );
  ok(
    setupDone(false, ON, false, null, null) !== setupDone(false, OFF, false, null, null),
    "agent.enabled genuinely moves the verdict",
  );

  // stepNo itself: a number while setting up, nothing afterwards.
  ok(stepNo(false, "3.") === "3.", "stepNo hands the number back during setup");
  ok(stepNo(true, "3.") === null, "stepNo yields null once setup is done");
  ok(stepNo(true, "1.") === null && stepNo(true, "7.") === null, "no card keeps its number");
}

// ── 3. The fact is written AND read ────────────────────────────────────────
//
// Failure class 1 in AGENTS.md: a field written and never read, or read and
// never written. The page's whole rule hangs off one boolean crossing the wire.

ok(/hasAnsweredCall: Boolean\(firstAnsweredCall\)/.test(route), `${ROUTE} sends hasAnsweredCall`);
ok(
  /db\.voiceCall\.findFirst\(\{[\s\S]{0,200}?direction: "inbound"/.test(route),
  `${ROUTE} derives it from an inbound call that really happened`,
);
// Not a count. A company with thousands of calls should not pay for counting
// them to answer a yes/no question.
ok(!/voiceCall\.count\(\{ where: \{ companyId: member\.companyId, direction/.test(route), `${ROUTE} asks findFirst, not count`);
ok(/hasAnsweredCall/.test(page), `${PAGE} reads hasAnsweredCall`);
ok(
  /const \{[^}]*hasAnsweredCall[^}]*\} = data;/.test(page),
  `${PAGE} destructures it off the payload the route actually sends`,
);

// ── 4. The status bar is still the first thing on the page ─────────────────
//
// The header that answers "is my phone being answered right now" landed before
// this change and is the other half of it: numbering can only be dropped
// safely because the live state is stated at the top instead. Losing one while
// keeping the other leaves the page worse than it started.

// `\b`-anchored, not indexOf: a substring match would still be found inside a
// renamed `<VoiceStatusBarSomething>` and report the bar as present when the
// component the page renders is a different one.
const barAt = page.search(/<VoiceStatusBar[\s/>]/);
const firstCardAt = page.search(/<Card[\s/>]/);
ok(barAt > -1, `${PAGE} still renders the status bar`);
ok(firstCardAt > -1, `${PAGE} still renders its cards`);
ok(barAt < firstCardAt, "the status bar is rendered above the first card");
ok(
  /export function VoiceStatusBar/.test(answerSwitch) && /export function AnswerSwitch/.test(answerSwitch),
  `${SWITCH} still owns both the switch and the bar`,
);

// ── 5. The plural is the catalogue's, not an English "s" ───────────────────
//
// `{t("app.setVoice.minute")}{minutes === 1 ? "" : "s"}` bolted an English
// plural onto a translated word: German rendered "Minutes", Italian "minutos".
// Executed against every language rather than grepped, because the failure was
// never visible in the source — it was visible in German.

ok(!/t\("app\.setVoice\.minute"/.test(page), `${PAGE} no longer bolts an "s" onto a translated word`);
ok(/t\("app\.duration\.minutes", \{ value: credit\.minutes \}\)/.test(page), `${PAGE} uses the counted noun`);

const LANGS = Object.keys(APP_MESSAGES);
ok(LANGS.length >= 6, `found the language catalogue (got ${LANGS.length})`);
for (const code of LANGS) {
  const entry = APP_MESSAGES[code]["app.duration.minutes"];
  ok(typeof entry === "function", `${code} declines minutes by its own rules`);
  if (typeof entry !== "function") continue;
  for (const n of [0, 1, 2, 5, 21, 75]) {
    const out = entry({ value: n });
    ok(out.startsWith(`${n} `), `${code} prints the count for ${n} (got ${JSON.stringify(out)})`);
    ok(out.length > String(n).length + 1, `${code} prints a word after the count for ${n}`);
  }
  // Not asserted here: that the word differs from English. French's plural IS
  // "minutes", spelled exactly as English spells it, so that comparison fails
  // on a correct catalogue. The languages where the old "s" was visibly wrong
  // are pinned by name below instead.
}
// The two that were visibly wrong, pinned by name.
ok(APP_MESSAGES.de["app.duration.minutes"]({ value: 2 }) === "2 Minuten", "German says Minuten, not Minutes");
ok(APP_MESSAGES.it["app.duration.minutes"]({ value: 2 }) === "2 minuti", "Italian says minuti, not minutos");
// French: zero is singular. The old expression produced "0 minutes".
ok(APP_MESSAGES.fr["app.duration.minutes"]({ value: 0 }) === "0 minute", "French keeps zero singular");
ok(APP_MESSAGES.fr["app.duration.minutes"]({ value: 2 }) === "2 minutes", "French pluralises from two");

if (failures.length) {
  console.error(`check:voice-setup-steps FAILED — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(
  `check:voice-setup-steps passed — 7 cards, ${LANGS.length} languages, ${pass} assertions.`,
);
