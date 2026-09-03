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
//
// ══ Why the TRADE is decided here too ══════════════════════════════════════
//
// Same stage, same pages, same reason. What trade a contractor is in is
// written on their own website — in the title, the schema.org markup, the
// service-page URLs and the navigation — so §58 puts it on the deterministic
// side with everything else this stage does, and it must not cost an AI call
// or sit on GENERATE_RESEARCH_BRIEF's budget, which is the tightest lane in
// the pipeline. lib/sales/intel/tradeDetect.js decides; this file writes.
//
// Three write rules, all of them about the TABLE rather than the page:
//
//   3. `Prospect.tradeKey` is only ever FILLED, never overwritten. The column
//      is what a rep's queue is grouped by, so changing it MOVES a prospect
//      between queues — potentially out from under the rep holding it — which
//      is a destructive operation wearing a cosmetic label. A site that
//      disagrees with the directory is reported in the note and left for a
//      human. (A claimed prospect necessarily already has a trade:
//      claimCandidateWhere() cannot match a null one.)
//   4. Only a CONFIRMED inference may fill it. A weak one — one structural
//      signal, or two trades contesting the site — writes a
//      `ProspectInference` and nothing else, which is exactly the fact /
//      inference separation §2 asks for: the queue is built from facts.
//   5. The inference row is upserted and never deleted by a later unknown
//      run, for rule 1's reason. "We could not look today" must not erase
//      "last week their own title said roofing".
import { registerHandler } from "@/lib/sales/pipeline/registry";
import { withChain } from "@/lib/sales/pipeline/chain";
import {
  CAPABILITY_DETECTOR,
  CAPABILITY_DETECTOR_VERSION,
  detectCapabilities,
} from "@/lib/sales/intel/capabilityDetect";
import {
  TRADE_DETECTOR,
  TRADE_DETECTOR_VERSION,
  TRADE_INFERENCE_KIND,
  inferTrade,
} from "@/lib/sales/intel/tradeDetect";
import {
  SITE_IDENTITY_DETECTOR,
  SITE_IDENTITY_DETECTOR_VERSION,
  corroborateSite,
} from "@/lib/sales/intel/siteIdentity";
import { loadDerivedSite } from "@/lib/sales/intel/db";
import { discoveryTradeLabel } from "@/lib/sales/discovery/trades";
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

  const [prospect, technologies, crawl, derivedSite] = await Promise.all([
    db.prospect.findUnique({
      where: { id: prospectId },
      select: {
        id: true,
        hasWebsite: true,
        websiteUrl: true,
        tradeKey: true,
        // Read for the identity check, not for display: siteIdentity.js
        // compares these against what the page says about itself.
        businessName: true,
        phoneE164: true,
        addressLine: true,
        postalCode: true,
        city: true,
      },
    }),
    db.prospectTechnology.findMany({
      where: { prospectId },
      select: { technologyCode: true, isCompetitor: true },
    }),
    loadCrawl({ db, prospectId, payload }),
    loadDerivedSite(prospectId, { deps: { db } }),
  ]);

  if (!prospect) {
    return { done: false, retry: false, reason: "analyze_capabilities: prospect not found" };
  }

  const result = detectCapabilities({ crawl, technologies, prospect });
  const written = await writeCapabilities({ db, prospectId, result, now });

  // ── Whose website is this? ──────────────────────────────────────────────
  //
  // Asked ONLY when the address was guessed, and "guessed" means exactly one
  // thing: the prospect has no `websiteUrl` and does have a `derived_site`
  // inference. Every other prospect's site was published by the source
  // against the business, so the question is already answered and asking it
  // again would refuse trades on sites nobody ever doubted — a far larger
  // regression than the one this guards.
  //
  // See lib/sales/intel/siteIdentity.js for the measurement: four of 166
  // derived domains that loaded belonged to a different business, including a
  // cabinet maker's email pointing at a multinational's brand portal.
  const wasDerived = !prospect.websiteUrl && Boolean(derivedSite?.domain);
  const identity = wasDerived
    ? corroborateSite({ crawl, prospect })
    : { corroborated: true, decision: "not_asked", signals: [], reason: null, evidence: [] };

  const trade = inferTrade({ crawl, prospect, siteBelongsToProspect: identity.corroborated });
  const tradeWritten = await writeTrade({
    db,
    prospectId,
    prospect,
    trade,
    now,
    // Written only for a derived site, because only there is it a finding.
    identity: wasDerived ? identity : null,
  });

  const known = result.capabilities.filter((c) => c.value !== null).length;
  return {
    done: true,
    note: [
      `${known}/${result.capabilities.length} capability(ies) determined`,
      `${result.pagesConsidered} page(s) rendered`,
      result.eligibility.deep ? "absence provable" : `absence withheld: ${result.eligibility.reason}`,
      written.preserved ? `${written.preserved} earlier finding(s) kept` : null,
      wasDerived ? identityNote(derivedSite, identity) : null,
      tradeNote(trade, tradeWritten),
    ]
      .filter(Boolean)
      .join("; "),
  };
}

/**
 * What the run says about a GUESSED address, in a sentence that never lets a
 * reader mistake it for a published one.
 *
 * The domain is always named. A superadmin looking at "trade not established
 * (site_not_corroborated)" has to be able to see WHICH domain failed to
 * corroborate, because the commonest fix is a human glancing at it for five
 * seconds and knowing immediately.
 */
function identityNote(derivedSite, identity) {
  const domain = derivedSite?.domain || "the derived domain";
  if (identity.corroborated) {
    return `${domain} was derived from the licence email and the site confirms it (${identity.signals.join(", ")})`;
  }
  return (
    `${domain} was derived from the licence email and the site does NOT confirm it ` +
    `(${identity.signals.length ? identity.signals.join(", ") : identity.reason || "no identity signal"}) ` +
    `— read as somebody else's site until a human says otherwise`
  );
}

