"use client";

// app/components/sales/PayoutDestinationForm.js
//
// Where a rep says how they want to be paid.
//
// ══ Why this moved out of app/sales/pay/page.js ═══════════════════════════
//
// /sales/welcome asks a new rep for the same thing on their first morning, and
// the alternative was a second form posting the same body to the same route.
// That is AGENTS.md failure class #4 — and the copy that rots is the one
// nobody looks at, which here would be the first thing a new hire ever fills
// in. So the page keeps its heading and its explanation, and the control
// itself lives once.
//
// Everything the old page did, it still does. In particular:
//
//   · The vocabulary (methods, and the label for each method's handle field)
//     travels down in the route's own answer, so the form cannot drift from
//     the validator that will judge it.
//   · The confirmation date is shown, and its age is said out loud. A bank
//     account confirmed two years ago is a different claim from one confirmed
//     last week; a green tick says the same thing about both, and the stale one
//     is exactly the case where money goes to a closed account.
//   · `engagement` is read-only. Freelancer versus employee is an employment
//     classification with tax and paid-leave consequences on FieldQuo's side,
//     and a worker self-selecting it is not how that decision is made
//     anywhere. The route refuses to write it whatever this form posts.
import { useCallback, useEffect, useState } from "react";
import { Check, AlertTriangle, Info } from "lucide-react";

import { fetchJson } from "@/lib/fetchJson";

/**
 * @param showEngagement  the read-only "your engagement" panel. On /sales/pay
 *                        it belongs — that screen is where a rep goes to check
 *                        what FieldQuo has on them. On the first-run pass it is
 *                        noise beside a question they have to answer, and a
 *                        first-run screen that scrolls is one people abandon.
 * @param onSaved         called with the saved view, so /sales/welcome can tick
 *                        its step off without re-reading the route.
 */
export default function PayoutDestinationForm({ showEngagement = true, onSaved }) {
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
      onSaved?.(json);
    } catch (err) {
      // Never a silent failure: the whole point of this control is that the
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
    <div className="space-y-8">
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
          <p className="text-sm text-amber-800 dark:text-amber-200 break-words" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy || !method || !handle.trim() || !dirty}
            className="inline-flex items-center min-h-[44px] rounded-full bg-primary text-primary-foreground px-5 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? "Saving…" : data.payoutMethod ? "Confirm these details" : "Save"}
          </button>
          {saved && !dirty ? <span className="text-sm text-muted-foreground">Saved.</span> : null}
        </div>
      </form>

      {/* ── Read-only, and why ───────────────────────────────────────────── */}
      {showEngagement ? (
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
      ) : null}
    </div>
  );
}
