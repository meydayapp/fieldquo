// app/app/settings/product-updates/page.js
//
// The changelog. Each entry is a summary that stands on its own; entries that
// also have a full write-up link to it. The link is rendered from
// `hasPost()` rather than from the slug alone, so an entry can never advertise
// a post that was never written.
"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  PRODUCT_UPDATES,
  formatUpdateDate,
  hasPost,
} from "@/lib/data/productUpdates";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function ProductUpdatesPage() {
  const { t, language } = useTranslation();
  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("app.productUpdates.title", "Product Updates")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("app.productUpdates.subtitle", "What's new in FieldQuo.")}</p>
      </div>

      <div className="space-y-4">
        {PRODUCT_UPDATES.map((update) => (
          <div
            key={update.date + update.title}
            className="bg-card border border-border rounded-xl p-5"
          >
            <div className="text-xs text-muted-foreground mb-1">
              {formatUpdateDate(update.date, language)}
            </div>
            <h2 className="text-base font-semibold text-foreground">
              {update.title}
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5">{update.body}</p>
            {hasPost(update) && (
              <Link
                href={`/app/settings/product-updates/${update.slug}`}
                className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-foreground hover:underline"
              >
                {t("app.productUpdates.readMore")}
                <ArrowRight size={14} />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
