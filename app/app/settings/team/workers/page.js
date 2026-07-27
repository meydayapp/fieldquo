// app/app/settings/team/workers/page.js
"use client";

import { useState, useEffect } from "react";

export default function WorkersPage() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/workers")
      .then((r) => r.json())
      .then((data) => setWorkers(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  async function connectStripe(workerId) {
    const res = await fetch(`/api/workers/${workerId}/connect`, {
      method: "POST",
    });
    const data = await res.json();
    if (res.ok) window.location.href = data.url;
  }

  if (loading)
    return (
      <div className="p-6 max-w-2xl mx-auto animate-pulse h-64 bg-gray-200 rounded-xl" />
    );

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Workers</h1>
        <p className="text-sm text-gray-500 mt-1">
          Employees and contractors, and their payout status.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        {workers.map((w) => (
          <div
            key={w.id}
            className="flex items-center justify-between px-5 py-3"
          >
            <div>
              <div className="text-sm font-medium text-gray-900">{w.name}</div>
              <div className="text-xs text-gray-500 capitalize">
                {w.type}
                {w.hourlyRate ? ` · $${w.hourlyRate}/hr` : ""}
              </div>
            </div>
            {w.type === "contractor" &&
              (w.stripeConnectedAccountId ? (
                <span className="text-xs text-green-600">Stripe connected</span>
              ) : (
                <button
                  onClick={() => connectStripe(w.id)}
                  className="text-xs border border-gray-300 rounded-full px-3 py-1.5"
                >
                  Connect Stripe
                </button>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
