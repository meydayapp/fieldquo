// app/app/quotes/[id]/edit/page.js
//
// Revise an existing quote.
//
// Deliberately not a second copy of the new-quote builder. That page's job is
// configuration — picking a client, choosing service categories, running the
// costing estimate, applying tiered packages. None of that applies once the
// quote exists; by then the shape is settled and what people actually need is
// to fix a price, correct a description, drop a line, extend the expiry. So
// this is a line-item editor over the groups that are already there.
//
// Adding a whole new service category means starting from the builder, and the
// page says so rather than pretending the option is missing.
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, Plus, Loader2, AlertCircle } from "lucide-react";
import SuggestAddOns from "@/app/components/quotes/SuggestAddOns";
import { useTranslation } from "@/app/hooks/useTranslation";

const money = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0);

export default function EditQuotePage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const router = useRouter();

  const [quote, setQuote] = useState(null);
  const [groups, setGroups] = useState([]);
  const [notes, setNotes] = useState("");
  const [processNotes, setProcessNotes] = useState("");
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [validUntil, setValidUntil] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/quotes/${id}`);
        if (!res.ok) throw new Error(t("app.quoteEdit.loadError"));
        const q = await res.json();
        if (cancelled) return;

        setQuote(q);
        setGroups(
          (q.scopeGroups || []).map((g) => ({
            id: g.id,
            categoryId: g.categoryId,
            label: g.label || g.category?.label || t("app.quoteEdit.scopeFallback"),
            lineItems: Array.isArray(g.lineItems) ? g.lineItems : [],
          })),
        );
        setNotes(q.notes || "");
        setProcessNotes(q.processNotes || "");
        setDiscount(money(q.discount));
        setTaxEnabled(q.taxEnabled !== false);
        setValidUntil(
          q.validUntil ? new Date(q.validUntil).toISOString().slice(0, 10) : "",
        );

        // Recover the rate that was actually applied when the quote was
        // written rather than reading the company's current rate. If the
        // company changed its tax setting last month, re-saving an older quote
        // shouldn't silently reprice it.
        const base = money(q.subtotal) - money(q.discount);
        setTaxRate(base > 0 ? +((money(q.tax) / base) * 100).toFixed(4) : 0);
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

  const totals = useMemo(() => {
    const groupSubtotals = groups.map((g) =>
      g.lineItems.reduce((sum, li) => sum + money(li.amount), 0),
    );
    const subtotal = groupSubtotals.reduce((a, b) => a + b, 0);
    const base = Math.max(0, subtotal - money(discount));
    const tax = taxEnabled ? base * (money(taxRate) / 100) : 0;
    return { groupSubtotals, subtotal, tax, total: base + tax };
  }, [groups, discount, taxRate, taxEnabled]);

  function updateItem(gi, li, field, value) {
    setGroups((prev) =>
      prev.map((g, i) =>
        i !== gi
          ? g
          : {
              ...g,
              lineItems: g.lineItems.map((item, j) =>
                j !== li ? item : { ...item, [field]: value },
              ),
            },
      ),
    );
  }

  function addItem(gi) {
    setGroups((prev) =>
      prev.map((g, i) =>
        i !== gi
          ? g
          : {
              ...g,
              lineItems: [
                ...g.lineItems,
                { description: "", quantity: 1, amount: 0 },
              ],
            },
      ),
    );
  }

  function removeItem(gi, li) {
    setGroups((prev) =>
      prev.map((g, i) =>
        i !== gi
          ? g
          : { ...g, lineItems: g.lineItems.filter((_, j) => j !== li) },
      ),
    );
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes,
          processNotes,
          discount: money(discount),
          subtotal: totals.subtotal,
          tax: totals.tax,
          total: totals.total,
          // Sent, not just used locally. Without this the checkbox above is a
          // control that appears to work: the amount saves as 0 but the FLAG
          // reverts, so reopening re-ticks it and the next save re-adds tax.
          taxEnabled,
          validUntil: validUntil || null,
          // The API replaces scope groups wholesale (deleteMany + create), so
          // this has to be the complete set, not a delta.
          scopeGroups: groups.map((g) => ({
            categoryId: g.categoryId,
            label: g.label,
            lineItems: g.lineItems.map((li) => ({
              ...li,
              quantity: money(li.quantity) || 1,
              amount: money(li.amount),
            })),
            subtotal: g.lineItems.reduce((s, li) => s + money(li.amount), 0),
          })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || t("app.quoteEdit.saveError"));
      router.push(`/app/quotes/${id}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (loading)
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto animate-pulse h-96 bg-accent rounded-xl" />
    );

  if (!quote)
    return (
      <div className="p-4 sm:p-6 max-w-lg mx-auto">
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-5 text-sm text-red-700 dark:text-red-300">
          {error || t("app.quoteEdit.notFound")}
        </div>
      </div>
    );

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 pb-24">
      <Link
        href={`/app/quotes/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} /> {t("app.quoteEdit.backTo")} {quote.quoteNumber}
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t("app.action.edit")} {quote.quoteNumber}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{quote.client?.name}</p>
      </div>

      {quote.status === "accepted" && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          {t("app.quoteEdit.acceptedWarning")}
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
          {t("app.quoteEdit.noScopeGroups")}
        </div>
      ) : (
        groups.map((g, gi) => (
          <div
            key={g.id || gi}
            className="bg-card border border-border rounded-xl p-5"
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <input
                value={g.label}
                onChange={(e) =>
                  setGroups((prev) =>
                    prev.map((x, i) =>
                      i === gi ? { ...x, label: e.target.value } : x,
                    ),
                  )
                }
                className="font-semibold text-foreground border-b border-transparent hover:border-border focus:border-border focus:outline-none py-0.5 min-w-0 flex-1"
              />
              <span className="text-sm font-semibold text-muted-foreground shrink-0">
                ${totals.groupSubtotals[gi].toFixed(2)}
              </span>
            </div>

            <div className="space-y-2">
              {g.lineItems.map((item, li) => (
                <div key={li} className="flex gap-2 items-start">
                  <input
                    value={item.description || ""}
                    onChange={(e) =>
                      updateItem(gi, li, "description", e.target.value)
                    }
                    placeholder={t("app.quoteEdit.description")}
                    className="flex-1 min-w-0 border border-border rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={item.quantity ?? 1}
                    onChange={(e) =>
                      updateItem(gi, li, "quantity", e.target.value)
                    }
                    className="w-20 border border-border rounded-lg px-3 py-2 text-sm"
                  />
                  <div className="relative w-32 shrink-0">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      $
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.amount ?? 0}
                      onChange={(e) =>
                        updateItem(gi, li, "amount", e.target.value)
                      }
                      className="w-full border border-border rounded-lg pl-7 pr-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    onClick={() => removeItem(gi, li)}
                    aria-label={t("app.quoteEdit.removeLine")}
                    className="text-muted-foreground hover:text-red-600 dark:text-red-400 p-2 shrink-0"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => addItem(gi)}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <Plus size={14} /> {t("app.quoteEdit.addLine")}
            </button>
          </div>
        ))
      )}

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {t("app.field.notes")}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t("app.quoteEdit.discount")}
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
              {t("app.quoteEdit.taxRate")}
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
              {t("app.quoteEdit.chargeTax")}
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t("app.quoteEdit.validUntil")}
            </label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-border space-y-1 text-sm">
          <Row label={t("app.quoteEdit.subtotal")} value={totals.subtotal} />
          {money(discount) > 0 && (
            <Row label={t("app.quoteEdit.discount")} value={-money(discount)} />
          )}
          <Row label={t("app.quoteEdit.tax")} value={totals.tax} />
          <div className="flex justify-between font-semibold text-foreground text-base pt-1">
            <span>{t("app.quoteEdit.total")}</span>
            <span>${totals.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Sits below the totals because that's where it sits on the client's
          copy too — the extras are the last thing they read before deciding. */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          {t("app.quoteEdit.whatHappensNext")}
        </label>
        <p className="text-xs text-muted-foreground mb-2">
          {t("app.quoteEdit.whatHappensNextHint")}
        </p>
        <textarea
          value={processNotes}
          onChange={(e) => setProcessNotes(e.target.value)}
          rows={5}
          placeholder={t("app.quoteEdit.processNotesPlaceholder")}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card"
        />
      </div>

      <SuggestAddOns
        quoteId={id}
        readOnly={["accepted", "declined"].includes(quote.status)}
        onProcessNotes={setProcessNotes}
      />

      <div className="flex gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {t("app.quoteEdit.saveChanges")}
        </button>
        <Link
          href={`/app/quotes/${id}`}
          className="border border-border text-foreground px-5 py-2.5 rounded-full text-sm font-semibold"
        >
          {t("app.action.cancel")}
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
