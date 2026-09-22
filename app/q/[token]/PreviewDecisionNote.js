// app/q/[token]/PreviewDecisionNote.js
//
// What stands where Approve and Decline stand, while the office is previewing
// its own unsent draft.
//
// They are REPLACED rather than disabled, and neither is left on screen to be
// pressed: POST /api/public/quotes/[token] refuses a draft outright, so in a
// preview those two buttons are the exact thing this codebase keeps being
// swept for — a control that appears to work and doesn't. A greyed pair would
// also be misread as "the client will see them greyed", which is the opposite
// of true.
//
// Staff language, like the banner at the top of the page and unlike the
// document between them — see PreviewBanner.js.
"use client";

import { useTranslation } from "@/app/hooks/useTranslation";

export default function PreviewDecisionNote() {
  const { t } = useTranslation();
  return (
    <p
      className="text-center text-sm text-[#2d2520]/70"
      data-quote-preview-decision-note
    >
      {t(
        "app.quotePreview.decisionNote",
        "Approve and Decline appear here for the client once you send the quote.",
      )}
    </p>
  );
}
