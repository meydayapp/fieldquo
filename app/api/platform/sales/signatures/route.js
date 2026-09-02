// app/api/platform/sales/signatures/route.js
//
// Technology fingerprints — Jobber, Housecall Pro, Calendly, a chat widget —
// for the superadmin screen that writes them.
//
// ══ Say what is true — and what is true CHANGED ═══════════════════════════
//
// This route used to carry a permanent banner saying nothing read `patterns`,
// because nothing did: `TechnologySignature` had a table, a screen and no
// consumer. It has one now. lib/sales/intel/technology.js matches these rows
// and the DETECT_TECHNOLOGY pipeline stage writes `ProspectTechnology` from
// what it finds, so the banner has come down.
//
// What replaces it is narrower and still honest: a detector needs crawled
// pages, and on a fresh install nothing has been crawled. So the payload
// carries `crawledProspects` — a COUNT of prospects with a `lastCrawledAt`,
// read from the database rather than asserted — and the screen says "these are
// live, and nothing has been crawled yet" only while that number is zero.
// A claim about the state of the world that is computed from the world cannot
// go stale the way the old hard-coded `true` would have.
//
// ══ What a signature decides, once something does read it ════════════════
//
// `isCompetitor` is not a label. A competitor detection changes the entire
// sales conversation: `evaluateRule` refuses every table-stakes capability the
// moment one is present, because a business already running a field-service
// platform does not need to be told it should have online booking. So
// switching a signature to `isCompetitor` will remove talking points from
// every prospect it matches, which is the safe direction and still a
// consequence somebody should be told about before they click.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  SIGNATURE_PATTERN_KINDS,
  shapeSignatureInput,
  superadminOrRefusal,
} from "@/lib/sales/intel/configAdmin";
import { DETECTOR_VERSION } from "@/lib/sales/intel/technology";
import { seedTechnologySignatures, sourcingNotes } from "@/lib/sales/intel/signatureSeed";

export async function GET(request) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const [signatures, detections, crawledProspects] = await Promise.all([
    db.technologySignature.findMany({ orderBy: [{ isCompetitor: "desc" }, { code: "asc" }] }),
    // How many prospects each signature has actually matched. Same job as the
    // rule result count: it is what makes "never delete something that has
    // produced results" a fact on screen rather than a policy in a comment.
    db.prospectTechnology.groupBy({ by: ["technologyCode"], _count: { _all: true } }),
    // The one number that decides whether the detector has had anything to
    // look at. Counted, not assumed.
    db.prospect.count({ where: { lastCrawledAt: { not: null } } }),
  ]);

  const counts = new Map(detections.map((d) => [d.technologyCode, d._count._all]));

  return NextResponse.json({
    signatures: signatures.map((s) => {
      const detectionCount = counts.get(s.code) || 0;
      return {
        ...s,
        detectionCount,
        deletable: detectionCount === 0,
      };
    }),
    patternKinds: SIGNATURE_PATTERN_KINDS,
    // The honest state of the world, carried in the payload so the screen
    // cannot forget to say it — and computed, so it cannot say it wrongly.
    crawledProspects,
    detectionsPending: crawledProspects === 0,
    detectorVersion: DETECTOR_VERSION,
    // Which of these rows came from the seed and how each was verified, so
    // "how do we know Jobber looks like this" is answerable on the screen
    // rather than by reading a file. Kept out of the row itself because it
    // describes the SEED — a superadmin who edits the patterns has made the
    // note untrue, which is why it is keyed separately and labelled as the
    // starter sourcing.
    sourcing: sourcingNotes(),
    seedable: signatures.length === 0,
  });
}

export async function POST(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => ({}));

  // Loading the starter signatures, from the screen. A POST branch rather than
  // a separate route, and a screen button rather than only a script, for the
  // reason the sibling capabilities route already gives: this editor is
  // useless against an empty table and "ssh in and run a script" is not a
  // control anybody can see. Additive and idempotent — an existing signature
  // keeps its patterns, its weights, its active flag and its classification,
  // because those belong to whoever edited them here.
  if (body?.action === "seed") {
    try {
      const counts = await seedTechnologySignatures({ db });
      await db.platformAuditLog.create({
        data: {
          platformAdminId: admin.id,
          action: "sales_signatures_seeded",
          details: counts,
        },
      });
      return NextResponse.json({ counts });
    } catch (err) {
      console.error("[sales/signatures] seed failed:", err?.message);
      return NextResponse.json({ error: err?.message || "The seed failed" }, { status: 500 });
    }
  }

  const shaped = shapeSignatureInput(body);
  if (shaped.error) return NextResponse.json({ error: shaped.error }, { status: 400 });

  const row = shaped.value;

  const existing = await db.technologySignature.findUnique({ where: { code: row.code } });
  if (existing) {
    return NextResponse.json(
      { error: `A signature with the code ${row.code} already exists.` },
      { status: 409 },
    );
  }

  const created = await db.$transaction(async (tx) => {
    const signature = await tx.technologySignature.create({
      data: { ...row, active: true, version: "1" },
    });
    await tx.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action: "sales_signature_created",
        details: {
          code: signature.code,
          name: signature.name,
          isCompetitor: signature.isCompetitor,
          patterns: signature.patterns,
          version: signature.version,
        },
      },
    });
    return signature;
  });

  return NextResponse.json({ signature: created });
}
