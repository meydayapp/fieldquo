// app/components/dashboard/StepEstimate.js
"use client";

// The small "1–3 min" beside a set-up row. Both dashboard cards use it; the
// figures themselves live on the step definitions (lib/onboarding.js,
// lib/setupSteps.js — `minutes: [low, high]`, each with its reasoning), never
// in JSX, so a changed estimate is changed in one place.
//
// Placement is the card's layout, not this component's: `variant="side"` is
// the right-aligned copy shown from sm up, `variant="below"` the line under
// the title on a phone. Each hides itself at the other width, so exactly one
// is ever displayed (and read out — display:none leaves the tree).
//
// A step with no estimate renders nothing. Absence of a figure is not a
// figure; an invented "2 min" on a row nobody measured would be the padding
// AGENTS.md failure class #5 describes.
//
// Colour: text-muted-foreground on the card is 6.46:1 light and 7.78:1 dark
// (6.07 / 8.64 on the page background, 5.79 / 6.72 on the row hover) — over
// 4.5:1 everywhere this is drawn, measured from the tokens in globals.css.
import { Clock } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

/** "1–3 min", "5 min", or null when the step carries no usable estimate. */
export function estimateText(t, minutes) {
  if (!Array.isArray(minutes) || minutes.length !== 2) return null;
  const [low, high] = minutes.map(Number);
  if (!Number.isFinite(low) || !Number.isFinite(high) || low <= 0 || high < low) return null;
  return low === high
    ? t("app.setup.estimateOne", "{n} min", { n: low })
    : t("app.setup.estimate", "{min}–{max} min", { min: low, max: high });
}

export default function StepEstimate({ minutes, variant = "side" }) {
  const { t } = useTranslation();
  const text = estimateText(t, minutes);
  if (!text) return null;
  const where =
    variant === "below"
      ? "flex sm:hidden mt-0.5"
      : "hidden sm:flex shrink-0";
  return (
    <span
      className={`${where} items-center gap-1 text-xs text-muted-foreground tabular-nums whitespace-nowrap`}
      title={t("app.setup.estimateHint", "About how long this takes")}
    >
      <Clock size={12} aria-hidden="true" />
      <span>
        <span className="sr-only">{t("app.setup.estimateHint", "About how long this takes")}: </span>
        {text}
      </span>
    </span>
  );
}
