// app/platform/companies/page.js
//
// The customer-service workhorse: find a company fast, see its state, open it.
//
// Search and status filter are server-side (the API already supports both)
// rather than client-side over a full download — that stays workable when
// there are thousands of companies, and the endpoint was already built for it.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Loader2, Building2, AlertCircle } from "lucide-react";
import { count, money } from "@/app/components/platform/MetricCard";
import { statusMeta } from "@/lib/platform/subscriptionStatus";
import NextStepsEmailCard from "./NextStepsEmailCard";
import PresenceBadge, { usePresencePoll } from "@/app/components/platform/PresenceBadge";
import { countOnline, presenceBadge, presenceSortKey } from "@/lib/platform/companyPresence";

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
  { value: "incomplete", label: "Never finished signup" },
  // Finished on the card-free trial (no card, no plan yet — lib/signup/
  // abandoned.js cardFreeTrialWhere). The target of the links on
  // /platform/signups and /platform/billing/subscriptions.
  { value: "trial_no_plan", label: "Free trial · no plan" },
  // The ten seeded sales demos. Excluded from every other filter server-side
  // (statusWhere) so the customer list never counts them.
  { value: "demo", label: "Demo" },
];

const STATUS_STYLES = {
  // lib/platform/companyStanding.js tones for a card-free trial.
  trial: "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-900",
  warning: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  active: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
  pending: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  churned: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900",
};

