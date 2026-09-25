// app/api/products/production/route.js
//
// GET — the company's service production rates, for the quote builder's
// Cost & margin panel and Services tab (lib/services/productionRates.js).
//
// ── Why not GET /api/products ─────────────────────────────────────────────
//
// That route is the price book and refuses a member without showPricing
// (it has no useful redacted form — see its header). A production rate is
// not a price: "250 sq ft an hour" tells a competitor nothing about what the
// job costs. Reading the rates off that route would have left an estimator
// who may cost a job but not see the rate card with a panel that silently
// ignored every rate, while the server's saved costing (which reads the rows
// itself, app/api/quotes/costingWrite.js) used them — two answers to "how
// long" for one quote. This route returns the rate and the service's name
// and nothing else: no unitPrice, no costPrice, no template lines.
//
// Gated like the builder that calls it: quotes at view_create_edit.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, requireLevel, permissionErrorResponse } from "@/lib/permissions/enforce";
import { sanitiseProduction } from "@/lib/services/productionRates";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "quotes", "view_create_edit", "build quotes");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const rows = await db.product.findMany({
    where: { companyId: member.companyId },
    select: { id: true, name: true, production: true },
    orderBy: { name: "asc" },
  });

  // Only rows with a usable rate, re-sanitised on the way out: a value a
  // hand-edited row holds that the sanitiser would refuse is no rate at all.
  const rates = [];
  for (const r of rows) {
    const production = sanitiseProduction(r.production);
    if (production) rates.push({ id: r.id, name: r.name, production });
  }
  return NextResponse.json(rates);
}
