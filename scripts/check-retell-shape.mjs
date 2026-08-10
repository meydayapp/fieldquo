// scripts/check-retell-shape.mjs
//
// Locks in the shape Retell actually accepts.
//
// The receptionist silently didn't work for a long time because provisionAgent
// POSTed `general_prompt` / `begin_message` / `general_tools` straight to
// /create-agent. Retell splits an agent in two — a "Retell LLM" owns the prompt
// and tools, the agent owns voice/language/webhook and references the LLM by
// `response_engine.llm_id`. The wrong shape fails the create, so the number gets
// bought and attached to nothing, and every caller hears silence.
//
// This is a static check (no key, no network): it reads the source and asserts
// the two payloads are built the right way round, and that webhook_url is set —
// without it Retell never sends call_started, so no lead is ever saved and no
// minute is ever billed.

import { readFileSync } from "node:fs";

const provision = readFileSync("lib/voice/provision.js", "utf8");
const retell = readFileSync("lib/voice/retell.js", "utf8");

let failed = 0;
const check = (label, ok, hint = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : `\n    ${hint}`}`);
  if (!ok) failed++;
};

// ── The client exposes both halves ────────────────────────────────────────
check(
  "retell.js has createRetellLlm + updateRetellLlm",
  /export function createRetellLlm/.test(retell) &&
    /export function updateRetellLlm/.test(retell),
  "The prompt half needs its own endpoints (/create-retell-llm).",
);
check(
  "createRetellLlm posts to /create-retell-llm",
  /createRetellLlm[\s\S]{0,200}\/create-retell-llm/.test(retell),
);

// ── The agent payload is agent-shaped ─────────────────────────────────────
const agentPayloadRegion = provision.slice(provision.indexOf("const payload = {"));
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
  /attachAgent\(number\.e164,\s*shouldAnswer\s*\?\s*providerAgentId\s*:\s*null\)/.test(
    provision,
  ),
);

// ── Both LLM ids are persisted ────────────────────────────────────────────
check(
  "provider LLM ids are persisted on VoiceAgent",
  /providerLlmId/.test(provision) && /outboundProviderLlmId/.test(provision),
  "Without storing llm_id, every re-provision orphans the old LLM and makes a new one.",
);

console.log(failed === 0 ? "\nALL PASS" : `\n${failed} FAILED`);
process.exitCode = failed === 0 ? 0 : 1;
