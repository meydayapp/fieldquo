// app/api/marketing/plans/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { partitionPlans, withheldReasons, isRetired } from "@/lib/platform/sellablePlans";
import { recordError } from "@/lib/platform/errorLog";
import { ensureCustomPlan } from "@/lib/billing/customPlan";
import { customSeatsFromTierKey, SUPPORTED_CURRENCIES } from "@/lib/pricing/ladder";

// Public — the signup page needs to show plans without a session. This is
// deliberately separate from /api/platform/billing/plans (which is platform-admin-
// only and includes internal fields like stripePriceId).
export async function GET(request) {
  // ── An unlisted plan, reachable by its link only ─────────────────────────
  //
  // A private plan (isPublic = false) is kept off the pricing page and off
  // the picker — a bespoke rate, or the owner's own live test — but a link
  // carrying `?plan=<id>` is a deliberate hand-off: the person who received
  // it was told about that plan. It is returned to THAT request alone,
  // flagged `unlisted`, with the same money rules as any other row (a plan
  // with no usable price is still withheld). Nothing changes for a request
  // without the parameter, which is every visit to the pricing page.
  const query = new URL(request.url).searchParams;
  const wantedPlanId = query.get("plan") || null;

  // ── "/signup?tier=custom-20" from the pricing page's fifth card ─────────
  //
  // A custom size is a Plan row that may not exist yet. Asked for by tier,
  // it is found-or-created here in BOTH currencies — the visitor's address is
  // three steps away, and resolvePlanSelection on the signup page picks the
  // row of whichever currency that turns out to be, exactly as it does for a
  // rung. Bounded: only the thirty-seven sellable sizes are accepted, so a
  // stranger hammering this with counts cannot mint anything else, and a
  // count outside the range is simply not asked for. A currency whose ladder
  // was never seeded is skipped rather than invented.
  const wantedCustomSeats = customSeatsFromTierKey(query.get("tier"));
  if (wantedCustomSeats) {
    for (const currency of SUPPORTED_CURRENCIES) {
      try {
        await ensureCustomPlan({ seats: wantedCustomSeats, currency });
      } catch (err) {
        if (err?.status !== 400) throw err;
      }
    }
  }

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
      // Same rule, same reason: a retired plan read without this column would
      // read as not retired and sell by link again. Stripped below.
      retiredAt: true,
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
                  : r.reason === "retired"
                    ? "retired"
                    : "no usable monthly price"
              }`,
          )
          .join("; "),
      detail: { withheld: reasons },
    }).catch(() => {});
  }

  // ── …unless it has been retired ──────────────────────────────────────────
  //
  // The link hand-off is for a plan that is private, not for one that is
  // gone. The owner's "Live test — $1" was private, and private alone left
  // it buyable at $1 by anyone holding the link. A retired plan is refused
  // here by the same predicate every sell route uses (isRetired), and the
  // refusal is SAID — `refused` below — so the signup page can tell the
  // visitor the plan they were sent is no longer offered and show them the
  // current ones, rather than silently landing them on a step with nothing
  // selected.
  const wanted = wantedPlanId ? plans.find((p) => p.id === wantedPlanId) || null : null;
  const refused = wanted && isRetired(wanted) ? { planId: wanted.id, reason: "retired" } : null;
  const unlisted =
    wantedPlanId && !refused
      ? withheld.find(
          (p) => p.id === wantedPlanId && p.isPublic === false && Number(p.priceMonthly) > 0,
        )
      : null;
  // The custom size's rows, one per currency, offered by link like any other
  // unlisted plan. The signup page chooses between them by address.
  const customRows = wantedCustomSeats
    ? withheld.filter(
        (p) =>
          p.tierKey === `custom-${wantedCustomSeats}` &&
          p.isPublic === false &&
          !isRetired(p) &&
          Number(p.priceMonthly) > 0,
      )
    : [];

  // isPublic and retiredAt dropped — both are internal decisions, not plan
  // attributes a visitor has any use for. (stripePriceId is no longer
  // selected at all.)
  const publicShape = ({ isPublic, retiredAt, ...plan }) => plan;

  return NextResponse.json({
    plans: [
      ...sellable.map(publicShape),
      ...(unlisted ? [{ ...publicShape(unlisted), unlisted: true }] : []),
      ...customRows.map((p) => ({ ...publicShape(p), unlisted: true })),
    ],
    // The signup page needs to tell "we have no plans configured" apart from
    // "these plans exist but none can be bought right now". They look
    // identical as an empty array and mean completely different things.
    unavailable: allWithheld,
    // Why the plan the link asked for is not in the list, when it is not.
    // Null on every request without ?plan=, and on one whose plan is fine.
    refused,
  });
}
