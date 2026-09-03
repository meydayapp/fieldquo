// app/no-contact/[token]/NoContactForm.js
//
// GET on mount (read-only, safe for a mail scanner to prefetch), then ONE
// button that POSTs. Modelled on app/unsubscribe/[token]/UnsubscribeForm.js
// deliberately — the flow is identical and a second, different-feeling opt-out
// screen would be the harder one to keep working.
//
// The copy is NOT identical, and the difference is the point: that page ends a
// contractor's marketing email and says quotes and invoices still arrive. This
// one ends FieldQuo's own contact on every channel — email, phone and text —
// because that is what the button does (see the route header), and a page that
// undersold it would be describing a different action from the one performed.
"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, MailX } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

export default function NoContactForm({ token }) {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchJson(`/api/no-contact/${encodeURIComponent(token)}`)
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

  async function stopContact() {
    setSubmitting(true);
    try {
      await fetchJson(`/api/no-contact/${encodeURIComponent(token)}`, { method: "POST" });
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
            {done || state.data.alreadySuppressed ? (
              <>
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600 mb-3" />
                <h1 className="text-base font-semibold text-neutral-900 mb-1">
                  We&apos;ll stop
                </h1>
                <p className="text-sm text-neutral-600">
                  FieldQuo won&apos;t email, call or text {state.data.email} again.
                  Anything you already set up in FieldQuo is untouched — nothing
                  here deletes it.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-base font-semibold text-neutral-900 mb-1">
                  Stop hearing from FieldQuo?
                </h1>
                <p className="text-sm text-neutral-600 mb-5">
                  FieldQuo will stop emailing, calling and texting{" "}
                  {state.data.email}. Your account and anything you set up stay
                  exactly as they are.
                </p>
                <button
                  type="button"
                  onClick={stopContact}
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 text-white text-sm font-medium py-2.5 px-4 disabled:opacity-60"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Stop contacting me
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
