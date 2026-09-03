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
  bug: { label: "Bug", Icon: Bug, className: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40" },
  feature_request: {
    label: "Feature request",
    Icon: Lightbulb,
    className: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40",
  },
  billing: {
    label: "Billing",
    Icon: CreditCard,
    className: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40",
  },
  question: {
    label: "Question",
    Icon: HelpCircle,
    className: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40",
  },
  other: {
    label: "Other",
    Icon: MessageSquare,
    className: "text-muted-foreground bg-muted",
  },
  // A handoff Jennifer (lib/ai/jennifer/) made rather than answered — money
  // moving, a data-deletion request, a legal/privacy request. `body` is the
  // one-sentence reason only, never a conversation — see
  // app/api/jennifer/route.js's recordEscalation.
  jennifer_escalation: {
    label: "Jennifer",
    Icon: AlertCircle,
    className: "text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40",
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
        <h1 className="text-2xl font-bold text-foreground">Feedback</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bug reports and requests from companies using FieldQuo.
          {openCount > 0 && (
            <>
              {" "}
              <span className="font-medium text-foreground">
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
                ? "bg-inverted text-inverted-foreground border-inverted"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {s.label}
            {data?.counts?.[s.value] > 0 && (
              <span
                className={
                  status === s.value ? "text-muted-foreground" : "text-muted-foreground"
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
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : !data?.rows?.length ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <MessageSquare size={28} className="text-muted-foreground mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">
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
                className={`bg-card border rounded-xl p-5 ${
                  stale ? "border-amber-300" : "border-border"
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
                        className={`text-xs ${stale ? "text-amber-700 dark:text-amber-300 font-medium" : "text-muted-foreground"}`}
                      >
                        {days === 0 ? "today" : `${days}d ago`}
                      </span>
                    </div>

                    <h3 className="mt-2 font-semibold text-foreground">
                      {row.subject}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                      {row.body}
                    </p>

                    <div className="mt-3 text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                      {row.companyId ? (
                        <Link
                          href={`/platform/companies/${row.companyId}`}
                          className="underline hover:text-foreground"
                        >
                          {row.companyName || "Company"}
                        </Link>
                      ) : (
                        <span>{row.companyName || "Unknown company"}</span>
                      )}
                      {row.email && (
                        <a
                          href={`mailto:${row.email}?subject=Re: ${encodeURIComponent(row.subject)}`}
                          className="underline hover:text-foreground"
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
                    className="border border-border rounded-lg px-2 py-1.5 text-sm bg-card shrink-0 disabled:opacity-60"
                  >
                    {STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <details className="mt-3">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
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
                    className="mt-2 w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10"
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
