// app/api/platform/sales/prospects/[id]/route.js
//
// Everything known about one prospect, in three labelled layers.
//
// ══ Why the layering happens HERE and not in the component ════════════════
//
// lib/sales/prospectView.js decides what each row is allowed to say, and it
// does it by calling presentCapability / presentInference / presentOpportunity
// rather than by re-deciding `verified`. This route is the only place that
// assembles the inputs those functions need — in particular the EVIDENCE, which
// is what turns a row's `evidenceIds` into the confidence signals behind it.
//
// Without the evidence join every capability would arrive with no signals, and
// fieldConfidence would correctly report `no_signals` for all of them: a screen
// full of "nothing has been observed that bears on this" for a prospect we had
// in fact crawled. That is not a rendering bug, it is a claim about the world,
// which is why the join is here and not optional.
//
// ══ Read-only, like its parent ════════════════════════════════════════════
//
// No PATCH. FieldQuo does not edit what a detector observed — a correction is a
// ProspectCorrection row, which is a different build and deliberately not
// stubbed in with a button that would overwrite provenance.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { PEOPLE_SOURCES, bbbSearchUrl, whoToAskFor } from "@/lib/sales/intel/people";
import { db } from "@/lib/db";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { DISCOVERY_TRADES } from "@/lib/sales/discovery/trades";
import { CLAIM_HOURS, prospectView, sourceCategoryView } from "@/lib/sales/prospectView";
import { loadMergedAnalysis } from "@/lib/sales/discovery/mergedReads";
import { mergedFromIds } from "@/lib/sales/discovery/mergeProspects";
import { matchedMapsListings } from "@/lib/sales/intel/mapsScrapeStatus";

