// app/app/invoices/[id]/CostPanel.js
//
// What the job was estimated to cost, what it was costed at on the invoice, and
// what it actually cost. Three different numbers, and the whole value of the
// panel is that it never collapses them into one.
//
//   estimated  QuoteCosting.totalCost — the snapshot taken when the quote was
//              priced. Read back, never recomputed: the company's overhead and
//              rates move, and a variance that changes on an invoice nobody
//              touched is worse than no variance.
//   costed     InvoiceCosting.totalCost — what somebody typed on this invoice's
//              cost panel, computed server-side from their crew and hours.
//   actual     Expenses tagged to the job plus APPROVED timesheet hours. The
//              only one of the three that is a sum of things that happened.
//
// A screen showing one of them labelled "cost" would be lying by omission the
// moment two of them disagreed — which is the normal case and the interesting
// one.
//
// ── Internal, and structurally so ──────────────────────────────────────────
//
// Nothing here reaches a client surface. InvoiceCosting is a separate table
// precisely so it cannot ride along on the portal's `client.invoices` response
// (see the model's own comment), and the lifecycle endpoint omits the whole
// costing block for anyone without the jobCosting toggle rather than sending
// zeroes.
"use client";

import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";

export default function CostPanel({
  saved,
  lifecycleCosting,
  money,
  editHref,
}) {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();

  const estimated = lifecycleCosting?.estimatedCost ?? null;
  const actual = lifecycleCosting?.actual || null;
  const cmp = lifecycleCosting?.comparison || null;
  const totals = saved?.totals || null;
  const crew = Array.isArray(saved?.crew) ? saved.crew : [];

  // Nothing measured at all. Rendering an empty card with three "—" would be a
  // heading over a blank panel; the page shows nothing instead.
  if (!totals && !actual && estimated == null) return null;

  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h2 className="font-semibold text-foreground">
          {t("app.invoiceCost.title")}{" "}
          <span className="text-xs font-normal text-muted-foreground">
            {t("app.invoiceCost.internal")}
          </span>
        </h2>
        {editHref && (
          <Link href={editHref} className="text-xs font-semibold underline">
            {t("app.invoiceCost.editHours")}
          </Link>
        )}
      </div>

      {/* ── Quoted vs actual ────────────────────────────────────────────────
          The variance the job costing endpoint could not compute until
          QuoteCosting existed. Shown only when BOTH sides are real: a variance
          against a missing estimate is not 0%, it is unknown, and
          compareJobCost returns null rather than inventing it. */}
      {(estimated != null || actual) && (
        <div className="mb-4 grid gap-2 sm:grid-cols-3">
          <Figure
            label={t("app.invoiceCost.estimated")}
            value={estimated == null ? null : money(estimated)}
            note={
              estimated == null
                ? t("app.invoiceCost.noEstimate")
                : lifecycleCosting?.estimatedAt
                  ? t("app.invoiceCost.estimatedAt", {
                      date: formatDate(lifecycleCosting.estimatedAt),
                    })
                  : null
            }
          />
          <Figure
            label={t("app.invoiceCost.actual")}
            value={actual ? money(actual.total) : null}
            note={
              !actual
                ? t("app.invoiceCost.noJobLinked")
                : actual.incomplete
                  ? t("app.invoiceCost.incomplete")
                  : null
            }
          />
          <Figure
            label={t("app.invoiceCost.variance")}
            value={cmp?.variance == null ? null : money(cmp.variance)}
            note={
              cmp?.variancePct == null
                ? cmp?.variance == null
                  ? t("app.invoiceCost.noVariance")
                  : null
                : `${cmp.variancePct > 0 ? "+" : ""}${cmp.variancePct}%`
            }
            tone={
              cmp?.variance == null
                ? null
                : cmp.overBudget
                  ? "bad"
                  : "good"
            }
          />
        </div>
      )}

      {/* What the actual figure is made of. Pending and unrated hours are
          named rather than folded in — a job that looks profitable only because
          nobody priced the crew is the worst kind of wrong number. */}
      {actual && (
        <div className="mb-4 space-y-1 text-sm">
          <Row
            label={t("app.invoiceCost.approvedHours", {
              hours: t("app.duration.hours", {
                value: actual.labour.approvedHours,
              }),
            })}
            value={money(actual.labour.cost)}
          />
          {actual.expenses.total > 0 && (
            <Row
              label={t("app.invoiceCost.jobExpenses")}
              value={money(actual.expenses.total)}
            />
          )}
          {actual.labour.pendingHours > 0 && (
            <p className="text-xs text-amber-800 dark:text-amber-300">
              {t("app.invoiceCost.pendingHours", {
                hours: t("app.duration.hours", {
                  value: actual.labour.pendingHours,
                }),
              })}
            </p>
          )}
          {actual.labour.unratedHours > 0 && (
            <p className="text-xs text-amber-800 dark:text-amber-300">
              {t("app.invoiceCost.unratedHours", {
                hours: t("app.duration.hours", {
                  value: actual.labour.unratedHours,
                }),
              })}
            </p>
          )}
        </div>
      )}

      {/* ── What was costed ON THIS INVOICE ────────────────────────────────
          Read back, not recomputed — these figures were worked out server-side
          when the invoice was costed. The editor recomputes live while you
          type; this is the record. */}
      {totals ? (
        <>
          {crew.length > 0 && (
            <div className="mb-2 space-y-0.5 text-xs text-muted-foreground">
              {crew.map((m, i) => (
                <div key={i} className="flex justify-between gap-3">
                  <span>
                    {m.name || t("app.invoiceCost.crewMember")} —{" "}
                    {Number(m.hours) || 0} × {money(m.rate)}
                  </span>
                  <span className="tabular-nums">
                    {money((Number(m.hours) || 0) * (Number(m.rate) || 0))}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-1 text-sm">
            <Row
              label={t("app.invoiceCost.labour")}
              value={money(totals.labourCost)}
            />
            <Row
              label={t("app.invoiceCost.materials")}
              value={money(totals.materialCost)}
            />
            <Row
              label={t("app.invoiceCost.overhead")}
              value={money(totals.overhead)}
            />
            <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1">
              <span>{t("app.invoiceCost.costedTotal")}</span>
              <span className="tabular-nums">{money(totals.totalCost)}</span>
            </div>
            {/* Null rather than 0% when there is no pre-tax revenue to measure
                against — compareJobCost refuses to divide by nothing, and a
                made-up 0% would read as "this job broke even". */}
            {profitOf(totals.totalCost, lifecycleCosting?.revenue) !== null && (
              <div
                className={`flex justify-between font-semibold ${
                  profitOf(totals.totalCost, lifecycleCosting?.revenue) < 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-foreground"
                }`}
              >
                <span>{t("app.invoiceCost.profit")}</span>
                <span className="tabular-nums">
                  {money(profitOf(totals.totalCost, lifecycleCosting?.revenue))}
                  {marginOf(totals.totalCost, lifecycleCosting?.revenue) !== null
                    ? ` (${marginOf(totals.totalCost, lifecycleCosting?.revenue)}%)`
                    : ""}
                </span>
              </div>
            )}
          </div>
          {saved?.note ? (
            <p className="mt-3 text-xs text-muted-foreground whitespace-pre-wrap">
              {saved.note}
            </p>
          ) : null}
        </>
      ) : (
        // Said plainly. The figures above are the JOB's, and an invoice nobody
        // costed has no crew or materials of its own — which is a different
        // statement from "it cost nothing".
        <p className="text-sm text-muted-foreground">
          {t("app.invoiceCost.notCosted")}
        </p>
      )}
    </section>
  );
}

// Kept as small local helpers rather than importing compareJobCost: this is the
// profit on what the INVOICE was costed at, and compareJobCost's `actualCost`
// means the job's measured spend. Passing one where the other is meant is the
// mistake worth making impossible.
function profitOf(cost, revenue) {
  if (revenue == null || cost == null) return null;
  const r = Number(revenue);
  const c = Number(cost);
  if (!Number.isFinite(r) || !Number.isFinite(c)) return null;
  return Math.round((r - c) * 100) / 100;
}
function marginOf(cost, revenue) {
  const p = profitOf(cost, revenue);
  const r = Number(revenue);
  if (p === null || !r) return null;
  return Math.round((p / r) * 1000) / 10;
}

/** One of the three headline figures, or an honest blank. */
function Figure({ label, value, note, tone }) {
  const Icon = tone === "bad" ? TrendingUp : tone === "good" ? TrendingDown : null;
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`text-base font-semibold tabular-nums flex items-center gap-1 ${
          tone === "bad"
            ? "text-red-600 dark:text-red-400"
            : tone === "good"
              ? "text-green-700 dark:text-green-400"
              : "text-foreground"
        }`}
      >
        {Icon && <Icon size={14} />}
        {/* An em dash, not a zero. "We have not measured this" and "this cost
            nothing" are different facts and must not share a rendering. */}
        {value ?? "—"}
      </p>
      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3 text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
