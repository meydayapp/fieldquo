"use client";

// app/app/me/earnings/page.js
//
// Earnings, per pay period: hours (approved and waiting), the unpaid break
// minutes that came off them, the day-by-day list with in/out and job, and
// the payslip link once a run exists. The gross estimate — rate × hours,
// overtime at time-and-a-half — appears only when the payload carries it;
// the server decides that with lib/payroll/ownPayGate.js. Without it the
// tab shows HOURS and says so plainly, rather than a blank where money
// would be.
import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { formatCalendarDay, formatDayMonth, formatTimeOfDay } from "@/lib/format/localeDate";
import MeShell from "@/app/components/me/MeShell";
import { Card, CardTitle, EmptyNote, MeLoad, useMeData } from "@/app/components/me/bits";

export default function MeEarningsPage() {
  const { t, language } = useTranslation();
  const { money } = useCompanyPreferences();
  const [back, setBack] = useState(0);
  const { data, errorKey, loading, reload } = useMeData(`/api/me/earnings?period=${back}`);

  return (
    <MeShell title={t("app.me.tab.earnings")}>
      <MeLoad loading={loading} errorKey={errorKey} reload={reload}>
        {data && !data.worker ? (
          <EmptyNote>{t("app.me.notOnRoster")}</EmptyNote>
        ) : data ? (
          <div className="space-y-4">
            {/* ── Period picker ───────────────────────────────────── */}
            <div className="flex items-center justify-between gap-2">
              <button type="button" onClick={() => setBack((b) => Math.min(12, b + 1))} aria-label={t("app.me.earnings.previousPeriod")} className="grid h-11 w-11 place-items-center rounded-xl border border-border">
                <ChevronLeft size={18} />
              </button>
              <div className="text-center">
                <div className="text-sm font-semibold text-foreground">
                  {formatDayMonth(data.period.start, language)} – {formatDayMonth(data.period.end, language)}
                </div>
                <div className="text-xs text-muted-foreground">{t("app.me.earnings.payDay", { date: formatCalendarDay(data.period.payDate, language) })}</div>
              </div>
              <button type="button" onClick={() => setBack((b) => Math.max(0, b - 1))} disabled={back === 0} aria-label={t("app.me.earnings.nextPeriod")} className="grid h-11 w-11 place-items-center rounded-xl border border-border disabled:opacity-40">
                <ChevronRight size={18} />
              </button>
            </div>

            {/* ── The headline ────────────────────────────────────── */}
            <Card tone="accent">
              {data.estimate ? (
                <>
                  <div className="text-xs font-semibold uppercase tracking-[0.15em] opacity-70">{t("app.me.earnings.grossEstimate")}</div>
                  <div className="mt-1 text-3xl font-bold tabular-nums">{money(data.estimate.gross)}</div>
                  <div className="mt-1 text-sm opacity-90">
                    {t("app.me.earnings.rateLine", { rate: money(data.estimate.hourlyRate), regular: data.hours.regular.toFixed(2), overtime: data.hours.overtime.toFixed(2) })}
                  </div>
                  <div className="mt-2 text-xs opacity-75">{t("app.me.earnings.estimateNote")}</div>
                </>
              ) : (
                <>
                  <div className="text-xs font-semibold uppercase tracking-[0.15em] opacity-70">{t("app.me.earnings.hoursThisPeriod")}</div>
                  <div className="mt-1 text-3xl font-bold tabular-nums">{data.hours.total.toFixed(2)} h</div>
                  <div className="mt-2 text-xs opacity-75">
                    {data.seesPay ? t("app.me.earnings.noRate") : t("app.me.earnings.hoursOnly")}
                  </div>
                </>
              )}
            </Card>

            {/* ── Hours breakdown ─────────────────────────────────── */}
            <Card>
              <CardTitle>{t("app.me.earnings.hours")}</CardTitle>
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-muted-foreground">{t("app.me.earnings.approved")}</dt>
                <dd className="text-right font-semibold tabular-nums text-foreground">{data.hours.approved.toFixed(2)} h</dd>
                <dt className="text-muted-foreground">{t("app.me.earnings.waiting")}</dt>
                <dd className="text-right font-semibold tabular-nums text-foreground">{data.hours.pending.toFixed(2)} h</dd>
                <dt className="text-muted-foreground">{t("app.me.earnings.overtime")}</dt>
                <dd className="text-right font-semibold tabular-nums text-foreground">{data.hours.overtime.toFixed(2)} h</dd>
                <dt className="text-muted-foreground">{t("app.me.earnings.unpaidBreaks")}</dt>
                <dd className="text-right font-semibold tabular-nums text-foreground">{t("app.me.earnings.minutes", { n: data.hours.unpaidBreakMinutes })}</dd>
              </dl>
              {!data.period.alignsToWeeks ? <p className="mt-2 text-xs text-muted-foreground">{t("app.me.earnings.calendarPeriodNote")}</p> : null}
            </Card>

            {/* ── Payslip ─────────────────────────────────────────── */}
            {data.payslip ? (
              <Link href={data.payslip.href} className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                <FileText size={18} className="text-foreground" />
                <span className="flex-1 text-base font-semibold text-foreground">{t("app.me.earnings.payslip")}</span>
                <span className="text-xs text-muted-foreground">{data.payslip.status}</span>
              </Link>
            ) : (
              <p className="text-xs text-muted-foreground">{t("app.me.earnings.noPayslipYet")}</p>
            )}

            {/* ── Days ────────────────────────────────────────────── */}
            <Card>
              <CardTitle>{t("app.me.earnings.days")}</CardTitle>
              {data.days.length === 0 ? (
                <EmptyNote>{t("app.me.earnings.noDays")}</EmptyNote>
              ) : (
                <ul className="divide-y divide-border">
                  {data.days.map((d) => (
                    <li key={d.date} className="py-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">{formatCalendarDay(d.date, language, { year: false })}</span>
                        <span className="text-sm font-semibold tabular-nums text-foreground">{d.hours.toFixed(2)} h</span>
                      </div>
                      <ul className="mt-1 space-y-1">
                        {d.entries.map((e) => (
                          <li key={e.id} className="flex items-start justify-between gap-2 text-xs text-muted-foreground">
                            <span>
                              {formatTimeOfDay(e.clockIn, language)} – {e.clockOut ? formatTimeOfDay(e.clockOut, language) : t("app.clock.open")}
                              {e.job ? ` · ${e.job.client || e.job.title}` : ` · ${t("app.clock.noJobEntry")}`}
                              {e.unpaidBreakMinutes ? ` · ${t("app.me.earnings.minutes", { n: e.unpaidBreakMinutes })}` : ""}
                            </span>
                            <span className="shrink-0">{t(`app.me.earnings.status.${e.status}`)}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        ) : null}
      </MeLoad>
    </MeShell>
  );
}
