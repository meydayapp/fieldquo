// scripts/check-ai-model.mjs
//
//   node scripts/check-ai-model.mjs
//
// Answers one question: does the model FieldQuo is configured to use actually
// exist on this API key?
//
// ── Why this script had to exist ────────────────────────────────────────────
//
// lib/ai/provider.js catches every error and returns "". That is the right
// behaviour at runtime — a missing summary should never turn a working page
// into a 500 — but it means a model that has been retired is INDISTINGUISHABLE
// from a model that had nothing to say. Every AI feature in the product goes
// quiet, no error reaches a log anyone reads, and the first sign of trouble is
// a customer asking why the assistant stopped answering.
//
// OpenAI retires model IDs. `gpt-5-mini`, the current default, has already
// been superseded by the 5.4/5.5 family. So this needs checking deliberately
// rather than discovering it in the field.
//
// Read-only: it lists models and sends one two-token completion. It never
// writes to the database and costs a fraction of a cent.

import fs from "node:fs";
import path from "node:path";

// dotenv isn't a dependency of this project and shouldn't become one for a
// script. .env is a trivial format when you only need KEY=value.
function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const file = path.join(process.cwd(), name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!m) continue;
      const value = m[2].replace(/^["']|["']$/g, "");
      if (value && !process.env[m[1]]) process.env[m[1]] = value;
    }
  }
}

loadEnv();

const KEY = process.env.OPENAI_API_KEY;
const CONFIGURED = process.env.OPENAI_MODEL || "gpt-5-mini";

// In preference order. The first one present on the key wins.
//
// Ordered by fitness for THIS workload, not by capability: FieldQuo asks a
// model to pick a tool from six and write three sentences about numbers it was
// handed. A mini model does that as well as a flagship one and costs an order
// of magnitude less. Website copy is the one place the bigger model earns its
// price, and generateSite can override per call.
const PREFERRED = [
  "gpt-5.4-mini",
  "gpt-5-mini",
  "gpt-5.4",
  "gpt-5.5",
  "gpt-5",
  "gpt-4o-mini",
  "gpt-4o",
];

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

async function api(pathname, init) {
  const res = await fetch(`https://api.openai.com/v1${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  if (!KEY) {
    console.error(red("✗ OPENAI_API_KEY is not set."));
    console.error(
      dim(
        "  Set it in .env for a local check, or run this against the same key Vercel uses:\n" +
          "  OPENAI_API_KEY=sk-... node scripts/check-ai-model.mjs",
      ),
    );
    process.exit(1);
  }

  console.log(`Configured model: ${yellow(CONFIGURED)}`);
  console.log(dim("(lib/ai/provider.js — OPENAI_MODEL, defaulting to gpt-5-mini)\n"));

  const list = await api("/models");
  if (!list.ok) {
    console.error(red(`✗ Could not list models (HTTP ${list.status}).`));
    console.error(dim(`  ${list.body?.error?.message || "no message"}`));
    // 401 is a bad key, not a bad model — worth separating, because the fix is
    // completely different.
    if (list.status === 401) {
      console.error(red("\n  The key itself is rejected. Nothing else here matters until that's fixed."));
    }
    process.exit(1);
  }

  const available = new Set((list.body.data || []).map((m) => m.id));
  const present = available.has(CONFIGURED);

  if (present) {
    console.log(green(`✓ ${CONFIGURED} is listed on this key.`));
  } else {
    console.log(red(`✗ ${CONFIGURED} is NOT available on this key.`));
    console.log(
      dim(
        "  Every AI feature in FieldQuo is currently returning nothing:\n" +
          "  quote review, the copilot, digests, and website generation.\n" +
          "  complete() swallows the error, so none of them are logging a failure.",
      ),
    );
  }

  // Listing is necessary but not sufficient — a model can appear in /models and
  // still reject a chat completion (wrong endpoint family, no org access). One
  // real call is the only honest test.
  console.log(dim("\nSending one minimal completion…"));
  const isReasoning = /^(gpt-5|o[1-9])/.test(CONFIGURED);
  const probe = await api("/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      model: CONFIGURED,
      messages: [{ role: "user", content: "Reply with the single word: ok" }],
      // Reasoning models spend this budget thinking before they emit anything,
      // so a tight limit returns empty and looks like a failure. See the same
      // note in lib/ai/provider.js.
      max_completion_tokens: isReasoning ? 2000 : 20,
      ...(isReasoning ? { reasoning_effort: "low" } : {}),
    }),
  });

  if (probe.ok) {
    const text = probe.body.choices?.[0]?.message?.content?.trim();
    const u = probe.body.usage || {};
    console.log(green(`✓ Completion succeeded — replied ${JSON.stringify(text || "")}`));
    console.log(
      dim(`  ${u.prompt_tokens || 0} in / ${u.completion_tokens || 0} out`),
    );
  } else {
    console.log(red(`✗ Completion failed (HTTP ${probe.status}).`));
    console.log(dim(`  ${probe.body?.error?.message || "no message"}`));
  }

  const usable = PREFERRED.filter((m) => available.has(m));
  console.log("\nUsable models on this key, best fit first:");
  if (usable.length === 0) {
    console.log(red("  none of the expected models are available."));
    const chatty = [...available]
      .filter((id) => /^(gpt|o[1-9])/.test(id))
      .sort()
      .slice(0, 20);
    if (chatty.length) console.log(dim(`  others present: ${chatty.join(", ")}`));
  } else {
    for (const m of usable) {
      console.log(`  ${m === CONFIGURED ? green("→ " + m + "  (current)") : "  " + m}`);
    }
  }

  if (!present && usable.length) {
    console.log(yellow(`\nSet this in Vercel and locally:`));
    console.log(`  OPENAI_MODEL=${usable[0]}`);
  }

  // Non-zero exit so this can gate a deploy if you ever want it to.
  if (!present || !probe.ok) process.exit(1);
}

main().catch((err) => {
  console.error(red(`✗ ${err?.message || err}`));
  process.exit(1);
});
