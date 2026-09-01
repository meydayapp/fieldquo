// app/platform/migrations/page.js
//
// Every company's paid data-migration request. Any platform admin may see
// this list (same "view everything" posture as the audit log); only a
// superadmin can open one and quote/write/cancel it — those gates live on
// the individual API routes, not here.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ArrowUpDown, ChevronRight } from "lucide-react";

const STATUSES = [
  { value: "", label: "All" },
  { value: "requested", label: "Requested" },
  { value: "scheduled", label: "Scheduled" },
  { value: "quoted", label: "Quoted" },
  { value: "accepted", label: "Accepted" },
  { value: "paid", label: "Paid" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "declined", label: "Declined" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_CLASS = {
  requested: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  quoted: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  accepted: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  paid: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  in_progress: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  completed: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  declined: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

export default function PlatformMigrationsPage() {
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const res = await fetch(`/api/platform/migrations?${params}`);
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Failed to load");
      const data = await res.json();
      setRows(data.requests || []);
    } catch (err) {
      setError(err.message);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ArrowUpDown size={20} className="text-muted-foreground" />
          Data migrations
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Requests to bring a company's old records into FieldQuo. Billed through Stripe Billing —
          never Stripe Connect, since this is FieldQuo charging the company.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatus(s.value)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
              status === s.value ? "bg-inverted text-inverted-foreground border-inverted" : "border-border text-muted-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {rows === null ? (
        <Loader2 size={18} className="animate-spin text-muted-foreground" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">No requests here.</p>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {rows.map((r) => (
              <Link
                key={r.id}
                href={`/platform/migrations/${r.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {r.company?.name || "(unknown company)"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.sourceSystems || "No source described yet"}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_CLASS[r.status] || "bg-muted text-muted-foreground"}`}>
                    {r.status.replace("_", " ")}
                  </span>
                  <ChevronRight size={14} className="text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
