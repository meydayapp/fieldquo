"use client";

// app/sales/agency/performance/page.js
//
// The agency's performance page: its team's signups, calls and call
// quality — the same report the platform reads for everyone
// (lib/sales/performanceLoad.js), scoped by app/api/sales/agency/performance
// to the team read fresh on each request.
//
// The two call sections are app/components/sales/CallPerformanceSections.js,
// the component the platform page draws them with; the words come from the
// catalogue so an agency in Montréal reads them in French.
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, TrendingUp } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { PERIOD_PRESETS } from "@/lib/analytics/periodPresets";
import CallPerformanceSections from "@/app/components/sales/CallPerformanceSections";

const CARD = "rounded-xl border border-border bg-card p-4";
const FIELD = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";
const TH = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const TD = "px-3 py-3 text-sm text-foreground align-top";

/** The period presets' catalogue keys — the list itself is the route's. */
const PRESET_KEY = {
  thisMonth: "app.salesAgencyPerf.preset.thisMonth",
  lastMonth: "app.salesAgencyPerf.preset.lastMonth",
  thisQuarter: "app.salesAgencyPerf.preset.thisQuarter",
  yearToDate: "app.salesAgencyPerf.preset.yearToDate",
  lastYear: "app.salesAgencyPerf.preset.lastYear",
};

function callLabelsFor(t) {
  return {
    callsHeading: t("app.salesAgencyPerf.callsHeading"),
    callsIntro: t("app.salesAgencyPerf.callsIntro"),
    callsNote: t("app.salesAgencyPerf.callsNote"),
    rep: t("app.salesAgencyPerf.rep"),
    dials: t("app.salesAgencyPerf.dials"),
    connected: t("app.salesAgencyPerf.connected"),
    talkMinutes: t("app.salesAgencyPerf.talkMinutes"),
    answerRate: t("app.salesAgencyPerf.answerRate"),
    conversationRate: t("app.salesAgencyPerf.conversationRate"),
    notYetKnown: (n) => t("app.salesAgencyPerf.notYetKnown", { n }),
    reachRate: t("app.salesAgencyPerf.reachRate"),
    callbacks: t("app.salesAgencyPerf.callbacks"),
    everyone: t("app.salesAgencyPerf.everyone"),
    noCalls: t("app.salesAgencyPerf.noCalls"),
    ofBridged: (n) => t("app.salesAgencyPerf.ofBridged", { n }),
    overCalls: (n) => t("app.salesAgencyPerf.overCalls", { n }),
    agencyOf: (n) => t("app.salesAgencyPerf.agencyOf", { n }),
    belowFloor: (remaining) => t("app.salesAgencyPerf.belowFloor", { remaining }),
    pickupHeading: t("app.salesAgencyPerf.pickupHeading"),
    pickupIntro: t("app.salesAgencyPerf.pickupIntro"),
    prospectLegs: t("app.salesAgencyPerf.prospectLegs"),
    pickedUp: t("app.salesAgencyPerf.pickedUp"),
    conversationMeasured: t("app.salesAgencyPerf.conversationMeasured"),
    reportedVsMeasured: t("app.salesAgencyPerf.reportedVsMeasured"),
    bands: t("app.salesAgencyPerf.bands"),
    points: t("app.salesAgencyPerf.points"),
    conversationBasis: (fromTranscript, fromClock) => t("app.salesAgencyPerf.conversationBasis", { fromTranscript, fromClock }),
    bandUnanswered: t("app.salesAgencyPerf.bandUnanswered"),
    bandUnder: (s) => t("app.salesAgencyPerf.bandUnder", { s }),
    bandBetween: (a, b) => t("app.salesAgencyPerf.bandBetween", { a, b }),
    bandOver: (s) => t("app.salesAgencyPerf.bandOver", { s }),
    pickupLegend: t("app.salesAgencyPerf.pickupLegend"),
    qualityHeading: t("app.salesAgencyPerf.qualityHeading"),
    qualityIntro: t("app.salesAgencyPerf.qualityIntro"),
    qualityNote: t("app.salesAgencyPerf.qualityNote"),
    averageOverall: t("app.salesAgencyPerf.averageOverall"),
    counts: t("app.salesAgencyPerf.counts"),
    scored: t("app.salesAgencyPerf.scored"),
    recorded: t("app.salesAgencyPerf.recorded"),
    notYetScored: t("app.salesAgencyPerf.notYetScored"),
    unscorable: t("app.salesAgencyPerf.unscorable"),
    failed: t("app.salesAgencyPerf.failed"),
    reviewed: t("app.salesAgencyPerf.reviewed"),
    disclosureSaid: t("app.salesAgencyPerf.disclosureSaid"),
    permissionAsked: t("app.salesAgencyPerf.permissionAsked"),
    bannedMoveRate: t("app.salesAgencyPerf.bannedMoveRate"),
    talkRatio: t("app.salesAgencyPerf.talkRatio"),
    noTrend: t("app.salesAgencyPerf.noTrend"),
    vsPrevious: t("app.salesAgencyPerf.vsPrevious"),
  };
}

