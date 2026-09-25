// app/app/leads/traffic/page.js
//
// Leads › Visits & unfinished — the company's own report on its instant
// estimate, lead funnels, booking page and website (GET /api/leads/traffic):
//
//   · per page: visits, started, sent (booked, on the booking page),
//     completion, and how many reached each step or further
//     (lib/tracking/funnelSteps.js countSteps);
//   · where visits came from, by page and source;
//   · the company's own ad campaigns, campaign ▸ ad set ▸ ad: visits,
//     unfinished requests, leads, booked visits, quotes sent and won, and
//     revenue won — first touch, from the link the visitor arrived on
//     (lib/tracking/campaignReport.js). Quotes and money are shown only to
//     members whose access includes them, and the table says so otherwise;
//   · "Started, didn't finish": people who typed an email or phone and
//     stopped, with a way to call or write — and nothing that sends to them
//     automatically, because the form promised only that the company COULD
//     follow up (lib/tracking/partial.js).
//
// First-party counts from our own rows, so the numbers do not move when a
// visitor blocks a pixel or declines the ad-cookie question. Counting began
// when each page was added; there is no history before it.
"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Mail, Phone, UserRound, Settings2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useHasLevel } from "@/app/providers/PermissionProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";
import { fetchJson } from "@/lib/fetchJson";
import { sourceName } from "@/lib/tracking/describe";
import { formatShortDate } from "@/lib/format/localeDate";
import { formatMoney } from "@/lib/currency";

const RANGES = [7, 30, 90];

/** The Ads Manager macro that would have named each level. */
const NAME_MACROS = { campaign: "{{campaign.name}}", adset: "{{adset.name}}", ad: "{{ad.name}}" };

