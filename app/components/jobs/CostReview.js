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

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";
import { withPathSet } from "@/lib/costing/materialCalibration";

const CATEGORIES = ["materials", "subcontractor", "equipment", "other"];

// ── Applying a suggested rate ───────────────────────────────────────────────
//
// Each store has ONE write path, and it is the settings screen's own. Both
// routes store the override document WHOLESALE — PUT /material-recipes
// replaces MaterialRecipeSetting.overrides, PATCH /service-categories
// replaces CompanyServiceCategory.rates — so the current document is read
// first and the one path is set on it. Sending `{ tape: { perUnits: 6 } }`
// alone would have wiped every other rate the company had saved, which is
// the opposite of "update one number".
async function applyRecipeRate({ categoryKey, path, value }) {
  const current = await fetch("/api/settings/material-recipes");
  if (!current.ok) return current;
  const all = await current.json();
  // The settings page strips the same three keys before it PUTs.
  // eslint-disable-next-line no-unused-vars
  const { _hasOverrides, model, label, ...overrides } = all?.[categoryKey] || {};
  return fetch("/api/settings/material-recipes", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ categoryKey, overrides: withPathSet(overrides, path, value) }),
  });
}

async function applyBookRate({ categoryKey, path, value }) {
  const current = await fetch("/api/settings/service-categories");
  if (!current.ok) return current;
  const all = await current.json();
  const cat = (Array.isArray(all) ? all : all?.categories || []).find((c) => c?.key === categoryKey);
  if (!cat) return new Response(JSON.stringify({ error: "Trade not found" }), { status: 404 });
  return fetch("/api/settings/service-categories", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      categories: [
        {
          categoryId: cat.id,
          // Round-tripped exactly as Settings > Services sends them: the PATCH
          // writes these three unconditionally, so omitting them would null
          // the trade's rate and unit on a save that only meant to touch
          // coverage.
          enabled: cat.enabled,
          defaultRate: cat.defaultRate ?? null,
          unit: cat.unit ?? null,
          rates: withPathSet(cat.rateOverrides || {}, path, value),
        },
      ],
    }),
  });
}

