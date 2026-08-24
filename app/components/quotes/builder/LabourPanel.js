// app/components/quotes/builder/LabourPanel.js
//
// "How long it takes" — the itemised crew-hours behind a takeoff.
//
// INTERNAL. Nothing here reaches the client's quote, the PDF or the email. The
// priced line items do that; this is the estimator's own view of the bet they
// are making on the margin.
//
// Shared rather than copied. Roofing and paving both have component labour
// engines that return the same shape ({ hours, breakdown, fixedHours, ... }),
// and the second copy of a panel like this is the one that rots — it is the
// one nobody looks at when the first is changed. Any trade whose engine returns
// that shape gets this panel by passing it in.
"use client";

import { Num } from "./fields";

export default function LabourPanel({
  detail,
  crewSize,
  onCrewSize,
  crew,
  // A sentence under the rows explaining what the multipliers did. Trade-
  // specific, because "pitch × storeys" and "complexity × access" are not the
  // same sentence and a generic one would say neither.
  factorNote,
  emptyHint = "Enter the area first.",
}) {
  if (!detail) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-foreground">
          How long it takes
        </span>
        <span className="text-xs text-muted-foreground">internal only</span>
      </div>

      {detail.incomplete ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {detail.warnings?.[0] || emptyHint}
        </p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-lg font-semibold tabular-nums text-foreground">
              {detail.hours} crew-hours
            </span>
            <span className="text-xs text-muted-foreground">
              {detail.hoursPerSquare ?? detail.hoursPerSqft} h per{" "}
              {detail.hoursPerSquare !== undefined ? "square" : "sqft"}, all in
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Crew of</span>
            <div className="w-16">
              <Num value={crewSize} min={1} step={1} onChange={onCrewSize} />
            </div>
            <span className="text-xs text-muted-foreground">
              → {crew.crewHours} h each, about{" "}
              <strong className="text-foreground">{crew.days} days</strong> on
              site at {crew.hoursPerDay} productive hours a day
              {crew.crewEfficiency !== 1
                ? ` (×${crew.crewEfficiency} for crew size)`
                : ""}
            </span>
          </div>

          <ul className="mt-2 space-y-0.5">
            {detail.breakdown.map((row) => (
              <li
                key={row.key}
                className="flex items-baseline justify-between gap-2 text-xs"
              >
                <span className="text-muted-foreground">
                  {row.label}
                  {row.detail ? (
                    <span className="ml-1.5 text-[11px] opacity-70">
                      {row.detail}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 tabular-nums text-foreground">
                  {row.hours} h
                </span>
              </li>
            ))}
          </ul>

          {factorNote && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {factorNote}
            </p>
          )}

          {detail.warnings?.map((w) => (
            <p
              key={w}
              className="mt-1 text-[11px] text-amber-700 dark:text-amber-400"
            >
              {w}
            </p>
          ))}
        </>
      )}
    </div>
  );
}
