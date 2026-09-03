// app/platform/companies/page.js
//
// The customer-service workhorse: find a company fast, see its state, open it.
//
// Search and status filter are server-side (the API already supports both)
// rather than client-side over a full download — that stays workable when
// there are thousands of companies, and the endpoint was already built for it.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, Loader2, Building2, AlertCircle } from "lucide-react";
import { count, money } from "@/app/components/platform/MetricCard";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Trial / pending" },
  { value: "churned", label: "Churned" },
  // A different axis from the three above — no Subscription row rather than an
  // onboardingStatus. Server-side, like the rest (see statusWhere in
  // app/api/platform/companies/route.js). The dedicated screen at
  // /platform/signups carries the contact details and the nudge state; this
  // filter exists so somebody already IN the company list can see the same
  // population without having to know that screen is there.
  { value: "incomplete", label: "Never finished checkout" },
];

const STATUS_STYLES = {
  active: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
  pending: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  churned: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900",
};

function trialDaysLeft(trialEndsAt) {
  if (!trialEndsAt) return null;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

export default function PlatformCompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (q, s) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (s) params.set("status", s);
      const res = await fetch(`/api/platform/companies?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't load companies.");
      setCompanies(Array.isArray(json) ? json : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => load(query, status), 250);
    return () => clearTimeout(t);
  }, [query, status, load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Companies</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every company on FieldQuo.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by company name…"
            className="w-full border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border"
          />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatus(f.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                status === f.value
                  ? "bg-inverted text-inverted-foreground border-inverted"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
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
      ) : companies.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <Building2 size={28} className="text-muted-foreground mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">
            {query || status
              ? "No companies match that."
              : "No companies yet."}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {count(companies.length)}{" "}
            {companies.length === 1 ? "company" : "companies"}
          </p>

          <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
            {companies.map((c) => {
              const daysLeft = trialDaysLeft(c.trialEndsAt);
              const plan = c.subscription?.plan?.name;

              return (
                <Link
                  key={c.id}
                  href={`/platform/companies/${c.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-muted"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground truncate">
                        {c.name}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          STATUS_STYLES[c.onboardingStatus] ||
                          "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        {c.onboardingStatus}
                      </span>
                      {/* The row's own status badge says "pending", which is
                          what onboardingStatus holds for a company that never
                          reached Stripe — and it says the same for one that is
                          mid-onboarding with a card on file. This badge is what
                          separates them, on the row, without opening anything.
                          Keyed off the subscription the API already includes,
                          not off a second query or a guess. */}
                      {!c.subscription && (
                        <span className="text-xs px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border">
                          Never finished checkout
                        </span>
                      )}
                      {/* Expiring trials are the single most actionable thing
                          on this screen, so they get called out inline —
                          but only for a company that actually has a
                          subscription. Printing "Trial ends in 3d" beside
                          "Never finished checkout" is two badges contradicting
                          each other about the same row, and the second one is
                          the true statement: nothing ends, because nothing
                          started. Company.trialEndsAt is stamped at signup,
                          before checkout, so it is set on every abandoned
                          signup in the database. */}
                      {c.subscription && daysLeft !== null && daysLeft >= 0 && daysLeft <= 7 && (
                        <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900">
                          Trial ends in {daysLeft}d
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      {c.email || "no email"} · {count(c._count?.members)}{" "}
                      members · {count(c._count?.quotes)} quotes
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-medium text-foreground">
                      {plan || "No plan"}
                    </div>
                    {c.subscription?.status && (
                      <div className="text-xs text-muted-foreground">
                        {c.subscription.status}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
