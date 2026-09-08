// app/components/jobs/CostReview.js
//
// The close-out: what this job was estimated to cost, what it actually cost,
// and — when the gap is big enough to matter — whether to change the costing
// so the next quote is closer.
//
// Top to bottom, in the order the owner asked for on 2026-09-08 ("when a job
// is completed an expense and cost revision should be made, of materials AND
// labour"):
//
//   1. Labour     the hours the quote predicted against the hours approved,
//                 with the pending and unrated hours that make the actual
//                 short. Approving happens on the payroll screen; this links.
//   2. Materials  every line on the job, with "actually used" typed HERE —
//                 not on a list nobody revisits — and saved through the same
//                 PATCH the materials list uses. A receipt nobody scanned is
//                 added as an expense underneath, through the same
//                 /api/expenses the expense screen uses.
//   3. The verdict  one line: estimated, actual, the difference, the margin.
//                 If the job came in over the company's threshold (Settings →
//                 Material Costs, default 15%), one question: update your
//                 costing from what it really cost, or leave it? "Update"
//                 opens the per-line suggestions — each with a button ONLY
//                 where a saved rate exists to move. Either answer is recorded
//                 once and the job is never asked again.
//   4. Sign-off   "The cost is complete", which also settles the task.
//
// Nothing here edits a cost directly, and no suggestion is applied without a
// press: see lib/costing/materialCalibration.js and
// lib/costing/labourCalibration.js for what is refused.

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";
import { withPathSet } from "@/lib/costing/materialCalibration";
import { REVISION_DECISIONS } from "@/lib/costing/costRevision";

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

