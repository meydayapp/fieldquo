// app/components/auth/SignupSteps.js
//
// The progress rail above the signup form.
//
// ══ Why a rail rather than a longer form ═══════════════════════════════════
//
// The funnel already had four steps; nothing here changes that. What it did not
// have was any way to tell how many were left, so the first screen — eleven
// fields, no end in sight — read as the whole thing rather than as a quarter of
// it. Someone who can see three short steps behind the long one finishes the
// long one.
//
// ══ Derived from the funnel, never restated ════════════════════════════════
//
// The rungs come out of lib/signup/funnel.js. A rail with its own hardcoded
// list of four names is precisely the copy that rots: the plan step moved from
// FIRST to LAST during this project, and a second list would still be showing
// it first. `rungsFor` is pure and exported so scripts/check-auth-pages.mjs can
// execute it against both entry states instead of reading the JSX.
"use client";

import { STEPS, firstStep } from "@/lib/signup/funnel";
import { useTranslation } from "@/app/hooks/useTranslation";

/**
 * The rungs a visitor in this state actually walks, in order.
 *
 * STEPS carries both faces of the first rung — "account" for a stranger,
 * "business" for someone who already has a login — and exactly one is ever
 * rendered. Filtering rather than slicing means a step added to the funnel
 * appears here without this file being edited.
 */
export function rungsFor({ accountExists = false } = {}) {
  const entry = firstStep({ accountExists });
  return STEPS.filter(
    (step) => step === entry || (step !== "account" && step !== "business"),
  );
}

// Labels for the rungs, keyed off the step name. "account" and "business" are
// the same rung wearing different clothes and say different things: one creates
// a login and a business, the other adds a business to a login that exists.
const LABELS = {
  account: { key: "auth.steps.account", fallback: "Account" },
  business: { key: "auth.steps.business", fallback: "Business" },
  industry: { key: "auth.steps.industry", fallback: "Trades" },
  services: { key: "auth.steps.services", fallback: "Services" },
  plan: { key: "auth.steps.plan", fallback: "Plan" },
};

export default function SignupSteps({ current, accountExists = false }) {
  const { t } = useTranslation();
  const rungs = rungsFor({ accountExists });
  const index = rungs.indexOf(current);

  // A step this rail does not know about would render every bar unfilled, which
  // states "you have done nothing" to somebody four screens in. Render nothing
  // instead — the form underneath is what matters and it is still there.
  if (index < 0) return null;

  const currentLabel = LABELS[current];

  return (
    <div>
      <ol className="flex items-stretch gap-2 sm:gap-3">
        {rungs.map((rung, i) => {
          const done = i < index;
          const here = i === index;
          const label = LABELS[rung] || { key: `auth.steps.${rung}`, fallback: rung };
          return (
            <li key={rung} className="flex-1 min-w-0">
              {/* The bar is the progress; the number and word name it. Colour
                  alone would carry none of this to a screen reader, which is
                  what aria-current and the sentence below are for. */}
              <div
                className={`h-1 w-full rounded-full ${
                  done || here ? "bg-primary" : "bg-border"
                }`}
                aria-hidden="true"
              />
              <div
                aria-current={here ? "step" : undefined}
                className={`mt-2 flex items-baseline gap-1.5 text-xs ${
                  here
                    ? "text-foreground font-semibold"
                    : done
                      ? "text-foreground"
                      : "text-muted-foreground"
                }`}
              >
                <span className="tabular-nums">{i + 1}</span>
                <span className="truncate">{t(label.key, label.fallback)}</span>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Said in words as well as bars — "Step 2 of 4" is the sentence somebody
          actually wants, and it is the only form of this a screen reader gets. */}
      <p className="mt-3 text-sm text-muted-foreground">
        {t("auth.steps.position", "Step {current} of {total}", {
          current: index + 1,
          total: rungs.length,
        })}
        {currentLabel ? ` — ${t(currentLabel.key, currentLabel.fallback)}` : ""}
      </p>
    </div>
  );
}
