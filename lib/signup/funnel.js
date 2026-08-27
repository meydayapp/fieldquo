// lib/signup/funnel.js
//
// The order of the signup funnel, and which step a returning visitor lands on.
//
// ══ Why the plan step moved to the end ═════════════════════════════════════
//
// It used to be first. The address — and therefore the country — is collected
// on the account/business step AFTER it, and the form seeded `country: "CA"`,
// so a contractor in Texas was shown Canadian pricing before anybody asked
// where they were, and /api/companies then defaulted them to Canada a second
// time. Plans exist once per currency now (lib/pricing/ladder.js), so the step
// that shows a price cannot run before the step that establishes which money
// the price is in.
//
// It is also the last thing before checkout, which is where the billing
// interval belongs: no-commitment monthly, or a one-year commitment billed
// annually.
//
// ══ Pure on purpose ════════════════════════════════════════════════════════
//
// Nothing here touches React, the network or storage, so the whole state
// matrix — including "a draft written under the OLD order is restored after
// the deploy" — is executable in scripts/check-signup-order.mjs rather than
// reasoned about. That path is by definition the one nobody exercises by hand.

import { resolveCountry } from "@/lib/company/resolveCountry";
import { currencyForCountry as planCurrencyForCountry } from "@/lib/pricing/ladder";
import { COUNTRIES } from "@/lib/currency";

/** The country codes the signup form actually offers. A stated country is only
 *  believed when it is one of them — "ZZ" in a hand-rolled POST body is not a
 *  country, and writing it to Company.country would put a value in the column
 *  that every later reader has to cope with. */
const OFFERED = new Set(COUNTRIES.map((c) => c.code));

/**
 * Where this business is, and therefore which money FieldQuo may price in.
 *
 * ══ Three answers, and they are not the same answer ════════════════════════
 *
 *   country null                 nobody has said where they are. ASK. This is
 *                                the whole point of moving the plan step last:
 *                                the form used to seed `country: "CA"` and the
 *                                API defaulted to "CA" again, so an American
 *                                was shown Canadian prices twice over before
 *                                anyone asked.
 *   country set, currency null   they said where they are and it is somewhere
 *                                the seat ladder has no prices for. That is a
 *                                different sentence — "we don't sell there
 *                                yet", not "we don't know where you are" — and
 *                                telling an Irish contractor we can't find
 *                                their address when they picked Ireland from a
 *                                list is the product failing to read its own
 *                                form.
 *   both set                     price the ladder in that currency.
 *
 * Nothing here infers a country from a phone number, a language or an IP.
 * lib/company/resolveCountry.js does the reading — the column, then the
 * formatted address, then the province — and this adds only the case it
 * deliberately does not cover: a country the visitor PICKED that isn't one of
 * the two the ladder prices.
 */
export function billingBasis({ country, address, province, state } = {}) {
  const read = resolveCountry({ country, address, province, state });

  const stated = String(country || "").trim().toUpperCase();
  const iso = read.country || (OFFERED.has(stated) ? stated : null);
  const source = read.country ? read.source : iso ? "column" : null;

  return {
    country: iso,
    source,
    // null for "we do not price there" AND for "we do not know" — the caller
    // tells them apart by `country`, and neither may quietly become CAD.
    planCurrency: planCurrencyForCountry(iso),
  };
}

/**
 * Every step, in the order they are walked.
 *
 * "account" and "business" are two faces of ONE step, not two: a signed-out
 * visitor creates a login and gives their business details together; someone
 * who already has a login gives the business details alone. Exactly one of them
 * is ever rendered, decided by whether a session exists.
 */
export const STEPS = ["account", "business", "industry", "services", "plan"];

/** How far along each step is. account and business share a rank because they
 *  are the same rung of the ladder wearing different clothes. */
const RANK = { account: 0, business: 0, industry: 1, services: 2, plan: 3 };

/**
 * The first step of the funnel for this visitor.
 *
 * Not a constant, because "the beginning" is a different screen depending on
 * whether they already have a login. Sending a signed-in person to the account
 * step offers them a second account they cannot create; sending a signed-out
 * one to the business step lets them fill in a company and then meet a bare 401
 * at checkout.
 */
export function firstStep({ accountExists } = {}) {
  return accountExists ? "business" : "account";
}

