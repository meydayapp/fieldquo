"use client";

// app/components/leave/AccrualPanels.js
//
// The pieces that say what somebody has EARNED, TAKEN and has LEFT, and how —
// shared by the person's own Time off view and the manager's Team balances,
// so the two can never describe the same balance two ways.
//
//   BalanceFigures   earned / taken (in FieldQuo + before FieldQuo) / left,
//                    or, for an unpaid policy, the days taken and nothing else
//   AccrualBasis     "How it's calculated" for an earned-per-hour policy: the
//                    hours counted at each rate, the opening balance, the cap,
//                    and the hours → days conversion — read from
//                    LeaveBalance.accrualBasis, which refreshAccruals writes in
//                    the same upsert as the numbers it explains
//   OpeningSummary   the opening balance in force and every earlier version,
//                    each with who entered it and when
//   OpeningForm      owner/admin: enter or change it (POST /api/leave/opening)
//   OverrideList     a person's own rates under hour-based policies
//   OverrideForm     owner/admin: set one (POST /api/leave/accrual-override)
//
// Nothing here computes a balance. The figures come from GET /api/leave
// (remainingBalance on the server); this file only lays them out.

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { formatDateOnly, isoDateOnly } from "@/lib/format/companyDate";

const n2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const date = (d) => formatDateOnly(d);

export const isHourPolicy = (policy) => policy?.accrualMethod === "per_hours_worked";

/** "4 h per 100 h worked (4%)". */
export function rateLabel(t, hoursEarned, perHoursWorked) {
  const earned = n2(hoursEarned);
  const per = n2(perHoursWorked);
  const percent = per > 0 ? n2((earned / per) * 100) : 0;
  return t("app.leaveAccrual.entitlementRate", { earned, per, percent });
}

// ── Figures ─────────────────────────────────────────────────────────────────

function Row({ label, value, tone = "" }) {
  return (
    <div className={`flex justify-between gap-3 ${tone}`}>
      <span>{label}</span>
      <span className="tabular-nums text-right">{value}</span>
    </div>
  );
}

/**
 * Earned / taken / left for one balance. `balance` is a GET /api/leave row:
 * remainingBalance's fields plus approvedRequestDays, with `policy` included.
 */
export function BalanceFigures({ balance }) {
  const { t } = useTranslation();
  const policy = balance.policy || {};
  const days = (d) => t("app.timeOff.daysCount", { days: n2(d) });

  // Unpaid leave keeps no balance — that is the point of it — so the only true
  // figure is how much was taken. Printing "0 days left" would read as "used
  // up", which is a statement nobody made.
  if (policy.paid === false) {
    const inApp = n2(balance.approvedRequestDays);
    const before = n2(balance.openingUsedDays);
    return (
      <div className="text-xs text-muted-foreground space-y-0.5">
        <Row label={t("app.leaveAccrual.unpaidTaken")} value={days(inApp + before)} tone="text-foreground font-medium" />
        {before > 0 && <Row label={t("app.leaveAccrual.takenBefore")} value={days(before)} />}
      </div>
    );
  }

  const hourBased = isHourPolicy(policy);
  const earnedDays = n2(balance.accruedDays);
  const earned = hourBased
    ? t("app.leaveAccrual.hoursAndDays", { hours: n2(balance.accruedHours), days: earnedDays })
    : days(earnedDays);
  const before = n2(balance.openingUsedDays);
  const inApp = n2(balance.approvedUsedDays ?? balance.usedDays);
  return (
    <div className="text-xs text-muted-foreground space-y-0.5">
      <Row label={t("app.leaveAccrual.earned")} value={earned} />
      {Number(balance.carriedInDays) > 0 && (
        <Row label={t("app.leaveAccrual.carriedIn")} value={days(balance.carriedInDays)} />
      )}
      <Row label={t("app.leaveAccrual.takenInApp")} value={days(inApp)} />
      {before > 0 && <Row label={t("app.leaveAccrual.takenBefore")} value={days(before)} />}
      {Number(balance.pendingDays) > 0 && (
        <Row
          label={t("app.timeOff.awaitingApproval")}
          value={days(balance.pendingDays)}
          tone="text-amber-600 dark:text-amber-400"
        />
      )}
      <Row label={t("app.leaveAccrual.remaining")} value={days(balance.remainingDays)} tone="text-foreground font-semibold" />
    </div>
  );
}

