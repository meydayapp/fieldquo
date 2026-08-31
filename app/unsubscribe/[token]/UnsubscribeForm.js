// app/unsubscribe/[token]/UnsubscribeForm.js
//
// GET on mount (read-only — safe for a mail client's link-scanner to
// prefetch), then ONE button that POSTs the actual unsubscribe. That's the
// whole flow: no login, no second confirmation screen, no typing anything.
"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, MailX } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

export default function UnsubscribeForm({ token }) {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [submitting, setSubmitting] = useState(false);
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
    try {
      await fetchJson(`/api/unsubscribe/${encodeURIComponent(token)}`, { method: "POST" });
      setDone(true);
    } catch (err) {
      setState((s) => ({ ...s, error: err.message }));
    } finally {
      setSubmitting(false);
    }
  }

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
                  You're unsubscribed
                </h1>
                <p className="text-sm text-neutral-600">
                  {state.data.email} won't receive marketing email from{" "}
                  {state.data.companyName || "this company"} again. You may still get
                  quotes, invoices and other messages about work you've requested.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-base font-semibold text-neutral-900 mb-1">
                  Unsubscribe from {state.data.companyName || "this company"}?
                </h1>
                <p className="text-sm text-neutral-600 mb-5">
                  {state.data.email} will stop receiving marketing email. You'll still
                  get quotes, invoices and other messages about work you've requested.
                </p>
                <button
                  type="button"
                  onClick={handleUnsubscribe}
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 text-white text-sm font-medium py-2.5 px-4 disabled:opacity-60"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Unsubscribe
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
