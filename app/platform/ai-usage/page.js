// app/platform/ai-usage/page.js
//
// What FieldQuo is spending on AI, and the lever to cap it.
//
// Sorted by tokens descending because the question this page exists to answer
// is "who is running up the bill" — that company should be the first row, not
// something you sort for. The month-over-month column is what makes a number
// legible: 400k tokens means nothing alone, 400k against 20k last month is a
// story worth opening.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, AlertCircle, Sparkles, TrendingUp, Check } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

const fmt = (n) => (n || 0).toLocaleString("en-CA");
const money = (micros) => {
  const d = (micros || 0) / 1_000_000;
  return d < 0.01 && d > 0 ? "<$0.01" : `$${d.toFixed(2)}`;
};

export default function AiUsagePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [capInput, setCapInput] = useState("");
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await fetchJson("/api/platform/ai-usage"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveCap(companyId) {
    setSavingId(companyId);
    setError("");
    try {
      await fetchJson("/api/platform/ai-usage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          cap: capInput.trim() === "" ? null : capInput,
        }),
      });
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId("");
    }
  }

  if (loading)
    return <div className="animate-pulse h-96 bg-accent rounded-xl" />;

  if (!data)
    return (
      <div className="max-w-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-5 text-sm text-red-700 dark:text-red-300">
        {error || "Couldn't load AI usage."}
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">AI usage</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Since{" "}
          {new Date(data.periodStart).toLocaleDateString("en-CA", {
            day: "numeric",
            month: "long",
          })}
          . FieldQuo pays for every token here — these are your costs, not the
          company&apos;s.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Cost this month" value={money(data.totals.costMicros)} big />
        <Stat label="Tokens" value={fmt(data.totals.tokens)} />
        <Stat label="Calls" value={fmt(data.totals.calls)} />
        <Stat label="Companies using it" value={fmt(data.totals.companies)} />
      </div>

      {data.byFeature?.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Sparkles size={16} className="text-muted-foreground" />
            Where it&apos;s going
          </h2>
          <div className="space-y-2">
            {data.byFeature.map((f) => (
              <div
                key={f.feature}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-foreground capitalize">
                  {f.feature.replace(/_/g, " ")}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {fmt(f.tokens)} tokens · {money(f.costMicros)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">By company</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Blank cap follows the plan. 0 turns AI off for that company.
            Default when neither is set: {fmt(data.defaultCap)} tokens.
          </p>
        </div>

        {data.rows.length === 0 ? (
          <p className="px-5 py-10 text-sm text-muted-foreground text-center">
            No AI usage yet this month.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {data.rows.map((r) => {
              const spiking =
                r.lastMonthTokens > 0 && r.tokens > r.lastMonthTokens * 3;
              const over = r.percentUsed !== null && r.percentUsed >= 80;

              return (
                <div key={r.companyId} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <Link
                        href={`/platform/companies/${r.companyId}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {r.name}
                      </Link>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {fmt(r.tokens)} tokens · {money(r.costMicros)} ·{" "}
                        {fmt(r.calls)} calls
                        {r.planName && ` · ${r.planName}`}
                      </div>

                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {r.percentUsed !== null && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              over
                                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {r.percentUsed}% of {fmt(r.effectiveCap)}
                          </span>
                        )}
                        {r.percentUsed === null && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            No cap
                          </span>
                        )}
                        {/* Tripling month over month is the signal worth
                            interrupting for — genuine growth is gradual. */}
                        {spiking && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300">
                            <TrendingUp size={10} />
                            {Math.round(r.tokens / r.lastMonthTokens)}× last
                            month
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {editing === r.companyId ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            value={capInput}
                            onChange={(e) => setCapInput(e.target.value)}
                            placeholder="blank = plan"
                            className="w-32 border border-border rounded-lg px-2 py-1 text-sm bg-card"
                          />
                          <button
                            onClick={() => saveCap(r.companyId)}
                            disabled={savingId === r.companyId}
                            className="inline-flex items-center gap-1 bg-inverted text-inverted-foreground text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60"
                          >
                            {savingId === r.companyId ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : (
                              <Check size={11} />
                            )}
                            Save
                          </button>
                          <button
                            onClick={() => setEditing(null)}
                            className="text-xs text-muted-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditing(r.companyId);
                            setCapInput(
                              r.companyCap === null ? "" : String(r.companyCap),
                            );
                          }}
                          className="text-sm font-semibold text-muted-foreground hover:text-foreground"
                        >
                          {r.companyCap === null
                            ? "Set limit"
                            : `Limit: ${fmt(r.companyCap)}`}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, big }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 font-bold text-foreground tabular-nums ${
          big ? "text-2xl" : "text-xl"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
