// app/components/marketing/FeaturesIndustries.js
"use client";

import Link from "next/link";
import { FileText, Calendar, Users, BarChart3 } from "lucide-react";
import { INDUSTRIES } from "@/app/data/industries";
import { useTranslation } from "@/app/hooks/useTranslation";

// Reuses the product.* keys the header and footer already define — the same
// four feature names appear in three places, and duplicating them per
// language is how translations drift out of sync.
const FEATURES = [
  { icon: FileText, key: "quoting", href: "/product/quoting" },
  { icon: Calendar, key: "scheduling", href: "/product/scheduling" },
  { icon: Users, key: "team", href: "/product/team" },
  { icon: BarChart3, key: "analytics", href: "/product/analytics" },
];

export default function FeaturesIndustries() {
  const { t } = useTranslation();

  return (
    <section className="bg-card border-t border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-10">
          {t("features.everything")}
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {FEATURES.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className="border border-border rounded-xl p-6 hover:border-border hover:shadow-sm transition-all"
            >
              <f.icon size={24} className="text-foreground mb-3" />
              <div className="font-medium text-foreground">
                {t(`product.${f.key}.label`)}
              </div>
            </Link>
          ))}
        </div>

        <h3 className="text-lg font-semibold text-foreground text-center mb-6">
          {t("features.anyTrade")}
        </h3>
        <div className="flex flex-wrap justify-center gap-2">
          {INDUSTRIES.map((ind) => (
            <Link
              key={ind.slug}
              href={`/industries/${ind.slug}`}
              className="text-sm bg-muted border border-border px-4 py-2 rounded-full hover:border-border hover:bg-muted"
            >
              {ind.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
