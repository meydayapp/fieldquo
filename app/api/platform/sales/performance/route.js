// app/api/platform/sales/performance/route.js
//
// Every number on the sales dashboard, read once.
//
// ══ Read-only, and superadmin-only ════════════════════════════════════════
//
// There is no POST, PATCH or DELETE in this file and there will not be one. A
// rep must never gain a write path to attribution or commission — the whole
// integrity of the ledger rests on a rep being unable to assert a relationship
// that did not happen (lib/sales/repStats.js's header makes the argument), and
// a dashboard is exactly the kind of screen where an "adjust" button gets added
// because it seemed convenient.
//
// Superadmin rather than canPlatform(), matching POST /api/platform/sales/reps'
// own bar and for the reason its header gives: there is no sales permission in
// PLATFORM_PERMISSIONS, and adding one would imply the permission map has a
// scoping concept it does not have. What is on this page is what FieldQuo pays
// its own staff.
//
// ══ The reads live in lib/sales/performanceLoad.js ════════════════════════
//
// Moved there on 2026-09-17 when the agency got the same page for its own
// team (app/api/sales/agency/performance): one loader, one pure composer
// (lib/sales/performanceReport.js), and the scope — null here, the team's
// ids there — applied once to every input. The arithmetic stays in modules
// that import no database, which is what lets scripts/check-sales-admin.mjs
// and scripts/check-call-qa.mjs execute every branch offline.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { loadPerformanceReport, performanceBounds } from "@/lib/sales/performanceLoad";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (admin.role !== "superadmin") {
    return NextResponse.json(
      { error: "Only superadmins can see sales performance" },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const { from, to } = performanceBounds(url.searchParams.get("preset") || "thisMonth");

  // Note what is NOT in this body: the preset key and the list of presets. The
  // screen owns the picker and validates against the same PERIOD_PRESETS the
  // loader does, so echoing either back would be a field written and never
  // read — AGENTS.md failure class 1. `period` IS returned, and IS rendered,
  // because the dates the numbers actually cover are a fact the reader needs
  // and cannot derive from a key alone.
  const report = await loadPerformanceReport({ from, to, repIds: null });
  return NextResponse.json(report);
}