/**
 * The furthest step this state can actually complete.
 *
 * Each rung states what it needs, and needs everything the rungs before it
 * needed. This is the guard the doc comment on the old resumeStep recorded an
 * incident about: an unauthenticated visitor restored straight into "services"
 * reached "Continue to Payment" with no session at all and got a bare 401 from
 * /api/companies, with nothing on screen explaining which of the two missing
 * things was missing.
 *
 * @param accountExists  a login exists (they are resuming, or adding a second
 *                       business). The account step is what CREATES it, so
 *                       nothing past it is reachable without one.
 * @param companyReady   company name and address are filled in — what the
 *                       account/business step collects and what /api/companies
 *                       400s without.
 * @param hasIndustries  at least one trade picked. The services step presets
 *                       itself from these, and its own Continue is disabled
 *                       without them.
 * @param hasServices    at least one quote type picked. "Continue to Payment"
 *                       is disabled without one, so a visitor parked on the
 *                       plan step with none would be looking at a dead button.
 */
export function furthestStep({
  accountExists = false,
  companyReady = false,
  hasIndustries = false,
  hasServices = false,
} = {}) {
  const start = firstStep({ accountExists });
  if (!accountExists || !companyReady) return start;
  if (!hasIndustries) return "industry";
  if (!hasServices) return "services";
  return "plan";
}

/**
 * Which step a returning visitor should land on.
 *
 * ══ The guard that had to invert ═══════════════════════════════════════════
 *
 * This used to read `if (!hasSelection) return "plan"` — "every later step
 * prices off it". With the plan step last, nothing after it prices off it and
 * that sentence is false: the plan step is where a selection is MADE, so
 * demanding one to leave the earlier steps would trap a visitor on the last
 * screen of a funnel they had not walked. A plan selection is no longer an
 * input to this function at all.
 *
 * ══ What replaced it ═══════════════════════════════════════════════════════
 *
 * Two bounds, and the answer is the earlier of them:
 *
 *   · where they left off  — never further, or we would skip a step they were
 *     in the middle of and silently keep whatever half-answer it held;
 *   · what their state supports — never further than that either, which is the
 *     401 incident above.
 *
 * ══ Drafts written under the OLD order ═════════════════════════════════════
 *
 * A visitor mid-signup when this deploys has a draft whose saved step means
 * something different: "plan" was the BEGINNING and is now the end. They are
 * handled by the same two bounds rather than by a version stamp — a draft
 * saying "plan" with no account clamps to "account", which is both the right
 * screen under the new order and exactly where the old order would have sent
 * them next. Their chosen plan id is kept in the draft and is still selected
 * when they reach the plan step for real, so nothing they answered is lost.
 *
 * A version stamp was considered and rejected: it would have to be read by
 * something, and the something would be this same clamp. Validating against
 * the state the visitor actually has is true for a draft of any vintage,
 * including one edited by hand.
 */
export function resumeStep(saved, state = {}) {
  const start = firstStep(state);

  // A step name we don't recognise — an older draft, or one edited by hand —
  // would render none of the blocks and leave a page with a heading and nothing
  // under it. Start over instead.
  if (!STEPS.includes(saved)) return start;

  // account/business is one rung. Whichever was saved, the session decides
  // which face of it they get: someone who created their login on the account
  // step and came back must not be shown the account step again.
  const wanted = RANK[saved] === 0 ? start : saved;

  const limit = furthestStep(state);
  return RANK[wanted] <= RANK[limit] ? wanted : limit;
}

/** Where the Back button on a step goes, or null when it is the first one. */
export function previousStep(step, state = {}) {
  switch (step) {
    case "industry":
      return firstStep(state);
    case "services":
      return "industry";
    case "plan":
      return "services";
    default:
      // account and business are the entry; there is nothing behind them inside
      // the funnel, and a Back button that leaves it is how three steps of work
      // used to disappear.
      return null;
  }
}

/** The step after this one, or null at the end of the funnel. */
export function nextStep(step, state = {}) {
  switch (step) {
    case "account":
    case "business":
      return "industry";
    case "industry":
      return "services";
    case "services":
      return "plan";
    default:
      // The plan step ends in checkout, not in another step.
      return null;
  }
}
