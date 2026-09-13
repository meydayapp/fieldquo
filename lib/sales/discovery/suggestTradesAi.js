// lib/sales/discovery/suggestTradesAi.js
//
// Phase 2 of the owner's ask: "use AI to infer the trade" — for the rows the
// name table could not read, and only those.
//
// ══ Why second, and why only the residue ═══════════════════════════════════
//
// The name table (tradeSuggest.js) reads "B & R Plumbing Heating & Air" for
// free and is right 93 times in 100 on a hand-checked draw. Asking a model
// the same question for those rows would cost money to be told the same
// thing. What the table cannot read is "MOSSPRODUCTIONS LLC", "KRISHNA
// PATEL", "N3 CONSTRUCTION" — a person's name, a numbered company, a bare
// "construction" — and a model reading only the name cannot do much better
// on most of those either. So this runs over the "no suggestion" card
// (suggestedGroupSql("none")) and is expected to answer `unknown` often; an
// `unknown` is written too, with basis `ai`, so the row is not asked twice.
//
// ══ What the model sees, and what it may say ═══════════════════════════════
//
// A batch of up to AI_BATCH names with city and province, numbered 0..n
// inside the batch — never the cuid, which is eight tokens of noise a
// hundred times over. It answers with a JSON object the vendor constrains to
// the schema below: per row an index, ONE of the real DISCOVERY_TRADES keys
// or `not_contractor` or `unknown`, a confidence 0–1, and a why of at most
// eight words. `parseAiSuggestions` re-validates everything after the vendor
// does — an unknown key is dropped, not mapped to the nearest — and the check
// asserts that with a hostile reply.
//
// Every batch is ONE `complete()` call through lib/ai/provider.js — the only
// file that talks to a vendor — on the default (cheapest) model, with
// `checkPlatformAiBudget` before and `recordPlatformAiUsage` after, under
// the platform area TRADE_SUGGESTION_AI_AREA. The tenant meter
// (lib/ai/usage.js) does not apply: FieldQuo is the customer here, the same
// reasoning lib/ai/platformUsage.js's header gives for the pipeline.
//
// ══ Still not a trade ══════════════════════════════════════════════════════
//
// Written to the same Prospect.suggested* columns, basis `ai`, model's own
// confidence. Never `tradeKey`. The reviewer confirms these on the same
// cards as the name-based ones, and the card says "ai" beside each row.
//
// ══ The cost is estimated from measured lengths, never a typed price ═══════
//
// `estimateAiCost` counts the rows on the card, reads their average name and
// city length from the database, converts characters to tokens at four per
// token (the vendor's own rule of thumb for English), adds the per-batch
// overhead of the system prompt, the trade list and a reasoning allowance,
// and prices the result with lib/ai/usage.js's `estimateCostMicros` for the
// configured model. The button shows that number and a typed confirmation
// gate stands in front of the run. When the model has no checked price the
// estimate says so rather than pricing it on the fallback.

import { Prisma } from "@prisma/client";
import { AI_MODEL, complete } from "@/lib/ai/provider";
import { estimateCostMicros, hasKnownPricing } from "@/lib/ai/usage";
import { checkPlatformAiBudget, recordPlatformAiUsage } from "@/lib/ai/platformUsage";
import { reviewWhereSql, suggestedGroupSql } from "./reviewFolder";
import { SUGGEST_VERSION } from "./tradeSuggest";
import { DISCOVERY_TRADES, discoveryTradeLabel, isDiscoveryTradeKey } from "./trades";

export const TRADE_SUGGESTION_AI_AREA = "trade_suggestion";

/** Names per model call. A hundred keeps the reply under the completion budget
 *  at ~30 tokens a row and the prompt under two thousand. */
export const AI_BATCH = 100;

export const AI_VERDICTS = Object.freeze(["not_contractor", "unknown"]);

/** What the superadmin types to run the paid pass. Words, not a click. */
export const AI_CONFIRM_PHRASE = "COMPUTE AI SUGGESTIONS";

/** Prompt version, stamped in the note so a later prompt can be told apart. */
export const AI_PROMPT_VERSION = "2026-09-13.1";

