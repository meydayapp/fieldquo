// app/components/marketing/FeaturesIndustries.js
"use client";

import Link from "next/link";
import { FileText, Calendar, Users, BarChart3, ArrowRight } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useIndustryLabels } from "@/app/hooks/useIndustryLabels";

// Reuses the product.* keys the header and footer already define — the same
// four feature names appear in three places, and duplicating them per
// language is how translations drift out of sync.
//
// `product.<key>.description` is the other half of each entry, and until now
// this band rendered only the label. Four bordered boxes carrying two words
// each is not a feature band; it is a table of contents with a lot of
// whitespace. The descriptions were already written and already translated
// into every language in the catalogue — the same defect the hero had, one
// section down: the copy existed, nothing rendered it.
const FEATURES = [
  { icon: FileText, key: "quoting", href: "/product/quoting" },
  { icon: Calendar, key: "scheduling", href: "/product/scheduling" },
  { icon: Users, key: "team", href: "/product/team" },
  { icon: BarChart3, key: "analytics", href: "/product/analytics" },
];

export default function FeaturesIndustries() {
  const { t } = useTranslation();
  // Translated trade names. These were rendering app/data/industries.js
  // labels, which are English-only — a strip of English in the middle of an
  // otherwise translated page.
  const industries = useIndustryLabels();

  return (
    <section className="bg-card border-t border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center">
          {t("features.everything")}
        </h2>

        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {FEATURES.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              // `group` so the arrow below can answer the hover. Without it the
              // arrow is decoration; with it the whole card is visibly one
              // control, which is what it is.
              //
              // hover:border-border on an element already border-border was a
              // hover state that changed nothing — it read as deliberate and
              // did not exist. Same failure as a dead button, one layer down.
              className="group flex flex-col border border-border rounded-2xl p-6 transition-all hover:border-primary/40 hover:shadow-md"
            >
              {/* The icon carried no weight floating loose above the label at
                  24px. On its own washed tile it reads as the card's subject
                  at a glance, which is the whole job of this band on a phone.
                  foreground on muted measures 15.67:1 light and 12.52:1 dark —
                  text-primary was the first choice and it is 4.31:1 on muted in
                  dark, under the floor, so it is not used here. */}
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-foreground">
                <f.icon size={22} />
              </span>

              <div className="mt-4 font-semibold text-foreground">
                {t(`product.${f.key}.label`)}
              </div>

              {/* flex-1 so the four descriptions, which are different lengths
                  in every language, still bottom-align their arrows. */}
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {t(`product.${f.key}.description`)}
              </p>

              {/* The card has always been a link to /product/<slug> and never
                  looked like one. common.learnMore is in the catalogue in every
                  language and had no call site anywhere in app/.
                  text-primary on bg-card measures 12.14:1 light, 4.99:1 dark. */}
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                {t("common.learnMore")}
                <ArrowRight
                  size={15}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </Link>
          ))}
        </div>

        {/* ── "Is this for me?" ──────────────────────────────────────────────
            This strip is the only place on the page a roofer finds the word
            roofing, so it gets a rule and its own air rather than sitting on
            the features like a caption. No count and no "and more" — the list
            is the twelve trades that have an /industries page, and padding it
            with a claim about trades we have no page for is the invented-data
            failure AGENTS.md names. */}
        <div className="mt-16 border-t border-border pt-12">
          <h3 className="text-lg font-semibold text-foreground text-center mb-6">
            {t("features.anyTrade")}
          </h3>
          <div className="flex flex-wrap justify-center gap-2">
            {industries.map((ind) => (
              <Link
                key={ind.slug}
                href={`/industries/${ind.slug}`}
                // Was `hover:border-border hover:bg-muted` on an element already
                // carrying both — twelve links with literally no hover feedback,
                // and this strip is what a visitor scans to answer "is this for
                // me?". bg-card is #ffffff against --muted #eef3f9, so the change
                // is visible; foreground on card measures 15.6:1 light, 14.4:1
                // dark, both above the 4.5:1 floor.
                className="inline-flex items-center min-h-[44px] text-sm bg-muted border border-border px-4 py-2 rounded-full transition-colors hover:border-primary/40 hover:bg-card"
              >
                {ind.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
