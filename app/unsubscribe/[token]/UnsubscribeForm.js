// app/unsubscribe/[token]/UnsubscribeForm.js
//
// GET on mount (read-only — safe for a mail client's link-scanner to
// prefetch), then ONE button that POSTs the actual unsubscribe. That's the
// whole flow: no login, no second confirmation screen, no typing anything.
//
// ══ Why the failure path gets as much care as the happy one ════════════════
//
// This is a compliance surface. It is how a person exercises an opt-out, and
// lib/marketing/unsubscribe.js deliberately contains no delete — the record of
// the request is the evidence. So the state that matters most is the one where
// the POST does NOT land: a driveway with one bar, a Neon cold start returning
// P1001, a 500.
//
// It used to fail like this. The catch set `state.error`, and the render read
//
//     {!state.loading && state.error && <the error>}
//     {!state.loading && !state.error && state.data && <the form>}
//
// so setting the error UNMOUNTED the form. The person was left looking at one
// grey sentence, no button, and no way to try again short of finding the email
// again — and nothing on the screen told them whether they were unsubscribed
// or not. FieldQuo would have been able to prove it was asked and did not act,
// which is the exact position this page exists to keep it out of.
//
// Now a failed LOAD and a failed SUBMIT are different things, because they are
// different things: the first means there is nothing to act on, the second
// means the request has not been recorded YET. The second keeps the button on
// screen, says plainly that nothing has changed, and can be pressed again.
"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, MailX, AlertCircle } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

export default function UnsubscribeForm({ token }) {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [submitting, setSubmitting] = useState(false);
  // Held apart from `state.error`, which is about the LOAD. Merging them is
  // what took the button off the screen.
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchJson(`/api/unsubscribe/${encodeURIComponent(token)}`)
      .then((data) => {
        if (!cancelled) setState({ loading: false, error: "", data });
      })
      .catch((err) => {
        if (!cancelled) setState({ loading: false, error: err.message, data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleUnsubscribe() {
    setSubmitting(true);
    setSubmitError("");
    try {
      await fetchJson(`/api/unsubscribe/${encodeURIComponent(token)}`, { method: "POST" });
      setDone(true);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const company = state.data?.companyName || "this company";

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm bg-white border border-neutral-200 rounded-xl p-8 text-center">
        {state.loading && (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-neutral-400" />
        )}

        {!state.loading && state.error && (
          <>
            <MailX className="mx-auto h-8 w-8 text-neutral-400 mb-3" />
            <p className="text-sm text-neutral-600">{state.error}</p>
          </>
        )}

        {!state.loading && !state.error && state.data && (
          <>
            {done || state.data.alreadyUnsubscribed ? (
              <>
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600 mb-3" />
                <h1 className="text-base font-semibold text-neutral-900 mb-1">
                  You&apos;re unsubscribed
                </h1>
                <p className="text-sm text-neutral-600">
                  {state.data.email} won&apos;t receive marketing email from {company}{" "}
                  again. You may still get quotes, invoices and other messages about
                  work you&apos;ve requested.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-base font-semibold text-neutral-900 mb-1">
                  Unsubscribe from {company}?
                </h1>
                <p className="text-sm text-neutral-600 mb-5">
                  {state.data.email} will stop receiving marketing email. You&apos;ll
                  still get quotes, invoices and other messages about work
                  you&apos;ve requested.
                </p>

                {/* Above the button, not instead of it. The sentence has to say
                    the thing a person in this state actually needs to know —
                    that they are NOT unsubscribed — because a bare error
                    message next to a button they already pressed reads as
                    "something went wrong, but it probably worked". */}
                {submitError && (
                  <div
                    role="alert"
                    className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-left text-sm text-red-800"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      You&apos;re still subscribed — that didn&apos;t go through.{" "}
                      {submitError} Press the button again.
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleUnsubscribe}
                  disabled={submitting}
                  // min-h-11: 44px. py-2.5 made this 40px, on a page that is
                  // only ever opened on a phone.
                  className="w-full inline-flex items-center justify-center gap-2 min-h-11 rounded-lg bg-neutral-900 text-white text-sm font-medium py-2.5 px-4 disabled:opacity-60"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitError ? "Try again" : "Unsubscribe"}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
