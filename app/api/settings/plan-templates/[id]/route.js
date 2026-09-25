// app/api/settings/plan-templates/[id]/route.js
//
// Edit one maintenance-plan template, or retire / restore it.
//
// There is no DELETE. A template is pointed at by the quotes that offered it
// and, through them, by running plans; retiring it (active: false) stops it
// being offered and keeps every one of those records readable. Editing is safe
// for the same reason it is allowed at all: a quote froze its own copy of the
// terms (QuotePlanOffer) and a plan froze its own (ServicePlan), so a new price
// here reaches the NEXT quote and nothing already sent.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, requireToggle } from "@/lib/permissions/enforce";
import { validateTemplateInput, shapeTemplate } from "@/lib/servicePlans/templates";

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    const full = await loadEnforceableMember(db, member.id);
    requireToggle(full, "showPricing", "change maintenance plans");
    if (!["owner", "admin"].includes(member.role)) {
      const err = new Error("Only an owner or admin can change maintenance plans.");
      err.status = 403;
      throw err;
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const existing = await db.servicePlanTemplate.findFirst({
    where: { id, companyId: member.companyId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));

  // Retire / restore on its own, without re-validating the whole row — a
  // seeded template with no price yet must still be retirable.
  if (Object.keys(body || {}).length === 1 && typeof body.active === "boolean") {
    const row = await db.servicePlanTemplate.update({
      where: { id: existing.id },
      data: { active: body.active },
    });
    return NextResponse.json(shapeTemplate(row));
  }

  const products = await db.product.findMany({
    where: { companyId: member.companyId },
    select: { id: true },
  });
  const result = validateTemplateInput(
    { ...shapeTemplate(existing), ...body },
    { productIds: new Set(products.map((p) => p.id)) },
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const row = await db.servicePlanTemplate.update({
    where: { id: existing.id },
    // A cleared description is stored as an empty map ("says nothing"), not
    // left holding the old wording — Prisma will not take a bare null here.
    data: { ...result.template, description: result.template.description ?? {} },
  });
  return NextResponse.json(shapeTemplate(row));
}
