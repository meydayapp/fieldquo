// app/app/settings/expense-tracking/page.js
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Download,
  Upload,
} from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { useTranslation } from "@/app/hooks/useTranslation";
// The same two questions GET /api/export/accounting asks of the same grid —
// see the note on BookkeepingExportCard for why the row's own gate can't
// answer them.
import { useHasLevel, useHasToggle } from "@/app/providers/PermissionProvider";

// Curated presets so the category select is useful out of the box, but this
// is still a free-text field underneath (matching your existing Expense.category
// String column) — anything already in the database shows up in the
// breakdown even if it's not in this list, and typing a new one just works.
const CATEGORY_PRESETS = [
  "Materials",
  "Fuel & Vehicle",
  "Tools & Equipment",
  "Insurance",
  "Rent & Utilities",
  "Software & Subscriptions",
  "Marketing",
  "Permits & Licensing",
  "Office Supplies",
  "Meals & Travel",
  "Other",
];

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

function money(n) {
  // Two decimals, like every other money value in the app. This rounded to
  // whole dollars, so a $125.50 expense — stored correctly — displayed as
  // "$126" on the tile, in job-related spend and in the category breakdown.
  // Someone reconciling a receipt against this screen finds a number that
  // isn't on the receipt.
  // Number(n || 0) let a non-numeric string through: "abc" is truthy, so the
  // `|| 0` never fired and the tile rendered "$NaN". Finite check instead.
  const v = Number(n);
  return `$${(Number.isFinite(v) ? v : 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function monthLabel(date) {
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function monthParam(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function KpiCard({ label, value, sub, icon: Icon, tone = "gray" }) {
  const toneClasses = {
    gray: "text-foreground",
    red: "text-red-600 dark:text-red-400",
    green: "text-green-600 dark:text-green-400",
  };
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        {Icon && <Icon size={16} />} {label}
      </div>
      <div className={`text-2xl font-bold mt-2 ${toneClasses[tone]}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function BreakdownBars({ items, total }) {
  const { t } = useTranslation();
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">{t("app.setExpenses.noneRecorded")}</p>;
  }
  const max = Math.max(...items.map((i) => i.total), 1);
  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.category || item.label}>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-foreground">{item.category || item.label}</span>
            <span className="font-medium text-foreground">
              {money(item.total)}
              {total ? (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  ({Math.round((item.total / total) * 100)}%)
                </span>
              ) : null}
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-inverted rounded-full"
              style={{ width: `${(item.total / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TrendChart({ trend }) {
  const max = Math.max(...trend.map((t) => t.total), 1);
  return (
    <div className="flex items-end gap-3 h-32">
      {trend.map((t) => (
        <div
          key={t.month}
          className="flex-1 flex flex-col items-center gap-1.5"
        >
          <div className="w-full flex items-end justify-center h-24">
            <div
              className="w-full max-w-[28px] bg-inverted rounded-t-md"
              style={{ height: `${Math.max((t.total / max) * 100, 2)}%` }}
              title={money(t.total)}
            />
          </div>
          <span className="text-[11px] text-muted-foreground">{t.month}</span>
        </div>
      ))}
    </div>
  );
}

// ── Bookkeeping export ─────────────────────────────────────────────────────
//
// Why it lives on THIS screen and not on Payments or Company Settings: this is
// the one settings page that is already a record of a PERIOD of money rather
// than a form of settings, and it is already read by the person who handles
// the company's books. Payments configures the Stripe connection; Company
// Settings holds the company's identity. The export is a period of records,
// and it belongs beside the other one.
//
// ── The gate ───────────────────────────────────────────────────────────────
//
// The same two questions GET /api/export/accounting asks, asked of the same
// grid through the same helpers: showPricing, and invoices at view_only or
// better. Hiding the card is not the gate — the route is — but a card that
// 403s for the person looking at it is the dead control AGENTS.md names first,
// and the row that leads here is gated on the expenses grid, which is a
// different question entirely: a member can legitimately hold every expense in
// the company and hold no access to a single invoice.
//
// An unresolved PermissionProvider falls open, which is its own documented
// rule; the route refuses regardless.
//
// ── Why the limits are restated here ───────────────────────────────────────
//
// The summary sheet inside the ZIP states them too, and it is the authority —
// it travels with the numbers to whoever the file is forwarded to. This list
// is the warning BEFORE the download, for the contractor who is about to tell
// their accountant they have sent them the books. A bookkeeper who imports
// this expecting a ledger and finds it is not one blames us, and the honest
// place to prevent that is in front of the button.
//
// docs/INTEGRATIONS-ASSESSMENT.md enumerates ten schema gaps. The seven below
// are the ones a reader of this file would otherwise assume away; the other
// three (external ids, deposit-account mapping, the missing issue-date column)
// are stated in the file itself and mean nothing to somebody who has not
// opened it yet.
function BookkeepingExportCard() {
  const { t } = useTranslation();
  const canSeePricing = useHasToggle("showPricing");
  const canReadInvoices = useHasLevel("invoices", "view_only");

  // Last COMPLETE calendar month, in UTC — which is how the export groups its
  // days, and how /app/analytics/statements builds its presets. Deriving it
  // from the browser's local clock would put the boundary a day out for
  // anybody west of Greenwich, and two screens would then disagree about which
  // month an invoice fell in.
  const [range, setRange] = useState(() => {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const iso = (d) => d.toISOString().slice(0, 10);
    return {
      from: iso(new Date(Date.UTC(y, m - 1, 1))),
      to: iso(new Date(Date.UTC(y, m, 0))),
    };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!canSeePricing || !canReadInvoices) return null;

  async function handleDownload() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/export/accounting?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
      );
      if (!res.ok) {
        // The route's own sentence when it has one — it explains a backwards
        // range or a missing billing currency far better than a generic
        // failure could, and those are the two refusals a contractor will
        // actually meet.
        await reportResponseError(
          res,
          setError,
          t("app.setExpenses.exportFailed", "Couldn't build that export."),
        );
        return;
      }
      // A blob and a synthetic click rather than a plain link, so a refusal is
      // a message on this card instead of a page of raw JSON in a new tab.
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bookkeeping-${range.from}-to-${range.to}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(t("app.setExpenses.exportFailed", "Couldn't build that export."));
    } finally {
      setBusy(false);
    }
  }

  const limits = [
    t(
      "app.setExpenses.exportLimitFiling",
      "It is an export, not a filing. Nothing in it has been remitted to any tax authority.",
    ),
    t(
      "app.setExpenses.exportLimitTaxCodes",
      "It cannot produce a sales-tax return. Invoice tax is one amount per invoice, with no tax codes and no per-line tax.",
    ),
    t(
      "app.setExpenses.exportLimitExpenseTax",
      "Expenses carry no tax and no supplier, so input tax credits and recoverable VAT are not in it.",
    ),
    t(
      "app.setExpenses.exportLimitRefunds",
      "FieldQuo records no refunds and no credit notes. If money went back to a client, it is not in this file.",
    ),
    t(
      "app.setExpenses.exportLimitAccounts",
      "There is no chart of accounts. Nothing here is mapped to a GL account — your bookkeeper does that once, on import.",
    ),
    t(
      "app.setExpenses.exportLimitStripeFee",
      "Card payments are listed at face value. Stripe's fee is not recorded, so this will not reconcile against a bank feed line for line.",
    ),
    t(
      "app.setExpenses.exportLimitDates",
      "Days are grouped in UTC, and there is no invoice issue-date field — every invoice states which column its date came from.",
    ),
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2">
        <Download size={16} className="text-muted-foreground" />
        <h2 className="text-base font-semibold text-foreground">
          {t("app.setExpenses.exportTitle", "Bookkeeping export")}
        </h2>
      </div>
      <p className="text-sm text-muted-foreground mt-1">
        {t(
          "app.setExpenses.exportSubtitle",
          "A date range of invoices, payments and expenses as four CSV files in one ZIP — a summary sheet plus one file each — for handing to an accountant or importing into their software.",
        )}
      </p>

      <div className="flex flex-wrap items-end gap-3 mt-4">
        <div>
          <label
            htmlFor="bookkeeping-from"
            className="text-sm font-medium text-foreground block mb-1"
          >
            {t("app.setExpenses.exportFrom", "From")}
          </label>
          <input
            id="bookkeeping-from"
            type="date"
            className={inputClass}
            value={range.from}
            onChange={(e) => setRange({ ...range, from: e.target.value })}
          />
        </div>
        <div>
          <label
            htmlFor="bookkeeping-to"
            className="text-sm font-medium text-foreground block mb-1"
          >
            {t("app.setExpenses.exportTo", "To")}
          </label>
          <input
            id="bookkeeping-to"
            type="date"
            className={inputClass}
            value={range.to}
            onChange={(e) => setRange({ ...range, to: e.target.value })}
          />
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={busy}
          className="bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
        >
          {busy
            ? t("app.setExpenses.exportBuilding", "Building…")
            : t("app.setExpenses.exportDownload", "Download the range")}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 mt-3">{error}</p>
      )}

      <p className="text-xs text-muted-foreground mt-4">
        {t(
          "app.setExpenses.exportCurrencyNote",
          "Amounts are in your company's billing currency, which is set on Company Settings. Without one the export refuses rather than guessing a currency.",
        )}
      </p>

      <div className="mt-4 border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-foreground">
          {t("app.setExpenses.exportLimitsTitle", "What this file does not contain")}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {t(
            "app.setExpenses.exportLimitsIntro",
            "This is a clean set of records, not a general ledger and not a QuickBooks sync. The summary sheet inside the ZIP repeats the list below, so it travels with the numbers.",
          )}
        </p>
        <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1 mt-2">
          {limits.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function ExpenseTrackingPage() {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    category: "Materials",
    customCategory: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    notes: "",
    association: "general", // "general" | "job" | "overhead"
    jobId: "",
    recurring: false,
    frequency: "monthly",
  });

  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const loadSummary = useCallback(() => {
    setLoading(true);
    // Guard res.ok — feeding an error body into setSummary crashed the render.
    return fetch(`/api/expenses/summary?month=${monthParam(monthDate)}`)
      .then(async (r) => {
        if (!r.ok) return reportResponseError(r);
        setSummary(await r.json());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [monthDate]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    fetch("/api/jobs")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setJobs(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Reset any stale AI summary when the viewed month changes.
    setAiSummary(null);
    setAiError("");
  }, [monthDate]);

  async function handleAddExpense(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const category =
        form.category === "Other" && form.customCategory
          ? form.customCategory
          : form.category;

      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          amount: Number(form.amount),
          date: form.date,
          notes: form.notes || null,
          projectId: form.association === "job" ? form.jobId || null : null,
          isOverhead: form.association === "overhead",
          recurring: form.recurring,
          frequency: form.recurring ? form.frequency : "one_time",
        }),
      });
      if (res.ok) {
        setShowAddModal(false);
        setForm({
          category: "Materials",
          customCategory: "",
          amount: "",
          date: new Date().toISOString().slice(0, 10),
          notes: "",
          association: "general",
          jobId: "",
          recurring: false,
          frequency: "monthly",
        });
        loadSummary();
      } else {
        // Was silent: a failed request did nothing visible at all.
        await reportResponseError(res);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteExpense(id) {
    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    if (res.ok) loadSummary(); else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
  }

  async function handleGenerateAiSummary() {
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch("/api/ai/ai-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: monthParam(monthDate) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("app.setExpenses.summaryError"));
      setAiSummary(data);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  }

  if (loading || !summary) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto animate-pulse space-y-4">
        <div className="h-8 w-56 bg-accent rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-accent rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-accent rounded-xl" />
      </div>
    );
  }

  const {
    burnRate,
    associationBreakdown,
    categoryBreakdown,
    trend,
    recent,
    totalThisMonth,
  } = summary;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("app.setExpenses.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("app.setExpenses.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/app/settings/expense-tracking/import"
            className="flex items-center gap-2 border border-border text-foreground px-4 py-2.5 rounded-full text-sm font-semibold hover:bg-muted"
          >
            <Upload size={14} /> {t("app.expImport.ctaButton", "Import from bank CSV")}
          </Link>
          <button
            data-tour="expense-add"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold"
          >
            <Plus size={14} /> {t("app.setExpenses.addExpense")}
          </button>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() =>
            setMonthDate(
              new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1),
            )
          }
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-muted"
          aria-label={t("app.setExpenses.prevMonth")}
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-medium text-foreground w-40 text-center">
          {monthLabel(monthDate)}
        </span>
        <button
          onClick={() =>
            setMonthDate(
              new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1),
            )
          }
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-muted"
          aria-label={t("app.setExpenses.nextMonth")}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* KPIs */}
      <div data-tour="expense-kpis" className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label={t("app.setExpenses.kpiTracked")}
          value={money(totalThisMonth)}
        />
        <KpiCard
          label={t("app.setExpenses.kpiBurn")}
          value={money(burnRate.totalMonthlyBurn)}
          sub={t("app.setExpenses.kpiBurnSub")}
          tone="red"
          icon={TrendingDown}
        />
        <KpiCard
          label={t("app.setExpenses.kpiRunway")}
          value={
            burnRate.runwayMonths !== null
              ? t("app.setExpenses.months", { n: burnRate.runwayMonths })
              : "—"
          }
          sub={
            burnRate.runwayMonths === null
              ? t("app.setExpenses.runwayAddCash")
              : t("app.setExpenses.runwayAtBurn")
          }
        />
        <KpiCard
          label={t("app.setExpenses.kpiJobSpend")}
          value={money(associationBreakdown.job)}
          sub={t("app.setExpenses.kpiJobSpendSub", {
            overhead: money(associationBreakdown.overhead),
            general: money(associationBreakdown.general),
          })}
        />
      </div>

      {/* AI Summary */}
      <div data-tour="expense-ai" className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">
              {t("app.setExpenses.aiSummary")}
            </h2>
          </div>
          <button
            onClick={handleGenerateAiSummary}
            disabled={aiLoading}
            className="text-sm font-medium border border-border px-3 py-1.5 rounded-full hover:bg-muted disabled:opacity-60"
          >
            {aiLoading
              ? t("app.setExpenses.aiThinking")
              : aiSummary
                ? t("app.setExpenses.aiRegenerate")
                : t("app.setExpenses.aiGenerate")}
          </button>
        </div>
        {aiError && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{aiError}</p>}
        {aiSummary && (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-foreground">{aiSummary.summaryText}</p>
            {aiSummary.flags?.length > 0 && (
              <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                {aiSummary.flags.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {!aiSummary && !aiError && (
          <p className="text-sm text-muted-foreground mt-2">
            {t("app.setExpenses.aiEmptyHint")}
          </p>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Burn rate breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-base font-semibold text-foreground mb-4">
            {t("app.setExpenses.burnBreakdown")}
          </h2>
          <BreakdownBars
            items={[
              { label: t("app.setExpenses.overhead"), total: burnRate.breakdown.overhead },
              { label: t("app.setExpenses.salaries"), total: burnRate.breakdown.salaries },
              { label: t("app.setExpenses.debtPayments"), total: burnRate.breakdown.debt },
            ]}
            total={burnRate.totalMonthlyBurn}
          />
          <Link
            href="/app/settings/overhead"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mt-4"
          >
            {t("app.setExpenses.manageSalariesDebt")} <ArrowRight size={14} />
          </Link>
        </div>

        {/* Category breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-base font-semibold text-foreground mb-4">
            {t("app.setExpenses.spendByCategory")}
          </h2>
          <BreakdownBars items={categoryBreakdown} total={totalThisMonth} />
        </div>
      </div>

      {/* 6-month trend */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">
            {t("app.setExpenses.sixMonthTrend")}
          </h2>
        </div>
        <TrendChart trend={trend} />
      </div>

      {/* Recent expenses */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            {t("app.setExpenses.recentExpenses")}
          </h2>
        </div>
        <div className="divide-y divide-border">
          {recent.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              {t("app.setExpenses.noneLogged")}
            </p>
          )}
          {recent.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between px-5 py-3"
            >
              <div>
                <div className="text-sm font-medium text-foreground">
                  {e.category}
                  {e.isOverhead && (
                    <span className="ml-2 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                      {t("app.setExpenses.overhead")}
                    </span>
                  )}
                  {e.projectId && (
                    <span className="ml-2 text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                      {t("app.setExpenses.jobLinked")}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(e.date)}
                  {e.notes ? ` · ${e.notes}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-foreground">
                  {money(e.amount)}
                </span>
                <button
                  onClick={() => handleDeleteExpense(e.id)}
                  className="text-muted-foreground hover:text-red-500"
                  aria-label={t("app.setExpenses.deleteExpense")}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BookkeepingExportCard />

      {/* Add Expense modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-card rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-foreground mb-4">
              {t("app.setExpenses.addExpense")}
            </h2>
            <form onSubmit={handleAddExpense} className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">
                  {t("app.setExpenses.category")}
                </label>
                <select
                  className={inputClass}
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                >
                  {CATEGORY_PRESETS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {form.category === "Other" && (
                  <input
                    placeholder={t("app.setExpenses.customCategory")}
                    value={form.customCategory}
                    onChange={(e) =>
                      setForm({ ...form, customCategory: e.target.value })
                    }
                    className={`${inputClass} mt-2`}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1">
                    {t("app.setExpenses.amount")}
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    className={inputClass}
                    value={form.amount}
                    onChange={(e) =>
                      setForm({ ...form, amount: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1">
                    {t("app.setExpenses.date")}
                  </label>
                  <input
                    required
                    type="date"
                    className={inputClass}
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-1">
                  {t("app.setExpenses.associateWith")}
                </label>
                <div className="flex gap-2 mb-2">
                  {[
                    { value: "general", label: t("app.setExpenses.assocGeneral") },
                    { value: "job", label: t("app.setExpenses.assocJob") },
                    { value: "overhead", label: t("app.setExpenses.overhead") },
                  ].map((opt) => (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() =>
                        setForm({ ...form, association: opt.value })
                      }
                      className={`flex-1 text-sm py-2 rounded-lg border ${
                        form.association === opt.value
                          ? "bg-inverted text-inverted-foreground border-inverted"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {form.association === "job" && (
                  <select
                    className={inputClass}
                    value={form.jobId}
                    onChange={(e) =>
                      setForm({ ...form, jobId: e.target.value })
                    }
                  >
                    <option value="">{t("app.setExpenses.selectJob")}</option>
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title} — {j.client?.name}
                      </option>
                    ))}
                  </select>
                )}
                {form.association === "overhead" && (
                  <label className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <input
                      type="checkbox"
                      checked={form.recurring}
                      onChange={(e) =>
                        setForm({ ...form, recurring: e.target.checked })
                      }
                    />
                    {t("app.setExpenses.recurring")}
                    {form.recurring && (
                      <select
                        className="border border-border rounded px-2 py-1 text-xs ml-2"
                        value={form.frequency}
                        onChange={(e) =>
                          setForm({ ...form, frequency: e.target.value })
                        }
                      >
                        <option value="weekly">{t("app.setExpenses.weekly")}</option>
                        <option value="monthly">{t("app.setExpenses.monthly")}</option>
                        <option value="yearly">{t("app.setExpenses.yearly")}</option>
                      </select>
                    )}
                  </label>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-1">
                  {t("app.field.notes")}
                </label>
                <textarea
                  className={inputClass}
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 border border-border text-foreground py-2.5 rounded-lg text-sm font-semibold"
                >
                  {t("app.action.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-inverted text-inverted-foreground py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
                >
                  {saving ? t("app.action.saving") : t("app.setExpenses.addExpense")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
