"use client";

// app/platform/costs/page.js
//
// Where FieldQuo's money goes — Twilio, OpenAI, Retell, Neon, Stripe, the
// scrapers, the hand-entered bills — in three sections, and what it buys.
//
// ══ Three sections, because "FieldQuo's own $20" answered nothing ════════
//
// The owner read "OpenAI — FieldQuo's own $20.31" and asked how. It was the
// sales floor's research briefs. So the page is built as three businesses
// (lib/platform/costs/sections.js), in this order, each with its total in
// the heading beside last month's:
//
//   1. Sales floor      what FieldQuo spends to sell — the reps' calls,
//                       recordings, texts and numbers; the pipeline's AI by
//                       area with a count, tokens and what a unit costs;
//                       the prospect lookups. Per rep and per agency live
//                       here.
//   2. Companies        what FieldQuo spends serving customers, and beside
//                       each line what the companies were CHARGED for it.
//   3. Platform itself  database, hosting, email, maps, Stripe's fees on
//                       FieldQuo's own revenue, the bills typed in from
//                       invoices.
//
// ══ Every figure says where it came from and how old it is ═══════════════
//
// Every line carries provider · API-pulled / computed / hand-entered · when
// it was read. A figure that is not known prints as "unknown" with what is
// missing; a total with a missing part prints as a floor and says so; a
// provider whose key is not set prints "waiting for <VAR>" — not a spinner,
// not a zero. Nothing here is estimated, because the owner reads this page
// to decide what the floor costs him and an estimate that rounds a bill the
// right way is still a number he did not pay.
//
// ══ Superadmin-only ══════════════════════════════════════════════════════
//
// The API refuses everyone else; this page says so rather than showing a
// spinner that never ends.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { TWILIO_CATEGORY_LABELS } from "@/lib/platform/costs/dailyLedger";

const CARD = "rounded-xl border border-border bg-card p-4 space-y-3";
const BTN = "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const INPUT = "min-h-[44px] rounded-lg border border-border bg-card px-3 text-sm w-full";
const UNKNOWN = "unknown";

const money = (cents) => {
  if (cents === null || cents === undefined || !Number.isFinite(Number(cents))) return UNKNOWN;
  const d = Number(cents) / 100;
  if (d === 0) return "$0.00";
  return `$${d.toFixed(Math.abs(d) < 1 ? 4 : 2)}`;
};
const microsMoney = (micros) => (micros === null || micros === undefined ? UNKNOWN : money(Number(micros) / 10000));
const when = (iso) => (iso ? new Date(iso).toLocaleString() : "never");
const n = (v) => (v === null || v === undefined ? UNKNOWN : Number(v).toLocaleString("en-CA"));
const SOURCE_KIND = { api: "API-pulled", computed: "computed", hand: "hand-entered" };

const RANGE_LABELS = {
  day: "Today",
  week: "This week",
  month: "This month",
  prevmonth: "Last month",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  year: "This year",
};

