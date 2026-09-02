"use client";

// app/components/jobs/ChangeOrders.js
//
// Scope changes agreed after the client accepted the quote — "add this while
// you're here," a fixture swap, something discovered mid-job that changes the
// price. See prisma/schema.prisma's ChangeOrder model and
// docs/CALLBACKS-AND-CHANGE-ORDERS.md for why this is a deliberate log a
// person writes, never inferred from a quote or invoice edit: a quote is
// edited in place with no history, and an invoice version is created by ANY
// edit to a sent invoice, not just a scope change.
//
// Still no edit or delete. A change order is a record of something agreed with
// the client — correcting a mistake gets a new entry that says so, not a
// rewritten history, the same reasoning Quote.declineReason and every other
// append-only log in this codebase share. What CAN change is its status, and
// only until it has been billed; see the PATCH route's own header.
//
// ── What this panel had to start doing ─────────────────────────────────────
//
// It used to render a description and a number, and the number went nowhere:
// job costing ignored it, no invoice ever mentioned it, and the summed figure
// was read by one test script. So a contractor could log $3,000 of agreed
// extra work, see it on screen, and never bill it. This panel is now where
// that money is visible and where it is put on the invoice — deliberately, by
// hand, with the amount stated before anything moves.

import { useCallback, useEffect, useState } from "react";
import { Plus, FileEdit, Check, X, Undo2, FileText, AlertTriangle } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useHasLevel, useHasToggle } from "@/app/providers/PermissionProvider";
import { reportResponseError } from "@/lib/clientErrors";
import { changeOrderStatus, changeOrderSummary } from "@/lib/jobs/changeOrderValue";

// Matches JobMaterials.js's own choice for a job-internal figure — this panel
// never leaves /app, so a locale-aware currency lookup (which would mean a
// second fetch just for a symbol) isn't worth it here either.
const money = (v) => {
  const n = Number(v) || 0;
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;
};

const signed = (v) => `${Number(v) > 0 ? "+" : ""}${money(v)}`;

