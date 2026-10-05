"use client";

// app/components/billing/AiPlanAdvisor.js
//
// "Which plan fits the AI you'll use?" — three numbers in, a recommendation
// out, on the plan pickers (Account & Billing, the AI credit page, /pricing).
// The arithmetic is lib/ai/planAdvice.js; the unit costs come from the server
// (lib/ai/planAdviceUnits.js), computed from the metered prices — nothing here
// knows what a token costs.
//
// It says the two allowances apart because they are paid apart: quote reviews
// spend the PLAN's capped AI allowance; the AI employee and drawing reads are
// paid from AI CREDIT whatever the plan. A sentence that recommended a bigger
// plan for an AI employee would be advice that changes nothing.
//
// The parent gets the advice back (onAdvice) to mark its own cards — the
// plan cards' "about N quote reviews a month", the AI credit cards' "about N
// conversations or N drawing reads".
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { recommendAiPlan } from "@/lib/ai/planAdvice";

const usd = (cents) => {
  const n = Number(cents) / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  } catch {
    return `US$${n.toFixed(2)}`;
  }
};
// Module-level, not `= []` in the signature: a fresh default array each render
// would change useMemo's inputs, recompute the advice, hand it to onAdvice,
// re-render the parent — a loop.
const NONE = Object.freeze([]);
const bundleName = (b) => (b?.key ? b.key.charAt(0).toUpperCase() + b.key.slice(1) : "");

export function useAiAdvice({ units, plans, bundles }) {
  const [input, setInput] = useState({ conversations: "", drawingReads: "", quoteReviews: "" });
  const advice = useMemo(
    () => recommendAiPlan({ input, units: units || {}, plans: plans || NONE, bundles: bundles || NONE }),
    [input, units, plans, bundles],
  );
  return { input, setInput, advice };
}

export default function AiPlanAdvisor({
  units,
  plans = NONE,
  bundles = NONE,
  // false when this company cannot start an AI credit plan (they are USD
  // subscriptions — lib/ai/creditBundle.js bundleAvailability): the credit is
  // then bought as top-ups, and the sentence says so instead of naming a plan
  // the page would refuse.
  bundlesAvailable = true,
  // Where "AI credit plans" links to; null on /pricing (no account yet).
  creditHref = "/app/settings/ai-credit",
  onAdvice,
  className = "",
}) {
  const { t } = useTranslation();
  const { input, setInput, advice } = useAiAdvice({ units, plans, bundles });
  useEffect(() => {
    if (onAdvice) onAdvice(advice);
  }, [advice, onAdvice]);
  if (!units) return null;

  const field = (key, label) => (
    <label className="block text-xs text-muted-foreground">
      <span>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min="0"
        step="1"
        value={input[key]}
        onChange={(e) => setInput((v) => ({ ...v, [key]: e.target.value }))}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        placeholder="0"
      />
    </label>
  );

  const { credit, plan } = advice;
  const anything = advice.input.conversations + advice.input.drawingReads + advice.input.quoteReviews > 0;

  return (
    <section className={`bg-card border border-border rounded-xl p-5 space-y-3 ${className}`} data-ai-plan-advisor>
      <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
        <Sparkles size={16} aria-hidden="true" /> {t("app.aiAdvisor.title", "Which plan fits the AI you'll use?")}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t(
          "app.aiAdvisor.intro",
          "Every plan's AI is capped — none is unlimited. Say roughly what you'll use in a month and we'll say what fits, at today's prices.",
        )}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {field("conversations", t("app.aiAdvisor.conversations", "AI employee conversations a month"))}
        {field("drawingReads", t("app.aiAdvisor.drawingReads", "Drawing sets read a month (about {sheets} sheets each)", { sheets: units.drawingReadSheets }))}
        {field("quoteReviews", t("app.aiAdvisor.quoteReviews", "AI quote reviews a month"))}
      </div>

      {anything && (
        <div className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground space-y-1.5" role="status" data-ai-plan-advice>
          {advice.input.quoteReviews > 0 && (
            <p>
              {!plan
                ? t("app.aiAdvisor.planUnknown", "Quote reviews come out of your plan's monthly AI allowance.")
                : plan.fits
                  ? t("app.aiAdvisor.planFits", "Quote reviews come out of your plan's monthly AI allowance: {plan} covers about {reviews} a month, so it fits.", { plan: plan.name, reviews: plan.reviews.toLocaleString() })
                  : t("app.aiAdvisor.planShort", "Quote reviews come out of your plan's monthly AI allowance, and the most a plan covers is about {reviews} a month ({plan}). Past that, reviews wait for next month.", { plan: plan.name, reviews: plan.reviews.toLocaleString() })}
            </p>
          )}
          {credit && (
            <p>
              {!bundlesAvailable
                ? t("app.aiAdvisor.creditTopups", "The AI employee and drawing reads are paid from AI credit, not the plan: {amount} a month at today's prices, bought as top-ups.", { amount: usd(credit.walletCents) })
                : credit.fits
                  ? t("app.aiAdvisor.credit", "The AI employee and drawing reads are paid from AI credit, not the plan: {amount} a month at today's prices. The {bundle} AI credit plan ({price}/month, {credits} credits) covers it — about {conversations} conversations or {reads} drawing reads a month.", {
                      amount: usd(credit.walletCents),
                      bundle: bundleName(credit.bundle),
                      price: usd(credit.bundle.priceCents),
                      credits: Number(credit.bundle.credits).toLocaleString(),
                      conversations: (credit.covers.conversations ?? 0).toLocaleString(),
                      reads: (credit.covers.drawingReads ?? 0).toLocaleString(),
                    })
                  : t("app.aiAdvisor.creditOver", "The AI employee and drawing reads are paid from AI credit, not the plan: {amount} a month at today's prices — more than the largest AI credit plan ({bundle}, {credits} credits). Add {topup} a month in top-ups on top of it.", {
                      amount: usd(credit.walletCents),
                      bundle: bundleName(credit.bundle),
                      credits: Number(credit.bundle.credits).toLocaleString(),
                      topup: usd(credit.topUpCents),
                    })}{" "}
              {creditHref && (
                <Link href={creditHref} className="underline">
                  {t("app.aiAdvisor.seeCredit", "AI credit plans")}
                </Link>
              )}
            </p>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {t(
          "app.aiAdvisor.basis",
          "Estimated at today's prices: an AI employee conversation {conv} and a {sheets}-sheet drawing read {read} of AI credit; a quote review uses some {tokens} tokens of the plan's allowance.",
          {
            conv: usd(units.conversationCents),
            sheets: units.drawingReadSheets,
            read: usd(units.drawingReadCents),
            tokens: Number(units.quoteReview?.tokens || 0).toLocaleString(),
          },
        )}
      </p>
    </section>
  );
}