function trialDaysLeft(trialEndsAt) {
  if (!trialEndsAt) return null;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

/**
 * Trialling and paying companies by country, for tax-registration tracking:
 * where FieldQuo's customers are is where FieldQuo may have to register.
 * Counted from the rows on screen (the API already carries country,
 * subscription and trialEndsAt), demos left out. "Paying" is a live or
 * past-due subscription; "trialling" is a trialing subscription OR a company
 * with no subscription whose trial has not ended — the card-free trial
 * (lib/billing/access.js trialAccessFor). A company with neither (trial over,
 * no plan; cancelled) is in neither column, on purpose.
 */
function tallyByCountry(companies) {
  const map = new Map();
  for (const c of companies || []) {
    if (c.isDemo) continue;
    const status = c.subscription?.status;
    const paying = status === "active" || status === "past_due";
    const trialling =
      status === "trialing" || (!c.subscription && c.trialEndsAt && new Date(c.trialEndsAt).getTime() > Date.now());
    if (!paying && !trialling) continue;
    const key = c.country || "?";
    const row = map.get(key) || { country: key, trialling: 0, paying: 0 };
    if (paying) row.paying++;
    else row.trialling++;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.paying + b.trialling - (a.paying + a.trialling) || a.country.localeCompare(b.country));
}

export default function PlatformCompaniesPage() {
  // null, not []. On a failed load an empty array printed "No companies yet."
  // — a claim that FieldQuo has no customers, rendered directly beneath the red
  // banner saying the request failed. Four states, four messages.
  const [companies, setCompanies] = useState(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  // Seeded from ?status= so the links on /platform/signups and
  // /platform/billing/subscriptions ("Free trials without a plan") land on
  // the filter they name. Read from window.location after mount — a lazy
  // initialiser would disagree with the server render, and useSearchParams
  // would need a Suspense boundary around the page — and only a value the
  // filter row offers is taken.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("status") || "";
    if (wanted && STATUS_FILTERS.some((f) => f.value === wanted)) setStatus(wanted);
  }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const byCountry = useMemo(() => tallyByCountry(companies), [companies]);

  // ── Who is signed in ────────────────────────────────────────────────────
  //
  // Polled on its own, every minute while this tab is visible, from a route
  // that returns timestamps only (app/api/platform/companies/presence) — the
  // list itself is not re-downloaded to keep a badge fresh. The words come
  // from lib/platform/companyPresence.js, the same function the company page
  // uses, so the two screens cannot disagree about one company.
  const { data: presenceData, error: presenceError, now } = usePresencePoll(
    "/api/platform/companies/presence",
  );
  const presenceById = useMemo(() => {
    const map = new Map();
    for (const p of presenceData?.companies || []) map.set(p.id, p);
    return map;
  }, [presenceData]);
  // Across every customer company, not just the rows under the current
  // filter — "3 companies online now" is a statement about FieldQuo, and the
  // presence route already covers every company. Demos are left out, the same
  // line the list's own filters draw.
  const onlineNow = useMemo(
    () => (presenceData ? countOnline(presenceData.companies, now) : null),
    [presenceData, now],
  );
  // "Online now" narrows the rows ALREADY loaded under the status filter and
  // search. Client-side, unlike those two (see the note at the top of this
  // file), because it is a different kind of question: it changes minute to
  // minute, and deciding it here with the same presenceBadge() that draws the
  // pill means a row is listed if and only if its badge says "Online now".
  // The list is not paged, so there is no "12 companies" over a page of 3.
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [sortBy, setSortBy] = useState("newest");
  const badgeFor = useCallback(
    (c) => {
      const p = presenceById.get(c.id);
      return p ? presenceBadge({ ...p, now }) : null;
    },
    [presenceById, now],
  );
  const shown = useMemo(() => {
    if (!Array.isArray(companies)) return companies;
    let rows = companies;
    if (onlineOnly && presenceData) rows = rows.filter((c) => badgeFor(c)?.code === "online");
    if (sortBy === "recent" && presenceData) {
      rows = [...rows].sort(
        (a, b) =>
          presenceSortKey(presenceById.get(b.id), now) - presenceSortKey(presenceById.get(a.id), now),
      );
    }
    return rows;
  }, [companies, onlineOnly, sortBy, presenceData, presenceById, badgeFor, now]);

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
      setCompanies(null);
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
        {/* The headline the owner asked for: is anybody in the product right
            now. Emerald only when the answer is yes, the reps page's "live"
            tone; a zero is said plainly in grey rather than hidden. */}
        {onlineNow !== null && (
          <p
            className={`text-sm mt-2 font-medium ${
              onlineNow > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"
            }`}
          >
            {onlineNow === 0
              ? "No companies online now."
              : `${count(onlineNow)} ${onlineNow === 1 ? "company" : "companies"} online now.`}
          </p>
        )}
        {presenceError && (
          <p className="text-xs text-muted-foreground mt-1">
            {presenceData
              ? `Who's signed in didn't refresh (${presenceError}); the badges show the last reading.`
              : `Who's signed in couldn't be loaded (${presenceError}), so no badges are shown.`}
          </p>
        )}
      </div>

      {/* The one letter FieldQuo writes to a new company after the
          confirmation, with its switch — here rather than on /platform/signups,
          which is about people who never became a company. */}
      <NextStepsEmailCard />

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
              className={`min-h-[44px] min-w-[44px] lg:min-h-0 px-3 py-2 rounded-lg text-sm font-medium border ${
                status === f.value
                  ? "bg-inverted text-inverted-foreground border-inverted"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
          {/* A toggle, not a sixth status: it narrows whichever status is
              chosen. Disabled until presence has loaded, so it can never
              answer "none of these is online" about data it does not have. */}
          <button
            onClick={() => setOnlineOnly((v) => !v)}
            disabled={!presenceData}
            aria-pressed={onlineOnly}
            className={`min-h-[44px] min-w-[44px] lg:min-h-0 px-3 py-2 rounded-lg text-sm font-medium border disabled:opacity-50 ${
              onlineOnly
                ? "bg-emerald-700 text-white border-emerald-700"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            Online now{onlineNow ? ` (${count(onlineNow)})` : ""}
          </button>
          <label className="sr-only" htmlFor="company-sort">
            Sort
          </label>
          <select
            id="company-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            disabled={!presenceData}
            className="min-h-[44px] lg:min-h-0 px-3 py-2 rounded-lg text-sm border border-border bg-background text-foreground disabled:opacity-50"
          >
            <option value="newest">Newest signup first</option>
            <option value="recent">Most recently active first</option>
          </select>
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
      ) : companies === null ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <Building2 size={28} className="text-muted-foreground mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">
            The company list didn&apos;t load, so nothing is shown. This is not
            an answer about how many companies match — no company has been
            removed. Reload, or try the search again.
          </p>
        </div>
      ) : shown.length === 0 && onlineOnly && companies.length > 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <Building2 size={28} className="text-muted-foreground mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">
            None of these companies is online right now. Turn off &quot;Online
            now&quot; to see them all.
          </p>
        </div>
      ) : companies.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <Building2 size={28} className="text-muted-foreground mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">
            {query || status
              ? "No companies match that."
              : "No customer companies yet. The sales demos are under the Demo filter."}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {count(shown.length)}{" "}
            {shown.length === 1 ? "company" : "companies"}
            {onlineOnly ? " online now" : ""}
          </p>
          {/* Where the customers are — trialling + paying, per country, so
              the owner can see which tax registrations are coming. Of the
              rows listed, so a filter narrows it too. */}
          {byCountry.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">By country (trialling · paying):</span>
              {byCountry.map((row) => (
                <span
                  key={row.country}
                  className="px-2 py-0.5 rounded-full border border-border bg-muted text-foreground tabular-nums"
                >
                  <strong>{row.country}</strong> · {count(row.trialling)} trialling · {count(row.paying)} paying
                </span>
              ))}
            </div>
          )}

          <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
            {shown.map((c) => {
              const daysLeft = trialDaysLeft(c.trialEndsAt);
              const plan = c.subscription?.plan?.name;
              const presence = badgeFor(c);

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
                      {/* Right beside the name: the first thing the owner
                          wants to know about a new company is whether anyone
                          is actually in it. */}
                      <PresenceBadge badge={presence} />
                      {c.isDemo ? (
                        /* A demo has no onboarding and no checkout to finish;
                           printing "pending" on it is a lie about a company
                           that was never going to pay. */
                        <span className="text-xs px-2 py-0.5 rounded-full border bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-900">
                          {c.demoRetiredAt
                            ? "Retired rep demo"
                            : c.demoOwnerRepId
                              ? "Rep demo"
                              : "Demo"}
                        </span>
                      ) : (
                        /* The API's derived status (lib/platform/
                           companyStanding.js), not onboardingStatus: that
                           column said "pending" about every card-free
                           trial. */
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border ${
                            STATUS_STYLES[c.standing?.tone || c.onboardingStatus] ||
                            "bg-muted text-muted-foreground border-border"
                          }`}
                          data-company-standing={c.standing?.key || c.onboardingStatus}
                        >
                          {c.standing?.label || c.onboardingStatus}
                        </span>
                      )}
                      {/* The row's own status badge says "pending", which is
                          what onboardingStatus holds for a company that never
                          reached Stripe — and it says the same for one that is
                          mid-onboarding with a card on file. This badge is what
                          separates them, on the row, without opening anything.
                          Keyed off the subscription the API already includes,
                          not off a second query or a guess. */}
                      {/* Since 2026-09-24 a company with no subscription and a
                          trial date is a card-free TRIAL, not an abandoned
                          checkout (lib/billing/access.js trialAccessFor); the
                          badge says which, and how long is left. */}
                      {/* The trial's own words are the status badge now
                          (standing, above); only an unfinished signup still
                          needs this second badge. */}
                      {!c.subscription && !c.isDemo && !c.trialEndsAt && (
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
                      {c.isDemo ? "Not billed" : plan || "No plan"}
                    </div>
                    {/* Was `{c.subscription.status}` — the raw enum, so a
                        company FieldQuo cannot currently bill said "past_due"
                        in the same grey as "active", on the screen support
                        opens first. Same table the money screen uses. */}
                    {c.subscription?.status && (
                      <div className="mt-0.5 flex justify-end">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border ${statusMeta(c.subscription.status).className}`}
                        >
                          {statusMeta(c.subscription.status).label}
                        </span>
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
