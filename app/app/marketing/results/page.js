// app/app/marketing/results/page.js
//
// Marketing results — what the ads produced, laid out the way a marketing
// agency's client dashboard is (the owner, 2026-10-05: "so the company they
// deal with has a ROI of 40x because of the quality data"): cards with the
// change against the previous equal period, a period picker, the upcoming
// appointments and adjusted close rate strip, conversion timing, the funnel,
// and the split by source and by campaign.
//
// ONE copy of the arithmetic: GET /api/marketing/results runs
// lib/agency/metricsData.js, the loader the agency's own API answers from, so
// the owner can check what the agency reports against FieldQuo's numbers.
// Every figure's definition comes back with it (definitionKey + English) and
// is shown behind the figure's info button — nothing here re-derives one.
//
// No lib/agency/* import on purpose: those modules pull node:crypto (the
// lead reference), which has no business in a browser bundle.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, Info, ArrowUp, ArrowDown, Minus, KeyRound } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { can } from "@/lib/permissions";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";
import { fetchJson, errorText } from "@/lib/fetchJson";

const PERIODS = ["today", "yesterday", "thisWeek", "lastWeek", "thisMonth", "lastMonth", "thisQuarter", "lastQuarter", "thisYear", "lastYear", "custom"];
const SOURCES = ["", "meta", "google", "facebook_ad", "instagram_ad", "google_ads", "agency_funnel", "website", "referral", "organic"];
const CHANNEL_KEYS = ["facebook_ad", "instagram_ad", "whatsapp_ad", "google_ads", "agency_funnel", "website", "referral", "organic"];

// The agency dashboard's cards, in its order.
const CARDS = ["adSpend", "leads", "costPerLead", "appointments", "appointmentSetRate", "costPerAppointment", "closes", "closeRate", "costPerClose", "revenue", "roas", "averageJobSize"];
const STRIP = ["upcomingAppointments", "adjustedCloseRate", "closesWithoutVisit", "collected"];
const TIMING = ["medianDaysLeadToAppointment", "medianDaysAppointmentToQuote", "medianDaysQuoteToClose", "medianDaysLeadToClose"];
const FUNNEL_RATES = ["messagesFromAds", "realConversations", "adLeads", "adQualifiedLeads", "messageToLeadRate", "leadToQualifiedRate", "speedToLeadMinutes"];

export default function MarketingResultsPage() {
  const caller = usePermissions();
  // Same coarse gate as the Spend page and its routes; falls open while the
  // provider resolves (the route refuses regardless).
  const allowed = !caller?.role || can(caller.role, "user:manage");
  if (!allowed) return <NoAccessPanel capability="user:manage" />;
  return <Results />;
}

