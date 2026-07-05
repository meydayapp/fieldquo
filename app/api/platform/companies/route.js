// app/api/platform/companies/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const q = searchParams.get("q");

  const companies = await db.company.findMany({
    where: {
      ...(status && { onboardingStatus: status }),
      ...(q && { name: { contains: q, mode: "insensitive" } }),
    },
    include: {
      subscription: { include: { plan: { select: { name: true } } } },
      _count: { select: { members: true, quotes: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(companies);
}

// Manual company creation — used before self-serve signup exists, or for
// white-glove onboarding of early customers
export async function POST(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, slug, email, ownerEmail, ownerName } = body;

  if (!name || !slug || !ownerEmail || !ownerName) {
    return NextResponse.json(
      { error: "name, slug, ownerEmail, and ownerName are required" },
      { status: 400 },
    );
  }

  const existingSlug = await db.company.findUnique({ where: { slug } });
  if (existingSlug) {
    return NextResponse.json(
      { error: "That slug is already taken" },
      { status: 409 },
    );
  }

  const company = await db.company.create({
    data: { name, slug, email: email || null, onboardingStatus: "pending" },
  });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "company_created",
      targetCompanyId: company.id,
      details: { name, slug },
    },
  });

  // Note: this creates the Company record only — the actual owner still needs to
  // complete their own signup (Better Auth account + organization) to log in.
  // Consider sending ownerEmail an invite link here once the signup flow exists.

  return NextResponse.json(company, { status: 201 });
}
