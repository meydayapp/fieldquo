"use client";

// app/components/sales/ReviewedByOwner.js
//
// "Reviewed by the owner on 14 Sep 2026" — the small muted line a rep sees on
// a text or email thread the owner has read from the console.
//
// It is drawn from the audit row (lib/sales/conversationAudit.js
// lastReviewOf), never from a flag set beside it, so the notice and the
// record cannot disagree: if the log says the owner looked, the rep is told;
// if the log could not be read, nothing is drawn — "not reviewed" is the
// safe reading of "could not look", and a line that said "never reviewed"
// in that case would be a claim nobody checked.
//
// Muted and small on purpose. It is information, not a warning: the owner
// reading a rep's conversations is a stated part of the job (the sales
// manual says so in chapter 9), and the line exists so it is never a secret.
import { Eye } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function ReviewedByOwner({ review, className = "" }) {
  const { t, language } = useTranslation();
  const at = review?.at ? new Date(review.at) : null;
  if (!at || Number.isNaN(at.getTime())) return null;
  let date;
  try {
    date = at.toLocaleDateString(language || undefined, { dateStyle: "medium" });
  } catch {
    date = at.toLocaleDateString(undefined, { dateStyle: "medium" });
  }
  return (
    <p
      className={`flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}
      data-reviewed-by-owner
    >
      <Eye size={12} aria-hidden="true" />
      <time dateTime={at.toISOString()}>{t("app.salesText.reviewedByOwner", { date })}</time>
    </p>
  );
}
