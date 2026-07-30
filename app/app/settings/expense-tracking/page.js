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
} from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";

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
  return `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
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
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">No expenses recorded yet.</p>;
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

export default function ExpenseTrackingPage() {
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
    return fetch(`/api/expenses/summary?month=${monthParam(monthDate)}`)
      .then((r) => r.json())
      .then(setSummary)
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
      if (!res.ok) throw new Error(data.error || "Could not generate summary");
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
          <h1 className="text-2xl font-bold text-foreground">Expense Tracking</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Where your money goes — by job, overhead, and category — plus your
            monthly burn rate.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold"
        >
          <Plus size={14} /> Add Expense
        </button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() =>
            setMonthDate(
              new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1),
            )
          }
          className="p-1.5 rounded-full hover:bg-muted"
          aria-label="Previous month"
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
          className="p-1.5 rounded-full hover:bg-muted"
          aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Tracked expenses this month"
          value={money(totalThisMonth)}
        />
        <KpiCard
          label="Monthly burn rate"
          value={money(burnRate.totalMonthlyBurn)}
          sub="Overhead + salaries + debt"
          tone="red"
          icon={TrendingDown}
        />
        <KpiCard
          label="Runway"
          value={
            burnRate.runwayMonths !== null ? `${burnRate.runwayMonths} mo` : "—"
          }
          sub={
            burnRate.runwayMonths === null
              ? "Add cash on hand to estimate"
              : "At current burn rate"
          }
        />
        <KpiCard
          label="Job-related spend"
          value={money(associationBreakdown.job)}
          sub={`Overhead ${money(associationBreakdown.overhead)} · General ${money(associationBreakdown.general)}`}
        />
      </div>

      {/* AI Summary */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">
              AI Summary
            </h2>
          </div>
          <button
            onClick={handleGenerateAiSummary}
            disabled={aiLoading}
            className="text-sm font-medium border border-border px-3 py-1.5 rounded-full hover:bg-muted disabled:opacity-60"
          >
            {aiLoading
              ? "Thinking..."
              : aiSummary
                ? "Regenerate"
                : "Generate summary"}
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
            Get a plain-language read on this month's spending and burn rate.
          </p>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Burn rate breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-base font-semibold text-foreground mb-4">
            Monthly Burn Breakdown
          </h2>
          <BreakdownBars
            items={[
              { label: "Overhead", total: burnRate.breakdown.overhead },
              { label: "Salaries", total: burnRate.breakdown.salaries },
              { label: "Debt payments", total: burnRate.breakdown.debt },
            ]}
            total={burnRate.totalMonthlyBurn}
          />
          <Link
            href="/app/settings/overhead"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mt-4"
          >
            Manage salaries & debt <ArrowRight size={14} />
          </Link>
        </div>

        {/* Category breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-base font-semibold text-foreground mb-4">
            Spend by Category
          </h2>
          <BreakdownBars items={categoryBreakdown} total={totalThisMonth} />
        </div>
      </div>

      {/* 6-month trend */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">
            6-Month Trend
          </h2>
        </div>
        <TrendChart trend={trend} />
      </div>

      {/* Recent expenses */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            Recent Expenses
          </h2>
        </div>
        <div className="divide-y divide-border">
          {recent.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              No expenses logged yet.
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
                      Overhead
                    </span>
                  )}
                  {e.projectId && (
                    <span className="ml-2 text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                      Job-linked
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
                  aria-label="Delete expense"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

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
              Add Expense
            </h2>
            <form onSubmit={handleAddExpense} className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">
                  Category
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
                    placeholder="Custom category name"
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
                    Amount
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
                    Date
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
                  Associate with
                </label>
                <div className="flex gap-2 mb-2">
                  {[
                    { value: "general", label: "General" },
                    { value: "job", label: "A job" },
                    { value: "overhead", label: "Overhead" },
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
                    <option value="">Select a job...</option>
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
                    Recurring (feeds burn rate below)
                    {form.recurring && (
                      <select
                        className="border border-border rounded px-2 py-1 text-xs ml-2"
                        value={form.frequency}
                        onChange={(e) =>
                          setForm({ ...form, frequency: e.target.value })
                        }
                      >
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    )}
                  </label>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-1">
                  Notes
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
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-inverted text-inverted-foreground py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Add Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