export default function ChangeOrders({ jobId, changeOrders, onChanged }) {
  const { t } = useTranslation();
  // Two separate hook calls, combined afterward — `&&` between the calls
  // themselves would make the second one conditional, which breaks the rules
  // of hooks the moment the first is false.
  const hasJobsEdit = useHasLevel("jobs", "view_create_edit");
  const hasShowPricing = useHasToggle("showPricing");
  const canLog = hasJobsEdit && hasShowPricing;

  const [adding, setAdding] = useState(false);
  const [description, setDescription] = useState("");
  const [priceDelta, setPriceDelta] = useState("");
  const [agreed, setAgreed] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [billing, setBilling] = useState(null);
  const [confirmBill, setConfirmBill] = useState(false);

  const orders = Array.isArray(changeOrders) ? changeOrders : [];
  const summary = changeOrderSummary(orders);

  // What would happen if the bill button were pressed, answered by the server
  // rather than guessed here — the screen must not offer an action the route
  // will refuse. 403 is the ordinary answer for someone without showPricing.
  const loadBilling = useCallback(async () => {
    if (!jobId) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}/change-orders/bill`);
      setBilling(res.ok ? await res.json() : null);
    } catch {
      setBilling(null);
    }
  }, [jobId]);

  useEffect(() => {
    loadBilling();
  }, [loadBilling, orders.length, summary.unbilledTotal]);

  async function refresh() {
    await onChanged?.();
    await loadBilling();
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!description.trim()) {
      setError(t("app.changeOrder.descriptionRequired", "Describe what changed."));
      return;
    }
    const delta = Number(priceDelta);
    if (!Number.isFinite(delta)) {
      setError(t("app.changeOrder.priceRequired", "Enter the effect on price — 0 if none."));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/change-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          priceDelta: delta,
          status: agreed ? "approved" : "pending",
        }),
      });
      if (!res.ok) {
        const message = await reportResponseError(res, t("app.changeOrder.saveFailed", "Couldn't log that."));
        setError(message || t("app.changeOrder.saveFailed", "Couldn't log that."));
        return;
      }
      setDescription("");
      setPriceDelta("");
      setAgreed(true);
      setAdding(false);
      await refresh();
    } catch {
      setError(t("app.changeOrder.saveFailed", "Couldn't log that."));
    } finally {
      setSaving(false);
    }
  }

  async function decide(co, status) {
    setError("");
    setBusyId(co.id);
    try {
      const res = await fetch(`/api/jobs/${jobId}/change-orders/${co.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const message = await reportResponseError(res, t("app.changeOrder.decideFailed", "Couldn't change that."));
        setError(message || t("app.changeOrder.decideFailed", "Couldn't change that."));
        return;
      }
      await refresh();
    } catch {
      setError(t("app.changeOrder.decideFailed", "Couldn't change that."));
    } finally {
      setBusyId(null);
    }
  }

  async function bill() {
    setError("");
    setBusyId("bill");
    try {
      const res = await fetch(`/api/jobs/${jobId}/change-orders/bill`, { method: "POST" });
      if (!res.ok) {
        const message = await reportResponseError(res, t("app.changeOrder.billFailed", "Couldn't add those to the invoice."));
        setError(message || t("app.changeOrder.billFailed", "Couldn't add those to the invoice."));
        return;
      }
      setConfirmBill(false);
      await refresh();
    } catch {
      setError(t("app.changeOrder.billFailed", "Couldn't add those to the invoice."));
    } finally {
      setBusyId(null);
    }
  }

  // Nothing recorded and nobody here can add one — an empty card with no
  // action on it is noise, the same rule JobCosting.js follows for a job with
  // no costs and no quote.
  if (orders.length === 0 && !canLog) return null;

  const invoiceLabel = billing?.invoice?.invoiceNumber || "";

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <FileEdit size={15} className="text-muted-foreground" />
          {t("app.changeOrder.title", "Change orders")}
        </h2>
        {canLog && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 border border-border text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-muted"
          >
            <Plus size={13} />
            {t("app.changeOrder.log", "Log a change order")}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Agreed and not-yet-agreed money, kept apart. A blended total would
          state that a change nobody has said yes to is part of the job. */}
      {orders.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span className="text-muted-foreground">
            {t("app.changeOrder.approvedTotal", "Agreed changes")}:{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {signed(summary.approvedTotal)}
            </span>
          </span>
          {summary.counts.pending > 0 && (
            <span className="text-muted-foreground">
              {t("app.changeOrder.pendingTotal", "Awaiting agreement")}:{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {signed(summary.pendingTotal)}
              </span>
            </span>
          )}
        </div>
      )}

      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t(
            "app.changeOrder.none",
            "None logged. Use this once the client has agreed to a change in scope — never for an ordinary edit to the quote or invoice.",
          )}
        </p>
      ) : (
        <div className="divide-y divide-border">
          {orders.map((co) => {
            const status = changeOrderStatus(co);
            return (
              <div key={co.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{co.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {co.createdBy?.name || t("app.changeOrder.unknownAuthor", "Someone")} ·{" "}
                      {new Date(co.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={`tabular-nums text-sm font-semibold ${
                        status !== "approved"
                          ? "text-muted-foreground line-through"
                          : Number(co.priceDelta) < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-foreground"
                      }`}
                    >
                      {signed(co.priceDelta)}
                    </span>
                    <div className="text-xs mt-0.5">
                      {status === "approved" && co.invoiceId && (
                        <span className="text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                          <FileText size={11} />
                          {t("app.changeOrder.billedOn", "Billed on {invoice}", {
                            invoice: co.invoice?.invoiceNumber || "—",
                          })}
                        </span>
                      )}
                      {status === "approved" && !co.invoiceId && (
                        <span className="text-amber-700 dark:text-amber-400">
                          {t("app.changeOrder.unbilled", "Not yet invoiced")}
                        </span>
                      )}
                      {status === "pending" && (
                        <span className="text-muted-foreground">
                          {t("app.changeOrder.statusPending", "Not yet agreed — affects nothing")}
                        </span>
                      )}
                      {status === "rejected" && (
                        <span className="text-muted-foreground">
                          {t("app.changeOrder.statusRejected", "Rejected — affects nothing")}
                        </span>
                      )}
                      {status === "unrecognised" && (
                        <span className="text-muted-foreground">
                          {t("app.changeOrder.statusUnknown", "Unknown status — affects nothing")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* A billed change order has no controls: its money is on a
                    document, and un-approving it would leave the invoice
                    charging for something we'd be saying was never agreed. */}
                {canLog && !co.invoiceId && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {status !== "approved" && (
                      <button
                        type="button"
                        disabled={busyId === co.id}
                        onClick={() => decide(co, "approved")}
                        className="inline-flex items-center gap-1 border border-border text-xs font-semibold px-2.5 py-1 rounded-md hover:bg-muted disabled:opacity-60"
                      >
                        <Check size={12} />
                        {t("app.changeOrder.approve", "Mark agreed")}
                      </button>
                    )}
                    {status !== "rejected" && (
                      <button
                        type="button"
                        disabled={busyId === co.id}
                        onClick={() => decide(co, "rejected")}
                        className="inline-flex items-center gap-1 border border-border text-xs font-semibold px-2.5 py-1 rounded-md hover:bg-muted disabled:opacity-60"
                      >
                        <X size={12} />
                        {t("app.changeOrder.reject", "Reject")}
                      </button>
                    )}
                    {status !== "pending" && (
                      <button
                        type="button"
                        disabled={busyId === co.id}
                        onClick={() => decide(co, "pending")}
                        className="inline-flex items-center gap-1 border border-border text-xs font-semibold px-2.5 py-1 rounded-md hover:bg-muted disabled:opacity-60"
                      >
                        <Undo2 size={12} />
                        {t("app.changeOrder.reopen", "Back to pending")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Agreed work that nobody has billed ─────────────────────────────
          The whole reason this feature was worth finishing. Loud on purpose:
          "explicit" billing is only safer than automatic billing if the
          contractor is actually told there is something to bill. */}
      {billing && billing.unbilled?.count > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {t(
                  "app.changeOrder.billTitle",
                  "{amount} of agreed changes isn't on an invoice yet",
                  { amount: signed(billing.unbilled.total) },
                )}
              </p>

              {billing.canBill && canLog && !confirmBill && (
                <button
                  type="button"
                  onClick={() => setConfirmBill(true)}
                  className="mt-2 inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground text-sm font-semibold px-3 py-1.5 rounded-lg"
                >
                  <FileText size={13} />
                  {t("app.changeOrder.bill", "Add to {invoice}", { invoice: invoiceLabel })}
                </button>
              )}

              {/* The numbers, before the money moves. A one-click "add to
                  invoice" would change what a homeowner owes without ever
                  showing the figure it changed it to. */}
              {billing.canBill && canLog && confirmBill && (
                <div className="mt-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <p className="text-sm text-foreground">
                    {t(
                      "app.changeOrder.billConfirm",
                      "Add {amount} to {invoice}? Its total becomes {total}.",
                      {
                        amount: signed(billing.preview?.added),
                        invoice: invoiceLabel,
                        total: money(billing.preview?.newTotal),
                      },
                    )}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === "bill"}
                      onClick={bill}
                      className="bg-inverted text-inverted-foreground text-sm font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60"
                    >
                      {busyId === "bill"
                        ? t("app.changeOrder.billing", "Adding…")
                        : t("app.action.confirm", "Confirm")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmBill(false)}
                      className="border border-border text-foreground text-sm font-semibold px-3 py-1.5 rounded-lg"
                    >
                      {t("app.action.cancel")}
                    </button>
                  </div>
                </div>
              )}

              {/* Not a button that finds out on click: the route already said
                  it would refuse, so the reason is printed instead. */}
              {!billing.canBill && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {billing.reason === "no_invoice" &&
                    t(
                      "app.changeOrder.reasonNoInvoice",
                      "There's no invoice on this job yet. These become billable once one is raised.",
                    )}
                  {billing.reason === "invoice_sent" &&
                    t(
                      "app.changeOrder.reasonInvoiceSent",
                      "{invoice} has already been sent, so FieldQuo won't change it on its own. Amend it from the invoice page to bill these.",
                      { invoice: invoiceLabel },
                    )}
                  {billing.reason === "tax_rate_underivable" &&
                    t(
                      "app.changeOrder.reasonTaxRate",
                      "{invoice} charges tax but has nothing to work the rate out from, so these can't be added automatically. Add them on the invoice itself.",
                      { invoice: invoiceLabel },
                    )}
                  {billing.reason === "already_on_invoice" &&
                    t("app.changeOrder.reasonAlreadyOn", "These are already on {invoice}.", {
                      invoice: invoiceLabel,
                    })}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {adding && (
        <form onSubmit={submit} className="mt-4 pt-4 border-t border-border space-y-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t("app.changeOrder.whatChanged", "What changed")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder={t("app.changeOrder.whatChangedPlaceholder", "Client asked to add a subpanel while the wall was open")}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t("app.changeOrder.priceEffect", "Effect on price")}
            </label>
            <input
              type="number"
              step="0.01"
              value={priceDelta}
              onChange={(e) => setPriceDelta(e.target.value)}
              placeholder="0.00"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t("app.changeOrder.priceEffectHint", "Positive adds to what the client owes; negative credits them.")}
            </p>
          </div>
          {/* Asked, not assumed. This model's original meaning was "logged
              means already agreed", which was harmless while the number went
              nowhere; now it decides whether money reaches the contract and
              the invoice, so the person typing it says which one it is. */}
          <fieldset>
            <legend className="block text-sm font-medium text-foreground mb-1">
              {t("app.changeOrder.agreedLabel", "Has the client agreed to this?")}
            </legend>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="radio"
                name="co-agreed"
                checked={agreed}
                onChange={() => setAgreed(true)}
              />
              {t("app.changeOrder.agreedYes", "Yes — count it toward this job's contract value")}
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground mt-1">
              <input
                type="radio"
                name="co-agreed"
                checked={!agreed}
                onChange={() => setAgreed(false)}
              />
              {t("app.changeOrder.agreedNo", "Not yet — record it, and change nothing until it is")}
            </label>
          </fieldset>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
            >
              {saving ? t("app.changeOrder.saving", "Saving…") : t("app.changeOrder.save", "Save")}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setError("");
              }}
              className="border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-lg"
            >
              {t("app.action.cancel")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
