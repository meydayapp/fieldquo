// app/components/auth/SignupPreviews.js
//
// What is left of the signup side panel's hand-drawn pictures after
// 2026-09-25, and the chip row the Team and Goals steps answer with.
//
// ══ Where the pictures went ════════════════════════════════════════════════
//
// The owner reviewed the reactive panel with screenshots and said the
// samples did not look like real samples: "look at the UI or the quote email
// template; make it FACTUAL, not some fake render." Every picture a client
// or the office actually sees is now the product's own component or
// template, rendered with the app-guide harness's data inside a scaled frame
// — app/components/auth/samples/ (the quote email from buildQuoteEmail, the
// booking page's SlotCalendar, the scheduler's WeekGrid and DayBoard, the
// client quote page QuoteApproval, the dashboard's tiles, the inbox list and
// the AI team's TeamFlow, and the "Just exploring" collage). The drawings of
// those screens were deleted rather than kept beside them: a drawing of a
// screen is the copy that drifts from it.
//
// ══ What stays drawn here, and why ═════════════════════════════════════════
//
// The services step's price book. It is not a screen from the product — it
// is the list of quote types the visitor just ticked, each with "Set your
// rate", because there is no rate yet: those services do not exist until the
// company is created, and Settings › Services draws rows from Product rows
// this visitor does not have. A drawing that says exactly that is honest; a
// real settings screen full of somebody else's services would not be.
//
// Every component is presentational and takes plain props, so
// scripts/check-signup-aside.mjs renders each one with react-dom/server.
"use client";

import { Check } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

// A frame the drawn picture sits in: the app's card, a small "Sample" tag so
// nobody mistakes the picture for their data. The tag sits ON the frame's
// top border, not inside it, so it never covers a picture's own header.
export function Frame({ children, tag = true, className = "" }) {
  const { t } = useTranslation();
  return (
    <div className={`relative rounded-xl border border-border bg-background p-3 sm:p-4 ${className}`} data-signup-preview>
      {tag ? (
        <span className="absolute right-3 -top-2.5 z-10 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("app.signup.aside.sample", "Sample")}
        </span>
      ) : null}
      {children}
    </div>
  );
}

// ══ Services step: the price book ═════════════════════════════════════════

/**
 * One row per chosen quote type: the service, and a rate column that says
 * "Set your rate" — no figure, because there is none yet and a placeholder
 * number would be the padded default this codebase is swept for.
 */
export function PriceBookPreview({ labels = [] }) {
  const { t } = useTranslation();
  const rows = labels.slice(0, 5);
  return (
    <Frame>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>{t("app.signup.aside.pricebook.service", "Service")}</span>
          <span>{t("app.signup.aside.pricebook.rate", "Your rate")}</span>
          <span className="hidden sm:inline">{t("app.signup.aside.pricebook.margin", "Cost · margin")}</span>
        </div>
        <div className="divide-y divide-border">
          {rows.length ? (
            rows.map((label) => (
              <div key={label} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2" data-pricebook-row>
                <span className="min-w-0 truncate text-sm font-medium text-foreground">{label}</span>
                <span className="rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                  {t("app.signup.aside.pricebook.setRate", "Set your rate")}
                </span>
                <span className="hidden select-none text-xs text-muted-foreground blur-[3px] sm:inline" aria-hidden="true">
                  $ ··· · ·· %
                </span>
              </div>
            ))
          ) : (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              {t("app.signup.aside.pricebook.empty", "Tick a quote type and it appears here.")}
            </p>
          )}
        </div>
      </div>
    </Frame>
  );
}

// ══ Small shared pieces ════════════════════════════════════════════════════

/** A chip row: the Team and Goals steps' answers. One pick, or none. */
export function ChoiceChips({ options, value, onChange, name }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={name}>
      {options.map((o) => {
        const on = value === o.key;
        return (
          <button
            type="button"
            key={o.key}
            onClick={() => onChange(on ? null : o.key)}
            aria-pressed={on}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${
              on ? "border-inverted bg-inverted text-inverted-foreground font-medium" : "border-border bg-card text-foreground hover:bg-muted"
            }`}
          >
            {on ? <Check size={14} className="mr-1 inline -mt-0.5" aria-hidden="true" /> : null}
            {t(o.labelKey, o.label)}
          </button>
        );
      })}
    </div>
  );
}
