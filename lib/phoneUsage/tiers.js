// lib/phoneUsage/tiers.js
//
// Keeping track of what Twilio charges, per class, and noticing when it moves.
//
// Each settled text or call is one OBSERVATION of a unit price (per segment,
// per photo, per minute) in a class (sms_in_CA, call_bridge, …). Distinct
// unit prices in one class are TIERS — Canadian inbound texts genuinely cost
// different amounts from Telus and from Bell. A tier is ADOPTED only once it
// has been seen SUSTAIN_COUNT times, so a single odd record (a refund, a
// partial rating) never counts as a price change.
//
// An adoption in a class that already had an adopted tier is a CHANGE:
//   - always a platform notice (PlatformErrorLog area "phone_costs"), because
//     FieldQuo's cost moved;
//   - a PhonePriceChange row — which drives the companies' banner — only when
//     it RAISES what companies pay above the class's dearest price so far (a
//     cheaper tier may just be a carrier not seen before; see tierDecision).
// The first tier ever adopted in a class is the baseline: nobody is told.

import { db } from "@/lib/db";
import { recordError } from "@/lib/platform/errorLog";
import { tierDecision, unitChargeCents } from "./pricing";

export async function recordObservation({ priceClass, unitMicros, now = new Date() }, { prisma = db, log = recordError } = {}) {
  if (!priceClass || !Number.isFinite(Number(unitMicros)) || Number(unitMicros) < 0) return null;
  const micros = Math.round(Number(unitMicros));
  const tier = await prisma.phoneCostTier.upsert({
    where: { priceClass_unitMicros: { priceClass, unitMicros: micros } },
    create: { priceClass, unitMicros: micros, observations: 1, firstSeenAt: now, lastSeenAt: now },
    update: { observations: { increment: 1 }, lastSeenAt: now },
  });
  if (tier.adoptedAt) return { tier, decision: null };
  const adoptedInClass = await prisma.phoneCostTier.findMany({
    where: { priceClass, adoptedAt: { not: null }, NOT: { unitMicros: micros } },
    select: { unitMicros: true },
  });
  const decision = tierDecision({ priceClass, tier, adoptedInClass });
  if (!decision.adopt) return { tier, decision };

  // Adopt with a guard, so two settlements racing on the fifth sighting
  // produce one change, not two.
  const claimed = await prisma.phoneCostTier.updateMany({ where: { id: tier.id, adoptedAt: null }, data: { adoptedAt: now } });
  if (!claimed.count) return { tier, decision: { ...decision, change: false } };

  if (decision.change) {
    await log({
      area: "phone_costs",
      code: "twilio_price_change",
      message:
        `Twilio price change in ${priceClass}: a sustained new unit cost of ${(micros / 10000).toFixed(3)}¢ ` +
        `(seen ${tier.observations}×). Companies now pay ${decision.chargeCents}¢ per unit for it` +
        (decision.chargeMoved ? ` (was ${decision.previousCents}¢ at the top tier) — banner raised.` : " — unchanged for companies (floor)."),
      detail: { priceClass, unitMicros: micros, chargeCents: decision.chargeCents, previousCents: decision.previousCents },
    }).catch(() => {});
    if (decision.chargeMoved) {
      await prisma.phonePriceChange.create({
        data: { priceClass, previousCents: decision.previousCents, chargeCents: decision.chargeCents, effectiveAt: now },
      });
    }
  }
  return { tier, decision };
}

/**
 * The flat monthly rentals, beside the metered classes. Twilio list prices
 * (2026-10-03): $0.50 a hosted (bring-your-own) number, $1.15 a local number
 * (a ported business number, a crew line). The charge is the one rental price.
 */
export const FIXED_COST_ROWS = Object.freeze([
  { priceClass: "rent_hosted_number", costCents: 50, chargeCents: 400 },
  { priceClass: "rent_ported_number", costCents: 115, chargeCents: 400 },
  { priceClass: "rent_crew_line", costCents: 115, chargeCents: 400 },
]);

/** Rows for the platform's "phone costs vs what we charge" table. */
export function costTableRows(tiers = []) {
  return tiers
    .filter((t) => t.adoptedAt)
    .map((t) => {
      const chargeCents = unitChargeCents(t.priceClass, t.unitMicros);
      const costCents = t.unitMicros / 10000;
      const multiple = costCents > 0 ? chargeCents / costCents : null;
      return { priceClass: t.priceClass, costCents, chargeCents, multiple, below2x: multiple !== null && multiple < 2, observations: t.observations, lastSeenAt: t.lastSeenAt };
    })
    .sort((a, b) => a.priceClass.localeCompare(b.priceClass) || a.costCents - b.costCents);
}
