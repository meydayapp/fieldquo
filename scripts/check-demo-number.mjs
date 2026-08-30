// scripts/check-demo-number.mjs
//
// A demo account may not buy a real telephone number.
//
// ══ Why this is a rule and not a preference ════════════════════════════════
//
// Everything about a purchased number outlives the demo that bought it.
//
//   The reset does not release it. lib/demo/seedDemo.js deletes quotes, jobs,
//   invoices, clients, appointments, leads and products, and deliberately does
//   NOT touch VoicePhoneNumber or VoiceAgent — which is correct, because a
//   routine reseed must never perform an irreversible release. So the number
//   survives every reset while Retell keeps billing for it, attached to a
//   company nobody owns. That is the silent recurring waste already fixed once
//   for cancelled subscriptions, arriving through a different door.
//
//   It is a REAL line a stranger can dial. Demos are re-dressed as different
//   trades between prospects (lib/demo/industries.js), so one number would
//   answer as a painter this week and a roofer next, and anyone ringing it
//   afterwards reaches a business that does not exist.
//
// ══ Refused on the SERVER ══════════════════════════════════════════════════
//
// Not by hiding the button. The person clicking it holds user:manage on their
// own demo company — they are authorised for everything else on that screen —
// so the only thing that actually stops the purchase is the route. Hiding a
// control is not access control, which this repo states in its own
// non-negotiables.
import { readFileSync } from "node:fs";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);
// Comments in this repo explain WHY at length, and a regex that reads its own
// justification passes on broken code. Two prior check scripts did exactly
// that, so source is stripped before anything is matched against it.
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const ROUTE = stripComments(readFileSync("app/api/settings/voice/number/route.js", "utf8"));
const SEED = readFileSync("lib/demo/seedDemo.js", "utf8");
const MESSAGES = readFileSync("app/i18n/appMessages.js", "utf8");

section("1. The purchase route refuses a demo");

ok(/isDemo/.test(ROUTE), "the buy-a-number route knows what a demo is");
ok(/demoCompany\?\.isDemo/.test(ROUTE), "…and branches on it", ROUTE.match(/demoCompany\?\.isDemo[^\n]*/)?.[0]);
ok(/reason: "demo_account"/.test(ROUTE), "…with a reason a screen can act on, not a bare 500");
// Scoped to the demo refusal block. `/status: 403/` alone matched the PERMISSION
// refusal higher in the same file, so changing the demo one to a 500 passed
// cleanly — mutation testing caught it. An assertion that can be satisfied by
// unrelated code a hundred lines away is not testing the thing it names.
const demoBlock = ROUTE.slice(ROUTE.indexOf("demoCompany?.isDemo"), ROUTE.indexOf("const existing = await heldNumber"));
ok(
  /status: 403/.test(demoBlock),
  "…and a 403: they are signed in, this is simply not a thing a demo may do",
  demoBlock.match(/status: \d+/)?.[0],
);

section("2. Refused BEFORE any money or any provider call");

// Measured against CALL SITES, not the first textual match. The first version
// of this compared positions of the bare names and failed on correct code,
// because both appear in the import block at the top of the file long before
// anything executes. An assertion that fails on a working build is as useless
// as one that passes on a broken one.
const BODY = ROUTE.slice(ROUTE.lastIndexOf("import "));
const demoAt = BODY.indexOf("demoCompany?.isDemo");
ok(demoAt > -1, "the demo guard is in the handler body, not only in an import");
for (const [label, call] of [
  ["the credit reservation", "reserveSpend({"],
  ["the provider purchase", "buyNumber("],
]) {
  const at = BODY.indexOf(call);
  // If the guard sat after the reservation, a demo would be charged for a
  // number it is then refused — the worst of both outcomes.
  ok(at === -1 || demoAt < at, `the guard runs before ${label}`, { demoAt, at });
}

section("3. It is the ROUTE that refuses, not the screen");

ok(
  /const demoCompany = await db\.company\.findUnique/.test(ROUTE),
  "the flag is read server-side from the database, not taken from the request",
);
ok(
  !/body\.isDemo|body\?\.isDemo/.test(ROUTE),
  "…and never from the body, which the caller controls",
);

section("4. The refusal reaches a French contractor in French");

const key = "app.setVoice.number.demoBlocked";
ok(new RegExp(`errorKey: "${key}"`).test(ROUTE), "the refusal carries a translation key, because a route has no t()");
const blocks = MESSAGES.split(`"${key}"`).length - 1;
ok(blocks >= 2, "…and the key is defined in both gated languages", blocks);
ok(/démonstration/.test(MESSAGES), "…with real French, not the English string copied across");

section("5. The reset still does not release anything");

// The tempting fix is to make the reset release the number. It is the wrong
// one: releasing is irreversible, is deliberately gated behind a typed
// confirmation, and wiring it into a routine reseed is the "destructive
// operations labelled as cosmetic" failure AGENTS.md names.
for (const model of ["voicePhoneNumber", "voiceAgent", "voiceCreditEntry"]) {
  ok(
    !new RegExp(`${model}\\.deleteMany|${model}\\.delete\\(`).test(SEED),
    `the demo reset does not delete ${model} — a reseed must never release a real line or erase a ledger`,
  );
}
ok(
  /deleteMany/.test(SEED),
  "…while still resetting the business data it is supposed to reset",
);

section("6. Everything else about the receptionist still demos");

// The point is to withhold the act of provisioning a real line at a real
// carrier — not to make the feature invisible to a prospect.
ok(
  !/isDemo/.test(stripComments(readFileSync("lib/voice/spendGate.js", "utf8"))),
  "the spend gate has no demo branch — one code path, so the paid one cannot drift from the demo one",
);
ok(
  !/isDemo/.test(stripComments(readFileSync("lib/voice/provision.js", "utf8"))),
  "…and neither does provisioning, so a demo agent is built exactly like a real one",
);

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
