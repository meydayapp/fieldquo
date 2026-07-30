// lib/billing/retention.js
//
// What to offer someone who's about to cancel.
//
// ── Offer what fits the reason, not a blanket discount ─────────────────────
//
// Somebody cancelling because they hired two people and let three go doesn't
// need 25% off — they need to stop paying for five licences. Somebody
// cancelling because it's February and they haven't laid a paving stone since
// November doesn't need a discount either; they need to come back in April.
//
// A discount aimed at the wrong problem reads as "we'd rather haggle than
// listen", and it costs margin on a customer who would have stayed for free if
// asked the right question. So the reason comes first and the offer follows.
//
// ── One offer per year ─────────────────────────────────────────────────────
//
// A discount you can claim every time you threaten to cancel isn't a discount,
// it's the price — and the customers who work that out are the ones who cost the
// most. Recorded on the subscription, checked here.
//
// ── Nothing here blocks cancelling ─────────────────────────────────────────
//
// Every path ends with a plain "cancel anyway" that works on the first click.
// A save flow you can't get out of is the reason people call their bank instead
// of clicking your button, and a chargeback costs far more than the month.

/** Why people leave. Ordered by how often it's true, not by what we'd prefer. */
export const CANCEL_REASONS = [
  {
    key: "too_expensive",
    label: "It costs too much right now",
    offer: "discount",
  },
  {
    key: "too_many_licenses",
    label: "I'm paying for people who don't use it",
    offer: "reduce_licenses",
  },
  {
    key: "seasonal",
    label: "My work is seasonal — I'll be back",
    offer: "pause",
  },
  {
    key: "not_using",
    label: "I'm not using it enough",
    offer: "discount",
  },
  {
    key: "missing_feature",
    label: "It's missing something I need",
    // No offer. Money doesn't fix a missing feature, and offering it here is how
    // you buy two more months and then lose them anyway — having learnt nothing
    // and spent the discount. Ask what's missing instead.
    offer: null,
  },
  {
    key: "switching",
    label: "I'm moving to something else",
    offer: null,
  },
  { key: "closing", label: "I'm closing the business", offer: null },
  { key: "other", label: "Something else", offer: null },
];

/** 25% off for two months, then back to the normal price. */
export const DISCOUNT_PERCENT = 25;
export const DISCOUNT_MONTHS = 2;

/** How long a seasonal pause can run before it just becomes a cancellation. */
export const MAX_PAUSE_MONTHS = 4;

/** How long before the same company can accept another offer. */
export const OFFER_COOLDOWN_MONTHS = 12;

/**
 * Which offers this company can actually be given right now.
 *
 * Returns them in the order they should be shown — the one that fits their
 * stated reason first.
 *
 * @param subscription  { retentionOffer, retentionOfferAt, status }
 * @param seats         licences they're paying for
 * @param activeMembers people actually using it
 * @param reason        the CANCEL_REASONS key they picked
 */
export function offersFor({
  subscription,
  seats = 1,
  activeMembers = 1,
  reason,
  now = new Date(),
} = {}) {
  const offers = [];
  const cooled = offerCooldownOver(subscription, now);

  // ── Reduce licences ────────────────────────────────────────────────────
  //
  // Only when there's genuinely slack. Offering "pay for fewer people" to
  // someone already at the right number is worse than offering nothing — it
  // shows we haven't looked.
  //
  // NOT subject to the cooldown: this isn't a concession, it's correcting an
  // overcharge. Refusing to let someone stop paying for licences they don't use
  // because they took a discount in March would be indefensible.
  const unused = Math.max(0, seats - Math.max(1, activeMembers));
  if (unused > 0) {
    offers.push({
      key: "reduce_licenses",
      title: `Drop to ${Math.max(1, activeMembers)} licence${activeMembers === 1 ? "" : "s"}`,
      body:
        `You're paying for ${seats} but only ${activeMembers} ${activeMembers === 1 ? "person is" : "people are"} ` +
        `using it. Removing ${unused} cuts the bill from your next invoice.`,
      cta: "Reduce my licences",
      newSeats: Math.max(1, activeMembers),
    });
  }

  // ── Seasonal pause ─────────────────────────────────────────────────────
  //
  // The one that fits this market best and the one nobody offers. Landscapers,
  // snow-removal, pool and paving companies have months with no work — a
  // contractor cancelling in November was never unhappy, they were just idle.
  // Charging them through the winter is how you turn a returning customer into
  // a former one.
  if (cooled) {
    offers.push({
      key: "pause",
      title: "Pause until you're busy again",
      body:
        `Stop paying for up to ${MAX_PAUSE_MONTHS} months. Your quotes, clients and ` +
        `history stay exactly as they are, and everything switches back on the day you return.`,
      cta: "Pause my account",
    });
  }

  // ── Discount ───────────────────────────────────────────────────────────
  if (cooled) {
    offers.push({
      key: "discount",
      title: `${DISCOUNT_PERCENT}% off for ${DISCOUNT_MONTHS} months`,
      body:
        `Your next ${DISCOUNT_MONTHS} invoices drop by ${DISCOUNT_PERCENT}%, then go back to ` +
        `the normal price. Nothing else changes.`,
      cta: `Take ${DISCOUNT_PERCENT}% off`,
    });
  }

  // Put the offer matching their stated reason first — the rest stay available
  // underneath, because someone who says "too expensive" may still prefer to
  // pause, and hiding it would be deciding for them.
  const preferred = CANCEL_REASONS.find((r) => r.key === reason)?.offer;
  if (preferred) {
    offers.sort((a, b) => (a.key === preferred ? -1 : b.key === preferred ? 1 : 0));
  }

  return offers;
}

/** Has enough time passed since their last accepted offer? */
export function offerCooldownOver(subscription, now = new Date()) {
  const at = subscription?.retentionOfferAt;
  if (!at) return true;
  const months =
    (now.getTime() - new Date(at).getTime()) / (30.44 * 24 * 60 * 60 * 1000);
  return months >= OFFER_COOLDOWN_MONTHS;
}

/**
 * Why an offer can't be given, in words the person can act on.
 *
 * Returned instead of silently omitting the offer: "you already used this in
 * March" is a fact someone can understand, where a button that simply isn't
 * there reads as the app being broken.
 */
export function cooldownMessage(subscription, now = new Date()) {
  if (offerCooldownOver(subscription, now)) return null;
  const at = new Date(subscription.retentionOfferAt);
  const next = new Date(at);
  next.setMonth(next.getMonth() + OFFER_COOLDOWN_MONTHS);
  return `You've already used a retention offer this year. The next one is available from ${next.toLocaleDateString()}.`;
}

/** Whether a reason is one we recognise. */
export function isValidReason(key) {
  return CANCEL_REASONS.some((r) => r.key === key);
}
