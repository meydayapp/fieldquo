// app/platform/audit-log/page.js
//
// "Who changed this, and when?" — the screen you open when a customer says
// something happened that nobody remembers doing.
//
// Impersonation entries are visually distinct because they're the ones that
// matter most: they're the moments a staff member had access to a customer's
// real client data, and the entry is the only record that it happened.
//
// That sentence was FALSE for as long as this page existed. The amber rule was
// keyed on the action `impersonate`, which nothing writes — the real values are
// `impersonation_started` and `impersonation_ended` — so the class of entry the
// screen was designed around rendered in the same grey as everything else, with
// the generic icon, labelled "impersonation started" by a fallback that
// replaced underscores with spaces. Four more of the thirty-six actions this
// product writes were named here; the rest had no wording at all. The map now
// lives in lib/platform/auditActions.js, where check:platform-truth holds it to
// what the routes actually write, in both directions.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  ScrollText,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  LogIn,
  Ban,
  Pencil,
  Plus,
  Building2,
  HelpCircle,
} from "lucide-react";
import { describeAuditAction } from "@/lib/platform/auditActions";

// The palette lives here and the vocabulary lives in the module, so the check
// can import the vocabulary without a bare-node parser meeting a class list.
// Each tone is a class of thing somebody scans this table for; see that file.
const TONES = {
  access: {
    Icon: LogIn,
    className:
      "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  },
  tenant: {
    Icon: Building2,
    className:
      "bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-900",
  },
  danger: {
    Icon: Ban,
    className:
      "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900",
  },
  good: {
    Icon: Plus,
    className:
      "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
  },
  neutral: { Icon: Pencil, className: "bg-muted text-foreground border-border" },
  // Purple, not grey, for the same reason subscriptionStatus.js uses purple:
  // an action the log can hold and this console cannot name is a bug, and the
  // grey fallback it used to get is precisely what hid the impersonation rows.
  unknown: {
    Icon: HelpCircle,
    className:
      "bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-900",
  },
};

function meta(action) {
  const { label, tone } = describeAuditAction(action);
  return { label, ...(TONES[tone] || TONES.unknown) };
}

function formatWhen(value) {
  const d = new Date(value);
  return d.toLocaleString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AuditLogPage() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [adminId, setAdminId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (action) params.set("action", action);
      if (adminId) params.set("adminId", adminId);

      const res = await fetch(`/api/platform/audit-log?${params}`);
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.error || `Request failed (${res.status}).`);
      }
      setData(await res.json());
    } catch (err) {
      // The failed load REPLACES the rows. Leaving the old payload here made
      // the empty state below fire on a failure, so a request that never
      // arrived rendered as "Nothing logged yet" — a claim that no member of
      // staff has ever touched a customer's account, printed under a red
      // banner saying we could not find out.
      setData(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, action, adminId]);

  useEffect(() => {
    load();
  }, [load]);

  // Changing a filter should return to page 1 — staying on page 4 of a
  // narrower result set usually shows nothing and looks broken.
  function changeFilter(setter, value) {
    setter(value);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Audit log</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every action platform staff have taken, and who took it.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={action}
          onChange={(e) => changeFilter(setAction, e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-card"
        >
          <option value="">All actions</option>
          {data?.filters?.actions?.map((a) => (
            <option key={a} value={a}>
              {meta(a).label}
            </option>
          ))}
        </select>

        <select
          value={adminId}
          onChange={(e) => changeFilter(setAdminId, e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-card"
        >
          <option value="">All staff</option>
          {data?.filters?.admins?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.email}
            </option>
          ))}
        </select>

        {(action || adminId) && (
          <button
            onClick={() => {
              setAction("");
              setAdminId("");
              setPage(1);
            }}
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : !data ? (
        // Four states, four sentences. This one is "we asked and did not get an
        // answer", and it deliberately does not look like an empty log.
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <AlertCircle size={28} className="text-muted-foreground mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">
            The log could not be read, so nothing is shown. This is not an empty
            log — no entry has been deleted.
          </p>
          <button
            onClick={load}
            className="mt-3 text-sm font-semibold text-foreground underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      ) : !data.rows?.length ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <ScrollText size={28} className="text-muted-foreground mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">
            {action || adminId
              ? "No entries match those filters."
              : "Nothing logged yet."}
          </p>
        </div>
      ) : (
        <>
          <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
            {data.rows.map((row) => {
              const m = meta(row.action);
              const Icon = m.Icon;
              return (
                <div key={row.id} className="px-5 py-4 flex gap-4">
                  <span
                    className={`h-8 w-8 rounded-full border flex items-center justify-center shrink-0 ${m.className}`}
                  >
                    <Icon size={14} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3 flex-wrap">
                      <span className="text-sm font-medium text-foreground">
                        {m.label}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatWhen(row.createdAt)}
                      </span>
                    </div>

                    <div className="text-xs text-muted-foreground mt-0.5">
                      {row.platformAdmin?.email || "unknown staff"}
                      {row.platformAdmin?.role && (
                        <span className="text-muted-foreground">
                          {" "}
                          ({row.platformAdmin.role})
                        </span>
                      )}
                      {row.targetCompanyName && (
                        <>
                          {" · "}
                          {row.targetCompanyId ? (
                            <Link
                              href={`/platform/companies/${row.targetCompanyId}`}
                              className="underline hover:text-foreground"
                            >
                              {row.targetCompanyName}
                            </Link>
                          ) : (
                            row.targetCompanyName
                          )}
                        </>
                      )}
                    </div>

                    {/* Raw details, shown collapsed. They're the difference
                        between "status changed" and "changed from active to
                        churned", which is what you actually need. */}
                    {row.details && Object.keys(row.details).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                          Details
                        </summary>
                        <pre className="mt-1 text-xs bg-muted border border-border rounded p-2 overflow-x-auto text-muted-foreground">
                          {JSON.stringify(row.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {data.total.toLocaleString("en-CA")} entries
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-lg border border-border disabled:opacity-40 hover:bg-muted"
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-muted-foreground">
                {data.page} / {data.pageCount}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.pageCount, p + 1))}
                disabled={page >= data.pageCount}
                className="p-2 rounded-lg border border-border disabled:opacity-40 hover:bg-muted"
                aria-label="Next page"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
