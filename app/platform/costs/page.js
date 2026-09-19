"use client";

// app/platform/costs/page.js
//
// What FieldQuo pays — Twilio, OpenAI, Retell — and what it buys: cost per
// conversation and cost per signup, per rep and per agency.
//
// ══ Every figure says where it came from and how old it is ═══════════════
//
// Four sources, printed beside their numbers (lib/platform/costs/summary.js
// names them): Twilio's Usage Records pulled into PlatformCostDaily, the two
// AI ledgers priced by the vendor's token counts, Retell's per-call figure,
// and the sales store composed by lib/sales/calls/costs.js. A figure that is
// not known prints as "unknown" with what is missing; a total with a
// missing part prints as a floor and says so. Nothing here is estimated,
// because the owner reads this page to decide what the floor costs him and
// an estimate that rounds a bill the right way is still a number he did not
// pay.
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

const RANGE_LABELS = {
  day: "Today",
  week: "This week",
  month: "This month",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  year: "This year",
};

export default function PlatformCostsPage() {
  const [range, setRange] = useState("month");
  const [by, setBy] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pulling, setPulling] = useState(false);
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

  async function pullNow() {
    setPulling(true);
    setPullNote("");
    try {
      const r = await fetchJson("/api/platform/costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pull", from: data?.period?.fromKey, to: data?.period?.toKey }),
      });
      setPullNote(`Pulled ${r.records} records for ${r.from}..${r.to}; ${r.written} rows written${r.failed?.length ? `; ${r.failed.join(", ")} failed` : ""}.`);
      await load();
    } catch (err) {
      setPullNote(err?.message || "The pull failed.");
    } finally {
      setPulling(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">Costs</h1>
          <p className="text-sm text-muted-foreground break-words">
            What FieldQuo pays Twilio, OpenAI and Retell, and what it buys. Every figure carries
            where it came from and when it was read; nothing is estimated, and what is not known
            says so.
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
          {/* ── Totals ─────────────────────────────────────────────────── */}
          <section className={CARD}>
            <h2 className="text-base font-semibold text-foreground">
              {RANGE_LABELS[data.range] || data.range} · {data.period.fromKey} to {data.period.toKey}
            </h2>
            <p className="text-3xl font-semibold tabular-nums">
              {money(data.totals.knownCents)}
              {!data.totals.complete ? <span className="text-sm font-normal text-muted-foreground"> known so far — a floor</span> : null}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-1 pr-3 font-medium">Provider</th>
                    <th className="py-1 pr-3 font-medium text-right">Cost</th>
                    <th className="py-1 pr-3 font-medium">Source</th>
                    <th className="py-1 font-medium">As of</th>
                  </tr>
                </thead>
                <tbody>
                  {data.totals.lines.map((t) => (
                    <tr key={t.key} className="border-t border-border">
                      <td className="py-1.5 pr-3 break-words">{t.label}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums whitespace-nowrap">
                        {money(t.cents)}
                        {t.note ? <span className="block text-xs text-muted-foreground">{t.note}</span> : null}
                      </td>
                      <td className="py-1.5 pr-3 text-xs text-muted-foreground break-words">{t.source}</td>
                      <td className="py-1.5 text-xs text-muted-foreground whitespace-nowrap">{when(t.asOf)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── What it buys ───────────────────────────────────────────── */}
          <section className="grid gap-3 sm:grid-cols-3">
            <div className={CARD}>
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
            <div className={CARD}>
              <p className="text-xs text-muted-foreground">Cost per signup — sales side</p>
              <p className="text-2xl font-semibold tabular-nums">
                {money(data.signups.salesSide.perSignupCents)}
                {data.signups.salesSide.isFloor ? <span className="text-xs font-normal text-muted-foreground"> floor</span> : null}
              </p>
              <p className="text-xs text-muted-foreground break-words">
                {data.signups.count} signups · {money(data.signups.salesSide.cents)}. {data.signups.salesSide.definition}. Source: {data.signups.source}.
              </p>
            </div>
            <div className={CARD}>
              <p className="text-xs text-muted-foreground">Cost per signup — all in</p>
              <p className="text-2xl font-semibold tabular-nums">
                {money(data.signups.allIn.perSignupCents)}
                {data.signups.allIn.isFloor ? <span className="text-xs font-normal text-muted-foreground"> floor</span> : null}
              </p>
              <p className="text-xs text-muted-foreground break-words">
                {data.signups.count} signups · {money(data.signups.allIn.cents)}. {data.signups.allIn.definition}.
              </p>
            </div>
          </section>

          {/* ── By period ──────────────────────────────────────────────── */}
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
                      <th className="py-1 pr-3 font-medium text-right">OpenAI (own)</th>
                      <th className="py-1 pr-3 font-medium text-right">OpenAI (tenants)</th>
                      <th className="py-1 pr-3 font-medium text-right">Retell</th>
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
                        <td className="py-1.5 pr-3 text-right tabular-nums whitespace-nowrap">{money(b.retellCents)}</td>
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
              categories; a blank Twilio cell is a day the ledger has no row for.
            </p>
          </section>

          {/* ── Twilio ─────────────────────────────────────────────────── */}
          <section className={CARD}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">Twilio</h2>
                <p className="text-xs text-muted-foreground break-words">
                  Source: {data.twilio.source}. Last pulled {when(data.twilio.lastPullAt)}; oldest row in this
                  period read {when(data.twilio.fetchedAt)}. {data.twilio.daysCovered} of the period&rsquo;s days have a row.{" "}
                  The every-minute cron pulls the last three days once an hour.
                </p>
              </div>
              <button type="button" className={`${BTN} border border-border`} onClick={pullNow} disabled={pulling}>
                {pulling ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />} Pull this period from Twilio now
              </button>
            </div>
            {pullNote ? <p className="text-xs text-muted-foreground break-words">{pullNote}</p> : null}
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
                One account, two businesses. Split from what the ledger and
                the store tag (lib/platform/costs/dailyLedger.js
                splitTwilioSides), each line saying how; what cannot be split
                is listed as not attributed, never spread. */}
            {data.twilio.sides && data.twilio.lines.length > 0 ? (
              <div className="space-y-2" data-twilio-sides>
                <h3 className="text-sm font-semibold text-foreground">Sales floor and tenants, apart</h3>
                <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                  <dt className="text-muted-foreground">Sales floor</dt>
                  <dd className="tabular-nums">
                    {money(data.twilio.sides.sales.cents)}{" "}
                    <span className="text-xs text-muted-foreground">
                      {data.twilio.sides.sales.lines.map((l) => `${l.category} ${money(l.cents)}`).join(" · ")}
                    </span>
                  </dd>
                  <dt className="text-muted-foreground">Tenants&rsquo; crew and client texts</dt>
                  <dd className="tabular-nums">
                    {money(data.twilio.sides.tenants.cents)}{" "}
                    <span className="text-xs text-muted-foreground">
                      {data.twilio.sides.tenants.lines.filter((l) => l.cents !== 0).map((l) => `${l.category} ${money(l.cents)} (${l.how})`).join(" · ")}
                    </span>
                  </dd>
                  {data.twilio.sides.unattributed.cents !== 0 || data.twilio.sides.unattributed.lines.length > 0 ? (
                    <>
                      <dt className="text-muted-foreground">Not attributed</dt>
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
          </section>

          {/* ── OpenAI ─────────────────────────────────────────────────── */}
          <section className={CARD}>
            <h2 className="text-base font-semibold text-foreground">OpenAI</h2>
            <p className="text-xs text-muted-foreground break-words">Source: {data.openai.source}. As of {when(data.openai.asOf)}.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-foreground">
                  FieldQuo&rsquo;s own — {microsMoney(data.openai.platform.micros)}
                  {data.openai.platform.unpricedCalls ? <span className="text-xs font-normal text-muted-foreground"> · {data.openai.platform.unpricedCalls} unpriced calls not summed</span> : null}
                </p>
                <table className="w-full text-sm">
                  <tbody>
                    {data.openai.platform.byArea.map((a) => (
                      <tr key={a.area} className="border-t border-border">
                        <td className="py-1 pr-3 break-words">{a.area}</td>
                        <td className="py-1 pr-3 text-right tabular-nums whitespace-nowrap">{microsMoney(a.micros)}</td>
                        <td className="py-1 text-right tabular-nums text-xs text-muted-foreground whitespace-nowrap">{n(a.calls)} calls{a.unpriced ? `, ${a.unpriced} unpriced` : ""}</td>
                      </tr>
                    ))}
                    {data.openai.platform.byArea.length === 0 ? <tr><td className="py-1 text-muted-foreground">Nothing metered in this period.</td></tr> : null}
                  </tbody>
                </table>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  On tenants&rsquo; behalf — {microsMoney(data.openai.tenants.micros)}
                  <span className="text-xs font-normal text-muted-foreground"> · {n(data.openai.tenants.companies)} companies</span>
                </p>
                <table className="w-full text-sm">
                  <tbody>
                    {data.openai.tenants.byFeature.map((f) => (
                      <tr key={f.feature} className="border-t border-border">
                        <td className="py-1 pr-3 break-words">{f.feature}</td>
                        <td className="py-1 pr-3 text-right tabular-nums whitespace-nowrap">{microsMoney(f.micros)}</td>
                        <td className="py-1 text-right tabular-nums text-xs text-muted-foreground whitespace-nowrap">{n(f.calls)} calls</td>
                      </tr>
                    ))}
                    {data.openai.tenants.byFeature.length === 0 ? <tr><td className="py-1 text-muted-foreground">Nothing metered in this period.</td></tr> : null}
                  </tbody>
                </table>
                {/* By tier, then by area. The employee runs on the best tier
                    (lib/ai/provider.js); this is where that decision's cost
                    is visible beside everything on the mini. */}
                <div className="grid gap-4 sm:grid-cols-2 mt-3">
                  <div>
                    <p className="text-xs font-medium text-foreground">By tier</p>
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <tbody>
                        {(data.openai.tenants.byTier || []).map((r) => (
                          <tr key={r.tier} className="border-t border-border">
                            <td className="py-1 pr-3 break-words">{r.tier}<span className="block text-xs text-muted-foreground">{r.models.join(", ")}</span></td>
                            <td className="py-1 pr-3 text-right tabular-nums whitespace-nowrap">{microsMoney(r.micros)}</td>
                            <td className="py-1 text-right tabular-nums text-xs text-muted-foreground whitespace-nowrap">{n(r.calls)} calls</td>
                          </tr>
                        ))}
                        {(data.openai.tenants.byTier || []).length === 0 ? <tr><td className="py-1 text-muted-foreground">Nothing metered.</td></tr> : null}
                      </tbody>
                    </table>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">By area</p>
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <tbody>
                        {(data.openai.tenants.byArea || []).map((r) => (
                          <tr key={r.area} className="border-t border-border">
                            <td className="py-1 pr-3 break-words">{r.area}</td>
                            <td className="py-1 pr-3 text-right tabular-nums whitespace-nowrap">{microsMoney(r.micros)}</td>
                            <td className="py-1 text-right tabular-nums text-xs text-muted-foreground whitespace-nowrap">{n(r.calls)} calls</td>
                          </tr>
                        ))}
                        {(data.openai.tenants.byArea || []).length === 0 ? <tr><td className="py-1 text-muted-foreground">Nothing metered.</td></tr> : null}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Per-company detail is on <Link href="/platform/ai-usage" className="underline">AI usage</Link>.
                </p>
              </div>
            </div>
          </section>

          {/* ── Retell ─────────────────────────────────────────────────── */}
          <section className={CARD}>
            <h2 className="text-base font-semibold text-foreground">Retell</h2>
            <p className="text-xs text-muted-foreground break-words">Source: {data.retell.source}. As of {when(data.retell.asOf)}.</p>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">FieldQuo&rsquo;s own line</dt>
              <dd className="tabular-nums">
                {money(data.retell.platform.cents)} <span className="text-xs text-muted-foreground">{data.retell.platform.calls} calls{data.retell.platform.unknownCalls ? `, ${data.retell.platform.unknownCalls} with no figure` : ""}</span>
              </dd>
              <dt className="text-muted-foreground">Tenants&rsquo; receptionists</dt>
              <dd className="tabular-nums">
                {money(data.retell.tenants.cents)} <span className="text-xs text-muted-foreground">{data.retell.tenants.calls} calls{data.retell.tenants.unknownCalls ? `, ${data.retell.tenants.unknownCalls} with no figure` : ""}</span>
              </dd>
              <dt className="text-muted-foreground">Number rent</dt>
              <dd className="tabular-nums">
                {data.retell.rent.cents === null ? UNKNOWN : money(data.retell.rent.cents)}{" "}
                <span className="text-xs text-muted-foreground">
                  {n(data.retell.numbersHeld)} numbers held
                  {data.retell.rent.monthlyCents != null ? ` · ${money(data.retell.rent.monthlyCents)} a month at list price` : ""}
                </span>
              </dd>
              <dt className="text-muted-foreground">Margin on tenants&rsquo; calls</dt>
              <dd className="text-xs text-muted-foreground">
                <Link href="/platform/voice-economics" className="underline">Voice economics</Link>
              </dd>
            </dl>
            <p className="text-xs text-muted-foreground break-words">{data.retell.rent.statement}</p>
          </section>

          {/* ── Sales calls, composed ──────────────────────────────────── */}
          <section className={CARD}>
            <h2 className="text-base font-semibold text-foreground">Sales calls, part by part</h2>
            <p className="text-xs text-muted-foreground break-words">Source: {data.salesCalls.source}. As of {when(data.salesCalls.asOf)}.</p>
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
          </section>

          {/* ── Per rep, per agency ────────────────────────────────────── */}
          <section className={CARD}>
            <h2 className="text-base font-semibold text-foreground">Per rep</h2>
            <p className="text-xs text-muted-foreground break-words">
              A rep&rsquo;s cost is their sales calls (all four parts) plus the platform AI rows metered to
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
          </section>
        </>
      ) : null}
    </div>
  );
}
