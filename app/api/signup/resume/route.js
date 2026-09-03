// app/api/signup/resume/route.js
//
// One question, answered on the server: is the caller sitting on a company
// that was created but never paid for, and may THEY be the one to pay?
//
// ── Why this isn't three fetches on the page ───────────────────────────────
//
// /signup could have inferred it: /api/settings/business-info answering 200
// means a company exists, and /api/settings/subscription answering with a null
// status means... two different things. That route returns nulls to anyone who
// is not a billing admin, deliberately — an employee must not learn the
// company's plan from a sidebar — so "status: null" reads identically for a
// company with no subscription and for an estimator at a company that has one.
// Building the resume flow on that would have rendered "Continue to Payment"
// for an estimator, whose POST /api/platform/billing/checkout then 403s. A
// button that looks like it works and doesn't is the one thing this codebase
// is most swept for.
//
// So: one endpoint, one answer, and the same isBillingAdmin gate the checkout
// route itself applies — not a second copy of the rule that can drift from it.
//
// A GET, so nothing here needs the billing allow-list in lib/billing/access.js:
// reads are permitted in every state. And a company in this state has no
// Subscription row at all, which accessFor() grants full access for anyway.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin } from "@/lib/billing/billingAdmin";

/** The one shape, so both exits say the same thing in the same words. */
const NOTHING_TO_RESUME = { resume: false };

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  // 401 for a session with no company at all. That is a DIFFERENT abandoned
  // state — no company was ever created — and /signup already handles it from
  // its own session check. Passing the refusal through unchanged keeps the two
  // apart rather than merging them into one ambiguous "no".
  if (response) return response;

  // A support session must never be offered a customer's checkout. Reads are
  // fine (non-negotiable #3 is "view everything, edit nothing"), but this
  // answer exists to put a Pay button on a screen, and the write behind that
  // button is exactly what impersonation refuses.
  if (member.impersonation) return NextResponse.json(NOTHING_TO_RESUME);

  if (!isBillingAdmin(member.role)) return NextResponse.json(NOTHING_TO_RESUME);

  const [company, subscription] = await Promise.all([
    db.company.findUnique({
      where: { id: member.companyId },
      select: {
        name: true,
        phone: true,
        address: true,
        city: true,
        province: true,
        country: true,
        defaultLanguage: true,
        isDemo: true,
        // Whether the free month they were promised still has time on it.
        // /api/platform/billing/checkout only carries trial days onto Stripe
        // when this is in the FUTURE, so a page that says "first month free"
        // regardless would be promising something the charge won't honour.
        trialEndsAt: true,
      },
    }),
    db.subscription.findUnique({
      where: { companyId: member.companyId },
      select: { id: true },
    }),
  ]);

  if (!company || company.isDemo || subscription) {
    return NextResponse.json(NOTHING_TO_RESUME);
  }

  return NextResponse.json({
    resume: true,
    // The company's own details, so the plan step can price in the right
    // currency for somebody resuming on a different device, where the
    // sessionStorage draft that normally carries the address does not exist.
    // Read from the row, never defaulted — Company.country is a tax
    // jurisdiction and a currency, and padding it is padding a price.
    company: {
      name: company.name,
      phone: company.phone,
      address: company.address,
      city: company.city,
      province: company.province,
      country: company.country,
      language: company.defaultLanguage,
      trialEndsAt: company.trialEndsAt,
    },
  });
}
