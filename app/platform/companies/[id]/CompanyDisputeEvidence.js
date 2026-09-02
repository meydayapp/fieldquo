// app/platform/companies/[id]/CompanyDisputeEvidence.js
//
// What FieldQuo can prove about a company's use of the product, in the shape
// Stripe's dispute evidence form wants it.
//
// ── Why a button rather than a load-on-mount panel ─────────────────────────
//
// Two reasons, and neither is performance theatre. The query behind this reads
// six tables and counts six more, and nobody opening a company page needs that
// every time. And it is superadmin-only server-side: a support agent who has
// this fetch fire on mount would meet a permanent red error banner on a panel
// they cannot use. Pressed deliberately, the same 403 reads as what it is.
//
// Nothing here submits to Stripe, and the panel says so. Assembling evidence
// and deciding to contest a chargeback are different decisions; only the first
// one has been made. Staff copy the text into Stripe themselves.
"use client";

import { useState } from "react";
import { Loader2, Gavel, Copy, Check, AlertTriangle } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

function when(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Stripe's own field name, with the value we can honestly put in it. */
function Field({ name, value }) {
  const [copied, setCopied] = useState(false);
  const multiline = String(value).includes("\n");
  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
        <code className="text-[11px] font-mono text-muted-foreground">{name}</code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(String(value));
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              // Clipboard is permission-gated and can simply refuse. The text is
              // on screen and selectable either way, so this is not an error
              // worth a banner — but it must not silently pretend it copied.
              setCopied(false);
            }
          }}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        className={`px-3 py-2 text-[11px] text-foreground whitespace-pre-wrap break-words font-mono ${
          multiline ? "max-h-72 overflow-y-auto" : ""
        }`}
      >
        {value}
      </pre>
    </div>
  );
}

export default function CompanyDisputeEvidence({ companyId, companyName }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function assemble() {
    setBusy(true);
    setError("");
    try {
      setData(await fetchJson(`/api/platform/companies/${companyId}/dispute-evidence`));
    } catch (e) {
      setError(e.message);
      setData(null);
    } finally {
      setBusy(false);
    }
  }

  const standing = data?.standing;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="font-semibold text-foreground mb-1 flex items-center gap-2">
        <Gavel size={16} className="text-muted-foreground" />
        Chargeback evidence
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        Everything FieldQuo can prove about {companyName || "this company"}&apos;s use of the
        product, in Stripe&apos;s dispute-evidence fields. Nothing is sent to Stripe from
        here — copy what you need into the dispute yourself. Superadmin only.
      </p>

      <button
        type="button"
        onClick={assemble}
        disabled={busy}
        className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium disabled:opacity-60 flex items-center gap-2"
      >
        {busy && <Loader2 size={14} className="animate-spin" />}
        {data ? "Reassemble" : "Assemble evidence"}
      </button>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {data && (
        <div className="mt-4 space-y-4">
          {/* What the webhook actually recorded — the reason anyone is here. */}
          {standing && (standing.disputeStatus || standing.refundedAt) && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs">
              {standing.disputeStatus && (
                <div>
                  Dispute status from Stripe:{" "}
                  <strong className="font-mono">{standing.disputeStatus}</strong>
                  {standing.disputedAt ? ` — opened ${when(standing.disputedAt)}` : ""}
                </div>
              )}
              {standing.refundedAt && (
                <div className="mt-1">
                  Last refunded subscription charge:{" "}
                  <strong>${((standing.refundedAmountCents || 0) / 100).toFixed(2)}</strong> on{" "}
                  {when(standing.refundedAt)}
                </div>
              )}
            </div>
          )}

          {/* The verdict first. A company with no usage must not have a wall of
              evidence fields implying otherwise. */}
          {data.hasUsage ? (
            <p className="text-sm text-foreground">
              Recorded use from <strong>{when(data.summary.firstUsedAt)}</strong> to{" "}
              <strong>{when(data.summary.lastUsedAt)}</strong> — {data.summary.quotesSent} quotes
              sent, {data.summary.invoicesSent} invoices, {data.summary.jobsCreated} jobs,{" "}
              {data.summary.paymentsCollected} payments collected,{" "}
              {data.summary.devicesSeen} sign-in devices.
            </p>
          ) : (
            <p className="text-sm flex items-start gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              No product usage is recorded for this account at all. There is nothing here to
              contest a dispute with, and the evidence text says exactly that.
            </p>
          )}

          {data.gaps?.length > 0 && (
            <div className="rounded-lg border border-border p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
                What Stripe would accept but we cannot fill
              </div>
              <ul className="space-y-1">
                {data.gaps.map((g, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    · {g}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.truncated && (
            <p className="text-xs text-muted-foreground">
              The activity log was truncated to Stripe&apos;s 20,000-character field limit.
            </p>
          )}

          <div className="space-y-3">
            {Object.entries(data.evidence).map(([name, value]) => (
              <Field key={name} name={name} value={value} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
