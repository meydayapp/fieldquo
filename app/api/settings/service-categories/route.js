// app/api/settings/service-categories/route.js
export const runtime = "nodejs";

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember"; // resolves session -> { companyId, role }
import { toStoredFields } from "@/app/data/intakeFieldLibrary";

// GET — system catalog + this company's own custom quote types, merged with
// this company's settings (enabled/rate/unit). Custom categories are scoped
// by companyId so one company never sees another's — a system category has
// companyId: null and is visible to everyone; a custom one only shows up
// for the company that created it.
export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const categories = await db.serviceCategory.findMany({
    where: { OR: [{ isSystem: true }, { companyId: member.companyId }] },
    orderBy: { sortOrder: "asc" },
    include: {
      companySettings: { where: { companyId: member.companyId } },
    },
  });

  const merged = categories.map((c) => {
    const setting = c.companySettings[0] || null;
    return {
      id: c.id,
      key: c.key,
      label: c.label,
      icon: c.icon,
      isSystem: c.isSystem,
      customFields: c.customFields || null,
      enabled: setting?.enabled ?? false,
      pricingModel: setting?.pricingModel ?? "flat",
      defaultRate: setting?.defaultRate ?? null,
      unit: setting?.unit ?? null,
    };
  });

  return NextResponse.json(merged);
}

// POST — create a custom (company-owned) quote type: a name plus a subset of
// fields chosen from the shared library (app/data/intakeFieldLibrary.js),
// rather than a from-scratch form builder. Auto-enabled immediately since
// there's no reason to create one you can't use yet — from then on it's
// toggled/priced through the same PATCH below as any system category.
export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!["owner", "admin"].includes(member.role)) {
    return NextResponse.json(
      { error: "Only owners/admins can change settings" },
      { status: 403 },
    );
  }

  const { label, fieldKeys } = await request.json();
  if (!label?.trim()) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  const customFields = toStoredFields(
    Array.isArray(fieldKeys) ? fieldKeys : [],
  );

  const category = await db.serviceCategory.create({
    data: {
      // Never user-typed — sidesteps any risk of colliding with the ~26
      // seeded system keys or another company's custom key, since `key`
      // stays globally unique across every ServiceCategory row.
      key: `custom_${randomUUID()}`,
      label: label.trim(),
      isSystem: false,
      companyId: member.companyId,
      customFields,
      companySettings: {
        create: { companyId: member.companyId, enabled: true },
      },
    },
  });

  return NextResponse.json(
    {
      id: category.id,
      key: category.key,
      label: category.label,
      icon: null,
      isSystem: false,
      customFields: category.customFields,
      enabled: true,
      pricingModel: "flat",
      defaultRate: null,
      unit: null,
    },
    { status: 201 },
  );
}

// PATCH — bulk upsert company's category settings
// body: { categories: [{ categoryId, enabled, pricingModel, defaultRate, unit }] }
export async function PATCH(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!["owner", "admin"].includes(member.role)) {
    return NextResponse.json(
      { error: "Only owners/admins can change settings" },
      { status: 403 },
    );
  }

  const { categories } = await request.json();
  if (!Array.isArray(categories)) {
    return NextResponse.json(
      { error: "categories array required" },
      { status: 400 },
    );
  }

  const results = await Promise.all(
    categories.map((c) =>
      db.companyServiceCategory.upsert({
        where: {
          companyId_categoryId: {
            companyId: member.companyId,
            categoryId: c.categoryId,
          },
        },
        update: {
          enabled: c.enabled,
          pricingModel: c.pricingModel || "flat",
          defaultRate: c.defaultRate ?? null,
          unit: c.unit || null,
        },
        create: {
          companyId: member.companyId,
          categoryId: c.categoryId,
          enabled: c.enabled,
          pricingModel: c.pricingModel || "flat",
          defaultRate: c.defaultRate ?? null,
          unit: c.unit || null,
        },
      }),
    ),
  );

  return NextResponse.json({ success: true, updated: results.length });
}
