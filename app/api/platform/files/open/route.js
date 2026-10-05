// app/api/platform/files/open/route.js
//
// Open a stored file from FieldQuo's own console: a document a company
// uploaded for its paid data migration, or the receipt attached to a sales
// payout batch. Both were plain Cloudinary links, which this account answers
// with 401 for a PDF (lib/media/signedFile.js).
//
// The gate is the one the screen that links here already has: any platform
// admin for a migration (GET /api/platform/migrations/[id]), superadmin or
// admin for payouts (payoutViewerOrRefusal). Viewing is allowed — the
// platform may view everything and edit nothing — and this writes nothing.
// The fence is per kind (lib/media/fileOpen.js resolvePlatformFile).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { payoutViewerOrRefusal } from "@/lib/sales/payoutAdmin";
import { resolvePlatformFile, openFileResponse, FILE_OPEN_ERRORS } from "@/lib/media/fileOpen";
import { cloudinarySigner } from "@/lib/media/cloudinarySign";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const kind = q.get("k");
  const id = q.get("id");

  if (kind === "payout-proof") {
    const { refusal } = await payoutViewerOrRefusal(request);
    if (refusal) return NextResponse.json(refusal.body, { status: refusal.status, headers: NO_STORE });
  } else {
    const admin = await getCurrentPlatformAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const file = await resolvePlatformFile(db, { kind, id });
  if (!file) return NextResponse.json({ error: FILE_OPEN_ERRORS.missing }, { status: 404, headers: NO_STORE });
  return openFileResponse({
    file,
    companyId: file.companyId || null,
    prefix: file.prefix || null,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    sign: cloudinarySigner(),
  });
}
