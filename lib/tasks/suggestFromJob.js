// lib/tasks/suggestFromJob.js
//
// Read what a human wrote about a job; propose the office to-dos it implies.
//
// ── What this is NOT ───────────────────────────────────────────────────────
//
// It is not a trade-knowledge engine. "A concrete pour needs a slump test" is
// already encoded — 253 checklists mapped to 62 service categories, written to
// published standards. Asking a model to re-derive that produces "ensure
// safety protocols are observed", which is the item prisma/seed-checklists.js
// warns about: a step nobody can act on trains people to tick without reading.
//
// What a model is genuinely good at, and nothing else here can do, is reading
// "back gate is locked, call Mrs. Alvarez the day before" and turning it into
// a task somebody would otherwise forget. The notes are the input. The trade
// is not.
//
// Same division as lib/site/generateSite.js: the model writes sentences, the
// database supplies the facts.
//
// ── The `because` quote is a load-bearing guard, not a nicety ──────────────
//
// Every suggestion must quote the phrase from the source it came from, and
// this file DROPS any suggestion whose quote is not actually present in the
// text that was sent. A prompt instruction not to invent things is a hope; a
// verification step is a guard. A model that wants to suggest "arrange a
// permit" for a job whose notes never mention one has to fabricate a quote to
// do it, and the fabrication is what gets caught.
//
// The quote is also shown to the user, so the reason a task was proposed is
// legible without opening the quote and the client record to go looking.
//
// ── Nothing here writes ────────────────────────────────────────────────────
//
// Suggestions are returned, never persisted. A person ticks the ones they want
// and those become ordinary Tasks they own. Auto-creating five tasks on every
// job would make /app/tasks — the page whose entire job is "what have I let
// slip" — the page you stop reading.

import { db } from "@/lib/db";
import { complete, isAiConfigured } from "@/lib/ai/provider";

/// Hard ceiling on suggestions. Five is roughly the point past which a
/// suggestion list stops being read and starts being dismissed wholesale, and
/// a job whose notes genuinely imply nine actions has a scoping problem the
/// software shouldn't paper over.
const MAX_SUGGESTIONS = 5;

/// Free text longer than this is truncated before it goes to the model. A
/// client note field with a pasted email thread in it is common, and the
/// actionable part is almost always near the top.
const MAX_FIELD_CHARS = 1500;

const SYSTEM = `You read the notes a field-service company wrote about one job and list the office to-dos those notes imply.

RULES

1. Every task must come from something ACTUALLY WRITTEN in the input. You may not add tasks from general knowledge of the trade. The company already has detailed trade checklists; you are not writing those.
2. For each task, quote the exact phrase from the input it came from, verbatim, in "because". If you cannot quote a phrase, do not suggest the task.
3. Do not suggest generic project management ("schedule the work", "order materials", "confirm the budget") unless the notes specifically raise it.
4. If the notes imply no actions, return an empty list. An empty list is a correct and common answer.
5. Titles are short and imperative, under 60 characters, addressed to the office: "Call Mrs. Alvarez about gate access", not "Gate access".
6. Do not invent names, dates, phone numbers, prices or addresses. Use only what appears in the input.
7. At most 5 tasks. Fewer is better.

PRIORITY
"urgent" only for something that blocks the crew starting or risks a safety or legal problem. "high" for something with a deadline implied in the notes. Otherwise "normal".

DUE
"dueInDays" is a whole number of days from today, or null when the notes imply no timing. Do not invent a deadline.

Return ONLY a JSON array. No prose, no markdown fence.
[{"title":"...","because":"...","priority":"normal","dueInDays":null}]`;

function trim(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  return text.length > MAX_FIELD_CHARS
    ? `${text.slice(0, MAX_FIELD_CHARS)}…`
    : text;
}

/**
 * Flatten a quote's scope answers to readable lines.
 *
 * `scopeDetails` is intake JSON whose shape varies by trade, so this walks it
 * rather than assuming keys. Only strings survive: a number on its own ("3")
 * carries no action, and feeding the model unlabelled values invites it to
 * guess what they mean.
 */
function flattenScope(value, depth = 0) {
  if (depth > 3 || value == null) return [];
  if (typeof value === "string") {
    const text = value.trim();
    return text && text.length > 3 ? [text] : [];
  }
  if (Array.isArray(value)) return value.flatMap((v) => flattenScope(v, depth + 1));
  if (typeof value === "object") {
    return Object.entries(value).flatMap(([key, v]) => {
      const lines = flattenScope(v, depth + 1);
      return lines.map((line) => `${key}: ${line}`);
    });
  }
  return [];
}

/**
 * Normalise for quote-matching: lowercase, collapse whitespace, strip the
 * punctuation a model reflows when it "quotes" something.
 *
 * Deliberately lenient about punctuation and strict about words. A model that
 * turns "call ahead — gate's locked" into "call ahead, gate's locked" is
 * quoting faithfully; one that turns it into "arrange site access" is not.
 */
