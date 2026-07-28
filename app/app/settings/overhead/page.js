// app/app/settings/overhead/page.js
"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";

export default function OverheadPage() {
  const [salaries, setSalaries] = useState([]);
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
    ]).then(([s, d]) => {
      setSalaries(Array.isArray(s) ? s : []);
      setDebts(Array.isArray(d) ? d : []);
      setLoading(false);
    });
  }, []);

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
      <div className="p-6 max-w-2xl mx-auto animate-pulse h-64 bg-accent rounded-xl" />
    );

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Overhead</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Salaries and debt payments feed your burn rate and minimum-price
          calculators.
        </p>
      </div>

      <div>
        <h2 className="font-semibold text-foreground mb-3">Salaries</h2>
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
