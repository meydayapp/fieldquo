// app/components/jobs/CostReview.js
//
// The close-out: what this job was estimated to cost, what it actually cost so
// far, what is still missing from the actual, and a button that says "that's
// complete".
//
// It does NOT edit costs itself. Hours are approved on the payroll screen and
// this links there; a missing receipt or material is added as an expense
// tagged to the job, right here, through the same /api/expenses the expense
// screen uses — one write path, not a second one that drifts. What it adds is
// the moment: a completed job whose actual is still half-recorded gets asked.

"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";

const CATEGORIES = ["materials", "subcontractor", "equipment", "other"];

export default function CostReview({ jobId, data, onClose, onChanged, onReviewed }) {
  const { t } = useTranslation();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [add, setAdd] = useState({ category: "materials", amount: "", description: "" });

  const actual = data?.actual || {};
  const comparison = data?.comparison || {};
  const currency = data?.currency || "CAD";
  const money = (n) => {
    const v = Number(n);
    return Number.isFinite(v)
      ? v.toLocaleString(undefined, { style: "currency", currency })
      : t("app.jobCosting.unknown", "not known");
  };
  const pending = Number(actual.labour?.pendingHours || 0);
  const unrated = Number(actual.labour?.unratedHours || 0);
  const incomplete = Boolean(actual.incomplete) || pending > 0 || unrated > 0;

  async function addExpense(e) {
    e.preventDefault();
    const amount = Number(add.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(t("app.jobCosting.addExpenseAmountInvalid", "Enter the amount."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: add.category,
          amount,
          description: add.description.trim() || null,
          projectId: jobId,
        }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.jobCosting.addExpenseFailed", "Couldn't add that expense."));
        return;
      }
      setAdd({ category: "materials", amount: "", description: "" });
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/jobs/${jobId}/costing/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() || null }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.jobCosting.reviewFailed", "Couldn't record the review."));
        return;
      }
      onReviewed?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="cost-review-title">
      <div className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-card border border-border shadow-xl">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
          <div>
            <h2 id="cost-review-title" className="text-lg font-semibold text-foreground">
              {t("app.jobCosting.reviewTitle", "What did this job actually cost?")}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("app.jobCosting.reviewIntro", "The quote estimated a cost. Check the real one: approve the hours, add any receipt or material that isn't here yet, then confirm it's complete. The comparison below is only as good as what's recorded.")}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("app.action.close", "Close")} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* ── Estimate versus actual ────────────────────────────────────── */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-border">
                  <td className="py-2 text-muted-foreground">{t("app.jobCosting.estimate", "Estimated cost (from the quote)")}</td>
                  <td className="py-2 text-right tabular-nums font-medium">{comparison.estimatedCost == null ? t("app.jobCosting.unknown", "not known") : money(comparison.estimatedCost)}</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 text-muted-foreground">{t("app.jobCosting.actual", "Actual cost recorded so far")}</td>
                  <td className="py-2 text-right tabular-nums font-medium">{money(actual.total)}</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 text-muted-foreground">{t("app.jobCosting.variance", "Difference")}</td>
                  <td className={`py-2 text-right tabular-nums font-medium ${comparison.overBudget ? "text-red-600 dark:text-red-400" : ""}`}>
                    {comparison.variance == null ? t("app.jobCosting.unknown", "not known") : `${comparison.variance > 0 ? "+" : ""}${money(comparison.variance)}${comparison.variancePct != null ? ` (${comparison.variancePct > 0 ? "+" : ""}${comparison.variancePct}%)` : ""}`}
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 text-muted-foreground">{t("app.jobCosting.revenue", "Invoiced")}</td>
                  <td className="py-2 text-right tabular-nums">{comparison.revenue == null ? t("app.jobCosting.unknown", "not known") : money(comparison.revenue)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-muted-foreground">{t("app.jobCosting.margin", "Margin")}</td>
                  <td className="py-2 text-right tabular-nums font-semibold">{comparison.marginPct == null ? t("app.jobCosting.unknown", "not known") : `${comparison.marginPct}%`}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── What is still missing from the actual ─────────────────────── */}
          {incomplete && (
            <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <div>
                <p>{t("app.jobCosting.incompleteWarning", "The actual is not complete yet:")}</p>
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  {pending > 0 && (
                    <li>
                      {t("app.jobCosting.pendingHours", "{hours}h logged on this job are waiting for approval and are not counted.", { hours: pending })}{" "}
                      <Link href="/app/payroll" className="underline font-medium">{t("app.jobCosting.approveHours", "Approve hours")}</Link>
                    </li>
                  )}
                  {unrated > 0 && (
                    <li>{t("app.jobCosting.unratedHours", "{hours}h are from a worker with no cost rate, so they count as zero.", { hours: unrated })}</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* ── Add a receipt or material ─────────────────────────────────── */}
          <form onSubmit={addExpense} className="rounded-lg border border-border p-3 space-y-2">
            <p className="text-sm font-medium text-foreground">{t("app.jobCosting.addExpenseTitle", "Add a material or receipt to this job")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <label className="text-xs text-muted-foreground">
                {t("app.jobCosting.addExpenseCategory", "Category")}
                <select value={add.category} onChange={(e) => setAdd({ ...add, category: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground">
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{t(`app.jobCosting.cat_${c}`, c)}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                {t("app.jobCosting.addExpenseAmount", "Amount")}
                <input type="number" inputMode="decimal" step="0.01" min="0" value={add.amount} onChange={(e) => setAdd({ ...add, amount: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground tabular-nums" />
              </label>
              <label className="text-xs text-muted-foreground sm:col-span-2">
                {t("app.jobCosting.addExpenseDesc", "What it was")}
                <input type="text" value={add.description} onChange={(e) => setAdd({ ...add, description: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground" />
              </label>
            </div>
            <button type="submit" disabled={busy} className="min-h-[44px] px-4 rounded-full border border-border text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50">
              {t("app.jobCosting.addExpenseSave", "Add to this job")}
            </button>
          </form>

          {/* ── Note and sign-off ─────────────────────────────────────────── */}
          <label className="block text-xs text-muted-foreground">
            {t("app.jobCosting.noteLabel", "Anything worth remembering about this job's cost (optional)")}
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground" />
          </label>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex flex-wrap items-center gap-2 justify-end">
            <button type="button" onClick={onClose} disabled={busy} className="min-h-[44px] px-4 rounded-full border border-border text-sm font-medium text-foreground hover:bg-muted">
              {t("app.jobCosting.laterButton", "Not yet")}
            </button>
            <button type="button" onClick={complete} disabled={busy} className="min-h-[44px] px-4 rounded-full bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">
              <CheckCircle2 size={16} /> {t("app.jobCosting.completeButton", "The cost is complete")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
