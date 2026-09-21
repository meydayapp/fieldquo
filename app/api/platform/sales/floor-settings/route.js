// app/api/platform/sales/floor-settings/route.js
//
// The floor's two tunables — the write-up window after every call and
// whether a missing outcome holds a rep in it — read by every platform
// admin, written by a superadmin. lib/sales/calls/floorSettings.js says
// what each does; the presence derivation reads them on every board draw.
//
// Superadmin writes, for the same reason the test-lines route gives: the
// number changes what every rep's dialler does after every call, and a
// zero here removes the write-up window for the whole floor. Audit-logged
// with before and after.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { AFTER_CALL_SECONDS_MAX, DEFAULT_FLOOR_SETTINGS, validateFloorSettings } from "@/lib/sales/calls/floorSettings";
import { loadFloorSettings, saveFloorSettings } from "@/lib/sales/calls/floorSettingsStore";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

async function payload() {
  return { settings: await loadFloorSettings(), defaults: DEFAULT_FLOOR_SETTINGS, max: AFTER_CALL_SECONDS_MAX, serverNow: new Date().toISOString() };
}

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return bad("Unauthorized", 401);
  return NextResponse.json(await payload());
}

export async function PUT(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  const checked = validateFloorSettings(body);
  if (!checked.ok) return bad(checked.error);

  const before = await loadFloorSettings();
  const after = await saveFloorSettings({ value: checked.value });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "sales_floor_settings_updated",
      details: { before, after },
    },
  });

  return NextResponse.json(await payload());
}