/**
 * What the run says about the trade, in the words a superadmin reading a task
 * row needs — which of the three outcomes it was, and whether anything moved.
 */
function tradeNote(trade, tradeWritten) {
  const label = trade.tradeKey ? discoveryTradeLabel(trade.tradeKey) : null;
  if (trade.decision === "confirmed") {
    return tradeWritten.filled
      ? `trade established as ${label}`
      : trade.disagreesWithSource
        ? `trade already set and the site disagrees — the site says ${label}, left for a human`
        : `trade already set, site agrees (${label})`;
  }
  if (trade.decision === "weak") {
    const which = trade.candidates.map((c) => c.label).join(" / ");
    return `trade not established (${trade.reason}${which ? `: ${which}` : ""}) — recorded as an inference only`;
  }
  return `trade not established (${trade.reason})`;
}

/**
 * Write the trade layer: the evidence, the inference, and — only when the
 * evidence CONFIRMED it and the column is empty — the fact.
 *
 * Rules 3, 4 and 5 from the file header. The whole thing is one transaction
 * with the evidence, so an inference can never cite rows that were not
 * written, and the `tradeKey` fill is guarded on the value that was READ —
 * the compare-and-set discipline the queue claim and lib/voice/autoTopup.js
 * both use, because two ticks can analyse one prospect.
 */
async function writeTrade({ db, prospectId, prospect, trade, now, identity = null }) {
  // An unknown run writes nothing at all — not even a delete. Clearing last
  // week's evidence because today's crawl was blocked is rule 1 in a second
  // costume: it turns "we could not look" into "there is nothing there".
  //
  // The identity evidence is the ONE exception, and it is the same rule read
  // the other way: a derived site that corroborated is a finding about the
  // prospect even when the page said nothing about a trade, and throwing it
  // away because the trade came back unknown would make the next run re-fetch
  // to re-learn it.
  if (trade.decision === "unknown" && !identity?.evidence?.length) return { filled: false, evidence: 0 };

  let filled = false;
  let websiteConfirmed = false;

  await db.$transaction(async (tx) => {
    await tx.prospectEvidence.deleteMany({ where: { prospectId, detector: TRADE_DETECTOR } });

    // ── Whose site it is, recorded before what the site says ─────────────
    //
    // Delete-and-rewrite, the same shape as the trade evidence beside it: this
    // detector's rows are wholly reproducible from the current crawl, and a
    // stale "the phone matched" from a page that has since changed hands is
    // the kind of provenance that is worse than none.
    if (identity) {
      await tx.prospectEvidence.deleteMany({ where: { prospectId, detector: SITE_IDENTITY_DETECTOR } });
      for (const row of identity.evidence || []) {
        await tx.prospectEvidence.create({
          data: {
            prospectId,
            type: row.type,
            source: row.source,
            sourceUrl: row.sourceUrl,
            rawValue: row.rawValue,
            normalizedValue: row.normalizedValue,
            confidence: row.confidence,
            detector: SITE_IDENTITY_DETECTOR,
            detectorVersion: SITE_IDENTITY_DETECTOR_VERSION,
            observedAt: now,
          },
        });
      }

      // ── The one place a guessed site becomes a stated fact ─────────────
      //
      // crawlSite.js refuses to write `hasWebsite: true` off a derived
      // address, because a page answering proves only that SOMEBODY has a
      // site. Corroboration is what turns that into a statement about THIS
      // business, and it is available here and nowhere earlier.
      //
      // Fill only, guarded on the value read, exactly like `tradeKey` below:
      // a crawl that later proves absence must be able to say so, and this
      // must never be the write that overrules it.
      if (identity.corroborated && prospect.hasWebsite !== true) {
        const moved = await tx.prospect.updateMany({
          where: { id: prospectId, hasWebsite: null },
          data: { hasWebsite: true },
        });
        websiteConfirmed = moved.count > 0;
      }
    }

    const evidenceIds = [];
    for (const row of trade.evidence) {
      const created = await tx.prospectEvidence.create({
        data: {
          prospectId,
          type: row.type,
          source: row.source,
          sourceUrl: row.sourceUrl,
          rawValue: row.rawValue,
          normalizedValue: row.normalizedValue,
          confidence: row.confidence,
          detector: TRADE_DETECTOR,
          detectorVersion: TRADE_DETECTOR_VERSION,
          observedAt: now,
        },
        select: { id: true },
      });
      evidenceIds.push(created.id);
    }

    if (trade.inference) {
      const data = {
        value: trade.inference.value,
        confidence: trade.confidence?.value ?? 0,
        evidenceIds,
        source: "derived",
        observedAt: now,
        modelVersion: TRADE_DETECTOR_VERSION,
      };
      await tx.prospectInference.upsert({
        where: { prospectId_kind: { prospectId, kind: TRADE_INFERENCE_KIND } },
        update: data,
        create: { prospectId, kind: TRADE_INFERENCE_KIND, ...data },
      });
    }

    // Fill only. `tradeKey: null` in the WHERE is what makes it a fill rather
    // than an overwrite even if the row changed under us between the read and
    // here — a second tick that got there first keeps its answer, and this one
    // reports zero rather than moving a prospect between queues.
    if (trade.decision === "confirmed" && trade.tradeKey && !prospect.tradeKey) {
      const moved = await tx.prospect.updateMany({
        where: { id: prospectId, tradeKey: null },
        data: { tradeKey: trade.tradeKey },
      });
      filled = moved.count > 0;
    }
  });

  return { filled, websiteConfirmed, evidence: trade.evidence.length };
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