/** A date, in the reader's own locale. Dates only. */
function fmtDay(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function CostReview({ jobId, data, onClose, onChanged, onReviewed }) {
  const { t } = useTranslation();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [add, setAdd] = useState({ category: "materials", amount: "", description: "" });

  // ── The calibration — null while loading, { lines, labour, hasActuals }
  // once read, { failed: true } when the read itself failed (said, not hidden).
  const [calib, setCalib] = useState(null);
  const [calibKey, setCalibKey] = useState(0);
  const [applyingId, setApplyingId] = useState(null);
  // materialId → the value that was written, so the line can say so.
  const [applied, setApplied] = useState({});
  const [appliedLabour, setAppliedLabour] = useState(null);

  // ── The job's materials, the SAME list the materials panel shows, from the
  // same GET. { materials, progress } | { failed: true } | null.
  const [mats, setMats] = useState(null);
  // materialId → what the "actually used" box says. A box with no entry
  // shows the stored actual, or the estimate when none is stored.
  const [usedDraft, setUsedDraft] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);

  // ── The threshold decision. Seeded from the job; local once made so the
  // screen answers immediately, and the panel re-reads on onChanged.
  const revision = data?.revision || { ask: false, decision: null, decidedAt: null, thresholdPct: null };
  const [decision, setDecision] = useState(revision.decision || null);
  const [decidedAt, setDecidedAt] = useState(revision.decidedAt || null);
  const [deciding, setDeciding] = useState(false);
  // "Update" pressed: the per-line suggestions are open.
  const [revealing, setRevealing] = useState(false);

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
  }, [jobId, calibKey]);

  const loadMaterials = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/materials`);
      if (!res.ok) {
        setMats({ failed: true });
        return;
      }
      setMats(await res.json());
    } catch {
      setMats({ failed: true });
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    loadMaterials();
  }, [jobId, loadMaterials]);

  const actual = data?.actual || {};
  const comparison = data?.comparison || {};
  const currency = data?.currency || "CAD";
  const money = (n) => {
    const v = Number(n);
    return Number.isFinite(v)
      ? v.toLocaleString(undefined, { style: "currency", currency })
      : t("app.jobCosting.unknown", "not known");
  };
  const fmtNum = (n) =>
    Number.isFinite(Number(n)) ? Number(n).toLocaleString(undefined, { maximumFractionDigits: 3 }) : "";
  const unitWord = (key) => (key ? t(`app.jobCosting.calibUnit_${key}`, key) : "");
  const rateWord = (key) => (key ? t(`app.jobCosting.calibRate_${key}`, key) : "");

  const approved = Number(actual.labour?.approvedHours || 0);
  const pending = Number(actual.labour?.pendingHours || 0);
  const unrated = Number(actual.labour?.unratedHours || 0);
  const estimatedHours = data?.estimatedHours == null ? null : Number(data.estimatedHours);
  const incomplete = Boolean(actual.incomplete) || pending > 0 || unrated > 0;

  // The question is open: the job crossed the line and nobody has answered.
  const asking = Boolean(revision.ask) && !decision;
  const calibLines = Array.isArray(calib?.lines) ? calib.lines : [];
  const labourLine = calib?.labour || null;
  const materials = Array.isArray(mats?.materials) ? mats.materials : [];

  // ── Recording the answer ──────────────────────────────────────────────────
  //
  // One route, both buttons, and the first apply. Returns whether it stuck,
  // so an apply that could not record "updated" still reports its own result
  // honestly rather than pretending the decision was made.
  async function recordDecision(value) {
    if (decision) return true;
    setDeciding(true);
    setError("");
    try {
      const res = await fetch(`/api/jobs/${jobId}/costing/revision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: value }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.jobCosting.revisionDecisionFailed", "Couldn't record that choice."));
        return false;
      }
      const body = await res.json();
      setDecision(body.decision || value);
      setDecidedAt(body.decidedAt || new Date().toISOString());
      onChanged?.();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setDeciding(false);
    }
  }

  async function leaveAsIs() {
    setRevealing(false);
    await recordDecision(REVISION_DECISIONS.LEFT_AS_IS);
  }

  async function doneUpdating() {
    const stuck = await recordDecision(REVISION_DECISIONS.UPDATED);
    if (stuck) setRevealing(false);
  }

  // ── Materials: what was actually used ─────────────────────────────────────
  //
  // The SAME PATCH the materials list uses, with the same body. A line not
  // yet ticked as bought is ticked by the save — the route refuses a used
  // quantity on an unbought line rather than dropping it — and the screen
  // says so beside the box before the press.
  function usedValue(m) {
    if (usedDraft[m.id] !== undefined) return usedDraft[m.id];
    return String(m.actualQty ?? m.qty ?? "");
  }
  function usedDirty(m) {
    if (m.actualQty == null) return usedValue(m) !== "";
    return usedValue(m) !== String(m.actualQty);
  }
  async function saveUsed(m) {
    const qty = Number(usedValue(m));
    if (usedValue(m) === "" || !Number.isFinite(qty) || qty < 0) {
      setError(t("app.jobMaterials.usedInvalid", "Enter how many were used as a number."));
      return;
    }
    setSavingId(m.id);
    setError("");
    try {
      const res = await fetch(`/api/jobs/${jobId}/materials`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: m.id,
          actualQty: qty,
          ...(m.purchasedAt ? {} : { purchased: true }),
        }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.jobCosting.usedSaveFailed", "Couldn't save that quantity."));
        return;
      }
      setMats(await res.json());
      setUsedDraft((d) => {
        const next = { ...d };
        delete next[m.id];
        return next;
      });
      setSavedId(m.id);
      // The calibration reads actualQty; re-read it so the suggestions match
      // what was just typed rather than what was there a minute ago.
      setCalibKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  }

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
      // Applying IS the decision. Recorded on the first line; a second apply
      // finds it already made.
      await recordDecision(REVISION_DECISIONS.UPDATED);
    } catch (err) {
      setError(err.message);
    } finally {
      setApplyingId(null);
    }
  }

  async function applyLabour(line) {
    if (!line?.apply) return;
    setApplyingId("labour");
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
      setAppliedLabour(line.apply.value);
      await recordDecision(REVISION_DECISIONS.UPDATED);
    } catch (err) {
      setError(err.message);
    } finally {
      setApplyingId(null);
    }
  }

  // The materials are on THIS screen now; a "record it" link scrolls to them.
  function goToMaterials() {
    if (typeof document !== "undefined") {
      document.getElementById("cost-review-materials")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function complete() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/jobs/${jobId}/costing/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: note.trim() || null,
          // Completing while the question is still open counts as leaving the
          // costing as it is — said under the button, sent explicitly, never
          // inferred server-side from silence.
          ...(asking && { revisionDecision: REVISION_DECISIONS.LEFT_AS_IS }),
        }),
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

  // ── The one-line verdict ──────────────────────────────────────────────────
  const pct = comparison.variancePct == null ? null : Number(comparison.variancePct);
  const verdict =
    comparison.estimatedCost == null
      ? t("app.jobCosting.verdictNoEstimate", "No estimate to compare against — actual cost {actual}.", {
          actual: money(actual.total),
        })
      : pct != null && pct > 0
        ? t("app.jobCosting.verdictOver", "Estimated {estimate}, actual {actual} — {pct}% over.", {
            estimate: money(comparison.estimatedCost),
            actual: money(actual.total),
            pct: fmtNum(pct),
          })
        : pct != null && pct < 0
          ? t("app.jobCosting.verdictUnder", "Estimated {estimate}, actual {actual} — {pct}% under.", {
              estimate: money(comparison.estimatedCost),
              actual: money(actual.total),
              pct: fmtNum(Math.abs(pct)),
            })
          : t("app.jobCosting.verdictEven", "Estimated {estimate}, actual {actual} — on the estimate.", {
              estimate: money(comparison.estimatedCost),
              actual: money(actual.total),
            });
  const marginSentence =
    comparison.marginPct == null
      ? t("app.jobCosting.verdictMarginUnknown", "Margin not known yet — nothing invoiced.")
      : t("app.jobCosting.verdictMargin", "Margin {margin}%.", { margin: fmtNum(comparison.marginPct) });

  const anySuggestion = calibLines.length > 0 || labourLine;

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
          {/* ── 1. Labour ─────────────────────────────────────────────────── */}
          <section className="rounded-lg border border-border p-3 space-y-2">
            <p className="text-sm font-medium text-foreground">
              {t("app.jobCosting.labourTitle", "Labour: hours estimated vs approved")}
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">{t("app.jobCosting.labourEstimatedLabel", "Estimated (from the quote)")}</p>
                <p className="tabular-nums font-medium">
                  {estimatedHours == null
                    ? t("app.jobCosting.labourEstimatedUnknown", "not estimated")
                    : t("app.jobCosting.hoursValue", "{hours}h", { hours: fmtNum(estimatedHours) })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("app.jobCosting.labourApprovedLabel", "Approved on this job")}</p>
                <p className="tabular-nums font-medium">{t("app.jobCosting.hoursValue", "{hours}h", { hours: fmtNum(approved) })}</p>
              </div>
            </div>
            {/* What is still missing from the actual. The approve link goes
                to the payroll screen — hours are approved there, never here. */}
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
          </section>

          {/* ── 2. Materials ──────────────────────────────────────────────── */}
          <section id="cost-review-materials" className="rounded-lg border border-border p-3 space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                {t("app.jobCosting.materialsTitle", "Materials: what the estimate said vs what you used")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("app.jobCosting.materialsIntro", "Type what was actually used and save each line. A quantity read off a scanned receipt is already filled in. Lines added by hand show their own quantity — there is no estimate behind them.")}
              </p>
            </div>
            {mats?.failed && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {t("app.jobCosting.materialsLoadFailed", "Couldn't load this job's materials.")}
              </p>
            )}
            {mats && !mats.failed && materials.length === 0 && (
              <p className="text-xs text-muted-foreground">
                {t("app.jobCosting.materialsNone", "This job has no materials list. Add what was bought as a receipt below.")}
              </p>
            )}
            {materials.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground text-left">
                      <th className="py-1 font-medium">{t("app.jobCosting.colMaterial", "Material")}</th>
                      <th className="py-1 font-medium text-right">{t("app.jobCosting.colEstimated", "Estimated")}</th>
                      <th className="py-1 font-medium">{t("app.jobCosting.colUsed", "Actually used")}</th>
                      <th className="py-1 font-medium text-right">{t("app.jobCosting.colCost", "Cost")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {materials.map((m) => (
                      <tr key={m.id} className="align-top">
                        <td className="py-2 pr-2">
                          <p className="text-foreground">{m.name}</p>
                          {m.addedByHand && (
                            <p className="text-xs text-muted-foreground">{t("app.jobCosting.byHand", "added by hand")}</p>
                          )}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums whitespace-nowrap">
                          {fmtNum(m.qty)} {m.unit}
                        </td>
                        <td className="py-2 pr-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              aria-label={t("app.jobMaterials.usedLabel", "How many did you actually use?")}
                              value={usedValue(m)}
                              onChange={(e) => setUsedDraft((d) => ({ ...d, [m.id]: e.target.value }))}
                              className="w-20 rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground tabular-nums"
                            />
                            <span className="text-xs text-muted-foreground">{m.unit}</span>
                            {usedDirty(m) ? (
                              <button
                                type="button"
                                onClick={() => saveUsed(m)}
                                disabled={savingId === m.id}
                                className="min-h-[44px] px-3 rounded-full border border-border text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                              >
                                {t("app.action.save", "Save")}
                              </button>
                            ) : (
                              savedId === m.id && (
                                <span className="text-xs text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                                  <CheckCircle2 size={12} /> {t("app.jobCosting.usedSaved", "Saved")}
                                </span>
                              )
                            )}
                          </div>
                          {!m.purchasedAt && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {t("app.jobCosting.usedSaveMarksBought", "Not ticked as bought yet — saving marks it bought.")}
                            </p>
                          )}
                        </td>
                        <td className="py-2 text-right tabular-nums whitespace-nowrap">
                          {/* Costs stripped by the server for a member without
                              the jobCosting toggle — this modal is behind that
                              toggle, but the shape is honoured anyway. */}
                          {m.costHidden ? (
                            <span className="text-muted-foreground">—</span>
                          ) : m.actualCost != null ? (
                            <span className="text-foreground">{money(m.actualCost)}</span>
                          ) : m.estUnitCost != null ? (
                            <span className="text-muted-foreground">
                              {t("app.jobCosting.estCost", "est {amount}", { amount: money(m.estUnitCost * m.qty) })}
                            </span>
                          ) : (
                            <span className="text-amber-700 dark:text-amber-400">{t("app.jobCosting.noPrice", "no price set")}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* A receipt nobody scanned, or a material not on the list. */}
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
          </section>

          {/* ── 3. The verdict ────────────────────────────────────────────── */}
          <section className="space-y-3">
            <div className="rounded-lg border border-border p-3">
              <p className={`text-sm font-medium tabular-nums ${comparison.overBudget ? "text-red-700 dark:text-red-400" : "text-foreground"}`}>
                {verdict}
              </p>
              <p className="text-sm text-muted-foreground tabular-nums">{marginSentence}</p>
              {comparison.revenue != null && (
                <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                  {t("app.jobCosting.verdictInvoiced", "Invoiced {amount}.", { amount: money(comparison.revenue) })}
                </p>
              )}
            </div>

            {/* The question, asked once, only when the job crossed the line
                the company set — and only OVER. See lib/costing/costRevision.js. */}
            {asking && !revealing && (
              <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-2">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  {t("app.jobCosting.revisionPrompt", "This job cost {pct}% more than you quoted. Update your costing from what it really cost?", { pct: fmtNum(pct) })}
                </p>
                <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
                  {t("app.jobCosting.revisionThresholdNote", "You asked to be prompted from {threshold}% over — change that under Settings → Material Costs.", { threshold: fmtNum(revision.thresholdPct) })}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setRevealing(true)}
                    disabled={deciding}
                    className="min-h-[44px] px-4 rounded-full bg-amber-900 text-white dark:bg-amber-200 dark:text-amber-950 text-sm font-semibold disabled:opacity-60"
                  >
                    {t("app.jobCosting.revisionUpdate", "Update")}
                  </button>
                  <button
                    type="button"
                    onClick={leaveAsIs}
                    disabled={deciding}
                    className="min-h-[44px] px-4 rounded-full border border-amber-900/40 dark:border-amber-200/40 text-sm font-medium text-amber-900 dark:text-amber-200 disabled:opacity-60"
                  >
                    {t("app.jobCosting.revisionLeave", "Leave as is")}
                  </button>
                </div>
              </div>
            )}

            {/* Update: the per-line suggestions. Rendered only here — below
                the threshold there is nothing to suggest, and the comparison
                above is the whole answer. */}
            {revealing && (
              <div className="rounded-lg border border-border p-3 space-y-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t("app.jobCosting.revisionUpdateTitle", "What this job says about your rates")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("app.jobCosting.revisionUpdateIntro", "Each line suggests the rate this one job would have needed. Apply the ones that look typical; skip the ones that don't. Nothing changes unless you press a button.")}
                  </p>
                </div>

                {calib?.failed && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {t("app.jobCosting.calibLoadFailed", "Couldn't load the materials comparison.")}
                  </p>
                )}
                {calib && !calib.failed && !anySuggestion && (
                  <p className="text-xs text-muted-foreground">
                    {t("app.jobCosting.revisionNoSuggestions", "Nothing on this job is adjustable from here yet — its lines have no saved rate behind them.")}
                  </p>
                )}

                {/* Labour, first — it is usually the bigger number. */}
                {labourLine && (
                  <div className="text-sm">
                    <p className="font-medium text-foreground">{t("app.jobCosting.labourCalibTitle", "Labour")}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {labourLine.unitsOfWork > 0
                        ? t("app.jobCosting.labourCalibLine", "Estimated {est}h, approved {actual}h, over {units} {work}.", {
                            est: fmtNum(labourLine.estimatedHours),
                            actual: fmtNum(labourLine.actualHours),
                            units: fmtNum(labourLine.unitsOfWork),
                            work: unitWord(labourLine.unitLabel),
                          })
                        : t("app.jobCosting.labourCalibLineNoWork", "Estimated {est}h, approved {actual}h.", {
                            est: fmtNum(labourLine.estimatedHours),
                            actual: fmtNum(labourLine.actualHours),
                          })}
                    </p>
                    {labourLine.currentRate?.value != null && labourLine.suggestedRate != null && (
                      <p className="text-xs text-foreground tabular-nums">
                        {t("app.jobCosting.calibRates", "Calculation now: {current} {rate} → this job: {suggested} {rate} ({delta}%).", {
                          current: fmtNum(labourLine.currentRate.value),
                          suggested: fmtNum(labourLine.suggestedRate),
                          rate: rateWord(labourLine.currentRate.label),
                          delta: `${labourLine.suggestedDeltaPct > 0 ? "+" : ""}${fmtNum(labourLine.suggestedDeltaPct)}`,
                        })}
                      </p>
                    )}
                    {appliedLabour != null ? (
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 size={12} className="inline mr-1" />
                        {t("app.jobCosting.calibApplied", "Updated to {value} {rate}. Future quotes use it from now.", {
                          value: fmtNum(appliedLabour),
                          rate: rateWord(labourLine.currentRate?.label),
                        })}{" "}
                        <Link href="/app/settings/services" className="underline">
                          {t("app.jobCosting.calibRatesLink", "Settings → Services")}
                        </Link>
                      </p>
                    ) : labourLine.canApply ? (
                      <button
                        type="button"
                        onClick={() => applyLabour(labourLine)}
                        disabled={busy || applyingId === "labour"}
                        className="mt-1 min-h-[44px] px-4 rounded-full border border-border text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                      >
                        {t("app.jobCosting.labourCalibApply", "Update the labour rate for future quotes")}
                      </button>
                    ) : (
                      labourLine.reason && (
                        <p className="text-xs text-muted-foreground">
                          {labourLine.reason === "hours_pending" ? (
                            <>
                              {t(`app.jobCosting.labourReason_${labourLine.reason}`, labourLine.reason)}{" "}
                              <Link href="/app/payroll" className="underline">{t("app.jobCosting.approveHours", "Approve hours")}</Link>
                            </>
                          ) : (
                            t(`app.jobCosting.labourReason_${labourLine.reason}`, labourLine.reason)
                          )}
                        </p>
                      )
                    )}
                  </div>
                )}

                {calibLines.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {t("app.jobCosting.calibTitle", "Materials: what you used vs what the estimate said")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("app.jobCosting.calibIntro", "Per line, the rate the calculation uses today and the rate this one job actually got. Quantities are whole units bought. Nothing changes unless you press the button.")}
                    </p>
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

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={doneUpdating}
                    disabled={deciding}
                    className="min-h-[44px] px-4 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
                  >
                    {t("app.jobCosting.revisionDone", "Done")}
                  </button>
                  {!decision && (
                    <button
                      type="button"
                      onClick={leaveAsIs}
                      disabled={deciding}
                      className="min-h-[44px] px-4 rounded-full border border-border text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
                    >
                      {t("app.jobCosting.revisionLeave", "Leave as is")}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* The answer, once given. */}
            {decision && !revealing && (
              <p className="text-xs text-muted-foreground">
                {decision === REVISION_DECISIONS.UPDATED
                  ? t("app.jobCosting.revisionUpdated", "Revised costing on {date}.", { date: fmtDay(decidedAt) })
                  : t("app.jobCosting.revisionLeft", "Kept costing as is on {date}.", { date: fmtDay(decidedAt) })}
              </p>
            )}
          </section>

          {/* ── 4. Note and sign-off ──────────────────────────────────────── */}
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
          {/* Nothing silent: if the question is still open, completing answers it. */}
          {asking && (
            <p className="text-xs text-muted-foreground text-right">
              {t("app.jobCosting.completeLeavesAsIs", "Completing now without choosing keeps your costing as it is.")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
