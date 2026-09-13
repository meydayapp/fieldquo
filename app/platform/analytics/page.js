// app/platform/analytics/page.js
//
// Where fieldquo.com's traffic goes — the owner's question, answered from
// FieldQuo's own page-view count (lib/analytics/product/) and nothing else.
//
// Four sections, one date range and one demo toggle applied to all of them by
// the same request (/api/platform/analytics/product):
//
//   Marketing site   views by page, language, referrer and campaign; the
//                    signup funnel as a bar per step with the drop-off
//                    between steps and where visitors stopped; the help
//                    centre's most-read articles and the searches that
//                    found nothing.
//   Product (/app)   every screen ranked most → least by views, with how
//                    many companies opened it ("used by 3 of 40"), the seven
//                    explicit actions (quote sent, invoice sent…) the same
//                    way, and the screens NOBODY opened in the range — the
//                    least-used answer, listed rather than left at the
//                    bottom of a long table.
//   Client-facing    the quote page, the booking page, the portal and the
//                    websites: views beside the outcome the product already
//                    records (approved / booked / paid / live).
//   One company      which screens a given company uses. Read-only; the
//                    console edits nothing (non-negotiable #3).
//
// Absent is not zero, here as on every other console tile: a unique-visitor
// figure the daily table does not know yet prints "—", never 0.
"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

const CARD = "rounded-xl border border-border bg-card p-4 space-y-3";
const FIELD = "border border-border rounded-lg px-3 py-2 min-h-[44px] lg:min-h-[36px] text-sm bg-card text-foreground";
const TAB = "px-3 py-2 min-h-[44px] lg:min-h-[36px] rounded-lg text-sm font-medium";

const num = (n) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("en-CA"));
const pct = (n) => (n === null || n === undefined ? "—" : `${n}%`);

const STEP_LABELS = {
  visited: "Visited /signup",
  account: "Account & company",
  trades: "Trades",
  services: "Services",
  plan: "Plan",
  checkout_started: "Checkout started",
  completed: "Completed (card entered)",
};
const ACTION_LABELS = {
  quote_sent: "Quote sent",
  invoice_sent: "Invoice sent",
  payment_collected: "Payment collected",
  booking_created: "Booking created",
  job_created: "Job created",
  message_sent: "Message sent",
  ai_review_run: "AI review run",
};
const CLIENT_SURFACES = {
  quote_approval: { label: "Quote approval page", outcome: "approved" },
  booking: { label: "Booking page", outcome: "booked" },
  portal: { label: "Client portal", outcome: "paid online" },
  website: { label: "Contractor websites", outcome: "sites live today" },
};

/** A horizontal bar scaled to the largest value in its table. */
function Bar({ value, max }) {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 rounded bg-muted overflow-hidden" aria-hidden="true">
      <div className="h-full bg-primary/70" style={{ width: `${w}%` }} />
    </div>
  );
}

