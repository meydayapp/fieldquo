// app/app/settings/team/workers/page.js
//
// Employees and contractors: their pay rate, start date, and payout status.
//
// ── Why this page became editable ───────────────────────────────────────────
//
// It used to list workers and offer only "Connect Stripe". Nothing in the app
// could set a pay RATE — so payroll had nothing to compute from and every line
// came out with a "no hourly rate" warning, and paid leave couldn't be priced
// either. A page that shows a rate it won't let you change is the read-only
// version of a dead button.
//
// Start date is here for the same reason: leave accrual pro-rates a mid-year
// hire, and without a real hire date it (correctly) refuses to guess and grants
// the full allotment. Setting it is how a company gets the pro-rated answer.
"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Info, Check, AlertTriangle } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { formatDateOnly, isoDateOnly } from "@/lib/format/companyDate";

// hiredOn is a calendar day. Both reading it into the <input type="date"> and
// displaying it must use the UTC getters, or the date shifts a day each way.
const dateInput = (d) => isoDateOnly(d);

export default function WorkersPage() {
  const [workers, setWorkers] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await fetchJson("/api/workers");
      setWorkers(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setError(err.message);
      setWorkers([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function connectStripe(workerId) {
    // Was `if (res.ok) window.location.href = data.url` — on failure the
    // button did nothing at all, which reads as a broken page rather than a
    // configuration problem the owner can fix.
    setError("");
    try {
      const data = await fetchJson(`/api/workers/${workerId}/connect`, {
        method: "POST",
      });
      if (!data?.url) throw new Error("Stripe didn't return an onboarding link.");
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
    }
  }

  if (!workers) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto animate-pulse h-64 bg-accent rounded-xl" />
    );
  }

  const missingRate = workers.filter((w) => w.active && w.hourlyRate == null);

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Workers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Everyone on the books — their pay rate, start date, and payout status.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {missingRate.length > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <div>
            No pay rate set for{" "}
            {missingRate.map((w) => w.name).join(", ")}. Payroll can&apos;t work
            out their hours or their paid leave until it has one.
          </div>
        </div>
      )}

      <div className="space-y-2">
        {workers.map((w) => (
          <WorkerRow
            key={w.id}
            worker={w}
            reload={load}
            onConnect={() => connectStripe(w.id)}
          />
        ))}
        {!workers.length && (
          <p className="text-sm text-muted-foreground">
            Nobody yet. Team members get a worker record when they accept their
            invitation.
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
        <Info size={13} className="mt-0.5 shrink-0" />
        Employee or contractor isn&apos;t editable here — switching it has tax
        consequences, so it&apos;s deliberately a deactivate-and-re-add.
      </p>
    </div>
  );
}

function WorkerRow({ worker, reload, onConnect }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: worker.name || "",
    hourlyRate: worker.hourlyRate == null ? "" : String(worker.hourlyRate),
    hiredOn: dateInput(worker.hiredOn),
    active: worker.active !== false,
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await fetchJson(`/api/workers/${worker.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          // "" clears the rate back to unset, which is a real state — it means
          // payroll warns instead of paying a made-up number.
          hourlyRate: form.hourlyRate === "" ? null : Number(form.hourlyRate),
          hiredOn: form.hiredOn,
          active: form.active,
        }),
      });
      setSaved(true);
      setEditing(false);
      await reload();
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <form
        onSubmit={save}
        className="rounded-xl border border-border bg-card p-4 space-y-3"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">Name</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              Pay rate ($/hour)
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.hourlyRate}
              onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
              placeholder="not set"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              Start date
            </span>
            <input
              type="date"
              value={form.hiredOn}
              onChange={(e) => setForm({ ...form, hiredOn: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Leave blank if you don&apos;t know — holiday entitlement is then
              granted in full rather than pro-rated from a guess.
            </span>
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
            className="rounded border-border"
          />
          Active (included in payroll and scheduling)
        </label>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-lg border border-border px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-inverted text-inverted-foreground px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Save
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground flex items-center gap-2">
          {worker.name}
          {worker.active === false && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              inactive
            </span>
          )}
          {saved && (
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
              <Check size={12} /> saved
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground capitalize">
          {worker.type}
          {worker.hourlyRate != null ? ` · $${worker.hourlyRate}/hr` : " · no rate set"}
          {worker.hiredOn
            ? ` · started ${formatDateOnly(worker.hiredOn)}`
            : ""}
          {!worker.userId && " · no login"}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {worker.type === "contractor" &&
          (worker.stripeConnectedAccountId ? (
            <span className="text-xs text-green-600 dark:text-green-400">
              Stripe connected
            </span>
          ) : (
            <button
              onClick={onConnect}
              className="text-xs border border-border rounded-full px-3 py-1.5"
            >
              Connect Stripe
            </button>
          ))}
        <button
          onClick={() => setEditing(true)}
          className="text-xs border border-border rounded-full px-3 py-1.5"
        >
          Edit
        </button>
      </div>
    </div>
  );
}
