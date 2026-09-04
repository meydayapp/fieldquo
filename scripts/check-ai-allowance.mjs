// scripts/check-ai-allowance.mjs
//
// Warn before blocking — and refuse in a way that names the right remedy.
//
//   npm run check:ai-allowance
//
// ══ What went wrong ════════════════════════════════════════════════════════
//
// lib/ai/usage.js computes `nearLimit` at 80% of the monthly token cap, and
// says in its own comment why: "Someone who hits a wall with no warning
// experiences a broken feature; someone warned at 80% experiences a limit."
// /api/ai/copilot put `{used, cap, nearLimit}` into every successful reply
// under a comment promising the UI would warn at 80%.
//
// Nothing read it. Three routes shipped the field, `grep nearLimit` across
// app/ found zero consumers, and every contractor on the product discovered
// the ceiling by walking into it. A field written and never read is AGENTS.md
// failure class 1; this one was a promise made in a code comment and broken in
// the component next door.
//
// The second half is the refusal. An exhausted allowance arrived as
// `setError(err.message)` and rendered as a small red line by the composer,
// visually identical to a 502 from OpenAI. One is worth retrying and the other
// is a settled fact about the calendar month, and "the assistant is broken" is
// what the red line actually said.
//
// ══ The trap this check exists to hold shut ════════════════════════════════
//
// THE COPILOT'S REFUSAL MUST NOT OFFER THE AI CREDIT TOP-UP. There are two
// different meters in this product and they are easy to conflate:
//
//   * Company.aiMonthlyTokenCap / Plan.aiMonthlyTokenCap — a monthly token
//     ceiling, checked by checkAiQuota. This is what the copilot hits.
//   * The AI credit WALLET — lib/voice/spendGate.js, topped up through
//     AiCreditTopupDialog. This is what the designer's image panels hit.
//
// Buying wallet credit does not raise the token cap by one token. Wiring the
// top-up dialog into this refusal because it is the nearest AI-shaped
// remedy would ship a Buy button that takes a payment and lifts nothing —
// the dead control AGENTS.md's first rule is about, wearing a helpful label.
// Section 3 fails if that dialog ever appears on this page.
//
// ══ Why source assertions here rather than a rendered tree ═════════════════
//
// The consumption question is "does any component read this field", which is a
// fact about the source and is answered exactly by reading it. Comments are
// stripped first — this file and the page both explain the bug at length, and
// a scan that reads its own explanation as the offence is the false pass this
// repo has been burnt by twice already.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

/** Source with block and line comments removed, case preserved. */
const code = (p) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");

let fail = 0;
let pass = 0;
const failures = [];
function ok(label, condition, detail) {
  if (condition) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    failures.push(label);
    console.log(`  FAIL ${label}${detail === undefined ? "" : `  — ${detail}`}`);
  }
}
const section = (t) => console.log(`\n${t}\n`);

const usage = code("lib/ai/usage.js");
const route = code("app/api/ai/copilot/route.js");
const page = code("app/app/copilot/page.js");

// ═══════════════════════════════════════════════════════════════════════════
section("1. The meter still computes and still ships a warning");
//
// Asserted first so a later section cannot pass because the field quietly
// stopped existing. A consumer of a field nobody sends is as dead as a field
// nobody reads.

ok(
  "lib/ai/usage.js warns below the cap rather than only at it",
  /WARN_THRESHOLD\s*=\s*0\.8/.test(usage),
);
ok(
  "...and sets nearLimit from that threshold, not from allowed===false",
  /const nearLimit = usage\.tokens >= cap \* WARN_THRESHOLD/.test(usage),
);
ok(
  "the copilot route puts used/cap/nearLimit on a SUCCESSFUL reply",
  /nearLimit: quota\.nearLimit/.test(route) && /used: quota\.usage\.tokens/.test(route),
);
ok(
  "...and sends null rather than an invented ceiling when the account is uncapped",
  /quota\.cap\s*\?[\s\S]{0,200}?:\s*null/.test(route),
);
ok(
  "the route refuses an exhausted allowance with a machine-readable flag, not only English",
  /quotaExceeded: true/.test(route) && /status: 429/.test(route),
);

