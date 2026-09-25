// app/api/settings/plan-templates/route.js
//
// Settings → Maintenance plans: the company's reusable plan offers.
//
// GET  → every template (active and retired — the screen shows both), the
//        company's services a plan can include, and which trades have starter
//        plans this company has not installed yet.
// POST → create one, or { action: "seed" } to install the starter plans for
//        the company's enabled trades — the same installer signup and
//        switching a trade on already run (lib/servicePlans/seedTemplates.js).
//
// Same gates as the price book (app/api/products/route.js): a template is a
// price, so reading needs showPricing and writing needs owner/admin.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, requireToggle } from "@/lib/permissions/enforce";
import { validateTemplateInput, shapeTemplate } from "@/lib/servicePlans/templates";
import { seedPlanTemplatesForTrade } from "@/lib/servicePlans/seedTemplates";
import { planTemplateSeedsForTrade } from "@/app/data/planTemplateSeeds";

function requireCatalogueWrite(member) {
  if (!["owner", "admin"].includes(member.role)) {
    const err = new Error("Only an owner or admin can change maintenance plans.");
    err.status = 403;
    throw err;
  }
}

function denied(err) {
  return NextResponse.json({ error: err.message }, { status: err.status || 403 });
}

async function readGate(member) {
  const full = await loadEnforceableMember(db, member.id);
  requireToggle(full, "showPricing", "see maintenance plans");
  return full;
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    await readGate(member);
  } catch (err) {
    return denied(err);
  }

  const [templates, products, company, enabled] = await Promise.all([
    db.servicePlanTemplate.findMany({
      where: { companyId: member.companyId },
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    db.product.findMany({
      where: { companyId: member.companyId, active: true, type: "service" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.company.findUnique({
      where: { id: member.companyId },
      select: { defaultLanguage: true, currency: true },
    }),
    db.companyServiceCategory.findMany({
      where: { companyId: member.companyId, enabled: true },
      select: { category: { select: { key: true } } },
    }),
  ]);

  // How many starter plans the company's trades carry that it doesn't hold —
  // the number on the "Add starter plans" button, and 0 hides the button
  // rather than offering a control that would add nothing.
  const held = new Set(templates.map((t) => t.seedKey).filter(Boolean));
  const missing = new Set();
  for (const row of enabled) {
    for (const s of planTemplateSeedsForTrade(row.category?.key)) {
      if (!held.has(s.seedKey)) missing.add(s.seedKey);
    }
  }

  return NextResponse.json({
    templates: templates.map(shapeTemplate),
    products,
    companyLanguage: company?.defaultLanguage || "en",
    currency: company?.currency || "CAD",
    starterMissing: missing.size,
  });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    await readGate(member);
    requireCatalogueWrite(member);
  } catch (err) {
    return denied(err);
  }

  const body = await request.json().catch(() => ({}));

  if (body?.action === "seed") {
    const enabled = await db.companyServiceCategory.findMany({
      where: { companyId: member.companyId, enabled: true },
      select: { categoryId: true, category: { select: { key: true } } },
    });
    let created = 0;
    let unpriced = 0;
    for (const row of enabled) {
      const r = await seedPlanTemplatesForTrade({
        companyId: member.companyId,
        categoryId: row.categoryId,
        categoryKey: row.category?.key,
      });
      created += r.created;
      unpriced += r.unpriced;
    }
    return NextResponse.json({ created, unpriced });
  }

  const products = await db.product.findMany({
    where: { companyId: member.companyId },
    select: { id: true },
  });
  const result = validateTemplateInput(body, { productIds: new Set(products.map((p) => p.id)) });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const count = await db.servicePlanTemplate.count({ where: { companyId: member.companyId } });
  const row = await db.servicePlanTemplate.create({
    data: {
      ...result.template,
      description: result.template.description || undefined,
      companyId: member.companyId,
      sortOrder: count,
    },
  });
  return NextResponse.json(shapeTemplate(row), { status: 201 });
}
