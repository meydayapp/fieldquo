// lib/sales/pipeline/handlers/analyzeCapabilities.js
//
// ANALYZE_CAPABILITIES — what this prospect's website can DO, and what it
// demonstrably cannot.
//
// ══ This stage spends nothing ══════════════════════════════════════════════
//
// It is deterministic: URLs, forms, schema.org blocks and already-detected
// technologies. No model is called. The spec's §58 draws the line at
// "deterministic software for what software can determine", and whether a page
// carries a booking link is not a question of interpretation.
//
// That has a consequence worth naming: `PROVIDER_BY_KIND` in kinds.js mapped
// this stage to `openai`, which would have charged every capability analysis
// against the tightest budget in the pipeline — the one STATUS.md's arithmetic
// identifies as the lane that makes a 1,000-prospect campaign take two days.
// It is mapped to `local` now, and the comment there says why.
//
// ══ Null is not false, and this handler is where that becomes a row ════════
//
// lib/sales/intel/capabilityDetect.js decides it; this file writes it. Two
// rules live here rather than there because they are about the TABLE rather
// than about the page:
//
//   1. A null NEVER overwrites a known value. "We could not look today" must
//      not erase "we looked last week and there was a booking page." A crawl
//      that fails after a successful one would otherwise silently downgrade
//      every finding to unknown, and the rep would stop being told anything.
//   2. A false DOES overwrite a true, and a true overwrites a false. Both are
//      real new observations of a site that changed, which is the whole reason
//      the stage re-runs.
import { registerHandler } from "@/lib/sales/pipeline/registry";
import { withChain } from "@/lib/sales/pipeline/chain";
import {
  CAPABILITY_DETECTOR,
  CAPABILITY_DETECTOR_VERSION,
  detectCapabilities,
} from "@/lib/sales/intel/capabilityDetect";
import { loadCrawl } from "./detectTechnology";

/**
 * @param payload { prospectId?, pages?, crawl? } — same shape and same
 *        fallback as DETECT_TECHNOLOGY, so the two stages cannot disagree
 *        about which pages they are looking at.
 */
export async function handleAnalyzeCapabilities({ task, payload = {}, db, now = new Date() } = {}) {
  const prospectId = payload.prospectId || task?.prospectId || null;
  if (!prospectId) {
    return { done: false, retry: false, reason: "analyze_capabilities: no prospectId on the task or its payload" };
  }

  const [prospect, technologies, crawl] = await Promise.all([
    db.prospect.findUnique({
      where: { id: prospectId },
      select: { id: true, hasWebsite: true, websiteUrl: true },
    }),
    db.prospectTechnology.findMany({
      where: { prospectId },
      select: { technologyCode: true, isCompetitor: true },
    }),
    loadCrawl({ db, prospectId, payload }),
  ]);

  if (!prospect) {
    return { done: false, retry: false, reason: "analyze_capabilities: prospect not found" };
  }

  const result = detectCapabilities({ crawl, technologies, prospect });
  const written = await writeCapabilities({ db, prospectId, result, now });

  const known = result.capabilities.filter((c) => c.value !== null).length;
  return {
    done: true,
    note: [
      `${known}/${result.capabilities.length} capability(ies) determined`,
      `${result.pagesConsidered} page(s) rendered`,
      result.eligibility.deep ? "absence provable" : `absence withheld: ${result.eligibility.reason}`,
      written.preserved ? `${written.preserved} earlier finding(s) kept` : null,
    ]
      .filter(Boolean)
      .join("; "),
  };
}

async function writeCapabilities({ db, prospectId, result, now }) {
  let preserved = 0;

  const existing = await db.prospectCapability.findMany({
    where: { prospectId },
    select: { code: true, value: true },
  });
  const known = new Map(existing.map((row) => [row.code, row.value]));

  await db.$transaction(async (tx) => {
    await tx.prospectEvidence.deleteMany({ where: { prospectId, detector: CAPABILITY_DETECTOR } });

    for (const capability of result.capabilities) {
      // Rule 1. See the file header: an unknown must not erase a finding.
      if (capability.value === null && known.get(capability.code) != null) {
        preserved++;
        continue;
      }

      const evidenceIds = [];
      for (const row of capability.evidence) {
        const created = await tx.prospectEvidence.create({
          data: {
            prospectId,
            type: row.type,
            source: row.source,
            sourceUrl: row.sourceUrl,
            rawValue: row.rawValue,
            normalizedValue: row.normalizedValue,
            confidence: row.confidence,
            detector: CAPABILITY_DETECTOR,
            detectorVersion: CAPABILITY_DETECTOR_VERSION,
            observedAt: now,
          },
          select: { id: true },
        });
        evidenceIds.push(created.id);
      }

      const data = {
        value: capability.value,
        confidence: capability.confidence,
        evidenceIds,
        detectedAt: now,
        detectorVersion: CAPABILITY_DETECTOR_VERSION,
      };
      await tx.prospectCapability.upsert({
        where: { prospectId_code: { prospectId, code: capability.code } },
        update: data,
        create: { prospectId, code: capability.code, ...data },
      });
    }
  });

  return { preserved };
}

// Wrapped — see chain.js. This stage completes even when nothing rendered
// (it writes nulls, or preserves what it already knew), so the opportunity
// analysis downstream always runs against the truest picture available.
registerHandler("ANALYZE_CAPABILITIES", withChain("ANALYZE_CAPABILITIES", handleAnalyzeCapabilities));
