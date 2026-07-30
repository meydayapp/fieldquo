// app/app/settings/team/timesheets/page.js
"use client";

import { useState, useEffect } from "react";
import { reportResponseError } from "@/lib/clientErrors";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";

import { useTranslation } from "@/app/hooks/useTranslation";
export default function TimesheetsPage() {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();
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
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("app.timesheets.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.timesheets.subtitle")}
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        {entries.length === 0 && (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            {t("app.timesheets.empty")}
          </p>
        )}
        {entries.map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between px-5 py-3"
          >
            <div>
              <div className="text-sm font-medium text-foreground">
                {e.worker?.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDate(e.clockIn)} ·{" "}
                {e.hours ? `${e.hours}h` : "In progress"}
              </div>
            </div>
            {e.status === "pending" && e.hours ? (
              <button
                onClick={() => approve(e.id)}
                className="text-xs bg-inverted text-inverted-foreground px-3 py-1.5 rounded-full"
              >
                {t("app.timesheets.approve")}
              </button>
            ) : (
              <span className="text-xs capitalize text-muted-foreground">
                {e.status}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
