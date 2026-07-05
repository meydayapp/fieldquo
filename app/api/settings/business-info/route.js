// app/api/settings/business-info/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: {
      name: true,
      email: true,
      phone: true,
      address: true,
      city: true,
      province: true,
      website: true,
      logoUrl: true,
      brandColor: true,
      paymentTerms: true,
      taxRate: true,
      paymentMethods: true,
      shareAnonymizedPricing: true,
      bookingSlug: true,
    },
  });

  return NextResponse.json(company);
}

export async function PATCH(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can edit business info" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const {
    name,
    email,
    phone,
    address,
    city,
    province,
    website,
    logoUrl,
    brandColor,
    paymentTerms,
    taxRate,
    paymentMethods,
    shareAnonymizedPricing,
  } = body;

  const updated = await db.company.update({
    where: { id: member.companyId },
    data: {
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(address !== undefined && { address }),
      ...(city !== undefined && { city }),
      ...(province !== undefined && { province }),
      ...(website !== undefined && { website }),
      ...(logoUrl !== undefined && { logoUrl }),
      ...(brandColor !== undefined && { brandColor }),
      ...(paymentTerms !== undefined && { paymentTerms }),
      ...(taxRate !== undefined && { taxRate }),
      ...(paymentMethods !== undefined && { paymentMethods }),
      ...(shareAnonymizedPricing !== undefined && { shareAnonymizedPricing }),
    },
  });

  return NextResponse.json(updated);
}
