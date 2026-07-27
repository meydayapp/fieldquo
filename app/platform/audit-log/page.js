// app/platform/audit-log/page.js
//
// "Who changed this, and when?" — the screen you open when a customer says
// something happened that nobody remembers doing.
//
// Impersonation entries are visually distinct because they're the ones that
// matter most: they're the moments a staff member had access to a customer's
// real client data, and the entry is the only record that it happened.
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
} from "lucide-react";

// Actions worth recognising on sight. Anything unmapped falls back to a
// neutral style rather than being hidden — a new action type should still
// show up, just without special treatment.
const ACTION_META = {
  impersonate: {
    label: "Signed in as company",
    Icon: LogIn,
    className: "bg-amber-50 text-amber-800 border-amber-200",
  },
  company_suspended: {
    label: "Suspended company",
    Icon: Ban,
    className: "bg-red-50 text-red-700 border-red-200",
  },
  company_deletion_requested: {
    label: "Requested deletion",
    Icon: Ban,
    className: "bg-red-50 text-red-700 border-red-200",
  },
  company_updated: {
    label: "Updated company",
    Icon: Pencil,
    className: "bg-gray-50 text-gray-700 border-gray-200",
  },
  company_created: {
    label: "Created company",
    Icon: Plus,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
};

function meta(action) {
  return (
    ACTION_META[action] || {
      label: action.replace(/_/g, " "),
      Icon: ScrollText,
      className: "bg-gray-50 text-gray-700 border-gray-200",
    }
  );
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
        <h1 className="text-2xl font-bold text-gray-900">Audit log</h1>
        <p className="text-sm text-gray-500 mt-1">
          Every action platform staff have taken, and who took it.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={action}
          onChange={(e) => changeFilter(setAction, e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
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
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
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
            className="text-sm text-gray-500 hover:text-gray-900 underline"
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-8">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : !data?.rows?.length ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <ScrollText size={28} className="text-gray-300 mx-auto" />
          <p className="mt-3 text-sm text-gray-500">
            {action || adminId
              ? "No entries match those filters."
              : "Nothing logged yet."}
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
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
                      <span className="text-sm font-medium text-gray-900">
                        {m.label}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">
                        {formatWhen(row.createdAt)}
                      </span>
                    </div>

                    <div className="text-xs text-gray-500 mt-0.5">
                      {row.platformAdmin?.email || "unknown staff"}
                      {row.platformAdmin?.role && (
                        <span className="text-gray-400">
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
                              className="underline hover:text-gray-700"
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
                        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                          Details
                        </summary>
                        <pre className="mt-1 text-xs bg-gray-50 border border-gray-200 rounded p-2 overflow-x-auto text-gray-600">
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
            <span className="text-gray-500">
              {data.total.toLocaleString("en-CA")} entries
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-gray-500">
                {data.page} / {data.pageCount}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.pageCount, p + 1))}
                disabled={page >= data.pageCount}
                className="p-2 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
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
