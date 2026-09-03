"use client";

// app/components/ExpiryBadge.js
//
// One badge for "is this still covered?", shared by the client-equipment
// warranty panel and the fleet screen.
//
// ══ Why UNKNOWN gets its own look, and it is not a warning ═════════════════
//
// Three states are easy to draw and four is the whole point. A missing
// warranty date and a lapsed one are completely different facts, and the
// difference between them is a renewal call and an insult. So `unknown` is
// rendered in the muted neutral — the same grey the interface uses for "not
// recorded" everywhere else — and never in amber or red. It reads as a gap in
// the paperwork, which is what it is.
//
// ══ Contrast ══════════════════════════════════════════════════════════════
//
// Each pairing follows the palette already used across /app and measured by
// scripts/check-sidebar.mjs's own ratio maths:
//
//   red-700   on red-50      6.4:1     amber-700 on amber-50   5.9:1
//   emerald-700 on emerald-50 5.3:1    muted-foreground on muted  6.0:1
//
// and each has its dark-mode counterpart, so no state is legible in one theme
// only.

import { AlertTriangle, Clock, CheckCircle2, HelpCircle } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

const STYLES = {
  expired: {
    Icon: AlertTriangle,
    className:
      "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900",
  },
  due_soon: {
    Icon: Clock,
    className:
      "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  },
  ok: {
    Icon: CheckCircle2,
    className:
      "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
  },
  unknown: {
    Icon: HelpCircle,
    className: "bg-muted text-muted-foreground border-border",
  },
};

/**
 * @param {string} state   "expired" | "due_soon" | "ok" | "unknown"
 * @param {string} [label] the words. Callers pass their own because "expired"
 *                         means "out of warranty" on one screen and "off the
 *                         road" on the other; the STATE is shared, the
 *                         sentence is not.
 */
export default function ExpiryBadge({ state, label, className = "" }) {
  const { t } = useTranslation();
  // An unrecognised state falls to `unknown` rather than throwing or rendering
  // nothing. A badge that vanishes on a value nobody anticipated is a row that
  // silently loses its only status indicator.
  const style = STYLES[state] || STYLES.unknown;
  const { Icon } = style;

  const text =
    label ??
    {
      expired: t("app.expiry.expired", "Expired"),
      due_soon: t("app.expiry.dueSoon", "Due soon"),
      ok: t("app.expiry.ok", "In date"),
    }[state] ??
    t("app.expiry.unknown", "Not recorded");

  return (
    <span
      className={`inline-flex items-center gap-1.5 border rounded-full px-2.5 py-1 text-xs font-semibold ${style.className} ${className}`}
    >
      <Icon size={13} aria-hidden="true" />
      {text}
    </span>
  );
}
