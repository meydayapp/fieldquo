// app/platform/sales/performance/page.js
//
// The sales dashboard the console did not have.
//
// The owner's question was "where do i see the sales KPIs? and insights.. and
// the AI and the leads?" and the honest answer on 2026-09-02 was "nowhere" —
// SalesAttribution, SalesCommissionEntry, SalesPayoutBatch and SalesLead all
// existed and not one of them was rendered anywhere a superadmin could reach.
//
// ══ The order of this page IS the answer ══════════════════════════════════
//
// Ranked by what gets asked first thing on a Monday, not by what was easiest to
// compute. Signups this week, then who sold them, then what FieldQuo owes for
// them, then the funnel behind them, then the leads that have not become any of
// it yet. The list of companies comes last because it is the drill-down, and
// "not tracked" comes after that because a gap is worth reading once, not every
// morning.
//
// ══ Every arithmetic decision is in lib/sales/performance.js ══════════════
//
// This file formats and lays out. It does not divide two numbers: a percentage
// computed here would bypass the rate floor that exists precisely to stop a rep
// with three signups and a 100% conversion rate topping the table. Where the
// module returns `value: null` the screen prints the fraction the module
// supplied, and never the division.
//
// ══ English only, deliberately ════════════════════════════════════════════
//
// No t() anywhere. All thirty-odd existing /platform screens are English —
// app/i18n/appMessages.js's own note on why the catalogue stops where it does
// applies here: this console is FieldQuo staff only and was never translated,
// and half-translating one page is worse than not translating any.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  Ban,
  BarChart3,
  Loader2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
// The same list the route validates against. Imported rather than read off the
// response so the picker still shows every option when a load fails — a select
// that empties itself on an error is a control that stops working exactly when
// somebody needs to retry. periodPresets.js is pure and has no imports of its
// own, so this costs the client bundle nothing.
import { PERIOD_PRESETS } from "@/lib/analytics/periodPresets";
import { statusMeta } from "@/lib/platform/subscriptionStatus";
import { centsOrNull, UNKNOWN } from "@/lib/platform/metricFormat";

const FIELD =
  "w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-card text-foreground disabled:opacity-60";
const CARD = "rounded-xl border border-border bg-card p-4";
const TH = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const TD = "px-3 py-3 text-sm text-foreground align-top";

/**
 * Cents to dollars. Never a bare division in JSX — a stray one prints $12.3456.
 *
 * `Number(cents) || 0` fabricated a zero here, on the four tiles that say what
 * FieldQuo owes its own reps. Commission owed, reversed, paid, earned: a field
 * that did not arrive printed a confident $0.00, and zero is finite, so nothing
 * downstream could tell afterwards — "we owe nobody anything" and "the ledger
 * did not load" were the same pixels on the screen somebody runs payroll off.
 * Note `Number([])` is 0 as well, so the type is checked before Number() rather
 * than after. That test is centsOrNull in lib/platform/metricFormat.js — the
 * module this cannot simply call for the whole job, because its money() is
 * fixed to CAD and these are the commission ledger's own cents — imported so a
 * check can execute the rule against hostile input rather than grep for it.
 */
