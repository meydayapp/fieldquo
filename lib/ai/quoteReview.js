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
import { resolveServiceContent } from "@/lib/documents/serviceContent";
import { complete, isAiConfigured } from "./provider";
import { getSuggestedAddOns, typicalPriceByCategory } from "./quoteSuggestions";
import { completenessChecks, effectiveProcessNotes } from "@/lib/quotes/completeness";
import {
  MIN_SAMPLE,
  priceFinding,
  marginFinding,
  actualsFinding,
  calibrationOffers,
} from "@/lib/quotes/reviewFindings";
import { loadQuoteCosting, companyMarginTarget } from "@/lib/costing/quoteCostEstimate";
import { calibrationInputs } from "@/lib/costing/calibrationInputs";
import { buildEstimateAccuracy } from "@/lib/analytics/estimateAccuracy";
import { loadEstimateAccuracyJobs } from "@/lib/analytics/estimateAccuracyJobs";

const num = (v) => Number(v ?? 0);

/**
 * The writing pass's output shape, enforced at the vendor with `strict: true`.
 *
 * ── No money, no counts, no numbers of any kind ───────────────────────────
 *
 * This file's whole job is a price comparison, and every figure in it —
 * median, sample size, the verdict — is computed from this company's own
 * Quote rows in code, further down. NOTHING numeric appears in this schema,
 * and nothing should: the model is shown prices so it can write about clarity,
 * not so it can do arithmetic about them. A "suggestedPrice" field here would
 * be one line of JSON and would put a model's guess on a document a homeowner
 * signs. `photosAttached` on the review is counted in code, never asked for.
 *
 * `processNotes` is nullable rather than optional because strict mode has no
 * optional fields — every declared property must be in `required`, and
 * absence is spelled `["string", "null"]`. That is a better fit than the old
 * prompt anyway: "or null" was already in the instructions, and now it is
 * enforced instead of hoped for.
 */
const WRITING_SCHEMA = {
  type: "object",
  properties: {
    rewrites: {
      type: "array",
      description: "Only for lines a homeowner genuinely would not understand. Empty is common.",
      items: {
        type: "object",
        properties: {
          from: { type: "string", description: "The exact original text." },
          to: { type: "string", description: "The plain-language rewrite." },
        },
        required: ["from", "to"],
        additionalProperties: false,
      },
    },
    addOnReasons: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string", description: "The exact add-on name you were given." },
          detail: { type: "string", description: "One short sentence on the benefit to the client." },
        },
        required: ["description", "detail"],
        additionalProperties: false,
      },
    },
    processNotes: {
      type: ["string", "null"],
      description: "A short what-happens-next section, or null when one was not asked for.",
    },
  },
  required: ["rewrites", "addOnReasons", "processNotes"],
  additionalProperties: false,
};

// `median` and `MIN_SAMPLE` moved to lib/quotes/reviewFindings.js with the
// price comparison itself, so the check script can drive the arithmetic
// without a database. Imported back here for the add-on price yardstick.

/**
 * Everything the review needs, in one round trip.
 *
 * Exported so lib/ai/visionPass.js's PAID deep read loads the exact same
 * quote shape the free review does, rather than a second Prisma query that
 * can quietly drift from this one — the two passes have to agree about what
 * "the quote" contains, because the deep read's whole job is not repeating
 * what the free pass already covered.
 */
