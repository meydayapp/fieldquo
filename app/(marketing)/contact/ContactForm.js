// app/(marketing)/contact/ContactForm.js
//
// Client half of /contact. Split from page.js purely so the route can export
// metadata — a "use client" page cannot, which is why /contact was one of the
// pages whose tab said only "FieldQuo".
"use client";

import { useState } from "react";
import { fetchJson } from "@/lib/fetchJson";

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
          Thanks for reaching out — we'll get back to you shortly.
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}
          <input
            required
            placeholder="Your name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border border-border rounded-lg px-4 py-3 text-sm"
          />
          <input
            required
            type="email"
            placeholder="Your email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full border border-border rounded-lg px-4 py-3 text-sm"
          />
          <textarea
            required
            placeholder="How can we help?"
            rows={5}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            className="w-full border border-border rounded-lg px-4 py-3 text-sm resize-none"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary text-primary-foreground py-3 rounded-full text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? "Sending..." : "Send Message"}
          </button>
        </form>
      )}
    </div>
  );
}
