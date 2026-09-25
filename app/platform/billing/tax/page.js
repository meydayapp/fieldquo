// app/platform/billing/tax/page.js
//
// Tax on FieldQuo's OWN subscriptions: where FieldQuo has to register, how
// close each place is, and what to add in Stripe when it is time.
//
// The owner, 2026-09-24: UK 20% VAT (reverse charge only with a VAT number),
// EU the buyer's country rate (reverse charge with a VAT ID), Australia 10%
// GST, USA none for now, Canada as today — charged in the system. Checkout
// already runs Stripe Tax (automatic_tax, a required billing address, tax-ID
// collection); Stripe Tax charges exactly that — but only in places where a
// registration has been ADDED in Stripe. So this screen is the missing half:
// it counts, per place, and says when to register. It computes no tax and
// changes nothing — lib/platform/taxRegistrations.js has the reasoning and
// the citations.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";
import { count } from "@/app/components/platform/MetricCard";

const PILL = {
  registered:
    "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
  register_now:
    "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900",
  approaching:
    "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  unknown:
    "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
};
const NEUTRAL_PILL = "bg-muted text-foreground border-border";

/** { AUD: 1234.5, USD: 99 } → "A$1,234.50 · US$99.00"; nothing → "—". */
function amounts(map) {
  const entries = Object.entries(map || {}).filter(([, v]) => Number(v) > 0);
  if (!entries.length) return "—";
  return entries
    .map(([cur, v]) => `${cur} ${Number(v).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    .join(" · ");
}

function threshold(t) {
  if (!t) return "—";
  if (t.amount === 0) return `None — ${t.window}`;
  return `${t.currency} ${Number(t.amount).toLocaleString("en-CA")} — ${t.window}`;
}

export default function TaxRegistrationsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/platform/billing/tax-registrations");
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
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const errors = data?.errors ? Object.entries(data.errors).filter(([, v]) => v) : [];
  const settings = data?.settings;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tax registrations</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            Tax on FieldQuo&apos;s own subscriptions. Checkout already runs Stripe Tax, which charges UK VAT, EU VAT at
            the customer&apos;s rate and Australian GST — and applies the reverse charge when a customer gives a VAT
            number or ABN — but only in places where a registration has been added in Stripe. This page says when
            each place needs one. What contractors charge their own clients is separate and is not shown here.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {errors.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-4 text-sm text-amber-700 dark:text-amber-300 space-y-1">
          {errors.map(([k, v]) => (
            <p key={k}>
              <strong>Could not read Stripe {k}:</strong> {v} Figures that depend on it are shown as unknown, not zero.
            </p>
          ))}
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Reading Stripe and FieldQuo&apos;s subscriptions…
        </div>
      )}

      {data && (
        <>
          {/* ── The preconditions Stripe Tax needs before any registration
              collects anything. Read from Stripe's Tax settings, not typed. */}
          <section className="bg-card border border-border rounded-xl p-4 space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Stripe Tax set-up</h2>
            {settings ? (
              <ul className="text-sm text-foreground space-y-1">
                <li>
                  Status: <strong>{settings.status || "—"}</strong>
                  {settings.missingFields?.length > 0 && ` — missing: ${settings.missingFields.join(", ")}`}
                </li>
                <li>Head office country: <strong>{settings.headOfficeCountry || "not set"}</strong></li>
                <li>
                  Preset product tax code: <strong>{settings.taxCode || "not set"}</strong>
                  {settings.taxCode !== "txcd_10103001" &&
                    " — FieldQuo is sold as software: “Software as a service (SaaS) — business use” is txcd_10103001."}
                </li>
                <li>
                  Default tax behaviour: <strong>{settings.taxBehavior || "not set"}</strong>
                  {settings.taxBehavior === "exclusive" && " — tax is added on top: an Australian without an ABN pays A$99 + GST."}
                  {settings.taxBehavior === "inclusive" && " — tax is inside the price: A$99 includes GST, and FieldQuo keeps less."}
                </li>
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Unknown — see the notice above.</p>
            )}
          </section>

          <div className="space-y-3">
            {data.rows.map((row) => (
              <section key={row.key} className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">{row.label}</h2>
                    <p className="text-xs text-muted-foreground">{row.tax}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${PILL[row.verdict] || NEUTRAL_PILL}`}>
                    {row.verdictLabel}
                  </span>
                </div>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Paying · trialling</dt>
                    <dd className="text-foreground tabular-nums">
                      {count(row.companies.paying)} · {count(row.companies.trialling)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Run-rate, next 12 months</dt>
                    <dd className="text-foreground tabular-nums">{amounts(row.companies.annualRunRate)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Paid, 12 months — no tax ID (taxable)</dt>
                    <dd className="text-foreground tabular-nums">{row.invoices ? amounts(row.invoices.taxable) : "unknown"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Paid, 12 months — with tax ID (reverse charge)</dt>
                    <dd className="text-foreground tabular-nums">{row.invoices ? amounts(row.invoices.reverseCharge) : "unknown"}</dd>
                  </div>
                  {row.threshold && (
                    <div className="flex justify-between gap-3 sm:col-span-2">
                      <dt className="text-muted-foreground">Registration threshold for FieldQuo</dt>
                      <dd className="text-foreground text-right">{threshold(row.threshold)}</dd>
                    </div>
                  )}
                  {row.registration && (
                    <div className="flex justify-between gap-3 sm:col-span-2">
                      <dt className="text-muted-foreground">Registration in Stripe</dt>
                      <dd className="text-foreground">
                        {row.registration.country} · {row.registration.type || "—"} · {row.registration.status}
                      </dd>
                    </div>
                  )}
                </dl>

                {row.reverseCharge && <p className="text-xs text-muted-foreground">{row.reverseCharge}.</p>}
                {row.note && <p className="text-xs text-muted-foreground">{row.note}</p>}

                {row.todo && (
                  <div className="border border-border rounded-lg p-3 bg-muted text-sm text-foreground space-y-1">
                    <p className="font-medium">Checklist</p>
                    <ol className="list-decimal pl-5 space-y-0.5">
                      <li>Confirm with an accountant — this page counts, it does not advise.</li>
                      <li>Register: {row.authority}.</li>
                      <li>{row.stripeSteps}</li>
                      <li>Come back here: the row turns green once Stripe lists the registration.</li>
                    </ol>
                  </div>
                )}

                {row.sources?.length > 0 && (
                  <p className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                    {row.sources.map((s) => (
                      <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                        {s.label} <ExternalLink className="w-3 h-3" />
                      </a>
                    ))}
                  </p>
                )}
              </section>
            ))}
          </div>

          {(data.unplaced.paying > 0 || data.unplaced.trialling > 0) && (
            <section className="bg-card border border-border rounded-xl p-4 space-y-1 text-sm">
              <h2 className="text-sm font-semibold text-foreground">Everywhere else</h2>
              <p className="text-foreground">
                {count(data.unplaced.paying)} paying · {count(data.unplaced.trialling)} trialling in places the owner has
                not decided on:{" "}
                {Object.entries(data.unplaced.countries)
                  .map(([cc, n]) => `${cc} (${n})`)
                  .join(", ")}
                .
              </p>
              <p className="text-xs text-muted-foreground">
                Stripe&apos;s own monitoring (Tax → Locations → Needs attention) watches these thresholds too. A company
                with no country appears as “(none)” — see{" "}
                <Link href="/platform/companies" className="underline">Companies</Link>.
              </p>
            </section>
          )}

          <p className="text-xs text-muted-foreground">
            Invoices counted: paid subscription invoices since {new Date(data.since).toLocaleDateString("en-CA")}, by the
            billing address and tax IDs on each invoice.
            {data.invoiceCapped && " The list reached its cap; older invoices in the window were not read."} Amounts are
            in the currency charged and are never converted. Thresholds as published on 25 Sep 2026.
          </p>
        </>
      )}
    </div>
  );
}
