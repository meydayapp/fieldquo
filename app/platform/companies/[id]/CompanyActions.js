// app/platform/companies/[id]/CompanyActions.js
//
// Support actions that change FieldQuo's relationship with a customer — never
// their own data. Each one asks for a reason and writes an audit row, so
// "why is this account free until March" always has an answer.
//
// ── The comment that was wrong, and what it now describes ──────────────────
//
// This header used to read "Superadmin-only server-side; the panel says so
// rather than hiding". Half of that was true: extend-trial requires
// billing:manage, which is in SUPERADMIN_ONLY_PERMISSIONS. The other half was
// not — the panel said nothing of the kind. An admin or a support agent got a
// working-looking form, typed a reason, pressed Extend and got a 403.
//
// The intent was right, so the panel now does what the comment claimed: the
// heading and the explanation stay visible for everyone (a support agent has
// to know this exists in order to ask for it), and only the CONTROLS are
// replaced — by one block naming who can do it, never by a greyed-out form
// beside a floating sentence.
"use client";

import { useState } from "react";
import { Loader2, Gift, ShieldAlert, RefreshCw } from "lucide-react";
import PlatformWriteGate, {
  usePlatformAdmin,
} from "@/app/components/platform/PlatformWriteGate";

export default function CompanyActions({ companyId, companyName, trialEndsAt, onDone }) {
  const [days, setDays] = useState(30);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const { status: roleStatus, error: roleError, can } = usePlatformAdmin();
  const canExtend = can("billing:manage");

  async function extendTrial() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`/api/platform/companies/${companyId}/extend-trial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: Number(days), reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status}).`);
      setResult(json);
      setReason("");
      onDone?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = Number(days) >= 1 && reason.trim().length >= 3 && !busy;

  // ── End the trial now ──────────────────────────────────────────────────
  // The other direction: bill the first invoice today. Its own reason and
  // its own result, because "free until March" and "charged just now" must
  // never share a success line.
  const [endReason, setEndReason] = useState("");
  const [endBusy, setEndBusy] = useState(false);
  const [endResult, setEndResult] = useState(null);
  const [endError, setEndError] = useState("");

  async function endTrial() {
    if (!window.confirm(`Charge ${companyName} now? Stripe will create and pay the first invoice immediately.`)) return;
    setEndBusy(true);
    setEndError("");
    setEndResult(null);
    try {
      const res = await fetch(`/api/platform/companies/${companyId}/end-trial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: endReason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status}).`);
      setEndResult(json);
      setEndReason("");
      onDone?.();
    } catch (e) {
      setEndError(e.message);
    } finally {
      setEndBusy(false);
    }
  }

  // ── Sync from Stripe ──────────────────────────────────────────────────
  // Rewrites OUR row from what Stripe holds. No reason asked: it changes
  // nothing about what the company pays, and the audit row carries the
  // fields that moved. Its result is shown field by field because "synced"
  // alone would hide the one thing worth knowing — whether anything was wrong.
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncError, setSyncError] = useState("");

  async function syncFromStripe() {
    setSyncBusy(true);
    setSyncError("");
    setSyncResult(null);
    try {
      const res = await fetch(`/api/platform/companies/${companyId}/sync-subscription`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status}).`);
      setSyncResult(json);
      onDone?.();
    } catch (e) {
      setSyncError(e.message);
    } finally {
      setSyncBusy(false);
    }
  }

  const fmt = (v) => {
    if (v === null || v === undefined) return "—";
    const d = typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleString() : String(v);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="font-semibold text-foreground mb-1 flex items-center gap-2">
        <ShieldAlert size={16} className="text-muted-foreground" />
        Support actions
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        These change billing, never {companyName}&apos;s own records. Every action is
        logged against your name with the reason you give.
      </p>

      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gift size={15} className="text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Extend free period</span>
          {trialEndsAt && (
            <span className="text-xs text-muted-foreground">
              · currently until {new Date(trialEndsAt).toLocaleDateString()}
            </span>
          )}
        </div>

        <PlatformWriteGate
          status={roleStatus}
          allowed={canExtend}
          error={roleError}
          action="Extending a free period"
          who="superadmin"
        >
        <div className="flex items-end gap-2 flex-wrap">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">Days</span>
            <input
              type="number"
              min="1"
              max="365"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 flex-1 min-w-[12rem]">
            <span className="text-[11px] text-muted-foreground">Reason (required)</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. promised at the trade show"
              className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <button
            onClick={extendTrial}
            disabled={!canSubmit}
            className="min-h-[44px] lg:min-h-0 inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground rounded-full px-4 py-2 text-xs font-bold disabled:opacity-50"
          >
            {busy && <Loader2 size={13} className="animate-spin" />}
            Extend
          </button>
        </div>
        </PlatformWriteGate>

        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        {result && (
          <div className="mt-2 text-xs">
            <p className="text-emerald-700 dark:text-emerald-300 font-semibold">
              Free until {new Date(result.trialEndsAt).toLocaleDateString()}
              {result.stripeSynced ? " · Stripe updated" : ""}
            </p>
            {/* Said out loud: a grant Stripe doesn't know about still bills. */}
            {result.note && <p className="text-amber-700 dark:text-amber-400 mt-0.5">{result.note}</p>}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border p-4 mt-3">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert size={15} className="text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">End trial now</span>
          <span className="text-xs text-muted-foreground">· Stripe bills the first invoice today</span>
        </div>
        <PlatformWriteGate
          status={roleStatus}
          allowed={canExtend}
          error={roleError}
          action="Ending a free period"
          who="superadmin"
        >
          <div className="flex items-end gap-2 flex-wrap">
            <label className="flex flex-col gap-1 flex-1 min-w-[12rem]">
              <span className="text-[11px] text-muted-foreground">Reason (required)</span>
              <input
                value={endReason}
                onChange={(e) => setEndReason(e.target.value)}
                placeholder="e.g. owner's live payment test"
                className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <button
              onClick={endTrial}
              disabled={endReason.trim().length < 3 || endBusy}
              className="min-h-[44px] lg:min-h-0 inline-flex items-center gap-1.5 border border-border text-foreground rounded-full px-4 py-2 text-xs font-bold disabled:opacity-50"
            >
              {endBusy && <Loader2 size={13} className="animate-spin" />}
              End trial and charge now
            </button>
          </div>
        </PlatformWriteGate>
        {endError && <p className="text-xs text-red-600 mt-2">{endError}</p>}
        {endResult && (
          <p className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold mt-2">
            Stripe status now &quot;{endResult.stripeStatus}&quot;
            {endResult.latestInvoice ? ` · invoice ${endResult.latestInvoice}` : ""}
            {endResult.currentPeriodEnd ? ` · next renewal ${new Date(endResult.currentPeriodEnd).toLocaleDateString()}` : ""}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border p-4 mt-3">
        <div className="flex items-center gap-2 mb-3">
          <RefreshCw size={15} className="text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Sync from Stripe</span>
          <span className="text-xs text-muted-foreground">
            · rewrites our status, period end, trial end and cancelled-at from what Stripe holds
          </span>
        </div>
        <PlatformWriteGate
          status={roleStatus}
          allowed={canExtend}
          error={roleError}
          action="Syncing a subscription from Stripe"
          who="superadmin"
        >
          <button
            onClick={syncFromStripe}
            disabled={syncBusy}
            className="min-h-[44px] lg:min-h-0 inline-flex items-center gap-1.5 border border-border text-foreground rounded-full px-4 py-2 text-xs font-bold disabled:opacity-50"
          >
            {syncBusy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Sync from Stripe
          </button>
        </PlatformWriteGate>
        {syncError && <p className="text-xs text-red-600 mt-2">{syncError}</p>}
        {syncResult && (
          <div className="mt-2 text-xs">
            <p className="text-emerald-700 dark:text-emerald-300 font-semibold">
              Stripe says &quot;{syncResult.stripeStatus}&quot;
              {syncResult.changed?.length
                ? ` · ${syncResult.changed.length} field${syncResult.changed.length === 1 ? "" : "s"} corrected`
                : " · our row already agreed"}
            </p>
            {syncResult.changed?.length > 0 && (
              <ul className="mt-1 space-y-0.5 font-mono text-muted-foreground">
                {syncResult.changed.map((c) => (
                  <li key={c.field}>
                    {c.field}: {fmt(c.before)} → {fmt(c.after)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
