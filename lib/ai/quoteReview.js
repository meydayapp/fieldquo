// lib/ai/quoteReview.js
//
// Reviews a quote before it goes out, and proposes optional extras to offer
// at the bottom of it.
//
// ── Why most of this file has nothing to do with a model ────────────────────
//
// The valuable half of a quote review is arithmetic, not language: does this
// quote have an expiry date, is the price above what this company usually
// wins at, which service did they forget to attach. All of that is a database
// query and a comparison, and a model asked to do it would be slower, dearer,
// and occasionally wrong about a number that was sitting right there.
//
// So the split is:
//
//   computed in code   completeness checks, pricing vs this company's own
//                      accepted/declined history, add-on candidates and their
//                      typical prices.  Zero tokens. Always runs.
//
//   asked of a model   the writing. Turning "Supply & install R60 blown-in"
//                      into something a homeowner understands, drafting the
//                      what-happens-next section, and writing one persuasive
//                      line for each add-on. One call, strict JSON back.
//
// If the model call fails or AI is switched off, the review still returns
// everything computed in code. A degraded review is useful; an error page
// isn't.
//
// ── The pricing comparison is deliberately narrow ───────────────────────────
//
// It compares against THIS company's own history only, never a cross-tenant
// benchmark. Two reasons: a plumber in Sudbury and one in Vancouver share no
// meaningful price, and telling company A what company B charges is a data
// leak dressed up as a feature.

import { db } from "@/lib/db";
import { complete, isAiConfigured } from "./provider";
import { getSuggestedAddOns } from "./quoteSuggestions";
import { countMediaKinds } from "@/lib/media/validate";
import { completenessChecks } from "@/lib/quotes/completeness";

const num = (v) => Number(v ?? 0);

/** Median rather than mean — one $40k outlier shouldn't move the yardstick. */
function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Below this there isn't a pattern, there's a coincidence. Telling someone
// their price is high based on two past quotes is worse than saying nothing,
// because they might act on it.
const MIN_SAMPLE = 5;

// Line items that say nothing. A client reading "Labour — $2,400" has no way
// to tell whether that's fair, and "I'll think about it" is the usual answer.

/**
 * Everything the review needs, in one round trip.
 */
