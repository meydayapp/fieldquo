// lib/ai/toolLoopProbe.js
//
// Does a tool-calling conversation actually work on this tier's model?
//
// ══ Why the plain completion probe was not enough ══════════════════════════
//
// app/api/platform/ai-health has always sent one two-token completion to the
// standard model and called the AI healthy when it answered. On 2026-10-04 it
// was green while the AI employee had never replied once in production: the
// employee runs a TOOL LOOP on the BEST tier, and gpt-5.5 refuses tools plus
// reasoning_effort on Chat Completions. Neither the model nor the shape the
// health check exercised was the one that was failing.
//
// So this probe runs the SHIPPED runToolLoop — not a hand-built request — per
// tier, with one trivial tool and reasoning on, which is the exact
// combination that broke. Whatever API lib/ai/provider.js's capability table
// sends that model to is the API this exercises.
//
// ══ Cost ═══════════════════════════════════════════════════════════════════
//
// Two short rounds per tier at LOW effort: well under a cent on the mini,
// around a cent on gpt-5.5. Low rather than the employee's medium because the
// thing being proved is that the request is ACCEPTED, and the API a model is
// sent to depends on the model, not on the effort. Not metered into AiUsage,
// for the reason the route's header gives: this belongs to no company.
//
// Never throws: a probe that 500s the health route reads as the route being
// broken rather than the model.

import { runToolLoop, modelForTier, toolLoopApiFor, vendorErrorSummary } from "./provider";

export const PROBE_TOOL = Object.freeze({
  name: "get_probe_word",
  description: "Returns the word you must reply with. Takes no arguments.",
  input_schema: { type: "object", properties: {}, additionalProperties: false },
});

const PROBE_WORD = "ok";

/**
 * @param tier   "standard" | "best"
 * @param deps   { runToolLoop } — a check passes a fake; nothing else does.
 * @returns { tier, model, api, ok, toolCalled, reply, error, status, ms }
 */
export async function probeToolLoop({ tier = "standard", timeoutMs = 20_000, deps = {} } = {}) {
  const run = deps.runToolLoop || runToolLoop;
  const model = modelForTier(tier);
  const api = toolLoopApiFor(model);
  const started = Date.now();
  let toolCalls = 0;

  try {
    const { text } = await run({
      system:
        "You are a connectivity probe. Call get_probe_word exactly once, then reply with only the word it returned.",
      messages: [{ role: "user", content: "What is the word?" }],
      tools: [PROBE_TOOL],
      execute: async (name) => {
        toolCalls += 1;
        if (name !== PROBE_TOOL.name) throw new Error(`Unknown tool: ${name}`);
        return { word: PROBE_WORD };
      },
      maxRounds: 3,
      tier,
      reasoningEffort: "low",
      timeoutMs,
    });
    const reply = String(text || "").trim().slice(0, 80);
    const answered = new RegExp(`\\b${PROBE_WORD}\\b`, "i").test(reply);
    const ok = toolCalls > 0 && answered;
    return {
      tier,
      model,
      api,
      ok,
      toolCalled: toolCalls > 0,
      reply: reply || null,
      // The request was accepted in both of these; what failed is the loop.
      error: ok
        ? null
        : toolCalls === 0
          ? "the model answered without calling the tool"
          : "the tool ran but the model never wrote the word back",
      status: null,
      ms: Date.now() - started,
    };
  } catch (err) {
    const v = vendorErrorSummary(err);
    return {
      tier,
      model,
      api,
      ok: false,
      toolCalled: toolCalls > 0,
      reply: null,
      error: v.message,
      status: v.status,
      ms: Date.now() - started,
    };
  }
}
