// app/api/platform/sales/signatures/[code]/route.js
//
// Edit one technology signature, switch it on or off, and — only when it has
// matched nothing — remove it.
//
// ══ Deactivate, never delete, once a signature has matched ═══════════════
//
// `ProspectTechnology.technologyCode` and `.signatureVersion` are the
// provenance of every detection. Deleting the signature leaves those rows
// citing nothing, and a detection is what tells a rep "they are already
// running Jobber" — a claim that ends a call badly when it is wrong and
// cannot be traced. The count is re-read INSIDE the transaction rather than
// trusted from the GET that rendered the button, on the canWrite() discipline
// in lib/migrations/state.js: the state at the moment of the write is the only
// state that matters.
//
// ══ Version-on-edit ══════════════════════════════════════════════════════
//
// `patterns` and `isCompetitor` bump it; the name and the on/off switch do
// not. Both bumping fields change what a detection stamped with that version
// MEANT — see lib/sales/intel/versioning.js.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shapeSignatureInput, superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { versionBumpFor } from "@/lib/sales/intel/versioning";

export async function PATCH(request, { params }) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  // Next 16: params is a Promise.
  const { code } = await params;
  const body = await request.json().catch(() => ({}));

  if ("code" in body) {
    return NextResponse.json(
      {
        error:
          "A signature's code cannot change — every detection it has produced cites it. " +
          "Switch this one off and add a new signature under the code you want.",
      },
      { status: 400 },
    );
  }
  if ("version" in body) {
    return NextResponse.json(
      { error: "The version is set by what you change, not by hand." },
      { status: 400 },
    );
  }

  const existing = await db.technologySignature.findUnique({ where: { code } });
  if (!existing) {
    return NextResponse.json({ error: `No signature with the code ${code}.` }, { status: 404 });
  }

  const shaped = shapeSignatureInput(body, { partial: true });
  if (shaped.error) return NextResponse.json({ error: shaped.error }, { status: 400 });

  const patch = { ...shaped.value };
  if ("active" in body) {
    if (typeof body.active !== "boolean") {
      return NextResponse.json({ error: "active must be true or false" }, { status: 400 });
    }
    patch.active = body.active;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  }

  const { bump, changed, version } = versionBumpFor("technologySignature", existing, patch);
  if (bump) patch.version = version;

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.technologySignature.update({ where: { code }, data: patch });
    await tx.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action: bump ? "sales_signature_edited" : "sales_signature_relabelled",
        details: {
          code,
          fields: Object.keys(patch),
          semanticChanges: changed,
          versionFrom: existing.version,
          versionTo: row.version,
          before: Object.fromEntries(Object.keys(patch).map((f) => [f, existing[f] ?? null])),
          after: Object.fromEntries(Object.keys(patch).map((f) => [f, row[f] ?? null])),
        },
      },
    });
    return row;
  });

  return NextResponse.json({ signature: updated, bumped: bump });
}

export async function DELETE(request, { params }) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { code } = await params;

  const existing = await db.technologySignature.findUnique({ where: { code } });
  if (!existing) {
    return NextResponse.json({ error: `No signature with the code ${code}.` }, { status: 404 });
  }

  try {
    await db.$transaction(async (tx) => {
      const matched = await tx.prospectTechnology.count({ where: { technologyCode: code } });
      if (matched > 0) {
        const err = new Error(
          `${code} has matched ${matched} prospect${matched === 1 ? "" : "s"}. ` +
            "Deleting it would leave those detections citing a signature that no longer exists, " +
            "so it cannot be deleted — switch it off instead. It stops matching immediately and " +
            "the trail survives.",
        );
        err.status = 409;
        throw err;
      }
      await tx.technologySignature.delete({ where: { code } });
      await tx.platformAuditLog.create({
        data: {
          platformAdminId: admin.id,
          action: "sales_signature_deleted",
          details: {
            code,
            name: existing.name,
            isCompetitor: existing.isCompetitor,
            patterns: existing.patterns,
            version: existing.version,
          },
        },
      });
    });
  } catch (err) {
    if (err?.status === 409) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }

  return NextResponse.json({ deleted: code });
}
