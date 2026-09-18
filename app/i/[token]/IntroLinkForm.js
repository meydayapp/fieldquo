// app/i/[token]/IntroLinkForm.js
//
// GET on mount (read-only, safe for a mail scanner to prefetch), then ONE
// button that POSTs — the shape of app/no-contact/[token]/NoContactForm.js.
//
// The words come from lib/sales/outreach/introLinkCopy.js in the language
// the EMAIL was sent in, which the GET returns; until it answers, the page
// shows a spinner and nothing in any language, because it does not yet
// know which one. A failed POST keeps the button so the person can press
// it again.
//
// FieldQuo is named here because FieldQuo is the sender: this is a
// contractor who was rung by FieldQuo's own sales team, not a homeowner
// reading a contractor's document.
"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, PhoneCall } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { fillIntroCopy, introLinkCopy } from "@/lib/sales/outreach/introLinkCopy";

export default function IntroLinkForm({ token }) {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchJson(`/api/intro-link/${encodeURIComponent(token)}`)
      .then((data) => {
        if (!cancelled) setState({ loading: false, error: "", data });
      })
      .catch((err) => {
        if (!cancelled) setState({ loading: false, error: err?.status === 410 || /expired/i.test(err?.message || "") ? "expired" : "invalid", data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function act() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const result = await fetchJson(`/api/intro-link/${encodeURIComponent(token)}`, { method: "POST" });
      setDone(result);
    } catch (err) {
      setSubmitError(err?.message || "failed");
    } finally {
      setSubmitting(false);
    }
  }

  const data = state.data;
  const copy = introLinkCopy(data?.language || "en");
  const values = { rep: data?.repName || "", business: data?.businessName || "", phone: data?.repPhone || "" };
  const kind = data?.kind;

  return (
    <main className="min-h-screen bg-[#f6f4f0] text-[#20242b] flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-[#e4e2dd] bg-white p-6 space-y-4">
        {state.loading ? (
          <p className="flex items-center gap-2 text-sm text-[#5b6472]">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          </p>
        ) : state.error ? (
          <div className="flex items-start gap-2 text-sm">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-[#b91c1c]" aria-hidden="true" />
            <p>{state.error === "expired" ? copy.expired : copy.invalid}</p>
          </div>
        ) : done ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-[#15803d]" aria-hidden="true" />
              <p className="text-base font-medium">
                {fillIntroCopy(done.already ? copy.already[kind] : copy.done[kind], values)}
              </p>
            </div>
            {kind === "demo" && data?.repPhone ? (
              <p className="text-sm text-[#5b6472] flex items-center gap-2">
                <PhoneCall size={15} aria-hidden="true" />
                <a href={`tel:${data.repPhone}`} className="underline">{fillIntroCopy(copy.repPhone, values)}</a>
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <h1 className="text-lg font-semibold">{copy.title[kind]}</h1>
            <p className="text-sm">{fillIntroCopy(data.already ? copy.already[kind] : copy.ask[kind], values)}</p>
            {!data.already ? (
              <button
                type="button"
                onClick={act}
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 min-h-[48px] w-full rounded-lg bg-[#06356b] px-4 text-base font-semibold text-white disabled:opacity-60"
                data-intro-link-act={kind}
              >
                {submitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
                {submitting ? copy.working : copy.button[kind]}
              </button>
            ) : null}
            {kind === "demo" && data?.repPhone ? (
              <p className="text-sm text-[#5b6472] flex items-center gap-2">
                <PhoneCall size={15} aria-hidden="true" />
                <a href={`tel:${data.repPhone}`} className="underline">{fillIntroCopy(copy.repPhone, values)}</a>
              </p>
            ) : null}
            {submitError ? (
              <p className="flex items-start gap-2 text-sm text-[#b91c1c]" role="alert">
                <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                {copy.failed}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
