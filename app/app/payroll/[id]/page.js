// app/app/payroll/[id]/page.js
//
// One pay run: every payslip line, and the two state changes that matter —
// approve it, then record that it was paid.
//
// "Record as paid" is worded that way on purpose. FieldQuo doesn't transfer
// wages; the company pays through its own bank or payroll provider and this
// notes that it happened, so a payslip can say when.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, Check, BadgeCheck, Ban, Info, Download } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { showError } from "@/lib/clientErrors";
import { formatDateOnly } from "@/lib/format/companyDate";

function money(n) {
  return `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
// Period boundaries are calendar days at midnight UTC — see the note in
// lib/format/companyDate.js. approvedAt/paidAt are real instants and read in
// the viewer's own timezone.
const date = (d) => formatDateOnly(d);
const stamp = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

const STATUS_STYLE = {
  draft: "bg-muted text-muted-foreground",
  approved: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  paid: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
};

export default function PayRunPage() {
  const { id } = useParams();
  const [run, setRun] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRun(await fetchJson(`/api/payroll/runs/${id}`));
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(action) {
    setBusy(true);
    try {
      await fetchJson(`/api/payroll/runs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await load();
    } catch (err) {
      showError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/app/payroll" className="text-sm underline mt-2 inline-block">
          Back to payroll
        </Link>
      </div>
    );
  }
  if (!run) {
    return (
      <div className="max-w-3xl px-4 sm:px-6 py-6 sm:py-8 flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 size={16} className="animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="max-w-3xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <Link
        href="/app/payroll"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} /> Payroll
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {date(run.periodStart)} – {date(run.periodEnd)}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {run.lines.length} {run.lines.length === 1 ? "person" : "people"} · {run.region} labels
            {run.approvedAt ? ` · approved ${stamp(run.approvedAt)}` : ""}
            {run.paidAt ? ` · recorded paid ${stamp(run.paidAt)}` : ""}
          </p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[run.status] || ""}`}>
          {run.status === "paid" ? "paid (recorded)" : run.status}
        </span>
      </div>

      <div className="flex gap-4 flex-wrap rounded-xl border border-border bg-card p-4">
        {[
          ["Gross", run.grossTotal],
          ["Deductions", run.deductionTotal],
          ["Net to pay", run.netTotal],
        ].map(([l, v]) => (
          <div key={l}>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{l}</div>
            <div className="text-lg font-bold text-foreground tabular-nums">{money(v)}</div>
          </div>
        ))}
      </div>

      {/* Actions — only meaningful for someone who may run payroll; the server
          refuses regardless, so this is reflecting permission, not enforcing it. */}
      {run.canRun && run.status !== "cancelled" && (
        <div className="flex items-center gap-2 flex-wrap">
          {run.status === "draft" && (
            <>
              <button
                onClick={() => act("approve")}
                disabled={busy}
                className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={14} />}
                Approve run
              </button>
              <button
                onClick={() => act("cancel")}
                disabled={busy}
                className="inline-flex items-center gap-2 border border-border rounded-full px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-60"
              >
                <Ban size={14} /> Cancel
              </button>
            </>
          )}
          {run.status === "approved" && (
            <button
              onClick={() => act("mark_paid")}
              disabled={busy}
              className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Record as paid
            </button>
          )}
          {/* A plain link, not a fetch: the browser handles the download and
              Content-Disposition, and a 403 shows the API's own message. */}
          <a
            href={`/api/payroll/runs/${run.id}/export`}
            className="inline-flex items-center gap-2 border border-border rounded-full px-4 py-2 text-sm font-semibold"
          >
            <Download size={14} /> Export CSV
          </a>
        </div>
      )}

      {run.status === "approved" && (
        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <Info size={13} className="mt-0.5 shrink-0" />
          Approved and visible to your team as payslips. Pay them through your bank
          or payroll provider, then record it here.
        </p>
      )}

      {/* Payslip lines */}
      <div className="space-y-2">
        {run.lines.map((l) => (
          <details key={l.id} className="rounded-xl border border-border bg-card">
            <summary className="px-4 py-3 cursor-pointer list-none flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {l.workerName} <span className="text-xs text-muted-foreground">· {l.workerType}</span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {Number(l.regularHours)}h
                  {Number(l.overtimeHours) > 0 ? ` + ${Number(l.overtimeHours)}h OT` : ""}
                  {l.hourlyRate ? ` @ ${money(l.hourlyRate)}` : ""}
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-foreground tabular-nums">{money(l.net)}</div>
                <div className="text-[11px] text-muted-foreground tabular-nums">
                  {money(l.gross)} − {money(l.deductions)}
                </div>
              </div>
            </summary>
            {/* The payslip itself: exactly the items that were computed, in order. */}
            <div className="px-4 pb-4 border-t border-border pt-3">
              <ul className="space-y-1">
                {(Array.isArray(l.items) ? l.items : []).map((it, i) => (
                  <li key={i} className="flex justify-between text-sm">
                    <span className={it.kind === "deduction" ? "text-muted-foreground" : "text-foreground"}>
                      {it.kind === "deduction" ? "− " : ""}
                      {it.label}
                    </span>
                    <span
                      className={`tabular-nums ${it.kind === "deduction" ? "text-muted-foreground" : "text-foreground"}`}
                    >
                      {money(it.amount)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between text-sm font-bold text-foreground border-t border-border mt-2 pt-2">
                <span>Net</span>
                <span className="tabular-nums">{money(l.net)}</span>
              </div>
              {/* Only offered once approved — a draft's numbers can still
                  change, and a PDF someone keeps would be a figure they'd
                  reasonably treat as their pay. */}
              {run.status !== "draft" && (
                <a
                  href={`/api/payroll/runs/${run.id}/payslip/${l.id}`}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs border border-border rounded-full px-3 py-1.5"
                >
                  <Download size={12} /> Payslip PDF
                </a>
              )}
              {/* Honest about provenance: deductions are the company's figures. */}
              <p className="text-[11px] text-muted-foreground mt-2">
                Deductions use the rates saved in your payroll settings. FieldQuo does
                the arithmetic; confirm the rates with your accountant.
              </p>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
