// lib/pricing/seatLimit.js
//
// Whether a company may take another seat.
//
// ══ Why it blocks rather than auto-charging ════════════════════════════════
//
// The alternative was to add a seat at the extra-seat price and tell them
// afterwards. That is friendlier at the moment of hiring and it is somebody's
// money moving without them pressing anything — the sort of charge that comes
// back as a chargeback and a support thread about what the software did on its
// own. Blocking is reversible in one click; an unexpected debit is not.
//
// So it refuses, and the refusal has to be worth reading: which tier they are
// on, how many seats that is, who is already holding them, and what the next
// tier costs. A refusal that just says "limit reached" makes somebody go and
// count the team by hand.
//
// ══ Nobody is ever locked out by this ══════════════════════════════════════
//
// It gates ADDING a seat, never holding one. A company already over its limit —
// which is every company today, because this shipped after the plans did —
// keeps every person working. They are told, and they are stopped from adding
// a sixth, not cut down to one.

import { countSeats, isBillableSeat, SEAT_LADDER, EXTRA_SEAT_PRICE } from "./ladder";

/**
 * The arithmetic at the centre of both functions below: given how many seats
 * and crew are already spoken for, does one more billable person or one more
 * crew person fit? Pulled out on its own so seatCheck() (roster-shaped, used
 * by the server) and seatFits() (counts-shaped, safe to run in a browser
 * without a roster query) cannot drift into two different answers to "is
 * there room" — which is exactly the failure this file exists to prevent.
 */
function seatMath({ seatsUsed, crewUsed, seatsAllowed, crewAllowed, addsSeat, addsCrew }) {
  const seatsAfter = seatsUsed + (addsSeat ? 1 : 0);
  const crewAfter = crewUsed + (addsCrew ? 1 : 0);

  const seatBlocked = addsSeat && seatsAllowed !== null && seatsAfter > seatsAllowed;

  // ── Crew may sit in an unused SEAT ────────────────────────────────────────
  //
  // This was `crewAfter > crewAllowed`, two separate buckets. The owner caught
  // it on the ladder: "we also have the 10 seats. 10 seats and 15 crews is
  // equal to 25." A seat holder has strictly MORE access than a crew member,
  // so a field worker in a spare seat is over-provisioning, never a breach —
  // and a company of twenty-two on Scale was being refused its sixteenth crew
  // member while eight of its ten seats sat empty.
  //
  // Kept in step with tierFor() in lib/pricing/ladder.js deliberately: if the
  // ladder says a tier fits and this refuses the person, the upgrade prompt
  // points at a plan the customer is already on. Both now ask the same
  // question — do the BILLABLE people have real seats, and does the whole team
  // fit the whole allowance.
  //
  // The seat rule above is untouched, and it is what stops this collapsing
  // into "any 25 people for $369": a billable person still needs a real seat,
  // and crew cannot absorb one. The absorption only runs the other way.
  const spareSeats = seatsAllowed === null ? Infinity : Math.max(0, seatsAllowed - seatsAfter);
  const crewBlocked =
    addsCrew && crewAllowed !== null && crewAfter > crewAllowed + spareSeats;

  return { seatsAfter, crewAfter, seatBlocked, crewBlocked };
}

/**
 * @param roster   active members, each { role, permissions }
 * @param plan     the company's Plan row, or null while they have no plan
 * @param incoming the member about to be created or promoted, same shape.
 *                 Omit to ask "where do they stand right now".
 * @returns {{ allowed, seatsUsed, seatsAllowed, over, wouldAdd, tier, nextTier,
 *             extraSeatPrice, reason }}
 */
