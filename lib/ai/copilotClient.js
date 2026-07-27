// lib/ai/copilotClient.js
import Anthropic from "@anthropic-ai/sdk";
import {
  COPILOT_TOOL_DEFINITIONS,
  COPILOT_TOOL_IMPLEMENTATIONS,
} from "./copilotTools";
import { lazyClient } from "@/lib/lazyClient";

// Lazy — see lib/lazyClient.js. Constructing at module scope breaks the
// production build when ANTHROPIC_API_KEY isn't set at build time.
const anthropic = lazyClient(
  () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
);

const SYSTEM_PROMPT = `You are FieldQuo Copilot, a business advisor for a contracting/home-services company.
You have read-only tools to look up the company's own quotes, invoices, clients, and material costs.
Answer questions using the tools — don't guess numbers. Be direct and concise, like a knowledgeable
colleague, not a generic chatbot. If a number looks concerning (e.g. low conversion rate, negative
cash flow), say so plainly and suggest one concrete next step, but don't lecture.`;

const MAX_TOOL_ROUNDS = 5;

export async function askCopilot({ companyId, messages }) {
  let conversation = [...messages];
  let rounds = 0;

  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: COPILOT_TOOL_DEFINITIONS,
      messages: conversation,
    });

    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");

    if (toolUseBlocks.length === 0) {
      const textBlock = response.content.find((b) => b.type === "text");
      return { text: textBlock?.text || "", conversation };
    }

    conversation.push({ role: "assistant", content: response.content });

    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const impl = COPILOT_TOOL_IMPLEMENTATIONS[block.name];
        if (!impl) {
          return {
            type: "tool_result",
            tool_use_id: block.id,
            content: `Unknown tool: ${block.name}`,
            is_error: true,
          };
        }

        try {
          // companyId is injected here, NOT taken from block.input — the model
          // cannot override which company's data it queries.
          const result = await impl({ ...block.input, companyId });
          return {
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          };
        } catch (err) {
          return {
            type: "tool_result",
            tool_use_id: block.id,
            content: `Error: ${err.message}`,
            is_error: true,
          };
        }
      }),
    );

    conversation.push({ role: "user", content: toolResults });
  }

  return {
    text: "I wasn't able to finish looking that up — try asking a more specific question.",
    conversation,
  };
}
