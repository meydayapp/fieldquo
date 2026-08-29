// scripts/check-retell-shape.mjs
//
//   npm run check:retell
//
// Locks in the shape Retell actually accepts.
//
// Two failures are behind every assertion here, and both were silent:
//
// 1. provisionAgent POSTed `general_prompt` / `begin_message` / `general_tools`
//    straight to /create-agent. Retell splits an agent in two — a "Retell LLM"
//    owns the prompt and tools, the agent owns voice/language/webhook and
//    references the LLM by `response_engine.llm_id`. The wrong shape fails the
//    create, so the number got bought and attached to nothing, and every caller
//    heard silence.
//
// 2. Every write that bound an agent to a number sent `inbound_agent_id`.
//    Retell deprecated the single-agent fields on 31/03/2026 in favour of
//    weighted lists; past that date the request is rejected outright:
//    "Deprecated API usage is no longer supported: Phone number single-agent
//    fields." Adding a number failed in production, and this file passed all 11
//    of its assertions while it did — because they only ever looked at
//    provision.js, and the field was in retell.js.
//
// So the payload assertions no longer read source. They STUB fetch and call the
// real exported functions, then assert on the bytes that would have gone to the
// provider — the only description of a request body that can't drift from the
// request body. The source-reading checks that remain are about structure that
// has no single call site to capture.
//
// No network, no key: RETELL_API_KEY is set to a dummy below so `call()` gets
// past its own guard, and fetch never leaves the process.

import { readFileSync, readdirSync } from "node:fs";

// Importing a .js ES module from a package with no `"type": "module"` makes Node
// warn that it had to reparse. True, harmless, and not this script's call to
// fix — declaring the whole repo ESM is a different decision. It's dropped
// because it prints AFTER the verdict, where it reads like a failure. Every
// other warning still comes through.
process.removeAllListeners("warning");
process.on("warning", (w) => {
  // Matched on `code`, not `name` — Node names this one plain "Warning", so a
  // name test silently matches nothing and prints the stack instead.
  if (w.code !== "MODULE_TYPELESS_PACKAGE_JSON") console.warn(w);
});

const provision = readFileSync("lib/voice/provision.js", "utf8");
const retell = readFileSync("lib/voice/retell.js", "utf8");

/**
 * Source with comments removed.
 *
 * The deprecation assertions below look for field names that must NOT be sent —
 * but the comments explaining why deliberately quote those same names, and a
 * check that forbids explaining itself would just get the explanation deleted.
 * So the ban applies to code, and the prose stays.
 */
