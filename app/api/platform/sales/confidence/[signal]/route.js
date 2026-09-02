// app/api/platform/sales/confidence/[signal]/route.js
//
// Tune one signal's weight, or switch the signal off.
//
// ══ Upsert, not update ════════════════════════════════════════════════════
//
// A signal the seed has never written still HAS a weight — `weightsFrom`
// starts from the built-in default in SIGNALS and lets a row override it. So
// the screen shows every signal whether or not a row exists, and the first
// edit to an unseeded one has to create the row. An update-only route would
// 404 on exactly the signals a superadmin is most likely to reach for first,
// and "run the seed" is not an answer a control should give.
//
// The `category` written on create comes from SIGNALS, never from the request
// — see the refusal in shapeConfidenceInput and confidence.js's header on why
// category is a boundary rather than a dial.
//
// ══ Version ══════════════════════════════════════════════════════════════
//
// Bumped on weight and on `enabled`, both of which change the number the
// engine computes. Unlike OpportunityRule.version, nothing downstream stamps a
// confidence version onto a stored figure — there is no column for one — so
// this is a change counter shown on the screen, and the screen says so. It is
// still kept true, because a counter that is wrong is worse than no counter.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SIGNALS } from "@/lib/sales/intel/confidence";
import { shapeConfidenceInput, superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { versionBumpFor } from "@/lib/sales/intel/versioning";

export async function PATCH(request, { params }) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  // Next 16: params is a Promise.
  const { signal: raw } = await params;
  const signal = decodeURIComponent(raw || "");

  const known = SIGNALS[signal];
  if (!known) {
    // Refused rather than stored. A row for a signal no detector emits
    // contributes nothing to any figure — weightsFrom returns it as
    // `unrecognised` — so accepting it here would be a saved setting that
    // reads back correctly and changes nothing.
    return NextResponse.json(
      {
        error:
          `${signal} is not a signal this engine understands, so a weight for it would be ` +
          "read by nothing. Signals are added in lib/sales/intel/confidence.js, alongside the " +
          "detector that emits them.",
      },
      { status: 404 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const shaped = shapeConfidenceInput(body);
  if (shaped.error) return NextResponse.json({ error: shaped.error }, { status: 400 });
  const patch = shaped.value;

  const existing = await db.confidenceRule.findUnique({ where: { signal } });
  const before = existing || {
    signal,
    weight: known.weight,
    enabled: true,
    version: "1",
  };
  const { bump, changed, version } = versionBumpFor("confidenceRule", before, patch);

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.confidenceRule.upsert({
      where: { signal },
      create: {
        signal,
        // Never from the request. The category is this engine's
        // classification, not a superadmin's.
        category: known.category,
        weight: patch.weight ?? known.weight,
        enabled: patch.enabled ?? true,
        // A row created by a first edit is version 2, not 1: version 1 is what
        // the seed means, and this row's weight already differs from it.
        version: bump ? version : "1",
      },
      update: { ...patch, ...(bump ? { version } : {}) },
    });
    await tx.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action: patch.enabled === false ? "sales_confidence_disabled" : "sales_confidence_tuned",
        details: {
          signal,
          category: known.category,
          changed,
          seeded: Boolean(existing),
          weightFrom: Number(before.weight),
          weightTo: Number(row.weight),
          enabledFrom: before.enabled !== false,
          enabledTo: row.enabled,
          versionFrom: before.version,
          versionTo: row.version,
        },
      },
    });
    return row;
  });

  return NextResponse.json({
    signal: {
      signal: updated.signal,
      category: updated.category,
      weight: Number(updated.weight),
      enabled: updated.enabled,
      version: updated.version,
      defaultWeight: known.weight,
    },
    bumped: bump,
  });
}
