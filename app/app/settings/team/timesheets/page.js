// app/app/settings/team/timesheets/page.js
"use client";

import { useState, useEffect } from "react";

export default function TimesheetsPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/time-entries")
      .then((r) => r.json())
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  async function approve(id) {
    const res = await fetch(`/api/time-entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    if (res.ok) {
      const updated = await res.json();
      setEntries((prev) =>
        prev.map((e) => (e.id === updated.id ? updated : e)),
      );
    }
  }

  if (loading)
    return (
      <div className="p-6 max-w-2xl mx-auto animate-pulse h-64 bg-gray-200 rounded-xl" />
    );

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Timesheets</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review and approve logged hours.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        {entries.length === 0 && (
          <p className="px-5 py-6 text-sm text-gray-500">
            No time entries yet.
          </p>
        )}
        {entries.map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between px-5 py-3"
          >
            <div>
              <div className="text-sm font-medium text-gray-900">
                {e.worker?.name}
              </div>
              <div className="text-xs text-gray-500">
                {new Date(e.clockIn).toLocaleDateString()} ·{" "}
                {e.hours ? `${e.hours}h` : "In progress"}
              </div>
            </div>
            {e.status === "pending" && e.hours ? (
              <button
                onClick={() => approve(e.id)}
                className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-full"
              >
                Approve
              </button>
            ) : (
              <span className="text-xs capitalize text-gray-500">
                {e.status}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
