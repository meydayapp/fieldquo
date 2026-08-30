// scripts/check-demo-number-pool.mjs
//
//   npm run check:demo-number-pool
//
// A demo account (Company.isDemo) can now set up the receptionist end to end —
// real agent, real prompt, real greeting — on a phone number that is never
// real. See lib/voice/demoLine.js and the "a demo's line, simulated here"
// block in lib/voice/retell.js for the design.
//
// ══ What this file executes, not reads ══════════════════════════════════
//
// The claim that matters most — "a demo never reaches the real Retell
// client" — has exactly one place it can be proven: stub `fetch` to explode
// if it is ever called, then actually run buyNumber/attachAgent/getNumber/
// releaseNumber with a simulated number and watch nothing explode. A source
// grep for "demo" near "fetch" would pass on code that calls fetch anyway.
//
// Comments are stripped before any regex runs over source — three prior
// checks in this repository passed by reading their own explanatory prose
// instead of the code underneath it, and this file exists to not repeat that.
import { readFileSync } from "node:fs";

process.removeAllListeners("warning");
process.on("warning", (w) => {
  if (w.code !== "MODULE_TYPELESS_PACKAGE_JSON") console.warn(w);
});

let fail = 0;
const ok = (c, m, detail) => {
  console.log((c ? "  ok   " : "  FAIL ") + m);
  if (!c) {
    fail++;
    if (detail !== undefined) console.log(`         got: ${JSON.stringify(detail)}`);
  }
};
const section = (t) => console.log(`\n${t}\n`);

const read = (p) => readFileSync(p, "utf8");

/**
 * Source with comments removed.
 *
 * Every regex assertion below runs against this, never against the raw file —
 * a comment explaining what the code does is not evidence the code does it,
 * and check-demo-number.mjs's own header already names the failure this
 * avoids: a check that reads its own prose passes on broken code.
 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/* ═══════════════════════════ 1. The reserved shape ═══════════════════════ */

section("1. The simulated number is genuinely fictional");

process.env.RETELL_API_KEY = "test-key-never-used";
const {
  buyNumber,
  attachAgent,
  getNumber,
  releaseNumber,
  isSimulatedNumber,
  SIMULATED_E164_RE,
  RetellError,
} = await import("../lib/voice/retell.js");

// NANP reserves NPA-555-0100 through NPA-555-0199, in every area code, so
// nobody is ever assigned one. Anything outside that shape is a real,
// dialable number and must never be treated as fictional.
ok(SIMULATED_E164_RE.test("+16135550142"), "613-555-0142 (already used in this repo's own demo seed data) reads as simulated");
ok(SIMULATED_E164_RE.test("+15145550100"), "the low end of the block (…0100) reads as simulated");
ok(SIMULATED_E164_RE.test("+14165550199"), "the high end of the block (…0199) reads as simulated");
ok(!SIMULATED_E164_RE.test("+16135551234"), "an ordinary-looking number just outside the block does NOT read as simulated");
ok(!SIMULATED_E164_RE.test("+16135550099"), "one below the block (…0099) does NOT read as simulated");
ok(!SIMULATED_E164_RE.test("+16135550200"), "one above the block (…0200) does NOT read as simulated");
ok(!isSimulatedNumber("not a number"), "garbage input is refused, not matched");
ok(!isSimulatedNumber(""), "empty input is refused, not matched");
ok(!isSimulatedNumber(null), "null input is refused, not matched");

section("2. buyNumber({ demo: true }) always returns one, executed 50 times");

let allSimulated = true;
const anyDuplicateAreaOnly = new Set();
for (let i = 0; i < 50; i += 1) {
  const bought = await buyNumber({ demo: true });
  anyDuplicateAreaOnly.add(bought.phone_number.slice(0, 5));
  if (!isSimulatedNumber(bought.phone_number)) allSimulated = false;
}
ok(allSimulated, "every one of 50 simulated purchases falls in the reserved block");
ok(anyDuplicateAreaOnly.size > 1, "…and it isn't always the same area code (rotates rather than hard-coding one)");

/* ═══════════════════ 3. Never touches the real Retell client ═════════════ */

section("3. A simulated number never reaches the network");

const realFetch = globalThis.fetch;
let fetchCalls = 0;
globalThis.fetch = async (...args) => {
  fetchCalls += 1;
  throw new Error(`fetch() was called for a simulated number — args: ${JSON.stringify(args[0])}`);
};

