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
      <div className="p-6 max-w-4xl mx-auto animate-pulse h-96 bg-gray-200 rounded-xl" />
    );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Invoice</h1>
        <p className="text-sm text-gray-500 mt-1">
          Create a standalone invoice.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Client</h2>
        {selectedClient ? (
          <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
            <div>
              <div className="font-medium text-gray-900">
                {selectedClient.name}
              </div>
              <div className="text-sm text-gray-500">
                {selectedClient.email || selectedClient.phone}
              </div>
            </div>
            <button
              onClick={() => setSelectedClient(null)}
              className="text-sm text-gray-500 underline"
            >
              Change
            </button>
          </div>
        ) : (
          <div>
            <div className="relative mb-2">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Search clients..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            {clientSearch && (
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                {filteredClients.length === 0 && (
                  <p className="px-3 py-3 text-sm text-gray-500">No matches.</p>
                )}
                {filteredClients.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedClient(c);
                      setClientSearch("");
                    }}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50"
                  >
                    <div className="font-medium text-gray-900">{c.name}</div>
                    <div className="text-xs text-gray-500">
                      {c.email || c.phone}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Line Items</h2>
        </div>
        <div className="space-y-2">
          {lineItems.map((item, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input
                value={item.description}
                onChange={(e) =>
                  updateLineItem(i, "description", e.target.value)
                }
                placeholder="Description"
                className="col-span-5 border border-gray-300 rounded px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                value={item.quantity}
                onChange={(e) =>
                  updateLineItem(i, "quantity", Number(e.target.value))
                }
                className="col-span-2 border border-gray-300 rounded px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                step="0.01"
                value={item.rate}
                onChange={(e) =>
                  updateLineItem(i, "rate", Number(e.target.value))
                }
                className="col-span-2 border border-gray-300 rounded px-2 py-1.5 text-sm"
              />
              <div className="col-span-2 text-sm font-medium text-gray-900 text-right">
                ${Number(item.amount).toFixed(2)}
              </div>
              <button
                onClick={() => removeLineItem(i)}
                className="col-span-1 text-gray-400"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addLineItem}
          className="text-xs font-medium text-gray-900 flex items-center gap-1 mt-3"
        >
          <Plus size={12} /> Add line item
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-2">Due Date</h2>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-2">Notes</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <label className="flex items-center gap-2 text-sm mb-3">
          <input
            type="checkbox"
            checked={taxEnabled}
            onChange={(e) => setTaxEnabled(e.target.checked)}
          />
          Apply tax ({taxRate}%)
        </label>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Tax</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold text-gray-900 text-base pt-1 border-t border-gray-100 mt-1">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 sm:left-60 bg-white border-t border-gray-200 px-6 py-4 flex gap-3 justify-end">
        <button
          onClick={() => handleSave("draft")}
          disabled={saving}
          className="border border-gray-300 px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
        >
          Save as Draft
        </button>
        <button
          onClick={() => handleSave("sent")}
          disabled={saving}
          className="bg-gray-900 text-white px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save & Send"}
        </button>
      </div>
    </div>
  );
}
