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
import { eligibleManagers } from "@/lib/org/reportingLine";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";
import { formatDateOnly, isoDateOnly } from "@/lib/format/companyDate";
// Same as-you-type formatter the invite form uses, so a number typed on either
// screen ends up looking and normalising the same way.
import { formatPhoneInput } from "@/lib/validation";
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
            workers={workers}
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

function WorkerRow({ worker, workers = [], reload, onConnect }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: worker.name || "",
    phone: worker.phone || "",
    hourlyRate: worker.hourlyRate == null ? "" : String(worker.hourlyRate),
    hiredOn: dateInput(worker.hiredOn),
    active: worker.active !== false,
    managerId: worker.managerId || "",
    // Where their time COSTS the business, which is a different question from
    // `worker.type` (how they're paid). Absent reads as "field" — the same
    // reading validateWorkProfile makes, for the same reason: every row that
    // predates the column was made by a screen that only added people to do
    // jobs. See lib/team/workProfile.js.
    workType: worker.workType === "office" ? "office" : "field",
    // "" is the honest state, not zero and never 40: it means they're paid
    // only for the hours they log, and inventing a week here would invent
    // unabsorbed labour for somebody who has none.
    scheduledHoursPerWeek:
      worker.scheduledHoursPerWeek == null
        ? ""
        : String(worker.scheduledHoursPerWeek),
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
          // "" clears the mobile back to unset, which is a real state: it means
          // the crew inbox stops recognising that person's texts, and the
          // prompt to add one comes back rather than silently matching nothing.
          phone: form.phone.trim() === "" ? null : form.phone,
          // "" clears the rate back to unset, which is a real state — it means
          // payroll warns instead of paying a made-up number.
          hourlyRate: form.hourlyRate === "" ? null : Number(form.hourlyRate),
          hiredOn: form.hiredOn,
          active: form.active,
          // "" clears the reporting line back to "top of the chain", which is
          // the right state for an owner and for any company that has never
          // drawn one.
          managerId: form.managerId || null,
          workType: form.workType,
          // "" clears the guaranteed week back to unset, which is a real
          // state: it means utilisation has no gap to report for this person
          // rather than a gap of zero.
          scheduledHoursPerWeek:
            form.scheduledHoursPerWeek === ""
              ? null
              : Number(form.scheduledHoursPerWeek),
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
          {/* ── Mobile ────────────────────────────────────────────────────
              The number the crew inbox matches an inbound text against. It was
              writable exactly once, on the invite form, and nowhere after —
              while /app/crew-inbox told people to "add your own mobile to your
              staff profile so the inbox recognises your texts". An owner whose
              worker record predates the field read an instruction with nowhere
              to carry it out, and their own site photos kept landing in the
              "numbers not on your team" pile. */}
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              {t("app.setWorkers.mobile")}
            </span>
            <input
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(e) =>
                setForm({ ...form, phone: formatPhoneInput(e.target.value) })
              }
              placeholder={t("app.setWorkers.notSet")}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              {t("app.setWorkers.mobileHint")}
            </span>
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
          {/* Who this person reports to.
              Leave requests go to the direct manager, and past them to THEIR
              manager when they are away. Anyone who already reports to this
              worker is left out of the list rather than offered and then
              refused — a cycle makes requests unroutable, and the walk that
              survives one is a backstop, not a licence to create them. */}
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              Reports to
            </span>
            <select
              value={form.managerId}
              onChange={(e) => setForm({ ...form, managerId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Nobody — top of the chain</option>
              {eligibleManagers(worker.id, workers).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Their time-off requests go here first, and to this person&apos;s
              own manager if they are away.
            </span>
          </label>
          {/* ── Where their time lands ──────────────────────────────────────
              The pair that lib/costing/utilisation.js reads. Deliberately two
              controls rather than one three-option list: a fitter guaranteed
              37.5 hours who bills 28 is a field worker whose last 9.5 hours
              behave like overhead, and no single dropdown can say that. */}
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              {t("app.setWorkers.workType")}
            </span>
            <select
              value={form.workType}
              onChange={(e) => setForm({ ...form, workType: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="field">{t("app.setWorkers.workTypeField")}</option>
              <option value="office">{t("app.setWorkers.workTypeOffice")}</option>
            </select>
            <span className="mt-1 block text-[11px] text-muted-foreground">
              {t("app.setWorkers.workTypeHint")}
            </span>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              {t("app.setWorkers.scheduledHours")}
            </span>
            <input
              type="number"
              min="0"
              max="168"
              step="0.5"
              value={form.scheduledHoursPerWeek}
              onChange={(e) =>
                setForm({ ...form, scheduledHoursPerWeek: e.target.value })
              }
              placeholder="37.5"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              {t("app.setWorkers.scheduledHoursHint")}
            </span>
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
          {/* Shown only when it is the non-obvious answer. "field" is what
              every pre-existing row means, so printing it on everybody would
              be noise; "runs the business" changes how their time is costed
              and has to be visible without opening the editor. */}
          {worker.workType === "office" && t("app.setWorkers.officeMeta")}
          {/* Absent means "paid for the hours they log", which is a real
              answer and not a zero-hour week — so nothing is printed for it. */}
          {worker.scheduledHoursPerWeek != null &&
            t("app.setWorkers.guaranteedWeek", {
              hours: Number(worker.scheduledHoursPerWeek),
            })}
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
