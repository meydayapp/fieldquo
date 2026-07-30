// app/app/settings/overhead/page.js
"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";

export default function OverheadPage() {
  const [salaries, setSalaries] = useState([]);
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
  });
  const [debtForm, setDebtForm] = useState({
    name: "",
    principal: "",
    monthlyPayment: "",
    interestRate: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/salaries").then((r) => r.json()),
      fetch("/api/debt").then((r) => r.json()),
      fetch("/api/settings/forecast").then((r) => r.json()).catch(() => ({})),
    ]).then(([s, d, f]) => {
      setSalaries(Array.isArray(s) ? s : []);
      setDebts(Array.isArray(d) ? d : []);
      setCapacity(f?.jobsPerWeekCapacity == null ? "" : String(f.jobsPerWeekCapacity));
      setLoading(false);
    });
    loadMinPrice();
  }, []);

  async function loadMinPrice() {
    try {
      const res = await fetch("/api/analytics/minimum-price");
      const data = await res.json();
      // A 400 here is the "no capacity set" answer, not a failure — it carries
      // needsCapacity and a message written for the person reading it.
      setMinPrice(data);
    } catch {
      setMinPrice(null);
    }
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
        await reportResponseError(res, "Couldn't save your capacity.");
      }
    } finally {
      setCapacitySaving(false);
    }
  }

  async function addSalary(e) {
    e.preventDefault();
    const res = await fetch("/api/salaries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...salaryForm,
        amount: Number(salaryForm.amount),
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setSalaries((prev) => [...prev, created]);
      setSalaryForm({ name: "", amount: "", frequency: "monthly" });
    } else {
      // Was silent: a failed request did nothing visible at all.
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
    } else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
  }

  if (loading)
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto animate-pulse h-64 bg-accent rounded-xl" />
    );

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Overhead</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fixed monthly costs. These, divided by how many jobs you can take on,
          are the lowest price a job can go out at and still cover the business.
        </p>
      </div>

      {/* ── Capacity + the minimum price it produces ──────────────────────────
          The number this page always said it fed. It could not be set anywhere,
          so the calculation behind it silently assumed three jobs a week for
          every company on the platform — an invented capacity producing an
          invented price floor. It now refuses to answer without a real one. */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-foreground">Your minimum price</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            How many jobs can your crew take on in a normal week?
          </p>
        </div>

        <form onSubmit={saveCapacity} className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <label className="flex-1">
            <span className="text-xs font-medium text-muted-foreground block mb-1">
              Jobs per week
            </span>
            <input
              type="number"
              min="1"
              max="200"
              step="1"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="not set"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
            />
          </label>
          <button
            disabled={capacitySaving}
            className="rounded-lg bg-inverted text-inverted-foreground px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {capacitySaving ? "Saving…" : "Save"}
          </button>
        </form>

        {minPrice?.needsCapacity && (
          <p className="text-sm text-muted-foreground">{minPrice.error}</p>
        )}

        {minPrice && !minPrice.needsCapacity && !minPrice.error && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            {[
              ["Monthly fixed costs", minPrice.monthlyFixedCosts],
              ["Jobs / month", minPrice.jobsPerMonth],
              ["Cost per job", minPrice.costPerJob],
              ["Minimum price", minPrice.minimumPrice],
            ].map(([label, value], i) => (
              <div key={label} className="rounded-lg border border-border px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {label}
                </div>
                <div
                  className={`text-base font-bold tabular-nums ${i === 3 ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {i === 1
                    ? value
                    : `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                </div>
              </div>
            ))}
          </div>
        )}

        {minPrice && !minPrice.needsCapacity && !minPrice.error && (
          <p className="text-[11px] text-muted-foreground">
            At a {Math.round((minPrice.targetMargin || 0.2) * 100)}% target margin.
            This covers overhead only — materials and labour for the specific job
            are on top.
          </p>
        )}
      </div>

      <div>
        <h2 className="font-semibold text-foreground mb-1">Salaries</h2>
        {/* Said out loud. These rows have no worker attached — buildPayRun reads
            salaries PER WORKER, so an overhead salary is a business cost and
            never lands on anyone's payslip. Two people reasonably read "Salaries"
            on a settings page as "what I pay my staff", and the page owes them
            the distinction. */}
        <p className="text-xs text-muted-foreground mb-3">
          Business overhead only — your own draw, an office wage, anything fixed.
          These are <strong className="text-foreground">not</strong> used to pay
          anyone: an employee&apos;s pay comes from their rate or salary under
          Manage Team, and appears in Payroll.
        </p>
        <div className="space-y-2 mb-3">
          {salaries.map((s) => (
            <div
              key={s.id}
              className="bg-card border border-border rounded-lg p-3 flex justify-between text-sm"
            >
              <span>{s.name}</span>
              <span className="font-semibold">
                ${Number(s.amount).toLocaleString()}/{s.frequency}
              </span>
            </div>
          ))}
        </div>
        <form onSubmit={addSalary} className="flex gap-2">
          <input
            placeholder="Name"
            value={salaryForm.name}
            onChange={(e) =>
              setSalaryForm({ ...salaryForm, name: e.target.value })
            }
            className="border rounded px-3 py-2 text-sm flex-1"
          />
          <input
            type="number"
            placeholder="Amount"
            value={salaryForm.amount}
            onChange={(e) =>
              setSalaryForm({ ...salaryForm, amount: e.target.value })
            }
            className="border rounded px-3 py-2 text-sm w-28"
          />
          <select
            value={salaryForm.frequency}
            onChange={(e) =>
              setSalaryForm({ ...salaryForm, frequency: e.target.value })
            }
            className="border rounded px-2 py-2 text-sm bg-card"
          >
            <option value="weekly">weekly</option>
            <option value="monthly">monthly</option>
            <option value="yearly">yearly</option>
          </select>
          <button
            type="submit"
            className="bg-inverted text-inverted-foreground px-4 rounded-full"
          >
            <Plus size={14} />
          </button>
        </form>
      </div>

      <div>
        <h2 className="font-semibold text-foreground mb-3">Debt</h2>
        <div className="space-y-2 mb-3">
          {debts.map((d) => (
            <div
              key={d.id}
              className="bg-card border border-border rounded-lg p-3 flex justify-between text-sm"
            >
              <span>{d.name}</span>
              <span className="font-semibold">
                ${Number(d.monthlyPayment).toLocaleString()}/mo
              </span>
            </div>
          ))}
        </div>
        <form onSubmit={addDebt} className="grid grid-cols-2 gap-2">
          <input
            placeholder="Name"
            value={debtForm.name}
            onChange={(e) => setDebtForm({ ...debtForm, name: e.target.value })}
            className="border rounded px-3 py-2 text-sm col-span-2"
          />
          <input
            type="number"
            placeholder="Principal"
            value={debtForm.principal}
            onChange={(e) =>
              setDebtForm({ ...debtForm, principal: e.target.value })
            }
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            type="number"
            placeholder="Monthly payment"
            value={debtForm.monthlyPayment}
            onChange={(e) =>
              setDebtForm({ ...debtForm, monthlyPayment: e.target.value })
            }
            className="border rounded px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="col-span-2 bg-inverted text-inverted-foreground py-2 rounded-full text-sm font-semibold"
          >
            Add Debt
          </button>
        </form>
      </div>
    </div>
  );
}
