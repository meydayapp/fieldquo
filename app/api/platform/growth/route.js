// app/api/platform/growth/route.js
//
// FieldQuo's own subscriber forecast, for the owner.
//
//   GET  the measured rates, the owner's assumptions, the projection (or the
//        list of rates it still needs before it can run), and the actuals by
//        month that the rates were measured from.
//   PUT  the assumptions. Platform-scoped configuration about FieldQuo's own
//        business — not a tenant's data, so non-negotiable #3 (the console
//        edits nothing of a company's) is not in play; it is still superadmin
//        only, compared on the role directly like the sales floor, because
//        PLATFORM_PERMISSIONS carries no key for FieldQuo's own numbers.
//
// The model refuses to run on a rate it does not have (growthModel.js). That
// refusal is returned as `needs`, not as a 500 and not as a chart drawn
// through a guessed 0.5: the first thing the owner sees on launch day is a
// form naming the numbers to type, which is the true state of a forecast with
// no history behind it.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { measureGrowth } from "@/lib/platform/growthMeasured";
import { project, ASSUMPTION_FIELDS, FLOORS, MILESTONES } from "@/lib/platform/growthModel";

const SINGLETON = "singleton";
const DEFAULTS = Object.freeze({ reps: 20, dialsPerRepPerDay: 150, workingDaysPerMonth: 21 });
const COUNT_KEYS = ["reps", "dialsPerRepPerDay", "workingDaysPerMonth"];
const RATE_BOUNDS = Object.freeze({ reach: 1, signup: 1, conversion: 1, churn: 1, referral: 10, organic: 1_000_000 });

async function gate(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (admin.role !== "superadmin") {
    return { error: NextResponse.json({ error: "Only superadmins can see FieldQuo's own forecast" }, { status: 403 }) };
  }
  return { admin };
}

async function loadAssumptions() {
  const row = await db.platformGrowthAssumptions.findUnique({ where: { id: SINGLETON } });
  return {
    ...DEFAULTS,
    reach: null, signup: null, conversion: null, churn: null, referral: null, organic: null,
    ...(row || {}),
    saved: Boolean(row),
  };
}

async function buildResponse() {
  const now = new Date();
  const assumptions = await loadAssumptions();
  const measured = await measureGrowth({ assumptions, now });
  let forecast = null;
  let needs = [];
  try {
    forecast = project({
      reps: assumptions.reps,
      dialsPerRepPerDay: assumptions.dialsPerRepPerDay,
      workingDaysPerMonth: assumptions.workingDaysPerMonth,
      rates: measured.rates,
      organic: measured.organic,
      startingPaying: measured.starting.paying,
      startingTrialing: measured.starting.trialing,
      listSize: measured.listSize,
      // The trial is one month (app/api/companies/route.js: 30 days); a
      // referral adds one more for the newcomer, which this rounds away.
      trialMonths: 1,
      now,
    });
  } catch (err) {
    if (!Array.isArray(err?.missing)) throw err;
    needs = err.missing;
  }
  return { assumptions, measured, forecast, needs, fields: ASSUMPTION_FIELDS, floors: FLOORS, milestones: MILESTONES, generatedAt: now.toISOString() };
}

export async function GET(request) {
  const { error } = await gate(request);
  if (error) return error;
  try {
    return NextResponse.json(await buildResponse());
  } catch (err) {
    console.error("[platform/growth] GET failed:", err);
    return NextResponse.json({ error: "Couldn't compute the forecast." }, { status: 500 });
  }
}

/**
 * Validation is by field, and a bad value names its field. Nulls clear a
 * rate (back to "the owner has not said"); the three counts cannot be null
 * because the model has no meaning without them.
 */
function validate(body) {
  const data = {};
  const problems = [];
  for (const key of COUNT_KEYS) {
    if (!(key in body)) continue;
    const v = body[key];
    if (!Number.isInteger(v) || v < 0 || v > 100_000) problems.push(`${key} must be a whole number from 0 to 100,000`);
    else data[key] = v;
  }
  for (const [key, max] of Object.entries(RATE_BOUNDS)) {
    if (!(key in body)) continue;
    const v = body[key];
    if (v === null) { data[key] = null; continue; }
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > max) problems.push(`${key} must be a number from 0 to ${max}, or null`);
    else data[key] = v;
  }
  return { data, problems };
}

export async function PUT(request) {
  const { error, admin } = await gate(request);
  if (error) return error;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Send a JSON object." }, { status: 400 });
  }
  const { data, problems } = validate(body);
  if (problems.length) return NextResponse.json({ error: problems.join("; ") }, { status: 400 });
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  try {
    await db.platformGrowthAssumptions.upsert({
      where: { id: SINGLETON },
      create: { id: SINGLETON, ...DEFAULTS, ...data, updatedByAdminId: admin.id },
      update: { ...data, updatedByAdminId: admin.id },
    });
    return NextResponse.json(await buildResponse());
  } catch (err) {
    console.error("[platform/growth] PUT failed:", err);
    return NextResponse.json({ error: "Couldn't save the assumptions." }, { status: 500 });
  }
}