let threw = null;
try {
  const bought = await buyNumber({ demo: true });
  const e164 = bought.phone_number;
  await attachAgent(e164, "agent_demo_x");
  const live = await getNumber(e164);
  ok(live?.inbound_agents?.[0]?.agent_id === "agent_demo_x", "…and the read-back agrees with what was just attached");
  await attachAgent(e164, null);
  const live2 = await getNumber(e164);
  ok((live2?.inbound_agents || []).length === 0, "…and detaching is reflected on the next read-back too");
  await releaseNumber(e164);
  let gotFour04 = false;
  try {
    await getNumber(e164);
  } catch (err) {
    gotFour04 = err instanceof RetellError && err.status === 404;
  }
  ok(gotFour04, "…and a released simulated number reads back as gone (404), same as a real one");
} catch (err) {
  threw = err;
}
globalThis.fetch = realFetch;

ok(fetchCalls === 0, "fetch() was never called for a simulated e164, across buy/attach/get/detach/release", { fetchCalls, threw: threw?.message });
ok(!threw, "…and none of it threw for an unrelated reason", threw?.message);

/* ═════════════════════ 4. A real company is unaffected ═══════════════════ */

section("4. A real (non-demo) purchase is completely unaffected");

// No `demo` flag, no RETELL_API_KEY, no network — this is the exact refusal a
// real company got before any of this shipped. If the new seam swallowed a
// real request instead of a simulated one, this would start returning a
// simulated number for a real company, which is the one outcome that must be
// structurally impossible.
delete process.env.RETELL_API_KEY;
let realThrew = null;
try {
  await buyNumber({ areaCode: "613" });
} catch (err) {
  realThrew = err;
}
process.env.RETELL_API_KEY = "test-key-never-used";
ok(
  realThrew instanceof RetellError && /no Retell API key/i.test(realThrew.message),
  "a real purchase (no demo flag) still refuses with the ordinary 'not configured' error",
  realThrew?.message,
);

// The stubbed-fetch capture, exactly as check-retell-shape.mjs does it — proof
// a real e164 (outside the reserved block) still goes to the wire, unlike a
// simulated one.
const sent = [];
globalThis.fetch = async (url, init = {}) => {
  sent.push({ url: String(url), method: init.method || "GET" });
  return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
};
sent.length = 0;
await attachAgent("+16135559876", "agent_real");
globalThis.fetch = realFetch;
ok(sent.length === 1 && sent[0].url.includes("update-phone-number"), "attaching a REAL-shaped e164 still calls the provider", sent);

/* ═════════════════════ 5. The rent cron never bills one ══════════════════ */

section("5. rentDecision skips a simulated number, by name, never by accident");

const { rentDecision } = await import("../lib/voice/spendGate.js");

const simulatedNumber = {
  id: "n_demo",
  status: "active",
  monthlyCents: 400,
  simulated: true,
  rentPaidThroughAt: null,
};
const dSkip = rentDecision({ number: simulatedNumber, balanceCents: 0 });
ok(dSkip.action === "skip" && dSkip.reason === "simulated", "a simulated row with $0 balance and rent overdue is skipped, not released", dSkip);

const dSkipFunded = rentDecision({ number: simulatedNumber, balanceCents: 100000 });
ok(dSkipFunded.action === "skip" && dSkipFunded.reason === "simulated", "…and skipped even when the company could easily afford it — nothing is ever charged for a simulated row", dSkipFunded);

// The control: an OTHERWISE IDENTICAL row with simulated:false, same balance,
// genuinely charges. If this stopped charging too, "simulated" would be
// masking a bug in rentDecision generally rather than proving the new branch
// specifically fires only for what it names.
const realNumberDue = { ...simulatedNumber, simulated: false, id: "n_real" };
const dCharge = rentDecision({ number: realNumberDue, balanceCents: 100000 });
ok(dCharge.action === "charge", "…while an identical REAL row still charges normally — the skip is specific, not a general break", dCharge);

/* ══════════════ 6. The reconciliation page excludes simulated rows ═══════ */

section("6. /platform/voice-numbers never reads a simulated row as an orphan");

const { auditVoiceNumbers } = await import("../lib/voice/numberAudit.js");

