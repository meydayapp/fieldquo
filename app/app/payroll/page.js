// app/app/payroll/page.js
//
// Payroll. One page, two audiences, decided by permission:
//
//   • Someone who can run payroll sees the runs list and can build a new period.
//   • Everyone else sees their own payslips and nothing about anyone else.
//
// Same page rather than two, because "where do I see my pay?" should have one
// answer, and because hiding the runs list from a worker is a permission
// decision the server already enforces — the UI just reflects it.
//
// ── FieldQuo does not pay anyone ────────────────────────────────────────────
// The wording throughout says "record as paid" and "pay outside FieldQuo",
// because the company pays through its own bank or payroll provider. A button
// labelled "Pay" would be a control that appears to work and doesn't.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Wallet, Calculator, AlertTriangle, Check, Info, Download } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { formatDateOnly } from "@/lib/format/companyDate";

const REGIONS = [
  { key: "CA", label: "Canada" },
  { key: "US", label: "United States" },
  { key: "UK", label: "United Kingdom" },
];
const FREQUENCIES = [
  { key: "weekly", label: "Weekly" },
  { key: "biweekly", label: "Every 2 weeks" },
  { key: "semimonthly", label: "Twice a month" },
  { key: "monthly", label: "Monthly" },
];

const STATUS_STYLE = {
  draft: "bg-muted text-muted-foreground",
  approved: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  paid: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
};

