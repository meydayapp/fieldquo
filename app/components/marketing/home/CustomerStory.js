// app/components/marketing/home/CustomerStory.js
//
// Section 9: a customer story — and today, deliberately, nothing.
//
// ══ Why this renders nothing ══════════════════════════════════════════════
//
// The owner-approved homepage structure has a customer-story slot, and on
// 2026-09-29 FieldQuo has no verified customer story to put in it. An
// invented one — a made-up painter with a made-up quote and a stock
// headshot — is the single most damaging thing this page could say, because
// it is the thing a sceptical contractor would check. So the section is
// wired and EMPTY, and renders nothing at all (no heading, no "coming soon")
// until a real story is added.
//
// ══ How to add one ═══════════════════════════════════════════════════════
//
// Only a story the customer has agreed to, in words they approved, that the
// owner has signed off. Add an entry to CUSTOMER_STORIES:
//
//   {
//     id: "acme-painting-2026",
//     company: "Acme Painting",          // as the customer wants it printed
//     trade: "painting",                 // an app/data/industries.js slug
//     person: "Jane Doe",
//     role: "Owner",
//     // The customer's own words, per language THEY approved. Never
//     // machine-translated: a quote is a statement by a real person, and a
//     // translation they did not see is words put in their mouth. Languages
//     // without an entry show the original.
//     quote: { en: "…" },
//     originalLanguage: "en",
//     approvedBy: "owner name",          // who at FieldQuo signed it off
//     approvedOn: "2026-10-15",          // and when
//   }
//
// check:homepage-sections fails any entry without approvedBy and approvedOn,
// and any `quote` missing its originalLanguage.
"use client";

import { Quote } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

export const CUSTOMER_STORIES = [];

export default function CustomerStory() {
  const { language } = useTranslation();
  const story = CUSTOMER_STORIES[0];
  if (!story) return null;

  const words = story.quote?.[language] || story.quote?.[story.originalLanguage];
  if (!words) return null;

  return (
    <section className="bg-muted border-t border-border">
      <figure className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
        <Quote size={32} aria-hidden="true" className="mx-auto text-brand-accent-text" />
        <blockquote
          lang={story.quote?.[language] ? language : story.originalLanguage}
          className="mt-6 text-2xl sm:text-3xl font-semibold leading-snug tracking-tight text-foreground text-balance"
        >
          {words}
        </blockquote>
        <figcaption className="mt-6 text-muted-foreground">
          <span className="font-semibold text-foreground">{story.person}</span>
          {story.role ? `, ${story.role}` : ""} · {story.company}
        </figcaption>
      </figure>
    </section>
  );
}
