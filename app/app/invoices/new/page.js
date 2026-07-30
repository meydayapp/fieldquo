// app/app/invoices/new/page.js
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, X, Trash2, Search } from "lucide-react";

export default function NewInvoicePage() {
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
  const [dueDate, setDueDate] = useState("");
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxRate, setTaxRate] = useState(0);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/clients").then((r) => r.json()),
      fetch("/api/settings/business-info").then((r) => r.json()),
    ]).then(([clientsData, businessInfo]) => {
      const list = Array.isArray(clientsData) ? clientsData : [];
      setClients(list);
      if (preselectedClientId) {
        const match = list.find((c) => c.id === preselectedClientId);
        if (match) setSelectedClient(match);
      }
      setTaxRate(Number(businessInfo?.taxRate || 0));
      setLoading(false);
    });
  }, [preselectedClientId]);

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
      setError("Select a client first");
      return;
    }
    if (lineItems.every((item) => !item.description.trim())) {
      setError("Add at least one line item");
      return;
    }

    setSaving(true);

    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: selectedClient.id,
        lineItems,
        subtotal,
        tax,
        total,
        notes,
        dueDate: dueDate || null,
        status,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Could not create invoice");
      return;
    }

    const invoice = await res.json();
    router.push(`/app/invoices/${invoice.id}`);
  }

  if (loading)
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto animate-pulse h-96 bg-accent rounded-xl" />
    );

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-foreground">New Invoice</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create a standalone invoice.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-3">Client</h2>
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
              Change
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
                placeholder="Search clients..."
                className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            {clientSearch && (
              <div className="border border-border rounded-lg divide-y divide-border max-h-48 overflow-y-auto">
                {filteredClients.length === 0 && (
                  <p className="px-3 py-3 text-sm text-muted-foreground">No matches.</p>
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

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-foreground">Line Items</h2>
        </div>
        <div className="space-y-2">
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
                placeholder="Description"
                className="w-full sm:col-span-5 border border-border rounded px-2 py-2 sm:py-1.5 text-sm"
              />
              <div className="flex items-end gap-2 sm:contents">
              <label className="flex-1 sm:contents">
                <span className="sm:hidden block text-[10px] font-medium text-muted-foreground mb-0.5">
                  Qty
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
                  Rate
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
                ${Number(item.amount).toFixed(2)}
              </div>
              <button
                onClick={() => removeLineItem(i)}
                aria-label="Remove line"
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
          <Plus size={12} /> Add line item
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-2">Due Date</h2>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-2">Notes</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none"
        />
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <label className="flex items-center gap-2 text-sm mb-3">
          <input
            type="checkbox"
            checked={taxEnabled}
            onChange={(e) => setTaxEnabled(e.target.checked)}
          />
          Apply tax ({taxRate}%)
        </label>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Tax</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold text-foreground text-base pt-1 border-t border-border mt-1">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 sm:left-60 bg-card border-t border-border px-6 py-4 flex gap-3 justify-end">
        <button
          onClick={() => handleSave("draft")}
          disabled={saving}
          className="border border-border px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
        >
          Save as Draft
        </button>
        <button
          onClick={() => handleSave("sent")}
          disabled={saving}
          className="bg-inverted text-inverted-foreground px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save & Send"}
        </button>
      </div>
    </div>
  );
}
