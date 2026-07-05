// app/(marketing)/contact/page.js
"use client";

import { useState } from "react";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/marketing/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, source: "contact_page" }),
    });
    setSubmitting(false);
    setSubmitted(true);
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Contact Us</h1>
      <p className="text-gray-600 mb-8">
        Have a question, or want a demo? Send us a message.
      </p>

      {submitted ? (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-6 text-sm">
          Thanks for reaching out — we'll get back to you shortly.
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <input
            required
            placeholder="Your name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm"
          />
          <input
            required
            type="email"
            placeholder="Your email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm"
          />
          <textarea
            required
            placeholder="How can we help?"
            rows={5}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm resize-none"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gray-900 text-white py-3 rounded-full text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? "Sending..." : "Send Message"}
          </button>
        </form>
      )}
    </div>
  );
}
