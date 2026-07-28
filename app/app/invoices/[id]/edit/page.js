// app/app/invoices/[id]/edit/page.js
//
// Edit an invoice.
//
// The API behaves in two quite different ways depending on status, and the
// page has to make that visible rather than hide it:
//
//   draft  → edited in place. Nothing has been sent, nothing to preserve.
//   sent+  → a NEW version row is created, the old one is kept, and a change
//            reason is recorded. The user ends up on a different invoice id.
//
// Someone amending a paid invoice needs to know they're creating a revision,
// not correcting a typo in place — otherwise the version history fills up with
// unexplained rows and the audit trail is worthless.
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, Plus, Loader2, AlertCircle, History } from "lucide-react";

const money = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0);
const blankItem = () => ({
  description: "",
  quantity: 1,
  unit: "flat",
  rate: 0,
  amount: 0,
});

export default function EditInvoicePage() {
  const { id } = useParams();
  const router = useRouter();

  const [invoice, setInvoice] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [dueDate, setDueDate] = useState("");
  const [changeReason, setChangeReason] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/invoices/${id}`);
        if (!res.ok) throw new Error("Couldn't load this invoice.");
        const inv = await res.json();
        if (cancelled) return;

        setInvoice(inv);
        setLineItems(
          Array.isArray(inv.lineItems) && inv.lineItems.length
            ? inv.lineItems
            : [blankItem()],
        );
        setNotes(inv.notes || "");
        setDiscount(money(inv.discount));
        setDueDate(
          inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : "",
        );

        // Back out the rate this invoice was written with rather than reading
        // the company's current one — an old invoice shouldn't reprice itself
        // because the company's tax setting changed since.
        const base = money(inv.subtotal) - money(inv.discount);
        setTaxEnabled(money(inv.tax) > 0);
        setTaxRate(base > 0 ? +((money(inv.tax) / base) * 100).toFixed(4) : 0);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const isDraft = invoice?.status === "draft";

  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((s, li) => s + money(li.amount), 0);
    const base = Math.max(0, subtotal - money(discount));
    const tax = taxEnabled ? base * (money(taxRate) / 100) : 0;
    return { subtotal, tax, total: base + tax };
  }, [lineItems, discount, taxRate, taxEnabled]);

  function updateItem(i, field, value) {
    setLineItems((prev) =>
      prev.map((item, j) => {
        if (j !== i) return item;
        const next = { ...item, [field]: value };
        // Amount is derived, never typed. Keeping it in the row (rather than
        // computing at render) is what the create page does and what the PDF
        // renderer reads, so the stored shape has to stay consistent.
        if (field === "quantity" || field === "rate") {
          next.amount = money(next.quantity) * money(next.rate);
        }
        return next;
      }),
    );
  }

  async function save() {
    if (!isDraft && !changeReason.trim()) {
      setError("Give a reason for the change — it goes in the version history.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineItems: lineItems
            .filter((li) => String(li.description || "").trim())
            .map((li) => ({
              ...li,
              quantity: money(li.quantity) || 1,
              rate: money(li.rate),
              amount: money(li.amount),
            })),
          subtotal: totals.subtotal,
          discount: money(discount),
          tax: totals.tax,
          total: totals.total,
          dueDate: dueDate || undefined,
          notes,
          ...(isDraft ? {} : { changeReason: changeReason.trim() }),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Couldn't save changes.");
      // On a non-draft edit the API returns a NEW invoice row, so follow the
      // id it hands back rather than returning to the one we came from.
      router.push(`/app/invoices/${data?.id || id}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (loading)
    return (
      <div className="p-6 max-w-4xl mx-auto animate-pulse h-96 bg-accent rounded-xl" />
    );

  if (!invoice)
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-5 text-sm text-red-700 dark:text-red-300">
          {error || "Invoice not found."}
        </div>
      </div>
    );

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 pb-24">
      <Link
        href={`/app/invoices/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} /> Back to {invoice.invoiceNumber}
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Edit {invoice.invoiceNumber}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {invoice.client?.name}
          {invoice.version > 1 && ` · version ${invoice.version}`}
        </p>
      </div>

      {!isDraft && (
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl px-4 py-3 text-sm text-blue-900 dark:text-blue-200 flex items-start gap-2">
          <History size={16} className="shrink-0 mt-0.5" />
          <div>
            This invoice has already been sent, so saving creates{" "}
            <strong>version {(invoice.version || 1) + 1}</strong> rather than
            overwriting it. The current version stays on file.
          </div>
        </div>
      )}

      {money(invoice.amountPaid) > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          ${money(invoice.amountPaid).toFixed(2)} has already been paid against
          this invoice. Lowering the total below that leaves a credit you&apos;ll
          need to settle with the client.
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-4">Line items</h2>

        <div className="hidden sm:flex gap-2 px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span className="flex-1">Description</span>
          <span className="w-20">Qty</span>
          <span className="w-28">Rate</span>
          <span className="w-28 text-right">Amount</span>
          <span className="w-9" />
        </div>

        <div className="space-y-2">
          {lineItems.map((item, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={item.description || ""}
                onChange={(e) => updateItem(i, "description", e.target.value)}
                placeholder="Description"
                className="flex-1 min-w-0 border border-border rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.quantity ?? 1}
                onChange={(e) => updateItem(i, "quantity", e.target.value)}
                className="w-20 border border-border rounded-lg px-3 py-2 text-sm"
              />
              <div className="relative w-28 shrink-0">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.rate ?? 0}
                  onChange={(e) => updateItem(i, "rate", e.target.value)}
                  className="w-full border border-border rounded-lg pl-7 pr-2 py-2 text-sm"
                />
              </div>
              <span className="w-28 text-right text-sm font-medium text-foreground shrink-0">
                ${money(item.amount).toFixed(2)}
              </span>
              <button
                onClick={() =>
                  setLineItems((prev) => prev.filter((_, j) => j !== i))
                }
                aria-label="Remove line"
                className="text-muted-foreground hover:text-red-600 dark:text-red-400 p-2 shrink-0"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => setLineItems((prev) => [...prev, blankItem()])}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <Plus size={14} /> Add line
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Discount
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Tax rate (%)
            </label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={taxRate}
              disabled={!taxEnabled}
              onChange={(e) => setTaxRate(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm disabled:bg-muted disabled:text-muted-foreground"
            />
            <label className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={taxEnabled}
                onChange={(e) => setTaxEnabled(e.target.checked)}
              />
              Apply tax
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Due date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {!isDraft && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Reason for this change <span className="text-red-600 dark:text-red-400">*</span>
            </label>
            <input
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              placeholder="Client added a second bathroom"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Stored with the version so anyone reading the history later knows
              what happened.
            </p>
          </div>
        )}

        <div className="pt-4 border-t border-border space-y-1 text-sm">
          <Row label="Subtotal" value={totals.subtotal} />
          {money(discount) > 0 && (
            <Row label="Discount" value={-money(discount)} />
          )}
          <Row label="Tax" value={totals.tax} />
          <div className="flex justify-between font-semibold text-foreground text-base pt-1">
            <span>Total</span>
            <span>${totals.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {isDraft ? "Save changes" : "Save as new version"}
        </button>
        <Link
          href={`/app/invoices/${id}`}
          className="border border-border text-foreground px-5 py-2.5 rounded-full text-sm font-semibold"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span>${value.toFixed(2)}</span>
    </div>
  );
}