// ── Cost assumptions, stated so the estimate can be argued with ────────────

/** Characters per token. The vendor's stated rule of thumb for English. */
export const CHARS_PER_TOKEN = 4;
/** System prompt + trade list, per batch, measured by counting the prompt below. */
export const PROMPT_OVERHEAD_TOKENS = 560;
/** Reasoning allowance per batch on a reasoning model at low effort. An
 *  allowance, not a measurement — the first real run replaces it. */
export const REASONING_TOKENS_PER_BATCH = 1000;
/** `{"i":12,"tradeKey":"plumbing","confidence":0.8,"why":"..."}` with a short why. */
export const COMPLETION_TOKENS_PER_ROW = 32;
/** Index, name, city, province and the separators, beyond the name's own characters. */
export const PROMPT_FIXED_TOKENS_PER_ROW = 6;

export function tradeSuggestionSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["results"],
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["i", "tradeKey", "confidence", "why"],
          properties: {
            i: { type: "integer" },
            tradeKey: { type: "string", enum: [...Object.keys(DISCOVERY_TRADES), ...AI_VERDICTS] },
            confidence: { type: "number" },
            why: { type: "string" },
          },
        },
      },
    },
  };
}

export const TRADE_SUGGESTION_SYSTEM =
  "You read the registered names of small businesses and say which home-service trade each one most likely works in. " +
  "You answer from the name, the city and the province alone; you never invent a website, a licence or a review. " +
  "Use exactly one key from the list you are given. A supplier, a store, a manufacturer, a farm, a nursery or a " +
  "rental yard is not_contractor. A person's name, a numbered company, a bare 'construction' or 'enterprises' with " +
  "nothing else is unknown — say unknown rather than guess, because a wrong trade sends a salesperson to the wrong " +
  "call. The why is at most eight words naming the word in the name you relied on.";

/** The one-line trade list the prompt carries, so the model sees labels beside keys. */
export function tradeListForPrompt() {
  return Object.entries(DISCOVERY_TRADES)
    .map(([key, t]) => `${key} = ${t.label}`)
    .join("; ");
}

/** The user prompt for one batch. Pure, so the check can count its tokens. */
export function tradeSuggestionPrompt(rows) {
  const lines = rows.map((r, i) => `${i}\t${r.businessName}\t${[r.city, r.province].filter(Boolean).join(", ")}`);
  return (
    `Trade keys: ${tradeListForPrompt()}; not_contractor; unknown.\n` +
    `One result per line, by its number. Lines are number, name, place:\n${lines.join("\n")}`
  );
}

/**
 * The model's reply, re-validated, against the batch it answered.
 *
 * @returns {{ kept: {i:number, tradeKey:string|null, verdict:string|null, confidence:number, why:string}[], dropped: {i:any, reason:string}[] }}
 *          `tradeKey` is a catalogue key or null; `verdict` is
 *          "not_contractor" | "unknown" | null. An unknown key, an index
 *          outside the batch, a duplicate index, a confidence outside 0–1
 *          are DROPPED with a reason — never coerced.
 */
export function parseAiSuggestions(data, batchSize) {
  const kept = [];
  const dropped = [];
  const seen = new Set();
  const results = Array.isArray(data?.results) ? data.results : [];
  for (const r of results) {
    const i = Number.isInteger(r?.i) ? r.i : null;
    if (i === null || i < 0 || i >= batchSize) {
      dropped.push({ i: r?.i, reason: "index outside the batch" });
      continue;
    }
    if (seen.has(i)) {
      dropped.push({ i, reason: "answered twice" });
      continue;
    }
    const key = typeof r?.tradeKey === "string" ? r.tradeKey.trim() : "";
    const isVerdict = AI_VERDICTS.includes(key);
    if (!isVerdict && !isDiscoveryTradeKey(key)) {
      dropped.push({ i, reason: `"${key}" is not a trade key` });
      continue;
    }
    const confidence = Number(r?.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      dropped.push({ i, reason: "confidence outside 0–1" });
      continue;
    }
    const why = String(r?.why ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 8).join(" ").slice(0, 80);
    seen.add(i);
    kept.push({ i, tradeKey: isVerdict ? null : key, verdict: isVerdict ? key : null, confidence: Math.round(confidence * 100) / 100, why });
  }
  return { kept, dropped };
}

