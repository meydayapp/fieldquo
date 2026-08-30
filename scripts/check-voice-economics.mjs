// scripts/check-voice-economics.mjs
//
// Is the voice product making money, and can a fixed cost invert it silently.
//
// ══ The question this settles ══════════════════════════════════════════════
//
// "We have to fix the price to make sure concurrency is taken into account,
// because I'll be losing money." The arithmetic says otherwise, and the point
// of putting it in a check is that the answer stays true as the numbers move:
// a concurrency slot costs $8 a month and carries hundreds of dollars of
// billable minutes. The fixed cost that CAN invert a margin is the knowledge
// base — $8 per company per month against a gross margin that, for a quiet
// contractor, is smaller than that.
//
// Every figure here is executed, and the absence rules matter as much as the
// sums: a call the provider has not priced must never read as a call that cost
// nothing, and a concurrency limit we could not fetch must never read as zero
// paid slots.
import { voiceEconomics, slotBreakEvenMinutes, PLATFORM_PRICES } from "@/lib/voice/platformEconomics";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);

section("1. A priced call, with the real figures from production");

{
  // 17.4 billed minutes across 8 calls: charged $7.70, Retell billed $3.107.
  const r = voiceEconomics({
    calls: [{ revenueCents: 770, providerCostCents: 310.7 }],
    concurrencyLimit: 20,
  });
  ok(r.revenueCents === 770, "revenue is what the contractor was charged", r.revenueCents);
  ok(r.costCents === 310.7, "cost is what Retell actually billed, not an estimate", r.costCents);
  ok(r.marginPct === 59.6, "≈60% gross margin", r.marginPct);
}

section("2. A cost we do not know is not a cost of zero");

{
  const r = voiceEconomics({
    calls: [
      { revenueCents: 770, providerCostCents: 310.7 },
      { revenueCents: 500, providerCostCents: null },
    ],
    concurrencyLimit: 20,
  });
  ok(r.calls.uncosted === 1, "a call the provider has not priced is counted", r.calls.uncosted);
  ok(
    r.costCents === 310.7,
    "…and NOT costed — Number(null) is 0, which would turn 'we don't know' into 'it was free'",
    r.costCents,
  );
  ok(
    r.incomplete === true,
    "…so the margin says it is short rather than presenting itself as the answer",
  );
}
{
  const r = voiceEconomics({ calls: [{ revenueCents: 100, providerCostCents: 50 }], concurrencyLimit: null });
  ok(r.fixed.paidSlots === null, "an unfetchable concurrency limit is unknown, not zero slots", r.fixed.paidSlots);
  ok(r.fixed.concurrencyCents === null, "…and costs an unknown amount, not nothing", r.fixed.concurrencyCents);
  ok(r.incomplete === true, "…and that is declared");
}

section("3. Concurrency is an availability decision, not a pricing one");

{
  ok(
    voiceEconomics({ concurrencyLimit: 20 }).fixed.paidSlots === 0,
    "the first 20 slots are included, so a small workspace pays nothing",
  );
  ok(
    voiceEconomics({ concurrencyLimit: 50 }).fixed.concurrencyCents === 30 * 800,
    "past that it is $8 a slot a month",
    voiceEconomics({ concurrencyLimit: 50 }).fixed.concurrencyCents,
  );
  // The number that answers the owner's question. At ~19.5¢ of margin a
  // minute, a slot pays for itself inside an hour of talk time a MONTH —
  // against a slot that could carry 43,800 minutes if it were never idle.
  ok(
    slotBreakEvenMinutes(19.5) === 42,
    "a slot pays for itself after 42 billable minutes a month",
    slotBreakEvenMinutes(19.5),
  );
  ok(
    slotBreakEvenMinutes(0) === null && slotBreakEvenMinutes(-5) === null,
    "…and at zero or negative margin there is no break-even, rather than a divide-by-zero",
  );
}

section("4. The knowledge base is the fixed cost that CAN lose money");

{
  // A quiet contractor: 30 minutes a month at 35¢ is $10.50 of revenue and
  // about $5.85 of margin. An $8 monthly fee takes it under.
  const quiet = voiceEconomics({
    calls: [{ revenueCents: 1050, providerCostCents: 465 }],
    concurrencyLimit: 20,
    knowledgeBases: 11,
  });
  ok(
    quiet.marginCents < 0,
    "one knowledge base costs a 30-minute-a-month company more than it earns",
    quiet.marginCents,
  );
  ok(
    voiceEconomics({ concurrencyLimit: 20, knowledgeBases: 10 }).fixed.knowledgeBaseCents === 0,
    "the first ten are free, which is why nobody noticed",
  );
  ok(
    PLATFORM_PRICES.knowledgeBaseCentsEach === PLATFORM_PRICES.concurrencyCentsEach,
    "both fixed costs are $8 — the difference is entirely in what each one buys",
  );
}

section("5. Number rent, and hostile input");

{
  const r = voiceEconomics({
    numbers: [{ monthlyRevenueCents: 400, monthlyCostCents: 200 }],
    concurrencyLimit: 20,
  });
  ok(r.marginCents === 200, "a local number rents at $4 and costs $2", r.marginCents);
  ok(voiceEconomics().marginPct === null, "no revenue gives a null margin, never 0%");
  ok(voiceEconomics({ calls: null, numbers: null }).revenueCents === 0, "nulls do not throw");
  ok(
    voiceEconomics({ calls: [null, {}, { revenueCents: "abc" }] }).revenueCents === 0,
    "junk rows contribute nothing rather than NaN",
  );
  ok(
    voiceEconomics({ concurrencyLimit: 5 }).fixed.paidSlots === 0,
    "a limit below the included allowance is not negative slots",
  );
}

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
