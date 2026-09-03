// app/components/purchasing/SuppliersPanel.js
//
// The supplier book.
//
// ── There is no delete, and the button does not pretend otherwise ──────────
//
// The control says "Retire", it sets `active: false`, and the route has no
// DELETE at all. A bin icon that archived would be the "destructive operation
// labelled as cosmetic" failure pointing the other way — cosmetic wording on
// something people expect to destroy — so it is worded as what it does.
"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchList } from "@/lib/loadState";
import { reportResponseError } from "@/lib/clientErrors";
import ListState from "@/app/components/ListState";

const inputClass =
  "w-full rounded border border-border bg-background px-3 py-2 text-base sm:text-sm";

const BLANK = { name: "", accountRef: "", contactName: "", email: "", phone: "" };

export default function SuppliersPanel() {
  const { t } = useTranslation();
  // null, never []. An empty array is a claim that there are zero suppliers,
  // and making that claim before the server answers is exactly the bug
  // lib/loadState.js exists to prevent.
  const [suppliers, setSuppliers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(BLANK);
  const [saveError, setSaveError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchList("/api/suppliers?includeInactive=1");
    if (!result.ok) {
      if (!result.aborted) setErrorKey(result.errorKey);
      setLoading(false);
      return;
    }
    setErrorKey("");
    setSuppliers(Array.isArray(result.data?.suppliers) ? result.data.suppliers : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e) {
    e.preventDefault();
    if (!draft.name.trim() || busy) return;
    setBusy(true);
    setSaveError("");
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        // The server's own sentence, not a generic one — a 409 here says which
        // supplier already has that name, which is the only useful reply.
        const message = await reportResponseError(res).catch(() => null);
        setSaveError(message || t("app.purchasing.suppliers.saveFailed"));
        return;
      }
      setDraft(BLANK);
      setAdding(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function retire(supplier) {
    setSaveError("");
    const res = await fetch(`/api/suppliers/${supplier.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !supplier.active }),
    });
    if (!res.ok) {
      const message = await reportResponseError(res).catch(() => null);
      setSaveError(message || t("app.purchasing.suppliers.saveFailed"));
      return;
    }
    await load();
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          {t("app.purchasing.suppliers.heading")}
        </h2>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus size={13} />
          {t("app.purchasing.suppliers.add")}
        </button>
      </div>

      {adding && (
        <form onSubmit={create} className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            autoFocus
            required
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder={t("app.purchasing.suppliers.namePlaceholder")}
            className={inputClass}
          />
          <input
            value={draft.accountRef}
            onChange={(e) => setDraft((d) => ({ ...d, accountRef: e.target.value }))}
            placeholder={t("app.purchasing.suppliers.accountPlaceholder")}
            className={inputClass}
          />
          <input
            value={draft.contactName}
            onChange={(e) => setDraft((d) => ({ ...d, contactName: e.target.value }))}
            placeholder={t("app.purchasing.suppliers.contactPlaceholder")}
            className={inputClass}
          />
          <input
            type="tel"
            value={draft.phone}
            onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
            placeholder={t("app.purchasing.suppliers.phonePlaceholder")}
            className={inputClass}
          />
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={busy || !draft.name.trim()}
              className="rounded bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {t("app.purchasing.suppliers.save")}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              {t("app.purchasing.cancel")}
            </button>
          </div>
        </form>
      )}

      {saveError && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{saveError}</p>
      )}

      <div className="mt-3">
        <ListState
          loading={loading}
          errorKey={errorKey}
          isEmpty={suppliers !== null && suppliers.length === 0}
          onRetry={load}
          empty={
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("app.purchasing.suppliers.empty")}
            </p>
          }
        >
          <ul className="divide-y divide-border">
            {(suppliers || []).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm ${s.active ? "text-foreground" : "text-muted-foreground line-through"}`}
                  >
                    {s.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[s.accountRef, s.contactName, s.phone].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => retire(s)}
                  className="shrink-0 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {s.active
                    ? t("app.purchasing.suppliers.retire")
                    : t("app.purchasing.suppliers.restore")}
                </button>
              </li>
            ))}
          </ul>
        </ListState>
      </div>
    </div>
  );
}
