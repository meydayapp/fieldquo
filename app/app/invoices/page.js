// app/app/invoices/page.js
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Receipt, Plus, Search, ArrowRight } from "lucide-react";
import { fetchArray } from "@/lib/loadState";
import ListState from "@/app/components/ListState";

import {
  invoiceStatusClasses,
  invoiceStatusPresentation,
} from "@/lib/invoices/statusPresentation";
import { invoiceRowState, summariseInvoices } from "@/lib/invoices/listSummary";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useHasLevel } from "@/app/providers/PermissionProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";
import {
  useCompanyMoney,
  useCompanyPreferences,
} from "@/app/providers/CompanyPreferencesProvider";


export default function InvoicesPage() {
  const money = useCompanyMoney();
  // The company's chosen date ordering, and the same formatter the invoice
  // DETAIL page renders dueDate through — a due date that reads 03/09 on the
  // list and 09/03 on the invoice is a dispute waiting to happen.
  const { formatDate } = useCompanyPreferences();
  const { t } = useTranslation();
  // The bottom rung — GET /api/invoices refuses below it. See the quotes list.
  const canView = useHasLevel("invoices", "view_only");
  // null until the server answers — see lib/loadState.js. The money tiles below
  // are the sharpest case for this: "$0.00 outstanding" on a failed load tells
  // a contractor everyone has paid them.
  const [invoices, setInvoices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [errorKey, setErrorKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErrorKey("");
    const result = await fetchArray("/api/invoices");
    if (result.aborted) return;
    if (result.ok) setInvoices(result.data);
    else setErrorKey(result.errorKey);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (canView) load();
  }, [load, canView]);

  // One clock for the whole render — every "days past due" on this screen is
  // measured from the same instant, and the check script pins it.
  const now = new Date();

  const filtered = (invoices ?? []).filter((inv) => {
    const s = search.toLowerCase();
    return (
      inv.invoiceNumber?.toLowerCase().includes(s) ||
      inv.client?.name?.toLowerCase().includes(s)
    );
  });

  // ── The tiles and the rows now answer with one function ──────────────────
  //
  // Money from the per-invoice figures, NOT from status — a partially-paid
  // invoice stays "sent" until fully paid, so counting only status==="paid"
  // reported $600 of a $1,000 invoice as $0 paid / $1,000 outstanding.
  //
  // The tiles were already right about that. The ROWS were not: they printed
  // `inv.total` while the Outstanding tile summed the balance, so a half-paid
  // invoice showed its full face value under a heading that counted only what
  // was left. The column could never add up to the number above it, and
  // nothing on the page said which question each was answering.
  //
  // summariseInvoices and invoiceRowState both go through `invoiceMoney()` —
  // the same function the invoice detail page's balance and its lifecycle
  // banners use — so the tile, the row and the document they link to agree by
  // construction. See lib/invoices/listSummary.js.
  //
  // `pricingHidden` is set by the API for a member without the showPricing
  // toggle: the money columns are ABSENT from the payload, not zeroed. Summing
  // them would print "$0.00 billed" over a book full of invoices, which is a
  // stronger and more wrong claim than printing nothing — so `summary.money`
  // comes back null and the tiles render the em dash they already have for "we
  // were not told".
  const summary = summariseInvoices(invoices, now);
  const pricingHidden = Boolean(summary?.pricingHidden);
  // Guarded again here, on purpose. summariseInvoices already returns
  // `money: null` when the columns were withheld, so this is belt to its
  // braces — but the rule "this screen never sums a redacted payload" has to be
  // legible in the file that renders the figure, not only in the module that
  // computes it. scripts/check-rbac-redaction.mjs reads THIS file for exactly
  // that reason.
  const tiles = !pricingHidden ? summary?.money : null;

  // "£1,234.50" in the company's own currency, or "—" when we were not told.
  // The em-dash branch is load-bearing: a summary the API declined to send is
  // not a company that billed nothing, and rendering zero would say it did.
  const dollars = (value) =>
    value === null || value === undefined ? "—" : money(value);

  // Rendered INSTEAD of the screen, not around it: nothing loads, and the
  // panel names who to ask. A list that is empty because the server refused it
  // reads as "you have none", which is a different and untrue statement.
  if (!canView) return <NoAccessPanel capability="accessLevel" />;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("app.invoices.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("app.invoices.subtitle")}
          </p>
        </div>
        <Link
          data-tour="invoices-new"
          href="/app/invoices/new"
          className="flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold"
        >
          <Plus size={16} /> {t("app.invoices.new")}
        </Link>
      </div>

      {/* Outstanding leads, and it is the only tile that changed rank. Total
          Billed is a fact about the past; Outstanding is the only one of the
          three anybody can act on today, and it is the one the rows below now
          sum to. */}
      <div data-tour="invoices-stats" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border border-l-4 border-l-amber-600 dark:border-l-amber-400 rounded-xl p-4">
          <div className="text-xs text-muted-foreground">{t("app.invoices.outstanding")}</div>
          <div className="text-xl font-bold text-amber-800 dark:text-amber-300 mt-1 tabular-nums">
            {dollars(tiles?.outstanding)}
          </div>
          {/* Only when there IS money past due. A "$0.00 of that is past due"
              line under a healthy book is noise, and printing it on a failed
              load would be inventing the reassurance. */}
          {tiles?.overdueAmount > 0 && (
            <div className="text-xs text-red-700 dark:text-red-300 mt-1 tabular-nums">
              {t("app.dash.owed.pastDue", {
                amount: money(tiles.overdueAmount),
              })}
            </div>
          )}
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground">{t("app.status.paid")}</div>
          <div className="text-xl font-bold text-green-800 dark:text-green-400 mt-1 tabular-nums">
            {dollars(tiles?.paidAmount)}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground">{t("app.invoices.totalBilled")}</div>
          <div className="text-xl font-bold text-foreground mt-1 tabular-nums">
            {dollars(tiles?.totalBilled)}
          </div>
        </div>
      </div>

      <div data-tour="invoices-search" className="relative max-w-sm">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("app.invoices.search")}
          className="w-full pl-9 pr-3 py-2.5 border border-border rounded-lg text-sm"
        />
      </div>

      <ListState
        loading={loading}
        errorKey={errorKey}
        onRetry={load}
        isEmpty={filtered.length === 0}
        skeleton={
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-accent rounded-xl" />
            ))}
          </div>
        }
        empty={
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Receipt size={40} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? t("app.invoices.noMatch") : t("app.invoices.emptyTitle")}
            </p>
            {!search && (
              <>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("app.invoices.emptyHint", "Invoices bill a client for completed work")}
                </p>
                <Link
                  href="/app/invoices/new"
                  className="text-sm font-medium text-foreground underline mt-2 inline-block"
                >
                  {t("app.invoices.empty", "Create your first invoice")}
                </Link>
              </>
            )}
          </div>
        }
      >
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {filtered.map((inv) => {
            const row = invoiceRowState(inv, now);
            const label = invoiceStatusPresentation(inv.status).labelKey;

            return (
              <Link
                key={inv.id}
                href={`/app/invoices/${inv.id}`}
                className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-muted"
              >
                <div className="flex items-stretch gap-3 min-w-0">
                  {/* Always rendered so the text starts at the same x on every
                      row; coloured only on the ones somebody is late paying. */}
                  <span
                    aria-hidden
                    className={`w-[3px] shrink-0 rounded-full ${
                      row.overdue ? "bg-red-600 dark:bg-red-400" : "bg-transparent"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground truncate">
                        {inv.invoiceNumber}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${invoiceStatusClasses(
                          inv.status,
                        )}`}
                      >
                        {label ? t(label, inv.status) : inv.status}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {inv.client?.name || "Unknown client"}
                    </div>
                    {/* ── The due date, which this page had none of ──────────
                        An "overdue" badge with no date anywhere near it.
                        dueDate has always been on the payload — the route
                        returns full rows and dueDate is not in
                        INVOICE_MONEY_FIELDS, so it survives even the
                        restricted-member redaction — and the page read it zero
                        times.

                        "days past due" is `calendarDaysBetween`, the same
                        arithmetic the invoice's own "Overdue by 12 days" banner
                        and the dashboard's chase card use, for the reason
                        lib/analytics/receivables.js states: a contractor
                        comparing the two must not read two different numbers.

                        Under the client name, not in a column beside the money,
                        for the reason written out on the quotes list: as a
                        column it pushed the invoice NUMBER into an ellipsis at
                        375px.

                        No dueDate renders nothing. An invoice with no due date
                        is not overdue — it has no due date, which is a
                        different statement, and inventing one to fill the line
                        is exactly the padding AGENTS.md forbids. */}
                    {(row.overdue || row.dueDate) && (
                      <div className="mt-0.5 flex items-center gap-x-3 gap-y-0.5 text-xs flex-wrap">
                        {row.overdue && (
                          <span className="text-red-700 dark:text-red-300 font-semibold tabular-nums">
                            {t("app.dash.owed.daysPastDue", { days: row.daysLate })}
                          </span>
                        )}
                        {row.dueDate && (
                          <span className="text-muted-foreground tabular-nums">
                            {t("app.dash.owed.dueOn", { date: formatDate(row.dueDate) })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                  <div className="text-right">
                    {/* Number(undefined) is NaN, so without this a restricted
                        member reads "$NaN" on every row. */}
                    {inv.pricingHidden ? (
                      <span className="text-muted-foreground">—</span>
                    ) : row.paidOff ? (
                      <>
                        {/* The words, not "$0.00". The balance IS zero, and the
                            figure is honest, but a column of zeroes beside a
                            column of debts reads as "we billed nothing" at a
                            glance. The face value stays underneath so the row
                            still says how big the job was. */}
                        <div className="font-semibold text-green-800 dark:text-green-400">
                          {t("app.notif.note.settled")}
                        </div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {money(row.total)}
                        </div>
                      </>
                    ) : (
                      <>
                        {/* What is OWED, which is the question the Outstanding
                            tile above adds up. `total` used to be here, and the
                            two could never reconcile. */}
                        <div className="font-semibold text-foreground tabular-nums">
                          {money(row.due)}
                        </div>
                        {row.paid > 0 && (
                          <div className="text-xs text-muted-foreground tabular-nums">
                            {t("app.invoiceDetail.paid")} {money(row.paid)}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <ArrowRight size={16} className="text-muted-foreground" />
                </div>
              </Link>
            );
          })}
        </div>
      </ListState>
    </div>
  );
}
