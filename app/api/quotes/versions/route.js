// app/api/quotes/versions/route.js
//
// Quote variants — the Good / Better / Best trio that share a `tierGroupId`.
//
// This file has been empty since it was scaffolded. The name invited the
// obvious mistake: copying the invoice versioning model over. It doesn't
// apply. Invoices are versioned because they're a financial record that has
// already been sent, so amending one has to preserve what the client
// originally received. A quote before acceptance is just a draft — it's
// edited in place (see PATCH /api/quotes/[id]).
//
// What quotes *do* have is variants: three priced options presented side by
// side, linked by tierGroupId. That's what this returns.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  redactQuoteMoney,
} from "@/lib/permissions/enforce";

// Presentation order. Sorting alphabetically would put "best" first, which
// inverts the anchoring these tiers exist to create.
const TIER_ORDER = { good: 0, better: 1, best: 2 };

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const quoteId = searchParams.get("quoteId");
  const tierGroupId = searchParams.get("tierGroupId");

  if (!quoteId && !tierGroupId) {
    return NextResponse.json(
      { error: "Pass either quoteId or tierGroupId." },
      { status: 400 },
    );
  }

  let groupId = tierGroupId;

  // Given one quote, find the group it belongs to. Scoped by companyId so a
  // guessed id from another tenant resolves to nothing rather than leaking
  // that company's pricing.
  if (!groupId) {
    const quote = await db.quote.findFirst({
      where: { id: quoteId, companyId: member.companyId },
      select: { tierGroupId: true },
    });
    if (!quote)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    // A standalone quote isn't an error — it just has no siblings.
    if (!quote.tierGroupId) return NextResponse.json([]);
    groupId = quote.tierGroupId;
  }

  const variants = await db.quote.findMany({
    where: { tierGroupId: groupId, companyId: member.companyId },
    select: {
      id: true,
      quoteNumber: true,
      tierLabel: true,
      status: true,
      subtotal: true,
      total: true,
      createdAt: true,
      client: { select: { id: true, name: true } },
      scopeGroups: {
        orderBy: { sortOrder: "asc" },
        select: { label: true, subtotal: true, lineItems: true },
      },
    },
  });

  variants.sort(
    (a, b) =>
      (TIER_ORDER[a.tierLabel] ?? 99) - (TIER_ORDER[b.tierLabel] ?? 99),
  );

  // Three priced options side by side is the most concentrated pricing payload
  // in the product — the tier comparison exists to be read as money. The list
  // and detail routes redact; this one selects `subtotal`, `total` and every
  // scope group's own subtotal and line items, and had nothing.
  const full = await loadEnforceableMember(db, member.id);
  return NextResponse.json(variants.map((v) => redactQuoteMoney(full, v)));
}
