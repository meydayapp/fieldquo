// app/api/settings/forecast/route.js
//
// The one forecast setting anything in the product actually reads:
// jobs-per-week capacity, which lib/analytics/minimumPrice.js divides overhead by.
//
// ── Why only one field ──────────────────────────────────────────────────────
//
// The ForecastSettings model has thirteen columns. Exactly one of them is read
// anywhere (jobsPerWeekCapacity); the other twelve — conversion rates, curve
// coefficients, a smoothing alpha — are written by nothing and read by nothing.
// This route exposes the one that has a consumer.
//
// Exposing the rest would be the mirror image of the bug it fixes: a settings
// form whose inputs save fine and change nothing. When something reads them, add
// them here and to the screen at the same time.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { recordActivity } from "@/lib/activity/log";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = await db.forecastSettings.findUnique({
    where: { companyId: member.companyId },
    select: { jobsPerWeekCapacity: true },
  });

  return NextResponse.json({
    // null, not a number: "we don't know" is a real answer and the caller must
    // be able to tell it apart from a real capacity of zero.
    jobsPerWeekCapacity: row?.jobsPerWeekCapacity ?? null,
  });
}

export async function PUT(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (member.role !== "owner" && member.role !== "admin") {
    return NextResponse.json(
      { error: "Only an owner or admin can change this." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const raw = body?.jobsPerWeekCapacity;
  const value = raw === null || raw === "" ? null : Number(raw);

  if (value !== null && (!Number.isInteger(value) || value < 1 || value > 200)) {
    return NextResponse.json(
      { error: "Jobs per week must be a whole number between 1 and 200." },
      { status: 400 },
    );
  }

  // Clearing it back to "unknown" has to be possible: the minimum-price
  // calculation refuses to answer without a capacity, and a company that isn't
  // sure should be able to say so rather than leave a guess in place.
  const saved = await db.forecastSettings.upsert({
    where: { companyId: member.companyId },
    create: {
      companyId: member.companyId,
      ...(value === null ? {} : { jobsPerWeekCapacity: value }),
    },
    update: value === null ? { jobsPerWeekCapacity: 0 } : { jobsPerWeekCapacity: value },
    select: { jobsPerWeekCapacity: true },
  });

  await recordActivity(member, {
    action: "settings.forecast_updated",
    entityType: "settings",
    summary: `Set job capacity to ${value === null ? "not set" : `${value}/week`}`,
    metadata: { jobsPerWeekCapacity: value },
  });

  return NextResponse.json({
    jobsPerWeekCapacity: saved.jobsPerWeekCapacity || null,
  });
}