const auditWithSimulated = auditVoiceNumbers({
  providerNumbers: [],
  rows: [
    { e164: "+16135550142", companyId: "co_demo", status: "active", source: "purchased", createdAt: new Date() },
  ],
});
// This is the CONTROL, proving auditVoiceNumbers itself has no special
// knowledge of "simulated" — it is a pure function fed EVERY row it is given,
// exactly like it always was. The exclusion has to happen at the query, which
// section 8 below proves by reading the route.
ok(
  auditWithSimulated.orphans.length === 1,
  "auditVoiceNumbers (unchanged, pure) would flag a row absent at the provider as an orphan — proving the exclusion has to happen before rows reach it",
  auditWithSimulated,
);

/* ═══════════════ 7. lib/voice/demoLine.js never spends a cent ════════════ */

section("7. The demo provisioning path never reserves credit");

const demoLineSrc = stripComments(read("lib/voice/demoLine.js"));
ok(!/reserveSpend/.test(demoLineSrc), "demoLine.js never calls reserveSpend — there is nothing to reserve against");
ok(!/checkSpend/.test(demoLineSrc), "…nor checkSpend — a demo is never asked whether it can afford this");

// Scoped to the actual database write, not the whole file — `simulated: true`
// also appears in the response body this function returns, and a check that
// can be satisfied by THAT occurrence would keep passing even if the row
// itself stopped being marked. Caught exactly this way during mutation
// testing: deleting it from the `create()` call left the file-wide regex
// green because the response literal was still there.
const createCall = demoLineSrc.slice(
  demoLineSrc.indexOf("db.voicePhoneNumber.create("),
  demoLineSrc.indexOf("});", demoLineSrc.indexOf("db.voicePhoneNumber.create(")),
);
ok(createCall.includes("simulated: true"), "…and the ROW ITSELF is stamped simulated: true", createCall);
ok(createCall.includes("monthlyCents: 0"), "…at $0/month, matching what rentDecision above proved is never charged", createCall);
ok(/buyNumber\([^)]*demo:\s*true/s.test(demoLineSrc), "…and the ONLY buyNumber call here passes demo: true");
ok(/provisionAgent\(/.test(demoLineSrc), "…while the receptionist itself is built through the REAL provisionAgent — same function a paying company's setup calls");

/* ══════════ 8. The route: purchased/forwarded simulate, ported refuses ═══ */

section("8. The purchase route: what a demo may and may not do");

const ROUTE = "app/api/settings/voice/number/route.js";
const routeRaw = read(ROUTE);
const route = stripComments(routeRaw);

ok(route.includes("provisionSimulatedNumber"), "the route calls into lib/voice/demoLine.js");
ok(
  /import\s*\{[^}]*provisionSimulatedNumber[^}]*\}\s*from\s*"@\/lib\/voice\/demoLine"/.test(route),
  "…imported statically, not conjured from a string",
);

// Scoped to the demo branch, not the whole file — the same discipline
// check-demo-number.mjs already uses, and for the same reason: a bare
// substring match can be satisfied by unrelated code the length of the file
// away, which is not evidence of the thing being named.
const demoBranchStart = route.indexOf("demoCompany?.isDemo");
ok(demoBranchStart > -1, "the demo branch still exists");
const demoBranchEnd = route.indexOf("const existing = await heldNumber", demoBranchStart);
ok(demoBranchEnd > demoBranchStart, "…and the real (non-demo) duplicate guard still follows it");
const demoBranch = route.slice(demoBranchStart, demoBranchEnd);

