// app/app/analytics/commissions/page.js
//
// Reports › Commissions — what each person earned over a date range, and how
// much of it has been paid out, is on a pay run, or is still pending. On
// screen only: the owner decided against exports.
//
// Everyone can open it. An owner, a payroll admin or someone with job costing
// sees the whole team; anyone else sees their own figures and nobody else's —
// the route filters (app/api/commissions/report/route.js), this page only
// draws what it was given. Linked from Insights, from Payroll (where every
// member looks for their pay) and from Settings › Commissions.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Percent, Loader2, Info } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";
import { formatCalendarDay } from "@/lib/format/localeDate";

const iso = (d) => d.toISOString().slice(0, 10);
function thisMonth() {
  const now = new Date();
  return {
    from: iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))),
    to: iso(now),
  };
}

const STATUS_STYLE = {
  paid: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  in_pay_run: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  pending: "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200",
};
const STATUS_KEY = {
  paid: "app.commissions.status.paid",
  in_pay_run: "app.commissions.status.inPayRun",
  pending: "app.commissions.status.pending",
};
const REASON_KEY = {
  payment: "app.commissions.reason.payment",
  refund: "app.commissions.reason.refund",
  recalculated: "app.commissions.reason.recalculated",
};

export default function CommissionsReportPage() {
  const { t, language } = useTranslation();
  const money = useCompanyMoney();
  const [range, setRange] = useState(thisMonth);
  const [memberId, setMemberId] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  // Every change of filter goes through here, so the spinner is set by the
  // event that asked for new figures rather than by the effect that fetches.
  const refetch = (apply) => {
    setLoading(true);
    apply?.();
  };
  const load = () => refetch(() => setReloadKey((k) => k + 1));

  useEffect(() => {
    let live = true;
    const q = new URLSearchParams({ from: range.from, to: range.to });
    if (memberId) q.set("memberId", memberId);
    fetchJson(`/api/commissions/report?${q.toString()}`)
      .then((d) => {
        if (!live) return;
        setData(d);
        setError("");
      })
      // The previous figures are left on screen rather than replaced with
      // zeros — a failed read is not a month in which nobody earned anything.
      .catch((err) => live && setError(err.message || t("app.commissions.loadFailed")))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [range.from, range.to, memberId, reloadKey, t]);

  const tiles = data
    ? [
        ["app.commissions.tile.earned", data.totals.earned],
        ["app.commissions.tile.paid", data.totals.paid],
        ["app.commissions.tile.inPayRun", data.totals.inPayRun],
        ["app.commissions.tile.pending", data.totals.pending],
        ["app.commissions.tile.uncollected", data.totals.uncollected],
      ]
    : [];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-lg md:text-xl font-semibold flex items-center gap-2">
          <Percent size={18} /> {t("app.commissions.reportTitle")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {data?.seesAll ? t("app.commissions.reportIntroAll") : t("app.commissions.reportIntroOwn")}
        </p>
      </div>

      {data && !data.enabled && (
        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <Info size={13} className="mt-0.5 shrink-0" /> {t("app.commissions.reportOff")}
        </p>
      )}

      <div className="flex items-end gap-3 flex-wrap">
        <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
          {t("app.commissions.from")}
          <input
            type="date"
            value={range.from}
            onChange={(e) => { const v = e.target.value; refetch(() => setRange((r) => ({ ...r, from: v }))); }}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
          {t("app.commissions.to")}
          <input
            type="date"
            value={range.to}
            onChange={(e) => { const v = e.target.value; refetch(() => setRange((r) => ({ ...r, to: v }))); }}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
        </label>
        {data?.seesAll && data.people?.length > 0 && (
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            {t("app.commissions.person")}
            <select
              value={memberId}
              onChange={(e) => { const v = e.target.value; refetch(() => setMemberId(v)); }}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm min-w-[10rem]"
            >
              <option value="">{t("app.commissions.everyone")}</option>
              {data.people.map((p) => (
                <option key={p.memberId} value={p.memberId}>
                  {p.name || t("app.commissions.unnamed")}
                </option>
              ))}
            </select>
          </label>
        )}
        {loading && <Loader2 size={16} className="animate-spin text-muted-foreground mb-2" />}
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 dark:border-red-900 bg-card p-4 text-sm">
          <p className="text-foreground">{error}</p>
          <button type="button" onClick={load} className="mt-2 text-xs underline">
            {t("app.load.retry")}
          </button>
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {tiles.map(([key, v]) => (
              <div key={key} className="rounded-xl border border-border bg-card px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t(key)}</div>
                <div className="text-lg font-bold text-foreground tabular-nums">{money(v)}</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">{t("app.commissions.tileHint")}</p>

          <section className="rounded-xl border border-border bg-card overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="px-3 py-2 font-medium">{t("app.commissions.person")}</th>
                  <th className="px-3 py-2 font-medium text-right">{t("app.commissions.workedBy")}</th>
                  <th className="px-3 py-2 font-medium text-right">{t("app.commissions.soldBy")}</th>
                  <th className="px-3 py-2 font-medium text-right">{t("app.commissions.tile.earned")}</th>
                  <th className="px-3 py-2 font-medium text-right">{t("app.commissions.tile.paid")}</th>
                  <th className="px-3 py-2 font-medium text-right">{t("app.commissions.tile.inPayRun")}</th>
                  <th className="px-3 py-2 font-medium text-right">{t("app.commissions.tile.pending")}</th>
                  <th className="px-3 py-2 font-medium text-right">{t("app.commissions.tile.uncollected")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.members.map((m) => (
                  <tr key={m.memberId}>
                    <td className="px-3 py-2 text-foreground">{m.name || t("app.commissions.unnamed")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(m.worked)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(m.sold)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{money(m.earned)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(m.paid)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(m.inPayRun)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(m.pending)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{money(m.uncollected)}</td>
                  </tr>
                ))}
                {data.members.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-muted-foreground">
                      {t("app.commissions.nothingInRange")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          {data.entries.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                {t("app.commissions.entriesTitle")}
              </h2>
              <div className="rounded-xl border border-border bg-card divide-y divide-border">
                {data.entries.map((e) => (
                  <div key={e.id} className="px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">
                        {formatCalendarDay(e.date, language)} · {e.name || t("app.commissions.unnamed")} ·{" "}
                        {e.role === "sold" ? t("app.commissions.soldBy") : t("app.commissions.workedBy")}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {e.jobTitle ? (
                          <Link href={`/app/jobs/${e.jobId}`} className="underline">
                            {e.jobTitle}
                          </Link>
                        ) : (
                          t("app.commissions.jobGone")
                        )}
                        {e.invoiceNumber ? ` · ${e.invoiceNumber}` : ""} · {t(REASON_KEY[e.reason] || "app.commissions.reason.recalculated")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold tabular-nums ${e.amount < 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
                        {money(e.amount)}
                      </span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[e.status] || ""}`}>
                        {t(STATUS_KEY[e.status] || "app.commissions.status.pending")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {data.truncated && (
                <p className="text-[11px] text-muted-foreground mt-2">{t("app.commissions.truncated")}</p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
