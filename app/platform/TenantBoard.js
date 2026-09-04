// app/platform/TenantBoard.js
//
// How the companies using FieldQuo are actually doing.
//
// ── Why this replaced three totals ─────────────────────────────────────────
//
// The tenant tab showed quoted value, invoiced value and quotes this month.
// That answers "is anything happening" and stops. It could not have told you
// that fifteen of nineteen companies have never written a single quote — which
// is, on today's data, the most important fact about the business.
//
// ── Every number here refuses to lie about its own confidence ──────────────
//
// Rates below the sample floor render as "—" with a "too few" note rather than
// a percentage. A dashboard that prints "100%" from one quote is worse than a
// blank, because somebody acts on it. See lib/analytics/tenantHealth.js.
"use client";

import { useEffect, useState } from "react";
import {
  Loader2, TrendingDown, Users, Hammer, Timer, Sparkles, AlertCircle,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import CompanyInsight from "./CompanyInsight";

// The bare "$" is knowingly wrong when the book is not all one currency: these
// are sums across tenants, and a euro invoice is in the total. Not fixed here
// because which fix is right is a product decision — the three options and what
// each costs are written out beside money() in lib/platform/metricFormat.js.
// Same caveat applies to CompanyInsight.js and to app/platform/page.js.
const money = (n) =>
  n === null || n === undefined
    ? "—"
    : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const rate = (n) => (n === null || n === undefined ? "—" : `${n}%`);

export default function TenantBoard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  // Which company's drill-down is open. Null closes it.
  const [openCompany, setOpenCompany] = useState(null);

  useEffect(() => {
    fetchJson("/api/platform/analytics/tenants")
      .then(setData)
      .catch((err) => setError(err?.message || "Couldn't load tenant analytics."));
  }, []);

  if (error) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-sm text-muted-foreground">
        {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
        <Loader2 size={14} className="animate-spin" /> Working out how everyone
        is doing…
      </div>
    );
  }

  const { funnel, trades, health, adoption, speed } = data;

  return (
    <div className="space-y-8">
      {/* ── Activation, first, because it is the finding ────────────────────
          15 of 19 companies never wrote a quote. No amount of funnel detail
          matters more than that, so it is not buried under it. */}
      {health.counts.neverQuoted > 0 && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-200">
                {health.counts.neverQuoted} of {health.counts.total} companies
                have never written a quote
              </h3>
              <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                {rate(health.activation.rate)} of companies reach their first
                quote
                {health.activation.medianDaysToFirstQuote !== null &&
                  `, and those that do take a median of ${health.activation.medianDaysToFirstQuote} day(s)`}
                . A company that never quotes never sees what it is paying for.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── The funnel ──────────────────────────────────────────────────── */}
      <section>
        <SectionHead
          icon={TrendingDown}
          title="The funnel"
          hint="Each step measured against the one before it — a single quote-to-paid number hides which step leaks."
        />
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {funnel.stages.map((s) => (
            <div key={s.key} className="flex items-center gap-4 px-5 py-3">
              <div className="w-40 text-sm text-foreground">{s.label}</div>
              <div className="w-16 text-sm font-semibold tabular-nums text-foreground">
                {s.count}
              </div>
              <div className="flex-1">
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-foreground/70"
                    style={{
                      width: `${Math.min(100, s.rate ?? (funnel.stages[0].count ? (s.count / funnel.stages[0].count) * 100 : 0))}%`,
                    }}
                  />
                </div>
              </div>
              <div
                className="w-20 text-right text-xs tabular-nums text-muted-foreground"
                title={s.rate === null && s.rateLabel !== "—" ? "Too few to state a percentage — showing the raw ratio" : undefined}
              >
                {s.rateLabel ?? rate(s.rate)}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Win rate {funnel.winRateLabel ?? rate(funnel.winRate)} — accepted out of{" "}
          <em>sent</em>, because a quote nobody sent was never lost.
          {funnel.unanswered > 0 &&
            ` ${funnel.unanswered} still waiting on an answer.`}
        </p>
      </section>

      {/* ── By trade ────────────────────────────────────────────────────── */}
      <section>
        <SectionHead
          icon={Hammer}
          title="By trade"
          hint="A quote covering three trades counts once under each, valued by its own scope — a $30k kitchen doesn't credit $30k to flooring."
        />
        {trades.length === 0 ? (
          <Empty>No quotes carry a trade yet.</Empty>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  <Th className="text-left">Trade</Th>
                  <Th>Companies</Th>
                  <Th>Quotes</Th>
                  <Th>Won</Th>
                  <Th>Win rate</Th>
                  <Th>Median quote</Th>
                  <Th>Pipeline</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {trades.map((t) => (
                  <tr key={t.categoryKey}>
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      {t.label}
                    </td>
                    <Td>{t.companies}</Td>
                    <Td>{t.quotes}</Td>
                    <Td>{t.accepted}</Td>
                    <Td>
                      {/* A fraction below the sample floor, a percentage above
                          it. A blank here read as broken software — see
                          formatRate in tenantHealth.js. */}
                      <span
                        className={t.winRate === null ? "text-muted-foreground" : ""}
                        title={
                          t.winRate === null
                            ? `Only ${t.sent} sent — too few to state a percentage, so the raw ratio is shown`
                            : undefined
                        }
                      >
                        {t.winRateLabel}
                      </span>
                    </Td>
                    <Td>{money(t.medianQuote)}</Td>
                    <Td>{money(t.pipelineValue)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Who is actually using it ────────────────────────────────────── */}
      <section>
        <SectionHead
          icon={Users}
          title="Company health"
          hint="Dormant means no quote in 30 days. Not churn — churn is a billing event, and a roofer quiet through February is seasonal."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Active" value={health.counts.active} note="quoted in the last 30 days" />
          <Stat
            label="Dormant"
            value={health.counts.dormant}
            note="no quote in 30 days"
            warn={health.counts.dormant > 0}
          />
          <Stat
            label="Never quoted"
            value={health.counts.neverQuoted}
            note="signed up, never used it"
            warn={health.counts.neverQuoted > 0}
          />
          <Stat
            label="Activation"
            value={rate(health.activation.rate)}
            note="reach a first quote"
          />
        </div>

        {health.needsAttention.length > 0 && (
          <div className="mt-4 bg-card border border-border rounded-xl p-5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Gone quiet — named, because "3 dormant" isn't something you can act on
            </h4>
            <ul className="space-y-1.5">
              {health.needsAttention.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setOpenCompany({ id: c.id, name: c.name })}
                    className="w-full flex justify-between text-sm gap-4 text-left hover:bg-muted rounded px-2 -mx-2 py-1"
                  >
                    <span className="text-foreground truncate underline decoration-dotted underline-offset-2">
                      {c.name}
                    </span>
                    <span className="text-muted-foreground shrink-0 tabular-nums">
                      {c.quotes} quote(s) · quiet {c.daysSinceLastQuote}d
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ── Adoption and speed ──────────────────────────────────────────── */}
      <section>
        <SectionHead
          icon={Sparkles}
          title="What they actually use"
          hint="Counted per company — one tenant generating four hundred instant quotes is one company that adopted the feature."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Instant quotes"
            value={`${adoption.instantQuotes.companies}/${adoption.totalCompanies}`}
            note={`${rate(adoption.instantQuotes.rate)} of companies`}
          />
          <Stat
            label="Invoicing"
            value={`${adoption.invoicing.companies}/${adoption.totalCompanies}`}
            note={`${rate(adoption.invoicing.rate)} of companies`}
          />
          <Stat
            label="Instant share of quotes"
            value={rate(adoption.quoteMix.instantShare)}
            note={`${adoption.quoteMix.instant} instant · ${adoption.quoteMix.manual} hand-built`}
          />
          <Stat
            label="Trades covered"
            value={trades.length}
            note="with at least one quote"
          />
        </div>
      </section>

      <section>
        <SectionHead
          icon={Timer}
          title="Speed"
          hint="Both of these started collecting recently. Quotes decided before then carry no claim about how long they took, and are excluded rather than counted as zero."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Median build time"
            value={
              speed.compose.median === null
                ? "—"
                : `${speed.compose.median}s`
            }
            note={
              speed.compose.count
                ? `${speed.compose.underMinute} of ${speed.compose.count} under a minute`
                : "no measured quotes yet"
            }
          />
          <Stat
            label="Fastest quote"
            value={speed.compose.fastest === null ? "—" : `${speed.compose.fastest}s`}
            note="active build time"
          />
          <Stat
            label="Client decision"
            value={
              speed.decision.medianDays === null
                ? "—"
                : `${speed.decision.medianDays}d`
            }
            note={
              speed.decision.count
                ? `median across ${speed.decision.count}`
                : "no decisions timed yet"
            }
          />
          <Stat
            label="Decline reasons"
            value={data.declineReasonCount}
            note="captured since we started asking"
          />
        </div>
      </section>

      {/* ── Every company, drillable ───────────────────────────────────────
          The "gone quiet" list above is the call list; this is everyone,
          because a call is sometimes to tell somebody they are doing well. */}
      <section>
        <SectionHead
          icon={Users}
          title="All companies"
          hint="Open one to see its numbers against the median across everyone else — written for the phone call."
        />
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {health.companies.map((c) => (
            <button
              key={c.id}
              onClick={() => setOpenCompany({ id: c.id, name: c.name })}
              className="w-full px-5 py-3 flex items-center justify-between gap-4 text-left hover:bg-muted"
            >
              <div className="min-w-0">
                <div className="text-sm text-foreground truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {c.trades.length ? c.trades.slice(0, 3).join(" · ") : "No trades switched on"}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm tabular-nums text-foreground">
                  {c.quotes} quote(s)
                </div>
                <div className="text-xs text-muted-foreground">
                  {c.state === "never_quoted"
                    ? "never quoted"
                    : c.state === "dormant"
                      ? `quiet ${c.daysSinceLastQuote}d`
                      : "active"}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <CompanyInsight
        companyId={openCompany?.id}
        name={openCompany?.name}
        onClose={() => setOpenCompany(null)}
      />
    </div>
  );
}

function SectionHead({ icon: Icon, title, hint }) {
  return (
    <div className="mb-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        <Icon size={13} />
        {title}
      </h2>
      {hint && <p className="text-xs text-muted-foreground/80 mt-1 max-w-2xl">{hint}</p>}
    </div>
  );
}

function Stat({ label, value, note, warn }) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        warn
          ? "border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40"
          : "border-border bg-card"
      }`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-foreground tabular-nums">
        {value}
      </div>
      {note && <div className="text-xs text-muted-foreground mt-0.5">{note}</div>}
    </div>
  );
}

const Th = ({ children, className = "" }) => (
  <th className={`px-4 py-2.5 font-semibold ${className || "text-right"}`}>{children}</th>
);
const Td = ({ children }) => (
  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{children}</td>
);
const Empty = ({ children }) => (
  <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
    {children}
  </div>
);
