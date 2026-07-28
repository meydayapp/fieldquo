// lib/ai/provider.js
//
// The one place FieldQuo talks to a model vendor.
//
// Previously five files each constructed their own Anthropic client and
// hardcoded a model name, so switching vendors meant editing five files and
// hoping none were missed. Everything now goes through here: swapping OpenAI
// for xAI, Google or back to Anthropic is one file and one dependency.
//
// Two entry points, because the app only ever does two things with a model:
//
//   complete()      — text in, text out. Summaries, digests, translations.
//   runToolLoop()   — the copilot. The model picks which lookup to run; the
//                     lookups themselves are ordinary Prisma queries in
//                     copilotTools.js.
//
// Worth being clear about what the model does and doesn't see, because it's
// what makes a cheap model the right call: it NEVER receives the database. It
// receives a list of tool names, decides which to call, and gets back a small
// JSON object of already-computed numbers. The arithmetic is done in code.
// The model's job is choosing a tool and writing a sentence — neither of which
// needs a frontier model.

import OpenAI from "openai";
import { lazyClient } from "@/lib/lazyClient";

// Lazy — see lib/lazyClient.js. Constructing at module scope breaks
// `next build` when the key isn't present at build time.
const client = lazyClient(
  () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
);

// Overridable without a deploy, so a pricing change or a better small model
// doesn't need a code edit.
const MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

export const AI_MODEL = MODEL;

// GPT-5 and o-series are REASONING models: the tokens they spend thinking come
// out of the same max_completion_tokens budget as the visible answer. A limit
// sized for the answer alone gets consumed by reasoning, and the API returns
//
//   400 Could not finish the message because max_tokens or model output limit
//       was reached
//
// which reads like the answer was too long when in fact it never started. The
// budgets below are sized for thinking PLUS output.
const IS_REASONING_MODEL = /^(gpt-5|o[1-9])/.test(MODEL);

// Minimal reasoning is right for this workload — picking a tool from six and
// writing two sentences about numbers it was handed. Higher effort spends more
// tokens to no benefit. Only sent to models that understand it; passing it to
// one that doesn't is itself a 400.
function reasoningParams() {
  return IS_REASONING_MODEL ? { reasoning_effort: "low" } : {};
}

// Headroom for reasoning. A reasoning model routinely spends more on thinking
// than on the reply, so these are deliberately generous — an unused budget
// costs nothing, an exhausted one costs the whole request.
const COMPLETION_BUDGET = IS_REASONING_MODEL ? 3000 : 800;
const TOOL_LOOP_BUDGET = IS_REASONING_MODEL ? 6000 : 1500;

/** True when the deployment can actually call a model. */
export function isAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * Plain text completion.
 *
 * Returns "" rather than throwing when unconfigured — every caller is a
 * nice-to-have summary, and a missing key should degrade to "no summary",
 * never to a 500 on a page that also shows real data.
 */
export async function complete({ system, prompt, maxTokens, onUsage }) {
  if (!isAiConfigured()) return "";

  try {
    const res = await client.chat.completions.create({
      model: MODEL,
      ...reasoningParams(),
      max_completion_tokens: Math.max(maxTokens || 0, COMPLETION_BUDGET),
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt },
      ],
    });

    // Report what it actually cost. The caller decides whether to record it —
    // this module deliberately doesn't touch the database.
    if (onUsage && res.usage) {
      await onUsage({
        model: MODEL,
        promptTokens: res.usage.prompt_tokens || 0,
        completionTokens: res.usage.completion_tokens || 0,
      });
    }

    return res.choices?.[0]?.message?.content?.trim() || "";
  } catch (err) {
    console.error("[ai] completion failed:", err?.message);
    return "";
  }
}

/**
 * Converts the tool definitions to OpenAI's function-calling shape.
 *
 * copilotTools.js keeps Anthropic's `input_schema` naming. Translating here
 * rather than rewriting that file means the tool definitions stay vendor-
 * neutral — the JSON Schema inside is identical either way, only the wrapper
 * differs.
 */
function toOpenAiTools(definitions) {
  return definitions.map((d) => ({
    type: "function",
    function: {
      name: d.name,
      description: d.description,
      parameters: d.input_schema || { type: "object", properties: {} },
    },
  }));
}

/**
 * Runs the model with tools until it produces a final answer.
 *
 * @param execute  async (name, args) => result. The CALLER runs the tool, so
 *                 this module never touches the database and companyId can be
 *                 injected outside the model's reach.
 */
export async function runToolLoop({
  system,
  messages,
  tools,
  execute,
  maxRounds = 5,
  maxTokens,
  onUsage,
}) {
  if (!isAiConfigured()) {
    return {
      text: "The assistant isn't configured on this deployment yet.",
      messages,
    };
  }

  const conversation = [
    ...(system ? [{ role: "system", content: system }] : []),
    ...messages,
  ];

  // Accumulated across ROUNDS, not per round. One question can make several
  // round trips — each tool call sends the whole conversation back — so
  // metering only the last response would understate a multi-tool question by
  // a factor of three or four.
  let promptTokens = 0;
  let completionTokens = 0;

  for (let round = 0; round < maxRounds; round++) {
    const res = await client.chat.completions.create({
      model: MODEL,
      ...reasoningParams(),
      max_completion_tokens: Math.max(maxTokens || 0, TOOL_LOOP_BUDGET),
      tools: toOpenAiTools(tools),
      messages: conversation,
    });

    if (res.usage) {
      promptTokens += res.usage.prompt_tokens || 0;
      completionTokens += res.usage.completion_tokens || 0;
    }

    const message = res.choices?.[0]?.message;
    if (!message) break;

    const calls = message.tool_calls || [];

    // No tool calls means it's answering.
    if (calls.length === 0) {
      if (onUsage) {
        await onUsage({ model: MODEL, promptTokens, completionTokens });
      }
      return { text: message.content?.trim() || "", messages: conversation };
    }

    // The assistant turn must be replayed verbatim before the results, or the
    // API rejects the follow-up for referencing tool_call_ids it can't see.
    conversation.push(message);

    const results = await Promise.all(
      calls.map(async (call) => {
        let content;
        try {
          const args = call.function.arguments
            ? JSON.parse(call.function.arguments)
            : {};
          content = JSON.stringify(await execute(call.function.name, args));
        } catch (err) {
          // Hand the failure back as a tool result rather than throwing. The
          // model can then say "I couldn't look that up" instead of the whole
          // request 500ing.
          content = JSON.stringify({ error: err?.message || "Tool failed" });
        }
        return { role: "tool", tool_call_id: call.id, content };
      }),
    );

    conversation.push(...results);
  }

  // Ran out of rounds. The tokens were still spent, so still meter them —
  // an expensive failure is exactly the case worth seeing in the numbers.
  if (onUsage) {
    await onUsage({ model: MODEL, promptTokens, completionTokens });
  }

  return {
    text: "I wasn't able to finish looking that up — try asking a more specific question.",
    messages: conversation,
  };
}
