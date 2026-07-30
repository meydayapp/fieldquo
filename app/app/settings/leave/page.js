// app/app/settings/leave/page.js
//
// Leave policies — what kinds of time off exist and how entitlement builds up.
// Owner/admin only; the server enforces that and this page reflects it.
//
// The three accrual methods are genuinely different and the form says so
// inline, because picking the wrong one silently produces a balance that looks
// plausible and isn't:
//
//   • A fixed number of days each year — the whole allowance is available now.
//   • Accrues each pay period — earned gradually, so it's lower in January.
//   • Vacation pay as % of gross — accrues MONEY, not days (Canada's 4% model).
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Plus,
  Trash2,
  Info,
  AlertTriangle,
  CalendarClock,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

const METHOD_LABEL = {
  annual_allotment: "Fixed days per year",
  per_period: "Accrues each pay period",
  percent_of_gross: "Vacation pay (% of gross)",
};

const KINDS = [
  { value: "vacation", label: "Vacation" },
  { value: "sick", label: "Sick" },
  { value: "personal", label: "Personal" },
  { value: "unpaid", label: "Unpaid" },
  { value: "other", label: "Other" },
];

const BLANK = {
  name: "",
  kind: "vacation",
  paid: true,
  accrualMethod: "annual_allotment",
  annualDays: 10,
  percentOfGross: 4,
  carryoverMaxDays: "",
  requiresApproval: true,
};

