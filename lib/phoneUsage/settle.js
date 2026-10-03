// lib/phoneUsage/settle.js
//
// Settling a text or call from its floor charge to Twilio's actual price × 2.
//
// ══ Two writes, one balance ══════════════════════════════════════════════════
//
// The meters (lib/crew/messaging.js, lib/businessNumber/meter.js) debit the
// FLOOR the moment a text or call happens — the carrier has been paid, and the
// statement should show it at once. They also enqueue a PhoneUsageCharge.
// Twilio writes its price onto the message or call record minutes (sometimes
// hours) later; the hourly cron reads it here and, when twice that price is
// more than the floor, debits the difference under `${ledgerRef}:settle`.
// debitCredit's unique (companyId, ref) makes the top-up happen once however
// many times the cron runs. The floor is never refunded: by the rule a charge
// is max(floor, cost × 2), so the settlement only ever adds.
//
// A price that never arrives (Twilio sometimes leaves inbound prices null for
// a long time) is given up on after MAX_ATTEMPTS or MAX_AGE: the floor stands
// and the row is closed, so the cron does not ask Twilio about it for ever.
//
// Every price read is also an OBSERVATION for the cost table and the price-
// change detector (./tiers.js).

import { db } from "@/lib/db";
import { debitCredit } from "@/lib/voice/credits";
import { countryForAreaCode } from "@/lib/voice/nanp";
import { recordError } from "@/lib/platform/errorLog";
import * as realProvider from "./provider";
import { chargeCentsFor, priceClassFor, unitMicros, cappedUnits } from "./pricing";
import { recordObservation } from "./tiers";

export const MAX_ATTEMPTS = 24;
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Twilio rarely has a price in the first minutes; asking sooner is a wasted call. */
export const MIN_AGE_MS = 5 * 60 * 1000;

/** The other party's country from a NANP number; null otherwise. */
export function countryOfE164(e164) {
  const m = /^\+1(\d{3})\d{7}$/.exec(String(e164 || ""));
  if (m) return countryForAreaCode(m[1]);
  return e164 && String(e164).startsWith("+") ? "INTL" : null;
}

/** Queue one floor-charged record for settlement. Idempotent on the SID. */
export async function enqueueUsage(
  { companyId, sid, resource, direction, ledgerKind, ledgerRef, provisionalCents, units = 1, hasMedia = false, country = null },
  prisma = db,
) {
  if (!companyId || !sid || !ledgerRef) return null;
  try {
    return await prisma.phoneUsageCharge.create({
      data: {
        companyId,
        sid: String(sid),
        resource,
        direction: direction === "out" ? "out" : "in",
        ledgerKind,
        ledgerRef,
        provisionalCents: Math.max(0, Math.round(Number(provisionalCents) || 0)),
        units: cappedUnits(resource, units),
        hasMedia: Boolean(hasMedia),
        country: country || null,
        priceClass: priceClassFor({ resource, direction, hasMedia, country }),
      },
    });
  } catch (err) {
    if (err?.code === "P2002") return null; // already queued — a retried webhook
    throw err;
  }
}

/** The statement line for a top-up. Our price only — never the carrier's. */
export function settleNote({ resource, hasMedia, chargedCents, provisionalCents }) {
  const what = resource === "call" ? "Call" : hasMedia ? "Photo" : "Text";
  return `${what} — carrier rate applied: ${chargedCents}¢ in all (${provisionalCents}¢ taken at the time)`;
}

/**
 * Settle one queued record. Never throws.
 *
 * @returns {{ settled: boolean, extraCents?: number, gaveUp?: boolean }}
 */
export async function settleOne(row, { prisma = db, provider = realProvider, debit = debitCredit, now = new Date(), log = recordError } = {}) {
  try {
    const cost = row.resource === "call" ? await provider.callCostMicros(row.sid) : await provider.messageCostMicros(row.sid);
    const age = now.getTime() - new Date(row.createdAt).getTime();
    if (cost === null || cost === undefined) {
      const attempts = (row.attempts || 0) + 1;
      const gaveUp = attempts >= MAX_ATTEMPTS || age >= MAX_AGE_MS;
      await prisma.phoneUsageCharge.update({
        where: { id: row.id },
        data: { attempts, ...(gaveUp ? { settledAt: now, chargedCents: row.provisionalCents } : {}) },
      });
      return { settled: gaveUp, gaveUp };
    }
    const charged = chargeCentsFor({ resource: row.resource, units: row.units, hasMedia: row.hasMedia, providerCostMicros: cost });
    const extra = charged - row.provisionalCents;
    if (extra > 0) {
      await debit({
        companyId: row.companyId,
        cents: extra,
        kind: row.ledgerKind,
        ref: `${row.ledgerRef}:settle`,
        note: settleNote({ resource: row.resource, hasMedia: row.hasMedia, chargedCents: charged, provisionalCents: row.provisionalCents }),
        prisma,
      });
    }
    await prisma.phoneUsageCharge.update({
      where: { id: row.id },
      data: { providerCostMicros: cost, chargedCents: Math.max(charged, row.provisionalCents), settledAt: now, attempts: (row.attempts || 0) + 1 },
    });
    await recordObservation(
      { priceClass: row.priceClass || priceClassFor(row), unitMicros: unitMicros({ ...row, providerCostMicros: cost }), now },
      { prisma, log },
    ).catch(() => null);
    return { settled: true, extraCents: Math.max(0, extra) };
  } catch (err) {
    await log({ area: "phone_usage", code: "settle_failed", companyId: row.companyId, message: `Settling ${row.resource} failed: ${err?.message}` }).catch(() => {});
    return { settled: false };
  }
}

/** The cron's batch. */
export async function settlePending({ prisma = db, provider = realProvider, debit = debitCredit, now = new Date(), log = recordError, batch = 300 } = {}) {
  const rows = await prisma.phoneUsageCharge.findMany({
    where: { settledAt: null, createdAt: { lte: new Date(now.getTime() - MIN_AGE_MS) } },
    orderBy: { createdAt: "asc" },
    take: batch,
  });
  const counts = { considered: rows.length, settled: 0, toppedUp: 0, gaveUp: 0 };
  for (const row of rows) {
    const r = await settleOne(row, { prisma, provider, debit, now, log });
    if (r.settled) counts.settled++;
    if (r.extraCents > 0) counts.toppedUp++;
    if (r.gaveUp) counts.gaveUp++;
  }
  return counts;
}