export function seatCheck({ roster = [], plan = null, incoming = null } = {}) {
  const counted = countSeats(roster);
  const seatsAllowed = plan?.seats == null ? null : Math.max(0, Number(plan.seats) || 0);

  // A plan that states no seat count cannot be exceeded. Every legacy row is in
  // that position and none of them was sold with a seat promise, so inventing a
  // limit for them would be enforcing a term nobody agreed to.
  if (seatsAllowed === null) {
    return {
      allowed: true,
      seatsUsed: counted.seats,
      seatsAllowed: null,
      over: 0,
      wouldAdd: false,
      tier: null,
      nextTier: null,
      extraSeatPrice: EXTRA_SEAT_PRICE,
      reason: "no_seat_limit",
    };
  }

  // ── Both caps, because crew are free and still counted ───────────────────
  //
  // An earlier version of this only gated seats, on the reasoning that crew
  // cost nothing so nothing should stop them. That is wrong about the product:
  // a tier is "1 seat and 5 crew", not "1 seat and as many crew as you like".
  // Free is not unlimited, and a sixth crew member on Solo is the moment to
  // offer Crew — which is the tier that exists for it.
  const crewAllowed = plan?.crewSeats == null ? null : Math.max(0, Number(plan.crewSeats) || 0);
  const addsSeat = Boolean(incoming) && isBillableSeat(incoming);
  const addsCrew = Boolean(incoming) && !addsSeat;

  const { seatsAfter, crewAfter, seatBlocked, crewBlocked } = seatMath({
    seatsUsed: counted.seats,
    crewUsed: counted.crew,
    seatsAllowed,
    crewAllowed,
    addsSeat,
    addsCrew,
  });

  const tier = SEAT_LADDER.find((t) => t.tierKey === plan?.tierKey) || null;
  // The smallest rung that fits them AFTER the person they are adding. Null
  // means the top of the ladder is not enough either, which is a conversation
  // rather than an upgrade button.
  const nextTier =
    SEAT_LADDER.find(
      (t) =>
        t.seats >= seatsAfter &&
        t.seats + t.crewSeats >= seatsAfter + crewAfter,
    ) || null;

  return {
    allowed: !(seatBlocked || crewBlocked),
    seatsUsed: counted.seats,
    seatsAllowed,
    crewUsed: counted.crew,
    crewAllowed,
    over: Math.max(0, counted.seats - seatsAllowed),
    crewOver: crewAllowed === null ? 0 : Math.max(0, counted.crew - crewAllowed),
    wouldAdd: addsSeat || addsCrew,
    addsSeat,
    tier,
    nextTier,
    extraSeatPrice: EXTRA_SEAT_PRICE,
    // Which cap was hit, so the message can name the right one. A person told
    // "you are out of seats" while trying to add a painter goes looking for a
    // seat they did not want.
    reason: seatBlocked ? "seat_limit" : crewBlocked ? "crew_limit" : "ok",
  };
}

/**
 * The same question as seatCheck(), asked without a roster query — for a
 * PICKER that already has a `seats` summary in hand (GET
 * /api/settings/members/pending's response shape: `{ used, crew, seatCap,
 * crewCap }`) and just wants to know whether ONE candidate role/permission
 * grid is worth offering.
 *
 * This is not a second implementation of the rule — seatMath() above is the
 * only place the arithmetic lives, and this function and seatCheck() both
 * call it. A picker that computed its own version of "is there room" is
 * exactly how the onboarding Add Employee popup ended up offering seats it
 * had none of: the count existed, nothing asked it the question.
 *
 * Deciding what to SHOW, never what to ALLOW — the server still runs
 * seatCheck() against the real roster before anything is created, because
 * hiding an option is not access control (AGENTS.md). A stale `seats` summary
 * (a second tab invited someone a moment ago) can only make this too
 * generous, never too strict, and the route behind it still refuses.
 */
export function seatFits({ role, permissions, seats } = {}) {
  const addsSeat = isBillableSeat({ role, permissions });
  const addsCrew = !addsSeat;
  const seatsAllowed = seats?.seatCap ?? null;
  const crewAllowed = seats?.crewCap ?? null;
  const { seatBlocked, crewBlocked } = seatMath({
    seatsUsed: Number(seats?.used) || 0,
    crewUsed: Number(seats?.crew) || 0,
    seatsAllowed,
    crewAllowed,
    addsSeat,
    addsCrew,
  });
  return !(seatBlocked || crewBlocked);
}

/**
 * The sentence a person reads when they are refused.
 *
 * Names the numbers and the way out. "You've reached your seat limit" sends
 * somebody to count the team by hand and then to support.
 */
export function seatLimitMessage(check) {
  const isCrew = check?.reason === "crew_limit";
  const cap = isCrew ? check?.crewAllowed : check?.seatsAllowed;
  const what = isCrew ? "crew" : cap === 1 ? "seat" : "seats";
  const tier = check?.tier?.label ? `Your ${check.tier.label} plan` : "Your plan";
  const next = check?.nextTier;

  const head = `${tier} includes ${cap} ${what}, and you're using all of them.`;
  const upgrade = next
    ? ` Need more? ${next.label} covers ${next.seats} ${next.seats === 1 ? "seat" : "seats"} and ${next.crewSeats} crew.`
    : " Talk to us about a plan that fits.";

  // Said only on the seat side. Somebody stopped from adding a painter does not
  // need to be told what a seat is; somebody stopped from adding a manager does,
  // because the distinction is the reason their crew did not count.
  const explain = isCrew
    ? ""
    : " Crew don't use a seat — only people who can create or change quotes, jobs or invoices do.";

  return head + upgrade + explain;
}