function canonical(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Is `quote` really present in `haystack`?
 *
 * Exact containment first. Failing that, a word-overlap test, because models
 * routinely drop a filler word or fix a typo when quoting. The threshold is
 * high enough that a paraphrase fails: 80% of the quote's words, with a floor
 * of three matching words so a two-word "quote" can't pass on coincidence.
 */
export function quoteIsGrounded(quoteText, haystack) {
  const needle = canonical(quoteText);
  const hay = canonical(haystack);
  if (!needle || !hay) return false;
  if (needle.length < 8) return false;
  if (hay.includes(needle)) return true;

  const words = needle.split(" ").filter((w) => w.length > 2);
  if (words.length < 3) return false;
  const hits = words.filter((w) => hay.includes(w)).length;
  return hits / words.length >= 0.8;
}

/**
 * Gather everything a human wrote about this job.
 *
 * Returns `{ sources, text }` — the labelled blocks for the prompt, and the
 * concatenation the `because` quotes are checked against. Company-scoped by
 * the caller's companyId, never by anything on the job row.
 */
export async function collectJobNotes(jobId, companyId) {
  const job = await db.job.findFirst({
    where: { id: jobId, companyId },
    select: {
      id: true,
      title: true,
      client: { select: { name: true, notes: true } },
      quote: {
        select: {
          notes: true,
          scopeDetails: true,
          quoteType: true,
          // A Json array, not a relation — hence read whole and walked below.
          lineItems: true,
        },
      },
      visits: {
        select: { notes: true },
        orderBy: { scheduledAt: "asc" },
        take: 10,
      },
    },
  });
  if (!job) return null;

  const sources = [];
  const push = (label, body) => {
    const text = trim(body);
    if (text) sources.push({ label, text });
  };

  push("Client notes", job.client?.notes);
  push("Quote notes", job.quote?.notes);

  const scope = flattenScope(job.quote?.scopeDetails).slice(0, 30);
  if (scope.length) push("What the client told us", scope.join("\n"));

  const visitNotes = (job.visits || [])
    .map((v) => trim(v.notes))
    .filter(Boolean);
  if (visitNotes.length) push("Notes from site visits", visitNotes.join("\n"));

  // Line items are context for reading the notes, not a source of tasks: "800
  // sq ft of hardwood" implies nothing to do. Included in the prompt, excluded
  // from the grounding text so a task can never be justified by quoting one.
  //
  // `lineItems` is untyped Json written by several different quote builders,
  // so the description key is read defensively rather than assumed — a shape
  // mismatch here should cost the model some context, not throw on a job page.
  const lineItems = (Array.isArray(job.quote?.lineItems) ? job.quote.lineItems : [])
    .map((i) => trim(i?.description || i?.name || i?.label))
    .filter(Boolean)
    .slice(0, 25);

  return {
    job,
    sources,
    lineItems,
    // ONLY the human-written notes. This is what a `because` quote must appear
    // in — the whole point of the check is that the model cannot justify a
    // suggestion with a service name off the quote.
    text: sources.map((s) => s.text).join("\n"),
  };
}

/**
 * Suggest tasks for a job. Returns `{ suggestions, reason }`.
 *
 * `reason` explains an empty list, because "no suggestions" and "the AI is
 * switched off" look identical to a user and mean completely different things.
 * Never throws: the caller is a button on a job page, and a suggestion feature
 * that 500s is worse than one that says it has nothing.
 */
export async function suggestTasksForJob({ jobId, companyId, onUsage }) {
  if (!isAiConfigured()) {
    return { suggestions: [], reason: "ai_unavailable" };
  }

  const context = await collectJobNotes(jobId, companyId);
  if (!context) return { suggestions: [], reason: "not_found" };

  // No notes, no suggestions — and no model call. There is nothing to read,
  // and a model handed an empty job would answer with the generic project
  // management rule 3 forbids. Cheaper and more honest to not ask.
  if (!context.text.trim()) {
    return { suggestions: [], reason: "no_notes" };
  }

  const payload = {
    today: new Date().toISOString().slice(0, 10),
    job: context.job.title,
    client: context.job.client?.name || null,
    trade: context.job.quote?.quoteType || null,
    // Context only — see collectJobNotes. Not quotable.
    workOrdered: context.lineItems,
    notes: context.sources,
  };

  let text = "";
  try {
    text = await complete({
      system: SYSTEM,
      prompt: JSON.stringify(payload),
      onUsage,
    });
  } catch (err) {
    console.error("[suggestFromJob] model call failed:", err?.message);
    return { suggestions: [], reason: "ai_error" };
  }

  if (!text) return { suggestions: [], reason: "ai_unavailable" };

  let parsed;
  try {
    // Models occasionally fence JSON despite being told not to. Cheaper to
    // strip it than to spend a retry.
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("[suggestFromJob] model returned unparseable JSON");
    return { suggestions: [], reason: "ai_error" };
  }

  if (!Array.isArray(parsed)) return { suggestions: [], reason: "ai_error" };

  let dropped = 0;
  const suggestions = parsed
    .map((raw) => {
      const title = trim(raw?.title);
      const because = trim(raw?.because);
      if (!title || !because) return null;

      // THE GUARD. A suggestion whose quote isn't in the notes was not read
      // out of them, whatever the model believes. Dropped silently rather than
      // surfaced with a warning: a user cannot act on "the AI made this up",
      // and showing it anyway would put the burden of catching hallucination
      // on the person least equipped to.
      if (!quoteIsGrounded(because, context.text)) {
        dropped += 1;
        return null;
      }

      const priority = ["urgent", "high", "normal", "low"].includes(raw?.priority)
        ? raw.priority
        : "normal";

      // A due date the model invented is worse than none: it looks like a
      // commitment somebody made. Only whole, sane day counts survive.
      const days = Number(raw?.dueInDays);
      const dueInDays =
        Number.isInteger(days) && days >= 0 && days <= 365 ? days : null;

      return {
        title: title.slice(0, 120),
        because,
        priority,
        dueInDays,
      };
    })
    .filter(Boolean)
    .slice(0, MAX_SUGGESTIONS);

  if (dropped) {
    console.warn(
      `[suggestFromJob] dropped ${dropped} suggestion(s) not grounded in the notes`,
    );
  }

  return {
    suggestions,
    reason: suggestions.length ? null : dropped ? "ungrounded" : "nothing_to_do",
  };
}
