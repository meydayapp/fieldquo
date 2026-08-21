// app/api/products/[id]/route.js
//
// Editing and deleting price book items. Owner/admin only — see the header on
// ../route.js for what QA found here: both verbs were completely unguarded,
// and an employee configured to see no prices at all rewrote one and deleted
// another.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

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
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
