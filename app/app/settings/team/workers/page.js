// app/app/settings/team/workers/page.js
"use client";

import { useState, useEffect } from "react";
import { fetchJson } from "@/lib/fetchJson";

export default function WorkersPage() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/workers")
      .then((r) => r.json())
      .then((data) => setWorkers(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  async function connectStripe(workerId) {
    // Was `if (res.ok) window.location.href = data.url` — on failure the
    // button did nothing at all, which reads as a broken page rather than a
    // configuration problem the owner can fix.
    setError("");
    try {
      const data = await fetchJson(`/api/workers/${workerId}/connect`, {
        method: "POST",
      });
      if (!data?.url) throw new Error("Stripe didn't return an onboarding link.");
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
    }
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

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

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
