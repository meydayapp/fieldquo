// scripts/check-retention.mjs
//
//   npm run check:retention
//
// The cancellation save flow, executed.
//
// The assertions here are mostly about NOT offering the wrong thing:
//
//   * Somebody cancelling because it's February and they haven't laid a paving
//     stone since November doesn't need a discount, they need to come back in
//     April. Seasonal leads with pause.
//   * Somebody paying for five licences and using two doesn't need 25% off,
//     they need to stop paying for three people. And a company already at the
//     right seat count must NOT be offered "pay for fewer" — that shows we
//     haven't looked.
//   * "It's missing a feature I need" gets no offer at all. Money doesn't fix
//     it, and buying two more months teaches you nothing and loses them anyway.
//
// The cooldown assertions matter for the opposite reason: a discount you can
// claim every time you threaten to cancel isn't a discount, it's the price.
// Reducing licences is deliberately EXEMPT — that's correcting an overcharge,
// not granting a favour, and refusing it because someone took a discount in
// March would be indefensible.

import { offersFor, offerCooldownOver, cooldownMessage, isValidReason,
         CANCEL_REASONS, DISCOUNT_PERCENT, DISCOUNT_MONTHS, OFFER_COOLDOWN_MONTHS } from "@/lib/billing/retention";
let fail=0; const ok=(c,m)=>{console.log((c?"✓ ":"✗ ")+m); if(!c)fail++;};
const NOW = new Date("2026-07-30T12:00:00Z");
const monthsAgo = n => new Date(NOW.getTime() - n*30.44*864e5);
const keys = o => o.map(x=>x.key);

// ── The offer must fit the reason ────────────────────────────────────────
const seasonal = offersFor({ subscription:{}, seats:1, activeMembers:1, reason:"seasonal", now:NOW });
ok(keys(seasonal)[0] === "pause", `"my work is seasonal" leads with pause, not a discount (${keys(seasonal).join(" → ")})`);

const pricey = offersFor({ subscription:{}, seats:1, activeMembers:1, reason:"too_expensive", now:NOW });
ok(keys(pricey)[0] === "discount", `"too expensive" leads with the discount (${keys(pricey).join(" → ")})`);

const overSeated = offersFor({ subscription:{}, seats:5, activeMembers:2, reason:"too_many_licenses", now:NOW });
ok(keys(overSeated)[0] === "reduce_licenses", `"paying for people who don't use it" leads with reducing licences`);
ok(overSeated[0].newSeats === 2, `and it proposes the RIGHT number (${overSeated[0].newSeats}, from 5)`);
ok(/paying for 5 but only 2/.test(overSeated[0].body), `the copy names the real numbers: "${overSeated[0].body.slice(0,60)}…"`);

// ── Don't offer what doesn't apply ───────────────────────────────────────
const rightSized = offersFor({ subscription:{}, seats:2, activeMembers:2, reason:"too_expensive", now:NOW });
ok(!keys(rightSized).includes("reduce_licenses"),
   "a company already at the right seat count is NOT offered 'pay for fewer' — that shows we haven't looked");

// ── Some reasons get no offer, deliberately ──────────────────────────────
for (const k of ["missing_feature","switching","closing"]) {
  const r = CANCEL_REASONS.find(x=>x.key===k);
  ok(r.offer === null, `"${r.label}" has no preferred offer — money doesn't fix it`);
}
ok(CANCEL_REASONS.every(r=>r.key && r.label), `${CANCEL_REASONS.length} reasons, all labelled`);
ok(isValidReason("seasonal") && !isValidReason("../../etc/passwd"), "reason keys are validated against the list");

// ── One offer per year ───────────────────────────────────────────────────
const fresh = { retentionOffer:"discount", retentionOfferAt: monthsAgo(2) };
ok(!offerCooldownOver(fresh, NOW), "an offer taken 2 months ago is still in cooldown");
const stale = { retentionOffer:"discount", retentionOfferAt: monthsAgo(13) };
ok(offerCooldownOver(stale, NOW), `an offer taken 13 months ago has cooled (limit ${OFFER_COOLDOWN_MONTHS})`);
ok(offerCooldownOver({}, NOW), "a company that's never taken one is eligible");

const cooling = offersFor({ subscription:fresh, seats:1, activeMembers:1, reason:"too_expensive", now:NOW });
ok(!keys(cooling).includes("discount") && !keys(cooling).includes("pause"),
   "in cooldown, the concessions are withheld — a discount you can farm is just the price");
ok(/already used a retention offer/.test(cooldownMessage(fresh, NOW)),
   `and it SAYS why: "${cooldownMessage(fresh,NOW).slice(0,55)}…"`);
ok(cooldownMessage(stale, NOW) === null, "no message once it's cooled");

// ── Reducing licences is NOT a concession and must survive cooldown ──────
const cooledButOverSeated = offersFor({ subscription:fresh, seats:6, activeMembers:2, reason:"too_many_licenses", now:NOW });
ok(keys(cooledButOverSeated).includes("reduce_licenses"),
   "even in cooldown they can stop paying for unused licences — that's correcting an overcharge, not a favour");
ok(!keys(cooledButOverSeated).includes("discount"), "but the discount stays withheld");

// ── Hostile / empty input ────────────────────────────────────────────────
ok(Array.isArray(offersFor()), "offersFor() with no arguments returns a list rather than throwing");
ok(offersFor({subscription:null, seats:0, activeMembers:0, now:NOW}).every(o=>o.title && o.cta),
   "every offer has a title and a button label, even from junk input");
ok(offersFor({subscription:{}, seats:1, activeMembers:99, reason:"x", now:NOW}).every(o=>o.key!=="reduce_licenses"),
   "more members than seats can't produce a negative reduction");
ok(DISCOUNT_PERCENT>0 && DISCOUNT_PERCENT<100 && DISCOUNT_MONTHS>0, `${DISCOUNT_PERCENT}% for ${DISCOUNT_MONTHS} months`);

console.log(`\n${fail===0?"ALL PASS":fail+" FAILED"}`);
process.exit(fail?1:0);
