// app/platform/companies/[id]/CompanyHistory.js
//
// Two tabs, because support gets asked two different questions that both
// sound like "show me their payments":
//
//   Billing  — what they pay FieldQuo. "Why was I charged this?"
//   Activity — what their clients pay them. "My customer says they paid."
//
// Keeping them on separate tabs rather than one merged timeline is the point.
// The numbers are unrelated and adding them together would be meaningless.
"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, AlertCircle, Receipt, CreditCard } from "lucide-react";
import { money, count } from "@/app/components/platform/MetricCard";

const STATUS_STYLES = {
  paid: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  sent: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  overdue: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
  draft: "bg-muted text-muted-foreground",
};

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function CompanyHistory({ companyId }) {
  const [tab, setTab] = useState("billing");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/platform/companies/${companyId}/history`);
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || `Request failed (${res.status}).`);
      }
      setData(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> Loading history…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
        <AlertCircle size={16} /> {error}
      </div>
    );
  }

  const sub = data.billing.subscription;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex border-b border-border">
        <TabButton
          active={tab === "billing"}
          onClick={() => setTab("billing")}
          icon={CreditCard}
        >
          Pays FieldQuo
        </TabButton>
        <TabButton
          active={tab === "activity"}
          onClick={() => setTab("activity")}
          icon={Receipt}
        >
          Their client billing
        </TabButton>
      </div>

      {tab === "billing" ? (
        <div className="p-5 space-y-5">
          {sub ? (
            <dl className="grid gap-4 sm:grid-cols-4">
              <Field label="Plan" value={sub.planName || "—"} />
              <Field
                label="Monthly"
                value={money(sub.priceMonthly, { compact: true })}
              />
              <Field label="Status" value={sub.status} />
              <Field label="Customer since" value={formatDate(sub.since)} />
              <Field
                label={sub.trialEndsAt ? "Trial ends" : "Renews"}
                value={formatDate(sub.trialEndsAt || sub.currentPeriodEnd)}
              />
              <Field
                label="Stripe customer"
                value={sub.stripeCustomerId || "Not linked"}
                mono
              />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              No subscription record. They&apos;re on a trial, or the company
              was created manually before billing was set up.
            </p>
          )}

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Changes
            </h4>
            <p className="text-xs text-muted-foreground mb-3">
              Reconstructed from the audit log — Subscription is a single
              mutable row, so this is the only record of what changed and when.
            </p>
            {data.billing.changes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
            ) : (
              <div className="divide-y divide-border border border-border rounded-lg">
                {data.billing.changes.map((c) => (
                  <div key={c.id} className="px-4 py-3 text-sm">
                    <div className="flex justify-between gap-3 flex-wrap">
                      <span className="text-foreground">
                        {c.action.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(c.at)} · {c.by}
                      </span>
                    </div>
                    {c.details && (
                      <pre className="mt-1 text-xs text-muted-foreground overflow-x-auto">
                        {JSON.stringify(c.details)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-5 space-y-5">
          <dl className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Invoiced"
              value={money(data.activity.invoicedTotal, { compact: true })}
            />
            <Field
              label="Collected"
              value={money(data.activity.collectedTotal, { compact: true })}
            />
            <Field
              label="Invoices"
              value={count(data.activity.invoiceCount)}
            />
          </dl>
          <p className="text-xs text-muted-foreground -mt-2">
            Money this company billed and collected from its own clients. Not
            FieldQuo revenue.
          </p>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Recent invoices
            </h4>
            {data.activity.invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            ) : (
              <div className="divide-y divide-border border border-border rounded-lg">
                {data.activity.invoices.slice(0, 15).map((i) => (
                  <div
                    key={i.id}
                    className="px-4 py-3 flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-foreground">
                        {i.invoiceNumber}
                      </span>
                      <span className="text-muted-foreground"> · {i.clientName}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          STATUS_STYLES[i.status] || "bg-muted text-muted-foreground"
                        }`}
                      >
                        {i.status}
                      </span>
                      <span className="text-foreground font-medium">
                        {money(i.total, { compact: true })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Recent payments
            </h4>
            {data.activity.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments recorded.</p>
            ) : (
              <div className="divide-y divide-border border border-border rounded-lg">
                {data.activity.payments.slice(0, 15).map((p) => (
                  <div
                    key={p.id}
                    className="px-4 py-3 flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <span className="text-foreground">{p.clientName}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {p.invoiceNumber} · {p.method?.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(p.date)}
                      </span>
                      <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                        {money(p.amount, { compact: true })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px ${
        active
          ? "border-inverted text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon size={14} />
      {children}
    </button>
  );
}

function Field({ label, value, mono }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`mt-1 text-sm text-foreground ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
