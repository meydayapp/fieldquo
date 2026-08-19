// app/components/marketing/NotFoundContent.js
//
// The body of the 404 page. Client, because the copy is translated and
// translation lives in React context.
"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useIndustryLabels } from "@/app/hooks/useIndustryLabels";

export default function NotFoundContent() {
  const { t } = useTranslation();
  const industries = useIndustryLabels();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        404
      </p>
      <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-foreground">
        {t("notFound.title")}
      </h1>
      <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
        {t("notFound.body")}
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-full text-sm font-semibold"
        >
          {t("notFound.home")} <ArrowRight size={16} />
        </Link>
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 border border-border px-6 py-3 rounded-full text-sm font-semibold text-foreground hover:bg-muted"
        >
          {t("nav.pricing")}
        </Link>
        <Link
          href="/contact"
          className="inline-flex items-center gap-2 border border-border px-6 py-3 rounded-full text-sm font-semibold text-foreground hover:bg-muted"
        >
          {t("nav.contact")}
        </Link>
      </div>

      {/* The trades, because the commonest way to land here is a mistyped or
          SMS-truncated link — and the commonest thing behind such a link is an
          industry page or a referral. Giving the visitor somewhere specific to
          go beats a lone "back to home". */}
      <div className="mt-14 pt-10 border-t border-border">
        <h2 className="text-sm font-semibold text-foreground mb-4">
          {t("nav.industries")}
        </h2>
        <div className="flex flex-wrap justify-center gap-2">
          {industries.map((ind) => (
            <Link
              key={ind.slug}
              href={`/industries/${ind.slug}`}
              className="text-sm bg-muted border border-border px-4 py-2 rounded-full hover:bg-muted"
            >
              {ind.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
