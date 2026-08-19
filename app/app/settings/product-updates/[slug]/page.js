// app/app/settings/product-updates/[slug]/page.js
//
// One changelog entry, long form. Content comes from lib/data/productUpdates.js
// — the same array the list prints — so writing a post is editing one file, not
// a migration and an admin screen.
//
// The back link here IS a parent link and is allowed to be hardcoded: this
// route is a child of the list, so "Back to Product Updates" is true however
// you arrived. That is the opposite of the settings drill-down bar, which has
// to know where you actually came from before it claims anything.
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { findProductUpdate, formatUpdateDate } from "@/lib/data/productUpdates";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function ProductUpdatePage() {
  const { t, language } = useTranslation();
  // `useParams` rather than the page's `params` prop: params is a Promise in
  // Next 16 and this is a client component.
  const { slug } = useParams();
  const update = findProductUpdate(Array.isArray(slug) ? slug[0] : slug);

  const backLink = (
    <Link
      href="/app/settings/product-updates"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft size={14} /> {t("app.productUpdates.backToAll")}
    </Link>
  );

  // A hand-typed or stale URL. Say so and offer the way back rather than
  // rendering an empty article.
  if (!update)
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
        {backLink}
        <p className="text-sm text-muted-foreground">
          {t("app.productUpdates.notFound")}
        </p>
      </div>
    );

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      {backLink}

      <div>
        <div className="text-xs text-muted-foreground mb-1">
          {formatUpdateDate(update.date, language)}
        </div>
        <h1 className="text-2xl font-bold text-foreground">{update.title}</h1>
        <p className="text-sm text-muted-foreground mt-2">{update.body}</p>
      </div>

      <article className="bg-card border border-border rounded-xl p-5 space-y-4">
        {update.post.map((paragraph, i) => (
          <p
            key={i}
            className="text-sm text-foreground leading-relaxed"
          >
            {paragraph}
          </p>
        ))}
      </article>
    </div>
  );
}