function money(n) {
  return `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
// Two formatters on purpose. Pay period boundaries are calendar days stored at
// midnight UTC, so a local formatter shows the day before — see the note in
// lib/format/companyDate.js. paidAt is a real instant (someone clicked a button
// at a moment in time) and reads correctly in the viewer's own timezone.
const date = (d) => formatDateOnly(d);
const stamp = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

// Sensible default period: the fortnight that just ended.
function defaultPeriod() {
  const end = new Date();
  const start = new Date(end.getTime() - 13 * 86400000);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

export default function PayrollPage() {
  const [runs, setRuns] = useState(null);
  const [canRun, setCanRun] = useState(false);
  const [listError, setListError] = useState("");

  const [mine, setMine] = useState(null);

  const per = defaultPeriod();
  const [form, setForm] = useState({
    periodStart: per.start,
    periodEnd: per.end,
    region: "CA",
    frequency: "biweekly",
  });
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadRuns = useCallback(async () => {
    try {
      const d = await fetchJson("/api/payroll/runs");
      setRuns(d.runs || []);
      setCanRun(Boolean(d.canRun));
    } catch (err) {
      // A 403 here is normal for a worker — it means "you only see your own".
      setListError(err.message || "");
      setRuns([]);
    }
  }, []);

  useEffect(() => {
    loadRuns();
    fetchJson("/api/payroll/my-payslips")
      .then(setMine)
      .catch(() => setMine(null));
  }, [loadRuns]);

  async function runPreview() {
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      const d = await fetchJson("/api/payroll/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, commit: false }),
      });
      setPreview(d);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    setBusy(true);
    setError("");
    try {
      await fetchJson("/api/payroll/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, commit: true }),
      });
      setPreview(null);
      await loadRuns();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const showRunner = canRun;

  return (
    <div className="max-w-4xl px-6 py-8 space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Wallet size={20} className="text-foreground" />
          <h1 className="text-2xl font-bold text-foreground">Payroll</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          FieldQuo works out what each person should be paid from their approved
          hours and your saved rates, and produces payslips.{" "}
          <strong className="text-foreground">You pay through your own bank or payroll provider</strong> —
          FieldQuo doesn&apos;t move the money.
        </p>
      </div>

      {/* ── My payslips: everyone sees this, including owners ── */}
      {mine?.worker && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
            My earnings
          </h2>
          {mine.ytd && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                ["Gross", mine.ytd.gross],
                ["Deductions", mine.ytd.deductions],
                ["Net", mine.ytd.net],
              ].map(([label, v]) => (
                <div key={label} className="rounded-lg border border-border px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {label} · {mine.ytd.year}
                  </div>
                  <div className="text-base font-bold text-foreground tabular-nums">{money(v)}</div>
                </div>
              ))}
            </div>
          )}
          {mine.payslips.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No payslips yet. They appear once a pay run is approved.
            </p>
          ) : (
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {mine.payslips.map((p) => (
                <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {date(p.payRun.periodStart)} – {date(p.payRun.periodEnd)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {Number(p.regularHours)}h regular
                      {Number(p.overtimeHours) > 0 ? ` · ${Number(p.overtimeHours)}h overtime` : ""}
                      {p.paidAt ? ` · paid ${stamp(p.paidAt)}` : " · awaiting payment"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-bold text-foreground tabular-nums">{money(p.net)}</div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        {money(p.gross)} gross − {money(p.deductions)}
                      </div>
                    </div>
                    {/* Their own payslip. The route resolves "own" from their
                        Worker row, not from the id in this URL. */}
                    <a
                      href={`/api/payroll/runs/${p.payRun.id}/payslip/${p.id}`}
                      className="inline-flex items-center gap-1.5 text-xs border border-border rounded-full px-3 py-1.5 shrink-0"
                      aria-label="Download this payslip as a PDF"
                    >
                      <Download size={12} /> PDF
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Run payroll: only for those who may ── */}
      {showRunner ? (
        <>
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold text-foreground mb-1 flex items-center gap-2">
              <Calculator size={16} className="text-muted-foreground" /> New pay run
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Only <strong className="text-foreground">approved</strong> time is included. Approve
              timesheets first, or those hours won&apos;t be paid.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">Period start</span>
                <input
                  type="date"
                  value={form.periodStart}
                  onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">Period end</span>
                <input
                  type="date"
                  value={form.periodEnd}
                  onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">Frequency</span>
                <select
                  value={form.frequency}
                  onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">Payslip labels</span>
                <select
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                >
                  {REGIONS.map((r) => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <button
                onClick={runPreview}
                disabled={busy}
                className="inline-flex items-center gap-2 border border-border rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Calculator size={14} />}
                Calculate
              </button>
              {preview && !preview.warnings?.length && (
                <button
                  onClick={saveDraft}
                  disabled={busy}
                  className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60"
                >
                  Save as draft run
                </button>
              )}
            </div>

            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

            {/* Preview */}
            {preview && (
              <div className="mt-5 border-t border-border pt-4">
                <div className="flex gap-4 flex-wrap mb-3">
                  {[
                    ["Gross", preview.grossTotal],
                    ["Deductions", preview.deductionTotal],
                    ["Net to pay", preview.netTotal],
                  ].map(([l, v]) => (
                    <div key={l}>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{l}</div>
                      <div className="text-lg font-bold text-foreground tabular-nums">{money(v)}</div>
                    </div>
                  ))}
                </div>

                {/* Said out loud — unapproved hours are NOT in these numbers. */}
                {preview.meta?.excludedPendingTime?.length > 0 && (
                  <p className="text-xs flex items-start gap-1.5 text-amber-700 dark:text-amber-400 mb-2">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    Not included: unapproved hours for{" "}
                    {preview.meta.excludedPendingTime.map((e) => `${e.name} (${e.pendingHours}h)`).join(", ")}.
                    Approve their timesheets to pay these.
                  </p>
                )}
                {/* Paid leave is IN these numbers — say so, or a leave week
                    looks like someone was paid for hours they didn't work. */}
                {preview.meta?.paidLeave?.length > 0 && (
                  <p className="text-xs flex items-start gap-1.5 text-muted-foreground mb-2">
                    <Info size={13} className="mt-0.5 shrink-0" />
                    Includes approved paid leave for{" "}
                    {preview.meta.paidLeave
                      .map((l) => `${l.name} (${l.days}d ${l.policies.join(", ")})`)
                      .join(", ")}
                    .
                  </p>
                )}
                {preview.meta && !preview.meta.statutoryConfigured && (
                  <p className="text-xs flex items-start gap-1.5 text-amber-700 dark:text-amber-400 mb-2">
                    <Info size={13} className="mt-0.5 shrink-0" />
                    No deductions are set up, so these are gross figures. Add your
                    statutory components under Settings → Payroll first — confirm the
                    rates with your accountant.
                  </p>
                )}
                {preview.warnings?.map((w, i) => (
                  <p key={i} className="text-xs text-red-600 flex items-start gap-1.5 mb-1">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    {w.workerName}: {w.message}
                  </p>
                ))}

                <div className="rounded-lg border border-border divide-y divide-border mt-2">
                  {preview.lines.map((l, i) => (
                    <div key={i} className="px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {l.workerName}{" "}
                          <span className="text-xs text-muted-foreground">· {l.workerType}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {l.regularHours}h
                          {l.overtimeHours > 0 ? ` + ${l.overtimeHours}h OT` : ""}
                          {l.hourlyRate ? ` @ ${money(l.hourlyRate)}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-foreground tabular-nums">{money(l.net)}</div>
                        <div className="text-[11px] text-muted-foreground tabular-nums">
                          {money(l.gross)} − {money(l.deductions)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {preview.lines.length === 0 && (
                    <p className="px-3 py-4 text-sm text-muted-foreground">
                      Nobody has approved hours or a salary in this period.
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Past runs */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
              Pay runs
            </h2>
            {!runs && <Loader2 size={16} className="animate-spin text-muted-foreground" />}
            {runs?.length === 0 && (
              <p className="text-sm text-muted-foreground">No pay runs yet.</p>
            )}
            <div className="space-y-2">
              {runs?.map((r) => (
                <Link
                  key={r.id}
                  href={`/app/payroll/${r.id}`}
                  className="block rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {date(r.periodStart)} – {date(r.periodEnd)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r._count.lines} {r._count.lines === 1 ? "person" : "people"} · {r.region}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-foreground tabular-nums">{money(r.netTotal)}</span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status] || ""}`}>
                        {r.status === "paid" ? "paid (recorded)" : r.status}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </>
      ) : (
        listError && (
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <Info size={13} className="mt-0.5 shrink-0" />
            Only your own payslips are shared with your account.
          </p>
        )
      )}
    </div>
  );
}
