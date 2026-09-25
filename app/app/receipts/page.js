// app/app/receipts/page.js
//
// The receipts book — every purchase receipt, kept as the bookkeeping record,
// with where each one went: a job, overhead, or still waiting for a decision.
//
// ══ Who sees what ══════════════════════════════════════════════════════════
//
// The office (Expenses: everyone's) sees every receipt, books any of them to
// any job or to overhead, and moves a booked one. Everyone else sees the
// receipts THEY captured, books them to THEIR jobs, or hands the decision to
// the office. The routes enforce all of it (lib/receipts/access.js); this
// page only mirrors it, so nobody is offered a control that would 403.
//
// Reached from Settings → Expense Tracking ("Receipts", "Scan receipt"), from
// a job page ("Scan a receipt for this job"), and from the Create menu's
// "Snap receipt" — which lands here with ?snap=1 and opens the capture panel.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ScanLine, FileText, AlertTriangle, Copy, ArrowLeft } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyMoney, useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { useHasLevel } from "@/app/providers/PermissionProvider";
import { fetchJson } from "@/lib/fetchJson";
import ReceiptCapture from "@/app/components/receipts/ReceiptCapture";
import ReceiptReview from "@/app/components/receipts/ReceiptReview";
import { statusLabel, categoryLabel, refusalText } from "@/app/components/receipts/labels";

const FILTERS = ["all", "needs_review", "unlinked", "job", "overhead", "unreadable", "void"];

const inputClass =
  "border border-border rounded-lg px-3 py-2 text-base sm:text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring/10";

const STATUS_TONE = {
  reading: "bg-muted text-muted-foreground",
  needs_review: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  unreadable: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  confirmed: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  void: "bg-muted text-muted-foreground line-through",
};

export default function ReceiptsPage() {
  const { t } = useTranslation();
  const money = useCompanyMoney();
  const { formatDate, formatDateTime } = useCompanyPreferences();
  const office = useHasLevel("expenses", "view_record_edit_all");
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [vendor, setVendor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [capture, setCapture] = useState(null);
  const [openId, setOpenId] = useState(null);

  // ?snap=1 (the Create menu) and ?jobId= (a job page) — read once on mount
  // from the address rather than useSearchParams, which would ask for a
  // Suspense boundary around a page that has none (the purchasing page's rule).
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const jobId = q.get("jobId");
      if (q.get("snap") === "1" || jobId) {
        setCapture({ source: jobId ? "job" : q.get("from") === "expenses" ? "expenses" : "snap", contextJobId: jobId || null });
      }
      const f = q.get("filter");
      if (f && FILTERS.includes(f)) setFilter(f);
    } catch {
      // No window on the harness's first paint; nothing to read.
    }
  }, []);

  const load = useCallback(async () => {
    const q = new URLSearchParams({ filter });
    if (vendor.trim()) q.set("vendor", vendor.trim());
    if (from && to) {
      q.set("from", from);
      q.set("to", to);
    }
    try {
      setList(await fetchJson(`/api/receipts?${q}`));
      setError("");
    } catch (err) {
      setError(refusalText(t, err));
    }
  }, [filter, vendor, from, to, t]);

  useEffect(() => {
    const id = setTimeout(load, vendor ? 300 : 0);
    return () => clearTimeout(id);
  }, [load, vendor]);

  const counts = list?.counts || {};

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {office && (
            <Link href="/app/settings/expense-tracking" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft size={12} /> {t("app.receipts.backToExpenses")}
            </Link>
          )}
          <h1 className="text-2xl font-bold text-foreground">{t("app.receipts.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {office ? t("app.receipts.subtitleOffice") : t("app.receipts.subtitleCrew")}
          </p>
        </div>
        {!capture && (
          <button
            type="button"
            onClick={() => setCapture({ source: "expenses", contextJobId: null })}
            className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold"
          >
            <ScanLine size={14} /> {t("app.receipts.scan")}
          </button>
        )}
      </div>

      {capture && (
        <ReceiptCapture
          source={capture.source}
          contextJobId={capture.contextJobId}
          onRead={load}
          onClose={() => setCapture(null)}
        />
      )}

      {(counts.needs_review > 0 || counts.unreadable > 0) && (
        <p className="text-sm text-foreground">
          {t("app.receipts.waiting", { n: (counts.needs_review || 0) + (counts.unreadable || 0) })}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <select className={inputClass} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label={t("app.receipts.filter.label")}>
          {FILTERS.map((f) => (
            <option key={f} value={f}>
              {t(`app.receipts.filter.${f}`)}
            </option>
          ))}
        </select>
        <input
          className={`${inputClass} min-w-0 flex-1 sm:flex-none`}
          placeholder={t("app.receipts.filter.vendor")}
          aria-label={t("app.receipts.filter.vendor")}
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
        />
        <label className="text-xs text-muted-foreground">
          {t("app.receipts.filter.from")}
          <input type="date" className={`${inputClass} block`} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-xs text-muted-foreground">
          {t("app.receipts.filter.to")}
          <input type="date" className={`${inputClass} block`} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      {(from && !to) || (!from && to) ? (
        <p className="text-xs text-muted-foreground">{t("app.receipts.filter.bothDates")}</p>
      ) : null}

      {error && (
        <p className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle size={14} className="mt-0.5" /> {error}
        </p>
      )}

      {!list && !error && <div className="animate-pulse h-64 bg-accent rounded-xl" />}

      {list && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {list.receipts.length === 0 ? (
            <p className="px-5 py-10 text-sm text-muted-foreground text-center">
              {filter === "all" ? t("app.receipts.empty") : t("app.receipts.emptyFilter")}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {list.receipts.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setOpenId(r.id)} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted">
                    <span className="w-12 h-12 shrink-0 rounded-lg border border-border bg-muted overflow-hidden flex items-center justify-center">
                      {r.firstFile?.kind === "photo" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.firstFile.url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <FileText size={18} className="text-muted-foreground" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">
                          {r.vendorName || (r.status === "reading" ? t("app.receipts.reading") : t("app.receipts.unknownVendor"))}
                        </span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_TONE[r.status] || ""}`}>{statusLabel(t, r.status)}</span>
                        {r.officeDecides && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                            {t("app.receipts.officeDecides")}
                          </span>
                        )}
                        {r.duplicateOfId && r.status !== "void" && r.status !== "confirmed" && (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                            <Copy size={10} /> {t("app.receipts.maybeDuplicate")}
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-muted-foreground truncate">
                        {r.purchasedAt
                          ? formatDateTime(r.purchasedAt)
                          : r.purchasedDate
                            ? formatDate(`${r.purchasedDate}T12:00:00Z`)
                            : formatDate(r.createdAt)}
                        {office && r.createdByName ? ` · ${r.createdByName}` : ""}
                        {r.links.length === 1
                          ? ` · ${r.links[0].kind === "job" ? t("app.receipts.onAJob") : r.links[0].kind === "overhead" ? `${t("app.receipts.review.overhead")} · ${categoryLabel(t, r.links[0].category)}` : t("app.receipts.review.general")}`
                          : r.links.length > 1
                            ? ` · ${t("app.receipts.splitN", { n: r.links.length })}`
                            : ""}
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-foreground tabular-nums shrink-0">
                      {r.total !== null ? money(r.total) : "—"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {list.capped && <p className="px-4 py-2 text-xs text-muted-foreground border-t border-border">{t("app.receipts.capped")}</p>}
        </div>
      )}

      {openId && (
        <ReceiptReview
          key={openId}
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={load}
          onOpen={(other) => setOpenId(other)}
        />
      )}
    </div>
  );
}
