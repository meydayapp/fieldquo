// lib/sales/pipeline/handlers/inferFromSite.js
//
// INFER_FROM_SITE — what a business's own pages say about it, read once
// per crawl for a claimed prospect, each inference pinned to its sentence.
//
// ══ Where it sits ═════════════════════════════════════════════════════════
//
// On the claimed lane only, between the lead score and the brief
// (lib/sales/pipeline/chain.js CLAIMED_TAIL), so the brief's known facts
// and the call script's WHAT WE INFERRED both carry what this stage wrote.
// The backlog never reaches it: a model call per prospect is worth it for a
// business a rep is about to phone, not for a row.
//
// ══ Once per crawl ════════════════════════════════════════════════════════
//
// The page excerpts, the business name, trade and town are hashed
// (lib/sales/intel/siteInference.js) and the hash is kept on
// ProspectInferenceRun. A run whose hash and version match is left alone
// and nothing is spent. A new crawl changes the text, the text changes the
// hash, the next claim reads again.
//
// ══ What is written, and what is never deleted ════════════════════════════
//
// For each kept entry, in one transaction: a `page_content` evidence row
// holding the quoted sentence — found by (prospect, detector, sentence)
// first, so the same sentence quoted by two runs is one row — and an upsert
// of the ProspectInference row for that kind citing it. The queue's
// confidence engine scores a `page_content` signal at its own weight
// (lib/sales/intel/confidence.js), which is what lets the row render in
// "What we infer" with a figure beside it and no change to the screen.
//
// An inference from an earlier run whose kind the new pages no longer
// support is left where it is. The rule this session was given is no data
// deletion, and an upsert that only overwrites what it can re-derive keeps
// to it; the run row's counts say what this run actually found.
//
// ══ Spend ═════════════════════════════════════════════════════════════════
//
// Metered exactly as the script is: checkPlatformAiBudget before the call,
// recordPlatformAiUsage from the vendor's counts after, area
// "site_inference". A vendor outage is retried on the ladder; anything else
// — unconfigured, refused, a schema it would not fill — is terminal, with
// the reason in the row, and the next claim asks again.
import { db } from "@/lib/db";
import { registerHandler } from "@/lib/sales/pipeline/registry";
import { withChain } from "@/lib/sales/pipeline/chain";
import { taskPriority } from "@/lib/sales/pipeline/priority";
import { AI_FAILURE, complete } from "@/lib/ai/provider";
import { checkPlatformAiBudget, recordPlatformAiUsage } from "@/lib/ai/platformUsage";
import { selectPageExcerpts } from "@/lib/sales/intel/pageExcerpts";
import {
  SITE_INFERENCE_AI_AREA,
  SITE_INFERENCE_DETECTOR,
  SITE_INFERENCE_MAX_TOKENS,
  SITE_INFERENCE_SYSTEM,
  SITE_INFERENCE_VERSION,
  siteInferenceCurrent,
  siteInferenceInputHash,
  siteInferenceInputs,
  siteInferencePrompt,
  siteInferenceSchema,
  siteInferenceSources,
  validateSiteInferences,
} from "@/lib/sales/intel/siteInference";

/**
 * The prospect and its pages. Two queries, exposed so a check can hand the
 * handler fixture rows through `deps.loadInputs`.
 */
export async function loadSiteInferenceInputs(prisma, prospectId) {
  const [prospect, pageRows] = await Promise.all([
    prisma.prospect.findUnique({
      where: { id: prospectId },
      select: {
        id: true,
        businessName: true,
        tradeKey: true,
        city: true,
        province: true,
        campaignId: true,
        assignedRepId: true,
        lastCrawledAt: true,
      },
    }),
    prisma.prospectEvidence.findMany({
      where: { prospectId, type: "page_content" },
      select: { type: true, sourceUrl: true, normalizedValue: true, rawValue: true },
    }),
  ]);
  if (!prospect) return { prospect: null };
  return { prospect, pages: selectPageExcerpts(pageRows), crawledAt: prospect.lastCrawledAt ?? null };
}

/**
 * Write what survived: one evidence row per quoted sentence, one inference
 * row per kind, the run row — all in one transaction, so an inference can
 * never cite a sentence that was not written.
 *
 * @returns { evidenceCreated, evidenceReused }
 */
export async function writeSiteInferences(prisma, { prospectId, kept, run, now }) {
  let evidenceCreated = 0;
  const reused = new Set();
  await prisma.$transaction(async (tx) => {
    for (const entry of kept) {
      // The same sentence, quoted again by a later run, is one row: found by
      // the detector and the exact text. rawValue carries a hash index
      // (schema), so this is an equality lookup and not a scan.
      const existing = await tx.prospectEvidence.findFirst({
        where: { prospectId, type: "page_content", detector: SITE_INFERENCE_DETECTOR, rawValue: entry.quote },
        select: { id: true },
      });
      let evidenceId = existing?.id || null;
      if (evidenceId) {
        reused.add(evidenceId);
      } else {
        const created = await tx.prospectEvidence.create({
          data: {
            prospectId,
            type: "page_content",
            source: "website",
            sourceUrl: entry.sourceUrl ? String(entry.sourceUrl).slice(0, 1000) : null,
            rawValue: entry.quote,
            normalizedValue: `${SITE_INFERENCE_DETECTOR}:${entry.kind}`,
            confidence: entry.confidence,
            detector: SITE_INFERENCE_DETECTOR,
            detectorVersion: SITE_INFERENCE_VERSION,
            observedAt: now,
          },
          select: { id: true },
        });
        evidenceId = created.id;
        evidenceCreated += 1;
      }

      const data = {
        value: entry.value,
        confidence: entry.confidence,
        evidenceIds: [evidenceId],
        source: "derived",
        observedAt: now,
        modelVersion: `${SITE_INFERENCE_DETECTOR}/${SITE_INFERENCE_VERSION}`,
      };
      await tx.prospectInference.upsert({
        where: { prospectId_kind: { prospectId, kind: entry.kind } },
        update: data,
        create: { prospectId, kind: entry.kind, ...data },
      });
    }

    await tx.prospectInferenceRun.upsert({
      where: { prospectId },
      create: { prospectId, ...run },
      update: run,
    });
  });
  return { evidenceCreated, evidenceReused: reused.size };
}

