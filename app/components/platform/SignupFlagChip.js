// app/components/platform/SignupFlagChip.js
//
// The one chip for a signup's flag, drawn on /platform/signup-origins and
// beside each company under a rep on /platform/sales/reps — one shape so the
// two screens cannot disagree about what "under review" looks like.
//
// Four states, and the fourth is the one that matters: an UNKNOWN country
// (no geo header on the request) is its own neutral chip, never the red one.
// Absence is not a statement.
import { CheckCircle2, Flag } from "lucide-react";

const QUIET =
  "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border";

export default function SignupFlagChip({ flag, flagLabel, reviewedAt, countryKnown = true }) {
  if (!flag || flag === "none") {
    return <span className={QUIET}>{countryKnown ? "No flag" : "Country unknown"}</span>;
  }
  return reviewedAt ? (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900">
      <CheckCircle2 size={11} /> {flagLabel} · reviewed
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900">
      <Flag size={11} /> {flagLabel} · under review
    </span>
  );
}
