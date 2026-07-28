// app/app/settings/team/payroll/page.js
"use client";

import { useState, useEffect } from "react";
import { reportResponseError } from "@/lib/clientErrors";

export default function PayrollPage() {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [range, setRange] = useState({ periodStart: "", periodEnd: "" });

  useEffect(() => {
    fetch("/api/payouts")
      .then((r) => r.json())
      .then((data) => setPayouts(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  async function runPayouts(e) {
    e.preventDefault();
    setRunning(true);
    const res = await fetch("/api/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(range),
    });
    setRunning(false);
    if (res.ok) {
      const data = await fetch("/api/payouts").then((r) => r.json());
      setPayouts(data);
    } else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
  }

  if (loading)
    return (
      <div className="p-6 max-w-2xl mx-auto animate-pulse h-64 bg-gray-200 rounded-xl" />
    );

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
        <p className="text-sm text-gray-500 mt-1">
          Run contractor payouts for approved hours.
        </p>
      </div>

      <form
        onSubmit={runPayouts}
        className="bg-white border border-gray-200 rounded-xl p-4 flex gap-2 items-end"
      >
        <div>
          <label className="text-xs text-gray-500">Period start</label>
          <input
            type="date"
            required
            value={range.periodStart}
            onChange={(e) =>
              setRange({ ...range, periodStart: e.target.value })
            }
            className="border rounded px-3 py-2 text-sm block"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Period end</label>
          <input
            type="date"
            required
            value={range.periodEnd}
            onChange={(e) => setRange({ ...range, periodEnd: e.target.value })}
            className="border rounded px-3 py-2 text-sm block"
          />
        </div>
        <button
          type="submit"
          disabled={running}
          className="bg-gray-900 text-white px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60"
        >
          {running ? "Running..." : "Run Payouts"}
        </button>
      </form>

      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        {payouts.length === 0 && (
          <p className="px-5 py-6 text-sm text-gray-500">No payouts yet.</p>
        )}
        {payouts.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between px-5 py-3"
          >
            <div>
              <div className="text-sm font-medium text-gray-900">
                {p.worker?.name}
              </div>
              <div className="text-xs text-gray-500">
                {new Date(p.periodStart).toLocaleDateString()} –{" "}
                {new Date(p.periodEnd).toLocaleDateString()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold">
                ${Number(p.amount).toLocaleString()}
              </div>
              <div className="text-xs capitalize text-gray-500">{p.status}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
