// app/api/quotes/tier-group/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

// Creates three linked quote variants at once — Good/Better/Best — sharing a
// tierGroupId. Each is a real, independent Quote row (own line items, own total)
// so editing "Better" never touches "Good" or "Best".
export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId, tiers } = await request.json(); // tiers: { good: {...}, better: {...}, best: {...} }
  if (!clientId || !tiers?.good || !tiers?.better || !tiers?.best) {
    return NextResponse.json(
      { error: "clientId and all three tiers are required" },
      { status: 400 },
    );
  }

  const tierGroupId = crypto.randomUUID();
  const lastQuote = await db.quote.findFirst({
    where: { companyId: member.companyId },
    orderBy: { createdAt: "desc" },
    select: { quoteNumber: true },
  });

  const created = [];
  let seq = getNextQuoteNumber(lastQuote?.quoteNumber);

  for (const tierLabel of ["good", "better", "best"]) {
    const tier = tiers[tierLabel];
    const quote = await db.quote.create({
      data: {
        companyId: member.companyId,
        quoteNumber: `${seq}-${tierLabel.toUpperCase()[0]}`, // e.g. Q-2026-0012-G
        clientId,
        createdById: member.userId,
        tierGroupId,
        tierLabel,
        subtotal: tier.subtotal,
        tax: tier.tax,
        total: tier.total,
        scopeGroups: { create: tier.scopeGroups },
      },
    });
    created.push(quote);
  }

  return NextResponse.json({ tierGroupId, quotes: created }, { status: 201 });
}

function getNextQuoteNumber(lastNumber) {
  const year = new Date().getFullYear();
  if (!lastNumber) return `Q-${year}-0001`;
  const base = lastNumber.split("-").slice(0, 3).join("-");
  const match = base.match(/(\d+)$/);
  const nextSeq = match
    ? String(Number(match[1]) + 1).padStart(4, "0")
    : "0001";
  return `Q-${year}-${nextSeq}`;
}
