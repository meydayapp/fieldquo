// app/api/platform/plan-reads/route.js
//
// GET — the last drawing reads across every company: how long each stage
// took (lib/planRead/timing.js) and what each stage cost in tokens and vendor
// dollars (PlanRead.usage.byStep, the same counts the AiUsage rows carry).
// Shown on /platform/ai-usage under "Drawing reads".
//
// It exists to MEASURE: the 3–5 minute target and the per-read token
// assumptions in lib/planRead/billing.js (READ_TOKENS) were set on budgets,
// before any real read had run. View-only, any platform admin — nothing here
// writes, and nothing a company could be charged is computed here.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { timingSummary, timingMedians } from "@/lib/planRead/timing";

const LIMIT = 40;
const STEPS = ["sheets", "photos", "synthesis"];

function stepUsage(byStep) {
  const out = {};
  for (const k of STEPS) {
    const s = byStep?.[k];
    // Absent is null, not a row of zeros: a read with no photos had no
    // photo pass, which is not the same as one that cost nothing.
    out[k] = s
      ? {
          calls: s.calls ?? null,
          promptTokens: s.promptTokens ?? null,
          cachedTokens: s.cachedTokens ?? null,
          completionTokens: s.completionTokens ?? null,
          images: s.images ?? null,
          vendorMicros: s.vendorMicros ?? null,
        }
      : null;
  }
  return out;
}

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.planRead.findMany({
    where: { status: { not: "draft" } },
    orderBy: { updatedAt: "desc" },
    take: LIMIT,
    select: {
      id: true,
      companyId: true,
      title: true,
      status: true,
      stage: true,
      progress: true,
      usage: true,
      estimateCents: true,
      chargedCents: true,
      reservedCents: true,
      readAt: true,
      updatedAt: true,
      company: { select: { name: true } },
    },
  });

  const reads = rows.map((r) => {
    const timing = timingSummary(r.usage?.timing);
    return {
      id: r.id,
      companyId: r.companyId,
      companyName: r.company?.name || null,
      title: r.title,
      status: r.status,
      stage: r.stage,
      sheets: r.progress?.sheetsTotal ?? null,
      photos: r.progress?.photosTotal ?? null,
      timing,
      // Across every run of this read (a re-read adds to it).
      byStep: stepUsage(r.usage?.byStep),
      runVendorMicros: r.usage?.run?.vendorMicros ?? null,
      estimateCents: r.estimateCents ?? null,
      chargedCents: r.chargedCents ?? null,
      heldCents: r.reservedCents || 0,
      readAt: r.readAt,
      updatedAt: r.updatedAt,
    };
  });

  return NextResponse.json({ reads, medians: timingMedians(reads.map((r) => r.timing)), limit: LIMIT });
}
