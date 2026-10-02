// app/components/marketing/home/FinalCTA.js
//
// Section 12: the page's last ask, after the FAQ has answered the last
// objection — a reader convinced at the bottom must not have to scroll back
// up or find the nav (on a phone, behind the hamburger).
//
// Not the shared ClosingCTA: that one carries the product pages' wording
// ("Ready to send your first quote?") and this carries the owner-approved
// homepage line. Same button, same trial line component as the hero.
//
// The demo booker lives here now. It was a quiet second action under the old
// hero; the approved hero has two buttons and no third, but a visitor who
// wants to talk to a person still converts, so the working control is kept
// — below the trial, where it cannot compete with it.
"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import DemoBooking from "@/app/components/marketing/DemoBooking";
import { DEMO_BOOKER_ANCHOR } from "@/lib/demo/bookerAnchor";
import TrialLine from "./TrialLine";

export default function FinalCTA() {
  const { t } = useTranslation();

  return (
    <section className="bg-card border-t border-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="rounded-3xl bg-primary px-6 py-12 sm:px-12 sm:py-16 text-center">
          <h2 className="mx-auto max-w-3xl text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-primary-foreground text-balance">
            {t("home.final.title")}
          </h2>
          <p className="mt-4 text-lg sm:text-xl text-primary-foreground/80">{t("home.final.body")}</p>
          <Link
            href="/signup"
            className="mt-8 inline-flex items-center justify-center gap-2 min-h-[48px] rounded-full bg-brand-accent px-8 py-3.5 text-base font-semibold text-brand-accent-foreground shadow-sm transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground"
          >
            {t("home.hero.ctaPrimary")}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <TrialLine className="mt-5 text-sm text-primary-foreground/80" />
        </div>
        {/* The id is where Jennifer's "Book a demo" button lands
            (lib/ai/jennifer/allowlist.js) — and arriving by it opens the
            picker rather than leaving the visitor to find a quiet link. */}
        <div id={DEMO_BOOKER_ANCHOR} className="text-center scroll-mt-24">
          <DemoBooking variant="quiet" openOnHash={DEMO_BOOKER_ANCHOR} />
        </div>
      </div>
    </section>
  );
}
