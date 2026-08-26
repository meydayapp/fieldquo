"use client";

// app/platform/sales-agent/page.js
//
// "What does FieldQuo's phone agent actually know?", answerable without ringing
// it.
//
// ── Why this screen exists ────────────────────────────────────────────────
//
// A sales agent that invents a feature costs a refund and a review, and the
// only way to catch that before a customer does is to read what it was given.
// So this renders the literal prompt string — not a summary, not a checklist of
// what we intended it to say. If a claim is wrong, it is wrong on this page in
// the same words the caller would hear.
//
// ── Nothing here is live, and it says so first ────────────────────────────
//
// FieldQuo has no Retell agent and no number for one (see
// lib/platform/salesAgent.js for the detail). This page leads with that rather
// than burying it, because a screen full of confident prompt text is exactly
// what "I was told it worked" looks like.
//
// ── Read-only ─────────────────────────────────────────────────────────────
//
// There is no editor here on purpose. Everything on this page is derived from
// the feature registry, the PlatformFeature globals and the Plan rows; you
// change what the agent says by changing one of those, in the screens that
// already own them. An overriding text box would be a place for a claim with no
// evidence behind it to live.

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  AlertCircle,
  AlertTriangle,
  PhoneOff,
  Info,
  Sparkles,
} from "lucide-react";

const SEVERITY = {
  blocking: {
    label: "Blocking",
    tone: "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-900",
    Icon: AlertTriangle,
  },
  degraded: {
    label: "Degraded",
    tone: "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900",
    Icon: AlertCircle,
  },
  note: {
    label: "Note",
    tone: "bg-muted text-muted-foreground border-border",
    Icon: Info,
  },
};

