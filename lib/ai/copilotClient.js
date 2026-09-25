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
import { CRISIS_RULE } from "./crisisRule";
import { withLanguage } from "@/lib/i18n/aiLanguage";

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

// ── Who can see what the asker can't ────────────────────────────────────────
//
// The tool list is already filtered by the grid, so a question with no tool
// behind it is either something FieldQuo can't compute yet or something this
// person's access level withholds. The two need different sentences: telling
// the owner "an owner or admin can see that" is nonsense, and telling a crew
// member "that's not something I can look up" hides the fact that their admin
// can. Exported so the check script can assert the exact wording rather than
// a paraphrase of it.
export const NO_TOOL_ADMIN = `If a question needs something you have no tool for, say in one sentence that it
isn't something you can look up yet. Don't guess at it, don't work it out from
something else you were given, and don't speculate about what the answer might
be.`;

export const NO_TOOL_MEMBER = `If a question needs something you have no tool for, answer with one sentence:
"Your admin can see that." Don't guess at it, don't work it out from something
else you were given, don't describe a page they should open instead, and don't
speculate about what the answer might be.`;

function refusal(role) {
  const isAdmin = role === "owner" || role === "admin";
  return `WHAT YOU DON'T DO
Anything unrelated to running this business. If asked for general help — coding,
recipes, essays, homework, world knowledge — decline in ONE sentence and say what
you can help with instead. Don't apologise at length or explain the policy.

${isAdmin ? NO_TOOL_ADMIN : NO_TOOL_MEMBER}`;
}

// ── The voice ────────────────────────────────────────────────────────────────
//
// The owner, reading the support chat: it "needs to be more human". What he
// had read was an assistant that described the screen instead of answering
// ("open your Quotes list… I already placed a button") — the assistant
// narrating the UI is the least human thing it can do, because a colleague
// with the answer just says the answer. Written as one block shared with
// Jennifer (lib/ai/jennifer/prompt.js imports it) so the two assistants
// can't drift into two personalities.
//
// The greeting rule is a rule about ONCE. Every reply starting "Hi Emilio"
// reads as a form letter; the first one reads as a person.
//
// On being an AI: not announced, not denied. A colleague doesn't open with
// their job title either; if someone asks outright, the truthful answer is
// the only acceptable one. This is the in-app decision only — the customer-
// facing AI employee (lib/aiEmployee/respond.js) discloses on the first
// message of every channel, because a homeowner is owed that and a member of
// staff typing into their own back office is not.
export function voiceRule({ firstName } = {}) {
  const name = String(firstName || "").trim();
  return `HOW YOU SOUND
- Like a colleague who has the numbers in front of them, not like software.
- ${
    name
      ? `The person is ${name}. Use their first name in your FIRST reply of a conversation and not again after that.`
      : `Don't invent a name for the person; you weren't given one.`
  }
- The number first, then the detail, then at most ONE next step:
  "7 quotes are waiting on a reply — the oldest is Q-2026-0003, 12 days.
  Want a follow-up drafted for it?"
- One question, one short answer. A single-line answer is a single line — no
  heading, no bullet list, no recap of the question. Lists only when there
  are several items to compare.
- Never describe the interface instead of answering. Never tell them to open
  a page or a list for a figure you can look up, and never say you "placed",
  "added" or "opened" anything — you can't, and you didn't.
- Don't announce that you are an AI, a bot or a model, and don't sign off as
  one. If they ask you directly whether they're talking to a person, say
  truthfully that you're FieldQuo's assistant, in one clause, and carry on.
- Reply in the language they wrote in.`;
}

// ── Why a business tool needs this at all ───────────────────────────────────
//
// This is a chat box a member of staff types into between jobs, not a phone —
// but the person typing is still a person, and "it's an internal tool" is not
// a reason a distressed message here gets a chirpy answer about invoice
// reminders. CRISIS_RULE is shared with the receptionist, the outbound caller
// and FieldQuo's own sales line rather than paraphrased here — see
// lib/ai/crisisRule.js. Included below right after what the assistant refuses
// to do, so it reads as a boundary rather than a footnote.

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
  "getReceivables",
  "getAverageQuoteValue",
  "getMaterialCostChanges",
];

// ── The pipeline tools, one sentence each ────────────────────────────────────
//
// Kept as a table so the prompt names exactly the tools that survived the
// grid: a sentence promising "how much is owed" to someone whose getReceivables
// was withheld is the promise-the-model-can't-keep problem the header
// describes. Each sentence pairs the question people ask with the tool that
// answers it — the wording the model matches against.
const PIPELINE_CLAUSES = {
  countQuotesByStatus: `"how many quotes are pending / waiting / open" = countQuotesByStatus`,
  getReceivables: `"how much money is owed / outstanding / overdue" = getReceivables`,
  getUnbilledWork: `"which clients haven't been invoiced yet" = getUnbilledWork`,
  getJobsThisWeek: `"what's on this week" / "which jobs am I on" = getJobsThisWeek`,
  countLeads: `"how many leads came in" = countLeads`,
  getAverageQuoteValue: `"average quote value this month" = getAverageQuoteValue`,
  getMaterialCostChanges: `"which material costs went up" = getMaterialCostChanges`,
};

// Exported so scripts/check-crisis-handling.mjs can build the real prompt from
// a fixture tool list and assert on it, the same way buildAgentPrompt,
// buildOutboundPrompt and buildSalesPrompt are already exported for their own
// checks — without this, proving CRISIS_RULE actually reaches the copilot
// would mean reading the source rather than executing it.
//
// @param definitions  the tool list copilotToolsFor returned for this member
// @param firstName    the asker's first name, for the one greeting
// @param role         the asker's role, which decides the refusal sentence
export function buildSystemPrompt(definitions, { firstName, role } = {}) {
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

  const pipeline = Object.entries(PIPELINE_CLAUSES)
    .filter(([name]) => has(name))
    .map(([, clause]) => `   - ${clause}`);
  if (pipeline.length) {
    does.push(
      [
        `Answer the pipeline questions with a COUNT or a TOTAL, computed by a tool —
   never by adding up documents yourself:`,
        ...pipeline,
        `   Call the tool first, then answer with its number. If the count is zero,
   say so plainly ("Nothing is waiting on a reply right now") — zero is an
   answer, not a reason to send them to a page.`,
      ].join("\n"),
    );
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

  return [
    HEADER,
    whatYouDo,
    refusal(role),
    CRISIS_RULE,
    howYouAnswer,
    voiceRule({ firstName }),
    DRAFTING,
  ].join("\n\n");
}

/**
 * @param member     the row from loadEnforceableMember. It decides the tool
 *                   list, so a caller that omits it gets the analytics and
 *                   lookup tools withheld — hasLevel/hasToggle deny an
 *                   unidentifiable member, and that is the direction to fail in.
 * @param firstName  the asker's first name, or null — see voiceRule.
 */
export async function askCopilot({ companyId, member, messages, language, firstName, onUsage }) {
  const { definitions, implementations } = copilotToolsFor(member);

  const { text, messages: conversation } = await runToolLoop({
    // The answer is WRITTEN in the reader's language rather than translated
    // afterwards — see lib/i18n/aiLanguage.js. The tool DEFINITIONS stay
    // English: those are the model's instructions, not its output, and
    // renaming a tool per language is how a tool stops being found.
    system: withLanguage(
      buildSystemPrompt(definitions, { firstName, role: member?.role }),
      language,
    ),
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
