// app/platform/analytics/page.js
//
// Where fieldquo.com's traffic goes — the owner's question, answered from
// FieldQuo's own page-view count (lib/analytics/product/) and nothing else.
//
// Four sections, one date range and one demo toggle applied to all of them by
// the same request (/api/platform/analytics/product):
//
//   Marketing site   views by page, language, referrer and source; the
//                    signup funnel as a bar per step ("reached this step or
//                    later", so it is monotone) with where visitors stopped;
//                    FieldQuo's own ad campaigns as campaign ▸ ad set ▸ ad
//                    with signups / trials / paying, and the URL-parameters
//                    string to paste into Meta Ads Manager; the help
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

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

const CARD = "rounded-xl border border-border bg-card p-4 space-y-3";
const FIELD = "border border-border rounded-lg px-3 py-2 min-h-[44px] lg:min-h-[36px] text-sm bg-card text-foreground";
const TAB = "px-3 py-2 min-h-[44px] lg:min-h-[36px] rounded-lg text-sm font-medium";

const num = (n) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("en-CA"));
const pct = (n) => (n === null || n === undefined ? "—" : `${n}%`);

const RANGE_LABELS = { 1: "Today", 7: "Last 7 days", 30: "Last 30 days", 90: "Last 90 days", 365: "Last year" };

