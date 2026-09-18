// app/api/platform/costs/route.js
//
// What FieldQuo pays its providers, by period — and what that buys.
//
// ══ Superadmin-only, like the floor ═══════════════════════════════════════
//
// This is FieldQuo's own bill, per rep and per agency, and per signup. It is
// the owner's number. `admin.role !== "superadmin"` is tested directly, on
// the precedent app/api/platform/sales/floor/route.js explains: the
// permission map has no scoping concept and adding one would imply it did.
//
// ══ GET reads; POST pulls ═════════════════════════════════════════════════
//
// POST { action: "pull", from?, to? } asks Twilio for its Usage Records and
// writes them — the same call the every-minute cron makes hourly, run now
// because the owner is looking. This is FieldQuo's own account, so the write
// is not a tenant's data and AGENTS.md rule 3 does not bite. Bounded to
// USAGE_MAX_RANGE_DAYS so a typo cannot ask for ten years.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { platformCostSummary, periodBounds } from "@/lib/platform/costs/summary";
import { pullTwilioUsage } from "@/lib/platform/costs/twilioUsage";
import { dayDate } from "@/lib/platform/costs/dailyLedger";

const RANGES = ["day", "week", "month", "30d", "90d", "year"];

async function gate(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (admin.role !== "superadmin") {
    return { error: NextResponse.json({ error: "Only superadmins can see what FieldQuo pays" }, { status: 403 }) };
  }
  return { admin };
}

export async function GET(request) {
  const { error } = await gate(request);
  if (error) return error;

  const url = new URL(request.url);
  const range = RANGES.includes(url.searchParams.get("range")) ? url.searchParams.get("range") : "month";
  const now = new Date();
  const bounds = periodBounds({ range, now });
  const granularity = ["day", "week", "month"].includes(url.searchParams.get("by")) ? url.searchParams.get("by") : bounds.granularity;

  try {
    const summary = await platformCostSummary({ from: bounds.from, to: bounds.to, granularity, now });
    return NextResponse.json({ ...summary, range, ranges: RANGES });
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Could not read the costs." }, { status: 503 });
  }
}

export async function POST(request) {
  const { error } = await gate(request);
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  if (body?.action !== "pull") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  const now = new Date();
  const from = body.from ? dayDate(body.from) : undefined;
  const to = body.to ? dayDate(body.to) : undefined;
  if ((body.from && !from) || (body.to && !to)) {
    return NextResponse.json({ error: "Dates are YYYY-MM-DD" }, { status: 400 });
  }
  const result = await pullTwilioUsage({ from, to, now });
  if (!result.ok) {
    return NextResponse.json({ error: `The pull did not run: ${result.reason || result.failed.join(", ")}`, ...result }, { status: 502 });
  }
  return NextResponse.json(result);
}
