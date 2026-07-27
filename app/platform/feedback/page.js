// app/platform/feedback/page.js
//
// The support queue. Open items first, oldest first — a queue that surfaces
// the newest thing is a queue where old complaints quietly rot.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  MessageSquare,
  AlertCircle,
  Bug,
  Lightbulb,
  CreditCard,
  HelpCircle,
  ExternalLink,
} from "lucide-react";

const STATUSES = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "wont_fix", label: "Won't fix" },
];

const TYPE_META = {
  bug: { label: "Bug", Icon: Bug, className: "text-red-600 bg-red-50" },
  feature_request: {
    label: "Feature request",
    Icon: Lightbulb,
    className: "text-amber-600 bg-amber-50",
  },
  billing: {
    label: "Billing",
    Icon: CreditCard,
    className: "text-purple-600 bg-purple-50",
  },
  question: {
    label: "Question",
    Icon: HelpCircle,
    className: "text-blue-600 bg-blue-50",
  },
  other: {
    label: "Other",
    Icon: MessageSquare,
    className: "text-gray-600 bg-gray-50",
  },
};

function ageInDays(createdAt) {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
}

export default function PlatformFeedbackPage() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("open");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const res = await fetch(`/api/platform/feedback?${params}`);
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
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  async function update(id, patch) {
    setBusyId(id);
    try {
      const res = await fetch("/api/platform/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.error || "Couldn't update.");
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const openCount = data?.counts?.open || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Feedback</h1>
        <p className="text-sm text-gray-500 mt-1">
          Bug reports and requests from companies using FieldQuo.
          {openCount > 0 && (
            <>
              {" "}
              <span className="font-medium text-gray-700">
                {openCount} open.
              </span>
            </>
          )}
        </p>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatus(s.value)}
            className={`px-3 py-2 rounded-lg text-sm font-medium border ${
              status === s.value
                ? "bg-gray-900 text-white border-gray-900"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {s.label}
            {data?.counts?.[s.value] > 0 && (
              <span
                className={
                  status === s.value ? "text-gray-300" : "text-gray-400"
                }
              >
                {" "}
                {data.counts[s.value]}
              </span>
            )}
          </button>
        ))}
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
          <MessageSquare size={28} className="text-gray-300 mx-auto" />
          <p className="mt-3 text-sm text-gray-500">
            Nothing {STATUSES.find((s) => s.value === status)?.label.toLowerCase()}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.rows.map((row) => {
            const t = TYPE_META[row.type] || TYPE_META.other;
            const Icon = t.Icon;
            const days = ageInDays(row.createdAt);
            const stale = status === "open" && days >= 7;

            return (
              <div
                key={row.id}
                className={`bg-white border rounded-xl p-5 ${
                  stale ? "border-amber-300" : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${t.className}`}
                      >
                        <Icon size={11} /> {t.label}
                      </span>
                      {/* Age is the thing that turns a queue into a problem,
                          so it's called out rather than buried in a date. */}
                      <span
                        className={`text-xs ${stale ? "text-amber-700 font-medium" : "text-gray-400"}`}
                      >
                        {days === 0 ? "today" : `${days}d ago`}
                      </span>
                    </div>

                    <h3 className="mt-2 font-semibold text-gray-900">
                      {row.subject}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">
                      {row.body}
                    </p>

                    <div className="mt-3 text-xs text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {row.companyId ? (
                        <Link
                          href={`/platform/companies/${row.companyId}`}
                          className="underline hover:text-gray-700"
                        >
                          {row.companyName || "Company"}
                        </Link>
                      ) : (
                        <span>{row.companyName || "Unknown company"}</span>
                      )}
                      {row.email && (
                        <a
                          href={`mailto:${row.email}?subject=Re: ${encodeURIComponent(row.subject)}`}
                          className="underline hover:text-gray-700"
                        >
                          {row.email}
                        </a>
                      )}
                      {row.pageUrl && (
                        <span
                          className="inline-flex items-center gap-1 font-mono truncate max-w-xs"
                          title={row.pageUrl}
                        >
                          <ExternalLink size={11} />
                          {row.pageUrl}
                        </span>
                      )}
                    </div>
                  </div>

                  <select
                    value={row.status}
                    disabled={busyId === row.id}
                    onChange={(e) => update(row.id, { status: e.target.value })}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white shrink-0 disabled:opacity-60"
                  >
                    {STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <details className="mt-3">
                  <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                    Internal notes
                  </summary>
                  <textarea
                    defaultValue={row.adminNotes || ""}
                    placeholder="Notes for the team — never shown to the company."
                    onBlur={(e) => {
                      if (e.target.value !== (row.adminNotes || "")) {
                        update(row.id, { adminNotes: e.target.value });
                      }
                    }}
                    rows={3}
                    className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                </details>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
