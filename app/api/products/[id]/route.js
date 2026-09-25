// app/api/products/[id]/route.js
//
// Editing and deleting price book items. Owner/admin only — see the header on
// ../route.js for what QA found here: both verbs were completely unguarded,
// and an employee configured to see no prices at all rewrote one and deleted
// another.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { sanitiseTemplateLines, sanitiseDefaultDiscount, sanitiseImageUrl, sanitiseEstimateTypes } from "@/lib/services/templates";
import { sanitiseProduction } from "@/lib/services/productionRates";
import { scheduleAutoTranslate } from "@/lib/i18n/autoTranslateSchedule";

/** Owner/admin only, matching every other company-wide settings route. */
function requireCatalogueWrite(member) {
  if (!["owner", "admin"].includes(member.role)) {
    const err = new Error("Only an owner or admin can change the price book.");
    err.status = 403;
    throw err;
  }
}

async function assertOwnership(companyId, id) {
  const product = await db.product.findUnique({ where: { id } });
  if (!product || product.companyId !== companyId) return null;
  return product;
}

// A ServiceCategory is either seeded and shared (companyId null — the ~26
// system quote types) or custom and owned by one company. The ids arrive from a
// browser, so both cases have to be checked: an unfiltered `set` would let a
// hand-posted request attach ANOTHER TENANT'S custom quote type to a product,
// and would 500 outright on an id that doesn't exist at all.
async function usableCategoryIds(companyId, categoryIds) {
  const rows = await db.serviceCategory.findMany({
    where: {
      id: { in: categoryIds },
      OR: [{ companyId: null }, { companyId }],
    },
    select: { id: true },
  });
  return new Set(rows.map((c) => c.id));
}

export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requireCatalogueWrite(member);
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 403 },
    );
  }

  const existing = await assertOwnership(member.companyId, _params.id);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const {
    name,
    description,
    type,
    unitPrice,
    costPrice,
    unit,
    active,
    categoryIds,
    // The template inside the service (Settings > Services). Sanitised by
    // lib/services/templates.js: a line with no name is dropped, a negative
    // cost becomes null, an unknown measurement key is not stored. `null`
    // clears the column; an absent key leaves it alone.
    templateLines,
    defaultDiscount,
    imageUrl,
    // Where the template is offered (by quote type — `categoryIds` above —
    // narrowed by estimate type) and whether it is offered at all.
    estimateTypes,
    templateEnabled,
    // The service's production rate ({ key, amount, basis }, lib/services/
    // productionRates.js). Sanitised: an unknown key or a non-positive
    // amount stores nothing. `null` clears it; absent leaves it alone.
    production,
  } = body;

  if (Array.isArray(categoryIds) && categoryIds.length) {
    const usable = await usableCategoryIds(member.companyId, categoryIds);
    if (categoryIds.some((id) => !usable.has(id)))
      return NextResponse.json(
        { error: "One of those quote types isn't available to your company." },
        { status: 400 },
      );
  }

  const updated = await db.product.update({
    where: { id: _params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(type !== undefined && { type }),
      ...(unitPrice !== undefined && { unitPrice }),
      ...(costPrice !== undefined && { costPrice }),
      ...(unit !== undefined && { unit }),
      ...(active !== undefined && { active }),
      // Prisma refuses a bare null on a Json column; DbNull is how an emptied
      // template clears the column instead of leaving the old lines behind.
      ...(templateLines !== undefined && { templateLines: sanitiseTemplateLines(templateLines) ?? Prisma.DbNull }),
      ...(defaultDiscount !== undefined && { defaultDiscount: sanitiseDefaultDiscount(defaultDiscount) ?? Prisma.DbNull }),
      ...(imageUrl !== undefined && { imageUrl: sanitiseImageUrl(imageUrl) }),
      ...(estimateTypes !== undefined && { estimateTypes: sanitiseEstimateTypes(estimateTypes) }),
      ...(templateEnabled !== undefined && { templateEnabled: templateEnabled !== false }),
      ...(production !== undefined && { production: sanitiseProduction(production) ?? Prisma.DbNull }),
      // `set` fully replaces the linked quote types with this list (as
      // opposed to `connect`, which would only add) — matches how the
      // multi-select in the Products & Services edit modal works, where the
      // checked items ARE the full desired state, not just additions.
      ...(Array.isArray(categoryIds) && {
        categories: { set: categoryIds.map((id) => ({ id })) },
      }),
    },
    include: { categories: { select: { id: true, label: true } } },
  });

  // A renamed or re-described service is re-drafted into the other
  // languages after the response; a price edit alone costs nothing.
  let autoTranslate = null;
  if ((name !== undefined && name !== existing.name) || (description !== undefined && (description || "") !== (existing.description || ""))) {
    const company = await db.company.findUnique({ where: { id: member.companyId }, select: { defaultLanguage: true } });
    autoTranslate = scheduleAutoTranslate({
      companyId: member.companyId,
      model: "product",
      id: updated.id,
      fields: { name: updated.name, description: updated.description || "" },
      sourceLanguage: company?.defaultLanguage || "en",
    });
  }

  return NextResponse.json({ ...updated, autoTranslate });
}

export async function DELETE(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requireCatalogueWrite(member);
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 403 },
    );
  }

  const existing = await assertOwnership(member.companyId, _params.id);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.product.delete({ where: { id: _params.id } });
  return NextResponse.json({ ok: true });
}
