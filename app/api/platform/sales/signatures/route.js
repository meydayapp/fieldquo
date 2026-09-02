// app/api/platform/sales/signatures/route.js
//
// Technology fingerprints — Jobber, Housecall Pro, Calendly, a chat widget —
// for the superadmin screen that writes them.
//
// ══ Say what is true: nothing reads `patterns` yet ════════════════════════
//
// There is no crawler in this repo. docs/sales-intel/STATUS.md states it
// plainly and a search confirms it: `TechnologySignature` has no consumer, no
// seed, and no detector. So this route stores configuration for a detector
// that has not shipped.
//
// That is a legitimate thing to build — the standing rule is that every rule
// is editable from the UI, and a config table with no screen is exactly what
// it forbids — but it is NOT the same as a working detector, and the
// difference has to be visible. `detectionsPending` below and the banner on
// the screen say it in the product's own words. A screen that let somebody add
// a competitor signature and implied their prospects would start being
// fingerprinted would be a feature flag for a feature that does not exist.
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

export async function GET(request) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const [signatures, detections] = await Promise.all([
    db.technologySignature.findMany({ orderBy: [{ isCompetitor: "desc" }, { code: "asc" }] }),
    // How many prospects each signature has actually matched. Same job as the
    // rule result count: it is what makes "never delete something that has
    // produced results" a fact on screen rather than a policy in a comment.
    db.prospectTechnology.groupBy({ by: ["technologyCode"], _count: { _all: true } }),
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
    // cannot forget to say it.
    detectionsPending: true,
  });
}

export async function POST(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => ({}));
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