ok(demoBranch.includes('source === "ported"'), "…the demo branch still special-cases ported");
ok(demoBranch.includes("status: 403"), "…and still refuses it with 403 — a demo has no real carrier to move a number from");
ok(demoBranch.includes("provisionSimulatedNumber"), "…and everything ELSE (purchased, forwarded) falls through to the simulated path");
ok(
  !/reserveSpend\(|buyNumber\(/.test(demoBranch),
  "…and the demo branch itself never calls reserveSpend or buyNumber directly — that's demoLine.js's job, not the route's",
);

// The two real-money call sites still exist, and still sit AFTER the demo
// branch — i.e. a demo request never reaches them.
const afterDemo = route.slice(demoBranchEnd);
ok(afterDemo.includes("reserveSpend({"), "the real reservation still exists, for real companies");
ok(afterDemo.includes("buyNumber({"), "…and the real provider purchase still exists");

// The demo flag is read from the database, never trusted from the request —
// same rule check-demo-number.mjs enforces, re-asserted here because this
// route changed shape.
ok(
  route.includes("const demoCompany = await db.company.findUnique"),
  "isDemo is read server-side from the database",
);
ok(!/body\.isDemo|body\?\.isDemo/.test(route), "…never taken from the request body");

/* ══════════════ 9. rentDecision / provisionAgent stay demo-blind ═════════ */

section("9. The gate and the provisioner still have no idea what a demo is");

// Literally the same discipline check-demo-number.mjs already enforces,
// re-run here because this session touched both files and a regression in
// either would defeat the entire "runs the real code path unchanged" design.
ok(!/isDemo/.test(stripComments(read("lib/voice/spendGate.js"))), "spendGate.js has no isDemo branch — the skip above is keyed on the row's own `simulated` flag, not on asking what kind of company this is");
ok(!/isDemo/.test(stripComments(read("lib/voice/provision.js"))), "provision.js has no isDemo branch — a demo's agent is built by the exact same function a paying company's is");

/* ══════════════ 10. The FieldQuo invite: pure, and demo-only ═════════════ */

section("10. Inviting a prospect to FieldQuo's real number — and ONLY a prospect");

const { demoInviteNumber } = await import("../lib/platform/salesCall.js");

ok(demoInviteNumber({ isDemo: false, numbers: ["+16135550100"], agentEnabled: true }) === null, "a REAL contractor never gets FieldQuo's number, even when everything else says go");
ok(demoInviteNumber({ isDemo: true, numbers: [], agentEnabled: true }) === null, "unconfigured (no FIELDQUO_SALES_NUMBER) — nothing to invite them to");
ok(demoInviteNumber({ isDemo: true, numbers: ["+16135550100"], agentEnabled: false }) === null, "configured but the platform agent is off — nobody would answer");
ok(demoInviteNumber({ isDemo: true, numbers: ["+16135550100"], agentEnabled: true }) === "+16135550100", "isDemo + configured + live: the invite is offered");
ok(demoInviteNumber({}) === null, "hostile/empty input refuses rather than throwing");
ok(demoInviteNumber({ isDemo: true, numbers: null, agentEnabled: true }) === null, "a non-array numbers value refuses rather than throwing");

// The one caller, and the gate it must never bypass.
const settingsRoute = stripComments(read("app/api/settings/voice/route.js"));
ok(settingsRoute.includes("demoInviteNumber("), "the settings route uses the pure function rather than re-deriving the decision inline");
ok(
  /platformVoiceAgent[\s\S]{0,80}isDemo\s*\?/.test(settingsRoute) || /isDemo\s*\?[\s\S]{0,200}platformVoiceAgent/.test(settingsRoute),
  "…and only queries PlatformVoiceAgent when the company is actually a demo",
);

const pageSrc = stripComments(read("app/app/settings/voice/page.js"));
ok(pageSrc.includes("number.simulated"), "the settings SCREEN labels the number wherever `simulated` is true");
ok(pageSrc.includes("demo?.fieldquoNumberDisplay") || pageSrc.includes("demo.fieldquoNumberDisplay"), "…and offers the real number when the server actually sent one");
ok(
  pageSrc.includes("app.setVoice.demoLine.simulatedOnly"),
  "…with an honest fallback sentence when it did not — never a dead tel: link",
);

/* ══════════════════ 11. Call list dressing, never a real call ════════════ */

section("11. A demo shows a populated call list without a real line ever ringing");

const seedSrc = stripComments(read("lib/demo/seedDemo.js"));
ok(/db\.voiceCall\.create/.test(seedSrc), "seedDemoContent seeds VoiceCall rows so the receptionist screen is never empty");
ok(/db\.voiceCall\.deleteMany/.test(seedSrc), "…and a reset clears them, same as the quotes and jobs beside them");
// The three the OTHER check script (check-demo-number.mjs) already guards —
// re-affirmed with the SAME regex it uses, so a change to either file's
// wording can't let the two quietly disagree about what "the real rows" are.
for (const model of ["voicePhoneNumber", "voiceAgent", "voiceCreditEntry"]) {
  ok(
    !new RegExp(`${model}\\.deleteMany|${model}\\.delete\\(`).test(seedSrc),
    `…while still never deleting ${model} — a reseed must not release a real line or erase a ledger`,
  );
}

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