export default function PlatformCostsPage() {
  const [range, setRange] = useState("month");
  const [by, setBy] = useState("");
  const [data, setData] = useState(null);
  const [prev, setPrev] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pulling, setPulling] = useState("");
  const [pullNote, setPullNote] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const q = new URLSearchParams({ range });
      if (by) q.set("by", by);
      setData(await fetchJson(`/api/platform/costs?${q.toString()}`));
    } catch (err) {
      setError(err?.message || "Could not load the costs.");
    } finally {
      setLoading(false);
    }
  }, [range, by]);

  useEffect(() => {
    load();
  }, [load]);

  // Last calendar month, for the section headings. Loaded after the main
  // read so it never slows the page; absent, the heading says so.
  useEffect(() => {
    let alive = true;
    fetchJson("/api/platform/costs?range=prevmonth")
      .then((r) => alive && setPrev(r))
      .catch(() => alive && setPrev({ error: true }));
    return () => {
      alive = false;
    };
  }, []);

  async function pullNow(provider) {
    setPulling(provider);
    setPullNote("");
    try {
      const r = await fetchJson("/api/platform/costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pull", provider, from: data?.period?.fromKey, to: data?.period?.toKey }),
      });
      setPullNote(`${provider}: pulled ${r.records} records for ${r.from}..${r.to}; ${r.written} rows written${r.dropped ? `; ${r.dropped} dropped` : ""}${r.failed?.length ? `; ${r.failed.join(", ")} failed` : ""}.`);
      await load();
    } catch (err) {
      setPullNote(err?.message || "The pull failed.");
    } finally {
      setPulling("");
    }
  }

  const prevSection = (key) => (prev?.sections ? prev.sections[key] : null);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">Costs</h1>
          <p className="text-sm text-muted-foreground break-words">
            What FieldQuo pays, in three parts: the sales floor, the companies it serves, and the
            platform itself. Every line says which provider, whether it was pulled from an API,
            computed from a ledger or typed in from an invoice, and when it was read. Nothing is
            estimated; what is not known says so.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="min-h-[44px] rounded-lg border border-border bg-card px-3 text-sm"
            value={range}
            onChange={(e) => setRange(e.target.value)}
            aria-label="Period"
          >
            {Object.entries(RANGE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            className="min-h-[44px] rounded-lg border border-border bg-card px-3 text-sm"
            value={by}
            onChange={(e) => setBy(e.target.value)}
            aria-label="Bucket"
          >
            <option value="">Rows: default</option>
            <option value="day">Rows: by day</option>
            <option value="week">Rows: by week</option>
            <option value="month">Rows: by month</option>
          </select>
          <button type="button" className={`${BTN} border border-border`} onClick={load}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </header>

      {error ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p className="break-words">{error}</p>
          </div>
        </div>
      ) : null}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="animate-spin" size={18} /> Reading the ledgers…
        </div>
      ) : null}

      {data ? (
        <>
          {/* ── The total, and the three parts of it ─────────────────── */}
          <section className={CARD} data-costs-total>
            <h2 className="text-base font-semibold text-foreground">
              {RANGE_LABELS[data.range] || data.range} · {data.period.fromKey} to {data.period.toKey}
            </h2>
            <p className="text-3xl font-semibold tabular-nums">
              {money(data.totals.knownCents)}
              {!data.totals.complete ? <span className="text-sm font-normal text-muted-foreground"> known so far — a floor</span> : null}
              {data.totals.includesHandEntered ? <span className="text-sm font-normal text-muted-foreground"> · includes hand-entered bills</span> : null}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {["sales", "companies", "platform"].map((key, i) => {
                const s = data.sections[key];
                const p = prevSection(key);
                return (
                  <a key={key} href={`#costs-${key}`} className="rounded-lg border border-border p-3 space-y-1 hover:bg-muted/40">
                    <p className="text-xs text-muted-foreground">{i + 1}. {s.title}</p>
                    <p className="text-xl font-semibold tabular-nums">
                      {money(s.totalCents)}{s.isFloor ? "+" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      last month {prev ? (prev.error ? UNKNOWN : `${money(p?.totalCents)}${p?.isFloor ? "+" : ""}`) : "…"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.sourceKinds.api} API-pulled · {s.sourceKinds.computed} computed · {s.sourceKinds.hand} hand-entered
                    </p>
                  </a>
                );
              })}
            </div>
          </section>

          {/* ── 1. Sales floor ───────────────────────────────────────── */}
          <SectionCard id="costs-sales" index={1} section={data.sections.sales} prev={prevSection("sales")} prevState={prev}>
            <SectionLines section={data.sections.sales} />

            {/* OpenAI: computed beside billed. The bill covers both this
                section's pipeline AI and the companies' AI, so it is
                reconciled here once and section 2 points at it. */}
            <div className="space-y-2 rounded-lg border border-border p-3" data-openai-reconciliation>
              <h3 className="text-sm font-semibold text-foreground">OpenAI — computed beside billed</h3>
              {!data.openai.billed.configured ? (
                <p className="text-sm text-muted-foreground break-words">
                  Computed {money(data.openai.billed.computedCents)} from the two AI ledgers (this section&rsquo;s pipeline AI{" "}
                  {microsMoney(data.openai.platform.micros)} + the companies&rsquo; AI {microsMoney(data.openai.tenants.micros)}).{" "}
                  <strong>Waiting for {data.openai.billed.envVar}</strong> — the organisation Costs endpoint needs an admin key, and
                  until it is set nothing billed is pulled and no reconciliation is possible. See docs/VERCEL.md.
                </p>
              ) : (
                <>
                  <p className="text-sm tabular-nums break-words">{data.openai.billed.reconciliation.statement}</p>
                  <p className="text-xs text-muted-foreground break-words">
                    Computed: the pipeline&rsquo;s AI {microsMoney(data.openai.platform.micros)} (section 1) + the companies&rsquo; AI{" "}
                    {microsMoney(data.openai.tenants.micros)} (section 2), vendor token counts × lib/ai/usage.js. Billed: {data.openai.billed.source}.
                    Last pulled {when(data.openai.billed.lastPullAt)} · {data.openai.billed.daysBilled} of {data.openai.billed.daysInPeriod} days have a billed row.
                  </p>
                  {data.openai.billed.byProject.length ? (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground">
                          <th className="py-1 pr-3 font-medium">Project · line item (OpenAI&rsquo;s names)</th>
                          <th className="py-1 pr-3 font-medium text-right">Billed</th>
                          <th className="py-1 font-medium text-right">Quantity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.openai.billed.byProject.map((p) => (
                          <PerProject key={p.projectId} project={p} />
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-xs text-muted-foreground">No billed rows for this period yet — the daily pull runs within the hour, or pull now below.</p>
                  )}
                </>
              )}
            </div>

            {/* Sales calls, composed — already inside the lines above. */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Sales calls, part by part</h3>
              <p className="text-xs text-muted-foreground break-words">
                The same money as the Twilio and transcript lines above, seen per call rather than per category — it is
                not added again. Source: {data.salesCalls.source}. As of {when(data.salesCalls.asOf)}.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-1 pr-3 font-medium">Part</th>
                      <th className="py-1 pr-3 font-medium text-right">Cost</th>
                      <th className="py-1 pr-3 font-medium text-right">Calls with it</th>
                      <th className="py-1 pr-3 font-medium text-right">Not yet known</th>
                      <th className="py-1 font-medium">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.salesCalls.parts.map((p) => (
                      <tr key={p.key} className="border-t border-border">
                        <td className="py-1.5 pr-3 capitalize">{p.key === "qa" ? "QA scoring" : p.key}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums whitespace-nowrap">{money(p.cents)}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{p.of}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{p.unknown || "—"}</td>
                        <td className="py-1.5 text-xs text-muted-foreground break-words">{p.source}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-border font-medium">
                      <td className="py-1.5 pr-3">Known total</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{money(data.salesCalls.knownCents)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{data.salesCalls.calls}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{data.salesCalls.unknownCalls || "—"}</td>
                      <td className="py-1.5 text-xs text-muted-foreground">{data.salesCalls.browserCalls} placed in the browser; handset calls carry no carrier figure</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* What it buys */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Cost per conversation</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {money(data.salesCalls.perConversation.cents)}
                  {data.salesCalls.perConversation.isFloor ? <span className="text-xs font-normal text-muted-foreground"> floor</span> : null}
                </p>
                <p className="text-xs text-muted-foreground break-words">
                  {data.salesCalls.connect.conversations} conversations — a connected call on which the contractor said{" "}
                  {data.salesCalls.connect.minContractorWords}+ words, from the transcript
                  {data.salesCalls.connect.awaitingTranscript ? `; ${data.salesCalls.connect.awaitingTranscript} recorded calls not yet transcribed` : ""}
                  {data.salesCalls.connect.unrecorded ? `; ${data.salesCalls.connect.unrecorded} connected calls were never recorded` : ""}.
                  Numerator: {money(data.salesCalls.knownCents)} over {data.salesCalls.calls} sales calls. {data.salesCalls.perConversation.statement}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Cost per signup — sales floor</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {money(data.signups.salesSide.perSignupCents)}
                  {data.signups.salesSide.isFloor ? <span className="text-xs font-normal text-muted-foreground"> floor</span> : null}
                </p>
                <p className="text-xs text-muted-foreground break-words">
                  {data.signups.count} signups · {money(data.signups.salesSide.cents)}. {data.signups.salesSide.definition}. Source: {data.signups.source}.
                </p>
              </div>
              <div className="rounded-lg border border-border p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Cost per signup — all three sections</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {money(data.signups.allIn.perSignupCents)}
                  {data.signups.allIn.isFloor ? <span className="text-xs font-normal text-muted-foreground"> floor</span> : null}
                </p>
                <p className="text-xs text-muted-foreground break-words">
                  {data.signups.count} signups · {money(data.signups.allIn.cents)}. {data.signups.allIn.definition}.
                </p>
              </div>
            </div>

            {/* Per rep, per agency */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Per rep</h3>
              <p className="text-xs text-muted-foreground break-words">
                A rep&rsquo;s cost is their sales calls (all four parts) plus the pipeline AI rows metered to
                them. Signups are companies attributed to them in the period. A floor means a call of
                theirs has a part not yet known.
              </p>
              {data.signups.perRep.length === 0 ? (
                <p className="text-sm text-muted-foreground">No rep placed a call or was credited a signup in this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="py-1 pr-3 font-medium">Rep</th>
                        <th className="py-1 pr-3 font-medium text-right">Calls</th>
                        <th className="py-1 pr-3 font-medium text-right">Call cost</th>
                        <th className="py-1 pr-3 font-medium text-right">AI</th>
                        <th className="py-1 pr-3 font-medium text-right">Total</th>
                        <th className="py-1 pr-3 font-medium text-right">Signups</th>
                        <th className="py-1 font-medium text-right">Per signup</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.signups.perRep.map((r) => (
                        <tr key={r.repId} className="border-t border-border">
                          <td className="py-1.5 pr-3 break-words">
                            {r.name}
                            {r.agency ? <span className="text-xs text-muted-foreground"> · {r.agency.name}</span> : null}
                          </td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{r.calls}{r.unknownCalls ? <span className="text-xs text-muted-foreground"> ({r.unknownCalls} partly unknown)</span> : null}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums whitespace-nowrap">{money(r.callCents)}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums whitespace-nowrap">{microsMoney(r.aiMicros)}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums whitespace-nowrap">{money(r.costCents)}{r.isFloor ? "+" : ""}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{r.signups}</td>
                          <td className="py-1.5 text-right tabular-nums whitespace-nowrap">{r.signups ? money(r.perSignupCents) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <h3 className="text-sm font-semibold text-foreground pt-2">Per agency</h3>
              {data.signups.perAgency.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing to group.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="py-1 pr-3 font-medium">Agency</th>
                        <th className="py-1 pr-3 font-medium text-right">Reps</th>
                        <th className="py-1 pr-3 font-medium text-right">Calls</th>
                        <th className="py-1 pr-3 font-medium text-right">Total</th>
                        <th className="py-1 pr-3 font-medium text-right">Signups</th>
                        <th className="py-1 font-medium text-right">Per signup</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.signups.perAgency.map((a) => (
                        <tr key={a.agencyId || "direct"} className="border-t border-border">
                          <td className="py-1.5 pr-3 break-words">{a.name}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{a.reps}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{a.calls}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums whitespace-nowrap">{money(a.costCents)}{a.isFloor ? "+" : ""}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{a.signups}</td>
                          <td className="py-1.5 text-right tabular-nums whitespace-nowrap">{a.signups ? money(a.perSignupCents) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </SectionCard>

          {/* ── 2. Companies ─────────────────────────────────────────── */}
          <SectionCard id="costs-companies" index={2} section={data.sections.companies} prev={prevSection("companies")} prevState={prev}>
            <p className="text-xs text-muted-foreground break-words">
              Charged: {data.charged.source}. Margin is charged minus cost on each line; a line whose cost is a
              floor has a margin that is a ceiling. The companies&rsquo; OpenAI bill is reconciled once, in section 1.
            </p>
            <SectionLines section={data.sections.companies} withCharged />
            <p className="text-xs text-muted-foreground break-words">
              Retell&rsquo;s number rent: {data.retell.rent.statement} Per-minute margin, concurrency and the numbers held are on{" "}
              <Link href="/platform/voice-economics" className="underline">Voice economics</Link>; per-company AI detail is on{" "}
              <Link href="/platform/ai-usage" className="underline">AI usage</Link>.
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 pr-3 font-medium">Companies&rsquo; AI by feature (computed)</th>
                  <th className="py-1 pr-3 font-medium text-right">Cost</th>
                  <th className="py-1 font-medium text-right">Calls</th>
                </tr>
              </thead>
              <tbody>
                {data.openai.tenants.byFeature.map((f) => (
                  <tr key={f.feature} className="border-t border-border">
                    <td className="py-1 pr-3 break-words">{f.feature}</td>
                    <td className="py-1 pr-3 text-right tabular-nums whitespace-nowrap">{microsMoney(f.micros)}</td>
                    <td className="py-1 text-right tabular-nums text-xs text-muted-foreground whitespace-nowrap">{n(f.calls)}</td>
                  </tr>
                ))}
                {data.openai.tenants.byFeature.length === 0 ? <tr><td className="py-1 text-muted-foreground">Nothing metered in this period.</td></tr> : null}
              </tbody>
            </table>
          </SectionCard>

          {/* ── 3. Platform itself ───────────────────────────────────── */}
          <SectionCard id="costs-platform" index={3} section={data.sections.platform} prev={prevSection("platform")} prevState={prev}>
            <SectionLines section={data.sections.platform} />
            {data.stripe.configured && data.stripe.grossChargeCents !== null ? (
              <p className="text-xs text-muted-foreground break-words" data-stripe-kept>
                What Stripe kept, {money(data.stripe.keptCents)}, beside subscription revenue of {money(data.stripe.grossChargeCents)} gross in charges —{" "}
                {data.stripe.grossChargeCents > 0 ? `${Math.round((data.stripe.keptCents / data.stripe.grossChargeCents) * 1000) / 10}% of it` : "no charges"}. Source: {data.stripe.source}.
              </p>
            ) : null}
            {data.neon.configured && data.neon.lines.length ? (
              <p className="text-xs text-muted-foreground break-words">
                Neon: {data.neon.daysCovered} of the period&rsquo;s days have a row; plan{data.neon.plans.length === 1 ? "" : "s"} seen: {data.neon.plans.join(", ") || "not named"}.{" "}
                {data.neon.source}. Neon&rsquo;s invoice is the bill — enter it under Fixed bills and the line below reconciles the two.
              </p>
            ) : null}
            {data.reconciliations.length ? (
              <ul className="space-y-1 text-sm" data-reconciliations>
                {data.reconciliations.map((r) => (
                  <li key={`${r.section}:${r.provider}`} className="break-words tabular-nums">
                    {r.statement}
                    <span className="text-xs text-muted-foreground"> — not added to the total; the pulled/computed line is</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <FixedBills rows={data.fixedBills.rows} providers={data.fixedBills.providers} period={data.period} onChange={load} />
          </SectionCard>

          {/* ── Providers — last pulled ───────────────────────────────── */}
          <section className={CARD} data-provider-pulls>
            <h2 className="text-base font-semibold text-foreground">Providers — when each was last read</h2>
            <p className="text-xs text-muted-foreground break-words">
              One pull per provider per day (Twilio hourly), from the every-minute cron; a failed pull lands on{" "}
              <Link href="/platform/errors" className="underline">Errors</Link> with the provider named. Pull now reads this period.
            </p>
            {pullNote ? <p className="text-xs text-muted-foreground break-words">{pullNote}</p> : null}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-1 pr-3 font-medium">Provider</th>
                    <th className="py-1 pr-3 font-medium">How</th>
                    <th className="py-1 pr-3 font-medium">Last pulled</th>
                    <th className="py-1 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.providers).map(([key, p]) => (
                    <tr key={key} className="border-t border-border">
                      <td className="py-1.5 pr-3">{p.label}</td>
                      <td className="py-1.5 pr-3 text-xs text-muted-foreground break-words">{SOURCE_KIND[p.kind]} · {p.cadence}</td>
                      <td className="py-1.5 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                        {!p.configured ? <span className="text-amber-700 dark:text-amber-300">waiting for {p.envVar}</span> : p.lastPullAt ? when(p.lastPullAt) : key === "retell" ? "per call" : "never"}
                      </td>
                      <td className="py-1.5 text-right">
                        {["twilio", "openai", "neon", "stripe"].includes(key) && p.configured ? (
                          <button type="button" className={`${BTN} border border-border`} onClick={() => pullNow(key)} disabled={Boolean(pulling)}>
                            {pulling === key ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />} Pull now
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── By period ────────────────────────────────────────────── */}
          <section className={CARD}>
            <h2 className="text-base font-semibold text-foreground">By {data.period.granularity}</h2>
            {data.buckets.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing in any ledger for this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-1 pr-3 font-medium">{data.period.granularity === "week" ? "Week of" : data.period.granularity === "month" ? "Month" : "Day"}</th>
                      <th className="py-1 pr-3 font-medium text-right">Twilio</th>
                      <th className="py-1 pr-3 font-medium text-right">OpenAI (sales, computed)</th>
                      <th className="py-1 pr-3 font-medium text-right">OpenAI (companies, computed)</th>
                      <th className="py-1 pr-3 font-medium text-right">OpenAI (billed)</th>
                      <th className="py-1 pr-3 font-medium text-right">Retell</th>
                      <th className="py-1 pr-3 font-medium text-right">Neon</th>
                      <th className="py-1 pr-3 font-medium text-right">Stripe kept</th>
                      <th className="py-1 pr-3 font-medium text-right">Sales calls</th>
                      <th className="py-1 pr-3 font-medium text-right">Conversations</th>
                      <th className="py-1 font-medium text-right">Signups</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.buckets.map((b) => (
                      <tr key={b.key} className="border-t border-border">
                        <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums">{b.key}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums whitespace-nowrap">{money(b.twilioTotalCents ?? b.twilioLinesCents)}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums whitespace-nowrap">{money(b.openaiPlatformCents)}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums whitespace-nowrap">{money(b.openaiTenantCents)}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums whitespace-nowrap">{b.openaiBilledCents === null ? "—" : money(b.openaiBilledCents)}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums whitespace-nowrap">{money(b.retellCents)}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums whitespace-nowrap">{b.neonCents === null ? "—" : money(b.neonCents)}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums whitespace-nowrap">{b.stripeCents === null ? "—" : money(b.stripeCents)}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums whitespace-nowrap">
                          {b.salesCalls ? money(b.salesCallCents) : "—"}
                          <span className="text-xs text-muted-foreground"> {b.salesCalls ? `(${b.salesCalls}${b.salesCallsUnknown ? `, ${b.salesCallsUnknown} partly unknown` : ""})` : ""}</span>
                        </td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{b.conversations}</td>
                        <td className="py-1.5 text-right tabular-nums">{b.signups}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Twilio is the account total for the day when it was pulled, else the sum of the pulled
              categories; a dash is a day the ledger has no row for.
            </p>
          </section>

          {/* ── Twilio, by category — one account, two businesses ───── */}
          <section className={CARD}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">Twilio, by category</h2>
                <p className="text-xs text-muted-foreground break-words">
                  Source: {data.twilio.source}. Last pulled {when(data.twilio.lastPullAt)}; oldest row in this
                  period read {when(data.twilio.fetchedAt)}. {data.twilio.daysCovered} of the period&rsquo;s days have a row.{" "}
                  The every-minute cron pulls the last three days once an hour. The sales floor&rsquo;s share is in section 1,
                  the companies&rsquo; in section 2, and what cannot be attributed in section 3.
                </p>
              </div>
            </div>
            {data.twilio.lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No Twilio rows for this period yet. Pull them, or wait for the hourly pull.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-1 pr-3 font-medium">Category</th>
                      <th className="py-1 pr-3 font-medium text-right">Cost</th>
                      <th className="py-1 pr-3 font-medium text-right">Usage</th>
                      <th className="py-1 font-medium text-right">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.twilio.lines.map((l) => (
                      <tr key={l.category} className="border-t border-border">
                        <td className="py-1.5 pr-3 break-words">
                          {TWILIO_CATEGORY_LABELS[l.category] || l.label || l.category}
                          <span className="block text-xs text-muted-foreground">{l.category}</span>
                        </td>
                        <td className="py-1.5 pr-3 text-right tabular-nums whitespace-nowrap">{money(l.cents)} {l.currency !== "USD" ? l.currency : ""}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums whitespace-nowrap">
                          {l.units === null ? UNKNOWN : `${Number(l.units).toLocaleString("en-CA")} ${l.unit || ""}`}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{n(l.count)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-border font-medium">
                      <td className="py-1.5 pr-3">Sum of the lines above</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{money(data.twilio.linesCents)}</td>
                      <td colSpan={2} />
                    </tr>
                    <tr className="border-t border-border font-medium">
                      <td className="py-1.5 pr-3">Twilio&rsquo;s account total (totalprice)</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{money(data.twilio.totalCents)}</td>
                      <td colSpan={2} className="py-1.5 text-xs text-muted-foreground">
                        {data.twilio.otherCents === null ? "" : `${money(data.twilio.otherCents)} in categories not listed above`}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            {/* ── Whose money: the sales floor's, or the tenants' ─────────
                Split from what the ledger and the store tag
                (lib/platform/costs/dailyLedger.js splitTwilioSides), each
                line saying how; what cannot be split is listed as not
                attributed, never spread. */}
            {data.twilio.sides && data.twilio.lines.length > 0 ? (
              <div className="space-y-2" data-twilio-sides>
                <h3 className="text-sm font-semibold text-foreground">Sales floor and companies, apart</h3>
                <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                  <dt className="text-muted-foreground">Sales floor (section 1)</dt>
                  <dd className="tabular-nums">
                    {money(data.twilio.sides.sales.cents)}{" "}
                    <span className="text-xs text-muted-foreground">
                      {data.twilio.sides.sales.lines.map((l) => `${l.category} ${money(l.cents)}`).join(" · ")}
                    </span>
                  </dd>
                  <dt className="text-muted-foreground">Companies&rsquo; crew and client texts (section 2)</dt>
                  <dd className="tabular-nums">
                    {money(data.twilio.sides.tenants.cents)}{" "}
                    <span className="text-xs text-muted-foreground">
                      {data.twilio.sides.tenants.lines.filter((l) => l.cents !== 0).map((l) => `${l.category} ${money(l.cents)} (${l.how})`).join(" · ")}
                    </span>
                  </dd>
                  {data.twilio.sides.unattributed.cents !== 0 || data.twilio.sides.unattributed.lines.length > 0 ? (
                    <>
                      <dt className="text-muted-foreground">Not attributed (section 3)</dt>
                      <dd className="tabular-nums">
                        {money(data.twilio.sides.unattributed.cents)}{" "}
                        <span className="text-xs text-muted-foreground">
                          {data.twilio.sides.unattributed.lines.map((l) => `${l.category} ${money(l.cents)} — ${l.how}`).join(" · ")}
                        </span>
                      </dd>
                    </>
                  ) : null}
                </dl>
                <p className="text-xs text-muted-foreground break-words">
                  {data.twilio.sides.method} Counts this period: {n(data.twilio.sides.counts.salesSmsOut)} sales texts out,{" "}
                  {n(data.twilio.sides.counts.salesSmsIn)} in; {n(data.twilio.sides.counts.salesNumbers)} sales numbers and{" "}
                  {n(data.twilio.sides.counts.tenantNumbers)} crew lines held.
                </p>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground break-words">
              Retell&rsquo;s number rent this period, at list price: {data.retell.rent.cents === null ? UNKNOWN : money(data.retell.rent.cents)} — the figure on section 2&rsquo;s rent line.
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}

// ── A section: numbered heading with this period's total and last month's ──
function SectionCard({ id, index, section, prev, prevState, children }) {
  return (
    <section id={id} className={CARD} data-costs-section={section.key}>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground tabular-nums">
          {index}. {section.title} — {money(section.totalCents)}
          {section.isFloor ? <span className="text-sm font-normal text-muted-foreground"> known so far, a floor</span> : null}
          <span className="text-sm font-normal text-muted-foreground">
            {" "}· last month {prevState ? (prevState.error ? UNKNOWN : `${money(prev?.totalCents)}${prev?.isFloor ? "+" : ""}`) : "…"}
          </span>
          {section.chargedCents !== null && section.chargedCents !== undefined ? (
            <span className="text-sm font-normal text-muted-foreground"> · charged to companies {money(section.chargedCents)} · margin {money(section.chargedCents - section.totalCents)}</span>
          ) : null}
        </h2>
        <p className="text-xs text-muted-foreground break-words">
          {section.blurb} {section.sourceKinds.api} lines API-pulled, {section.sourceKinds.computed} computed, {section.sourceKinds.hand} hand-entered
          {section.includesHandEntered ? " — the total includes hand-entered bills" : ""}.
        </p>
      </div>
      {children}
    </section>
  );
}

// ── The lines of a section, each with provider · source kind · as of ────────
function SectionLines({ section, withCharged = false }) {
  if (!section.lines.length) return <p className="text-sm text-muted-foreground">Nothing in any ledger for this section in this period.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="py-1 pr-3 font-medium">Line</th>
            <th className="py-1 pr-3 font-medium text-right">Cost</th>
            {withCharged ? <th className="py-1 pr-3 font-medium text-right">Charged to companies</th> : null}
            {withCharged ? <th className="py-1 pr-3 font-medium text-right">Margin</th> : null}
            <th className="py-1 pr-3 font-medium">Units · what one costs</th>
            <th className="py-1 pr-3 font-medium">Provider · source</th>
            <th className="py-1 font-medium">As of</th>
          </tr>
        </thead>
        <tbody>
          {section.lines.map((l) => (
            <tr key={l.key} className="border-t border-border align-top">
              <td className="py-1.5 pr-3 break-words">
                {l.label}
                {l.note ? <span className="block text-xs text-muted-foreground">{l.note}</span> : null}
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums whitespace-nowrap">
                {l.cents === null ? <span className="text-muted-foreground">{UNKNOWN}</span> : money(l.cents)}
                {l.isFloor ? "+" : ""}
              </td>
              {withCharged ? (
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  {l.charged ? money(l.charged.cents) : "—"}
                  {l.charged?.how ? <span className="block text-xs text-muted-foreground whitespace-normal min-w-[10rem]">{l.charged.how}</span> : null}
                </td>
              ) : null}
              {withCharged ? (
                <td className="py-1.5 pr-3 text-right tabular-nums whitespace-nowrap">
                  {l.charged && l.cents !== null ? money(l.charged.cents - l.cents) : "—"}
                  {l.charged && l.cents !== null && l.isFloor ? <span className="text-xs text-muted-foreground"> at most</span> : null}
                </td>
              ) : null}
              <td className="py-1.5 pr-3 text-xs text-muted-foreground break-words">
                {l.units !== null && l.units !== undefined ? `${Number(l.units).toLocaleString("en-CA")} ${l.unitLabel || ""}` : l.count !== null && l.count !== undefined ? `${Number(l.count).toLocaleString("en-CA")}` : ""}
                {l.perUnit ? <span className="block">{l.perUnit}</span> : null}
              </td>
              <td className="py-1.5 pr-3 text-xs text-muted-foreground break-words">
                <span className="font-medium text-foreground">{l.provider}</span> · {SOURCE_KIND[l.sourceKind] || l.sourceKind}
                <span className="block">{l.source}</span>
              </td>
              <td className="py-1.5 text-xs text-muted-foreground whitespace-nowrap">{l.sourceKind === "hand" ? "typed in" : when(l.asOf)}</td>
            </tr>
          ))}
          <tr className="border-t border-border font-medium">
            <td className="py-1.5 pr-3">Section total</td>
            <td className="py-1.5 pr-3 text-right tabular-nums">{money(section.totalCents)}{section.isFloor ? "+" : ""}</td>
            {withCharged ? <td className="py-1.5 pr-3 text-right tabular-nums">{money(section.chargedCents)}</td> : null}
            {withCharged ? <td className="py-1.5 pr-3 text-right tabular-nums">{money(section.chargedCents - section.totalCents)}</td> : null}
            <td colSpan={3} className="py-1.5 text-xs text-muted-foreground">{section.complete ? "" : "a line is unknown, so this is a floor"}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PerProject({ project }) {
  return (
    <>
      <tr className="border-t border-border font-medium">
        <td className="py-1 pr-3 break-words">{project.projectId}</td>
        <td className="py-1 pr-3 text-right tabular-nums whitespace-nowrap">{money(project.cents)}</td>
        <td />
      </tr>
      {project.lines.map((l) => (
        <tr key={l.lineItem} className="text-xs text-muted-foreground">
          <td className="py-0.5 pl-4 pr-3 break-words">{l.lineItem}</td>
          <td className="py-0.5 pr-3 text-right tabular-nums whitespace-nowrap">{money(l.cents)}</td>
          <td className="py-0.5 text-right tabular-nums whitespace-nowrap">{l.units === null || l.units === undefined ? "" : `${Number(l.units).toLocaleString("en-CA")} ${l.unit || ""}`}</td>
        </tr>
      ))}
    </>
  );
}

// ── Fixed bills: hand-entered, attributed, editable, voided never deleted ──
function FixedBills({ rows, providers, period, onChange }) {
  const thisMonth = (period?.fromKey || new Date().toISOString().slice(0, 10)).slice(0, 7);
  const blank = { provider: "vercel", periodMonth: thisMonth, amount: "", currency: "USD", invoiceRef: "", note: "" };
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setNote("");
    try {
      const body = editing ? { id: editing, ...form } : form;
      const r = await fetchJson("/api/platform/costs/fixed-bills", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setNote(`${editing ? "Updated" : "Saved"}: ${r.row.statement}`);
      setForm(blank);
      setEditing(null);
      await onChange();
    } catch (err) {
      setNote(err?.message || "Could not save the bill.");
    } finally {
      setBusy(false);
    }
  }

  async function setVoided(id, voided) {
    setBusy(true);
    setNote("");
    try {
      const r = await fetchJson("/api/platform/costs/fixed-bills", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, voided }),
      });
      setNote(`${voided ? "Voided" : "Restored"}: ${r.row.statement}`);
      await onChange();
    } catch (err) {
      setNote(err?.message || "Could not change the bill.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(row) {
    setEditing(row.id);
    setForm({ provider: row.provider, periodMonth: row.periodMonth, amount: (row.amountCents / 100).toFixed(2), currency: row.currency || "USD", invoiceRef: row.invoiceRef || "", note: row.note || "" });
  }

  const known = providers.some((p) => p.key === form.provider);

  return (
    <div className="space-y-3 rounded-lg border border-border p-3" data-fixed-bills>
      <h3 className="text-sm font-semibold text-foreground">Fixed bills — typed in from the invoice</h3>
      <p className="text-xs text-muted-foreground break-words">
        Vercel, Namecheap, Resend, Google Maps, Cloudinary and Retell&rsquo;s invoice reach FieldQuo as invoices, not
        endpoints. Enter each one for the month it is for; it is printed with your name and the date, added to
        section 3 (or reconciled against the pulled line where one exists), and a wrong row is edited or voided,
        never deleted.
      </p>
      <form onSubmit={submit} className="grid gap-2 sm:grid-cols-6 items-end">
        <label className="text-xs text-muted-foreground sm:col-span-2">
          Supplier
          <select className={INPUT} value={known ? form.provider : "__other"} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value === "__other" ? "" : e.target.value }))}>
            {providers.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
            <option value="__other">Another supplier…</option>
          </select>
          {!known ? <input className={`${INPUT} mt-1`} placeholder="supplier key, e.g. namecheap" value={form.provider} onChange={set("provider")} /> : null}
        </label>
        <label className="text-xs text-muted-foreground">
          Month
          <input className={INPUT} type="month" value={form.periodMonth} onChange={set("periodMonth")} required />
        </label>
        <label className="text-xs text-muted-foreground">
          Amount
          <input className={INPUT} inputMode="decimal" placeholder="113.18" value={form.amount} onChange={set("amount")} required />
        </label>
        <label className="text-xs text-muted-foreground">
          Currency
          <input className={INPUT} maxLength={3} value={form.currency} onChange={set("currency")} />
        </label>
        <label className="text-xs text-muted-foreground">
          Invoice ref
          <input className={INPUT} value={form.invoiceRef} onChange={set("invoiceRef")} />
        </label>
        <label className="text-xs text-muted-foreground sm:col-span-4">
          Note
          <input className={INPUT} value={form.note} onChange={set("note")} />
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" className={`${BTN} bg-primary text-primary-foreground`} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : null} {editing ? "Save changes" : "Enter bill"}
          </button>
          {editing ? (
            <button type="button" className={`${BTN} border border-border`} onClick={() => { setEditing(null); setForm(blank); }}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>
      {note ? <p className="text-xs text-muted-foreground break-words">{note}</p> : null}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No bills entered for the months in this period.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {rows.map((r) => (
            <li key={r.id} className={`flex flex-wrap items-center justify-between gap-2 border-t border-border py-1.5 ${r.voidedAt ? "line-through text-muted-foreground" : ""}`}>
              <span className="break-words tabular-nums">
                {r.statement}
                {r.invoiceRef ? <span className="text-xs text-muted-foreground"> · ref {r.invoiceRef}</span> : null}
                {r.note ? <span className="block text-xs text-muted-foreground">{r.note}</span> : null}
              </span>
              <span className="flex gap-2">
                {!r.voidedAt ? (
                  <button type="button" className="text-xs underline min-h-[44px] px-2" onClick={() => startEdit(r)} disabled={busy}>Edit</button>
                ) : null}
                <button type="button" className="text-xs underline min-h-[44px] px-2" onClick={() => setVoided(r.id, !r.voidedAt)} disabled={busy}>
                  {r.voidedAt ? "Restore" : "Void"}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
