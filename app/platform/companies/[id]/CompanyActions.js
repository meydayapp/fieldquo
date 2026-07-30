// app/platform/companies/[id]/CompanyActions.js
//
// Support actions that change FieldQuo's relationship with a customer — never
// their own data. Each one asks for a reason and writes an audit row, so
// "why is this account free until March" always has an answer.
//
// Superadmin-only server-side; the panel says so rather than hiding, because a
// support agent needs to know the action exists in order to ask for it.
"use client";

import { useState } from "react";
import { Loader2, Gift, ShieldAlert } from "lucide-react";

export default function CompanyActions({ companyId, companyName, trialEndsAt, onDone }) {
  const [days, setDays] = useState(30);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

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
            className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground rounded-full px-4 py-2 text-xs font-bold disabled:opacity-50"
          >
            {busy && <Loader2 size={13} className="animate-spin" />}
            Extend
          </button>
        </div>

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
    </div>
  );
}