// The card-free signup since 2026-09-24 (lib/analytics/product/events.js
// SIGNUP_FUNNEL). Each label is a step COMPLETED; the hint says what proves it.
const STEP_LABELS = {
  visited: "Visited /signup",
  account_submitted: "Account submitted",
  team: "Team",
  goals: "Goals",
  trades: "Trades",
  services: "Services",
  trial_started: "Trial started",
};
const STEP_HINTS = {
  visited: "opened the signup page",
  account_submitted: "login and company details accepted — the Team screen was shown",
  team: "answered or skipped — the Goals screen was shown",
  goals: "answered or skipped — the Trades screen was shown",
  trades: "picked a trade — the Services screen was shown",
  services: "picked services and pressed “Start my free trial”",
  trial_started: "a company that finished signup (card-free trial or subscription), tied to this browser",
};
const STOPPED_LABELS = {
  visited: "Left without submitting the account",
  account_submitted: "Stopped on Team",
  team: "Stopped on Goals",
  goals: "Stopped on Trades",
  trades: "Stopped on Services",
  services: "Pressed Start, no company yet",
};
const CAMPAIGN_COLUMNS = [
  ["views", "Views", "Landings on fieldquo.com carrying this campaign (the first page of each visit)."],
  ["visitors", "Visitors", "Distinct browsers among those landings (raw window only)."],
  ["signups", "Signups started", "Signups that got past the account step, attributed to their first ad touch."],
  ["trials", "Trials started", "Of those, companies that finished signup — card-free trial or subscription."],
  ["paying", "Paying", "Of those, companies on a paid, active subscription today."],
];
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
function RankTable({ rows, label, empty, showCompanies = false, showUniques = true, labelFor = (k) => k, total = null, uniquesBasis = "range" }) {
  if (!rows?.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="py-1 pr-3 font-medium">{label}</th>
            <th className="py-1 pr-3 font-medium text-right">Views</th>
            {showUniques ? (
              <th className="py-1 pr-3 font-medium text-right" title={uniquesBasis === "range" ? "One browser counts once for the whole range." : "Past 30 days only daily counts are kept: a browser counts once per day it came."}>
                {uniquesBasis === "range" ? "Visitors" : "Visitor-days"}
              </th>
            ) : null}
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

function Funnel({ funnel, rangeLabel }) {
  const max = Math.max(1, ...funnel.steps.map((s) => s.count));
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {funnel.basis === "visitors"
          ? `How many browsers completed each step, ${rangeLabel.toLowerCase()} — one browser counts once, and a browser counts at every step up to the furthest one it proved ("reached this step or later"), so a resume link that lands on Services, or a step whose beacon was lost, can never make a later bar taller than an earlier one.`
          : `Past 30 days only daily counts are kept, with no browser behind them: each bar is the largest count at that step or after it (a floor, kept monotone), a person who came back twice counts twice, and "Trial started" is the companies themselves.`}
        {" "}Signup takes no card and has no plan step since 24 September 2026. Team and Goals sent no beacon before 25 September, so a browser that stopped on them before then counts only as &ldquo;Account submitted&rdquo;.
      </p>
      <div className="space-y-2">
        {funnel.steps.map((s) => (
          <div key={s.key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] sm:grid-cols-[minmax(0,14rem)_1fr_auto] gap-3 items-center text-sm">
            <span className="min-w-0">
              <span className="block text-foreground truncate">{STEP_LABELS[s.key] || s.key}</span>
              <span className="block text-[11px] leading-tight text-muted-foreground truncate" title={STEP_HINTS[s.key] || ""}>{STEP_HINTS[s.key] || ""}</span>
            </span>
            <div className="h-5 rounded bg-muted overflow-hidden">
              <div className="h-full bg-primary/70" style={{ width: `${Math.max(1, Math.round((s.count / max) * 100))}%` }} />
            </div>
            <span className="tabular-nums text-right whitespace-nowrap">
              <span className="text-foreground font-medium">{num(s.count)}</span>
              {s.dropPct !== null && s.dropPct > 0 ? <span className="text-xs text-muted-foreground"> −{s.dropPct}%</span> : null}
            </span>
          </div>
        ))}
      </div>
      {/* The reconciliation the owner asked for: the funnel's last bar beside
          the number every other console screen prints for "finished signup". */}
      {funnel.companiesFinished !== undefined && funnel.companiesFinished !== null ? (
        <p className="text-xs text-muted-foreground" data-funnel-reconcile>
          <span className="text-foreground font-medium">{num(funnel.companiesFinished)}</span>{" "}
          {funnel.companiesFinished === 1 ? "company" : "companies"} finished signup in this range (card-free trial or subscription — the same rule as Billing and Signups)
          {funnel.companiesLinked !== null && funnel.companiesLinked !== undefined
            ? `; ${num(funnel.companiesLinked)} of them ${funnel.companiesLinked === 1 ? "is" : "are"} tied to a browser above. The rest signed up with the browser's storage blocked, on another device than the one that browsed, or before the signup capture began (21 September 2026).`
            : "."}
          {funnel.excluded ? ` ${num(funnel.excluded)} ${funnel.excluded === 1 ? "browser" : "browsers"} sent signup steps with no page view at all — a developer's laptop before 25 September, when the beacon skipped views on localhost but not steps — and ${funnel.excluded === 1 ? "is" : "are"} left out.` : ""}
        </p>
      ) : null}
      {funnel.stoppedAt ? (
        <div>
          <p className="text-xs font-medium text-foreground mt-2">Stopped at</p>
          <p className="text-xs text-muted-foreground mb-1">
            Where each browser that did not start a trial stopped — its furthest step{funnel.stoppedAtFrom ? ` (raw rows since ${funnel.stoppedAtFrom})` : ""}. Percentages are of those browsers.
          </p>
          <ul className="text-sm grid gap-1 sm:grid-cols-2">
            {funnel.stoppedAt.map((s) => (
              <li key={s.key} className="flex justify-between gap-3 border-t border-border py-1">
                <span className="text-foreground">{STOPPED_LABELS[s.key] || s.key}</span>
                <span className="tabular-nums text-muted-foreground">{num(s.count)} · {pct(s.pct)}</span>
              </li>
            ))}
          </ul>
          {/* Who those browsers were. The funnel counts visits; the signup
              capture (lib/signup/leads.js) keeps what they typed, and the
              ones that left a phone number are hot leads in the review
              folder until the owner hands them to a rep. */}
          {funnel.signupLeads ? (
            <p className="text-xs text-muted-foreground mt-2" data-funnel-signup-leads>
              Behind the drop: <span className="text-foreground font-medium">{num(funnel.signupLeads.started)}</span>{" "}
              {funnel.signupLeads.started === 1 ? "person" : "people"} typed an email and a name, company or number in this range and never finished
              {funnel.signupLeads.pastAccount !== undefined ? (
                <>
                  {" "}(<span className="text-foreground font-medium">{num(funnel.signupLeads.pastAccount)}</span> of them got past the account step)
                </>
              ) : null}
              {" · "}
              <span className="text-foreground font-medium">{num(funnel.signupLeads.withPhone)}</span> left a phone number
              {" · "}
              <a href={funnel.signupLeads.reviewHref} className="underline text-foreground">
                {num(funnel.signupLeads.hotWaiting)} hot {funnel.signupLeads.hotWaiting === 1 ? "lead" : "leads"} waiting to be assigned
              </a>
              {" · "}
              <a href={funnel.signupLeads.signupsHref} className="underline">every started signup</a>
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No raw rows in this range yet, so &ldquo;stopped at&rdquo; cannot be read.</p>
      )}
    </div>
  );
}

/**
 * Copy with an honest answer. navigator.clipboard is missing on http, in
 * some in-app browsers and when permission is refused; then the text is
 * selected for a manual copy and the button says it did NOT copy.
 */
function CopyField({ value, label, rows = 3 }) {
  const [state, setState] = useState("idle"); // idle | copied | failed
  const ref = useRef(null);
  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
      try {
        ref.current?.focus();
        ref.current?.select();
      } catch {
        // selection is a courtesy; the message below still tells the truth
      }
    }
    setTimeout(() => setState("idle"), 4000);
  }
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-foreground">{label}</label>
      <textarea
        ref={ref}
        readOnly
        value={value}
        rows={rows}
        onFocus={(e) => e.target.select()}
        className="w-full font-mono text-xs rounded-lg border border-border bg-muted/40 p-2 text-foreground break-all"
      />
      <div className="flex items-center gap-2">
        <button type="button" onClick={copy} className={`${TAB} border border-border text-foreground hover:bg-muted`}>
          Copy
        </button>
        <span className="text-xs" role="status" aria-live="polite">
          {state === "copied" ? <span className="text-foreground">Copied to the clipboard.</span> : null}
          {state === "failed" ? <span className="text-red-700 dark:text-red-400">Could not copy — the text is selected; press Ctrl/⌘+C.</span> : null}
        </span>
      </div>
    </div>
  );
}

