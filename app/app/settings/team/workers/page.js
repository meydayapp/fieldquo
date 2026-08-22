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
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";
import { formatDateOnly, isoDateOnly } from "@/lib/format/companyDate";
import { useTranslation } from "@/app/hooks/useTranslation";

// hiredOn is a calendar day. Both reading it into the <input type="date"> and
// displaying it must use the UTC getters, or the date shifts a day each way.
const dateInput = (d) => isoDateOnly(d);

// ── This is a payroll page ───────────────────────────────────────────────
//
// Its own subtitle is "Everyone on the books — their pay rate, start date, and
// payout status." It sat behind no payroll check at all, so a Manager refused
// by /app/payroll, /app/settings/payroll and /app/settings/team/payroll could
// open this tab, read every rate, and edit them — QA moved a colleague from
// $25 to $26 and confirmed it stuck. The payroll gate was on three doors out
// of four.
//
// Thin wrapper, same shape as app/settings/payroll: the gate has to sit ABOVE
// the component that owns the hooks, or the early return makes those hooks
// conditional.
export default function WorkersPage() {
  const access = useSettingsAccess();
  if (!access.canSee("payroll")) return <NoAccessPanel capability="payroll" />;
  return <WorkersScreen />;
}

function WorkersScreen() {

  const { t } = useTranslation();
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
      if (!data?.url) throw new Error(t("app.setWorkers.noStripeLink"));
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
        <h1 className="text-2xl font-bold text-foreground">
          {t("app.setWorkers.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.setWorkers.subtitle")}
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
            {t("app.setWorkers.missingRate", {
              names: missingRate.map((w) => w.name).join(", "),
            })}
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
            {t("app.setWorkers.empty")}
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
        <Info size={13} className="mt-0.5 shrink-0" />
        {t("app.setWorkers.typeNote")}
      </p>
    </div>
  );
}

function WorkerRow({ worker, reload, onConnect }) {
  const { t } = useTranslation();
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
            <span className="text-xs font-medium text-muted-foreground">
              {t("app.field.name")}
            </span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              {t("app.setWorkers.payRate")}
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.hourlyRate}
              onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
              placeholder={t("app.setWorkers.notSet")}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              {t("app.setWorkers.startDate")}
            </span>
            <input
              type="date"
              value={form.hiredOn}
              onChange={(e) => setForm({ ...form, hiredOn: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              {t("app.setWorkers.startDateHint")}
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
          {t("app.setWorkers.activeLabel")}
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
            {t("app.action.cancel")}
          </button>
          <button
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-inverted text-inverted-foreground px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {t("app.action.save")}
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
              {t("app.setWorkers.inactive")}
            </span>
          )}
          {saved && (
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
              <Check size={12} /> {t("app.setWorkers.saved")}
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground capitalize">
          {worker.type}
          {worker.hourlyRate != null
            ? t("app.setWorkers.ratePerHr", { rate: worker.hourlyRate })
            : t("app.setWorkers.noRateSet")}
          {worker.hiredOn
            ? t("app.setWorkers.startedOn", {
                date: formatDateOnly(worker.hiredOn),
              })
            : ""}
          {!worker.userId && t("app.setWorkers.noLogin")}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {worker.type === "contractor" &&
          (worker.stripeConnectedAccountId ? (
            <span className="text-xs text-green-600 dark:text-green-400">
              {t("app.setWorkers.stripeConnected")}
            </span>
          ) : (
            <button
              onClick={onConnect}
              className="text-xs border border-border rounded-full px-3 py-1.5"
            >
              {t("app.setWorkers.connectStripe")}
            </button>
          ))}
        <button
          onClick={() => setEditing(true)}
          className="text-xs border border-border rounded-full px-3 py-1.5"
        >
          {t("app.action.edit")}
        </button>
      </div>
    </div>
  );
}
