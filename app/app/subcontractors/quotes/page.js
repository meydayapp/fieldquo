"use client";

// app/app/subcontractors/quotes/page.js
//
// "Quotes from my subs" — every price the contractor's subcontractors have
// sent them, in one list: who, what trade, how much, when, for which of
// their quotes or jobs, and where it stands. The owner, 2026-10-10.
//
// The rows and every decision about them come from the server
// (GET /api/subcontractors/received-prices, lib/subcontractors/
// receivedPrices.js). This page adds no money logic of its own:
//
//   Open              a link to the quote page's own compare panel (or, for
//                     a reply not yet in it, its price-request panel).
//   Add to my quote   POSTs the compare's select route — the same request
//                     "Use this one" / "Offer as extra work" sends, with no
//                     body; the server reprices from its stored rows.
//   Add to compare    POSTs the price request's confirm route, for a reply
//                     the contractor has not used yet.
//   Request a price   a link to the quote page with the existing request
//                     dialog opened (PriceRequestsPanel, requestPrices=1).
//
// Each control is drawn only when the server says the route behind it would
// accept this member (row.actions.*). No figure leaves the browser.
//
// ══ Mobile ════════════════════════════════════════════════════════════════
//
// One column of cards, not a table; filters wrap; 44px targets.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileStack, Loader2, Send } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { fetchList } from "@/lib/loadState";
import { fetchJson, errorText } from "@/lib/fetchJson";
import ListState from "@/app/components/ListState";
// The compare panel's own insurance / clearance lines and change-order words.
import SubCredentials, { CHANGE_ORDER_STATUS_KEY as CO_STATUS_KEY } from "@/app/components/subRequests/SubCredentials";
import {
  ALL,
  filterReceivedPrices,
  receivedPriceFilterOptions,
} from "@/lib/subcontractors/receivedPriceFilters";

const STATUS_CLS = {
  not_used: "text-amber-700 dark:text-amber-400",
  option: "text-muted-foreground",
  on_quote: "text-emerald-700 dark:text-emerald-400",
  extra_pending: "text-amber-700 dark:text-amber-400",
  extra_approved: "text-emerald-700 dark:text-emerald-400",
  extra_declined: "text-muted-foreground",
};

const NO_FILTERS = { trade: ALL, status: ALL, sub: ALL };