export default function CostReview({ jobId, data, onClose, onChanged, onReviewed }) {
  const { t } = useTranslation();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [add, setAdd] = useState({ category: "materials", amount: "", description: "" });
  // The materials comparison — null while loading, { lines, hasActuals } once
  // read, { failed: true } when the read itself failed (said, not hidden).
  const [calib, setCalib] = useState(null);
  const [applyingId, setApplyingId] = useState(null);
  // materialId → the value that was written, so the line can say so.
  const [applied, setApplied] = useState({});

  useEffect(() => {
    if (!jobId) return;
    let live = true;
    fetch(`/api/jobs/${jobId}/costing/calibration`)
      .then(async (r) => (r.ok ? r.json() : { failed: true }))
      .then((d) => live && setCalib(d))
      .catch(() => live && setCalib({ failed: true }));
    return () => {
      live = false;
    };
  }, [jobId]);

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

  async function applyRate(line) {
    if (!line?.apply) return;
    setApplyingId(line.materialId);
    setError("");
    try {
      const res =
        line.apply.store === "book"
          ? await applyBookRate(line.apply)
          : await applyRecipeRate(line.apply);
      if (!res.ok) {
        await reportResponseError(res, t("app.jobCosting.calibApplyFailed", "Couldn't update the calculation."));
        return;
      }
      setApplied((a) => ({ ...a, [line.materialId]: line.apply.value }));
    } catch (err) {
      setError(err.message);
    } finally {
      setApplyingId(null);
    }
  }

  // The materials list is on the job page under this modal.
  function goToMaterials() {
    onClose?.();
    if (typeof document !== "undefined") {
      document.getElementById("job-materials")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const fmtNum = (n) =>
    Number.isFinite(Number(n)) ? Number(n).toLocaleString(undefined, { maximumFractionDigits: 3 }) : "";
  const unitWord = (key) => (key ? t(`app.jobCosting.calibUnit_${key}`, key) : "");
  const rateWord = (key) => (key ? t(`app.jobCosting.calibRate_${key}`, key) : "");
  const calibLines = Array.isArray(calib?.lines) ? calib.lines : [];

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

          {/* ── Materials: what was used against what the estimate said ──── */}
          {calib?.failed && (
            <p className="text-xs text-muted-foreground">
              {t("app.jobCosting.calibLoadFailed", "Couldn't load the materials comparison.")}
            </p>
          )}
          {calibLines.length > 0 && !calib.hasActuals && (
            <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
              {t("app.jobCosting.calibNudge", "None of this job's materials has a used quantity recorded yet. Record them on the materials list and this review will compare each one against the calculation behind your quotes.")}{" "}
              <button type="button" onClick={goToMaterials} className="underline font-medium text-foreground min-h-[44px]">
                {t("app.jobCosting.calibRecordLink", "Go to the materials list")}
              </button>
            </div>
          )}
          {calibLines.length > 0 && calib.hasActuals && (
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t("app.jobCosting.calibTitle", "Materials: what you used vs what the estimate said")}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("app.jobCosting.calibIntro", "Per line, the rate the calculation uses today and the rate this one job actually got. Quantities are whole units bought. Nothing changes unless you press the button.")}
                </p>
              </div>
              <ul className="divide-y divide-border">
                {calibLines.map((l) => {
                  const done = applied[l.materialId];
                  return (
                    <li key={l.materialId} className="py-2 text-sm">
                      <p className="font-medium text-foreground">{l.name}</p>
                      {l.actualQty == null ? (
                        <p className="text-xs text-muted-foreground">
                          {t("app.jobCosting.calibRecord", "Record how many you used on the materials list.")}{" "}
                          <button type="button" onClick={goToMaterials} className="underline min-h-[44px]">
                            {t("app.jobCosting.calibRecordLink", "Go to the materials list")}
                          </button>
                        </p>
                      ) : (
                        <>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {l.unitsOfWork > 0
                              ? t("app.jobCosting.calibLine", "Estimated {est} {unit}, used {actual} {unit}, over {units} {work}.", {
                                  est: fmtNum(l.estimatedQty),
                                  actual: fmtNum(l.actualQty),
                                  unit: l.unit,
                                  units: fmtNum(l.unitsOfWork),
                                  work: unitWord(l.unitLabel),
                                })
                              : t("app.jobCosting.calibLineNoWork", "Estimated {est} {unit}, used {actual} {unit}.", {
                                  est: fmtNum(l.estimatedQty),
                                  actual: fmtNum(l.actualQty),
                                  unit: l.unit,
                                })}
                          </p>
                          {l.currentRate?.value != null && l.suggestedRate != null && (
                            <p className="text-xs text-foreground tabular-nums">
                              {t("app.jobCosting.calibRates", "Calculation now: {current} {rate} → this job: {suggested} {rate} ({delta}%).", {
                                current: fmtNum(l.currentRate.value),
                                suggested: fmtNum(l.suggestedRate),
                                rate: rateWord(l.currentRate.label),
                                delta: `${l.deltaPct > 0 ? "+" : ""}${fmtNum(l.deltaPct)}`,
                              })}
                            </p>
                          )}
                          {/* The button exists only where canApply is true —
                              a path the company can save today AND a caller
                              who may save it. Everything else says why. */}
                          {done != null ? (
                            <p className="text-xs text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 size={12} className="inline mr-1" />
                              {t("app.jobCosting.calibApplied", "Updated to {value} {rate}. Future quotes use it from now.", {
                                value: fmtNum(done),
                                rate: rateWord(l.currentRate?.label),
                              })}{" "}
                              <Link
                                href={l.currentRate?.store === "book" ? "/app/settings/services" : "/app/settings/material-costs"}
                                className="underline"
                              >
                                {l.currentRate?.store === "book"
                                  ? t("app.jobCosting.calibRatesLink", "Settings → Services")
                                  : t("app.jobCosting.calibSettingsLink", "Settings → Material Costs")}
                              </Link>
                            </p>
                          ) : l.canApply ? (
                            <button
                              type="button"
                              onClick={() => applyRate(l)}
                              disabled={busy || applyingId === l.materialId}
                              className="mt-1 min-h-[44px] px-4 rounded-full border border-border text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                            >
                              {t("app.jobCosting.calibApply", "Update the calculation for future quotes")}
                            </button>
                          ) : (
                            l.reason && (
                              <p className="text-xs text-muted-foreground">
                                {t(`app.jobCosting.calibReason_${l.reason}`, l.reason)}
                              </p>
                            )
                          )}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
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
