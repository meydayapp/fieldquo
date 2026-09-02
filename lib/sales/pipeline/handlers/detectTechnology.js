// lib/sales/pipeline/handlers/detectTechnology.js
//
// DETECT_TECHNOLOGY — whose software is already installed on this prospect's
// website.
//
// ══ Thin on purpose ════════════════════════════════════════════════════════
//
// Every decision lives in lib/sales/intel/technology.js, which is pure and is
// executed against hostile input by scripts/check-sales-fingerprint.mjs. This
// file loads rows, hands them to that, and writes what it decided — the same
// division lib/sales/intel/db.js sets out and for the same reason: a matcher
// with a `db` in it cannot be run against a page that does not exist.
//
// ══ Where the pages come from ══════════════════════════════════════════════
//
// The crawler does not keep raw markup; it writes typed `ProspectEvidence`
// rows. `pagesFromEvidence()` reads those back into the snapshot shape the
// matcher wants, and it is the ONLY coupling between the two subsystems.
// A task may also carry pages inline in its payload, which is what makes this
// stage runnable end to end without a crawl having happened — the check drives
// it that way.
//
// ══ What a re-run replaces, and what it must never touch ═══════════════════
//
// A detection is DERIVED: it is reproducible from the pages and the
// signatures, and a stale one is a rep being told a contractor runs software
// they dropped last spring. So a successful run replaces the detections that
// ACTIVE signatures produce.
//
// It does not touch anything else. Detections whose signature has since been
// switched off survive, because switching a signature off is an instruction to
// stop LOOKING, not an instruction to forget what was already seen — and the
// signatures screen promises exactly that. Nor does it touch the crawler's own
// evidence rows: this stage deletes only rows carrying its own detector name,
// which is what makes "delete and rewrite" a cache refresh rather than a loss
// of provenance.
import { registerHandler } from "@/lib/sales/pipeline/registry";
import {
  DETECTOR_NAME,
  DETECTOR_VERSION,
  detectTechnologies,
  normaliseCrawl,
  pagesFromEvidence,
} from "@/lib/sales/intel/technology";

/** Evidence types the crawler writes that a page snapshot is built from. Named
 *  rather than "everything", so this stage never reads back its own rows or a
 *  future stage's and mistakes them for observations of a website. */
export const CRAWL_EVIDENCE_TYPES = Object.freeze([
  "page_fetch",
  "page_content",
  "meta",
  "script_src",
  "iframe_host",
  "link",
  "form",
  "button",
  "schema_org",
  "dom_attr",
]);

const MAX_EVIDENCE_ROWS = 5000;

/**
 * Load the crawl for one prospect.
 *
 * Inline pages win when a caller supplies them: that is the handoff a crawler
 * uses when it wants the analysis to run against exactly what it just fetched,
 * rather than against whatever is in the table by the time this stage claims
 * its task.
 */
export async function loadCrawl({ db, prospectId, payload = {} }) {
  if (payload && (Array.isArray(payload.pages) || Array.isArray(payload.crawl?.pages))) {
    return normaliseCrawl(Array.isArray(payload.pages) ? { pages: payload.pages } : payload.crawl);
  }

  const rows = await db.prospectEvidence.findMany({
    where: { prospectId, source: "website", type: { in: [...CRAWL_EVIDENCE_TYPES] } },
    orderBy: { observedAt: "desc" },
    take: MAX_EVIDENCE_ROWS,
    select: { type: true, sourceUrl: true, rawValue: true, normalizedValue: true },
  });

  return normaliseCrawl(pagesFromEvidence(rows));
}

/**
 * @param payload { prospectId?, pages?, crawl? }
 *        prospectId falls back to the task's own column — both enqueue shapes
 *        are legitimate and a handler reading one of them would abandon every
 *        task queued the other way.
 */
