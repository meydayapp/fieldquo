"use client";

// app/app/tenders/page.js
//
// Every public tender the company is watching or bidding on, with the
// closing countdown and the win/loss card.
//
// ══ What is highlighted, and why only that ═════════════════════════════════
//
// Two rows need a person today: one CLOSING TODAY (in the tender's own zone,
// not the browser's — a 14:00 Eastern closing read in Vancouver is still
// today's), and one OVERDUE — still open on our side after it closed, i.e. a
// bid nobody marked submitted, or one that never went. Those two carry a
// coloured edge and a word; colour is never the only signal.
//
// ══ The summary ignores the filters ════════════════════════════════════════
//
// The card is computed on the server over every tender (lib/tenders/
// summary.js). Filtering the list to "closing this week" must not make the
// win rate look like it changed.
//
// Mobile: one column, cards not tables, 44px controls.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Landmark, Plus, AlertTriangle, Clock } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";
import { fetchList } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import { STATUS_FILTERS, CLOSING_FILTERS, filterTenders, sortTenders, isOverdue } from "@/lib/tenders/list";
import { closingState, countdownParts, formatInZone } from "@/lib/tenders/time";
import { TENDER_STATUSES } from "@/lib/tenders/constants";
import { statusLabel, statusTone, countdownText } from "./words";

const selectClass = "border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground min-h-[44px] w-full sm:w-auto";

