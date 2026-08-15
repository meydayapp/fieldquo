// app/components/layout/FeatureRowBadge.js
//
// The little pill on a nav row whose feature is in preview, or locked.
//
// Renders NOTHING for "on" and nothing for "hidden" — a hidden row is not in the
// list at all, and a badge saying "hidden" would be the exact trace that state
// promises not to leave.
//
// ── Why the row is still a link when it's locked ───────────────────────────
//
// A disabled-looking row that does nothing on click is a dead control. The row
// stays a real link; the page it reaches renders the locked screen with the
// reason on it (see FeatureGate). The badge is the warning, not the barrier.
"use client";

import { Lock } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { navRowState } from "@/lib/features/nav";

export default function FeatureRowBadge({ navKey, flags, tone = "rail" }) {
  const { t } = useTranslation();
  const { state } = navRowState(navKey, flags);

  if (state !== "preview" && state !== "locked") return null;

  // Two palettes because the rail is navy and the settings panel is a card.
  // Both pairings are amber-on-wash / muted-on-wash, which check:sidebar's
  // contrast rules already measure for the surrounding tokens.
  const railTone =
    state === "preview"
      ? "bg-amber-400/20 text-amber-200"
      : "bg-sidebar-accent text-sidebar-accent-foreground";
  const panelTone =
    state === "preview"
      ? "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300"
      : "bg-muted text-muted-foreground";

  return (
    <span
      className={`ml-auto shrink-0 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        tone === "rail" ? railTone : panelTone
      }`}
    >
      {state === "locked" && <Lock size={9} />}
      {t(state === "preview" ? "app.feature.badgePreview" : "app.feature.badgeLocked")}
    </span>
  );
}
