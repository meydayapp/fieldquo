"use client";

// app/platform/demo/page.js
//
// The sales demo accounts, and the control that re-dresses one as a different
// trade.
//
// ── Why the trade is switchable at all ────────────────────────────────────
//
// An agent demoing to a landscaper should not be walking a prospect through a
// kitchen refinishing quote. The prospect spends the call translating every
// screen into their own trade instead of listening, and the question that
// decides the sale — "does this handle MY work?" — never gets answered.
//
// ── Switching is destructive, and says so ─────────────────────────────────
//
// It wipes that demo's quotes, jobs, clients and invoices. The button says
// that before you press it, with the counts, because a control that quietly
// destroys work is the failure this codebase keeps finding.

import { useEffect, useState, useCallback } from "react";
import { Loader2, RotateCcw, Beaker, AlertTriangle } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";

export default function PlatformDemoPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [confirming, setConfirming] = useState(null); // `${companyId}:${industry}`

  const load = useCallback(async () => {
    const res = await fetch("/api/platform/demo");
    if (!res.ok) {
      await reportResponseError(res, "Couldn't load the demo accounts.");
      return;
    }
    setData(await res.json());
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function act(companyId, body, method) {
    setBusy(companyId);
    setConfirming(null);
    try {
      const res = await fetch("/api/platform/demo", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        await reportResponseError(res, "That didn't work.");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl space-y-4 animate-pulse">
        <div className="h-8 bg-accent rounded w-1/3" />
        <div className="h-32 bg-accent rounded-xl" />
      </div>
    );
  }

  const demos = data?.demos || [];
  const industries = data?.industries || [];

  return (
    <div className="p-4 sm:p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Beaker size={22} /> Demo accounts
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          One per sales agent. Switch the trade to match whoever they&apos;re
          showing it to.
        </p>
      </div>

      {demos.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm font-medium text-foreground">No demo accounts yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Create them by running the seed script, then invite each agent from
            Settings → Team on their company.
          </p>
          <code className="inline-block mt-3 text-xs bg-muted px-3 py-1.5 rounded">
            node --import ./scripts/alias-loader.mjs scripts/seed-demos.mjs
          </code>
        </div>
      )}

      <div className="space-y-3">
        {demos.map((d) => {
          const hasContent = d._count.quotes + d._count.jobs + d._count.clients > 0;
          return (
            <div key={d.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start gap-3">
                <span
                  className="w-9 h-9 rounded-lg shrink-0"
                  style={{ backgroundColor: d.brandColor || "#64748b" }}
                  aria-hidden
                />
                <div className="flex-1 min-w-[12rem]">
                  <p className="font-semibold text-foreground">{d.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <code>{d.slug}</code> · {d.demoIndustry || "no trade set"} ·{" "}
                    {d._count.quotes} quotes, {d._count.jobs} jobs, {d._count.clients} clients
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy === d.id}
                  onClick={() => act(d.id, { companyId: d.id }, "POST")}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-muted disabled:opacity-50"
                  title="Clear this demo's data, keeping its current trade"
                >
                  {busy === d.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                  Reset
                </button>
              </div>

              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  Change trade
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {industries.map((ind) => {
                    const current = d.demoIndustry === ind.key;
                    const key = `${d.id}:${ind.key}`;
                    return (
                      <button
                        key={ind.key}
                        type="button"
                        disabled={busy === d.id || current}
                        onClick={() =>
                          // Confirm only when there's something to lose. An
                          // empty demo doesn't need a speed bump, and a
                          // confirmation people always dismiss stops being one.
                          hasContent && confirming !== key
                            ? setConfirming(key)
                            : act(d.id, { companyId: d.id, industry: ind.key }, "PATCH")
                        }
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors disabled:opacity-40 ${
                          current
                            ? "bg-inverted text-inverted-foreground border-transparent"
                            : confirming === key
                              ? "border-amber-500 text-amber-700 dark:text-amber-400 font-semibold"
                              : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {confirming === key ? "Press again to confirm" : ind.label}
                      </button>
                    );
                  })}
                </div>

                {confirming?.startsWith(`${d.id}:`) && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-2 flex items-start gap-1.5">
                    <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                    This clears {d._count.quotes} quotes, {d._count.jobs} jobs and{" "}
                    {d._count.clients} clients on this demo. The login and the{" "}
                    <code>{d.slug}</code> address stay the same.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
