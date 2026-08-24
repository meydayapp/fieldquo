"use client";

// app/app/settings/reviews/EmbedSnippet.js
//
// The reviews embed, offered where the reviews are.
//
// The body of this moved to app/components/settings/EmbedCode.js when the
// booking calendar and the instant estimate needed exactly the same block on
// their own screens. The reasoning that used to live here — why the reviews
// snippet has to be reachable outside the website builder, and why the string
// itself belongs in lib/embed/snippet.js — went with it, because none of it
// was ever specific to reviews.
//
// Kept as a named wrapper rather than deleted: this screen is the one that
// decides reviews are shown before there are any to show. The embed renders
// nothing and collapses to no height when a company has no approved reviews,
// so pasting it early is safe — and asking someone to come back after
// approving their first review is how it never gets pasted at all.

import EmbedCode from "@/app/components/settings/EmbedCode";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function EmbedSnippet({ slug }) {
  const { t } = useTranslation();
  return (
    <EmbedCode
      slug={slug}
      widget="reviews"
      title={t("app.reviewsEmbed.frameTitle")}
      heading={t("app.reviewsEmbed.heading")}
      note={t("app.reviewsEmbed.note")}
    />
  );
}