// ── How it's calculated ─────────────────────────────────────────────────────

export function AccrualBasis({ balance }) {
  const { t } = useTranslation();
  const b = balance?.accrualBasis;
  if (!b || b.method !== "per_hours_worked") return null;

  const lines = [];
  if (b.opening) {
    lines.push(
      b.opening.hoursEarned == null
        ? t("app.leaveAccrual.basisOpeningUnrated", { hours: n2(b.opening.hoursWorked), date: date(b.opening.throughDate) })
        : t("app.leaveAccrual.basisOpening", {
            hours: n2(b.opening.hoursWorked),
            date: date(b.opening.throughDate),
            earned: n2(b.opening.hoursEarned),
            per: n2(b.opening.perHoursWorked),
            result: n2(b.opening.earned),
          }),
    );
  }
  for (const p of b.parts || []) {
    let line = t("app.leaveAccrual.basisPart", {
      hours: n2(p.hoursWorked),
      earned: n2(p.hoursEarned),
      per: n2(p.perHoursWorked),
      result: n2(p.earned),
    });
    if (p.source === "override") line += ` — ${t("app.leaveAccrual.ownRate")}`;
    if (p.from) line += ` — ${t("app.leaveAccrual.rateFrom", { date: date(p.from) })}`;
    lines.push(line);
  }
  if (!b.parts?.length) lines.push(t("app.leaveAccrual.basisNoHours"));
  if (b.excludedHours > 0 && b.opening) {
    lines.push(t("app.leaveAccrual.basisExcluded", { hours: n2(b.excludedHours), date: date(b.opening.throughDate) }));
  }
  if (b.unratedHours > 0) lines.push(t("app.leaveAccrual.basisUnrated", { hours: n2(b.unratedHours) }));
  if (b.capped) lines.push(t("app.leaveAccrual.basisCapped", { cap: n2(b.capHours), uncapped: n2(b.uncappedHours) }));
  if (b.hoursPerDay) {
    lines.push(
      t("app.leaveAccrual.basisDays", {
        hours: n2(balance.accruedHours),
        perDay: n2(b.hoursPerDay),
        days: n2(balance.accruedDays),
        source:
          b.hoursPerDaySource === "working_hours"
            ? t("app.leaveAccrual.daySourceWorking")
            : t("app.leaveAccrual.daySourcePolicy"),
      }),
    );
  } else {
    lines.push(t("app.leaveAccrual.basisNoDay"));
  }

  return (
    <details className="mt-2 text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none text-foreground underline underline-offset-2">
        {t("app.leaveAccrual.howCalculated")}
      </summary>
      <ul className="mt-1.5 space-y-1 list-disc pl-4">
        {lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
      <p className="mt-1.5">
        {t("app.leaveAccrual.basisCalculatedAt", { date: date(b.calculatedAt) })}
      </p>
    </details>
  );
}

// ── The opening balance ─────────────────────────────────────────────────────

function OpeningLine({ row, policies, current }) {
  const { t } = useTranslation();
  const nameOf = Object.fromEntries((policies || []).map((p) => [p.id, p.name]));
  const taken = Array.isArray(row.taken) ? row.taken : [];
  return (
    <div className={current ? "text-foreground" : "text-muted-foreground"}>
      <div>{t("app.leaveAccrual.openingSummary", { hours: n2(row.hoursWorked), date: date(row.throughDate) })}</div>
      {taken.length > 0 && (
        <div className="text-xs">
          {taken
            .map((x) => `${nameOf[x.policyId] || t("app.leaveAccrual.retiredPolicy")}: ${t("app.timeOff.daysCount", { days: n2(x.days) })}`)
            .join(" · ")}
        </div>
      )}
      {row.note && <div className="text-xs italic">“{row.note}”</div>}
    </div>
  );
}

/**
 * The opening balance in force (rows[0], newest first) and the trail of
 * every earlier version. `rows` are ONE person's LeaveOpeningBalance rows.
 */
export function OpeningSummary({ rows = [], policies = [], year }) {
  const { t } = useTranslation();
  if (!rows.length) {
    return <p className="text-xs text-muted-foreground">{t("app.leaveAccrual.openingNone", { year })}</p>;
  }
  const [current, ...earlier] = rows;
  const by = (r, first) =>
    t(first ? "app.leaveAccrual.openingEnteredBy" : "app.leaveAccrual.openingChangedBy", {
      name: r.enteredByName || t("app.leaveAccrual.someone"),
      date: date(r.createdAt),
    });
  return (
    <div className="text-sm space-y-1">
      <OpeningLine row={current} policies={policies} current />
      <div className="text-xs text-muted-foreground">{by(current, earlier.length === 0)}</div>
      {earlier.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer select-none text-muted-foreground underline underline-offset-2">
            {t("app.leaveAccrual.openingHistory", { n: earlier.length })}
          </summary>
          <ul className="mt-1 space-y-1.5 border-l border-border pl-3">
            {earlier.map((r, i) => (
              <li key={r.id}>
                <OpeningLine row={r} policies={policies} />
                <div className="text-muted-foreground">{by(r, i === earlier.length - 1)}</div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

const inputCls = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

/** Owner/admin: enter or change one person's opening balance for `year`. */
export function OpeningForm({ workerId, year, current = null, policies = [], onSaved, onCancel }) {
  const { t } = useTranslation();
  const takenOf = (id) => {
    const row = (Array.isArray(current?.taken) ? current.taken : []).find((x) => x.policyId === id);
    return row ? String(row.days) : "";
  };
  const [form, setForm] = useState({
    hoursWorked: current ? String(Number(current.hoursWorked)) : "",
    throughDate: current ? isoDateOnly(current.throughDate) : "",
    note: current?.note || "",
    taken: Object.fromEntries(policies.map((p) => [p.id, takenOf(p.id)])),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await fetchJson("/api/leave/opening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId,
          year,
          hoursWorked: form.hoursWorked,
          throughDate: form.throughDate,
          note: form.note,
          taken: [
            ...Object.entries(form.taken)
              .filter(([, d]) => d !== "")
              .map(([policyId, days]) => ({ policyId, days })),
            // Leave taken under a policy retired since has no box on this
            // form; carried forward unchanged so saving the hours does not
            // silently erase it from the new version.
            ...(Array.isArray(current?.taken) ? current.taken : []).filter(
              (x) => !policies.some((p) => p.id === x.policyId),
            ),
          ],
        }),
      });
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="rounded-lg border border-border bg-background/60 p-3 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">{t("app.leaveAccrual.openingHours", { year })}</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.25"
            required
            value={form.hoursWorked}
            onChange={(e) => setForm({ ...form, hoursWorked: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">{t("app.leaveAccrual.openingThrough")}</span>
          <input
            type="date"
            required
            min={`${year}-01-01`}
            max={`${year}-12-31`}
            value={form.throughDate}
            onChange={(e) => setForm({ ...form, throughDate: e.target.value })}
            className={inputCls}
          />
        </label>
      </div>
      <p className="text-[11px] text-muted-foreground">{t("app.leaveAccrual.openingThroughHint")}</p>

      {policies.length > 0 && (
        <fieldset>
          <legend className="text-xs font-medium text-muted-foreground">{t("app.leaveAccrual.openingTaken")}</legend>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            {policies.map((p) => (
              <label key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-foreground">
                  {p.name}
                  {p.paid === false && <span className="text-muted-foreground"> · {t("app.timeOff.unpaidSuffix")}</span>}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.5"
                  value={form.taken[p.id] ?? ""}
                  onChange={(e) => setForm({ ...form, taken: { ...form.taken, [p.id]: e.target.value } })}
                  aria-label={t("app.leaveAccrual.daysTakenAria", { policy: p.name })}
                  className="w-24 shrink-0 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-right"
                />
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">{t("app.leaveAccrual.openingNote")}</span>
        <input
          value={form.note}
          maxLength={500}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          className={inputCls}
        />
      </label>

      <p className="text-[11px] text-muted-foreground">{t("app.leaveAccrual.openingNotPayroll")}</p>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>
      )}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <button type="button" onClick={onCancel} className="min-h-[44px] rounded-lg border border-border px-4 text-sm">
          {t("app.action.cancel")}
        </button>
        <button
          disabled={busy}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-inverted text-inverted-foreground px-4 text-sm font-medium disabled:opacity-60"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          {t("app.action.save")}
        </button>
      </div>
    </form>
  );
}

// ── A person's own rate ─────────────────────────────────────────────────────

/** One person's LeaveAccrualOverride rows, oldest first, grouped by policy. */
export function OverrideList({ rows = [], policies = [] }) {
  const { t } = useTranslation();
  if (!rows.length) return null;
  const nameOf = Object.fromEntries((policies || []).map((p) => [p.id, p.name]));
  return (
    <ul className="space-y-1 text-xs text-muted-foreground">
      {rows.map((o) => (
        <li key={o.id}>
          <span className="text-foreground">{nameOf[o.policyId] || t("app.leaveAccrual.retiredPolicy")}</span>
          {" · "}
          {o.hoursEarned == null
            ? t("app.leaveAccrual.overrideBack", { date: date(o.effectiveFrom) })
            : t("app.leaveAccrual.overrideRow", {
                rate: rateLabel(t, o.hoursEarned, o.perHoursWorked),
                date: date(o.effectiveFrom),
              })}
          {" · "}
          {t("app.leaveAccrual.overrideBy", { name: o.enteredByName || t("app.leaveAccrual.someone"), date: date(o.createdAt) })}
          {o.note ? <span className="italic"> — “{o.note}”</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** Owner/admin: set one person's rate under an hour-based policy, from a date. */
export function OverrideForm({ workerId, policies = [], onSaved, onCancel }) {
  const { t } = useTranslation();
  const hourPolicies = policies.filter(isHourPolicy);
  const [form, setForm] = useState({
    policyId: hourPolicies[0]?.id || "",
    effectiveFrom: "",
    hoursEarned: "",
    perHoursWorked: "",
    note: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await fetchJson("/api/leave/accrual-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId, ...form }),
      });
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="rounded-lg border border-border bg-background/60 p-3 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">{t("app.leaveAccrual.policyLabel")}</span>
          <select
            value={form.policyId}
            onChange={(e) => setForm({ ...form, policyId: e.target.value })}
            className={inputCls}
          >
            {hourPolicies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {rateLabel(t, p.accrualHoursEarned, p.accrualPerHoursWorked)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">{t("app.leaveAccrual.overrideFrom")}</span>
          <input
            type="date"
            required
            value={form.effectiveFrom}
            onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">{t("app.leaveAccrual.hoursEarned")}</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={form.hoursEarned}
            onChange={(e) => setForm({ ...form, hoursEarned: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">{t("app.leaveAccrual.perHoursWorked")}</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={form.perHoursWorked}
            onChange={(e) => setForm({ ...form, perHoursWorked: e.target.value })}
            className={inputCls}
          />
        </label>
      </div>
      <p className="text-[11px] text-muted-foreground">{t("app.leaveAccrual.overrideBlankHint")}</p>
      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">{t("app.leaveAccrual.openingNote")}</span>
        <input
          value={form.note}
          maxLength={500}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          className={inputCls}
        />
      </label>
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>
      )}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <button type="button" onClick={onCancel} className="min-h-[44px] rounded-lg border border-border px-4 text-sm">
          {t("app.action.cancel")}
        </button>
        <button
          disabled={busy || !form.policyId}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-inverted text-inverted-foreground px-4 text-sm font-medium disabled:opacity-60"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          {t("app.action.save")}
        </button>
      </div>
    </form>
  );
}
