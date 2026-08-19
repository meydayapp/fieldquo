"use client";

// app/app/settings/reviews/EmbedSnippet.js
//
// The reviews embed, offered where the reviews are.
//
// ── Why it also lives here ─────────────────────────────────────────────────
//
// It was only on Settings → Website → Fine-tune, which is behind the
// `website_builder` feature and only renders once a FieldQuo site exists. So
// the one contractor the embed was built for — the one who already has a
// website, keeps their reviews here, and is never going to build a second site
// — was the one person who could not reach it. This screen is where they
// already are.
//
// ── One string, two screens ────────────────────────────────────────────────
//
// The snippet itself comes from lib/embed/snippet.js. A second copy of it here
// would be the copy nobody looks at, because it renders inside a stranger's
// website where no one at FieldQuo will ever see it break.
//
// ── Shown before there is anything to show ─────────────────────────────────
//
// Deliberately not gated on having approved reviews. The embed renders nothing
// at all when there are none and collapses to no height, so pasting it early
// is safe — and asking someone to come back to a settings screen later, after
// they have approved their first review, is how it never gets pasted.

import { useEffect, useState } from "react";
import { Check, Code2, Copy } from "lucide-react";
import { embedSnippet } from "@/lib/embed/snippet";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function EmbedSnippet({ slug }) {
  const { t } = useTranslation();
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const snippet = embedSnippet({
    origin,
    slug,
    widget: "reviews",
    title: t("app.reviewsEmbed.frameTitle"),
  });

  // Empty until the origin has arrived on mount, and empty for a company with
  // no slug at all. Rendering the heading over an empty box would be a control
  // that offers something it hasn't got.
  if (!snippet) return null;

  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Code2 size={15} /> {t("app.reviewsEmbed.heading")}
      </p>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
        {t("app.reviewsEmbed.note")}
      </p>
      <pre className="mt-3 bg-muted border border-border rounded-lg p-3 text-[11px] leading-relaxed overflow-x-auto">
        {snippet}
      </pre>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(snippet);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? t("app.action.copied") : t("app.action.copyCode")}
      </button>
    </div>
  );
}
