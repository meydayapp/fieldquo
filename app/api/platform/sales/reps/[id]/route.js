// app/api/platform/sales/reps/[id]/route.js
//
// Deactivating (and reactivating) a sales rep.
//
// ══ Deactivate, never delete ══════════════════════════════════════════════
//
// There is no DELETE handler in this file, and that is the decision rather than
// an omission. A rep's SalesAttribution rows say who brought each company in,
// and their SalesCommissionEntry rows say what FieldQuo owed and paid. Both are
// history, and history does not stop being true when somebody leaves. The
// schema says the same thing in its own words on SalesRep.endedAt.
//
// So `active: false` closes the door — lib/sales/gate.js re-reads this column on
// every single request, so a deactivation takes effect within one request
// rather than waiting out a twelve-hour token — and `endedAt` records when. A
// reactivation clears endedAt, because somebody who comes back has not left.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";

export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;

  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (admin.role !== "superadmin") {
    return NextResponse.json(
      { error: "Only superadmins can manage the sales team" },
      { status: 403 },
    );
  }

  const existing = await db.salesRep.findUnique({
    where: { id: _params.id },
    select: { id: true, active: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { active } = await request.json().catch(() => ({}));
  if (typeof active !== "boolean") {
    return NextResponse.json(
      { error: "active must be true or false" },
      { status: 400 },
    );
  }

  const updated = await db.salesRep.update({
    where: { id: _params.id },
    data: {
      active,
      // Only ever set alongside active: false, and cleared on the way back.
      // Leaving a stale endedAt on a reactivated rep would make canAuthenticate
      // refuse them forever — it treats endedAt as final, on purpose.
      endedAt: active ? null : new Date(),
    },
    select: {
      id: true,
      name: true,
      email: true,
      code: true,
      active: true,
      endedAt: true,
      acceptedAt: true,
    },
  });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: active ? "sales_rep_reactivated" : "sales_rep_deactivated",
      details: { salesRepId: updated.id, email: updated.email },
    },
  });

  return NextResponse.json(updated);
}
