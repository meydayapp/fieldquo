// app/api/settings/plans/route.js
//
// GET /api/platform/billing/plans exists already but is gated to platform
// admins only — a regular company member can't call it, so there was no way
// for the Account & Billing page to show "here's what you can upgrade to."
// This is the company-facing read-only equivalent.
//
// Narrowed from "any active member" to the people who can act on it. Account &
// Billing is its only caller and every button on that page is isBillingAdmin;
// a list of plans and prices someone can't buy is not information they need,
// and it was the second half of the leak fixed in ../subscription/route.js —
// withholding the current plan while still handing over the price list would
// have been a gate in name only.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { currencyForCountry } from "@/lib/pricing/ladder";
import { resolveCountry } from "@/lib/company/resolveCountry";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Support sessions see it — non-negotiable #3, same as the subscription read.
  if (!member.impersonation && !isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  // ── Bespoke plans are not on the menu ──────────────────────────────────
  //
  // This returned every Plan row, so "Custom (2 employees) — $90/mo" — a rate
  // negotiated with one company — rendered in every company's picker with a
  // live Choose plan button. A customer could move themselves onto somebody
  // else's deal.
  //
  // The caller's CURRENT plan is always included even when it isn't public:
  // two companies are on that Custom plan, and a billing page that cannot name
  // the plan you are paying for is broken in a more obvious way.
  const subscription = await db.subscription.findUnique({
    where: { companyId: member.companyId },
    select: { planId: true },
  });

  // ── One currency, decided by the address ────────────────────────────────
  //
  // The ladder exists twice, once per currency, and the two rows carry the SAME
  // NUMBER rather than a conversion. So showing both put "Solo (CAD) $129" next
  // to "Solo (USD) $129" in one list, where picking the wrong one is not a
  // currency choice — it is a Canadian volunteering to pay about 38% more, or an
  // American paying about 27% less. lib/pricing/ladder.js refuses to make that
  // selectable and this is the screen that would have made it selectable anyway.
  //
  // A company whose country we do not hold sees the ladder in neither currency
  // rather than in CAD by default: three of the companies here have no country,
  // and defaulting them would be padding absent data with a price. They are
  // shown the same "tell us where you are" state the checkout uses.
  // The address, not just the column. A company that signed up before the
  // country component was carried through from AddressAutocomplete has a null
  // `country` and a complete address — "1039 Bank St, Ottawa, ON K1X 1H4,
  // Canada" — sitting in the columns beside it. Asking that company where their
  // business is, while Company Settings displays the answer, is the product
  // being unable to read its own record.
  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { country: true, address: true, province: true },
  });
  const currency = currencyForCountry(resolveCountry(company).country);

  const plans = await db.plan.findMany({
    where: {
      // Their own plan is always visible, whatever its currency or visibility —
      // a billing page that cannot name the plan you are paying for is broken in
      // a more obvious way than one showing a row it should not sell.
      OR: [
        {
          isPublic: true,
          ...(currency ? { OR: [{ currency }, { currency: null }] } : {}),
        },
        ...(subscription?.planId ? [{ id: subscription.planId }] : []),
      ],
    },
    orderBy: { priceMonthly: "asc" },
  });

  // `currency: null` is reported so the screen can say WHY the ladder is
  // missing instead of rendering an empty list, which reads as an outage.
  return NextResponse.json({ plans, currency });
}