export default function TrafficPage() {
  const { t, language } = useTranslation();
  const canView = useHasLevel("requests", "view_only");
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await fetchJson(`/api/leads/traffic?days=${days}`));
    } catch (err) {
      setError(err.message || t("app.traffic.couldNotLoad"));
    }
  }, [days, t]);

  useEffect(() => {
    if (canView) load();
  }, [canView, load]);

  if (!canView) return <NoAccessPanel capability="accessLevel" />;

  const sourceLabel = (s) =>
    s === "direct" ? t("app.traffic.source.direct") : s === "website" ? t("app.traffic.source.website") : sourceName(s);
  const surfaceName = (key) =>
    key === "instant_quote"
      ? t("app.traffic.instantEstimate")
      : key === "booking"
        ? t("app.adLinks.bookingPage")
        : key === "website"
          ? t("app.traffic.source.website")
          : data?.funnelNames?.[key.replace(/^funnel:/, "")] || t("app.traffic.funnel");
  const stepName = (surfaceKind, step) => {
    if (step.key === "submitted") return surfaceKind === "booking" ? t("app.traffic.booked") : t("app.traffic.step.submitted");
    if (surfaceKind !== "funnel") return t(`app.traffic.step.${step.key}`);
    return step.label || t("app.traffic.stepNumber", { n: step.rank + 1 });
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <Link href="/app/leads" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft size={13} /> {t("app.leads.title")}
        </Link>
        <h1 className="text-2xl font-bold text-foreground mt-2">{t("app.traffic.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{t("app.traffic.intro")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
            {RANGES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                  days === d ? "bg-inverted text-inverted-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("app.traffic.lastDays", { days: d })}
              </button>
            ))}
          </div>
          <Link
            href="/app/settings/instant-quotes#ad-tracking"
            className="inline-flex items-center gap-1 text-xs font-medium text-foreground underline"
          >
            <Settings2 size={13} /> {t("app.traffic.settingsLink")}
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      {!data && !error && <div className="h-40 rounded-xl bg-accent animate-pulse" />}

      {data && (
        <>
          {/* ── Per surface ───────────────────────────────────────────── */}
          <div className="grid gap-4 md:grid-cols-2">
            {data.surfaces.map((s) => {
              const first = s.steps[0]?.reached || 0;
              // The website takes no request itself (funnelSteps.js): a
              // "started" or "sent" figure there would be a zero that reads
              // like a verdict, so it shows its visits and says where its
              // requests are counted.
              if (s.kind === "website") {
                return (
                  <section key={s.key} className="rounded-xl border border-border bg-card p-4">
                    <h2 className="text-sm font-semibold text-foreground">{surfaceName(s.key)}</h2>
                    <div className="grid grid-cols-4 gap-2 mt-3">
                      <Stat label={t("app.traffic.visits")} value={s.visits} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">{t("app.traffic.websiteNote")}</p>
                  </section>
                );
              }
              return (
                <section key={s.key} className="rounded-xl border border-border bg-card p-4">
                  <h2 className="text-sm font-semibold text-foreground">{surfaceName(s.key)}</h2>
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    <Stat label={t("app.traffic.visits")} value={s.visits} />
                    <Stat label={t("app.traffic.started")} value={s.started} />
                    <Stat label={s.kind === "booking" ? t("app.traffic.booked") : t("app.traffic.submitted")} value={s.submitted} />
                    <Stat label={t("app.traffic.completion")} value={s.completionRate == null ? "—" : `${s.completionRate}%`} />
                  </div>
                  {s.visits === 0 ? (
                    <p className="text-xs text-muted-foreground mt-3">{t("app.traffic.noVisits")}</p>
                  ) : (
                    <div className="mt-4 space-y-1.5">
                      <div className="text-xs font-medium text-foreground">{t("app.traffic.stepsTitle")}</div>
                      {s.steps.map((st) => (
                        <div key={st.key} className="text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground truncate">{stepName(s.kind, st)}</span>
                            <span className="font-semibold text-foreground tabular-nums">{st.reached}</span>
                          </div>
                          {/* A bar per step, as a share of the first. Neutral ink on a
                              muted track — app chrome, not a brand surface. */}
                          <div className="h-1.5 rounded-full bg-muted mt-0.5 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-foreground/70"
                              style={{ width: `${first > 0 ? Math.round((st.reached / first) * 100) : 0}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          {/* ── Your ad campaigns ─────────────────────────────────────── */}
          <CampaignSection data={data} t={t} language={language} />

          {/* ── Where they came from ──────────────────────────────────── */}
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">{t("app.traffic.bySourceTitle")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{t("app.traffic.bySourceHint")}</p>
            {data.bySource.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-3">{t("app.traffic.noVisits")}</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="py-1.5 pr-3 font-medium">{t("app.traffic.col.page")}</th>
                      <th className="py-1.5 pr-3 font-medium">{t("app.traffic.col.source")}</th>
                      <th className="py-1.5 pr-3 font-medium text-right">{t("app.traffic.visits")}</th>
                      <th className="py-1.5 font-medium text-right">{t("app.traffic.col.completed")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bySource.map((r) => (
                      <tr key={`${r.surfaceKey}|${r.source}`} className="border-b border-border/60">
                        <td className="py-1.5 pr-3 text-foreground">{surfaceName(r.surfaceKey)}</td>
                        <td className="py-1.5 pr-3 text-foreground">{sourceLabel(r.source)}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums text-foreground">{r.visits}</td>
                        <td className="py-1.5 text-right tabular-nums text-foreground">{r.surfaceKey === "website" ? "—" : r.submitted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── Started, didn't finish ────────────────────────────────── */}
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">{t("app.traffic.partialTitle")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-3xl">
              {t("app.traffic.partialHint", { days: data.partialExpireDays })}
            </p>
            {data.partials.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-3">{t("app.traffic.partialEmpty", { days: data.partialExpireDays })}</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {data.partials.map((p) => (
                  <li key={p.id} className="py-2.5 flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        <UserRound size={14} className="text-muted-foreground shrink-0" />
                        {p.restricted ? (
                          <span className="text-muted-foreground font-normal">{t("app.traffic.restricted")}</span>
                        ) : (
                          <span className="truncate">{p.name || t("app.traffic.noName")}</span>
                        )}
                        <span className="text-[10px] font-semibold uppercase tracking-wide rounded-full border border-border px-1.5 py-0.5 text-muted-foreground">
                          {t("app.traffic.partialBadge")}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {p.surface === "funnel" ? p.funnelName || t("app.traffic.funnel") : t("app.traffic.instantEstimate")}
                        {" · "}
                        {t("app.traffic.reached", {
                          step:
                            p.surface === "instant_quote"
                              ? t(`app.traffic.step.${p.stepKey}`)
                              : p.stepLabel || t("app.traffic.funnelStep"),
                        })}
                        {" · "}
                        {sourceLabel(p.source)}
                        {p.campaign ? ` · ${p.campaign}` : ""}
                        {" · "}
                        {formatShortDate(p.contactAt, language)}
                      </div>
                    </div>
                    {!p.restricted && (
                      <div className="flex flex-wrap gap-2">
                        {p.phone && (
                          <a
                            href={`tel:${p.phone}`}
                            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent"
                          >
                            <Phone size={12} /> {p.phone}
                          </a>
                        )}
                        {p.email && (
                          <a
                            href={`mailto:${p.email}`}
                            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent break-all"
                          >
                            <Mail size={12} /> {p.email}
                          </a>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/**
 * Campaign ▸ ad set ▸ ad, each level opened by tapping its row. The table
 * scrolls sideways inside its card on a phone; the page itself never does.
 */
function CampaignSection({ data, t, language }) {
  const [open, setOpen] = useState(() => new Set());
  const campaigns = Array.isArray(data.campaigns) ? data.campaigns : [];
  const access = data.campaignAccess || { quotes: false, money: false };
  const untagged = data.campaignsUntagged?.metrics || null;
  const toggle = (key) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const nodeName = (level, n) => {
    if (n.name) return n.name;
    if (n.id) return t(`app.traffic.camp.${level}IdOnly`, { id: n.id, macro: NAME_MACROS[level] });
    return t(`app.traffic.camp.${level}None`);
  };
  const num = (v) => (v === null || v === undefined ? "—" : v);
  const money = (v) => (v === null || v === undefined ? "—" : formatMoney(v, data.currency, language));

  const cells = (m) => (
    <>
      <td className="py-1.5 pl-2 text-right tabular-nums text-foreground">{num(m.visits)}</td>
      <td className="py-1.5 pl-2 text-right tabular-nums text-foreground">{num(m.partials)}</td>
      <td className="py-1.5 pl-2 text-right tabular-nums text-foreground">{num(m.leads)}</td>
      <td className="py-1.5 pl-2 text-right tabular-nums text-foreground">{num(m.booked)}</td>
      <td className="py-1.5 pl-2 text-right tabular-nums text-foreground">{num(m.quotesSent)}</td>
      <td className="py-1.5 pl-2 text-right tabular-nums text-foreground">{num(m.quotesWon)}</td>
      <td className="py-1.5 pl-2 text-right tabular-nums text-foreground whitespace-nowrap">{money(m.revenueWon)}</td>
    </>
  );

  // A plain render function, not a component: a component defined inside
  // this one would be a new type every render and remount every row.
  const row = ({ rowKey, level, node, depth, expandKey = null, hasChildren }) => {
    const isOpen = expandKey && open.has(expandKey);
    const label = nodeName(level, node);
    return (
      <tr key={rowKey} className="border-b border-border/60 align-top">
        <td className="py-1.5 pr-2 text-foreground min-w-[12rem]" style={{ paddingLeft: `${depth * 1}rem` }}>
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggle(expandKey)}
              aria-expanded={Boolean(isOpen)}
              className="inline-flex items-start gap-1 text-left hover:underline"
            >
              <ChevronRight size={13} className={`shrink-0 mt-0.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
              <span className={`break-words ${level === "campaign" ? "font-semibold" : ""} ${node.name ? "" : "text-muted-foreground"}`}>{label}</span>
            </button>
          ) : (
            <span className={`inline-block pl-[17px] break-words ${node.name ? "" : "text-muted-foreground"}`}>{label}</span>
          )}
        </td>
        {cells(node.metrics)}
      </tr>
    );
  };

  return (
    <section id="campaigns" className="rounded-xl border border-border bg-card p-4 scroll-mt-4">
      <h2 className="text-sm font-semibold text-foreground">{t("app.traffic.camp.title")}</h2>
      <p className="text-xs text-muted-foreground mt-0.5 max-w-3xl">{t("app.traffic.camp.hint")}</p>
      {!access.quotes && <p className="text-xs text-muted-foreground mt-1">{t("app.traffic.camp.quotesHidden")}</p>}
      {access.quotes && !access.money && <p className="text-xs text-muted-foreground mt-1">{t("app.traffic.camp.moneyHidden")}</p>}
      {campaigns.length === 0 ? (
        <p className="text-xs text-muted-foreground mt-3">{t("app.traffic.camp.empty")}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="py-1.5 pr-2 font-medium text-left">{t("app.traffic.camp.col.name")}</th>
                <th className="py-1.5 pl-2 font-medium text-right">{t("app.traffic.visits")}</th>
                <th className="py-1.5 pl-2 font-medium text-right">{t("app.traffic.partialBadge")}</th>
                <th className="py-1.5 pl-2 font-medium text-right">{t("app.traffic.camp.col.leads")}</th>
                <th className="py-1.5 pl-2 font-medium text-right">{t("app.traffic.camp.col.booked")}</th>
                <th className="py-1.5 pl-2 font-medium text-right">{t("app.traffic.camp.col.quotesSent")}</th>
                <th className="py-1.5 pl-2 font-medium text-right">{t("app.traffic.camp.col.quotesWon")}</th>
                <th className="py-1.5 pl-2 font-medium text-right">{t("app.traffic.camp.col.revenueWon")}</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <Fragment key={c.key}>
                  {row({ rowKey: "c", level: "campaign", node: c, depth: 0, expandKey: c.key, hasChildren: c.adsets?.length > 0 })}
                  {open.has(c.key) &&
                    (c.adsets || []).map((s) => (
                      <Fragment key={`${c.key}|${s.key}`}>
                        {row({ rowKey: "s", level: "adset", node: s, depth: 1, expandKey: `${c.key}|${s.key}`, hasChildren: s.ads?.length > 0 })}
                        {open.has(`${c.key}|${s.key}`) &&
                          (s.ads || []).map((a) =>
                            row({ rowKey: `${c.key}|${s.key}|${a.key}`, level: "ad", node: a, depth: 2, hasChildren: false }),
                          )}
                      </Fragment>
                    ))}
                </Fragment>
              ))}
              {untagged && (untagged.visits > 0 || untagged.leads > 0) && (
                <tr className="text-muted-foreground">
                  <td className="py-1.5 pr-2 pl-[17px]">{t("app.traffic.camp.untagged")}</td>
                  {cells(untagged)}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg bg-muted/50 px-2 py-2 text-center">
      <div className="text-base font-bold text-foreground tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{label}</div>
    </div>
  );
}
