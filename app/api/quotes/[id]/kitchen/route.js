// app/api/quotes/[id]/kitchen/route.js
//
// The kitchen design attached to a quote.
//
//   GET — the saved design, the company's rate card, and the client's edits
//   PUT — save the design and REPRICE the quote from it
//
// ── The design is the source, the line items are derived ───────────────────
//
// A drawn kitchen is worth nothing to the rest of the product until it is money
// on a quote. So saving a design here rewrites the cabinetry scope group in the
// same operation: draw a cabinet, and the quote total moves. Two separate
// buttons — "save design" then "update quote" — is how a quote goes out at a
// price that doesn't match the drawing attached to it.
//
// Everything else the quote carries is left alone. A kitchen quote often has
// other scope groups (a bathroom, a floor) and rewriting the whole quote from a
// kitchen drawing would delete work nobody asked to delete.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { ratesForCompany } from "@/lib/kitchen/rates";
import { kitchenLineItems, getKitchenBreakdown } from "@/lib/kitchen/pricing";
import { resolveTaxRate } from "@/lib/tax/resolveTaxRate";

// The scope group a kitchen design owns. Matched by label rather than by
// category so a company that files kitchens under "Cabinet refacing" or
// "Remodeling" still gets exactly one design-owned group rewritten instead of
// accumulating a new one on every save.
const KITCHEN_GROUP_LABEL = "Kitchen — designed";

/** The quote, if this member is allowed to see it. Scoped by company. */
async function loadQuote(member, id) {
  return db.quote.findFirst({
    where: { id, companyId: member.companyId },
    include: { scopeGroups: true },
  });
}

export async function GET(request, { params }) {
  const { id } = await params;
  const member = await getCurrentMember(request);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quote = await loadQuote(member, id);
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  const rates = await ratesForCompany(member.companyId);

  return NextResponse.json({
    quoteId: quote.id,
    quoteNumber: quote.quoteNumber,
    status: quote.status,
    // scopeDetails is where a kitchen quote's design lives. Anything else in
    // there belongs to another quote type and is not a design.
    design: quote.scopeDetails?.serviceType === "kitchen" ? quote.scopeDetails : null,
    // What the CLIENT last saved from the public designer, kept separate so the
    // contractor can see it changed rather than having it silently overwrite
    // their drawing.
    clientDesign: quote.clientKitchenConfig || null,
    clientDesignAt: quote.clientDesignAt,
    rates,
    // The share link only exists once the quote has a token — it's minted when
    // the quote is sent. Null here means "not shareable yet", which the page
    // says rather than rendering a link to nowhere.
    shareToken: quote.shareToken,
  });
}

