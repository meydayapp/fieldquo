// app/platform/billing/plans/page.js
//
// Plans are the only screen here that edits something customers see directly:
// the public /pricing page reads this table live. So it warns before saving a
// price change, and shows how many companies each plan affects.
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  Trash2,
  AlertCircle,
  CreditCard,
  Sparkles,
} from "lucide-react";
import { money, count } from "@/app/components/platform/MetricCard";

const BLANK = {
  name: "",
  priceMonthly: "",
  stripePriceId: "",
  maxUsers: "",
  maxQuotesPerMonth: "",
  aiCopilotEnabled: false,
};

export default function PlatformPlansPage() {
  const [plans, setPlans] = useState([]);
  const [usage, setUsage] = useState({});
  const [draft, setDraft] = useState(null); // null = form closed
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [planRes, subRes] = await Promise.all([
        fetch("/api/platform/billing/plans"),
        fetch("/api/platform/analytics/overview"),
      ]);
      if (!planRes.ok) {
        const d = await planRes.json().catch(() => null);
        throw new Error(d?.error || `Request failed (${planRes.status}).`);
      }
      setPlans(await planRes.json());

      // planMix is keyed by plan NAME, which is unique in the schema — good
      // enough to show subscriber counts without another endpoint.
      if (subRes.ok) {
        const overview = await subRes.json();
        setUsage(overview.planMix || {});
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    const isEdit = Boolean(draft.id);
    const subscribers = usage[draft.name] || 0;

    if (isEdit && subscribers > 0) {
      const original = plans.find((p) => p.id === draft.id);
      if (String(original?.priceMonthly) !== String(draft.priceMonthly)) {
        if (
          !confirm(
            `${subscribers} ${subscribers === 1 ? "company is" : "companies are"} on "${draft.name}". ` +
              `Changing the price here updates what the public pricing page shows, but does NOT change ` +
              `existing Stripe subscriptions — those keep billing the old amount until changed in Stripe. Continue?`,
          )
        )
          return;
      }
    }

    setBusy(true);
    setError("");
    try {
      const payload = {
        name: draft.name.trim(),
        priceMonthly: Number(draft.priceMonthly) || 0,
        stripePriceId: draft.stripePriceId?.trim() || null,
        maxUsers: draft.maxUsers === "" ? null : Number(draft.maxUsers),
        maxQuotesPerMonth:
          draft.maxQuotesPerMonth === ""
            ? null
            : Number(draft.maxQuotesPerMonth),
        aiCopilotEnabled: !!draft.aiCopilotEnabled,
      };

      const res = await fetch(
        isEdit
          ? `/api/platform/billing/plans/${draft.id}`
          : "/api/platform/billing/plans",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || "Couldn't save.");
      }
      setDraft(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(plan) {
    if (!confirm(`Delete the "${plan.name}" plan?`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/platform/billing/plans/${plan.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || "Couldn't delete.");
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Plans</h1>
          <p className="text-sm text-muted-foreground mt-1">
            What companies can buy. The public pricing page reads these live.
          </p>
        </div>
        <button
          onClick={() => setDraft({ ...BLANK })}
          className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg"
        >
          <Plus size={14} /> New plan
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {draft && (
        <div className="bg-card border border-inverted rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-foreground">
            {draft.id ? `Edit ${draft.name}` : "New plan"}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Starter"
                className={inputClass}
              />
            </Field>

            <Field label="Price per month (CAD)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.priceMonthly}
                onChange={(e) =>
                  setDraft({ ...draft, priceMonthly: e.target.value })
                }
                className={inputClass}
              />
            </Field>

            <Field
              label="Max users"
              hint="Blank = unlimited"
            >
              <input
                type="number"
                min="1"
                value={draft.maxUsers ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, maxUsers: e.target.value })
                }
                className={inputClass}
              />
            </Field>

            <Field label="Max quotes / month" hint="Blank = unlimited">
              <input
                type="number"
                min="1"
                value={draft.maxQuotesPerMonth ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, maxQuotesPerMonth: e.target.value })
                }
                className={inputClass}
              />
            </Field>

            <Field
              label="Stripe price ID"
              hint="From the Stripe dashboard — without it, checkout can't bill this plan"
            >
              <input
                value={draft.stripePriceId ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, stripePriceId: e.target.value })
                }
                placeholder="price_1A2b3C…"
                className={`${inputClass} font-mono text-xs`}
              />
            </Field>

            <Field label="AI Copilot">
              <label className="flex items-center gap-2 text-sm text-foreground pt-2">
                <input
                  type="checkbox"
                  checked={!!draft.aiCopilotEnabled}
                  onChange={(e) =>
                    setDraft({ ...draft, aiCopilotEnabled: e.target.checked })
                  }
                  className="rounded border-border accent-primary"
                />
                Included in this plan
              </label>
            </Field>
          </div>

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={busy || !draft.name.trim()}
              className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              Save
            </button>
            <button
              onClick={() => setDraft(null)}
              className="border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <CreditCard size={28} className="text-muted-foreground mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">
            No plans yet. The public pricing page shows its empty state until
            you add one.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => {
            const subscribers = usage[p.name] || 0;
            return (
              <div
                key={p.id}
                className="bg-card border border-border rounded-xl p-5 flex flex-col"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground">{p.name}</h3>
                  {p.aiCopilotEnabled && (
                    <span
                      className="text-[#ff5a00]"
                      title="AI Copilot included"
                    >
                      <Sparkles size={14} />
                    </span>
                  )}
                </div>

                <div className="mt-2 text-2xl font-bold text-foreground">
                  {money(p.priceMonthly, { compact: true })}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </div>

                <dl className="mt-3 space-y-1 text-sm text-muted-foreground flex-1">
                  <div>{p.maxUsers ? `${p.maxUsers} users` : "Unlimited users"}</div>
                  <div>
                    {p.maxQuotesPerMonth
                      ? `${count(p.maxQuotesPerMonth)} quotes/mo`
                      : "Unlimited quotes"}
                  </div>
                  <div
                    className={
                      subscribers > 0 ? "text-foreground font-medium" : ""
                    }
                  >
                    {count(subscribers)}{" "}
                    {subscribers === 1 ? "company" : "companies"}
                  </div>
                  {!p.stripePriceId && (
                    <div className="text-amber-700 dark:text-amber-300 text-xs">
                      No Stripe price ID — checkout will fail
                    </div>
                  )}
                </dl>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() =>
                      setDraft({
                        id: p.id,
                        name: p.name,
                        priceMonthly: String(p.priceMonthly),
                        stripePriceId: p.stripePriceId || "",
                        maxUsers: p.maxUsers ?? "",
                        maxQuotesPerMonth: p.maxQuotesPerMonth ?? "",
                        aiCopilotEnabled: p.aiCopilotEnabled,
                      })
                    }
                    className="flex-1 border border-border text-foreground text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-muted"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(p)}
                    disabled={busy}
                    title={
                      subscribers > 0
                        ? "Companies are on this plan"
                        : "Delete plan"
                    }
                    className="border border-border text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-red-50 dark:bg-red-950/40 hover:text-red-600 dark:text-red-400 disabled:opacity-40"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
