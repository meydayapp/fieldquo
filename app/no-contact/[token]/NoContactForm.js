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
//
// FieldQuo is named here, and only here among the opt-out pages, because the
// sender IS FieldQuo: this link goes to someone who started a signup and never
// finished it. The white-label rule is about the pages a contractor's CLIENTS
// see; hiding our name from someone we are the one emailing would make the
// sentence untrue.
//
// ══ The failed POST ════════════════════════════════════════════════════════
//
// Same fault this page inherited from the one it was modelled on, and the same
// fix: setting the error used to unmount the button, leaving a person who had
// just asked to be left alone with one grey sentence and no second attempt.
// SalesSuppression has no delete and a three-year-and-fourteen-day retention
// clock (lib/sales/suppressionRules.js) precisely so a request can be proved;
// the request that never reached the server is the one that cannot be. So a
// failed submit keeps the button, says nothing has changed, and is pressable
// again.
"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, MailX, AlertCircle } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

export default function NoContactForm({ token }) {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [submitting, setSubmitting] = useState(false);
  // Separate from the load error on purpose — see the header.
  const [submitError, setSubmitError] = useState("");
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
    setSubmitError("");
    try {
      await fetchJson(`/api/no-contact/${encodeURIComponent(token)}`, { method: "POST" });
      setDone(true);
    } catch (err) {
      setSubmitError(err.message);
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

                {/* Says they are still on the list, not just that something
                    failed. A person who pressed "stop contacting me" and saw a
                    vague error will assume it worked; the next call is then the
                    complaint. */}
                {submitError && (
                  <div
                    role="alert"
                    className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-left text-sm text-red-800"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      Nothing has changed yet — that didn&apos;t go through.{" "}
                      {submitError} Press the button again.
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={stopContact}
                  disabled={submitting}
                  // 44px. This is a phone-only page and py-2.5 made it 40.
                  className="w-full inline-flex items-center justify-center gap-2 min-h-11 rounded-lg bg-neutral-900 text-white text-sm font-medium py-2.5 px-4 disabled:opacity-60"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitError ? "Try again" : "Stop contacting me"}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