export async function GET(request, { params }) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  // Next 16: params is a Promise. Reading .id off it synchronously yields
  // undefined, and Prisma drops an undefined from a where clause — which is how
  // app/api/invoices/versions/route.js returned an arbitrary invoice.
  const { id } = await params;

  const prospect = await db.prospect.findUnique({
    where: { id },
    include: {
      territory: { select: { id: true, name: true } },
      campaign: { select: { id: true, name: true } },
      capabilities: true,
      technologies: true,
      inferences: true,
      opportunities: { include: { capability: { select: { code: true, name: true } } } },
      scores: { orderBy: { computedAt: "desc" }, take: 5 },
      corrections: { orderBy: { correctedAt: "desc" }, take: 20 },
      evidence: { orderBy: { observedAt: "desc" }, take: 400 },
      // Every named person from every source, with the source — the
      // console shows them all; the card's rule picks which leads.
      people: { orderBy: { seenAt: "desc" } },
    },
  });

  if (!prospect) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // A survivor's analysis is the union of its own and its merged-from rows'
  // — mergedReads.js says which wins. One call, so this route and the rep's
  // card cannot disagree about what a merge shows.
  const analysis = await loadMergedAnalysis(db, prospect);

  const [rules, signatures, rep, mapsListings] = await Promise.all([
    db.confidenceRule.findMany(),
    db.technologySignature.findMany({ select: { code: true, name: true } }),
    prospect.assignedRepId
      ? db.salesRep.findUnique({
          where: { id: prospect.assignedRepId },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve(null),
    // The Maps listing(s) the rule attached to this row — what the console's
    // Google card states. Read from ExternalListing, which the owner's Mac
    // scrape writes; nothing here asks Google.
    matchedMapsListings({ db, prospectId: prospect.id }),
  ]);

  const signatureNames = Object.fromEntries(signatures.map((s) => [s.code, s.name]));

  const view = prospectView({
    prospect,
    capabilities: analysis.capabilities,
    technologies: analysis.technologies.map((t) => ({
      ...t,
      name: signatureNames[t.technologyCode] || t.technologyCode,
    })),
    inferences: analysis.inferences,
    opportunities: prospect.opportunities,
    evidence: analysis.evidence,
    scores: prospect.scores,
    rules,
    capabilityNames: Object.fromEntries(
      prospect.opportunities.map((o) => [o.capabilityCode, o.capability?.name || o.capabilityCode]),
    ),
    // A superadmin is not a rep, so no claim is ever "mine" here. Passing null
    // rather than an admin id keeps that honest: the console reports who holds
    // a claim, it never presents one as its own.
    repId: null,
  });

  return NextResponse.json({
    prospect: {
      ...view,
      tradeLabel: prospect.tradeKey
        ? DISCOVERY_TRADES[prospect.tradeKey]?.label || prospect.tradeKey
        : null,
      territory: prospect.territory,
      campaign: prospect.campaign,
      // Provenance. "Why do we think this phone number is theirs" has to be
      // answerable a year later, and for a directory source the answer is this
      // (release, record id) pair.
      provenance: {
        provider: prospect.sourceProvider,
        recordId: prospect.sourceRecordId,
        release: prospect.sourceRelease,
        dataset: prospect.sourceDataset,
        // Stored and never gated on — see the schema comment. Shown as a
        // provenance tag, never framed as a probability.
        confidence:
          prospect.sourceConfidence === null ? null : Number(prospect.sourceConfidence),
      },
      possibleDuplicateOfId: prospect.possibleDuplicateOfId,
      // The merge state, for the duplicate panel: retired INTO another row,
      // or carrying others. The panel itself reads /prospects/duplicates.
      mergedIntoId: prospect.mergedIntoId,
      mergedFromIds: mergedFromIds(prospect),
      sourceCategories: prospect.sourceCategories,
      // The same array, split into what a screen may SAY about it. Assembled
      // here rather than in the component for the reason this file's header
      // gives: what a row is allowed to claim is decided in prospectView.js,
      // and a page that grouped and labelled these itself would be a second
      // opinion about whether an authorisation is a trade.
      sourceCategoriesView: sourceCategoryView(prospect),
      // ── What the Google listing said, beside the record's own values ──
      // The columns the card prints side by side, verbatim, and the stored
      // match. The listing's values are in `places.result` (the snapshot the
      // Maps scrape's matcher wrote — or, on 64 rows, the API before it was
      // retired on 2026-09-20); the record's are here so a conflict is two
      // lines a person compares, never a merge.
      addressLine: prospect.addressLine,
      city: prospect.city,
      websiteUrl: prospect.websiteUrl,
      domain: prospect.domain,
      phoneE164: prospect.phoneE164,
      rating: prospect.googleRating === null ? null : Number(prospect.googleRating),
      reviewCount: prospect.googleReviewCount,
      businessStatus: prospect.businessStatus,
      places: {
        checkedAt: prospect.placesCheckedAt,
        verdict: prospect.placesVerdict,
        result: prospect.placesResult,
      },
      mapsListings,
      // ── Who to ask for, every source ─────────────────────────────────
      people: prospect.people.map((x) => ({
        id: x.id,
        name: x.name,
        givenName: x.givenName,
        role: x.role,
        source: x.source,
        sourceLabel: PEOPLE_SOURCES[x.source]?.label || x.source,
        sourceUrl: x.sourceUrl,
        seenAt: x.seenAt,
        typedBySalesRepId: x.typedBySalesRepId,
      })),
      whoToAskFor: whoToAskFor(prospect.people),
      bbb: {
        checkedAt: prospect.bbbCheckedAt,
        profileUrl: prospect.bbbProfileUrl,
        rating: prospect.bbbRating,
        accredited: prospect.bbbAccredited,
        businessStartedYear: prospect.businessStartedYear,
        employeeRange: prospect.employeeRange,
        entityType: prospect.entityType,
        searchUrl: bbbSearchUrl(prospect),
      },
      principalCheckedAt: prospect.principalCheckedAt,
      assignedRep: rep,
      assignedAt: prospect.assignedAt,
      claimExpiresAt: prospect.claimExpiresAt,
      doNotContactAt: prospect.doNotContactAt,
      doNotContactReason: prospect.doNotContactReason,
      corrections: prospect.corrections,
      evidenceCount: analysis.evidence.length,
      evidence: analysis.evidence.slice(0, 60).map((e) => ({
        id: e.id,
        fromProspectId: e.fromProspectId || null,
        type: e.type,
        source: e.source,
        sourceUrl: e.sourceUrl,
        rawValue: e.rawValue,
        normalizedValue: e.normalizedValue,
        observedAt: e.observedAt,
        detector: e.detector,
        detectorVersion: e.detectorVersion,
      })),
    },
    claimHours: CLAIM_HOURS,
  });
}
