// app/app/marketing/subscribers/page.js
//
// The recipient list for email-blast marketing campaigns. Subscribers can
// come from importing existing Clients (one click, safe to re-run) or be
// added by hand for people who aren't clients yet.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Plus, Trash2 } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { fetchArray } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import { useTranslation } from "@/app/hooks/useTranslation";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

export default function SubscribersPage() {
  const { t } = useTranslation();
  // null until the server answers — see lib/loadState.js.
  const [subscribers, setSubscribers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Separate from `error`, which lives inside the add-subscriber modal. A
  // failed list load is not a form validation problem and must not share a
  // banner with one.
  const [errorKey, setErrorKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErrorKey("");
    const result = await fetchArray("/api/marketing/subscribers");
    if (result.aborted) return;
    if (result.ok) setSubscribers(result.data);
    else setErrorKey(result.errorKey);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleImport() {
    setImporting(true);
    setImportMsg("");
    const res = await fetch("/api/marketing/subscribers/import-clients", {
      method: "POST",
    });
    const data = await res.json();
    if (res.ok) {
      setImportMsg(
        t("app.subs.imported", {
          imported: data.imported,
          total: data.total,
        }),
      );
      load();
    } else {
      setImportMsg(data.error || t("app.subs.importFailed"));
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
      if (!res.ok) throw new Error(data.error || t("app.subs.addError"));
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
    if (res.ok) load(); else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
    setBusyId(null);
  }

  async function handleDelete(id) {
    setBusyId(id);
    const res = await fetch(`/api/marketing/subscribers/${id}`, { method: "DELETE" });
    if (res.ok) load(); else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
    setBusyId(null);
  }

  const subscribedCount = (subscribers ?? []).filter((s) => s.subscribed).length;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/app/marketing"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft size={14} /> {t("app.subs.backToMarketing")}
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t("app.subs.title")}
            </h1>
            {/* "0 of 0 subscribed" is a claim we have not earned until the
                server answers. Nothing renders until it does. */}
            {subscribers && (
              <p className="text-sm text-muted-foreground mt-1">
                {t("app.subs.subtitle", {
                  subscribed: subscribedCount,
                  total: subscribers.length,
                })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-2 border border-border text-foreground px-3 py-2 rounded-lg text-sm font-semibold hover:bg-muted disabled:opacity-60"
            >
              <Download size={14} />{" "}
              {importing
                ? t("app.subs.importing")
                : t("app.subs.importFromClients")}
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 bg-inverted text-inverted-foreground px-3 py-2 rounded-lg text-sm font-semibold"
            >
              <Plus size={14} /> {t("app.action.add")}
            </button>
          </div>
        </div>
        {importMsg && <p className="text-xs text-muted-foreground mt-2">{importMsg}</p>}
      </div>

      <ListState
        loading={loading}
        errorKey={errorKey}
        onRetry={load}
        isEmpty={(subscribers ?? []).length === 0}
        skeleton={<div className="animate-pulse h-48 bg-accent rounded-xl" />}
        empty={
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <p className="text-sm text-muted-foreground">
              {t("app.subs.empty")}
            </p>
          </div>
        }
      >
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {(subscribers ?? []).map((s) => (
            <div key={s.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {s.name || s.email}
                  </span>
                  {s.name && <span className="text-xs text-muted-foreground">{s.email}</span>}
                  {!s.subscribed && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {t("app.subs.unsubscribed")}
                    </span>
                  )}
                  {s.source === "client_import" && (
                    <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full">
                      {t("app.subs.fromClients")}
                    </span>
                  )}
                </div>
                {s.phone && <p className="text-xs text-muted-foreground mt-0.5">{s.phone}</p>}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleSubscribed(s)}
                  disabled={busyId === s.id}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  {s.subscribed
                    ? t("app.subs.unsubscribe")
                    : t("app.subs.resubscribe")}
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  disabled={busyId === s.id}
                  className="text-muted-foreground hover:text-red-500"
                  aria-label={t("app.subs.removeAria", { email: s.email })}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </ListState>

      {showAdd && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAdd(false)}
        >
          <div
            className="bg-card rounded-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-foreground mb-4">
              {t("app.subs.addSubscriber")}
            </h2>
            {error && (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-3 py-2 mb-3">
                {error}
              </div>
            )}
            <form onSubmit={handleAdd} className="space-y-3">
              <input
                required
                autoFocus
                type="email"
                placeholder={t("app.field.email")}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputClass}
              />
              <input
                placeholder={t("app.subs.nameOptional")}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
              />
              <input
                placeholder={t("app.subs.phoneOptional")}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={inputClass}
              />
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-inverted text-inverted-foreground py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
              >
                {saving ? t("app.subs.adding") : t("app.subs.addSubscriber")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