export default function LeaveSettingsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await fetchJson("/api/settings/leave-policies");
      setData(d);
      setError("");
    } catch (err) {
      setError(err.message);
      setData({ policies: [], templates: [] });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function seed(region) {
    setBusy(`seed-${region}`);
    setError("");
    try {
      const r = await fetchJson("/api/settings/leave-policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seedRegion: region }),
      });
      setNotice(
        r.created
          ? `Added ${r.created} polic${r.created === 1 ? "y" : "ies"}${r.skipped ? `, skipped ${r.skipped} that already existed` : ""}.`
          : "Those policies already exist — nothing changed.",
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function roll(fromYear) {
    setBusy("roll");
    setError("");
    try {
      const r = await fetchJson("/api/settings/leave-policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rollFromYear: fromYear }),
      });
      setNotice(
        r.rolled
          ? `Carried unused days into ${r.intoYear} for ${r.rolled} balance(s).`
          : "Nothing was eligible to carry over.",
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function remove(policy) {
    const used = policy._count?.requests > 0;
    const ok = window.confirm(
      used
        ? `"${policy.name}" has ${policy._count.requests} request(s). It will be deactivated — existing requests keep their history — but nobody can book it again. Continue?`
        : `Delete "${policy.name}"? It has never been used, so it will be removed entirely.`,
    );
    if (!ok) return;
    setBusy(`del-${policy.id}`);
    try {
      await fetchJson(
        `/api/settings/leave-policies?id=${encodeURIComponent(policy.id)}`,
        { method: "DELETE" },
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
        <Loader2 className="animate-spin" size={16} /> Loading leave policies…
      </div>
    );
  }

  const active = data.policies.filter((p) => p.active);
  const inactive = data.policies.filter((p) => !p.active);
  const lastYear = (data.year || new Date().getUTCFullYear()) - 1;

  return (
    <div className="p-4 sm:p-6 max-w-3xl space-y-6">
      <header>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <CalendarClock size={20} /> Time off policies
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          What time off your team can take, and how it builds up. Requests and
          balances live on{" "}
          <Link href="/app/time-off" className="underline">
            Time off
          </Link>
          .
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
          {notice}
        </div>
      )}

      {!active.length && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Sparkles size={16} /> Start from a template
          </div>
          <p className="text-sm text-muted-foreground">
            These are common starting points you can edit — not compliance
            advice. Each one says what it assumes.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {data.templates.map((t) => (
              <button
                key={t.key}
                onClick={() => seed(t.key)}
                disabled={Boolean(busy)}
                className="rounded-lg border border-border p-3 text-left hover:bg-muted disabled:opacity-60"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">{t.label}</span>
                  {busy === `seed-${t.key}` ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ArrowRight size={14} className="text-muted-foreground" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {t.policies.length} policies · figures as of {t.sourceYear}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">
                  {t.note}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Policies</h2>
          <button
            onClick={() => setAdding((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-inverted text-inverted-foreground px-3 py-1.5 text-sm font-medium"
          >
            <Plus size={14} /> Add policy
          </button>
        </div>

        {adding && (
          <PolicyForm
            initial={BLANK}
            onSaved={() => {
              setAdding(false);
              load();
            }}
            onCancel={() => setAdding(false)}
          />
        )}

        {active.length ? (
          <div className="space-y-2">
            {active.map((p) => (
              <PolicyCard
                key={p.id}
                policy={p}
                onSaved={load}
                onRemove={() => remove(p)}
                removing={busy === `del-${p.id}`}
              />
            ))}
          </div>
        ) : (
          !adding && (
            <p className="text-sm text-muted-foreground">
              No policies yet — seed a template above or add one.
            </p>
          )
        )}

        {inactive.length > 0 && (
          <div className="pt-2">
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">
              Retired
            </h3>
            <div className="space-y-1.5">
              {inactive.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground flex items-center justify-between gap-2"
                >
                  <span>
                    {p.name} · {p._count?.requests || 0} past request(s)
                  </span>
                  <span className="text-[11px]">not bookable</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {active.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h2 className="font-semibold text-foreground">Year end</h2>
          <p className="text-sm text-muted-foreground">
            Carry unused days from {lastYear} into {lastYear + 1}, capped by each
            policy&apos;s carryover limit. This runs only when you ask — it is
            not automatic, so you decide when the year is closed.
          </p>
          <button
            onClick={() => roll(lastYear)}
            disabled={Boolean(busy)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-60"
          >
            {busy === "roll" && <Loader2 size={14} className="animate-spin" />}
            Carry {lastYear} balances into {lastYear + 1}
          </button>
        </section>
      )}

      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
        <Info size={13} className="mt-0.5 shrink-0" />
        Statutory minimums vary by province, state and length of service, and
        several rise with years employed. FieldQuo tracks what you configure — it
        doesn&apos;t decide what you owe.
      </p>
    </div>
  );
}

function PolicyCard({ policy, onSaved, onRemove, removing }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <PolicyForm
        initial={{
          ...policy,
          annualDays: policy.annualDays == null ? "" : Number(policy.annualDays),
          percentOfGross:
            policy.percentOfGross == null ? "" : Number(policy.percentOfGross),
          carryoverMaxDays:
            policy.carryoverMaxDays == null ? "" : Number(policy.carryoverMaxDays),
        }}
        onSaved={() => {
          setEditing(false);
          onSaved();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const entitlement =
    policy.accrualMethod === "percent_of_gross"
      ? `${Number(policy.percentOfGross || 0)}% of gross`
      : `${Number(policy.annualDays || 0)} days/year`;

  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">{policy.name}</span>
            {!policy.paid && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                unpaid
              </span>
            )}
            {!policy.requiresApproval && (
              <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                auto-approved
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">
            {METHOD_LABEL[policy.accrualMethod]} · {entitlement} · carryover{" "}
            {policy.carryoverMaxDays == null
              ? "unlimited"
              : `${Number(policy.carryoverMaxDays)} days`}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm"
          >
            Edit
          </button>
          <button
            onClick={onRemove}
            disabled={removing}
            className="rounded-lg border border-border px-2.5 py-1.5 text-sm text-red-600 dark:text-red-400 disabled:opacity-60"
            aria-label={`Remove ${policy.name}`}
          >
            {removing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function PolicyForm({ initial, onSaved, onCancel }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isMoney = form.accrualMethod === "percent_of_gross";

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await fetchJson("/api/settings/leave-policies", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const set = (k) => (e) =>
    setForm((f) => ({
      ...f,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  return (
    <form
      onSubmit={save}
      className="rounded-xl border border-border bg-card p-4 space-y-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-muted-foreground">Name</span>
          <input
            required
            value={form.name}
            onChange={set("name")}
            placeholder="Vacation"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Kind</span>
          <select
            value={form.kind}
            onChange={set("kind")}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">
            How it builds up
          </span>
          <select
            value={form.accrualMethod}
            onChange={set("accrualMethod")}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {Object.entries(METHOD_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>

        {isMoney ? (
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              Percent of gross
            </span>
            <input
              type="number"
              step="0.001"
              min="0"
              max="100"
              value={form.percentOfGross}
              onChange={set("percentOfGross")}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        ) : (
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              Days per year
            </span>
            <input
              type="number"
              step="0.5"
              min="0"
              value={form.annualDays}
              onChange={set("annualDays")}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        )}

        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">
            Carryover cap (days)
          </span>
          <input
            type="number"
            step="0.5"
            min="0"
            value={form.carryoverMaxDays}
            onChange={set("carryoverMaxDays")}
            placeholder="blank = unlimited"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Blank means unlimited. 0 means use it or lose it.
          </span>
        </label>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.paid !== false}
            onChange={(e) => setForm({ ...form, paid: e.target.checked })}
            className="rounded border-border"
          />
          Paid
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.requiresApproval !== false}
            onChange={(e) =>
              setForm({ ...form, requiresApproval: e.target.checked })
            }
            className="rounded border-border"
          />
          Needs a manager&apos;s approval
        </label>
      </div>

      {isMoney && (
        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <Info size={13} className="mt-0.5 shrink-0" />
          This accrues money, not days — the Canadian 4% vacation-pay model. Time
          off under it isn&apos;t limited by a day balance.
        </p>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-4 py-2 text-sm"
        >
          Cancel
        </button>
        <button
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-inverted text-inverted-foreground px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          {form.id ? "Save changes" : "Add policy"}
        </button>
      </div>
    </form>
  );
}
