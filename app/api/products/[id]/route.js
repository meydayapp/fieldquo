// app/api/products/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

async function assertOwnership(companyId, id) {
  const product = await db.product.findUnique({ where: { id } });
  if (!product || product.companyId !== companyId) return null;
  return product;
}

export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const existing = await assertOwnership(member.companyId, _params.id);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.product.delete({ where: { id: _params.id } });
  return NextResponse.json({ ok: true });
}
