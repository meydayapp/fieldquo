// app/components/quotes/builder/QuoteReadiness.js
//
// What is still missing from this quote, live, as it is written.
//
// ── Why this is free ────────────────────────────────────────────────────────
//
// These are the same checks the AI review runs, from lib/quotes/completeness.js
// — and none of them ever needed a model. "Has this quote got an expiry date"
// is a null check. They only lived behind an API call because they sat in a
// file that imports Prisma, so reaching them meant saving the quote and
// spending a model call to be told something the browser already knew.
//
// So the cheap half runs here on every keystroke, for nothing, and the AI keeps
// the judgement it is actually good at: whether the price fits this company's
// own history, and which add-ons this client is likely to want.
//
// ── Not a score out of ten ──────────────────────────────────────────────────
//
// A quote is not 73% good, and a number invites gaming the number — somebody
// adding a photo to move a gauge rather than because the job needed one. What a
// person can act on is "two things worth fixing before this goes out", so that
// is what this says.
"use client";

import { useState } from "react";
import { AlertTriangle, Check, ChevronDown } from "lucide-react";
import {
  completenessChecks,
  completenessSummary,
} from "@/lib/quotes/completeness";

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

export default function QuoteReadiness({ draft, items, t }) {
  const [open, setOpen] = useState(false);

  // Recomputed on render rather than memoised: it is a handful of null checks
  // and a regex over a few line items, and a stale readiness panel is worse
  // than a redundant one.
  const summary = completenessSummary(completenessChecks(draft, items));
  if (summary.checks.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
        <Check size={13} />
        {t("app.quoteNew.readinessClear", "Nothing obvious missing")}
      </div>
    );
  }

  const sorted = [...summary.checks].sort(
    (a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3),
  );

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span
          className={`flex items-center gap-1.5 text-xs font-medium ${
            summary.blocking > 0
              ? "text-amber-700 dark:text-amber-400"
              : "text-muted-foreground"
          }`}
        >
          {summary.blocking > 0 ? (
            <AlertTriangle size={13} />
          ) : (
            <Check size={13} />
          )}
          {/* Counts what is worth acting on. Low-severity notes are listed but
              never counted here — a quote with no photos is worse, not wrong,
              and a badge that never reaches zero stops being read. */}
          {summary.blocking > 0
            ? t("app.quoteNew.readinessCount", { value: summary.blocking })
            : t("app.quoteNew.readinessMinor", "Worth a look")}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul className="mt-2 space-y-1.5">
          {sorted.map((c) => (
            <li key={c.id} className="flex gap-2">
              <span
                aria-hidden="true"
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  c.severity === "high"
                    ? "bg-amber-600"
                    : c.severity === "medium"
                      ? "bg-amber-500/70"
                      : "bg-muted-foreground/40"
                }`}
              />
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">{c.title}</p>
                <p className="text-xs text-muted-foreground">{c.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