function code(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

let failed = 0;
const check = (label, ok, hint = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : `\n    ${hint}`}`);
  if (!ok) failed++;
};

/* ══════════════════ the request bodies, as actually built ══════════════════ */

process.env.RETELL_API_KEY = "test-key-never-used";
const {
  buyNumber,
  importNumber,
  attachAgent,
  getNumber,
  listNumbers,
  createPhoneCall,
  agentRouting,
  boundAgentId,
  listCalls,
  getConcurrency,
  getCall,
} = await import("../lib/voice/retell.js");

const sent = [];
globalThis.fetch = async (url, init = {}) => {
  sent.push({
    url: String(url),
    method: init.method || "GET",
    body: init.body ? JSON.parse(init.body) : null,
  });
  return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
};

/** Run one client call and hand back exactly what it tried to send. */
async function capture(fn) {
  sent.length = 0;
  await fn();
  return sent[0] || {};
}

// Every field name Retell stopped accepting on 31/03/2026.
const DEPRECATED = [
  "inbound_agent_id",
  "inbound_agent_version",
  "outbound_agent_id",
  "outbound_agent_version",
  "inbound_sms_agent_id",
  "inbound_sms_agent_version",
  "outbound_sms_agent_id",
  "outbound_sms_agent_version",
];

/** Deprecated keys anywhere in a payload, at any depth. */
function deprecatedKeysIn(value, path = "body") {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([k, v]) => [
    ...(DEPRECATED.includes(k) ? [`${path}.${k}`] : []),
    ...deprecatedKeysIn(v, `${path}.${k}`),
  ]);
}

/**
 * Is this a well-formed weighted routing list?
 *
 * Retell's schema requires `agent_id` and `weight` on every entry, constrains
 * weight to (0, 1], and requires the weights to total 1. Checked as a shape
 * rather than a regex so a list nested one level too deep, or handed an object
 * where an array belongs, fails here rather than on a phone call.
 */
function routingProblems(list) {
  if (!Array.isArray(list)) return [`not an array (got ${typeof list})`];
  const bad = [];
  for (const [i, entry] of list.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      bad.push(`entry ${i} is not an object`);
      continue;
    }
    if (typeof entry.agent_id !== "string" || !entry.agent_id) bad.push(`entry ${i}: agent_id`);
    if (typeof entry.weight !== "number" || !(entry.weight > 0) || entry.weight > 1) {
      bad.push(`entry ${i}: weight must be in (0,1], got ${JSON.stringify(entry.weight)}`);
    }
  }
  const total = list.reduce((n, e) => n + (typeof e?.weight === "number" ? e.weight : NaN), 0);
  if (list.length && Math.abs(total - 1) > 1e-9) bad.push(`weights total ${total}, not 1`);
  return bad;
}

const AGENT = "agent_abc123";
const E164 = "+15145550142";

const bought = await capture(() => buyNumber({ areaCode: "514", agentId: AGENT, nickname: "n" }));
const imported = await capture(() =>
  importNumber({ e164: E164, terminationUri: "x.pstn.twilio.com", agentId: AGENT }),
);
const attached = await capture(() => attachAgent(E164, AGENT));
const detached = await capture(() => attachAgent(E164, null));
const fetched = await capture(() => getNumber(E164));
const listed = await capture(() => listNumbers());
const dialled = await capture(() =>
  createPhoneCall({ fromE164: E164, toE164: "+15145550199", agentId: AGENT }),
);

// ── Nothing deprecated reaches the wire ───────────────────────────────────
const everySent = [bought, imported, attached, detached, dialled];
const offenders = everySent.flatMap((r) => deprecatedKeysIn(r.body));
check(
  "no deprecated single-agent field in any request body, at any depth",
  offenders.length === 0,
  `found: ${offenders.join(", ")} — Retell rejects these outright since 31/03/2026.`,
);
check(
  "no deprecated single-agent field anywhere in lib/voice source",
  (() => {
    const hits = [];
    for (const f of readdirSync("lib/voice")) {
      if (!f.endsWith(".js")) continue;
      const src = code(readFileSync(`lib/voice/${f}`, "utf8"));
      for (const d of DEPRECATED) if (src.includes(d)) hits.push(`${f}:${d}`);
    }
    return hits.length === 0;
  })(),
  "A deprecated field name survives in code (comments are exempt, deliberately).",
);

// ── The new list shape, everywhere it's built ─────────────────────────────
for (const [label, req] of [
  ["create-phone-number", bought],
  ["import-phone-number", imported],
  ["update-phone-number", attached],
]) {
  const problems = routingProblems(req.body?.inbound_agents);
  check(
    `${label} sends a well-formed inbound_agents list`,
    problems.length === 0,
    `${problems.join("; ")} — got ${JSON.stringify(req.body?.inbound_agents)}`,
  );
}

check(
  "one agent produces exactly ONE entry, at weight 1",
  attached.body?.inbound_agents?.length === 1 && attached.body.inbound_agents[0].weight === 1,
  `got ${JSON.stringify(attached.body?.inbound_agents)}`,
);
check(
  "the entry carries agent_id and no invented agent_version",
  attached.body?.inbound_agents?.[0]?.agent_id === AGENT &&
    !("agent_version" in attached.body.inbound_agents[0]),
  "agent_version is optional; unpinned means the number follows the newest version, " +
    "which is what lets a greeting edit reach the phone. Never guess a number.",
);
check(
  "a version CAN be pinned when asked for — the escape hatch works",
  agentRouting(AGENT, { version: "latest_published" })[0].agent_version === "latest_published",
  "The day anything gets published, this is the one-line change. It has to work.",
);

// ── Detach is explicit, because detach IS the on/off switch ───────────────
check(
  "detaching SENDS inbound_agents rather than omitting it",
  detached.body !== null && "inbound_agents" in (detached.body || {}),
  "Leaving the field out is a no-op at the provider — the agent stays attached " +
    "and 'Answer my calls' becomes a dead control in the off direction.",
);
check(
  "detaching sends an EMPTY list",
  Array.isArray(detached.body?.inbound_agents) && detached.body.inbound_agents.length === 0,
  `got ${JSON.stringify(detached.body?.inbound_agents)}`,
);
check(
  "boundAgentId reads the list back the same way it was written",
  boundAgentId({ inbound_agents: agentRouting(AGENT) }) === AGENT &&
    boundAgentId({ inbound_agents: agentRouting(null) }) === null &&
    boundAgentId({}) === null &&
    boundAgentId(null) === null,
  "The read-back check in syncNumberAttachment is only as good as this.",
);
check(
  "syncNumberAttachment VERIFIES the attach against the provider",
  /getNumber\(number\.e164\)/.test(provision) && /boundAgentId\(live\)\s*!==\s*want/.test(provision),
  "Retell documents no detach procedure, so a 200 is not evidence the phone " +
    "stopped answering. Read it back or the switch is unverified.",
);

// ── Paths, including the ones Retell versions individually ────────────────
check(
  "create-phone-number is unversioned POST /create-phone-number",
  bought.url.endsWith("/create-phone-number") && bought.method === "POST",
  `got ${bought.method} ${bought.url}`,
);
// ── What is BILLED must be what is ORDERED ───────────────────────────────
//
// The settings screen sells toll-free at $9/month plus a 5¢/minute surcharge.
// The purchase request used to say nothing about the type at all, so Retell
// returned a local number at its default and the contractor paid the toll-free
// price for a local line — a customer overcharged for a product they never got.
// Same story for the country: absent, Retell defaults to US, and `area_code` is
// documented US-only, so a Quebec 819 request was never a Quebec number.
const boughtTollFree = await capture(() =>
  buyNumber({ areaCode: "514", agentId: AGENT, tollFree: true, country: "CA" }),
);
check(
  "create-phone-number states the type EXPLICITLY, both ways",
  bought.body?.toll_free === false && boughtTollFree.body?.toll_free === true,
  `local sent toll_free=${JSON.stringify(bought.body?.toll_free)}, ` +
    `toll-free sent ${JSON.stringify(boughtTollFree.body?.toll_free)}. ` +
    "Omitting it is what let a $9/mo charge buy a $4/mo line.",
);
check(
  "create-phone-number always names the country",
  typeof bought.body?.country_code === "string" && bought.body.country_code.length === 2,
  `got ${JSON.stringify(bought.body?.country_code)} — absent means Retell's US default, ` +
    "and area_code is documented US-only.",
);
check(
  "a defaulted country is CA, matching where this product actually sells",
  (await capture(() => buyNumber({ areaCode: "819" }))).body?.country_code === "CA",
  "The fixtures in this repo are Quebec area codes and the agents speak fr-CA.",
);
check(
  "update-phone-number is PATCH and carries the E.164 in the path",
  attached.method === "PATCH" && attached.url.includes(encodeURIComponent(E164)),
  `got ${attached.method} ${attached.url}`,
);
check(
  "list-phone-numbers is the /v2/ path — it's the only number endpoint that is",
  listed.url.includes("/v2/list-phone-numbers"),
  `got ${listed.url}. v1 also returned a bare array; v2 returns { items, has_more }.`,
);
check(
  "get-phone-number is unversioned and keyed by E.164",
  fetched.url.endsWith(`/get-phone-number/${encodeURIComponent(E164)}`),
  `got ${fetched.url}`,
);
check(
  "create-phone-call is the /v2/ path with from_number + to_number",
  dialled.url.endsWith("/v2/create-phone-call") &&
    dialled.body?.from_number === E164 &&
    dialled.body?.to_number === "+15145550199",
  `got ${dialled.method} ${dialled.url} ${JSON.stringify(dialled.body)}`,
);
check(
  "a per-call agent is an OVERRIDE, not a binding",
  dialled.body?.override_agent_id === AGENT,
  "override_agent_id is the documented field; agent_id would bind the number.",
);

