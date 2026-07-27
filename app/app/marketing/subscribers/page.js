// app/app/marketing/subscribers/page.js
//
// The recipient list for email-blast marketing campaigns. Subscribers can
// come from importing existing Clients (one click, safe to re-run) or be
// added by hand for people who aren't clients yet.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Plus, Trash2 } from "lucide-react";

const inputClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400";

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    return fetch("/api/marketing/subscribers")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setSubscribers(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleImport() {
    setImporting(true);
    setImportMsg("");
    const res = await fetch("/api/marketing/subscribers/import-clients", {
      method: "POST",
    });
    const data = await res.json();
    if (res.ok) {
      setImportMsg(`Imported ${data.imported} of ${data.total} clients with an email on file.`);
      load();
    } else {
      setImportMsg(data.error || "Import failed");
    }
    setImporting(false);
  }

  async function handleAdd(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/marketing/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add subscriber");
      setForm({ email: "", name: "", phone: "" });
      setShowAdd(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleSubscribed(sub) {
    setBusyId(sub.id);
    const res = await fetch(`/api/marketing/subscribers/${sub.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscribed: !sub.subscribed }),
    });
    if (res.ok) load();
    setBusyId(null);
  }

  async function handleDelete(id) {
    setBusyId(id);
    const res = await fetch(`/api/marketing/subscribers/${id}`, { method: "DELETE" });
    if (res.ok) load();
    setBusyId(null);
  }

  const subscribedCount = subscribers.filter((s) => s.subscribed).length;

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-48 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/app/marketing"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-2"
        >
          <ArrowLeft size={14} /> Back to Marketing
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Subscribers</h1>
            <p className="text-sm text-gray-500 mt-1">
              {subscribedCount} subscribed of {subscribers.length} total — this
              is who an Email blast campaign sends to.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-2 border border-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
            >
              <Download size={14} /> {importing ? "Importing…" : "Import from Clients"}
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-semibold"
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </div>
        {importMsg && <p className="text-xs text-gray-500 mt-2">{importMsg}</p>}
      </div>

      {subscribers.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-sm text-gray-500">
            No subscribers yet — import your clients or add someone manually.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {subscribers.map((s) => (
            <div key={s.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {s.name || s.email}
                  </span>
                  {s.name && <span className="text-xs text-gray-400">{s.email}</span>}
                  {!s.subscribed && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      Unsubscribed
                    </span>
                  )}
                  {s.source === "client_import" && (
                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                      From clients
                    </span>
                  )}
                </div>
                {s.phone && <p className="text-xs text-gray-400 mt-0.5">{s.phone}</p>}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleSubscribed(s)}
                  disabled={busyId === s.id}
                  className="text-xs font-medium text-gray-500 hover:text-gray-900"
                >
                  {s.subscribed ? "Unsubscribe" : "Resubscribe"}
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  disabled={busyId === s.id}
                  className="text-gray-400 hover:text-red-500"
                  aria-label={`Remove ${s.email}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAdd(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Subscriber</h2>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-3">
                {error}
              </div>
            )}
            <form onSubmit={handleAdd} className="space-y-3">
              <input
                required
                autoFocus
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputClass}
              />
              <input
                placeholder="Name (optional)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
              />
              <input
                placeholder="Phone (optional)"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={inputClass}
              />
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-gray-900 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
              >
                {saving ? "Adding…" : "Add Subscriber"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