async function loadQuote(quoteId, companyId) {
  return db.quote.findFirst({
    where: { id: quoteId, companyId },
    include: {
      client: { select: { name: true, email: true, phone: true } },
      scopeGroups: {
        orderBy: { sortOrder: "asc" },
        include: { category: { select: { id: true, label: true } } },
      },
      addOns: true,
    },
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Completeness — pure rules, no model, no history needed
// ───────────────────────────────────────────────────────────────────────────

// completenessChecks and VAGUE_PATTERNS moved to lib/quotes/completeness.js.
//
// They never needed a model or a database — they are null checks and a regex —
// but living in this file, which imports Prisma and the model provider, made
// them unreachable from the browser. So the only way to learn a quote had no
// expiry date was to save it and spend a model call on the question.
//
// Imported back here rather than copied: two sets of rules that are supposed
// to agree is the copy-that-rots failure, and this one would rot silently —
// the live indicator and the AI review would simply start disagreeing about
// what is wrong with the same quote.

// ───────────────────────────────────────────────────────────────────────────
// Pricing against this company's own accepted and declined history
// ───────────────────────────────────────────────────────────────────────────

async function pricingCheck(quote, companyId) {
  const categoryIds = quote.scopeGroups
    .map((g) => g.categoryId)
    .filter(Boolean);

  // Same kind of work only. Comparing a bathroom reno against a tap washer
  // produces a confident number that means nothing.
  const history = await db.quote.findMany({
    where: {
      companyId,
      id: { not: quote.id },
      status: { in: ["accepted", "declined"] },
      ...(categoryIds.length
        ? { scopeGroups: { some: { categoryId: { in: categoryIds } } } }
        : {}),
    },
    select: { status: true, total: true, acceptedTotal: true },
    take: 300,
  });

  const accepted = history
    .filter((h) => h.status === "accepted")
    .map((h) => num(h.total))
    .filter((t) => t > 0);
  const declined = history
    .filter((h) => h.status === "declined")
    .map((h) => num(h.total))
    .filter((t) => t > 0);

  if (accepted.length < MIN_SAMPLE) {
    return {
      verdict: "insufficient_data",
      detail: `Only ${accepted.length} comparable accepted quote${accepted.length === 1 ? "" : "s"} on record — not enough to say anything useful about this price yet. This gets better as you send more.`,
      sampleSize: accepted.length,
    };
  }

  const total = num(quote.total);
  const medianAccepted = median(accepted);
  const medianDeclined =
    declined.length >= MIN_SAMPLE ? median(declined) : null;

  const sortedAccepted = [...accepted].sort((a, b) => a - b);
  const p75 = sortedAccepted[Math.floor(sortedAccepted.length * 0.75)];
  const ratio = medianAccepted > 0 ? total / medianAccepted : 1;

  let verdict = "in_range";
  let detail = `In line with what you usually win at — your median accepted quote for this kind of work is $${medianAccepted.toLocaleString("en-CA", { maximumFractionDigits: 0 })} across ${accepted.length} quotes.`;

  if (total > p75 && ratio > 1.25) {
    verdict = "high";
    detail = `${Math.round((ratio - 1) * 100)}% above your median accepted quote for this work ($${medianAccepted.toLocaleString("en-CA", { maximumFractionDigits: 0 })} across ${accepted.length}).`;
    if (medianDeclined && total > medianDeclined) {
      detail += ` It's also above your median declined quote of $${medianDeclined.toLocaleString("en-CA", { maximumFractionDigits: 0 })}.`;
    }
    detail +=
      " That can be right — a bigger job is a bigger number. Worth a second look at whether the scope explains the gap, and whether the quote says so clearly enough.";
  } else if (ratio < 0.7) {
    verdict = "low";
    detail = `${Math.round((1 - ratio) * 100)}% below your median accepted quote for this work ($${medianAccepted.toLocaleString("en-CA", { maximumFractionDigits: 0 })}). Winning it is likely; the question is whether it's worth winning at this price.`;
  }

  return {
    verdict,
    detail,
    sampleSize: accepted.length,
    medianAccepted,
    medianDeclined,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Add-on candidates
// ───────────────────────────────────────────────────────────────────────────

/**
 * What this company typically charges for a given category, so a suggested
 * add-on arrives with a real price rather than a blank box.
 *
 * Median of the scope-group subtotal on quotes that were actually accepted —
 * a price that has been said yes to before, not an average of hopeful asks.
 */
async function typicalPriceByCategory(companyId, categoryIds) {
  if (!categoryIds.length) return {};

  const groups = await db.quoteScopeGroup.findMany({
    where: {
      categoryId: { in: categoryIds },
      quote: { companyId, status: "accepted" },
    },
    select: { categoryId: true, subtotal: true },
    take: 500,
  });

  const byCategory = {};
  for (const g of groups) {
    const v = num(g.subtotal);
    if (v <= 0) continue;
    (byCategory[g.categoryId] ||= []).push(v);
  }

  return Object.fromEntries(
    Object.entries(byCategory).map(([id, values]) => [
      id,
      { amount: Math.round(median(values)), sampleSize: values.length },
    ]),
  );
}

async function addOnCandidates(quote, companyId) {
  const currentCategoryIds = quote.scopeGroups
    .map((g) => g.categoryId)
    .filter(Boolean);

  const suggestions = await getSuggestedAddOns({
    companyId,
    currentCategoryIds,
  });
  if (!suggestions.length) return [];

  const prices = await typicalPriceByCategory(
    companyId,
    suggestions.map((s) => s.categoryId),
  );

  return suggestions.map((s) => ({
    description: s.label,
    // Filled in by the model below when it's available. Left null rather than
    // faked, so the UI can show the add-on with an empty reason instead of a
    // sentence nobody wrote.
    detail: null,
    amount: prices[s.categoryId]?.amount ?? null,
    priceSampleSize: prices[s.categoryId]?.sampleSize ?? 0,
    frequency: s.frequency,
    note: s.note,
    source: "history",
  }));
}

// ───────────────────────────────────────────────────────────────────────────
// The one model call — writing only
// ───────────────────────────────────────────────────────────────────────────

const WRITING_SYSTEM = `You help a contractor tighten up a quote before they send it.

You will be given the quote's line items and a list of optional extras the
software has already worked out from their own job history, with prices.

Return STRICT JSON, no markdown fence, matching:

{
  "rewrites": [{ "from": "<exact original text>", "to": "<plain-language rewrite>" }],
  "addOnReasons": [{ "description": "<exact add-on name given to you>", "detail": "<one short sentence on why it's worth having>" }],
  "processNotes": "<short what-happens-next section, 3-5 short lines, or null>"
}

Rules:
- Rewrites: only for lines a homeowner genuinely wouldn't understand, or that
  are so vague they invite haggling. Say what is actually being done and where.
  Never invent scope, quantities, materials or prices that weren't given to you.
  If every line is already clear, return an empty array.
- addOnReasons: one sentence each, about the benefit to the client, not the
  feature. No exclamation marks, no "Don't miss out". These sit on a document
  a stranger is deciding whether to trust.
- processNotes: only if asked for. Cover timing, access, payment schedule and
  warranty in plain words. Use placeholders in square brackets like [2-3 days]
  where you'd be guessing — the contractor fills those in. Never state a real
  timeline or warranty term as if you knew it.
- Plain trade English. Short sentences. No corporate padding.`;

async function writingPass({
  quote,
  items,
  addOns,
  needProcessNotes,
  onUsage,
}) {
  if (!isAiConfigured()) return {};

  const payload = {
    lineItems: items.map((li) => li.description).filter(Boolean),
    optionalExtras: addOns.map((a) => a.description),
    wantProcessNotes: needProcessNotes,
    trade: quote.quoteType || null,
  };

  const text = await complete({
    system: WRITING_SYSTEM,
    prompt: JSON.stringify(payload),
    onUsage,
  });

  if (!text) return {};

  try {
    // Models occasionally fence JSON despite being told not to. Cheaper to
    // strip it than to spend a retry.
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    return {
      rewrites: Array.isArray(parsed.rewrites) ? parsed.rewrites : [],
      addOnReasons: Array.isArray(parsed.addOnReasons)
        ? parsed.addOnReasons
        : [],
      processNotes:
        typeof parsed.processNotes === "string" && parsed.processNotes.trim()
          ? parsed.processNotes.trim()
          : null,
    };
  } catch {
    // Unparseable JSON is a model problem, not a user problem. Drop the
    // writing half and return the computed half, which is the useful half.
    console.error("[quoteReview] model returned unparseable JSON");
    return {};
  }
}

// ───────────────────────────────────────────────────────────────────────────

/**
 * @param onUsage  passed straight through to the provider so the caller can
 *                 meter it. This module never touches AiUsage itself — same
 *                 separation as provider.js.
 * @returns the review object, or null if the quote isn't this company's.
 */
export async function reviewQuote({ companyId, quoteId, onUsage }) {
  const quote = await loadQuote(quoteId, companyId);
  if (!quote) return null;

  const items = quote.scopeGroups.flatMap((g) =>
    Array.isArray(g.lineItems) ? g.lineItems : [],
  );

  // Computed first and independently, so a model failure can't take them out.
  const [checks, pricing, addOns] = await Promise.all([
    Promise.resolve(completenessChecks(quote, items)),
    pricingCheck(quote, companyId),
    addOnCandidates(quote, companyId),
  ]);

  const writing = await writingPass({
    quote,
    items,
    addOns,
    needProcessNotes: !quote.processNotes?.trim(),
    onUsage,
  });

  // Attach the model's sentence to the add-on it belongs to, matching on the
  // name we gave it. A reason that doesn't match anything is discarded rather
  // than shown against the wrong item.
  const reasons = new Map(
    (writing.addOnReasons || []).map((r) => [
      String(r.description || "").toLowerCase(),
      r.detail,
    ]),
  );
  for (const a of addOns) {
    a.detail = reasons.get(a.description.toLowerCase()) || null;
  }

  return {
    generatedAt: new Date().toISOString(),
    quoteTotal: num(quote.total),
    checks,
    pricing,
    addOns,
    rewrites: writing.rewrites || [],
    // Only offered when they don't already have one — never an edit of copy
    // they've already written.
    suggestedProcessNotes: quote.processNotes?.trim()
      ? null
      : writing.processNotes || null,
    // A blunt readiness figure so the panel can lead with something. Not
    // presented as a probability, because it isn't one — it's a count of
    // things that are missing, weighted by how much they matter.
    readiness: readinessScore(checks),
  };
}

function readinessScore(checks) {
  const weights = { high: 22, medium: 10, low: 4 };
  const lost = checks.reduce((sum, c) => sum + (weights[c.severity] || 0), 0);
  return Math.max(0, 100 - lost);
}
