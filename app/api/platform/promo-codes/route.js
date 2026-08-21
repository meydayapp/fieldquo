// app/api/platform/promo-codes/route.js
//
// Superadmin-only: mint and list influencer/tester promo codes. These give the
// company that signs up with them extra free months (no referrer, no credit to
// anyone) — see lib/platform/promoCodes.js.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { generatePromoCode } from "@/lib/platform/promoCodes";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const codes = await db.platformPromoCode.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      redemptions: {
        select: { companyId: true, redeemedAt: true, monthsGranted: true },
      },
    },
  });

  // Attach the redeeming companies' names for the list (which real business used
  // each code). A separate lookup keeps the include cheap.
  const companyIds = codes.flatMap((c) => c.redemptions.map((r) => r.companyId));
  const companies = companyIds.length
    ? await db.company.findMany({
        where: { id: { in: companyIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameById = new Map(companies.map((c) => [c.id, c.name]));

  return NextResponse.json(
    codes.map((c) => ({
      id: c.id,
      code: c.code,
      label: c.label,
      notes: c.notes,
      kind: c.kind,
      rewardMonths: c.rewardMonths,
      maxRedemptions: c.maxRedemptions,
      redeemedCount: c.redeemedCount,
      active: c.active,
      expiresAt: c.expiresAt,
      createdAt: c.createdAt,
      redemptions: c.redemptions.map((r) => ({
        companyName: nameById.get(r.companyId) || "—",
        monthsGranted: r.monthsGranted,
        redeemedAt: r.redeemedAt,
      })),
    })),
  );
}

export async function POST(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Minting free months is a superadmin action, like adding a platform teammate.
  if (admin.role !== "superadmin") {
    return NextResponse.json(
      { error: "Only superadmins can generate promo codes" },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const { label, notes, kind, rewardMonths, maxRedemptions, expiresAt } = body;

  // ── The label is the point of the feature ────────────────────────────────
  //
  // The page tells you to "generate one per person and label who you gave it
  // to". The input had no required attribute, so QA generated FQ-63XRKVEK with
  // label:null — a code for three free months that nobody can attribute to
  // anybody. Combined with there being no revoke path at the time, it was
  // untraceable AND permanent.
  //
  // Enforced here rather than only in the form, because the form is the half
  // that can be skipped.
  const trimmedLabel = String(label || "").trim();
  if (!trimmedLabel) {
    return NextResponse.json(
      {
        error:
          "Say who this code is for. Attribution is the whole point — an " +
          "unlabelled code can't be traced back to anyone.",
      },
      { status: 400 },
    );
  }

  const promo = await generatePromoCode({
    adminId: admin.id,
    label: trimmedLabel,
    notes,
    kind,
    rewardMonths,
    maxRedemptions,
    expiresAt: expiresAt || null,
  });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "promo_code_created",
      details: {
        code: promo.code,
        label: promo.label,
        kind: promo.kind,
        rewardMonths: promo.rewardMonths,
        maxRedemptions: promo.maxRedemptions,
      },
    },
  });

  return NextResponse.json(promo, { status: 201 });
}