/** The rows the AI pass reads: the "none" card, minus rows it already answered. */
export function aiSelectionSql({ now = new Date() } = {}) {
  return Prisma.sql`${reviewWhereSql({}, { now })} AND ${suggestedGroupSql("none")} AND ("suggestedTradeBasis" IS NULL OR "suggestedTradeBasis" <> 'ai')`;
}

/**
 * What the AI pass over the remaining rows would cost, from measured lengths.
 *
 * @returns {Promise<{ rows:number, batches:number, model:string, priced:boolean, avgChars:number,
 *                     promptTokens:number, completionTokens:number, costMicros:number|null }>}
 */
export async function estimateAiCost({ db, now = new Date(), model = AI_MODEL } = {}) {
  const [{ n, chars }] = await db.$queryRaw`SELECT COUNT(*)::int AS n, COALESCE(AVG(length("businessName") + length(COALESCE(city, '')) + length(COALESCE(province, ''))), 0)::float AS chars FROM "Prospect" WHERE ${aiSelectionSql({ now })}`;
  return costFromCounts({ rows: Number(n), avgChars: Number(chars), model });
}

/** The arithmetic, pure, so the check can drive it. */
export function costFromCounts({ rows, avgChars, model = AI_MODEL }) {
  const batches = Math.ceil(rows / AI_BATCH);
  const promptTokens = Math.round(rows * (avgChars / CHARS_PER_TOKEN + PROMPT_FIXED_TOKENS_PER_ROW) + batches * PROMPT_OVERHEAD_TOKENS);
  const completionTokens = Math.round(rows * COMPLETION_TOKENS_PER_ROW + batches * REASONING_TOKENS_PER_BATCH);
  const priced = hasKnownPricing(model);
  return {
    rows,
    batches,
    model,
    priced,
    avgChars: Math.round(avgChars * 10) / 10,
    promptTokens,
    completionTokens,
    costMicros: priced ? estimateCostMicros({ model, promptTokens, completionTokens }) : null,
  };
}

/** Write one batch's answers. Only the `suggested*` columns; the check greps. */
export async function writeAiSuggestionPage(db, rows, kept, { now = new Date(), version = SUGGEST_VERSION } = {}) {
  if (!kept.length) return 0;
  const ids = kept.map((k) => rows[k.i].id);
  const keys = kept.map((k) => k.tradeKey || "");
  const notc = kept.map((k) => k.verdict === "not_contractor");
  const confs = kept.map((k) => String(k.confidence));
  const notes = kept.map((k) => `ai: ${k.verdict === "unknown" ? "unknown" : k.verdict === "not_contractor" ? "not a contractor" : discoveryTradeLabel(k.tradeKey)}${k.why ? ` — ${k.why}` : ""}`);
  return db.$executeRaw`
    UPDATE "Prospect" p SET
      "suggestedTradeKey" = NULLIF(v.key, ''),
      "suggestedTradeKeys" = string_to_array(v.key, ','),
      "suggestedTradeBasis" = 'ai',
      "suggestedTradeConfidence" = v.conf::numeric,
      "suggestedNotContractor" = v.notc,
      "suggestedTradeNote" = v.note,
      "suggestedAt" = ${now},
      "suggestedVersion" = ${version}
    FROM unnest(${ids}::text[], ${keys}::text[], ${confs}::text[], ${notc}::boolean[], ${notes}::text[])
      AS v(id, key, conf, notc, note)
    WHERE p.id = v.id`;
}

/**
 * Run it, batch by batch, until the limit, the deadline, the budget or the
 * rows run out.
 *
 * Deliberately NOT called from any cron. It costs money per row, and the
 * owner's yes is per run: the route behind the button requires a typed
 * confirmation and the script requires --apply.
 *
 * @param {{ db:object, limit?:number, deadlineMs?:number, now?:Date, askModel?:Function, checkBudget?:Function, recordUsage?:Function }} args
 * @returns {Promise<{ considered:number, written:number, unknown:number, notContractor:number, byTrade:object,
 *                     dropped:number, batches:number, promptTokens:number, completionTokens:number, costMicros:number,
 *                     model:string|null, stopped:string|null, remaining:number, seconds:number }>}
 */
