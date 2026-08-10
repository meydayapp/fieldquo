// app/platform/errors/page.js
//
// The failure queue. Everything here is something that broke without the
// customer necessarily noticing — a rejected email, a Stripe sync that didn't
// land, a PDF that didn't render.
//
// Acknowledging clears a row so the list stays a to-do. An empty list is the
// point: it means nothing is currently broken.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, AlertTriangle, Check, Mail, CreditCard, FileText, Bot, Webhook, Upload, Clock, Users } from "lucide-react";

const AREA_ICON = {
  email: Mail,
  stripe: CreditCard,
  pdf: FileText,
  ai: Bot,
  webhook: Webhook,
  upload: Upload,
  cron: Clock,
  // Not a failure in the same sense as the rest of this list — nothing broke.
  // It lands here anyway because this is the queue staff actually open, and a
  // seat-sharing flag that nobody sees is the same as no flag at all.
  account_abuse: Users,
};

function when(iso) {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function PlatformErrorsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [area, setArea] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const qs = new URLSearchParams();
      if (area) qs.set("area", area);
      if (showResolved) qs.set("resolved", "1");
      const res = await fetch(`/api/platform/errors?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status}).`);
      setData(json);
    } catch (e) {
      setError(e.message);
    }
  }, [area, showResolved]);

  useEffect(() => {
    load();
  }, [load]);

  async function resolve(ids) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/platform/errors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Request failed (${res.status}).`);
      }
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const errors = data?.errors || [];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <AlertTriangle size={20} /> Errors
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Failures that don&apos;t surface to the customer — rejected emails, Stripe
            syncs that didn&apos;t land, PDFs that didn&apos;t render. Acknowledge one to
            clear it from the queue.
          </p>
        </div>
        {data && (
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              data.unresolvedCount > 0
                ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
            }`}
          >
            {data.unresolvedCount} unresolved
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setArea("")}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
            area === "" ? "border-foreground bg-inverted text-inverted-foreground" : "border-border text-muted-foreground"
          }`}
        >
          All
        </button>
        {(data?.areas || []).map((a) => (
          <button
            key={a.area}
            onClick={() => setArea(a.area)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
              area === a.area ? "border-foreground bg-inverted text-inverted-foreground" : "border-border text-muted-foreground"
            }`}
          >
            {a.area} ({a.count})
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
          Show acknowledged
        </label>
      </div>

      {error && (
        <p className="text-sm rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900 px-3 py-2">
          {error}
        </p>
      )}

      {!data && !error && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      )}

      {data && errors.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <Check size={26} className="mx-auto mb-2 text-emerald-600" />
          <p className="text-sm font-semibold text-foreground">
            {showResolved ? "Nothing acknowledged yet." : "Nothing is broken."}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {showResolved ? "" : "Failures will appear here the moment they happen."}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {errors.map((e) => {
          const Icon = AREA_ICON[e.area] || AlertTriangle;
          return (
            <div key={e.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <span className="grid w-9 h-9 rounded-lg place-items-center bg-muted text-muted-foreground shrink-0">
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {e.area}
                    </span>
                    {e.code && <span className="text-[11px] font-mono text-muted-foreground">{e.code}</span>}
                    <span className="text-[11px] text-muted-foreground">· {when(e.createdAt)}</span>
                    {e.companyId && (
                      <Link
                        href={`/platform/companies/${e.companyId}`}
                        className="text-[11px] font-semibold text-foreground underline"
                      >
                        {e.companyName || "company"}
                      </Link>
                    )}
                  </div>
                  <p className="text-sm text-foreground mt-1 break-words">{e.message}</p>
                  {e.detail && (
                    <details className="mt-1.5">
                      <summary className="text-[11px] text-muted-foreground cursor-pointer">Detail</summary>
                      <pre className="mt-1 text-[10px] bg-muted rounded p-2 overflow-x-auto">
                        {JSON.stringify(e.detail, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
                {!e.resolvedAt && (
                  <button
                    onClick={() => resolve([e.id])}
                    disabled={busy}
                    className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold border border-border rounded-full px-3 py-1.5 hover:bg-muted disabled:opacity-60"
                  >
                    <Check size={12} /> Acknowledge
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {errors.length > 1 && !showResolved && (
        <button
          onClick={() => resolve(errors.map((e) => e.id))}
          disabled={busy}
          className="text-xs font-semibold text-muted-foreground hover:text-foreground underline disabled:opacity-60"
        >
          Acknowledge all {errors.length} shown
        </button>
      )}
    </div>
  );
}
