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
import { useTranslation } from "@/app/hooks/useTranslation";
import { useHasLevel } from "@/app/providers/PermissionProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";


export default function InvoicesPage() {
  const money = useCompanyMoney();
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

  const filtered = (invoices ?? []).filter((inv) => {
    const s = search.toLowerCase();
    return (
      inv.invoiceNumber?.toLowerCase().includes(s) ||
      inv.client?.name?.toLowerCase().includes(s)
    );
  });

  // Money from the per-invoice figures, NOT from status — a partially-paid
  // invoice stays "sent" until fully paid, so counting only status==="paid"
  // reported $600 of a $1,000 invoice as $0 paid / $1,000 outstanding.
  //
  // Each is null while the list is unknown, and the tiles print an em dash for
  // null. A money figure is the one number on this page nobody double-checks.
  //
  // `pricingHidden` is set by the API for a member without the showPricing
  // toggle: the money columns are ABSENT from the payload, not zeroed. Summing
  // them would print "$0.00 billed" over a book full of invoices, which is a
  // stronger and more wrong claim than printing nothing — so the tiles stay
  // null and render the em dash they already have for "we were not told".
  const pricingHidden = Boolean(invoices?.some((i) => i.pricingHidden));
  // Named `summary`, not `money`: `money` is now the formatter this page
  // renders every figure through, and one identifier cannot be both.
  const summary =
    invoices && !pricingHidden
      ? {
          totalBilled: invoices.reduce((sum, i) => sum + Number(i.total || 0), 0),
          paidAmount: invoices.reduce(
            (sum, i) => sum + Number(i.amountPaid || 0),
            0,
          ),
          outstanding: invoices.reduce(
            (sum, i) => sum + Number(i.amountDue ?? i.total ?? 0),
            0,
          ),
        }
      : null;

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

      <div data-tour="invoices-stats" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground">{t("app.invoices.totalBilled")}</div>
          <div className="text-xl font-bold text-foreground mt-1">
            {dollars(summary?.totalBilled)}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground">{t("app.status.paid")}</div>
          <div className="text-xl font-bold text-green-600 dark:text-green-400 mt-1">
            {dollars(summary?.paidAmount)}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground">{t("app.invoices.outstanding")}</div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {dollars(summary?.outstanding)}
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
          {filtered.map((inv) => (
            <Link
              key={inv.id}
              href={`/app/invoices/${inv.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-muted"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Receipt size={18} className="text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate">
                      {inv.invoiceNumber}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${invoiceStatusClasses(
                        inv.status,
                      )}`}
                    >
                      {invoiceStatusPresentation(inv.status).labelKey
                        ? t(
                            invoiceStatusPresentation(inv.status).labelKey,
                            inv.status,
                          )
                        : inv.status}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {inv.client?.name || "Unknown client"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="font-semibold text-foreground">
                  {/* Number(undefined) is NaN, so without this a restricted
                      member reads "$NaN" on every row. */}
                  {inv.pricingHidden ? (
                    <span className="text-muted-foreground font-normal">—</span>
                  ) : (
                    money(inv.total)
                  )}
                </span>
                <ArrowRight size={16} className="text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      </ListState>
    </div>
  );
}
