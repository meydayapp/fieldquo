// app/api/quotes/tier-group/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";
// The shared allocator, which is suffix-aware since 2026-09-06. This route
// carried its own copy that understood the "-G" suffix while the shared one
// did not — the copy that nobody looked at was the correct one, and the one
// every other route used was the one that rotted. One allocator now.
import { getNextQuoteNumber, TIER_SUFFIXES, LIVE_QUOTE_NUMBER_WHERE } from "@/lib/quotes/quoteNumber";

// Creates three linked quote variants at once — Good/Better/Best — sharing a
// tierGroupId. Each is a real, independent Quote row (own line items, own total)
// so editing "Better" never touches "Good" or "Best".
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Three quotes, and until now no grid check of any kind — POST /api/quotes
  // has required view_create_edit for a long time and this sibling, which
  // creates three at once, asked nothing at all.
  const { response: denied } = await levelOrRefusal(
    member,
    "quotes",
    "view_create_edit",
    "create quotes",
  );
  if (denied) return denied;

  const { clientId, tiers } = await request.json(); // tiers: { good: {...}, better: {...}, best: {...} }
  if (!clientId || !tiers?.good || !tiers?.better || !tiers?.best) {
    return NextResponse.json(
      { error: "clientId and all three tiers are required" },
      { status: 400 },
    );
  }

  // Three quotes, one unchecked clientId — the same hole as POST /api/quotes
  // and worse for being multiplied by three. See lib/tenant/ownedIds.js.
  const notOurs = await ownedIdsRefusal(NextResponse, db, member.companyId, { clientId });
  if (notOurs) return notOurs;

  const tierGroupId = crypto.randomUUID();
  // Distinct by construction. `tierLabel.toUpperCase()[0]` gave "B" for BOTH
  // better and best — the third create collided on the unique quoteNumber
  // and the route 500'd after writing two of three. Also exported for the
  // check that executes the allocator against these suffixes.
  const TIER_SUFFIX = TIER_SUFFIXES;
  const lastQuote = await db.quote.findFirst({
    // Historical rows carry their own series — see lib/quotes/quoteNumber.js.
    where: { companyId: member.companyId, ...LIVE_QUOTE_NUMBER_WHERE },
    orderBy: { createdAt: "desc" },
    select: { quoteNumber: true },
  });

  const seq = getNextQuoteNumber(lastQuote?.quoteNumber);

  // Three rows, one transaction: the first version created them one by one,
  // and when the third collided (below) the client was left with two of a
  // trio and a 500. All or nothing.
  const created = await db.$transaction(async (tx) => {
    const out = [];
    for (const tierLabel of ["good", "better", "best"]) {
      const tier = tiers[tierLabel];
      const quote = await tx.quote.create({
        data: {
          companyId: member.companyId,
          quoteNumber: `${seq}-${TIER_SUFFIX[tierLabel]}`, // e.g. Q-2026-0012-G
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
      out.push(quote);
    }
    return out;
  });

  return NextResponse.json({ tierGroupId, quotes: created }, { status: 201 });
}
