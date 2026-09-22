// app/q/[token]/PreviewBanner.js
//
// The one thing on /q/<token> that is NOT white-label.
//
// It is drawn only for a signed-in member of the owning company looking at
// their own unsent draft (app/q/[token]/page.js decides; a homeowner never
// reaches this file). Everything below it is the client's document, so this
// strip has to read unmistakably as office chrome rather than as part of the
// quote — hence the dark bar in the app's own type, sitting above the paper
// rather than on it.
//
// ── Why it says what it says ────────────────────────────────────────────────
//
// "The client cannot open this link until you send it" is the fact the
// estimator needs, and it is the fact the page enforces: the same URL answers
// not-found to anyone who is not a member of this company while the quote is a
// draft. A softer "not sent yet" would leave open the reading that the link is
// live but unsent, which is the one thing it must not be taken to mean.
//
// Contractor-facing, so it follows the STAFF language (useTranslation), not
// the document's. The quote below it keeps its own language — non-negotiable
// #6 — and that difference is deliberate: the estimator reads the strip, the
// client reads the document.
"use client";

import { Eye } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function PreviewBanner() {
  const { t } = useTranslation();
  return (
    <div
      // Not sticky. A bar pinned over the document would sit on top of the
      // thing the estimator opened this page to look at, on a phone most of
      // all — the point is to check the client's copy, not to read it through
      // a banner.
      className="w-full bg-[#1f2937] text-white px-4 py-2.5 text-sm flex items-center justify-center gap-2 text-center"
      // 14.7:1 white on #1f2937 (lib/documents/theme.js's arithmetic, run in
      // scripts/check-quote-preview.mjs) — this bar is fixed chrome and never
      // brand-derived, so it cannot be dragged under the bar by a tenant's
      // colour the way a brand-filled strip could.
      data-quote-preview-banner
      role="status"
    >
      <Eye size={15} className="shrink-0" aria-hidden="true" />
      <span>
        {t(
          "app.quotePreview.banner",
          "Preview — the client cannot open this link until you send it.",
        )}
      </span>
    </div>
  );
}
