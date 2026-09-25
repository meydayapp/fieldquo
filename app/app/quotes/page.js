// app/app/quotes/page.js
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { FileText, Plus, Search } from "lucide-react";
import { fetchArray } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import QuoteListRow from "./QuoteListRow";

import {
  QUOTE_STATUSES,
  quoteStatusLabel,
} from "@/lib/quotes/statusLabels";
import {
  countQuotesByStatus,
  rankQuotes,
} from "@/lib/quotes/listRanking";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useHasLevel } from "@/app/providers/PermissionProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";
import {
  useCompanyMoney,
  useCompanyPreferences,
} from "@/app/providers/CompanyPreferencesProvider";

// The chip row, in the order a quote moves through the pipeline. "all" is not a
// QuoteStatus and is listed separately for that reason — it is the absence of a
// filter, not a fifth state.
const FILTERS = ["all", ...QUOTE_STATUSES];

export default function QuotesPage() {
  const money = useCompanyMoney();
  // Dates in the company's chosen ordering, not a hardcoded locale. This is
  // staff reading their own data, which is the internal side of the split at
  // the top of lib/format/companyDate.js — and it is the same formatter the
  // quote DETAIL page renders validUntil through, so the list and the document
  // it links to cannot print two different dates.
  const { formatDate } = useCompanyPreferences();
  const { t } = useTranslation();
  // ── The control, at exactly the level the API enforces ──────────────────
  //
  // POST /api/quotes requires quotes:view_create_edit and refuses without it —
  // deliberately, and that refusal is correct: PERMISSIONS.employee grants
  // "quote:create" because the Dispatcher preset needs it, the GRID says
  // view_only, and narrower wins (lib/permissions.js says so at length).
  //
  // What was wrong is this screen. It offered "New Quote", opened the full
  // builder, and let someone compose a whole quote before the save came back
  // 403. That is the worst version of the failure: it costs the person their
  // work, not a click. The quick-add menu in the sidebar has hidden this exact
  // entry at this exact level since NAV_REQUIREMENTS was written; the two
  // buttons on this page were never given the same rule.
  const canCreate = useHasLevel("quotes", "view_create_edit");
  // The bottom rung. GET /api/quotes refuses at exactly this level, so without
  // it this screen is a list that can never fill and four tiles reading zero.
  const canView = useHasLevel("quotes", "view_only");
  // null until the server answers — see lib/loadState.js. The chip counts below
  // read this, and five chips reading "0" is a much more convincing lie than
  // any red banner is a correction.
  const [quotes, setQuotes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [errorKey, setErrorKey] = useState("");
  // The archive: quotes filed away from the Send… menu (Quote.archivedAt).
  // Off by default and OFF THE LIST by default — GET /api/quotes hides them
  // unless asked, so this is a second view, not a sixth status chip.
  const [archived, setArchived] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorKey("");
    const result = await fetchArray(archived ? "/api/quotes?archived=1" : "/api/quotes");
    if (result.aborted) return;
    if (result.ok) setQuotes(result.data);
    else setErrorKey(result.errorKey);
    setLoading(false);
  }, [archived]);

  useEffect(() => {
    if (canView) load();
  }, [load, canView]);

  // ── One clock for the whole render ──────────────────────────────────────
  //
  // Every age, every expiry and the sort order are computed against this single
  // instant, passed down (to rankQuotes here, to QuoteListRow per row), rather
  // than each helper calling Date.now() for
  // itself. Both because a render that straddles midnight would otherwise sort
  // a row by one clock and label it with another, and because it is what makes
  // the ranking testable: the check script pins `now` and asserts the order.
  const now = new Date();

  const filtered = (quotes ?? []).filter((q) => {
    if (filter !== "all" && q.status !== filter) return false;
    const s = search.toLowerCase();
    return (
      q.quoteNumber?.toLowerCase().includes(s) ||
      q.client?.name?.toLowerCase().includes(s)
    );
  });

  // Null when the load failed or is still running. The chips render an em dash
  // rather than 0: "Approved 0" on a transient 401 tells a contractor their won
  // work vanished.
  const counts = countQuotesByStatus(quotes);

  // Sent-and-unanswered first, oldest first, then everything else newest first.
  // Applied only in the unfiltered view: once somebody has picked a single
  // status there is one group, and a heading over the whole list would be
  // labelling the filter they can already see selected above it.
  const { chase, rest } = rankQuotes(filtered, now);
  const grouped = filter === "all" && chase.length > 0 && rest.length > 0;
  const rows = grouped ? [...chase, ...rest] : filtered;

  // "No quotes match" only makes sense when something is narrowing the list.
  // With nothing applied and nothing to show, this is an account that has never
  // written a quote, and that deserves the first-run panel instead.
  const narrowed = filter !== "all" || search.trim() !== "" || archived;

  // Rendered INSTEAD of the screen, not around it: nothing loads, and the
  // panel names who to ask. A list that is empty because the server refused it
  // reads as "you have none", which is a different and untrue statement.
  if (!canView) return <NoAccessPanel capability="accessLevel" />;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("app.quotes.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("app.quotes.subtitle")}</p>
        </div>
        {canCreate && (
          <Link
            data-tour="quotes-new"
            href="/app/quotes/new"
            className="flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold"
          >
            <Plus size={16} /> {t("app.quotes.new")}
          </Link>
        )}
      </div>

      {/* ── The tiles became filters, and kept their numbers ─────────────────
          Four stat tiles used to sit here. The one that mattered — the count of
          quotes at `sent` with no answer — WAS the follow-up queue, and there
          was no way to see the quotes it counted. A number you cannot act on is
          the "control that appears to work and doesn't" in its quietest form:
          nothing is broken, it just leads nowhere.

          The counts are unchanged. What is new is that pressing one shows you
          the rows behind it — which also settles the ambiguity the old "Awaiting
          reply" label was invented to dodge. This chip counts quotes whose
          CURRENT status is sent; the dashboard's "Quotes sent" counts every
          quote ever sent, so the two disagree the moment a client accepts one.
          A tile could only assert a number. A filter demonstrates which set it
          means, and the heading over the group below names it in full.

          min-h-[44px] and a scrolling row, matching the jobs list: these are
          tapped one-handed on a phone in a driveway. */}
      <div
        data-tour="quotes-stats"
        className="flex gap-2 overflow-x-auto pb-1"
      >
        {FILTERS.map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={`shrink-0 inline-flex items-center gap-2 min-h-[44px] rounded-full px-4 py-1.5 text-sm border ${
              filter === key
                ? "bg-inverted text-inverted-foreground border-inverted"
                : "border-border text-muted-foreground"
            }`}
          >
            <span>
              {key === "all"
                ? t("app.jobs.filterAll", "All")
                : quoteStatusLabel(key, t)}
            </span>
            <span className="font-semibold tabular-nums">
              {counts ? counts[key] : "—"}
            </span>
          </button>
        ))}
        {/* The archive is a different list, not a status: no count on the
            chip, because the count would be a second request for a number
            nobody chases. */}
        <button
          type="button"
          onClick={() => setArchived((v) => !v)}
          aria-pressed={archived}
          className={`shrink-0 inline-flex items-center gap-2 min-h-[44px] rounded-full px-4 py-1.5 text-sm border ${
            archived
              ? "bg-inverted text-inverted-foreground border-inverted"
              : "border-border text-muted-foreground"
          }`}
          data-archived-filter
        >
          {t("app.quotes.archived", "Archived")}
        </button>
      </div>
      {archived && (
        <p className="text-sm text-muted-foreground" data-archived-view-note>
          {t("app.quotes.archivedNote", "Showing archived quotes only. Open one to restore it.")}
        </p>
      )}

      <div data-tour="quotes-search" className="relative max-w-sm">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("app.quotes.search")}
          className="w-full pl-9 pr-3 py-2.5 border border-border rounded-lg text-sm"
        />
      </div>

      <ListState
        loading={loading}
        errorKey={errorKey}
        onRetry={load}
        isEmpty={rows.length === 0}
        skeleton={
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-accent rounded-xl" />
            ))}
          </div>
        }
        empty={
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <FileText size={40} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {narrowed ? t("app.quotes.noMatch") : t("app.quotes.emptyTitle")}
            </p>
            {/* An empty list with no way to fill it is a dead end, so the
                prompt is replaced by the reason rather than simply removed. */}
            {!narrowed && canCreate && (
              <Link
                href="/app/quotes/new"
                className="text-sm font-medium text-foreground underline mt-2 inline-block"
              >
                {t("app.quotes.empty")}
              </Link>
            )}
            {!narrowed && !canCreate && (
              <p className="text-xs text-muted-foreground mt-2">
                {t(
                  "app.access.cannotCreateQuote",
                  "Your access level lets you view quotes, not create them. Ask an owner or admin if you need to write one.",
                )}
              </p>
            )}
          </div>
        }
      >
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {rows.map((q, i) => {
            // The heading sits on the first row of the chase group rather than
            // in its own element, so the divide-y between rows stays the only
            // rule on the card. It is rendered once, and only when there is a
            // second group for it to distinguish this one FROM.
            const heading = grouped && i === 0;
            const divider = grouped && i === chase.length;

            return (
              <div key={q.id}>
                {heading && (
                  <div className="px-5 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("app.followFlow.triggerQuoteNoResponse")}
                  </div>
                )}
                {/* Where the chase group ends. A wordless band rather than a
                    second heading: "Everything else" is not a category anybody
                    needs named, and the only honest thing to say about these
                    rows is that they are not the ones above. */}
                {divider && <div className="h-2 bg-muted" aria-hidden />}
                <QuoteListRow quote={q} now={now} money={money} formatDate={formatDate} />
              </div>
            );
          })}
        </div>
      </ListState>
    </div>
  );
}