export async function suggestTradesAi({
  db,
  limit = Infinity,
  deadlineMs = Infinity,
  // Money left under the approval (suggestTradesAiApproval.js): the loop
  // stops BEFORE a batch once what this run has cost reaches it, so an
  // unattended slice overshoots the cap by at most one batch. Infinity for
  // a run nobody capped (the laptop script with --apply).
  budgetMicros = Infinity,
  now = new Date(),
  askModel = complete,
  checkBudget = checkPlatformAiBudget,
  recordUsage = recordPlatformAiUsage,
} = {}) {
  if (!db) throw new Error("suggestTradesAi: db is required");
  const started = Date.now();
  const selection = aiSelectionSql({ now });
  let cursor = null;
  let considered = 0;
  let written = 0;
  let unknown = 0;
  let notContractor = 0;
  let dropped = 0;
  let batches = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  let costMicros = 0;
  let model = null;
  let stopped = null;
  const byTrade = {};

  while (considered < limit && Date.now() - started < deadlineMs) {
    const take = Math.min(AI_BATCH, limit - considered);
    const rows = await db.$queryRaw`SELECT id, "businessName", city, province FROM "Prospect" WHERE ${selection}${cursor ? Prisma.sql` AND id > ${cursor}` : Prisma.empty} ORDER BY id ASC LIMIT ${take}`;
    if (!rows.length) break;
    cursor = rows[rows.length - 1].id;

    if (costMicros >= budgetMicros) {
      stopped = "job_budget";
      break;
    }
    const budget = await checkBudget(db, { now });
    if (!budget.allowed) {
      stopped = budget.reason || "budget";
      break;
    }

    const result = await askModel({
      system: TRADE_SUGGESTION_SYSTEM,
      prompt: tradeSuggestionPrompt(rows),
      maxTokens: 8000,
      schema: tradeSuggestionSchema(),
      schemaName: TRADE_SUGGESTION_AI_AREA,
      onUsage: async (usage) => {
        model = usage.model;
        promptTokens += usage.promptTokens || 0;
        completionTokens += usage.completionTokens || 0;
        costMicros += estimateCostMicros({ model: usage.model, promptTokens: usage.promptTokens || 0, completionTokens: usage.completionTokens || 0 });
        await recordUsage(db, {
          area: TRADE_SUGGESTION_AI_AREA,
          model: usage.model,
          promptTokens: usage.promptTokens || 0,
          completionTokens: usage.completionTokens || 0,
          meta: { rows: rows.length, promptVersion: AI_PROMPT_VERSION },
        });
      },
    });
    batches += 1;
    considered += rows.length;
    if (!result?.ok) {
      // A vendor error, a refusal, a truncation: stop rather than spend the
      // next batch on the same failure. The rows stay selectable.
      stopped = `${result?.reason || "unknown"}${result?.message ? `: ${String(result.message).slice(0, 160)}` : ""}`;
      break;
    }
    const parsed = parseAiSuggestions(result.data, rows.length);
    dropped += parsed.dropped.length;
    for (const k of parsed.kept) {
      if (k.verdict === "unknown") unknown += 1;
      else if (k.verdict === "not_contractor") notContractor += 1;
      else byTrade[k.tradeKey] = (byTrade[k.tradeKey] || 0) + 1;
    }
    written += await writeAiSuggestionPage(db, rows, parsed.kept, { now });
    if (rows.length < take) break;
  }

  const [{ n: remaining }] = await db.$queryRaw`SELECT COUNT(*)::int AS n FROM "Prospect" WHERE ${selection}`;
  return {
    considered,
    written,
    unknown,
    notContractor,
    byTrade,
    dropped,
    batches,
    promptTokens,
    completionTokens,
    costMicros,
    model,
    stopped,
    remaining: Number(remaining),
    seconds: Math.round((Date.now() - started) / 100) / 10,
  };
}
