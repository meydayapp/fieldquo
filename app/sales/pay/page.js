"use client";

// app/sales/pay/page.js
//
// Where a rep says how they want to be paid.
//
// ══ Why this screen had to be built ═══════════════════════════════════════
//
// SalesRep has carried `engagement`, `accruesPaidLeave`, `payoutMethod`,
// `payoutHandle` and `payoutConfirmedAt` since the compensation work, and
// lib/sales/payoutDetails.js has carried the vocabulary and the readiness
// rules. Nothing in app/ read or wrote one of them — AGENTS.md failure class 1,
// written and never read. A rep who closed a company had no way to say where
// the money should go, and the only way to find out was to ask them in a chat
// window.
//
// ══ What a rep may set here, and what they may not ════════════════════════
//
// The DESTINATION is theirs: the method and the handle, because it is their
// own bank account and nobody else should be typing it.
//
// Freelancer versus employee is NOT theirs. It is an employment classification
// with tax and paid-leave consequences on FieldQuo's side, and a worker
// self-selecting it is not how that decision is made anywhere. It is shown
// read-only so a rep can SEE what they are on and query it if it is wrong —
// which is the part that was impossible before — and the route refuses to
// write it whatever this screen posts.
//
// ══ Why the confirmation date is shown, and not just a tick ═══════════════
//
// A bank account confirmed two years ago is a different claim from one
// confirmed last week. A green tick says the same thing about both, and the
// stale one is exactly the case where money goes to a closed account.
import { useCallback, useEffect, useState } from "react";
import { Check, AlertTriangle, Info } from "lucide-react";

import { fetchJson } from "@/lib/fetchJson";

export default function SalesPayPage() {
  const [data, setData] = useState(null);
  const [method, setMethod] = useState("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // No setLoading(true) here: `loading` already starts true, and setting state
  // synchronously inside the effect below triggers a cascading render that the
  // React compiler rejects. A manual reload keeps the last view until the new
  // one lands, which is the better behaviour anyway — a form that blanks while
  // it re-reads loses whatever the rep had half-typed.
  const load = useCallback(async () => {
    try {
      const json = await fetchJson("/api/sales/payout");
      setData(json);
      setMethod(json.payoutMethod || "");
      setHandle(json.payoutHandle || "");
      setError("");
    } catch (err) {
      setError(err?.message || "Couldn't load your payout details.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const json = await fetchJson("/api/sales/payout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payoutMethod: method, payoutHandle: handle.trim() }),
      });
      setData(json);
      setMethod(json.payoutMethod || "");
      setHandle(json.payoutHandle || "");
      setSaved(true);
    } catch (err) {
      // Never a silent failure: the whole point of this screen is that the
      // details are known to be right.
      setError(err?.message || "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading your payout details…</p>;
  }
  if (!data) {
    return (
      <div className="rounded-xl border border-border p-4">
        <p className="text-sm text-foreground">{error || "Couldn't load your payout details."}</p>
      </div>
    );
  }

  const chosen = (data.methods || []).find((m) => m.key === method) || null;
  const engagement = (data.engagements || []).find((e) => e.key === data.engagement) || null;
  const dirty =
    method !== (data.payoutMethod || "") || handle.trim() !== (data.payoutHandle || "");

  return (
    <div className="space-y-8 max-w-2xl">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground">How you get paid</h1>
        <p className="text-sm text-muted-foreground">
          Where FieldQuo sends your commission. Only you can set this, and you can
          change it whenever you like — the date below is when you last confirmed
          it was right.
        </p>
      </header>

      {/* ── What is missing, before anything else ─────────────────────────── */}
      {!data.ready && (data.problems || []).length ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-4 space-y-3">
          {data.problems.map((p) => (
            <div key={p.code} className="text-sm text-amber-900 dark:text-amber-200">
              <div className="flex gap-2">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <div className="font-semibold">{p.title}</div>
                  <p className="mt-0.5">{p.fix}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {data.ready ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex gap-2 text-sm text-foreground">
            <Check size={16} className="shrink-0 mt-0.5 text-primary" aria-hidden="true" />
            <div>
              <div className="font-semibold">Your payout details are on file.</div>
              <p className="mt-0.5 text-muted-foreground">
                {data.confirmedDaysAgo === null
                  ? "Confirmed."
                  : data.confirmedDaysAgo === 0
                    ? "Confirmed today."
                    : `Confirmed ${data.confirmedDaysAgo} day${data.confirmedDaysAgo === 1 ? "" : "s"} ago.`}
                {/* Said out loud, because a stale confirmation is the case
                    where money goes to an account that has since closed. */}
                {data.confirmedDaysAgo !== null && data.confirmedDaysAgo > 180
                  ? " That was a while ago — worth re-confirming it is still right."
                  : ""}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── The form ─────────────────────────────────────────────────────── */}
      <form onSubmit={save} className="space-y-6">
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-foreground">
            How would you like to be paid?
          </legend>
          <div className="space-y-2">
            {(data.methods || []).map((m) => (
              <label
                key={m.key}
                className={`flex gap-3 rounded-xl border p-3 cursor-pointer transition ${
                  method === m.key ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                }`}
              >
                <input
                  type="radio"
                  name="payoutMethod"
                  value={m.key}
                  checked={method === m.key}
                  onChange={() => {
                    setMethod(m.key);
                    setSaved(false);
                  }}
                  className="mt-1 shrink-0"
                />
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">{m.label}</span>
                  {/* Their own trade-offs, stated before the choice rather than
                      discovered when the money is short. */}
                  <span className="block text-sm text-muted-foreground mt-0.5">{m.note}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {chosen ? (
          <div className="space-y-2">
            <label htmlFor="payoutHandle" className="block text-sm font-semibold text-foreground">
              {chosen.handleLabel}
            </label>
            <input
              id="payoutHandle"
              type="text"
              value={handle}
              onChange={(e) => {
                setHandle(e.target.value);
                setSaved(false);
              }}
              maxLength={300}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder={chosen.handleLabel}
            />
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-amber-800 dark:text-amber-200 break-words">{error}</p>
        ) : null}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy || !method || !handle.trim() || !dirty}
            className="rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? "Saving…" : data.payoutMethod ? "Confirm these details" : "Save"}
          </button>
          {saved && !dirty ? (
            <span className="text-sm text-muted-foreground">Saved.</span>
          ) : null}
        </div>
      </form>

      {/* ── Read-only, and why ───────────────────────────────────────────── */}
      <section className="rounded-xl border border-border p-4 space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Your engagement</h2>
        {engagement ? (
          <>
            <p className="text-sm text-foreground">{engagement.label}</p>
            <p className="text-sm text-muted-foreground">{engagement.note}</p>
            <p className="text-sm text-muted-foreground">
              {data.accruesPaidLeave
                ? "Paid leave accrues on your arrangement."
                : "No paid leave or vacation accrues on your arrangement."}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nobody has recorded whether you are engaged as a freelancer or an
            employee yet.
          </p>
        )}
        <p className="text-xs text-muted-foreground flex gap-2 pt-1">
          <Info size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            This one is set by FieldQuo, not here — it decides paid leave and what
            is withheld, so it is not something to pick for yourself. If it looks
            wrong, say so and it will be corrected.
          </span>
        </p>
      </section>
    </div>
  );
}
