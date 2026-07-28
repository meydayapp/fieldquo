// lib/ai/copilotClient.js
//
// FieldQuo AI: answers questions about a company's own numbers.
//
// The security property that matters here is unchanged from the original —
// `companyId` is injected when the tool runs, NEVER read from what the model
// produced. A model can hallucinate a tool argument; it cannot hallucinate its
// way into another company's books, because the id it would have to supply is
// overwritten before the query runs.
//
// Vendor lives in ./provider.js. This file is about what the copilot IS, not
// which model answers.

import {
  COPILOT_TOOL_DEFINITIONS,
  COPILOT_TOOL_IMPLEMENTATIONS,
} from "./copilotTools";
import { runToolLoop } from "./provider";

const SYSTEM_PROMPT = `You are FieldQuo AI, a business advisor for a contracting/home-services company.
You have read-only tools to look up the company's own quotes, invoices, clients, and material costs.

Rules:
- Answer using the tools. Never guess or invent a number.
- If a tool returns null or no rows, say there isn't enough data yet rather than filling the gap.
- Be direct and concise, like a knowledgeable colleague — not a chatbot. No preamble, no "Great question!".
- Quote the actual figures you were given, and name the period they cover.
- If a number looks concerning (low conversion, negative cash flow, a material cost spiking), say so
  plainly and suggest one concrete next step. One. Don't lecture.`;

export async function askCopilot({ companyId, messages, onUsage }) {
  const { text, messages: conversation } = await runToolLoop({
    system: SYSTEM_PROMPT,
    messages,
    tools: COPILOT_TOOL_DEFINITIONS,
    onUsage,
    execute: async (name, args) => {
      const impl = COPILOT_TOOL_IMPLEMENTATIONS[name];
      if (!impl) throw new Error(`Unknown tool: ${name}`);

      // The injection point. `...args` first, `companyId` last, so a model
      // that tries to pass its own companyId has it overwritten rather than
      // honoured.
      return impl({ ...args, companyId });
    },
  });

  return { text, conversation };
}
