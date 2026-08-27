// lib/billing/customPlan.js
//
// The one place a bespoke "Custom (N employees)" Plan row is found or made.
//
// ── Why this is a module and not two copies ────────────────────────────────
//
// Signup (app/api/companies/route.js) and the Team page's "Add licenses"
// checkout (app/api/platform/billing/checkout/route.js) both need a real Plan
// row before they can open Stripe, because Subscription.planId is required and
// no seeded tier matches an arbitrary headcount. They were two copies of the
// same upsert, and the copies had already drifted apart in the way that
// mattered most — see below.
//
// ── Bug 1: the plans editor was being silently reverted ────────────────────
//
// The checkout copy was:
//
//     db.plan.upsert({
//       where:  { name: customPlanName },
//       update: { priceMonthly: pricing.monthlyTotal, maxUsers: ... },
//       create: { ... },
//     })
//
// /platform/billing/plans has a working editor that PATCHes priceMonthly, and
// an operator using it on a Custom row got their number written back to
// calculatePricing()'s the next time anybody signed up or upgraded at that
// headcount. The editor looked live, saved, re-rendered with the new price,
// and was undone hours later by an unrelated stranger's signup. That is the
// dead-control failure AGENTS.md names, with the extra cruelty that it works
// until it doesn't.
//
// The fix is find-or-create, not upsert-and-overwrite: ONCE THE ROW EXISTS IT
// IS THE PRICE. calculatePricing() is the default used to mint the row, not a
// standing instruction to keep it in sync.
//
// The alternative — making calculatePricing() read Plan rows — was rejected.
// It is a pure synchronous function imported by app/signup/page.js and
// app/components/marketing/PricingCard.js, both of which are "use client";
// giving it a database would mean making it async and routing two client
// components through a new endpoint to render a number they already have. It
// would also invert the dependency: the ladder would then be derived from rows
// that are themselves seeded from the ladder.
//
// ── Bug 2: the upsert could no longer run at all ───────────────────────────
//
// Plan.name lost its @unique when uniqueness moved to (tierKey, currency) —
// one tier now exists once per currency. `where: { name }` is not a valid
// upsert target any more, so BOTH call sites would have thrown at runtime:
// custom-headcount signup and every "Add licenses" upgrade. findFirst + create
// is the shape that still works without a unique index.
//
// Race note, stated rather than pretended away: with no unique index, two
// simultaneous signups at the same headcount can both miss the findFirst and
// create two rows. Each subscription still points at a row carrying the right
// price, so this costs a duplicate line on the platform plans screen and
// nothing else. The previous unique index is not coming back — "Solo (CAD)"
// and "Solo (USD)" are different rows of the same tier by design.

import { db } from "@/lib/db";

/** The name a bespoke row is filed under. One spelling, used by both callers. */
export function customPlanName(employeeCount) {
  return `Custom (${employeeCount} employees)`;
}

/**
 * The Plan row for this headcount, creating it at the calculated price if it
 * does not exist yet.
 *
 * @param {{ employeeCount: number, monthlyTotal: number }} pricing
 *        the result of calculatePricing(), already checked for
 *        contactSalesRequired by the caller.
 * @returns {Promise<object>} the Plan row
 */
export async function findOrCreateCustomPlan(pricing) {
  const name = customPlanName(pricing.employeeCount);

  const existing = await db.plan.findFirst({ where: { name } });
  if (existing) return existing;

  return db.plan.create({
    data: {
      name,
      priceMonthly: pricing.monthlyTotal,
      maxUsers: pricing.employeeCount,
      // Seats, in the unit the ladder uses. maxUsers counted PEOPLE and is
      // still written because /platform/billing/plans and the company-facing
      // picker both read it; seats is what the ladder asks for. A bespoke row
      // has no free crew allowance — that is a tier feature, and inventing one
      // here would be padding absent data with a default.
      seats: pricing.employeeCount,
      crewSeats: 0,
      // ── Not on the menu ────────────────────────────────────────────────
      //
      // Defaulted true, which put "Custom (2 employees) — $90/mo" in every
      // company's plan picker with a live Choose plan button: a rate agreed
      // with one customer, offered to all of them. The schema comment on
      // Plan.isPublic records that being found and fixed for the existing row;
      // neither creator set the flag, so the next signup at a new headcount
      // would have reintroduced it.
      isPublic: false,
    },
  });
}
