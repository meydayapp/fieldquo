"use client";

// app/app/time-off/RequestForm.js
//
// One form, two doors: a person asking for their own time off (Mine), and a
// manager entering somebody's ("Add time off" on the Team view — the same
// POST with `workerId`, which the route creates already approved with the
// manager as reviewer). Same fields, same server checks; the only difference
// is the person picker at the top and the verb on the button.
//
// ── The limits are said before the ask ──────────────────────────────────────
//
// The company's blackout ranges and holiday calendar arrive with the page
// (GET /api/leave → rules, holidays). As the dates change, the form says
// "closed Dec 15 – Jan 5 — Christmas installs" or "2 statutory holidays in
// this range won't count" in place, so the refusal the server would give is
// read before Submit, not after. The server still decides: the cap ("three
// people are already off") needs the live rows and is judged there, and its
// message names who.

import { useMemo, useState } from "react";
import { Info, Loader2, AlertTriangle } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";
import { personOptionLabel } from "@/lib/team/personLabel";
import { blackoutFor } from "@/lib/leave/rules";

function iso(d) {
  return d.toISOString().slice(0, 10);
}

/**
 * @param {object} p
 * @param {Array}  p.policies
 * @param {Array}  p.balances     the requester's balances (own view); [] on behalf
 * @param {object} [p.rules]      { blackouts, maxConcurrent } from the API
 * @param {Array}  [p.holidays]   [{ key, name, observed }]
 * @param {Array}  [p.workers]    when set, the form is a manager's "Add time off"
 */
export default function RequestForm({ policies, balances, rules = null, holidays = [], workers = null, onDone, onCancel }) {
  const money = useCompanyMoney();
  const { t } = useTranslation();
  const today = iso(new Date());
  const onBehalf = Array.isArray(workers);
  const [form, setForm] = useState({
    workerId: onBehalf ? workers[0]?.id || "" : "",
    policyId: policies[0]?.id || "",
    startDate: today,
    endDate: today,
    halfDay: false,
    reason: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const policy = policies.find((p) => p.id === form.policyId);
  const balance = balances.find((b) => b.policyId === form.policyId);
  const sameDay = form.startDate === form.endDate;

  // What the rules say about the picked dates — the same functions the
  // server runs (lib/leave/rules.js), on the rows the page already holds.
  const blackout = useMemo(() => (rules ? blackoutFor(rules, form.startDate, form.endDate) : null), [rules, form.startDate, form.endDate]);
  const holidaysInRange = useMemo(
    () => (holidays || []).filter((h) => h.observed >= form.startDate && h.observed <= form.endDate),
    [holidays, form.startDate, form.endDate],
  );

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const created = await fetchJson("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          workerId: onBehalf ? form.workerId : undefined,
          halfDay: sameDay && form.halfDay,
        }),
      });
      onDone(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-card p-4 space-y-4">
      {onBehalf && (
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">{t("app.timeOff.person")}</span>
          <select
            required
            value={form.workerId}
            onChange={(e) => setForm({ ...form, workerId: e.target.value })}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {personOptionLabel(w)}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">{t("app.timeOff.type")}</span>
          <select
            value={form.policyId}
            onChange={(e) => setForm({ ...form, policyId: e.target.value })}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {policies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.paid === false ? ` (${t("app.timeOff.unpaidSuffix")})` : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          {policy?.paid === false ? (
            <p className="text-xs text-muted-foreground">{t("app.timeOff.unpaidNoBalance")}</p>
          ) : balance ? (
            <p className="text-xs text-muted-foreground">
              {policy?.accrualMethod === "percent_of_gross"
                ? t("app.timeOff.vacationPayAccrued", { amount: money(balance.remainingAmount) })
                : t("app.timeOff.daysAvailable", { days: balance.remainingDays })}
            </p>
          ) : null}
        </div>

        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">{t("app.timeOff.firstDay")}</span>
          <input
            type="date"
            required
            value={form.startDate}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                startDate: e.target.value,
                endDate: f.endDate < e.target.value ? e.target.value : f.endDate,
              }))
            }
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">{t("app.timeOff.lastDay")}</span>
          <input
            type="date"
            required
            min={form.startDate}
            value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>

      {/* The limits, in place. A blackout is the refusal the server will
          give; it is shown as one so nobody types a note for nothing. */}
      {blackout && (
        <p className="flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>
            {t("app.timeOff.blackoutHint", { from: blackout.from, to: blackout.to })}
            {blackout.label ? ` — ${blackout.label}` : ""}
          </span>
        </p>
      )}
      {!blackout && holidaysInRange.length > 0 && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info size={13} className="mt-0.5 shrink-0" />
          <span>
            {t("app.timeOff.holidaysHint", { n: holidaysInRange.length })}{" "}
            {holidaysInRange.map((h) => t(`app.holiday.${h.key}`, h.name)).join(", ")}
          </span>
        </p>
      )}
      {!blackout && rules?.maxConcurrent != null && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info size={13} className="mt-0.5 shrink-0" />
          {t("app.timeOff.maxOffHint", { n: rules.maxConcurrent })}
        </p>
      )}

      {sameDay && (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.halfDay}
            onChange={(e) => setForm({ ...form, halfDay: e.target.checked })}
            className="rounded border-border"
          />
          {t("app.timeOff.halfDayOnly")}
        </label>
      )}

      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">{t("app.timeOff.note")}</span>
        <textarea
          rows={2}
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
          placeholder={t("app.timeOff.notePlaceholder")}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </label>

      {onBehalf ? (
        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <Info size={13} className="mt-0.5 shrink-0" />
          {t("app.timeOff.onBehalfNote")}
        </p>
      ) : (
        policy &&
        !policy.requiresApproval && (
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <Info size={13} className="mt-0.5 shrink-0" />
            {t("app.timeOff.autoApproved")}
          </p>
        )
      )}

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-sm">
          {t("app.action.cancel")}
        </button>
        <button
          disabled={busy || Boolean(blackout)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-inverted text-inverted-foreground px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          {onBehalf ? t("app.timeOff.addForPerson") : t("app.timeOff.submitRequest")}
        </button>
      </div>
    </form>
  );
}
