// app/api/migrations/[id]/documents/route.js
//
// The company handing FieldQuo their export — "the superadmin receives all
// the documents and information they need for the migration."
//
// Signed, server-side Cloudinary upload — same non-negotiable as every other
// upload in this product (lib/cloudinary.js) — through classifyMigrationDocument
// rather than the shared classifyMedia, because this route needs to accept
// exactly what that classifier's own header explains classifyMedia must not:
// QuickBooks/Jobber exports, spreadsheets, zips. See lib/media/validate.js.
//
// ── Who can read a document back ────────────────────────────────────────────
//
// The company that uploaded it (their own record), and — separately, over on
// /api/platform/migrations/[id] — the assigned superadmin. Nobody else: this
// is exactly "where does a contractor's exported QuickBooks file live and who
// can read it" from the brief. It lives in Cloudinary under a per-migration
// folder, and the URL is only ever handed back through these two authenticated
// endpoints, never rendered on any client-facing surface.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin } from "@/lib/billing/billingAdmin";
import { uploadBuffer } from "@/lib/cloudinary";
import { classifyMigrationDocument, safeFilename } from "@/lib/media/validate";
import { canUploadDocument, describeStatus } from "@/lib/migrations/state";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

async function loadOwnedMigration(request, params) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return { response };
  if (member.impersonation) {
    return { response: bad("Support access can't upload on the company's behalf.", 403) };
  }
  if (!isBillingAdmin(member.role)) {
    return { response: bad("Only an owner or admin can manage migration documents.", 403) };
  }
  const { id } = await params;
  const migration = await db.migrationRequest.findUnique({ where: { id } });
  if (!migration || migration.companyId !== member.companyId) {
    return { response: bad("Not found", 404) };
  }
  return { member, migration };
}

export async function GET(request, { params }) {
  const { response, migration } = await loadOwnedMigration(request, params);
  if (response) return response;

  const documents = await db.migrationDocument.findMany({
    where: { migrationRequestId: migration.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ documents });
}

export async function POST(request, { params }) {
  const { response, member, migration } = await loadOwnedMigration(request, params);
  if (response) return response;

  if (!canUploadDocument(migration.status)) {
    return bad(
      `This migration is ${describeStatus(migration.status)} — documents can no longer be added.`,
      409,
    );
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
    return bad(
      "Uploads aren't configured on this deployment yet. Contact FieldQuo support.",
      503,
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || typeof file.arrayBuffer !== "function") {
    return bad("No file provided");
  }

  const verdict = classifyMigrationDocument(file);
  if (!verdict.ok) return bad(verdict.error);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadBuffer(buffer, {
      // Foldered per migration, inside the company's own namespace — same
      // "easy to find, audit and delete" reasoning /api/upload already gives
      // for company logos.
      folder: `fieldquo/companies/${member.companyId}/migrations/${migration.id}`,
      resourceType: verdict.resourceType,
    });

    const doc = await db.migrationDocument.create({
      data: {
        migrationRequestId: migration.id,
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        filename: safeFilename(file.name) || null,
        resourceType: verdict.resourceType,
        bytes: Number.isFinite(uploaded.bytes) ? uploaded.bytes : null,
        uploadedById: member.userId || null,
      },
    });

    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (err) {
    console.error("[migrations upload] Cloudinary error:", err?.message);
    return bad("That file couldn't be uploaded. Try again in a moment.", 500);
  }
}
