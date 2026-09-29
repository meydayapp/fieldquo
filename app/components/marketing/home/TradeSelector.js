// app/components/marketing/home/TradeSelector.js
//
// Section 5: "Built for your trade" — pick a trade, see the kind of estimate
// you would send.
//
// ══ Client-side only, and not a rate card ═════════════════════════════════
//
// Non-negotiable #4: public surfaces never publish prices. The figures below
// are ILLUSTRATIVE jobs, typed here, labelled "Example" on the card and
// footnoted as not a price list. Nothing is fetched — there is no API behind
// this and there must never be one: a selector that pulled a real company's
// rates would be the rate card the rule exists to keep private.
// check:homepage-sections fails this file if it ever calls fetch.
//
// The eight trades are real FieldQuo industries (app/data/industries.js) and
// their names come from the translated industry labels, so the chips read in
// the visitor's language. Each card links to that trade's /industries page.
//
// ══ A tablist, properly ═══════════════════════════════════════════════════
//
// role="tablist" with a roving tabindex: Tab enters and leaves the list in
// one stop, arrow keys move between trades, Home/End jump. The "Send quote"
// on the card is a drawing of the button inside a labelled example — a span
// with no handler and no hover state, not a control that does nothing.
"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { PaintRoller, Home, Sparkles, Trees, Zap, Droplets, Hammer, HardHat, ArrowRight, Send } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useIndustryLabels } from "@/app/hooks/useIndustryLabels";
import { numberLocaleFor } from "@/app/i18n/numberLocale";
import { offerMoney } from "@/app/components/billing/PlanOfferPrice";

// Illustrative totals — see the header. `slug` is an app/data/industries.js
// slug; check:homepage-sections asserts each one exists there.
export const TRADE_EXAMPLES = [
  { slug: "painting", icon: PaintRoller, total: 4280 },
  { slug: "roofing", icon: Home, total: 14900 },
  { slug: "cleaning", icon: Sparkles, total: 640 },
  { slug: "landscaping", icon: Trees, total: 5350 },
  { slug: "electrical", icon: Zap, total: 3850 },
  { slug: "plumbing", icon: Droplets, total: 2180 },
  { slug: "handyman", icon: Hammer, total: 720 },
  { slug: "construction-contracting", icon: HardHat, total: 38500 },
];

export default function TradeSelector() {
  const { t, language } = useTranslation();
  const labels = useIndustryLabels();
  const money = offerMoney("$", numberLocaleFor(language));
  const [active, setActive] = useState(0);
  const tabs = useRef([]);

  const labelFor = (slug) => labels.find((l) => l.slug === slug)?.label || slug;
  const current = TRADE_EXAMPLES[active];

  const onKeyDown = (event) => {
    const last = TRADE_EXAMPLES.length - 1;
    let next = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = active === last ? 0 : active + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = active === 0 ? last : active - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <section className="bg-muted border-t border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground text-balance">
            {t("home.trades.title")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground text-pretty">{t("home.trades.subtitle")}</p>

          <div
            role="tablist"
            aria-label={t("home.trades.pick")}
            aria-orientation="horizontal"
            onKeyDown={onKeyDown}
            className="mt-8 flex flex-wrap gap-2"
          >
            {TRADE_EXAMPLES.map((trade, i) => {
              const selected = i === active;
              return (
                <button
                  key={trade.slug}
                  ref={(el) => (tabs.current[i] = el)}
                  type="button"
                  role="tab"
                  id={`trade-tab-${trade.slug}`}
                  aria-selected={selected}
                  aria-controls="trade-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(i)}
                  className={`inline-flex items-center gap-2 min-h-[44px] rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:border-foreground/40"
                  }`}
                >
                  <trade.icon size={16} aria-hidden="true" />
                  {labelFor(trade.slug)}
                </button>
              );
            })}
          </div>
        </div>

        <div id="trade-panel" role="tabpanel" aria-labelledby={`trade-tab-${current.slug}`} aria-live="polite">
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xl shadow-primary/10">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-bold uppercase tracking-wide text-foreground">
                {t("home.trades.example")}
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground">
                <current.icon size={20} aria-hidden="true" />
              </span>
            </div>

            <h3 className="mt-5 text-2xl font-bold tracking-tight text-foreground">
              {t(`home.trades.${current.slug}.job`)}
            </h3>
            <p className="mt-1 text-muted-foreground">{t(`home.trades.${current.slug}.scope`)}</p>

            <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-border pt-5">
              <div>
                <div className="text-sm text-muted-foreground">{t("home.trades.estimate")}</div>
                <div className="text-4xl font-bold tracking-tight text-foreground">{money(current.total)}</div>
              </div>
              <span
                aria-hidden="true"
                className="inline-flex items-center gap-2 rounded-full bg-brand-accent px-5 py-2.5 text-sm font-semibold text-brand-accent-foreground"
              >
                <Send size={15} />
                {t("home.trades.send")}
              </span>
            </div>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">{t("home.trades.note")}</p>
          <Link
            href={`/industries/${current.slug}`}
            className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            {t("home.trades.more")} — {labelFor(current.slug)}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