function Rate({ value, t }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  if (value.value !== null) {
    return (
      <span>
        {value.value}% <span className="text-xs text-muted-foreground">({value.hit}/{value.sampleSize})</span>
      </span>
    );
  }
  return (
    <span className="text-muted-foreground">
      {value.hit}/{value.sampleSize}
      {value.sampleSize > 0 ? <span className="block text-xs">{t("app.salesAgencyPerf.belowFloor", { remaining: value.remaining })}</span> : null}
    </span>
  );
}

export default function AgencyPerformancePage() {
  const { t } = useTranslation();
  const [report, setReport] = useState(null);
  const [preset, setPreset] = useState("thisMonth");
  const [failed, setFailed] = useState("");
  const labels = useMemo(() => callLabelsFor(t), [t]);

  const load = useCallback(async (key) => {
    setFailed("");
    try {
      setReport(await fetchJson(`/api/sales/agency/performance?preset=${encodeURIComponent(key)}`));
    } catch (err) {
      setFailed(err?.status === 403 ? "not_agency" : "load");
      setReport(null);
    }
  }, []);

  useEffect(() => {
    load(preset);
  }, [load, preset]);

  if (failed === "not_agency") {
    return (
      <div className="space-y-4 max-w-2xl">
        <h1 className="text-xl font-semibold text-foreground">{t("app.salesAgencyPerf.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("app.salesAgency.notAgency")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl" data-agency-performance>
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <TrendingUp size={20} aria-hidden="true" /> {t("app.salesAgencyPerf.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("app.salesAgencyPerf.intro")}</p>
        <p className="text-sm">
          <Link href="/sales/agency" className="underline text-foreground">
            {t("app.salesAgency.title")}
          </Link>
          {" · "}
          <Link href="/sales/agency/call-quality" className="underline text-foreground">
            {t("app.salesCallQa.title")}
          </Link>
        </p>
      </header>

      <div>
        <label htmlFor="period" className="block text-sm font-medium text-foreground mb-1">
          {t("app.salesAgencyPerf.period")}
        </label>
        <select id="period" value={preset} onChange={(e) => setPreset(e.target.value)} className={FIELD}>
          {PERIOD_PRESETS.map(([key]) => (
            <option key={key} value={key}>
              {PRESET_KEY[key] ? t(PRESET_KEY[key]) : key}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted-foreground">{t("app.salesAgencyPerf.utcNote")}</p>
      </div>

      {failed === "load" ? (
        <p className="text-sm text-amber-800 dark:text-amber-200" role="alert">
          {t("app.salesAgencyPerf.loadFailed")}
        </p>
      ) : null}

      {!report && !failed ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 size={14} className="animate-spin motion-reduce:animate-none" /> {t("app.salesAgency.loading")}
        </p>
      ) : null}

      {report ? (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <div className={CARD}>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("app.salesAgencyPerf.signupsThisWeek")}</div>
              <div className="mt-2 text-2xl font-bold text-foreground">{report.headline.signupsThisWeek}</div>
            </div>
            <div className={CARD}>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("app.salesAgencyPerf.signupsThisPeriod")}</div>
              <div className="mt-2 text-2xl font-bold text-foreground">{report.headline.signupsInPeriod}</div>
            </div>
            <div className={CARD}>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("app.salesAgencyPerf.signupsTotal")}</div>
              <div className="mt-2 text-2xl font-bold text-foreground">{report.headline.signupsTotal}</div>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">{t("app.salesAgencyPerf.repsHeading")}</h2>
            <p className="text-sm text-muted-foreground">{t("app.salesAgencyPerf.repsIntro")}</p>
            <div className={`${CARD} p-0 overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className={TH}>{t("app.salesAgencyPerf.rep")}</th>
                      <th className={TH}>{t("app.salesAgencyPerf.thisWeek")}</th>
                      <th className={TH}>{t("app.salesAgencyPerf.thisPeriod")}</th>
                      <th className={TH}>{t("app.salesAgencyPerf.total")}</th>
                      <th className={TH}>{t("app.salesAgencyPerf.leadsWon")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.reps.length === 0 ? (
                      <tr>
                        <td className={TD} colSpan={5}>
                          {t("app.salesAgency.teamEmpty")}
                        </td>
                      </tr>
                    ) : (
                      report.reps.map((rep) => (
                        <tr key={rep.id} className="border-t border-border">
                          <td className={TD}>
                            <div className="font-medium text-foreground">{rep.name}</div>
                            {!rep.active ? <div className="text-xs text-muted-foreground">{t("app.salesAgencyPerf.deactivated")}</div> : null}
                          </td>
                          <td className={`${TD} tabular-nums`}>{rep.signups.thisWeek}</td>
                          <td className={`${TD} tabular-nums`}>{rep.signups.inPeriod}</td>
                          <td className={`${TD} tabular-nums`}>{rep.signups.total}</td>
                          <td className={TD}>
                            <Rate value={rep.leads.winRate} t={t} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <CallPerformanceSections
            calls={report.calls}
            callQuality={report.callQuality}
            labels={labels}
            repHref={(id) => `/sales/agency/call-quality?repId=${encodeURIComponent(id)}`}
            qualityHref={(id) => (id ? `/sales/agency/call-quality?repId=${encodeURIComponent(id)}` : "/sales/agency/call-quality")}
          />

          <p className="text-xs text-muted-foreground">{t("app.salesAgencyPerf.floorNote", { floor: report.floors.rate })}</p>
        </>
      ) : null}
    </div>
  );
}