/* ═════════════════ structure that has no single call site ═════════════════ */

const retellCode = code(retell);
const agentPayloadRegion = provision.slice(provision.indexOf("const payload = {"));

// ── The client exposes both halves ────────────────────────────────────────
check(
  "retell.js has createRetellLlm + updateRetellLlm",
  /export function createRetellLlm/.test(retellCode) &&
    /export function updateRetellLlm/.test(retellCode),
  "The prompt half needs its own endpoints (/create-retell-llm).",
);
check(
  "createRetellLlm posts to /create-retell-llm",
  /createRetellLlm[\s\S]{0,200}\/create-retell-llm/.test(retellCode),
);

// ── The agent payload is agent-shaped ─────────────────────────────────────
check(
  "agent payload sets response_engine { type: retell-llm, llm_id }",
  /response_engine:\s*\{\s*type:\s*"retell-llm",\s*llm_id/.test(provision),
  "Without response_engine, /create-agent rejects the request.",
);
check(
  "agent payload sets voice_id unconditionally",
  /voice_id:\s*voiceFor\(/.test(provision),
  "voice_id is REQUIRED by /create-agent — an optional spread meant it was usually absent.",
);
check(
  "agent payload sets webhook_url",
  /webhook_url:\s*webhookUrl/.test(provision),
  "No webhook_url ⇒ no call_started ⇒ no VoiceCall row ⇒ every tool call is rejected and nothing is billed.",
);
check(
  "webhook_url points at /api/voice/webhook",
  /\/api\/voice\/webhook/.test(provision),
);

// ── The prompt fields live on the LLM, NOT the agent ──────────────────────
check(
  "general_prompt is in the LLM payload, not the agent payload",
  /llmPayload\s*=\s*\{[\s\S]{0,400}general_prompt/.test(provision) &&
    !/const payload = \{[\s\S]{0,400}general_prompt/.test(agentPayloadRegion),
  "general_prompt/begin_message/general_tools belong to the Retell LLM object.",
);
check(
  "general_tools is in the LLM payload",
  /llmPayload\s*=\s*\{[\s\S]{0,600}general_tools/.test(provision),
);

// ── The on/off switch is honoured at the provider ─────────────────────────
check(
  "syncNumberAttachment gates on enabled AND credit",
  /shouldAnswer\s*=\s*Boolean\(agent\?\.enabled\)\s*&&\s*allowed/.test(provision),
  "Attachment IS the on/off switch — attaching unconditionally made the toggle a dead control.",
);
check(
  "a disabled//out-of-credit number is DETACHED (null agent)",
  /attachAgent\(number\.e164,\s*want\)/.test(provision) &&
    /want\s*=\s*shouldAnswer\s*\?\s*providerAgentId\s*:\s*null/.test(provision),
);
check(
  "the local mirror stores OUR agent id, not the provider's",
  /select:\s*\{\s*id:\s*true,\s*providerAgentId:\s*true/.test(provision) &&
    /data:\s*\{\s*agentId:\s*shouldAnswer\s*\?\s*agent\?\.id/.test(provision),
  "VoicePhoneNumber.agentId is a foreign key to VoiceAgent.id. Writing the " +
    "provider's agent id there is a constraint violation on every single attach — " +
    "swallowed by the catch, reported as 'couldn't attach' for a number that was.",
);

// ── Both LLM ids are persisted ────────────────────────────────────────────
check(
  "provider LLM ids are persisted on VoiceAgent",
  /providerLlmId/.test(provision) && /outboundProviderLlmId/.test(provision),
  "Without storing llm_id, every re-provision orphans the old LLM and makes a new one.",
);

/* ═════════════ verified against Retell's docs, 25/08/2026 ═════════════════

   Everything below was checked against the current reference AND against the
   `retell-sdk` npm package, whose types are generated from Retell's own
   OpenAPI spec — so a shape that appears in both is as close to authoritative
   as anything is without a key. There is no RETELL_API_KEY in local .env and
   none of this has ever run against the live API; these assertions pin what
   the DOCUMENTATION says, and each carries the URL so the next person can
   re-check it in one click.
   ────────────────────────────────────────────────────────────────────────── */

// ── /v3/list-calls: the body Retell documents ────────────────────────────
// https://docs.retellai.com/api-references/list-calls
{
  const req = await capture(() =>
    listCalls({ sinceMs: 1000, untilMs: 2000, limit: 200, paginationKey: "pk" }),
  );

  check(
    "list-calls POSTs to /v3/list-calls",
    req.url === "https://api.retellai.com/v3/list-calls" && req.method === "POST",
    "The v2 list endpoint is GONE, not deprecated. A reconciler on v2 404s every " +
      "run and reports the provider unreachable for ever — which fails safe and " +
      "bills nobody.",
  );

  // The filter envelope is a KEYED OBJECT of typed filters, not a list and not
  // flat scalars. v2's `after_start_timestamp` style is what this replaced.
  const fc = req.body?.filter_criteria;
  check(
    "filters go in filter_criteria, keyed by field name",
    fc && typeof fc === "object" && !Array.isArray(fc),
  );
  check(
    "a time window is a range filter: { type:'range', op:'bt', value:[lo,hi] }",
    fc?.start_timestamp?.type === "range" &&
      fc.start_timestamp.op === "bt" &&
      Array.isArray(fc.start_timestamp.value) &&
      fc.start_timestamp.value.length === 2,
    "`bt` takes a two-element [lower, upper] array. A scalar here is the v2 shape.",
  );
  check(
    "a status filter is an enum filter: { type:'enum', op:'in', value:[...] }",
    fc?.call_status?.type === "enum" &&
      fc.call_status.op === "in" &&
      Array.isArray(fc.call_status.value),
  );
  check(
    "paging uses pagination_key + limit, and limit stays within 1..1000",
    req.body?.pagination_key === "pk" &&
      Number.isInteger(req.body?.limit) &&
      req.body.limit >= 1 &&
      req.body.limit <= 1000,
  );

  // ── The response envelope, and the field the list does NOT carry ────────
  //
  // Pinned by READING the reconciler, because the envelope only exists on a
  // real response. `{calls: []}` was the guess worth ruling out; Retell
  // returns `{ items, has_more, pagination_key, total }`.
  const recon = readFileSync("lib/voice/reconcileCalls.js", "utf8");
  check(
    "the reconciler reads the documented envelope: items / has_more / pagination_key",
    /res\?\.items/.test(recon) && /res\?\.has_more/.test(recon) && /res\?\.pagination_key/.test(recon),
    "The envelope is { items, has_more, pagination_key, total } — NOT { calls }.",
  );
  check(
    "the reconciler does NOT read a transcript off a list item",
    !/call\?\.transcript/.test(code(recon)),
    "/v3/list-calls carries call_analysis, recording_url and call_cost but NOT " +
      "transcript or transcript_object — those exist only on /v2/get-call. Reading " +
      "them off a list item silently records every rescued call with no transcript, " +
      "and the gap-filling update never repairs it.",
  );
  check(
    "so it fetches the single-call read to get one",
    /getCall/.test(code(recon)) && /transcriptFrom\(/.test(code(recon)),
    "https://docs.retellai.com/api-references/get-call",
  );
  // ── Which transcript field, asserted by EXECUTING the reader ────────────
  //
  // This used to be `/transcript_object/.test(recon)` — a grep for a field name
  // in one of the three files that store this. It passed while all three
  // discarded the tool calls, which is how an agent that told a caller it had
  // booked him, and hadn't, left no trace: nothing in our copy of the call
  // could tell a failed book_visit from one that was never called.
  //
  // transcript_with_tool_calls is the same utterances weaved with every tool
  // invocation and result. Preferred, with both older fields still read, so a
  // call stored before this — or one the provider only filled the plain field
  // on — still comes back with its words.
  const { transcriptFrom } = await import("../lib/voice/transcript.js");
  check(
    "and the weaved transcript wins, because that is the one with the tool calls in it",
    transcriptFrom({
      transcript_with_tool_calls: ["weaved"],
      transcript_object: ["plain"],
      transcript: "flat",
    })[0] === "weaved",
    "https://docs.retellai.com/api-references/get-call — transcript_with_tool_calls",
  );
  check(
    "with both older fields still read rather than dropped",
    transcriptFrom({ transcript_object: ["plain"], transcript: "flat" })[0] === "plain" &&
      transcriptFrom({ transcript: "flat" }) === "flat" &&
      transcriptFrom({}) === null,
    "A call with only the plain transcript must still come back with its words.",
  );
}

// ── /v2/get-call is where a transcript actually lives ────────────────────
// https://docs.retellai.com/api-references/get-call
{
  const req = await capture(() => getCall("call_abc"));
  check(
    "get-call is the /v2/ path, GET, keyed by call id",
    req.url === "https://api.retellai.com/v2/get-call/call_abc" && req.method === "GET",
  );
}

// ── /get-concurrency: unversioned, GET, org-scoped by the API key alone ──
// https://docs.retellai.com/api-references/get-concurrency
{
  const req = await capture(() => getConcurrency());
  check(
    "get-concurrency is unversioned and takes no org parameter",
    req.url === "https://api.retellai.com/get-concurrency" &&
      req.method === "GET" &&
      req.body === null,
    "The key identifies the org. There is no org scope to pass, and no BALANCE " +
      "endpoint anywhere in the API — the money side of lib/voice/pool.js is " +
      "derived for that reason and must keep saying so.",
  );
}

// ── Detaching a number: both documented shapes are covered ───────────────
// https://docs.retellai.com/api-references/update-phone-number
{
  // An attach has one shape and must not have grown a fallback.
  const attach = await capture(() => attachAgent("+15145550000", "agent_x"));
  check(
    "attaching sends a one-entry weighted list",
    Array.isArray(attach.body?.inbound_agents) &&
      attach.body.inbound_agents.length === 1 &&
      attach.body.inbound_agents[0].weight === 1,
  );

  // A detach tries [] first...
  sent.length = 0;
  await attachAgent("+15145550000", null);
  check(
    "detaching sends an explicit empty list, not an omitted field",
    Array.isArray(sent[0]?.body?.inbound_agents) && sent[0].body.inbound_agents.length === 0,
    "Omitting the field is a no-op at the provider, which turns the contractor's " +
      "'Answer my calls' toggle into a dead control.",
  );

  // ...and falls back to null if the provider rejects that shape.
  //
  // The reference will not settle this: it types the field `Array | null` and
  // documents "Set to null to remove" on the sibling fallback_number, while
  // the prose says routing applies "if set and non-empty" AND that weights
  // must total 1 — which an empty array does not. Untestable without a key, so
  // the code covers both rather than betting on one.
  // The two `[retell] request failed` lines below are EXPECTED: this block
  // deliberately makes the provider reject, to prove the fallback fires. They
  // are the real client's own logging, left in rather than muted so the branch
  // under test is the shipped one.
  console.log("    (the next two [retell] request failed lines are deliberate)");
  const realFetch = globalThis.fetch;
  let n = 0;
  sent.length = 0;
  globalThis.fetch = async (url, init = {}) => {
    sent.push({ url: String(url), method: init.method, body: JSON.parse(init.body) });
    n += 1;
    return n === 1
      ? new Response(JSON.stringify({ error: "weights must total 1" }), { status: 400 })
      : new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  };
  await attachAgent("+15145550000", null);
  globalThis.fetch = realFetch;
  check(
    "a rejected empty list retries as null rather than leaving a number attached",
    sent.length === 2 && sent[1].body.inbound_agents === null,
    "A detach that fails silently is a company at zero credit answering calls " +
      "free on FieldQuo's account.",
  );

  // A transport failure must NOT be retried with a different body.
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response("{}", { status: 500 });
  };
  await attachAgent("+15145550000", null).catch(() => {});
  globalThis.fetch = realFetch;
  check(
    "a 500 is not a shape rejection and is not retried",
    calls === 1,
    "Retrying a different body on an outage reports 'detached' off whichever " +
      "request happened to answer first.",
  );
}

// ── max_call_duration_ms: the documented bounds ──────────────────────────
// https://docs.retellai.com/api-references/update-agent — "The minimum value
// allowed is 60,000 ms (1 min), and maximum value allowed is 7,200,000 (2
// hours). By default, this is set to 3,600,000 (1 hour)." Accepted on
// update-agent as well as create-agent, and hitting it force-ends the call
// with disconnection_reason `max_duration_reached`.
{
  const ceiling = readFileSync("lib/voice/callCeiling.js", "utf8");
  check(
    "the call ceiling never sends below Retell's 60,000ms floor",
    /60_?000/.test(ceiling),
    "Retell rejects anything under a minute; a clamp that lets 30s through " +
      "fails the update and leaves the previous, longer ceiling in place.",
  );
  check(
    "and never above the 7,200,000ms maximum",
    /7_?200_?000/.test(ceiling),
  );
}

console.log(failed === 0 ? "\nALL PASS" : `\n${failed} FAILED`);
process.exitCode = failed === 0 ? 0 : 1;
