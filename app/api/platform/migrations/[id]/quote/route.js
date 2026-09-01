// app/api/platform/migrations/[id]/quote/route.js
//
// A superadmin sets the surcharge for one migration request. Superadmin only
// — "migration:quote" is in SUPERADMIN_ONLY_PERMISSIONS (see
// lib/platform/permissions.js), the same class of gate as extending a trial
// or applying billing credit: this sets a number the company is about to be
// asked to pay FieldQuo.
//
// The price is set HERE and read everywhere else — non-negotiable #5 in
// reverse: the browser never SENDS a price to be charged, but on this one
// route (staff-only, not client-facing) the browser DOES send the number that
// becomes the price, because setting it is the whole point of this screen.
// Every other route in this feature (the checkout session, the company's own
// read) only ever reads priceCents back.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { canQuote, describeStatus } from "@/lib/migrations/state";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

export async function POST(request, { params }) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return bad("Unauthorized", 401);
  try {
    requirePlatformPermission(admin.role, "migration:quote");
  } catch {
    return bad("Only a superadmin can set a migration's price.", 403);
  }

  const { id } = await params;
  const migration = await db.migrationRequest.findUnique({ where: { id } });
  if (!migration) return bad("Not found", 404);

  if (!canQuote(migration.status)) {
    return bad(
      `This migration is ${describeStatus(migration.status)} — it can't be quoted from there.`,
      409,
    );
  }

  const body = await request.json().catch(() => ({}));
  const priceCents = Math.round(Number(body?.priceCents));
  if (!Number.isFinite(priceCents) || priceCents <= 0 || priceCents > 100_000_00) {
    return bad("Enter a price greater than $0 (and under $100,000).");
  }
  const currency = String(body?.currency || migration.currency || "CAD").toUpperCase().slice(0, 3);
  const quoteNote = String(body?.quoteNote || "").trim().slice(0, 2000) || null;
  // Optional: what came up on the consultation call, if there was one.
  // Platform-only (never rendered to the company) — see the model's own
  // comment on MigrationRequest.consultationNotes. Written HERE rather than
  // its own route because quoting is the one moment a superadmin is already
  // looking at this record with the call fresh in mind; a separate "save
  // notes" button nobody uses is worse than folding it into the step that
  // already happens.
  const consultationNotes =
    body?.consultationNotes != null
      ? String(body.consultationNotes).trim().slice(0, 4000) || null
      : migration.consultationNotes;

  const updated = await db.migrationRequest.update({
    where: { id },
    data: {
      status: "quoted",
      priceCents,
      currency,
      quoteNote,
      consultationNotes,
      quotedById: admin.id,
      quotedAt: new Date(),
    },
  });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "migration_quoted",
      targetCompanyId: migration.companyId,
      details: { migrationRequestId: id, priceCents, currency },
    },
  });

  return NextResponse.json({ request: updated });
}