export async function loadQuote(quoteId, companyId) {
  return db.quote.findFirst({
    where: { id: quoteId, companyId },
    include: {
      client: { select: { name: true, email: true, phone: true } },
      // The billing currency, for the money in the findings' sentences —
      // never assumed CAD (lib/quotes/reviewFindings.js renderEnglish).
      // defaultProcessNotes beside the currency: the document prints it when
      // the quote's own box is empty (app/api/quotes/[id]/document), so both
      // the completeness finding and the model's offer to WRITE one have to
      // judge the effective text. Reading the column alone told every company
      // that had written its wording once, in Settings, that it had said
      // nothing about what happens next.
      company: { select: { currency: true, defaultProcessNotes: true } },
      // The frozen cost groups, for the calibration offers: which saved rate
      // could absorb a measured overrun is decided from the same frozen
      // basis the close-out reads (lib/costing/calibrationInputs.js).
      costing: { select: { groups: true, labourHours: true } },
      scopeGroups: {
        orderBy: { sortOrder: "asc" },
        include: {
          category: {
            select: {
              id: true,
              label: true,
              // `key` is what resolveServiceContent looks the trade up by, and
              // the company's own wording overrides hang off the join below.
              // Without both, the writing pass could not see the scope
              // paragraph and the "what's included" list that are ALREADY
              // printed on the document it is reviewing.
              key: true,
              companySettings: {
                where: { companyId },
                select: {
                  scopeDescription: true,
                  includedItems: true,
                },
              },
            },
          },
        },
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
  //
  // The groups come with the row, takeoff and intake included: the
  // comparison is PER UNIT of measured work when both sides carry one
  // (lib/quotes/primaryMeasure.js), and only on the total when they don't.
  // The owner, on the total-vs-total version: "if they have a bigger project
  // it is normal to have a bigger price". A rate per square foot is the
  // answer to that; the total is kept as the fallback, and the sentence says
  // which one it used.
  const history = await db.quote.findMany({
    where: {
      companyId,
      id: { not: quote.id },
      status: { in: ["accepted", "declined"] },
      ...(categoryIds.length
        ? { scopeGroups: { some: { categoryId: { in: categoryIds } } } }
        : {}),
    },
    select: {
      status: true,
      total: true,
      scopeGroups: {
        select: {
          categoryId: true,
          takeoff: true,
          intakeValues: true,
          subtotal: true,
          category: { select: { key: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 300,
  });

  const shapeGroup = (g) => ({
    categoryKey: g.category?.key || null,
    categoryLabel: g.category?.label || g.label || null,
    takeoff: g.takeoff ?? null,
    intakeValues: g.intakeValues ?? null,
    subtotal: num(g.subtotal),
  });

  return priceFinding({
    quote: { total: num(quote.total), scopeGroups: quote.scopeGroups.map(shapeGroup) },
    history: history.map((h) => ({
      status: h.status,
      total: num(h.total),
      scopeGroups: h.scopeGroups.map(shapeGroup),
    })),
    currency: quote.company?.currency || null,
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Cost and margin — INTERNAL, off the same object the Cost & margin block shows
// ───────────────────────────────────────────────────────────────────────────

/**
 * The margin against the company's target, and what history says it will
 * really be. Both are stripped for a reader without job costing by the
 * route (lib/quotes/reviewRedaction.js); nothing here decides who sees it.
 *
 * Off loadQuoteCosting — the identical read GET /api/quotes/[id]/costing
 * serves — so the review and the block can never disagree about a number.
 * A second computation here was the obvious way to write this and the
 * wrong one: it would have been the copy that drifts.
 */
async function costChecks(quote, companyId) {
  const [costing, target] = await Promise.all([
    loadQuoteCosting({ companyId, quoteId: quote.id }),
    companyMarginTarget(companyId),
  ]);
  const currency = quote.company?.currency || null;
  const scopeGroups = quote.scopeGroups.map((g) => ({
    categoryKey: g.category?.key || null,
    label: g.label || null,
    subtotal: num(g.subtotal),
  }));

  const margin = marginFinding({ costing, target, scopeGroups, currency });

  // The main trade: the biggest group by price. History is read per trade
  // (the roll-up attributes a closed job to a trade only when its quote had
  // exactly one — lib/analytics/estimateAccuracy.js), and a two-trade quote
  // is measured on the trade that is most of it, named in the sentence.
  const main = [...quote.scopeGroups].sort((a, b) => num(b.subtotal) - num(a.subtotal))[0] || null;
  const categoryKey = main?.category?.key || null;
  const categoryLabel = main?.category?.label || main?.label || null;

  let accuracy = null;
  if (main?.categoryId) {
    // The company's most recent closed jobs in this trade. No date range —
    // "your last 8 painting jobs" is a count, not a quarter — and the roll-up
    // wants one, so it is the span those jobs cover.
    const jobs = await loadEstimateAccuracyJobs({
      companyId,
      where: {
        completedAt: { not: null },
        quote: { scopeGroups: { some: { categoryId: main.categoryId } } },
      },
      orderBy: { completedAt: "desc" },
      take: 60,
    });
    if (jobs.length) {
      const day = (d) => new Date(d).toISOString().slice(0, 10);
      const dates = jobs.map((j) => day(j.completedAt)).sort();
      try {
        accuracy = buildEstimateAccuracy({
          from: dates[0],
          to: day(new Date()),
          currency: currency || "CAD",
          jobs,
        });
      } catch {
        // A range the builder refuses (it cannot happen for real dates) is
        // "no history", not a broken review.
        accuracy = null;
      }
    }
  }

  const actuals = actualsFinding({ costing, accuracy, categoryKey, categoryLabel, currency });

  // "Update my costing": the close-out's own calibration, fed the measured
  // overrun. Only when history said something and the quote was costed —
  // an offer to move a rate needs both a direction and a denominator.
  let offers = [];
  const labourPct = actuals.labour?.pct ?? null;
  const materialsPct = actuals.materials?.pct ?? null;
  if ((labourPct != null || materialsPct != null) && quote.costing) {
    try {
      const inputs = await calibrationInputs({
        companyId,
        scopeGroups: quote.scopeGroups,
        frozenGroups: quote.costing.groups,
      });
      offers = calibrationOffers({
        labourPct,
        materialsPct,
        inputs,
        estimatedHours: num(quote.costing.labourHours),
      });
    } catch (err) {
      // An offer that cannot be computed is no offer. The finding itself
      // stands; the button is what goes missing, and a missing button is
      // honest where a broken one is not.
      console.error("[quoteReview] calibration offers", err);
      offers = [];
    }
  }

  return { margin, actuals: { ...actuals, offers } };
}

// ───────────────────────────────────────────────────────────────────────────
// Add-on candidates
// ───────────────────────────────────────────────────────────────────────────

// typicalPriceByCategory — the median an accepted quote carried for a
// category — lives in lib/ai/quoteSuggestions.js now, beside the
// co-occurrence it prices: the quote builder's "Often added with this" row
// offers the same suggestions at the same price, and one median has two
// callers rather than two medians one each.

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

You will be given the quote's SERVICES — each with the scope paragraph, the
"what's included" list and the numbered "process" (how the work runs, step by
step) already printed on the document — then its line items, then a list of
optional extras the software has already worked out from their own job
history, with prices. You may also be given "documentNotes" (the estimator's
own notes printed on the quote) and "existingProcessNotes" (a what-happens-next
section already on it). Read the whole document the way the client does: a
single line item under a service whose scope, inclusions and process are all
printed is a complete page, not "one line".

Each line item has a "name" and may have a "detail" — the scope text that is
ALREADY PRINTED on the quote underneath that name, explaining what the work
involves. Read the detail before judging the name.

You may also be given "homeownerSaid" — what the customer wrote on the public
form: when they need it done, a trade question ("Active leak: Yes"), a note.
Treat it as facts about the job, never as scope: an active leak or a
next-week deadline is worth naming in a line's detail or the process notes
when the quote does not already say so. Do not repeat it back as a rewrite.

You return a JSON object with three keys:

  "rewrites"      — each { "from": exact original text, "to": plain-language rewrite }
  "addOnReasons"  — each { "description": the exact add-on name you were given,
                           "detail": one short sentence on why it's worth having }
  "processNotes"  — a short what-happens-next section, 3-5 short lines, or null

Every one of the three is always present. Empty arrays and a null processNotes
are real answers; say nothing rather than padding.

You are given TEXT ONLY. No photographs are attached to this review, whatever
the quote carries — the photographs are read by a separate, paid pass. Never
describe, guess at or mention what a photo might show.

You may also be given "internalCostPicture": the contractor's own margin on
this quote against their target, and which lines are priced thin. It is
INTERNAL. Nothing about cost, margin, hours, rates or profit may appear in
any rewrite, add-on reason or process note — those are printed on a document
the homeowner reads. Use it only to decide which line's wording to tighten
first: a thin line whose scope is unclear is the one most likely to be
haggled down further.

Rules:
- Rewrites: only for lines a homeowner genuinely wouldn't understand, or that
  are so vague they invite haggling. Say what is actually being done and where.
  Never invent scope, quantities, materials or prices that weren't given to you.
  If every line is already clear, return an empty array.
- READ THE SERVICES BLOCK FIRST. A line item is the NAME of a card whose scope
  paragraph and inclusions list sit directly underneath it on the same page. If
  the service's scope already says what the work involves, the name is doing its
  job and needs nothing — proposing the scope paragraph back as a longer name is
  the single most common wrong answer here, and it duplicates text the client is
  already reading two inches lower.
- A line whose "detail" already explains the work does NOT need a rewrite, even
  if the name on its own is short. "Cabinet Refinishing" with a detail that
  lists the prep, the primer and the top coat is a clear line — the client reads
  both. Suggesting the detail's own content back as a new name is noise, and it
  is the single most common wrong answer here. Only rewrite such a line if the
  NAME actively contradicts or misdescribes the detail.
- Never propose a rewrite whose "to" is just the "detail" restated. If the
  useful information is already on the document, there is nothing to fix.
- addOnReasons: one sentence each, about the benefit to the client, not the
  feature. No exclamation marks, no "Don't miss out". These sit on a document
  a stranger is deciding whether to trust.
- processNotes: only if asked for. Cover timing, access, payment schedule and
  warranty in plain words. Use placeholders in square brackets like [2-3 days]
  where you'd be guessing — the contractor fills those in. Never state a real
  timeline or warranty term as if you knew it.
- Plain trade English. Short sentences. No corporate padding.`;

/**
 * The quote's SERVICES, shaped for a model: each with the scope paragraph and
 * "what's included" list already printed on the document underneath it.
 *
 * ── The document, not a list of names ────────────────────────────────────
 *
 * The owner reported the review recommending, every single time:
 *
 *   Cabinet Refinishing → "Refinish the existing cabinet surfaces (doors,
 *   drawer fronts and visible frames) in place: we will clean and prepare
 *   the surfaces and apply the new finish/color agreed with you."
 *
 * That paragraph is a WORSE version of one already on the quote. The document
 * has carried a per-trade scope description and a "what's included" list from
 * lib/documents/serviceContent.js since it was written; the model had never
 * been shown either, so the only thing it could find to improve was the
 * six-word name at the top of them.
 *
 * Sent per service rather than as one flat list, because that is how the
 * client reads it: a card per trade, with its scope, its inclusions and its
 * lines together. A model asked to judge wording — or, in
 * lib/ai/visionPass.js's case, a PHOTO — off a list of names is being asked a
 * different question from the one that matters.
 *
 * Exported so the paid deep read is grounded against the SAME paragraph the
 * free pass is: a photo note that just repeats what a service's own scope
 * already says is exactly the noise both prompts are told to avoid, and that
 * only holds if both are shown the same text rather than two copies of it.
 */
export function quoteServicesContext(quote) {
  return (quote.scopeGroups || []).map((g) => {
    const override = g.category?.companySettings?.[0] || null;
    const content = resolveServiceContent(g.category?.key, override, g.takeoff);
    return {
      name: g.label,
      scope: content.description || null,
      included: content.included || [],
      // How the work runs — the numbered "process" the card prints under the
      // inclusions. The model was never shown it, so it judged a one-line
      // quote as "one line" when the client reads a page: the owner's
      // 2026-09-19 note ("it was not reading the process and all the
      // information the client gets"). Titles and bodies, in print order.
      process: (content.steps || []).map((st) => [st.title, st.body].filter(Boolean).join(" — ")),
    };
  });
}

/**
 * The client's photographs off a loaded quote — never videos or documents, a
 * PDF handed to a vision model being a wasted image slot and a confusing
 * answer.
 *
 * The free review only COUNTS these (photosAttached); lib/ai/visionPass.js's
 * paid deep read is what sends them. One definition of "what counts as a
 * photo" for both, so the count the panel shows is the set the deep read
 * would actually read.
 */
export function photosFromQuote(quote) {
  return (Array.isArray(quote?.clientPhotos) ? quote.clientPhotos : [])
    .filter((m) => m && (m.kind === "photo" || !m.kind) && typeof m.url === "string")
    .map((m) => m.url);
}

/**
 * The cost picture as FACTS for the writing pass — never as text it may
 * repeat. Whole percents and line names only; no money. The output schema
 * (WRITING_SCHEMA) has no field a figure could travel in, and the system
 * prompt says so in as many words; scripts/check-quote-price-check.mjs pins
 * both. Absent when the quote was not costed: "nothing known" is not "0%".
 */
export function internalCostPicture(margin, actuals) {
  if (!margin || margin.verdict === "not_costed") return null;
  return {
    marginPct: Math.round(num(margin.marginPct)),
    targetPct: Math.round(num(margin.targetPct)),
    belowTarget: margin.verdict === "below",
    thinLines: (margin.thinLines || []).map((l) => l.label).filter(Boolean),
    ...(actuals?.adjustedMarginPct != null
      ? { marginAfterHistoryPct: Math.round(num(actuals.adjustedMarginPct)) }
      : {}),
  };
}

async function writingPass({
  quote,
  items,
  addOns,
  needProcessNotes,
  costPicture,
  onUsage,
}) {
  if (!isAiConfigured()) return {};

  const payload = {
    // Internal facts, for prioritising — see internalCostPicture. Placed
    // first so the instruction about them in WRITING_SYSTEM is read with
    // them in view.
    ...(costPicture ? { internalCostPicture: costPicture } : {}),
    services: quoteServicesContext(quote),
    // The quote's own client-facing prose, when the estimator wrote any: the
    // notes printed on the document and the what-happens-next section that
    // already exists. Shown so the model reads the document whole and never
    // proposes what the quote already says.
    ...(quote.notes?.trim() ? { documentNotes: quote.notes.trim() } : {}),
    // The EFFECTIVE text — the company's default counts as an existing
    // section, because that is what the client will read.
    ...(effectiveProcessNotes(quote) ? { existingProcessNotes: effectiveProcessNotes(quote) } : {}),
    // Name AND the scope text printed under it. Sending the name alone is why
    // this pass recommended "clearer wording" on every quote forever: the model
    // was shown "Cabinet Refinishing" with no way to know the document already
    // explained the prep, the primer and the top coat underneath it, so it
    // proposed exactly that explanation back as a new name. It was answering
    // the only question it had been asked.
    lineItems: items
      .filter((li) => li?.description)
      .map((li) => ({
        name: li.description,
        ...(li.detail ? { detail: li.detail } : {}),
      })),
    // The detail is what a standard add-on now carries from its catalogue
    // description (lib/quotes/lineDetail.js); a line that still has none is
    // named by completenessChecks' `no_detail` finding, deterministically,
    // so "the review thinks it's empty" is a statement about the quote and
    // never a guess about the model. scripts/check-addon-descriptions.mjs
    // pins both.
    //
    // Same reasoning: an add-on whose detail is already written does not need a
    // reason invented for it.
    optionalExtras: addOns.map((a) => ({
      name: a.description,
      ...(a.detail ? { detail: a.detail } : {}),
    })),
    wantProcessNotes: needProcessNotes,
    trade: quote.quoteType || null,
    // What the homeowner said on the public form — timing, the trade's own
    // question ("Active leak: Yes"), their note — when this draft came from
    // one (lib/estimate/createEstimateQuote.js writes estimateData.homeowner).
    // Lines, not keys: the model reads prose. Absent for a hand-built quote.
    ...(Array.isArray(quote.estimateData?.homeowner?.lines) && quote.estimateData.homeowner.lines.length
      ? { homeownerSaid: quote.estimateData.homeowner.lines }
      : {}),
  };

  // ── No photographs. Text only. ────────────────────────────────────────
  //
  // Until 2026-09-15 this pass sent up to four photos at detail "low" on
  // every review and surfaced `photoNotes`. The owner's rule: the free review
  // reads what is WRITTEN on the quote; photographs are what the paid deep
  // read (lib/ai/visionPass.js, VISION_PASS_CENTS) exists to sell, and a free
  // pass that already describes the pictures undercuts the thing being paid
  // for while adding image cost to every review. The count of photos on the
  // quote still travels back (photosAttached) so the panel can point at the
  // deep read — a fact about the quote, not a read of it.
  const result = await complete({
    system: WRITING_SYSTEM,
    prompt: JSON.stringify(payload),
    onUsage,
    schema: WRITING_SCHEMA,
    schemaName: "quote_review_writing",
  });

  // A vendor outage, a refusal, a truncated reply and a shape that failed
  // validation all land here as {} — the writing half is dropped and the
  // COMPUTED half of the review (the price comparison, the completeness
  // checks, the suggested add-ons) is returned by the caller regardless,
  // because that is the useful half and it never involved a model. What is
  // new is that provider.js logs which of the five it was; this used to be
  // one console.error that only ever said "unparseable JSON", even when the
  // real answer was "the model ID was retired last month".
  if (!result.ok) return {};

  const parsed = result.data;
  return {
    rewrites: parsed.rewrites,
    addOnReasons: parsed.addOnReasons,
    // The schema makes null a first-class answer (`["string", "null"]`),
    // which is what "only if asked for" needed all along. An all-whitespace
    // string is still not an answer.
    processNotes: parsed.processNotes?.trim() ? parsed.processNotes.trim() : null,
  };
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
  const [checks, pricing, addOns, cost] = await Promise.all([
    Promise.resolve(completenessChecks(quote, items)),
    pricingCheck(quote, companyId),
    addOnCandidates(quote, companyId),
    costChecks(quote, companyId),
  ]);

  const writing = await writingPass({
    quote,
    items,
    addOns,
    needProcessNotes: !effectiveProcessNotes(quote),
    costPicture: internalCostPicture(cost.margin, cost.actuals),
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
    // The company's billing currency, so the panel formats the findings'
    // money params in the reader's locale and the RIGHT currency.
    currency: quote.company?.currency || null,
    checks,
    pricing,
    // ── INTERNAL ─────────────────────────────────────────────────────────
    //
    // Cost figures. Stored with the review and stripped per reader by the
    // route (lib/quotes/reviewRedaction.js) for anyone without the
    // jobCosting toggle — the same gate as the Cost & margin block. Kept
    // OUT of `checks` and out of `readiness` on purpose: a readiness score
    // that moved with the margin would leak the margin to a reader the
    // block is hidden from.
    margin: cost.margin,
    actuals: cost.actuals,
    addOns,
    rewrites: writing.rewrites || [],
    // ── The photographs were NOT read ────────────────────────────────────
    //
    // `photoNotes` and `photosRead` used to be here: the free pass sent the
    // photos and reported what it saw. Since 2026-09-15 the free review is
    // text-only (see writingPass) and only the paid deep read looks at a
    // picture. What travels instead is how many photos the quote carries, so
    // the panel can say "3 photos attached — the deep read is what reads
    // them" rather than nothing. Reviews stored before the change still hold
    // their photoNotes and the panel still shows those; it just never gets
    // new ones.
    photosAttached: photosFromQuote(quote).length,
    // Only offered when they don't already have one — never an edit of copy
    // they've already written.
    suggestedProcessNotes: effectiveProcessNotes(quote) ? null : writing.processNotes || null,
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
