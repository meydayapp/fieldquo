// app/api/platform/suppressions/route.js
//
// FieldQuo's own do-not-contact list, for the superadmin console.
//
// ══ Superadmin only, and not through canPlatform() ═════════════════════════
//
// The same bar POST /api/platform/sales/reps sets, for the same reason: there
// is no suppression permission in PLATFORM_PERMISSIONS, and inventing one
// would imply that map has a scoping concept it does not have. What decides it
// is the shape of the action — REMOVING someone from a do-not-call list is the
// only action in this product that can put FieldQuo back in touch with a
// person who asked it to stop, and SUPERADMIN_ONLY_PERMISSIONS' own comment
// draws the line at actions that change FieldQuo's legal relationship with
// somebody. "support" and "admin" do not get this.
//
// Adding is held to the same bar. It could safely be wider — over-suppression
// is the safe failure — but a screen where one role may add and another may
// remove is a screen whose permissions have to be explained, and this one is
// small enough not to need explaining.
//
// ══ Nothing here deletes ═══════════════════════════════════════════════════
//
// There is no DELETE handler and there must not be one. PATCH performs a soft
// removal with a mandatory reason; the row and its history stay, because
// Canada's internal do-not-call obligation runs for three years and fourteen
// days past the request (see internalDncRetainUntil in
// lib/sales/suppressionRules.js) and FieldQuo keeps them past that.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import {
  importSuppressions,
  listSuppressions,
  parseSuppressionImport,
  suppress,
  unsuppress,
} from "@/lib/sales/suppression";
import { ALL_CHANNELS, SUPPRESSION_SOURCES } from "@/lib/sales/suppressionRules";

async function superadminOrRefusal(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) {
    return { admin: null, refusal: { status: 401, body: { error: "Unauthorized" } } };
  }
  if (admin.role !== "superadmin") {
    return {
      admin: null,
      refusal: {
        status: 403,
        body: {
          error:
            "Only superadmins can change FieldQuo's do-not-contact list. " +
            "Removing someone from it is the one action here that can put us " +
            "back in touch with a person who asked us to stop.",
        },
      },
    };
  }
  return { admin, refusal: null };
}

export async function GET(request) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const url = new URL(request.url);
  const { rows, total } = await listSuppressions(db, {
    query: url.searchParams.get("q") || "",
    take: Number(url.searchParams.get("take")) || 100,
    skip: Number(url.searchParams.get("skip")) || 0,
  });

  return NextResponse.json({ rows, total, sources: SUPPRESSION_SOURCES, channels: ALL_CHANNELS });
}

/**
 * Add one, or import many.
 *
 * One handler rather than two routes because they are the same write with a
 * different arity, and a bulk import that took a different code path from a
 * single add is a bulk import that would eventually normalise differently
 * from it — which for this table means a list that looks loaded and does not
 * match at send time.
 */
export async function POST(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });

  // ── Bulk ────────────────────────────────────────────────────────────────
  if (typeof body.text === "string" && body.text.trim()) {
    const { entries, errors } = parseSuppressionImport(body.text);
    if (!entries.length) {
      return NextResponse.json(
        {
          error: "Nothing in that list could be read as an email, a phone number or a domain.",
          errors,
        },
        { status: 400 },
      );
    }

    const result = await importSuppressions(db, {
      entries,
      source: "import",
      adminId: admin.id,
      reason: typeof body.reason === "string" ? body.reason.slice(0, 500) : null,
    });

    await db.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action: "sales_suppression_imported",
        details: {
          added: result.added,
          updated: result.updated,
          unreadable: errors.length,
          failed: result.failed.length,
        },
      },
    });

    // The unreadable lines are returned, not counted away. A silent "412
    // imported" over a file where 90 lines were junk would leave an operator
    // believing 90 people are suppressed who are not.
    return NextResponse.json({ ...result, unreadable: errors }, { status: 201 });
  }

  // ── One ─────────────────────────────────────────────────────────────────
  const result = await suppress(db, {
    kind: String(body.kind || "").trim(),
    value: body.value,
    channels: Array.isArray(body.channels) && body.channels.length ? body.channels : ALL_CHANNELS,
    source: String(body.source || "manual").trim(),
    reason: typeof body.reason === "string" ? body.reason.slice(0, 1000) : null,
    evidenceUrl: typeof body.evidenceUrl === "string" ? body.evidenceUrl.slice(0, 500) : null,
    adminId: admin.id,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "sales_suppression_added",
      details: {
        suppressionId: result.suppression.id,
        kind: result.suppression.kind,
        value: result.suppression.value,
        channels: result.suppression.channels,
        action: result.action,
      },
    },
  });

  return NextResponse.json(result.suppression, { status: 201 });
}

/**
 * Lift a suppression. PATCH, not DELETE, because nothing is deleted.
 *
 * The reason is required by unsuppress() itself rather than only here — the
 * rule belongs with the write, so a second caller added later cannot skip it.
 */
export async function PATCH(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });

  const result = await unsuppress(db, {
    kind: String(body.kind || "").trim(),
    value: body.value,
    adminId: admin.id,
    reason: body.reason,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  }

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "sales_suppression_removed",
      details: {
        suppressionId: result.suppression.id,
        kind: result.suppression.kind,
        value: result.suppression.value,
        reason: result.suppression.removedReason,
      },
    },
  });

  return NextResponse.json(result.suppression);
}
