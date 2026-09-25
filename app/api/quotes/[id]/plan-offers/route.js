// app/api/quotes/[id]/plan-offers/route.js
//
// The maintenance plans on one quote — "Add a maintenance plan" in the quote
// builder and on the quote page.
//
// GET    → the plans on this quote, each with its figures (per visit, the
//          discount, what it works out to a month and a year), the company's
//          active templates to pick from, and the tax rate this quote charges
//          (the default for a new plan's visits).
// POST   → { templateId, mode: "included"|"optional", startDate?, taxRatePct? }
//          Freezes the template's terms onto the quote in the quote's language
//          (lib/servicePlans/templates.js offerFromTemplate). Every figure is
//          read from the template row; nothing priced comes from the browser
//          except the tax rate, which is the staff member's own statement and
//          is validated like the plan form's.
// DELETE → ?offerId=… takes a plan off a quote the client has not decided.
//
// Decided quotes are read-only here, like their extras: an accepted quote's
// plan is already a running ServicePlan, and a declined one was never taken.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  requireLevel,
  requireToggle,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import {
  offerFromTemplate,
  offerPricing,
  quoteTaxRatePct,
  shapeTemplate,
  MAX_OFFERS_PER_QUOTE,
} from "@/lib/servicePlans/templates";

const DECIDED = ["accepted", "declined"];

async function gate(member, level, action) {
  const full = await loadEnforceableMember(db, member.id);
  requireLevel(full, "quotes", level, action);
  // Every row here is a price.
  requireToggle(full, "showPricing", action);
  return full;
}

/** One offer as the staff panel reads it. */
function shapeOffer(o) {
  const terms = {
    pricePerVisit: Number(o.pricePerVisit),
    discountPct: Number(o.discountPct || 0),
    taxRatePct: o.taxRatePct === null ? null : Number(o.taxRatePct),
    frequency: o.frequency,
    visitCount: o.visitCount,
  };
  return {
    id: o.id,
    templateId: o.templateId,
    mode: o.mode,
    language: o.language,
    name: o.name,
    description: o.description,
    serviceName: o.serviceName,
    startDate: o.startDate,
    selected: o.selected,
    servicePlanId: o.servicePlanId,
    ...terms,
    pricing: offerPricing(terms),
  };
}

async function loadQuote(member, id) {
  return db.quote.findFirst({
    where: { id, companyId: member.companyId },
    select: {
      id: true,
      status: true,
      language: true,
      taxEnabled: true,
      subtotal: true,
      discount: true,
      tax: true,
      client: { select: { language: true } },
      company: { select: { defaultLanguage: true } },
    },
  });
}

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    await gate(member, "view_only", "see this quote's plans");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const quote = await loadQuote(member, id);
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [offers, templates] = await Promise.all([
    db.quotePlanOffer.findMany({
      where: { quoteId: quote.id, companyId: member.companyId },
      orderBy: { sortOrder: "asc" },
    }),
    db.servicePlanTemplate.findMany({
      where: { companyId: member.companyId, active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return NextResponse.json({
    status: quote.status,
    locked: DECIDED.includes(quote.status),
    language: resolveClientLanguage({ document: quote, client: quote.client, company: quote.company }),
    companyLanguage: quote.company?.defaultLanguage || "en",
    defaultTaxRatePct: quoteTaxRatePct(quote),
    offers: offers.map(shapeOffer),
    templates: templates.map((t) => ({ ...shapeTemplate(t), pricing: offerPricing({ ...shapeTemplate(t), taxRatePct: null }) })),
    max: MAX_OFFERS_PER_QUOTE,
  });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    await gate(member, "view_create_edit", "add a plan to this quote");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const quote = await loadQuote(member, id);
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (DECIDED.includes(quote.status)) {
    return NextResponse.json(
      { error: `This quote has already been ${quote.status}. Create a new quote to change what's on offer.` },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const templateId = String(body?.templateId || "");
  const template = templateId
    ? await db.servicePlanTemplate.findFirst({ where: { id: templateId, companyId: member.companyId } })
    : null;
  if (!template) return NextResponse.json({ error: "Pick a plan to add." }, { status: 400 });

  const existing = await db.quotePlanOffer.findMany({
    where: { quoteId: quote.id },
    select: { id: true, templateId: true },
  });
  if (existing.length >= MAX_OFFERS_PER_QUOTE) {
    return NextResponse.json({ error: `A quote can carry up to ${MAX_OFFERS_PER_QUOTE} plans.` }, { status: 400 });
  }
  if (existing.some((o) => o.templateId === template.id)) {
    return NextResponse.json({ error: "That plan is already on this quote." }, { status: 409 });
  }

  const products = template.includedProductIds?.length
    ? await db.product.findMany({
        where: { companyId: member.companyId, id: { in: template.includedProductIds } },
        select: { id: true, name: true, translations: true },
      })
    : [];

  // Tax: what the staff member stated, else the rate this quote charges. An
  // explicit "" / null from the form means "no tax on the plan" and is kept.
  const statedTax = Object.hasOwn(body || {}, "taxRatePct") ? body.taxRatePct : quoteTaxRatePct(quote);

  const built = offerFromTemplate(template, {
    language: resolveClientLanguage({ document: quote, client: quote.client, company: quote.company }),
    companyLanguage: quote.company?.defaultLanguage || "en",
    products,
    mode: body?.mode,
    startDate: body?.startDate || null,
    taxRatePct: statedTax === "" ? null : statedTax,
  });
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: 400 });

  const row = await db.quotePlanOffer.create({
    data: {
      ...built.offer,
      quoteId: quote.id,
      companyId: member.companyId,
      sortOrder: existing.length,
    },
  });
  return NextResponse.json(shapeOffer(row), { status: 201 });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    await gate(member, "view_create_edit", "change this quote's plans");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const quote = await loadQuote(member, id);
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (DECIDED.includes(quote.status)) {
    return NextResponse.json(
      { error: `This quote has already been ${quote.status}. Its plans are part of what was decided.` },
      { status: 409 },
    );
  }

  const offerId = new URL(request.url).searchParams.get("offerId") || "";
  // Scoped by quote AND company; a plan already turned into a ServicePlan is
  // never removed from the record of what was sold.
  const result = await db.quotePlanOffer.deleteMany({
    where: { id: offerId, quoteId: quote.id, companyId: member.companyId, servicePlanId: null },
  });
  if (result.count !== 1) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