// ═══════════════════════════════════════════════════════════════════════════
section("2. Somebody actually reads it");

ok(
  "the copilot page stores the usage the route sends",
  /setUsage\(data\.usage/.test(page),
);
ok(
  "...and renders a warning gated on nearLimit",
  /usage\?\.nearLimit/.test(page),
);
ok(
  "...naming how much of the allowance is gone",
  /app\.copilot\.nearLimit/.test(page),
);

// The percentage must survive a used-count of 0 and must not be invented from
// an absent one. `Number(undefined)` is NaN and `Number(null)` is 0, and 0 is
// finite — the trap that produced four bugs in this repo in one week. A
// truthiness guard would suppress a legitimate 0% and admit a NaN%.
ok(
  "the percentage is guarded on the figures being FINITE, not on them being truthy",
  /Number\.isFinite\(usage\.used\)/.test(page) && /Number\.isFinite\(usage\.cap\)/.test(page),
);
ok(
  "...and cannot divide by a zero cap",
  /usage\.cap > 0/.test(page),
);
ok(
  "an uncapped account is told nothing rather than shown a made-up ceiling",
  /setUsage\(data\.usage \?\? null\)/.test(page),
);

// ═══════════════════════════════════════════════════════════════════════════
section("3. The refusal is its own thing, and offers the RIGHT remedy");

ok(
  "an exhausted allowance is held apart from a transport error",
  /setOutOfAllowance\(true\)/.test(page) && /const \[outOfAllowance/.test(page),
);
ok(
  "...decided by the route's flag and status, never by matching an English sentence",
  /err\.status === 429 && err\.data\?\.quotaExceeded/.test(page),
);
ok(
  "...and it does NOT also fire the red error line",
  /err\.status === 429 && err\.data\?\.quotaExceeded\)\s*\{\s*setOutOfAllowance\(true\);\s*setError\(""\)/.test(
    page,
  ),
);
ok(
  "the reason and the disabled composer are one block — the input is disabled by the same flag",
  /disabled=\{outOfAllowance\}/.test(page) &&
    /disabled=\{sending \|\| outOfAllowance/.test(page),
);
ok(
  "...and the reason sits inside the composer's own region, above the input",
  (() => {
    const border = page.lastIndexOf("border-t border-border");
    const reason = page.indexOf("outOfAllowance &&", border);
    const input = page.indexOf("<input", border);
    return border > -1 && reason > border && input > reason;
  })(),
);
ok(
  "the refusal says the allowance resets rather than only that something failed",
  /app\.copilot\.outTitle/.test(page) && /app\.copilot\.outBody/.test(page),
);

// The trap. See this file's header for why buying wallet credit cannot lift a
// token cap.
ok(
  "the AI credit top-up is NOT offered — wallet credit does not raise a token cap",
  !/AiCreditTopupDialog|useAiCreditTopup|\/api\/ai\/topup/.test(page),
);
ok(
  "...and the page sends nobody to the wallet page to fix a cap either",
  !/settings\/ai-credit/.test(page),
);

// ═══════════════════════════════════════════════════════════════════════════
section("4. The other two emitters, reported");
//
// /api/quotes/[id]/review and /api/voice/calls/[id]/draft-quote ship the same
// object to screens that also ignore it. Those screens belong to other passes,
// so this REPORTS rather than fails — an unconsumed emitter is visible here
// instead of being rediscovered from scratch. Failing on someone else's page
// would turn main red for work this pass did not do.

const OTHER_EMITTERS = [
  "app/api/quotes/[id]/review/route.js",
  "app/api/voice/calls/[id]/draft-quote/route.js",
];
for (const f of OTHER_EMITTERS) {
  const emits = /nearLimit: quota\.nearLimit/.test(code(f));
  console.log(`  note  ${f} ${emits ? "still ships nearLimit" : "no longer ships nearLimit"}`);
}

console.log(
  failures.length
    ? `\nFAILED — ${failures.length} of ${pass + failures.length}\n${failures.map((f) => `  x ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fail ? 1 : 0);
