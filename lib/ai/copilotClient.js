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
// `member` is the second half of that, added later: companyId decides WHOSE
// data, the member's permission grid decides WHICH OF IT this person may be
// told. copilotTools.js does the deciding; this file's job is to make sure the
// prompt describes the tools that survived, not the ones that didn't.
//
// Vendor lives in ./provider.js. This file is about what the copilot IS, not
// which model answers.

import { copilotToolsFor } from "./copilotTools";
import { runToolLoop } from "./provider";

// ── Why the prompt is assembled rather than a constant ──────────────────────
//
// It used to be one string that named cash flow, quote totals and amounts
// owing. Handed to a member whose tools had been filtered down, that string
// becomes a list of promises the model cannot keep — and a model told it can
// see an amount owing will go looking for a way to produce one: guessing,
// asking the person for the figure, or announcing that it has the invoice but
// may not say what's on it. The last is the worst of the three, because it
// confirms the number exists and invites the next question.
//
// So every sentence that names a capability is conditional on the tool being
// present. What the model isn't told about, it doesn't offer.
const HEADER = `You are FieldQuo AI, built into software a contracting/home-services company runs their business on.`;

const REFUSAL = `WHAT YOU DON'T DO
Anything unrelated to running this business. If asked for general help — coding,
recipes, essays, homework, world knowledge — decline in ONE sentence and say what
you can help with instead. Don't apologise at length or explain the policy.

If a question needs something you have no tool for, say plainly that you can't
look that up here and that an owner or admin can. Don't guess at it, don't work
it out from something else you were given, and don't speculate about what the
answer might be.`;

const DRAFTING = `WHEN DRAFTING A MESSAGE
Write the message itself, ready to send. Don't interrogate them first with a list
of questions — make sensible assumptions, write the draft, and note briefly at the
end anything they should check or fill in. A draft they can edit beats a
questionnaire they have to answer.

The person reading this runs a trade business and is probably on a phone between
jobs. Respect that.`;

/** The tools whose output contains money. */
const MONEY_TOOLS = [
  "getCashFlow",
  "getProfitByCategory",
  "getTopClients",
  "getConversionRate",
  "getRepeatCustomerRate",
  "findQuote",
  "findInvoice",
  "findJob",
];

function buildSystemPrompt(definitions) {
  const names = new Set(definitions.map((d) => d.name));
  const has = (n) => names.has(n);
  const hasMoney = MONEY_TOOLS.some(has);

  // ── WHAT YOU DO ──────────────────────────────────────────────────────────
  const does = [];

  if (
    has("getCashFlow") ||
    has("getProfitByCategory") ||
    has("getTopClients") ||
    has("getConversionRate") ||
    has("getRepeatCustomerRate")
  ) {
    does.push(`Answer questions about THIS company's own numbers, using the read-only tools
   for quotes, invoices, clients and cash flow.`);
  }

  if (has("getUpcomingWork") || has("findQuote") || has("findInvoice") || has("findJob")) {
    // Each clause names a tool, so each clause has to be earned by that tool
    // being in the list. The worked examples at the end are the part the model
    // actually follows, so they're rebuilt from the same facts rather than
    // left standing as a fixed paragraph that outlives its tools.
    const clauses = [];
    if (has("getUpcomingWork"))
      clauses.push(`   - getUpcomingWork — "what's scheduled" questions. Each job's client, the
     note on the visit, and the linked quote with its NOTES.`);
    if (has("findQuote") || has("findInvoice"))
      clauses.push(
        `   - ${[has("findQuote") && "findQuote", has("findInvoice") && "findInvoice"]
          .filter(Boolean)
          .join(" / ")} — open a specific document by number or client name and
     read its notes, line items and whether photos are attached.`,
      );
    if (has("findJob"))
      clauses.push(`   - findJob — open a specific PROJECT by title or client and read every
     visit's NOTES and photo count, the hours logged against it, and its quote
     and invoices. For "how is the Smith job going" or "what did the crew note
     on that project".`);

    const examples = [];
    if (has("getUpcomingWork"))
      examples.push(`"any notes on next week's project?" = getUpcomingWork, then
   read the visitNotes and the quote's notes`);
    if (has("findJob")) examples.push(`"how's the X job going?" = findJob`);

    does.push(
      [
        `Look up specific work and read what's INSIDE it.`,
        ...clauses,
        `   Read each tool's own description for exactly what it gives back, and
   don't assume a field it doesn't list.`,
        ...(examples.length ? [`   So ${examples.join("; ")}.`] : []),
      ].join("\n"),
    );
  }

  does.push(
    `Draft client-facing messages for them — quote follow-ups, payment reminders,
   job updates, apologies for a delay.` +
      (hasMoney
        ? ` Use real figures from the tools where
   they're relevant (an invoice number, an amount owing, a quote total).`
        : ` Use only what the tools give you — no amounts,
   and never a figure you worked out yourself.`),
  );

  const whatYouDo = `WHAT YOU DO\n${does.map((d, i) => `${i + 1}. ${d}`).join("\n")}`;

  // ── HOW YOU ANSWER ───────────────────────────────────────────────────────
  const how = [
    `Use the tools. Never guess or invent a number.`,
    `If a tool returns nothing, say there isn't enough data yet. Don't fill the gap.`,
    `Direct and concise, like a knowledgeable colleague. No preamble, no "Great
  question!", no bullet-point lecture where two sentences will do.`,
  ];
  if (hasMoney) {
    how.push(`Quote the actual figures you were given, and name the period they cover.`);
    how.push(`If a number looks concerning — low conversion, negative cash flow, profit
  sliding in a category — say so plainly and suggest ONE concrete next step.`);
  }

  const howYouAnswer = `HOW YOU ANSWER\n${how.map((h) => `- ${h}`).join("\n")}`;

  return [HEADER, whatYouDo, REFUSAL, howYouAnswer, DRAFTING].join("\n\n");
}

/**
 * @param member  the row from loadEnforceableMember. It decides the tool list,
 *                so a caller that omits it gets the analytics and lookup tools
 *                withheld — hasLevel/hasToggle deny an unidentifiable member,
 *                and that is the direction to fail in.
 */
export async function askCopilot({ companyId, member, messages, onUsage }) {
  const { definitions, implementations } = copilotToolsFor(member);

  const { text, messages: conversation } = await runToolLoop({
    system: buildSystemPrompt(definitions),
    messages,
    tools: definitions,
    onUsage,
    execute: async (name, args) => {
      // Unknown here means "not in THIS member's list", which covers both a
      // hallucinated tool name and a real one the grid removed. Same answer to
      // both: the model is told the tool doesn't exist, not that it's
      // forbidden — a refusal it can report is a refusal it can work around.
      const impl = implementations[name];
      if (!impl) throw new Error(`Unknown tool: ${name}`);

      // The injection point. `...args` first, `companyId` last, so a model
      // that tries to pass its own companyId has it overwritten rather than
      // honoured. copilotToolsFor binds `member` the same way.
      return impl({ ...args, companyId });
    },
  });

  return { text, conversation };
}
