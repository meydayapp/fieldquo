// app/(marketing)/contact/ContactForm.js
//
// Client half of /contact. Split from page.js purely so the route can export
// metadata — a "use client" page cannot, which is why /contact was one of the
// pages whose tab said only "FieldQuo".
//
// ── English only, and it is a gap rather than a decision ────────────────────
//
// This file has no useTranslation import at all: every string below is a raw
// English literal on a site that ships eight languages. That is a real debt,
// written down rather than left to be discovered, and it is NOT fixable from
// here — the strings have to land in app/i18n/messages.js first, and half a
// screen resolved through t() inside an otherwise English form is worse than
// the English, because it reads as software falling over rather than as a page
// nobody has translated. The keys are: contact.title, contact.intro,
// contact.name, contact.email, contact.message, contact.namePlaceholder,
// contact.emailPlaceholder, contact.messagePlaceholder, contact.send,
// contact.sending, contact.sent, contact.failed, contact.failedFallback.
// Thirteen strings; the same page under /resources already speaks all eight,
// so this is the one screen in that pair that does not.
//
// ── Labels, not placeholders ───────────────────────────────────────────────
//
// The three fields used to carry a placeholder and no label, which is the
// commonest form-accessibility defect there is and the one that bites hardest
// on the surface this page actually serves: a stranger on a phone, whose
// keyboard covers half the form, and whose label vanishes the moment they
// start typing. A placeholder is a hint. It is not a name for the box, it is
// not read reliably by a screen reader as one, and it is gone exactly when it
// is wanted.
"use client";

import { useState } from "react";
import { fetchJson } from "@/lib/fetchJson";
import { SUPPORT_EMAIL } from "@/lib/supportContact";

export default function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Inline rather than the global toast: ErrorToast is only mounted in the
  // /app layout, so a dispatched error would go nowhere on the public site.
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      // The old version awaited fetch and then declared success unconditionally,
      // so a rejected or failing submission still showed "we'll get back to
      // you" — the message was gone and nobody was waiting for it.
      await fetchJson("/api/marketing/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "contact_page" }),
      });
      setSubmitted(true);
    } catch (err) {
      setError(
        err?.message || "We couldn't send your message. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold text-foreground mb-2">Contact Us</h1>
      <p className="text-muted-foreground mb-8">
        Have a question, or want a demo? Send us a message.
      </p>

      {submitted ? (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-6 text-sm">
          Thanks for reaching out — we&apos;ll get back to you shortly.
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {/* aria-live, because the failure is announced without the focus
              moving: a submit that fails leaves the cursor on the button and a
              sentence appears above the fold of the keyboard. Silent to
              anybody not looking at that part of the screen otherwise. */}
          {/* No dark: variants on the box below. app/layout.js allow-lists
              /app and /platform as themeable and this tree is deliberately
              light-only, so the dark:bg-red-950/40 that used to be here could
              never apply — a rule that looks like coverage and is dead. */}
          <div aria-live="polite">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                <p>{error}</p>
                {/* The route's own 502 already names the address, but a
                    network failure never reaches the route and produced a
                    dead end: a message that did not send, on a page whose
                    only other content is the form that just failed. */}
                <p className="mt-1">
                  You can also email us directly at{" "}
                  <a className="underline font-medium" href={`mailto:${SUPPORT_EMAIL}`}>
                    {SUPPORT_EMAIL}
                  </a>
                  .
                </p>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="contact-name" className="block text-sm font-medium text-foreground mb-1.5">
              Your name
            </label>
            <input
              id="contact-name"
              name="name"
              required
              autoComplete="name"
              placeholder="Jordan Reyes"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-border rounded-lg px-4 py-3 text-sm"
            />
          </div>

          <div>
            <label htmlFor="contact-email" className="block text-sm font-medium text-foreground mb-1.5">
              Your email
            </label>
            <input
              id="contact-email"
              name="email"
              required
              type="email"
              // inputMode + autoComplete are the difference between a phone
              // offering the @ key and the saved address, and not.
              inputMode="email"
              autoComplete="email"
              placeholder="you@yourcompany.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-border rounded-lg px-4 py-3 text-sm"
            />
          </div>

          <div>
            <label htmlFor="contact-message" className="block text-sm font-medium text-foreground mb-1.5">
              How can we help?
            </label>
            <textarea
              id="contact-message"
              name="message"
              required
              rows={5}
              placeholder="What you do, and what you are trying to work out."
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full border border-border rounded-lg px-4 py-3 text-sm resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[44px] bg-primary text-primary-foreground py-3 rounded-full text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? "Sending…" : "Send message"}
          </button>
        </form>
      )}
    </div>
  );
}