function money(cents) {
  const n = centsOrNull(cents);
  if (n === null) return UNKNOWN;
  return `${n < 0 ? "-" : ""}$${Math.abs(n / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function day(value) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

/**
 * A rate, or the counts standing in for it.
 *
 * The whole honesty rule of this page lives in these six lines: when the module
 * says there is no percentage, this prints "3 of 4" and how many more are
 * needed. It never falls back to computing `hit / sampleSize` itself.
 */
function Rate({ value }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  if (value.value !== null) {
    return (
      <span>
        {value.value}%{" "}
        <span className="text-xs text-muted-foreground">({value.hit} of {value.sampleSize})</span>
      </span>
    );
  }
  return (
    <span className="text-muted-foreground">
      {value.hit} of {value.sampleSize}
      <span className="block text-xs">{value.statement}</span>
    </span>
  );
}

function Tile({ icon: Icon, label, value, hint }) {
  return (
    <div className={CARD}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon size={14} className="shrink-0" />
        <span>{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold text-foreground">{value}</div>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default function SalesPerformancePage() {
  const [report, setReport] = useState(null);
  const [preset, setPreset] = useState("thisMonth");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (key) => {
    setLoading(true);
    setError("");
    try {
      setReport(await fetchJson(`/api/platform/sales/performance?preset=${encodeURIComponent(key)}`));
    } catch (err) {
      // Never `if (res.ok)` with no else — fetchJson throws with the server's
      // own sentence and this prints it rather than an empty page that reads
      // as "no sales".
      setError(err?.message || "Could not load sales performance.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(preset);
  }, [load, preset]);

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground">Sales performance</h1>
        <p className="text-sm text-muted-foreground">
          FieldQuo&apos;s own sales operation — who brought which company in,
          what each milestone paid, and what is still in the pipeline. Read-only:
          nothing on this page can change an attribution or a commission entry,
          and nothing ever will.
        </p>
      </header>

      <div>
        <label htmlFor="period" className="block text-sm font-medium text-foreground mb-1">
          Period
        </label>
        <select
          id="period"
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
          className={FIELD}
        >
          {PERIOD_PRESETS.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted-foreground">
          {report?.period?.from
            ? `${day(report.period.from)} to ${day(report.period.to)}. `
            : ""}
          Days are UTC boundaries, matching the payout batch week — so &quot;this
          week&quot; means the same instant for a rep in Kyiv and an owner in
          Gatineau. Lifetime figures below ignore the period on purpose.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-800 dark:text-red-200 flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="animate-spin" size={18} /> Loading…
        </div>
      ) : !report ? null : (
        <>
          {/* ── 1. What happened this week ───────────────────────────────── */}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile
              icon={TrendingUp}
              label="Signups this week"
              value={report.headline.signupsThisWeek}
              hint={`${report.headline.signupsToday} today · week began ${day(report.headline.weekStartsAt)} UTC`}
            />
            <Tile
              icon={BarChart3}
              label="Signups this period"
              value={report.headline.signupsInPeriod}
              hint={`${report.headline.signupsTotal} attributed since the sales portal opened`}
            />
            <Tile
              icon={Wallet}
              label="Commission owed"
              value={money(report.headline.owedCents)}
              hint="Summed from the ledger, less what has actually been paid out. Never a cached total."
            />
            <Tile
              icon={Ban}
              label="Reversed"
              value={money(report.headline.reversedCents)}
              hint={`${money(report.headline.paidCents)} paid out to date`}
            />
          </section>

          {report.headline.repsWithoutPlan > 0 ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200">
              {report.headline.repsWithoutPlan}{" "}
              {report.headline.repsWithoutPlan === 1 ? "rep has" : "reps have"} no
              commission plan. They earn nothing — no ledger row is written at
              all, deliberately, because paying an invented figure is worse than
              paying late — and their companies are invisible to the payment
              stages of the funnel below.
            </div>
          ) : null}

          {/* ── 2. Who sold them ─────────────────────────────────────────── */}
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Reps</h2>
            <p className="text-sm text-muted-foreground">
              Ranked by signups this week. A deactivated rep stays here with
              their history: their attributions and ledger are the record of who
              brought which company in, and a milestone their company reaches
              later still pays them.
            </p>
            <div className={`${CARD} p-0 overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className={TH}>Rep</th>
                      <th className={TH}>This week</th>
                      <th className={TH}>This period</th>
                      <th className={TH}>Total</th>
                      <th className={TH}>Milestones</th>
                      <th className={TH}>Owed</th>
                      <th className={TH}>Leads won</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.reps.length === 0 ? (
                      <tr>
                        <td className={TD} colSpan={7}>
                          No sales reps yet.{" "}
                          <Link href="/platform/sales/reps" className="underline">
                            Add one
                          </Link>
                          .
                        </td>
                      </tr>
                    ) : (
                      report.reps.map((rep) => (
                        <tr key={rep.id} className="border-t border-border">
                          <td className={TD}>
                            <div className="font-medium text-foreground">{rep.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{rep.code}</div>
                            {!rep.active ? (
                              <div className="text-xs text-muted-foreground">
                                Deactivated {day(rep.endedAt)} — history kept
                              </div>
                            ) : null}
                            {!rep.hasCommissionPlan ? (
                              <div className="text-xs text-amber-700 dark:text-amber-300">
                                No commission plan
                              </div>
                            ) : null}
                          </td>
                          <td className={TD}>{rep.signups.thisWeek}</td>
                          <td className={TD}>{rep.signups.inPeriod}</td>
                          <td className={TD}>{rep.signups.total}</td>
                          <td className={TD}>
                            <div className="text-xs text-muted-foreground">
                              <div>Activated: {rep.milestones.activation}</div>
                              <div>First payment: {rep.milestones.first_payment}</div>
                              <div>Still paying: {rep.milestones.retention}</div>
                            </div>
                          </td>
                          <td className={TD}>
                            <div>{money(rep.commission.owedCents)}</div>
                            <div className="text-xs text-muted-foreground">
                              {money(rep.commission.earnedCents)} earned
                              {rep.commission.reversalCount > 0
                                ? `, ${money(rep.commission.reversedCents)} reversed`
                                : ""}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {money(rep.commission.paidCents)} paid
                            </div>
                          </td>
                          <td className={TD}>
                            <Rate value={rep.leads.winRate} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ── 3. What happened to the companies they brought in ─────────── */}
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Acquisition funnel</h2>
            <div className={`${CARD} space-y-3`}>
              {report.funnel.stages.map((stage) => (
                <div key={stage.key} className="flex items-baseline justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">{stage.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {stage.source === "fact"
                        ? "Read off the company itself."
                        : "Counted from the commission ledger — the only record of this stage."}
                    </div>
                  </div>
                  <div className="text-xl font-bold text-foreground">{stage.count}</div>
                </div>
              ))}
              <div className="border-t border-border pt-3 space-y-1 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-muted-foreground">Reached activation</span>
                  <Rate value={report.funnel.activationRate} />
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-muted-foreground">Still paying at 60 days</span>
                  <Rate value={report.funnel.retentionRate} />
                </div>
              </div>
              {report.funnel.incompleteReason ? (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {report.funnel.incompleteReason}
                </p>
              ) : null}
            </div>
          </section>

          {/* ── 4. What has not become any of it yet ──────────────────────── */}
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Leads</h2>
            <div className={`${CARD} space-y-3`}>
              <div className="grid gap-2 sm:grid-cols-5">
                {report.pipeline.byStatus.map((s) => (
                  <div key={s.key} className="rounded-lg border border-border p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      {s.label}
                    </div>
                    <div className="text-xl font-bold text-foreground">{s.count}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-muted-foreground">
                    Won, of the leads that reached an outcome
                  </span>
                  <Rate value={report.pipeline.winRate} />
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-muted-foreground">
                    Became a company, of every lead entered
                  </span>
                  <Rate value={report.pipeline.conversionRate} />
                </div>
              </div>
              {report.pipeline.unknownStatus > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {report.pipeline.unknownStatus} lead
                  {report.pipeline.unknownStatus === 1 ? " carries" : "s carry"} a
                  status outside the documented five and {report.pipeline.unknownStatus === 1 ? "is" : "are"}{" "}
                  counted in the totals but in none of the columns above.
                </p>
              ) : null}
            </div>
          </section>

          {/* ── 5. The drill-down ─────────────────────────────────────────── */}
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">
              Companies brought in
            </h2>
            <div className={`${CARD} p-0 overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className={TH}>Company</th>
                      <th className={TH}>Rep</th>
                      <th className={TH}>Signed up</th>
                      <th className={TH}>Doing now</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.acquisitions.length === 0 ? (
                      <tr>
                        <td className={TD} colSpan={4}>
                          No company has been attributed to a rep yet.
                        </td>
                      </tr>
                    ) : (
                      report.acquisitions.map((a) => (
                        <tr key={a.companyId} className="border-t border-border">
                          <td className={TD}>
                            <Link
                              href={`/platform/companies/${a.companyId}`}
                              className="font-medium text-foreground underline inline-flex items-center gap-1"
                            >
                              {a.companyName || a.companyId}
                              <ArrowUpRight size={12} className="shrink-0" />
                            </Link>
                            {a.isDemo ? (
                              <div className="text-xs text-muted-foreground">Demo account</div>
                            ) : null}
                          </td>
                          <td className={TD}>{a.repName || "—"}</td>
                          <td className={TD}>
                            <div>{day(a.capturedAt)}</div>
                            <div className="text-xs text-muted-foreground">via {a.source}</div>
                          </td>
                          <td className={TD}>
                            {/* The fourth copy of the status map, avoided.
                                `past_due` printed raw here, in the same weight
                                as "active", on the table a superadmin reads to
                                see what happened to a rep's book — and a
                                company that IS past due is the one row on it
                                that matters. statusMeta also keeps "no status"
                                and "a status we do not recognise" apart, which
                                `|| "No subscription"` could not. */}
                            <span
                              className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${statusMeta(a.subscriptionStatus).className}`}
                            >
                              {a.subscriptionStatus
                                ? statusMeta(a.subscriptionStatus).label
                                : "No subscription"}
                            </span>
                            <div className="text-xs text-muted-foreground">
                              {a.planName || "No plan"} ·{" "}
                              {a.chargesEnabled ? "can take payments" : "cannot take payments yet"}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ── 6. What this page refuses to print ───────────────────────── */}
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Not tracked</h2>
            <p className="text-sm text-muted-foreground">
              Figures a sales dashboard is normally expected to carry, and the
              input each one is actually missing. A zero here would read as a
              measurement.
            </p>
            <div className="space-y-3">
              {report.notTracked.map((n) => (
                <div key={n.key} className={CARD}>
                  <div className="text-sm font-medium text-foreground">{n.label}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{n.reason}</p>
                </div>
              ))}
            </div>
          </section>

          <p className="text-xs text-muted-foreground">
            A percentage only appears once there are {report.floors.rate} outcomes
            behind it. Below that the counts are shown instead — a rep with three
            signups and three conversions is not a 100% closer, and a table
            sorted by that number would say they were.
          </p>
        </>
      )}
    </div>
  );
}
