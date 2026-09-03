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
import { db } from "@/lib/db";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { DISCOVERY_TRADES } from "@/lib/sales/discovery/trades";
import { CLAIM_HOURS, prospectView, sourceCategoryView } from "@/lib/sales/prospectView";

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
    },
  });

  if (!prospect) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const [rules, signatures, rep] = await Promise.all([
    db.confidenceRule.findMany(),
    db.technologySignature.findMany({ select: { code: true, name: true } }),
    prospect.assignedRepId
      ? db.salesRep.findUnique({
          where: { id: prospect.assignedRepId },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve(null),
  ]);

  const signatureNames = Object.fromEntries(signatures.map((s) => [s.code, s.name]));

  const view = prospectView({
    prospect,
    capabilities: prospect.capabilities,
    technologies: prospect.technologies.map((t) => ({
      ...t,
      name: signatureNames[t.technologyCode] || t.technologyCode,
    })),
    inferences: prospect.inferences,
    opportunities: prospect.opportunities,
    evidence: prospect.evidence,
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
      sourceCategories: prospect.sourceCategories,
      // The same array, split into what a screen may SAY about it. Assembled
      // here rather than in the component for the reason this file's header
      // gives: what a row is allowed to claim is decided in prospectView.js,
      // and a page that grouped and labelled these itself would be a second
      // opinion about whether an authorisation is a trade.
      sourceCategoriesView: sourceCategoryView(prospect),
      assignedRep: rep,
      assignedAt: prospect.assignedAt,
      claimExpiresAt: prospect.claimExpiresAt,
      doNotContactAt: prospect.doNotContactAt,
      doNotContactReason: prospect.doNotContactReason,
      corrections: prospect.corrections,
      evidenceCount: prospect.evidence.length,
      evidence: prospect.evidence.slice(0, 60).map((e) => ({
        id: e.id,
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