export default function SubQuotesPage() {
  const { t } = useTranslation();
  const { formatDate, money } = useCompanyPreferences();
  // null until the server answers — `[]` would claim "no prices" on a refused read.
  const [data, setData] = useState(null);
  const [errorKey, setErrorKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [picking, setPicking] = useState(false);
  const [target, setTarget] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchList("/api/subcontractors/received-prices");
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

  const rows = useMemo(() => data?.rows || [], [data]);
  const options = useMemo(() => receivedPriceFilterOptions(rows), [rows]);
  const shown = useMemo(() => filterReceivedPrices(rows, filters), [rows, filters]);
  const filtered = filters.trade !== ALL || filters.status !== ALL || filters.sub !== ALL;
  const targets = data?.requestTargets || [];

  async function add(row) {
    const action = row.actions?.add;
    if (!action || busy) return;
    setBusy(row.id);
    setError("");
    setNotice("");
    try {
      // The existing route, as the quote page calls it: no body for select
      // ("{}" is what ImportedCostsPanel sends), none at all for confirm.
      const result = await fetchJson(
        action.url,
        action.kind === "select"
          ? { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
          : { method: "POST" },
      );
      const quote = row.quote?.quoteNumber || "";
      if (action.kind === "confirm") setNotice(t("app.priceRequests.confirmed", { name: row.subName || "" }));
      else if (result?.changeOrder?.label) setNotice(t("app.importedCosts.offerExtraDone", { co: result.changeOrder.label }));
      else setNotice(t("app.subQuotes.addDone", { quote }));
      await load();
    } catch (e) {
      // The route's own refusal ("That quote is already decided…"), else
      // fetchJson's sentence in the reader's language.
      setError(errorText(t, e) || t("app.subQuotes.addFailed"));
    } finally {
      setBusy("");
    }
  }

  const addLabel = (action) => {
    if (action.kind === "confirm") return t("app.priceRequests.addToCompare");
    if (action.mode === "offer_extra") return t("app.quoteImport.submitApproved");
    return t("app.subQuotes.addToQuote");
  };
  const addHint = (action) => {
    if (action.kind === "confirm") return t("app.priceRequests.addToCompareHint");
    if (action.mode === "offer_extra") return t("app.importedCosts.offerExtraHint");
    if (action.mode === "use_instead") return t("app.subQuotes.useInsteadHint");
    return null;
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileStack size={22} />
            {t("app.subQuotes.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("app.subQuotes.subtitle")}</p>
        </div>
        {data?.canRequest && (
          <button
            type="button"
            onClick={() => setPicking((v) => !v)}
            className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground rounded-full px-4 py-2 text-sm font-semibold min-h-[44px] shrink-0"
          >
            <Send size={14} /> {t("app.subQuotes.requestPrice")}
          </button>
        )}
      </div>

      {/* "Request a price": the request is always about one of the
          contractor's quotes (the prices land in its compare), so pick it,
          then the quote page opens the existing request dialog. */}
      {picking && data?.canRequest && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          {targets.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("app.subQuotes.noRequestTargets")}</p>
          ) : (
            <>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">{t("app.subQuotes.requestPick")}</span>
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground min-h-[44px]"
                >
                  <option value="">—</option>
                  {targets.map((q) => (
                    <option key={q.id} value={q.path}>
                      {[q.quoteNumber, q.clientName].filter(Boolean).join(" · ")}
                    </option>
                  ))}
                </select>
              </label>
              {target ? (
                <Link
                  href={target}
                  className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground rounded-full px-4 py-2 text-sm font-semibold min-h-[44px]"
                >
                  {t("app.subQuotes.requestGo")}
                </Link>
              ) : null}
            </>
          )}
        </div>
      )}

      {data && rows.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <FilterSelect
            label={t("app.subQuotes.filterTrade")}
            value={filters.trade}
            onChange={(v) => setFilters((f) => ({ ...f, trade: v }))}
            options={options.trades.map((o) => ({ value: o.value, label: `${o.label} (${o.count})` }))}
            allLabel={t("app.subQuotes.all")}
          />
          <FilterSelect
            label={t("app.subQuotes.filterStatus")}
            value={filters.status}
            onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
            options={options.statuses.map((o) => ({ value: o.value, label: `${t(`app.subQuotes.status.${o.value}`)} (${o.count})` }))}
            allLabel={t("app.subQuotes.all")}
          />
          <FilterSelect
            label={t("app.subQuotes.filterSub")}
            value={filters.sub}
            onChange={(v) => setFilters((f) => ({ ...f, sub: v }))}
            options={options.subs.map((o) => ({ value: o.value, label: `${o.label || "—"} (${o.count})` }))}
            allLabel={t("app.subQuotes.all")}
          />
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-emerald-700 dark:text-emerald-400">{notice}</p>}
      {data?.costHidden && rows.length > 0 && <p className="text-xs text-muted-foreground">{t("app.subQuotes.costHidden")}</p>}
      {data?.repliesHidden && <p className="text-xs text-muted-foreground">{t("app.subQuotes.repliesHidden")}</p>}

      <ListState
        loading={loading && !data}
        errorKey={errorKey}
        isEmpty={!!data && rows.length === 0}
        onRetry={load}
        empty={
          <div className="bg-card border border-border rounded-xl p-6 space-y-3">
            <p className="text-sm font-semibold text-foreground">{t("app.subQuotes.emptyTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("app.subQuotes.emptyBody")}</p>
            <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
              <li>{t("app.subQuotes.emptyRequest")}</li>
              <li>{t("app.subQuotes.emptyLink")}</li>
              <li>{t("app.subQuotes.emptyUpload")}</li>
            </ul>
          </div>
        }
      >
        {shown.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">{t("app.subQuotes.noMatch")}</p>
            {filtered && (
              <button
                type="button"
                onClick={() => setFilters(NO_FILTERS)}
                className="text-sm font-semibold underline text-foreground min-h-[44px]"
              >
                {t("app.subQuotes.clearFilters")}
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            {shown.map((row) => (
              <li key={row.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{row.subName || "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {row.trade}
                      {" · "}
                      {t(`app.subQuotes.source.${row.source}`)}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold shrink-0 ${STATUS_CLS[row.status] || ""}`}>
                    {t(`app.subQuotes.status.${row.status}`)}
                  </span>
                </div>

                {/* The sub's price is the contractor's cost: jobCosting only.
                    The client price is what the compare shows anyone who
                    may see prices. */}
                <p className="text-sm mt-2 text-foreground">
                  {row.costHidden ? null : <span>{t("app.subQuotes.cost", { amount: money(row.cost) })}</span>}
                  {!row.costHidden && row.clientPrice != null ? " · " : null}
                  {row.clientPrice != null ? (
                    <span className="text-muted-foreground">{t("app.subQuotes.clientPrice", { amount: money(row.clientPrice) })}</span>
                  ) : null}
                </p>

                <p className="text-xs text-muted-foreground mt-1">
                  {row.receivedAt ? t("app.subQuotes.receivedOn", { date: formatDate(row.receivedAt) }) : null}
                  {row.quote ? (
                    <>
                      {row.receivedAt ? " · " : null}
                      {t("app.subQuotes.forQuote", { quote: row.quote.quoteNumber || "—" })}
                      {row.quote.clientName ? ` · ${row.quote.clientName}` : ""}
                    </>
                  ) : null}
                  {row.quote?.job ? (
                    <>
                      {" · "}
                      <Link href={`/app/jobs/${row.quote.job.id}`} className="underline underline-offset-2 text-foreground">
                        {t("app.subQuotes.forJob", { job: row.quote.job.title || "—" })}
                      </Link>
                    </>
                  ) : null}
                </p>

                {row.changeOrder ? (
                  <p className="text-xs mt-1 text-foreground">
                    {t("app.importedCosts.onChangeOrder", { co: row.changeOrder.label })}
                    {CO_STATUS_KEY[row.changeOrder.status] ? ` · ${t(CO_STATUS_KEY[row.changeOrder.status])}` : ""}
                  </p>
                ) : null}

                <SubCredentials c={row.credentials} t={t} formatDate={formatDate} />

                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <Link
                    href={row.actions.open}
                    className="inline-flex items-center border border-border rounded-full px-4 py-2 text-xs font-semibold text-foreground min-h-[44px]"
                  >
                    {t("app.subQuotes.open")}
                  </Link>
                  {row.actions.add && (
                    <button
                      type="button"
                      onClick={() => add(row)}
                      disabled={Boolean(busy)}
                      className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground rounded-full px-4 py-2 text-xs font-semibold min-h-[44px] disabled:opacity-60"
                    >
                      {busy === row.id && <Loader2 size={12} className="animate-spin" />}
                      {addLabel(row.actions.add)}
                    </button>
                  )}
                  {row.actions.request && (
                    <Link
                      href={row.actions.request}
                      className="inline-flex items-center gap-1.5 border border-border rounded-full px-4 py-2 text-xs font-semibold text-foreground min-h-[44px]"
                    >
                      <Send size={12} /> {t("app.subQuotes.requestPrice")}
                    </Link>
                  )}
                </div>
                {row.actions.add && addHint(row.actions.add) ? (
                  <p className="text-[11px] text-muted-foreground mt-1">{addHint(row.actions.add)}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </ListState>

      {data?.truncated && <p className="text-xs text-muted-foreground">{t("app.subQuotes.truncated")}</p>}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, allLabel }) {
  return (
    <label className="text-xs text-muted-foreground flex flex-col gap-1 min-w-[9rem] flex-1 sm:flex-none">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground min-h-[44px]"
      >
        <option value={ALL}>{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