export async function PUT(request, { params }) {
  const { id } = await params;
  const member = await getCurrentMember(request);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    requirePermission(member.role, "quote:create");
  } catch {
    return NextResponse.json(
      { error: "You don't have permission to change quotes." },
      { status: 403 },
    );
  }

  const quote = await loadQuote(member, id);
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  // A sent quote is a commercial commitment. Repricing one underneath a client
  // who is looking at it is how two people end up with different numbers for
  // the same document — the same reason Quote.language is fixed at creation.
  if (quote.status !== "draft") {
    return NextResponse.json(
      {
        error:
          "This quote has already been sent. Duplicate it to change the design.",
      },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const design = body?.design;
  if (!design || typeof design !== "object") {
    return NextResponse.json({ error: "No design received." }, { status: 400 });
  }

  // ── Priced on the SERVER, from the COMPANY's rates ──────────────────────
  //
  // Not from anything in the request. The browser sends a drawing; what a
  // drawing costs is not the browser's to decide. Same rule as add-ons.
  const rates = await ratesForCompany(member.companyId);
  const stored = { ...design, serviceType: "kitchen", rates: undefined };
  const lineItems = kitchenLineItems(stored, rates);
  const breakdown = getKitchenBreakdown(stored, rates);
  const subtotal = Number(breakdown.total.toFixed(2));

  // The category to file it under: whatever the company already uses for this
  // quote, else its first enabled cabinetry-ish service, else its first service
  // at all. A quote can't have a scope group without a category.
  const existing = quote.scopeGroups.find((g) => g.label === KITCHEN_GROUP_LABEL);
  let categoryId = existing?.categoryId || quote.scopeGroups[0]?.categoryId;
  if (!categoryId) {
    const enabled = await db.companyServiceCategory.findMany({
      where: { companyId: member.companyId, enabled: true },
      include: { category: { select: { id: true, key: true } } },
    });
    const cabinetish = enabled.find((e) =>
      /cabinet|kitchen|countertop|remodel/.test(e.category?.key || ""),
    );
    categoryId = (cabinetish || enabled[0])?.category?.id;
  }
  if (!categoryId) {
    return NextResponse.json(
      {
        error:
          "Turn on at least one service under Settings › Services & Pricing before pricing a kitchen.",
      },
      { status: 409 },
    );
  }

  await db.$transaction(async (tx) => {
    await tx.quote.update({
      where: { id: quote.id },
      data: { scopeDetails: stored, quoteType: quote.quoteType || "kitchen" },
    });

    if (existing) {
      await tx.quoteScopeGroup.update({
        where: { id: existing.id },
        data: { lineItems, subtotal },
      });
    } else {
      await tx.quoteScopeGroup.create({
        data: {
          quoteId: quote.id,
          categoryId,
          label: KITCHEN_GROUP_LABEL,
          lineItems,
          subtotal,
          sortOrder: quote.scopeGroups.length,
        },
      });
    }

    // The quote total is the sum of ALL its groups, not just this one — see the
    // note at the top about kitchens that share a quote with other work. Read
    // back inside the transaction so it reflects the write above.
    const groups = await tx.quoteScopeGroup.findMany({
      where: { quoteId: quote.id },
      select: { subtotal: true },
    });
    const quoteSubtotal = groups.reduce((s, g) => s + Number(g.subtotal || 0), 0);

    // ── Which tax rate ────────────────────────────────────────────────────
    //
    // Prefer the rate ALREADY ON THIS QUOTE, back-derived from its own
    // subtotal and tax. The rate was decided when the quote was created, from
    // the client's address, and re-resolving it on every save would let a rate
    // change in Settings silently rewrite a quote that was drafted before it.
    //
    // But a fresh quote has no prior subtotal to derive from. Deriving 0/0 as
    // "zero tax" would mean the FIRST kitchen priced on a new quote is
    // permanently untaxed — a real invoice, short by the tax, that nobody
    // notices until it's paid. So fall through to the resolver in that case,
    // which is the same one the quote builder uses.
    // `effectiveRate` is a FRACTION (0.13), not a percentage. The two forms
    // both exist in this codebase — resolveTaxRate returns 13 and the quote
    // builder divides by 100 at the point of use — so mixing them here would
    // bill a client 100× the tax. Everything below is a fraction; the resolver's
    // percentage is converted where it's read.
    const priorSubtotal = Number(quote.subtotal || 0);
    let effectiveRate = 0;
    if (quote.taxEnabled) {
      if (priorSubtotal > 0) {
        effectiveRate = Number(quote.tax || 0) / priorSubtotal;
      } else {
        const [company, taxRates, client] = await Promise.all([
          tx.company.findUnique({
            where: { id: member.companyId },
            // country and vatRegistered feed lib/tax/jurisdictions.js. Without
            // them this path resolved to the flat company default while the
            // quote builder — same resolver, fuller select — resolved to the
            // province's published rate, so the same client got two different
            // rates depending on which screen priced the job first.
            select: {
              autoApplyLocalTax: true,
              taxRate: true,
              country: true,
              vatRegistered: true,
            },
          }),
          tx.taxRate.findMany({ where: { companyId: member.companyId } }),
          tx.client.findUnique({
            where: { id: quote.clientId },
            select: { province: true, name: true, country: true },
          }),
        ]);
        effectiveRate =
          Number(resolveTaxRate({ company: company || {}, taxRates, client }).rate || 0) / 100;
      }
    }
    const discount = Number(quote.discount || 0);
    const taxable = Math.max(0, quoteSubtotal - discount);
    const tax = quote.taxEnabled ? Number((taxable * effectiveRate).toFixed(2)) : 0;

    await tx.quote.update({
      where: { id: quote.id },
      data: {
        subtotal: quoteSubtotal,
        tax,
        total: Number((taxable + tax).toFixed(2)),
      },
    });
  });

  await recordActivity(member, {
    action: "quote.kitchen_designed",
    entityType: "quote",
    entityId: quote.id,
    summary: `Priced the kitchen on ${quote.quoteNumber} — ${breakdown.linearFeet} lf`,
    metadata: { linearFeet: breakdown.linearFeet, subtotal },
  });

  return NextResponse.json({ breakdown, lineItems, subtotal });
}