function useFormat() {
  const { t } = useTranslation();
  const { money } = useCompanyPreferences();
  return useCallback(
    (kind, value) => {
      if (value === null || value === undefined) return "—";
      switch (kind) {
        case "money":
          return money(value);
        case "rate":
          return new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 }).format(value);
        case "multiple":
          return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value)}×`;
        case "days":
          return t("app.agencyMetrics.unit.days", { n: new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value) });
        case "minutes":
          return t("app.agencyMetrics.unit.minutes", { n: new Intl.NumberFormat(undefined).format(value) });
        default:
          return new Intl.NumberFormat(undefined).format(value);
      }
    },
    [money, t],
  );
}

function Change({ change }) {
  const { t } = useTranslation();
  if (!change) return <span className="text-xs text-muted-foreground">{t("app.agencyMetrics.noCompare")}</span>;
  const pct = change.deltaPct === null ? null : Math.round(Math.abs(change.deltaPct) * 100);
  const Icon = change.direction === "up" ? ArrowUp : change.direction === "down" ? ArrowDown : Minus;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Icon size={12} aria-hidden />
      {change.direction === "flat"
        ? t("app.agencyMetrics.flat")
        : pct === null
          ? t("app.agencyMetrics.fromZero")
          : t(change.direction === "up" ? "app.agencyMetrics.up" : "app.agencyMetrics.down", { pct })}
    </span>
  );
}

const REASON_KEYS = {
  spend_not_connected: "app.agencyMetrics.reason.spendNotConnected",
  money_not_shared: "app.agencyMetrics.reason.moneyNotShared",
  not_counted_for_this_filter: "app.agencyMetrics.reason.notForFilter",
  nothing_to_divide: "app.agencyMetrics.reason.nothingToDivide",
};

function Figure({ id, m, big = true }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const [open, setOpen] = useState(false);
  if (!m) return null;
  const label = t(`app.agencyMetrics.label.${id}`);
  return (
    <div className="rounded-xl border border-border bg-card p-4 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={t("app.agencyMetrics.whatIsThis", { label })}
          title={t(m.definitionKey, m.definition)}
          className="shrink-0 -m-2 p-2 text-muted-foreground hover:text-foreground"
        >
          <Info size={14} />
        </button>
      </div>
      <div className={`${big ? "text-2xl" : "text-lg"} font-semibold text-foreground mt-1 break-words`}>{fmt(m.kind, m.value)}</div>
      {m.value === null && m.reason && <div className="text-xs text-muted-foreground mt-1">{t(REASON_KEYS[m.reason] || REASON_KEYS.nothing_to_divide)}</div>}
      <div className="mt-1">
        <Change change={m.change} />
        {m.previous !== null && m.previous !== undefined && (
          <span className="text-xs text-muted-foreground"> · {t("app.agencyMetrics.previous", { value: fmt(m.kind, m.previous) })}</span>
        )}
      </div>
      {open && <p className="mt-2 text-xs text-muted-foreground">{t(m.definitionKey, m.definition)}</p>}
    </div>
  );
}

function Results() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const [period, setPeriod] = useState("thisMonth");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [source, setSource] = useState("");
  const [campaign, setCampaign] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => {
    const p = new URLSearchParams({ period });
    if (period === "custom") {
      p.set("from", from);
      p.set("to", to);
    }
    if (source) p.set("source", source);
    if (campaign) p.set("campaign", campaign);
    return p.toString();
  }, [period, from, to, source, campaign]);

  const load = useCallback(async () => {
    if (period === "custom" && (!from || !to)) return;
    setLoading(true);
    try {
      setData(await fetchJson(`/api/marketing/results?${query}`));
      setError("");
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setLoading(false);
    }
  }, [query, period, from, to, t]);

  useEffect(() => {
    load();
  }, [load]);

  const m = data?.metrics || {};
  const campaigns = data?.byCampaign || [];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 size={22} /> {t("app.agencyMetrics.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{t("app.agencyMetrics.subtitle")}</p>
          <Link href="/app/settings/agency-access" className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline mt-2">
            <KeyRound size={13} /> {t("app.agencyMetrics.agencyLink")}
          </Link>
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-muted-foreground mb-1">{t("app.agencyMetrics.periodLabel")}</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="min-h-[44px] rounded-lg border border-border bg-background px-3 text-sm text-foreground">
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {t(`app.agencyMetrics.period.${p}`)}
              </option>
            ))}
          </select>
        </label>
        {period === "custom" && (
          <>
            <label className="block">
              <span className="block text-xs font-medium text-muted-foreground mb-1">{t("app.agencyMetrics.from")}</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="min-h-[44px] rounded-lg border border-border bg-background px-3 text-sm text-foreground" />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-muted-foreground mb-1">{t("app.agencyMetrics.to")}</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="min-h-[44px] rounded-lg border border-border bg-background px-3 text-sm text-foreground" />
            </label>
          </>
        )}
        <label className="block">
          <span className="block text-xs font-medium text-muted-foreground mb-1">{t("app.agencyMetrics.sourceLabel")}</span>
          <select value={source} onChange={(e) => setSource(e.target.value)} className="min-h-[44px] rounded-lg border border-border bg-background px-3 text-sm text-foreground">
            {SOURCES.map((s) => (
              <option key={s || "all"} value={s}>
                {s ? t(`app.agencyMetrics.source.${s}`) : t("app.agencyMetrics.source.all")}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-0 max-w-full">
          <span className="block text-xs font-medium text-muted-foreground mb-1">{t("app.agencyMetrics.campaignLabel")}</span>
          <select value={campaign} onChange={(e) => setCampaign(e.target.value)} className="min-h-[44px] max-w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground">
            <option value="">{t("app.agencyMetrics.campaignAll")}</option>
            {campaign && !campaigns.some((c) => (c.campaignId || c.campaignName) === campaign) && <option value={campaign}>{campaign}</option>}
            {campaigns
              .filter((c) => c.campaignId || c.campaignName)
              .map((c) => (
                <option key={c.campaignKey} value={c.campaignId || c.campaignName}>
                  {c.campaignName || c.campaignId}
                </option>
              ))}
          </select>
        </label>
      </div>

      {data?.period && (
        <p className="text-xs text-muted-foreground">
          {t("app.agencyMetrics.comparing", { from: data.period.from, to: data.period.to, pfrom: data.previousPeriod?.from || "—", pto: data.previousPeriod?.to || "—" })}
          {data.spend?.approximate ? ` ${t("app.agencyMetrics.spendApprox")}` : ""}
        </p>
      )}

      {error && (
        <div role="alert" className="rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground">
          {error}{" "}
          <button type="button" onClick={load} className="underline font-medium">
            {t("app.action.retry", "Try again")}
          </button>
        </div>
      )}
      {loading && !data && <div className="h-64 rounded-xl bg-muted animate-pulse" />}

      {data && (
        <div className={`space-y-6 ${loading ? "opacity-60" : ""}`}>
          {!data.spend?.connected && m.adSpend?.value === null && !data.spend?.notApplicable && (
            <div className="rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground">
              {t("app.agencyMetrics.spendNotConnected")}{" "}
              <Link href="/app/settings/meta-ads" className="underline font-medium">
                {t("app.settings.metaAds")}
              </Link>
              {" · "}
              <Link href="/app/settings/google-ads" className="underline font-medium">
                {t("app.settings.googleAds")}
              </Link>
            </div>
          )}

          <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {CARDS.map((k) => (
              <Figure key={k} id={k} m={m[k]} />
            ))}
          </section>

          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {STRIP.map((k) => (
              <Figure key={k} id={k} m={m[k]} big={false} />
            ))}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-foreground mb-2">{t("app.agencyMetrics.timingTitle")}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {TIMING.map((k) => (
                <Figure key={k} id={k} m={m[k]} big={false} />
              ))}
            </div>
          </section>

          {/* ── The funnel ─────────────────────────────────────────────── */}
          <section className="bg-card border border-border rounded-xl px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">{t("app.agencyMetrics.funnelTitle")}</h2>
            <ol className="mt-3 space-y-2">
              {(data.funnel?.stages || []).map((s) => (
                <li key={s.key} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-foreground min-w-0">{t(`app.agencyMetrics.label.${s.key}`)}</span>
                  <span className="text-foreground font-semibold tabular-nums whitespace-nowrap">
                    {fmt("count", s.count)}
                    {s.rateFromPrevious !== null && <span className="text-xs text-muted-foreground font-normal"> · {fmt("rate", s.rateFromPrevious)}</span>}
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground mt-3">
              {t("app.agencyMetrics.funnelAside", { quotes: data.funnel?.quotesSentWithoutVisit ?? 0, closes: data.funnel?.closesWithoutVisit ?? 0 })}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              {FUNNEL_RATES.map((k) => (
                <Figure key={k} id={k} m={m[k]} big={false} />
              ))}
            </div>
          </section>

          {/* ── By source ─────────────────────────────────────────────── */}
          <section className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border text-sm font-semibold text-foreground">{t("app.agencyMetrics.bySourceTitle")}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground text-left">
                    <th className="px-5 py-2 font-medium">{t("app.agencyMetrics.col.source")}</th>
                    <th className="px-3 py-2 font-medium text-right">{t("app.agencyMetrics.label.leads")}</th>
                    <th className="px-3 py-2 font-medium text-right">{t("app.agencyMetrics.label.qualifiedLeads")}</th>
                    <th className="px-3 py-2 font-medium text-right">{t("app.agencyMetrics.label.appointments")}</th>
                    <th className="px-3 py-2 font-medium text-right">{t("app.agencyMetrics.label.closes")}</th>
                    <th className="px-5 py-2 font-medium text-right">{t("app.agencyMetrics.label.revenue")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(data.bySource || []).filter((r) => CHANNEL_KEYS.includes(r.channel)).map((r) => (
                    <tr key={r.channel}>
                      <td className="px-5 py-2 text-foreground">{t(`app.agencyMetrics.channel.${r.channel}`)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt("count", r.leads)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt("count", r.qualifiedLeads)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt("count", r.appointments)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt("count", r.closes)}</td>
                      <td className="px-5 py-2 text-right tabular-nums">{fmt("money", r.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── By campaign ───────────────────────────────────────────── */}
          <section className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <div className="text-sm font-semibold text-foreground">{t("app.agencyMetrics.byCampaignTitle")}</div>
              <p className="text-xs text-muted-foreground mt-0.5">{t("app.agencyMetrics.byCampaignHint")}</p>
            </div>
            {campaigns.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">{t("app.agencyMetrics.noCampaigns")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground text-left">
                      <th className="px-5 py-2 font-medium">{t("app.agencyMetrics.col.campaign")}</th>
                      <th className="px-3 py-2 font-medium text-right">{t("app.agencyMetrics.label.adSpend")}</th>
                      <th className="px-3 py-2 font-medium text-right">{t("app.agencyMetrics.label.leads")}</th>
                      <th className="px-3 py-2 font-medium text-right">{t("app.agencyMetrics.label.costPerLead")}</th>
                      <th className="px-3 py-2 font-medium text-right">{t("app.agencyMetrics.label.closes")}</th>
                      <th className="px-3 py-2 font-medium text-right">{t("app.agencyMetrics.label.revenue")}</th>
                      <th className="px-5 py-2 font-medium text-right">{t("app.agencyMetrics.label.roas")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {campaigns.map((c) => (
                      <tr key={c.campaignKey}>
                        <td className="px-5 py-2 text-foreground break-words max-w-[16rem]">{c.campaignName || c.campaignId}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt("money", c.spend)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt("count", c.leads)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt("money", c.costPerLead)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt("count", c.closes)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt("money", c.revenue)}</td>
                        <td className="px-5 py-2 text-right tabular-nums">{fmt("multiple", c.roas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p className="text-xs text-muted-foreground">
            {data.sharedWithAgency?.jobValues ? t("app.agencyMetrics.sharedMoneyOn") : t("app.agencyMetrics.sharedMoneyOff")}
            {data.truncated ? ` ${t("app.agencyMetrics.truncated")}` : ""}
          </p>
        </div>
      )}
    </div>
  );
}
