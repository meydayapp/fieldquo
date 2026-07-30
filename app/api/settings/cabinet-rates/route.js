// app/api/settings/cabinet-rates/route.js
//
// The company's cabinet rate card, for the kitchen designer.
//
//   GET   — the current card, the defaults, and whether they've set their own
//   PUT   — save
//   DELETE— go back to the defaults
//
// Owners and admins only. This is the company's pricing; an employee who can
// build a quote has no business changing what a linear foot costs.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import {
  normaliseRates,
  DEFAULT_CABINET_RATES,
  DOOR_MATERIALS,
  BOX_MATERIALS,
} from "@/lib/kitchen/pricing";
import { hasOwnRates } from "@/lib/kitchen/rates";

async function requireAdmin(request) {
  const member = await getCurrentMember(request);
  if (!member) return { error: "Unauthorized", status: 401 };
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return { error: "Only owners and admins can change pricing.", status: 403 };
  }
  return { member };
}

export async function GET(request) {
  const { member, error, status } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { cabinetRates: true },
  });

  return NextResponse.json({
    // Normalised, so the form is never handed an undefined field to render.
    rates: normaliseRates(company?.cabinetRates),
    defaults: DEFAULT_CABINET_RATES,
    // The page says this out loud. The defaults are one real cabinet maker's
    // real prices, and a shop quoting at them without noticing is quoting
    // someone else's business.
    usingDefaults: !hasOwnRates(company?.cabinetRates),
    doorMaterials: DOOR_MATERIALS,
    boxMaterials: BOX_MATERIALS,
  });
}

export async function PUT(request) {
  const { member, error, status } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  const body = await request.json().catch(() => ({}));
  if (!body?.rates || typeof body.rates !== "object") {
    return NextResponse.json({ error: "No rates received." }, { status: 400 });
  }

  // Normalised BEFORE storage, not on the way out. Storing what the browser
  // sent and cleaning it up on every read would mean the database holds a rate
  // card nobody can price with, and the next thing to read it directly — a
  // report, an export, a migration — gets the bad copy.
  const rates = normaliseRates(body.rates);

  await db.company.update({
    where: { id: member.companyId },
    data: { cabinetRates: rates },
  });

  await recordActivity(member, {
    action: "settings.cabinet_rates_saved",
    entityType: "settings",
    summary: "Updated cabinet pricing",
    // The rate card itself, so a "why did this quote change" question later has
    // an answer. Pricing history is exactly what an activity log is for.
    metadata: { rates },
  });

  return NextResponse.json({ rates, usingDefaults: false });
}

export async function DELETE(request) {
  const { member, error, status } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  await db.company.update({
    where: { id: member.companyId },
    data: { cabinetRates: null },
  });

  await recordActivity(member, {
    action: "settings.cabinet_rates_reset",
    entityType: "settings",
    summary: "Reset cabinet pricing to the starting rates",
  });

  return NextResponse.json({ rates: normaliseRates(null), usingDefaults: true });
}