function SummaryCard({ summary, t, money }) {
  if (!summary) return null;
  const rows = TENDER_STATUSES.filter((s) => summary.byStatus[s]?.count > 0);
  return (
    <section className="bg-card border border-border rounded-xl p-4 space-y-3" data-tender-summary>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{t("app.tenders.summary.title", "Win / loss")}</h2>
        <p className="text-sm text-foreground">
          {summary.winRate === null
            ? t("app.tenders.summary.noneDecided", "No tender decided yet")
            : t("app.tenders.summary.winRate", "Won {won} of {decided} decided ({rate}%)", {
                won: summary.byStatus.won.count,
                decided: summary.decided,
                rate: Math.round(summary.winRate * 100),
              })}
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("app.tenders.summary.empty", "Nothing to count yet.")}</p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {rows.map((s) => {
            const b = summary.byStatus[s];
            return (
              <li key={s} className="rounded-lg border border-border px-3 py-2 min-w-0">
                <p className="text-xs text-muted-foreground truncate">{statusLabel(t, s)}</p>
                <p className="text-lg font-semibold text-foreground">{b.count}</p>
                {summary.canSeeMoney && (
                  <p className="text-xs text-muted-foreground break-words">
                    {money(b.value || 0)}
                    {b.unvalued > 0 && ` · ${t("app.tenders.summary.unvalued", "{count} with no value", { count: b.unvalued })}`}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {summary.canSeeMoney && (
        <p className="text-xs text-muted-foreground">
          {t(
            "app.tenders.summary.valueBasis",
            "Value is the contract value when won, otherwise our linked bid quote, otherwise the buyer's estimate. A tender with none of those is counted but not valued.",
          )}
        </p>
      )}
    </section>
  );
}

export default function TendersPage() {
  const { t, language } = useTranslation();
  const money = useCompanyMoney();
  const [data, setData] = useState(null);
  const [errorKey, setErrorKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("open");
  const [closing, setClosing] = useState("any");
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchList("/api/tenders");
    if (result.aborted) return;
    if (!result.ok) {
      setErrorKey(result.errorKey);
      setLoading(false);
      return;
    }
    setErrorKey("");
    setData(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The countdown moves; a minute is its resolution.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const visible = useMemo(
    () => sortTenders(filterTenders(data?.tenders || [], { status, closing }, now), now),
    [data, status, closing, now],
  );

  const statusFilterLabel = (s) =>
    s === "open" ? t("app.tenders.filter.open", "Open (watching, bidding, preparing)") : s === "all" ? t("app.tenders.filter.all", "All") : statusLabel(t, s);
  const closingFilterLabel = (c) =>
    ({
      any: t("app.tenders.filter.closingAny", "Any closing date"),
      today: t("app.tenders.filter.closingToday", "Closing today"),
      week: t("app.tenders.filter.closingWeek", "Closing within 7 days"),
      overdue: t("app.tenders.filter.overdue", "Overdue"),
    })[c] || c;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Landmark size={22} />
            {t("app.tenders.title", "Tenders")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t(
              "app.tenders.intro",
              "Government and public tenders you're watching or bidding on — the closing time in the buyer's zone, the questions deadline, the site visit, and what happened.",
            )}
          </p>
        </div>
        {data?.capabilities?.canEdit && (
          <Link
            href="/app/tenders/new"
            className="inline-flex items-center gap-1.5 border border-border rounded-full px-4 py-2 text-sm font-semibold min-h-[44px] shrink-0"
          >
            <Plus size={14} /> {t("app.tenders.add", "Add")}
          </Link>
        )}
      </div>

      {data && <SummaryCard summary={data.summary} t={t} money={money} />}

      {data && (
        <div className="flex flex-col sm:flex-row gap-2">
          <label className="text-xs text-muted-foreground">
            <span className="sr-only">{t("app.tenders.filter.statusLabel", "Status")}</span>
            <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)} data-tender-filter="status">
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {statusFilterLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            <span className="sr-only">{t("app.tenders.filter.closingLabel", "Closing")}</span>
            <select className={selectClass} value={closing} onChange={(e) => setClosing(e.target.value)} data-tender-filter="closing">
              {CLOSING_FILTERS.map((c) => (
                <option key={c} value={c}>
                  {closingFilterLabel(c)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <ListState
        loading={loading}
        errorKey={errorKey}
        isEmpty={!!data && visible.length === 0}
        onRetry={load}
        empty={
          <div className="bg-card border border-border rounded-xl p-8 text-center space-y-2">
            <p className="text-sm font-semibold text-foreground">
              {(data?.tenders || []).length === 0
                ? t("app.tenders.emptyTitle", "No tenders yet")
                : t("app.tenders.emptyFiltered", "No tender matches these filters")}
            </p>
            {(data?.tenders || []).length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t(
                  "app.tenders.emptyBody",
                  "Add a solicitation you've found on CanadaBuys, SAP Ariba, MERX or a city's portal — FieldQuo reminds your team before the questions deadline, the site visit and the closing.",
                )}
              </p>
            )}
            {data?.capabilities?.canEdit && (data?.tenders || []).length === 0 && (
              <Link href="/app/tenders/new" className="inline-block text-sm font-semibold underline text-foreground min-h-[44px] py-3">
                {t("app.tenders.addFirst", "Add your first tender")}
              </Link>
            )}
          </div>
        }
      >
        <div className="space-y-3">
          {visible.map((tender) => {
            const state = closingState(tender, now);
            const overdue = isOverdue(tender, now);
            const today = state.state === "today" && ["watching", "bid", "preparing"].includes(tender.status);
            const edge = overdue
              ? "border-red-500 dark:border-red-400 border-2"
              : today
                ? "border-amber-500 dark:border-amber-400 border-2"
                : "border-border";
            return (
              <Link
                key={tender.id}
                href={`/app/tenders/${tender.id}`}
                className={`block bg-card border rounded-xl p-4 ${edge}`}
                data-tender-row={overdue ? "overdue" : today ? "today" : "normal"}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground break-words">{tender.title}</p>
                    <p className="text-xs text-muted-foreground break-words">
                      {[tender.solicitationNumber, tender.client?.missing ? t("app.tenders.clientRemoved", "Client removed") : tender.client?.name, tender.buyerBranch]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(tender.status)}`}>
                    {statusLabel(t, tender.status)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock size={12} />
                    {t("app.tenders.closes", "Closes {when}", { when: formatInZone(tender.closingAt, tender.timeZone, language) })}
                  </span>
                  {state.state !== "closed" && ["watching", "bid", "preparing", "submitted"].includes(tender.status) && (
                    <span className="font-semibold text-foreground">
                      {t("app.tenders.timeLeft", "{left} left", { left: countdownText(t, countdownParts(state.msLeft)) })}
                    </span>
                  )}
                  {overdue && (
                    <span className="inline-flex items-center gap-1 font-semibold text-red-700 dark:text-red-300">
                      <AlertTriangle size={12} />
                      {t("app.tenders.overdue", "Closed — not marked submitted")}
                    </span>
                  )}
                  {today && <span className="font-semibold text-amber-800 dark:text-amber-200">{t("app.tenders.closingToday", "Closes today")}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      </ListState>
      {data?.truncated && (
        <p className="text-xs text-muted-foreground">{t("app.tenders.truncated", "Showing the 1,000 most recent tenders.")}</p>
      )}
    </div>
  );
}
