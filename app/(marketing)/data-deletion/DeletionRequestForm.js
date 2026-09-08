// app/(marketing)/data-deletion/DeletionRequestForm.js
//
// Client half of /data-deletion: the written request, as a form. Split from
// page.js so the route keeps its metadata export (same reason as
// app/(marketing)/contact/ContactForm.js), and the page around it stays a
// server component that check-legal-pages.mjs can read as prose.
//
// What submitting does: POST /api/data-deletion, which records the request
// under a reference and emails a receipt. What it does not do: delete
// anything — the paragraph above the form says so, and the success state
// repeats it, because the moment after pressing a button called "Send
// request" is exactly when a person decides what they think just happened.
//
// The success state is honest in both directions. A reference always comes
// back when the row was written; whether the receipt EMAIL went out is a
// separate fact the route reports separately, and a failed receipt is shown
// beside the reference rather than folded into a green box.
//
// English only, like its neighbours — see the header of page.js.
"use client";

import { useState } from "react";
import { fetchJson } from "@/lib/fetchJson";
import { SUPPORT_EMAIL } from "@/lib/supportContact";
import { DELETION_BUSINESS_DAYS, HONEYPOT_FIELD } from "@/lib/dataDeletion/constants";

const FIELD = "w-full border border-border rounded-lg px-4 py-3 text-base bg-background text-foreground";

export default function DeletionRequestForm() {
  const [form, setForm] = useState({ name: "", email: "", companyName: "", message: "" });
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const data = await fetchJson("/api/data-deletion", {
        method: "POST",
        body: { ...form, [HONEYPOT_FIELD]: honeypot },
      });
      setResult(data);
    } catch (err) {
      setError(err?.message || "We couldn't send your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (result?.confirmationCode) {
    return (
      <div
        className="bg-green-50 border border-green-200 text-green-900 rounded-xl p-6 text-sm space-y-3"
        role="status"
      >
        <p className="font-semibold text-base">
          Request received. Your reference is{" "}
          <span className="font-mono">{result.confirmationCode}</span>.
        </p>
        <p>
          FieldQuo&apos;s owner will delete the data manually within {DELETION_BUSINESS_DAYS}{" "}
          business days and confirm by email when it is done. Nothing has been deleted yet —
          this page recorded the request; a person carries it out.
        </p>
        {result.acknowledgementSent ? (
          <p>A confirmation email with this reference is on its way to {form.email}.</p>
        ) : (
          <p className="text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {result.warning ||
              `The confirmation email could not be sent. Keep the reference above, and email ${SUPPORT_EMAIL} if you want it in writing.`}
          </p>
        )}
        <p>
          You can check on it any time at{" "}
          <a className="underline" href={`/data-deletion?code=${encodeURIComponent(result.confirmationCode)}`}>
            this page with your reference
          </a>
          .
        </p>
      </div>
    );
  }

  // A honeypot hit answers with ok and no code; a person never lands here,
  // and if one somehow did, the truthful thing is a plain sentence rather
  // than a fake reference.
  if (result && !result.confirmationCode) {
    return (
      <p className="text-sm text-muted-foreground">
        We couldn&apos;t accept that submission. Please email{" "}
        <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> instead.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 not-prose">
      <div aria-live="polite">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            <p>{error}</p>
            <p className="mt-1">
              You can also email us directly at{" "}
              <a className="underline font-medium" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
            </p>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="dd-email" className="block text-sm font-medium text-foreground mb-1.5">
          Your email — where we send the confirmation
        </label>
        <input
          id="dd-email"
          name="email"
          type="email"
          required
          inputMode="email"
          autoComplete="email"
          value={form.email}
          onChange={set("email")}
          className={FIELD}
        />
      </div>

      <div>
        <label htmlFor="dd-name" className="block text-sm font-medium text-foreground mb-1.5">
          Your name
        </label>
        <input
          id="dd-name"
          name="name"
          autoComplete="name"
          value={form.name}
          onChange={set("name")}
          className={FIELD}
        />
      </div>

      <div>
        <label htmlFor="dd-company" className="block text-sm font-medium text-foreground mb-1.5">
          The contracting company whose records this concerns (or your own company, if you are the
          account holder)
        </label>
        <input
          id="dd-company"
          name="companyName"
          autoComplete="organization"
          value={form.companyName}
          onChange={set("companyName")}
          className={FIELD}
        />
      </div>

      <div>
        <label htmlFor="dd-message" className="block text-sm font-medium text-foreground mb-1.5">
          What you want deleted, and anything that helps us find it (the email or phone number the
          records are under, a quote or invoice number)
        </label>
        <textarea
          id="dd-message"
          name="message"
          rows={5}
          value={form.message}
          onChange={set("message")}
          className={`${FIELD} resize-none`}
        />
      </div>

      {/* The honeypot. Off-screen rather than display:none, because some
          form-fillers skip hidden inputs and fill the rest. tabIndex -1 and
          aria-hidden keep it out of a keyboard or screen-reader path. */}
      <div className="absolute left-[-10000px] top-auto w-px h-px overflow-hidden" aria-hidden="true">
        <label htmlFor={`dd-${HONEYPOT_FIELD}`}>Website</label>
        <input
          id={`dd-${HONEYPOT_FIELD}`}
          name={HONEYPOT_FIELD}
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full min-h-[44px] bg-primary text-primary-foreground py-3 rounded-full text-sm font-semibold disabled:opacity-60"
      >
        {submitting ? "Sending…" : "Send deletion request"}
      </button>
    </form>
  );
}
