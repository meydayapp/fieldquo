// app/api/fleet/[id]/documents/route.js
//
// One van's paperwork: the registration, the insurance policy, the bill of
// sale, the photo of the dent.
//
// ══ The upload path is the existing one ════════════════════════════════════
//
// Same two round trips as a job's documents (app/api/jobs/[id]/documents):
// the browser POSTs the file to /api/upload — signed, authenticated, size- and
// type-capped — and POSTs the URL it gets back here. No file bytes reach this
// route, and a URL that did not come from this deployment's own cloud is
// refused (lib/jobs/documents.js `isUploadedUrl`), because a "registration"
// row linking to somebody else's host is a phishing link filed inside the
// contractor's own back office.
//
// ══ The paper moves the column ═════════════════════════════════════════════
//
// An insurance policy filed with an expiry date is a better source for
// `VehicleDetail.insuranceExpiresAt` than a date typed from memory, and the
// due-and-expiring panel reads that column. So filing one updates it — the
// newest filed policy wins, by upload date (lib/fleet/documents.js says why
// not by expiry) — in the SAME transaction as the row, so the paper and the
// panel cannot disagree by a crash in between. The response says whether the
// column moved, and returns the whole fleet the way every fleet write does,
// because a moved column changes the due list.
//
// ══ Two gates, the fleet screen's own ══════════════════════════════════════
//
// Reading is the fleet read, writing the fleet write (lib/fleet/access.js).
// A "purchase" document — the bill of sale — is the van's price on letterhead,
// so it needs the cost-basis read as well, in both directions.
//
// ══ Nothing here deletes ═══════════════════════════════════════════════════
//
// A document hangs off the Asset (schema: AssetDocument.assetId, Cascade), so
// it lives and dies with the register row, and there is no DELETE here — the
// same choice the job store made. An orphaned fleet record (its Asset deleted
// from Settings → Overhead) has nothing to hang a file on and says so with a
// 409 rather than a 500.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import {
  canSeeVehicleCost,
  canWriteFleet,
  requireFleetRead,
  requireFleetWrite,
} from "@/lib/fleet/access";
import {
  canSeeVehicleDocumentKind,
  expiryColumnsToWrite,
  parseVehicleDocumentBody,
  visibleVehicleDocuments,
} from "@/lib/fleet/documents";
import { loadFleet } from "@/lib/fleet/load";
import { recordActivity } from "@/lib/activity/log";

const SELECT = {
  id: true,
  name: true,
  kind: true,
  url: true,
  sizeBytes: true,
  mimeType: true,
  expiresAt: true,
  uploadedById: true,
  uploadedAt: true,
};

// The fleet record, and the Asset it hangs off — proved to be ours by the
// companyId on BOTH, since VehicleDetail.assetId carries no foreign key.
async function ownVehicle(id, companyId) {
  const vehicle = await db.vehicleDetail.findFirst({
    where: { id, companyId },
    select: {
      id: true,
      plate: true,
      assetId: true,
      insuranceExpiresAt: true,
      registrationExpiresAt: true,
    },
  });
  if (!vehicle) return { vehicle: null, asset: null };
  const asset = await db.asset.findFirst({
    where: { id: vehicle.assetId, companyId },
    select: { id: true },
  });
  return { vehicle, asset };
}

// Next 16: params is a Promise.
export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireFleetRead(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const { vehicle, asset } = await ownVehicle(id, member.companyId);
  if (!vehicle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = asset
    ? await db.assetDocument.findMany({
        where: { assetId: asset.id, companyId: member.companyId },
        select: SELECT,
        orderBy: [{ uploadedAt: "desc" }, { id: "desc" }],
      })
    : [];

  const canSeeCost = canSeeVehicleCost(full);
  const { documents, hiddenCount } = visibleVehicleDocuments(rows, { canSeeCost });

  return NextResponse.json({
    documents,
    // A COUNT, never a list — see lib/fleet/documents.js.
    hiddenCount,
    // What the panel may draw, decided by the same member object that gates
    // the POST, so an Upload button cannot exist where the POST answers 403.
    // An orphan cannot take a file at all, and the button is not drawn for it.
    canUpload: canWriteFleet(full) && !!asset,
    canSeeCost,
  });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireFleetWrite(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const { vehicle, asset } = await ownVehicle(id, member.companyId);
  if (!vehicle) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!asset)
    return NextResponse.json(
      {
        error:
          "The asset record behind this vehicle was deleted, so there is nothing to file this against. Add the van back to the register first.",
        code: "asset_missing",
      },
      { status: 409 },
    );

  const body = await request.json().catch(() => ({}));
  const parsed = parseVehicleDocumentBody(body, {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  });
  if (parsed.error)
    return NextResponse.json({ error: parsed.error }, { status: parsed.status || 400 });

  const canSeeCost = canSeeVehicleCost(full);
  if (!canSeeVehicleDocumentKind(parsed.data.kind, { canSeeCost })) {
    // Refused on the way in as well as on the way out: somebody who cannot be
    // shown the bill of sale must not be able to file one, or the upload
    // succeeds, vanishes from their own list, and gets uploaded again.
    return NextResponse.json(
      {
        error:
          "Your access level doesn't cover what the vehicle cost — ask someone who can see the asset register to file the bill of sale.",
      },
      { status: 403 },
    );
  }

  // The row and the column it implies, together or not at all.
  const { created, expiry } = await db.$transaction(async (tx) => {
    const row = await tx.assetDocument.create({
      data: {
        companyId: member.companyId,
        assetId: asset.id,
        ...parsed.data,
        uploadedById: full?.userId || null,
      },
      select: SELECT,
    });
    // Over EVERY document on the asset, not just this one: the newest by
    // upload date wins, and this one is newest only if nothing filed a moment
    // ago beat it — lib/fleet/documents.js decides, from the rows.
    const all = await tx.assetDocument.findMany({
      where: { assetId: asset.id, companyId: member.companyId },
      select: { id: true, kind: true, expiresAt: true, uploadedAt: true },
    });
    const columns = expiryColumnsToWrite(vehicle, all);
    if (columns) {
      await tx.vehicleDetail.update({ where: { id: vehicle.id }, data: columns });
    }
    return { created: row, expiry: columns };
  });

  await recordActivity(member, {
    action: "fleet.document_filed",
    entityType: "settings",
    entityId: vehicle.id,
    summary: `Filed a ${created.kind} document for a vehicle${vehicle.plate ? ` (${vehicle.plate})` : ""}`,
    // Which columns moved, never their values — the row holds them.
    metadata: {
      vehicleId: vehicle.id,
      assetId: asset.id,
      documentId: created.id,
      expiryUpdated: expiry ? Object.keys(expiry) : [],
    },
  });

  return NextResponse.json(
    {
      document: created,
      expiryUpdated: !!expiry,
      fleet: await loadFleet({ db, member, full }),
    },
    { status: 201 },
  );
}
