// app/api/settings/subscription/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, seesBillingState } from "@/lib/billing/billingAdmin";

// Feeds the AdminSidebar TrialBadge AND the Account & Billing page.
//
// ── Two payloads, because two callers need different things ────────────────
//
// This used to return the plan name, its monthly price and its seat count to
// every active member, on the reasoning that "how many days are left" is
// harmless. The trial countdown is; what the company pays FieldQuo is not, and
// it was reaching an employee's browser on every page load whether or not they
// ever opened Account & Billing.
//
// Gating the whole endpoint would have been the obvious fix and the wrong one:
// TrialBadge renders in the sidebar of every screen, so a 403 there would kill
// the trial countdown for the crew. It reads `status` and `trialEndsAt` and
// nothing else (see TrialBadge.js), so those two stay open and the commercial
// fields are withheld — the badge keeps working, the price stops travelling.
//
// `plan.id` is in the full payload so Account & Billing can tell which plan in
// the /api/settings/plans list is the current one.
export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Impersonation sees the full record: "view everything, edit nothing"
  // (non-negotiable #3), and a support session looking at a billing question
  // seeing less than the customer does is the failure that rule exists to stop.
  const seesPlan = member.impersonation || isBillingAdmin(member.role);

  // ── The sidebar countdown is a narrower question than the billing page ──
  //
  // "47 days left" followed the caller onto every screen, for anyone created
  // through the "Manager" preset — which maps to `admin`. The owner's call:
  // how long the company's trial has to run is commercial information about
  // the BUSINESS, and a manager running crews should not learn from a sidebar
  // that their employer's software is weeks from a bill.
  //
  // Not folded into isBillingAdmin, because that gate answers a different
  // question — who may ACT on billing — and an admin at a 20-person company
  // still legitimately pays the bill. So the Account & Billing page keeps
  // working for them; only the persistent badge is owner-only. Computed on the
  // server: a client-side `role === "owner"` check is a hint, not a gate.
  const showTrialBadge = seesBillingState(member.role);

  const subscription = await db.subscription.findUnique({
    where: { companyId: member.companyId },
    select: {
      status: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      // Which cadence they are on, so the page can say "billed yearly" and
      // preselect it on an upgrade instead of quietly moving a one-year
      // company back to monthly.
      billingInterval: true,
      plan: {
        // seats and crewSeats, not just maxUsers — the card describes the plan as
        // "1 seat · 5 crew", and a field the screen reads but the route never
        // sent is how "up to 6 users" survived the first fix.
        select: {
          id: true,
          name: true,
          priceMonthly: true,
          maxUsers: true,
          seats: true,
          crewSeats: true,
          // So an annual company is quoted the number on their invoice. Showing
          // the monthly rate to somebody billed once a year is the same class
          // of wrong as "up to 6 users" — a true figure answering a question
          // nobody asked.
          priceAnnual: true,
        },
      },
    },
  });

  if (!subscription) {
    return NextResponse.json({ status: null, trialEndsAt: null, plan: null, showTrialBadge: false });
  }

  if (seesPlan) return NextResponse.json({ ...subscription, showTrialBadge });

  // ── Everyone else learns nothing about the company's billing ────────────
  //
  // This used to return status and trialEndsAt to any signed-in member, which
  // put "Trial started · 48 days left" in the sidebar of every employee on
  // every screen. QA flagged it and the owner agreed: whether the company is
  // on a trial, and how long is left, is commercial information about the
  // BUSINESS, not about the person's job.
  //
  // The badge is also a call to action — upgrade — and only a billing admin
  // can act on it. Nagging someone who cannot pay is noise at best; at worst
  // it tells a field employee their employer's software might lapse.
  //
  // Nulls rather than a 403: this is a shared endpoint the app fetches on
  // every navigation, and a 403 in the console on every page load reads as a
  // broken build. "No statement" is the honest answer here, and the badge
  // renders nothing for it.
  return NextResponse.json({ status: null, trialEndsAt: null, plan: null, showTrialBadge: false });
}
