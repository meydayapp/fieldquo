// app/api/settings/forecast/route.js
//
// The forecast settings anything in the product actually reads: job capacity
// (per week or per month), which lib/analytics/minimumPrice.js divides
// overhead by; the target margin it then marks the cost per job up by; and,
// since 2026-10-03, billable hours a month — the HOURLY floor's divisor
// (lib/analytics/hourlyFloor.js, read by /api/analytics/hourly-floor and the
// quote builder's warning) and, since 2026-10-04, the divisor a quote's
// overhead is shared by (the job's crew-hours ÷ these —
// lib/costing/overheadShare.js, the owner's rule).
//
// ── Why only these fields ───────────────────────────────────────────────────
//
// The ForecastSettings model has fifteen-odd columns. These are the ones read
// anywhere; the rest — conversion rates, curve coefficients, a smoothing
// alpha — are written by nothing and read by nothing. This route exposes the
// ones that have a consumer.
//
// Exposing the rest would be the mirror image of the bug it fixes: a settings
// form whose inputs save fine and change nothing. When something reads them, add
// them here and to the screen at the same time.
//
// ── The margin travels as a whole percent ───────────────────────────────────
//
// Stored as a fraction (0.25) because that is what the formula divides by;
// exposed as `targetMarginPct` (25) because that is what a person types, and
// a form that asks for "0.25" gets "25" typed into it. null means "not set"
// in both directions, and the floor then uses its 20% default — see
// resolveTargetMargin in lib/analytics/minimumPrice.js.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { recordActivity } from "@/lib/activity/log";
import { parseCapacity } from "@/lib/analytics/capacity";
import { parseBillableHours, MAX_BILLABLE_HOURS_PER_MONTH } from "@/lib/analytics/hourlyFloor";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const row = await db.forecastSettings.findUnique({
    where: { companyId: member.companyId },
    select: { jobsPerWeekCapacity: true, jobsPerMonthCapacity: true, targetMargin: true, billableHoursPerMonth: true },
  });

  return NextResponse.json({
    // null, not a number: "we don't know" is a real answer and the caller must
    // be able to tell it apart from a real capacity of zero.
    jobsPerWeekCapacity: row?.jobsPerWeekCapacity ?? null,
    // Set only when the owner answered per month; the screen then shows the
    // month, as typed, rather than the weekly figure derived from it.
    jobsPerMonthCapacity: row?.jobsPerMonthCapacity ?? null,
    targetMarginPct: toPct(row?.targetMargin),
    // The hourly floor's divisor (lib/analytics/hourlyFloor.js). null = not said.
    billableHoursPerMonth: row?.billableHoursPerMonth ?? null,
  });
}

/** 0.25 → 25; null stays null. A Prisma Decimal arrives as an object. */
function toPct(fraction) {
  if (fraction === null || fraction === undefined) return null;
  const n = Number(fraction);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/**
 * What the form typed, as the fraction the column stores — or an error.
 *
 * `undefined` means the request did not mention the margin (an older client
 * saving capacity alone) and the column is left as it is. `null` and "" mean
 * "clear it" — back to the default, which the response then reports as null
 * so the screen stops claiming a figure the owner never chose. 0 is kept: a
 * company pricing at cost said so.
 */
function parseMarginPct(raw) {
  if (raw === undefined) return { skip: true };
  if (raw === null || raw === "") return { value: null };
  if (typeof raw !== "number" && typeof raw !== "string") return { error: true };
  const n = Number(typeof raw === "string" ? raw.trim() : raw);
  if (!Number.isFinite(n) || n < 0 || n > 95) return { error: true };
  return { value: Math.round(n) / 100 };
}

export async function PUT(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (member.role !== "owner" && member.role !== "admin") {
    return NextResponse.json(
      { error: "Only an owner or admin can change this." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const cap = parseCapacity(body);
  if (cap.error) {
    return NextResponse.json({ error: cap.error }, { status: 400 });
  }
  // What the activity line and the response speak in: the unit the owner used.
  const value = cap.month !== null ? cap.month : cap.week || null;
  const unit = cap.month !== null ? "month" : "week";

  // Rejected rather than clamped, and rejected BEFORE anything is written:
  // a 120% margin silently stored as 95% is a setting the owner never chose,
  // and the capacity beside it must not save while the margin fails.
  const margin = parseMarginPct(body?.targetMarginPct);
  if (margin.error) {
    return NextResponse.json(
      { error: "Target margin must be a whole number of percent between 0 and 95." },
      { status: 400 },
    );
  }
  const marginWrite = margin.skip ? {} : { targetMargin: margin.value };

  // Billable hours a month — the hourly floor's divisor (2026-10-03,
  // lib/analytics/hourlyFloor.js). Same three readings as the margin: absent
  // leaves the column, null/"" clears it, anything else must be a whole
  // number of hours a month could hold — rejected, never clamped.
  const billable = parseBillableHours(body?.billableHoursPerMonth);
  if (billable.error) {
    return NextResponse.json(
      { error: `Billable hours must be a whole number between 1 and ${MAX_BILLABLE_HOURS_PER_MONTH}.` },
      { status: 400 },
    );
  }
  const billableWrite = billable.skip ? {} : { billableHoursPerMonth: billable.value };

  // Clearing it back to "unknown" has to be possible: the minimum-price
  // calculation refuses to answer without a capacity, and a company that isn't
  // sure should be able to say so rather than leave a guess in place.
  const saved = await db.forecastSettings.upsert({
    where: { companyId: member.companyId },
    create: {
      companyId: member.companyId,
      // 0 means "unknown", same as the update branch. Omitting the field let
      // Prisma apply @default(3), so a brand-new company that saved a BLANK
      // capacity got a fabricated 3 — and the minimum-price card then showed a
      // real dollar floor derived from a number the user never entered.
      jobsPerWeekCapacity: cap.week,
      jobsPerMonthCapacity: cap.month,
      ...marginWrite,
      ...billableWrite,
    },
    update: {
      jobsPerWeekCapacity: cap.week,
      jobsPerMonthCapacity: cap.month,
      ...marginWrite,
      ...billableWrite,
    },
    select: { jobsPerWeekCapacity: true, jobsPerMonthCapacity: true, targetMargin: true, billableHoursPerMonth: true },
  });

  const marginWords = margin.skip
    ? ""
    : `, target margin ${margin.value === null ? "not set" : `${Math.round(margin.value * 100)}%`}`;
  const hoursWords = billable.skip
    ? ""
    : `, billable hours ${billable.value === null ? "not set" : `${billable.value}/month`}`;
  await recordActivity(member, {
    action: "settings.forecast_updated",
    entityType: "settings",
    summary: `Set job capacity to ${value === null ? "not set" : `${value}/${unit}`}${marginWords}${hoursWords}`,
    metadata: {
      jobsPerWeekCapacity: cap.week || null,
      ...(cap.month !== null ? { jobsPerMonthCapacity: cap.month } : {}),
      ...(margin.skip ? {} : { targetMarginPct: toPct(margin.value) }),
      ...(billable.skip ? {} : { billableHoursPerMonth: billable.value }),
    },
  });

  return NextResponse.json({
    jobsPerWeekCapacity: saved.jobsPerWeekCapacity || null,
    jobsPerMonthCapacity: saved.jobsPerMonthCapacity ?? null,
    targetMarginPct: toPct(saved.targetMargin),
    billableHoursPerMonth: saved.billableHoursPerMonth ?? null,
  });
}
