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

console.log(failed === 0 ? "\nALL PASS" : `\n${failed} FAILED`);
process.exitCode = failed === 0 ? 0 : 1;
