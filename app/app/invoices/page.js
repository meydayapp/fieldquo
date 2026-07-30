// app/app/invoices/page.js
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Receipt, Plus, Search, ArrowRight } from "lucide-react";

import { useTranslation } from "@/app/hooks/useTranslation";
const STATUS_STYLES = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  paid: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  overdue: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
};

export default function InvoicesPage() {
  const { t } = useTranslation();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/invoices")
      .then((r) => r.json())
      .then((data) => setInvoices(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = invoices.filter((inv) => {
    const s = search.toLowerCase();
    return (
      inv.invoiceNumber?.toLowerCase().includes(s) ||
      inv.client?.name?.toLowerCase().includes(s)
    );
  });

  const totalBilled = invoices.reduce(
    (sum, i) => sum + Number(i.total || 0),
    0,
  );
  const paidAmount = invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + Number(i.total || 0), 0);
  const outstanding = totalBilled - paidAmount;

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto animate-pulse space-y-4">
        <div className="h-8 w-40 bg-accent rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-accent rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

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
          href="/app/invoices/new"
          className="flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold"
        >
          <Plus size={16} /> {t("app.invoices.new")}
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground">{t("app.invoices.totalBilled")}</div>
          <div className="text-xl font-bold text-foreground mt-1">
            $
            {totalBilled.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground">{t("app.status.paid")}</div>
          <div className="text-xl font-bold text-green-600 dark:text-green-400 mt-1">
            $
            {paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground">{t("app.invoices.outstanding")}</div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            $
            {outstanding.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </div>
        </div>
      </div>

      <div className="relative max-w-sm">
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

      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Receipt size={40} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            {search ? "No invoices match your search." : "No invoices yet."}
          </p>
        </div>
      ) : (
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
                      className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLES[inv.status]}`}
                    >
                      {inv.status}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {inv.client?.name || "Unknown client"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="font-semibold text-foreground">
                  $
                  {Number(inv.total).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
                <ArrowRight size={16} className="text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
