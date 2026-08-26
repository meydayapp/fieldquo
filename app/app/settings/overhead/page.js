// app/app/settings/overhead/page.js
//
// Settings → Overhead. Everything the business costs to run in a month, and the
// price floor that falls out of it.
//
// Three kinds of cost, because three kinds genuinely exist and collapsing them
// loses information:
//
//   Fixed costs — rent, insurance, the phone bill. A sum, on a repeat.
//   Salaries    — the owner's draw, an office wage. Business overhead, not
//                 anyone's payslip (see the note the section carries).
//   Debt        — the truck loan. A payment WITH a principal and a rate, which
//                 is why it has its own shape.
//
// The screen only had the last two. A lease has no principal and neither does
// an insurance premium, so there was nowhere to put the most ordinary fixed
// cost a contractor has — while the "monthly fixed costs" figure at the top was
// already counting recurring overhead expenses entered on a different screen.
// The total included rows this page neither showed nor let you create.
"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import { SALARY_FREQUENCIES } from "@/lib/overhead/salaryInput";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { hasToggle } from "@/lib/permissions/enforce";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";

const FIXED_COST_FREQUENCIES = ["weekly", "monthly", "yearly"];

function money(n) {
  return `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/**
 * Job costing decides whether this screen exists for you.
 *
 * A separate component rather than an early return inside the editor, because
 * an early return still runs the hooks above it — the five fetches in
 * OverheadEditor's effect would fire, collect five 403s, and render a page
 * assembled from refusals. This way the editor never mounts.
 *
 * QA read COST PER JOB $2,886, a 20% target margin and $12,495 of monthly
 * fixed costs from this page as a Dispatcher with jobCosting:false. The five
 * endpoints behind it now refuse the same person (lib/permissions/costBasis.js);
 * this is the half that stops the browser asking.
 */
export default function OverheadPage() {
  const caller = usePermissions();
  // Null means no provider resolved the grid. Same convention as everywhere
  // else in the app: show it, and let the server refuse.
  if (caller && !hasToggle(caller, "jobCosting")) {
    return <NoAccessPanel capability="jobCosting" />;
  }
  return <OverheadEditor />;
}

function OverheadEditor() {
  const { t } = useTranslation();
  const [salaries, setSalaries] = useState([]);
  const [fixedCosts, setFixedCosts] = useState([]);
  // Capacity and the minimum price it makes possible. The page has always
  // claimed these feed a "minimum-price calculator"; there was no way to set the
  // capacity it needs and no screen that showed the result, so the sentence was
  // describing something that didn't exist.
  const [capacity, setCapacity] = useState("");
  const [capacitySaving, setCapacitySaving] = useState(false);
  const [minPrice, setMinPrice] = useState(null);
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salaryForm, setSalaryForm] = useState({
    name: "",
    amount: "",
    frequency: "monthly",
    hoursPerWeek: "",
  });
  const [fixedForm, setFixedForm] = useState({
    name: "",
    amount: "",
    frequency: "monthly",
  });
  const [debtForm, setDebtForm] = useState({
    name: "",
    principal: "",
    monthlyPayment: "",
    interestRate: "",
  });

  // ── Why every mutation reloads this ────────────────────────────────────────
  //
  // The four figures at the top of the page are the whole reason the three
  // lists below it exist. Adding rent used to leave them showing the old total
  // until a manual refresh, which reads as "that didn't count" — and a price
  // floor that appears not to have moved is worse than no price floor.
  const loadMinPrice = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics/minimum-price");
      const data = await res.json();
      // A 400 here is the "no capacity set" answer, not a failure — it carries
      // needsCapacity and a message written for the person reading it.
      setMinPrice(data);
    } catch {
      setMinPrice(null);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/salaries").then((r) => r.json()),
      fetch("/api/debt").then((r) => r.json()),
      fetch("/api/overhead/fixed-costs").then((r) => r.json()).catch(() => []),
      fetch("/api/settings/forecast").then((r) => r.json()).catch(() => ({})),
    ]).then(([s, d, f, forecast]) => {
      setSalaries(Array.isArray(s) ? s : []);
      setDebts(Array.isArray(d) ? d : []);
      setFixedCosts(Array.isArray(f) ? f : []);
      setCapacity(
        forecast?.jobsPerWeekCapacity == null
          ? ""
          : String(forecast.jobsPerWeekCapacity),
      );
      setLoading(false);
    });
    loadMinPrice();
  }, [loadMinPrice]);

  async function saveCapacity(e) {
    e.preventDefault();
    setCapacitySaving(true);
    try {
      const res = await fetch("/api/settings/forecast", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobsPerWeekCapacity: capacity === "" ? null : Number(capacity) }),
      });
      if (res.ok) {
        await loadMinPrice();
      } else {
        await reportResponseError(res, t("app.setOverhead.saveCapacityError"));
      }
    } finally {
      setCapacitySaving(false);
    }
  }

  async function addFixedCost(e) {
    e.preventDefault();
    const res = await fetch("/api/overhead/fixed-costs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fixedForm.name,
        amount: Number(fixedForm.amount),
        frequency: fixedForm.frequency,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setFixedCosts((prev) => [created, ...prev]);
      setFixedForm({ name: "", amount: "", frequency: "monthly" });
      await loadMinPrice();
    } else {
      await reportResponseError(res);
    }
  }

  async function removeFixedCost(id) {
    const res = await fetch(`/api/overhead/fixed-costs/${id}`, { method: "DELETE" });
    if (res.ok) {
      setFixedCosts((prev) => prev.filter((f) => f.id !== id));
      await loadMinPrice();
    } else {
      await reportResponseError(res);
    }
  }

  async function addSalary(e) {
    e.preventDefault();
    const res = await fetch("/api/salaries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: salaryForm.name,
        amount: Number(salaryForm.amount),
        frequency: salaryForm.frequency,
        // Sent only for hourly. The server rejects an hourly row without it
        // rather than assuming a working week.
        hoursPerWeek:
          salaryForm.frequency === "hourly"
            ? Number(salaryForm.hoursPerWeek)
            : null,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setSalaries((prev) => [...prev, created]);
      setSalaryForm({ name: "", amount: "", frequency: "monthly", hoursPerWeek: "" });
      await loadMinPrice();
    } else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
  }

  async function removeSalary(id) {
    const res = await fetch(`/api/salaries/${id}`, { method: "DELETE" });
    if (res.ok) {
      setSalaries((prev) => prev.filter((s) => s.id !== id));
      await loadMinPrice();
    } else {
      await reportResponseError(res);
    }
  }

  async function addDebt(e) {
    e.preventDefault();
    const res = await fetch("/api/debt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...debtForm,
        principal: Number(debtForm.principal),
        monthlyPayment: Number(debtForm.monthlyPayment),
        interestRate: Number(debtForm.interestRate || 0),
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setDebts((prev) => [...prev, created]);
      setDebtForm({
        name: "",
        principal: "",
        monthlyPayment: "",
        interestRate: "",
      });
      await loadMinPrice();
    } else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
  }

  async function removeDebt(id) {
    const res = await fetch(`/api/debt/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDebts((prev) => prev.filter((d) => d.id !== id));
      await loadMinPrice();
    } else {
      await reportResponseError(res);
    }
  }

  if (loading)
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto animate-pulse h-64 bg-accent rounded-xl" />
    );

  const showFigures = minPrice && !minPrice.needsCapacity && !minPrice.error;

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("app.setOverhead.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.setOverhead.subtitle")}
        </p>
      </div>

      {/* ── Capacity + the minimum price it produces ──────────────────────────
          The number this page always said it fed. It could not be set anywhere,
          so the calculation behind it silently assumed three jobs a week for
          every company on the platform — an invented capacity producing an
          invented price floor. It now refuses to answer without a real one. */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-foreground">{t("app.setOverhead.minPriceTitle")}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("app.setOverhead.minPriceDesc")}
          </p>
        </div>

        <form onSubmit={saveCapacity} className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <label className="flex-1">
            <span className="text-xs font-medium text-muted-foreground block mb-1">
              {t("app.setOverhead.jobsPerWeek")}
            </span>
            <input
              type="number"
              min="1"
              max="200"
              step="1"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder={t("app.setOverhead.notSet")}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
            />
          </label>
          <button
            disabled={capacitySaving}
            className="rounded-lg bg-inverted text-inverted-foreground px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {capacitySaving ? t("app.action.saving") : t("app.action.save")}
          </button>
        </form>

        {minPrice?.needsCapacity && (
          <p className="text-sm text-muted-foreground">{minPrice.error}</p>
        )}

        {showFigures && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            {[
              [t("app.setOverhead.monthlyFixedCosts"), minPrice.monthlyFixedCosts],
              [t("app.setOverhead.jobsPerMonth"), minPrice.jobsPerMonth],
              [t("app.setOverhead.costPerJob"), minPrice.costPerJob],
              [t("app.setOverhead.minimumPrice"), minPrice.minimumPrice],
            ].map(([label, value], i) => (
              <div key={label} className="rounded-lg border border-border px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {label}
                </div>
                <div
                  className={`text-base font-bold tabular-nums ${i === 3 ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {i === 1 ? value : money(value)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Where the total came from. Without it a contractor who thinks the
            monthly figure looks wrong has no way to tell which of the three
            lists below is responsible. */}
        {showFigures && minPrice.breakdown && (
          <p className="text-[11px] text-muted-foreground">
            {t("app.setOverhead.breakdownNote", {
              fixed: money(minPrice.breakdown.overhead),
              salaries: money(minPrice.breakdown.salaries),
              debt: money(minPrice.breakdown.debt),
            })}
          </p>
        )}

        {showFigures && (
          <p className="text-[11px] text-muted-foreground">
            {t("app.setOverhead.marginNote", {
              pct: Math.round((minPrice.targetMargin || 0.2) * 100),
            })}
          </p>
        )}
      </div>

      {/* ── Fixed costs ────────────────────────────────────────────────────────
          The section that was missing. These are stored as recurring overhead
          expenses, which is the record the burn-rate calculation has always
          counted — so a row added here moves the figures above immediately, and
          shows up in Settings → Expense Tracking as the same one row rather
          than a second copy. */}
      <div>
        <h2 className="font-semibold text-foreground mb-1">
          {t("app.setOverhead.fixedCosts")}
        </h2>
        <p className="text-xs text-muted-foreground mb-3">
          {t("app.setOverhead.fixedCostsDesc")}
        </p>
        <div className="space-y-2 mb-3">
          {fixedCosts.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("app.setOverhead.noFixedCosts")}
            </p>
          )}
          {fixedCosts.map((f) => (
            <div
              key={f.id}
              className="bg-card border border-border rounded-lg p-3 flex items-center justify-between gap-3 text-sm"
            >
              <span className="truncate">
                {f.category}
                {/* A recurring overhead expense saved as one-off from Settings →
                    Expense Tracking is counted as $0 a month by the burn-rate
                    calculation. It is still a row this list has to show — but
                    silently showing it under a total it contributes nothing to
                    is how a screen ends up lying about its own arithmetic. */}
                {!FIXED_COST_FREQUENCIES.includes(f.frequency) && (
                  <span className="block text-[11px] text-muted-foreground">
                    {t("app.setOverhead.notCounted")}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-3 shrink-0">
                <span className="font-semibold tabular-nums">
                  ${Number(f.amount).toLocaleString()}/
                  {t(`app.setOverhead.${f.frequency}`, f.frequency)}
                </span>
                <button
                  type="button"
                  onClick={() => removeFixedCost(f.id)}
                  aria-label={t("app.action.remove")}
                  className="text-muted-foreground hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </span>
            </div>
          ))}
        </div>
        <form onSubmit={addFixedCost} className="flex flex-wrap gap-2">
          <input
            placeholder={t("app.setOverhead.fixedCostNamePlaceholder")}
            value={fixedForm.name}
            onChange={(e) => setFixedForm({ ...fixedForm, name: e.target.value })}
            className="border border-border rounded px-3 py-2 text-sm flex-1 min-w-[8rem] bg-background"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder={t("app.setOverhead.amount")}
            value={fixedForm.amount}
            onChange={(e) => setFixedForm({ ...fixedForm, amount: e.target.value })}
            className="border border-border rounded px-3 py-2 text-sm w-28 bg-background"
          />
          <select
            value={fixedForm.frequency}
            onChange={(e) =>
              setFixedForm({ ...fixedForm, frequency: e.target.value })
            }
            className="border border-border rounded px-2 py-2 text-sm bg-card"
          >
            {FIXED_COST_FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {t(`app.setOverhead.${f}`)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="bg-inverted text-inverted-foreground px-4 rounded-full"
            aria-label={t("app.setOverhead.addFixedCost")}
          >
            <Plus size={14} />
          </button>
        </form>
      </div>

      <div>
        <h2 className="font-semibold text-foreground mb-1">{t("app.setOverhead.salaries")}</h2>
        {/* Said out loud. These rows have no worker attached — buildPayRun reads
            salaries PER WORKER, so an overhead salary is a business cost and
            never lands on anyone's payslip. Two people reasonably read "Salaries"
            on a settings page as "what I pay my staff", and the page owes them
            the distinction. */}
        <p className="text-xs text-muted-foreground mb-1">
          {t("app.setOverhead.salariesDesc1")}
          <strong className="text-foreground">{t("app.setOverhead.salariesDescNot")}</strong>
          {t("app.setOverhead.salariesDesc2")}
        </p>
        {/* The hourly option is here because plenty of overhead IS hourly — the
            bookkeeper who does eight hours a week. A CREW member's hourly rate
            is a different thing and must not be copied in: it is already
            charged to each job as labour, so it would be counted twice. */}
        <p className="text-xs text-muted-foreground mb-3">
          {t("app.setOverhead.salariesHourlyNote")}
        </p>
        <div className="space-y-2 mb-3">
          {salaries.map((s) => (
            <div
              key={s.id}
              className="bg-card border border-border rounded-lg p-3 flex items-center justify-between gap-3 text-sm"
            >
              <span className="truncate">{s.name}</span>
              <span className="flex items-center gap-3 shrink-0">
                <span className="font-semibold tabular-nums">
                  ${Number(s.amount).toLocaleString()}/
                  {t(`app.setOverhead.${s.frequency}`, s.frequency)}
                  {/* The hours are half the number: $25/hr means nothing on its
                      own, and the row would look identical to a $25 monthly
                      salary without them. */}
                  {s.frequency === "hourly" && s.hoursPerWeek != null
                    ? ` · ${Number(s.hoursPerWeek)} ${t("app.setOverhead.hoursShort")}`
                    : ""}
                </span>
                <button
                  type="button"
                  onClick={() => removeSalary(s.id)}
                  aria-label={t("app.action.remove")}
                  className="text-muted-foreground hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </span>
            </div>
          ))}
        </div>
        <form onSubmit={addSalary} className="flex flex-wrap gap-2">
          <input
            placeholder={t("app.field.name")}
            value={salaryForm.name}
            onChange={(e) =>
              setSalaryForm({ ...salaryForm, name: e.target.value })
            }
            className="border border-border rounded px-3 py-2 text-sm flex-1 min-w-[8rem] bg-background"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder={
              salaryForm.frequency === "hourly"
                ? t("app.setOverhead.ratePerHour")
                : t("app.setOverhead.amount")
            }
            value={salaryForm.amount}
            onChange={(e) =>
              setSalaryForm({ ...salaryForm, amount: e.target.value })
            }
            className="border border-border rounded px-3 py-2 text-sm w-28 bg-background"
          />
          <select
            value={salaryForm.frequency}
            onChange={(e) =>
              setSalaryForm({ ...salaryForm, frequency: e.target.value })
            }
            className="border border-border rounded px-2 py-2 text-sm bg-card"
          >
            {SALARY_FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {t(`app.setOverhead.${f}`)}
              </option>
            ))}
          </select>
          {/* Only for hourly, and required there. A rate without hours cannot
              be turned into a monthly cost, and the server refuses rather than
              assuming a 40-hour week. */}
          {salaryForm.frequency === "hourly" && (
            <input
              type="number"
              min="0"
              max="168"
              step="0.5"
              required
              placeholder={t("app.setOverhead.hoursPerWeek")}
              value={salaryForm.hoursPerWeek}
              onChange={(e) =>
                setSalaryForm({ ...salaryForm, hoursPerWeek: e.target.value })
              }
              className="border border-border rounded px-3 py-2 text-sm w-28 bg-background"
            />
          )}
          <button
            type="submit"
            className="bg-inverted text-inverted-foreground px-4 rounded-full"
            aria-label={t("app.action.add")}
          >
            <Plus size={14} />
          </button>
        </form>
      </div>

      <div>
        <h2 className="font-semibold text-foreground mb-1">{t("app.setOverhead.debt")}</h2>
        {/* Points at the fixed-costs section above. The owner tried to enter
            rent here, because Debt was the only place on the screen that took a
            recurring payment — and then had to invent a principal for a lease
            that has none. */}
        <p className="text-xs text-muted-foreground mb-3">
          {t("app.setOverhead.debtDesc")}
        </p>
        <div className="space-y-2 mb-3">
          {debts.map((d) => (
            <div
              key={d.id}
              className="bg-card border border-border rounded-lg p-3 flex items-center justify-between gap-3 text-sm"
            >
              <span className="truncate">{d.name}</span>
              <span className="flex items-center gap-3 shrink-0">
                <span className="font-semibold tabular-nums">
                  ${Number(d.monthlyPayment).toLocaleString()}
                  {t("app.setOverhead.perMo")}
                </span>
                <button
                  type="button"
                  onClick={() => removeDebt(d.id)}
                  aria-label={t("app.action.remove")}
                  className="text-muted-foreground hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </span>
            </div>
          ))}
        </div>
        <form onSubmit={addDebt} className="grid grid-cols-2 gap-2">
          <input
            placeholder={t("app.field.name")}
            value={debtForm.name}
            onChange={(e) => setDebtForm({ ...debtForm, name: e.target.value })}
            className="border border-border rounded px-3 py-2 text-sm col-span-2 bg-background"
          />
          <input
            type="number"
            placeholder={t("app.setOverhead.principal")}
            value={debtForm.principal}
            onChange={(e) =>
              setDebtForm({ ...debtForm, principal: e.target.value })
            }
            className="border border-border rounded px-3 py-2 text-sm bg-background"
          />
          <input
            type="number"
            placeholder={t("app.setOverhead.monthlyPayment")}
            value={debtForm.monthlyPayment}
            onChange={(e) =>
              setDebtForm({ ...debtForm, monthlyPayment: e.target.value })
            }
            className="border border-border rounded px-3 py-2 text-sm bg-background"
          />
          <button
            type="submit"
            className="col-span-2 bg-inverted text-inverted-foreground py-2 rounded-full text-sm font-semibold"
          >
            {t("app.setOverhead.addDebt")}
          </button>
        </form>
      </div>
    </div>
  );
}
