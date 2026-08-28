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
import { hasToggle, hasLevel } from "@/lib/permissions/enforce";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";

const FIXED_COST_FREQUENCIES = ["weekly", "monthly", "yearly"];

// Why an asset charges nothing this month. Keyed by the `reason` that
// lib/accounting/depreciation.js returns ALONGSIDE the charge, so the sentence
// and the number can never disagree — a $0 with no explanation beside it reads
// as a broken screen rather than as an answer.
//
// English fallbacks, in the shape the rest of this file uses: the catalogue is
// edited separately and a key with no entry falls back to the key itself,
// which is the one thing a contractor must never be shown.
const ASSET_REASON_FALLBACK = {
  not_in_service: "Not in service yet — the charge starts on its in-service date.",
  fully_depreciated: "Fully written down. It's still yours, but it has no cost left to spread.",
  disposed: "Sold or written off — no longer charged.",
  inactive: "Retired from the register — no longer charged.",
  incomplete: "Add what it cost, when it went into service and how long it'll last, and this will start counting.",
};

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
  const caller = usePermissions();
  // The bills panel is a company-wide payables list, so it takes the
  // company-wide expenses level rather than the page's own jobCosting gate —
  // the same rule /api/bills enforces. Null means no grid resolved: show it and
  // let the server refuse, as everywhere else in the app.
  const seesBills = !caller || hasLevel(caller, "expenses", "view_record_edit_all");
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
  // Null until the server answers, never []. An empty array is a claim that
  // there are zero assets, made before anything has been asked — the shape
  // scripts/check-empty-vs-error.mjs exists to stop.
  const [assets, setAssets] = useState(null);
  const [bills, setBills] = useState(null);
  const [billSummary, setBillSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [assetForm, setAssetForm] = useState({
    name: "",
    cost: "",
    salvageValue: "",
    usefulLifeMonths: "",
    inServiceDate: "",
    debtId: "",
  });
  const [billForm, setBillForm] = useState({ category: "", amount: "", dueDate: "" });
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

  // The asset register, reloaded on its own after every asset change. It is
  // fetched separately from the initial load because linking an asset to a
  // loan changes what that LOAN contributes as well as what the asset does,
  // and a list that showed the old link beside a moved price floor would be
  // the screen disagreeing with itself.
  const loadAssets = useCallback(async () => {
    const res = await fetch("/api/assets");
    if (res.ok) setAssets(await res.json());
    else setAssets([]);
  }, []);

  const loadBills = useCallback(async () => {
    const res = await fetch("/api/bills");
    if (res.ok) {
      const data = await res.json();
      setBills(Array.isArray(data.bills) ? data.bills : []);
      setBillSummary(data.summary || null);
    } else {
      setBills([]);
      setBillSummary(null);
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
    loadAssets();
    if (seesBills) loadBills();
  }, [loadMinPrice, loadAssets, loadBills, seesBills]);

  async function addAsset(e) {
    e.preventDefault();
    const res = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: assetForm.name,
        cost: Number(assetForm.cost),
        salvageValue: assetForm.salvageValue === "" ? 0 : Number(assetForm.salvageValue),
        usefulLifeMonths: Number(assetForm.usefulLifeMonths),
        // Sent only when given. An empty string would become "now" on the
        // server anyway, but sending it explicitly would hide that the field
        // was left blank.
        ...(assetForm.inServiceDate ? { inServiceDate: assetForm.inServiceDate } : {}),
        debtId: assetForm.debtId || null,
      }),
    });
    if (res.ok) {
      setAssetForm({
        name: "",
        cost: "",
        salvageValue: "",
        usefulLifeMonths: "",
        inServiceDate: "",
        debtId: "",
      });
      await Promise.all([loadAssets(), loadMinPrice()]);
    } else {
      await reportResponseError(res);
    }
  }

  async function linkAssetDebt(id, debtId) {
    const res = await fetch(`/api/assets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ debtId: debtId || null }),
    });
    if (res.ok) await Promise.all([loadAssets(), loadMinPrice()]);
    else await reportResponseError(res);
  }

  async function disposeAsset(id, disposedOn) {
    const res = await fetch(`/api/assets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disposedOn }),
    });
    if (res.ok) await Promise.all([loadAssets(), loadMinPrice()]);
    else await reportResponseError(res);
  }

  async function removeAsset(id) {
    const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
    if (res.ok) await Promise.all([loadAssets(), loadMinPrice()]);
    else await reportResponseError(res);
  }

  async function addBill(e) {
    e.preventDefault();
    const res = await fetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: billForm.category,
        amount: Number(billForm.amount),
        dueDate: billForm.dueDate,
      }),
    });
    if (res.ok) {
      setBillForm({ category: "", amount: "", dueDate: "" });
      await loadBills();
    } else {
      await reportResponseError(res);
    }
  }

  async function settleBill(id) {
    const res = await fetch(`/api/bills/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid: true }),
    });
    // No loadMinPrice(): settling a bill records that money left, it does not
    // change what the business costs to run. See lib/accounting/bills.js.
    if (res.ok) await loadBills();
    else await reportResponseError(res);
  }

  async function removeBill(id) {
    const res = await fetch(`/api/bills/${id}`, { method: "DELETE" });
    if (res.ok) await loadBills();
    else await reportResponseError(res);
  }

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
  // Comes off the server's own answer, never re-derived here — see the note in
  // lib/analytics/minimumPrice.js. Empty until the price floor has been
  // computed, which is the honest state: without a capacity there is no floor,
  // so nothing has been discounted from one yet.
  const interestOnlyDebtIds = new Set(minPrice?.interestOnlyDebtIds || []);
  const linkableDebts = debts.filter((d) => d.active !== false);

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
              // The DEBT figure in this sentence is what the price floor
              // charges, which is not the same as what leaves the bank: a loan
              // with an asset behind it contributes only its interest, because
              // the depreciation beside it is already carrying the truck. The
              // two are named separately below rather than summed, because a
              // contractor who sees one number has no way to tell which.
              debt: money(minPrice.breakdown.debtChargedInFull),
            })}
          </p>
        )}

        {/* ── Where the capital cost went ───────────────────────────────────
            Depreciation is the line a contractor has never seen on this screen
            and is the one that keeps the floor honest after a loan ends, so it
            is spelled out rather than folded into "fixed costs". */}
        {showFigures && minPrice.breakdown?.depreciation > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {t(
              "app.setOverhead.capitalNote",
              "Plus {depreciation}/mo of depreciation on your assets and {interest}/mo of loan interest. A loan linked to an asset is charged as interest only — the depreciation beside it is already covering what the item cost.",
              {
                depreciation: money(minPrice.breakdown.depreciation),
                interest: money(minPrice.breakdown.debtInterest),
              },
            )}
          </p>
        )}

        {/* Cash and cost are different numbers now, and the runway KPI on
            Settings → Expense Tracking still shows the cash one. Saying so
            here is cheaper than letting somebody find the discrepancy and
            conclude one of the two screens is broken. */}
        {showFigures &&
          minPrice.monthlyCashOut != null &&
          Math.round(minPrice.monthlyCashOut) !== Math.round(minPrice.monthlyFixedCosts) && (
            <p className="text-[11px] text-muted-foreground">
              {t(
                "app.setOverhead.cashVsCostNote",
                "Actual cash leaving the bank is {cash}/mo. It differs because loan payments repay capital, which is not a cost — depreciation is.",
                { cash: money(minPrice.monthlyCashOut) },
              )}
            </p>
          )}

        {/* ── The warning the server refuses to turn into a guess ───────────
            Shown only when an unlinked asset AND an unlinked loan both exist.
            Pairing them automatically — by name, by amount — would move a
            price floor on a string match. */}
        {showFigures && minPrice.doubleCountRisk && (
          <p className="text-[11px] rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-foreground">
            {t(
              "app.setOverhead.doubleCountWarning",
              "You have an asset with no loan linked and a loan with no asset linked. If they're the same truck, you're charging it twice — once as the whole loan payment and once as depreciation. Link them below and the loan will count as interest only.",
            )}
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
              <span className="truncate">
                {d.name}
                {/* Which of the two charges this loan makes to the price
                    floor. Without it the row shows $1,000/mo beside a floor
                    that only counted $80 of it, and the arithmetic on the
                    screen stops adding up. */}
                {interestOnlyDebtIds.has(d.id) ? (
                  <span className="block text-[11px] text-muted-foreground">
                    {t(
                      "app.setOverhead.debtInterestOnly",
                      "Charged to your price floor as interest only — the linked asset's depreciation covers the rest.",
                    )}
                  </span>
                ) : null}
              </span>
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
          {/* ── The field that was being sent and never asked for ────────────
              `interestRate` has been in this form's state and in the POST body
              since the screen was written, with no input anywhere — so every
              debt row in the product holds the default 0. It is asked for now
              because it is the half of a loan payment that IS a cost: an asset
              linked to a loan charges depreciation plus THIS, and with the
              rate at zero that charge is depreciation plus nothing.

              The unit is in the label because the column cannot tell 6.9%
              from 690%, and guessing from the magnitude is how one column
              comes to mean two different things. */}
          <input
            type="number"
            min="0"
            max="100"
            step="0.001"
            placeholder={t("app.setOverhead.interestRate", "Interest rate (% a year)")}
            value={debtForm.interestRate}
            onChange={(e) =>
              setDebtForm({ ...debtForm, interestRate: e.target.value })
            }
            className="border border-border rounded px-3 py-2 text-sm col-span-2 bg-background"
          />
          <button
            type="submit"
            className="col-span-2 bg-inverted text-inverted-foreground py-2 rounded-full text-sm font-semibold"
          >
            {t("app.setOverhead.addDebt")}
          </button>
        </form>
      </div>

      {/* ── Assets & depreciation ──────────────────────────────────────────
          The section the owner's sentence asked for: "i have a truck i still
          pay it is an overhead but it's also an asset that depreciates."

          A truck is not a fixed cost (it was bought once) and it is not a debt
          (it keeps costing after the loan ends). It is the thing the loan
          bought, and the reason a contractor whose loan just ended must NOT
          drop it from their overhead. */}
      <div>
        <h2 className="font-semibold text-foreground mb-1">
          {t("app.setOverhead.assets", "Assets & depreciation")}
        </h2>
        <p className="text-xs text-muted-foreground mb-1">
          {t(
            "app.setOverhead.assetsDesc",
            "Things you bought once and use for years — the truck, the trailer, the spray rig. Spread over their useful life, they're a real monthly cost even after the loan is paid off, because you'll have to replace them.",
          )}
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          {t(
            "app.setOverhead.assetsLinkDesc",
            "If a loan above paid for it, link them. The loan then counts as interest only and the wear counts here — otherwise you'd be charging the same truck twice.",
          )}
        </p>

        <div className="space-y-2 mb-3">
          {assets === null ? (
            <div className="h-12 rounded-lg bg-accent animate-pulse" />
          ) : assets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("app.setOverhead.noAssets", "No assets yet.")}
            </p>
          ) : (
            assets.map((a) => (
              <div
                key={a.id}
                className="bg-card border border-border rounded-lg p-3 space-y-2 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate">{a.name}</span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold tabular-nums">
                      ${Number(a.monthlyDepreciation).toLocaleString()}
                      {t("app.setOverhead.perMo")}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAsset(a.id)}
                      aria-label={t("app.action.remove")}
                      className="text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                </div>

                {/* Why the charge is what it is. A $0 with nothing beside it
                    reads as a broken row; "sold — no longer charged" reads as
                    an answer. The reason is computed by the same function that
                    decides the charge, so the two can never disagree. */}
                {!a.chargeable && (
                  <p className="text-[11px] text-muted-foreground">
                    {t(
                      `app.setOverhead.assetReason.${a.chargeReason}`,
                      ASSET_REASON_FALLBACK[a.chargeReason] || "",
                    )}
                  </p>
                )}

                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {t(
                    "app.setOverhead.assetBookValue",
                    "Cost {cost} · written down {accumulated} so far · worth {book} on the books",
                    {
                      cost: money(a.cost),
                      accumulated: money(a.accumulatedDepreciation),
                      book: money(a.bookValue),
                    },
                  )}
                </p>

                {/* The control that removes the double count, editable after
                    the fact: almost nobody records the asset and the loan in
                    the same sitting. */}
                <label className="block">
                  <span className="text-[11px] text-muted-foreground block mb-1">
                    {t("app.setOverhead.assetLinkDebt", "Bought with which loan?")}
                  </span>
                  <select
                    value={a.debtId || ""}
                    onChange={(e) => linkAssetDebt(a.id, e.target.value)}
                    className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card"
                  >
                    <option value="">
                      {t("app.setOverhead.assetNoDebt", "Paid outright — no loan")}
                    </option>
                    {linkableDebts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>

                {a.disposedOn ? (
                  <button
                    type="button"
                    onClick={() => disposeAsset(a.id, null)}
                    className="text-[11px] underline text-muted-foreground hover:text-foreground"
                  >
                    {t("app.setOverhead.assetUndispose", "Not sold after all — put it back")}
                  </button>
                ) : (
                  // Disposal, not deletion. The months it was in service really
                  // did cost the business money; deleting the row would rewrite
                  // that history, and this stops the charge from a date instead.
                  <button
                    type="button"
                    onClick={() => disposeAsset(a.id, new Date().toISOString())}
                    className="text-[11px] underline text-muted-foreground hover:text-foreground"
                  >
                    {t("app.setOverhead.assetDispose", "Sold or written off today")}
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <form onSubmit={addAsset} className="grid grid-cols-2 gap-2">
          <input
            placeholder={t("app.setOverhead.assetNamePlaceholder", "Truck, trailer, spray rig")}
            value={assetForm.name}
            onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
            className="border border-border rounded px-3 py-2 text-sm col-span-2 bg-background"
          />
          <label className="text-[11px] text-muted-foreground">
            {t("app.setOverhead.assetCost", "What it cost")}
            <input
              type="number"
              min="0"
              step="0.01"
              value={assetForm.cost}
              onChange={(e) => setAssetForm({ ...assetForm, cost: e.target.value })}
              className="w-full border border-border rounded px-3 py-2 text-sm bg-background text-foreground mt-1"
            />
          </label>
          <label className="text-[11px] text-muted-foreground">
            {t("app.setOverhead.assetSalvage", "Worth at trade-in (optional)")}
            <input
              type="number"
              min="0"
              step="0.01"
              value={assetForm.salvageValue}
              onChange={(e) => setAssetForm({ ...assetForm, salvageValue: e.target.value })}
              className="w-full border border-border rounded px-3 py-2 text-sm bg-background text-foreground mt-1"
            />
          </label>
          <label className="text-[11px] text-muted-foreground">
            {/* Months, not years, and no default. Guessing five years for a
                blank field would invent a price floor — see the route. */}
            {t("app.setOverhead.assetLifeMonths", "How many months will it last?")}
            <input
              type="number"
              min="1"
              max="600"
              step="1"
              value={assetForm.usefulLifeMonths}
              onChange={(e) => setAssetForm({ ...assetForm, usefulLifeMonths: e.target.value })}
              className="w-full border border-border rounded px-3 py-2 text-sm bg-background text-foreground mt-1"
            />
          </label>
          <label className="text-[11px] text-muted-foreground">
            {t("app.setOverhead.assetInService", "In service from")}
            <input
              type="date"
              value={assetForm.inServiceDate}
              onChange={(e) => setAssetForm({ ...assetForm, inServiceDate: e.target.value })}
              className="w-full border border-border rounded px-3 py-2 text-sm bg-background text-foreground mt-1"
            />
          </label>
          <label className="text-[11px] text-muted-foreground col-span-2">
            {t("app.setOverhead.assetLinkDebt", "Bought with which loan?")}
            <select
              value={assetForm.debtId}
              onChange={(e) => setAssetForm({ ...assetForm, debtId: e.target.value })}
              className="w-full border border-border rounded px-2 py-2 text-sm bg-card text-foreground mt-1"
            >
              <option value="">
                {t("app.setOverhead.assetNoDebt", "Paid outright — no loan")}
              </option>
              {linkableDebts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="col-span-2 bg-inverted text-inverted-foreground py-2 rounded-full text-sm font-semibold"
          >
            {t("app.setOverhead.addAsset", "Add asset")}
          </button>
        </form>
      </div>

      {/* ── Bills due ──────────────────────────────────────────────────────
          Deliberately not a payment rail — nobody pays Hydro Ottawa from a
          quoting app, and a Pay button that only wrote a timestamp would be a
          control that appears to work and doesn't. What this adds is the state
          a cost has before it is settled, so the month's outgoings can be seen
          coming. See lib/accounting/bills.js. */}
      {seesBills && (
        <div>
          <h2 className="font-semibold text-foreground mb-1">
            {t("app.setOverhead.bills", "Bills due")}
          </h2>
          <p className="text-xs text-muted-foreground mb-1">
            {t(
              "app.setOverhead.billsDesc",
              "What's owed and not yet paid, so you can see what's going out this month. Recording one here doesn't pay it — pay it your usual way, then mark it off.",
            )}
          </p>
          {/* Said out loud, because the section sits under a screen whose whole
              subject is the price floor. A bill is one instance of a cost; the
              recurring pattern above it is what the floor counts. */}
          <p className="text-xs text-muted-foreground mb-3">
            {t(
              "app.setOverhead.billsNotCounted",
              "Bills don't change your minimum price — the recurring cost above already covers that. This is cash flow, not cost.",
            )}
          </p>

          {billSummary && billSummary.outstandingCount > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
              {[
                [t("app.setOverhead.billsOutstanding", "Outstanding"), billSummary.outstanding],
                [t("app.setOverhead.billsDueThisMonth", "Out this month"), billSummary.dueThisMonth],
                [t("app.setOverhead.billsOverdue", "Overdue"), billSummary.overdue],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-border px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {label}
                  </div>
                  <div className="text-base font-bold tabular-nums text-foreground">
                    {money(value)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 mb-3">
            {bills === null ? (
              <div className="h-12 rounded-lg bg-accent animate-pulse" />
            ) : bills.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("app.setOverhead.noBills", "Nothing outstanding.")}
              </p>
            ) : (
              bills.map((b) => (
                <div
                  key={b.id}
                  className="bg-card border border-border rounded-lg p-3 flex items-center justify-between gap-3 text-sm"
                >
                  <span className="truncate">
                    {b.category}
                    <span
                      className={`block text-[11px] ${b.status === "overdue" ? "text-red-600" : "text-muted-foreground"}`}
                    >
                      {b.status === "overdue"
                        ? t("app.setOverhead.billOverdue", "Overdue — was due {date}", {
                            date: new Date(b.dueDate).toLocaleDateString(),
                          })
                        : t("app.setOverhead.billDue", "Due {date}", {
                            date: new Date(b.dueDate).toLocaleDateString(),
                          })}
                    </span>
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold tabular-nums">
                      ${Number(b.amount).toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => settleBill(b.id)}
                      className="text-[11px] underline text-muted-foreground hover:text-foreground"
                    >
                      {t("app.setOverhead.billMarkPaid", "Mark paid")}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeBill(b.id)}
                      aria-label={t("app.action.remove")}
                      className="text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>

          <form onSubmit={addBill} className="flex flex-wrap gap-2">
            <input
              placeholder={t("app.setOverhead.billNamePlaceholder", "Hydro, insurance, supplier")}
              value={billForm.category}
              onChange={(e) => setBillForm({ ...billForm, category: e.target.value })}
              className="border border-border rounded px-3 py-2 text-sm flex-1 min-w-[8rem] bg-background"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder={t("app.setOverhead.amount")}
              value={billForm.amount}
              onChange={(e) => setBillForm({ ...billForm, amount: e.target.value })}
              className="border border-border rounded px-3 py-2 text-sm w-28 bg-background"
            />
            {/* Required, never defaulted to today: the date is the whole point
                of the panel, and an invented one is a date somebody acts on. */}
            <input
              type="date"
              required
              aria-label={t("app.setOverhead.billDueDate", "Due date")}
              value={billForm.dueDate}
              onChange={(e) => setBillForm({ ...billForm, dueDate: e.target.value })}
              className="border border-border rounded px-3 py-2 text-sm bg-background"
            />
            <button
              type="submit"
              className="bg-inverted text-inverted-foreground px-4 rounded-full"
              aria-label={t("app.setOverhead.addBill", "Add bill")}
            >
              <Plus size={14} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
