// app/app/invoices/new/page.js
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, X, Trash2, Search } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import MediaUploader from "@/app/components/MediaUploader";
import InvoiceCostSection from "@/app/components/invoices/InvoiceCostSection";
import { formatAppMoney } from "@/lib/format/money";
import { explainTaxSource } from "@/lib/tax/resolveTaxRate";
import { resolveDocumentTax } from "@/lib/tax/documentTax";

export default function NewInvoicePage() {
  // The company's billing currency, read off whatever this page already
  // loaded. Null falls back to the schema default inside the formatter — the
  // point is that it is no longer a hardcoded "$" with no grouping.
  const [currency, setCurrency] = useState(null);

  const { t, language } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams.get("clientId");

  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);

  const [lineItems, setLineItems] = useState([
    { description: "", quantity: 1, unit: "flat", rate: 0, amount: 0 },
  ]);
  const [notes, setNotes] = useState("");
  const [clientPhotos, setClientPhotos] = useState([]);
  const [dueDate, setDueDate] = useState("");
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxRate, setTaxRate] = useState(0);
  // Set the moment a human edits the box. The resolver seeds the rate and then
  // stops writing to it — without this, picking a client after typing a rate
  // threw the typed rate away, and the US branch of lib/tax/jurisdictions.js
  // ("county and city taxes are not included, enter the rate for this address")
  // had no field to be acted on.
  const [taxRateTouched, setTaxRateTouched] = useState(false);
  const [taxConfig, setTaxConfig] = useState(null);
  // Set when the rate came from the company's own province rather than this
  // client's. A guess with a price attached — see QuoteTotalsBar.
  const [taxAssumed, setTaxAssumed] = useState("");
  const [taxNote, setTaxNote] = useState("");
  const [taxCaution, setTaxCaution] = useState("");
  // Internal crew / hours / materials, never part of the document. Null until
  // InvoiceCostSection has loaded — and null again if it can't be shown, so a
  // save from a user without the jobCosting toggle posts no `costing` key at
  // all rather than an empty one.
  const [costing, setCosting] = useState(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [clientsData, businessInfo] = await Promise.all([
          fetchJson("/api/clients"),
          fetchJson("/api/settings/business-info"),
        ]);
        const list = Array.isArray(clientsData) ? clientsData : [];
        setClients(list);
        if (preselectedClientId) {
          const match = list.find((c) => c.id === preselectedClientId);
          if (match) setSelectedClient(match);
        }
        setCurrency(businessInfo?.currency || null);
        // The same shape the quote builder hands the resolver, so an invoice
        // and the quote it bills cannot disagree about the rate. This page used
        // to read businessInfo.taxRate flat and bypass the resolver entirely,
        // which is how an Ontario client got 13% on the quote and the company
        // default on the invoice.
        setTaxConfig({
          taxRate: Number(businessInfo?.taxRate || 0),
          autoApplyLocalTax: Boolean(businessInfo?.autoApplyLocalTax),
          taxRates: Array.isArray(businessInfo?.taxRates)
            ? businessInfo.taxRates
            : [],
          // The company's OWN country. For B2C services VAT is charged where
          // the supplier is — see lib/tax/jurisdictions.js.
          country: businessInfo?.country || null,
          // And the province, which is what a rate is ASSUMED from when the
          // client's record can't identify one.
          province: businessInfo?.province || null,
          // Three-state, and `?? null` rather than `|| false`: an unanswered
          // VAT question must not arrive here as "not registered".
          vatRegistered: businessInfo?.vatRegistered ?? null,
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [preselectedClientId]);

  useEffect(() => {
    if (!taxConfig) return;
    // The layered resolver: same rates, plus a fall back to the COMPANY's own
    // province when the client's record cannot answer — labelled, never
    // silent. See lib/tax/documentTax.js.
    const result = resolveDocumentTax({
      company: taxConfig,
      taxRates: taxConfig.taxRates,
      client: selectedClient,
      // This page has no scope, so there is nothing to say whether the work is
      // the kind an EU reduced construction rate applies to. Left unanswered
      // rather than assumed — the resolver returns unknown and the company's
      // own default stands, which is the safe direction to be wrong in.
      lang: language,
    });
    if (!taxRateTouched) setTaxRate(result.rate);
    setTaxAssumed(
      result.assumed
        ? t(
            selectedClient ? "app.tax.assumed.note" : "app.tax.assumed.noClient",
            {
              region: result.assumedRegion || "",
              client: selectedClient?.name || "",
            },
          )
        : "",
    );
    const note =
      taxConfig.autoApplyLocalTax && selectedClient && !result.assumed
        ? explainTaxSource(result, selectedClient, language)
        : null;
    setTaxNote(note ? t(note.key, note.params) : "");
    setTaxCaution(result.cautionKey ? t(result.cautionKey) : "");
  }, [taxConfig, selectedClient, taxRateTouched, language, t]);

  const filteredClients = clients.filter((c) =>
    c.name?.toLowerCase().includes(clientSearch.toLowerCase()),
  );

  function updateLineItem(index, field, value) {
    setLineItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        if (field === "quantity" || field === "rate") {
          updated.amount =
            Number(field === "quantity" ? value : item.quantity) *
            Number(field === "rate" ? value : item.rate);
        }
        return updated;
      }),
    );
  }

  function addLineItem() {
    setLineItems((prev) => [
      ...prev,
      { description: "", quantity: 1, unit: "flat", rate: 0, amount: 0 },
    ]);
  }

  function removeLineItem(index) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  const subtotal = lineItems.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );
  const tax = taxEnabled ? subtotal * (taxRate / 100) : 0;
  const total = subtotal + tax;

  async function handleSave(status) {
    setError("");
    if (!selectedClient) {
      setError(t("app.invoiceNew.selectClientFirst"));
      return;
    }
    if (lineItems.every((item) => !item.description.trim())) {
      setError(t("app.invoiceNew.addLineItem"));
      return;
    }

    setSaving(true);
    // try/finally so a rejected fetch (network drop) can't leave setSaving(true)
    // and both save buttons stuck disabled with no error shown.
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClient.id,
          lineItems,
          subtotal,
          tax,
          // The switch on this page finally records a decision. Without it a
          // brand-new invoice raised with tax deliberately off was stored
          // identically to one nobody could work out a rate for.
          taxEnabled,
          total,
          notes,
          clientPhotos,
          dueDate: dueDate || null,
          status,
          // Saved in the same request that creates the invoice. A second call
          // afterwards could fail on its own and leave an invoice whose cost
          // panel silently didn't stick.
          ...(costing ? { costing } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || t("app.invoiceNew.createError"));
        return;
      }

      const invoice = await res.json();

      // Actually send it. The POST above only creates the invoice (as a draft —
      // the route doesn't read `status`); the "Save & Send" button promised an
      // email, so it has to call the real send route, exactly like the quote
      // new page does. Without this the button flipped a word and emailed nobody.
      if (status === "sent") {
        const sendRes = await fetch(`/api/invoices/${invoice.id}/send`, {
          method: "POST",
        });
        if (!sendRes.ok) {
          const data = await sendRes.json().catch(() => null);
          // The invoice exists and their work is saved as a draft — land them on
          // it with the reason, rather than an invoice marked sent that never left.
          router.push(
            `/app/invoices/${invoice.id}?sendError=${encodeURIComponent(
              data?.error ||
                t(
                  "app.invoiceNew.sendFailedSaved",
                  "Saved as a draft, but the email couldn't be sent. Open it and try Send again.",
                ),
            )}`,
          );
          return;
        }
      }

      router.push(`/app/invoices/${invoice.id}`);
    } catch {
      setError(t("app.invoiceNew.createError"));
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto animate-pulse h-96 bg-accent rounded-xl" />
    );

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("app.invoices.new")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.invoiceNew.subtitle")}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div data-tour="invoice-client" className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-3">{t("app.invoiceNew.clientHeading")}</h2>
        {selectedClient ? (
          <div className="flex items-center justify-between bg-muted rounded-lg px-4 py-3">
            <div>
              <div className="font-medium text-foreground">
                {selectedClient.name}
              </div>
              <div className="text-sm text-muted-foreground">
                {selectedClient.email || selectedClient.phone}
              </div>
            </div>
            <button
              onClick={() => setSelectedClient(null)}
              className="text-sm text-muted-foreground underline"
            >
              {t("app.invoiceNew.change")}
            </button>
          </div>
        ) : (
          <div>
            <div className="relative mb-2">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder={t("app.clients.search")}
                className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            {clientSearch && (
              <div className="border border-border rounded-lg divide-y divide-border max-h-48 overflow-y-auto">
                {filteredClients.length === 0 && (
                  <p className="px-3 py-3 text-sm text-muted-foreground">{t("app.invoiceNew.noMatches")}</p>
                )}
                {filteredClients.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedClient(c);
                      setClientSearch("");
                    }}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted"
                  >
                    <div className="font-medium text-foreground">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.email || c.phone}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div data-tour="invoice-items" className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-foreground">{t("app.invoiceNew.lineItems")}</h2>
        </div>
        <div className="space-y-2">
          {/* Desktop-only header row; mobile keeps the per-input inline labels below. */}
          <div className="hidden sm:grid sm:grid-cols-12 sm:gap-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <span className="sm:col-span-5">{t("app.invoiceNew.description")}</span>
            <span className="sm:col-span-2">{t("app.invoiceNew.qty")}</span>
            <span className="sm:col-span-2">{t("app.invoiceNew.rate")}</span>
            <span className="sm:col-span-2 text-right">{t("app.invoiceNew.amount", "Amount")}</span>
            <span className="sm:col-span-1" />
          </div>
          {lineItems.map((item, i) => (
            // Mobile stacks; desktop keeps the twelve-column row. Same shape as
            // the quote builder's LineItemsTable — an invoice mirrors a quote,
            // and that has to hold on a phone too.
            <div
              key={i}
              className="rounded-lg border border-border p-2 space-y-2 sm:space-y-0 sm:p-0 sm:border-0 sm:rounded-none sm:grid sm:grid-cols-12 sm:gap-2 sm:items-center"
            >
              <input
                value={item.description}
                onChange={(e) =>
                  updateLineItem(i, "description", e.target.value)
                }
                placeholder={t("app.invoiceNew.description")}
                className="w-full sm:col-span-5 border border-border rounded px-2 py-2 sm:py-1.5 text-sm"
              />
              <div className="flex items-end gap-2 sm:contents">
              <label className="flex-1 sm:contents">
                <span className="sm:hidden block text-[10px] font-medium text-muted-foreground mb-0.5">
                  {t("app.invoiceNew.qty")}
                </span>
              <input
                type="number"
                value={item.quantity}
                onChange={(e) =>
                  updateLineItem(i, "quantity", Number(e.target.value))
                }
                className="w-full sm:col-span-2 border border-border rounded px-2 py-2 sm:py-1.5 text-sm"
              />
              </label>
              <label className="flex-1 sm:contents">
                <span className="sm:hidden block text-[10px] font-medium text-muted-foreground mb-0.5">
                  {t("app.invoiceNew.rate")}
                </span>
              <input
                type="number"
                step="0.01"
                onChange={(e) =>
                  updateLineItem(i, "rate", Number(e.target.value))
                }
                value={item.rate}
                className="w-full sm:col-span-2 border border-border rounded px-2 py-2 sm:py-1.5 text-sm"
              />
              </label>
              <div className="sm:col-span-2 text-sm font-medium text-foreground text-right tabular-nums shrink-0 pb-2 sm:pb-0">
                {formatAppMoney(item.amount, currency, "en")}
              </div>
              <button
                onClick={() => removeLineItem(i)}
                aria-label={t("app.invoiceNew.removeLine")}
                className="sm:col-span-1 shrink-0 p-2 sm:p-0 pb-2 sm:pb-0 text-muted-foreground"
              >
                <X size={14} />
              </button>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={addLineItem}
          className="text-xs font-medium text-foreground flex items-center gap-1 mt-3"
        >
          <Plus size={12} /> {t("app.invoiceNew.addLineItemBtn")}
        </button>
      </div>

      {/* Internal cost & margin. Renders nothing for anyone without the
          jobCosting toggle, and never reaches the invoice the client sees —
          the figures live in their own table. */}
      <InvoiceCostSection
        subtotal={subtotal}
        currency={currency}
        value={costing}
        onChange={setCosting}
      />

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-2">{t("app.invoiceNew.dueDate")}</h2>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-2">{t("app.field.notes")}</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none"
        />
      </div>

      {/* An invoice raised without a quote behind it still needs job photos. */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-2">
          {t("app.quoteDetail.clientMedia")}
        </h2>
        <MediaUploader
          uploadUrl="/api/upload"
          value={clientPhotos}
          onChange={setClientPhotos}
          label={t("app.quoteNew.addPhotos")}
          hint={t("app.invoiceNew.addPhotosHint")}
        />
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <label className="flex items-center gap-2 text-sm mb-3">
          <input
            type="checkbox"
            checked={taxEnabled}
            onChange={(e) => setTaxEnabled(e.target.checked)}
          />
          {t("app.invoiceNew.applyTax", { rate: taxRate })}
        </label>
        {taxEnabled && (
          <div className="mb-3 space-y-1">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                {t("app.invoiceNew.taxRateLabel")}
              </span>
              <input
                type="number"
                step="0.001"
                min="0"
                value={taxRate}
                onChange={(e) => {
                  setTaxRate(Number(e.target.value) || 0);
                  setTaxRateTouched(true);
                }}
                className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm"
              />
              <span className="text-muted-foreground">%</span>
            </label>
            {taxNote && (
              <p className="text-xs text-muted-foreground">{taxNote}</p>
            )}
            {/* The jurisdiction's own caveat, where there is one: PST on real
                property in BC/MB, "state base only" in the US. Qualifies the
                number rather than explaining where it came from, so it is its
                own line and its own colour. */}
            {taxCaution && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {taxCaution}
              </p>
            )}
          </div>
        )}
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>{t("app.invoiceNew.subtotal")}</span>
            <span>{formatAppMoney(subtotal, currency, language)}</span>
          </div>
          {/* Tax on with nothing charged is not a settled zero — the send
              route refuses to post one (lib/tax/documentTax.js). */}
          {taxEnabled && tax === 0 ? (
            <div className="flex justify-between text-amber-700 dark:text-amber-300">
              <span>{t("app.invoiceNew.tax")}</span>
              <span className="font-medium">{t("app.tax.line.unresolved")}</span>
            </div>
          ) : (
            <div className="flex justify-between text-muted-foreground">
              <span>{t("app.invoiceNew.tax")}</span>
              <span>
                {taxEnabled
                  ? formatAppMoney(tax, currency, language)
                  : t("app.tax.line.none")}
              </span>
            </div>
          )}
          {taxAssumed && (
            <p className="text-xs text-amber-700 dark:text-amber-300 leading-snug">
              <span className="font-semibold">{t("app.tax.assumed.badge")}</span>{" "}
              {taxAssumed}
            </p>
          )}
          <div className="flex justify-between font-semibold text-foreground text-base pt-1 border-t border-border mt-1">
            <span>{t("app.invoiceNew.total")}</span>
            <span>{formatAppMoney(total, currency, language)}</span>
          </div>
        </div>
      </div>

      <div data-tour="invoice-save" className="fixed bottom-0 left-0 right-0 sm:left-60 bg-card border-t border-border px-6 py-4 flex gap-3 justify-end items-center">
        <p className="text-xs text-muted-foreground mr-auto max-w-xs">
          {t("app.invoiceNew.sendHelper", "Emails the invoice to the client’s email on file.")}
        </p>
        <button
          onClick={() => handleSave("draft")}
          disabled={saving}
          className="border border-border px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
        >
          {t("app.invoiceNew.saveDraft")}
        </button>
        <button
          onClick={() => handleSave("sent")}
          disabled={saving}
          className="bg-inverted text-inverted-foreground px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
        >
          {saving ? t("app.action.saving") : t("app.invoiceNew.saveSend")}
        </button>
      </div>
    </div>
  );
}