/** "Campaign 1202… (name not sent)" rather than an invented name. */
function adLabel(node, kind) {
  if (node.name) return node.name;
  if (node.id) return `${kind} ${node.id} (name not sent)`;
  return kind === "Campaign" ? "(no campaign)" : `(${kind.toLowerCase()} not sent)`;
}
const MACRO_FOR = { Campaign: "{{campaign.name}}", "Ad set": "{{adset.name}}", Ad: "{{ad.name}}" };

function CampaignRow({ node, kind, depth, open, onToggle }) {
  const children = node.adsets || node.ads || null;
  const expandable = Boolean(children?.length) && !(children.length === 1 && children[0].key === "none");
  return (
    <tr className="border-t border-border align-top">
      <td className="py-1.5 pr-3" style={{ paddingLeft: `${depth * 1}rem` }}>
        <div className="flex items-start gap-1.5 min-w-0">
          {expandable ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              aria-label={`${open ? "Collapse" : "Expand"} ${adLabel(node, kind)}`}
              className="shrink-0 mt-0.5 h-5 w-5 rounded border border-border text-xs leading-none text-foreground hover:bg-muted"
            >
              {open ? "−" : "+"}
            </button>
          ) : (
            <span className="shrink-0 w-5" aria-hidden="true" />
          )}
          <span className="min-w-0">
            <span className="block text-xs text-muted-foreground">{kind}</span>
            <span className="block text-sm text-foreground break-words">{adLabel(node, kind)}</span>
            {node.nameMissing ? (
              <span className="block text-[11px] text-muted-foreground">Name not sent — add {MACRO_FOR[kind]} to the URL parameters.</span>
            ) : null}
            {node.name && node.id ? <span className="block text-[11px] text-muted-foreground font-mono">id {node.id}</span> : null}
          </span>
        </div>
      </td>
      {CAMPAIGN_COLUMNS.map(([k]) => (
        <td key={k} className="py-1.5 pr-3 text-right tabular-nums text-foreground whitespace-nowrap">
          {k === "visitors" ? num(node.visitors) : num(node.metrics?.[k] ?? 0)}
        </td>
      ))}
    </tr>
  );
}

