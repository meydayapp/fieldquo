// app/platform/migrations/page.js
//
// Every company's paid data-migration request. Any platform admin may see
// this list (same "view everything" posture as the audit log); only a
// superadmin can open one and quote/write/cancel it — those gates live on
// the individual API routes, not here.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, ArrowUpDown, ChevronRight } from "lucide-react";
import { MIGRATION_STATUSES, describeStatus } from "@/lib/migrations/state";

// Built from the state machine rather than typed out beside it. The nine
// values were duplicated here and a tenth added to MigrationRequestStatus would
// have gone on being unfilterable and unnamed — the copy is the one that rots.
// Capitalised for a button; describeStatus owns the words themselves.
const STATUSES = [
  { value: "", label: "All" },
  ...MIGRATION_STATUSES.map((value) => {
    const words = describeStatus(value);
    return { value, label: words.charAt(0).toUpperCase() + words.slice(1) };
  }),
];

// Green means one thing on this list and one thing only: canWrite() is true,
// so a superadmin may create rows inside that company's own tenant right now.
// It used to also cover `completed`, where writes are closed — three states in
// one colour on the only screen in the product where that distinction is the
// whole safety story. Completed is finished work, and reads as finished.
const STATUS_CLASS = {
  requested: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  quoted: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  accepted: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  paid: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  in_progress: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  completed: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200",
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
      setRows(null);
      const res = await fetch(`/api/platform/migrations?${params}`);
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Failed to load");
      const data = await res.json();
      setRows(data.requests || []);
    } catch (err) {
      // `rows === null` is the LOADING state below, so a failure used to leave
      // a spinner turning for ever above the error banner. `failed` is its own
      // state now — a company that has paid for a migration and is waiting on
      // one must not be indistinguishable from a slow request.
      setRows("failed");
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
      ) : rows === "failed" ? (
        <div className="py-10 text-center text-sm text-muted-foreground space-y-2">
          <AlertCircle size={22} className="mx-auto" />
          <p>
            The requests could not be read. There may well be a company waiting
            on a migration — nothing has been cancelled.
          </p>
          <button
            onClick={load}
            className="text-sm font-semibold text-foreground underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">
          {/* "No requests are requested." is what naming the filter with the
              verb produced. The chip's own label reads as a bucket. */}
          {status
            ? `No requests in “${STATUSES.find((s) => s.value === status)?.label}”.`
            : "No company has asked for a data migration yet."}
        </p>
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
                  {/* describeStatus, not a local replace(): the underscore
                      swap named eight of the nine states by luck and would
                      print a tenth raw. A value the state machine does not
                      know says so rather than being tidied into a word. */}
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_CLASS[r.status] || "bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-200"}`}>
                    {MIGRATION_STATUSES.includes(r.status)
                      ? describeStatus(r.status)
                      : `unrecognised: ${r.status}`}
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