export async function handleDetectTechnology({ task, payload = {}, db, now = new Date() } = {}) {
  const prospectId = payload.prospectId || task?.prospectId || null;
  if (!prospectId) {
    return { done: false, retry: false, reason: "detect_technology: no prospectId on the task or its payload" };
  }

  const [signatures, crawl] = await Promise.all([
    db.technologySignature.findMany({ where: { active: true } }),
    loadCrawl({ db, prospectId, payload }),
  ]);

  if (!signatures.length) {
    // Terminal rather than retried: an empty signature table is a
    // configuration state, not an outage, and five attempts over six hours
    // will find the same empty table. The reason names the screen that fixes
    // it, because the person reading a failed row is the person who can.
    return {
      done: false,
      retry: false,
      reason: "detect_technology: no active technology signatures — seed them on /platform/sales/signatures",
    };
  }

  const result = detectTechnologies({ signatures, crawl });

  if (result.pagesConsidered === 0) {
    // No page loaded. Note what this does NOT do: it writes nothing, and in
    // particular it does not clear existing detections. "We could not look
    // today" is not evidence that the software was uninstalled.
    return {
      done: false,
      retry: false,
      reason: crawl.blocked
        ? "detect_technology: every crawled page was blocked — nothing to fingerprint"
        : "detect_technology: no crawled page loaded for this prospect — run CRAWL_WEBSITE first",
    };
  }

  const activeCodes = signatures.map((s) => s.code);
  const written = await writeTechnologies({ db, prospectId, result, activeCodes, now });

  return {
    done: true,
    note: [
      `${result.technologies.length} technology(ies)`,
      `${result.pagesConsidered} page(s)`,
      written.removed ? `${written.removed} stale detection(s) cleared` : null,
      result.technologies.some((t) => t.isCompetitor) ? "competitor present" : null,
    ]
      .filter(Boolean)
      .join("; "),
  };
}

/**
 * Write the detections and the evidence behind them, in one transaction.
 *
 * Evidence first, then the technology row that cites it, because
 * `ProspectTechnology.evidenceIds` is a bare String[] with no foreign key —
 * so an id written before its row exists would be a citation pointing at
 * nothing, and nothing in the database would object.
 */
async function writeTechnologies({ db, prospectId, result, activeCodes, now }) {
  const detected = new Set(result.technologies.map((t) => t.technologyCode));
  let removed = 0;

  await db.$transaction(async (tx) => {
    // This stage's own evidence only. The crawler's rows carry a different
    // detector and are untouched history.
    await tx.prospectEvidence.deleteMany({ where: { prospectId, detector: DETECTOR_NAME } });

    // Detections that an ACTIVE signature no longer produces. Scoped to the
    // active set on purpose — see the file header.
    const stale = activeCodes.filter((code) => !detected.has(code));
    if (stale.length) {
      const gone = await tx.prospectTechnology.deleteMany({
        where: { prospectId, technologyCode: { in: stale } },
      });
      removed = gone.count;
    }

    for (const technology of result.technologies) {
      const evidenceIds = [];
      for (const row of technology.evidence) {
        const created = await tx.prospectEvidence.create({
          data: {
            prospectId,
            type: row.type,
            source: row.source,
            sourceUrl: row.sourceUrl,
            rawValue: row.rawValue,
            normalizedValue: row.normalizedValue,
            confidence: row.confidence,
            detector: DETECTOR_NAME,
            detectorVersion: DETECTOR_VERSION,
            observedAt: now,
          },
          select: { id: true },
        });
        evidenceIds.push(created.id);
      }

      const data = {
        isCompetitor: technology.isCompetitor,
        confidence: technology.confidence,
        evidenceIds,
        detectedAt: now,
        signatureVersion: technology.signatureVersion,
      };
      await tx.prospectTechnology.upsert({
        where: { prospectId_technologyCode: { prospectId, technologyCode: technology.technologyCode } },
        update: data,
        create: { prospectId, technologyCode: technology.technologyCode, ...data },
      });
    }
  });

  return { removed };
}

registerHandler("DETECT_TECHNOLOGY", handleDetectTechnology);
