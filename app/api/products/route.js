// app/api/products/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { translateFields } from "@/lib/i18n/translateContent";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  const products = await db.product.findMany({
    where: {
      companyId: member.companyId,
      ...(q && {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      }),
    },
    orderBy: { name: "asc" },
    // Which quote types this item is linked to — empty means available on
    // every quote type. See quotes/new/page.js for where this filters what
    // shows up as an addable line item for a given category.
    include: { categories: { select: { id: true, label: true } } },
  });

  return NextResponse.json(products);
}

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, description, type, unitPrice, costPrice, unit, categoryIds } =
    body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // Draft translations for the languages this company actually sends in.
  // Awaited rather than fired-and-forgotten so the response carries them and
  // the UI can show them for review immediately — a background job would mean
  // the company saves a service, sees nothing, and has to come back later.
  //
  // Never blocks creation: translateFields returns {} on failure, so a missing
  // ANTHROPIC_API_KEY or a bad response costs the company nothing.
  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { defaultLanguage: true, sendLanguages: true },
  });

  const source = company?.defaultLanguage || "en";
  const targets = Array.isArray(company?.sendLanguages)
    ? company.sendLanguages
    : [];

  const translations = await translateFields(
    { name, description: description || "" },
    source,
    targets,
  );

  const product = await db.product.create({
    data: {
      companyId: member.companyId,
      name,
      description: description || null,
      translations: Object.keys(translations).length ? translations : undefined,
      type: type === "product" ? "product" : "service",
      unitPrice: unitPrice ?? null,
      costPrice: costPrice ?? null,
      unit: unit || null,
      ...(Array.isArray(categoryIds) && categoryIds.length > 0
        ? { categories: { connect: categoryIds.map((id) => ({ id })) } }
        : {}),
    },
    include: { categories: { select: { id: true, label: true } } },
  });

  return NextResponse.json(product, { status: 201 });
}
