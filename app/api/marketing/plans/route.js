// app/api/marketing/plans/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { partitionPlans, withheldReasons } from "@/lib/platform/sellablePlans";
import { recordError } from "@/lib/platform/errorLog";

// Public — the signup page needs to show plans without a session. This is
// deliberately separate from /api/platform/billing/plans (which is platform-admin-
// only and includes internal fields like stripePriceId).
export async function GET() {
  const plans = await db.plan.findMany({
    orderBy: { priceMonthly: "asc" },
    select: {
      id: true,
      name: true,
      priceMonthly: true,
      maxUsers: true,
      maxQuotesPerMonth: true,
      aiCopilotEnabled: true,
      // ── What the signup plan step needs to price honestly ────────────────
      //
      // The ladder exists once per currency (8 rows, CAD and USD), carrying the
      // SAME NUMBER rather than a conversion. Without `currency` on this
      // payload the signup page could only render all of them at once, where
      // picking the wrong card is not a currency choice — it is a Canadian
      // volunteering to pay about 38% more. `tierKey` separates the four
      // current rungs from the legacy per-headcount rows that predate them.
      //
      // `priceAnnual` is what the "1 year commitment" option costs. Null on a
      // row means that tier has no annual option, which is why it is sent as-is
      // rather than defaulted to twelve times the monthly figure — inventing it
      // here would put a price on screen that checkout then refuses.
      currency: true,
      tierKey: true,
      priceAnnual: true,
      // Seats and crew, separately. `maxUsers` is their SUM, and describing a
      // plan by the sum is what produced "Solo — up to 6 users" followed by
      // "1 master account + 5 RBAC seats": five people the company is not
      // charged for, described as five access grants to administer. The card
      // needs both numbers to say what the plan actually is.
      seats: true,
      crewSeats: true,
      // Selected only to decide whether the plan may be OFFERED, and stripped
      // before the response — whether a rate was negotiated for one company is
      // nobody else's business and this endpoint is public.
      //
      // isPublic MUST be selected. isSellable treats a missing column as
      // "not stated" rather than "private", so that a narrow select can't
      // silently empty the pricing page — which means omitting it here would
      // have leaked the bespoke plan instead.
      //
      // stripePriceId is NOT selected any more. It was here because isSellable
      // used to test it; it no longer does (checkout builds `price_data`
      // inline), so selecting an internal identifier into a public handler and
      // then remembering to strip it again was a leak waiting for the day
      // somebody edits the spread below.
      isPublic: true,
    },
  });

  // A plan with no usable price renders fine and 500s at checkout — Stripe
  // will not create a recurring line for 0, and Plan.priceMonthly defaults to
  // 0. Offering such a row is worse than not listing it: the visitor blames
  // their card and retries.
  const { sellable, withheld, allWithheld } = partitionPlans(plans);

  // ── Nobody was being told ────────────────────────────────────────────────
  //
  // The platform admin screen printed "No Stripe price ID — checkout will
  // fail" on every plan card for weeks. Nothing turned that into a signal
  // anyone would see — and the sentence was wrong anyway, so the one person
  // who did read it went looking in the Stripe dashboard.
  //
  // This alert repeated the same wrong explanation ("all N are missing a
  // Stripe price ID"). It now names the actual reason per plan, from the same
  // function that withheld them, so the operator is sent to the field that
  // fixes it: a blank monthly price, or a plan marked private.
  //
  // Recorded once per request rather than per plan: the fault is "there is
  // nothing to sell", not four separate faults. Best-effort — a logging
  // failure must never take down the page that sells the product.
  if (allWithheld) {
    const reasons = withheldReasons(withheld);
    recordError({
      area: "billing",
      code: "no_sellable_plans",
      message:
        `The pricing page has nothing to offer: none of the ${withheld.length} ` +
        "plan(s) can be bought. Visitors are being shown the contact fallback. " +
        reasons
          .map(
            (r) =>
              `${r.name}: ${
                r.reason === "private"
                  ? "marked private"
                  : "no usable monthly price"
              }`,
          )
          .join("; "),
      detail: { withheld: reasons },
    }).catch(() => {});
  }

  return NextResponse.json({
    // isPublic dropped — it is an internal decision, not a plan attribute a
    // visitor has any use for. (stripePriceId is no longer selected at all.)
    plans: sellable.map(({ isPublic, ...plan }) => plan),
    // The signup page needs to tell "we have no plans configured" apart from
    // "these plans exist but none can be bought right now". They look
    // identical as an empty array and mean completely different things.
    unavailable: allWithheld,
  });
}
