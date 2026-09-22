// app/app/daily-sheets/week/page.js
//
// One person's week from their daily sheets: hours, objectives done,
// upsells, average score, bonus — day by day and totalled. The route
// (app/api/daily-sheets/week) applies the same scope as the day view, so
// a crew member reaching this with somebody else's workerId is refused.
"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";

const shiftDays = (key, days) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

export default function WeekPage() {
  return (
    <Suspense fallback={<div className="p-4 sm:p-6 max-w-3xl mx-auto animate-pulse h-64 bg-accent rounded-xl" />}>
      <WeekScreen />
    </Suspense>
  );
}

function WeekScreen() {
  const { t, language } = useTranslation();
  const money = useCompanyMoney();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workerId = searchParams.get("workerId") || "";
  const weekOf = searchParams.get("weekOf") || "";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (workerId) qs.set("workerId", workerId);
      if (weekOf) qs.set("weekOf", weekOf);
      setData(await fetchJson(`/api/daily-sheets/week?${qs.toString()}`));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [workerId, weekOf]);
  useEffect(() => {
    load();
  }, [load]);

  const go = (monday) => router.push(`/app/daily-sheets/week?workerId=${encodeURIComponent(workerId)}&weekOf=${monday}`);
  const fmtDay = (key) => new Date(`${key}T12:00:00Z`).toLocaleDateString(language, { weekday: "short", day: "numeric", timeZone: "UTC" });

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{data ? t("app.dailySheet.weekTitle", { name: data.worker.name }) : t("app.dailySheet.weekTitleBare")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data ? t("app.dailySheet.weekOf", { date: fmtDay(data.weekOf) }) : ""} ·{" "}
            <Link href={`/app/daily-sheets?date=${data?.weekOf || ""}`} className="underline">{t("app.dailySheet.backToDay")}</Link>
          </p>
        </div>
        {data && (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => go(shiftDays(data.weekOf, -7))} className="p-2 rounded-lg border border-border" aria-label={t("app.dailySheet.prevWeek")}>
              <ChevronLeft size={16} />
            </button>
            <button type="button" onClick={() => go(shiftDays(data.weekOf, 7))} className="p-2 rounded-lg border border-border" aria-label={t("app.dailySheet.nextWeek")}>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
      {error && <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">{error}</div>}
      {!data && !error && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" /> {t("app.state.loading")}</div>
      )}
      {data && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="text-left px-3 py-2">{t("app.dailySheet.day")}</th>
                <th className="text-right px-3 py-2">{t("app.dailySheet.hours")}</th>
                <th className="text-right px-3 py-2">{t("app.dailySheet.objectivesDone")}</th>
                <th className="text-right px-3 py-2">{t("app.dailySheet.upsells")}</th>
                <th className="text-right px-3 py-2">{t("app.dailySheet.score")}</th>
                <th className="text-right px-3 py-2">{t("app.dailySheet.bonus")}</th>
              </tr>
            </thead>
            <tbody>
              {data.days.map((d) => (
                <tr key={d.dateKey} className="border-t border-border">
                  <td className="px-3 py-2">
                    <Link href={`/app/daily-sheets?date=${d.dateKey}`} className="underline">{fmtDay(d.dateKey)}</Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{d.hours ? `${d.hours} h` : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{d.objectives ? `${d.done} / ${d.objectives}` : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{d.upsellCents ? money(d.upsellCents / 100) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{d.score != null ? `${d.score} / 5` : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{d.bonusCents != null ? money(d.bonusCents / 100) : "—"}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-border font-semibold">
                <td className="px-3 py-2">{t("app.dailySheet.weekTotal")}</td>
                <td className="px-3 py-2 text-right tabular-nums">{data.totals.hours} h</td>
                <td className="px-3 py-2 text-right tabular-nums">{data.totals.objectives ? `${data.totals.done} / ${data.totals.objectives}` : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{data.totals.upsellCents ? money(data.totals.upsellCents / 100) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{data.totals.avgScore != null ? `${data.totals.avgScore} / 5` : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{data.totals.bonusCents != null ? money(data.totals.bonusCents / 100) : "—"}</td>
              </tr>
            </tbody>
          </table>
          <p className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border">{t("app.dailySheet.weekNote")}</p>
        </div>
      )}
    </div>
  );
}
