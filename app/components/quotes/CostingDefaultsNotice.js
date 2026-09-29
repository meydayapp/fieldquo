// app/components/quotes/CostingDefaultsNotice.js
//
// "This margin leans on FieldQuo's guesses" — said on the costing itself, with
// the fix beside each guess.
//
// Shown by the quote page's Cost & margin block and the builder's cost panel,
// and ONLY for the defaults the costing actually used: lib/costing/
// costingDefaults.js decides that from what the costing recorded (nobody on
// the crew at the stored $35 fallback; an overhead basis that is a share of
// the price). A quote costed with a named crew against the company's real
// overhead renders nothing here at all.
//
// Two separate sentences rather than one "some figures are estimated": each
// has its own remedy — assign the people, or tell us the job count — and a
// combined warning makes the reader work out which one applies to them.
"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { formatAppMoney } from "@/lib/format/money";
import { FALLBACK_LABOUR_RATE } from "@/lib/costing/costingDefaults";

export default function CostingDefaultsNotice({
  defaults,
  currency,
  language,
  t,
  // The quote page opens its cost editor; the builder has the picker right
  // below the notice and passes nothing, so no button promises a second way.
  onAssign = null,
  className = "",
}) {
  if (!defaults || (!defaults.labour && !defaults.overhead)) return null;
  const money = (n) => formatAppMoney(n, currency, language);

  return (
    <div
      className={`rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 ${className}`}
      data-costing-defaults
    >
      {defaults.labour && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <AlertTriangle size={12} className="shrink-0" aria-hidden />
          <span>
            {t(
              "app.cost.defaultLabour",
              "Labour is at FieldQuo's {rate}/h default — nobody is assigned to this job yet.",
              { rate: money(FALLBACK_LABOUR_RATE) },
            )}
          </span>
          {onAssign && (
            <button
              type="button"
              onClick={onAssign}
              className="inline-flex min-h-[36px] items-center font-semibold underline"
            >
              {t("app.cost.assignCrew", "Assign")}
            </button>
          )}
        </p>
      )}
      {defaults.overhead && (
        <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${defaults.labour ? "mt-1.5" : ""}`}>
          <AlertTriangle size={12} className="shrink-0" aria-hidden />
          <span>
            {defaults.overheadPct != null
              ? t(
                  "app.cost.defaultOverhead",
                  "Overhead is estimated at {pct}% of the price — tell us how many jobs you do to use your real overhead.",
                  { pct: defaults.overheadPct },
                )
              : t(
                  "app.cost.defaultOverheadShare",
                  "Overhead is estimated as a share of the price — tell us how many jobs you do to use your real overhead.",
                )}
          </span>
          <Link
            href="/app/settings/overhead#capacity"
            className="inline-flex min-h-[36px] items-center font-semibold underline"
          >
            {t("app.cost.setCapacity", "Set your job count")}
          </Link>
        </p>
      )}
    </div>
  );
}
