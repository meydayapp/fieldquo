// app/api/settings/subscription/consequences/route.js
//
// What cancelling ACTUALLY does to this company — read off their own rows.
//
// ══ Why a route and not a paragraph in the component ═══════════════════════
//
// Because the honest answer is different for every company, and a fixed
// paragraph would have to be written for the worst case. A one-man painter
// with no phone number, no service plans and nothing outstanding would be told
// his business line is about to die and his clients' cards are about to be
// charged — neither of which is true for him. He reads it, learns it is theatre,
// and skips the next warning we ever show him. That is how a warning stops
// working.
//
// So every field below is a COUNT OF SOMETHING THAT EXISTS, and the screen
// renders a sentence only when the count is non-zero. `/api/settings/subscription`
// is on the ALWAYS_WRITABLE allow-list in lib/billing/access.js, so this path is
// reachable by a company that is already read-only — which is exactly the
// company most likely to be looking at the cancel button.
//
// ══ Every field is traceable to the code that does the thing ═══════════════
//
// The rule for this file: nothing may be reported here unless a named module
// performs it. The comment on each field names that module, and
// scripts/check-cancel-consequences.mjs asserts the module still does it — not
// that the wording is unchanged, which would only ever test the wording.
//
//   immediate            lib/platform/stripeBilling.js cancelSubscription()
//                        calls stripe.subscriptions.cancel() with no
//                        cancel_at_period_end, so Stripe ends it NOW.
//   readOnlyDays         lib/billing/access.js CANCELLED_DAYS
//   phoneNumbers         app/api/cron/voice-rent/route.js selects on
//                        VoicePhoneNumber.status alone — never on the
//                        subscription — so rent keeps being taken.
//   autoTopup            app/api/cron/voice-auto-topup/route.js selects on
//                        VoiceAutoTopup.enabled alone.
//   servicePlans         app/api/cron/service-plans/route.js selects on
//                        ServicePlan.status alone; lib/servicePlans/schedule.js
//                        planBlockedReason looks at the plan, not the company.
//   unpaidInvoices       nothing gates /portal/[token] or /q/[token] on the
//                        subscription, so the pay links keep working.
//   heldBookings         lib/booking/reconcileBookingFee.js heldBookings()
//                        filters on Booking.status alone.
//   siteLive             app/site/[subdomain]/page.js serves on
//                        CompanySite.published alone.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { CANCELLED_DAYS } from "@/lib/billing/access";
import { HELD_STATUSES } from "@/lib/voice/numberRelease";
import { RENT_GRACE_DAYS } from "@/lib/voice/spendGate";
import { balanceFor } from "@/lib/voice/credits";
import { isChargeable } from "@/lib/servicePlans/authorisation";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Same gate as the cancel route itself. This tells you what your company is
  // about to lose, including what its clients still owe it — a supervisor whose
  // job is scheduling people has no business reading it off this screen.
  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  const companyId = member.companyId;

  const [numbers, autoTopup, creditCents, plans, unpaid, heldBookings, site] =
    await Promise.all([
      // Held, not just active: a `provisioning` row is a number FieldQuo has
      // already bought and is already paying the provider for, and the
      // contractor is about to walk away from it just the same.
      db.voicePhoneNumber.findMany({
        where: { companyId, status: { in: HELD_STATUSES } },
        select: { e164: true, status: true, monthlyCents: true },
      }),
      db.voiceAutoTopup.findUnique({
        where: { companyId },
        select: { enabled: true, amountCents: true, stripePaymentMethodId: true },
      }),
      balanceFor(companyId),
      // The authorisation is pulled so `isChargeable` can decide, rather than
      // this route inventing a second opinion about what a live mandate is.
      // A plan with no live mandate bills the client an invoice; a plan WITH one
      // takes money off their card unattended, which is a different sentence.
      db.servicePlan.findMany({
        where: { companyId, status: "active" },
        select: { id: true, authorisation: true },
      }),
      db.invoice.aggregate({
        where: { companyId, status: { in: ["sent", "overdue"] } },
        _count: true,
        _sum: { amountDue: true },
      }),
      db.booking.count({ where: { companyId, status: "pending_payment" } }),
      db.companySite.findUnique({
        where: { companyId },
        select: { published: true, subdomain: true },
      }),
    ]);

  const chargeable = plans.filter((p) => isChargeable(p.authorisation)).length;

  return NextResponse.json({
    // Not a date. `stripe.subscriptions.cancel()` takes no
    // cancel_at_period_end, so there is no future date to name and naming one
    // would be the lie this whole endpoint exists to stop.
    immediate: true,
    readOnlyDays: CANCELLED_DAYS,

    phoneNumbers: numbers.map((n) => ({
      e164: n.e164,
      status: n.status,
      monthlyCents: n.monthlyCents ?? 0,
    })),
    voiceCreditCents: creditCents,
    // How long the number survives once the credit can no longer cover the
    // rent. Imported rather than restated: a second copy of "7" here would be
    // the one that rots the day the grace period changes.
    rentGraceDays: RENT_GRACE_DAYS,
    autoTopup: {
      // `enabled` alone is what the cron filters on, so `enabled` alone is what
      // is reported. A row armed with a saved card is worse news and is said
      // separately rather than folded in.
      enabled: Boolean(autoTopup?.enabled),
      armed: Boolean(autoTopup?.enabled && autoTopup?.stripePaymentMethodId),
      amountCents: autoTopup?.amountCents ?? null,
    },

    servicePlans: { active: plans.length, chargeable },

    unpaidInvoices: {
      count: unpaid._count || 0,
      // Decimal → Number through valueOf, the same conversion every billing
      // screen in the product already does.
      amountDue: Number(unpaid._sum.amountDue || 0),
    },
    heldBookings,

    site: {
      live: Boolean(site?.published),
      subdomain: site?.subdomain || null,
    },
  });
}
