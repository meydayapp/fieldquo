// app/app/analytics/win-loss/page.js
//
// Won, lost, still out — and, where anybody said, why.
//
// ── The three rules this screen keeps ──────────────────────────────────────
//
// 1. A rate is printed only when the API sends one. `winRate.value` comes back
//    null below the sample floor and null when nothing has been decided, with
//    a code saying which — so this file never computes a percentage of its own
//    and cannot print one the sample does not support. Counts render at every
//    n, because "3 of 4" is honest and "75%" is not.
//
// 2. Unexplained losses are a NUMBER on the page, next to the reasons, not a
//    slice of a pie and not a missing row. If most of a contractor's losses are
//    silent, the loudest thing on this screen should be that they are not
//    asking — which is the one change that would make every future run of this
//    report worth reading.
//
// 3. The reasons are verbatim, newest first, each against its quote and client.
//    No categories: see lib/analytics/winLoss.js rule 3 for why not.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Info, MessageSquareOff, TriangleAlert } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { formatAppMoney } from "@/lib/format/money";
import { presetRange, PERIOD_PRESETS } from "@/lib/analytics/periodPresets";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { useTranslation } from "@/app/hooks/useTranslation";

/** A count, always printable. */
function Stat({ label, value, sub }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

export default function WinLossPage() {
  const { t, language } = useTranslation();
  const { formatDate } = useCompanyPreferences();

  const [preset, setPreset] = useState("thisQuarter");
  const [range, setRange] = useState(() => presetRange("thisQuarter"));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchJson(
        `/api/analytics/win-loss?from=${range.from}&to=${range.to}`,
      );
      setData(res);
    } catch (err) {
      // fetchJson always carries a readable message; there is deliberately no
      // silent `if (res.ok)` branch (AGENTS.md failure class 2).
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    load();
  }, [load]);

  const money = useMemo(() => {
    const currency = data?.currency || null;
    return (amount) => formatAppMoney(amount, currency, language);
  }, [data?.currency, language]);

  const choosePreset = (key) => {
    setPreset(key);
    setRange(presetRange(key));
  };

  const counts = data?.counts;
  const reasons = data?.reasons;

  // The rate, or the sentence that says why there isn't one. Two different
  // nulls, two different sentences — "nothing decided yet" and "too few to
  // read" are opposite situations and a shared blank would hide both.
  const rateText = (r) => {
    if (!r) return "—";
    if (r.value !== null) return `${Math.round(r.value * 100)}%`;
    if (r.suppressed === "none_yet") return t("app.winLoss.noneDecided", "None decided yet");
    return t("app.winLoss.tooFew", "Too few to read");
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg md:text-xl font-semibold">
          {t("app.winLoss.title", "Won and lost")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "app.winLoss.subtitle",
            "What you sent, what came back, and — where anybody said — why it didn't. A win rate tells you that you are losing; the reasons tell you what to change.",
          )}
        </p>
        <Link
          href="/app/analytics/benchmark"
          className="inline-flex items-center gap-1.5 text-sm text-foreground underline mt-2"
        >
          {t("app.winLoss.backToInsights", "How you compare")}
        </Link>
      </div>

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="glass-effect rounded-lg p-4 mb-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {PERIOD_PRESETS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => choosePreset(key)}
              className={`text-sm px-3 py-1.5 rounded-lg border ${
                preset === key
                  ? "bg-inverted text-inverted-foreground border-transparent font-semibold"
                  : "border-border text-muted-foreground"
              }`}
            >
              {t(`app.winLoss.preset.${key}`, label)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-xs text-muted-foreground mb-1">
              {t("app.winLoss.from", "From")}
            </span>
            <input
              type="date"
              value={range.from}
              onChange={(e) => {
                setPreset("custom");
                setRange((r) => ({ ...r, from: e.target.value }));
              }}
              className="border border-border rounded-lg px-2 py-1.5 bg-transparent"
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-muted-foreground mb-1">
              {t("app.winLoss.to", "To")}
            </span>
            <input
              type="date"
              value={range.to}
              onChange={(e) => {
                setPreset("custom");
                setRange((r) => ({ ...r, to: e.target.value }));
              }}
              className="border border-border rounded-lg px-2 py-1.5 bg-transparent"
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          {t(
            "app.winLoss.cohortNote",
            "A quote belongs to the period it was SENT in, not the period it was answered in — so “sent in June” always adds up, however long a client takes to say yes.",
          )}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 mb-6 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="animate-pulse h-64 bg-accent rounded-xl" aria-hidden />
      )}

      {!error && data && !data.hasData && (
        // An empty range reports ABSENCE. A 0% win rate here would be a
        // statement about the contractor's selling that the data does not make.
        <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
          {t(
            "app.winLoss.empty",
            "No quotes went out between {from} and {to}. That is not a 0% win rate — it is a period with nothing in it.",
            { from: data.range.from, to: data.range.to },
          )}
        </div>
      )}

      {!error && data && data.hasData && (
        <div className="space-y-6">
          {/* ── The four counts ──────────────────────────────────────────── */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label={t("app.winLoss.sent", "Sent")}
              value={counts.sent}
              sub={t("app.winLoss.sentSub", "opportunities that left the building")}
            />
            <Stat
              label={t("app.winLoss.won", "Won")}
              value={counts.won}
              sub={money(data.value.won.amount)}
            />
            <Stat
              label={t("app.winLoss.lost", "Lost")}
              value={counts.lost}
              sub={money(data.value.lost.amount)}
            />
            <Stat
              label={t("app.winLoss.outstanding", "Still out")}
              value={counts.outstanding}
              sub={money(data.value.outstanding.amount)}
            />
          </div>

          {/* ── Win rate, and the honest refusal to print one ────────────── */}
          <div className="rounded-lg border border-border p-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <div className="text-3xl font-semibold text-foreground">
                {rateText(data.winRate)}
              </div>
              <div className="text-sm text-muted-foreground">
                {t("app.winLoss.rateBasis", "of {decided} decided quotes ({won} won, {lost} lost)", {
                  decided: counts.decided,
                  won: counts.won,
                  lost: counts.lost,
                })}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t(
                "app.winLoss.rateExplainer",
                "Divided by DECIDED quotes, never by everything sent — the {outstanding} still out have not been lost, and counting them as losses would understate a busy month.",
                { outstanding: counts.outstanding },
              )}
            </p>
            {data.winRate.suppressed === "below_floor" && (
              <p className="mt-2 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                <TriangleAlert size={14} className="shrink-0 mt-0.5" />
                {t(
                  "app.winLoss.floorNote",
                  "{decided} decisions is too small a sample to draw a rate from: one of them flipping would move it by more than {swing} points. Percentages start at {floor}.",
                  {
                    decided: counts.decided,
                    swing: Math.round(100 / Math.max(counts.decided, 1)),
                    floor: data.sampleFloor,
                  },
                )}
              </p>
            )}
          </div>

          {/* ── Time to decision ─────────────────────────────────────────── */}
          <div className="rounded-lg border border-border p-5">
            <h2 className="font-semibold text-foreground">
              {t("app.winLoss.timeTitle", "How long they take to answer")}
            </h2>
            {data.timeToDecision.measured === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {t(
                  "app.winLoss.timeNone",
                  "Nothing decided in this period carries both a send date and a decision date, so there is no average to give. Quotes decided before FieldQuo started stamping those dates are dropped rather than counted as decided the same day.",
                )}
              </p>
            ) : (
              <>
                <div className="mt-2 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                  <div>
                    <span className="text-2xl font-semibold text-foreground">
                      {data.timeToDecision.medianDays}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      {t("app.winLoss.medianDays", "days, typical (median)")}
                    </span>
                  </div>
                  <div>
                    <span className="text-2xl font-semibold text-foreground">
                      {data.timeToDecision.meanDays}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      {t("app.winLoss.meanDays", "days, average")}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t(
                    "app.winLoss.timeBasis",
                    "From {measured} decisions. {dropped} more were decided in this period and are NOT in the average — a missing timestamp is dropped, never treated as nought days.",
                    {
                      measured: data.timeToDecision.measured,
                      dropped: data.timeToDecision.dropped,
                    },
                  )}
                </p>
              </>
            )}
          </div>

          {/* ── Why, where anybody said ──────────────────────────────────── */}
          <div className="rounded-lg border border-border p-5">
            <h2 className="font-semibold text-foreground">
              {t("app.winLoss.whyTitle", "Why you lost them")}
            </h2>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-muted px-4 py-3">
                <div className="text-2xl font-semibold text-foreground">
                  {reasons.explained}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {t("app.winLoss.explained", "of {lost} lost quotes have a reason recorded", {
                    lost: reasons.lost,
                  })}
                </div>
              </div>
              <div className="rounded-lg bg-muted px-4 py-3">
                <div className="text-2xl font-semibold text-foreground">
                  {reasons.unexplained}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {t("app.winLoss.unexplained", "nobody said why")}
                </div>
              </div>
            </div>

            {/* The number that must never become a category. It is printed as
                its own count, never merged into "other" and never dropped so
                the remainder can be shown as if it were the whole picture. */}
            {reasons.lost > 0 && reasons.unexplained > 0 && (
              <p className="mt-3 flex items-start gap-2 text-sm text-foreground">
                <MessageSquareOff size={15} className="shrink-0 mt-0.5 text-muted-foreground" />
                {t(
                  "app.winLoss.askThem",
                  "{unexplained} of {lost} losses are silent. Nothing here can tell you why those went — the next one you lose, ask, and type what they say into the quote.",
                  { unexplained: reasons.unexplained, lost: reasons.lost },
                )}
              </p>
            )}

            {reasons.verbatim.length > 0 && (
              <>
                <p className="mt-5 text-xs text-muted-foreground">
                  {t(
                    "app.winLoss.verbatimNote",
                    "Their words, newest first, exactly as they were typed. Nothing here is sorted into categories — at these volumes a taxonomy would be inventing a pattern rather than finding one.",
                  )}
                </p>
                <ul className="mt-3 space-y-3">
                  {reasons.verbatim.map((row) => (
                    <li
                      key={row.quoteId}
                      className="rounded-lg border border-border px-4 py-3"
                    >
                      <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
                        {row.quoteId ? (
                          <Link
                            href={`/app/quotes/${row.quoteId}`}
                            className="font-medium text-foreground underline"
                          >
                            {row.quoteNumber || t("app.winLoss.thisQuote", "Quote")}
                          </Link>
                        ) : (
                          <span className="font-medium text-foreground">
                            {row.quoteNumber || t("app.winLoss.thisQuote", "Quote")}
                          </span>
                        )}
                        {row.clientName && <span>· {row.clientName}</span>}
                        {row.value !== null && <span>· {money(row.value)}</span>}
                        {row.decidedAt && <span>· {formatDate(row.decidedAt)}</span>}
                      </div>
                      {row.reasons.map((line, i) => (
                        <p
                          key={i}
                          className="mt-1.5 text-sm text-foreground whitespace-pre-wrap"
                        >
                          {line}
                        </p>
                      ))}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* ── Who wrote them, when the sample carries it ───────────────── */}
          {data.byEstimator.rows.length > 0 && (
            <div className="rounded-lg border border-border p-5">
              <h2 className="font-semibold text-foreground">
                {t("app.winLoss.byEstimator", "By whoever wrote the quote")}
              </h2>
              {/* overflow-x-auto: the only other table on this page already
                  has one (see the estimate-accuracy tables this page shares
                  its pattern with) — this one didn't. A long name in "Who"
                  next to three more columns is exactly the row that pushes a
                  375px phone into scrolling the whole document sideways
                  instead of just this table. */}
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-1 font-medium">{t("app.winLoss.who", "Who")}</th>
                      <th className="py-1 font-medium">{t("app.winLoss.decided", "Decided")}</th>
                      <th className="py-1 font-medium">{t("app.winLoss.wonCol", "Won")}</th>
                      <th className="py-1 font-medium">{t("app.winLoss.rateCol", "Win rate")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byEstimator.rows.map((row) => (
                      <tr key={row.id} className="border-t border-border">
                        <td className="py-1.5 text-foreground whitespace-nowrap">
                          {row.name || t("app.winLoss.unnamed", "Unnamed user")}
                        </td>
                        <td className="py-1.5">{row.decided}</td>
                        <td className="py-1.5">{row.won}</td>
                        <td className="py-1.5 font-semibold text-foreground">
                          {Math.round(row.winRate * 100)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.byEstimator.unattributed > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t(
                    "app.winLoss.unattributed",
                    "{count} decided quotes record no author and are in no row above — “not recorded” is not a colleague to compare anyone against.",
                    { count: data.byEstimator.unattributed },
                  )}
                </p>
              )}
            </div>
          )}

          {/* ── What is deliberately not in any figure above ─────────────── */}
          {data.excluded.undated > 0 && (
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info size={14} className="shrink-0 mt-0.5" />
              {t(
                "app.winLoss.undated",
                "{count} quotes left draft without a send date and belong to no period, so they are in none of the figures above. Most predate FieldQuo recording one.",
                { count: data.excluded.undated },
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
