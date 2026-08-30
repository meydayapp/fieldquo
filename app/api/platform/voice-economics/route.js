// app/api/platform/voice-economics/route.js
//
// Is the voice product making money, and is it about to run out of capacity.
//
// Two questions that get confused with each other. The per-minute margin is
// healthy and provable from `VoiceCall.providerCostCents` — Retell's own figure
// for what each call cost us. What a per-minute price cannot recover is
// anything billed per MONTH: concurrency slots, number rentals, knowledge
// bases. Those are the ones that can invert a margin without appearing on a
// single call.
//
// Concurrency is here for a second reason, and it is the more urgent one. It is
// a WORKSPACE limit shared by every contractor, with no per-agent cap to
// partition it. When the pool is full an inbound call waits about forty seconds
// and then fails — which the caller experiences as a contractor who does not
// answer their phone. That is not a margin problem, it is the product not
// working, and it is invisible until somebody looks.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { voiceEconomics, slotBreakEvenMinutes } from "@/lib/voice/platformEconomics";
import { costForSeconds, monthlyCentsFor, CENTS_PER_MINUTE } from "@/lib/voice/credits";
import { getConcurrency, voiceConfigured } from "@/lib/voice/retell";

/** What a number of that type costs US per month, in cents. Retell's list price. */
const PROVIDER_NUMBER_COST_CENTS = { local: 200, toll_free: 500 };

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const days = Math.min(365, Math.max(1, Number(new URL(request.url).searchParams.get("days")) || 30));
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [calls, numbers] = await Promise.all([
    db.voiceCall.findMany({
      where: { startedAt: { gte: from }, durationSec: { gt: 0 } },
      select: {
        durationSec: true,
        providerCostCents: true,
        number: { select: { numberType: true } },
      },
    }),
    db.voicePhoneNumber.findMany({
      where: { status: "active" },
      select: { numberType: true },
    }),
  ]);

  // ── Concurrency comes from the provider, or not at all ──────────────────
  //
  // Never defaulted to 20. A guessed limit reports zero paid slots and a margin
  // that looks better than it is, and the whole reason this endpoint exists is
  // that a fixed cost assumed away is the one that surprises you.
  let concurrency = null;
  if (voiceConfigured()) {
    concurrency = await getConcurrency().catch(() => null);
  }

  const model = voiceEconomics({
    calls: calls.map((c) => ({
      // What the CONTRACTOR was charged, priced the same way the meter prices
      // it — not re-derived from a flat rate, which would miss the toll-free
      // surcharge and quietly overstate margin on exactly the pricier numbers.
      revenueCents: costForSeconds(c.durationSec, c.number?.numberType || "local"),
      providerCostCents: c.providerCostCents === null ? null : Number(c.providerCostCents),
    })),
    numbers: numbers.map((n) => ({
      monthlyRevenueCents: monthlyCentsFor(n.numberType || "local"),
      monthlyCostCents: PROVIDER_NUMBER_COST_CENTS[n.numberType] ?? PROVIDER_NUMBER_COST_CENTS.local,
    })),
    concurrencyLimit: concurrency?.concurrency_limit ?? null,
    knowledgeBases: 0,
  });

  const minutes = calls.reduce((s, c) => s + c.durationSec / 60, 0);
  const marginPerMinute =
    minutes > 0 ? (model.calls.revenueCents - model.calls.costCents) / minutes : null;

  return NextResponse.json({
    ...model,
    days,
    minutes: Math.round(minutes * 10) / 10,
    chargedCentsPerMinute: CENTS_PER_MINUTE,
    marginCentsPerMinute: marginPerMinute === null ? null : Math.round(marginPerMinute * 10) / 10,
    // The sentence that answers "should I raise the price to cover
    // concurrency?" — a slot costs $8 and carries this many minutes of margin.
    slotBreakEvenMinutes: marginPerMinute === null ? null : slotBreakEvenMinutes(marginPerMinute),
    concurrency: concurrency
      ? {
          inUse: concurrency.current_concurrency ?? null,
          limit: concurrency.concurrency_limit ?? null,
          burstEnabled: Boolean(concurrency.concurrency_burst_enabled),
        }
      : null,
  });
}