/** Rows of {key, count, companies?, uniqueVisitors?} with a bar each. */
function RankTable({ rows, label, empty, showCompanies = false, showUniques = true, labelFor = (k) => k, total = null }) {
  if (!rows?.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="py-1 pr-3 font-medium">{label}</th>
            <th className="py-1 pr-3 font-medium text-right">Views</th>
            {showUniques ? <th className="py-1 pr-3 font-medium text-right">Visitors</th> : null}
            {showCompanies ? <th className="py-1 pr-3 font-medium text-right">Companies</th> : null}
            <th className="py-1 w-1/3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-border">
              <td className="py-1.5 pr-3 font-mono text-xs text-foreground break-all">{labelFor(r.key)}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums text-foreground">{num(r.count)}</td>
              {showUniques ? <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">{num(r.uniqueVisitors)}</td> : null}
              {showCompanies ? (
                <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">
                  {num(r.companies)}{total ? ` of ${num(total)}` : ""}
                </td>
              ) : null}
              <td className="py-1.5"><Bar value={r.count} max={max} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold text-foreground tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground mt-0.5">{hint}</p> : null}
    </div>
  );
}

function Funnel({ funnel }) {
  const max = Math.max(1, ...funnel.steps.map((s) => s.count));
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {funnel.basis === "visitors"
          ? "Distinct visitors per step (one browser counts once), from the raw rows of the last 30 days."
          : "Events per step — a ceiling on visitors, because the range reaches past the 30 days of raw rows and only daily counts remain."}
        {" "}&ldquo;Completed&rdquo; is stamped by the billing sync when the Subscription row exists, never by the browser.
      </p>
      <div className="space-y-2">
        {funnel.steps.map((s, i) => (
          <div key={s.key} className="grid grid-cols-[minmax(0,12rem)_1fr_auto] gap-3 items-center text-sm">
            <span className="text-foreground truncate">{STEP_LABELS[s.key] || s.key}</span>
            <div className="h-5 rounded bg-muted overflow-hidden">
              <div className="h-full bg-primary/70" style={{ width: `${Math.max(1, Math.round((s.count / max) * 100))}%` }} />
            </div>
            <span className="tabular-nums text-right whitespace-nowrap">
              <span className="text-foreground font-medium">{num(s.count)}</span>
              {i > 0 ? (
                <span className="text-xs text-muted-foreground"> · drop {pct(s.dropPct)}</span>
              ) : null}
              {i > 0 && s.ofFirstPct !== null ? <span className="text-xs text-muted-foreground"> · {pct(s.ofFirstPct)} of visited</span> : null}
            </span>
          </div>
        ))}
      </div>
      {funnel.stoppedAt ? (
        <div>
          <p className="text-xs font-medium text-foreground mt-2">Stopped at</p>
          <p className="text-xs text-muted-foreground mb-1">
            The last step each visitor reached{funnel.stoppedAtFrom ? ` (raw rows since ${funnel.stoppedAtFrom})` : ""}. &ldquo;Checkout started&rdquo; means they were handed to Stripe — whether they finished is the &ldquo;Completed&rdquo; bar above, which has no visitor behind it.
          </p>
          <ul className="text-sm grid gap-1 sm:grid-cols-2">
            {funnel.stoppedAt.map((s) => (
              <li key={s.key} className="flex justify-between gap-3 border-t border-border py-1">
                <span className="text-foreground">{STEP_LABELS[s.key] || s.key}</span>
                <span className="tabular-nums text-muted-foreground">{num(s.count)} · {pct(s.pct)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No raw rows in this range yet, so &ldquo;stopped at&rdquo; cannot be read.</p>
      )}
    </div>
  );
}

const SECTIONS = [
  ["marketing", "Marketing site"],
  ["product", "Product (/app)"],
  ["client", "Client-facing"],
  ["company", "One company"],
];

export default function PlatformAnalyticsPage() {
  const [range, setRange] = useState(30);
  const [demo, setDemo] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [section, setSection] = useState("marketing");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams({ range: String(range), demo: demo ? "1" : "0" });
      if (companyId) q.set("company", companyId);
      setData(await fetchJson(`/api/platform/analytics/product?${q}`));
    } catch (err) {
      setData(null);
      setError(err?.message || "Couldn't load analytics.");
    } finally {
      setLoading(false);
    }
  }, [range, demo, companyId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          FieldQuo&apos;s own page-view count: no third-party tracker, no cookie, no IP stored. Route patterns, not URLs — a quote page is
          &ldquo;/app/quotes/[id]&rdquo;, never the id. Raw hits are kept {data?.rawRetentionDays ?? 30} days and folded into daily counts after
          that; everything here reads the daily counts. Read-only.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-foreground flex items-center gap-2">
          Range
          <select value={range} onChange={(e) => setRange(Number(e.target.value))} className={FIELD}>
            {[7, 30, 90].map((d) => (
              <option key={d} value={d}>Last {d} days</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-foreground flex items-center gap-2 min-h-[44px] lg:min-h-0">
          <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} className="h-4 w-4" />
          Include demo companies
        </label>
        <div className="flex flex-wrap gap-1 ml-auto" role="tablist">
          {SECTIONS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={section === key}
              onClick={() => setSection(key)}
              className={`${TAB} ${section === key ? "bg-primary text-primary-foreground" : "border border-border text-foreground hover:bg-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-800 dark:text-red-200 flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="animate-spin" size={18} /> Loading…
        </div>
      ) : null}

      {data && !loading ? (
        <>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            {["marketing", "help", "app", "client", "sales", "platform"].map((s) => (
              <Stat key={s} label={`${s} views`} value={num(data.totals.bySurface[s])} />
            ))}
          </div>

          {section === "marketing" ? (
            <div className="space-y-6">
              <section className={CARD}>
                <h2 className="text-base font-semibold text-foreground">Signup funnel</h2>
                <Funnel funnel={data.funnel} />
              </section>
              <div className="grid gap-6 lg:grid-cols-2">
                <section className={CARD}>
                  <h2 className="text-base font-semibold text-foreground">Most viewed pages</h2>
                  <RankTable rows={data.marketing.pages} label="Page" empty="No marketing views in this range." />
                </section>
                <section className={CARD}>
                  <h2 className="text-base font-semibold text-foreground">By language</h2>
                  <RankTable rows={data.marketing.languages} label="Language" empty="No views yet." />
                  <h2 className="text-base font-semibold text-foreground pt-2">Where landings came from</h2>
                  <p className="text-xs text-muted-foreground">Facebook, Instagram, Google… from the click id on the link, the UTM source, or the referrer — in that order. "direct" is a floor: a Facebook app link without an fbclid looks direct. AI assistants (chatgpt, claude, grok, perplexity, gemini, copilot) count when a person clicks a link they were given; the crawlers that read our pages never run the beacon.</p>
                  <RankTable rows={data.marketing.traffic} label="Source" empty="No landings recorded in this range." showUniques={false} />
                  <h2 className="text-base font-semibold text-foreground pt-2">By referrer</h2>
                  <RankTable rows={data.marketing.referrers} label="Referring site" empty="No outside referrers recorded — a direct visit or a link from our own pages carries none." showUniques={false} />
                </section>
                <section className={CARD}>
                  <h2 className="text-base font-semibold text-foreground">By campaign (utm_campaign)</h2>
                  <RankTable rows={data.marketing.campaigns} label="Campaign" empty="No UTM-tagged landings in this range." showUniques={false} />
                  <h2 className="text-base font-semibold text-foreground pt-2">By source (utm_source)</h2>
                  <RankTable rows={data.marketing.sources} label="Source" empty="No UTM-tagged landings in this range." showUniques={false} />
                </section>
                <section className={CARD}>
                  <h2 className="text-base font-semibold text-foreground">Help centre</h2>
                  <p className="text-xs text-muted-foreground">Most-read articles, then what people searched for and did not find.</p>
                  <RankTable rows={data.help.articles} label="Article" empty="No help-centre views in this range." />
                  <h3 className="text-sm font-semibold text-foreground pt-2">Searches with no results</h3>
                  <RankTable rows={data.help.searchesEmpty} label="Query" empty="Every search in this range found something — or nobody searched." showUniques={false} />
                  <h3 className="text-sm font-semibold text-foreground pt-2">All searches</h3>
                  <RankTable rows={data.help.searches} label="Query" empty="No searches recorded." showUniques={false} />
                </section>
              </div>
            </div>
          ) : null}

          {section === "product" ? (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="/app views" value={num(data.totals.bySurface.app)} hint={`${num(data.product.companiesSeen)} companies seen`} />
                <Stat
                  label="Sales card gate"
                  value={data.product.salesGate.eligible ? "Showing to reps" : "Not yet"}
                  hint={`${num(data.product.salesGate.totalViews)} of ${num(data.product.salesGate.threshold)} views needed (last ${data.range.days} days; the card uses 30)`}
                />
                <Stat label="Companies (denominator)" value={num(data.product.totalCompanies)} hint={demo ? "including demo" : "excluding demo"} />
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <section className={CARD}>
                  <h2 className="text-base font-semibold text-foreground">Actions, most → least</h2>
                  <p className="text-xs text-muted-foreground">Recorded by the writer itself after the thing happened; a browser cannot send these.</p>
                  <RankTable
                    rows={data.product.actions}
                    label="Action"
                    empty="No actions recorded."
                    showCompanies
                    showUniques={false}
                    total={data.product.totalCompanies}
                    labelFor={(k) => ACTION_LABELS[k] || k}
                  />
                  {data.product.actionsNeverUsed.length ? (
                    <p className="text-xs text-muted-foreground">
                      Never in this range: {data.product.actionsNeverUsed.map((k) => ACTION_LABELS[k] || k).join(", ")}.
                    </p>
                  ) : null}
                </section>
                <section className={CARD}>
                  <h2 className="text-base font-semibold text-foreground">By language</h2>
                  <RankTable rows={data.product.languages} label="Language" empty="No /app views yet." />
                </section>
              </div>
              <section className={CARD}>
                <h2 className="text-base font-semibold text-foreground">Screens, most → least</h2>
                <p className="text-xs text-muted-foreground">
                  Every /app route pattern with views in the range. &ldquo;Companies&rdquo; is how many distinct companies opened it, of the {num(data.product.totalCompanies)} that could have.
                </p>
                <RankTable rows={data.product.pages} label="Screen" empty="No /app views in this range." showCompanies total={data.product.totalCompanies} />
              </section>
              <section className={CARD}>
                <h2 className="text-base font-semibold text-foreground">Never opened in this range ({data.product.neverUsed.length})</h2>
                <p className="text-xs text-muted-foreground">
                  The least-used answer: /app pages with zero views. Some are a step in a flow nobody reached (a new-visit form), some are a feature FieldQuo has hidden for every company — the row says which registry key gates it.
                </p>
                {data.product.neverUsed.length ? (
                  <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3 text-xs font-mono">
                    {data.product.neverUsed.map((p) => (
                      <li key={p.key} className="text-foreground break-all">
                        {p.key}
                        {p.feature?.feature ? <span className="text-muted-foreground font-sans"> · gated: {p.feature.feature}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Every /app page was opened at least once.</p>
                )}
              </section>
            </div>
          ) : null}

          {section === "client" ? (
            <div className="space-y-6">
              <section className={CARD}>
                <h2 className="text-base font-semibold text-foreground">Views and outcomes</h2>
                <p className="text-xs text-muted-foreground">
                  Views are the beacon&apos;s; outcomes are the product&apos;s own rows in the same range (Quote.acceptedAt, Booking, Stripe Payment) — the
                  writers already record them, so no second signal is invented. &ldquo;Sites live&rdquo; is today&apos;s count, not the range&apos;s.
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {data.client.surfaces.map((s) => (
                    <Stat
                      key={s.key}
                      label={CLIENT_SURFACES[s.key]?.label || s.key}
                      value={num(s.views)}
                      hint={`${num(s.outcomes)} ${CLIENT_SURFACES[s.key]?.outcome || s.outcome}`}
                    />
                  ))}
                </div>
              </section>
              <div className="grid gap-6 lg:grid-cols-2">
                <section className={CARD}>
                  <h2 className="text-base font-semibold text-foreground">Client-facing pages</h2>
                  <RankTable rows={data.client.pages} label="Page" empty="No client-facing views in this range." />
                </section>
                <section className={CARD}>
                  <h2 className="text-base font-semibold text-foreground">By language</h2>
                  <RankTable rows={data.client.languages} label="Language" empty="No views yet." />
                </section>
              </div>
            </div>
          ) : null}

          {section === "company" ? (
            <div className="space-y-6">
              <section className={CARD}>
                <label className="text-sm text-foreground flex flex-wrap items-center gap-2">
                  Company
                  <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={`${FIELD} min-w-[16rem]`}>
                    <option value="">Pick a company with /app views…</option>
                    {data.companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}{c.isDemo ? " (demo)" : ""}</option>
                    ))}
                  </select>
                </label>
                <p className="text-xs text-muted-foreground">Read-only: which screens this company opened and what it did, in the range. Nothing here changes a company&apos;s data.</p>
              </section>
              {data.company ? (
                <div className="grid gap-6 lg:grid-cols-2">
                  <section className={CARD}>
                    <h2 className="text-base font-semibold text-foreground">{data.company.name || data.company.id} — screens</h2>
                    <RankTable rows={data.company.pages} label="Screen" empty="No /app views for this company in the range." />
                  </section>
                  <section className={CARD}>
                    <h2 className="text-base font-semibold text-foreground">Actions</h2>
                    <RankTable rows={data.company.actions} label="Action" empty="No actions recorded." showUniques={false} labelFor={(k) => ACTION_LABELS[k] || k} />
                    <h2 className="text-base font-semibold text-foreground pt-2">Languages</h2>
                    <RankTable rows={data.company.languages} label="Language" empty="—" showUniques={false} />
                  </section>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
