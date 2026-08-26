// app/api/products/route.js
//
// The company price book — every item with its sell price AND its cost.
//
// ── Why this route has guards now ──────────────────────────────────────────
//
// It had none. Not a role check, not a grid check, on any verb. An employee
// with showPricing:false — someone the owner had deliberately configured to
// see no money anywhere — could read the entire catalogue with costs, rewrite
// a price, add an item and delete one. Found by QA probing as a real employee
// account, not by reading: PATCH set a $25 item to $99.99 and the read-back
// confirmed it.
//
// Reading is gated on showPricing, because a price book is nothing but
// prices. Writing is owner/admin, matching every other company-wide settings
// route — a rate card is a business decision, not a job.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { translateFields } from "@/lib/i18n/translateContent";
import { loadEnforceableMember, requireToggle } from "@/lib/permissions/enforce";

/** Owner/admin only. Mirrors the other settings routes. */
function requireCatalogueWrite(member) {
  if (!["owner", "admin"].includes(member.role)) {
    const err = new Error(
      "Only an owner or admin can change the price book.",
    );
    err.status = 403;
    throw err;
  }
}

function denied(err) {
  return NextResponse.json(
    { error: err.message },
    { status: err.status || 403 },
  );
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // A price book is prices. There is no useful redacted version of it, so
  // this refuses outright rather than returning rows with the numbers
  // stripped — a catalogue of names with no prices would read as a broken
  // screen rather than a boundary.
  try {
    // (db, memberId) — this passed (member), so `db` was the member object and
    // `memberId` was undefined. loadEnforceableMember returns null for a
    // missing id (deliberately: a check that can't identify the caller should
    // refuse), requireToggle(null) therefore threw, and GET /api/products
    // answered 403 to EVERYONE — the owner included.
    //
    // It looked like an empty price book rather than an error, because the
    // page ignored res.ok and rendered [] (fixed alongside this). The only
    // call site in the repo with the wrong arity; every other one already
    // passes (db, member.id).
    const full = await loadEnforceableMember(db, member.id);
    requireToggle(full, "showPricing", "see the price book");
  } catch (err) {
    return denied(err);
  }

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
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requireCatalogueWrite(member);
  } catch (err) {
    return denied(err);
  }

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
  // missing API key or a bad response costs the company nothing.
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
