// scripts/check-platform-diagnostics.mjs
//
// The platform console's failure messages, EXECUTED.
//
// ══ What this is for ═══════════════════════════════════════════════════════
//
// Three screens were reporting failures the owner could do nothing with:
// "Couldn't read the voice numbers just now", "Couldn't check the agents just
// now", and six identical rows of "We couldn't check this one. Nothing is
// claimed either way." His words: "i have no idea what to do with that
// information."
//
// Each was honest — none claimed success — and each was useless, because a
// message that admits ignorance without naming its cause offers no next step.
// The properties below are the missing half, and none of them can be checked by
// reading:
//
//   1. FOUR CAUSES, FOUR SENTENCES. Unconfigured, rejected, unreachable and
//      empty are different situations with different remedies, and were being
//      collapsed into one shrug.
//   2. NO MESSAGE CARRIES A SECRET'S VALUE. These strings are rendered in a
//      browser, and the natural thing for an API to echo on an auth failure is
//      the credential it refused.
//   3. A CHAIN POINTS AT THE FIRST BREAK. Where link 2 is missing, links 3+ say
//      what they are waiting on rather than reporting their own ignorance six
//      times over.
//   4. THE HONESTY IS NOT TRADED AWAY. Nothing here may turn an unknown into a
//      claim. Naming the cause of an unknown is the whole change; upgrading it
//      would undo the work this console has already had done to it.
//   5. THE CLIENT STILL CARRIES THE REASON. Both screens hand-rolled
//      `if (!res.ok)` against fetchJson — which returns the parsed BODY and
//      THROWS — so the error branch ran on every successful response and the
//      fallback string was the only thing either page could ever render. That
//      is asserted here as a source rule, brace-matched to the one function, so
//      it cannot come back by copy-paste the way it arrived.
//
// Run: npm run check:platform-diagnostics

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  describeVendorFailure,
  describeDatabaseFailure,
  describeFailure,
  describeEmpty,
  classifyVendorError,
  scrubSecrets,
  isTransient,
  DIAGNOSIS_KINDS,
  SECRET_ENV_VARS,
} from "../lib/platform/diagnostics.js";
import { resolveReadiness } from "../lib/voice/readiness.js";
import { REASON_TEXT, LINK_LABEL } from "../lib/voice/readinessCopy.js";
import { platformLinkText, PLATFORM_REASON_TEXT } from "../lib/platform/salesReadinessCopy.js";
import { sharedLineAdvice } from "../lib/crew/sharedLineAdvice.js";
import { RetellError } from "../lib/voice/retell.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let fail = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) {
    fail++;
    console.log(`FAIL  ${name}${extra ? " — " + extra : ""}`);
  } else console.log(`pass  ${name}`);
};

/**
 * The body of one named function, brace-matched.
 *
 * ── Why not a regex over the whole file ────────────────────────────────────
 *
 * Because `src.indexOf(a) < src.indexOf(b)` reports a false PASS the moment `a`
 * is absent: indexOf returns -1, which is less than everything, and the rule
 * silently stops testing anything. Every string rule below is therefore scoped
 * to one function that must exist — a missing function is a failure, not a
 * pass — and the search is bounded to its braces so a match in a neighbouring
 * function cannot satisfy it.
 *
 * `signature` must run right up to the body's opening brace. A destructured
 * parameter list opens a brace of its own — `function F({ a, b }) {` — and
 * taking the first `{` after the NAME matches that one instead, returning
 * "{ a, b }" as the body. Every string rule below then passes for nothing,
 * which is the same false-pass this helper exists to avoid.
 */