/**
 * @param payload { prospectId?, priority }
 */
export async function handleInferFromSite({
  task,
  payload = {},
  idempotencyKey = null,
  db: prisma,
  now = new Date(),
  deps = {},
} = {}) {
  const prospectId = payload.prospectId || task?.prospectId || null;
  if (!prospectId) {
    return { done: false, retry: false, reason: "site_inference: no prospectId on the task or its payload" };
  }

  // The gate that costs money if it is wrong — the third copy of the lane
  // rule, kept for the same reason the script keeps its own.
  if (taskPriority({ payload }) !== "claimed" && taskPriority(task) !== "claimed") {
    return { done: false, retry: false, reason: "site_inference: only the claimed lane reads a site for inferences — the backlog is not charged for it" };
  }

  const load = deps.loadInputs || loadSiteInferenceInputs;
  const rows = await load(prisma, prospectId);
  if (!rows?.prospect) {
    return { done: false, retry: false, reason: "site_inference: prospect not found" };
  }

  const inputs = siteInferenceInputs(rows);
  const inputHash = siteInferenceInputHash(inputs);
  const existing = await prisma.prospectInferenceRun.findUnique({
    where: { prospectId },
    select: { inputHash: true, promptVersion: true, generatedAt: true, kept: true },
  });
  if (siteInferenceCurrent(existing, { inputHash })) {
    return {
      done: true,
      note: `unchanged — run from ${existing.generatedAt?.toISOString?.() || "before"} (${existing.kept} inference(s)) still stands for these pages; nothing spent`,
    };
  }

  const runBase = {
    promptVersion: SITE_INFERENCE_VERSION,
    inputHash,
    pages: inputs.pages.length,
    crawledAt: rows.crawledAt ?? null,
    generatedAt: now,
  };

  // Nothing crawled: record the run so the next claim does not ask again
  // for the same nothing, and say so. No model is called for an empty page.
  if (!inputs.pages.length) {
    await writeSiteInferences(prisma, { prospectId, kept: [], run: { ...runBase, model: null, kept: 0, dropped: 0 }, now });
    return { done: true, note: "no page text was crawled for this prospect — nothing to infer from, nothing spent; the run is recorded so the next claim skips it until a crawl lands" };
  }

  const checkBudget = deps.checkBudget || checkPlatformAiBudget;
  const budget = await checkBudget(prisma, { campaignId: rows.prospect.campaignId ?? null, now });
  if (!budget.allowed) {
    return { done: false, retry: false, reason: `site_inference: not read — ${budget.reason}` };
  }

  const askModel = deps.complete || complete;
  const recordUsage = deps.recordUsage || recordPlatformAiUsage;
  let usedModel = null;

  const result = await askModel({
    system: SITE_INFERENCE_SYSTEM,
    prompt: siteInferencePrompt(inputs),
    maxTokens: SITE_INFERENCE_MAX_TOKENS,
    schema: siteInferenceSchema(),
    schemaName: SITE_INFERENCE_AI_AREA,
    // Metered on what the vendor generated, whatever became of it.
    onUsage: async ({ model, promptTokens, completionTokens }) => {
      usedModel = model;
      await recordUsage(prisma, {
        area: SITE_INFERENCE_AI_AREA,
        model,
        promptTokens,
        completionTokens,
        prospectId,
        campaignId: rows.prospect.campaignId ?? null,
        salesRepId: rows.prospect.assignedRepId ?? null,
        ref: idempotencyKey || task?.idempotencyKey || null,
      });
    },
  });

  if (!result?.ok) {
    const retry = result?.reason === AI_FAILURE.VENDOR_ERROR;
    return { done: false, retry, reason: `site_inference: ${result?.reason || "unknown"}${result?.message ? ` — ${String(result.message).slice(0, 200)}` : ""}` };
  }

  const { kept, dropped } = validateSiteInferences(result.data, siteInferenceSources(inputs));

  const written = await writeSiteInferences(prisma, {
    prospectId,
    kept,
    run: { ...runBase, model: usedModel || "unknown", kept: kept.length, dropped: dropped.length },
    now,
  });

  const droppedNote = dropped.length
    ? `dropped ${dropped.length}: ${dropped.map((d) => `${d.kind} (${d.reason})`).join(", ")}`
    : null;
  return {
    done: true,
    note: [
      existing ? "re-read" : "read",
      usedModel || "model unknown",
      `${inputs.pages.length} page(s)`,
      kept.length
        ? `kept ${kept.length}: ${kept.map((k) => k.kind).join(", ")}`
        : "kept none — the pages state nothing on the list, which is a correct answer",
      droppedNote,
      written.evidenceCreated ? `${written.evidenceCreated} sentence(s) recorded as evidence` : null,
      written.evidenceReused ? `${written.evidenceReused} sentence(s) already on file` : null,
      budget.capped ? null : "no platform AI budget configured — spend recorded, not capped",
    ]
      .filter(Boolean)
      .join("; "),
  };
}

registerHandler(
  "INFER_FROM_SITE",
  withChain("INFER_FROM_SITE", async ({ task, payload, idempotencyKey, now, db: prisma }) =>
    handleInferFromSite({ task, payload, idempotencyKey, now, db: prisma || db }),
  ),
);