export default function PlatformSalesAgentPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/platform/sales-agent");
      const body = await res.json().catch(() => null);
      // Every failure branch produces a message. A bare `if (res.ok)` here
      // would leave the spinner up forever on a 403 and read as a slow page.
      if (!res.ok) throw new Error(body?.error || `Request failed (${res.status}).`);
      setData(body);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="max-w-3xl">
        <div className="border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Couldn&apos;t load the sales agent.</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 size={16} className="animate-spin" />
        Loading…
      </div>
    );
  }

  const { readiness, knowledge, prompt, greeting, tools, env } = data;

  return (
    <div className="max-w-4xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Sparkles size={20} className="text-[#ff5a00]" />
          FieldQuo&apos;s own phone agent
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          The agent that would answer FieldQuo&apos;s own number and talk to
          prospects about FieldQuo. This is <strong>not</strong> the receptionist
          a contractor gets — that one is per company and lives in Settings ›
          Voice inside their account.
        </p>
      </header>

      {/* The verdict, before anything that looks like a working feature. */}
      <section
        className={`rounded-xl border p-4 flex items-start gap-3 ${
          readiness.live ? SEVERITY.note.tone : SEVERITY.blocking.tone
        }`}
      >
        <PhoneOff size={18} className="shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-semibold">
            {readiness.live
              ? "Answering calls."
              : "Not answering anything. There is no agent and no number."}
          </p>
          <p className="text-sm mt-1">
            Everything below is what it <em>would</em> run on. Nothing on this
            page is deployed at the provider.
          </p>
        </div>
      </section>

      {readiness.blockers.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            What is missing
          </h2>
          <ul className="space-y-2">
            {readiness.blockers.map((b) => {
              const s = SEVERITY[b.severity] || SEVERITY.note;
              const Icon = s.Icon;
              return (
                <li
                  key={b.code}
                  className={`rounded-lg border p-3 flex items-start gap-3 ${s.tone}`}
                >
                  <Icon size={16} className="shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide">
                      {s.label} · {b.code}
                    </p>
                    <p className="text-sm mt-1">{b.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {readiness.transferIsSharedTestNumber && (
        <section className={`rounded-lg border p-3 ${SEVERITY.blocking.tone}`}>
          <p className="text-sm">
            <strong>{env.transferVar}</strong> points at the shared test number.
            A caller put through would reach whichever tenant receptionist is
            being tested. Change it.
          </p>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Where the knowledge comes from
        </h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <FactCard
            title="Optional features"
            value={`${knowledge.features.length} offered`}
            source="lib/features/registry.js, resolved against the PlatformFeature globals. Hidden and locked features are not mentioned at all."
          />
          <FactCard
            title="Core product"
            value={`${knowledge.core.categories.length} areas`}
            source="The permission grid in lib/permissions.js — every one is enforced per request, so the screen behind it exists."
          />
          <FactCard
            title="Prices"
            value={
              knowledge.plans.length
                ? `${knowledge.plans.length} quotable`
                : "none quotable"
            }
            source="Plan rows, filtered by the same sellability rule the public pricing page uses. Change a plan and the phone changes."
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Features it will talk about
        </h2>
        {knowledge.features.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-border rounded-lg p-4">
            None. Every registry feature is hidden or locked globally, so the
            agent would describe only the core product.
          </p>
        ) : (
          <ul className="space-y-2">
            {knowledge.features.map((f) => (
              <li key={f.key} className="border border-border rounded-lg p-3 bg-card">
                <p className="text-sm font-medium text-foreground">
                  {f.label}
                  {f.preview && (
                    <span className="ml-2 text-xs font-normal text-amber-700 dark:text-amber-400">
                      preview — said out loud as one
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{f.line}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Prices it may say
        </h2>
        {knowledge.plans.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-border rounded-lg p-4">
            No plan can be bought right now, so the agent is told to refuse the
            price question rather than estimate one. This is the same state that
            empties the public pricing page.
          </p>
        ) : (
          <div className="border border-border rounded-lg overflow-x-auto bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-3">Plan</th>
                  <th className="p-3">Per month</th>
                  <th className="p-3">Seats</th>
                  <th className="p-3">Quotes/mo</th>
                  <th className="p-3">AI</th>
                </tr>
              </thead>
              <tbody>
                {knowledge.plans.map((p) => (
                  <tr key={p.name} className="border-b border-border last:border-0">
                    <td className="p-3 font-medium text-foreground">{p.name}</td>
                    <td className="p-3">{p.priceMonthly}</td>
                    {/* An unstated limit is shown as unstated, never as
                        "unlimited" — the agent says nothing about it either. */}
                    <td className="p-3 text-muted-foreground">
                      {p.maxUsers === null ? "not stated — not mentioned" : p.maxUsers}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {p.maxQuotesPerMonth === null
                        ? "not stated — not mentioned"
                        : p.maxQuotesPerMonth}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {p.aiCopilotEnabled
                        ? p.aiMonthlyTokenCap === null
                          ? "included, no cap"
                          : `included, ${p.aiMonthlyTokenCap.toLocaleString()} tokens/mo (the figure is never said aloud)`
                        : "not included"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {knowledge.withheldPlanCount > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            {knowledge.withheldPlanCount} plan(s) held back — no Stripe price id,
            or not public. The agent is told its list is partial.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          What it can do
        </h2>
        <p className="text-sm text-muted-foreground mb-2">
          {tools.length === 0
            ? "Nothing. It has no tools, so it can only talk — and it is told to say it cannot put anyone through."
            : `${tools.length} tool: ${tools.map((t) => t.name).join(", ")}.`}{" "}
          It has no tool that can read or write any company&apos;s data, which is
          why it cannot look up an account even if a caller asks it to.
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          The first thing a caller hears
        </h2>
        <pre className="border border-border rounded-lg p-4 bg-card text-sm whitespace-pre-wrap break-words">
          {greeting}
        </pre>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          The exact prompt
        </h2>
        <p className="text-sm text-muted-foreground mb-2">
          Rules first, derived facts second, hand-written notes last and fenced —
          the same layering as a contractor&apos;s receptionist, so an
          instruction added at the bottom cannot loosen a rule at the top.
        </p>
        <pre className="border border-border rounded-lg p-4 bg-card text-xs leading-relaxed whitespace-pre-wrap break-words max-h-[32rem] overflow-y-auto">
          {prompt}
        </pre>
      </section>
    </div>
  );
}

function FactCard({ title, value, source }) {
  return (
    <div className="border border-border rounded-lg p-3 bg-card">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="text-lg font-semibold text-foreground mt-1">{value}</p>
      <p className="text-xs text-muted-foreground mt-2">{source}</p>
    </div>
  );
}
