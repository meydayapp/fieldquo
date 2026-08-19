// app/components/public/BookVisitPanel.js
//
// "Would you like us to come and look at it?" — offered to a homeowner who has
// just finished a public form, on both surfaces that finish one: the self-quote
// confirmation and the instant-estimate result.
//
// ── Why it lives here rather than in each flow ──────────────────────────────
//
// It started inside SelfQuoteFlow. Adding the same offer to the instant
// estimate would have meant a second copy — and a second copy of an offer is
// the one that rots: the wording drifts, one of them keeps rendering after the
// company turns booking off, and nobody notices because nobody looks at the
// one they didn't write. One component, two callers.
//
// ── What it deliberately does NOT do ────────────────────────────────────────
//
// It reimplements no part of booking. Opening it mounts the real BookingFlow —
// the same component /book/<slug> renders — so the calendar, the availability
// rules, travel-time filtering, arrival windows, the visit fee and the
// confirmation email are all the ones that already exist and are already
// tested. A second calendar built for a confirmation screen would be a second
// set of availability bugs.
//
// ── Collapsed until asked for ───────────────────────────────────────────────
//
// The document above is the thing they just earned; a calendar unfolded
// beneath it competes with it for attention, and someone who wants a visit has
// decided that before they scroll. One tap opens it, with the details they
// typed thirty seconds ago already filled in.
"use client";

import { useState } from "react";
import BookingFlow from "@/app/book/[companySlug]/BookingFlow";

/**
 * @param slug     the company's booking slug (bookingSlug || slug)
 * @param contact  { name, email, phone, address } as they typed it
 * @param copy     { title, body, cta } — the caller's own wording, in the
 *                 client's language. Passed in rather than resolved here
 *                 because the two surfaces resolve language differently and
 *                 the document's language must win on the document's page.
 * @param theme    optional { wash, ink, inkMuted } for the collapsed card. The
 *                 self-quote confirmation is a branded DOCUMENT and matches
 *                 documentTheme; the instant estimate is an app-styled page and
 *                 passes nothing, taking the neutral surface instead.
 * @param fill     optional { bg, fg } measured pair for the button.
 */
export default function BookVisitPanel({ slug, contact, copy, theme = null, fill = null, quoteId = null }) {
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <div className="mt-4">
        <BookingFlow
          companySlug={slug}
          quoteId={quoteId}
          prefill={{
            name: contact?.name || "",
            email: contact?.email || "",
            phone: contact?.phone || "",
            address: contact?.address || "",
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`mt-4 rounded-2xl px-6 py-5 text-center ${theme ? "" : "border border-border bg-card"}`}
      style={theme ? { backgroundColor: theme.wash } : undefined}
    >
      <p
        className="text-sm font-semibold"
        style={theme ? { color: theme.ink } : undefined}
      >
        {copy.title}
      </p>
      <p
        className={`text-xs mt-1 ${theme ? "" : "text-muted-foreground"}`}
        style={theme ? { color: theme.inkMuted } : undefined}
      >
        {copy.body}
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-bold"
        style={fill ? { backgroundColor: fill.bg, color: fill.fg } : { backgroundColor: "var(--brand)", color: "#fff" }}
      >
        {copy.cta}
      </button>
    </div>
  );
}