function CampaignTable({ report }) {
  const [open, setOpen] = useState(() => new Set());
  const toggle = (key) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  if (!report) return <p className="text-sm text-muted-foreground">The campaign table could not be read this time.</p>;
  if (!report.campaigns.length) return <p className="text-sm text-muted-foreground">No landing in this range named a campaign, ad set or ad.</p>;
  const body = [];
  for (const c of report.campaigns) {
    const ck = `c|${c.key}`;
    body.push(<CampaignRow key={ck} node={c} kind="Campaign" depth={0} open={open.has(ck)} onToggle={() => toggle(ck)} />);
    if (!open.has(ck)) continue;
    for (const s of c.adsets) {
      const sk = `${ck}|s|${s.key}`;
      body.push(<CampaignRow key={sk} node={s} kind="Ad set" depth={1} open={open.has(sk)} onToggle={() => toggle(sk)} />);
      if (!open.has(sk)) continue;
      for (const a of s.ads) body.push(<CampaignRow key={`${sk}|a|${a.key}`} node={a} kind="Ad" depth={2} open={false} onToggle={() => {}} />);
    }
  }
  const u = report.untagged;
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full text-sm min-w-[36rem]">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="py-1 pr-3 font-medium">Campaign ▸ ad set ▸ ad</th>
            {CAMPAIGN_COLUMNS.map(([k, label, title]) => (
              <th key={k} className="py-1 pr-3 font-medium text-right" title={title}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body}
          <tr className="border-t-2 border-border text-muted-foreground">
            <td className="py-1.5 pr-3 text-xs">No campaign on the landing (direct, organic, untagged links)</td>
            {CAMPAIGN_COLUMNS.map(([k]) => (
              <td key={k} className="py-1.5 pr-3 text-right tabular-nums text-xs">{k === "visitors" ? num(u.visitors) : num(u.metrics?.[k] ?? 0)}</td>
            ))}
          </tr>
        </tbody>
      </table>
      {report.totalCampaigns > report.campaigns.length ? (
        <p className="text-xs text-muted-foreground mt-1">Showing the top {report.campaigns.length} of {report.totalCampaigns} campaigns by views.</p>
      ) : null}
    </div>
  );
}

const SITE_SOURCE_NAMES = { fb: "Facebook (fb)", ig: "Instagram (ig)", msg: "Messenger (msg)", an: "Audience Network (an)", th: "Threads (th)" };

function MetaTemplate({ params, doc }) {
  return (
    <div className="space-y-3">
      <CopyField value={params} label="URL parameters — paste into Meta Ads Manager" rows={4} />
      <ol className="text-xs text-muted-foreground list-decimal pl-5 space-y-1">
        <li>In Ads Manager, open the campaign and go to the <span className="text-foreground">Ad</span> level (the setting is per ad; set it when you create the campaign and every new ad in it starts with it).</li>
        <li>Scroll to <span className="text-foreground">Tracking</span> → <span className="text-foreground">URL parameters</span> → &ldquo;Build a URL parameter&rdquo;, or paste the string above straight into the field. Leave the braces as they are — Meta fills them in per click.</li>
        <li>Publish. Names are fixed when an ad is first published: renaming a campaign later does not change what arrives here.</li>
      </ol>
      <p className="text-xs text-muted-foreground">
        <span className="text-foreground">utm_source stays &ldquo;facebook&rdquo;</span> for every placement on purpose. Where the ad actually ran is read from{" "}
        <span className="font-mono">site_source_name</span> (fb, ig, msg, an, th) and the placement, so an Instagram Story counts as Instagram here even though
        Meta also stamps its click id on it. Macro names are Meta&apos;s:{" "}
        <a href={doc} target="_blank" rel="noopener noreferrer" className="underline text-foreground">Specifications for dynamic URL parameters</a>.
      </p>
      <p className="text-xs text-muted-foreground">
        What FieldQuo keeps: the parameters above and whether a click id was present — never the click id itself, no cookie, no IP. Nothing is sent back
        to Meta from here.
      </p>
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
            {(data?.range?.options || [1, 7, 30, 90, 365]).map((d) => (
              <option key={d} value={d}>{RANGE_LABELS[d] || `Last ${d} days`}</option>
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
                <Funnel funnel={data.funnel} rangeLabel={RANGE_LABELS[data.range.days] || `Last ${data.range.days} days`} />
              </section>
              <section className={CARD} data-campaign-table>
                <h2 className="text-base font-semibold text-foreground">Ad campaigns</h2>
                <p className="text-xs text-muted-foreground">
                  Campaign ▸ ad set ▸ ad (tap + to open one). Views and visitors are landings on fieldquo.com
                  {data.campaigns?.olderDaysFromDaily ? ` — ad sets and ads from ${data.campaigns.rawFrom}; days before that add campaign-level views from the daily counts, with no visitor figure` : ""}.
                  Signups, trials and paying are signups that STARTED in the range, each credited to its first ad touch — the earliest landing
                  of that browser that named a campaign — whenever it finished. Spellings are merged (&ldquo;new+traffic+campaign&rdquo; is
                  &ldquo;new traffic campaign&rdquo;), and a campaign is grouped by its Meta id when any landing carried one.
                </p>
                <CampaignTable report={data.campaigns} />
                {data.campaigns ? (
                  <p className="text-xs text-muted-foreground">
                    How each signup was credited: {num(data.campaigns.attributionBasis.stored)} from the first touch kept on the signup,{" "}
                    {num(data.campaigns.attributionBasis.visitor)} read from the browser&apos;s landings, {num(data.campaigns.attributionBasis.link)} from
                    the /signup link&apos;s own tags, {num(data.campaigns.attributionBasis.none)} with no campaign.
                    {data.campaigns.truncated ? " The landing read hit its cap; views are a floor." : ""}
                  </p>
                ) : null}
              </section>
              <section className={CARD} data-meta-template>
                <h2 className="text-base font-semibold text-foreground">Meta Ads: URL parameters for FieldQuo&apos;s own ads</h2>
                <MetaTemplate params={data.campaigns?.urlParameters || ""} doc={data.campaigns?.urlParametersDoc || "https://www.facebook.com/business/help/2360940870872492"} />
                {data.campaigns ? (
                  <div className="grid gap-4 sm:grid-cols-3 pt-1">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Where the ad ran (site_source_name)</h3>
                      {data.campaigns.breakdowns.siteSources.length ? (
                        <ul className="text-xs mt-1 space-y-0.5">
                          {data.campaigns.breakdowns.siteSources.map((r) => (
                            <li key={r.key} className="flex justify-between gap-2"><span className="text-foreground">{SITE_SOURCE_NAMES[r.key] || r.key}</span><span className="tabular-nums text-muted-foreground">{num(r.count)}</span></li>
                          ))}
                        </ul>
                      ) : <p className="text-xs text-muted-foreground mt-1">Not sent yet — landings carry it once the string above is on the ads.</p>}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Placement</h3>
                      {data.campaigns.breakdowns.placements.length ? (
                        <ul className="text-xs mt-1 space-y-0.5">
                          {data.campaigns.breakdowns.placements.map((r) => (
                            <li key={r.key} className="flex justify-between gap-2"><span className="text-foreground font-mono break-all">{r.key}</span><span className="tabular-nums text-muted-foreground">{num(r.count)}</span></li>
                          ))}
                        </ul>
                      ) : <p className="text-xs text-muted-foreground mt-1">Not sent yet.</p>}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Medium and click id</h3>
                      <ul className="text-xs mt-1 space-y-0.5">
                        {data.campaigns.breakdowns.mediums.map((r) => (
                          <li key={r.key} className="flex justify-between gap-2"><span className="text-foreground font-mono break-all">utm_medium={r.key}</span><span className="tabular-nums text-muted-foreground">{num(r.count)}</span></li>
                        ))}
                        <li className="flex justify-between gap-2">
                          <span className="text-foreground">Landings with an fbclid</span>
                          <span className="tabular-nums text-muted-foreground">
                            {data.campaigns.breakdowns.paramLandings ? `${num(data.campaigns.breakdowns.fbclidLandings)} of ${num(data.campaigns.breakdowns.paramLandings)}` : "—"}
                          </span>
                        </li>
                      </ul>
                      <p className="text-[11px] text-muted-foreground mt-1">Placement, site source and click-id presence are known only for landings since 25 September (the fbclid count is out of those); older landings kept utm_source / utm_medium / utm_campaign alone.</p>
                    </div>
                  </div>
                ) : null}
              </section>
              <div className="grid gap-6 lg:grid-cols-2">
                <section className={CARD}>
                  <h2 className="text-base font-semibold text-foreground">Most viewed pages</h2>
                  <RankTable rows={data.marketing.pages} label="Page" empty="No marketing views in this range." uniquesBasis={data.uniquesBasis} />
                </section>
                <section className={CARD}>
                  <h2 className="text-base font-semibold text-foreground">By language</h2>
                  <RankTable rows={data.marketing.languages} label="Language" empty="No views yet." />
                  <h2 className="text-base font-semibold text-foreground pt-2">Where landings came from</h2>
                  <p className="text-xs text-muted-foreground">Facebook, Instagram, Google… from Meta&apos;s site_source_name / placement (or utm_source=ig), then the click id on the link, the UTM source, or the referrer — in that order. Before 25 September an Instagram ad click with an fbclid counted as facebook here. "direct" is a floor: a Facebook app link without an fbclid looks direct. AI assistants (chatgpt, claude, grok, perplexity, gemini, copilot) count when a person clicks a link they were given; the crawlers that read our pages never run the beacon.</p>
                  <RankTable rows={data.marketing.traffic} label="Source" empty="No landings recorded in this range." showUniques={false} />
                  <h2 className="text-base font-semibold text-foreground pt-2">By referrer</h2>
                  <RankTable rows={data.marketing.referrers} label="Referring site" empty="No outside referrers recorded — a direct visit or a link from our own pages carries none." showUniques={false} />
                </section>
                <section className={CARD}>
                  <h2 className="text-base font-semibold text-foreground">By source (utm_source)</h2>
                  <p className="text-xs text-muted-foreground">The tag as the link carried it. The Meta template keeps this at &ldquo;facebook&rdquo; for every placement — &ldquo;Where landings came from&rdquo; beside it is the one that splits Instagram out.</p>
                  <RankTable rows={data.marketing.sources} label="Source" empty="No UTM-tagged landings in this range." showUniques={false} />
                </section>
                <section className={CARD}>
                  <h2 className="text-base font-semibold text-foreground">Help centre</h2>
                  <p className="text-xs text-muted-foreground">Most-read articles, then what people searched for and did not find.</p>
                  <RankTable rows={data.help.articles} label="Article" empty="No help-centre views in this range." uniquesBasis={data.uniquesBasis} />
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
                  <RankTable rows={data.client.pages} label="Page" empty="No client-facing views in this range." uniquesBasis={data.uniquesBasis} />
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