function functionBody(src, signature) {
  const at = src.indexOf(signature);
  if (at === -1) return null;
  // PAST the signature, not from its start — searching from `at` finds the
  // destructuring brace the signature was written to step over.
  const open = src.indexOf("{", at + signature.length);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

console.log("\n══ 1. every failure has its own cause and its own remedy ══\n");

/* ── an unset environment variable ─────────────────────────────────────────
 *
 * The one failure Refresh can never fix, and the one the old copy was least
 * able to distinguish from a network blip.
 */
const unset = describeVendorFailure(
  { kind: "not_configured" },
  { vendor: "Retell", envVar: "RETELL_API_KEY" },
);
ok("an unset key is its own kind", unset.kind === "not_configured", unset.kind);
ok("an unset key names the variable", unset.message.includes("RETELL_API_KEY"));
ok("an unset key says where to set it", /Vercel/.test(unset.message));
ok(
  "an unset key is not offered as transient — Refresh cannot fix it",
  unset.transient === false,
);
ok(
  "an unset key says nothing was asked, rather than implying a failed ask",
  /never asked|not configured/i.test(unset.message),
  unset.message,
);

/* ── a vendor 401 ─────────────────────────────────────────────────────────── */
const rejected = describeVendorFailure(
  new RetellError("Invalid API key", { status: 401, endpoint: "/get-concurrency" }),
  { vendor: "Retell", envVar: "RETELL_API_KEY" },
);
ok("a 401 is 'rejected', not 'unreachable'", rejected.kind === "rejected", rejected.kind);
ok("a 401 says the status out loud", rejected.message.includes("401"));
ok(
  "a 401 distinguishes 'set but refused' from 'not set'",
  /set and .*refused|refused it/i.test(rejected.message),
  rejected.message,
);
ok("a 401 is not transient", rejected.transient === false);
ok(
  "a 401 tells the reader Refresh will not help",
  /Refreshing will not|not a network/i.test(rejected.message),
  rejected.message,
);

/* ── a vendor 429 ─────────────────────────────────────────────────────────── */
const limited = describeVendorFailure(
  new RetellError("rate limit exceeded", { status: 429 }),
  { vendor: "Retell", envVar: "RETELL_API_KEY" },
);
ok("a 429 is 'rate_limited'", limited.kind === "rate_limited", limited.kind);
ok("a 429 is transient", limited.transient === true);
ok(
  "a 429 says the configuration is NOT the problem",
  /Nothing is wrong with the configuration/i.test(limited.message),
  limited.message,
);
ok(
  "a 429 does not send anyone to Vercel",
  !/Vercel/.test(limited.message),
  limited.message,
);

/* ── a timeout ────────────────────────────────────────────────────────────── */
const timedOut = describeVendorFailure(
  new RetellError("The phone provider didn't respond in time.", {
    status: 504,
    kind: "timeout",
    timeoutMs: 15000,
  }),
  { vendor: "Retell", envVar: "RETELL_API_KEY" },
);
ok("a timeout is 'timeout', not 'provider_error'", timedOut.kind === "timeout", timedOut.kind);
ok(
  "a timeout quotes the real budget rather than a number typed into copy",
  timedOut.message.includes("15s"),
  timedOut.message,
);
ok("a timeout is transient and says so", timedOut.transient === true);
ok("a timeout offers Refresh", /Refresh/.test(timedOut.message));
ok(
  "a timeout claims nothing about the result",
  /Nothing is claimed/i.test(timedOut.message),
  timedOut.message,
);

// The same failure WITHOUT the kind — an older error object, or another vendor's
// client. It must still not be reported as a 5xx from the provider.
ok(
  "a 504 with no kind is still read as a timeout",
  classifyVendorError({ status: 504 }) === "timeout",
);
ok("an AbortError is a timeout wherever it comes from", classifyVendorError({ name: "AbortError" }) === "timeout");

/* ── a transport failure ──────────────────────────────────────────────────── */
const unreachable = describeVendorFailure(
  new RetellError("Couldn't reach the phone provider: fetch failed", {
    status: 0,
    kind: "unreachable",
  }),
  { vendor: "Retell", envVar: "RETELL_API_KEY" },
);
ok("no reply at all is 'unreachable'", unreachable.kind === "unreachable");
ok(
  "unreachable is told apart from unconfigured, which shared status 0 before this",
  unreachable.kind !== unset.kind && unreachable.message !== unset.message,
);

/* ── a P1001 from a cold Neon ─────────────────────────────────────────────── */
const cold = describeDatabaseFailure({ code: "P1001", message: "Can't reach database server" });
ok("P1001 is its own kind", cold.kind === "database_cold", cold.kind);
ok("P1001 says Neon scales to zero", /scales to zero/i.test(cold.message));
ok("P1001 says to retry once before believing it is down", /Refresh once|retry/i.test(cold.message));
ok("P1001 is transient", cold.transient === true);

const dbBroken = describeDatabaseFailure({ code: "P2002", message: "Unique constraint failed" });
ok("a non-cold database failure is a different kind", dbBroken.kind === "database_error");
ok("a non-cold database failure is NOT offered as transient", dbBroken.transient === false);
ok(
  "a non-cold database failure says Refresh will not clear it",
  /will not clear/i.test(dbBroken.message),
  dbBroken.message,
);

// describeFailure has to route each to the right describer without importing
// Prisma — a check script that needed a database would not run here at all.
ok(
  "a Prisma-shaped error routes to the database describer",
  describeFailure({ code: "P1001", message: "x" }).kind === "database_cold",
);
ok(
  "a vendor error routes to the vendor describer",
  describeFailure(new RetellError("no", { status: 401 }), { vendor: "Retell" }).kind === "rejected",
);

/* ── empty is not an error ────────────────────────────────────────────────── */
const empty = describeEmpty({ subject: "no calls in the last 30 days" });
ok("an empty result is its own kind, not a failure kind", empty.kind === "empty");
ok(
  "an empty result says the read SUCCEEDED",
  /succeeded/i.test(empty.message),
  empty.message,
);
ok(
  "an empty result never blames the provider",
  !/couldn't|could not|failed|refused/i.test(empty.message),
  empty.message,
);
ok(
  "empty and unreachable do not read the same",
  empty.message !== unreachable.message && empty.kind !== unreachable.kind,
);
// And it is actually rendered, rather than exported for nobody — a helper with
// no reader is the same fault as a column with no reader.
ok(
  "the empty note is sent by the route",
  /emptyNote: calls\.length === 0 \? describeEmpty/.test(
    read("app/api/platform/voice-economics/route.js"),
  ),
);
ok(
  "the empty note is rendered by the page",
  /data\.emptyNote/.test(read("app/platform/voice-economics/page.js")),
);

/* ── every kind is accounted for ──────────────────────────────────────────── */
const produced = new Set(
  [
    unset, rejected, limited, timedOut, unreachable, cold, dbBroken,
    describeVendorFailure(new RetellError("x", { status: 403 }), { vendor: "Retell" }),
    describeVendorFailure(new RetellError("x", { status: 404 }), { vendor: "Retell" }),
    describeVendorFailure(new RetellError("x", { status: 400 }), { vendor: "Retell" }),
    describeVendorFailure(new RetellError("x", { status: 503 }), { vendor: "Retell" }),
    describeVendorFailure({}, { vendor: "Retell" }),
  ].map((d) => d.kind),
);
const unproducible = DIAGNOSIS_KINDS.filter((k) => !produced.has(k));
ok(
  "every declared kind can actually be produced — no sentence written for nobody",
  unproducible.length === 0,
  unproducible.join(", "),
);
for (const d of produced) ok(`kind "${d}" is declared`, DIAGNOSIS_KINDS.includes(d));

// The flag and the predicate are two ways of saying one thing, and a screen
// deciding whether to OFFER a Refresh reads the flag. They must not drift.
for (const d of [unset, rejected, limited, timedOut, unreachable, cold, dbBroken]) {
  ok(`"${d.kind}": transient flag matches isTransient()`, d.transient === isTransient(d.kind));
}

// A message with no remedy is the failure this file exists to prevent. Every
// one of them has to end up somewhere a person can go.
for (const d of [unset, rejected, limited, timedOut, unreachable, cold]) {
  ok(
    `"${d.kind}" says what to do next`,
    /Vercel|Refresh|Wait|permissions|status page/i.test(d.message),
    d.message,
  );
}

console.log("\n══ 2. no message can carry a secret's value ══\n");

// A real-shaped key, planted everywhere a value could enter a message: the
// environment, the vendor's own error text, and the error's body.
//
// Assembled from pieces rather than written out. Both values are invented and
// have never been credentials, but a literal `sk_live_…` in a tracked file is
// indistinguishable from a leaked one to GitHub's push protection, which
// blocked a push on this line. The runtime values are unchanged, so the
// scrubber is still tested against the exact prefixes it matches on
// (lib/platform/diagnostics.js) — the shape has to survive, only the literal
// does not.
const KEY = "key" + "_9f3ac41be27d5a06cc18eb7742d0";
const TOKEN = "sk" + "_live" + "_4d9a2f77b1c3e8560aa4bb91";
const env = { RETELL_API_KEY: KEY, TWILIO_AUTH_TOKEN: TOKEN, DATABASE_URL: "postgres://u:p@h/db" };

const hostile = [
  new RetellError(`Invalid API key: ${KEY}`, { status: 401, body: { key: KEY } }),
  new RetellError(`Authorization: Bearer ${KEY} was rejected`, { status: 403 }),
  new RetellError(`bad request, sent ${TOKEN}`, { status: 400 }),
  new RetellError(`upstream said ${KEY}`, { status: 500 }),
  { message: `boom ${KEY}` },
  { code: "P1001", message: `Can't reach database server at postgres://u:p@h/db (${KEY})` },
  { code: "P2010", message: `raw query failed: ${TOKEN}` },
];

let leaks = 0;
for (const err of hostile) {
  const d = describeFailure(err, { vendor: "Retell", envVar: "RETELL_API_KEY", env });
  for (const secret of [KEY, TOKEN]) {
    if (String(d.message).includes(secret)) {
      leaks += 1;
      console.log(`      leaked in "${d.kind}": ${d.message}`);
    }
  }
}
ok("no diagnosis message contains a planted key value", leaks === 0, `${leaks} leaks`);

ok(
  "a key value in free text is scrubbed even when the deployment does not hold it",
  !scrubSecrets(`sent ${KEY}`, { env: {} }).includes(KEY),
  scrubSecrets(`sent ${KEY}`, { env: {} }),
);
ok(
  "a bearer header is scrubbed",
  scrubSecrets("Authorization: Bearer abc123def456ghi789", { env: {} }).includes("[redacted]"),
);
ok(
  "the variable's NAME survives scrubbing — it is the useful half",
  scrubSecrets("RETELL_API_KEY isn't set", { env }).includes("RETELL_API_KEY"),
);
ok(
  "an ordinary sentence is not mangled by the scrubber",
  scrubSecrets("Retell answered 401 — the key is set and was refused.", { env }) ===
    "Retell answered 401 — the key is set and was refused.",
);
// Every declared secret name must be one this scrubber will actually strip.
for (const name of SECRET_ENV_VARS) {
  const value = "abcdefgh12345678ijklmnop";
  ok(
    `${name}'s value is stripped from free text`,
    !scrubSecrets(`leaked ${value}`, { env: { [name]: value } }).includes(value),
  );
}

console.log("\n══ 3. a chain points at the first break ══\n");

/**
 * The sales agent's exact situation: Retell is configured, no number is set, so
 * nothing was ever asked of the provider. Six links used to render "We couldn't
 * check this one" — provider, agent, engine, binding, webhook, prompt.
 */
const noNumber = resolveReadiness({
  configured: true,
  providerReachable: null,
  number: { haveRow: false },
  agent: { wantAgentId: null },
  engine: { wantLlmId: null },
  company: { enabled: false, hasCredit: null },
  events: {},
  expectedWebhookUrl: "https://www.fieldquo.com/api/voice/webhook",
  originIsStable: true,
});
const linkOf = (r, id) => r.links.find((l) => l.id === id);

ok(
  "the missing number is the one link reported as broken",
  linkOf(noNumber, "number").state === "fail" && linkOf(noNumber, "number").reason === "none",
);

const shruggers = noNumber.links.filter(
  (l) => l.state === "unknown" && !l.blockedBy && l.id !== "events",
);
ok(
  "no link downstream of the break reports its own ignorance instead of the cause",
  shruggers.length === 0,
  shruggers.map((l) => l.id).join(", "),
);

for (const id of ["provider", "agent", "engine", "binding", "webhook", "prompt"]) {
  const l = linkOf(noNumber, id);
  ok(`"${id}" is waiting on the number, not shrugging`, l.blockedBy === "number", `blockedBy=${l.blockedBy}`);
  const { text, waiting } = platformLinkText(l);
  ok(`"${id}" renders as waiting`, waiting === true);
  ok(`"${id}" names what it is waiting on`, text.includes(LINK_LABEL.number), text);
  ok(
    `"${id}" no longer renders the generic shrug`,
    text !== REASON_TEXT["app.setVoice.chain.unchecked"],
  );
}

ok(
  "a waiting link still claims nothing — it is not upgraded to ok",
  ["provider", "agent", "engine", "binding", "webhook", "prompt"].every(
    (id) => linkOf(noNumber, id).state === "unknown",
  ),
);
ok(
  "waiting copy explicitly refuses to claim either way",
  /nothing is claimed/i.test(platformLinkText(linkOf(noNumber, "agent")).text),
);

// "Nobody has rung yet" is a real answer about a real thing and must NOT be
// converted into a consequence of the missing number — it would still be true
// with a perfect chain.
ok(
  "the events link is left alone — it is not waiting on anything",
  linkOf(noNumber, "events").blockedBy === null &&
    linkOf(noNumber, "events").reason === "none_yet",
);

/* ── transitive: the pointer follows through to the FIRST break ──────────── */
//
// The provider is down, so number/agent/engine cannot be asked, so binding
// cannot be judged. Binding must name the provider, not its neighbour.
const providerDown = resolveReadiness({
  configured: true,
  providerReachable: false,
  number: { haveRow: true, status: "active" },
  agent: { wantAgentId: "agent_x" },
  engine: { wantLlmId: "llm_x" },
  company: { enabled: true, hasCredit: true },
  events: {},
  expectedWebhookUrl: "https://www.fieldquo.com/api/voice/webhook",
  originIsStable: true,
});
ok("the provider is the reported break", linkOf(providerDown, "provider").state === "fail");
for (const id of ["number", "agent", "engine", "binding", "webhook", "prompt"]) {
  ok(
    `"${id}" points past its neighbour to the provider`,
    linkOf(providerDown, id).blockedBy === "provider",
    `blockedBy=${linkOf(providerDown, id).blockedBy}`,
  );
}

/* ── a healthy chain claims nothing extra ─────────────────────────────────── */
const healthy = resolveReadiness({
  configured: true,
  providerReachable: true,
  number: {
    haveRow: true,
    e164: "+13655176689",
    status: "active",
    source: "purchased",
    existsAtProvider: true,
    boundAgent: "agent_x",
  },
  agent: {
    wantAgentId: "agent_x",
    existsAtProvider: true,
    webhookUrl: "https://www.fieldquo.com/api/voice/webhook",
    llmIdAtProvider: "llm_x",
  },
  engine: {
    wantLlmId: "llm_x",
    existsAtProvider: true,
    promptAtProvider: "rules",
    greetingAtProvider: "hello",
    toolUrlsAtProvider: ["https://www.fieldquo.com/api/voice/tools/x"],
  },
  company: { enabled: true, hasCredit: true },
  events: { providerDelivered: true },
  expectedWebhookUrl: "https://www.fieldquo.com/api/voice/webhook",
  expectedToolOrigin: "https://www.fieldquo.com/api/voice/tools/",
  originIsStable: true,
  expected: { prompt: "rules", greeting: "hello" },
});
ok(
  "a healthy chain has nothing waiting on anything",
  healthy.links.every((l) => !l.blockedBy),
  healthy.links.filter((l) => l.blockedBy).map((l) => l.id).join(", "),
);
ok("a healthy chain is still ready", healthy.overall === "ready", healthy.overall);
ok(
  "no link ever points at itself",
  [noNumber, providerDown, healthy].every((r) => r.links.every((l) => l.blockedBy !== l.id)),
);
ok(
  "no link is ever left waiting on a link that is fine",
  [noNumber, providerDown, healthy].every((r) =>
    r.links.every((l) => {
      if (!l.blockedBy) return true;
      const target = r.links.find((t) => t.id === l.blockedBy);
      return target && target.state !== "ok";
    }),
  ),
);

/* ── the platform's own voice ─────────────────────────────────────────────── */
ok(
  "the platform copy names the environment variable the tenant copy cannot",
  PLATFORM_REASON_TEXT["app.setVoice.chain.number.none"].includes("FIELDQUO_SALES_NUMBER"),
);
ok(
  "the tenant copy is still what a contractor reads — it was overridden, not edited",
  REASON_TEXT["app.setVoice.chain.number.none"].startsWith("You haven't"),
);
const deadOverrides = Object.keys(PLATFORM_REASON_TEXT).filter((k) => !REASON_TEXT[k]);
ok(
  "no platform override exists for a reason the resolver cannot emit",
  deadOverrides.length === 0,
  deadOverrides.join(", "),
);

console.log("\n══ 4. the client keeps the reason the server sent ══\n");

for (const [page, fn] of [
  ["app/platform/voice-economics/page.js", "const load = useCallback(async () => "],
  ["app/platform/voice-webhooks/page.js", "const load = useCallback(async () => "],
]) {
  const body = functionBody(read(page), fn);
  ok(`${page}: the load function is findable`, body !== null);
  if (!body) continue;
  // The exact bug: fetchJson returns the parsed body and throws. Treating it as
  // { ok, data, error } made the error branch unconditional.
  ok(
    `${page}: does not test .ok on a fetchJson result`,
    !/\.ok\b/.test(body),
    body.match(/.*\.ok\b.*/)?.[0]?.trim(),
  );
  ok(`${page}: catches the throw`, /catch\s*\(/.test(body));
  ok(
    `${page}: reports the thrown message rather than a fixed string`,
    /err\.message/.test(body),
  );
  ok(
    `${page}: no invented fallback sentence that hides the real one`,
    !/Couldn't (read|check) the/.test(body),
    body.match(/.*Couldn't (read|check) the.*/)?.[0]?.trim(),
  );
}

// The route has to SEND a reason for the thing it could not read, rather than
// catching it to null — which is where the information was being lost.
const econRoute = read("app/api/platform/voice-economics/route.js");
ok(
  "voice-economics does not swallow the concurrency failure",
  !/getConcurrency\(\)\.catch\(\(\) => null\)/.test(econRoute),
);
ok("voice-economics sends a named concurrency problem", /concurrencyProblem/.test(econRoute));

const hookRoute = read("app/api/platform/voice-webhooks/route.js");
const inspectBody = functionBody(hookRoute, "async function inspect(agentId, expected) ");
ok("voice-webhooks: inspect is findable", inspectBody !== null);
if (inspectBody) {
  ok(
    "voice-webhooks names why an agent could not be read",
    /describeVendorFailure/.test(inspectBody),
  );
  ok(
    "voice-webhooks still refuses to call an unread agent 'wrong'",
    /state: "unknown"/.test(inspectBody),
  );
}

console.log("\n══ 5. TWILIO_PHONE_NUMBER: one recommendation, from the facts ══\n");

const phantom = sharedLineAdvice({
  envValue: "+17372212163",
  envHeld: false,
  boughtSharedTest: null,
  boughtSystem: null,
  heldCount: 0,
});
ok("a variable naming a number we do not hold is reported", phantom !== null);
ok("...as the phantom it is", phantom.state === "env_phantom", phantom.state);
ok("...naming the number", phantom.headline.includes("+17372212163"));
ok(
  "...explaining that the quiet failure is the danger",
  /21606/.test(phantom.why) && /quiet/i.test(phantom.why),
  phantom.why,
);
ok(
  "...and recommending exactly one thing: unset it",
  /^Unset TWILIO_PHONE_NUMBER/.test(phantom.action),
  phantom.action,
);

ok(
  "a variable naming a number we DO hold says nothing at all",
  sharedLineAdvice({ envValue: "+15145550111", envHeld: true }) === null,
);
ok(
  "an unset variable with a bought line says nothing at all",
  sharedLineAdvice({ envValue: null, boughtSharedTest: "+15145550111" }) === null,
);

const nothingToLend = sharedLineAdvice({ envValue: null, boughtSharedTest: null });
ok("unset and unbought is reported as an honest absence", nothingToLend.state === "nothing_to_lend");
ok("...not as an alarm", nothingToLend.tone === "note");

const superseded = sharedLineAdvice({
  envValue: "+17372212163",
  envHeld: false,
  boughtSharedTest: "+15145550111",
  boughtSystem: "+15145550222",
  heldCount: 2,
});
ok("a fully superseded variable is not an alarm", superseded.state === "env_superseded");
ok("...and is still recommended for removal", /^Unset/.test(superseded.action));

// The one that must never be guessed: we did not ask Twilio.
const unasked = sharedLineAdvice({ envValue: "+17372212163", envHeld: null });
ok("an unasked provider produces 'unknown', never an accusation", unasked.state === "unknown");
ok(
  "...and says nothing is claimed about the number",
  /nothing is claimed/i.test(unasked.why),
  unasked.why,
);
ok(
  "...and does not tell anyone to unset anything on no evidence",
  !/[Uu]nset/.test(unasked.action),
  unasked.action,
);

// The purpose that was written and read by nothing. If sharedTestLine stops
// consulting the row, the console's advice becomes a lie again.
const platformNumberSrc = read("lib/crew/platformNumber.js");
const sharedFn = functionBody(platformNumberSrc, "export async function sharedTestLine() ");
ok("sharedTestLine exists", sharedFn !== null);
if (sharedFn) {
  ok(
    "a bought shared_test row is what the shared line resolves to",
    /purpose: "shared_test"/.test(sharedFn),
  );
  // Both must be PRESENT before their order means anything. `indexOf(a) <
  // indexOf(b)` is a false pass whenever `a` is missing, because -1 is less
  // than everything — the exact trap this script's scoping rules exist for.
  const rowAt = sharedFn.indexOf('purpose: "shared_test"');
  const envAt = sharedFn.indexOf("sharedTestLineE164");
  ok("the shared line consults a bought row", rowAt !== -1);
  ok("the shared line still has an env fallback", envAt !== -1);
  ok(
    "the env var is the fallback, not the source of truth",
    rowAt !== -1 && envAt !== -1 && rowAt < envAt,
  );
}
const claimRoute = read("app/api/crew/line/route.js");
ok(
  "the claim path resolves the shared line through the bought row",
  /await sharedTestLine\(\)/.test(claimRoute),
);
ok(
  "the claim path no longer reads the env var directly",
  !/sharedTestLineE164\(\)/.test(claimRoute),
);

/* ── the candidate list, and the guarantee that moved with it ─────────────
 *
 * scripts/check-sales-agent.mjs bans any tenant model from the sales-agent
 * ROUTE — a blanket rule, stricter than the non-negotiable behind it (the
 * console may view a company's data and may not edit it). Reading
 * VoicePhoneNumber to work out which Retell numbers no company holds is a read,
 * and it lives in lib/ so that route's stricter rule stays intact rather than
 * being argued down. The no-writes half is therefore asserted HERE, where the
 * code actually is, instead of being lost in the move.
 */
const candidates = read("lib/platform/salesNumberCandidates.js");
ok(
  "the candidate lookup never writes to a tenant table",
  !/db\.\w+\.(create|update|upsert|delete|createMany|updateMany|deleteMany)/.test(candidates),
);
ok(
  "the candidate lookup only ever reads",
  /db\.voicePhoneNumber\.findMany/.test(candidates),
);
ok(
  "only numbers no company holds are ever suggested",
  /filter\(\(l\) => l\.leak\)/.test(candidates),
);
ok(
  "the sales-agent route itself still names no tenant model",
  !/db\.(?:company|quote|invoice|client|job|voiceCall|voicePhoneNumber|voiceAgent|member|user)\./.test(
    read("app/api/platform/sales-agent/route.js"),
  ),
);
ok(
  "an unlookable candidate list reports a reason rather than an empty list",
  /problem: describeFailure/.test(candidates),
);

console.log("\n══ 6. nothing here renders a control that cannot work ══\n");

// The brief was explicit: do not build a release button unless it works end to
// end. It is prose, and this asserts the prose has not quietly become a button.
const numbersPage = read("app/platform/voice-numbers/page.js");
const leakActions = functionBody(numbersPage, "function LeakActions({ line, deployment }) ");
ok("the orphan-number advice exists", leakActions !== null);
if (leakActions) {
  ok("it offers no button", !/<button/.test(leakActions));
  ok("it posts nothing", !/fetch\(|fetchJson\(/.test(leakActions));
  ok("it says releasing is permanent", /[Pp]ermanent/.test(leakActions));
  ok("it says where releasing is actually done", /Retell dashboard/i.test(leakActions));
  ok(
    "it names the sales variable as the reversible option",
    /salesNumberVar/.test(leakActions),
  );
}

console.log("");
if (fail) {
  console.log(`${fail} FAILED`);
  process.exit(1);
}
console.log("all platform diagnostics checks passed");
