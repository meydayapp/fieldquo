// app/components/marketing/ClosingCTA.js
//
// The page's second and last ask.
//
// The hero asks once, above the fold, before the visitor knows what FieldQuo
// is. Everything between there and here exists to answer "is this for me" —
// the trades strip, the feature band, and six FAQ answers ending on "No.
// Plans are month-to-month — cancel anytime". A reader who is convinced
// arrives at the bottom of the page with the objections gone and nothing to
// click: the page ended on a link to the Help Centre. Asking once, at the
// top, is the same defect as not asking, delayed — the visitor who was going
// to say yes has to scroll back up or find the nav, which on a phone is
// behind a hamburger.
//
// Its own component rather than a tail on ResourcesTeaser: a section named
// for resources that carries the signup is the "Business Hours card that
// edits a booking calendar" failure AGENTS.md names, and check:marketing-cta
// resolves the homepage's parts by following imports, so a correctly named
// file is in scope automatically.
//
// Deliberately NOT a copy of the hero's block. The hero pairs the trial with
// a secondary action and the demo booker beneath it; this is one button and
// the offer, laid out as a bar. Two centred stacks of the same three elements
// would be the copy-paste duplication that rots — this is a different control
// with a different job.
"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function ClosingCTA() {
  const { t } = useTranslation();

  return (
    <section className="bg-muted border-t border-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="rounded-2xl border border-border bg-card p-8 sm:p-10 text-center sm:flex sm:items-center sm:justify-between sm:gap-8 sm:text-left">
          {/* The same two keys the hero prints under its button, and the same
              reason: hero.noCard says "No credit card required" in every
              language and it is false — /api/companies opens Stripe Checkout
              straight after creating the company. The free first month
              (TRIAL_PRICE = 0) is the offer that is actually kept. Joined with
              a separator rather than composed into a sentence, because word
              order is not ours to assume across nine languages.

              brand-accent-text, not brand-accent: the raw orange is a fill
              colour and measures 3.0:1 as text on white. #c34300 on card is
              5.09:1 light and #ff7a2e is 6.49:1 dark. */}
          <p className="text-xl sm:text-2xl font-bold text-foreground">
            {t("pricing.firstMonth")}{" "}
            <span className="text-brand-accent-text">·{" "}{t("pricing.free")}</span>
          </p>

          <Link
            href="/signup"
            className="mt-6 sm:mt-0 shrink-0 inline-flex items-center justify-center gap-2 min-h-[44px] bg-brand-accent text-brand-accent-foreground px-8 py-4 rounded-full text-base font-semibold hover:brightness-95 transition"
          >
            {t("hero.cta")}
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
