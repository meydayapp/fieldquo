// app/app/settings/team/timesheets/page.js
"use client";

import { useState, useEffect } from "react";
import { fetchJson } from "@/lib/fetchJson";
import { reportResponseError } from "@/lib/clientErrors";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";

import { useTranslation } from "@/app/hooks/useTranslation";

// A blank manual-entry form. `date` defaults to today so the common case
// (logging hours after the fact) is one worker-pick and two times away.
function blankForm() {
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return { workerId: "", date: iso, start: "", end: "" };
}

export default function TimesheetsPage() {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  const [entries, setEntries] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    // Both lists load in parallel; the form's worker picker needs the roster,
    // and an empty roster is why "no way to add" happens — surface it instead.
    Promise.all([
      fetch("/api/time-entries")
        .then((r) => r.json())
        .then((data) => (Array.isArray(data) ? data : [])),
      fetch("/api/workers")
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => (Array.isArray(data) ? data : [])),
    ])
      .then(([e, w]) => {
        setEntries(e);
        setWorkers(w.filter((x) => x.active !== false));
      })
      .finally(() => setLoading(false));
  }, []);

  async function approve(id) {
    const res = await fetch(`/api/time-entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    if (res.ok) {
      const updated = await res.json();
      setEntries((prev) =>
        prev.map((e) => (e.id === updated.id ? updated : e)),
      );
    } else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
  }

  // Finish an open entry (no clockOut yet). The server computes `hours` from
  // clockIn→clockOut, so we only ever send the timestamp, never the total.
  async function clockOut(id) {
    const res = await fetch(`/api/time-entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clockOut: new Date().toISOString() }),
    });
    if (res.ok) {
      const updated = await res.json();
      setEntries((prev) =>
        prev.map((e) => (e.id === updated.id ? updated : e)),
      );
    } else {
      await reportResponseError(res);
    }
  }

  async function remove(id) {
    const res = await fetch(`/api/time-entries/${id}`, { method: "DELETE" });
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } else {
      await reportResponseError(res);
    }
  }

  async function submitEntry(evt) {
    evt.preventDefault();
    setFormError("");

    if (!form.workerId) {
      setFormError(t("app.timesheets.selectWorker"));
      return;
    }
    if (!form.date || !form.start) return;

    // Local date + time → a Date the server parses as-is. No timezone suffix,
    // so it lands in the contractor's own wall-clock time, which is what they
    // typed. An empty end leaves the entry open (clock out later).
    const clockIn = `${form.date}T${form.start}`;
    const clockOutStr = form.end ? `${form.date}T${form.end}` : null;

    if (clockOutStr && new Date(clockOutStr) <= new Date(clockIn)) {
      setFormError(t("app.timesheets.end") + " > " + t("app.timesheets.start"));
      return;
    }

    setSaving(true);
    try {
      // Create the entry (clock-in only — the POST route doesn't take an end),
      // then set clockOut via PATCH so the server does the hours maths in one
      // place. Two calls, but both go through the same validated endpoints the
      // approve/clock-out buttons use.
      let entry = await fetchJson("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId: form.workerId, clockIn }),
      });

      if (clockOutStr) {
        entry = await fetchJson(`/api/time-entries/${entry.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clockOut: new Date(clockOutStr).toISOString() }),
        });
      }

      // The POST include only returns worker {id,name}; enrich from the roster
      // so the row renders without a refetch.
      if (!entry.worker) {
        const w = workers.find((x) => x.id === form.workerId);
        if (w) entry.worker = { id: w.id, name: w.name };
      }

      setEntries((prev) => [entry, ...prev]);
      setForm(blankForm());
      setShowForm(false);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto animate-pulse h-64 bg-accent rounded-xl" />
    );

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("app.timesheets.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("app.timesheets.subtitle")}
          </p>
        </div>
        {workers.length > 0 && (
          <button
            onClick={() => {
              setFormError("");
              setShowForm((v) => !v);
            }}
            className="shrink-0 text-sm bg-inverted text-inverted-foreground px-4 py-2 rounded-full font-medium"
          >
            {t("app.timesheets.addEntry")}
          </button>
        )}
      </div>

      {workers.length === 0 && (
        <p className="text-sm text-muted-foreground bg-card border border-border rounded-xl px-5 py-4">
          {t("app.timesheets.noWorkers")}
        </p>
      )}

      {showForm && workers.length > 0 && (
        <form
          onSubmit={submitEntry}
          className="bg-card border border-border rounded-xl p-5 space-y-4"
        >
          <h2 className="text-sm font-semibold text-foreground">
            {t("app.timesheets.newEntry")}
          </h2>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("app.timesheets.worker")}
            </label>
            <select
              value={form.workerId}
              onChange={(e) =>
                setForm((f) => ({ ...f, workerId: e.target.value }))
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">{t("app.timesheets.selectWorker")}</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t("app.timesheets.date")}
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, date: e.target.value }))
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t("app.timesheets.start")}
              </label>
              <input
                type="time"
                value={form.start}
                onChange={(e) =>
                  setForm((f) => ({ ...f, start: e.target.value }))
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t("app.timesheets.end")}
              </label>
              <input
                type="time"
                value={form.end}
                onChange={(e) =>
                  setForm((f) => ({ ...f, end: e.target.value }))
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>

          {formError && (
            <p className="text-xs text-destructive">{formError}</p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="text-sm bg-inverted text-inverted-foreground px-4 py-2 rounded-full font-medium disabled:opacity-60"
            >
              {saving ? t("app.timesheets.saving") : t("app.timesheets.save")}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setFormError("");
              }}
              className="text-sm text-muted-foreground px-4 py-2 rounded-full"
            >
              {t("app.timesheets.cancel")}
            </button>
          </div>
        </form>
      )}

      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        {entries.length === 0 && (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            {t("app.timesheets.empty")}
          </p>
        )}
        {entries.map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between px-5 py-3 gap-3"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground truncate">
                {e.worker?.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDate(e.clockIn)} ·{" "}
                {e.hours ? `${e.hours}h` : t("app.timesheets.inProgress")}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!e.clockOut && !e.hours && (
                <button
                  onClick={() => clockOut(e.id)}
                  className="text-xs bg-accent text-foreground px-3 py-1.5 rounded-full"
                >
                  {t("app.timesheets.clockOut")}
                </button>
              )}
              {e.status === "pending" && e.hours ? (
                <button
                  onClick={() => approve(e.id)}
                  className="text-xs bg-inverted text-inverted-foreground px-3 py-1.5 rounded-full"
                >
                  {t("app.timesheets.approve")}
                </button>
              ) : (
                <span className="text-xs capitalize text-muted-foreground">
                  {e.status}
                </span>
              )}
              {e.status !== "approved" && (
                <button
                  onClick={() => remove(e.id)}
                  className="text-xs text-muted-foreground hover:text-destructive"
                  aria-label={t("app.timesheets.delete")}
                  title={t("app.timesheets.delete")}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
